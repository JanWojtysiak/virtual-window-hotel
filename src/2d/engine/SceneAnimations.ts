import { Container, Graphics } from 'pixi.js';
import type { RoomId } from '../views';

export type AnimationUpdater = (deltaSeconds: number) => void;

/**
 * Attaches procedural PixiJS animations to the layer containers (in 1920×1080 scene space)
 * for the given `roomId` and returns a per-frame update callback.
 */
export function attachSceneAnimations(
  roomId: RoomId,
  layerContainers: Container[],
): AnimationUpdater {
  switch (roomId) {
    case 'city':
      return createCityAnimations(layerContainers);
    case 'apartment':
      return createApartmentAnimations(layerContainers);
    case 'garden':
      return createGardenAnimations(layerContainers);
  }
}

// ============================================================================
// 1. CITY ANIMATIONS (cars, tram, neon sign pulse, aviation beacon)
// ============================================================================

interface VehicleSpec {
  container: Container;
  x: number;
  y: number;
  speed: number; // px/s (positive = right, negative = left)
  minX: number;
  maxX: number;
  bobPhase: number;
}

function buildCarGraphic(bodyColor: number, facingRight: boolean, isTaxi = false): Container {
  const root = new Container();
  const dir = facingRight ? 1 : -1;

  // Headlight & taillight glows
  const lights = new Graphics();
  // Headlight beam ahead of the car
  lights
    .ellipse(dir * 105, -14, 58, 9)
    .fill({ color: 0xfff5c8, alpha: 0.55 })
    .ellipse(dir * 74, -14, 18, 5)
    .fill({ color: 0xffffe0, alpha: 0.9 });
  // Red taillight glow behind the car
  lights
    .ellipse(-dir * 82, -16, 26, 6)
    .fill({ color: 0xff3b3b, alpha: 0.75 });
  root.addChild(lights);

  // Car body
  const car = new Graphics();
  car
    .moveTo(-70, 0)
    .lineTo(-66, -24)
    .lineTo(-36, -28)
    .lineTo(-20, -48)
    .lineTo(30, -48)
    .lineTo(50, -28)
    .lineTo(70, -24)
    .lineTo(72, 0)
    .closePath()
    .fill(bodyColor);

  // Side windows
  car
    .moveTo(-14, -44)
    .lineTo(26, -44)
    .lineTo(40, -30)
    .lineTo(-28, -30)
    .closePath()
    .fill({ color: 0x9ab0cf, alpha: 0.7 });

  if (isTaxi) {
    // Glowing TAXI roof sign
    car
      .roundRect(-8, -56, 22, 8, 2)
      .fill(0xfff3a8);
  }

  // Wheels
  car
    .circle(-40, 0, 12)
    .fill(0x111115)
    .circle(-40, 0, 5)
    .fill(0x666a75)
    .circle(42, 0, 12)
    .fill(0x111115)
    .circle(42, 0, 5)
    .fill(0x666a75);

  car.scale.x = dir;
  root.addChild(car);

  return root;
}

function buildTramGraphic(): Container {
  const tram = new Container();

  const g = new Graphics();
  // Headlight glow (moving left)
  g.ellipse(-225, -24, 65, 12).fill({ color: 0xfff4c2, alpha: 0.65 });
  // Taillight glow
  g.ellipse(198, -24, 24, 7).fill({ color: 0xff3b3b, alpha: 0.7 });

  // Main body
  g.roundRect(-180, -80, 360, 80, 14).fill(0xe6b422);
  // Illuminated passenger windows
  g.roundRect(-170, -70, 340, 34, 4).fill({ color: 0xffeaa0, alpha: 0.9 });
  // Window dividers
  g.rect(-92, -70, 4, 34)
    .fill(0x7a5d10)
    .rect(-2, -70, 4, 34)
    .fill(0x7a5d10)
    .rect(88, -70, 4, 34)
    .fill(0x7a5d10);
  // Lower trim stripe
  g.rect(-180, -22, 360, 8).fill(0xb88a12);
  // Pantograph reaching up to the wire at y = 826 (since tram is at y = 946, -120 reaches 826)
  g.moveTo(0, -80)
    .lineTo(-28, -100)
    .lineTo(0, -120)
    .lineTo(28, -100)
    .lineTo(0, -80)
    .stroke({ color: 0x222228, width: 3 });

  tram.addChild(g);
  return tram;
}

