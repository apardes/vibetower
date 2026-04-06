import { TOWER_MAX_WIDTH, TOWER_MAX_FLOORS } from '../constants.js';

export class Tower {
  constructor() {
    // 2D grid: grid[floor][x] = roomId or null
    this.grid = [];
    for (let y = 0; y < TOWER_MAX_FLOORS; y++) {
      this.grid[y] = new Array(TOWER_MAX_WIDTH).fill(null);
    }
    this.rooms = new Map();     // roomId -> Room
    this.elevators = new Map(); // elevatorId -> Elevator
  }

  // Check if a room can be placed at the given grid position
  canPlace(gridX, gridY, width, height) {
    // Bounds check
    if (gridX < 0 || gridX + width > TOWER_MAX_WIDTH) return false;
    if (gridY < 0 || gridY + height > TOWER_MAX_FLOORS) return false;

    // Overlap check
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        if (this.grid[gridY + dy][gridX + dx] !== null) return false;
      }
    }
    return true;
  }

  // Place a room on the grid
  placeRoom(room) {
    for (let dy = 0; dy < room.height; dy++) {
      for (let dx = 0; dx < room.width; dx++) {
        this.grid[room.gridY + dy][room.gridX + dx] = room.id;
      }
    }
    this.rooms.set(room.id, room);
  }

  // Remove a room from the grid
  removeRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (let dy = 0; dy < room.height; dy++) {
      for (let dx = 0; dx < room.width; dx++) {
        this.grid[room.gridY + dy][room.gridX + dx] = null;
      }
    }
    this.rooms.delete(roomId);
  }

  // Get the room at a grid position
  getRoomAt(gridX, gridY) {
    if (gridX < 0 || gridX >= TOWER_MAX_WIDTH) return null;
    if (gridY < 0 || gridY >= TOWER_MAX_FLOORS) return null;
    const roomId = this.grid[gridY][gridX];
    return roomId ? this.rooms.get(roomId) : null;
  }

  // Check if anything (room or elevator) occupies a grid cell
  isCellOccupied(gridX, gridY) {
    if (gridX < 0 || gridX >= TOWER_MAX_WIDTH) return false;
    if (gridY < 0 || gridY >= TOWER_MAX_FLOORS) return false;
    return this.grid[gridY][gridX] !== null;
  }

  // Check if a floor has any rooms
  floorHasRooms(floorY) {
    if (floorY < 0 || floorY >= TOWER_MAX_FLOORS) return false;
    return this.grid[floorY].some(cell => cell !== null);
  }

  // Check if there's a continuous walkable path between two x positions on a floor
  // Ground floor (0) is always walkable — people enter/exit the building there
  hasFloorPath(floorY, fromX, toX) {
    if (floorY === 0) return true;
    if (floorY < 0 || floorY >= TOWER_MAX_FLOORS) return false;
    const minX = Math.min(Math.floor(fromX), Math.floor(toX));
    const maxX = Math.max(Math.floor(fromX), Math.floor(toX));
    for (let x = minX; x <= maxX; x++) {
      if (x < 0 || x >= TOWER_MAX_WIDTH) continue;
      if (this.grid[floorY][x] === null) return false;
    }
    return true;
  }

  // Get the highest occupied floor
  getHighestFloor() {
    for (let y = TOWER_MAX_FLOORS - 1; y >= 0; y--) {
      if (this.floorHasRooms(y)) return y;
    }
    return 0;
  }
}
