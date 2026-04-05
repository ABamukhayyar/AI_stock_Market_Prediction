"""
DataAcquisitionService — loads TASI historical CSV and fetches macroeconomic
data (Oil, S&P 500, Gold, Dollar Index, Interest Rate) via yfinance.
"""

import re
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf


class DataAcquisitionService:
    """Loads and merges TASI market data with macroeconomic indicators."""

    MACRO_TICKERS = {
        "Oil": "BZ=F",
        "SP500": "^GSPC",
        "Gold": "GC=F",
        "DXY": "DX-Y.NYB",
        "Interest_Rate": "^TNX",
    }

    def __init__(self, csv_path: str = "TASI_Historical_Data.csv"):
        self.csv_path = Path(csv_path)

    # ------------------------------------------------------------------
    # TASI CSV loading
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_volume(vol_str) -> float:
        """Convert volume strings like '123.45M' or '1.2B' to numeric."""
        if pd.isna(vol_str):
            return np.nan
        vol_str = str(vol_str).strip().replace(",", "")
        multipliers = {"K": 1e3, "M": 1e6, "B": 1e9}
        for suffix, mult in multipliers.items():
            if vol_str.upper().endswith(suffix):
                return float(vol_str[:-1]) * mult
        try:
            return float(vol_str)
        except ValueError:
            return np.nan

    @staticmethod
    def _parse_change_pct(val) -> float:
        """Strip '%' from change column and convert to float."""
        if pd.isna(val):
            return np.nan
        return float(str(val).strip().replace("%", "").replace(",", ""))

    @staticmethod
    def _parse_price(val) -> float:
        """Remove commas from price strings and convert to float."""
        if pd.isna(val):
            return np.nan
        return float(str(val).strip().replace(",", ""))

    def load_tasi(self) -> pd.DataFrame:
        """Load TASI_Historical_Data.csv and return a clean DataFrame.

        Returns columns: Date, Open, High, Low, Close, Volume, Change_Pct
        sorted ascending by date.
        """
        if not self.csv_path.exists():
            raise FileNotFoundError(
                f"TASI CSV not found at {self.csv_path.resolve()}. "
                "Download it from Investing.com and place it in the project root."
            )

        df = pd.read_csv(self.csv_path)

        # Standardise column names
        col_map = {}
        for c in df.columns:
            cl = c.strip().lower()
            if cl == "date":
                col_map[c] = "Date"
            elif cl == "price" or cl == "close":
                col_map[c] = "Close"
            elif cl == "open":
                col_map[c] = "Open"
            elif cl == "high":
                col_map[c] = "High"
            elif cl == "low":
                col_map[c] = "Low"
            elif "vol" in cl:
                col_map[c] = "Volume"
            elif "change" in cl:
                col_map[c] = "Change_Pct"
        df.rename(columns=col_map, inplace=True)

        # Parse date
        df["Date"] = pd.to_datetime(df["Date"], dayfirst=False, format="mixed")

        # Parse numeric columns
        for col in ["Open", "High", "Low", "Close"]:
            df[col] = df[col].apply(self._parse_price)
        df["Volume"] = df["Volume"].apply(self._parse_volume)
        if "Change_Pct" in df.columns:
            df["Change_Pct"] = df["Change_Pct"].apply(self._parse_change_pct)

        # Sort ascending by date
        df.sort_values("Date", inplace=True)
        df.reset_index(drop=True, inplace=True)

        required = ["Date", "Open", "High", "Low", "Close", "Volume"]
        missing = [c for c in required if c not in df.columns]
        if missing:
            raise ValueError(f"TASI CSV is missing required columns: {missing}")

        return df

    # ------------------------------------------------------------------
    # Macroeconomic data
    # ------------------------------------------------------------------

    def fetch_macro(self, start: str, end: str) -> pd.DataFrame:
        """Fetch macroeconomic indicators from yfinance.

        Parameters
        ----------
        start, end : str  — date strings like '2008-10-01'

        Returns a DataFrame indexed by Date with columns:
        Oil, SP500, Gold, DXY, Interest_Rate
        """
        frames = {}
        for name, ticker in self.MACRO_TICKERS.items():
            try:
                data = yf.download(ticker, start=start, end=end, progress=False)
                if data.empty:
                    print(f"[WARN] No data for {name} ({ticker})")
                    continue
                # yfinance may return MultiIndex columns
                if isinstance(data.columns, pd.MultiIndex):
                    data.columns = data.columns.get_level_values(0)
                frames[name] = data["Close"].rename(name)
            except Exception as e:
                print(f"[WARN] Failed to fetch {name} ({ticker}): {e}")
        if not frames:
            raise RuntimeError("Could not fetch any macroeconomic data.")

        macro = pd.concat(frames.values(), axis=1)
        macro.index.name = "Date"
        macro.reset_index(inplace=True)
        macro["Date"] = pd.to_datetime(macro["Date"])
        return macro

    # ------------------------------------------------------------------
    # Live TASI data from yfinance
    # ------------------------------------------------------------------

    TASI_TICKER = "^TASI.SR"

    def fetch_tasi_live(self, start: str = "2008-10-01") -> pd.DataFrame:
        """Fetch TASI OHLCV data directly from yfinance (no CSV needed).

        Returns DataFrame with columns: Date, Open, High, Low, Close, Volume
        """
        print(f"[INFO] Fetching TASI data from yfinance ({self.TASI_TICKER})...")
        data = yf.download(self.TASI_TICKER, start=start, progress=False)
        if data.empty:
            raise RuntimeError("Could not fetch TASI data from yfinance")

        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)

        df = data[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.index.name = "Date"
        df.reset_index(inplace=True)
        df["Date"] = pd.to_datetime(df["Date"])
        df.sort_values("Date", inplace=True)
        df.reset_index(drop=True, inplace=True)

        print(f"[INFO] Fetched {len(df)} trading days from yfinance "
              f"({df['Date'].min().date()} to {df['Date'].max().date()})")
        return df

    # ------------------------------------------------------------------
    # Supabase data loading
    # ------------------------------------------------------------------

    @staticmethod
    def load_from_supabase() -> pd.DataFrame:
        """Load TASI OHLCV data from Supabase market_data table."""
        from db.supabase_client import get_market_data
        df = get_market_data("TASI")
        if df.empty:
            raise RuntimeError("No TASI data in Supabase market_data table")
        df = df.rename(columns={
            "date": "Date", "open": "Open", "high": "High",
            "low": "Low", "close": "Close", "volume": "Volume",
        })
        df = df[["Date", "Open", "High", "Low", "Close", "Volume"]]
        df.sort_values("Date", inplace=True)
        df.reset_index(drop=True, inplace=True)
        print(f"[INFO] Loaded {len(df)} trading days from Supabase "
              f"({df['Date'].min().date()} to {df['Date'].max().date()})")
        return df

    def update_supabase(self) -> pd.DataFrame:
        """Fetch latest TASI data from yfinance and upsert into Supabase.

        Returns the full up-to-date DataFrame.
        """
        from db.supabase_client import get_market_data, upsert_market_data

        # Check what's already in Supabase
        existing = get_market_data("TASI")
        if not existing.empty:
            last_date = existing["date"].max().strftime("%Y-%m-%d")
            print(f"[INFO] Supabase has data up to {last_date}")
            # Fetch only new data (from last date onward to catch updates)
            new_data = yf.download(self.TASI_TICKER, start=last_date, progress=False)
        else:
            print("[INFO] Supabase is empty — fetching full TASI history")
            new_data = yf.download(self.TASI_TICKER, start="2008-10-01", progress=False)

        if new_data.empty:
            print("[INFO] No new TASI data from yfinance")
        else:
            if isinstance(new_data.columns, pd.MultiIndex):
                new_data.columns = new_data.columns.get_level_values(0)
            new_df = new_data[["Open", "High", "Low", "Close", "Volume"]].copy()
            new_df.index.name = "Date"
            new_df.reset_index(inplace=True)
            new_df["Date"] = pd.to_datetime(new_df["Date"])
            count = upsert_market_data(new_df, symbol="TASI")
            print(f"[INFO] Upserted {count} rows into Supabase market_data")

        # Return the full dataset from Supabase
        return self.load_from_supabase()

    # ------------------------------------------------------------------
    # Merge
    # ------------------------------------------------------------------

    def load_all(self, source: str = "csv") -> pd.DataFrame:
        """Load TASI data, fetch macro, and merge them by date.

        Parameters
        ----------
        source : str — 'csv' (from CSV file), 'api' (from yfinance),
                       'supabase' (from DB), or 'auto' (Supabase + update from API)

        Macro data is forward-filled to align with TASI trading days.
        """
        if source == "api":
            tasi = self.fetch_tasi_live()
        elif source == "supabase":
            tasi = self.load_from_supabase()
        elif source == "auto":
            tasi = self.update_supabase()
        else:
            tasi = self.load_tasi()

        start = tasi["Date"].min().strftime("%Y-%m-%d")
        end = tasi["Date"].max().strftime("%Y-%m-%d")

        macro = self.fetch_macro(start, end)

        merged = pd.merge(tasi, macro, on="Date", how="left")

        # Forward-fill macro columns (markets have different trading calendars)
        macro_cols = list(self.MACRO_TICKERS.keys())
        merged[macro_cols] = merged[macro_cols].ffill()
        # Back-fill any leading NaNs
        merged[macro_cols] = merged[macro_cols].bfill()

        print(f"[INFO] Loaded {len(merged)} trading days "
              f"({merged['Date'].min().date()} to {merged['Date'].max().date()})")
        return merged
