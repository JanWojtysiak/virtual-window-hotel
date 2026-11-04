import { useId } from 'react';
import type { TimeOfDay } from '../../../scenes/rooms';
import { PALETTES, svgId } from './palette';
import { Sky } from './Sky';

interface TreeProps {
  x: number;
  y: number;
  size: number;
  color: string;
}

function Tree({ x, y, size, color }: TreeProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <rect x="-3" y="-6" width="6" height="26" rx="2" fill="#3b2a20" opacity="0.85" />
      <circle cx="0" cy="-22" r="18" fill={color} />
      <circle cx="-13" cy="-10" r="13" fill={color} />
      <circle cx="13" cy="-11" r="14" fill={color} />
      <circle cx="-5" cy="-28" r="8" fill="#fff" opacity="0.08" />
    </g>
  );
}

const LAMPS = [
  { x: 150, y: 248 },
  { x: 300, y: 236 },
];

export function GardenArt({ time }: { time: TimeOfDay }) {
  const uid = svgId(useId());
  const p = PALETTES[time];
  const lampsOn = p.litChance > 0.3;

  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-lamp`}>
          <stop offset="0" stopColor={p.glow} stopOpacity="0.9" />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <Sky uid={uid} palette={p} seed={11} />
      <path
        d="M0 190 C 60 150, 120 172, 180 156 S 300 140, 400 172 L400 300 L0 300Z"
        fill={p.far}
      />
      {[40, 95, 210, 330, 372].map((x, i) => (
        <Tree key={x} x={x} y={190 - (i % 2) * 6} size={0.55} color={p.mid} />
      ))}
      <path
        d="M0 218 C 80 188, 150 208, 230 192 S 350 186, 400 202 L400 300 L0 300Z"
        fill={p.mid}
      />
      <Tree x={60} y={228} size={1.2} color={p.near} />
      <Tree x={250} y={214} size={0.95} color={p.near} />
      <Tree x={355} y={224} size={1.35} color={p.near} />
      <path d="M0 242 C 120 226, 280 230, 400 238 L400 300 L0 300Z" fill={p.ground} />
      <path
        d="M150 300 C 180 274, 230 256, 262 240 L 276 240 C 252 258, 228 276, 238 300Z"
        fill={p.path}
        opacity="0.85"
      />
      <ellipse cx="20" cy="290" rx="60" ry="22" fill={p.near} />
      <ellipse cx="385" cy="292" rx="70" ry="24" fill={p.near} />
      {LAMPS.map(({ x, y }) => (
        <g key={x}>
          <rect x={x - 1.5} y={y - 34} width="3" height="34" fill="#22201f" />
          <circle cx={x} cy={y - 36} r="4" fill={lampsOn ? p.glow : '#d8d2c4'} />
          {lampsOn && <circle cx={x} cy={y - 36} r="26" fill={`url(#${uid}-lamp)`} />}
        </g>
      ))}
    </svg>
  );
}
