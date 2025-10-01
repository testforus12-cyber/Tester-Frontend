// src/services/wheelseye.ts
import axios from "axios";
import { WHEELSEYE_PRICING_DATA } from '../data/wheelseyePricing';

/** --- Types you already use on the page --- */
export type ShipmentBox = {
  count: number;
  length: number;
  width: number;
  height: number;
  weight: number;
};

export type QuoteAny = {
  companyName: string;
  price: number;
  totalCharges: number;
  total: number;
  totalPrice: number;
  isTiedUp?: boolean;
  [k: string]: any;
};

export type WheelseyeBreakdown = {
  price: number;
  weightBreakdown?: {
    actualWeight: number;
    volumetricWeight: number;
    chargeableWeight: number;
  };
  vehicle?: string;
  vehicleLength?: number | string;
  matchedWeight?: number;
  matchedDistance?: number;
  vehiclePricing?: Array<{
    vehicleType: string;
    weight: number;
    maxWeight: number;
    wheelseyePrice: number;
    ftlPrice: number;
  }>;
  vehicleCalculation?: { totalVehiclesRequired?: number };
  loadSplit?: any;
};

/** --- New Pricing Data Types --- */
export type DistanceRange = {
  min: number;
  max: number;
};

export type WeightRange = {
  min: number;
  max: number;
};

export type PricingEntry = {
  distanceRange: DistanceRange;
  price: number;
  _id: string;
};

export type VehiclePricingData = {
  _id: string;
  vehicleType: string;
  weightRange: WeightRange;
  distanceRange: DistanceRange;
  vehicleLength: number;
  pricing: PricingEntry[];
  createdAt: string;
  updatedAt: string;
  __v: number;
};

/** --- Config (use env when available) --- */
const BASE_URL =
  (import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "") ||
    "https://tester-backend-4nxc.onrender.com");

const AUTH_HEADER = (token?: string) =>
  token ? { Authorization: `Bearer ${token}` } : undefined;


/**
 * Calculate pricing using local pricing data instead of API calls
 */
