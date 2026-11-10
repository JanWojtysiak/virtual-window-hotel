import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Window dimensions in metres. The opening is centred on the origin, the room-side face of
 * the wall is z = 0 and the outside is towards -z.
 *
 * A custom model can replace the procedural frame: put `public/models/window.glb` with
 * the same coordinates (1 unit = 1 m, opening OPENING_WIDTH × OPENING_HEIGHT centred on the
 * origin, wall face at z = 0, glass plane at z = GLASS_Z). Meshes whose name contains
 * "glass" are hidden – the app draws its own glass there.
 */
export const WINDOW = {
  OPENING_WIDTH: 1.2,
  OPENING_HEIGHT: 1.5,
  /** Depth of the recess (wall thickness). */
  RECESS_DEPTH: 0.32,
  GLASS_Z: -0.24,
  /** Room-side edge of the inner window sill. */
  SILL_FRONT_Z: 0.1,
  WALL_WIDTH: 9,
  WALL_HEIGHT: 6,
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

export interface WindowFrame {
  readonly object: THREE.Group;
  dispose(): void;
}

/** Wall with an opening, recess, frame with mullions and an inner sill – all procedural. */
export function createWindowFrame(): WindowFrame {
  const { OPENING_WIDTH: W, OPENING_HEIGHT: H, RECESS_DEPTH: D, GLASS_Z, SILL_FRONT_Z } = WINDOW;
  const object = new THREE.Group();
  object.name = 'WindowFrame';

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xe9e2d6, roughness: 0.95 });
  const recessMaterial = new THREE.MeshStandardMaterial({ color: 0xded6c8, roughness: 0.9 });
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xf7f6f2, roughness: 0.35 });
  const sillMaterial = new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.55 });
  const materials = [wallMaterial, recessMaterial, frameMaterial, sillMaterial];

  // --- Wall: a big plane with a rectangular hole. ---
  const ww = WINDOW.WALL_WIDTH / 2;
  const wh = WINDOW.WALL_HEIGHT / 2;
  const shape = new THREE.Shape()
    .moveTo(-ww, -wh)
    .lineTo(ww, -wh)
    .lineTo(ww, wh)
    .lineTo(-ww, wh)
    .closePath();
  const hole = new THREE.Path()
    .moveTo(-W / 2, -H / 2)
    .lineTo(-W / 2, H / 2)
    .lineTo(W / 2, H / 2)
    .lineTo(W / 2, -H / 2)
    .closePath();
  shape.holes.push(hole);
  const wall = new THREE.Mesh(new THREE.ShapeGeometry(shape), wallMaterial);
  wall.receiveShadow = true;
  wall.name = 'Wall';
  object.add(wall);

  // --- Recess (the reveal): four slabs around the opening. Blocks the view at angles. ---
  const t = 0.05; // slab thickness, hidden inside the wall
  object.add(
    box(t, H + 2 * t, D, recessMaterial, -W / 2 - t / 2, 0, -D / 2 - 0.002), // left
    box(t, H + 2 * t, D, recessMaterial, W / 2 + t / 2, 0, -D / 2 - 0.002), // right
    box(W, t, D, recessMaterial, 0, H / 2 + t / 2, -D / 2 - 0.002), // top
    box(W, t, D, recessMaterial, 0, -H / 2 - t / 2, -D / 2 - 0.002), // bottom
  );

  // --- Frame: outer ring + sashes with a central mullion and a transom. ---
  const fw = 0.075; // face width
  const fd = 0.09; // depth
  const fz = GLASS_Z;
  object.add(
    box(fw, H, fd, frameMaterial, -W / 2 + fw / 2, 0, fz),
    box(fw, H, fd, frameMaterial, W / 2 - fw / 2, 0, fz),
    box(W, fw, fd, frameMaterial, 0, H / 2 - fw / 2, fz),
    box(W, fw * 1.3, fd, frameMaterial, 0, -H / 2 + (fw * 1.3) / 2, fz),
    box(fw * 1.2, H, fd * 1.1, frameMaterial, 0, 0, fz), // mullion
    box(W, fw, fd * 1.1, frameMaterial, 0, H / 2 - 0.42, fz), // transom
  );
  // Handles on the sashes.
  const handleMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9c9c9,
    metalness: 0.9,
    roughness: 0.3,
  });
  materials.push(handleMaterial);
  for (const side of [-1, 1]) {
    object.add(box(0.022, 0.13, 0.025, handleMaterial, side * 0.06, -0.05, fz + fd / 2 + 0.02));
  }

  // --- Inner sill: board sticking out into the room under the opening. ---
  const sillDepth = SILL_FRONT_Z - (fz + fd / 2);
  object.add(
    box(
      W + 0.24,
      0.035,
      sillDepth,
      sillMaterial,
      0,
      -H / 2 + 0.035 / 2,
      fz + fd / 2 + sillDepth / 2,
    ),
  );

  return {
    object,
    dispose() {
      object.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      for (const m of materials) m.dispose();
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
