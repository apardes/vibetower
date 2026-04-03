import { eventBus } from '../utils/EventBus.js';
import { clamp } from '../utils/helpers.js';
import { CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX, TOWER_MAX_WIDTH, TOWER_MAX_FLOORS } from '../constants.js';

export class CameraController {
  constructor(renderer) {
    this.renderer = renderer;
    this.camera = renderer.camera;

    eventBus.on('pan', ({ dx, dy }) => this.onPan(dx, dy));
    eventBus.on('zoom', ({ delta, screenX, screenY }) => this.onZoom(delta, screenX, screenY));
    eventBus.on('keydown', ({ code }) => this.onKey(code));
  }

  onPan(screenDx, screenDy) {
    // Convert screen pixels to world units based on current zoom
    const worldPerPixelX = (this.camera.right - this.camera.left) / window.innerWidth;
    const worldPerPixelY = (this.camera.top - this.camera.bottom) / window.innerHeight;

    this.camera.position.x -= screenDx * worldPerPixelX;
    this.camera.position.y += screenDy * worldPerPixelY;
    this.clampCamera();
  }

  onZoom(delta, screenX, screenY) {
    // Get world position under cursor before zoom
    const worldBefore = this.renderer.screenToWorld(screenX, screenY);

    const zoomSpeed = 0.001;
    const newZoom = this.renderer.zoom + delta * zoomSpeed;
    this.renderer.setZoom(newZoom);

    // Get world position under cursor after zoom
    const worldAfter = this.renderer.screenToWorld(screenX, screenY);

    // Shift camera so the same world point stays under the cursor
    this.camera.position.x += worldBefore.x - worldAfter.x;
    this.camera.position.y += worldBefore.y - worldAfter.y;

    this.clampCamera();
  }

  onKey(code) {
    const panAmount = 2;
    switch (code) {
      case 'ArrowLeft':  this.camera.position.x -= panAmount; break;
      case 'ArrowRight': this.camera.position.x += panAmount; break;
      case 'ArrowUp':    this.camera.position.y += panAmount; break;
      case 'ArrowDown':  this.camera.position.y -= panAmount; break;
      case 'Equal': case 'NumpadAdd':
        this.renderer.setZoom(this.renderer.zoom - 0.1); break;
      case 'Minus': case 'NumpadSubtract':
        this.renderer.setZoom(this.renderer.zoom + 0.1); break;
    }
    this.clampCamera();
  }

  clampCamera() {
    this.camera.position.x = clamp(this.camera.position.x, -5, TOWER_MAX_WIDTH + 5);
    this.camera.position.y = clamp(this.camera.position.y, -5, TOWER_MAX_FLOORS + 5);
  }
}
