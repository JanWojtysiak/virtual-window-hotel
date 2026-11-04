/** Four-pane window logo mark. */
export function WindowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="26" height="26" rx="3" stroke="currentColor" strokeWidth="2.5" />
      <path d="M16 3v26M3 16h26" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}
