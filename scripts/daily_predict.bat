@echo off
REM Daily prediction entrypoint for Windows Task Scheduler.
REM See scripts/README.md for one-time setup instructions.
REM
REM Uses %~dp0 (the directory this .bat lives in) + .. so the script
REM works wherever the repo is cloned -- no hard-coded path.
REM
REM Builds the YYYYMMDD log filename via PowerShell so the format is
REM locale-independent. The naive %date% substring trick breaks on
REM non-US Windows locales (gives garbage like predict_y-26-M14.log).

cd /d "%~dp0.."
if not exist logs mkdir logs
for /f %%i in ('powershell -nop -c "Get-Date -Format yyyyMMdd"') do set DATE_STR=%%i
python predict.py --model-type all --symbol TASI > logs\predict_%DATE_STR%.log 2>&1
