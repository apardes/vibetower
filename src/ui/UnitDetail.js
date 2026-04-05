import { eventBus } from '../utils/EventBus.js';
import { worldToGrid, formatMoney } from '../utils/helpers.js';

export class UnitDetail {
  constructor(gameState, renderer) {
    this.gameState = gameState;
    this.renderer = renderer;
    this.selectedRoom = null;
    this.selectedElevator = null;

    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: fixed;
      background: rgba(14, 14, 24, 0.96);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 13px;
      color: #d0d0d8;
      z-index: 250;
      display: none;
      width: 280px;
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    `;
    document.body.appendChild(this.panel);

    eventBus.on('click', (pos) => this.onClick(pos));
    eventBus.on('roomRemoved', () => this.close());
    eventBus.on('maintenanceNeeded', () => this.refresh());
    eventBus.on('maintenanceRepaired', () => this.refresh());

    // Use event delegation for the repair button
    this.panel.addEventListener('click', (e) => {
      if (e.target.id === 'repair-btn' || e.target.closest('#repair-btn')) {
        this.handleRepair();
      }
    });
  }

  onClick({ x, y, screenX, screenY }) {
    if (this.gameState.selectedTool) {
      this.close();
      return;
    }

    const grid = worldToGrid(x, y);
    const room = this.gameState.tower.getRoomAt(grid.gridX, grid.gridY);

    if (!room) {
      // Check if it's an elevator
      const { tower } = this.gameState;
      for (const [, elev] of tower.elevators) {
        if (grid.gridX === elev.gridX && grid.gridY >= elev.minFloor && grid.gridY <= elev.maxFloor) {
          this.selectedRoom = null;
          this.selectedElevator = elev;
          const elevHeight = elev.maxFloor - elev.minFloor + 1;
          this.positionPanel(elev.gridX, elev.minFloor, 1, elevHeight);
          this.panel.style.display = 'block';
          this.render();
          return;
        }
      }
      this.close();
      return;
    }

    if (room.type === 'elevator') {
      const { tower } = this.gameState;
      for (const [, elev] of tower.elevators) {
        if (grid.gridX === elev.gridX && grid.gridY >= elev.minFloor && grid.gridY <= elev.maxFloor) {
          this.selectedRoom = null;
          this.selectedElevator = elev;
          const elevHeight = elev.maxFloor - elev.minFloor + 1;
          this.positionPanel(elev.gridX, elev.minFloor, 1, elevHeight);
          this.panel.style.display = 'block';
          this.render();
          return;
        }
      }
      this.close();
      return;
    }

    this.selectedRoom = room;
    this.selectedElevator = null;
    this.positionPanel(room.gridX, room.gridY, room.width, room.height);
    this.panel.style.display = 'block';
    this.render();
  }

  positionPanel(worldX, worldY, width, height) {
    // Position panel to the right of the unit
    const rightEdge = this.renderer.worldToScreen(worldX + width, worldY + height / 2);
    let left = rightEdge.x + 24;
    let top = rightEdge.y - 120;

    // If it goes off the right edge, put it on the left side of the unit
    if (left + 290 > window.innerWidth) {
      const leftEdge = this.renderer.worldToScreen(worldX, worldY + height / 2);
      left = leftEdge.x - 304;
    }
    // Keep on screen vertically
    if (top + 300 > window.innerHeight) top = window.innerHeight - 310;
    if (top < 54) top = 54;

    this.panel.style.left = left + 'px';
    this.panel.style.top = top + 'px';
  }

  close() {
    this.panel.style.display = 'none';
    this.selectedRoom = null;
    this.selectedElevator = null;
  }

  refresh() {
    if (this.panel.style.display === 'none') return;
    if (this.selectedElevator) {
      if (!this.gameState.tower.elevators.has(this.selectedElevator.id)) {
        this.close();
        return;
      }
      this.render();
      return;
    }
    if (!this.selectedRoom) return;
    if (!this.gameState.tower.rooms.has(this.selectedRoom.id)) {
      this.close();
      return;
    }
    this.render();
  }

  render() {
    if (this.selectedElevator) {
      this.renderElevator();
      return;
    }
    const room = this.selectedRoom;
    if (!room) return;

    const typeColors = {
      lobby: '#bfb398',
      apartment: '#6a9cc4',
      office: '#9dba8c',
      retail: '#d4ad60',
      restaurant: '#c87858',
    };
    const color = typeColors[room.type] || '#888';

    const hasCapacity = room.capacity > 0;
    const occupants = room.tenants ? room.tenants.length : 0;
    const occText = hasCapacity ? `${occupants}/${room.capacity}` : '\u2014';
    const occPct = hasCapacity && room.capacity > 0 ? Math.round((occupants / room.capacity) * 100) : 0;

    const sat = Math.round(room.satisfaction);
    let satColor;
    if (sat >= 80) satColor = '#5cdb5c';
    else if (sat >= 60) satColor = '#8ec44a';
    else if (sat >= 40) satColor = '#c4a44a';
    else if (sat >= 20) satColor = '#c4744a';
    else satColor = '#c44a4a';

    let residentsHtml = '';
    if (room.tenants && room.tenants.length > 0) {
      const { people } = this.gameState;
      for (const personId of room.tenants) {
        const person = people.get(personId);
        if (!person) continue;

        const psat = Math.round(person.satisfaction);
        let pColor;
        if (psat >= 80) pColor = '#5cdb5c';
        else if (psat >= 60) pColor = '#8ec44a';
        else if (psat >= 40) pColor = '#c4a44a';
        else if (psat >= 20) pColor = '#c4744a';
        else pColor = '#c44a4a';

        const stateLabel = person.hidden ? 'Away' :
          person.state === 'in_room' ? 'Present' :
          person.state === 'walking' ? 'Walking' :
          person.state === 'waiting_elevator' ? 'Waiting' :
          person.state === 'in_elevator' ? 'Elevator' :
          person.state === 'spawning' ? 'Arriving' : person.state;

        residentsHtml += `
          <div style="display:flex; align-items:center; padding:4px 0; gap:8px; font-size:12px;">
            <span style="color:#666; width:50px;">${stateLabel}</span>
            <span style="color:${pColor}; font-weight:500;">${psat}%</span>
          </div>`;
      }
    }

    this.panel.innerHTML = `
      <div style="padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
          <span style="display:inline-block;width:12px;height:12px;background:${color};border-radius:3px;"></span>
          <span style="font-size:15px; font-weight:600; color:#e0e0e8;">${room.name}</span>
          <span style="color:#555; font-size:12px; margin-left:auto;">Floor ${room.gridY}</span>
        </div>

        <div style="display:flex; gap:16px; font-size:12px; color:#888;">
          <div>
            <div style="color:#555; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2px;">Income</div>
            <div style="color:${room.income >= 0 ? '#5cdb5c' : '#c44a4a'}; font-weight:600;">${room.income > 0 ? '+' : ''}${formatMoney(room.income)}/day</div>
          </div>
          ${hasCapacity ? `
          <div>
            <div style="color:#555; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2px;">Occupancy</div>
            <div style="color:#d0d0d8; font-weight:600;">${occText} <span style="color:#666; font-weight:400;">(${occPct}%)</span></div>
          </div>
          ` : ''}
          <div>
            <div style="color:#555; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2px;">Satisfaction</div>
            <div style="color:${satColor}; font-weight:600;">${sat}%</div>
          </div>
        </div>

        ${hasCapacity ? `
        <div style="margin-top:8px; height:4px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden;">
          <div style="height:100%; width:${occPct}%; background:${color}; border-radius:2px; transition:width 0.3s;"></div>
        </div>
        ` : ''}
      </div>

      ${room.maintenanceIssue ? `
      <div style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.06); background:rgba(200,80,40,0.08);">
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
          <span style="font-size:14px;">\u26A0\uFE0F</span>
          <span style="color:#e08040; font-weight:600; font-size:13px;">${room.maintenanceIssue.name}</span>
        </div>
        <div style="color:#888; font-size:12px; margin-bottom:8px;">${room.maintenanceIssue.desc}</div>
        <button id="repair-btn" style="
          padding:6px 14px;
          border:none;
          border-radius:6px;
          background:rgba(80,160,80,0.2);
          color:#5cdb5c;
          cursor:pointer;
          font-size:12px;
          font-family:'Inter',sans-serif;
          font-weight:600;
          transition:all 0.15s;
          width:100%;
        ">\u{1F527} Repair \u2014 ${formatMoney(room.maintenanceIssue.cost)}</button>
      </div>
      ` : ''}

      ${residentsHtml ? `
      <div style="padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="color:#555; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Occupants</div>
        ${residentsHtml}
      </div>
      ` : ''}

      ${room.log && room.log.length > 0 ? `
      <div style="padding:10px 16px; max-height:120px; overflow-y:auto;">
        <div style="color:#555; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Activity</div>
        ${this.renderLog(room.log)}
      </div>
      ` : ''}
    `;

  }

  handleRepair() {
    const room = this.selectedRoom;
    if (!room || !room.maintenanceIssue) return;
    const cost = room.maintenanceIssue.cost;
    if (this.gameState.money < cost) return;
    this.gameState.spendMoney(cost);
    room.repair({ day: this.gameState.time.day, hour: this.gameState.time.hour });
    eventBus.emit('maintenanceRepaired', { room });
    this.render();
  }

  renderLog(log) {
    const typeIcons = {
      built: '\u{1F3D7}',
      move_in: '\u{1F4E5}',
      move_out: '\u{1F4E4}',
      departure: '\u{1F6B6}',
      income: '\u{1F4B0}',
      satisfaction: '\u{1F4CA}',
      repair: '\u{1F527}',
      damage: '\u{26A0}',
    };

    return log.slice(0, 15).map(entry => {
      const icon = typeIcons[entry.type] || '\u{1F4DD}';
      const h = Math.floor(entry.hour);
      const m = Math.floor((entry.hour % 1) * 60);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const time = `D${entry.day} ${h12}:${m.toString().padStart(2, '0')}${ampm}`;

      return `<div style="display:flex; align-items:center; padding:3px 0; gap:6px; font-size:11px;">
        <span style="flex-shrink:0;">${icon}</span>
        <span style="color:#888; flex:1;">${entry.message}</span>
        <span style="color:#555; font-size:10px; white-space:nowrap;">${time}</span>
      </div>`;
    }).join('');
  }

  renderElevator() {
    const elev = this.selectedElevator;
    if (!elev) return;

    const floors = elev.maxFloor - elev.minFloor + 1;
    const passengers = elev.passengers.size;
    const capacity = elev.capacity;
    const occPct = Math.round((passengers / capacity) * 100);
    const color = '#888888';

    const stateLabel = elev.state === 'idle' ? 'Idle' :
      elev.state === 'moving' ? `Moving ${elev.direction > 0 ? '\u25B2' : '\u25BC'}` :
      elev.state === 'stopped' ? `Stopped \u2014 Floor ${elev.currentFloor}` : elev.state;

    // Elevator maintenance cost is fixed at $200/day

    // Passenger details
    let passHtml = '';
    if (passengers > 0) {
      const { people } = this.gameState;
      for (const personId of elev.passengers) {
        const person = people.get(personId);
        if (!person) continue;
        const dest = person.targetFloor >= 0 ? `\u2192 F${person.targetFloor}` : '';
        passHtml += `
          <div style="display:flex; align-items:center; padding:4px 0; gap:8px; font-size:12px;">
            <span style="color:#666;">Riding</span>
            <span style="color:#888;">${dest}</span>
          </div>`;
      }
    }

    // Queued floors
    const queued = [...elev.requestedFloors].sort((a, b) => a - b);
    const queueHtml = queued.length > 0
      ? `<span style="color:#888;">${queued.map(f => 'F' + f).join(', ')}</span>`
      : '<span style="color:#555;">None</span>';

    this.panel.innerHTML = `
      <div style="padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
          <span style="display:inline-block;width:12px;height:12px;background:${color};border-radius:3px;"></span>
          <span style="font-size:15px; font-weight:600; color:#e0e0e8;">Elevator</span>
          <span style="color:#555; font-size:12px; margin-left:auto;">F${elev.minFloor}\u2013F${elev.maxFloor}</span>
        </div>

        <div style="display:flex; gap:16px; font-size:12px; color:#888;">
          <div>
            <div style="color:#555; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2px;">Status</div>
            <div style="color:#d0d0d8; font-weight:500;">${stateLabel}</div>
          </div>
          <div>
            <div style="color:#555; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2px;">Passengers</div>
            <div style="color:#d0d0d8; font-weight:600;">${passengers}/${capacity}</div>
          </div>
          <div>
            <div style="color:#555; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2px;">Floors</div>
            <div style="color:#d0d0d8; font-weight:600;">${floors}</div>
          </div>
        </div>

        <div style="margin-top:8px; height:4px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden;">
          <div style="height:100%; width:${occPct}%; background:${color}; border-radius:2px; transition:width 0.3s;"></div>
        </div>
      </div>

      <div style="padding:10px 16px;">
        <div style="color:#555; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Queued Stops</div>
        <div style="font-size:12px; margin-bottom:8px;">${queueHtml}</div>

        ${passHtml ? `
        <div style="color:#555; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Passengers</div>
        ${passHtml}
        ` : ''}
      </div>
    `;
  }
}
