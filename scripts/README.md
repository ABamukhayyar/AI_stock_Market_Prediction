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
3. Runs `python predict.py --model-type all --symbol TASI` and writes
   stdout+stderr to `logs/predict_YYYYMMDD.log`.

`predict.py` itself, on every invocation, also calls
`_check_past_predictions_accuracy()` first — so this single daily job
both makes tomorrow's prediction *and* validates yesterday's. No second
cron is needed.

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

You should see the CNN and Linear prediction blocks, the
`_check_past_predictions_accuracy()` validation pass, and two new rows
in the `ai_predictions` table.

### Why not GitHub Actions / APScheduler?

For a local capstone running on the project owner's machine, Windows
Task Scheduler is the simplest path that actually works. If the project
moves to a hosted backend later, swap to a GitHub Actions cron
(`.github/workflows/daily-predict.yml` with `cron: '30 14 * * 0-4'` —
14:30 UTC = 17:30 AST) or an APScheduler job inside the FastAPI process.
