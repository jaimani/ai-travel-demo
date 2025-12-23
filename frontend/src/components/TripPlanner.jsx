import React, { useState } from 'react';
import { planTrip, searchFlights, searchHotels, searchMultiLegFlights, searchMultiCityHotels } from '../utils/api';
import './TripPlanner.css';

function TripPlanner({ onTripPlanned, onFlightsFound, onHotelsFound }) {
  const [tripType, setTripType] = useState('single');

  // Single-city form data
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    departure_date: '',
    return_date: '',
    budget: '',
    passengers: 1
  });

  // Multi-city form data
  const [cities, setCities] = useState([
    { origin: '', destination: '', departure_date: '' }
  ]);
  const [budget, setBudget] = useState('');
  const [passengers, setPassengers] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Multi-city helper functions
  const addCity = () => {
    if (cities.length >= 4) return; // Max 4 legs (5 cities including return)

    const lastCity = cities[cities.length - 1];
    setCities([...cities, {
      origin: lastCity.destination, // Auto-fill origin from previous destination
      destination: '',
      departure_date: ''
    }]);
  };

  const removeCity = (index) => {
    if (cities.length === 1) return;
    setCities(cities.filter((_, i) => i !== index));
  };

  const updateCity = (index, field, value) => {
    const updated = [...cities];
    updated[index][field] = value;

    // Auto-update next leg's origin if destination changed
    if (field === 'destination' && index < cities.length - 1) {
      updated[index + 1].origin = value;
    }

    setCities(updated);
  };

  const validateRoundTrip = () => {
    if (cities.length < 2) {
      setError('Multi-city trips must have at least 2 legs');
      return false;
    }

    const origin = cities[0].origin.trim();
    const finalDestination = cities[cities.length - 1].destination.trim();

    if (!origin || !finalDestination) {
      setError('Please fill in all cities');
      return false;
    }

    if (origin.toLowerCase() !== finalDestination.toLowerCase()) {
      setError(`Trip must return to ${origin}. Currently ends at ${finalDestination}.`);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    onFlightsFound([]);
    onHotelsFound([]);

    try {
      let result;

      if (tripType === 'single') {
        // Single-city trip
        result = await planTrip({
          origin: formData.origin,
          destination: formData.destination,
          departure_date: formData.departure_date,
          return_date: formData.return_date,
          budget: parseFloat(formData.budget),
          passengers: parseInt(formData.passengers)
        });

        if (result.success) {
          onTripPlanned(result.final_response || result.plan, { tripType, ...formData }, result.workflow_steps);

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
      } else {
        // Multi-city trip
        if (!validateRoundTrip()) {
          setLoading(false);
          return;
        }

        const trip_legs = cities.map((leg, index) => ({
          origin: leg.origin,
          destination: leg.destination,
          departure_date: leg.departure_date,
          leg_number: index + 1
        }));

        result = await planTrip({
          trip_legs,
          budget: parseFloat(budget),
          passengers: parseInt(passengers),
          trip_type: 'multi_city'
        });

        if (result.success) {
          onTripPlanned(result.final_response || result.plan, { tripType, cities, budget, passengers }, result.workflow_steps);

          try {
            // Search flights for each leg and hotels for each destination city (excluding origin)
            const [flightResults, hotelResults] = await Promise.all([
              searchMultiLegFlights({ legs: cities }),
              searchMultiCityHotels({
                cities: cities.slice(0, -1).map((leg, i) => ({
                  city: leg.destination,
                  checkin_date: leg.departure_date,
                  checkout_date: cities[i + 1].departure_date
                }))
              })
            ]);

            onFlightsFound(flightResults || {});
            onHotelsFound(hotelResults || {});
          } catch (searchErr) {
            console.error('Error fetching booking options:', searchErr);
            setError('Trip planned, but we could not load bookable flights or hotels. Please try again.');
          }
        } else {
          setError(result.error || 'Failed to plan trip. Please try again.');
        }
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

      <div className="trip-type-selector">
        <label className="radio-label">
          <input
            type="radio"
            value="single"
            checked={tripType === 'single'}
            onChange={(e) => setTripType(e.target.value)}
          />
          Round Trip (Single City)
        </label>
        <label className="radio-label">
          <input
            type="radio"
            value="multi"
            checked={tripType === 'multi'}
            onChange={(e) => setTripType(e.target.value)}
          />
          Multi-City Trip
        </label>
      </div>

      <form onSubmit={handleSubmit}>
        {tripType === 'single' ? (
          // Single-city form
          <>
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
          </>
        ) : (
          // Multi-city form
          <>
            <div className="multi-city-legs">
              {cities.map((leg, index) => (
                <div key={index} className="city-leg">
                  <div className="leg-header">
                    <h4>Leg {index + 1}</h4>
                    {cities.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCity(index)}
                        className="btn-remove"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>From</label>
                      <input
                        type="text"
                        value={leg.origin}
                        onChange={(e) => updateCity(index, 'origin', e.target.value)}
                        placeholder="e.g., New York"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>To</label>
                      <input
                        type="text"
                        value={leg.destination}
                        onChange={(e) => updateCity(index, 'destination', e.target.value)}
                        placeholder="e.g., Los Angeles"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Departure Date</label>
                      <input
                        type="date"
                        value={leg.departure_date}
                        onChange={(e) => updateCity(index, 'departure_date', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {cities.length < 4 && (
              <button
                type="button"
                onClick={addCity}
                className="btn-add-city"
              >
                + Add Another City
              </button>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="multi-budget">Budget ($)</label>
                <input
                  type="number"
                  id="multi-budget"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g., 3000"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="multi-passengers">Passengers</label>
                <input
                  type="number"
                  id="multi-passengers"
                  value={passengers}
                  onChange={(e) => setPassengers(e.target.value)}
                  min="1"
                  max="10"
                  required
                />
              </div>
            </div>
          </>
        )}

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
