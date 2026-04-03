# SimTower Clone — Vibe Jam Hackathon

## What This Is

A SimTower-style browser game for a vibe-coded game hackathon. 2D cross-section tower builder: place rooms (apartments, offices, retail, restaurants, elevators), tenants move in, pay rent, grow toward a 5-star rating. Single-player only — multiplayer is not planned.

## Hackathon Rules

- 90%+ code must be AI-written
- Web-accessible, no login/signup, free-to-play
- NO loading screens or heavy downloads — must load instantly
- Preferably its own domain/subdomain
- One entry per person — focus on quality

## Tech Stack

- **Rendering**: ThreeJS with orthographic camera (2D look, 3D engine)
- **Build tooling**: None. Native ES modules + import map loading ThreeJS from `esm.sh`. No npm, no node_modules, no bundler.
- **Language**: Plain JavaScript (no TypeScript)
- **UI**: HTML/CSS overlays for toolbar, HUD, tooltips (not ThreeJS text)
- **Hosting**: VPS with nginx serving static files
- **Backend**: None. 100% client-side. No API.
- **Art**: Fully procedural. No sprites, no textures, no image files. Everything is ThreeJS `PlaneGeometry` + `MeshBasicMaterial` (flat colors).

## Local Development

```
python3 -m http.server 8080
# Open http://localhost:8080
```

No build step. No install step. Just serve the files.

## Project Structure

```
vibejam/
├── index.html              # Entry point, import map for ThreeJS
├── CLAUDE.md               # This file
├── src/
│   ├── main.js             # Wires everything together
│   ├── constants.js         # Grid sizes, room defs, costs, colors, schedules
│   ├── game/
│   │   ├── GameState.js     # Central state: money, time, tower, star rating
│   │   ├── Tower.js         # 2D grid, room placement/validation/removal
│   │   ├── Room.js          # Room data class (type, position, tenants, satisfaction)
│   │   ├── Elevator.js      # Elevator shaft + cab movement (scan algorithm)
│   │   ├── Person.js        # Tenant with individual schedule, state machine
│   │   ├── Economy.js       # Rent collection, income/expense calculation
│   │   ├── Simulation.js    # Tick-based game loop, people movement, elevator dispatch
│   │   └── StarRating.js    # Star progression thresholds
│   ├── render/
│   │   ├── Renderer.js      # ThreeJS setup, orthographic camera, render loop
│   │   ├── TowerRenderer.js # Draws rooms as colored rectangles with details
│   │   ├── ElevatorRenderer.js # Draws shafts and animated cabs
│   │   ├── PersonRenderer.js   # Draws tiny people moving around
│   │   ├── SkyRenderer.js      # Day/night gradient background
│   │   └── GridOverlay.js      # Build-mode grid lines + placement preview
│   ├── ui/
│   │   ├── UIManager.js     # Creates toolbar and HUD
│   │   ├── Toolbar.js       # Room type buttons at bottom
│   │   ├── HUD.js           # Money, population, stars, time controls at top
│   │   └── Tooltip.js       # Hover info on rooms
│   ├── input/
│   │   ├── InputManager.js  # Mouse/keyboard event routing + coord conversion
│   │   ├── CameraController.js # Pan (middle mouse/space+drag) + zoom (scroll)
│   │   └── BuildTool.js     # Placement preview, validation, click-to-place, bulldoze
│   └── utils/
│       ├── EventBus.js      # Simple pub/sub (global singleton)
│       └── helpers.js       # clamp, lerp, formatMoney, worldToGrid, generateId
```

## Architecture

### Separation of Concerns

- **Game logic** (`src/game/`) is fully separated from **rendering** (`src/render/`). The simulation ticks independently of the render loop.
- **UI** is HTML overlays, not ThreeJS objects. This avoids font loading and keeps things responsive.
- **Input** routes events through the EventBus. No direct coupling between input handlers and game objects.
- **main.js** is the only file that wires systems together.

### Game Loop

Two decoupled loops:
- **Render**: 60fps via `requestAnimationFrame` in `Renderer.js`
- **Simulation**: 20 ticks/sec via `setInterval` in `Simulation.js`. Speed multiplier (0x/1x/2x/3x) applied to tick advancement.

At 1x speed, 1 game-day ≈ 60 real seconds.

### Person State Machine

Every person has exactly one state at any time:

```
spawning → walking → waiting_elevator → in_elevator → walking → in_room
                                                                    ↓
                                                              (schedule triggers)
                                                                    ↓
                                                    walking → waiting_elevator → in_elevator → walking (off map or to room)
```

