// src/components/EditVendorModal.tsx
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { X } from 'lucide-react';
import Cookies from 'js-cookie';

interface VendorLocation {
  city: string;
  state: string;
  pincode: string;
  address?: string;
}

interface VendorCharges {
  docketCharges: number;
  minChargeableWeight: number;
  minimumCharges: number;
  hamaliCharges: number;
  greenTax: number;
  miscCharges: number;
  codCharges: number;
  dodCharges: number;
  toPayCharges: number;
  [key: string]: number;
}

interface Volumetric {
  unit: 'cm' | 'inch';
  divisor: number;
  cftFactor: number;
}

interface FormState {
  companyName: string;
  displayName: string;
  vendorCode: string;
  contactPersonName: string;
  vendorPhoneNumber: string; // string for input
  vendorEmailAddress: string;
  gstin: string;
  address: string;
  transportMode: 'road' | 'air' | 'rail' | 'ship';
  rating: number;
  location: VendorLocation;
  zoneRates: Record<string, any>;
  charges: VendorCharges;
  volumetric: Volumetric;
}

interface EditVendorModalProps {
  vendor: any | null;
  onClose: () => void;
  onSave: (updatedVendor: any) => void;
}

const defaultFormState: FormState = {
  companyName: '',
  displayName: '',
  vendorCode: '',
  contactPersonName: '',
  vendorPhoneNumber: '',
  vendorEmailAddress: '',
  gstin: '',
  address: '',
  transportMode: 'road',
  rating: 0,
  location: { city: '', state: '', pincode: '' },
  zoneRates: {},
  charges: {
    docketCharges: 0,
    minChargeableWeight: 0,
    minimumCharges: 0,
    hamaliCharges: 0,
    greenTax: 0,
    miscCharges: 0,
    codCharges: 0,
    dodCharges: 0,
    toPayCharges: 0,
  },
  volumetric: { unit: 'cm', divisor: 0, cftFactor: 0 },
};

function getAuthTokenFromStorage(): string {
  return (
    Cookies.get('authToken') ||
    localStorage.getItem('authToken') ||
    localStorage.getItem('token') ||
    ''
  );
}

