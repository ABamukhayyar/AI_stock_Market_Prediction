# ============================================================
# predict.py — TASI Next-Day Prediction (Linear Model)
# ============================================================

import yfinance as yf
import pandas as pd
import numpy as np
import joblib
import json
from datetime import datetime, timedelta
from scipy.stats import linregress


# ==============================================================
# 1. Load Model & Metadata
# ==============================================================

model    = joblib.load("tasi_linear_model.pkl")
scaler   = joblib.load("tasi_linear_scaler.pkl")

with open("tasi_linear_metadata.json") as f:
    metadata = json.load(f)

FEATURES   = metadata["features"]
MODEL_TYPE = metadata["model_type"]


# ==============================================================
# 2. Fetch Latest Data (same logic as build_dataset)
# ==============================================================

end_date   = datetime.today()
start_date = end_date - timedelta(days=180)  # need 180 for 50-day MA + warmup

print("Fetching latest market data...")

def _download(ticker, col_name):
    raw = yf.download(ticker, start=start_date, progress=False)
    raw = raw.reset_index()
    raw.columns = raw.columns.get_level_values(0)
    raw["Date"] = pd.to_datetime(raw["Date"])
    raw = raw.sort_values("Date").reset_index(drop=True)
    return raw[["Date", "Close"]].rename(columns={"Close": col_name})

tasi = yf.download("^TASI.SR", start=start_date, progress=False)
tasi = tasi.reset_index()
tasi.columns = tasi.columns.get_level_values(0)
tasi["Date"] = pd.to_datetime(tasi["Date"])
tasi = tasi.sort_values("Date").reset_index(drop=True)

macro_tickers = {
    "oil_close":     "BZ=F",
    "sp500_close":   "^GSPC",
    "futures_close": "ES=F",
    "gold_close":    "GC=F",
    "dxy_close":     "DX-Y.NYB",
    "vix_close":     "^VIX",
}

df = tasi[["Date", "Open", "High", "Low", "Close", "Volume"]].copy()
for col, ticker in macro_tickers.items():
    mdf = _download(ticker, col)
    df = pd.merge_asof(
        df.sort_values("Date"),
        mdf.sort_values("Date"),
        on="Date", direction="backward"
    )
df = df.sort_values("Date").reset_index(drop=True)


# ==============================================================
# 3. Compute Features (mirrors build_dataset.py exactly)
# ==============================================================

def rolling_slope(series, window):
    def _slope(arr):
        if len(arr) < window or np.isnan(arr).any():
            return np.nan
        x = np.arange(len(arr))
        return linregress(x, arr).slope
    return series.rolling(window).apply(_slope, raw=True)

# Returns
for lag in [1, 2, 3, 5, 10, 21]:
    df[f"return_{lag}"] = df["Close"].pct_change(lag)

# Slopes
df["slope_5"]  = rolling_slope(df["Close"], 5)  / df["Close"]
df["slope_10"] = rolling_slope(df["Close"], 10) / df["Close"]
df["slope_21"] = rolling_slope(df["Close"], 21) / df["Close"]

# MA ratios
df["ma_5"]  = df["Close"].rolling(5).mean()
df["ma_10"] = df["Close"].rolling(10).mean()
df["ma_20"] = df["Close"].rolling(20).mean()
df["ma_50"] = df["Close"].rolling(50).mean()
df["ma_ratio_5_20"]  = df["ma_5"]  / df["ma_20"]
df["ma_ratio_10_50"] = df["ma_10"] / df["ma_50"]
df["ma_ratio_5_10"]  = df["ma_5"]  / df["ma_10"]

# Volatility
df["volatility_5"]  = df["return_1"].rolling(5).std()
df["volatility_10"] = df["return_1"].rolling(10).std()
df["volatility_21"] = df["return_1"].rolling(21).std()
df["vol_ratio"]     = df["volatility_5"] / df["volatility_21"]

# RSI
delta = df["Close"].diff()
gain  = delta.clip(lower=0).rolling(14).mean()
loss  = (-delta.clip(upper=0)).rolling(14).mean()
df["rsi_14"] = 100 - (100 / (1 + gain / loss))

# MACD
ema_12 = df["Close"].ewm(span=12, adjust=False).mean()
ema_26 = df["Close"].ewm(span=26, adjust=False).mean()
df["macd"]        = (ema_12 - ema_26) / df["Close"]
df["macd_signal"] = ((ema_12 - ema_26).ewm(span=9, adjust=False).mean()) / df["Close"]
df["macd_hist"]   = df["macd"] - df["macd_signal"]

# Bollinger
bb_mid = df["Close"].rolling(20).mean()
bb_std = df["Close"].rolling(20).std()
df["bb_position"] = (df["Close"] - (bb_mid - 2*bb_std)) / (4*bb_std)

# Volume
df["volume_ratio"]  = df["Volume"] / df["Volume"].rolling(20).mean()
df["volume_change"] = df["Volume"].pct_change(1)

