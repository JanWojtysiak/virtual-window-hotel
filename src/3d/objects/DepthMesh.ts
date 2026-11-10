import * as THREE from 'three';
import type { ReliefLayers } from '../utils/reliefLayers';
import { DepthGridBuilder } from '../workers/DepthGridBuilder';

/** Plane resolution: SEGMENTS × SEGMENTS quads, (SEGMENTS + 1)² vertices. */
const SEGMENTS = 256;
const GRID = SEGMENTS + 1;

export interface DepthMeshSource {
  /** The original photo (used as the colour texture). */
  image: TexImageSource;
  /** Nearness map 0..1 (1 = close), `width × height`, row-major from the top. */
  depth: Float32Array;
  width: number;
  height: number;
}

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

/** Thrown by mountDepthMesh when the browser cannot create a WebGL context. */
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

// Shared by the front relief and the background layer: displaces the plane by a depth
// texture that has exactly one texel per vertex.
const vertexShader = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uDepthScale;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    vUv = uv;
    // Map uv 0..1 onto texel centres.
    vec2 tc = uv * (${SEGMENTS}.0 / ${GRID}.0) + 0.5 / ${GRID}.0;
    float d = texture2D(uDepth, tc).r;
    vDepth = d;
    vec3 displaced = position + vec3(0.0, 0.0, (d - 0.5) * uDepthScale);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const frontFragmentShader = /* glsl */ `
  uniform sampler2D uImage;
  uniform float uDepthScale;
  uniform float uAspect;
  uniform float uEdgeThreshold;
  uniform bool uShowEdges;
  varying vec2 vUv;
  varying float vDepth;

  // Gradient of the depth in uv space. Inside one triangle vDepth is linear in vUv, so the
  // screen-space derivatives give the exact, view-independent slope of that triangle:
  //   [dDepth/dx, dDepth/dy] = J^T * gradUv,  J = [dUv/dx  dUv/dy]
  vec2 depthGradientUv() {
    vec2 dUvDx = dFdx(vUv);
    vec2 dUvDy = dFdy(vUv);
    float dDx = dFdx(vDepth);
    float dDy = dFdy(vDepth);
    float det = dUvDx.x * dUvDy.y - dUvDx.y * dUvDy.x;
    if (abs(det) < 1e-12) return vec2(0.0);
    // Solve the 2×2 system for gradUv.
    return vec2(dDx * dUvDy.y - dDy * dUvDx.y, dDy * dUvDx.x - dDx * dUvDy.x) / det;
  }

  void main() {
    vec2 g = depthGradientUv();
    // Plane is uAspect wide and 1 high, so convert uv slopes into world slopes (dz / dxy).
    float slope = uDepthScale * length(vec2(g.x / uAspect, g.y));
    bool stretched = slope > uEdgeThreshold;

    vec4 color = texture2D(uImage, vUv);
    // Tiny depth cue: far parts slightly darker, so the relief reads even on flat photos.
    color.rgb *= mix(0.85, 1.0, vDepth);

    if (stretched) {
      if (!uShowEdges) discard;
      color.rgb = mix(color.rgb, vec3(1.0, 0.1, 0.1), 0.75);
    }
    gl_FragColor = color;
    #include <colorspace_fragment>
  }
`;

const backgroundFragmentShader = /* glsl */ `
  uniform sampler2D uColor;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    vec4 color = texture2D(uColor, vUv);
    color.rgb *= mix(0.85, 1.0, vDepth);
    gl_FragColor = color;
    #include <colorspace_fragment>
  }
`;

/** Draws the photo into a `GRID × GRID` RGBA array (row 0 = top), the same grid as the depth. */
function createRenderer(): THREE.WebGLRenderer {
  try {
    return new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (err) {
    throw new WebGLUnavailableError(err);
  }
}

function sampleImageColors(image: TexImageSource): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = GRID;
  canvas.height = GRID;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Uint8ClampedArray(GRID * GRID * 4).fill(128);
  if (image instanceof ImageData) {
    const tmp = document.createElement('canvas');
    tmp.width = image.width;
    tmp.height = image.height;
    tmp.getContext('2d')?.putImageData(image, 0, 0);
    ctx.drawImage(tmp, 0, 0, GRID, GRID);
  } else {
    ctx.drawImage(image, 0, 0, GRID, GRID);
  }
  return ctx.getImageData(0, 0, GRID, GRID).data;
}

/** Copies a row-major grid (row 0 = top) into a texture buffer with row 0 = bottom (uv.y = 0). */
function copyFlipped(src: ArrayLike<number>, dst: Float32Array | Uint8Array, channels: number) {
  const row = GRID * channels;
  for (let y = 0; y < GRID; y++) {
    const from = y * row;
    const to = (GRID - 1 - y) * row;
    for (let i = 0; i < row; i++) dst[to + i] = src[from + i];
  }
}

