import { Toolbar } from './Toolbar.js';
import { HUD } from './HUD.js';
import { ActivityLog } from './ActivityLog.js';

export class UIManager {
  constructor(gameState) {
    this.gameState = gameState;
    this.toolbar = new Toolbar(gameState);
    this.hud = new HUD(gameState);
    this.activityLog = new ActivityLog(gameState);
    this.hud.leftSection.appendChild(this.activityLog.btn);
  }
}
