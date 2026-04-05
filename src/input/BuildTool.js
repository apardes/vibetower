import { eventBus } from '../utils/EventBus.js';
import { Room } from '../game/Room.js';
import { Elevator } from '../game/Elevator.js';
import { ROOM_TYPES, TOWER_MAX_WIDTH, TOWER_MAX_FLOORS } from '../constants.js';
import { worldToGrid } from '../utils/helpers.js';

export class BuildTool {
  constructor(gameState, tower, towerRenderer, gridOverlay, elevatorRenderer) {
    this.gameState = gameState;
    this.tower = tower;
    this.towerRenderer = towerRenderer;
    this.gridOverlay = gridOverlay;
    this.elevatorRenderer = elevatorRenderer;
    this.currentGridPos = null;

    // Elevator drag state
    this.elevatorDrag = null; // { gridX, startY }

    eventBus.on('mousemove', (pos) => this.onMouseMove(pos));
    eventBus.on('click', (pos) => this.onClick(pos));
    eventBus.on('mousedown', (pos) => this.onMouseDown(pos));
    eventBus.on('mouseup', (pos) => this.onMouseUp(pos));
    eventBus.on('rightclick', () => this.cancel());
    eventBus.on('keydown', ({ code }) => {
      if (code === 'Escape') this.cancel();
    });
    eventBus.on('toolChanged', (tool) => this.onToolChanged(tool));
  }

  onToolChanged(tool) {
    if (tool && tool !== 'bulldoze') {
      this.gridOverlay.show();
    } else {
      this.gridOverlay.hide();
    }
  }

  onMouseMove({ x, y }) {
    const tool = this.gameState.selectedTool;
    if (!tool || tool === 'bulldoze') return;

    const def = ROOM_TYPES[tool];
    if (!def) return;

    const grid = worldToGrid(x, y);

    if (tool === 'elevator' && this.elevatorDrag) {
      // Show elevator shaft preview from drag start to current position
      const minY = Math.min(this.elevatorDrag.startY, grid.gridY);
      const maxY = Math.max(this.elevatorDrag.startY, grid.gridY);
      const height = maxY - minY + 1;
      const gridX = this.elevatorDrag.gridX;
      const valid = this.canPlaceElevator(gridX, minY, maxY);
      this.gridOverlay.showPreview(gridX, minY, 1, height, valid, height);
      return;
    }

    // Center the room on cursor
    const gridX = tool === 'elevator' ? grid.gridX : Math.round(x - def.width / 2);
    const gridY = grid.gridY;

    this.currentGridPos = { gridX, gridY };

    if (tool === 'elevator') {
      this.gridOverlay.showPreview(gridX, gridY, 1, 1, this.canPlaceElevator(gridX, gridY, gridY));
    } else {
      const valid = this.canPlaceRoom(tool, gridX, gridY);
      this.gridOverlay.showPreview(gridX, gridY, def.width, def.height, valid);
    }
  }

  onMouseDown({ x, y }) {
    const tool = this.gameState.selectedTool;
    if (tool !== 'elevator') return;

    const grid = worldToGrid(x, y);
    this.elevatorDrag = { gridX: grid.gridX, startY: grid.gridY };
  }

  onMouseUp({ x, y }) {
    const tool = this.gameState.selectedTool;
    if (tool !== 'elevator' || !this.elevatorDrag) return;

    const grid = worldToGrid(x, y);
    const minY = Math.min(this.elevatorDrag.startY, grid.gridY);
    const maxY = Math.max(this.elevatorDrag.startY, grid.gridY);
    const gridX = this.elevatorDrag.gridX;

    this.elevatorDrag = null;

    if (maxY - minY < 1) return; // need at least 2 floors
    if (!this.canPlaceElevator(gridX, minY, maxY)) return;

    const floors = maxY - minY + 1;
    const cost = ROOM_TYPES.elevator.costPerFloor * floors;
    if (!this.gameState.spendMoney(cost)) return;

    const elevator = new Elevator(gridX, minY, maxY);
    this.tower.elevators.set(elevator.id, elevator);

    // Mark grid cells as occupied by elevator
    for (let fy = minY; fy <= maxY; fy++) {
      this.tower.grid[fy][gridX] = elevator.id;
    }

    this.elevatorRenderer.addElevator(elevator);
    eventBus.emit('elevatorPlaced', elevator);
  }

