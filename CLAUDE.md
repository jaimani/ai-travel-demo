# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered travel booking application built with React (frontend) and Python/FastAPI (backend). It uses the OpenAI Agents SDK to orchestrate multiple specialized agents for intelligent trip planning.

**Tech Stack:**
- Backend: Python 3.11+ with FastAPI, OpenAI Agents SDK, SQLModel (SQLite), Stripe
- Frontend: React 18 with Vite, Axios, Stripe.js
- Deployment: Docker Compose
- Payment Processing: Stripe Checkout & Billing

## Getting Started

### Quick Start

```bash
# Setup environment and start application
./start.sh
```

This will:
1. Create `.env` file if it doesn't exist
2. Prompt you to add your OpenAI API key
3. Start all services using Docker Compose

### Docker Commands

```bash
# Start all services (frontend + backend)
docker-compose up --build

# Start in detached mode (background)
docker-compose up -d

# View logs
docker-compose logs -f
docker logs -f travel_demo-backend-1
docker logs -f travel_demo-frontend-1

# Stop all services
docker-compose down

# Rebuild specific service
docker-compose up --build backend
docker-compose up --build frontend

# Execute commands inside containers
docker exec -it travel_demo-backend-1 bash
docker exec -it travel_demo-frontend-1 sh

# Run tests inside backend container
docker exec -it travel_demo-backend-1 pytest -v
```

### Accessing the Application

Once running, access:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Architecture & Key Concepts

### Multi-Agent Orchestration System

The application uses a hierarchical agent workflow powered by the OpenAI Agents SDK. Understanding this flow is critical:

**Agent Hierarchy:**
```
User Request
    ↓
PlannerAgent (Orchestrator)
    ↓ handoff
FlightsAgent (Specialist) → uses search_flights_tool
    ↓ handoff
HotelsAgent (Specialist) → uses search_hotels_tool
    ↓ handoff
ItineraryAgent (Summarizer) → creates final recommendation
```

**Key Implementation Details:**
- Location: `backend/app_agents/travel_agents.py`
- Each agent is defined with `instructions`, `tools`, `handoffs`, and `model`
- Agents communicate via sequential handoffs, NOT parallel execution
- The `run_travel_planning()` function orchestrates the workflow
- `LoggingHooks` captures workflow events for frontend visualization
- All agents use `gpt-5-mini` model

**Tool Functions:**
- Tools must be decorated with `@function_tool` from the OpenAI Agents SDK
- Tools return JSON strings (not Python objects)
- Located in `backend/tools/`: `flights_tool.py`, `hotels_tool.py`
- Sample data loaded from `backend/data/`: `sample_flights.json`, `sample_hotels.json`

### API Architecture

**FastAPI Application Structure** (`backend/app.py`):
- CORS configured for `localhost:3000` and `localhost:5173`
- Database initialized on startup via `@app.on_event("startup")`
- Routes organized by domain: `/planner/*`, `/flights/*`, `/hotels/*`, `/bookings/*`

**Key Endpoints:**
- `POST /planner/plan_trip` - AI-driven trip planning (uses agents, requires subscription for multi-city)
- `POST /flights/search` - Direct flight search (bypasses agents)
- `POST /hotels/search` - Direct hotel search (bypasses agents)
- `POST /bookings` - Create booking (persists to SQLite)
- `GET /bookings` - List all bookings
- `GET /health` - Health check
- `POST /stripe/create-checkout-session` - Create Stripe Checkout session
- `POST /stripe/create-portal-session` - Open billing management portal
- `GET /stripe/subscription-status/{email}` - Get subscription status
- `POST /stripe/webhook` - Handle Stripe webhook events

**Request/Response Models:**
- Defined in `backend/models/database.py` using SQLModel/Pydantic
- Key models: `TripPlanRequest`, `FlightSearchRequest`, `HotelSearchRequest`, `BookingRequest`, `Flight`, `Hotel`, `Booking`, `Customer`

### Database Layer

**SQLModel ORM:**
- Database tables:
  - `Customer` - User accounts with Stripe subscription information
  - `Booking` - Single-city trip bookings
  - `MultiCityBooking` - Multi-city trip bookings
- Flights and hotels are NOT stored in the database (loaded from JSON files)
- Database file: `database.db` (SQLite)
- Session management via dependency injection: `Depends(get_session)`

