export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function formatMoney(amount) {
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(1) + 'M';
  if (amount >= 1000) return '$' + (amount / 1000).toFixed(0) + 'K';
  return '$' + amount.toFixed(0);
}

export function worldToGrid(worldX, worldY) {
  return {
    gridX: Math.floor(worldX),
    gridY: Math.floor(worldY),
  };
}

export function gridToWorld(gridX, gridY) {
  return {
    x: gridX + 0.5,
    y: gridY + 0.5,
  };
}

let nextId = 1;
export function generateId() {
  return 'id_' + (nextId++);
}
