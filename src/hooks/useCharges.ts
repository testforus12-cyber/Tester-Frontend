// /**
//  * useCharges hook
//  * Manages both simple numeric charges and card-based charges with complex validation
//  */

// import { useState, useCallback, useEffect, useRef } from 'react';
// import { Charges, validateFuel } from '../utils/validators';
// import {
//   ChargeCardData,
//   validateChargeCard,
//   validateFixedAmount,
//   validateWeightThreshold,
//   createDefaultChargeCard,
// } from '../utils/chargeValidators';
// import { toNumberOrZero, isNumberInRange } from '../utils/numbers';
// import { persistDraft } from '../store/draftStore';
// import { emitDebug } from '../utils/debug';

// // =============================================================================
// // TYPES
// // =============================================================================

// export interface ChargesErrors {
//   // Simple charges
//   docketCharges?: string;
//   minWeightKg?: string;
//   minCharges?: string;
//   hamaliCharges?: string;
//   greenTax?: string;
//   miscCharges?: string;
//   fuelSurchargePct?: string;

//   // Card-based charges (nested errors)
//   handlingCharges?: Record<string, string>;
//   rovCharges?: Record<string, string>;
//   codCharges?: Record<string, string>;
//   toPayCharges?: Record<string, string>;
//   appointmentCharges?: Record<string, string>;
// }

// export interface UseChargesReturn {
//   charges: Charges;
//   errors: ChargesErrors;
//   setCharge: (field: keyof Charges, value: string | number) => void;
//   setCardField: (
//     cardName: 'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges',
//     field: keyof ChargeCardData,
//     value: any
//   ) => void;
//   validateField: (field: keyof Charges) => boolean;
//   validateCardField: (
//     cardName: 'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges',
//     field: keyof ChargeCardData
//   ) => boolean;
//   validateAll: () => boolean;
//   reset: () => void;
//   loadFromDraft: (draft: Partial<Charges>) => void;
//   firstErrorRef: React.MutableRefObject<HTMLElement | null>;
// }

// // =============================================================================
// // FIELD RANGES (for simple numeric charges)
// // =============================================================================

// const SIMPLE_CHARGE_RANGES: Record<string, { min: number; max: number }> = {
//   docketCharges: { min: 1, max: 10000 },
//   minWeightKg: { min: 1, max: 10000 },
//   minCharges: { min: 1, max: 10000 },
//   hamaliCharges: { min: 1, max: 10000 },
//   greenTax: { min: 1, max: 10000 },
//   miscCharges: { min: 1, max: 10000 },
//   fuelSurchargePct: { min: 0, max: 40 },
// };

// // =============================================================================
// // DEFAULT STATE
// // =============================================================================

// const defaultCharges: Charges = {
//   // Simple numeric charges
//   docketCharges: 0,
//   minWeightKg: 0,
//   minCharges: 0,
//   hamaliCharges: 0,
//   greenTax: 0,
//   miscCharges: 0,
//   fuelSurchargePct: 0,

//   // Card-based charges
//   handlingCharges: createDefaultChargeCard(),
//   rovCharges: createDefaultChargeCard(),
//   codCharges: createDefaultChargeCard(),
//   toPayCharges: createDefaultChargeCard(),
//   appointmentCharges: createDefaultChargeCard(),
// };

// // =============================================================================
// // HOOK
// // =============================================================================

// /**
//  * Hook for managing charges (mixed simple + card-based)
//  */
// export const useCharges = (
//   onUpdate?: (charges: Charges) => void
// ): UseChargesReturn => {
//   const [charges, setCharges] = useState<Charges>(defaultCharges);
//   const [errors, setErrors] = useState<ChargesErrors>({});
//   const firstErrorRef = useRef<HTMLElement | null>(null);

//   // Throttled draft persistence
//   useEffect(() => {
//     const timer = setTimeout(() => {
//       persistDraft({ charges });
//       emitDebug('CHARGES_DRAFT_SAVED', charges);
//     }, 400);

//     return () => clearTimeout(timer);
//   }, [charges]);

//   // Notify parent of updates
//   useEffect(() => {
//     if (onUpdate) {
//       onUpdate(charges);
//     }
//   }, [charges, onUpdate]);

//   /**
//    * Set a simple numeric charge field
//    */
//   const setCharge = useCallback(
//     (field: keyof Charges, value: string | number) => {
//       // Only handle simple numeric fields
//       if (field in SIMPLE_CHARGE_RANGES) {
//         const numValue = toNumberOrZero(value);

