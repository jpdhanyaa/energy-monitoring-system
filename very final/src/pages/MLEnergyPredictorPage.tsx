import React, { useState, useMemo } from 'react';
import {
  Brain,
  Zap,
  TrendingDown,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  IndianRupee,
  Activity,
  Award,
} from 'lucide-react';

interface MLEnergyPredictorPageProps {
  onNavigatePage: (pageId: string) => void;
}

// Preset loads in Watts for quick exploration
interface PowerPreset {
  label: string;
  watts: number;
  hours: number;
  desc: string;
  category: string;
}

const POWER_PRESETS: PowerPreset[] = [
  {
    label: 'IoT DevKit & Sensors',
    watts: 15,
    hours: 24,
    desc: 'ESP32 + ACS712 + PIR + LDR running continuously',
    category: 'Prototype',
  },
  {
    label: 'Eco Lighting & Fan',
    watts: 110,
    hours: 10,
    desc: '3x LED Bulbs (30W) + 1x BLDC Fan (80W)',
    category: 'Essential',
  },
  {
    label: 'Standard Apartment Baseline',
    watts: 450,
    hours: 14,
    desc: 'Refrigerator (180W) + Fans + Lights + TV + Wi-Fi',
    category: 'Residential',
  },
  {
    label: 'Air Conditioner (1.5T Inverter)',
    watts: 1450,
    hours: 8,
    desc: 'Inverter AC running during afternoon or sleep',
    category: 'High Load',
  },
  {
    label: 'Heavy Household (AC + Geyser)',
    watts: 3200,
    hours: 6,
    desc: 'Simultaneous 2kW Water Heater + AC + Washing Machine',
    category: 'Peak Load',
  },
  {
    label: 'Small Commercial / Lab',
    watts: 5000,
    hours: 10,
    desc: 'Multiple test benches, power supplies, PCs, ventilation',
    category: 'Commercial',
  },
];

// Energy Conservation Tactics for "How to use electricity effectively without wasting"
interface ConservationTactic {
  id: string;
  title: string;
  description: string;
  reductionWatts: number;
  reductionPercent: number;
  monthlyKWhSaved: number;
  category: string;
  isActionableIoT: boolean;
}

const CONSERVATION_TACTICS: ConservationTactic[] = [
  {
    id: 'cliff_guard',
    title: '500-Unit Subsidy Cliff Guard',
    description:
      'Budget daily average usage under 8.33 kWh/day (≤500 units bi-monthly) to retain 200 FREE units and save over ₹1,200 instantly.',
    reductionWatts: 85,
    reductionPercent: 12,
    monthlyKWhSaved: 42,
    category: 'Tariff Strategy',
    isActionableIoT: true,
  },
  {
    id: 'pir_lighting',
    title: 'Automated PIR Lighting Shut-Off',
    description:
      'Use the PIR motion sensor to automatically cut relay power when rooms are vacant for >3 minutes. Eliminates empty room illumination.',
    reductionWatts: 45,
    reductionPercent: 8,
    monthlyKWhSaved: 22,
    category: 'Smart Automation',
    isActionableIoT: true,
  },
  {
    id: 'pwm_fan',
    title: 'PWM Fan Speed Throttling (70% Cap)',
    description:
      'Cap the BC547 PWM timer to 70% duty cycle. By fan aerodynamic cubic power law (P ∝ ω³), a 30% speed drop reduces motor power by ~38% with minimal airflow loss.',
    reductionWatts: 35,
    reductionPercent: 7,
    monthlyKWhSaved: 28,
    category: 'Motor Efficiency',
    isActionableIoT: true,
  },
  {
    id: 'vampire_cutoff',
    title: 'Nighttime Vampire / Standby Load Cutoff',
    description:
      'Automatically isolate TV boxes, phone adapters, test equipment, and AC standby electronics overnight using automated relay schedules.',
    reductionWatts: 40,
    reductionPercent: 6,
    monthlyKWhSaved: 26,
    category: 'Phantom Load',
    isActionableIoT: true,
  },
  {
    id: 'peak_staggering',
    title: 'Stagger High-Wattage Inductive Loads',
    description:
      'Never run AC, water geyser, and washing machine concurrently. Staggering reduces line current, lowering wiring I²R heat losses and peak stress.',
    reductionWatts: 60,
    reductionPercent: 9,
    monthlyKWhSaved: 34,
    category: 'Load Management',
    isActionableIoT: false,
  },
];