**Customer Model** (`backend/models/database.py`):
- Tracks email-based customer identification (no passwords)
- Stores Stripe customer ID and subscription status
- Fields: `email`, `stripe_customer_id`, `subscription_status`, `subscription_tier`, `stripe_subscription_id`, `current_period_end`
- Helper functions: `get_or_create_customer()`, `has_active_subscription()`

**Important:** The sample data files (`sample_flights.json`, `sample_hotels.json`) are the source of truth for available flights/hotels. The `flights_tool.py` also dynamically generates a NY-LA flight schedule.

### Frontend Architecture

**React Component Structure:**
- `App.jsx` - Root component, manages global state (flights, hotels, bookings, workflow)
- `TripPlanner.jsx` - Search form with email input, subscription checks, triggers API calls
- `FlightsList.jsx` - Displays flight results with recommendation badges
- `HotelsList.jsx` - Displays hotel results with recommendation badges
- `BookingSummary.jsx` - Booking confirmation form, calculates total cost
- `SubscriptionModal.jsx` - Premium subscription upgrade modal with Stripe Checkout integration

**API Client:**
- Located at `frontend/src/utils/api.js`
- Axios-based with configurable base URL (`VITE_API_URL`)
- Trip planning: `planTrip()`, `searchFlights()`, `searchHotels()`, `createBooking()`
- Stripe integration: `createCheckoutSession()`, `createPortalSession()`, `getSubscriptionStatus()`

**Data Flow:**
1. User submits form in `TripPlanner`
2. Component calls `planTrip()` + parallel `searchFlights()` and `searchHotels()`
3. AI recommendations rendered as markdown (via `react-markdown`)
4. Flight/hotel lists displayed with recommended items highlighted
5. User selects flight + hotel → `BookingSummary` shown
6. User submits booking → saved to backend database

### Environment Configuration

**Required Environment Variables:**
- `OPENAI_API_KEY` - Required for agent execution (set in `.env`)
- `STRIPE_SECRET_KEY` - Stripe secret API key (sk_test_... for test mode)
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret from Stripe CLI or Dashboard
- `STRIPE_PRICE_LOOKUP_KEY` - Price lookup key for subscription product

**Optional Variables:**
- `FRONTEND_URL` - Frontend domain (defaults to `localhost:3000`)
- `BACKEND_URL` - Backend domain (defaults to `localhost:8000`)
- `VITE_API_URL` - Frontend API base URL (defaults to `http://localhost:8000`)
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key for frontend (pk_test_...)

**Setup:**
```bash
cp .env.example .env
# Edit .env and add required keys:
# OPENAI_API_KEY=sk-your-key-here
# STRIPE_SECRET_KEY=sk_test_your-stripe-key-here
# STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret-here
# VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key-here
```

**IMPORTANT:** After updating `.env`, restart Docker containers:
```bash
docker-compose down
docker-compose up --build
```

## Stripe Subscription System

### Overview

The application implements a **freemium model** where:
- **Free users**: Can plan single-city round trips (unlimited)
- **Premium users** ($9.99/month): Can plan multi-city trips (up to 4 legs/5 cities)

### Architecture

**Subscription Flow:**
```
User enters email → Tries to add 2nd city → Frontend checks subscription
    ↓                                              ↓
    NO subscription                           HAS subscription
    ↓                                              ↓
Show SubscriptionModal                       Allow multi-city planning
    ↓
User clicks "Subscribe Now"
    ↓
Create Stripe Checkout Session
    ↓
Redirect to Stripe Checkout
    ↓
User completes payment
    ↓
Stripe webhook: checkout.session.completed
    ↓
Backend updates Customer table:
  - subscription_status = "active"
  - subscription_tier = "premium"
    ↓
Redirect back to app with ?success=true
    ↓
Frontend refreshes subscription status
    ↓
User can now plan multi-city trips
```

### Backend Implementation

**Stripe Routes** (`backend/routes/stripe_routes.py`):
- `POST /stripe/create-checkout-session` - Creates Stripe Checkout session, returns URL
- `POST /stripe/create-portal-session` - Creates billing portal session for subscription management
- `GET /stripe/subscription-status/{email}` - Returns subscription status and tier
- `POST /stripe/webhook` - Handles Stripe webhook events (subscription lifecycle)

**Subscription Gating** (`backend/app.py`):
- `_execute_trip_planning()` function checks `has_active_subscription()` for multi-city requests
- Returns HTTP 403 if user doesn't have active premium subscription
- Passes `user_email` parameter from request to validate subscription

