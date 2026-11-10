import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createRandom, randomRange } from '../../utils/random';
import { mullionPositions } from '../utils/windowView';

/**
 * Floor-to-ceiling glazing of a high-rise apartment, in metres. The opening is centred on
 * the origin, its bottom edge is the floor and its top edge the ceiling; the room-side face
 * of the wall is z = 0 and the outside is towards -z.
 *
 * A custom model can replace the procedural aluminium profiles: put `public/models/window.glb`
 * with the same coordinates (1 unit = 1 m, opening OPENING_WIDTH × OPENING_HEIGHT centred on
 * the origin, glass plane at z = GLASS_Z). The room (floor, ceiling, walls) stays procedural.
 * Meshes whose name contains "glass" are hidden – the app draws its own glass there.
 */
export const WINDOW = {
  OPENING_WIDTH: 4.8,
  OPENING_HEIGHT: 2.7,
  /** Number of glass panes (separated by vertical mullions). */
  PANES: 3,
  /** Depth of the side piers (wall thickness next to the glazing). */
  RECESS_DEPTH: 0.22,
  GLASS_Z: -0.1,
  WALL_WIDTH: 12,
  /** How far the floor and ceiling reach into the room (behind the viewer). */
  ROOM_DEPTH: 9,
} as const;

export const WINDOW_MODEL_URL = `${import.meta.env.BASE_URL}models/window.glb`;

function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Oak planks running towards the window: 1 texture repeat = 2 × 2 m, 10 planks across. */
function createPlankTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  if (!ctx) return texture;

  const random = createRandom(7);
  const planks = 10;
  const pw = size / planks;
  for (let p = 0; p < planks; p++) {
    // Each plank column is split into boards of random length with staggered joints.
    let y = -randomRange(random, 0, size * 0.6);
    while (y < size) {
      const len = randomRange(random, size * 0.35, size * 0.8);
      const l = randomRange(random, 0.36, 0.46);
      const hue = randomRange(random, 27, 33);
      ctx.fillStyle = `hsl(${hue} 38% ${l * 100}%)`;
      ctx.fillRect(p * pw, y, pw, len);
      // Grain: thin, slightly wavy darker and lighter streaks along the board.
      for (let g = 0; g < 14; g++) {
        const gx = p * pw + randomRange(random, 2, pw - 2);
        ctx.strokeStyle = `hsl(${hue} 35% ${(l + randomRange(random, -0.08, 0.05)) * 100}% / 0.35)`;
        ctx.lineWidth = randomRange(random, 0.6, 1.8);
        ctx.beginPath();
        ctx.moveTo(gx, y);
        ctx.bezierCurveTo(
          gx + randomRange(random, -4, 4),
          y + len * 0.33,
          gx + randomRange(random, -4, 4),
          y + len * 0.66,
          gx + randomRange(random, -3, 3),
          y + len,
        );
        ctx.stroke();
      }
      ctx.fillStyle = 'rgb(30 20 12 / 0.55)';
      ctx.fillRect(p * pw, y, pw, 2); // board joint
      y += len;
    }
    ctx.fillStyle = 'rgb(30 20 12 / 0.5)';
    ctx.fillRect(p * pw, 0, 2, size); // gap between plank rows
  }

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export interface WindowFrame {
  /** Whole room side: floor, ceiling, walls and the aluminium profiles. */
  readonly object: THREE.Group;
  /** Only the profiles (frame, mullions, handle) – hidden when a custom model is loaded. */
  readonly profiles: THREE.Group;
  /** Glow of the ceiling downlights, 0 = off, 1 = full. */
  setDownlights(value: number): void;
  dispose(): void;
}

/**
 * Corner of an apartment: wooden floor and ceiling running up to a wall-to-wall,
 * floor-to-ceiling glazing split by slim anthracite mullions, side piers, a curtain pocket
 * in the ceiling and recessed downlights. Everything casts shadows, so the sun draws the
 * mullions across the floor.
 */
