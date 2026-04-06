import * as THREE from 'three';

// Room interiors use MeshBasicMaterial — they're self-lit (cross-section view).
// Scene lighting only affects exterior/ground, not room contents.
// Material pool: share materials by color to reduce memory and draw calls.
const materialPool = new Map();
const mat = (color, opts = {}) => {
  // Materials with extra opts (transparent, etc.) can't be pooled
  const hasOpts = Object.keys(opts).length > 0;
  if (hasOpts) return new THREE.MeshBasicMaterial({ color, ...opts });
  const key = typeof color === 'string' ? color : String(color);
  if (!materialPool.has(key)) {
    materialPool.set(key, new THREE.MeshBasicMaterial({ color }));
  }
  return materialPool.get(key);
};

function plane(w, h, color, opts) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(color, opts));
}

function createLobby(room) {
  const g = new THREE.Group();
  const hw = room.width / 2;
  const floorY = -0.47;

  // --- Floor — full width for seamless chaining ---
  const floor = plane(room.width, 0.96, '#b5a890');
  floor.position.set(0, 0, 0.002);
  g.add(floor);

  // --- Back wall ---
  const wall = plane(room.width, 0.96, '#a89880');
  wall.position.set(0, 0, 0.001);
  g.add(wall);

  // --- Ceiling ---
  const ceiling = plane(room.width, 0.025, '#9a8a72');
  ceiling.position.set(0, 0.46, 0.004);
  g.add(ceiling);

  // --- Baseboard ---
  const baseboard = plane(room.width, 0.015, '#7a6a52');
  baseboard.position.set(0, floorY + 0.008, 0.004);
  g.add(baseboard);

  // Helper: sofa — two overlapping solid blocks forming one L-shape
  function addSofa(cx, facing) {
    // Seat block — full width, solid mass
    const seat = plane(0.45, 0.15, '#524a42');
    seat.position.set(cx, floorY + 0.075, 0.005);
    g.add(seat);
    // Back block — overlaps seat on one end, extends up
    const back = plane(0.15, 0.35, '#524a42');
    back.position.set(cx + facing * -0.15, floorY + 0.175, 0.005);
    g.add(back);
    // Cushion — lighter tone on the seat area
    const cushion = plane(0.28, 0.08, '#665c52');
    cushion.position.set(cx + facing * 0.06, floorY + 0.11, 0.006);
    g.add(cushion);
  }

  // Helper: coffee table — solid piece, not sticks
  function addTable(cx) {
    // Solid body
    const body = plane(0.22, 0.1, '#4a4238');
    body.position.set(cx, floorY + 0.05, 0.005);
    g.add(body);
    // Lighter top surface
    const top = plane(0.24, 0.02, '#5a5248');
    top.position.set(cx, floorY + 0.11, 0.006);
    g.add(top);
  }

  // --- Left seating group ---
  addSofa(-1.2, 1);
  addTable(-0.7);

  // --- Center planter ---
  // Pot — solid with slight taper (wider rim than base)
  const pot = plane(0.14, 0.2, '#5a5450');
  pot.position.set(0, floorY + 0.1, 0.005);
  g.add(pot);
  const potRim = plane(0.18, 0.03, '#6a6460');
  potRim.position.set(0, floorY + 0.21, 0.006);
  g.add(potRim);
  // Soil visible at top of pot
  const soil = plane(0.13, 0.02, '#4a3a28');
  soil.position.set(0, floorY + 0.2, 0.007);
  g.add(soil);

  // Trunk — thicker, with a slight fork
  const mainTrunk = plane(0.035, 0.18, '#5a4a30');
  mainTrunk.position.set(0, floorY + 0.32, 0.007);
  g.add(mainTrunk);
  // Left branch
  const branchL = plane(0.025, 0.1, '#5a4a30');
  branchL.position.set(-0.04, floorY + 0.4, 0.007);
  branchL.rotation.z = 0.4;
  g.add(branchL);
  // Right branch
  const branchR = plane(0.025, 0.1, '#5a4a30');
  branchR.position.set(0.04, floorY + 0.4, 0.007);
  branchR.rotation.z = -0.35;
  g.add(branchR);

  // Foliage — layered, multiple greens, varied sizes for natural look
  // Dark underlayer (shadow/depth)
  for (const [dx, dy, r] of [
    [0, 0.46, 0.1], [-0.08, 0.42, 0.08], [0.08, 0.42, 0.08],
    [0, 0.54, 0.07], [-0.06, 0.52, 0.06], [0.06, 0.52, 0.06],
  ]) {
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(r, 12), mat('#2a5a22'));
    leaf.position.set(dx, floorY + dy, 0.008);
    g.add(leaf);
  }
  // Mid layer (main green)
  for (const [dx, dy, r] of [
    [0, 0.47, 0.09], [-0.06, 0.44, 0.07], [0.07, 0.44, 0.06],
    [-0.03, 0.53, 0.06], [0.04, 0.52, 0.055],
    [0, 0.56, 0.05],
  ]) {
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(r, 12), mat('#3a7a32'));
    leaf.position.set(dx, floorY + dy, 0.009);
    g.add(leaf);
  }
  // Highlight layer (lighter tips)
  for (const [dx, dy, r] of [
    [-0.04, 0.49, 0.04], [0.05, 0.47, 0.035],
    [0, 0.55, 0.03], [-0.06, 0.53, 0.03], [0.04, 0.54, 0.025],
  ]) {
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(r, 10), mat('#4a9a42'));
    leaf.position.set(dx, floorY + dy, 0.010);
    g.add(leaf);
  }

  // --- Right seating group ---
  addSofa(1.2, -1);
  addTable(0.7);

  // --- Windows — 2, one per seating group, behind furniture on wall ---
  for (const wx of [-1.2, 1.2]) {
    const frame = plane(0.32, 0.36, '#5a5248');
    frame.position.set(wx, floorY + 0.6, 0.003);
    g.add(frame);
    const glass = plane(0.26, 0.3, '#8ab4c8');
    glass.position.set(wx, floorY + 0.6, 0.004);
    g.add(glass);
    const mH = plane(0.26, 0.025, '#5a5248');
    mH.position.set(wx, floorY + 0.6, 0.0045);
    g.add(mH);
    const mV = plane(0.025, 0.3, '#5a5248');
    mV.position.set(wx, floorY + 0.6, 0.0045);
    g.add(mV);
  }

  return g;
}

