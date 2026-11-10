import { useEffect, useRef, useState } from 'react';
import { mountWindowView, type DepthMeshSource, type WindowViewHandle } from '../3d';

interface WindowView3DProps {
  source: DepthMeshSource;
  depthScale: number;
  smoothing: number;
}

/**
 * React wrapper around the 3D window (src/3d/rooms/WindowView.ts): the photo is the view
 * outside, with a wall recess, frame, sill, dirty glass, rain drops and a cloth curtain.
 */
export function WindowView3D({ source, depthScale, smoothing }: WindowView3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<WindowViewHandle | null>(null);
  const [rain, setRain] = useState(0.5);
  const [wind, setWind] = useState(0.3);
  const [night, setNight] = useState(0);
  const initial = useRef({ depthScale, smoothing, rain, wind, night });
  const [layersPending, setLayersPending] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    initial.current = { depthScale, smoothing, rain, wind, night };
  }, [depthScale, smoothing, rain, wind, night]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const handle = mountWindowView(host, source, {
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

  useEffect(() => handleRef.current?.setDepthScale(depthScale), [depthScale]);
  useEffect(() => handleRef.current?.setSmoothing(smoothing), [smoothing]);
  useEffect(() => handleRef.current?.setRain(rain), [rain]);
  useEffect(() => handleRef.current?.setWind(wind), [wind]);
  useEffect(() => handleRef.current?.setNight(night), [night]);

  const sliders = [
    ['Deszcz', rain, setRain],
    ['Wiatr', wind, setWind],
    ['Noc', night, setNight],
  ] as const;

  return (
    <>
      <div className="relative aspect-video max-h-[75vh] w-full overflow-hidden rounded-lg border border-border bg-bg-deep">
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
            Karta graficzna zresetowała kontekst WebGL – czekam na przywrócenie widoku 3D…
          </div>
        )}
      </div>
      <div className="mt-4 grid max-w-3xl grid-cols-3 gap-6 mobile:grid-cols-1">
        {sliders.map(([label, value, set]) => (
          <label key={label} className="text-[0.85rem] text-text-soft">
            {label}: {Math.round(value * 100)}%
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={value}
              onChange={(e) => set(Number(e.target.value))}
              className="mt-2 block w-full accent-accent"
            />
          </label>
        ))}
      </div>
    </>
  );
}
