import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', className = '', showText = false }) => {
  const sizeMap = {
    sm: { box: 'w-7 h-7', icon: 'w-4 h-4' },
    md: { box: 'w-9 h-9', icon: 'w-5 h-5' },
    lg: { box: 'w-11 h-11', icon: 'w-6 h-6' },
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Visual Emblem */}
      <div
        className={`relative ${sizeMap.box} rounded-xl bg-gradient-to-tr from-[#5C94ED] via-[#8BF0F0] to-[#A2D8E2] p-0.5 shadow-sm shadow-[#5C94ED]/30 flex-shrink-0`}
      >
        <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center overflow-hidden">
          <svg
            className={`${sizeMap.icon} text-[#5C94ED]`}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Dynamic Energy Lightning + Circuit Leaf */}
            <path
              d="M13 2L4 13.5H11L9.5 22L20 9.5H13L14.5 2Z"
              fill="url(#logoGrad)"
              stroke="#5C94ED"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <circle cx="5" cy="5" r="1.5" fill="#8BF0F0" />
            <circle cx="19" cy="19" r="1.5" fill="#5C94ED" />
            <defs>
              <linearGradient id="logoGrad" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#5C94ED" />
                <stop offset="0.6" stopColor="#8BF0F0" />
                <stop offset="1" stopColor="#A2D8E2" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {showText && (
        <div>
          <span className="text-xs sm:text-sm font-extrabold tracking-tight text-[#0F172A] block leading-tight">
            AI Smart Energy Management
          </span>
        </div>
      )}
    </div>
  );
};
