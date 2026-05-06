"""
PreprocessingEngine — wavelet denoising, IQR outlier capping, scaling,
and sequence creation for the CNN-BiLSTM-Attention model.

Key invariant (added in the leakage fix):
    Wavelet denoising and IQR outlier bounds are applied PER SLICE
    inside `prepare_data`, after the chronological split. Test/val
    samples never inform train preprocessing parameters.
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import pywt
from sklearn.preprocessing import RobustScaler
import joblib


class PreprocessingEngine:
    """Handles all preprocessing: denoising, outlier handling, scaling, sequencing."""

    def __init__(self, lookback: int = 60, wavelet: str = "db4", level: int = 2):
        self.lookback = lookback
        self.wavelet = wavelet
        self.level = level
        self.scaler = RobustScaler()
        self._is_fitted = False
        # Outlier bounds fitted on TRAIN slice only — column → (lower, upper)
        self._outlier_bounds: Dict[str, Tuple[float, float]] = {}

    # ------------------------------------------------------------------
    # Wavelet denoising  (no fitted state — basis is signal-derived)
    # ------------------------------------------------------------------

    def _wavelet_denoise(self, signal: np.ndarray) -> np.ndarray:
        """Apply DWT wavelet denoising to a 1-D signal."""
        coeffs = pywt.wavedec(signal, self.wavelet, level=self.level)
        sigma = np.median(np.abs(coeffs[-1])) / 0.6745
        threshold = sigma * np.sqrt(2 * np.log(len(signal)))
        denoised_coeffs = [coeffs[0]] + [
            pywt.threshold(c, threshold, mode="soft") for c in coeffs[1:]
        ]
        reconstructed = pywt.waverec(denoised_coeffs, self.wavelet)
        return reconstructed[: len(signal)]

    def denoise_dataframe(self, df: pd.DataFrame, columns: list) -> pd.DataFrame:
        """Apply wavelet denoising to specified numeric columns of `df`.

        IMPORTANT: the wavelet basis is GLOBAL on the passed DataFrame.
        For training, this MUST be called per-slice (train/val/test) AFTER
        the split — otherwise future samples leak into past denoised values.
        For inference (predict.py) it is safe to call on the full historical
        DataFrame because no future data is involved.
        """
        df = df.copy()
        for col in columns:
            if col in df.columns:
                arr = df[col].values.astype(float)
                if len(arr) < 4:  # too short to denoise
                    continue
                if np.any(np.isnan(arr)):
                    mask = np.isnan(arr)
                    arr_interp = pd.Series(arr).interpolate().values.copy()
                    denoised = self._wavelet_denoise(arr_interp)
                    denoised[mask] = np.nan
                    df[col] = denoised
                else:
                    df[col] = self._wavelet_denoise(arr)
        return df

    # ------------------------------------------------------------------
    # IQR outlier capping  (fit on train only, apply to all slices)
    # ------------------------------------------------------------------

    def fit_outlier_bounds(
        self, df: pd.DataFrame, columns: list, factor: float = 3.0
    ) -> None:
        """Compute IQR-based clipping bounds from `df` (typically the train slice).

        Stored bounds are reused for val/test/inference via apply_outlier_bounds().
        """
        bounds: Dict[str, Tuple[float, float]] = {}
        for col in columns:
            if col not in df.columns:
                continue
            q1 = df[col].quantile(0.25)
            q3 = df[col].quantile(0.75)
            iqr = q3 - q1
            bounds[col] = (q1 - factor * iqr, q3 + factor * iqr)
        self._outlier_bounds = bounds

    def apply_outlier_bounds(self, df: pd.DataFrame, columns: list) -> pd.DataFrame:
        """Clip `df[columns]` using bounds previously fit on the train slice."""
        if not self._outlier_bounds:
            raise RuntimeError(
                "Outlier bounds not fitted. Call fit_outlier_bounds() first."
            )
        df = df.copy()
        for col in columns:
            if col in df.columns and col in self._outlier_bounds:
                lo, hi = self._outlier_bounds[col]
                df[col] = df[col].clip(lower=lo, upper=hi)
        return df

    @staticmethod
    def cap_outliers(df: pd.DataFrame, columns: list, factor: float = 3.0) -> pd.DataFrame:
        """Legacy: fit-and-apply IQR bounds in one pass on the passed df.

        DEPRECATED for training pipelines (it leaks test info into bounds).
        Kept for back-compat with scripts that operate on a single slice
        and don't need the train-only fit guarantee.
        """
        df = df.copy()
        for col in columns:
            if col not in df.columns:
                continue
            q1 = df[col].quantile(0.25)
            q3 = df[col].quantile(0.75)
            iqr = q3 - q1
            df[col] = df[col].clip(lower=q1 - factor * iqr, upper=q3 + factor * iqr)
        return df

    # ------------------------------------------------------------------
    # Stationarity (returns conversion)
    # ------------------------------------------------------------------

    RETURN_COLUMNS = [
        "Open", "High", "Low", "Close", "Volume",
        "SMA_50", "EMA_20", "ATR",
        "Oil", "SP500", "Gold", "DXY", "Interest_Rate",
    ]

    @staticmethod
    def to_returns(df, columns=None):
        """Convert price-level columns to percentage returns for stationarity.

        Sentiment/RSI/MACD/Bollinger_Width are already stationary and must
        not be converted.  Replaces inf with 0.
        """
        if columns is None:
            columns = PreprocessingEngine.RETURN_COLUMNS
        df = df.copy()
        for col in columns:
            if col in df.columns:
                df[col] = df[col].pct_change()
        df.replace([np.inf, -np.inf], 0, inplace=True)
        return df

    # ------------------------------------------------------------------
    # Scaling
    # ------------------------------------------------------------------

    def fit_scaler(self, train_data: np.ndarray) -> None:
        self.scaler.fit(train_data)
        self._is_fitted = True

    def transform(self, data: np.ndarray) -> np.ndarray:
        if not self._is_fitted:
            raise RuntimeError("Scaler not fitted. Call fit_scaler() first.")
        return self.scaler.transform(data)

    def inverse_transform(self, data: np.ndarray) -> np.ndarray:
        if not self._is_fitted:
            raise RuntimeError("Scaler not fitted. Call fit_scaler() first.")
        return self.scaler.inverse_transform(data)

    # ------------------------------------------------------------------
    # Persist / load (scaler + outlier bounds together)
    # ------------------------------------------------------------------

    def save_scaler(self, path: str) -> None:
        """Save scaler AND outlier bounds in one bundle for reproducible inference."""
        bundle = {"scaler": self.scaler, "outlier_bounds": self._outlier_bounds}
        joblib.dump(bundle, path)
        print(f"[INFO] Scaler + outlier bounds saved to {path}")

    def load_scaler(self, path: str) -> None:
        """Load scaler + outlier bounds (or legacy bare-scaler files)."""
        obj = joblib.load(path)
        if isinstance(obj, dict) and "scaler" in obj:
            self.scaler = obj["scaler"]
            self._outlier_bounds = obj.get("outlier_bounds", {})
        else:
            # Legacy: file is a bare RobustScaler with no bounds
            self.scaler = obj
            self._outlier_bounds = {}
        self._is_fitted = True
        print(f"[INFO] Scaler loaded from {path} "
              f"(outlier_bounds: {len(self._outlier_bounds)} cols)")

    # ------------------------------------------------------------------
    # Sequence creation
    # ------------------------------------------------------------------

    @staticmethod
    def create_sequences(
        data: np.ndarray, target_col_idx: int, lookback: int
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Create sliding-window sequences for time-series prediction."""
        X, y = [], []
        for i in range(lookback, len(data)):
            X.append(data[i - lookback : i])
            y.append(data[i, target_col_idx])
        return np.array(X), np.array(y)

    # ------------------------------------------------------------------
    # Full pipeline: split → per-slice denoise+returns → fit IQR/scaler on train
    # → transform all → sequences
    # ------------------------------------------------------------------

    def prepare_data(
        self,
        df: pd.DataFrame,
        feature_columns: list,
        target_column: str = "Close",
        train_ratio: float = 0.70,
        val_ratio: float = 0.15,
        denoise_cols: Optional[List[str]] = None,
        return_cols: Optional[List[str]] = None,
        outlier_factor: float = 3.0,
    ) -> dict:
        """End-to-end leakage-free preparation.

        Pipeline (the leakage fix):
            1. Sort + chronological split into train / val / test slices.
            2. PER SLICE: wavelet-denoise prices, then convert to returns,
               then drop the first row (NaN from pct_change).
            3. Fit IQR bounds on the TRAIN slice; apply to all three.
            4. Fit RobustScaler on the TRAIN slice; transform all three.
            5. Build sliding-window sequences.

        Parameters
        ----------
        df :  Full DataFrame with Date, all feature columns, and `Close_Orig`
              (the un-touched price column used to convert predicted returns
              back to prices in evaluation).
        feature_columns :  ordered list of columns the model consumes.
        denoise_cols :  columns to wavelet-denoise per slice (typically OHLCV
                        + macro). Defaults to RETURN_COLUMNS minus indicators.
        return_cols :   columns to convert via pct_change. Defaults to
                        RETURN_COLUMNS.
        """
        if target_column not in feature_columns:
            raise ValueError(f"target_column '{target_column}' must be in feature_columns")
        if "Close_Orig" not in df.columns:
            raise ValueError("DataFrame must include 'Close_Orig' column "
                             "(un-touched Close price for return→price conversion)")

        if denoise_cols is None:
            denoise_cols = ["Close", "Open", "High", "Low", "Volume",
                            "Oil", "SP500", "Gold", "DXY", "Interest_Rate"]
        if return_cols is None:
            return_cols = self.RETURN_COLUMNS

        # 1. Sort + split
        df = df.sort_values("Date").reset_index(drop=True)
        n = len(df)
        train_end = int(n * train_ratio)
        val_end = int(n * (train_ratio + val_ratio))

        slices = {
            "train": df.iloc[:train_end].copy(),
            "val":   df.iloc[train_end:val_end].copy(),
            "test":  df.iloc[val_end:].copy(),
        }

        # 2. Per-slice: denoise prices, then to_returns, then drop pct_change NaN
        processed: Dict[str, pd.DataFrame] = {}
        for name, slice_df in slices.items():
            slice_df = self.denoise_dataframe(slice_df, denoise_cols)
            slice_df = self.to_returns(slice_df, return_cols)
            slice_df = slice_df.dropna(subset=feature_columns).reset_index(drop=True)
            processed[name] = slice_df

        # 3. Fit IQR bounds on TRAIN; apply to all
        self.fit_outlier_bounds(processed["train"], feature_columns,
                                factor=outlier_factor)
        for name in processed:
            processed[name] = self.apply_outlier_bounds(processed[name], feature_columns)

        # 4. Fit scaler on TRAIN; transform all
        train_data = processed["train"][feature_columns].values.astype(np.float64)
        self.fit_scaler(train_data)
        scaled = {
            name: self.transform(processed[name][feature_columns].values.astype(np.float64))
            for name in processed
        }

        # 5. Sequences
        target_col_idx = feature_columns.index(target_column)
        seqs = {
            name: self.create_sequences(scaled[name], target_col_idx, self.lookback)
            for name in processed
        }
        X_train, y_train = seqs["train"]
        X_val, y_val = seqs["val"]
        X_test, y_test = seqs["test"]

        # Date + prev_close arrays aligned with the test sequences (for eval).
        # After create_sequences, sequence i predicts row (lookback + i) of the
        # processed slice. prev_close for that prediction is row (lookback + i − 1).
        test_proc = processed["test"]
        test_dates = test_proc["Date"].values[self.lookback:]
        test_prev_closes = test_proc["Close_Orig"].values[self.lookback - 1: -1]
        # Trim to match y_test length exactly.
        n_test = len(y_test)
        test_dates = test_dates[:n_test]
        test_prev_closes = test_prev_closes[:n_test]

        # Same for val/train for completeness
        train_proc = processed["train"]
        val_proc = processed["val"]
        train_prev_closes = train_proc["Close_Orig"].values[self.lookback - 1: -1][:len(y_train)]
        val_prev_closes = val_proc["Close_Orig"].values[self.lookback - 1: -1][:len(y_val)]

        print(f"[INFO] Data shapes — Train: {X_train.shape}, "
              f"Val: {X_val.shape}, Test: {X_test.shape}")
        if len(processed["train"]):
            print(f"[INFO] Train period: {pd.Timestamp(train_proc['Date'].iloc[0]).date()} "
                  f"to {pd.Timestamp(train_proc['Date'].iloc[-1]).date()}")
        if len(processed["val"]):
            print(f"[INFO] Val period:   {pd.Timestamp(val_proc['Date'].iloc[0]).date()} "
                  f"to {pd.Timestamp(val_proc['Date'].iloc[-1]).date()}")
        if len(processed["test"]):
            print(f"[INFO] Test period:  {pd.Timestamp(test_proc['Date'].iloc[0]).date()} "
                  f"to {pd.Timestamp(test_proc['Date'].iloc[-1]).date()}")

        return {
            "X_train": X_train, "y_train": y_train,
            "X_val": X_val, "y_val": y_val,
            "X_test": X_test, "y_test": y_test,
            "feature_columns": feature_columns,
            "target_col_idx": target_col_idx,
            "dates_test": test_dates,
            "test_prev_closes": test_prev_closes,
            "val_prev_closes": val_prev_closes,
            "train_prev_closes": train_prev_closes,
        }
