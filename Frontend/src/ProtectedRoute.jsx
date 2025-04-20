import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

const ProtectedRoute = () => {
  const location = useLocation();
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');

  // Simple authentication check
  if (!userData.token) {
    return <Navigate to="/login" replace />;
  }

  // Handle signup flow
  if (userData.isInSignupFlow) {
    if (!userData.hasCompletedProfile) {
      return <Navigate to="/profile-creation" replace />;
    }
    if (!userData.isEmailVerified) {
      return <Navigate to="/verify-email" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute; 