# ============================================================
# build_dataset.py — Enhanced TASI Feature Dataset Builder
# Designed for maximum linear-model performance without overfit
# ============================================================

import yfinance as yf
import pandas as pd
import numpy as np
from scipy.stats import linregress


# ==============================================================
# 1. Download Raw Data
# ==============================================================

def download_all(start="2010-01-01"):
    """Download TASI + macro data from yfinance."""

    def _clean(raw, col_name):
        raw = raw.reset_index()
        raw.columns = raw.columns.get_level_values(0)
        raw["Date"] = pd.to_datetime(raw["Date"])
        raw = raw.sort_values("Date").reset_index(drop=True)
        return raw[["Date", "Close"]].rename(columns={"Close": col_name})

    print("Downloading TASI...")
    tasi = yf.download("^TASI.SR", start=start, progress=False)
    tasi = tasi.reset_index()
    tasi.columns = tasi.columns.get_level_values(0)
    tasi["Date"] = pd.to_datetime(tasi["Date"])
    tasi = tasi.sort_values("Date").reset_index(drop=True)

    tickers = {
        "oil_close":     "BZ=F",       # Brent Crude
        "sp500_close":   "^GSPC",      # S&P 500
        "futures_close":  "ES=F",      # S&P 500 Futures
        "gold_close":    "GC=F",       # Gold
        "dxy_close":     "DX-Y.NYB",   # Dollar Index
        "vix_close":     "^VIX",       # Volatility Index
    }

    macro = {}
    for col, ticker in tickers.items():
        print(f"Downloading {col} ({ticker})...")
        raw = yf.download(ticker, start=start, progress=False)
        macro[col] = _clean(raw, col)

    # Merge everything onto TASI dates
    df = tasi[["Date", "Open", "High", "Low", "Close", "Volume"]].copy()
    for col, mdf in macro.items():
        df = pd.merge_asof(
            df.sort_values("Date"),
            mdf.sort_values("Date"),
            on="Date", direction="backward"
        )

    df = df.sort_values("Date").reset_index(drop=True)
    return df


# ==============================================================
# 2. Feature Engineering
# ==============================================================

def rolling_slope(series, window):
    """Rolling linear regression slope — captures trend direction + strength."""
    def _slope(arr):
        if len(arr) < window or np.isnan(arr).any():
            return np.nan
        x = np.arange(len(arr))
        return linregress(x, arr).slope
    return series.rolling(window).apply(_slope, raw=True)


