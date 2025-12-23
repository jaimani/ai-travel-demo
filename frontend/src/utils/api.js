import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Plan a trip using AI agents
export const planTrip = async (tripData) => {
  try {
    const response = await api.post('/planner/plan_trip', tripData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
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

export default api;