export function calculateLocalWheelseyePrice(
  chargeableWeight: number,
  distanceKm: number,
  shipment: ShipmentBox[]
): WheelseyeBreakdown {
  console.log(`🚛 Calculating local Wheelseye price for weight: ${chargeableWeight}kg, distance: ${distanceKm}km`);
  
  // Find matching vehicle based on weight
  const matchingVehicles = WHEELSEYE_PRICING_DATA.filter(vehicle => 
    chargeableWeight >= vehicle.weightRange.min && chargeableWeight <= vehicle.weightRange.max
  );
  
  if (matchingVehicles.length === 0) {
    console.warn(`⚠️ No matching vehicle found for weight: ${chargeableWeight}kg, using fallback`);
    // Fallback for weights outside our data range
    let fallbackPrice = 50000; // Base fallback price
    if (chargeableWeight > 18000) {
      // For very heavy loads, calculate multiple vehicles
      const vehicleCount = Math.ceil(chargeableWeight / 18000);
      fallbackPrice = vehicleCount * 50000;
    } else if (chargeableWeight < 850) {
      // For very light loads
      fallbackPrice = 3000;
    }
    
    return {
      price: fallbackPrice,
      weightBreakdown: {
        actualWeight: chargeableWeight,
        volumetricWeight: chargeableWeight,
        chargeableWeight: chargeableWeight
      },
      vehicle: getVehicleByWeight(chargeableWeight),
      vehicleLength: getVehicleLengthByWeight(chargeableWeight),
      matchedWeight: chargeableWeight,
      matchedDistance: distanceKm
    };
  }
  
  // Sort by weight range to get the most appropriate vehicle
  const bestVehicle = matchingVehicles.sort((a, b) => {
    // Prefer vehicles with tighter weight range fit
    const aRange = a.weightRange.max - a.weightRange.min;
    const bRange = b.weightRange.max - b.weightRange.min;
    return aRange - bRange;
  })[0];
  
  console.log(`🚛 Selected vehicle: ${bestVehicle.vehicleType} for weight ${chargeableWeight}kg`);
  
  // Find matching price based on distance
  const matchingPricing = bestVehicle.pricing.find(pricing =>
    distanceKm >= pricing.distanceRange.min && distanceKm <= pricing.distanceRange.max
  );
  
  let price = 0;
  if (matchingPricing) {
    price = matchingPricing.price;
    console.log(`✅ Found exact price: ₹${price} for distance ${distanceKm}km`);
  } else {
    // Fallback: find closest distance range or use interpolation
    const sortedPricing = bestVehicle.pricing.sort((a, b) => a.distanceRange.min - b.distanceRange.min);
    
    if (distanceKm < sortedPricing[0].distanceRange.min) {
      // Distance is below minimum range, use first price
      price = sortedPricing[0].price;
      console.log(`⚠️ Distance ${distanceKm}km below minimum range, using first price: ₹${price}`);
    } else if (distanceKm > sortedPricing[sortedPricing.length - 1].distanceRange.max) {
      // Distance is above maximum range, use last price with distance factor
      const lastPricing = sortedPricing[sortedPricing.length - 1];
      const distanceFactor = distanceKm / lastPricing.distanceRange.max;
      price = Math.round(lastPricing.price * distanceFactor);
      console.log(`⚠️ Distance ${distanceKm}km above maximum range, extrapolated price: ₹${price}`);
    } else {
      // Interpolate between two closest ranges
      for (let i = 0; i < sortedPricing.length - 1; i++) {
        const current = sortedPricing[i];
        const next = sortedPricing[i + 1];
        
        if (distanceKm > current.distanceRange.max && distanceKm < next.distanceRange.min) {
          // Distance falls between two ranges, interpolate
          const ratio = (distanceKm - current.distanceRange.max) / (next.distanceRange.min - current.distanceRange.max);
          price = Math.round(current.price + (next.price - current.price) * ratio);
          console.log(`🔄 Interpolated price: ₹${price} for distance ${distanceKm}km between ranges`);
          break;
        }
      }
      
      // If still no price found, use closest range
      if (price === 0) {
        const closest = sortedPricing.reduce((prev, curr) => {
          const prevDiff = Math.min(
            Math.abs(distanceKm - prev.distanceRange.min),
            Math.abs(distanceKm - prev.distanceRange.max)
          );
          const currDiff = Math.min(
            Math.abs(distanceKm - curr.distanceRange.min),
            Math.abs(distanceKm - curr.distanceRange.max)
          );
          return prevDiff < currDiff ? prev : curr;
        });
        price = closest.price;
        console.log(`🎯 Used closest range price: ₹${price} for distance ${distanceKm}km`);
      }
    }
  }
  
  // Calculate volumetric weight from shipment details
  let totalVolumetricWeight = 0;
  let totalActualWeight = 0;
  
  shipment.forEach(box => {
    const volumetric = (box.length * box.width * box.height * box.count) / 5000; // Standard volumetric calculation
    totalVolumetricWeight += volumetric;
    totalActualWeight += box.weight * box.count;
  });
  
  // Use the higher of actual weight or provided chargeable weight
  const actualWeight = Math.max(totalActualWeight, chargeableWeight);
  const volumetricWeight = Math.max(totalVolumetricWeight, chargeableWeight);
  const finalChargeableWeight = Math.max(actualWeight, volumetricWeight);
  
  console.log(`📊 Weight breakdown - Actual: ${actualWeight}kg, Volumetric: ${volumetricWeight}kg, Chargeable: ${finalChargeableWeight}kg`);
  console.log(`💰 Final Wheelseye price: ₹${price}`);
  
  return {
    price,
    weightBreakdown: {
      actualWeight,
      volumetricWeight,
      chargeableWeight: finalChargeableWeight
    },
    vehicle: bestVehicle.vehicleType,
    vehicleLength: bestVehicle.vehicleLength,
    matchedWeight: finalChargeableWeight,
    matchedDistance: distanceKm
  };
}

/**
 * Get vehicle type by weight (fallback function)
 */
function getVehicleByWeight(weight: number): string {
  if (weight <= 1000) return "Tata Ace";
  if (weight <= 1200) return "Pickup";
  if (weight <= 1500) return "10 ft Truck";
  if (weight <= 4000) return "Eicher 14 ft";
  if (weight <= 7000) return "Eicher 19 ft";
  if (weight <= 10000) return "Eicher 20 ft";
  if (weight <= 18000) return "Container 32 ft MXL";
  return "Container 32 ft MXL + Additional Vehicle";
}