function createApartment(room) {
  const g = new THREE.Group();
  const hw = room.width / 2;
  // Room is 2 wide, 1 tall. Center (0,0). Floor at -0.47, ceiling at +0.47.
  // Left wall at -0.97, right wall at +0.97.
  const floorY = -0.47;
  const ceilY = 0.47;
  const leftW = -hw + 0.03;
  const rightW = hw - 0.03;

  // --- Floor ---
  const floor = plane(room.width - 0.06, 0.96, '#b09068');
  floor.position.set(0, 0, 0.002);
  g.add(floor);

  // --- Back wall ---
  const wall = plane(room.width - 0.06, 0.96, '#a89078');
  wall.position.set(0, 0, 0.001);
  g.add(wall);

  // --- Ceiling ---
  const ceiling = plane(room.width - 0.06, 0.02, '#98886e');
  ceiling.position.set(0, ceilY - 0.01, 0.004);
  g.add(ceiling);

  // --- Baseboard — runs along floor ---
  const baseboard = plane(room.width - 0.06, 0.015, '#7a6a50');
  baseboard.position.set(0, floorY + 0.008, 0.004);
  g.add(baseboard);

  // --- Partition wall — floor to ceiling ---
  const partition = plane(0.035, 0.96, '#8a7a62');
  partition.position.set(0.05, 0, 0.005);
  g.add(partition);

  // === RIGHT SIDE — Bedroom ===

  // Bed — 3-layer shading like the plant
  // Shadow layer (dark, slightly larger)
  const bedShadow = plane(0.68, 0.14, '#3a3028');
  bedShadow.position.set(rightW - 0.33, floorY + 0.07, 0.004);
  g.add(bedShadow);
  const headShadow = plane(0.07, 0.38, '#3a3028');
  headShadow.position.set(rightW - 0.02, floorY + 0.19, 0.004);
  g.add(headShadow);
  // Main layer — frame + headboard
  const bedFrame = plane(0.65, 0.1, '#5a4a38');
  bedFrame.position.set(rightW - 0.33, floorY + 0.05, 0.005);
  g.add(bedFrame);
  const headboard = plane(0.05, 0.35, '#5a4a38');
  headboard.position.set(rightW - 0.025, floorY + 0.175, 0.005);
  g.add(headboard);
  const footboard = plane(0.04, 0.14, '#5a4a38');
  footboard.position.set(rightW - 0.65, floorY + 0.07, 0.005);
  g.add(footboard);
  // Mattress — mid tone, thick
  const mattress = plane(0.56, 0.08, '#c0b098');
  mattress.position.set(rightW - 0.32, floorY + 0.1, 0.006);
  g.add(mattress);
  // Mattress highlight
  const mattHi = plane(0.5, 0.04, '#ccc0a8');
  mattHi.position.set(rightW - 0.32, floorY + 0.12, 0.007);
  g.add(mattHi);
  // Pillow — layered: shadow, body, highlight
  const pillowShadow = plane(0.12, 0.07, '#a8a090');
  pillowShadow.position.set(rightW - 0.08, floorY + 0.15, 0.007);
  g.add(pillowShadow);
  const pillow = plane(0.1, 0.06, '#d0c8b8');
  pillow.position.set(rightW - 0.08, floorY + 0.155, 0.008);
  g.add(pillow);
  // Duvet — layered
  const duvetShadow = plane(0.44, 0.06, '#5a3830');
  duvetShadow.position.set(rightW - 0.38, floorY + 0.13, 0.007);
  g.add(duvetShadow);
  const duvet = plane(0.4, 0.05, '#7a5048');
  duvet.position.set(rightW - 0.38, floorY + 0.14, 0.008);
  g.add(duvet);
  const duvetHi = plane(0.3, 0.02, '#8a6058');
  duvetHi.position.set(rightW - 0.38, floorY + 0.155, 0.009);
  g.add(duvetHi);

  // Nightstand — layered shading
  const nsShadow = plane(0.12, 0.18, '#3a3228');
  nsShadow.position.set(0.12, floorY + 0.09, 0.005);
  g.add(nsShadow);
  const nsBody = plane(0.1, 0.16, '#5a4a38');
  nsBody.position.set(0.12, floorY + 0.08, 0.006);
  g.add(nsBody);
  const nsTop = plane(0.12, 0.02, '#6a5a42');
  nsTop.position.set(0.12, floorY + 0.17, 0.007);
  g.add(nsTop);
  const nsFront = plane(0.08, 0.06, '#4a3a28');
  nsFront.position.set(0.12, floorY + 0.08, 0.007);
  g.add(nsFront);
  const nsKnob = plane(0.015, 0.01, '#8a7a60');
  nsKnob.position.set(0.12, floorY + 0.08, 0.008);
  g.add(nsKnob);

  // Lamp — layered
  const lampBase = plane(0.03, 0.02, '#5a5048');
  lampBase.position.set(0.12, floorY + 0.19, 0.008);
  g.add(lampBase);
  const lampStem = plane(0.008, 0.04, '#6a6058');
  lampStem.position.set(0.12, floorY + 0.22, 0.008);
  g.add(lampStem);
  // Shade — 3 layers for warm glow look
  const shadeShadow = plane(0.06, 0.04, '#a08040');
  shadeShadow.position.set(0.12, floorY + 0.255, 0.008);
  g.add(shadeShadow);
  const shade = plane(0.055, 0.035, '#c8a858');
  shade.position.set(0.12, floorY + 0.257, 0.009);
  g.add(shade);
  const shadeHi = plane(0.03, 0.02, '#d8c078');
  shadeHi.position.set(0.12, floorY + 0.262, 0.010);
  g.add(shadeHi);

  // === LEFT SIDE — Kitchenette ===

  // Counter — layered shading
  const counterShadow = plane(0.67, 0.32, '#3a3028');
  counterShadow.position.set(leftW + 0.325, floorY + 0.16, 0.004);
  g.add(counterShadow);
  const counterBase = plane(0.65, 0.3, '#605848');
  counterBase.position.set(leftW + 0.325, floorY + 0.15, 0.005);
  g.add(counterBase);
  // Cabinet door detail
  const cabDoor1 = plane(0.28, 0.2, '#564838');
  cabDoor1.position.set(leftW + 0.2, floorY + 0.12, 0.006);
  g.add(cabDoor1);
  const cabDoor2 = plane(0.28, 0.2, '#564838');
  cabDoor2.position.set(leftW + 0.5, floorY + 0.12, 0.006);
  g.add(cabDoor2);
  // Countertop — highlight
  const countertop = plane(0.67, 0.025, '#8a7e68');
  countertop.position.set(leftW + 0.325, floorY + 0.31, 0.006);
  g.add(countertop);
  const countertopHi = plane(0.63, 0.01, '#9a8e78');
  countertopHi.position.set(leftW + 0.325, floorY + 0.32, 0.007);
  g.add(countertopHi);

  // Sink faucet
  const faucetPost = plane(0.01, 0.04, '#888888');
  faucetPost.position.set(leftW + 0.45, floorY + 0.345, 0.007);
  g.add(faucetPost);
  const faucetSpout = plane(0.025, 0.008, '#888888');
  faucetSpout.position.set(leftW + 0.44, floorY + 0.365, 0.007);
  g.add(faucetSpout);

  // Fridge — layered shading
  const fridgeShadow = plane(0.18, 0.57, '#7a7a7a');
  fridgeShadow.position.set(0.0 - 0.1, floorY + 0.285, 0.004);
  g.add(fridgeShadow);
  const fridgeBody = plane(0.16, 0.55, '#b0b0b0');
  fridgeBody.position.set(0.0 - 0.1, floorY + 0.275, 0.005);
  g.add(fridgeBody);
  // Fridge highlight panel
  const fridgeHi = plane(0.12, 0.2, '#bababc');
  fridgeHi.position.set(0.0 - 0.1, floorY + 0.4, 0.006);
  g.add(fridgeHi);
  const fridgeLine = plane(0.14, 0.008, '#909090');
  fridgeLine.position.set(0.0 - 0.1, floorY + 0.35, 0.006);
  g.add(fridgeLine);
  const fridgeHandle = plane(0.008, 0.07, '#808080');
  fridgeHandle.position.set(0.0 - 0.04, floorY + 0.43, 0.007);
  g.add(fridgeHandle);
  const fridgeHandleLo = plane(0.008, 0.05, '#808080');
  fridgeHandleLo.position.set(0.0 - 0.04, floorY + 0.2, 0.007);
  g.add(fridgeHandleLo);

  // === WINDOWS — one per side, on back wall above furniture ===
  function addWindow(x) {
    const frame = plane(0.3, 0.35, '#5a5248');
    frame.position.set(x, floorY + 0.6, 0.004);
    g.add(frame);
    const glass = plane(0.26, 0.3, '#8ab4c8');
    glass.position.set(x, floorY + 0.6, 0.005);
    g.add(glass);
    const mH = plane(0.26, 0.012, '#5a5248');
    mH.position.set(x, floorY + 0.6, 0.006);
    g.add(mH);
    const mV = plane(0.012, 0.3, '#5a5248');
    mV.position.set(x, floorY + 0.6, 0.006);
    g.add(mV);
  }
  addWindow(-0.5);
  addWindow(0.5);

  return g;
}

