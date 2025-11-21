#!/bin/bash

echo "Starting EvLens WebScraper Services..."

cd python_scrapers
gunicorn --bind 0.0.0.0:5000 --workers 2 --timeout 120 scraper_api:app &
PYTHON_PID=$!
cd ..

echo "Python service started with PID: $PYTHON_PID"

echo "Waiting for Python service to initialize..."
sleep 10

MAX_RETRIES=15
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HEALTH_CHECK=$(curl -s -X GET http://localhost:5000/health 2>/dev/null)
    echo "Health check response: $HEALTH_CHECK"
    if echo "$HEALTH_CHECK" | grep -q "OK"; then
        echo "✓ Python service is ready and healthy"
        break
    fi
    echo "Waiting for Python service to be ready... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 3
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "✗ Python service failed to start after $MAX_RETRIES attempts"
    kill $PYTHON_PID 2>/dev/null || true
    exit 1
fi

echo "Starting Node.js service..."
exec node src/server.js
