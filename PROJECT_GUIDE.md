# Insight Project — Complete Guide

## Project File Map

```
Insight (grad project)/
├── TASI_Historical_Data.csv          <- Raw TASI data (Oct 2008 - Sep 2024)
├── requirements.txt                  <- Python dependencies
├── data_acquisition/
│   └── market_data.py                <- Loads CSV + fetches macro data from yfinance
├── technical_analysis/
│   └── indicators.py                 <- Computes RSI, MACD, ATR, Bollinger, SMA, EMA
├── preprocessing/
│   └── engine.py                     <- Wavelet denoising, outlier capping, scaling, sequencing
├── prediction/
│   └── engine.py                     <- CNN-BiLSTM-Attention model (build/train/predict)
├── train_model.py                    <- MAIN: trains the model end-to-end
├── predict.py                        <- Makes a next-day price prediction
├── evaluate.py                       <- Full evaluation + backtest + plots
├── models/
│   ├── TASI_Model_v3.keras           <- Trained model (saved after training)
│   └── TASI_Scaler_v3.pkl            <- Fitted RobustScaler
└── notebooks/                        <- Old Jupyter experiments (not needed)
```

---

## How to Run It (3 commands)

### Step 0: Install dependencies
```
cd "c:/Users/Abodi/Desktop/Insight (grad project)"
pip install -r requirements.txt
```

### Step 1: Train the model
```
python train_model.py
```
This runs the full pipeline (~10-30 min depending on hardware). It:
  1. Loads TASI CSV + downloads macro data from yfinance
  2. Computes all technical indicators
  3. Applies wavelet denoising + converts to returns + caps outliers
  4. Splits data chronologically (70/15/15)
  5. Fits scaler on training data only
  6. Builds and trains the CNN-BiLSTM-Attention model
  7. Saves model to models/TASI_Model_v3.keras and scaler to models/TASI_Scaler_v3.pkl
  8. Prints test metrics (MAE, RMSE, MAPE, R2) and saves plots

### Step 2: Make a prediction
```
python predict.py
```
Outputs something like: Predicted Next-Day TASI Close: 12,345.67 SAR

### Step 3: Full evaluation (optional but recommended)
```
python evaluate.py
```
Runs detailed evaluation: test metrics, lag check, range check, determinism check,
and saves plots to models/.

---

## What Each File Does

### 1. data_acquisition/market_data.py -- Data Acquisition

DataAcquisitionService class:
  - load_tasi()   -> Reads TASI_Historical_Data.csv, parses volumes (K/M/B suffixes),
                     removes commas from prices, standardizes column names, sorts by date
  - fetch_macro() -> Downloads 5 macroeconomic indicators via yfinance:
                       Oil (BZ=F), S&P 500 (^GSPC), Gold (GC=F),
                       Dollar Index (DX-Y.NYB), US 10Y Treasury (^TNX)
  - load_all()    -> Merges TASI + macro data by date. Forward-fills macro columns
                     (different trading calendars)

### 2. technical_analysis/indicators.py -- Technical Analysis

TechnicalAnalysisService.add_all(df) adds 6 indicators using the 'ta' library:

  RSI (14)           - Overbought (>70) / oversold (<30) signals
  MACD               - Momentum direction and trend strength
  ATR (14)           - Real volatility (uses High/Low/PrevClose, NOT fake 0.02*Price)
  Bollinger Width    - Volatility expansion/contraction
  SMA_50             - Medium-term trend direction
  EMA_20             - Short-term trend (reacts faster than SMA)

### 3. preprocessing/engine.py -- Preprocessing

