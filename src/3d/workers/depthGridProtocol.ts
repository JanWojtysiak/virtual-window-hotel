// Messages between DepthGridBuilder (main thread) and depthGrid.worker.ts. Types only.
import type { ReliefLayers } from '../utils/reliefLayers';

export type DepthGridRequest =
  | {
      type: 'source';
      /** Full-resolution nearness map (copied into the worker once per photo). */
      depth: Float32Array;
      width: number;
      height: number;
      segments: number;
      /** Photo colours sampled on the (segments + 1)² grid, RGBA. */
      colors: Uint8ClampedArray;
    }
  | { type: 'layers'; id: number; smoothing: number };

export type DepthGridResponse =
  ({ type: 'layers'; id: number } & ReliefLayers) | { type: 'error'; id: number; message: string };
