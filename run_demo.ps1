# Launch RecallAI Demo (Commit 9d47554)
Write-Host "Launching RecallAI Demo (Commit 9d47554)..." -ForegroundColor Cyan

$env:PATH = "C:\Users\rubay\AppData\Local\nvm\v24.14.1;$env:PATH"

# Terminal 1: Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\GitHub\RecallAI'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

# Terminal 2: Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PATH = 'C:\Users\rubay\AppData\Local\nvm\v24.14.1;' + `$env:PATH; cd 'D:\GitHub\RecallAI\desktop'; pnpm dev"

Start-Sleep -Seconds 4

# Native Desktop Window
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "--app=http://localhost:5173", "--window-size=1280,850"
