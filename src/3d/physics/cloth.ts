// Verlet cloth simulation for the window curtain. Pure TypeScript – no Three.js import –
// so it can be unit-tested in Vitest. The renderer only copies `positions` into a buffer.

export type Vec3 = readonly [number, number, number];

export interface ClothOptions {
  /** Particles along the width (≥ 2). */
  cols: number;
  /** Particles along the height (≥ 2). */
  rows: number;
  /** Rest width of the fabric in metres (before gathering). */
  width: number;
  /** Rest height of the fabric in metres. */
  height: number;
  /** World position of the top-left particle. The cloth hangs towards -y, extends towards +x. */
  origin: Vec3;
  /**
   * How much the pinned top edge is pushed together on the rod (0 = flat, 0.4 = 40 % shorter).
   * The fabric keeps its rest width, so it falls into folds.
   */
  gather?: number;
  /** Fold depth (metres) used to seed the initial shape, so the folds have a direction. */
  foldDepth?: number;
  /** Velocity kept per step (0..1); lower = heavier, calmer fabric. */
  damping?: number;
  /** Constraint relaxation passes per step; more = stiffer fabric. */
  iterations?: number;
}

export interface ClothForces {
  /** Constant acceleration, m/s². */
  gravity: Vec3;
  /** Base wind acceleration, m/s². Gusts are added on top by {@link windGust}. */
  wind: Vec3;
  /** Simulation time in seconds (drives gusts). */
  time: number;
}

/** Half-space the particles must stay in: dot(p, normal) >= offset. */
export interface PlaneCollider {
  normal: Vec3;
  offset: number;
}

/**
 * Gust multiplier (≈ 0.2..1.6) for a particle at (x, y) at time t. A few incommensurate
 * sine waves travelling along the fabric give a cheap, smooth, non-repeating "noise".
 */
export function windGust(x: number, y: number, t: number): number {
  const slow = Math.sin(t * 0.7) * 0.5 + Math.sin(t * 0.31 + 1.7) * 0.5; // whole-curtain breathing
  const ripple = Math.sin(x * 6.0 - t * 2.3 + y * 2.0) * 0.25 + Math.sin(y * 4.0 + t * 1.3) * 0.15;
  return Math.max(0, 0.9 + slow * 0.5 + ripple);
}

export class Cloth {
  readonly cols: number;
  readonly rows: number;
  /** xyz per particle, row-major from the top-left. */
  readonly positions: Float32Array;
  private readonly previous: Float32Array;
  /** 1 = fixed in place. */
  readonly pinned: Uint8Array;
  /** Pairs of particle indices. */
  private readonly links: Uint32Array;
  private readonly restLengths: Float32Array;
  private readonly damping: number;
  private readonly iterations: number;
  private readonly colliders: PlaneCollider[] = [];

