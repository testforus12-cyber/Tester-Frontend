// frontend/src/lib/http.ts
import axios from "axios";

function getEnv(name: string): string | undefined {
  // Vite
  try {
    // @ts-ignore
    if (typeof import.meta !== "undefined" && (import.meta as any).env) {
      // @ts-ignore
      const v = (import.meta as any).env[name];
      if (v) return String(v);
    }
  } catch {}
  // CRA / Node (only if it exists — avoids "process is not defined")
  try {
    if (typeof process !== "undefined" && (process as any).env) {
      const v = (process as any).env[name];
      if (v) return String(v);
    }
  } catch {}
  return undefined;
}

const raw =
  getEnv("VITE_API_BASE_URL") ||           // Vite
  getEnv("REACT_APP_URL") ||               // CRA (dev)
  "https://tester-backend-4nxc.onrender.com"; // fallback

// always use https and remove trailing slash
const baseURL = raw.replace(/^http:\/\//i, "https://").replace(/\/$/, "");

export const http = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// helpful during setup
if (typeof window !== "undefined") {
  console.log("[http] baseURL =", http.defaults.baseURL);
}

export default http;
