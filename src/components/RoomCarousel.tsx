import { useCallback, useEffect, useRef, useState, type TransitionEvent } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import type { RoomPreview } from '../scenes/rooms';
import { rotate } from '../utils/array';
import { RoomCard } from './RoomCard';

/** Delay between automatic slides; also drives the progress bar animation. */
const AUTO_ADVANCE_MS = 4500;

/**
 * Narrow or short viewports (phones, zoomed-in desktop) show one room at a time and slide
 * vertically. Keep in sync with the `vertical` variant in style.css.
 */
const VERTICAL_QUERY = '(max-width: 820px), (max-height: 600px)';

const SECTION_CLASSES = [
  '[--gap:28px] [--visible:3] px-(--page-gutter) pt-16 pb-18 max-[1100px]:[--visible:2]',
  // Vertical mode: a gap bigger than the viewport's vertical padding, so the next card never peeks in.
  'vertical:[--gap:64px] vertical:[--shadow-room:24px] vertical:pt-10 vertical:pb-14',
  // Fill the width, but never get taller than what is left of the screen below the header.
  'vertical:[--slide-height:clamp(300px,min((100vw_-_2*var(--page-gutter))*1.25,100svh_-_var(--navbar-height)_-_260px),720px)]',
  // Wider than tall, but not edge to edge on wide and short (zoomed-in) screens.
  'vertical:[--card-width:min(100vw_-_2*var(--page-gutter),var(--slide-height)*1.5)]',
  // Short screens (zoomed-in desktop, landscape phones): the heading is dropped to give the card room.
  'short:[--slide-height:clamp(240px,100svh_-_var(--navbar-height)_-_140px,720px)] short:pt-6 short:pb-6',
].join(' ');

const SLIDE_CLASSES = [
  'min-w-0 shrink-0 basis-[calc((100%_-_(var(--visible)_-_1)_*_var(--gap))_/_var(--visible))]',
  'animate-rise motion-reduce:animate-none',
  'vertical:w-[min(100%,var(--card-width))] vertical:basis-(--slide-height) vertical:self-center',
  'vertical:*:aspect-auto vertical:*:h-full',
].join(' ');

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
      className={SECTION_CLASSES}
      aria-roledescription="karuzela"
      aria-label="Pokoje z widokiem"
    >
      <div className="mb-9 flex items-end justify-between gap-6 vertical:mx-auto vertical:mb-6 vertical:max-w-(--card-width) short:mb-3 short:justify-end">
        {/* Visually hidden on short screens, but still announced by screen readers. */}
        <div className="short:sr-only">
          <p className="mb-2.5 text-[0.85rem] font-bold tracking-[0.2em] text-accent uppercase">
            Pokoje z widokiem
          </p>
          <h1 className="font-serif text-[length:clamp(2.25rem,5vw,3.75rem)] leading-[1.05] font-medium text-text">
            Wybierz swoje okno
          </h1>
        </div>
        {/* Hovering the arrows holds the current room; the timer runs again on leave. */}
        <div
          className="flex gap-3 max-[640px]:hidden"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
        >
          <button
            type="button"
            className={ARROW_CLASSES}
            onClick={previous}
            aria-label="Poprzedni pokój"
          >
            <ArrowIcon direction={vertical ? 'up' : 'left'} />
          </button>
          <button
            type="button"
            className={ARROW_CLASSES}
            onClick={next}
            aria-label="Następny pokój"
          >
            <ArrowIcon direction={vertical ? 'down' : 'right'} />
          </button>
        </div>
      </div>

      {/* Bleeds to the screen edges so cards slide in from outside, with room for shadows. */}
      <div className="-mx-(--page-gutter) -my-6 overflow-hidden px-(--page-gutter) py-6 vertical:-my-(--shadow-room) vertical:h-[calc(var(--slide-height)_+_2*var(--shadow-room))] vertical:py-(--shadow-room)">
        <ul
          ref={trackRef}
          className="flex gap-(--gap) transition-transform duration-900 ease-slide will-change-transform vertical:flex-col"
          style={{
            transform: vertical ? `translateY(${offset}px)` : `translateX(${offset}px)`,
            transition: animated ? undefined : 'none',
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {order.map((room, index) => (
            <li
              key={room.id}
              className={SLIDE_CLASSES}
              // Staggered entrance; in vertical mode only one card is visible, so it should not wait.
              style={{ animationDelay: vertical ? undefined : `${Math.min(index, 3) * 0.1}s` }}
            >
              <RoomCard room={room} />
            </li>
          ))}
        </ul>
      </div>

      {!reducedMotion && (
        <div
          className="mt-8 h-0.5 overflow-hidden rounded-xs bg-border vertical:mx-auto vertical:mt-6 vertical:max-w-(--card-width)"
          aria-hidden="true"
        >
          <span
            key={`${order[0]?.id}-${paused}`}
            className={`block h-full origin-left bg-accent ${paused ? 'scale-x-0' : 'animate-progress'}`}
            style={{ animationDuration: `${AUTO_ADVANCE_MS}ms` }}
          />
        </div>
      )}
    </section>
  );
}

const ARROW_CLASSES =
  'grid size-13 cursor-pointer place-items-center rounded-full border border-border-strong text-text transition-colors duration-200 hover:border-accent hover:bg-accent/8 hover:text-accent focus-visible:border-accent focus-visible:bg-accent/8 focus-visible:text-accent short:size-10';

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
