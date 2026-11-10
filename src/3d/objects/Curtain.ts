import * as THREE from 'three';
import { Cloth, type ClothOptions, type ClothForces } from '../physics/cloth';

const STEP = 1 / 60;
const MAX_STEPS = 4;

export interface Curtain {
  readonly mesh: THREE.Mesh;
  /** Advances the simulation with a fixed time step and updates the mesh. */
  update(dt: number, forces: Omit<ClothForces, 'time'>): void;
  dispose(): void;
}

/**
 * Sheer curtain driven by the Verlet cloth in physics/cloth.ts. The simulation particles
 * map 1:1 onto the vertices of a PlaneGeometry (same row-major order, top-left first).
 */
export function createCurtain(
  options: ClothOptions & { color?: THREE.ColorRepresentation; wallZ: number; floorY?: number },
): Curtain {
  const cloth = new Cloth(options);
  // Keep the fabric in front of the wall (and above the floor for floor-length curtains).
  cloth.addCollider({ normal: [0, 0, 1], offset: options.wallZ });
  if (options.floorY !== undefined)
    cloth.addCollider({ normal: [0, 1, 0], offset: options.floorY });

  const geometry = new THREE.PlaneGeometry(1, 1, options.cols - 1, options.rows - 1);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  position.setUsage(THREE.DynamicDrawUsage);

  const material = new THREE.MeshStandardMaterial({
    color: options.color ?? 0xf4efe6,
    roughness: 0.95,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.82,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Curtain';
  mesh.castShadow = true;
  mesh.frustumCulled = false; // vertices move every frame; the plane's bounds are not valid

  const sync = (): void => {
    (position.array as Float32Array).set(cloth.positions);
    position.needsUpdate = true;
    geometry.computeVertexNormals();
  };

  let time = 0;
  let accumulator = 0;
  // Let the fabric settle into its folds before the first frame is shown.
  const settle: Omit<ClothForces, 'time'> = { gravity: [0, -9.81, 0], wind: [0, 0, 0] };
  for (let i = 0; i < 120; i++) cloth.step(STEP, { ...settle, time: 0 });
  sync();

  return {
    mesh,
    update(dt, forces) {
      accumulator = Math.min(accumulator + dt, STEP * MAX_STEPS);
      let stepped = false;
      while (accumulator >= STEP) {
        time += STEP;
        cloth.step(STEP, { ...forces, time });
        accumulator -= STEP;
        stepped = true;
      }
      if (stepped) sync();
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
