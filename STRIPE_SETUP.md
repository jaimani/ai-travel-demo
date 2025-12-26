# Stripe Integration Setup Guide

This guide will help you set up Stripe checkout and billing for multi-city trip subscriptions in the travel demo application.

## Overview

The application now includes a subscription system that requires users to have a **Premium subscription ($9.99/month)** to plan multi-city trips. Single-city round trips remain free.

## Features Implemented

### Backend
- ✅ Stripe payment processing integration
- ✅ Subscription management (create, update, cancel)
- ✅ Customer database with subscription tracking
- ✅ Webhook handling for subscription events
- ✅ Multi-city trip access control

### Frontend
- ✅ Subscription modal with checkout flow
- ✅ Email-based customer identification
- ✅ Subscription status display
- ✅ Billing portal access
- ✅ Premium badge for subscribed users

## Prerequisites

1. **Stripe Account**: Sign up at [https://stripe.com](https://stripe.com)
2. **Stripe API Keys**: Get your test keys from the Stripe Dashboard
3. **Stripe Product**: Create a subscription product in Stripe

## Step 1: Create Stripe Product

1. Log in to your Stripe Dashboard
2. Go to **Products** → **Add Product**
3. Configure the product:
   - **Name**: Premium travel assistant
   - **Description**: Multi-city trip planning access
   - **Pricing**: $9.99/month recurring
   - **Lookup Key**: `Premium_travel_assistant-6375498` (or customize)

4. Save the product and note the **Price ID** and **Lookup Key**

## Step 2: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Stripe credentials:
   ```bash
   # Stripe Configuration
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   STRIPE_PRICE_LOOKUP_KEY=Premium_travel_assistant-6375498

   # Frontend Stripe Key
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
   ```

3. Get your keys from Stripe Dashboard:
   - **Secret Key**: Dashboard → Developers → API keys → Secret key
   - **Publishable Key**: Dashboard → Developers → API keys → Publishable key
   - **Webhook Secret**: Set up in Step 3

## Step 3: Set Up Stripe Webhooks

### For Local Development (using Stripe CLI)

1. Install Stripe CLI:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Other platforms: https://stripe.com/docs/stripe-cli
   ```

2. Login to Stripe CLI:
   ```bash
   stripe login
   ```

3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:8000/stripe/webhook
   ```

4. Copy the webhook signing secret (starts with `whsec_`) and add to `.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

### For Production

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click **Add endpoint**
3. Configure:
   - **Endpoint URL**: `https://yourdomain.com/stripe/webhook`
   - **Events to listen to**: Select the following events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

4. Save and copy the **Signing secret** to your `.env` file

## Step 4: Install Dependencies

### Backend
```bash
cd backend
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
```

## Step 5: Start the Application

### Using Docker Compose (Recommended)
```bash
docker-compose up --build
```

### Manual Start
```bash
# Terminal 1 - Backend
cd backend
uvicorn app:app --reload

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - Stripe CLI (for local webhooks)
stripe listen --forward-to localhost:8000/stripe/webhook
```

## How It Works

### User Flow

1. **User enters email** in the trip planner form
2. **User tries to add a second city** (multi-city trip)
3. **Subscription modal appears** if user doesn't have premium
4. **User clicks "Subscribe Now"** → redirected to Stripe Checkout
5. **User completes payment** → redirected back to app
6. **Subscription activated** via webhook
7. **User can now plan multi-city trips**

### Subscription Check Flow

```
User submits multi-city trip request
         ↓
Backend checks email in Customer table
         ↓
Validates subscription_status == "active"
         ↓
If valid → Process trip planning
If invalid → Return 403 error
         ↓
Frontend shows subscription modal
```

### Database Schema

**Customer Table:**
- `id` - Primary key
- `email` - Unique user identifier
- `stripe_customer_id` - Stripe customer reference
- `subscription_status` - free/active/canceled/past_due
- `subscription_tier` - free/premium
- `stripe_subscription_id` - Active subscription ID
- `current_period_end` - Subscription expiry date

## API Endpoints

### Stripe Routes (`/stripe/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/stripe/create-checkout-session` | POST | Create Stripe Checkout session |
| `/stripe/create-portal-session` | POST | Open billing management portal |
| `/stripe/subscription-status/{email}` | GET | Get user's subscription status |
| `/stripe/webhook` | POST | Handle Stripe webhook events |

### Request Examples

**Create Checkout Session:**
```bash
curl -X POST http://localhost:8000/stripe/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

**Get Subscription Status:**
```bash
curl http://localhost:8000/stripe/subscription-status/user@example.com
```

## Testing the Integration

### Test Cards

Use these Stripe test cards for testing:

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0025 0000 3155` | Requires authentication (3D Secure) |
| `4000 0000 0000 9995` | Payment fails |

- **Expiry**: Any future date (e.g., 12/34)
- **CVC**: Any 3 digits (e.g., 123)
- **ZIP**: Any 5 digits (e.g., 12345)

### Testing Workflow

1. **Start the application** with Docker or manually
2. **Navigate to** http://localhost:3000
3. **Enter your email** in the trip planner
4. **Click "Add Another City"** (👑 button)
5. **Subscription modal appears**
6. **Enter test email** and click "Subscribe Now"
7. **Use test card** `4242 4242 4242 4242` in Stripe Checkout
8. **Complete payment** → redirected back to app
9. **Verify premium badge** appears next to email
10. **Add multiple cities** and plan multi-city trip

### Webhook Testing

Monitor webhook events in real-time:
```bash
stripe listen --forward-to localhost:8000/stripe/webhook
```

Trigger test events:
```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
```

## Subscription Management

### Customer Portal

Users can manage their subscription (update payment method, cancel, etc.) via the billing portal:

1. User enters their email
2. Clicks "Manage Billing" in the subscription modal
3. Redirected to Stripe Customer Portal
4. Can update card, view invoices, cancel subscription

### Cancellation Flow

When a user cancels:
1. Stripe sends `customer.subscription.deleted` webhook
2. Backend updates `subscription_status` to "canceled"
3. Backend sets `subscription_tier` to "free"
4. User loses access to multi-city trips

## Troubleshooting

### "Price not found" Error

**Problem**: Stripe can't find the price with the lookup key.

**Solution**:
1. Verify the product exists in Stripe Dashboard
2. Check the lookup key matches in `.env`: `STRIPE_PRICE_LOOKUP_KEY`
3. Ensure the price has the lookup key set in Stripe

### Webhooks Not Working

**Problem**: Subscription status not updating after payment.

**Solution**:
1. Check Stripe CLI is running: `stripe listen --forward-to localhost:8000/stripe/webhook`
2. Verify webhook secret in `.env` matches CLI output
3. Check backend logs for webhook errors
4. Ensure endpoint is accessible at `/stripe/webhook`

### 403 Error on Multi-City Trips

**Problem**: User has subscription but still gets blocked.

**Solution**:
1. Check subscription status: `GET /stripe/subscription-status/{email}`
2. Verify `subscription_status` is "active" in database
3. Ensure `current_period_end` hasn't expired
4. Check email matches exactly (case-sensitive)

### Database Not Updated

**Problem**: Customer table is empty or outdated.

**Solution**:
1. Restart backend to trigger database migration
2. Check `database.db` file exists
3. Verify SQLModel creates `Customer` table on startup
4. Test with: `docker exec -it travel_demo-backend-1 bash` then `sqlite3 database.db`

## Production Deployment

### Environment Variables

Update `.env` for production:
```bash
# Use live Stripe keys (start with sk_live_ and pk_live_)
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx

# Configure webhook in Stripe Dashboard for production domain
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Update frontend/backend URLs
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com
```

### Security Checklist

- ✅ Never commit `.env` file to version control
- ✅ Use live Stripe keys for production
- ✅ Enable webhook signature verification
- ✅ Use HTTPS for webhook endpoint
- ✅ Rotate Stripe API keys periodically
- ✅ Monitor Stripe Dashboard for suspicious activity

## Additional Resources

- [Stripe Checkout Documentation](https://stripe.com/docs/checkout)
- [Stripe Billing Documentation](https://stripe.com/docs/billing)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)

## Support

For issues or questions:
1. Check backend logs: `docker logs -f travel_demo-backend-1`
2. Check frontend console in browser DevTools
3. Review Stripe Dashboard → Developers → Logs
4. Test webhooks with Stripe CLI: `stripe listen`

## License

This integration follows the same license as the main travel demo application.
