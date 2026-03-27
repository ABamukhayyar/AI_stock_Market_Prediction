# Insight — AI-Assisted Saudi Stock Market Prediction System

## Project Overview
CSC 496 graduation project (King Saud University). AI-assisted decision-making system for TASI (Saudi stock market) analysis. Predicts next-day closing prices using deep learning, technical analysis, and sentiment analysis.

**Team:** Abdullah Bamukhayyar + 4 members | **Supervisor:** Dr. Fawaz Alsulaiman
**GitHub:** https://github.com/ABamukhayyar/AI_stock_Market_Prediction
**Frontend:** React (handled by another team member) | **Backend:** Python (TensorFlow, yfinance, pandas)

---

## System Architecture (from report Figs 29-30)

```
[External APIs] → [Data Acquisition] → [Preprocessing] → [Technical Analysis]
                                                                    ↓
[User/Dashboard] ← [Visualization] ← [Prediction Engine] ← [Feature Store/DB]
                                                                    ↑
                                              [Sentiment Analysis] ─┘
```

### Project Structure (maps to report class diagrams)
```
data_acquisition/market_data.py     → DataAcquisitionService class
preprocessing/engine.py             → PreprocessingEngine class
technical_analysis/indicators.py    → TechnicalAnalysisService class
prediction/engine.py                → PredictionEngine class
models/                             → Saved .keras and .pkl files
notebooks/                          → Jupyter notebooks (training experiments)
train_model.py                      → ModelTrainer class
predict.py                          → CLI prediction entry point
evaluate.py                         → Backtest + metrics
requirements.txt
```

---

## Current State

### Old Model (TASI_Golden_Model_2.keras) — DO NOT USE FOR PRODUCTION
- Binary classification (up/down), NOT price prediction
- 56% accuracy (barely above 50% random chance)
- **Critical bugs:** fake ATR (= 0.02×Price instead of real volatility), data leakage (scaler fit on all data)
- Scaler: TASI_Golden_Scaler_2.pkl (RobustScaler)

### New Model To Build: CNN-BiLSTM-Attention
- **Task:** Next-day closing price prediction (regression)
- **Architecture:** Conv1D → MaxPool → BiLSTM → MultiHeadAttention → BiLSTM → Dense → Linear
- **Features (~15):** OHLCV + RSI + MACD + real ATR + Bollinger Width + SMA_50 + EMA_20 + Oil + SP500 + Gold + DXY + Interest_Rate
- **Lookback:** 60 days (optimal — see plan for justification)
- **Scaler:** RobustScaler (fit on TRAINING data only)
- **Preprocessing:** Wavelet denoising (DWT, db4 wavelet) + IQR outlier detection
- **Loss:** Huber (delta=1.0) — handles volatility spikes
- **Optimizer:** Adam (lr=0.001)
- **Batch:** 32, Epochs: 100, EarlyStopping patience=20, ReduceLROnPlateau
- **Split:** 70% train / 15% val / 15% test (chronological)
- **Target metrics:** MAPE < 10%, R² > 0.5

---

## Data Sources

### TASI Historical Data
- CSV: `TASI_Historical_Data.csv` — Oct 2008 to Sep 2024, ~3,986 trading days
- Columns: Date, Open, High, Low, Price (Close), Change%, Volume
- Volume uses K/M/B suffixes — must parse

### Macroeconomic Data (via yfinance)
- Oil: `BZ=F` (Brent Crude)
- S&P 500: `^GSPC`
- Gold: `GC=F`
- Dollar Index: `DX-Y.NYB`
- Interest Rate: `^TNX` (US 10Y Treasury)
- Merge by date with forward-fill

---

## Technical Indicators (use `ta` library — NOT manual calculations)

| Indicator | Formula | Purpose |
|-----------|---------|---------|
| RSI (14) | 100 - 100/(1+RS), RS = AvgGain/AvgLoss | Overbought/oversold |
| MACD | EMA_12 - EMA_26 | Momentum/trend |
| ATR (14) | rolling_mean(max(H-L, \|H-PrevC\|, \|L-PrevC\|)) | **REAL** volatility |
| Bollinger Width | (Upper - Lower) / Middle band | Volatility expansion |
| SMA_50 | 50-day simple moving average | Medium-term trend |
| EMA_20 | 20-day exponential moving average | Short-term trend |

