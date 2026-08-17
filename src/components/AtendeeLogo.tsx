import React from 'react';

interface AtendeeLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const AtendeeLogo: React.FC<AtendeeLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const iconDimensions = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  }[size];

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Sleek Geometric Modern "a" Mark with Checkmark Accent */}
      <div
        className={`${iconDimensions} rounded-xl bg-yellow-400 text-black flex items-center justify-center font-black shadow-md shadow-yellow-950/40 flex-shrink-0 relative overflow-hidden`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5 text-black"
        >
          {/* Bold geometric loop of 'a' */}
          <circle cx="12" cy="12" r="6" strokeWidth="2.5" />
          {/* Checkmark dynamic stem */}
          <path d="M16 6v12" strokeWidth="2.8" />
          <path d="M9 12l2 2 4-4" strokeWidth="2.5" stroke="currentColor" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <span className={`font-black tracking-tight text-white leading-none ${textSizes}`}>
            atendee<span className="text-yellow-400">.</span>
          </span>
        </div>
      )}
    </div>
  );
};
