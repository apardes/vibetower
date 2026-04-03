import { generateId } from '../utils/helpers.js';
import { ROOM_SCHEDULES } from '../constants.js';

// Gaussian-ish random: average of 3 uniform randoms gives a bell curve
function gaussRandom(min, max, peak) {
  const r = (Math.random() + Math.random() + Math.random()) / 3; // 0-1, bell-shaped
  // Bias toward peak within [min, max]
  const peakT = (peak - min) / (max - min); // where peak falls in 0-1
  const biased = r * 0.6 + peakT * 0.4;     // blend random with peak bias
  return min + Math.max(0, Math.min(1, biased)) * (max - min);
}

export class Person {
  constructor(homeRoom, roomType) {
    this.id = generateId();
    this.homeRoom = homeRoom;
    this.state = 'spawning';
    this.satisfaction = 80 + Math.random() * 20;
    this.floor = 0;
    this.position = { x: 0, y: 0.5 };
    this.homeOffset = 0.5; // overwritten by spawnPerson with evenly-spaced slot
    this.targetX = 0;
    this.targetFloor = -1;
    this.elevatorId = null;
    this.isOut = false;
    this.hidden = false;
    this.hasLeftToday = false;   // prevents re-triggering leave
    this.hasReturnedToday = false; // prevents re-triggering return

    // Generate personal schedule based on room type
    this.schedule = this.generateSchedule(roomType);
  }

  generateSchedule(roomType) {
    const sched = ROOM_SCHEDULES[roomType];
    if (!sched) return { type: 'static' }; // lobby, elevator — no schedule

    if (roomType === 'apartment') {
      const staysHome = Math.random() < sched.stayHomeChance;
      return {
        type: 'apartment',
        staysHome,
        leaveHour: staysHome ? 99 : gaussRandom(sched.leaveWindow[0], sched.leaveWindow[1], sched.leavePeak),
        returnHour: staysHome ? 99 : gaussRandom(sched.returnWindow[0], sched.returnWindow[1], sched.returnPeak),
      };
    }

    if (roomType === 'office') {
      const staysLate = Math.random() < sched.stayLateChance;
      return {
        type: 'office',
        arriveHour: gaussRandom(sched.arriveWindow[0], sched.arriveWindow[1], sched.arrivePeak),
        departHour: staysLate
          ? gaussRandom(20, 23, 21.5)
          : gaussRandom(sched.departWindow[0], sched.departWindow[1], sched.departPeak),
      };
    }

    if (roomType === 'retail') {
      return {
        type: 'retail',
        arriveHour: sched.openHour - 0.5 + Math.random() * 0.5, // arrive just before open
        departHour: sched.closeHour + Math.random() * 0.5,
      };
    }

    if (roomType === 'restaurant') {
      return {
        type: 'restaurant',
        arriveHour: sched.openHour - 1 + Math.random() * 0.5,
        departHour: sched.closeHour + Math.random() * 0.5,
      };
    }

    return { type: 'static' };
  }

  // Reset daily flags at start of new day
  resetDay() {
    this.hasLeftToday = false;
    this.hasReturnedToday = false;
  }
}
