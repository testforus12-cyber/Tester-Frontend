import React, { useState, useEffect, useCallback, FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CheckCircle,
  DollarSign,
  MapPin,
  Package, // UPDATED: Using Package icon
  SlidersHorizontal,
  Sparkles,
  ThumbsUp,
  Truck,
  Users,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform } from "framer-motion";

// --- Ensure these paths are correct for your project structure ---
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";

import landingBgPattern from "../assets/landing-bg-final.png";
import BlueDartLogo from "../assets/logos/bluedart.svg";
import DelhiveryLogo from "../assets/logos/delhivery.svg";
import DTDCLogo from "../assets/logos/dtdc.svg";
import FedExLogo from "../assets/logos/fedex.svg";

// --- TYPES & HELPERS (FROM YOUR ORIGINAL CODE) ---
type LatLng = { lat: number; lng: number };

const PINCODE_PREFIX_LOCATIONS: Record<string, LatLng> = {
  '1100': { lat: 28.6139, lng: 77.2090 }, '1220': { lat: 28.4595, lng: 77.0266 }, '1406': { lat: 30.7333, lng: 76.7794 },
  '2013': { lat: 28.5355, lng: 77.3910 }, '2260': { lat: 26.8467, lng: 80.9462 }, '3020': { lat: 26.9124, lng: 75.7873 },
  '3800': { lat: 23.0225, lng: 72.5714 }, '4000': { lat: 19.0760, lng: 72.8777 }, '4110': { lat: 18.5204, lng: 73.8567 },
  '5000': { lat: 17.3850, lng: 78.4867 }, '5600': { lat: 12.9716, lng: 77.5946 }, '6000': { lat: 13.0827, lng: 80.2707 },
  '6820': { lat: 9.9312, lng: 76.2673 },  '7000': { lat: 22.5726, lng: 88.3639 }, '7810': { lat: 26.1445, lng: 91.7362 },
};

const REGION_CENTERS: Record<string, LatLng> = {
  '1': { lat: 28.61, lng: 77.21 }, '2': { lat: 26.85, lng: 80.95 }, '3': { lat: 26.91, lng: 75.79 }, '4': { lat: 19.07, lng: 72.87 },
  '5': { lat: 17.38, lng: 78.48 }, '6': { lat: 13.08, lng: 80.27 }, '7': { lat: 22.57, lng: 88.36 }, '8': { lat: 25.61, lng: 85.13 },
};
const INDIA_CENTER: LatLng = { lat: 22.0, lng: 79.0 };

const toRad = (deg: number) => (deg * Math.PI) / 180;
const haversine = (a: LatLng, b: LatLng): number => {
  const R = 6371; const dLat = toRad(b.lat - a.lat); const dLon = toRad(b.lng - a.lng);
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat); const h = Math.sin(dLat / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
const getCentroid = (pin: string): LatLng => {
  if (pin.length < 4) return INDIA_CENTER; const prefix4 = pin.substring(0, 4); const prefix1 = pin[0];
  return PINCODE_PREFIX_LOCATIONS[prefix4] || REGION_CENTERS[prefix1] || INDIA_CENTER;
};


// =======================================================================================================
// === START OF NEW & UPGRADED COMPONENTS FOR THE INTERACTIVE HERO ===
// =======================================================================================================
const AnimatedNumber = ({ value }: { value: number }) => {
    const motionValue = useMotionValue(0);
    const springValue = useSpring(motionValue, { stiffness: 100, damping: 30 });
    const displayValue = useTransform(springValue, (latest) => `₹ ${Math.round(latest).toLocaleString('en-IN')}`);
    useEffect(() => { motionValue.set(value); }, [motionValue, value]);
    return <motion.span>{displayValue}</motion.span>;
};

const QuoteCard = ({ carrier, logo, price, eta, isBest, delay }: { carrier: string; logo: string; price: number; eta: number; isBest: boolean; delay: number; }) => (
    <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
        className={`relative bg-white border rounded-xl p-5 transition-all duration-300 ${isBest ? 'border-yellow-400 shadow-2xl scale-105' : 'border-slate-200 shadow-lg'}`}
    >
        {isBest && (
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-400 text-slate-900 text-xs font-bold rounded-full shadow-md">BEST VALUE</div>
        )}
        <div className="flex items-center justify-between mb-4 mt-2">
            <h3 className="text-lg font-bold text-slate-800">{carrier}</h3>
            <img src={logo} alt={carrier} className="h-7" />
        </div>
        <div className="flex items-end justify-between text-left">
            <div>
                <p className="text-3xl font-bold text-blue-600"><AnimatedNumber value={price} /></p>
                <p className="text-sm text-slate-500">Estimated Cost</p>
            </div>
            <div className="text-right">
                <p className="text-xl font-semibold text-slate-700">{eta} days</p>
                <p className="text-sm text-slate-500">Est. Delivery</p>
            </div>
        </div>
    </motion.div>
);

// --- Your Existing Components & Data (Unchanged) ---
const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.15 } }, };
const staggerItem = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.42, 0, 0.58, 1] } }, };

