"""
train_linear.py — train an ElasticNetCV linear model for any registered symbol.

Usage:
    python train_linear.py                    # TASI (default)
    python train_linear.py --symbol SABIC     # SABIC linear model
    python train_linear.py --symbol ARAMCO --alpha-grid 50

Pipeline:
    1. Load OHLCV (CSV for TASI, Supabase for the others) + macro indicators.
    2. Enrich with VIX + S&P futures (linear model uses 48 features inc. these).
    3. Build the 48 linear features via prediction.linear.features.build_linear_features.
    4. Compute target = next-day return.
    5. Chronological 85/15 train/test split (no separate val; ElasticNetCV does
       internal CV on the train slice).
    6. StandardScaler fit on train, transform both.
    7. Fit ElasticNetCV on train.
    8. Report MAE/R² on test (price + return space) + naive baseline.
    9. Save model + scaler under per-symbol paths from registry.
"""

import argparse
import sys
from pathlib import Path

# Seed everything before sklearn/numpy random ops happen.
from utils.seed import set_seed
set_seed(42)

import numpy as np
import pandas as pd
import joblib
from sklearn.linear_model import ElasticNetCV
from sklearn.preprocessing import StandardScaler

from data_acquisition.market_data import DataAcquisitionService
from data_acquisition.registry import get_stock_info
from prediction.linear.features import (
    FEATURES, build_linear_features, enrich_macro_for_linear,
)


def _load_dataframe(symbol: str) -> pd.DataFrame:
    """Load OHLCV + macro for `symbol`."""
    info = get_stock_info(symbol)
    das = DataAcquisitionService(
        csv_path=info.get("csv_path", "TASI_Historical_Data.csv"),
        symbol=symbol,
        ticker=info["yfinance_ticker"],
    )
    source = "csv" if symbol == "TASI" else "supabase"
    df = das.load_all(source=source)
    return df


