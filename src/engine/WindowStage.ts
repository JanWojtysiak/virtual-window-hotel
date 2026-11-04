import { Application } from 'pixi.js';

/** Placeholder sky color until the real scene layers exist. */
const SKY_COLOR = 0x87ceeb;

/**
 * Mounts a full-size PixiJS canvas into `host` and keeps it sized to the host.
 * Returns a cleanup function that tears the application down.
 */
export function mountWindowStage(host: HTMLElement): () => void {
  const app = new Application();
  let ready = false;
  let disposed = false;

  void app
    .init({ background: SKY_COLOR, resizeTo: host, antialias: true, autoDensity: true })
    .then(() => {
      // Cleanup may run before async init finishes (e.g. React StrictMode).
      if (disposed) {
        app.destroy(true);
        return;
      }
      ready = true;
      host.appendChild(app.canvas);
    });

  return () => {
    disposed = true;
    if (ready) {
      app.destroy(true, { children: true });
    }
  };
}