const MotionSection: React.FC<{ children: ReactNode; className?: string }> = ({ children, className }) => (
    <motion.section initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}
        variants={{ hidden: {}, show: {} }} transition={{ duration: 0.6, ease: "easeOut" }} className={className}>
        {children}
    </motion.section>
);

const STEPS = [
  { stepNumber: '1', title: 'Enter Details', description: 'Provide your shipment origin, destination, and package specifics (weight, dimensions).', icon: SlidersHorizontal },
  { stepNumber: '2', title: 'Compare Quotes', description: 'Instantly see real-time rates and delivery times from a wide range of trusted carriers.', icon: BarChart3 },
  { stepNumber: '3', title: 'Choose & Ship', description: 'Select the best option that fits your budget and needs, then book your shipment.', icon: CheckCircle },
];

const FEATURES = [
  { icon: Zap, title: 'Real-Time Rates', description: 'Access up-to-the-minute pricing from multiple carriers in one place.' },
  { icon: Users, title: 'Wide Carrier Network', description: 'Compare options from local couriers to global logistics giants.' },
  { icon: DollarSign, title: 'Save Big', description: 'Find the most cost-effective shipping solutions and reduce your expenses.' },
  { icon: ThumbsUp, title: 'Transparent Pricing', description: 'No hidden fees. What you see is what you pay. Full cost breakdown.' },
  { icon: Sparkles, title: 'Easy-to-Use', description: 'Intuitive interface designed for speed and simplicity, even for complex shipments.' },
  { icon: Truck, title: 'All Shipment Types', description: 'From small parcels to large freight, we cover a wide range of shipping needs.' },
];

const CARRIERS_LOGOS = [
  { src: BlueDartLogo, alt: 'Blue Dart' }, { src: DelhiveryLogo, alt: 'Delhivery' },
  { src: DTDCLogo, alt: 'DTDC' }, { src: FedExLogo, alt: 'FedEx' },
];

const StepCard: React.FC<{ stepNumber: string; title: string; description: string; icon: React.ElementType }> = ({ stepNumber, title, description, icon: Icon }) => (
  <motion.div variants={staggerItem} className="relative mt-8">
    <div className="bg-white rounded-xl shadow-lg p-8 pt-12 text-center h-full group hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center justify-center w-12 h-12 bg-blue-600 text-white rounded-full font-bold text-xl shadow-md border-4 border-white">
        {stepNumber}
      </div>
      <div className="mb-4 inline-block p-4 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
        <Icon className="w-8 h-8 text-blue-600" />
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  </motion.div>
);
const FeatureCard: React.FC<{ icon: React.ElementType; title: string; description: string }> = ({ icon: Icon, title, description }) => (
  <motion.div variants={staggerItem} className="bg-white rounded-xl shadow-lg p-6 text-center h-full group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
    <div className="mb-4 inline-block p-4 bg-yellow-100 rounded-full transition-colors group-hover:bg-yellow-200">
      <Icon className="w-8 h-8 text-yellow-500" />
    </div>
    <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
    <p className="text-slate-500 leading-relaxed">{description}</p>
  </motion.div>
);

