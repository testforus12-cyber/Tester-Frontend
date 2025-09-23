// src/services/wheelseye.ts
import axios from "axios";

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

/** Local FTL price table types */
type DistanceRange = { min: number; max: number };
type LocalFtlPricingEntry = { distanceRange: DistanceRange; price: number };
type LocalFtlBracket = {
  vehicleType: string;
  weightRange: { min: number; max: number };
  distanceRange: DistanceRange;
  vehicleLength: number | string;
  pricing: LocalFtlPricingEntry[];
};

/** --- Pluggable config (env or constants) --- */
const BASE_URL = (
  import.meta.env.VITE_BACKEND_URL ||
  // Support legacy env var if present
  (import.meta.env as any).REACT_APP_URL ||
  "https://backend-bcxr.onrender.com"
).replace(/\/$/, "");
const AUTH_HEADER = (token?: string) =>
  token ? { Authorization: `Bearer ${token}` } : undefined;

/**
 * Static Wheelseye pricing table provided by user.
 * We treat these values as Wheelseye baseline prices.
 * LOCAL FTL is computed as +20% over this price.
 */
const LOCAL_FTL_PRICE_TABLE: LocalFtlBracket[] = [
  // Tata Ace (850–1000 kg, 0–1000 km)
  {
    vehicleType: "Tata Ace",
    weightRange: { min: 850, max: 1000 },
    distanceRange: { min: 0, max: 1000 },
    vehicleLength: 7,
    pricing: [
      { distanceRange: { min: 0, max: 100 }, price: 4300 },
      { distanceRange: { min: 101, max: 150 }, price: 6000 },
      { distanceRange: { min: 151, max: 200 }, price: 6900 },
      { distanceRange: { min: 201, max: 250 }, price: 7000 },
      { distanceRange: { min: 251, max: 300 }, price: 9500 },
      { distanceRange: { min: 301, max: 350 }, price: 10400 },
      { distanceRange: { min: 351, max: 400 }, price: 10400 },
      { distanceRange: { min: 401, max: 450 }, price: 10600 },
      { distanceRange: { min: 451, max: 500 }, price: 13900 },
      { distanceRange: { min: 501, max: 600 }, price: 12300 },
      { distanceRange: { min: 601, max: 700 }, price: 15700 },
      { distanceRange: { min: 701, max: 800 }, price: 17900 },
      { distanceRange: { min: 801, max: 900 }, price: 18400 },
      { distanceRange: { min: 901, max: 1000 }, price: 18500 },
    ],
  },

  // Pickup (1001–1200 kg, 0–1000 km)
  {
    vehicleType: "Pickup",
    weightRange: { min: 1001, max: 1200 },
    distanceRange: { min: 0, max: 1000 },
    vehicleLength: 8,
    pricing: [
      { distanceRange: { min: 0, max: 100 }, price: 5300 },
      { distanceRange: { min: 101, max: 150 }, price: 6500 },
      { distanceRange: { min: 151, max: 200 }, price: 7000 },
      { distanceRange: { min: 201, max: 250 }, price: 7300 },
      { distanceRange: { min: 251, max: 300 }, price: 11500 },
      { distanceRange: { min: 301, max: 350 }, price: 11400 },
      { distanceRange: { min: 351, max: 400 }, price: 11400 },
      { distanceRange: { min: 401, max: 450 }, price: 10500 },
      { distanceRange: { min: 451, max: 500 }, price: 12800 },
      { distanceRange: { min: 501, max: 600 }, price: 15700 },
      { distanceRange: { min: 601, max: 700 }, price: 16900 },
      { distanceRange: { min: 701, max: 800 }, price: 17000 },
      { distanceRange: { min: 801, max: 900 }, price: 22600 },
      { distanceRange: { min: 901, max: 1000 }, price: 23100 },
    ],
  },

  // 10 ft Truck (1201–1500 kg, 0–1000 km)
  {
    vehicleType: "10 ft Truck",
    weightRange: { min: 1201, max: 1500 },
    distanceRange: { min: 0, max: 1000 },
    vehicleLength: 10,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 2200 },
      { distanceRange: { min: 51, max: 60 }, price: 2200 },
      { distanceRange: { min: 61, max: 100 }, price: 5800 },
      { distanceRange: { min: 101, max: 150 }, price: 4900 },
      { distanceRange: { min: 151, max: 200 }, price: 9800 },
      { distanceRange: { min: 201, max: 250 }, price: 9600 },
      { distanceRange: { min: 251, max: 300 }, price: 11500 },
      { distanceRange: { min: 301, max: 350 }, price: 12000 },
      { distanceRange: { min: 351, max: 400 }, price: 13000 },
      { distanceRange: { min: 401, max: 450 }, price: 14600 },
      { distanceRange: { min: 451, max: 500 }, price: 16400 },
      { distanceRange: { min: 501, max: 600 }, price: 20300 },
      { distanceRange: { min: 601, max: 700 }, price: 23000 },
      { distanceRange: { min: 701, max: 800 }, price: 25200 },
      { distanceRange: { min: 801, max: 900 }, price: 29300 },
      // Note: keeping the provided value as-is.
      { distanceRange: { min: 901, max: 1000 }, price: 2100 },
    ],
  },

  // Eicher 14 ft (1501–2000 kg, 0–2000 km)
  {
    vehicleType: "Eicher 14 ft",
    weightRange: { min: 1501, max: 2000 },
    distanceRange: { min: 0, max: 2000 },
    vehicleLength: 14,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 3600 },
      { distanceRange: { min: 51, max: 60 }, price: 3600 },
      { distanceRange: { min: 61, max: 100 }, price: 7200 },
      { distanceRange: { min: 101, max: 150 }, price: 9200 },
      { distanceRange: { min: 151, max: 200 }, price: 12600 },
      { distanceRange: { min: 201, max: 250 }, price: 12200 },
      { distanceRange: { min: 251, max: 300 }, price: 18000 },
      { distanceRange: { min: 301, max: 350 }, price: 17800 },
      { distanceRange: { min: 351, max: 400 }, price: 17800 },
      { distanceRange: { min: 401, max: 450 }, price: 21000 },
      { distanceRange: { min: 451, max: 500 }, price: 22600 },
      { distanceRange: { min: 501, max: 600 }, price: 20500 },
      { distanceRange: { min: 601, max: 700 }, price: 28200 },
      { distanceRange: { min: 701, max: 800 }, price: 29300 },
      { distanceRange: { min: 801, max: 900 }, price: 28800 },
      { distanceRange: { min: 901, max: 1000 }, price: 36900 },
      { distanceRange: { min: 1001, max: 1200 }, price: 37700 },
      { distanceRange: { min: 1201, max: 1500 }, price: 50800 },
      { distanceRange: { min: 1501, max: 1800 }, price: 45900 },
      { distanceRange: { min: 1801, max: 2000 }, price: 45900 },
    ],
  },

  // Eicher 14 ft (2001–2500 kg, 0–2200 km)
  {
    vehicleType: "Eicher 14 ft",
    weightRange: { min: 2001, max: 2500 },
    distanceRange: { min: 0, max: 2200 },
    vehicleLength: 14,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 3600 },
      { distanceRange: { min: 51, max: 60 }, price: 3600 },
      { distanceRange: { min: 61, max: 100 }, price: 7200 },
      { distanceRange: { min: 101, max: 150 }, price: 9200 },
      { distanceRange: { min: 151, max: 200 }, price: 12600 },
      { distanceRange: { min: 201, max: 250 }, price: 12200 },
      { distanceRange: { min: 251, max: 300 }, price: 18000 },
      { distanceRange: { min: 301, max: 350 }, price: 17800 },
      { distanceRange: { min: 351, max: 400 }, price: 17800 },
      { distanceRange: { min: 401, max: 450 }, price: 21000 },
      { distanceRange: { min: 451, max: 500 }, price: 22600 },
      { distanceRange: { min: 501, max: 600 }, price: 20500 },
      { distanceRange: { min: 601, max: 700 }, price: 28200 },
      { distanceRange: { min: 701, max: 800 }, price: 29300 },
      { distanceRange: { min: 801, max: 900 }, price: 28800 },
      { distanceRange: { min: 901, max: 1000 }, price: 36900 },
      { distanceRange: { min: 1001, max: 1200 }, price: 37700 },
      { distanceRange: { min: 1201, max: 1500 }, price: 50800 },
      { distanceRange: { min: 1501, max: 1800 }, price: 45900 },
      { distanceRange: { min: 1801, max: 2000 }, price: 45900 },
      { distanceRange: { min: 2001, max: 2200 }, price: 67500 },
    ],
  },

  // Eicher 14 ft (2501–3000 kg, 0–2500 km)
  {
    vehicleType: "Eicher 14 ft",
    weightRange: { min: 2501, max: 3000 },
    distanceRange: { min: 0, max: 2500 },
    vehicleLength: 14,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 3600 },
      { distanceRange: { min: 51, max: 60 }, price: 3600 },
      { distanceRange: { min: 61, max: 100 }, price: 7200 },
      { distanceRange: { min: 101, max: 150 }, price: 9200 },
      { distanceRange: { min: 151, max: 200 }, price: 12600 },
      { distanceRange: { min: 201, max: 250 }, price: 12200 },
      { distanceRange: { min: 251, max: 300 }, price: 18000 },
      { distanceRange: { min: 301, max: 350 }, price: 17800 },
      { distanceRange: { min: 351, max: 400 }, price: 17800 },
      { distanceRange: { min: 401, max: 450 }, price: 21000 },
      { distanceRange: { min: 451, max: 500 }, price: 22600 },
      { distanceRange: { min: 501, max: 600 }, price: 20500 },
      { distanceRange: { min: 601, max: 700 }, price: 28200 },
      { distanceRange: { min: 701, max: 800 }, price: 29300 },
      { distanceRange: { min: 801, max: 900 }, price: 28800 },
      { distanceRange: { min: 901, max: 1000 }, price: 36900 },
      { distanceRange: { min: 1001, max: 1200 }, price: 37700 },
      { distanceRange: { min: 1201, max: 1500 }, price: 50800 },
      { distanceRange: { min: 1501, max: 1800 }, price: 65100 },
      { distanceRange: { min: 1801, max: 2000 }, price: 45900 },
      { distanceRange: { min: 2001, max: 2200 }, price: 67500 },
    ],
  },

  // Eicher 14 ft (3001–3500 kg, 0–2700 km)
  {
    vehicleType: "Eicher 14 ft",
    weightRange: { min: 3001, max: 3500 },
    distanceRange: { min: 0, max: 2700 },
    vehicleLength: 14,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 3600 },
      { distanceRange: { min: 51, max: 60 }, price: 3600 },
      { distanceRange: { min: 61, max: 100 }, price: 7200 },
      { distanceRange: { min: 101, max: 150 }, price: 9200 },
      { distanceRange: { min: 151, max: 200 }, price: 12600 },
      { distanceRange: { min: 201, max: 250 }, price: 12200 },
      { distanceRange: { min: 251, max: 300 }, price: 18000 },
      { distanceRange: { min: 301, max: 350 }, price: 17800 },
      { distanceRange: { min: 351, max: 400 }, price: 17800 },
      { distanceRange: { min: 401, max: 450 }, price: 21000 },
      { distanceRange: { min: 451, max: 500 }, price: 22600 },
      { distanceRange: { min: 501, max: 600 }, price: 20500 },
      { distanceRange: { min: 601, max: 700 }, price: 28200 },
      { distanceRange: { min: 701, max: 800 }, price: 29300 },
      { distanceRange: { min: 801, max: 900 }, price: 28800 },
      { distanceRange: { min: 901, max: 1000 }, price: 36900 },
      { distanceRange: { min: 1001, max: 1200 }, price: 37700 },
      { distanceRange: { min: 1201, max: 1500 }, price: 50800 },
      { distanceRange: { min: 1501, max: 1800 }, price: 65100 },
      { distanceRange: { min: 1801, max: 2000 }, price: 45900 },
      { distanceRange: { min: 2001, max: 2200 }, price: 67500 },
      { distanceRange: { min: 2201, max: 2500 }, price: 74100 },
      { distanceRange: { min: 2501, max: 2600 }, price: 77300 },
      { distanceRange: { min: 2601, max: 2700 }, price: 79100 },
    ],
  },

  // Eicher 14 ft (3501–4000 kg, 0–2200 km)
  {
    vehicleType: "Eicher 14 ft",
    weightRange: { min: 3501, max: 4000 },
    distanceRange: { min: 0, max: 2200 },
    vehicleLength: 14,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 3600 },
      { distanceRange: { min: 51, max: 60 }, price: 3600 },
      { distanceRange: { min: 61, max: 100 }, price: 7200 },
      { distanceRange: { min: 101, max: 150 }, price: 9200 },
      { distanceRange: { min: 151, max: 200 }, price: 12600 },
      { distanceRange: { min: 201, max: 250 }, price: 12200 },
      { distanceRange: { min: 251, max: 300 }, price: 18000 },
      { distanceRange: { min: 301, max: 350 }, price: 17800 },
      { distanceRange: { min: 351, max: 400 }, price: 17800 },
      { distanceRange: { min: 401, max: 450 }, price: 21000 },
      { distanceRange: { min: 451, max: 500 }, price: 22600 },
      { distanceRange: { min: 501, max: 600 }, price: 20500 },
      { distanceRange: { min: 601, max: 700 }, price: 28200 },
      { distanceRange: { min: 701, max: 800 }, price: 29300 },
      { distanceRange: { min: 801, max: 900 }, price: 28800 },
      { distanceRange: { min: 901, max: 1000 }, price: 36900 },
      { distanceRange: { min: 1001, max: 1200 }, price: 37700 },
      { distanceRange: { min: 1201, max: 1500 }, price: 50800 },
      { distanceRange: { min: 1501, max: 1800 }, price: 65100 },
      { distanceRange: { min: 1801, max: 2000 }, price: 45900 },
      { distanceRange: { min: 2001, max: 2200 }, price: 67500 },
    ],
  },

  // Eicher 19 ft (4001–7000 kg, 0–2700 km)
  {
    vehicleType: "Eicher 19 ft",
    weightRange: { min: 4001, max: 7000 },
    distanceRange: { min: 0, max: 2700 },
    vehicleLength: 19,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 6000 },
      { distanceRange: { min: 51, max: 60 }, price: 6000 },
      { distanceRange: { min: 61, max: 100 }, price: 10000 },
      { distanceRange: { min: 101, max: 150 }, price: 11200 },
      { distanceRange: { min: 151, max: 200 }, price: 13500 },
      { distanceRange: { min: 201, max: 250 }, price: 14600 },
      { distanceRange: { min: 251, max: 300 }, price: 17200 },
      { distanceRange: { min: 301, max: 350 }, price: 22400 },
      { distanceRange: { min: 351, max: 400 }, price: 22400 },
      { distanceRange: { min: 401, max: 450 }, price: 21500 },
      { distanceRange: { min: 451, max: 500 }, price: 22500 },
      { distanceRange: { min: 501, max: 600 }, price: 33800 },
      { distanceRange: { min: 601, max: 700 }, price: 38100 },
      { distanceRange: { min: 701, max: 800 }, price: 35600 },
      { distanceRange: { min: 801, max: 900 }, price: 43400 },
      { distanceRange: { min: 901, max: 1000 }, price: 35900 },
      { distanceRange: { min: 1001, max: 1200 }, price: 44500 },
      { distanceRange: { min: 1201, max: 1500 }, price: 56400 },
      { distanceRange: { min: 1501, max: 1800 }, price: 47800 },
      { distanceRange: { min: 1801, max: 2000 }, price: 62100 },
      { distanceRange: { min: 2001, max: 2200 }, price: 78300 },
      { distanceRange: { min: 2201, max: 2500 }, price: 86200 },
      { distanceRange: { min: 2501, max: 2600 }, price: 93200 },
      { distanceRange: { min: 2601, max: 2700 }, price: 98200 },
    ],
  },

  // Eicher 20 ft (7001–10000 kg, 0–2700 km)
  {
    vehicleType: "Eicher 20 ft",
    weightRange: { min: 7001, max: 10000 },
    distanceRange: { min: 0, max: 2700 },
    vehicleLength: 20,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 10800 },
      { distanceRange: { min: 51, max: 60 }, price: 10800 },
      { distanceRange: { min: 61, max: 100 }, price: 13300 },
      { distanceRange: { min: 101, max: 150 }, price: 13700 },
      { distanceRange: { min: 151, max: 200 }, price: 18800 },
      { distanceRange: { min: 201, max: 250 }, price: 18100 },
      { distanceRange: { min: 251, max: 300 }, price: 21500 },
      { distanceRange: { min: 301, max: 350 }, price: 27500 },
      { distanceRange: { min: 351, max: 400 }, price: 27500 },
      { distanceRange: { min: 401, max: 450 }, price: 27800 },
      { distanceRange: { min: 451, max: 500 }, price: 32000 },
      { distanceRange: { min: 501, max: 600 }, price: 29100 },
      { distanceRange: { min: 601, max: 700 }, price: 35600 },
      { distanceRange: { min: 701, max: 800 }, price: 42900 },
      { distanceRange: { min: 801, max: 900 }, price: 47000 },
      { distanceRange: { min: 901, max: 1000 }, price: 39100 },
      { distanceRange: { min: 1001, max: 1200 }, price: 62600 },
      { distanceRange: { min: 1201, max: 1500 }, price: 65800 },
      { distanceRange: { min: 1501, max: 1800 }, price: 82900 },
      { distanceRange: { min: 1801, max: 2000 }, price: 72400 },
      { distanceRange: { min: 2001, max: 2200 }, price: 92600 },
      { distanceRange: { min: 2201, max: 2500 }, price: 101200 },
      { distanceRange: { min: 2501, max: 2600 }, price: 106800 },
      { distanceRange: { min: 2601, max: 2700 }, price: 107900 },
    ],
  },

  // Container 32 ft MXL (10001–18000 kg, 0–2700 km)
  {
    vehicleType: "Container 32 ft MXL",
    weightRange: { min: 10001, max: 18000 },
    distanceRange: { min: 0, max: 2700 },
    vehicleLength: 32,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 15400 },
      { distanceRange: { min: 51, max: 60 }, price: 15400 },
      { distanceRange: { min: 61, max: 100 }, price: 25500 },
      { distanceRange: { min: 101, max: 150 }, price: 29100 },
      { distanceRange: { min: 151, max: 200 }, price: 26300 },
      { distanceRange: { min: 201, max: 250 }, price: 32200 },
      { distanceRange: { min: 251, max: 300 }, price: 35800 },
      { distanceRange: { min: 301, max: 350 }, price: 38400 },
      { distanceRange: { min: 351, max: 400 }, price: 40700 },
      { distanceRange: { min: 401, max: 450 }, price: 43500 },
      { distanceRange: { min: 451, max: 500 }, price: 49300 },
      { distanceRange: { min: 501, max: 600 }, price: 57000 },
      { distanceRange: { min: 601, max: 700 }, price: 64400 },
      { distanceRange: { min: 701, max: 800 }, price: 72100 },
      { distanceRange: { min: 801, max: 900 }, price: 86900 },
      { distanceRange: { min: 901, max: 1000 }, price: 68300 },
      { distanceRange: { min: 1001, max: 1200 }, price: 87900 },
      { distanceRange: { min: 1201, max: 1500 }, price: 100300 },
      { distanceRange: { min: 1501, max: 1800 }, price: 113300 },
      { distanceRange: { min: 1801, max: 2000 }, price: 113300 },
      { distanceRange: { min: 2001, max: 2200 }, price: 122600 },
      { distanceRange: { min: 2201, max: 2500 }, price: 134800 },
      { distanceRange: { min: 2501, max: 2600 }, price: 142800 },
      { distanceRange: { min: 2601, max: 2700 }, price: 148400 },
    ],
  },
];

