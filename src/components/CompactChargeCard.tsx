

import React, { useRef } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import {
  ChargeCardData,
  Unit,
  Currency,
  Mode,
  VariableRange,
  UNIT_OPTIONS,
  VARIABLE_RANGES,
} from '../utils/chargeValidators';

// =============================================================================
// PROPS
// =============================================================================

interface CompactChargeCardProps {
  title: string;
  tooltip: string;
  cardName: 'handlingCharges' | 'rovCharges' | 'codCharges' | 'toPayCharges' | 'appointmentCharges';
  data: ChargeCardData;
  errors: Record<string, string>;
  onFieldChange: (field: keyof ChargeCardData, value: any) => void;
  onFieldBlur: (field: keyof ChargeCardData) => void;
  allowVariable?: boolean; // kept for compatibility but no longer used
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CompactChargeCard: React.FC<CompactChargeCardProps> = ({
  title,
  tooltip,
  cardName,
  data,
  errors,
  onFieldChange,
  onFieldBlur,
  allowVariable = false, // ignored now – all cards support variable
}) => {
  const fixedInputRef = useRef<HTMLInputElement>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);

  // 🔹 All charges now support Variable %
  const supportsVariablePercent = true;

  const isFixedRupee = data.currency === 'INR' && data.mode === 'FIXED';
  const isVariablePercent = data.currency === 'PERCENT' && data.mode === 'VARIABLE';

  const showFixed = isFixedRupee;                   // show fixed only when Fixed is selected
  const showVariable = isVariablePercent && supportsVariablePercent;

  const MAX_FIXED = 10000; // 🔹 new limit

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
      {/* Header + toggle + Fixed */}
      <div className="mb-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            {tooltip && (
              <div className="group relative">
                <InformationCircleIcon className="w-4 h-4 text-slate-400 cursor-help" />
                <div
                  className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg
                                opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 whitespace-normal"
                >
                  {tooltip}
                </div>
              </div>
            )}
          </div>

          {/* Unit Selector (only for Handling Charges) */}
          {cardName === 'handlingCharges' && (
            <select
              value={data.unit}
              onChange={(e) => onFieldChange('unit', e.target.value as Unit)}
              className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label={`${title} unit`}
            >
              {UNIT_OPTIONS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 🔹 Fixed / Variable toggle – directly under heading, consistent position */}
        {supportsVariablePercent && (
          <div className="inline-flex bg-slate-100 p-1 rounded-full mb-3">
            <button
              type="button"
              onClick={() => {
                onFieldChange('currency', 'INR' as Currency);
                onFieldChange('mode', 'FIXED' as Mode);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition
                ${
                  isFixedRupee
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:text-slate-800'
                }`}
              aria-pressed={isFixedRupee}
              aria-label="Fixed Rupees"
            >
              Fixed ₹
            </button>
            <button
              type="button"
              onClick={() => {
                onFieldChange('currency', 'PERCENT' as Currency);
                onFieldChange('mode', 'VARIABLE' as Mode);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition
                ${
                  isVariablePercent
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:text-slate-800'
                }`}
              aria-pressed={isVariablePercent}
              aria-label="Variable Percentage"
            >
              Variable %
            </button>
          </div>
        )}

        {/* Fixed Rate Input (just under toggle, only when Fixed selected) */}
        {showFixed && (
          <div>
            <label
              htmlFor={`${cardName}-fixed`}
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Fixed Rate
            </label>
            <div className="relative">
              <input
                ref={fixedInputRef}
                type="number"
                id={`${cardName}-fixed`}
                value={data.fixedAmount || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const num = val === '' ? 0 : parseFloat(val);
                  // clamp at 10,000 in UI
                  const safe = Number.isFinite(num) && num > MAX_FIXED ? MAX_FIXED : num;
                  onFieldChange('fixedAmount', safe);
                }}
                onBlur={() => onFieldBlur('fixedAmount')}
                min={1}
                max={MAX_FIXED} // 🔹 changed from 5000 to 10000
                className={`block w-full border rounded-lg shadow-sm pl-3 pr-8 py-2 text-sm text-slate-800 placeholder-slate-400
                           focus:outline-none focus:ring-1 focus:border-blue-500 transition bg-slate-50/70
                           ${
                             errors.fixedAmount
                               ? 'border-red-500 focus:ring-red-500'
                               : 'border-slate-300 focus:ring-blue-500'
                           }`}
                placeholder="0"
                aria-invalid={!!errors.fixedAmount}
                aria-describedby={errors.fixedAmount ? `${cardName}-fixed-error` : undefined}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">
                ₹
              </span>
            </div>
            {errors.fixedAmount && (
              <p id={`${cardName}-fixed-error`} className="mt-1 text-xs text-red-600">
                {errors.fixedAmount}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Variable Range Dropdown (show when Variable % selected) */}
      {showVariable && (
        <div className="mb-4">
          <label
            htmlFor={`${cardName}-variable`}
            className="block text-xs font-semibold text-slate-600 mb-1"
          >
            Percentage Range
          </label>
          <select
            id={`${cardName}-variable`}
            value={data.variableRange}
            onChange={(e) => onFieldChange('variableRange', e.target.value as VariableRange)}
            onBlur={() => onFieldBlur('variableRange')}
            className={`block w-full border rounded-lg shadow-sm px-3 py-2 text-sm text-slate-800
                       focus:outline-none focus:ring-1 focus:border-blue-500 transition bg-slate-50/70
                       ${
                         errors.variableRange
                           ? 'border-red-500 focus:ring-red-500'
                           : 'border-slate-300 focus:ring-blue-500'
                       }`}
            aria-invalid={!!errors.variableRange}
            aria-describedby={errors.variableRange ? `${cardName}-variable-error` : undefined}
          >
            {VARIABLE_RANGES.map((range) => (
              <option key={range} value={range}>
                {range}
              </option>
            ))}
          </select>
          {errors.variableRange && (
            <p id={`${cardName}-variable-error`} className="mt-1 text-xs text-red-600">
              {errors.variableRange}
            </p>
          )}
        </div>
      )}

      {/* Weight Threshold (only show for Handling Charges) */}
      {cardName === 'handlingCharges' && (
        <div>
          <label
            htmlFor={`${cardName}-weight`}
            className="block text-xs font-semibold text-slate-600 mb-1"
          >
            Weight Threshold (KG)
          </label>
          <div className="relative">
            <input
              ref={weightInputRef}
              type="number"
              id={`${cardName}-weight`}
              value={data.weightThreshold || ''}
              onChange={(e) => {
                const val = e.target.value;
                onFieldChange('weightThreshold', val === '' ? 0 : parseFloat(val));
              }} // 🔹 fixed extra brace bug
              onBlur={() => onFieldBlur('weightThreshold')}
              min={1}
              max={20000}
              className={`block w-full border rounded-lg shadow-sm pl-3 pr-10 py-2 text-sm text-slate-800 placeholder-slate-400
                         focus:outline-none focus:ring-1 focus:border-blue-500 transition bg-slate-50/70
                         ${
                           errors.weightThreshold
                             ? 'border-red-500 focus:ring-red-500'
                             : 'border-slate-300 focus:ring-blue-500'
                         }`}
              placeholder="0"
              aria-invalid={!!errors.weightThreshold}
              aria-describedby={
                errors.weightThreshold ? `${cardName}-weight-error` : undefined
              }
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">
              KG
            </span>
          </div>
          {errors.weightThreshold && (
            <p id={`${cardName}-weight-error`} className="mt-1 text-xs text-red-600">
              {errors.weightThreshold}
            </p>
          )}
        </div>
      )}
    </div>
  );
};





