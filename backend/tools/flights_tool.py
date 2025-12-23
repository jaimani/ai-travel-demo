import json
from pathlib import Path
from datetime import datetime, timedelta, time
from functools import lru_cache

DATA_FILE = Path(__file__).parent.parent / "data" / "sample_flights.json"


def _load_base_flights():
    with open(DATA_FILE, 'r') as f:
        return json.load(f)


def _build_flight(flight_id: str, airline: str, origin: str, destination: str,
                  departure_dt: datetime, duration_minutes: int,
                  price: float, stops: int) -> dict:
    arrival_dt = departure_dt + timedelta(minutes=duration_minutes)
    return {
        "id": flight_id,
        "airline": airline,
        "origin": origin,
        "destination": destination,
        "departure_time": departure_dt.isoformat(timespec='minutes'),
        "arrival_time": arrival_dt.isoformat(timespec='minutes'),
        "price": round(price, 2),
        "duration": f"{duration_minutes // 60}h {duration_minutes % 60:02d}m",
        "stops": stops
    }


def _generate_daily_ny_la_schedule():
    start_date = datetime(2025, 12, 1)
    end_date = datetime(2026, 1, 31)
    flights = []

    outbound_patterns = [
        {"airline": "Ocean Air", "time": time(7, 0), "duration": 360, "price": 259.0, "stops": 0},
        {"airline": "Sky Airways", "time": time(12, 30), "duration": 345, "price": 309.0, "stops": 0},
        {"airline": "Budget Airlines", "time": time(18, 15), "duration": 390, "price": 219.0, "stops": 1}
    ]

    return_patterns = [
        {"airline": "Ocean Air", "time": time(9, 0), "duration": 355, "price": 269.0, "stops": 0},
        {"airline": "Sky Airways", "time": time(14, 45), "duration": 345, "price": 299.0, "stops": 0},
        {"airline": "Budget Airlines", "time": time(21, 0), "duration": 405, "price": 229.0, "stops": 1}
    ]

    current = start_date
    while current <= end_date:
        for idx, pattern in enumerate(outbound_patterns, start=1):
            dep_dt = datetime.combine(current.date(), pattern["time"])
            flight_id = f"NYLA-{current.strftime('%Y%m%d')}-{idx}"
            flights.append(
                _build_flight(
                    flight_id,
                    pattern["airline"],
                    "New York",
                    "Los Angeles",
                    dep_dt,
                    pattern["duration"],
                    pattern["price"],
                    pattern["stops"]
                )
            )

        for idx, pattern in enumerate(return_patterns, start=1):
            dep_dt = datetime.combine(current.date(), pattern["time"])
            flight_id = f"LANY-{current.strftime('%Y%m%d')}-{idx}"
            flights.append(
                _build_flight(
                    flight_id,
                    pattern["airline"],
                    "Los Angeles",
                    "New York",
                    dep_dt,
                    pattern["duration"],
                    pattern["price"],
                    pattern["stops"]
                )
            )

        current += timedelta(days=1)

    return flights


@lru_cache(maxsize=1)
def _get_all_flights():
    flights = _load_base_flights()
    flights.extend(_generate_daily_ny_la_schedule())
    return flights

def _filter_flights(flights, origin, destination, date_str):
    if not flights:
        return []

    filtered = [
        f for f in flights
        if f['origin'].lower() == origin.lower()
        and f['destination'].lower() == destination.lower()
        and (not date_str or f['departure_time'].startswith(date_str))
    ]

    return sorted(filtered, key=lambda f: f['departure_time'])


def search_flights(origin: str, destination: str, departure_date: str, return_date: str = None):
    """
    Search for available flights based on origin, destination, and dates.

    Args:
        origin: Departure city
        destination: Arrival city
        departure_date: Departure date (YYYY-MM-DD format)
        return_date: Return date (YYYY-MM-DD format, optional)

    Returns:
        List of matching flights
    """
    flights = _get_all_flights()

    matching_flights = _filter_flights(flights, origin, destination, departure_date)

    if return_date:
        matching_flights.extend(
            _filter_flights(flights, destination, origin, return_date)
        )

    return matching_flights


def get_flight_by_id(flight_id: str):
    """Get a specific flight by its ID."""
    for flight in _get_all_flights():
        if flight['id'] == flight_id:
            return flight
    return None
