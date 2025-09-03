// frontend/src/pages/CalculatorPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Boxes,
  Calculator as CalculatorIcon,
  ChevronRight,
  Clock,
  IndianRupee,
  Loader2,
  MapPin,
  Navigation,
  Package,
  PackageSearch,
  Plane,
  PlusCircle,
  Save,
  Star,
  Train,
  Trash2,
  Truck,
  Zap,
  Ship as ShipIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import Cookies from "js-cookie";
import { createPortal } from "react-dom";

import { useAuth } from "../hooks/useAuth";
import {
  makeCompareKey,
  readCompareCacheByKey,
  writeCompareCache,
  loadFormState,
  saveFormState,
  readLastKey,
  clearStaleCache,
} from "../lib/compareCache";

// -----------------------------------------------------------------------------
// Limits
// -----------------------------------------------------------------------------
const MAX_DIMENSION_LENGTH = 1500;
const MAX_DIMENSION_WIDTH = 300;
const MAX_DIMENSION_HEIGHT = 300;
const MAX_BOXES = 10000;
const MAX_WEIGHT = 20000;

// -----------------------------------------------------------------------------
// Numeric helpers
// -----------------------------------------------------------------------------
const digitsOnly = (s: string) => s.replace(/\D/g, "");

const preventNonIntegerKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (
    e.key === "." ||
    e.key === "," ||
    e.key === "e" ||
    e.key === "E" ||
    e.key === "+" ||
    e.key === "-"
  ) {
    e.preventDefault();
  }
};

const sanitizeIntegerFromEvent = (raw: string, max?: number) => {
  const cleaned = digitsOnly(raw);
  if (cleaned === "") return "";
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return "";
  const clamped = typeof max === "number" ? Math.min(n, max) : n;
  return String(clamped);
};

// -----------------------------------------------------------------------------
// Small UI helpers
// -----------------------------------------------------------------------------
const Card = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: "easeOut" }}
    className={`bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-slate-200/80 ${className}`}
  >
    {children}
  </motion.div>
);

const InputField = (
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    icon?: React.ReactNode;
    error?: string | null;
  }
) => (
  <div>
    {props.label && (
      <label
        htmlFor={props.id}
        className="block text-sm font-medium text-slate-600 mb-1.5"
      >
        {props.label}
      </label>
    )}
    <div className="relative">
      {props.icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400">
          {props.icon}
        </div>
      )}
      <input
        {...props}
        aria-invalid={props.error ? "true" : "false"}
        className={`block w-full py-2 bg-white border rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-1 transition ${
          props.icon ? "pl-10" : "px-4"
        } ${
          props.error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
            : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
        }`}
      />
    </div>
    {!!props.error && (
      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
        <AlertCircle size={14} />
        {props.error}
      </p>
    )}
  </div>
);