function createOffice(room) {
  const g = new THREE.Group();
  const hw = room.width / 2;
  const floorY = -0.47;
  const leftW = -hw + 0.03;
  const rightW = hw - 0.03;

  // --- Floor — office carpet ---
  const floor = plane(room.width - 0.06, 0.96, '#8a8880');
  floor.position.set(0, 0, 0.002);
  g.add(floor);

  // --- Back wall ---
  const wall = plane(room.width - 0.06, 0.96, '#9a9488');
  wall.position.set(0, 0, 0.001);
  g.add(wall);

  // --- Ceiling ---
  const ceiling = plane(room.width - 0.06, 0.02, '#8a8478');
  ceiling.position.set(0, 0.46, 0.004);
  g.add(ceiling);

  // --- Baseboard ---
  const baseboard = plane(room.width - 0.06, 0.015, '#6a6458');
  baseboard.position.set(0, floorY + 0.008, 0.004);
  g.add(baseboard);

  // --- Workstation helper — layered desk with monitor ---
  function addDesk(cx) {
    // Shadow layer
    const deskShadow = plane(0.44, 0.3, '#2e2820');
    deskShadow.position.set(cx, floorY + 0.15, 0.004);
    g.add(deskShadow);

    // Main body
    const deskBody = plane(0.42, 0.28, '#5e4e38');
    deskBody.position.set(cx, floorY + 0.14, 0.005);
    g.add(deskBody);

    // Front panel — darker inset
    const frontPanel = plane(0.38, 0.18, '#4e3e28');
    frontPanel.position.set(cx, floorY + 0.1, 0.006);
    g.add(frontPanel);

    // Front panel highlight
    const frontPanelHi = plane(0.34, 0.14, '#584830');
    frontPanelHi.position.set(cx, floorY + 0.1, 0.007);
    g.add(frontPanelHi);

    // Drawer divider line
    const drawerLine = plane(0.34, 0.006, '#3e3020');
    drawerLine.position.set(cx, floorY + 0.1, 0.008);
    g.add(drawerLine);

    // Drawer handles
    for (const dy of [-0.04, 0.04]) {
      const handle = plane(0.04, 0.008, '#8a7a5a');
      handle.position.set(cx, floorY + 0.1 + dy, 0.008);
      g.add(handle);
    }

    // Desktop surface
    const deskTop = plane(0.44, 0.025, '#7a6a50');
    deskTop.position.set(cx, floorY + 0.29, 0.006);
    g.add(deskTop);
    const deskTopHi = plane(0.4, 0.012, '#8a7a60');
    deskTopHi.position.set(cx, floorY + 0.3, 0.007);
    g.add(deskTopHi);

    // Desk edge lip
    const deskLip = plane(0.44, 0.006, '#4e4030');
    deskLip.position.set(cx, floorY + 0.278, 0.007);
    g.add(deskLip);

    // Monitor shadow
    const monShadow = plane(0.2, 0.15, '#151515');
    monShadow.position.set(cx, floorY + 0.385, 0.008);
    g.add(monShadow);
    // Monitor bezel
    const monBezel = plane(0.18, 0.13, '#2a2a2a');
    monBezel.position.set(cx, floorY + 0.39, 0.009);
    g.add(monBezel);
    // Screen — two tones
    const monScreen = plane(0.15, 0.1, '#2e3e50');
    monScreen.position.set(cx, floorY + 0.395, 0.010);
    g.add(monScreen);
    const monScreenHi = plane(0.12, 0.05, '#384858');
    monScreenHi.position.set(cx, floorY + 0.405, 0.011);
    g.add(monScreenHi);
    // Stand
    const monStand = plane(0.025, 0.04, '#222222');
    monStand.position.set(cx, floorY + 0.32, 0.008);
    g.add(monStand);
    const monBase = plane(0.06, 0.01, '#222222');
    monBase.position.set(cx, floorY + 0.305, 0.008);
    g.add(monBase);

    // Keyboard — small profile on desk surface
    const kbBody = plane(0.1, 0.015, '#3a3a3a');
    kbBody.position.set(cx, floorY + 0.295, 0.009);
    g.add(kbBody);
    const kbKeys = plane(0.08, 0.008, '#4a4a4a');
    kbKeys.position.set(cx, floorY + 0.298, 0.010);
    g.add(kbKeys);
  }

  // Four workstations
  addDesk(-1.05);
  addDesk(-0.35);
  addDesk(0.35);
  addDesk(1.05);

  // --- Windows — 3, evenly spaced ---
  for (const wx of [-1.05, 0, 1.05]) {
    const frame = plane(0.3, 0.35, '#5a5248');
    frame.position.set(wx, floorY + 0.6, 0.003);
    g.add(frame);
    const glass = plane(0.25, 0.3, '#8ab4c8');
    glass.position.set(wx, floorY + 0.6, 0.004);
    g.add(glass);
    const mH = plane(0.25, 0.02, '#5a5248');
    mH.position.set(wx, floorY + 0.6, 0.0045);
    g.add(mH);
    const mV = plane(0.02, 0.3, '#5a5248');
    mV.position.set(wx, floorY + 0.6, 0.0045);
    g.add(mV);
  }

  return g;
}

