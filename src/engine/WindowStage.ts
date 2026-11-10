import { Application, Assets, Graphics, Sprite, Texture } from 'pixi.js';
import type { SceneView } from '../scenes/views';
import { coverScale } from '../utils/cover';

/** Background shown behind the picture (and while it loads). */
const SKY_COLOR = 0x87ceeb;

/** SVG is rasterized at this multiple of its size, so it stays sharp on big / HiDPI screens. */
const SVG_RESOLUTION = 2;

/** Loads the scene's SVG as a texture, or returns null when the file is missing/broken. */
async function loadSceneTexture(scene: SceneView): Promise<Texture | null> {
  try {
    return await Assets.load<Texture>({
      src: import.meta.env.BASE_URL + scene.image,
      data: { resolution: SVG_RESOLUTION },
    });
  } catch (error) {
    console.warn(`Missing scene image "${scene.image}", showing a placeholder.`, error);
    return null;
  }
}

/** Simple placeholder picture: sky and grass. */
function createPlaceholder(): Graphics {
  return new Graphics()
    .rect(0, 0, 1920, 1080)
    .fill(SKY_COLOR)
    .rect(0, 700, 1920, 380)
    .fill(0x6fae5a);
}

/**
 * Mounts a full-size PixiJS canvas into `host` showing the scene picture (flat, 2D).
 * Returns a cleanup function that tears the application down.
 */
export function mountWindowStage(host: HTMLElement, scene: SceneView): () => void {
  const app = new Application();
  let ready = false;
  let disposed = false;

  async function start(): Promise<void> {
    await app.init({ background: SKY_COLOR, resizeTo: host, antialias: true, autoDensity: true });
    // Cleanup may run before async init finishes (e.g. React StrictMode).
    if (disposed) {
      app.destroy(true);
      return;
    }
    ready = true;
    host.appendChild(app.canvas);

    const texture = await loadSceneTexture(scene);
    if (disposed) return;
    const picture = texture ? new Sprite(texture) : createPlaceholder();
    app.stage.addChild(picture);

    // Center the picture and scale it to cover the whole screen.
    const imageWidth = picture.width;
    const imageHeight = picture.height;
    const fitToScreen = (): void => {
      const { width, height } = app.screen;
      const scale = coverScale(imageWidth, imageHeight, width, height);
      picture.scale.set(scale);
      picture.position.set((width - picture.width) / 2, (height - picture.height) / 2);
    };
    fitToScreen();
    app.renderer.on('resize', fitToScreen);
  }

  void start();

  return () => {
    disposed = true;
    if (ready) {
      app.destroy(true, { children: true });
    }
  };
}
