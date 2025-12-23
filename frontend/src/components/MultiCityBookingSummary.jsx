import React, { useState } from 'react';
import { createMultiCityBooking } from '../utils/api';
import './BookingSummary.css';

function MultiCityBookingSummary({ selectedFlights, selectedHotels, tripDetails, onBookingComplete }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const calculateTotal = () => {
    // Calculate total flight cost
    const flightsCost = Object.values(selectedFlights).reduce(
      (sum, flight) => sum + (flight.price * (tripDetails.passengers || 1)),
      0
    );

    // Calculate total hotel cost
    const hotelsCost = Object.values(selectedHotels).reduce(
      (sum, hotel) => sum + (hotel.total_cost || hotel.price_per_night),
      0
    );

    return flightsCost + hotelsCost;
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const bookingData = {
        user_email: email,
        trip_legs: tripDetails.cities.map((leg, index) => ({
          origin: leg.origin,
          destination: leg.destination,
          departure_date: leg.departure_date,
          leg_number: index + 1
        })),
        flight_ids: Object.values(selectedFlights).map(f => f.id),
        hotel_ids: Object.values(selectedHotels).map(h => h.id),
        total_cost: calculateTotal()
      };

      await createMultiCityBooking(bookingData);
      setSuccess(true);

      setTimeout(() => {
        onBookingComplete();
      }, 3000);
    } catch (err) {
      console.error('Error creating multi-city booking:', err);
      setError(err.detail || err.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="booking-summary card">
        <div className="success-message">
          <h2>Multi-City Booking Confirmed!</h2>
          <p>Your multi-city trip has been successfully booked.</p>
          <p>A confirmation email has been sent to {email}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-summary card multi-city-summary">
      <h2>Multi-City Booking Summary</h2>

      {tripDetails.cities.map((leg, index) => {
        const legKey = `leg_${index + 1}`;
        const flight = selectedFlights[legKey];
        const hotel = selectedHotels[leg.destination];

        return (
          <div key={index} className="leg-summary">
            <h3>Leg {index + 1}: {leg.origin} → {leg.destination}</h3>

            {flight && (
              <div className="summary-section">
                <h4>Flight</h4>
                <div className="summary-item">
                  <span className="label">Airline:</span>
                  <span className="value">{flight.airline}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Departure:</span>
                  <span className="value">{new Date(flight.departure_time).toLocaleString()}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Arrival:</span>
                  <span className="value">{new Date(flight.arrival_time).toLocaleString()}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Cost:</span>
                  <span className="value cost">${(flight.price * (tripDetails.passengers || 1)).toFixed(2)}</span>
                </div>
              </div>
            )}

            {hotel && index < tripDetails.cities.length - 1 && (
              <div className="summary-section">
                <h4>Hotel in {leg.destination}</h4>
                <div className="summary-item">
                  <span className="label">Hotel:</span>
                  <span className="value">{hotel.name}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Location:</span>
                  <span className="value">{hotel.address}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Rating:</span>
                  <span className="value">{hotel.rating} ★</span>
                </div>
                <div className="summary-item">
                  <span className="label">Check-in:</span>
                  <span className="value">{leg.departure_date}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Check-out:</span>
                  <span className="value">{tripDetails.cities[index + 1]?.departure_date || ''}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Nights:</span>
                  <span className="value">{hotel.nights || 1}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Cost:</span>
                  <span className="value cost">${(hotel.total_cost || hotel.price_per_night).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="summary-section">
        <h4>Trip Details</h4>
        <div className="summary-item">
          <span className="label">Number of Passengers:</span>
          <span className="value">{tripDetails.passengers || 1}</span>
        </div>
        <div className="summary-item">
          <span className="label">Total Legs:</span>
          <span className="value">{tripDetails.cities.length}</span>
        </div>
      </div>

      <div className="total-section">
        <div className="total-item">
          <span className="label">Total Flight Cost:</span>
          <span className="value">
            ${Object.values(selectedFlights).reduce(
              (sum, flight) => sum + (flight.price * (tripDetails.passengers || 1)),
              0
            ).toFixed(2)}
          </span>
        </div>
        <div className="total-item">
          <span className="label">Total Hotel Cost:</span>
          <span className="value">
            ${Object.values(selectedHotels).reduce(
              (sum, hotel) => sum + (hotel.total_cost || hotel.price_per_night),
              0
            ).toFixed(2)}
          </span>
        </div>
        <div className="total-item grand-total">
          <span className="label">Grand Total:</span>
          <span className="value">${calculateTotal().toFixed(2)}</span>
        </div>
      </div>

      <form onSubmit={handleBooking} className="booking-form">
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
          />
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? (
            <>
              <span className="loading"></span> Processing...
            </>
          ) : (
            'Complete Multi-City Booking'
          )}
        </button>
      </form>
    </div>
  );
}

export default MultiCityBookingSummary;
