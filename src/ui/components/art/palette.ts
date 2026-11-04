import type { TimeOfDay } from '../../../scenes/rooms';

export interface ScenePalette {
  /** Sky gradient stops: top, middle, horizon. */
  sky: [string, string, string];
  /** Sun colour by day, moon colour at night. */
  sun: string;
  isNight: boolean;
  sunPosition: { x: number; y: number };
  cloud: string;
  far: string;
  mid: string;
  near: string;
  ground: string;
  path: string;
  /** Probability (0..1) that a building window or lamp is lit. */
  litChance: number;
  glow: string;
  wall: string;
  floor: string;
  /** Darkness (0..1) applied to interiors. */
  shade: number;
}

export const PALETTES: Record<TimeOfDay, ScenePalette> = {
  dawn: {
    sky: ['#5f6fa8', '#e7a6a0', '#fcd9a6'],
    sun: '#ffd99a',
    isNight: false,
    sunPosition: { x: 80, y: 165 },
    cloud: 'rgba(255, 226, 214, 0.75)',
    far: '#a78f9f',
    mid: '#7f7a8c',
    near: '#4f5e5c',
    ground: '#6f8466',
    path: '#d9c3a5',
    litChance: 0.12,
    glow: '#ffcf7a',
    wall: '#e9d6c4',
    floor: '#9a7a62',
    shade: 0.12,
  },
  day: {
    sky: ['#4a9be0', '#9fd3f4', '#e6f5fc'],
    sun: '#fff4c8',
    isNight: false,
    sunPosition: { x: 300, y: 55 },
    cloud: 'rgba(255, 255, 255, 0.9)',
    far: '#9cc9a8',
    mid: '#68a675',
    near: '#3e7a4c',
    ground: '#7cb868',
    path: '#e8dcc2',
    litChance: 0,
    glow: '#ffe9a8',
    wall: '#efe4d6',
    floor: '#b08866',
    shade: 0,
  },
  dusk: {
    sky: ['#262a5a', '#b4507a', '#f4a25a'],
    sun: '#ffb066',
    isNight: false,
    sunPosition: { x: 320, y: 175 },
    cloud: 'rgba(255, 170, 150, 0.55)',
    far: '#6c4d72',
    mid: '#4c3a5e',
    near: '#2f2744',
    ground: '#3d3350',
    path: '#a07c86',
    litChance: 0.45,
    glow: '#ffc46b',
    wall: '#c9a48f',
    floor: '#6e5040',
    shade: 0.25,
  },
  night: {
    sky: ['#050816', '#121a3a', '#28325e'],
    sun: '#f2edd6',
    isNight: true,
    sunPosition: { x: 310, y: 60 },
    cloud: 'rgba(120, 130, 170, 0.25)',
    far: '#1b2542',
    mid: '#151d36',
    near: '#0e1428',
    ground: '#121b30',
    path: '#2a3350',
    litChance: 0.65,
    glow: '#ffcf70',
    wall: '#3a3448',
    floor: '#231f2c',
    shade: 0.45,
  },
};

/** SVG ids must not contain characters React's `useId` may produce (e.g. ":" or "«"). */
export function svgId(reactId: string): string {
  return `art${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}
