import { useId } from 'react';
import type { TimeOfDay } from '../../../scenes/rooms';
import { PALETTES, svgId } from './palette';
import { Sky } from './Sky';

const WINDOW = { x: 50, y: 34, width: 180, height: 150 };

export function ApartmentArt({ time }: { time: TimeOfDay }) {
  const uid = svgId(useId());
  const p = PALETTES[time];
  const lampOn = p.shade > 0.2;
  const { x, y, width, height } = WINDOW;

  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-lamp`}>
          <stop offset="0" stopColor={p.glow} stopOpacity="0.75" />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-tank`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fe0ee" />
          <stop offset="1" stopColor="#1f7f9c" />
        </linearGradient>
      </defs>

      <rect width="400" height="300" fill={p.wall} />

      {/* View outside the window, scaled into the window frame. */}
      <svg
        x={x}
        y={y}
        width={width}
        height={height}
        viewBox="0 60 400 240"
        preserveAspectRatio="xMidYMid slice"
      >
        <Sky uid={`${uid}-out`} palette={p} seed={3} />
        <path
          d="M0 220 C 90 170, 170 200, 250 180 S 360 170, 400 190 L400 300 L0 300Z"
          fill={p.far}
        />
        <path d="M0 250 C 100 220, 220 240, 400 225 L400 300 L0 300Z" fill={p.mid} />
      </svg>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke="#f6f0e6"
        strokeWidth="7"
      />
      <rect x={x + width / 2 - 2.5} y={y} width="5" height={height} fill="#f6f0e6" />
      <rect x={x} y={y + height / 2 - 2.5} width={width} height="5" fill="#f6f0e6" />
      <rect x={x - 14} y={y + height + 2} width={width + 28} height="9" rx="2" fill="#e6dccd" />

      <path
        d={`M${x - 26} ${y - 14} H${x + 16} C ${x + 6} ${y + 60}, ${x + 22} ${y + 120}, ${x + 8} ${y + 196} H${x - 26}Z`}
        fill="#c9785a"
      />
      <path
        d={`M${x + width + 26} ${y - 14} H${x + width - 16} C ${x + width - 6} ${y + 60}, ${x + width - 22} ${y + 120}, ${x + width - 8} ${y + 196} H${x + width + 26}Z`}
        fill="#c9785a"
      />
      <rect x={x - 34} y={y - 18} width={width + 68} height="6" rx="3" fill="#5a3d2e" />

      <rect y="232" width="400" height="68" fill={p.floor} />
      <ellipse cx="250" cy="272" rx="120" ry="18" fill="#d9c2a0" opacity="0.5" />

      {/* Aquarium on a cabinet. */}
      <rect x="14" y="214" width="96" height="30" rx="3" fill="#6b4a36" />
      <rect x="20" y="168" width="84" height="46" rx="3" fill={`url(#${uid}-tank)`} opacity="0.9" />
      <rect x="20" y="168" width="84" height="5" fill="#cfeff5" opacity="0.6" />
      {[
        { cx: 44, cy: 188, color: '#ff8a3d' },
        { cx: 76, cy: 198, color: '#ffd23d' },
        { cx: 62, cy: 182, color: '#ff5d5d' },
      ].map((fish) => (
        <g key={fish.cx} fill={fish.color}>
          <ellipse cx={fish.cx} cy={fish.cy} rx="6" ry="3.5" />
          <path d={`M${fish.cx - 5} ${fish.cy} l-5 -4 v8z`} />
        </g>
      ))}
      <path
        d="M30 214 q4 -16 0 -26 M36 214 q-3 -12 2 -20"
        stroke="#3fa76a"
        strokeWidth="2.5"
        fill="none"
      />

      {/* Plant by the window. */}
      <path d="M244 232 h22 l-3 -24 h-16z" fill="#b5653f" />
      {[-30, -12, 8, 26].map((angle) => (
        <ellipse
          key={angle}
          cx="255"
          cy="194"
          rx="5"
          ry="16"
          fill="#3f8c55"
          transform={`rotate(${angle} 255 208)`}
        />
      ))}

      {/* Sofa with a sleeping cat. */}
      <rect x="268" y="176" width="124" height="44" rx="12" fill="#3f5f73" />
      <rect x="262" y="206" width="136" height="32" rx="10" fill="#4a6e84" />
      <rect x="258" y="196" width="18" height="44" rx="8" fill="#3a5869" />
      <rect x="384" y="196" width="18" height="44" rx="8" fill="#3a5869" />
      <g fill="#e08a3c">
        <ellipse cx="318" cy="201" rx="22" ry="10" />
        <circle cx="300" cy="196" r="8" />
        <path d="M294 191 l2 -9 l5 6z M302 189 l5 -7 l2 8z" />
        <path
          d="M338 204 q14 4 10 -8"
          stroke="#e08a3c"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* Floor lamp. */}
      <rect x="371" y="110" width="3" height="122" fill="#2b2522" />
      <path d="M358 110 h29 l-6 -22 h-17z" fill="#f1e3c8" />

      {/* Robot vacuum. */}
      <ellipse cx="150" cy="262" rx="22" ry="7" fill="#3b3f47" />
      <ellipse cx="150" cy="259" rx="20" ry="5.5" fill="#5b616c" />
      <circle cx="158" cy="258" r="1.5" fill="#5dff9a" />

      {/* Darken the interior but keep the window view at its own light level. */}
      <path
        d={`M0 0H400V300H0Z M${x} ${y}h${width}v${height}h${-width}Z`}
        fillRule="evenodd"
        fill="#0a0e1a"
        opacity={p.shade}
      />
      {lampOn && (
        <g>
          <circle cx="372" cy="104" r="80" fill={`url(#${uid}-lamp)`} />
          <rect x="20" y="168" width="84" height="46" fill="#7fe0ee" opacity="0.25" />
        </g>
      )}
    </svg>
  );
}
