import { createRandom, randomRange } from '../../utils/random';
import type { ScenePalette } from './palette';

interface SkyProps {
  uid: string;
  palette: ScenePalette;
  seed: number;
}

/** Sky gradient with sun or moon, stars at night and soft clouds during the day. */
export function Sky({ uid, palette, seed }: SkyProps) {
  const random = createRandom(seed);
  const { x, y } = palette.sunPosition;
  const stars = palette.isNight
    ? Array.from({ length: 60 }, () => ({
        cx: randomRange(random, 0, 400),
        cy: randomRange(random, 0, 170),
        r: randomRange(random, 0.4, 1.3),
        opacity: randomRange(random, 0.3, 1),
      }))
    : [];
  const clouds = Array.from({ length: palette.isNight ? 2 : 4 }, () => ({
    cx: randomRange(random, 20, 380),
    cy: randomRange(random, 30, 110),
    scale: randomRange(random, 0.6, 1.2),
  }));

  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.sky[0]} />
          <stop offset="0.6" stopColor={palette.sky[1]} />
          <stop offset="1" stopColor={palette.sky[2]} />
        </linearGradient>
        <radialGradient id={`${uid}-sun-halo`}>
          <stop offset="0" stopColor={palette.sun} stopOpacity="0.55" />
          <stop offset="1" stopColor={palette.sun} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${uid}-sky)`} />
      {stars.map((star, i) => (
        <circle key={i} {...star} fill="#fff" />
      ))}
      <circle cx={x} cy={y} r="60" fill={`url(#${uid}-sun-halo)`} />
      <circle cx={x} cy={y} r={palette.isNight ? 14 : 20} fill={palette.sun} />
      {palette.isNight && (
        <circle cx={x + 6} cy={y - 4} r="12" fill={palette.sky[0]} opacity="0.9" />
      )}
      {clouds.map((cloud, i) => (
        <g
          key={i}
          transform={`translate(${cloud.cx} ${cloud.cy}) scale(${cloud.scale})`}
          fill={palette.cloud}
        >
          <ellipse cx="0" cy="0" rx="34" ry="10" />
          <ellipse cx="-12" cy="-7" rx="16" ry="11" />
          <ellipse cx="10" cy="-9" rx="18" ry="13" />
        </g>
      ))}
    </g>
  );
}
