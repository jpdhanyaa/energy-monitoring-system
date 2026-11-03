import React, { useState, useEffect } from 'react';
import {
  Zap,
  Activity,
  Gauge,
  Calendar,
  IndianRupee,
  Sliders,
  ArrowRight,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
} from 'recharts';

import { MetricCard } from '../components/common/MetricCard';
import { TelemetryReading, ApplianceState } from '../types/energy';
import { MLForecasterService } from '../services/mlForecaster';
import { hardwareBridge, HardwareBridgeStatus } from '../services/hardwareBridge';

interface DashboardPageProps {
  telemetry: TelemetryReading;
  applianceState: ApplianceState;
  onNavigatePage: (page: string) => void;
}

export type TelemetryInterval = '30s' | '1m' | '10m' | '30m' | '1hr' | '6hr';

const INTERVAL_CONFIG: Record<
  TelemetryInterval,
  { label: string; seconds: number; count: number; formatTime: (d: Date) => string }
> = {
  '30s': {
    label: '30s',
    seconds: 30,
    count: 12,
    formatTime: (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  },
  '1m': {
    label: '1m',
    seconds: 60,
    count: 12,
    formatTime: (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
  '10m': {
    label: '10m',
    seconds: 600,
    count: 10,
    formatTime: (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
  '30m': {
    label: '30m',
    seconds: 1800,
    count: 8,
    formatTime: (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
  '1hr': {
    label: '1hr',
    seconds: 3600,
    count: 8,
    formatTime: (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
  '6hr': {
    label: '6hr',
    seconds: 21600,
    count: 6,
    formatTime: (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
};

export const DashboardPage: React.FC<DashboardPageProps> = ({
  telemetry,
  applianceState,
  onNavigatePage,
}) => {
  const [bridgeStatus, setBridgeStatus] = useState<HardwareBridgeStatus>(hardwareBridge.getStatus());

  useEffect(() => {
    const unsub = hardwareBridge.subscribeStatus((st) => setBridgeStatus(st));
    return unsub;
  }, []);

  // Selectable interval state (default 10m)
  const [selectedInterval, setSelectedInterval] = useState<TelemetryInterval>('10m');

  // Generate historical slots based on selected interval with exact interval gap
  const generateIntervalData = (intervalKey: TelemetryInterval, currentTel: TelemetryReading) => {
    const cfg = INTERVAL_CONFIG[intervalKey];
    const points: Array<{ time: string; currentA: number; powerW: number; intervalLabel: string }> = [];
    const now = new Date();
    const intervalMs = cfg.seconds * 1000;
    const bucketBaseMs = Math.floor(now.getTime() / intervalMs) * intervalMs;

    for (let i = cfg.count - 1; i >= 0; i--) {
      const slotTime = new Date(bucketBaseMs - i * intervalMs);
      const timeStr = cfg.formatTime(slotTime);
      const variance = Math.sin(i * 0.7) * 0.35;
      const basePower = Math.max(0.3, parseFloat((currentTel.powerW * (0.88 + variance * 0.25)).toFixed(2)));
      const baseCurrent = Math.max(0.06, parseFloat((basePower / 5.0).toFixed(3)));

      points.push({
        time: timeStr,
        intervalLabel: i === 0 ? `${timeStr} (Active)` : timeStr,
        currentA: i === 0 ? currentTel.currentA : baseCurrent,
        powerW: i === 0 ? currentTel.powerW : basePower,
      });
    }
    return points;
  };

  const [intervalWindow, setIntervalWindow] = useState<
    Array<{ time: string; currentA: number; powerW: number; intervalLabel: string }>
  >(() => generateIntervalData('10m', telemetry));

  // When interval changes, regenerate base window
  useEffect(() => {
    setIntervalWindow(generateIntervalData(selectedInterval, telemetry));
  }, [selectedInterval]);

  // Dynamically update latest slot with live ESP32 telemetry
  useEffect(() => {
    setIntervalWindow((prev) => {
      const cfg = INTERVAL_CONFIG[selectedInterval];
      const now = new Date();
      const currentSlotStr = cfg.formatTime(now);

      if (prev.length === 0) return prev;

      // Update current live point
      const updated = [...prev];
      updated[updated.length - 1] = {
        time: currentSlotStr,
        intervalLabel: `${currentSlotStr} (Live)`,
        currentA: telemetry.currentA,
        powerW: telemetry.powerW,
      };
      return updated;
    });
  }, [telemetry, selectedInterval]);

  const mlForecast = MLForecasterService.generateForecast('Random Forest Regressor');

  return (
    <div className="space-y-6">
      {/* 1. Header with Hardware Connection Status (Clean without color palette circles) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#5C94ED]" />
            <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A]">
              Live Energy Dashboard
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Real-time electricity monitoring via ESP32 DevKit V1 and ACS712 Hall-effect sensor.
          </p>
        </div>

        {/* ESP32 Hardware Status Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#CBE5F6]/70 border-2 border-[#A2D8E2] text-xs font-mono shadow-xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${bridgeStatus.connected ? 'bg-emerald-400' : 'bg-[#5C94ED]'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${bridgeStatus.connected ? 'bg-emerald-500' : 'bg-[#5C94ED]'}`}></span>
            </span>
            <span className="text-[#1E293B] font-extrabold">
              {bridgeStatus.connected ? (bridgeStatus.portName || 'ESP32 Hardware Online') : 'ESP32 DevKit'}
            </span>
            <span className="text-[#A2D8E2]">•</span>
            <span className="text-slate-600 text-[11px] font-semibold">
              Sync: {new Date(telemetry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Core 4 Live Metric Cards as requested: Day's Current Power, Amount That Day, Month's Units Used, Month's Amount So Far */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: That particular day's current power */}
        <MetricCard
          title="Today's Watts"
          value={telemetry.powerW.toFixed(2)}
          unit="W"
          icon={Zap}
          iconColor="text-[#0284C7]"
          glowColor="cyan"
          isMeasured={true}
          subLabel="Active Sampling"
          subValue={`${telemetry.currentA.toFixed(3)} A`}
        />

        {/* Metric 2: Amount that day */}
        <MetricCard
          title="Amount That Day"
          value={`₹${(telemetry.todayKWh * 4.70).toFixed(2)}`}
          icon={IndianRupee}
          iconColor="text-[#2563EB]"
          glowColor="blue"
          subLabel="Today's Usage"
          subValue={`${telemetry.todayKWh.toFixed(2)} Units`}
        />

        {/* Metric 3: So far that month's unit used */}
        <MetricCard
          title="So Far Month's Units Used"
          value={telemetry.monthKWh.toFixed(1)}
          unit="Units"
          icon={Gauge}
          iconColor="text-[#0D9488]"
          glowColor="emerald"
          subLabel="Month to Date"
          subValue="Active Cycle"
        />

        {/* Metric 4: So far that month's amount */}
        <MetricCard
          title="So Far Month's Amount"
          value={`₹${mlForecast.estimatedBillINR}`}
          icon={IndianRupee}
          iconColor="text-[#059669]"
          glowColor="emerald"
          subLabel="Current Month Bill"
          subValue="TNPDCL Slabs"
        />
      </div>

      {/* 3. Live Energy Graph with Interval Selector & Cornflower / Soft Cyan Palette */}
      <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#5C94ED]" />
              Consumption Waveform
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Select time intervals to inspect load dynamics and high-frequency active ESP32 load tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            {/* Interval Selection Buttons */}
            <div className="flex items-center bg-[#EBF5FC] rounded-xl p-1 border border-[#A2D8E2] text-xs font-mono">
              <span className="text-[11px] font-bold text-slate-500 px-2">Interval:</span>
              {(['30s', '1m', '10m', '30m', '1hr', '6hr'] as TelemetryInterval[]).map((intKey) => (
                <button
                  key={intKey}
                  onClick={() => setSelectedInterval(intKey)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    selectedInterval === intKey
                      ? 'bg-[#5C94ED] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-[#CBE5F6]/50'
                  }`}
                >
                  {intKey}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-[#1E40AF] font-bold bg-[#CBE5F6]/60 px-2.5 py-1 rounded-lg border border-[#A2D8E2]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#5C94ED]"></span>
                Power: {telemetry.powerW.toFixed(2)} W
              </span>
              <span className="flex items-center gap-1.5 text-[#0F766E] font-bold bg-[#8BF0F0]/40 px-2.5 py-1 rounded-lg border border-[#A2D8E2]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#8BF0F0]"></span>
                Current: {telemetry.currentA.toFixed(3)} A
              </span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={intervalWindow}>
              <defs>
                <linearGradient id="dashboardPowerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5C94ED" stopOpacity={0.45} />
                  <stop offset="60%" stopColor="#8BF0F0" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#CBE5F6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#A2D8E2" strokeOpacity={0.35} />
              <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 10 }} interval={0} />
              <YAxis yAxisId="left" stroke="#5C94ED" tick={{ fontSize: 10 }} unit="W" />
              <YAxis yAxisId="right" orientation="right" stroke="#0D9488" tick={{ fontSize: 10 }} unit="A" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#A2D8E2',
                  borderWidth: '2px',
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                  boxShadow: '0 10px 25px -5px rgba(92, 148, 237, 0.15)',
                }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="powerW"
                name="Power (W)"
                stroke="#5C94ED"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#dashboardPowerGrad)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="currentA"
                name="Current (A)"
                stroke="#0D9488"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Quick Navigation Bar to Smart Controls & AI Prediction */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Quick link to Smart Controls */}
        <div
          onClick={() => onNavigatePage('controls')}
          className="p-4 rounded-2xl bg-white/95 hover:bg-[#EBF5FC] border-2 border-[#A2D8E2]/80 hover:border-[#5C94ED] cursor-pointer transition-all flex items-center justify-between group shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#CBE5F6] text-[#1E40AF] group-hover:bg-[#A2D8E2] border border-[#A2D8E2] transition-colors">
              <Sliders className="w-5 h-5 text-[#5C94ED]" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-800">Smart Controls</h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Light: <strong className={applianceState.lightOn ? 'text-[#059669]' : 'text-slate-400'}>{applianceState.lightOn ? 'ON (Alone)' : 'OFF'}</strong> • Fan: <strong className="text-slate-500">Adjusting Alone</strong>
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#5C94ED] group-hover:translate-x-1 transition-all" />
        </div>

        {/* Quick link to TNPDCL Billing */}
        <div
          onClick={() => onNavigatePage('predictions')}
          className="p-4 rounded-2xl bg-white/95 hover:bg-[#EBF5FC] border-2 border-[#A2D8E2]/80 hover:border-[#5C94ED] cursor-pointer transition-all flex items-center justify-between group shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#CBE5F6] text-[#0F766E] group-hover:bg-[#A2D8E2] border border-[#A2D8E2] transition-colors">
              <IndianRupee className="w-5 h-5 text-[#0F766E]" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-800">TNPDCL Billing</h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Calendar • <strong className="text-[#059669]">500-Unit Telescopic Slabs</strong>
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#5C94ED] group-hover:translate-x-1 transition-all" />
        </div>

        {/* Quick link to ML Energy Predictor */}
        <div
          onClick={() => onNavigatePage('ml-predictor')}
          className="p-4 rounded-2xl bg-white/95 hover:bg-[#EBF5FC] border-2 border-[#A2D8E2]/80 hover:border-[#5C94ED] cursor-pointer transition-all flex items-center justify-between group shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#8BF0F0]/40 text-[#1E40AF] group-hover:bg-[#8BF0F0]/60 border border-[#A2D8E2] transition-colors">
              <Zap className="w-5 h-5 text-[#2563EB]" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-800">ML Energy Predictor</h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                What-If Power • <strong className="text-[#2563EB]">Python ML Optimizer</strong>
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#5C94ED] group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </div>
  );
};
