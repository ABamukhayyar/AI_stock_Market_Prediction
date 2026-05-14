"""
Stock data endpoints.

Serves stock info, market data, and technical indicators from Supabase.
Matches the data format expected by the React frontend (StockData.js).
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from db.supabase_client import get_client

router = APIRouter()

# Clean model type names for frontend display
_MODEL_DISPLAY_NAMES = {
    "CNN-BiLSTM-Attention": "CNN-BiLSTM-Attention",
    "Linear (ElasticNetCV)": "Linear",
    "ElasticNetCV": "Linear",
    "RidgeCV": "Linear",
    "BayesianRidge": "Linear",
}


def _clean_model_name(raw: str) -> str:
    return _MODEL_DISPLAY_NAMES.get(raw, raw)


def _format_volume(vol: int) -> str:
    """Format volume for display (e.g. 283M)."""
    if vol >= 1_000_000_000:
        return f"{vol / 1_000_000_000:.1f}B"
    if vol >= 1_000_000:
        return f"{vol / 1_000_000:.1f}M"
    if vol >= 1_000:
        return f"{vol / 1_000:.1f}K"
    return str(vol)


def _build_model_predictions(
    sb, symbol: str, latest_close: float, sentiment_row: dict | None,
    models_data: list,
) -> list:
    """Return [{model_id, model_name, predicted_close, change, confidence,
    target_date, trend}] sorted by confidence desc. Empty when no model has
    a prediction for this symbol yet."""
    from prediction.confidence import compute_confidence

    results = []
    for m in models_data:
        mid = m["model_id"]
        pred = (sb.table("ai_predictions").select("*")
                .eq("symbol", symbol)
                .eq("model_id", mid)
                .order("execution_date", desc=True)
                .limit(1)
                .execute())
        if not pred.data:
            continue
        p = pred.data[0]
        predicted = p["predicted_close"]
        change = round((predicted - latest_close) / latest_close * 100, 2) if latest_close else 0.0
        conf = compute_confidence(
            model_id=mid,
            predicted_close=predicted,
            latest_close=latest_close,
            sentiment_score=(sentiment_row or {}).get("sentiment_score"),
            sentiment_confidence=(sentiment_row or {}).get("confidence"),
            symbol=symbol,
        )
        results.append({
            "model_id": mid,
            "model_name": _clean_model_name(m.get("type", "Unknown")),
            "predicted_close": round(predicted, 2),
            "change": change,
            "trend": "up" if change > 0 else "down" if change < 0 else "neutral",
            "confidence": conf,
            "target_date": p["target_date"],
        })
    results.sort(key=lambda r: r["confidence"], reverse=True)
    return results


def _enrich_stock(stock_row: dict, market_data: list, prediction: dict = None,
                  sentiment: dict = None, model_predictions: list = None) -> dict:
    """Build the stock object in the format the frontend expects.

    When model_predictions is provided and non-empty, the top-level fields
    (predicted, change, confidence, model) reflect the highest-confidence
    entry. The legacy `prediction` arg is the fallback for callers that
    haven't been migrated.
    """
    symbol = stock_row["symbol"]

    latest = market_data[0] if market_data else {}
    close = latest.get("close", 0)
    open_price = latest.get("open", 0)
    high = latest.get("high", 0)
    low = latest.get("low", 0)
    volume = latest.get("volume", 0)

    history_rows = list(reversed(market_data[:14]))
    history = [row["close"] for row in history_rows]
    history_dates = [row["date"] for row in history_rows]

    closes_all = [row["close"] for row in market_data[:252]]
    week52_high = max(closes_all) if closes_all else high
    week52_low = min(closes_all) if closes_all else low

    predicted = close
    change = 0.0
    model_name = "N/A"
    confidence = 0
    trend = "neutral"
    target_date = None

    if model_predictions:
        best = model_predictions[0]  # already sorted by confidence desc
        predicted = best["predicted_close"]
        change = best["change"]
        confidence = best["confidence"]
        model_name = best["model_name"]
        trend = best["trend"]
        target_date = best.get("target_date")
    elif prediction:
        predicted = prediction.get("predicted_close", close)
        if close > 0:
            change = round((predicted - close) / close * 100, 2)
        confidence = int(prediction.get("confidence_score", 0) * 100)
        trend = "up" if change > 0 else "down" if change < 0 else "neutral"
        target_date = prediction.get("target_date")

        model_id = prediction.get("model_id")
        if model_id:
            try:
                sb = get_client()
                model_row = sb.table("ai_models").select("model_name,type").eq(
                    "model_id", model_id
                ).execute()
                if model_row.data:
                    model_name = _clean_model_name(model_row.data[0].get("type", "Unknown"))
            except Exception:
                pass

    sentiment_label = "Neutral"
    sentiment_score = 0
    if sentiment:
        sentiment_label = sentiment.get("sentiment_label", "Neutral")
        sentiment_score = sentiment.get("sentiment_score", 0)

    return {
        "id": symbol,
        "name": stock_row.get("company_name", symbol),
        "sector": stock_row.get("sector", "Unknown"),
        "predicted": round(predicted, 2),
        "change": change,
        "vs": round(close, 2),
        "model": model_name,
        "confidence": confidence,
        "trend": trend,
        "open": round(open_price, 2),
        "high": round(high, 2),
        "low": round(low, 2),
        "volume": _format_volume(volume),
        "marketCap": "N/A",
        "pe": None,
        "week52High": round(week52_high, 2),
        "week52Low": round(week52_low, 2),
        "description": stock_row.get("sector", ""),
        "modelRationale": f"Prediction by {model_name} model.",
        "history": [round(h, 2) for h in history],
        "history_dates": history_dates,
        "target_date": target_date,
        "sentiment": {
            "label": sentiment_label,
            "score": sentiment_score,
        },
        "model_predictions": model_predictions or [],
    }


@router.get("")
def list_stocks():
    """List all registered stocks with latest predictions across all models.

    Each stock includes a `model_predictions` array so the frontend can
    toggle between CNN / Linear / etc. without a refetch. Top-level
    `predicted`/`confidence`/`model` reflect the highest-confidence model.
    """
    sb = get_client()

    stocks = sb.table("stocks").select("*").eq("is_active", True).execute()
    if not stocks.data:
        return []

    models = sb.table("ai_models").select("model_id,model_name,type").execute()
    models_data = models.data or []

    results = []
    for stock in stocks.data:
        symbol = stock["symbol"]

        md = (sb.table("market_data").select("*")
              .eq("symbol", symbol)
              .order("date", desc=True)
              .limit(252)
              .execute())

        sent = (sb.table("sentiment_analysis").select("*")
                .eq("symbol", symbol)
                .order("date", desc=True)
                .limit(1)
                .execute())

        latest_close = md.data[0]["close"] if md.data else 0
        sentiment_row = sent.data[0] if sent.data else None
        model_preds = _build_model_predictions(
            sb, symbol, latest_close, sentiment_row, models_data,
        )

        enriched = _enrich_stock(
            stock,
            md.data or [],
            None,
            sentiment_row,
            model_predictions=model_preds,
        )
        results.append(enriched)

    return results


@router.get("/list")
def stock_list():
    """Return the universe of all known TASI stocks (for search/autocomplete).

    Returns: [{ id, name, market, sector }]
    """
    sb = get_client()
    stocks = sb.table("stocks").select("symbol,company_name,sector,exchange_market").execute()
    return [
        {
            "id": s["symbol"],
            "name": s["company_name"],
            "market": s.get("exchange_market", "TADAWUL"),
            "sector": s.get("sector", "Unknown"),
        }
        for s in (stocks.data or [])
    ]


@router.get("/batch")
def batch_stocks(ids: str = Query(..., description="Comma-separated stock IDs")):
    """Fetch multiple stocks by ID (for watchlist page)."""
    id_list = [s.strip() for s in ids.split(",") if s.strip()]
    if not id_list:
        return []

    sb = get_client()
    models = sb.table("ai_models").select("model_id,model_name,type").execute()
    models_data = models.data or []

    results = []
    for symbol in id_list:
        stock = sb.table("stocks").select("*").eq("symbol", symbol).execute()
        if not stock.data:
            continue

        md = (sb.table("market_data").select("*")
              .eq("symbol", symbol)
              .order("date", desc=True)
              .limit(252)
              .execute())

        sent = (sb.table("sentiment_analysis").select("*")
                .eq("symbol", symbol)
                .order("date", desc=True)
                .limit(1)
                .execute())

        latest_close = md.data[0]["close"] if md.data else 0
        sentiment_row = sent.data[0] if sent.data else None
        model_preds = _build_model_predictions(
            sb, symbol, latest_close, sentiment_row, models_data,
        )

        enriched = _enrich_stock(
            stock.data[0],
            md.data or [],
            None,
            sentiment_row,
            model_predictions=model_preds,
        )
        results.append(enriched)

    return results


@router.get("/{stock_id}")
def get_stock(stock_id: str):
    """Get detailed stock info by symbol.

    Frontend expects the full stock object with history, rationale, etc.
    """
    sb = get_client()

    stock = sb.table("stocks").select("*").eq("symbol", stock_id).execute()
    if not stock.data:
        raise HTTPException(status_code=404, detail=f"Stock {stock_id} not found")

    md = (sb.table("market_data").select("*")
          .eq("symbol", stock_id)
          .order("date", desc=True)
          .limit(252)
          .execute())

    preds = (sb.table("ai_predictions").select("*")
             .eq("symbol", stock_id)
             .order("execution_date", desc=True)
             .limit(10)
             .execute())

    sent = (sb.table("sentiment_analysis").select("*")
            .eq("symbol", stock_id)
            .order("date", desc=True)
            .limit(1)
            .execute())

    models = sb.table("ai_models").select("model_id,model_name,type").execute()
    models_data = models.data or []
    models_map = {m["model_id"]: _clean_model_name(m.get("type", "Unknown"))
                  for m in models_data}

    latest_close = md.data[0]["close"] if md.data else 0
    sentiment_row = sent.data[0] if sent.data else None
    model_preds = _build_model_predictions(
        sb, stock_id, latest_close, sentiment_row, models_data,
    )

    result = _enrich_stock(
        stock.data[0],
        md.data or [],
        None,
        sentiment_row,
        model_predictions=model_preds,
    )

    result["prediction_history"] = [
        {
            "date": p["target_date"],
            "predicted_close": round(p["predicted_close"], 2),
            "model_id": p["model_id"],
            "model_name": models_map.get(p["model_id"], "Unknown"),
            "used_sentiment": p["used_sentiment_data"],
        }
        for p in (preds.data or [])
    ]

    return result


@router.get("/{stock_id}/history")
def get_stock_history(
    stock_id: str,
    days: int = Query(default=60, ge=1, le=1000),
):
    """Get OHLCV price history for a stock."""
    sb = get_client()
    md = (sb.table("market_data").select("*")
          .eq("symbol", stock_id)
          .order("date", desc=True)
          .limit(days)
          .execute())

    if not md.data:
        raise HTTPException(status_code=404, detail=f"No market data for {stock_id}")

    return [
        {
            "date": row["date"],
            "open": row["open"],
            "high": row["high"],
            "low": row["low"],
            "close": row["close"],
            "volume": row["volume"],
        }
        for row in reversed(md.data)
    ]