**CRITICAL:** ATR MUST use real High/Low/PrevClose. The old model used `Price * 0.02` which is WRONG.

---

## Prediction Caching Architecture

**Approach: Scheduled Daily Generation (preferred over on-demand)**
1. Cron job runs after market close (~4:00 PM Saudi time)
2. Fetches latest data → computes indicators → runs all active models
3. Saves predictions to `ai_predictions` table
4. Dashboard reads pre-computed predictions (instant load for users)
5. After target date passes → compare actual vs predicted → update `model_accuracy_log`
6. On-demand prediction as fallback for new stocks added to watchlist

---

## Dependencies
```
tensorflow
numpy
pandas
scikit-learn
yfinance
matplotlib
pywt          # Wavelet denoising
ta            # Technical indicators (correct implementations)
```

---

## Phases
1. **Phase 1 (current):** Build CNN-BiLSTM-Attention model for TASI index
2. **Phase 2:** Integrate sentiment analysis as additional feature
3. **Phase 3:** Expand to individual stocks (SABIC, STC, Alrajhi, Almarai)
4. **Phase 4:** Build Flask/FastAPI backend + scheduled prediction cron job
5. **Phase 5:** Implement PostgreSQL database (Feature Store Architecture from report Section 5.5)

---

## Verification Rules

### Before Training
- [ ] Confirm TASI CSV has Open, High, Low, Close, Volume columns
- [ ] Confirm ATR is calculated using REAL True Range (not Price × 0.02)
- [ ] Confirm scaler is fit ONLY on training data, NOT on test/validation
- [ ] Confirm train/val/test split is chronological (no random shuffling)
- [ ] Confirm wavelet denoising is applied before scaling
- [ ] Confirm no NaN values in feature matrix after preprocessing
- [ ] Print feature matrix shape and verify: (samples, 60, num_features)
- [ ] Print class/target distribution to check for imbalance

### During Training
- [ ] Monitor val_loss is decreasing (not just train_loss)
- [ ] Check for overfitting: if train_loss << val_loss, add more regularization
- [ ] Verify EarlyStopping triggers before max epochs (if it runs all 100 epochs, model may not be converging)
- [ ] Log training curves (loss + MAE per epoch) for visual inspection

### After Training — Model Evaluation
- [ ] Compute ALL metrics on TEST set: RMSE, MAE, MAPE, R²
- [ ] MAPE should be < 10% (ideally < 5%)
- [ ] R² should be > 0.5 (ideally > 0.7)
- [ ] Generate Actual vs Predicted price chart — visually inspect alignment
- [ ] Check predictions aren't "lagging" (just copying yesterday's price shifted by 1 day — a common LSTM failure mode)
- [ ] Verify predictions span a realistic range (not all clustering around the mean)
- [ ] Run predictions on 3 different time periods (bull market, bear market, sideways) to test robustness
- [ ] Compare with old Golden Model metrics

### Prediction Pipeline Verification
- [ ] `predict.py` runs end-to-end without errors
- [ ] Output is a reasonable price (within ±10% of recent TASI range)
- [ ] Inverse scaling produces actual SAR price (not scaled 0-1 value)
- [ ] Run prediction 3 times with same input — verify same output (deterministic)
- [ ] Test with deliberately bad input (missing data, NaN) — should fail gracefully with error message

### Cross-Verification (run these EVERY TIME you modify the pipeline)
- [ ] Re-run evaluation on test set after any code change
- [ ] Compare metrics before and after change — document if they improved or regressed
- [ ] If accuracy drops after a change, revert and investigate
- [ ] Double-check scaler inverse transform: `scaler.inverse_transform(prediction)` should give a number in the TASI price range (currently ~11,000-13,000 SAR)
- [ ] Verify feature order matches between training and inference (same column order)
- [ ] Verify the 60-day window is aligned correctly (day 1 = oldest, day 60 = most recent)

### Before Deployment / Integration
- [ ] Run full backtest on 2024 data (walk-forward: predict day N, compare, advance to N+1)
- [ ] Report win rate (% of days where predicted direction was correct)
- [ ] Report average absolute error in SAR
- [ ] Save final model as `TASI_Model_v3.keras` + `TASI_Scaler_v3.pkl`
- [ ] Document model version, training date, data range, and metrics in `ai_models` registry
- [ ] Verify model file loads correctly in a fresh Python session
- [ ] Test that model + scaler work on a machine without training history (simulate production)
