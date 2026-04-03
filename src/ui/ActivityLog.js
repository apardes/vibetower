import { eventBus } from '../utils/EventBus.js';
import { formatMoney } from '../utils/helpers.js';

const MAX_ENTRIES = 200;

export class ActivityLog {
  constructor(gameState) {
    this.gameState = gameState;

    // Tab definitions — add new tabs here
    this.tabs = [
      { id: 'financial', label: 'Financial', entries: [] },
      { id: 'occupancy', label: 'Occupancy', entries: [] },
    ];
    this.activeTab = 'financial';

    this.buildButton();
    this.buildPanel();
    this.listen();
  }

  // --- Public API for adding tabs from outside ---

  addTab(id, label) {
    if (this.tabs.find(t => t.id === id)) return;
    this.tabs.push({ id, label, entries: [] });
    this.rebuildTabBar();
  }

  log(tabId, message, type = 'info') {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    const { day, hour } = this.gameState.time;
    const h = Math.floor(hour);
    const m = Math.floor((hour % 1) * 60);
    const timestamp = `D${day} ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    tab.entries.unshift({ timestamp, message, type });
    if (tab.entries.length > MAX_ENTRIES) tab.entries.pop();
    if (this.panel.style.display !== 'none' && this.activeTab === tabId) {
      this.updateBody();
    }
  }

  // --- UI Construction ---

  buildButton() {
    this.btn = document.createElement('button');
    this.btn.textContent = '\u{1F4CB} Log';
    this.btn.title = 'Activity Log';
    this.btn.style.cssText = `
      border: 1px solid #555;
      border-radius: 4px;
      background: #2a2a3a;
      color: #aaa;
      cursor: pointer;
      font-size: 12px;
      padding: 2px 8px;
    `;
    this.btn.addEventListener('click', () => this.toggle());
    // Not appended here — UIManager places it in the HUD
  }

  buildPanel() {
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: fixed;
      top: 50px;
      left: 20px;
      width: 400px;
      max-height: calc(100vh - 120px);
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
      padding: 10px 16px;
      border-bottom: 1px solid #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    `;
    header.innerHTML = '<strong>Activity Log</strong>';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText = `
      background: none; border: none; color: #888;
      cursor: pointer; font-size: 16px; padding: 0 4px;
    `;
    closeBtn.addEventListener('click', () => this.toggle());
    header.appendChild(closeBtn);

    // Tab bar
    this.tabBar = document.createElement('div');
    this.tabBar.style.cssText = `
      display: flex;
      border-bottom: 1px solid #333;
      flex-shrink: 0;
    `;
    this.rebuildTabBar();

    // Body
    this.body = document.createElement('div');
    this.body.style.cssText = `
      overflow-y: auto;
      flex: 1;
      padding: 4px 0;
    `;

    this.panel.appendChild(header);
    this.panel.appendChild(this.tabBar);
    this.panel.appendChild(this.body);
    document.body.appendChild(this.panel);
  }

  rebuildTabBar() {
    this.tabBar.innerHTML = '';
    for (const tab of this.tabs) {
      const btn = document.createElement('button');
      btn.textContent = tab.label;
      btn.dataset.tabId = tab.id;
      btn.style.cssText = `
        flex: 1;
        padding: 8px 0;
        border: none;
        border-bottom: 2px solid ${tab.id === this.activeTab ? '#4a9eff' : 'transparent'};
        background: ${tab.id === this.activeTab ? '#1a2a40' : 'transparent'};
        color: ${tab.id === this.activeTab ? '#fff' : '#777'};
        cursor: pointer;
        font-size: 12px;
        font-family: 'Segoe UI', sans-serif;
        transition: all 0.15s;
      `;
      btn.addEventListener('click', () => {
        this.activeTab = tab.id;
        this.rebuildTabBar();
        this.updateBody();
      });
      this.tabBar.appendChild(btn);
    }
  }

