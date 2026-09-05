@echo off
setlocal

set BUILD_MODE=production
if /I "%~1"=="debug" set BUILD_MODE=debug
if /I "%~1"=="--debug" set BUILD_MODE=debug
if /I "%~1"=="prod" set BUILD_MODE=production
if /I "%~1"=="production" set BUILD_MODE=production
if /I "%~1"=="--production" set BUILD_MODE=production

echo Build mode: %BUILD_MODE%

echo [1/4] Setting up Python virtual environment...
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate.bat

echo Installing dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install pyinstaller

echo [2/4] Building the backend with PyInstaller...
call pyinstaller --onefile --clean --add-data ".env;." --name recall-backend-x86_64-pc-windows-msvc --collect-all pymupdf --collect-all pymupdf4llm --collect-all markdown_it --collect-all fsrs --collect-all uvicorn --collect-all fastapi --collect-all pydantic --collect-all pydantic_settings --collect-all langfuse --hidden-import python_multipart --hidden-import multipart app\__main__.py
if %ERRORLEVEL% NEQ 0 (
    echo Backend build failed. Exiting.
    exit /b %ERRORLEVEL%
)

echo [3/4] Copying executable to Tauri binaries...
if not exist "desktop\src-tauri\binaries" mkdir "desktop\src-tauri\binaries"
copy /Y "dist\recall-backend-x86_64-pc-windows-msvc.exe" "desktop\src-tauri\binaries\"
if %ERRORLEVEL% NEQ 0 (
    echo Failed to copy the executable. Exiting.
    exit /b %ERRORLEVEL%
)

echo [4/4] Building the frontend with Tauri...
cd desktop
if "%BUILD_MODE%"=="debug" (
    call pnpm tauri build --debug
) else (
    call pnpm tauri build
)
if %ERRORLEVEL% NEQ 0 (
    echo Tauri build failed. Exiting.
    exit /b %ERRORLEVEL%
)

echo Build process completed successfully!
cd ..
endlocal
