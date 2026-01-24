#!/bin/bash

echo "========================================="
echo "Starting UrbanEye Production Environment"
echo "========================================="

# Build and start all services
cd backend
docker-compose up -d --build

echo ""
echo "========================================="
echo "✅ Production environment started!"
echo "========================================="
echo "Frontend:  http://localhost:3000"
echo "Backend:   http://localhost:8000/docs"
echo "MinIO:     http://localhost:9001"
echo "========================================="
echo ""
echo "View logs: docker-compose logs -f"
echo "Stop all:  docker-compose down"
