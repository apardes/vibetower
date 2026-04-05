import { generateId } from '../utils/helpers.js';

export class Elevator {
  constructor(gridX, minFloor, maxFloor) {
    this.id = generateId();
    this.gridX = gridX;
    this.minFloor = minFloor;
    this.maxFloor = maxFloor;

    this.currentFloor = minFloor; // always an integer
    this.direction = 1;           // 1=up, -1=down
    this.state = 'idle';          // 'idle', 'moving', 'stopped'
    this.moveTimer = 0;           // time remaining before arriving at next floor
    this.stopTimer = 0;           // time remaining at a stop
    this.passengers = new Set();
    this.requestedFloors = new Set();
    this.capacity = 12;

    this.moveTime = 0.02;    // game-hours to travel one floor (~1.2 min)
    this.baseStopTime = 0.08; // base stop time — must survive at least 1 tick at 3x speed (0.06)
    this.perPersonStop = 0.005; // additional time per person boarding/exiting

    // Wait time tracking
    this.recentWaitTimes = []; // last N wait times in game-hours
    this.avgWaitTime = 0;     // rolling average
    this.longWaitAlerted = false; // prevent toast spam
  }

  // Calculate stop duration based on number of people boarding/exiting
  getStopDuration(boardingCount) {
    return this.baseStopTime + boardingCount * this.perPersonStop;
  }

  recordWaitTime(hours) {
    this.recentWaitTimes.push(hours);
    if (this.recentWaitTimes.length > 20) this.recentWaitTimes.shift();
    this.avgWaitTime = this.recentWaitTimes.reduce((s, t) => s + t, 0) / this.recentWaitTimes.length;
  }

  requestFloor(floor) {
    if (floor >= this.minFloor && floor <= this.maxFloor) {
      this.requestedFloors.add(floor);
      if (this.state === 'idle') {
        this.pickNextTarget();
      }
    }
  }

  update(tickHours) {
    if (this.state === 'stopped') {
      this.stopTimer -= tickHours;
      if (this.stopTimer <= 0) {
        this.requestedFloors.delete(this.currentFloor);
        this.pickNextTarget();
      }
      return;
    }

    if (this.state === 'idle') return;

    // Moving
    this.moveTimer -= tickHours;
    if (this.moveTimer <= 0) {
      this.currentFloor += this.direction;

      if (this.requestedFloors.has(this.currentFloor)) {
        this.state = 'stopped';
        this.stopTimer = this.getStopDuration(0);
        return;
      }

      if (this.currentFloor === this.targetFloor) {
        this.state = 'stopped';
        this.stopTimer = this.getStopDuration(0);
        return;
      }

      this.moveTimer = this.moveTime;
    }
  }

  pickNextTarget() {
    if (this.requestedFloors.size === 0) {
      this.state = 'idle';
      return;
    }

    const floors = [...this.requestedFloors];
    const current = this.currentFloor;

    // If we're already at a requested floor, stop here
    if (this.requestedFloors.has(current)) {
      this.state = 'stopped';
      this.stopTimer = this.getStopDuration(0);
      this.targetFloor = current;
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
      // Reverse direction
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
        this.direction = Math.sign(floors[0] - current) || 1;
      }
    }

    this.state = 'moving';
    this.moveTimer = this.moveTime;
  }

  get stoppedAtFloor() {
    if (this.state !== 'stopped') return -1;
    return this.currentFloor;
  }
}
