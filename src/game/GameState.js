import { Tower } from './Tower.js';
import { STARTING_MONEY } from '../constants.js';
import { eventBus } from '../utils/EventBus.js';

export class GameState {
  constructor() {
    this.money = STARTING_MONEY;
    this.tower = new Tower();
    this.people = new Map();
    this.starRating = 1;
    this.selectedTool = null; // room type string or 'bulldoze' or null

    this.time = {
      day: 1,
      hour: 8.0,
      speed: 1, // 0=paused, 1=normal, 2=fast, 3=fastest
    };

    this.stats = {
      totalPopulation: 0,
      averageSatisfaction: 100,
      dailyIncome: 0,
      dailyExpense: 0,
    };

    // Satisfaction history — one entry per game day, last 30 days
    this.satisfactionHistory = [];
  }

  spendMoney(amount) {
    if (this.money < amount) return false;
    this.money -= amount;
    eventBus.emit('moneyChanged', this.money);
    return true;
  }

  earnMoney(amount) {
    this.money += amount;
    eventBus.emit('moneyChanged', this.money);
  }

  selectTool(tool) {
    this.selectedTool = tool;
    eventBus.emit('toolChanged', tool);
  }
}
