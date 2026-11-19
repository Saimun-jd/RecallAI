@echo off
echo Stopping Recall AI Backend and Frontend...
powershell -Command "$pids = Get-NetTCPConnection -LocalPort 8000, 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }"
echo All Recall AI processes stopped.

