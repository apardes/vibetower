import * as THREE from 'three';
import { TOWER_MAX_WIDTH } from '../constants.js';
import { createRoomInterior, updateInteriorLighting } from './RoomInteriors.js';

export class TowerRenderer {
  constructor(scene) {
    this.scene = scene;
    this.roomMeshes = new Map(); // roomId -> THREE.Mesh
    this.roomInteriors = new Map(); // roomId -> THREE.Group (interior details)
    this.towerGroup = new THREE.Group();
    scene.add(this.towerGroup);

    // Building exterior group (rebuilt when rooms change)
    this.exteriorGroup = new THREE.Group();
    this.towerGroup.add(this.exteriorGroup);

    // Animations in progress
    this.buildAnimations = [];

    this.createGround();
  }

  createGround() {
    const cx = 500; // visual center — matches camera start
    const W = 2000; // massive — always fills screen

    const grassSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(W, 0.12),
      new THREE.MeshStandardMaterial({ color: '#4a8c45', roughness: 0.9, metalness: 0 })
    );
    grassSurface.position.set(cx, -0.06, -0.5);
    this.towerGroup.add(grassSurface);

    const topsoil = new THREE.Mesh(
      new THREE.PlaneGeometry(W, 2),
      new THREE.MeshStandardMaterial({ color: '#5c4430', roughness: 1.0, metalness: 0 })
    );
    topsoil.position.set(cx, -1.1, -2);
    this.towerGroup.add(topsoil);

    const midEarth = new THREE.Mesh(
      new THREE.PlaneGeometry(W, 5),
      new THREE.MeshStandardMaterial({ color: '#6b5540', roughness: 1.0, metalness: 0 })
    );
    midEarth.position.set(cx, -4.6, -2);
    this.towerGroup.add(midEarth);

    const deepEarth = new THREE.Mesh(
      new THREE.PlaneGeometry(W, 15),
      new THREE.MeshStandardMaterial({ color: '#584838', roughness: 1.0, metalness: 0 })
    );
    deepEarth.position.set(cx, -14.6, -2);
    this.towerGroup.add(deepEarth);

    const rock = new THREE.Mesh(
      new THREE.PlaneGeometry(W, 200),
      new THREE.MeshStandardMaterial({ color: '#4a4440', roughness: 0.95, metalness: 0.05 })
    );
    rock.position.set(cx, -122, -2);
    this.towerGroup.add(rock);