/**
 * Get vehicle length by weight (fallback function)
 */
function getVehicleLengthByWeight(weight: number): number {
  if (weight <= 1000) return 7;
  if (weight <= 1200) return 8;
  if (weight <= 1500) return 10;
  if (weight <= 4000) return 14;
  if (weight <= 7000) return 19;
  if (weight <= 10000) return 20;
  return 32;
}

/**
 * Try multiple POST endpoints in order until one succeeds (non-404/400).
 * You can override the first item with VITE_* envs if the backend route is known.
 */
async function postFirstAvailable<T>(
  paths: string[],
  body: any,
  token?: string
): Promise<T> {
  const headers = AUTH_HEADER(token);
  let lastErr: any = null;
  for (const p of paths) {
    try {
      const url = `${BASE_URL}${p}`;
      const res = await axios.post(url, body, { headers });
      return res.data as T;
    } catch (err: any) {
      const status = err?.response?.status;
      // keep trying on 404/400; bubble up other statuses (401/500 etc)
      if (status !== 404 && status !== 400) throw err;
      lastErr = err;
      // continue to next candidate
    }
  }
  throw lastErr ?? new Error("No matching endpoint found");
}

/**
 * Estimate distance based on pincode regions (fallback method)
 */
function estimateDistanceByPincode(fromPin: string, toPin: string): number {
  // Basic regional distance estimation based on pincode patterns
  const fromRegion = getRegionFromPincode(fromPin);
  const toRegion = getRegionFromPincode(toPin);
  
  // Regional distance matrix (rough estimates in km)
  const regionalDistances: Record<string, Record<string, number>> = {
    'north': { 'north': 200, 'south': 1500, 'east': 800, 'west': 600, 'central': 400 },
    'south': { 'north': 1500, 'south': 300, 'east': 400, 'west': 500, 'central': 600 },
    'east': { 'north': 800, 'south': 400, 'east': 200, 'west': 1000, 'central': 500 },
    'west': { 'north': 600, 'south': 500, 'east': 1000, 'west': 200, 'central': 400 },
    'central': { 'north': 400, 'south': 600, 'east': 500, 'west': 400, 'central': 200 }
  };
  
  return regionalDistances[fromRegion]?.[toRegion] || 500;
}

/**
 * Get region from pincode (basic estimation)
 */
function getRegionFromPincode(pincode: string): string {
  const pin = parseInt(pincode.substring(0, 2));
  
  if (pin >= 11 && pin <= 20) return 'north'; // Delhi, Haryana, Punjab
  if (pin >= 40 && pin <= 49) return 'west';  // Maharashtra, Gujarat
  if (pin >= 50 && pin <= 59) return 'south'; // Karnataka, Tamil Nadu, Kerala
  if (pin >= 60 && pin <= 69) return 'south'; // Tamil Nadu, Kerala
  if (pin >= 70 && pin <= 79) return 'east';  // West Bengal, Odisha
  if (pin >= 80 && pin <= 89) return 'east';  // Bihar, Jharkhand
  
  return 'central'; // Default fallback
}

/**
 * Distance provider (optional).
 * NOTE: We DO NOT call any distance endpoint unless an explicit env path is provided.
 * Prefer passing distanceKmOverride to the builder instead.
 */
export async function getDistanceKmByAPI(
  fromPin: string,
  toPin: string,
  token?: string
): Promise<number> {
  const explicit = import.meta.env.VITE_DISTANCE_ENDPOINT; // e.g. "/api/transporter/distance"
  if (!explicit) {
    // No explicit distance endpoint configured — avoid calling loose ends.
    throw new Error("No distance endpoint configured (VITE_DISTANCE_ENDPOINT).");
  }

  const candidates = [
    explicit,                                 // take env first if provided
    "/api/transporter/distance",
    "/api/transporter/getDistance",
    "/api/distance",
    "/distance",
  ].filter(Boolean) as string[];

  const data: any = await postFirstAvailable<any>(
    candidates,
    { fromPincode: fromPin, toPincode: toPin },
    token
  );

  const km =
    Number(
      data?.distanceKm ??
      data?.data?.distanceKm ??
      data?.result?.distanceKm
    ) || 0;

  if (!km) throw new Error("No distance in response");
  return km;
}

