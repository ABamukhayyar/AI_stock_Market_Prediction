# ================================
# predict.py
# TASI Next-Day Return Predictor
# ================================

import yfinance as yf
import pandas as pd
import numpy as np
import joblib
from datetime import datetime, timedelta


# -------------------------------
# 1. Load Saved Model & Scaler
# -------------------------------

model  = joblib.load("tasi_model.pkl")
scaler = joblib.load("tasi_scaler.pkl")

FEATURES = [
    "return_1", "return_2", "return_5", "return_10",
    "ma_ratio_5_20", "ma_ratio_20_50",
    "volatility_10", "volatility_20",
    "rsi_14", "macd", "bb_position", "volume_ratio",
    "oil_return_1", "oil_return_5", "oil_volatility_10",
    "sp500_return_1"
]


# -------------------------------
# 2. Fetch Latest Data
# (enough history to compute rolling features)
# -------------------------------

end_date   = datetime.today()
start_date = end_date - timedelta(days=120)  # 120 days buffer for rolling windows

print("Fetching latest market data...")

tasi  = yf.download("^TASI.SR", start=start_date, progress=False)
oil   = yf.download("BZ=F",     start=start_date, progress=False)
sp500 = yf.download("^GSPC",    start=start_date, progress=False)

# Flatten and clean
def clean(df, col_name):
    df = df.reset_index()
    df.columns = df.columns.get_level_values(0)
    df["Date"] = pd.to_datetime(df["Date"])
    return df.sort_values("Date").reset_index(drop=True)[["Date", "Close"]].rename(columns={"Close": col_name})

tasi_df  = tasi.reset_index()
tasi_df.columns = tasi_df.columns.get_level_values(0)
tasi_df["Date"] = pd.to_datetime(tasi_df["Date"])
tasi_df  = tasi_df.sort_values("Date").reset_index(drop=True)

oil_df   = clean(oil,   "oil_close")
sp500_df = clean(sp500, "sp500_close")

# Merge
df = tasi_df[["Date", "Open", "High", "Low", "Close", "Volume"]].copy()
df = pd.merge_asof(df.sort_values("Date"), oil_df.sort_values("Date"),   on="Date", direction="backward")
df = pd.merge_asof(df.sort_values("Date"), sp500_df.sort_values("Date"), on="Date", direction="backward")
df = df.sort_values("Date").reset_index(drop=True)


# -------------------------------
# 3. Compute Features
# -------------------------------

df["return_1"]  = df["Close"].pct_change(1)
df["return_2"]  = df["Close"].pct_change(2)
df["return_5"]  = df["Close"].pct_change(5)
df["return_10"] = df["Close"].pct_change(10)

df["ma_5"]  = df["Close"].rolling(5).mean()
df["ma_20"] = df["Close"].rolling(20).mean()
df["ma_50"] = df["Close"].rolling(50).mean()
df["ma_ratio_5_20"]  = df["ma_5"]  / df["ma_20"]
df["ma_ratio_20_50"] = df["ma_20"] / df["ma_50"]

df["volatility_10"] = df["return_1"].rolling(10).std()
df["volatility_20"] = df["return_1"].rolling(20).std()

delta = df["Close"].diff()
gain  = delta.clip(lower=0).rolling(14).mean()
loss  = (-delta.clip(upper=0)).rolling(14).mean()
df["rsi_14"] = 100 - (100 / (1 + gain / loss))

ema_12 = df["Close"].ewm(span=12, adjust=False).mean()
ema_26 = df["Close"].ewm(span=26, adjust=False).mean()
df["macd"] = ema_12 - ema_26

bb_mid = df["Close"].rolling(20).mean()
bb_std = df["Close"].rolling(20).std()
df["bb_position"] = (df["Close"] - (bb_mid - 2 * bb_std)) / (4 * bb_std)

df["volume_ratio"] = df["Volume"] / df["Volume"].rolling(20).mean()

df["oil_return_1"]      = df["oil_close"].pct_change(1)
df["oil_return_5"]      = df["oil_close"].pct_change(5)
df["oil_volatility_10"] = df["oil_return_1"].rolling(10).std()

df["sp500_return_1"] = df["sp500_close"].pct_change(1)

df = df.dropna().reset_index(drop=True)


# -------------------------------
# 4. Predict on Latest Row
# -------------------------------

latest = df.iloc[[-1]]  # most recent trading day
latest_date = latest["Date"].values[0]
latest_close = latest["Close"].values[0]

X_latest = latest[FEATURES]
X_scaled  = scaler.transform(X_latest)

predicted_return = model.predict(X_scaled)[0]
predicted_close  = latest_close * (1 + predicted_return)
direction        = "📈 UP" if predicted_return > 0 else "📉 DOWN"


# -------------------------------
# 5. Output
# -------------------------------

print("\n========================================")
print("        TASI Next-Day Prediction        ")
print("========================================")
print(f"  Latest data date   : {pd.Timestamp(latest_date).date()}")
print(f"  Latest close       : {latest_close:,.2f}")
print(f"  Predicted return   : {predicted_return * 100:.4f}%")
print(f"  Predicted close    : {predicted_close:,.2f}")
print(f"  Direction          : {direction}")
print("========================================")
print("\n⚠️  This is a statistical model, not financial advice.")
