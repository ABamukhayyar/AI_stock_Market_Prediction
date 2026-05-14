"""
evaluate.py — Comprehensive model evaluation and walk-forward backtesting.

Supports both the CNN-BiLSTM-Attention model and the Linear model.

Usage:
    python evaluate.py                              # CNN model (default)
    python evaluate.py --model-type linear           # Linear model
    python evaluate.py --model-type all              # Both models
    python evaluate.py --symbol SABIC --model-type all      # any registered stock
"""

import argparse
import sys
from pathlib import Path

# Seed before any TF / NumPy ops happen downstream.
from utils.seed import set_seed
set_seed(42)

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from data_acquisition.market_data import DataAcquisitionService
from data_acquisition.registry import get_stock_info
from technical_analysis.indicators import TechnicalAnalysisService
from preprocessing.engine import PreprocessingEngine
from prediction.engine import PredictionEngine
from train_model import FEATURE_COLUMNS, TARGET_COLUMN


def compute_metrics(y_actual: np.ndarray, y_pred: np.ndarray) -> dict:
    """Compute regression metrics on price-level data.

    NOTE: when y_actual and y_pred are reconstructed prices (prev_close × (1+r)),
    the R² is dominated by `prev_close` variance and is not a measure of
    predictive signal. Always read this *alongside* compute_metrics_returns()
    and naive_baseline().
    """
    mae = np.mean(np.abs(y_actual - y_pred))
    rmse = np.sqrt(np.mean((y_actual - y_pred) ** 2))
    mape = np.mean(np.abs((y_actual - y_pred) / y_actual)) * 100
    ss_res = np.sum((y_actual - y_pred) ** 2)
    ss_tot = np.sum((y_actual - np.mean(y_actual)) ** 2)
    r2 = 1 - ss_res / ss_tot if ss_tot != 0 else 0.0

    # Direction-on-prices: does the predicted *price level* go up/down across
    # consecutive days the same way as the actual? Kept for backwards-compat;
    # for the *return-target* models, prefer the direction-on-returns metric
    # computed in run_cnn_evaluation / run_linear_evaluation.
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


def compute_metrics_returns(actual_returns: np.ndarray,
                             pred_returns: np.ndarray) -> dict:
    """The honest return-space metrics.

    Returns are stationary, so R² here actually measures predictive signal
    rather than reflecting price-level autocorrelation. Direction accuracy
    is computed as sign-agreement on returns, which is the meaningful
    "did we call tomorrow's up/down right?" metric.
    """
    mae = np.mean(np.abs(actual_returns - pred_returns))
    rmse = np.sqrt(np.mean((actual_returns - pred_returns) ** 2))
    ss_res = np.sum((actual_returns - pred_returns) ** 2)
    ss_tot = np.sum((actual_returns - np.mean(actual_returns)) ** 2)
    r2 = 1 - ss_res / ss_tot if ss_tot != 0 else 0.0
    direction_acc = float(np.mean(np.sign(actual_returns) == np.sign(pred_returns))) * 100
    return {
        "MAE_returns": mae,
        "RMSE_returns": rmse,
        "R2_returns": r2,
        "Direction_Accuracy_returns": direction_acc,
    }


