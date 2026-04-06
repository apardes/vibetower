// Grid dimensions
export const CELL_WIDTH = 1;
export const CELL_HEIGHT = 1;
export const TOWER_MAX_WIDTH = 1000; // effectively unlimited
export const TOWER_MAX_FLOORS = 30;  // floors 0-29
export const TOWER_CENTER_X = 500;   // camera starts in the middle of the grid

// Camera defaults
export const CAMERA_VIEW_WIDTH = 30;
export const CAMERA_VIEW_HEIGHT = 20;
export const CAMERA_ZOOM_MIN = 0.5;
export const CAMERA_ZOOM_MAX = 3.0;

// Demand / Vacancy
export const DEMAND_CONFIG = {
  baseChancePerTick: 0.001,
  starDemand: {
    apartment:  [0.5, 0.8, 1.0, 1.2, 1.5],
    office:     [0.1, 0.4, 0.8, 1.2, 1.8],
    retail:     [0.3, 0.6, 1.0, 1.3, 1.5],
    restaurant: [0.2, 0.5, 0.8, 1.2, 1.6],
  },
  factors: {
    elevatorAccess: 0.15,
    occupancyRate: 0.2,
    maintenanceHealth: 0.15,
    amenityBonus: 0.3,
    vacancyPenalty: -0.1,
  },
};

// Satisfaction
export const SATISFACTION_FACTORS = {
  // Per-star base comfort: index 0 = 1-star, index 4 = 5-star
  // Higher star ratings attract pickier tenants with higher expectations
  baseComfort: {
    apartment:  [55, 50, 45, 40, 35],
    office:     [50, 45, 40, 35, 30],
    retail:     [45, 42, 38, 33, 28],
    restaurant: [45, 42, 38, 33, 28],
    lobby:      [70, 70, 70, 70, 70],
  },
  floorBonus: { maxBonus: 6 },
  elevatorAccess: { penalty: -25, threshold: 2 },
  noisePenalty: { retail: -10, restaurant: -7 },
  // Wait times are scaled by ELEVATOR_TIME_SCALE before evaluation
  elevatorWait: { graceMinutes: 2, penaltyPerMinute: 4, maxPenalty: 25 },
};

// Move-out / Vacancy
export const MOVEOUT_CONFIG = {
  // Satisfaction threshold per star rating. Index = star rating (1-5).
  // Room satisfaction below this triggers move-out evaluation.
  thresholds: [0, 30, 50, 70, 80, 90],  // index 0 unused

  // Tiny base chance even when satisfied (random life events)
  baseChance: 0.005,

  // Linear: moveOutChance = baseChance + (deficit/100) * maxDeficitChance
  maxDeficitChance: 0.85,

  typeMultiplier: {
    apartment: 1.0,
    office: 0.6,
    retail: 0.7,
    restaurant: 0.7,
  },

  vacancyCooldown: 5,

  // Spawn gating
  spawnSatisfactionFloor: 25,
  spawnSatisfactionSoftCap: 60,
  spawnPenaltyPerPoint: 0.03,
};

// Elevator time compression — converts raw game-time waits to realistic perceived waits
export const ELEVATOR_TIME_SCALE = 0.075;

// Time
export const TICKS_PER_SECOND = 20;
export const BASE_TICK_HOURS = 0.02; // game-hours per tick at 1x speed

// Sky colors (hour -> color)
export const SKY_COLORS = {
  night:   { top: '#0a0e27', bottom: '#1a1a3e' },
  dawn:    { top: '#2d1b4e', bottom: '#e8845c' },
  day:     { top: '#4a90d9', bottom: '#87ceeb' },
  sunset:  { top: '#2d1b4e', bottom: '#e8845c' },
};

