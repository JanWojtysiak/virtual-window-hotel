import { useCallback, useEffect, useRef, useState, type TransitionEvent } from 'react';
import type { RoomPreview } from '../../scenes/rooms';
import { rotate } from '../../utils/array';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { RoomCard } from './RoomCard';
import styles from './RoomCarousel.module.css';

/** Delay between automatic slides. Keep in sync with `--auto-advance` in the CSS module. */
const AUTO_ADVANCE_MS = 4500;

/**
 * Narrow or short viewports (phones, zoomed-in desktop) show one room at a time and slide
 * vertically. Keep in sync with the vertical-mode media query in the CSS module.
 */
const VERTICAL_QUERY = '(max-width: 820px), (max-height: 600px)';

/** Distance between the starts of two neighbouring slides along the sliding axis. */
function measureStep(track: HTMLElement | null, vertical: boolean): number {
  const first = track?.firstElementChild;
  if (!track || !first) return 0;
  const style = getComputedStyle(track);
  const rect = first.getBoundingClientRect();
  return vertical
    ? rect.height + (parseFloat(style.rowGap) || 0)
    : rect.width + (parseFloat(style.columnGap) || 0);
}

/**
 * Infinite carousel: slides one card to the left (or up in vertical mode), then moves the first room to the end
 * of the list and resets the offset without a transition, so the loop is seamless.
 */
export function RoomCarousel({ rooms }: { rooms: readonly RoomPreview[] }) {
  const [order, setOrder] = useState(() => [...rooms]);
  const [offset, setOffset] = useState(0);
  const [animated, setAnimated] = useState(false);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLUListElement>(null);
  const busyRef = useRef(false);
  const reducedMotion = usePrefersReducedMotion();
  const vertical = useMediaQuery(VERTICAL_QUERY);

  const next = useCallback(() => {
    if (busyRef.current) return;
    const step = measureStep(trackRef.current, vertical);
    if (reducedMotion || step <= 0) {
      setOrder((current) => rotate(current, 1));
      return;
    }
    busyRef.current = true;
    setAnimated(true);
    setOffset(-step);
  }, [reducedMotion, vertical]);

  const previous = () => {
    if (busyRef.current) return;
    const step = measureStep(trackRef.current, vertical);
    setOrder((current) => rotate(current, -1));
    if (reducedMotion || step <= 0) return;
    // Place the new first card off-screen, then animate it in on the next frame.
    busyRef.current = true;
    setAnimated(false);
    setOffset(-step);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimated(true);
        setOffset(0);
      }),
    );
  };

  const handleTransitionEnd = (event: TransitionEvent<HTMLUListElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
    setAnimated(false);
    if (offset !== 0) {
      setOrder((current) => rotate(current, 1));
      setOffset(0);
    }
    busyRef.current = false;
  };

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setTimeout(next, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [order, paused, reducedMotion, next]);

  return (
    <section
      id="pokoje"
      className={styles.section}
      aria-roledescription="karuzela"
      aria-label="Pokoje z widokiem"
    >
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Pokoje z widokiem</p>
          <h1 className={styles.heading}>Wybierz swoje okno</h1>
        </div>
        {/* Hovering the arrows holds the current room; the timer runs again on leave. */}
        <div
          className={styles.controls}
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
        >
          <button
            type="button"
            className={styles.arrow}
            onClick={previous}
            aria-label="Poprzedni pokój"
          >
            <ArrowIcon direction={vertical ? 'up' : 'left'} />
          </button>
          <button type="button" className={styles.arrow} onClick={next} aria-label="Następny pokój">
            <ArrowIcon direction={vertical ? 'down' : 'right'} />
          </button>
        </div>
      </div>

      <div className={styles.viewport}>
        <ul
          ref={trackRef}
          className={styles.track}
          style={{
            transform: vertical ? `translateY(${offset}px)` : `translateX(${offset}px)`,
            transition: animated ? undefined : 'none',
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {order.map((room) => (
            <li key={room.id} className={styles.slide}>
              <RoomCard room={room} />
            </li>
          ))}
        </ul>
      </div>

      {!reducedMotion && (
        <div className={styles.progress} aria-hidden="true">
          <span
            key={`${order[0]?.id}-${paused}`}
            className={paused ? styles.paused : styles.running}
          />
        </div>
      )}
    </section>
  );
}

const ARROW_PATHS = {
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  up: 'M5 15l7-7 7 7',
  down: 'M5 9l7 7 7-7',
} as const;

function ArrowIcon({ direction }: { direction: keyof typeof ARROW_PATHS }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path
        d={ARROW_PATHS[direction]}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
