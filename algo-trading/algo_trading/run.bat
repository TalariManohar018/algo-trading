@echo off
cd /d "%~dp0"

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing dependencies...
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

echo.
echo ===================================
echo   Starting Algo Trading Engine
echo   http://localhost:8000
echo   Docs: http://localhost:8000/docs
echo ===================================
echo.

python -m app.main
