# Multi-Stock Backfill - Sector-Leading TASI Companies

## What this adds

Extends the data pipeline beyond the TASI index to include 5 sector-leading
Saudi-listed companies. Each represents a major Tadawul sector.

- Energy: ARAMCO (Saudi Aramco, Tadawul 2222)
- Financials: RAJHI (Al Rajhi Bank, Tadawul 1120)
- Materials: SABIC (SABIC, Tadawul 2010)
- Communication Services: STC (STC, Tadawul 7010)
- Utilities: SECO (Saudi Electricity, Tadawul 5110)

## What was changed

1. Added 5 rows to the `stocks` table in Supabase (via one-time SQL insert).
2. New file `data_acquisition/backfill_stocks.py` - pulls 6 years of daily
   OHLCV from yfinance and upserts into the existing `market_data` table
   using `db.supabase_client.upsert_market_data`.

No existing files were modified. Pure addition.

## Data summary

- ~1,490 rows per stock (6 years x ~250 trading days)
- ~7,463 rows total written to `market_data`
- Date range: 2020-05-06 to 2026-05-06
- Zero NaN values across all 5 stocks

## Note on Aramco history

Saudi Aramco IPO'd on December 11, 2019, so its full history begins there.
The other 4 stocks have data going further back, but the 6-year window was
chosen to keep all 5 stocks aligned at the same start date for consistency.

## How to run

### Step 1 - Seed the stocks table (one-time, in Supabase SQL Editor)

    INSERT INTO stocks (symbol, company_name, sector, industry, country, exchange_market, currency, is_active) VALUES
      ('ARAMCO', 'Saudi Aramco',      'Energy',                 'Integrated Oil & Gas', 'Saudi Arabia', 'Tadawul', 'SAR', true),
      ('RAJHI',  'Al Rajhi Bank',     'Financials',             'Banking',              'Saudi Arabia', 'Tadawul', 'SAR', true),
      ('SABIC',  'SABIC',             'Materials',              'Petrochemicals',       'Saudi Arabia', 'Tadawul', 'SAR', true),
      ('STC',    'STC',               'Communication Services', 'Telecommunications',   'Saudi Arabia', 'Tadawul', 'SAR', true),
      ('SECO',   'Saudi Electricity', 'Utilities',              'Electric Utilities',   'Saudi Arabia', 'Tadawul', 'SAR', true)
    ON CONFLICT (symbol) DO UPDATE SET
      company_name    = EXCLUDED.company_name,
      sector          = EXCLUDED.sector,
      industry        = EXCLUDED.industry,
      country         = EXCLUDED.country,
      exchange_market = EXCLUDED.exchange_market,
      currency        = EXCLUDED.currency,
      is_active       = EXCLUDED.is_active;

### Step 2 - Run the backfill (from project root)

    python -m data_acquisition.backfill_stocks

The script is idempotent - re-running it refreshes data without duplicates.

## Next steps (separate PRs)

- Extend `sentiment/analyzer.py` to fetch per-company news (AR + EN RSS)
- Update `predict.py` to accept a `--symbol` argument
- Train per-symbol models, or a single multi-symbol model