//         setCharges((prev) => {
//           const updated = { ...prev, [field]: numValue };
//           emitDebug('CHARGE_FIELD_CHANGED', { field, value: numValue });
//           return updated;
//         });

//         // Clear error for this field
//         setErrors((prev) => {
//           const updated = { ...prev };
//           delete updated[field as keyof ChargesErrors];
//           return updated;
//         });
//       }
//     },
//     []
//   );

//   /**
//    * Set a field within a card-based charge
//    */
//   const setCardField = useCallback(
//     (
//       cardName: 'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges',
//       field: keyof ChargeCardData,
//       value: any
//     ) => {
//       setCharges((prev) => {
//         const cardData = prev[cardName] as ChargeCardData;
//         const updated = {
//           ...prev,
//           [cardName]: {
//             ...cardData,
//             [field]: value,
//           },
//         };
//         emitDebug('CARD_FIELD_CHANGED', { cardName, field, value });
//         return updated;
//       });

//       // Clear error for this specific field
//       setErrors((prev) => {
//         const cardErrors = prev[cardName] || {};
//         const updatedCardErrors = { ...cardErrors };
//         delete updatedCardErrors[field];

//         return {
//           ...prev,
//           [cardName]: Object.keys(updatedCardErrors).length > 0 ? updatedCardErrors : undefined,
//         };
//       });
//     },
//     []
//   );

//   /**
//    * Validate a simple numeric charge field
//    */
//   const validateField = useCallback(
//     (field: keyof Charges): boolean => {
//       // Only validate simple numeric fields
//       if (!(field in SIMPLE_CHARGE_RANGES)) {
//         return true;
//       }

//       const value = charges[field] as number;
//       const range = SIMPLE_CHARGE_RANGES[field];

//       // Special validation for fuel surcharge
//       if (field === 'fuelSurchargePct') {
//         const fuelError = validateFuel(value);
//         if (fuelError) {
//           setErrors((prev) => ({
//             ...prev,
//             fuelSurchargePct: fuelError,
//           }));
//           return false;
//         }
//       }

//       // Check if in range
//       if (!isNumberInRange(value, range.min, range.max)) {
//         const error = field === 'fuelSurchargePct'
//           ? `Must be between ${range.min} and ${range.max}`
//           : 'Enter amount between 1-10,000';
//         setErrors((prev) => ({
//           ...prev,
//           [field]: error,
//         }));
//         return false;
//       }

//       // Clear error if valid
//       setErrors((prev) => {
//         const updated = { ...prev };
//         delete updated[field as keyof ChargesErrors];
//         return updated;
//       });

//       return true;
//     },
//     [charges]
//   );

//   /**
//    * Validate a single field within a card-based charge
//    */
//   const validateCardField = useCallback(
//     (
//       cardName: 'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges',
//       field: keyof ChargeCardData
//     ): boolean => {
//       const cardData = charges[cardName] as ChargeCardData;
//       let error = '';

//       // Validate based on field type
//       if (field === 'fixedAmount' && cardData.currency === 'INR' && cardData.mode === 'FIXED') {
//         error = validateFixedAmount(cardData.fixedAmount);
//       } else if (field === 'weightThreshold') {
//         // Only validate weightThreshold for handlingCharges
//         if (cardName === 'handlingCharges' && cardData.weightThreshold !== undefined) {
//           error = validateWeightThreshold(cardData.weightThreshold);
//         }
//       }

//       if (error) {
//         setErrors((prev) => ({
//           ...prev,
//           [cardName]: {
//             ...(prev[cardName] || {}),
//             [field]: error,
//           },
//         }));
//         return false;
//       }

//       // Clear error
//       setErrors((prev) => {
//         const cardErrors = { ...(prev[cardName] || {}) };
//         delete cardErrors[field];
//         return {
//           ...prev,
//           [cardName]: Object.keys(cardErrors).length > 0 ? cardErrors : undefined,
//         };
//       });

//       return true;
//     },
//     [charges]
//   );

//   /**
//    * Validate all charge fields
//    */
//   const validateAll = useCallback((): boolean => {
//     let isValid = true;
//     const newErrors: ChargesErrors = {};
//     firstErrorRef.current = null;

//     // Validate simple numeric charges
//     Object.keys(SIMPLE_CHARGE_RANGES).forEach((field) => {
//       const value = charges[field as keyof Charges] as number;
//       const range = SIMPLE_CHARGE_RANGES[field];

//       if (field === 'fuelSurchargePct') {
//         const fuelError = validateFuel(value);
//         if (fuelError) {
//           newErrors.fuelSurchargePct = fuelError;
//           isValid = false;
//           return;
//         }
//       }

