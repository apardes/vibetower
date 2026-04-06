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

    // Clean up visitors when an amenity room is demolished
    eventBus.on('roomRemoved', (room) => {
      if (room.visitors && room.visitors.length > 0) {
        for (const personId of room.visitors) {
          const person = gameState.people.get(personId);
          if (person && person.visitingRoom === room.id) {
            person.visitingRoom = null;
            person.visitEndHour = 0;
            // Route them back home
            const homeRoom = gameState.tower.rooms.get(person.homeRoom);
            if (homeRoom && person.state === 'in_room') {
              if (person.floor === homeRoom.gridY) {
                person.state = 'walking';
                person.targetX = homeRoom.gridX + person.homeOffset * homeRoom.width;
                person.targetFloor = -1;
              } else {
                this.startElevatorTrip(person, homeRoom.gridY, 0, homeRoom.gridX + homeRoom.width / 2);
              }
            }
          }
        }
      }
    });

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

    // Scale update intervals by speed so game systems run proportionally faster
    const speed = time.speed || 1;
    const baseSatInterval = Math.max(10, Math.min(40, Math.floor(this.gameState.people.size / 25)));
    const satInterval = Math.max(1, Math.round(baseSatInterval / speed));
    if (this.tickCount % satInterval === 0) {
      this.updateSatisfaction();
      this.updateStats();
      this.checkMaintenance();
    }

    // Move-out checks scale with speed
    const moveOutInterval = Math.max(1, Math.round(5 / speed));
    if (this.tickCount % moveOutInterval === 0) {
      this.checkMoveOuts(moveOutInterval);
    }

    // Safety net: recount elevator waiting counts every 20 ticks
    const queueInterval = Math.max(1, Math.round(20 / speed));
    if (this.tickCount % queueInterval === 0) {
      this.recountElevatorQueues();
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
          if (Math.random() < 0.02 * (this.gameState.time.speed || 1)) {
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

    // If visiting an amenity, check if visit is over (before floor guard —
    // person may be on a different floor than their home room)
    if (person.visitingRoom) {
      // Handle midnight wrap: if visitEndHour >= 24, the hour has reset to 0+
      const visitOver = person.visitEndHour >= 24
        ? (hour >= person.visitEndHour - 24)
        : (hour >= person.visitEndHour);
      if (visitOver) {
        this.endAmenityVisit(person);
      }
      return;
    }

    // Don't process schedule if person isn't actually on their room's floor
    if (person.floor !== homeRoom.gridY) return;

    // Check if it's time for a planned amenity visit
    if (person.plannedVisits.length > 0 && !person.isOut) {
      const nextVisit = person.plannedVisits[0];
      if (hour >= nextVisit.hour) {
        if (this.startAmenityVisit(person, homeRoom)) {
          return;
        }
        person.plannedVisits.shift(); // failed, skip this visit
      }
    }

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

  // ==================
  // Amenity visits
  // ==================

  startAmenityVisit(person, homeRoom) {
    const amenityRoom = this.findAvailableAmenity(person, homeRoom);
    if (!amenityRoom) return false;

    person.plannedVisits.shift();
    person.visitingRoom = amenityRoom.id;

    const vc = ROOM_TYPES[amenityRoom.type].visitConfig;
    const duration = vc.visitDuration[0] + Math.random() * (vc.visitDuration[1] - vc.visitDuration[0]);
    person.visitEndHour = this.gameState.time.hour + duration;

    amenityRoom.visitors.push(person.id);

    // Route to amenity room
    if (amenityRoom.gridY === person.floor) {
      person.state = 'walking';
      person.targetX = amenityRoom.gridX + Math.random() * amenityRoom.width;
      person.targetFloor = -1;
      person.elevatorId = null;
    } else {
      this.startElevatorTrip(person, amenityRoom.gridY, 0, amenityRoom.gridX + amenityRoom.width / 2);
    }
    return true;
  }

  findAvailableAmenity(person, homeRoom) {
    const { tower, time } = this.gameState;
    let best = null;
    let bestScore = Infinity;

    for (const [, room] of tower.rooms) {
      const def = ROOM_TYPES[room.type];
      if (!def || !def.visitConfig) continue;
      if (!def.visitConfig.appealsTo.includes(homeRoom.type)) continue;

      // Check operating hours — also ensure visit can finish before closing/midnight
      const vc = def.visitConfig;
      if (time.hour < vc.operatingHours[0]) continue;
      if (time.hour + vc.visitDuration[0] > Math.min(vc.operatingHours[1], 23.5)) continue;

      // Check visitor capacity
      if (room.visitors.length >= def.visitConfig.visitorCapacity) continue;

      // Check reachability
      if (room.gridY !== homeRoom.gridY) {
        if (!this.hasElevatorAccess(room.gridY) || !this.hasElevatorAccess(homeRoom.gridY)) continue;
      }

      // Score: prefer closer amenities, with randomness to spread visitors
      const floorDist = Math.abs(room.gridY - homeRoom.gridY);
      const xDist = Math.abs((room.gridX + room.width / 2) - (homeRoom.gridX + homeRoom.width / 2));
      const score = floorDist * 3 + xDist + Math.random() * 2;

      if (score < bestScore) {
        bestScore = score;
        best = room;
      }
    }

    return best;
  }

  endAmenityVisit(person) {
    const { tower } = this.gameState;
    const amenityRoom = tower.rooms.get(person.visitingRoom);

    // Remove from amenity visitor list
    if (amenityRoom) {
      amenityRoom.visitors = amenityRoom.visitors.filter(id => id !== person.id);
    }

    // Apply satisfaction boost
    const def = amenityRoom ? ROOM_TYPES[amenityRoom.type] : null;
    if (def && def.visitConfig) {
      const vc = def.visitConfig;
      const boost = vc.satisfactionBoost[0] +
        person.preferences.amenitySensitivity * (vc.satisfactionBoost[1] - vc.satisfactionBoost[0]);
      person.visitSatisfactionBonus += boost;
    }

    person.completedVisitsToday++;
    person.visitingRoom = null;
    person.visitEndHour = 0;

    // Route back to home room
    const homeRoom = tower.rooms.get(person.homeRoom);
    if (!homeRoom) return;

    if (person.floor === homeRoom.gridY) {
      person.state = 'walking';
      person.targetX = homeRoom.gridX + person.homeOffset * homeRoom.width;
      person.targetFloor = -1;
      person.elevatorId = null;
    } else {
      this.startElevatorTrip(person, homeRoom.gridY, 0, homeRoom.gridX + homeRoom.width / 2);
    }
  }

  // Start a trip: walk to elevator, queue up
  startElevatorTrip(person, destFloor, tickHours, destX) {
    const elevator = this.findNearestElevator(person.position.x, person.floor, destFloor, destX);
    if (!elevator) {
      // No elevator available — cancel the trip
      if (person.movingOut) {
        // Elevator vanished between pre-check and trip — reset, retry tomorrow
        person.movingOut = false;
      }
      // Cancel any in-progress amenity visit
      if (person.visitingRoom) {
        const aRoom = this.gameState.tower.rooms.get(person.visitingRoom);
        if (aRoom) aRoom.visitors = aRoom.visitors.filter(id => id !== person.id);
        person.visitingRoom = null;
        person.visitEndHour = 0;
      }
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
        elevator.waitingCount++;
        elevator.requestFloor(person.floor);
        return;
      }
    }

    // Walked off the map
    const _bEdges = getBuildingEdges(this.gameState.tower);
    if (person.isOut && (person.position.x < _bEdges.left - 1 || person.position.x > _bEdges.right + 1)) {
      if (person.movingOut) {
        // Already removed from room.tenants in permanentMoveOut — just delete the person
        const room = this.gameState.tower.rooms.get(person.homeRoom);
        if (room) {
          room.logEvent('move_out', `Tenant left the building`,
            { satisfaction: Math.round(person.satisfaction) }, gt(this.gameState));
          eventBus.emit('tenantMovedOut', { room, person, reason: 'Low satisfaction' });
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

    // Arriving at an amenity room?
    if (person.visitingRoom) {
      const amenityRoom = this.gameState.tower.rooms.get(person.visitingRoom);
      if (amenityRoom && person.floor === amenityRoom.gridY) {
        this.arriveAtRoom(person, amenityRoom);
        return;
      }
      // Wrong floor — take elevator (shouldn't normally happen, but defensive)
      if (amenityRoom) {
        this.startElevatorTrip(person, amenityRoom.gridY, 0, amenityRoom.gridX + amenityRoom.width / 2);
        return;
      }
      // Amenity gone — clear visit and fall through to home room
      person.visitingRoom = null;
      person.visitEndHour = 0;
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

    for (const [, elevator] of tower.elevators) {
      if (fromFloor >= elevator.minFloor && fromFloor <= elevator.maxFloor &&
          targetFloor >= elevator.minFloor && targetFloor <= elevator.maxFloor) {
        const elevX = elevator.gridX + 0.5;
        if (!tower.hasFloorPath(fromFloor, fromX, elevX)) continue;
        if (destX !== undefined && !tower.hasFloorPath(targetFloor, elevX, destX)) continue;

        // Score: distance + queue penalty (cached count, O(1))
        const dist = Math.abs(elevX - fromX);
        const score = dist + elevator.waitingCount * 2;

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

    // Ensure every waiting/riding person's floor is requested (defensive retry, batched)
    const retryInterval = Math.max(1, Math.round(10 / (this.gameState.time.speed || 1)));
    if (this.tickCount % retryInterval === 0) {
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

          // Walk to destination: amenity visit, home room, or outside
          const homeRoom = tower.rooms.get(person.homeRoom);
          if (person.visitingRoom) {
            // Walking to amenity room
            const amenityRoom = tower.rooms.get(person.visitingRoom);
            if (amenityRoom && amenityRoom.gridY === stoppedFloor) {
              person.targetX = amenityRoom.gridX + Math.random() * amenityRoom.width;
            } else if (homeRoom && homeRoom.gridY === stoppedFloor) {
              person.targetX = homeRoom.gridX + person.homeOffset * homeRoom.width;
            } else {
              person.targetX = person.position.x + (Math.random() > 0.5 ? 3 : -3);
            }
          } else if (homeRoom && homeRoom.gridY === stoppedFloor &&
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
          elevator.waitingCount = Math.max(0, elevator.waitingCount - 1);
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

    // Decrement vacancy cooldowns
    for (const [, room] of this.gameState.tower.rooms) {
      if (room.vacancyCooldown > 0) room.vacancyCooldown--;
    }

    // Record daily satisfaction snapshot
    const hist = this.gameState.satisfactionHistory;
    hist.push({ day: this.gameState.time.day, satisfaction: Math.round(this.gameState.stats.averageSatisfaction) });
    if (hist.length > 30) hist.shift();

    // Clean up stale visit state and reset daily flags
    for (const [, room] of this.gameState.tower.rooms) {
      room.visitors = [];
    }
    for (const [, person] of this.gameState.people) {
      if (person.visitingRoom) {
        person.visitingRoom = null;
        person.visitEndHour = 0;
      }
      person.resetDay();
    }

    this.generateVisitSchedules();
    eventBus.emit('newDay', this.gameState.time.day);
  }

  generateVisitSchedules() {
    const { tower, people } = this.gameState;

    // Collect amenity rooms with visitConfig
    const amenityRooms = [];
    for (const [, room] of tower.rooms) {
      const def = ROOM_TYPES[room.type];
      if (def && def.visitConfig) amenityRooms.push(room);
    }
    if (amenityRooms.length === 0) return;

    // Build lookup: which amenity types appeal to which home room types
    const appealMap = {}; // homeType -> [visitConfig, ...]
    for (const aRoom of amenityRooms) {
      const vc = ROOM_TYPES[aRoom.type].visitConfig;
      for (const homeType of vc.appealsTo) {
        if (!appealMap[homeType]) appealMap[homeType] = [];
        // Only add unique visit configs (by amenity type)
        if (!appealMap[homeType].some(c => c === vc)) {
          appealMap[homeType].push(vc);
        }
      }
    }

    for (const [, person] of people) {
      const homeRoom = tower.rooms.get(person.homeRoom);
      if (!homeRoom) continue;

      const configs = appealMap[homeRoom.type];
      if (!configs || configs.length === 0) continue;

      // Determine active hours based on schedule
      const sched = person.schedule;
      if (!sched) continue;

      const activeWindows = [];
      if (sched.type === 'apartment') {
        if (sched.staysHome) {
          // Home all day — can visit anytime during amenity hours
          activeWindows.push([6, 22]);
        } else {
          // Before leaving and after returning
          if (sched.leaveHour > 6.5) activeWindows.push([6, sched.leaveHour - 0.5]);
          if (sched.returnHour < 22) activeWindows.push([sched.returnHour + 0.5, 22]);
        }
      } else if (sched.type === 'office') {
        // During work hours (lunch break, coffee run)
        if (sched.arriveHour < sched.departHour - 1) {
          activeWindows.push([sched.arriveHour + 0.5, sched.departHour - 0.5]);
        }
      }
      // Retail/restaurant staff don't visit amenities

      if (activeWindows.length === 0) continue;

      // Pick number of visits: max across all appealing amenity configs
      let maxVisits = 0;
      for (const vc of configs) {
        const range = vc.dailyVisitsPerPerson;
        const num = range[0] + Math.round(person.preferences.amenitySensitivity * (range[1] - range[0]));
        maxVisits = Math.max(maxVisits, num);
      }
      if (maxVisits <= 0) continue;

      // Generate visit hours spread across active windows
      const totalActiveHours = activeWindows.reduce((sum, [s, e]) => sum + (e - s), 0);
      if (totalActiveHours < 0.5) continue;

      const visits = [];
      for (let i = 0; i < maxVisits; i++) {
        // Pick a random point in the combined active windows
        let r = Math.random() * totalActiveHours;
        let hour = 0;
        for (const [start, end] of activeWindows) {
          const span = end - start;
          if (r < span) {
            hour = start + r;
            break;
          }
          r -= span;
        }
        visits.push({ hour });
      }

      visits.sort((a, b) => a.hour - b.hour);
      person.plannedVisits = visits;
    }
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

  checkMoveOuts(satInterval) {
    const { tower, people } = this.gameState;
    const cfg = MOVEOUT_CONFIG;
    const speed = this.gameState.time.speed || 1;
    const ticksPerDay = 24 / (BASE_TICK_HOURS * speed);
    const checksPerDay = ticksPerDay / satInterval;

    for (const [, room] of tower.rooms) {
      if (room.type === 'elevator' || room.type === 'lobby') continue;
      if (room.tenants.length === 0) continue;

      // Use the tenants' own rating to determine their threshold.
      // All tenants in a room share the same rating (moved in at same star level).
      const firstPerson = people.get(room.tenants[0]);
      if (!firstPerson) continue;
      const tenantRating = Math.min(Math.max(firstPerson.tenantRating, 1), 5);
      const threshold = cfg.thresholds[tenantRating];

      let dailyChance = cfg.baseChance;

      if (room.satisfaction < threshold) {
        // Each rating has a band — tenants are gone by the bottom, not by 0
        // Star 1: 30→0, Star 2: 50→30, Star 3: 70→55, Star 4: 80→69, Star 5: 90→79
        const goneBy = [0, 0, 30, 55, 69, 79];
        const range = threshold - goneBy[tenantRating];
        const deficitRatio = Math.min(1, (threshold - room.satisfaction) / Math.max(range, 1));

        const floor = Math.min(0.95, 0.30 + (tenantRating - 1) * 0.15);
        const ceiling = 0.95;
        let bonus = floor + deficitRatio * (ceiling - floor);
        bonus *= (cfg.typeMultiplier[room.type] || 1.0);
        dailyChance += bonus;
      }

      // Scale to per-check: 1 - (1 - daily)^(1/checksPerDay)
      const perCheckChance = 1 - Math.pow(1 - Math.min(1, dailyChance), 1 / checksPerDay);

      if (Math.random() < perCheckChance) {
        this.moveOutRoom(room);
      }
    }
  }

  moveOutRoom(room) {
    const { people } = this.gameState;
    const tenantIds = [...room.tenants];
    let anyRemoved = false;

    for (const personId of tenantIds) {
      const person = people.get(personId);
      if (!person) {
        room.tenants = room.tenants.filter(id => id !== personId);
        anyRemoved = true;
        continue;
      }
      if (person.movingOut) continue;

      // Clean up amenity visit if person is visiting somewhere
      if (person.visitingRoom) {
        const amenityRoom = this.gameState.tower.rooms.get(person.visitingRoom);
        if (amenityRoom) {
          amenityRoom.visitors = amenityRoom.visitors.filter(id => id !== person.id);
        }
        person.visitingRoom = null;
        person.visitEndHour = 0;
      }

      if (person.hidden) {
        // Already off-screen — direct removal
        this.removeTenant(person, room);
        anyRemoved = true;
      } else if (person.state === 'in_room') {
        this.permanentMoveOut(person, room);
      }
      // In-transit people: skip — caught next day
    }

    if (anyRemoved && room.tenants.length === 0) {
      room.vacancyCooldown = MOVEOUT_CONFIG.vacancyCooldown;
    }
  }

  recountElevatorQueues() {
    const { tower, people } = this.gameState;
    for (const [, elev] of tower.elevators) {
      elev.waitingCount = 0;
    }
    for (const [, person] of people) {
      if (person.state === 'waiting_elevator' && person.elevatorId) {
        const elev = tower.elevators.get(person.elevatorId);
        if (elev) elev.waitingCount++;
      }
    }
  }

  reconsiderElevator(person) {
    if (!person.elevatorId || person.targetFloor < 0) return;
    const currentElev = this.gameState.tower.elevators.get(person.elevatorId);
    if (!currentElev) return;

    // Use cached queue count
    if (currentElev.waitingCount < 3) return;

    // Find a better elevator
    const homeRoom = this.gameState.tower.rooms.get(person.homeRoom);
    const destX = homeRoom ? homeRoom.gridX + homeRoom.width / 2 : undefined;
    const better = this.findNearestElevator(person.position.x, person.floor, person.targetFloor, destX);

    if (better && better.id !== currentElev.id) {
      // Switch — decrement old, walk to new (increment happens on arrival)
      currentElev.waitingCount = Math.max(0, currentElev.waitingCount - 1);
      person.elevatorId = better.id;
      person.targetX = better.gridX + 0.5;
      person.state = 'walking';
    }
  }

  permanentMoveOut(person, room) {
    if (room.gridY === 0) {
      // Ground floor — walk off
      person.movingOut = true;
      person.isOut = true;
      person.hidden = false;
      person.position.y = 0.5;
      person.state = 'walking';
      const _edges = getBuildingEdges(this.gameState.tower);
      person.targetX = Math.random() > 0.5 ? _edges.left - 2 : _edges.right + 2;
      person.targetFloor = -1;
      // Remove from room immediately — lease is broken
      room.tenants = room.tenants.filter(id => id !== person.id);
      if (room.tenants.length === 0) room.vacancyCooldown = MOVEOUT_CONFIG.vacancyCooldown;
    } else {
      // Upper floor — need elevator
      const elevator = this.findNearestElevator(person.position.x, room.gridY, 0, undefined);
      if (elevator) {
        person.movingOut = true;
        person.isOut = true;
        person.hidden = false;
        person.position.y = room.gridY + 0.5;
        this.startElevatorTrip(person, 0, 0);
        // Remove from room immediately — lease is broken
        room.tenants = room.tenants.filter(id => id !== person.id);
        if (room.tenants.length === 0) room.vacancyCooldown = MOVEOUT_CONFIG.vacancyCooldown;
      }
      // No elevator → stay stuck. Re-evaluated next day.
    }
  }

  removeTenant(person, room) {
    room.tenants = room.tenants.filter(id => id !== person.id);
    const reason = person.satisfaction < 40 ? 'Low satisfaction' : 'Personal reasons';
    room.logEvent('move_out', `Tenant moved out: ${reason}`,
      { satisfaction: Math.round(person.satisfaction) }, gt(this.gameState));
    eventBus.emit('tenantMovedOut', { room, person, reason });
    this.gameState.people.delete(person.id);
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

    // Satisfaction gate — don't attract tenants to miserable buildings
    const avgSat = this.gameState.stats.averageSatisfaction;
    if (avgSat < MOVEOUT_CONFIG.spawnSatisfactionFloor) return;

    let satisfactionMult = 1.0;
    if (avgSat < MOVEOUT_CONFIG.spawnSatisfactionSoftCap) {
      const penalty = MOVEOUT_CONFIG.spawnSatisfactionSoftCap - avgSat;
      satisfactionMult = Math.max(0.05, 1 - penalty * MOVEOUT_CONFIG.spawnPenaltyPerPoint);
    }

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

      // Final spawn chance — gated by satisfaction
      const speed = this.gameState.time.speed || 1;
      const chance = Math.max(0.0005, Math.min(0.01,
        cfg.baseChancePerTick * speed * starMult * (1 + buildingBonus + elevatorBonus) * satisfactionMult
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
    const person = new Person(room.id, room.type, this.gameState.starRating);
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
      // Look up star-indexed base comfort
      const comfortTable = SATISFACTION_FACTORS.baseComfort[room.type];
      const starIndex = Math.max(0, (this.gameState.starRating || 1) - 1);
      const baseComfort = (Array.isArray(comfortTable) ? comfortTable[starIndex] : comfortTable) || 50;

      if (room.tenants.length === 0) {
        room.satisfaction = baseComfort;
        continue;
      }

      let totalSat = 0;

      for (const personId of room.tenants) {
        const person = people.get(personId);
        if (!person) continue;

        // Base comfort for unit type (scaled by building star rating)
        let sat = baseComfort;

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
          const penalty = (sev * -4 * (1 + daysUnresolved * sev * 0.1));
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
        // Visit-based bonus: reward for actually visiting amenities today
        if (person.visitSatisfactionBonus > 0) {
          sat += person.visitSatisfactionBonus;
        }

        // Reduced passive proximity bonus (~30% of original) — keeps amenities
        // slightly valuable even before the first visit of the day
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
            const boost = (ae.boostMin + person.preferences.amenitySensitivity * (ae.boostMax - ae.boostMin)) * 0.3;
            sat += boost;
          }
        }

        // Clamp target satisfaction
        const targetSat = Math.max(0, Math.min(100, sat));

        // Satisfaction drops fast but recovers with diminishing returns.
        // Recovery slows as satisfaction rises — reaching 90+ is genuinely hard.
        if (targetSat < person.satisfaction) {
          // Drop: fast but not instant — tenants notice problems over time
          const dropRate = 0.8 + (person.satisfaction - targetSat) * 0.05;
          person.satisfaction = Math.max(targetSat, person.satisfaction - dropRate);
        } else {
          // Recovery rate slows as satisfaction rises (diminishing returns):
          // At 0 satisfaction: 0.45 per cycle (decent recovery from rock bottom)
          // At 50 satisfaction: 0.16 per cycle
          // At 70 satisfaction: 0.07 per cycle
          // At 90+ satisfaction: 0.03 per cycle (slow — 5-star territory is hard)
          const recoveryRate = 0.45 * Math.pow(1 - person.satisfaction / 100, 1.5);
          person.satisfaction = Math.min(targetSat, person.satisfaction + Math.max(0.03, recoveryRate));
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
    let occupiedCount = 0;
    for (const [, room] of tower.rooms) {
      if (room.type !== 'lobby' && room.type !== 'elevator' && room.tenants.length > 0) {
        totalSat += room.satisfaction;
        occupiedCount++;
      }
    }
    stats.averageSatisfaction = occupiedCount > 0 ? totalSat / occupiedCount : 100;
    eventBus.emit('statsChanged', stats);
  }

  stop() {
    clearInterval(this.intervalId);
  }
}