// Room type definitions
export const ROOM_TYPES = {
  lobby: {
    name: 'Lobby',
    width: 4,
    height: 1,
    cost: 5000,
    income: 0,
    capacity: 0,
    color: '#bfb398',
    unlockStar: 1,
    floorRestriction: 0,
    maintenanceImpact: { target: 'all', selection: null, reach: 1.0, intensity: 1.0 },
    amenityEffect: null,
  },
  apartment: {
    name: 'Apartment',
    width: 2,
    height: 1,
    cost: 20000,
    income: 500,
    capacity: 2,
    color: '#6a9cc4',
    unlockStar: 1,
    maintenanceImpact: { target: 'self', selection: null, reach: 1.0, intensity: 1.0 },
    amenityEffect: null,
  },
  office: {
    name: 'Office',
    width: 3,
    height: 1,
    cost: 40000,
    income: 1000,
    capacity: 6,
    color: '#9dba8c',
    unlockStar: 1,
    maintenanceImpact: { target: 'self', selection: null, reach: 1.0, intensity: 1.0 },
    amenityEffect: null,
  },
  retail: {
    name: 'Retail',
    width: 2,
    height: 1,
    cost: 30000,
    income: 800,
    capacity: 0,
    color: '#d4ad60',
    unlockStar: 1,
    maintenanceImpact: { target: 'subset', selection: 'proximity', reach: 0.3, intensity: 0.25 },
    amenityEffect: { target: 'subset', selection: 'proximity', reach: 0.4, boostMin: 2, boostMax: 6, appealsTo: ['apartment'] },
    visitConfig: {
      visitorCapacity: 6,
      visitDuration: [1.0, 2.0],
      dailyVisitsPerPerson: [2, 4],
      operatingHours: [9, 21],
      satisfactionBoost: [3, 8],
      appealsTo: ['apartment'],
    },
  },
  restaurant: {
    name: 'Restaurant',
    width: 4,
    height: 1,
    cost: 80000,
    income: 2000,
    capacity: 0,
    color: '#c87858',
    unlockStar: 1,
    maintenanceImpact: { target: 'subset', selection: 'proximity', reach: 0.4, intensity: 0.3 },
    amenityEffect: { target: 'subset', selection: 'proximity', reach: 0.5, boostMin: 3, boostMax: 8, appealsTo: ['apartment', 'office'] },
    visitConfig: {
      visitorCapacity: 10,
      visitDuration: [2.0, 4.0],
      dailyVisitsPerPerson: [0, 1],
      operatingHours: [10, 23],
      satisfactionBoost: [5, 12],
      appealsTo: ['apartment', 'office'],
    },
  },
  elevator: {
    name: 'Elevator',
    width: 1,
    height: 1,
    costPerFloor: 10000,
    cost: 10000,
    income: -200,
    capacity: 12,
    color: '#888888',
    unlockStar: 1,
    maintenanceImpact: { target: 'elevator', selection: null, reach: 1.0, intensity: 1.0 },
    amenityEffect: null,
  },
};

// Star rating thresholds
export const STAR_THRESHOLDS = [
  { star: 1, population: 0,    satisfaction: 0 },
  { star: 2, population: 100,  satisfaction: 50 },
  { star: 3, population: 300,  satisfaction: 70 },
  { star: 4, population: 500,  satisfaction: 80 },
  { star: 5, population: 1000, satisfaction: 90 },
];

