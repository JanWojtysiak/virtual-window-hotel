import * as THREE from 'three';
import { createRenderer } from '../objects/DepthMesh';
import { createPhotoRelief, type DepthMeshSource } from '../objects/PhotoRelief';
import { createWindowFrame, loadWindowModel, WINDOW } from '../objects/WindowFrame';
import { createWindowGlass } from '../objects/WindowGlass';
import { createCurtain, type Curtain } from '../objects/Curtain';
import { dayNight, outdoorHalfExtents, outdoorPlaneScale } from '../utils/windowView';

/** Camera layer with everything that is behind the glass (rendered into a texture first). */
const OUTSIDE_LAYER = 1;

/** Viewer (camera) setup, metres. */
const VIEWER_DISTANCE = 2.2;
const VIEWER_RANGE_X = 0.45;
const VIEWER_RANGE_Y = 0.28;
/** How far behind the wall the photo stands. */
const OUTDOOR_DISTANCE = 4;

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
 * Shows the uploaded photo as the view through a real 3D window: a wall with a recess that
 * hides part of the view when the viewer moves, a frame, a sill, dirty glass that reflects
 * the room and refracts rain drops, and a cloth-simulated curtain. The mouse moves the
 * viewer's head (camera position), like looking out of a window from different spots.
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
    viewerRangeY: VIEWER_RANGE_Y,
    planeDistance: OUTDOOR_DISTANCE,
  });
  const outdoorScale = outdoorPlaneScale(
    relief.aspect,
    extents.halfWidth,
    extents.halfHeight,
    1.25,
  );
  relief.object.scale.setScalar(outdoorScale);
  relief.object.position.z = -OUTDOOR_DISTANCE;
  relief.object.traverse((o) => o.layers.set(OUTSIDE_LAYER));
  scene.add(relief.object);
  const daySky = skyColor(source.image);
  const nightSky = new THREE.Color(0x0b1224);
  const sky = new THREE.Color();

  // --- Inside: wall, recess, frame, sill. ---
  const frame = createWindowFrame();
  scene.add(frame.object);
  let disposed = false;
  let model: THREE.Group | null = null;
  void loadWindowModel().then((m) => {
    if (!m || disposed) return;
    model = m;
    frame.object.visible = false;
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

  // --- Curtains: two gathered sheer panels on a rod. ---
  const rodY = WINDOW.OPENING_HEIGHT / 2 + 0.22;
  const rodZ = 0.13;
  const curtainHeight = rodY + WINDOW.OPENING_HEIGHT / 2 - 0.05; // ends just above the sill
  const curtainOptions = {
    cols: 18,
    rows: 26,
    width: 0.78,
    height: curtainHeight,
    gather: 0.55,
    foldDepth: 0.06,
    damping: 0.975,
    iterations: 10,
    wallZ: 0.03,
  };
  const panelWidth = curtainOptions.width * (1 - curtainOptions.gather);
  const curtains: Curtain[] = [
    createCurtain({ ...curtainOptions, origin: [-WINDOW.OPENING_WIDTH / 2 - 0.3, rodY, rodZ] }),
    createCurtain({
      ...curtainOptions,
      origin: [WINDOW.OPENING_WIDTH / 2 + 0.3 - panelWidth, rodY, rodZ],
    }),
  ];
  for (const c of curtains) scene.add(c.mesh);
  const rodMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3430,
    metalness: 0.6,
    roughness: 0.4,
  });
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, WINDOW.OPENING_WIDTH + 0.75, 12),
    rodMaterial,
  );
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, rodY + 0.012, rodZ);
  rod.castShadow = true;
  scene.add(rod);

  // --- Lights: daylight through the window, ambient room light, a lamp for the night. ---
  const hemi = new THREE.HemisphereLight(0xfff6ea, 0x8a7f72, 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 3);
  sun.position.set(-1.6, 2.6, -4);
  sun.target.position.set(0.3, -1, 0.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -2;
  sun.shadow.camera.right = 2;
  sun.shadow.camera.top = 2;
  sun.shadow.camera.bottom = -2;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 10;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const lamp = new THREE.PointLight(0xffb36b, 0, 8, 1.4);
  lamp.position.set(1.5, 0.6, 1.7);
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
    lamp.intensity = dayNight(0, 3.5, n);
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

  // --- Size: keep the whole opening plus some wall in view on any aspect ratio. ---
  const bufferSize = new THREE.Vector2();
  const resize = (): void => {
    const w = Math.max(host.clientWidth, 1);
    const h = Math.max(host.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const needH = WINDOW.OPENING_HEIGHT + 0.95;
    const needW = WINDOW.OPENING_WIDTH + 1.1;
    const vFov = 2 * Math.atan(Math.max(needH, needW / camera.aspect) / 2 / VIEWER_DISTANCE);
    camera.fov = THREE.MathUtils.radToDeg(vFov);
    camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(bufferSize);
    outsideTarget.setSize(bufferSize.x, bufferSize.y);
    glass.setResolution(bufferSize.x, bufferSize.y);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  // --- Viewer: pointer position moves the head. ---
  const target = new THREE.Vector2(0, 0);
  const current = new THREE.Vector2(0, 0);
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

  const timer = new THREE.Timer();
  const gravity = [0, -9.81, 0] as const;

  renderer.setAnimationLoop((now) => {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.1);
    const time = timer.getElapsed();

    current.lerp(target, 0.06);
    // Moving the head right shows more of the left side of the outdoors, like a real window.
    camera.position.set(current.x * VIEWER_RANGE_X, -current.y * VIEWER_RANGE_Y, VIEWER_DISTANCE);
    camera.lookAt(current.x * VIEWER_RANGE_X * 0.3, -current.y * VIEWER_RANGE_Y * 0.3, 0);

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
      rod.geometry.dispose();
      rodMaterial.dispose();
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
