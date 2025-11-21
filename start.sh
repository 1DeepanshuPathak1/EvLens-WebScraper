#!/bin/bash

echo "Starting EvLens WebScraper Services..."

python3 python_scrapers/scraper_api.py &
PYTHON_PID=$!

echo "Python service started with PID: $PYTHON_PID"

sleep 5

MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:5000/health > /dev/null 2>&1; then
        echo "Python service is ready"
        break
    fi
    echo "Waiting for Python service to be ready... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "Python service failed to start"
    kill $PYTHON_PID
    exit 1
fi

echo "Starting Node.js service..."
node src/server.js
