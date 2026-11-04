import { useCallback, useEffect, useRef, useState, type TransitionEvent } from 'react';
import type { RoomPreview } from '../../scenes/rooms';
import { rotate } from '../../utils/array';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { RoomCard } from './RoomCard';
import styles from './RoomCarousel.module.css';

/** Delay between automatic slides. Keep in sync with `--auto-advance` in the CSS module. */
const AUTO_ADVANCE_MS = 4500;

/**
 * Infinite carousel: slides one card to the left, then moves the first room to the end
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

  const measureStep = () => {
    const track = trackRef.current;
    const first = track?.firstElementChild;
    if (!track || !first) return 0;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return first.getBoundingClientRect().width + gap;
  };

  const next = useCallback(() => {
    if (busyRef.current) return;
    const step = measureStep();
    if (reducedMotion || step <= 0) {
      setOrder((current) => rotate(current, 1));
      return;
    }
    busyRef.current = true;
    setAnimated(true);
    setOffset(-step);
  }, [reducedMotion]);

  const previous = () => {
    if (busyRef.current) return;
    const step = measureStep();
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
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.arrow}
            onClick={previous}
            aria-label="Poprzedni pokój"
          >
            <ArrowIcon direction="left" />
          </button>
          <button type="button" className={styles.arrow} onClick={next} aria-label="Następny pokój">
            <ArrowIcon direction="right" />
          </button>
        </div>
      </div>

      <div
        className={styles.viewport}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <ul
          ref={trackRef}
          className={styles.track}
          style={{
            transform: `translateX(${offset}px)`,
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

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
