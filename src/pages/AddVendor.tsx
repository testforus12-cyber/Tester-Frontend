// src/pages/AddVendor.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';

// Hooks (keep your originals)
import { useVendorBasics } from '../hooks/useVendorBasics';
import { usePincodeLookup } from '../hooks/usePincodeLookup';
import { useVolumetric } from '../hooks/useVolumetric';
import { useCharges } from '../hooks/useCharges';

// ✅ NEW: Wizard storage hook
import { useWizardStorage } from '../hooks/useWizardStorage';

// Components (keep your originals)
import { CompanySection } from '../components/CompanySection';
import { TransportSection } from '../components/TransportSection';
import { ChargesSection } from '../components/ChargesSection';
import { PriceChartUpload } from '../components/PriceChartUpload';
import { SavedVendorsTable } from '../components/SavedVendorsTable';

// Utils (unchanged)
import { readDraft, clearDraft } from '../store/draftStore';
import { emitDebug, emitDebugError } from '../utils/debug';

// New numeric helpers you created
import { sanitizeDigitsOnly, clampNumericString } from '../utils/inputs';

// ✅ NEW: Wizard validation utilities
import {
  validateWizardData,
  getWizardStatus,
  type ValidationResult,
  type WizardStatus,
} from '../utils/wizardValidation';

// Icons
import { CheckCircleIcon, XCircleIcon, AlertTriangle, RefreshCw } from 'lucide-react';

// Optional email validator
import isEmail from 'isemail';

// ============================================================================
// CONFIG / HELPERS
// ============================================================================
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || 'https://tester-backend-4nxc.onrender.com').replace(/\/+$/, '');

const ZPM_KEY = 'zonePriceMatrixData';

type PriceMatrix = Record<string, Record<string, number>>;
type ZonePriceMatrixLS = {
  zones: unknown[];
  priceMatrix: PriceMatrix;
  timestamp: string;
};

function getAuthToken(): string {
  return (
    Cookies.get('authToken') ||
    localStorage.getItem('authToken') ||
    localStorage.getItem('token') ||
    ''
  );
}

