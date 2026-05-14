@echo off
REM Daily prediction entrypoint for Windows Task Scheduler.
REM See scripts/README.md for one-time setup instructions.
REM
REM Uses %~dp0 (the directory this .bat lives in) + .. so the script
REM works wherever the repo is cloned -- no hard-coded path.
REM
REM What this script refreshes (everything the website displays):
REM
REM   1. market_data table     -- via predict.py's DataAcquisitionService
REM                              .update_supabase() which is called at the
REM                              start of every prediction run
REM   2. ai_predictions table  -- one new row per (stock, model) per run
REM   3. model_accuracy_log    -- _check_past_predictions_accuracy() runs
REM                              first on each invocation; it validates any
REM                              past prediction whose target_date has now
REM                              passed
REM   4. sentiment_analysis    -- analyze_and_store() is called inside each
REM                              run (currently market-wide, stored under
REM                              symbol = TASI)
REM   5. technical_indicators  -- last 5 rows upserted per stock
REM
REM Once these tables are fresh, the front-end picks them up on the next
REM page load: AllStocks model_predictions[], the confidence rings, the
REM "For <date>" pills, the Past Predictions table, the rolling Model
REM Performance card, and the Diagnostics page if its JSON has been
REM populated by evaluate.py.

cd /d "%~dp0.."
if not exist logs mkdir logs
for /f %%i in ('powershell -nop -c "Get-Date -Format yyyyMMdd"') do set DATE_STR=%%i

set LOG=logs\predict_%DATE_STR%.log

echo === Insight daily refresh started %DATE_STR% === > %LOG%

REM Run predict.py for each of the six stocks. Each invocation:
REM   - validates any past predictions whose target_date has now passed
REM   - upserts the latest OHLCV row into market_data for this symbol
REM   - inserts one new ai_predictions row per (model_id, symbol)
REM   - upserts today's sentiment under symbol = TASI (so we only need
REM     to do the heavy NLP work once; the --no-sentiment flag on
REM     subsequent runs reuses what TASI just wrote)

echo --- TASI (full pipeline, including sentiment) --- >> %LOG%
python predict.py --model-type all --symbol TASI >> %LOG% 2>&1

echo --- ARAMCO --- >> %LOG%
python predict.py --model-type all --symbol ARAMCO --no-sentiment >> %LOG% 2>&1

echo --- RAJHI --- >> %LOG%
python predict.py --model-type all --symbol RAJHI --no-sentiment >> %LOG% 2>&1

echo --- SABIC --- >> %LOG%
python predict.py --model-type all --symbol SABIC --no-sentiment >> %LOG% 2>&1

echo --- STC --- >> %LOG%
python predict.py --model-type all --symbol STC --no-sentiment >> %LOG% 2>&1

echo --- SECO --- >> %LOG%
python predict.py --model-type all --symbol SECO --no-sentiment >> %LOG% 2>&1

echo === Insight daily refresh finished === >> %LOG%
