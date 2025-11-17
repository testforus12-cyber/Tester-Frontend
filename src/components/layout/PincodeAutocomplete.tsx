import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, AlertCircle, Loader2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PincodeSuggestion {
  pincode: string;
  city: string;
  state: string;
  district: string;
}

interface PincodeAutocompleteProps {
  label: string;
  id: string;
  value: string;
  placeholder: string;
  error?: string | null;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onSelect?: (suggestion: PincodeSuggestion) => void;
  onValidationChange?: (isValid: boolean) => void;
  className?: string;
}

const PincodeAutocomplete: React.FC<PincodeAutocompleteProps> = ({
  label,
  id,
  value,
  placeholder,
  error,
  onChange,
  onBlur,
  onSelect,
  onValidationChange,
  className = '',
}) => {
  const [suggestions, setSuggestions] = useState<PincodeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [lastValidValue, setLastValidValue] = useState('');
  const [hasAttemptedSelection, setHasAttemptedSelection] = useState(false);
  const [isUserSelected, setIsUserSelected] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced API call for suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      
      const response = await fetch(
        `https://api.postalpincode.in/pincode/${query}`,
        {
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch suggestions`);
      }

      const data = await response.json();
      
      if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice) {
        const uniqueSuggestions = data[0].PostOffice
          .map((office: any) => ({
            pincode: office.Pincode,
            city: office.Name,
            state: office.State,
            district: office.District,
          }))
          .filter((suggestion: PincodeSuggestion, index: number, self: PincodeSuggestion[]) => 
            index === self.findIndex(s => s.pincode === suggestion.pincode)
          );
        
        setSuggestions(uniqueSuggestions);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error fetching pincode suggestions:', error);
        setSuggestions([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  const debouncedSearch = useCallback((query: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 250);
  }, [fetchSuggestions]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Only allow digits and limit to 6 characters
    const digitsOnly = inputValue.replace(/\D/g, '').slice(0, 6);
    
    console.log('Input changed:', { inputValue, digitsOnly, length: digitsOnly.length });
    
    onChange(digitsOnly);
    setHasAttemptedSelection(false); // Reset attempt flag when typing
    setIsUserSelected(false); // Reset user selection flag when typing
    
    if (digitsOnly.length >= 3) {
      setIsOpen(true);
      debouncedSearch(digitsOnly);
    } else {
      setIsOpen(false);
      setSuggestions([]);
    }
    
    setSelectedIndex(-1);
  };

  // Handle input focus
  const handleFocus = () => {
    if (value.length >= 3 && suggestions.length > 0) {
      setIsOpen(true);
    }
  };

  // Handle input blur
  const handleBlur = () => {
    // Delay to allow selection click to register
    setTimeout(() => {
      setIsOpen(false);
      setSelectedIndex(-1);
      
      // Mark that user has attempted to enter a pincode
      if (value.length >= 3) {
        setHasAttemptedSelection(true);
      }
      
      // Validate pincode format
      if (value && !/^[1-9]\d{5}$/.test(value)) {
        // Revert to last valid value if current is invalid
        if (lastValidValue) {
          onChange(lastValidValue);
        }
      } else if (value && /^[1-9]\d{5}$/.test(value)) {
        // Update last valid value
        setLastValidValue(value);
      }
      
      onBlur?.();
    }, 150);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: PincodeSuggestion) => {
    onChange(suggestion.pincode);
    setLastValidValue(suggestion.pincode);
    setHasAttemptedSelection(false); // Reset since user made a valid selection
    setIsUserSelected(true); // Mark as user selected
    setIsOpen(false);
    setSelectedIndex(-1);
    onSelect?.(suggestion);
    inputRef.current?.blur();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Validate pincode format
  const validatePincode = (pin: string): string | null => {
    if (!pin) return 'Pincode is required.';
    if (!/^\d{6}$/.test(pin)) return 'Enter a 6-digit pincode.';
    if (!/^[1-9]\d{5}$/.test(pin)) return 'Pincode cannot start with 0.';
    return null;
  };

  // Check if current value is valid
  const isValid = value && /^[1-9]\d{5}$/.test(value);
  const formatError = validatePincode(value);
  
  // Check if pincode exists in suggestions (for 6-digit pincodes)
  const pincodeExists = value.length === 6 && suggestions.some(s => s.pincode === value);
  
  // Only show invalid pincode error if:
  // 1. User has attempted selection (blurred without selecting)
  // 2. Pincode is 6 digits
  // 3. Pincode doesn't exist in suggestions
  // 4. No format error
  // 5. User didn't select from dropdown
  const isInvalidPincode = hasAttemptedSelection && 
                          value.length === 6 && 
                          !pincodeExists && 
                          !formatError && 
                          !isUserSelected;
  
  // Determine if the pincode is valid
  // Valid if: proper format AND (user selected from dropdown OR pincode exists in suggestions OR no attempt made yet)
  const isPincodeValid = isValid && 
                        !formatError && 
                        (isUserSelected || pincodeExists || !hasAttemptedSelection);

  // Notify parent about validation changes
  useEffect(() => {
    onValidationChange?.(Boolean(isPincodeValid));
  }, [isPincodeValid, onValidationChange]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-slate-600 mb-1.5"
        >
          {label}
        </label>
      )}
      
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400">
            <MapPin />
          </div>
          
          <input
            ref={inputRef}
            id={id}
            type="text"
            value={value}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={6}
            inputMode="numeric"
            pattern="[1-9]\d{5}"
            autoComplete="off"
            aria-invalid={!!error || !!formatError || isInvalidPincode}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            className={`block w-full py-2 pl-10 pr-10 bg-white border rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-1 transition ${
              error || formatError || isInvalidPincode
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : (isPincodeValid && isUserSelected)
                ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
            }`}
          />
          
          <div className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            ) : (isPincodeValid && isUserSelected) ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (error || formatError || isInvalidPincode) ? (
              <AlertCircle className="h-4 w-4 text-red-500" />
            ) : null}
          </div>
        </div>

        {/* Dropdown */}
        <AnimatePresence>
          {isOpen && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
              style={{ zIndex: 9999 }}
              role="listbox"
            >
              {suggestions.map((suggestion, index) => (
                <div
                  key={`${suggestion.pincode}-${suggestion.city}`}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className={`px-4 py-3 cursor-pointer transition-colors ${
                    index === selectedIndex
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">
                        {suggestion.pincode}
                      </div>
                      <div className="text-xs text-slate-500">
                        {suggestion.city}, {suggestion.district}, {suggestion.state}
                      </div>
                    </div>
                    <MapPin className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* No suggestions message */}
        <AnimatePresence>
          {isOpen && !isLoading && suggestions.length === 0 && value.length >= 3 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4 text-center"
            >
              <div className="text-sm text-slate-500">
                No pincodes found for "{value}"
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      {(error || formatError) && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <AlertCircle size={14} />
          {error || formatError}
        </p>
      )}

      {/* Invalid pincode message */}
      {isInvalidPincode && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <AlertCircle size={14} />
          Pincode does not exist. Please select a valid pincode from the list.
        </p>
      )}

      {/* Validation message for invalid selection */}
      {value && !isValid && !formatError && !isInvalidPincode && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <AlertCircle size={14} />
          Please select a valid Indian pincode from the list.
        </p>
      )}
    </div>
  );
};

export default PincodeAutocomplete;