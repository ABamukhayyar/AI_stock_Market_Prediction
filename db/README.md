# `db/` — Supabase client

Single Python module that wraps every database operation in the project. Other
code never imports `supabase` directly; everything funnels through here so we
can swap or instrument the DB layer in one place.

## File

- `supabase_client.py` — singleton `get_client()` plus typed helpers for each
  table.

## What's in Supabase

| Table | Purpose | Helper functions |
|---|---|---|
| `stocks`               | Symbol registry (TASI + 5 stocks) | (read via API routes) |
| `market_data`          | OHLCV per symbol per date | `get_market_data()`, `upsert_market_data()` |
| `technical_indicators` | RSI, MACD, ATR, etc. per day per symbol | `upsert_technical_indicators()` |
| `sentiment_analysis`   | Daily news sentiment score per symbol | `get_sentiment()`, `upsert_sentiment()` |
| `ai_models`            | Model registry; one row per `(symbol, model_type, version)` | `register_model()`, `get_or_register_model()` |
| `ai_predictions`       | Stored predictions (predicted close + confidence + metadata) | `insert_prediction()` |
| `model_accuracy_log`   | Actual close vs predicted, computed when target_date passes | `log_accuracy()` |
| `users`, `user_watchlists` | Auth and per-user watchlists | (used by `api/routes/auth.py`, `api/routes/watchlist.py`) |

## Configuration

Reads `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (preferred for writes) or
`SUPABASE_ANON_KEY` from the project's `.env`.
