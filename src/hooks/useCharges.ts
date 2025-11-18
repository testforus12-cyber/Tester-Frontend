/**
 * useCharges hook
 * Manages both simple numeric charges and card-based charges with complex validation
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Charges, validateFuel } from '../utils/validators';
import {
  ChargeCardData,
  validateChargeCard,
  validateFixedAmount,
  validateWeightThreshold,
  createDefaultChargeCard,
} from '../utils/chargeValidators';
import { toNumberOrZero, isNumberInRange } from '../utils/numbers';
import { persistDraft } from '../store/draftStore';
import { emitDebug } from '../utils/debug';

// =============================================================================
// TYPES
// =============================================================================

export interface ChargesErrors {
  // Simple charges
  docketCharges?: string;
  minWeightKg?: string;
  minCharges?: string;
  hamaliCharges?: string;
  greenTax?: string;
  miscCharges?: string;
  fuelSurchargePct?: string;

  // Card-based charges (nested errors)
  handlingCharges?: Record<string, string>;
  rovCharges?: Record<string, string>;
  codCharges?: Record<string, string>;
  toPayCharges?: Record<string, string>;
  appointmentCharges?: Record<string, string>;
}

export interface UseChargesReturn {
  charges: Charges;
  errors: ChargesErrors;
  setCharge: (field: keyof Charges, value: string | number) => void;
  setCardField: (
    cardName: 'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges',
    field: keyof ChargeCardData,
    value: any
  ) => void;
  validateField: (field: keyof Charges) => boolean;
  validateCardField: (
    cardName: 'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges',
    field: keyof ChargeCardData
  ) => boolean;
  validateAll: () => boolean;
  reset: () => void;
  loadFromDraft: (draft: Partial<Charges>) => void;
  firstErrorRef: React.MutableRefObject<HTMLElement | null>;
}

// =============================================================================
// FIELD RANGES (for simple numeric charges)
// =============================================================================

const SIMPLE_CHARGE_RANGES: Record<string, { min: number; max: number }> = {
  docketCharges: { min: 1, max: 10000 },
  minWeightKg: { min: 1, max: 10000 },
  minCharges: { min: 1, max: 10000 },
  hamaliCharges: { min: 1, max: 10000 },
  greenTax: { min: 1, max: 10000 },
  miscCharges: { min: 1, max: 10000 },
  fuelSurchargePct: { min: 0, max: 40 },
};

// =============================================================================
// DEFAULT STATE
// =============================================================================

const defaultCharges: Charges = {
  // Simple numeric charges
  docketCharges: 0,
  minWeightKg: 0,
  minCharges: 0,
  hamaliCharges: 0,
  greenTax: 0,
  miscCharges: 0,
  fuelSurchargePct: 0,

  // Card-based charges
  handlingCharges: createDefaultChargeCard(),
  rovCharges: createDefaultChargeCard(),
  codCharges: createDefaultChargeCard(),
  toPayCharges: createDefaultChargeCard(),
  appointmentCharges: createDefaultChargeCard(),
};

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for managing charges (mixed simple + card-based)
 */
