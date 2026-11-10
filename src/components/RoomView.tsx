import { useEffect, useRef } from 'react';
import { mountWindowStage, type WindowStageHandle } from '../2d/engine/WindowStage';
import { sceneFromParam } from '../2d/views';

const ZOOM_BTN_CLASSES =
  'grid size-10 cursor-pointer place-items-center rounded-full bg-[rgb(6_9_18/0.6)] text-[1.1rem] font-bold text-text backdrop-blur-sm transition-colors hover:bg-[rgb(6_9_18/0.85)] hover:text-accent focus-visible:bg-[rgb(6_9_18/0.85)]';

export function RoomView() {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<WindowStageHandle | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = sceneFromParam(new URLSearchParams(window.location.search).get('room'));
    const handle = mountWindowStage(host, scene);
    stageRef.current = handle;
    return () => {
      stageRef.current = null;
      handle();
    };
  }, []);

  return (
    <div className="fixed inset-0 select-none bg-bg-deep">
      {/* Preflight already renders the PixiJS canvas as `display: block`. */}
      <div ref={hostRef} className="absolute inset-0 touch-none overflow-hidden" />
      <a
        className="absolute top-4 left-4 rounded-full bg-[rgb(6_9_18/0.6)] px-[18px] py-2.5 text-[0.9rem] font-semibold text-text backdrop-blur-sm hover:bg-[rgb(6_9_18/0.85)] focus-visible:bg-[rgb(6_9_18/0.85)]"
        href={import.meta.env.BASE_URL}
      >
        ← Wróć
      </a>

      <div
        className="absolute top-4 right-4 flex items-center gap-2"
        role="group"
        aria-label="Powiększanie widoku"
      >
        <button
          type="button"
          className={ZOOM_BTN_CLASSES}
          onClick={() => stageRef.current?.zoomOut()}
          aria-label="Oddal widok"
          title="Oddal (- / kółko myszy)"
        >
          −
        </button>
        <button
          type="button"
          className="cursor-pointer rounded-full bg-[rgb(6_9_18/0.6)] px-3.5 py-2 text-[0.82rem] font-semibold text-text backdrop-blur-sm transition-colors hover:bg-[rgb(6_9_18/0.85)] hover:text-accent focus-visible:bg-[rgb(6_9_18/0.85)]"
          onClick={() => stageRef.current?.resetZoom()}
          aria-label="Resetuj powiększenie"
          title="Resetuj widok (klawisz 0)"
        >
          1:1
        </button>
        <button
          type="button"
          className={ZOOM_BTN_CLASSES}
          onClick={() => stageRef.current?.zoomIn()}
          aria-label="Powiększ widok"
          title="Powiększ (+ / kółko myszy)"
        >
          +
        </button>
      </div>
    </div>
  );
}
