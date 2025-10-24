// src/pages/ZonePriceMatrix.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  MapPin,
  Sparkles,
  X,
  Pencil,
  Info,
} from "lucide-react";
import DecimalInput from "../components/DecimalInput";

/* =========================================================
   Types
   ======================================================= */
type PincodeEntry = {
  pincode: string;
  state: string;
  city: string;
  zone?: string; // e.g., "N1", "S2", "NE1" (used only to infer Region)
};

type RegionGroup = "North" | "South" | "East" | "West" | "Northeast" | "Central";

type ZoneConfig = {
  zoneCode: string; // e.g., "N1"
  zoneName: string;
  region: RegionGroup;
  /** Derived — always recomputed from selectedCities. */
  selectedStates: string[];
  /** City keys stored as `${city}||${state}` */
  selectedCities: string[];
  isComplete: boolean;
};

type ActiveStateByZone = Record<string, string | null>;

type PriceMatrixEntry = {
  fromZone: string;
  toZone: string;
  price: number | null;
};

/** Tracks leftover (yellow) cities per region with their SOURCE sub-zone(s). */
type YellowPool = Record<
  RegionGroup,
  Record<
    string, // cityKey
    { sources: string[] } // list of zone codes that freed this city (e.g., ["N1"])
  >
>;

/* =========================================================
   Constants
   ======================================================= */
const MAX_ZONES = 28;
const CACHE_KEY = "zonePriceMatrix_v6_state_checkbox_selects_all";

// ZONE ORDERING ENFORCEMENT - Canonical order for consistent zone display
// Zones are grouped by region to keep related zones together
const ZONE_ORDER = [
  'N1', 'N2', 'N3', 'N4', 'N5', 'N6', // North zones
  'W1', 'W2', 'W3', 'W4', // West zones  
  'C1', 'C2', 'C3', 'C4', // Centre zones
  'S1', 'S2', 'S3', 'S4', 'S5', 'S6', // South zones
  'E1', 'E2', 'E3', 'E4', // East zones
  'NE1', 'NE2', 'NE3', 'NE4' // North-East zones
];

// BULLETPROOF ZONE ORDERING - Function to sort zones by canonical order
const sortZonesByRegionGroups = (zones: string[]): string[] => {
  return zones.sort((a, b) => {
    // Use the ZONE_ORDER constant for strict canonical ordering
    const indexA = ZONE_ORDER.indexOf(a);
    const indexB = ZONE_ORDER.indexOf(b);
    
    // If both zones are in ZONE_ORDER, use their positions
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    
    // Fallback to region-based sorting for any zones not in ZONE_ORDER
    const regionA = codeToRegion(a);
    const regionB = codeToRegion(b);
    
    const regionOrder = ['North', 'West', 'Central', 'South', 'East', 'Northeast'];
    const regionIndexA = regionOrder.indexOf(regionA);
    const regionIndexB = regionOrder.indexOf(regionB);
    
    if (regionIndexA !== regionIndexB) {
      return regionIndexA - regionIndexB;
    }
    
    // Within same region, sort by zone number
    const zoneNumberA = parseInt(a.replace(/\D/g, ''));
    const zoneNumberB = parseInt(b.replace(/\D/g, ''));
    return zoneNumberA - zoneNumberB;
  });
};

const regionGroups: Record<RegionGroup, string[]> = {
  North: ["N1", "N2", "N3", "N4", "N5", "N6"],
  South: ["S1", "S2", "S3", "S4", "S5", "S6"],
  East: ["E1", "E2", "E3", "E4"],
  West: ["W1", "W2", "W3", "W4"],
  Northeast: ["NE1", "NE2", "NE3", "NE4"],
  Central: ["C1", "C2", "C3", "C4"],
};

/* =========================================================
   Helpers
   ======================================================= */
const csKey = (city: string, state: string) => `${city}||${state}`;
const parseCsKey = (key: string) => {
  const i = key.lastIndexOf("||");
  return { city: key.slice(0, i), state: key.slice(i + 2) };
};

// ZONE ORDERING ENFORCEMENT - Function to maintain zone order
const sortZonesByOrder = (zones: string[]): string[] => {
  return zones.sort((a, b) => {
    return ZONE_ORDER.indexOf(a) - ZONE_ORDER.indexOf(b);
  });
};

// BULLETPROOF ZONE COMPLETION CHECK - Enhanced validation
const isZoneComplete = (zone: ZoneConfig): boolean => {
  if (!zone) return false;
  
  // Check if zone has selected cities
  if (!zone.selectedCities || zone.selectedCities.length === 0) return false;
  
  // Check if zone is marked as complete
  return zone.isComplete;
};

// ENHANCED ZONE VALIDATION - Check if zone has sufficient data
const isZoneValid = (zone: ZoneConfig): boolean => {
  if (!zone) return false;
  
  // Must have at least one city selected
  if (!zone.selectedCities || zone.selectedCities.length === 0) return false;
  
  // Must have at least one state
  if (!zone.selectedStates || zone.selectedStates.length === 0) return false;
  
  return true;
};

// BULLETPROOF TAB NAVIGATION LOCK - Enhanced zone navigation validation
const canNavigateToZone = (targetIndex: number, currentIndex: number, zones: ZoneConfig[]): boolean => {
  // Can always go back to previous zones
  if (targetIndex <= currentIndex) return true;
  
  // Can only go to next zone if current is complete and valid
  if (targetIndex === currentIndex + 1) {
    const currentZone = zones[currentIndex];
    return isZoneComplete(currentZone) && isZoneValid(currentZone);
  }
  
  // Cannot skip ahead - must complete zones in sequence
  return false;
};

// MODERN STATE STATUS INDICATOR - Get status icon for state
const getStateStatus = (stateName: string, selectedCities: string[], allCitiesInState: string[]) => {
  const selectedCitiesInState = selectedCities.filter(city => 
    allCitiesInState.includes(city)
  );
  
  if (selectedCitiesInState.length === 0) {
    return { icon: '○', color: 'text-slate-400', label: 'Not selected' };
  } else if (selectedCitiesInState.length === allCitiesInState.length) {
    return { icon: '●', color: 'text-green-600', label: 'Fully selected' };
  } else {
    return { icon: '◐', color: 'text-blue-600', label: 'Partially selected' };
  }
};

// SEQUENTIAL ZONE SELECTION - Get next expected zone in sequence
const getNextExpectedZone = (region: RegionGroup, selectedZones: string[]): string | null => {
  const currentRegionSelected = selectedZones.filter(zone => regionGroups[region].includes(zone));
  const currentRegionOrdered = sortZonesByRegionGroups(currentRegionSelected);
  return regionGroups[region].find(zone => !currentRegionOrdered.includes(zone)) || null;
};

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

const emptyYellowPool = (): YellowPool => ({
  North: {},
  South: {},
  East: {},
  West: {},
  Northeast: {},
  Central: {},
});

