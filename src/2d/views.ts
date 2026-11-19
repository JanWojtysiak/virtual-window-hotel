import type { SceneId } from '../scenes/rooms';

export interface SceneLayer {
  /** SVG file relative to `public/`. */
  image: string;
  /** Parallax speed multiplier (0 = stationary, 1 = fastest plane). */
  depth: number;
}

export interface SceneView {
  id: SceneId;
  /** Flat fallback SVG file relative to `public/`. */
  image: string;
  /** Ordered back-to-front layers for 2D multi-plane parallax. */
  layers: readonly SceneLayer[];
}

/** Multi-layer 2D SVG views per scene. */
export const SCENE_VIEWS: Record<SceneId, SceneView> = {
  garden: {
    id: 'garden',
    image: 'assets/rooms/garden/view.svg',
    layers: [
      { image: 'assets/rooms/garden/sky.svg', depth: 0.12 },
      { image: 'assets/rooms/garden/far.svg', depth: 0.32 },
      { image: 'assets/rooms/garden/mid.svg', depth: 0.62 },
      { image: 'assets/rooms/garden/near.svg', depth: 1.0 },
    ],
  },
  city: {
    id: 'city',
    image: 'assets/rooms/city/view.svg',
    layers: [
      { image: 'assets/rooms/city/sky.svg', depth: 0.12 },
      { image: 'assets/rooms/city/far.svg', depth: 0.3 },
      { image: 'assets/rooms/city/mid.svg', depth: 0.58 },
      { image: 'assets/rooms/city/near.svg', depth: 1.0 },
    ],
  },
  apartment: {
    id: 'apartment',
    image: 'assets/rooms/apartment/view.svg',
    layers: [
      { image: 'assets/rooms/apartment/sky.svg', depth: 0.35 },
      { image: 'assets/rooms/apartment/far.svg', depth: 0.85 },
      { image: 'assets/rooms/apartment/mid.svg', depth: 0 },
      { image: 'assets/rooms/apartment/near.svg', depth: 0 },
      { image: 'assets/rooms/apartment/front.svg', depth: 0 },
    ],
  },
};

/** Resolves the `?room=` value to a scene, falling back to the garden. */
export function sceneFromParam(param: string | null): SceneView {
  if (param && param in SCENE_VIEWS) {
    return SCENE_VIEWS[param as SceneId];
  }
  return SCENE_VIEWS.garden;
}