def train(symbol: str, test_ratio: float = 0.15,
          alpha_grid_size: int = 100) -> dict:
    info = get_stock_info(symbol)
    print(f"\n{'=' * 60}")
    print(f"Training linear model for {symbol}")
    print(f"{'=' * 60}")

    # ---- 1. Data ----
    df = _load_dataframe(symbol)
    df = enrich_macro_for_linear(df)
    df = build_linear_features(df)

    # ---- 2. Target = next-day return (shift -1) ----
    df["target_return"] = df["Close"].pct_change(1).shift(-1)
    df = df.dropna(subset=FEATURES + ["target_return", "Close"]).reset_index(drop=True)

    print(f"[INFO] {symbol}: {len(df)} rows after feature engineering "
          f"({df['Date'].iloc[0].date()} -> {df['Date'].iloc[-1].date()})")

    if len(df) < 200:
        raise RuntimeError(
            f"Only {len(df)} usable rows for {symbol} — too few to train a "
            f"linear model with {len(FEATURES)} features."
        )

    # ---- 3. Chronological split: train | test (ElasticNetCV runs CV inside train) ----
    n = len(df)
    test_start = int(n * (1.0 - test_ratio))
    train_df = df.iloc[:test_start].copy()
    test_df = df.iloc[test_start:].copy()
    print(f"[INFO] Train: {len(train_df)} rows, Test: {len(test_df)} rows")

    X_train = train_df[FEATURES].values
    y_train = train_df["target_return"].values
    X_test = test_df[FEATURES].values
    y_test = test_df["target_return"].values
    test_close = test_df["Close"].values  # for return→price reconstruction

    # ---- 4. Scale (fit on train only) ----
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # ---- 5. Fit ElasticNetCV (internal CV picks alpha + l1_ratio) ----
    model = ElasticNetCV(
        l1_ratio=[0.1, 0.3, 0.5, 0.7, 0.9, 1.0],
        n_alphas=alpha_grid_size,
        cv=5,
        max_iter=10000,
        random_state=42,
        n_jobs=-1,
    )
    print("[INFO] Fitting ElasticNetCV ...")
    model.fit(X_train_scaled, y_train)
    print(f"[INFO] Selected alpha={model.alpha_:.6f}, l1_ratio={model.l1_ratio_:.2f}")

    # ---- 6. Evaluate on test set ----
    y_pred = model.predict(X_test_scaled)

    # Return-space metrics (the honest one)
    mae_ret = float(np.mean(np.abs(y_test - y_pred)))
    rmse_ret = float(np.sqrt(np.mean((y_test - y_pred) ** 2)))
    ss_res_ret = float(np.sum((y_test - y_pred) ** 2))
    ss_tot_ret = float(np.sum((y_test - y_test.mean()) ** 2))
    r2_ret = 1 - ss_res_ret / ss_tot_ret if ss_tot_ret > 0 else 0.0
    direction_acc = float(np.mean(np.sign(y_test) == np.sign(y_pred))) * 100

    # Price-space (reconstruct via prev_close)
    y_actual_price = test_close * (1 + y_test)
    y_pred_price = test_close * (1 + y_pred)
    mae_price = float(np.mean(np.abs(y_actual_price - y_pred_price)))
    mape_price = float(np.mean(np.abs((y_actual_price - y_pred_price) / y_actual_price))) * 100
    ss_res_p = float(np.sum((y_actual_price - y_pred_price) ** 2))
    ss_tot_p = float(np.sum((y_actual_price - y_actual_price.mean()) ** 2))
    r2_price = 1 - ss_res_p / ss_tot_p if ss_tot_p > 0 else 0.0

    # Naive 'today=tomorrow' price baseline for context
    naive_pred = y_actual_price[:-1]
    naive_target = y_actual_price[1:]
    naive_mae = float(np.mean(np.abs(naive_target - naive_pred)))
    naive_ss_res = float(np.sum((naive_target - naive_pred) ** 2))
    naive_ss_tot = float(np.sum((naive_target - naive_target.mean()) ** 2))
    naive_r2 = 1 - naive_ss_res / naive_ss_tot if naive_ss_tot > 0 else 0.0

    print(f"\n--- {symbol} test metrics ---")
    print(f"  PRICE   MAE: {mae_price:.2f}    MAPE: {mape_price:.2f}%   R²: {r2_price:.4f}")
    print(f"  Naive   MAE: {naive_mae:.2f}                              R²: {naive_r2:.4f}")
    print(f"  RETURN  MAE: {mae_ret:.6f}                              R²: {r2_ret:+.4f}")
    print(f"  Direction accuracy (returns): {direction_acc:.2f}%")

    # ---- 7. Persist model + scaler ----
    model_path = Path(info["linear_model_path"])
    scaler_path = Path(info["linear_scaler_path"])
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)
    print(f"[INFO] Saved model:  {model_path}")
    print(f"[INFO] Saved scaler: {scaler_path}")

    return {
        "symbol": symbol,
        "n_train": len(train_df),
        "n_test": len(test_df),
        "alpha": float(model.alpha_),
        "l1_ratio": float(model.l1_ratio_),
        "mae_price": mae_price,
        "mape_price": mape_price,
        "r2_price": r2_price,
        "naive_mae": naive_mae,
        "naive_r2": naive_r2,
        "mae_returns": mae_ret,
        "r2_returns": r2_ret,
        "direction_acc": direction_acc,
        "model_path": str(model_path),
        "scaler_path": str(scaler_path),
    }


def main():
    parser = argparse.ArgumentParser(description="Train per-symbol linear model")
    parser.add_argument("--symbol", default="TASI",
                        help="Stock symbol (TASI/ARAMCO/RAJHI/SABIC/STC/SECO)")
    parser.add_argument("--test-ratio", type=float, default=0.15)
    parser.add_argument("--alpha-grid", type=int, default=100,
                        help="Number of alpha values for ElasticNetCV")
    args = parser.parse_args()

    try:
        result = train(args.symbol, args.test_ratio, args.alpha_grid)
        print(f"\n[DONE] {args.symbol} linear model trained.")
        return 0
    except Exception as e:
        print(f"[ERROR] Training failed for {args.symbol}: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