function createDepthTexture(): THREE.DataTexture {
  const tex = new THREE.DataTexture(
    new Float32Array(GRID * GRID),
    GRID,
    GRID,
    THREE.RedFormat,
    THREE.FloatType,
  );
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

/**
 * Shows a photo as a bas-relief: a 256×256 plane whose vertices are pushed towards the
 * camera by the depth map (in the vertex shader). Triangles stretched across depth jumps
 * are discarded in the fragment shader; the holes show a second, farther mesh with the near
 * objects eroded away and colours inpainted from the background. Moving the mouse over
 * `host` moves the camera. Returns a handle to tweak or dispose the view.
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

  // Plane is 1 unit high, `aspect` units wide. Both layers share the geometry.
  const aspect = source.width / source.height;
  const geometry = new THREE.PlaneGeometry(aspect, 1, SEGMENTS, SEGMENTS);

  const imageTexture = new THREE.Texture(source.image);
  imageTexture.colorSpace = THREE.SRGBColorSpace;
  imageTexture.minFilter = THREE.LinearMipmapLinearFilter;
  imageTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  imageTexture.needsUpdate = true;

  const depthTexture = createDepthTexture();
  const bgDepthTexture = createDepthTexture();
  const bgColorTexture = new THREE.DataTexture(
    new Uint8Array(GRID * GRID * 4),
    GRID,
    GRID,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  bgColorTexture.colorSpace = THREE.SRGBColorSpace;
  bgColorTexture.minFilter = THREE.LinearFilter;
  bgColorTexture.magFilter = THREE.LinearFilter;

  const imageColors = sampleImageColors(source.image);

  // Layers come from a Web Worker (depthGrid.worker.ts); only the newest result is applied.
  const applyLayers = ({ grid, bgDepth, bgColors }: ReliefLayers): void => {
    copyFlipped(grid, depthTexture.image.data as Float32Array, 1);
    depthTexture.needsUpdate = true;
    copyFlipped(bgDepth, bgDepthTexture.image.data as Float32Array, 1);
    bgDepthTexture.needsUpdate = true;
    copyFlipped(bgColors, bgColorTexture.image.data as Uint8Array, 4);
    bgColorTexture.needsUpdate = true;
    ready = true;
    front.visible = true;
    background.visible = !showEdges;
  };

  const depthScaleUniform = { value: options.depthScale };

  const frontMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uImage: { value: imageTexture },
      uDepth: { value: depthTexture },
      uDepthScale: depthScaleUniform,
      uAspect: { value: aspect },
      uEdgeThreshold: { value: options.edgeThreshold },
      uShowEdges: { value: options.showEdges },
    },
    vertexShader,
    fragmentShader: frontFragmentShader,
  });
  const front = new THREE.Mesh(geometry, frontMaterial);
  front.renderOrder = 0;
  // Hidden until the first layers arrive from the worker (avoids a flat "flash").
  let ready = false;
  let showEdges = options.showEdges;
  front.visible = false;

  const backgroundMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: bgColorTexture },
      uDepth: { value: bgDepthTexture },
      uDepthScale: depthScaleUniform,
    },
    vertexShader,
    fragmentShader: backgroundFragmentShader,
    // Extra safety against z-fighting where both layers nearly touch.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const background = new THREE.Mesh(geometry, backgroundMaterial);
  // Front first: discarded-free pixels fill the depth buffer, background only shows in holes.
  background.renderOrder = 1;
  background.visible = false;

  scene.add(front, background);

  const gridBuilder = new DepthGridBuilder(
    { depth: source.depth, width: source.width, height: source.height, colors: imageColors },
    { segments: SEGMENTS, onLayers: applyLayers, onPendingChange: options.onLayersPending },
  );
  gridBuilder.request(options.smoothing);

  // --- WebGL context loss (GPU reset, too many contexts, mobile tab in background). ---
  const canvas = renderer.domElement;
  const onContextLost = (e: Event): void => {
    e.preventDefault(); // lets the browser restore the context later
    options.onContextChange?.(false);
  };
  const onContextRestored = (): void => {
    // Three.js re-creates its GL state; textures must be uploaded again.
    for (const tex of [imageTexture, depthTexture, bgDepthTexture, bgColorTexture]) {
      tex.needsUpdate = true;
    }
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
    setDepthScale(value) {
      depthScaleUniform.value = value;
    },
    setSmoothing(value) {
      gridBuilder.request(value);
    },
    setEdgeThreshold(value) {
      frontMaterial.uniforms.uEdgeThreshold.value = value;
    },
    setShowEdges(value) {
      frontMaterial.uniforms.uShowEdges.value = value;
      showEdges = value;
      // In debug mode hide the filler so the red edges are easy to see.
      background.visible = ready && !value;
    },
    dispose() {
      renderer.setAnimationLoop(null);
      gridBuilder.dispose();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      resizeObserver.disconnect();
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      geometry.dispose();
      frontMaterial.dispose();
      backgroundMaterial.dispose();
      imageTexture.dispose();
      depthTexture.dispose();
      bgDepthTexture.dispose();
      bgColorTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
