import * as THREE from 'three';
import { TOWER_MAX_WIDTH, TOWER_MAX_FLOORS } from '../constants.js';

export class GridOverlay {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false; // hidden by default, shown in build mode
    scene.add(this.group);

    this.buildGridLines();
    this.buildPreviewMesh();
  }

  buildGridLines() {
    const positions = [];
    const visibleFloors = TOWER_MAX_FLOORS;

    // Vertical lines
    for (let x = 0; x <= TOWER_MAX_WIDTH; x++) {
      positions.push(x, 0, 0.4);
      positions.push(x, visibleFloors, 0.4);
    }

    // Horizontal lines
    for (let y = 0; y <= visibleFloors; y++) {
      positions.push(0, y, 0.4);
      positions.push(TOWER_MAX_WIDTH, y, 0.4);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: '#ffffff', opacity: 0.1, transparent: true });
    this.gridLines = new THREE.LineSegments(geo, mat);
    this.gridLines.visible = false;
    this.group.add(this.gridLines);
  }

  buildPreviewMesh() {
    this.previewGeo = new THREE.PlaneGeometry(1, 1);
    this.previewMat = new THREE.MeshBasicMaterial({
      color: '#00ff00',
      opacity: 0.4,
      transparent: true,
    });
    this.previewMesh = new THREE.Mesh(this.previewGeo, this.previewMat);
    this.previewMesh.position.z = 0.5;
    this.previewMesh.visible = false;
    this.group.add(this.previewMesh);
  }

  show() {
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
    this.previewMesh.visible = false;
  }

  showPreview(gridX, gridY, width, height, valid) {
    this.previewMesh.visible = true;
    this.previewMesh.scale.set(width - 0.05, height - 0.05, 1);
    this.previewMesh.position.set(
      gridX + width / 2,
      gridY + height / 2,
      0.5
    );
    this.previewMat.color.set(valid ? '#00ff00' : '#ff0000');
  }

  hidePreview() {
    this.previewMesh.visible = false;
  }
}