/** Distance API – same call you used inline */
export async function getDistanceKmByAPI(
  fromPin: string,
  toPin: string,
  token?: string
): Promise<number> {
  // Primary: backend vendor endpoint that computes distance via Google API
  try {
    const url1 = `${BASE_URL}/api/vendor/wheelseye-distance`;
    const { data } = await axios.post(url1, { origin: fromPin, destination: toPin });
    const km1 = Number(data?.distanceKm ?? data?.data?.distanceKm ?? 0);
    if (km1 > 0) return km1;
  } catch (e) {
    // fallthrough to secondary
  }

  // Secondary: if backend someday exposes transporter/distance, try it too
  try {
    const url2 = `${BASE_URL}/api/transporter/distance`;
    const { data } = await axios.post(
      url2,
      { fromPincode: fromPin, toPincode: toPin },
      { headers: AUTH_HEADER(token) }
    );
    const km2 = Number(data?.distanceKm ?? data?.data?.distanceKm ?? data?.result?.distanceKm ?? 0);
    if (km2 > 0) return km2;
  } catch (e) {
    // fallthrough to final fallback
  }

  throw new Error("No distance in response");
}

/** Your existing DB-backed Wheelseye price helper */
export async function getWheelseyePriceFromDB(
  chargeableWeight: number,
  distanceKm: number,
  shipment: ShipmentBox[],
  token?: string
): Promise<WheelseyeBreakdown> {
  const url = `${BASE_URL}/api/transporter/wheelseye/price`;
  const { data } = await axios.post(
    url,
    { chargeableWeight, distanceKm, shipment_details: shipment },
    { headers: AUTH_HEADER(token) }
  );
  return data as WheelseyeBreakdown;
}

