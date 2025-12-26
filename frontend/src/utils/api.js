import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 2 minute timeout for AI agent processing
});

// Helper to parse server-sent events formatted data chunks
const parseSSEBuffer = (buffer, callback) => {
  let workingBuffer = buffer;
  let delimiterIndex = workingBuffer.indexOf('\n\n');

  while (delimiterIndex !== -1) {
    const rawEvent = workingBuffer.slice(0, delimiterIndex).trim();
    workingBuffer = workingBuffer.slice(delimiterIndex + 2);

    if (rawEvent.length > 0) {
      const lines = rawEvent.split('\n');
      let eventType = 'message';
      let dataPayload = '';

      lines.forEach((line) => {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataPayload += line.slice(5).trim();
        }
      });

      if (dataPayload) {
        try {
          const parsed = JSON.parse(dataPayload);
          callback(eventType, parsed);
        } catch (err) {
          console.error('Failed to parse SSE payload', err);
        }
      }
    }

    delimiterIndex = workingBuffer.indexOf('\n\n');
  }

  return workingBuffer;
};

// Plan a trip using AI agents with live workflow streaming
export const planTrip = async (tripData, { onWorkflowStep } = {}) => {
  const useLegacyEndpoint = async () => {
    const fallback = await api.post('/planner/plan_trip', tripData);
    return fallback.data;
  };

  try {
    const response = await fetch(`${API_BASE_URL}/planner/plan_trip_stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tripData),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return useLegacyEndpoint();
      }
      throw new Error('Failed to plan trip');
    }

    if (!response.body) {
      return useLegacyEndpoint();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      buffer = parseSSEBuffer(buffer, (eventType, data) => {
        if (eventType === 'workflow_step') {
          onWorkflowStep?.(data);
        } else if (eventType === 'final_result') {
          finalResult = data;
        } else if (eventType === 'error') {
          throw new Error(data?.detail || data?.message || 'Trip planning failed');
        }
      });
    }

    if (!finalResult) {
      throw new Error('Trip planning failed to return a result.');
    }

    return finalResult;
  } catch (error) {
    try {
      return await useLegacyEndpoint();
    } catch (fallbackErr) {
      const message = error?.message || fallbackErr?.message || 'An unknown error occurred while planning the trip.';
      throw new Error(message);
    }
  }
};

// Search for flights
export const searchFlights = async (searchParams) => {
  try {
    const response = await api.post('/flights/search', searchParams);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get a specific flight
export const getFlight = async (flightId) => {
  try {
    const response = await api.get(`/flights/${flightId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Search for hotels
export const searchHotels = async (searchParams) => {
  try {
    const response = await api.post('/hotels/search', searchParams);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get a specific hotel
export const getHotel = async (hotelId) => {
  try {
    const response = await api.get(`/hotels/${hotelId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Create a booking
export const createBooking = async (bookingData) => {
  try {
    const response = await api.post('/bookings', bookingData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get all bookings
export const getBookings = async () => {
  try {
    const response = await api.get('/bookings');
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get a specific booking
export const getBooking = async (bookingId) => {
  try {
    const response = await api.get(`/bookings/${bookingId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Multi-City API Functions

// Search flights for multiple legs
export const searchMultiLegFlights = async (searchParams) => {
  try {
    const response = await api.post('/flights/search_multi', searchParams);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Search hotels for multiple cities
export const searchMultiCityHotels = async (searchParams) => {
  try {
    const response = await api.post('/hotels/search_multi', searchParams);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Create multi-city booking
export const createMultiCityBooking = async (bookingData) => {
  try {
    const response = await api.post('/bookings/multi_city', bookingData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Stripe Subscription Functions

// Create Stripe checkout session
export const createCheckoutSession = async (email) => {
  try {
    const response = await api.post('/stripe/create-checkout-session', { email });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Create Stripe billing portal session
export const createPortalSession = async (email) => {
  try {
    const response = await api.post('/stripe/create-portal-session', { email });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get subscription status
export const getSubscriptionStatus = async (email) => {
  try {
    const response = await api.get(`/stripe/subscription-status/${email}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export default api;
