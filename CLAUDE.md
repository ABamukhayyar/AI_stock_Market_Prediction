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
  src/Pages/                        → Dashboard, StockDetail, AllStocks, ModelDiagnostics, etc.
  src/components/                   → Layout, SearchInput, buttons, StatBox (shared metric tile)
  src/StockData.js                  → API helpers + MODEL_COLORS + confidenceColor() + date formatters
  src/LanguageContext.js             → EN/AR bilingual translations
data_acquisition/market_data.py     → DataAcquisitionService (CSV, yfinance API, Supabase)
preprocessing/engine.py             → PreprocessingEngine (denoise, scale, sequence)
technical_analysis/indicators.py    → TechnicalAnalysisService (RSI, MACD, ATR, etc.)
prediction/engine.py                → PredictionEngine (CNN-BiLSTM-Attention model)
prediction/confidence.py            → Canonical compute_confidence() — single source for 0-100 score
prediction/linear/features.py       → Linear model feature engineering (51 features)
prediction/linear/engine.py         → LinearPredictionEngine (ElasticNetCV)
sentiment/analyzer.py               → SentimentAnalyzer (news fetch, translate, score)
db/supabase_client.py               → Supabase client (all DB operations + get_or_register_model)
train_model.py                      → CNN training pipeline
predict.py                          → CLI prediction (--model-type cnn|linear|all)
evaluate.py                         → Model evaluation + trading sim (Sharpe, drawdown, PnL)
scripts/daily_predict.bat           → Daily cron entrypoint for Windows Task Scheduler
scripts/README.md                   → Task Scheduler one-time setup instructions
models/TASI_Model_v3.keras          → Trained CNN model
models/TASI_Scaler_v3.pkl           → CNN scaler (RobustScaler)
models/tasi_linear_model.pkl        → Trained Linear model (ElasticNetCV)
models/tasi_linear_scaler.pkl       → Linear scaler (StandardScaler)
models/finbert/                     → Cached FinBERT NLP model
models/opus-mt-ar-en/               → Cached MarianMT translation model
models/eval_v4/metrics_*.json       → Offline-evaluation JSON per (symbol, model) — feeds the Diagnostics page
logs/                               → Daily prediction logs (gitignored; created by daily_predict.bat)
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
| GET | `/api/stocks` | List all stocks; each includes `model_predictions[]`, `target_date`, `history_dates[]` |
| GET | `/api/stocks/{id}` | Stock detail + model_predictions for switcher |
| GET | `/api/stocks/{id}/history` | OHLCV price history |
| GET | `/api/stocks/list` | Stock universe for search |
| GET | `/api/stocks/batch?ids=X,Y` | Batch fetch for watchlist |
| GET | `/api/predictions` | Recent predictions |
| GET | `/api/predictions/latest` | One prediction per stock (Dashboard) |
| GET | `/api/predictions/models` | List AI models |
| GET | `/api/predictions/accuracy?symbol=X&limit=N` | Accuracy log filtered by symbol (1–500, default 50), sorted desc |
| GET | `/api/predictions/model-metrics?symbol=X&model_id=N` | Rolling MAPE + direction accuracy + count + last validated, computed live from `model_accuracy_log` |
| GET | `/api/predictions/eval-metrics?symbol=X&model_id=N` | Offline holdout-evaluation metrics + equity-curve arrays + predicted-vs-actual + rolling MAPE. Reads `models/eval_v4/metrics_<SYM>_<cnn\|linear>.json` written by `evaluate.py`. Powers the Model Diagnostics page. |
| POST | `/api/predictions/run` | Trigger new prediction |
| POST | `/api/auth/signup` | User registration |
| POST | `/api/auth/login` | User login |
| GET | `/api/watchlist/{user_id}` | Get watchlist |
| POST | `/api/watchlist` | Add to watchlist |
| DELETE | `/api/watchlist` | Remove from watchlist |

The `model_predictions[]` array on `/api/stocks` is what powers the AllStocks page's CNN/Linear toggle and the StockDetail page's model switcher. Entries are deduped by display name (latest `target_date` wins) so multiple registered model_ids sharing a name collapse to one chip per type.

### Performance note

