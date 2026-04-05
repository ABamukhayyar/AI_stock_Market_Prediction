# Insight Project — Complete Guide

## Project File Map

```
Insight/
├── .env                              <- Supabase credentials (not in git)
├── TASI_Historical_Data.csv          <- Backup TASI data (Oct 2008 - Sep 2024)
├── requirements.txt                  <- Python dependencies
├── data_acquisition/
│   └── market_data.py                <- Loads data from CSV, yfinance API, or Supabase
├── technical_analysis/
│   └── indicators.py                 <- Computes RSI, MACD, ATR, Bollinger, SMA, EMA
├── preprocessing/
│   └── engine.py                     <- Wavelet denoising, outlier capping, scaling, sequencing
├── prediction/
│   └── engine.py                     <- CNN-BiLSTM-Attention model (build/train/predict)
├── sentiment/
│   └── analyzer.py                   <- News fetch, translate Arabic, score with FinBERT
├── db/
│   └── supabase_client.py            <- Supabase connection + all DB operations
├── train_model.py                    <- MAIN: trains the model end-to-end
├── predict.py                        <- Makes a next-day price prediction (fully automated)
├── evaluate.py                       <- Full evaluation + backtest + plots
├── models/
│   ├── TASI_Model_v3.keras           <- Trained model
│   ├── TASI_Scaler_v3.pkl            <- Fitted RobustScaler
│   ├── opus-mt-ar-en/                <- Cached Arabic→English translation model
│   └── finbert/                      <- Cached FinBERT sentiment model
└── notebooks/                        <- Old Jupyter experiments (not needed)
```

---

## How to Run It

### Step 0: Install dependencies
```
pip install -r requirements.txt
```

### Step 1: Set up .env
Create a `.env` file in the project root:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

### Step 2: Train the model (only needed once)
```
python train_model.py
```
This runs the full pipeline (~10-30 min). It:
  1. Loads TASI CSV + downloads macro data from yfinance
  2. Merges sentiment data from Supabase (neutral defaults if none exists)
  3. Computes all technical indicators
  4. Applies wavelet denoising + converts to returns + caps outliers
  5. Splits data chronologically (70/15/15)
  6. Fits scaler on training data only
  7. Builds and trains the CNN-BiLSTM-Attention model (19 features)
  8. Saves model to models/TASI_Model_v3.keras and scaler to models/TASI_Scaler_v3.pkl
  9. Prints test metrics (MAE, RMSE, MAPE, R2) and saves plots

### Step 3: Predict tomorrow's close (run daily)
```
python predict.py
```
This is fully automated — no manual downloads needed. It:
  1. Fetches latest TASI data from yfinance API (`^TASI.SR`)
  2. Updates Supabase `market_data` with any new rows
  3. Fetches macroeconomic indicators (Oil, S&P 500, Gold, DXY, Interest Rate)
  4. Runs live sentiment analysis on today's news (Google News RSS)
  5. Stores sentiment in Supabase `sentiment_analysis`
  6. Computes technical indicators + preprocesses
  7. Predicts next trading day's close
  8. Stores prediction in Supabase `ai_predictions`

Output:
```
==================================================
  Based on data up to: 2026-04-02
  Predicting for:      2026-04-03
  Predicted TASI Close: 11,123.97 SAR
==================================================
```

Options:
```
python predict.py --no-sentiment    # Skip sentiment (faster)
```

### Step 4: Full evaluation (optional)
```
python evaluate.py
```

---

## What Each File Does

### 1. data_acquisition/market_data.py — Data Acquisition

DataAcquisitionService class:
  - load_tasi()         → Reads TASI_Historical_Data.csv (backup source)
  - fetch_tasi_live()   → Fetches TASI from yfinance API (^TASI.SR)
  - load_from_supabase()→ Reads from Supabase market_data table
  - update_supabase()   → Fetches new data from yfinance, upserts into Supabase
  - fetch_macro()       → Downloads 5 macro indicators via yfinance
  - load_all(source)    → Merges TASI + macro data by date
    - source="csv"      → from CSV file (training)
    - source="auto"     → from Supabase + update from API (prediction)
    - source="api"      → directly from yfinance
    - source="supabase" → from Supabase only

### 2. technical_analysis/indicators.py — Technical Analysis

TechnicalAnalysisService.add_all(df) adds 6 indicators using the 'ta' library:
  RSI (14), MACD, ATR (14), Bollinger Width, SMA_50, EMA_20

