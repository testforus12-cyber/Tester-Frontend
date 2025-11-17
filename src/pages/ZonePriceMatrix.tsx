import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, ChevronRight, MapPin, Sparkles } from "lucide-react";
import { useWizardStorage } from "../hooks/useWizardStorage";
import type { ZoneConfig, RegionGroup, PincodeEntry } from "../types/wizard.types";
import DecimalInput from "../components/DecimalInput";

/* =========================================================
   CONSTANTS
   ======================================================= */
const MAX_ZONES = 28;

const ZONE_ORDER = [
  'N1', 'N2', 'N3', 'N4', 'N5', 'N6',
  'W1', 'W2', 'W3', 'W4',
  'C1', 'C2', 'C3', 'C4',
  'S1', 'S2', 'S3', 'S4', 'S5', 'S6',
  'E1', 'E2', 'E3', 'E4',
  'NE1', 'NE2', 'NE3', 'NE4'
];

const regionGroups: Record<RegionGroup, string[]> = {
  North: ["N1", "N2", "N3", "N4", "N5", "N6"],
  South: ["S1", "S2", "S3", "S4", "S5", "S6"],
  East: ["E1", "E2", "E3", "E4"],
  West: ["W1", "W2", "W3", "W4"],
  Northeast: ["NE1", "NE2", "NE3", "NE4"],
  Central: ["C1", "C2", "C3", "C4"],
};

/* =========================================================
   HELPER FUNCTIONS
   ======================================================= */

const codeToRegion = (code: string): RegionGroup => {
  if (code.startsWith("NE")) return "Northeast";
  const c = code[0];
  if (c === "N") return "North";
  if (c === "S") return "South";
  if (c === "E") return "East";
  if (c === "W") return "West";
  if (c === "C") return "Central";
  return "North";
};

const sortZonesByOrder = (zones: string[]): string[] => {
  return zones.sort((a, b) => {
    const indexA = ZONE_ORDER.indexOf(a);
    const indexB = ZONE_ORDER.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    return a.localeCompare(b);
  });
};

const csKey = (city: string, state: string) => `${city}||${state}`;
const parseCsKey = (key: string) => {
  const i = key.lastIndexOf("||");
  return { city: key.slice(0, i), state: key.slice(i + 2) };
};

/* =========================================================
   MAIN COMPONENT
   ======================================================= */
