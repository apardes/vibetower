import { ROOM_TYPES, MAINTENANCE } from '../constants.js';
import { generateId } from '../utils/helpers.js';

const MAX_LOG_ENTRIES = 50;

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

    // Activity log — extensible event history
    this.log = [];
    this.logEvent('built', 'Unit constructed');

    // Maintenance state
    const mConfig = MAINTENANCE[type];
    this.maintenanceIssue = null; // null or { name, desc, cost }
    this.nextMaintenanceDay = mConfig
      ? Math.floor(mConfig.interval + (Math.random() - 0.5) * mConfig.variance * 2)
      : 999;
  }

  // Log an event.
  // type: category string (built, move_in, move_out, income, satisfaction, repair, etc.)
  // message: human-readable description
  // data: optional object with extra info
  // gameTime: optional { day, hour } from GameState
  logEvent(type, message, data, gameTime) {
    this.log.unshift({
      type,
      message,
      data: data || null,
      day: gameTime?.day || 0,
      hour: gameTime?.hour || 0,
    });
    if (this.log.length > MAX_LOG_ENTRIES) this.log.pop();
  }

  // Generate a random maintenance issue using weighted selection
  generateIssue() {
    const mConfig = MAINTENANCE[this.type];
    if (!mConfig || !mConfig.issues.length) return null;

    // Weighted random selection
    const totalWeight = mConfig.issues.reduce((sum, i) => sum + (i.weight || 1), 0);
    let roll = Math.random() * totalWeight;
    let template = mConfig.issues[0];
    for (const issue of mConfig.issues) {
      roll -= (issue.weight || 1);
      if (roll <= 0) { template = issue; break; }
    }

    const cost = Math.floor(template.costMin + Math.random() * (template.costMax - template.costMin));
    return { name: template.name, desc: template.desc, cost };
  }

  // Schedule the next maintenance event (days from now)
  scheduleNextMaintenance(currentDay) {
    const mConfig = MAINTENANCE[this.type];
    if (!mConfig) { this.nextMaintenanceDay = 999999; return; }
    this.nextMaintenanceDay = currentDay + mConfig.interval + Math.floor((Math.random() - 0.5) * mConfig.variance * 2);
  }

  // Repair the current issue
  repair(gameTime) {
    if (!this.maintenanceIssue) return 0;
    const cost = this.maintenanceIssue.cost;
    this.logEvent('repair', `Repaired: ${this.maintenanceIssue.name}`, { cost }, gameTime);
    this.maintenanceIssue = null;
    return cost;
  }

  get needsMaintenance() {
    return this.maintenanceIssue !== null;
  }

  get occupied() {
    return this.tenants.length > 0;
  }

  get occupancy() {
    if (this.capacity === 0) return 1;
    return this.tenants.length / this.capacity;
  }
}
