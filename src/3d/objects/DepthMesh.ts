import * as THREE from 'three';
import { createPhotoRelief, type DepthMeshSource } from './PhotoRelief';

export type { DepthMeshSource } from './PhotoRelief';

export interface DepthMeshOptions {
  /** How far (in plane heights) the nearest point sticks out. */
  depthScale: number;
  /** Blur radius in grid cells applied to the depth before displacing. */
  smoothing: number;
  /**
   * Max surface slope (dz / dxy) before a triangle counts as "stretched" across a depth
   * jump and is discarded. 1 = 45°, 3 ≈ 72°. Use a huge value (e.g. 1e9) to keep every triangle.
   */
  edgeThreshold: number;
  /** Debug: paint discarded triangles red instead of removing them. */
  showEdges: boolean;
  /** True while new layers are computed in the worker (e.g. after moving a slider). */
  onLayersPending?(pending: boolean): void;
  /** Called when the WebGL context is lost (false) or restored (true). */
  onContextChange?(ok: boolean): void;
}

/** Thrown when the browser cannot create a WebGL context. */
export class WebGLUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('WebGL jest niedostępny w tej przeglądarce lub na tym urządzeniu');
    this.name = 'WebGLUnavailableError';
    this.cause = cause;
  }
}

export interface DepthMeshHandle {
  setDepthScale(value: number): void;
  setSmoothing(value: number): void;
  setEdgeThreshold(value: number): void;
  setShowEdges(value: boolean): void;
  dispose(): void;
}

export function createRenderer(params: THREE.WebGLRendererParameters = {}): THREE.WebGLRenderer {
  try {
    return new THREE.WebGLRenderer({ antialias: true, alpha: true, ...params });
  } catch (err) {
    throw new WebGLUnavailableError(err);
  }
}

/**
 * Shows a photo as a bas-relief (see createPhotoRelief). Moving the mouse over `host`
 * moves the camera on a small arc. Returns a handle to tweak or dispose the view.
 */
export function mountDepthMesh(
  host: HTMLElement,
  source: DepthMeshSource,
  options: DepthMeshOptions,
): DepthMeshHandle {
  const renderer = createRenderer();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);

  const relief = createPhotoRelief(source, {
    ...options,
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
  });
  const aspect = relief.aspect;
  scene.add(relief.object);

  // --- WebGL context loss (GPU reset, too many contexts, mobile tab in background). ---
  const canvas = renderer.domElement;
  const onContextLost = (e: Event): void => {
    e.preventDefault(); // lets the browser restore the context later
    options.onContextChange?.(false);
  };
  const onContextRestored = (): void => {
    // Three.js re-creates its GL state; textures must be uploaded again.
    relief.reupload();
    options.onContextChange?.(true);
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  // --- Camera: distance that fits the whole plane, mouse moves it on a small arc. ---
  let distance = 2;
  const MAX_ANGLE = 0.35; // radians at the edge of the canvas
  const target = new THREE.Vector2(0, 0);
  const current = new THREE.Vector2(0, 0);

  const resize = (): void => {
    const w = Math.max(host.clientWidth, 1);
    const h = Math.max(host.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const fitHeight = 0.5 / Math.tan(vFov / 2);
    const fitWidth = aspect / 2 / (Math.tan(vFov / 2) * camera.aspect);
    distance = Math.max(fitHeight, fitWidth) * 1.12;
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  const onPointerMove = (e: PointerEvent): void => {
    const rect = host.getBoundingClientRect();
    target.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      ((e.clientY - rect.top) / rect.height) * 2 - 1,
    );
  };
  const onPointerLeave = (): void => {
    target.set(0, 0);
  };
  host.addEventListener('pointermove', onPointerMove);
  host.addEventListener('pointerleave', onPointerLeave);

  renderer.setAnimationLoop(() => {
    current.lerp(target, 0.08);
    const yaw = current.x * MAX_ANGLE;
    const pitch = current.y * MAX_ANGLE * 0.7;
    camera.position.set(
      distance * Math.sin(yaw) * Math.cos(pitch),
      distance * Math.sin(pitch),
      distance * Math.cos(yaw) * Math.cos(pitch),
    );
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  });

  return {
    setDepthScale: relief.setDepthScale,
    setSmoothing: relief.setSmoothing,
    setEdgeThreshold: relief.setEdgeThreshold,
    setShowEdges: relief.setShowEdges,
    dispose() {
      renderer.setAnimationLoop(null);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      resizeObserver.disconnect();
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      relief.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
