import { eventBus } from '../utils/EventBus.js';
import { formatMoney } from '../utils/helpers.js';
import { STAR_THRESHOLDS } from '../constants.js';

export class HUD {
  constructor(gameState) {
    this.gameState = gameState;

    // Load a clean modern font
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 48px;
      background: linear-gradient(180deg, rgba(18, 18, 28, 0.95) 0%, rgba(12, 12, 22, 0.95) 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      z-index: 100;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #e0e0e8;
      font-size: 13px;
      letter-spacing: 0.01em;
      user-select: none;
    `;

    this.buildHUD();
    document.body.appendChild(this.el);

    eventBus.on('moneyChanged', () => this.updateMoney());
    eventBus.on('tick', () => this.updateTime());
    eventBus.on('statsChanged', () => this.updateStats());
  }

  buildHUD() {
    // Left section: money + population + satisfaction
    const left = document.createElement('div');
    left.style.cssText = 'display: flex; gap: 24px; align-items: center;';

    const indicatorStyle = `
      color: #a0a0b0;
      font-weight: 500;
      font-size: 13px;
      padding: 4px 10px;
      border-radius: 6px;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    const btnIndicatorStyle = indicatorStyle + 'cursor: pointer;';

    // Money
    this.moneyEl = document.createElement('span');
    this.moneyEl.style.cssText = `
      color: #5cdb5c;
      font-weight: 700;
      font-size: 15px;
      letter-spacing: 0.02em;
    `;
    this.updateMoney();

    // Population: people emoji + X/Y → triggers population panel
    this.popEl = document.createElement('span');
    this.popEl.style.cssText = btnIndicatorStyle;
    this.popEl.title = 'Population';
    this.popEl.addEventListener('mouseenter', () => this.popEl.style.background = 'rgba(255,255,255,0.06)');
    this.popEl.addEventListener('mouseleave', () => this.popEl.style.background = 'none');
    this.popEl.addEventListener('click', () => this.togglePopPanel());

    // Occupancy: building emoji + X/Y → triggers unit panel
    this.occEl = document.createElement('span');
    this.occEl.style.cssText = btnIndicatorStyle;
    this.occEl.title = 'Occupancy';
    this.occEl.addEventListener('mouseenter', () => this.occEl.style.background = 'rgba(255,255,255,0.06)');
    this.occEl.addEventListener('mouseleave', () => this.occEl.style.background = 'none');
    this.occEl.addEventListener('click', () => this.toggleUnitPanel());

    // Satisfaction: emoji + % — indicator only, no click
    this.satEl = document.createElement('span');
    this.satEl.style.cssText = indicatorStyle;
    this.updateSatisfactionIndicator();

    this.updatePopIndicator();
    this.updateOccIndicator();

    left.appendChild(this.moneyEl);
    left.appendChild(this.popEl);
    left.appendChild(this.occEl);
    left.appendChild(this.satEl);

    this.leftSection = left;

    // Center: star rating
    this.starsEl = document.createElement('div');
    this.starsEl.style.cssText = `
      font-size: 16px;
      letter-spacing: 6px;
      display: flex;
      align-items: center;
      gap: 2px;
    `;
    this.updateStars();

    // Right section: time + speed + help
    const right = document.createElement('div');
    right.style.cssText = 'display: flex; gap: 16px; align-items: center;';

    this.timeEl = document.createElement('span');
    this.timeEl.style.cssText = `
      color: #a0a0b0;
      min-width: 130px;
      text-align: right;
      font-weight: 500;
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    `;
    this.updateTime();

    // Speed controls
    const speedControls = document.createElement('div');
    speedControls.style.cssText = `
      display: flex;
      gap: 2px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 8px;
      padding: 2px;
    `;

    this.speedButtons = [];
    const speeds = [
      { label: '\u23F8', speed: 0, title: 'Pause' },
      { label: '1\u00D7', speed: 1, title: 'Normal speed' },
      { label: '2\u00D7', speed: 2, title: 'Fast' },
      { label: '3\u00D7', speed: 3, title: 'Fastest' },
    ];

    for (const { label, speed, title } of speeds) {
      const btn = document.createElement('button');
      btn.style.cssText = `
        padding: 4px 10px;
        border: none;
        border-radius: 6px;
        background: ${speed === 1 ? 'rgba(80, 120, 220, 0.3)' : 'transparent'};
        color: ${speed === 1 ? '#8ab4ff' : '#666'};
        cursor: pointer;
        font-size: 12px;
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        transition: all 0.15s;
        line-height: 1;
      `;
      btn.textContent = label;
      btn.title = title;
      btn.addEventListener('mouseenter', () => {
        if (speed !== this.gameState.time.speed) btn.style.background = 'rgba(255,255,255,0.06)';
      });
      btn.addEventListener('mouseleave', () => {
        if (speed !== this.gameState.time.speed) btn.style.background = 'transparent';
      });
      btn.addEventListener('click', () => {
        this.gameState.time.speed = speed;
        this.updateSpeedButtons();
      });
      speedControls.appendChild(btn);
      this.speedButtons.push({ btn, speed });
    }

    // Help button
    const helpBtn = document.createElement('button');
    helpBtn.innerHTML = '?';
    helpBtn.title = 'Help';
    helpBtn.style.cssText = `
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.06);
      color: #888;
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
      font-family: 'Inter', sans-serif;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    helpBtn.addEventListener('mouseenter', () => {
      helpBtn.style.background = 'rgba(255,255,255,0.12)';
      helpBtn.style.color = '#bbb';
    });
    helpBtn.addEventListener('mouseleave', () => {
      helpBtn.style.background = 'rgba(255,255,255,0.06)';
      helpBtn.style.color = '#888';
    });
    helpBtn.addEventListener('click', () => this.toggleHelp());

    right.appendChild(this.timeEl);
    right.appendChild(speedControls);
    right.appendChild(helpBtn);

    this.el.appendChild(left);
    this.el.appendChild(this.starsEl);
    this.el.appendChild(right);

    // Help overlay
    this.helpOverlay = document.createElement('div');
    this.helpOverlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 500;
      display: none;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', sans-serif;
    `;
    this.helpOverlay.addEventListener('click', () => this.toggleHelp());

    const helpBox = document.createElement('div');
    helpBox.style.cssText = `
      background: rgba(18, 18, 28, 0.98);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 32px 40px;
      max-width: 520px;
      color: #d0d0d8;
      line-height: 1.7;
      font-size: 14px;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
    `;
    helpBox.addEventListener('click', (e) => e.stopPropagation());
    helpBox.innerHTML = `
      <h2 style="margin: 0 0 20px 0; color: #fff; font-size: 20px; font-weight: 700;">How to Play</h2>

      <h3 style="margin: 16px 0 6px 0; color: #8ab4ff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;">Building</h3>
      <p style="margin: 0; color: #a0a0b0;">Select a room type from the toolbar and click to place it. Rooms must be supported from below. Press <kbd style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-size:12px;">Esc</kbd> or right-click to cancel.</p>

      <h3 style="margin: 16px 0 6px 0; color: #8ab4ff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;">Elevators</h3>
      <p style="margin: 0; color: #a0a0b0;">Select the Elevator tool, then click and drag vertically. Must span at least 2 floors.</p>

      <h3 style="margin: 16px 0 6px 0; color: #8ab4ff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;">Camera</h3>
      <p style="margin: 0; color: #a0a0b0;">
        <b style="color:#d0d0d8;">Pan:</b> Middle mouse drag, Space + drag, or Arrow keys<br>
        <b style="color:#d0d0d8;">Zoom:</b> Scroll wheel or +/\u2212 keys
      </p>

      <h3 style="margin: 16px 0 6px 0; color: #8ab4ff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;">Economy</h3>
      <p style="margin: 0; color: #a0a0b0;">Occupied rooms generate daily rent. Retail and restaurant income scales with population.</p>

      <h3 style="margin: 16px 0 6px 0; color: #8ab4ff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;">Star Rating</h3>
      <p style="margin: 0; color: #a0a0b0;">Grow population and satisfaction to earn stars and unlock new room types.</p>

      <p style="margin: 20px 0 0 0; color: #555; font-size: 12px; text-align: center;">Click anywhere to close</p>
    `;

    this.helpOverlay.appendChild(helpBox);
    document.body.appendChild(this.helpOverlay);
  }

  toggleHelp() {
    const showing = this.helpOverlay.style.display === 'flex';
    this.helpOverlay.style.display = showing ? 'none' : 'flex';
  }

  updateMoney() {
    this.moneyEl.textContent = formatMoney(this.gameState.money);
  }

  updateTime() {
    const { day, hour } = this.gameState.time;
    const h = Math.floor(hour);
    const m = Math.floor((hour % 1) * 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    this.timeEl.textContent = `Day ${day}  ${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  updateStars() {
    const filled = this.gameState.starRating;
    this.starsEl.innerHTML = '';

    // Create a single shared tooltip element appended to body (avoids parent overflow issues)
    if (!this.starTooltip) {
      this.starTooltip = document.createElement('div');
      this.starTooltip.style.cssText = `
        position: fixed;
        background: rgba(14, 14, 24, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 8px 14px;
        font-size: 12px;
        font-weight: 500;
        color: #c0c0c8;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s;
        z-index: 1000;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
        font-family: 'Inter', sans-serif;
        letter-spacing: 0;
      `;
      document.body.appendChild(this.starTooltip);
    }

    for (let i = 0; i < 5; i++) {
      const starNum = i + 1;
      const active = i < filled;
      const threshold = STAR_THRESHOLDS.find(t => t.star === starNum);

      const star = document.createElement('span');
      star.style.cssText = `
        color: ${active ? '#f0c040' : '#333'};
        text-shadow: ${active ? '0 0 8px rgba(240, 192, 64, 0.3)' : 'none'};
        font-size: 18px;
        cursor: default;
      `;
      star.textContent = '\u2605';

      if (threshold) {
        let tipText;
        if (starNum === 1) {
          tipText = 'Starting rank';
        } else if (starNum <= filled) {
          tipText = `\u2605 ${starNum} \u2014 Unlocked!`;
        } else {
          tipText = `\u2605 ${starNum} \u2014 ${threshold.population} pop, ${threshold.satisfaction}% satisfaction`;
        }

        star.addEventListener('mouseenter', (e) => {
          const rect = e.target.getBoundingClientRect();
          this.starTooltip.textContent = tipText;
          this.starTooltip.style.left = rect.left + rect.width / 2 + 'px';
          this.starTooltip.style.top = rect.bottom + 8 + 'px';
          this.starTooltip.style.transform = 'translateX(-50%)';
          this.starTooltip.style.opacity = '1';
        });
        star.addEventListener('mouseleave', () => {
          this.starTooltip.style.opacity = '0';
        });
      }

      this.starsEl.appendChild(star);
    }
  }

  updateStats() {
    this.updatePopIndicator();
    this.updateOccIndicator();
    this.updateStars();
    this.updateSatisfactionIndicator();
    if (this.popPanel && this.popPanel.style.display !== 'none') {
      this.updatePopPanel();
    }
    if (this.unitPanel && this.unitPanel.style.display !== 'none') {
      this.updateUnitPanel();
    }
  }

  updatePopIndicator() {
    const { people, tower } = this.gameState;
    let totalCapacity = 0;
    for (const [, room] of tower.rooms) {
      if (room.capacity > 0) totalCapacity += room.capacity;
    }
    this.popEl.innerHTML = `\u{1F465} <span style="font-variant-numeric:tabular-nums;">${people.size}/${totalCapacity}</span>`;
  }

  updateOccIndicator() {
    const { tower } = this.gameState;
    let occupied = 0;
    let total = 0;
    for (const [, room] of tower.rooms) {
      if (room.type === 'elevator' || room.type === 'lobby') continue;
      total++;
      if (room.tenants.length > 0) occupied++;
    }
    this.occEl.innerHTML = `\u{1F3E2} <span style="font-variant-numeric:tabular-nums;">${occupied}/${total}</span>`;
  }

  updateSatisfactionIndicator() {
    const sat = Math.round(this.gameState.stats.averageSatisfaction);
    let emoji;
    if (sat >= 80) emoji = '\u{1F601}';
    else if (sat >= 60) emoji = '\u{1F642}';
    else if (sat >= 40) emoji = '\u{1F610}';
    else if (sat >= 20) emoji = '\u{1F61F}';
    else emoji = '\u{1F621}';
    this.satEl.textContent = `${emoji} ${sat}%`;
  }

  _createPanel(title) {
    const panel = document.createElement('div');
    panel.style.cssText = `
      position: fixed;
      top: 54px;
      left: 24px;
      width: 360px;
      max-height: calc(100vh - 120px);
      background: rgba(14, 14, 24, 0.96);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      z-index: 300;
      display: none;
      font-family: 'Inter', sans-serif;
      color: #d0d0d8;
      font-size: 13px;
      overflow: hidden;
      flex-direction: column;
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
    header.innerHTML = `<strong style="font-weight:600;font-size:14px;">${title}</strong>`;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText = `
      background: none; border: none; color: #666;
      cursor: pointer; font-size: 14px; padding: 4px 6px;
      border-radius: 4px; transition: all 0.15s;
    `;
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#aaa'; closeBtn.style.background = 'rgba(255,255,255,0.06)'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#666'; closeBtn.style.background = 'none'; });
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.style.cssText = 'overflow-y: auto; padding: 8px 0; flex: 1;';

    panel.appendChild(header);
    panel.appendChild(body);
    document.body.appendChild(panel);

    return { panel, body, closeBtn };
  }

  // --- Population panel (individual residents) ---

  togglePopPanel() {
    if (!this.popPanel) {
      const { panel, body, closeBtn } = this._createPanel('Population');
      this.popPanel = panel;
      this.popPanelBody = body;
      closeBtn.addEventListener('click', () => this.togglePopPanel());
    }

    // Close unit panel if open
    if (this.unitPanel && this.unitPanel.style.display !== 'none') {
      this.unitPanel.style.display = 'none';
    }

    const showing = this.popPanel.style.display !== 'none';
    this.popPanel.style.display = showing ? 'none' : 'flex';
    if (!showing) this.updatePopPanel();
  }

  updatePopPanel() {
    const { people, tower } = this.gameState;
    const body = this.popPanelBody;

    if (people.size === 0) {
      body.innerHTML = '<div style="padding: 20px; color: #555; text-align: center;">No residents yet</div>';
      return;
    }

    const typeColors = { apartment: '#6a9cc4', office: '#9dba8c', retail: '#d4ad60', restaurant: '#c87858' };

    // Sort people by room floor (highest first), then by room type
    const sorted = [...people.values()]
      .map(p => ({ person: p, room: tower.rooms.get(p.homeRoom) }))
      .filter(e => e.room)
      .sort((a, b) => b.room.gridY - a.room.gridY || a.room.type.localeCompare(b.room.type));

    let html = `<div style="padding: 10px 18px; color: #888; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 12px;">
      ${people.size} residents
    </div>`;

    for (const { person, room } of sorted) {
      const color = typeColors[room.type] || '#888';
      const psat = Math.round(person.satisfaction);
      let satColor;
      if (psat >= 80) satColor = '#5cdb5c';
      else if (psat >= 60) satColor = '#8ec44a';
      else if (psat >= 40) satColor = '#c4a44a';
      else if (psat >= 20) satColor = '#c4744a';
      else satColor = '#c44a4a';

      const stateLabel = person.hidden ? 'Away' :
        person.state === 'in_room' ? 'Home' :
        person.state === 'walking' ? 'Walking' :
        person.state === 'waiting_elevator' ? 'Waiting' :
        person.state === 'in_elevator' ? 'Elevator' :
        person.state === 'spawning' ? 'Arriving' : person.state;

      html += `<div style="display:flex; align-items:center; padding:6px 18px; gap:10px; border-bottom:1px solid rgba(255,255,255,0.02); font-size:12px;">
        <span style="display:inline-block;width:6px;height:6px;background:${color};border-radius:50%;flex-shrink:0;"></span>
        <span style="color:#666; width:50px; font-size:11px;">${room.name}</span>
        <span style="color:#555; width:24px; font-size:11px;">F${room.gridY}</span>
        <span style="color:#555; width:46px; font-size:11px;">${stateLabel}</span>
        <span style="color:${satColor}; font-weight:500; margin-left:auto;">${psat}%</span>
      </div>`;
    }

    body.innerHTML = html;
  }

  // --- Unit/Occupancy panel (rooms) ---

  toggleUnitPanel() {
    if (!this.unitPanel) {
      const { panel, body, closeBtn } = this._createPanel('Occupancy');
      this.unitPanel = panel;
      this.unitPanelBody = body;
      closeBtn.addEventListener('click', () => this.toggleUnitPanel());
    }

    // Close pop panel if open
    if (this.popPanel && this.popPanel.style.display !== 'none') {
      this.popPanel.style.display = 'none';
    }

    const showing = this.unitPanel.style.display !== 'none';
    this.unitPanel.style.display = showing ? 'none' : 'flex';
    if (!showing) this.updateUnitPanel();
  }

  updateUnitPanel() {
    const { tower } = this.gameState;
    const body = this.unitPanelBody;

    const typeColors = { apartment: '#6a9cc4', office: '#9dba8c', retail: '#d4ad60', restaurant: '#c87858', lobby: '#bfb398' };

    const rooms = [...tower.rooms.values()]
      .filter(r => r.type !== 'elevator')
      .sort((a, b) => b.gridY - a.gridY || a.gridX - b.gridX);

    if (rooms.length === 0) {
      body.innerHTML = '<div style="padding: 20px; color: #555; text-align: center;">No rooms built yet</div>';
      return;
    }

    let occupied = 0;
    for (const r of rooms) {
      if (r.type !== 'lobby' && r.tenants.length > 0) occupied++;
    }
    const total = rooms.filter(r => r.type !== 'lobby').length;

    let html = `<div style="padding: 10px 18px; color: #888; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 12px;">
      ${occupied}/${total} occupied
    </div>`;

    for (const room of rooms) {
      const color = typeColors[room.type] || '#888';
      const occ = room.capacity > 0 ? `${room.tenants.length}/${room.capacity}` : '\u2014';
      const satPct = Math.round(room.satisfaction);
      let satColor;
      if (satPct >= 80) satColor = '#5cdb5c';
      else if (satPct >= 60) satColor = '#8ec44a';
      else if (satPct >= 40) satColor = '#c4a44a';
      else if (satPct >= 20) satColor = '#c4744a';
      else satColor = '#c44a4a';

      html += `<div style="display:flex; align-items:center; padding:6px 18px; gap:10px; border-bottom:1px solid rgba(255,255,255,0.02); font-size:12px;">
        <span style="display:inline-block;width:6px;height:6px;background:${color};border-radius:50%;flex-shrink:0;"></span>
        <span style="color:#d0d0d8; font-weight:500; width:70px;">${room.name}</span>
        <span style="color:#555; width:24px; font-size:11px;">F${room.gridY}</span>
        <span style="color:#888; width:36px; font-size:11px; font-variant-numeric:tabular-nums;">${occ}</span>
        <span style="color:${satColor}; font-weight:500; margin-left:auto;">${room.type !== 'lobby' ? satPct + '%' : ''}</span>
      </div>`;
    }

    body.innerHTML = html;
  }

  updateSpeedButtons() {
    for (const { btn, speed } of this.speedButtons) {
      const active = speed === this.gameState.time.speed;
      btn.style.background = active ? 'rgba(80, 120, 220, 0.3)' : 'transparent';
      btn.style.color = active ? '#8ab4ff' : '#666';
    }
  }
}
