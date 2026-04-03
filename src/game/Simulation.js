import { BASE_TICK_HOURS, TICKS_PER_SECOND, TOWER_MAX_WIDTH } from '../constants.js';
import { Economy } from './Economy.js';
import { Person } from './Person.js';
import { StarRating } from './StarRating.js';
import { eventBus } from '../utils/EventBus.js';

const WALK_SPEED = 4; // world units per game-hour

export class Simulation {
  constructor(gameState, sky) {
    this.gameState = gameState;
    this.sky = sky;
    this.economy = new Economy(gameState);
    this.starRating = new StarRating(gameState);
    this.tickCount = 0;

    this.intervalId = setInterval(() => this.tick(), 1000 / TICKS_PER_SECOND);
  }

  tick() {
    const { time } = this.gameState;
    if (time.speed === 0) return;

    const tickHours = BASE_TICK_HOURS * time.speed;
    time.hour += tickHours;

    if (time.hour >= 24) {
      time.hour -= 24;
      time.day += 1;
      this.onNewDay();
    }

    this.tickCount++;

    this.tickSpawnsAndReturns(time.hour);
    this.updatePeople(tickHours);
    this.updateElevators(tickHours);
    this.sky.setTime(time.hour);

    if (this.tickCount % 10 === 0) {
      this.updateSatisfaction();
      this.updateStats();
    }

    eventBus.emit('tick', this.gameState);
  }

  // =====================
  // PEOPLE
  // =====================

  updatePeople(tickHours) {
    const { people, tower, time } = this.gameState;

    for (const [id, person] of people) {
      const homeRoom = tower.rooms.get(person.homeRoom);
      if (!homeRoom) {
        people.delete(id);
        continue;
      }

      switch (person.state) {
        case 'spawning':
          // Walk from lobby entrance toward elevator or directly to room
          this.handleSpawning(person, homeRoom, tickHours);
          break;

        case 'in_room':
          // Check if it's time to leave
          this.handleInRoom(person, homeRoom, time.hour);
          break;

        case 'walking':
          this.moveTowardTargetX(person, tickHours);
          break;

        case 'waiting_elevator':
          // Idle sway while waiting
          break;

        case 'in_elevator':
          // Position handled by updateElevators
          break;
      }
    }
  }

  handleSpawning(person, homeRoom, tickHours) {
    if (homeRoom.gridY === 0) {
      // Room is on ground floor — just walk to it
      person.targetX = homeRoom.gridX + person.homeOffset * homeRoom.width;
      person.state = 'walking';
      person.targetFloor = -1;
      this.moveTowardTargetX(person, tickHours);
      // Check arrival
      if (person.state === 'walking' && Math.abs(person.position.x - person.targetX) < 0.1) {
        this.arriveAtRoom(person, homeRoom);
      }
    } else {
      // Need elevator to get to room's floor
      const elevator = this.findNearestElevator(person.position.x, person.floor, homeRoom.gridY);
      if (!elevator) {
        // No elevator — can't reach room, remove this person entirely
        homeRoom.tenants = homeRoom.tenants.filter(id => id !== person.id);
        this.gameState.people.delete(person.id);
        return;
      }
      this.startElevatorTrip(person, homeRoom.gridY, tickHours);
    }
  }

  handleInRoom(person, homeRoom, hour) {
    const sched = person.schedule;
    if (!sched || sched.type === 'static') return;

    // Don't process schedule if person isn't actually on their room's floor
    if (person.floor !== homeRoom.gridY) return;

    if (sched.type === 'apartment') {
      // Time to leave for work?
      if (!person.isOut && !person.hasLeftToday && hour >= sched.leaveHour) {
        person.hasLeftToday = true;
        if (sched.staysHome) return; // stays home all day
        this.sendPersonOut(person, homeRoom);
      }
      // Time to return home? (handled by spawning back in)
      return;
    }

    if (sched.type === 'office') {
      // Office workers leave at their depart time
      if (!person.isOut && !person.hasLeftToday && hour >= sched.departHour) {
        person.hasLeftToday = true;
        this.sendPersonOut(person, homeRoom);
      }
      return;
    }

    if (sched.type === 'retail' || sched.type === 'restaurant') {
      // Staff leave at closing time
      if (!person.isOut && !person.hasLeftToday && hour >= sched.departHour) {
        person.hasLeftToday = true;
        this.sendPersonOut(person, homeRoom);
      }
      return;
    }
  }