const ZonePriceMatrix: React.FC = () => {
  const navigate = useNavigate();
  const { wizardData, updateZones, updatePriceMatrix, isLoaded } = useWizardStorage();

  // Dataset
  const [pincodeData, setPincodeData] = useState<PincodeEntry[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Steps
  const [currentStep, setCurrentStep] = useState<"select-zones" | "configure-zones" | "price-matrix">("select-zones");

  // Step 1: Zone Selection
  const [selectedZoneCodes, setSelectedZoneCodes] = useState<string[]>([]);

  // Step 2: Zone Configuration
  const [zoneConfigs, setZoneConfigs] = useState<ZoneConfig[]>([]);
  const [currentZoneIndex, setCurrentZoneIndex] = useState(0);
  const [activeStateByZone, setActiveStateByZone] = useState<Record<string, string | null>>({});

  /* -------------------- Load Pincode Data -------------------- */
  useEffect(() => {
    const url = `${import.meta.env.BASE_URL || "/"}pincodes.json`;
    fetch(url)
      .then((res) => res.json())
      .then((data: PincodeEntry[]) => {
        const filtered = (Array.isArray(data) ? data : []).filter(
          (e) =>
            e.state &&
            e.city &&
            e.state !== "NAN" &&
            e.state !== "NaN" &&
            e.city !== "NAN" &&
            e.city !== "NaN" &&
            e.state.trim() !== "" &&
            e.city.trim() !== "" &&
            e.pincode &&
            /^\d{6}$/.test(String(e.pincode))
        );
        setPincodeData(filtered);
      })
      .catch((err) => console.error("Failed to load pincode data:", err))
      .finally(() => setIsLoadingData(false));
  }, []);

  /* -------------------- Load from Wizard Storage -------------------- */
  useEffect(() => {
    if (!isLoaded) return;

    if (wizardData.zones && wizardData.zones.length > 0) {
      const sortedZones = [...wizardData.zones].sort((a, b) => {
        const indexA = ZONE_ORDER.indexOf(a.zoneCode);
        const indexB = ZONE_ORDER.indexOf(b.zoneCode);
        return indexA - indexB;
      });

      setZoneConfigs(sortedZones);
      setSelectedZoneCodes(sortedZones.map((z) => z.zoneCode));

      // Determine current step based on data
      if (wizardData.priceMatrix && Object.keys(wizardData.priceMatrix).length > 0) {
        setCurrentStep("price-matrix");
      } else if (sortedZones.some((z) => z.isComplete)) {
        setCurrentStep("configure-zones");
      }
    }
  }, [isLoaded, wizardData]);

  /* -------------------- Derived Data -------------------- */

  // Region -> State -> Set<City>
  const byStateByRegion = useMemo(() => {
    const map = new Map<RegionGroup, Map<string, Set<string>>>();
    (["North", "South", "East", "West", "Northeast", "Central"] as RegionGroup[]).forEach((r) =>
      map.set(r, new Map())
    );

    for (const e of pincodeData) {
      const region = codeToRegion(e.zone || "");
      const stateMap = map.get(region)!;
      if (!stateMap.has(e.state)) stateMap.set(e.state, new Set());
      stateMap.get(e.state)!.add(e.city);
    }

    return map;
  }, [pincodeData]);

  // Get all city keys for a state in a region
  const getAllCityKeysForState = (state: string, region: RegionGroup): string[] => {
    const stateMap = byStateByRegion.get(region);
    if (!stateMap) return [];
    const cities = stateMap.get(state);
    if (!cities) return [];
    return Array.from(cities).map((c) => csKey(c, state));
  };

  // Get cities already used by other zones
  const getUsedCities = (excludeZoneIndex?: number): Set<string> => {
    const used = new Set<string>();
    zoneConfigs.forEach((z, idx) => {
      if (idx !== excludeZoneIndex) {
        z.selectedCities.forEach((c) => used.add(c));
      }
    });
    return used;
  };

  // Get available city keys for a state (not used by other zones)
  const getAvailableCityKeys = (state: string, region: RegionGroup, currentZoneIndex: number): string[] => {
    const allKeys = getAllCityKeysForState(state, region);
    const used = getUsedCities(currentZoneIndex);
    return allKeys.filter((k) => !used.has(k));
  };

  // Current zone config
  const currentConfig = zoneConfigs[currentZoneIndex];

  // Get states for current zone
  const availableStates = useMemo(() => {
    if (!currentConfig) return [];
    const stateMap = byStateByRegion.get(currentConfig.region);
    if (!stateMap) return [];
    
    const states: string[] = [];
    stateMap.forEach((_, state) => {
      // Include state if it has available cities OR already has cities selected
      const available = getAvailableCityKeys(state, currentConfig.region, currentZoneIndex);
      const hasSelected = currentConfig.selectedCities.some((k) => parseCsKey(k).state === state);
      if (available.length > 0 || hasSelected) {
        states.push(state);
      }
    });
    
    return states.sort((a, b) => a.localeCompare(b));
  }, [currentConfig, byStateByRegion, currentZoneIndex, zoneConfigs]);

  /* =========================================================
     STEP 1: ZONE SELECTION
     ======================================================= */

  const toggleZoneSelection = (code: string) => {
    setSelectedZoneCodes((prev) => {
      const isSelected = prev.includes(code);

      if (isSelected) {
        // Deselection
        const next = prev.filter((c) => c !== code);
        const sorted = sortZonesByOrder(next);

        // Remove from configs
        setZoneConfigs((old) => old.filter((z) => z.zoneCode !== code));

        return sorted;
      } else {
        // Selection
        if (prev.length >= MAX_ZONES) {
          alert(`Maximum ${MAX_ZONES} zones allowed`);
          return prev;
        }

        const next = [...prev, code];
        const sorted = sortZonesByOrder(next);

        // Add to configs
        setZoneConfigs((old) => {
          const exists = old.find((z) => z.zoneCode === code);
          if (exists) return old;

          const newZone: ZoneConfig = {
            zoneCode: code,
            zoneName: code,
            region: codeToRegion(code),
            selectedStates: [],
            selectedCities: [],
            isComplete: false,
          };

          const updated = [...old, newZone];
          return updated.sort((a, b) => {
            const indexA = ZONE_ORDER.indexOf(a.zoneCode);
            const indexB = ZONE_ORDER.indexOf(b.zoneCode);
            return indexA - indexB;
          });
        });

        return sorted;
      }
    });
  };

  const proceedToConfiguration = () => {
    if (selectedZoneCodes.length === 0) {
      alert("Please select at least one zone");
      return;
    }
    setCurrentStep("configure-zones");
    setCurrentZoneIndex(0);
  };

  /* =========================================================
     STEP 2: ZONE CONFIGURATION
     ======================================================= */

  const setActiveState = (state: string | null) => {
    if (!currentConfig) return;
    setActiveStateByZone((prev) => ({ ...prev, [currentConfig.zoneCode]: state }));
  };

  const getActiveState = (): string | null => {
    if (!currentConfig) return null;
    return activeStateByZone[currentConfig.zoneCode] || null;
  };

  const toggleCity = (cityKey: string) => {
    if (!currentConfig) return;

    setZoneConfigs((prev) =>
      prev.map((z, idx) => {
        if (idx !== currentZoneIndex) return z;

        const isSelected = z.selectedCities.includes(cityKey);
        const selectedCities = isSelected
          ? z.selectedCities.filter((k) => k !== cityKey)
          : [...z.selectedCities, cityKey];

        // Derive states from cities
        const stateSet = new Set<string>();
        selectedCities.forEach((k) => stateSet.add(parseCsKey(k).state));
        const selectedStates = Array.from(stateSet).sort((a, b) => a.localeCompare(b));

        return { ...z, selectedCities, selectedStates };
      })
    );
  };

  const selectAllInState = (state: string) => {
    if (!currentConfig) return;

    const available = getAvailableCityKeys(state, currentConfig.region, currentZoneIndex);
    if (available.length === 0) return;

    setZoneConfigs((prev) =>
      prev.map((z, idx) => {
        if (idx !== currentZoneIndex) return z;

        const selectedCities = Array.from(new Set([...z.selectedCities, ...available]));

        // Derive states
        const stateSet = new Set<string>();
        selectedCities.forEach((k) => stateSet.add(parseCsKey(k).state));
        const selectedStates = Array.from(stateSet).sort((a, b) => a.localeCompare(b));

        return { ...z, selectedCities, selectedStates };
      })
    );
  };

  const clearState = (state: string) => {
    if (!currentConfig) return;

    setZoneConfigs((prev) =>
      prev.map((z, idx) => {
        if (idx !== currentZoneIndex) return z;

        const selectedCities = z.selectedCities.filter((k) => parseCsKey(k).state !== state);

        // Derive states
        const stateSet = new Set<string>();
        selectedCities.forEach((k) => stateSet.add(parseCsKey(k).state));
        const selectedStates = Array.from(stateSet).sort((a, b) => a.localeCompare(b));

        return { ...z, selectedCities, selectedStates };
      })
    );
  };

  const saveCurrentZone = () => {
    if (!currentConfig) return;

    if (currentConfig.selectedCities.length === 0) {
      alert("Please select at least one city before saving");
      return;
    }

    // Mark as complete
    setZoneConfigs((prev) =>
      prev.map((z, idx) => (idx === currentZoneIndex ? { ...z, isComplete: true } : z))
    );

    // Navigate to next incomplete zone
    const nextIncomplete = zoneConfigs.findIndex((z, idx) => idx > currentZoneIndex && !z.isComplete);
    if (nextIncomplete !== -1) {
      setCurrentZoneIndex(nextIncomplete);
    }
  };

  const finalizeConfiguration = () => {
    const validZones = zoneConfigs.filter((z) => z.selectedCities.length > 0);
    if (validZones.length === 0) {
      alert("Please configure at least one zone");
      return;
    }

    // Save zones to wizard storage
    updateZones(validZones);

    // Initialize price matrix
    const matrix: Record<string, Record<string, number>> = {};
    validZones.forEach((fromZone) => {
      matrix[fromZone.zoneCode] = {};
      validZones.forEach((toZone) => {
        matrix[fromZone.zoneCode][toZone.zoneCode] = 0;
      });
    });

    updatePriceMatrix(matrix);
    setCurrentStep("price-matrix");
  };

  /* =========================================================
     STEP 3: PRICE MATRIX
     ======================================================= */

  const validZones = useMemo(
    () => zoneConfigs.filter((z) => z.selectedCities.length > 0),
    [zoneConfigs]
  );

  const updatePrice = (fromZone: string, toZone: string, value: number | null) => {
    const updated = { ...wizardData.priceMatrix };
    if (!updated[fromZone]) updated[fromZone] = {};
    updated[fromZone][toZone] = value ?? 0;
    updatePriceMatrix(updated);
  };

  const getPrice = (fromZone: string, toZone: string): number | null => {
    return wizardData.priceMatrix?.[fromZone]?.[toZone] ?? null;
  };

  const savePriceMatrixAndReturn = () => {
    // Already saved via updatePrice, just navigate back
    navigate("/addvendor", { replace: true });
  };

  /* =========================================================
     RENDER
     ======================================================= */

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-slate-600">Loading data…</p>
        </div>
      </div>
    );
  }

  /* ---------- STEP 1: SELECT ZONES ---------- */
  if (currentStep === "select-zones") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => navigate("/addvendor")}
              className="inline-flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Add Vendor
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 md:p-8">
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">Select Your Zones</h1>
            <p className="mt-1 text-slate-600">Pick up to {MAX_ZONES} zones from the regions below.</p>

            {/* Region Groups */}
            <div className="mt-6 space-y-6">
              {(Object.keys(regionGroups) as RegionGroup[]).map((region) => (
                <div key={region} className="border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <MapPin className="h-6 w-6 text-blue-600" />
                    <h3 className="text-xl font-semibold text-slate-900">{region}</h3>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {regionGroups[region].map((code) => {
                      const selected = selectedZoneCodes.includes(code);
                      const disabled = !selected && selectedZoneCodes.length >= MAX_ZONES;

                      return (
                        <button
                          key={code}
                          onClick={() => !disabled && toggleZoneSelection(code)}
                          disabled={disabled}
                          className={`px-5 py-3 rounded-xl font-semibold transition-all ${
                            selected
                              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md scale-105"
                              : disabled
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                          }`}
                        >
                          {code}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Zones Summary */}
            {selectedZoneCodes.length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <h4 className="font-semibold text-blue-900">Selected Zones ({selectedZoneCodes.length})</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedZoneCodes.map((code) => (
                    <span key={code} className="px-3 py-1.5 bg-blue-600 text-white rounded-full text-sm">
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Proceed Button */}
            <div className="mt-8 flex justify-center">
              <button
                onClick={proceedToConfiguration}
                disabled={selectedZoneCodes.length === 0}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <Sparkles className="h-6 w-6" />
                Configure Zones
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- STEP 2: CONFIGURE ZONES ---------- */
  if (currentStep === "configure-zones" && currentConfig) {
    const activeState = getActiveState();

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-slate-900">Configure Zones</h1>
            <p className="text-slate-600">Assign cities to each zone. Cities can only belong to one zone.</p>
          </div>

          {/* Zone Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {zoneConfigs.map((z, idx) => (
              <button
                key={z.zoneCode}
                onClick={() => setCurrentZoneIndex(idx)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                  idx === currentZoneIndex
                    ? "bg-blue-600 text-white shadow-lg"
                    : z.isComplete
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                {z.zoneName} {z.isComplete && "✓"}
              </button>
            ))}
          </div>

          {/* Configuration Panel */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                Zone {currentConfig.zoneName} <span className="text-slate-500">({currentConfig.region})</span>
              </h2>
              <button
                onClick={saveCurrentZone}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
              >
                <CheckCircle className="h-5 w-5" /> Save & Next
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: States */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">States</h3>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {availableStates.map((state) => {
                    const allKeys = getAllCityKeysForState(state, currentConfig.region);
                    const selectedCount = currentConfig.selectedCities.filter((k) => parseCsKey(k).state === state).length;
                    const isActive = activeState === state;

                    return (
                      <div
                        key={state}
                        onClick={() => setActiveState(state)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          isActive
                            ? "border-blue-600 bg-blue-50"
                            : selectedCount > 0
                            ? "border-green-300 bg-green-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-slate-900">{state}</div>
                          <div className="text-sm text-slate-600">
                            {selectedCount}/{allKeys.length}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Cities */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Cities {activeState && `(${activeState})`}
                  </h3>
                  {activeState && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => selectAllInState(activeState)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-800 hover:bg-green-200"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => clearState(activeState)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-800 hover:bg-red-200"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                <div className="max-h-[500px] overflow-y-auto">
                  {!activeState && (
                    <div className="text-sm text-slate-500 text-center py-8">
                      Select a state to view its cities
                    </div>
                  )}

                  {activeState && (
                    <div className="space-y-2">
                      {(() => {
                        const available = getAvailableCityKeys(activeState, currentConfig.region, currentZoneIndex);
                        const alreadySelected = currentConfig.selectedCities.filter(
                          (k) => parseCsKey(k).state === activeState
                        );

                        // Combine and sort
                        const allCityKeys = Array.from(new Set([...alreadySelected, ...available]));
                        const sorted = allCityKeys
                          .map((k) => ({ key: k, city: parseCsKey(k).city }))
                          .sort((a, b) => a.city.localeCompare(b.city));

                        return sorted.map(({ key, city }) => {
                          const isSelected = currentConfig.selectedCities.includes(key);
                          const isAvailable = available.includes(key);
                          const isBlocked = !isAvailable && !isSelected;

                          return (
                            <label
                              key={key}
                              className={`flex items-center justify-between p-2 rounded-lg border text-sm ${
                                isSelected
                                  ? "bg-green-50 border-green-200"
                                  : isBlocked
                                  ? "bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed"
                                  : "bg-white border-slate-200 hover:bg-slate-50 cursor-pointer"
                              }`}
                            >
                              <span className="truncate">{city}</span>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isBlocked}
                                onChange={() => toggleCity(key)}
                                className="h-4 w-4 text-green-600"
                              />
                            </label>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-6 p-4 bg-blue-50 rounded-xl">
              <h4 className="font-semibold text-blue-900">Summary</h4>
              <p className="text-sm text-blue-800">
                {currentConfig.selectedCities.length} cities in {currentConfig.selectedStates.length} state(s)
              </p>
            </div>

            {/* Footer Actions */}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep("select-zones")}
                className="px-4 py-2 text-slate-700 hover:text-slate-900"
              >
                ← Back to Selection
              </button>

              <div className="flex gap-2">
                <button
                  onClick={saveCurrentZone}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                >
                  <CheckCircle className="h-5 w-5" /> Save & Next
                </button>

                {zoneConfigs.every((z) => z.isComplete || z === currentConfig) && (
                  <button
                    onClick={finalizeConfiguration}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Complete Configuration
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- STEP 3: PRICE MATRIX ---------- */
  if (currentStep === "price-matrix") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => setCurrentStep("configure-zones")}
              className="inline-flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Configuration
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 md:p-8">
            <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Zone Price Matrix</h1>
            <p className="text-slate-600 mb-6">Enter the price for shipping between zones.</p>

            {/* Price Matrix Table */}
            <div className="overflow-auto max-h-[600px] border border-slate-300 rounded-lg">
              <table className="w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="sticky left-0 z-20 p-2 bg-slate-100 font-bold text-slate-800 text-sm border border-slate-300">
                      FROM/TO
                    </th>
                    {validZones.map((zone) => (
                      <th
                        key={zone.zoneCode}
                        className="p-2 bg-slate-50 font-semibold text-slate-700 text-xs border border-slate-300 min-w-[80px]"
                      >
                        {zone.zoneCode}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validZones.map((fromZone) => (
                    <tr key={fromZone.zoneCode}>
                      <td className="sticky left-0 z-10 p-2 bg-slate-50 font-semibold text-slate-700 text-xs border border-slate-300">
                        {fromZone.zoneCode}
                      </td>
                      {validZones.map((toZone) => (
                        <td key={toZone.zoneCode} className="p-1 border border-slate-300">
                          <DecimalInput
                            value={getPrice(fromZone.zoneCode, toZone.zoneCode)}
                            onChange={(value) => updatePrice(fromZone.zoneCode, toZone.zoneCode, value)}
                            placeholder="0.00"
                            className="w-full px-2 py-1 border border-slate-200 rounded text-center text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            max={999}
                            maxDecimals={2}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="mt-6 p-4 bg-blue-50 rounded-xl">
              <h4 className="font-semibold text-blue-900">Matrix Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2 text-sm">
                <div>
                  <span className="text-blue-700">Zones:</span>
                  <span className="ml-2 font-semibold">{validZones.length}</span>
                </div>
                <div>
                  <span className="text-blue-700">Total Routes:</span>
                  <span className="ml-2 font-semibold">{validZones.length * validZones.length}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={savePriceMatrixAndReturn}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                <CheckCircle className="h-5 w-5" />
                Save & Return to Add Vendor
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default ZonePriceMatrix;