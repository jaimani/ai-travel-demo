import json
from pathlib import Path
from datetime import datetime, timedelta

def search_hotels(city: str, checkin_date: str, checkout_date: str, max_price: float = None):
    """
    Search for available hotels in a city.

    Args:
        city: City name
        checkin_date: Check-in date (YYYY-MM-DD format)
        checkout_date: Check-out date (YYYY-MM-DD format)
        max_price: Maximum price per night (optional)

    Returns:
        List of matching hotels with total cost
    """
    # Load sample hotels data
    data_file = Path(__file__).parent.parent / "data" / "sample_hotels.json"
    with open(data_file, 'r') as f:
        hotels = json.load(f)

    # Filter hotels by city
    matching_hotels = [
        h for h in hotels
        if h['city'].lower() == city.lower()
    ]

    # Calculate number of nights
    try:
        checkin = datetime.fromisoformat(checkin_date)
        checkout = datetime.fromisoformat(checkout_date)
        nights = (checkout - checkin).days
    except:
        nights = 1

    # Add total cost and filter by max price
    result = []
    for hotel in matching_hotels:
        total_cost = hotel['price_per_night'] * nights
        if max_price is None or total_cost <= max_price:
            hotel_with_total = hotel.copy()
            hotel_with_total['total_cost'] = total_cost
            hotel_with_total['nights'] = nights
            result.append(hotel_with_total)

    # Sort by rating (highest first)
    result.sort(key=lambda x: x['rating'], reverse=True)

    return result


def get_hotel_by_id(hotel_id: str):
    """Get a specific hotel by its ID."""
    data_file = Path(__file__).parent.parent / "data" / "sample_hotels.json"
    with open(data_file, 'r') as f:
        hotels = json.load(f)

    for hotel in hotels:
        if hotel['id'] == hotel_id:
            return hotel

    return None