/**
 * LOCAL FTL pricing lookup from static table
 */
function pickLocalFtlBracket(weight: number, distanceKm: number): LocalFtlBracket | null {
  // Try exact match on weight and distance range first
  let bracket = LOCAL_FTL_PRICE_TABLE.find(
    (b) =>
      weight >= b.weightRange.min &&
      weight <= b.weightRange.max &&
      distanceKm >= b.distanceRange.min &&
      distanceKm <= b.distanceRange.max
  );

  // Fallback: match only on weight, ignore distance envelope
  if (!bracket) {
    bracket = LOCAL_FTL_PRICE_TABLE.find(
      (b) => weight >= b.weightRange.min && weight <= b.weightRange.max
    ) || null;
  }

  // Final fallback: use the lightest available bracket (Tata Ace) if weight is below min
  if (!bracket) {
    bracket = [...LOCAL_FTL_PRICE_TABLE].sort((a, b) => a.weightRange.min - b.weightRange.min)[0] || null;
  }

  return bracket || null;
}

function getLocalFtlPriceFor(weight: number, distanceKm: number): { price: number; vehicleType?: string; vehicleLength?: number | string } {
  // Handle oversized loads by splitting into multiple vehicles (18T max per vehicle)
  if (weight > 18000) {
    const vehicleCount = Math.ceil(weight / 18000);
    let total = 0;
    for (let i = 0; i < vehicleCount; i++) {
      const w = Math.min(18000, weight - i * 18000);
      const { price } = getLocalFtlPriceFor(w, distanceKm);
      total += price;
    }
    return { price: total };
  }

  const bracket = pickLocalFtlBracket(weight, distanceKm);
  if (!bracket) return { price: 0 };

  const priceRow =
    bracket.pricing.find(
      (p) => distanceKm >= p.distanceRange.min && distanceKm <= p.distanceRange.max
    ) ||
    // clamp to nearest (use highest defined if beyond range)
    [...bracket.pricing].sort((a, b) => a.distanceRange.max - b.distanceRange.max).slice(-1)[0];

  return {
    price: priceRow?.price || 0,
    vehicleType: bracket.vehicleType,
    vehicleLength: bracket.vehicleLength,
  };
}

