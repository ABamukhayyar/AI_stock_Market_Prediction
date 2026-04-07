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


def _enrich_stock(stock_row: dict, market_data: list, prediction: dict = None,
                  sentiment: dict = None) -> dict:
    """Build the stock object in the format the frontend expects."""
    symbol = stock_row["symbol"]

    # Latest market data
    latest = market_data[0] if market_data else {}
    close = latest.get("close", 0)
    open_price = latest.get("open", 0)
    high = latest.get("high", 0)
    low = latest.get("low", 0)
    volume = latest.get("volume", 0)

    # Price history (last 14 days for sparkline)
    history = [row["close"] for row in reversed(market_data[:14])]

    # 52-week high/low from available data
    closes_all = [row["close"] for row in market_data[:252]]
    week52_high = max(closes_all) if closes_all else high
    week52_low = min(closes_all) if closes_all else low

    # Prediction data
    predicted = close
    change = 0.0
    model_name = "N/A"
    confidence = 0
    trend = "neutral"

    if prediction:
        predicted = prediction.get("predicted_close", close)
        if close > 0:
            change = round((predicted - close) / close * 100, 2)
        confidence = int(prediction.get("confidence_score", 0) * 100)
        trend = "up" if change > 0 else "down" if change < 0 else "neutral"

        # Look up model name
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

    # Sentiment info
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
        "sentiment": {
            "label": sentiment_label,
            "score": sentiment_score,
        },
    }


@router.get("")
def list_stocks():
    """List all registered stocks with latest predictions.

    Frontend expects: [{ id, name, sector, predicted, change, vs, model,
    confidence, trend, open, high, low, volume, ... }]
    """
    sb = get_client()

    stocks = sb.table("stocks").select("*").eq("is_active", True).execute()
    if not stocks.data:
        return []

    results = []
    for stock in stocks.data:
        symbol = stock["symbol"]

        # Latest market data (up to 252 days for 52-week range)
        md = (sb.table("market_data").select("*")
              .eq("symbol", symbol)
              .order("date", desc=True)
              .limit(252)
              .execute())

        # Latest prediction
        pred = (sb.table("ai_predictions").select("*")
                .eq("symbol", symbol)
                .order("execution_date", desc=True)
                .limit(1)
                .execute())

        # Latest sentiment
        sent = (sb.table("sentiment_analysis").select("*")
                .eq("symbol", symbol)
                .order("date", desc=True)
                .limit(1)
                .execute())

        enriched = _enrich_stock(
            stock,
            md.data or [],
            pred.data[0] if pred.data else None,
            sent.data[0] if sent.data else None,
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

        pred = (sb.table("ai_predictions").select("*")
                .eq("symbol", symbol)
                .order("execution_date", desc=True)
                .limit(1)
                .execute())

        sent = (sb.table("sentiment_analysis").select("*")
                .eq("symbol", symbol)
                .order("date", desc=True)
                .limit(1)
                .execute())

        enriched = _enrich_stock(
            stock.data[0],
            md.data or [],
            pred.data[0] if pred.data else None,
            sent.data[0] if sent.data else None,
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

    # Get all predictions for this stock (for history)
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

    result = _enrich_stock(
        stock.data[0],
        md.data or [],
        preds.data[0] if preds.data else None,
        sent.data[0] if sent.data else None,
    )

    # Add prediction history with model names
    models_map = {}
    for p in (preds.data or []):
        mid = p["model_id"]
        if mid not in models_map:
            try:
                m = sb.table("ai_models").select("type").eq("model_id", mid).execute()
                models_map[mid] = _clean_model_name(m.data[0]["type"]) if m.data else "Unknown"
            except Exception:
                models_map[mid] = "Unknown"

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

    # Group latest prediction per model for the model switcher
    latest_by_model = {}
    for p in (preds.data or []):
        mid = p["model_id"]
        if mid not in latest_by_model:
            predicted = p["predicted_close"]
            change_pct = round((predicted - (md.data[0]["close"] if md.data else 0)) /
                               (md.data[0]["close"] if md.data else 1) * 100, 2)
            latest_by_model[mid] = {
                "model_id": mid,
                "model_name": models_map.get(mid, "Unknown"),
                "predicted_close": round(predicted, 2),
                "change": change_pct,
                "trend": "up" if change_pct > 0 else "down",
                "target_date": p["target_date"],
                "confidence": int(p.get("confidence_score", 0) * 100),
            }
    result["model_predictions"] = list(latest_by_model.values())

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