States:
- `spawning` — just created at ground floor edge, walking toward room or elevator
- `in_room` — idle in their assigned room
- `walking` — moving horizontally toward `targetX`
- `waiting_elevator` — at elevator shaft, waiting for cab
- `in_elevator` — riding cab (position follows cab)

### Elevator System

- `Elevator.js` is just a cab that moves between floors. It owns `passengers` (Set of person IDs) and `requestedFloors` (Set of floors to visit).
- `Simulation.js` manages loading/unloading: when cab stops at a floor, it unloads passengers whose `targetFloor` matches, then loads waiting people.
- People only request their **pickup floor** when arriving at the shaft. Their **destination floor** is requested when they board. This prevents the elevator from visiting and clearing a destination before the passenger gets on.
- A defensive retry runs every tick: if any person is in `waiting_elevator` state, their floor is re-requested if missing from the elevator's queue.
- Cab uses a scan algorithm (serve all requests in one direction, then reverse).

### Room Placement Rules

- **Lobby** can only be placed on floor 0
- **Every cell** of a room must have a room directly below it (no floating, no overhangs)
- Floor 0 is always valid (ground level)
- Rooms are **star-gated**: retail unlocks at 2 stars, restaurant at 3 stars
- Elevators are placed by click-drag (vertical) and need at least 2 floors
- Bulldoze works on both rooms and elevators (50% cost refund)

### Schedule System

Each room type has defined operating hours in `constants.js` (`ROOM_SCHEDULES`). Each person generates an individual schedule on creation using a bell-curve distribution around peak times:

- **Apartments**: Residents leave 6:30-9:30am (peak 8am), return 4:30-8pm (peak 6pm). 15% stay home all day.
- **Offices**: Workers arrive 6:30-10am, depart 4-9pm. 10% stay very late.
- **Retail**: Staff present 9am-9pm.
- **Restaurants**: Staff present 10am-11pm.

New tenants trickle in throughout the day (small chance per tick per empty slot, 6am-10pm) rather than all spawning at once.

### People Movement Rules

- People MUST enter and exit the building through the ground floor
- Upper floor access REQUIRES an elevator — no teleporting
- If no elevator is available, people wait at ground floor
- People walk in from the map edges and walk out the same way

## Design Decisions

- **No eviction system** — tenants do not leave due to low satisfaction. This was explicitly removed.
- **No multiplayer** — single-player only, multiplayer is not a priority.
- **HTML UI over ThreeJS text** — faster to build, no font loading, accessible, responsive.
- **2D array grid** over spatial hash or ECS — the tower is inherently grid-based with known fixed size. O(1) lookup for "what room is at this cell?"
- **setInterval for simulation** over requestAnimationFrame — decouples sim rate from frame rate, makes time control trivial.
- **No build tooling** — import maps + CDN is simpler, matches VPS deployment, no npm needed.

## Room Types

| Type | Size | Cost | Income/Day | Capacity | Unlock | Color |
|------|------|------|------------|----------|--------|-------|
| Lobby | 4x1 | $5K | $0 | - | Star 1 | #d4c5a9 (beige) |
| Apartment | 2x1 | $20K | $500 | 2 | Star 1 | #7eb5e0 (light blue) |
| Office | 3x1 | $40K | $1K | 6 | Star 1 | #b8d4a3 (light green) |
| Retail | 2x1 | $30K | $800 | - | Star 2 | #f0c674 (gold) |
| Restaurant | 4x1 | $80K | $2K | - | Star 3 | #e88a6a (salmon) |
| Elevator | 1xVar | $50K | -$200/day | 8/cab | Star 1 | #888888 (gray) |

## Star Rating Thresholds

| Stars | Population | Avg Satisfaction |
|-------|-----------|-----------------|
| 1 | 0 | 0% |
| 2 | 100 | 50% |
| 3 | 300 | 60% |
| 4 | 500 | 70% |
| 5 | 1000 | 80% |

## Known Issues / TODO

- Aesthetics need work — rooms are plain colored rectangles, no interior detail polish yet
- Save/load via localStorage not implemented
- No sound effects
- No title screen
- No notification system (e.g. "New tenants moved in!")
- No floating money text on income/expense

## Working With This Codebase

- **Do not add build tooling** (no npm, no Vite, no webpack). The zero-build approach is intentional.
- **Do not add image assets**. All visuals must be procedural geometry.
- **Do not teleport people**. Everyone must physically walk and use elevators. No setting position to a room on a different floor.
- **Do not add features without approval**. Ask before implementing anything not explicitly requested.
- **Person owns their state**. The person object tracks where they are and what they're doing. The elevator is just transport.
- **EventBus for decoupling**. Systems communicate via events, not direct references (except where main.js wires things together).
