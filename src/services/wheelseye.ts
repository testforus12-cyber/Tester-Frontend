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

/** --- Pluggable config (env or constants) --- */
const BASE_URL =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "") ||
  "https://backend-bcxr.onrender.com";
const AUTH_HEADER = (token?: string) =>
  token ? { Authorization: `Bearer ${token}` } : undefined;

/** Distance API – same call you used inline */
export async function getDistanceKmByAPI(
  fromPin: string,
  toPin: string,
  token?: string
): Promise<number> {
  // If your distance endpoint is different, change this impl
  const url = `${BASE_URL}/api/transporter/distance`;
  const { data } = await axios.post(
    url,
    { fromPincode: fromPin, toPincode: toPin },
    { headers: AUTH_HEADER(token) }
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

    if (chargeableWeight > 18000) {
      // split into vehicles, use DB pricing per vehicle if you have that endpoint
      const vehicleCount = Math.ceil(chargeableWeight / 18000);
      let totalWE = 0;
      let totalFTL = 0;

      const calls = Array.from({ length: vehicleCount }, (_, i) => {
        const w = Math.min(18000, chargeableWeight - i * 18000);
        return getWheelseyePriceFromDB(w, distanceKm, [
          { count: 1, length: 100, width: 100, height: 100, weight: w },
        ]).then(
          (r) => ({ ok: true, price: r.price, w }),
          (err) => ({ ok: false, err, w })
        );
      });

      const results = await Promise.all(calls);
      for (const r of results) {
        if (r.ok) {
          totalWE += r.price;
          totalFTL += Math.round((r.price * 1.2) / 10) * 10;
        } else {
          const fb = Math.round(((wheelseyeResult?.price ?? 50000) / vehicleCount));
          totalWE += fb;
          totalFTL += Math.round((fb * 1.2) / 10) * 10;
        }
      }
      wheelseyePrice = totalWE;
      ftlPrice = totalFTL;
      wheelseyeResult = {
        ...wheelseyeResult,
        price: wheelseyePrice,
      };
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
        vehicle: wheelseyeResult?.vehicle ?? makeVehicleByWeight(chargeableWeight),
        vehicleLength: wheelseyeResult?.vehicleLength ?? makeVehicleLen(chargeableWeight),
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
        vehicle: wheelseyeResult?.vehicle ?? makeVehicleByWeight(chargeableWeight),
        vehicleLength: wheelseyeResult?.vehicleLength ?? makeVehicleLen(chargeableWeight),
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
