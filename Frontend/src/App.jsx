import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Header from './Header.jsx';
import HomePage from './HomePage.jsx'; // Import HomePage component
import Dashboard from './Dashboard.jsx'; // Import Dashboard component
import ManageUsers from './ManageUsers.jsx'; // Import ManageUsers component
import ManageServices from './ManageServices.jsx'; // Import ManageServices component
import ManageTransactions from './ManageTransactions.jsx'; // Import ManageTransactions component
import ManageReviews from './ManageReviews.jsx'; // Import ManageReviews component
import AdminProfile from './AdminProfile.jsx'; // Import AdminProfile component
import Discover from './Discover.jsx'; // Import Discover component
import Profile from './Profile.jsx'; // Import Profile component
import ProfileCreation from './ProfileCreation.jsx'; // Import Profile Creation component
import LoginPage from './LoginPage.jsx'; // Import Login Page component
import SignUpPage from './SignUpPage.jsx'; // Import SignUp Page component
import EmailVerification from './EmailVerification.jsx'; // Import Email Verification component
import Messages from './Messages.jsx'; // Import Messages component
import UserProfile from './UserProfile.jsx'; // Import UserProfile component
import ServiceApplication from './ServiceApplication.jsx'; // Import ServiceApplication page
import ServiceConfirmationPage from './ServiceConfirmationPage.jsx'; // Import ServiceConfirmationPage
import Notifications from './Notifications.jsx'; // Import Notifications page
import MyApplications from './MyApplications.jsx'; // Import MyApplications page
import ActiveProjects from './ActiveProjects.jsx'; // Import ActiveProjects page (this is the new page for tracking active services)
import ProjectStatus from './ProjectStatus.jsx'; // Import ProjectStatus page for User 1 (Client) to view and approve projects
import TransactionPage from './TransactionPage.jsx';
import ReceivedPaymentPage from './ReceivedPaymentPage.jsx'; // Adjusted path
import LeaveReviewPage from './LeaveReviewPage';
import TransactionHistoryPage from './TransactionHistoryPage.jsx'; // Import the page component
import Conversation from './Conversation.jsx'; // Import Conversation component
import TermsAndConditions from './TermsAndConditions.jsx'
import PrivacyPolicy from './PrivacyPolicy.jsx'; // Import Privacy Policy
import AboutUs from './AboutUs.jsx'; // Import About Us page
import ProtectedRoute from './ProtectedRoute';
import { authService } from './services/api';
import Reviews from './Reviews.jsx'; // Import Reviews component


function App() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const userData = JSON.parse(localStorage.getItem('userData'));
      setIsAdmin(!!userData?.isAdmin);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAdmin(false);
    }
  }, []);

  const AdminRoute = ({ children }) => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    return userData.isAdmin ? children : <Navigate to="/login" replace />;
  };

  // Memoize the authentication check
  const isAuthenticated = React.useMemo(() => {
    return authService.isAuthenticated();
  }, []);

  return (
    <BrowserRouter>
      <Header />
      <div className="mt-20 p-6">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/discover" element={<Discover />} />

          {/* Signup Flow Routes */}
          <Route path="/profile-creation" element={<ProfileCreation />} />
          <Route path="/verify-email" element={<EmailVerification />} />

          {/* Admin Routes */}
          <Route path="/admin/*" element={
            <AdminRoute>
              <Routes>
                <Route path="dashboard" element={<Navigate to="/admin/manage-users" replace />} />
                <Route path="manage-users" element={<ManageUsers />} />
                <Route path="manage-services" element={<ManageServices />} />
                <Route path="manage-transactions" element={<ManageTransactions />} />
                <Route path="manage-reviews" element={<ManageReviews />} />
                
                <Route path="profile" element={<AdminProfile />} />
              </Routes>
            </AdminRoute>
          } />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/userprofile/:id" element={<UserProfile />} />
            <Route path="/apply/:serviceId" element={<ServiceApplication />} />
            <Route path="/my-applications" element={<MyApplications />} />
            <Route path="/view-application" element={<ServiceConfirmationPage />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/transaction/:applicationId" element={<TransactionPage />} />
            <Route path="/received-payment/:applicationId" element={<ReceivedPaymentPage />} />
            <Route path="/active" element={<ActiveProjects />} />
            <Route path="/status" element={<ProjectStatus />} />
            <Route path="/leave-review/:applicationId" element={<LeaveReviewPage />} />
            <Route path="/transaction-history" element={<TransactionHistoryPage />} />
            <Route path="/conversation/:id" element={<Conversation />} />
            <Route path="/reviews" element={<Reviews />} />
          </Route>

          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </BrowserRouter>
  );
}

export default App;
