# `prediction/linear/` — ElasticNetCV linear model

The "second opinion" model. Trains in seconds, fully interpretable per
feature, complements the heavier CNN.

## Files

| File | What it does |
|---|---|
| `engine.py`   | `LinearPredictionEngine` — thin wrapper around an `sklearn` `ElasticNetCV` (or `BayesianRidge` / `Ridge` if you prefer; auto-detects). `predict_price(X, last_close)` returns predicted next-day price + return. |
| `features.py` | `build_linear_features(df)` and `enrich_macro_for_linear(df)` — generate the 48 features (returns, slopes, MA ratios, volatility, RSI, MACD, Bollinger position, volume, regime dummies, calendar features, macro returns including VIX + S&P futures, and interaction terms). All features use trailing windows only — no look-ahead. |

## Usage

Training and evaluation are done via [`train_linear.py`](../../train_linear.py)
and [`evaluate.py`](../../evaluate.py); you should not need to import this
module directly.

```python
from prediction.linear.engine import LinearPredictionEngine
engine = LinearPredictionEngine()
engine.load_model("models/sabic_linear_model.pkl", "models/sabic_linear_scaler.pkl")
result = engine.predict_price(X_features, last_close=59.30)
```
