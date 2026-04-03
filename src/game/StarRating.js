import { STAR_THRESHOLDS } from '../constants.js';
import { eventBus } from '../utils/EventBus.js';

export class StarRating {
  constructor(gameState) {
    this.gameState = gameState;
  }

  evaluate() {
    const { totalPopulation, averageSatisfaction } = this.gameState.stats;
    let newRating = 1;

    for (const threshold of STAR_THRESHOLDS) {
      if (totalPopulation >= threshold.population && averageSatisfaction >= threshold.satisfaction) {
        newRating = threshold.star;
      }
    }

    if (newRating !== this.gameState.starRating) {
      const old = this.gameState.starRating;
      this.gameState.starRating = newRating;
      eventBus.emit('starChanged', { old, new: newRating });
    }
  }
}
