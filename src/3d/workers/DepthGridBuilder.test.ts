import { describe, expect, it } from 'vitest';
import { DepthGridBuilder, type GridWorkerLike } from './DepthGridBuilder';
import type { DepthGridRequest, DepthGridResponse } from './depthGridProtocol';
import type { ReliefLayers } from '../utils/reliefLayers';

class FakeGridWorker implements GridWorkerLike {
  sent: DepthGridRequest[] = [];
  terminated = false;
  onmessage: ((e: MessageEvent<DepthGridResponse>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage(message: DepthGridRequest): void {
    this.sent.push(message);
  }
  terminate(): void {
    this.terminated = true;
  }
  reply(msg: DepthGridResponse): void {
    this.onmessage?.({ data: msg } as MessageEvent<DepthGridResponse>);
  }
}

const SEGMENTS = 4;
const N = (SEGMENTS + 1) ** 2;
const source = {
  depth: new Float32Array(10 * 10).fill(0.5),
  width: 10,
  height: 10,
  colors: new Uint8ClampedArray(N * 4).fill(100),
};
const fakeLayers = (): ReliefLayers => ({
  grid: new Float32Array(N),
  bgDepth: new Float32Array(N),
  bgColors: new Uint8Array(N * 4),
});

describe('DepthGridBuilder', () => {
  it('sends the source once and applies only the newest result', () => {
    const worker = new FakeGridWorker();
    const got: ReliefLayers[] = [];
    const pending: boolean[] = [];
    const builder = new DepthGridBuilder(source, {
      segments: SEGMENTS,
      onLayers: (l) => got.push(l),
      onPendingChange: (p) => pending.push(p),
      createWorker: () => worker,
    });
    builder.request(1);
    builder.request(2);
    expect(worker.sent.map((m) => m.type)).toEqual(['source', 'layers', 'layers']);

    const [, first, second] = worker.sent as Extract<DepthGridRequest, { type: 'layers' }>[];
    worker.reply({ type: 'layers', id: first.id, ...fakeLayers() }); // stale → ignored
    expect(got).toHaveLength(0);
    worker.reply({ type: 'layers', id: second.id, ...fakeLayers() });
    expect(got).toHaveLength(1);
    expect(pending).toEqual([true, false]);
  });

  it('computes on the main thread when no worker is available', () => {
    const got: ReliefLayers[] = [];
    const builder = new DepthGridBuilder(source, {
      segments: SEGMENTS,
      onLayers: (l) => got.push(l),
      createWorker: () => null,
    });
    expect(builder.usesWorker).toBe(false);
    builder.request(0);
    expect(got).toHaveLength(1);
    expect(got[0].grid).toHaveLength(N);
    expect(got[0].grid[0]).toBeCloseTo(0.5);
  });

  it('falls back to the main thread when the worker crashes', () => {
    const worker = new FakeGridWorker();
    const got: ReliefLayers[] = [];
    const builder = new DepthGridBuilder(source, {
      segments: SEGMENTS,
      onLayers: (l) => got.push(l),
      createWorker: () => worker,
    });
    builder.request(1);
    worker.onerror?.({ message: 'crash', preventDefault() {} } as ErrorEvent);
    expect(worker.terminated).toBe(true);
    expect(builder.usesWorker).toBe(false);
    expect(got).toHaveLength(1);
  });

  it('ignores results after dispose', () => {
    const worker = new FakeGridWorker();
    const got: ReliefLayers[] = [];
    const builder = new DepthGridBuilder(source, {
      segments: SEGMENTS,
      onLayers: (l) => got.push(l),
      createWorker: () => worker,
    });
    builder.request(1);
    const id = (worker.sent[1] as { id: number }).id;
    builder.dispose();
    worker.reply({ type: 'layers', id, ...fakeLayers() });
    expect(got).toHaveLength(0);
    expect(worker.terminated).toBe(true);
  });
});
