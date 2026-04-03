import * as THREE from 'three';
import { eventBus } from '../utils/EventBus.js';

export class FloatingText {
  constructor(scene, gameState) {
    this.scene = scene;
    this.gameState = gameState;
    this.activeTexts = [];
    this.textureCache = new Map();

    eventBus.on('rentCollected', ({ income, expense, net }) => {
      if (income <= 0) return;

      // Spawn floating texts only at rooms with actual tenants
      const rooms = [...this.gameState.tower.rooms.values()].filter(
        r => r.type !== 'elevator' && r.type !== 'lobby' && r.tenants && r.tenants.length > 0
      );
      if (rooms.length === 0) return;

      // Show up to 5 floating texts at random rooms
      const count = Math.min(rooms.length, 5);
      const shuffled = rooms.sort(() => Math.random() - 0.5);
      for (let i = 0; i < count; i++) {
        const room = shuffled[i];
        const amount = room.income;
        if (amount <= 0) continue;
        this.spawn(
          '+$' + amount,
          room.gridX + room.width / 2,
          room.gridY + 1,
          '#44cc44'
        );
      }
    });
  }

  spawn(text, worldX, worldY, color = '#44cc44') {
    if (this.activeTexts.length > 20) return;

    const texture = this.getTexture(text, color);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 1,
    });

    const geo = new THREE.PlaneGeometry(0.8, 0.3);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(worldX, worldY, 0.6);
    this.scene.add(mesh);

    this.activeTexts.push({
      mesh,
      elapsed: 0,
      duration: 1.5,
      startY: worldY,
    });
  }

  getTexture(text, color) {
    const key = text + color;
    if (this.textureCache.has(key)) return this.textureCache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 128, 48);
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Shadow for readability
    ctx.fillStyle = '#000000';
    ctx.fillText(text, 65, 25);
    ctx.fillStyle = color;
    ctx.fillText(text, 64, 24);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    this.textureCache.set(key, texture);
    return texture;
  }

  update(delta) {
    for (let i = this.activeTexts.length - 1; i >= 0; i--) {
      const ft = this.activeTexts[i];
      ft.elapsed += delta;
      const t = ft.elapsed / ft.duration;

      if (t >= 1) {
        this.scene.remove(ft.mesh);
        ft.mesh.geometry.dispose();
        ft.mesh.material.dispose();
        this.activeTexts.splice(i, 1);
        continue;
      }

      ft.mesh.position.y = ft.startY + t * 1.0;
      ft.mesh.material.opacity = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
    }
  }
}