const addToYellow = (
  pool: YellowPool,
  region: RegionGroup,
  cityKey: string,
  sourceZone: string
): YellowPool => {
  const next: YellowPool = { ...pool, [region]: { ...pool[region] } };
  const existing = next[region][cityKey];
  if (!existing) next[region][cityKey] = { sources: [sourceZone] };
  else if (!existing.sources.includes(sourceZone))
    next[region][cityKey] = { sources: [...existing.sources, sourceZone] };
  return next;
};

const removeFromYellow = (
  pool: YellowPool,
  region: RegionGroup,
  cityKey: string
): YellowPool => {
  const next: YellowPool = { ...pool, [region]: { ...pool[region] } };
  if (next[region][cityKey]) delete next[region][cityKey];
  return next;
};

/** Derive unique state list from selectedCities for a given config. */
const deriveStatesFromCities = (selectedCities: string[]): string[] => {
  const set = new Set<string>();
  selectedCities.forEach((k) => set.add(parseCsKey(k).state));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};

/** Utility to immutably update a specific zone and re-derive states from its cities. */
const updateOneZone = (
  zones: ZoneConfig[],
  index: number,
  mutator: (z: ZoneConfig) => ZoneConfig
): ZoneConfig[] => {
  const next = [...zones];
  const mutated = mutator({ ...next[index] });
  mutated.selectedStates = deriveStatesFromCities(mutated.selectedCities);
  next[index] = mutated;
  return next;
};

/* =========================================================
   Component
   ======================================================= */
