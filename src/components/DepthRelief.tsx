import { useEffect, useRef } from 'react';
import { mountDepthMesh, type DepthMeshHandle, type DepthMeshSource } from '../3d';

interface DepthReliefProps {
  source: DepthMeshSource;
  depthScale: number;
  smoothing: number;
}

/** React wrapper around the Three.js bas-relief (src/3d/objects/DepthMesh.ts). */
export function DepthRelief({ source, depthScale, smoothing }: DepthReliefProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<DepthMeshHandle | null>(null);
  // Initial values for (re)mounting; later changes go through the handle.
  const initial = useRef({ depthScale, smoothing });

  useEffect(() => {
    initial.current = { depthScale, smoothing };
  }, [depthScale, smoothing]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const handle = mountDepthMesh(host, source, initial.current);
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

  return (
    <div
      ref={hostRef}
      className="w-full cursor-move touch-none overflow-hidden rounded-lg border border-border bg-bg-deep"
      style={{ aspectRatio: `${source.width} / ${source.height}`, maxHeight: '70vh' }}
    />
  );
}
