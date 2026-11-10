import * as THREE from 'three';
import { createRenderer } from '../objects/DepthMesh';
import { createPhotoRelief, type DepthMeshSource } from '../objects/PhotoRelief';
import { createWindowFrame, loadWindowModel, WINDOW } from '../objects/WindowFrame';
import { createWindowGlass } from '../objects/WindowGlass';
import { createCurtain, type Curtain } from '../objects/Curtain';
import {
  dayNight,
  fitVerticalFov,
  idleSway,
  introProgress,
  outdoorHalfExtents,
  outdoorPlaneScale,
} from '../utils/windowView';

/** Camera layer with everything that is behind the glass (rendered into a texture first). */
const OUTSIDE_LAYER = 1;

/** Viewer (camera) setup, metres. The eye is VIEWER_HEIGHT above the opening centre. */
const VIEWER_DISTANCE = 3.6;
const VIEWER_HEIGHT = 0.2;
const VIEWER_RANGE_X = 0.85;
const VIEWER_RANGE_Y = 0.3;
/** How far behind the glazing the photo stands. */
const OUTDOOR_DISTANCE = 6;
/** Intro: the viewer starts this far back in the room and walks up to the window. */
const INTRO_PULLBACK = 2.4;
const INTRO_DURATION = 3.2;
/** Seconds without pointer movement before the head starts swaying on its own. */
const IDLE_AFTER = 2.5;

export interface WindowViewOptions {
  depthScale: number;
  smoothing: number;
  /** 0 = dry glass, 1 = heavy rain. */
  rain: number;
  /** 0 = calm, 1 = strong draught (curtain, slanted drops). */
  wind: number;
  /** 0 = day, 1 = night (darker outside, lamp on, stronger reflections). */
  night: number;
  onLayersPending?(pending: boolean): void;
  onContextChange?(ok: boolean): void;
}

export interface WindowViewHandle {
  setDepthScale(value: number): void;
  setSmoothing(value: number): void;
  setRain(value: number): void;
  setWind(value: number): void;
  setNight(value: number): void;
  dispose(): void;
}

/** Average colour of the top strip of the photo – used as "sky" behind the relief. */
function skyColor(image: TexImageSource): THREE.Color {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || image instanceof ImageData || image instanceof VideoFrame) {
    return new THREE.Color(0x9ec3e6);
  }
  ctx.drawImage(image, 0, 0, 8, 8);
  const d = ctx.getImageData(0, 0, 8, 1).data;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
  }
  const n = d.length / 4;
  return new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
}

/**
 * Shows the uploaded photo as the view from a high-rise apartment: a wall-to-wall,
 * floor-to-ceiling glazing with slim mullions, a wooden floor that the sun crosses with
 * mullion shadows, a ceiling with downlights, dirty glass that reflects the room and
 * refracts rain drops, and cloth-simulated floor-length curtains. The mouse moves the
 * viewer's head (camera position); without input the head sways slowly on its own.
 */