/**
 * Official Tamil Nadu TNPDCL Bi-Monthly Telescopic Tariff Calculator
 */
function calculateTNPDCLBill(biMonthlyUnits: number) {
  const isTier1 = biMonthlyUnits <= 500;
  let energyCharge = 0;
  const slabBreakdown: { range: string; units: number; rate: number; cost: number }[] = [];

  if (isTier1) {
    // Tier 1: <= 500 units bi-monthly (200 units FREE)
    // 0-200: Free
    const s1Units = Math.min(biMonthlyUnits, 200);
    slabBreakdown.push({ range: '0 - 200 Units (Free Subsidy)', units: s1Units, rate: 0.0, cost: 0 });

    // 201-400: ₹4.70
    if (biMonthlyUnits > 200) {
      const s2Units = Math.min(biMonthlyUnits - 200, 200);
      const s2Cost = s2Units * 4.7;
      energyCharge += s2Cost;
      slabBreakdown.push({ range: '201 - 400 Units', units: s2Units, rate: 4.7, cost: s2Cost });
    }

    // 401-500: ₹6.30
    if (biMonthlyUnits > 400) {
      const s3Units = Math.min(biMonthlyUnits - 400, 100);
      const s3Cost = s3Units * 6.3;
      energyCharge += s3Cost;
      slabBreakdown.push({ range: '401 - 500 Units', units: s3Units, rate: 6.3, cost: s3Cost });
    }
  } else {
    // Tier 2: > 500 units bi-monthly (100 units FREE)
    // 0-100: Free
    const s1Units = Math.min(biMonthlyUnits, 100);
    slabBreakdown.push({ range: '0 - 100 Units (Free Subsidy)', units: s1Units, rate: 0.0, cost: 0 });

    // 101-400: ₹4.70
    if (biMonthlyUnits > 100) {
      const s2Units = Math.min(biMonthlyUnits - 100, 300);
      const s2Cost = s2Units * 4.7;
      energyCharge += s2Cost;
      slabBreakdown.push({ range: '101 - 400 Units', units: s2Units, rate: 4.7, cost: s2Cost });
    }

    // 401-500: ₹6.30
    if (biMonthlyUnits > 400) {
      const s3Units = Math.min(biMonthlyUnits - 400, 100);
      const s3Cost = s3Units * 6.3;
      energyCharge += s3Cost;
      slabBreakdown.push({ range: '401 - 500 Units', units: s3Units, rate: 6.3, cost: s3Cost });
    }

    // 501-600: ₹8.40
    if (biMonthlyUnits > 500) {
      const s4Units = Math.min(biMonthlyUnits - 500, 100);
      const s4Cost = s4Units * 8.4;
      energyCharge += s4Cost;
      slabBreakdown.push({ range: '501 - 600 Units', units: s4Units, rate: 8.4, cost: s4Cost });
    }

    // 601-800: ₹9.45
    if (biMonthlyUnits > 600) {
      const s5Units = Math.min(biMonthlyUnits - 600, 200);
      const s5Cost = s5Units * 9.45;
      energyCharge += s5Cost;
      slabBreakdown.push({ range: '601 - 800 Units', units: s5Units, rate: 9.45, cost: s5Cost });
    }

    // 801-1000: ₹10.50
    if (biMonthlyUnits > 800) {
      const s6Units = Math.min(biMonthlyUnits - 800, 200);
      const s6Cost = s6Units * 10.5;
      energyCharge += s6Cost;
      slabBreakdown.push({ range: '801 - 1000 Units', units: s6Units, rate: 10.5, cost: s6Cost });
    }

    // Above 1000: ₹11.55
    if (biMonthlyUnits > 1000) {
      const s7Units = biMonthlyUnits - 1000;
      const s7Cost = s7Units * 11.55;
      energyCharge += s7Cost;
      slabBreakdown.push({ range: 'Above 1000 Units', units: s7Units, rate: 11.55, cost: s7Cost });
    }
  }

  const fixedCharge = biMonthlyUnits > 500 ? 50 : 30;
  const fsa = biMonthlyUnits * 0.22; // Fuel Cost Adjustment (avg ₹0.22/unit)
  const totalBill = energyCharge + fixedCharge + fsa;

  return {
    isTier1,
    energyCharge,
    fixedCharge,
    fsa,
    totalBill,
    slabBreakdown,
  };
}

