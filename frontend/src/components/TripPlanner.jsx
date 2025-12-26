import React, { useState, useEffect } from 'react';
import { planTrip, searchMultiLegFlights, searchMultiCityHotels, getSubscriptionStatus } from '../utils/api';
import SubscriptionModal from './SubscriptionModal';
import SubscriptionSuccess from './SubscriptionSuccess';
import './TripPlanner.css';

const MAX_LEGS = 4;
const FORM_STATE_KEY = 'tripPlannerFormState';

function TripPlanner({ onTripPlanned, onFlightsFound, onHotelsFound, onWorkflowReset, onWorkflowStep, onSubscriptionStatusChange }) {
  // Multi-city form data - restore from localStorage if available
  const [cities, setCities] = useState(() => {
    try {
      const saved = localStorage.getItem(FORM_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.cities || [{ origin: '', destination: '', departure_date: '' }];
      }
    } catch (err) {
      console.error('Failed to restore form state:', err);
    }
    return [{ origin: '', destination: '', departure_date: '' }];
  });
  const [returnDate, setReturnDate] = useState(() => {
    try {
      const saved = localStorage.getItem(FORM_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.returnDate || '';
      }
    } catch (err) {
      console.error('Failed to restore form state:', err);
    }
    return '';
  });
  const [budget, setBudget] = useState(() => {
    try {
      const saved = localStorage.getItem(FORM_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.budget || '';
      }
    } catch (err) {
      console.error('Failed to restore form state:', err);
    }
    return '';
  });
  const [passengers, setPassengers] = useState(() => {
    try {
      const saved = localStorage.getItem(FORM_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.passengers || 1;
      }
    } catch (err) {
      console.error('Failed to restore form state:', err);
    }
    return 1;
  });
  const [userEmail, setUserEmail] = useState(() => {
    // Try to restore email from localStorage
    return localStorage.getItem('userEmail') || '';
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);

  // Check subscription status when email changes
  useEffect(() => {
    if (userEmail) {
      // Save email to localStorage whenever it changes
      localStorage.setItem('userEmail', userEmail);

      getSubscriptionStatus(userEmail)
        .then(status => {
          setSubscriptionStatus(status);
          // Notify parent component
          if (onSubscriptionStatusChange) {
            onSubscriptionStatusChange(userEmail, status);
          }
        })
        .catch(err => console.error('Failed to get subscription status:', err));
    }
  }, [userEmail, onSubscriptionStatusChange]);

  // Check for success/canceled query params from Stripe redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success')) {
      // Show success modal
      setShowSuccessModal(true);

      // Refresh subscription status after successful payment
      if (userEmail) {
        getSubscriptionStatus(userEmail)
          .then(status => {
            setSubscriptionStatus(status);
            // Notify parent component
            if (onSubscriptionStatusChange) {
              onSubscriptionStatusChange(userEmail, status);
            }

            // Auto-add second leg if subscription is now active and only 1 leg exists
            if (status?.hasActiveSubscription) {
              setCities(prevCities => {
                if (prevCities.length === 1) {
                  const lastCity = prevCities[0];
                  return [...prevCities, {
                    origin: lastCity.destination || '',
                    destination: '',
                    departure_date: ''
                  }];
                }
                return prevCities;
              });
            }
          })
          .catch(err => console.error('Failed to refresh subscription:', err));
      }
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [userEmail]);

  // Persist form state to localStorage
  useEffect(() => {
    const formState = {
      cities,
      returnDate,
      budget,
      passengers
    };
    localStorage.setItem(FORM_STATE_KEY, JSON.stringify(formState));
  }, [cities, returnDate, budget, passengers]);

  // Multi-city helper functions
  const addCity = () => {
    if (cities.length >= MAX_LEGS) return; // Max legs guard

    // Check if user has subscription for multi-city trips (2+ legs)
    if (cities.length >= 1) {
      if (!subscriptionStatus?.hasActiveSubscription) {
        setShowSubscriptionModal(true);
        return;
      }
    }

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
    // Simple round trip (1 leg with return date)
    if (cities.length === 1) {
      const origin = cities[0].origin.trim();
      const destination = cities[0].destination.trim();
      const departureDate = cities[0].departure_date;

      if (!origin || !destination || !departureDate || !returnDate) {
        setError('Please fill in all required fields');
        return false;
      }

      return true;
    }

    // Multi-city trip (2+ legs)
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
    if (onWorkflowReset) {
      onWorkflowReset();
    }
    onFlightsFound([]);
    onHotelsFound([]);

    try {
      if (!validateRoundTrip()) {
        setLoading(false);
        return;
      }

      // Build trip legs based on trip type
      let trip_legs;
      if (cities.length === 1) {
        // Simple round trip: create 2 legs (outbound + return)
        trip_legs = [
          {
            origin: cities[0].origin,
            destination: cities[0].destination,
            departure_date: cities[0].departure_date,
            leg_number: 1
          },
          {
            origin: cities[0].destination,
            destination: cities[0].origin,
            departure_date: returnDate,
            leg_number: 2
          }
        ];
      } else {
        // Multi-city trip: use all legs as-is
        trip_legs = cities.map((leg, index) => ({
          origin: leg.origin,
          destination: leg.destination,
          departure_date: leg.departure_date,
          leg_number: index + 1
        }));
      }

      const result = await planTrip({
        trip_legs,
        budget: parseFloat(budget),
        passengers: parseInt(passengers),
        trip_type: 'multi_city',
        user_email: userEmail
      }, { onWorkflowStep });

      if (result.success) {
        onTripPlanned(
          result.final_response || result.plan,
          { tripType: 'multi', cities, budget, passengers },
          result.workflow_steps
        );

        try {
          // Search flights for each leg and hotels for each destination city
          let flightLegs, hotelCities;

          if (cities.length === 1) {
            // Simple round trip
            flightLegs = [
              { origin: cities[0].origin, destination: cities[0].destination, departure_date: cities[0].departure_date },
              { origin: cities[0].destination, destination: cities[0].origin, departure_date: returnDate }
            ];
            hotelCities = [{
              city: cities[0].destination,
              checkin_date: cities[0].departure_date,
              checkout_date: returnDate
            }];
          } else {
            // Multi-city trip
            flightLegs = cities;
            hotelCities = cities.slice(0, -1).map((leg, i) => ({
              city: leg.destination,
              checkin_date: leg.departure_date,
              checkout_date: cities[i + 1].departure_date
            }));
          }

          const [flightResults, hotelResults] = await Promise.all([
            searchMultiLegFlights({ legs: flightLegs }),
            searchMultiCityHotels({ cities: hotelCities })
          ]);

          onFlightsFound(flightResults || {});
          onHotelsFound(hotelResults || {});

          // Clear saved form state after successful trip planning
          localStorage.removeItem(FORM_STATE_KEY);
        } catch (searchErr) {
          console.error('Error fetching booking options:', searchErr);
          setError('Trip planned, but we could not load bookable flights or hotels. Please try again.');
        }
      } else {
        setError(result.error || 'Failed to plan trip. Please try again.');
      }
    } catch (err) {
      console.error('Error planning trip:', err);

      // Check if error is subscription-related
      if (err.response?.status === 403 || err.detail?.includes('subscription')) {
        setShowSubscriptionModal(true);
        setError('Multi-city trips require a premium subscription.');
      } else {
        setError(err.detail || err.message || 'An error occurred while planning your trip.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="trip-planner card">
      <h2>Plan Your Trip</h2>

      <form onSubmit={handleSubmit}>
        <div className="multi-city-legs">
          {cities.map((leg, index) => (
            <div key={index} className="city-leg">
              {/* Only show leg header for multi-city trips (2+ legs) */}
              {cities.length > 1 && (
                <div className="leg-header">
                  <h4>Leg {index + 1}</h4>
                  <button
                    type="button"
                    onClick={() => removeCity(index)}
                    className="btn-remove"
                  >
                    Remove
                  </button>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>From</label>
                  <input
                    type="text"
                    value={leg.origin}
                    onChange={(e) => updateCity(index, 'origin', e.target.value)}
                    placeholder={index === 0 ? 'e.g., New York' : 'Previous destination'}
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
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Departure Date</label>
                  <input
                    type="date"
                    value={leg.departure_date}
                    onChange={(e) => updateCity(index, 'departure_date', e.target.value)}
                    required
                  />
                </div>

                {/* Show return date only for the first leg when it's a simple round trip */}
                {index === 0 && cities.length === 1 && (
                  <div className="form-group">
                    <label>Return Date</label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addCity}
          className="btn-add-city premium"
          disabled={cities.length >= MAX_LEGS}
        >
          + Add Another City 👑
        </button>

        <div className="form-row" style={{ display: 'none' }}>
          <div className="form-group">
            <label htmlFor="user-email">Email</label>
            <input
              type="email"
              id="user-email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="your@email.com"
            />
            {subscriptionStatus?.hasActiveSubscription && (
              <span className="subscription-badge">Premium ✓</span>
            )}
          </div>
        </div>

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

      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        userEmail={userEmail}
        onSubscriptionChange={() => {
          // Refresh subscription status
          if (userEmail) {
            getSubscriptionStatus(userEmail)
              .then(status => setSubscriptionStatus(status))
              .catch(err => console.error('Failed to refresh subscription:', err));
          }
        }}
      />

      {showSuccessModal && userEmail && (
        <SubscriptionSuccess
          userEmail={userEmail}
          onClose={() => setShowSuccessModal(false)}
        />
      )}
    </div>
  );
}

export default TripPlanner;
