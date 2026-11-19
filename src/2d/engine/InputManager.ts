export interface ViewerState {
  /** Horizontal camera/viewer position in [-1, 1] (-1 = left, 1 = right). */
  x: number;
  /** Vertical camera/viewer position in [-1, 1] (-1 = up, 1 = down). */
  y: number;
  /** Current smoothed zoom multiplier in [MIN_ZOOM, MAX_ZOOM]. */
  zoom: number;
}

export const MIN_ZOOM = 0.8;
export const MAX_ZOOM = 2.4;
export const DEFAULT_ZOOM = 1.0;

const KEY_PAN_SPEED = 1.6;
const KEY_ZOOM_SPEED = 1.1;
const WHEEL_ZOOM_STEP = 0.12;

interface TouchPoint {
  x: number;
  y: number;
}

/**
 * Tracks 2D camera offset in [-1, 1] and zoom factor from mouse/pointer, touch drag,
 * two-finger pinch-to-zoom, scroll wheel, keyboard (Arrows / WASD / + / - / 0),
 * and mobile gyroscope, smoothing movement each frame.
 */
export class InputManager {
  private readonly host: HTMLElement;
  private readonly reducedMotion: boolean;
  private readonly pressedKeys = new Set<string>();
  private readonly activeTouches = new Map<number, TouchPoint>();

  private lastPinchDistance: number | null = null;
  private lastTouchPos: TouchPoint | null = null;

  private targetX = 0;
  private targetY = 0;
  private currentX = 0;
  private currentY = 0;
  private targetZoom = DEFAULT_ZOOM;
  private currentZoom = DEFAULT_ZOOM;

  public constructor(host: HTMLElement, reducedMotion = false) {
    this.host = host;
    this.reducedMotion = reducedMotion;

    window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerup', this.onPointerUp, { passive: true });
    window.addEventListener('pointercancel', this.onPointerUp, { passive: true });
    window.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('deviceorientation', this.onDeviceOrientation, { passive: true });
    this.host.addEventListener('wheel', this.onWheel, { passive: false });
  }

  public zoomBy(delta: number): void {
    this.targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.targetZoom + delta));
  }

  public resetZoom(): void {
    this.targetZoom = DEFAULT_ZOOM;
  }

  public update(deltaSeconds: number): ViewerState {
    const dt = Math.min(0.1, deltaSeconds);

    // Keyboard zoom (+ / - / =)
    let zoomDir = 0;
    if (this.pressedKeys.has('Equal') || this.pressedKeys.has('NumpadAdd')) zoomDir += 1;
    if (this.pressedKeys.has('Minus') || this.pressedKeys.has('NumpadSubtract')) zoomDir -= 1;
    if (zoomDir !== 0) {
      this.zoomBy(zoomDir * KEY_ZOOM_SPEED * dt);
    }

    const smoothing = this.reducedMotion ? 1 : 1 - Math.exp(-8 * dt);
    this.currentZoom += (this.targetZoom - this.currentZoom) * smoothing;

    if (this.reducedMotion) {
      this.currentX = 0;
      this.currentY = 0;
      return { x: 0, y: 0, zoom: this.currentZoom };
    }

    // Keyboard panning (Arrows / WASD)
    let keyDx = 0;
    let keyDy = 0;
    if (this.pressedKeys.has('ArrowLeft') || this.pressedKeys.has('KeyA')) keyDx -= 1;
    if (this.pressedKeys.has('ArrowRight') || this.pressedKeys.has('KeyD')) keyDx += 1;
    if (this.pressedKeys.has('ArrowUp') || this.pressedKeys.has('KeyW')) keyDy -= 1;
    if (this.pressedKeys.has('ArrowDown') || this.pressedKeys.has('KeyS')) keyDy += 1;

    if (keyDx !== 0 || keyDy !== 0) {
      this.targetX = Math.max(-1, Math.min(1, this.targetX + keyDx * KEY_PAN_SPEED * dt));
      this.targetY = Math.max(-1, Math.min(1, this.targetY + keyDy * KEY_PAN_SPEED * dt));
    }

    this.currentX += (this.targetX - this.currentX) * smoothing;
    this.currentY += (this.targetY - this.currentY) * smoothing;

    return { x: this.currentX, y: this.currentY, zoom: this.currentZoom };
  }

  public destroy(): void {
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('deviceorientation', this.onDeviceOrientation);
    this.host.removeEventListener('wheel', this.onWheel);
  }

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (event.deltaY === 0) return;
    const step = -Math.sign(event.deltaY) * WHEEL_ZOOM_STEP;
    this.zoomBy(step);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') {
      this.activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.activeTouches.size === 1) {
        this.lastTouchPos = { x: event.clientX, y: event.clientY };
        this.lastPinchDistance = null;
      } else if (this.activeTouches.size === 2) {
        this.lastPinchDistance = this.getPinchDistance();
      }
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') {
      if (!this.activeTouches.has(event.pointerId)) return;
      this.activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });

      // Two-finger pinch-to-zoom on mobile
      if (this.activeTouches.size === 2) {
        const dist = this.getPinchDistance();
        if (dist !== null && this.lastPinchDistance !== null && this.lastPinchDistance > 0) {
          const scaleRatio = dist / this.lastPinchDistance;
          this.targetZoom = Math.max(
            MIN_ZOOM,
            Math.min(MAX_ZOOM, this.targetZoom * scaleRatio),
          );
        }
        this.lastPinchDistance = dist;
        return;
      }

      // Single-finger drag panning on mobile
      if (this.activeTouches.size === 1 && !this.reducedMotion) {
        const rect = this.host.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && this.lastTouchPos) {
          const dx = ((event.clientX - this.lastTouchPos.x) / rect.width) * 2.2;
          const dy = ((event.clientY - this.lastTouchPos.y) / rect.height) * 2.2;
          this.targetX = Math.max(-1, Math.min(1, this.targetX + dx));
          this.targetY = Math.max(-1, Math.min(1, this.targetY + dy));
        }
        this.lastTouchPos = { x: event.clientX, y: event.clientY };
      }
      return;
    }

    // Desktop mouse hover parallax
    if (this.reducedMotion) return;
    const rect = this.host.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    this.targetX = Math.max(-1, Math.min(1, nx));
    this.targetY = Math.max(-1, Math.min(1, ny));
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') {
      this.activeTouches.delete(event.pointerId);
      if (this.activeTouches.size < 2) {
        this.lastPinchDistance = null;
      }
      if (this.activeTouches.size === 1) {
        const remaining = this.activeTouches.values().next().value;
        this.lastTouchPos = remaining ? { x: remaining.x, y: remaining.y } : null;
      } else if (this.activeTouches.size === 0) {
        this.lastTouchPos = null;
      }
    }
  };

  private readonly onPointerLeave = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') {
      this.targetX = 0;
      this.targetY = 0;
    }
  };

  private getPinchDistance(): number | null {
    if (this.activeTouches.size < 2) return null;
    const pts = Array.from(this.activeTouches.values());
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    return Math.hypot(dx, dy);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Digit0' || event.code === 'Numpad0') {
      this.resetZoom();
      return;
    }
    this.pressedKeys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code);
  };

  private readonly onDeviceOrientation = (event: DeviceOrientationEvent): void => {
    if (
      this.reducedMotion ||
      this.activeTouches.size > 0 ||
      event.gamma === null ||
      event.beta === null
    ) {
      return;
    }
    this.targetX = Math.max(-1, Math.min(1, event.gamma / 30));
    this.targetY = Math.max(-1, Math.min(1, (event.beta - 45) / 30));
  };
}