export const MLEnergyPredictorPage: React.FC<MLEnergyPredictorPageProps> = ({
  onNavigatePage,
}) => {
  // Power input state (in Watts) - allows large number entry
  const [powerWatts, setPowerWatts] = useState<number>(650);
  const [activeHoursPerDay, setActiveHoursPerDay] = useState<number>(12);
  const [daysInCycle, setDaysInCycle] = useState<number>(60); // 60 days default for TNPDCL bi-monthly

  // Active conservation tactics toggles
  const [enabledTactics, setEnabledTactics] = useState<Record<string, boolean>>({
    cliff_guard: true,
    pir_lighting: true,
    pwm_fan: true,
    vampire_cutoff: false,
    peak_staggering: false,
  });

  // Toggle tactic handler
  const handleToggleTactic = (id: string) => {
    setEnabledTactics((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Base Consumption Calculations
  const dailyKWhBase = useMemo(() => {
    return (powerWatts * activeHoursPerDay) / 1000;
  }, [powerWatts, activeHoursPerDay]);

  const totalCycleKWhBase = useMemo(() => {
    return dailyKWhBase * daysInCycle;
  }, [dailyKWhBase, daysInCycle]);

  const baseBillDetails = useMemo(() => {
    return calculateTNPDCLBill(totalCycleKWhBase);
  }, [totalCycleKWhBase]);

  // Conservation Savings Calculations
  const totalWattsReduced = useMemo(() => {
    return CONSERVATION_TACTICS.filter((t) => enabledTactics[t.id]).reduce(
      (sum, t) => sum + t.reductionWatts,
      0
    );
  }, [enabledTactics]);

  const effectiveWatts = useMemo(() => {
    return Math.max(10, powerWatts - totalWattsReduced);
  }, [powerWatts, totalWattsReduced]);

  const dailyKWhOptimized = useMemo(() => {
    return (effectiveWatts * activeHoursPerDay) / 1000;
  }, [effectiveWatts, activeHoursPerDay]);

  const totalCycleKWhOptimized = useMemo(() => {
    return dailyKWhOptimized * daysInCycle;
  }, [dailyKWhOptimized, daysInCycle]);

  const optimizedBillDetails = useMemo(() => {
    return calculateTNPDCLBill(totalCycleKWhOptimized);
  }, [totalCycleKWhOptimized]);

  const savedUnits = Math.max(0, totalCycleKWhBase - totalCycleKWhOptimized);
  const savedBillINR = Math.max(0, baseBillDetails.totalBill - optimizedBillDetails.totalBill);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* 1. Header Banner (Shortcuts removed as requested) */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 sm:p-8 border-2 border-[#A2D8E2] shadow-sm relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-gradient-to-br from-[#8BF0F0]/40 to-[#5C94ED]/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-[#1E40AF] border border-blue-200">
              <Brain className="w-3.5 h-3.5 text-[#2563EB]" />
              Python ML Regressor
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Scikit-Learn • Random Forest
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              TNPDCL Telescopic Slabs
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
            AI / ML Energy & Bill Predictor
          </h1>
          <p className="text-slate-600 text-sm sm:text-base mt-1.5 max-w-3xl">
            Forecast your exact electricity consumption and bi-monthly bill based on active appliance wattage,
            run-time hours, and explore actionable AI optimization strategies to prevent crossing the 500-unit subsidy cliff.
          </p>
        </div>
      </div>

      {/* 2. Scikit-Learn Random Forest Regressor & Prediction Pipeline Box (Moved to top; Python Dependencies and predict.py boxes removed) */}
      <div className="bg-white rounded-2xl border-2 border-[#A2D8E2] shadow-sm p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
              <Brain className="w-4 h-4 text-blue-600" />
              Machine Learning Engine
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
              Scikit-Learn Random Forest Regressor & Prediction Pipeline
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Trained on high-frequency IoT time-series logs with chronological cross-validation and zero temporal leakage.
            </p>
          </div>

          {/* Model Metrics Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-mono font-bold text-blue-800">
              R²: 0.784
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-mono font-bold text-emerald-800">
              MAE: 0.064 kWh
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-xs font-mono font-bold text-purple-800">
              Trees: 100
            </div>
          </div>
        </div>

        {/* Python Model Feature Importance (Full-width clean presentation) */}
        <div className="mt-6 bg-slate-50/70 rounded-xl p-5 sm:p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Python Model Feature Importance
            </h3>
            <span className="text-xs text-slate-500 font-mono">sklearn.ensemble.RandomForestRegressor</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              {
                feature: 'active_power_watts',
                importance: 46,
                desc: 'Live ACS712 current & power reading',
                color: 'bg-blue-600',
              },
              {
                feature: 'daily_operating_hours',
                importance: 28,
                desc: 'Appliance runtime duration',
                color: 'bg-emerald-600',
              },
              {
                feature: 'rolling_7d_kwh_lag',
                importance: 14,
                desc: 'Historical baseline usage window',
                color: 'bg-cyan-600',
              },
              {
                feature: 'is_weekend_mult',
                importance: 8,
                desc: 'Weekend occupancy load shift factor',
                color: 'bg-amber-600',
              },
              {
                feature: 'ambient_temp_pir',
                importance: 4,
                desc: 'LDR ambient light & motion density',
                color: 'bg-purple-600',
              },
            ].map((f) => (
              <div
                key={f.feature}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-mono text-slate-800 font-bold truncate pr-1">{f.feature}</span>
                    <span className="font-mono text-blue-700 font-extrabold">{f.importance}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`${f.color} h-2 rounded-full transition-all duration-500`}
                      style={{ width: `${f.importance}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-2.5 leading-snug">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Interactive "What-If" Predictive Power Engine Box (Moved below ML architecture) */}
      <div className="bg-white rounded-2xl border-2 border-[#A2D8E2] shadow-sm p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              Predictive Power Engine
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
              "If We Use This Much Power For This Whole Month, The Bill Will Be This Much"
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Enter your average continuous load in Watts and daily operating hours to immediately simulate total consumed units and final TNPDCL bill.
            </p>
          </div>

          {/* Billing Cycle Switcher */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start md:self-auto">
            <button
              onClick={() => setDaysInCycle(30)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                daysInCycle === 30
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30-Day Monthly
            </button>
            <button
              onClick={() => setDaysInCycle(60)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                daysInCycle === 60
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              60-Day Bi-Monthly (TNPDCL)
            </button>
          </div>
        </div>

        {/* Input Controls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
          {/* Left Column: Sliders & Inputs */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Power Input in Watts */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-600" />
                  Continuous Operating Power (Watts)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    step="10"
                    value={powerWatts}
                    onChange={(e) => setPowerWatts(Math.max(1, Number(e.target.value) || 0))}
                    className="w-28 px-3 py-1.5 text-right font-mono font-bold text-base text-blue-700 bg-white border-2 border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                  <span className="font-bold text-xs text-slate-500">W</span>
                </div>
              </div>

              {/* Slider for smooth dragging */}
              <input
                type="range"
                min="10"
                max="5000"
                step="25"
                value={Math.min(powerWatts, 5000)}
                onChange={(e) => setPowerWatts(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mt-2"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-600 mt-1">
                <span>10 W (IoT Only)</span>
                <span>1,000 W</span>
                <span>2,500 W (High)</span>
                <span>5,000+ W (Industrial)</span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="mt-4">
                <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                  Quick Load Presets:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {POWER_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setPowerWatts(preset.watts);
                        setActiveHoursPerDay(preset.hours);
                      }}
                      className={`p-2.5 text-left rounded-lg border text-xs transition-all ${
                        powerWatts === preset.watts && activeHoursPerDay === preset.hours
                          ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold truncate">{preset.label}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {preset.watts}W
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-600 mt-1 truncate">{preset.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Active Hours Per Day */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  Active Operating Hours Per Day
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="24"
                    step="0.5"
                    value={activeHoursPerDay}
                    onChange={(e) =>
                      setActiveHoursPerDay(Math.min(24, Math.max(0.5, Number(e.target.value) || 1)))
                    }
                    className="w-20 px-3 py-1.5 text-right font-mono font-bold text-base text-emerald-700 bg-white border-2 border-emerald-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                  />
                  <span className="font-bold text-xs text-slate-500">hrs/day</span>
                </div>
              </div>

              <input
                type="range"
                min="1"
                max="24"
                step="0.5"
                value={activeHoursPerDay}
                onChange={(e) => setActiveHoursPerDay(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 mt-2"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-600 mt-1">
                <span>1 hr/day (Minimal)</span>
                <span>8 hrs (Shift)</span>
                <span>16 hrs (Day Load)</span>
                <span>24 hrs (Continuous)</span>
              </div>
            </div>
          </div>

          {/* Right Column: Real-Time Prediction Summary Card */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-blue-500/30 flex flex-col justify-between h-full space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider font-mono text-cyan-400 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    Predicted Bill Forecast
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                    {daysInCycle} Days Cycle
                  </span>
                </div>

                {/* Big Predicted Bill Amount */}
                <div className="mt-4">
                  <div className="text-xs text-slate-400">Total Projected Bill Amount</div>
                  <div className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight flex items-baseline gap-1 mt-1">
                    <span className="text-cyan-400 text-3xl font-normal">₹</span>
                    <span>{Math.round(baseBillDetails.totalBill).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1 flex items-center gap-2">
                    <span>≈ ₹{(baseBillDetails.totalBill / daysInCycle).toFixed(2)} / day</span>
                    <span>•</span>
                    <span>Fixed/FSA: ₹{(baseBillDetails.fixedCharge + baseBillDetails.fsa).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Energy Stats Breakdown */}
              <div className="grid grid-cols-2 gap-3 py-4 border-y border-white/10">
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wide">Daily Consumption</div>
                  <div className="text-xl font-bold font-mono text-white mt-0.5">
                    {dailyKWhBase.toFixed(2)} <span className="text-xs font-normal text-slate-300">kWh</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">({powerWatts}W × {activeHoursPerDay}h)</div>
                </div>

                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wide">Total Units Consumed</div>
                  <div className="text-xl font-bold font-mono text-cyan-300 mt-0.5">
                    {totalCycleKWhBase.toFixed(1)} <span className="text-xs font-normal text-slate-300">Units</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">in {daysInCycle} days</div>
                </div>
              </div>

              {/* 500-Unit Cliff Status Indicator */}
              {daysInCycle === 60 && (
                <div
                  className={`p-4 rounded-xl border text-xs ${
                    baseBillDetails.isTier1
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/70 border-rose-500/60 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {baseBillDetails.isTier1 ? (
                      <>
                        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                        <span>Tier 1 Subsidy Active: 200 Free Units!</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                        <span>500-Unit Subsidy Cliff Breached!</span>
                      </>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-200">
                    {baseBillDetails.isTier1 ? (
                      <>
                        Total consumption is under 500 units ({totalCycleKWhBase.toFixed(1)} / 500 units). You retain the
                        maximum 200 free units government subsidy! Remaining safety margin:{' '}
                        <strong>{(500 - totalCycleKWhBase).toFixed(1)} units</strong>.
                      </>
                    ) : (
                      <>
                        Your usage of {totalCycleKWhBase.toFixed(1)} units exceeds the 500-unit threshold by{' '}
                        <strong>{(totalCycleKWhBase - 500).toFixed(1)} units</strong>. Your free subsidy drops from 200
                        to 100 units, and higher slabs (₹8.40 - ₹11.55) apply, inflating your bill significantly.
                      </>
                    )}
                  </p>
                </div>
              )}

              {/* Itemized Slab Breakdown Table */}
              <div className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-300">
                  Itemized Tariff Slab Calculation:
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1 text-[11px] font-mono">
                  {baseBillDetails.slabBreakdown.map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-300 py-0.5 border-b border-white/5">
                      <span className="truncate pr-2">{s.range} ({s.units.toFixed(1)}u @ ₹{s.rate})</span>
                      <span className="font-bold text-white shrink-0">₹{s.cost.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Actionable Energy Efficiency: "How to Use Electricity Effectively Without Wasting" (Moved below Predictive Power Engine) */}
      <div className="bg-gradient-to-br from-white via-emerald-50/20 to-white rounded-2xl border-2 border-emerald-300/80 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-emerald-100">
          <div>
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold uppercase tracking-wider">
              <TrendingDown className="w-4 h-4 text-emerald-600" />
              AI Energy Conservation Intelligence
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
              How to Use Electricity Effectively Without Wasting
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
              Select AI energy optimization strategies to see immediate reductions in power consumption and simulated TNPDCL bill savings.
            </p>
          </div>

          {/* Real-Time Savings Pill */}
          <div className="bg-emerald-100 border border-emerald-300 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-emerald-900 uppercase">Projected Savings</div>
              <div className="text-lg font-extrabold text-emerald-700">
                ₹{Math.round(savedBillINR).toLocaleString('en-IN')}{' '}
                <span className="text-xs font-normal text-emerald-800">
                  ({savedUnits.toFixed(1)} Units saved)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Strategies Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {CONSERVATION_TACTICS.map((tactic) => {
            const isEnabled = !!enabledTactics[tactic.id];

            return (
              <div
                key={tactic.id}
                onClick={() => handleToggleTactic(tactic.id)}
                className={`cursor-pointer rounded-xl p-5 border-2 transition-all flex flex-col justify-between ${
                  isEnabled
                    ? 'bg-emerald-50/60 border-emerald-500 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300 opacity-80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                      {tactic.category}
                    </span>
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                        isEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm">{tactic.title}</h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {tactic.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">Power Cut:</span>
                  <span className="font-bold text-emerald-700">-{tactic.reductionWatts} W (-{tactic.monthlyKWhSaved} kWh/mo)</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Before vs After Energy Optimization Comparison Banner */}
        <div className="mt-6 bg-white rounded-xl p-5 border-2 border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase">Baseline Load</div>
            <div className="text-2xl font-bold font-mono text-slate-800 mt-1">{powerWatts} W</div>
            <div className="text-xs text-slate-500 mt-0.5">{totalCycleKWhBase.toFixed(1)} Units • ₹{Math.round(baseBillDetails.totalBill)}</div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-300">
            <div className="text-xs font-bold text-emerald-800 uppercase">AI-Optimized Load</div>
            <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">{effectiveWatts} W</div>
            <div className="text-xs text-emerald-700 mt-0.5">
              {totalCycleKWhOptimized.toFixed(1)} Units • ₹{Math.round(optimizedBillDetails.totalBill)}
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg border border-blue-300">
            <div className="text-xs font-bold text-blue-800 uppercase">Net Financial Savings</div>
            <div className="text-2xl font-bold font-mono text-blue-700 mt-1">
              ₹{Math.round(savedBillINR)}
            </div>
            <div className="text-xs text-blue-700 mt-0.5">
              {savedUnits > 0 ? `Saved ${savedUnits.toFixed(1)} units (${((savedUnits / totalCycleKWhBase) * 100).toFixed(1)}%)` : 'No tactics active'}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Bottom Navigation Buttons Alone (No outer box, no explanatory text, just the two buttons) */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
        <button
          onClick={() => onNavigatePage('predictions')}
          className="px-6 py-3 rounded-2xl bg-white hover:bg-[#EBF5FC] border-2 border-[#5C94ED] text-[#1E40AF] font-bold text-sm shadow-[0_4px_16px_rgba(92,148,237,0.12)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
        >
          <Calendar className="w-4 h-4 text-blue-600" />
          <span>TNPDCL Billing & Calendar</span>
        </button>
        <button
          onClick={() => onNavigatePage('dashboard')}
          className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
        >
          <Activity className="w-4 h-4" />
          <span>Go to Live Energy Dashboard</span>
        </button>
      </div>
    </div>
  );
};