//       if (!isNumberInRange(value, range.min, range.max)) {
//         newErrors[field as keyof ChargesErrors] = field === 'fuelSurchargePct'
//           ? `Must be between ${range.min} and ${range.max}`
//           : 'Enter amount between 1-10,000';
//         isValid = false;
//       }
//     });

//     // Validate card-based charges
//     const cardNames: Array<'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges'> = [
//       'handlingCharges',
//       'rovCharges',
//       'codCharges',
//       'toPayCharges',
//       'appointmentCharges',
//     ];

//     cardNames.forEach((cardName) => {
//       const cardData = charges[cardName] as ChargeCardData;
//       // Only validate weightThreshold for handlingCharges
//       const shouldValidateWeight = cardName === 'handlingCharges';
//       const cardErrors = validateChargeCard(cardData, shouldValidateWeight);

//       if (Object.keys(cardErrors).length > 0) {
//         newErrors[cardName] = cardErrors;
//         isValid = false;
//       }
//     });

//     setErrors(newErrors);

//     if (!isValid) {
//       emitDebug('CHARGES_VALIDATION_FAILED', newErrors);
//     } else {
//       emitDebug('CHARGES_VALIDATION_PASSED');
//     }

//     return isValid;
//   }, [charges]);

//   /**
//    * Reset to default state
//    */
//   const reset = useCallback(() => {
//     setCharges(defaultCharges);
//     setErrors({});
//     firstErrorRef.current = null;
//     emitDebug('CHARGES_RESET');
//   }, []);

//   /**
//    * Load from draft
//    */
//   const loadFromDraft = useCallback((draft: Partial<Charges>) => {
//     setCharges((prev) => ({
//       ...prev,
//       ...draft,
//     }));
//     emitDebug('CHARGES_LOADED_FROM_DRAFT', draft);
//   }, []);

//   return {
//     charges,
//     errors,
//     setCharge,
//     setCardField,
//     validateField,
//     validateCardField,
//     validateAll,
//     reset,
//     loadFromDraft,
//     firstErrorRef,
//   };
//   // In src/hooks/useCharges.tsx

// const setCardMode = (
//   cardName: 'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges',
//   mode: 'fixed' | 'variable'
// ) => {
//   setCharges(prev => ({
//     ...prev,
//     [cardName]: {
//       ...prev[cardName],
//       mode
//     }
//   }));
// };

// // Then export it:
// return {
//   charges,
//   errors,
//   setCharge,
//   setCardField,
//   setCardMode,  // ✅ ADD THIS
//   validateField,
//   validateCardField,
//   validateAll,
//   reset,
// };
// };