function createCityAnimations(layerContainers: Container[]): AnimationUpdater {
  const midLayer = layerContainers[2];
  const nearLayer = layerContainers[3];
  if (!nearLayer) return () => {};

  // Blinking aviation beacon on top of skyscraper in midLayer (1220, 158)
  const beaconGlow = new Graphics();
  if (midLayer) {
    beaconGlow
      .circle(1220, 158, 14)
      .fill({ color: 0xff3b3b, alpha: 0.45 })
      .circle(1220, 158, 6)
      .fill(0xff7777);
    midLayer.addChild(beaconGlow);
  }

  // Pulsing neon glow over the HOTEL sign on nearLayer
  const neonPulse = new Graphics()
    .roundRect(884, 556, 168, 54, 10)
    .stroke({ color: 0xff4fa3, width: 6, alpha: 0.55 });
  nearLayer.addChild(neonPulse);

  // Vehicles on the street
  const vehicles: VehicleSpec[] = [];

  // 1. Tram moving left along the upper track (y = 946)
  const tram = buildTramGraphic();
  tram.position.set(1500, 946);
  nearLayer.addChild(tram);
  vehicles.push({
    container: tram,
    x: 1500,
    y: 946,
    speed: -115,
    minX: -420,
    maxX: 2340,
    bobPhase: 0,
  });

  // 2. Red car driving right (upper lane, y = 958)
  const redCar = buildCarGraphic(0xc0392b, true, false);
  redCar.position.set(420, 958);
  nearLayer.addChild(redCar);
  vehicles.push({
    container: redCar,
    x: 420,
    y: 958,
    speed: 195,
    minX: -260,
    maxX: 2220,
    bobPhase: 1.2,
  });

  // 3. Blue car driving right (upper lane, y = 958)
  const blueCar = buildCarGraphic(0x2c82c9, true, false);
  blueCar.position.set(-180, 958);
  nearLayer.addChild(blueCar);
  vehicles.push({
    container: blueCar,
    x: -180,
    y: 958,
    speed: 165,
    minX: -260,
    maxX: 2220,
    bobPhase: 3.1,
  });

  // 4. Silver car driving left (lower foreground lane, y = 1042)
  const silverCar = buildCarGraphic(0xd8d8de, false, false);
  silverCar.scale.set(1.15);
  silverCar.position.set(1250, 1042);
  nearLayer.addChild(silverCar);
  vehicles.push({
    container: silverCar,
    x: 1250,
    y: 1042,
    speed: -230,
    minX: -280,
    maxX: 2260,
    bobPhase: 2.0,
  });

  // 5. Yellow taxi driving left (lower foreground lane, y = 1042)
  const taxiCar = buildCarGraphic(0xe8b923, false, true);
  taxiCar.scale.set(1.15);
  taxiCar.position.set(2100, 1042);
  nearLayer.addChild(taxiCar);
  vehicles.push({
    container: taxiCar,
    x: 2100,
    y: 1042,
    speed: -205,
    minX: -280,
    maxX: 2260,
    bobPhase: 4.5,
  });

  let elapsed = 0;
  return (dt: number) => {
    elapsed += dt;

    // Blink skyscraper beacon & pulse neon sign
    beaconGlow.alpha = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(elapsed * 4.2));
    neonPulse.alpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(elapsed * 2.6));

    // Move vehicles
    for (const v of vehicles) {
      v.x += v.speed * dt;
      if (v.speed > 0 && v.x > v.maxX) {
        v.x = v.minX;
      } else if (v.speed < 0 && v.x < v.minX) {
        v.x = v.maxX;
      }
      const suspensionBob = Math.sin(elapsed * 12 + v.bobPhase) * 0.8;
      v.container.position.set(v.x, v.y + suspensionBob);
    }
  };
}

// ============================================================================
// 2. APARTMENT ANIMATIONS (aquarium fish & bubbles, robot vacuum, coffee steam, outdoor birds)
// ============================================================================

interface FishState {
  root: Container;
  tail: Graphics;
  x: number;
  baseY: number;
  vx: number;
  minX: number;
  maxX: number;
  phase: number;
  scale: number;
}

interface BubbleState {
  graphic: Graphics;
  baseX: number;
  y: number;
  speed: number;
  phase: number;
}

function createFish(bodyColor: number, rx: number, ry: number): { root: Container; tail: Graphics } {
  const root = new Container();

  const tail = new Graphics()
    .moveTo(-rx + 3, 0)
    .lineTo(-rx - rx * 0.75, -ry * 0.85)
    .lineTo(-rx - rx * 0.75, ry * 0.85)
    .closePath()
    .fill(bodyColor);

  const body = new Graphics()
    .ellipse(0, 0, rx, ry)
    .fill(bodyColor)
    .circle(rx * 0.48, -ry * 0.2, 2.1)
    .fill(0x141820);

  root.addChild(tail, body);
  return { root, tail };
}

