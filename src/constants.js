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
    floorRestriction: 0, // lobby only on ground floor
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
  },
  elevator: {
    name: 'Elevator',
    width: 1,
    height: 1, // per-floor cost; actual height is variable
    costPerFloor: 10000,
    cost: 10000, // display cost per floor
    income: -200, // maintenance cost per day
    capacity: 8,
    color: '#888888',
    unlockStar: 1,
  },
};

// Star rating thresholds
export const STAR_THRESHOLDS = [
  { star: 1, population: 0,    satisfaction: 0 },
  { star: 2, population: 100,  satisfaction: 50 },
  { star: 3, population: 300,  satisfaction: 60 },
  { star: 4, population: 500,  satisfaction: 70 },
  { star: 5, population: 1000, satisfaction: 80 },
];

// Maintenance config per unit type
// interval: average game-days between issues
// variance: random +/- days added to interval
// issues: pool of possible problems, each with name, description, costMin, costMax
export const MAINTENANCE = {
  lobby: {
    interval: 14,
    variance: 4,
    issues: [
      // High foot traffic = lots of wear on floors, doors, lights
      { name: 'Light replacement', desc: 'Several lobby light fixtures have burned out', costMin: 50, costMax: 150, weight: 30 },
      { name: 'Floor polishing', desc: 'Lobby floors scuffed from heavy foot traffic', costMin: 200, costMax: 500, weight: 25 },
      { name: 'Door adjustment', desc: 'Entrance doors worn from constant use', costMin: 150, costMax: 400, weight: 20 },
      { name: 'Cleaning service', desc: 'Deep cleaning of lobby common areas', costMin: 100, costMax: 300, weight: 15 },
      { name: 'Window replacement', desc: 'Cracked lobby window needs replacement', costMin: 500, costMax: 1500, weight: 5 },
      { name: 'Plumbing repair', desc: 'Lobby restroom plumbing backup', costMin: 400, costMax: 1200, weight: 3 },
      { name: 'Foundation crack', desc: 'Foundation crack detected, structural repair needed', costMin: 5000, costMax: 15000, weight: 1 },
      { name: 'Flood damage', desc: 'Water damage from burst pipe requires major restoration', costMin: 3000, costMax: 10000, weight: 1 },
    ],
  },
  apartment: {
    interval: 10,
    variance: 3,
    issues: [
      // Daily living wears out plumbing, appliances, HVAC
      { name: 'Clogged drain', desc: 'Sink or shower drain is blocked', costMin: 50, costMax: 150, weight: 25 },
      { name: 'Leaky faucet', desc: 'Dripping faucet in kitchen or bathroom', costMin: 75, costMax: 200, weight: 25 },
      { name: 'Smoke detector', desc: 'Smoke detector battery or unit replacement', costMin: 30, costMax: 80, weight: 20 },
      { name: 'Pest control', desc: 'Routine pest treatment required', costMin: 80, costMax: 250, weight: 10 },
      { name: 'Appliance repair', desc: 'Refrigerator or stove malfunctioning', costMin: 300, costMax: 800, weight: 8 },
      { name: 'HVAC servicing', desc: 'Heating/cooling system needs maintenance', costMin: 250, costMax: 700, weight: 5 },
      { name: 'Electrical fault', desc: 'Faulty outlet or wiring issue', costMin: 200, costMax: 600, weight: 4 },
      { name: 'Water heater failure', desc: 'Water heater needs full replacement', costMin: 1500, costMax: 3500, weight: 2 },
      { name: 'Mold remediation', desc: 'Mold discovered behind walls, professional removal needed', costMin: 2000, costMax: 5000, weight: 1 },
    ],
  },
  office: {
    interval: 12,
    variance: 4,
    issues: [
      // Heavy electronics use, HVAC runs constantly, carpets wear
      { name: 'Light ballast', desc: 'Fluorescent light ballast buzzing and flickering', costMin: 50, costMax: 150, weight: 25 },
      { name: 'Carpet cleaning', desc: 'Office carpets stained from daily use', costMin: 150, costMax: 400, weight: 20 },
      { name: 'Door hardware', desc: 'Office door handle or lock needs replacement', costMin: 75, costMax: 200, weight: 15 },
      { name: 'Network outage', desc: 'Network switch or router needs replacement', costMin: 400, costMax: 1200, weight: 15 },
      { name: 'HVAC servicing', desc: 'Climate control strained by electronics heat', costMin: 500, costMax: 1200, weight: 10 },
      { name: 'Electrical panel', desc: 'Circuit breaker tripping from power draw', costMin: 600, costMax: 1500, weight: 8 },
      { name: 'Server room cooling', desc: 'Server room AC unit failed, emergency replacement', costMin: 3000, costMax: 8000, weight: 4 },
      { name: 'Fire suppression', desc: 'Sprinkler system inspection and valve replacement', costMin: 2000, costMax: 5000, weight: 3 },
    ],
  },
  retail: {
    interval: 8,
    variance: 3,
    issues: [
      // Constant customer traffic, refrigeration runs 24/7, signage exposed to elements
      { name: 'Signage repair', desc: 'Store signage bulb or panel needs fixing', costMin: 50, costMax: 200, weight: 20 },
      { name: 'Shelf repair', desc: 'Broken shelving unit from customer wear', costMin: 75, costMax: 250, weight: 20 },
      { name: 'Door sensor', desc: 'Automatic door sensor worn out from constant use', costMin: 100, costMax: 300, weight: 15 },
      { name: 'Cooler malfunction', desc: 'Refrigeration unit needs compressor service', costMin: 500, costMax: 1500, weight: 15 },
      { name: 'Security system', desc: 'Security cameras or alarm panel need repair', costMin: 400, costMax: 1000, weight: 10 },
      { name: 'Plumbing issue', desc: 'Store plumbing backup needs clearing', costMin: 200, costMax: 600, weight: 10 },
      { name: 'Walk-in cooler failure', desc: 'Walk-in cooler compressor died, full replacement needed', costMin: 3000, costMax: 7000, weight: 5 },
      { name: 'Electrical rewiring', desc: 'Major electrical fault requires rewiring the unit', costMin: 2000, costMax: 5000, weight: 5 },
    ],
  },
  restaurant: {
    interval: 6,
    variance: 2,
    issues: [
      // Grease, heat, water, pests — kitchens are brutal on equipment
      { name: 'Grease trap cleaning', desc: 'Grease trap full from heavy cooking volume', costMin: 150, costMax: 400, weight: 25 },
      { name: 'Pest control', desc: 'Kitchen food waste attracts pests, treatment needed', costMin: 200, costMax: 500, weight: 20 },
      { name: 'Light fixture', desc: 'Dining area light fixture needs replacement', costMin: 50, costMax: 200, weight: 15 },
      { name: 'Kitchen equipment', desc: 'Burner or oven element worn from heavy use', costMin: 800, costMax: 2000, weight: 15 },
      { name: 'Ventilation repair', desc: 'Kitchen exhaust clogged with grease buildup', costMin: 600, costMax: 1500, weight: 10 },
      { name: 'Dishwasher repair', desc: 'Commercial dishwasher strained from constant cycling', costMin: 500, costMax: 1200, weight: 8 },
      { name: 'Health code violation', desc: 'Failed health inspection, major kitchen overhaul required', costMin: 5000, costMax: 12000, weight: 3 },
      { name: 'Walk-in freezer failure', desc: 'Walk-in freezer compressor died, emergency replacement', costMin: 4000, costMax: 10000, weight: 2 },
      { name: 'Hood fire suppression', desc: 'Fire suppression system discharged, full recharge and cleanup', costMin: 3000, costMax: 8000, weight: 2 },
    ],
  },
  elevator: {
    interval: 5,
    variance: 2,
    issues: [
      // Buttons and lights wear from use, doors are the most stressed mechanical part
      { name: 'Light bulb', desc: 'Cab interior light burned out', costMin: 25, costMax: 75, weight: 25 },
      { name: 'Button replacement', desc: 'Floor button worn out from passenger use', costMin: 50, costMax: 200, weight: 20 },
      { name: 'Door sensor', desc: 'Door sensor triggered too many times, needs recalibration', costMin: 100, costMax: 300, weight: 20 },
      { name: 'Door mechanism', desc: 'Doors misaligned from thousands of open/close cycles', costMin: 500, costMax: 1500, weight: 15 },
      { name: 'Cable lubrication', desc: 'Cables need inspection and lubrication', costMin: 800, costMax: 2000, weight: 8 },
      { name: 'Safety inspection', desc: 'Mandatory annual safety certification renewal', costMin: 1000, costMax: 2500, weight: 5 },
      { name: 'Motor overhaul', desc: 'Drive motor worn from heavy daily use', costMin: 5000, costMax: 12000, weight: 3 },
      { name: 'Control system', desc: 'Main control board failed, full replacement needed', costMin: 4000, costMax: 10000, weight: 2 },
      { name: 'Cable replacement', desc: 'Cables worn beyond safe limits from constant travel', costMin: 8000, costMax: 20000, weight: 2 },
    ],
  },
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
