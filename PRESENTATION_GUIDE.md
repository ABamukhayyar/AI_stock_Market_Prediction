# Insight — Presentation Guide & Full Documentation

## CSC 496 Graduation Project | King Saud University
**Team:** Abdullah Bamukhayyar + 4 members
**Supervisor:** Dr. Fawaz Alsulaiman

---

## Table of Contents
1. [How to Start the Demo](#1-how-to-start-the-demo)
2. [Demo Walkthrough (Step by Step)](#2-demo-walkthrough)
3. [What to Say for Each Screen](#3-what-to-say-for-each-screen)
4. [System Architecture Explained](#4-system-architecture-explained)
5. [The Two AI Models](#5-the-two-ai-models)
6. [Data Pipeline Explained](#6-data-pipeline-explained)
7. [Confidence Score Explained](#7-confidence-score-explained)
8. [Technical Details for Q&A](#8-technical-details-for-qa)
9. [Honest Metrics, Methodology, and Limitations](#9-honest-metrics-methodology-and-limitations)
10. [Common Questions & Answers](#10-common-questions--answers)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. How to Start the Demo

### Before the Presentation
Make sure you have two terminal windows ready. You need internet connection for the yfinance API data.

### Step 1: Start the Backend API
Open **Terminal 1** and run:
```
cd c:\Users\Admin\Desktop\Grap_Project_Insight
python -m uvicorn api.main:app --port 8000
```
You should see: `Uvicorn running on http://0.0.0.0:8000`

### Step 2: Start the Frontend
Open **Terminal 2** and run:
```
cd c:\Users\Admin\Desktop\Grap_Project_Insight\frontend
npm start
```
Wait for: `Compiled successfully!` — browser opens automatically at http://localhost:3000

### Step 3: (Optional) Run a Fresh Prediction
Open **Terminal 3** (optional, to show live prediction during demo):
```
cd c:\Users\Admin\Desktop\Grap_Project_Insight
python predict.py --model-type all
```
This runs both AI models and stores new predictions in the database.

### Quick Check
- http://localhost:3000 — Website loads
- http://localhost:8000/docs — API documentation (Swagger UI)
- http://localhost:8000/api/health — Returns `{"status":"ok"}`

---

## 2. Demo Walkthrough

### Order of Demonstration
1. Login Page (30 seconds)
2. Dashboard — show the prediction card (2 minutes)
3. Stock Detail — click TASI, show model switcher (3 minutes)
4. Run a live prediction from terminal (2 minutes)
5. Refresh dashboard to show new prediction (1 minute)
6. Show API docs at localhost:8000/docs (1 minute)
7. Show Supabase tables (1 minute)
8. (Optional) Show evaluate.py metrics (1 minute)

---

## 3. What to Say for Each Screen

### Screen 1: Login Page
> "This is the Insight login page. The system supports both English and Arabic with full RTL layout, and has a dark/light theme toggle. For the demo we'll log in with a test account."

- Type any email/password and click Login
- Note: Auth is demo mode for the prototype

### Screen 2: Dashboard
> "This is the main dashboard. It shows AI predictions for stocks on the Saudi stock market (TASI). Each card represents a stock with a prediction from our AI models."

**Point out these elements:**

| Element | What to say |
|---------|-------------|
| **Stats bar** (green top) | "The top bar shows key statistics — top gainer, top loser, average AI confidence across all predictions, and Saudi market hours (Sun-Thu, 10AM-3PM AST)." |
| **Ticker tape** (scrolling) | "This scrolling ticker shows real-time prediction summaries for quick scanning." |
| **TASI Card** | "This is the TASI index prediction. The large number is the predicted next-day closing price in Saudi Riyals." |
| **Confidence ring** (circle) | "This confidence ring shows how confident our AI model is in this prediction. It's calculated from the model's historical accuracy, signal strength, and whether the sentiment analysis agrees with the prediction direction." |
| **Green/Red color** | "Green means the model predicts the price will go UP. Red means DOWN." |
| **Model badge** | "This badge shows which AI model made this prediction — we have two: CNN-BiLSTM-Attention (our deep learning model) and Linear (our statistical model)." |
| **Change %** | "This shows the predicted percentage change from today's closing price." |

### Screen 3: Stock Detail (click on TASI)
> "Clicking on a stock opens the full detail view with comprehensive analysis."

**Point out these elements:**

| Element | What to say |
|---------|-------------|
| **Model Switcher** (top buttons) | "These buttons let you switch between our two AI models. Each model uses a different approach and may predict different prices. The CNN model uses 60 days of history with 19 features. The Linear model uses 51 engineered features from a single day." |
| **Predicted price (SAR)** | "This is the predicted closing price for the next trading day. It changes when you switch models." |
| **Change badge (+/-%)** | "The predicted percentage change from today's actual close." |
| **Confidence ring** | "AI confidence for the selected model. CNN currently shows 80% because it has better historical accuracy." |
| **Price History chart** | "This chart shows the last 14 days of actual TASI closing prices. This is real data from the Yahoo Finance API, stored in our Supabase database." |
| **Stat boxes** (Open, High, Low, Volume) | "These are today's actual market statistics — fetched live from yfinance." |
| **52-Week High/Low** | "The highest and lowest closing prices in the past year." |
| **Key Price Levels** | "A summary table showing the predicted close, current price, expected move, and important support/resistance levels." |
| **AI Signal Rationale** | "An explanation of why the model predicted this direction." |
| **Market Cap / P/E** | "These show N/A for TASI because it's a market index, not an individual company. When we expand to individual stocks like ARAMCO or SABIC, these will be populated." |

### Screen 4: Live Prediction (Terminal)
> "Now let me show you a live prediction run. This is what happens behind the scenes when the system generates a new prediction."

Run in Terminal 3:
```
python predict.py --model-type all --no-sentiment
```

> "The system is now:
> 1. Fetching the latest TASI data from Yahoo Finance API
> 2. Updating our Supabase database with new market data
> 3. Running both AI models — the CNN deep learning model and the Linear statistical model
> 4. Computing confidence scores based on historical accuracy
> 5. Storing the predictions in the database
>
> You can see both predictions — CNN predicted X SAR and Linear predicted Y SAR. The predictions are now stored in Supabase and will appear on the website."

Then refresh the browser to show updated predictions.

### Screen 5: API Documentation
Open http://localhost:8000/docs in browser.

> "This is the FastAPI automatic documentation. It shows all our API endpoints. The React frontend communicates with the Python backend through these REST APIs. You can test any endpoint directly from here."

Show:
- `GET /api/stocks` — returns all stocks with predictions
- `GET /api/predictions/latest` — returns latest predictions with confidence
- `GET /api/predictions/models` — shows registered AI models
- `POST /api/predictions/run` — triggers a new prediction

### Screen 6: Supabase Database
Open Supabase dashboard (https://supabase.com/dashboard) and show:

| Table | What to show |
|-------|-------------|
| `market_data` | "Over 4,300 rows of daily TASI price data from 2008 to today" |
| `ai_models` | "Two registered models — CNN-BiLSTM-Attention and Linear" |
| `ai_predictions` | "Every prediction stored with model_id, target date, predicted price, and confidence score" |
| `model_accuracy_log` | "Actual vs predicted comparisons — the system automatically checks past predictions and logs accuracy" |
| `sentiment_analysis` | "Daily sentiment scores from Google News — articles are fetched, translated, and scored using FinBERT NLP model" |

### Screen 7: Model Evaluation (Optional)
```
python evaluate.py --model-type all
```

> "This runs a comprehensive backtest on both models using historical data. The CNN model achieves 0.21% MAPE and 0.996 R-squared on the test set. The Linear model achieves 0.58% MAPE and 0.977 R-squared. Both meet our target of MAPE under 10% and R-squared above 0.5."

---

## 4. System Architecture Explained

**Simple explanation:** Data flows from left to right. Yahoo Finance gives us stock prices, Google News gives us sentiment. Python cleans the data and feeds it to our AI models. The models predict tomorrow's price. Everything gets stored in a database. A FastAPI server reads from the database and sends data to the React website that the user sees in their browser.

```
                    DATA LAYER                           AI LAYER                        PRESENTATION LAYER
              ┌─────────────────┐               ┌──────────────────────┐              ┌─────────────────┐
              │   yfinance API  │──── OHLCV ───→│  Preprocessing       │              │  React Frontend │
              │   (^TASI.SR)    │               │  - Wavelet denoise   │              │  (localhost:3000)│
              └─────────────────┘               │  - Returns convert   │              │                 │
              ┌─────────────────┐               │  - Outlier capping   │              │  Dashboard      │
              │  Macro Data     │── Oil,Gold ──→│  - RobustScaler      │              │  Stock Detail   │
              │  (BZ=F, ^GSPC) │               └──────────┬───────────┘              │  Watchlist      │
              └─────────────────┘                         │                           └────────┬────────┘
              ┌─────────────────┐               ┌─────────▼───────────┐                       │
              │  Google News    │── Articles ──→│  CNN-BiLSTM-Attention│                       │ HTTP
              │  RSS Feeds      │  (17 feeds)  │  (19 features x 60d) │                       │ fetch()
              └─────────────────┘               ├─────────────────────┤              ┌────────▼────────┐
              ┌─────────────────┐               │  Linear ElasticNet  │              │  FastAPI Backend │
              │  FinBERT +      │── Sentiment ─→│  (51 features x 1d) │──Predictions→│  (localhost:8000)│
              │  MarianMT (NLP) │               └──────────┬──────────┘              │                 │
              └─────────────────┘                          │                          │  /api/stocks    │
                                                ┌──────────▼──────────┐              │  /api/predictions│
                                                │   Supabase DB       │◄─────────────│  /api/auth      │
                                                │   (PostgreSQL)      │   SQL queries│  /api/watchlist  │
                                                │                     │              └─────────────────┘
                                                │  market_data        │
                                                │  ai_predictions     │
                                                │  ai_models          │
                                                │  sentiment_analysis │
                                                │  model_accuracy_log │
                                                └─────────────────────┘
```

**In simple words:**
1. Data comes in from Yahoo Finance (prices) and Google News (sentiment)
2. Python processes it — cleans, engineers features, feeds to AI models
3. Models predict tomorrow's TASI closing price
4. Predictions stored in Supabase database
5. FastAPI serves data to the React website
6. User sees predictions, charts, confidence scores in the browser

---

## 5. The Two AI Models

**Simple explanation:** We built two completely different AI models to predict TASI. The CNN model is a deep learning neural network that looks at 60 days of history — it's more accurate but acts like a "black box." The Linear model is a simple equation with 51 features — it's less accurate but you can see exactly why it made each prediction. Using both together gives us a more robust and trustworthy system.

### Model 1: CNN-BiLSTM-Attention (Deep Learning)
- **Type:** Neural network (deep learning)
- **Architecture:** Convolutional layers → Bidirectional LSTM → Multi-Head Attention → Dense layers
- **Input:** Last 60 trading days, 19 features each day (OHLCV + technical + macro + sentiment)
- **What it does:** Looks at 60-day patterns in price movement, volume, technical indicators, macroeconomic data, and news sentiment to predict the next day
- **Training:** 100 epochs, Huber loss, Adam optimizer, early stopping
- **Accuracy:** MAPE 0.21%, R-squared 0.996, Direction Accuracy 82.7%
- **Files:** `prediction/engine.py`, `models/TASI_Model_v3.keras`

### Model 2: Linear (ElasticNet, Statistical)
- **Type:** Regularized linear regression (ElasticNetCV)
- **Architecture:** Single linear equation with L1+L2 regularization
- **Input:** 51 engineered features from the most recent day (returns, slopes, MA ratios, volatility, RSI, MACD, regime dummies, calendar effects, macro returns, interaction terms)
- **What it does:** Uses a large set of hand-crafted features to predict next-day return, then converts to price
- **Training:** Walk-forward validation, compared ElasticNet vs Ridge vs BayesianRidge — ElasticNet won
- **Accuracy:** MAPE 0.58%, R-squared 0.977, Direction Accuracy 54.3%
- **Files:** `prediction/linear/engine.py`, `models/tasi_linear_model.pkl`

### Why Two Models?
> "We use two fundamentally different approaches to compare deep learning vs traditional statistics. The CNN model is better at capturing complex non-linear patterns and has higher accuracy. The Linear model is more interpretable and transparent — you can see exactly which features drive the prediction through its coefficients. Having both gives us a more robust system."

### Model Comparison Table
| Metric | CNN-BiLSTM-Attention | Linear (ElasticNet) |
|--------|---:|---:|
| MAE | 24.38 SAR | 66.90 SAR |
| RMSE | 38.16 SAR | 92.66 SAR |
| MAPE | 0.21% | 0.58% |
| R-squared | 0.9961 | 0.9773 |
| Direction Accuracy | 82.74% | 54.30% |
| Features | 19 | 51 |
| Lookback | 60 days | 1 day |

### Deep Dive: CNN-BiLSTM-Attention Architecture (Layer by Layer)

**Simple explanation:** Our deep learning model works in three stages — first it scans 60 days of data for short-term patterns (CNN), then it reads the sequence forward and backward to understand the story over time (BiLSTM), then it uses a spotlight to focus on the most important days (Attention). Finally it compresses everything into a single prediction: tomorrow's TASI closing price.

```
Input: (batch, 60, 19)
  │
  │  60 time steps, 19 features per step
  │  (60 trading days of OHLCV + technical + macro + sentiment)
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  STAGE 1: CONVOLUTIONAL FEATURE EXTRACTION          │
│                                                     │
│  Conv1D(32 filters, kernel=3, ReLU, L2 reg)        │
│    → Scans the 60-day sequence with a sliding       │
│      window of 3 days. Each filter learns a          │
│      different short-term pattern (e.g., price       │
│      spike + volume surge). Outputs 32 pattern maps. │
│  MaxPooling1D(pool=2)                               │
│    → Halves the sequence: 60 → 30 time steps.       │
│      Keeps the strongest signal, removes noise.      │
│                                                     │
│  Conv1D(64 filters, kernel=3, ReLU, L2 reg)        │
│    → Learns higher-level patterns from the 32        │
│      first-layer patterns. Combines simple patterns  │
│      into complex ones (e.g., head-and-shoulders,    │
│      double bottom). Outputs 64 pattern maps.        │
│  MaxPooling1D(pool=2)                               │
│    → Halves again: 30 → 15 time steps.              │
│                                                     │
│  Output: (batch, 15, 64)                            │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  STAGE 2: BIDIRECTIONAL LSTM (SEQUENTIAL MEMORY)    │
│                                                     │
│  BiLSTM(64 units, return_sequences=True)            │
│    → Two LSTMs run simultaneously:                  │
│      Forward LSTM:  reads day 1→2→3→...→15          │
│      Backward LSTM: reads day 15→14→13→...→1        │
│    → Each LSTM has 64 hidden units = 64 memory      │
│      cells that remember important patterns.         │
│    → Bidirectional means it sees BOTH past context   │
│      and future context at each position.            │
│    → Output: 128 features per time step (64+64)     │
│    → L2 regularization on both kernel and recurrent  │
│      weights prevents overfitting.                   │
│                                                     │
│  Dropout(0.4)                                       │
│    → Randomly drops 40% of connections during        │
│      training. Forces the model to learn robust      │
│      features, not memorize training data.            │
│                                                     │
│  Output: (batch, 15, 128)                           │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  STAGE 3: MULTI-HEAD SELF-ATTENTION                 │
│                                                     │
│  MultiHeadAttention(4 heads, key_dim=16)            │
│    → The attention mechanism asks: "Which of the     │
│      15 time steps are most important for            │
│      predicting tomorrow's price?"                   │
│    → 4 heads = 4 parallel attention computations,    │
│      each focusing on different aspects:             │
│      Head 1 might focus on recent price momentum     │
│      Head 2 might focus on volume patterns           │
│      Head 3 might focus on macro indicator changes   │
│      Head 4 might focus on sentiment shifts          │
│    → Each head uses key_dim=16 for its query/key     │
│      projections (total params: 4 × 16 = 64 dims)   │
│    → Self-attention: the sequence attends to itself  │
│      (Q=K=V=x), finding internal relationships.      │
│                                                     │
│  Residual Connection: Add(x, attention_output)      │
│    → Adds the original input back to the attention   │
│      output. This prevents the "vanishing gradient"  │
│      problem — gradients can flow directly through   │
│      the skip connection during backpropagation.     │
│    → Inspired by ResNet (He et al., 2015).          │
│                                                     │
│  LayerNormalization                                 │
│    → Normalizes across the 128 features at each     │
│      time step. Stabilizes training and speeds       │
│      convergence.                                    │
│                                                     │
│  Output: (batch, 15, 128)                           │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  STAGE 4: SECOND BILSTM (SEQUENCE COMPRESSION)     │
│                                                     │
│  BiLSTM(32 units, return_sequences=False)           │
│    → Another bidirectional LSTM, but this time       │
│      return_sequences=False means it only outputs    │
│      the FINAL hidden state — compressing the        │
│      entire 15-step attended sequence into a single  │
│      64-dimensional vector (32 forward + 32 back).   │
│    → This is the model's "summary" of the entire     │
│      60-day window after CNN feature extraction,     │
│      sequential processing, and attention weighting. │
│                                                     │
│  Dropout(0.4)                                       │
│    → Another 40% dropout for regularization.         │
│                                                     │
│  Output: (batch, 64)                                │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  STAGE 5: DENSE PREDICTION HEAD                     │
│                                                     │
│  Dense(32, ReLU, L2 reg)                            │
│    → Fully connected layer. Takes the 64-dim        │
│      sequence summary and transforms it through      │
│      32 neurons. ReLU activation allows non-linear   │
│      decision boundaries.                            │
│                                                     │
│  BatchNormalization                                 │
│    → Normalizes the 32 activations across the       │
│      batch. Reduces internal covariate shift,        │
│      allowing higher learning rates.                 │
│                                                     │
│  Dense(16, ReLU, L2 reg)                            │
│    → Further compression: 32 → 16 neurons.          │
│      Creates a compact representation before the     │
│      final prediction.                               │
│                                                     │
│  Dense(1, Linear activation)                        │
│    → The final output neuron. Linear activation      │
│      (no squashing) because this is a regression     │
│      task — we need to output any real number        │
│      (the predicted return value).                   │
│                                                     │
│  Output: (batch, 1) → predicted next-day return     │
└─────────────────────────────────────────────────────┘
```

**Total Parameters:** 151,361 trainable parameters

**Why this specific architecture?**
- **CNN first:** Extracts local patterns (3-day windows) efficiently. Much faster than feeding raw data directly to LSTM.
- **BiLSTM second:** Captures long-range dependencies (how patterns from 2 weeks ago affect today). Bidirectional ensures no information loss from sequence direction.
- **Attention third:** Learns which days matter most. In financial data, a single earnings announcement day can be more important than 50 normal days. Attention lets the model focus on those critical moments.
- **Second BiLSTM:** Compresses the attended sequence into a fixed-size vector. This two-stage LSTM approach (wide→narrow) progressively refines the temporal representation.
- **Dense head:** Maps the compressed representation to the final prediction.

**Training Configuration:**
| Setting | Value | Why |
|---------|-------|-----|
| Loss: Huber(δ=1.0) | Hybrid MSE/MAE | Robust to outliers (market crashes), unlike pure MSE which would overweight extreme days |
| Optimizer: Adam(lr=0.001) | Adaptive learning rate | Adjusts per-parameter learning rates automatically |
| Gradient clipping: clipnorm=1.0 | Prevents exploding gradients | Financial data has sudden jumps that can destabilize training |
| L2 regularization: 1e-4 | Weight decay on all layers | Penalizes large weights to prevent overfitting |
| Dropout: 0.4 | 40% connection dropping | Forces redundant feature learning |
| EarlyStopping: patience=25 | Stops when val_loss plateaus | Prevents training too long and overfitting |
| ReduceLROnPlateau: patience=8, factor=0.5 | Halves LR when stuck | Fine-tunes in later epochs |
| Batch size: 32 | Mini-batch gradient descent | Balance between speed and gradient noise |

### Deep Dive: Linear Model (ElasticNetCV)

**Simple explanation:** The linear model is like a checklist with 51 questions about today's market (e.g., "Did the price go up yesterday?", "Is oil rising?", "Is it Sunday?"). Each question has a weight (coefficient) that the model learned during training. It multiplies each answer by its weight, adds them up, and gets a prediction. The ElasticNet regularization automatically crosses out irrelevant questions, keeping only the ones that actually matter.

```
Input: (1, 51) — one row of 51 engineered features
  │
  ▼
┌──────────────────────────────────────────────────────┐
│  FEATURE CATEGORIES (51 features)                    │
│                                                      │
│  Returns (6):                                        │
│    return_1, return_2, return_3, return_5,           │
│    return_10, return_21                              │
│    → Price changes over 1/2/3/5/10/21 days          │
│    → Captures momentum at multiple time scales       │
│                                                      │
│  Slopes (3):                                         │
│    slope_5, slope_10, slope_21                       │
│    → Linear regression slope over rolling windows    │
│    → Normalized by price level for comparability     │
│    → Captures trend direction AND strength           │
│                                                      │
│  Moving Average Ratios (3):                          │
│    ma_ratio_5_20, ma_ratio_10_50, ma_ratio_5_10     │
│    → When short MA > long MA, trend is up            │
│    → Ratios > 1 = bullish, < 1 = bearish            │
│    → Classic trend-following signals                 │
│                                                      │
│  Volatility (4):                                     │
│    volatility_5, volatility_10, volatility_21,       │
│    vol_ratio                                         │
│    → Standard deviation of returns at different       │
│      windows. vol_ratio = short/long volatility      │
│    → High vol_ratio = volatility expanding           │
│                                                      │
│  Technical Indicators (5):                           │
│    rsi_14, macd, macd_signal, macd_hist, bb_position │
│    → RSI: 0-100 momentum oscillator                  │
│    → MACD: normalized by price for comparability     │
│    → bb_position: where price sits in Bollinger band │
│                                                      │
│  Volume (2):                                         │
│    volume_ratio, volume_change                       │
│    → volume_ratio = today/20-day avg volume          │
│    → Spikes indicate institutional activity          │
│                                                      │
│  Regime Dummies (6):                                 │
│    rsi_overbought, rsi_oversold, macd_positive,      │
│    high_volume, high_volatility, trend_up            │
│    → Binary flags (0/1) that help linear models      │
│      find threshold effects they can't model          │
│      with continuous features alone                   │
│                                                      │
│  Calendar (4):                                       │
│    is_sunday, is_thursday, days_since_friday, is_q4  │
│    → Saudi market trades Sun-Thu                     │
│    → Sunday often has weekend gap effects             │
│    → Q4 has end-of-year seasonality                  │
│                                                      │
│  Macro (12):                                         │
│    oil_return_1/5, oil_volatility_10,                │
│    sp500_return_1/5, futures_return,                 │
│    gold_return_1/5, dxy_return_1/5,                  │
│    vix_level, vix_change                             │
│    → Saudi market heavily correlated with oil         │
│    → VIX = "fear index" of global markets            │
│    → S&P futures capture overnight US moves          │
│                                                      │
│  Interaction Terms (6):                              │
│    oil_x_sunday, futures_x_sunday,                   │
│    return1_x_volume, oil_x_volatility,              │
│    sp500_x_trend, vix_x_return                      │
│    → Feature × Feature products                      │
│    → Critical for linear models: captures non-linear │
│      relationships without adding model complexity   │
│    → Example: oil_x_sunday captures the fact that    │
│      oil price moves over the weekend affect          │
│      Sunday's TASI opening differently than          │
│      midweek oil moves                               │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│  STANDARDSCALER                                      │
│    → Centers each feature to mean=0, std=1           │
│    → Ensures all features contribute equally          │
│    → Fitted on training data only (no leakage)       │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│  ELASTICNET REGRESSION                               │
│                                                      │
│  predicted_return = β₀ + β₁x₁ + β₂x₂ + ... + β₅₁x₅₁│
│                                                      │
│  The model learns 51 coefficients (β) + 1 intercept  │
│  Each coefficient = how much that feature affects     │
│  tomorrow's predicted return.                         │
│                                                      │
│  ElasticNet = L1 (Lasso) + L2 (Ridge) regularization │
│                                                      │
│  Loss = MSE + α × [ρ × |β| + (1-ρ)/2 × β²]         │
│                                                      │
│  L1 (Lasso) penalty: |β|                             │
│    → Pushes weak coefficients to exactly ZERO         │
│    → Automatic feature selection — irrelevant         │
│      features get zeroed out                          │
│    → Makes the model sparse and interpretable         │
│                                                      │
│  L2 (Ridge) penalty: β²                              │
│    → Shrinks all coefficients toward zero             │
│    → Prevents any single feature from dominating      │
│    → Handles correlated features better than L1 alone │
│                                                      │
│  ElasticNetCV:                                       │
│    → CV = Cross-Validation                           │
│    → Automatically tests l1_ratio = [0.1, 0.3, 0.5,  │
│      0.7, 0.9] to find the optimal L1/L2 balance     │
│    → 5-fold CV for each ratio                        │
│    → Selects the combination with lowest CV error     │
│                                                      │
│  Walk-Forward Validation:                            │
│    → Unlike the CNN's fixed 70/15/15 split, the      │
│      linear model uses expanding-window validation:   │
│      Train on days 1-1000, test on 1001-1021         │
│      Train on days 1-1021, test on 1022-1042         │
│      ... and so on, stepping 21 days at a time       │
│    → More realistic: simulates actual trading where   │
│      you always train on past and predict future      │
│                                                      │
│  Output: predicted_return (single float)             │
│  → Convert to price: close × (1 + predicted_return)  │
└──────────────────────────────────────────────────────┘
```

**Why ElasticNet won over Ridge and BayesianRidge:**
The training script compared all three via walk-forward validation and selected based on filtered Sharpe ratio. ElasticNet's L1 penalty zeroed out irrelevant features, giving a cleaner signal. The final model likely uses only ~30-40 of the 51 features (the rest have coefficient = 0).

### How to Explain the Architecture Simply

If Dr. Fawaz asks "explain your model in simple terms":

> "Think of our CNN model as a three-stage brain:
>
> **Stage 1 (CNN):** Like a pattern scanner — it slides a magnifying glass over the last 60 days of market data, looking for short-term patterns like price spikes, volume surges, or technical indicator crossovers.
>
> **Stage 2 (BiLSTM):** Like a memory system — it reads the patterns in both directions (past-to-present AND present-to-past) to understand the sequence and context. It remembers that a price drop 3 weeks ago might be related to today's recovery.
>
> **Stage 3 (Attention):** Like a spotlight — it learns which days are most important. Not all 60 days matter equally. A day with a major oil price crash matters more than a normal trading day. The attention mechanism automatically learns to focus on the critical moments.
>
> The Linear model is simpler — it's one equation with 51 carefully designed features. It can't see complex patterns like the CNN, but you can read exactly which features drove each prediction, making it transparent and auditable."

---

## 6. Data Pipeline Explained

**Simple explanation:** Before the AI models can predict anything, we need clean, organized data. The pipeline goes: collect raw data (prices + news) → compute technical indicators → clean and remove noise → scale everything to the same range → feed to the models. Every step is automated — just run `python predict.py` and it handles everything.

### Step 1: Data Acquisition
- TASI historical prices from Yahoo Finance API (`^TASI.SR`)
- 4,300+ trading days from October 2008 to today
- OHLCV: Open, High, Low, Close, Volume
- Macroeconomic data: Oil (Brent), S&P 500, Gold, Dollar Index (DXY), US 10-Year Treasury rate
- All data auto-fetched and stored in Supabase `market_data` table

### Step 2: Technical Indicators
Computed using the `ta` library (not manual calculations):
- **RSI (14):** Relative Strength Index — measures overbought/oversold conditions
- **MACD:** Moving Average Convergence Divergence — momentum and trend
- **ATR (14):** Average True Range — real volatility (uses High/Low/PrevClose)
- **Bollinger Width:** Measures volatility expansion/contraction
- **SMA_50:** 50-day Simple Moving Average — medium-term trend
- **EMA_20:** 20-day Exponential Moving Average — short-term trend

### Step 3: Sentiment Analysis
- **Sources:** 17 Google News RSS feeds (8 Arabic + 9 English)
- **Pipeline:** Fetch articles → Filter Saudi-specific keywords → Translate Arabic to English using MarianMT → Score with FinBERT NLP model
- **Arabic articles:** Hybrid scoring = 60% Arabic lexicon + 40% FinBERT
- **English articles:** 100% FinBERT
- **Output:** Score (-100 to +100), Confidence (0-100%), Label (Bullish/Neutral/Bearish)

### Step 4: Preprocessing (CNN model)
1. **Wavelet denoising** (DWT, db4 wavelet, level 2) — removes noise from price data
2. **Returns conversion** — converts prices to percentage changes for stationarity
3. **IQR outlier capping** — caps extreme values to prevent model distortion
4. **RobustScaler** — scales features to comparable ranges (fitted on training data ONLY to prevent data leakage)

### Step 5: Prediction
- CNN: Takes (1, 60, 19) tensor → outputs predicted return → converts to SAR price
- Linear: Takes (1, 51) feature vector → outputs predicted return → converts to SAR price
- Both store results in Supabase `ai_predictions` table with confidence scores

---

## 7. Confidence Score Explained

**This is a heuristic Signal Score, not a calibrated probability.** A 75% on the ring does **not** mean "75% chance the prediction is correct." It is a 0–100 score blending three pieces of evidence: how accurate *this exact (symbol, model)* has been on its own past predictions, how decisive the current predicted move is, and whether today's news sentiment agrees with the direction.

The formula lives in `_compute_confidence()` in [predict.py](predict.py).

| Component | Points | How it's computed |
|---|---|---|
| **Base** | 50 | Neutral starting point — confidence has to be *earned* with evidence |
| **Per-(symbol, model) historical accuracy** | 0 to +30 | Average `error_percentage` from `model_accuracy_log` filtered to **only this model's past predictions**. <0.5% → +30, <1% → +20, <2% → +10, <5% → +5, otherwise 0. **A brand-new model with no validated predictions yet contributes 0** — the system refuses to claim confidence it has not earned. |
| **Signal strength** | 0 to +15 | \|predicted change %\| > 2% → +15, > 1% → +10, > 0.3% → +5 |
| **Sentiment alignment** | −5 to +10 | Only counted when sentiment confidence > 50%. Sentiment direction agrees with prediction → +10; contradicts → −5 |

Final score = clamp(sum, 0, 100).

**What is NOT in the formula** (and why):
- **No model-type preference** (e.g., "+10 if CNN"). A previous version of the formula gave CNN an unconditional bonus, but that's a *preference* not *evidence* — the per-model accuracy lookup already rewards whichever model is performing better on this exact stock.
- **No global error average across all models.** The accuracy lookup is filtered to `ai_predictions.model_id == this_prediction.model_id`, so SABIC's CNN does not inherit confidence from TASI's Linear or vice versa.

**Colour coding on the ring** (frontend):
- 90%+ = dark green (very high confidence)
- 80–89% = green (high confidence)
- 70–79% = orange (moderate confidence)
- Below 70% = red (low confidence)

**Migration note for the demo:** the per-stock CNN/Linear models that were trained in the multi-stock integration step have **no validated predictions yet** in `model_accuracy_log` (their target dates haven't passed), so their confidence will sit at base+signal+sentiment only — typically 50–65%. As `_check_past_predictions_accuracy()` populates the log over the coming days, those numbers will start to move based on *each model's own track record*. This is the correct, honest behaviour, and worth mentioning if a reviewer asks why the new stocks show lower confidence than TASI initially.

---

## 8. Technical Details for Q&A

### Tech Stack
| Component | Technology |
|-----------|-----------|
| AI Models | TensorFlow/Keras (CNN), scikit-learn (Linear) |
| Data | pandas, numpy, yfinance |
| NLP | transformers (FinBERT, MarianMT), feedparser |
| Preprocessing | PyWavelets, scikit-learn RobustScaler |
| Technical Indicators | `ta` library |
| Database | Supabase (hosted PostgreSQL) |
| Backend API | FastAPI (Python) |
| Frontend | React 18, React Router 6 |
| Styling | CSS-in-JS (inline styles), dark/light theme |
| i18n | Custom context (English + Arabic RTL) |

### Key Design Decisions
1. **Chronological split (70/15/15)** — no random shuffling, prevents future data leaking into training
2. **Scaler fitted on training data only** — prevents data leakage
3. **Huber loss** — robust to outliers (better than MSE for financial data)
4. **Wavelet denoising** — removes market noise while preserving signal
5. **Two models** — CNN for accuracy, Linear for interpretability and comparison
6. **FastAPI bridge** — React can't run Python; FastAPI serves as the translator between frontend and backend
7. **Supabase** — hosted PostgreSQL with built-in auth, real-time, and REST API

### File Structure
```
Grap_Project_Insight/
├── api/                          # FastAPI backend
│   ├── main.py                   # App setup, CORS, route mounting
│   └── routes/
│       ├── stocks.py             # Stock data endpoints
│       ├── predictions.py        # Prediction + confidence endpoints
│       ├── auth.py               # Authentication endpoints
│       └── watchlist.py          # Watchlist endpoints
├── frontend/                     # React website
│   ├── src/
│   │   ├── App.js                # Router + protected routes
│   │   ├── StockData.js          # API helpers + model colors
│   │   ├── LanguageContext.js     # EN/AR translations
│   │   ├── Pages/                # Dashboard, StockDetail, AllStocks, etc.
│   │   ├── components/           # Layout, SearchInput, buttons
│   │   ├── hooks/                # useWatchlist, useSmartBack
│   │   └── utils/                # auth, navigation, watchlist
│   └── package.json
├── data_acquisition/
│   └── market_data.py            # DataAcquisitionService
├── preprocessing/
│   └── engine.py                 # PreprocessingEngine
├── technical_analysis/
│   └── indicators.py             # TechnicalAnalysisService
├── prediction/
│   ├── engine.py                 # CNN-BiLSTM-Attention model
│   └── linear/
│       ├── features.py           # 51 feature engineering
│       └── engine.py             # LinearPredictionEngine
├── sentiment/
│   └── analyzer.py               # SentimentAnalyzer (FinBERT + MarianMT)
├── db/
│   └── supabase_client.py        # All Supabase operations
├── models/
│   ├── TASI_Model_v3.keras       # Trained CNN model
│   ├── TASI_Scaler_v3.pkl        # CNN scaler
│   ├── tasi_linear_model.pkl     # Trained Linear model
│   ├── tasi_linear_scaler.pkl    # Linear scaler
│   ├── finbert/                  # Cached FinBERT model
│   └── opus-mt-ar-en/            # Cached MarianMT translation model
├── train_model.py                # CNN training pipeline
├── predict.py                    # CLI prediction (both models)
├── evaluate.py                   # Model evaluation + backtest
└── TASI_Historical_Data.csv      # Backup CSV data
```

---

## 9. Honest Metrics, Methodology, and Limitations

This section is the part to memorise for defense. The headline number for the
CNN — "R² = 0.9963 on TASI" — is **technically true but misleading on its own**
because it's computed on price levels, where `prev_close` autocorrelation
dominates. The honest reading puts that number alongside the right comparisons.

### 9.1 Honest TASI metrics (CNN v4, the corrected pipeline)

Test period: 2023-08-27 → 2026-03-26 (646 trading days)

| Metric | Model (v4) | Naive 'predict yesterday' | Reading |
|---|---|---|---|
| **Price space** | | | |
| MAE  | 21.72 SAR | 68.70 SAR | Model is 3.2× better than naive in price MAE |
| MAPE | 0.19% | — | Below the 0.5–2% range typical for daily-index LSTM/CNN papers |
| R² (price) | 0.9963 | 0.9762 | Model adds ~2 pp on top of naive — **most of the 0.99 is just price autocorrelation** |
| **Return space (the honest one)** | | | |
| R² (returns) | 0.4934 | 0.4717 | Genuine signal: model adds ~2 pp of explained variance over naive |
| Direction acc (returns) | 83.28% | — | On wavelet-smoothed returns; raw-return direction would be lower |

**v3 → v4 (after the leakage fix):** MAE dropped 24.64 → 21.72 SAR, R²(returns)
rose 0.4603 → 0.4934, model/naive MAE ratio improved 0.359 → 0.316. The
leakage fix did not sacrifice performance — it made the model strictly better.

### 9.2 Methodology you can defend

The training pipeline was rewritten in this iteration to remove two classic
time-series-leakage patterns identified during the audit:

1. **Wavelet denoising is now per-slice.** The `pywt.wavedec` basis is global,
   so denoising the full series before splitting smooths past samples using
   future information. Fix: `prepare_data()` splits first, then denoises
   train, val, and test independently.
2. **IQR outlier bounds are now train-only.** `fit_outlier_bounds(train)` →
   `apply_outlier_bounds(slice)` — test outliers can no longer pull the
   clipping bounds toward themselves.
3. **RobustScaler is fit on the train slice only** (this was already correct).
4. **Reproducibility:** `set_seed(42)` is called at the top of `train_model.py`,
   `predict.py`, and `evaluate.py`. It seeds Python `random`, NumPy,
   TensorFlow, and `PYTHONHASHSEED`, plus enables TF op-determinism.
   Running training twice produces identical test metrics.
5. **Honest evaluation:** `evaluate.py` now reports two metric tables —
   price-space (the marketing R²) **and** return-space (the honest R²) — and
   prints the naive lag-1 baseline (both MAE and R²) alongside both.

### 9.3 Limitations (own them in the writeup)

| # | Limitation | Why it matters |
|---|---|---|
| L1 | **Macro-feature timing**: TASI closes ~13:00 GMT, US markets close ~21:00 GMT. We merge by date, so day-`t` US close is technically after TASI's close. Predictions are generated *after the US close, before the TASI open the next day* — under that operating assumption the alignment is correct. | Acknowledge explicitly in the methodology section to pre-empt the question. |
| L2 | **Sentiment date-stamping** is approximate (last 3 days of articles assigned to "today"). Fine for live prediction, approximate for historical backtest. | Flag as "future work: per-day timestamped sentiment". |
| L3 | **TASI sentiment used as a market-wide proxy** for the 5 individual stocks. Works well for ARAMCO/SABIC (high TASI correlation, ~0.6) and is weakest for SECO (~0.4). | Document as a deliberate v1 scope choice. |
| L4 | **Direction-on-returns metric** (83.28%) is computed on *denoised* returns. Wavelet smoothing inflates this vs raw-return direction accuracy. | Compute raw-return direction in the appendix as a cross-check. |
| L5 | **No ARIMA/GARCH baseline** — only naive lag-1. A formal time-series benchmark would strengthen the comparison. | Listed as "future work". |
| L6 | **Linear model on individual stocks underperforms naive** in return space (RAJHI R²(returns) = −3.05). Linear regression isn't well-suited to per-stock daily returns; the CNN is the workhorse for individual stocks. | Surface honestly — explains why the dashboard prioritises CNN per stock. |
| L7 | **ARAMCO has only ~6 years of data** (IPO Dec 2019). Lower statistical power than the other 4 stocks. | State explicitly when discussing per-stock results. |

### 9.4 Comparison with prior work

| Reference | MAPE on daily indices | Direction acc (returns) | Notes |
|---|---|---|---|
| Random-walk theory | n/a | ~50% | Daily returns are nearly unpredictable |
| Published equity-return literature | 0.5–2% | 50–60% | R²(returns) usually 0.01–0.05; >0.20 is a leakage red flag |
| **Insight CNN v4 on TASI** | **0.19%** | **83.28% (denoised)** | R²(returns) = 0.49 is high; partly inflated by denoising |

Many published "LSTM beats stocks" papers have been criticised for the exact
wavelet-leakage pattern we identified and fixed. Owning that we caught it is
a stronger position than pretending the inflated number was real.

---

## 10. Common Questions & Answers

**Q: Why not just use a simple moving average?**
> The CNN beats the naive "predict yesterday's price" baseline by a wide margin on price MAE — model MAE is 21.7 SAR vs naive 68.7 SAR (a ratio of 0.32, i.e., the model's price error is ~32% of the naive's). On the harder return-space R², the CNN reaches 0.49 while naive returns R² is 0.47, so it adds ~2 percentage points of genuine predictive signal beyond price autocorrelation. See Section 11 for the honest metric breakdown.

**Q: How do you prevent overfitting *and* data leakage?**
> Five layers: (1) **Per-slice wavelet denoising** — denoising is applied to train, val, and test slices independently, so future samples never smooth past samples. (2) **IQR outlier clipping bounds fit on the train slice only** and reused on val/test. (3) **RobustScaler also fit on train only.** (4) **Chronological 70/15/15 split** — no random shuffle. (5) **Dropout 0.4 + L2 + EarlyStopping(25) + ReduceLROnPlateau**. Plus a **fixed seed (42)** for full reproducibility — running the trainer twice gives identical test metrics.

**Q: Why two models instead of one?**
> Different approaches give complementary signals. CNN captures non-linear sequence patterns; Linear (ElasticNetCV) is fully interpretable per-feature. When both agree on direction, the dashboard's confidence boosts. The two also act as a sanity check on each other.

**Q: TASI plus individual stocks?**
> The system now covers six symbols: **TASI** (the index), **ARAMCO**, **RAJHI**, **SABIC**, **STC**, **SECO** (the five sector-leading Tadawul stocks). Each has its own per-stock CNN and Linear model trained from its own OHLCV history; sentiment is reused from the TASI-wide score as a v1 proxy. Run `python predict.py --symbol SABIC` to predict any of them.

**Q: How does sentiment analysis work?**
> We scrape 17 Google News RSS feeds daily (8 Arabic, 9 English). Arabic articles are translated to English using the MarianMT neural translation model. All articles are scored using FinBERT — a BERT model fine-tuned on financial text. The sentiment score ranges from -100 (very bearish) to +100 (very bullish).

**Q: What is the confidence score based on?**
> Three factors: (1) Historical accuracy — how accurate was this model on past predictions, (2) Signal strength — how decisive is the predicted move, (3) Sentiment alignment — does the news sentiment agree with the prediction direction.

**Q: Why FastAPI?**
> The AI models are written in Python (TensorFlow, scikit-learn). The frontend is React (JavaScript in the browser). FastAPI acts as a bridge — it's a Python web server that translates React's HTTP requests into Python function calls, runs the models, queries Supabase, and returns JSON data. We chose FastAPI over Flask/Django because it's the fastest Python web framework and auto-generates API documentation.

**Q: Could this be used for real trading?**
> This is a research/educational project for graduation. While the accuracy metrics are good, real trading requires additional considerations: transaction costs, slippage, risk management, regulatory compliance, and real-time data feeds. The system demonstrates the methodology and achieves the academic objectives.

**Q: How does the website get data?**
> React frontend → HTTP request → FastAPI backend → Supabase database → returns JSON → React renders it. The flow is: user opens page → React calls `/api/stocks` → FastAPI queries Supabase → returns stock data with predictions → React displays it.

---

## 11. Troubleshooting

### "Website shows empty/loading"
- Make sure both terminals are running (API + Frontend)
- Check http://localhost:8000/api/health returns `{"status":"ok"}`

### "API won't start"
- Check you're in the right directory: `c:\Users\Admin\Desktop\Grap_Project_Insight`
- Check `.env` file has Supabase credentials
- Try: `pip install fastapi uvicorn`

### "Frontend won't start"
- Check you're in: `c:\Users\Admin\Desktop\Grap_Project_Insight\frontend`
- Try: `npm install` first, then `npm start`

### "Predictions show old data"
- Run: `python predict.py --model-type all --no-sentiment`
- Refresh the browser

### "Confidence shows 0%"
- Old predictions didn't have confidence. Run a new prediction:
  `python predict.py --model-type all`

### Ports already in use
```
# Kill everything and restart
taskkill /f /im python.exe
taskkill /f /im node.exe
```