PreprocessingEngine class handles 5 things:

  1. Wavelet Denoising (denoise_dataframe)
     Uses DWT (db4 wavelet, level 2) to remove noise from price/volume signals.
     Applies soft-thresholding (VisuShrink) to detail coefficients.
     This smooths random noise while keeping real trends.

  2. Returns Conversion (to_returns)
     Converts non-stationary price columns to percentage returns via pct_change().
     RSI, MACD, and Bollinger Width are already stationary so they stay as-is.
     Why? Raw prices trend upward over time (non-stationary), but returns fluctuate
     around zero (stationary), which neural networks learn much better.

  3. Outlier Capping (cap_outliers)
     IQR-based Winsorization (3x IQR). Clips extreme returns to prevent the model
     from being distracted by rare spikes (e.g., COVID crash).

  4. Scaling (fit_scaler / transform)
     RobustScaler fitted on TRAINING data only (prevents data leakage).
     Uses median and IQR instead of mean/std, so it's resistant to outliers.

  5. Sequence Creation (create_sequences)
     Creates sliding windows of 60 days. Each sample is shape (60, 16) -- the model
     sees 60 days of 16 features and predicts the next day's Close return.

  6. prepare_data()
     The full pipeline: chronological split -> fit scaler on train -> transform
     all splits -> create sequences.

### 4. prediction/engine.py -- The Model

PredictionEngine -- builds, trains, and runs the CNN-BiLSTM-Attention model.
(See "Model Architecture" section below for full details.)

### 5. train_model.py -- Training Orchestrator

ModelTrainer.run() calls everything in order:
  load data -> indicators -> denoise -> returns -> outlier cap ->
  split/scale/sequence -> build model -> train -> evaluate -> save.
This is the main file you run.

### 6. predict.py -- Inference

Loads the saved model + scaler, processes the latest data through the identical
pipeline, takes the last 60 days, and outputs a predicted price in SAR.

### 7. evaluate.py -- Evaluation