# Regime dummies
df["rsi_overbought"]  = (df["rsi_14"] > 70).astype(int)
df["rsi_oversold"]    = (df["rsi_14"] < 30).astype(int)
df["macd_positive"]   = (df["macd_hist"] > 0).astype(int)
df["high_volume"]     = (df["volume_ratio"] > 1.5).astype(int)
df["high_volatility"] = (df["vol_ratio"] > 1.3).astype(int)
df["trend_up"]        = (df["ma_ratio_5_20"] > 1).astype(int)

# Calendar
df["is_sunday"]         = (df["Date"].dt.dayofweek == 6).astype(int)
df["is_thursday"]       = (df["Date"].dt.dayofweek == 3).astype(int)
df["days_since_friday"] = df["Date"].dt.dayofweek.map(
    {6: 2, 0: 3, 1: 1, 2: 1, 3: 1, 4: 1}
)
df["is_q4"] = (df["Date"].dt.month >= 10).astype(int)

# Macro
df["oil_return_1"]      = df["oil_close"].pct_change(1)
df["oil_return_5"]      = df["oil_close"].pct_change(5)
df["oil_volatility_10"] = df["oil_return_1"].rolling(10).std()
df["sp500_return_1"]    = df["sp500_close"].pct_change(1)
df["sp500_return_5"]    = df["sp500_close"].pct_change(5)
df["futures_return"]    = df["futures_close"].pct_change(1)
df["gold_return_1"]     = df["gold_close"].pct_change(1)
df["gold_return_5"]     = df["gold_close"].pct_change(5)
df["dxy_return_1"]      = df["dxy_close"].pct_change(1)
df["dxy_return_5"]      = df["dxy_close"].pct_change(5)
df["vix_level"]         = df["vix_close"]
df["vix_change"]        = df["vix_close"].pct_change(1)

# Interactions
df["oil_x_sunday"]     = df["oil_return_1"]  * df["is_sunday"]
df["futures_x_sunday"] = df["futures_return"] * df["is_sunday"]
df["return1_x_volume"] = df["return_1"]       * df["volume_ratio"]
df["oil_x_volatility"] = df["oil_return_1"]   * df["volatility_10"]
df["sp500_x_trend"]    = df["sp500_return_1"] * df["trend_up"]
df["vix_x_return"]     = df["vix_change"]     * df["return_1"]

df = df.dropna().reset_index(drop=True)


# ==============================================================
# 4. Drop Incomplete Candle if Market Still Open
# ==============================================================

now_riyadh = datetime.utcnow() + timedelta(hours=3)
today = now_riyadh.date()
last_date = pd.Timestamp(df["Date"].iloc[-1]).date()

if last_date == today and now_riyadh.hour < 15:
    print(f"⚠️  Market still open — dropping today's incomplete candle ({today})")
    df = df.iloc[:-1].reset_index(drop=True)


# ==============================================================
# 5. Predict
# ==============================================================

latest       = df.iloc[[-1]]
latest_date  = latest["Date"].values[0]
latest_close = latest["Close"].values[0]

X_latest = latest[FEATURES]
X_scaled = scaler.transform(X_latest)

# Get prediction (and uncertainty if BayesianRidge)
if MODEL_TYPE == "BayesianRidge" and hasattr(model, "predict"):
    predicted_return, pred_std = model.predict(X_scaled, return_std=True)
    predicted_return = predicted_return[0]
    pred_std = pred_std[0]
else:
    predicted_return = model.predict(X_scaled)[0]
    pred_std = None

predicted_close = latest_close * (1 + predicted_return)
direction = "📈 UP" if predicted_return > 0 else "📉 DOWN"

# Signal strength
signal_strength = abs(predicted_return)
if signal_strength > 0.005:
    confidence = "STRONG"
elif signal_strength > 0.002:
    confidence = "MODERATE"
else:
    confidence = "WEAK"


# ==============================================================
# 6. Output
# ==============================================================

print(f"\n{'='*50}")
print(f"   TASI Next-Day Prediction ({MODEL_TYPE})")
print(f"{'='*50}")
print(f"  Latest data date   : {pd.Timestamp(latest_date).date()}")
print(f"  Latest close       : {latest_close:,.2f}")
print(f"  Predicted return   : {predicted_return * 100:+.4f}%")
print(f"  Predicted close    : {predicted_close:,.2f}")
print(f"  Direction          : {direction}")
print(f"  Signal strength    : {confidence} ({signal_strength*100:.4f}%)")

if pred_std is not None:
    ci_low  = latest_close * (1 + predicted_return - 1.96 * pred_std)
    ci_high = latest_close * (1 + predicted_return + 1.96 * pred_std)
    print(f"  95% CI             : {ci_low:,.2f} — {ci_high:,.2f}")

if latest["is_sunday"].values[0]:
    print(f"  ⚠️  Sunday prediction — futures signal active")

print(f"{'='*50}")

