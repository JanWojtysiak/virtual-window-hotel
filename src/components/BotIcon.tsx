const PIVOT = '[transform-box:view-box]';

/** Little VR bot mascot: bobs, blinks, waves and marches in place. */
export function BotIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`overflow-visible ${className ?? ''}`}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <ellipse
        className="origin-center [transform-box:fill-box] fill-black/35 motion-safe:animate-bot-shadow"
        cx="20"
        cy="37.6"
        rx="8.5"
        ry="1.35"
      />

      <g className={`${PIVOT} origin-center motion-safe:animate-bot-bob`}>
        <g className={`${PIVOT} origin-[20px_10px] motion-safe:animate-bot-antenna`}>
          <path d="M20 10.5 V5.2" stroke="#6fe3ff" strokeWidth="1.6" strokeLinecap="round" />
          <circle className="motion-safe:animate-bot-glow" cx="20" cy="4.2" r="2.15" fill="#6fe3ff" />
        </g>

        <rect x="11.5" y="24.6" width="17" height="9.4" rx="3.4" fill="#151c2e" stroke="currentColor" strokeWidth="1.7" />
        <path d="M11.5 28.2 H8.2" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        <g className={`${PIVOT} origin-[28.5px_28.2px] motion-safe:animate-bot-wave`}>
          <path d="M28.5 28.2 H33.4" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          <circle cx="34.6" cy="28.2" r="1.7" fill="currentColor" />
        </g>
        <circle className="motion-safe:animate-bot-glow" cx="20" cy="29.1" r="1.45" fill="currentColor" />

        <g className={`${PIVOT} origin-[16.4px_33.8px] motion-safe:animate-bot-step-left`}>
          <path d="M16.4 33.8 V37.4" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" />
        </g>
        <g className={`${PIVOT} origin-[23.6px_33.8px] motion-safe:animate-bot-step-right`}>
          <path d="M23.6 33.8 V37.4" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" />
        </g>

        <rect x="9.4" y="9.6" width="21.2" height="16.4" rx="7.2" fill="#1b2438" stroke="currentColor" strokeWidth="1.7" />
        <rect x="12" y="14.1" width="16" height="7.2" rx="3.6" fill="#070a13" />
        <g className={`${PIVOT} origin-[20px_17.7px] motion-safe:animate-bot-blink`}>
          <rect className="motion-safe:animate-bot-glow" x="14.1" y="16" width="4.4" height="3.4" rx="1.7" fill="#6fe3ff" />
          <rect className="motion-safe:animate-bot-glow" x="21.5" y="16" width="4.4" height="3.4" rx="1.7" fill="#6fe3ff" />
        </g>
      </g>
    </svg>
  );
}
