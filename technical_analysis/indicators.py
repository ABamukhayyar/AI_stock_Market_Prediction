"""
TechnicalAnalysisService — computes technical indicators using the `ta` library.

All indicators use correct, standard formulations.
ATR uses REAL True Range (High, Low, Previous Close) — NOT the fake 0.02*Price.
"""

import pandas as pd
import ta


class TechnicalAnalysisService:
    """Compute technical indicators and append them as new columns."""

    @staticmethod
    def add_all(df: pd.DataFrame) -> pd.DataFrame:
        """Add all technical indicators to the DataFrame.

        Expects columns: Open, High, Low, Close, Volume.
        Returns the DataFrame with new columns added.
        """
        df = df.copy()

        # RSI (14)
        df["RSI"] = ta.momentum.RSIIndicator(
            close=df["Close"], window=14
        ).rsi()

        # MACD (12, 26, 9)
        macd_ind = ta.trend.MACD(
            close=df["Close"], window_slow=26, window_fast=12, window_sign=9
        )
        df["MACD"] = macd_ind.macd()

        # ATR (14) — REAL True Range using High, Low, Close
        df["ATR"] = ta.volatility.AverageTrueRange(
            high=df["High"], low=df["Low"], close=df["Close"], window=14
        ).average_true_range()

        # Bollinger Width
        bb = ta.volatility.BollingerBands(
            close=df["Close"], window=20, window_dev=2
        )
        upper = bb.bollinger_hband()
        lower = bb.bollinger_lband()
        middle = bb.bollinger_mavg()
        df["Bollinger_Width"] = (upper - lower) / middle

        # SMA 50
        df["SMA_50"] = ta.trend.SMAIndicator(
            close=df["Close"], window=50
        ).sma_indicator()

        # EMA 20
        df["EMA_20"] = ta.trend.EMAIndicator(
            close=df["Close"], window=20
        ).ema_indicator()

        return df
