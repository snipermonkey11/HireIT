import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from './services/api';
import { toast } from 'react-toastify';

// Helper function to format image URL properly
const formatImageUrl = (imageData) => {
  if (!imageData) return null;
  if (typeof imageData !== 'string') return null;
  
  // If it's already a complete data URL
  if (imageData.startsWith('data:image')) {
    return imageData;
  }
  
  // If it's a base64 string without the prefix
  if (imageData.startsWith('/9j/') || imageData.match(/^[A-Za-z0-9+/=]+$/)) {
    return `data:image/jpeg;base64,${imageData}`;
  }
  
  // If it's a URL
  if (imageData.startsWith('http')) {
    return imageData;
  }
  
  // Default case, assume it's base64
  return `data:image/jpeg;base64,${imageData}`;
};

// Function to add notification to localStorage
const addNotification = (message, type, timestamp, userId) => {
  const newNotification = { message, type, timestamp };
  const notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  notifications.push({ ...newNotification, userId });
  localStorage.setItem("notifications", JSON.stringify(notifications));
};

const ReceivedPaymentPage = () => {
  const { applicationId } = useParams();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPaymentDetails();
  }, [applicationId]);

  const fetchPaymentDetails = async () => {
    try {
      setLoading(true);
      const userData = JSON.parse(localStorage.getItem('userData'));
      if (!userData?.token) {
        throw new Error('No authentication token found');
      }

      const response = await api.get(`/received-payments/${applicationId}`, {
        headers: {
          'Authorization': `Bearer ${userData.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Validate response data
      if (!response.data || Object.keys(response.data).length === 0) {
        throw new Error('No payment data returned from server');
      }
      
      setPayment(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load payment details');
      toast.error(err.response?.data?.error || 'Failed to load payment details');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    try {
      setLoading(true);
      const userData = JSON.parse(localStorage.getItem('userData'));
      if (!userData?.token) {
        throw new Error('No authentication token found');
      }

      await api.patch(`/received-payments/${applicationId}/confirm`, {}, {
        headers: {
          'Authorization': `Bearer ${userData.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Refresh payment details
      await fetchPaymentDetails();
      
      toast.success('Payment confirmed successfully!');
      
      // Add notifications for both parties
      if (payment) {
        // Notification for the client (who sent the payment)
        addNotification(
          `Your payment for "${payment.ServiceTitle}" has been confirmed by the service provider.`,
          'PAYMENT_CONFIRMED',
          new Date().toISOString(),
          payment.ServiceOwnerId  // This is actually the client who paid
        );
        
        // Notification for the freelancer (who received the payment)
        addNotification(
          `You have confirmed payment for "${payment.ServiceTitle}".`,
          'PAYMENT_CONFIRMED',
          new Date().toISOString(),
          payment.ApplicantId || payment.ClientId  // This is the service provider/freelancer
        );
      }

    } catch (err) {
      toast.error('Failed to confirm payment');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg">
          <div className="text-maroon-600 text-xl font-semibold mb-2">Error</div>
          <p className="text-maroon-800">{error}</p>
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg">
          <div className="text-maroon-800 text-xl font-semibold mb-2">Not Found</div>
          <p className="text-maroon-600">Payment details not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="container mx-auto space-y-8">
        <h2 className="text-2xl font-semibold text-gray-800">Received Payment</h2>

        {/* Service Details Section */}
        <div className="p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-500 transform hover:scale-105">
          <h3 className="text-xl font-semibold text-gray-800">{payment.ServiceTitle}</h3>
          {payment.ServiceImage && (
            <div className="mt-4 relative">
              <img
                src={formatImageUrl(payment.ServiceImage)}
                alt={payment.ServiceTitle}
                className="w-full h-64 object-cover rounded-lg"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/default-service.png';
                }}
              />
            </div>
          )}
          <div className="mt-4 space-y-2">
            <p className="text-gray-600">Category: {payment.ServiceCategory}</p>
            <p className="text-gray-600">Description: {payment.ServiceDescription}</p>
            <p className="text-gray-600">Payment From: {payment.ServiceOwnerName}</p>
            <p className="text-lg font-semibold text-gray-800">Amount: ₱{payment.Amount?.toLocaleString()}</p>
          </div>
        </div>

        {/* Payment Details Section */}
        <div className="p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-500">
          <h4 className="text-xl font-semibold text-gray-800">Payment Details</h4>
          <div className="mt-4 space-y-2">
            <p className="text-gray-600">Payment Status: {payment.PaymentStatus}</p>
            <p className="text-gray-600">Payment Method: {payment.PaymentMethod || 'Not specified'}</p>
            {payment.PaymentMethod === 'GCash' && payment.ReferenceNumber && (
              <p className="text-gray-600">Reference Number: {payment.ReferenceNumber}</p>
            )}
            {payment.PaymentDate && (
              <p className="text-gray-600">
                Payment Date: {new Date(payment.PaymentDate).toLocaleString()}
              </p>
            )}
          </div>

          {/* Confirm Payment Button - Show for both Pending and Sent status */}
          {(payment.PaymentStatus === 'Sent' || payment.PaymentStatus === 'Pending') && payment.ApplicationStatus !== 'Completed' && (
            <button
              onClick={handleConfirmPayment}
              className="mt-6 w-full py-3 bg-maroon-600 text-white rounded-lg hover:bg-maroon-700 transition-colors duration-300 flex items-center justify-center space-x-2"
            >
              <span>{payment.PaymentStatus === 'Sent' ? 'Confirm Payment Receipt' : 'Mark Payment as Received'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          )}

          {/* Completed Message */}
          {payment.PaymentStatus === 'Completed' && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-semibold text-center">
                Payment has been confirmed and the transaction is complete!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceivedPaymentPage;
  