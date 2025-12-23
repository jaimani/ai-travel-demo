# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered travel booking application built with React (frontend) and Python/FastAPI (backend). It uses the OpenAI Agents SDK to orchestrate multiple specialized agents for intelligent trip planning.

**Tech Stack:**
- Backend: Python 3.11+ with FastAPI, OpenAI Agents SDK, SQLModel (SQLite)
- Frontend: React 18 with Vite, Axios
- Deployment: Docker Compose

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
- `POST /planner/plan_trip` - AI-driven trip planning (uses agents)
- `POST /flights/search` - Direct flight search (bypasses agents)
- `POST /hotels/search` - Direct hotel search (bypasses agents)
- `POST /bookings` - Create booking (persists to SQLite)
- `GET /bookings` - List all bookings
- `GET /health` - Health check

**Request/Response Models:**
- Defined in `backend/models/database.py` using SQLModel/Pydantic
- Key models: `TripPlanRequest`, `FlightSearchRequest`, `HotelSearchRequest`, `BookingRequest`, `Flight`, `Hotel`, `Booking`

### Database Layer

**SQLModel ORM:**
- Single persistent table: `Booking` (tracks user bookings)
- Flights and hotels are NOT stored in the database (loaded from JSON files)
- Database file: `database.db` (SQLite)
- Session management via dependency injection: `Depends(get_session)`

**Important:** The sample data files (`sample_flights.json`, `sample_hotels.json`) are the source of truth for available flights/hotels. The `flights_tool.py` also dynamically generates a NY-LA flight schedule.

### Frontend Architecture

**React Component Structure:**
- `App.jsx` - Root component, manages global state (flights, hotels, bookings, workflow)
- `TripPlanner.jsx` - Search form, triggers parallel API calls to `/planner/plan_trip`, `/flights/search`, `/hotels/search`
- `FlightsList.jsx` - Displays flight results with recommendation badges
- `HotelsList.jsx` - Displays hotel results with recommendation badges
- `BookingSummary.jsx` - Booking confirmation form, calculates total cost

**API Client:**
- Located at `frontend/src/utils/api.js`
- Axios-based with configurable base URL (`VITE_API_URL`)
- Methods: `planTrip()`, `searchFlights()`, `searchHotels()`, `createBooking()`

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

**Optional Variables:**
- `FRONTEND_URL` - Frontend domain (defaults to `localhost:3000`)
- `BACKEND_URL` - Backend domain (defaults to `localhost:8000`)
- `VITE_API_URL` - Frontend API base URL (defaults to `http://localhost:8000`)

**Setup:**
```bash
cp .env.example .env
# Edit .env and add: OPENAI_API_KEY=sk-your-key-here
```

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
