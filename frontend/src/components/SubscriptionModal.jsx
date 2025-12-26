import React, { useState } from 'react';
import { createCheckoutSession, createPortalSession, getSubscriptionStatus } from '../utils/api';
import '../styles/SubscriptionModal.css';

const SubscriptionModal = ({ isOpen, onClose, userEmail, onSubscriptionChange }) => {
  const [email, setEmail] = useState(userEmail || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCheckout = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await createCheckoutSession(email);
      // Redirect to Stripe Checkout
      if (response.url) {
        // Store email in localStorage before redirecting
        localStorage.setItem('userEmail', email);
        window.location.href = response.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.response?.data?.detail || 'Failed to create checkout session');
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await createPortalSession(email);
      if (response.url) {
        window.location.href = response.url;
      }
    } catch (err) {
      console.error('Portal error:', err);
      setError(err.response?.data?.detail || 'Failed to open billing portal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="subscription-modal">
          <div className="premium-logo">👑</div>
          <h2>Upgrade to Premium</h2>
          <p className="subtitle">Unlock multi-city trip planning</p>

          <div className="feature-list">
            <div className="feature-item">
              <span className="feature-icon">✈️</span>
              <span>Plan complex multi-city itineraries</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🗺️</span>
              <span>Visit up to 5 cities in one trip</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🤖</span>
              <span>AI-powered route optimization</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💰</span>
              <span>Smart budget allocation across cities</span>
            </div>
          </div>

          <div className="pricing-card">
            <div className="price">
              <span className="currency">$</span>
              <span className="amount">9.99</span>
              <span className="period">/ month</span>
            </div>
            <p className="pricing-detail">Cancel anytime</p>
          </div>

          <div className="email-input-section">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="email-input"
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="action-buttons">
            <button
              className="checkout-button"
              onClick={handleCheckout}
              disabled={loading || !email}
            >
              {loading ? 'Processing...' : 'Subscribe Now'}
            </button>

            {userEmail && (
              <button
                className="portal-button"
                onClick={handleManageBilling}
                disabled={loading}
              >
                Manage Billing
              </button>
            )}
          </div>

          <p className="terms">
            By subscribing, you agree to our Terms of Service and Privacy Policy.
            Your subscription will automatically renew monthly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;
