@echo off
REM Setup script for LangGraph Playground on Windows
REM This script sets up the environment and starts the playground

echo.
echo ========================================
echo   LangGraph Playground Setup
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.11 or higher
    pause
    exit /b 1
)

echo [1/5] Creating virtual environment...
if not exist venv (
    python -m venv venv
    echo Virtual environment created
) else (
    echo Virtual environment already exists
)

echo.
echo [2/5] Activating virtual environment...
call venv\Scripts\activate.bat

echo.
echo [3/5] Installing dependencies...
pip install -q -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo Dependencies installed successfully

echo.
echo [4/5] Checking environment configuration...
if not exist .env (
    echo WARNING: .env file not found!
    echo Copying .env.example to .env
    copy .env.example .env >nul
    echo.
    echo IMPORTANT: Please edit .env file with your credentials:
    echo   - AWS_ACCESS_KEY_ID
    echo   - AWS_SECRET_ACCESS_KEY
    echo   - TAVILY_API_KEY
    echo.
    echo Open .env file now? (Y/N)
    set /p openenv=
    if /i "%openenv%"=="Y" notepad .env
    echo.
    echo Press any key after you've configured .env to continue...
    pause >nul
) else (
    echo .env file found
)

echo.
echo [5/5] Starting LangGraph Playground...
echo.
echo ========================================
echo   Server is starting...
echo ========================================
echo.
echo Access the playground at:
echo   UI:   http://localhost:2024
echo   API:  http://localhost:2024/docs
echo   Health: http://localhost:2024/health
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Try langgraph CLI first, fall back to uvicorn
where langgraph >nul 2>&1
if errorlevel 1 (
    echo Using uvicorn...
    python -m uvicorn src.agent.webapp:app --host 0.0.0.0 --port 2024 --reload
) else (
    echo Using LangGraph CLI...
    langgraph dev --host 0.0.0.0 --port 2024
)

pause
