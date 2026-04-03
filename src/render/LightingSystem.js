import * as THREE from 'three';

export class LightingSystem {
  constructor(scene) {
    this.scene = scene;
    this.nightFactor = 0;

    // Ambient — base fill for everything
    this.ambient = new THREE.AmbientLight('#ffffff', 0.6);
    scene.add(this.ambient);

    // Hemisphere — sky/ground shading for exterior elements (ground, building frame)
    this.hemi = new THREE.HemisphereLight('#ffffff', '#aaaaaa', 1.5);
    scene.add(this.hemi);

    // Directional — sun for exterior. Varies with time of day.
    this.sun = new THREE.DirectionalLight('#ffffff', 2.0);
    this.sun.position.set(20, 30, 10);
    scene.add(this.sun);
  }

  update(hour) {
    // Night factor
    if (hour >= 9 && hour < 16) {
      this.nightFactor = 0;
    } else if (hour >= 21 || hour < 4.5) {
      this.nightFactor = 1;
    } else if (hour >= 4.5 && hour < 9) {
      this.nightFactor = 1 - smoothstep((hour - 4.5) / 4.5);
    } else if (hour >= 16 && hour < 21) {
      this.nightFactor = smoothstep((hour - 16) / 5);
    }

    const nf = this.nightFactor;

    // Hemisphere — dims at night (affects ground/exterior only,
    // rooms use MeshBasicMaterial and ignore lighting)
    this.hemi.intensity = 0.6 + (1 - nf) * 0.9;

    // Directional sun — strong during day, faint at night
    this.sun.intensity = 0.3 + (1 - nf) * 1.7;
  }
}

function smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}