// Maintenance config per unit type
// interval: average game-days between issues
// variance: random +/- days added to interval
// issues: pool of possible problems, each with name, description, costMin, costMax
export const MAINTENANCE = {
  lobby: {
    interval: 18,
    variance: 5,
    issues: [
      { name: 'Light replacement', desc: 'Several lobby light fixtures have burned out', costMin: 50, costMax: 150, weight: 30, severity: 1 },
      { name: 'Floor polishing', desc: 'Lobby floors scuffed from heavy foot traffic', costMin: 200, costMax: 500, weight: 25, severity: 1 },
      { name: 'Door adjustment', desc: 'Entrance doors worn from constant use', costMin: 150, costMax: 400, weight: 20, severity: 2 },
      { name: 'Cleaning service', desc: 'Deep cleaning of lobby common areas', costMin: 100, costMax: 300, weight: 15, severity: 1 },
      { name: 'Window replacement', desc: 'Cracked lobby window needs replacement', costMin: 500, costMax: 1500, weight: 5, severity: 2 },
      { name: 'Plumbing repair', desc: 'Lobby restroom plumbing backup', costMin: 400, costMax: 1200, weight: 3, severity: 3 },
      { name: 'Foundation crack', desc: 'Foundation crack detected, structural repair needed', costMin: 5000, costMax: 15000, weight: 1, severity: 5 },
      { name: 'Flood damage', desc: 'Water damage from burst pipe requires major restoration', costMin: 3000, costMax: 10000, weight: 1, severity: 4 },
    ],
  },
  apartment: {
    interval: 12,
    variance: 4,
    issues: [
      { name: 'Clogged drain', desc: 'Sink or shower drain is blocked', costMin: 50, costMax: 150, weight: 25, severity: 1 },
      { name: 'Leaky faucet', desc: 'Dripping faucet in kitchen or bathroom', costMin: 75, costMax: 200, weight: 25, severity: 1 },
      { name: 'Smoke detector', desc: 'Smoke detector battery or unit replacement', costMin: 30, costMax: 80, weight: 20, severity: 1 },
      { name: 'Pest control', desc: 'Routine pest treatment required', costMin: 80, costMax: 250, weight: 10, severity: 2 },
      { name: 'Appliance repair', desc: 'Refrigerator or stove malfunctioning', costMin: 300, costMax: 800, weight: 8, severity: 3 },
      { name: 'HVAC servicing', desc: 'Heating/cooling system needs maintenance', costMin: 250, costMax: 700, weight: 5, severity: 3 },
      { name: 'Electrical fault', desc: 'Faulty outlet or wiring issue', costMin: 200, costMax: 600, weight: 4, severity: 3 },
      { name: 'Water heater failure', desc: 'Water heater needs full replacement', costMin: 1500, costMax: 3500, weight: 2, severity: 4 },
      { name: 'Mold remediation', desc: 'Mold discovered behind walls, professional removal needed', costMin: 2000, costMax: 5000, weight: 1, severity: 4 },
    ],
  },
  office: {
    interval: 15,
    variance: 5,
    issues: [
      { name: 'Light ballast', desc: 'Fluorescent light ballast buzzing and flickering', costMin: 50, costMax: 150, weight: 25, severity: 1 },
      { name: 'Carpet cleaning', desc: 'Office carpets stained from daily use', costMin: 150, costMax: 400, weight: 20, severity: 1 },
      { name: 'Door hardware', desc: 'Office door handle or lock needs replacement', costMin: 75, costMax: 200, weight: 15, severity: 1 },
      { name: 'Network outage', desc: 'Network switch or router needs replacement', costMin: 400, costMax: 1200, weight: 15, severity: 3 },
      { name: 'HVAC servicing', desc: 'Climate control strained by electronics heat', costMin: 500, costMax: 1200, weight: 10, severity: 3 },
      { name: 'Electrical panel', desc: 'Circuit breaker tripping from power draw', costMin: 600, costMax: 1500, weight: 8, severity: 3 },
      { name: 'Server room cooling', desc: 'Server room AC unit failed, emergency replacement', costMin: 3000, costMax: 8000, weight: 4, severity: 4 },
      { name: 'Fire suppression', desc: 'Sprinkler system inspection and valve replacement', costMin: 2000, costMax: 5000, weight: 3, severity: 4 },
    ],
  },
  retail: {
    interval: 10,
    variance: 3,
    issues: [
      { name: 'Signage repair', desc: 'Store signage bulb or panel needs fixing', costMin: 50, costMax: 200, weight: 20, severity: 1 },
      { name: 'Shelf repair', desc: 'Broken shelving unit from customer wear', costMin: 75, costMax: 250, weight: 20, severity: 1 },
      { name: 'Door sensor', desc: 'Automatic door sensor worn out from constant use', costMin: 100, costMax: 300, weight: 15, severity: 2 },
      { name: 'Cooler malfunction', desc: 'Refrigeration unit needs compressor service', costMin: 500, costMax: 1500, weight: 15, severity: 3 },
      { name: 'Security system', desc: 'Security cameras or alarm panel need repair', costMin: 400, costMax: 1000, weight: 10, severity: 2 },
      { name: 'Plumbing issue', desc: 'Store plumbing backup needs clearing', costMin: 200, costMax: 600, weight: 10, severity: 2 },
      { name: 'Walk-in cooler failure', desc: 'Walk-in cooler compressor died, full replacement needed', costMin: 3000, costMax: 7000, weight: 5, severity: 4 },
      { name: 'Electrical rewiring', desc: 'Major electrical fault requires rewiring the unit', costMin: 2000, costMax: 5000, weight: 5, severity: 4 },
    ],
  },
  restaurant: {
    interval: 8,
    variance: 3,
    issues: [
      { name: 'Grease trap cleaning', desc: 'Grease trap full from heavy cooking volume', costMin: 150, costMax: 400, weight: 25, severity: 2 },
      { name: 'Pest control', desc: 'Kitchen food waste attracts pests, treatment needed', costMin: 200, costMax: 500, weight: 20, severity: 2 },
      { name: 'Light fixture', desc: 'Dining area light fixture needs replacement', costMin: 50, costMax: 200, weight: 15, severity: 1 },
      { name: 'Kitchen equipment', desc: 'Burner or oven element worn from heavy use', costMin: 800, costMax: 2000, weight: 15, severity: 3 },
      { name: 'Ventilation repair', desc: 'Kitchen exhaust clogged with grease buildup', costMin: 600, costMax: 1500, weight: 10, severity: 3 },
      { name: 'Dishwasher repair', desc: 'Commercial dishwasher strained from constant cycling', costMin: 500, costMax: 1200, weight: 8, severity: 3 },
      { name: 'Health code violation', desc: 'Failed health inspection, major kitchen overhaul required', costMin: 5000, costMax: 12000, weight: 3, severity: 5 },
      { name: 'Walk-in freezer failure', desc: 'Walk-in freezer compressor died, emergency replacement', costMin: 4000, costMax: 10000, weight: 2, severity: 4 },
      { name: 'Hood fire suppression', desc: 'Fire suppression system discharged, full recharge and cleanup', costMin: 3000, costMax: 8000, weight: 2, severity: 5 },
    ],
  },
  elevator: {
    interval: 7,
    variance: 3,
    issues: [
      { name: 'Light bulb', desc: 'Cab interior light burned out', costMin: 25, costMax: 75, weight: 25, severity: 1 },
      { name: 'Button replacement', desc: 'Floor button worn out from passenger use', costMin: 50, costMax: 200, weight: 20, severity: 1 },
      { name: 'Door sensor', desc: 'Door sensor triggered too many times, needs recalibration', costMin: 100, costMax: 300, weight: 20, severity: 2 },
      { name: 'Door mechanism', desc: 'Doors misaligned from thousands of open/close cycles', costMin: 500, costMax: 1500, weight: 15, severity: 3 },
      { name: 'Cable lubrication', desc: 'Cables need inspection and lubrication', costMin: 800, costMax: 2000, weight: 8, severity: 2 },
      { name: 'Safety inspection', desc: 'Mandatory annual safety certification renewal', costMin: 1000, costMax: 2500, weight: 5, severity: 3 },
      { name: 'Motor overhaul', desc: 'Drive motor worn from heavy daily use', costMin: 5000, costMax: 12000, weight: 3, severity: 4 },
      { name: 'Control system', desc: 'Main control board failed, full replacement needed', costMin: 4000, costMax: 10000, weight: 2, severity: 5 },
      { name: 'Cable replacement', desc: 'Cables worn beyond safe limits from constant travel', costMin: 8000, costMax: 20000, weight: 2, severity: 5 },
    ],
  },
};

// Murphy's Law — severe issues become more likely when cash is low
export const MURPHYS_LAW = {
  cashThreshold: 10000,
  graceDays: 30,
  severityThreshold: 3,
  severeWeightMultiplier: 20,
};

// Room schedules — defines daily rhythms per room type
export const ROOM_SCHEDULES = {
  apartment: {
    leaveWindow:  [6.5, 9.5],   // residents leave between 6:30-9:30am
    leavePeak:    8.0,           // most leave around 8am
    returnWindow: [16.5, 20.0], // residents return 4:30-8pm
    returnPeak:   18.0,         // most return around 6pm
    stayHomeChance: 0.15,       // 15% stay home all day
  },
  office: {
    arriveWindow: [6.5, 10.0],  // workers arrive 6:30-10am
    arrivePeak:   8.5,          // most arrive around 8:30am
    departWindow: [16.0, 21.0], // workers leave 4-9pm
    departPeak:   17.5,         // most leave around 5:30pm
    stayLateChance: 0.1,        // 10% work very late
  },
  retail: {
    openHour:  9.0,
    closeHour: 21.0,
  },
  restaurant: {
    openHour:  10.0,
    closeHour: 23.0,
  },
};

// Starting money
export const STARTING_MONEY = 500000;
