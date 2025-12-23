import React from 'react';
import './HotelsList.css';

function MultiCityHotelsList({ hotelsByCity, onHotelSelected, selectedHotels }) {
  if (!hotelsByCity || Object.keys(hotelsByCity).length === 0) {
    return null;
  }

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const stars = [];

    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={`full-${i}`} className="star full">★</span>);
    }

    if (hasHalfStar) {
      stars.push(<span key="half" className="star half">★</span>);
    }

    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<span key={`empty-${i}`} className="star empty">☆</span>);
    }

    return stars;
  };

  return (
    <div className="hotels-list card multi-city-hotels">
      <h2>Available Hotels</h2>
      {Object.entries(hotelsByCity).map(([city, hotels]) => (
        <div key={city} className="city-section">
          <h3 className="city-title">{city}</h3>
          <div className="hotels-grid">
            {hotels.map((hotel) => (
              <div
                key={hotel.id}
                className={`hotel-card ${selectedHotels[city]?.id === hotel.id ? 'selected' : ''}`}
                onClick={() => onHotelSelected(city, hotel)}
              >
                <div className="hotel-header">
                  <div>
                    <h4>{hotel.name}</h4>
                    <p className="hotel-location">{hotel.address}</p>
                  </div>
                  <div className="hotel-price">
                    <span className="price-amount">${hotel.price_per_night.toFixed(2)}</span>
                    <span className="price-label">/night</span>
                  </div>
                </div>

                <div className="hotel-rating">
                  {renderStars(hotel.rating)}
                  <span className="rating-number">{hotel.rating.toFixed(1)}</span>
                </div>

                <div className="hotel-amenities">
                  {hotel.amenities.slice(0, 5).map((amenity, index) => (
                    <span key={index} className="amenity-tag">
                      {amenity}
                    </span>
                  ))}
                  {hotel.amenities.length > 5 && (
                    <span className="amenity-tag more">
                      +{hotel.amenities.length - 5} more
                    </span>
                  )}
                </div>

                {hotel.total_cost && (
                  <div className="hotel-total">
                    <span>Total for {hotel.nights} night(s):</span>
                    <strong>${hotel.total_cost.toFixed(2)}</strong>
                  </div>
                )}

                <div className="hotel-actions">
                  <button
                    type="button"
                    className="book-hotel-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onHotelSelected(city, hotel);
                    }}
                  >
                    Select for {city}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default MultiCityHotelsList;
