# Llama Inc. Travel - AI-Powered Trip Planning

A full-stack travel booking demo powered by **OpenAI Agents SDK** with multi-agent orchestration for intelligent trip planning. It uses **Stripe Checkout** to charge users for a subscription to unlock multi-city trip planning.

## Stack

- **Backend**: Python/FastAPI + OpenAI Agents SDK + SQLModel
- **Frontend**: React + Vite
- **Database**: SQLite

## Prerequisites

- **OpenAI API Key** (required) - [Get one here](https://platform.openai.com/api-keys)
- Python 3.11+ OR Docker

## Quick Start

### 1. Get an OpenAI API Key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign up or log in
3. Create a new API key
4. Copy the key (starts with `sk-`)

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your API key:
```bash
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Start the App

Use the provided helper script to launch both services with Docker Compose:

```bash
./start.sh
```

The script copies `.env.example` to `.env` if needed, reminds you to set `OPENAI_API_KEY`, and then brings up the stack via `docker-compose up --build`.

Access the app:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Testing the App

### Using the Web Interface

1. Open http://localhost:3000
2. Fill in the trip details:
   - Origin: New York
   - Destination: Los Angeles
   - Dates: Any future dates
   - Budget: 2000
   - Passengers: 1
3. Click "Plan with AI" to see agent orchestration in action
4. Select a flight and hotel, then complete booking

### Using the API

Test the AI planning endpoint:
```bash
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

Interactive API documentation: http://localhost:8000/docs

## How It Works

The app uses **OpenAI Agents SDK** with a multi-agent workflow:

```
PlannerAgent → FlightsAgent → HotelsAgent → ItineraryAgent
```

Each agent has specialized instructions and tools. The workflow is orchestrated sequentially with handoffs between agents. See `backend/app_agents/travel_agents.py` for implementation details.

## Features

- Multi-agent orchestration (PlannerAgent, FlightsAgent, HotelsAgent, ItineraryAgent)
- AI-powered trip recommendations
- Flight and hotel search
- Booking system with SQLite persistence
- Sample data for 14+ flights and 18+ hotels
- Interactive API documentation at `/docs`

## Troubleshooting

**"OPENAI_API_KEY not configured"**
Make sure you've created a `.env` file with your OpenAI API key.

**Port already in use**
Change ports in `docker-compose.yml` or use different ports when running locally.

**CORS errors**
Backend allows `localhost:3000` and `localhost:5173`. Update `backend/app.py` if using different ports.

## Resources

- [OpenAI Agents SDK Documentation](https://openai.github.io/openai-agents-python/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Get OpenAI API Key](https://platform.openai.com/api-keys)

---

Built with the OpenAI Agents SDK and Stripe Checkout
