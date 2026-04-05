# Insight — AI-Assisted Saudi Stock Market Prediction System

## Project Overview
CSC 496 graduation project (King Saud University). AI-assisted decision-making system for TASI (Saudi stock market) analysis. Predicts next-day closing prices using deep learning, technical analysis, and sentiment analysis.

**Team:** Abdullah Bamukhayyar + 4 members | **Supervisor:** Dr. Fawaz Alsulaiman
**GitHub:** https://github.com/ABamukhayyar/AI_stock_Market_Prediction
**Frontend:** React (handled by another team member) | **Backend:** Python (TensorFlow, yfinance, pandas)
**Database:** Supabase (hosted PostgreSQL)

---

## System Architecture

```
[yfinance API] ──→ [Data Acquisition] ──→ [Preprocessing] ──→ [Technical Analysis]
                          │                                            ↓
[Google News RSS] ──→ [Sentiment Analysis] ──→ [Supabase DB] ← [Feature Store]
                                                     ↓              ↑
[React Dashboard] ←── [Supabase DB] ←── [Prediction Engine] ───────┘
```

### Project Structure
```
.env                                → Supabase credentials (not in git)
data_acquisition/market_data.py     → DataAcquisitionService (CSV, yfinance API, Supabase)
preprocessing/engine.py             → PreprocessingEngine (denoise, scale, sequence)
technical_analysis/indicators.py    → TechnicalAnalysisService (RSI, MACD, ATR, etc.)
prediction/engine.py                → PredictionEngine (CNN-BiLSTM-Attention model)
sentiment/analyzer.py               → SentimentAnalyzer (news fetch, translate, score)
db/supabase_client.py               → Supabase client (all DB read/write operations)
train_model.py                      → ModelTrainer (end-to-end training pipeline)
predict.py                          → CLI prediction (auto-fetches data + sentiment)
evaluate.py                         → Backtest + metrics
models/                             → Saved .keras, .pkl, and cached NLP models
notebooks/                          → Old Jupyter experiments
TASI_Historical_Data.csv            → Original CSV (backup; live data from yfinance)
```

---

## Current Model: CNN-BiLSTM-Attention (v3)

- **Task:** Next-day closing price prediction (regression)
- **Architecture:** Conv1D → MaxPool → BiLSTM → MultiHeadAttention → BiLSTM → Dense → Linear
- **Features (19):** OHLCV + 6 technical indicators + 5 macro indicators + 3 sentiment features
- **Lookback:** 60 days
- **Scaler:** RobustScaler (fit on TRAINING data only)
- **Preprocessing:** Wavelet denoising (DWT, db4) → returns conversion → IQR outlier capping
- **Loss:** Huber (delta=1.0) | **Optimizer:** Adam (lr=0.001, clipnorm=1.0)
- **Batch:** 32 | **Epochs:** 100 | **EarlyStopping:** patience=25 | **ReduceLROnPlateau:** patience=8
- **Split:** 70% train / 15% val / 15% test (chronological)
- **Target metrics:** MAPE < 10%, R² > 0.5

---

## The 19 Features

| #  | Feature               | Category   | Source           |
|----|-----------------------|------------|------------------|
| 1  | Open                  | Price      | yfinance / CSV   |
| 2  | High                  | Price      | yfinance / CSV   |
| 3  | Low                   | Price      | yfinance / CSV   |
| 4  | Close                 | Price      | yfinance / CSV   |
| 5  | Volume                | Activity   | yfinance / CSV   |
| 6  | RSI (14)              | Momentum   | `ta` library     |
| 7  | MACD                  | Momentum   | `ta` library     |
| 8  | ATR (14)              | Volatility | `ta` library     |
| 9  | Bollinger Width       | Volatility | `ta` library     |
| 10 | SMA_50                | Trend      | `ta` library     |
| 11 | EMA_20                | Trend      | `ta` library     |
| 12 | Oil (Brent)           | Macro      | yfinance `BZ=F`  |
| 13 | S&P 500               | Macro      | yfinance `^GSPC` |
| 14 | Gold                  | Macro      | yfinance `GC=F`  |
| 15 | DXY (Dollar Index)    | Macro      | yfinance `DX-Y.NYB` |
| 16 | Interest Rate (10Y)   | Macro      | yfinance `^TNX`  |
| 17 | Sentiment_Score       | Sentiment  | Google News + FinBERT |
| 18 | Sentiment_Confidence  | Sentiment  | Google News + FinBERT |
| 19 | Sentiment_Encoded     | Sentiment  | -1 / 0 / 1       |

---

## Data Sources

### TASI Price Data
- **Primary:** yfinance API (`^TASI.SR`) — auto-fetched daily by `predict.py`
- **Backup:** `TASI_Historical_Data.csv` (Oct 2008 – Sep 2024)
- **Storage:** Supabase `market_data` table (auto-updated on each prediction run)

### Macroeconomic Data (via yfinance)
- Oil: `BZ=F` (Brent Crude)
- S&P 500: `^GSPC`
- Gold: `GC=F`
- Dollar Index: `DX-Y.NYB`
- Interest Rate: `^TNX` (US 10Y Treasury)
- Merged by date with forward-fill

