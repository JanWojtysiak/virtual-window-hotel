import { describe, expect, it } from 'vitest';
import { DepthAbortedError, DepthEstimator, type WorkerLike } from './depthEstimator';
import type { DepthRequest, DepthResponse } from './depthProtocol';
import { overallProgress } from './depthProtocol';

/** Fake worker: records requests, lets the test push responses or crash it. */
class FakeWorker implements WorkerLike {
  sent: DepthRequest[] = [];
  terminated = false;
  onmessage: ((e: MessageEvent<DepthResponse>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: ((e: MessageEvent) => void) | null = null;

  postMessage(message: DepthRequest): void {
    this.sent.push(message);
  }
  terminate(): void {
    this.terminated = true;
  }
  reply(msg: DepthResponse): void {
    this.onmessage?.({ data: msg } as MessageEvent<DepthResponse>);
  }
  crash(message: string): void {
    this.onerror?.({ message, preventDefault() {} } as ErrorEvent);
  }
}

function setup() {
  const workers: FakeWorker[] = [];
  const estimator = new DepthEstimator(() => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  });
  return { estimator, workers };
}

const bitmap = {} as ImageBitmap;

describe('DepthEstimator', () => {
  it('resolves with the worker result and remembers the backend', async () => {
    const { estimator, workers } = setup();
    const promise = estimator.estimate(bitmap);
    const req = workers[0].sent[0];
    expect(req.type).toBe('estimate');
    workers[0].reply({
      type: 'result',
      id: req.id,
      depth: new Float32Array(4),
      width: 2,
      height: 2,
      png: new Blob(),
      backend: 'wasm',
      fallbackReason: 'no WebGPU',
      inferenceMs: 12,
    });
    const result = await promise;
    expect(result.backend).toBe('wasm');
    expect(result.fallbackReason).toBe('no WebGPU');
    expect(estimator.backend).toBe('wasm');
    expect(estimator.busy).toBe(false);
  });

  it('forwards progress as one overall value', async () => {
    const { estimator, workers } = setup();
    const seen: number[] = [];
    const promise = estimator.load({ onProgress: (p) => seen.push(p.overall) });
    const { id } = workers[0].sent[0];
    workers[0].reply({ type: 'progress', id, stage: 'download', progress: 0.5 });
    workers[0].reply({ type: 'progress', id, stage: 'init', progress: 1 });
    workers[0].reply({ type: 'loaded', id, backend: 'webgpu' });
    await expect(promise).resolves.toEqual({ backend: 'webgpu', fallbackReason: undefined });
    expect(seen).toEqual([overallProgress('download', 0.5), overallProgress('init', 1)]);
  });

  it('rejects with the worker error message', async () => {
    const { estimator, workers } = setup();
    const promise = estimator.load();
    workers[0].reply({ type: 'error', id: workers[0].sent[0].id, message: 'boom' });
    await expect(promise).rejects.toThrow('boom');
  });

  it('rejects pending requests when the worker crashes and respawns it next time', async () => {
    const { estimator, workers } = setup();
    const promise = estimator.load();
    workers[0].crash('out of memory');
    await expect(promise).rejects.toThrow(/out of memory/);
    expect(workers[0].terminated).toBe(true);

    void estimator.load().catch(() => {});
    expect(workers).toHaveLength(2);
  });

  it('abort() rejects with DepthAbortedError and ignores late responses', async () => {
    const { estimator, workers } = setup();
    const promise = estimator.estimate(bitmap);
    const { id } = workers[0].sent[0];
    estimator.abort();
    await expect(promise).rejects.toBeInstanceOf(DepthAbortedError);
    // A message that was already in flight must not throw or resolve anything.
    expect(() => workers[0].reply({ type: 'loaded', id, backend: 'wasm' })).not.toThrow();
  });

  it('reports a failure to create the worker as a rejected promise', async () => {
    const estimator = new DepthEstimator(() => {
      throw new Error('blocked by CSP');
    });
    await expect(estimator.load()).rejects.toThrow(/blocked by CSP/);
  });
});

describe('overallProgress', () => {
  it('is monotonic across stages', () => {
    const values = [
      overallProgress('download', 0),
      overallProgress('download', 1),
      overallProgress('init', 1),
      overallProgress('inference', 1),
      overallProgress('postprocess', 1),
    ];
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    expect(values.at(-1)).toBe(1);
  });

  it('clamps out-of-range and unknown progress', () => {
    expect(overallProgress('download', 2)).toBe(overallProgress('download', 1));
    expect(overallProgress('inference', null)).toBe(overallProgress('inference', 0));
  });
});
