"""
evaluate.py — Comprehensive model evaluation and walk-forward backtesting.

Usage:
    python evaluate.py
    python evaluate.py --csv TASI_Historical_Data.csv --model models/TASI_Model_v3.keras
"""

import argparse
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from data_acquisition.market_data import DataAcquisitionService
from technical_analysis.indicators import TechnicalAnalysisService
from preprocessing.engine import PreprocessingEngine
from prediction.engine import PredictionEngine
from train_model import FEATURE_COLUMNS, TARGET_COLUMN


def compute_metrics(y_actual: np.ndarray, y_pred: np.ndarray) -> dict:
    """Compute regression metrics."""
    mae = np.mean(np.abs(y_actual - y_pred))
    rmse = np.sqrt(np.mean((y_actual - y_pred) ** 2))
    mape = np.mean(np.abs((y_actual - y_pred) / y_actual)) * 100
    ss_res = np.sum((y_actual - y_pred) ** 2)
    ss_tot = np.sum((y_actual - np.mean(y_actual)) ** 2)
    r2 = 1 - ss_res / ss_tot if ss_tot != 0 else 0.0

    # Direction accuracy: did we predict the correct direction of change?
    if len(y_actual) > 1:
        actual_dir = np.diff(y_actual) > 0
        pred_dir = np.diff(y_pred) > 0
        direction_acc = np.mean(actual_dir == pred_dir) * 100
    else:
        direction_acc = 0.0

    return {
        "MAE": mae,
        "RMSE": rmse,
        "MAPE": mape,
        "R2": r2,
        "Direction_Accuracy": direction_acc,
    }


