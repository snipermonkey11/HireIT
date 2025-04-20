import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X, User, LogOut, Home, Search, LayoutDashboard, Users, ShoppingBag, CreditCard, Star } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { authService } from './services/api';

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Function to highlight the active link
  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    try {
      const storedUserData = JSON.parse(localStorage.getItem('userData') || '{}');
      setIsAdmin(!!storedUserData?.isAdmin);
      setIsAuthenticated(!!storedUserData?.token);
      setUserData(storedUserData);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAdmin(false);
      setIsAuthenticated(false);
      setUserData(null);
    }
  }, [location]); // Re-check when location changes

  const handleLinkClick = (path) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: path } });
      return false;
    }
    return true;
  };

  const handleLogout = () => {
    localStorage.removeItem('userData');
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Define navigation items based on user role
  const getNavigationItems = () => {
    if (isAdmin) {
      return [
        { name: 'Manage Users', path: '/admin/manage-users', icon: Users },
        { name: 'Manage Services', path: '/admin/manage-services', icon: ShoppingBag },
        { name: 'Manage Transactions', path: '/admin/manage-transactions', icon: CreditCard },
        { name: 'Manage Reviews', path: '/admin/manage-reviews', icon: Star },
        { name: 'Profile', path: '/admin/profile', icon: User }
      ];
    }
    return [
      { name: 'Home', path: '/home', icon: Home },
      { name: 'Discover', path: '/discover', icon: Search },
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Profile', path: '/profile', icon: User }
    ];
  };

  const navigationItems = getNavigationItems();

  return (
    <nav className="bg-[#800000] fixed top-0 left-0 right-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex-shrink-0 flex items-center"
            onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/home')}
          >
            <span className="text-2xl md:text-3xl font-bold text-[#ffd700] cursor-pointer">
              HIREIT
            </span>
          </motion.div>

          {/* Hamburger Menu for Mobile */}
          <div className="flex md:hidden">
            <button
              className="text-[#ffd700] p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-white"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? (
                <X size={28} className="transition-transform duration-300" />
              ) : (
                <Menu size={28} className="transition-transform duration-300" />
              )}
            </button>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex space-x-1">
              {navigationItems.map((item, index) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <Link
                    key={index}
                    to={item.path}
                    onClick={() => handleLinkClick(item.path)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center ${
                      active
                        ? 'bg-[#ffd700] bg-opacity-20 text-[#ffd700]'
                        : 'text-white hover:bg-[#ffd700] hover:bg-opacity-10 hover:text-[#ffd700]'
                    }`}
                  >
                    <Icon size={18} className="mr-1.5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* User Menu / Auth Buttons */}
            <div className="ml-4 flex items-center">
              {isAuthenticated ? (
                <div className="relative flex items-center">
                  {userData?.photo ? (
                    <img 
                      src={userData.photo} 
                      alt={userData.fullName || 'User'}
                      className="h-8 w-8 rounded-full border-2 border-[#ffd700] object-cover mr-3"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-[#ffd700] bg-opacity-20 flex items-center justify-center mr-3">
                      <User size={16} className="text-[#ffd700]" />
                    </div>
                  )}
                  
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 bg-[#ffd700] bg-opacity-10 hover:bg-opacity-20 text-[#ffd700] px-3 py-1.5 rounded-md transition-all duration-200"
                  >
                    <LogOut size={16} />
                    <span className="text-sm font-medium">Logout</span>
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Link
                    to="/login"
                    className="text-white hover:text-[#ffd700] bg-[#ffd700] bg-opacity-10 hover:bg-opacity-20 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    className="bg-[#ffd700] text-[#800000] hover:bg-opacity-90 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ 
          height: menuOpen ? 'auto' : 0,
          opacity: menuOpen ? 1 : 0
        }}
        transition={{ duration: 0.3 }}
        className="md:hidden overflow-hidden bg-[#8a1313]"
      >
        <div className="px-2 pt-2 pb-3 space-y-1">
          {navigationItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <Link
                key={index}
                to={item.path}
                onClick={() => {
                  setMenuOpen(false);
                  handleLinkClick(item.path);
                }}
                className={`flex items-center px-3 py-3 rounded-md text-base font-medium ${
                  active
                    ? 'bg-[#ffd700] bg-opacity-20 text-[#ffd700]'
                    : 'text-white hover:bg-[#ffd700] hover:bg-opacity-10 hover:text-[#ffd700]'
                }`}
              >
                <Icon size={20} className="mr-3" />
                {item.name}
              </Link>
            );
          })}
          
          {/* Mobile Authentication Buttons */}
          <div className="pt-4 pb-3 border-t border-white border-opacity-10">
            {isAuthenticated ? (
              <div className="flex items-center px-3">
                {userData?.photo ? (
                  <img 
                    src={userData.photo} 
                    alt={userData.fullName || 'User'}
                    className="h-10 w-10 rounded-full border-2 border-[#ffd700] object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-[#ffd700] bg-opacity-20 flex items-center justify-center">
                    <User size={20} className="text-[#ffd700]" />
                  </div>
                )}
                
                <div className="ml-3">
                  <div className="text-sm font-medium text-white">{userData?.fullName || 'User'}</div>
                  <div className="text-xs text-gray-300">{userData?.email || ''}</div>
                </div>
              </div>
            ) : null}
            
            <div className="mt-3 px-2">
              {isAuthenticated ? (
                <button
                  onClick={() => {
                    handleLogout();
                    setMenuOpen(false);
                  }}
                  className="w-full flex justify-center items-center px-4 py-3 bg-[#ffd700] bg-opacity-10 hover:bg-opacity-20 text-[#ffd700] rounded-md text-base font-medium"
                >
                  <LogOut size={18} className="mr-2" />
                  Logout
                </button>
              ) : (
                <div className="space-y-2">
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex justify-center items-center px-4 py-3 border border-[#ffd700] text-[#ffd700] rounded-md text-base font-medium"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex justify-center items-center px-4 py-3 bg-[#ffd700] text-[#800000] rounded-md text-base font-medium"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </nav>
  );
}

export default Header;
