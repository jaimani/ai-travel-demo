import React from 'react';
import './FlightsList.css';

function MultiCityFlightsList({ flightsByLeg, onFlightSelected, selectedFlights }) {
  if (!flightsByLeg || Object.keys(flightsByLeg).length === 0) {
    return null;
  }

  const formatTime = (dateTimeStr) => {
    const date = new Date(dateTimeStr);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateTimeStr) => {
    const date = new Date(dateTimeStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="flights-list card multi-city-flights">
      <h2>Available Flights</h2>
      {Object.entries(flightsByLeg).sort().map(([legKey, flights]) => {
        const legNumber = legKey.split('_')[1];
        return (
          <div key={legKey} className="leg-section">
            <h3 className="leg-title">Leg {legNumber}</h3>
            <div className="flights-grid">
              {flights.map((flight) => (
                <div
                  key={flight.id}
                  className={`flight-card ${selectedFlights[legKey]?.id === flight.id ? 'selected' : ''}`}
                  onClick={() => onFlightSelected(legKey, flight)}
                >
                  <div className="flight-header">
                    <h4>{flight.airline}</h4>
                    <span className="flight-price">${flight.price.toFixed(2)}</span>
                  </div>

                  <div className="flight-route">
                    <div className="route-point">
                      <div className="route-city">{flight.origin}</div>
                      <div className="route-time">{formatTime(flight.departure_time)}</div>
                      <div className="route-date">{formatDate(flight.departure_time)}</div>
                    </div>

                    <div className="route-line">
                      <div className="route-duration">{flight.duration}</div>
                      {flight.stops === 0 ? (
                        <div className="route-info">Direct</div>
                      ) : (
                        <div className="route-info">{flight.stops} stop(s)</div>
                      )}
                    </div>

                    <div className="route-point">
                      <div className="route-city">{flight.destination}</div>
                      <div className="route-time">{formatTime(flight.arrival_time)}</div>
                      <div className="route-date">{formatDate(flight.arrival_time)}</div>
                    </div>
                  </div>

                  <div className="flight-actions">
                    <button
                      type="button"
                      className="book-flight-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFlightSelected(legKey, flight);
                      }}
                    >
                      Select for Leg {legNumber}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MultiCityFlightsList;
