import { generateId } from '../utils/helpers.js';

// Simplified elevator: just a cab that moves between floors.
// All passenger logic lives in Simulation.

export class Elevator {
  constructor(gridX, minFloor, maxFloor) {
    this.id = generateId();
    this.gridX = gridX;
    this.minFloor = minFloor;
    this.maxFloor = maxFloor;

    this.currentFloor = minFloor; // float for smooth animation
    this.targetFloor = minFloor;
    this.direction = 1;           // 1=up, -1=down
    this.state = 'idle';          // 'idle', 'moving', 'stopped'
    this.stopTimer = 0;           // countdown when stopped at a floor
    this.passengers = new Set();  // person IDs currently in cab
    this.requestedFloors = new Set(); // floors the cab needs to visit
    this.capacity = 8;
  }

  requestFloor(floor) {
    if (floor >= this.minFloor && floor <= this.maxFloor) {
      this.requestedFloors.add(floor);
      if (this.state === 'idle') {
        this.pickNextTarget();
        if (this.state === 'idle' && this.requestedFloors.size > 0) {
          this.state = 'moving';
        }
      }
    }
  }

  update(tickHours) {
    if (this.state === 'stopped') {
      this.stopTimer -= tickHours;
      if (this.stopTimer <= 0) {
        this.requestedFloors.delete(Math.round(this.currentFloor));
        this.pickNextTarget();
      }
      return;
    }

    if (this.state === 'idle') return;

    // Moving
    const speed = 10; // floors per game-hour
    const dist = this.targetFloor - this.currentFloor;

    if (Math.abs(dist) < 0.05) {
      this.currentFloor = this.targetFloor;
      this.state = 'stopped';
      this.stopTimer = 0.04; // brief pause at floor
    } else {
      const move = Math.sign(dist) * speed * tickHours;
      if (Math.abs(move) > Math.abs(dist)) {
        this.currentFloor = this.targetFloor;
        this.state = 'stopped';
        this.stopTimer = 0.04;
      } else {
        this.currentFloor += move;
      }
    }
  }

  pickNextTarget() {
    if (this.requestedFloors.size === 0) {
      this.state = 'idle';
      return;
    }

    const floors = [...this.requestedFloors];
    const current = Math.round(this.currentFloor);

    // If we're already at a requested floor, stop here
    if (this.requestedFloors.has(current)) {
      this.targetFloor = current;
      this.state = 'stopped';
      this.stopTimer = 0.04;
      return;
    }

    // Scan algorithm: pick closest floor in current direction
    const inDir = floors.filter(f =>
      this.direction > 0 ? f > current : f < current
    );

    if (inDir.length > 0) {
      this.targetFloor = this.direction > 0
        ? Math.min(...inDir)
        : Math.max(...inDir);
    } else {
      // Reverse
      this.direction *= -1;
      const inNewDir = floors.filter(f =>
        this.direction > 0 ? f > current : f < current
      );
      if (inNewDir.length > 0) {
        this.targetFloor = this.direction > 0
          ? Math.min(...inNewDir)
          : Math.max(...inNewDir);
      } else {
        this.targetFloor = floors[0];
      }
    }

    this.state = 'moving';
  }

  get stoppedAtFloor() {
    if (this.state !== 'stopped') return -1;
    return Math.round(this.currentFloor);
  }
}
