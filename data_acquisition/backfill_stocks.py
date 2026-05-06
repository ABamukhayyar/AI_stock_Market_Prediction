"""
Backfill historical OHLCV data for 5 sector-leading Saudi stocks
into Supabase, plus register them in the `stocks` table so foreign-key
constraints on market_data / sentiment_analysis / ai_predictions hold.

Run from project root:
    python -m data_acquisition.backfill_stocks
"""

import yfinance as yf
import pandas as pd

from db.supabase_client import get_client, upsert_market_data


STOCKS = {
    "2222.SR": "ARAMCO",
    "1120.SR": "RAJHI",
    "2010.SR": "SABIC",
    "7010.SR": "STC",
    "5110.SR": "SECO",
}

# Metadata for the `stocks` table (replaces the manual SQL in BACKFILL_GUIDE.md).
STOCK_METADATA = [
    {"symbol": "ARAMCO", "company_name": "Saudi Aramco",
     "sector": "Energy", "industry": "Integrated Oil & Gas"},
    {"symbol": "RAJHI", "company_name": "Al Rajhi Bank",
     "sector": "Financials", "industry": "Banking"},
    {"symbol": "SABIC", "company_name": "SABIC",
     "sector": "Materials", "industry": "Petrochemicals"},
    {"symbol": "STC", "company_name": "STC",
     "sector": "Communication Services", "industry": "Telecommunications"},
    {"symbol": "SECO", "company_name": "Saudi Electricity",
     "sector": "Utilities", "industry": "Electric Utilities"},
]
_STOCK_DEFAULTS = {
    "country": "Saudi Arabia",
    "exchange_market": "Tadawul",
    "currency": "SAR",
    "is_active": True,
}

PERIOD = "16y"


def register_stocks() -> int:
    """Upsert the 5 stocks into the `stocks` table. Idempotent."""
    sb = get_client()
    rows = [{**_STOCK_DEFAULTS, **m} for m in STOCK_METADATA]
    sb.table("stocks").upsert(rows, on_conflict="symbol").execute()
    print(f"  Registered {len(rows)} symbols in stocks table")
    return len(rows)


def fetch_one(ticker: str) -> pd.DataFrame:
    # auto_adjust=True splits- and dividend-adjusts the Close so percentage-change
    # series are continuous. With auto_adjust=False the EDA found phantom +300% /
    # +150% return spikes for RAJHI and STC at split events — those would poison
    # any per-stock model trained on the raw series.
    df = yf.download(ticker, period=PERIOD, progress=False, auto_adjust=True)
    if df.empty:
        return df
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.reset_index()
    df = df[["Date", "Open", "High", "Low", "Close", "Volume"]].dropna()
    return df


def main():
    print("Registering stocks in `stocks` table...")
    register_stocks()
    for ticker, symbol in STOCKS.items():
        print(f"\nFetching {symbol} ({ticker})...")
        df = fetch_one(ticker)
        if df.empty:
            print(f"  No data returned for {ticker}, skipping.")
            continue
        n = upsert_market_data(df, symbol=symbol)
        print(f"  Upserted {n} rows for {symbol}")


if __name__ == "__main__":
    main()
