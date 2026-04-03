import * as THREE from 'three';
import { TOWER_MAX_WIDTH } from '../constants.js';

export class TowerRenderer {
  constructor(scene) {
    this.scene = scene;
    this.roomMeshes = new Map(); // roomId -> THREE.Mesh
    this.towerGroup = new THREE.Group();
    scene.add(this.towerGroup);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(TOWER_MAX_WIDTH + 10, 0.15);
    const groundMat = new THREE.MeshBasicMaterial({ color: '#4a7c59' });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.position.set(TOWER_MAX_WIDTH / 2, -0.075, -1);
    this.towerGroup.add(this.ground);
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

    // Add interior details based on room type
    this.addRoomDetails(room, mesh);
  }

  addRoomDetails(room, parentMesh) {
    const details = new THREE.Group();

    if (room.type === 'lobby') {
      // Door openings
      for (let i = 0; i < room.width; i++) {
        const doorGeo = new THREE.PlaneGeometry(0.2, 0.5);
        const doorMat = new THREE.MeshBasicMaterial({ color: '#8b7355' });
        const door = new THREE.Mesh(doorGeo, doorMat);
        door.position.set(i - room.width / 2 + 0.5, -0.1, 0.01);
        details.add(door);
      }
    } else if (room.type === 'apartment') {
      // Windows
      const winGeo = new THREE.PlaneGeometry(0.25, 0.3);
      const winMat = new THREE.MeshBasicMaterial({ color: '#c8e6ff' });
      for (let i = 0; i < 2; i++) {
        const win = new THREE.Mesh(winGeo, winMat);
        win.position.set(i * 0.8 - 0.4, 0.1, 0.01);
        details.add(win);
      }
    } else if (room.type === 'office') {
      // Windows
      const winGeo = new THREE.PlaneGeometry(0.2, 0.25);
      const winMat = new THREE.MeshBasicMaterial({ color: '#d4eacc' });
      for (let i = 0; i < 4; i++) {
        const win = new THREE.Mesh(winGeo, winMat);
        win.position.set(i * 0.6 - 0.9, 0.1, 0.01);
        details.add(win);
      }
    }

    parentMesh.add(details);
  }

  removeRoom(roomId) {
    const mesh = this.roomMeshes.get(roomId);
    if (mesh) {
      this.towerGroup.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      this.roomMeshes.delete(roomId);
    }
  }

  // Update room visual (e.g., occupied vs empty)
  updateRoom(room) {
    const mesh = this.roomMeshes.get(room.id);
    if (mesh) {
      mesh.material.color.set(room.color);
    }
  }
}