  sendPersonOut(person, fromRoom) {
    // Only send out if person is actually on the room's floor
    if (person.floor !== fromRoom.gridY) return;

    person.isOut = true;
    // Don't teleport — keep current position, let them walk from where they are
    person.position.y = fromRoom.gridY + 0.5;

    if (fromRoom.gridY === 0) {
      // Walk off screen
      person.state = 'walking';
      person.targetX = Math.random() > 0.5 ? -2 : TOWER_MAX_WIDTH + 2;
      person.targetFloor = -1;
    } else {
      // Take elevator down
      this.startElevatorTrip(person, 0, 0);
    }
  }

  // Start a trip: walk to elevator, queue up
  startElevatorTrip(person, destFloor, tickHours) {
    const elevator = this.findNearestElevator(person.position.x, person.floor, destFloor);
    if (!elevator) {
      // No elevator available — stay in room, cancel the trip
      person.state = 'in_room';
      person.isOut = false;
      person.hasLeftToday = false;
      person.position.y = person.floor + 0.5;
      return;
    }

    person.elevatorId = elevator.id;
    person.targetFloor = destFloor;
    person.targetX = elevator.gridX + 0.5;
    person.state = 'walking';
  }

  moveTowardTargetX(person, tickHours) {
    const dx = person.targetX - person.position.x;
    const step = WALK_SPEED * tickHours;

    if (Math.abs(dx) <= step) {
      person.position.x = person.targetX;
      this.onArrivedAtTargetX(person);
    } else {
      person.position.x += Math.sign(dx) * step;
    }
  }

  onArrivedAtTargetX(person) {
    // Did we walk to an elevator?
    if (person.elevatorId && person.targetFloor >= 0) {
      const elevator = this.gameState.tower.elevators.get(person.elevatorId);
      if (elevator) {
        person.state = 'waiting_elevator';
        // Only request pickup floor — destination is requested when they board
        elevator.requestFloor(person.floor);
        return;
      }
    }

    // Walked off the map (leaving for the day) — mark as away
    if (person.isOut && (person.position.x < -1 || person.position.x > TOWER_MAX_WIDTH + 1)) {
      person.state = 'in_room';
      person.floor = 0;
      person.hidden = true;
      return;
    }

    // Otherwise we arrived at our room
    const homeRoom = this.gameState.tower.rooms.get(person.homeRoom);
    if (homeRoom && person.floor === homeRoom.gridY) {
      this.arriveAtRoom(person, homeRoom);
    } else if (homeRoom) {
      // Wrong floor — take elevator to correct floor
      this.startElevatorTrip(person, homeRoom.gridY, 0);
    } else {
      // No home room — shouldn't happen, but park them
      person.state = 'in_room';
    }
  }

  arriveAtRoom(person, room) {
    person.state = 'in_room';
    person.floor = room.gridY;
    person.hidden = false;
    // Keep current x if already inside the room bounds, otherwise use their home spot
    const inBounds = person.position.x >= room.gridX && person.position.x <= room.gridX + room.width;
    if (!inBounds) {
      person.position.x = room.gridX + person.homeOffset * room.width;
    }
    person.position.y = room.gridY + 0.5;
    person.elevatorId = null;
    person.targetFloor = -1;
    person.isOut = false;
  }

  findNearestElevator(fromX, fromFloor, targetFloor) {
    let best = null;
    let bestDist = Infinity;

    for (const [, elevator] of this.gameState.tower.elevators) {
      if (fromFloor >= elevator.minFloor && fromFloor <= elevator.maxFloor &&
          targetFloor >= elevator.minFloor && targetFloor <= elevator.maxFloor) {
        const dist = Math.abs(elevator.gridX + 0.5 - fromX);
        if (dist < bestDist) {
          bestDist = dist;
          best = elevator;
        }
      }
    }
    return best;
  }

