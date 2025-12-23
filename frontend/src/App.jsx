import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import TripPlanner from './components/TripPlanner';
import FlightsList from './components/FlightsList';
import HotelsList from './components/HotelsList';
import BookingSummary from './components/BookingSummary';
import './App.css';

function App() {
  const [flights, setFlights] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [tripPlan, setTripPlan] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [tripDetails, setTripDetails] = useState(null);
  const [showToolDetails, setShowToolDetails] = useState(false);
  const [isWorkflowExpanded, setIsWorkflowExpanded] = useState(false);
  const [recommendedFlightId, setRecommendedFlightId] = useState(null);
  const [recommendedHotelId, setRecommendedHotelId] = useState(null);

  const handleTripPlanned = (plan, details, steps) => {
    setTripPlan(plan);
    setTripDetails(details);
    setWorkflowSteps(steps || []);
  };

  const handleFlightsFound = (foundFlights) => {
    setFlights(foundFlights);
    if (foundFlights && foundFlights.length > 0) {
      const bestFlight = [...foundFlights].sort((a, b) => a.price - b.price)[0];
      setRecommendedFlightId(bestFlight.id);
    } else {
      setRecommendedFlightId(null);
    }
  };

  const handleHotelsFound = (foundHotels) => {
    setHotels(foundHotels);
    if (foundHotels && foundHotels.length > 0) {
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
  };

  const handleFlightSelected = (flight) => {
    setSelectedFlight(flight);
  };

  const handleHotelSelected = (hotel) => {
    setSelectedHotel(hotel);
  };

  const handleBookingComplete = () => {
    // Reset the app after booking
    setFlights([]);
    setHotels([]);
    setTripPlan(null);
    setWorkflowSteps([]);
    setSelectedFlight(null);
    setSelectedHotel(null);
    setTripDetails(null);
    setRecommendedFlightId(null);
    setRecommendedHotelId(null);
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
      </header>

      <main className="app-main">
        <div className="container">
          <TripPlanner
            onTripPlanned={handleTripPlanned}
            onFlightsFound={handleFlightsFound}
            onHotelsFound={handleHotelsFound}
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
                  {workflowSteps.map((step, index) => (
                    <div key={index} className={`workflow-step ${step.type}`}>
                      {step.message}
                      {showToolDetails && step.type === 'tool_call' && (
                        <pre className="tool-call-details">
                          {JSON.stringify(step, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
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
        </div>
      </main>

      <footer className="app-footer">
        <p>Powered by OpenAI Agents SDK</p>
      </footer>
    </div>
  );
}

export default App;