/**
 * End-to-end: computes Local FTL + Wheelseye quotes and returns:
 * { ftlQuote?, wheelseyeQuote?, numbers you want to reuse }
 *
 * This is basically the big block you had, rewritten to be pure(ish).
 */
export async function buildFtlAndWheelseyeQuotes(opts: {
  fromPincode: string;
  toPincode: string;
  shipment: ShipmentBox[];
  totalWeight: number;
  token?: string;
  ekartFallback?: number; // optional fallback price
  isWheelseyeServiceArea: (pin: string) => boolean;
}) {
  const {
    fromPincode,
    toPincode,
    shipment,
    totalWeight,
    token,
    ekartFallback = 32000,
    isWheelseyeServiceArea,
  } = opts;

  let distanceKm = 500;
  try {
    distanceKm = await getDistanceKmByAPI(fromPincode, toPincode, token);
  } catch (e) {
    console.warn("Distance calc failed, using 500km fallback:", e);
  }

  let ftlPrice = 0;
  let wheelseyePrice = 0;
  let wheelseyeResult: WheelseyeBreakdown | null = null;
  let actualWeight = totalWeight;
  let volumetricWeight = totalWeight;
  let chargeableWeight = totalWeight;

  // Compute initial Wheelseye price from static table (acts as baseline)
  // We'll recompute after weightBreakdown with chargeableWeight
  let ftlVehicleType: string | undefined;
  let ftlVehicleLength: number | string | undefined;
  {
    const res = getLocalFtlPriceFor(totalWeight, distanceKm);
    wheelseyePrice = res.price; // Treat table price as Wheelseye price
    ftlVehicleType = res.vehicleType;
    ftlVehicleLength = res.vehicleLength;
    ftlPrice = Math.round((wheelseyePrice * 1.2) / 10) * 10; // LOCAL FTL = +20%
  }

  try {
    wheelseyeResult = await getWheelseyePriceFromDB(
      totalWeight,
      distanceKm,
      shipment,
      token
    );

    const wb = wheelseyeResult?.weightBreakdown;
    actualWeight = wb?.actualWeight ?? totalWeight;
    volumetricWeight = wb?.volumetricWeight ?? totalWeight;
    chargeableWeight = wb?.chargeableWeight ?? Math.max(actualWeight, volumetricWeight);

    // Recompute prices using chargeable weight from breakdown using the static table
    {
      const res = getLocalFtlPriceFor(chargeableWeight, distanceKm);
      wheelseyePrice = res.price; // Table is Wheelseye baseline
      if (chargeableWeight <= 18000) {
        ftlVehicleType = res.vehicleType;
        ftlVehicleLength = res.vehicleLength;
      }
      ftlPrice = Math.round((wheelseyePrice * 1.2) / 10) * 10; // LOCAL FTL = +20%
    }
  } catch (e) {
    console.warn("Wheelseye pricing failed, using fallback:", e);
    // Use table-derived price computed earlier; if zero, use fallback
    if (!wheelseyePrice) {
      wheelseyePrice = Math.round((ekartFallback * 0.95) / 10) * 10;
    }
    ftlPrice = Math.round((wheelseyePrice * 1.2) / 10) * 10;
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
    w > 18000 ? "32 ft + Additional"
    : w <= 1000 ? 7
    : w <= 1500 ? 8
    : w <= 2000 ? 10
    : w <= 4000 ? 14
    : w <= 7000 ? 19
    : w <= 10000 ? 20
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

  const ftlQuote = !tooLight && isWheelseyeServiceArea(fromPincode)
    ? {
        ...base,
        message: "",
        isHidden: false,
        transporterData: { rating: 4.6 },
        companyName: "LOCAL FTL",
        transporterName: "LOCAL FTL",
        category: "LOCAL FTL",
        totalCharges: ftlPrice,
        price: ftlPrice,
        total: ftlPrice,
        totalPrice: ftlPrice,
        estimatedTime: etaDays(distanceKm),
        estimatedDelivery: `${etaDays(distanceKm)} Day${etaDays(distanceKm) > 1 ? "s" : ""}`,
        deliveryTime: `${etaDays(distanceKm)} Day${etaDays(distanceKm) > 1 ? "s" : ""}`,
        vehicle:
          chargeableWeight <= 18000
            ? ftlVehicleType ?? makeVehicleByWeight(chargeableWeight)
            : makeVehicleByWeight(chargeableWeight),
        vehicleLength:
          chargeableWeight <= 18000
            ? ftlVehicleLength ?? makeVehicleLen(chargeableWeight)
            : makeVehicleLen(chargeableWeight),
      }
    : null;

  const wheelseyeQuote = !tooLight && isWheelseyeServiceArea(fromPincode)
    ? {
        ...base,
        message: "",
        isHidden: false,
        transporterData: { rating: 4.6 },
        companyName: "Wheelseye FTL",
        transporterName: "Wheelseye FTL",
        category: "Wheelseye FTL",
        totalCharges: wheelseyePrice,
        price: wheelseyePrice,
        total: wheelseyePrice,
        totalPrice: wheelseyePrice,
        estimatedTime: etaDays(distanceKm),
        estimatedDelivery: `${etaDays(distanceKm)} Day${etaDays(distanceKm) > 1 ? "s" : ""}`,
        deliveryTime: `${etaDays(distanceKm)} Day${etaDays(distanceKm) > 1 ? "s" : ""}`,
        vehicle:
          chargeableWeight <= 18000
            ? ftlVehicleType ?? makeVehicleByWeight(chargeableWeight)
            : makeVehicleByWeight(chargeableWeight),
        vehicleLength:
          chargeableWeight <= 18000
            ? ftlVehicleLength ?? makeVehicleLen(chargeableWeight)
            : makeVehicleLen(chargeableWeight),
        loadSplit: wheelseyeResult?.loadSplit ?? null,
      }
    : null;

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
