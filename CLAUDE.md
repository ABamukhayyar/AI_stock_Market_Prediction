# Insight — AI-Assisted Saudi Stock Market Prediction System

## Project Overview
CSC 496 graduation project (King Saud University). AI-assisted decision-making system for TASI (Saudi stock market) analysis. Predicts next-day closing prices using deep learning, technical analysis, and sentiment analysis.

**Team:** Abdullah Bamukhayyar + 4 members | **Supervisor:** Dr. Fawaz Alsulaiman
**GitHub:** https://github.com/ABamukhayyar/AI_stock_Market_Prediction
**Frontend:** React 18 (CRA) | **Backend:** Python (TensorFlow, scikit-learn, yfinance, pandas)
**API:** FastAPI (localhost:8000) | **Database:** Supabase (hosted PostgreSQL)

---

## System Architecture

```
[yfinance API] ──→ [Data Acquisition] ──→ [Preprocessing] ──→ [Technical Analysis]
                          │                                            ↓
[Google News RSS] ──→ [Sentiment Analysis] ──→ [Supabase DB] ← [Feature Store]
                                                     ↓              ↑
[React Frontend] ←── [FastAPI Backend] ←── [Prediction Engine] ────┘
 (localhost:3000)      (localhost:8000)     (CNN + Linear models)
```

### Project Structure
```
api/                                → FastAPI backend
  main.py                           → App setup, CORS, routes
  routes/stocks.py                  → Stock data endpoints
  routes/predictions.py             → Prediction + confidence endpoints
  routes/auth.py                    → Authentication endpoints
  routes/watchlist.py               → Watchlist endpoints
frontend/                           → React website
  src/Pages/                        → Dashboard, StockDetail, AllStocks, etc.
  src/components/                   → Layout, SearchInput, buttons
  src/StockData.js                  → API helpers + model colors
  src/LanguageContext.js             → EN/AR bilingual translations
data_acquisition/market_data.py     → DataAcquisitionService (CSV, yfinance API, Supabase)
preprocessing/engine.py             → PreprocessingEngine (denoise, scale, sequence)
technical_analysis/indicators.py    → TechnicalAnalysisService (RSI, MACD, ATR, etc.)
prediction/engine.py                → PredictionEngine (CNN-BiLSTM-Attention model)
prediction/linear/features.py       → Linear model feature engineering (51 features)
prediction/linear/engine.py         → LinearPredictionEngine (ElasticNetCV)
sentiment/analyzer.py               → SentimentAnalyzer (news fetch, translate, score)
db/supabase_client.py               → Supabase client (all DB operations + get_or_register_model)
train_model.py                      → CNN training pipeline
predict.py                          → CLI prediction (--model-type cnn|linear|all)
evaluate.py                         → Model evaluation (--model-type cnn|linear|all)
models/TASI_Model_v3.keras          → Trained CNN model
models/TASI_Scaler_v3.pkl           → CNN scaler (RobustScaler)
models/tasi_linear_model.pkl        → Trained Linear model (ElasticNetCV)
models/tasi_linear_scaler.pkl       → Linear scaler (StandardScaler)
models/finbert/                     → Cached FinBERT NLP model
models/opus-mt-ar-en/               → Cached MarianMT translation model
TASI_Historical_Data.csv            → Original CSV backup
PRESENTATION_GUIDE.md               → Full demo walkthrough + Q&A
FRONTEND_ISSUES.md                  → Known frontend issues
```

---

## Two AI Models

### Model 1: CNN-BiLSTM-Attention (v3)
- **Task:** Next-day closing price prediction (regression)
- **Architecture:** Conv1D → MaxPool → BiLSTM → MultiHeadAttention → BiLSTM → Dense → Linear
- **Features (19):** OHLCV + 6 technical indicators + 5 macro indicators + 3 sentiment features
- **Lookback:** 60 days
- **Scaler:** RobustScaler (fit on TRAINING data only)
- **Preprocessing:** Wavelet denoising (DWT, db4) → returns conversion → IQR outlier capping
- **Loss:** Huber (delta=1.0) | **Optimizer:** Adam (lr=0.001, clipnorm=1.0)
- **Batch:** 32 | **Epochs:** 100 | **EarlyStopping:** patience=25 | **ReduceLROnPlateau:** patience=8
- **Split:** 70% train / 15% val / 15% test (chronological)
- **Accuracy:** MAPE 0.21%, R² 0.9961, Direction Accuracy 82.74%

### Model 2: Linear (ElasticNetCV)
- **Task:** Next-day return prediction → converted to price
- **Architecture:** ElasticNetCV (L1+L2 regularized linear regression)
- **Features (51):** Returns, slopes, MA ratios, volatility, RSI, MACD, Bollinger, volume, regime dummies, calendar, macro returns, interaction terms
- **Lookback:** 1 day (no sequence)
- **Scaler:** StandardScaler
- **Training:** Walk-forward validation, compared ElasticNet/Ridge/BayesianRidge
- **Accuracy:** MAPE 0.58%, R² 0.9773, Direction Accuracy 54.30%
- **Extra macro data:** VIX (^VIX) and S&P futures (ES=F) — fetched by `prediction/linear/features.py`

