import { Application, Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { coverScale, parallaxCoverScale } from '../../utils/cover';
import type { SceneView } from '../views';
import { InputManager, MIN_ZOOM } from './InputManager';
import { attachSceneAnimations } from './SceneAnimations';

/** Background shown behind the picture (and while it loads). */
const SKY_COLOR = 0x87ceeb;

/** Canonical SVG scene dimensions used across all layers and animations. */
const SCENE_WIDTH = 1920;
const SCENE_HEIGHT = 1080;

/** SVG is rasterized at this multiple of its size, so it stays sharp on big / HiDPI screens. */
const SVG_RESOLUTION = 2;

/** Maximum horizontal and vertical parallax travel (in screen pixels) for a `depth = 1` layer. */
const MAX_OFFSET_X = 72;
const MAX_OFFSET_Y = 38;

export interface WindowStageHandle {
  (): void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

interface LoadedLayer {
  container: Container;
  depth: number;
  baseScale: number;
}

/** Loads a single SVG path as a texture, or returns null when the file is missing/broken. */
async function loadTexture(relativePath: string): Promise<Texture | null> {
  try {
    return await Assets.load<Texture>({
      src: import.meta.env.BASE_URL + relativePath,
      data: { resolution: SVG_RESOLUTION },
    });
  } catch (error) {
    console.warn(`Missing scene image "${relativePath}", showing a placeholder.`, error);
    return null;
  }
}

/** Simple placeholder picture: sky and grass. */
function createPlaceholder(): Graphics {
  return new Graphics()
    .rect(0, 0, SCENE_WIDTH, SCENE_HEIGHT)
    .fill(SKY_COLOR)
    .rect(0, 700, SCENE_WIDTH, 380)
    .fill(0x6fae5a);
}

/**
 * Mounts a full-size PixiJS canvas into `host` showing the multi-layer 2D scene with parallax,
 * zoom, and live animations. Returns a cleanup function (with zoom helper methods).
 */
export function mountWindowStage(host: HTMLElement, scene: SceneView): WindowStageHandle {
  const app = new Application();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const input = new InputManager(host, reducedMotion);
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

    const textures = await Promise.all(scene.layers.map((layer) => loadTexture(layer.image)));
    if (disposed) return;

    // Multi-layer 2D parallax when all layer files loaded cleanly
    if (textures.length > 0 && textures.every((t): t is Texture => t !== null)) {
      const layers: LoadedLayer[] = textures.map((texture, index) => {
        const container = new Container();
        const sprite = new Sprite(texture);
        sprite.width = SCENE_WIDTH;
        sprite.height = SCENE_HEIGHT;
        container.addChild(sprite);
        app.stage.addChild(container);
        return {
          container,
          depth: scene.layers[index].depth,
          baseScale: 1,
        };
      });

      const updateAnimations = attachSceneAnimations(
        scene.id,
        layers.map((l) => l.container),
      );

      const fitToScreen = (): void => {
        const { width, height } = app.screen;
        const uniformScale =
          parallaxCoverScale(
            SCENE_WIDTH,
            SCENE_HEIGHT,
            width,
            height,
            MAX_OFFSET_X,
            MAX_OFFSET_Y,
          ) / MIN_ZOOM;
        for (const layer of layers) {
          layer.baseScale = uniformScale;
        }
      };

      fitToScreen();
      app.renderer.on('resize', fitToScreen);

      app.ticker.add((ticker) => {
        const dt = ticker.deltaMS / 1000;
        const viewer = input.update(dt);
        if (!reducedMotion) {
          updateAnimations(dt);
        }
        const { width, height } = app.screen;

        for (const layer of layers) {
          const scale = layer.baseScale * viewer.zoom;
          layer.container.scale.set(scale);
          const centeredX = (width - SCENE_WIDTH * scale) / 2;
          const centeredY = (height - SCENE_HEIGHT * scale) / 2;
          layer.container.position.set(
            centeredX - viewer.x * MAX_OFFSET_X * layer.depth * viewer.zoom,
            centeredY - viewer.y * MAX_OFFSET_Y * layer.depth * viewer.zoom,
          );
        }
      });
      return;
    }

    // Fallback to flat single SVG picture or placeholder
    const fallbackTexture = await loadTexture(scene.image);
    if (disposed) return;
    const picture = fallbackTexture ? new Sprite(fallbackTexture) : createPlaceholder();
    app.stage.addChild(picture);

    const imageWidth = picture.width;
    const imageHeight = picture.height;
    let baseScale = 1;
    const fitToScreen = (): void => {
      const { width, height } = app.screen;
      baseScale = coverScale(imageWidth, imageHeight, width, height) / MIN_ZOOM;
    };
    fitToScreen();
    app.renderer.on('resize', fitToScreen);

    app.ticker.add((ticker) => {
      const viewer = input.update(ticker.deltaMS / 1000);
      const { width, height } = app.screen;
      const scale = baseScale * viewer.zoom;
      picture.scale.set(scale);
      picture.position.set((width - imageWidth * scale) / 2, (height - imageHeight * scale) / 2);
    });
  }

  void start();

  const cleanup = () => {
    disposed = true;
    input.destroy();
    if (ready) {
      app.destroy(true, { children: true });
    }
  };

  return Object.assign(cleanup, {
    zoomIn: () => input.zoomBy(0.2),
    zoomOut: () => input.zoomBy(-0.2),
    resetZoom: () => input.resetZoom(),
  });
}
