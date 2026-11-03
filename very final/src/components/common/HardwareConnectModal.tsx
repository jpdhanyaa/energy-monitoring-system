import React, { useState, useEffect } from 'react';
import {
  Usb,
  Wifi,
  X,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Eye,
  Lightbulb,
  Fan,
  RefreshCw,
  Terminal,
  Clock,
} from 'lucide-react';
import { hardwareBridge, HardwareBridgeStatus } from '../../services/hardwareBridge';
import { useToast } from './ToastContainer';

interface HardwareConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HardwareConnectModal: React.FC<HardwareConnectModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { addToast } = useToast();
  const [bridgeStatus, setBridgeStatus] = useState<HardwareBridgeStatus>(hardwareBridge.getStatus());
  const [activeTab, setActiveTab] = useState<'usb' | 'network' | 'wiring'>('usb');
  const [networkUrl, setNetworkUrl] = useState('http://localhost:5000');
  const [isActionPending, setIsActionPending] = useState(false);

  useEffect(() => {
    const unsub = hardwareBridge.subscribeStatus((st) => {
      setBridgeStatus(st);
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const handleConnectUSB = async () => {
    setIsActionPending(true);
    try {
      const ok = await hardwareBridge.connectUSB();
      if (ok) {
        addToast({
          type: 'success',
          title: 'ESP32 Hardware Connected',
          message: 'Receiving live motion detection and sensor telemetry over USB Serial.',
        });
        onClose();
      } else {
        addToast({
          type: 'error',
          title: 'Connection Cancelled',
          message: 'COM port selection was cancelled or unavailable.',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: err?.message || 'Could not connect to USB port.',
      });
    } finally {
      setIsActionPending(false);
    }
  };

  const handleConnectNetwork = async () => {
    setIsActionPending(true);
    try {
      const ok = await hardwareBridge.connectNetwork(networkUrl);
      if (ok) {
        addToast({
          type: 'success',
          title: 'Network Sync Established',
          message: `Connected to ESP32 stream at ${networkUrl}`,
        });
        onClose();
      } else {
        addToast({
          type: 'error',
          title: 'Network Error',
          message: 'Unable to reach the specified endpoint.',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: err?.message,
      });
    } finally {
      setIsActionPending(false);
    }
  };

  const handleDisconnect = async () => {
    await hardwareBridge.disconnect();
    addToast({
      type: 'info',
      title: 'Switched to Simulation',
      message: 'Physical hardware disconnected. Virtual IoT simulator is active.',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl border-2 border-[#A2D8E2] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-white via-[#EBF5FC] to-white border-b-2 border-[#A2D8E2]/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#5C94ED] text-white shadow-sm">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A]">
                Connect ESP32 Hardware to Website
              </h3>
              <p className="text-xs text-slate-500">
                Stream live PIR motion, relay lighting, and power telemetry.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Indicator Banner */}
        <div className="px-5 py-3 bg-[#EBF5FC]/60 border-b border-[#A2D8E2]/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {bridgeStatus.connected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              )}
            </span>
            <span className="font-extrabold text-slate-800">
              {bridgeStatus.connected
                ? `Hardware Online: ${bridgeStatus.portName || bridgeStatus.networkEndpoint}`
                : 'Using Simulation Mode (No Hardware Connected)'}
            </span>
          </div>

          {bridgeStatus.connected && (
            <button
              onClick={handleDisconnect}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline"
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#A2D8E2]/40 bg-slate-50/50 text-xs font-bold">
          <button
            onClick={() => setActiveTab('usb')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-all flex items-center justify-center gap-2 ${
              activeTab === 'usb'
                ? 'border-[#5C94ED] text-[#1E40AF] bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Usb className="w-4 h-4 text-[#5C94ED]" />
            Direct USB (Web Serial)
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-all flex items-center justify-center gap-2 ${
              activeTab === 'network'
                ? 'border-[#5C94ED] text-[#1E40AF] bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wifi className="w-4 h-4 text-[#0D9488]" />
            Network / WiFi
          </button>
          <button
            onClick={() => setActiveTab('wiring')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-all flex items-center justify-center gap-2 ${
              activeTab === 'wiring'
                ? 'border-[#5C94ED] text-[#1E40AF] bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4 text-purple-600" />
            Hardware Setup
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'usb' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#8BF0F0]/20 border border-[#A2D8E2] text-slate-700 leading-relaxed">
                <p className="font-bold text-[#0F766E] flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Recommended: 1-Click Plug & Play Connection
                </p>
                Plug your ESP32 into your computer using a standard USB cable. Click the button below to select your ESP32's COM port. The website will immediately stream live sensor data at <strong>115200 baud</strong>.
              </div>

              {!bridgeStatus.isWebSerialSupported ? (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Web Serial API is not supported in this browser. Please open this website in <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.
                  </span>
                </div>
              ) : (
                <button
                  onClick={handleConnectUSB}
                  disabled={isActionPending}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#5C94ED] hover:bg-[#4A82DC] text-white font-extrabold text-sm shadow-md shadow-[#5C94ED]/20 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
                >
                  {isActionPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Waiting for Port Selection...
                    </>
                  ) : (
                    <>
                      <Usb className="w-4 h-4" />
                      Connect ESP32 (Select USB Port)
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {activeTab === 'network' && (
            <div className="space-y-4">
              <p className="text-slate-600">
                Connect to an ESP32 hosting an HTTP/WebSocket telemetry stream, or your local Node.js backend.
              </p>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Endpoint URL / WebSocket:</label>
                <input
                  type="text"
                  value={networkUrl}
                  onChange={(e) => setNetworkUrl(e.target.value)}
                  placeholder="http://localhost:5000 or ws://192.168.1.50:81"
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#A2D8E2] text-xs font-mono focus:outline-none focus:border-[#5C94ED]"
                />
              </div>
              <button
                onClick={handleConnectNetwork}
                disabled={isActionPending || !networkUrl}
                className="w-full py-3.5 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2 transition-all"
              >
                {isActionPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4" />
                    Connect via Network
                  </>
                )}
              </button>
            </div>
          )}

          {activeTab === 'wiring' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                  Configured Hardware Pinout:
                </span>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                    <span className="flex items-center gap-2 text-slate-700 font-bold">
                      <Eye className="w-3.5 h-3.5 text-[#5C94ED]" />
                      PIR Motion Sensor
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      GPIO 27 (Active)
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                    <span className="flex items-center gap-2 text-slate-700 font-bold">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      Light Relay Channel
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      GPIO 26 (Active-LOW: LOW=ON)
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                    <span className="flex items-center gap-2 text-slate-500 font-bold">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Inactivity Delay Timeout
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                      20 Seconds (Auto-OFF)
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#EBF5FC] border border-[#A2D8E2] text-[11px] text-[#1E40AF] leading-relaxed">
                <strong>Hardware Logic:</strong> When motion is detected on <strong>GPIO 27</strong>, the relay on <strong>GPIO 26</strong> pulls LOW to turn the Light <strong>ON alone</strong> and immediately updates the web app. When no motion is detected for <strong>20 seconds</strong>, the light turns OFF.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-[#A2D8E2]/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Baud Rate: <strong className="font-mono">115200</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
