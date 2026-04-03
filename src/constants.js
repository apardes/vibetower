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
