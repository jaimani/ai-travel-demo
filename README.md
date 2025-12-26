# Llama Inc. Travel Demo

A full-stack SaaS demo showcasing **Stripe Checkout**, **Stripe Billing**, and **webhook handling**. Features AI-powered trip planning using the **OpenAI Agents SDK** with multi-agent orchestration.

## 🎯 Stripe Integration Features

- **Freemium Model**: Free users get single-city trips, premium users unlock multi-city planning ($9.99/month)
- **Stripe Checkout**: Seamless upgrade flow with embedded Checkout sessions
- **Subscription Management**: Customer Portal for subscription management
- **Webhook Processing**: Real-time subscription lifecycle events (created, updated, deleted, payment succeeded/failed)
- **Server-Side Gating**: Backend validates subscription status before processing premium features
- **Test Mode**: Full local development workflow with Stripe CLI webhook forwarding

## Stack

- **Backend**: Python/FastAPI + SQLModel (SQLite) + Stripe SDK
- **Frontend**: React + Vite + Stripe.js
- **AI Orchestration**: OpenAI Agents SDK (multi-agent workflow)
- **Payments**: Stripe Checkout, Billing, Webhooks

## Prerequisites

- **Stripe Account** - [Sign up free](https://dashboard.stripe.com/register)
- **Stripe CLI** - [Install instructions](https://stripe.com/docs/stripe-cli)
- **OpenAI API Key** - [Get one here](https://platform.openai.com/api-keys)
- Docker + Docker Compose

## Quick Start

### 1. Configure Stripe

```bash
# Install Stripe CLI (macOS)
brew install stripe/stripe-cli/stripe

# Login to your Stripe account
stripe login

# Create a subscription product (or use existing)
# In Stripe Dashboard: Products → Create Product
# - Name: "Premium Travel Assistant"
# - Price: $9.99/month recurring
# - Set lookup key: "premium_monthly" (or custom)
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your keys:
```bash
OPENAI_API_KEY=sk-your-openai-key-here
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_PRICE_LOOKUP_KEY=premium_monthly
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key
```

Find your Stripe keys:
- **Secret Key**: [Dashboard → Developers → API Keys](https://dashboard.stripe.com/test/apikeys) (`sk_test_...`)
- **Publishable Key**: Same page (`pk_test_...`)
- **Price Lookup Key**: Products → Edit price → Set lookup key

### 3. Start the App

```bash
./start.sh
```

The script will:
1. Check for `.env` file and required API keys
2. **Prompt you to start Stripe webhook forwarding**
3. Start the application with Docker Compose

Access the app:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 4. Set Up Stripe Webhooks (Required for Local Testing)

**In a separate terminal**, run:
```bash
stripe listen --forward-to localhost:8000/stripe/webhook
```

**Copy the webhook signing secret** (`whsec_...`) from the output and add to `.env`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret-here
```

**Restart the containers** to load the new secret:
```bash
docker-compose down
docker-compose up --build
```

**Keep the `stripe listen` command running** while testing to receive webhook events.

## Testing the Stripe Subscription Flow

### 1. Free Tier (Single-City Trips)

1. Go to http://localhost:3000
2. Enter email: `test@example.com`
3. Fill in trip details (New York → Los Angeles)
4. Click "Plan with AI" - works without subscription

### 2. Premium Upgrade Flow

1. Click **"Add Another City" 👑** button
2. Subscription modal appears with pricing ($9.99/month)
3. Click **"Subscribe Now"**
4. Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
5. Complete checkout
6. Redirected back with **"Premium ✓"** badge
7. Can now plan multi-city trips (up to 4 legs/5 cities)

### 3. Verify Webhook Processing

Check backend logs to see webhook events:
```bash
docker logs -f travel_demo-backend-1
```

You should see:
- `checkout.session.completed` → Customer created/updated
- `customer.subscription.created` → Subscription activated
- `invoice.payment_succeeded` → Payment confirmed

Verify subscription in database:
```bash
docker exec -it travel_demo-backend-1 sqlite3 database.db
sqlite> SELECT email, subscription_status, subscription_tier FROM customer;
```

### 4. Manage Subscription

Click **"Manage Billing"** in the subscription modal to open the Stripe Customer Portal where users can:
- Update payment method
- View invoices
- Cancel subscription

## Stripe Test Cards

- **Success**: `4242 4242 4242 4242`
- **3D Secure**: `4000 0025 0000 3155`
- **Declined**: `4000 0000 0000 9995`

[Full test card list →](https://stripe.com/docs/testing#cards)

## Architecture Highlights

### Stripe Integration

- **Customer Model**: Tracks email, Stripe customer ID, subscription status, tier, and expiry
- **Subscription Gating**: Backend validates `has_active_subscription()` before allowing multi-city requests (returns 403 if unauthorized)
- **Webhook Handlers**: Processes 6 event types (checkout.session.completed, subscription created/updated/deleted, invoice succeeded/failed)
- **Idempotency**: Uses Stripe's built-in idempotency for webhook safety
- **Customer Portal**: Managed billing page with one API call

Key files:
- [backend/routes/stripe_routes.py](backend/routes/stripe_routes.py) - Checkout, webhooks, subscription status
- [backend/models/database.py](backend/models/database.py) - Customer model with subscription fields
- [frontend/src/components/SubscriptionModal.jsx](frontend/src/components/SubscriptionModal.jsx) - Upgrade UI

### AI Agent Workflow

Multi-agent orchestration using OpenAI Agents SDK:

```
User Request → PlannerAgent → FlightsAgent → HotelsAgent → ItineraryAgent
```

Each agent has specialized tools and passes context via handoffs. See [backend/app_agents/travel_agents.py](backend/app_agents/travel_agents.py).

## Troubleshooting

**"No API key provided" (Stripe error)**
- Ensure `STRIPE_SECRET_KEY` is in `.env` and starts with `sk_test_`
- Restart containers: `docker-compose down && docker-compose up --build`

**Webhooks not updating subscription**
- Verify `stripe listen` is running in a separate terminal
- Copy webhook secret (`whsec_...`) to `.env` as `STRIPE_WEBHOOK_SECRET`
- Check logs: `docker logs -f travel_demo-backend-1`

**"Price with lookup key not found"**
- Verify product exists in [Stripe Dashboard](https://dashboard.stripe.com/test/products)
- Ensure lookup key is set on the **price** (not just product name)
- Verify `STRIPE_PRICE_LOOKUP_KEY` matches exactly (case-sensitive)

**Multi-city trips not blocked for free users**
- Check that `user_email` is passed in API request
- Verify backend logs show subscription check
- Confirm subscription status in database (should be `null` or `canceled` for free users)

## Resources

- [Stripe Checkout Docs](https://stripe.com/docs/checkout/quickstart)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe CLI Reference](https://stripe.com/docs/stripe-cli)
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)