def add_features(df):
    """Build all features for the linear model."""

    # ----------------------------------------------------------
    # A. TASI Core Features
    # ----------------------------------------------------------

    # Return lags
    for lag in [1, 2, 3, 5, 10, 21]:
        df[f"return_{lag}"] = df["Close"].pct_change(lag)

    # Rolling slopes (trend direction — smoother than raw returns)
    df["slope_5"]  = rolling_slope(df["Close"], 5)
    df["slope_10"] = rolling_slope(df["Close"], 10)
    df["slope_21"] = rolling_slope(df["Close"], 21)

    # Normalize slopes by price level so they're comparable across time
    df["slope_5"]  = df["slope_5"]  / df["Close"]
    df["slope_10"] = df["slope_10"] / df["Close"]
    df["slope_21"] = df["slope_21"] / df["Close"]

    # Moving average ratios
    df["ma_5"]  = df["Close"].rolling(5).mean()
    df["ma_10"] = df["Close"].rolling(10).mean()
    df["ma_20"] = df["Close"].rolling(20).mean()
    df["ma_50"] = df["Close"].rolling(50).mean()
    df["ma_ratio_5_20"]   = df["ma_5"]  / df["ma_20"]
    df["ma_ratio_10_50"]  = df["ma_10"] / df["ma_50"]
    df["ma_ratio_5_10"]   = df["ma_5"]  / df["ma_10"]

    # Volatility
    df["volatility_5"]  = df["return_1"].rolling(5).std()
    df["volatility_10"] = df["return_1"].rolling(10).std()
    df["volatility_21"] = df["return_1"].rolling(21).std()
    df["vol_ratio"]     = df["volatility_5"] / df["volatility_21"]  # vol regime

    # RSI (14-day)
    delta = df["Close"].diff()
    gain  = delta.clip(lower=0).rolling(14).mean()
    loss  = (-delta.clip(upper=0)).rolling(14).mean()
    rs    = gain / loss
    df["rsi_14"] = 100 - (100 / (1 + rs))

    # MACD
    ema_12 = df["Close"].ewm(span=12, adjust=False).mean()
    ema_26 = df["Close"].ewm(span=26, adjust=False).mean()
    df["macd"]        = ema_12 - ema_26
    df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()
    df["macd_hist"]   = df["macd"] - df["macd_signal"]

    # Normalize MACD by price
    df["macd"]        = df["macd"]        / df["Close"]
    df["macd_signal"] = df["macd_signal"] / df["Close"]
    df["macd_hist"]   = df["macd_hist"]   / df["Close"]

    # Bollinger Band position
    bb_mid   = df["Close"].rolling(20).mean()
    bb_std   = df["Close"].rolling(20).std()
    bb_upper = bb_mid + 2 * bb_std
    bb_lower = bb_mid - 2 * bb_std
    df["bb_position"] = (df["Close"] - bb_lower) / (bb_upper - bb_lower)

    # Volume features
    df["volume_ratio"]  = df["Volume"] / df["Volume"].rolling(20).mean()
    df["volume_change"] = df["Volume"].pct_change(1)

    # ----------------------------------------------------------
    # B. Regime Dummies (help linear models find thresholds)
    # ----------------------------------------------------------

    df["rsi_overbought"]   = (df["rsi_14"] > 70).astype(int)
    df["rsi_oversold"]     = (df["rsi_14"] < 30).astype(int)
    df["macd_positive"]    = (df["macd_hist"] > 0).astype(int)
    df["high_volume"]      = (df["volume_ratio"] > 1.5).astype(int)
    df["high_volatility"]  = (df["vol_ratio"] > 1.3).astype(int)
    df["trend_up"]         = (df["ma_ratio_5_20"] > 1).astype(int)

    # ----------------------------------------------------------
    # C. Calendar Features
    # ----------------------------------------------------------

    df["day_of_week"]        = df["Date"].dt.dayofweek
    df["is_sunday"]          = (df["day_of_week"] == 6).astype(int)
    df["is_thursday"]        = (df["day_of_week"] == 3).astype(int)
    df["days_since_friday"]  = df["day_of_week"].map(
        {6: 2, 0: 3, 1: 1, 2: 1, 3: 1, 4: 1}
    )
    df["month"] = df["Date"].dt.month
    df["is_q4"] = (df["month"] >= 10).astype(int)  # end-of-year effects

    # ----------------------------------------------------------
    # D. Macro Features
    # ----------------------------------------------------------

    # Oil
    df["oil_return_1"]      = df["oil_close"].pct_change(1)
    df["oil_return_5"]      = df["oil_close"].pct_change(5)
    df["oil_volatility_10"] = df["oil_return_1"].rolling(10).std()

    # S&P 500
    df["sp500_return_1"]    = df["sp500_close"].pct_change(1)
    df["sp500_return_5"]    = df["sp500_close"].pct_change(5)

    # S&P Futures (weekend gap signal)
    df["futures_return"]    = df["futures_close"].pct_change(1)

    # Gold
    df["gold_return_1"]     = df["gold_close"].pct_change(1)
    df["gold_return_5"]     = df["gold_close"].pct_change(5)

    # Dollar Index
    df["dxy_return_1"]      = df["dxy_close"].pct_change(1)
    df["dxy_return_5"]      = df["dxy_close"].pct_change(5)

    # VIX (level, not return — VIX is already mean-reverting)
    df["vix_level"]         = df["vix_close"]
    df["vix_change"]        = df["vix_close"].pct_change(1)

    # ----------------------------------------------------------
    # E. Interaction Terms (key for linear models)
    # ----------------------------------------------------------

    df["oil_x_sunday"]       = df["oil_return_1"]  * df["is_sunday"]
    df["futures_x_sunday"]   = df["futures_return"] * df["is_sunday"]
    df["return1_x_volume"]   = df["return_1"]       * df["volume_ratio"]
    df["oil_x_volatility"]   = df["oil_return_1"]   * df["volatility_10"]
    df["sp500_x_trend"]      = df["sp500_return_1"] * df["trend_up"]
    df["vix_x_return"]       = df["vix_change"]     * df["return_1"]

    # ----------------------------------------------------------
    # F. Target
    # ----------------------------------------------------------

    df["target_return"] = df["return_1"].shift(-1)

    # Clean inf values from division-by-zero (vol_ratio, pct_change, etc.)
    df = df.replace([np.inf, -np.inf], np.nan)

    return df


# ==============================================================
# 3. Feature List
# ==============================================================

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


# ==============================================================
# 4. Build & Save
# ==============================================================

if __name__ == "__main__":
    df = download_all()
    df = add_features(df)

    # Drop intermediate columns
    drop_cols = [
        "Open", "High", "Low",
        "ma_5", "ma_10", "ma_20", "ma_50",
        "oil_close", "sp500_close", "futures_close",
        "gold_close", "dxy_close", "vix_close",
        "day_of_week", "month",
    ]
    df = df.drop(columns=[c for c in drop_cols if c in df.columns])
    df = df.dropna().reset_index(drop=True)

    output_path = "tasi_dataset_v2.csv"
    df.to_csv(output_path, index=False)

    print(f"\n✅ Dataset saved to: {output_path}")
    print(f"   Rows      : {len(df)}")
    print(f"   Features  : {len(FEATURES)}")
    print(f"   Date range: {df['Date'].min().date()} → {df['Date'].max().date()}")
    print(f"\nFeature list ({len(FEATURES)}):")
    for f in FEATURES:
        print(f"   - {f}")
