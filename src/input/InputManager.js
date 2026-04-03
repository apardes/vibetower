import { eventBus } from '../utils/EventBus.js';

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

    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  onMouseMove(e) {
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

    eventBus.emit('mousemove', { ...this.mouseWorld, screenX: e.clientX, screenY: e.clientY });
  }

  onMouseDown(e) {
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

  onMouseUp(e) {
    if (e.button === 1) this.middleDown = false;
    if (e.button === 0) {
      this.mouseDown = false;
      const world = this.renderer.screenToWorld(e.clientX, e.clientY);
      eventBus.emit('mouseup', { ...world, screenX: e.clientX, screenY: e.clientY });
    }
  }

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
}