const ZonePriceMatrix: React.FC = () => {
  // dataset
  const [pincodeData, setPincodeData] = useState<PincodeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // steps
  const [currentStep, setCurrentStep] =
    useState<"select-zones" | "configure-zones" | "price-matrix">("select-zones");

  // step 1
  const [selectedZoneCodes, setSelectedZoneCodes] = useState<string[]>([]);

  // progressive visibility per region
  const [visibleZonesPerRegion, setVisibleZonesPerRegion] = useState<Record<RegionGroup, number>>({
    North: 4,
    South: 4,
    East: 2,
    West: 2,
    Northeast: 2,
    Central: 2,
  });

  // step 2
  const [zoneConfigs, setZoneConfigs] = useState<ZoneConfig[]>([]);
  const [currentZoneIndex, setCurrentZoneIndex] = useState(0);

  /** Yellow pool per region with sources */
  const [yellowByRegion, setYellowByRegion] = useState<YellowPool>(emptyYellowPool());

  // UI: right pane focuses on one state for each zone
  const [activeStateByZone, setActiveStateByZone] = useState<ActiveStateByZone>({});

  // region switching housekeeping
  const prevRegionRef = useRef<RegionGroup | null>(null);

  // step 3: price matrix
  const [priceMatrix, setPriceMatrix] = useState<PriceMatrixEntry[]>([]);

  /* -------------------- Load dataset -------------------- */
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
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  /* -------------------- Cache (load) -------------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed) return;

      setSelectedZoneCodes(parsed.selectedZoneCodes || []);
      // Re-derive states on load and ensure canonical ordering
      const loadedZones: ZoneConfig[] = (parsed.zoneConfigs || []).map((z: ZoneConfig) => ({
        ...z,
        selectedStates: deriveStatesFromCities(z.selectedCities || []),
      }));
      
      // BULLETPROOF: Sort loaded zones by canonical order
      const sortedLoadedZones = loadedZones.sort((a, b) => {
        const indexA = ZONE_ORDER.indexOf(a.zoneCode);
        const indexB = ZONE_ORDER.indexOf(b.zoneCode);
        return indexA - indexB;
      });
      
      setZoneConfigs(sortedLoadedZones);
      setCurrentStep(parsed.currentStep || "select-zones");
      setCurrentZoneIndex(parsed.currentZoneIndex || 0);
      parsed.yellowByRegion && setYellowByRegion(parsed.yellowByRegion);
      parsed.activeStateByZone && setActiveStateByZone(parsed.activeStateByZone);
      parsed.priceMatrix && setPriceMatrix(parsed.priceMatrix);
    } catch {}
  }, []);

  /* -------------------- Cache (save) -------------------- */
  useEffect(() => {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          selectedZoneCodes,
          zoneConfigs,
          currentStep,
          currentZoneIndex,
          yellowByRegion,
          activeStateByZone,
          priceMatrix,
        })
      );
    } catch {}
  }, [
    selectedZoneCodes,
    zoneConfigs,
    currentStep,
    currentZoneIndex,
    yellowByRegion,
    activeStateByZone,
    priceMatrix,
  ]);

  /* -------------------- Derived indices -------------------- */

  // region -> state -> Set(city)
  const byStateByRegion = useMemo(() => {
    const map = new Map<RegionGroup, Map<string, Set<string>>>();
    (["North", "South", "East", "West", "Northeast", "Central"] as RegionGroup[]).forEach(
      (r) => map.set(r, new Map())
    );
    for (const e of pincodeData) {
      const region = codeToRegion(e.zone || "");
      const stateMap = map.get(region)!;
      if (!stateMap.has(e.state)) stateMap.set(e.state, new Set());
      stateMap.get(e.state)!.add(e.city);
    }
    return map;
  }, [pincodeData]);

  /** total cities in a region (unique city||state keys) */
  const totalCitiesInRegion = (region: RegionGroup): number => {
    const stateMap = byStateByRegion.get(region);
    if (!stateMap) return 0;
    let sum = 0;
    stateMap.forEach((set) => (sum += set.size));
    return sum;
  };

  const currentConfig = zoneConfigs[currentZoneIndex];
  const currentRegion = currentConfig?.region;
  const currentZoneCode = currentConfig?.zoneCode || "";

  /** Yellow set & lookup for CURRENT region only */
  const yellowSetForRegion = useMemo(() => {
    if (!currentRegion) return new Set<string>();
    return new Set(Object.keys(yellowByRegion[currentRegion] || {}));
  }, [currentRegion, yellowByRegion]);

  const yellowMetaFor = (key: string) =>
    currentRegion ? yellowByRegion[currentRegion][key] : undefined;

  const getAllCityKeysForStateInRegion = (state: string, region: RegionGroup): string[] => {
    const stateMap = byStateByRegion.get(region);
    if (!stateMap) return [];
    const cities = stateMap.get(state);
    if (!cities || cities.size === 0) return [];
    return Array.from(cities).map((c) => csKey(c, state));
  };

  /** union set of cityKeys selected across all zones in a region (for full-state + exhaustion) */
  const selectedCitySetAcrossRegion = (region: RegionGroup): Set<string> => {
    const set = new Set<string>();
    zoneConfigs.forEach((z) => {
      if (z.region !== region) return;
      z.selectedCities.forEach((k) => set.add(k));
    });
    return set;
  };

  // cities available to pick (not already selected in OTHER zones)
  const getAvailableCityKeysForState = (state: string): string[] => {
    if (!currentRegion) return [];
    const all = getAllCityKeysForStateInRegion(state, currentRegion);

    // cities already taken by others (other zones)
    const usedElsewhere = new Set<string>();
    zoneConfigs.forEach((z, idx) => {
      if (idx === currentZoneIndex) return;
      z.selectedCities.forEach((k) => usedElsewhere.add(k));
    });

    return all.filter((k) => !usedElsewhere.has(k));
  };

  /** All states in region (raw) */
  const allStatesForCurrentRegion = useMemo(() => {
    if (!currentRegion) return [];
    const stateMap = byStateByRegion.get(currentRegion);
    if (!stateMap) return [];
    return Array.from(stateMap.keys()).sort((a, b) => a.localeCompare(b));
  }, [byStateByRegion, currentRegion]);

  /** Filtered state list for the CURRENT zone per rules */
  const availableStatesForCurrent = useMemo(() => {
    if (!currentRegion || !currentConfig) return [];

    const stateMap = byStateByRegion.get(currentRegion);
    if (!stateMap) return [];

    const unionSelectedAcrossRegion = selectedCitySetAcrossRegion(currentRegion);

    const result: string[] = [];
    for (const state of allStatesForCurrentRegion) {
      const allKeys = getAllCityKeysForStateInRegion(state, currentRegion);
      const selectedInThisZone = currentConfig.selectedCities.filter(
        (k) => parseCsKey(k).state === state
      ).length;

      // what's still not used by any zone
      const availableNotUsed = allKeys.filter((k) => !unionSelectedAcrossRegion.has(k));

      const yellowCount = allKeys.filter((k) => yellowSetForRegion.has(k)).length;
      const nonYellowRemain = availableNotUsed.filter((k) => !yellowSetForRegion.has(k)).length;

      const fullyAssignedAcrossRegion = availableNotUsed.length === 0 && yellowCount === 0;

      // CROSS-REGION STATE FILTERING - Check if state is fully selected in ANY other region
      const isStateFullySelectedInOtherRegions = zoneConfigs.some((zone) => {
        if (zone.region === currentRegion) return false; // Skip same region
        
        const selectedInThatZone = zone.selectedCities.filter(
          (k) => parseCsKey(k).state === state
        ).length;
        
        // Get all cities for this state in that region
        const allKeysInThatRegion = getAllCityKeysForStateInRegion(state, zone.region);
        
        return selectedInThatZone === allKeysInThatRegion.length && allKeysInThatRegion.length > 0;
      });

      // BULLETPROOF STATE REMOVAL - Check if state is fully selected in ANY previous zone in same region
      const isStateFullySelectedInPreviousZones = zoneConfigs.some((zone, index) => {
        if (index >= currentZoneIndex) return false; // Only check previous zones
        if (zone.region !== currentRegion) return false; // Only check same region
        
        const selectedInThatZone = zone.selectedCities.filter(
          (k) => parseCsKey(k).state === state
        ).length;
        
        return selectedInThatZone === allKeys.length && allKeys.length > 0;
      });

      // Check if state is fully selected in current zone
      const isStateFullySelectedInCurrentZone = selectedInThisZone === allKeys.length && allKeys.length > 0;
      
      const shouldShow =
        selectedInThisZone > 0 || // allow edit if picked here
        yellowCount > 0 || // leftovers exist
        nonYellowRemain > 0; // fresh cities exist

      // BULLETPROOF STATE REMOVAL LOGIC:
      // 1. If state is fully selected in other regions, hide it completely
      // 2. If state is fully selected in previous zones of same region, hide it from current zone
      // 3. If state is fully selected in current zone, keep it for editing
      // 4. If state has partial selection or leftovers, show it
      if (isStateFullySelectedInOtherRegions) {
        // Hide completely - it's fully selected in another region
        continue;
      } else if (isStateFullySelectedInPreviousZones) {
        // Hide from current zone - it's already fully selected in a previous zone of same region
        continue;
      } else if (isStateFullySelectedInCurrentZone || (shouldShow && !fullyAssignedAcrossRegion)) {
        // Show if fully selected in current zone (for editing) or has available cities
        result.push(state);
      }
    }

    return result.sort((a, b) => a.localeCompare(b));
  }, [
    currentRegion,
    currentConfig,
    byStateByRegion,
    allStatesForCurrentRegion,
    yellowSetForRegion,
    zoneConfigs,
    currentZoneIndex,
  ]);

  /* -------------------- Active state handling -------------------- */
  const ensureActiveState = (zoneCode: string, preferred?: string | null) => {
    setActiveStateByZone((prev) => {
      if (preferred !== undefined) return { ...prev, [zoneCode]: preferred };
      if (prev[zoneCode] === undefined) return { ...prev, [zoneCode]: null };
      return prev;
    });
  };

  useEffect(() => {
    if (!currentConfig) return;
    const act = activeStateByZone[currentZoneCode];
    if (!act) {
      const pick =
        currentConfig.selectedStates[0] ||
        availableStatesForCurrent.find((s) => {
          const allKeys = getAllCityKeysForStateInRegion(s, currentConfig.region);
          const selectedInState = currentConfig.selectedCities.filter(
            (k) => parseCsKey(k).state === s
          ).length;
          const yellowCount = allKeys.filter((k) => yellowSetForRegion.has(k)).length;
          return yellowCount > 0 || (selectedInState > 0 && selectedInState < allKeys.length);
        }) ||
        availableStatesForCurrent[0] ||
        null;
      setActiveStateByZone((prev) => ({ ...prev, [currentZoneCode]: pick ?? null }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentZoneIndex, currentConfig, availableStatesForCurrent.length]);

  /** Auto-clear finished region yellow pool when switching regions and the previous region’s selected zones are all complete. */
  useEffect(() => {
    if (!currentConfig) return;
    const thisRegion = currentConfig.region;
    const prevRegion = prevRegionRef.current;

    if (prevRegion && prevRegion !== thisRegion) {
      const prevRegionZoneCodes = regionGroups[prevRegion].filter((zc) =>
        selectedZoneCodes.includes(zc)
      );
      const allPrevComplete =
        prevRegionZoneCodes.length === 0 ||
        zoneConfigs
          .filter((z) => z.region === prevRegion && prevRegionZoneCodes.includes(z.zoneCode))
          .every((z) => z.isComplete);

      if (allPrevComplete) {
        setYellowByRegion((prev) => ({ ...prev, [prevRegion]: {} }));
      }
    }
    prevRegionRef.current = thisRegion;
  }, [currentZoneIndex, currentConfig, selectedZoneCodes, zoneConfigs]);

  const setActiveState = (state: string | null) => {
    setActiveStateByZone((prev) => ({ ...prev, [currentZoneCode]: state }));
  };

  const getActiveState = (): string | null => {
    const s = activeStateByZone[currentZoneCode];
    return s ?? null;
  };

  /* =========================================================
     Step 1: Zone selection
     ======================================================= */
  const addZoneToRegion = (region: RegionGroup) => {
    setVisibleZonesPerRegion((prev) => {
      const currentVisible = prev[region];
      const maxZones = regionGroups[region].length;
      if (currentVisible < maxZones) {
        return { ...prev, [region]: currentVisible + 1 };
      }
      return prev;
    });
  };

  const toggleZoneSelection = (code: string) => {
    setSelectedZoneCodes((prev) => {
      // BULLETPROOF SEQUENTIAL ZONE SELECTION - Enforce strict ordering
      const region = codeToRegion(code);
      const nextExpectedZone = getNextExpectedZone(region, prev);
      
      // If trying to select a zone that's not the next in sequence, show warning
      if (!prev.includes(code) && nextExpectedZone && code !== nextExpectedZone) {
        alert(`⚠ Please select ${nextExpectedZone} first before selecting ${code}`);
        return prev;
      }

      // Additional validation: Check if any previous zones in the same region are missing
      const regionZones = regionGroups[region];
      const currentRegionSelected = prev.filter(zone => regionZones.includes(zone));
      const currentRegionOrdered = sortZonesByRegionGroups(currentRegionSelected);
      
      // Find the first missing zone in the sequence
      const firstMissingZone = regionZones.find(zone => !currentRegionOrdered.includes(zone));
      
      // If trying to select a zone that's not the first missing one, prevent it
      if (!prev.includes(code) && firstMissingZone && code !== firstMissingZone) {
        alert(`⚠ Please select ${firstMissingZone} first before selecting ${code}`);
        return prev;
      }

      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      if (next.length > MAX_ZONES) return prev;

      // REGION GROUPING - Sort zones by region groups to keep related zones together
      const sortedNext = sortZonesByRegionGroups(next);

      setZoneConfigs((old) => {
        const keep = old.filter((z) => sortedNext.includes(z.zoneCode));
        const missing = sortedNext
          .filter((c) => !keep.some((k) => k.zoneCode === c))
          .map(
            (c) =>
              ({
                zoneCode: c,
                zoneName: c,
                region: codeToRegion(c),
                selectedStates: [],
                selectedCities: [],
                isComplete: false,
              }) as ZoneConfig
          );
        
        // BULLETPROOF: Ensure zoneConfigs are always in canonical order
        const allZones = [...keep, ...missing];
        return allZones.sort((a, b) => {
          const indexA = ZONE_ORDER.indexOf(a.zoneCode);
          const indexB = ZONE_ORDER.indexOf(b.zoneCode);
          return indexA - indexB;
        });
      });

      ensureActiveState(code, null);
      return sortedNext;
    });
  };

  const toggleRegionSelection = (region: RegionGroup) => {
    const visibleZones = regionGroups[region].slice(0, visibleZonesPerRegion[region]);
    setSelectedZoneCodes((prev) => {
      const allSelected = visibleZones.every((z) => prev.includes(z));
      
      if (allSelected) {
        // If all are selected, deselect them
        const next = prev.filter((z) => !visibleZones.includes(z));
        const sortedNext = sortZonesByRegionGroups(next);
        
        setZoneConfigs((old) => {
          const keep = old.filter((z) => sortedNext.includes(z.zoneCode));
          return keep;
        });
        
        return sortedNext;
      } else {
        // SEQUENTIAL ZONE SELECTION - Only select zones in proper order
        const nextExpectedZone = getNextExpectedZone(region, prev);
        
        if (nextExpectedZone && visibleZones.includes(nextExpectedZone)) {
          // Select only the next zone in sequence
          const next = [...prev, nextExpectedZone].slice(0, MAX_ZONES);
          const sortedNext = sortZonesByRegionGroups(next);
          
          setZoneConfigs((old) => {
            const keep = old.filter((z) => sortedNext.includes(z.zoneCode));
            const missing = sortedNext
              .filter((c) => !keep.some((k) => k.zoneCode === c))
              .map(
                (c) =>
                  ({
                    zoneCode: c,
                    zoneName: c,
                    region: codeToRegion(c),
                    selectedStates: [],
                    selectedCities: [],
                    isComplete: false,
                  }) as ZoneConfig
              );
            
            // BULLETPROOF: Ensure zoneConfigs are always in canonical order
            const allZones = [...keep, ...missing];
            return allZones.sort((a, b) => {
              const indexA = ZONE_ORDER.indexOf(a.zoneCode);
              const indexB = ZONE_ORDER.indexOf(b.zoneCode);
              return indexA - indexB;
            });
          });
          
          ensureActiveState(nextExpectedZone, null);
          return sortedNext;
        } else {
          // If no next zone available or not in visible zones, show message
          alert(`⚠ Please select zones in order: ${regionGroups[region].join(' → ')}`);
          return prev;
        }
      }
    });
  };

  const proceedToConfiguration = () => {
    if (selectedZoneCodes.length === 0) {
      alert("Please select at least one zone.");
      return;
    }
    setCurrentStep("configure-zones");
    setCurrentZoneIndex(0);
  };

  /* =========================================================
     Step 2: Zone configuration
     ======================================================= */

  // Clicking the state row sets focus
  const onStateRowClick = (state: string) => setActiveState(state);

  /** Select ALL including leftovers (yellow) for a state (by name). */
  const selectAllIncludingYellowForState = (state: string) => {
    if (!currentRegion || !currentConfig) return;

    const available = new Set(getAvailableCityKeysForState(state)); // includes yellow if not used elsewhere
    const toAdd = Array.from(available);
    if (toAdd.length === 0) return;

    setZoneConfigs((prev) =>
      updateOneZone(prev, currentZoneIndex, (z) => ({
        ...z,
        selectedCities: Array.from(new Set([...z.selectedCities, ...toAdd])),
      }))
    );

    // remove those from yellow pool
    setYellowByRegion((prev) => {
      let updated = { ...prev };
      toAdd.forEach((k) => (updated = removeFromYellow(updated, currentRegion, k)));
      return updated;
    });

    setActiveState(state);
  };

  /** Select ALL AVAILABLE (non-yellow) within the active state. */
  const selectAllAvailableInActiveState = () => {
    const state = getActiveState();
    if (!state || !currentRegion || !currentConfig) return;

    const available = new Set(getAvailableCityKeysForState(state));
    const nonYellow = Array.from(available).filter((k) => !yellowSetForRegion.has(k));

    if (nonYellow.length === 0) return;

    setZoneConfigs((prev) =>
      updateOneZone(prev, currentZoneIndex, (z) => ({
        ...z,
        selectedCities: Array.from(new Set([...z.selectedCities, ...nonYellow])),
      }))
    );
  };

  /** Select ALL including leftovers (yellow) for the active state. */
  const selectAllIncludingYellowInActiveState = () => {
    const state = getActiveState();
    if (!state) return;
    selectAllIncludingYellowForState(state);
  };

  /** Clear all selected in the active state -> mark those as yellow (explicit deselects). */
  const clearAllCitiesInActiveState = () => {
    const state = getActiveState();
    if (!state || !currentRegion || !currentConfig) return;

    const keys = getAllCityKeysForStateInRegion(state, currentRegion);
    const wasOn = new Set(currentConfig.selectedCities.filter((k) => keys.includes(k)));
    if (wasOn.size === 0) return;

    setZoneConfigs((prev) =>
      updateOneZone(prev, currentZoneIndex, (z) => ({
        ...z,
        selectedCities: z.selectedCities.filter((k) => !keys.includes(k)),
      }))
    );

    // mark the ones that were ON as yellow (explicit deselects from this zone)
    setYellowByRegion((prevPool) => {
      let updated = { ...prevPool };
      wasOn.forEach((k) => {
        updated = addToYellow(updated, currentRegion, k, currentZoneCode);
      });
      return updated;
    });
  };

  /** toggle an individual city checkbox */
  const toggleCity = (cityKey: string) => {
    if (!currentConfig || !currentRegion) return;

    const wasOn = currentConfig.selectedCities.includes(cityKey);

    setZoneConfigs((prev) =>
      updateOneZone(prev, currentZoneIndex, (z) => {
        const set = new Set(z.selectedCities);
        if (set.has(cityKey)) set.delete(cityKey);
        else set.add(cityKey);
        return { ...z, selectedCities: Array.from(set) };
      })
    );

    setYellowByRegion((prevPool) => {
      let updated = { ...prevPool };
      if (wasOn) {
        updated = addToYellow(updated, currentRegion, cityKey, currentZoneCode);
      } else {
        updated = removeFromYellow(updated, currentRegion, cityKey);
      }
      return updated;
    });
  };

  /** Compute badges & flags for a given state in UI */
  const computeStateStats = (state: string) => {
    if (!currentRegion || !currentConfig) {
      return {
        total: 0,
        selectedHere: 0,
        yellowCount: 0,
        nonYellowRemaining: 0,
        totalAvailableForThisZone: 0,
      };
    }
    const allKeys = getAllCityKeysForStateInRegion(state, currentRegion);

    // selected in *this* zone
    const selectedHere = currentConfig.selectedCities.filter(
      (k) => parseCsKey(k).state === state
    ).length;

    // keys not used in other zones (includes our selected ones)
    const availableForThisZone = new Set(getAvailableCityKeysForState(state));
    const totalAvailableForThisZone = availableForThisZone.size;

    const yellowCount = allKeys.filter((k) => yellowSetForRegion.has(k)).length;
    const nonYellowRemaining = Array.from(availableForThisZone).filter(
      (k) => !yellowSetForRegion.has(k)
    ).length;

    return {
      total: allKeys.length,
      selectedHere,
      yellowCount,
      nonYellowRemaining,
      totalAvailableForThisZone,
    };
  };

  /** Region exhaustion detection per plan */
  const isRegionExhaustedAfterSave = (region: RegionGroup): boolean => {
    const total = totalCitiesInRegion(region);
    const union = selectedCitySetAcrossRegion(region).size; // includes current zone picks
    return union >= total;
  };

  /** BULLETPROOF ZONE SAVE - Enhanced validation and error handling */
  const saveCurrentZone = () => {
    if (!currentConfig) return;

    // Check if no cities are available for selection in current zone
    const availableStates = availableStatesForCurrent;
    const hasAvailableCities = availableStates.some(state => {
      const allKeys = getAllCityKeysForStateInRegion(state, currentConfig.region);
      const availableNotUsed = allKeys.filter((k) => {
        const unionSelectedAcrossRegion = selectedCitySetAcrossRegion(currentConfig.region);
        return !unionSelectedAcrossRegion.has(k);
      });
      return availableNotUsed.length > 0;
    });

    // Enhanced validation checks
    if (currentConfig.selectedCities.length === 0) {
      // Check if no cities are available for selection
      if (!hasAvailableCities) {
        const confirmed = window.confirm(
          `⚠️ No cities are available for selection in ${currentConfig.zoneName}.\n\n` +
          `All cities in this region have been selected in previous zones.\n\n` +
          `This subzone will be DELETED and you can proceed to the next zone.\n\n` +
          `Do you want to delete this subzone and continue?`
        );
        
        if (confirmed) {
          // DELETE the current zone completely
          setZoneConfigs((prev) => {
            const updatedZones = prev.filter((_, index) => index !== currentZoneIndex);
            return updatedZones;
          });
          
          // Remove from selectedZoneCodes
          setSelectedZoneCodes((prev) => {
            return prev.filter(code => code !== currentConfig.zoneCode);
          });
          
          // Navigate to next available zone
          setZoneConfigs((prev) => {
            if (prev.length === 0) {
              // No more zones, go to finalization
              setCurrentStep("price-matrix");
              return prev;
            }
            
            // Find next incomplete zone
            const nextIndex = prev.findIndex((z, i) => !z.isComplete);
            if (nextIndex !== -1) {
              setCurrentZoneIndex(nextIndex);
            } else {
              // All zones complete, go to price matrix
              setCurrentStep("price-matrix");
            }
            return prev;
          });
        }
        return;
      } else {
        alert("❌ Cannot save empty zone. Please select at least one city.");
        return;
      }
    }

    if (currentConfig.selectedStates.length === 0) {
      alert("❌ Cannot save zone without states. Please select at least one state.");
      return;
    }

    // Validate that zone has meaningful data
    if (!isZoneValid(currentConfig)) {
      alert("❌ Zone configuration is incomplete. Please ensure all required data is selected.");
      return;
    }

    // mark this zone complete
    let nextZones: ZoneConfig[] = [];
    setZoneConfigs((prev) => {
      nextZones = prev.map((z, i) => (i === currentZoneIndex ? { ...z, isComplete: true } : z));
      return nextZones;
    });

    // Region exhaustion handling
    const region = currentConfig.region;
    if (isRegionExhaustedAfterSave(region)) {
      const remainingZoneCodes = zoneConfigs
        .filter((z, i) => z.region === region && i !== currentZoneIndex && !z.isComplete)
        .map((z) => z.zoneCode);

      if (remainingZoneCodes.length > 0) {
        const confirmed = window.confirm(
          `You have selected all available cities in the ${region} region.\n` +
            `Saving this will remove these unused sub-zones: ${remainingZoneCodes.join(", ")}.\n\n` +
            `Continue?`
        );
        if (!confirmed) {
          setZoneConfigs((prev) =>
            prev.map((z, i) => (i === currentZoneIndex ? { ...z, isComplete: false } : z))
          );
          return;
        }

        setZoneConfigs((prev) =>
          prev.filter(
            (z, i) => z.region !== region || i === currentZoneIndex || z.isComplete
          )
        );
        setSelectedZoneCodes((prev) => prev.filter((code) => !remainingZoneCodes.includes(code)));
        setYellowByRegion((prev) => ({ ...prev, [region]: {} }));
      }
    }

    // navigate to next incomplete zone
    setZoneConfigs((prev) => {
      const after = prev.findIndex((z, i) => i > currentZoneIndex && !z.isComplete);
      if (after !== -1) {
        setCurrentZoneIndex(after);
        return prev;
      }
      const before = prev.findIndex((z, i) => i < currentZoneIndex && !z.isComplete);
      if (before !== -1) {
        setCurrentZoneIndex(before);
        return prev;
      }
      return prev;
    });
  };

  const markZoneEditable = (index: number) => {
    setZoneConfigs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], isComplete: false };
      return next;
    });
    setCurrentZoneIndex(index);
  };

  const finalizeAll = () => {
    const valid = zoneConfigs.filter((z) => z.selectedCities.length > 0);
    if (valid.length === 0) {
      alert("Please configure at least one zone with cities.");
      return;
    }
    localStorage.setItem("zoneMatrixData", JSON.stringify(valid));

    // Initialize price matrix for all selected zones
    const matrix: PriceMatrixEntry[] = [];
    valid.forEach((fromZone) => {
      valid.forEach((toZone) => {
        matrix.push({ fromZone: fromZone.zoneCode, toZone: toZone.zoneCode, price: null });
      });
    });
    setPriceMatrix(matrix);
    setCurrentStep("price-matrix");
  };

  const completedZones = zoneConfigs.filter((z) => z.isComplete).length;
  const progress =
    zoneConfigs.length === 0 ? 0 : (completedZones / zoneConfigs.length) * 100;

  /* =========================================================
     Step 3: Price Matrix
     ======================================================= */
  const validZones = zoneConfigs.filter((z) => z.selectedCities.length > 0);

  const updatePrice = (fromZone: string, toZone: string, price: number | null) => {
    setPriceMatrix((prev) =>
      prev.map((entry) =>
        entry.fromZone === fromZone && entry.toZone === toZone ? { ...entry, price } : entry
      )
    );
  };

  const getPrice = (fromZone: string, toZone: string): number | null => {
    const entry = priceMatrix.find((e) => e.fromZone === fromZone && e.toZone === toZone);
    return entry?.price ?? null;
  };

  const savePriceMatrix = () => {
    const matrixData = {
      zones: validZones,
      priceMatrix: priceMatrix,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem("zonePriceMatrixData", JSON.stringify(matrixData));
    alert("Price matrix saved successfully!");
  };

  const exportPriceMatrix = () => {
    const zones = validZones.map((z) => z.zoneCode);
    const csvData = [
      ["", ...zones],
      ...zones.map((fromZone) => [
        fromZone,
        ...zones.map((toZone) => {
          const price = getPrice(fromZone, toZone);
          return price?.toString() || "";
        }),
      ]),
    ];

    const csvContent = csvData.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zone_price_matrix.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const lines = text.split("\n").filter((line) => line.trim());
        if (lines.length < 2) {
          alert("Invalid CSV format. Please ensure the file has headers and data rows.");
          return;
        }

        const headerLine = lines[0].split(",");
        const uploadedZones = headerLine
          .slice(1)
          .map((zone) => zone.trim())
          .filter((zone) => zone);

        const currentZones = validZones.map((z) => z.zoneCode);
        const zonesMatch =
          uploadedZones.length === currentZones.length &&
          uploadedZones.every((zone) => currentZones.includes(zone));

        if (!zonesMatch) {
          alert(
            `Zone mismatch. Current zones: ${currentZones.join(", ")}. Uploaded zones: ${uploadedZones.join(", ")}`
          );
          return;
        }

        const newPriceMatrix: PriceMatrixEntry[] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(",");
          const fromZone = row[0].trim();
          if (!currentZones.includes(fromZone)) continue;

          for (let j = 1; j < row.length; j++) {
            const toZone = uploadedZones[j - 1];
            const priceValue = row[j].trim();
            if (priceValue && !isNaN(parseFloat(priceValue))) {
              const price = parseFloat(priceValue);
              if (price >= 0 && price <= 999) {
                newPriceMatrix.push({ fromZone, toZone, price });
              }
            }
          }
        }

        setPriceMatrix(newPriceMatrix);
        alert(`Successfully imported ${newPriceMatrix.length} price entries from CSV file.`);
      } catch (error) {
        alert("Error parsing CSV file. Please check the format and try again.");
        console.error("CSV parsing error:", error);
      }
    };

    reader.readAsText(file);
  };

  /* =========================================================
     Render
     ======================================================= */

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-slate-600">Loading Zone Price Matrix…</p>
        </div>
      </div>
    );
  }

  /* ---------- Step 1: Select Zones ---------- */
  if (currentStep === "select-zones") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => (window.location.href = "/addvendor")}
              className="inline-flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Add Vendor
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 md:p-8">
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">
              Select Your Zones
            </h1>
            <p className="mt-1 text-slate-600">
              Pick up to {MAX_ZONES} zones. Use region quick-selects.
            </p>

            <div className="mt-6 space-y-6">
              {(Object.keys(regionGroups) as RegionGroup[]).map((region) => {
                const allZones = regionGroups[region];
                const visibleZones = allZones.slice(0, visibleZonesPerRegion[region]);
                const allSelected = visibleZones.every((z) => selectedZoneCodes.includes(z));
                const someSelected =
                  !allSelected && visibleZones.some((z) => selectedZoneCodes.includes(z));
                const canAddMore = visibleZonesPerRegion[region] < allZones.length;

                return (
                  <div
                    key={region}
                    className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-6 w-6 text-blue-600" />
                        <h3 className="text-xl font-semibold text-slate-900">{region}</h3>
                      </div>
                      <button
                        onClick={() => toggleRegionSelection(region)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          allSelected
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : someSelected
                            ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                        title={allSelected ? "Deselect all zones in this region" : "Select next zone in sequence"}
                      >
                        {allSelected ? "Deselect All" : "Select Next"}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {visibleZones.map((code) => {
                        const selected = selectedZoneCodes.includes(code);
                        const disabled = !selected && selectedZoneCodes.length >= MAX_ZONES;
                        
                        // SEQUENTIAL ZONE SELECTION - Check if this is the next zone to select
                        const nextExpectedZone = getNextExpectedZone(region, selectedZoneCodes);
                        const isNextInSequence = code === nextExpectedZone && !selected;
                        
                        return (
                          <button
                            key={code}
                            onClick={() => !disabled && toggleZoneSelection(code)}
                            className={`px-5 py-3 rounded-xl font-semibold transition-all ${
                              selected
                                ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md scale-105"
                                : disabled
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                            }`}
                            title={isNextInSequence ? `Next: Select ${code} first` : selected ? `Selected: ${code}` : `Select ${code}`}
                          >
                            {code}
                            {isNextInSequence && <span className="ml-1">→</span>}
                          </button>
                        );
                      })}
                      {canAddMore && (
                        <button
                          onClick={() => addZoneToRegion(region)}
                          className="px-5 py-3 rounded-xl font-semibold bg-green-100 text-green-700 hover:bg-green-200 transition-all border-2 border-dashed border-green-300"
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedZoneCodes.length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <h4 className="font-semibold text-blue-900">
                  Selected Zones ({selectedZoneCodes.length})
                </h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedZoneCodes.map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-full text-sm"
                    >
                      {code}
                      <button
                        onClick={() => toggleZoneSelection(code)}
                        className="p-0.5 rounded-full hover:bg-blue-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-center">
              <button
                onClick={proceedToConfiguration}
                disabled={selectedZoneCodes.length === 0}
                className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                <Sparkles className="h-6 w-6" />
                Configure Zones
                <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Step 2: Configure Zones ---------- */
  if (currentStep === "configure-zones" && currentConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-slate-900">Configure Zones</h1>
              <p className="text-slate-600 flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-slate-500" />
                <span className="block">
                  <b>Rules:</b> States can repeat across sub-zones in the same region. Cities are
                  exclusive across zones. <span className="text-yellow-700 font-semibold">Yellow</span> =
                  leftover cities explicitly deselected by the user in this regional basket (e.g., “Leftover from
                  N1”). Yellow persists until assigned to any sub-zone in the same region.
                </span>
              </p>
            </div>
            <div className="w-full max-w-sm">
              <div className="text-xs text-slate-600 mb-1">Progress</div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-gradient-to-r from-blue-600 to-green-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-1 text-right text-sm font-semibold text-blue-700">
                {completedZones}/{zoneConfigs.length}
              </div>
            </div>
          </div>

          {/* Tabs with Progressive Disclosure */}
          <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
            {zoneConfigs.map((z, idx) => {
              const canNavigate = canNavigateToZone(idx, currentZoneIndex, zoneConfigs);
              const isLocked = !canNavigate && idx > currentZoneIndex;
              
              return (
                <button
                  key={z.zoneCode}
                  onClick={() => {
                    if (isLocked) {
                      // BULLETPROOF TAB NAVIGATION LOCK - Show specific warning for locked tabs
                      const currentZone = zoneConfigs[currentZoneIndex];
                      const targetZone = zoneConfigs[idx];
                      
                      if (currentZone && !currentZone.isComplete) {
                        alert(`⚠ Please complete ${currentZone.zoneName} first before proceeding to ${targetZone.zoneName}`);
                      } else {
                        const nextIncompleteZone = zoneConfigs.find((zone, index) => index > currentZoneIndex && !zone.isComplete);
                        if (nextIncompleteZone) {
                          alert(`⚠ Please complete ${nextIncompleteZone.zoneName} first before proceeding to ${targetZone.zoneName}`);
                        }
                      }
                      return;
                    }
                    setCurrentZoneIndex(idx);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                    idx === currentZoneIndex
                      ? "bg-blue-600 text-white shadow-lg scale-105"
                      : z.isComplete
                      ? "bg-green-100 text-green-700"
                      : isLocked
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                  title={isLocked ? `Complete ${zoneConfigs[currentZoneIndex]?.zoneName || 'current zone'} first` : z.region}
                  disabled={isLocked}
                >
                  <span className="mr-1">{z.zoneName}</span>
                  {z.isComplete && <span>✓</span>}
                  {isLocked && <span>🔒</span>}
                </button>
              );
            })}
          </div>

          {/* Placard */}
          <div className="mt-4 bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold text-slate-900">
                  Zone {currentConfig.zoneName}{" "}
                  <span className="text-slate-500">({currentConfig.region})</span>
                </h2>
                <p className="text-slate-600 text-sm">
                  Click a state row to focus it. The right-side checkbox now works:
                  <b> click to select all remaining cities</b> (including yellow leftovers) for that state.
                  It is disabled if nothing is available to select.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveCurrentZone}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white hover:opacity-90 ${
                    availableStatesForCurrent.length === 0 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  <CheckCircle className="h-5 w-5" /> 
                  {availableStatesForCurrent.length === 0 
                    ? 'Delete this zone → Next' 
                    : 'Save this zone → Next'
                  }
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentConfig.zoneCode}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25 }}
                className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                {/* Left: States with Status Icons */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">Available States</h3>
                  <div className="max-h-[480px] overflow-y-auto pr-1 space-y-2">
                    {availableStatesForCurrent.length === 0 && (
                      <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-red-600">🗑️</span>
                          <span className="font-semibold text-red-800">No cities available</span>
                        </div>
                        <p className="text-sm text-red-700">
                          All cities in this region have been selected in previous zones. 
                          This subzone will be deleted and you can proceed to the next one.
                        </p>
                      </div>
                    )}

                    {availableStatesForCurrent.map((state) => {
                      const stats = computeStateStats(state);
                      const focused = getActiveState() === state;
                      const allCitiesInState = getAllCityKeysForStateInRegion(state, currentConfig.region);
                      const stateStatus = getStateStatus(state, currentConfig.selectedCities, allCitiesInState);

                      const cardTone = focused
                        ? "border-blue-700 ring-2 ring-blue-100"
                        : stats.selectedHere > 0 && stats.selectedHere < stats.totalAvailableForThisZone
                        ? "border-yellow-400 bg-yellow-50"
                        : stats.selectedHere > 0 && stats.selectedHere === stats.totalAvailableForThisZone
                        ? "border-green-600 bg-green-50"
                        : "border-slate-200 hover:border-slate-300";

                      return (
                        <div
                          key={state}
                          className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${cardTone}`}
                          onClick={() => onStateRowClick(state)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-slate-900 truncate">{state}</div>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                {/* Selected progress in this zone (relative to what's available to this zone) */}
                                {stats.totalAvailableForThisZone > 0 && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                                    {stats.selectedHere}/{stats.totalAvailableForThisZone} selected
                                  </span>
                                )}
                                {/* Non-yellow remaining count */}
                                {stats.nonYellowRemaining > 0 && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
                                    {stats.nonYellowRemaining} cities remaining
                                  </span>
                                )}
                                {/* Yellow leftover count (info) */}
                                {stats.yellowCount > 0 && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                                    {stats.yellowCount} leftover
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* MODERN STATE STATUS INDICATOR - Moved to right side */}
                            <div className="flex-shrink-0">
                              <span className={`text-2xl ${stateStatus.color}`} title={stateStatus.label}>
                                {stateStatus.icon}
                              </span>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Cities for active state ONLY */}
                <div>
                  {/* LAYOUT REORGANIZATION - Move buttons to right side of Cities header */}
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Cities ({getActiveState() || "none"})
                    </h3>
                    {getActiveState() && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => selectAllIncludingYellowInActiveState()}
                          className="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-800 hover:bg-green-200 font-medium"
                          title="Select all remaining cities for this state (including leftovers)"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => clearAllCitiesInActiveState()}
                          className="text-xs px-3 py-1.5 rounded-lg bg-yellow-100 text-yellow-800 hover:bg-yellow-200 font-medium"
                          title="Clear selected cities in this state and mark them as leftovers"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="max-h-[480px] overflow-y-auto pr-1">
                    {!getActiveState() && (
                      <div className="text-sm text-slate-500">
                        Click a state on the left to edit its cities.
                      </div>
                    )}

                    {getActiveState() && currentRegion && (
                      <div className="space-y-4">
                        {(() => {
                          const state = getActiveState()!;
                          const allKeys = getAllCityKeysForStateInRegion(state, currentRegion);

                          // Availability relative to other zones
                          const available = new Set(getAvailableCityKeysForState(state));

                          // Sort city names
                          const sorted = allKeys
                            .map((k) => ({ ...parseCsKey(k), key: k }))
                            .sort((a, b) =>
                              a.city === b.city ? a.state.localeCompare(b.state) : a.city.localeCompare(b.city)
                            );

                          return (
                            <div className="border border-slate-200 rounded-xl p-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-slate-900">{state}</h4>
                                <div className="text-xs text-slate-500">
                                  {
                                    currentConfig.selectedCities.filter(
                                      (k) => parseCsKey(k).state === state
                                    ).length
                                  }{" "}
                                  selected
                                </div>
                              </div>

                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {sorted.map(({ city, key }) => {
                                  const checked = currentConfig.selectedCities.includes(key);
                                  const isBlocked = !available.has(key) && !checked; // used elsewhere
                                  const isYellow = yellowSetForRegion.has(key) && !checked;
                                  const meta = yellowMetaFor(key);
                                  const sourceText =
                                    isYellow && meta?.sources?.length
                                      ? `Leftover`
                                      : null;

                                  return (
                                    <label
                                      key={key}
                                      className={`flex items-center justify-between p-2 rounded-lg border text-sm ${
                                        checked
                                          ? "bg-green-50 border-green-200"
                                          : isBlocked
                                          ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                                          : isYellow
                                          ? "bg-yellow-50 border-yellow-200"
                                          : "bg-white border-slate-200 hover:bg-slate-50"
                                      }`}
                                      title={
                                        isBlocked
                                          ? "Already assigned in another zone"
                                          : isYellow
                                          ? sourceText || "Leftover from another sub-zone"
                                          : undefined
                                      }
                                    >
                                      <span className="truncate pr-2 flex items-center gap-2">
                                        <span className="truncate">{city}</span>
                                        {isYellow && sourceText && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">
                                            {sourceText}
                                          </span>
                                        )}
                                      </span>
                                      <input
                                        type="checkbox"
                                        disabled={isBlocked}
                                        checked={checked}
                                        onChange={() => toggleCity(key)}
                                        className="h-4 w-4 text-green-600"
                                      />
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Summary */}
            <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-200">
              <h4 className="font-semibold text-green-900">Zone Summary</h4>
              <p className="text-sm text-green-900/80">
                {currentConfig.selectedCities.length} cities in{" "}
                {currentConfig.selectedStates.length} state(s)
              </p>
            </div>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep("select-zones")}
                className="px-4 py-2 text-slate-700 hover:text-slate-900"
              >
                ← Back to Zone Selection
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={saveCurrentZone}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                >
                  <CheckCircle className="h-5 w-5" /> Save this zone → Next
                </button>

                {(zoneConfigs.length <= 1 || zoneConfigs.every((z) => z.isComplete)) && (
                  <button
                    onClick={finalizeAll}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Save All & Complete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Step 3: Price Matrix ---------- */
  if (currentStep === "price-matrix") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep("configure-zones")}
              className="inline-flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Zone Configuration
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 md:p-8">
            <div className="mb-6">
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">
                Zone Price Matrix
              </h1>
              <p className="mt-2 text-slate-600">
                Set pricing between all your configured zones. Enter prices in your preferred currency.
              </p>
            </div>

            {/* Price Matrix Grid */}
            <div className="overflow-x-auto">
              <div className="min-w-max">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="p-2 bg-slate-100 font-bold text-slate-800 text-sm border border-slate-300 text-center">
                        FROM/TO
                      </th>
                      {validZones.map((zone) => (
                        <th
                          key={zone.zoneCode}
                          className="p-1 bg-slate-50 font-semibold text-slate-700 min-w-[30px] text-xs border border-slate-300 text-center"
                        >
                          {zone.zoneCode}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validZones.map((fromZone) => (
                      <tr key={fromZone.zoneCode}>
                        <td className="p-1 bg-slate-50 font-semibold text-slate-700 text-xs border border-slate-300 text-center">
                          {fromZone.zoneCode}
                        </td>
                        {validZones.map((toZone) => {
                          const currentPrice = getPrice(fromZone.zoneCode, toZone.zoneCode);
                          return (
                            <td
                              key={`${fromZone.zoneCode}-${toZone.zoneCode}`}
                              className="p-1 border border-slate-300"
                            >
                              <DecimalInput
                                value={currentPrice}
                                onChange={(value) =>
                                  updatePrice(fromZone.zoneCode, toZone.zoneCode, value)
                                }
                                placeholder="0.000"
                                className="w-16 h-7 px-1 border-0 rounded focus:outline-none text-center text-xs"
                                max={999}
                                maxDecimals={3}
                                maxIntegerDigits={3}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2">Matrix Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Total Zones:</span>
                  <span className="ml-2 font-semibold text-blue-900">{validZones.length}</span>
                </div>
                <div>
                  <span className="text-blue-700">Total Routes:</span>
                  <span className="ml-2 font-semibold text-blue-900">
                    {validZones.length * validZones.length}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Prices Set:</span>
                  <span className="ml-2 font-semibold text-blue-900">
                    {priceMatrix.filter((entry) => entry.price !== null).length}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-3">
                <button
                  onClick={savePriceMatrix}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="h-4 w-4" />
                  Save Matrix
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={exportPriceMatrix}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Sparkles className="h-4 w-4" />
                    Export CSV
                  </button>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
                    <Sparkles className="h-4 w-4" />
                    Upload CSV
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <button
                onClick={() => {
                  if (
                    confirm(
                      "Proceed to ODA configuration? This will save your zone and pricing data."
                    )
                  ) {
                    savePriceMatrix();
                    window.location.href = "/oda-upload";
                  }
                }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                <Sparkles className="h-5 w-5" />
                Next: Configure ODA
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
};

export default ZonePriceMatrix;
