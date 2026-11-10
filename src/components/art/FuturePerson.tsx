import { useId } from 'react';

const GLOW_COLORS = { neon: '#6fe3ff', accent: '#f2b544' } as const;

const LEFT_ARM = 'M24 66 L16 104 L18 140';
const LEFT_LEG = 'M40 128 L38 188 L36 244';
const RIGHT_LEG = 'M60 128 L62 188 L64 244';
/** `reach` raises the arm on the viewer's right towards the cube (mirror the SVG for the other side). */
const RIGHT_ARM = {
  stand: 'M76 66 L84 104 L82 140',
  reach: 'M76 66 L97 84 L118 66',
} as const;

interface FuturePersonProps {
  pose: keyof typeof RIGHT_ARM;
  glow: keyof typeof GLOW_COLORS;
  className?: string;
}

/** Stylised person in a sleek suit with a glowing visor and light seams. */
export function FuturePerson({ pose, glow, className }: FuturePersonProps) {
  // React ids contain characters that break `url(#…)` references.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const suit = `url(#${uid}-suit)`;
  const glowFilter = `url(#${uid}-glow)`;
  const color = GLOW_COLORS[glow];
  const rightArm = RIGHT_ARM[pose];

  return (
    <svg viewBox="-20 0 145 260" className={className} aria-hidden="true">
      <defs>
        <linearGradient
          id={`${uid}-suit`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="0"
          y2="260"
        >
          <stop offset="0" stopColor="#2e3b5e" />
          <stop offset="1" stopColor="#0f1528" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g fill="none" stroke={suit} strokeLinecap="round" strokeLinejoin="round">
        <path d={LEFT_LEG} strokeWidth="15" />
        <path d={RIGHT_LEG} strokeWidth="15" />
        <path d={LEFT_ARM} strokeWidth="12" />
        <path d={rightArm} strokeWidth="12" />
      </g>
      <g fill={suit}>
        <path d="M22 62 Q50 50 78 62 L71 132 Q50 138 29 132 Z" />
        <rect x="43" y="40" width="14" height="18" rx="5" />
        <ellipse cx="50" cy="27" rx="15" ry="18" />
      </g>

      {/* Light seams along the limbs and torso. */}
      <g fill="none" stroke={color} strokeOpacity="0.65" strokeWidth="1.2" strokeLinecap="round">
        <path d={LEFT_LEG} />
        <path d={RIGHT_LEG} />
        <path d={LEFT_ARM} />
        <path d={rightArm} />
        <path d="M50 66 L50 118" />
        <path d="M30 120 Q50 127 70 120" />
      </g>

      <g fill={color} filter={glowFilter}>
        <rect x="36" y="20" width="28" height="8" rx="4" />
        <circle cx="50" cy="82" r="4" />
        {pose === 'reach' && <circle cx="118" cy="66" r="4.5" />}
      </g>
      <path
        d="M38 58 Q50 65 62 58"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        filter={glowFilter}
      />
    </svg>
  );
}
