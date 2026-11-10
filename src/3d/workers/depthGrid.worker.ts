/// <reference lib="webworker" />
// Builds the relief's layers off the main thread. The expensive part – averaging a
// multi-megapixel depth map down to 257×257 – runs once per photo and is cached; moving the
// "smoothing" slider only re-runs blur + background inpainting, so the 3D view never stutters.

import { downsampleDepth } from '../utils/depthGrid';
import { buildReliefLayers } from '../utils/reliefLayers';
import type { DepthGridRequest, DepthGridResponse } from './depthGridProtocol';

declare const self: DedicatedWorkerGlobalScope;

let base: Float32Array | null = null;
let colors: Uint8ClampedArray | null = null;
let size = 0;

function post(msg: DepthGridResponse, transfer: Transferable[] = []): void {
  self.postMessage(msg, transfer);
}

self.onmessage = (e: MessageEvent<DepthGridRequest>) => {
  const msg = e.data;
  if (msg.type === 'source') {
    size = msg.segments + 1;
    colors = msg.colors;
    base = downsampleDepth(msg.depth, msg.width, msg.height, size, size);
    return;
  }
  try {
    if (!base || !colors) throw new Error('Brak mapy głębi w workerze siatki');
    const layers = buildReliefLayers(base, size, msg.smoothing, colors);
    post({ type: 'layers', id: msg.id, ...layers }, [
      layers.grid.buffer,
      layers.bgDepth.buffer,
      layers.bgColors.buffer,
    ]);
  } catch (err) {
    post({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
  }
};
