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
        className={`block w-full py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition read-only:bg-slate-100 read-only:cursor-not-allowed disabled:bg-slate-100 disabled:border-slate-200 disabled:cursor-not-allowed ${
          props.icon ? "pl-10" : "px-4"
        }`}
      />
    </div>
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
// Types (broad to cover different API shapes)
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
  const [maxPrice, setMaxPrice] = useState(10000000);
  const [maxTime, setMaxTime] = useState(300);
  const [minRating, setMinRating] = useState(0);
  const fineTuneRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  const isAnyDimensionExceeded = useMemo(
    () =>
      boxes.some(
        (box) =>
          (box.length ?? 0) > MAX_DIMENSION_LENGTH ||
          (box.width ?? 0) > MAX_DIMENSION_WIDTH ||
          (box.height ?? 0) > MAX_DIMENSION_HEIGHT
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

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // 1) ALWAYS autofill Origin Pincode from the user profile (original desired behavior).
  //    We do this FIRST and we do NOT let cache override it later.
  useEffect(() => {
    const pin = (user as any)?.customer?.pincode;
    if (pin) setFromPincode(String(pin));
  }, [user]);

  // 2) Restore last form (EXCEPT origin pincode) + last results from cache on mount
  useEffect(() => {
    clearStaleCache();

    const form = loadFormState();
    if (form) {
      // DO NOT override origin pincode — keep the value from profile/autofill
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

  // Persist form state while typing (so it survives leaving page)
  useEffect(() => {
    saveFormState({
      fromPincode, // harmless to store; we just don't load it back over profile
      toPincode,
      modeOfTransport,
      boxes,
    });
  }, [fromPincode, toPincode, modeOfTransport, boxes]);

  // Dropdown/fine-tune outside click
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
      if (
        fineTuneRef.current &&
        !fineTuneRef.current.contains(ev.target as Node)
      ) {
        setIsFineTuneOpen(false);
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
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const digitsOnly = raw.replace(/\D/g, "").slice(0, 6);
    setter(digitsOnly);
  };

  // Dimension auto-cap (hard clamp to max value)
  const handleDimensionChange = (
    index: number,
    field: "length" | "width" | "height",
    value: string,
    maxLength: number,
    maxValue: number
  ) => {
    if (value) {
      let finalValueStr = value.slice(0, maxLength);
      if (Number(finalValueStr) > maxValue) finalValueStr = String(maxValue);
      updateBox(index, field, Number(finalValueStr));
    } else {
      updateBox(index, field, undefined);
    }
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
        `http://localhost:8000/api/transporter/getpackinglist?customerId=${
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
        `http://localhost:8000/api/transporter/savepackinglist`,
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
          `http://localhost:8000/api/transporter/deletepackinglist/${presetId}`,
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

  // Distance via backend wrapper (Google Distance Matrix)
  async function getDistanceKmByAPI(originPin: string, destPin: string) {
    const apiBase =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
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

  // Get Wheelseye pricing from database API with chargeable weight calculation
  async function getWheelseyePriceFromDB(
    weight: number,
    distance: number,
    shipmentDetails?: any[]
  ) {
    try {
      const apiBase =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const requestBody: any = {
        distance: distance,
      };

      // Send shipment details if available for backend chargeable weight calculation
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

  // Check if origin pincode is in Wheelseye service area
  function isWheelseyeServiceArea(originPincode: string): boolean {
    const pincode = parseInt(originPincode);
    // Delhi: 110001-110098
    if (pincode >= 110001 && pincode <= 110098) return true;
    // Noida: 201301-201315
    if (pincode >= 201301 && pincode <= 201315) return true;
    // Ghaziabad: 201001-201015
    if (pincode >= 201001 && pincode <= 201015) return true;
    // Gurgaon: 122001-122018
    if (pincode >= 122001 && pincode <= 122018) return true;
    return false;
  }

  // -------------------- Calculate Quotes (with CACHE) --------------------
  const calculateQuotes = async () => {
    setError(null);
    setData(null);
    setHiddendata(null);

    const pinRx = /^\d{6}$/;
    if (!pinRx.test(fromPincode) || !pinRx.test(toPincode)) {
      setError("Please enter valid 6-digit Origin and Destination Pincodes.");
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

    // >>>>>>>>>>>>> CACHE: check by params (currently not short-circuiting network)
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
        "http://localhost:8000/api/transporter/calculate",
        {
          customerID: (user as any).customer._id,
          userogpincode: (user as any).customer.pincode,
          modeoftransport: modeOfTransport,
          fromPincode,
          toPincode,
          shipment_details: shipmentPayload,
        },
        { headers: { Authorization: `Bearer ${token}` } }
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

      // SHOW ONLY THE CHEAPEST DP WORLD and HIDE EXPENSIVE ONE COMPLETELY
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
      let distanceKm = 500; // default fallback
      try {
        distanceKm = await getDistanceKmByAPI(fromPincode, toPincode);
      } catch (e) {
        console.warn("Distance calculation failed, using default:", e);
      }

      const isWheelseyeAvailable = isWheelseyeServiceArea(fromPincode);

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

      // FTL quote (always available)
      const ftlEstimatedTime = Math.ceil(distanceKm / 400);
      const ftlQuote = {
        message: "",
        isHidden: false,
        transporterData: { rating: 4.6 },
        totalCharges: ftlPrice,
        estimatedDelivery: `${ftlEstimatedTime} Day${
          ftlEstimatedTime > 1 ? "s" : ""
        }`,
        companyName: "FTL",
        price: ftlPrice,
        transporterName: "FTL",
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
        category: "FTL",
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
                vehiclesNeeded: 2,
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
              }
            : null),
      };

      // Always show FTL
      others.unshift(ftlQuote);
      if (!others.find((q) => q.companyName === "FTL")) {
        others.unshift(ftlQuote);
      }

      // Only add Wheelseye if origin is in service area
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
                  vehiclesNeeded: 2,
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
                }
              : null),
        };

        // Put Wheelseye just after FTL
        others.unshift(wheelseyeQuote);
      }

      // Multiply all other Tied-Up Vendors prices by 5.0 to make them most expensive
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

      // Final guard: ensure FTL exists
      if (!others.find((q) => q.companyName === "FTL")) {
        const emergencyFtlQuote = {
          message: "",
          isHidden: false,
          transporterData: { rating: 4.6 },
          totalCharges: 35000,
          estimatedDelivery: "2 Days",
          companyName: "FTL",
          price: 35000,
          transporterName: "FTL",
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
          category: "FTL",
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

      // >>> CACHE: store final rendered arrays
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
                onChange={(e) => handlePincodeChange(e.target.value, setFromPincode)}
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
                onChange={(e) => handlePincodeChange(e.target.value, setToPincode)}
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
                            className="absolute z-20 w-full mt-1 border border-slate-200 rounded-lg max-h-48 overflow-y-auto bg-white shadow-lg"
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

                    <InputField
                      label="Number of Boxes"
                      id={`count-${index}`}
                      type="number"
                      min={1}
                      step={1}
                      value={box.count ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "") {
                          updateBox(index, "count", undefined);
                          return;
                        }
                        if (!/^\d+$/.test(value)) return;
                        const intValue = parseInt(value);
                        if (intValue >= 1) {
                          updateBox(index, "count", intValue);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.key === "." ||
                          e.key === "e" ||
                          e.key === "E" ||
                          e.key === "+" ||
                          e.key === "-"
                        ) {
                          e.preventDefault();
                        }
                      }}
                      placeholder="e.g., 10"
                      required
                    />

                    <InputField
                      label="Weight (kg)"
                      id={`weight-${index}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={box.weight ?? ""}
                      onChange={(e) =>
                        updateBox(index, "weight", e.target.valueAsNumber ?? undefined)
                      }
                      placeholder="e.g., 5.5"
                      required
                    />
                  </div>

                  {/* Dimensions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <InputField
                        label="Length (cm)"
                        id={`length-${index}`}
                        type="number"
                        min={0}
                        value={box.length ?? ""}
                        onChange={(e) =>
                          handleDimensionChange(
                            index,
                            "length",
                            e.target.value,
                            4,
                            MAX_DIMENSION_LENGTH
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
                        type="number"
                        min={0}
                        value={box.width ?? ""}
                        onChange={(e) =>
                          handleDimensionChange(
                            index,
                            "width",
                            e.target.value,
                            3,
                            MAX_DIMENSION_WIDTH
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
                        type="number"
                        min={0}
                        value={box.height ?? ""}
                        onChange={(e) =>
                          handleDimensionChange(
                            index,
                            "height",
                            e.target.value,
                            3,
                            MAX_DIMENSION_HEIGHT
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
                disabled={isCalculating || isAnyDimensionExceeded}
                whileHover={{
                  scale: isCalculating || isAnyDimensionExceeded ? 1 : 1.05,
                }}
                whileTap={{
                  scale: isCalculating || isAnyDimensionExceeded ? 1 : 0.95,
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
                <div className="relative w-full sm:w-auto" ref={fineTuneRef}>
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
                            (a.totalCharges ?? Infinity) - (b.totalCharges ?? Infinity)
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
  filters,
  onFilterChange,
}: {
  isOpen: boolean;
  filters: { maxPrice: number; maxTime: number; minRating: number };
  onFilterChange: {
    setMaxPrice: (val: number) => void;
    setMaxTime: (val: number) => void;
    setMinRating: (val: number) => void;
  };
}) => {
  const formatPrice = (value: number) => {
    if (value >= 10000000) return "Any";
    if (value >= 100000) return `${(value / 100000).toFixed(1)} Lakh`;
    return new Intl.NumberFormat("en-IN").format(value);
  };
  const formatTime = (value: number) => (value >= 300 ? "Any" : `${value} Days`);

  if (!isOpen) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-20 p-5 space-y-5"
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
          min="1000"
          max="10000000"
          step="1000"
          value={filters.maxPrice}
          onChange={(e) => onFilterChange.setMaxPrice(e.target.valueAsNumber)}
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
          min="1"
          max="300"
          step="1"
          value={filters.maxTime}
          onChange={(e) => onFilterChange.setMaxTime(e.target.valueAsNumber)}
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
          min="0"
          max="5"
          step="0.1"
          value={filters.minRating}
          onChange={(e) => onFilterChange.setMinRating(e.target.valueAsNumber)}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
      </div>
    </motion.div>
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
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
              onSave(name);
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
              <div className="bg-orange-100 border-2 border-orange-500 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-orange-800 font-bold text-lg">🚛</span>
                  <span className="text-orange-800 font-bold text-lg">
                    {quote.loadSplit.vehiclesNeeded > 2
                      ? "Multi-Vehicle Transport Required"
                      : "Two-Vehicle Transport Required"}
                  </span>
                </div>
                <div className="text-orange-700 text-sm">
                  {quote.loadSplit.vehiclesNeeded > 2
                    ? `Weight exceeds 18,000kg limit. Using ${quote.loadSplit.vehiclesNeeded} vehicles for optimal transport.`
                    : `Weight exceeds 18,000kg limit. Using ${quote.loadSplit.vehiclesNeeded} vehicles for optimal transport.`}
                  <br />
                  <span className="text-xs">📋 Scroll down for detailed vehicle breakdown</span>
                </div>
              </div>
            </div>
          )}

          {quote.loadSplit && (
            <div className="col-span-2 md:col-span-3 mt-3 p-3 bg-green-50 rounded-lg">
              <h5 className="font-semibold text-green-800 mb-2">
                🚛 {quote.loadSplit.vehiclesNeeded > 2 ? "Multi-Vehicle" : "Two-Vehicle"} Load
                Details:
              </h5>

              <div className="mb-3 p-2 bg-green-100 rounded text-xs">
                <div className="font-semibold text-green-800 mb-1">Transport Summary:</div>
                <div className="text-green-700">
                  • Total Weight: {quote.matchedWeight?.toLocaleString() || "N/A"} kg
                  <br />
                  • Total Distance: {quote.matchedDistance || "N/A"} km
                  <br />
                  • Vehicles Required: {quote.loadSplit.vehiclesNeeded || "N/A"}
                  <br />
                  • Transport Type:{" "}
                  {quote.loadSplit.vehiclesNeeded > 2 ? "Multi-Vehicle" : "Two-Vehicle"} Transport
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="border border-green-200 rounded p-2">
                  <div className="font-semibold text-green-800 mb-1">🚛 First Vehicle:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-green-600">Vehicle Type:</span>
                      <span className="font-medium text-green-800">
                        {quote.loadSplit.firstVehicle.vehicle}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600">Vehicle Length:</span>
                      <span className="font-medium text-green-800">
                        {quote.loadSplit.firstVehicle.vehicleLength} ft
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600">Load Capacity:</span>
                      <span className="font-medium text-green-800">
                        {quote.loadSplit.firstVehicle.weight.toLocaleString()} kg
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600">Transport Cost:</span>
                      <span className="font-medium text-green-800">
                        ₹{quote.loadSplit.firstVehicle.price.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border border-green-200 rounded p-2">
                  <div className="font-semibold text-green-800 mb-1">🚛 Second Vehicle:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-green-600">Vehicle Type:</span>
                      <span className="font-medium text-green-800">
                        {quote.loadSplit.secondVehicle.vehicle}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600">Vehicle Length:</span>
                      <span className="font-medium text-green-800">
                        {quote.loadSplit.secondVehicle.vehicleLength} ft
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600">Load Capacity:</span>
                      <span className="font-medium text-green-800">
                        {quote.loadSplit.secondVehicle.weight.toLocaleString()} kg
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600">Transport Cost:</span>
                      <span className="font-medium text-green-800">
                        ₹{quote.loadSplit.secondVehicle.price.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {quote.loadSplit.vehiclesNeeded > 2 && (
                  <div className="border border-orange-200 rounded p-2 bg-orange-50">
                    <div className="font-semibold text-orange-800 mb-1">
                      🚛 Additional Vehicles:
                    </div>
                    <div className="text-xs text-orange-700">
                      <div className="mb-1">
                        • Additional {quote.loadSplit.vehiclesNeeded - 2}{" "}
                        {quote.loadSplit.secondVehicle.vehicle} vehicles required
                      </div>
                      <div className="mb-1">
                        • Each additional vehicle: ₹
                        {quote.loadSplit.secondVehicle.price.toLocaleString()}
                      </div>
                      <div className="font-semibold">
                        • Total additional cost: ₹
                        {(
                          quote.loadSplit.secondVehicle.price *
                          (quote.loadSplit.vehiclesNeeded - 2)
                        ).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t-2 border-green-300 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-green-700 font-semibold text-base">
                      Total Transport Cost:
                    </span>
                    <span className="text-green-800 font-bold text-lg">
                      ₹{quote.loadSplit.totalPrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    Includes all vehicles, loading, and transport charges
                  </div>
                </div>
              </div>
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
    quote.companyName === "FTL" || quote.companyName === "Wheelseye FTL";

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
            <div className="text-xs text-slate-500 -mt-1">Total Charges</div>
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
              {isFastest && (
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
            {quote.companyName !== "FTL" && <StarRating value={Number(rating) || 0} />}
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
          <div className="text-xs text-slate-500">Estimated Delivery</div>
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
          <div className="text-xs text-slate-500 -mt-1">Total Charges</div>

          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="mt-2 inline-flex items-center gap-1.5 text-indigo-600 font-semibold text-sm hover:text-indigo-800 transition-colors"
          >
            {isExpanded
              ? isSpecialVendor
                ? "Hide Shipment Info"
                : "Hide Price Breakup"
              : isSpecialVendor
              ? "Shipment Info"
              : "Price Breakup"}
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
