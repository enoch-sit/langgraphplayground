#!/bin/bash
# Setup script for LangGraph Playground on Linux/Mac
# This script sets up the environment and starts the playground

set -e

echo ""
echo "========================================"
echo "  LangGraph Playground Setup"
echo "========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python is not installed"
    echo "Please install Python 3.11 or higher"
    exit 1
fi

echo "[1/5] Creating virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "Virtual environment created"
else
    echo "Virtual environment already exists"
fi

echo ""
echo "[2/5] Activating virtual environment..."
source venv/bin/activate

echo ""
echo "[3/5] Installing dependencies..."
pip install -q -r requirements.txt
echo "Dependencies installed successfully"

echo ""
echo "[4/5] Checking environment configuration..."
if [ ! -f ".env" ]; then
    echo "WARNING: .env file not found!"
    echo "Copying .env.example to .env"
    cp .env.example .env
    echo ""
    echo "IMPORTANT: Please edit .env file with your credentials:"
    echo "  - AWS_ACCESS_KEY_ID"
    echo "  - AWS_SECRET_ACCESS_KEY"
    echo "  - TAVILY_API_KEY"
    echo ""
    read -p "Open .env file now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ${EDITOR:-nano} .env
    fi
    echo ""
    read -p "Press enter after you've configured .env to continue..."
else
    echo ".env file found"
fi

echo ""
echo "[5/5] Starting LangGraph Playground..."
echo ""
echo "========================================"
echo "  Server is starting..."
echo "========================================"
echo ""
echo "Access the playground at:"
echo "  UI:   http://localhost:2024"
echo "  API:  http://localhost:2024/docs"
echo "  Health: http://localhost:2024/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo "========================================"
echo ""

# Try langgraph CLI first, fall back to uvicorn
if command -v langgraph &> /dev/null; then
    echo "Using LangGraph CLI..."
    langgraph dev --host 0.0.0.0 --port 2024
else
    echo "Using uvicorn..."
    python -m uvicorn src.agent.webapp:app --host 0.0.0.0 --port 2024 --reload
fi
