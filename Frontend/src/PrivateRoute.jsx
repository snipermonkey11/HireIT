// PrivateRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const PrivateRoute = () => {
  const userLoggedIn = JSON.parse(localStorage.getItem('userLoggedIn')) || JSON.parse(sessionStorage.getItem('userLoggedIn'));

  // If the user is not logged in, redirect to the login page
  if (!userLoggedIn) {
    return <Navigate to="/login" />;
  }

  // If the user is logged in, render the outlet (the protected route)
  return <Outlet />;
};

export default PrivateRoute;
