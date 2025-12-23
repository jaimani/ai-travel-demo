import os
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from dotenv import load_dotenv
from typing import List

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
    engine
)
from tools.flights_tool import search_flights, get_flight_by_id
from tools.hotels_tool import search_hotels, get_hotel_by_id
from app_agents.travel_agents import run_travel_planning

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

# Planner endpoint - Uses OpenAI Agents SDK
@app.post("/planner/plan_trip")
def plan_trip(request: TripPlanRequest):
    """
    Plan a complete trip using AI agents.
    This endpoint orchestrates multiple agents to search flights, hotels, and create an itinerary.
    """
    # Validate OpenAI API key
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY not configured. Please set it in your environment."
        )

    # Format the request for the agent
    user_request = f"""
    I need to plan a trip with the following details:
    - Origin: {request.origin}
    - Destination: {request.destination}
    - Departure Date: {request.departure_date}
    - Return Date: {request.return_date}
    - Budget: ${request.budget}
    - Number of Passengers: {request.passengers}

    Please search for flights and hotels that fit within my budget and provide recommendations.
    """

    try:
        # Run the AI agent workflow
        result = run_travel_planning(user_request)

        if not result.get('success'):
            raise HTTPException(status_code=500, detail=result.get('error', 'Planning failed'))

        return {
            "success": True,
            "plan": result['final_response'],
            "messages": result['messages'],
            "workflow_steps": result.get('workflow_steps', []),
            "final_response": result.get('final_response')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error planning trip: {str(e)}")

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

@app.get("/bookings", response_model=List[Booking])
def get_bookings(session: Session = Depends(get_session)):
    """Get all bookings."""
    try:
        statement = select(Booking)
        bookings = session.exec(statement).all()
        return bookings
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
