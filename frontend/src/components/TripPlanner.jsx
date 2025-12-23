import React, { useState } from 'react';
import { planTrip, searchFlights, searchHotels } from '../utils/api';
import './TripPlanner.css';

function TripPlanner({ onTripPlanned, onFlightsFound, onHotelsFound }) {
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    departure_date: '',
    return_date: '',
    budget: '',
    passengers: 1
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    onFlightsFound([]);
    onHotelsFound([]);

    try {
      // Always use AI agents for planning
      const result = await planTrip({
        origin: formData.origin,
        destination: formData.destination,
        departure_date: formData.departure_date,
        return_date: formData.return_date,
        budget: parseFloat(formData.budget),
        passengers: parseInt(formData.passengers)
      });

      if (result.success) {
        // Pass both plan and workflow steps
        onTripPlanned(result.final_response || result.plan, formData, result.workflow_steps);

        try {
          const [flightResults, hotelResults] = await Promise.all([
            searchFlights({
              origin: formData.origin,
              destination: formData.destination,
              departure_date: formData.departure_date,
              return_date: formData.return_date
            }),
            searchHotels({
              city: formData.destination,
              checkin_date: formData.departure_date,
              checkout_date: formData.return_date
            })
          ]);

          onFlightsFound(flightResults || []);
          onHotelsFound(hotelResults || []);
        } catch (searchErr) {
          console.error('Error fetching booking options:', searchErr);
          setError('Trip planned, but we could not load bookable flights or hotels. Please try again.');
        }
      } else {
        setError(result.error || 'Failed to plan trip. Please try again.');
      }
    } catch (err) {
      console.error('Error planning trip:', err);
      setError(err.detail || err.message || 'An error occurred while planning your trip.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="trip-planner card">
      <h2>Plan Your Trip</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="origin">From</label>
            <input
              type="text"
              id="origin"
              name="origin"
              value={formData.origin}
              onChange={handleChange}
              placeholder="e.g., New York"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="destination">To</label>
            <input
              type="text"
              id="destination"
              name="destination"
              value={formData.destination}
              onChange={handleChange}
              placeholder="e.g., Los Angeles"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="departure_date">Departure Date</label>
            <input
              type="date"
              id="departure_date"
              name="departure_date"
              value={formData.departure_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="return_date">Return Date</label>
            <input
              type="date"
              id="return_date"
              name="return_date"
              value={formData.return_date}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="budget">Budget ($)</label>
            <input
              type="number"
              id="budget"
              name="budget"
              value={formData.budget}
              onChange={handleChange}
              placeholder="e.g., 2000"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="passengers">Passengers</label>
            <input
              type="number"
              id="passengers"
              name="passengers"
              value={formData.passengers}
              onChange={handleChange}
              min="1"
              max="10"
              required
            />
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? (
            <>
              <span className="loading"></span> Planning your trip...
            </>
          ) : (
            'Plan My Trip with AI'
          )}
        </button>
      </form>
    </div>
  );
}

export default TripPlanner;
