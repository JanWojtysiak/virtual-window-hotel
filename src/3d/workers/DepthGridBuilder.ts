// Computes relief layers in depthGrid.worker.ts, keeping only the newest request
// ("latest wins" while a slider is dragged). If the worker cannot start or crashes,
// it falls back to computing on the main thread, so the 3D view always gets its layers.

import { downsampleDepth } from '../utils/depthGrid';
import { buildReliefLayers, type ReliefLayers } from '../utils/reliefLayers';
import type { DepthGridRequest, DepthGridResponse } from './depthGridProtocol';

export interface DepthGridSource {
  depth: Float32Array;
  width: number;
  height: number;
  /** Photo colours sampled on the (segments + 1)² grid, RGBA. */
  colors: Uint8ClampedArray;
}

/** The subset of `Worker` we use (lets tests pass a fake). */
export interface GridWorkerLike {
  postMessage(message: DepthGridRequest): void;
  terminate(): void;
  onmessage: ((e: MessageEvent<DepthGridResponse>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
}

export interface DepthGridBuilderOptions {
  segments: number;
  /** Called with the newest layers ((segments + 1)² cells, row 0 = top of the photo). */
  onLayers(layers: ReliefLayers): void;
  /** True while layers are being computed. */
  onPendingChange?(pending: boolean): void;
  /** Injectable for tests; returns null when workers are unavailable. */
  createWorker?: () => GridWorkerLike | null;
}

function defaultWorker(): GridWorkerLike | null {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./depthGrid.worker.ts', import.meta.url), {
    type: 'module',
    name: 'depth-grid',
  }) as unknown as GridWorkerLike;
}

export class DepthGridBuilder {
  private worker: GridWorkerLike | null = null;
  private latestId = 0;
  private latestSmoothing = 0;
  private pending = false;
  private disposed = false;
  /** Downsampled grid for the main-thread fallback (computed lazily, once). */
  private base: Float32Array | null = null;

  private readonly source: DepthGridSource;
  private readonly options: DepthGridBuilderOptions;

  constructor(source: DepthGridSource, options: DepthGridBuilderOptions) {
    this.source = source;
    this.options = options;
    try {
      this.worker = (options.createWorker ?? defaultWorker)();
    } catch (err) {
      console.warn('[DepthGridBuilder] worker unavailable, using main thread', err);
      this.worker = null;
    }
    if (!this.worker) return;

    this.worker.onmessage = (e) => this.handle(e.data);
    this.worker.onerror = (e) => {
      e.preventDefault?.();
      this.fallBack(new Error(e.message || 'worker crashed'));
    };
    // Not transferred: React keeps the map for re-mounts (StrictMode, toggling 2D/3D).
    this.worker.postMessage({
      type: 'source',
      depth: source.depth,
      width: source.width,
      height: source.height,
      segments: options.segments,
      colors: source.colors,
    });
  }

  /** Whether layers are computed in a worker (false = main-thread fallback). */
  get usesWorker(): boolean {
    return this.worker !== null;
  }

  request(smoothing: number): void {
    if (this.disposed) return;
    this.latestSmoothing = smoothing;
    const id = ++this.latestId;
    if (!this.worker) {
      this.computeOnMainThread();
      return;
    }
    this.setPending(true);
    this.worker.postMessage({ type: 'layers', id, smoothing });
  }

  dispose(): void {
    this.disposed = true;
    this.worker?.terminate();
    this.worker = null;
  }

  private handle(msg: DepthGridResponse): void {
    if (this.disposed || msg.id !== this.latestId) return; // superseded by a newer request
    if (msg.type === 'error') {
      this.fallBack(new Error(msg.message));
      return;
    }
    this.setPending(false);
    this.options.onLayers({ grid: msg.grid, bgDepth: msg.bgDepth, bgColors: msg.bgColors });
  }

  private fallBack(err: Error): void {
    console.warn('[DepthGridBuilder] worker failed, falling back to main thread:', err.message);
    this.worker?.terminate();
    this.worker = null;
    if (!this.disposed && this.latestId > 0) this.computeOnMainThread();
  }

  private computeOnMainThread(): void {
    const { depth, width, height, colors } = this.source;
    const size = this.options.segments + 1;
    this.base ??= downsampleDepth(depth, width, height, size, size);
    const layers = buildReliefLayers(this.base, size, this.latestSmoothing, colors);
    this.setPending(false);
    this.options.onLayers(layers);
  }

  private setPending(value: boolean): void {
    if (this.pending === value) return;
    this.pending = value;
    this.options.onPendingChange?.(value);
  }
}
