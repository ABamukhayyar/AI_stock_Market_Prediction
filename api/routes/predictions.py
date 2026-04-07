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
                        sentiment: dict = None) -> int:
    """Compute a confidence score (0-100) for a prediction.

    Based on:
    - Model historical accuracy (from accuracy log)
    - Signal strength (how decisive the prediction is)
    - Sentiment alignment (does sentiment agree with prediction direction?)
    """
    sb = get_client()
    score = 50  # base confidence

    # 1. Historical accuracy — boost if model has been accurate
    logs = (sb.table("model_accuracy_log")
            .select("error_percentage,prediction_id")
            .execute())
    if logs.data:
        # Get prediction IDs for this model
        model_preds = (sb.table("ai_predictions")
                       .select("prediction_id")
                       .eq("model_id", model_id)
                       .execute())
        model_pred_ids = {p["prediction_id"] for p in (model_preds.data or [])}
        model_errors = [l["error_percentage"] for l in logs.data
                        if l["prediction_id"] in model_pred_ids]
        if model_errors:
            avg_error = sum(model_errors) / len(model_errors)
            # Low error = high accuracy boost (0-25 points)
            if avg_error < 1:
                score += 25
            elif avg_error < 2:
                score += 20
            elif avg_error < 5:
                score += 12
            elif avg_error < 10:
                score += 5

    # 2. Signal strength — stronger moves = more confident
    if latest_close > 0:
        change_pct = abs((predicted - latest_close) / latest_close * 100)
        if change_pct > 2:
            score += 15
        elif change_pct > 1:
            score += 10
        elif change_pct > 0.3:
            score += 5

    # 3. Sentiment alignment — if sentiment agrees with prediction direction
    if sentiment:
        pred_up = predicted > latest_close
        sent_score = sentiment.get("sentiment_score", 0)
        sent_conf = sentiment.get("confidence", 0)
        sent_up = sent_score > 0

        if sent_conf > 50:  # only count if sentiment is confident
            if pred_up == sent_up:
                score += 10  # aligned
            else:
                score -= 5   # contradicts

    return max(0, min(100, score))


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
                    latest_close, sentiment
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
def prediction_accuracy(symbol: str = Query(default="TASI")):
    """Get accuracy log for past predictions."""
    sb = get_client()

    logs = (sb.table("model_accuracy_log").select(
        "log_id,prediction_id,actual_close,error_percentage"
    ).execute())

    if not logs.data:
        return []

    # Enrich with prediction details
    results = []
    for log in logs.data:
        pred = (sb.table("ai_predictions").select("*")
                .eq("prediction_id", log["prediction_id"])
                .execute())
        if pred.data:
            p = pred.data[0]
            results.append({
                "target_date": p["target_date"],
                "predicted_close": round(p["predicted_close"], 2),
                "actual_close": round(log["actual_close"], 2),
                "error_pct": round(log["error_percentage"], 2),
                "model_id": p["model_id"],
            })

    return results


@router.get("/models")
def list_models():
    """List all registered AI models."""
    sb = get_client()
    models = sb.table("ai_models").select("*").execute()
    return models.data or []