**Webhook Events Handled:**
- `checkout.session.completed` - Activates subscription after successful payment
- `customer.subscription.created` - Stores subscription ID and expiry date
- `customer.subscription.updated` - Updates status (active, past_due, etc.)
- `customer.subscription.deleted` - Downgrades to free tier
- `invoice.payment_succeeded` - Ensures subscription stays active
- `invoice.payment_failed` - Marks subscription as past_due

### Frontend Implementation

**Subscription Modal** (`frontend/src/components/SubscriptionModal.jsx`):
- Premium subscription upgrade UI with pricing ($9.99/month)
- Feature list display (multi-city trips, route optimization, etc.)
- Email input and validation
- "Subscribe Now" button triggers `createCheckoutSession()`
- "Manage Billing" button opens Stripe Customer Portal
- Redirects to Stripe Checkout URL on success

**TripPlanner Integration** (`frontend/src/components/TripPlanner.jsx`):
- Email input field with subscription status badge
- `useEffect` hook checks subscription status when email changes
- "Add Another City" button blocked for free users (shows modal)
- Error handling for 403 responses (subscription required)
- Auto-refresh subscription after Stripe redirect

**Subscription Status Display:**
- Green "Premium ✓" badge shown for active subscribers
- Badge appears next to email input field
- Status updates in real-time after successful payment

### Testing the Subscription Flow

**1. Local Development Setup:**
```bash
# Start Stripe webhook forwarding
stripe listen --forward-to localhost:8000/stripe/webhook

# Copy the webhook secret (whsec_...) to .env
# Restart containers: docker-compose down && docker-compose up --build
```

**2. Test with Stripe Test Cards:**
- Success: `4242 4242 4242 4242`
- 3D Secure: `4000 0025 0000 3155`
- Decline: `4000 0000 0000 9995`
- Expiry: Any future date (e.g., 12/34)
- CVC: Any 3 digits (e.g., 123)

**3. Test Flow:**
1. Go to http://localhost:3000
2. Enter email: `test@example.com`
3. Click "Add Another City" 👑 button
4. Modal appears with pricing
5. Click "Subscribe Now"
6. Use test card `4242 4242 4242 4242`
7. Complete checkout
8. Redirected back with "Premium ✓" badge
9. Can now add multiple cities

**4. Verify Subscription in Database:**
```bash
docker exec -it travel_demo-backend-1 sqlite3 database.db
sqlite> SELECT email, subscription_status, subscription_tier FROM customer;
```

### Stripe Product Configuration

**Required in Stripe Dashboard:**
1. Create product: "Premium travel assistant"
2. Price: $9.99/month recurring
3. Lookup key: `Premium_travel_assistant-6375498` (or custom)
4. Note the Price ID and ensure lookup key matches `.env`

**Creating Lookup Key:**
- Dashboard → Products → Select product → Edit price
- Scroll to "Lookup key" field
- Enter unique key (e.g., `premium_monthly`)
- Save and update `STRIPE_PRICE_LOOKUP_KEY` in `.env`

### Common Issues & Debugging

**"No API key provided" Error:**
- Ensure `STRIPE_SECRET_KEY` is in `.env`
- Verify environment variable is passed in `docker-compose.yml`
- Restart containers: `docker-compose down && docker-compose up --build`
- Check: `docker exec travel_demo-backend-1 printenv | grep STRIPE`

**Webhook Not Updating Database:**
- Start Stripe CLI: `stripe listen --forward-to localhost:8000/stripe/webhook`
- Copy webhook secret to `.env` as `STRIPE_WEBHOOK_SECRET`
- Check backend logs: `docker logs -f travel_demo-backend-1`
- Verify webhook signature in Stripe Dashboard logs

**Subscription Not Blocking Multi-City Trips:**
- Check email is passed in request: `user_email` field required
- Verify `has_active_subscription()` logic in `database.py`
- Check subscription status in database (should be "active")
- Ensure `current_period_end` hasn't expired

**Price Lookup Key Not Found:**
- Verify product exists in Stripe Dashboard
- Check lookup key matches exactly (case-sensitive)
- Ensure price has lookup key set (not just product name)
- Use `stripe prices list --lookup-keys="your-key"` to verify

### Security Considerations

- **Email-only authentication**: No passwords, customers identified by email
- **Server-side validation**: Subscription checks happen on backend (cannot be bypassed)
- **Webhook signatures**: Verified using `STRIPE_WEBHOOK_SECRET`
- **Test mode**: Use `sk_test_*` keys for development, `sk_live_*` for production
- **Environment variables**: Never commit `.env` to version control

