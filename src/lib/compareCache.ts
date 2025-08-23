// src/lib/compareCache.ts
// Lightweight compare-page cache with sessionStorage + in-memory Map

type CachedValue = {
  params: any;
  data: any[] | null;
  hiddendata: any[] | null;
  timestamp: number;
  form?: {
    fromPincode: string;
    toPincode: string;
    modeOfTransport: "Road" | "Rail" | "Air" | "Ship";
    boxes: any[];
  };
};

const TTL_MS = 30 * 60 * 1000; // 30 minutes
const PREFIX = "fc:cmp:";
const FORM_KEY = "fc:form";
const LAST_KEY = "fc:last";
const mem = new Map<string, CachedValue>();

function normalize(obj: any): any {
  if (Array.isArray(obj)) return obj.map(normalize);
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, normalize(obj[k])])
    );
  }
  return obj;
}

export function makeCompareKey(params: any): string {
  const normalized = normalize(params);
  const str = JSON.stringify(normalized);
  try {
    return btoa(unescape(encodeURIComponent(str))); // compact key
  } catch {
    return str; // fallback (rare)
  }
}

export function writeCompareCache(
  key: string,
  payload: Omit<CachedValue, "timestamp">
) {
  const value: CachedValue = { ...payload, timestamp: Date.now() };
  mem.set(key, value);
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
    sessionStorage.setItem(LAST_KEY, key);
  } catch {}
}

export function readCompareCacheByKey(key: string): CachedValue | null {
  const now = Date.now();
  const inMem = mem.get(key);
  if (inMem) {
    if (now - inMem.timestamp > TTL_MS) {
      mem.delete(key);
      try {
        sessionStorage.removeItem(PREFIX + key);
      } catch {}
      return null;
    }
    return inMem;
  }
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedValue;
    if (now - parsed.timestamp > TTL_MS) {
      sessionStorage.removeItem(PREFIX + key);
      return null;
    }
    mem.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function readLastKey(): string | null {
  try {
    return sessionStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

export function saveFormState(form: {
  fromPincode: string;
  toPincode: string;
  modeOfTransport: "Road" | "Rail" | "Air" | "Ship";
  boxes: any[];
}) {
  try {
    sessionStorage.setItem(FORM_KEY, JSON.stringify(form));
  } catch {}
}

export function loadFormState():
  | {
      fromPincode: string;
      toPincode: string;
      modeOfTransport: "Road" | "Rail" | "Air" | "Ship";
      boxes: any[];
    }
  | null {
  try {
    const s = sessionStorage.getItem(FORM_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function clearStaleCache() {
  try {
    const now = Date.now();
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)!;
      if (k && k.startsWith(PREFIX)) {
        const raw = sessionStorage.getItem(k);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as CachedValue;
          if (now - parsed.timestamp > TTL_MS) sessionStorage.removeItem(k);
        } catch {}
      }
    }
  } catch {}
}
