import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  Calculator as CalculatorIcon,
  Navigation,
  MapPin,
  MoveRight,
  Package,
  Boxes,
  Truck,
  Train,
  Plane,
  Ship as ShipIcon,
  Sparkles,
  Shield,
  Loader2,
  AlertCircle,
  PackageSearch, // New Icon
  Save, // New Icon
  X, // New Icon
  ChevronDown,
  Building2,
  Award,
  Zap, // New Icon
  ChevronRight,
  IndianRupee,
  Clock,
  CheckCircle,
  Lock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";
import { motion, AnimatePresence } from "framer-motion";

// --- TYPE DEFINITIONS --- (Unchanged)
type VendorQuote = {
  message: string;
  isHidden: any;
  transporterData: any;
  totalPrice: any;
  estimatedDelivery: any;
  companyName: string;
  price: any;
  transporterName: string;
  deliveryTime: string;
  estimatedTime?: number;
  chargeableWeight: number;
  totalCharges: number;
  logoUrl?: string;
  isBestValue?: boolean;
};

// --- NEW TYPE DEFINITION for Saved Boxes/Presets ---
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

// --- STYLED HELPER COMPONENTS --- (Unchanged, with syntax fixes)
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

const ModeButton = ({
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
    className={`flex-1 p-4 rounded-xl text-center transition-all duration-300 border-2 ${
      selected
        ? "bg-indigo-600 border-indigo-600 text-white shadow-lg"
        : "bg-white hover:bg-slate-50 border-white hover:border-slate-300"
    }`}
  >
    {icon}
    <span className="mt-2 block font-semibold">{label}</span>
  </button>
);

const Toggle = ({
  label,
  icon,
  description,
  checked,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <div
    onClick={() => onChange(!checked)}
    className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
  >
    <div className="text-indigo-600 mt-1">{icon}</div>
    <div className="flex-1">
      <h4 className="font-semibold text-slate-800">{label}</h4>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
    <div
      className={`relative inline-block w-11 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${
        checked ? "bg-indigo-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </div>
  </div>
);

const InputField = (
  props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }
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
    <input
      {...props}
      className="block w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition read-only:bg-slate-100 read-only:cursor-not-allowed disabled:bg-slate-100 disabled:border-slate-200 disabled:cursor-not-allowed"
    />
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


const CalculatorPage: React.FC = () => {
  const { user } = useAuth();

  // --- COMPONENT STATE ---
  const [sortBy, setSortBy] = useState<'price' | 'time' | 'rating'>('price');
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data State
  const [data, setData] = useState<VendorQuote[] | null>(null);
  const [hiddendata, setHiddendata] = useState<VendorQuote[] | null>(null);

  // Form State
  const [modeOfTransport, setModeOfTransport] = useState<"Road" | "Rail" | "Air" | "Ship">("Road");
  const [fromPincode, setFromPincode] = useState("");
  const [toPincode, setToPincode] = useState("");
  const [noofboxes, setNoofboxes] = useState<number | undefined>(undefined);
  // Quantity is now a permanent value of 1.
  const quantity = 1;
  const [length, setLength] = useState<number | undefined>(undefined);
  const [width, setWidth] = useState<number | undefined>(undefined);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [weightperbox, setWeightperbox] = useState<number | undefined>(undefined);
  const [description, setDescription] = useState("");

  const token = Cookies.get("authToken");

  // --- SAVED PRESETS STATE & REFS ---
  const [savedBoxes, setSavedBoxes] = useState<SavedBox[]>([]);
  const [saveBoxDetails, setSaveBoxDetails] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- NEW STATE & REFS FOR FINE-TUNE FILTERING ---
  const [isFineTuneOpen, setIsFineTuneOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState(10000000);
  const [maxTime, setMaxTime] = useState(300);
  const [minRating, setMinRating] = useState(0);
  const fineTuneRef = useRef<HTMLDivElement>(null);


  // --- BACKEND FUNCTIONS ---

  const fetchSavedBoxes = async () => {
    if (!user || !token) return;
    try {
      const response = await axios.get(
        `https://backend-bcxr.onrender.com/api/transporter/getpackinglist?customerId=${(user as any).customer._id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (Array.isArray(response.data.data)) {
        setSavedBoxes(response.data.data);
      } else {
        console.warn("Unexpected response format:", response.data);
        setSavedBoxes([]);
      }
    } catch (err) {
      console.error("Failed to fetch saved boxes:", err);
      setSavedBoxes([]);
    }
  };

  const handleSavePreset = async (presetName: string) => {
    if (!presetName.trim()) {
      alert("Please enter a name for the preset.");
      return;
    }
    if (!length || !width || !height || !weightperbox) {
      alert("Please fill in all box dimensions and weight to save a preset.");
      return;
    }

    const newPreset = {
      customerId: (user as any).customer._id,
      name: presetName,
      modeoftransport: modeOfTransport,
      originPincode: fromPincode,
      destinationPincode: toPincode,
      noofboxes: noofboxes,
      quantity: quantity, // Will always be 1
      length: length,
      width: width,
      height: height,
      weight: weightperbox,
    };

    try {
      await axios.post(
        "https://backend-bcxr.onrender.com/api/transporter/savepackinglist",
        newPreset,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setIsModalOpen(false);
      setSaveBoxDetails(false);
      alert("Preset saved successfully!");
      fetchSavedBoxes();
    } catch (err) {
      console.error("Failed to save preset:", err);
      alert("Error saving preset. Please try again.");
    }
  };

  // --- HANDLER FUNCTIONS ---

  const handleSelectBox = (box: SavedBox) => {
    setLength(box.length);
    setWidth(box.width);
    setHeight(box.height);
    setWeightperbox(box.weight);
    setNoofboxes(Number(box.noofboxes));
    // Do not set quantity, as it is fixed at 1.
    setFromPincode(box.originPincode.toString());
    setToPincode(box.destinationPincode.toString());
    setModeOfTransport(box.modeoftransport);
    setDescription(box.description || "");
    setIsDropdownOpen(false);
    setSearchTerm("");
  };

  // --- USEEFFECT HOOKS ---
  useEffect(() => {
    fetchSavedBoxes();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fineTuneRef.current && !fineTuneRef.current.contains(event.target as Node)) {
        setIsFineTuneOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- MAIN API CALL ---
  const calculateQuotes = async () => {
    setError(null);
    const pincodeRegex = /^\d{6}$/;
    if (!pincodeRegex.test(fromPincode) || !pincodeRegex.test(toPincode)) {
      setError("Please enter valid 6-digit Origin and Destination Pincodes.");
      return;
    }
    if (!noofboxes || !length || !width || !height || !weightperbox) {
      setError("Please fill in all shipment detail fields.");
      return;
    }

    setIsCalculating(true);
    try {
      const response = await axios.post(
        "https://backend-bcxr.onrender.com/api/transporter/calculate",
        {
          customerID: (user as any).customer._id,
          userogpincode: (user as any).customer.pincode,
          modeoftransport: modeOfTransport,
          fromPincode,
          toPincode,
          noofboxes,
          quantity, // Always sends 1
          length,
          width,
          height,
          weight: weightperbox,
          isExpress: false,
          isFragile: false,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response) {
        setData(response.data.tiedUpResult);
        setHiddendata(response.data.companyResult);
      }
    } catch (e) {
      setError("Failed to calculate quotes. Please check your inputs and try again.");
      console.error(e);
    } finally {
      setIsCalculating(false);
      setTimeout(() => {
        document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  const displayableBoxes = Array.isArray(savedBoxes)
    ? savedBoxes.filter((box) =>
        box.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  // --- JSX RENDER ---
  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans">
      <div
        className="absolute top-0 left-0 w-full h-80 bg-gradient-to-br from-indigo-50 to-purple-50"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 65%, 0% 100%)" }}
      ></div>
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

        <Card>
          <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center">
            <Navigation size={22} className="mr-3 text-indigo-500" /> Mode &
            Route
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Select your mode of transport and enter the pickup and destination
            pincodes.
          </p>
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <ModeButton
                label="Road"
                icon={<Truck className="mx-auto" />}
                selected={modeOfTransport === "Road"}
                onClick={() => setModeOfTransport("Road")}
              />
              <ModeButton
                label="Rail"
                icon={<Train className="mx-auto" />}
                selected={modeOfTransport === "Rail"}
                onClick={() => setModeOfTransport("Rail")}
              />
              <ModeButton
                label="Air"
                icon={<Plane className="mx-auto" />}
                selected={modeOfTransport === "Air"}
                onClick={() => setModeOfTransport("Air")}
              />
              <ModeButton
                label="Ship"
                icon={<ShipIcon className="mx-auto" />}
                selected={modeOfTransport === "Ship"}
                onClick={() => setModeOfTransport("Ship")}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="fromPincode"
                  className="block text-sm font-medium text-slate-600 mb-1"
                >
                  Origin Pincode
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    id="fromPincode"
                    value={fromPincode}
                    onChange={(e) => setFromPincode(e.target.value)}
                    placeholder="e.g., 400001"
                    maxLength={6}
                    className="w-full pl-11 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="toPincode"
                  className="block text-sm font-medium text-slate-600 mb-1"
                >
                  Destination Pincode
                </label>
                <div className="relative">
                  <MoveRight className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    id="toPincode"
                    value={toPincode}
                    onChange={(e) => setToPincode(e.target.value)}
                    placeholder="e.g., 110001"
                    maxLength={6}
                    className="w-full pl-11 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col md:flex-row justify-between md:items-start gap-6 mb-6">
            <div className="flex-grow">
              <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center">
                <Boxes size={22} className="mr-3 text-indigo-500" /> Shipment
                Details
              </h2>
              <p className="text-sm text-slate-500">
                Enter the dimensions and weight, or select a saved packing list
                to auto-fill.
              </p>
            </div>
            <div
              className="w-full md:w-auto md:min-w-[280px] flex-shrink-0"
              ref={dropdownRef}
            >
              <h3 className="text-lg font-bold text-slate-700 mb-2 flex items-center">
                <PackageSearch size={20} className="mr-2 text-indigo-500" />{" "}
                Saved Packing Lists
              </h3>
              <div className="relative">
                <div className="relative">
                  <input
                    id="search-box"
                    type="text"
                    className="block w-full pl-4 pr-10 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="Select or search a preset..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setIsDropdownOpen(true)}
                  />
                  <ChevronDown
                    className={`absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-transform duration-200 ${
                      isDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </div>
                {isDropdownOpen && (
                  <ul className="absolute z-10 w-full mt-2 border border-slate-200 rounded-lg max-h-48 overflow-y-auto bg-white shadow-lg">
                    {displayableBoxes.length > 0 ? (
                      displayableBoxes.map((box) => (
                        <li
                          key={box._id}
                          onClick={() => handleSelectBox(box)}
                          className="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b last:border-b-0 text-sm text-slate-700"
                        >
                          {box.name}
                        </li>
                      ))
                    ) : (
                      <li className="px-4 py-3 text-sm text-slate-500 italic">
                        {savedBoxes.length === 0
                          ? "No presets saved."
                          : "No matches found."}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <InputField
                label="Number of Boxes"
                id="noofboxes"
                type="number"
                value={noofboxes || ""}
                onChange={(e) =>
                  setNoofboxes(e.target.valueAsNumber || undefined)
                }
                min={1}
                placeholder="e.g., 10"
                required
              />
              <InputField
                label="Length (L) in cm"
                id="length"
                type="number"
                value={length || ""}
                onChange={(e) => setLength(e.target.valueAsNumber || undefined)}
                min={0}
                placeholder="cm"
                required
              />
              <InputField
                label="Width (W) in cm"
                id="width"
                type="number"
                value={width || ""}
                onChange={(e) => setWidth(e.target.valueAsNumber || undefined)}
                min={0}
                placeholder="cm"
                required
              />
              <InputField
                label="Height (H) in cm"
                id="height"
                type="number"
                value={height || ""}
                onChange={(e) => setHeight(e.target.valueAsNumber || undefined)}
                min={0}
                placeholder="cm"
                required
              />
              <InputField
                label="Weight per Box (Kg)"
                id="weightperbox"
                type="number"
                value={weightperbox || ""}
                onChange={(e) =>
                  setWeightperbox(e.target.valueAsNumber || undefined)
                }
                min={0}
                step="0.01"
                placeholder="Kg"
                required
              />
              <InputField
                label="Total Weight (Kg)"
                id="totalWeight"
                type="number"
                value={
                  ((weightperbox ?? 0) * (noofboxes ?? 0)).toFixed(2) || ""
                }
                readOnly
              />
              <div className="flex flex-col">
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-slate-600 mb-1.5"
                >
                  Description
                </label>
                <input
                  id="description"
                  type="text"
                  name="description"
                  placeholder="Item description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="block w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="mt-6 pt-5">
              <div className="flex items-center">
                <input
                  id="save-box-details"
                  type="checkbox"
                  checked={saveBoxDetails}
                  onChange={(e) => {
                    setSaveBoxDetails(e.target.checked);
                    if (e.target.checked) setIsModalOpen(true);
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="save-box-details"
                  className="ml-3 block text-sm font-medium text-slate-700"
                >
                  Save these box dimensions as a new preset
                </label>
              </div>
            </div>
          </div>
        </Card>

        {/* --- UPGRADED Sort & Filter Card --- */}
        <Card>
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center">
                <Award size={22} className="mr-3 text-indigo-500" /> Sort & Filter Results
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
                  selected={sortBy === 'price'}
                  onClick={() => setSortBy('price')}
              />
              <SortOptionButton
                  label="Fastest"
                  icon={<Zap size={16} />}
                  selected={sortBy === 'time'}
                  onClick={() => setSortBy('time')}
              />
              <SortOptionButton
                  label="Highest Rated"
                  icon={<Award size={16} />}
                  selected={sortBy === 'rating'}
                  onClick={() => setSortBy('rating')}
              />
            </div>
            {/* Fine-Tune Button and its relative container */}
            <div className="relative w-full sm:w-auto" ref={fineTuneRef}>
                <button
                    onClick={() => setIsFineTuneOpen(prev => !prev)}
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


        <div className="text-center pt-4 pb-8">
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
          <motion.button
            onClick={calculateQuotes}
            disabled={isCalculating}
            whileHover={{ scale: isCalculating ? 1 : 1.05 }}
            whileTap={{ scale: isCalculating ? 1 : 0.95 }}
            className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 text-white text-lg font-bold rounded-full shadow-lg shadow-indigo-500/50 hover:bg-indigo-700 transition-all duration-300 disabled:opacity-60 disabled:shadow-none"
          >
            {isCalculating ? (
              <Loader2 className="animate-spin" />
            ) : (
              <CalculatorIcon />
            )}
            {isCalculating ? "Calculating Rates..." : "Calculate Freight Cost"}
          </motion.button>
        </div>

        <div id="results" className="space-y-12">
        {(data || hiddendata) && (
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
                ].filter(q => q.message !== "service not available");

                const bestValueQuote = allQuotes.length > 0 ? allQuotes.reduce((prev, current) => (prev.totalCharges < current.totalCharges) ? prev : current) : null;
                const unlockedQuotes = allQuotes.filter(q => !q.isHidden && typeof q.estimatedTime === "number");
                const fastestQuote = unlockedQuotes.length > 0 ? unlockedQuotes.reduce((prev, current) => (prev.estimatedTime! < current.estimatedTime!) ? prev : current) : null;
                
                const processQuotes = (quotes: VendorQuote[] | null) => {
                  if (!quotes) return [];
                  
                  const filtered = quotes.filter(q => {
                    const rating = q.transporterData?.rating ?? 0;
                    if (q.isHidden) {
                      return q.totalCharges <= maxPrice;
                    }
                    return q.totalCharges <= maxPrice &&
                           (q.estimatedTime ?? Infinity) <= maxTime &&
                           rating >= minRating;
                  });

                  return filtered.sort((a, b) => {
                    switch (sortBy) {
                      case 'time':
                        if (a.isHidden && !b.isHidden) return 1;
                        if (!a.isHidden && b.isHidden) return -1;
                        return (a.estimatedTime ?? Infinity) - (b.estimatedTime ?? Infinity);
                      case 'rating':
                        const ratingA = a.transporterData?.rating ?? 0;
                        const ratingB = b.transporterData?.rating ?? 0;
                        return ratingB - ratingA;
                      case 'price':
                      default:
                        return a.totalCharges - b.totalCharges;
                    }
                  });
                };

                const tiedUpVendors = processQuotes(data);
                const otherVendors = processQuotes(hiddendata);

                return (
                <>
                    {tiedUpVendors.length > 0 && (
                    <section>
                        <h2 className="text-2xl font-bold text-slate-800 mb-5 border-l-4 border-indigo-500 pl-4">Your Tied-Up Vendors</h2>
                        <div className="space-y-4">
                        {tiedUpVendors.map((item, index) => (
                            <VendorResultCard key={`tied-up-${index}`} quote={item} isBestValue={item === bestValueQuote} isFastest={item === fastestQuote} />
                        ))}
                        </div>
                    </section>
                    )}
                    {otherVendors.length > 0 && (
                    <section>
                        <h2 className="text-2xl font-bold text-slate-800 mb-5 border-l-4 border-slate-400 pl-4">Other Available Vendors</h2>
                        <div className="space-y-4">
                        {otherVendors.map((item, index) => (
                            <VendorResultCard key={`other-${index}`} quote={item} isBestValue={item === bestValueQuote} isFastest={item === fastestQuote} />
                        ))}
                        </div>
                    </section>
                    )}
                    {tiedUpVendors.length === 0 && otherVendors.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-slate-300">
                            <PackageSearch className="mx-auto h-12 w-12 text-slate-400"/>
                            <h3 className="mt-4 text-xl font-semibold text-slate-700">No Quotes Available</h3>
                            <p className="mt-1 text-base text-slate-500">We couldn't find vendors for the details provided. Try adjusting your filter criteria.</p>
                        </div>
                    )}
                </>
                );
            })()}
            </motion.div>
        )}
        </div>
      </div>

      <SavePresetModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSaveBoxDetails(false); }}
        onSave={handleSavePreset}
      />
    </div>
  );
};


const FineTuneModal = ({
    isOpen, filters, onFilterChange
  }: {
    isOpen: boolean;
    filters: { maxPrice: number; maxTime: number; minRating: number };
    onFilterChange: { setMaxPrice: (val: number) => void; setMaxTime: (val: number) => void; setMinRating: (val: number) => void; };
  }) => {
  
    const formatPrice = (value: number) => {
      if (value >= 10000000) return "Any";
      if (value >= 100000) return `${(value / 100000).toFixed(1)} Lakh`;
      return new Intl.NumberFormat('en-IN').format(value);
    };

    const formatTime = (value: number) => {
        if (value >= 300) return "Any";
        return `${value} Days`;
    }
  
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
                <label htmlFor="maxPrice" className="font-semibold text-slate-700">Max Price</label>
                <span className="font-bold text-indigo-600">₹ {formatPrice(filters.maxPrice)}</span>
            </div>
            <input
                id="maxPrice" type="range" min="1000" max="10000000" step="1000"
                value={filters.maxPrice} onChange={(e) => onFilterChange.setMaxPrice(e.target.valueAsNumber)}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
        </div>

        <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
                <label htmlFor="maxTime" className="font-semibold text-slate-700">Max Delivery Time</label>
                <span className="font-bold text-indigo-600">{formatTime(filters.maxTime)}</span>
            </div>
            <input
                id="maxTime" type="range" min="1" max="300" step="1"
                value={filters.maxTime} onChange={(e) => onFilterChange.setMaxTime(e.target.valueAsNumber)}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
        </div>
        
        <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
                <label htmlFor="minRating" className="font-semibold text-slate-700">Min Vendor Rating</label>
                <span className="font-bold text-indigo-600">{filters.minRating.toFixed(1)} / 5.0</span>
            </div>
            <input
                id="minRating" type="range" min="0" max="5" step="0.1"
                value={filters.minRating} onChange={(e) => onFilterChange.setMinRating(e.target.valueAsNumber)}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
        </div>
      </motion.div>
    );
};


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
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center">
            <Save size={18} className="mr-2 text-indigo-500" /> Save Box Preset
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Give this box configuration a name for future use.
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
      </div>
    </div>
  );
};


const BifurcationDetails = ({ quote }: { quote: any }) => {
  const formatCurrency = (value: number | undefined) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(value || 0);

  const chargeItems = [
    { label: "Base Freight", key: "baseFreight" },
    { label: "Docket Charge", key: "docketCharge" },
    { label: "DACC Charges", key: "daccCharges" },
    { label: "ODA Charges", key: "odaCharges" },
    { label: "Fuel Surcharge", key: "fuelCharges" },
    { label: "Handling Charges", key: "handlingCharges" },
    { label: "Insurance Charges", key: "insuaranceCharges" },
    { label: "Green Tax", key: "greenTax" },
    { label: "Appointment Charges", key: "appointmentCharges" },
    { label: "Minimum Charges", key: "minCharges" },
    { label: "ROV Charges", key: "rovCharges" },
    { label: "FM Charges", key: "fmCharges" },
    { label: "Miscellaneous Charges", key: "miscCharges" },
  ];

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="overflow-hidden"
    >
      <div className="border-t border-slate-200 mt-4 pt-4">
        <h4 className="font-semibold text-slate-700 mb-3">Cost Breakdown</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          {chargeItems.map((item) => (
            item.key in quote && quote[item.key] > 0 && (
                <div key={item.key} className="flex justify-between">
                <span className="text-slate-500">{item.label}:</span>
                <span className="font-medium text-slate-800">
                    {formatCurrency(quote[item.key])}
                </span>
                </div>
            )
          ))}
        </div>
        <div className="border-t border-slate-200 mt-4 pt-4">
            <h4 className="font-semibold text-slate-700 mb-3">Shipment Info</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                 <div className="flex justify-between"><span className="text-slate-500">Chargeable Wt:</span><span className="font-medium text-slate-800">{quote.chargeableWeight} Kg</span></div>
                 <div className="flex justify-between"><span className="text-slate-500">Distance:</span><span className="font-medium text-slate-800">{quote.distance}</span></div>
                 <div className="flex justify-between"><span className="text-slate-500">Origin:</span><span className="font-medium text-slate-800">{quote.originPincode}</span></div>
                 <div className="flex justify-between"><span className="text-slate-500">Destination:</span><span className="font-medium text-slate-800">{quote.destinationPincode}</span></div>
            </div>
        </div>
      </div>
    </motion.div>
  );
};


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

  const handleMoreDetailsClick = () => {
    const isSubscribed = (user as any)?.customer?.isSubscribed;

    if (isSubscribed) {
      const transporterId = quote.transporterData?._id;
      if (transporterId) {
        navigate(`/transporterdetails/${transporterId}`);
      } else {
        console.error("Transporter ID is missing from the quote data.");
        alert("Sorry, the transporter details could not be retrieved.");
      }
    } else {
      navigate("/buy-subscription-plan");
    }
  };

  if (quote.isHidden) {
    return (
      <div
        className={`relative bg-white p-5 rounded-2xl border-2 transition-all duration-300 ${
          isBestValue ? "border-green-400 shadow-lg" : "border-slate-200"
        }`}
      >
        <div className="relative z-0 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-slate-200 flex items-center justify-center border border-slate-300">
              <Lock className="text-slate-500" size={28} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-700">
                {quote.companyName}
              </h3>
              <p className="text-sm text-slate-500">
                Time & Details are Hidden
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 font-bold text-3xl text-slate-900">
              <IndianRupee size={22} className="text-slate-600" />
              <span>
                {new Intl.NumberFormat("en-IN").format(quote.totalCharges)}
              </span>
            </div>
            <div className="text-xs text-slate-500 -mt-1">Total Charges</div>
          </div>
          <button className="px-5 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30">
            Unlock to Book
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative bg-white p-5 rounded-2xl border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
        isBestValue ? "border-green-400 shadow-lg" : "border-slate-200"
      }`}
    >
      <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
        {isFastest && (
          <div className="flex items-center gap-1.5 bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1.5 rounded-full">
            <Zap size={14} />
            <span>Fastest Delivery</span>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row items-start justify-between gap-5">
        <div className="flex-1 flex items-start gap-4">
          <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
            <Building2 className="text-slate-500" size={28} />
          </div>
          <div className="flex flex-col">
            <h3 className="font-bold text-lg text-slate-800 pr-28 md:pr-0">
              {quote.companyName}
            </h3>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 flex items-center gap-1.5 text-indigo-600 font-semibold text-sm hover:text-indigo-800 transition-colors"
            >
              {isExpanded ? "Hide Details" : "Show Bifurcation"}
              <ChevronRight
                size={16}
                className={`transition-transform duration-300 ${
                  isExpanded ? "rotate-90" : "rotate-0"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex flex-row md:flex-col items-end gap-x-6 md:gap-y-1 w-full md:w-auto text-right">
          <div className="flex-1 md:flex-initial">
            <div className="flex items-center justify-end gap-1 font-bold text-3xl text-slate-900">
              <IndianRupee size={22} className="text-slate-600" />
              <span>
                {new Intl.NumberFormat("en-IN", {
                    maximumFractionDigits: 2,
                }).format(quote.totalCharges)}
              </span>
            </div>
            
            <div className="flex items-center justify-end gap-x-2 -mt-1">
              <span className="text-xs text-slate-500">Total Charges</span>
              <span className="text-slate-300">·</span>
              <button
                onClick={handleMoreDetailsClick}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Contact Now
              </button>
            </div>
          </div>

          <div className="flex-1 md:flex-initial mt-0 md:mt-2">
            <div className="flex items-center justify-end gap-2 font-semibold text-slate-700 text-lg">
              <Clock size={16} className="text-slate-500" />
              <span>{quote.estimatedTime} Days</span>
            </div>
            <div className="text-xs text-slate-500">Est. Delivery</div>
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {isExpanded && <BifurcationDetails quote={quote} />}
      </AnimatePresence>
    </div>
  );
};

export default CalculatorPage;