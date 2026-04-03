import * as THREE from 'three';

export class ElevatorRenderer {
  constructor(scene) {
    this.scene = scene;
    this.elevatorMeshes = new Map(); // elevatorId -> { shaft, cab }
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  addElevator(elevator) {
    const height = elevator.maxFloor - elevator.minFloor + 1;

    // Shaft background
    const shaftGeo = new THREE.PlaneGeometry(0.9, height);
    const shaftMat = new THREE.MeshBasicMaterial({ color: '#555555' });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.set(
      elevator.gridX + 0.5,
      elevator.minFloor + height / 2,
      -0.1
    );
    this.group.add(shaft);

    // Shaft border lines
    const borderPositions = [
      // Left edge
      elevator.gridX + 0.05, elevator.minFloor, 0,
      elevator.gridX + 0.05, elevator.minFloor + height, 0,
      // Right edge
      elevator.gridX + 0.95, elevator.minFloor, 0,
      elevator.gridX + 0.95, elevator.minFloor + height, 0,
    ];
    const borderGeo = new THREE.BufferGeometry();
    borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPositions, 3));
    const borderMat = new THREE.LineBasicMaterial({ color: '#333333' });
    const borders = new THREE.LineSegments(borderGeo, borderMat);
    this.group.add(borders);

    // Floor indicator lines
    const floorLinePositions = [];
    for (let f = elevator.minFloor; f <= elevator.maxFloor + 1; f++) {
      floorLinePositions.push(
        elevator.gridX + 0.05, f, 0.01,
        elevator.gridX + 0.95, f, 0.01,
      );
    }
    const floorLineGeo = new THREE.BufferGeometry();
    floorLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(floorLinePositions, 3));
    const floorLineMat = new THREE.LineBasicMaterial({ color: '#444444' });
    const floorLines = new THREE.LineSegments(floorLineGeo, floorLineMat);
    this.group.add(floorLines);

    // Cab
    const cabGeo = new THREE.PlaneGeometry(0.7, 0.8);
    const cabMat = new THREE.MeshBasicMaterial({ color: '#aaaaaa' });
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cab.position.set(elevator.gridX + 0.5, elevator.minFloor + 0.5, 0.1);
    this.group.add(cab);

    this.elevatorMeshes.set(elevator.id, { shaft, cab, borders, floorLines });
  }

  updateCab(elevator) {
    const entry = this.elevatorMeshes.get(elevator.id);
    if (!entry) return;
    entry.cab.position.y = elevator.currentFloor + 0.5;

    // Color cab based on occupancy
    const occupancy = elevator.passengers.size / elevator.capacity;
    if (occupancy > 0.7) {
      entry.cab.material.color.set('#cc8888');
    } else if (occupancy > 0) {
      entry.cab.material.color.set('#bbbbbb');
    } else {
      entry.cab.material.color.set('#aaaaaa');
    }
  }

  removeElevator(elevatorId) {
    const entry = this.elevatorMeshes.get(elevatorId);
    if (!entry) return;
    this.group.remove(entry.shaft);
    this.group.remove(entry.cab);
    this.group.remove(entry.borders);
    this.group.remove(entry.floorLines);
    entry.shaft.geometry.dispose();
    entry.shaft.material.dispose();
    entry.cab.geometry.dispose();
    entry.cab.material.dispose();
    entry.borders.geometry.dispose();
    entry.borders.material.dispose();
    entry.floorLines.geometry.dispose();
    entry.floorLines.material.dispose();
    this.elevatorMeshes.delete(elevatorId);
  }
}
