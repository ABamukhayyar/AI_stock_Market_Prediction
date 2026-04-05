"""
PreprocessingEngine — wavelet denoising, IQR outlier capping, scaling,
and sequence creation for the CNN-BiLSTM-Attention model.
"""

from pathlib import Path
from typing import Tuple

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

    # ------------------------------------------------------------------
    # Wavelet denoising
    # ------------------------------------------------------------------

    def _wavelet_denoise(self, signal: np.ndarray) -> np.ndarray:
        """Apply DWT wavelet denoising to a 1-D signal."""
        coeffs = pywt.wavedec(signal, self.wavelet, level=self.level)
        # Universal threshold (VisuShrink)
        sigma = np.median(np.abs(coeffs[-1])) / 0.6745
        threshold = sigma * np.sqrt(2 * np.log(len(signal)))
        # Soft-threshold detail coefficients (keep approximation untouched)
        denoised_coeffs = [coeffs[0]] + [
            pywt.threshold(c, threshold, mode="soft") for c in coeffs[1:]
        ]
        reconstructed = pywt.waverec(denoised_coeffs, self.wavelet)
        # waverec can return len+1 in edge cases
        return reconstructed[: len(signal)]

    def denoise_dataframe(self, df: pd.DataFrame, columns: list) -> pd.DataFrame:
        """Apply wavelet denoising to specified numeric columns."""
        df = df.copy()
        for col in columns:
            if col in df.columns:
                arr = df[col].values.astype(float)
                if np.any(np.isnan(arr)):
                    # Interpolate NaNs before denoising, restore positions after
                    mask = np.isnan(arr)
                    arr_interp = pd.Series(arr).interpolate().values.copy()
                    denoised = self._wavelet_denoise(arr_interp)
                    denoised[mask] = np.nan
                    df[col] = denoised
                else:
                    df[col] = self._wavelet_denoise(arr)
        return df

    # ------------------------------------------------------------------
    # IQR outlier capping
    # ------------------------------------------------------------------

    @staticmethod
    def cap_outliers(df: pd.DataFrame, columns: list, factor: float = 3.0) -> pd.DataFrame:
        """Cap outliers using IQR method (Winsorization)."""
        df = df.copy()
        for col in columns:
            if col not in df.columns:
                continue
            q1 = df[col].quantile(0.25)
            q3 = df[col].quantile(0.75)
            iqr = q3 - q1
            lower = q1 - factor * iqr
            upper = q3 + factor * iqr
            df[col] = df[col].clip(lower=lower, upper=upper)
        return df

    # ------------------------------------------------------------------
    # Stationarity (returns conversion)
    # ------------------------------------------------------------------

    # Columns to convert to returns (percentage change).
    # Sentiment columns (Sentiment_Score, Sentiment_Confidence, Sentiment_Encoded)
    # are already stationary and must NOT be converted.
    # RSI, MACD, Bollinger_Width are also already stationary.
    RETURN_COLUMNS = [
        "Open", "High", "Low", "Close", "Volume",
        "SMA_50", "EMA_20", "ATR",
        "Oil", "SP500", "Gold", "DXY", "Interest_Rate",
    ]

    @staticmethod
    def to_returns(df, columns=None):
        """Convert price-level columns to percentage returns for stationarity.

        Columns like RSI, MACD, Bollinger_Width are already stationary and
        should NOT be converted.  Replaces inf with 0.
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
        """Fit the RobustScaler on training data ONLY (prevents data leakage)."""
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

    def save_scaler(self, path: str) -> None:
        joblib.dump(self.scaler, path)
        print(f"[INFO] Scaler saved to {path}")

    def load_scaler(self, path: str) -> None:
        self.scaler = joblib.load(path)
        self._is_fitted = True
        print(f"[INFO] Scaler loaded from {path}")

    # ------------------------------------------------------------------
    # Sequence creation
    # ------------------------------------------------------------------

    @staticmethod
    def create_sequences(
        data: np.ndarray, target_col_idx: int, lookback: int
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Create sliding-window sequences for time-series prediction.

        Parameters
        ----------
        data : np.ndarray of shape (n_samples, n_features) — already scaled
        target_col_idx : int — index of the Close price column
        lookback : int — number of past days per sample

        Returns
        -------
        X : np.ndarray of shape (n_sequences, lookback, n_features)
        y : np.ndarray of shape (n_sequences,) — next-day Close (scaled)
        """
        X, y = [], []
        for i in range(lookback, len(data)):
            X.append(data[i - lookback : i])
            y.append(data[i, target_col_idx])
        return np.array(X), np.array(y)

    # ------------------------------------------------------------------
    # Full pipeline: split, scale, sequence
    # ------------------------------------------------------------------

    def prepare_data(
        self,
        df: pd.DataFrame,
        feature_columns: list,
        target_column: str = "Close",
        train_ratio: float = 0.70,
        val_ratio: float = 0.15,
    ) -> dict:
        """End-to-end preparation: split -> scale (train only) -> create sequences.

        Parameters
        ----------
        df : DataFrame with a Date column and all feature + target columns.
        feature_columns : list of column names to use as model features.
        target_column : column to predict (must be in feature_columns).
        train_ratio, val_ratio : chronological split ratios (test = remainder).

        Returns
        -------
        dict with keys: X_train, y_train, X_val, y_val, X_test, y_test,
                        feature_columns, target_col_idx, dates_test
        """
        if target_column not in feature_columns:
            raise ValueError(f"target_column '{target_column}' must be in feature_columns")

        # Sort by date to ensure chronological order
        df = df.sort_values("Date").reset_index(drop=True)

        data = df[feature_columns].values.astype(np.float64)
        dates = df["Date"].values

        n = len(data)
        train_end = int(n * train_ratio)
        val_end = int(n * (train_ratio + val_ratio))

        train_data = data[:train_end]
        val_data = data[train_end:val_end]
        test_data = data[val_end:]

        # Fit scaler on training data ONLY
        self.fit_scaler(train_data)

        # Transform all splits
        train_scaled = self.transform(train_data)
        val_scaled = self.transform(val_data)
        test_scaled = self.transform(test_data)

        target_col_idx = feature_columns.index(target_column)

        # Create sequences
        X_train, y_train = self.create_sequences(train_scaled, target_col_idx, self.lookback)
        X_val, y_val = self.create_sequences(val_scaled, target_col_idx, self.lookback)
        X_test, y_test = self.create_sequences(test_scaled, target_col_idx, self.lookback)

        # Dates aligned with test targets
        test_dates = dates[val_end + self.lookback :]

        print(f"[INFO] Data shapes — "
              f"Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")
        print(f"[INFO] Train period: {pd.Timestamp(dates[0]).date()} to "
              f"{pd.Timestamp(dates[train_end - 1]).date()}")
        print(f"[INFO] Val period:   {pd.Timestamp(dates[train_end]).date()} to "
              f"{pd.Timestamp(dates[val_end - 1]).date()}")
        print(f"[INFO] Test period:  {pd.Timestamp(dates[val_end]).date()} to "
              f"{pd.Timestamp(dates[-1]).date()}")

        return {
            "X_train": X_train,
            "y_train": y_train,
            "X_val": X_val,
            "y_val": y_val,
            "X_test": X_test,
            "y_test": y_test,
            "feature_columns": feature_columns,
            "target_col_idx": target_col_idx,
            "dates_test": test_dates,
        }
