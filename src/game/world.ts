import { ZONES } from './content';

export type ZoneId = typeof ZONES[number]['id'];
export type ZoneDefinition = typeof ZONES[number];

export const WORLD_WIDTH = 3600;
export const WORLD_HEIGHT = 2600;
export const WORLD_START = { x: 900, y: 1300 };
export const SHRINE_POSITION = { x: 1180, y: 1110 };
export const SECRET_POSITIONS = {
  'secret-one': { x: 1250, y: 330 },
  'secret-two': { x: 1380, y: 2300 },
} as const;
export const BOSS_POSITION = { x: 3330, y: 2330 };

// Chaque région est le point le plus proche (pondéré) d'un centre, avec des frontières déformées par du bruit.
export const ZONE_SHAPES: Record<ZoneId, { x: number; y: number; weight: number }> = {
  meadow: { x: 900, y: 1300, weight: 1.1 },
  forest: { x: 1900, y: 650, weight: 0.95 },
  crypt: { x: 3000, y: 700, weight: 0.9 },
  marsh: { x: 1800, y: 1850, weight: 1 },
  ashen: { x: 3000, y: 1950, weight: 1.2 },
};

const hash = (x: number, y: number): number => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export function noise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const top = hash(xi, yi) + (hash(xi + 1, yi) - hash(xi, yi)) * u;
  const bottom = hash(xi, yi + 1) + (hash(xi + 1, yi + 1) - hash(xi, yi + 1)) * u;
  return top + (bottom - top) * v;
}

export function zoneScores(x: number, y: number): { zone: ZoneDefinition; score: number }[] {
  const warpX = (noise(x / 520, y / 520) - 0.5) * 520;
  const warpY = (noise(x / 520 + 91, y / 520 - 37) - 0.5) * 520;
  return ZONES.map((zone) => {
    const shape = ZONE_SHAPES[zone.id];
    return { zone, score: Math.hypot(x + warpX - shape.x, y + warpY - shape.y) / shape.weight };
  }).sort((a, b) => a.score - b.score);
}

export const zoneAt = (x: number, y: number): ZoneDefinition => zoneScores(x, y)[0].zone;

export type DecorKind =
  | 'tree' | 'bush' | 'flower' | 'rock' | 'pond' | 'mushroom' | 'log'
  | 'dead-tree' | 'reed' | 'tombstone' | 'pillar' | 'bones' | 'brazier'
  | 'lava' | 'ember' | 'obsidian';

export interface Decor { kind: DecorKind; x: number; y: number; size: number; zone: ZoneId; variant: number }

const DECOR_TABLE: Record<ZoneId, { density: number; kinds: [DecorKind, number][] }> = {
  meadow: { density: 0.42, kinds: [['flower', 9], ['bush', 3], ['tree', 3], ['rock', 2], ['pond', 0.35]] },
  forest: { density: 0.95, kinds: [['tree', 12], ['bush', 3], ['mushroom', 3], ['log', 1.4], ['rock', 1]] },
  crypt: { density: 0.55, kinds: [['tombstone', 7], ['pillar', 2], ['bones', 4], ['brazier', 1.2], ['rock', 1]] },
  marsh: { density: 0.7, kinds: [['reed', 9], ['pond', 3], ['dead-tree', 3], ['bush', 2], ['rock', 0.8]] },
  ashen: { density: 0.5, kinds: [['ember', 8], ['obsidian', 4], ['lava', 1.6], ['dead-tree', 1.4], ['rock', 1]] },
};

const BASE_SIZE: Record<DecorKind, [number, number]> = {
  tree: [26, 42], bush: [11, 19], flower: [3, 5], rock: [14, 30], pond: [50, 105], mushroom: [6, 10], log: [34, 54],
  'dead-tree': [20, 32], reed: [10, 18], tombstone: [16, 24], pillar: [16, 24], bones: [8, 13], brazier: [10, 13],
  lava: [45, 90], ember: [3, 6], obsidian: [18, 34],
};

export const DECOR_CLEARANCE = 150;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDecor(): Decor[] {
  const random = seededRandom(0x51eed5);
  const reserved = [WORLD_START, SHRINE_POSITION, BOSS_POSITION, ...Object.values(SECRET_POSITIONS), ...Object.values(ZONE_SHAPES)];
  const placed: Decor[] = [];
  const buckets = new Map<string, Decor[]>();
  const bucketKey = (x: number, y: number) => `${Math.floor(x / 120)},${Math.floor(y / 120)}`;
  for (let attempt = 0; attempt < 14000; attempt++) {
    const x = 90 + random() * (WORLD_WIDTH - 180);
    const y = 90 + random() * (WORLD_HEIGHT - 180);
    const zone = zoneAt(x, y).id;
    const table = DECOR_TABLE[zone];
    if (random() > table.density) continue;
    if (reserved.some((point) => Math.hypot(point.x - x, point.y - y) < DECOR_CLEARANCE)) continue;
    const total = table.kinds.reduce((sum, [, weight]) => sum + weight, 0);
    let pick = random() * total;
    let kind = table.kinds[0][0];
    for (const [candidate, weight] of table.kinds) {
      pick -= weight;
      if (pick <= 0) { kind = candidate; break; }
    }
    const [minSize, maxSize] = BASE_SIZE[kind];
    const size = minSize + random() * (maxSize - minSize);
    const cx = Math.floor(x / 120);
    const cy = Math.floor(y / 120);
    let blocked = false;
    for (let ox = -1; ox <= 1 && !blocked; ox++) for (let oy = -1; oy <= 1 && !blocked; oy++) {
      for (const other of buckets.get(`${cx + ox},${cy + oy}`) ?? []) {
        const gap = (kind === 'flower' || kind === 'ember' || other.kind === 'flower' || other.kind === 'ember') ? 0.3 : 1.1;
        if (Math.hypot(other.x - x, other.y - y) < (size + other.size) * gap) { blocked = true; break; }
      }
    }
    if (blocked) continue;
    const decor: Decor = { kind, x, y, size, zone, variant: random() };
    placed.push(decor);
    const key = bucketKey(x, y);
    buckets.set(key, [...(buckets.get(key) ?? []), decor]);
  }
  return placed;
}