function base64UrlToJson<T = any>(b64url: string): T | null {
  try {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
    const json = atob(b64);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function getCustomerIDFromToken(): string {
  const token = getAuthToken();
  if (!token || token.split('.').length < 2) return '';
  const payload = base64UrlToJson<Record<string, any>>(token.split('.')[1]) || {};
  const id =
    payload?.customer?._id ||
    payload?.user?._id ||
    payload?._id ||
    payload?.id ||
    payload?.customerId ||
    payload?.customerID ||
    '';
  return id || '';
}

/** Capitalize every word (auto-capitalize) */
function capitalizeWords(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ')
    .trim();
}

/** GSTIN regex (standard government format) */
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

/** Simple email fallback regex */
const EMAIL_FALLBACK_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Safe getters */
function safeGetField(obj: any, ...keys: string[]): string {
  if (!obj) return '';
  for (const key of keys) {
    const val = obj[key];
    if (val !== undefined && val !== null) {
      return String(val);
    }
  }
  return '';
}
function safeGetNumber(obj: any, defaultVal: number, ...keys: string[]): number {
  if (!obj) return defaultVal;
  for (const key of keys) {
    const val = obj[key];
    if (val !== undefined && val !== null) {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
  }
  return defaultVal;
}

/** LocalStorage loader (legacy - for backwards compatibility) */
function safeLoadZPM(): ZonePriceMatrixLS | null {
  try {
    const raw = localStorage.getItem(ZPM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.priceMatrix && typeof parsed.priceMatrix === 'object') return parsed;
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export const AddVendor: React.FC = () => {
  // Hooks (manage sub-section state/UI)
  const vendorBasics = useVendorBasics();
  const pincodeLookup = usePincodeLookup();
  const volumetric = useVolumetric();
  const charges = useCharges();

  // ✅ NEW: Wizard storage hook
  const { wizardData, isLoaded: wizardLoaded, clearWizard } = useWizardStorage();

  // Page-level state
  const [transportMode, setTransportMode] = useState<'road' | 'air' | 'rail' | 'ship'>('road');
  const [priceChartFile, setPriceChartFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Token viewer (debug)
  const [tokenPanelOpen, setTokenPanelOpen] = useState(false);
  const [tokenValue, setTokenValue] = useState<string>('');
  const [tokenPayload, setTokenPayload] = useState<any>(null);

  // Zone Price Matrix (from wizard/localStorage) - Keep legacy for backwards compatibility
  const [zpm, setZpm] = useState<ZonePriceMatrixLS | null>(null);
  
  // ✅ NEW: Wizard validation state
  const [wizardValidation, setWizardValidation] = useState<ValidationResult | null>(null);
  const [wizardStatus, setWizardStatus] = useState<WizardStatus | null>(null);
  
  const navigate = useNavigate();

  // Prevent double-run in React StrictMode / dev double-mounts
  const mountRan = useRef(false);

  // Load zone data from localStorage (legacy method)
  const loadZoneData = useCallback(() => {
    const data = safeLoadZPM();
    setZpm(data);
    emitDebug('ZPM_LOADED', { hasData: !!data, data });
    if (!data && (!wizardData || !wizardData.priceMatrix)) {
      toast.error('No zone matrix found. Open the wizard to create one.', { duration: 2200, id: 'zpm-missing' });
    } else if (data) {
      // use toast id to avoid duplicate identical toasts
      toast.success('Zone matrix loaded from browser', { duration: 1400, id: 'zpm-loaded' });
    }
  }, [wizardData]);

  // ✅ NEW: Validate wizard data when loaded
  useEffect(() => {
    if (wizardLoaded && wizardData) {
      const validation = validateWizardData(wizardData);
      const status = getWizardStatus(wizardData);
      setWizardValidation(validation);
      setWizardStatus(status);
      emitDebug('WIZARD_VALIDATION', { validation, status });
    }
  }, [wizardLoaded, wizardData]);

  const matrixSize = useMemo(() => {
    // Prioritize wizard data, fallback to legacy localStorage
    const matrix = wizardData?.priceMatrix || zpm?.priceMatrix || {};
    const rows = Object.keys(matrix).length;
    const cols = rows ? Object.keys(Object.values(matrix)[0] ?? {}).length : 0;
    return { rows, cols };
  }, [zpm, wizardData]);

  // Load draft + zone matrix on mount
  useEffect(() => {
    if (mountRan.current) return;
    mountRan.current = true;

    const draft = readDraft();
    if (draft) {
      emitDebug('DRAFT_LOADED_ON_MOUNT', draft);
      try {
        if (draft.basics && typeof vendorBasics.loadFromDraft === 'function') {
          vendorBasics.loadFromDraft(draft.basics);
          if (draft.basics.transportMode) setTransportMode(draft.basics.transportMode);
        }
        if (draft.geo && typeof pincodeLookup.loadFromDraft === 'function') {
          pincodeLookup.loadFromDraft(draft.geo);
        }
        if (draft.volumetric && typeof volumetric.loadFromDraft === 'function') {
          volumetric.loadFromDraft(draft.volumetric);
        }
        if (draft.charges && typeof charges.loadFromDraft === 'function') {
          charges.loadFromDraft(draft.charges);
        }
        // add toast id to dedupe duplicate visual toasts
        toast.success('Draft restored', { duration: 1600, id: 'draft-restored' });
      } catch (err) {
        emitDebugError('DRAFT_LOAD_ERROR', { err });
        toast.error('Failed to restore draft completely');
      }
    }
    loadZoneData(); // also load zone matrix from localStorage (legacy)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Validation across sections =====
  const validateVendorBasicsLocal = (): { ok: boolean; errs: string[] } => {
    const errs: string[] = [];
    const b = vendorBasics.basics || {};

    const name = capitalizeWords(safeGetField(b, 'name', 'companyName', 'company')).slice(0, 60);
    const displayName = capitalizeWords(safeGetField(b, 'displayName', 'display_name')).slice(0, 30);
    const companyName = capitalizeWords(safeGetField(b, 'companyName', 'company_name')).slice(0, 30);
    const primaryCompanyName = capitalizeWords(safeGetField(b, 'primaryCompanyName', 'primaryCompany')).slice(0, 25);
    const subVendor = capitalizeWords(safeGetField(b, 'subVendor', 'sub_vendor')).slice(0, 20);

    const vendorCode = sanitizeDigitsOnly(safeGetField(b, 'vendorCode', 'vendor_code')).slice(0, 9);
    const vendorPhone = sanitizeDigitsOnly(safeGetField(b, 'vendorPhoneNumber', 'vendorPhone', 'primaryContactPhone')).slice(0, 10);
    const vendorEmail = safeGetField(b, 'vendorEmailAddress', 'vendorEmail', 'primaryContactEmail').trim();
    const gstin = safeGetField(b, 'gstin', 'gst', 'gstNo').toUpperCase().replace(/\s+/g, '').slice(0, 15);
    const address = safeGetField(b, 'address').trim().slice(0, 150);

    if (!name || name.trim().length === 0) errs.push('Name is required (max 60 chars).');
    if (name.trim().length > 60) errs.push('Name must be at most 60 characters.');
    if (displayName && displayName.trim().length > 30) errs.push('Display name must be at most 30 characters.');
    if (companyName && companyName.trim().length > 30) errs.push('Company name must be at most 30 characters.');
    if (primaryCompanyName && primaryCompanyName.trim().length > 25) errs.push('Primary company name must be at most 25 characters.');
    if (subVendor && subVendor.trim().length > 20) errs.push('Sub vendor must be at most 20 characters.');
    if (!/^[0-9]{1,9}$/.test(vendorCode)) errs.push('Vendor code must be digits only, 1 to 9 digits.');
    if (!/^[1-9][0-9]{9}$/.test(vendorPhone)) errs.push('Contact number must be 10 digits and cannot start with 0.');

    let emailOk = false;
    try { emailOk = !!(vendorEmail && (isEmail.validate ? isEmail.validate(vendorEmail) : isEmail(vendorEmail))); }
    catch { emailOk = EMAIL_FALLBACK_RE.test(vendorEmail); }
    if (!emailOk) errs.push('Invalid email address (must include a domain and a dot).');

    if (!GST_REGEX.test(gstin)) errs.push('GST number must be a valid 15-character GSTIN.');

    if (!address || address.trim().length === 0) errs.push('Address is required (max 150 chars).');
    if (address.trim().length > 150) errs.push('Address must be at most 150 characters.');

    try {
      const c = charges.charges || {};
      const fuel = safeGetNumber(c, 0, 'fuelSurcharge', 'fuel');
      if (!Number.isFinite(fuel) || fuel < 0 || fuel > 50) {
        errs.push('Fuel surcharge must be between 0 and 50.');
      }
    } catch { /* ignore */ }

    const geo = pincodeLookup.geo || {};
    const pincodeStr = String(geo.pincode ?? '').replace(/\D+/g, '').slice(0, 6);
    if (pincodeStr && !(pincodeStr.length >= 3 && pincodeStr.length <= 6)) {
      errs.push('Pincode looks invalid (must be 3–6 digits).');
    }

    return { ok: errs.length === 0, errs };
  };

  const validateAll = (): boolean => {
    let ok = true;
    const errs: string[] = [];

    try {
      if (typeof vendorBasics.validateAll === 'function' && !vendorBasics.validateAll()) {
        errs.push('Company information is incomplete or invalid.'); ok = false;
      }
    } catch (err) { emitDebugError('HOOK_VALIDATE_VENDORBASICS_ERROR', { err }); }

    try {
      if (typeof pincodeLookup.validateGeo === 'function' && !pincodeLookup.validateGeo()) {
        errs.push('Location information is incomplete.'); ok = false;
      }
    } catch (err) { emitDebugError('HOOK_VALIDATE_PINCODE_ERROR', { err }); }

    try {
      if (typeof volumetric.validateVolumetric === 'function' && !volumetric.validateVolumetric()) {
        errs.push('Volumetric configuration is invalid.'); ok = false;
      }
    } catch (err) { emitDebugError('HOOK_VALIDATE_VOLUMETRIC_ERROR', { err }); }

    try {
      if (typeof charges.validateAll === 'function' && !charges.validateAll()) {
        errs.push('Charges configuration is invalid.'); ok = false;
      }
    } catch (err) { emitDebugError('HOOK_VALIDATE_CHARGES_ERROR', { err }); }

    // ✅ ENHANCED: Check wizard data (prioritize) OR legacy localStorage
    const hasWizardMatrix = wizardData?.priceMatrix && Object.keys(wizardData.priceMatrix).length > 0;
    const hasLegacyMatrix = zpm?.priceMatrix && Object.keys(zpm.priceMatrix).length > 0;
    
    if (!hasWizardMatrix && !hasLegacyMatrix) {
      errs.push('Zone Price Matrix is missing. Open the wizard, save, then Reload Data.');
      ok = false;
    }

    // ✅ NEW: Validate wizard data structure if present
    if (wizardData && !wizardValidation?.isValid) {
      errs.push('Wizard configuration has errors. Please fix them before submitting.');
      if (wizardValidation?.errors) {
        errs.push(...wizardValidation.errors);
      }
      ok = false;
    }

    const local = validateVendorBasicsLocal();
    if (!local.ok) { ok = false; errs.push(...local.errs); }

    if (!ok) {
      errs.forEach((m) => toast.error(m, { duration: 4200 }));
      emitDebugError('VALIDATION_FAILED', { errs });
    }
    return ok;
  };

  // ===== Token debug panel =====
  const handleShowToken = () => {
    const tok = getAuthToken();
    if (!tok) {
      toast.error('No token found (login again?)');
      setTokenPanelOpen(true);
      setTokenValue('');
      setTokenPayload(null);
      return;
    }
    const payload = tok.split('.').length >= 2 ? base64UrlToJson(tok.split('.')[1]) : null;
    setTokenValue(tok);
    setTokenPayload(payload);
    setTokenPanelOpen(true);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  // ===== Build API payload (uses wizard data OR legacy localStorage) =====
  const buildPayloadForApi = () => {
    const basics = vendorBasics.basics || {};
    const geo = pincodeLookup.geo || {};

    const name = capitalizeWords(safeGetField(basics, 'name', 'companyName')).slice(0, 60);
    const displayName = capitalizeWords(safeGetField(basics, 'displayName', 'display_name')).slice(0, 30);
    const companyName = capitalizeWords(safeGetField(basics, 'companyName', 'company_name')).slice(0, 30);
    const primaryCompanyName = capitalizeWords(safeGetField(basics, 'primaryCompanyName', 'primaryCompany')).slice(0, 25);
    const subVendor = capitalizeWords(safeGetField(basics, 'subVendor', 'sub_vendor')).slice(0, 20);

    const vendorCode = sanitizeDigitsOnly(safeGetField(basics, 'vendorCode', 'vendor_code')).slice(0, 9);

    const vendorPhoneStr = sanitizeDigitsOnly(
      safeGetField(basics, 'vendorPhoneNumber', 'vendorPhone', 'primaryContactPhone')
    ).slice(0, 10);
    const vendorPhoneNum = Number(clampNumericString(vendorPhoneStr, 1000000000, 9999999999, 10) || 0);

    const vendorEmail = safeGetField(basics, 'vendorEmailAddress', 'vendorEmail', 'primaryContactEmail').trim();
    const gstNo = safeGetField(basics, 'gstin', 'gstNo', 'gst').toUpperCase().replace(/\s+/g, '').slice(0, 15);
    const address = safeGetField(basics, 'address').trim().slice(0, 150);

    const volData = volumetric.volumetric || volumetric.state || (volumetric as any).data || {};
    const volUnit = safeGetField(volData, 'unit', 'volumetricUnit', 'selectedUnit') || 'cm';

    emitDebug('VOLUMETRIC_DATA_DEBUG', { volData, volUnit, fullVolumetricHook: volumetric });

    const volumetricBits =
      volUnit === 'cm' || volUnit === 'centimeters'
        ? { divisor: safeGetNumber(volData, 0, 'volumetricDivisor', 'divisor') || null, cftFactor: null as number | null }
        : { divisor: null as number | null, cftFactor: safeGetNumber(volData, 0, 'cftFactor', 'factor') || null };

    emitDebug('VOLUMETRIC_BITS_MAPPED', volumetricBits);

    const parseCharge = (val: any, min = 0, max = 100000, digitLimit?: number) => {
      if (val === undefined || val === null || val === '') return 0;
      const s = String(val);
      const digitsOnly = sanitizeDigitsOnly(s);
      const clamped = clampNumericString(digitsOnly, min, max, digitLimit);
      return Number(clamped || 0);
    };

    const c = charges.charges || {};
    const priceRate = {
      minWeight: parseCharge(safeGetNumber(c, 0, 'minChargeableWeight', 'minWeight'), 0, 10000, 5),
      docketCharges: parseCharge(safeGetNumber(c, 0, 'docketCharges'), 0, 10000, 5),
      fuel: parseCharge(safeGetNumber(c, 0, 'fuelSurcharge', 'fuel'), 0, 50, 2),

      rovCharges: {
        variable: parseCharge(safeGetNumber(c.rovCharges || c, 0, 'variable', 'rovVariable'), 0, 100000),
        fixed: parseCharge(safeGetNumber(c.rovCharges || c, 0, 'fixed', 'rovFixed'), 0, 100000),
      },
      codCharges: {
        variable: parseCharge(safeGetNumber(c.codCharges || c, 0, 'variable', 'codVariable'), 0, 100000),
        fixed: parseCharge(safeGetNumber(c.codCharges || c, 0, 'fixed', 'codFixed'), 0, 100000),
      },
      topayCharges: {
        variable: parseCharge(safeGetNumber(c.topayCharges || c, 0, 'variable', 'topayVariable'), 0, 100000),
        fixed: parseCharge(safeGetNumber(c.topayCharges || c, 0, 'fixed', 'topayFixed'), 0, 100000),
      },
      handlingCharges: {
        variable: parseCharge(safeGetNumber(c.handlingCharges || c, 0, 'variable', 'handlingVariable'), 0, 100000),
        fixed: parseCharge(safeGetNumber(c.handlingCharges || c, 0, 'fixed', 'handlingFixed'), 0, 100000),
        threshholdweight: parseCharge(
          safeGetNumber(c.handlingCharges || c, 0, 'threshholdweight', 'handlingThresholdWeight', 'thresholdWeight'),
          0, 100000
        ),
      },
      appointmentCharges: {
        variable: parseCharge(safeGetNumber(c.appointmentCharges || c, 0, 'variable', 'appointmentVariable'), 0, 100000),
        fixed: parseCharge(safeGetNumber(c.appointmentCharges || c, 0, 'fixed', 'appointmentFixed'), 0, 100000),
      },

      ...volumetricBits,

      minCharges: parseCharge(safeGetNumber(c, 0, 'minimumCharges', 'minCharges'), 0, 100000),
      greenTax: parseCharge(safeGetNumber(c, 0, 'greenTax', 'ngt'), 0, 100000),
      daccCharges: parseCharge(safeGetNumber(c, 0, 'daccCharges'), 0, 100000),
      miscellanousCharges: parseCharge(safeGetNumber(c, 0, 'miscCharges', 'miscellanousCharges'), 0, 100000),

      insuaranceCharges: {
        variable: parseCharge(safeGetNumber(c.insuranceCharges || c.insuaranceCharges || c, 0, 'variable', 'insuranceVariable'), 0, 100000),
        fixed: parseCharge(safeGetNumber(c.insuranceCharges || c.insuaranceCharges || c, 0, 'fixed', 'insuranceFixed'), 0, 100000),
      },
      odaCharges: {
        variable: parseCharge(safeGetNumber(c.odaCharges || c, 0, 'variable'), 0, 100000),
        fixed: parseCharge(safeGetNumber(c.odaCharges || c, 0, 'fixed'), 0, 100000),
      },
      prepaidCharges: {
        variable: parseCharge(safeGetNumber(c.prepaidCharges || c, 0, 'variable'), 0, 100000),
        fixed: parseCharge(safeGetNumber(c.prepaidCharges || c, 0, 'fixed'), 0, 100000),
      },
      fmCharges: {
        variable: parseCharge(safeGetNumber(c.fmCharges || c, 0, 'variable'), 0, 100000),
        fixed: parseCharge(safeGetNumber(c.fmCharges || c, 0, 'fixed'), 0, 100000),
      },
    };

    // ✅ PRIORITIZE: Use wizard data if available, fallback to legacy localStorage
    const priceChart = (wizardData?.priceMatrix || zpm?.priceMatrix || {}) as PriceMatrix;

    const pincodeStr = String(geo.pincode ?? '').replace(/\D+/g, '').slice(0, 6);
    const pincodeNum = Number(pincodeStr || 0);

    const payloadForApi = {
      customerID: getCustomerIDFromToken(),
      companyName: companyName.trim(),
      vendorCode: vendorCode,
      vendorPhone: vendorPhoneNum,
      vendorEmail: vendorEmail,
      gstNo,
      mode: transportMode || 'road',
      address,
      state: String(geo.state ?? '').toUpperCase(),
      pincode: pincodeNum,
      human: { name, displayName, primaryCompanyName, subVendor },
      prices: { priceRate, priceChart },
    };

    return payloadForApi;
  };

  // ===== Submit =====
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    emitDebug('SUBMIT_STARTED');

    if (!validateAll()) {
      emitDebugError('VALIDATION_FAILED_ON_SUBMIT');
      return;
    }

    setIsSubmitting(true);
    try {
      const payloadForApi = buildPayloadForApi();
      emitDebug('SUBMIT_PAYLOAD_FOR_API', payloadForApi);

      const fd = new FormData();
      fd.append('customerID', String(payloadForApi.customerID || ''));
      fd.append('companyName', payloadForApi.companyName);
      fd.append('vendorCode', payloadForApi.vendorCode);
      fd.append('vendorPhone', String(payloadForApi.vendorPhone));
      fd.append('vendorEmail', payloadForApi.vendorEmail);
      fd.append('gstNo', payloadForApi.gstNo);
      fd.append('mode', payloadForApi.mode);
      fd.append('address', payloadForApi.address);
      fd.append('state', payloadForApi.state);
      fd.append('pincode', String(payloadForApi.pincode));
      fd.append('rating', '3'); // Default rating
      
      // Backend expects priceRate and priceChart as separate fields, not nested in prices
      fd.append('priceRate', JSON.stringify(payloadForApi.prices.priceRate));
      fd.append('priceChart', JSON.stringify(payloadForApi.prices.priceChart));

      if (priceChartFile) {
        fd.append('priceChart', priceChartFile);
      }

      fd.append('vendorJson', JSON.stringify(payloadForApi));

      const token = getAuthToken();
      const url = `${API_BASE}/api/transporter/addtiedupcompanies`;

      emitDebug('SUBMITTING_TO_API', { url, hasToken: !!token });

      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const json = await res.json().catch(() => ({} as any));
      emitDebug('API_RESPONSE', { status: res.status, json });

      if (!res.ok || !json?.success) {
        emitDebugError('SUBMIT_ERROR', { status: res.status, json });
        toast.error(json?.message || `Failed to create vendor (${res.status})`, { duration: 5200 });
        setIsSubmitting(false);
        return;
      }

      toast.success('Vendor created successfully!', { duration: 3400 });

      // ✅ Clear draft, reset form, clear wizard data AND legacy localStorage
      clearDraft();
      clearWizard(); // Clear wizard storage
      localStorage.removeItem(ZPM_KEY); // Clear legacy localStorage
      try {
        if (typeof vendorBasics.reset === 'function') vendorBasics.reset();
        if (typeof pincodeLookup.reset === 'function') pincodeLookup.reset();
        if (typeof volumetric.reset === 'function') volumetric.reset();
        if (typeof charges.reset === 'function') charges.reset();
      } catch (err) {
        emitDebugError('RESET_HOOKS_ERROR', { err });
      }
      setPriceChartFile(null);
      setTransportMode('road');
      setZpm(null);
      setWizardValidation(null);
      setWizardStatus(null);
      setRefreshTrigger((x) => x + 1);
    } catch (err) {
      emitDebugError('SUBMIT_EXCEPTION', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      toast.error('Unexpected error. Please try again.', { duration: 5200 });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===== Reset =====
  const handleReset = () => {
    if (!confirm('Reset the form? Unsaved changes will be lost.')) return;
    try {
      if (typeof vendorBasics.reset === 'function') vendorBasics.reset();
      if (typeof pincodeLookup.reset === 'function') pincodeLookup.reset();
      if (typeof volumetric.reset === 'function') volumetric.reset();
      if (typeof charges.reset === 'function') charges.reset();
    } catch (err) {
      emitDebugError('RESET_HOOKS_ERROR', { err });
    }
    setPriceChartFile(null);
    setTransportMode('road');
    clearDraft();
    toast.success('Form reset', { duration: 1200 });
  };

  // ========================================================================
  // PAGE UI
  // ========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white grid place-items-center font-bold shadow-sm">
              F
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Add Vendor</h1>
              <p className="text-xs text-slate-600">Freight Cost Calculator · Transporter Setup</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShowToken}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              Token
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300"
            >
              Reset
            </button>
            <button
              type="submit"
              form="add-vendor-form"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isSubmitting ? 'Saving…' : 'Save Vendor'}
            </button>
          </div>
        </div>
      </div>

      {/* Token panel (debug) */}
      {tokenPanelOpen && (
        <div className="max-w-7xl mx-auto mt-4 px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-slate-800">Current Auth Token</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => copyText(tokenValue)}
                  className="px-2 py-1 text-xs rounded-md border border-slate-300 hover:bg-slate-50"
                >
                  Copy token
                </button>
                <button
                  type="button"
                  onClick={() => copyText(JSON.stringify(tokenPayload, null, 2))}
                  className="px-2 py-1 text-xs rounded-md border border-slate-300 hover:bg-slate-50"
                >
                  Copy payload
                </button>
                <button
                  type="button"
                  onClick={() => setTokenPanelOpen(false)}
                  className="px-2 py-1 text-xs rounded-md border border-slate-300 hover:bg-slate-50"
                >
                  Hide
                </button>
              </div>
            </div>
            <div className="text-xs text-slate-700 break-all">
              <div className="mb-2">
                <span className="font-mono font-semibold mr-2">Token:</span>
                <span className="font-mono">{tokenValue || '(empty)'}</span>
              </div>
              <div className="mt-3">
                <div className="font-mono font-semibold mb-1">Decoded Payload:</div>
                <pre className="whitespace-pre-wrap font-mono bg-slate-900 text-slate-100 p-3 rounded-md overflow-x-auto">
{JSON.stringify(tokenPayload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <form id="add-vendor-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 gap-0 divide-y divide-slate-200">
              <div className="p-6 md:p-8">
                <CompanySection vendorBasics={vendorBasics} pincodeLookup={pincodeLookup} />
              </div>

              <div className="p-6 md:p-8 bg-slate-50/60">
                <TransportSection
                  volumetric={volumetric}
                  transportMode={transportMode}
                  onTransportModeChange={(m) => setTransportMode(m)}
                />
              </div>

              <div className="p-6 md:p-8">
                <ChargesSection charges={charges} />
              </div>

              {/* ✅ ENHANCED: Zone Price Matrix section with validation */}
              <div className="p-6 md:p-8 bg-slate-50/60">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Zone Price Matrix</h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => navigate('/zone-price-matrix')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      >
                        {wizardStatus?.hasPriceMatrix ? 'Edit Wizard' : 'Open Wizard'}
                      </button>
                      <button
                        type="button"
                        onClick={loadZoneData}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Reload Data
                      </button>
                    </div>
                  </div>

                  {/* Status Display */}
                  <div className="space-y-3">
                    {/* Primary Status */}
                    <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-slate-200 bg-slate-50">
                      {wizardStatus?.hasPriceMatrix ? (
                        <>
                          <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-green-900">
                              Zone data loaded ({matrixSize.rows}×{matrixSize.cols})
                            </p>
                            <p className="text-xs text-green-700">
                              {wizardStatus.zoneCount} zones configured
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-red-900">No zone data configured</p>
                            <p className="text-xs text-red-700">
                              Please open the wizard to configure zones
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Validation Errors */}
                    {wizardValidation && !wizardValidation.isValid && wizardValidation.errors.length > 0 && (
                      <div className="p-4 rounded-lg border-2 border-red-300 bg-red-50">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-red-900 mb-2">
                              Configuration Issues:
                            </p>
                            <ul className="space-y-1 text-sm text-red-800">
                              {wizardValidation.errors.map((error, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-red-600 mt-0.5">•</span>
                                  <span>{error}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Validation Warnings */}
                    {wizardValidation && wizardValidation.isValid && wizardValidation.warnings.length > 0 && (
                      <div className="p-4 rounded-lg border-2 border-yellow-300 bg-yellow-50">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-yellow-900 mb-2">Warnings:</p>
                            <ul className="space-y-1 text-sm text-yellow-800">
                              {wizardValidation.warnings.map((warning, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-yellow-600 mt-0.5">•</span>
                                  <span>{warning}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Success State */}
                    {wizardValidation && wizardValidation.isValid && wizardValidation.warnings.length === 0 && wizardStatus?.hasPriceMatrix && (
                      <div className="p-4 rounded-lg border-2 border-green-300 bg-green-50">
                        <div className="flex items-center gap-3">
                          <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                          <p className="text-sm text-green-800">
                            Configuration is complete and valid
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Progress Bar */}
                    {wizardStatus && wizardStatus.completionPercentage > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-700">
                            Configuration Progress
                          </span>
                          <span className="text-xs font-semibold text-slate-900">
                            {wizardStatus.completionPercentage}%
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-green-600 transition-all duration-500"
                            style={{ width: `${wizardStatus.completionPercentage}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Info Note */}
                    <p className="text-xs text-slate-600 leading-relaxed">
                      The wizard saves data in your browser under{' '}
                      <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-slate-800">
                        vendorWizard.v1
                      </code>
                      . After configuring zones and pricing, click{' '}
                      <strong className="text-slate-900">Reload Data</strong> to load it here.
                    </p>
                  </div>
                </div>
              </div>

              {/* Keep file upload for CSV/Excel import */}
              <div className="p-6 md:p-8">
                <PriceChartUpload file={priceChartFile} onFileChange={setPriceChartFile} />
              </div>

              {/* Footer actions */}
              <div className="p-6 md:p-8 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-3 bg-slate-200 text-slate-800 font-medium rounded-xl hover:bg-slate-300 transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <XCircleIcon className="w-5 h-5" />
                    Reset Form
                  </span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || (wizardValidation && !wizardValidation.isValid)}
                  className="px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Saving…
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-5 h-5" />
                        Save Vendor
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Saved Vendors Table */}
        <div className="mt-8">
          <SavedVendorsTable refreshTrigger={refreshTrigger} />
        </div>
      </div>
    </div>
  );
};

export default AddVendor;
