import { Toolbar } from './Toolbar.js';
import { HUD } from './HUD.js';

export class UIManager {
  constructor(gameState) {
    this.gameState = gameState;
    this.toolbar = new Toolbar(gameState);
    this.hud = new HUD(gameState);
  }
}