Runs comprehensive checks:
  - Test set metrics (MAE, RMSE, MAPE, R2, Direction Accuracy)
  - Lag check: compares model vs "naive baseline" (just predicting yesterday's price).
    If the model can't beat this, it's useless.
  - Range check: ensures predictions aren't all clustering around the mean
  - Determinism check: runs 3 predictions on the same input to verify identical output
  - Saves plots: actual-vs-predicted line chart, error histogram, scatter plot

---

## The Model Architecture in Detail

```
Input: (batch, 60, 16)
       |
Conv1D(32, kernel=3, ReLU) + MaxPool(2)       <- Extracts local patterns (2-3 day patterns)
       |  shape: (batch, 30, 32)
Conv1D(64, kernel=3, ReLU) + MaxPool(2)       <- Higher-level pattern extraction
       |  shape: (batch, 15, 64)
BiLSTM(64, return_sequences=True) + Dropout(0.4)    <- Temporal dependencies forward AND backward
       |  shape: (batch, 15, 128)
MultiHeadAttention(4 heads, key_dim=16) + Residual + LayerNorm  <- Learns WHICH days matter most
       |  shape: (batch, 15, 128)
BiLSTM(32, return_sequences=False) + Dropout(0.4)   <- Compresses sequence into a single vector
       |  shape: (batch, 64)
Dense(32, ReLU) + BatchNorm                   <- Non-linear transformation
Dense(16, ReLU)                               <- Further refinement
Dense(1, linear)                              <- Output: predicted next-day Close return
```

Why each layer:
  - Conv1D layers: detect short-term chart patterns (like 2-3 day price formations)
    and reduce sequence length for efficiency
  - BiLSTM layers: capture temporal dependencies. "Bi" means it reads the sequence
    both forward and backward, catching patterns an ordinary LSTM might miss
  - MultiHeadAttention: the key innovation. Instead of treating all 60 days equally,
    it learns to focus on the most relevant days. 4 attention heads let it learn 4
    different "types of relevance" simultaneously. The residual connection ensures
    information isn't lost.
  - Dropout (0.4): prevents overfitting by randomly zeroing 40% of neurons during training
  - L2 regularization (1e-4): penalizes large weights, another overfitting defense
  - BatchNormalization: stabilizes training by normalizing intermediate activations

---

## The 16 Features and Why Each Matters

  #   Feature           Category    Why it's included
  --  -------           --------    -----------------
  1   Open              Price       Opening price reveals overnight sentiment/gaps
  2   High              Price       Day's high shows buying pressure ceiling
  3   Low               Price       Day's low shows selling pressure floor
  4   Close             Price       TARGET VARIABLE. The final consensus price
  5   Volume            Activity    High volume confirms trend strength; low volume = weak moves
  6   RSI               Momentum    Identifies overbought/oversold -- mean-reversion signal
  7   MACD              Momentum    Trend direction + strength; crossovers signal reversals
  8   ATR               Volatility  Real volatility measure -- helps predict magnitude of moves
  9   Bollinger Width   Volatility  Squeeze -> expansion pattern predicts breakouts
  10  SMA_50            Trend       Price above/below 50-day SMA = bullish/bearish regime
  11  EMA_20            Trend       Short-term trend; faster reaction than SMA
  12  Oil               Macro       Saudi economy is oil-dependent -- direct TASI correlation
  13  S&P 500           Macro       Global risk appetite indicator; TASI follows global sentiment
  14  Gold              Macro       Safe-haven proxy -- inverse correlation during crises
  15  DXY               Macro       Dollar strength affects emerging market flows
  16  Interest Rate     Macro       US 10Y Treasury -- affects global capital allocation

---

## Data Split Strategy

  |<--- 70% Train --->|<--- 15% Val --->|<--- 15% Test --->|
    Oct 2008              ~2019              ~2022       Sep 2024

  - Chronological split (no random shuffling) -- critical for time-series.
    Random splits would leak future data into training.
  - Train (70%): model learns patterns here. Scaler is fit ONLY on this portion.
  - Validation (15%): used during training for EarlyStopping and ReduceLROnPlateau.
    The model never "learns" from this data, but training decisions (when to stop,
    when to reduce LR) are based on it.
  - Test (15%): completely untouched until final evaluation. This is the honest
    measure of model quality.

---

## Training Configuration

  Setting               Value               Reason
  -------               -----               ------
  Loss                  Huber (delta=1.0)   Combines MSE (small errors) + MAE (large errors).
                                            Handles volatility spikes without gradient explosion
  Optimizer             Adam (lr=0.001)     Adaptive learning rate; gradient clipping (clipnorm=1.0)
                                            prevents instability
  Batch size            32                  Good balance between speed and gradient quality
  Max epochs            100                 Upper bound; EarlyStopping usually stops earlier
  EarlyStopping         patience=25         Stops if val_loss doesn't improve for 25 epochs
  ReduceLROnPlateau     patience=8          Halves learning rate if val_loss plateaus for 8 epochs
  ModelCheckpoint       save_best_only      Only saves the model from the epoch with best val_loss
  Lookback              60 days             ~3 months of trading data per sample

---

## Evaluation Metrics

  Metric                What it measures                            Target
  ------                ----------------                            ------
  MAE                   Average absolute error in SAR               Lower is better
  RMSE                  Root mean squared error (penalizes large)   Lower is better
  MAPE                  Mean absolute percentage error              < 10%
  R2                    How much variance the model explains        > 0.5
  Direction Accuracy    % of days predicted direction was correct   > 50%

The evaluation also checks:
  - Lag detection: if model MAE is close to naive baseline MAE, the model is just
    copying yesterday's price (a known LSTM failure mode)
  - Range check: if prediction std < 30% of actual std, predictions are clustered
    around the mean (useless)

---

## Quick Reference

  I want to...                    Run this
  --------------                  --------
  Train from scratch              python train_model.py
  Predict tomorrow's close        python predict.py
  Full evaluation + plots         python evaluate.py
  Train with custom settings      python train_model.py --epochs 50 --batch-size 64 --lookback 30
  Use a different CSV             python train_model.py --csv my_data.csv
