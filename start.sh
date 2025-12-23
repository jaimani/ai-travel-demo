#!/bin/bash

# Travel Demo Application - Docker Quick Start

echo "========================================="
echo "Travel Demo - Quick Start"
echo "========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env and add your OpenAI API key!"
    echo "   Open .env and set: OPENAI_API_KEY=your-actual-key-here"
    echo ""
    read -p "Press Enter after you've added your API key to continue..."
fi

# Verify API key is set
if ! grep -q "OPENAI_API_KEY=sk-" .env; then
    echo ""
    echo "⚠️  WARNING: OpenAI API key may not be set correctly in .env"
    echo "   Make sure it starts with 'sk-'"
    echo ""
    read -p "Press Enter to continue anyway, or Ctrl+C to abort..."
fi

echo ""
echo "Starting application with Docker Compose..."
echo ""
echo "This will start:"
echo "  - Backend API on http://localhost:8000"
echo "  - Frontend on http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Start Docker Compose
docker-compose up --build