/** Wheelseye price — use local pricing data first, fallback to API */
export async function getWheelseyePriceFromDB(
  chargeableWeight: number,
  distanceKm: number,
  shipment: ShipmentBox[],
  token?: string
): Promise<WheelseyeBreakdown> {
  // First, try to calculate using local pricing data
  try {
    console.log(`🚛 Using local Wheelseye pricing data for calculation`);
    const localResult = calculateLocalWheelseyePrice(chargeableWeight, distanceKm, shipment);
    console.log(`✅ Local pricing calculation successful: ₹${localResult.price}`);
    return localResult;
  } catch (localError) {
    console.warn(`⚠️ Local pricing calculation failed, falling back to API:`, localError);
    
    // Fallback to API call if local calculation fails
    const explicit = import.meta.env.VITE_WHEELS_PRICE_ENDPOINT; // e.g. "/api/vendor/wheelseye-pricing"
    const candidates = [
      explicit,                                   // env wins if set
      "/api/vendor/wheelseye-pricing",           // correct endpoint
      "/api/wheelseye/pricing",                  // alternative endpoint
    ].filter(Boolean) as string[];

    try {
      const data = await postFirstAvailable<WheelseyeBreakdown>(
        candidates,
        { weight: chargeableWeight, distance: distanceKm, shipment_details: shipment },
        token
      );
      console.log(`✅ API pricing calculation successful: ₹${data.price}`);
      return data;
    } catch (apiError) {
      console.error(`❌ Both local and API pricing calculations failed:`, apiError);
      
      // Final fallback with basic calculation
      const fallbackPrice = Math.max(3000, Math.round(distanceKm * 25 + chargeableWeight * 2));
      return {
        price: fallbackPrice,
        weightBreakdown: {
          actualWeight: chargeableWeight,
          volumetricWeight: chargeableWeight,
          chargeableWeight: chargeableWeight
        },
        vehicle: getVehicleByWeight(chargeableWeight),
        vehicleLength: getVehicleLengthByWeight(chargeableWeight),
        matchedWeight: chargeableWeight,
        matchedDistance: distanceKm
      };
    }
  }
}

/**
 * End-to-end builder:
 * - DOES NOT call any distance route unless distanceKmOverride is missing *and* VITE_DISTANCE_ENDPOINT is set.
 * - Prefer passing distance from your /calculate response via distanceKmOverride.
 */
