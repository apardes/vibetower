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
      cost.textContent = def.costPerFloor ? formatMoney(def.costPerFloor) + '/fl' : formatMoney(def.cost);

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

    // Info button
    const infoBtn = document.createElement('button');
    infoBtn.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6px 12px;
      border: 2px solid #555;
      border-radius: 6px;
      background: #2a2a3a;
      color: #aaa;
      cursor: pointer;
      font-size: 16px;
      min-width: 44px;
      margin-left: 12px;
    `;
    infoBtn.innerHTML = '<span style="font-size:16px;">\u{2139}\uFE0F</span><span style="font-size:10px;">Info</span>';
    infoBtn.addEventListener('click', () => this.toggleInfoPanel());
    this.el.appendChild(infoBtn);

    // Info panel (hidden)
    this.buildInfoPanel();
  }

  buildInfoPanel() {
    this.infoPanel = document.createElement('div');
    this.infoPanel.style.cssText = `
      position: fixed;
      bottom: 70px;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      max-height: calc(100vh - 140px);
      background: rgba(15, 15, 25, 0.95);
      border: 2px solid #444;
      border-radius: 10px;
      z-index: 300;
      display: none;
      flex-direction: column;
      font-family: 'Segoe UI', sans-serif;
      color: #ddd;
      font-size: 13px;
      overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    `;
    header.innerHTML = '<strong>Unit Guide</strong>';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText = 'background:none;border:none;color:#888;cursor:pointer;font-size:16px;padding:0 4px;';
    closeBtn.addEventListener('click', () => this.toggleInfoPanel());
    header.appendChild(closeBtn);

    // Body
    const body = document.createElement('div');
    body.style.cssText = 'overflow-y: auto; padding: 12px 16px;';

    const descriptions = {
      lobby: 'The foundation of your tower. Must be built on the ground floor. Connects all ground-level rooms.',
      apartment: 'Residential units. Tenants pay daily rent. Residents leave for work in the morning and return in the evening. ~15% work from home.',
      office: 'Commercial workspace. Workers arrive in the morning and leave in the evening. Higher income than apartments. ~10% stay late.',
      retail: 'Shops and stores. Income scales with tower population. Open 9am\u201399pm. Noisy \u2014 reduces satisfaction of adjacent apartments.',
      restaurant: 'Dining establishments. High income, scales with population. Open 10am\u201311pm. Required to reach 4 stars.',
      elevator: 'Vertical transport. Click and drag to set shaft height (min 2 floors). Upper floor tenants need elevator access or satisfaction drops. Costs maintenance daily.',
    };

    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';

    for (const [type, def] of Object.entries(ROOM_TYPES)) {
      const desc = descriptions[type] || '';
      const starText = def.unlockStar > 1 ? `<span style="color: #c4a44a;">Unlocks at ${def.unlockStar} stars</span>` : '<span style="color: #666;">Available from start</span>';

      let statsHtml = `<span>Cost: <b style="color:#e05050;">${formatMoney(def.cost)}</b></span>`;

      if (def.income > 0) {
        statsHtml += ` &middot; <span>Income: <b style="color:#4ae04a;">${formatMoney(def.income)}/day</b></span>`;
      } else if (def.income < 0) {
        statsHtml += ` &middot; <span>Upkeep: <b style="color:#e05050;">${formatMoney(Math.abs(def.income))}/day</b></span>`;
      }

      if (def.capacity > 0) {
        statsHtml += ` &middot; <span>Capacity: <b>${def.capacity}</b></span>`;
      }

      statsHtml += ` &middot; <span>Size: <b>${def.width}x${def.height}</b></span>`;

      html += `
        <div style="padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: 6px; border-left: 3px solid ${def.color};">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <span style="display:inline-block;width:14px;height:14px;background:${def.color};border-radius:2px;"></span>
            <span style="font-size: 15px; font-weight: 600; color: #fff;">${def.name}</span>
            ${starText}
          </div>
          <div style="color: #999; margin-bottom: 6px; line-height: 1.4;">${desc}</div>
          <div style="font-size: 12px; color: #bbb;">${statsHtml}</div>
        </div>`;
    }

    html += '</div>';
    body.innerHTML = html;

    this.infoPanel.appendChild(header);
    this.infoPanel.appendChild(body);
    document.body.appendChild(this.infoPanel);
  }

  toggleInfoPanel() {
    const showing = this.infoPanel.style.display !== 'none';
    this.infoPanel.style.display = showing ? 'none' : 'flex';
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
