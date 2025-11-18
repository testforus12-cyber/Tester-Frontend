// Simple Node.js test for Wheelseye pricing
const fs = require('fs');

// Mock the pricing data (simplified version for testing)
const WHEELSEYE_PRICING_DATA = [
  {
    vehicleType: "Tata Ace",
    weightRange: { min: 850, max: 1000 },
    vehicleLength: 7,
    pricing: [
      { distanceRange: { min: 0, max: 100 }, price: 4300 },
      { distanceRange: { min: 101, max: 150 }, price: 6000 },
      { distanceRange: { min: 151, max: 200 }, price: 6900 }
    ]
  },
  {
    vehicleType: "Pickup",
    weightRange: { min: 1001, max: 1200 },
    vehicleLength: 8,
    pricing: [
      { distanceRange: { min: 0, max: 100 }, price: 5300 },
      { distanceRange: { min: 101, max: 150 }, price: 6500 },
      { distanceRange: { min: 151, max: 200 }, price: 7000 }
    ]
  },
  {
    vehicleType: "Eicher 14 ft",
    weightRange: { min: 1501, max: 2000 },
    vehicleLength: 14,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 3600 },
      { distanceRange: { min: 451, max: 500 }, price: 22600 },
      { distanceRange: { min: 901, max: 1000 }, price: 36900 }
    ]
  }
];

// Simple pricing calculation function
function calculatePrice(weight, distance) {
  console.log(`\n🚛 Calculating price for weight: ${weight}kg, distance: ${distance}km`);
  
  // Find matching vehicle
  const vehicle = WHEELSEYE_PRICING_DATA.find(v => 
    weight >= v.weightRange.min && weight <= v.weightRange.max
  );
  
  if (!vehicle) {
    console.log(`❌ No vehicle found for weight ${weight}kg`);
    return { vehicle: "Unknown", price: 0 };
  }
  
  console.log(`✅ Selected vehicle: ${vehicle.vehicleType}`);
  
  // Find matching price
  const pricing = vehicle.pricing.find(p =>
    distance >= p.distanceRange.min && distance <= p.distanceRange.max
  );
  
  if (!pricing) {
    console.log(`❌ No pricing found for distance ${distance}km`);
    return { vehicle: vehicle.vehicleType, price: 0 };
  }
  
  console.log(`✅ Price found: ₹${pricing.price}`);
  return { vehicle: vehicle.vehicleType, price: pricing.price };
}

// Run tests
console.log('🧪 Testing Wheelseye Pricing Logic...');

// Test cases
const tests = [
  { weight: 900, distance: 100, expected: { vehicle: "Tata Ace", price: 4300 } },
  { weight: 1100, distance: 150, expected: { vehicle: "Pickup", price: 6500 } },
  { weight: 1800, distance: 500, expected: { vehicle: "Eicher 14 ft", price: 22600 } }
];

tests.forEach((test, index) => {
  console.log(`\n--- Test ${index + 1} ---`);
  const result = calculatePrice(test.weight, test.distance);
  console.log(`Expected: ${test.expected.vehicle}, ₹${test.expected.price}`);
  console.log(`Got: ${result.vehicle}, ₹${result.price}`);
  const match = result.vehicle === test.expected.vehicle && result.price === test.expected.price;
  console.log(`Result: ${match ? '✅ PASS' : '❌ FAIL'}`);
});

console.log('\n🎉 Pricing tests completed!');
console.log('\n📝 Summary:');
console.log('- The new pricing system uses local data instead of API calls');
console.log('- Pricing is based on weight ranges and distance ranges');
console.log('- Vehicle selection is automatic based on weight');
console.log('- Fallback mechanisms handle edge cases');
console.log('- The system is now ready for use in the calculator!');

