/**
 * useVendorBasics hook
 * Manages vendor basic information state and validation
 * Updated: Removed displayName and contactPersonName, added serviceModes and companyRating
 */

import { useState, useCallback, useEffect } from 'react';
import {
  validateCompanyName,
  validatePhone,
  validateEmail,
  validateGST,
  validateLegalCompanyName,
  validateSubVendor,
  validateVendorCode,
  validatePrimaryContactName,
  validatePrimaryContactPhone,
  validatePrimaryContactEmail,
  validateAddress,
} from '../utils/validators';
import { VendorBasics, persistDraft } from '../store/draftStore';
import { emitDebug } from '../utils/debug';

// =============================================================================
// TYPES
// =============================================================================

export type ServiceMode = 'Road LTL' | 'Road FTL';

export interface VendorBasicsErrors {
  companyName?: string;
  vendorPhoneNumber?: string;
  vendorEmailAddress?: string;
  gstin?: string;
  legalCompanyName?: string;
  subVendor?: string;
  vendorCode?: string;
  primaryContactName?: string;
  primaryContactPhone?: string;
  primaryContactEmail?: string;
  address?: string;
  serviceModes?: string;
  companyRating?: string;
}

export interface UseVendorBasicsReturn {
  basics: VendorBasics;
  errors: VendorBasicsErrors;
  setField: (field: keyof VendorBasics, value: string | number | ServiceMode) => void;
  validateField: (field: keyof VendorBasics) => boolean;
  validateAll: () => boolean;
  reset: () => void;
  loadFromDraft: (draft: Partial<VendorBasics>) => void;
}

// =============================================================================
// DEFAULT STATE
// =============================================================================

const defaultBasics: VendorBasics = {
  companyName: '',
  vendorPhoneNumber: '',
  vendorEmailAddress: '',
  gstin: '',
  transportMode: 'road',
  legalCompanyName: '',
  subVendor: '',
  vendorCode: '',
  primaryContactName: '',
  primaryContactPhone: '',
  primaryContactEmail: '',
  address: '',
  serviceModes: 'Road LTL', // Default to Road LTL
  companyRating: 4.0, // Default rating
};

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for managing vendor basics
 *
 * @param onUpdate - Optional callback when state changes
 * @returns Vendor basics state and methods
 */