### 3. preprocessing/engine.py — Preprocessing

PreprocessingEngine class handles:
  1. Wavelet Denoising (db4 wavelet, level 2)
  2. Returns Conversion (price→pct_change for stationarity)
     - Sentiment columns are NOT converted (already stationary)
  3. Outlier Capping (IQR-based, 3x)
  4. Scaling (RobustScaler, fit on training data only)
  5. Sequence Creation (60-day sliding windows)

### 4. prediction/engine.py — The Model

CNN-BiLSTM-Attention architecture:
```
Input (60, 19) → Conv1D(32) → MaxPool → Conv1D(64) → MaxPool
  → BiLSTM(64) → Dropout(0.4) → MultiHeadAttention(4 heads)
  → BiLSTM(32) → Dropout(0.4) → Dense(32) → Dense(16) → Dense(1)
```

### 5. sentiment/analyzer.py — Sentiment Analysis

SentimentAnalyzer class:
  - _fetch_articles()     → Fetches from 17 Google News RSS feeds (8 AR + 9 EN)
  - _translate_ar_to_en() → Translates Arabic using MarianMT (Helsinki-NLP/opus-mt-ar-en)
  - _score_arabic_lexicon()→ Scores Arabic text using 70+ word financial lexicon
  - _score_finbert()      → Scores English text using ProsusAI/finbert
  - analyze()             → Full pipeline: fetch → translate → score → aggregate
  - analyze_and_store()   → analyze() + store result in Supabase

Scoring: Arabic articles use hybrid (60% lexicon + 40% FinBERT), English use pure FinBERT.
Output: score (-100 to 100), confidence, label (Bullish/Neutral/Bearish), encoded (-1/0/1)

### 6. db/supabase_client.py — Database Operations

All Supabase read/write operations:
  - get_market_data() / upsert_market_data()
  - get_sentiment() / upsert_sentiment()
  - upsert_technical_indicators()
  - register_model()
  - insert_prediction()
  - log_accuracy()

### 7. train_model.py — Training Orchestrator

ModelTrainer.run() calls everything in order:
  load data → merge sentiment → indicators → denoise → returns → outlier cap →
  split/scale/sequence → build model → train → evaluate → save.

### 8. predict.py — Inference (Daily Use)

Fully automated: fetches data from API → updates Supabase → runs sentiment →
predicts → stores result. Shows target date and predicted price.

### 9. evaluate.py — Evaluation

Runs comprehensive checks: test metrics, lag check, range check, determinism check.

---

## Supabase Database Schema

| Table                  | Key Columns                                           |
|------------------------|-------------------------------------------------------|
| `stocks`               | symbol (PK), company_name, sector, is_active          |
| `market_data`          | id, symbol (FK), date, open, high, low, close, volume |
| `technical_indicators` | id, symbol (FK), date, rsi_14, macd, atr_14, sma_50, ema_20, bollinger_width |
| `sentiment_analysis`   | id, symbol (FK), date, sentiment_score, confidence, sentiment_label, sentiment_encoded, positive/negative/neutral_articles, data_quality |
| `ai_models`            | model_id (PK), model_name, version, type, prediction_horizon |
| `ai_predictions`       | prediction_id (PK), model_id (FK), symbol (FK), target_date, predicted_close, used_sentiment_data |
| `model_accuracy_log`   | log_id (PK), prediction_id (FK), actual_close, error_percentage |
| `users`                | user_id (PK), name, email, role                       |
| `user_watchlists`      | watchlist_id (PK), user_id (FK), symbol (FK)          |

---

## Training Configuration

  Setting               Value               Reason
  -------               -----               ------
  Loss                  Huber (delta=1.0)   Handles volatility spikes
  Optimizer             Adam (lr=0.001)     Gradient clipping (clipnorm=1.0)
  Batch size            32                  Balance between speed and gradient quality
  Max epochs            100                 EarlyStopping usually stops earlier
  EarlyStopping         patience=25         Stops if val_loss doesn't improve
  ReduceLROnPlateau     patience=8          Halves LR if val_loss plateaus
  Lookback              60 days             ~3 months of trading data per sample

---

## Quick Reference

  I want to...                    Run this
  --------------                  --------
  Predict tomorrow's close        python predict.py
  Predict without sentiment       python predict.py --no-sentiment
  Train from scratch              python train_model.py
  Full evaluation + plots         python evaluate.py
  Train with custom settings      python train_model.py --epochs 50 --batch-size 64
