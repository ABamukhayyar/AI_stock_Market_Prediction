"""
Supabase client — singleton connection and helper methods for all DB operations.

Uses SUPABASE_URL + SUPABASE_SERVICE_KEY from .env (service key needed for writes).
Falls back to SUPABASE_ANON_KEY for read-only access.
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env from project root
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

_client: Optional[Client] = None


def get_client() -> Client:
    """Return a singleton Supabase client."""
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
        _client = create_client(url, key)
    return _client


# ======================================================================
# Market Data
# ======================================================================

def _paginated_query(table: str, symbol: str, start=None, end=None, page_size=1000):
    """Fetch all rows with pagination (PostgREST defaults to 1000 max)."""
    sb = get_client()
    all_data = []
    offset = 0
    while True:
        query = sb.table(table).select("*").eq("symbol", symbol)
        if start:
            query = query.gte("date", start)
        if end:
            query = query.lte("date", end)
        query = query.order("date").range(offset, offset + page_size - 1)
        result = query.execute()
        if not result.data:
            break
        all_data.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size
    return all_data


def get_market_data(
    symbol: str = "TASI",
    start: Optional[str] = None,
    end: Optional[str] = None,
) -> pd.DataFrame:
    """Read OHLCV data from market_data table."""
    data = _paginated_query("market_data", symbol, start, end)
    if not data:
        return pd.DataFrame()
    df = pd.DataFrame(data)
    df["date"] = pd.to_datetime(df["date"])
    return df


def upsert_market_data(df: pd.DataFrame, symbol: str = "TASI") -> int:
    """Bulk upsert OHLCV rows into market_data. Returns rows upserted."""
    sb = get_client()
    rows = []
    for _, r in df.iterrows():
        rows.append({
            "symbol": symbol,
            "date": str(r["Date"].date()) if hasattr(r["Date"], "date") else str(r["Date"]),
            "open": float(r["Open"]),
            "high": float(r["High"]),
            "low": float(r["Low"]),
            "close": float(r["Close"]),
            "volume": int(r["Volume"]),
        })
    # Upsert in batches of 500
    total = 0
    for i in range(0, len(rows), 500):
        batch = rows[i : i + 500]
        sb.table("market_data").upsert(batch, on_conflict="symbol,date").execute()
        total += len(batch)
    return total


# ======================================================================
# Technical Indicators
# ======================================================================

def upsert_technical_indicators(df: pd.DataFrame, symbol: str = "TASI") -> int:
    """Bulk upsert technical indicator rows."""
    sb = get_client()
    rows = []
    for _, r in df.iterrows():
        row = {
            "symbol": symbol,
            "date": str(r["Date"].date()) if hasattr(r["Date"], "date") else str(r["Date"]),
        }
        col_map = {
            "Volume": "volume", "RSI": "rsi_14", "MACD": "macd",
            "ATR": "atr_14", "SMA_50": "sma_50", "EMA_20": "ema_20",
            "Bollinger_Width": "bollinger_width",
        }
        for src, dst in col_map.items():
            if src in r.index and pd.notna(r[src]):
                row[dst] = float(r[src])
        rows.append(row)
    total = 0
    for i in range(0, len(rows), 500):
        batch = rows[i : i + 500]
        sb.table("technical_indicators").upsert(
            batch, on_conflict="symbol,date"
        ).execute()
        total += len(batch)
    return total


# ======================================================================
# Sentiment Analysis
# ======================================================================

def upsert_sentiment(data: dict, symbol: str = "TASI") -> None:
    """Insert or update a daily sentiment row."""
    sb = get_client()
    row = {
        "symbol": symbol,
        "date": data.get("date", datetime.now().strftime("%Y-%m-%d")),
        "source": data.get("source", "google_news_rss"),
        "sentiment_score": data.get("score", 0),
        "magnitude": data.get("magnitude", 0),
        "mention_count": data.get("total_articles", 0),
        "confidence": data.get("confidence", 0),
        "sentiment_label": data.get("sentiment_label", "Neutral"),
        "sentiment_encoded": data.get("sentiment_encoded", 0),
        "positive_articles": data.get("positive_articles", 0),
        "negative_articles": data.get("negative_articles", 0),
        "neutral_articles": data.get("neutral_articles", 0),
        "total_articles": data.get("total_articles", 0),
        "data_quality": data.get("data_quality", "Low"),
    }
    sb.table("sentiment_analysis").upsert(
        row, on_conflict="symbol,date"
    ).execute()


def get_sentiment(
    symbol: str = "TASI",
    start: Optional[str] = None,
    end: Optional[str] = None,
) -> pd.DataFrame:
    """Read sentiment history from sentiment_analysis table."""
    data = _paginated_query("sentiment_analysis", symbol, start, end)
    if not data:
        return pd.DataFrame()
    df = pd.DataFrame(data)
    df["date"] = pd.to_datetime(df["date"])
    return df


# ======================================================================
# AI Models Registry
# ======================================================================

def register_model(
    model_name: str,
    version: str,
    model_type: str = "CNN-BiLSTM-Attention",
    prediction_horizon: str = "1d",
    description: str = "",
) -> int:
    """Register a model in ai_models. Returns model_id."""
    sb = get_client()
    row = {
        "model_name": model_name,
        "version": version,
        "type": model_type,
        "prediction_horizon": prediction_horizon,
        "description": description,
        "created_at": datetime.now().isoformat(),
    }
    result = sb.table("ai_models").insert(row).execute()
    return result.data[0]["model_id"]


def get_or_register_model(
    model_name: str,
    version: str,
    model_type: str = "CNN-BiLSTM-Attention",
    prediction_horizon: str = "1d",
    description: str = "",
) -> int:
    """Look up a model by name+version; register it if not found. Returns model_id."""
    sb = get_client()
    result = (
        sb.table("ai_models")
        .select("model_id")
        .eq("model_name", model_name)
        .eq("version", version)
        .execute()
    )
    if result.data:
        return result.data[0]["model_id"]
    return register_model(model_name, version, model_type,
                          prediction_horizon, description)


# ======================================================================
# AI Predictions
# ======================================================================

def insert_prediction(
    model_id: int,
    symbol: str,
    target_date: str,
    predicted_close: float,
    confidence_score: float = 0.0,
    used_sentiment: bool = False,
    used_technical: bool = True,
    input_features: str = "",
) -> int:
    """Insert a prediction row. Returns prediction_id."""
    sb = get_client()
    row = {
        "model_id": model_id,
        "symbol": symbol,
        "execution_date": datetime.now().isoformat(),
        "target_date": target_date,
        "predicted_close": predicted_close,
        "confidence_score": confidence_score,
        "used_sentiment_data": used_sentiment,
        "used_financials": False,
        "used_technical_indicators": used_technical,
        "input_features": input_features,
    }
    result = sb.table("ai_predictions").insert(row).execute()
    return result.data[0]["prediction_id"]


# ======================================================================
# Model Accuracy Log
# ======================================================================

def log_accuracy(
    prediction_id: int,
    actual_close: float,
    error_percentage: float,
) -> None:
    """Log actual vs predicted accuracy."""
    sb = get_client()
    row = {
        "prediction_id": prediction_id,
        "actual_close": actual_close,
        "error_percentage": error_percentage,
    }
    sb.table("model_accuracy_log").insert(row).execute()
