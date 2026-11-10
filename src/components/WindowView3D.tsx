import { useCallback, useEffect, useRef, useState } from 'react';
import { mountWindowView, type DepthMeshSource, type WindowViewHandle } from '../3d';

interface WindowView3DProps {
  source: DepthMeshSource;
  depthScale: number;
  smoothing: number;
}

/**
 * React wrapper around the 3D apartment window (src/3d/rooms/WindowView.ts): the photo is
 * the view outside a floor-to-ceiling glazing, with dirty glass, rain drops and cloth
 * curtains. Can be switched to an immersive full-screen "window".
 */
export function WindowView3D({ source, depthScale, smoothing }: WindowView3DProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<WindowViewHandle | null>(null);
  const [rain, setRain] = useState(0.5);
  const [wind, setWind] = useState(0.3);
  const [night, setNight] = useState(0);
  const initial = useRef({ depthScale, smoothing, rain, wind, night });
  const [layersPending, setLayersPending] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [immersive, setImmersive] = useState(false);

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

  // iPhone Safari has no element fullscreen – the fixed overlay alone covers the page there.
  const enterImmersive = useCallback(() => {
    setImmersive(true);
    shellRef.current?.requestFullscreen?.().catch(() => {});
  }, []);
  const exitImmersive = useCallback(() => {
    setImmersive(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    if (!immersive) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') exitImmersive();
    };
    const onFullscreenChange = (): void => {
      if (!document.fullscreenElement) setImmersive(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [immersive, exitImmersive]);

  const sliders = [
    ['Deszcz', rain, setRain],
    ['Wiatr', wind, setWind],
    ['Noc', night, setNight],
  ] as const;

  const controls = (
    <div
      className={
        immersive
          ? 'absolute right-4 bottom-4 left-4 mx-auto grid max-w-3xl grid-cols-3 gap-6 rounded-2xl bg-bg-deep/60 px-5 py-4 backdrop-blur-md mobile:grid-cols-1 mobile:gap-3'
          : 'mt-4 grid max-w-3xl grid-cols-3 gap-6 mobile:grid-cols-1'
      }
    >
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
  );

  return (
    <>
      <div
        ref={shellRef}
        className={
          immersive
            ? 'fixed inset-0 z-50 overflow-hidden bg-black'
            : 'relative h-[calc(100svh-var(--navbar-height)-2rem)] min-h-[420px] w-full scroll-mt-[calc(var(--navbar-height)+1rem)] overflow-hidden rounded-xl border border-border bg-black shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)]'
        }
      >
        <div ref={hostRef} className="h-full w-full cursor-move touch-none" />
        <button
          type="button"
          onClick={immersive ? exitImmersive : enterImmersive}
          className="absolute top-3 right-3 flex cursor-pointer items-center gap-2 rounded-full bg-bg-deep/70 px-4 py-2 text-[0.8rem] font-semibold text-text backdrop-blur transition-colors hover:bg-bg-deep/90 hover:text-accent"
        >
          {immersive ? <CollapseIcon /> : <ExpandIcon />}
          {immersive ? 'Zamknij (Esc)' : 'Pełny ekran'}
        </button>
        {layersPending && (
          <span
            role="status"
            className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-full bg-bg-deep/80 px-3 py-1 text-[0.75rem] text-text-soft backdrop-blur"
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
        {immersive && controls}
      </div>
      {!immersive && controls}
    </>
  );
}

function ExpandIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
    </svg>
  );
}
