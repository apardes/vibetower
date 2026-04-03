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

    // Central panel management — click outside closes, opening one closes others
    this.panels = [];
    this._setupPanelManagement();
  }

  _setupPanelManagement() {
    // Collect all panel references once they exist
    // We check lazily since some panels are created on first click
    document.addEventListener('mousedown', (e) => {
      this._collectPanels();
      const openPanels = this.panels.filter(p => p.el && p.el.style.display !== 'none');
      for (const panel of openPanels) {
        // Check if click is inside the panel or its trigger button
        if (panel.el.contains(e.target)) continue;
        if (panel.trigger && panel.trigger.contains(e.target)) continue;
        // Click is outside — close this panel
        panel.close();
      }
    });

    // Override toggle methods to close other panels when opening
    const originalTogglePop = this.hud.togglePopPanel.bind(this.hud);
    this.hud.togglePopPanel = () => {
      this._closeAllExcept('popPanel');
      originalTogglePop();
    };

    const originalToggleUnit = this.hud.toggleUnitPanel.bind(this.hud);
    this.hud.toggleUnitPanel = () => {
      this._closeAllExcept('unitPanel');
      originalToggleUnit();
    };

    const originalToggleHelp = this.hud.toggleHelp.bind(this.hud);
    this.hud.toggleHelp = () => {
      this._closeAllExcept('helpOverlay');
      originalToggleHelp();
    };

    const originalToggleLog = this.activityLog.toggle.bind(this.activityLog);
    this.activityLog.toggle = () => {
      this._closeAllExcept('logPanel');
      originalToggleLog();
    };

    const originalToggleInfo = this.toolbar.toggleInfoPanel.bind(this.toolbar);
    this.toolbar.toggleInfoPanel = () => {
      this._closeAllExcept('infoPanel');
      originalToggleInfo();
    };
  }

  _collectPanels() {
    // Rebuild panel list (panels may be lazily created)
    this.panels = [
      { id: 'popPanel', el: this.hud.popPanel, trigger: this.hud.popEl, close: () => { if (this.hud.popPanel) this.hud.popPanel.style.display = 'none'; } },
      { id: 'unitPanel', el: this.hud.unitPanel, trigger: this.hud.occEl, close: () => { if (this.hud.unitPanel) this.hud.unitPanel.style.display = 'none'; } },
      { id: 'helpOverlay', el: this.hud.helpOverlay, trigger: null, close: () => { this.hud.helpOverlay.style.display = 'none'; } },
      { id: 'logPanel', el: this.activityLog.panel, trigger: this.activityLog.btn, close: () => { this.activityLog.panel.style.display = 'none'; } },
      { id: 'infoPanel', el: this.toolbar.infoPanel, trigger: null, close: () => { this.toolbar.infoPanel.style.display = 'none'; } },
      { id: 'submenu', el: this.toolbar.openCategoryId ? this.toolbar.categoryBtns[this.toolbar.openCategoryId]?.submenu : null, trigger: this.toolbar.el, close: () => { this.toolbar.closeSubmenu(); } },
    ];
  }

  _closeAllExcept(keepId) {
    this._collectPanels();
    for (const panel of this.panels) {
      if (panel.id !== keepId && panel.el && panel.el.style.display !== 'none') {
        panel.close();
      }
    }
  }
}