def naive_baseline(y_actual: np.ndarray) -> dict:
    """Naive 'predict tomorrow = today' baseline metrics over the same series.

    Use this to put any 'impressive' R² in context. If the model R² is not
    materially above this, the model is essentially copying yesterday's price.
    """
    if len(y_actual) < 2:
        return {"naive_MAE": 0.0, "naive_R2": 0.0}
    naive_pred = y_actual[:-1]
    target = y_actual[1:]
    mae = float(np.mean(np.abs(target - naive_pred)))
    ss_res = float(np.sum((target - naive_pred) ** 2))
    ss_tot = float(np.sum((target - np.mean(target)) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot != 0 else 0.0
    return {"naive_MAE": mae, "naive_R2": r2}


def _print_metrics(metrics: dict) -> None:
    """Pretty-print evaluation metrics."""
    print(f"\n{'Metric':<22} {'Value':>12}")
    print("-" * 36)
    print(f"{'MAE':<22} {metrics['MAE']:>12.2f} SAR")
    print(f"{'RMSE':<22} {metrics['RMSE']:>12.2f} SAR")
    print(f"{'MAPE':<22} {metrics['MAPE']:>11.2f}%")
    print(f"{'R²':<22} {metrics['R2']:>12.4f}")
    print(f"{'Direction Accuracy':<22} {metrics['Direction_Accuracy']:>11.2f}%")

    target_met = "YES" if metrics["MAPE"] < 10 and metrics["R2"] > 0.5 else "NO"
    print(f"\nTarget (MAPE<10%, R²>0.5): {target_met}")


def _plot_results(y_actual, y_pred, test_dates, errors, output_dir, prefix="eval"):
    """Generate actual-vs-predicted and error analysis plots."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Actual vs Predicted
    fig, ax = plt.subplots(figsize=(14, 6))
    plot_dates = pd.to_datetime(test_dates[: len(y_actual)])
    ax.plot(plot_dates, y_actual, label="Actual", linewidth=1.5)
    ax.plot(plot_dates, y_pred, label="Predicted", linewidth=1.5, alpha=0.8)
    ax.set_title(f"TASI — Actual vs Predicted Closing Price ({prefix})")
    ax.set_xlabel("Date")
    ax.set_ylabel("Price (SAR)")
    ax.legend()
    ax.grid(True)
    plt.tight_layout()
    plt.savefig(output_dir / f"{prefix}_actual_vs_predicted.png", dpi=150)
    plt.close()
    print(f"\n[INFO] Plot saved: {output_dir / f'{prefix}_actual_vs_predicted.png'}")

    # Error distribution
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    axes[0].hist(errors, bins=40, edgecolor="black", alpha=0.7)
    axes[0].set_title("Absolute Error Distribution")
    axes[0].set_xlabel("Error (SAR)")
    axes[0].set_ylabel("Frequency")
    axes[0].axvline(errors.mean(), color="red", linestyle="--",
                    label=f"Mean={errors.mean():.1f}")
    axes[0].legend()

    axes[1].scatter(y_actual, y_pred, alpha=0.3, s=10)
    min_val = min(y_actual.min(), y_pred.min())
    max_val = max(y_actual.max(), y_pred.max())
    axes[1].plot([min_val, max_val], [min_val, max_val], "r--",
                 label="Perfect prediction")
    axes[1].set_title("Actual vs Predicted Scatter")
    axes[1].set_xlabel("Actual Price (SAR)")
    axes[1].set_ylabel("Predicted Price (SAR)")
    axes[1].legend()
    axes[1].set_aspect("equal")

    plt.tight_layout()
    plt.savefig(output_dir / f"{prefix}_error_analysis.png", dpi=150)
    plt.close()
    print(f"[INFO] Plot saved: {output_dir / f'{prefix}_error_analysis.png'}")


# ======================================================================
# Trading simulation — financial-usefulness metrics
# ======================================================================

def trading_metrics(
    actual_returns: np.ndarray,
    pred_returns: np.ndarray,
    transaction_cost_bps: float = 0.0,
    trading_days_per_year: int = 252,
) -> tuple[dict, np.ndarray, np.ndarray]:
    """Simulate trading on the model's predicted returns.

    Strategy: long (+1) when predicted next-day return > 0, flat (0) otherwise.
    No shorting, no position sizing, no slippage beyond an optional per-side
    bps cost. Returns financial-usefulness metrics alongside a buy-and-hold
    baseline computed over the same period, so the comparison reads honestly.

    Parameters
    ----------
    actual_returns        : realized next-day returns over the test period.
    pred_returns          : model-predicted next-day returns (same length).
    transaction_cost_bps  : per-side cost in basis points charged on position
                            changes. Default 0 (no costs). Set e.g. 5 to model
                            a 5 bps each way fee/slippage round-trip.
    trading_days_per_year : annualisation factor. 252 is the global convention
                            and close enough for TASI (Sun-Thu ~248/yr).

    Returns
    -------
    (metrics_dict, strategy_equity, buyhold_equity)
        metrics_dict — scalar numbers for stdout + the comparison tables.
        strategy_equity, buyhold_equity — equity curves for plotting.

    Notes
    -----
    Risk-free rate is assumed 0 in the Sharpe calculation. Reasonable for a
    daily strategy and avoids pulling a SIBOR series the pipeline does not
    already have. Documented as a methodological choice in the writeup.
    """
    n = len(actual_returns)
    if n < 2:
        return {}, np.array([1.0]), np.array([1.0])

    # ---- Position: long when predicted up, flat otherwise ----
    positions = (pred_returns > 0).astype(float)

    # ---- Daily strategy return before costs ----
    strategy_returns = positions * actual_returns

    # ---- Subtract transaction costs on position changes ----
    if transaction_cost_bps > 0:
        position_changes = np.abs(np.diff(positions, prepend=0.0))
        costs = position_changes * (transaction_cost_bps / 10_000.0)
        strategy_returns = strategy_returns - costs

    # ---- Equity curves (compounded growth from 1.0) ----
    strategy_equity = np.cumprod(1.0 + strategy_returns)
    buyhold_equity = np.cumprod(1.0 + actual_returns)

    # ---- Headline returns ----
    strat_total = float(strategy_equity[-1] - 1.0)
    buyh_total = float(buyhold_equity[-1] - 1.0)

    years = n / trading_days_per_year
    strat_annual = (1 + strat_total) ** (1 / years) - 1 if years > 0 else 0.0
    buyh_annual = (1 + buyh_total) ** (1 / years) - 1 if years > 0 else 0.0

    # ---- Sharpe (rf = 0) ----
    def _sharpe(r: np.ndarray) -> float:
        sd = float(np.std(r))
        if sd == 0:
            return 0.0
        return float(np.mean(r)) / sd * np.sqrt(trading_days_per_year)

    strat_sharpe = _sharpe(strategy_returns)
    buyh_sharpe = _sharpe(actual_returns)

    # ---- Max drawdown ----
    def _max_drawdown(equity: np.ndarray) -> float:
        running_peak = np.maximum.accumulate(equity)
        # guard against the unlikely all-zero case
        running_peak = np.where(running_peak == 0, 1e-12, running_peak)
        drawdown = (equity - running_peak) / running_peak
        return float(drawdown.min())  # always <= 0, e.g. -0.18 = -18%

    strat_mdd = _max_drawdown(strategy_equity)
    buyh_mdd = _max_drawdown(buyhold_equity)

    # ---- Trade-level stats ----
    traded_mask = positions > 0
    if traded_mask.sum() > 0:
        hit_rate = float(np.mean(actual_returns[traded_mask] > 0)) * 100
    else:
        hit_rate = 0.0
    n_trades = int(np.abs(np.diff(positions, prepend=0.0)).sum())
    pct_in_market = float(traded_mask.mean()) * 100

    metrics = {
        "strategy_total_return_pct": strat_total * 100,
        "strategy_annual_return_pct": strat_annual * 100,
        "strategy_sharpe": strat_sharpe,
        "strategy_max_drawdown_pct": strat_mdd * 100,
        "buyhold_total_return_pct": buyh_total * 100,
        "buyhold_annual_return_pct": buyh_annual * 100,
        "buyhold_sharpe": buyh_sharpe,
        "buyhold_max_drawdown_pct": buyh_mdd * 100,
        "hit_rate_traded_pct": hit_rate,
        "n_trades": n_trades,
        "pct_days_in_market": pct_in_market,
        "transaction_cost_bps": transaction_cost_bps,
    }
    return metrics, strategy_equity, buyhold_equity


def _print_trading_metrics(tm: dict) -> None:
    """Pretty-print trading simulation: strategy vs buy-and-hold."""
    if not tm:
        print("[WARN] Not enough data for trading simulation.")
        return

    print(f"\n{'Metric':<26} {'Strategy':>14} {'Buy & Hold':>14}")
    print("-" * 56)
    print(f"{'Total Return':<26} "
          f"{tm['strategy_total_return_pct']:>13.2f}% "
          f"{tm['buyhold_total_return_pct']:>13.2f}%")
    print(f"{'Annualized Return':<26} "
          f"{tm['strategy_annual_return_pct']:>13.2f}% "
          f"{tm['buyhold_annual_return_pct']:>13.2f}%")
    print(f"{'Sharpe Ratio (rf=0)':<26} "
          f"{tm['strategy_sharpe']:>14.3f} "
          f"{tm['buyhold_sharpe']:>14.3f}")
    print(f"{'Max Drawdown':<26} "
          f"{tm['strategy_max_drawdown_pct']:>13.2f}% "
          f"{tm['buyhold_max_drawdown_pct']:>13.2f}%")

    print(f"\n{'Hit rate (traded days)':<26} {tm['hit_rate_traded_pct']:>13.2f}%")
    print(f"{'% Days in market':<26} {tm['pct_days_in_market']:>13.2f}%")
    print(f"{'Number of trades':<26} {tm['n_trades']:>14d}")
    if tm.get("transaction_cost_bps", 0) > 0:
        print(f"{'Transaction cost (bps)':<26} "
              f"{tm['transaction_cost_bps']:>14.1f}")

    # Honest verdict — Sharpe is the right comparator
    if tm["strategy_sharpe"] > tm["buyhold_sharpe"]:
        print(f"\n[OK] Strategy Sharpe ({tm['strategy_sharpe']:.2f}) beats "
              f"buy-and-hold ({tm['buyhold_sharpe']:.2f}).")
    else:
        print(f"\n[WARN] Strategy Sharpe ({tm['strategy_sharpe']:.2f}) does not "
              f"beat buy-and-hold ({tm['buyhold_sharpe']:.2f}). "
              f"Model adds no risk-adjusted value over this test period.")


def _plot_equity_curves(
    strategy_equity: np.ndarray,
    buyhold_equity: np.ndarray,
    test_dates,
    output_dir,
    prefix: str = "eval",
) -> None:
    """Plot strategy and buy-and-hold equity curves on a single axis."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=(14, 6))
    n = len(strategy_equity)
    plot_dates = pd.to_datetime(test_dates[:n])
    ax.plot(plot_dates, strategy_equity,
            label="Strategy (long when predicted up)", linewidth=1.8)
    ax.plot(plot_dates, buyhold_equity,
            label="Buy & Hold", linewidth=1.5, alpha=0.75)
    ax.axhline(1.0, color="gray", linestyle="--", alpha=0.5,
               label="Starting capital")
    ax.set_title(f"Equity Curve — {prefix}")
    ax.set_xlabel("Date")
    ax.set_ylabel("Equity (start = 1.0)")
    ax.legend()
    ax.grid(True)
    plt.tight_layout()
    out = output_dir / f"{prefix}_equity_curve.png"
    plt.savefig(out, dpi=150)
    plt.close()
    print(f"[INFO] Plot saved: {out}")


# ======================================================================
# CNN Evaluation
# ======================================================================

def run_cnn_evaluation(
    symbol: str = "TASI",
    csv_path: str | None = None,
    model_path: str | None = None,
    scaler_path: str | None = None,
    lookback: int = 60,
    output_dir: str = "models",
) -> dict:
    """Full evaluation for the CNN-BiLSTM-Attention model."""
    info = get_stock_info(symbol)
    csv_path = csv_path or info.get("csv_path", "TASI_Historical_Data.csv")
    model_path = model_path or info["cnn_model_path"]
    scaler_path = scaler_path or info["cnn_scaler_path"]

    print("=" * 60)
    print(f"CNN-BiLSTM-Attention Model Evaluation — {symbol}")
    print("=" * 60)
    print("Loading and preprocessing data...")

    das = DataAcquisitionService(csv_path=csv_path, symbol=symbol,
                                  ticker=info["yfinance_ticker"])
    df = das.load_all(source="csv" if symbol == "TASI" else "supabase")
    df = TechnicalAnalysisService.add_all(df)

    # Merge sentiment data
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
    except Exception as e:
        print(f"[WARN] Could not load sentiment from Supabase: {e}")

    for col, default in [("Sentiment_Score", 0), ("Sentiment_Confidence", 0),
                         ("Sentiment_Encoded", 0)]:
        if col not in df.columns:
            df[col] = default
        else:
            df[col] = df[col].ffill().fillna(default)

    # Preprocessing — match the new training pipeline exactly:
    # save Close_Orig, drop indicator-warmup NaN, then per-slice (denoise →
    # to_returns → drop pct-change NaN) on the test slice using the saved
    # IQR bounds + scaler from training.
    df["Close_Orig"] = df["Close"].copy()
    df.dropna(subset=FEATURE_COLUMNS, inplace=True)
    df.reset_index(drop=True, inplace=True)

    preproc = PreprocessingEngine(lookback=lookback)
    preproc.load_scaler(scaler_path)  # bundle: scaler + outlier_bounds

    engine = PredictionEngine(lookback=lookback, n_features=len(FEATURE_COLUMNS))
    engine.load_model(model_path)

    # Chronological 70/15/15 — same boundaries as training.
    n = len(df)
    val_end = int(n * 0.85)
    test_slice = df.iloc[val_end:].copy().reset_index(drop=True)

    # Per-slice denoise → returns → drop pct_change NaN → apply saved IQR bounds.
    denoise_cols = ["Close", "Open", "High", "Low", "Volume",
                    "Oil", "SP500", "Gold", "DXY", "Interest_Rate"]
    test_slice = preproc.denoise_dataframe(test_slice, denoise_cols)
    test_slice = PreprocessingEngine.to_returns(test_slice)
    test_slice = test_slice.dropna(subset=FEATURE_COLUMNS).reset_index(drop=True)
    if preproc._outlier_bounds:
        test_slice = preproc.apply_outlier_bounds(test_slice, FEATURE_COLUMNS)
    else:
        test_slice = PreprocessingEngine.cap_outliers(test_slice, FEATURE_COLUMNS)

    print(f"\nTest set: {len(test_slice)} trading days")
    print(f"Period: {test_slice['Date'].iloc[0].date()} to "
          f"{test_slice['Date'].iloc[-1].date()}")

    # Scale + sequences
    test_data = test_slice[FEATURE_COLUMNS].values.astype(np.float64)
    test_scaled = preproc.transform(test_data)
    target_idx = FEATURE_COLUMNS.index(TARGET_COLUMN)
    X_test, y_test_scaled = PreprocessingEngine.create_sequences(
        test_scaled, target_idx, lookback
    )
    y_pred_scaled = engine.predict(X_test)

    # Inverse transform → returns space
    n_feat = len(FEATURE_COLUMNS)
    dummy_actual = np.zeros((len(y_test_scaled), n_feat))
    dummy_actual[:, target_idx] = y_test_scaled
    y_test_returns = preproc.inverse_transform(dummy_actual)[:, target_idx]

    dummy_pred = np.zeros((len(y_pred_scaled), n_feat))
    dummy_pred[:, target_idx] = y_pred_scaled
    y_pred_returns = preproc.inverse_transform(dummy_pred)[:, target_idx]

    # Convert to prices using prev-close from the test slice's Close_Orig
    test_prev_closes = test_slice["Close_Orig"].values[lookback - 1: -1]
    n_preds = len(y_test_returns)
    prev_closes = test_prev_closes[:n_preds]

    y_actual = prev_closes * (1 + y_test_returns)
    y_pred = prev_closes * (1 + y_pred_returns)
    test_dates = test_slice["Date"].values[lookback:][:n_preds]

    # ---- Honest metrics: report price-space + return-space + naive baseline ----
    print("\n" + "=" * 60)
    print("TEST SET METRICS (CNN) — PRICE SPACE")
    print("=" * 60)
    metrics = compute_metrics(y_actual, y_pred)
    _print_metrics(metrics)

    print("\n" + "=" * 60)
    print("TEST SET METRICS (CNN) — RETURN SPACE  [the honest one]")
    print("=" * 60)
    metrics_returns = compute_metrics_returns(y_test_returns, y_pred_returns)
    print(f"{'MAE (returns)':<28} {metrics_returns['MAE_returns']:>12.6f}")
    print(f"{'RMSE (returns)':<28} {metrics_returns['RMSE_returns']:>12.6f}")
    print(f"{'R² (returns)':<28} {metrics_returns['R2_returns']:>12.4f}")
    print(f"{'Direction acc (returns)':<28} "
          f"{metrics_returns['Direction_Accuracy_returns']:>11.2f}%")

    # Combine for the side-by-side comparison block at the end of main().
    metrics.update(metrics_returns)

    # Naive baseline — both MAE and R² in price space (the inflated R² needs
    # this baseline next to it for honest reading).
    print("\n" + "=" * 60)
    print("LAG CHECK (naive 'predict tomorrow = today')")
    print("=" * 60)
    naive_price = naive_baseline(y_actual)
    naive_ret = naive_baseline(y_test_returns)
    print(f"Naive MAE (price):     {naive_price['naive_MAE']:.2f} SAR")
    print(f"Model MAE (price):     {metrics['MAE']:.2f} SAR")
    print(f"Naive R²  (price):     {naive_price['naive_R2']:.4f}")
    print(f"Model R²  (price):     {metrics['R2']:.4f}")
    print(f"Naive R²  (returns):   {naive_ret['naive_R2']:+.4f}")
    print(f"Model R²  (returns):   {metrics['R2_returns']:+.4f}")
    if naive_price['naive_MAE'] > 0:
        lag_ratio = metrics['MAE'] / naive_price['naive_MAE']
        print(f"Ratio (model/naive MAE): {lag_ratio:.3f}")
        if lag_ratio > 0.95:
            print("[WARN] Predictions may be lagging (copying yesterday's price).")
        else:
            print("[OK] Model outperforms naive baseline on price MAE.")
    metrics["naive_MAE_price"] = naive_price["naive_MAE"]
    metrics["naive_R2_price"] = naive_price["naive_R2"]
    metrics["naive_R2_returns"] = naive_ret["naive_R2"]

    # Range check
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
        print("[WARN] Predictions cluster around the mean.")
    else:
        print("[OK] Prediction spread looks reasonable.")

    # Walk-forward backtest
    errors = np.abs(y_actual - y_pred)
    print("\n" + "=" * 60)
    print("WALK-FORWARD BACKTEST (test period)")
    print("=" * 60)
    print(f"Average absolute error: {errors.mean():.2f} SAR")
    print(f"Median absolute error:  {np.median(errors):.2f} SAR")
    print(f"Max absolute error:     {errors.max():.2f} SAR")
    print(f"95th percentile error:  {np.percentile(errors, 95):.2f} SAR")

    # Trading simulation — financial-usefulness metrics
    print("\n" + "=" * 60)
    print("TRADING SIMULATION (test period) — Strategy vs Buy & Hold")
    print("=" * 60)
    tm_cnn, strat_eq, buyh_eq = trading_metrics(y_test_returns, y_pred_returns)
    _print_trading_metrics(tm_cnn)
    _plot_equity_curves(strat_eq, buyh_eq, test_dates, output_dir,
                        prefix="eval_cnn")
    metrics.update(tm_cnn)

    # Plots
    _plot_results(y_actual, y_pred, test_dates, errors, output_dir, prefix="eval_cnn")

    # Determinism check
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

    return metrics


# ======================================================================
# Linear Evaluation
# ======================================================================

def run_linear_evaluation(
    symbol: str = "TASI",
    csv_path: str | None = None,
    model_path: str | None = None,
    scaler_path: str | None = None,
    output_dir: str = "models",
) -> dict:
    """Full evaluation for the Linear model."""
    from prediction.linear.engine import LinearPredictionEngine
    from prediction.linear.features import (
        FEATURES, build_linear_features, enrich_macro_for_linear,
    )

    info = get_stock_info(symbol)
    csv_path = csv_path or info.get("csv_path", "TASI_Historical_Data.csv")
    model_path = model_path or info["linear_model_path"]
    scaler_path = scaler_path or info["linear_scaler_path"]

    print("=" * 60)
    print(f"Linear Model Evaluation — {symbol}")
    print("=" * 60)
    print("Loading and preprocessing data...")

    das = DataAcquisitionService(csv_path=csv_path, symbol=symbol,
                                  ticker=info["yfinance_ticker"])
    df = das.load_all(source="csv" if symbol == "TASI" else "supabase")

    # Enrich with VIX + futures
    df = enrich_macro_for_linear(df)

    # Build features
    df = build_linear_features(df)
    df = df.dropna(subset=FEATURES).reset_index(drop=True)

    print(f"\nTotal rows after feature engineering: {len(df)}")
    print(f"Period: {df['Date'].iloc[0].date()} to {df['Date'].iloc[-1].date()}")

    # Create target: next-day return
    df["target_return"] = df["Close"].pct_change(1).shift(-1)
    df = df.dropna(subset=["target_return"]).reset_index(drop=True)

    # Chronological test split (last 15%)
    n = len(df)
    test_start = int(n * 0.85)
    test_df = df.iloc[test_start:].copy().reset_index(drop=True)

    print(f"Test set: {len(test_df)} trading days")
    print(f"Test period: {test_df['Date'].iloc[0].date()} to "
          f"{test_df['Date'].iloc[-1].date()}")

    # Load model
    engine = LinearPredictionEngine()
    engine.load_model(model_path, scaler_path)
    print(f"Model type: {engine.model_type}")

    # Predict on each test row
    X_test = test_df[FEATURES].values
    closes = test_df["Close"].values
    actual_returns = test_df["target_return"].values

    # Predict returns
    X_scaled = engine.scaler.transform(X_test)
    pred_returns = engine.model.predict(X_scaled)

    # Convert to prices
    y_actual = closes * (1 + actual_returns)
    y_pred = closes * (1 + pred_returns)
    test_dates = test_df["Date"].values

    # ---- Honest metrics: price-space + return-space + naive baseline ----
    print("\n" + "=" * 60)
    print("TEST SET METRICS (Linear) — PRICE SPACE")
    print("=" * 60)
    metrics = compute_metrics(y_actual, y_pred)
    _print_metrics(metrics)

    print("\n" + "=" * 60)
    print("TEST SET METRICS (Linear) — RETURN SPACE  [the honest one]")
    print("=" * 60)
    metrics_returns = compute_metrics_returns(actual_returns, pred_returns)
    print(f"{'MAE (returns)':<28} {metrics_returns['MAE_returns']:>12.6f}")
    print(f"{'RMSE (returns)':<28} {metrics_returns['RMSE_returns']:>12.6f}")
    print(f"{'R² (returns)':<28} {metrics_returns['R2_returns']:>12.4f}")
    print(f"{'Direction acc (returns)':<28} "
          f"{metrics_returns['Direction_Accuracy_returns']:>11.2f}%")
    metrics.update(metrics_returns)

    # Naive baseline (predict tomorrow = today) — both MAE and R²
    print("\n" + "=" * 60)
    print("LAG CHECK (naive 'predict tomorrow = today')")
    print("=" * 60)
    naive_price = naive_baseline(y_actual)
    naive_ret = naive_baseline(actual_returns)
    print(f"Naive MAE (price):     {naive_price['naive_MAE']:.2f} SAR")
    print(f"Model MAE (price):     {metrics['MAE']:.2f} SAR")
    print(f"Naive R²  (price):     {naive_price['naive_R2']:.4f}")
    print(f"Model R²  (price):     {metrics['R2']:.4f}")
    print(f"Naive R²  (returns):   {naive_ret['naive_R2']:+.4f}")
    print(f"Model R²  (returns):   {metrics['R2_returns']:+.4f}")
    if naive_price['naive_MAE'] > 0:
        lag_ratio = metrics['MAE'] / naive_price['naive_MAE']
        print(f"Ratio (model/naive MAE): {lag_ratio:.3f}")
        if lag_ratio > 0.95:
            print("[WARN] Predictions may be lagging.")
        else:
            print("[OK] Model outperforms naive baseline on price MAE.")
    metrics["naive_MAE_price"] = naive_price["naive_MAE"]
    metrics["naive_R2_price"] = naive_price["naive_R2"]
    metrics["naive_R2_returns"] = naive_ret["naive_R2"]

    # Range check
    print("\n" + "=" * 60)
    print("PREDICTION RANGE CHECK")
    print("=" * 60)
    print(f"Actual range:    [{y_actual.min():.2f}, {y_actual.max():.2f}]")
    print(f"Predicted range: [{y_pred.min():.2f}, {y_pred.max():.2f}]")
    pred_std_val = np.std(y_pred)
    actual_std_val = np.std(y_actual)
    print(f"Actual std:      {actual_std_val:.2f}")
    print(f"Predicted std:   {pred_std_val:.2f}")

    # Walk-forward stats
    errors = np.abs(y_actual - y_pred)
    print("\n" + "=" * 60)
    print("WALK-FORWARD BACKTEST (test period)")
    print("=" * 60)
    print(f"Average absolute error: {errors.mean():.2f} SAR")
    print(f"Median absolute error:  {np.median(errors):.2f} SAR")
    print(f"Max absolute error:     {errors.max():.2f} SAR")
    print(f"95th percentile error:  {np.percentile(errors, 95):.2f} SAR")

    # Trading simulation — financial-usefulness metrics
    print("\n" + "=" * 60)
    print("TRADING SIMULATION (test period) — Strategy vs Buy & Hold")
    print("=" * 60)
    tm_lin, strat_eq, buyh_eq = trading_metrics(actual_returns, pred_returns)
    _print_trading_metrics(tm_lin)
    _plot_equity_curves(strat_eq, buyh_eq, test_dates, output_dir,
                        prefix="eval_linear")
    metrics.update(tm_lin)

    # Plots
    _plot_results(y_actual, y_pred, test_dates, errors, output_dir,
                  prefix="eval_linear")

    return metrics


# ======================================================================
# Main
# ======================================================================

def main():
    parser = argparse.ArgumentParser(description="Evaluate prediction models")
    parser.add_argument("--symbol", default="TASI",
                        help="Stock symbol (TASI/ARAMCO/RAJHI/SABIC/STC/SECO)")
    parser.add_argument("--csv", default=None, help="Override CSV (TASI only).")
    parser.add_argument("--model", default=None, help="Override CNN model path.")
    parser.add_argument("--scaler", default=None, help="Override CNN scaler path.")
    parser.add_argument("--linear-model", default=None,
                        help="Override linear model path.")
    parser.add_argument("--linear-scaler", default=None,
                        help="Override linear scaler path.")
    parser.add_argument("--lookback", type=int, default=60)
    parser.add_argument("--output-dir", default="models")
    parser.add_argument("--model-type", choices=["cnn", "linear", "all"],
                        default="cnn", help="Which model to evaluate (default: cnn)")
    args = parser.parse_args()

    info = get_stock_info(args.symbol)
    cnn_model = args.model or info["cnn_model_path"]
    cnn_scaler = args.scaler or info["cnn_scaler_path"]
    linear_model = args.linear_model or info["linear_model_path"]
    linear_scaler = args.linear_scaler or info["linear_scaler_path"]

    if args.model_type in ("cnn", "all"):
        for label, path in [("CNN Model", cnn_model), ("CNN Scaler", cnn_scaler)]:
            if not Path(path).exists():
                print(f"[ERROR] {label} not found at '{path}'. "
                      f"Run train_model.py --symbol {args.symbol} first.")
                sys.exit(1)

    if args.model_type in ("linear", "all"):
        for label, path in [("Linear Model", linear_model),
                            ("Linear Scaler", linear_scaler)]:
            if not Path(path).exists():
                print(f"[ERROR] {label} not found at '{path}'. "
                      f"Run train_linear.py --symbol {args.symbol} first.")
                sys.exit(1)

    all_metrics = {}

    if args.model_type in ("cnn", "all"):
        cnn_metrics = run_cnn_evaluation(
            symbol=args.symbol,
            csv_path=args.csv,
            model_path=cnn_model,
            scaler_path=cnn_scaler,
            lookback=args.lookback,
            output_dir=args.output_dir,
        )
        all_metrics["CNN"] = cnn_metrics

    if args.model_type in ("linear", "all"):
        linear_metrics = run_linear_evaluation(
            symbol=args.symbol,
            csv_path=args.csv,
            model_path=linear_model,
            scaler_path=linear_scaler,
            output_dir=args.output_dir,
        )
        all_metrics["Linear"] = linear_metrics

    # Side-by-side comparison when both models evaluated
    if len(all_metrics) > 1:
        print("\n" + "=" * 60)
        print("MODEL COMPARISON")
        print("=" * 60)
        print(f"\n{'Metric':<28} {'CNN':>14} {'Linear':>14}")
        print("-" * 58)
        # Price-space (inflated by prev_close — read alongside naive_R2_price)
        for metric in ["MAE", "RMSE", "MAPE", "R2", "naive_MAE_price",
                       "naive_R2_price"]:
            unit = "%" if metric == "MAPE" else " SAR" if metric in (
                "MAE", "RMSE", "naive_MAE_price") else ""
            fmt = ".4f" if "R2" in metric else ".2f"
            cnn_val = all_metrics["CNN"].get(metric, float("nan"))
            lin_val = all_metrics["Linear"].get(metric, float("nan"))
            print(f"{metric:<28} {cnn_val:>13{fmt}}{unit} "
                  f"{lin_val:>13{fmt}}{unit}")
        # Return-space (the honest signal)
        print("-" * 58)
        for metric in ["R2_returns", "Direction_Accuracy_returns",
                       "naive_R2_returns"]:
            unit = "%" if "Direction" in metric else ""
            fmt = ".2f" if "Direction" in metric else ".4f"
            cnn_val = all_metrics["CNN"].get(metric, float("nan"))
            lin_val = all_metrics["Linear"].get(metric, float("nan"))
            print(f"{metric:<28} {cnn_val:>13{fmt}}{unit} "
                  f"{lin_val:>13{fmt}}{unit}")

        # Trading simulation — financial usefulness side-by-side
        print("-" * 58)
        for metric in ["strategy_total_return_pct",
                       "strategy_annual_return_pct",
                       "strategy_sharpe",
                       "strategy_max_drawdown_pct",
                       "hit_rate_traded_pct",
                       "buyhold_sharpe"]:
            unit = "%" if metric.endswith("_pct") else ""
            fmt = ".3f" if "sharpe" in metric else ".2f"
            cnn_val = all_metrics["CNN"].get(metric, float("nan"))
            lin_val = all_metrics["Linear"].get(metric, float("nan"))
            print(f"{metric:<28} {cnn_val:>13{fmt}}{unit} "
                  f"{lin_val:>13{fmt}}{unit}")

    print("\n[DONE] Evaluation complete.")


if __name__ == "__main__":
    main()
