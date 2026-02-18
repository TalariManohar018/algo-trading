# Quick Start Guide

## Running the Backend

### Option 1: Using Maven (Recommended)

```bash
cd algo-trading-backend
mvn clean install
mvn spring-boot:run
```

### Option 2: Using Java directly

```bash
cd algo-trading-backend
mvn clean package
java -jar target/algo-trading-backend-1.0.0.jar
```

## Verify Server is Running

Open your browser and navigate to:
- Application: http://localhost:8080
- H2 Console: http://localhost:8080/h2-console

## Test the API

### Using cURL

```bash
# Get all strategies
curl http://localhost:8080/api/strategies

# Create a new strategy
curl -X POST http://localhost:8080/api/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Strategy",
    "instrument": "NIFTY",
    "conditions": [{
      "indicator": "EMA",
      "condition": ">",
      "value": "50"
    }]
  }'
```

### Using the provided API test file

If you're using VS Code with the REST Client extension, open `api-tests.http` and click "Send Request" for any endpoint.

## Connect Frontend to Backend

The backend is configured to accept requests from:
- http://localhost:5173
- http://localhost:5174
- http://localhost:3000

Make sure your frontend is making requests to: `http://localhost:8080/api/`

## Common Issues

### Port Already in Use
If port 8080 is already in use, change it in `application.yml`:
```yaml
server:
  port: 8081
```

### Build Errors
Make sure you have Java 17+ installed:
```bash
java -version
```

## Next Steps

1. Start the frontend application (if not already running)
2. Test the API endpoints using the provided test file
3. Create strategies through the API
4. Run backtests
5. View results in the frontend

Enjoy trading! 🚀