function createRetail(room) {
  const g = new THREE.Group();
  const hw = room.width / 2;
  const floorY = -0.47;
  const leftW = -hw + 0.03;
  const rightW = hw - 0.03;

  // --- Floor ---
  const floor = plane(room.width - 0.06, 0.96, '#b8b0a0');
  floor.position.set(0, 0, 0.002);
  g.add(floor);

  // --- Back wall ---
  const wall = plane(room.width - 0.06, 0.96, '#a8a090');
  wall.position.set(0, 0, 0.001);
  g.add(wall);

  // --- Ceiling ---
  const ceiling = plane(room.width - 0.06, 0.02, '#989080');
  ceiling.position.set(0, 0.46, 0.004);
  g.add(ceiling);

  // --- Baseboard ---
  const baseboard = plane(room.width - 0.06, 0.015, '#7a7268');
  baseboard.position.set(0, floorY + 0.008, 0.004);
  g.add(baseboard);

  // === Drink cooler — against left wall, tall ===
  const cX = leftW + 0.22;
  // Shadow
  const coolerShadow = plane(0.44, 0.62, '#0a1a2a');
  coolerShadow.position.set(cX, floorY + 0.31, 0.004);
  g.add(coolerShadow);
  // Body
  const coolerBody = plane(0.42, 0.6, '#1e2e3e');
  coolerBody.position.set(cX, floorY + 0.3, 0.005);
  g.add(coolerBody);
  // Inner panel
  const coolerInner = plane(0.38, 0.54, '#253545');
  coolerInner.position.set(cX, floorY + 0.31, 0.006);
  g.add(coolerInner);
  // Glass door — 3 layers
  const coolerGlass = plane(0.35, 0.5, '#4a6a7a');
  coolerGlass.position.set(cX, floorY + 0.32, 0.007);
  g.add(coolerGlass);
  const coolerGlassHi = plane(0.28, 0.42, '#5a7a8a');
  coolerGlassHi.position.set(cX, floorY + 0.34, 0.008);
  g.add(coolerGlassHi);
  const coolerGlassShine = plane(0.07, 0.38, '#6a8a9a');
  coolerGlassShine.position.set(cX - 0.08, floorY + 0.35, 0.009);
  g.add(coolerGlassShine);
  // Shelves inside cooler
  for (const sy of [0.14, 0.32, 0.5]) {
    const shelfShadow = plane(0.32, 0.012, '#2a4a5a');
    shelfShadow.position.set(cX, floorY + sy - 0.002, 0.009);
    g.add(shelfShadow);
    const shelf = plane(0.3, 0.008, '#4a6a7a');
    shelf.position.set(cX, floorY + sy, 0.010);
    g.add(shelf);
  }
  // Drinks — 5 per shelf, more room
  const drinkColors = [
    ['#8a1818', '#cc2222', '#dd4444'],
    ['#184488', '#2255aa', '#3366cc'],
    ['#186a28', '#22aa33', '#33cc55'],
    ['#886618', '#cc8822', '#ddaa44'],
  ];
  for (let s = 0; s < 3; s++) {
    const shelfY = floorY + 0.16 + s * 0.18;
    for (let d = 0; d < 5; d++) {
      const dc = drinkColors[(s + d) % drinkColors.length];
      const dx = cX - 0.12 + d * 0.06;
      const dShadow = plane(0.035, 0.1, dc[0]);
      dShadow.position.set(dx, shelfY, 0.010);
      g.add(dShadow);
      const dBody = plane(0.03, 0.09, dc[1]);
      dBody.position.set(dx, shelfY + 0.003, 0.011);
      g.add(dBody);
      const dLabel = plane(0.025, 0.035, dc[2]);
      dLabel.position.set(dx, shelfY + 0.01, 0.012);
      g.add(dLabel);
    }
  }
  // Handle
  const handleShadow = plane(0.012, 0.16, '#6a6a6a');
  handleShadow.position.set(cX + 0.18, floorY + 0.38, 0.009);
  g.add(handleShadow);
  const handle = plane(0.008, 0.14, '#9a9a9a');
  handle.position.set(cX + 0.18, floorY + 0.385, 0.010);
  g.add(handle);
  // Top/bottom caps
  const coolerCap = plane(0.42, 0.025, '#1a2a38');
  coolerCap.position.set(cX, floorY + 0.61, 0.006);
  g.add(coolerCap);
  const coolerBase = plane(0.42, 0.02, '#1a2a38');
  coolerBase.position.set(cX, floorY + 0.01, 0.006);
  g.add(coolerBase);

  // === Snack rack — center, bigger ===
  const rX = 0.1;
  // Shadow
  const rackShadow = plane(0.38, 0.52, '#1a1810');
  rackShadow.position.set(rX, floorY + 0.26, 0.004);
  g.add(rackShadow);
  // Body
  const rackBody = plane(0.36, 0.5, '#4a4238');
  rackBody.position.set(rX, floorY + 0.25, 0.005);
  g.add(rackBody);
  // Inner back panel
  const rackInner = plane(0.32, 0.44, '#3a3228');
  rackInner.position.set(rX, floorY + 0.26, 0.006);
  g.add(rackInner);
  // Shelves
  for (const sy of [0.08, 0.2, 0.32, 0.44]) {
    const shelfShadow = plane(0.34, 0.012, '#2a2218');
    shelfShadow.position.set(rX, floorY + sy - 0.002, 0.006);
    g.add(shelfShadow);
    const shelf = plane(0.32, 0.01, '#5a5240');
    shelf.position.set(rX, floorY + sy, 0.007);
    g.add(shelf);
  }
  // Snack packages — 4 per shelf now
  const snackSets = [
    ['#8a4420', '#cc6633', '#dd8855'],
    ['#8a7a18', '#ccaa22', '#ddcc44'],
    ['#6a2222', '#aa3333', '#cc5555'],
    ['#2a6a2a', '#44aa44', '#66cc66'],
    ['#6a2a6a', '#aa44aa', '#cc66cc'],
  ];
  for (let s = 0; s < 4; s++) {
    const shelfY = floorY + 0.1 + s * 0.12;
    for (let p = 0; p < 4; p++) {
      const sc = snackSets[(s * 4 + p) % snackSets.length];
      const px = rX - 0.1 + p * 0.07;
      const sh = 0.065 + (s % 2) * 0.015;
      const sShadow = plane(0.045, sh + 0.01, sc[0]);
      sShadow.position.set(px, shelfY + sh / 2 - 0.005, 0.007);
      g.add(sShadow);
      const sBody = plane(0.04, sh, sc[1]);
      sBody.position.set(px, shelfY + sh / 2, 0.008);
      g.add(sBody);
      const sHi = plane(0.03, sh * 0.4, sc[2]);
      sHi.position.set(px, shelfY + sh * 0.6, 0.009);
      g.add(sHi);
    }
  }
  // Rack top cap
  const rackCap = plane(0.36, 0.02, '#3a3228');
  rackCap.position.set(rX, floorY + 0.51, 0.006);
  g.add(rackCap);

  // === Checkout counter — right side ===
  const coX = rightW - 0.14;
  // Shadow
  const counterShadow = plane(0.3, 0.34, '#1a1810');
  counterShadow.position.set(coX, floorY + 0.17, 0.004);
  g.add(counterShadow);
  // Body
  const counterBody = plane(0.28, 0.32, '#5e4e3a');
  counterBody.position.set(coX, floorY + 0.16, 0.005);
  g.add(counterBody);
  // Front panel — layered inset
  const counterPanel = plane(0.24, 0.22, '#4e3e2a');
  counterPanel.position.set(coX, floorY + 0.13, 0.006);
  g.add(counterPanel);
  const counterPanelHi = plane(0.2, 0.18, '#584832');
  counterPanelHi.position.set(coX, floorY + 0.13, 0.007);
  g.add(counterPanelHi);
  // Countertop — highlighted
  const counterTop = plane(0.3, 0.025, '#7a6a52');
  counterTop.position.set(coX, floorY + 0.33, 0.006);
  g.add(counterTop);
  const counterTopHi = plane(0.26, 0.012, '#8a7a62');
  counterTopHi.position.set(coX, floorY + 0.34, 0.007);
  g.add(counterTopHi);
  const counterLip = plane(0.3, 0.006, '#4e4030');
  counterLip.position.set(coX, floorY + 0.318, 0.007);
  g.add(counterLip);

  // Cash register — layered
  const regShadow = plane(0.12, 0.12, '#0a0a0a');
  regShadow.position.set(coX, floorY + 0.4, 0.007);
  g.add(regShadow);
  const regBody = plane(0.1, 0.1, '#2a2a2a');
  regBody.position.set(coX, floorY + 0.405, 0.008);
  g.add(regBody);
  const regFront = plane(0.08, 0.06, '#222222');
  regFront.position.set(coX, floorY + 0.39, 0.009);
  g.add(regFront);
  // Screen
  const regScreenShadow = plane(0.08, 0.045, '#1a3a2a');
  regScreenShadow.position.set(coX, floorY + 0.435, 0.009);
  g.add(regScreenShadow);
  const regScreen = plane(0.065, 0.035, '#2a5a3a');
  regScreen.position.set(coX, floorY + 0.438, 0.010);
  g.add(regScreen);
  const regScreenHi = plane(0.04, 0.015, '#3a7a4a');
  regScreenHi.position.set(coX, floorY + 0.445, 0.011);
  g.add(regScreenHi);
  // Keypad
  const keypad = plane(0.05, 0.03, '#3a3a3a');
  keypad.position.set(coX, floorY + 0.37, 0.010);
  g.add(keypad);
  const keypadHi = plane(0.04, 0.02, '#4a4a4a');
  keypadHi.position.set(coX, floorY + 0.372, 0.011);
  g.add(keypadHi);

  return g;
}

