import React, { useState, useEffect } from 'react';
import api from './services/api';

const DEFAULT_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNlMGUwZTAiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM1IiByPSIyMCIgZmlsbD0iIzgwMDAwMCIvPjxwYXRoIGQ9Ik0yMCA4MEMyMCA2MCAzMCA1MCA1MCA1MEM3MCA1MCA4MCA2MCA4MCA4MEw4MCA5MEwyMCA5MEwyMCA4MFoiIGZpbGw9IiM4MDAwMDAiLz48L3N2Zz4=";

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('photo'); // 'photo' or 'qr'

  // Fetch users from backend
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await api.get('/users/all');
        // Map through users to ensure proper field names
        const mappedUsers = response.data.map(user => ({
          ...user,
          photo: user.Photo || user.photo, // Handle both cases
          gcashQr: user.GcashQr || user.gcashQr || user.gcash_qr, // Handle all possible cases
          fullName: user.FullName || user.fullName || user.full_name,
          studentId: user.StudentId || user.studentId || user.student_id,
          userId: user.UserId || user.userId || user.user_id,
          isAdmin: user.email === 'admin@cit.edu' || user.email === 'admin@citu.edu'
        }));
        setUsers(mappedUsers);
        setError(null);
      } catch (error) {
        console.error('Error fetching users:', error);
        setError('Failed to fetch users. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Filter users based on search query
  const filteredUsers = users
    .filter((user) => !user.email.includes('.deleted.')) // Filter out users with .deleted. in their email
    .filter((user) => {
      const searchFields = [
        user.fullName?.toLowerCase(),
        user.email?.toLowerCase(),
        user.studentId?.toLowerCase(),
      ];
      return searchQuery === '' || searchFields.some(field => field?.includes(searchQuery.toLowerCase()));
    });

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      if (!userData.isAdmin) {
        alert('Only administrators can delete users');
        return;
      }

      // Show loading state
      setLoading(true);

      // Make the delete request
      const response = await api.delete(`/users/${userId}`);
      console.log('Delete response:', response);

      if (response.status === 200) {
        // Update the users list after successful deletion
        setUsers(prevUsers => prevUsers.filter(u => u.userId !== userId));
        alert('User deleted successfully');
        
        // Refresh the users list
        const updatedResponse = await api.get('/users/all');
        const mappedUsers = updatedResponse.data.map(user => ({
          ...user,
          photo: user.Photo || user.photo,
          gcashQr: user.GcashQr || user.gcashQr || user.gcash_qr,
          fullName: user.FullName || user.fullName || user.full_name,
          studentId: user.StudentId || user.studentId || user.student_id,
          userId: user.UserId || user.userId || user.user_id,
          isAdmin: user.email === 'admin@cit.edu' || user.email === 'admin@citu.edu'
        }));
        setUsers(mappedUsers);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.details || 
                          'Failed to delete user. Please try again.';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendUser = async (userId) => {
    if (!window.confirm('Are you sure you want to suspend this user?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.put(`/users/${userId}/suspend`);

      if (response.status === 200) {
        // Update the user's status in the UI
        setUsers(prevUsers => 
          prevUsers.map(user =>
            user.userId === userId 
              ? { ...user, status: 'Pending' } 
              : user
          )
        );
        alert('User suspended successfully');
      }
    } catch (error) {
      console.error('Error suspending user:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          'Failed to suspend user';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = (imageUrl, type) => {
    setSelectedImage(imageUrl);
    setModalType(type);
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-[#fff5f5]">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#800000] border-opacity-25 border-t-[#800000]"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full bg-[#ffd700] animate-ping opacity-75"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-[#fff5f5]">
        <div className="bg-red-50 border-l-4 border-[#800000] text-[#800000] p-6 rounded-md shadow-xl max-w-lg transform transition-all hover:scale-105">
          <div className="flex items-center">
            <svg className="h-8 w-8 text-[#800000] mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-medium text-lg">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fff8f8] to-[#fff5e6] p-6">
      <div className="container mx-auto space-y-8 max-w-7xl">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-[#800000] flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 mr-3 text-[#800000]" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#800000] to-[#a52a2a]">
              Manage Users
            </span>
          </h2>
          <div className="text-sm font-semibold bg-[#800000] text-[#ffd700] px-4 py-2 rounded-full shadow-md">
            Total users: {users.length}
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-2xl border border-[#800000]/10 transition-all duration-300 hover:shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <h3 className="text-2xl font-bold text-[#800000] flex items-center">
              <span className="border-b-4 border-[#ffd700] pb-1">Users List</span>
            </h3>
            <div className="w-full md:w-auto">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg className="w-5 h-5 text-[#800000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search users by name, email, or student ID"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 p-3 w-full md:w-96 border border-[#800000]/30 rounded-lg shadow-sm focus:ring-2 focus:ring-[#800000] focus:border-[#800000] transition-all duration-200"
                />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#800000]/20 shadow-lg">
            <table className="min-w-full divide-y divide-[#800000]/10">
              <thead>
                <tr className="bg-gradient-to-r from-[#800000] to-[#8b0000] text-white">
                  <th className="py-4 px-4 text-left font-semibold">Photo</th>
                  <th className="py-4 px-4 text-left font-semibold">Full Name</th>
                  <th className="py-4 px-4 text-left font-semibold">Student ID</th>
                  <th className="py-4 px-4 text-left font-semibold">Grade</th>
                  <th className="py-4 px-4 text-left font-semibold">Section</th>
                  <th className="py-4 px-4 text-left font-semibold">Email</th>
                  <th className="py-4 px-4 text-left font-semibold">GCash QR</th>
                  <th className="py-4 px-4 text-left font-semibold">Status</th>
                  <th className="py-4 px-4 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#800000]/10 bg-white">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-12 px-6">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="bg-[#fff5f5] p-4 rounded-full">
                          <svg className="w-16 h-16 text-[#800000]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <span className="text-lg font-medium text-[#800000]">No users found</span>
                        <span className="text-sm text-[#800000]/60">Try adjusting your search criteria</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr key={user.userId} className="hover:bg-[#fff5f5] transition-colors duration-150">
                      <td className="py-4 px-4">
                        <div className="relative w-14 h-14 rounded-full overflow-hidden border-3 border-[#800000] shadow-md cursor-pointer hover:opacity-90 hover:scale-105 transition-all duration-200 group"
                             onClick={() => handleImageClick(user.photo || DEFAULT_AVATAR, 'photo')}>
                          <img
                            src={user.photo || DEFAULT_AVATAR}
                            alt={user.fullName}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-[#800000]/0 group-hover:bg-[#800000]/20 flex items-center justify-center transition-all duration-200">
                            <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transform scale-0 group-hover:scale-100 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-800">{user.fullName}</td>
                      <td className="py-4 px-4 text-gray-600">{user.studentId || 'N/A'}</td>
                      <td className="py-4 px-4 text-gray-600">{user.grade || 'N/A'}</td>
                      <td className="py-4 px-4 text-gray-600">{user.section || 'N/A'}</td>
                      <td className="py-4 px-4 text-gray-600">
                        <span className="inline-flex items-center">
                          <svg className="h-4 w-4 text-[#800000] mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                          </svg>
                          {user.email}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {user.gcashQr ? (
                          <button
                            onClick={() => handleImageClick(user.gcashQr, 'qr')}
                            className="bg-gradient-to-r from-[#800000] to-[#8b0000] text-[#ffd700] py-1.5 px-4 rounded-md hover:from-[#8b0000] hover:to-[#800000] transition duration-300 shadow-md flex items-center text-sm transform hover:scale-105"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                            View QR
                          </button>
                        ) : (
                          <span className="text-gray-400 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            No QR
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
                          user.isDeleted ? 'bg-red-100 text-red-800 border border-red-200' :
                          user.status === 'Suspended' || user.status === 'Pending' 
                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' 
                            : 'bg-gradient-to-r from-green-100 to-green-50 text-green-800 border border-green-200'
                        }`}>
                          <span className={`w-2 h-2 rounded-full mr-1.5 ${
                            user.isDeleted ? 'bg-red-500' :
                            user.status === 'Suspended' || user.status === 'Pending' 
                              ? 'bg-yellow-500 animate-pulse' 
                              : 'bg-green-500'
                          }`}></span>
                          {user.isDeleted ? 'Deleted' : user.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleSuspendUser(user.userId)}
                            className="bg-[#ffd700] text-[#800000] py-1.5 px-3 rounded-md hover:bg-[#ffed8a] transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center text-sm transform hover:translate-y-[-2px]"
                            disabled={user.isAdmin}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                            </svg>
                            Suspend
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.userId)}
                            className="bg-[#800000] text-white py-1.5 px-3 rounded-md hover:bg-[#a52a2a] transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center text-sm transform hover:translate-y-[-2px]"
                            disabled={user.isAdmin}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300 animate-fadeIn">
          <div className="bg-white rounded-xl max-w-3xl w-full mx-4 overflow-hidden shadow-2xl transform transition-all duration-300 animate-scaleIn">
            <div className="flex justify-between items-center p-4 border-b border-[#800000]/20 bg-gradient-to-r from-[#800000] to-[#8b0000] text-white">
              <h3 className="text-xl font-semibold flex items-center">
                {modalType === 'photo' ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[#ffd700]" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    Profile Photo
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[#ffd700]" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    GCash QR Code
                  </>
                )}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-[#ffd700] focus:outline-none p-1 rounded-full hover:bg-white/10 transition-colors duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 bg-[#fff5f5] flex justify-center">
              <img
                src={selectedImage}
                alt="Enlarged view"
                className={`${
                  modalType === 'photo' 
                    ? 'max-h-[70vh] rounded-lg object-cover shadow-lg' 
                    : 'max-h-[70vh] object-contain'
                } border-4 ${modalType === 'photo' ? 'border-[#800000]/20' : 'border-white'}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Add custom animation keyframes */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
        .border-3 {
          border-width: 3px;
        }
      `}</style>
    </div>
  );
};

export default ManageUsers;