const EditVendorModal: React.FC<EditVendorModalProps> = ({ vendor, onClose, onSave }) => {
  const [formData, setFormData] = useState<FormState>(defaultFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!vendor) {
      setFormData(defaultFormState);
      return;
    }

    setFormData({
      companyName: vendor.companyName || vendor.name || '',
      displayName: vendor.displayName || vendor.companyName || '',
      vendorCode: vendor.vendorCode || vendor.code || '',
      contactPersonName:
        vendor.contactPersonName || vendor.contact || vendor.contactPersonName || '',
      vendorPhoneNumber:
        vendor.vendorPhoneNumber ||
        vendor.vendorPhone ||
        vendor.phone ||
        String(vendor.vendorPhoneNumber ?? '') ||
        '',
      vendorEmailAddress:
        vendor.vendorEmailAddress || vendor.email || vendor.vendorEmail || '',
      gstin: vendor.gstin || vendor.gst || '',
      address: vendor.address || vendor.location?.address || '',
      transportMode:
        (vendor.transportMode as 'road' | 'air' | 'rail' | 'ship') ||
        (vendor.mode as 'road' | 'air' | 'rail' | 'ship') ||
        'road',
      rating: Number(vendor.rating ?? 0),
      location: {
        city: vendor.location?.city || vendor.city || '',
        state: vendor.location?.state || vendor.state || '',
        pincode: vendor.location?.pincode ?? vendor.pincode ?? '',
      },
      zoneRates: vendor.zoneRates || vendor.prices || {},
      charges: {
        docketCharges: Number(vendor.charges?.docketCharges ?? vendor.docketCharges ?? 0),
        minChargeableWeight: Number(vendor.charges?.minChargeableWeight ?? 0),
        minimumCharges: Number(vendor.charges?.minimumCharges ?? 0),
        hamaliCharges: Number(vendor.charges?.hamaliCharges ?? 0),
        greenTax: Number(vendor.charges?.greenTax ?? 0),
        miscCharges: Number(vendor.charges?.miscCharges ?? 0),
        codCharges: Number(vendor.charges?.codCharges ?? 0),
        dodCharges: Number(vendor.charges?.dodCharges ?? 0),
        toPayCharges: Number(vendor.charges?.toPayCharges ?? 0),
      },
      volumetric: {
        unit: vendor.volumetric?.unit === 'inch' ? 'inch' : 'cm',
        divisor: Number(vendor.volumetric?.divisor ?? 0),
        cftFactor: Number(vendor.volumetric?.cftFactor ?? 0),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const name = e.target.name;
    const rawValue = e.target.value;

    if (name.startsWith('location.')) {
      const [, field] = name.split('.');
      setFormData((prev) => ({ ...prev, location: { ...prev.location, [field]: rawValue } }));
      if (errors[name]) clearFieldError(name);
      return;
    }

    if (name.startsWith('charges.')) {
      const [, field] = name.split('.');
      const num = rawValue === '' ? 0 : Number(rawValue);
      setFormData((prev) => ({
        ...prev,
        charges: { ...prev.charges, [field]: Number.isFinite(num) ? num : 0 },
      }));
      if (errors[name]) clearFieldError(name);
      return;
    }

    if (name.startsWith('volumetric.')) {
      const [, field] = name.split('.');
      const num = rawValue === '' ? 0 : Number(rawValue);
      if (field === 'unit') {
        const unit = rawValue === 'inch' ? 'inch' : 'cm';
        setFormData((prev) => ({ ...prev, volumetric: { ...prev.volumetric, unit } }));
      } else {
        setFormData((prev) => ({
          ...prev,
          volumetric: { ...prev.volumetric, [field]: Number.isFinite(num) ? num : 0 } as Volumetric,
        }));
      }
      if (errors[name]) clearFieldError(name);
      return;
    }

    if (name === 'rating') {
      const n = Number(rawValue || 0);
      setFormData((prev) => ({ ...prev, rating: Number.isFinite(n) ? n : 0 }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: rawValue }));
    }

    if (errors[name]) clearFieldError(name);
  };

  const clearFieldError = (fieldName: string) => {
    setErrors((prev) => {
      if (!prev[fieldName]) return prev;
      const copy = { ...prev };
      delete copy[fieldName];
      return copy;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.companyName.trim()) newErrors.companyName = 'Company name is required';
    if (!formData.contactPersonName.trim())
      newErrors.contactPersonName = 'Contact person name is required';

    if (!formData.vendorPhoneNumber.trim()) newErrors.vendorPhoneNumber = 'Phone number is required';
    else if (!/^\d{10}$/.test(formData.vendorPhoneNumber))
      newErrors.vendorPhoneNumber = 'Phone number must be 10 digits';
    else if (formData.vendorPhoneNumber.startsWith('0'))
      newErrors.vendorPhoneNumber = 'Phone number cannot start with 0';

    if (!formData.vendorEmailAddress.trim()) newErrors.vendorEmailAddress = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.vendorEmailAddress))
      newErrors.vendorEmailAddress = 'Invalid email format';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    setIsSubmitting(true);
    try {
      const vendorId = vendor?._id ?? vendor?.id;
      if (!vendorId) throw new Error('Missing vendor id');

      // normalize phone/pincode to numeric top-level fields expected by backend
      const normalizedPhoneStr = String(formData.vendorPhoneNumber ?? '').replace(/\D+/g, '');
      const numericPhone = normalizedPhoneStr ? Number(normalizedPhoneStr) : 0;

      const normalizedPinStr = String(formData.location?.pincode ?? '').replace(/\D+/g, '');
      const numericPin = normalizedPinStr ? Number(normalizedPinStr) : 0;

      // Build payload: include both string and numeric variants for compatibility
      const payloadToSend = {
        // keep form as-is
        ...formData,
        // normalized numeric fields (top-level)
        vendorPhone: numericPhone,
        pincode: numericPin,
        // preserve nested location (string pincode)
        location: { ...(formData.location || {}), pincode: String(formData.location?.pincode ?? '') },
      };

      const API_URL = (import.meta.env.VITE_API_URL as string) || 'https://tester-backend-4nxc.onrender.com';
      const token = getAuthTokenFromStorage();

      if (!token) {
        toast.error('Not authenticated — please login and try again.');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/transporter/update-vendor/${vendorId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(payloadToSend),
      });

      const result = await response.json().catch(() => ({} as any));

      if (response.status === 401) {
        toast.error('Unauthorized — please login and try again.');
        setIsSubmitting(false);
        return;
      }

      if (!response.ok) {
        throw new Error(result?.message || `Failed to update vendor (${response.status})`);
      }

      toast.success('Vendor updated successfully!');
      onSave(result.vendor ?? result.data ?? { ...formData, _id: vendorId });
      onClose();
    } catch (err: any) {
      console.error('Error updating vendor:', err);
      toast.error(err?.message || 'Failed to update vendor. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!vendor) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            <p className="text-gray-700">Loading vendor data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Vendor</h2>
            <p className="text-sm text-gray-500 mt-1">
              Update vendor information for {vendor.companyName ?? 'this vendor'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Company Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.companyName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    maxLength={60}
                  />
                  {errors.companyName && <p className="mt-1 text-xs text-red-500">{errors.companyName}</p>}
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    maxLength={30}
                  />
                </div>

                {/* Vendor Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Code</label>
                  <input
                    type="text"
                    name="vendorCode"
                    value={formData.vendorCode}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    maxLength={20}
                  />
                </div>

                {/* Transport Mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transport Mode <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="transportMode"
                    value={formData.transportMode}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="road">Road</option>
                    <option value="air">Air</option>
                    <option value="rail">Rail</option>
                    <option value="ship">Ship</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contact Person Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Person Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="contactPersonName"
                    value={formData.contactPersonName}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.contactPersonName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    maxLength={30}
                  />
                  {errors.contactPersonName && (
                    <p className="mt-1 text-xs text-red-500">{errors.contactPersonName}</p>
                  )}
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="vendorPhoneNumber"
                    value={formData.vendorPhoneNumber}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.vendorPhoneNumber ? 'border-red-500' : 'border-gray-300'
                    }`}
                    maxLength={10}
                    placeholder="10-digit phone number"
                  />
                  {errors.vendorPhoneNumber && (
                    <p className="mt-1 text-xs text-red-500">{errors.vendorPhoneNumber}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="vendorEmailAddress"
                    value={formData.vendorEmailAddress}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.vendorEmailAddress ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="vendor@example.com"
                  />
                  {errors.vendorEmailAddress && (
                    <p className="mt-1 text-xs text-red-500">{errors.vendorEmailAddress}</p>
                  )}
                </div>

                {/* GST Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                  <input
                    type="text"
                    name="gstin"
                    value={formData.gstin}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    maxLength={15}
                    placeholder="e.g., 29ABCDE1234F1Z5"
                  />
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Address Information</h3>
              <div className="grid grid-cols-1 gap-4">
                {/* Full Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    maxLength={150}
                    placeholder="Enter complete address"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* City */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      name="location.city"
                      value={formData.location.city}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      name="location.state"
                      value={formData.location.state}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Pincode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                    <input
                      type="text"
                      name="location.pincode"
                      value={formData.location.pincode}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      maxLength={6}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Charges (Optional - Collapsible) */}
            <details className="border border-gray-200 rounded-lg">
              <summary className="px-4 py-3 cursor-pointer font-medium text-gray-900 hover:bg-gray-50">
                Additional Charges (Optional)
              </summary>
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Docket Charges (₹)</label>
                  <input
                    type="number"
                    name="charges.docketCharges"
                    value={formData.charges.docketCharges}
                    onChange={handleChange}
                    min={0}
                    max={10000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hamali Charges (₹)</label>
                  <input
                    type="number"
                    name="charges.hamaliCharges"
                    value={formData.charges.hamaliCharges}
                    onChange={handleChange}
                    min={0}
                    max={10000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Green Tax (₹)</label>
                  <input
                    type="number"
                    name="charges.greenTax"
                    value={formData.charges.greenTax}
                    onChange={handleChange}
                    min={0}
                    max={10000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </details>
          </div>
        </form>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditVendorModal;
