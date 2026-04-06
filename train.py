# ============================================================
# train.py — Best Linear Model for TASI
# Walk-forward validated, financially evaluated, ensemble-ready
# ============================================================

import pandas as pd
import numpy as np
import joblib
import json
from sklearn.linear_model import ElasticNetCV, RidgeCV, BayesianRidge
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error
import warnings
warnings.filterwarnings("ignore")

# Import feature list from build_dataset
from build_dataset import FEATURES

TARGET = "target_return"


# ==============================================================
# 1. Load Data
# ==============================================================

def load_data(path="tasi_dataset_v2.csv"):
    df = pd.read_csv(path, parse_dates=["Date"])
    df = df.sort_values("Date").reset_index(drop=True)
    # Safety: replace any remaining inf, then drop NaN rows in features/target
    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.dropna(subset=FEATURES + [TARGET]).reset_index(drop=True)
    return df


# ==============================================================
# 2. Walk-Forward Engine
# ==============================================================

def walk_forward(df, model_class, model_kwargs, features=FEATURES,
                 initial_pct=0.60, step=21):
    """
    Expanding-window walk-forward validation.
    Returns arrays of predictions, actuals, dates, and per-window uncertainties.
    """
    X = df[features].values
    y = df[TARGET].values
    dates = df["Date"].values
    closes = df["Close"].values

    n = len(df)
    start = int(n * initial_pct)

    all_preds    = []
    all_actuals  = []
    all_dates    = []
    all_closes   = []
    all_std      = []  # uncertainty (only BayesianRidge fills this meaningfully)

    for end in range(start, n - 1, step):
        X_train, y_train = X[:end], y[:end]
        X_test  = X[end:end + step]
        y_test  = y[end:end + step]
        d_test  = dates[end:end + step]
        c_test  = closes[end:end + step]

        # Scale — fit only on training window
        scaler = StandardScaler()
        X_tr_s = scaler.fit_transform(X_train)
        X_te_s = scaler.transform(X_test)

        # Train
        model = model_class(**model_kwargs)
        model.fit(X_tr_s, y_train)

        # Predict
        if hasattr(model, "predict") and model_class == BayesianRidge:
            preds, std = model.predict(X_te_s, return_std=True)
        else:
            preds = model.predict(X_te_s)
            std = np.zeros(len(preds))

        all_preds.extend(preds)
        all_actuals.extend(y_test)
        all_dates.extend(d_test)
        all_closes.extend(c_test)
        all_std.extend(std)

    return (np.array(all_preds), np.array(all_actuals),
            np.array(all_dates), np.array(all_closes), np.array(all_std))


# ==============================================================
# 3. Financial Metrics
# ==============================================================

def compute_financial_metrics(preds, actuals, closes, stds=None,
                              cost_bps=15, confidence_threshold=None):
    """
    Compute real financial performance metrics.

    Args:
        cost_bps: round-trip transaction cost in basis points
        confidence_threshold: if set, only trade when |pred| > threshold
    """
    cost = cost_bps / 10000.0

    # Apply confidence filter
    if confidence_threshold is not None:
        mask = np.abs(preds) > confidence_threshold
    else:
        mask = np.ones(len(preds), dtype=bool)

    if mask.sum() == 0:
        return {"error": "No trades passed the filter"}

    p = preds[mask]
    a = actuals[mask]
    c = closes[mask]

    # Direction signal: +1 long, -1 short (or 0 if filtered)
    signals = np.sign(p)

    # Daily PnL (return × signal - cost)
    daily_pnl = signals * a - cost  # cost every day we trade
    cumulative = np.cumsum(daily_pnl)

    # Metrics
    total_return = cumulative[-1]
    n_days = len(daily_pnl)
    n_trades = mask.sum()

    # Direction accuracy
    dir_correct = (np.sign(p) == np.sign(a))
    dir_accuracy = dir_correct.mean() * 100

    # Sharpe ratio (annualized, ~252 trading days)
    if daily_pnl.std() > 0:
        sharpe = (daily_pnl.mean() / daily_pnl.std()) * np.sqrt(252)
    else:
        sharpe = 0.0

    # Max drawdown
    running_max = np.maximum.accumulate(cumulative)
    drawdowns = cumulative - running_max
    max_drawdown = drawdowns.min()

    # Win rate & avg win/loss
    wins  = daily_pnl[daily_pnl > 0]
    losses = daily_pnl[daily_pnl <= 0]
    win_rate = len(wins) / n_days * 100 if n_days > 0 else 0
    avg_win  = wins.mean()  if len(wins)  > 0 else 0
    avg_loss = losses.mean() if len(losses) > 0 else 0
    profit_factor = abs(wins.sum() / losses.sum()) if losses.sum() != 0 else np.inf

    # Buy & hold comparison
    buy_hold_return = (c[-1] - c[0]) / c[0] if c[0] != 0 else 0

    return {
        "total_return_pct":    round(total_return * 100, 4),
        "buy_hold_return_pct": round(buy_hold_return * 100, 4),
        "sharpe_ratio":        round(sharpe, 4),
        "max_drawdown_pct":    round(max_drawdown * 100, 4),
        "dir_accuracy_pct":    round(dir_accuracy, 2),
        "win_rate_pct":        round(win_rate, 2),
        "avg_win_pct":         round(avg_win * 100, 6),
        "avg_loss_pct":        round(avg_loss * 100, 6),
        "profit_factor":       round(profit_factor, 4),
        "n_trades":            int(n_trades),
        "n_days_evaluated":    int(n_days),
    }


