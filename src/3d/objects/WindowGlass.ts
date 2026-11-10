import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { generateSmudgeMap } from '../utils/smudgeMap';

// The pane is drawn as two coplanar meshes:
//   1. `view` – a ShaderMaterial that shows the outdoor render target (what is behind the
//      glass) and refracts it through procedural rain drops: inside a drop the image is
//      flipped and blurred like through a tiny lens. Smudges add haze and blur.
//   2. `surface` – MeshPhysicalMaterial with additive blending: only its reflections are
//      added (interior environment map + lamp highlights), roughness comes from smudges.

const viewVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const viewFragmentShader = /* glsl */ `
  uniform sampler2D uScene;
  uniform sampler2D uSmudge;
  uniform vec2 uResolution;
  uniform vec2 uPaneSize;
  uniform float uTime;
  uniform float uRain;
  uniform float uWind;
  uniform float uNight;
  varying vec2 vUv;

  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }
  vec3 hash32(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
  }

  // A drop: xy = position inside the drop (-1..1, length 1 at the rim), z = coverage,
  // w = radius in drop-space units.
  vec4 pickDrop(vec4 a, vec4 b) { return a.z >= b.z ? a : b; }

  // Small beads that sit still, appear and slowly evaporate.
  vec4 staticDrops(vec2 p, float t, float density) {
    vec2 cell = floor(p);
    vec2 f = fract(p) - 0.5;
    vec3 h = hash32(cell);
    vec2 c = (h.xy - 0.5) * 0.6;
    float r = mix(0.1, 0.28, h.z * h.z);
    float life = fract(t * 0.04 + h.x * 13.7);
    float alive = smoothstep(0.0, 0.08, life) * smoothstep(1.0, 0.6, life);
    vec2 d = (f - c) / r;
    float m = smoothstep(1.0, 0.8, length(d)) * alive * step(h.y, density);
    return vec4(d, m, r);
  }

  // Bigger drops running down the glass in columns, leaving a trail of beads.
  vec4 slidingDrops(vec2 p, float t, float density) {
    const float COL = 1.0;    // column width
    const float PERIOD = 6.0; // vertical repeat (in column widths)
    float col = floor(p.x / COL);
    float h1 = hash11(col * 1.37 + 0.5);
    float h2 = hash11(col * 7.11 + 3.1);
    float h3 = hash11(col * 3.77 + 9.2);
    if (h3 > density) return vec4(0.0);

    float speed = mix(0.05, 0.16, h1);
    float fy = fract(p.y / PERIOD + t * speed + h2);        // 0..1 inside the period
    float dy = (fy - 0.5) * PERIOD;                         // >0 above the drop
    float fx = fract(p.x / COL) - 0.5;
    float wiggle = sin(p.y * 1.7 + h1 * 20.0) * 0.08 + sin(p.y * 4.3) * 0.03;
    float cx = (h2 - 0.5) * 0.4 + wiggle;

    float r = mix(0.22, 0.36, h1);
    vec2 d = vec2(fx - cx, dy) / vec2(r, r * 1.25);
    // Flattened top, heavier bottom.
    d.y *= dy > 0.0 ? 0.85 : 1.1;
    float m = smoothstep(1.0, 0.8, length(d));
    vec4 drop = vec4(d, m, r);

    // Trail: beads left behind above the drop, fading with distance.
    if (dy > 0.0 && dy < 3.0) {
      float seg = 0.32;
      float ty = mod(dy, seg) - seg * 0.5;
      float tr = 0.07 * (1.0 - dy / 3.0) * (0.6 + hash11(floor(dy / seg) + col) * 0.6);
      vec2 td = vec2(fx - cx, ty) / max(tr, 1e-4);
      float tm = smoothstep(1.0, 0.75, length(td)) * step(0.02, tr);
      drop = pickDrop(drop, vec4(td, tm, tr));
    }
    return drop;
  }

  void main() {
    vec2 screenUv = gl_FragCoord.xy / uResolution;
    vec2 p = vUv * uPaneSize * 14.0;              // ~14 drop cells per metre
    p.x += p.y * uWind * 0.35;                    // wind slants the runs
    float rain = clamp(uRain, 0.0, 1.0);

    vec4 drop = vec4(0.0);
    if (rain > 0.001) {
      drop = pickDrop(staticDrops(p * 1.6, uTime, rain * 0.9),
                      staticDrops(p * 3.1 + 17.0, uTime * 1.3, rain * 0.7));
      drop = pickDrop(drop, slidingDrops(p, uTime, rain * 0.55));
    }

    float smudge = texture2D(uSmudge, vUv).r;
    // Screen-space size of one drop-space unit, to turn drop radii into uv offsets.
    float unitsPerPixel = max(length(fwidth(p)) * 0.7071, 1e-5);
    vec2 unitUv = vec2(1.0 / unitsPerPixel) / uResolution;

    // Outside the drops: the view, slightly blurred where the glass is dirty.
    vec3 clear = textureLod(uScene, screenUv, smudge * 2.5).rgb;

    // Inside a drop: a convex lens shows a shrunken, upside-down image of a wide area,
    // blurred because the drop is far from the focal plane.
    vec2 centerUv = screenUv - drop.xy * drop.w * unitUv;
    vec2 lensUv = centerUv - drop.xy * drop.w * unitUv * 4.0;
    vec3 lens = textureLod(uScene, clamp(lensUv, 0.001, 0.999), 3.0).rgb;
    float rimDist = length(drop.xy);
    // Dark refractive rim and a soft highlight on the upper-left of each drop.
    lens *= mix(1.0, 0.45, smoothstep(0.55, 1.0, rimDist));
    float spec = smoothstep(0.35, 0.0, length(drop.xy - vec2(-0.35, 0.4)));
    lens += spec * mix(0.35, 0.6, uNight) * vec3(1.0, 0.97, 0.9);

    vec3 color = mix(clear, lens, drop.z);
    // Wet, overcast glass and dirt scatter a little light → haze.
    float haze = smudge * 0.09 + rain * 0.06;
    color = mix(color, vec3(dot(color, vec3(0.333)) * 0.9 + 0.08), haze);

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface WindowGlass {
  /** Add both meshes to the scene at the glass position. */
  readonly object: THREE.Group;
  setSceneTexture(texture: THREE.Texture): void;
  setResolution(width: number, height: number): void;
  update(time: number, rain: number, wind: number, night: number): void;
  reupload(): void;
  dispose(): void;
}

const SMUDGE_SIZE = 256;

export function createWindowGlass(
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
): WindowGlass {
  // The map has row 0 at the top; textures have row 0 at the bottom (uv.y = 0).
  const top = generateSmudgeMap(SMUDGE_SIZE, 42);
  const smudge = new Uint8Array(top.length);
  for (let y = 0; y < SMUDGE_SIZE; y++) {
    smudge.set(
      top.subarray(y * SMUDGE_SIZE, (y + 1) * SMUDGE_SIZE),
      (SMUDGE_SIZE - 1 - y) * SMUDGE_SIZE,
    );
  }

  // Haze/blur map for the view shader (R).
  const smudgeTexture = new THREE.DataTexture(
    smudge,
    SMUDGE_SIZE,
    SMUDGE_SIZE,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  smudgeTexture.minFilter = THREE.LinearFilter;
  smudgeTexture.magFilter = THREE.LinearFilter;
  smudgeTexture.needsUpdate = true;

  // Roughness map for the physical surface (three.js reads the G channel).
  const roughness = new Uint8Array(SMUDGE_SIZE * SMUDGE_SIZE * 4);
  for (let i = 0; i < smudge.length; i++) {
    const v = Math.round(12 + (smudge[i] / 255) * 150);
    roughness[i * 4] = v;
    roughness[i * 4 + 1] = v;
    roughness[i * 4 + 2] = v;
    roughness[i * 4 + 3] = 255;
  }
  const roughnessTexture = new THREE.DataTexture(roughness, SMUDGE_SIZE, SMUDGE_SIZE);
  roughnessTexture.minFilter = THREE.LinearFilter;
  roughnessTexture.magFilter = THREE.LinearFilter;
  roughnessTexture.needsUpdate = true;

  // Interior reflection: a neutral "room" environment, pre-filtered for rough reflections.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envMap = pmrem.fromScene(roomEnv, 0.12).texture;
  roomEnv.dispose();
  pmrem.dispose();

  const geometry = new THREE.PlaneGeometry(width, height);

  const viewMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uScene: { value: null },
      uSmudge: { value: smudgeTexture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPaneSize: { value: new THREE.Vector2(width, height) },
      uTime: { value: 0 },
      uRain: { value: 0 },
      uWind: { value: 0 },
      uNight: { value: 0 },
    },
    vertexShader: viewVertexShader,
    fragmentShader: viewFragmentShader,
  });
  const view = new THREE.Mesh(geometry, viewMaterial);
  view.name = 'GlassView';

  const surfaceMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    metalness: 0,
    roughness: 1, // multiplied by roughnessMap
    roughnessMap: roughnessTexture,
    ior: 1.5,
    specularIntensity: 1,
    envMap,
    envMapIntensity: 0.3,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const surface = new THREE.Mesh(geometry, surfaceMaterial);
  surface.name = 'GlassSurface';
  surface.position.z = 0.002;
  surface.renderOrder = 10;

  const object = new THREE.Group();
  object.name = 'WindowGlass';
  object.add(view, surface);

  const u = viewMaterial.uniforms;
  return {
    object,
    setSceneTexture(texture) {
      u.uScene.value = texture;
    },
    setResolution(w, h) {
      u.uResolution.value.set(w, h);
    },
    update(time, rain, wind, night) {
      u.uTime.value = time;
      u.uRain.value = rain;
      u.uWind.value = wind;
      u.uNight.value = night;
      // Reflections of the room are much more visible when it is dark outside.
      surfaceMaterial.envMapIntensity = 0.04 + night * 0.16;
    },
    reupload() {
      smudgeTexture.needsUpdate = true;
      roughnessTexture.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      viewMaterial.dispose();
      surfaceMaterial.dispose();
      smudgeTexture.dispose();
      roughnessTexture.dispose();
      envMap.dispose();
    },
  };
}
