import { eventBus } from '../utils/EventBus.js';

export class Economy {
  constructor(gameState) {
    this.gameState = gameState;
  }

  // Called once per game-day
  collectRent() {
    let totalIncome = 0;
    let totalExpense = 0;

    for (const [, room] of this.gameState.tower.rooms) {
      if (room.type === 'elevator') {
        // Elevator maintenance cost
        totalExpense += Math.abs(room.income);
      } else if (room.occupied || room.type === 'retail' || room.type === 'restaurant') {
        // Occupied rooms earn rent; retail/restaurants earn based on traffic
        let income = room.income;
        if (room.type === 'retail' || room.type === 'restaurant') {
          // Scale with population
          const popFactor = Math.min(1, this.gameState.stats.totalPopulation / 200);
          income = Math.floor(room.income * popFactor);
        }
        totalIncome += income;
      }
    }

    this.gameState.stats.dailyIncome = totalIncome;
    this.gameState.stats.dailyExpense = totalExpense;

    const net = totalIncome - totalExpense;
    if (net > 0) {
      this.gameState.earnMoney(net);
    } else if (net < 0) {
      this.gameState.money += net; // can go negative
      eventBus.emit('moneyChanged', this.gameState.money);
    }

    eventBus.emit('rentCollected', { income: totalIncome, expense: totalExpense, net });
  }
}
