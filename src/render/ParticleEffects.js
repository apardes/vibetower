import * as THREE from 'three';
import { eventBus } from '../utils/EventBus.js';

export class ParticleEffects {
  constructor(scene) {
    this.scene = scene;
    this.effects = []; // active one-shot effects
    this.steamEmitters = new Map(); // roomId -> emitter data

    // Listen for room placement (construction sparkle)
    eventBus.on('roomPlaced', (room) => this.spawnConstructionSparkle(room));
    eventBus.on('roomRemoved', (roomId) => this.steamEmitters.delete(roomId));
  }

  spawnConstructionSparkle(room) {
    const count = 15;
    const positions = new Float32Array(count * 3);
    const velocities = [];

    const cx = room.gridX + room.width / 2;
    const cy = room.gridY + room.height / 2;

    for (let i = 0; i < count; i++) {
      positions[i * 3] = cx;
      positions[i * 3 + 1] = cy;
      positions[i * 3 + 2] = 0.4;
      velocities.push({
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 2 + 0.5,
        vz: 0,
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: '#ffdd44',
      size: 0.12,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      sizeAttenuation: false,
    });

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    this.effects.push({
      points,
      velocities,
      elapsed: 0,
      duration: 0.6,
      count,
    });
  }

  // Register a restaurant for steam effect
  addSteamEmitter(room) {
    if (room.type !== 'restaurant') return;

    const count = 8;
    const positions = new Float32Array(count * 3);
    const cx = room.gridX + room.width * 0.75;
    const cy = room.gridY + 0.9;

    for (let i = 0; i < count; i++) {
      positions[i * 3] = cx + (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 1] = cy + Math.random() * 0.5;
      positions[i * 3 + 2] = 0.2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.08,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      sizeAttenuation: false,
    });

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    this.steamEmitters.set(room.id, {
      points,
      cx,
      cy,
      count,
    });
  }

  update(delta, hour) {
    // Update one-shot effects (construction sparkle)
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.elapsed += delta;
      const t = fx.elapsed / fx.duration;

      if (t >= 1) {
        this.scene.remove(fx.points);
        fx.points.geometry.dispose();
        fx.points.material.dispose();
        this.effects.splice(i, 1);
        continue;
      }

      // Update particle positions
      const pos = fx.points.geometry.attributes.position;
      for (let p = 0; p < fx.count; p++) {
        const v = fx.velocities[p];
        pos.setX(p, pos.getX(p) + v.vx * delta);
        pos.setY(p, pos.getY(p) + v.vy * delta);
        v.vy -= 4 * delta; // gravity
      }
      pos.needsUpdate = true;
      fx.points.material.opacity = 1 - t;
    }

    // Update steam emitters
    for (const [, emitter] of this.steamEmitters) {
      const pos = emitter.points.geometry.attributes.position;
      for (let i = 0; i < emitter.count; i++) {
        let y = pos.getY(i);
        y += (0.3 + Math.random() * 0.2) * delta;

        // Slight horizontal drift
        let x = pos.getX(i);
        x += (Math.random() - 0.5) * 0.2 * delta;

        // Reset when too high
        if (y > emitter.cy + 1.2) {
          y = emitter.cy;
          x = emitter.cx + (Math.random() - 0.5) * 0.3;
        }

        pos.setX(i, x);
        pos.setY(i, y);
      }
      pos.needsUpdate = true;

      // Only show during operating hours (10am-11pm for restaurants)
      emitter.points.visible = hour >= 10 && hour <= 23;
    }
  }
}
