"""
ModelTrainer — orchestrates the full training pipeline:
    1. Load TASI + macro data
    2. Compute technical indicators
    3. Wavelet denoise + outlier capping
    4. Drop NaN rows (from indicator warm-up)
    5. Chronological split → scale (train only) → create sequences
    6. Build & train CNN-BiLSTM-Attention model
    7. Save model + scaler
    8. Plot training curves
"""

import argparse
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from data_acquisition.market_data import DataAcquisitionService
from technical_analysis.indicators import TechnicalAnalysisService
from preprocessing.engine import PreprocessingEngine
from prediction.engine import PredictionEngine


# ======================================================================
# Feature column order (must be identical at train and inference time)
# ======================================================================
FEATURE_COLUMNS = [
    "Open", "High", "Low", "Close", "Volume",
    "RSI", "MACD", "ATR", "Bollinger_Width", "SMA_50", "EMA_20",
    "Oil", "SP500", "Gold", "DXY", "Interest_Rate",
]

TARGET_COLUMN = "Close"


class ModelTrainer:
    """End-to-end training pipeline."""

    def __init__(
        self,
        csv_path: str = "TASI_Historical_Data.csv",
        model_path: str = "models/TASI_Model_v3.keras",
        scaler_path: str = "models/TASI_Scaler_v3.pkl",
        lookback: int = 60,
        epochs: int = 100,
        batch_size: int = 32,
    ):
        self.csv_path = csv_path
        self.model_path = model_path
        self.scaler_path = scaler_path
        self.lookback = lookback
        self.epochs = epochs
        self.batch_size = batch_size

    def run(self) -> None:
        # ---- 1. Data acquisition ----
        print("=" * 60)
        print("STEP 1: Loading TASI data + macroeconomic indicators")
        print("=" * 60)
        das = DataAcquisitionService(csv_path=self.csv_path)
        df = das.load_all()

        # ---- 2. Technical indicators ----
        print("\n" + "=" * 60)
        print("STEP 2: Computing technical indicators")
        print("=" * 60)
        df = TechnicalAnalysisService.add_all(df)

        # Verify ATR is real (not Price * 0.02)
        sample_atr = df["ATR"].dropna().iloc[-1]
        sample_close = df["Close"].dropna().iloc[-1]
        fake_atr = sample_close * 0.02
        if abs(sample_atr - fake_atr) < 1.0:
            print("[WARN] ATR looks suspiciously close to 2% of price. "
                  "Double-check the ATR calculation!")

        # ---- 3. Wavelet denoising ----
        print("\n" + "=" * 60)
        print("STEP 3: Wavelet denoising + outlier capping")
        print("=" * 60)
        preproc = PreprocessingEngine(lookback=self.lookback)

        denoise_cols = ["Close", "Open", "High", "Low", "Volume",
                        "Oil", "SP500", "Gold", "DXY", "Interest_Rate"]
        df = preproc.denoise_dataframe(df, denoise_cols)

        # ---- 3b. Convert non-stationary features to returns ----
        # Saves original Close for converting predictions back to price.
        # Returns are stationary so the scaler generalises across time periods.
        df["Close_Orig"] = df["Close"].copy()
        print("[INFO] Converting non-stationary features to returns...")
        df = PreprocessingEngine.to_returns(df)

        # Cap outliers on returns (not on raw price levels)
        numeric_cols = [c for c in FEATURE_COLUMNS if c in df.columns]
        df = preproc.cap_outliers(df, numeric_cols)

        # ---- 4. Drop NaN rows (from indicator warm-up + pct_change) ----
        before = len(df)
        df.dropna(subset=FEATURE_COLUMNS, inplace=True)
        df.reset_index(drop=True, inplace=True)
        print(f"[INFO] Dropped {before - len(df)} rows with NaN "
              f"(indicator warm-up + returns). Remaining: {len(df)}")

        # Verify no NaNs
        nan_counts = df[FEATURE_COLUMNS].isna().sum()
        if nan_counts.sum() > 0:
            print(f"[ERROR] NaN values remaining:\n{nan_counts[nan_counts > 0]}")
            raise ValueError("Feature matrix contains NaN values after cleanup.")

        # ---- 5. Prepare data (split, scale, sequence) ----
        print("\n" + "=" * 60)
        print("STEP 4: Chronological split, scaling (train only), sequencing")
        print("=" * 60)

        # Save original Close prices for return→price conversion
        close_orig = df["Close_Orig"].values
        n_rows = len(df)
        val_end_idx = int(n_rows * 0.85)

        result = preproc.prepare_data(
            df,
            feature_columns=FEATURE_COLUMNS,
            target_column=TARGET_COLUMN,
        )

        X_train = result["X_train"]
        y_train = result["y_train"]
        X_val = result["X_val"]
        y_val = result["y_val"]
        X_test = result["X_test"]
        y_test = result["y_test"]

        print(f"\nFeature matrix shape: {X_train.shape} "
              f"(samples, {self.lookback} days, {len(FEATURE_COLUMNS)} features)")

        # Save scaler
        Path(self.scaler_path).parent.mkdir(parents=True, exist_ok=True)
        preproc.save_scaler(self.scaler_path)

        # ---- 6. Build & train model ----
        print("\n" + "=" * 60)
        print("STEP 5: Building and training CNN-BiLSTM-Attention model")
        print("=" * 60)
        engine = PredictionEngine(
            lookback=self.lookback,
            n_features=len(FEATURE_COLUMNS),
        )
        engine.build_model()

        history = engine.train(
            X_train, y_train,
            X_val, y_val,
            epochs=self.epochs,
            batch_size=self.batch_size,
            model_path=self.model_path,
        )

        # ---- 7. Quick evaluation on test set ----
        print("\n" + "=" * 60)
        print("STEP 6: Quick evaluation on test set")
        print("=" * 60)
        y_pred_scaled = engine.predict(X_test)

        # Inverse-transform to get actual returns
        target_idx = result["target_col_idx"]
        n_features = len(FEATURE_COLUMNS)

        dummy = np.zeros((len(y_test), n_features))
        dummy[:, target_idx] = y_test
        y_test_returns = preproc.inverse_transform(dummy)[:, target_idx]

        dummy_pred = np.zeros((len(y_pred_scaled), n_features))
        dummy_pred[:, target_idx] = y_pred_scaled
        y_pred_returns = preproc.inverse_transform(dummy_pred)[:, target_idx]

        # Convert returns → actual prices
        test_prev_closes = close_orig[val_end_idx + self.lookback - 1: -1]
        test_actual_prices = close_orig[val_end_idx + self.lookback:]

        # Trim to match prediction length
        n_preds = len(y_test_returns)
        test_prev_closes = test_prev_closes[:n_preds]
        test_actual_prices = test_actual_prices[:n_preds]

        y_test_actual = test_prev_closes * (1 + y_test_returns)
        y_pred_actual = test_prev_closes * (1 + y_pred_returns)

        # Metrics (on actual prices in SAR)
        mae = np.mean(np.abs(y_test_actual - y_pred_actual))
        rmse = np.sqrt(np.mean((y_test_actual - y_pred_actual) ** 2))
        mape = np.mean(np.abs((y_test_actual - y_pred_actual) / y_test_actual)) * 100
        ss_res = np.sum((y_test_actual - y_pred_actual) ** 2)
        ss_tot = np.sum((y_test_actual - np.mean(y_test_actual)) ** 2)
        r2 = 1 - ss_res / ss_tot

        print(f"\n{'Metric':<10} {'Value':>12}")
        print("-" * 25)
        print(f"{'MAE':<10} {mae:>12.2f} SAR")
        print(f"{'RMSE':<10} {rmse:>12.2f} SAR")
        print(f"{'MAPE':<10} {mape:>11.2f}%")
        print(f"{'R²':<10} {r2:>12.4f}")

        target_met = "YES" if mape < 10 and r2 > 0.5 else "NO"
        print(f"\nTarget (MAPE<10%, R²>0.5): {target_met}")

        # ---- 8. Save plots ----
        self._plot_training_curves(history)
        self._plot_predictions(y_test_actual, y_pred_actual, result["dates_test"])

        print(f"\n[DONE] Model saved to {self.model_path}")
        print(f"[DONE] Scaler saved to {self.scaler_path}")

    # ------------------------------------------------------------------
    # Plotting helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _plot_training_curves(history) -> None:
        fig, axes = plt.subplots(1, 2, figsize=(14, 5))

        axes[0].plot(history.history["loss"], label="Train Loss")
        axes[0].plot(history.history["val_loss"], label="Val Loss")
        axes[0].set_title("Loss (Huber)")
        axes[0].set_xlabel("Epoch")
        axes[0].legend()
        axes[0].grid(True)

        axes[1].plot(history.history["mae"], label="Train MAE")
        axes[1].plot(history.history["val_mae"], label="Val MAE")
        axes[1].set_title("MAE")
        axes[1].set_xlabel("Epoch")
        axes[1].legend()
        axes[1].grid(True)

        plt.tight_layout()
        plt.savefig("models/training_curves.png", dpi=150)
        plt.close()
        print("[INFO] Training curves saved to models/training_curves.png")

    @staticmethod
    def _plot_predictions(y_actual, y_pred, dates) -> None:
        fig, ax = plt.subplots(figsize=(14, 6))
        # Trim dates to match predictions length
        plot_dates = pd.to_datetime(dates[: len(y_actual)])
        ax.plot(plot_dates, y_actual, label="Actual", linewidth=1.5)
        ax.plot(plot_dates, y_pred, label="Predicted", linewidth=1.5, alpha=0.8)
        ax.set_title("TASI — Actual vs Predicted Closing Price (Test Set)")
        ax.set_xlabel("Date")
        ax.set_ylabel("Price (SAR)")
        ax.legend()
        ax.grid(True)
        plt.tight_layout()
        plt.savefig("models/test_predictions.png", dpi=150)
        plt.close()
        print("[INFO] Prediction plot saved to models/test_predictions.png")


# ======================================================================
# CLI entry point
# ======================================================================

def main():
    parser = argparse.ArgumentParser(description="Train TASI CNN-BiLSTM-Attention model")
    parser.add_argument("--csv", default="TASI_Historical_Data.csv",
                        help="Path to TASI_Historical_Data.csv")
    parser.add_argument("--model", default="models/TASI_Model_v3.keras",
                        help="Path to save trained model")
    parser.add_argument("--scaler", default="models/TASI_Scaler_v3.pkl",
                        help="Path to save fitted scaler")
    parser.add_argument("--lookback", type=int, default=60)
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()

    trainer = ModelTrainer(
        csv_path=args.csv,
        model_path=args.model,
        scaler_path=args.scaler,
        lookback=args.lookback,
        epochs=args.epochs,
        batch_size=args.batch_size,
    )
    trainer.run()


if __name__ == "__main__":
    main()
