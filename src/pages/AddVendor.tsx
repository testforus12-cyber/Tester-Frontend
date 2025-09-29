import { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { PlusCircleIcon, CheckCircleIcon, InformationCircleIcon, ChevronDownIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
// Replaced missing indianStatesDistricts module with data from public/pincodes.json
import { useAuth } from '../hooks/useAuth';

// Local types
type PincodeEntry = { pincode: string; state: string; city: string; zone?: string };

// Transport Mode Options
const TRANSPORT_MODES = [
  { value: "road", label: "Road" },
  { value: "air", label: "Air" },
  { value: "rail", label: "Rail" },
  { value: "ship", label: "Ship" }
];

// HELPER COMPONENT: StyledInputField with Error Support
const StyledInputField = ({
  name,
  label,
  value,
  onChange,
  onBlur,
  onKeyDown,
  type = "text",
  maxLength,
  min,
  max,
  error,
  required = true,
  readOnly = false
}: {
  name: string;
  label: string;
  value?: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  type?: "text" | "number" | "email";
  maxLength?: number;
  min?: number;
  max?: number;
  error?: string;
  required?: boolean;
  readOnly?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    <label htmlFor={name} className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      min={min}
      max={max}
      maxLength={maxLength}
      readOnly={readOnly}
      className={`mt-1 block w-full border rounded-lg shadow-sm px-3 py-2 text-sm text-slate-800 placeholder-slate-400
                 focus:outline-none focus:ring-1 focus:border-blue-500 transition
                 ${readOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-slate-50/70'}
                 ${error ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
      required={required}
    />
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

// HELPER COMPONENT: Dropdown Field
const DropdownField = ({
  name,
  label,
  value,
  onChange,
  options,
  error,
  required = true
}: {
  name: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
}) => (
  <div>
    <label htmlFor={name} className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className={`mt-1 block w-full bg-slate-50/70 border rounded-lg shadow-sm px-3 py-2 text-sm text-slate-800
                 focus:outline-none focus:ring-1 focus:border-blue-500 transition
                 ${error ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
      required={required}
    >
      <option value="">Select {label}</option>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

// HELPER COMPONENT: RatingSlider
const RatingSlider = ({
  label,
  value,
  onChange
}: {
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => {
  const displayValue = Number(value).toFixed(1);

  return (
    <div className="sm:col-span-2 lg:col-span-1">
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
        {label}
      </label>
      <div className="mt-2 flex items-center gap-4">
        <input
          type="range"
          name="rating" // Crucial for the handleChange function
          min="1"
          max="5"
          step="0.01" // Allows for half-star ratings
          value={value}
          onChange={onChange}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-blue-500"
        />
        <div className="flex-shrink-0 w-16 text-right">
          <span className="text-xl font-bold text-blue-600">{displayValue}</span>
          <span className="text-sm text-slate-500"> / 5</span>
        </div>
      </div>
    </div>
  );
};

// Volumetric Divisor Options
const VOLUMETRIC_DIVISOR_OPTIONS = [
  { value: "2800", label: "2800" },
  { value: "3000", label: "3000" },
  { value: "3200", label: "3200" },
  { value: "3500", label: "3500" },
  { value: "3800", label: "3800" },
  { value: "4000", label: "4000" },
  { value: "4200", label: "4200" },
  { value: "4500", label: "4500" },
  { value: "4800", label: "4800" },
  { value: "5000", label: "5000" },
  { value: "5200", label: "5200" },
  { value: "5500", label: "5500" },
  { value: "5800", label: "5800" },
  { value: "6000", label: "6000" },
  { value: "7000", label: "7000" }
];

// Fuel Surcharge Options
const FUEL_SURCHARGE_OPTIONS = [
  { value: "5", label: "5" },
  { value: "10", label: "10" },
  { value: "15", label: "15" },
  { value: "20", label: "20" },
  { value: "25", label: "25" },
  { value: "30", label: "30" },
  { value: "35", label: "35" },
  { value: "40", label: "40" }
];

// Percentage Options (1-5%)
const PERCENTAGE_OPTIONS = [
  { value: "1", label: "1%" },
  { value: "2", label: "2%" },
  { value: "3", label: "3%" },
  { value: "4", label: "4%" },
  { value: "5", label: "5%" }
];

// Zone Structure for Chart Zonal
const ZONE_STRUCTURE = {
  "North": [
    { value: "N1", label: "N1" },
    { value: "N2", label: "N2" },
    { value: "N3", label: "N3" },
    { value: "N4", label: "N4" }
  ],
  "South": [
    { value: "S1", label: "S1" },
    { value: "S2", label: "S2" },
    { value: "S3", label: "S3" },
    { value: "S4", label: "S4" }
  ],
  "East": [
    { value: "E1", label: "E1" },
    { value: "E2", label: "E2" }
  ],
  "Central": [
    { value: "C1", label: "C1" },
    { value: "C2", label: "C2" }
  ],
  "Northeast": [
    { value: "NE1", label: "NE1" },
    { value: "NE2", label: "NE2" }
  ],
  "West": [
    { value: "W1", label: "W1" },
    { value: "W2", label: "W2" }
  ]
};

// All available zones flattened (for future use)
// const ALL_ZONES = Object.values(ZONE_STRUCTURE).flat();

// HELPER COMPONENT: Zone Selection Component
const ZoneSelectionComponent = ({
  selectedZones,
  onZoneChange
}: {
  selectedZones: string[];
  onZoneChange: (zones: string[]) => void;
}) => {
  const handleZoneToggle = (zoneValue: string) => {
    if (selectedZones.includes(zoneValue)) {
      onZoneChange(selectedZones.filter(z => z !== zoneValue));
    } else {
      onZoneChange([...selectedZones, zoneValue]);
    }
  };

  const handleRegionToggle = (regionName: string) => {
    const regionZones = ZONE_STRUCTURE[regionName as keyof typeof ZONE_STRUCTURE];
    const regionZoneValues = regionZones.map(zone => zone.value);
    
    const allRegionSelected = regionZoneValues.every(zone => selectedZones.includes(zone));
    
    if (allRegionSelected) {
      // Remove all zones from this region
      onZoneChange(selectedZones.filter(zone => !regionZoneValues.includes(zone)));
    } else {
      // Add all zones from this region
      const newZones = [...selectedZones];
      regionZoneValues.forEach(zone => {
        if (!newZones.includes(zone)) {
          newZones.push(zone);
        }
      });
      onZoneChange(newZones);
    }
  };

  const handleSelectAll = () => {
    const allZoneValues = Object.values(ZONE_STRUCTURE).flat().map(zone => zone.value);
    onZoneChange(allZoneValues);
  };

  const handleClearAll = () => {
    onZoneChange([]);
  };

  return (
    <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-lg font-semibold text-slate-700">Select Chart Zonal</h4>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500 transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>
      <div className="space-y-4">
        {Object.entries(ZONE_STRUCTURE).map(([regionName, regionZones]) => {
          const allRegionSelected = regionZones.every(zone => selectedZones.includes(zone.value));
          const someRegionSelected = regionZones.some(zone => selectedZones.includes(zone.value));
          
          return (
            <div key={regionName} className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
              {/* Region Header */}
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id={`region-${regionName}`}
                  checked={allRegionSelected}
                  ref={input => {
                    if (input) input.indeterminate = someRegionSelected && !allRegionSelected;
                  }}
                  onChange={() => handleRegionToggle(regionName)}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                />
                <label htmlFor={`region-${regionName}`} className="ml-3 text-base font-semibold text-slate-700">
                  {regionName} Zones
                </label>
              </div>
              
              {/* Zone Options */}
              <div className="flex flex-wrap gap-3 ml-8">
                {regionZones.map(zone => (
                  <div key={zone.value} className="relative">
                    <input
                      type="checkbox"
                      id={`zone-${zone.value}`}
                      checked={selectedZones.includes(zone.value)}
                      onChange={() => handleZoneToggle(zone.value)}
                      className="sr-only"
                    />
                    <label 
                      htmlFor={`zone-${zone.value}`}
                      className={`flex items-center justify-center w-16 h-12 px-3 py-2 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedZones.includes(zone.value)
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                          : 'border-slate-300 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      <span className="text-sm font-medium">{zone.label}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Selected Zones Summary */}
      {selectedZones.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-semibold text-blue-800 mb-2">Selected Zones ({selectedZones.length}):</p>
          <p className="text-sm text-blue-700">{selectedZones.sort().join(", ")}</p>
        </div>
      )}
    </div>
  );
};

// HELPER COMPONENT: Zone Matrix Component
const ZoneMatrixComponent = ({
  selectedZones,
  zoneMatrix,
  onPriceChange
}: {
  selectedZones: string[];
  zoneMatrix: { [fromZone: string]: { [toZone: string]: number } };
  onPriceChange: (fromZone: string, toZone: string, value: number) => void;
}) => {
  if (selectedZones.length === 0) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
      <h4 className="text-lg font-semibold text-slate-700 mb-4">Zone-to-Zone Pricing Matrix</h4>
      <p className="text-sm text-slate-500 mb-6">
        Enter prices for shipping between different zones. Prices are in ₹/kg.
      </p>
      
      <div className="overflow-x-auto">
        <table className="min-w-full border-2 border-slate-400 shadow-lg">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-6 py-4 text-left text-base font-bold text-slate-800 border-r-2 border-slate-400 bg-slate-200">
                From \ To
              </th>
              {selectedZones.map(zone => (
                <th key={zone} className="px-6 py-4 text-center text-base font-bold text-slate-800 border-r-2 border-slate-400 last:border-r-0 bg-slate-200">
                  {zone}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selectedZones.map(fromZone => (
              <tr key={fromZone} className="border-t-2 border-slate-400 hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-base font-bold text-slate-800 bg-slate-100 border-r-2 border-slate-400">
                  {fromZone}
                </td>
                {selectedZones.map(toZone => (
                  <td key={toZone} className="px-3 py-3 border-r-2 border-slate-400 last:border-r-0">
                    <input
                      type="text"
                      value={zoneMatrix[fromZone]?.[toZone] === 0 ? '' : (zoneMatrix[fromZone]?.[toZone] || '')}
                      onChange={(e) => {
                        const value = e.target.value;
                        
                        // Allow empty string for complete removal
                        if (value === '') {
                          onPriceChange(fromZone, toZone, 0);
                          return;
                        }
                        
                        // Only allow digits and limit to 4 characters
                        const cleanValue = value.replace(/[^0-9]/g, '').substring(0, 4);
                        const numValue = parseFloat(cleanValue);
                        
                        if (!isNaN(numValue) && numValue >= 0 && numValue <= 1000) {
                          onPriceChange(fromZone, toZone, numValue);
                        }
                      }}
                      onKeyDown={(e) => {
                        // Allow only digits (0-9) and control keys
                        if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      className={`w-full h-10 px-4 py-2 text-sm font-normal border-2 rounded-lg shadow-sm transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500 hover:border-blue-400 focus:scale-x-150 focus:scale-y-110 focus:text-sm focus:font-normal hover:scale-x-120 hover:scale-y-105 ${
                        fromZone === toZone 
                          ? 'border-blue-200 bg-blue-50 text-blue-800 placeholder-blue-400' 
                          : 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 hover:bg-blue-50'
                      }`}
                      placeholder="0"
                      maxLength={4}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 flex justify-end">
        <div className="text-sm text-slate-600">
          <p><strong>Zone matrix will be saved when you submit the complete company form below.</strong></p>
        </div>
      </div>
    </div>
  );
};

// HELPER COMPONENT: PercentageField with Dropdown
const PercentageField = ({
  name,
  label,
  value,
  onChange,
  onSelectChange,
  onKeyDown,
  showDropdown,
  onToggleDropdown,
  error
}: {
  name: string;
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  showDropdown: boolean;
  onToggleDropdown: () => void;
  error?: string;
}) => (
  <div className="relative" data-dropdown-container>
    <label htmlFor={name} className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
      {label} <span className="text-red-500">*</span>
    </label>
    <div className="mt-1 relative">
      <input
        type="text"
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        min="0"
        max="5"
        className={`block w-full bg-slate-50/70 border rounded-lg shadow-sm px-3 py-2 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 transition
                   ${error ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'}`}
        required
      />
      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
        <button
          type="button"
          onClick={onToggleDropdown}
          className="text-slate-400 hover:text-blue-600 transition-colors"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      </div>
      
      {/* Dropdown Options */}
      {showDropdown && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {PERCENTAGE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onSelectChange({ target: { value: option.value } } as React.ChangeEvent<HTMLSelectElement>);
                onToggleDropdown();
              }}
              className="w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-blue-100 focus:bg-blue-100 focus:outline-none"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

// HELPER COMPONENT: DaccChargesField with Info Tooltip
const DaccChargesField = ({
  name,
  label,
  value,
  onChange,
  onKeyDown,
  showTooltip,
  onToggleTooltip
}: {
  name: string;
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  showTooltip: boolean;
  onToggleTooltip: () => void;
}) => (
  <div className="relative" data-tooltip-container>
    <label htmlFor={name} className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
      {label} <span className="text-red-500">*</span>
    </label>
    <div className="mt-1 relative">
      <input
        type="text"
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className="block w-full bg-slate-50/70 border border-slate-300 rounded-lg shadow-sm px-3 py-2 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:border-blue-500 focus:ring-blue-500 transition"
        required
      />
      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
        <button
          type="button"
          onClick={onToggleTooltip}
          className="text-slate-400 hover:text-blue-600 transition-colors"
        >
          <InformationCircleIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
    
    {showTooltip && (
      <div className="absolute z-20 mt-2 w-96 bg-white border border-slate-200 rounded-lg shadow-lg p-4">
        <div className="text-sm text-slate-700">
          <h4 className="font-semibold text-slate-800 mb-2">DACC Charges</h4>
          <p className="mb-3">
            DACC is a value-added delivery service in which the consignee (receiver of the goods) must present their consignee copy of the Delivery Way Bill (DWB) before the shipment is handed over.
          </p>
          <div className="bg-slate-50 p-3 rounded border-l-4 border-blue-500">
            <p className="font-medium text-slate-800 mb-1">Key Points:</p>
            <ul className="text-xs space-y-1">
              <li>• This copy acts as an authorization document</li>
              <li>• Ensures that the right person is collecting the goods</li>
              <li>• Provides additional security for high-value shipments</li>
            </ul>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleTooltip}
          className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
        >
          ×
        </button>
      </div>
    )}
  </div>
);

// HELPER COMPONENT: FuelSurchargeField with Dropdown
const FuelSurchargeField = ({
  name,
  label,
  value,
  onChange,
  onSelectChange,
  onKeyDown,
  showDropdown,
  onToggleDropdown,
  error
}: {
  name: string;
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  showDropdown: boolean;
  onToggleDropdown: () => void;
  error?: string;
}) => (
  <div className="relative" data-tooltip-container>
    <label htmlFor={name} className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
      {label} <span className="text-red-500">*</span>
    </label>
    <div className="mt-1 relative">
      <input
        type="text"
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        min="1"
        max="40"
        className={`block w-full bg-slate-50/70 border rounded-lg shadow-sm px-3 py-2 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 transition
                   ${error ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'}`}
        required
      />
      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
        <button
          type="button"
          onClick={onToggleDropdown}
          className="text-slate-400 hover:text-blue-600 transition-colors"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      </div>
      
      {/* Dropdown Options */}
      {showDropdown && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {FUEL_SURCHARGE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onSelectChange({ target: { value: option.value } } as React.ChangeEvent<HTMLSelectElement>);
                onToggleDropdown();
              }}
              className="w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-blue-100 focus:bg-blue-100 focus:outline-none"
            >
              {option.label}%
            </button>
          ))}
        </div>
      )}
    </div>
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

// HELPER COMPONENT: SavedVendorsTable
const SavedVendorsTable = ({ 
  vendors, 
  onEdit, 
  onDelete 
}: { 
  vendors: any[];
  onEdit: (vendor: any) => void;
  onDelete: (vendorId: number) => void;
}) => {
  if (vendors.length === 0) {
    return null;
  }

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm transition-all">
      <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-4 mb-6">
        Saved Vendors ({vendors.length})
      </h3>
      
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {vendors.map((vendor, index) => (
            <div key={vendor.id} className="mb-6 border border-slate-200 rounded-lg p-4 bg-slate-50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-semibold text-slate-700">
                  Vendor #{index + 1} - {vendor.companyName}
                </h4>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded">
                    Added: {vendor.addedAt}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(vendor)}
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors duration-200"
                      title="Edit vendor"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(vendor.id)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-colors duration-200"
                      title="Delete vendor"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Company Details */}
                <div className="space-y-2">
                  <h5 className="font-medium text-slate-600 text-sm">Company Details</h5>
                  <div className="text-xs space-y-1">
                    <p><span className="font-medium">Name:</span> {vendor.companyName}</p>
                    <p><span className="font-medium">Code:</span> {vendor.vendorCode}</p>
                    <p><span className="font-medium">Sub Vendor:</span> {vendor.subVendor || 'N/A'}</p>
                    <p><span className="font-medium">Rating:</span> {vendor.rating}/5</p>
                  </div>
                </div>

                {/* Contact Details */}
                <div className="space-y-2">
                  <h5 className="font-medium text-slate-600 text-sm">Contact Details</h5>
                  <div className="text-xs space-y-1">
                    <p><span className="font-medium">Phone:</span> {vendor.vendorPhone}</p>
                    <p><span className="font-medium">Email:</span> {vendor.vendorEmail}</p>
                    <p><span className="font-medium">GST:</span> {vendor.gstNo}</p>
                  </div>
                </div>

                {/* Location Details */}
                <div className="space-y-2">
                  <h5 className="font-medium text-slate-600 text-sm">Location Details</h5>
                  <div className="text-xs space-y-1">
                    <p><span className="font-medium">Address:</span> {vendor.address}</p>
                    <p><span className="font-medium">City:</span> {vendor.city}</p>
                    <p><span className="font-medium">State:</span> {vendor.state}</p>
                    <p><span className="font-medium">Pincode:</span> {vendor.pincode}</p>
                  </div>
                </div>

                {/* Transport & Pricing */}
                <div className="space-y-2">
                  <h5 className="font-medium text-slate-600 text-sm">Transport & Pricing</h5>
                  <div className="text-xs space-y-1">
                    <p><span className="font-medium">Mode:</span> {vendor.mode}</p>
                    <p><span className="font-medium">Min Weight:</span> {vendor.priceRate?.minWeight || 'N/A'} kg</p>
                    <p><span className="font-medium">Fuel Surcharge:</span> {vendor.priceRate?.fuel || 'N/A'}%</p>
                    <p><span className="font-medium">Zones:</span> {vendor.selectedZones?.length || 0} selected</p>
                  </div>
                </div>
              </div>

              {/* Zone Matrix Summary */}
              {vendor.selectedZones && vendor.selectedZones.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-300">
                  <h5 className="font-medium text-slate-600 text-sm mb-2">Zone Matrix Summary</h5>
                  <div className="text-xs">
                    <p><span className="font-medium">Selected Zones:</span> {vendor.selectedZones.join(', ')}</p>
                    <p><span className="font-medium">Total Price Points:</span> {vendor.selectedZones.length * vendor.selectedZones.length}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// HELPER COMPONENT: VolumetricDivisorField with Info Tooltip
const VolumetricDivisorField = ({
  name,
  label,
  value,
  onChange,
  onSelectChange,
  onKeyDown,
  showTooltip,
  onToggleTooltip,
  showDropdown,
  onToggleDropdown
}: {
  name: string;
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  showTooltip: boolean;
  onToggleTooltip: () => void;
  showDropdown: boolean;
  onToggleDropdown: () => void;
}) => (
  <div className="relative" data-tooltip-container>
    <label htmlFor={name} className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
      {label} <span className="text-red-500">*</span>
    </label>
    <div className="mt-1 relative">
      <input
        type="text"
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        max="7000"
        className="block w-full bg-slate-50/70 border border-slate-300 rounded-lg shadow-sm px-3 py-2 pr-20 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:border-blue-500 focus:ring-blue-500 transition"
        required
      />
      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleDropdown}
          className="text-slate-400 hover:text-blue-600 transition-colors"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleTooltip}
          className="text-slate-400 hover:text-blue-600 transition-colors"
        >
          <InformationCircleIcon className="h-5 w-5" />
        </button>
      </div>
      
      {/* Dropdown Options */}
      {showDropdown && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {VOLUMETRIC_DIVISOR_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onSelectChange({ target: { value: option.value } } as React.ChangeEvent<HTMLSelectElement>);
                onToggleDropdown();
              }}
              className="w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-blue-100 focus:bg-blue-100 focus:outline-none"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
    
    {showTooltip && (
      <div className="absolute z-20 mt-2 w-96 bg-white border border-slate-200 rounded-lg shadow-lg p-4">
        <div className="text-sm text-slate-700">
          <h4 className="font-semibold text-slate-800 mb-2">Volumetric Weight Calculation</h4>
          <p className="mb-3">
            In shipping and logistics, volumetric weight (also called dimensional weight) is used when the space a package takes up is more important than its actual weight.
          </p>
          <div className="bg-slate-50 p-3 rounded border-l-4 border-blue-500">
            <p className="font-medium text-slate-800 mb-1">The formula is:</p>
            <div className="text-center text-sm font-mono">
              <strong>Volumetric Weight (kg) = </strong>
              <span className="inline-block">
                <div>L × B × H</div>
                <div className="border-t border-slate-400">K</div>
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-xs">
            <p><strong>L × B × H</strong> = package dimensions (length × breadth × height, usually in centimeters)</p>
            <p><strong>K</strong> = volumetric divisor (also called k-factor). It varies by courier/transport mode</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleTooltip}
          className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
        >
          ×
        </button>
      </div>
    )}
  </div>
);


// --- MAIN COMPONENT ---
const AddTiedUpCompany = () => {
  const { user } = useAuth();
  const customerID = (user as any)?.customer?._id;
  
  const [form, setForm] = useState({
    customerID: customerID, 
    vendorCode: "", 
    vendorPhone: "", 
    vendorEmail: "", 
    gstNo: "",
    mode: "", 
    address: "", 
    state: "", 
    city: "",
    pincode: "", 
    rating: "3",
    companyName: "",
    subVendor: ""
  });

  // Error states for validation
  const [errors, setErrors] = useState({
    vendorPhone: "",
    vendorEmail: "",
    gstNo: "",
    pincode: "",
    fuel: ""
  });

  // Loading state for pincode auto-fill
  const [isLoadingPincode, setIsLoadingPincode] = useState(false);
  const pincodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showVolumetricTooltip, setShowVolumetricTooltip] = useState(false);
  const [showVolumetricDropdown, setShowVolumetricDropdown] = useState(false);
  const [showDaccTooltip, setShowDaccTooltip] = useState(false);
  const [showFuelDropdown, setShowFuelDropdown] = useState(false);
  const [showHandlingVariableDropdown, setShowHandlingVariableDropdown] = useState(false);
  const [showRovVariableDropdown, setShowRovVariableDropdown] = useState(false);
  const [showCodVariableDropdown, setShowCodVariableDropdown] = useState(false);
  const [showTopayVariableDropdown, setShowTopayVariableDropdown] = useState(false);
  const [showAppointmentVariableDropdown, setShowAppointmentVariableDropdown] = useState(false);


  // Load pincodes dataset from public and derive state options
  const [pincodeData, setPincodeData] = useState<PincodeEntry[]>([]);

  useEffect(() => {
    // Fetch static JSON from public folder at runtime (respect base URL)
    const url = `${import.meta.env.BASE_URL || '/'}pincodes.json`;
    fetch(url)
      .then(res => res.json())
      .then((data: PincodeEntry[]) => {
        if (Array.isArray(data)) setPincodeData(data);
      })
      .catch(() => {
        // Fail silently; state dropdown will just be empty
      });
  }, []);

  // Fast lookup by pincode
  const pincodeMap = useMemo(() => {
    const map = new Map<string, { state: string; city: string; zone?: string }>();
    for (const entry of pincodeData) {
      map.set(entry.pincode, { state: entry.state, city: entry.city, zone: entry.zone });
    }
    return map;
  }, [pincodeData]);

  // Unique state options for dropdown
  const stateOptions = useMemo(() => {
    const states = Array.from(new Set(pincodeData.map(e => (e.state || '').toString()))).filter(Boolean);
    states.sort((a, b) => a.localeCompare(b));
    return states.map(s => ({ value: s, label: s }));
  }, [pincodeData]);

  // Validation functions
  const validatePhone = (phone: string): string => {
    if (!phone) return "Phone number is required";
    if (!/^\d{10}$/.test(phone)) return "Phone number must be exactly 10 digits";
    return "";
  };

  const validateEmail = (email: string): string => {
    if (!email) return "Email address is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email address";
    return "";
  };

  const validateGST = (gst: string): string => {
    if (!gst) return "GST number is required";
    if (gst.length !== 15) return "Invalid GST number";
    
    // Convert to uppercase for validation
    const gstUpper = gst.toUpperCase();
    
    // Complete GST validation with all rules
    if (!/^(0[1-9]|[1-2][0-9]|3[0-7])[A-Z]{5}[0-9]{4}[A-Z][1-9]Z[0-9A-Z]$/.test(gstUpper)) {
      return "Invalid GST number";
    }
    
    return "";
  };

  const validatePincode = (pincode: string): string => {
    if (!pincode) return "Pincode is required";
    if (!/^\d{6}$/.test(pincode)) return "Invalid pincode";
    return "";
  };

  const validateFuel = (fuel: string | number): string => {
    if (!fuel) return "";
    const numValue = parseFloat(fuel.toString());
    if (numValue < 5) return "Minimum value should be 5";
    if (numValue > 40) return "Maximum value should be 40";
    return "";
  };

  // Pincode auto-fill function using local pincodes.json first, with optional API fallback
  const fetchPincodeDetails = async (pincode: string) => {
    if (!/^\d{6}$/.test(pincode)) return;

    setIsLoadingPincode(true);
    try {
      const local = pincodeMap.get(pincode);
      if (local) {
        setForm(prev => ({ ...prev, state: local.state, city: local.city }));
        setErrors(prev => ({ ...prev, pincode: "" }));
        return;
      }

      // Fallback to India Post API only if not found locally
      try {
        const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
        const data = response.data?.[0];
        if (data?.Status === "Success" && Array.isArray(data.PostOffice) && data.PostOffice.length > 0) {
          const po = data.PostOffice[0];
          setForm(prev => ({ ...prev, state: po.State || prev.state, city: po.District || prev.city }));
          setErrors(prev => ({ ...prev, pincode: "" }));
        } else {
          setErrors(prev => ({ ...prev, pincode: "Invalid pincode" }));
        }
      } catch {
        // If API fails, keep prior state and show error
        setErrors(prev => ({ ...prev, pincode: "Invalid pincode" }));
      }
    } finally {
      setIsLoadingPincode(false);
    }
  };

  // Reset city when state changes
  useEffect(() => {
    if (form.state) {
      // Reset city when state changes
      setForm(prev => ({ ...prev, city: "" }));
    }
  }, [form.state]);


  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (pincodeDebounceRef.current) {
        clearTimeout(pincodeDebounceRef.current);
      }
    };
  }, []);


  // Update form when user data is loaded
  useEffect(() => {
    if (customerID) {
      setForm(prev => ({ ...prev, customerID: customerID }));
    }
  }, [customerID]);




  // Fetch zone matrix data when company is selected
  const fetchZoneMatrix = async (_companyName: string) => {
    // Company name entered - user can now select zones manually
    // No automatic zone selection - user must choose zones to see matrix
  };




  // Close tooltip and dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showVolumetricTooltip || showVolumetricDropdown || showDaccTooltip || showFuelDropdown || 
          showHandlingVariableDropdown || showRovVariableDropdown || showCodVariableDropdown || 
          showTopayVariableDropdown || showAppointmentVariableDropdown) {
        const target = event.target as Element;
        if (!target.closest('[data-tooltip-container]') && !target.closest('[data-dropdown-container]')) {
          setShowVolumetricTooltip(false);
          setShowVolumetricDropdown(false);
          setShowDaccTooltip(false);
          setShowFuelDropdown(false);
          setShowHandlingVariableDropdown(false);
          setShowRovVariableDropdown(false);
          setShowCodVariableDropdown(false);
          setShowTopayVariableDropdown(false);
          setShowAppointmentVariableDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVolumetricTooltip, showVolumetricDropdown, showDaccTooltip, showFuelDropdown, 
      showHandlingVariableDropdown, showRovVariableDropdown, showCodVariableDropdown, 
      showTopayVariableDropdown, showAppointmentVariableDropdown]);
  
  const [priceRate, setPriceRate] = useState<any>({});
  // const [priceChart, setPriceChart] = useState<{ [pincode: string]: { [zone: string]: number } }>({});
  
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [zoneMatrix, setZoneMatrix] = useState<{ [fromZone: string]: { [toZone: string]: number } }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedVendors, setSavedVendors] = useState<any[]>([]);
  const [isAddingVendor, setIsAddingVendor] = useState(false);




  // --- HANDLERS WITH VALIDATION ---

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { name, value } = e.target;
    
    // Validation: Pincode length and non-negative numbers
    if (name === 'pincode' && value.length > 6) return;
    if (e.target.type === "number" && Number(value) < 0) return;
    
    setForm(prev => ({ ...prev, [name]: value }));
    
    // Real-time validation
    if (name === 'vendorPhone') {
      setErrors(prev => ({ ...prev, vendorPhone: validatePhone(value) }));
    } else if (name === 'gstNo') {
      // Convert GST to uppercase automatically
      const upperValue = value.toUpperCase();
      setForm(prev => ({ ...prev, [name]: upperValue }));
      setErrors(prev => ({ ...prev, gstNo: validateGST(upperValue) }));
    } else if (name === 'vendorCode') {
      // Only allow alphanumeric characters (0-9, A-Z) and convert to uppercase - limit to 20 characters
      const alphanumericValue = value.replace(/[^0-9A-Za-z]/g, '').toUpperCase().substring(0, 20);
      setForm(prev => ({ ...prev, [name]: alphanumericValue }));
    } else if (name === 'city') {
      // Only allow letters (a-z, A-Z) and spaces
      const lettersOnlyValue = value.replace(/[^a-zA-Z\s]/g, '');
      setForm(prev => ({ ...prev, [name]: lettersOnlyValue }));
    } else if (name === 'subVendor') {
      // Allow any text for sub vendor - limit to 20 characters
      const truncatedValue = value.substring(0, 20);
      setForm(prev => ({ ...prev, [name]: truncatedValue }));
    } else if (name === 'companyName') {
      // Allow any text for company name (user can type custom names) - limit to 20 characters
      const truncatedValue = value.substring(0, 20);
      setForm(prev => ({ ...prev, [name]: truncatedValue }));
      
      // Initialize zone matrix when company name is entered
      if (truncatedValue.trim() === '') {
        setSelectedZones([]);
        setZoneMatrix({});
      } else {
        fetchZoneMatrix(truncatedValue);
      }
    } else if (name === 'vendorPhone') {
      // Since onKeyDown prevents non-digits, we just need to limit length
      const truncatedValue = value.substring(0, 10);
      setForm(prev => ({ ...prev, [name]: truncatedValue }));
      setErrors(prev => ({ ...prev, vendorPhone: validatePhone(truncatedValue) }));
    } else if (name === 'pincode') {
      // Clear previous timeout
      if (pincodeDebounceRef.current) {
        clearTimeout(pincodeDebounceRef.current);
      }
      
      // Auto-fill when exactly 6 digits are entered (with debounce)
      if (value.length === 6 && /^\d{6}$/.test(value)) {
        pincodeDebounceRef.current = setTimeout(() => {
          fetchPincodeDetails(value);
        }, 500); // 500ms delay to prevent rapid API calls
      }
    }
  };




  const handlePincodeBlur = () => {
    setErrors(prev => ({ ...prev, pincode: validatePincode(form.pincode) }));
    if (form.pincode && form.pincode.length === 6) {
      fetchPincodeDetails(form.pincode);
    }
  };
  const handleEmailBlur = () => {
    setErrors(prev => ({ ...prev, vendorEmail: validateEmail(form.vendorEmail) }));
  };

  // KeyDown handler for vendor phone - only allow digits and control keys
  const handleVendorPhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control keys (backspace, delete, tab, escape, enter, arrow keys, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || 
        e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowLeft' || 
        e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'Home' || e.key === 'End' || e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow only digits (0-9)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  // KeyDown handler for pincode - only allow digits and control keys
  const handlePincodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control keys (backspace, delete, tab, escape, enter, arrow keys, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || 
        e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowLeft' || 
        e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'Home' || e.key === 'End' || e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow only digits (0-9)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  // KeyDown handler for minWeight - only allow digits 1-1000 range
  const handleMinWeightKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control keys (backspace, delete, tab, escape, enter, arrow keys, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || 
        e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowLeft' || 
        e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'Home' || e.key === 'End' || e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow only digits (0-9)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    
    // Get current value and the new value that would be created
    const currentValue = (e.target as HTMLInputElement).value;
    const newValue = currentValue + e.key;
    const numValue = parseFloat(newValue);
    
    // Prevent typing if the new value would be outside 1-1000 range
    if (numValue > 1000) {
      e.preventDefault();
      return;
    }
    
    // Prevent more than 3 consecutive zeros at the beginning
    if (e.key === '0' && currentValue.startsWith('000')) {
      e.preventDefault();
    }
  };

  // KeyDown handler for docketCharges - only allow digits 0-500 range
  const handleDocketChargesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control keys (backspace, delete, tab, escape, enter, arrow keys, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || 
        e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowLeft' || 
        e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'Home' || e.key === 'End' || e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow only digits (0-9)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    
    // Get current value and the new value that would be created
    const currentValue = (e.target as HTMLInputElement).value;
    const newValue = currentValue + e.key;
    const numValue = parseFloat(newValue);
    
    // Prevent typing if the new value would be outside 0-500 range
    if (numValue > 500) {
      e.preventDefault();
      return;
    }
    
    // Prevent more than 2 consecutive zeros at the beginning
    if (e.key === '0' && currentValue.startsWith('00')) {
      e.preventDefault();
    }
  };

  // KeyDown handler for fuel surcharge - allow digits 1-40 range
  const handleFuelSurchargeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control keys (backspace, delete, tab, escape, enter, arrow keys, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || 
        e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowLeft' || 
        e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'Home' || e.key === 'End' || e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow only digits (0-9)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    
    // Get current value and the new value that would be created
    const currentValue = (e.target as HTMLInputElement).value;
    const newValue = currentValue + e.key;
    const numValue = parseFloat(newValue);
    
    // Prevent typing if the new value would be outside 1-40 range
    if (numValue > 40) {
      e.preventDefault();
      return;
    }
    
    // Prevent more than 1 zero at the beginning
    if (e.key === '0' && currentValue.startsWith('0')) {
      e.preventDefault();
    }
  };

  // KeyDown handler for volumetric divisor - only allow digits 0-7000 range
  const handleVolumetricDivisorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control keys (backspace, delete, tab, escape, enter, arrow keys, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || 
        e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowLeft' || 
        e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'Home' || e.key === 'End' || e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow only digits (0-9)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    
    // Get current value and the new value that would be created
    const currentValue = (e.target as HTMLInputElement).value;
    const newValue = currentValue + e.key;
    const numValue = parseFloat(newValue);
    
    // Prevent typing if the new value would be outside 0-7000 range
    if (numValue > 7000) {
      e.preventDefault();
      return;
    }
    
    // Prevent more than 4 consecutive zeros at the beginning
    if (e.key === '0' && currentValue.startsWith('0000')) {
      e.preventDefault();
    }
  };

  // KeyDown handler for minCharges - only allow digits 1-1000 range
  const handleMinChargesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control keys (backspace, delete, tab, escape, enter, arrow keys, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || 
        e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowLeft' || 
        e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'Home' || e.key === 'End' || e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow only digits (0-9)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    
    // Get current value and the new value that would be created
    const currentValue = (e.target as HTMLInputElement).value;
    const newValue = currentValue + e.key;
    const numValue = parseFloat(newValue);
    
    // Prevent typing if the new value would be outside 1-1000 range
    if (numValue > 1000) {
      e.preventDefault();
      return;
    }
    
    // Prevent more than 2 consecutive zeros at the beginning
    if (e.key === '0' && currentValue.startsWith('00')) {
      e.preventDefault();
    }
  };

  // KeyDown handler for greenTax - only allow digits 0-5000 range
  const handleGreenTaxKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control keys (backspace, delete, tab, escape, enter, arrow keys, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || 
        e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowLeft' || 
        e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'Home' || e.key === 'End' || e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow only digits (0-9)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    
    // Get current value and the new value that would be created
    const currentValue = (e.target as HTMLInputElement).value;
    const newValue = currentValue + e.key;
    const numValue = parseFloat(newValue);
    
    // Prevent typing if the new value would be outside 0-5000 range
    if (numValue > 5000) {
      e.preventDefault();
      return;
    }
    
    // Prevent more than 3 consecutive zeros at the beginning
    if (e.key === '0' && currentValue.startsWith('000')) {
      e.preventDefault();
    }
  };

  // KeyDown handler for daccCharges - only allow digits 0-1000 range
  const handleDaccChargesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control keys (backspace, delete, tab, escape, enter, arrow keys, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || 
        e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowLeft' || 
        e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'Home' || e.key === 'End' || e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow only digits (0-9)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    
    // Get current value and the new value that would be created
    const currentValue = (e.target as HTMLInputElement).value;
    const newValue = currentValue + e.key;
    const numValue = parseFloat(newValue);
    
    // Prevent typing if the new value would be outside 0-1000 range
    if (numValue > 1000) {
      e.preventDefault();
      return;
    }
    
    // Prevent more than 2 consecutive zeros at the beginning
    if (e.key === '0' && currentValue.startsWith('00')) {
      e.preventDefault();
    }
  };

  // KeyDown handler for miscellanousCharges - only allow digits 0-10000 range
  const handleMiscChargesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control keys (backspace, delete, tab, escape, enter, arrow keys, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || 
        e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowLeft' || 
        e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'Home' || e.key === 'End' || e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow only digits (0-9)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    
    // Get current value and the new value that would be created
    const currentValue = (e.target as HTMLInputElement).value;
    const newValue = currentValue + e.key;
    const numValue = parseFloat(newValue);
    
    // Prevent typing if the new value would be outside 0-10000 range
    if (numValue > 10000) {
      e.preventDefault();
      return;
    }
    
    // Prevent more than 3 consecutive zeros at the beginning
    if (e.key === '0' && currentValue.startsWith('000')) {
      e.preventDefault();
    }
  };


  // KeyDown handler for handlingCharges.threshholdweight - only allow digits 1-20000 range
  const handleHandlingWeightKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control keys (backspace, delete, tab, escape, enter, arrow keys, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || 
        e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowLeft' || 
        e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'Home' || e.key === 'End' || e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow only digits (0-9)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    
    // Get current value and the new value that would be created
    const currentValue = (e.target as HTMLInputElement).value;
    const newValue = currentValue + e.key;
    const numValue = parseFloat(newValue);
    
    // Prevent typing if the new value would be outside 1-20000 range
    if (numValue > 20000) {
      e.preventDefault();
      return;
    }
    
    // Prevent more than 3 consecutive zeros at the beginning
    if (e.key === '0' && currentValue.startsWith('000')) {
      e.preventDefault();
    }
  };

  // KeyDown handler for ROV/COD/Topay/Appointment fixed charges - only allow digits 0-5000/2000 range
  const handleChargeFixedKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, maxValue: number) => {
    // Allow control keys (backspace, delete, tab, escape, enter, arrow keys, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || 
        e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowLeft' || 
        e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'Home' || e.key === 'End' || e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow only digits (0-9)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    
    // Get current value and the new value that would be created
    const currentValue = (e.target as HTMLInputElement).value;
    const newValue = currentValue + e.key;
    const numValue = parseFloat(newValue);
    
    // Prevent typing if the new value would be outside 0-maxValue range
    if (numValue > maxValue) {
      e.preventDefault();
      return;
    }
    
    // Prevent more than 2 consecutive zeros at the beginning
    if (e.key === '0' && currentValue.startsWith('00')) {
      e.preventDefault();
    }
  };

  // KeyDown handler for percentage fields - only allow digits 0-5 range
  const handlePercentageKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control keys (backspace, delete, tab, escape, enter, arrow keys, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || 
        e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowLeft' || 
        e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'Home' || e.key === 'End' || e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow only digits (0-9)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    
    // Get current value and the new value that would be created
    const currentValue = (e.target as HTMLInputElement).value;
    const newValue = currentValue + e.key;
    const numValue = parseFloat(newValue);
    
    // Prevent typing if the new value would be outside 0-5 range
    if (numValue > 5) {
      e.preventDefault();
      return;
    }
    
    // Prevent more than 1 consecutive zero at the beginning
    if (e.key === '0' && currentValue.startsWith('0')) {
      e.preventDefault();
    }
  };

  // KeyDown handler for handling variable percentage - only allow digits 0-50 range
  const handleHandlingVariableKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control keys (backspace, delete, tab, escape, enter, arrow keys, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || 
        e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowLeft' || 
        e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'Home' || e.key === 'End' || e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow only digits (0-9)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    
    // Get current value and the new value that would be created
    const currentValue = (e.target as HTMLInputElement).value;
    const newValue = currentValue + e.key;
    const numValue = parseFloat(newValue);
    
    // Prevent typing if the new value would be outside 0-50 range
    if (numValue > 50) {
      e.preventDefault();
      return;
    }
    
    // Prevent more than 1 consecutive zero at the beginning
    if (e.key === '0' && currentValue.startsWith('0')) {
      e.preventDefault();
    }
  };

  // KeyDown handler for city field - only allow letters (a-z, A-Z) and spaces
  const handleCityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control keys (backspace, delete, tab, escape, enter, arrow keys, etc.)
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || 
        e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowLeft' || 
        e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'Home' || e.key === 'End' || e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow only letters (a-z, A-Z) and spaces
    if (!/^[a-zA-Z\s]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleNestedInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (parseFloat(value) < 0) return;
    
    // Special validation for divisor field - max value 7000
    if (name === "divisor" && parseFloat(value) > 7000) return;
    
    // Special validation for minWeight field - range 1-1000
    if (name === "minWeight" && value && (parseFloat(value) < 1 || parseFloat(value) > 1000)) return;
    
    // Special validation for docketCharges field - range 0-500
    if (name === "docketCharges" && value && (parseFloat(value) < 0 || parseFloat(value) > 500)) return;
    
    // Special validation for fuel field - range 1-40 (but will show error for 1-4)
    if (name === "fuel" && value && (parseFloat(value) < 1 || parseFloat(value) > 40)) return;
    
    // Special validation for minCharges field - range 1-1000
    if (name === "minCharges" && value && (parseFloat(value) < 1 || parseFloat(value) > 1000)) return;
    
    // Special validation for greenTax field - range 0-5000
    if (name === "greenTax" && value && (parseFloat(value) < 0 || parseFloat(value) > 5000)) return;
    
    // Special validation for daccCharges field - range 0-1000
    if (name === "daccCharges" && value && (parseFloat(value) < 0 || parseFloat(value) > 1000)) return;
    
    // Special validation for miscellanousCharges field - range 0-10000
    if (name === "miscellanousCharges" && value && (parseFloat(value) < 0 || parseFloat(value) > 10000)) return;
    
    // Special validation for handlingCharges.fixed field - range 0-5000
    if (name === "handlingCharges.fixed" && value && (parseFloat(value) < 0 || parseFloat(value) > 5000)) return;
    
    // Special validation for handlingCharges.threshholdweight field - range 1-20000
    if (name === "handlingCharges.threshholdweight" && value && (parseFloat(value) < 1 || parseFloat(value) > 20000)) return;
    
    // Special validation for handlingCharges.variable field - range 0-50
    if (name === "handlingCharges.variable" && value && (parseFloat(value) < 0 || parseFloat(value) > 50)) return;
    
    // Special validation for rovCharges.fixed field - range 0-5000
    if (name === "rovCharges.fixed" && value && (parseFloat(value) < 0 || parseFloat(value) > 5000)) return;
    
    // Special validation for rovCharges.variable field - range 0-5
    if (name === "rovCharges.variable" && value && (parseFloat(value) < 0 || parseFloat(value) > 5)) return;
    
    // Special validation for codCharges.fixed field - range 0-2000
    if (name === "codCharges.fixed" && value && (parseFloat(value) < 0 || parseFloat(value) > 2000)) return;
    
    // Special validation for codCharges.variable field - range 0-5
    if (name === "codCharges.variable" && value && (parseFloat(value) < 0 || parseFloat(value) > 5)) return;
    
    // Special validation for topayCharges.fixed field - range 0-2000
    if (name === "topayCharges.fixed" && value && (parseFloat(value) < 0 || parseFloat(value) > 2000)) return;
    
    // Special validation for topayCharges.variable field - range 0-5
    if (name === "topayCharges.variable" && value && (parseFloat(value) < 0 || parseFloat(value) > 5)) return;
    
    // Special validation for appointmentCharges.fixed field - range 0-2000
    if (name === "appointmentCharges.fixed" && value && (parseFloat(value) < 0 || parseFloat(value) > 2000)) return;
    
    // Special validation for appointmentCharges.variable field - range 0-5
    if (name === "appointmentCharges.variable" && value && (parseFloat(value) < 0 || parseFloat(value) > 5)) return;
    
    const keys = name.split(".");
    setPriceRate((prev: any) => {
      const updated = JSON.parse(JSON.stringify(prev));
      let nested = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        nested[keys[i]] = nested[keys[i]] || {};
        nested = nested[keys[i]];
      }
      nested[keys[keys.length - 1]] = value ? parseFloat(value) : undefined;
      return updated;
    });

    // Validate fuel field and set error
    if (name === "fuel") {
      setErrors(prev => ({ ...prev, fuel: validateFuel(value) }));
    }
  };


  const handleZoneSelectionChange = (newSelectedZones: string[]) => {
    setSelectedZones(newSelectedZones);
    
    // Initialize matrix for new zones
    const newMatrix: { [fromZone: string]: { [toZone: string]: number } } = {};
    newSelectedZones.forEach(fromZone => {
      newMatrix[fromZone] = {};
      newSelectedZones.forEach(toZone => {
        // Preserve existing values if they exist, otherwise initialize to 0
        newMatrix[fromZone][toZone] = zoneMatrix[fromZone]?.[toZone] || 0;
      });
    });
    setZoneMatrix(newMatrix);
    
    // Show success message when zones are selected manually
    if (newSelectedZones.length > 0) {
      toast.success(`Zone matrix created with ${newSelectedZones.length} zones`);
    }
  };

  const handleMatrixPriceChange = (fromZone: string, toZone: string, value: number) => {
    if (value < 0) return;
    setZoneMatrix(prev => ({
      ...prev,
      [fromZone]: {
        ...prev[fromZone],
        [toZone]: value
      }
    }));
  };

  // Function to add vendor to local list
  const handleAddVendor = () => {
    // Check if all required fields are filled first
    const requiredFields = {
      companyName: form.companyName,
      vendorCode: form.vendorCode,
      vendorPhone: form.vendorPhone,
      vendorEmail: form.vendorEmail,
      gstNo: form.gstNo,
      mode: form.mode,
      address: form.address,
      state: form.state,
      city: form.city,
      pincode: form.pincode,
      rating: form.rating
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([, value]) => !value || value.toString().trim() === '')
      .map(([key]) => {
        // Convert field names to user-friendly labels
        const fieldLabels: { [key: string]: string } = {
          companyName: "Company Name",
          vendorCode: "Vendor Code", 
          vendorPhone: "Vendor Phone",
          vendorEmail: "Vendor Email",
          gstNo: "GST Number",
          mode: "Transport Mode",
          address: "Address",
          state: "State",
          city: "City",
          pincode: "Pincode",
          rating: "Rating"
        };
        return fieldLabels[key] || key;
      });

    if (missingFields.length > 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate field formats
    const phoneError = validatePhone(form.vendorPhone);
    const emailError = validateEmail(form.vendorEmail);
    const gstError = validateGST(form.gstNo);
    const pincodeError = validatePincode(form.pincode);
    const fuelError = validateFuel(priceRate.fuel);
    
    setErrors({
      vendorPhone: phoneError,
      vendorEmail: emailError,
      gstNo: gstError,
      pincode: pincodeError,
      fuel: fuelError
    });
    
    if (phoneError || emailError || gstError || pincodeError || fuelError) {
      toast.error("Please fix the validation errors before adding vendor");
      return;
    }

    if (!customerID) {
      toast.error("User authentication error. Please log out and log in again.");
      return;
    }

    // Validate zone matrix if zones are selected
    if (selectedZones.length > 0) {
      const hasEmptyPrices = selectedZones.some(fromZone => 
        selectedZones.some(toZone => 
          !zoneMatrix[fromZone] || zoneMatrix[fromZone][toZone] === undefined || zoneMatrix[fromZone][toZone] === null
        )
      );
      
      if (hasEmptyPrices) {
        toast.error("Please fill in all zone-to-zone prices before adding vendor");
        return;
      }
    }

    setIsAddingVendor(true);
    
    // Create vendor data object
    const vendorData = {
      id: Date.now(), // Simple ID for local storage
      ...form,
      vendorPhone: Number(form.vendorPhone),
      pincode: Number(form.pincode),
      rating: Number(form.rating),
      priceRate,
      priceChart: zoneMatrix,
      selectedZones,
      addedAt: new Date().toLocaleString()
    };

    // Add to saved vendors list
    setSavedVendors(prev => [...prev, vendorData]);
    
    // Reset form
    setForm({ 
      customerID: customerID, 
      vendorCode: "", 
      vendorPhone: "", 
      vendorEmail: "", 
      gstNo: "", 
      mode: "", 
      address: "", 
      state: "", 
      city: "",
      pincode: "", 
      rating: "3", 
      companyName: "",
      subVendor: ""
    });
    setPriceRate({});
    setSelectedZones([]);
    setZoneMatrix({});
    setErrors({ vendorPhone: "", vendorEmail: "", gstNo: "", pincode: "", fuel: "" });
    
    toast.success("Your Vendor saved successfully");
    setIsAddingVendor(false);
  };

  // Function to delete a vendor from the list
  const handleDeleteVendor = (vendorId: number) => {
    if (window.confirm("Are you sure you want to delete this vendor?")) {
      setSavedVendors(prev => prev.filter(vendor => vendor.id !== vendorId));
      toast.success("Vendor deleted successfully!");
    }
  };

  // Function to validate current form data
  const validateCurrentForm = () => {
    // Check if all required fields are filled
    const requiredFields = {
      companyName: form.companyName,
      vendorCode: form.vendorCode,
      vendorPhone: form.vendorPhone,
      vendorEmail: form.vendorEmail,
      gstNo: form.gstNo,
      mode: form.mode,
      address: form.address,
      state: form.state,
      city: form.city,
      pincode: form.pincode,
      rating: form.rating
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([, value]) => !value || value.toString().trim() === '');

    if (missingFields.length > 0) {
      return false;
    }

    // Validate field formats
    const phoneError = validatePhone(form.vendorPhone);
    const emailError = validateEmail(form.vendorEmail);
    const gstError = validateGST(form.gstNo);
    const pincodeError = validatePincode(form.pincode);
    const fuelError = validateFuel(priceRate.fuel);

    if (phoneError || emailError || gstError || pincodeError || fuelError) {
      return false;
    }

    // Validate zone matrix if zones are selected
    if (selectedZones.length > 0) {
      const hasEmptyPrices = selectedZones.some(fromZone => 
        selectedZones.some(toZone => 
          !zoneMatrix[fromZone] || zoneMatrix[fromZone][toZone] === undefined || zoneMatrix[fromZone][toZone] === null
        )
      );
      
      if (hasEmptyPrices) {
        return false;
      }
    }

    return true;
  };

  // Function to edit a vendor (populate form with vendor data)
  const handleEditVendor = (vendor: any) => {
    // Populate form with vendor data
    setForm({
      customerID: vendor.customerID,
      vendorCode: vendor.vendorCode,
      vendorPhone: vendor.vendorPhone.toString(),
      vendorEmail: vendor.vendorEmail,
      gstNo: vendor.gstNo,
      mode: vendor.mode,
      address: vendor.address,
      state: vendor.state,
      city: vendor.city,
      pincode: vendor.pincode.toString(),
      rating: vendor.rating.toString(),
      companyName: vendor.companyName,
      subVendor: vendor.subVendor || ""
    });

    // Populate price rate
    setPriceRate(vendor.priceRate || {});

    // Populate zones and matrix
    setSelectedZones(vendor.selectedZones || []);
    setZoneMatrix(vendor.priceChart || {});

    // Clear any existing errors
    setErrors({ vendorPhone: "", vendorEmail: "", gstNo: "", pincode: "", fuel: "" });

    // Remove the vendor from the list (since we're editing it)
    setSavedVendors(prev => prev.filter(v => v.id !== vendor.id));

    toast.success("Vendor data loaded for editing!");
    
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const token = Cookies.get("authToken");
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if we have vendors in the list OR if the current form is valid
    const hasSavedVendors = savedVendors.length > 0;
    const isCurrentFormValid = validateCurrentForm();
    
    if (!hasSavedVendors && !isCurrentFormValid) {
      toast.error("Please add at least one vendor or fill in all required fields");
      return;
    }
    
    setIsSubmitting(true);
    
    // Prepare vendors to save (saved vendors + current form if valid)
    const vendorsToSave = [...savedVendors];
    
    // If current form is valid and not already in saved vendors, add it
    if (isCurrentFormValid && !hasSavedVendors) {
      const currentVendorData = {
        id: Date.now(),
        ...form,
        vendorPhone: Number(form.vendorPhone),
        pincode: Number(form.pincode),
        rating: Number(form.rating),
        priceRate,
        priceChart: zoneMatrix,
        selectedZones,
        addedAt: new Date().toLocaleString()
      };
      vendorsToSave.push(currentVendorData);
    }
    
    const toastId = toast.loading(`Saving ${vendorsToSave.length} vendor(s) to backend...`);
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      // Save each vendor to the backend
      for (const vendor of vendorsToSave) {
        try {
          const payload = { 
            ...vendor,
            // Remove local fields that shouldn't be sent to backend
            id: undefined,
            addedAt: undefined
          };

          // Try multiple approaches: proxy, then legacy, then new endpoint
          let res;
          try {
            // First try using the Vite proxy (which should route to the correct backend)
            res = await axios.post("/api/transporter/add-tied-up", payload, {
              headers: { Authorization: `Bearer ${token}` }
            });
          } catch (proxyError: any) {
            console.warn("Proxy route failed, trying legacy route:", proxyError.message);
            try {
              // Try the legacy route that should exist on deployed backend
              res = await axios.post("https://backend-bcxr.onrender.com/api/transporter/addtiedupcompanies", payload, {
                headers: { Authorization: `Bearer ${token}` }
              });
            } catch (legacyError: any) {
              console.warn("Legacy route failed, trying direct new route:", legacyError.message);
              try {
                // Try the new route directly
                res = await axios.post("https://backend-bcxr.onrender.com/api/transporter/add-tied-up", payload, {
                  headers: { Authorization: `Bearer ${token}` }
                });
              } catch (directError: any) {
                console.error("All routes failed for vendor:", vendor.companyName);
                throw proxyError; // Throw the original proxy error
              }
            }
          }

          if (res.data.success) {
            successCount++;
          } else {
            errorCount++;
            console.error(`Failed to save vendor ${vendor.companyName}:`, res.data.message);
          }
        } catch (err: any) {
          errorCount++;
          console.error(`Error saving vendor ${vendor.companyName}:`, err);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully saved ${successCount} vendor(s) to backend!`, { id: toastId, duration: 4000 });
        
        // Clear saved vendors list after successful backend save
        setSavedVendors([]);
        
        // Reset form
        setForm({ 
          customerID: customerID, 
          vendorCode: "", 
          vendorPhone: "", 
          vendorEmail: "", 
          gstNo: "", 
          mode: "", 
          address: "", 
          state: "", 
          city: "",
          pincode: "", 
          rating: "3", 
          companyName: "",
          subVendor: ""
        });
        setPriceRate({});
        setSelectedZones([]);
        setZoneMatrix({});
        setErrors({ vendorPhone: "", vendorEmail: "", gstNo: "", pincode: "", fuel: "" });
        
        if (errorCount > 0) {
          toast.error(`${errorCount} vendor(s) failed to save. Check console for details.`);
        }
      } else {
        toast.error("Failed to save any vendors to backend. Please try again.", { id: toastId });
      }
    } catch (err: any) {
      console.error("Submission error:", err);
      toast.error("Failed to save vendors to backend. Please try again.", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };


  const toggleVolumetricTooltip = () => {
    setShowVolumetricTooltip(prev => !prev);
  };

  const toggleVolumetricDropdown = () => {
    setShowVolumetricDropdown(prev => !prev);
  };

  const toggleDaccTooltip = () => {
    setShowDaccTooltip(prev => !prev);
  };

  const toggleFuelDropdown = () => {
    setShowFuelDropdown(prev => !prev);
  };

  const toggleHandlingVariableDropdown = () => {
    setShowHandlingVariableDropdown(prev => !prev);
  };

  const toggleRovVariableDropdown = () => {
    setShowRovVariableDropdown(prev => !prev);
  };

  const toggleCodVariableDropdown = () => {
    setShowCodVariableDropdown(prev => !prev);
  };

  const toggleTopayVariableDropdown = () => {
    setShowTopayVariableDropdown(prev => !prev);
  };

  const toggleAppointmentVariableDropdown = () => {
    setShowAppointmentVariableDropdown(prev => !prev);
  };



  const handleVolumetricDivisorSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
      setPriceRate((prev: any) => ({
        ...prev,
        divisor: parseFloat(value)
      }));
    }
  };

  const handleFuelSurchargeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
      setPriceRate((prev: any) => ({
        ...prev,
        fuel: parseFloat(value)
      }));
      // Clear error when valid option is selected
      setErrors(prev => ({ ...prev, fuel: "" }));
    }
  };


  return (
    <div className="bg-slate-100 min-h-screen font-sans">
      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Add Tied-Up Company</h1>
          <p className="mt-2 text-md text-slate-500">Create a new partner profile with detailed pricing information.</p>
        </header>
        
        {/* Section 1: Company Details */}
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm transition-all">
          <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-4 mb-6">Company Information</h3>
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Company Name - Simple Text Input */}
            <StyledInputField 
              name="companyName" 
              label="Company Name" 
              value={form.companyName} 
              onChange={handleChange} 
              placeholder="Enter company name"
              maxLength={20}
            />
            
            {/* Sub Vendor - Optional Field */}
            <StyledInputField 
              name="subVendor" 
              label="Sub Vendor" 
              value={form.subVendor} 
              onChange={handleChange} 
              placeholder="Enter sub vendor name (optional)"
              required={false}
              maxLength={20}
            />
            
            <StyledInputField 
              name="vendorCode" 
              label="Vendor Code" 
              value={form.vendorCode} 
              onChange={handleChange} 
              maxLength={20}
            />
            
            {/* Phone with validation */}
            <StyledInputField 
              name="vendorPhone" 
              label="Vendor Phone Number" 
              type="text" 
              value={form.vendorPhone} 
              onChange={handleChange} 
              onKeyDown={handleVendorPhoneKeyDown}
              maxLength={10}
              error={errors.vendorPhone}
            />
            
            {/* Email with validation */}
            <StyledInputField 
              name="vendorEmail" 
              label="Vendor Email Address" 
              type="email" 
              value={form.vendorEmail} 
              onChange={handleChange} 
              onBlur={handleEmailBlur}
              error={errors.vendorEmail}
            />
            
            {/* GST with validation */}
            <StyledInputField 
              name="gstNo" 
              label="GST No." 
              value={form.gstNo} 
              onChange={handleChange} 
              maxLength={15}
              error={errors.gstNo}
            />
            
            <div className="sm:col-span-2">
              <StyledInputField 
                name="address" 
                label="Address" 
                value={form.address} 
                onChange={handleChange} 
                required={true}
              />
            </div>
            
            {/* Pincode with auto-fill */}
            <div className="relative">
              <StyledInputField 
                name="pincode" 
                label="Pincode (6 digits)" 
                type="text" 
                value={form.pincode} 
                onChange={handleChange} 
                onBlur={handlePincodeBlur}
                onKeyDown={handlePincodeKeyDown}
                maxLength={6} 
                error={errors.pincode}
              />
              {isLoadingPincode && (
                <div className="absolute right-3 top-8">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
            
            {/* State Dropdown */}
            <DropdownField
              name="state"
              label="State"
              value={form.state}
              onChange={(e) => setForm(prev => ({ ...prev, state: e.target.value }))}
              options={stateOptions}
            />
            
            {/* City Input Field */}
            <StyledInputField 
              name="city" 
              label="City" 
              value={form.city} 
              onChange={handleChange} 
              onKeyDown={handleCityKeyDown}
              placeholder="Enter city name"
            />
            
            {/* Transport Mode Dropdown */}
            <DropdownField
              name="mode"
              label="Transport Mode"
              value={form.mode}
              onChange={(e) => setForm(prev => ({ ...prev, mode: e.target.value }))}
              options={TRANSPORT_MODES}
            />
            
            <RatingSlider
                label="Company Rating"
                value={form.rating}
                onChange={handleChange}
            />
          </div>
        </div>

        {/* Section 2: Price Rate */}
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm transition-all">
          <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-4 mb-6">Price Rate Configuration</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
            <StyledInputField name="minWeight" label="Min. Weight (kg)" type="text" onChange={handleNestedInputChange} onKeyDown={handleMinWeightKeyDown} min={1} max={1000} />
            <StyledInputField name="docketCharges" label="Docket Charges (₹)" type="text" onChange={handleNestedInputChange} onKeyDown={handleDocketChargesKeyDown} min={0} max={500} />
            <FuelSurchargeField 
              name="fuel" 
              label="Fuel Surcharge (%)" 
              value={priceRate.fuel || ""} 
              onChange={handleNestedInputChange}
              onSelectChange={handleFuelSurchargeSelect}
              onKeyDown={handleFuelSurchargeKeyDown}
              showDropdown={showFuelDropdown}
              onToggleDropdown={toggleFuelDropdown}
              error={errors.fuel}
            />
            <VolumetricDivisorField 
              name="divisor" 
              label="Volumetric Divisor (L x B x H)" 
              value={priceRate.divisor || ""} 
              onChange={handleNestedInputChange}
              onSelectChange={handleVolumetricDivisorSelect}
              onKeyDown={handleVolumetricDivisorKeyDown}
              showTooltip={showVolumetricTooltip}
              onToggleTooltip={toggleVolumetricTooltip}
              showDropdown={showVolumetricDropdown}
              onToggleDropdown={toggleVolumetricDropdown}
            />
            <StyledInputField name="minCharges" label="Min. Charges (₹)" type="text" onChange={handleNestedInputChange} onKeyDown={handleMinChargesKeyDown} min={1} max={1000} />
            <StyledInputField name="greenTax" label="Green Tax (₹)" type="text" onChange={handleNestedInputChange} onKeyDown={handleGreenTaxKeyDown} min={0} max={5000} />
            <DaccChargesField 
              name="daccCharges" 
              label="DACC Charges (₹)" 
              value={priceRate.daccCharges || ""} 
              onChange={handleNestedInputChange}
              onKeyDown={handleDaccChargesKeyDown}
              showTooltip={showDaccTooltip}
              onToggleTooltip={toggleDaccTooltip}
            />
            <StyledInputField name="miscellanousCharges" label="Misc. Charges (₹)" type="text" onChange={handleNestedInputChange} onKeyDown={handleMiscChargesKeyDown} min={0} max={10000} />
          </div>
          <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-slate-50/70 p-4 rounded-lg space-y-4 ring-1 ring-slate-200">
                  <h4 className="font-medium text-slate-700">Handling Charges</h4>
                  <StyledInputField name="handlingCharges.fixed" label="Fixed Rate (₹)" type="text" onChange={handleNestedInputChange} onKeyDown={(e) => handleChargeFixedKeyDown(e, 5000)} min={0} max={5000} />
                  <PercentageField 
                    name="handlingCharges.variable" 
                    label="Variable Rate (%)" 
                    value={priceRate.handlingCharges?.variable || ""} 
                    onChange={handleNestedInputChange} 
                    onSelectChange={(e) => {
                      setPriceRate((prev: any) => ({
                        ...prev,
                        handlingCharges: { ...prev.handlingCharges, variable: e.target.value }
                      }));
                    }}
                    onKeyDown={handleHandlingVariableKeyDown}
                    showDropdown={showHandlingVariableDropdown}
                    onToggleDropdown={toggleHandlingVariableDropdown}
                  />
                  <StyledInputField name="handlingCharges.threshholdweight" label="Weight Threshold (Kg)" type="text" onChange={handleNestedInputChange} onKeyDown={handleHandlingWeightKeyDown} min={1} max={20000} />
              </div>
              <div className="bg-slate-50/70 p-4 rounded-lg space-y-4 ring-1 ring-slate-200">
                <h4 className="font-medium text-slate-700">ROV Charges (Risk on Value)</h4>
                <StyledInputField name="rovCharges.fixed" label="Fixed Rate (₹)" type="text" onChange={handleNestedInputChange} onKeyDown={(e) => handleChargeFixedKeyDown(e, 5000)} min={0} max={5000} />
                <PercentageField 
                  name="rovCharges.variable" 
                  label="Variable Rate (%)" 
                  value={priceRate.rovCharges?.variable || ""} 
                  onChange={handleNestedInputChange} 
                  onSelectChange={(e) => {
                    setPriceRate((prev: any) => ({
                      ...prev,
                      rovCharges: { ...prev.rovCharges, variable: e.target.value }
                    }));
                  }}
                  onKeyDown={handlePercentageKeyDown}
                  showDropdown={showRovVariableDropdown}
                  onToggleDropdown={toggleRovVariableDropdown}
                />
                </div>
              <div className="bg-slate-50/70 p-4 rounded-lg space-y-4 ring-1 ring-slate-200">
                <h4 className="font-medium text-slate-700">COD Charges</h4>
                <StyledInputField name="codCharges.fixed" label="Fixed Rate (₹)" type="text" onChange={handleNestedInputChange} onKeyDown={(e) => handleChargeFixedKeyDown(e, 2000)} min={0} max={2000} />
                <PercentageField 
                  name="codCharges.variable" 
                  label="Variable Rate (%)" 
                  value={priceRate.codCharges?.variable || ""} 
                  onChange={handleNestedInputChange} 
                  onSelectChange={(e) => {
                    setPriceRate((prev: any) => ({
                      ...prev,
                      codCharges: { ...prev.codCharges, variable: e.target.value }
                    }));
                  }}
                  onKeyDown={handlePercentageKeyDown}
                  showDropdown={showCodVariableDropdown}
                  onToggleDropdown={toggleCodVariableDropdown}
                />
              </div>
              <div className="bg-slate-50/70 p-4 rounded-lg space-y-4 ring-1 ring-slate-200">
                <h4 className="font-medium text-slate-700">Topay Charges</h4>
                <StyledInputField name="topayCharges.fixed" label="Fixed Rate (₹)" type="text" onChange={handleNestedInputChange} onKeyDown={(e) => handleChargeFixedKeyDown(e, 2000)} min={0} max={2000} />
                <PercentageField 
                  name="topayCharges.variable" 
                  label="Variable Rate (%)" 
                  value={priceRate.topayCharges?.variable || ""} 
                  onChange={handleNestedInputChange} 
                  onSelectChange={(e) => {
                    setPriceRate((prev: any) => ({
                      ...prev,
                      topayCharges: { ...prev.topayCharges, variable: e.target.value }
                    }));
                  }}
                  onKeyDown={handlePercentageKeyDown}
                  showDropdown={showTopayVariableDropdown}
                  onToggleDropdown={toggleTopayVariableDropdown}
                />
              </div>
              <div className="bg-slate-50/70 p-4 rounded-lg space-y-4 ring-1 ring-slate-200">
                <h4 className="font-medium text-slate-700">Appointment Charges</h4>
                <StyledInputField name="appointmentCharges.fixed" label="Fixed Rate (₹)" type="text" onChange={handleNestedInputChange} onKeyDown={(e) => handleChargeFixedKeyDown(e, 2000)} min={0} max={2000} />
                <PercentageField 
                  name="appointmentCharges.variable" 
                  label="Variable Rate (%)" 
                  value={priceRate.appointmentCharges?.variable || ""} 
                  onChange={handleNestedInputChange} 
                  onSelectChange={(e) => {
                    setPriceRate((prev: any) => ({
                      ...prev,
                      appointmentCharges: { ...prev.appointmentCharges, variable: e.target.value }
                    }));
                  }}
                  onKeyDown={handlePercentageKeyDown}
                  showDropdown={showAppointmentVariableDropdown}
                  onToggleDropdown={toggleAppointmentVariableDropdown}
                />
              </div>
          </div>
        </div>
        
        {/* Section 3: Chart Zonal */}
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm transition-all">
          <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-4 mb-6">Chart Zonal</h3>
          
          {/* Always show Zone Selection */}
          <div className="mb-8">
            <ZoneSelectionComponent 
              selectedZones={selectedZones}
              onZoneChange={handleZoneSelectionChange}
            />
          </div>

          {/* Show Zone Matrix when zones are selected */}
          {selectedZones.length > 0 && (
            <ZoneMatrixComponent
              selectedZones={selectedZones}
              zoneMatrix={zoneMatrix}
              onPriceChange={handleMatrixPriceChange}
            />
          )}
        </div>

        {/* Section 4: Saved Vendors Table */}
        <SavedVendorsTable 
          vendors={savedVendors} 
          onEdit={handleEditVendor}
          onDelete={handleDeleteVendor}
        />

        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={handleAddVendor}
            disabled={isAddingVendor}
            className="group inline-flex items-center justify-center gap-2 py-3 px-8 text-sm font-semibold tracking-wide rounded-lg text-black bg-sky-200 hover:bg-sky-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 focus:ring-sky-500 disabled:bg-sky-100 disabled:cursor-wait transition-all ease-in-out duration-300"
          >
            <PlusCircleIcon className="h-5 w-5 transform group-hover:scale-110 transition-transform"/>
            {isAddingVendor ? "Adding..." : "Add Vendor"}
          </button>
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isSubmitting || (savedVendors.length === 0 && !validateCurrentForm())}
              className="group inline-flex items-center justify-center gap-2 py-3 px-8 text-sm font-semibold tracking-wide rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-wait transition-all ease-in-out duration-300"
            >
              <CheckCircleIcon className="h-5 w-5 transform group-hover:scale-110 transition-transform"/>
              {isSubmitting ? "Saving to Backend..." : `Save All Vendors (${savedVendors.length + (validateCurrentForm() && savedVendors.length === 0 ? 1 : 0)})`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AddTiedUpCompany;
