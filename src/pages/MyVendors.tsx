// frontend/src/pages/MyVendors.tsx  (replace your current file with this)
// debug: unique string to verify this file is bundled
console.debug('***MYVENDORS FILE LOADED***', new Date().toISOString());

import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { getTemporaryTransporters } from '../services/api'; // <-- service wrapper you shared
import Cookies from 'js-cookie';

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

interface EditVendorData {
  companyName: string;
  vendorCode: string;
  vendorPhone: string;
  vendorEmail: string;
  gstNo: string;
  mode: string;
  address: string;
  state: string;
  city: string;
  pincode: string;
  rating: number;
  subVendor: string;
  selectedZones: string[];
}

const MyVendors: React.FC = () => {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [editFormData, setEditFormData] = useState<EditVendorData>({
    companyName: '',
    vendorCode: '',
    vendorPhone: '',
    vendorEmail: '',
    gstNo: '',
    mode: '',
    address: '',
    state: '',
    city: '',
    pincode: '',
    rating: 0,
    subVendor: '',
    selectedZones: []
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // -------------------------
  // Debug / test helpers
  // -------------------------
  console.debug('MyVendors render — user from useAuth():', user);

  // Expose manual trigger for debugging from DevTools:
  // `window.fetchVendors()` will call the inner loader.
  (window as any).fetchVendors = (window as any).fetchVendors || undefined;

  // -------------------------
  // fetch logic (internal)
  // -------------------------
  const fetchVendorsInternal = async () => {
  setLoading(true);
  try {
    console.debug('fetchVendorsInternal starting — user=', user);

    // --- DERIVE ownerId from possible shapes ---
    // support: user._id | user.id | user.customer._id | user.customer.id
    const ownerId =
      (user && (user._id ?? user.id)) ||
      (user && (user.customer && (user.customer._id ?? user.customer.id))) ||
      null;

    console.debug('fetchVendorsInternal: resolved ownerId=', ownerId);

    if (!ownerId) {
      console.debug('fetchVendorsInternal: no ownerId resolved — skipping fetch');
      setLoading(false);
      return;
    }

    // call central service (it will try endpoints/fallbacks)
    const data = await getTemporaryTransporters(ownerId);

    if (data === null) {
      console.warn('fetchVendorsInternal: server returned unauthorized (null).');
      toast.error('Authentication required. Please login.');
      setVendors([]);
      return;
    }

    if (!Array.isArray(data) || data.length === 0) {
      console.debug('fetchVendorsInternal: no vendors returned', { length: Array.isArray(data) ? data.length : 'not-array' });
      setVendors([]);
      return;
    }

    console.debug('fetchVendorsInternal: got vendors count=', data.length);
    setVendors(data);
  } catch (err: any) {
    console.error('fetchVendorsInternal error', err);
    toast.error('Error fetching vendors');
    setVendors([]);
  } finally {
    setLoading(false);
  }
};


  // Expose for manual invocation from DevTools:
  (window as any).fetchVendors = async () => {
    return fetchVendorsInternal();
  };

  // -------------------------
  // Auto-run when user becomes available
  // -------------------------
  useEffect(() => {
  console.debug('MyVendors useEffect triggered — user =', user);
  const ownerId =
    (user && (user._id ?? user.id)) ||
    (user && (user.customer && (user.customer._id ?? user.customer.id))) ||
    null;

  if (ownerId) {
    fetchVendorsInternal();
  } else {
    console.debug('MyVendors useEffect: ownerId not present, fetch skipped');
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [user]);



  // -------------------------
  // Edit / Save / Delete handlers
  // -------------------------
  const handleEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setEditFormData({
      companyName: vendor.companyName || '',
      vendorCode: vendor.vendorCode || '',
      vendorPhone: vendor.vendorPhone || '',
      vendorEmail: vendor.vendorEmail || '',
      gstNo: vendor.gstNo || '',
      mode: vendor.mode || '',
      address: vendor.address || '',
      state: vendor.state || '',
      city: vendor.city || '',
      pincode: vendor.pincode || '',
      rating: vendor.rating || 0,
      subVendor: vendor.subVendor || '',
      selectedZones: vendor.selectedZones || []
    });
    setShowEditModal(true);
  };

  const handleSaveVendor = async () => {
    if (!editingVendor) return;
    try {
      setSaving(true);
      const token = Cookies.get('authToken') || localStorage.getItem('token') || localStorage.getItem('authToken');
      if (!token) {
        toast.error('Authentication required to update vendor');
        return;
      }

      const response = await fetch(`/api/transporter/update-vendor/${editingVendor._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editFormData),
      });

      if (response.status === 401) {
        toast.error('Not authorized. Please login again.');
        return;
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Vendor updated successfully');
        setShowEditModal(false);
        setEditingVendor(null);
        await fetchVendorsInternal();
      } else {
        console.error('update vendor failed:', data);
        toast.error(data.message || 'Failed to update vendor');
      }
    } catch (error) {
      console.error('Error updating vendor:', error);
      toast.error('Error updating vendor');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVendor = async (vendorId: string, companyName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${companyName}?`)) return;
    try {
      const token = Cookies.get('authToken') || localStorage.getItem('token') || localStorage.getItem('authToken');
      if (!token) {
        toast.error('Authentication required to delete vendor');
        return;
      }

      const payload = {
        customerID: user?._id ?? user?.id,
        companyName,
        vendorId
      };

      const response = await fetch('/api/transporter/remove-tied-up', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        toast.error('Not authorized. Please login again.');
        return;
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Vendor deleted successfully');
        await fetchVendorsInternal();
      } else {
        console.error('delete vendor failed:', data);
        toast.error(data.message || 'Failed to delete vendor');
      }
    } catch (err) {
      console.error('Error deleting vendor:', err);
      toast.error('Error deleting vendor');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  // -------------------------
  // Render
  // -------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading vendors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Vendors</h1>
          <p className="mt-2 text-gray-600">Manage your added vendors and their details</p>
        </div>

        {vendors.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No vendors found</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding your first vendor.</p>
            <div className="mt-6">
              <a
                href="/addvendor"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Add Vendor
              </a>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {vendors.map((vendor) => (
              <div key={vendor._id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{vendor.companyName}</h3>
                    <p className="text-sm text-gray-600 mt-1">Code: {vendor.vendorCode}</p>
                    <div className="mt-3 space-y-1">
                      <p className="text-sm text-gray-600"><span className="font-medium">Phone:</span> {vendor.vendorPhone}</p>
                      <p className="text-sm text-gray-600"><span className="font-medium">Email:</span> {vendor.vendorEmail}</p>
                      <p className="text-sm text-gray-600"><span className="font-medium">GST:</span> {vendor.gstNo}</p>
                      <p className="text-sm text-gray-600"><span className="font-medium">Mode:</span> {vendor.mode}</p>
                      <p className="text-sm text-gray-600"><span className="font-medium">Location:</span> {vendor.city}, {vendor.state} - {vendor.pincode}</p>
                      {vendor.rating && vendor.rating > 0 && (
                        <p className="text-sm text-gray-600"><span className="font-medium">Rating:</span> {vendor.rating}/5</p>
                      )}
                    </div>
                    <div className="mt-3">
                      <p className="text-xs text-gray-500">Added on {formatDate(vendor.createdAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex space-x-2">
                  <button onClick={() => handleEditVendor(vendor)} className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700">Edit</button>
                  <button onClick={() => handleDeleteVendor(vendor._id, vendor.companyName)} className="flex-1 bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showEditModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              {/* modal content (same as before) */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Edit Vendor</h3>
                  <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* form inputs omitted for brevity — reuse your existing modal form markup */}
                <div className="space-y-4">
                  {/* ... same inputs as before ... */}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button onClick={handleSaveVendor} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyVendors;