export const useVendorBasics = (
  onUpdate?: (basics: VendorBasics) => void
): UseVendorBasicsReturn => {
  const [basics, setBasics] = useState<VendorBasics>(defaultBasics);
  const [errors, setErrors] = useState<VendorBasicsErrors>({});

  // Throttled draft persistence
  useEffect(() => {
    const timer = setTimeout(() => {
      persistDraft({ basics });
      emitDebug('BASICS_DRAFT_SAVED', basics);
    }, 400);

    return () => clearTimeout(timer);
  }, [basics]);

  // Notify parent of updates
  useEffect(() => {
    if (onUpdate) {
      onUpdate(basics);
    }
  }, [basics, onUpdate]);

  /**
   * Set a single field value
   */
  const setField = useCallback(
    (field: keyof VendorBasics, value: string | number | ServiceMode) => {
      setBasics((prev) => {
        const updated = { ...prev, [field]: value };
        emitDebug('BASICS_FIELD_CHANGED', { field, value });
        return updated;
      });

      // Clear error for this field
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[field as keyof VendorBasicsErrors];
        return updated;
      });
    },
    []
  );

  /**
   * Validate a single field
   */
  const validateField = useCallback(
    (field: keyof VendorBasics): boolean => {
      let error = '';

      switch (field) {
        case 'companyName':
          error = validateCompanyName(basics.companyName);
          break;
        case 'vendorPhoneNumber':
          error = validatePhone(basics.vendorPhoneNumber);
          break;
        case 'vendorEmailAddress':
          error = validateEmail(basics.vendorEmailAddress);
          break;
        case 'gstin':
          error = validateGST(basics.gstin || '');
          break;
        case 'legalCompanyName':
          error = validateLegalCompanyName(basics.legalCompanyName);
          break;
        case 'subVendor':
          error = validateSubVendor(basics.subVendor);
          break;
        case 'vendorCode':
          error = validateVendorCode(basics.vendorCode);
          break;
        case 'primaryContactName':
          error = validatePrimaryContactName(basics.primaryContactName);
          break;
        case 'primaryContactPhone':
          error = validatePrimaryContactPhone(basics.primaryContactPhone);
          break;
        case 'primaryContactEmail':
          error = validatePrimaryContactEmail(basics.primaryContactEmail);
          break;
        case 'address':
          error = validateAddress(basics.address);
          break;
        case 'serviceModes':
          if (!basics.serviceModes) {
            error = 'Please select a service mode';
          }
          break;
        case 'companyRating':
          if (basics.companyRating < 0 || basics.companyRating > 5) {
            error = 'Rating must be between 0 and 5';
          }
          break;
      }

      if (error) {
        setErrors((prev) => ({ ...prev, [field]: error }));
        emitDebug('BASICS_VALIDATION_ERROR', { field, error });
        return false;
      }

      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[field as keyof VendorBasicsErrors];
        return updated;
      });

      return true;
    },
    [basics]
  );

  /**
   * Validate all fields
   */
  const validateAll = useCallback((): boolean => {
    const fields: (keyof VendorBasics)[] = [
      'companyName',
      'vendorPhoneNumber',
      'vendorEmailAddress',
      'legalCompanyName',
      'subVendor',
      'vendorCode',
      'primaryContactName',
      'primaryContactPhone',
      'primaryContactEmail',
      'address',
      'serviceModes',
    ];

    // Validate GSTIN if present
    if (basics.gstin) {
      fields.push('gstin');
    }

    let isValid = true;
    const newErrors: VendorBasicsErrors = {};

    fields.forEach((field) => {
      let error = '';

      switch (field) {
        case 'companyName':
          error = validateCompanyName(basics.companyName);
          break;
        case 'vendorPhoneNumber':
          error = validatePhone(basics.vendorPhoneNumber);
          break;
        case 'vendorEmailAddress':
          error = validateEmail(basics.vendorEmailAddress);
          break;
        case 'gstin':
          error = validateGST(basics.gstin || '');
          break;
        case 'legalCompanyName':
          error = validateLegalCompanyName(basics.legalCompanyName);
          break;
        case 'subVendor':
          error = validateSubVendor(basics.subVendor);
          break;
        case 'vendorCode':
          error = validateVendorCode(basics.vendorCode);
          break;
        case 'primaryContactName':
          error = validatePrimaryContactName(basics.primaryContactName);
          break;
        case 'primaryContactPhone':
          error = validatePrimaryContactPhone(basics.primaryContactPhone);
          break;
        case 'primaryContactEmail':
          error = validatePrimaryContactEmail(basics.primaryContactEmail);
          break;
        case 'address':
          error = validateAddress(basics.address);
          break;
        case 'serviceModes':
          if (!basics.serviceModes) {
            error = 'Please select a service mode';
          }
          break;
      }

      if (error) {
        newErrors[field as keyof VendorBasicsErrors] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);

    if (!isValid) {
      emitDebug('BASICS_VALIDATION_FAILED', newErrors);
    } else {
      emitDebug('BASICS_VALIDATION_PASSED');
    }

    return isValid;
  }, [basics]);

  /**
   * Reset to default state
   */
  const reset = useCallback(() => {
    setBasics(defaultBasics);
    setErrors({});
    emitDebug('BASICS_RESET');
  }, []);

  /**
   * Load from draft
   */
  const loadFromDraft = useCallback((draft: Partial<VendorBasics>) => {
    setBasics((prev) => ({
      ...prev,
      ...draft,
    }));
    emitDebug('BASICS_LOADED_FROM_DRAFT', draft);
  }, []);

  return {
    basics,
    errors,
    setField,
    validateField,
    validateAll,
    reset,
    loadFromDraft,
  };
};