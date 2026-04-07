import { eventBus } from '../utils/EventBus.js';
import { formatMoney } from '../utils/helpers.js';

export class ToastNotification {
  constructor(gameState, renderer, unitDetail) {
    this.gameState = gameState;
    this.renderer = renderer;
    this.unitDetail = unitDetail;

    // Container for toasts
    // Clear all button (above the scroll area)
    this.clearAllBtn = document.createElement('button');
    this.clearAllBtn.className = 'clear-all-btn';
    this.clearAllBtn.style.cssText = `
      background: rgba(14, 14, 24, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 6px 14px;
      color: #888;
      cursor: pointer;
      font-size: 12px;
      font-family: 'Inter', sans-serif;
      font-weight: 500;
      pointer-events: auto;
      transition: all 0.15s;
      align-self: flex-end;
      display: none;
      margin-bottom: 6px;
    `;
    this.clearAllBtn.textContent = 'Clear all';
    this.clearAllBtn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'touch') return; this.clearAllBtn.style.color = '#bbb'; this.clearAllBtn.style.background = 'rgba(255,255,255,0.06)'; });
    this.clearAllBtn.addEventListener('pointerleave', (e) => { if (e.pointerType === 'touch') return; this.clearAllBtn.style.color = '#888'; this.clearAllBtn.style.background = 'rgba(14,14,24,0.9)'; });
    this.clearAllBtn.addEventListener('click', () => this.clearAll());

    // Pay all button
    this.payAllBtn = document.createElement('button');
    this.payAllBtn.className = 'pay-all-btn';
    this.payAllBtn.style.cssText = `
      background: rgba(50, 140, 50, 0.5);
      border: 1px solid rgba(80, 200, 80, 0.4);
      border-radius: 8px;
      padding: 6px 14px;
      color: #88ee88;
      cursor: pointer;
      font-size: 12px;
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      pointer-events: auto;
      transition: all 0.15s;
      align-self: flex-end;
      display: none;
      margin-bottom: 6px;
    `;
    this.payAllBtn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'touch') return; this.payAllBtn.style.color = '#aaffaa'; this.payAllBtn.style.background = 'rgba(50,140,50,0.7)'; });
    this.payAllBtn.addEventListener('pointerleave', (e) => { if (e.pointerType === 'touch') return; this.payAllBtn.style.color = '#88ee88'; this.payAllBtn.style.background = 'rgba(50,140,50,0.5)'; });
    this.payAllBtn.addEventListener('click', () => this.payAll());

    // Scrollable toast list
    this.toastList = document.createElement('div');
    this.toastList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      max-height: calc(100vh - 120px);
      pointer-events: none;
    `;

    // Outer container
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      z-index: 400;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      pointer-events: none;
      font-family: 'Inter', -apple-system, sans-serif;
    `;
    // Button row
    this.btnRow = document.createElement('div');
    this.btnRow.style.cssText = 'display:flex; gap:6px; align-self:flex-end; margin-bottom:6px;';
    this.btnRow.appendChild(this.payAllBtn);
    this.btnRow.appendChild(this.clearAllBtn);
    this.container.appendChild(this.btnRow);
    this.container.appendChild(this.toastList);
    document.body.appendChild(this.container);

    eventBus.on('maintenanceNeeded', ({ room, issue }) => this.showMaintenance(room, issue));
    eventBus.on('maintenanceRepaired', ({ room }) => this.removeToastForRoom(room));
    eventBus.on('tenantMovedOut', ({ room, reason }) => this.showMoveOut(room, reason));
    eventBus.on('elevatorLongWait', ({ elevator }) => this.showElevatorWait(elevator));
    eventBus.on('navigateToRoom', (room) => this.navigateToRoom(room));
  }

  showMaintenance(room, issue) {
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.dataset.roomId = room.id;
    toast.style.cssText = `
      background: rgba(14, 14, 24, 0.96);
      border: 1px solid rgba(200, 120, 40, 0.3);
      border-left: 3px solid #e08040;
      border-radius: 10px;
      padding: 12px 16px;
      color: #d0d0d8;
      font-size: 13px;
      max-width: 300px;
      pointer-events: auto;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
      opacity: 0;
      transform: translateX(20px);
      transition: all 0.3s;
    `;

    toast.innerHTML = `
      <div style="display:flex; align-items:flex-start; gap:6px;">
        <div style="flex:1; cursor:pointer;" class="toast-body">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="font-size:14px;">\u26A0\uFE0F</span>
            <span style="color:#e08040; font-weight:600;">${issue.name}</span>
          </div>
          <div style="color:#888; font-size:12px;">${room.name} \u2014 Floor ${room.gridY}</div>
          <div style="color:#666; font-size:11px; margin-top:2px;">Click to view</div>
        </div>
        <button class="toast-close" style="
          background:none; border:none; color:#555; cursor:pointer;
          font-size:14px; padding:2px 4px; border-radius:4px;
          transition:all 0.15s; line-height:1; flex-shrink:0;
        ">\u2715</button>
      </div>
    `;

    toast.querySelector('.toast-body').addEventListener('click', () => {
      this.navigateToRoom(room);
    });

    toast.querySelector('.toast-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissToast(toast);
    });

    this.toastList.appendChild(toast);
    this.updateClearAllButton();

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
      });
    });
  }

  showMoveOut(room, reason) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      background: rgba(14, 14, 24, 0.96);
      border: 1px solid rgba(100, 140, 200, 0.3);
      border-left: 3px solid #6088bb;
      border-radius: 10px;
      padding: 10px 14px;
      color: #d0d0d8;
      font-size: 12px;
      max-width: 280px;
      pointer-events: auto;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
      opacity: 0;
      transform: translateX(20px);
      transition: all 0.3s;
    `;
    toast.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-size:13px;">\u{1F4E4}</span>
        <span style="color:#8ab0dd;">Tenant left</span>
        <span style="color:#666;">\u2014</span>
        <span style="color:#888;">${room.name} F${room.gridY}</span>
      </div>
    `;

    this.toastList.appendChild(toast);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
      });
    });

    // Auto-clear after 3 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 3000);
  }

  showElevatorWait(elevator) {
    const avgMin = Math.round(elevator.avgWaitTime * 60);
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.dataset.elevatorId = elevator.id;
    toast.style.cssText = `
      background: rgba(14, 14, 24, 0.96);
      border: 1px solid rgba(200, 160, 40, 0.3);
      border-left: 3px solid #c8a030;
      border-radius: 10px;
      padding: 10px 14px;
      color: #d0d0d8;
      font-size: 12px;
      max-width: 280px;
      pointer-events: auto;
      cursor: pointer;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
      opacity: 0;
      transform: translateX(20px);
      transition: all 0.3s;
    `;
    toast.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-size:13px;">\u{23F3}</span>
        <span style="color:#c8a030; font-weight:600;">Long elevator waits</span>
      </div>
      <div style="color:#888; font-size:11px; margin-top:3px;">Avg wait: ${avgMin} min \u2014 F${elevator.minFloor}-F${elevator.maxFloor}</div>
      <div style="color:#666; font-size:11px; margin-top:2px;">Click to view \u2014 Consider adding another elevator</div>
    `;

    toast.addEventListener('click', () => {
      // Navigate to elevator and open status
      this.renderer.camera.position.x = elevator.gridX + 0.5;
      this.renderer.camera.position.y = (elevator.minFloor + elevator.maxFloor) / 2;
      requestAnimationFrame(() => {
        const screenPos = this.renderer.worldToScreen(elevator.gridX + 1, (elevator.minFloor + elevator.maxFloor) / 2);
        eventBus.emit('click', {
          x: elevator.gridX + 0.5,
          y: elevator.minFloor + 1,
          screenX: screenPos.x,
          screenY: screenPos.y,
        });
      });
      this.dismissToast(toast);
    });

    this.toastList.appendChild(toast);
    this.updateClearAllButton();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
      });
    });

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => {
          toast.remove();
          this.updateClearAllButton();
        }, 300);
      }
    }, 10000);
  }

  removeToastForRoom(room) {
    const toast = this.toastList.querySelector(`.toast-item[data-room-id="${room.id}"]`);
    if (toast) this.dismissToast(toast);
  }

  dismissToast(toast) {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => {
      toast.remove();
      this.updateClearAllButton();
    }, 300);
  }

  updateClearAllButton() {
    const toasts = this.toastList.querySelectorAll('.toast-item');
    const count = toasts.length;
    this.clearAllBtn.style.display = count > 1 ? 'block' : 'none';

    // Pay all — calculate total cost of all outstanding issues
    if (count > 1) {
      let totalCost = 0;
      const { tower } = this.gameState;
      for (const [, room] of tower.rooms) {
        if (room.maintenanceIssue) totalCost += room.maintenanceIssue.cost;
      }
      if (totalCost > 0 && this.gameState.money >= totalCost) {
        this.payAllBtn.textContent = `Fix all ($${totalCost.toLocaleString()})`;
        this.payAllBtn.style.display = 'block';
      } else {
        this.payAllBtn.style.display = 'none';
      }
    } else {
      this.payAllBtn.style.display = 'none';
    }
  }

  payAll() {
    const { tower } = this.gameState;
    const roomsToFix = [];
    let totalCost = 0;
    for (const [, room] of tower.rooms) {
      if (room.maintenanceIssue) {
        totalCost += room.maintenanceIssue.cost;
        roomsToFix.push(room);
      }
    }
    if (totalCost === 0 || this.gameState.money < totalCost) return;

    for (const room of roomsToFix) {
      this.gameState.spendMoney(room.maintenanceIssue.cost);
      room.repair({ day: this.gameState.time.day, hour: this.gameState.time.hour });
      eventBus.emit('maintenanceRepaired', { room });
    }
  }

  clearAll() {
    const toasts = this.toastList.querySelectorAll('.toast-item');
    toasts.forEach(t => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(20px)';
      setTimeout(() => t.remove(), 300);
    });
    this.clearAllBtn.style.display = 'none';
    this.payAllBtn.style.display = 'none';
  }

  navigateToRoom(room) {
    // Center camera on the room
    this.renderer.camera.position.x = room.gridX + room.width / 2;
    this.renderer.camera.position.y = room.gridY + 0.5;

    // Open unit detail after a frame so camera position is updated
    requestAnimationFrame(() => {
      const screenPos = this.renderer.worldToScreen(room.gridX + room.width, room.gridY + 0.5);
      this.unitDetail.selectedRoom = room;
      this.unitDetail.selectedElevator = null;
      this.unitDetail.positionPanel(room.gridX, room.gridY, room.width, room.height);
      this.unitDetail.panel.style.display = 'block';
      this.unitDetail.render();
    });
  }
}
