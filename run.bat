@echo off
title Recall AI Launcher
echo ===================================================
echo           Starting Recall AI Application
echo ===================================================

echo [1/2] Launching FastAPI Backend on http://127.0.0.1:8000 ...
start "Recall AI - Backend" cmd /k ".\.venv\Scripts\activate.bat && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/2] Launching Frontend on http://127.0.0.1:5173 ...
cd desktop
call pnpm dev --open