The list endpoints (`/api/stocks`, `/api/stocks/batch`, `/api/predictions/latest`) were doing N×M round-trips to Supabase (N stocks × M models × ~3 queries per (stock, model)), exhausting Windows sockets after ~260 calls and returning 500s after 22 s on `/predictions/latest`. They now bulk-fetch `ai_predictions`, `model_accuracy_log`, `market_data`, and `sentiment_analysis` once each per request, then join in memory. `compute_confidence()` accepts an optional `avg_error` to skip its DB lookup when called in the hot loop. Result: `/stocks` 4.8 s → 1.2 s warm; `/predictions/latest` 22 s timeout → 1.1 s.

---

## Confidence Score Calculation

Single source of truth: `prediction/confidence.py:compute_confidence()`. Both `predict.py` and `api/routes/predictions.py` are thin adapters that map their own dict shapes to this canonical scorer, so Dashboard and Stock Detail always show the same number for the same prediction.

Components (0–100):
- **Base:** 50 points (neutral — confidence has to be earned)
- **Signal strength:** +0 to +15 (>2%: +15, >1%: +10, >0.3%: +5)
- **Sentiment alignment:** −5 / +10, only counted when sentiment confidence > 50
- **Per-(model_id, symbol) historical accuracy** from `model_accuracy_log`:
  - avg error <0.5%: +30
  - <1%: +20
  - <2%: +10
  - <5%: +5
  - no validated history yet: +0 (the system refuses to claim confidence it has not earned)

The accuracy lookup is scoped to the exact `(model_id, symbol)` pair so one stock's track record can't inflate another's. Stored in `ai_predictions.confidence_score` as 0.0–1.0, displayed as 0–100% on frontend.

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

`evaluate.py` also runs a trading simulation per model (long-when-predicted-up, flat otherwise) and reports Sharpe ratio, max drawdown, total/annual return, hit rate, and number of trades against a buy-and-hold baseline. Equity curves are written to `eval_cnn_equity_curve.png` and `eval_linear_equity_curve.png` in the output directory.

The simulation now runs **twice** per model — once with `transaction_cost_bps=0` (headline / optimistic) and once with `transaction_cost_bps=10` (realistic round-trip cost for TASI). Both are persisted to `metrics_<SYM>_<cnn|linear>.json` (under `_10bps`-suffixed keys) so the Model Diagnostics page can show them side by side. The honest takeaway: CNN's edge survives 10 bps transaction costs (TASI 7.50 → 6.27); the Linear models on some stocks go *negative* once costs are included (SABIC 0.39 → −0.17) — which is what a realistic no-edge baseline should look like.

### Model Diagnostics page

`/stock/:id/diagnostics` shows the offline holdout evaluation for the active model: 7 numeric tiles (MAPE, R², Direction Accuracy, headline Sharpe, 10-bps Sharpe, Max Drawdown, Total Return) plus three charts — equity curve (strategy vs buy-and-hold + dashed 10-bps strategy), predicted-vs-actual scatter with y=x diagonal, and rolling 30-day MAPE. All charts are inline SVG (no chart library). Source data is the JSON written by `evaluate.py`; refreshes only on re-run.

### Daily Scheduling (Windows)

`scripts/daily_predict.bat` is the cron entrypoint. It runs `predict.py` for **all six stocks** (TASI, ARAMCO, RAJHI, SABIC, STC, SECO) sequentially. TASI runs first with sentiment enabled; the other five reuse that sentiment via `--no-sentiment` so the heavy FinBERT pass only happens once per day. Output is piped to `logs/predict_YYYYMMDD.log` (filename built via PowerShell `Get-Date -Format yyyyMMdd` for locale safety; the naive `%date%` substring trick breaks on non-US locales).

What one daily run refreshes — every table the website reads from:
- `market_data` — new OHLCV row per stock per trading day (via `DataAcquisitionService.update_supabase()` at the start of each predict.py)
- `ai_predictions` — one new row per (stock, model) per run
- `model_accuracy_log` — `_check_past_predictions_accuracy()` runs first and writes the actual close for any past prediction whose `target_date` has now passed. This is what makes confidence rings *grow* over time as evidence accumulates.
- `sentiment_analysis` — fresh row from today's Google News (under symbol `TASI`, market-wide for v1)
- `technical_indicators` — last 5 rows upserted per stock

The Diagnostics page is **not** refreshed by this cron — it reads frozen holdout-evaluation JSON files from `evaluate.py`, which is run only after retraining.

