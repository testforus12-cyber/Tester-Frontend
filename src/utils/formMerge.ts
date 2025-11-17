// src/utils/formMerge.ts
/**
 * Smart form data merge utilities
 * Prevents wizard/draft data from overwriting user input
 */

import { emitDebug } from './debug';

/**
 * Check if a value is "empty" (should be replaced)
 */
function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number') return false; // 0 is valid user input
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Check if a value appears to be a "default" value that should be replaced
 */
function isDefaultValue(value: any, field: string): boolean {
  // Known default values that should be replaced with user input
  const defaults: Record<string, any> = {
    volumetricDivisor: 2800,
    cftFactor: 5,
    fuelSurcharge: 15,
    fuel: 15,
    minChargeableWeight: 0,
    minWeight: 0,
    docketCharges: 0,
    minimumCharges: 0,
    minCharges: 0,
    greenTax: 0,
    daccCharges: 0,
    miscCharges: 0,
    hamaliCharges: 0,
    weightThreshold: 1, // Default is 1, but should prefer user input
    threshholdweight: 1,
  };

  if (field in defaults && value === defaults[field]) {
    return true;
  }

  return false;
}

/**
 * Merge wizard/draft data with current form state
 * Prioritizes user input over defaults
 * 
 * @param currentFormData - Current form state (user input)
 * @param incomingData - Data from wizard/draft
 * @param options - Merge options
 * @returns Merged data preserving user input
 */
export function smartMerge<T extends Record<string, any>>(
  currentFormData: T,
  incomingData: Partial<T>,
  options: {
    preserveUserInput?: boolean;
    allowOverwrite?: string[];
    forceDefaults?: Record<string, any>;
  } = {}
): T {
  const {
    preserveUserInput = true,
    allowOverwrite = ['priceMatrix', 'priceChart'], // Only these can overwrite
    forceDefaults = {},
  } = options;

  const merged = { ...currentFormData };

  emitDebug('SMART_MERGE_START', {
    currentFormData,
    incomingData,
    options,
  });

  for (const [key, incomingValue] of Object.entries(incomingData)) {
    const currentValue = currentFormData[key];

    // Apply forced defaults first
    if (key in forceDefaults) {
      merged[key] = forceDefaults[key];
      continue;
    }

    // Always allow specified fields to overwrite
    if (allowOverwrite.includes(key)) {
      merged[key] = incomingValue as any;
      continue;
    }

    // If preserving user input
    if (preserveUserInput) {
      // Keep user input if it exists and is not empty
      if (!isEmpty(currentValue)) {
        // If incoming value is a default, prefer user input
        if (isDefaultValue(incomingValue, key)) {
          merged[key] = currentValue;
          emitDebug('SMART_MERGE_PRESERVED_USER', { key, userValue: currentValue, ignoredDefault: incomingValue });
          continue;
        }
        
        // Keep user input
        merged[key] = currentValue;
        emitDebug('SMART_MERGE_KEPT_USER', { key, value: currentValue });
        continue;
      }
    }

    // Use incoming value if current is empty
    if (isEmpty(currentValue) && !isEmpty(incomingValue)) {
      merged[key] = incomingValue as any;
      emitDebug('SMART_MERGE_USED_INCOMING', { key, value: incomingValue });
    }
  }

  emitDebug('SMART_MERGE_RESULT', merged);
  return merged;
}

/**
 * Merge draft data with current form state
 * Special handling for nested objects
 */
export function mergeDraftData(
  currentState: {
    basics: any;
    geo: any;
    volumetric: any;
    charges: any;
  },
  draft: {
    basics?: any;
    geo?: any;
    volumetric?: any;
    charges?: any;
  },
  options?: {
    isWizardCompletion?: boolean;
  }
): typeof currentState {
  const { isWizardCompletion = false } = options || {};

  // If this is wizard completion, be very selective about what we merge
  if (isWizardCompletion) {
    emitDebug('WIZARD_COMPLETION_MERGE', { draft, currentState });
    
    // Only merge priceMatrix/priceChart, nothing else
    return {
      ...currentState,
      // Don't touch basics, geo, volumetric, or charges from wizard
      // These should only come from user input or create draft
    };
  }

  // Normal draft restoration
  return {
    basics: draft.basics 
      ? smartMerge(currentState.basics || {}, draft.basics, {
          forceDefaults: {
            fuelSurcharge: 0, // Always default to 0%
            fuel: 0,
          },
        })
      : currentState.basics,
    
    geo: draft.geo
      ? smartMerge(currentState.geo || {}, draft.geo)
      : currentState.geo,
    
    volumetric: draft.volumetric
      ? smartMerge(currentState.volumetric || {}, draft.volumetric)
      : currentState.volumetric,
    
    charges: draft.charges
      ? smartMerge(currentState.charges || {}, draft.charges, {
          forceDefaults: {
            weightThreshold: 0, // Always default to 0
            threshholdweight: 0,
          },
        })
      : currentState.charges,
  };
}

/**
 * Extract only priceMatrix from wizard data
 * Prevents wizard from polluting form state
 */
export function extractPriceMatrixOnly(wizardData: any): { priceMatrix: any } | null {
  if (!wizardData || !wizardData.priceMatrix) {
    return null;
  }

  emitDebug('EXTRACTING_PRICE_MATRIX_ONLY', {
    hasPriceMatrix: !!wizardData.priceMatrix,
    priceMatrixKeys: Object.keys(wizardData.priceMatrix || {}),
  });

  return {
    priceMatrix: wizardData.priceMatrix,
  };
}