  constructor(options: ClothOptions) {
    const { cols, rows, width, height, origin } = options;
    if (cols < 2 || rows < 2) throw new Error('Cloth needs at least 2×2 particles');
    this.cols = cols;
    this.rows = rows;
    this.damping = options.damping ?? 0.985;
    this.iterations = options.iterations ?? 12;
    const gather = options.gather ?? 0;
    const foldDepth = options.foldDepth ?? 0;

    const n = cols * rows;
    this.positions = new Float32Array(n * 3);
    this.pinned = new Uint8Array(n);
    const dx = width / (cols - 1);
    const dy = height / (rows - 1);
    const pinnedDx = dx * (1 - gather);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 3;
        // Seed the gathered shape: x as on the rod, z zig-zag so folds alternate in/out.
        this.positions[i] = origin[0] + c * pinnedDx;
        this.positions[i + 1] = origin[1] - r * dy;
        this.positions[i + 2] = origin[2] + (c % 2 === 0 ? 0 : foldDepth);
      }
    }
    for (let c = 0; c < cols; c++) this.pinned[c] = 1;
    this.previous = this.positions.slice();

    // Structural (neighbours), shear (diagonals) and bend (every second particle) links.
    const pairs: number[] = [];
    const rest: number[] = [];
    const link = (a: number, b: number, length: number): void => {
      pairs.push(a, b);
      rest.push(length);
    };
    const diag = Math.hypot(dx, dy);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (c + 1 < cols) link(i, i + 1, dx);
        if (r + 1 < rows) link(i, i + cols, dy);
        if (c + 1 < cols && r + 1 < rows) {
          link(i, i + cols + 1, diag);
          link(i + 1, i + cols, diag);
        }
        if (c + 2 < cols) link(i, i + 2, 2 * dx);
        if (r + 2 < rows) link(i, i + 2 * cols, 2 * dy);
      }
    }
    this.links = Uint32Array.from(pairs);
    this.restLengths = Float32Array.from(rest);
  }

  get particleCount(): number {
    return this.cols * this.rows;
  }

  addCollider(collider: PlaneCollider): void {
    this.colliders.push(collider);
  }

  /** Advances the simulation by `dt` seconds (use a fixed step, e.g. 1/60). */
  step(dt: number, forces: ClothForces): void {
    const p = this.positions;
    const prev = this.previous;
    const dt2 = dt * dt;
    const [gx, gy, gz] = forces.gravity;
    const [wx, wy, wz] = forces.wind;

    // 1. Verlet integration: x' = x + (x - x_prev) * damping + a * dt².
    for (let k = 0; k < this.particleCount; k++) {
      if (this.pinned[k]) continue;
      const i = k * 3;
      const gust = windGust(p[i], p[i + 1], forces.time);
      for (let a = 0; a < 3; a++) {
        const acc = (a === 0 ? gx : a === 1 ? gy : gz) + (a === 0 ? wx : a === 1 ? wy : wz) * gust;
        const x = p[i + a];
        p[i + a] = x + (x - prev[i + a]) * this.damping + acc * dt2;
        prev[i + a] = x;
      }
    }

    // 2. Satisfy distance constraints (Jakobsen relaxation) and colliders.
    for (let it = 0; it < this.iterations; it++) {
      this.relaxLinks();
      this.collide();
    }
  }

  private relaxLinks(): void {
    const p = this.positions;
    const links = this.links;
    for (let l = 0; l < this.restLengths.length; l++) {
      const a = links[2 * l];
      const b = links[2 * l + 1];
      const ia = a * 3;
      const ib = b * 3;
      const dx = p[ib] - p[ia];
      const dy = p[ib + 1] - p[ia + 1];
      const dz = p[ib + 2] - p[ia + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 1e-9) continue;
      const rest = this.restLengths[l];
      // Fabric resists stretching, but bends/compresses freely → only push apart when too long.
      if (dist <= rest) continue;
      const pa = this.pinned[a];
      const pb = this.pinned[b];
      if (pa && pb) continue;
      const diff = (dist - rest) / dist;
      const wa = pa ? 0 : pb ? 1 : 0.5;
      const wb = pb ? 0 : pa ? 1 : 0.5;
      p[ia] += dx * diff * wa;
      p[ia + 1] += dy * diff * wa;
      p[ia + 2] += dz * diff * wa;
      p[ib] -= dx * diff * wb;
      p[ib + 1] -= dy * diff * wb;
      p[ib + 2] -= dz * diff * wb;
    }
  }

  private collide(): void {
    if (this.colliders.length === 0) return;
    const p = this.positions;
    for (let k = 0; k < this.particleCount; k++) {
      if (this.pinned[k]) continue;
      const i = k * 3;
      for (const { normal, offset } of this.colliders) {
        const d = p[i] * normal[0] + p[i + 1] * normal[1] + p[i + 2] * normal[2] - offset;
        if (d < 0) {
          p[i] -= normal[0] * d;
          p[i + 1] -= normal[1] * d;
          p[i + 2] -= normal[2] * d;
        }
      }
    }
  }
}
