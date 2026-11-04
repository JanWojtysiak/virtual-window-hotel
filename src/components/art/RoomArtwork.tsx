import type { SceneId, TimeOfDay } from '../../scenes/rooms';
import { ApartmentArt } from './ApartmentArt';
import { CityArt } from './CityArt';
import { GardenArt } from './GardenArt';

interface RoomArtworkProps {
  scene: SceneId;
  time: TimeOfDay;
}

/** Illustrated placeholder preview of a room until real layer artwork is available. */
export function RoomArtwork({ scene, time }: RoomArtworkProps) {
  switch (scene) {
    case 'garden':
      return <GardenArt time={time} />;
    case 'city':
      return <CityArt time={time} />;
    case 'apartment':
      return <ApartmentArt time={time} />;
  }
}
