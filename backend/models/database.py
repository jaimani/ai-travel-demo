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

# Database setup
sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

engine = create_engine(sqlite_url, echo=True)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
