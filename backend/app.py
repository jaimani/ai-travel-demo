import os
import asyncio
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from dotenv import load_dotenv
from typing import List, Union, Any, Optional, Callable
import json

from models.database import (
    create_db_and_tables,
    get_session,
    Booking,
    TripPlanRequest,
    FlightSearchRequest,
    HotelSearchRequest,
    BookingRequest,
    Flight,
    Hotel,
    MultiCityTripPlanRequest,
    MultiCityBookingRequest,
    MultiCityBooking,
    validate_multi_city_trip,
    has_active_subscription,
    engine
)
from tools.flights_tool import search_flights, get_flight_by_id
from tools.hotels_tool import search_hotels, get_hotel_by_id
from app_agents.travel_agents import run_travel_planning, run_multi_city_planning
from routes.stripe_routes import router as stripe_router

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Llama Inc. Travel API",
    description="AI-powered travel booking platform using OpenAI Agents SDK",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React default ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Stripe routes
app.include_router(stripe_router, prefix="/stripe", tags=["stripe"])

# Initialize database on startup
@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# Health check endpoint
@app.get("/")
def read_root():
    return {
        "message": "Welcome to Llama Inc. Travel API",
        "version": "1.0.0",
        "status": "operational"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

def _format_trip_prompt(validated_request: TripPlanRequest) -> str:
    return f"""
    I need to plan a trip with the following details:
    - Origin: {validated_request.origin}
    - Destination: {validated_request.destination}
    - Departure Date: {validated_request.departure_date}
    - Return Date: {validated_request.return_date}
    - Budget: ${validated_request.budget}
    - Number of Passengers: {validated_request.passengers}

    Please search for flights and hotels that fit within my budget and provide recommendations.
    """


def _execute_trip_planning(
    request: dict,
    session: Session = None,
    user_email: str = None,
    progress_callback: Optional[Callable[[dict], None]] = None
) -> dict:
    """Shared logic for running the multi-agent planning workflow."""
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY not configured. Please set it in your environment."
        )

    try:
        if 'trip_legs' in request:
            validated_request = MultiCityTripPlanRequest(**request)
            valid, message = validate_multi_city_trip(validated_request.trip_legs)
            if not valid:
                raise HTTPException(status_code=400, detail=message)

            # Check subscription for multi-city trips
            if session and user_email:
                if not has_active_subscription(session, user_email):
                    raise HTTPException(
                        status_code=403,
                        detail="Multi-city trips require a premium subscription. Please upgrade to continue."
                    )

            trip_legs = [leg.dict() for leg in validated_request.trip_legs]
            result = run_multi_city_planning(
                trip_legs=trip_legs,
                budget=validated_request.budget,
                passengers=validated_request.passengers,
                progress_callback=progress_callback
            )
        else:
            validated_request = TripPlanRequest(**request)
            user_request = _format_trip_prompt(validated_request)
            result = run_travel_planning(user_request, progress_callback=progress_callback)

        if not result.get('success'):
            raise HTTPException(status_code=500, detail=result.get('error', 'Planning failed'))

        return {
            "success": True,
            "plan": result['final_response'],
            "messages": result['messages'],
            "workflow_steps": result.get('workflow_steps', []),
            "final_response": result.get('final_response'),
            "trip_type": result.get('trip_type', 'single_city')
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error planning trip: {str(e)}")


def _format_sse(event: str, data: Optional[dict]) -> str:
    payload = json.dumps(data or {})
    return f"event: {event}\ndata: {payload}\n\n"


# Planner endpoint - Uses OpenAI Agents SDK
@app.post("/planner/plan_trip")
def plan_trip(request: dict, session: Session = Depends(get_session)):
    """
    Plan a complete trip using AI agents (supports both single-city and multi-city trips).
    This endpoint orchestrates multiple agents to search flights, hotels, and create an itinerary.
    """
    user_email = request.get("user_email")
    return _execute_trip_planning(request, session=session, user_email=user_email)


@app.post("/planner/plan_trip_stream")
async def plan_trip_stream(request: dict, session: Session = Depends(get_session)):
    """Stream workflow updates while the planner is running."""

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[tuple[str, Optional[dict]]] = asyncio.Queue()
    user_email = request.get("user_email")

    def progress_callback(step: dict) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, ("workflow_step", step))

    async def run_planner():
        def blocking_task():
            return _execute_trip_planning(request, session=session, user_email=user_email, progress_callback=progress_callback)

        try:
            result = await asyncio.to_thread(blocking_task)
            await queue.put(("final_result", result))
        except HTTPException as exc:
            await queue.put(("error", {"detail": exc.detail, "status_code": exc.status_code}))
        except Exception as exc:
            await queue.put(("error", {"detail": f"Error planning trip: {str(exc)}"}))
        finally:
            await queue.put(("complete", None))

    async def event_generator():
        planner_task = asyncio.create_task(run_planner())
        try:
            while True:
                event_type, payload = await queue.get()
                if event_type == "complete":
                    break
                yield _format_sse(event_type, payload)
                if event_type == "error":
                    break
        finally:
            await planner_task

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    }

    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)

# Flights endpoints
@app.post("/flights/search", response_model=List[Flight])
def search_flights_endpoint(request: FlightSearchRequest):
    """Search for available flights."""
    try:
        flights = search_flights(
            request.origin,
            request.destination,
            request.departure_date,
            request.return_date
        )
        return flights
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching flights: {str(e)}")

