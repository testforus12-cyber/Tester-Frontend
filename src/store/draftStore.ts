// src/store/draftStore.ts
/**
 * Draft storage for form data persistence
 * Updated: Added context-aware storage to prevent cross-contamination between create and edit flows
 * Version: v2.1 - Context Isolation Update
 */

import { emitDebug } from '../utils/debug';

// =============================================================================
// TYPES
// =============================================================================

export type ServiceMode = 'Road LTL' | 'Road FTL';

/**
 * Draft context to isolate create and edit flows
 * - 'create': Used in AddVendor component (creating new vendors)
 * - 'edit': Used in EditVendor component (editing existing vendors)
 */
export type DraftContext = 'create' | 'edit';

export interface VendorBasics {
  companyName: string;
  vendorPhoneNumber: string;
  vendorEmailAddress: string;
  gstin?: string;
  transportMode: 'road' | 'air' | 'rail' | 'ship';
  legalCompanyName: string;
  subVendor: string;
  vendorCode: string;
  primaryContactName: string;
  primaryContactPhone: string;
  primaryContactEmail: string;
  address: string;
  serviceModes: ServiceMode;
  companyRating: number;
}

export interface GeoData {
  pincode: string;
  state: string;
  city: string;
}

export interface VolumetricData {
  unit: 'cm' | 'in';
  volumetricDivisor: number | null;
  cftFactor: number | null;
}

export interface ChargeCardData {
  mode: 'FIXED' | 'VARIABLE';
  currency: 'INR' | 'USD';
  fixedAmount: number;
  variablePercent: number;
  weightThreshold?: number;
}

export interface ChargesData {
  docketCharges: number;
  minWeightKg: number;
  minCharges: number;
  hamaliCharges: number;
  greenTax: number;
  miscCharges: number;
  fuelSurchargePct: number;
  handlingCharges: ChargeCardData;
  rovCharges: ChargeCardData;
  codCharges: ChargeCardData;
  toPayCharges: ChargeCardData;
  appointmentCharges: ChargeCardData;
}

