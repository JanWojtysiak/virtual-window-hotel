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

export interface PhotoReliefOptions {
  /** How far (in plane heights) the nearest point sticks out. */
  depthScale: number;
  /** Blur radius in grid cells applied to the depth before displacing. */
  smoothing: number;
  /** Max surface slope (dz / dxy) before a triangle counts as "stretched" and is discarded. */
  edgeThreshold: number;
  /** Debug: paint discarded triangles red instead of removing them. */
  showEdges: boolean;
  /** Renderer's max anisotropy (sharper photo at grazing angles). */
  maxAnisotropy?: number;
  /** True while new layers are computed in the worker. */
  onLayersPending?(pending: boolean): void;
}

export interface PhotoRelief {
  /** Plane `aspect` wide and 1 high, centred on the origin, facing +z. */
  readonly object: THREE.Group;
  readonly aspect: number;
  setDepthScale(value: number): void;
  setSmoothing(value: number): void;
  setEdgeThreshold(value: number): void;
  setShowEdges(value: boolean): void;
  /** Multiplies the photo colour (day/night grading). */
  setTint(r: number, g: number, b: number): void;
  /** Marks every texture for re-upload (after a WebGL context restore). */
  reupload(): void;
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
  uniform vec3 uTint;
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
    color.rgb *= mix(0.85, 1.0, vDepth) * uTint;

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
  uniform vec3 uTint;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    vec4 color = texture2D(uColor, vUv);
    color.rgb *= mix(0.85, 1.0, vDepth) * uTint;
    gl_FragColor = color;
    #include <colorspace_fragment>
  }
`;

/** Draws the photo into a `GRID × GRID` RGBA array (row 0 = top), the same grid as the depth. */
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
 * Builds the photo bas-relief: a 256×256 plane whose vertices are pushed towards +z by the
 * depth map (in the vertex shader). Triangles stretched across depth jumps are discarded;
 * the holes show a second, farther mesh with near objects eroded away and colours inpainted.
 * Used by the relief preview (DepthMesh) and as the outdoor view of the 3D window (WindowScene).
 */
export function createPhotoRelief(
  source: DepthMeshSource,
  options: PhotoReliefOptions,
): PhotoRelief {
  const aspect = source.width / source.height;
  const geometry = new THREE.PlaneGeometry(aspect, 1, SEGMENTS, SEGMENTS);

  const imageTexture = new THREE.Texture(source.image);
  imageTexture.colorSpace = THREE.SRGBColorSpace;
  imageTexture.minFilter = THREE.LinearMipmapLinearFilter;
  imageTexture.anisotropy = options.maxAnisotropy ?? 1;
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

  const depthScaleUniform = { value: options.depthScale };
  const tintUniform = { value: new THREE.Color(1, 1, 1) };

  const frontMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uImage: { value: imageTexture },
      uDepth: { value: depthTexture },
      uDepthScale: depthScaleUniform,
      uAspect: { value: aspect },
      uEdgeThreshold: { value: options.edgeThreshold },
      uShowEdges: { value: options.showEdges },
      uTint: tintUniform,
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
      uTint: tintUniform,
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

  const object = new THREE.Group();
  object.name = 'PhotoRelief';
  object.add(front, background);

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

  const gridBuilder = new DepthGridBuilder(
    {
      depth: source.depth,
      width: source.width,
      height: source.height,
      colors: sampleImageColors(source.image),
    },
    { segments: SEGMENTS, onLayers: applyLayers, onPendingChange: options.onLayersPending },
  );
  gridBuilder.request(options.smoothing);

  const textures = [imageTexture, depthTexture, bgDepthTexture, bgColorTexture];

  return {
    object,
    aspect,
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
    setTint(r, g, b) {
      tintUniform.value.setRGB(r, g, b);
    },
    reupload() {
      for (const tex of textures) tex.needsUpdate = true;
    },
    dispose() {
      gridBuilder.dispose();
      geometry.dispose();
      frontMaterial.dispose();
      backgroundMaterial.dispose();
      for (const tex of textures) tex.dispose();
    },
  };
}