export async function buildFtlAndWheelseyeQuotes(opts: {
  fromPincode: string;
  toPincode: string;
  shipment: ShipmentBox[];
  totalWeight: number;
  token?: string;
  ekartFallback?: number;
  isWheelseyeServiceArea: (pin: string) => boolean;
  distanceKmOverride?: number; // <── Prefer this; avoids any distance API call
}) {
  const {
    fromPincode,
    toPincode,
    shipment,
    totalWeight,
    token,
    ekartFallback = 32000,
    isWheelseyeServiceArea,
    distanceKmOverride,
  } = opts;

  // 1) Distance: ALWAYS use the provided distance from main calculation (same as other vendors)
  let distanceKm = 0;
  
  console.log('Distance override received:', distanceKmOverride, 'type:', typeof distanceKmOverride);
  
  if (typeof distanceKmOverride === "number" && distanceKmOverride > 0) {
    distanceKm = distanceKmOverride;
    console.log(`✅ Using provided distance from main calculation: ${distanceKm}km`);
    console.log(`✅ SKIPPING all distance calculations - using exact same distance as other vendors`);
  } else if (typeof distanceKmOverride === "number" && distanceKmOverride === 0) {
    console.error('❌ Distance override is 0 - this means main calculation failed to provide distance');
    console.error('❌ Cannot proceed with Wheelseye/Local FTL calculation without valid distance');
    return {
      distanceKm: 0,
      ftlQuote: null,
      wheelseyeQuote: null,
      numbers: { ftlPrice: 0, wheelseyePrice: 0, actualWeight: 0, volumetricWeight: 0, chargeableWeight: 0 },
    };
  } else {
    // Only calculate distance if not provided (should not happen in normal flow)
    console.warn('❌ No valid distance provided from main calculation, falling back to calculation');
    console.warn('❌ This should not happen - distance should always be provided from main calculation');
    try {
      distanceKm = await getDistanceKmByAPI(fromPincode, toPincode, token);
    } catch (error) {
      // Try to calculate distance using pincode coordinates as fallback
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://tester-backend-4nxc.onrender.com'}/api/vendor/wheelseye-distance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify({
            origin: fromPincode,
            destination: toPincode
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          distanceKm = data.distanceKm;
          console.log(`Distance calculated via backend: ${distanceKm}km`);
        } else {
          throw new Error('Backend distance calculation failed');
        }
      } catch (fallbackError) {
        // Final fallback: estimate based on pincode regions
        distanceKm = estimateDistanceByPincode(fromPincode, toPincode);
        console.warn(`Distance calculation failed, using estimated distance: ${distanceKm}km`);
      }
    }
  }

  // 2) Compute Wheelseye + FTL
  let ftlPrice = 0;
  let wheelseyePrice = 0;
  let wheelseyeResult: WheelseyeBreakdown | null = null;
  let actualWeight = totalWeight;
  let volumetricWeight = totalWeight;
  let chargeableWeight = totalWeight;

  try {
    console.log(`🚛 Calling Wheelseye pricing API with distance: ${distanceKm}km`);
    wheelseyeResult = await getWheelseyePriceFromDB(
      totalWeight,
      distanceKm,
      shipment,
      token
    );

    const wb = wheelseyeResult?.weightBreakdown;
    actualWeight = wb?.actualWeight ?? totalWeight;
    volumetricWeight = wb?.volumetricWeight ?? totalWeight;
    chargeableWeight =
      wb?.chargeableWeight ?? Math.max(actualWeight, volumetricWeight);

    if (chargeableWeight > 18000) {
      // split into vehicles; re-query per vehicle
      const vehicleCount = Math.ceil(chargeableWeight / 18000);
      let totalWE = 0;
      let totalFTL = 0;

      const calls = Array.from({ length: vehicleCount }, (_, i) => {
        const w = Math.min(18000, chargeableWeight - i * 18000);
        return getWheelseyePriceFromDB(
          w,
          distanceKm,
          [{ count: 1, length: 100, width: 100, height: 100, weight: w }],
          token
        ).then(
          (r) => ({ ok: true as const, price: r.price, w }),
          (err) => ({ ok: false as const, err, w })
        );
      });

      const results = await Promise.all(calls);
      for (const r of results) {
        if (r.ok) {
          totalWE += r.price;
          totalFTL += Math.round((r.price * 1.2) / 10) * 10;
        } else {
          const fb = Math.round(
            ((wheelseyeResult?.price ?? 50000) / vehicleCount)
          );
          totalWE += fb;
          totalFTL += Math.round((fb * 1.2) / 10) * 10;
        }
      }
      wheelseyePrice = totalWE;
      ftlPrice = totalFTL;
      wheelseyeResult = { ...wheelseyeResult, price: wheelseyePrice };
    } else {
      wheelseyePrice = wheelseyeResult.price;
      ftlPrice = Math.round((wheelseyePrice * 1.2) / 10) * 10;
    }
  } catch (e) {
    console.warn("Wheelseye pricing failed, using fallback:", e);
    ftlPrice = Math.round((ekartFallback * 1.1) / 10) * 10;
    wheelseyePrice = Math.round((ekartFallback * 0.95) / 10) * 10;
  }

  const tooLight = actualWeight < 500 || volumetricWeight < 500;

  const makeVehicleByWeight = (w: number) =>
    w > 18000
      ? "Container 32 ft MXL + Additional Vehicle"
      : w <= 1000
      ? "Tata Ace"
      : w <= 1500
      ? "Pickup"
      : w <= 2000
      ? "10 ft Truck"
      : w <= 4000
      ? "Eicher 14 ft"
      : w <= 7000
      ? "Eicher 19 ft"
      : w <= 10000
      ? "Eicher 20 ft"
      : "Container 32 ft MXL";

  const makeVehicleLen = (w: number) =>
    w > 18000
      ? "32 ft + Additional"
      : w <= 1000
      ? 7
      : w <= 1500
      ? 8
      : w <= 2000
      ? 10
      : w <= 4000
      ? 14
      : w <= 7000
      ? 19
      : w <= 10000
      ? 20
      : 32;

  const etaDays = (km: number) => Math.ceil(km / 400);

  const base = {
    actualWeight,
    volumetricWeight,
    chargeableWeight,
    matchedWeight: wheelseyeResult?.matchedWeight ?? chargeableWeight,
    matchedDistance: wheelseyeResult?.matchedDistance ?? distanceKm,
    distance: `${Math.round(distanceKm)} km`,
    originPincode: fromPincode,
    destinationPincode: toPincode,
    isTiedUp: false,
  };

  const ftlQuote =
    !tooLight && isWheelseyeServiceArea(fromPincode)
      ? {
          ...base,
          message: "",
          isHidden: false,
          transporterData: { 
            _id: "local-ftl-transporter",
            rating: 4.6,
            name: "LOCAL FTL",
            type: "FTL"
          },
          companyName: "LOCAL FTL",
          transporterName: "LOCAL FTL",
          category: "LOCAL FTL",
          totalCharges: ftlPrice,
          price: ftlPrice,
          total: ftlPrice,
          totalPrice: ftlPrice,
          estimatedTime: etaDays(distanceKm),
          estimatedDelivery: `${etaDays(distanceKm)} Day${
            etaDays(distanceKm) > 1 ? "s" : ""
          }`,
          deliveryTime: `${etaDays(distanceKm)} Day${
            etaDays(distanceKm) > 1 ? "s" : ""
          }`,
          vehicle:
            wheelseyeResult?.vehicle ?? makeVehicleByWeight(chargeableWeight),
          vehicleLength:
            wheelseyeResult?.vehicleLength ?? makeVehicleLen(chargeableWeight),
          loadSplit: wheelseyeResult?.loadSplit ?? null,
      
          vehicleBreakdown: (wheelseyeResult as any)?.vehicleBreakdown ?? null,
        }
      : null;

  console.log(`🚛 Local FTL quote created with distance: ${Math.round(distanceKm)} km, price: ₹${ftlPrice}`);

  const wheelseyeQuote =
    !tooLight && isWheelseyeServiceArea(fromPincode)
      ? {
          ...base,
          message: "",
          isHidden: false,
          transporterData: { 
            _id: "wheelseye-ftl-transporter",
            rating: 4.6,
            name: "Wheelseye FTL",
            type: "FTL"
          },
          companyName: "Wheelseye FTL",
          transporterName: "Wheelseye FTL",
          category: "Wheelseye FTL",
          totalCharges: wheelseyePrice,
          price: wheelseyePrice,
          total: wheelseyePrice,
          totalPrice: wheelseyePrice,
          estimatedTime: etaDays(distanceKm),
          estimatedDelivery: `${etaDays(distanceKm)} Day${
            etaDays(distanceKm) > 1 ? "s" : ""
          }`,
          deliveryTime: `${etaDays(distanceKm)} Day${
            etaDays(distanceKm) > 1 ? "s" : ""
          }`,
          vehicle:
            wheelseyeResult?.vehicle ?? makeVehicleByWeight(chargeableWeight),
          vehicleLength:
            wheelseyeResult?.vehicleLength ?? makeVehicleLen(chargeableWeight),
          loadSplit: wheelseyeResult?.loadSplit ?? null,
          vehicleBreakdown: (wheelseyeResult as any)?.vehicleBreakdown ?? null,
        }
      : null;

  console.log(`🚛 Wheelseye quote created with distance: ${Math.round(distanceKm)} km, price: ₹${wheelseyePrice}`);

  return {
    distanceKm,
    ftlQuote,
    wheelseyeQuote,
    numbers: {
      ftlPrice,
      wheelseyePrice,
      actualWeight,
      volumetricWeight,
      chargeableWeight,
    },
    wheelseyeRaw: wheelseyeResult,
  };
}
