import type { SceneId } from '../scenes/rooms';

export interface SceneView {
  id: SceneId;
  /** SVG file relative to `public/`. */
  image: string;
}

/** One flat (2D) SVG picture per scene. Adding a room = adding an entry + an SVG file. */
export const SCENE_VIEWS: Record<SceneId, SceneView> = {
  garden: { id: 'garden', image: 'assets/rooms/garden/view.svg' },
  city: { id: 'city', image: 'assets/rooms/city/view.svg' },
  apartment: { id: 'apartment', image: 'assets/rooms/apartment/view.svg' },
};

/** Resolves the `?room=` value to a scene, falling back to the garden. */
export function sceneFromParam(param: string | null): SceneView {
  if (param && param in SCENE_VIEWS) {
    return SCENE_VIEWS[param as SceneId];
  }
  return SCENE_VIEWS.garden;
}
