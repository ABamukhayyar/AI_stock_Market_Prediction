"""
Feature engineering for the linear prediction model.

Adapted from the teammate's build_dataset.py on the AI-models branch.
Computes 48 features from OHLCV + macro data for the sklearn linear model.
"""

import numpy as np
import pandas as pd
import yfinance as yf
from scipy.stats import linregress


# The 48 features expected by the trained linear model
FEATURES = [
    # TASI returns
    "return_1", "return_2", "return_3", "return_5", "return_10", "return_21",
    # Slopes
    "slope_5", "slope_10", "slope_21",
    # MA ratios
    "ma_ratio_5_20", "ma_ratio_10_50", "ma_ratio_5_10",
    # Volatility
    "volatility_5", "volatility_10", "volatility_21", "vol_ratio",
    # Technical indicators
    "rsi_14", "macd", "macd_signal", "macd_hist", "bb_position",
    # Volume
    "volume_ratio", "volume_change",
    # Regime dummies
    "rsi_overbought", "rsi_oversold", "macd_positive",
    "high_volume", "high_volatility", "trend_up",
    # Calendar
    "is_sunday", "is_thursday", "days_since_friday", "is_q4",
    # Macro
    "oil_return_1", "oil_return_5", "oil_volatility_10",
    "sp500_return_1", "sp500_return_5", "futures_return",
    "gold_return_1", "gold_return_5",
    "dxy_return_1", "dxy_return_5",
    "vix_level", "vix_change",
    # Interactions
    "oil_x_sunday", "futures_x_sunday", "return1_x_volume",
    "oil_x_volatility", "sp500_x_trend", "vix_x_return",
]


def rolling_slope(series, window):
    """Rolling linear regression slope — captures trend direction + strength."""
    def _slope(arr):
        if len(arr) < window or np.isnan(arr).any():
            return np.nan
        x = np.arange(len(arr))
        return linregress(x, arr).slope
    return series.rolling(window).apply(_slope, raw=True)


def enrich_macro_for_linear(df: pd.DataFrame) -> pd.DataFrame:
    """Fetch VIX and S&P futures (not in the CNN pipeline) and merge into df.

    The CNN pipeline already provides Oil, SP500, Gold, DXY, Interest_Rate.
    The linear model additionally needs ES=F (futures) and ^VIX.
    Also renames columns to what the linear feature builder expects.
    """
    start = df["Date"].min()

    # Map existing CNN column names → linear model names
    rename_map = {
        "Oil": "oil_close",
        "SP500": "sp500_close",
        "Gold": "gold_close",
        "DXY": "dxy_close",
    }
    for old, new in rename_map.items():
        if old in df.columns:
            df = df.rename(columns={old: new})

    # Fetch the two extra macro tickers the linear model needs
    extra_tickers = {
        "futures_close": "ES=F",
        "vix_close": "^VIX",
    }
    for col, ticker in extra_tickers.items():
        if col in df.columns:
            continue
        try:
            raw = yf.download(ticker, start=start, progress=False)
            raw = raw.reset_index()
            raw.columns = raw.columns.get_level_values(0)
            raw["Date"] = pd.to_datetime(raw["Date"]).dt.tz_localize(None)
            raw = raw.sort_values("Date").reset_index(drop=True)
            mdf = raw[["Date", "Close"]].rename(columns={"Close": col})
            # Ensure matching datetime resolution for merge_asof
            df["Date"] = pd.to_datetime(df["Date"]).dt.tz_localize(None)
            mdf["Date"] = mdf["Date"].astype(df["Date"].dtype)
            df = pd.merge_asof(
                df.sort_values("Date"),
                mdf.sort_values("Date"),
                on="Date", direction="backward",
            )
        except Exception as e:
            print(f"[WARN] Could not fetch {ticker} for linear model: {e}")
            df[col] = np.nan

    return df.sort_values("Date").reset_index(drop=True)


