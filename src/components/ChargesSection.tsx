// src/components/ChargesSection.tsx
/**
 * ChargesSection component - UPDATED VERSION
 * - Handling: per piece/box/kg dropdown (smaller, right side)
 * - Fixed rate max: 10,000 for all fields
 * - Variable rate: dropdown with specific percentages
 * - Weight threshold max: 20,000
 * - Auto-correct to limit with red error message
 * - Toggle turns blue when selected
 * - Fuel Surcharge: "Others" option enables manual input (max 50%)
 */

import React from 'react';
import { UseChargesReturn } from '../hooks/useCharges';

// =============================================================================
// PROPS
// =============================================================================

interface ChargesSectionProps {
  charges: UseChargesReturn;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Variable percentage options: 0.00%, 0.1%-1% (0.1 increments), 1.25%-2.5% (0.25 increments), 3%-5% (1% increments)
const VARIABLE_PERCENTAGE_OPTIONS = [
  0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
  1.25, 1.5, 1.75, 2.0, 2.25, 2.5,
  3.0, 4.0, 5.0
] as const;

const FUEL_OPTIONS = [
  { value: 0, label: '0%' },
  { value: 5, label: '5%' },
  { value: 10, label: '10%' },
  { value: 15, label: '15%' },
  { value: 20, label: '20%' },
  { value: 25, label: '25%' },
  { value: 30, label: '30%' },
  { value: 35, label: '35%' },
  { value: 40, label: '40%' },
  { value: 50, label: 'Others' }
] as const;

const HANDLING_UNIT_OPTIONS = [
  { value: 'per_kg', label: 'per kg' },
  { value: 'per_box', label: 'per box' },
  { value: 'per_piece', label: 'per piece' }
] as const;

// =============================================================================
// Helpers
// =============================================================================

function sanitizeDecimalString(raw: string, precision = 2) {
  if (!raw) return '';
  let s = String(raw).trim().replace(/,/g, '').replace(/[^\d.]/g, '');
  const parts = s.split('.');
  if (parts.length > 1) {
    s = parts[0] + '.' + parts.slice(1).join('');
  }
  if (s.includes('.')) {
    const [intPart, decPart] = s.split('.');
    const dec = decPart.slice(0, precision);
    s = `${intPart || '0'}${precision > 0 ? `.${dec}` : ''}`;
  }
  s = s.replace(/^0+([1-9])/, '$1');
  if (s.startsWith('.')) s = '0' + s;
  if (s === '') return '';
  return s;
}

function clampDecimalString(raw: string, min: number, max: number, precision = 2) {
  const sanitized = sanitizeDecimalString(raw, precision);
  if (!sanitized) return '';
  const n = Number(sanitized);
  if (!Number.isFinite(n)) return '';
  const clamped = Math.min(Math.max(n, min), max);
  if (precision <= 0) return String(Math.round(clamped));
  let fixed = clamped.toFixed(precision);
  fixed = fixed.replace(/\.?0+$/, '');
  return fixed;
}

const BLOCKED_KEYS = new Set(['e', 'E', '+', '-']);

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface SimpleFieldProps {
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
  precision?: number;
}

const SimpleField: React.FC<SimpleFieldProps> = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  min = 0,
  max = 10000,
  suffix = '₹',
  isDropdown = false,
  dropdownOptions,
  precision = 2,
}) => {
  const displayed = value === null || value === undefined ? '' : String(value);

  const handleTextChange = (raw: string) => {
    const clamped = clampDecimalString(raw, min, max, precision);
    const out = clamped === '' ? 0 : Number(clamped);
    
    // Check if value exceeds max
    const inputNum = Number(raw);
    if (inputNum > max) {
      onChange(max);
    } else {
      onChange(out);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleTextChange(e.target.value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (BLOCKED_KEYS.has(e.key)) {
      e.preventDefault();
    }
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
      <label htmlFor={name} className="block text-xs font-medium text-slate-700 mb-1 uppercase">
        {label}
      </label>
      <div className="relative">
        {isDropdown && dropdownOptions ? (
          <select
            id={name}
            name={name}
            value={displayed}
            onChange={onSelectChange}
            onBlur={onBlur}
            className={`block w-full border rounded-md shadow-sm px-3 py-2 text-sm
                       focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                       ${error ? 'border-red-500' : 'border-slate-300'}`}
          >
            {dropdownOptions.map((option) => {
              // Handle both simple numbers and {value, label} objects
              const optValue = typeof option === 'number' ? option : (option as any).value;
              const optLabel = typeof option === 'number' ? `${option}%` : (option as any).label;
              return (
                <option key={optValue} value={String(optValue)}>
                  {optLabel}
                </option>
              );
            })}
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
              className={`block w-full border rounded-md shadow-sm pl-3 pr-8 py-2 text-sm
                         focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                         ${error ? 'border-red-500' : 'border-slate-300'}`}
              placeholder="0"
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
// Charge Card Component - WITH WORKING TOGGLE & VARIABLE DROPDOWN
// =============================================================================

interface ChargeCardProps {
  title: string;
  tooltip?: string;
  mode: 'fixed' | 'variable';
  fixedValue: number;
  variableValue: number;
  weightThreshold?: number;
  showWeightThreshold?: boolean;
  handlingUnit?: string;
  showHandlingUnit?: boolean;
  onModeChange: (mode: 'fixed' | 'variable') => void;
  onFixedChange: (val: number) => void;
  onVariableChange: (val: number) => void;
  onWeightThresholdChange?: (val: number) => void;
  onHandlingUnitChange?: (unit: string) => void;
  onBlur: () => void;
  error?: Record<string, string>;
}

const ChargeCard: React.FC<ChargeCardProps> = ({
  title,
  tooltip,
  mode,
  fixedValue,
  variableValue,
  weightThreshold,
  showWeightThreshold = false,
  handlingUnit = 'per_kg',
  showHandlingUnit = false,
  onModeChange,
  onFixedChange,
  onVariableChange,
  onWeightThresholdChange,
  onHandlingUnitChange,
  onBlur,
  error,
}) => {
  const handleFixedChange = (raw: string) => {
    const clamped = clampDecimalString(raw, 0, 10000, 2);
    const val = clamped === '' ? 0 : Number(clamped);
    
    // Check if exceeded limit
    const inputNum = Number(raw);
    if (inputNum > 10000) {
      onFixedChange(10000);
    } else {
      onFixedChange(val);
    }
  };

  const handleWeightThresholdChange = (raw: string) => {
    if (!onWeightThresholdChange) return;
    
    const clamped = clampDecimalString(raw, 0, 20000, 3);
    const val = clamped === '' ? 0 : Number(clamped);
    
    // Check if exceeded limit
    const inputNum = Number(raw);
    if (inputNum > 20000) {
      onWeightThresholdChange(20000);
    } else {
      onWeightThresholdChange(val);
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        {tooltip && (
          <div className="group relative">
            <span className="cursor-help text-slate-400">ⓘ</span>
            <div className="hidden group-hover:block absolute z-10 w-48 p-2 text-xs bg-slate-800 text-white rounded shadow-lg -top-2 left-6">
              {tooltip}
            </div>
          </div>
        )}
      </div>

      {/* Per kg/box/piece dropdown for Handling - Smaller, Right Side */}
      {showHandlingUnit && (
        <div className="mb-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-slate-700">
              Per Kg
            </label>
            <select 
              value={handlingUnit}
              onChange={(e) => onHandlingUnitChange?.(e.target.value)}
              className="border border-slate-300 rounded-md px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 w-24"
            >
              {HANDLING_UNIT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Toggle buttons - WORKING, TURNS BLUE */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => onModeChange('fixed')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded border transition-colors
            ${mode === 'fixed' 
              ? 'border-blue-500 bg-blue-500 text-white' 
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
        >
          Fixed ₹
        </button>
        <button
          type="button"
          onClick={() => onModeChange('variable')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded border transition-colors
            ${mode === 'variable' 
              ? 'border-blue-500 bg-blue-500 text-white' 
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
        >
          Variable %
        </button>
      </div>

      {/* Conditional rendering based on mode */}
      {mode === 'fixed' ? (
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Fixed Rate
          </label>
          <div className="relative">
            <input
              type="text"
              value={fixedValue || '0'}
              onChange={(e) => handleFixedChange(e.target.value)}
              onBlur={onBlur}
              inputMode="decimal"
              className={`block w-full border rounded-md shadow-sm pl-3 pr-8 py-2 text-sm
                         focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                         ${error?.fixedAmount ? 'border-red-500' : 'border-slate-300'}`}
              placeholder="0"
              onKeyDown={(e) => BLOCKED_KEYS.has(e.key) && e.preventDefault()}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">
              ₹
            </span>
          </div>
          {error?.fixedAmount && (
            <p className="mt-1 text-xs text-red-600">{error.fixedAmount}</p>
          )}
          {/* Show limit error if value exceeds 10000 */}
          {fixedValue > 10000 && (
            <p className="mt-1 text-xs text-red-600">
              Maximum fixed rate is ₹10,000. Value auto-corrected to limit.
            </p>
          )}
        </div>
      ) : (
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Variable Rate
          </label>
          <select
            value={variableValue}
            onChange={(e) => onVariableChange(Number(e.target.value))}
            onBlur={onBlur}
            className={`block w-full border rounded-md shadow-sm px-3 py-2 text-sm
                       focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                       ${error?.variablePercent ? 'border-red-500' : 'border-slate-300'}`}
          >
            {VARIABLE_PERCENTAGE_OPTIONS.map((percent) => (
              <option key={percent} value={percent}>
                {percent.toFixed(2)}%
              </option>
            ))}
          </select>
          {error?.variablePercent && (
            <p className="mt-1 text-xs text-red-600">{error.variablePercent}</p>
          )}
        </div>
      )}

      {/* Weight Threshold (only for Handling) */}
      {showWeightThreshold && onWeightThresholdChange && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Weight Threshold (KG)
          </label>
          <div className="relative">
            <input
              type="text"
              value={weightThreshold || '1'}
              onChange={(e) => handleWeightThresholdChange(e.target.value)}
              onBlur={onBlur}
              inputMode="decimal"
              className={`block w-full border rounded-md shadow-sm pl-3 pr-8 py-2 text-sm
                         focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                         ${error?.weightThreshold ? 'border-red-500' : 'border-slate-300'}`}
              placeholder="1"
              onKeyDown={(e) => BLOCKED_KEYS.has(e.key) && e.preventDefault()}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">
              KG
            </span>
          </div>
          {error?.weightThreshold && (
            <p className="mt-1 text-xs text-red-600">{error.weightThreshold}</p>
          )}
          {/* Show limit error if value exceeds 20000 */}
          {(weightThreshold && weightThreshold > 20000) && (
            <p className="mt-1 text-xs text-red-600">
              Maximum weight threshold is 20,000 KG. Value auto-corrected to limit.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ChargesSection: React.FC<ChargesSectionProps> = ({ charges }) => {
  const { 
    charges: chargeValues, 
    errors, 
    setCharge, 
    setCardField, 
    setCardMode,
    setHandlingUnit,
    validateField, 
    validateCardField 
  } = charges;

  // State to track if "Others" is selected for Fuel Surcharge
  const [isFuelOthers, setIsFuelOthers] = React.useState(false);
  const [fuelCustomValue, setFuelCustomValue] = React.useState('');
  const [fuelExceedsLimit, setFuelExceedsLimit] = React.useState(false);

  // Check if current value is in predefined options
  React.useEffect(() => {
    const predefinedValues = [0, 5, 10, 15, 20, 25, 30, 35, 40];
    const isInOptions = predefinedValues.includes(chargeValues.fuelSurchargePct);
    if (!isInOptions) {
      setIsFuelOthers(true);
      setFuelCustomValue(String(chargeValues.fuelSurchargePct));
    }
  }, []);

  const handleFuelDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '50') {
      // Others selected
      setIsFuelOthers(true);
      setFuelCustomValue('');
      setFuelExceedsLimit(false);
    } else {
      setIsFuelOthers(false);
      setFuelExceedsLimit(false);
      setCharge('fuelSurchargePct', Number(value));
    }
  };

  const handleFuelCustomChange = (raw: string) => {
    setFuelCustomValue(raw);
    const clamped = clampDecimalString(raw, 0, 50, 2);
    const val = clamped === '' ? 0 : Number(clamped);
    
    // Check if exceeds 50
    const inputNum = parseFloat(raw);
    if (!isNaN(inputNum) && inputNum > 50) {
      setFuelExceedsLimit(true);
      setCharge('fuelSurchargePct', 50);
      setFuelCustomValue('50');
    } else {
      setFuelExceedsLimit(false);
      setCharge('fuelSurchargePct', val);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Price Rate Configuration</h2>

      {/* Top Row: 4 fields - MAX 10000 for all */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SimpleField
          label="Min Chargeable Weight (KG) *"
          name="minWeightKg"
          value={chargeValues.minWeightKg}
          onChange={(val) => setCharge('minWeightKg', val)}
          onBlur={() => validateField('minWeightKg')}
          error={errors.minWeightKg || (chargeValues.minWeightKg > 10000 ? 'Max limit is 10,000' : undefined)}
          suffix="KG"
          max={10000}
          precision={3}
        />

        <SimpleField
          label="Docket Charges (₹) *"
          name="docketCharges"
          value={chargeValues.docketCharges}
          onChange={(val) => setCharge('docketCharges', val)}
          onBlur={() => validateField('docketCharges')}
          error={errors.docketCharges || (chargeValues.docketCharges > 10000 ? 'Max limit is ₹10,000' : undefined)}
          suffix="₹"
          max={10000}
          precision={2}
        />

        {/* Fuel Surcharge with "Others" option */}
        <div>
          <label htmlFor="fuelSurchargePct" className="block text-xs font-medium text-slate-700 mb-1 uppercase">
            Fuel Surcharge (%) *
          </label>
          {!isFuelOthers ? (
            <select
              id="fuelSurchargePct"
              name="fuelSurchargePct"
              value={chargeValues.fuelSurchargePct}
              onChange={handleFuelDropdownChange}
              onBlur={() => validateField('fuelSurchargePct')}
              className={`block w-full border rounded-md shadow-sm px-3 py-2 text-sm
                         focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                         ${errors.fuelSurchargePct ? 'border-red-500' : 'border-slate-300'}`}
            >
              {FUEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  id="fuelSurchargePct"
                  name="fuelSurchargePct"
                  value={fuelCustomValue}
                  onChange={(e) => handleFuelCustomChange(e.target.value)}
                  onBlur={() => validateField('fuelSurchargePct')}
                  inputMode="decimal"
                  className={`block w-full border rounded-md shadow-sm pl-3 pr-8 py-2 text-sm
                             focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                             ${errors.fuelSurchargePct || fuelExceedsLimit ? 'border-red-500' : 'border-slate-300'}`}
                  placeholder="Enter 0-50"
                  onKeyDown={(e) => BLOCKED_KEYS.has(e.key) && e.preventDefault()}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">
                  %
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsFuelOthers(false);
                  setFuelExceedsLimit(false);
                  setFuelCustomValue('');
                }}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Back to dropdown
              </button>
            </div>
          )}
          {errors.fuelSurchargePct && (
            <p className="mt-1 text-xs text-red-600">{errors.fuelSurchargePct}</p>
          )}
          {fuelExceedsLimit && (
            <p className="mt-1 text-xs text-red-600">
              Maximum fuel surcharge is 50%. Value auto-corrected to limit.
            </p>
          )}
        </div>

        <SimpleField
          label="Minimum Charges (₹) *"
          name="minCharges"
          value={chargeValues.minCharges}
          onChange={(val) => setCharge('minCharges', val)}
          onBlur={() => validateField('minCharges')}
          error={errors.minCharges || (chargeValues.minCharges > 10000 ? 'Max limit is ₹10,000' : undefined)}
          suffix="₹"
          max={10000}
          precision={2}
        />
      </div>

      {/* Second Row: 4 fields - MAX 10000 for all */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SimpleField
          label="Green Tax (₹)/NGT Charge *"
          name="greenTax"
          value={chargeValues.greenTax}
          onChange={(val) => setCharge('greenTax', val)}
          onBlur={() => validateField('greenTax')}
          error={errors.greenTax || (chargeValues.greenTax > 10000 ? 'Max limit is ₹10,000' : undefined)}
          suffix="₹"
          max={10000}
          precision={2}
        />

        <SimpleField
          label="DACC Charges (₹) *"
          name="daccCharges"
          value={chargeValues.daccCharges || 0}
          onChange={(val) => setCharge('daccCharges', val)}
          onBlur={() => validateField('daccCharges')}
          error={errors.daccCharges || (chargeValues.daccCharges > 10000 ? 'Max limit is ₹10,000' : undefined)}
          suffix="₹"
          max={10000}
          precision={2}
        />

        <SimpleField
          label="Miscellaneous/AOC Charges (₹) *"
          name="miscCharges"
          value={chargeValues.miscCharges}
          onChange={(val) => setCharge('miscCharges', val)}
          onBlur={() => validateField('miscCharges')}
          error={errors.miscCharges || (chargeValues.miscCharges > 10000 ? 'Max limit is ₹10,000' : undefined)}
          suffix="₹"
          max={10000}
          precision={2}
        />

        <SimpleField
          label="Hamali Charges (₹) *"
          name="hamaliCharges"
          value={chargeValues.hamaliCharges}
          onChange={(val) => setCharge('hamaliCharges', val)}
          onBlur={() => validateField('hamaliCharges')}
          error={errors.hamaliCharges || (chargeValues.hamaliCharges > 10000 ? 'Max limit is ₹10,000' : undefined)}
          suffix="₹"
          max={10000}
          precision={2}
        />
      </div>

      {/* Charge Cards Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Handling Charges */}
        <ChargeCard
          title="Handling"
          tooltip="Material handling and processing charges"
          mode={chargeValues.handlingCharges?.mode || 'fixed'}
          fixedValue={chargeValues.handlingCharges?.fixedAmount || 0}
          variableValue={chargeValues.handlingCharges?.variablePercent || 0}
          weightThreshold={chargeValues.handlingCharges?.weightThreshold || 1}
          handlingUnit={chargeValues.handlingCharges?.unit || 'per_kg'}
          showWeightThreshold={true}
          showHandlingUnit={true}
          onModeChange={(mode) => setCardMode('handlingCharges', mode)}
          onFixedChange={(val) => setCardField('handlingCharges', 'fixedAmount', val)}
          onVariableChange={(val) => setCardField('handlingCharges', 'variablePercent', val)}
          onWeightThresholdChange={(val) => setCardField('handlingCharges', 'weightThreshold', val)}
          onHandlingUnitChange={(unit) => setHandlingUnit?.(unit)}
          onBlur={() => validateCardField('handlingCharges', 'fixedAmount')}
          error={errors.handlingCharges}
        />

        {/* ROV / FOV Charges */}
        <ChargeCard
          title="ROV / FOV"
          tooltip="Risk of Value / Freight on Value charges"
          mode={chargeValues.rovCharges?.mode || 'fixed'}
          fixedValue={chargeValues.rovCharges?.fixedAmount || 0}
          variableValue={chargeValues.rovCharges?.variablePercent || 0}
          onModeChange={(mode) => setCardMode('rovCharges', mode)}
          onFixedChange={(val) => setCardField('rovCharges', 'fixedAmount', val)}
          onVariableChange={(val) => setCardField('rovCharges', 'variablePercent', val)}
          onBlur={() => validateCardField('rovCharges', 'fixedAmount')}
          error={errors.rovCharges}
        />

        {/* COD / DOD Charges */}
        <ChargeCard
          title="COD / DOD"
          tooltip="Cash on Delivery / Delivery on Demand charges"
          mode={chargeValues.codCharges?.mode || 'fixed'}
          fixedValue={chargeValues.codCharges?.fixedAmount || 0}
          variableValue={chargeValues.codCharges?.variablePercent || 0}
          onModeChange={(mode) => setCardMode('codCharges', mode)}
          onFixedChange={(val) => setCardField('codCharges', 'fixedAmount', val)}
          onVariableChange={(val) => setCardField('codCharges', 'variablePercent', val)}
          onBlur={() => validateCardField('codCharges', 'fixedAmount')}
          error={errors.codCharges}
        />
      </div>

      {/* Charge Cards Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* To-Pay Charges */}
        <ChargeCard
          title="To-Pay"
          tooltip="Charges for to-pay shipments"
          mode={chargeValues.toPayCharges?.mode || 'fixed'}
          fixedValue={chargeValues.toPayCharges?.fixedAmount || 0}
          variableValue={chargeValues.toPayCharges?.variablePercent || 0}
          onModeChange={(mode) => setCardMode('toPayCharges', mode)}
          onFixedChange={(val) => setCardField('toPayCharges', 'fixedAmount', val)}
          onVariableChange={(val) => setCardField('toPayCharges', 'variablePercent', val)}
          onBlur={() => validateCardField('toPayCharges', 'fixedAmount')}
          error={errors.toPayCharges}
        />

        {/* Appointment Charges */}
        <ChargeCard
          title="Appointment"
          tooltip="Scheduled delivery appointment charges"
          mode={chargeValues.appointmentCharges?.mode || 'fixed'}
          fixedValue={chargeValues.appointmentCharges?.fixedAmount || 0}
          variableValue={chargeValues.appointmentCharges?.variablePercent || 0}
          onModeChange={(mode) => setCardMode('appointmentCharges', mode)}
          onFixedChange={(val) => setCardField('appointmentCharges', 'fixedAmount', val)}
          onVariableChange={(val) => setCardField('appointmentCharges', 'variablePercent', val)}
          onBlur={() => validateCardField('appointmentCharges', 'fixedAmount')}
          error={errors.appointmentCharges}
        />

        {/* Empty slot for alignment */}
        <div></div>
      </div>
    </div>
  );
};

export default ChargesSection;