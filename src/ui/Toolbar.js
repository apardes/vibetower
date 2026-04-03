import { ROOM_TYPES } from '../constants.js';
import { eventBus } from '../utils/EventBus.js';
import { formatMoney } from '../utils/helpers.js';

const CATEGORIES = [
  {
    id: 'building',
    label: 'Building',
    emoji: '\u{1F3D7}',
    types: ['lobby', 'elevator'],
  },
  {
    id: 'residential',
    label: 'Residential',
    emoji: '\u{1F3E0}',
    types: ['apartment'],
  },
  {
    id: 'business',
    label: 'Business',
    emoji: '\u{1F4BC}',
    types: ['office'],
  },
  {
    id: 'food_retail',
    label: 'Food & Retail',
    emoji: '\u{1F6D2}',
    types: ['retail', 'restaurant'],
  },
];

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
      height: 52px;
      background: linear-gradient(0deg, rgba(12, 12, 22, 0.95) 0%, rgba(18, 18, 28, 0.95) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 0 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      z-index: 100;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      user-select: none;
    `;

    this.buttons = {};
    this.categoryBtns = {};
    this.openSubmenu = null; // currently open submenu element
    this.openCategoryId = null;

    this.buildButtons();
    document.body.appendChild(this.el);

    eventBus.on('toolChanged', (tool) => this.updateSelection(tool));
  }

  buildButtons() {
    // Category buttons
    for (const cat of CATEGORIES) {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position: relative;';

      const btn = document.createElement('button');
      btn.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: #a0a0b0;
        cursor: pointer;
        font-size: 13px;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        transition: all 0.15s;
        white-space: nowrap;
      `;
      btn.innerHTML = `<span style="font-size:16px;">${cat.emoji}</span> ${cat.label}`;

      btn.addEventListener('mouseenter', () => {
        if (this.openCategoryId !== cat.id) {
          btn.style.background = 'rgba(255,255,255,0.06)';
          btn.style.color = '#d0d0d8';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (this.openCategoryId !== cat.id) {
          btn.style.background = 'transparent';
          btn.style.color = '#a0a0b0';
        }
      });

      // Submenu
      const submenu = this.buildSubmenu(cat);
      wrapper.appendChild(submenu);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.openCategoryId === cat.id) {
          this.closeSubmenu();
        } else {
          this.openSubmenuFor(cat.id, submenu, btn);
        }
      });

      wrapper.appendChild(btn);
      this.el.appendChild(wrapper);
      this.categoryBtns[cat.id] = { btn, submenu, wrapper };
    }

    // Separator
    const sep = document.createElement('div');
    sep.style.cssText = 'width:1px; height:28px; background:rgba(255,255,255,0.08); margin:0 6px;';
    this.el.appendChild(sep);

    // Demolish button
    const bulldozeBtn = document.createElement('button');
    bulldozeBtn.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #aa6666;
      cursor: pointer;
      font-size: 13px;
      font-family: 'Inter', sans-serif;
      font-weight: 500;
      transition: all 0.15s;
    `;
    bulldozeBtn.innerHTML = '<span style="font-size:16px;">\u{1F6A7}</span> Demolish';
    bulldozeBtn.addEventListener('mouseenter', () => {
      if (this.gameState.selectedTool !== 'bulldoze') {
        bulldozeBtn.style.background = 'rgba(170,80,80,0.15)';
        bulldozeBtn.style.color = '#cc8888';
      }
    });
    bulldozeBtn.addEventListener('mouseleave', () => {
      if (this.gameState.selectedTool !== 'bulldoze') {
        bulldozeBtn.style.background = 'transparent';
        bulldozeBtn.style.color = '#aa6666';
      }
    });
    bulldozeBtn.addEventListener('click', () => {
      this.closeSubmenu();
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
      align-items: center;
      justify-content: center;
      padding: 8px;
      border: none;
      border-radius: 50%;
      background: rgba(255,255,255,0.04);
      color: #888;
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
      font-family: 'Inter', sans-serif;
      width: 32px;
      height: 32px;
      margin-left: 6px;
      transition: all 0.15s;
    `;
    infoBtn.innerHTML = '<span style="font-size:15px;">\u{1F4D6}</span>';
    infoBtn.title = 'Reference';
    infoBtn.addEventListener('mouseenter', () => {
      infoBtn.style.background = 'rgba(255,255,255,0.1)';
      infoBtn.style.color = '#bbb';
    });
    infoBtn.addEventListener('mouseleave', () => {
      infoBtn.style.background = 'rgba(255,255,255,0.04)';
      infoBtn.style.color = '#888';
    });
    infoBtn.addEventListener('click', () => this.toggleInfoPanel());
    this.el.appendChild(infoBtn);

    this.buildInfoPanel();
  }

  buildSubmenu(cat) {
    const submenu = document.createElement('div');
    submenu.style.cssText = `
      position: absolute;
      bottom: 48px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(14, 14, 24, 0.96);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 6px;
      display: none;
      flex-direction: column;
      gap: 2px;
      min-width: 180px;
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
      z-index: 200;
      font-family: 'Inter', sans-serif;
    `;
    submenu._catTypes = cat.types;
    return submenu;
  }

  populateSubmenu(submenu) {
    // Clear old items
    submenu.innerHTML = '';
    // Remove old button references for these types
    for (const type of submenu._catTypes) {
      delete this.buttons[type];
    }

    const currentStar = this.gameState.starRating;
    let hasItems = false;

    for (const type of submenu._catTypes) {
      const def = ROOM_TYPES[type];
      if (!def) continue;
      if (def.unlockStar > currentStar) continue;

      hasItems = true;
      const item = document.createElement('button');
      item.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: #c0c0c8;
        cursor: pointer;
        font-size: 13px;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        transition: all 0.12s;
        width: 100%;
        text-align: left;
      `;

      const swatch = `<span style="display:inline-block;width:10px;height:10px;background:${def.color};border-radius:2px;flex-shrink:0;"></span>`;
      const costText = def.costPerFloor ? formatMoney(def.costPerFloor) + '/fl' : formatMoney(def.cost);
      item.innerHTML = `${swatch}<span style="flex:1;">${def.name}</span><span style="color:#666;font-size:11px;">${costText}</span>`;

      if (this.gameState.selectedTool === type) {
        item.style.background = 'rgba(80, 120, 220, 0.15)';
        item.style.color = '#8ab4ff';
      }

      item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(255,255,255,0.06)';
        item.style.color = '#e0e0e8';
      });
      item.addEventListener('mouseleave', () => {
        if (this.gameState.selectedTool !== type) {
          item.style.background = 'transparent';
          item.style.color = '#c0c0c8';
        }
      });

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.gameState.selectedTool === type) {
          this.gameState.selectTool(null);
        } else {
          this.gameState.selectTool(type);
        }
        this.closeSubmenu();
      });

      this.buttons[type] = item;
      submenu.appendChild(item);
    }

    if (!hasItems) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding: 10px 14px; color: #555; font-size: 12px; text-align: center;';
      empty.textContent = 'No units unlocked yet';
      submenu.appendChild(empty);
    }
  }

  openSubmenuFor(catId, submenu, btn) {
    this.closeSubmenu();
    this.populateSubmenu(submenu);
    this.openCategoryId = catId;
    submenu.style.display = 'flex';
    btn.style.background = 'rgba(80, 120, 220, 0.2)';
    btn.style.color = '#8ab4ff';
  }

  closeSubmenu() {
    if (this.openCategoryId) {
      const cat = this.categoryBtns[this.openCategoryId];
      if (cat) {
        cat.submenu.style.display = 'none';
        cat.btn.style.background = 'transparent';
        cat.btn.style.color = '#a0a0b0';
      }
      this.openCategoryId = null;
    }
  }

  buildInfoPanel() {
    this.infoPanel = document.createElement('div');
    this.infoPanel.style.cssText = `
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      width: 560px;
      max-height: calc(100vh - 140px);
      background: rgba(14, 14, 24, 0.96);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      z-index: 300;
      display: none;
      flex-direction: column;
      font-family: 'Inter', sans-serif;
      color: #d0d0d8;
      font-size: 13px;
      overflow: hidden;
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.3);
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 14px 18px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    `;
    header.innerHTML = '<strong style="font-weight:600;font-size:14px;">\u{1F4D6} Reference</strong>';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText = `
      background: none; border: none; color: #666;
      cursor: pointer; font-size: 14px; padding: 4px 6px;
      border-radius: 4px; transition: all 0.15s;
    `;
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#aaa'; closeBtn.style.background = 'rgba(255,255,255,0.06)'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#666'; closeBtn.style.background = 'none'; });
    closeBtn.addEventListener('click', () => this.toggleInfoPanel());
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.style.cssText = 'overflow-y: auto; padding: 12px 16px;';

    const descriptions = {
      lobby: 'The foundation of your tower. Must be built on the ground floor. Connects all ground-level rooms.',
      apartment: 'Residential units. Tenants pay daily rent. Residents leave for work in the morning and return in the evening.',
      office: 'Commercial workspace. Workers arrive in the morning and leave in the evening. Higher income than apartments.',
      retail: 'Shops and stores. Income scales with tower population. Open 9am\u20139pm.',
      restaurant: 'Dining establishments. High income, scales with population. Open 10am\u201311pm.',
      elevator: 'Vertical transport. Click and drag to set shaft height (min 2 floors). Upper floor tenants need elevator access.',
    };

    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';

    for (const [type, def] of Object.entries(ROOM_TYPES)) {
      const desc = descriptions[type] || '';
      let statsHtml = `<span>Cost: <b style="color:#e05050;">${formatMoney(def.cost)}</b></span>`;
      if (def.income > 0) statsHtml += ` \u00B7 <span>Income: <b style="color:#5cdb5c;">${formatMoney(def.income)}/day</b></span>`;
      else if (def.income < 0) statsHtml += ` \u00B7 <span>Upkeep: <b style="color:#e05050;">${formatMoney(Math.abs(def.income))}/day</b></span>`;
      if (def.capacity > 0) statsHtml += ` \u00B7 <span>Capacity: <b>${def.capacity}</b></span>`;
      statsHtml += ` \u00B7 <span>Size: <b>${def.width}\u00D7${def.height}</b></span>`;

      html += `
        <div style="padding: 10px 14px; background: rgba(255,255,255,0.02); border-radius: 8px; border-left: 3px solid ${def.color};">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
            <span style="font-size: 14px; font-weight: 600; color: #e0e0e8;">${def.name}</span>
          </div>
          <div style="color: #888; margin-bottom: 4px; line-height: 1.5; font-size: 12px;">${desc}</div>
          <div style="font-size: 11px; color: #999;">${statsHtml}</div>
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
    // Update submenu items
    for (const [type, btn] of Object.entries(this.buttons)) {
      if (type === 'bulldoze') {
        if (type === tool) {
          btn.style.background = 'rgba(170,80,80,0.25)';
          btn.style.color = '#ee8888';
        } else {
          btn.style.background = 'transparent';
          btn.style.color = '#aa6666';
        }
      } else {
        if (type === tool) {
          btn.style.background = 'rgba(80, 120, 220, 0.15)';
          btn.style.color = '#8ab4ff';
        } else {
          btn.style.background = 'transparent';
          btn.style.color = '#c0c0c8';
        }
      }
    }

    // Highlight the category that contains the active tool
    for (const cat of CATEGORIES) {
      const catEntry = this.categoryBtns[cat.id];
      if (!catEntry) continue;
      const hasActiveTool = cat.types.includes(tool);
      if (hasActiveTool && this.openCategoryId !== cat.id) {
        catEntry.btn.style.color = '#8ab4ff';
      } else if (!hasActiveTool && this.openCategoryId !== cat.id) {
        catEntry.btn.style.color = '#a0a0b0';
      }
    }
  }
}
