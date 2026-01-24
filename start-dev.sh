#!/bin/bash

echo "========================================="
echo "Starting UrbanEye Development Environment"
echo "========================================="

# Start backend services (Docker)
echo "🐳 Starting backend services with Docker..."
cd backend
docker-compose up -d db redis minio backend

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check backend health
echo "🔍 Checking backend health..."
curl -s http://localhost:8000/health | jq .

# Start frontend locally (for hot reload)
echo "🎨 Starting frontend locally..."
cd ../frontend/UrbanEye-frontend
npm run dev &

echo ""
echo "========================================="
echo "✅ Development environment ready!"
echo "========================================="
echo "Frontend:  http://localhost:3000"
echo "Backend:   http://localhost:8000/docs"
echo "MinIO:     http://localhost:9001"
echo "========================================="
echo ""
echo "To stop backend: cd backend && docker-compose down"
echo "To stop frontend: Ctrl+C"
