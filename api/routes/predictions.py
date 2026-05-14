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
    """
    sb = get_client()

    # Get all active stocks
    stocks = sb.table("stocks").select("*").eq("is_active", True).execute()
    if not stocks.data:
        return []

    results = []
    for stock_row in stocks.data:
        sym = stock_row["symbol"]

        # Latest market data
        md = (sb.table("market_data").select("close,date")
              .eq("symbol", sym)
              .order("date", desc=True)
              .limit(1)
              .execute())
        latest_close = md.data[0]["close"] if md.data else 0

        # Latest sentiment
        sent = (sb.table("sentiment_analysis").select("*")
                .eq("symbol", sym)
                .order("date", desc=True)
                .limit(1)
                .execute())
        sentiment = sent.data[0] if sent.data else None

        # Get all models
        models = sb.table("ai_models").select("*").execute()
        if not models.data:
            continue

        # Collect predictions from all models
        model_preds = []
        for model in models.data:
            pred = (sb.table("ai_predictions").select("*")
                    .eq("symbol", sym)
                    .eq("model_id", model["model_id"])
                    .order("execution_date", desc=True)
                    .limit(1)
                    .execute())
            if pred.data:
                confidence = _compute_confidence(
                    model["model_id"], pred.data[0]["predicted_close"],
                    latest_close, sentiment, symbol=sym,
                )
                model_preds.append({
                    "predicted": pred.data[0]["predicted_close"],
                    "confidence": confidence,
                    "model_name": _clean_model_name(model.get("type", "Unknown")),
                    "target_date": pred.data[0]["target_date"],
                })

        if not model_preds:
            continue

        # Pick the model with highest confidence as primary
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


@router.get("/models")
def list_models():
    """List all registered AI models."""
    sb = get_client()
    models = sb.table("ai_models").select("*").execute()
    return models.data or []
