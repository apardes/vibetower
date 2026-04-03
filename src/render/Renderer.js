import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CAMERA_VIEW_WIDTH, CAMERA_VIEW_HEIGHT, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX } from '../constants.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;

    // WebGL renderer
    this.webgl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.webgl.setPixelRatio(window.devicePixelRatio);
    this.webgl.setSize(window.innerWidth, window.innerHeight);
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.0;

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
    this.camera.position.set(500, 5, 10); // center of grid
    this.zoom = 1;

    // Post-processing
    this.composer = new EffectComposer(this.webgl);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.8,   // strength — moderate, consistent glow
      0.35,  // radius — tight halos
      0.5    // threshold — only emissive sources bloom
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

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
    this.composer.setSize(w, h);
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

  // Adjust bloom based on night factor (called from main.js onUpdate)
  setNightBloom(nightFactor) {
    // Subtle during day, slightly stronger at night — never extreme
    this.bloomPass.strength = 0.4 + nightFactor * 0.4;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();
    if (this.onUpdate) this.onUpdate(delta);
    this.composer.render();
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
