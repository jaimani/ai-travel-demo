import React from 'react';
import { createPortalSession } from '../utils/api';
import './SubscriptionSuccess.css';

function SubscriptionSuccess({ userEmail, onClose }) {
  const handleManageBilling = async () => {
    try {
      const { url } = await createPortalSession(userEmail);
      window.location.href = url;
    } catch (error) {
      console.error('Failed to open billing portal:', error);
      alert('Failed to open billing portal. Please try again.');
    }
  };

  return (
    <div className="subscription-success-overlay">
      <div className="subscription-success-card">
        <div className="success-icon">✓</div>
        <h2>Subscription to Premium Plan Successful!</h2>
        <p className="success-message">
          Welcome to Premium! You can now plan multi-city trips with up to 4 legs and 5 cities.
        </p>

        <div className="success-features">
          <h3>What's included:</h3>
          <ul>
            <li>✓ Multi-city trip planning (up to 4 legs)</li>
            <li>✓ AI-powered route optimization</li>
            <li>✓ Priority customer support</li>
            <li>✓ Advanced booking options</li>
          </ul>
        </div>

        <div className="success-actions">
          <button
            className="btn-manage-billing"
            onClick={handleManageBilling}
          >
            Manage your billing information
          </button>
          <button
            className="btn-continue"
            onClick={onClose}
          >
            Start Planning Your Trip
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionSuccess;