### Additional Resources

- **Setup Guide**: See [STRIPE_SETUP.md](STRIPE_SETUP.md) for detailed configuration
- **Implementation Details**: See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for technical overview
- **Stripe Docs**: [Stripe Checkout](https://stripe.com/docs/checkout), [Webhooks](https://stripe.com/docs/webhooks)

## Common Development Patterns

### Adding a New Agent

1. Define the agent in `backend/app_agents/travel_agents.py`:
   ```python
   new_agent = Agent(
       name="NewAgent",
       instructions="Agent instructions here...",
       tools=[tool_function],  # Optional
       handoffs=[other_agent],  # Optional
       model="gpt-5-mini"
   )
   ```

2. Add to agent registry:
   ```python
   agents["NewAgent"] = new_agent
   ```

3. Update `planner_agent.handoffs` to include the new agent if needed

4. Modify `run_travel_planning()` to incorporate the agent in the workflow

### Adding a New Tool

1. Create tool function in `backend/tools/`:
   ```python
   @function_tool
   def new_tool(param: str) -> str:
       """Tool description for the agent."""
       # Tool implementation
       return json.dumps(results)
   ```

2. Import and add to agent's `tools` list:
   ```python
   agent = Agent(
       tools=[existing_tool, new_tool],
       # ...
   )
   ```

### Adding New API Endpoints

1. Define request/response models in `backend/models/database.py`
2. Add route to `backend/app.py`:
   ```python
   @app.post("/new-endpoint", response_model=ResponseModel)
   def endpoint_handler(request: RequestModel):
       # Implementation
       return response
   ```

3. Add corresponding method to `frontend/src/utils/api.js`:
   ```javascript
   export const newEndpoint = async (data) => {
     const response = await api.post('/new-endpoint', data);
     return response.data;
   };
   ```

### Modifying Sample Data

- Edit `backend/data/sample_flights.json` for flight inventory
- Edit `backend/data/sample_hotels.json` for hotel inventory
- Note: `flights_tool.py` includes dynamic NY-LA flight generation logic

### Working with the Booking Database

Access bookings via SQLModel queries:
```python
from sqlmodel import Session, select
from models.database import Booking

def get_session():
    # Use FastAPI's Depends(get_session)
    pass

# Query example
statement = select(Booking).where(Booking.user_email == "user@example.com")
bookings = session.exec(statement).all()
```

## Testing & Debugging

### Backend Testing

Run tests inside the Docker container:
```bash
docker exec -it travel_demo-backend-1 pytest -v
```

Test the API with curl:
```bash
# Health check
curl http://localhost:8000/health

# Plan a trip
curl -X POST http://localhost:8000/planner/plan_trip \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "New York",
    "destination": "Los Angeles",
    "departure_date": "2025-01-15",
    "return_date": "2025-01-22",
    "budget": 2000,
    "passengers": 1
  }'
```

### Frontend Testing

Access the app at `http://localhost:3000` and use browser DevTools to inspect:
- Network tab for API calls
- Console for errors
- React DevTools for component state

### Agent Workflow Debugging

The `LoggingHooks` class in `travel_agents.py` captures agent execution:
- `on_agent_start` / `on_agent_end` - Agent lifecycle
- `on_tool_start` - Tool invocations
- `on_llm_start` - LLM API calls

Check the `workflow_steps` array in the API response to see the execution trace.

## Important Notes

### Agent Model Configuration

All agents currently use `model="gpt-5-mini"`. If you need to change models, update the `model` parameter in each `Agent()` definition. Ensure your OpenAI API key has access to the specified model.

### CORS Configuration

If running frontend on a different port, update the CORS allowed origins in `backend/app.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:YOUR_PORT"],
    # ...
)
```

### Docker Volume Mounts

The docker-compose.yml excludes `__pycache__` and `node_modules` via volume exclusions. If you add new exclusions, update the volumes configuration.

### Sequential vs Parallel Agent Execution

The current implementation runs agents SEQUENTIALLY (Planner → Flights → Hotels → Itinerary). The `run_travel_planning()` function calls `run_agent()` one at a time. If you need parallel execution, you'll need to refactor to use async patterns.

### Database Migrations

This project uses SQLModel with `create_db_and_tables()` for automatic schema creation. For production use or schema changes, consider adding proper migration tooling (e.g., Alembic).
