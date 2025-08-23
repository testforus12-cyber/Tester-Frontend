// frontend/src/lib/vendorApi.ts

// Types for server responses
export interface WheelseyeSlabInfo {
  weightKg: number;
  distanceKm: number;
}

export interface WheelseyePriceResponse {
  vendor: string;              // "Wheelseye FTL"
  mode: "FTL";
  price: number;
  distanceKm: number;
  weightKg: number;
  slab: WheelseyeSlabInfo;
  breakdown: Record<string, number>;
}

export interface WheelseyeDistanceResponse {
  distanceKm: number;
  raw?: unknown;
}

// Resolve API base from (1) explicit param, (2) Vite env, (3) CRA env, (4) localhost
function resolveApiBase(explicit?: string): string {
  if (explicit) return explicit;

  // Vite
  // @ts-ignore
  const viteBase = typeof import.meta !== "undefined"
    ? (import.meta as any).env?.VITE_API_BASE_URL
    : undefined;
  if (viteBase) return String(viteBase);

  // CRA
  // @ts-ignore
  const craBase = typeof process !== "undefined"
    ? (process as any)?.env?.REACT_APP_URL
    : undefined;
  if (craBase) return String(craBase);

  return "http://localhost:8000";
}

// Shared fetch wrapper
async function jsonOrThrow<T>(resp: Response): Promise<T> {
  if (resp.ok) return resp.json() as Promise<T>;
  let msg = `HTTP ${resp.status}`;
  try {
    const j = await resp.json();
    if ((j as any)?.error) msg = (j as any).error;
  } catch {
    // ignore parse errors
  }
  throw new Error(msg);
}

/**
 * Get Wheelseye FTL price from server (client supplies weight & distance).
 * Server path: POST /api/vendor/wheelseye-price
 */
export async function fetchWheelseyePrice(
  weightKg: number,
  distanceKm: number,
  apiBase?: string
): Promise<WheelseyePriceResponse> {
  const base = resolveApiBase(apiBase);
  const resp = await fetch(`${base}/api/vendor/wheelseye-price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weightKg, distanceKm }),
  });
  return jsonOrThrow<WheelseyePriceResponse>(resp);
}

/**
 * (Optional) Ask server to compute distance via Google Distance Matrix.
 * Server path: POST /api/vendor/wheelseye-distance
 */
export async function fetchWheelseyeDistance(
  origin: string,        // e.g., "110020"
  destination: string,   // e.g., "400001"
  apiBase?: string
): Promise<WheelseyeDistanceResponse> {
  const base = resolveApiBase(apiBase);
  const resp = await fetch(`${base}/api/vendor/wheelseye-distance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin, destination }),
  });
  return jsonOrThrow<WheelseyeDistanceResponse>(resp);
}
