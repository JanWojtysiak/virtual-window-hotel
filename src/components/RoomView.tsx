import { useEffect, useRef } from 'react';
import { mountWindowStage } from '../2d/engine/WindowStage';
import { sceneFromParam } from '../2d/views';
import { sectionHref } from '../navigation';

export function RoomView() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = sceneFromParam(new URLSearchParams(window.location.search).get('room'));
    return mountWindowStage(host, scene);
  }, []);

  return (
    <div className="fixed inset-0 bg-bg-deep">
      {/* Preflight already renders the PixiJS canvas as `display: block`. */}
      <div ref={hostRef} className="absolute inset-0 overflow-hidden" />
      <a
        className="absolute top-4 left-4 rounded-full bg-[rgb(6_9_18/0.6)] px-[18px] py-2.5 text-[0.9rem] font-semibold text-text backdrop-blur-sm hover:bg-[rgb(6_9_18/0.85)] focus-visible:bg-[rgb(6_9_18/0.85)]"
        href={`${import.meta.env.BASE_URL}${sectionHref('rooms-2d')}`}
      >
        ← Wróć
      </a>
    </div>
  );
}
