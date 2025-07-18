import React from 'react';
import { CalendarClock, Weight, DollarSign, Download, ArrowRight } from 'lucide-react';

// Utility functions
const formatCurrency = (value) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const formatWeight = (value) => `${value.toFixed(2)} kg`;

// Hardcoded quotes data
const quotes = [
  {
    id: '1',
    name: 'FastFreight',
    logo: '/fastfreight.png',
    estimatedDeliveryDays: 2,
    chargeableWeight: 4624,
    baseFare: 1500,
    perKmCharge: 27450,
    perKgCharge: 23200,
    handlingCharge: 500,
    surcharges: 0,
    totalPrice: 52570,
  },
  {
    id: '2',
    name: 'EcoLogistics',
    logo: '/ecologistics.png',
    estimatedDeliveryDays: 3,
    chargeableWeight: 4624,
    baseFare: 1200,
    perKmCharge: 21960,
    perKgCharge: 18496,
    handlingCharge: 450,
    surcharges: 0,
    totalPrice: 42106,
  },
  {
    id: '3',
    name: 'PrimeShip',
    logo: '/primeship.png',
    estimatedDeliveryDays: 2,
    chargeableWeight: 4624,
    baseFare: 1400,
    perKmCharge: 25620,
    perKgCharge: 20808,
    handlingCharge: 550,
    surcharges: 0,
    totalPrice: 48378,
  },
  {
    id: '4',
    name: 'GlobalCargo',
    logo: '/globalcargo.png',
    estimatedDeliveryDays: 2,
    chargeableWeight: 4624,
    baseFare: 1600,
    perKmCharge: 29280,
    perKgCharge: 25432,
    handlingCharge: 600,
    surcharges: 0,
    totalPrice: 56912,
  }
];

// Find cheapest and fastest quotes
const cheapestQuote = quotes.reduce((a, b) => a.totalPrice < b.totalPrice ? a : b);
const fastestQuote = quotes.reduce((a, b) => a.estimatedDeliveryDays < b.estimatedDeliveryDays ? a : b);

const VendorComparison = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Vendor Comparison</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {quotes.map((quote) => (
          <div
            key={quote.id}
            className={`rounded-lg border p-4 transition-all ${
              quote.id === cheapestQuote.id
                ? 'border-green-200 bg-green-50'
                : quote.id === fastestQuote.id
                ? 'border-blue-200 bg-blue-50'
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden">
                <img
                  src={quote.logo || '/placeholder-logo.png'}
                  alt={quote.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="font-bold text-lg">{quote.name}</h3>
                {quote.id === cheapestQuote.id && (
                  <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                    Best Value
                  </span>
                )}
                {quote.id === fastestQuote.id && quote.id !== cheapestQuote.id && (
                  <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    Fastest Option
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                  <CalendarClock size={14} />
                  <span>Delivery Time</span>
                </div>
                <p className="font-semibold">
                  {quote.estimatedDeliveryDays} {quote.estimatedDeliveryDays === 1 ? 'day' : 'days'}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                  <Weight size={14} />
                  <span>Chargeable</span>
                </div>
                <p className="font-semibold">{formatWeight(quote.chargeableWeight)}</p>
              </div>

              <div>
                <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                  <DollarSign size={14} />
                  <span>Total Cost</span>
                </div>
                <p className="font-semibold text-blue-700">{formatCurrency(quote.totalPrice)}</p>
              </div>
            </div>

            <div className="flex justify-between mt-4">
              <button className="text-sm text-gray-600 flex items-center gap-1 hover:text-gray-800 transition-colors">
                <Download size={16} /> Download Quote
              </button>

              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm flex items-center gap-1 transition-colors">
                Book Now <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chargeable Weight</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Base Fare</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distance Charge</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight Charge</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Handling</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Surcharges</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {quotes.map((quote) => (
              <tr
                key={quote.id}
                className={quote.id === cheapestQuote.id ? 'bg-green-50' : ''}
              >
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{quote.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{quote.estimatedDeliveryDays} days</td>
                <td className="px-6 py-4 text-sm text-gray-500">{formatWeight(quote.chargeableWeight)}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{formatCurrency(quote.baseFare)}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{formatCurrency(quote.perKmCharge)}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{formatCurrency(quote.perKgCharge)}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{formatCurrency(quote.handlingCharge)}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{formatCurrency(quote.surcharges)}</td>
                <td className="px-6 py-4 text-sm font-medium text-blue-700">{formatCurrency(quote.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VendorComparison;
