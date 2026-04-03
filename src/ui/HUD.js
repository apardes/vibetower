import { eventBus } from '../utils/EventBus.js';
import { formatMoney } from '../utils/helpers.js';

export class HUD {
  constructor(gameState) {
    this.gameState = gameState;
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 44px;
      background: rgba(20, 20, 30, 0.9);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      border-bottom: 2px solid #333;
      z-index: 100;
      font-family: 'Segoe UI', sans-serif;
      color: #ddd;
      font-size: 14px;
    `;

    this.buildHUD();
    document.body.appendChild(this.el);

    eventBus.on('moneyChanged', () => this.updateMoney());
    eventBus.on('tick', () => this.updateTime());
    eventBus.on('statsChanged', () => this.updateStats());
  }

  buildHUD() {
    // Left section: money + population
    const left = document.createElement('div');
    left.style.cssText = 'display: flex; gap: 20px; align-items: center;';

    this.moneyEl = document.createElement('span');
    this.moneyEl.style.cssText = 'color: #4ae04a; font-weight: bold; font-size: 16px;';
    this.updateMoney();

    this.popEl = document.createElement('span');
    this.popEl.style.cssText = 'color: #aaa;';
    this.popEl.textContent = 'Pop: 0';

    // Satisfaction indicator (clickable)
    this.satEl = document.createElement('span');
    this.satEl.style.cssText = 'color: #aaa; cursor: pointer; user-select: none;';
    this.satEl.title = 'Click for population details';
    this.satEl.addEventListener('click', () => this.togglePopPanel());
    this.updateSatisfactionIndicator();

    left.appendChild(this.moneyEl);
    left.appendChild(this.popEl);
    left.appendChild(this.satEl);

    this.leftSection = left;

    // Center: star rating
    this.starsEl = document.createElement('div');
    this.starsEl.style.cssText = 'font-size: 20px; letter-spacing: 2px;';
    this.updateStars();

    // Right section: time + speed controls
    const right = document.createElement('div');
    right.style.cssText = 'display: flex; gap: 12px; align-items: center;';

    this.timeEl = document.createElement('span');
    this.timeEl.style.cssText = 'color: #aaa; min-width: 120px; text-align: right;';
    this.updateTime();

    // Speed controls
    const speedControls = document.createElement('div');
    speedControls.style.cssText = 'display: flex; gap: 4px;';

    this.speedButtons = [];
    const speeds = [
      { label: '||', speed: 0 },
      { label: '>', speed: 1 },
      { label: '>>', speed: 2 },
      { label: '>>>', speed: 3 },
    ];

    for (const { label, speed } of speeds) {
      const btn = document.createElement('button');
      btn.style.cssText = `
        padding: 2px 8px;
        border: 1px solid #555;
        border-radius: 3px;
        background: ${speed === 1 ? '#335' : '#222'};
        color: ${speed === 1 ? '#fff' : '#888'};
        cursor: pointer;
        font-size: 11px;
        font-family: monospace;
      `;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        this.gameState.time.speed = speed;
        this.updateSpeedButtons();
      });
      speedControls.appendChild(btn);
      this.speedButtons.push({ btn, speed });
    }

    // Help button
    const helpBtn = document.createElement('button');
    helpBtn.textContent = '?';
    helpBtn.style.cssText = `
      width: 28px;
      height: 28px;
      border: 1px solid #555;
      border-radius: 50%;
      background: #2a2a3a;
      color: #aaa;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      margin-left: 8px;
    `;
    helpBtn.addEventListener('click', () => this.toggleHelp());

    right.appendChild(this.timeEl);
    right.appendChild(speedControls);
    right.appendChild(helpBtn);

    this.el.appendChild(left);
    this.el.appendChild(this.starsEl);
    this.el.appendChild(right);

    // Help overlay (hidden by default)
    this.helpOverlay = document.createElement('div');
    this.helpOverlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      z-index: 500;
      display: none;
      align-items: center;
      justify-content: center;
      font-family: 'Segoe UI', sans-serif;
    `;
    this.helpOverlay.addEventListener('click', () => this.toggleHelp());

    const helpBox = document.createElement('div');
    helpBox.style.cssText = `
      background: #1a1a2e;
      border: 2px solid #444;
      border-radius: 12px;
      padding: 28px 36px;
      max-width: 520px;
      color: #ddd;
      line-height: 1.7;
      font-size: 14px;
    `;
    helpBox.addEventListener('click', (e) => e.stopPropagation());
    helpBox.innerHTML = `
      <h2 style="margin: 0 0 16px 0; color: #fff; font-size: 20px;">How to Play</h2>

      <h3 style="margin: 12px 0 6px 0; color: #4a9eff; font-size: 14px;">Building</h3>
      <p style="margin: 0;">Select a room type from the bottom toolbar and click on the grid to place it.
      Rooms must be fully supported — every cell needs a room below it (except ground floor).
      Press <kbd style="background:#333;padding:1px 5px;border-radius:3px;border:1px solid #555;">Esc</kbd> or right-click to cancel placement.</p>

      <h3 style="margin: 12px 0 6px 0; color: #4a9eff; font-size: 14px;">Elevators</h3>
      <p style="margin: 0;">Select the Elevator tool, then click and drag vertically to create a shaft.
      Must span at least 2 floors. Tenants on upper floors need elevator access.</p>

      <h3 style="margin: 12px 0 6px 0; color: #4a9eff; font-size: 14px;">Camera</h3>
      <p style="margin: 0;">
        <b>Pan:</b> Middle mouse drag, or Space + left mouse drag, or Arrow keys<br>
        <b>Zoom:</b> Scroll wheel (zooms toward cursor), or +/- keys
      </p>

      <h3 style="margin: 12px 0 6px 0; color: #4a9eff; font-size: 14px;">Economy</h3>
      <p style="margin: 0;">Place rooms to attract tenants. Occupied apartments and offices generate rent daily.
      Retail and restaurant income scales with your tower's population.</p>

      <h3 style="margin: 12px 0 6px 0; color: #4a9eff; font-size: 14px;">Star Rating</h3>
      <p style="margin: 0;">Grow your population and keep satisfaction high to earn stars.
      Higher stars unlock new room types: Retail at 2 stars, Restaurant at 3 stars.</p>

      <h3 style="margin: 12px 0 6px 0; color: #4a9eff; font-size: 14px;">Time Controls</h3>
      <p style="margin: 0;">Use the speed buttons in the top-right: pause, 1x, 2x, or 3x speed.</p>

      <p style="margin: 16px 0 0 0; color: #666; font-size: 12px; text-align: center;">Click anywhere outside this box to close</p>
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
    this.timeEl.textContent = `Day ${day}  ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  updateStars() {
    const filled = this.gameState.starRating;
    let stars = '';
    for (let i = 0; i < 5; i++) {
      stars += i < filled ? '\u2605' : '\u2606';
    }
    this.starsEl.textContent = stars;
  }

  updateStats() {
    this.popEl.textContent = `Pop: ${this.gameState.stats.totalPopulation}`;
    this.updateStars();
    this.updateSatisfactionIndicator();
    if (this.popPanel && this.popPanel.style.display !== 'none') {
      this.updatePopPanel();
    }
  }

  updateSatisfactionIndicator() {
    const sat = Math.round(this.gameState.stats.averageSatisfaction);
    let emoji;
    if (sat >= 80) emoji = '\u{1F601}';      // grinning
    else if (sat >= 60) emoji = '\u{1F642}';  // slightly smiling
    else if (sat >= 40) emoji = '\u{1F610}';  // neutral
    else if (sat >= 20) emoji = '\u{1F61F}';  // worried
    else emoji = '\u{1F621}';                  // angry
    this.satEl.textContent = `${emoji} ${sat}%`;
  }

  togglePopPanel() {
    if (!this.popPanel) {
      this.popPanel = document.createElement('div');
      this.popPanel.style.cssText = `
        position: fixed;
        top: 50px;
        left: 20px;
        width: 380px;
        max-height: calc(100vh - 120px);
        background: rgba(15, 15, 25, 0.95);
        border: 2px solid #444;
        border-radius: 10px;
        z-index: 300;
        display: none;
        font-family: 'Segoe UI', sans-serif;
        color: #ddd;
        font-size: 13px;
        overflow: hidden;
        flex-direction: column;
      `;

      const header = document.createElement('div');
      header.style.cssText = `
        padding: 12px 16px;
        border-bottom: 1px solid #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
      `;
      header.innerHTML = '<strong>Population Breakdown</strong>';

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '\u2715';
      closeBtn.style.cssText = `
        background: none; border: none; color: #888;
        cursor: pointer; font-size: 16px; padding: 0 4px;
      `;
      closeBtn.addEventListener('click', () => this.togglePopPanel());
      header.appendChild(closeBtn);

      this.popPanelBody = document.createElement('div');
      this.popPanelBody.style.cssText = `
        overflow-y: auto;
        padding: 8px 0;
        flex: 1;
      `;

      this.popPanel.appendChild(header);
      this.popPanel.appendChild(this.popPanelBody);
      document.body.appendChild(this.popPanel);
    }

    const showing = this.popPanel.style.display !== 'none';
    if (showing) {
      this.popPanel.style.display = 'none';
    } else {
      this.popPanel.style.display = 'flex';
      this.updatePopPanel();
    }
  }

  updatePopPanel() {
    const { people, tower } = this.gameState;
    const body = this.popPanelBody;

    if (people.size === 0) {
      body.innerHTML = '<div style="padding: 16px; color: #666; text-align: center;">No tenants yet</div>';
      return;
    }

    // Group people by room
    const roomGroups = new Map();
    for (const [, person] of people) {
      const roomId = person.homeRoom;
      if (!roomGroups.has(roomId)) roomGroups.set(roomId, []);
      roomGroups.get(roomId).push(person);
    }

    let html = '';

    // Summary bar
    const sat = Math.round(this.gameState.stats.averageSatisfaction);
    html += `<div style="padding: 8px 16px; color: #aaa; border-bottom: 1px solid #2a2a3a;">
      ${people.size} residents \u2022 Avg satisfaction: ${sat}%
    </div>`;

    // Sort rooms by floor (highest first), then by x
    const sortedRooms = [...roomGroups.entries()]
      .map(([roomId, persons]) => ({ room: tower.rooms.get(roomId), persons }))
      .filter(entry => entry.room)
      .sort((a, b) => b.room.gridY - a.room.gridY || a.room.gridX - b.room.gridX);

    for (const { room, persons } of sortedRooms) {
      const typeColors = {
        apartment: '#7eb5e0',
        office: '#b8d4a3',
        retail: '#f0c674',
        restaurant: '#e88a6a',
      };
      const color = typeColors[room.type] || '#aaa';

      html += `<div style="padding: 6px 16px; border-bottom: 1px solid #1a1a2a;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="display:inline-block;width:10px;height:10px;background:${color};border-radius:2px;"></span>
          <span style="color: #ccc; font-weight: 600;">${room.name}</span>
          <span style="color: #666; font-size: 11px;">Floor ${room.gridY}</span>
          <span style="color: #555; font-size: 11px; margin-left: auto;">${persons.length}/${room.capacity}</span>
        </div>`;

      for (const person of persons) {
        const psat = Math.round(person.satisfaction);
        let satColor, satEmoji;
        if (psat >= 80) { satColor = '#4ae04a'; satEmoji = '\u{1F601}'; }
        else if (psat >= 60) { satColor = '#8ec44a'; satEmoji = '\u{1F642}'; }
        else if (psat >= 40) { satColor = '#c4a44a'; satEmoji = '\u{1F610}'; }
        else if (psat >= 20) { satColor = '#c4744a'; satEmoji = '\u{1F61F}'; }
        else { satColor = '#c44a4a'; satEmoji = '\u{1F621}'; }

        const stateLabel = person.hidden ? 'Away' :
          person.state === 'in_room' ? 'Home' :
          person.state === 'walking' ? 'Walking' :
          person.state === 'waiting_elevator' ? 'Waiting' :
          person.state === 'in_elevator' ? 'Elevator' :
          person.state === 'spawning' ? 'Arriving' : person.state;

        html += `<div style="display: flex; align-items: center; padding: 2px 0 2px 18px; gap: 10px; font-size: 12px;">
          <span style="color: #666; width: 55px;">${stateLabel}</span>
          <span>${satEmoji}</span>
          <span style="color: ${satColor};">${psat}%</span>
        </div>`;
      }

      html += '</div>';
    }

    body.innerHTML = html;
  }

  updateSpeedButtons() {
    for (const { btn, speed } of this.speedButtons) {
      const active = speed === this.gameState.time.speed;
      btn.style.background = active ? '#335' : '#222';
      btn.style.color = active ? '#fff' : '#888';
    }
  }
}