function createRestaurant(room) {
  const g = new THREE.Group();
  const hw = room.width / 2;
  const floorY = -0.47;
  const leftW = -hw + 0.03;
  const rightW = hw - 0.03;

  // --- Floor — rich dark wood ---
  const floor = plane(room.width - 0.06, 0.96, '#6a5040');
  floor.position.set(0, 0, 0.002);
  g.add(floor);

  // --- Back wall — warm dark tone ---
  const wall = plane(room.width - 0.06, 0.96, '#5a4838');
  wall.position.set(0, 0, 0.001);
  g.add(wall);

  // --- Ceiling ---
  const ceiling = plane(room.width - 0.06, 0.02, '#4a3828');
  ceiling.position.set(0, 0.46, 0.004);
  g.add(ceiling);

  // --- Baseboard ---
  const baseboard = plane(room.width - 0.06, 0.015, '#3a2a1a');
  baseboard.position.set(0, floorY + 0.008, 0.004);
  g.add(baseboard);

  // === Dining tables — 4 tables with white tablecloths ===
  function addTable(tx) {
    // Table shadow
    const tShadow = plane(0.42, 0.3, '#1a1208');
    tShadow.position.set(tx, floorY + 0.15, 0.004);
    g.add(tShadow);
    // Table body — dark wood
    const tBody = plane(0.4, 0.28, '#4a3828');
    tBody.position.set(tx, floorY + 0.14, 0.005);
    g.add(tBody);
    // Table front panel
    const tPanel = plane(0.36, 0.18, '#3a2818');
    tPanel.position.set(tx, floorY + 0.11, 0.006);
    g.add(tPanel);
    const tPanelHi = plane(0.32, 0.14, '#443220');
    tPanelHi.position.set(tx, floorY + 0.11, 0.007);
    g.add(tPanelHi);
    // Table surface
    const tTop = plane(0.42, 0.025, '#5a4838');
    tTop.position.set(tx, floorY + 0.29, 0.006);
    g.add(tTop);
    // White tablecloth — hangs slightly over edges
    const clothShadow = plane(0.44, 0.04, '#b0a898');
    clothShadow.position.set(tx, floorY + 0.3, 0.007);
    g.add(clothShadow);
    const cloth = plane(0.42, 0.03, '#d0c8b8');
    cloth.position.set(tx, floorY + 0.305, 0.008);
    g.add(cloth);
    const clothHi = plane(0.38, 0.015, '#e0d8c8');
    clothHi.position.set(tx, floorY + 0.31, 0.009);
    g.add(clothHi);
    // Cloth drape on front
    const drapeShadow = plane(0.04, 0.08, '#b0a898');
    drapeShadow.position.set(tx - 0.19, floorY + 0.26, 0.008);
    g.add(drapeShadow);
    const drape = plane(0.03, 0.07, '#d0c8b8');
    drape.position.set(tx - 0.19, floorY + 0.265, 0.009);
    g.add(drape);
    const drape2Shadow = plane(0.04, 0.08, '#b0a898');
    drape2Shadow.position.set(tx + 0.19, floorY + 0.26, 0.008);
    g.add(drape2Shadow);
    const drape2 = plane(0.03, 0.07, '#d0c8b8');
    drape2.position.set(tx + 0.19, floorY + 0.265, 0.009);
    g.add(drape2);

    // Place settings — plate with shadow + body + highlight
    for (const px of [-0.1, 0.1]) {
      const plateShadow = new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), mat('#a0a098'));
      plateShadow.position.set(tx + px, floorY + 0.32, 0.010);
      g.add(plateShadow);
      const plate = new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), mat('#d8d8d0'));
      plate.position.set(tx + px, floorY + 0.322, 0.011);
      g.add(plate);
      const plateHi = new THREE.Mesh(new THREE.CircleGeometry(0.02, 8), mat('#e8e8e0'));
      plateHi.position.set(tx + px, floorY + 0.325, 0.012);
      g.add(plateHi);
    }

    // Wine glass — tiny stem + bowl shape
    const glassStem = plane(0.006, 0.03, '#b8b8b8');
    glassStem.position.set(tx + 0.02, floorY + 0.34, 0.011);
    g.add(glassStem);
    const glassBowl = new THREE.Mesh(new THREE.CircleGeometry(0.015, 8), mat('#c8c8d0'));
    glassBowl.position.set(tx + 0.02, floorY + 0.36, 0.012);
    g.add(glassBowl);
  }

  addTable(-1.55);
  addTable(-0.7);
  addTable(0.15);
  addTable(1.0);

  // === Bar — right side, against wall ===
  // Bar back (shelving behind bar)
  const barBackShadow = plane(0.5, 0.55, '#1a1208');
  barBackShadow.position.set(rightW - 0.24, floorY + 0.28, 0.003);
  g.add(barBackShadow);
  const barBack = plane(0.48, 0.53, '#3a2818');
  barBack.position.set(rightW - 0.24, floorY + 0.27, 0.004);
  g.add(barBack);
  // Bar back shelves
  for (const sy of [0.35, 0.5, 0.65]) {
    const shelfShadow = plane(0.42, 0.012, '#2a1808');
    shelfShadow.position.set(rightW - 0.24, floorY + sy - 0.002, 0.005);
    g.add(shelfShadow);
    const shelf = plane(0.4, 0.008, '#4a3828');
    shelf.position.set(rightW - 0.24, floorY + sy, 0.006);
    g.add(shelf);
  }
  // Bottles on shelves — 3 layers of detail each
  const bottleColors = [
    ['#2a4a18', '#3a6a28', '#4a8a38'],  // green
    ['#5a2a1a', '#8a3a2a', '#aa4a3a'],  // burgundy
    ['#6a5a18', '#aa8a28', '#ccaa38'],  // amber
    ['#1a2a4a', '#2a3a6a', '#3a4a8a'],  // blue
  ];
  for (let s = 0; s < 3; s++) {
    const shelfY = floorY + 0.37 + s * 0.15;
    for (let b = 0; b < 4; b++) {
      const bc = bottleColors[(s + b) % bottleColors.length];
      const bx = rightW - 0.4 + b * 0.08;
      // Shadow
      const bShadow = plane(0.03, 0.08, bc[0]);
      bShadow.position.set(bx, shelfY, 0.006);
      g.add(bShadow);
      // Body
      const bBody = plane(0.025, 0.07, bc[1]);
      bBody.position.set(bx, shelfY + 0.003, 0.007);
      g.add(bBody);
      // Label/highlight
      const bHi = plane(0.02, 0.025, bc[2]);
      bHi.position.set(bx, shelfY + 0.01, 0.008);
      g.add(bHi);
      // Bottle neck
      const bNeck = plane(0.01, 0.025, bc[1]);
      bNeck.position.set(bx, shelfY + 0.05, 0.007);
      g.add(bNeck);
    }
  }

  // Bar counter — in front of bar back
  const barShadow = plane(0.2, 0.38, '#1a1208');
  barShadow.position.set(rightW - 0.52, floorY + 0.19, 0.005);
  g.add(barShadow);
  const barBody = plane(0.18, 0.36, '#4a3828');
  barBody.position.set(rightW - 0.52, floorY + 0.18, 0.006);
  g.add(barBody);
  const barPanel = plane(0.14, 0.26, '#3a2818');
  barPanel.position.set(rightW - 0.52, floorY + 0.14, 0.007);
  g.add(barPanel);
  const barPanelHi = plane(0.1, 0.22, '#443220');
  barPanelHi.position.set(rightW - 0.52, floorY + 0.14, 0.008);
  g.add(barPanelHi);
  // Bar countertop
  const barTop = plane(0.22, 0.025, '#5a4838');
  barTop.position.set(rightW - 0.52, floorY + 0.37, 0.007);
  g.add(barTop);
  const barTopHi = plane(0.18, 0.012, '#6a5848');
  barTopHi.position.set(rightW - 0.52, floorY + 0.38, 0.008);
  g.add(barTopHi);

  // Glasses on bar counter
  for (const gx of [-0.04, 0.04]) {
    const gStem = plane(0.005, 0.02, '#a8a8a8');
    gStem.position.set(rightW - 0.52 + gx, floorY + 0.395, 0.009);
    g.add(gStem);
    const gBowl = new THREE.Mesh(new THREE.CircleGeometry(0.012, 8), mat('#b8b8c0'));
    gBowl.position.set(rightW - 0.52 + gx, floorY + 0.41, 0.010);
    g.add(gBowl);
  }

  return g;
}

// Factory: returns a THREE.Group of interior detail meshes
export function createRoomInterior(room) {
  switch (room.type) {
    case 'lobby': return createLobby(room);
    case 'apartment': return createApartment(room);
    case 'office': return createOffice(room);
    case 'retail': return createRetail(room);
    case 'restaurant': return createRestaurant(room);
    default: return new THREE.Group();
  }
}

// Update interior animations (neon sign pulse). No time-of-day changes —
// we're looking at a cross-section, interiors are always lit the same.
export function updateInteriorLighting(group, nightFactor, elapsed) {
  group.traverse((child) => {
    if (!child.isMesh || !child.userData) return;

    if (child.userData.isNeonSign) {
      const pulse = 1.0 + Math.sin(elapsed * 3) * 0.15 + Math.sin(elapsed * 7.3) * 0.05;
      child.material.emissiveIntensity = pulse * 1.5;
    }
  });
}
