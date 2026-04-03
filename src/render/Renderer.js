import * as THREE from 'three';
import { CAMERA_VIEW_WIDTH, CAMERA_VIEW_HEIGHT, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX } from '../constants.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;

    // WebGL renderer
    this.webgl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.webgl.setPixelRatio(window.devicePixelRatio);
    this.webgl.setSize(window.innerWidth, window.innerHeight);

    // Scene
    this.scene = new THREE.Scene();

    // Orthographic camera
    const aspect = window.innerWidth / window.innerHeight;
    const halfW = CAMERA_VIEW_WIDTH / 2;
    const halfH = CAMERA_VIEW_HEIGHT / 2;
    this.camera = new THREE.OrthographicCamera(
      -halfW * aspect, halfW * aspect,
      halfH, -halfH,
      -100, 100
    );
    this.camera.position.set(20, 5, 10); // center on tower, slightly above ground
    this.zoom = 1;

    // Handle resize
    window.addEventListener('resize', () => this.onResize());

    // Render loop
    this.clock = new THREE.Clock();
    this.onUpdate = null; // callback for per-frame updates
    this.animate();
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.webgl.setSize(w, h);
    this.updateCameraFrustum();
  }

  setZoom(z) {
    this.zoom = Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, z));
    this.updateCameraFrustum();
  }

  updateCameraFrustum() {
    const aspect = window.innerWidth / window.innerHeight;
    const halfW = (CAMERA_VIEW_WIDTH / 2) * this.zoom;
    const halfH = (CAMERA_VIEW_HEIGHT / 2) * this.zoom;
    this.camera.left = -halfW * aspect;
    this.camera.right = halfW * aspect;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();
    if (this.onUpdate) this.onUpdate(delta);
    this.webgl.render(this.scene, this.camera);
  }

  // Convert screen coordinates to world coordinates
  screenToWorld(screenX, screenY) {
    const ndc = new THREE.Vector3(
      (screenX / window.innerWidth) * 2 - 1,
      -(screenY / window.innerHeight) * 2 + 1,
      0
    );
    ndc.unproject(this.camera);
    return { x: ndc.x, y: ndc.y };
  }
}
