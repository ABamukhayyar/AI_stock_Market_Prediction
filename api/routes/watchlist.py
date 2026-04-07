"""
Watchlist endpoints.

Manages user stock watchlists via Supabase user_watchlists table.
The frontend currently uses localStorage — these endpoints provide
server-side persistence so watchlists sync across devices.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from db.supabase_client import get_client

router = APIRouter()


class WatchlistItem(BaseModel):
    user_id: str
    symbol: str


@router.get("/{user_id}")
def get_watchlist(user_id: str):
    """Get all stocks in a user's watchlist."""
    sb = get_client()
    result = sb.table("user_watchlists").select("symbol").eq(
        "user_id", user_id
    ).execute()
    return [row["symbol"] for row in (result.data or [])]


@router.post("")
def add_to_watchlist(item: WatchlistItem):
    """Add a stock to the user's watchlist."""
    sb = get_client()
    try:
        sb.table("user_watchlists").upsert({
            "user_id": item.user_id,
            "symbol": item.symbol,
        }, on_conflict="user_id,symbol").execute()
        return {"status": "added", "symbol": item.symbol}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("")
def remove_from_watchlist(user_id: str = Query(...), symbol: str = Query(...)):
    """Remove a stock from the user's watchlist."""
    sb = get_client()
    try:
        sb.table("user_watchlists").delete().eq(
            "user_id", user_id
        ).eq("symbol", symbol).execute()
        return {"status": "removed", "symbol": symbol}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
