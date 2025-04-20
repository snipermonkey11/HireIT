import React, { useState, useEffect } from 'react';
import { User, Mail, Key, Shield } from 'lucide-react';
import api from './services/api';

const AdminProfile = () => {
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    role: 'Admin'
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(profile);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    setProfile({
      fullName: userData.fullName || '',
      email: userData.email || '',
      role: 'Admin'
    });
    setEditedProfile({
      fullName: userData.fullName || '',
      email: userData.email || '',
      role: 'Admin'
    });
  }, []);

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    setError('');
    setSuccess('');
  };

  const handlePasswordToggle = () => {
    setIsChangingPassword(!isChangingPassword);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setError('');
    setSuccess('');
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put('/admin/profile', editedProfile);
      setProfile(editedProfile);
      setIsEditing(false);
      setSuccess('Profile updated successfully!');
      
      // Update localStorage
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      localStorage.setItem('userData', JSON.stringify({
        ...userData,
        fullName: editedProfile.fullName,
        email: editedProfile.email
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    try {
      await api.put('/admin/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      setIsChangingPassword(false);
      setSuccess('Password updated successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update password');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Profile Header */}
          <div className="bg-maroon-700 px-6 py-8">
            <div className="flex items-center">
              <div className="h-20 w-20 rounded-full bg-white flex items-center justify-center">
                <User size={40} className="text-maroon-700" />
              </div>
              <div className="ml-6">
                <h1 className="text-2xl font-bold text-white">{profile.fullName}</h1>
                <p className="text-maroon-200">{profile.role}</p>
              </div>
            </div>
          </div>

          {/* Profile Content */}
          <div className="p-6">
            {(error || success) && (
              <div className={`p-4 mb-6 rounded-lg ${error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {error || success}
              </div>
            )}

            {/* Profile Information */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Information</h2>
              {isEditing ? (
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <input
                      type="text"
                      value={editedProfile.fullName}
                      onChange={(e) => setEditedProfile({...editedProfile, fullName: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-500 focus:ring-maroon-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      value={editedProfile.email}
                      onChange={(e) => setEditedProfile({...editedProfile, email: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-500 focus:ring-maroon-500"
                      required
                    />
                  </div>
                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      className="bg-maroon-600 text-white px-4 py-2 rounded-md hover:bg-maroon-700"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={handleEditToggle}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center">
                    <User className="text-gray-400 mr-3" size={20} />
                    <span className="text-gray-600">{profile.fullName}</span>
                  </div>
                  <div className="flex items-center">
                    <Mail className="text-gray-400 mr-3" size={20} />
                    <span className="text-gray-600">{profile.email}</span>
                  </div>
                  <div className="flex items-center">
                    <Shield className="text-gray-400 mr-3" size={20} />
                    <span className="text-gray-600">{profile.role}</span>
                  </div>
                  <button
                    onClick={handleEditToggle}
                    className="bg-maroon-600 text-white px-4 py-2 rounded-md hover:bg-maroon-700"
                  >
                    Edit Profile
                  </button>
                </div>
              )}
            </div>

            {/* Password Change Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Change Password</h2>
              {isChangingPassword ? (
                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Current Password</label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-500 focus:ring-maroon-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">New Password</label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-500 focus:ring-maroon-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-maroon-500 focus:ring-maroon-500"
                      required
                    />
                  </div>
                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      className="bg-maroon-600 text-white px-4 py-2 rounded-md hover:bg-maroon-700"
                    >
                      Update Password
                    </button>
                    <button
                      type="button"
                      onClick={handlePasswordToggle}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={handlePasswordToggle}
                  className="flex items-center text-maroon-600 hover:text-maroon-700"
                >
                  <Key size={20} className="mr-2" />
                  Change Password
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;