function createApartmentAnimations(layerContainers: Container[]): AnimationUpdater {
  const farLayer = layerContainers[1];
  const midLayer = layerContainers[2];
  const frontLayer = layerContainers[4];

  // --- A. Outdoor birds flying past the window (farLayer) ---
  const outdoorBirds: { g: Graphics; x: number; baseY: number; speed: number; phase: number }[] = [];
  if (farLayer) {
    for (let i = 0; i < 3; i++) {
      const bird = new Graphics();
      const x = 680 + i * 190;
      const baseY = 250 + i * 38;
      bird.position.set(x, baseY);
      farLayer.addChild(bird);
      outdoorBirds.push({ g: bird, x, baseY, speed: 36 + i * 7, phase: i * 1.7 });
    }
  }

  // --- B. Aquarium fish & bubbles (midLayer, tank top-left at 1520, 560) ---
  const tankContainer = new Container();
  tankContainer.position.set(1520, 560);
  if (midLayer) {
    midLayer.addChild(tankContainer);
  }

  // Bubbles rising in the aquarium
  const bubbles: BubbleState[] = [];
  const bubbleXs = [45, 62, 148, 245, 258];
  for (let i = 0; i < bubbleXs.length; i++) {
    const b = new Graphics()
      .circle(0, 0, 2.5 + (i % 2))
      .stroke({ color: 0xffffff, width: 1.5, alpha: 0.65 })
      .circle(-0.8, -0.8, 0.9)
      .fill({ color: 0xffffff, alpha: 0.7 });
    const startY = 20 + ((i * 19) % 72);
    b.position.set(bubbleXs[i], startY);
    tankContainer.addChild(b);
    bubbles.push({
      graphic: b,
      baseX: bubbleXs[i],
      y: startY,
      speed: 22 + (i % 3) * 8,
      phase: i * 1.3,
    });
  }

  // 3 Fish inside the aquarium (tank inner width 0..300, water depth 12..94)
  const fishes: FishState[] = [];
  const fishSpecs = [
    { color: 0xff8a2a, rx: 16, ry: 9, x: 95, y: 46, vx: 34, phase: 0 },
    { color: 0xffd23a, rx: 13, ry: 7.5, x: 210, y: 70, vx: -28, phase: 2.1 },
    { color: 0x3ab0ff, rx: 11, ry: 6.5, x: 155, y: 30, vx: 42, phase: 4.2 },
  ];

  for (const spec of fishSpecs) {
    const { root, tail } = createFish(spec.color, spec.rx, spec.ry);
    root.position.set(spec.x, spec.y);
    root.scale.x = Math.sign(spec.vx);
    tankContainer.addChild(root);
    fishes.push({
      root,
      tail,
      x: spec.x,
      baseY: spec.y,
      vx: spec.vx,
      minX: 34,
      maxX: 266,
      phase: spec.phase,
      scale: 1,
    });
  }

  // --- C. Robot vacuum & coffee steam (frontLayer) ---
  const robotContainer = new Container();
  const robotLed = new Graphics();
  const steamWisps: { g: Graphics; phase: number; offsetX: number }[] = [];

  if (frontLayer) {
    // Robot vacuum body matching SVG artwork
    const body = new Graphics()
      .ellipse(0, 14, 92, 13)
      .fill({ color: 0x000000, alpha: 0.26 })
      .ellipse(0, 0, 90, 26)
      .fill(0x2b2d33)
      .ellipse(0, -8, 86, 22)
      .fill(0x3a3d45)
      .ellipse(0, -12, 26, 8)
      .fill(0x1e2026);

    robotLed
      .circle(40, -8, 6)
      .fill({ color: 0x33e07a, alpha: 0.35 })
      .circle(40, -8, 3.8)
      .fill(0x33e07a);

    robotContainer.addChild(body, robotLed);
    robotContainer.position.set(300, 1010);
    frontLayer.addChild(robotContainer);

    // Coffee mug steam wisps above (840, 910)
    for (let i = 0; i < 3; i++) {
      const wisp = new Graphics()
        .moveTo(0, 0)
        .bezierCurveTo(-5, -8, 5, -16, 0, -24)
        .stroke({ color: 0xffffff, width: 2.5, alpha: 0.55 });
      frontLayer.addChild(wisp);
      steamWisps.push({ g: wisp, phase: i * 2.1, offsetX: (i - 1) * 8 });
    }
  }

  let robotX = 300;
  let robotVx = 58;
  let elapsed = 0;

  return (dt: number) => {
    elapsed += dt;

    // 1. Update outdoor birds
    for (const b of outdoorBirds) {
      b.x += b.speed * dt;
      if (b.x > 1420) b.x = 480;
      const flap = Math.sin(elapsed * 8 + b.phase) * 5;
      const y = b.baseY + Math.sin(elapsed * 2 + b.phase) * 6;
      b.g
        .clear()
        .moveTo(-10, flap)
        .quadraticCurveTo(-5, -3, 0, 0)
        .quadraticCurveTo(5, -3, 10, flap)
        .stroke({ color: 0x2c4a63, width: 2.2 });
      b.g.position.set(b.x, y);
    }

    // 2. Update aquarium bubbles
    for (const b of bubbles) {
      b.y -= b.speed * dt;
      if (b.y < 10) {
        b.y = 94;
      }
      const wobbleX = b.baseX + Math.sin(elapsed * 4 + b.phase) * 3.5;
      b.graphic.position.set(wobbleX, b.y);
    }

    // 3. Update swimming fish
    for (const f of fishes) {
      f.x += f.vx * dt;
      if (f.x > f.maxX) {
        f.x = f.maxX;
        f.vx = -Math.abs(f.vx);
      } else if (f.x < f.minX) {
        f.x = f.minX;
        f.vx = Math.abs(f.vx);
      }
      const targetScaleX = Math.sign(f.vx);
      f.scale += (targetScaleX - f.scale) * Math.min(1, dt * 10);
      const bobY = f.baseY + Math.sin(elapsed * 3.2 + f.phase) * 4.5;
      f.root.position.set(f.x, bobY);
      f.root.scale.x = Math.abs(f.scale) < 0.15 ? 0.15 * targetScaleX : f.scale;
      f.tail.rotation = Math.sin(elapsed * 11 + f.phase) * 0.28;
    }

    // 4. Update robot vacuum
    robotX += robotVx * dt;
    if (robotX > 590) {
      robotX = 590;
      robotVx = -Math.abs(robotVx);
    } else if (robotX < 180) {
      robotX = 180;
      robotVx = Math.abs(robotVx);
    }
    const robotY = 1010 + Math.sin(robotX * 0.04) * 4;
    robotContainer.position.set(robotX, robotY);
    robotLed.alpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(elapsed * 5));

    // 5. Update coffee mug steam
    for (const w of steamWisps) {
      const cycle = ((elapsed * 0.6 + w.phase) % 1 + 1) % 1; // 0..1
      w.g.position.set(840 + w.offsetX + Math.sin(elapsed * 2 + w.phase) * 3, 908 - cycle * 26);
      w.g.alpha = Math.sin(cycle * Math.PI) * 0.65;
    }
  };
}