---

## The 19 CNN Features

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
- VIX: `^VIX` (Linear model only)
- S&P Futures: `ES=F` (Linear model only)

### Sentiment Data
- **Source:** Google News RSS (8 Arabic + 9 English feeds)
- **Pipeline:** Fetch articles → filter Saudi-specific → translate Arabic via MarianMT → score with hybrid Arabic lexicon (60%) + FinBERT (40%) for Arabic articles, pure FinBERT for English
- **Output:** score (-100 to 100), confidence (0-100%), label (Bullish/Neutral/Bearish), encoded (-1/0/1)
- **Storage:** Supabase `sentiment_analysis` table

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
| `ai_models`            | Model registry (CNN model_id=1, Linear model_id=2) |
| `ai_predictions`       | Predicted prices + confidence + metadata     |
| `model_accuracy_log`   | Actual vs predicted accuracy tracking         |
| `users`                | User accounts                                |
| `user_watchlists`      | User stock watchlists                        |

---

## FastAPI Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/stocks` | List all stocks with latest predictions |
| GET | `/api/stocks/{id}` | Stock detail + model_predictions for switcher |
| GET | `/api/stocks/{id}/history` | OHLCV price history |
| GET | `/api/stocks/list` | Stock universe for search |
| GET | `/api/stocks/batch?ids=X,Y` | Batch fetch for watchlist |
| GET | `/api/predictions` | Recent predictions |
| GET | `/api/predictions/latest` | One prediction per stock (Dashboard) |
| GET | `/api/predictions/models` | List AI models |
| GET | `/api/predictions/accuracy` | Accuracy log |
| POST | `/api/predictions/run` | Trigger new prediction |
| POST | `/api/auth/signup` | User registration |
| POST | `/api/auth/login` | User login |
| GET | `/api/watchlist/{user_id}` | Get watchlist |
| POST | `/api/watchlist` | Add to watchlist |
| DELETE | `/api/watchlist` | Remove from watchlist |

---

## Confidence Score Calculation

Computed from multiple factors (0-100):
- **Base:** 50 points
- **Historical accuracy:** +0 to +25 (from model_accuracy_log — lower error = higher boost)
- **Signal strength:** +0 to +15 (larger predicted moves = more decisive)
- **Sentiment alignment:** -5 to +10 (news agrees with prediction = boost)
- **Model type:** +0 to +10 (CNN gets bonus for higher historical accuracy)

Stored in DB as 0.0-1.0 (confidence_score column), displayed as 0-100% on frontend.

---

## How to Run

### Start the System
```bash
# Terminal 1 — Backend API
cd c:\Users\Admin\Desktop\Grap_Project_Insight
python -m uvicorn api.main:app --port 8000

# Terminal 2 — Frontend
cd c:\Users\Admin\Desktop\Grap_Project_Insight\frontend
npm start
```

### Run Predictions
```bash
python predict.py                          # CNN only (default)
python predict.py --model-type linear      # Linear only
python predict.py --model-type all         # Both models
python predict.py --model-type all --no-sentiment  # Skip sentiment
```

### Evaluate Models
```bash
python evaluate.py --model-type cnn        # CNN evaluation
python evaluate.py --model-type linear     # Linear evaluation
python evaluate.py --model-type all        # Both + comparison table
```

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

## Dependencies
```
# AI / ML
tensorflow          # CNN-BiLSTM-Attention model
scikit-learn        # Linear model (ElasticNetCV) + RobustScaler
numpy, pandas       # Data manipulation
joblib              # Scaler serialization

# Data
yfinance            # TASI + macro data from API
PyWavelets          # Wavelet denoising
ta                  # Technical indicators

# NLP / Sentiment
transformers        # FinBERT + MarianMT
torch               # PyTorch backend for transformers
feedparser          # Google News RSS parsing
httpx               # HTTP client for RSS feeds
beautifulsoup4      # HTML cleaning
lxml                # HTML parser backend
sentencepiece       # MarianMT tokenizer

# Web / API
fastapi             # Backend API framework
uvicorn             # ASGI server
supabase            # Database client
python-dotenv       # .env loading

# Visualization
matplotlib          # Training/evaluation plots
```

---

## Phases
1. **Phase 1 ✅:** Build CNN-BiLSTM-Attention model for TASI index
2. **Phase 2 ✅:** Integrate sentiment analysis as additional feature
3. **Phase 3:** Expand to individual stocks (SABIC, STC, Alrajhi, Almarai)
4. **Phase 4 ✅ (partial):** FastAPI backend built + React frontend integrated
5. **Phase 5 ✅:** Implement PostgreSQL database (Supabase)
6. **Phase 6 ✅:** Linear model integrated from AI-models branch