import { useState, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface ChargeCard {
  mode: 'fixed' | 'variable';
  fixedAmount: number;
  variablePercent: number;
  weightThreshold?: number;
  unit?: string; // For handling charges: per_kg, per_box, per_piece
}

export interface ChargesData {
  minWeightKg: number;
  docketCharges: number;
  fuelSurchargePct: number;
  minCharges: number;
  greenTax: number;
  daccCharges: number;
  miscCharges: number;
  hamaliCharges: number;
  
  handlingCharges: ChargeCard;
  rovCharges: ChargeCard;
  codCharges: ChargeCard;
  toPayCharges: ChargeCard;
  appointmentCharges: ChargeCard;
}

export interface ChargesErrors {
  minWeightKg?: string;
  docketCharges?: string;
  fuelSurchargePct?: string;
  minCharges?: string;
  greenTax?: string;
  daccCharges?: string;
  miscCharges?: string;
  hamaliCharges?: string;
  
  handlingCharges?: Record<string, string>;
  rovCharges?: Record<string, string>;
  codCharges?: Record<string, string>;
  toPayCharges?: Record<string, string>;
  appointmentCharges?: Record<string, string>;
}

export interface UseChargesReturn {
  charges: ChargesData;
  errors: ChargesErrors;
  setCharge: (field: keyof ChargesData, value: number) => void;
  setCardField: (
    card: 'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges',
    field: keyof ChargeCard,
    value: number
  ) => void;
  setCardMode: (
    card: 'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges',
    mode: 'fixed' | 'variable'
  ) => void;
  setHandlingUnit: (unit: string) => void;
  validateField: (field: keyof ChargesData) => boolean;
  validateCardField: (
    card: 'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges',
    field: keyof ChargeCard
  ) => boolean;
  validateAll: () => boolean;
  hasErrors: () => boolean;
  reset: () => void;
  loadFromDraft?: (data: Partial<ChargesData>) => void;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialCharges: ChargesData = {
  minWeightKg: 0,
  docketCharges: 0,
  fuelSurchargePct: 0,
  minCharges: 0,
  greenTax: 0,
  daccCharges: 0,
  miscCharges: 0,
  hamaliCharges: 0,
  
  handlingCharges: {
    mode: 'fixed',
    fixedAmount: 0,
    variablePercent: 0,
    weightThreshold: 0,
    unit: 'per_kg'
  },
  rovCharges: {
    mode: 'fixed',
    fixedAmount: 0,
    variablePercent: 0
  },
  codCharges: {
    mode: 'fixed',
    fixedAmount: 0,
    variablePercent: 0
  },
  toPayCharges: {
    mode: 'fixed',
    fixedAmount: 0,
    variablePercent: 0
  },
  appointmentCharges: {
    mode: 'fixed',
    fixedAmount: 0,
    variablePercent: 0
  }
};

// =============================================================================
// HOOK
// =============================================================================

export const useCharges = (): UseChargesReturn => {
  const [charges, setCharges] = useState<ChargesData>(initialCharges);
  const [errors, setErrors] = useState<ChargesErrors>({});

  // Set simple field
  const setCharge = useCallback((field: keyof ChargesData, value: number) => {
    setCharges(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user types
    if (errors[field as keyof ChargesErrors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  }, [errors]);

  // Set charge card field
  const setCardField = useCallback((
    card: 'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges',
    field: keyof ChargeCard,
    value: number
  ) => {
    setCharges(prev => ({
      ...prev,
      [card]: {
        ...prev[card],
        [field]: value
      }
    }));
    
    // Clear error when user types
    if (errors[card]?.[field as string]) {
      setErrors(prev => ({
        ...prev,
        [card]: {
          ...prev[card],
          [field]: undefined
        }
      }));
    }
  }, [errors]);

  // Set charge card mode (fixed/variable)
  const setCardMode = useCallback((
    card: 'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges',
    mode: 'fixed' | 'variable'
  ) => {
    setCharges(prev => ({
      ...prev,
      [card]: {
        ...prev[card],
        mode
      }
    }));
  }, []);

  // Set handling unit (per_kg, per_box, per_piece)
  const setHandlingUnit = useCallback((unit: string) => {
    setCharges(prev => ({
      ...prev,
      handlingCharges: {
        ...prev.handlingCharges,
        unit
      }
    }));
  }, []);

  // Validate simple field
  const validateField = useCallback((field: keyof ChargesData): boolean => {
    const value = charges[field];
    
    if (typeof value === 'number') {
      // Simple field validation
      if (field === 'minWeightKg' && value <= 0) {
        setErrors(prev => ({ ...prev, [field]: 'Min weight must be greater than 0' }));
        return false;
      }
      
      if (field === 'fuelSurchargePct' && (value < 0 || value > 50)) {
        setErrors(prev => ({ ...prev, [field]: 'Fuel surcharge must be between 0-50%' }));
        return false;
      }
      
      if (value < 0) {
        setErrors(prev => ({ ...prev, [field]: 'Value cannot be negative' }));
        return false;
      }
      
      if (field !== 'fuelSurchargePct' && value > 10000) {
        setErrors(prev => ({ ...prev, [field]: 'Value cannot exceed 10,000' }));
        return false;
      }
    }
    
    setErrors(prev => ({ ...prev, [field]: undefined }));
    return true;
  }, [charges]);

  // Validate charge card field
  const validateCardField = useCallback((
    card: 'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges',
    field: keyof ChargeCard
  ): boolean => {
    const cardData = charges[card];
    const value = cardData[field as keyof typeof cardData];
    
    if (typeof value === 'number') {
      if (field === 'fixedAmount' && value > 10000) {
        setErrors(prev => ({
          ...prev,
          [card]: { ...prev[card], [field]: 'Fixed amount cannot exceed ₹10,000' }
        }));
        return false;
      }
      
      if (field === 'variablePercent' && (value < 0 || value > 5)) {
        setErrors(prev => ({
          ...prev,
          [card]: { ...prev[card], [field]: 'Variable percent must be between 0-5%' }
        }));
        return false;
      }
      
      if (field === 'weightThreshold' && value > 20000) {
        setErrors(prev => ({
          ...prev,
          [card]: { ...prev[card], [field]: 'Weight threshold cannot exceed 20,000 KG' }
        }));
        return false;
      }
      
      if (value < 0) {
        setErrors(prev => ({
          ...prev,
          [card]: { ...prev[card], [field]: 'Value cannot be negative' }
        }));
        return false;
      }
    }
    
    setErrors(prev => ({
      ...prev,
      [card]: { ...prev[card], [field]: undefined }
    }));
    return true;
  }, [charges]);

  // Validate all
  const validateAll = useCallback((): boolean => {
    let isValid = true;
    const newErrors: ChargesErrors = {};
    
    // Validate simple fields
    const simpleFields: (keyof ChargesData)[] = [
      'minWeightKg', 'docketCharges', 'fuelSurchargePct', 'minCharges',
      'greenTax', 'daccCharges', 'miscCharges', 'hamaliCharges'
    ];
    
    simpleFields.forEach(field => {
      const value = charges[field];
      
      if (typeof value === 'number') {
        if (field === 'minWeightKg' && value <= 0) {
          newErrors[field] = 'Min weight must be greater than 0';
          isValid = false;
        } else if (field === 'fuelSurchargePct' && (value < 0 || value > 50)) {
          newErrors[field] = 'Fuel surcharge must be between 0-50%';
          isValid = false;
        } else if (value < 0) {
          newErrors[field] = 'Value cannot be negative';
          isValid = false;
        } else if (field !== 'fuelSurchargePct' && value > 10000) {
          newErrors[field] = 'Value cannot exceed 10,000';
          isValid = false;
        }
      }
    });
    
    // Validate charge cards
    const cards: Array<'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges'> = [
      'handlingCharges', 'rovCharges', 'codCharges', 'toPayCharges', 'appointmentCharges'
    ];
    
    cards.forEach(card => {
      const cardData = charges[card];
      const cardErrors: Record<string, string> = {};
      
      if (cardData.mode === 'fixed' && cardData.fixedAmount > 10000) {
        cardErrors.fixedAmount = 'Fixed amount cannot exceed ₹10,000';
        isValid = false;
      }
      
      if (cardData.mode === 'variable' && (cardData.variablePercent < 0 || cardData.variablePercent > 5)) {
        cardErrors.variablePercent = 'Variable percent must be between 0-5%';
        isValid = false;
      }
      
      if (card === 'handlingCharges' && cardData.weightThreshold && cardData.weightThreshold > 20000) {
        cardErrors.weightThreshold = 'Weight threshold cannot exceed 20,000 KG';
        isValid = false;
      }
      
      if (Object.keys(cardErrors).length > 0) {
        newErrors[card] = cardErrors;
      }
    });
    
    setErrors(newErrors);
    return isValid;
  }, [charges]);

  // Reset
  const reset = useCallback(() => {
    setCharges(initialCharges);
    setErrors({});
  }, []);

  // Load from draft
  const loadFromDraft = useCallback((data: Partial<ChargesData>) => {
    setCharges(prev => ({
      ...prev,
      ...data,
      // Ensure charge cards have proper structure
      handlingCharges: {
        ...initialCharges.handlingCharges,
        ...data.handlingCharges
      },
      rovCharges: {
        ...initialCharges.rovCharges,
        ...data.rovCharges
      },
      codCharges: {
        ...initialCharges.codCharges,
        ...data.codCharges
      },
      toPayCharges: {
        ...initialCharges.toPayCharges,
        ...data.toPayCharges
      },
      appointmentCharges: {
        ...initialCharges.appointmentCharges,
        ...data.appointmentCharges
      }
    }));
  }, []);

  // Check if there are any errors
  const hasErrors = useCallback((): boolean => {
    // Check simple field errors
    const simpleFieldKeys: (keyof ChargesErrors)[] = [
      'minWeightKg', 'docketCharges', 'fuelSurchargePct', 'minCharges',
      'greenTax', 'daccCharges', 'miscCharges', 'hamaliCharges'
    ];
    
    for (const key of simpleFieldKeys) {
      if (errors[key]) return true;
    }
    
    // Check card errors
    const cardKeys: Array<'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges'> = [
      'handlingCharges', 'rovCharges', 'codCharges', 'toPayCharges', 'appointmentCharges'
    ];
    
    for (const key of cardKeys) {
      const cardError = errors[key];
      if (cardError && typeof cardError === 'object' && Object.keys(cardError).length > 0) {
        return true;
      }
    }
    
    return false;
  }, [errors]);

  return {
    charges,
    errors,
    setCharge,
    setCardField,
    setCardMode,
    setHandlingUnit,
    validateField,
    validateCardField,
    validateAll,
    hasErrors,
    reset,
    loadFromDraft
  };
};

export default useCharges;