@app.get("/flights/{flight_id}", response_model=Flight)
def get_flight(flight_id: str):
    """Get details of a specific flight."""
    flight = get_flight_by_id(flight_id)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    return flight

# Hotels endpoints
@app.post("/hotels/search")
def search_hotels_endpoint(request: HotelSearchRequest):
    """Search for available hotels."""
    try:
        hotels = search_hotels(
            request.city,
            request.checkin_date,
            request.checkout_date
        )
        return hotels
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching hotels: {str(e)}")

@app.get("/hotels/{hotel_id}")
def get_hotel(hotel_id: str):
    """Get details of a specific hotel."""
    hotel = get_hotel_by_id(hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    return hotel

# Multi-City Endpoints
@app.post("/flights/search_multi")
def search_multi_leg_flights(request: dict):
    """
    Search for flights across multiple legs.
    Request body: { "legs": [{"origin": "NYC", "destination": "LAX", "departure_date": "2025-01-15"}, ...] }
    """
    try:
        legs = request.get('legs', [])
        all_flights = {}

        for i, leg in enumerate(legs):
            flights = search_flights(
                leg['origin'],
                leg['destination'],
                leg['departure_date'],
                None  # No return date for individual legs
            )
            all_flights[f"leg_{i+1}"] = flights

        return all_flights
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching multi-leg flights: {str(e)}")

@app.post("/hotels/search_multi")
def search_multi_city_hotels(request: dict):
    """
    Search for hotels in multiple cities.
    Request body: { "cities": [{"city": "LAX", "checkin_date": "...", "checkout_date": "..."}, ...] }
    """
    try:
        cities = request.get('cities', [])
        all_hotels = {}

        for city_req in cities:
            hotels = search_hotels(
                city_req['city'],
                city_req['checkin_date'],
                city_req['checkout_date']
            )
            all_hotels[city_req['city']] = hotels

        return all_hotels
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching multi-city hotels: {str(e)}")

# Bookings endpoints
@app.post("/bookings", response_model=Booking)
def create_booking(booking: BookingRequest, session: Session = Depends(get_session)):
    """Create a new booking."""
    try:
        # Verify flight and hotel exist
        flight = get_flight_by_id(booking.flight_id)
        hotel = get_hotel_by_id(booking.hotel_id)

        if not flight:
            raise HTTPException(status_code=404, detail=f"Flight {booking.flight_id} not found")
        if not hotel:
            raise HTTPException(status_code=404, detail=f"Hotel {booking.hotel_id} not found")

        # Create booking
        db_booking = Booking(
            user_email=booking.user_email,
            origin=booking.origin,
            destination=booking.destination,
            departure_date=booking.departure_date,
            return_date=booking.return_date,
            flight_id=booking.flight_id,
            hotel_id=booking.hotel_id,
            total_cost=booking.total_cost
        )

        session.add(db_booking)
        session.commit()
        session.refresh(db_booking)

        return db_booking
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating booking: {str(e)}")

@app.post("/bookings/multi_city", response_model=MultiCityBooking)
def create_multi_city_booking(booking: MultiCityBookingRequest, session: Session = Depends(get_session)):
    """Create a multi-city booking."""
    try:
        # Validate flights exist
        for flight_id in booking.flight_ids:
            flight = get_flight_by_id(flight_id)
            if not flight:
                raise HTTPException(status_code=404, detail=f"Flight {flight_id} not found")

        # Validate hotels exist
        for hotel_id in booking.hotel_ids:
            hotel = get_hotel_by_id(hotel_id)
            if not hotel:
                raise HTTPException(status_code=404, detail=f"Hotel {hotel_id} not found")

        # Create booking
        db_booking = MultiCityBooking(
            user_email=booking.user_email,
            trip_legs_json=json.dumps([leg.dict() for leg in booking.trip_legs]),
            flight_ids_json=json.dumps(booking.flight_ids),
            hotel_ids_json=json.dumps(booking.hotel_ids),
            total_cost=booking.total_cost
        )

        session.add(db_booking)
        session.commit()
        session.refresh(db_booking)

        return db_booking
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating multi-city booking: {str(e)}")

@app.get("/bookings")
def get_bookings(session: Session = Depends(get_session)):
    """Get all bookings (both single-city and multi-city)."""
    try:
        # Get single-city bookings
        single_city = session.exec(select(Booking)).all()
        single_city_list = [
            {**{
                'id': b.id,
                'user_email': b.user_email,
                'origin': b.origin,
                'destination': b.destination,
                'departure_date': b.departure_date,
                'return_date': b.return_date,
                'flight_id': b.flight_id,
                'hotel_id': b.hotel_id,
                'total_cost': b.total_cost,
                'created_at': b.created_at
            }, 'trip_type': 'single_city'}
            for b in single_city
        ]

        # Get multi-city bookings
        multi_city = session.exec(select(MultiCityBooking)).all()
        multi_city_list = [
            {**{
                'id': b.id,
                'user_email': b.user_email,
                'trip_legs_json': b.trip_legs_json,
                'flight_ids_json': b.flight_ids_json,
                'hotel_ids_json': b.hotel_ids_json,
                'total_cost': b.total_cost,
                'created_at': b.created_at
            }, 'trip_type': 'multi_city'}
            for b in multi_city
        ]

        return single_city_list + multi_city_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching bookings: {str(e)}")

@app.get("/bookings/{booking_id}", response_model=Booking)
def get_booking(booking_id: int, session: Session = Depends(get_session)):
    """Get a specific booking by ID."""
    booking = session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