def compute_ml_metrics(preds, actuals):
    """Standard ML regression metrics."""
    mae  = mean_absolute_error(actuals, preds)
    rmse = np.sqrt(mean_squared_error(actuals, preds))
    dir_acc = (np.sign(preds) == np.sign(actuals)).mean() * 100

    # Naive baseline: predict 0 (no change)
    mae_naive = mean_absolute_error(actuals, np.zeros_like(actuals))

    return {
        "MAE":              round(mae, 6),
        "RMSE":             round(rmse, 6),
        "MAE_naive":        round(mae_naive, 6),
        "MAE_improvement":  round((mae_naive - mae) / mae_naive * 100, 2),
        "dir_accuracy_pct": round(dir_acc, 2),
    }


# ==============================================================
# 4. Model Comparison
# ==============================================================

def compare_models(df):
    """Run walk-forward on 3 linear models and compare."""

    models = {
        "ElasticNet": (
            ElasticNetCV,
            {"l1_ratio": [0.1, 0.3, 0.5, 0.7, 0.9],
             "cv": 5, "max_iter": 10000, "random_state": 42}
        ),
        "Ridge": (
            RidgeCV,
            {"alphas": np.logspace(-4, 4, 50), "cv": 5}
        ),
        "BayesianRidge": (
            BayesianRidge,
            {"max_iter": 500, "tol": 1e-6}
        ),
    }

    results = {}
    best_name = None
    best_sharpe = -np.inf

    for name, (cls, kwargs) in models.items():
        print(f"\n{'='*60}")
        print(f"  {name}")
        print(f"{'='*60}")

        preds, actuals, dates, closes, stds = walk_forward(
            df, cls, kwargs
        )

        ml = compute_ml_metrics(preds, actuals)
        fin = compute_financial_metrics(preds, actuals, closes)

        # Also test with confidence filter
        # Use median |prediction| as threshold — only trade top 50% signals
        threshold = np.median(np.abs(preds))
        fin_filtered = compute_financial_metrics(
            preds, actuals, closes,
            confidence_threshold=threshold
        )

        results[name] = {
            "ml_metrics": ml,
            "financial_all_trades": fin,
            "financial_filtered": fin_filtered,
            "predictions": preds,
            "actuals": actuals,
            "dates": dates,
            "closes": closes,
            "stds": stds,
        }

        print(f"\n  ML Metrics:")
        for k, v in ml.items():
            print(f"    {k:25s}: {v}")

        print(f"\n  Financial (all trades, 15bps cost):")
        for k, v in fin.items():
            print(f"    {k:25s}: {v}")

        print(f"\n  Financial (filtered — top 50% signals):")
        for k, v in fin_filtered.items():
            print(f"    {k:25s}: {v}")

        # Track best by filtered Sharpe
        s = fin_filtered.get("sharpe_ratio", -np.inf)
        if s > best_sharpe:
            best_sharpe = s
            best_name = name

    print(f"\n{'='*60}")
    print(f"  BEST MODEL: {best_name}  (filtered Sharpe = {best_sharpe})")
    print(f"{'='*60}")

    return results, best_name


# ==============================================================
# 5. Train Final Model & Save
# ==============================================================

def train_final(df, best_name, results):
    """Train best model on all data, save for production."""

    X = df[FEATURES].values
    y = df[TARGET].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Choose the right model class
    if best_name == "ElasticNet":
        model = ElasticNetCV(
            l1_ratio=[0.1, 0.3, 0.5, 0.7, 0.9],
            cv=5, max_iter=10000, random_state=42
        )
    elif best_name == "Ridge":
        model = RidgeCV(alphas=np.logspace(-4, 4, 50), cv=5)
    else:
        model = BayesianRidge(max_iter=500, tol=1e-6)

    model.fit(X_scaled, y)

    # Feature importance
    if hasattr(model, "coef_"):
        coef_df = pd.DataFrame({
            "feature": FEATURES,
            "coefficient": model.coef_
        }).sort_values("coefficient", key=abs, ascending=False)

        print(f"\n{'='*60}")
        print(f"  Feature Coefficients ({best_name})")
        print(f"{'='*60}")
        print(coef_df.to_string(index=False))

        zeroed = (coef_df["coefficient"] == 0).sum()
        if zeroed > 0:
            print(f"\n  Features zeroed out: {zeroed}")

        active = coef_df[coef_df["coefficient"] != 0]
        print(f"  Active features: {len(active)} / {len(FEATURES)}")

    # Save
    joblib.dump(model,  "tasi_linear_model.pkl")
    joblib.dump(scaler, "tasi_linear_scaler.pkl")

    # Save feature list and metadata
    metadata = {
        "model_type": best_name,
        "features": FEATURES,
        "n_features": len(FEATURES),
        "training_rows": len(df),
        "date_range": f"{df['Date'].min().date()} → {df['Date'].max().date()}",
    }

    # Add best metrics
    r = results[best_name]
    metadata["ml_metrics"] = r["ml_metrics"]
    metadata["financial_all_trades"] = r["financial_all_trades"]
    metadata["financial_filtered"] = r["financial_filtered"]

    with open("tasi_linear_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2, default=str)

    print(f"\n✅ Model saved to:    tasi_linear_model.pkl")
    print(f"✅ Scaler saved to:   tasi_linear_scaler.pkl")
    print(f"✅ Metadata saved to: tasi_linear_metadata.json")

    return model, scaler


# ==============================================================
# 6. Main
# ==============================================================

if __name__ == "__main__":
    print("Loading dataset...")
    df = load_data("tasi_dataset_v2.csv")
    print(f"Loaded {len(df)} rows, {len(FEATURES)} features\n")

    # Compare all 3 linear models
    results, best_name = compare_models(df)

    # Train final model on full data
    model, scaler = train_final(df, best_name, results)

    print("\n🎯 Done. Use predict.py for next-day predictions.")