### Sentiment Data
- **Source:** Google News RSS (8 Arabic + 9 English feeds)
- **Pipeline:** Fetch articles → filter Saudi-specific → translate Arabic via MarianMT → score with hybrid Arabic lexicon (60%) + FinBERT (40%) for Arabic articles, pure FinBERT for English
- **Output:** score (-100 to 100), confidence (0-100%), label (Bullish/Neutral/Bearish), encoded (-1/0/1)
- **Storage:** Supabase `sentiment_analysis` table
- **NLP Models:** Cached locally in `models/opus-mt-ar-en/` and `models/finbert/`

---

## Supabase Database

**URL:** Set in `.env` (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY)

| Table                  | Purpose                                      |
|------------------------|----------------------------------------------|
| `stocks`               | Stock registry (TASI registered)             |
| `market_data`          | OHLCV prices (auto-updated from yfinance)    |
| `technical_indicators` | RSI, MACD, ATR, Bollinger, SMA, EMA          |
| `sentiment_analysis`   | Daily sentiment scores + article counts       |
| `company_financials`   | Earnings reports                             |
| `ai_models`            | Model registry (name, version, type)         |
| `ai_predictions`       | Predicted prices + metadata                  |
| `model_accuracy_log`   | Actual vs predicted accuracy tracking         |
| `users`                | User accounts                                |
| `user_watchlists`      | User stock watchlists                        |

---

## Technical Indicators (use `ta` library — NOT manual calculations)

| Indicator | Purpose |
|-----------|---------|
| RSI (14) | Overbought/oversold |
| MACD | Momentum/trend |
| ATR (14) | **REAL** volatility (High/Low/PrevClose) |
| Bollinger Width | Volatility expansion |
| SMA_50 | Medium-term trend |
| EMA_20 | Short-term trend |

**CRITICAL:** ATR MUST use real High/Low/PrevClose. The old model used `Price * 0.02` which is WRONG.

---

## Prediction Pipeline (what `predict.py` does)

1. Fetches latest TASI data from yfinance API
2. Updates Supabase `market_data` with new rows
3. Fetches macroeconomic indicators from yfinance
4. Runs live sentiment analysis (news fetch + scoring) → stores in Supabase
5. Computes technical indicators
6. Preprocesses: denoise → returns → outlier cap → scale
7. Feeds last 60 days (19 features) into CNN-BiLSTM-Attention model
8. Outputs predicted next trading day close (SAR)
9. Stores prediction in Supabase `ai_predictions`

**No manual data download needed.** Just run `python predict.py`.

---

## Dependencies
```
tensorflow          # CNN-BiLSTM-Attention model
numpy, pandas       # Data manipulation
scikit-learn        # RobustScaler
yfinance            # TASI + macro data from API
matplotlib          # Training plots
PyWavelets          # Wavelet denoising
ta                  # Technical indicators
joblib              # Scaler serialization
supabase            # Database client
python-dotenv       # .env loading
transformers        # FinBERT + MarianMT (sentiment)
torch               # PyTorch backend for transformers
feedparser          # Google News RSS parsing
httpx               # HTTP client for RSS feeds
beautifulsoup4      # HTML cleaning
lxml                # HTML parser backend
sentencepiece       # MarianMT tokenizer
```

---

## Phases
1. **Phase 1 ✅:** Build CNN-BiLSTM-Attention model for TASI index
2. **Phase 2 ✅:** Integrate sentiment analysis as additional feature
3. **Phase 3:** Expand to individual stocks (SABIC, STC, Alrajhi, Almarai)
4. **Phase 4:** Build FastAPI backend + scheduled prediction cron job
5. **Phase 5 ✅:** Implement PostgreSQL database (Supabase)

---

## Verification Rules

### Before Training
- [x] Confirm TASI data has Open, High, Low, Close, Volume columns
- [x] Confirm ATR is calculated using REAL True Range (not Price × 0.02)
- [x] Confirm scaler is fit ONLY on training data, NOT on test/validation
- [x] Confirm train/val/test split is chronological (no random shuffling)
- [x] Confirm wavelet denoising is applied before scaling
- [x] Confirm no NaN values in feature matrix after preprocessing
- [x] Print feature matrix shape and verify: (samples, 60, 19)
- [ ] Print class/target distribution to check for imbalance

### During Training
- [ ] Monitor val_loss is decreasing (not just train_loss)
- [ ] Check for overfitting: if train_loss << val_loss, add more regularization
- [ ] Verify EarlyStopping triggers before max epochs
- [ ] Log training curves (loss + MAE per epoch) for visual inspection

### After Training — Model Evaluation
- [ ] Compute ALL metrics on TEST set: RMSE, MAE, MAPE, R²
- [ ] MAPE should be < 10% (ideally < 5%)
- [ ] R² should be > 0.5 (ideally > 0.7)
- [ ] Generate Actual vs Predicted price chart
- [ ] Check predictions aren't "lagging" (copying yesterday's price)
- [ ] Verify predictions span a realistic range
- [ ] Compare with old Golden Model metrics

### Prediction Pipeline Verification
- [x] `predict.py` runs end-to-end without errors
- [x] Output is a reasonable price (within ±10% of recent TASI range)
- [x] Inverse scaling produces actual SAR price
- [ ] Run prediction 3 times with same input — verify deterministic
- [ ] Test with deliberately bad input — should fail gracefully

### Before Deployment / Integration
- [ ] Run full backtest on 2024 data (walk-forward)
- [ ] Report win rate and average absolute error
- [x] Save model as `TASI_Model_v3.keras` + `TASI_Scaler_v3.pkl`
- [x] Register model in `ai_models` Supabase table
- [ ] Verify model loads correctly in a fresh Python session
