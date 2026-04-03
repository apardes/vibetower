import { Renderer } from './render/Renderer.js';
import { SkyRenderer } from './render/SkyRenderer.js';
import { TowerRenderer } from './render/TowerRenderer.js';
import { GridOverlay } from './render/GridOverlay.js';
import { ElevatorRenderer } from './render/ElevatorRenderer.js';
import { PersonRenderer } from './render/PersonRenderer.js';
import { GameState } from './game/GameState.js';
import { Simulation } from './game/Simulation.js';
import { InputManager } from './input/InputManager.js';
import { CameraController } from './input/CameraController.js';
import { BuildTool } from './input/BuildTool.js';
import { UIManager } from './ui/UIManager.js';
import { Tooltip } from './ui/Tooltip.js';
import { eventBus } from './utils/EventBus.js';

// Rendering
const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);
const sky = new SkyRenderer(renderer.scene);
const towerRenderer = new TowerRenderer(renderer.scene);
const gridOverlay = new GridOverlay(renderer.scene);
const elevatorRenderer = new ElevatorRenderer(renderer.scene);
const personRenderer = new PersonRenderer(renderer.scene);

// Game state
const gameState = new GameState();

// Input
const inputManager = new InputManager(canvas, renderer);
const cameraController = new CameraController(renderer);
const buildTool = new BuildTool(gameState, gameState.tower, towerRenderer, gridOverlay, elevatorRenderer);

// UI
const ui = new UIManager(gameState);
const tooltip = new Tooltip(gameState);

// Simulation
const simulation = new Simulation(gameState, sky);

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

console.log('SimTower loaded');
