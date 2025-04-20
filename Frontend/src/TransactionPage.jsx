import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from './services/api';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import gcashLogo from './assets/gcash.png';

// Function to add notification
const addNotification = (message, type, timestamp, userId) => {
  const newNotification = {
    message,
    type,
    timestamp,
    read: false,
    userId,
    details: type === 'PAYMENT_SENT' 
      ? 'Your payment has been recorded and is being processed'
      : 'You have received a new payment for your service',
    actionLink: '/transaction-history'
  };
  
  const notifications = JSON.parse(localStorage.getItem("notifications")) || [];
  notifications.unshift(newNotification); // Add to the beginning of the array
  
  // Keep only the latest 50 notifications
  if (notifications.length > 50) {
    notifications.pop();
  }
  
  localStorage.setItem("notifications", JSON.stringify(notifications));
  
  // Update the notification count in the header
  const event = new CustomEvent('notificationUpdate', {
    detail: { hasNew: true }
  });
  window.dispatchEvent(event);
};

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

const TransactionPage = () => {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [gcashReference, setGcashReference] = useState('');
  const [showGCashQR, setShowGCashQR] = useState(false);
  const [isPaymentSent, setIsPaymentSent] = useState(false);
  const [qrCodeImage, setQrCodeImage] = useState(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchTransactionDetails();
  }, [applicationId]);

  const fetchTransactionDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const response = await api.get(`/transactions/${applicationId}`);
      
      if (response.data) {
        console.log('Transaction details:', response.data);
        
        // Ensure we have a clean/consistent transaction object
        const cleanedTransaction = {
          ...response.data,
          // Make sure user is only seen as a client on this page
          isClient: true
        };
        
        setTransaction(cleanedTransaction);
        
        // Check freelancer's GCash QR code
        if (response.data.FreelancerGcashQR) {
          console.log('Found freelancer GCash QR code, processing...');
          const formattedQR = formatImageUrl(response.data.FreelancerGcashQR);
          console.log('Formatted QR code URL:', formattedQR ? 'Successfully formatted' : 'Failed to format');
          setQrCodeImage(formattedQR);
        } else {
          console.log('No freelancer GCash QR code found in transaction data');
          setQrCodeImage(null);
        }
        
        // Debug transaction data only
        console.log('User ID:', userData.userId);
        console.log('Transaction payer ID:', response.data.payer?.id);
        console.log('Transaction payee ID:', response.data.payee?.id);
        console.log('Is client according to API:', response.data.isClient);
      }
    } catch (err) {
      console.error('Error fetching transaction details:', err);
      setError('Failed to load transaction details. Please try again later.');
      toast.error('Failed to load transaction details');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentMethod = (method) => {
    setPaymentMethod(method);
    setShowGCashQR(method === 'GCash');
  };

  const handleGcashReferenceChange = (e) => {
    setGcashReference(e.target.value);
  };

  const generateReceipt = () => {
    if (!transaction) return;

    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(128, 0, 0);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 223, 0);
    doc.setFontSize(24);
    doc.text('HireIT Payment Receipt', 105, 20, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    
    const startY = 40;
    const lineHeight = 10;
    
    // Service details
    doc.setFont('helvetica', 'bold');
    doc.text('Service Details', 20, startY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Service: ${transaction.ServiceTitle}`, 20, startY + lineHeight * 2);
    doc.text(`Category: ${transaction.ServiceCategory}`, 20, startY + lineHeight * 3);
    
    // Payment details
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Information', 20, startY + lineHeight * 5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Transaction ID: ${transaction.TransactionId}`, 20, startY + lineHeight * 6);
    doc.text(`Amount Paid: ₱${transaction.Amount?.toLocaleString()}`, 20, startY + lineHeight * 7);
    doc.text(`Payment Method: ${paymentMethod}`, 20, startY + lineHeight * 8);
    doc.text(`Date: ${new Date().toLocaleString()}`, 20, startY + lineHeight * 9);
    
    if (paymentMethod === 'GCash') {
      doc.text(`GCash Reference: ${gcashReference}`, 20, startY + lineHeight * 10);
    }
    
    // Footer
    doc.setFillColor(128, 0, 0);
    doc.rect(0, 262, 210, 30, 'F');
    doc.setTextColor(255, 223, 0);
    doc.setFontSize(10);
    doc.text('Thank you for choosing HireIT!', 105, 275, { align: 'center' });
    
    doc.save(`HireIT_Receipt_${transaction.TransactionId}.pdf`);
  };

  const handlePaymentSent = async () => {
    try {
      setSubmitting(true);
      
      // Get userData from localStorage
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      
      if (!paymentMethod) {
        toast.error('Please select a payment method');
        setSubmitting(false);
        return;
      }

      // For GCash, check if reference is provided
      if (paymentMethod === 'GCash' && !gcashReference) {
        toast.error('Please enter your GCash reference number');
        setSubmitting(false);
        return;
      }
      
      await api.patch(`/transactions/${applicationId}/status`, {
        status: 'Sent',
        paymentMethod,
        referenceNumber: paymentMethod === 'GCash' ? gcashReference : 'Face to Face Payment'
      }, {
        headers: {
          'Authorization': `Bearer ${userData.token}`
        }
      });

      setIsPaymentSent(true);
      toast.success('Payment sent successfully!');
      generateReceipt();

      // Add notifications with correct roles
      const timestamp = new Date().toISOString();
      
      // For client (payer) who is making the payment
      addNotification(
        `Payment sent for service "${transaction.serviceTitle}"`,
        "PAYMENT_SENT",
        timestamp,
        transaction.payer.id // The client who sent payment
      );

      // For freelancer (payee) who receives payment
      addNotification(
        `New payment received for service "${transaction.serviceTitle}"`,
        "PAYMENT_RECEIVED",
        timestamp,
        transaction.payee.id // The freelancer who received payment
      );

      // Redirect to transaction history after successful payment
      setTimeout(() => {
        navigate('/transaction-history');
      }, 2000);

    } catch (err) {
      console.error('Error sending payment:', err);
      toast.error('Failed to send payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayment = async () => {
    if (!window.confirm('Are you sure you want to confirm this payment?')) {
      return;
    }

    try {
      setProcessing(true);
      await api.post(`/transactions/${transaction.transactionId}/pay`);
      
      toast.success('Payment processed successfully!');
      
      // Refresh transaction details
      await fetchTransactionDetails();
      
      // Short delay before redirecting
      setTimeout(() => {
        navigate('/project-status');
      }, 1500);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center">
        <div className="w-16 h-16 relative animate-spin">
          <div className="absolute top-0 left-0 right-0 bottom-0 rounded-full border-4 border-t-4 border-[#800000] border-t-[#ffd700] animate-pulse"></div>
          <div className="absolute top-2 left-2 right-2 bottom-2 rounded-full border-4 border-t-4 border-[#800000] border-opacity-60 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] p-6 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full transform hover:scale-105 transition-all duration-500">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#800000] rounded-full flex items-center justify-center animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <p className="text-lg text-[#800000] text-center font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] p-6 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full text-center">
          <p className="text-lg text-[#800000] font-semibold">No transaction found</p>
        </div>
      </div>
    );
  }

  // Get user data for rendering
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');

  return (
    <div className="min-h-screen bg-[#f8f5f0] p-6">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="bg-[#800000] text-white p-8 rounded-t-2xl shadow-xl">
          <h2 className="text-3xl font-bold tracking-wider flex items-center">
            <span className="text-[#ffd700] mr-2">|</span> 
            Transaction Details
            <span className="ml-2 text-[#ffd700]">|</span>
          </h2>
          <p className="text-gray-200 mt-2 opacity-80">
            {transaction.postType === 'client' ? 'Project Payment Details' : 'Service Payment Details'}
          </p>
        </div>

        {/* Transaction Card */}
        <div className="bg-white rounded-b-2xl shadow-xl p-8">
          {/* Client Indicator */}
          <div className="mb-6 p-4 bg-[#800000] bg-opacity-10 rounded-lg border border-[#800000] border-opacity-20">
            <p className="font-semibold text-[#800000]">You are the client making the payment</p>
          </div>
          
          {/* Service Details */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <h3 className="text-2xl font-bold text-[#800000] mb-4">{transaction.serviceTitle}</h3>
            <div className="flex items-center justify-between">
              <div className="text-gray-600">
                <p className="mb-2">
                  <span className="font-semibold">Amount:</span> ₱{transaction.amount}
                </p>
                <p className="mb-2">
                  <span className="font-semibold">Status:</span>{' '}
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    transaction.status === 'Pending' ? 'bg-yellow-400 text-yellow-900' :
                    transaction.status === 'Completed' ? 'bg-green-500 text-white' :
                    'bg-gray-500 text-white'
                  }`}>
                    {transaction.status}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Service Type:</span>{' '}
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    transaction.postType === 'client' ? 'bg-[#800000] bg-opacity-80' : 'bg-[#800000]'
                  } text-white`}>
                    {transaction.postType === 'client' ? 'Client Request' : 'Freelancer Service'}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="mb-8">
            <h4 className="text-xl font-bold text-[#800000] mb-4">Payment Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Payer Details */}
              <div className="bg-[#f8f5f0] p-6 rounded-xl">
                <h5 className="font-semibold text-[#800000] mb-3">Payer Details (Client)</h5>
                <p className="text-gray-700 mb-2">Name: {transaction.payer.name}</p>
                <p className="text-gray-700">Email: {transaction.payer.email}</p>
              </div>

              {/* Payee Details */}
              <div className="bg-[#f8f5f0] p-6 rounded-xl">
                <h5 className="font-semibold text-[#800000] mb-3">Payee Details (Freelancer)</h5>
                <p className="text-gray-700 mb-2">Name: {transaction.payee.name}</p>
                <p className="text-gray-700">Email: {transaction.payee.email}</p>
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          {transaction.status === 'Pending' && !isPaymentSent && (
            <div className="mb-8">
              <h4 className="text-xl font-bold text-[#800000] mb-4">Select Payment Method</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handlePaymentMethod('Face to Face')}
                  className={`p-4 rounded-xl flex items-center border-2 transition-all ${
                    paymentMethod === 'Face to Face' 
                      ? 'border-[#800000] bg-[#800000] bg-opacity-10' 
                      : 'border-gray-200 hover:border-[#800000] hover:bg-[#800000] hover:bg-opacity-5'
                  }`}
                >
                  <div className="w-10 h-10 bg-[#800000] rounded-full flex items-center justify-center mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-[#800000]">Face to Face</p>
                    <p className="text-sm text-gray-600">Meet with the freelancer in person</p>
                  </div>
                </button>
                
                <button
                  onClick={() => handlePaymentMethod('GCash')}
                  className={`p-4 rounded-xl flex items-center border-2 transition-all ${
                    paymentMethod === 'GCash' 
                      ? 'border-[#800000] bg-[#800000] bg-opacity-10' 
                      : 'border-gray-200 hover:border-[#800000] hover:bg-[#800000] hover:bg-opacity-5'
                  }`}
                >
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-[#800000]">GCash</p>
                    <p className="text-sm text-gray-600">Pay using GCash mobile wallet</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* GCash QR Code - Show when selected */}
          {paymentMethod === 'GCash' && (
            <div className="mb-8 bg-blue-50 p-6 rounded-xl border border-blue-200">
              <h4 className="text-xl font-bold text-blue-800 mb-4 flex items-center">
                <img src={gcashLogo} alt="GCash" className="h-6 mr-2" />
                GCash Payment
              </h4>
              
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="md:w-1/2 flex flex-col items-center">
                  <p className="text-blue-800 mb-4 text-center font-semibold">Scan the QR code below to pay the freelancer directly</p>
                  <div className="bg-white p-4 rounded-xl shadow-md mb-4">
                    {qrCodeImage ? (
                      <img 
                        src={qrCodeImage} 
                        alt="Freelancer's GCash QR" 
                        className="w-full max-w-[250px] h-auto"
                        onError={(e) => {
                          console.error("QR image loading error");
                          e.target.onerror = null;
                          e.target.src = 'https://via.placeholder.com/250x250?text=QR+Code+Not+Available';
                        }}
                      />
                    ) : (
                      <div className="w-[250px] h-[250px] flex flex-col items-center justify-center bg-gray-100 rounded">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-gray-500 text-center">
                          The freelancer has not uploaded a GCash QR code.
                          <br />
                          Please use Face to Face payment instead.
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 text-center">
                    {qrCodeImage 
                      ? "This QR code is linked to the freelancer's GCash account" 
                      : "No QR code available. Please contact the freelancer."}
                  </p>
                </div>
                
                <div className="md:w-1/2">
                  <div className="mb-4">
                    <label className="block text-gray-700 font-semibold mb-2">Amount to Pay</label>
                    <div className="p-3 bg-white rounded-lg border border-gray-300 font-bold text-xl">
                      ₱{transaction.amount}
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <label className="block text-gray-700 font-semibold mb-2">Enter Reference Number</label>
                    <input
                      type="text"
                      value={gcashReference}
                      onChange={handleGcashReferenceChange}
                      placeholder="e.g. GC12345678"
                      className="w-full p-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      disabled={!qrCodeImage}
                    />
                    <p className="text-xs text-gray-500 mt-1">Enter the reference number you received from GCash after payment</p>
                  </div>
                  
                  <ol className="list-decimal list-inside text-gray-700 space-y-2 mb-4 text-sm">
                    <li>Open your GCash app and scan the QR code</li>
                    <li>Pay the exact amount shown</li>
                    <li>Copy the reference number from GCash</li>
                    <li>Paste the reference number above</li>
                    <li>Click "Confirm Payment" below</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Payment Button */}
          {transaction.status === 'Pending' && paymentMethod && !isPaymentSent && (
            <div className="flex justify-center mt-8">
              <button
                onClick={handlePaymentSent}
                disabled={submitting || 
                  (paymentMethod === 'GCash' && !gcashReference) || 
                  (paymentMethod === 'GCash' && !qrCodeImage)}
                className="py-3 px-8 bg-[#800000] text-white rounded-full font-bold 
                         hover:bg-opacity-90 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#800000] focus:ring-opacity-50
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  'Confirm Payment'
                )}
              </button>
            </div>
          )}

          {/* Success Message */}
          {isPaymentSent && (
            <div className="bg-green-50 p-6 rounded-xl border border-green-200 mt-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mr-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-green-800">Payment Sent Successfully!</h4>
              </div>
              <p className="text-green-700 mb-4">Your payment has been marked as sent. The freelancer will be notified and will confirm receipt.</p>
              <p className="text-sm text-green-600">You will be redirected to your transaction history shortly...</p>
            </div>
          )}

          {/* Payment Instructions */}
          {transaction.status === 'Pending' && !paymentMethod && (
            <div className="mt-8 p-6 bg-yellow-50 rounded-xl border border-yellow-200">
              <h5 className="font-bold text-yellow-800 mb-3">Payment Instructions</h5>
              <ol className="list-decimal list-inside text-yellow-800 space-y-2">
                <li>Review the payment details above carefully</li>
                <li>Select your preferred payment method</li>
                <li>Follow the instructions for your selected payment method</li>
                <li>Confirm your payment when ready</li>
                <li>Wait for confirmation before closing this page</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionPage;