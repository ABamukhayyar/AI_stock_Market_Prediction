# `sentiment/` — news → score pipeline

Computes a daily TASI-wide sentiment score. The 5 individual stocks reuse this
score as a market-wide proxy in v1 (documented as a deliberate scope choice).

## File

- `analyzer.py` — `SentimentAnalyzer` class:
  - Fetches articles from **17 Google News RSS feeds** (8 Arabic + 9 English).
  - Translates Arabic headlines via the cached **MarianMT** model
    (`models/opus-mt-ar-en/`).
  - Scores English text with **FinBERT** (`models/finbert/`).
  - Arabic articles use a hybrid: 60% Arabic financial lexicon + 40% FinBERT
    (post-translation). English articles use pure FinBERT.
  - Aggregates to a single daily row: `score` (-100..+100), `confidence`
    (0..100), `sentiment_label` (Bullish/Neutral/Bearish), `sentiment_encoded`
    (-1/0/+1), and article counts.
  - Persists to Supabase `sentiment_analysis` via
    [`db/supabase_client.upsert_sentiment`](../db/supabase_client.py).

## When it runs

Live each time you call [`predict.py`](../predict.py) without `--no-sentiment`.
The first call downloads the FinBERT and MarianMT weights into
[`models/finbert/`](../models) and [`models/opus-mt-ar-en/`](../models); after
that they are cached and inference is fast.

## Limitations to flag in the writeup

- Articles are timestamped by *fetch* day, not publication time. Fine for live
  prediction, approximate for historical backtest.
- For non-TASI stocks the score is reused unchanged ("TASI sentiment as
  proxy"). Per-company news feeds are listed as future work.
