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
- **Art**: Fully procedural. No sprites, no textures, no image files. All geometry built from ThreeJS primitives (PlaneGeometry, CircleGeometry, etc.). Materials are `MeshStandardMaterial` with lighting and emissive properties. Post-processing via `EffectComposer` + `UnrealBloomPass`.

## Local Development

```
python3 -m http.server 8080
# Open http://localhost:8080
```

No build step. No install step. Just serve the files.

## Project Structure

```
vibejam/
├── index.html              # Entry point, import map for ThreeJS + addons
├── CLAUDE.md               # This file
├── examples/simtower/       # Reference screenshots from original SimTower
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
│   │   ├── Renderer.js      # ThreeJS setup, ortho camera, EffectComposer, render loop
│   │   ├── LightingSystem.js # Scene lights (ambient, hemisphere, directional sun)
│   │   ├── TowerRenderer.js # Rooms, building exterior, ground
│   │   ├── RoomInteriors.js  # Factory for per-room-type interior detail geometry
│   │   ├── ElevatorRenderer.js # Shafts, cabs with interior detail
│   │   ├── PersonRenderer.js   # Articulated people with walking animation
│   │   ├── SkyRenderer.js      # Day/night gradient, stars, sun/moon, clouds
│   │   ├── WeatherSystem.js    # Rain particles
│   │   ├── ParticleEffects.js  # Construction sparkle, restaurant steam
│   │   ├── FloatingText.js     # Floating income text via CanvasTexture
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

## Visual Design Standards

This game is a **modern recreation of the original SimTower**. Reference screenshots are in `examples/simtower/`. Study them before making any visual changes.

### Core Visual Identity

The game is a **2D cross-section** of a building. The player is looking at the building as if it has been sliced open, revealing every room's interior. This is the defining visual metaphor — everything must reinforce it.

**What makes the original SimTower look good:**
1. **Strong structural grid** — dark steel/concrete beams form a visible frame around every floor and the building edges. This is THE signature visual element.
2. **Clear floor separation** — each floor has distinct ceiling/floor dividers. You can always tell where one floor ends and another begins.
3. **Readable room interiors** — each room type is instantly identifiable by layout and color palette at a glance.
4. **Building dominates the scene** — sky and ground are secondary backdrops. The building cross-section is the star.
5. **Muted, natural colors** — nothing is oversaturated or neon (except actual neon signs). Colors feel like real materials.
6. **Consistent detail level** — all elements share the same fidelity. No part looks more polished or more rough than another.
7. **Clean and uncluttered** — no gratuitous effects. Every visual element serves readability or atmosphere.

### Visual Hierarchy (most prominent → least)

1. Building structural frame (floor/ceiling lines, wall edges, roof)
2. Room interiors (furniture, fixtures, color-coded by type)
3. Elevator shafts (dark vertical corridors)
4. People (small but recognizable figures with activity)
5. Ground level (lobby entrance, sidewalk, street)
6. Sky/atmosphere (simple, non-distracting backdrop)

### Anti-Patterns — DO NOT DO THESE

- **Blinding bloom** — emissive values above 1.5 for anything except neon signs. Bloom should be subtle atmosphere, not a flashlight in your face.
- **Tacky decorative elements** — random grass tufts, scattered particles for no reason, visual noise that doesn't serve gameplay.
- **Visual effects as a substitute for good design** — if a room doesn't look good without bloom/particles/weather, fix the room first.
- **Inconsistent fidelity** — one room with 20 detail objects next to another with 3. Everything at the same level.
- **Oversized or undersized elements** — people, furniture, and fixtures must be proportional to the 1-unit grid cells.

### Color Palette Philosophy

- Room base colors should be **muted and warm** — think painted drywall, not candy.
- Structural elements (beams, walls, floor lines) should be **dark neutral grays** — `#3a3a3a` to `#5a5a5a`.
- Window glow at night should be **warm amber/yellow** — `#ffdd66` to `#ffaa44`, NOT pure white.
- Sky should be **clean gradients** — no busy cloud formations competing with the building.

### ThreeJS Lighting Rules

These values have been tuned. Do not change without testing and comparing to the SimTower reference screenshots.

- **Ambient light**: 0.15–0.20 intensity. Never above 0.25.
- **Hemisphere light**: 0.15–0.50 intensity depending on time of day.
- **Directional sun**: 0.08 at night (moonlight fill), 0.70 at noon.
- **Emissive intensity ranges**: Windows 0.8–1.0, screens 0.5–1.0, ceiling lights 0.5–0.9, neon signs 1.5–2.5.
- **Bloom**: threshold 0.5, radius 0.35, strength 0.4–0.8. Bloom should be a subtle halo, not a nuclear glow.
- **Tone mapping**: ACES Filmic at exposure 1.0. Do not raise exposure above 1.1.

### Workflow Rule: One Thing at a Time

Do NOT make sweeping changes across multiple visual systems simultaneously. Work on one element (e.g., "apartment interiors" or "elevator shaft visuals"), get it right, verify it looks good, then move to the next. This prevents cascading quality issues.

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

- Visual polish needed — room interiors, building structure, and people all need to match the quality level of the original SimTower reference screenshots
- Building lacks the strong structural frame (dark steel beams) that defines the SimTower look
- Save/load via localStorage not implemented
- No sound effects
- No title screen
- No notification system (e.g. "New tenants moved in!")

## Working With This Codebase

- **Do not add build tooling** (no npm, no Vite, no webpack). The zero-build approach is intentional.
- **Do not add image assets**. All visuals must be procedural geometry.
- **Do not teleport people**. Everyone must physically walk and use elevators. No setting position to a room on a different floor.
- **Do not add features without approval**. Ask before implementing anything not explicitly requested.
- **Person owns their state**. The person object tracks where they are and what they're doing. The elevator is just transport.
- **EventBus for decoupling**. Systems communicate via events, not direct references (except where main.js wires things together).
- **One visual change at a time**. Never make sweeping changes across multiple renderers simultaneously. Fix one thing, verify, move on.
- **Reference the original**. Before changing any visual, look at `examples/simtower/` screenshots. The goal is a modern recreation of that style.
- **Test lighting changes at both day AND night**. Lighting that looks good at noon can be invisible at midnight and vice versa.
- **ThreeJS addons** are available via `import ... from 'three/addons/...'` (mapped in index.html import map to esm.sh).
