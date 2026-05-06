"""
ModelTrainer — orchestrates the full training pipeline:
    1. Load TASI + macro data
    2. Compute technical indicators
    3. Save raw Close as Close_Orig + drop indicator warm-up NaN
    4. Chronological split → per-slice denoise + returns + IQR (train-fit) + scale
       → create sequences
    5. Build & train CNN-BiLSTM-Attention model
    6. Save model + scaler bundle (scaler + outlier bounds)
    7. Plot training curves

Leakage fix vs. the previous version: wavelet denoising and IQR outlier
capping are now applied PER SLICE inside prepare_data() and the IQR bounds
are fit on the TRAIN slice only, so test/val data never informs train-side
preprocessing parameters.
"""

import argparse
from pathlib import Path

# Seed everything before TF / NumPy ops happen anywhere downstream.
from utils.seed import set_seed
set_seed(42)

import matplotlib
matplotlib.use("Agg")  # non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from data_acquisition.market_data import DataAcquisitionService
from data_acquisition.registry import get_stock_info
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
    "Sentiment_Score", "Sentiment_Confidence", "Sentiment_Encoded",
]

TARGET_COLUMN = "Close"


class ModelTrainer:
    """End-to-end training pipeline."""

    def __init__(
        self,
        symbol: str = "TASI",
        csv_path: str | None = None,
        model_path: str | None = None,
        scaler_path: str | None = None,
        lookback: int = 60,
        epochs: int = 100,
        batch_size: int = 32,
    ):
        info = get_stock_info(symbol)
        self.symbol = symbol
        self.ticker = info["yfinance_ticker"]
        # Allow CLI overrides; otherwise pull from registry. CSV is TASI-only.
        self.csv_path = csv_path or info.get("csv_path", "")
        self.model_path = model_path or info["cnn_model_path"]
        self.scaler_path = scaler_path or info["cnn_scaler_path"]
        self.lookback = lookback
        self.epochs = epochs
        self.batch_size = batch_size

    @staticmethod
    def _merge_sentiment(df: pd.DataFrame) -> pd.DataFrame:
        """Merge TASI-wide sentiment as a proxy for every symbol.

        Sentiment is fetched as `get_sentiment("TASI")` even when training a
        per-stock model, per the v1 scope decision (documented in the writeup).
        """
        try:
            from db.supabase_client import get_sentiment
            sent_df = get_sentiment("TASI")
            if not sent_df.empty:
                sent_df = sent_df.rename(columns={
                    "date": "Date",
                    "sentiment_score": "Sentiment_Score",
                    "confidence": "Sentiment_Confidence",
                    "sentiment_encoded": "Sentiment_Encoded",
                })
                sent_df = sent_df[["Date", "Sentiment_Score", "Sentiment_Confidence",
                                   "Sentiment_Encoded"]]
                df = pd.merge(df, sent_df, on="Date", how="left")
                filled = df["Sentiment_Score"].notna().sum()
                print(f"[INFO] Merged {filled} days of sentiment data from Supabase")
            else:
                print("[INFO] No sentiment data in Supabase — using neutral defaults")
        except Exception as e:
            print(f"[WARN] Could not load sentiment from Supabase: {e}")

        # Fill missing sentiment with neutral defaults
        for col, default in [("Sentiment_Score", 0), ("Sentiment_Confidence", 0),
                             ("Sentiment_Encoded", 0)]:
            if col not in df.columns:
                df[col] = default
            else:
                df[col] = df[col].ffill().fillna(default)
        return df

    def run(self) -> None:
        # ---- 1. Data acquisition ----
        print("=" * 60)
        print(f"STEP 1: Loading {self.symbol} data + macroeconomic indicators")
        print("=" * 60)
        das = DataAcquisitionService(
            csv_path=self.csv_path or "TASI_Historical_Data.csv",
            symbol=self.symbol,
            ticker=self.ticker,
        )
        # TASI has the CSV backup; everything else trains from Supabase market_data
        # (populated by backfill_stocks.py).
        source = "csv" if self.symbol == "TASI" else "supabase"
        df = das.load_all(source=source)

        # ---- 1b. Merge sentiment data ----
        print("\n" + "=" * 60)
        print("STEP 1b: Merging sentiment data")
        print("=" * 60)
        df = self._merge_sentiment(df)

        # ---- 2. Technical indicators ----
        print("\n" + "=" * 60)
        print("STEP 2: Computing technical indicators")
        print("=" * 60)
        df = TechnicalAnalysisService.add_all(df)

        # Store technical indicators in Supabase under this stock's symbol.
        try:
            from db.supabase_client import upsert_technical_indicators
            count = upsert_technical_indicators(df, symbol=self.symbol)
            print(f"[INFO] Stored {count} rows of technical indicators in Supabase "
                  f"for {self.symbol}")
        except Exception as e:
            print(f"[WARN] Could not store technical indicators in Supabase: {e}")

        # Verify ATR is real (not Price * 0.02)
        sample_atr = df["ATR"].dropna().iloc[-1]
        sample_close = df["Close"].dropna().iloc[-1]
        fake_atr = sample_close * 0.02
        if abs(sample_atr - fake_atr) < 1.0:
            print("[WARN] ATR looks suspiciously close to 2% of price. "
                  "Double-check the ATR calculation!")

        # ---- 3. Save raw Close + drop indicator warm-up NaN ----
        # Close_Orig must be carried through prepare_data so we can convert
        # predicted returns back into prices for the eval block.
        df["Close_Orig"] = df["Close"].copy()
        before = len(df)
        df.dropna(subset=FEATURE_COLUMNS, inplace=True)
        df.reset_index(drop=True, inplace=True)
        print(f"[INFO] Dropped {before - len(df)} indicator-warmup NaN rows. "
              f"Remaining: {len(df)}")

        # ---- 4. Prepare data — per-slice denoise + returns + train-fit IQR + scale ----
        print("\n" + "=" * 60)
        print("STEP 4: Per-slice denoise/returns + train-fit IQR + scale + sequence")
        print("=" * 60)
        preproc = PreprocessingEngine(lookback=self.lookback)

        denoise_cols = ["Close", "Open", "High", "Low", "Volume",
                        "Oil", "SP500", "Gold", "DXY", "Interest_Rate"]

        result = preproc.prepare_data(
            df,
            feature_columns=FEATURE_COLUMNS,
            target_column=TARGET_COLUMN,
            denoise_cols=denoise_cols,
            return_cols=PreprocessingEngine.RETURN_COLUMNS,
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

        # Convert returns → actual prices using prev-closes returned from prepare_data
        test_prev_closes = result["test_prev_closes"]
        n_preds = len(y_test_returns)
        test_prev_closes = test_prev_closes[:n_preds]

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
    parser = argparse.ArgumentParser(description="Train CNN-BiLSTM-Attention model")
    parser.add_argument("--symbol", default="TASI",
                        help="Stock symbol (TASI/ARAMCO/RAJHI/SABIC/STC/SECO).")
    parser.add_argument("--csv", default=None,
                        help="Path to CSV (TASI only). Other symbols read from Supabase.")
    parser.add_argument("--model", default=None,
                        help="Override model save path (otherwise from registry).")
    parser.add_argument("--scaler", default=None,
                        help="Override scaler save path (otherwise from registry).")
    parser.add_argument("--lookback", type=int, default=60)
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()

    trainer = ModelTrainer(
        symbol=args.symbol,
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
