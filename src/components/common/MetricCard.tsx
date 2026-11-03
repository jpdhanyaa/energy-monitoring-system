import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subValue?: string;
  subLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  glowColor?: 'cyan' | 'blue' | 'emerald' | 'amber' | 'purple' | 'rose';
  isEstimated?: boolean;
  isMeasured?: boolean;
  statusBadge?: {
    text: string;
    variant: 'success' | 'warning' | 'info' | 'danger' | 'neutral';
  };
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subValue,
  subLabel,
  icon: Icon,
  iconColor = 'text-[#5C94ED]',
  glowColor = 'blue',
  isEstimated = false,
  isMeasured = false,
  statusBadge,
}) => {
  const glowStyles = {
    cyan: 'hover:border-[#A2D8E2] hover:shadow-[0_4px_20px_rgba(139,240,240,0.25)]',
    blue: 'hover:border-[#5C94ED]/60 hover:shadow-[0_4px_20px_rgba(92,148,237,0.2)]',
    emerald: 'hover:border-[#A2D8E2] hover:shadow-[0_4px_20px_rgba(139,240,240,0.25)]',
    amber: 'hover:border-[#FBBF24]/60 hover:shadow-[0_4px_20px_rgba(251,191,36,0.2)]',
    purple: 'hover:border-[#5C94ED]/60 hover:shadow-[0_4px_20px_rgba(92,148,237,0.2)]',
    rose: 'hover:border-[#FB7185]/60 hover:shadow-[0_4px_20px_rgba(251,113,133,0.2)]',
  }[glowColor];

  const badgeStyles = {
    success: 'bg-[#8BF0F0]/50 text-[#0F766E] border-[#A2D8E2] font-semibold',
    warning: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
    info: 'bg-[#CBE5F6] text-[#1E40AF] border-[#A2D8E2] font-semibold',
    danger: 'bg-[#FFE4E6] text-[#9F1239] border-[#FECDD3]',
    neutral: 'bg-[#F1F5F9] text-slate-700 border-[#A2D8E2]',
  };

  return (
    <div
      className={`relative p-5 rounded-2xl bg-white/95 backdrop-blur-sm border-2 border-[#A2D8E2]/80 hover:border-[#5C94ED] shadow-[0_4px_18px_rgba(92,148,237,0.08)] transition-all duration-300 ${glowStyles}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold tracking-wide text-slate-600 uppercase">
            {title}
          </span>
          {isEstimated && (
            <span
              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#CBE5F6] text-[#1E40AF] border border-[#A2D8E2]"
              title="Estimated calculated value (Power = Current * Reference Voltage)"
            >
              Estimated
            </span>
          )}
          {isMeasured && (
            <span
              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#8BF0F0]/60 text-[#0F766E] border border-[#A2D8E2]"
              title="Direct sensor analog acquisition (ACS712)"
            >
              Measured
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {statusBadge && (
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                badgeStyles[statusBadge.variant]
              }`}
            >
              {statusBadge.text}
            </span>
          )}
          <div className="p-2.5 rounded-xl bg-[#CBE5F6]/50 border border-[#A2D8E2] text-[#5C94ED]">
            <Icon className={`w-4 h-4 ${iconColor}`} />
          </div>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[#0F172A]">
          {value}
        </span>
        {unit && (
          <span className="text-sm font-bold text-[#5C94ED] font-mono">{unit}</span>
        )}
      </div>

      {(subValue || subLabel) && (
        <div className="mt-3 pt-3 border-t border-[#A2D8E2]/40 flex items-center justify-between text-xs text-slate-600">
          <span>{subLabel}</span>
          <span className="font-mono font-bold text-[#1E3A8A]">{subValue}</span>
        </div>
      )}
    </div>
  );
};
