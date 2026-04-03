import { ROOM_TYPES } from '../constants.js';
import { generateId } from '../utils/helpers.js';

export class Room {
  constructor(type, gridX, gridY) {
    const def = ROOM_TYPES[type];
    this.id = generateId();
    this.type = type;
    this.gridX = gridX;
    this.gridY = gridY;
    this.width = def.width;
    this.height = def.height;
    this.cost = def.cost;
    this.income = def.income;
    this.capacity = def.capacity;
    this.color = def.color;
    this.name = def.name;
    this.tenants = [];
    this.satisfaction = 100;
    this.state = 'empty'; // 'empty', 'occupied', 'damaged'
  }

  get occupied() {
    return this.tenants.length > 0;
  }

  get occupancy() {
    if (this.capacity === 0) return 1;
    return this.tenants.length / this.capacity;
  }
}
