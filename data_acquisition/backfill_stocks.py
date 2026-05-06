"""
Backfill historical OHLCV data for 5 sector-leading Saudi stocks
into Supabase market_data table.

Run from project root:
    python -m data_acquisition.backfill_stocks
"""

import yfinance as yf
import pandas as pd

from db.supabase_client import upsert_market_data


STOCKS = {
    "2222.SR": "ARAMCO",
    "1120.SR": "RAJHI",
    "2010.SR": "SABIC",
    "7010.SR": "STC",
    "5110.SR": "SECO",
}

PERIOD = "6y"


def fetch_one(ticker: str) -> pd.DataFrame:
    df = yf.download(ticker, period=PERIOD, progress=False, auto_adjust=False)
    if df.empty:
        return df
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.reset_index()
    df = df[["Date", "Open", "High", "Low", "Close", "Volume"]].dropna()
    return df


def main():
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
