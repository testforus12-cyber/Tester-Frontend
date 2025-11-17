// frontend/src/components/EditVendorModal.tsx
// STANDALONE VERSION - No hooks, just local state
import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';
import { clearDraft } from '../../src/store/draftStore';  // ← ADD THIS IMPORT
// =============================================================================
// TYPES
// =============================================================================

interface EditVendorModalProps {
  vendor: any;
  onClose: () => void;
  onSave: (updatedVendor: any) => void;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://tester-backend-4nxc.onrender.com').replace(/\/+$/, '');

function getAuthToken(): string {
  return (
    Cookies.get('authToken') ||
    localStorage.getItem('authToken') ||
    localStorage.getItem('token') ||
    ''
  );
}

// =============================================================================
// MAIN COMPONENT - COMPLETELY STANDALONE
// =============================================================================

export const EditVendorModal: React.FC<EditVendorModalProps> = ({ vendor, onClose, onSave }) => {
  console.log('📝 EditVendorModal opened with vendor:', vendor);

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCAL STATE - Manages all form data
  // ═══════════════════════════════════════════════════════════════════════════
  
  const [formData, setFormData] = useState({
    // Company Information
    legalCompanyName: '',
    companyName: '',
    subVendor: '',
    vendorCode: '',
    primaryContactName: '',
    primaryContactPhone: '',
    primaryContactEmail: '',
    vendorPhone: '',
    vendorEmail: '',
    gstNo: '',
    
    // Location
    pincode: '',
    state: '',
    city: '',
    address: '',
    
    // Transport
    mode: 'road' as 'road' | 'air' | 'rail' | 'ship',
    serviceModes: 'Road LTL',
    rating: 4.0,
    
    // Volumetric
    volumetricUnit: 'cm' as 'cm' | 'inch',
    volumetricDivisor: 5000,
    cftFactor: 6,
    
    // Charges
    minWeight: 0,
    docketCharges: 0,
    fuel: 0,
    minCharges: 0,
    greenTax: 0,
    daccCharges: 0,
    miscCharges: 0,
    hamaliCharges: 0,
    
    // Complex charges
    handlingCharges: { mode: 'fixed' as 'fixed' | 'variable', fixedAmount: 0, variablePercent: 0 },
    rovCharges: { mode: 'fixed' as 'fixed' | 'variable', fixedAmount: 0, variablePercent: 0 },
    codCharges: { mode: 'fixed' as 'fixed' | 'variable', fixedAmount: 0, variablePercent: 0 },
    toPayCharges: { mode: 'fixed' as 'fixed' | 'variable', fixedAmount: 0, variablePercent: 0 },
    appointmentCharges: { mode: 'fixed' as 'fixed' | 'variable', fixedAmount: 0, variablePercent: 0 },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // LOAD VENDOR DATA ON MOUNT
  // ═══════════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (!vendor) return;

    console.log('🔄 Loading vendor data into form:', vendor);

    const priceRate = vendor.prices?.priceRate || {};
    
    setFormData({
      // Company Information
      legalCompanyName: vendor.legalCompanyName || vendor.companyName || '',
      companyName: vendor.companyName || '',
      subVendor: vendor.subVendor || '',
      vendorCode: vendor.vendorCode || '',
      primaryContactName: vendor.primaryContactName || '',
      primaryContactPhone: vendor.primaryContactPhone?.toString() || '',
      primaryContactEmail: vendor.primaryContactEmail || '',
      vendorPhone: vendor.vendorPhone?.toString() || '',
      vendorEmail: vendor.vendorEmail || '',
      gstNo: vendor.gstNo || vendor.gstin || '',
      
      // Location
      pincode: vendor.pincode?.toString() || '',
      state: vendor.state || '',
      city: vendor.city || '',
      address: vendor.address || '',
      
      // Transport
      mode: (vendor.mode || 'road') as 'road' | 'air' | 'rail' | 'ship',
      serviceModes: vendor.serviceModes || 'Road LTL',
      rating: vendor.rating || 4.0,
      
      // Volumetric
      volumetricUnit: (priceRate.unit || 'cm') as 'cm' | 'inch',
      volumetricDivisor: priceRate.unit === 'cm' ? (priceRate.divisor || 5000) : 5000,
      cftFactor: priceRate.unit === 'inch' ? (priceRate.cftFactor || 6) : 6,
      
      // Charges
      minWeight: priceRate.minWeight || 0,
      docketCharges: priceRate.docketCharges || 0,
      fuel: priceRate.fuel || 0,
      minCharges: priceRate.minCharges || 0,
      greenTax: priceRate.greenTax || 0,
      daccCharges: priceRate.daccCharges || 0,
      miscCharges: priceRate.miscCharges || 0,
      hamaliCharges: priceRate.hamaliCharges || 0,
      
      // Complex charges
      handlingCharges: {
        mode: (priceRate.handlingCharges?.variable ? 'variable' : 'fixed') as 'fixed' | 'variable',
        fixedAmount: priceRate.handlingCharges?.fixed || 0,
        variablePercent: priceRate.handlingCharges?.variable || 0,
      },
      rovCharges: {
        mode: (priceRate.rovCharges?.variable ? 'variable' : 'fixed') as 'fixed' | 'variable',
        fixedAmount: priceRate.rovCharges?.fixed || 0,
        variablePercent: priceRate.rovCharges?.variable || 0,
      },
      codCharges: {
        mode: (priceRate.codCharges?.variable ? 'variable' : 'fixed') as 'fixed' | 'variable',
        fixedAmount: priceRate.codCharges?.fixed || 0,
        variablePercent: priceRate.codCharges?.variable || 0,
      },
      toPayCharges: {
        mode: (priceRate.toPayCharges?.variable ? 'variable' : 'fixed') as 'fixed' | 'variable',
        fixedAmount: priceRate.toPayCharges?.fixed || 0,
        variablePercent: priceRate.toPayCharges?.variable || 0,
      },
      appointmentCharges: {
        mode: (priceRate.appointmentCharges?.variable ? 'variable' : 'fixed') as 'fixed' | 'variable',
        fixedAmount: priceRate.appointmentCharges?.fixed || 0,
        variablePercent: priceRate.appointmentCharges?.variable || 0,
      },
    });

    console.log('✅ Vendor data loaded into form');
  }, [vendor]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLE INPUT CHANGES
  // ═══════════════════════════════════════════════════════════════════════════
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNestedChange = (parent: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent as keyof typeof prev] as any),
        [field]: value,
      },
    }));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLE SAVE
  // ═══════════════════════════════════════════════════════════════════════════
  
  const handleSave = async () => {
    console.log('💾 Save button clicked');
    console.log('📤 Current form data:', formData);
    
    try {
      setIsSubmitting(true);

      // Build payload matching backend schema
      const payload = {
        // Company Information
        legalCompanyName: formData.legalCompanyName || formData.companyName,
        companyName: formData.companyName,
        subVendor: formData.subVendor,
        vendorCode: formData.vendorCode,
        
        // Contact info
        primaryContactName: formData.primaryContactName,
        primaryContactPhone: formData.primaryContactPhone,
        primaryContactEmail: formData.primaryContactEmail,
        vendorPhone: parseInt(formData.vendorPhone) || 0,
        vendorEmail: formData.vendorEmail,
        gstNo: formData.gstNo,
        
        // Location
        pincode: parseInt(formData.pincode) || 0,
        state: formData.state,
        city: formData.city,
        address: formData.address,
        
        // Transport
        mode: formData.mode,
        serviceModes: formData.serviceModes,
        rating: parseFloat(formData.rating.toString()) || 4.0,
        
        // Prices
        prices: {
          priceRate: {
            unit: formData.volumetricUnit,
            divisor: formData.volumetricUnit === 'cm' ? formData.volumetricDivisor : null,
            cftFactor: formData.volumetricUnit === 'inch' ? formData.cftFactor : null,
            
            minWeight: parseFloat(formData.minWeight.toString()) || 0,
            docketCharges: parseFloat(formData.docketCharges.toString()) || 0,
            fuel: parseFloat(formData.fuel.toString()) || 0,
            minCharges: parseFloat(formData.minCharges.toString()) || 0,
            greenTax: parseFloat(formData.greenTax.toString()) || 0,
            daccCharges: parseFloat(formData.daccCharges.toString()) || 0,
            miscCharges: parseFloat(formData.miscCharges.toString()) || 0,
            hamaliCharges: parseFloat(formData.hamaliCharges.toString()) || 0,
            
            handlingCharges: {
              fixed: formData.handlingCharges.mode === 'fixed' ? (parseFloat(formData.handlingCharges.fixedAmount.toString()) || 0) : 0,
              variable: formData.handlingCharges.mode === 'variable' ? (parseFloat(formData.handlingCharges.variablePercent.toString()) || 0) : 0,
            },
            
            rovCharges: {
              fixed: formData.rovCharges.mode === 'fixed' ? (parseFloat(formData.rovCharges.fixedAmount.toString()) || 0) : 0,
              variable: formData.rovCharges.mode === 'variable' ? (parseFloat(formData.rovCharges.variablePercent.toString()) || 0) : 0,
            },
            
            codCharges: {
              fixed: formData.codCharges.mode === 'fixed' ? (parseFloat(formData.codCharges.fixedAmount.toString()) || 0) : 0,
              variable: formData.codCharges.mode === 'variable' ? (parseFloat(formData.codCharges.variablePercent.toString()) || 0) : 0,
            },
            
            toPayCharges: {
              fixed: formData.toPayCharges.mode === 'fixed' ? (parseFloat(formData.toPayCharges.fixedAmount.toString()) || 0) : 0,
              variable: formData.toPayCharges.mode === 'variable' ? (parseFloat(formData.toPayCharges.variablePercent.toString()) || 0) : 0,
            },
            
            appointmentCharges: {
              fixed: formData.appointmentCharges.mode === 'fixed' ? (parseFloat(formData.appointmentCharges.fixedAmount.toString()) || 0) : 0,
              variable: formData.appointmentCharges.mode === 'variable' ? (parseFloat(formData.appointmentCharges.variablePercent.toString()) || 0) : 0,
            },
          },
        },
      };

      console.log('📤 Sending payload to backend:', JSON.stringify(payload, null, 2));

      // Make API call
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/transporter/update-vendor/${vendor._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Update failed:', errorData);
        
        if (errorData.errors && Array.isArray(errorData.errors)) {
          toast.error(`Validation failed: ${errorData.errors.join(', ')}`);
        } else {
          toast.error(errorData.message || 'Failed to update vendor');
        }
        
        throw new Error(errorData.message || 'Failed to update vendor');
      }

      const data = await response.json();
      console.log('✅ Update successful:', data);

      clearDraft('edit');  // ← ADD THIS LINE (THE CRITICAL FIX!)

      toast.success('Vendor updated successfully!');
      onSave(data.data || data.vendor || payload);
      onClose();

    } catch (error: any) {
      console.error('❌ Error updating vendor:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER - Simple form with direct state binding
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Edit Vendor</h2>
            <p className="text-sm text-gray-600 mt-1">
              Update vendor information for {vendor.companyName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Body - Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Company Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Company Information</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Legal Company Name *
                </label>
                <input
                  type="text"
                  name="legalCompanyName"
                  value={formData.legalCompanyName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sub Vendor
                </label>
                <input
                  type="text"
                  name="subVendor"
                  value={formData.subVendor}
                  onChange={handleChange}
                  placeholder="Enter sub vendor"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Code *
                </label>
                <input
                  type="text"
                  name="vendorCode"
                  value={formData.vendorCode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Contact Name
                </label>
                <input
                  type="text"
                  name="primaryContactName"
                  value={formData.primaryContactName}
                  onChange={handleChange}
                  placeholder="Enter primary contact name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Contact Phone
                </label>
                <input
                  type="text"
                  name="primaryContactPhone"
                  value={formData.primaryContactPhone}
                  onChange={handleChange}
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Contact Email
                </label>
                <input
                  type="email"
                  name="primaryContactEmail"
                  value={formData.primaryContactEmail}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Phone *
                </label>
                <input
                  type="text"
                  name="vendorPhone"
                  value={formData.vendorPhone}
                  onChange={handleChange}
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Email *
                </label>
                <input
                  type="email"
                  name="vendorEmail"
                  value={formData.vendorEmail}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GST No. *
                </label>
                <input
                  type="text"
                  name="gstNo"
                  value={formData.gstNo}
                  onChange={handleChange}
                  maxLength={15}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pincode *
                </label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  maxLength={6}
                  placeholder="6-digit pincode"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State *
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address *
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Charges */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">💰 Price Rate Configuration</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Weight (kg)
                </label>
                <input
                  type="number"
                  name="minWeight"
                  value={formData.minWeight}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Docket Charges (₹)
                </label>
                <input
                  type="number"
                  name="docketCharges"
                  value={formData.docketCharges}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fuel Surcharge (%)
                </label>
                <input
                  type="number"
                  name="fuel"
                  value={formData.fuel}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Charges (₹)
                </label>
                <input
                  type="number"
                  name="minCharges"
                  value={formData.minCharges}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Footer - Action Buttons */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default EditVendorModal;

// import React, { useState, useEffect } from 'react';
// import { X, Info } from 'lucide-react';
// import toast from 'react-hot-toast';

// // Backend API configuration
// const API_BASE_URL = 'https://tester-backend-4nxc.onrender.com'; // Adjust to your backend URL

// interface EditVendorModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   vendor: any; // The vendor object from your list
//   onSuccess: () => void; // Callback to refresh vendor list
// }

// const EditVendorModal: React.FC<EditVendorModalProps> = ({
//   isOpen,
//   onClose,
//   vendor,
//   onSuccess,
// }) => {
//   // Form state matching your AddVendor structure
//   const [formData, setFormData] = useState({
//     // Company Information
//     legalCompanyName: '',
//     companyName: '',
//     subVendor: '',
//     vendorCode: '',
//     primaryContactName: '',
//     primaryContactPhone: '',
//     primaryContactEmail: '',
//     vendorPhone: '',
//     vendorEmail: '',
//     gstNo: '',
//     pincode: '',
//     state: '',
//     city: '',
//     address: '',
//     transportMode: 'road',
//     serviceMode: 'Road LTL', // 'Road LTL' or 'Road FTL'
//     rating: 3.0,

//     // Volumetric Configuration
//     volumetricUnit: 'cm', // 'cm' or 'inch'
//     volumetricDivisor: 2800,
//     cftFactor: 5,

//     // Price Rate Configuration - Basic
//     minChargeableWeight: 0,
//     docketCharges: 0,
//     fuelSurcharge: 15, // percentage
//     minimumCharges: 0,
//     greenTax: 0,
//     daccCharges: 0,
//     miscCharges: 0,
//     hamaliCharges: 0,

//     // Price Rate Configuration - Special Charges
//     handlingCharges: {
//       type: 'fixed', // 'fixed' or 'variable'
//       unit: 'per kg',
//       fixedRate: 0,
//       variableRate: 0,
//       weightThreshold: 1,
//     },
//     rovFovCharges: {
//       type: 'fixed',
//       fixedRate: 0,
//       variableRate: 0,
//     },
//     codDodCharges: {
//       type: 'fixed',
//       fixedRate: 0,
//       variableRate: 0,
//     },
//     toPayCharges: {
//       type: 'fixed',
//       fixedRate: 0,
//       variableRate: 0,
//     },
//     appointmentCharges: {
//       type: 'fixed',
//       fixedRate: 0,
//       variableRate: 0,
//     },
//   });

//   const [loading, setLoading] = useState(false);

//   // Load vendor data when modal opens
//   useEffect(() => {
//     if (isOpen && vendor) {
//       console.log('📝 EditVendorModal opened with vendor:', vendor);
//       loadVendorData();
//     }
//   }, [isOpen, vendor]);

//   const loadVendorData = () => {
//     console.log('🔄 Loading vendor data into edit modal:', vendor);
    
//     // Map vendor data to form structure
//     const mappedData = {
//       // Company Information
//       legalCompanyName: vendor.vendorName || vendor.legalCompanyName || '',
//       companyName: vendor.companyName || '',
//       subVendor: vendor.subVendor || '',
//       vendorCode: vendor.vendorCode || '',
//       primaryContactName: vendor.primaryContactName || '',
//       primaryContactPhone: vendor.primaryContactPhone || '',
//       primaryContactEmail: vendor.primaryContactEmail || '',
//       vendorPhone: vendor.vendorPhone?.toString() || '',
//       vendorEmail: vendor.vendorEmail || '',
//       gstNo: vendor.gstNo || vendor.gstin || '',
//       pincode: vendor.pincode?.toString() || vendor.location?.pincode || '',
//       state: vendor.state || vendor.location?.state || '',
//       city: vendor.city || vendor.location?.city || '',
//       address: vendor.address || '',
//       transportMode: vendor.mode || vendor.transportMode || 'road',
//       serviceMode: vendor.serviceMode || 'Road LTL',
//       rating: vendor.rating || 3.0,

//       // Volumetric Configuration
//       volumetricUnit: vendor.volumetric?.unit || 'cm',
//       volumetricDivisor: vendor.volumetric?.divisor || vendor.prices?.priceRate?.divisor || 2800,
//       cftFactor: vendor.volumetric?.cftFactor || 5,

//       // Price Rate Configuration - Basic
//       minChargeableWeight: vendor.charges?.minChargeableWeight || vendor.prices?.priceRate?.minWeight || 0,
//       docketCharges: vendor.charges?.docketCharges || vendor.prices?.priceRate?.docketCharges || 0,
//       fuelSurcharge: vendor.fuelSurcharge || vendor.prices?.priceRate?.fuel || 15,
//       minimumCharges: vendor.charges?.minimumCharges || vendor.prices?.priceRate?.minCharges || 0,
//       greenTax: vendor.charges?.greenTax || vendor.prices?.priceRate?.greenTax || 0,
//       daccCharges: vendor.charges?.daccCharges || vendor.prices?.priceRate?.daccCharges || 0,
//       miscCharges: vendor.charges?.miscCharges || vendor.prices?.priceRate?.miscellanousCharges || 0,
//       hamaliCharges: vendor.charges?.hamaliCharges || vendor.prices?.priceRate?.hamaliCharges || 0,

//       // Price Rate Configuration - Special Charges (Handling)
//       handlingCharges: {
//         type: vendor.prices?.priceRate?.handlingCharges?.fixed > 0 ? 'fixed' : 'variable',
//         unit: 'per kg',
//         fixedRate: vendor.prices?.priceRate?.handlingCharges?.fixed || 0,
//         variableRate: vendor.prices?.priceRate?.handlingCharges?.variable || 0,
//         weightThreshold: vendor.prices?.priceRate?.handlingCharges?.threshholdweight || 1,
//       },

//       // ROV/FOV Charges
//       rovFovCharges: {
//         type: vendor.prices?.priceRate?.rovCharges?.fixed > 0 ? 'fixed' : 'variable',
//         fixedRate: vendor.prices?.priceRate?.rovCharges?.fixed || 0,
//         variableRate: vendor.prices?.priceRate?.rovCharges?.variable || 0,
//       },

//       // COD/DOD Charges
//       codDodCharges: {
//         type: vendor.prices?.priceRate?.codCharges?.fixed > 0 ? 'fixed' : 'variable',
//         fixedRate: vendor.prices?.priceRate?.codCharges?.fixed || 0,
//         variableRate: vendor.prices?.priceRate?.codCharges?.variable || 0,
//       },

//       // To-Pay Charges
//       toPayCharges: {
//         type: vendor.prices?.priceRate?.topayCharges?.fixed > 0 ? 'fixed' : 'variable',
//         fixedRate: vendor.prices?.priceRate?.topayCharges?.fixed || 0,
//         variableRate: vendor.prices?.priceRate?.topayCharges?.variable || 0,
//       },

//       // Appointment Charges
//       appointmentCharges: {
//         type: vendor.prices?.priceRate?.appointmentCharges?.fixed > 0 ? 'fixed' : 'variable',
//         fixedRate: vendor.prices?.priceRate?.appointmentCharges?.fixed || 0,
//         variableRate: vendor.prices?.priceRate?.appointmentCharges?.variable || 0,
//       },
//     };

//     setFormData(mappedData);
//     console.log('✅ Vendor data loaded into edit modal');
//   };

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
//     const { name, value } = e.target;
//     setFormData(prev => ({ ...prev, [name]: value }));
//   };

//   const handleSpecialChargeChange = (
//     chargeType: 'handlingCharges' | 'rovFovCharges' | 'codDodCharges' | 'toPayCharges' | 'appointmentCharges',
//     field: string,
//     value: any
//   ) => {
//     setFormData(prev => ({
//       ...prev,
//       [chargeType]: {
//         ...prev[chargeType],
//         [field]: value,
//       },
//     }));
//   };

//   const handleSave = async () => {
//     try {
//       console.log('💾 Save button clicked');
//       setLoading(true);

//       // Prepare payload matching your backend structure
//       const payload = {
//         // Company Information
//         vendorName: formData.legalCompanyName,
//         legalCompanyName: formData.legalCompanyName,
//         companyName: formData.companyName,
//         subVendor: formData.subVendor,
//         vendorCode: formData.vendorCode,
//         primaryContactName: formData.primaryContactName,
//         primaryContactPhone: formData.primaryContactPhone,
//         primaryContactEmail: formData.primaryContactEmail,
//         vendorPhone: Number(formData.vendorPhone),
//         vendorEmail: formData.vendorEmail,
//         gstNo: formData.gstNo,
//         pincode: Number(formData.pincode),
//         state: formData.state,
//         city: formData.city,
//         address: formData.address,
//         mode: formData.transportMode,
//         transportMode: formData.transportMode,
//         serviceMode: formData.serviceMode,
//         rating: Number(formData.rating),

//         // Volumetric Configuration
//         volumetric: {
//           unit: formData.volumetricUnit,
//           divisor: formData.volumetricUnit === 'cm' ? Number(formData.volumetricDivisor) : 0,
//           cftFactor: formData.volumetricUnit === 'inch' ? Number(formData.cftFactor) : 0,
//         },

//         // Price Rate Configuration
//         charges: {
//           minChargeableWeight: Number(formData.minChargeableWeight),
//           docketCharges: Number(formData.docketCharges),
//           minimumCharges: Number(formData.minimumCharges),
//           hamaliCharges: Number(formData.hamaliCharges),
//           greenTax: Number(formData.greenTax),
//           miscCharges: Number(formData.miscCharges),
//           daccCharges: Number(formData.daccCharges),
//         },

//         fuelSurcharge: Number(formData.fuelSurcharge),

//         // Prices object for backend compatibility
//         prices: {
//           priceRate: {
//             minWeight: Number(formData.minChargeableWeight),
//             docketCharges: Number(formData.docketCharges),
//             fuel: Number(formData.fuelSurcharge),
//             minCharges: Number(formData.minimumCharges),
//             greenTax: Number(formData.greenTax),
//             daccCharges: Number(formData.daccCharges),
//             miscellanousCharges: Number(formData.miscCharges),
//             hamaliCharges: Number(formData.hamaliCharges),
//             divisor: formData.volumetricUnit === 'cm' ? Number(formData.volumetricDivisor) : 0,

//             // Special charges
//             handlingCharges: {
//               fixed: formData.handlingCharges.type === 'fixed' ? Number(formData.handlingCharges.fixedRate) : 0,
//               variable: formData.handlingCharges.type === 'variable' ? Number(formData.handlingCharges.variableRate) : 0,
//               threshholdweight: Number(formData.handlingCharges.weightThreshold),
//             },
//             rovCharges: {
//               fixed: formData.rovFovCharges.type === 'fixed' ? Number(formData.rovFovCharges.fixedRate) : 0,
//               variable: formData.rovFovCharges.type === 'variable' ? Number(formData.rovFovCharges.variableRate) : 0,
//             },
//             codCharges: {
//               fixed: formData.codDodCharges.type === 'fixed' ? Number(formData.codDodCharges.fixedRate) : 0,
//               variable: formData.codDodCharges.type === 'variable' ? Number(formData.codDodCharges.variableRate) : 0,
//             },
//             topayCharges: {
//               fixed: formData.toPayCharges.type === 'fixed' ? Number(formData.toPayCharges.fixedRate) : 0,
//               variable: formData.toPayCharges.type === 'variable' ? Number(formData.toPayCharges.variableRate) : 0,
//             },
//             appointmentCharges: {
//               fixed: formData.appointmentCharges.type === 'fixed' ? Number(formData.appointmentCharges.fixedRate) : 0,
//               variable: formData.appointmentCharges.type === 'variable' ? Number(formData.appointmentCharges.variableRate) : 0,
//             },
//           },
//         },
//       };

//       console.log('📤 Sending update request with payload:', payload);

//       // Get auth token (adjust based on how you store it)
//       const token = localStorage.getItem('token') || sessionStorage.getItem('token');

//       const response = await fetch(`${API_BASE_URL}/api/transporter/update-vendor/${vendor._id}`, {
//         method: 'PUT',
//         headers: {
//           'Content-Type': 'application/json',
//           ...(token && { 'Authorization': `Bearer ${token}` }),
//         },
//         body: JSON.stringify(payload),
//       });

//       console.log('📡 Response status:', response.status);

//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({}));
//         throw new Error(errorData.message || 'Failed to update vendor');
//       }

//       const data = await response.json();
//       console.log('✅ Update successful:', data);

//       toast.success('Vendor updated successfully!');
//       onSuccess(); // Refresh vendor list
//       onClose();
//     } catch (error: any) {
//       console.error('❌ Error updating vendor:', error);
//       const errorMessage = error.message || 'Failed to update vendor';
//       toast.error(errorMessage);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//       <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
//         {/* Header */}
//         <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
//           <div>
//             <h2 className="text-2xl font-bold text-gray-900">Edit Vendor</h2>
//             <p className="text-sm text-gray-600 mt-1">
//               Update vendor information for {vendor?.companyName || vendor?.vendorName}
//             </p>
//           </div>
//           <button
//             onClick={onClose}
//             className="text-gray-400 hover:text-gray-600 transition-colors"
//           >
//             <X size={24} />
//           </button>
//         </div>

//         {/* Form Content */}
//         <div className="p-6 space-y-6">
//           {/* Section 1: Company Information */}
//           <div className="border rounded-lg p-6">
//             <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
//               <span className="text-2xl">📋</span>
//               Company Information
//             </h3>

//             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//               {/* Row 1 */}
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Legal Company Name *
//                 </label>
//                 <input
//                   type="text"
//                   name="legalCompanyName"
//                   value={formData.legalCompanyName}
//                   onChange={handleChange}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Company Name *
//                 </label>
//                 <input
//                   type="text"
//                   name="companyName"
//                   value={formData.companyName}
//                   onChange={handleChange}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Sub Vendor
//                 </label>
//                 <input
//                   type="text"
//                   name="subVendor"
//                   value={formData.subVendor}
//                   onChange={handleChange}
//                   placeholder="Enter sub vendor"
//                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               {/* Row 2 */}
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Vendor Code *
//                 </label>
//                 <input
//                   type="text"
//                   name="vendorCode"
//                   value={formData.vendorCode}
//                   onChange={handleChange}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Primary Contact Name
//                 </label>
//                 <input
//                   type="text"
//                   name="primaryContactName"
//                   value={formData.primaryContactName}
//                   onChange={handleChange}
//                   placeholder="Enter primary contact name"
//                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Primary Contact Phone
//                 </label>
//                 <input
//                   type="tel"
//                   name="primaryContactPhone"
//                   value={formData.primaryContactPhone}
//                   onChange={handleChange}
//                   maxLength={10}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               {/* Row 3 */}
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Primary Contact Email
//                 </label>
//                 <input
//                   type="email"
//                   name="primaryContactEmail"
//                   value={formData.primaryContactEmail}
//                   onChange={handleChange}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Vendor Phone *
//                 </label>
//                 <input
//                   type="tel"
//                   name="vendorPhone"
//                   value={formData.vendorPhone}
//                   onChange={handleChange}
//                   maxLength={10}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Vendor Email *
//                 </label>
//                 <input
//                   type="email"
//                   name="vendorEmail"
//                   value={formData.vendorEmail}
//                   onChange={handleChange}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               {/* Row 4 */}
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   GST No. *
//                 </label>
//                 <input
//                   type="text"
//                   name="gstNo"
//                   value={formData.gstNo}
//                   onChange={handleChange}
//                   maxLength={15}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Pincode (6 digits) *
//                 </label>
//                 <input
//                   type="text"
//                   name="pincode"
//                   value={formData.pincode}
//                   onChange={handleChange}
//                   maxLength={6}
//                   placeholder="6-digit pincode"
//                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   State *
//                 </label>
//                 <input
//                   type="text"
//                   name="state"
//                   value={formData.state}
//                   onChange={handleChange}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               {/* Row 5 */}
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   City *
//                 </label>
//                 <input
//                   type="text"
//                   name="city"
//                   value={formData.city}
//                   onChange={handleChange}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               <div className="md:col-span-2">
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Address *
//                 </label>
//                 <textarea
//                   name="address"
//                   value={formData.address}
//                   onChange={handleChange}
//                   rows={2}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 />
//               </div>

//               {/* Row 6 */}
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Transport Mode *
//                 </label>
//                 <select
//                   name="transportMode"
//                   value={formData.transportMode}
//                   onChange={handleChange}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 >
//                   <option value="road">Road</option>
//                   <option value="air" disabled>Air - Coming Soon</option>
//                   <option value="rail" disabled>Rail - Coming Soon</option>
//                   <option value="ship" disabled>Ship - Coming Soon</option>
//                 </select>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Service Modes *
//                 </label>
//                 <div className="flex items-center gap-4 mt-2">
//                   <label className="flex items-center gap-2 cursor-pointer">
//                     <input
//                       type="radio"
//                       name="serviceMode"
//                       value="Road LTL"
//                       checked={formData.serviceMode === 'Road LTL'}
//                       onChange={handleChange}
//                       className="w-4 h-4 text-blue-600"
//                     />
//                     <span className="text-sm text-gray-700">Road LTL</span>
//                   </label>
//                   <label className="flex items-center gap-2 cursor-pointer">
//                     <input
//                       type="radio"
//                       name="serviceMode"
//                       value="Road FTL"
//                       checked={formData.serviceMode === 'Road FTL'}
//                       onChange={handleChange}
//                       className="w-4 h-4 text-blue-600"
//                     />
//                     <span className="text-sm text-gray-700">Road FTL</span>
//                   </label>
//                 </div>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Company Rating
//                 </label>
//                 <div className="flex items-center gap-3">
//                   <input
//                     type="range"
//                     name="rating"
//                     min="0"
//                     max="5"
//                     step="0.5"
//                     value={formData.rating}
//                     onChange={handleChange}
//                     className="flex-1"
//                   />
//                   <span className="text-sm font-semibold text-blue-600 min-w-[60px]">
//                     {formData.rating.toFixed(1)} / 5
//                   </span>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Section 2: Volumetric Configuration */}
//           <div className="border rounded-lg p-6">
//             <h3 className="text-lg font-semibold text-gray-800 mb-4">
//               Volumetric Configuration
//             </h3>

//             <div className="space-y-4">
//               {/* Unit Toggle */}
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-2">
//                   Volumetric Unit *
//                 </label>
//                 <div className="flex gap-2">
//                   <button
//                     type="button"
//                     onClick={() => setFormData(prev => ({ ...prev, volumetricUnit: 'cm' }))}
//                     className={`px-4 py-2 rounded-lg font-medium transition-colors ${
//                       formData.volumetricUnit === 'cm'
//                         ? 'bg-blue-600 text-white'
//                         : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
//                     }`}
//                   >
//                     Centimeters (cm)
//                   </button>
//                   <button
//                     type="button"
//                     onClick={() => setFormData(prev => ({ ...prev, volumetricUnit: 'inch' }))}
//                     className={`px-4 py-2 rounded-lg font-medium transition-colors ${
//                       formData.volumetricUnit === 'inch'
//                         ? 'bg-blue-600 text-white'
//                         : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
//                     }`}
//                   >
//                     Inches (in)
//                   </button>
//                 </div>
//               </div>

//               {/* Dynamic Field based on unit */}
//               {formData.volumetricUnit === 'cm' ? (
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Volumetric Divisor *
//                   </label>
//                   <select
//                     name="volumetricDivisor"
//                     value={formData.volumetricDivisor}
//                     onChange={handleChange}
//                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                   >
//                     <option value="2800">2800 cm³</option>
//                     <option value="3000">3000 cm³</option>
//                     <option value="4000">4000 cm³</option>
//                     <option value="5000">5000 cm³</option>
//                     <option value="6000">6000 cm³</option>
//                   </select>
//                   <p className="text-xs text-gray-500 mt-1">
//                     Volumetric weight = (L × W × H) / Divisor
//                   </p>
//                 </div>
//               ) : (
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     CFT Factor *
//                   </label>
//                   <select
//                     name="cftFactor"
//                     value={formData.cftFactor}
//                     onChange={handleChange}
//                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                   >
//                     <option value="4">4</option>
//                     <option value="5">5</option>
//                     <option value="6">6</option>
//                     <option value="7">7</option>
//                     <option value="8">8</option>
//                     <option value="9">9</option>
//                     <option value="10">10</option>
//                   </select>
//                   <p className="text-xs text-gray-500 mt-1">
//                     Volumetric weight = (L × W × H / 1728) × CFT Factor
//                   </p>
//                 </div>
//               )}

//               <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
//                 <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
//                 <p className="text-xs text-blue-800">
//                   The divisor determines how much space is considered per unit of weight. This field
//                   changes based on the selected volumetric unit. When you switch units, the other
//                   value is cleared automatically to avoid ambiguity.
//                 </p>
//               </div>
//             </div>
//           </div>

//           {/* Section 3: Price Rate Configuration */}
//           <div className="border rounded-lg p-6">
//             <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
//               <span className="text-2xl">🔥</span>
//               Price Rate Configuration
//             </h3>

//             {/* Basic Charges Grid */}
//             <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Min Chargeable Weight (kg) *
//                 </label>
//                 <div className="relative">
//                   <input
//                     type="number"
//                     name="minChargeableWeight"
//                     value={formData.minChargeableWeight}
//                     onChange={handleChange}
//                     min="0"
//                     step="0.1"
//                     className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                   />
//                   <span className="absolute right-3 top-2 text-gray-500 text-sm">KG</span>
//                 </div>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Docket Charges (₹) *
//                 </label>
//                 <div className="relative">
//                   <input
//                     type="number"
//                     name="docketCharges"
//                     value={formData.docketCharges}
//                     onChange={handleChange}
//                     min="0"
//                     step="0.01"
//                     className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                   />
//                   <span className="absolute right-3 top-2 text-gray-500 text-sm">₹</span>
//                 </div>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Fuel Surcharge (%) *
//                 </label>
//                 <select
//                   name="fuelSurcharge"
//                   value={formData.fuelSurcharge}
//                   onChange={handleChange}
//                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 >
//                   <option value="0">0%</option>
//                   <option value="5">5%</option>
//                   <option value="10">10%</option>
//                   <option value="15">15%</option>
//                   <option value="20">20%</option>
//                   <option value="25">25%</option>
//                 </select>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Minimum Charges (₹) *
//                 </label>
//                 <div className="relative">
//                   <input
//                     type="number"
//                     name="minimumCharges"
//                     value={formData.minimumCharges}
//                     onChange={handleChange}
//                     min="0"
//                     step="0.01"
//                     className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                   />
//                   <span className="absolute right-3 top-2 text-gray-500 text-sm">₹</span>
//                 </div>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Green Tax (₹)/NGT Charge *
//                 </label>
//                 <div className="relative">
//                   <input
//                     type="number"
//                     name="greenTax"
//                     value={formData.greenTax}
//                     onChange={handleChange}
//                     min="0"
//                     step="0.01"
//                     className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                   />
//                   <span className="absolute right-3 top-2 text-gray-500 text-sm">₹</span>
//                 </div>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   DACC Charges (₹) *
//                 </label>
//                 <div className="relative">
//                   <input
//                     type="number"
//                     name="daccCharges"
//                     value={formData.daccCharges}
//                     onChange={handleChange}
//                     min="0"
//                     step="0.01"
//                     className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                   />
//                   <span className="absolute right-3 top-2 text-gray-500 text-sm">₹</span>
//                 </div>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Miscellaneous/AOC Charges (₹) *
//                 </label>
//                 <div className="relative">
//                   <input
//                     type="number"
//                     name="miscCharges"
//                     value={formData.miscCharges}
//                     onChange={handleChange}
//                     min="0"
//                     step="0.01"
//                     className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                   />
//                   <span className="absolute right-3 top-2 text-gray-500 text-sm">₹</span>
//                 </div>
//               </div>

//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">
//                   Hamali Charges (₹) *
//                 </label>
//                 <div className="relative">
//                   <input
//                     type="number"
//                     name="hamaliCharges"
//                     value={formData.hamaliCharges}
//                     onChange={handleChange}
//                     min="0"
//                     step="0.01"
//                     className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                   />
//                   <span className="absolute right-3 top-2 text-gray-500 text-sm">₹</span>
//                 </div>
//               </div>
//             </div>

//             {/* Special Charges Cards */}
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//               {/* Handling Charges */}
//               <div className="border rounded-lg p-4">
//                 <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
//                   Handling
//                   <Info size={14} className="text-gray-400" />
//                 </label>

//                 <div className="space-y-3">
//                   <select
//                     value={formData.handlingCharges.unit}
//                     onChange={(e) => handleSpecialChargeChange('handlingCharges', 'unit', e.target.value)}
//                     className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
//                   >
//                     <option value="per kg">Per Kg</option>
//                   </select>

//                   <div className="flex gap-2">
//                     <button
//                       type="button"
//                       onClick={() => handleSpecialChargeChange('handlingCharges', 'type', 'fixed')}
//                       className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
//                         formData.handlingCharges.type === 'fixed'
//                           ? 'bg-blue-600 text-white'
//                           : 'bg-gray-200 text-gray-700'
//                       }`}
//                     >
//                       Fixed ₹
//                     </button>
//                     <button
//                       type="button"
//                       onClick={() => handleSpecialChargeChange('handlingCharges', 'type', 'variable')}
//                       className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
//                         formData.handlingCharges.type === 'variable'
//                           ? 'bg-blue-600 text-white'
//                           : 'bg-gray-200 text-gray-700'
//                       }`}
//                     >
//                       Variable %
//                     </button>
//                   </div>

//                   <div>
//                     <label className="block text-xs text-gray-600 mb-1">Fixed Rate</label>
//                     <div className="relative">
//                       <input
//                         type="number"
//                         value={formData.handlingCharges.fixedRate}
//                         onChange={(e) => handleSpecialChargeChange('handlingCharges', 'fixedRate', e.target.value)}
//                         disabled={formData.handlingCharges.type === 'variable'}
//                         className="w-full px-3 py-1.5 pr-8 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100"
//                       />
//                       <span className="absolute right-3 top-1.5 text-gray-500 text-xs">₹</span>
//                     </div>
//                   </div>

//                   <div>
//                     <label className="block text-xs text-gray-600 mb-1">Weight Threshold (KG)</label>
//                     <div className="relative">
//                       <input
//                         type="number"
//                         value={formData.handlingCharges.weightThreshold}
//                         onChange={(e) => handleSpecialChargeChange('handlingCharges', 'weightThreshold', e.target.value)}
//                         className="w-full px-3 py-1.5 pr-8 text-sm border border-gray-300 rounded-lg"
//                       />
//                       <span className="absolute right-3 top-1.5 text-gray-500 text-xs">KG</span>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               {/* ROV/FOV Charges */}
//               <div className="border rounded-lg p-4">
//                 <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
//                   ROV / FOV
//                   <Info size={14} className="text-gray-400" />
//                 </label>

//                 <div className="space-y-3">
//                   <div className="flex gap-2">
//                     <button
//                       type="button"
//                       onClick={() => handleSpecialChargeChange('rovFovCharges', 'type', 'fixed')}
//                       className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
//                         formData.rovFovCharges.type === 'fixed'
//                           ? 'bg-blue-600 text-white'
//                           : 'bg-gray-200 text-gray-700'
//                       }`}
//                     >
//                       Fixed ₹
//                     </button>
//                     <button
//                       type="button"
//                       onClick={() => handleSpecialChargeChange('rovFovCharges', 'type', 'variable')}
//                       className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
//                         formData.rovFovCharges.type === 'variable'
//                           ? 'bg-blue-600 text-white'
//                           : 'bg-gray-200 text-gray-700'
//                       }`}
//                     >
//                       Variable %
//                     </button>
//                   </div>

//                   <div>
//                     <label className="block text-xs text-gray-600 mb-1">Fixed Rate</label>
//                     <div className="relative">
//                       <input
//                         type="number"
//                         value={formData.rovFovCharges.fixedRate}
//                         onChange={(e) => handleSpecialChargeChange('rovFovCharges', 'fixedRate', e.target.value)}
//                         disabled={formData.rovFovCharges.type === 'variable'}
//                         className="w-full px-3 py-1.5 pr-8 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100"
//                       />
//                       <span className="absolute right-3 top-1.5 text-gray-500 text-xs">₹</span>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               {/* COD/DOD Charges */}
//               <div className="border rounded-lg p-4">
//                 <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
//                   COD / DOD
//                   <Info size={14} className="text-gray-400" />
//                 </label>

//                 <div className="space-y-3">
//                   <div className="flex gap-2">
//                     <button
//                       type="button"
//                       onClick={() => handleSpecialChargeChange('codDodCharges', 'type', 'fixed')}
//                       className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
//                         formData.codDodCharges.type === 'fixed'
//                           ? 'bg-blue-600 text-white'
//                           : 'bg-gray-200 text-gray-700'
//                       }`}
//                     >
//                       Fixed ₹
//                     </button>
//                     <button
//                       type="button"
//                       onClick={() => handleSpecialChargeChange('codDodCharges', 'type', 'variable')}
//                       className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
//                         formData.codDodCharges.type === 'variable'
//                           ? 'bg-blue-600 text-white'
//                           : 'bg-gray-200 text-gray-700'
//                       }`}
//                     >
//                       Variable %
//                     </button>
//                   </div>

//                   <div>
//                     <label className="block text-xs text-gray-600 mb-1">Fixed Rate</label>
//                     <div className="relative">
//                       <input
//                         type="number"
//                         value={formData.codDodCharges.fixedRate}
//                         onChange={(e) => handleSpecialChargeChange('codDodCharges', 'fixedRate', e.target.value)}
//                         disabled={formData.codDodCharges.type === 'variable'}
//                         className="w-full px-3 py-1.5 pr-8 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100"
//                       />
//                       <span className="absolute right-3 top-1.5 text-gray-500 text-xs">₹</span>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               {/* To-Pay Charges */}
//               <div className="border rounded-lg p-4">
//                 <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
//                   To-Pay
//                   <Info size={14} className="text-gray-400" />
//                 </label>

//                 <div className="space-y-3">
//                   <div className="flex gap-2">
//                     <button
//                       type="button"
//                       onClick={() => handleSpecialChargeChange('toPayCharges', 'type', 'fixed')}
//                       className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
//                         formData.toPayCharges.type === 'fixed'
//                           ? 'bg-blue-600 text-white'
//                           : 'bg-gray-200 text-gray-700'
//                       }`}
//                     >
//                       Fixed ₹
//                     </button>
//                     <button
//                       type="button"
//                       onClick={() => handleSpecialChargeChange('toPayCharges', 'type', 'variable')}
//                       className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
//                         formData.toPayCharges.type === 'variable'
//                           ? 'bg-blue-600 text-white'
//                           : 'bg-gray-200 text-gray-700'
//                       }`}
//                     >
//                       Variable %
//                     </button>
//                   </div>

//                   <div>
//                     <label className="block text-xs text-gray-600 mb-1">Fixed Rate</label>
//                     <div className="relative">
//                       <input
//                         type="number"
//                         value={formData.toPayCharges.fixedRate}
//                         onChange={(e) => handleSpecialChargeChange('toPayCharges', 'fixedRate', e.target.value)}
//                         disabled={formData.toPayCharges.type === 'variable'}
//                         className="w-full px-3 py-1.5 pr-8 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100"
//                       />
//                       <span className="absolute right-3 top-1.5 text-gray-500 text-xs">₹</span>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               {/* Appointment Charges */}
//               <div className="border rounded-lg p-4">
//                 <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
//                   Appointment
//                   <Info size={14} className="text-gray-400" />
//                 </label>

//                 <div className="space-y-3">
//                   <div className="flex gap-2">
//                     <button
//                       type="button"
//                       onClick={() => handleSpecialChargeChange('appointmentCharges', 'type', 'fixed')}
//                       className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
//                         formData.appointmentCharges.type === 'fixed'
//                           ? 'bg-blue-600 text-white'
//                           : 'bg-gray-200 text-gray-700'
//                       }`}
//                     >
//                       Fixed ₹
//                     </button>
//                     <button
//                       type="button"
//                       onClick={() => handleSpecialChargeChange('appointmentCharges', 'type', 'variable')}
//                       className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
//                         formData.appointmentCharges.type === 'variable'
//                           ? 'bg-blue-600 text-white'
//                           : 'bg-gray-200 text-gray-700'
//                       }`}
//                     >
//                       Variable %
//                     </button>
//                   </div>

//                   <div>
//                     <label className="block text-xs text-gray-600 mb-1">Fixed Rate</label>
//                     <div className="relative">
//                       <input
//                         type="number"
//                         value={formData.appointmentCharges.fixedRate}
//                         onChange={(e) => handleSpecialChargeChange('appointmentCharges', 'fixedRate', e.target.value)}
//                         disabled={formData.appointmentCharges.type === 'variable'}
//                         className="w-full px-3 py-1.5 pr-8 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100"
//                       />
//                       <span className="absolute right-3 top-1.5 text-gray-500 text-xs">₹</span>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Footer */}
//         <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
//           <button
//             onClick={onClose}
//             disabled={loading}
//             className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
//           >
//             Cancel
//           </button>
//           <button
//             onClick={handleSave}
//             disabled={loading}
//             className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
//           >
//             {loading ? (
//               <>
//                 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
//                 Saving...
//               </>
//             ) : (
//               <>
//                 <span>💾</span>
//                 Save Changes
//               </>
//             )}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default EditVendorModal;