#!/bin/bash

# Travel Demo Application - Docker Quick Start

echo "========================================="
echo "AI Travel Demo - Stripe Integration"
echo "========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env and add required API keys!"
    echo ""
    echo "   Required keys:"
    echo "   - OPENAI_API_KEY=sk-your-openai-key-here"
    echo "   - STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key"
    echo "   - STRIPE_PRICE_LOOKUP_KEY=premium_monthly"
    echo "   - VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key"
    echo ""
    echo "   Find Stripe keys at: https://dashboard.stripe.com/test/apikeys"
    echo ""
    read -p "Press Enter after you've added your API keys to continue..."
fi

# Verify OpenAI API key is set
if ! grep -q "OPENAI_API_KEY=sk-" .env; then
    echo ""
    echo "⚠️  WARNING: OpenAI API key may not be set correctly in .env"
    echo "   Make sure it starts with 'sk-'"
    echo ""
fi

# Verify Stripe secret key is set
if ! grep -q "STRIPE_SECRET_KEY=sk_test_" .env; then
    echo ""
    echo "⚠️  WARNING: Stripe secret key may not be set correctly in .env"
    echo "   Make sure it starts with 'sk_test_' for test mode"
    echo ""
fi

# Check if Stripe CLI is installed
echo ""
echo "========================================="
echo "Stripe Webhook Setup (Required)"
echo "========================================="
echo ""

if ! command -v stripe &> /dev/null; then
    echo "⚠️  Stripe CLI not found!"
    echo ""
    echo "Install Stripe CLI to enable webhook forwarding:"
    echo "  macOS:   brew install stripe/stripe-cli/stripe"
    echo "  Other:   https://stripe.com/docs/stripe-cli"
    echo ""
    read -p "Press Enter to continue without webhook support, or Ctrl+C to abort..."
else
    echo "✓ Stripe CLI detected"
    echo ""
    echo "IMPORTANT: For Stripe subscriptions to work in local development,"
    echo "you MUST run webhook forwarding in a separate terminal:"
    echo ""
    echo "  stripe listen --forward-to localhost:8000/stripe/webhook"
    echo ""
    echo "Then copy the webhook signing secret (whsec_...) to your .env file:"
    echo "  STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret-here"
    echo ""
    echo "After adding the webhook secret, restart the containers:"
    echo "  docker-compose down && docker-compose up --build"
    echo ""

    # Check if webhook secret is already set
    if grep -q "STRIPE_WEBHOOK_SECRET=whsec_" .env; then
        echo "✓ Webhook secret already configured in .env"
        echo ""
        echo "Make sure 'stripe listen' is running in another terminal!"
    else
        echo "⚠️  Webhook secret not yet configured in .env"
        echo ""
        echo "Run 'stripe listen' NOW in another terminal, then add the secret to .env"
    fi
    echo ""
    read -p "Press Enter when ready to start the application..."
fi

echo ""
echo "========================================="
echo "Starting Application"
echo "========================================="
echo ""
echo "This will start:"
echo "  - Backend API:  http://localhost:8000"
echo "  - Frontend:     http://localhost:3000"
echo "  - API Docs:     http://localhost:8000/docs"
echo ""
echo "Test the subscription flow:"
echo "  1. Go to http://localhost:3000"
echo "  2. Enter email and plan a trip (free tier)"
echo "  3. Click 'Add Another City' 👑 to upgrade"
echo "  4. Use test card: 4242 4242 4242 4242"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Start Docker Compose
docker-compose up --build
