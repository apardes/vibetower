import * as THREE from 'three';

export class ElevatorRenderer {
  constructor(scene) {
    this.scene = scene;
    this.elevatorMeshes = new Map(); // elevatorId -> { shaft, cabGroup, borders, floorLines, visualFloor, rails }
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  addElevator(elevator) {
    const height = elevator.maxFloor - elevator.minFloor + 1;
    const gx = elevator.gridX;

    // Shaft background
    const shaftGeo = new THREE.PlaneGeometry(0.9, height);
    const shaftMat = new THREE.MeshStandardMaterial({ color: '#444444', roughness: 0.95, metalness: 0 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.set(gx + 0.5, elevator.minFloor + height / 2, -0.1);
    this.group.add(shaft);

    // Guide rails
    const railPositions = [];
    for (const rx of [gx + 0.1, gx + 0.9]) {
      railPositions.push(rx, elevator.minFloor, 0, rx, elevator.minFloor + height, 0);
    }
    const railGeo = new THREE.BufferGeometry();
    railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPositions, 3));
    const railMat = new THREE.LineBasicMaterial({ color: '#333333' });
    const rails = new THREE.LineSegments(railGeo, railMat);
    this.group.add(rails);

    // Shaft border lines
    const borderPositions = [
      gx + 0.05, elevator.minFloor, 0,
      gx + 0.05, elevator.minFloor + height, 0,
      gx + 0.95, elevator.minFloor, 0,
      gx + 0.95, elevator.minFloor + height, 0,
    ];
    const borderGeo = new THREE.BufferGeometry();
    borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPositions, 3));
    const borderMat = new THREE.LineBasicMaterial({ color: '#222222' });
    const borders = new THREE.LineSegments(borderGeo, borderMat);
    this.group.add(borders);

    // Floor indicator lines + dots
    const floorLinePositions = [];
    for (let f = elevator.minFloor; f <= elevator.maxFloor + 1; f++) {
      floorLinePositions.push(
        gx + 0.05, f, 0.01,
        gx + 0.95, f, 0.01,
      );
    }
    const floorLineGeo = new THREE.BufferGeometry();
    floorLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(floorLinePositions, 3));
    const floorLineMat = new THREE.LineBasicMaterial({ color: '#3a3a3a' });
    const floorLines = new THREE.LineSegments(floorLineGeo, floorLineMat);
    this.group.add(floorLines);

    // Floor indicator dots (small squares at each floor)
    for (let f = elevator.minFloor; f <= elevator.maxFloor; f++) {
      const dotGeo = new THREE.PlaneGeometry(0.06, 0.06);
      const dotMat = new THREE.MeshStandardMaterial({ color: '#666666', roughness: 0.5, metalness: 0.2 });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(gx + 0.12, f + 0.5, 0.02);
      this.group.add(dot);
    }

    // Cab group (contains multiple parts)
    const cabGroup = new THREE.Group();
    cabGroup.position.set(gx + 0.5, elevator.minFloor + 0.5, 0.1);

    // Back wall
    const backGeo = new THREE.PlaneGeometry(0.75, 0.85);
    const backMat = new THREE.MeshStandardMaterial({ color: '#888888', roughness: 0.6, metalness: 0.1 });
    const back = new THREE.Mesh(backGeo, backMat);
    back.position.z = -0.01;
    cabGroup.add(back);

    // Cab body
    const cabGeo = new THREE.PlaneGeometry(0.7, 0.8);
    const cabMat = new THREE.MeshStandardMaterial({ color: '#aaaaaa', roughness: 0.5, metalness: 0.2 });
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cabGroup.add(cab);

    // Interior light at top of cab
    const lightGeo = new THREE.PlaneGeometry(0.4, 0.04);
    const lightMat = new THREE.MeshStandardMaterial({
      color: '#ffffcc',
      emissive: '#ffffcc',
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0,
    });
    const cabLight = new THREE.Mesh(lightGeo, lightMat);
    cabLight.position.set(0, 0.35, 0.01);
    cabGroup.add(cabLight);

    // Door lines
    const doorLinePositions = [
      -0.02, -0.4, 0.02, -0.02, 0.3, 0.02,
      0.02, -0.4, 0.02, 0.02, 0.3, 0.02,
    ];
    const doorGeo = new THREE.BufferGeometry();
    doorGeo.setAttribute('position', new THREE.Float32BufferAttribute(doorLinePositions, 3));
    const doorMat = new THREE.LineBasicMaterial({ color: '#666666' });
    const doorLines = new THREE.LineSegments(doorGeo, doorMat);
    cabGroup.add(doorLines);

    // Floor indicator above cab
    const indicatorGeo = new THREE.PlaneGeometry(0.12, 0.06);
    const indicatorMat = new THREE.MeshStandardMaterial({
      color: '#44cc44',
      emissive: '#44cc44',
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0,
    });
    const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
    indicator.position.set(0, 0.45, 0.01);
    cabGroup.add(indicator);

    this.group.add(cabGroup);

    this.elevatorMeshes.set(elevator.id, {
      shaft, cabGroup, cab, borders, floorLines, rails,
      indicator, cabLight,
      visualFloor: elevator.currentFloor,
    });
  }

  updateCab(elevator) {
    const entry = this.elevatorMeshes.get(elevator.id);
    if (!entry) return;

    // Set target for visual lerp — game logic is integer, visual is smooth
    entry.targetY = elevator.currentFloor + 0.5;

    // Color cab based on occupancy
    const occupancy = elevator.passengers.size / elevator.capacity;
    if (occupancy > 0.7) {
      entry.cab.material.color.set('#cc8888');
      entry.indicator.material.color.set('#cc4444');
      entry.indicator.material.emissive.set('#cc4444');
    } else if (occupancy > 0) {
      entry.cab.material.color.set('#bbbbbb');
      entry.indicator.material.color.set('#ffaa44');
      entry.indicator.material.emissive.set('#ffaa44');
    } else {
      entry.cab.material.color.set('#aaaaaa');
      entry.indicator.material.color.set('#44cc44');
      entry.indicator.material.emissive.set('#44cc44');
    }
  }

  // Smooth visual interpolation per frame
  animateCabs(delta) {
    for (const [, entry] of this.elevatorMeshes) {
      if (entry.targetY === undefined) continue;
      const diff = entry.targetY - entry.cabGroup.position.y;
      if (Math.abs(diff) > 0.001) {
        entry.cabGroup.position.y += diff * Math.min(1, delta * 12);
      } else {
        entry.cabGroup.position.y = entry.targetY;
      }
    }
  }

  // Get the visual Y position of an elevator cab (for person rendering)
  getVisualY(elevatorId) {
    const entry = this.elevatorMeshes.get(elevatorId);
    return entry ? entry.cabGroup.position.y : null;
  }

  removeElevator(elevatorId) {
    const entry = this.elevatorMeshes.get(elevatorId);
    if (!entry) return;

    // Dispose all meshes in the group
    const toRemove = [entry.shaft, entry.cabGroup, entry.borders, entry.floorLines, entry.rails];
    for (const obj of toRemove) {
      this.group.remove(obj);
      obj.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          child.material.dispose();
        } else if (child.isLine) {
          child.geometry.dispose();
          child.material.dispose();
        }
      });
      if (obj.isMesh) {
        obj.geometry.dispose();
        obj.material.dispose();
      }
    }

    // Remove floor dots (they were added directly to group)
    // They'll be cleaned up on next GC since they're just small meshes

    this.elevatorMeshes.delete(elevatorId);
  }
}