  onClick({ x, y }) {
    const tool = this.gameState.selectedTool;
    if (!tool) return;

    if (tool === 'bulldoze') {
      this.bulldoze(x, y);
      return;
    }

    // Elevators handled by mousedown/mouseup drag
    if (tool === 'elevator') return;

    if (!this.currentGridPos) return;
    const { gridX, gridY } = this.currentGridPos;

    if (!this.canPlaceRoom(tool, gridX, gridY)) return;

    const def = ROOM_TYPES[tool];

    if (!this.gameState.spendMoney(def.cost)) return;

    const room = new Room(tool, gridX, gridY);
    this.tower.placeRoom(room);
    this.towerRenderer.addRoom(room);

    eventBus.emit('roomPlaced', room);
  }

  canPlaceRoom(type, gridX, gridY) {
    const def = ROOM_TYPES[type];

    // Floor restriction (lobby must be on floor 0)
    if (def.floorRestriction !== undefined && gridY !== def.floorRestriction) return false;

    if (gridY < 0) return false;

    // Check grid overlap
    if (!this.tower.canPlace(gridX, gridY, def.width, def.height)) return false;

    // Check money
    if (this.gameState.money < def.cost) return false;

    // Star gate
    if (def.unlockStar > this.gameState.starRating) return false;

    // Every cell must be fully supported
    if (gridY > 0) {
      for (let dx = 0; dx < def.width; dx++) {
        if (!this.tower.getRoomAt(gridX + dx, gridY - 1)) return false;
      }
    }

    return true;
  }

  canPlaceElevator(gridX, minY, maxY) {
    if (gridX < 0 || gridX >= TOWER_MAX_WIDTH) return false;
    if (minY < 0 || maxY >= TOWER_MAX_FLOORS) return false;
    const floors = maxY - minY + 1;
    if (this.gameState.money < ROOM_TYPES.elevator.costPerFloor * floors) return false;

    // Check all cells are free
    for (let y = minY; y <= maxY; y++) {
      if (this.tower.grid[y][gridX] !== null) return false;
    }
    return true;
  }

  bulldoze(worldX, worldY) {
    const grid = worldToGrid(worldX, worldY);
    const room = this.tower.getRoomAt(grid.gridX, grid.gridY);

    if (room) {
      const refund = Math.floor(room.cost * 0.5);
      this.gameState.earnMoney(refund);
      this.tower.removeRoom(room.id);
      this.towerRenderer.removeRoom(room.id);
      eventBus.emit('roomRemoved', room);
      return;
    }

    // Check if it's an elevator
    const cellId = this.tower.grid[grid.gridY]?.[grid.gridX];
    if (cellId && this.tower.elevators.has(cellId)) {
      const elevator = this.tower.elevators.get(cellId);
      const floors = elevator.maxFloor - elevator.minFloor + 1;
      const refund = Math.floor(ROOM_TYPES.elevator.costPerFloor * floors * 0.5);
      this.gameState.earnMoney(refund);

      // Clear grid cells
      for (let y = elevator.minFloor; y <= elevator.maxFloor; y++) {
        this.tower.grid[y][elevator.gridX] = null;
      }
      this.tower.elevators.delete(cellId);
      this.elevatorRenderer.removeElevator(cellId);
      eventBus.emit('elevatorRemoved', elevator);
    }
  }

  cancel() {
    this.elevatorDrag = null;
    this.gameState.selectTool(null);
    this.gridOverlay.hide();
  }
}
