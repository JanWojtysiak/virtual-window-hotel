import { useId } from 'react';
import type { TimeOfDay } from '../../scenes/rooms';
import { createRandom, randomRange } from '../../utils/random';
import { PALETTES, svgId } from './palette';
import { Sky } from './Sky';

const HORIZON = 250;

interface Building {
  x: number;
  width: number;
  height: number;
}

function layoutSkyline(
  random: () => number,
  minWidth: number,
  maxWidth: number,
  minHeight: number,
  maxHeight: number,
): Building[] {
  const buildings: Building[] = [];
  let x = -10;
  while (x < 410) {
    const width = randomRange(random, minWidth, maxWidth);
    buildings.push({ x, width, height: randomRange(random, minHeight, maxHeight) });
    x += width + randomRange(random, 0, 6);
  }
  return buildings;
}

export function CityArt({ time }: { time: TimeOfDay }) {
  const uid = svgId(useId());
  const p = PALETTES[time];
  const random = createRandom(23);
  const far = layoutSkyline(random, 18, 40, 70, 150);
  const near = layoutSkyline(random, 45, 80, 80, 170);
  const lightsOn = p.litChance > 0.3;
  const unlitWindow = p.isNight ? '#0a1020' : 'rgba(200, 230, 255, 0.35)';

  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor={p.glow} stopOpacity="0.8" />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <Sky uid={uid} palette={p} seed={5} />
      {far.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={HORIZON - b.height}
          width={b.width}
          height={b.height}
          fill={p.far}
        />
      ))}
      {near.map((b, i) => {
        const top = HORIZON - b.height + 30;
        const windows = [];
        for (let wy = top + 10; wy < HORIZON - 8; wy += 13) {
          for (let wx = b.x + 7; wx < b.x + b.width - 9; wx += 11) {
            const lit = random() < p.litChance;
            windows.push(
              <rect
                key={`${wx}-${wy}`}
                x={wx}
                y={wy}
                width="5"
                height="7"
                fill={lit ? p.glow : unlitWindow}
                opacity={lit ? randomRange(random, 0.6, 1) : 1}
              />,
            );
          }
        }
        return (
          <g key={i}>
            <rect x={b.x} y={top} width={b.width} height={HORIZON - top} fill={p.near} />
            {windows}
          </g>
        );
      })}
      {lightsOn && (
        <g>
          <rect x="22" y="150" width="56" height="16" rx="3" fill="#ff4f8b" opacity="0.9" />
          <rect x="22" y="150" width="56" height="16" rx="3" fill="none" stroke="#ffd1e2" />
          <rect x="300" y="140" width="40" height="12" rx="3" fill="#4fd8ff" opacity="0.9" />
        </g>
      )}
      <rect x="0" y={HORIZON} width="400" height={300 - HORIZON} fill="#1b1e27" />
      <rect x="0" y={HORIZON} width="400" height="4" fill="#3a3e4a" />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={i * 44 + 6} y="280" width="22" height="2.5" fill="#d9d4c0" opacity="0.6" />
      ))}
      <g transform="translate(150 236)">
        <rect width="120" height="30" rx="6" fill="#c8372d" />
        <rect y="22" width="120" height="4" fill="#f2e7d0" />
        {Array.from({ length: 6 }, (_, i) => (
          <rect
            key={i}
            x={8 + i * 18}
            y="6"
            width="12"
            height="11"
            rx="2"
            fill={lightsOn ? p.glow : '#bcdcea'}
          />
        ))}
        <line x1="60" y1="0" x2="74" y2="-40" stroke="#2a2d36" strokeWidth="1.5" />
      </g>
      <line x1="0" y1="196" x2="400" y2="196" stroke="#2a2d36" strokeWidth="1" />
      <g transform="translate(40 268)">
        <rect width="46" height="14" rx="5" fill="#e9eef5" />
        <rect x="8" y="-8" width="28" height="10" rx="4" fill="#e9eef5" />
        {lightsOn && <circle cx="48" cy="7" r="16" fill={`url(#${uid}-glow)`} />}
      </g>
      {lightsOn &&
        [60, 200, 340].map((x) => (
          <g key={x}>
            <rect x={x} y={HORIZON - 40} width="2" height="40" fill="#2a2d36" />
            <circle cx={x + 1} cy={HORIZON - 42} r="18" fill={`url(#${uid}-glow)`} />
          </g>
        ))}
    </svg>
  );
}