  updateBody() {
    const tab = this.tabs.find(t => t.id === this.activeTab);
    if (!tab) { this.body.innerHTML = ''; return; }

    if (tab.entries.length === 0) {
      this.body.innerHTML = '<div style="padding: 20px; color: #555; text-align: center;">No events yet</div>';
      return;
    }

    const typeColors = {
      income: '#4ae04a',
      expense: '#e05050',
      info: '#aaa',
      positive: '#4a9eff',
      negative: '#e0a04a',
    };

    let html = '';
    for (const entry of tab.entries) {
      const color = typeColors[entry.type] || '#aaa';
      html += `<div style="padding: 4px 16px; display: flex; gap: 10px; border-bottom: 1px solid #1a1a2a;">
        <span style="color: #555; font-size: 11px; min-width: 70px; flex-shrink: 0;">${entry.timestamp}</span>
        <span style="color: ${color};">${entry.message}</span>
      </div>`;
    }
    this.body.innerHTML = html;
  }

  toggle() {
    const showing = this.panel.style.display !== 'none';
    if (showing) {
      this.panel.style.display = 'none';
    } else {
      this.panel.style.display = 'flex';
      this.updateBody();
    }
  }

  // --- Event Listeners ---

  listen() {
    eventBus.on('moneyChanged', () => {}); // placeholder, actual logging below

    eventBus.on('rentCollected', ({ income, expense, net }) => {
      if (income > 0) this.log('financial', `Rent collected: +${formatMoney(income)}`, 'income');
      if (expense > 0) this.log('financial', `Maintenance: -${formatMoney(expense)}`, 'expense');
      if (net !== 0) {
        const type = net > 0 ? 'income' : 'expense';
        this.log('financial', `Net daily: ${net > 0 ? '+' : ''}${formatMoney(net)}`, type);
      }
    });

    eventBus.on('roomPlaced', (room) => {
      this.log('financial', `Built ${room.name}: -${formatMoney(room.cost)}`, 'expense');
      if (room.type === 'apartment' || room.type === 'office') {
        this.log('occupancy', `New ${room.name} available on Floor ${room.gridY}`, 'info');
      }
    });

    eventBus.on('roomRemoved', (room) => {
      const refund = Math.floor(room.cost * 0.5);
      this.log('financial', `Demolished ${room.name}: +${formatMoney(refund)} refund`, 'income');
      this.log('occupancy', `${room.name} on Floor ${room.gridY} demolished`, 'negative');
    });

    eventBus.on('elevatorPlaced', (elevator) => {
      this.log('financial', `Built Elevator: -${formatMoney(50000)}`, 'expense');
    });

    eventBus.on('elevatorRemoved', () => {
      this.log('financial', `Demolished Elevator: +${formatMoney(25000)} refund`, 'income');
    });

    eventBus.on('newDay', (day) => {
      this.log('financial', `--- Day ${day} ---`, 'info');
      this.log('occupancy', `--- Day ${day} ---`, 'info');
    });

    eventBus.on('starChanged', ({ old: oldStar, new: newStar }) => {
      if (newStar > oldStar) {
        this.log('occupancy', `Tower upgraded to ${newStar} stars!`, 'positive');
        this.log('financial', `Tower upgraded to ${newStar} stars!`, 'positive');
      }
    });

    // Track new tenants moving in
    this.lastPopulation = 0;
    eventBus.on('statsChanged', (stats) => {
      const diff = stats.totalPopulation - this.lastPopulation;
      if (diff > 0) {
        this.log('occupancy', `${diff} new tenant${diff > 1 ? 's' : ''} moved in (Pop: ${stats.totalPopulation})`, 'positive');
      } else if (diff < 0) {
        this.log('occupancy', `${Math.abs(diff)} tenant${Math.abs(diff) > 1 ? 's' : ''} left (Pop: ${stats.totalPopulation})`, 'negative');
      }
      this.lastPopulation = stats.totalPopulation;
    });
  }
}
