import React, { useState, useEffect } from 'react';
import {
  Menu,
  Usb,
  Wifi,
  Sparkles,
} from 'lucide-react';
import { Logo } from '../common/Logo';
import { hardwareBridge, HardwareBridgeStatus } from '../../services/hardwareBridge';

interface NavbarProps {
  onToggleSidebar: () => void;
  onOpenHardwareModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  onOpenHardwareModal,
}) => {
  const [bridgeStatus, setBridgeStatus] = useState<HardwareBridgeStatus>(hardwareBridge.getStatus());

  useEffect(() => {
    const unsub = hardwareBridge.subscribeStatus((st) => {
      setBridgeStatus(st);
    });
    return unsub;
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-white/90 backdrop-blur-md border-b-2 border-[#A2D8E2] shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
      {/* Left: Menu trigger, Logo, and Heading */}
      <div className="flex items-center gap-3.5">
        <button
          onClick={onToggleSidebar}
          className="flex items-center gap-2 p-2 sm:px-3 sm:py-2 text-[#0F172A] hover:text-[#5C94ED] rounded-xl bg-[#CBE5F6]/50 hover:bg-[#CBE5F6] border border-[#A2D8E2] transition-colors shadow-xs"
          title="Open Navigation Menu"
        >
          <Menu className="w-5 h-5 text-[#5C94ED]" />
          <span className="text-xs font-bold hidden sm:inline text-slate-800">Menu</span>
        </button>

        {/* Logo emblem */}
        <Logo size="sm" />

        {/* Heading strictly alone without stacked subtitles */}
        <h1 className="text-base sm:text-lg md:text-xl font-extrabold tracking-tight text-[#0F172A]">
          AI Smart Energy Management
        </h1>
      </div>

      {/* Right: Connect Hardware button */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenHardwareModal}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold border-2 transition-all shadow-xs ${
            bridgeStatus.connected
              ? 'bg-[#8BF0F0]/50 text-[#0F766E] border-[#A2D8E2] hover:bg-[#8BF0F0]/70'
              : 'bg-white hover:bg-[#EBF5FC] text-[#1E40AF] border-[#5C94ED] hover:shadow-md'
          }`}
          title="Connect ESP32 Hardware via USB Cable or Local Network"
        >
          {bridgeStatus.connected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {bridgeStatus.mode === 'usb_connected' ? (
                <Usb className="w-3.5 h-3.5 text-[#0F766E]" />
              ) : (
                <Wifi className="w-3.5 h-3.5 text-[#0F766E]" />
              )}
              <span className="hidden sm:inline">ESP32 Hardware Online</span>
              <span className="sm:hidden">Hardware Online</span>
            </>
          ) : (
            <>
              <Usb className="w-3.5 h-3.5 text-[#5C94ED]" />
              <span className="hidden sm:inline">Connect Hardware</span>
              <span className="sm:hidden">Connect</span>
              <Sparkles className="w-3 h-3 text-[#5C94ED] opacity-60" />
            </>
          )}
        </button>
      </div>
    </header>
  );
};
