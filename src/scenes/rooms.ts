/** Scene that a room preview is rendered from (matches future scene config ids). */
export type SceneId = 'garden' | 'city' | 'apartment';

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

/** Representative scene hour for each time of day, used in `?time=` links. */
export const TIME_OF_DAY_HOURS: Record<TimeOfDay, number> = {
  dawn: 6,
  day: 13,
  dusk: 19,
  night: 23,
};

export interface RoomPreview {
  id: string;
  name: string;
  scene: SceneId;
  time: TimeOfDay;
  /** Price per night in PLN (sample data). */
  pricePerNight: number;
}

export const ROOM_PREVIEWS: readonly RoomPreview[] = [
  { id: 'garden-room', name: 'Pokój Ogrodowy', scene: 'garden', time: 'day', pricePerNight: 420 },
  { id: 'city-room', name: 'Pokój Miejski', scene: 'city', time: 'dusk', pricePerNight: 390 },
  {
    id: 'cat-apartment',
    name: 'Apartament z Kotem',
    scene: 'apartment',
    time: 'day',
    pricePerNight: 690,
  },
  { id: 'rose-suite', name: 'Suita Różana', scene: 'garden', time: 'dawn', pricePerNight: 540 },
  { id: 'neon-room', name: 'Pokój Neonowy', scene: 'city', time: 'night', pricePerNight: 450 },
  {
    id: 'night-apartment',
    name: 'Apartament Nocny',
    scene: 'apartment',
    time: 'night',
    pricePerNight: 720,
  },
];

/** Builds the shareable link that opens a room's view. */
export function roomHref(room: RoomPreview): string {
  return `?room=${room.scene}&time=${TIME_OF_DAY_HOURS[room.time]}`;
}