export function createWindowFrame(maxAnisotropy = 1): WindowFrame {
  const { OPENING_WIDTH: W, OPENING_HEIGHT: H, RECESS_DEPTH: R, GLASS_Z, PANES } = WINDOW;
  const WW = WINDOW.WALL_WIDTH;
  const RD = WINDOW.ROOM_DEPTH;
  const object = new THREE.Group();
  object.name = 'WindowFrame';

  const plankTexture = createPlankTexture(maxAnisotropy);
  plankTexture.repeat.set(WW / 2, (RD + R) / 2);
  const floorMaterial = new THREE.MeshStandardMaterial({
    map: plankTexture,
    roughness: 0.38,
    metalness: 0,
  });
  const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: 0.92 });
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xe9e4dc, roughness: 0.9 });
  const pocketMaterial = new THREE.MeshStandardMaterial({ color: 0x24221f, roughness: 0.8 });
  const profileMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2d31,
    metalness: 0.55,
    roughness: 0.38,
  });
  const handleMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9b9b6,
    metalness: 0.9,
    roughness: 0.25,
  });
  const downlightMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffd9a8,
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  const materials = [
    floorMaterial,
    ceilingMaterial,
    wallMaterial,
    pocketMaterial,
    profileMaterial,
    handleMaterial,
    downlightMaterial,
  ];

  // --- Room shell: thick slabs, so they block the sun everywhere except the glazing. ---
  const slab = 0.25;
  const shellDepth = RD + R;
  const shellZ = -R + shellDepth / 2;
  const floor = box(WW, slab, shellDepth, floorMaterial, 0, -H / 2 - slab / 2, shellZ);
  floor.name = 'Floor';
  const ceiling = box(WW, slab, shellDepth, ceilingMaterial, 0, H / 2 + slab / 2, shellZ);
  ceiling.name = 'Ceiling';
  const pierWidth = (WW - W) / 2;
  object.add(
    floor,
    ceiling,
    box(pierWidth, H, R, wallMaterial, -W / 2 - pierWidth / 2, 0, -R / 2),
    box(pierWidth, H, R, wallMaterial, W / 2 + pierWidth / 2, 0, -R / 2),
  );

  // Curtain pocket: a dark slot in the ceiling right in front of the glazing.
  object.add(box(WW, 0.012, 0.18, pocketMaterial, 0, H / 2 - 0.004, 0.11));

  // Recessed downlights in two rows.
  for (const z of [1.3, 3.1]) {
    for (const x of [-1.8, 0, 1.8]) {
      const light = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.012, 24),
        downlightMaterial,
      );
      light.position.set(x, H / 2 - 0.004, z);
      object.add(light);
    }
  }

  // --- Profiles: slim outer frame, mullions and a long handle of the sliding pane. ---
  const profiles = new THREE.Group();
  profiles.name = 'Profiles';
  const fw = 0.055; // face width
  const fd = 0.14; // depth
  const fz = GLASS_Z;
  profiles.add(
    box(fw, H, fd, profileMaterial, -W / 2 + fw / 2, 0, fz),
    box(fw, H, fd, profileMaterial, W / 2 - fw / 2, 0, fz),
    box(W, fw, fd, profileMaterial, 0, H / 2 - fw / 2, fz),
    box(W, 0.045, fd, profileMaterial, 0, -H / 2 + 0.045 / 2, fz), // threshold, flush with the floor
  );
  for (const x of mullionPositions(W, PANES)) {
    profiles.add(box(0.05, H, fd * 1.15, profileMaterial, x, 0, fz));
  }
  const handleX = -W / 2 + (W * (PANES - 1)) / PANES + 0.09;
  profiles.add(box(0.022, 0.5, 0.03, handleMaterial, handleX, -0.2, fz + fd / 2 + 0.035));
  object.add(profiles);

  return {
    object,
    profiles,
    setDownlights(value) {
      downlightMaterial.emissiveIntensity = value * 4;
    },
    dispose() {
      object.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      for (const m of materials) m.dispose();
      plankTexture.dispose();
    },
  };
}

/**
 * Tries to load `public/models/window.glb`. Resolves to null when the file is missing or
 * invalid (the procedural frame is used then), so a missing model never breaks the view.
 */
export async function loadWindowModel(url = WINDOW_MODEL_URL): Promise<THREE.Group | null> {
  try {
    const res = await fetch(url);
    // Dev servers answer unknown paths with index.html – treat that as "missing".
    if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) {
      console.info(`[WindowFrame] ${url} not found – using the procedural window frame`);
      return null;
    }
    const data = await res.arrayBuffer();
    const gltf = await new GLTFLoader().parseAsync(data, url.slice(0, url.lastIndexOf('/') + 1));
    const model = gltf.scene;
    model.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (/glass/i.test(o.name)) {
        o.visible = false;
        return;
      }
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return model;
  } catch (err) {
    console.warn('[WindowFrame] could not load window model, using the procedural one', err);
    return null;
  }
}
