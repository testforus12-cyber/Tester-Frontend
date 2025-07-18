import { useState, useEffect, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { PlusCircleIcon, TableCellsIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

// HELPER COMPONENT: StyledInputField
const StyledInputField = ({
  name,
  label,
  value,
  onChange,
  type = "text",
  maxLength
}: {
  name: string;
  label: string;
  value?: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: "text" | "number" | "email";
  maxLength?: number;
}) => (
  <div>
    <label htmlFor={name} className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
      {label}
    </label>
    <input
      type={type}
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      min={type === "number" ? 0 : undefined} // Prevents negative numbers via input arrows
      maxLength={maxLength}
      className="mt-1 block w-full bg-slate-50/70 border border-slate-300 rounded-lg shadow-sm px-3 py-2 text-sm text-slate-800 placeholder-slate-400
                 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
      required
    />
  </div>
);

// HELPER COMPONENT: RatingSlider
const RatingSlider = ({
  label,
  value,
  onChange
}: {
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => {
  const displayValue = Number(value).toFixed(1);

  return (
    <div className="sm:col-span-2 lg:col-span-1">
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
        {label}
      </label>
      <div className="mt-2 flex items-center gap-4">
        <input
          type="range"
          name="rating" // Crucial for the handleChange function
          min="1"
          max="5"
          step="0.01" // Allows for half-star ratings
          value={value}
          onChange={onChange}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-blue-500"
        />
        <div className="flex-shrink-0 w-16 text-right">
          <span className="text-xl font-bold text-blue-600">{displayValue}</span>
          <span className="text-sm text-slate-500"> / 5</span>
        </div>
      </div>
    </div>
  );
};


// --- MAIN COMPONENT ---
const AddTiedUpCompany = () => {
  const customerID = Cookies.get("authToken");
  const [form, setForm] = useState({
    customerID: customerID, vendorCode: "", vendorPhone: "", vendorEmail: "", gstNo: "",
    mode: "", address: "", state: "", pincode: "", rating: "3", // Default rating for the slider
    companyName: ""
  });

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCompanySuggestions = (query: string) => {
    axios
      .get(`https://backend-bcxr.onrender.com/api/transporter/gettransporter?search=${encodeURIComponent(query)}`)
      .then(res => setSuggestions(res.data))
      .catch(() => setSuggestions([]));
  };
  
  const [priceRate, setPriceRate] = useState<any>({});
  const [priceChart, setPriceChart] = useState<{ [pincode: string]: { [zone: string]: number } }>({});
  const [pincodeInput, setPincodeInput] = useState("");
  const [zoneInput, setZoneInput] = useState("");
  const [zones, setZones] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- HANDLERS WITH VALIDATION ---

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { name, value } = e.target;
    // Validation: Pincode length and non-negative numbers
    if (name === 'pincode' && value.length > 6) return;
    if (e.target.type === "number" && Number(value) < 0) return;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleNestedInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (parseFloat(value) < 0) return;
    const keys = name.split(".");
    setPriceRate((prev: any) => {
      const updated = JSON.parse(JSON.stringify(prev));
      let nested = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        nested[keys[i]] = nested[keys[i]] || {};
        nested = nested[keys[i]];
      }
      nested[keys[keys.length - 1]] = value ? parseFloat(value) : undefined;
      return updated;
    });
  };

  const handlePriceChange = (pincode: string, zone: string, value: number) => {
    if (value < 0) return;
    setPriceChart(prev => ({
      ...prev,
      [pincode]: { ...prev[pincode], [zone]: value }
    }));
  };

  const handleAddPincode = () => {
    const newPincode = pincodeInput.trim();
    if (!/^\d{6}$/.test(newPincode)) {
        toast.error("Pincode must be exactly 6 digits.");
        return;
    }
    if (priceChart[newPincode]) {
        toast.error("This pincode has already been added.");
        return;
    }
    setPriceChart(prev => ({ ...prev, [newPincode]: zones.reduce((acc, z) => ({ ...acc, [z]: 0 }), {}) }));
    setPincodeInput("");
    toast.success(`Pincode ${newPincode} added to chart.`);
  };

  const handleAddZone = () => {
    const newZone = zoneInput.trim();
    if (!newZone) return;
    if (zones.includes(newZone)) {
        toast.error(`Zone "${newZone}" already exists.`);
        return;
    }
    setZones(prev => [...prev, newZone]);
    setPriceChart(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(pincode => { updated[pincode][newZone] = 0; });
      return updated;
    });
    setZoneInput("");
    toast.success(`Zone "${newZone}" added.`);
  };
  const token = Cookies.get("authToken");
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(form.pincode)) {
        toast.error("Company Pincode must be exactly 6 digits.");
        return;
    }
    setIsSubmitting(true);
    const toastId = toast.loading("Submitting form...");
    try {
      const payload = { ...form, vendorPhone: Number(form.vendorPhone), pincode: Number(form.pincode), rating: Number(form.rating), priceRate, priceChart };
      const res = await axios.post("https://backend-bcxr.onrender.com/api/transporter/add-tied-up", payload, {headers: {Authorization: `Bearer ${token}`}});

      if (res.data.success) {
        toast.success(res.data.message, { id: toastId, duration: 4000 });
        setForm({ customerID: customerID, vendorCode: "", vendorPhone: "", vendorEmail: "", gstNo: "", mode: "", address: "", state: "", pincode: "", rating: "3", companyName: "" });
        setPriceRate({});
        setPriceChart({});
        setZones([]);
      } else {
        toast.error(res.data.message, { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Submission failed. An unexpected error occurred.", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm(prev => ({ ...prev, companyName: value }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim()) {
      debounceRef.current = setTimeout(() => {
        fetchCompanySuggestions(value);
        setShowSuggestions(true);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (name: string) => {
    setForm(prev => ({ ...prev, companyName: name }));
    setShowSuggestions(false);
  };

  return (
    <div className="bg-slate-100 min-h-screen font-sans">
      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Add Tied-Up Company</h1>
          <p className="mt-2 text-md text-slate-500">Create a new partner profile with detailed pricing information.</p>
        </header>
        
        {/* Section 1: Company Details */}
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm transition-all">
          <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-4 mb-6">Company Information</h3>
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative">
            <label htmlFor="companyName" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Company Name
            </label>
            <input
              type="text"
              id="companyName"
              name="companyName"
              value={form.companyName}
              onChange={handleCompanyChange}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
              onFocus={() => form.companyName.trim() && setShowSuggestions(true)}
              className="mt-1 block w-full bg-slate-50/70 border border-slate-300 rounded-lg px-3 py-2 text-sm"
              autoComplete="off"
              required
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-auto">
                {suggestions.map(name => (
                  <li
                    key={name}
                    className="px-3 py-2 hover:bg-blue-100 cursor-pointer"
                    onMouseDown={() => handleSuggestionClick(name)}
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>
            <StyledInputField name="vendorCode" label="Vendor Code" value={form.vendorCode} onChange={handleChange} />
            <StyledInputField name="vendorPhone" label="Vendor Phone" type="number" value={form.vendorPhone} onChange={handleChange} />
            <StyledInputField name="vendorEmail" label="Vendor Email" type="email" value={form.vendorEmail} onChange={handleChange} />
            <StyledInputField name="gstNo" label="GST No." value={form.gstNo} onChange={handleChange} />
            <div className="sm:col-span-2">
                <StyledInputField name="address" label="Address" value={form.address} onChange={handleChange} />
            </div>
            <StyledInputField name="state" label="State" value={form.state} onChange={handleChange} />
            <StyledInputField name="pincode" label="Pincode (6 digits)" type="number" value={form.pincode} onChange={handleChange} maxLength={6} />
            <StyledInputField name="mode" label="Transport Mode" value={form.mode} onChange={handleChange} />
            
            <RatingSlider
                label="Company Rating"
                value={form.rating}
                onChange={handleChange}
            />
          </div>
        </div>

        {/* Section 2: Price Rate */}
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm transition-all">
          <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-4 mb-6">Price Rate Configuration</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
            <StyledInputField name="minWeight" label="Min. Weight (kg)" type="number" onChange={handleNestedInputChange} />
            <StyledInputField name="docketCharges" label="Docket Charges (₹)" type="number" onChange={handleNestedInputChange} />
            <StyledInputField name="fuel" label="Fuel Surcharge (%)" type="number" onChange={handleNestedInputChange} />
            <StyledInputField name="divisor" label="Volumetric Divisor" type="number" onChange={handleNestedInputChange} />
            <StyledInputField name="minCharges" label="Min. Charges (₹)" type="number" onChange={handleNestedInputChange} />
            <StyledInputField name="greenTax" label="Green Tax (₹)" type="number" onChange={handleNestedInputChange} />
            <StyledInputField name="daccCharges" label="DACC Charges (₹)" type="number" onChange={handleNestedInputChange} />
            <StyledInputField name="miscellanousCharges" label="Misc. Charges (₹)" type="number" onChange={handleNestedInputChange} />
          </div>
          <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-slate-50/70 p-4 rounded-lg space-y-4 ring-1 ring-slate-200">
                  <h4 className="font-medium text-slate-700">Handling Charges</h4>
                  <StyledInputField name="handlingCharges.fixed" label="Fixed Rate (₹)" type="number" onChange={handleNestedInputChange} />
                  <StyledInputField name="handlingCharges.variable" label="Variable Rate (%)" type="number" onChange={handleNestedInputChange} />
                  <StyledInputField name="handlingCharges.threshholdweight" label="Weight Threshold (Kg)" type="number" onChange={handleNestedInputChange} />
              </div>
              {['rovCharges', 'codCharges', 'topayCharges', 'appointmentCharges'].map(key => (
                <div key={key} className="bg-slate-50/70 p-4 rounded-lg space-y-4 ring-1 ring-slate-200">
                  <h4 className="font-medium text-slate-700 capitalize">{key.replace('Charges', ' Charges')}</h4>
                  <StyledInputField name={`${key}.fixed`} label="Fixed Rate (₹)" type="number" onChange={handleNestedInputChange} />
                  <StyledInputField name={`${key}.variable`} label="Variable Rate (%)" type="number" onChange={handleNestedInputChange} />
                </div>
              ))}
          </div>
        </div>
        
        {/* Section 3: Price Chart */}
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm transition-all">
          <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-4 mb-6">Zonal Price Chart</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 mb-6 bg-slate-50/70 p-4 rounded-lg ring-1 ring-slate-200">
            <div className="w-full sm:w-auto flex-1">
                <StyledInputField label="New Pincode" name="pincodeInput" value={pincodeInput} onChange={(e) => {if(e.target.value.length <= 6 && Number(e.target.value)>=0) setPincodeInput(e.target.value)}} type="number" maxLength={6}/>
            </div>
            <button type="button" onClick={handleAddPincode} disabled={pincodeInput.length !== 6} className="h-10 w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-white bg-slate-700 rounded-lg shadow-sm hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"> <PlusCircleIcon className="h-5 w-5"/> Add Pincode </button>
            <div className="hidden sm:block border-l h-10 border-slate-300 mx-2"></div>
            <div className="w-full sm:w-auto flex-1">
                <StyledInputField label="New Zone" name="zoneInput" value={zoneInput} onChange={(e) => setZoneInput(e.target.value)} />
            </div>
            <button type="button" onClick={handleAddZone} disabled={!zoneInput.trim()} className="h-10 w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-white bg-slate-700 rounded-lg shadow-sm hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"> <PlusCircleIcon className="h-5 w-5"/> Add Zone </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            {zones.length > 0 && Object.keys(priceChart).length > 0 ? (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Pincode</th>
                    {zones.map(zone => (
                      <th key={zone} className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">{zone} (₹/kg)</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {Object.keys(priceChart).map(pincode => (
                    <tr key={pincode} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{pincode}</td>
                      {zones.map(zone => (
                        <td key={zone} className="px-6 py-4">
                          <input type="number" min="0" value={priceChart[pincode][zone] ?? 0}
                            onChange={e => handlePriceChange(pincode, zone, parseFloat(e.target.value) || 0)}
                            className="w-24 block px-2 py-1 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-16 px-6">
                <TableCellsIcon className="mx-auto h-12 w-12 text-slate-400" />
                <h4 className="mt-2 text-lg font-medium text-slate-800">Price Chart Is Empty</h4>
                <p className="mt-1 text-sm text-slate-500">Add at least one zone and pincode to build the rate table.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="group inline-flex items-center justify-center gap-2 py-3 px-8 text-sm font-semibold tracking-wide rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-wait transition-all ease-in-out duration-300"
          >
            <CheckCircleIcon className="h-5 w-5 transform group-hover:scale-110 transition-transform"/>
            {isSubmitting ? "Submitting..." : "Save Company"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddTiedUpCompany;