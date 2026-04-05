import { BASE_TICK_HOURS, TICKS_PER_SECOND, TOWER_MAX_WIDTH, DEMAND_CONFIG, SATISFACTION_FACTORS, ROOM_TYPES, MOVEOUT_CONFIG, ELEVATOR_TIME_SCALE } from '../constants.js';

// Get spawn/exit x positions relative to the building
function getBuildingEdges(tower) {
  let minX = Infinity, maxX = -Infinity;
  for (const [, room] of tower.rooms) {
    minX = Math.min(minX, room.gridX);
    maxX = Math.max(maxX, room.gridX + room.width);
  }
  if (minX === Infinity) { minX = 498; maxX = 502; }
  return { left: minX - 15, right: maxX + 15 };
}
import { Economy } from './Economy.js';
import { Person } from './Person.js';
import { StarRating } from './StarRating.js';
import { eventBus } from '../utils/EventBus.js';

const WALK_SPEED = 4; // world units per game-hour

// Helper to get current game time for room logs
function gt(gameState) {
  return { day: gameState.time.day, hour: gameState.time.hour };
}

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
      this.checkMaintenance();
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
          // Periodically check if another elevator has a shorter queue
          if (Math.random() < 0.02) { // ~once per 2.5 seconds real time
            this.reconsiderElevator(person);
          }
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
      const destX = homeRoom.gridX + homeRoom.width / 2;
      const elevator = this.findNearestElevator(person.position.x, person.floor, homeRoom.gridY, destX);
      if (!elevator) {
        // No elevator — can't reach room, remove this person entirely
        homeRoom.tenants = homeRoom.tenants.filter(id => id !== person.id);
        this.gameState.people.delete(person.id);
        return;
      }
      this.startElevatorTrip(person, homeRoom.gridY, tickHours, homeRoom.gridX + homeRoom.width / 2);
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
      const _edges = getBuildingEdges(this.gameState.tower);
      person.targetX = Math.random() > 0.5 ? _edges.left - 2 : _edges.right + 2;
      person.targetFloor = -1;
    } else {
      // Take elevator down
      this.startElevatorTrip(person, 0, 0);
    }
  }

  // Start a trip: walk to elevator, queue up
  startElevatorTrip(person, destFloor, tickHours, destX) {
    const elevator = this.findNearestElevator(person.position.x, person.floor, destFloor, destX);
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
        person.elevatorWaitStart = this.gameState.time.hour + (this.gameState.time.day - 1) * 24;
        elevator.requestFloor(person.floor);
        return;
      }
    }

    // Walked off the map
    const _bEdges = getBuildingEdges(this.gameState.tower);
    if (person.isOut && (person.position.x < _bEdges.left - 1 || person.position.x > _bEdges.right + 1)) {
      if (person.movingOut) {
        // Permanent move-out — remove from building
        const room = this.gameState.tower.rooms.get(person.homeRoom);
        if (room) {
          room.tenants = room.tenants.filter(id => id !== person.id);
          room.vacancyCooldown = MOVEOUT_CONFIG.vacancyCooldown;
          const reason = person.satisfaction < 40 ? 'Low satisfaction' : 'Personal reasons';
          room.logEvent('move_out', `Tenant moved out: ${reason}`, { satisfaction: Math.round(person.satisfaction) }, gt(this.gameState));
          eventBus.emit('tenantMovedOut', { room, person, reason });
        }
        this.gameState.people.delete(person.id);
        return;
      }
      // Temporary daily departure
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
      this.startElevatorTrip(person, homeRoom.gridY, 0, homeRoom.gridX + homeRoom.width / 2);
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

  findNearestElevator(fromX, fromFloor, targetFloor, destX) {
    let best = null;
    let bestScore = Infinity;
    const tower = this.gameState.tower;
    const { people } = this.gameState;

    for (const [, elevator] of tower.elevators) {
      if (fromFloor >= elevator.minFloor && fromFloor <= elevator.maxFloor &&
          targetFloor >= elevator.minFloor && targetFloor <= elevator.maxFloor) {
        const elevX = elevator.gridX + 0.5;
        if (!tower.hasFloorPath(fromFloor, fromX, elevX)) continue;
        if (destX !== undefined && !tower.hasFloorPath(targetFloor, elevX, destX)) continue;

        // Count people waiting for this elevator
        let waitingCount = 0;
        for (const [, p] of people) {
          if (p.state === 'waiting_elevator' && p.elevatorId === elevator.id) waitingCount++;
        }

        // Score: distance + queue penalty (each waiting person = 2 units of distance)
        const dist = Math.abs(elevX - fromX);
        const score = dist + waitingCount * 2;

        if (score < bestScore) {
          bestScore = score;
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
      let boardingCount = 0;
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

          // Walk to home room if on the right floor AND there's a walkable path
          const homeRoom = tower.rooms.get(person.homeRoom);
          if (homeRoom && homeRoom.gridY === stoppedFloor &&
              tower.hasFloorPath(stoppedFloor, person.position.x, homeRoom.gridX + homeRoom.width / 2)) {
            person.targetX = homeRoom.gridX + person.homeOffset * homeRoom.width;
          } else if (stoppedFloor === 0 && person.isOut) {
            // Going outside
            const _edges = getBuildingEdges(this.gameState.tower);
      person.targetX = Math.random() > 0.5 ? _edges.left - 2 : _edges.right + 2;
          } else {
            person.targetX = person.position.x + (Math.random() > 0.5 ? 3 : -3);
          }

          person.targetFloor = -1;
          toRemove.push(personId);
        }
      }
      boardingCount += toRemove.length;
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
          // Record how long they waited — scaled by time compression and game speed
          const now = this.gameState.time.hour + (this.gameState.time.day - 1) * 24;
          const rawWait = Math.max(0, now - person.elevatorWaitStart);
          const speed = this.gameState.time.speed || 1;
          person.lastWaitTime = rawWait * ELEVATOR_TIME_SCALE / speed;
          elevator.recordWaitTime(person.lastWaitTime);

          // Alert if average wait time is high (in scaled minutes)
          if (elevator.avgWaitTime * 60 > 8 && !elevator.longWaitAlerted) {
            elevator.longWaitAlerted = true;
            eventBus.emit('elevatorLongWait', { elevator });
          } else if (elevator.avgWaitTime * 60 <= 5) {
            elevator.longWaitAlerted = false; // reset when wait times improve
          }

          // NOW request their destination floor
          elevator.requestFloor(person.targetFloor);
          boardingCount++;
        }
      }

      // Set stop duration based on how many people boarded/exited
      if (boardingCount > 0) {
        elevator.stopTimer = elevator.getStopDuration(boardingCount);
      }
    }
  }

  // =====================
  // DAY TRANSITIONS
  // =====================

  onNewDay() {
    this.economy.collectRent();
    this.starRating.evaluate();
    this.checkMoveOuts();

    // Decrement vacancy cooldowns
    for (const [, room] of this.gameState.tower.rooms) {
      if (room.vacancyCooldown > 0) room.vacancyCooldown--;
    }

    // Record daily satisfaction snapshot
    const hist = this.gameState.satisfactionHistory;
    hist.push({ day: this.gameState.time.day, satisfaction: Math.round(this.gameState.stats.averageSatisfaction) });
    if (hist.length > 30) hist.shift();

    // Reset daily flags for all people
    for (const [, person] of this.gameState.people) {
      person.resetDay();
    }

    eventBus.emit('newDay', this.gameState.time.day);
  }

  checkMaintenance() {
    const { tower, time } = this.gameState;
    const day = time.day;

    for (const [, room] of tower.rooms) {
      if (room.maintenanceIssue) continue;
      if (day < room.nextMaintenanceDay) continue;

      // Per-tick chance: spread issue arrival across the day
      // Base chance per check (~2 checks/sec) over a day (~1200 checks at 1x)
      // gives roughly one trigger per interval period
      let chance = 0.002;

      // Occupied units break down faster
      if (room.occupied) {
        const occRate = room.capacity > 0 ? room.tenants.length / room.capacity : 0.5;
        chance *= (1 + occRate * 0.5);
      }

      if (Math.random() > chance) continue;

      const issue = room.generateIssue();
      if (!issue) continue;

      room.maintenanceIssue = issue;
      room.maintenanceStartDay = day;
      room.scheduleNextMaintenance(day);
      room.logEvent('damage', `Issue: ${issue.name}`, { cost: issue.cost, severity: issue.severity }, gt(this.gameState));

      eventBus.emit('maintenanceNeeded', { room, issue });
    }
  }

  checkMoveOuts() {
    const { tower, people } = this.gameState;
    const cfg = MOVEOUT_CONFIG;

    for (const [, person] of people) {
      if (person.hidden || person.movingOut) continue;
      if (person.state !== 'in_room') continue;

      const room = tower.rooms.get(person.homeRoom);
      if (!room) continue;

      const comfortThreshold = cfg.comfortBase + person.tenantRating * cfg.comfortPerStar;

      let moveOutChance = cfg.baseChance;

      if (person.satisfaction < comfortThreshold) {
        const deficit = comfortThreshold - person.satisfaction;
        let bonus = (deficit / 100) * cfg.dissatisfactionScale;
        const ratingMult = 0.5 + person.tenantRating * 0.2;
        bonus *= ratingMult;
        const typeMult = cfg.typeMultiplier[room.type] || 1.0;
        bonus *= typeMult;
        moveOutChance += bonus;
      }

      if (Math.random() < moveOutChance) {
        this.permanentMoveOut(person, room);
      }
    }
  }

  reconsiderElevator(person) {
    if (!person.elevatorId || person.targetFloor < 0) return;
    const currentElev = this.gameState.tower.elevators.get(person.elevatorId);
    if (!currentElev) return;

    // Count people waiting for current elevator
    let currentQueue = 0;
    for (const [, p] of this.gameState.people) {
      if (p.state === 'waiting_elevator' && p.elevatorId === currentElev.id) currentQueue++;
    }

    // Only reconsider if queue is long enough to bother
    if (currentQueue < 3) return;

    // Find a better elevator
    const homeRoom = this.gameState.tower.rooms.get(person.homeRoom);
    const destX = homeRoom ? homeRoom.gridX + homeRoom.width / 2 : undefined;
    const better = this.findNearestElevator(person.position.x, person.floor, person.targetFloor, destX);

    if (better && better.id !== currentElev.id) {
      // Switch — walk to the new elevator
      person.elevatorId = better.id;
      person.targetX = better.gridX + 0.5;
      person.state = 'walking';
    }
  }

  permanentMoveOut(person, room) {
    person.movingOut = true;
    person.isOut = true;
    person.position.y = room.gridY + 0.5;

    if (room.gridY === 0) {
      person.state = 'walking';
      const _edges = getBuildingEdges(this.gameState.tower);
      person.targetX = Math.random() > 0.5 ? _edges.left - 2 : _edges.right + 2;
      person.targetFloor = -1;
    } else {
      this.startElevatorTrip(person, 0, 0);
    }
  }

  // Called every tick — trickle in new tenants and handle returns
  tickSpawnsAndReturns(hour) {
    this.trySpawnNewTenants(hour);
    this.tryReturnPeople(hour);
  }

  // Fill empty rooms based on dynamic building demand.
  // Demand varies by unit type, star rating, and building conditions.
  trySpawnNewTenants(hour) {
    if (hour < 6 || hour > 22) return;

    const { tower } = this.gameState;
    const star = this.gameState.starRating;
    const cfg = DEMAND_CONFIG;

    // Calculate building-wide factors
    let totalRooms = 0, occupiedRooms = 0, healthyRooms = 0, amenityCount = 0;
    for (const [, room] of tower.rooms) {
      if (room.type === 'elevator' || room.type === 'lobby') continue;
      totalRooms++;
      if (room.tenants.length > 0) occupiedRooms++;
      if (!room.maintenanceIssue) healthyRooms++;
      const def = ROOM_TYPES[room.type];
      if (def && def.amenityEffect) amenityCount++;
    }

    const occupancyRate = totalRooms > 0 ? occupiedRooms / totalRooms : 0;
    const maintenanceHealth = totalRooms > 0 ? healthyRooms / totalRooms : 1;
    const vacancyRate = totalRooms > 0 ? 1 - occupancyRate : 0;
    const amenityRatio = totalRooms > 0 ? Math.min(1, amenityCount / Math.max(totalRooms, 1)) : 0;

    const buildingBonus =
      occupancyRate * cfg.factors.occupancyRate +
      maintenanceHealth * cfg.factors.maintenanceHealth +
      amenityRatio * cfg.factors.amenityBonus +
      (vacancyRate > 0.5 ? cfg.factors.vacancyPenalty : 0);

    for (const [, room] of tower.rooms) {
      if (room.type === 'elevator' || room.type === 'lobby') continue;
      if (room.capacity <= 0) continue;
      if (room.tenants.length > 0) continue;
      if (room.vacancyCooldown > 0) continue;

      // Star-based demand multiplier for this unit type
      const starDemand = cfg.starDemand[room.type];
      const starMult = starDemand ? starDemand[Math.min(star, 5) - 1] || starDemand[0] : 0.5;

      // Elevator access bonus
      const hasElevator = room.gridY <= 2 || this.hasElevatorAccess(room.gridY);
      const elevatorBonus = (room.gridY > 0 && hasElevator) ? cfg.factors.elevatorAccess : 0;

      // Final spawn chance
      const chance = Math.max(0.0005, Math.min(0.01,
        cfg.baseChancePerTick * starMult * (1 + buildingBonus + elevatorBonus)
      ));

      if (Math.random() < chance) {
        const count = 1 + Math.floor(Math.random() * room.capacity);
        for (let i = 0; i < count; i++) {
          this.spawnPerson(room);
        }
        room.logEvent('move_in', `${count} tenant${count > 1 ? 's' : ''} moved in`, { count }, gt(this.gameState));
      }
    }
  }

  spawnPerson(room) {
    const { people } = this.gameState;
    const person = new Person(room.id, room.type);
    person.tenantRating = this.gameState.starRating;
    const edges = getBuildingEdges(this.gameState.tower);
    person.position.x = Math.random() > 0.5 ? edges.left : edges.right;
    person.position.y = 0.5;
    person.floor = 0;
    person.state = 'spawning';
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
        const edges = getBuildingEdges(this.gameState.tower);
        person.position.x = Math.random() > 0.5 ? edges.left : edges.right;
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
    const { tower, people, time } = this.gameState;
    const day = time.day;

    // Collect all rooms with maintenance issues and amenity effects for scoped lookups
    const issueRooms = [];
    const amenityRooms = [];
    for (const [, room] of tower.rooms) {
      if (room.maintenanceIssue) issueRooms.push(room);
      const def = ROOM_TYPES[room.type];
      if (def && def.amenityEffect) amenityRooms.push(room);
    }

    for (const [, room] of tower.rooms) {
      if (room.type === 'lobby' || room.type === 'elevator') continue;
      if (room.tenants.length === 0) {
        room.satisfaction = SATISFACTION_FACTORS.baseComfort[room.type] || 60;
        continue;
      }

      let totalSat = 0;

      for (const personId of room.tenants) {
        const person = people.get(personId);
        if (!person) continue;

        // Base comfort for unit type
        let sat = SATISFACTION_FACTORS.baseComfort[room.type] || 60;

        // Floor preference bonus
        const floorBonus = person.preferences.floorPreference * (room.gridY / 10) * SATISFACTION_FACTORS.floorBonus.maxBonus;
        sat += floorBonus;

        // No elevator access — trapped on upper floor, very unhappy
        if (room.gridY > 0 && !this.hasElevatorAccess(room.gridY)) {
          sat -= 30;
        }

        // Elevator wait time frustration — scales exponentially with tenant rating
        // lastWaitTime is already scaled to realistic minutes (via ELEVATOR_TIME_SCALE)
        const waitMinutes = person.lastWaitTime * 60;
        if (person.tenantRating > 1 && waitMinutes > SATISFACTION_FACTORS.elevatorWait.graceMinutes) {
          const excessMin = waitMinutes - SATISFACTION_FACTORS.elevatorWait.graceMinutes;
          const ratingScale = Math.pow(person.tenantRating - 1, 1.5) / Math.pow(4, 1.5);
          const waitPenalty = Math.min(
            SATISFACTION_FACTORS.elevatorWait.maxPenalty * ratingScale,
            excessMin * SATISFACTION_FACTORS.elevatorWait.penaltyPerMinute * ratingScale
          );
          sat -= waitPenalty;
        }

        // Noise from adjacent retail/restaurant
        for (let dx = -1; dx <= room.width; dx++) {
          const neighbor = tower.getRoomAt(room.gridX + dx, room.gridY);
          if (!neighbor || neighbor.id === room.id) continue;
          const noisePenalty = SATISFACTION_FACTORS.noisePenalty[neighbor.type];
          if (noisePenalty) {
            // Reduce penalty by noise tolerance
            sat += noisePenalty * (1 - person.preferences.noiseTolerance * 0.7);
          }
        }

        // === Maintenance impact ===
        // Own room issue
        if (room.maintenanceIssue) {
          const sev = room.maintenanceIssue.severity || 1;
          const daysUnresolved = Math.max(0, day - room.maintenanceStartDay);
          const penalty = (sev * -4 * (1 + daysUnresolved * 0.8));
          sat += penalty;
        }

        // Other rooms' issues that affect this tenant
        for (const iRoom of issueRooms) {
          if (iRoom.id === room.id) continue; // already handled above
          const def = ROOM_TYPES[iRoom.type];
          if (!def || !def.maintenanceImpact) continue;
          const impact = def.maintenanceImpact;

          // Check if this tenant is in the affected set
          let affected = false;
          if (impact.target === 'all') {
            affected = true;
          } else if (impact.target === 'elevator') {
            // Check if this person's floor is serviced by the same elevator
            for (const [, elev] of tower.elevators) {
              if (elev.gridX === iRoom.gridX &&
                  room.gridY >= elev.minFloor && room.gridY <= elev.maxFloor) {
                affected = true;
                break;
              }
            }
          } else if (impact.target === 'subset') {
            // Determine if this tenant is in the subset
            if (impact.selection === 'proximity') {
              const floorDist = Math.abs(room.gridY - iRoom.gridY);
              const proximityChance = impact.reach * Math.max(0.3, 1 - floorDist * 0.05);
              // Use stable hash so same tenants stay affected between ticks
              const hash = (person.id.charCodeAt(2) || 0) + iRoom.id.charCodeAt(2) || 0;
              affected = (hash % 100) / 100 < proximityChance;
            } else {
              // random selection — stable per tenant+room pair
              const hash = (person.id.charCodeAt(3) || 0) + (iRoom.id.charCodeAt(3) || 0);
              affected = (hash % 100) / 100 < impact.reach;
            }
          }

          if (affected) {
            const sev = iRoom.maintenanceIssue.severity || 1;
            const daysUnresolved = Math.max(0, day - iRoom.maintenanceStartDay);
            const basePenalty = (sev * -4 * (1 + daysUnresolved * 0.8));
            sat += basePenalty * impact.intensity;
          }
        }

        // === Amenity effects ===
        for (const aRoom of amenityRooms) {
          const def = ROOM_TYPES[aRoom.type];
          const ae = def.amenityEffect;
          if (!ae) continue;
          if (!ae.appealsTo.includes(room.type)) continue;

          let benefited = false;
          if (ae.target === 'all') {
            benefited = true;
          } else if (ae.target === 'subset') {
            if (ae.selection === 'proximity') {
              const floorDist = Math.abs(room.gridY - aRoom.gridY);
              const proximityChance = ae.reach * Math.max(0.4, 1 - floorDist * 0.03);
              const hash = (person.id.charCodeAt(1) || 0) + (aRoom.id.charCodeAt(1) || 0);
              benefited = (hash % 100) / 100 < proximityChance;
            } else {
              const hash = (person.id.charCodeAt(4) || 0) + (aRoom.id.charCodeAt(4) || 0);
              benefited = (hash % 100) / 100 < ae.reach;
            }
          }

          if (benefited) {
            const boost = ae.boostMin + person.preferences.amenitySensitivity * (ae.boostMax - ae.boostMin);
            sat += boost;
          }
        }

        // Clamp target satisfaction
        const targetSat = Math.max(0, Math.min(100, sat));

        // Satisfaction drops fast but recovers at a rate based on current happiness.
        // Happy tenants gain satisfaction faster. Unhappy tenants recover very slowly.
        if (targetSat < person.satisfaction) {
          // Dropping — immediate
          person.satisfaction = targetSat;
        } else {
          // Recovery rate scales with current satisfaction:
          // At 0 satisfaction: 0.1 per cycle (very slow — deeply unhappy, hard to win back)
          // At 50 satisfaction: 0.5 per cycle (moderate)
          // At 70+ satisfaction: 1.0+ per cycle (happy tenants warm up quickly)
          const recoveryRate = 0.05 + (person.satisfaction / 100) * 0.45;
          person.satisfaction = Math.min(targetSat, person.satisfaction + recoveryRate);
        }

        totalSat += person.satisfaction;
      }

      // Room satisfaction = average of tenant satisfactions
      room.satisfaction = Math.round(totalSat / room.tenants.length);
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
