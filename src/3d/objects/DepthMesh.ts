import * as THREE from 'three';
import { buildDepthGrid } from '../utils/depthGrid';

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
}

export interface DepthMeshHandle {
  setDepthScale(value: number): void;
  setSmoothing(value: number): void;
  dispose(): void;
}

const vertexShader = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uDepthScale;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    vUv = uv;
    // The depth texture has exactly one texel per vertex: map uv 0..1 onto texel centres.
    vec2 tc = uv * (${SEGMENTS}.0 / ${GRID}.0) + 0.5 / ${GRID}.0;
    float d = texture2D(uDepth, tc).r;
    vDepth = d;
    vec3 displaced = position + vec3(0.0, 0.0, (d - 0.5) * uDepthScale);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uImage;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    vec4 color = texture2D(uImage, vUv);
    // Tiny depth cue: far parts slightly darker, so the relief reads even on flat photos.
    color.rgb *= mix(0.85, 1.0, vDepth);
    gl_FragColor = color;
    #include <colorspace_fragment>
  }
`;

/**
 * Shows a photo as a bas-relief: a 256×256 plane whose vertices are pushed towards the
 * camera by the depth map (in the vertex shader). Moving the mouse over `host` moves the
 * camera, so the depth becomes visible. Returns a handle to tweak or dispose the view.
 */
export function mountDepthMesh(
  host: HTMLElement,
  source: DepthMeshSource,
  options: DepthMeshOptions,
): DepthMeshHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);

  // Plane is 1 unit high, `aspect` units wide.
  const aspect = source.width / source.height;
  const geometry = new THREE.PlaneGeometry(aspect, 1, SEGMENTS, SEGMENTS);

  const imageTexture = new THREE.Texture(source.image);
  imageTexture.colorSpace = THREE.SRGBColorSpace;
  imageTexture.minFilter = THREE.LinearMipmapLinearFilter;
  imageTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  imageTexture.needsUpdate = true;

  // PlaneGeometry's uv.y = 1 at the top, the depth map's row 0 is the top → flipY.
  const depthTexture = new THREE.DataTexture(
    new Float32Array(GRID * GRID),
    GRID,
    GRID,
    THREE.RedFormat,
    THREE.FloatType,
  );
  depthTexture.flipY = false;
  depthTexture.minFilter = THREE.NearestFilter;
  depthTexture.magFilter = THREE.NearestFilter;

  const setGrid = (smoothing: number): void => {
    const grid = buildDepthGrid(source.depth, source.width, source.height, SEGMENTS, smoothing);
    // Flip rows so row 0 of the texture is the bottom of the image (matches uv.y = 0).
    const data = depthTexture.image.data as Float32Array;
    for (let y = 0; y < GRID; y++) {
      data.set(grid.subarray(y * GRID, (y + 1) * GRID), (GRID - 1 - y) * GRID);
    }
    depthTexture.needsUpdate = true;
  };
  setGrid(options.smoothing);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uImage: { value: imageTexture },
      uDepth: { value: depthTexture },
      uDepthScale: { value: options.depthScale },
    },
    vertexShader,
    fragmentShader,
  });
  scene.add(new THREE.Mesh(geometry, material));

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
      material.uniforms.uDepthScale.value = value;
    },
    setSmoothing(value) {
      setGrid(value);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      geometry.dispose();
      material.dispose();
      imageTexture.dispose();
      depthTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
