// Main-thread client for depth.worker.ts. Owns the worker, matches responses to requests,
// turns worker crashes into rejected promises and respawns the worker on the next call.
// The worker factory is injectable, so the logic is testable in Vitest without a browser.

import {
  type DepthBackend,
  type DepthBackendPreference,
  type DepthRequest,
  type DepthResponse,
  type DepthResultPayload,
  type DepthStage,
  overallProgress,
} from './depthProtocol';

/** The subset of `Worker` we use (lets tests pass a fake). */
export interface WorkerLike {
  postMessage(message: DepthRequest, transfer: Transferable[]): void;
  terminate(): void;
  onmessage: ((e: MessageEvent<DepthResponse>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  onmessageerror: ((e: MessageEvent) => void) | null;
}

export interface DepthProgress {
  /** 0..1 for the whole operation (one progress bar). */
  overall: number;
  stage: DepthStage;
  backend?: DepthBackend;
  loadedBytes?: number;
  totalBytes?: number;
}

export interface DepthRunOptions {
  backend?: DepthBackendPreference;
  onProgress?: (p: DepthProgress) => void;
}

export interface DepthLoadResult {
  backend: DepthBackend;
  fallbackReason?: string;
}

/** Rejection reason when the user cancels (lets the UI stay quiet instead of showing an error). */
export class DepthAbortedError extends Error {
  constructor() {
    super('Przerwano');
    this.name = 'DepthAbortedError';
  }
}

interface Pending {
  resolve(value: unknown): void;
  reject(err: Error): void;
  onProgress?: (p: DepthProgress) => void;
}

export class DepthEstimator {
  private worker: WorkerLike | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private loadedBackend: DepthBackend | null = null;

  private readonly createWorker: () => WorkerLike;

  constructor(createWorker: () => WorkerLike) {
    this.createWorker = createWorker;
  }

  /** Backend of the session currently loaded in the worker (null before the first load). */
  get backend(): DepthBackend | null {
    return this.loadedBackend;
  }

  get busy(): boolean {
    return this.pending.size > 0;
  }

  /** Downloads the model and creates the session without running it. */
  load(options: DepthRunOptions = {}): Promise<DepthLoadResult> {
    return this.request<DepthLoadResult>(
      (id) => ({ type: 'load', id, backend: options.backend ?? 'auto' }),
      [],
      options.onProgress,
    );
  }

  /** Estimates depth for a decoded photo. The bitmap is transferred (unusable afterwards). */
  estimate(bitmap: ImageBitmap, options: DepthRunOptions = {}): Promise<DepthResultPayload> {
    return this.request<DepthResultPayload>(
      (id) => ({ type: 'estimate', id, backend: options.backend ?? 'auto', bitmap }),
      [bitmap],
      options.onProgress,
    );
  }

  /** Stops whatever runs now. The only way to interrupt ONNX Runtime is to kill the worker. */
  abort(): void {
    this.killWorker(new DepthAbortedError());
  }

  dispose(): void {
    this.abort();
  }

  private request<T>(
    build: (id: number) => DepthRequest,
    transfer: Transferable[],
    onProgress?: (p: DepthProgress) => void,
  ): Promise<T> {
    let worker: WorkerLike;
    try {
      worker = this.ensureWorker();
    } catch (err) {
      return Promise.reject(
        new Error(
          `Nie udało się uruchomić Web Workera: ${err instanceof Error ? err.message : err}`,
        ),
      );
    }
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
      try {
        worker.postMessage(build(id), transfer);
      } catch (err) {
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = (e) => this.handleMessage(e.data);
    worker.onerror = (e) => {
      // Uncaught error or crash (e.g. out of memory) – the worker state is unknown, restart it.
      e.preventDefault?.();
      this.killWorker(new Error(`Błąd Web Workera: ${e.message || 'nieznany (brak pamięci?)'}`));
    };
    worker.onmessageerror = () => {
      this.killWorker(new Error('Web Worker zwrócił nieczytelną wiadomość'));
    };
    this.worker = worker;
    return worker;
  }

  private killWorker(reason: Error): void {
    this.worker?.terminate();
    this.worker = null;
    this.loadedBackend = null;
    const all = [...this.pending.values()];
    this.pending.clear();
    for (const p of all) p.reject(reason);
  }

  private handleMessage(msg: DepthResponse): void {
    const p = this.pending.get(msg.id);
    if (!p) return; // response for an aborted request
    switch (msg.type) {
      case 'progress':
        p.onProgress?.({
          overall: overallProgress(msg.stage, msg.progress),
          stage: msg.stage,
          backend: msg.backend,
          loadedBytes: msg.loadedBytes,
          totalBytes: msg.totalBytes,
        });
        break;
      case 'loaded':
        this.pending.delete(msg.id);
        this.loadedBackend = msg.backend;
        p.resolve({ backend: msg.backend, fallbackReason: msg.fallbackReason });
        break;
      case 'result': {
        this.pending.delete(msg.id);
        this.loadedBackend = msg.backend;
        const payload: DepthResultPayload = {
          depth: msg.depth,
          width: msg.width,
          height: msg.height,
          png: msg.png,
          backend: msg.backend,
          fallbackReason: msg.fallbackReason,
          inferenceMs: msg.inferenceMs,
        };
        p.resolve(payload);
        break;
      }
      case 'error':
        this.pending.delete(msg.id);
        p.reject(new Error(msg.message));
        break;
    }
  }
}

let shared: DepthEstimator | null = null;

/** App-wide estimator backed by the real Vite worker (model stays loaded between photos). */
export function getDepthEstimator(): DepthEstimator {
  shared ??= new DepthEstimator(
    () =>
      new Worker(new URL('./depth.worker.ts', import.meta.url), {
        type: 'module',
        name: 'depth-anything',
      }) as unknown as WorkerLike,
  );
  return shared;
}
