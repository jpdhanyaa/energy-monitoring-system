/**
 * AI Smart Energy Management System Using IoT and Machine Learning
 * Clean, Refactored Application Shell focused on 3 Core Capabilities:
 * 1. Live Energy Dashboard
 * 2. Smart Appliance & Automation Controls
 * 3. AI Monthly Energy & Bill Prediction
 */

import React, { useState, useEffect } from 'react';
import { ToastProvider } from './components/common/ToastContainer';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { SmartControlsPage } from './pages/SmartControlsPage';
import { AIPredictionPage } from './pages/AIPredictionPage';
import { MLEnergyPredictorPage } from './pages/MLEnergyPredictorPage';

import { TelemetryReading, ApplianceState } from './types/energy';
import { iotSimulator } from './services/iotSimulator';
import { HardwareConnectModal } from './components/common/HardwareConnectModal';

const INITIAL_TELEMETRY: TelemetryReading = {
  deviceId: 'esp32-energy-devkit-01',
  timestamp: new Date().toISOString(),
  currentA: 0.265,
  voltageV: null,
  voltageEstimated: 5.0,
  powerW: 1.325,
  isPowerEstimated: true,
  energyKWh: 14.852,
  todayKWh: 0.485,
  monthKWh: 12.64,
  motionDetected: true,
  ambientLight: 280,
  ambientLux: 178,
  lightOn: true,
  fanOn: false,
  fanSpeedPercent: 0,
  deviceMode: 'simulated',
  rssi: -58,
  uptimeSeconds: 7240,
};

function MainApp() {
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hardwareModalOpen, setHardwareModalOpen] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetryReading>(INITIAL_TELEMETRY);
  const [applianceState, setApplianceState] = useState<ApplianceState>(iotSimulator.getApplianceState());

  // Subscribe to IoT real-time sensor & state feed
  useEffect(() => {
    const unsubTelemetry = iotSimulator.subscribeTelemetry((reading) => {
      setTelemetry(reading);
    });

    const unsubState = iotSimulator.subscribeState((st) => {
      setApplianceState(st);
    });

    return () => {
      unsubTelemetry();
      unsubState();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EBF5FC] via-[#E2F3FB] to-[#CBE5F6]/90 text-[#0F172A] flex flex-col font-sans relative">
      {/* Subtle ambient lighting orbs in Soft Cyan and Cornflower */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-[#8BF0F0]/20 rounded-full blur-3xl pointer-events-none -z-10 transform -translate-y-1/2"></div>
      <div className="fixed bottom-0 right-1/4 w-[32rem] h-[32rem] bg-[#5C94ED]/15 rounded-full blur-3xl pointer-events-none -z-10 transform translate-y-1/3"></div>
      <div className="fixed top-1/2 right-0 w-80 h-80 bg-[#A2D8E2]/25 rounded-full blur-3xl pointer-events-none -z-10"></div>
      {/* Sidebar Navigation (3 Core Sections) */}
      <Sidebar
        activePage={activePage}
        onSelectPage={(p) => setActivePage(p)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full transition-all duration-300">
        <Navbar
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onOpenHardwareModal={() => setHardwareModalOpen(true)}
        />

        <HardwareConnectModal
          isOpen={hardwareModalOpen}
          onClose={() => setHardwareModalOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activePage === 'dashboard' && (
            <DashboardPage
              telemetry={telemetry}
              applianceState={applianceState}
              onNavigatePage={(p) => setActivePage(p)}
            />
          )}

          {activePage === 'controls' && (
            <SmartControlsPage
              applianceState={applianceState}
              telemetry={telemetry}
              onNavigatePage={(p) => setActivePage(p)}
              onOpenHardwareModal={() => setHardwareModalOpen(true)}
            />
          )}

          {activePage === 'predictions' && (
            <AIPredictionPage
              onNavigatePage={(p) => setActivePage(p)}
            />
          )}

          {activePage === 'ml-predictor' && (
            <MLEnergyPredictorPage
              onNavigatePage={(p) => setActivePage(p)}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
