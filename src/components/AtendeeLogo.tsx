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

  const fontSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-3xl',
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Clean bold 'a' lettermark */}
      <div
        className={`${iconDimensions} rounded-xl bg-yellow-400 flex items-center justify-center flex-shrink-0 shadow-md shadow-yellow-950/40`}
      >
        <span className={`font-black text-black leading-none select-none ${fontSizes}`} style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: '-0.05em' }}>
          a
        </span>
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
