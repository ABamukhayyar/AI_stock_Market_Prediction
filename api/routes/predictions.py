"""
Prediction endpoints.

Serves AI model predictions and allows triggering new predictions.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from db.supabase_client import get_client

router = APIRouter()

_MODEL_DISPLAY_NAMES = {
    "CNN-BiLSTM-Attention": "CNN-BiLSTM-Attention",
    "Linear (ElasticNetCV)": "Linear",
    "ElasticNetCV": "Linear",
    "RidgeCV": "Linear",
    "BayesianRidge": "Linear",
}


def _clean_model_name(raw: str) -> str:
    return _MODEL_DISPLAY_NAMES.get(raw, raw)


@router.get("")
def list_predictions(
    symbol: str = Query(default="TASI"),
    limit: int = Query(default=10, ge=1, le=100),
):
    """Get recent predictions for a stock.

    Dashboard uses this to show the latest prediction cards.
    """
    sb = get_client()

    preds = (sb.table("ai_predictions").select("*")
             .eq("symbol", symbol)
             .order("execution_date", desc=True)
             .limit(limit)
             .execute())

    if not preds.data:
        return []

    # Get latest market data for context
    md = (sb.table("market_data").select("close,date")
          .eq("symbol", symbol)
          .order("date", desc=True)
          .limit(1)
          .execute())

    latest_close = md.data[0]["close"] if md.data else 0
    latest_date = md.data[0]["date"] if md.data else None

    # Get model info
    model_ids = list({p["model_id"] for p in preds.data})
    models_map = {}
    for mid in model_ids:
        m = sb.table("ai_models").select("*").eq("model_id", mid).execute()
        if m.data:
            models_map[mid] = m.data[0]

    results = []
    for p in preds.data:
        model = models_map.get(p["model_id"], {})
        predicted = p["predicted_close"]
        change = round((predicted - latest_close) / latest_close * 100, 2) if latest_close else 0

        results.append({
            "prediction_id": p["prediction_id"],
            "symbol": p["symbol"],
            "target_date": p["target_date"],
            "predicted_close": round(predicted, 2),
            "current_close": round(latest_close, 2),
            "change_pct": change,
            "trend": "up" if change > 0 else "down" if change < 0 else "neutral",
            "model_name": model.get("model_name", "Unknown"),
            "model_type": _clean_model_name(model.get("type", "Unknown")),
            "confidence_score": round(p["confidence_score"] * 100),
            "used_sentiment": p["used_sentiment_data"],
            "execution_date": p["execution_date"],
        })

    return results


def _compute_confidence(model_id: int, predicted: float, latest_close: float,
                        sentiment: dict = None, symbol: str | None = None) -> int:
    """Adapter: map the per-row sentiment dict from sentiment_analysis to
    the canonical scorer in prediction.confidence so Dashboard and Stock
    Detail show the same number for the same prediction.
    """
    from prediction.confidence import compute_confidence

    sent = sentiment or {}
    return compute_confidence(
        model_id=model_id,
        predicted_close=predicted,
        latest_close=latest_close,
        sentiment_score=sent.get("sentiment_score"),
        sentiment_confidence=sent.get("confidence"),
        symbol=symbol,
    )


@router.get("/latest")
def latest_predictions(symbol: str = Query(default="TASI")):
    """Get one prediction per stock for Dashboard (Option A).

    Averages predictions across models and computes a real confidence score.

    Bulk-fetched: previously this endpoint did N stocks x M models = O(NxM)
    round-trips to Supabase, which on a hosted DB exhausted the Windows
    socket pool and started returning 500s. Now we fetch ai_models,
    ai_predictions, and model_accuracy_log once each, index in memory, and
    only round-trip per-stock for market_data + sentiment.
    """
    from prediction.confidence import compute_confidence

    sb = get_client()

    stocks = sb.table("stocks").select("*").eq("is_active", True).execute()
    if not stocks.data:
        return []

    models = sb.table("ai_models").select("model_id,type,model_name").execute()
    models_data = models.data or []
    if not models_data:
        return []

    # One bulk pull of ai_predictions, then pick the latest per (symbol, model_id).
    all_preds = (sb.table("ai_predictions")
                 .select("prediction_id,symbol,model_id,predicted_close,target_date,execution_date")
                 .execute())
    latest_pred_by_key = {}  # (symbol, model_id) -> prediction row
    for p in (all_preds.data or []):
        key = (p["symbol"], p["model_id"])
        existing = latest_pred_by_key.get(key)
        if existing is None or p["execution_date"] > existing["execution_date"]:
            latest_pred_by_key[key] = p

    # One bulk pull of model_accuracy_log, joined client-side with the
    # predictions above to build (model_id, symbol) -> avg error_percentage.
    log_index = {l["prediction_id"]: l["error_percentage"]
                 for l in (sb.table("model_accuracy_log")
                           .select("prediction_id,error_percentage")
                           .execute().data or [])}
    errors_by_key = {}  # (model_id, symbol) -> list[error_percentage]
    for p in (all_preds.data or []):
        err = log_index.get(p["prediction_id"])
        if err is not None:
            errors_by_key.setdefault((p["model_id"], p["symbol"]), []).append(err)
    avg_error_by_key = {
        k: sum(v) / len(v) for k, v in errors_by_key.items()
    }

    # Bulk-fetch latest close per stock and latest sentiment per stock in
    # one query each, then index by symbol. Same trick as in /stocks.
    all_symbols = [s["symbol"] for s in stocks.data]
    md_rows = (sb.table("market_data")
               .select("symbol,date,close")
               .in_("symbol", all_symbols)
               .order("date", desc=True)
               .limit(len(all_symbols) * 30)
               .execute().data or [])
    latest_close_by_symbol = {}
    for row in md_rows:
        latest_close_by_symbol.setdefault(row["symbol"], row["close"])
    sent_rows = (sb.table("sentiment_analysis")
                 .select("symbol,date,sentiment_label,sentiment_score,confidence")
                 .in_("symbol", all_symbols)
                 .order("date", desc=True)
                 .limit(len(all_symbols) * 30)
                 .execute().data or [])
    sent_by_symbol = {}
    for row in sent_rows:
        sent_by_symbol.setdefault(row["symbol"], row)

    results = []
    for stock_row in stocks.data:
        sym = stock_row["symbol"]
        latest_close = latest_close_by_symbol.get(sym, 0)
        sentiment = sent_by_symbol.get(sym)
        sent_score = sentiment.get("sentiment_score") if sentiment else None
        sent_conf = sentiment.get("confidence") if sentiment else None

        # Walk the in-memory caches instead of N more DB calls.
        model_preds = []
        for m in models_data:
            mid = m["model_id"]
            pred = latest_pred_by_key.get((sym, mid))
            if not pred:
                continue
            confidence = compute_confidence(
                model_id=mid,
                predicted_close=pred["predicted_close"],
                latest_close=latest_close,
                sentiment_score=sent_score,
                sentiment_confidence=sent_conf,
                symbol=sym,
                avg_error=avg_error_by_key.get((mid, sym)),  # None when no validated history yet
            )
            model_preds.append({
                "predicted": pred["predicted_close"],
                "confidence": confidence,
                "model_name": _clean_model_name(m.get("type", "Unknown")),
                "target_date": pred["target_date"],
            })

        if not model_preds:
            continue

        best = max(model_preds, key=lambda x: x["confidence"])
        avg_predicted = round(sum(p["predicted"] for p in model_preds) / len(model_preds), 2)
        avg_confidence = round(sum(p["confidence"] for p in model_preds) / len(model_preds))
        change = round((best["predicted"] - latest_close) / latest_close * 100, 2) if latest_close else 0

        results.append({
            "id": sym,
            "name": stock_row.get("company_name", sym),
            "predicted": round(best["predicted"], 2),
            "change": change,
            "vs": round(latest_close, 2),
            "model": best["model_name"],
            "confidence": best["confidence"],
            "trend": "up" if change > 0 else "down" if change < 0 else "neutral",
            "target_date": best["target_date"],
            "num_models": len(model_preds),
            "avg_predicted": avg_predicted,
            "avg_confidence": avg_confidence,
            "sentiment": {
                "label": sentiment.get("sentiment_label", "Neutral") if sentiment else "Neutral",
                "score": sentiment.get("sentiment_score", 0) if sentiment else 0,
                "confidence": sentiment.get("confidence", 0) if sentiment else 0,
            } if sentiment else None,
        })

    return results


@router.post("/run")
def run_prediction(
    symbol: str = Query(default="TASI"),
    model_type: str = Query(default="all", pattern="^(cnn|linear|all)$"),
    run_sentiment: bool = Query(default=True),
):
    """Trigger a new prediction run.

    Runs the prediction pipeline and stores results in Supabase.
    """
    try:
        from predict import predict_cnn, predict_linear

        results = []

        if model_type in ("cnn", "all"):
            cnn = predict_cnn(run_sentiment=run_sentiment)
            results.append({
                "model": "CNN-BiLSTM-Attention",
                "predicted_close": round(cnn["final_price"], 2),
                "model_price": round(cnn["model_price"], 2),
                "target_date": cnn["target_date"],
                "sentiment_adjustment": round(cnn["sentiment_adjustment"], 2),
            })

        if model_type in ("linear", "all"):
            linear = predict_linear(run_sentiment=run_sentiment)
            results.append({
                "model": f"Linear ({linear.get('model_label', 'ElasticNet')})",
                "predicted_close": round(linear["final_price"], 2),
                "model_price": round(linear["model_price"], 2),
                "target_date": linear["target_date"],
                "predicted_return": linear.get("predicted_return"),
            })

        return {"status": "success", "predictions": results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/accuracy")
def prediction_accuracy(
    symbol: str | None = Query(default=None,
                               description="Filter by stock symbol (TASI, ARAMCO, etc). "
                                           "Omit to return all symbols."),
    limit: int = Query(default=50, ge=1, le=500,
                       description="Max rows returned (most recent first)."),
):
    """Get accuracy log for past predictions, optionally filtered by symbol.

    Each row pairs a stored prediction with the actual close once the target
    date has passed, plus the percentage error. Frontend uses this to render
    the per-stock "Past Predictions" history panel and to compute rolling
    MAPE so the user can see real model performance, not just a heuristic
    confidence score.
    """
    sb = get_client()

    # When a symbol is given, first narrow prediction_ids to that symbol so
    # we don't pull and discard the whole table. When None, fall back to the
    # all-symbols view.
    pred_query = sb.table("ai_predictions").select(
        "prediction_id,symbol,target_date,predicted_close,model_id"
    )
    if symbol:
        pred_query = pred_query.eq("symbol", symbol)
    preds = pred_query.execute()
    if not preds.data:
        return []

    pred_by_id = {p["prediction_id"]: p for p in preds.data}

    logs = (sb.table("model_accuracy_log").select(
        "log_id,prediction_id,actual_close,error_percentage"
    ).in_("prediction_id", list(pred_by_id.keys())).execute())

    if not logs.data:
        return []

    results = []
    for log in logs.data:
        p = pred_by_id.get(log["prediction_id"])
        if not p:
            continue
        results.append({
            "symbol": p["symbol"],
            "target_date": p["target_date"],
            "predicted_close": round(p["predicted_close"], 2),
            "actual_close": round(log["actual_close"], 2),
            "error_pct": round(log["error_percentage"], 2),
            "model_id": p["model_id"],
        })

    # Most recent first, then trim
    results.sort(key=lambda r: r["target_date"], reverse=True)
    return results[:limit]


@router.get("/model-metrics")
def model_metrics(
    symbol: str = Query(..., description="Stock symbol (TASI, ARAMCO, etc)."),
    model_id: int = Query(..., description="ai_models.model_id"),
):
    """Rolling deployed-performance metrics for one (symbol, model) pair.

    Computed live from `model_accuracy_log` joined with `ai_predictions` so
    the numbers always reflect what this exact model has actually done on
    this exact stock. New predictions and freshly-validated rows flow in
    without any extra plumbing.

    Direction accuracy compares sign(predicted - prev_close) vs
    sign(actual - prev_close), where prev_close is the market_data row
    immediately before target_date. Days where the prev-close lookup fails
    are excluded from the direction count but still count for MAPE.
    """
    sb = get_client()

    preds = (sb.table("ai_predictions")
             .select("prediction_id,target_date,predicted_close")
             .eq("symbol", symbol)
             .eq("model_id", model_id)
             .execute())
    if not preds.data:
        return {
            "symbol": symbol,
            "model_id": model_id,
            "n_predictions": 0,
            "mape_pct": 0.0,
            "direction_accuracy_pct": 0.0,
            "best_error_pct": 0.0,
            "worst_error_pct": 0.0,
            "last_validated_date": None,
        }

    pred_by_id = {p["prediction_id"]: p for p in preds.data}

    logs = (sb.table("model_accuracy_log")
            .select("prediction_id,actual_close,error_percentage")
            .in_("prediction_id", list(pred_by_id.keys()))
            .execute())
    if not logs.data:
        return {
            "symbol": symbol,
            "model_id": model_id,
            "n_predictions": 0,
            "mape_pct": 0.0,
            "direction_accuracy_pct": 0.0,
            "best_error_pct": 0.0,
            "worst_error_pct": 0.0,
            "last_validated_date": None,
        }

    # One range query for market_data, indexed by date in memory.
    target_dates = sorted({pred_by_id[l["prediction_id"]]["target_date"]
                           for l in logs.data
                           if l["prediction_id"] in pred_by_id})
    md = (sb.table("market_data")
          .select("date,close")
          .eq("symbol", symbol)
          .lte("date", target_dates[-1])
          .gte("date", target_dates[0])
          .order("date")
          .execute())
    closes_by_date = {row["date"]: row["close"] for row in (md.data or [])}
    sorted_md_dates = sorted(closes_by_date.keys())

    def prev_close_for(target: str):
        """Find the market_data close on the trading day immediately before
        target_date. Returns None if no such row exists in range."""
        candidate = None
        for d in sorted_md_dates:
            if d < target:
                candidate = d
            else:
                break
        return closes_by_date.get(candidate) if candidate else None

    errors = []
    direction_hits = 0
    direction_total = 0
    last_validated = None

    for log in logs.data:
        p = pred_by_id.get(log["prediction_id"])
        if not p:
            continue
        err = float(log["error_percentage"])
        errors.append(err)

        target = p["target_date"]
        if last_validated is None or target > last_validated:
            last_validated = target

        prev_close = prev_close_for(target)
        if prev_close and prev_close > 0:
            pred_up = p["predicted_close"] > prev_close
            actual_up = log["actual_close"] > prev_close
            direction_total += 1
            if pred_up == actual_up:
                direction_hits += 1

    n = len(errors)
    mape = sum(errors) / n
    return {
        "symbol": symbol,
        "model_id": model_id,
        "n_predictions": n,
        "mape_pct": round(mape, 2),
        "direction_accuracy_pct": (
            round(direction_hits / direction_total * 100, 1)
            if direction_total else 0.0
        ),
        "best_error_pct": round(min(errors), 2),
        "worst_error_pct": round(max(errors), 2),
        "last_validated_date": last_validated,
    }


@router.get("/eval-metrics")
def eval_metrics(
    symbol: str = Query(..., description="Stock symbol (TASI, ARAMCO, etc)."),
    model_id: int = Query(..., description="ai_models.model_id"),
):
    """Offline holdout-evaluation metrics for (symbol, model).

    Reads the JSON written by `evaluate.py` (a `metrics_<symbol>_<cnn|linear>.json`
    file under `models/eval_*` or `models/`). Returns the numeric metrics
    plus aligned arrays for the Diagnostics page to plot:
        - equity_curve (strategy vs buy-and-hold)
        - predicted vs actual scatter
        - rolling MAPE over time

    Unlike `/model-metrics`, this is *holdout* data -- frozen by the
    train/val/test split when the model was evaluated. Hundreds of points,
    refreshes only when `evaluate.py` is re-run (typically after retrain).
    """
    import json
    import os
    from pathlib import Path

    sb = get_client()
    model_row = (sb.table("ai_models").select("type")
                 .eq("model_id", model_id).execute())
    if not model_row.data:
        raise HTTPException(status_code=404,
                            detail=f"Unknown model_id {model_id}")
    raw_type = (model_row.data[0].get("type") or "").lower()
    if "cnn" in raw_type:
        model_label = "cnn"
    elif "linear" in raw_type or "elastic" in raw_type or "ridge" in raw_type:
        model_label = "linear"
    else:
        raise HTTPException(
            status_code=404,
            detail=f"No offline evaluation for model type '{raw_type}'",
        )

    filename = f"metrics_{symbol}_{model_label}.json"
    # Search common output locations in priority order.
    candidates = [
        Path("models") / "eval_v4" / filename,
        Path("models") / f"eval_{symbol}" / filename,
        Path("models") / filename,
    ]
    path = next((c for c in candidates if c.exists()), None)
    if path is None:
        raise HTTPException(
            status_code=404,
            detail=(f"No metrics file for {symbol} / {model_label}. "
                    f"Run: python evaluate.py --symbol {symbol} "
                    f"--model-type {model_label}"),
        )

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/models")
def list_models():
    """List all registered AI models."""
    sb = get_client()
    models = sb.table("ai_models").select("*").execute()
    return models.data or []
