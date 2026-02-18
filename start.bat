@echo off
REM Quick Start Script for Algo Trading System
REM Windows version

echo ============================================
echo  Personal Algorithmic Trading System       
echo  Quick Start Script                        
echo ============================================
echo.

REM Check Java
echo [1/6] Checking Java...
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Java 17+ is not installed or not in PATH
    echo Please install Java 17+ from https://adoptium.net/
    pause
    exit /b 1
)
echo   - Java found

REM Check Node
echo [2/6] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)
echo   - Node.js found

REM Check Maven
echo [3/6] Checking Maven...
cd algo-trading-backend
call mvnw.cmd --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Maven wrapper not found
    pause
    exit /b 1
)
echo   - Maven found

REM Build Backend
echo [4/6] Building backend...
echo   This may take a few minutes on first run...
call mvnw.cmd clean install -DskipTests
if %errorlevel% neq 0 (
    echo ERROR: Backend build failed
    pause
    exit /b 1
)
echo   - Backend built successfully

REM Install Frontend Dependencies
echo [5/6] Installing frontend dependencies...
cd ..\algo-trading-frontend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Frontend dependency installation failed
    pause
    exit /b 1
)
echo   - Frontend dependencies installed

echo [6/6] Starting services...
echo.
echo ============================================
echo  System Ready!                              
echo ============================================
echo.
echo Starting services in separate windows...
echo.
echo Backend:  http://localhost:8080
echo Frontend: http://localhost:5173
echo H2 Console: http://localhost:8080/h2-console
echo.
echo Login Credentials:
echo   Email: trader@algo.com
echo   Password: password123
echo.
echo CTRL+C in each window to stop services
echo.

REM Start Backend
start "Algo Trading Backend" cmd /k "cd algo-trading-backend && mvnw.cmd spring-boot:run"

REM Wait a few seconds for backend to start
timeout /t 10 /nobreak

REM Start Frontend
start "Algo Trading Frontend" cmd /k "cd algo-trading-frontend && npm run dev"

echo.
echo Services starting...
echo Check the new windows for status
echo.
pause
