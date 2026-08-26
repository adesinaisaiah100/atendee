import React from 'react';

interface AtendeeLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

/**
 * atendee brand mark.
 * 
 * The mark is a geometric single-story 'a':
 *   — A circular bowl drawn as an open arc (counterclockwise, large sweep)
 *   — A clean vertical stem on the right side
 *   — Open aperture at the top-right where stem meets bowl
 * 
 * viewBox 0 0 24 24
 * Bowl ellipse: approximate center (9.5, 12), r ≈ 7.6
 *   Arc from (15.5, 7.2) CCW to (15.5, 16.8) via left side
 * Stem: x=15.5, y 4 → 20
 */

// The shared 'a' mark SVG path — reused at all sizes
const AMark = ({ strokeWidth = 2.4 }: { strokeWidth?: number }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{ width: '66%', height: '66%' }}
  >
    {/* Vertical stem */}
    <line
      x1="15.5" y1="4"
      x2="15.5" y2="20"
      stroke="black"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    {/* Bowl: large arc counterclockwise from top-right of bowl to bottom-right */}
    <path
      d="M 15.5 7.2 A 7.6 7.6 0 1 0 15.5 16.8"
      stroke="black"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

export const AtendeeLogo: React.FC<AtendeeLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const badgeClass = {
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-10 h-10 rounded-2xl',
    lg: 'w-14 h-14 rounded-2xl',
  }[size];

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
  }[size];

  const strokeWidth = { sm: 2.6, md: 2.4, lg: 2.2 }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Yellow badge with calligraphic 'a' mark */}
      <div
        className={`${badgeClass} bg-yellow-400 flex items-center justify-center flex-shrink-0 shadow-md shadow-yellow-950/40`}
      >
        <AMark strokeWidth={strokeWidth} />
      </div>

      {showText && (
        <span className={`font-black tracking-tight text-white leading-none ${textSizes}`}>
          atendee<span className="text-yellow-400">.</span>
        </span>
      )}
    </div>
  );
};

/**
 * Inline SVG of just the 'a' mark — for use in meta/OG images, favicons, etc.
 * Returns a complete <svg> element as a JSX-free string.
 */
export const ATENDEE_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <line x1="15.5" y1="4" x2="15.5" y2="20" stroke="black" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M 15.5 7.2 A 7.6 7.6 0 1 0 15.5 16.8" stroke="black" stroke-width="2.4" stroke-linecap="round" fill="none"/>
</svg>`;