def build_linear_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute all 48 features for the linear model.

    Expects df to have: Date, Open, High, Low, Close, Volume,
    oil_close, sp500_close, gold_close, dxy_close, futures_close, vix_close.
    Call enrich_macro_for_linear() first to ensure these columns exist.
    """
    # --- TASI returns ---
    for lag in [1, 2, 3, 5, 10, 21]:
        df[f"return_{lag}"] = df["Close"].pct_change(lag)

    # --- Slopes (normalised by price) ---
    df["slope_5"] = rolling_slope(df["Close"], 5) / df["Close"]
    df["slope_10"] = rolling_slope(df["Close"], 10) / df["Close"]
    df["slope_21"] = rolling_slope(df["Close"], 21) / df["Close"]

    # --- MA ratios ---
    df["ma_5"] = df["Close"].rolling(5).mean()
    df["ma_10"] = df["Close"].rolling(10).mean()
    df["ma_20"] = df["Close"].rolling(20).mean()
    df["ma_50"] = df["Close"].rolling(50).mean()
    df["ma_ratio_5_20"] = df["ma_5"] / df["ma_20"]
    df["ma_ratio_10_50"] = df["ma_10"] / df["ma_50"]
    df["ma_ratio_5_10"] = df["ma_5"] / df["ma_10"]

    # --- Volatility ---
    df["volatility_5"] = df["return_1"].rolling(5).std()
    df["volatility_10"] = df["return_1"].rolling(10).std()
    df["volatility_21"] = df["return_1"].rolling(21).std()
    df["vol_ratio"] = df["volatility_5"] / df["volatility_21"]

    # --- RSI (14) ---
    delta = df["Close"].diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    df["rsi_14"] = 100 - (100 / (1 + gain / loss))

    # --- MACD (normalised by price) ---
    ema_12 = df["Close"].ewm(span=12, adjust=False).mean()
    ema_26 = df["Close"].ewm(span=26, adjust=False).mean()
    df["macd"] = (ema_12 - ema_26) / df["Close"]
    df["macd_signal"] = ((ema_12 - ema_26).ewm(span=9, adjust=False).mean()) / df["Close"]
    df["macd_hist"] = df["macd"] - df["macd_signal"]

    # --- Bollinger band position ---
    bb_mid = df["Close"].rolling(20).mean()
    bb_std = df["Close"].rolling(20).std()
    df["bb_position"] = (df["Close"] - (bb_mid - 2 * bb_std)) / (4 * bb_std)

    # --- Volume ---
    df["volume_ratio"] = df["Volume"] / df["Volume"].rolling(20).mean()
    df["volume_change"] = df["Volume"].pct_change(1)

    # --- Regime dummies ---
    df["rsi_overbought"] = (df["rsi_14"] > 70).astype(int)
    df["rsi_oversold"] = (df["rsi_14"] < 30).astype(int)
    df["macd_positive"] = (df["macd_hist"] > 0).astype(int)
    df["high_volume"] = (df["volume_ratio"] > 1.5).astype(int)
    df["high_volatility"] = (df["vol_ratio"] > 1.3).astype(int)
    df["trend_up"] = (df["ma_ratio_5_20"] > 1).astype(int)

    # --- Calendar ---
    df["is_sunday"] = (df["Date"].dt.dayofweek == 6).astype(int)
    df["is_thursday"] = (df["Date"].dt.dayofweek == 3).astype(int)
    df["days_since_friday"] = df["Date"].dt.dayofweek.map(
        {6: 2, 0: 3, 1: 1, 2: 1, 3: 1, 4: 1}
    )
    df["is_q4"] = (df["Date"].dt.month >= 10).astype(int)

    # --- Macro returns ---
    df["oil_return_1"] = df["oil_close"].pct_change(1)
    df["oil_return_5"] = df["oil_close"].pct_change(5)
    df["oil_volatility_10"] = df["oil_return_1"].rolling(10).std()
    df["sp500_return_1"] = df["sp500_close"].pct_change(1)
    df["sp500_return_5"] = df["sp500_close"].pct_change(5)
    df["futures_return"] = df["futures_close"].pct_change(1)
    df["gold_return_1"] = df["gold_close"].pct_change(1)
    df["gold_return_5"] = df["gold_close"].pct_change(5)
    df["dxy_return_1"] = df["dxy_close"].pct_change(1)
    df["dxy_return_5"] = df["dxy_close"].pct_change(5)
    df["vix_level"] = df["vix_close"]
    df["vix_change"] = df["vix_close"].pct_change(1)

    # --- Interaction terms ---
    df["oil_x_sunday"] = df["oil_return_1"] * df["is_sunday"]
    df["futures_x_sunday"] = df["futures_return"] * df["is_sunday"]
    df["return1_x_volume"] = df["return_1"] * df["volume_ratio"]
    df["oil_x_volatility"] = df["oil_return_1"] * df["volatility_10"]
    df["sp500_x_trend"] = df["sp500_return_1"] * df["trend_up"]
    df["vix_x_return"] = df["vix_change"] * df["return_1"]

    # Clean inf values
    df = df.replace([np.inf, -np.inf], np.nan)

    return df
