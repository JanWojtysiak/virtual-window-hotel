import { useEffect, useRef, useState } from 'react';
import { mountDepthMesh, type DepthMeshHandle, type DepthMeshSource } from '../3d';

interface DepthReliefProps {
  source: DepthMeshSource;
  depthScale: number;
  smoothing: number;
  edgeThreshold: number;
  showEdges: boolean;
}

/**
 * React wrapper around the Three.js bas-relief (src/3d/objects/DepthMesh.ts).
 * Errors from mounting (e.g. no WebGL) propagate to the nearest ErrorBoundary.
 */
export function DepthRelief({
  source,
  depthScale,
  smoothing,
  edgeThreshold,
  showEdges,
}: DepthReliefProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<DepthMeshHandle | null>(null);
  // Initial values for (re)mounting; later changes go through the handle.
  const initial = useRef({ depthScale, smoothing, edgeThreshold, showEdges });
  const [layersPending, setLayersPending] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    initial.current = { depthScale, smoothing, edgeThreshold, showEdges };
  }, [depthScale, smoothing, edgeThreshold, showEdges]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const handle = mountDepthMesh(host, source, {
      ...initial.current,
      onLayersPending: setLayersPending,
      onContextChange: (ok) => setContextLost(!ok),
    });
    handleRef.current = handle;
    return () => {
      handle.dispose();
      handleRef.current = null;
    };
  }, [source]);

  useEffect(() => {
    handleRef.current?.setDepthScale(depthScale);
  }, [depthScale]);

  useEffect(() => {
    handleRef.current?.setSmoothing(smoothing);
  }, [smoothing]);

  useEffect(() => {
    handleRef.current?.setEdgeThreshold(edgeThreshold);
  }, [edgeThreshold]);

  useEffect(() => {
    handleRef.current?.setShowEdges(showEdges);
  }, [showEdges]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-border bg-bg-deep"
      style={{ aspectRatio: `${source.width} / ${source.height}`, maxHeight: '70vh' }}
    >
      <div ref={hostRef} className="h-full w-full cursor-move touch-none" />
      {layersPending && (
        <span
          role="status"
          className="pointer-events-none absolute top-3 right-3 flex items-center gap-2 rounded-full bg-bg-deep/80 px-3 py-1 text-[0.75rem] text-text-soft backdrop-blur"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          Przeliczam siatkę 3D…
        </span>
      )}
      {contextLost && (
        <div
          role="alert"
          className="absolute inset-0 flex items-center justify-center bg-bg-deep/85 px-6 text-center text-[0.85rem] text-text-soft"
        >
          Karta graficzna zresetowała kontekst WebGL – czekam na przywrócenie podglądu 3D…
        </div>
      )}
    </div>
  );
}
