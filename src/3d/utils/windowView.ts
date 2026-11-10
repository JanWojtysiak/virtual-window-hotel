// Pure geometry helpers for the 3D window view (no Three.js import – testable in Vitest).

export interface OutdoorCoverInput {
  /** Width and height of the wall opening (metres), centred on the origin at z = 0. */
  openingWidth: number;
  openingHeight: number;
  /** Distance of the viewer (camera) in front of the wall, along +z. */
  viewerDistance: number;
  /** How far the viewer can move sideways / up-down from the centre (metres). */
  viewerRangeX: number;
  viewerRangeY: number;
  /** Distance of the outdoor photo plane behind the wall, along -z. */
  planeDistance: number;
}

/**
 * Half-extents the outdoor plane must have so that, from every allowed viewer position,
 * nothing but the plane is visible through the opening. A ray from the viewer at offset v
 * through the opening edge e reaches the plane at v + (e - v) · (D + P) / D.
 */
export function outdoorHalfExtents(input: OutdoorCoverInput): {
  halfWidth: number;
  halfHeight: number;
} {
  const { openingWidth, openingHeight, viewerDistance, viewerRangeX, viewerRangeY, planeDistance } =
    input;
  const k = (viewerDistance + planeDistance) / viewerDistance;
  // Worst case: viewer at one extreme looking past the opposite edge.
  const reach = (edge: number, range: number): number => -range + (edge + range) * k;
  return {
    halfWidth: reach(openingWidth / 2, viewerRangeX),
    halfHeight: reach(openingHeight / 2, viewerRangeY),
  };
}

/**
 * Scale for a plane that is `aspect` wide and 1 high, so that it covers a rectangle of
 * the given half-extents ("cover" fit), with an extra safety margin.
 */
export function outdoorPlaneScale(
  aspect: number,
  halfWidth: number,
  halfHeight: number,
  margin = 1.08,
): number {
  return Math.max((2 * halfWidth) / aspect, 2 * halfHeight) * margin;
}

/** Linear blend between day (night = 0) and night (night = 1) values. */
export function dayNight(day: number, night: number, t: number): number {
  const k = Math.min(Math.max(t, 0), 1);
  return day + (night - day) * k;
}

/** x of the mullions between `panes` equal panes of a glazing `width` wide, centred on 0. */
export function mullionPositions(width: number, panes: number): number[] {
  const out: number[] = [];
  for (let k = 1; k < panes; k++) out.push(-width / 2 + (k * width) / panes);
  return out;
}

/**
 * Vertical field of view (radians) that shows a `needWidth × needHeight` rectangle at
 * `distance`. Narrow (portrait) screens crop the sides instead of zooming out without
 * limit: the shown height grows to at most `maxStretch × needHeight`.
 */
export function fitVerticalFov(
  needWidth: number,
  needHeight: number,
  distance: number,
  aspect: number,
  maxStretch = 1.45,
): number {
  const span = Math.max(needHeight, Math.min(needWidth / aspect, needHeight * maxStretch));
  return 2 * Math.atan(span / 2 / distance);
}

/** Ease-out cubic progress 0 → 1 of the intro "walk up to the window" after `time` s. */
export function introProgress(time: number, duration: number): number {
  const t = Math.min(Math.max(time / duration, 0), 1);
  return 1 - (1 - t) ** 3;
}

/**
 * Slow, non-repeating sway of the viewer's head (each axis within -1..1) used while
 * nobody moves the pointer, so the parallax keeps "breathing" on its own.
 */
export function idleSway(time: number): { x: number; y: number } {
  return {
    x: Math.sin(time * 0.21) * 0.55 + Math.sin(time * 0.077 + 1.3) * 0.25,
    y: Math.sin(time * 0.13 + 0.7) * 0.35,
  };
}
