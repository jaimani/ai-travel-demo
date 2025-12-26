import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import TripPlanner from './components/TripPlanner';
import FlightsList from './components/FlightsList';
import HotelsList from './components/HotelsList';
import BookingSummary from './components/BookingSummary';
import MultiCityFlightsList from './components/MultiCityFlightsList';
import MultiCityHotelsList from './components/MultiCityHotelsList';
import MultiCityBookingSummary from './components/MultiCityBookingSummary';
import { createPortalSession } from './utils/api';
import './App.css';

function App() {
  // User subscription state
  const [userEmail, setUserEmail] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);

  // Trip type state
  const [tripType, setTripType] = useState('multi');

  // Single-city state
  const [flights, setFlights] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState(null);

  // Multi-city state
  const [multiCityFlights, setMultiCityFlights] = useState({});
  const [multiCityHotels, setMultiCityHotels] = useState({});
  const [selectedFlightsPerLeg, setSelectedFlightsPerLeg] = useState({});
  const [selectedHotelsPerCity, setSelectedHotelsPerCity] = useState({});

  // Shared state
  const [tripPlan, setTripPlan] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [tripDetails, setTripDetails] = useState(null);
  const [showToolDetails, setShowToolDetails] = useState(false);
  const [isWorkflowExpanded, setIsWorkflowExpanded] = useState(false);
  const [recommendedFlightId, setRecommendedFlightId] = useState(null);
  const [recommendedHotelId, setRecommendedHotelId] = useState(null);

  const handleWorkflowReset = () => {
    setWorkflowSteps([]);
    setIsWorkflowExpanded(true);
  };

  const handleWorkflowStep = (step) => {
    setWorkflowSteps(prev => [...prev, step]);
  };

  const handleTripPlanned = (plan, details, steps) => {
    setTripPlan(plan);
    setTripDetails(details);
    setTripType(details.tripType || 'multi');
    setWorkflowSteps(steps || []);
  };

  const handleFlightsFound = (foundFlights) => {
    if (Array.isArray(foundFlights)) {
      // Single-city flights (array)
      setFlights(foundFlights);
      if (foundFlights.length > 0) {
        const bestFlight = [...foundFlights].sort((a, b) => a.price - b.price)[0];
        setRecommendedFlightId(bestFlight.id);
      } else {
        setRecommendedFlightId(null);
      }
    } else {
      // Multi-city flights (object)
      setMultiCityFlights(foundFlights);
    }
  };

  const handleHotelsFound = (foundHotels) => {
    if (Array.isArray(foundHotels)) {
      // Single-city hotels (array)
      setHotels(foundHotels);
      if (foundHotels.length > 0) {
        const bestHotel = [...foundHotels].sort((a, b) => {
          if (b.rating === a.rating) {
            return a.price_per_night - b.price_per_night;
          }
          return b.rating - a.rating;
        })[0];
        setRecommendedHotelId(bestHotel.id);
      } else {
        setRecommendedHotelId(null);
      }
    } else {
      // Multi-city hotels (object)
      setMultiCityHotels(foundHotels);
    }
  };

  const handleFlightSelected = (flightOrLegKey, flight) => {
    if (tripType === 'single') {
      setSelectedFlight(flightOrLegKey); // flightOrLegKey is the flight object
    } else {
      // Multi-city: flightOrLegKey is legKey, flight is flight object
      setSelectedFlightsPerLeg(prev => ({
        ...prev,
        [flightOrLegKey]: flight
      }));
    }
  };

  const handleHotelSelected = (hotelOrCity, hotel) => {
    if (tripType === 'single') {
      setSelectedHotel(hotelOrCity); // hotelOrCity is the hotel object
    } else {
      // Multi-city: hotelOrCity is city name, hotel is hotel object
      setSelectedHotelsPerCity(prev => ({
        ...prev,
        [hotelOrCity]: hotel
      }));
    }
  };

  const handleBookingComplete = () => {
    // Reset the app after booking
    setFlights([]);
    setHotels([]);
    setMultiCityFlights({});
    setMultiCityHotels({});
    setTripPlan(null);
    setWorkflowSteps([]);
    setSelectedFlight(null);
    setSelectedHotel(null);
    setSelectedFlightsPerLeg({});
    setSelectedHotelsPerCity({});
    setTripDetails(null);
    setRecommendedFlightId(null);
    setRecommendedHotelId(null);
    setTripType('multi');
  };

  const handleSubscriptionStatusChange = useCallback((email, status) => {
    setUserEmail(email);
    setSubscriptionStatus(status);
  }, []);

  const handleManageSubscription = async () => {
    if (!userEmail) return;

    try {
      const { url } = await createPortalSession(userEmail);
      window.location.href = url;
    } catch (error) {
      console.error('Failed to open billing portal:', error);
      alert('Failed to open billing portal. Please try again.');
    }
  };

  // Helper to check if all multi-city selections are complete
  const isMultiCityComplete = () => {
    if (tripType !== 'multi' || !tripDetails || !tripDetails.cities) return false;

    const numLegs = tripDetails.cities.length;
    const numHotels = tripDetails.cities.length - 1; // Excluding origin

    return (
      Object.keys(selectedFlightsPerLeg).length === numLegs &&
      Object.keys(selectedHotelsPerCity).length === numHotels
    );
  };

  const recommendedFlight = flights.find((flight) => flight.id === recommendedFlightId);
  const recommendedHotel = hotels.find((hotel) => hotel.id === recommendedHotelId);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">Llama Inc. Travel</h1>
          <p className="app-subtitle">AI-Powered Trip Planning</p>
        </div>
        {subscriptionStatus?.hasActiveSubscription && (
          <button
            className="manage-subscription-btn"
            onClick={handleManageSubscription}
            title="Manage your subscription"
          >
            <span className="premium-badge">👑</span>
            Manage Subscription
          </button>
        )}
      </header>

      <main className="app-main">
        <div className="container">
          <TripPlanner
            onTripPlanned={handleTripPlanned}
            onFlightsFound={handleFlightsFound}
            onHotelsFound={handleHotelsFound}
            onWorkflowReset={handleWorkflowReset}
            onWorkflowStep={handleWorkflowStep}
            onSubscriptionStatusChange={handleSubscriptionStatusChange}
          />

          {workflowSteps.length > 0 && (
            <div className={`workflow-section card ${isWorkflowExpanded ? 'expanded' : 'collapsed'}`}>
              <div className="workflow-header">
                <h2>Agent Workflow</h2>
                <div className="workflow-controls">
                  <button
                    type="button"
                    className="workflow-toggle"
                    onClick={() => setIsWorkflowExpanded(prev => !prev)}
                    aria-expanded={isWorkflowExpanded}
                  >
                    {isWorkflowExpanded ? 'Hide workflow' : 'Show workflow'}
                  </button>
                  <label className={`tool-details-toggle ${!isWorkflowExpanded ? 'disabled' : ''}`}>
                    <input
                      type="checkbox"
                      checked={showToolDetails && isWorkflowExpanded}
                      onChange={(e) => setShowToolDetails(e.target.checked)}
                      disabled={!isWorkflowExpanded}
                    />
                    Show tool call details
                  </label>
                </div>
              </div>
              {isWorkflowExpanded && (
                <div className="workflow-steps">
                  {workflowSteps.map((step, index) => {
                    // Determine duration class for visual indicator
                    let durationClass = '';
                    if (step.duration) {
                      if (step.duration > 5) {
                        durationClass = 'very-slow';
                      } else if (step.duration > 2) {
                        durationClass = 'slow';
                      }
                    }

                    return (
                    <div key={index} className={`workflow-step ${step.type}`}>
                      {step.message}
                      {step.duration && (
                        <span className={`workflow-step-duration ${durationClass}`}>
                          {step.duration.toFixed(2)}s
                        </span>
                      )}

                      {/* Show agent response when completed */}
                      {showToolDetails && step.type === 'agent_end' && step.response && (
                        <div className="tool-call-details">
                          <strong>Agent Response:</strong>
                          <pre style={{ whiteSpace: 'pre-wrap', marginTop: '8px' }}>
                            {step.response}
                          </pre>
                        </div>
                      )}

                      {/* Show handoff context */}
                      {showToolDetails && step.type === 'handoff' && step.context && (
                        <div className="tool-call-details">
                          <strong>Handoff Context:</strong>
                          <pre style={{ whiteSpace: 'pre-wrap', marginTop: '8px' }}>
                            {step.context}
                          </pre>
                        </div>
                      )}

                      {/* Show LLM prompt */}
                      {showToolDetails && step.type === 'llm_call' && step.prompt && step.prompt.length > 0 && (
                        <div className="tool-call-details">
                          <strong>LLM Prompt (last {step.prompt.length} messages):</strong>
                          <pre style={{ whiteSpace: 'pre-wrap', marginTop: '8px' }}>
                            {JSON.stringify(step.prompt, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Show tool input */}
                      {showToolDetails && step.type === 'tool_call' && step.tool_input && (
                        <div className="tool-call-details">
                          <strong>Tool Input:</strong>
                          <pre style={{ whiteSpace: 'pre-wrap', marginTop: '8px' }}>
                            {JSON.stringify(step.tool_input, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tripPlan && (
            <div className="ai-plan-section card">
              <h2>AI Travel Recommendations</h2>
              <div className="ai-plan-content">
                <ReactMarkdown>{tripPlan}</ReactMarkdown>
              </div>
            </div>
          )}

          {recommendedFlight && recommendedHotel && (
            <div className="recommendation card">
              <h2>Highlighted Picks</h2>
              <div className="recommendation-content">
                <div className="recommendation-item">
                  <span className="recommendation-label">Flight</span>
                  <strong>{recommendedFlight.airline}</strong>
                  <p>
                    {recommendedFlight.origin} → {recommendedFlight.destination} · $
                    {recommendedFlight.price.toFixed(2)}
                  </p>
                </div>
                <div className="recommendation-item">
                  <span className="recommendation-label">Hotel</span>
                  <strong>{recommendedHotel.name}</strong>
                  <p>
                    {recommendedHotel.city} · {recommendedHotel.rating.toFixed(1)} ★ · $
                    {recommendedHotel.price_per_night.toFixed(2)}/night
                  </p>
                </div>
              </div>
              <p className="recommendation-note">These options are marked as &ldquo;AI Recommended&rdquo; in the lists below.</p>
            </div>
          )}

          {tripType === 'single' ? (
            <>
              {flights.length > 0 && (
                <FlightsList
                  flights={flights}
                  onFlightSelected={handleFlightSelected}
                  selectedFlight={selectedFlight}
                  recommendedFlightId={recommendedFlightId}
                />
              )}

              {hotels.length > 0 && (
                <HotelsList
                  hotels={hotels}
                  onHotelSelected={handleHotelSelected}
                  selectedHotel={selectedHotel}
                  recommendedHotelId={recommendedHotelId}
                />
              )}

              {selectedFlight && selectedHotel && tripDetails && (
                <BookingSummary
                  flight={selectedFlight}
                  hotel={selectedHotel}
                  tripDetails={tripDetails}
                  onBookingComplete={handleBookingComplete}
                />
              )}
            </>
          ) : (
            <>
              {Object.keys(multiCityFlights).length > 0 && (
                <MultiCityFlightsList
                  flightsByLeg={multiCityFlights}
                  onFlightSelected={handleFlightSelected}
                  selectedFlights={selectedFlightsPerLeg}
                />
              )}

              {Object.keys(multiCityHotels).length > 0 && (
                <MultiCityHotelsList
                  hotelsByCity={multiCityHotels}
                  onHotelSelected={handleHotelSelected}
                  selectedHotels={selectedHotelsPerCity}
                />
              )}

              {isMultiCityComplete() && tripDetails && (
                <MultiCityBookingSummary
                  selectedFlights={selectedFlightsPerLeg}
                  selectedHotels={selectedHotelsPerCity}
                  tripDetails={tripDetails}
                  onBookingComplete={handleBookingComplete}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
