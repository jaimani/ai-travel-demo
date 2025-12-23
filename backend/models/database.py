from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, create_engine, Session
from pydantic import BaseModel

# Database Models
class Booking(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_email: str
    origin: str
    destination: str
    departure_date: str
    return_date: str
    flight_id: str
    hotel_id: str
    total_cost: float
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# Request/Response Models
class TripPlanRequest(BaseModel):
    origin: str
    destination: str
    departure_date: str
    return_date: str
    budget: float
    passengers: int = 1

class FlightSearchRequest(BaseModel):
    origin: str
    destination: str
    departure_date: str
    return_date: str

class HotelSearchRequest(BaseModel):
    city: str
    checkin_date: str
    checkout_date: str

class BookingRequest(BaseModel):
    user_email: str
    origin: str
    destination: str
    departure_date: str
    return_date: str
    flight_id: str
    hotel_id: str
    total_cost: float

class Flight(BaseModel):
    id: str
    airline: str
    origin: str
    destination: str
    departure_time: str
    arrival_time: str
    price: float
    duration: str
    stops: int

class Hotel(BaseModel):
    id: str
    name: str
    city: str
    rating: float
    price_per_night: float
    amenities: list[str]
    address: str

# Multi-City Trip Models
class TripLeg(BaseModel):
    """One segment of a multi-city trip"""
    origin: str
    destination: str
    departure_date: str
    leg_number: int

class MultiCityTripPlanRequest(BaseModel):
    """Multi-city trip planning request"""
    trip_legs: list[TripLeg]
    budget: float
    passengers: int = 1
    trip_type: str = "multi_city"

class MultiCityBookingRequest(BaseModel):
    """Multi-city booking request"""
    user_email: str
    trip_legs: list[TripLeg]
    flight_ids: list[str]  # One per leg
    hotel_ids: list[str]   # One per destination (excluding origin)
    total_cost: float

class MultiCityBooking(SQLModel, table=True):
    """Database model for multi-city bookings"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_email: str
    trip_type: str = "multi_city"
    trip_legs_json: str      # Serialized TripLeg list
    flight_ids_json: str     # Serialized flight IDs
    hotel_ids_json: str      # Serialized hotel IDs
    total_cost: float
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# Validation Functions
def validate_multi_city_trip(trip_legs: list[TripLeg]) -> tuple[bool, str]:
    """Validates multi-city trip constraints"""
    # Check minimum legs
    if len(trip_legs) < 2:
        return False, "Multi-city trips must have at least 2 legs"

    # Check maximum legs (4 legs = 5 cities including return)
    if len(trip_legs) > 4:
        return False, "Multi-city trips cannot exceed 4 legs (5 cities total)"

    # Validate round trip (origin == final destination)
    origin = trip_legs[0].origin
    final_destination = trip_legs[-1].destination
    if origin != final_destination:
        return False, f"Trip must return to origin. Started at {origin}, ended at {final_destination}"

    # Validate leg continuity (each leg's destination must be next leg's origin)
    for i in range(len(trip_legs) - 1):
        if trip_legs[i].destination != trip_legs[i + 1].origin:
            return False, f"Leg {i+1} ends at {trip_legs[i].destination} but leg {i+2} starts at {trip_legs[i+1].origin}"

    return True, "Valid"

# Database setup
sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

engine = create_engine(sqlite_url, echo=True)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