    const strataMat = new THREE.MeshStandardMaterial({ color: '#4a3a28', roughness: 1.0, metalness: 0 });
    for (const y of [-2.1, -7.1, -22]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.04), strataMat);
      line.position.set(cx, y, -1.9);
      this.towerGroup.add(line);
    }

    const pebbleMat = new THREE.MeshStandardMaterial({ color: '#7a7068', roughness: 0.8, metalness: 0.05 });
    for (let i = 0; i < 30; i++) {
      const size = 0.06 + Math.random() * 0.12;
      const pebble = new THREE.Mesh(new THREE.CircleGeometry(size, 6), pebbleMat);
      pebble.position.set(
        cx + (Math.random() - 0.5) * 100,
        -(1 + Math.random() * 18),
        -1.8
      );
      this.towerGroup.add(pebble);
    }
  }

  addRoom(room) {
    const geo = new THREE.PlaneGeometry(room.width - 0.05, room.height - 0.05);
    const mat = new THREE.MeshBasicMaterial({ color: room.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      room.gridX + room.width / 2,
      room.gridY + room.height / 2,
      0
    );
    this.towerGroup.add(mesh);
    this.roomMeshes.set(room.id, mesh);

    // Interior details
    const interior = createRoomInterior(room);
    mesh.add(interior);
    this.roomInteriors.set(room.id, interior);

    // Build animation — scale from 0 to 1
    mesh.scale.y = 0.01;
    this.buildAnimations.push({
      mesh,
      elapsed: 0,
      duration: 0.3,
    });

    this.updateExterior();
  }

  removeRoom(roomId) {
    const mesh = this.roomMeshes.get(roomId);
    if (mesh) {
      // Dispose all children recursively
      mesh.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          child.material.dispose();
        }
      });
      this.towerGroup.remove(mesh);
      this.roomMeshes.delete(roomId);
      this.roomInteriors.delete(roomId);
      this.updateExterior();
    }
  }

  updateRoom(room) {
    const mesh = this.roomMeshes.get(room.id);
    if (mesh) {
      mesh.material.color.set(room.color);
    }
  }

  updateExterior() {
    // Clear old exterior
    while (this.exteriorGroup.children.length) {
      const child = this.exteriorGroup.children[0];
      this.exteriorGroup.remove(child);
      if (child.isMesh || child.isLine) {
        child.geometry?.dispose();
        child.material?.dispose();
      }
    }

    // Scan for building bounds per floor
    const floorBounds = new Map();
    for (const [, mesh] of this.roomMeshes) {
      const x = mesh.position.x;
      const y = Math.round(mesh.position.y - 0.5);
      const halfW = mesh.geometry.parameters.width / 2;
      const left = x - halfW;
      const right = x + halfW;
      const current = floorBounds.get(y) || { minX: Infinity, maxX: -Infinity };
      current.minX = Math.min(current.minX, left);
      current.maxX = Math.max(current.maxX, right);
      floorBounds.set(y, current);
    }

    if (floorBounds.size === 0) return;

    const wallColor = '#5a5250';
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.85, metalness: 0 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#4a4240', roughness: 0.8, metalness: 0.05 });

    // Solid wall strips on building edges
    for (const [floor, bounds] of floorBounds) {
      const wallW = 0.08;
      // Left wall
      const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(wallW, 1), wallMat);
      leftWall.position.set(bounds.minX - wallW / 2, floor + 0.5, 0.015);
      this.exteriorGroup.add(leftWall);

      // Right wall
      const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(wallW, 1), wallMat);
      rightWall.position.set(bounds.maxX + wallW / 2, floor + 0.5, 0.015);
      this.exteriorGroup.add(rightWall);

      // Floor line separator
      const floorLine = new THREE.Mesh(
        new THREE.PlaneGeometry(bounds.maxX - bounds.minX + wallW * 2, 0.03),
        wallMat
      );
      floorLine.position.set((bounds.minX + bounds.maxX) / 2, floor, 0.015);
      this.exteriorGroup.add(floorLine);
    }

    // Roofline — solid bar at top of the building
    let maxFloor = -1;
    let roofBounds = null;
    for (const [floor, bounds] of floorBounds) {
      if (floor > maxFloor) {
        maxFloor = floor;
        roofBounds = bounds;
      }
    }
    if (roofBounds) {
      const roofW = roofBounds.maxX - roofBounds.minX + 0.2;
      const roof = new THREE.Mesh(new THREE.PlaneGeometry(roofW, 0.12), roofMat);
      roof.position.set((roofBounds.minX + roofBounds.maxX) / 2, maxFloor + 1.05, 0.015);
      this.exteriorGroup.add(roof);

      // Roof cap / parapet
      const parapet = new THREE.Mesh(new THREE.PlaneGeometry(roofW + 0.1, 0.06), roofMat);
      parapet.position.set((roofBounds.minX + roofBounds.maxX) / 2, maxFloor + 1.12, 0.016);
      this.exteriorGroup.add(parapet);
    }
  }

  // Called per-frame from renderer.onUpdate
  updateRoomInteriors(hour, nightFactor, elapsed) {
    for (const [, interior] of this.roomInteriors) {
      updateInteriorLighting(interior, nightFactor, elapsed);
    }
  }

  // Called per-frame for build animations
  updateAnimations(delta) {
    for (let i = this.buildAnimations.length - 1; i >= 0; i--) {
      const anim = this.buildAnimations[i];
      anim.elapsed += delta;
      const t = Math.min(anim.elapsed / anim.duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      anim.mesh.scale.y = eased;
      if (t >= 1) {
        anim.mesh.scale.y = 1;
        this.buildAnimations.splice(i, 1);
      }
    }
  }
}
