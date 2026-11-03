/**
 * Electricity Tariff & Slab Billing Engine
 * Supports standard Indian state utility tariffs (TNEB, BESCOM, MSEDCL, Delhi DERC, etc.)
 * Provides itemized bill estimates, slab breakdown, fixed charges, and regulatory levies.
 */

import { TariffConfig } from '../types/energy';

export interface BillBreakdown {
  totalUnitsKWh: number;
  slabCharges: Array<{
    slabLabel: string;
    unitsInSlab: number;
    ratePerUnit: number;
    chargeINR: number;
  }>;
  energyChargesINR: number;
  fixedChargesINR: number;
  electricityDutyINR: number;
  fuelSurchargeINR: number;
  totalBillINR: number;
  averageCostPerKWh: number;
  isPrototypeFlatRate: boolean;
  tariffName: string;
  disclaimer: string;
}

export const PRESET_TARIFFS: Record<string, TariffConfig> = {
  bescom_karnataka: {
    providerName: 'BESCOM (Bangalore Electricity Supply)',
    state: 'Karnataka',
    category: 'Domestic (Single Phase)',
    isSlabBased: true,
    prototypeFlatRate: 4.5,
    fixedChargesINR: 85,
    electricityDutyPercent: 9.0,
    fuelSurchargePerUnit: 0.35,
    slabs: [
      { minUnits: 0, maxUnits: 50, ratePerUnit: 4.15 },
      { minUnits: 51, maxUnits: 100, ratePerUnit: 5.6 },
      { minUnits: 101, maxUnits: 200, ratePerUnit: 7.15 },
      { minUnits: 201, maxUnits: null, ratePerUnit: 8.2 },
    ],
  },
  tneb_tamilnadu: {
    providerName: 'TANGEDCO / TNEB',
    state: 'Tamil Nadu',
    category: 'Domestic (Single Phase)',
    isSlabBased: true,
    prototypeFlatRate: 4.2,
    fixedChargesINR: 50,
    electricityDutyPercent: 5.0,
    fuelSurchargePerUnit: 0.25,
    slabs: [
      { minUnits: 0, maxUnits: 100, ratePerUnit: 0.0 }, // Subsidized free first 100 units
      { minUnits: 101, maxUnits: 200, ratePerUnit: 2.25 },
      { minUnits: 201, maxUnits: 400, ratePerUnit: 4.5 },
      { minUnits: 401, maxUnits: null, ratePerUnit: 6.0 },
    ],
  },
  msedcl_maharashtra: {
    providerName: 'MSEDCL (Mahavitaran)',
    state: 'Maharashtra',
    category: 'Domestic (Single Phase)',
    isSlabBased: true,
    prototypeFlatRate: 5.2,
    fixedChargesINR: 110,
    electricityDutyPercent: 16.0,
    fuelSurchargePerUnit: 0.45,
    slabs: [
      { minUnits: 0, maxUnits: 100, ratePerUnit: 4.71 },
      { minUnits: 101, maxUnits: 300, ratePerUnit: 8.64 },
      { minUnits: 301, maxUnits: 500, ratePerUnit: 12.11 },
      { minUnits: 501, maxUnits: null, ratePerUnit: 13.82 },
    ],
  },
  flat_prototype: {
    providerName: 'Prototype Flat-Rate Model',
    state: 'Universal / Lab',
    category: 'Domestic (Single Phase)',
    isSlabBased: false,
    prototypeFlatRate: 4.5,
    fixedChargesINR: 60,
    electricityDutyPercent: 5.0,
    fuelSurchargePerUnit: 0.0,
    slabs: [],
  },
};

let activeTariffKey = 'tneb_tamilnadu';
let customTariff: TariffConfig | null = null;

export function getActiveTariff(): TariffConfig {
  if (customTariff) return customTariff;
  return PRESET_TARIFFS[activeTariffKey] || PRESET_TARIFFS.tneb_tamilnadu;
}

export function setActiveTariffKey(key: string) {
  if (PRESET_TARIFFS[key]) {
    activeTariffKey = key;
    customTariff = null;
  }
}

export function setCustomTariff(cfg: TariffConfig) {
  customTariff = { ...cfg };
}

/**
 * Calculates itemized electricity bill for the given kWh consumption
 */
export function calculateBill(totalUnitsKWh: number, tariff?: TariffConfig): BillBreakdown {
  const currentTariff = tariff || getActiveTariff();
  const slabCharges: BillBreakdown['slabCharges'] = [];

  let energyChargesINR = 0;

  if (!currentTariff.isSlabBased || currentTariff.slabs.length === 0) {
    // Flat rate mode
    energyChargesINR = totalUnitsKWh * currentTariff.prototypeFlatRate;
    slabCharges.push({
      slabLabel: `Flat Rate (${totalUnitsKWh.toFixed(2)} units)`,
      unitsInSlab: totalUnitsKWh,
      ratePerUnit: currentTariff.prototypeFlatRate,
      chargeINR: energyChargesINR,
    });
  } else {
    // Slab based calculation
    let remainingUnits = totalUnitsKWh;

    for (let i = 0; i < currentTariff.slabs.length; i++) {
      const slab = currentTariff.slabs[i];
      const slabMin = slab.minUnits;
      const slabMax = slab.maxUnits;

      if (totalUnitsKWh > slabMin) {
        const unitsInThisSlab = Math.min(
          remainingUnits,
          slabMax !== null ? Math.max(0, Math.min(totalUnitsKWh, slabMax) - slabMin + 1) : remainingUnits
        );

        if (unitsInThisSlab > 0) {
          const cost = unitsInThisSlab * slab.ratePerUnit;
          energyChargesINR += cost;

          const label = slabMax !== null ? `${slabMin} - ${slabMax} units` : `> ${slabMin} units`;

          slabCharges.push({
            slabLabel: label,
            unitsInSlab: parseFloat(unitsInThisSlab.toFixed(2)),
            ratePerUnit: slab.ratePerUnit,
            chargeINR: parseFloat(cost.toFixed(2)),
          });
        }
      }
    }
  }

  const fuelSurchargeINR = parseFloat((totalUnitsKWh * currentTariff.fuelSurchargePerUnit).toFixed(2));
  const subtotalBeforeDuty = energyChargesINR + currentTariff.fixedChargesINR + fuelSurchargeINR;
  const electricityDutyINR = parseFloat(
    ((subtotalBeforeDuty * currentTariff.electricityDutyPercent) / 100).toFixed(2)
  );
  const totalBillINR = Math.round(subtotalBeforeDuty + electricityDutyINR);

  const averageCostPerKWh = totalUnitsKWh > 0 ? parseFloat((totalBillINR / totalUnitsKWh).toFixed(2)) : 0;

  return {
    totalUnitsKWh: parseFloat(totalUnitsKWh.toFixed(2)),
    slabCharges,
    energyChargesINR: parseFloat(energyChargesINR.toFixed(2)),
    fixedChargesINR: currentTariff.fixedChargesINR,
    electricityDutyINR,
    fuelSurchargeINR,
    totalBillINR,
    averageCostPerKWh,
    isPrototypeFlatRate: !currentTariff.isSlabBased,
    tariffName: currentTariff.providerName,
    disclaimer:
      'Disclaimer: This calculation provides an estimated operational cost projection for low-voltage prototyping and load monitoring. Actual utility billing accounts for time-of-day tariffs, meter reading cycles, and state subsidies.',
  };
}