// --- MAIN LANDING PAGE COMPONENT ---
const LandingPage: React.FC = () => {
  const [fromPincode, setFromPincode] = useState("110001");
  const [toPincode, setToPincode] = useState("560001");
  const [weight, setWeight] = useState("5.1");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);

  const handleCalculate = useCallback((e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResults([]);

    if (!/^\d{6}$/.test(fromPincode) || !/^\d{6}$/.test(toPincode)) {
        setError("Please enter valid 6-digit pincodes.");
        return;
    }
    const w = parseFloat(weight);
    if (isNaN(w) || w < 0.1) {
        setError("Please enter a valid weight (at least 0.1 kg).");
        return;
    }

    const origin = getCentroid(fromPincode);
    const dest = getCentroid(toPincode);
    const dist = haversine(origin, dest);

    const quotes = [
        { carrier: 'Express Wings', logo: DelhiveryLogo, baseCost: 35, kmRate: 0.18, kgRate: 20, speedFactor: 1.0 },
        { carrier: 'Value Connect', logo: DTDCLogo, baseCost: 45, kmRate: 0.15, kgRate: 18, speedFactor: 1.2 },
        { carrier: 'Blue Dart', logo: BlueDartLogo, baseCost: 60, kmRate: 0.22, kgRate: 25, speedFactor: 0.8 },
        { carrier: 'Global Post', logo: FedExLogo, baseCost: 80, kmRate: 0.30, kgRate: 30, speedFactor: 0.7 }
    ];

    const calculatedQuotes = quotes.map(q => {
        const cost = Math.round(q.baseCost + (dist * q.kmRate) + (w * q.kgRate));
        const eta = Math.ceil((dist / 500) * q.speedFactor) + 1;
        return { ...q, price: cost, eta };
    });
    
    const bestQuote = calculatedQuotes.reduce((best, current) => {
        const bestScore = best.price * (best.eta * 0.9);
        const currentScore = current.price * (current.eta * 0.9);
        return currentScore < bestScore ? current : best;
    });

    setResults(calculatedQuotes.map(q => ({...q, isBest: q.carrier === bestQuote.carrier})).sort((a,b) => a.price - b.price));
    setTimeout(() => document.getElementById("results-section")?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  }, [fromPincode, toPincode, weight]);

  return (
    <div className="font-sans text-gray-700 bg-white">
      <Header />
      <main>
        {/* =============================================================== */}
        {/* === START OF REPLACED & CORRECTED HERO SECTION === */}
        {/* =============================================================== */}
        <div role="banner" className="relative pt-24 pb-16 sm:pt-32 sm:pb-20 bg-slate-50 border-b border-slate-200">
             <div className="container mx-auto px-6 text-center relative z-10 flex flex-col items-center">
                <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
                    className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 mb-4 leading-tight">
                  Stop Overpaying for Shipping.<br />
                  <span className="text-blue-600">Find the Best Rates, Instantly.</span>
                </motion.h1>
                 <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
                    className="text-lg md:text-xl mb-10 max-w-3xl mx-auto text-slate-600">
                    We compare real-time quotes from top carriers, saving you time and money. Use our live demo to see how much you can save.
                 </motion.p>
                
                 <motion.div initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1]}}
                    className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl">
                     <form onSubmit={handleCalculate} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-5 text-left">
                           <label htmlFor="from" className="font-semibold text-sm text-slate-600 mb-1.5 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-blue-600"/>Origin Pincode</label>
                           <input id="from" value={fromPincode} onChange={e=>setFromPincode(e.target.value.replace(/\D/g, ''))} type="text" pattern="\d{6}" maxLength={6} placeholder="e.g., 110001" required className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"/>
                        </div>
                        <div className="md:col-span-5 text-left">
                           <label htmlFor="to" className="font-semibold text-sm text-slate-600 mb-1.5 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-yellow-500"/>Destination Pincode</label>
                           <input id="to" value={toPincode} onChange={e=>setToPincode(e.target.value.replace(/\D/g, ''))} type="text" pattern="\d{6}" maxLength={6} placeholder="e.g., 560001" required className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"/>
                        </div>
                        <div className="md:col-span-2 text-left"> {/* FIXED: Changed to md:col-span-2 for better spacing */}
                           <label htmlFor="weight" className="font-semibold text-sm text-slate-600 mb-1.5 flex items-center gap-1.5">
                             <Package className="w-4 h-4 text-slate-500"/> {/* FIXED: Package icon */}
                             Weight (kg) {/* FIXED: Clearer label text */}
                           </label>
                           <input id="weight" value={weight} onChange={e=>setWeight(e.target.value)} type="number" step="0.1" min="0.1" placeholder="5.1" required className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"/>
                        </div>
                        <div className="md:col-span-12"> {/* Button now takes full width on a new line below for better mobile and desktop view */}
                           <button type="submit" className="w-full mt-2 h-full py-3 bg-blue-600 text-white text-lg font-bold rounded-lg shadow-md hover:bg-blue-700 transition-all transform hover:scale-[1.02] flex items-center justify-center">Compare</button>
                        </div>
                     </form>
                     {error && <p className="text-red-600 text-sm font-semibold text-left mt-3">{error}</p>}
                 </motion.div>
             </div>
        </div>

        <AnimatePresence>
            {results.length > 0 && (
                <motion.div id="results-section" initial={{ opacity: 0 }} animate={{ opacity: 1}} exit={{ opacity: 0}} className="py-20 bg-white">
                    <div className="container mx-auto px-6">
                        <motion.h2 initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay: 0.1}}
                         className="text-3xl font-extrabold text-slate-900 text-center mb-10">Your Live Quotes are Ready!</motion.h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {results.map((quote, i) => ( <QuoteCard key={quote.carrier} {...quote} delay={i * 0.08 + 0.2} /> ))}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
        {/* =============================================================== */}
        {/* === END OF REPLACED HERO SECTION === */}
        {/* =============================================================== */}



        {/* =============================================================== */}
        {/* === YOUR ORIGINAL CODE. PERFECT AND UNTOUCHED, AS REQUESTED. === */}
        {/* =============================================================== */}
        <MotionSection className="py-20 bg-slate-50">
          <section aria-labelledby="how-it-works-title" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 id="how-it-works-title" className="text-3xl md:text-4xl font-extrabold text-slate-900">Simple Steps to Smart Shipping</h2>
              <p className="mt-4 text-slate-600 text-lg max-w-2xl mx-auto">Getting the best shipping deal is as easy as 1-2-3. Let us show you how:</p>
            </div>
            <motion.div variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {STEPS.map(step => <StepCard key={step.stepNumber} {...step} />)}
            </motion.div>
          </section>
        </MotionSection>

        <MotionSection className="py-20 bg-white">
          <section aria-labelledby="features-title" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 id="features-title" className="text-3xl md:text-4xl font-extrabold text-slate-900">Everything You Need for Smarter Logistics</h2>
              <p className="mt-4 text-slate-600 text-lg max-w-2xl mx-auto">Our platform is packed with features to simplify your shipping process.</p>
            </div>
            <motion.div variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {FEATURES.map((feature, idx) => <FeatureCard key={idx} {...feature} />)}
            </motion.div>
          </section>
        </MotionSection>

        <MotionSection className="py-20 bg-slate-50">
          <section aria-labelledby="trusted-by-title" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 id="trusted-by-title" className="text-2xl font-semibold text-slate-700 text-center mb-10">Compare Rates from Leading Carriers</h2>
            <div className="flex flex-wrap justify-center items-center gap-x-12 sm:gap-x-16 gap-y-8">
              {CARRIERS_LOGOS.map((c, i) => (
                <img key={i} src={c.src} alt={c.alt} loading="lazy" className="h-10 sm:h-12 object-contain transition-transform duration-300 hover:scale-110" />
              ))}
            </div>
          </section>
        </MotionSection>

        <MotionSection className="py-20 bg-blue-600 bg-cover bg-center" style={{ backgroundImage: `url(${landingBgPattern})` }}>
          <section aria-labelledby="cta-title" className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
            <h2 id="cta-title" className="text-3xl md:text-4xl font-extrabold mb-4">Ready to Optimize Your Shipping Costs?</h2>
            <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto text-blue-100">Join thousands of businesses already saving time and money. Get started for free today!</p>
            <Link to="/userselect" className="inline-flex items-center justify-center bg-yellow-400 text-slate-900 font-bold px-10 py-4 rounded-lg hover:bg-yellow-300 transform hover:scale-105 transition-all text-lg shadow-2xl">
              Create Your Free Account <ArrowRight className="w-6 h-6 ml-3" />
            </Link>
          </section>
        </MotionSection>
      </main>
      <Footer />
    </div>
  );
};

export default React.memo(LandingPage);