import { ROOM_TYPES } from '../constants.js';
import { eventBus } from '../utils/EventBus.js';
import { formatMoney } from '../utils/helpers.js';

export class Toolbar {
  constructor(gameState) {
    this.gameState = gameState;
    this.el = document.createElement('div');
    this.el.id = 'toolbar';
    this.el.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 60px;
      background: rgba(20, 20, 30, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 0 16px;
      border-top: 2px solid #333;
      z-index: 100;
      font-family: 'Segoe UI', sans-serif;
    `;

    this.buttons = {};
    this.buildButtons();
    document.body.appendChild(this.el);

    eventBus.on('toolChanged', (tool) => this.updateSelection(tool));
  }

  buildButtons() {
    for (const [type, def] of Object.entries(ROOM_TYPES)) {
      const btn = document.createElement('button');
      btn.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 6px 12px;
        border: 2px solid #555;
        border-radius: 6px;
        background: #2a2a3a;
        color: #ddd;
        cursor: pointer;
        font-size: 11px;
        min-width: 70px;
        transition: all 0.15s;
      `;

      const swatch = document.createElement('span');
      swatch.style.cssText = `
        display: inline-block;
        width: 16px;
        height: 12px;
        background: ${def.color};
        border-radius: 2px;
        margin-bottom: 2px;
      `;

      const label = document.createElement('span');
      label.textContent = def.name;

      const cost = document.createElement('span');
      cost.style.cssText = 'font-size: 9px; color: #aaa;';
      cost.textContent = formatMoney(def.cost);

      btn.appendChild(swatch);
      btn.appendChild(label);
      btn.appendChild(cost);

      btn.addEventListener('click', () => {
        if (this.gameState.selectedTool === type) {
          this.gameState.selectTool(null);
        } else {
          this.gameState.selectTool(type);
        }
      });

      btn.addEventListener('mouseenter', () => {
        if (this.gameState.selectedTool !== type) {
          btn.style.borderColor = '#888';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (this.gameState.selectedTool !== type) {
          btn.style.borderColor = '#555';
        }
      });

      this.buttons[type] = btn;
      this.el.appendChild(btn);
    }

    // Bulldoze button
    const bulldozeBtn = document.createElement('button');
    bulldozeBtn.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 6px 12px;
      border: 2px solid #555;
      border-radius: 6px;
      background: #3a2020;
      color: #ff6666;
      cursor: pointer;
      font-size: 11px;
      min-width: 70px;
      margin-left: 12px;
    `;
    bulldozeBtn.innerHTML = '<span style="font-size:16px">&#x1f6a7;</span><span>Demolish</span>';
    bulldozeBtn.addEventListener('click', () => {
      if (this.gameState.selectedTool === 'bulldoze') {
        this.gameState.selectTool(null);
      } else {
        this.gameState.selectTool('bulldoze');
      }
    });
    this.buttons['bulldoze'] = bulldozeBtn;
    this.el.appendChild(bulldozeBtn);
  }

  updateSelection(tool) {
    for (const [type, btn] of Object.entries(this.buttons)) {
      if (type === tool) {
        btn.style.borderColor = '#4a9eff';
        btn.style.background = '#1a3050';
      } else {
        btn.style.borderColor = '#555';
        btn.style.background = type === 'bulldoze' ? '#3a2020' : '#2a2a3a';
      }
    }
  }
}