// ============================================================================
// 3. GARDEN ANIMATIONS (fountain water jets & ripples, butterflies, birds)
// ============================================================================

interface Droplet {
  g: Graphics;
  t: number;
  speed: number;
  dirX: number;
  peakY: number;
}

interface Butterfly {
  root: Container;
  leftWing: Graphics;
  rightWing: Graphics;
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  phase: number;
  speed: number;
}

function createGardenAnimations(layerContainers: Container[]): AnimationUpdater {
  const farLayer = layerContainers[1];
  const midLayer = layerContainers[2];

  // --- A. Distant birds gliding over the hills (farLayer) ---
  const birds: { g: Graphics; x: number; baseY: number; speed: number; phase: number }[] = [];
  if (farLayer) {
    for (let i = 0; i < 5; i++) {
      const g = new Graphics();
      const x = 220 + i * 75;
      const baseY = 230 + Math.abs(i - 2) * 18;
      farLayer.addChild(g);
      birds.push({ g, x, baseY, speed: 48, phase: i * 0.9 });
    }
  }

  // --- B. Fountain water arcs, droplets & ripples (midLayer, spout at 960, 650, basin at 960, 736) ---
  const ripples: { g: Graphics; phase: number }[] = [];
  const droplets: Droplet[] = [];
  const waterStreams = new Graphics();

  // --- C. Butterflies fluttering over flower beds ---
  const butterflies: Butterfly[] = [];

  if (midLayer) {
    //Expanding water ripples in the basin (960, 736)
    for (let i = 0; i < 3; i++) {
      const r = new Graphics();
      midLayer.addChild(r);
      ripples.push({ g: r, phase: i / 3 });
    }

    midLayer.addChild(waterStreams);

    // Sparkling water droplets shooting out of the fountain
    const dirs = [-58, -36, -18, 0, 18, 36, 58, -46, 46, -24, 24, 0];
    for (let i = 0; i < dirs.length; i++) {
      const d = new Graphics().circle(0, 0, 3.2).fill({ color: 0xeaf8ff, alpha: 0.9 });
      midLayer.addChild(d);
      droplets.push({
        g: d,
        t: (i / dirs.length) % 1,
        speed: 0.85 + (i % 3) * 0.15,
        dirX: dirs[i],
        peakY: 54 + (i % 2) * 12,
      });
    }

    // Butterflies near the flower beds
    const butterflySpecs = [
      { cx: 700, cy: 790, rx: 55, ry: 22, color: 0xffb347, phase: 0, speed: 1.4 },
      { cx: 1230, cy: 800, rx: 50, ry: 20, color: 0xff6b9d, phase: 2.0, speed: 1.6 },
      { cx: 220, cy: 880, rx: 65, ry: 26, color: 0x70d6ff, phase: 4.1, speed: 1.3 },
    ];

    for (const spec of butterflySpecs) {
      const root = new Container();
      const leftWing = new Graphics()
        .ellipse(-6, -2, 7, 5)
        .fill(spec.color)
        .ellipse(-5, 4, 5, 4)
        .fill(spec.color);
      const rightWing = new Graphics()
        .ellipse(6, -2, 7, 5)
        .fill(spec.color)
        .ellipse(5, 4, 5, 4)
        .fill(spec.color);
      const body = new Graphics().roundRect(-1.2, -5, 2.4, 10, 1).fill(0x2b2623);
      root.addChild(leftWing, rightWing, body);
      midLayer.addChild(root);
      butterflies.push({
        root,
        leftWing,
        rightWing,
        centerX: spec.cx,
        centerY: spec.cy,
        radiusX: spec.rx,
        radiusY: spec.ry,
        phase: spec.phase,
        speed: spec.speed,
      });
    }
  }

  let elapsed = 0;
  return (dt: number) => {
    elapsed += dt;

    // 1. Distant birds
    for (const b of birds) {
      b.x += b.speed * dt;
      if (b.x > 2050) b.x = -120;
      const flap = Math.sin(elapsed * 7 + b.phase) * 5.5;
      const y = b.baseY + Math.sin(elapsed * 1.8 + b.phase) * 8;
      b.g
        .clear()
        .moveTo(-11, flap)
        .quadraticCurveTo(-5, -3, 0, 0)
        .quadraticCurveTo(5, -3, 11, flap)
        .stroke({ color: 0x2d4c63, width: 2.2 });
      b.g.position.set(b.x, y);
    }

    // 2. Fountain continuous water streams (shimmering)
    const jetHeight = 594 + Math.sin(elapsed * 6) * 4;
    waterStreams
      .clear()
      .moveTo(960, 652)
      .lineTo(960, jetHeight)
      .moveTo(960, 598)
      .bezierCurveTo(940, 616, 924, 638, 916, 662)
      .moveTo(960, 598)
      .bezierCurveTo(980, 616, 996, 638, 1004, 662)
      .moveTo(920, 662)
      .bezierCurveTo(902, 688, 892, 712, 888, 734)
      .moveTo(1000, 662)
      .bezierCurveTo(1018, 688, 1028, 712, 1032, 734)
      .stroke({ color: 0xe8f6ff, width: 4.5, alpha: 0.78 });

    // 3. Fountain water droplets along parabolic arcs
    for (const d of droplets) {
      d.t = (d.t + d.speed * dt) % 1;
      const x = 960 + d.dirX * d.t;
      // Parabola from spout (y=650) up to peak and down into basin (y=732)
      const y = 650 - 4 * d.peakY * d.t * (1 - d.t) + 82 * d.t * d.t;
      d.g.position.set(x, y);
      d.g.alpha = Math.sin(d.t * Math.PI) * 0.95;
    }

    // 4. Fountain water ripples
    for (const r of ripples) {
      const p = (elapsed * 0.55 + r.phase) % 1;
      const rx = 25 + p * 115;
      const ry = 5 + p * 20;
      r.g
        .clear()
        .ellipse(960, 736, rx, ry)
        .stroke({ color: 0xffffff, width: 2, alpha: (1 - p) * 0.55 });
    }

    // 5. Fluttering butterflies
    for (const bf of butterflies) {
      const t = elapsed * bf.speed + bf.phase;
      const x = bf.centerX + Math.sin(t) * bf.radiusX;
      const y = bf.centerY + Math.sin(t * 2) * bf.radiusY;
      bf.root.position.set(x, y);
      const wingFlap = 0.25 + 0.75 * Math.abs(Math.sin(elapsed * 16 + bf.phase));
      bf.leftWing.scale.x = wingFlap;
      bf.rightWing.scale.x = wingFlap;
    }
  };
}