Register once in Windows Task Scheduler:
```powershell
schtasks /create /tn "Insight Daily Prediction" /tr "c:\Users\Admin\Desktop\Grap_Project_Insight\scripts\daily_predict.bat" /sc WEEKLY /d SUN,MON,TUE,WED,THU /st 17:30 /f
```

Trigger: Sun–Thu (Saudi work week) at 17:30 AST. TASI closes 15:00, yfinance EOD ~17:00, 30-min buffer.

Remove with: `schtasks /delete /tn "Insight Daily Prediction" /f`. See `scripts/README.md` for the full Task Scheduler GUI walkthrough and how to add/remove stocks from the schedule.

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
3. **Phase 3 ✅ (partial):** Expand to individual stocks (SABIC, STC, Alrajhi, Almarai, Aramco backfilled — multi-stock backfill landed; per-stock retraining pending)
4. **Phase 4 ✅:** FastAPI backend + React frontend integrated
5. **Phase 5 ✅:** PostgreSQL database (Supabase)
6. **Phase 6 ✅:** Linear model integrated from AI-models branch
7. **Phase 7 ✅:** Leakage-free pipeline + honest per-model metrics surface (Model Performance card, rolling /model-metrics endpoint, AllStocks CNN/Linear toggle, target-date labels, past-predictions track record)
8. **Phase 8 ✅:** Daily scheduled prediction runs covering all 6 stocks (Windows Task Scheduler + scripts/daily_predict.bat)
9. **Phase 9 ✅:** Model Diagnostics page with offline-holdout graphs (equity curve, predicted-vs-actual scatter, rolling MAPE) + cost-adjusted Sharpe alongside the headline so the trading-sim assumption isn't hidden
10. **Phase 10 ✅:** Backend perf — bulk-fetch refactor cut /stocks 4×, fixed /predictions/latest 500-error timeout

---

## Recent Changes (May 2026)

Feature branch `feature/session-changes-integration` lands the following on top of `main`:

| Commit | What |
|---|---|
| `3c2bf80` | `fix(api)`: `/predictions/accuracy` actually filters by symbol + bounded limit + sorted DESC; N+1 → single `.in_()` |
| `ee6126d` | `feat(eval)`: trading simulation (Sharpe, drawdown, PnL vs buy-and-hold) in `evaluate.py` |
| `53f268a` | `feat(ui)`: `PastPredictionsPanel` on Stock Detail (Avg/Best/Worst + 15-row table, EN+AR) |
| `a1d2925` | `chore`: remove `session_changes/` delivery folder after integration |
| `61e2a28` | `refactor`: single source of truth for AI confidence in `prediction/confidence.py` |
| `dcad0e6` | `feat(api)`: `/api/stocks` returns `model_predictions[]` + `target_date` + `history_dates`; new `/predictions/model-metrics` |
| `1054f37` | `feat(ui)`: AllStocks CNN/Linear chip toggle + per-model card data + empty-state cards |
| `02cadd4` | `feat(ui)`: StockDetail Model Performance card + active-model-filtered Past Predictions + target-date pills + chart x-axis dates |
| `d5f9c6b` | `chore(ops)`: daily prediction cron via Windows Task Scheduler |
| `f4f4fb0` | `fix`: dedupe `model_predictions` by name (keep freshest target_date); locale-safe log filename |
| `d00a00e` | `perf`: bulk-fetch in list endpoints — `/stocks` 4.8 s → 1.2 s, `/predictions/latest` 22 s timeout → 1.1 s |
| `ca2918e` | `feat`: Model Diagnostics page (`/stock/:id/diagnostics`) with offline-holdout equity curve, scatter, rolling MAPE + new `/predictions/eval-metrics` endpoint |
| `58893f2` | `fix(ui)`: deterministic Stock Detail back-button (no more bouncing into Diagnostics), Arabic translations on Diagnostics, shared StatBox component |
| `874822f` | `feat(eval)`: non-TASI metrics + cost-adjusted (10 bps) Sharpe alongside headline + clearer equity-curve explainer |
| `1b05da0` | `style(ui)`: calibrated confidence palette (50% now neutral slate, not alarm-red) + softer card borders + better hover shadows |
| `773908e` | `feat(ops)`: daily refresh now covers all 6 stocks, not just TASI |
| `14cec39` | `chore(repo)`: ship trained models + eval metrics so teammates clone-and-run |
| `3607e20` | `fix(ops+db)`: refresh non-TASI tickers daily (`source="auto"` for all symbols); `insert_prediction` is now an upsert on `(model_id, symbol, target_date)`; new `scripts/dedupe_predictions.py` one-shot cleanup |
| `1da3b34` | `refactor(ui)`: dropped fake Settings controls (password modal, notification toggles, 2FA, export) + Profile MOCK_USER + StockDetail's empty "Other Predictions" + `marketCap`/`peRatio` N/A tiles; wired the 1W/2W/1M chart buttons against `/stocks/{id}/history?days=30` |
| `507b337` | `feat(auth)`: real bcrypt login + signup against the `users` table; LoginPage shows inline errors for `account_not_found` / `invalid_password` / server; SignUp is a single-step form (no OTP / phone wizard); requires one-time `ALTER TABLE users ADD COLUMN password_hash` |

