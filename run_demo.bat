@echo off
echo ========================================================
echo   Launching RecallAI Demo (Commit 9d47554)
echo ========================================================

set "PATH=C:\Users\rubay\AppData\Local\nvm\v24.14.1;%PATH%"

echo Starting Backend...
start "RecallAI Backend" cmd /k "cd /d D:\GitHub\RecallAI && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo Starting Frontend Server...
start "RecallAI Frontend" cmd /k "set PATH=C:\Users\rubay\AppData\Local\nvm\v24.14.1;%%PATH%% && cd /d D:\GitHub\RecallAI\desktop && pnpm dev"

echo Waiting for services to initialize...
ping 127.0.0.1 -n 5 >nul

echo Opening Native Desktop Window...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:5173 --window-size=1280,850
