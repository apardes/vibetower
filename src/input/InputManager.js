import { eventBus } from '../utils/EventBus.js';

const TOUCH_DEAD_ZONE = 10; // pixels before a touch counts as a drag

export class InputManager {
  constructor(canvas, renderer) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.mouse = { x: 0, y: 0 };
    this.mouseWorld = { x: 0, y: 0 };
    this.mouseDown = false;
    this.middleDown = false;
    this.spaceDown = false;
    this.lastMouse = { x: 0, y: 0 };

    // Touch / multi-pointer state
    this.pointers = new Map();        // pointerId → { x, y }
    this.activeTool = null;           // tracked via toolChanged event
    this.touchStartPos = null;        // screen pos at first touch
    this.isTouchDragging = false;     // finger moved beyond dead zone
    this.gestureActive = false;       // two-finger gesture suppresses tap/click
    this.pinchStartDist = null;       // distance between two fingers at gesture start
    this.lastPinchMid = null;         // last midpoint for two-finger pan
    this.lastPointerType = 'mouse';   // track for tooltip suppression

    // Pointer events (unified mouse + touch + pen)
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Track active build tool so we know if single-finger drag = build or pan
    eventBus.on('toolChanged', (tool) => { this.activeTool = tool; });
  }

  // ── Pointer Events ──────────────────────────────────────────────

  onPointerDown(e) {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.lastPointerType = e.pointerType;

    if (e.pointerType === 'touch') {
      this._onTouchDown(e);
    } else {
      this._onMouseDown(e);
    }
  }

  onPointerMove(e) {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.lastPointerType = e.pointerType;

    if (e.pointerType === 'touch') {
      this._onTouchMove(e, prev);
    } else {
      this._onMouseMove(e);
    }
  }

  onPointerUp(e) {
    this.lastPointerType = e.pointerType;

    if (e.pointerType === 'touch') {
      this._onTouchUp(e);
    } else {
      this._onMouseUp(e);
    }

    this.pointers.delete(e.pointerId);

    // Reset gesture state when all fingers lifted
    if (this.pointers.size === 0) {
      this.gestureActive = false;
      this.pinchStartDist = null;
      this.lastPinchMid = null;
    }
  }

  // ── Mouse (identical to original behavior) ──────────────────────

  _onMouseMove(e) {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.mouseWorld = this.renderer.screenToWorld(e.clientX, e.clientY);

    // Pan with middle mouse or space+left
    if (this.middleDown || (this.mouseDown && this.spaceDown)) {
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      eventBus.emit('pan', { dx, dy });
    }

    this.lastMouse.x = e.clientX;
    this.lastMouse.y = e.clientY;

    eventBus.emit('mousemove', { ...this.mouseWorld, screenX: e.clientX, screenY: e.clientY, pointerType: 'mouse' });
  }

  _onMouseDown(e) {
    this.lastMouse.x = e.clientX;
    this.lastMouse.y = e.clientY;

    if (e.button === 1) {
      this.middleDown = true;
      return;
    }
    if (e.button === 0) {
      this.mouseDown = true;
      if (!this.spaceDown) {
        const world = this.renderer.screenToWorld(e.clientX, e.clientY);
        eventBus.emit('mousedown', { ...world, screenX: e.clientX, screenY: e.clientY });
        eventBus.emit('click', { ...world, screenX: e.clientX, screenY: e.clientY });
      }
    }
    if (e.button === 2) {
      eventBus.emit('rightclick', { ...this.mouseWorld });
    }
  }

  _onMouseUp(e) {
    if (e.button === 1) this.middleDown = false;
    if (e.button === 0) {
      this.mouseDown = false;
      const world = this.renderer.screenToWorld(e.clientX, e.clientY);
      eventBus.emit('mouseup', { ...world, screenX: e.clientX, screenY: e.clientY });
    }
  }

  // ── Touch ───────────────────────────────────────────────────────

  _onTouchDown(e) {
    if (this.pointers.size === 1) {
      // First finger — record start position
      this.touchStartPos = { x: e.clientX, y: e.clientY };
      this.isTouchDragging = false;

      // Emit mousedown immediately (harmless for non-elevator tools,
      // needed for elevator drag start tracking in BuildTool)
      const world = this.renderer.screenToWorld(e.clientX, e.clientY);
      eventBus.emit('mousedown', { ...world, screenX: e.clientX, screenY: e.clientY });

      // Also emit mousemove so BuildTool shows preview at touch point
      eventBus.emit('mousemove', { ...world, screenX: e.clientX, screenY: e.clientY, pointerType: 'touch' });

    } else if (this.pointers.size === 2) {
      // Second finger — start two-finger gesture, suppress single-finger events
      this.gestureActive = true;
      this.isTouchDragging = false;

      const pts = [...this.pointers.values()];
      this.pinchStartDist = this._dist(pts[0], pts[1]);
      this.lastPinchMid = this._midpoint(pts[0], pts[1]);
    }
  }

  _onTouchMove(e, prev) {
    if (this.pointers.size >= 2) {
      // Two-finger gesture: pinch-zoom + pan
      const pts = [...this.pointers.values()];
      if (pts.length < 2) return;

      const newDist = this._dist(pts[0], pts[1]);
      const newMid = this._midpoint(pts[0], pts[1]);

      // Pinch zoom
      if (this.pinchStartDist !== null) {
        const delta = (this.pinchStartDist - newDist) * 2; // scale factor for sensitivity
        eventBus.emit('zoom', { delta, screenX: newMid.x, screenY: newMid.y });
        this.pinchStartDist = newDist;
      }

      // Two-finger pan
      if (this.lastPinchMid) {
        const dx = newMid.x - this.lastPinchMid.x;
        const dy = newMid.y - this.lastPinchMid.y;
        eventBus.emit('pan', { dx, dy });
      }
      this.lastPinchMid = newMid;
      return;
    }

    // Single finger
    if (this.gestureActive) return; // was part of a two-finger gesture, ignore

    if (!this.isTouchDragging && this.touchStartPos) {
      const dx = e.clientX - this.touchStartPos.x;
      const dy = e.clientY - this.touchStartPos.y;
      if (Math.sqrt(dx * dx + dy * dy) < TOUCH_DEAD_ZONE) return;
      this.isTouchDragging = true;
    }

    if (this.isTouchDragging) {
      const hasBuildTool = this.activeTool && this.activeTool !== 'bulldoze';

      if (hasBuildTool) {
        // Building mode: single-finger drag = build interaction (elevator drag, preview update)
        const world = this.renderer.screenToWorld(e.clientX, e.clientY);
        eventBus.emit('mousemove', { ...world, screenX: e.clientX, screenY: e.clientY, pointerType: 'touch' });
      } else {
        // No tool: single-finger drag = pan
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        eventBus.emit('pan', { dx, dy });
      }
    }
  }

  _onTouchUp(e) {
    if (this.gestureActive) {
      // Finger lifting from a two-finger gesture — don't emit click/mouseup
      return;
    }

    const world = this.renderer.screenToWorld(e.clientX, e.clientY);

    if (!this.isTouchDragging) {
      // Tap (finger didn't move beyond dead zone)
      eventBus.emit('click', { ...world, screenX: e.clientX, screenY: e.clientY });
      eventBus.emit('mouseup', { ...world, screenX: e.clientX, screenY: e.clientY });
    } else {
      // Drag ended — emit mouseup for elevator completion
      eventBus.emit('mouseup', { ...world, screenX: e.clientX, screenY: e.clientY });
    }

    this.isTouchDragging = false;
    this.touchStartPos = null;
  }

  // ── Shared (wheel, keyboard) ────────────────────────────────────

  onWheel(e) {
    e.preventDefault();
    eventBus.emit('zoom', { delta: e.deltaY, screenX: e.clientX, screenY: e.clientY });
  }

  onKeyDown(e) {
    if (e.code === 'Space') {
      this.spaceDown = true;
      e.preventDefault();
    }
    eventBus.emit('keydown', { key: e.key, code: e.code });
  }

  onKeyUp(e) {
    if (e.code === 'Space') this.spaceDown = false;
    eventBus.emit('keyup', { key: e.key, code: e.code });
  }

  // ── Helpers ─────────────────────────────────────────────────────

  _dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
}
