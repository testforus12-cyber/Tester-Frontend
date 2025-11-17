// frontend/src/pages/MyVendors.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { getTemporaryTransporters } from '../services/api';
import Cookies from 'js-cookie';
import EditVendorModal from '../components/EditVendorModal';

interface Vendor {
  _id: string;
  companyName: string;
  vendorCode?: string;
  vendorPhone?: string;
  vendorEmail?: string;
  gstNo?: string;
  mode?: string;
  address?: string;
  state?: string;
  city?: string;
  pincode?: string;
  rating?: number;
  subVendor?: string;
  selectedZones?: string[];
  prices?: {
    priceRate?: any;
    priceChart?: any;
  };
  createdAt?: string;
  updatedAt?: string;
}

const MyVendors = () => {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Edit modal state
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Fetch vendors on mount
  useEffect(() => {
    fetchVendors();
  }, [user]);

  const fetchVendors = async () => {
    try {
      setIsLoading(true);
      
      const token = Cookies.get('authToken') || localStorage.getItem('authToken');
      if (!token) {
        toast.error('Please login to view vendors');
        return;
      }

      // Extract customerID from token
      const payload = JSON.parse(atob(token.split('.')[1]));
      const customerID = payload?.customer?._id || payload?._id;

      if (!customerID) {
        toast.error('Invalid authentication token');
        return;
      }

      console.log('📡 Fetching vendors for customerID:', customerID);

      // Fetch vendors from API
      const response = await getTemporaryTransporters(customerID);
      
      console.log('✅ Vendors fetched:', response);

      if (response && Array.isArray(response)) {
        setVendors(response);
      } else {
        setVendors([]);
      }

    } catch (error: any) {
      console.error('❌ Error fetching vendors:', error);
      toast.error('Failed to load vendors');
      setVendors([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle edit button click
  const handleEditVendor = (vendor: Vendor) => {
    console.log('📝 Opening edit modal for vendor:', vendor);
    setSelectedVendor(vendor);
    setShowEditModal(true);
  };

  // Handle modal close
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedVendor(null);
  };

  // Handle successful save
  const handleSaveVendor = async (updatedVendor: Vendor) => {
    console.log('✅ Vendor saved, refreshing list');
    
    // Refresh the vendor list
    await fetchVendors();
    
    toast.success('Vendor updated successfully!');
  };

// Handle delete vendor
const handleDeleteVendor = async (vendorId: string) => {
  if (!window.confirm('Are you sure you want to delete this vendor?')) {
    return;
  }
  try {
    const token = Cookies.get('authToken') || localStorage.getItem('authToken');
    const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://tester-backend-4nxc.onrender.com').replace(/\/+$/, '');
    
    // FIX: Changed from fetch`...` to fetch(...)
    const response = await fetch(`${API_BASE}/api/transporter/delete-vendor/${vendorId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete vendor');
    }
    
    toast.success('Vendor deleted successfully');
    fetchVendors(); // Refresh list
  } catch (error: any) {
    console.error('Error deleting vendor:', error);
    toast.error(error.message || 'Failed to delete vendor');
  }
};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading vendors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">My Vendors</h1>
        <p className="text-gray-600 mt-2">
          Manage your transportation vendors ({vendors.length} total)
        </p>
      </div>

      {/* Vendor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vendors.map((vendor) => (
          <div
            key={vendor._id}
            className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
          >
            {/* Vendor Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800 mb-1">
                  {vendor.companyName}
                </h3>
                {vendor.vendorCode && (
                  <p className="text-sm text-gray-500">
                    Code: {vendor.vendorCode}
                  </p>
                )}
              </div>
              {vendor.rating && (
                <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded">
                  <span className="text-yellow-500">⭐</span>
                  <span className="text-sm font-medium text-gray-700">
                    {vendor.rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>

            {/* Vendor Details */}
            <div className="space-y-2 mb-4">
              {vendor.vendorPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">📞</span>
                  <span className="text-gray-700">{vendor.vendorPhone}</span>
                </div>
              )}
              {vendor.vendorEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">📧</span>
                  <span className="text-gray-700">{vendor.vendorEmail}</span>
                </div>
              )}
              {vendor.mode && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">🚚</span>
                  <span className="text-gray-700 capitalize">{vendor.mode}</span>
                </div>
              )}
              {vendor.gstNo && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">📋</span>
                  <span className="text-gray-700 font-mono text-xs">{vendor.gstNo}</span>
                </div>
              )}
            </div>

            {/* Location */}
            {(vendor.city || vendor.state) && (
              <div className="mb-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-600">
                  📍 {vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : vendor.city || vendor.state}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t border-gray-100">
              <button
                onClick={() => handleEditVendor(vendor)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteVendor(vendor._id)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Delete
              </button>
            </div>

            {/* Timestamp */}
            {vendor.createdAt && (
              <p className="text-xs text-gray-400 mt-4 text-center">
                Added on {new Date(vendor.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {vendors.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📦</div>
          <p className="text-gray-500 text-lg mb-2">No vendors found</p>
          <p className="text-gray-400 text-sm mb-6">Get started by adding your first vendor</p>
          <button
            onClick={() => window.location.href = '/addvendor'}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Add Your First Vendor
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedVendor && (
        <EditVendorModal
          vendor={selectedVendor}
          onClose={handleCloseEditModal}
          onSave={handleSaveVendor}
        />
      )}

    </div>
  );
};

export default MyVendors;