  // =====================
  // ELEVATORS
  // =====================

  updateElevators(tickHours) {
    const { tower, people } = this.gameState;

    // Ensure every waiting person's floor is requested (defensive retry)
    for (const [, person] of people) {
      if (person.state === 'waiting_elevator' && person.elevatorId) {
        const elev = tower.elevators.get(person.elevatorId);
        if (elev && !elev.requestedFloors.has(person.floor)) {
          elev.requestFloor(person.floor);
        }
      }
      if (person.state === 'in_elevator' && person.elevatorId) {
        const elev = tower.elevators.get(person.elevatorId);
        if (elev && !elev.requestedFloors.has(person.targetFloor) && person.targetFloor >= 0) {
          elev.requestFloor(person.targetFloor);
        }
      }
    }

    for (const [, elevator] of tower.elevators) {
      elevator.update(tickHours);

      // Only use the stopped floor AFTER update — no snapshots
      // People can only get on/off when the elevator is fully stopped
      const stoppedFloor = elevator.stoppedAtFloor;

      // Update position of everyone riding this cab
      for (const personId of elevator.passengers) {
        const person = people.get(personId);
        if (person) {
          person.position.x = elevator.gridX + 0.5;
          person.position.y = elevator.currentFloor + 0.5;
        }
      }

      // Handle loading/unloading ONLY when fully stopped at a floor
      if (stoppedFloor < 0) continue;

      // Unload: passengers whose targetFloor is this floor
      const toRemove = [];
      for (const personId of elevator.passengers) {
        const person = people.get(personId);
        if (!person) { toRemove.push(personId); continue; }

        if (person.targetFloor === stoppedFloor) {
          // Arrived at destination
          person.state = 'walking';
          person.floor = stoppedFloor;
          person.position.y = stoppedFloor + 0.5;
          person.elevatorId = null;

          // Walk to home room if on the right floor, otherwise walk off
          const homeRoom = tower.rooms.get(person.homeRoom);
          if (homeRoom && homeRoom.gridY === stoppedFloor) {
            person.targetX = homeRoom.gridX + person.homeOffset * homeRoom.width;
          } else if (stoppedFloor === 0 && person.isOut) {
            // Going outside
            person.targetX = Math.random() > 0.5 ? -2 : TOWER_MAX_WIDTH + 2;
          } else {
            person.targetX = person.position.x + (Math.random() > 0.5 ? 3 : -3);
          }

          person.targetFloor = -1;
          toRemove.push(personId);
        }
      }
      for (const id of toRemove) {
        elevator.passengers.delete(id);
      }

      // Load: people waiting on this floor for this elevator
      for (const [, person] of people) {
        if (person.state === 'waiting_elevator' &&
            person.elevatorId === elevator.id &&
            person.floor === stoppedFloor &&
            elevator.passengers.size < elevator.capacity) {
          elevator.passengers.add(person.id);
          person.state = 'in_elevator';
          // NOW request their destination floor
          elevator.requestFloor(person.targetFloor);
        }
      }
    }
  }

  // =====================
  // DAY TRANSITIONS
  // =====================

  onNewDay() {
    this.economy.collectRent();
    this.starRating.evaluate();

    // Reset daily flags for all people
    for (const [, person] of this.gameState.people) {
      person.resetDay();
    }

    eventBus.emit('newDay', this.gameState.time.day);
  }

  // Called every tick — trickle in new tenants and handle returns
  tickSpawnsAndReturns(hour) {
    this.trySpawnNewTenants(hour);
    this.tryReturnPeople(hour);
  }

  // Trickle new tenants in throughout the day (small chance per tick per empty slot)
  trySpawnNewTenants(hour) {
    // Only spawn during reasonable hours (6am - 10pm)
    if (hour < 6 || hour > 22) return;

    const { tower, people } = this.gameState;
    const spawnChancePerTick = 0.002 + (this.gameState.starRating * 0.001);

    for (const [, room] of tower.rooms) {
      if (room.type === 'elevator' || room.type === 'lobby') continue;

      // For rooms with capacity, check empty slots
      if (room.capacity > 0) {
        const emptySlots = room.capacity - room.tenants.length;
        if (emptySlots <= 0) continue;

        for (let i = 0; i < emptySlots; i++) {
          if (Math.random() < spawnChancePerTick) {
            this.spawnPerson(room);
          }
        }
      }
    }
  }

