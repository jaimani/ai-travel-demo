import React, { useState } from 'react';
import { createBooking } from '../utils/api';
import './BookingSummary.css';

function BookingSummary({ flight, hotel, tripDetails, onBookingComplete }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const calculateTotal = () => {
    const flightCost = flight.price * (tripDetails.passengers || 1);
    const hotelCost = hotel.total_cost || hotel.price_per_night;
    return flightCost + hotelCost;
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const bookingData = {
        user_email: email,
        origin: tripDetails.origin,
        destination: tripDetails.destination,
        departure_date: tripDetails.departure_date,
        return_date: tripDetails.return_date,
        flight_id: flight.id,
        hotel_id: hotel.id,
        total_cost: calculateTotal()
      };

      await createBooking(bookingData);
      setSuccess(true);

      setTimeout(() => {
        onBookingComplete();
      }, 3000);
    } catch (err) {
      console.error('Error creating booking:', err);
      setError(err.detail || err.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="booking-summary card">
        <div className="success-message">
          <h2>Booking Confirmed!</h2>
          <p>Your booking has been successfully created.</p>
          <p>A confirmation email has been sent to {email}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-summary card">
      <h2>Booking Summary</h2>

      <div className="summary-section">
        <h3>Flight Details</h3>
        <div className="summary-item">
          <span className="label">Airline:</span>
          <span className="value">{flight.airline}</span>
        </div>
        <div className="summary-item">
          <span className="label">Route:</span>
          <span className="value">{flight.origin} → {flight.destination}</span>
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
          <span className="label">Passengers:</span>
          <span className="value">{tripDetails.passengers || 1}</span>
        </div>
        <div className="summary-item">
          <span className="label">Flight Cost:</span>
          <span className="value cost">${(flight.price * (tripDetails.passengers || 1)).toFixed(2)}</span>
        </div>
      </div>

      <div className="summary-section">
        <h3>Hotel Details</h3>
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
          <span className="value">{tripDetails.departure_date}</span>
        </div>
        <div className="summary-item">
          <span className="label">Check-out:</span>
          <span className="value">{tripDetails.return_date}</span>
        </div>
        <div className="summary-item">
          <span className="label">Nights:</span>
          <span className="value">{hotel.nights || 1}</span>
        </div>
        <div className="summary-item">
          <span className="label">Hotel Cost:</span>
          <span className="value cost">${(hotel.total_cost || hotel.price_per_night).toFixed(2)}</span>
        </div>
      </div>

      <div className="total-section">
        <div className="total-item">
          <span className="label">Total Cost:</span>
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
            'Complete Booking'
          )}
        </button>
      </form>
    </div>
  );
}

export default BookingSummary;
