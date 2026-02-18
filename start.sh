#!/bin/bash
# Quick Start Script for Algo Trading System
# Linux/Mac version

echo "============================================"
echo " Personal Algorithmic Trading System       "
echo " Quick Start Script                        "
echo "============================================"
echo ""

# Check Java
echo "[1/6] Checking Java..."
if ! command -v java &> /dev/null; then
    echo "ERROR: Java 17+ is not installed or not in PATH"
    echo "Please install Java 17+ from https://adoptium.net/"
    exit 1
fi
echo "  ✓ Java found"

# Check Node
echo "[2/6] Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed or not in PATH"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi
echo "  ✓ Node.js found"

# Check Maven
echo "[3/6] Checking Maven..."
cd algo-trading-backend
if [ ! -f "./mvnw" ]; then
    echo "ERROR: Maven wrapper not found"
    exit 1
fi
chmod +x mvnw
echo "  ✓ Maven found"

# Build Backend
echo "[4/6] Building backend..."
echo "  This may take a few minutes on first run..."
./mvnw clean install -DskipTests
if [ $? -ne 0 ]; then
    echo "ERROR: Backend build failed"
    exit 1
fi
echo "  ✓ Backend built successfully"

# Install Frontend Dependencies
echo "[5/6] Installing frontend dependencies..."
cd ../algo-trading-frontend
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Frontend dependency installation failed"
    exit 1
fi
echo "  ✓ Frontend dependencies installed"

echo "[6/6] Starting services..."
echo ""
echo "============================================"
echo " System Ready!                              "
echo "============================================"
echo ""
echo "Backend:      http://localhost:8080"
echo "Frontend:     http://localhost:5173"
echo "H2 Console:   http://localhost:8080/h2-console"
echo ""
echo "Login Credentials:"
echo "  Email: trader@algo.com"
echo "  Password: password123"
echo ""
echo "Press CTRL+C to stop both services"
echo ""

# Start Backend in background
cd ../algo-trading-backend
./mvnw spring-boot:run &
BACKEND_PID=$!

# Wait for backend to start
echo "Waiting for backend to start..."
sleep 15

# Start Frontend
cd ../algo-trading-frontend
npm run dev &
FRONTEND_PID=$!

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
