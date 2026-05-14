# scripts/

Operational scripts for the Insight project. Not part of the user-facing
application — these are tools for running the system on a schedule.

## `daily_predict.bat`

Daily prediction entrypoint. Run via Windows Task Scheduler so the
prediction pipeline executes automatically each evening after TASI close.

### What it does

1. Changes into the repo root (relative to its own location, so the
   script works no matter where the repo is cloned).
2. Ensures `logs/` exists.
3. Runs `predict.py --model-type all` for **all six stocks**:
   `TASI`, `ARAMCO`, `RAJHI`, `SABIC`, `STC`, `SECO`. TASI runs first
   with sentiment enabled; the other five reuse that sentiment via
   `--no-sentiment` to avoid re-doing the heavy FinBERT pass.
4. Writes all stdout/stderr to one daily log: `logs/predict_YYYYMMDD.log`.

This one script refreshes **everything** the website displays. On each
`predict.py` invocation:

- **`market_data`** — `DataAcquisitionService.update_supabase()` fetches
  the latest OHLCV from yfinance and upserts new rows. Price charts,
  52-week ranges, and the latest-close baseline all become current.
- **`ai_predictions`** — one new row per (stock, model) per run. Drives
  the "Predicted close" / change % / target-date pill on every card.
- **`model_accuracy_log`** — `_check_past_predictions_accuracy()` runs
  first and writes the actual close for any prediction whose
  `target_date` has now passed. This is what makes the **Confidence
  ring numbers grow** over time — every newly-validated prediction
  contributes to the per-(model, symbol) accuracy boost.
- **`sentiment_analysis`** — today's Google News pass is stored once
  (under symbol `TASI`, market-wide for v1). Drives the sentiment
  badge on the Stock Detail page and the sentiment-alignment
  component of the confidence score.
- **`technical_indicators`** — last 5 rows of RSI/MACD/ATR/etc.
  upserted per stock.

Net effect after one daily run: the AllStocks page, Dashboard,
StockDetail page, and Past Predictions table all show fresh numbers on
next page load. The Diagnostics page is the only thing that doesn't
auto-refresh from this — it reads `metrics_<SYM>_<cnn|linear>.json`
files written by `evaluate.py`, which is a holdout-evaluation step you
re-run only after retraining.

**Adding or removing stocks**: edit the list of `python predict.py`
lines in `daily_predict.bat`. Each new symbol needs a trained CNN
model + scaler and a Linear model + scaler under `models/` — check
`get_stock_info()` in `predict.py` for the naming convention.

### One-time setup: register in Task Scheduler

1. Open **Task Scheduler** (Win+R → `taskschd.msc`).
2. **Create Task** (not the wizard — the full dialog).
3. **General** tab:
   - Name: `Insight Daily Prediction`
   - "Run whether user is logged on or not" — checked.
   - "Run with highest privileges" — checked.
4. **Triggers** tab → **New**:
   - Begin the task: On a schedule.
   - Settings: **Weekly**, every 1 week, on **Sun, Mon, Tue, Wed, Thu**.
   - Start time: **17:30** (AST). TASI closes at 15:00; yfinance
     end-of-day appears around 17:00; 17:30 gives a 30-min buffer.
5. **Actions** tab → **New**:
   - Action: Start a program.
   - Program/script: `cmd.exe`
   - Add arguments: `/c "C:\Users\Admin\Desktop\Grap_Project_Insight\scripts\daily_predict.bat"`
     (replace the path if the repo lives somewhere else).
6. **Settings** tab:
   - "Allow task to be run on demand" — checked.
   - "Run task as soon as possible after a scheduled start is missed" —
     checked (so a weekend reboot won't skip the next run).

### Manual dry-run

Before relying on the scheduled task, run it once by hand:

```powershell
scripts\daily_predict.bat
type logs\predict_<YYYYMMDD>.log
```

You should see six prediction blocks (one per stock), each with a CNN
and Linear run, the `_check_past_predictions_accuracy()` validation
pass at the start, and `[INFO] Prediction stored in Supabase` lines
toward the end of each block. After the script finishes, hitting
`GET /api/stocks` should show fresh `target_date` and
`model_predictions[]` for all six symbols.

### Why not GitHub Actions / APScheduler?

For a local capstone running on the project owner's machine, Windows
Task Scheduler is the simplest path that actually works. If the project
moves to a hosted backend later, swap to a GitHub Actions cron
(`.github/workflows/daily-predict.yml` with `cron: '30 14 * * 0-4'` —
14:30 UTC = 17:30 AST) or an APScheduler job inside the FastAPI process.
