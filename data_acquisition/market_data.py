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
    # Merge
    # ------------------------------------------------------------------

    def load_all(self) -> pd.DataFrame:
        """Load TASI data, fetch macro, and merge them by date.

        Macro data is forward-filled to align with TASI trading days.
        """
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