export function mountWindowView(
  host: HTMLElement,
  source: DepthMeshSource,
  options: WindowViewOptions,
): WindowViewHandle {
  const renderer = createRenderer({ alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 60);
  camera.layers.enable(OUTSIDE_LAYER);

  let state = { rain: options.rain, wind: options.wind, night: options.night };

  // --- Outside: the photo relief, far enough behind the wall to read as "out there". ---
  const relief = createPhotoRelief(source, {
    depthScale: options.depthScale,
    smoothing: options.smoothing,
    edgeThreshold: 3,
    showEdges: false,
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
    onLayersPending: options.onLayersPending,
  });
  const extents = outdoorHalfExtents({
    openingWidth: WINDOW.OPENING_WIDTH,
    openingHeight: WINDOW.OPENING_HEIGHT,
    viewerDistance: VIEWER_DISTANCE,
    viewerRangeX: VIEWER_RANGE_X,
    // The eye sits above the opening centre, so cover the larger of the two vertical reaches.
    viewerRangeY: VIEWER_HEIGHT + VIEWER_RANGE_Y,
    planeDistance: OUTDOOR_DISTANCE,
  });
  const outdoorScale = outdoorPlaneScale(
    relief.aspect,
    extents.halfWidth,
    extents.halfHeight,
    1.15,
  );
  relief.object.scale.setScalar(outdoorScale);
  relief.object.position.z = -OUTDOOR_DISTANCE;
  relief.object.traverse((o) => o.layers.set(OUTSIDE_LAYER));
  scene.add(relief.object);
  const daySky = skyColor(source.image);
  const nightSky = new THREE.Color(0x0b1224);
  const sky = new THREE.Color();

  // --- Inside: floor, ceiling, piers and the glazing profiles. ---
  const frame = createWindowFrame(renderer.capabilities.getMaxAnisotropy());
  scene.add(frame.object);
  let disposed = false;
  let model: THREE.Group | null = null;
  void loadWindowModel().then((m) => {
    if (!m || disposed) return;
    model = m;
    frame.profiles.visible = false;
    scene.add(m);
  });

  // --- Glass: refraction pass input + physical reflections. ---
  const glass = createWindowGlass(renderer, WINDOW.OPENING_WIDTH, WINDOW.OPENING_HEIGHT);
  glass.object.position.z = WINDOW.GLASS_Z;
  scene.add(glass.object);
  const outsideTarget = new THREE.WebGLRenderTarget(1, 1, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    colorSpace: THREE.SRGBColorSpace,
  });
  glass.setSceneTexture(outsideTarget.texture);

  // --- Curtains: two floor-length sheer panels gathered at the sides, hung from a ceiling
  // track in the curtain pocket. ---
  const floorY = -WINDOW.OPENING_HEIGHT / 2;
  const trackY = WINDOW.OPENING_HEIGHT / 2 - 0.02;
  const trackZ = 0.12;
  const curtainOptions = {
    cols: 20,
    rows: 30,
    width: 1.5,
    height: WINDOW.OPENING_HEIGHT - 0.06, // hem just above the floor
    gather: 0.62,
    foldDepth: 0.07,
    damping: 0.975,
    iterations: 10,
    wallZ: 0.03,
    floorY: floorY + 0.005,
  };
  const panelWidth = curtainOptions.width * (1 - curtainOptions.gather);
  const curtains: Curtain[] = [
    createCurtain({
      ...curtainOptions,
      origin: [-WINDOW.OPENING_WIDTH / 2 - 0.25, trackY, trackZ],
    }),
    createCurtain({
      ...curtainOptions,
      origin: [WINDOW.OPENING_WIDTH / 2 + 0.25 - panelWidth, trackY, trackZ],
    }),
  ];
  for (const c of curtains) scene.add(c.mesh);

  // --- Lights: low sun through the glazing (long mullion shadows across the floor),
  // ambient room light, warm ceiling light for the night. ---
  const hemi = new THREE.HemisphereLight(0xfff6ea, 0x8a7f72, 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 3);
  sun.position.set(-2.6, 3.4, -5.5);
  sun.target.position.set(0.6, floorY, 1.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -5;
  sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 5;
  sun.shadow.camera.bottom = -5;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 18;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const lamp = new THREE.PointLight(0xffc58a, 0, 10, 1.3);
  lamp.position.set(0, WINDOW.OPENING_HEIGHT / 2 - 0.3, 2.2);
  scene.add(lamp);
  const moonColor = new THREE.Color(0x8fa6d8);
  const sunColor = new THREE.Color(0xfff1dc);

  const applyLighting = (): void => {
    const n = state.night;
    const wet = state.rain;
    const outside = dayNight(1, 0.32, n) * (1 - wet * 0.18);
    relief.setTint(outside * dayNight(1, 0.75, n), outside * dayNight(1, 0.85, n), outside);
    sky
      .copy(daySky)
      .lerp(nightSky, n)
      .multiplyScalar(1 - wet * 0.2);
    renderer.setClearColor(sky);
    hemi.intensity = dayNight(2.6, 0.3, n);
    sun.intensity = dayNight(3, 0.35, n) * (1 - wet * 0.6);
    sun.color.copy(sunColor).lerp(moonColor, n);
    lamp.intensity = dayNight(0, 6, n);
    frame.setDownlights(n);
  };
  applyLighting();

  // --- WebGL context loss. ---
  const canvas = renderer.domElement;
  const onContextLost = (e: Event): void => {
    e.preventDefault();
    options.onContextChange?.(false);
  };
  const onContextRestored = (): void => {
    relief.reupload();
    glass.reupload();
    options.onContextChange?.(true);
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  // --- Size: the glazing fills the view edge to edge, with a strip of floor and ceiling.
  // Portrait screens crop the sides – the glass wall is meant to be bigger than the screen.
  const bufferSize = new THREE.Vector2();
  const resize = (): void => {
    const w = Math.max(host.clientWidth, 1);
    const h = Math.max(host.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const needH = WINDOW.OPENING_HEIGHT + 0.3;
    const needW = WINDOW.OPENING_WIDTH + 0.5;
    camera.fov = THREE.MathUtils.radToDeg(
      fitVerticalFov(needW, needH, VIEWER_DISTANCE, camera.aspect),
    );
    camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(bufferSize);
    outsideTarget.setSize(bufferSize.x, bufferSize.y);
    glass.setResolution(bufferSize.x, bufferSize.y);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  // --- Viewer: pointer position moves the head; idle → slow sway. ---
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timer = new THREE.Timer();
  const target = new THREE.Vector2(0, 0);
  const current = new THREE.Vector2(0, 0);
  let lastPointerTime = -Infinity;
  let pointerInside = false;
  const onPointerMove = (e: PointerEvent): void => {
    const rect = host.getBoundingClientRect();
    target.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      ((e.clientY - rect.top) / rect.height) * 2 - 1,
    );
    pointerInside = true;
    lastPointerTime = timer.getElapsed();
  };
  const onPointerLeave = (): void => {
    pointerInside = false;
    target.set(0, 0);
  };
  host.addEventListener('pointermove', onPointerMove);
  host.addEventListener('pointerleave', onPointerLeave);

  // Fade in from black together with the intro walk.
  canvas.style.opacity = '0';
  canvas.style.transition = reducedMotion ? 'none' : 'opacity 1.4s ease-out';
  const fadeIn = requestAnimationFrame(() => {
    canvas.style.opacity = '1';
  });

  const gravity = [0, -9.81, 0] as const;

  renderer.setAnimationLoop((now) => {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.1);
    const time = timer.getElapsed();

    const idle = !pointerInside || time - lastPointerTime > IDLE_AFTER;
    if (idle && !reducedMotion) {
      const sway = idleSway(time);
      target.set(sway.x, sway.y);
    }
    current.lerp(target, idle ? 0.02 : 0.06);
    const intro = reducedMotion ? 1 : introProgress(time, INTRO_DURATION);
    // Moving the head right shows more of the left side of the outdoors, like a real window.
    const eyeX = current.x * VIEWER_RANGE_X;
    const eyeY = VIEWER_HEIGHT - current.y * VIEWER_RANGE_Y;
    camera.position.set(eyeX, eyeY, VIEWER_DISTANCE + (1 - intro) * INTRO_PULLBACK);
    camera.lookAt(eyeX * 0.3, VIEWER_HEIGHT * 0.3 + (eyeY - VIEWER_HEIGHT) * 0.3, 0);

    // Draught through the window: mostly into the room, a bit sideways.
    const w = state.wind;
    const wind = [w * 1.5, 0, 0.4 + w * 9] as const;
    for (const c of curtains) c.update(dt, { gravity, wind });

    glass.update(time, state.rain, state.wind, state.night);

    // Pass 1: only the outdoors, into a texture the glass shader refracts.
    camera.layers.set(OUTSIDE_LAYER);
    renderer.setRenderTarget(outsideTarget);
    renderer.render(scene, camera);
    // Pass 2: the room. The glass covers the opening, so the outdoors is not drawn again.
    camera.layers.set(0);
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  });

  return {
    setDepthScale: relief.setDepthScale,
    setSmoothing: relief.setSmoothing,
    setRain(value) {
      state = { ...state, rain: value };
      applyLighting();
    },
    setWind(value) {
      state = { ...state, wind: value };
    },
    setNight(value) {
      state = { ...state, night: value };
      applyLighting();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(fadeIn);
      renderer.setAnimationLoop(null);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      resizeObserver.disconnect();
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      relief.dispose();
      frame.dispose();
      glass.dispose();
      for (const c of curtains) c.dispose();
      model?.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.dispose();
        }
      });
      outsideTarget.dispose();
      timer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
