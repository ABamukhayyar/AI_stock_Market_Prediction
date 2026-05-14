@echo off
REM Daily prediction entrypoint for Windows Task Scheduler.
REM See scripts/README.md for one-time setup instructions.
REM
REM Uses %~dp0 (the directory this .bat lives in) + .. so the script
REM works wherever the repo is cloned -- no hard-coded path.

cd /d "%~dp0.."
if not exist logs mkdir logs
python predict.py --model-type all --symbol TASI > logs\predict_%date:~-4,4%%date:~-7,2%%date:~-10,2%.log 2>&1