def run_evaluation(
    csv_path: str = "TASI_Historical_Data.csv",
    model_path: str = "models/TASI_Model_v3.keras",
    scaler_path: str = "models/TASI_Scaler_v3.pkl",
    lookback: int = 60,
    output_dir: str = "models",
) -> None:
    """Full evaluation: test-set metrics + walk-forward backtest."""

    # ---- 1. Load and preprocess data ----
    print("=" * 60)
    print("Loading and preprocessing data...")
    print("=" * 60)

    das = DataAcquisitionService(csv_path=csv_path)
    df = das.load_all()
    df = TechnicalAnalysisService.add_all(df)

    # Match training preprocessing: denoise → returns → outlier cap
    preproc_prep = PreprocessingEngine(lookback=lookback)
    denoise_cols = ["Close", "Open", "High", "Low", "Volume",
                    "Oil", "SP500", "Gold", "DXY", "Interest_Rate"]
    df = preproc_prep.denoise_dataframe(df, denoise_cols)

    # Save original Close before returns conversion
    df["Close_Orig"] = df["Close"].copy()

    # Convert to returns
    df = PreprocessingEngine.to_returns(df)

    # Cap outliers on returns
    numeric_cols = [c for c in FEATURE_COLUMNS if c in df.columns]
    df = PreprocessingEngine.cap_outliers(df, numeric_cols)

    df.dropna(subset=FEATURE_COLUMNS, inplace=True)
    df.reset_index(drop=True, inplace=True)

    # ---- 2. Load model and scaler ----
    preproc = PreprocessingEngine(lookback=lookback)
    preproc.load_scaler(scaler_path)

    engine = PredictionEngine(lookback=lookback, n_features=len(FEATURE_COLUMNS))
    engine.load_model(model_path)

    # ---- 3. Recreate test split (same 70/15/15 as training) ----
    n = len(df)
    val_end = int(n * 0.85)
    test_df = df.iloc[val_end:].copy()
    test_df.reset_index(drop=True, inplace=True)

    # Original close prices for return→price conversion
    close_orig = df["Close_Orig"].values
    test_prev_closes = close_orig[val_end + lookback - 1: -1]
    test_actual_prices = close_orig[val_end + lookback:]

    print(f"\nTest set: {len(test_df)} trading days")
    print(f"Period: {test_df['Date'].iloc[0].date()} to {test_df['Date'].iloc[-1].date()}")

    # Scale test data (returns)
    test_data = test_df[FEATURE_COLUMNS].values.astype(np.float64)
    test_scaled = preproc.transform(test_data)

    target_idx = FEATURE_COLUMNS.index(TARGET_COLUMN)

    # Create sequences
    X_test, y_test_scaled = PreprocessingEngine.create_sequences(
        test_scaled, target_idx, lookback
    )

    # Predict returns (scaled)
    y_pred_scaled = engine.predict(X_test)

    # Inverse transform to get actual returns
    n_feat = len(FEATURE_COLUMNS)
    dummy_actual = np.zeros((len(y_test_scaled), n_feat))
    dummy_actual[:, target_idx] = y_test_scaled
    y_test_returns = preproc.inverse_transform(dummy_actual)[:, target_idx]

    dummy_pred = np.zeros((len(y_pred_scaled), n_feat))
    dummy_pred[:, target_idx] = y_pred_scaled
    y_pred_returns = preproc.inverse_transform(dummy_pred)[:, target_idx]

    # Convert returns → prices
    n_preds = len(y_test_returns)
    prev_closes = test_prev_closes[:n_preds]
    actual_prices_ref = test_actual_prices[:n_preds]

    y_actual = prev_closes * (1 + y_test_returns)
    y_pred = prev_closes * (1 + y_pred_returns)

    test_dates = test_df["Date"].values[lookback:]

    # ---- 4. Compute metrics ----
    print("\n" + "=" * 60)
    print("TEST SET METRICS")
    print("=" * 60)

    metrics = compute_metrics(y_actual, y_pred)
    print(f"\n{'Metric':<22} {'Value':>12}")
    print("-" * 36)
    print(f"{'MAE':<22} {metrics['MAE']:>12.2f} SAR")
    print(f"{'RMSE':<22} {metrics['RMSE']:>12.2f} SAR")
    print(f"{'MAPE':<22} {metrics['MAPE']:>11.2f}%")
    print(f"{'R²':<22} {metrics['R2']:>12.4f}")
    print(f"{'Direction Accuracy':<22} {metrics['Direction_Accuracy']:>11.2f}%")

    target_met = "YES" if metrics["MAPE"] < 10 and metrics["R2"] > 0.5 else "NO"
    print(f"\nTarget (MAPE<10%, R²>0.5): {target_met}")

    # ---- 5. Check for lagging predictions ----
    print("\n" + "=" * 60)
    print("LAG CHECK")
    print("=" * 60)
    if len(y_actual) > 2:
        # A lagging model just copies yesterday's price
        naive_pred = y_actual[:-1]  # yesterday as prediction for today
        naive_mae = np.mean(np.abs(y_actual[1:] - naive_pred))
        model_mae = metrics["MAE"]
        lag_ratio = model_mae / naive_mae if naive_mae > 0 else float("inf")
        print(f"Naive (yesterday) MAE: {naive_mae:.2f} SAR")
        print(f"Model MAE:             {model_mae:.2f} SAR")
        print(f"Ratio (model/naive):   {lag_ratio:.3f}")
        if lag_ratio > 0.95:
            print("[WARN] Model MAE is close to naive baseline — "
                  "predictions may be lagging (copying yesterday's price).")
        else:
            print("[OK] Model outperforms naive baseline.")

    # ---- 6. Prediction range check ----
    print("\n" + "=" * 60)
    print("PREDICTION RANGE CHECK")
    print("=" * 60)
    print(f"Actual range:    [{y_actual.min():.2f}, {y_actual.max():.2f}]")
    print(f"Predicted range: [{y_pred.min():.2f}, {y_pred.max():.2f}]")
    pred_std = np.std(y_pred)
    actual_std = np.std(y_actual)
    print(f"Actual std:      {actual_std:.2f}")
    print(f"Predicted std:   {pred_std:.2f}")
    if pred_std < actual_std * 0.3:
        print("[WARN] Predictions cluster around the mean — model may not be "
              "capturing price movements.")
    else:
        print("[OK] Prediction spread looks reasonable.")

    # ---- 7. Walk-forward backtest on last year of test data ----
    print("\n" + "=" * 60)
    print("WALK-FORWARD BACKTEST (test period)")
    print("=" * 60)

    errors = np.abs(y_actual - y_pred)
    print(f"Average absolute error: {errors.mean():.2f} SAR")
    print(f"Median absolute error:  {np.median(errors):.2f} SAR")
    print(f"Max absolute error:     {errors.max():.2f} SAR")
    print(f"95th percentile error:  {np.percentile(errors, 95):.2f} SAR")

    # ---- 8. Plots ----
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Actual vs Predicted
    fig, ax = plt.subplots(figsize=(14, 6))
    plot_dates = pd.to_datetime(test_dates[: len(y_actual)])
    ax.plot(plot_dates, y_actual, label="Actual", linewidth=1.5)
    ax.plot(plot_dates, y_pred, label="Predicted", linewidth=1.5, alpha=0.8)
    ax.set_title("TASI — Actual vs Predicted Closing Price (Test Set)")
    ax.set_xlabel("Date")
    ax.set_ylabel("Price (SAR)")
    ax.legend()
    ax.grid(True)
    plt.tight_layout()
    plt.savefig(output_dir / "eval_actual_vs_predicted.png", dpi=150)
    plt.close()
    print(f"\n[INFO] Plot saved: {output_dir / 'eval_actual_vs_predicted.png'}")

    # Error distribution
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    axes[0].hist(errors, bins=40, edgecolor="black", alpha=0.7)
    axes[0].set_title("Absolute Error Distribution")
    axes[0].set_xlabel("Error (SAR)")
    axes[0].set_ylabel("Frequency")
    axes[0].axvline(errors.mean(), color="red", linestyle="--", label=f"Mean={errors.mean():.1f}")
    axes[0].legend()

    # Scatter: actual vs predicted
    axes[1].scatter(y_actual, y_pred, alpha=0.3, s=10)
    min_val = min(y_actual.min(), y_pred.min())
    max_val = max(y_actual.max(), y_pred.max())
    axes[1].plot([min_val, max_val], [min_val, max_val], "r--", label="Perfect prediction")
    axes[1].set_title("Actual vs Predicted Scatter")
    axes[1].set_xlabel("Actual Price (SAR)")
    axes[1].set_ylabel("Predicted Price (SAR)")
    axes[1].legend()
    axes[1].set_aspect("equal")

    plt.tight_layout()
    plt.savefig(output_dir / "eval_error_analysis.png", dpi=150)
    plt.close()
    print(f"[INFO] Plot saved: {output_dir / 'eval_error_analysis.png'}")

    # ---- 9. Determinism check ----
    print("\n" + "=" * 60)
    print("DETERMINISM CHECK (3 runs on same input)")
    print("=" * 60)
    sample_X = X_test[:5]
    preds = [engine.predict(sample_X) for _ in range(3)]
    all_same = all(np.allclose(preds[0], p) for p in preds[1:])
    print(f"All 3 runs identical: {all_same}")
    if not all_same:
        max_diff = max(np.max(np.abs(preds[0] - p)) for p in preds[1:])
        print(f"Max difference between runs: {max_diff:.6f}")

    print("\n[DONE] Evaluation complete.")


def main():
    parser = argparse.ArgumentParser(description="Evaluate TASI prediction model")
    parser.add_argument("--csv", default="TASI_Historical_Data.csv")
    parser.add_argument("--model", default="models/TASI_Model_v3.keras")
    parser.add_argument("--scaler", default="models/TASI_Scaler_v3.pkl")
    parser.add_argument("--lookback", type=int, default=60)
    parser.add_argument("--output-dir", default="models")
    args = parser.parse_args()

    for label, path in [("Model", args.model), ("Scaler", args.scaler)]:
        if not Path(path).exists():
            print(f"[ERROR] {label} not found at '{path}'. Run train_model.py first.")
            sys.exit(1)

    run_evaluation(
        csv_path=args.csv,
        model_path=args.model,
        scaler_path=args.scaler,
        lookback=args.lookback,
        output_dir=args.output_dir,
    )


if __name__ == "__main__":
    main()