Key behavioural changes a reviewer should know about:
- **No more data leakage:** scaler + IQR bounds fit on training slice only; headline metrics now reported in return-space (honest CNN: MAPE 0.21%, R² 0.9961, Direction 82.74% — these are post-fix numbers).
- **One confidence number per prediction:** `prediction.confidence.compute_confidence()` is canonical; Dashboard and Stock Detail now agree.
- **Per-(model, symbol) accuracy scoping:** one stock's track record can no longer inflate another's confidence as Phase 3 stocks are added.
- **User can audit the model:** Past Predictions table + Model Performance card both surface real `model_accuracy_log` data instead of relying solely on the heuristic Confidence ring.
- **Model Diagnostics page** surfaces the offline holdout numbers (586-day test set for TASI CNN) alongside the live rolling numbers — so panel reviewers see the rigorous backtest AND the deployed track record without switching context.
- **Honest Sharpe:** every Diagnostics page shows both the headline (zero-cost) and 10-bps round-trip realistic Sharpe. The CNN's edge survives 10 bps; some Linear baselines go negative after costs — the asymmetry is itself the defence answer to "are these numbers real?".
- **Calibrated colors:** the AI Confidence ring is no longer alarm-red for any score below 70. 50% is now slate (neutral, no evidence either way), matching the system's actual epistemic state when validated history is sparse.
- **All 6 stocks daily:** the cron now refreshes ARAMCO/RAJHI/SABIC/STC/SECO alongside TASI, not just TASI.
- **Real auth:** the login form is no longer a `setTimeout` that accepts anything — it `POST`s to `/api/auth/login`, bcrypt-verifies against the `users` table, and renders distinct inline errors for unknown email / wrong password / server unreachable. SignUp is a real single-step form against the same table (no OTP / phone wizard).
- **No more prediction duplicates:** `insert_prediction` is now an upsert keyed on `(model_id, symbol, target_date)`, so reruns of `predict.py` overwrite the prior row instead of stacking. The Past Predictions panel no longer shows N copies of the same date per model. `scripts/dedupe_predictions.py` cleaned up the legacy duplicates one-shot.
- **Honest UI:** every Settings toggle and Profile field that didn't actually persist anywhere has been removed (no more password-change modal, notification toggles, Export Data button, MOCK_USER phone). The 1W/2W/1M chart buttons on Stock Detail actually filter now.

### Known follow-ups
- Some hard-coded fallback confidence numbers may still exist in legacy frontend data; if `/api/predictions/latest` ever returns nothing those constants will surface. Verify before defence.
- **No JWT / session tokens.** Login returns the user profile and the frontend stores it in localStorage. Routes that take `user_id` accept it as a query param without server-side validation. Acceptable for a campus demo, not for anything beyond.
- Frontend watchlist is browser-`localStorage` only; `/api/watchlist` endpoints exist but the UI isn't wired up to them.
- **Sentiment is market-wide** (stored under `symbol = "TASI"`), so per-stock predictions for SABIC/STC/etc. share the same TASI sentiment score until Phase 3 sentiment-per-stock lands. Non-TASI cards always show "Neutral" sentiment as a result.
- **No password reset flow.** The ForgotPassword page exists but stays cosmetic. The login error "Forgot password?" CTA links to it.
- **No walk-forward backtest.** The 88% direction accuracy on TASI CNN is one realisation on a single 586-day holdout. A walk-forward backtest (train on years 1–5, test on year 6, slide forward) would give a more defensible generalisation claim. Not in scope for the current iteration but flagged as a future-work item.
