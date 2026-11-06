@echo off
echo Starting Ledger Atlas Web Application...
start "" http://localhost:3000
python -m http.server 3000
pause

