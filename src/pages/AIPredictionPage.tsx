import React, { useState } from 'react';
import {
  Brain,
  IndianRupee,
  TrendingUp,
  Calendar,
  Layers,
  Edit3,
  RotateCcw,
  Check,
  Zap,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  AlertTriangle,
  ShieldCheck,
  Info,
  LayoutDashboard,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Cell,
  Line,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts';

import { useToast } from '../components/common/ToastContainer';

interface AIPredictionPageProps {
  onNavigatePage?: (page: string) => void;
}

interface MonthData {
  id: string;
  name: string;
  monthIndex: number; // 0-based: Jan=0 ... Dec=11
  days: number;
  baseKWh: number;
  season: string;
  isCurrentMonth?: boolean;
}

const MONTHS_LIST: MonthData[] = [
  { id: 'jan', name: 'January', monthIndex: 0, days: 31, baseKWh: 380, season: 'Winter' },
  { id: 'feb', name: 'February', monthIndex: 1, days: 28, baseKWh: 420, season: 'Late Winter' },
  { id: 'mar', name: 'March', monthIndex: 2, days: 31, baseKWh: 460, season: 'Spring' },
  { id: 'apr', name: 'April', monthIndex: 3, days: 30, baseKWh: 495, season: 'Early Summer' },
  { id: 'may', name: 'May', monthIndex: 4, days: 31, baseKWh: 540, season: 'Peak Summer' },
  { id: 'jun', name: 'June', monthIndex: 5, days: 30, baseKWh: 520, season: 'Monsoon' },
  { id: 'jul', name: 'July', monthIndex: 6, days: 31, baseKWh: 480, season: 'Monsoon' },
  { id: 'aug', name: 'August', monthIndex: 7, days: 31, baseKWh: 450, season: 'Monsoon' },
  { id: 'sep', name: 'September', monthIndex: 8, days: 30, baseKWh: 430, season: 'Post-Monsoon' },
  { id: 'oct', name: 'October', monthIndex: 9, days: 31, baseKWh: 450, season: 'Autumn', isCurrentMonth: true },
  { id: 'nov', name: 'November', monthIndex: 10, days: 30, baseKWh: 390, season: 'Late Autumn' },
  { id: 'dec', name: 'December', monthIndex: 11, days: 31, baseKWh: 360, season: 'Winter' },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper to generate realistic daily values for all days of a month
function generateDefaultDailyValues(daysCount: number, baseTotalKWh: number): number[] {
  const avg = baseTotalKWh / daysCount;
  const values: number[] = [];
  for (let d = 1; d <= daysCount; d++) {
    const isWknd = d % 7 === 0 || d % 7 === 6;
    const sineVariation = Math.sin(d * 0.75) * (avg * 0.12);
    const val = Math.max(1.0, parseFloat((avg * (isWknd ? 1.15 : 0.95) + sineVariation).toFixed(2)));
    values.push(val);
  }
  return values;
}

// =========================================================================
// TAMIL NADU (TNPDCL / TANGEDCO) RESIDENTIAL TELESCOPIC SLAB SYSTEM
// =========================================================================
export interface TNPDCLLevelBreakdown {
  slab: string;
  units: number;
  rate: number;
  cost: number;
}

export interface TNPDCLCalculationResult {
  units: number;
  tier: 1 | 2;
  tierName: string;
  freeUnits: number;
  energyCharges: number;
  breakdown: TNPDCLLevelBreakdown[];
  fixedCharges: number;
  fsaCharges: number;
  fsaRate: number;
  totalBill: number;
}

export function calculateTNPDCLBill(
  units: number,
  fixedCharges: number = 50,
  fsaRate: number = 0.20
): TNPDCLCalculationResult {
  const u = Math.max(0, units);
  const breakdown: TNPDCLLevelBreakdown[] = [];
  let energyCharges = 0;

  if (u <= 500) {
    // -------------------------------------------------------------
    // Case A: Total Consumption is 500 Units or Less (Tier 1)
    // 200 Free Units Subsidy Applied
    // • 0 – 200 units: FREE (₹0 / unit)
    // • 201 – 400 units: ₹4.70 per unit
    // • 401 – 500 units: ₹6.30 per unit
    // -------------------------------------------------------------
    const slab1Units = Math.min(u, 200);
    breakdown.push({ slab: '0 – 200 units (Subsidy)', units: slab1Units, rate: 0, cost: 0 });

    if (u > 200) {
      const slab2Units = Math.min(u - 200, 200);
      const cost2 = parseFloat((slab2Units * 4.70).toFixed(2));
      energyCharges += cost2;
      breakdown.push({ slab: '201 – 400 units', units: slab2Units, rate: 4.70, cost: cost2 });
    }

    if (u > 400) {
      const slab3Units = Math.min(u - 400, 100);
      const cost3 = parseFloat((slab3Units * 6.30).toFixed(2));
      energyCharges += cost3;
      breakdown.push({ slab: '401 – 500 units', units: slab3Units, rate: 6.30, cost: cost3 });
    }

    const fsaCharges = parseFloat((u * fsaRate).toFixed(2));
    const totalBill = Math.round(energyCharges + fixedCharges + fsaCharges);

    return {
      units: u,
      tier: 1,
      tierName: 'Tier 1 (≤ 500 Units): 200 Free Units Subsidy Retained',
      freeUnits: 200,
      energyCharges: parseFloat(energyCharges.toFixed(2)),
      breakdown,
      fixedCharges,
      fsaCharges,
      fsaRate,
      totalBill,
    };
  } else {
    // -------------------------------------------------------------
    // Case B: Total Consumption is More than 500 Units (Tier 2)
    // 500-Unit Cliff Breached! Subsidy withdrawn, 100 Free Units layout
    // • 0 – 100 units: FREE (₹0 / unit)
    // • 101 – 400 units: ₹4.70 per unit
    // • 401 – 500 units: ₹6.30 per unit
    // • 501 – 600 units: ₹8.40 per unit
    // • 601 – 800 units: ₹9.45 per unit
    // • 801 – 1000 units: ₹10.50 per unit
    // • Above 1000 units: ₹11.55 per unit
    // -------------------------------------------------------------
    const slab1Units = 100;
    breakdown.push({ slab: '0 – 100 units (Base Subsidy)', units: slab1Units, rate: 0, cost: 0 });

    // Next 300 units (101 to 400)
    const slab2Units = Math.min(u - 100, 300);
    const cost2 = parseFloat((slab2Units * 4.70).toFixed(2));
    energyCharges += cost2;
    breakdown.push({ slab: '101 – 400 units', units: slab2Units, rate: 4.70, cost: cost2 });

    // Next 100 units (401 to 500)
    if (u > 400) {
      const slab3Units = Math.min(u - 400, 100);
      const cost3 = parseFloat((slab3Units * 6.30).toFixed(2));
      energyCharges += cost3;
      breakdown.push({ slab: '401 – 500 units', units: slab3Units, rate: 6.30, cost: cost3 });
    }

    // Next 100 units (501 to 600)
    if (u > 500) {
      const slab4Units = Math.min(u - 500, 100);
      const cost4 = parseFloat((slab4Units * 8.40).toFixed(2));
      energyCharges += cost4;
      breakdown.push({ slab: '501 – 600 units', units: slab4Units, rate: 8.40, cost: cost4 });
    }

    // Next 200 units (601 to 800)
    if (u > 600) {
      const slab5Units = Math.min(u - 600, 200);
      const cost5 = parseFloat((slab5Units * 9.45).toFixed(2));
      energyCharges += cost5;
      breakdown.push({ slab: '601 – 800 units', units: slab5Units, rate: 9.45, cost: cost5 });
    }

    // Next 200 units (801 to 1000)
    if (u > 800) {
      const slab6Units = Math.min(u - 800, 200);
      const cost6 = parseFloat((slab6Units * 10.50).toFixed(2));
      energyCharges += cost6;
      breakdown.push({ slab: '801 – 1000 units', units: slab6Units, rate: 10.50, cost: cost6 });
    }

    // Above 1000 units
    if (u > 1000) {
      const slab7Units = u - 1000;
      const cost7 = parseFloat((slab7Units * 11.55).toFixed(2));
      energyCharges += cost7;
      breakdown.push({ slab: 'Above 1000 units', units: slab7Units, rate: 11.55, cost: cost7 });
    }

    const fsaCharges = parseFloat((u * fsaRate).toFixed(2));
    const totalBill = Math.round(energyCharges + fixedCharges + fsaCharges);

    return {
      units: u,
      tier: 2,
      tierName: 'Tier 2 (> 500 Units): 500-Unit Cliff Breached (100 Free Units)',
      freeUnits: 100,
      energyCharges: parseFloat(energyCharges.toFixed(2)),
      breakdown,
      fixedCharges,
      fsaCharges,
      fsaRate,
      totalBill,
    };
  }
}

export const AIPredictionPage: React.FC<AIPredictionPageProps> = ({ onNavigatePage }) => {
  const { addToast } = useToast();

  // Selected month for focused inspection and calendar logging
  const [selectedMonthId, setSelectedMonthId] = useState<string>('oct');

  // TNPDCL Bi-Monthly Parameters
  const [tnpdclFixedCharges, setTnpdclFixedCharges] = useState<number>(50); // ₹50 default
  const [tnpdclFsaRate, setTnpdclFsaRate] = useState<number>(0.20); // ₹0.20 / unit default

  // Custom Simulator test unit input in TNPDCL box
  const [testUnitsInput, setTestUnitsInput] = useState<string>('450');

  // Daily values for EVERY day in each month (365 days across all 12 months)
  const [monthlyDailyValues, setMonthlyDailyValues] = useState<Record<string, number[]>>(() => {
    const initial: Record<string, number[]> = {};
    MONTHS_LIST.forEach((m) => {
      initial[m.id] = generateDefaultDailyValues(m.days, m.baseKWh);
    });
    return initial;
  });

  // Selected day index (1-based) for the calendar and Quick Entry Box
  const [entryDayIndex, setEntryDayIndex] = useState<number>(1);
  const [entryKWhInput, setEntryKWhInput] = useState<string>('');

  const activeMonthIndex = MONTHS_LIST.findIndex((m) => m.id === selectedMonthId);
  const activeMonth = MONTHS_LIST[activeMonthIndex >= 0 ? activeMonthIndex : 9];

  // Active month daily values array
  const activeDailyValues =
    monthlyDailyValues[activeMonth.id] ||
    generateDefaultDailyValues(activeMonth.days, activeMonth.baseKWh);

  // Total month energy in kWh / Units
  const totalMonthKWh = parseFloat(
    activeDailyValues.reduce((acc, curr) => acc + curr, 0).toFixed(1)
  );

  // TNPDCL Bill Calculation for Active Month
  const activeTNPDCL = calculateTNPDCLBill(totalMonthKWh, tnpdclFixedCharges, tnpdclFsaRate);

  // User Interactive Test Calculation in the TNPDCL Tariff Box
  const parsedTestUnits = parseFloat(testUnitsInput) || 0;
  const testTNPDCL = calculateTNPDCLBill(parsedTestUnits, tnpdclFixedCharges, tnpdclFsaRate);

  // Save value from Quick Entry Box for a specific day
  const handleSaveDailyValue = (dayNumber: number, valueKWh: number) => {
    if (isNaN(valueKWh) || valueKWh < 0) return;
    const clampedVal = parseFloat(valueKWh.toFixed(2));
    setMonthlyDailyValues((prev) => {
      const currentList = [
        ...(prev[activeMonth.id] ||
          generateDefaultDailyValues(activeMonth.days, activeMonth.baseKWh)),
      ];
      currentList[dayNumber - 1] = clampedVal;
      return {
        ...prev,
        [activeMonth.id]: currentList,
      };
    });

    addToast({
      type: 'success',
      title: `Day ${dayNumber} Logged`,
      message: `${activeMonth.name} Day ${dayNumber} set to ${clampedVal} Units.`,
    });
  };

  // Bulk set all days of active month
  const handleSetAllDaysValue = (valueKWh: number) => {
    if (isNaN(valueKWh) || valueKWh < 0) return;
    const clampedVal = parseFloat(valueKWh.toFixed(2));
    const allDays = Array(activeMonth.days).fill(clampedVal);
    setMonthlyDailyValues((prev) => ({
      ...prev,
      [activeMonth.id]: allDays,
    }));
    addToast({
      type: 'success',
      title: `All ${activeMonth.days} Days Updated`,
      message: `Set all days in ${activeMonth.name} to ${clampedVal} Units.`,
    });
  };

  // Reset active month daily values to baseline
  const handleResetMonthDays = () => {
    const defaults = generateDefaultDailyValues(activeMonth.days, activeMonth.baseKWh);
    setMonthlyDailyValues((prev) => ({
      ...prev,
      [activeMonth.id]: defaults,
    }));
    addToast({
      type: 'info',
      title: `${activeMonth.name} Values Reset`,
      message: 'All daily values restored to baseline forecast schedule.',
    });
  };

  // Month navigation in calendar
  const handlePrevMonth = () => {
    const prevIdx = (activeMonthIndex - 1 + MONTHS_LIST.length) % MONTHS_LIST.length;
    setSelectedMonthId(MONTHS_LIST[prevIdx].id);
    setEntryDayIndex(1);
    setEntryKWhInput('');
  };

  const handleNextMonth = () => {
    const nextIdx = (activeMonthIndex + 1) % MONTHS_LIST.length;
    setSelectedMonthId(MONTHS_LIST[nextIdx].id);
    setEntryDayIndex(1);
    setEntryKWhInput('');
  };

  // Build 12-Month Annual Data for the Distinct Curved Area Chart using TNPDCL tariff
  const yearlyChartData = MONTHS_LIST.map((m) => {
    const monthDays =
      monthlyDailyValues[m.id] || generateDefaultDailyValues(m.days, m.baseKWh);
    const kwh = parseFloat(monthDays.reduce((a, b) => a + b, 0).toFixed(1));
    const tnpdcl = calculateTNPDCLBill(kwh, tnpdclFixedCharges, tnpdclFsaRate);

    return {
      id: m.id,
      month: m.name.substring(0, 3),
      fullName: m.name,
      predictedKWh: kwh,
      projectedBillINR: tnpdcl.totalBill,
      tier: tnpdcl.tier,
      isSelected: m.id === selectedMonthId,
      season: m.season,
    };
  });

  const annualAvgKWh = parseFloat(
    (yearlyChartData.reduce((acc, m) => acc + m.predictedKWh, 0) / 12).toFixed(1)
  );

  // Daily Chart Data
  const dailyChartData = activeDailyValues.map((kwh, idx) => {
    const dayNum = idx + 1;
    const isWeekend = dayNum % 7 === 0 || dayNum % 7 === 6;
    return {
      day: `D${dayNum}`,
      dayNum,
      dayLabel: `Day ${dayNum}`,
      consumptionKWh: kwh,
      isWeekend,
    };
  });

  // Calendar Day of week index (0=Sun, 1=Mon, ..., 6=Sat) for 1st of month (2026)
  const firstDayOfWeek = new Date(2026, activeMonth.monthIndex, 1).getDay();

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 rounded-2xl bg-[#CBE5F6] text-[#1E40AF] border border-[#A2D8E2]">
              <Brain className="w-7 h-7 text-[#5C94ED]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A]">
                  AI Monthly Energy & Electricity Bill Prediction
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#8BF0F0]/50 text-[#0F766E] border border-[#A2D8E2] font-bold">
                  TNPDCL / TANGEDCO Slab Engine
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                Official Tamil Nadu bi-monthly telescopic slab system with 500-Unit Subsidy Cliff tracking and calendar schedule logging.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span
              className={`px-3.5 py-1.5 rounded-xl border-2 font-mono text-xs font-bold flex items-center gap-1.5 ${
                activeTNPDCL.tier === 1
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              {activeTNPDCL.tier === 1 ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Tier 1 (≤500 Units): 200 Free Units Subsidy
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Tier 2 (&gt;500 Units): 500-Unit Cliff Crossed
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Month Selector Tabs with Blinking Current Month Indicator */}
      <div className="p-4 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#0F172A]">
            <Calendar className="w-4 h-4 text-[#5C94ED]" />
            <span>Select Month for Prediction & Billing:</span>
          </div>
          <span className="text-xs font-mono font-bold text-[#5C94ED] bg-[#CBE5F6]/60 px-2.5 py-1 rounded-lg border border-[#A2D8E2] flex items-center gap-1.5">
            {activeMonth.isCurrentMonth && (
              <span className="relative flex h-2 w-2 mr-0.5" title="Current Active Month">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
            Selected: {activeMonth.name} ({activeMonth.days} Days) • Total: {totalMonthKWh} Units
          </span>
        </div>

        {/* Scrollable Month Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
          {MONTHS_LIST.map((m) => {
            const isSelected = m.id === selectedMonthId;
            const monthDays = monthlyDailyValues[m.id] || generateDefaultDailyValues(m.days, m.baseKWh);
            const mUnits = parseFloat(monthDays.reduce((a, b) => a + b, 0).toFixed(0));
            const isTier2 = mUnits > 500;

            return (
              <button
                key={m.id}
                onClick={() => {
                  setSelectedMonthId(m.id);
                  setEntryDayIndex(1);
                  setEntryKWhInput('');
                }}
                className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#5C94ED] text-white border-[#5C94ED] shadow-md shadow-[#5C94ED]/25'
                    : 'bg-[#EBF5FC] text-slate-700 hover:text-[#5C94ED] hover:bg-[#CBE5F6]/60 border-[#A2D8E2]'
                }`}
              >
                <span>{m.name}</span>
                <span
                  className={`text-[10px] font-mono px-1 rounded ${
                    isSelected
                      ? 'bg-white/25 text-white'
                      : isTier2
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-[#CBE5F6] text-[#1E40AF]'
                  }`}
                >
                  {mUnits} U
                </span>
                {m.isCurrentMonth && (
                  <span className="relative flex h-2 w-2 ml-0.5 items-center justify-center" title="Current Month">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-xs"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Key Summary Cards for Selected Month */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Month Energy */}
        <div className="p-5 rounded-2xl bg-white/95 backdrop-blur-sm border-2 border-[#A2D8E2]/80 hover:border-[#5C94ED] shadow-[0_4px_18px_rgba(92,148,237,0.08)] transition-all">
          <span className="text-xs text-slate-600 uppercase font-extrabold">
            {activeMonth.name} Consumption
          </span>
          <div className="text-3xl font-extrabold font-mono text-[#5C94ED] mt-2">
            {totalMonthKWh}{' '}
            <span className="text-base font-normal text-slate-400">Units (kWh)</span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#A2D8E2]/30 text-xs text-slate-600 flex justify-between">
            <span>Daily Average:</span>
            <span className="font-mono text-[#1E3A8A] font-bold">
              {(totalMonthKWh / activeMonth.days).toFixed(1)} Units/day
            </span>
          </div>
        </div>

        {/* Card 2: Projected Monthly Bill */}
        <div className="p-5 rounded-2xl bg-white/95 backdrop-blur-sm border-2 border-[#A2D8E2]/80 hover:border-[#5C94ED] shadow-[0_4px_18px_rgba(92,148,237,0.08)] transition-all">
          <span className="text-xs text-slate-600 uppercase font-extrabold">
            {activeMonth.name} TNPDCL Total Bill
          </span>
          <div className="text-3xl font-extrabold font-mono text-[#059669] mt-2">
            ₹{activeTNPDCL.totalBill}
          </div>
          <div className="mt-3 pt-3 border-t border-[#A2D8E2]/30 text-xs text-slate-600 flex justify-between">
            <span>Energy Charge:</span>
            <span className="font-mono text-[#059669] font-bold">
              ₹{activeTNPDCL.energyCharges} ({activeTNPDCL.freeUnits} Free Units)
            </span>
          </div>
        </div>

        {/* Card 3: Fixed + FSA Add-ons */}
        <div className="p-5 rounded-2xl bg-white/95 backdrop-blur-sm border-2 border-[#A2D8E2]/80 hover:border-[#5C94ED] shadow-[0_4px_18px_rgba(92,148,237,0.08)] transition-all">
          <span className="text-xs text-slate-600 uppercase font-extrabold">
            Fixed Charges & FSA Levy
          </span>
          <div className="text-3xl font-extrabold font-mono text-[#0F172A] mt-2">
            ₹{Math.round(activeTNPDCL.fixedCharges + activeTNPDCL.fsaCharges)}
          </div>
          <div className="mt-3 pt-3 border-t border-[#A2D8E2]/30 text-xs text-slate-600 flex justify-between">
            <span>Fixed / FSA ({tnpdclFsaRate} ₹/U):</span>
            <span className="font-mono text-[#1E3A8A] font-bold">
              ₹{activeTNPDCL.fixedCharges} + ₹{activeTNPDCL.fsaCharges}
            </span>
          </div>
        </div>
      </div>

      {/* 4. CUSTOMIZE ELECTRIC TARIFF BOX: TAMIL NADU (TNPDCL / TANGEDCO) TELESCOPIC SLAB SYSTEM */}
      <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)] space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b-2 border-[#A2D8E2]/40 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#CBE5F6] text-[#1E40AF] border border-[#A2D8E2]">
              <IndianRupee className="w-5 h-5 text-[#5C94ED]" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#0F172A]">
                Tamil Nadu TNPDCL / TANGEDCO Telescopic Slab Tariff Calculator
              </h3>
              <p className="text-xs text-slate-600">
                Official bi-monthly residential tariff calculation featuring the critical "500-Unit Cliff" subsidy threshold rule.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-600">Sanctioned Tariff:</span>
            <span className="px-3 py-1 rounded-xl bg-[#8BF0F0]/50 text-[#0F766E] border border-[#A2D8E2] text-xs font-bold">
              LT-Tariff IA (Domestic)
            </span>
          </div>
        </div>

        {/* 500-Unit Cliff Subsidy Alert Banner */}
        <div
          className={`p-4 rounded-xl border-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs ${
            testTNPDCL.tier === 1
              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
              : 'bg-amber-50/90 border-amber-400 text-amber-950'
          }`}
        >
          <div className="flex items-start gap-3">
            {testTNPDCL.tier === 1 ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <span className="font-extrabold text-sm block">
                {testTNPDCL.tier === 1
                  ? 'Case A: Tier 1 Active (≤ 500 Units) — 200 Free Units Subsidy Applied'
                  : 'Case B: Tier 2 Active (> 500 Units) — The "500-Unit Cliff" Breached!'}
              </span>
              <p className="mt-0.5 leading-relaxed text-slate-700">
                {testTNPDCL.tier === 1
                  ? 'Under the government subsidy scheme, households using 500 units or less receive 200 free units bi-monthly (0–200 units at ₹0). Your full subsidy benefit is protected.'
                  : 'Crossing 500 units by even 1 unit causes the 200 free units subsidy to be withdrawn, reverting back to 100 free units and recalculating earlier slabs at higher rates!'}
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1.5 rounded-lg font-mono font-extrabold text-xs whitespace-nowrap border ${
              testTNPDCL.tier === 1
                ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                : 'bg-amber-100 text-amber-900 border-amber-400'
            }`}
          >
            {testTNPDCL.tier === 1 ? 'SUBSIDY: 200 UNITS FREE' : 'SUBSIDY: 100 UNITS FREE'}
          </span>
        </div>

        {/* Interactive Unit Tester & Preset Buttons */}
        <div className="p-4 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2] space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#5C94ED]" />
              Test Consumption Units to Calculate:
            </label>

            {/* Quick Sample Presets from prompt */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setTestUnitsInput('450')}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                  testUnitsInput === '450'
                    ? 'bg-[#5C94ED] text-white border-[#5C94ED]'
                    : 'bg-white text-slate-700 hover:bg-[#CBE5F6]/60 border-[#A2D8E2]'
                }`}
              >
                Sample 450 Units (Tier 1: ₹1,255)
              </button>

              <button
                onClick={() => setTestUnitsInput('500')}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                  testUnitsInput === '500'
                    ? 'bg-[#5C94ED] text-white border-[#5C94ED]'
                    : 'bg-white text-slate-700 hover:bg-[#CBE5F6]/60 border-[#A2D8E2]'
                }`}
              >
                500 Units (Subsidy Limit)
              </button>

              <button
                onClick={() => setTestUnitsInput('550')}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                  testUnitsInput === '550'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-amber-800 hover:bg-amber-50 border-amber-300'
                }`}
              >
                Sample 550 Units (Tier 2: ₹2,460)
              </button>

              <button
                onClick={() => setTestUnitsInput(String(totalMonthKWh))}
                className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#CBE5F6] text-[#1E40AF] hover:bg-[#A2D8E2] border border-[#5C94ED] transition-all"
              >
                Use {activeMonth.name} ({totalMonthKWh} U)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="number"
                min="0"
                step="1"
                value={testUnitsInput}
                onChange={(e) => setTestUnitsInput(e.target.value)}
                placeholder="Enter units consumed (e.g. 450, 500, 550)"
                className="w-full px-4 py-2.5 rounded-xl border border-[#A2D8E2] bg-white font-mono font-extrabold text-base text-[#0F172A] focus:outline-none focus:border-[#5C94ED]"
              />
              <span className="absolute right-4 top-3 text-xs text-slate-500 font-mono font-bold">
                Units (kWh)
              </span>
            </div>
          </div>
        </div>

        {/* Customizable Fixed Charges & FSA Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Fixed Charges Input */}
          <div className="p-3.5 rounded-xl bg-[#EBF5FC]/40 border border-[#A2D8E2] space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-800 font-bold">Bi-Monthly Fixed Charges (₹):</label>
              <span className="font-mono text-[#5C94ED] font-extrabold text-xs">
                ₹{tnpdclFixedCharges}
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="150"
              step="5"
              value={tnpdclFixedCharges}
              onChange={(e) => setTnpdclFixedCharges(Number(e.target.value))}
              className="w-full h-5 bg-transparent cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>₹20 (1-Phase)</span>
              <span>Sanctioned Load</span>
              <span>₹150 (3-Phase)</span>
            </div>
          </div>

          {/* FSA Rate Input */}
          <div className="p-3.5 rounded-xl bg-[#EBF5FC]/40 border border-[#A2D8E2] space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-800 font-bold">Fuel Cost Adjustment FSA (₹ / Unit):</label>
              <span className="font-mono text-[#059669] font-extrabold text-xs">
                ₹{tnpdclFsaRate.toFixed(2)} / U
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.80"
              step="0.05"
              value={tnpdclFsaRate}
              onChange={(e) => setTnpdclFsaRate(parseFloat(e.target.value))}
              className="w-full h-5 bg-transparent cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>₹0.00</span>
              <span>Quarterly TANGEDCO Levy</span>
              <span>₹0.80</span>
            </div>
          </div>
        </div>

        {/* Subsidy Cliff Impact Comparison Table: 400 vs 500 vs 600 Units */}
        <div className="p-4 rounded-xl bg-white border border-[#A2D8E2] space-y-2.5">
          <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-[#5C94ED]" />
            Comparing the Subsidy Impact: The "500-Unit Cliff"
          </h4>
          <p className="text-[11px] text-slate-600">
            Notice how exceeding 500 units by just 1 unit removes the 200 free units subsidy, drastically altering the bill:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* 400 Units */}
            <div className="p-3 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2] text-xs">
              <span className="font-bold text-slate-700 block">400 Units (Tier 1)</span>
              <div className="text-xl font-extrabold font-mono text-[#059669] mt-1">₹940</div>
              <span className="text-[10px] text-slate-500 font-mono">
                200 Free + 200 × ₹4.70
              </span>
            </div>

            {/* 500 Units */}
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs">
              <span className="font-bold text-emerald-900 block">500 Units (Tier 1 Limit)</span>
              <div className="text-xl font-extrabold font-mono text-emerald-700 mt-1">₹1,570</div>
              <span className="text-[10px] text-emerald-800 font-mono">
                200 Free + 200 × ₹4.70 + 100 × ₹6.30
              </span>
            </div>

            {/* 600 Units */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs">
              <span className="font-bold text-amber-900 block">600 Units (Tier 2 Cliff)</span>
              <div className="text-xl font-extrabold font-mono text-amber-800 mt-1">₹2,880</div>
              <span className="text-[10px] text-amber-800 font-mono">
                100 Free + 300 × ₹4.70 + 100 × ₹6.30 + 100 × ₹8.40
              </span>
            </div>
          </div>
        </div>

        {/* AT THE BOTTOM OF CALCULATOR BOX: Itemized Telescopic Slab Range Box & Total Price */}
        <div className="overflow-x-auto rounded-xl border-2 border-[#5C94ED]/60 bg-white shadow-xs">
          <div className="bg-[#EBF5FC] px-4 py-2.5 border-b border-[#A2D8E2] flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#0F172A] flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-[#5C94ED]" />
              Itemized Slab Range & Final Payable Calculation
            </span>
            <span className="text-[11px] font-mono font-bold text-[#0F766E] bg-white px-2.5 py-0.5 rounded border border-[#A2D8E2]">
              Units: {testTNPDCL.units} U
            </span>
          </div>

          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-extrabold uppercase border-b border-[#A2D8E2]">
              <tr>
                <th className="px-4 py-3">Slab Range</th>
                <th className="px-4 py-3 text-center">Units Billed</th>
                <th className="px-4 py-3 text-center">Tariff Rate</th>
                <th className="px-4 py-3 text-right">Energy Charge (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {testTNPDCL.breakdown.map((item, idx) => (
                <tr key={idx} className={item.rate === 0 ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-2.5 font-bold text-slate-800 font-sans flex items-center gap-1.5">
                    {item.rate === 0 && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    )}
                    {item.slab}
                  </td>
                  <td className="px-4 py-2.5 text-center font-bold text-[#1E40AF]">
                    {item.units} Units
                  </td>
                  <td className="px-4 py-2.5 text-center text-slate-700">
                    {item.rate === 0 ? (
                      <span className="text-emerald-700 font-bold">FREE (₹0.00)</span>
                    ) : (
                      `₹${item.rate.toFixed(2)} / unit`
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-extrabold text-[#0F172A]">
                    ₹{item.cost.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#EBF5FC]/80 border-t-2 border-[#A2D8E2] font-mono text-xs">
              <tr>
                <td colSpan={3} className="px-4 py-2 font-bold text-slate-700 font-sans">
                  Total Energy Charge:
                </td>
                <td className="px-4 py-2 text-right font-extrabold text-[#059669] text-sm">
                  ₹{testTNPDCL.energyCharges.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="px-4 py-1.5 text-slate-600 font-sans">
                  Bi-monthly Fixed Charges:
                </td>
                <td className="px-4 py-1.5 text-right font-bold text-[#1E40AF]">
                  ₹{testTNPDCL.fixedCharges.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="px-4 py-1.5 text-slate-600 font-sans">
                  Fuel Cost Adjustment (FSA @ ₹{testTNPDCL.fsaRate}/unit on {testTNPDCL.units} units):
                </td>
                <td className="px-4 py-1.5 text-right font-bold text-[#1E40AF]">
                  ₹{testTNPDCL.fsaCharges.toFixed(2)}
                </td>
              </tr>
              <tr className="bg-[#8BF0F0]/30 font-bold text-sm">
                <td colSpan={3} className="px-4 py-3 font-extrabold text-[#0F172A] font-sans">
                  Total Bi-Monthly Payable Amount:
                </td>
                <td className="px-4 py-3 text-right font-extrabold text-[#059669] text-base">
                  ₹{testTNPDCL.totalBill}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 5. 12-Month Annual Graph: Distinct Smooth Gradient Area Waveform */}
      <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-5">
          <div>
            <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#5C94ED]" />
              Annual Seasonal Energy & Cost Profile (12-Month Area Landscape)
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Smooth seasonal consumption curve with reference benchmark and projected TNPDCL billing trajectory. Selected month dot pops.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-[#1E40AF] font-bold bg-[#CBE5F6]/60 px-2.5 py-1 rounded-lg border border-[#A2D8E2]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5C94ED]"></span>
              Energy Area (Units)
            </span>
            <span className="flex items-center gap-1.5 text-[#0F766E] font-bold bg-[#8BF0F0]/40 px-2.5 py-1 rounded-lg border border-[#A2D8E2]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#059669]"></span>
              Bill Trend (₹)
            </span>
            <span className="text-[11px] text-slate-500 font-bold">
              Avg: {annualAvgKWh} U/mo
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={yearlyChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="annualEnergyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5C94ED" stopOpacity={0.65} />
                  <stop offset="60%" stopColor="#8BF0F0" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#CBE5F6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#A2D8E2" strokeOpacity={0.35} />
              <XAxis dataKey="month" stroke="#64748B" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                stroke="#5C94ED"
                tick={{ fontSize: 10 }}
                unit="U"
                domain={[0, 'auto']}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#059669"
                tick={{ fontSize: 10 }}
                unit="₹"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#A2D8E2',
                  borderWidth: '2px',
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                  boxShadow: '0 10px 25px -5px rgba(92, 148, 237, 0.15)',
                }}
                formatter={(val: any, name?: any) => [
                  name === 'Predicted Energy' ? `${val} Units` : `₹${val}`,
                  name || '',
                ]}
              />
              <ReferenceLine
                yAxisId="left"
                y={500}
                stroke="#DC2626"
                strokeDasharray="4 4"
                label={{
                  value: '500-Unit Subsidy Cliff',
                  fill: '#DC2626',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="predictedKWh"
                name="Predicted Energy"
                stroke="#3B82F6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#annualEnergyGradient)"
                dot={(props: any) => {
                  const isSelected = props.payload.id === selectedMonthId;
                  if (isSelected) {
                    return (
                      <circle
                        key={`pop-dot-${props.payload.id}`}
                        cx={props.cx}
                        cy={props.cy}
                        r={8.5}
                        fill="#2563EB"
                        stroke="#FFFFFF"
                        strokeWidth={2.5}
                      />
                    );
                  }
                  return (
                    <circle
                      key={`dot-${props.payload.id}`}
                      cx={props.cx}
                      cy={props.cy}
                      r={4}
                      fill="#FFFFFF"
                      stroke="#3B82F6"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 9, fill: '#2563EB', stroke: '#FFFFFF', strokeWidth: 2.5 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="projectedBillINR"
                name="Projected Bill (₹)"
                stroke="#059669"
                strokeWidth={2.5}
                dot={(props: any) => {
                  const isSelected = props.payload.id === selectedMonthId;
                  if (isSelected) {
                    return (
                      <circle
                        key={`pop-line-dot-${props.payload.id}`}
                        cx={props.cx}
                        cy={props.cy}
                        r={7.5}
                        fill="#059669"
                        stroke="#FFFFFF"
                        strokeWidth={2.5}
                      />
                    );
                  }
                  return (
                    <circle
                      key={`line-dot-${props.payload.id}`}
                      cx={props.cx}
                      cy={props.cy}
                      r={3.5}
                      fill="#FFFFFF"
                      stroke="#059669"
                      strokeWidth={2}
                    />
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Seasonal Markers Strip Below Annual Chart */}
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5 mt-3 pt-3 border-t border-[#A2D8E2]/40 text-center">
          {yearlyChartData.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                setSelectedMonthId(item.id);
                setEntryDayIndex(1);
                setEntryKWhInput('');
              }}
              className={`p-1.5 rounded-lg border text-[11px] cursor-pointer transition-all ${
                item.isSelected
                  ? 'bg-[#CBE5F6] border-[#5C94ED] font-bold text-[#1E40AF]'
                  : 'bg-white hover:bg-[#EBF5FC] border-[#A2D8E2]/60 text-slate-600'
              }`}
            >
              <div className="font-extrabold">{item.month}</div>
              <div className={`font-mono text-[10px] font-bold ${item.predictedKWh > 500 ? 'text-amber-700' : 'text-[#5C94ED]'}`}>
                {item.predictedKWh} U
              </div>
              <div className="font-mono text-[10px] text-[#059669]">₹{item.projectedBillINR}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Daily Consumption Section with Distribution & Calendar View */}
      <div className="space-y-6">
        {/* Daily Curve Chart with all days plotted */}
        <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#5C94ED]" />
                {activeMonth.name} Daily Consumption Distribution ({activeMonth.days} Days)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Every single day has logged load telemetry. Click any bar to inspect or edit in Quick Entry Box.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-[#1E40AF] bg-[#CBE5F6]/60 px-2.5 py-1 rounded-lg border border-[#A2D8E2]">
                Total: {totalMonthKWh} Units
              </span>
              <button
                onClick={handleResetMonthDays}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors"
                title="Reset all days of this month to baseline forecast"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#A2D8E2" strokeOpacity={0.35} />
                <XAxis dataKey="day" stroke="#64748B" tick={{ fontSize: 9 }} interval={1} />
                <YAxis
                  stroke="#5C94ED"
                  tick={{ fontSize: 9 }}
                  unit="U"
                  domain={[0, 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#A2D8E2',
                    borderWidth: '2px',
                    borderRadius: '0.75rem',
                    fontSize: '11px',
                  }}
                  formatter={(value: any) => [`${value} Units`, 'Daily Consumption']}
                />
                <Bar
                  dataKey="consumptionKWh"
                  name="Consumption (Units)"
                  fill="#5C94ED"
                  radius={[3, 3, 0, 0]}
                  onClick={(data: any) => {
                    if (data && data.dayNum) {
                      setEntryDayIndex(data.dayNum);
                      setEntryKWhInput(String(data.consumptionKWh));
                    }
                  }}
                >
                  {dailyChartData.map((entry) => (
                    <Cell
                      key={`day-bar-${entry.dayNum}`}
                      fill={entry.dayNum === entryDayIndex ? '#8BF0F0' : '#5C94ED'}
                      stroke={entry.dayNum === entryDayIndex ? '#0D9488' : '#3B82F6'}
                      strokeWidth={entry.dayNum === entryDayIndex ? 2 : 1}
                      cursor="pointer"
                    />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 7. CALENDAR VIEW FOR DAILY VALUES & QUICK ENTRY BOX */}
        <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)] space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b-2 border-[#A2D8E2]/40 gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#8BF0F0]/50 text-[#0F766E] border-2 border-[#A2D8E2]">
                <CalendarDays className="w-5 h-5 text-[#0F766E]" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">
                  Monthly Consumption Calendar & Daily Schedule
                </h3>
                <p className="text-xs text-slate-600">
                  Select any month. Day boxes show read-only values. Edit and log values only via the Quick Entry Box.
                </p>
              </div>
            </div>

            {/* Calendar Month Navigation Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl bg-white hover:bg-[#CBE5F6]/50 border border-[#A2D8E2] text-slate-700 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={selectedMonthId}
                onChange={(e) => {
                  setSelectedMonthId(e.target.value);
                  setEntryDayIndex(1);
                  setEntryKWhInput('');
                }}
                className="px-3 py-1.5 rounded-xl border border-[#A2D8E2] bg-white font-mono font-bold text-xs text-[#0F172A] focus:outline-none focus:border-[#5C94ED]"
              >
                {MONTHS_LIST.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} 2026 ({m.days} Days)
                  </option>
                ))}
              </select>

              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl bg-white hover:bg-[#CBE5F6]/50 border border-[#A2D8E2] text-slate-700 transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Entry Box: The ONLY place where values are changed */}
          <div className="p-4 rounded-xl bg-[#EBF5FC]/80 border-2 border-[#5C94ED]/60 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-extrabold text-[#0F172A] flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#5C94ED]" />
                Quick Entry Box — Modify Day Value:
              </h4>
              <span className="text-xs font-mono font-bold text-[#5C94ED] bg-white px-2.5 py-0.5 rounded-md border border-[#A2D8E2]">
                Active Day: {activeMonth.name} Day {entryDayIndex}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Day Selector */}
              <div className="md:col-span-3 flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Day:</label>
                <select
                  value={entryDayIndex}
                  onChange={(e) => {
                    const d = Number(e.target.value);
                    setEntryDayIndex(d);
                    setEntryKWhInput(String(activeDailyValues[d - 1] ?? 12.0));
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[#A2D8E2] bg-white font-mono font-bold text-xs text-[#0F172A] focus:outline-none focus:border-[#5C94ED]"
                >
                  {Array.from({ length: activeMonth.days }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      Day {d} ({activeDailyValues[d - 1] ?? 0} Units)
                    </option>
                  ))}
                </select>
              </div>

              {/* Enter Value Input */}
              <div className="md:col-span-4 flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Value:</label>
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={
                      entryKWhInput !== ''
                        ? entryKWhInput
                        : activeDailyValues[entryDayIndex - 1] ?? ''
                    }
                    onChange={(e) => setEntryKWhInput(e.target.value)}
                    placeholder="e.g. 14.5"
                    className="w-full pl-3 pr-12 py-2 rounded-xl border border-[#A2D8E2] bg-white font-mono font-bold text-xs text-[#0F172A] focus:outline-none focus:border-[#5C94ED]"
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-mono">
                    Units
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="md:col-span-5 flex items-center gap-2 justify-end">
                <button
                  onClick={() => {
                    const val = parseFloat(entryKWhInput);
                    if (!isNaN(val)) {
                      handleSaveDailyValue(entryDayIndex, val);
                    } else {
                      const fallback = activeDailyValues[entryDayIndex - 1];
                      handleSaveDailyValue(entryDayIndex, fallback);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#5C94ED] hover:bg-[#4E84D9] text-white text-xs font-bold transition-all shadow-md shadow-[#5C94ED]/20 whitespace-nowrap"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Day {entryDayIndex}
                </button>

                <button
                  onClick={() => {
                    const val = parseFloat(entryKWhInput);
                    if (!isNaN(val)) {
                      handleSetAllDaysValue(val);
                    } else {
                      handleSetAllDaysValue(activeDailyValues[entryDayIndex - 1] ?? 14.0);
                    }
                  }}
                  className="px-2.5 py-2 rounded-xl bg-white hover:bg-[#CBE5F6]/50 border border-[#A2D8E2] text-slate-700 text-xs font-bold transition-all whitespace-nowrap"
                  title="Apply this value to all days in the current month"
                >
                  Set All Days
                </button>
              </div>
            </div>
          </div>

          {/* THE CALENDAR GRID: Read-only display of values with cell selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#5C94ED]" />
                {activeMonth.name} 2026 Calendar Grid (Values shown below Day cannot be changed directly — click to select and edit in Quick Entry Box):
              </span>
              <span className="text-[11px] font-mono text-[#0F766E] font-bold bg-[#8BF0F0]/40 px-2 py-0.5 rounded border border-[#A2D8E2]">
                Month Total: {totalMonthKWh} Units
              </span>
            </div>

            {/* Day of Week Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center">
              {DAYS_OF_WEEK.map((dayName, idx) => (
                <div
                  key={dayName}
                  className={`py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
                    idx === 0 || idx === 6
                      ? 'bg-[#CBE5F6]/40 text-[#1E40AF]'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Calendar Month Days Grid */}
            <div className="grid grid-cols-7 gap-2">
              {/* Padding empty slots for days before the 1st of this month */}
              {Array.from({ length: firstDayOfWeek }).map((_, pIdx) => (
                <div
                  key={`pad-${pIdx}`}
                  className="p-2 min-h-[72px] rounded-xl bg-slate-50/50 border border-dashed border-slate-200 opacity-30 cursor-not-allowed"
                />
              ))}

              {/* Actual Month Days */}
              {Array.from({ length: activeMonth.days }, (_, i) => i + 1).map((dayNum) => {
                const currentVal = activeDailyValues[dayNum - 1] ?? 14.5;
                const isSelected = dayNum === entryDayIndex;
                const dayOfWeekIndex = (firstDayOfWeek + dayNum - 1) % 7;
                const isWeekend = dayOfWeekIndex === 0 || dayOfWeekIndex === 6;

                return (
                  <div
                    key={dayNum}
                    onClick={() => {
                      setEntryDayIndex(dayNum);
                      setEntryKWhInput(String(currentVal));
                    }}
                    className={`p-2.5 min-h-[72px] rounded-xl border transition-all text-xs cursor-pointer flex flex-col justify-between select-none ${
                      isSelected
                        ? 'bg-[#CBE5F6] border-[#5C94ED] ring-2 ring-[#5C94ED]/40 shadow-md'
                        : isWeekend
                        ? 'bg-[#EBF5FC]/40 hover:bg-[#EBF5FC] border-[#A2D8E2]'
                        : 'bg-white hover:bg-[#EBF5FC]/70 border-[#A2D8E2]/80'
                    }`}
                    title={`Click to select Day ${dayNum} for editing in Quick Entry Box`}
                  >
                    {/* Top Row: Day Number and Weekend Tag */}
                    <div className="flex justify-between items-center">
                      <span
                        className={`font-mono font-extrabold text-xs px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-[#5C94ED] text-white'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {dayNum}
                      </span>
                      {isSelected && (
                        <span className="text-[9px] font-mono font-bold text-[#1E40AF] uppercase bg-white/70 px-1 rounded">
                          Selected
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Values shown below it (Read-Only as requested) */}
                    <div className="mt-2 pt-1 border-t border-[#A2D8E2]/40">
                      <div className="font-mono font-extrabold text-[#1E40AF] text-[11px]">
                        {currentVal} <span className="text-[9px] font-normal text-slate-500">Units</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          onClick={() => onNavigatePage && onNavigatePage('dashboard')}
          className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-white hover:bg-[#EBF5FC] border-2 border-[#5C94ED] text-[#1E40AF] font-bold text-sm shadow-[0_4px_16px_rgba(92,148,237,0.12)] transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <LayoutDashboard className="w-4 h-4 text-[#5C94ED]" />
          <span>Go to Live Energy Dashboard</span>
        </button>
        <button
          onClick={() => onNavigatePage && onNavigatePage('ml-predictor')}
          className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white font-bold text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Brain className="w-4 h-4 text-[#8BF0F0]" />
          <span>Open ML Energy Predictor & Optimizer</span>
        </button>
      </div>
    </div>
  );
};
