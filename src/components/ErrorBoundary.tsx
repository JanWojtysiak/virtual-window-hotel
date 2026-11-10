import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** What to show instead of the crashed subtree. `reset` re-mounts the children. */
  fallback: (error: Error, reset: () => void) => ReactNode;
  /** Changing this value clears the error (e.g. a new photo was loaded). */
  resetKey?: unknown;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey: unknown;
}

/**
 * Catches errors thrown while rendering or in effects of its children (e.g. WebGL
 * unavailable in the 3D preview), so one broken widget does not blank the whole page.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) return this.props.fallback(this.state.error, this.reset);
    return this.props.children;
  }
}

/** Default fallback card in the page's style. */
export function ErrorCard({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-500/30 bg-red-500/8 px-5 py-4 text-[0.9rem] text-red-300"
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-red-300/80">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 cursor-pointer rounded-md border border-red-400/40 px-4 py-1.5 text-[0.85rem] font-semibold transition-colors hover:bg-red-500/15"
        >
          Spróbuj ponownie
        </button>
      )}
    </div>
  );
}
