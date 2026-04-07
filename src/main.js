import { Renderer } from './render/Renderer.js';
import { SkyRenderer } from './render/SkyRenderer.js';
import { TowerRenderer } from './render/TowerRenderer.js';
import { GridOverlay } from './render/GridOverlay.js';
import { ElevatorRenderer } from './render/ElevatorRenderer.js';
import { PersonRenderer } from './render/PersonRenderer.js';
import { LightingSystem } from './render/LightingSystem.js';
import { WeatherSystem } from './render/WeatherSystem.js';
import { ParticleEffects } from './render/ParticleEffects.js';
import { FloatingText } from './render/FloatingText.js';
import { GameState } from './game/GameState.js';
import { Simulation } from './game/Simulation.js';
import { InputManager } from './input/InputManager.js';
import { CameraController } from './input/CameraController.js';
import { BuildTool } from './input/BuildTool.js';
import { UIManager } from './ui/UIManager.js';
import { UnitDetail } from './ui/UnitDetail.js';
import { ToastNotification } from './ui/ToastNotification.js';
import { eventBus } from './utils/EventBus.js';

// Rendering
const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);
const sky = new SkyRenderer(renderer.scene);
const towerRenderer = new TowerRenderer(renderer.scene);
const gridOverlay = new GridOverlay(renderer.scene);
gridOverlay.renderer = renderer;
const elevatorRenderer = new ElevatorRenderer(renderer.scene);
const personRenderer = new PersonRenderer(renderer.scene);
personRenderer.elevatorRenderer = elevatorRenderer;
const lighting = new LightingSystem(renderer.scene);
const weather = new WeatherSystem(renderer.scene);
const particles = new ParticleEffects(renderer.scene);

// Game state
const gameState = new GameState();
towerRenderer.elevators = gameState.tower.elevators;
const floatingText = new FloatingText(renderer.scene, gameState);

// Input
const inputManager = new InputManager(canvas, renderer);
const cameraController = new CameraController(renderer);
const buildTool = new BuildTool(gameState, gameState.tower, towerRenderer, gridOverlay, elevatorRenderer);

// UI
const ui = new UIManager(gameState);
const unitDetail = new UnitDetail(gameState, renderer);
const toasts = new ToastNotification(gameState, renderer, unitDetail);
ui.externalPanels.push({
  id: 'unitDetail',
  el: unitDetail.panel,
  trigger: null,
  close: () => unitDetail.close(),
});

// Simulation
const simulation = new Simulation(gameState, sky);

// Register steam emitters for restaurants
eventBus.on('roomPlaced', (room) => {
  if (room.type === 'restaurant') {
    particles.addSteamEmitter(room);
  }
});

// Rebuild exterior when elevators change (for roof lines)
eventBus.on('elevatorPlaced', () => towerRenderer.updateExterior());
eventBus.on('elevatorRemoved', () => towerRenderer.updateExterior());

// Per-frame render updates (lighting, animations, effects)
let lastInteriorUpdate = 0;
renderer.onUpdate = (delta) => {
  const elapsed = renderer.clock.getElapsedTime();
  lighting.update(gameState.time.hour);
  renderer.setNightBloom(lighting.nightFactor);
  sky.update(delta, gameState.time.hour, lighting.nightFactor, renderer.camera.position.x);
  weather.update(delta, gameState.time.hour, lighting);
  // Throttle interior updates to ~10fps (only neon sign pulse needs this)
  if (elapsed - lastInteriorUpdate > 0.1) {
    towerRenderer.updateRoomInteriors(gameState.time.hour, lighting.nightFactor, elapsed);
    lastInteriorUpdate = elapsed;
  }
  towerRenderer.updateAnimations(delta);
  elevatorRenderer.animateCabs(delta);
  personRenderer.animate(delta, elapsed, gameState.people);
  particles.update(delta, gameState.time.hour);
  floatingText.update(delta);
};

// Sync renderers each tick
eventBus.on('tick', () => {
  // Update elevator cab positions
  for (const [, elevator] of gameState.tower.elevators) {
    elevatorRenderer.updateCab(elevator);
  }

  // Sync person positions
  personRenderer.sync(gameState.people);
});

// Expose for debugging
window.game = { renderer, sky, gameState, simulation, towerRenderer };

console.log('VibeTower loaded');