  spawnPerson(room) {
    const { people } = this.gameState;
    const person = new Person(room.id, room.type);
    person.position.x = Math.random() > 0.5 ? 0 : TOWER_MAX_WIDTH;
    person.position.y = 0.5;
    person.floor = 0;
    person.state = 'spawning';
    // Don't immediately leave on the day you move in
    person.hasLeftToday = true;
    people.set(person.id, person);
    room.tenants.push(person.id);
    // Space tenants evenly within room by slot index
    const slotIndex = room.tenants.length - 1;
    const totalSlots = Math.max(room.capacity, room.tenants.length);
    person.homeOffset = (slotIndex + 1) / (totalSlots + 1);
  }

  // Return people who are "out" based on their individual return schedule
  tryReturnPeople(hour) {
    const { people, tower } = this.gameState;

    for (const [, person] of people) {
      if (!person.isOut || person.hasReturnedToday) continue;
      // Only return people who have actually left the building (hidden = offscreen)
      if (!person.hidden) continue;

      const sched = person.schedule;
      let returnHour = 99;

      if (sched.type === 'apartment') {
        returnHour = sched.returnHour;
      } else if (sched.type === 'office') {
        returnHour = sched.arriveHour; // office workers "arrive" in the morning
      } else if (sched.type === 'retail') {
        returnHour = sched.arriveHour;
      } else if (sched.type === 'restaurant') {
        returnHour = sched.arriveHour;
      }

      if (hour >= returnHour) {
        person.hasReturnedToday = true;
        person.isOut = false;
        person.hidden = false;
        person.position.x = Math.random() > 0.5 ? 0 : TOWER_MAX_WIDTH;
        person.position.y = 0.5;
        person.floor = 0;
        person.state = 'spawning';
      }
    }
  }

  evictUnhappy() {
    const { tower, people } = this.gameState;

    for (const [, room] of tower.rooms) {
      // Only evict if satisfaction is very low for extended time
      if (room.satisfaction < 15) {
        for (const personId of room.tenants) {
          people.delete(personId);
        }
        room.tenants = [];
        room.state = 'empty';
      }
    }
  }

  // =====================
  // SATISFACTION
  // =====================

  updateSatisfaction() {
    const { tower } = this.gameState;

    for (const [, room] of tower.rooms) {
      if (room.type === 'lobby' || room.type === 'elevator') continue;

      let sat = 80;
      if (room.gridY <= 3) sat += 10;
      if (room.gridY > 2 && !this.hasElevatorAccess(room.gridY)) sat -= 30;
      if (room.gridY === 0) sat += 5;

      if (room.type === 'apartment') {
        for (let dx = -1; dx <= room.width; dx++) {
          const neighbor = tower.getRoomAt(room.gridX + dx, room.gridY);
          if (neighbor && neighbor.id !== room.id && neighbor.type === 'retail') {
            sat -= 10;
          }
        }
      }

      room.satisfaction = Math.max(0, Math.min(100, sat));
    }
  }

  hasElevatorAccess(floor) {
    for (const [, elevator] of this.gameState.tower.elevators) {
      if (floor >= elevator.minFloor && floor <= elevator.maxFloor) return true;
    }
    return false;
  }

  updateStats() {
    const { people, tower, stats } = this.gameState;
    stats.totalPopulation = people.size;

    let totalSat = 0;
    let roomCount = 0;
    for (const [, room] of tower.rooms) {
      if (room.type !== 'lobby' && room.type !== 'elevator') {
        totalSat += room.satisfaction;
        roomCount++;
      }
    }
    stats.averageSatisfaction = roomCount > 0 ? totalSat / roomCount : 100;
    eventBus.emit('statsChanged', stats);
  }

  stop() {
    clearInterval(this.intervalId);
  }
}