export const useCharges = (
  onUpdate?: (charges: Charges) => void
): UseChargesReturn => {
  const [charges, setCharges] = useState<Charges>(defaultCharges);
  const [errors, setErrors] = useState<ChargesErrors>({});
  const firstErrorRef = useRef<HTMLElement | null>(null);

  // Throttled draft persistence
  useEffect(() => {
    const timer = setTimeout(() => {
      persistDraft({ charges });
      emitDebug('CHARGES_DRAFT_SAVED', charges);
    }, 400);

    return () => clearTimeout(timer);
  }, [charges]);

  // Notify parent of updates
  useEffect(() => {
    if (onUpdate) {
      onUpdate(charges);
    }
  }, [charges, onUpdate]);

  /**
   * Set a simple numeric charge field
   */
  const setCharge = useCallback(
    (field: keyof Charges, value: string | number) => {
      // Only handle simple numeric fields
      if (field in SIMPLE_CHARGE_RANGES) {
        const numValue = toNumberOrZero(value);

        setCharges((prev) => {
          const updated = { ...prev, [field]: numValue };
          emitDebug('CHARGE_FIELD_CHANGED', { field, value: numValue });
          return updated;
        });

        // Clear error for this field
        setErrors((prev) => {
          const updated = { ...prev };
          delete updated[field as keyof ChargesErrors];
          return updated;
        });
      }
    },
    []
  );

  /**
   * Set a field within a card-based charge
   */
  const setCardField = useCallback(
    (
      cardName: 'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges',
      field: keyof ChargeCardData,
      value: any
    ) => {
      setCharges((prev) => {
        const cardData = prev[cardName] as ChargeCardData;
        const updated = {
          ...prev,
          [cardName]: {
            ...cardData,
            [field]: value,
          },
        };
        emitDebug('CARD_FIELD_CHANGED', { cardName, field, value });
        return updated;
      });

      // Clear error for this specific field
      setErrors((prev) => {
        const cardErrors = prev[cardName] || {};
        const updatedCardErrors = { ...cardErrors };
        delete updatedCardErrors[field];

        return {
          ...prev,
          [cardName]: Object.keys(updatedCardErrors).length > 0 ? updatedCardErrors : undefined,
        };
      });
    },
    []
  );

  /**
   * Validate a simple numeric charge field
   */
  const validateField = useCallback(
    (field: keyof Charges): boolean => {
      // Only validate simple numeric fields
      if (!(field in SIMPLE_CHARGE_RANGES)) {
        return true;
      }

      const value = charges[field] as number;
      const range = SIMPLE_CHARGE_RANGES[field];

      // Special validation for fuel surcharge
      if (field === 'fuelSurchargePct') {
        const fuelError = validateFuel(value);
        if (fuelError) {
          setErrors((prev) => ({
            ...prev,
            fuelSurchargePct: fuelError,
          }));
          return false;
        }
      }

      // Check if in range
      if (!isNumberInRange(value, range.min, range.max)) {
        const error = field === 'fuelSurchargePct'
          ? `Must be between ${range.min} and ${range.max}`
          : 'Enter amount between 1-10,000';
        setErrors((prev) => ({
          ...prev,
          [field]: error,
        }));
        return false;
      }

      // Clear error if valid
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[field as keyof ChargesErrors];
        return updated;
      });

      return true;
    },
    [charges]
  );

  /**
   * Validate a single field within a card-based charge
   */
  const validateCardField = useCallback(
    (
      cardName: 'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges',
      field: keyof ChargeCardData
    ): boolean => {
      const cardData = charges[cardName] as ChargeCardData;
      let error = '';

      // Validate based on field type
      if (field === 'fixedAmount' && cardData.currency === 'INR' && cardData.mode === 'FIXED') {
        error = validateFixedAmount(cardData.fixedAmount);
      } else if (field === 'weightThreshold') {
        // Only validate weightThreshold for handlingCharges
        if (cardName === 'handlingCharges' && cardData.weightThreshold !== undefined) {
          error = validateWeightThreshold(cardData.weightThreshold);
        }
      }

      if (error) {
        setErrors((prev) => ({
          ...prev,
          [cardName]: {
            ...(prev[cardName] || {}),
            [field]: error,
          },
        }));
        return false;
      }

      // Clear error
      setErrors((prev) => {
        const cardErrors = { ...(prev[cardName] || {}) };
        delete cardErrors[field];
        return {
          ...prev,
          [cardName]: Object.keys(cardErrors).length > 0 ? cardErrors : undefined,
        };
      });

      return true;
    },
    [charges]
  );

  /**
   * Validate all charge fields
   */
  const validateAll = useCallback((): boolean => {
    let isValid = true;
    const newErrors: ChargesErrors = {};
    firstErrorRef.current = null;

    // Validate simple numeric charges
    Object.keys(SIMPLE_CHARGE_RANGES).forEach((field) => {
      const value = charges[field as keyof Charges] as number;
      const range = SIMPLE_CHARGE_RANGES[field];

      if (field === 'fuelSurchargePct') {
        const fuelError = validateFuel(value);
        if (fuelError) {
          newErrors.fuelSurchargePct = fuelError;
          isValid = false;
          return;
        }
      }

      if (!isNumberInRange(value, range.min, range.max)) {
        newErrors[field as keyof ChargesErrors] = field === 'fuelSurchargePct'
          ? `Must be between ${range.min} and ${range.max}`
          : 'Enter amount between 1-10,000';
        isValid = false;
      }
    });

    // Validate card-based charges
    const cardNames: Array<'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges'> = [
      'handlingCharges',
      'rovCharges',
      'codCharges',
      'toPayCharges',
      'appointmentCharges',
    ];

    cardNames.forEach((cardName) => {
      const cardData = charges[cardName] as ChargeCardData;
      // Only validate weightThreshold for handlingCharges
      const shouldValidateWeight = cardName === 'handlingCharges';
      const cardErrors = validateChargeCard(cardData, shouldValidateWeight);

      if (Object.keys(cardErrors).length > 0) {
        newErrors[cardName] = cardErrors;
        isValid = false;
      }
    });

    setErrors(newErrors);

    if (!isValid) {
      emitDebug('CHARGES_VALIDATION_FAILED', newErrors);
    } else {
      emitDebug('CHARGES_VALIDATION_PASSED');
    }

    return isValid;
  }, [charges]);

  /**
   * Reset to default state
   */
  const reset = useCallback(() => {
    setCharges(defaultCharges);
    setErrors({});
    firstErrorRef.current = null;
    emitDebug('CHARGES_RESET');
  }, []);

  /**
   * Load from draft
   */
  const loadFromDraft = useCallback((draft: Partial<Charges>) => {
    setCharges((prev) => ({
      ...prev,
      ...draft,
    }));
    emitDebug('CHARGES_LOADED_FROM_DRAFT', draft);
  }, []);

  return {
    charges,
    errors,
    setCharge,
    setCardField,
    validateField,
    validateCardField,
    validateAll,
    reset,
    loadFromDraft,
    firstErrorRef,
  };
};
