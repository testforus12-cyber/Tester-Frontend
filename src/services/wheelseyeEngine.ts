// src/services/wheelseyeEngine.ts
import {
  WHEELSEYE_BASE_VEHICLES,
  WHEELSEYE_DISTANCE_SLABS,
  WHEELSEYE_WEIGHT_BUCKETS,
  WHEELSEYE_COMBOS,
  BaseVehicle,
  VehicleId,
} from "../data/wheelseyeEngineData";

export interface EngineVehicleComponent {
  vehicleId: VehicleId;
  label: string;
  lengthFt: number;
  slabWeightKg: number;
  count: number;
  pricePerVehicle: number;
  totalPrice: number;
}

export interface WheelseyeEngineResult {
  chosenWeight: number; // slab or combo target weight
  vehicles: EngineVehicleComponent[];
  totalPrice: number;
}

function getBaseRowById(id: VehicleId): BaseVehicle {
  const row = WHEELSEYE_BASE_VEHICLES.find((v) => v.vehicleId === id);
  if (!row) throw new Error(`No base vehicle row for id ${id}`);
  return row;
}

function getSlabWeight(weightKg: number): number {
  const bucket = WHEELSEYE_WEIGHT_BUCKETS.find(
    (b) => weightKg >= b.min && weightKg <= b.max
  );
  if (!bucket) {
    throw new Error(`No weight bucket for ${weightKg}kg`);
  }
  return bucket.slabWeightKg;
}

/** Price for a single base vehicle at any distance (uses interpolation between slabs). */
export function priceForVehicle(row: BaseVehicle, distanceKm: number): number {
  const exactKey = String(distanceKm);
  if (exactKey in row.prices) return row.prices[exactKey];

  const slabs = WHEELSEYE_DISTANCE_SLABS.filter(
    (s) => String(s) in row.prices
  ).sort((a, b) => a - b);

  if (!slabs.length) {
    throw new Error(`No price slabs for vehicle ${row.vehicleId}`);
  }

  const lower = Math.max(...slabs.filter((s) => s <= distanceKm));
  const higher = Math.min(...slabs.filter((s) => s >= distanceKm));

  if (!Number.isFinite(lower) || !Number.isFinite(higher)) {
    const nearest = slabs.reduce(
      (best, s) =>
        Math.abs(s - distanceKm) < Math.abs(best - distanceKm) ? s : best,
      slabs[0]
    );
    return row.prices[String(nearest)];
  }

  if (lower === higher) return row.prices[String(lower)];

  const priceLow = row.prices[String(lower)];
  const priceHigh = row.prices[String(higher)];
  const diff = priceHigh - priceLow;
  const unit = diff / (higher - lower); // Excel logic

  return Math.round(priceLow + unit * (distanceKm - lower));
}

/** Main engine: from chargeableWeight + distance → best vehicle combination + price. */
export function computeWheelseyePrice(
  chargeableWeightKg: number,
  distanceKm: number
): WheelseyeEngineResult {
  const slabWeight = getSlabWeight(chargeableWeightKg);

  // 1) <=10T: single-vehicle
  if (slabWeight <= 10000) {
    const base = WHEELSEYE_BASE_VEHICLES.find(
      (v) => v.slabWeightKg === slabWeight
    );
    if (!base) throw new Error(`No base row for slab weight ${slabWeight}`);

    const pricePer = priceForVehicle(base, distanceKm);

    const comp: EngineVehicleComponent = {
      vehicleId: base.vehicleId,
      label: base.label,
      lengthFt: base.lengthFt,
      slabWeightKg: base.slabWeightKg,
      count: 1,
      pricePerVehicle: pricePer,
      totalPrice: pricePer,
    };

    return {
      chosenWeight: slabWeight,
      vehicles: [comp],
      totalPrice: pricePer,
    };
  }

  // 2) >10T: combos + container
  let best: WheelseyeEngineResult | null = null;

  // combo candidates from JSON
  for (const combo of WHEELSEYE_COMBOS) {
    if (combo.comboWeightKg < chargeableWeightKg) continue;
    if (combo.comboWeightKg > 18000) continue;

    for (const option of combo.options) {
      const components: EngineVehicleComponent[] = [];
      let totalPrice = 0;

      for (const c of option.components) {
        const base = getBaseRowById(c.vehicleId);
        const pricePer = priceForVehicle(base, distanceKm);
        const compTotal = pricePer * c.count;

        components.push({
          vehicleId: base.vehicleId,
          label: base.label,
          lengthFt: base.lengthFt,
          slabWeightKg: base.slabWeightKg,
          count: c.count,
          pricePerVehicle: pricePer,
          totalPrice: compTotal,
        });

        totalPrice += compTotal;
      }

      if (!best || totalPrice < best.totalPrice) {
        best = {
          chosenWeight: combo.comboWeightKg,
          vehicles: components,
          totalPrice,
        };
      }
    }
  }

  // single 32ft container as candidate too
  const container = WHEELSEYE_BASE_VEHICLES.find(
    (v) => v.vehicleId === "CONTAINER_32"
  );
  if (container) {
    const pricePer = priceForVehicle(container, distanceKm);
    const comp: EngineVehicleComponent = {
      vehicleId: container.vehicleId,
      label: container.label,
      lengthFt: container.lengthFt,
      slabWeightKg: container.slabWeightKg,
      count: 1,
      pricePerVehicle: pricePer,
      totalPrice: pricePer,
    };
    const totalPrice = pricePer;

    if (!best || totalPrice < best.totalPrice) {
      best = {
        chosenWeight: container.slabWeightKg,
        vehicles: [comp],
        totalPrice,
      };
    }
  }

  if (!best) {
    throw new Error(
      `No valid combination found for ${chargeableWeightKg}kg @ ${distanceKm}km`
    );
  }

  return best;
}
