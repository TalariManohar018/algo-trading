#!/usr/bin/env bash

# Algo Trading Platform - Test Script
# Tests all major endpoints and workflows

BASE_URL="http://localhost:8080/api"

echo "🧪 Starting Algo Trading Platform Tests"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local body=$3
    local expected_status=$4
    local description=$5

    echo -n "Testing: $description... "

    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    elif [ "$method" == "POST" ]; then
        if [ -n "$body" ]; then
            response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$body")
        else
            response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint")
        fi
    elif [ "$method" == "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL$endpoint")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" == "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
        ((TESTS_PASSED++))
        [ -n "$body" ] && echo "   Response: $(echo "$body" | head -c 100)..."
    else
        echo -e "${RED}✗ FAILED${NC} (Expected HTTP $expected_status, got $http_code)"
        ((TESTS_FAILED++))
        [ -n "$body" ] && echo "   Response: $body"
    fi
    echo ""
}

echo "1️⃣  MARKET DATA TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "POST" "/market-data/start" "" "200" "Start Market Data Simulator"
sleep 1
test_endpoint "GET" "/market-data/status" "" "200" "Get Market Data Status"
test_endpoint "GET" "/market-data/price/NIFTY" "" "200" "Get Current Price for NIFTY"
test_endpoint "GET" "/market-data/candles/NIFTY?timeframe=1m&count=10" "" "200" "Get Historical Candles"
echo ""

echo "2️⃣  STRATEGY TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━"

# Create a test strategy
STRATEGY_JSON='{
  "name": "Test RSI Strategy",
  "symbol": "NIFTY",
  "instrumentType": "FUTURE",
  "timeframe": "ONE_MINUTE",
  "quantity": 1,
  "orderType": "MARKET",
  "productType": "MIS",
  "entryConditions": [
    {
      "id": "1",
      "indicatorType": "RSI",
      "conditionType": "LESS_THAN",
      "value": 30,
      "logic": "AND",
      "period": 14
    }
  ],
  "exitConditions": [
    {
      "id": "2",
      "indicatorType": "RSI",
      "conditionType": "GREATER_THAN",
      "value": 70,
      "logic": "AND",
      "period": 14
    }
  ],
  "maxTradesPerDay": 5,
  "tradingWindow": {
    "startTime": "09:15",
    "endTime": "15:15"
  },
  "squareOffTime": "15:20",
  "riskConfig": {
    "maxLossPerTrade": 1000,
    "maxProfitTarget": 2000,
    "stopLossPercent": 2,
    "takeProfitPercent": 5
  }
}'

test_endpoint "POST" "/strategies" "$STRATEGY_JSON" "201" "Create Strategy"
test_endpoint "GET" "/strategies" "" "200" "Get All Strategies"
test_endpoint "GET" "/strategies/1" "" "200" "Get Strategy by ID"
test_endpoint "PUT" "/strategies/1/activate" "" "200" "Activate Strategy"
echo ""

echo "3️⃣  TRADING ENGINE TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "GET" "/engine/status?userId=1" "" "200" "Get Engine Status (Before Start)"
test_endpoint "POST" "/engine/start?userId=1" "" "200" "Start Trading Engine"
sleep 2
test_endpoint "GET" "/engine/status?userId=1" "" "200" "Get Engine Status (After Start)"
sleep 5
echo "   ⏳ Waiting 5 seconds for candles to generate..."
test_endpoint "GET" "/engine/status?userId=1" "" "200" "Check Engine Status Again"
test_endpoint "POST" "/engine/stop?userId=1" "" "200" "Stop Trading Engine"
echo ""

echo "4️⃣  ORDER & POSITION TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "GET" "/orders" "" "200" "Get All Orders"
test_endpoint "GET" "/positions" "" "200" "Get All Positions"
test_endpoint "GET" "/wallet" "" "200" "Get Wallet Balance"
echo ""

echo "5️⃣  EMERGENCY STOP TEST"
echo "━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "POST" "/engine/start?userId=1" "" "200" "Restart Engine"
sleep 2
test_endpoint "POST" "/engine/emergency-stop?userId=1&reason=Test" "" "200" "Execute Emergency Stop"
test_endpoint "GET" "/engine/status?userId=1" "" "200" "Verify Engine Locked"
echo ""

echo "6️⃣  CLEANUP"
echo "━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "POST" "/market-data/stop" "" "200" "Stop Market Data Simulator"
test_endpoint "PUT" "/strategies/1/deactivate" "" "200" "Deactivate Strategy"
echo ""

echo "========================================"
echo "📊 TEST RESULTS"
echo "========================================"
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed!${NC}"
    exit 1
fi
