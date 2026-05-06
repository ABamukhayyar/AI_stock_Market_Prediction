# `data_acquisition/` — OHLCV loading + symbol registry

Where every other module gets its raw price data.

## Files

| File | What it does |
|---|---|
| `market_data.py`     | `DataAcquisitionService` — loads OHLCV from CSV, yfinance, or Supabase, fetches macro indicators (Oil, S&P 500, Gold, DXY, 10Y rate), and merges them onto the date index. Symbol-aware via the constructor's `symbol` and `ticker` arguments. |
| `registry.py`        | `STOCK_REGISTRY` — single source of truth mapping each symbol (TASI, ARAMCO, RAJHI, SABIC, STC, SECO) to its yfinance ticker, model paths, and label strings. **All entry-point scripts import from here.** |
| `backfill_stocks.py` | One-time bootstrap: registers the 5 individual stocks in the Supabase `stocks` table and pulls 16 years of OHLCV per symbol. Idempotent — re-runs are safe. Uses `auto_adjust=True` to make returns continuous across stock-split events. |

## Common operations

```python
# Load TASI from CSV + macros from yfinance
das = DataAcquisitionService(csv_path="TASI_Historical_Data.csv", symbol="TASI", ticker="^TASI.SR")
df = das.load_all(source="csv")

# Load a stock from Supabase (data must already be backfilled)
das = DataAcquisitionService(symbol="SABIC", ticker="2010.SR")
df = das.load_all(source="supabase")
```

## Re-running the backfill

```powershell
python -m data_acquisition.backfill_stocks
```

Walkthrough in [docs/MULTI_STOCK_BACKFILL.md](../docs/MULTI_STOCK_BACKFILL.md).