export interface Draft {
  basics?: Partial<VendorBasics>;
  geo?: Partial<GeoData>;
  volumetric?: Partial<VolumetricData>;
  charges?: Partial<ChargesData>;
  timestamp?: string;
  context?: DraftContext; // Track which context created this draft
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DRAFT_BASE_KEY = 'vendorDraft.v2';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate context-specific localStorage key
 * @param context - The draft context ('create' or 'edit')
 * @returns Full localStorage key with context suffix
 */
function getDraftKey(context: DraftContext = 'create'): string {
  return `${DRAFT_BASE_KEY}.${context}`;
}

// =============================================================================
// PUBLIC FUNCTIONS
// =============================================================================

/**
 * Read draft from localStorage
 * @param context - The draft context (defaults to 'create' for backward compatibility)
 * @returns Draft object or null if not found
 */
export function readDraft(context: DraftContext = 'create'): Draft | null {
  try {
    const key = getDraftKey(context);
    const raw = localStorage.getItem(key);
    if (!raw) {
      emitDebug('DRAFT_READ', { context, found: false });
      return null;
    }

    const parsed = JSON.parse(raw);
    emitDebug('DRAFT_READ', { context, found: true, data: parsed });
    return parsed;
  } catch (error) {
    emitDebug('DRAFT_READ_ERROR', { context, error });
    return null;
  }
}

/**
 * Persist draft to localStorage
 * @param partial - Partial draft data to merge with existing draft
 * @param context - The draft context (defaults to 'create' for backward compatibility)
 */
export function persistDraft(
  partial: Partial<Draft>,
  context: DraftContext = 'create'
): void {
  try {
    const existing = readDraft(context) || {};
    const updated: Draft = {
      ...existing,
      ...partial,
      timestamp: new Date().toISOString(),
      context, // Store the context in the draft
    };

    const key = getDraftKey(context);
    localStorage.setItem(key, JSON.stringify(updated));
    emitDebug('DRAFT_PERSISTED', { context, data: updated });
  } catch (error) {
    emitDebug('DRAFT_PERSIST_ERROR', { context, error });
  }
}

/**
 * Clear draft from localStorage
 * @param context - The draft context to clear (defaults to 'create' for backward compatibility)
 */
export function clearDraft(context: DraftContext = 'create'): void {
  try {
    const key = getDraftKey(context);
    localStorage.removeItem(key);
    emitDebug('DRAFT_CLEARED', { context });
  } catch (error) {
    emitDebug('DRAFT_CLEAR_ERROR', { context, error });
  }
}

/**
 * Check if draft exists
 * @param context - The draft context to check (defaults to 'create' for backward compatibility)
 * @returns true if draft exists, false otherwise
 */
export function hasDraft(context: DraftContext = 'create'): boolean {
  try {
    const key = getDraftKey(context);
    const exists = localStorage.getItem(key) !== null;
    emitDebug('DRAFT_CHECK', { context, exists });
    return exists;
  } catch {
    return false;
  }
}

/**
 * Clear all vendor drafts (both create and edit contexts)
 * Useful for complete cleanup or reset operations
 */
export function clearAllDrafts(): void {
  try {
    clearDraft('create');
    clearDraft('edit');
    // Also clear old format if it exists
    localStorage.removeItem(DRAFT_BASE_KEY);
    emitDebug('ALL_DRAFTS_CLEARED');
  } catch (error) {
    emitDebug('CLEAR_ALL_DRAFTS_ERROR', { error });
  }
}

/**
 * Get all existing drafts (for debugging or migration)
 * @returns Object with create and edit drafts
 */
export function getAllDrafts(): { create: Draft | null; edit: Draft | null } {
  return {
    create: readDraft('create'),
    edit: readDraft('edit'),
  };
}

/**
 * Migrate old draft format to new context-aware format
 * Call this once on app initialization if needed
 */
export function migrateOldDraft(): void {
  try {
    const oldDraft = localStorage.getItem(DRAFT_BASE_KEY);
    if (oldDraft) {
      // Move old draft to 'create' context
      localStorage.setItem(getDraftKey('create'), oldDraft);
      // Remove old key
      localStorage.removeItem(DRAFT_BASE_KEY);
      emitDebug('DRAFT_MIGRATED', { from: DRAFT_BASE_KEY, to: getDraftKey('create') });
    }
  } catch (error) {
    emitDebug('DRAFT_MIGRATION_ERROR', { error });
  }
}

// =============================================================================
// BACKWARD COMPATIBILITY NOTES
// =============================================================================

/**
 * BACKWARD COMPATIBILITY:
 * 
 * All existing function calls without context parameter will continue to work:
 * - readDraft() → Uses 'create' context (default)
 * - persistDraft(data) → Uses 'create' context (default)
 * - clearDraft() → Uses 'create' context (default)
 * - hasDraft() → Uses 'create' context (default)
 * 
 * This means existing AddVendor code works without changes.
 * Only need to add 'edit' context where needed in EditVendor.
 */

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/**
 * CREATE FLOW (AddVendor component):
 * 
 * // Read draft on mount
 * const draft = readDraft('create'); // or just readDraft()
 * 
 * // Save draft as user types
 * persistDraft({ basics: formData }, 'create'); // or just persistDraft({ basics: formData })
 * 
 * // Clear draft after successful save
 * clearDraft('create'); // or just clearDraft()
 * 
 * ----
 * 
 * EDIT FLOW (EditVendor component):
 * 
 * // Optional: Read draft on mount
 * const draft = readDraft('edit');
 * 
 * // Optional: Save draft as user types
 * persistDraft({ basics: formData }, 'edit');
 * 
 * // CRITICAL: Clear draft after successful save
 * clearDraft('edit'); // ← THIS IS THE KEY FIX
 */