const SortOptionButton = ({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center justify-center gap-2 flex-1 p-3 rounded-lg text-sm font-semibold transition-all duration-300 border-2 ${
      selected
        ? "bg-indigo-600 border-indigo-600 text-white shadow-md"
        : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300"
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
type QuoteAny = any;

type SavedBox = {
  _id: string;
  name: string;
  originPincode: number;
  destinationPincode: number;
  quantity: number;
  noofboxes: number;
  length: number;
  width: number;
  height: number;
  weight: number;
  modeoftransport: "Road" | "Rail" | "Air" | "Ship";
  description?: string;
};

type BoxDetails = {
  id: string;
  count: number | undefined;
  length: number | undefined;
  width: number | undefined;
  height: number | undefined;
  weight: number | undefined;
  description: string;
};

// -----------------------------------------------------------------------------
// Calculator Page
// -----------------------------------------------------------------------------
const CalculatorPage: React.FC = (): JSX.Element => {
  const { user } = useAuth();
  const token = Cookies.get("authToken");

  // -------------------- UI State --------------------
  const [sortBy, setSortBy] = useState<"price" | "time" | "rating">("price");
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationProgress, setCalculationProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Results
  const [data, setData] = useState<QuoteAny[] | null>(null);
  const [hiddendata, setHiddendata] = useState<QuoteAny[] | null>(null);

  // -------------------- Form State --------------------
  const [modeOfTransport, setModeOfTransport] = useState<
    "Road" | "Rail" | "Air" | "Ship"
  >("Road");
  const [fromPincode, setFromPincode] = useState("");
  const [toPincode, setToPincode] = useState("");

  // Field-level errors for pincode validation
  const [fromPinError, setFromPinError] = useState<string | null>(null);
  const [toPinError, setToPinError] = useState<string | null>(null);

  const [boxes, setBoxes] = useState<BoxDetails[]>([
    {
      id: `box-${Date.now()}-${Math.random()}`,
      count: undefined,
      length: undefined,
      width: undefined,
      height: undefined,
      weight: undefined,
      description: "",
    },
  ]);
  const [calculationTarget, setCalculationTarget] = useState<"all" | number>(
    "all"
  );

  // Presets & dropdowns
  const [savedBoxes, setSavedBoxes] = useState<SavedBox[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [boxIndexToSave, setBoxIndexToSave] = useState<number | null>(null);
  const [openPresetDropdownIndex, setOpenPresetDropdownIndex] =
    useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const presetRefs = useRef<(HTMLDivElement | null)[]>([]);
  const boxFormRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Fine-tune modal
  const [isFineTuneOpen, setIsFineTuneOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState(10_000_000);
  const [maxTime, setMaxTime] = useState(300);
  const [minRating, setMinRating] = useState(0);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  const isAnyDimensionExceeded = useMemo(
    () =>
      boxes.some(
        (box) =>
          (box.length ?? 0) > MAX_DIMENSION_LENGTH ||
          (box.width ?? 0) > MAX_DIMENSION_WIDTH ||
          (box.height ?? 0) > MAX_DIMENSION_HEIGHT ||
          (box.count ?? 0) > MAX_BOXES ||
          (box.weight ?? 0) > MAX_WEIGHT
      ),
    [boxes]
  );

  const totalWeight = boxes.reduce(
    (sum, b) => sum + (b.weight || 0) * (b.count || 0),
    0
  );
  const totalBoxes = boxes.reduce((sum, b) => sum + (b.count || 0), 0);
  const displayableBoxes = savedBoxes.filter((b) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cache for server pin validations
  const pinCacheRef = useRef<Map<string, boolean>>(new Map());

  const hasPincodeIssues =
    !!fromPinError ||
    !!toPinError ||
    fromPincode.length !== 6 ||
    toPincode.length !== 6;

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Autofill Origin Pincode from profile
  useEffect(() => {
    const pin = (user as any)?.customer?.pincode;
    if (pin) setFromPincode(String(pin));
  }, [user]);

  // Restore last form/results
  useEffect(() => {
    clearStaleCache();

    const form = loadFormState();
    if (form) {
      setToPincode(form.toPincode || "");
      setModeOfTransport(form.modeOfTransport || "Road");
      if (Array.isArray(form.boxes) && form.boxes.length) {
        setBoxes(
          form.boxes.map((b: any) => ({
            ...b,
            id: b.id || `box-${Date.now()}-${Math.random()}`,
          }))
        );
      }
    }

    const lastKey = readLastKey();
    if (lastKey) {
      const cached = readCompareCacheByKey(lastKey);
      if (cached) {
        setData(cached.data || null);
        setHiddendata(cached.hiddendata || null);
      }
    }
  }, []);

  // Persist form state
  useEffect(() => {
    saveFormState({
      fromPincode,
      toPincode,
      modeOfTransport,
      boxes,
    });
  }, [fromPincode, toPincode, modeOfTransport, boxes]);

  // Close preset dropdown on outside click
  useEffect(() => {
    const onClickOutside = (ev: MouseEvent) => {
      if (
        openPresetDropdownIndex !== null &&
        presetRefs.current[openPresetDropdownIndex] &&
        !presetRefs.current[openPresetDropdownIndex]!.contains(
          ev.target as Node
        )
      ) {
        setOpenPresetDropdownIndex(null);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [openPresetDropdownIndex]);

  useEffect(() => {
    fetchSavedBoxes();
  }, [user]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const handlePincodeChange = (
    raw: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    clearError?: (msg: string | null) => void
  ) => {
    const digits = digitsOnly(raw).slice(0, 6);
    setter(digits);
    if (clearError) clearError(null); // clear inline error while typing
  };

  // Dimension auto-cap – integers only
  const handleDimensionChange = (
    index: number,
    field: "length" | "width" | "height",
    rawValue: string,
    maxDigits: number,
    _maxValue: number
  ) => {
    const cleaned = digitsOnly(rawValue).slice(0, maxDigits);
    if (cleaned === "") {
      updateBox(index, field, undefined);
      return;
    }
    const n = Number(cleaned);
    const actualMax =
      field === "length"
        ? MAX_DIMENSION_LENGTH
        : field === "width"
        ? MAX_DIMENSION_WIDTH
        : MAX_DIMENSION_HEIGHT;
    updateBox(index, field, n > actualMax ? n : n);
  };

  const createNewBox = (): BoxDetails => ({
    id: `box-${Date.now()}-${Math.random()}`,
    count: undefined,
    length: undefined,
    width: undefined,
    height: undefined,
    weight: undefined,
    description: "",
  });

  const addBoxType = () => setBoxes((prev) => [...prev, createNewBox()]);
  const updateBox = (i: number, field: keyof BoxDetails, v: any) => {
    setBoxes((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], [field]: v };
      return copy;
    });
  };
  const removeBox = (i: number) => {
    if (boxes.length <= 1) return;
    if (window.confirm("Are you sure you want to delete this box type?")) {
      setBoxes(boxes.filter((_, j) => j !== i));
      setCalculationTarget("all");
    }
  };
  const editBox = (index: number) => {
    const el = boxFormRefs.current[index];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Presets
  const fetchSavedBoxes = async () => {
    if (!user || !token) return;
    try {
      const response = await axios.get(
        `https://tester-backend-4nxc.onrender.com/api/transporter/getpackinglist?customerId=${
          (user as any).customer._id
        }`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSavedBoxes(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (err) {
      console.error("Failed to fetch saved boxes:", err);
    }
  };

  const triggerSavePresetForBox = (index: number) => {
    const boxToSave = boxes[index];
    if (
      !boxToSave.length ||
      !boxToSave.width ||
      !boxToSave.height ||
      !boxToSave.weight
    ) {
      setError(
        "Please fill in all dimensions and weight for the box before saving."
      );
      editBox(index);
      return;
    }
    setError(null);
    setBoxIndexToSave(index);
    setIsModalOpen(true);
  };

  const handleSavePreset = async (presetName: string) => {
    if (boxIndexToSave === null || !user || !token) {
      setError("An error occurred. Please try again.");
      return;
    }
    if (
      !fromPincode ||
      fromPincode.length !== 6 ||
      !toPincode ||
      toPincode.length !== 6
    ) {
      setError(
        "Please enter valid 6-digit Origin and Destination pincodes before saving a preset."
      );
      setIsModalOpen(false);
      setBoxIndexToSave(null);
      return;
    }
    const boxToSave = boxes[boxIndexToSave];
    const payload = {
      name: presetName,
      description: presetName,
      customerId: (user as any).customer._id,
      originPincode: Number(fromPincode),
      destinationPincode: Number(toPincode),
      length: boxToSave.length!,
      width: boxToSave.width!,
      height: boxToSave.height!,
      weight: boxToSave.weight!,
      modeoftransport: modeOfTransport,
      noofboxes: boxToSave.count || 1,
      quantity: boxToSave.count || 1,
    };
    try {
      await axios.post(
        `https://tester-backend-4nxc.onrender.com/api/transporter/savepackinglist`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsModalOpen(false);
      setBoxIndexToSave(null);
      await fetchSavedBoxes();
    } catch (err: any) {
      console.error("Failed to save preset:", err);
      setError(
        `Could not save preset: ${err.response?.data?.message || err.message}`
      );
    }
  };

  const handleDeletePreset = async (
    presetId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (window.confirm("Delete this preset permanently?")) {
      try {
        await axios.delete(
          `https://tester-backend-4nxc.onrender.com/api/transporter/deletepackinglist/${presetId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        await fetchSavedBoxes();
      } catch (err: any) {
        console.error("Failed to delete preset:", err);
        setError(
          `Could not delete preset: ${
            err.response?.data?.message || err.message
          }`
        );
      }
    }
  };

  const handleSelectPresetForBox = (index: number, boxPreset: SavedBox) => {
    const updated = [...boxes];
    updated[index] = {
      ...updated[index],
      length: boxPreset.length,
      width: boxPreset.width,
      height: boxPreset.height,
      weight: boxPreset.weight,
      description: boxPreset.name,
    };
    setBoxes(updated);

    if (index === 0) {
      setFromPincode(boxPreset.originPincode.toString());
      setModeOfTransport(boxPreset.modeoftransport);
    }
    setOpenPresetDropdownIndex(null);
    setSearchTerm("");
  };

  // Distance via backend wrapper
  async function getDistanceKmByAPI(originPin: string, destPin: string) {
    const apiBase =
      import.meta.env.VITE_API_BASE_URL || "https://tester-backend-4nxc.onrender.com";
    const resp = await fetch(`${apiBase}/api/vendor/wheelseye-distance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: `${originPin},IN`,
        destination: `${destPin},IN`,
      }),
    });
    if (!resp.ok) throw new Error(`DM HTTP ${resp.status}`);
    const j = await resp.json();
    return Number(j.distanceKm);
  }

  // Get Wheelseye pricing from database API
  async function getWheelseyePriceFromDB(
    weight: number,
    distance: number,
    shipmentDetails?: any[]
  ) {
    try {
      const apiBase =
        import.meta.env.VITE_API_BASE_URL || "https://tester-backend-4nxc.onrender.com";
      const requestBody: any = {
        distance: distance,
      };

      if (shipmentDetails && shipmentDetails.length > 0) {
        requestBody.shipment_details = shipmentDetails;
      } else {
        requestBody.weight = weight;
      }

      const resp = await fetch(`${apiBase}/api/vendor/wheelseye-pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!resp.ok) {
        throw new Error(`Wheelseye API HTTP ${resp.status}`);
      }

      const result = await resp.json();
      return result;
    } catch (error) {
      console.error("Error fetching Wheelseye pricing from database:", error);
      throw error;
    }
  }

  // -------------------- Pincode validation --------------------

  // quick format-only check
  const validatePincodeFormat = (pin: string): string | null => {
    if (!pin) return "Pincode is required.";
    if (!/^\d{6}$/.test(pin)) return "Enter a 6-digit pincode.";
    if (!/^[1-9]\d{5}$/.test(pin)) return "Pincode cannot start with 0.";
    return null;
  };

  // best-effort coercion from various API shapes
  const coerceBoolean = (v: any): boolean | null => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1;
    if (typeof v === "string") {
      const s = v.toLowerCase().trim();
      if (["true", "1", "yes", "valid", "ok", "success"].includes(s)) return true;
      if (["false", "0", "no", "invalid"].includes(s)) return false;
    }
    return null;
  };

  // Call backend; return true (valid), false (explicitly invalid), or null (unknown/error)
  async function validatePincodeServer(pincode: string): Promise<boolean | null> {
    // cache first
    if (pinCacheRef.current.has(pincode)) {
      return pinCacheRef.current.get(pincode)!;
    }
    try {
      const headers =
        token ? { Authorization: `Bearer ${token}` } : undefined; // don't send Bearer undefined
      const response = await axios.post(
        "https://tester-backend-4nxc.onrender.com/api/transporter/validate-pincode",
        { pincode },
        { headers }
      );

      // try common keys
      const payload: any = response?.data ?? {};
      const keys = [
        "isValid",
        "valid",
        "exists",
        "exist",
        "isServiceable",
        "serviceable",
        "ok",
        "success",
      ];

      for (const k of keys) {
        const coerced = coerceBoolean(payload?.[k]);
        if (coerced !== null) {
          pinCacheRef.current.set(pincode, coerced);
          return coerced;
        }
        // nested spots
        const nested = coerceBoolean(payload?.data?.[k] ?? payload?.result?.[k]);
        if (nested !== null) {
          pinCacheRef.current.set(pincode, nested);
          return nested;
        }
      }

      // as a last resort, if backend returned 2xx without an explicit "false",
      // treat as valid to avoid false negatives
      pinCacheRef.current.set(pincode, true);
      return true;
    } catch (error: any) {
      // network/401/cors/etc — treat as unknown, don't block or show red
      console.warn("validate-pincode failed (non-blocking):", error?.message || error);
      return null;
    }
  }

  // Validate a single field (format + server check)
  const validatePincodeField = async (which: "from" | "to") => {
    const pin = which === "from" ? fromPincode : toPincode;
    const setErr = which === "from" ? setFromPinError : setToPinError;

    // format first
    const msg = validatePincodeFormat(pin);
    if (msg) {
      setErr(msg);
      return false;
    }

    // server check (non-blocking on errors)
    const verdict = await validatePincodeServer(pin);
    if (verdict === false) {
      setErr("Unknown or non-serviceable pincode.");
      return false;
    }

    // clear error for valid or unknown
    setErr(null);
    return true;
  };

  // -------------------- Calculate Quotes (with CACHE) --------------------
  const calculateQuotes = async () => {
    setError(null);
    setData(null);
    setHiddendata(null);

    // Final gate: require format correctness; use server only if it explicitly returns false
    const [okFrom, okTo] = await Promise.all([
      validatePincodeField("from"),
      validatePincodeField("to"),
    ]);
    if (!okFrom || !okTo) {
      if (!okFrom && !okTo)
        setError("Origin and Destination pincodes are invalid.");
      else if (!okFrom) setError("Origin pincode is invalid.");
      else setError("Destination pincode is invalid.");
      return;
    }

    const boxesToCalc =
      calculationTarget === "all" ? boxes : [boxes[calculationTarget]];

    const shipmentPayload: any[] = [];
    for (const box of boxesToCalc) {
      if (
        !box.count ||
        !box.length ||
        !box.width ||
        !box.height ||
        !box.weight
      ) {
        const name = box.description || `Box Type ${boxes.indexOf(box) + 1}`;
        setError(`Please fill in all details for "${name}".`);
        return;
      }
      shipmentPayload.push({
        count: box.count,
        length: box.length,
        width: box.width,
        height: box.height,
        weight: box.weight,
      });
    }

    const requestParams = {
      modeoftransport: modeOfTransport,
      fromPincode,
      toPincode,
      shipment_details: shipmentPayload,
    };
    const cacheKey = makeCompareKey(requestParams);

    setIsCalculating(true);
    setCalculationProgress("Fetching quotes from vendors...");

    try {
      const resp = await axios.post(
        "https://tester-backend-4nxc.onrender.com/api/transporter/calculate",
        {
          customerID: (user as any).customer._id,
          userogpincode: (user as any).customer.pincode,
          modeoftransport: modeOfTransport,
          fromPincode,
          toPincode,
          shipment_details: shipmentPayload,
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );

      const all: QuoteAny[] = [
        ...(resp.data.tiedUpResult || []).map((q: QuoteAny) => ({
          ...q,
          isTiedUp: true,
        })),
        ...(resp.data.companyResult || []).map((q: QuoteAny) => ({
          ...q,
          isTiedUp: false,
        })),
      ];

      const dpWorldQuotes = all.filter((q) => q.companyName === "DP World");
      const nonDpWorldQuotes = all.filter(
        (q) => q.companyName !== "DP World"
      );

      const cheapestDPWorld =
        dpWorldQuotes.length > 0
          ? dpWorldQuotes.reduce((cheapest, current) =>
              current.totalCharges < cheapest.totalCharges
                ? current
                : cheapest
            )
          : null;

      let tied = [
        ...nonDpWorldQuotes.filter((q) => q.isTiedUp),
        ...(cheapestDPWorld ? [{ ...cheapestDPWorld, isTiedUp: true }] : []),
      ];

      let others = [...nonDpWorldQuotes.filter((q) => !q.isTiedUp)];

      // ---------- Inject FTL + Wheelseye FTL ----------
      let distanceKm = 500; // fallback
      try {
        distanceKm = await getDistanceKmByAPI(fromPincode, toPincode);
      } catch (e) {
        console.warn("Distance calculation failed, using default:", e);
      }

      const isWheelseyeAvailable = true;
      const isLocalFTLAvailable = true;

      let ftlPrice = 0;
      let wheelseyePrice = 0;
      let wheelseyeResult: any = null;

      try {
        wheelseyeResult = await getWheelseyePriceFromDB(
          totalWeight,
          distanceKm,
          shipmentPayload
        );

        wheelseyePrice = wheelseyeResult.price;
        ftlPrice = Math.round((wheelseyePrice * 1.2) / 10) * 10; // 20% more than Wheelseye
      } catch (e) {
        console.warn("Wheelseye pricing failed, using fallback:", e);
        const referenceQuote = others.find((q) => q.companyName === "Ekart");
        const referencePrice = referenceQuote?.totalCharges || 32000;
        ftlPrice = Math.round((referencePrice * 1.1) / 10) * 10;
        wheelseyePrice = Math.round((referencePrice * 0.95) / 10) * 10;
      }

      const weightBreakdown = wheelseyeResult?.weightBreakdown;
      const actualWeight = weightBreakdown?.actualWeight || totalWeight;
      const volumetricWeight =
        weightBreakdown?.volumetricWeight || totalWeight;
      const chargeableWeight =
        weightBreakdown?.chargeableWeight || totalWeight;

      const ftlEstimatedTime = Math.ceil(distanceKm / 400);
      const ftlQuote = {
        message: "",
        isHidden: false,
        transporterData: { rating: 4.6 },
        totalCharges: ftlPrice,
        estimatedDelivery: `${ftlEstimatedTime} Day${
          ftlEstimatedTime > 1 ? "s" : ""
        }`,
        companyName: "LOCAL FTL",
        price: ftlPrice,
        transporterName: "LOCAL FTL",
        deliveryTime: `${ftlEstimatedTime} Day${
          ftlEstimatedTime > 1 ? "s" : ""
        }`,
        estimatedTime: ftlEstimatedTime,
        actualWeight,
        volumetricWeight,
        chargeableWeight,
        total: ftlPrice,
        totalPrice: ftlPrice,
        distance: `${distanceKm} km`,
        originPincode: fromPincode,
        destinationPincode: toPincode,
        category: "LOCAL FTL",
        isTiedUp: false,
        vehicle:
          wheelseyeResult?.vehicle ||
          (chargeableWeight > 18000
            ? "Container 32 ft MXL + Additional Vehicle"
            : "FTL Vehicle"),
        vehicleLength:
          wheelseyeResult?.vehicleLength ||
          (chargeableWeight > 18000 ? "32 ft + Additional" : 14),
        matchedWeight: wheelseyeResult?.matchedWeight || chargeableWeight,
        matchedDistance: wheelseyeResult?.matchedDistance || distanceKm,
        loadSplit:
          wheelseyeResult?.loadSplit ||
          (chargeableWeight > 18000
            ? {
                vehiclesNeeded:
                  wheelseyeResult?.vehicleCalculation?.totalVehiclesRequired ||
                  Math.ceil(chargeableWeight / 18000),
                firstVehicle: {
                  vehicle: "Container 32 ft MXL",
                  weight: 18000,
                  price: Math.round(ftlPrice * 0.7),
                  vehicleLength: 32,
                },
                secondVehicle: {
                  vehicle:
                    chargeableWeight - 18000 <= 1000
                      ? "Tata Ace"
                      : chargeableWeight - 18000 <= 1500
                      ? "Pickup"
                      : chargeableWeight - 18000 <= 2000
                      ? "10 ft Truck"
                      : chargeableWeight - 18000 <= 4000
                      ? "Eicher 14 ft"
                      : chargeableWeight - 18000 <= 7000
                      ? "Eicher 19 ft"
                      : chargeableWeight - 18000 <= 10000
                      ? "Eicher 20 ft"
                      : "Container 32 ft MXL",
                  weight: chargeableWeight - 18000,
                  price: Math.round(ftlPrice * 0.3),
                  vehicleLength:
                    chargeableWeight - 18000 <= 1000
                      ? 7
                      : chargeableWeight - 18000 <= 1500
                      ? 8
                      : chargeableWeight - 18000 <= 2000
                      ? 10
                      : chargeableWeight - 18000 <= 4000
                      ? 14
                      : chargeableWeight - 18000 <= 7000
                      ? 19
                      : chargeableWeight - 18000 <= 10000
                      ? 20
                      : 32,
                },
                totalPrice: ftlPrice,
                vehicleCalculation: wheelseyeResult?.vehicleCalculation,
              }
            : null),
      };

      if (isLocalFTLAvailable) {
        others.unshift(ftlQuote);
      }

      if (isWheelseyeAvailable) {
        const wheelseyeEstimatedTime = Math.ceil(distanceKm / 400);
        const wheelseyeQuote = {
          message: "",
          isHidden: false,
          transporterData: { rating: 4.6 },
          totalCharges: wheelseyePrice,
          estimatedDelivery: `${wheelseyeEstimatedTime} Day${
            wheelseyeEstimatedTime > 1 ? "s" : ""
          }`,
          companyName: "Wheelseye FTL",
          price: wheelseyePrice,
          transporterName: "Wheelseye FTL",
          deliveryTime: `${wheelseyeEstimatedTime} Day${
            wheelseyeEstimatedTime > 1 ? "s" : ""
          }`,
          estimatedTime: wheelseyeEstimatedTime,
          actualWeight,
          volumetricWeight,
          chargeableWeight,
          total: wheelseyePrice,
          totalPrice: wheelseyePrice,
          distance: `${distanceKm} km`,
          originPincode: fromPincode,
          destinationPincode: toPincode,
          category: "Wheelseye FTL",
          isTiedUp: false,
          vehicle:
            wheelseyeResult?.vehicle ||
            (chargeableWeight > 18000
              ? "Container 32 ft MXL + Additional Vehicle"
              : chargeableWeight <= 1000
              ? "Tata Ace"
              : chargeableWeight <= 1200
              ? "Pickup"
              : chargeableWeight <= 1500
              ? "10 ft Truck"
              : chargeableWeight <= 4000
              ? "Eicher 14 ft"
              : chargeableWeight <= 7000
              ? "Eicher 19 ft"
              : chargeableWeight <= 10000
              ? "Eicher 20 ft"
              : chargeableWeight <= 18000
              ? "Container 32 ft MXL"
              : "Container 32 ft MXL"),
          vehicleLength:
            wheelseyeResult?.vehicleLength ||
            (chargeableWeight > 18000
              ? "32 ft + Additional"
              : chargeableWeight <= 1000
              ? 7
              : chargeableWeight <= 1200
              ? 8
              : chargeableWeight <= 1500
              ? 10
              : chargeableWeight <= 4000
              ? 14
              : chargeableWeight <= 7000
              ? 19
              : chargeableWeight <= 10000
              ? 20
              : chargeableWeight <= 18000
              ? 32
              : 32),
          matchedWeight: wheelseyeResult?.matchedWeight || chargeableWeight,
          matchedDistance: wheelseyeResult?.matchedDistance || distanceKm,
          loadSplit:
            wheelseyeResult?.loadSplit ||
            (chargeableWeight > 18000
              ? {
                  vehiclesNeeded:
                    wheelseyeResult?.vehicleCalculation?.totalVehiclesRequired ||
                    Math.ceil(chargeableWeight / 18000),
                  firstVehicle: {
                    vehicle: "Container 32 ft MXL",
                    weight: 18000,
                    price: Math.round(wheelseyePrice * 0.7),
                    vehicleLength: 32,
                  },
                  secondVehicle: {
                    vehicle:
                      chargeableWeight - 18000 <= 1000
                        ? "Tata Ace"
                        : chargeableWeight - 18000 <= 1500
                        ? "Pickup"
                        : chargeableWeight - 18000 <= 2000
                        ? "10 ft Truck"
                        : chargeableWeight - 18000 <= 4000
                        ? "Eicher 14 ft"
                        : chargeableWeight - 18000 <= 7000
                        ? "Eicher 19 ft"
                        : chargeableWeight - 18000 <= 10000
                        ? "Eicher 20 ft"
                        : "Container 32 ft MXL",
                    weight: chargeableWeight - 18000,
                    price: Math.round(wheelseyePrice * 0.3),
                    vehicleLength:
                      chargeableWeight - 18000 <= 1000
                        ? 7
                        : chargeableWeight - 18000 <= 1500
                        ? 8
                        : chargeableWeight - 18000 <= 2000
                        ? 10
                        : chargeableWeight - 18000 <= 4000
                        ? 14
                        : chargeableWeight - 18000 <= 7000
                        ? 19
                        : chargeableWeight - 18000 <= 10000
                        ? 20
                        : 32,
                  },
                  totalPrice: wheelseyePrice,
                  vehicleCalculation: wheelseyeResult?.vehicleCalculation,
                }
              : null),
        };

        // Put Wheelseye just after FTL
        others.unshift(wheelseyeQuote);
      }

      // Multiply tied-up vendor prices by 5.0 (kept as-is)
      tied.forEach((quote) => {
        if (quote.companyName === "DP World") return;
        quote.totalCharges = Math.round((quote.totalCharges * 5.0) / 10) * 10;
        quote.price = Math.round((quote.price * 5.0) / 10) * 10;
        quote.total = Math.round((quote.total * 5.0) / 10) * 10;
        quote.totalPrice = Math.round((quote.totalPrice * 5.0) / 10) * 10;

        if (quote.baseFreight)
          quote.baseFreight = Math.round((quote.baseFreight * 5.0) / 10) * 10;
        if (quote.docketCharge)
          quote.docketCharge =
            Math.round((quote.docketCharge * 5.0) / 10) * 10;
        if (quote.fuelCharges)
          quote.fuelCharges = Math.round((quote.fuelCharges * 5.0) / 10) * 10;
        if (quote.handlingCharges)
          quote.handlingCharges =
            Math.round((quote.handlingCharges * 5.0) / 10) * 10;
        if (quote.greenTax)
          quote.greenTax = Math.round((quote.greenTax * 5.0) / 10) * 10;
        if (quote.appointmentCharges)
          quote.appointmentCharges =
            Math.round((quote.appointmentCharges * 5.0) / 10) * 10;
        if (quote.minCharges)
          quote.minCharges = Math.round((quote.minCharges * 5.0) / 10) * 10;
        if (quote.rovCharges)
          quote.rovCharges = Math.round((quote.rovCharges * 5.0) / 10) * 10;
      });

      if (
        isLocalFTLAvailable &&
        !others.find((q) => q.companyName === "LOCAL FTL")
      ) {
        const emergencyFtlQuote = {
          message: "",
          isHidden: false,
          transporterData: { rating: 4.6 },
          totalCharges: 35000,
          estimatedDelivery: "2 Days",
          companyName: "LOCAL FTL",
          price: 35000,
          transporterName: "LOCAL FTL",
          deliveryTime: "2 Days",
          estimatedTime: 2,
          actualWeight: totalWeight,
          volumetricWeight: totalWeight,
          chargeableWeight: totalWeight,
          total: 35000,
          totalPrice: 35000,
          distance: `${distanceKm} km`,
          originPincode: fromPincode,
          destinationPincode: toPincode,
          category: "LOCAL FTL",
          isTiedUp: false,
          vehicle: "FTL Vehicle",
          vehicleLength: 14,
          matchedWeight: totalWeight,
          matchedDistance: distanceKm,
          loadSplit: null,
        };
        others.unshift(emergencyFtlQuote);
      }

      setData(tied);
      setHiddendata(others);

      writeCompareCache(cacheKey, {
        params: requestParams,
        data: tied,
        hiddendata: others,
        form: { fromPincode, toPincode, modeOfTransport, boxes },
      });
    } catch (e: any) {
      if (e.response?.status === 401) {
        setError("Authentication failed. Please log out and log back in.");
      } else {
        setError(`Failed to get rates. Error: ${e.message}`);
      }
    }

    setCalculationProgress("");
    setIsCalculating(false);
    setTimeout(() => {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // -------------------- Render --------------------
  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans">
      <div
        className="absolute top-0 left-0 w-full h-80 bg-gradient-to-br from-indigo-50 to-purple-50"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 65%, 0% 100%)" }}
      />
      <div className="relative max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        <header className="text-center py-8">
          <motion.h1
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight"
          >
            Freight Rate Calculator
          </motion.h1>
          <motion.p
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto"
          >
            Instantly compare quotes from multiple vendors to find the best rate
            for your shipment.
          </motion.p>
        </header>

        {/* Mode & Route */}
        <Card>
          <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center">
            <Navigation size={22} className="mr-3 text-indigo-500" /> Mode & Route
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Select your mode of transport and enter the pickup and destination pincodes.
          </p>

          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { name: "Road", icon: Truck, isAvailable: true },
                { name: "Rail", icon: Train, isAvailable: false },
                { name: "Air", icon: Plane, isAvailable: false },
                { name: "Ship", icon: ShipIcon, isAvailable: false },
              ].map((mode) => (
                <button
                  key={mode.name}
                  onClick={() =>
                    mode.isAvailable ? setModeOfTransport(mode.name as any) : null
                  }
                  className={`relative group w-full p-4 rounded-xl transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 focus-visible:ring-indigo-500 ${
                    modeOfTransport === mode.name
                      ? "bg-indigo-600 text-white shadow-lg"
                      : mode.isAvailable
                      ? "bg-white text-slate-700 border border-slate-300 hover:border-indigo-500 hover:text-indigo-600"
                      : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                  }`}
                  disabled={!mode.isAvailable}
                >
                  <div
                    className={`flex flex-col items-center justify-center gap-2 transition-all duration-300 ${
                      !mode.isAvailable && "opacity-50"
                    }`}
                  >
                    <mode.icon size={24} className="mx-auto" />
                    <span className="text-sm font-semibold">{mode.name}</span>
                  </div>
                  {!mode.isAvailable && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-800/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-[2px]">
                      <span className="text-xs font-bold text-white uppercase tracking-wider bg-slate-800/70 px-3 py-1 rounded-full">
                        Coming Soon
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <InputField
                label="Origin Pincode"
                id="fromPincode"
                value={fromPincode}
                placeholder="e.g., 400001"
                maxLength={6}
                icon={<MapPin />}
                inputMode="numeric"
                pattern="\d{6}"
                error={fromPinError}
                onChange={(e) =>
                  handlePincodeChange(e.target.value, setFromPincode, setFromPinError)
                }
                onBlur={() => validatePincodeField("from")}
              />
              <InputField
                label="Destination Pincode"
                id="toPincode"
                value={toPincode}
                placeholder="e.g., 110001"
                maxLength={6}
                icon={<MapPin />}
                inputMode="numeric"
                pattern="\d{6}"
                error={toPinError}
                onChange={(e) =>
                  handlePincodeChange(e.target.value, setToPincode, setToPinError)
                }
                onBlur={() => validatePincodeField("to")}
              />
            </div>
          </div>
        </Card>

        {/* Shipment Details */}
        <Card>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Boxes size={22} className="text-indigo-500" /> Shipment Details
            </h2>
            <p className="text-sm text-slate-500">
              Enter dimensions and weight, or select a saved preset to auto-fill.
            </p>
          </div>

          <div className="space-y-6">
            <AnimatePresence>
              {boxes.map((box, index) => (
                <motion.div
                  key={box.id}
                  layout
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -50, scale: 0.9 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="p-5 bg-slate-50 border border-slate-200 rounded-xl relative"
                  ref={(el) => (boxFormRefs.current[index] = el)}
                >
                  <button
                    onClick={() => {
                      if (boxes.length > 1) removeBox(index);
                      else setBoxes([createNewBox()]);
                    }}
                    title={boxes.length > 1 ? "Remove this box type" : "Clear all fields"}
                    className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-100 rounded-full transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Preset selector */}
                    <div
                      className="relative text-sm"
                      ref={(el) => {
                        if (el) presetRefs.current[index] = el;
                      }}
                    >
                      <InputField
                        label="Box Name"
                        id={`preset-${index}`}
                        placeholder="Select or type to search..."
                        value={
                          box.description ||
                          (openPresetDropdownIndex === index ? searchTerm : "")
                        }
                        onChange={(e) => {
                          updateBox(index, "description", e.target.value);
                          setSearchTerm(e.target.value);
                        }}
                        onFocus={() => {
                          setOpenPresetDropdownIndex(index);
                          setSearchTerm("");
                        }}
                        icon={<PackageSearch size={16} />}
                        className="text-sm"
                        autoComplete="off"
                        required
                      />
                      <AnimatePresence>
                        {openPresetDropdownIndex === index && (
                          <motion.ul
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-50 w-full mt-1 border border-slate-200 rounded-lg max-h-48 overflow-y-auto bg-white shadow-lg"
                          >
                            {displayableBoxes.length > 0 ? (
                              displayableBoxes.map((preset) => (
                                <li
                                  key={preset._id}
                                  onClick={() => handleSelectPresetForBox(index, preset)}
                                  className="group flex justify-between items-center px-3 py-2 hover:bg-indigo-50 cursor-pointer text-slate-700 text-sm transition-colors"
                                >
                                  <span>{preset.name}</span>
                                  <button
                                    onClick={(e) => handleDeletePreset(preset._id, e)}
                                    className="p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:!opacity-100 hover:text-red-600 hover:bg-red-100 rounded-full transition-all duration-200"
                                    title={`Delete "${preset.name}"`}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </li>
                              ))
                            ) : (
                              <li className="px-4 py-2 italic text-sm text-slate-500">
                                {savedBoxes.length === 0
                                  ? "No presets saved yet."
                                  : "No matches found."}
                              </li>
                            )}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </div>

                    <div>
                      <InputField
                        label="Number of Boxes"
                        id={`count-${index}`}
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={5}
                        value={box.count ?? ""}
                        onKeyDown={preventNonIntegerKeys}
                        onChange={(e) => {
                          const next = sanitizeIntegerFromEvent(e.target.value);
                          if (next === "") updateBox(index, "count", undefined);
                          else if (Number(next) <= MAX_BOXES) updateBox(index, "count", Number(next));
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasted = (e.clipboardData || (window as any).clipboardData).getData("text");
                          const next = sanitizeIntegerFromEvent(pasted);
                          if (next === "" || Number(next) > MAX_BOXES) return;
                          updateBox(index, "count", Number(next));
                        }}
                        placeholder="e.g., 10"
                        required
                      />
                      {(box.count ?? 0) > MAX_BOXES && (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle size={14} />
                          Max boxes is {MAX_BOXES}.
                        </p>
                      )}
                    </div>

                    <div>
                      <InputField
                        label="Weight (kg)"
                        id={`weight-${index}`}
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={5}
                        value={box.weight ?? ""}
                        onKeyDown={preventNonIntegerKeys}
                        onChange={(e) => {
                          const next = sanitizeIntegerFromEvent(e.target.value);
                          if (next === "") updateBox(index, "weight", undefined);
                          else if (Number(next) <= MAX_WEIGHT) updateBox(index, "weight", Number(next));
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasted = (e.clipboardData || (window as any).clipboardData).getData("text");
                          const next = sanitizeIntegerFromEvent(pasted);
                          if (next === "" || Number(next) > MAX_WEIGHT) return;
                          updateBox(index, "weight", Number(next));
                        }}
                        placeholder="e.g., 5"
                        required
                      />
                      {(box.weight ?? 0) > MAX_WEIGHT && (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle size={14} />
                          Max weight is {MAX_WEIGHT} kg.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Dimensions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <InputField
                        label="Length (cm)"
                        id={`length-${index}`}
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        value={box.length ?? ""}
                        onKeyDown={preventNonIntegerKeys}
                        onChange={(e) =>
                          handleDimensionChange(
                            index,
                            "length",
                            e.target.value,
                            4,
                            9999
                          )
                        }
                        placeholder="Length"
                        required
                      />
                      {(box.length ?? 0) > MAX_DIMENSION_LENGTH && (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle size={14} />
                          Max length is {MAX_DIMENSION_LENGTH} cm.
                        </p>
                      )}
                    </div>

                    <div>
                      <InputField
                        label="Width (cm)"
                        id={`width-${index}`}
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        value={box.width ?? ""}
                        onKeyDown={preventNonIntegerKeys}
                        onChange={(e) =>
                          handleDimensionChange(
                            index,
                            "width",
                            e.target.value,
                            3,
                            999
                          )
                        }
                        placeholder="Width"
                        required
                      />
                      {(box.width ?? 0) > MAX_DIMENSION_WIDTH && (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle size={14} />
                          Max width is {MAX_DIMENSION_WIDTH} cm.
                        </p>
                      )}
                    </div>

                    <div>
                      <InputField
                        label="Height (cm)"
                        id={`height-${index}`}
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        value={box.height ?? ""}
                        onKeyDown={preventNonIntegerKeys}
                        onChange={(e) =>
                          handleDimensionChange(
                            index,
                            "height",
                            e.target.value,
                            3,
                            999
                          )
                        }
                        placeholder="Height"
                        required
                      />
                      {(box.height ?? 0) > MAX_DIMENSION_HEIGHT && (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle size={14} />
                          Max height is {MAX_DIMENSION_HEIGHT} cm.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => triggerSavePresetForBox(index)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-lg hover:bg-indigo-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500"
                      title="Save this box configuration as a new preset"
                    >
                      <Save size={14} />
                      Save as Preset
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            <div className="flex justify-between items-center pt-6 border-t border-slate-200">
              <button
                onClick={addBoxType}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200 transition-colors"
              >
                <PlusCircle size={18} /> Add Another Box Type
              </button>

              {totalWeight > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-right"
                >
                  <p className="text-sm font-medium text-slate-500">Total Weight</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {totalWeight.toFixed(2)}
                    <span className="text-base font-semibold text-slate-600 ml-1">
                      kg
                    </span>
                  </p>
                </motion.div>
              )}
            </div>

            <div className="text-center pt-6 mt-6 border-t border-slate-200">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-3 bg-red-100 text-red-800 font-semibold px-4 py-3 rounded-xl mb-6 shadow-sm"
                >
                  <AlertCircle size={20} />
                  {error}
                </motion.div>
              )}
              {isAnyDimensionExceeded && !error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-3 bg-yellow-100 text-yellow-800 font-semibold px-4 py-3 rounded-xl mb-6 shadow-sm"
                >
                  <AlertCircle size={20} />
                  One or more box dimensions exceed the allowed limit. Please correct
                  them to proceed.
                </motion.div>
              )}
              <motion.button
                onClick={calculateQuotes}
                disabled={isCalculating || isAnyDimensionExceeded || hasPincodeIssues}
                whileHover={{
                  scale: isCalculating || isAnyDimensionExceeded || hasPincodeIssues ? 1 : 1.05,
                }}
                whileTap={{
                  scale: isCalculating || isAnyDimensionExceeded || hasPincodeIssues ? 1 : 0.95,
                }}
                className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 text-white text-lg font-bold rounded-full shadow-lg shadow-indigo-500/50 hover:bg-indigo-700 transition-all duration-300 disabled:opacity-60 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {isCalculating ? <Loader2 className="animate-spin" /> : <CalculatorIcon />}
                {isCalculating
                  ? calculationProgress || "Calculating Rates..."
                  : "Calculate Freight Cost"}
              </motion.button>
            </div>
          </div>
        </Card>

        {/* Summary */}
        {totalBoxes > 0 && (
          <Card>
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Package size={22} className="mr-3 text-indigo-500" /> Shipment Summary
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600">
                <thead className="text-xs text-slate-700 uppercase bg-slate-100 rounded-t-lg">
                  <tr>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Total Weight</th>
                    <th className="px-4 py-3">Volume (cm³)</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  <AnimatePresence>
                    {boxes.map((box, index) => {
                      const qty = box.count || 0;
                      const totalW = ((box.weight || 0) * qty).toFixed(2);
                      const totalV = (
                        (box.length || 0) *
                        (box.width || 0) *
                        (box.height || 0) *
                        qty
                      ).toLocaleString();

                      return (
                        <motion.tr
                          key={box.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, x: -30 }}
                          className="bg-white border-b border-slate-200 hover:bg-slate-50"
                        >
                          <td className="px-4 py-3">
                            {box.description || `Type ${index + 1}`}
                          </td>
                          <td className="px-4 py-3">{qty}</td>
                          <td className="px-4 py-3">{totalW} kg</td>
                          <td className="px-4 py-3">{totalV} cm³</td>
                          <td className="px-4 py-3 flex justify-end items-center gap-2">
                            <button
                              onClick={() => removeBox(index)}
                              disabled={boxes.length <= 1}
                              title="Delete"
                              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>

                <tfoot>
                  <tr className="font-semibold text-slate-800 bg-slate-50">
                    <td colSpan={1} className="px-4 py-3">
                      Grand Total
                    </td>
                    <td className="px-4 py-3">{totalBoxes} Boxes</td>
                    <td className="px-4 py-3">{totalWeight.toFixed(2)} kg</td>
                    <td className="px-4 py-3">
                      {boxes
                        .reduce(
                          (sum, b) =>
                            sum +
                            (b.length || 0) *
                              (b.width || 0) *
                              (b.height || 0) *
                              (b.count || 0),
                          0
                        )
                        .toLocaleString()}{" "}
                      cm³
                    </td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}

        {/* Controls */}
        {(data || hiddendata) && (
          <>
            <Card>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center">
                    <Star size={22} className="mr-3 text-indigo-500" /> Sort & Filter Results
                  </h2>
                  <p className="text-sm text-slate-500 mb-6">
                    Quickly organize quotes by price, speed, or vendor rating.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex-grow w-full grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <SortOptionButton
                    label="Lowest Price"
                    icon={<IndianRupee size={16} />}
                    selected={sortBy === "price"}
                    onClick={() => setSortBy("price")}
                  />
                  <SortOptionButton
                    label="Fastest"
                    icon={<Zap size={16} />}
                    selected={sortBy === "time"}
                    onClick={() => setSortBy("time")}
                  />
                  <SortOptionButton
                    label="Highest Rated"
                    icon={<Star size={16} />}
                    selected={sortBy === "rating"}
                    onClick={() => setSortBy("rating")}
                  />
                </div>
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={() => setIsFineTuneOpen((prev) => !prev)}
                    className="w-full px-5 py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors border border-slate-300"
                  >
                    Fine-Tune Sort
                  </button>
                  <AnimatePresence>
                    {isFineTuneOpen && (
                      <FineTuneModal
                        isOpen={isFineTuneOpen}
                        onClose={() => setIsFineTuneOpen(false)}
                        filters={{ maxPrice, maxTime, minRating }}
                        onFilterChange={{ setMaxPrice, setMaxTime, setMinRating }}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </Card>

            {/* Results */}
            <div id="results" className="space-y-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="space-y-8"
              >
                {(() => {
                  const allQuotes = [
                    ...(data || []),
                    ...(hiddendata || []),
                  ].filter((q) => q.message !== "service not available");

                  const bestValueQuote =
                    allQuotes.length > 0
                      ? allQuotes.reduce((prev, current) =>
                          (prev.totalCharges ?? Infinity) <
                          (current.totalCharges ?? Infinity)
                            ? prev
                            : current
                        )
                      : null;

                  const unlocked = allQuotes.filter(
                    (q) => !q.isHidden && typeof q.estimatedTime === "number"
                  );
                  const fastestQuote =
                    unlocked.length > 0
                      ? unlocked.reduce((prev, current) =>
                          (prev.estimatedTime ?? Infinity) <
                          (current.estimatedTime ?? Infinity)
                            ? prev
                            : current
                        )
                      : null;

                  const processQuotes = (quotes: QuoteAny[] | null) => {
                    if (!quotes) return [];
                    const filtered = quotes.filter((q) => {
                      const rating = (q?.transporterData?.rating ??
                        q?.rating ??
                        q?.transporterData?.ratingAverage ??
                        0) as number;
                      if (q.isHidden) return (q.totalCharges ?? Infinity) <= maxPrice;
                      return (
                        (q.totalCharges ?? Infinity) <= maxPrice &&
                        (q.estimatedTime ?? Infinity) <= maxTime &&
                        rating >= minRating
                      );
                    });
                    return filtered.sort((a, b) => {
                      switch (sortBy) {
                        case "time":
                          if (a.isHidden && !b.isHidden) return 1;
                          if (!a.isHidden && b.isHidden) return -1;
                          return (
                            (a.estimatedTime ?? Infinity) -
                            (b.estimatedTime ?? Infinity)
                          );
                        case "rating": {
                          const ratingA =
                            (a?.transporterData?.rating ??
                              a?.rating ??
                              a?.transporterData?.ratingAverage ??
                              0) as number;
                          const ratingB =
                            (b?.transporterData?.rating ??
                              b?.rating ??
                              b?.transporterData?.ratingAverage ??
                              0) as number;
                          return ratingB - ratingA;
                        }
                        case "price":
                        default:
                          return (
                            (a.totalCharges ?? Infinity) -
                            (b.totalCharges ?? Infinity)
                          );
                      }
                    });
                  };

                  const tiedUpVendors = processQuotes(data);
                  const otherVendors = processQuotes(hiddendata);

                  if (isCalculating) return null;

                  return (
                    <>
                      {tiedUpVendors.length > 0 && (
                        <section>
                          <h2 className="text-2xl font-bold text-slate-800 mb-5 border-l-4 border-indigo-500 pl-4">
                            Your Tied-Up Vendors
                          </h2>
                          <div className="space-y-4">
                            {tiedUpVendors.map((item, index) => (
                              <VendorResultCard
                                key={`tied-${index}`}
                                quote={item}
                                isBestValue={item === bestValueQuote}
                                isFastest={item === fastestQuote}
                              />
                            ))}
                          </div>
                        </section>
                      )}

                      {otherVendors.length > 0 && (
                        <section>
                          <h2 className="text-2xl font-bold text-slate-800 mb-5 border-l-4 border-slate-400 pl-4">
                            Other Available Vendors
                          </h2>
                          <div className="space-y-4">
                            {otherVendors.map((item, index) => (
                              <VendorResultCard
                                key={`other-${index}`}
                                quote={item}
                                isBestValue={item === bestValueQuote}
                                isFastest={item === fastestQuote}
                              />
                            ))}
                          </div>
                        </section>
                      )}

                      {tiedUpVendors.length === 0 && otherVendors.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-slate-300">
                          <PackageSearch className="mx-auto h-12 w-12 text-slate-400" />
                          <h3 className="mt-4 text-xl font-semibold text-slate-700">
                            No Quotes Available
                          </h3>
                          <p className="mt-1 text-base text-slate-500">
                            We couldn't find vendors for the details provided. Try adjusting
                            your filter criteria.
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </motion.div>
            </div>
          </>
        )}

        {/* Modals */}
        <SavePresetModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setBoxIndexToSave(null);
          }}
          onSave={handleSavePreset}
        />
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Rating stars
// -----------------------------------------------------------------------------
const StarRating = ({ value }: { value: number }) => {
  const full = Math.floor(value);
  const capped = Math.max(0, Math.min(5, full));
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={16}
          className={i < capped ? "text-yellow-400 fill-yellow-400" : "text-slate-300"}
        />
      ))}
      <span className="text-xs text-slate-500 ml-1">
        ({(Number.isFinite(value) ? value : 0).toFixed(1)})
      </span>
    </div>
  );
};

// -----------------------------------------------------------------------------
// FineTune Modal
// -----------------------------------------------------------------------------
const FineTuneModal = ({
  isOpen,
  onClose,
  filters,
  onFilterChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  filters: { maxPrice: number; maxTime: number; minRating: number };
  onFilterChange: {
    setMaxPrice: (val: number) => void;
    setMaxTime: (val: number) => void;
    setMinRating: (val: number) => void;
  };
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const formatPrice = (value: number) => {
    if (value >= 10000000) return "Any";
    if (value >= 100000) return `${(value / 100000).toFixed(1)} Lakh`;
    return new Intl.NumberFormat("en-IN").format(value);
  };
  const formatTime = (value: number) => (value >= 300 ? "Any" : `${value} Days`);

  if (!isOpen) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/30"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="absolute right-4 top-20 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 p-5 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <label htmlFor="maxPrice" className="font-semibold text-slate-700">
              Max Price
            </label>
            <span className="font-bold text-indigo-600">
              ₹ {formatPrice(filters.maxPrice)}
            </span>
          </div>
          <input
            id="maxPrice"
            type="range"
            min={1000}
            max={10000000}
            step={1000}
            value={filters.maxPrice}
            onChange={(e) => onFilterChange.setMaxPrice(e.currentTarget.valueAsNumber)}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <label htmlFor="maxTime" className="font-semibold text-slate-700">
              Max Delivery Time
            </label>
            <span className="font-bold text-indigo-600">{formatTime(filters.maxTime)}</span>
          </div>
          <input
            id="maxTime"
            type="range"
            min={1}
            max={300}
            step={1}
            value={filters.maxTime}
            onChange={(e) => onFilterChange.setMaxTime(e.currentTarget.valueAsNumber)}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <label htmlFor="minRating" className="font-semibold text-slate-700">
              Min Vendor Rating
            </label>
            <span className="font-bold text-indigo-600">
              {filters.minRating.toFixed(1)} / 5.0
            </span>
          </div>
          <input
            id="minRating"
            type="range"
            min={0}
            max={5}
            step={0.1}
            value={filters.minRating}
            onChange={(e) => onFilterChange.setMinRating(e.currentTarget.valueAsNumber)}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

// -----------------------------------------------------------------------------
// Save Preset Modal
// -----------------------------------------------------------------------------
const SavePresetModal = ({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) => {
  const [name, setName] = useState("");
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9980] flex justify-center items-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center">
            <Save size={18} className="mr-2 text-indigo-500" /> Save Box Preset
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Give this box configuration a name for future use. The dimensions, weight,
          pincodes, and transport mode will be saved.
        </p>
        <InputField
          label="Preset Name"
          id="preset-name"
          type="text"
          placeholder="e.g., My Standard Box"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (name.trim() === "") return;
              onSave(name.trim());
              setName("");
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Save Preset
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Bifurcation Details
// -----------------------------------------------------------------------------
const BifurcationDetails = ({ quote }: { quote: any }) => {
  const formatCurrency = (value: number | undefined) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round((value || 0) / 10) * 10);

  const chargeItems = [
    { label: "Base Freight", keys: ["baseFreight", "base_freight", "freight"] },
    { label: "Docket Charge", keys: ["docketCharge", "docket_charge", "docket"] },
    { label: "DACC Charges", keys: ["daccCharges", "dacc_charges", "dacc"] },
    { label: "ODA Charges", keys: ["odaCharges", "oda_charges", "oda"] },
    { label: "Fuel Surcharge", keys: ["fuelCharges", "fuel_surcharge", "fuel"] },
    { label: "Handling Charges", keys: ["handlingCharges", "handling_charges", "handling"] },
    { label: "Insurance Charges", keys: ["insuranceCharges", "insurance_charges", "insurance"] },
    { label: "Green Tax", keys: ["greenTax", "green_tax", "green"] },
    { label: "Appointment Charges", keys: ["appointmentCharges", "appointment_charges", "appointment"] },
    { label: "Minimum Charges", keys: ["minCharges", "minimum_charges", "minimum"] },
    { label: "ROV Charges", keys: ["rovCharges", "rov_charges", "rov"] },
    { label: "FM Charges", keys: ["fmCharges", "fm_charges", "fm"] },
    { label: "Miscellaneous Charges", keys: ["miscCharges", "miscellaneous_charges", "misc"] },
  ];

  const getChargeValue = (keys: string[]) => {
    for (const key of keys) {
      if (quote[key] !== undefined && quote[key] > 0) {
        return quote[key];
      }
    }
    return 0;
  };

  const isFTLVendor =
    quote.companyName === "FTL" || quote.companyName === "Wheelseye FTL";

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="overflow-hidden"
    >
      {!isFTLVendor && (
        <div className="border-t border-slate-200 mt-4 pt-4">
          <h4 className="font-semibold text-slate-700 mb-3">Cost Breakdown</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            {chargeItems.map((item) => {
              const value = getChargeValue(item.keys);
              return value > 0 ? (
                <div key={item.label} className="flex justify-between">
                  <span className="text-slate-500">{item.label}:</span>
                  <span className="font-medium text-slate-800">
                    {formatCurrency(value)}
                  </span>
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}

      <div className={`border-t border-slate-200 mt-4 pt-4`}>
        <h4 className="font-semibold text-slate-700 mb-3">Shipment Info</h4>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Chargeable Wt:</span>
            <span className="font-medium text-slate-800">
              {(() => {
                const weight =
                  quote.chargeableWeight ?? quote.actualWeight ?? quote.weight ?? 0;
                if (typeof weight === "number" && isFinite(weight)) {
                  return weight.toFixed(2);
                }
                return "0.00";
              })()}{" "}
              Kg
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Distance:</span>
            <span className="font-medium text-slate-800">
              {(() => {
                if (quote.distance) return quote.distance;
                if (quote.distanceKm) return `${quote.distanceKm} km`;
                return "-";
              })()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Origin:</span>
            <span className="font-medium text-slate-800">
              {quote.originPincode ?? quote.origin ?? "-"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Destination:</span>
            <span className="font-medium text-slate-800">
              {quote.destinationPincode ?? quote.destination ?? "-"}
            </span>
          </div>

          {isFTLVendor && !quote.loadSplit && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">Vehicle Type:</span>
                <span className="font-medium text-slate-800">{quote.vehicle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Vehicle Length:</span>
                <span className="font-medium text-slate-800">{quote.vehicleLength} ft</span>
              </div>
            </>
          )}

          {quote.loadSplit && (
            <div className="col-span-2 md:col-span-3 mt-3">
              <div className="bg-yellow-100 border-2 border-yellow-500 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-black font-bold text-lg">
                    More Details
                  </span>
                </div>
                <div className="text-black text-sm">
                  {(() => {
                    const totalWeight = quote.matchedWeight || quote.chargeableWeight || 0;
                    const actualVehiclesNeeded = Math.ceil(totalWeight / 18000);
                    return `Weight exceeds 18,000kg limit. Using ${actualVehiclesNeeded} vehicles for optimal transport.`;
                  })()}
                </div>
              </div>
            </div>
          )}

          {quote.loadSplit && (
            <div className="col-span-2 md:col-span-3 mt-4 p-3 bg-yellow-50 rounded-lg">
              <h6 className="font-semibold text-black mb-3">Vehicle Details:</h6>
              {(() => {
                const totalWeight = quote.matchedWeight || quote.chargeableWeight || 0;
                const vehicleCount = Math.ceil(totalWeight / 18000);
                const vehicleList: Array<{number: number; type: string; maxWeight: number; carryingWeight: number; price: number;}> = [];
                let remainingWeight = totalWeight;
                
                for (let i = 0; i < vehicleCount; i++) {
                  const vehicleWeight = Math.min(remainingWeight, 18000);
                  let vehicleType = "Container 32 ft MXL";
                  let maxCapacity = 18000;
                  if (vehicleWeight < 18000) {
                    if (vehicleWeight <= 1000) { vehicleType = "Tata Ace"; maxCapacity = 1000; }
                    else if (vehicleWeight <= 1500) { vehicleType = "Pickup"; maxCapacity = 1500; }
                    else if (vehicleWeight <= 2000) { vehicleType = "10 ft Truck"; maxCapacity = 2000; }
                    else if (vehicleWeight <= 4000) { vehicleType = "Eicher 14 ft"; maxCapacity = 4000; }
                    else if (vehicleWeight <= 7000) { vehicleType = "Eicher 19 ft"; maxCapacity = 7000; }
                    else if (vehicleWeight <= 10000) { vehicleType = "Eicher 20 ft"; maxCapacity = 10000; }
                    else { vehicleType = "Container 32 ft MXL"; maxCapacity = 18000; }
                  }
                  const actualTotalPrice = quote.totalCharges || quote.price || quote.loadSplit?.totalPrice || 0;
                  let vehiclePrice;
                  if (i === vehicleCount - 1) {
                    const sumSoFar = vehicleList.reduce((sum, v) => sum + v.price, 0);
                    vehiclePrice = actualTotalPrice - sumSoFar;
                  } else {
                    const weightRatio = vehicleWeight / totalWeight;
                    vehiclePrice = Math.round(actualTotalPrice * weightRatio);
                  }
                  vehicleList.push({
                    number: i + 1,
                    type: vehicleType,
                    maxWeight: maxCapacity,
                    carryingWeight: vehicleWeight,
                    price: vehiclePrice
                  });
                  remainingWeight -= vehicleWeight;
                }
                
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-yellow-200">
                          <th className="text-left py-2 text-black font-semibold">Vehicle</th>
                          <th className="text-left py-2 text-black font-semibold">Type</th>
                          <th className="text-left py-2 text-black font-semibold">Max Weight</th>
                          <th className="text-left py-2 text-black font-semibold">Carrying Weight</th>
                          <th className="text-right py-2 text-black font-semibold">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vehicleList.map((v) => (
                          <tr key={v.number} className="border-b border-yellow-100">
                            <td className="py-2 text-black">Vehicle {v.number}</td>
                            <td className="py-2 text-black">{v.type}</td>
                            <td className="py-2 text-black">{v.maxWeight.toLocaleString()}kg</td>
                            <td className="py-2 text-black">{v.carryingWeight.toLocaleString()}kg</td>
                            <td className="py-2 text-black text-right">₹{v.price.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-yellow-300">
                          <td colSpan={4 as any} className="py-3 text-black font-bold text-right">Total:</td>
                          <td className="py-3 text-black font-bold text-right text-xl">₹{(quote.totalCharges || quote.price || quote.loadSplit?.totalPrice || 0).toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// -----------------------------------------------------------------------------
// Result Card
// -----------------------------------------------------------------------------
const VendorResultCard = ({
  quote,
  isBestValue,
  isFastest,
}: {
  quote: any;
  isBestValue?: boolean;
  isFastest?: boolean;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const isSpecialVendor =
    quote.companyName === "LOCAL FTL" || quote.companyName === "Wheelseye FTL";

  const handleMoreDetailsClick = () => {
    const isSubscribed = (user as any)?.customer?.isSubscribed;
    if (isSubscribed) {
      const transporterId = quote.transporterData?._id;
      if (transporterId) navigate(`/transporterdetails/${transporterId}`);
      else {
        console.error("Transporter ID missing.");
        alert("Sorry, the transporter details could not be retrieved.");
      }
    } else {
      navigate("/buy-subscription-plan");
    }
  };

  const rating: number = 4;

  if (quote.isHidden) {
    return (
      <div
        className={`relative p-5 rounded-2xl border-2 transition-all duration-300 ${
          isSpecialVendor
            ? "bg-yellow-50 border-yellow-300 shadow-lg"
            : isBestValue
            ? "bg-white border-green-400 shadow-lg"
            : "bg-white border-slate-200"
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4">
          <div className="md:col-span-5">
            <h3 className="font-bold text-lg text-slate-700">{quote.companyName}</h3>
            <p className="text-sm text-slate-500">Time & Details are Hidden</p>
          </div>

          <div className="md:col-span-2 text-slate-500 text-sm">—</div>

          <div className="md:col-span-3 text-right">
            <div className="flex items-center justify-end gap-1 font-bold text-3xl text-slate-900">
              <IndianRupee size={22} className="text-slate-600" />
              <span>
                {new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
                  Math.round(quote.totalCharges / 10) * 10
                )}
              </span>
            </div>

          </div>

          <div className="md:col-span-2 flex md:justify-end">
            <button className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30">
              Unlock to Book
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-5 rounded-2xl border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
        isSpecialVendor
          ? "bg-yellow-50 border-yellow-300 shadow-lg"
          : isBestValue
          ? "bg-white border-green-400 shadow-lg"
          : "bg-white border-slate-200"
      }`}
    >
      <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4">
        <div className="md:col-span-5">
          <div className="flex items-center flex-wrap gap-2">
            <h3 className="font-bold text-lg text-slate-800 truncate">
              {quote.companyName}
            </h3>
            <div className="flex items-center gap-2">
              {(isFastest || quote.companyName === "Wheelseye FTL" || quote.companyName === "LOCAL FTL") && (
                <span className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1.5 rounded-full">
                  <Zap size={14} /> Fastest Delivery
                </span>
              )}
              {isBestValue && (
                <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-xs font-bold px-3 py-1.5 rounded-full">
                  Best Value
                </span>
              )}
            </div>
          </div>
          <div className="mt-1">
            {quote.companyName !== "LOCAL FTL" && <StarRating value={Number(4) || 0} />}
          </div>
        </div>

        <div className="md:col-span-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 font-semibold text-slate-700 text-lg">
            <Clock size={16} className="text-slate-500" />
            <span>
              {Math.ceil(quote.estimatedTime ?? 0)}{" "}
              {Math.ceil(quote.estimatedTime ?? 0) === 1 ? "Day" : "Days"}
            </span>
          </div>
          <div className="text-xs text-slate-500 -mt-1">Estimated Delivery</div>
        </div>

        <div className="md:col-span-3 text-right">
          <div className="flex items-center justify-end gap-1 font-bold text-3xl text-slate-900">
            <IndianRupee size={22} className="text-slate-600" />
            <span>
              {new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
                Math.round(quote.totalCharges / 10) * 10
              )}
            </span>
          </div>


          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="mt-2 inline-flex items-center gap-1.5 text-indigo-600 font-semibold text-sm hover:text-indigo-800 transition-colors"
          >
            {isExpanded ? "Hide Price Breakup" : "Price Breakup"}
            <ChevronRight
              size={16}
              className={`transition-transform duration-300 ${
                isExpanded ? "rotate-90" : "rotate-0"
              }`}
            />
          </button>
        </div>

        <div className="md:col-span-2 flex md:justify-end">
          <button
            onClick={handleMoreDetailsClick}
            className="w-full md:w-auto px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
          >
            Contact Now
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && <BifurcationDetails quote={quote} />}
      </AnimatePresence>
    </div>
  );
};

export default CalculatorPage;
