import { eventBus } from '../utils/EventBus.js';
import { worldToGrid, formatMoney } from '../utils/helpers.js';

export class Tooltip {
  constructor(gameState) {
    this.gameState = gameState;
    this.el = document.createElement('div');
    this.el.id = 'tooltip';
    this.el.style.cssText = `
      position: fixed;
      padding: 8px 12px;
      background: rgba(10, 10, 20, 0.92);
      color: #ddd;
      border: 1px solid #555;
      border-radius: 6px;
      font-family: 'Segoe UI', sans-serif;
      font-size: 12px;
      pointer-events: none;
      z-index: 200;
      display: none;
      line-height: 1.5;
      max-width: 220px;
    `;
    document.body.appendChild(this.el);

    eventBus.on('mousemove', (pos) => this.onMouseMove(pos));
  }

  onMouseMove({ x, y, screenX, screenY, pointerType }) {
    // Don't show tooltip on touch devices (useless under a finger)
    if (pointerType === 'touch') {
      this.el.style.display = 'none';
      return;
    }

    // Don't show tooltip in build mode
    if (this.gameState.selectedTool) {
      this.el.style.display = 'none';
      return;
    }

    const grid = worldToGrid(x, y);
    const room = this.gameState.tower.getRoomAt(grid.gridX, grid.gridY);

    if (!room) {
      this.el.style.display = 'none';
      return;
    }

    const lines = [
      `<strong>${room.name}</strong>`,
      `Tenants: ${room.tenants.length}/${room.capacity || '-'}`,
      `Satisfaction: ${Math.round(room.satisfaction)}%`,
      `Income: ${formatMoney(room.income)}/day`,
    ];

    this.el.innerHTML = lines.join('<br>');
    this.el.style.display = 'block';
    this.el.style.left = (screenX + 16) + 'px';
    this.el.style.top = (screenY - 10) + 'px';
  }
}
