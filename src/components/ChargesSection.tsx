// src/components/ChargesSection.tsx
/**
 * ChargesSection component
 * Mixed layout: Simple numeric inputs + Compact charge cards
 *
 * Updated: SimpleChargeField now sanitizes & clamps numeric input on change/paste/key events
 * to prevent scientific notation, huge pasted numbers, and disallowed keys.
 */

import React from 'react';
import { UseChargesReturn } from '../hooks/useCharges';
import { CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { FUEL_SURCHARGE_OPTIONS, CHARGE_MAX, ChargeCardData } from '../utils/validators';
import { CompactChargeCard } from './CompactChargeCard';

// =============================================================================
// PROPS
// =============================================================================

interface ChargesSectionProps {
  charges: UseChargesReturn;
}

// =============================================================================
// Helpers (sanitize / clamp decimals)
// =============================================================================

/**
 * Keep only digits and at most one dot. Remove leading zeros (but keep single '0').
 * Return a normalized string with at most `precision` decimal places.
 */
function sanitizeDecimalString(raw: string, precision = 2) {
  if (!raw) return '';
  // remove spaces
  let s = String(raw).trim();

  // remove common thousand separators
  s = s.replace(/,/g, '');

  // Remove any character except digits and dot
  s = s.replace(/[^\d.]/g, '');

  // If multiple dots exist, keep first and remove rest
  const parts = s.split('.');
  if (parts.length > 1) {
    s = parts[0] + '.' + parts.slice(1).join('');
  }

  // Trim decimal places to requested precision
  if (s.includes('.')) {
    const [intPart, decPart] = s.split('.');
    const dec = decPart.slice(0, precision);
    s = `${intPart || '0'}${precision > 0 ? `.${dec}` : ''}`;
  }

  // Remove leading zeros unless it's "0" or "0.xxx"
  s = s.replace(/^0+([1-9])/,'$1'); // remove leading zeros before non-zero digit
  if (s.startsWith('.')) s = '0' + s;
  // ensure if empty then zero
  if (s === '') return '';

  return s;
}

/**
 * Clamp the numeric string to [min,max], return normalized string (without exponential notation).
 * If input is empty or not a number, returns ''.
 */
function clampDecimalString(raw: string, min: number, max: number, precision = 2) {
  const sanitized = sanitizeDecimalString(raw, precision);
  if (!sanitized) return '';

  const n = Number(sanitized);
  if (!Number.isFinite(n)) return '';

  const clamped = Math.min(Math.max(n, min), max);

  // Format to not produce exponential notation and keep precision decimals only when needed
  if (precision <= 0) return String(Math.round(clamped));
  // Remove trailing zeros from decimals while preserving precision up to requested
  let fixed = clamped.toFixed(precision);
  // Trim unnecessary zeros and dot if not needed
  fixed = fixed.replace(/\.?0+$/, '');
  return fixed;
}

// Block keys commonly used to produce scientific notation / signs
const BLOCKED_KEYS = new Set(['e', 'E', '+', '-']);

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface SimpleChargeFieldProps {
  label: string;
  name: string;
  value: number;
  onChange: (value: number) => void;
  onBlur: () => void;
  error?: string;
  min?: number;
  max?: number;
  suffix?: string;
  isDropdown?: boolean;
  dropdownOptions?: readonly number[];
  maxLength?: number;
  precision?: number; // decimals allowed, default 2
}

const SimpleChargeField: React.FC<SimpleChargeFieldProps> = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  min = 0,
  max = CHARGE_MAX,
  suffix = '₹',
  isDropdown = false,
  dropdownOptions,
  maxLength,
  precision = 2,
}) => {
  // value is number from hook; show as normalized string
  const displayed = value === null || value === undefined ? '' : String(value);

  const handleTextChange = (raw: string) => {
    // sanitize + clamp maintaining precision
    const clamped = clampDecimalString(raw, min, max, precision);
    // convert back to number for parent onChange (empty -> 0)
    const out = clamped === '' ? 0 : Number(clamped);
    onChange(out);
  }; 

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleTextChange(e.target.value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (BLOCKED_KEYS.has(e.key)) {
      e.preventDefault();
    }
    // Allow navigation keys, copy/paste keys etc.
    // Let browser handle other keys (digits, dot)
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData?.getData('text') ?? '';
    e.preventDefault();
    handleTextChange(pasted);
  };

  const onSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === '') {
      onChange(0);
      return;
    }
    const num = Number(v);
    if (!Number.isNaN(num)) onChange(num);
  };

  return (
    <div>
      <label
        htmlFor={name}
        className="block text-xs font-semibold text-slate-600 uppercase tracking-wider"
      >
        {label}
      </label>

      <div className="relative mt-1">
        {isDropdown && dropdownOptions ? (
          <select
            id={name}
            name={name}
            value={displayed}
            onChange={onSelectChange}
            onBlur={onBlur}
            className={`block w-full border rounded-lg shadow-sm px-3 py-2 text-sm text-slate-800
                       focus:outline-none focus:ring-1 focus:border-blue-500 transition bg-slate-50/70
                       ${error ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
          >
            {dropdownOptions.map((option) => (
              <option key={option} value={String(option)}>
                {option}
                {suffix}
              </option>
            ))}
            {/* allow custom via empty option (UI can provide a custom field elsewhere) */}
            <option value="">Custom</option>
          </select>
        ) : (
          <>
            <input
              type="text"
              id={name}
              name={name}
              value={displayed}
              onChange={onInputChange}
              onBlur={onBlur}
              inputMode="decimal"
              maxLength={maxLength}
              className={`block w-full border rounded-lg shadow-sm pl-3 pr-8 py-2 text-sm text-slate-800 placeholder-slate-400
                         focus:outline-none focus:ring-1 focus:border-blue-500 transition bg-slate-50/70
                         ${error ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
              placeholder={precision > 0 ? '0.00' : '0'}
              aria-invalid={!!error}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
            />
            {suffix && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">
                {suffix}
              </span>
            )}
          </>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ChargesSection: React.FC<ChargesSectionProps> = ({ charges }) => {
  const { charges: chargeValues, errors, setCharge, setCardField, validateField, validateCardField } = charges;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <CurrencyDollarIcon className="w-5 h-5 text-blue-500" />
        Basic Charges
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Docket Charges */}
        <SimpleChargeField
          label="Docket Charges"
          name="docketCharges"
          value={chargeValues.docketCharges}
          onChange={(val) => setCharge('docketCharges', val)}
          onBlur={() => validateField('docketCharges')}
          error={errors.docketCharges}
          suffix="₹"
          max={CHARGE_MAX}
          maxLength={10}
          precision={2}
        />

        {/* Min Weight */}
        <SimpleChargeField
          label="Min Chargeable Weight"
          name="minWeightKg"
          value={chargeValues.minWeightKg}
          onChange={(val) => setCharge('minWeightKg', val)}
          onBlur={() => validateField('minWeightKg')}
          error={errors.minWeightKg}
          suffix="KG"
          max={CHARGE_MAX}
          maxLength={7}
          precision={3} // weights can have 3 decimals if you like, adjust as needed
        />

        {/* Min Charges */}
        <SimpleChargeField
          label="Minimum Charges"
          name="minCharges"
          value={chargeValues.minCharges}
          onChange={(val) => setCharge('minCharges', val)}
          onBlur={() => validateField('minCharges')}
          error={errors.minCharges}
          suffix="₹"
          max={CHARGE_MAX}
          maxLength={10}
          precision={2}
        />

        {/* Hamali Charges */}
        <SimpleChargeField
          label="Hamali Charges"
          name="hamaliCharges"
          value={chargeValues.hamaliCharges}
          onChange={(val) => setCharge('hamaliCharges', val)}
          onBlur={() => validateField('hamaliCharges')}
          error={errors.hamaliCharges}
          suffix="₹"
          max={CHARGE_MAX}
          maxLength={10}
          precision={2}
        />

        {/* Green Tax */}
        <SimpleChargeField
          label="Green Tax / NGT"
          name="greenTax"
          value={chargeValues.greenTax}
          onChange={(val) => setCharge('greenTax', val)}
          onBlur={() => validateField('greenTax')}
          error={errors.greenTax}
          suffix="₹"
          max={CHARGE_MAX}
          maxLength={10}
          precision={2}
        />

        {/* Misc Charges */}
        <SimpleChargeField
          label="Misc / AOC Charges"
          name="miscCharges"
          value={chargeValues.miscCharges}
          onChange={(val) => setCharge('miscCharges', val)}
          onBlur={() => validateField('miscCharges')}
          error={errors.miscCharges}
          suffix="₹"
          max={CHARGE_MAX}
          maxLength={10}
          precision={2}
        />

        {/* Fuel Surcharge (dropdown + custom) */}
        <SimpleChargeField
          label="Fuel Surcharge"
          name="fuelSurchargePct"
          value={chargeValues.fuelSurchargePct}
          onChange={(val) => setCharge('fuelSurchargePct', val)}
          onBlur={() => validateField('fuelSurchargePct')}
          error={errors.fuelSurchargePct}
          suffix="%"
          max={40}
          isDropdown
          dropdownOptions={FUEL_SURCHARGE_OPTIONS}
          precision={0}
        />

        {/* Handling Charges */}
        <CompactChargeCard
          title="Handling"
          tooltip="Material handling and processing charges"
          cardName="handlingCharges"
          data={chargeValues.handlingCharges as ChargeCardData}
          errors={errors.handlingCharges || {}}
          onFieldChange={(field, value) => setCardField('handlingCharges', field, value)}
          onFieldBlur={(field) => validateCardField('handlingCharges', field)}
        />

        {/* ROV / FOV Charges */}
        <CompactChargeCard
          title="ROV / FOV"
          tooltip="Risk of Value / Freight on Value charges for high-value shipments"
          cardName="rovCharges"
          data={chargeValues.rovCharges as ChargeCardData}
          errors={errors.rovCharges || {}}
          onFieldChange={(field, value) => setCardField('rovCharges', field, value)}
          onFieldBlur={(field) => validateCardField('rovCharges', field)}
        />

        {/* COD / DOD Charges */}
        <CompactChargeCard
          title="COD / DOD"
          tooltip="Cash on Delivery / Delivery on Demand service charges"
          cardName="codCharges"
          data={chargeValues.codCharges as ChargeCardData}
          errors={errors.codCharges || {}}
          onFieldChange={(field, value) => setCardField('codCharges', field, value)}
          onFieldBlur={(field) => validateCardField('codCharges', field)}
        />

        {/* To-Pay Charges */}
        <CompactChargeCard
          title="To-Pay"
          tooltip="Charges for to-pay shipments"
          cardName="toPayCharges"
          data={chargeValues.toPayCharges as ChargeCardData}
          errors={errors.toPayCharges || {}}
          onFieldChange={(field, value) => setCardField('toPayCharges', field, value)}
          onFieldBlur={(field) => validateCardField('toPayCharges', field)}
        />

        {/* Appointment Charges */}
        <CompactChargeCard
          title="Appointment"
          tooltip="Scheduled delivery appointment charges"
          cardName="appointmentCharges"
          data={chargeValues.appointmentCharges as ChargeCardData}
          errors={errors.appointmentCharges || {}}
          onFieldChange={(field, value) => setCardField('appointmentCharges', field, value)}
          onFieldBlur={(field) => validateCardField('appointmentCharges', field)}
        />
      </div>
    </div>
  );
};

export default ChargesSection;
