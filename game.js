(() => {
'use strict';

// ============================================================
// Constants & helpers
// ============================================================
const TILE = 48, COLS = 20, ROWS = 12;
const W = COLS * TILE, H = ROWS * TILE;
const INK = '#2b2140';
const TAU = Math.PI * 2;
const FONT = '"Lilita One", "Baloo 2", "Trebuchet MS", system-ui, sans-serif';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  remove(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } },
};
const SAVE_KEY = 'zbash.save';
const PROGRESS_KEY = 'zbash.progress';
const coarse = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;
const buzz = (ms) => { try { if (!Sound.muted && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* no haptics */ } };

const rgbCache = new Map();
function hexRgb(h) {
  let v = rgbCache.get(h);
  if (!v) { const n = parseInt(h.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; rgbCache.set(h, v); }
  return v;
}
function mix(a, b, k) {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], k))},${Math.round(lerp(A[1], B[1], k))},${Math.round(lerp(A[2], B[2], k))})`;
}

// ============================================================
// Data: worlds, levels, zombies, towers
// ============================================================
const WORLDS = [
  {
    id: 'patch', name: 'Pumpkin Patch',
    blurb: 'Zombies are stumbling out of the cornfields. Time to defend the farmhouse.',
    theme: { grassA: '#a6d36d', grassB: '#9bcb63', tuft: '#76ad4a', flower: ['#ff9f43', '#ffd93d', '#ffffff'],
      path: '#d9b07a', pathMid: '#e8c492', pebble: '#b88b55', decor: ['pumpkin', 'pumpkin', 'corn', 'hay'] },
    mobs: ['walker', 'runner', 'cone', 'digger'], boss: 'pumpkinKing',
  },
  {
    id: 'grave', name: 'Moonlit Graveyard', night: true,
    blurb: 'Something is rattling under the tombstones. Bring a flashlight.',
    theme: { grassA: '#6b9a7f', grassB: '#649279', tuft: '#4a7a60', flower: ['#c8b6ff', '#ffffff', '#9fd8ff'],
      path: '#c2b8a3', pathMid: '#d3cbb8', pebble: '#958b78', decor: ['tomb', 'tomb', 'deadtree', 'tomb'] },
    mobs: ['bucket', 'ghost', 'skeleton', 'necro'], boss: 'graveLord',
  },
  {
    id: 'tundra', name: 'Frozen Tundra',
    blurb: 'Frozen zombies thaw out and march across the ice. Frost towers barely slow them.',
    theme: { grassA: '#eaf5fc', grassB: '#dfeff9', tuft: '#b5d5ea', flower: ['#9fd8ff', '#ffffff', '#c8b6ff'],
      path: '#a9b8d9', pathMid: '#bccae6', pebble: '#8796bd', decor: ['pine', 'pine', 'snowman', 'pine'] },
    mobs: ['frosty', 'brute', 'medic'], boss: 'yeti',
  },
  {
    id: 'swamp', name: 'Toxic Swamp',
    blurb: 'Bubbling goo makes zombies swell up. Pop them before they burst.',
    theme: { grassA: '#93ad5c', grassB: '#8aa554', tuft: '#62803c', flower: ['#c6ff5e', '#b98aff', '#ffffff'],
      path: '#a38d71', pathMid: '#b59f83', pebble: '#7b6850', decor: ['barrel', 'mushroom', 'deadtree', 'mushroom'] },
    mobs: ['bloater', 'imp'], boss: 'megaBloater',
  },
];

// Secondary paths may end where they join the first path; they follow it from there.
const LEVELS = [
  { id: '1-1', world: 0, name: 'Farm Road', waves: 10, gold: 250, seed: 7,
    paths: [[[-1, 9], [2, 9], [2, 2], [6, 2], [6, 9], [10, 9], [10, 2], [14, 2], [14, 9], [17, 9], [17, 4], [19, 4]]],
    pool: [['walker', 1], ['runner', 3], ['cone', 6]] },
  { id: '1-2', world: 0, name: 'Corn Maze', waves: 12, gold: 260, seed: 21,
    paths: [[[-1, 2], [4, 2], [4, 8], [9, 8], [9, 3], [14, 3], [14, 9], [18, 9]]],
    pool: [['walker', 1], ['runner', 2], ['cone', 3], ['digger', 5]] },
  { id: '1-3', world: 0, name: 'Harvest Moon', waves: 15, gold: 280, seed: 33, boss: 'pumpkinKing',
    paths: [[[-1, 5], [3, 5], [3, 1], [8, 1], [8, 10], [12, 10], [12, 4], [16, 4], [16, 8], [18, 8]]],
    pool: [['walker', 1], ['runner', 2], ['cone', 3], ['digger', 4]] },
  { id: '2-1', world: 1, name: 'Crypt Lane', waves: 12, gold: 300, seed: 99,
    paths: [[[-1, 6], [5, 6], [5, 2], [12, 2], [12, 9], [18, 9], [18, 5]]],
    pool: [['walker', 1], ['runner', 2], ['skeleton', 3], ['bucket', 4], ['ghost', 6]] },
  { id: '2-2', world: 1, name: 'Twin Graves', waves: 12, gold: 320, seed: 5,
    paths: [[[-1, 2], [6, 2], [6, 6], [11, 6], [11, 2], [16, 2], [16, 9], [18, 9]], [[-1, 10], [6, 10], [6, 6]]],
    pool: [['walker', 1], ['skeleton', 1], ['cone', 2], ['bucket', 3], ['ghost', 3], ['necro', 5], ['digger', 7]] },
  { id: '2-3', world: 1, name: 'Mausoleum', waves: 15, gold: 340, seed: 61, boss: 'graveLord',
    paths: [[[10, -1], [10, 3], [4, 3], [4, 8], [15, 8], [15, 3], [18, 3], [18, 6]]],
    pool: [['walker', 1], ['skeleton', 1], ['runner', 2], ['bucket', 3], ['ghost', 4], ['necro', 5], ['digger', 6]] },
  { id: '3-1', world: 2, name: 'Snowy Pass', waves: 12, gold: 360, seed: 14,
    paths: [[[-1, 3], [5, 3], [5, 8], [10, 8], [10, 2], [15, 2], [15, 7], [18, 7]]],
    pool: [['walker', 1], ['frosty', 2], ['runner', 2], ['bucket', 4], ['brute', 5]] },
  { id: '3-2', world: 2, name: 'Icy Crossroads', waves: 14, gold: 380, seed: 42,
    paths: [[[4, -1], [4, 5], [9, 5], [9, 2], [14, 2], [14, 9], [18, 9]], [[4, 12], [4, 5]]],
    pool: [['walker', 1], ['frosty', 1], ['skeleton', 2], ['brute', 3], ['medic', 4], ['ghost', 5], ['digger', 7]] },
  { id: '3-3', world: 2, name: 'Yeti Peak', waves: 15, gold: 400, seed: 77, boss: 'yeti',
    paths: [[[-1, 6], [4, 6], [4, 2], [9, 2], [9, 9], [14, 9], [14, 4], [18, 4]]],
    pool: [['walker', 1], ['frosty', 1], ['runner', 2], ['brute', 3], ['medic', 4], ['bucket', 5], ['necro', 7]] },
  { id: '4-1', world: 3, name: 'Sludge Creek', waves: 14, gold: 420, seed: 8,
    paths: [[[-1, 8], [4, 8], [4, 3], [9, 3], [9, 9], [14, 9], [14, 2], [18, 2]]],
    pool: [['walker', 1], ['imp', 1], ['bloater', 2], ['cone', 3], ['frosty', 5], ['medic', 6]] },
  { id: '4-2', world: 3, name: 'Bog Junction', waves: 15, gold: 440, seed: 18,
    paths: [[[-1, 3], [6, 3], [6, 7], [11, 7], [11, 2], [16, 2], [16, 9], [18, 9]], [[-1, 9], [3, 9], [3, 7], [6, 7]]],
    pool: [['walker', 1], ['bloater', 1], ['imp', 1], ['bucket', 3], ['necro', 5], ['brute', 8], ['ghost', 7]] },
  { id: '4-3', world: 3, name: 'Toxic Core', waves: 18, gold: 460, seed: 90, boss: 'megaBloater',
    paths: [[[3, -1], [3, 3], [8, 3], [8, 7], [13, 7], [13, 2], [17, 2], [17, 8], [19, 8]], [[3, 12], [3, 7], [8, 7]]],
    pool: [['walker', 1], ['bloater', 1], ['runner', 2], ['frosty', 3], ['brute', 4], ['medic', 5], ['necro', 6], ['ghost', 7], ['digger', 8]] },
];
LEVELS.forEach((L, i) => { L.index = i; L.diff = i * 0.5; L.gold = 250 + i * 45; });

const ZOMBIES = {
  walker:   { name: 'Shambler', hp: 30, speed: 44, reward: 4, r: 13,
    desc: 'Slow and steady, arms out, thinking about brains.',
    look: { skin: '#9ccc65', shirt: '#8d6e63', pants: '#5c6bc0' } },
  runner:   { name: 'Sprinter', hp: 18, speed: 92, reward: 5, r: 11,
    desc: 'Fast and fragile. Track it with quick towers.',
    look: { skin: '#aed581', shirt: '#ef5350', pants: '#37474f', lean: 0.22 } },
  cone:     { name: 'Conehead', hp: 55, speed: 42, armor: 3, reward: 6, r: 13,
    desc: 'A traffic cone soaks up small hits.',
    look: { skin: '#9ccc65', shirt: '#4db6ac', pants: '#6d4c41', hat: 'cone' } },
  digger:   { name: 'Digger', hp: 45, speed: 50, reward: 6, r: 13, burrow: [0.1, 0.48],
    desc: 'Tunnels under the first part of the path, where towers cannot hit it.',
    look: { skin: '#a5c46a', shirt: '#ffb74d', pants: '#5d4037', hat: 'miner' } },
  bucket:   { name: 'Buckethead', hp: 110, speed: 38, armor: 7, reward: 9, r: 14,
    desc: 'Wears a bucket. Zap Coils and snipers punch through it.',
    look: { skin: '#8fbf5a', shirt: '#7986cb', pants: '#455a64', hat: 'bucket' } },
  ghost:    { name: 'Ghoulie', hp: 45, speed: 62, reward: 6, r: 13, noSlow: true,
    desc: 'Floats along and cannot be slowed.',
    look: { skin: '#e3e6ff', kind: 'ghost' } },
  skeleton: { name: 'Rattler', hp: 20, speed: 66, reward: 2, r: 11,
    desc: 'A bony little runner. Comes in crowds.',
    look: { skin: '#f3efe0', kind: 'skeleton' } },
  necro:    { name: 'Necromancer', hp: 90, speed: 36, reward: 12, r: 14, summon: { type: 'skeleton', n: 2, every: 5 },
    desc: 'Raises Rattlers from the ground every few seconds.',
    look: { skin: '#9ccc65', shirt: '#7e57c2', pants: '#4527a0', hat: 'hood', robe: true, staff: true } },
  brute:    { name: 'Brute', hp: 280, speed: 30, armor: 2, reward: 16, r: 19, lives: 3,
    desc: 'Huge and tough. Eats three brains if it gets in.',
    look: { skin: '#8bc34a', shirt: '#795548', pants: '#3e2723', wide: true } },
  frosty:   { name: 'Frostbite', hp: 70, speed: 48, armor: 2, reward: 7, r: 13, noSlow: true,
    desc: 'Already frozen solid, so frost does nothing.',
    look: { skin: '#9fd8f0', shirt: '#5c6bc0', pants: '#283593', hat: 'icicle' } },
  medic:    { name: 'Doc Rot', hp: 80, speed: 40, reward: 12, r: 13, heal: { every: 3, pct: 0.12, radius: 1.8 },
    desc: 'Patches up nearby zombies. Take it out first.',
    look: { skin: '#9ccc65', shirt: '#f5f5f5', pants: '#546e7a', hat: 'mirror', cross: true } },
  bloater:  { name: 'Bloater', hp: 90, speed: 34, reward: 8, r: 16, splits: { type: 'imp', n: 3 },
    desc: 'Bursts into three Gnawlings when it pops.',
    look: { skin: '#a5d06a', kind: 'round' } },
  imp:      { name: 'Gnawling', hp: 14, speed: 80, reward: 1, r: 9,
    desc: 'Tiny, quick and always hungry.',
    look: { skin: '#b5dd7a', shirt: '#9575cd', pants: '#4e342e' } },
  pumpkinKing: { name: 'Pumpkin King', hp: 1400, speed: 24, armor: 4, reward: 150, r: 26, lives: 10, boss: true,
    summon: { type: 'runner', n: 2, every: 6 },
    desc: 'Rules the patch and calls Sprinters to run ahead.',
    look: { skin: '#9ccc65', shirt: '#4e342e', pants: '#33691e', hat: 'pumpkin', wide: true } },
  graveLord: { name: 'Grave Lord', hp: 2000, speed: 22, armor: 5, reward: 180, r: 27, lives: 10, boss: true,
    summon: { type: 'skeleton', n: 3, every: 4.5 },
    desc: 'Raises an army of Rattlers as it walks.',
    look: { skin: '#9ccc65', shirt: '#311b92', pants: '#1a237e', hat: 'hood', crown: true, robe: true, staff: true, wide: true } },
  yeti: { name: 'Zombie Yeti', hp: 2800, speed: 22, armor: 8, reward: 220, r: 30, lives: 12, boss: true, noSlow: true,
    stomp: { every: 7, radius: 2.6, dur: 2 },
    desc: 'Stomps the ground and freezes nearby towers.',
    look: { skin: '#f4f8ff', kind: 'yeti' } },
  megaBloater: { name: 'Mega Bloater', hp: 2600, speed: 20, armor: 4, reward: 260, r: 32, lives: 15, boss: true,
    summon: { type: 'imp', n: 3, every: 5 }, splits: { type: 'bloater', n: 3 },
    desc: 'Leaks Gnawlings, then bursts into three Bloaters.',
    look: { skin: '#9ccf4f', kind: 'round', crown: true } },
};

// How many of each zombie a wave holds, and how tightly they bunch up.
const WEIGHT = { walker: 1, runner: 0.6, cone: 0.4, digger: 0.3, bucket: 0.25, ghost: 0.35, skeleton: 0.55,
  necro: 0.1, brute: 0.12, frosty: 0.35, medic: 0.09, bloater: 0.18, imp: 0.5 };
const GAP = { walker: 0.8, runner: 0.45, cone: 0.95, digger: 1.1, bucket: 1.3, ghost: 0.8, skeleton: 0.5,
  necro: 3, brute: 2.6, frosty: 0.9, medic: 3, bloater: 1.8, imp: 0.35 };

const TOWERS = {
  pebble: {
    name: 'Pebble Pal', cost: 50, key: '1',
    desc: 'Cheap and speedy. Flicks pebbles at one zombie at a time.',
    levels: [
      { dmg: 6,  rate: 0.55, range: 2.6 },
      { dmg: 9,  rate: 0.45, range: 2.8, cost: 60 },
      { dmg: 14, rate: 0.36, range: 3.0, cost: 120 },
      { dmg: 22, rate: 0.26, range: 3.3, cost: 220, twin: true },
    ],
  },
  cannon: {
    name: 'Boom Buddy', cost: 90, key: '2',
    desc: 'Lobs bombs that splash a whole crowd of zombies.',
    levels: [
      { dmg: 14, rate: 1.6,  range: 2.5, splash: 0.9 },
      { dmg: 24, rate: 1.5,  range: 2.6, splash: 1.0,  cost: 90 },
      { dmg: 38, rate: 1.35, range: 2.8, splash: 1.15, cost: 170 },
      { dmg: 60, rate: 1.2,  range: 3.0, splash: 1.35, cost: 300 },
    ],
  },
  frost: {
    name: 'Frost Puff', cost: 80, key: '3',
    desc: 'Snowballs slow zombies down. Ghoulies and Frostbites shrug it off.',
    levels: [
      { dmg: 3,  rate: 1.1,  range: 2.3, splash: 0.7,  slow: 0.35, slowDur: 1.4 },
      { dmg: 5,  rate: 1.0,  range: 2.5, splash: 0.8,  slow: 0.45, slowDur: 1.7, cost: 70 },
      { dmg: 8,  rate: 0.9,  range: 2.7, splash: 0.9,  slow: 0.55, slowDur: 2.0, cost: 130 },
      { dmg: 12, rate: 0.75, range: 3.0, splash: 1.05, slow: 0.65, slowDur: 2.4, cost: 220 },
    ],
  },
  torch: {
    name: 'Torch Tot', cost: 110, key: '4',
    desc: 'Short-range flames set crowds on fire. Burning ignores armor.',
    levels: [
      { dmg: 4,  rate: 0.32, range: 1.9, splash: 0.75, burn: 6,  burnDur: 2 },
      { dmg: 6,  rate: 0.28, range: 2.0, splash: 0.8,  burn: 10, burnDur: 2.2, cost: 90 },
      { dmg: 9,  rate: 0.24, range: 2.2, splash: 0.9,  burn: 16, burnDur: 2.5, cost: 160 },
      { dmg: 14, rate: 0.2,  range: 2.4, splash: 1.0,  burn: 26, burnDur: 3,   cost: 280 },
    ],
  },
  zap: {
    name: 'Zap Coil', cost: 130, key: '5',
    desc: 'Lightning hops between zombies and ignores armor.',
    levels: [
      { dmg: 11, rate: 1.25, range: 2.4, chain: 3 },
      { dmg: 17, rate: 1.15, range: 2.6, chain: 4, cost: 120 },
      { dmg: 26, rate: 1.0,  range: 2.8, chain: 5, cost: 210 },
      { dmg: 40, rate: 0.85, range: 3.1, chain: 7, cost: 340 },
    ],
  },
  owl: {
    name: 'Hoot Sniper', cost: 150, key: '6',
    desc: 'Huge range, huge hits, slow reload. Punches through armor.',
    levels: [
      { dmg: 45,  rate: 2.2, range: 5.5, pierce: 0.5 },
      { dmg: 80,  rate: 2.0, range: 6.0, pierce: 0.6,  cost: 140 },
      { dmg: 140, rate: 1.8, range: 6.8, pierce: 0.75, cost: 250 },
      { dmg: 240, rate: 1.5, range: 8.0, pierce: 1,    cost: 420 },
    ],
  },
};
const TOWER_KEYS = Object.keys(TOWERS);
const MODES = [['first', 'First'], ['last', 'Last'], ['strong', 'Strongest'], ['close', 'Closest']];

// Difficulty grows with the wave number and with how far into the campaign the level sits.
// The campaign bonus phases in over the first waves, since every level starts from an empty field.
const effWave = (L, n) => n + L.diff * Math.min(1, n / 6);
function hpScale(e) { return 1 + 0.1 * (e - 1) + 0.016 * (e - 1) * (e - 1); }
function waveBonus(L, n) { return Math.round(20 + effWave(L, n) * 3); }

function makeWave(L, n) {
  const e = effWave(L, n);
  const groups = [];
  for (const [type, from] of L.pool) {
    if (n < from) continue;
    let count = Math.round(WEIGHT[type] * (5.5 + (n - from) * 1.2 + L.diff * 0.4 * Math.min(1, n / 6)));
    count = Math.max(from === n ? 2 : 1, count);
    groups.push({ type, count, gap: GAP[type] * Math.max(0.55, 1 - e * 0.015), delay: groups.length ? 1 : 0 });
  }
  if (n % 5 === 0 && n < L.waves) groups.push({ type: L.world === 3 ? 'imp' : 'runner', count: Math.round(4 + e * 0.5), gap: 0.22, delay: 1 });
  if (L.boss && n === L.waves) groups.push({ type: L.boss, count: 1, gap: 1, delay: 2 });
  return groups;
}

function waveSummary(L, n) {
  const counts = {};
  for (const grp of makeWave(L, n)) counts[grp.type] = (counts[grp.type] || 0) + grp.count;
  return counts;
}
// A zombie counts as new only in the level where the campaign first sends it.
const FIRST_SEEN = {};
for (const L of LEVELS) for (const [type] of L.pool) if (!(type in FIRST_SEEN)) FIRST_SEEN[type] = L.id;
const newTypes = (L, n) => L.pool.filter(([type, from]) => from === n && FIRST_SEEN[type] === L.id).map(([type]) => type);

// ============================================================
// Progress (stars per level)
// ============================================================
function loadProgress() {
  try { const p = JSON.parse(store.get(PROGRESS_KEY)); if (p && typeof p.stars === 'object') return p; } catch (e) { /* corrupt */ }
  return { stars: {} };
}
const progress = loadProgress();
const starsFor = (L) => progress.stars[L.id] | 0;
const levelUnlocked = (i) => i === 0 || starsFor(LEVELS[i - 1]) > 0;
const worldUnlocked = (w) => levelUnlocked(LEVELS.findIndex((L) => L.world === w));
function recordStars(L, n) {
  if (n > starsFor(L)) { progress.stars[L.id] = n; store.set(PROGRESS_KEY, JSON.stringify(progress)); }
}
function starsFromLives(lives) {
  const k = lives / 20;
  return k >= 0.85 ? 3 : k >= 0.4 ? 2 : 1;
}

// ============================================================
// Level building
// ============================================================
function pathFromPoints(points) {
  const pts = points.map(([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 }));
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({ a, b, len, start: total, dx: (b.x - a.x) / len, dy: (b.y - a.y) / len });
    total += len;
  }
  return { points, pts, segs, total };
}

// A secondary path that stops on the main path continues along the main path to the safehouse.
function completePath(main, points) {
  const [mc, mr] = points[points.length - 1];
  for (let i = 0; i < main.length - 1; i++) {
    const [ac, ar] = main[i], [bc, br] = main[i + 1];
    const onSeg = (ac === bc && mc === ac && mr >= Math.min(ar, br) && mr <= Math.max(ar, br)) ||
                  (ar === br && mr === ar && mc >= Math.min(ac, bc) && mc <= Math.max(ac, bc));
    if (onSeg) return points.concat(main.slice(i + 1));
  }
  return points;
}

function buildLevel(L) {
  const world = WORLDS[L.world];
  const grid = new Uint8Array(COLS * ROWS); // 0 free, 1 path, 2 decor
  const main = L.paths[0];
  const paths = L.paths.map((p, i) => pathFromPoints(i === 0 ? p : completePath(main, p)));
  for (const p of paths) {
    for (let i = 0; i < p.points.length - 1; i++) {
      let [c, r] = p.points[i];
      const [c2, r2] = p.points[i + 1];
      const dc = Math.sign(c2 - c), dr = Math.sign(r2 - r);
      for (;;) {
        if (c >= 0 && c < COLS && r >= 0 && r < ROWS) grid[r * COLS + c] = 1;
        if (c === c2 && r === r2) break;
        c += dc; r += dr;
      }
    }
  }
  const rng = mulberry32(L.seed);
  const decor = [];
  const end = main[main.length - 1];
  let tries = 0;
  while (decor.length < 15 && tries++ < 800) {
    const c = Math.floor(rng() * COLS), r = Math.floor(rng() * ROWS);
    if (grid[r * COLS + c] !== 0) continue;
    if (Math.abs(c - end[0]) <= 1 && Math.abs(r - end[1]) <= 1) continue;
    grid[r * COLS + c] = 2;
    const kinds = world.theme.decor;
    decor.push({ kind: rng() < 0.8 ? kinds[Math.floor(rng() * kinds.length)] : 'rock', c, r,
      x: c * TILE + TILE / 2 + (rng() - 0.5) * 8, y: r * TILE + TILE / 2 + (rng() - 0.5) * 6, s: 0.85 + rng() * 0.25, flip: rng() < 0.5 ? -1 : 1 });
  }
  const flowers = [];
  for (let i = 0; i < 70; i++) {
    const x = rng() * W, y = rng() * H;
    if (grid[Math.floor(y / TILE) * COLS + Math.floor(x / TILE)] === 1) continue;
    flowers.push({ x, y, kind: rng() < 0.55 ? 'tuft' : 'flower', color: world.theme.flower[Math.floor(rng() * world.theme.flower.length)], s: 0.7 + rng() * 0.6 });
  }
  const pebbles = [];
  for (const p of paths) {
    for (let i = 0; i < 70; i++) {
      const q = pointOn(p, rng() * p.total);
      const off = (rng() - 0.5) * TILE * 0.6;
      pebbles.push({ x: q.x + q.dy * off, y: q.y - q.dx * off, r: 1.5 + rng() * 2.5 });
    }
  }
  return { L, world, grid, paths, decor, flowers, pebbles, end: paths[0].pts[paths[0].pts.length - 1] };
}

function pointOn(path, d) {
  const segs = path.segs;
  d = clamp(d, 0, path.total);
  for (const s of segs) {
    if (d <= s.start + s.len || s === segs[segs.length - 1]) {
      const k = d - s.start;
      return { x: s.a.x + s.dx * k, y: s.a.y + s.dy * k, dx: s.dx, dy: s.dy };
    }
  }
  return { x: 0, y: 0, dx: 1, dy: 0 };
}

// ============================================================
// Drawing primitives
// ============================================================
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
function ellipse(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); }
function fillStroke(c, fill, lw = 3) {
  c.fillStyle = fill; c.fill();
  c.lineWidth = lw; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke();
}
function shine(c, x, y, rx, ry, a = 0.55) {
  c.save(); c.globalAlpha *= a; c.fillStyle = '#fff'; ellipse(c, x, y, rx, ry); c.fill(); c.restore();
}
function star(c, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n;
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
}
function eyes(c, x, y, spread, size, lx, ly, mood) {
  for (const s of [-1, 1]) {
    const ex = x + s * spread;
    circle(c, ex, y, size); fillStroke(c, '#fff', 2);
    const px = ex + lx * size * 0.38, py = y + ly * size * 0.38;
    circle(c, px, py, size * 0.52); c.fillStyle = INK; c.fill();
    circle(c, px - size * 0.18, py - size * 0.2, size * 0.17); c.fillStyle = '#fff'; c.fill();
  }
  if (mood === 'angry') {
    c.lineWidth = 2.5; c.strokeStyle = INK; c.lineCap = 'round';
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(x + s * (spread + size), y - size * 1.25);
      c.lineTo(x + s * (spread - size * 0.6), y - size * 0.7);
      c.stroke();
    }
  }
}
function outlinedText(c, text, x, y, size, fill, lw = 4) {
  c.font = `${size}px ${FONT}`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = INK;
  c.strokeText(text, x, y);
  c.fillStyle = fill; c.fillText(text, x, y);
}

// ============================================================
// Background (static, pre-rendered)
// ============================================================
function renderBackground(c, M, s) {
  const th = M.world.theme;
  c.setTransform(s, 0, 0, s, 0, 0);
  for (let r = 0; r < ROWS; r++) {
    for (let col = 0; col < COLS; col++) {
      c.fillStyle = (r + col) % 2 ? th.grassA : th.grassB;
      c.fillRect(col * TILE, r * TILE, TILE + 0.5, TILE + 0.5);
    }
  }
  for (const f of M.flowers) {
    if (f.kind === 'tuft') {
      c.strokeStyle = th.tuft; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(f.x - 4 * f.s, f.y); c.lineTo(f.x - 2 * f.s, f.y - 6 * f.s);
      c.moveTo(f.x, f.y); c.lineTo(f.x, f.y - 8 * f.s);
      c.moveTo(f.x + 4 * f.s, f.y); c.lineTo(f.x + 2 * f.s, f.y - 6 * f.s);
      c.stroke();
    } else {
      c.fillStyle = f.color;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        circle(c, f.x + Math.cos(a) * 2.6 * f.s, f.y + Math.sin(a) * 2.6 * f.s, 2 * f.s); c.fill();
      }
      circle(c, f.x, f.y, 1.6 * f.s); c.fillStyle = '#ffb703'; c.fill();
    }
  }
  // Paths: all ink first, then all fills, so merging paths read as one road.
  const pw = TILE * 0.82;
  const trace = (p) => { c.beginPath(); p.pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); };
  c.lineJoin = 'round'; c.lineCap = 'round';
  for (const p of M.paths) { trace(p); c.strokeStyle = INK; c.lineWidth = pw + 7; c.stroke(); }
  for (const p of M.paths) { trace(p); c.strokeStyle = th.path; c.lineWidth = pw; c.stroke(); }
  c.globalAlpha = 0.7;
  for (const p of M.paths) { trace(p); c.strokeStyle = th.pathMid; c.lineWidth = pw * 0.42; c.stroke(); }
  c.globalAlpha = 1;
  c.fillStyle = th.pebble;
  for (const p of M.pebbles) { ellipse(c, p.x, p.y, p.r, p.r * 0.75); c.fill(); }

  const decor = [...M.decor].sort((a, b) => a.y - b.y);
  for (const d of decor) drawDecor(c, d);

  if (M.world.night) {
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.62);
    g.addColorStop(0, 'rgba(30,20,70,0)');
    g.addColorStop(1, 'rgba(30,20,70,.42)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
}

function drawDecor(c, d) {
  c.save(); c.translate(d.x, d.y); c.scale(d.s * (d.flip || 1), d.s);
  c.fillStyle = 'rgba(43,33,64,.18)'; ellipse(c, 0, 14, 16, 5); c.fill();
  switch (d.kind) {
    case 'pumpkin': {
      for (const [x, w] of [[-7, 8], [7, 8], [0, 9]]) { ellipse(c, x, 6, w, 9); fillStroke(c, '#ff9f43'); }
      rr(c, -2, -6, 4, 6, 1.5); fillStroke(c, '#6d8b3a', 2);
      c.beginPath(); c.moveTo(2, -4); c.quadraticCurveTo(9, -9, 11, -3); c.lineWidth = 2; c.strokeStyle = '#6d8b3a'; c.stroke();
      shine(c, -3, 1, 2.5, 4, 0.4);
      break;
    }
    case 'corn': {
      for (const x of [-7, 0, 7]) {
        c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.moveTo(x, 14); c.lineTo(x, -16 + Math.abs(x)); c.stroke();
        c.strokeStyle = '#7cb342'; c.lineWidth = 2.5; c.stroke();
        c.beginPath(); c.moveTo(x, 2); c.quadraticCurveTo(x + 8, -2, x + 9, 4); fillStroke(c, '#8bc34a', 1.5);
        ellipse(c, x, -14 + Math.abs(x), 3, 6); fillStroke(c, '#ffd54f', 1.5);
      }
      break;
    }
    case 'hay': {
      rr(c, -15, -6, 30, 20, 5); fillStroke(c, '#f2c14e');
      c.strokeStyle = '#c99a2e'; c.lineWidth = 1.5;
      for (const y of [-1, 4, 9]) { c.beginPath(); c.moveTo(-12, y); c.lineTo(12, y); c.stroke(); }
      c.strokeStyle = '#8d5a2b'; c.lineWidth = 2.5;
      for (const x of [-6, 6]) { c.beginPath(); c.moveTo(x, -6); c.lineTo(x, 14); c.stroke(); }
      break;
    }
    case 'tomb': {
      c.beginPath(); c.moveTo(-11, 12); c.lineTo(-11, -6); c.arc(0, -6, 11, Math.PI, 0); c.lineTo(11, 12); c.closePath();
      fillStroke(c, '#b9b3c9');
      shine(c, -5, -9, 3, 5, 0.4);
      c.strokeStyle = INK; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, -11); c.lineTo(0, 2); c.moveTo(-5, -6); c.lineTo(5, -6); c.stroke();
      rr(c, -14, 10, 28, 5, 2); fillStroke(c, '#6b8f5a', 2);
      break;
    }
    case 'deadtree': {
      c.lineCap = 'round';
      const branch = (lw) => {
        c.beginPath(); c.moveTo(0, 14); c.lineTo(0, -6);
        c.moveTo(0, -2); c.lineTo(-10, -14); c.moveTo(-6, -9); c.lineTo(-12, -6);
        c.moveTo(0, -6); c.lineTo(8, -18); c.moveTo(5, -13); c.lineTo(12, -12);
        c.lineWidth = lw; c.stroke();
      };
      c.strokeStyle = INK; branch(7);
      c.strokeStyle = '#7b5e57'; branch(3.5);
      break;
    }
    case 'pine': {
      rr(c, -3, 4, 6, 10, 2); fillStroke(c, '#8a5a3c');
      for (const [y, w] of [[0, 14], [-9, 12], [-18, 9]]) {
        c.beginPath(); c.moveTo(-w, y + 2); c.lineTo(0, y - 16); c.lineTo(w, y + 2); c.closePath();
        fillStroke(c, '#3f9e7a');
        c.beginPath(); c.moveTo(-w * 0.45, y - 8); c.lineTo(0, y - 16); c.lineTo(w * 0.45, y - 8);
        c.quadraticCurveTo(0, y - 5, -w * 0.45, y - 8); c.fillStyle = '#fff'; c.fill();
      }
      break;
    }
    case 'snowman': {
      circle(c, 0, 6, 10); fillStroke(c, '#ffffff');
      circle(c, 0, -9, 7); fillStroke(c, '#ffffff');
      c.beginPath(); c.moveTo(0, -9); c.lineTo(8, -8); c.lineTo(0, -7); c.closePath(); fillStroke(c, '#ff9f43', 1.5);
      for (const x of [-2.5, 2.5]) { circle(c, x, -11, 1.3); c.fillStyle = INK; c.fill(); }
      rr(c, -8, -4, 16, 4, 2); fillStroke(c, '#ef5350', 1.5);
      break;
    }
    case 'barrel': {
      rr(c, -10, -12, 20, 26, 5); fillStroke(c, '#5c8a3a');
      c.strokeStyle = INK; c.lineWidth = 2;
      for (const y of [-5, 7]) { c.beginPath(); c.moveTo(-10, y); c.lineTo(10, y); c.stroke(); }
      ellipse(c, 0, -12, 10, 4); fillStroke(c, '#c6ff5e', 2);
      circle(c, 0, 1, 4); fillStroke(c, '#ffd93d', 1.5);
      break;
    }
    case 'mushroom': {
      rr(c, -4, -2, 8, 15, 3); fillStroke(c, '#f5ead0');
      c.beginPath(); c.moveTo(-14, 0); c.quadraticCurveTo(-14, -16, 0, -16); c.quadraticCurveTo(14, -16, 14, 0); c.closePath();
      fillStroke(c, '#b98aff');
      for (const [x, y, r] of [[-6, -8, 2.5], [4, -11, 2], [7, -4, 2]]) { circle(c, x, y, r); c.fillStyle = '#f3ecff'; c.fill(); }
      break;
    }
    default: {
      c.beginPath();
      c.moveTo(-14, 10); c.quadraticCurveTo(-16, -4, -6, -8); c.quadraticCurveTo(4, -14, 12, -4); c.quadraticCurveTo(17, 4, 13, 10); c.closePath();
      fillStroke(c, '#b9b3c9');
      shine(c, -4, -4, 5, 3, 0.6);
    }
  }
  c.restore();
}

function drawSafehouse(c, x, y, t, hit) {
  c.save();
  c.translate(x, y + 8);
  const w = hit > 0 ? Math.sin(hit * 50) * 0.08 * (hit / 0.5) : 0;
  c.scale(1 + w, 1 - w);
  c.fillStyle = 'rgba(43,33,64,.22)'; ellipse(c, 0, 12, 28, 7); c.fill();
  rr(c, 9, -44, 8, 14, 1.5); fillStroke(c, '#8d8a9e', 2.5);
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.5 + i / 3) % 1;
    c.save(); c.globalAlpha = (1 - k) * 0.75;
    circle(c, 13 + k * 7, -48 - k * 20, 3 + k * 4); c.fillStyle = '#ffffff'; c.fill();
    c.restore();
  }
  rr(c, -20, -22, 40, 34, 3); fillStroke(c, '#c98b52');
  c.strokeStyle = '#9c6334'; c.lineWidth = 1.5;
  for (const py of [-14, -6, 2]) { c.beginPath(); c.moveTo(-18, py); c.lineTo(18, py); c.stroke(); }
  c.beginPath(); c.moveTo(-26, -19); c.lineTo(0, -42); c.lineTo(26, -19); c.closePath(); fillStroke(c, '#e0524a');
  for (const wx of [-16, 8]) {
    rr(c, wx, -17, 9, 8, 1); fillStroke(c, '#ffe08a', 2);
    c.strokeStyle = '#7a4b2a'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(wx - 1, -17); c.lineTo(wx + 10, -9); c.moveTo(wx - 1, -9); c.lineTo(wx + 10, -17); c.stroke();
  }
  rr(c, -6, -5, 12, 17, 2); fillStroke(c, '#7a4b2a');
  circle(c, 3, 4, 1.3); c.fillStyle = '#ffd93d'; c.fill();
  c.restore();
}

function entryPoint(p) {
  const s = p.segs[0];
  return { x: s.a.x + s.dx * 30, y: s.a.y + s.dy * 30, a: Math.atan2(s.dy, s.dx) };
}

function drawEntry(c, M, t) {
  for (const p of M.paths) {
    const e = entryPoint(p);
    c.save(); c.translate(e.x, e.y); c.rotate(e.a);
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.2 + i / 3) % 1;
      c.globalAlpha = Math.sin(k * Math.PI) * 0.8;
      const x = k * 40 - 16;
      c.beginPath(); c.moveTo(x - 6, -9); c.lineTo(x + 4, 0); c.lineTo(x - 6, 9);
      c.lineWidth = 5; c.strokeStyle = INK; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
      c.lineWidth = 2.5; c.strokeStyle = '#8ee05a'; c.stroke();
    }
    c.restore();
  }
}

// ============================================================
// Zombie drawing
// ============================================================
function ghostPath(c, r) {
  c.beginPath();
  c.moveTo(-r, r * 0.8);
  c.lineTo(-r, -r * 0.1);
  c.arc(0, -r * 0.1, r, Math.PI, 0);
  c.lineTo(r, r * 0.8);
  for (let i = 0; i < 4; i++) {
    const x0 = r - (i * r * 2) / 4;
    c.quadraticCurveTo(x0 - r * 0.25, r * (i % 2 ? 1.15 : 0.5), x0 - r * 0.5, r * 0.8);
  }
  c.closePath();
}

// A lopsided zombie face looking right: one big eye, one small, a toothy grin.
function zombieFace(c, x, y, ly, k, glow) {
  const big = 3 * k, small = 2 * k;
  circle(c, x + 3.6 * k, y, big); fillStroke(c, glow ? '#fff3a3' : '#ffffff', 1.6);
  circle(c, x - 2.8 * k, y + 0.6 * k, small); fillStroke(c, glow ? '#fff3a3' : '#ffffff', 1.6);
  c.fillStyle = INK;
  circle(c, x + 4.3 * k, y + ly * 1.1, big * 0.42); c.fill();
  circle(c, x - 2.4 * k, y + 0.6 * k + ly * 0.8, small * 0.48); c.fill();
  c.lineWidth = 1.6; c.strokeStyle = INK; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - 1.5 * k, y + 5.2 * k); c.quadraticCurveTo(x + 2 * k, y + 6.2 * k, x + 6 * k, y + 4.6 * k); c.stroke();
  c.fillStyle = '#ffffff';
  for (const tx of [0.8, 3.2]) { c.fillRect(x + tx * k, y + 5.3 * k, 1.6 * k, 1.7 * k); }
}

function drawHat(c, hat, col, t, headTop) {
  const y = headTop;
  switch (hat) {
    case 'cone':
      c.beginPath(); c.moveTo(-8, y + 3); c.lineTo(1, y - 14); c.lineTo(9, y + 3); c.closePath(); fillStroke(c, col('#ff8a3d'));
      c.beginPath(); c.moveTo(-4.4, y - 4); c.lineTo(6, y - 4); c.lineTo(4.6, y - 1); c.lineTo(-5.8, y - 1); c.closePath(); c.fillStyle = '#ffffff'; c.fill();
      rr(c, -10, y + 1, 21, 4, 2); fillStroke(c, col('#ff8a3d'), 2);
      break;
    case 'bucket':
      c.beginPath(); c.moveTo(-9, y + 5); c.lineTo(-7, y - 9); c.lineTo(8, y - 9); c.lineTo(10, y + 5); c.closePath(); fillStroke(c, col('#b0bec5'));
      rr(c, -10, y + 2, 21, 4, 2); fillStroke(c, col('#90a4ae'), 2);
      c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-2, y - 6); c.lineTo(0, y - 2); c.stroke();
      shine(c, -4, y - 4, 1.5, 3.5, 0.6);
      break;
    case 'miner':
      c.beginPath(); c.moveTo(-9, y + 4); c.quadraticCurveTo(-9, y - 8, 0, y - 8); c.quadraticCurveTo(9, y - 8, 9, y + 4); c.closePath();
      fillStroke(c, col('#ffd54f'));
      rr(c, -11, y + 2, 23, 3.5, 1.7); fillStroke(c, col('#ffca28'), 2);
      circle(c, 6, y - 3, 3); fillStroke(c, '#fff8c4', 2);
      break;
    case 'icicle':
      c.beginPath(); c.moveTo(-8, y + 3);
      for (let i = 0; i < 5; i++) { const x0 = -8 + i * 4; c.lineTo(x0 + 2, y - 7 - (i % 2) * 4); c.lineTo(x0 + 4, y + 3); }
      c.closePath(); fillStroke(c, '#d6f3ff', 2);
      break;
    case 'mirror':
      rr(c, -8, y + 2, 16, 3, 1.5); fillStroke(c, col('#90a4ae'), 1.5);
      circle(c, 2, y + 1, 3.8); fillStroke(c, '#e0f2f1', 2);
      shine(c, 1, y, 1.2, 1.2, 0.9);
      break;
    case 'hood':
      c.beginPath(); c.moveTo(-10, y + 14); c.quadraticCurveTo(-11, y - 6, 1, y - 6); c.quadraticCurveTo(12, y - 6, 10, y + 14);
      c.lineTo(7, y + 14); c.quadraticCurveTo(8, y, 1, y); c.quadraticCurveTo(-7, y, -7, y + 14); c.closePath();
      fillStroke(c, col('#5e35b1'));
      break;
  }
}

function drawCrown(c, y, k = 1) {
  c.beginPath();
  c.moveTo(-7 * k, y); c.lineTo(-8 * k, y - 8 * k); c.lineTo(-3.5 * k, y - 4 * k); c.lineTo(0, y - 10 * k);
  c.lineTo(3.5 * k, y - 4 * k); c.lineTo(8 * k, y - 8 * k); c.lineTo(7 * k, y); c.closePath();
  fillStroke(c, '#ffcf3f', 2.5);
  circle(c, 0, y - 3.5 * k, 1.8 * k); fillStroke(c, '#ff5d8f', 1.2);
}

function drawZombie(c, e, t) {
  const def = ZOMBIES[e.type], L = def.look;
  const r = e.r, s = r / 13;
  const slowed = e.slowT > 0 && !def.noSlow;
  const col = (h) => (e.flash > 0 ? '#ffffff' : slowed ? mix(h, '#a8e6ff', 0.45) : h);
  const feetY = e.y + r * 0.85;

  if (e.burrowed) {
    c.save(); c.translate(e.x, feetY);
    const wob = Math.sin(t * 14 + e.phase) * 1.5;
    ellipse(c, 0, -3, 12 * s, 6 * s + wob * 0.3); fillStroke(c, '#8d6e63', 2.5);
    c.fillStyle = '#6d4c41';
    for (const [x, y] of [[-5, -5], [3, -6], [6, -2]]) { circle(c, x * s, y * s, 1.6 * s); c.fill(); }
    c.restore();
    return;
  }

  const kind = L.kind || 'human';
  const walk = t * (def.speed > 70 ? 13 : 7.5) + e.phase;
  const floaty = kind === 'ghost';
  const bob = floaty ? 6 + Math.sin(t * 3 + e.phase) * 3 : Math.abs(Math.sin(walk)) * 1.6 * s;
  const wide = L.wide ? 1.3 : 1;
  c.fillStyle = 'rgba(43,33,64,.24)';
  ellipse(c, e.x, feetY, r * 0.8 * wide, r * 0.28); c.fill();

  c.save();
  c.translate(e.x, feetY - bob);
  c.scale(s * e.face, s);
  const ly = clamp(e.diry, -1, 1) * 0.8;
  if (floaty) c.globalAlpha = 0.88;

  if (kind === 'ghost') {
    c.save(); c.translate(0, -15);
    ghostPath(c, 12); fillStroke(c, col(L.skin));
    shine(c, -5, -7, 3, 2);
    zombieFace(c, 0, -3, ly, 1);
    c.restore();
    // wispy arms
    c.beginPath(); c.moveTo(6, -16); c.quadraticCurveTo(14, -18 + Math.sin(walk) * 2, 18, -14); c.quadraticCurveTo(13, -12, 6, -12);
    fillStroke(c, col(L.skin), 2.5);
  } else if (kind === 'round') {
    const lg = Math.sin(walk) * 2;
    rr(c, -7 + lg, -6, 5, 6, 2); fillStroke(c, col('#5d4037'), 2);
    rr(c, 2 - lg, -6, 5, 6, 2); fillStroke(c, col('#5d4037'), 2);
    circle(c, 0, -15, 13); fillStroke(c, col(L.skin));
    c.fillStyle = col('#7cb342');
    for (const [x, y, rr2] of [[-6, -18, 2.6], [5, -10, 2.2], [-2, -8, 1.6], [7, -20, 1.8]]) { circle(c, x, y, rr2); c.fill(); }
    shine(c, -5, -22, 4, 2.6);
    rr(c, 9, -18, 8, 4.5, 2.2); fillStroke(c, col(L.skin), 2.2);
    circle(c, 1, -30, 6); fillStroke(c, col(L.skin));
    zombieFace(c, 1, -31, ly, 0.75);
    if (L.crown) drawCrown(c, -35, 0.9);
  } else if (kind === 'yeti') {
    star(c, 0, -17, 17, 14, 16, walk * 0.02); fillStroke(c, col(L.skin));
    ellipse(c, 2, -21, 8, 7); fillStroke(c, col('#90a4c0'), 2.5);
    for (const sx of [-1, 1]) {
      c.beginPath(); c.moveTo(sx * 8, -31); c.quadraticCurveTo(sx * 14, -38, sx * 12, -44); c.quadraticCurveTo(sx * 10, -37, sx * 4, -33);
      fillStroke(c, '#e0d6c2', 2);
    }
    zombieFace(c, 1, -23, ly, 0.9, true);
    rr(c, 10, -20 + Math.sin(walk) * 1.5, 12, 6, 3); fillStroke(c, col(L.skin), 2.5);
    const lg = Math.sin(walk) * 2.5;
    rr(c, -9 + lg, -6, 7, 7, 3); fillStroke(c, col(L.skin), 2.5);
    rr(c, 2 - lg, -6, 7, 7, 3); fillStroke(c, col(L.skin), 2.5);
  } else {
    const skeleton = kind === 'skeleton';
    if (L.lean) c.rotate(L.lean);
    const tw = L.wide ? 10.5 : 8;
    const sw = Math.sin(walk);
    // legs
    if (!L.robe) {
      const lw = skeleton ? 3 : 5;
      rr(c, -5 + sw * 2.5, -10, lw, 10, 1.5); fillStroke(c, col(skeleton ? L.skin : L.pants), 2);
      rr(c, 0.5 - sw * 2.5, -10, lw, 10, 1.5); fillStroke(c, col(skeleton ? L.skin : L.pants), 2);
    }
    // back arm
    c.save(); c.translate(-1, -20); c.rotate(-0.18 + Math.sin(walk) * 0.09);
    rr(c, 0, -2.5, 12, skeleton ? 3.5 : 5, 2); fillStroke(c, col(L.skin), 2.2);
    c.restore();
    // torso (robe reaches the ground)
    c.beginPath();
    const bottom = L.robe ? 0 : -10;
    c.moveTo(-tw, bottom); c.lineTo(-tw, -21); c.quadraticCurveTo(-tw, -24, -tw + 3, -24);
    c.lineTo(tw - 3, -24); c.quadraticCurveTo(tw, -24, tw, -21); c.lineTo(L.robe ? tw + 2 : tw, bottom);
    if (L.robe) c.lineTo(-tw - 2, bottom);
    else {
      const step = (tw * 2) / 5;
      for (let i = 1; i <= 5; i++) c.lineTo(tw - i * step, bottom + (i % 2 ? 2.5 : 0));
    }
    c.closePath();
    if (skeleton) {
      c.strokeStyle = INK; c.lineWidth = 2;
      c.save(); c.globalAlpha *= 0.001; c.fillStyle = '#000'; c.fill(); c.restore();
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, -23); c.lineTo(0, -10); c.lineWidth = 4.5; c.strokeStyle = INK; c.stroke();
      c.lineWidth = 2.5; c.strokeStyle = col(L.skin); c.stroke();
      for (const ry of [-21, -17, -13]) {
        c.beginPath(); c.moveTo(-6, ry + 1.5); c.quadraticCurveTo(0, ry - 2, 6, ry + 1.5);
        c.lineWidth = 4.5; c.strokeStyle = INK; c.stroke(); c.lineWidth = 2.2; c.strokeStyle = col(L.skin); c.stroke();
      }
    } else {
      fillStroke(c, col(L.shirt));
      if (L.cross) {
        c.fillStyle = col('#ef5350');
        c.fillRect(-2.5, -20, 2.5, 7); c.fillRect(-4.75, -17.75, 7, 2.5);
      } else if (!L.robe) {
        rr(c, -tw + 2.5, -19, 5, 4.5, 1); c.fillStyle = 'rgba(255,255,255,.25)'; c.fill();
        c.strokeStyle = INK; c.lineWidth = 1;
        c.beginPath(); c.moveTo(-tw + 2.5, -16.5); c.lineTo(-tw + 7.5, -16.5); c.stroke();
      }
    }
    // head
    const headTop = -40;
    if (L.hat === 'pumpkin') {
      for (const [x, w] of [[-5, 7], [5, 7], [0, 8]]) { ellipse(c, x, -31, w, 8); fillStroke(c, col('#ff9f43')); }
      rr(c, -1.5, -42, 3, 5, 1); fillStroke(c, '#6d8b3a', 1.5);
      c.fillStyle = '#ffd93d';
      c.beginPath(); c.moveTo(-1, -34); c.lineTo(2, -30); c.lineTo(-4, -30); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(5, -34); c.lineTo(8, -30); c.lineTo(2.5, -30); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-4, -26.5); c.lineTo(8, -26.5); c.lineTo(6, -24); c.lineTo(-2, -24); c.closePath(); c.fill();
      drawCrown(c, -40, 0.85);
    } else {
      rr(c, -9, headTop, 18, 16, 6); fillStroke(c, col(L.skin), 2.6);
      shine(c, -4.5, headTop + 4, 2.4, 1.5, 0.45);
      if (skeleton) {
        c.fillStyle = INK;
        circle(c, 3.6, -33, 2.8); c.fill(); circle(c, -2.6, -32.6, 2.2); c.fill();
        c.fillStyle = '#ff5d5d'; circle(c, 4, -32.8, 0.9); c.fill();
        c.strokeStyle = INK; c.lineWidth = 1.3;
        c.beginPath(); c.moveTo(-3, -27.5); c.lineTo(6, -27.5);
        for (let i = 0; i < 4; i++) { c.moveTo(-2 + i * 2.4, -28.8); c.lineTo(-2 + i * 2.4, -26.2); }
        c.stroke();
      } else {
        zombieFace(c, 0, -33.5, ly, 1);
        c.strokeStyle = INK; c.lineWidth = 1.1;
        c.beginPath(); c.moveTo(-7, -37); c.lineTo(-2.5, -38);
        for (const sx of [-6, -4.5, -3]) { c.moveTo(sx, -38.5); c.lineTo(sx + 0.4, -36.5); }
        c.stroke();
        if (!L.hat) {
          c.lineWidth = 2; c.lineCap = 'round';
          c.beginPath(); c.moveTo(-3, -40); c.lineTo(-4.5, -43.5); c.moveTo(0.5, -40); c.lineTo(0.5, -44.5); c.moveTo(3.5, -40); c.lineTo(5, -43); c.stroke();
        }
      }
      if (L.hat) drawHat(c, L.hat, col, t, headTop);
      if (L.crown) drawCrown(c, headTop - 4, 0.9);
    }
    // front arm
    c.save(); c.translate(1, -19); c.rotate(-0.06 + Math.sin(walk + 1.2) * 0.09);
    rr(c, 0, -2.5, 13, skeleton ? 3.5 : 5, 2); fillStroke(c, col(L.skin), 2.2);
    circle(c, 13.5, 0, skeleton ? 2 : 2.8); fillStroke(c, col(L.skin), 2);
    c.restore();
    if (L.staff) {
      c.strokeStyle = INK; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(14, -4); c.lineTo(14, -34); c.stroke();
      c.strokeStyle = '#8d6e63'; c.lineWidth = 2; c.stroke();
      c.save(); c.globalAlpha *= 0.4 + Math.sin(t * 5) * 0.2;
      circle(c, 14, -37, 7); c.fillStyle = '#c6ff5e'; c.fill();
      c.restore();
      circle(c, 14, -37, 3.8); fillStroke(c, '#c6ff5e', 2);
    }
  }
  if (e.burnT > 0) {
    for (let i = 0; i < 3; i++) {
      const fx = -6 + i * 6, h = 6 + Math.sin(t * 22 + i * 2 + e.phase) * 2.5;
      c.beginPath(); c.moveTo(fx - 3, -14); c.quadraticCurveTo(fx - 2, -14 - h, fx, -16 - h * 1.4); c.quadraticCurveTo(fx + 2, -14 - h, fx + 3, -14); c.closePath();
      c.fillStyle = i === 1 ? '#ffd93d' : '#ff7a3d'; c.fill();
    }
  }
  c.restore();

  if (e.hp < e.maxHp && e.maxHp) {
    const bw = Math.max(22, r * 1.8), by = feetY - bob - 46 * s - (def.boss ? 10 : 2);
    rr(c, e.x - bw / 2, by, bw, 6, 3); c.fillStyle = INK; c.fill();
    const k = clamp(e.hp / e.maxHp, 0, 1);
    if (k > 0) {
      rr(c, e.x - bw / 2 + 1.5, by + 1.5, (bw - 3) * k, 3, 1.5);
      c.fillStyle = k > 0.5 ? '#7ed957' : k > 0.25 ? '#ffcf3f' : '#ff5d5d'; c.fill();
    }
  }
}

// ============================================================
// Tower drawing
// ============================================================
function drawTower(c, type, level, x, y, angle, recoil, t, opts = {}) {
  c.save();
  c.translate(x, y);
  if (opts.alpha != null) c.globalAlpha = opts.alpha;
  const lx = Math.cos(angle), ly = Math.sin(angle);
  const maxed = level === 3;
  c.fillStyle = 'rgba(43,33,64,.2)'; ellipse(c, 0, 17, 21, 6); c.fill();
  rr(c, -19, -4, 38, 22, 9); fillStroke(c, maxed ? '#e6b94a' : '#bdb4cf');
  rr(c, -19, -9, 38, 19, 9); fillStroke(c, maxed ? '#ffd76a' : '#e7e0f1');
  for (let i = 0; i < level; i++) {
    star(c, -8 + i * 8, 13, 3.6, 1.6); fillStroke(c, '#ffcf3f', 1.2);
  }
  c.translate(0, -8);
  const kick = recoil * 5;

  if (type === 'pebble') {
    const barrels = level === 3 ? [-4, 4] : [0];
    c.save(); c.rotate(angle);
    for (const o of barrels) { rr(c, 2 - kick, o - 4, 19, 8, 3); fillStroke(c, '#8a5a2b', 2.5); }
    c.restore();
    circle(c, 0, -2, 13); fillStroke(c, '#ff9f43');
    c.beginPath(); c.moveTo(-6, -14); c.quadraticCurveTo(-2, -22, 3, -15); fillStroke(c, '#7ed957', 2);
    shine(c, -5, -8, 4, 2.6);
    eyes(c, lx * 3, -4 + ly * 2, 5, 3.6, lx, ly);
  } else if (type === 'cannon') {
    c.save(); c.rotate(angle);
    rr(c, 0 - kick, -6.5, 22, 13, 4); fillStroke(c, '#3d405b');
    rr(c, 16 - kick, -8, 7, 16, 3); fillStroke(c, '#555a85', 2.5);
    c.restore();
    circle(c, 0, -2, 14); fillStroke(c, '#5b5f97');
    shine(c, -5, -8, 4.5, 3);
    c.strokeStyle = INK; c.lineWidth = 2;
    c.beginPath(); c.moveTo(4, -15); c.quadraticCurveTo(8, -21, 6, -24); c.stroke();
    const flick = 2 + Math.sin(t * 30) * 1;
    star(c, 6, -25, 4 + flick * 0.5, 2, 6, t * 5); fillStroke(c, '#ffcf3f', 1.2);
    eyes(c, lx * 3, -3 + ly * 2, 5, 3.4, lx, ly, 'angry');
  } else if (type === 'frost') {
    c.save(); c.rotate(angle);
    c.beginPath(); c.moveTo(4 - kick, -6); c.lineTo(22 - kick, 0); c.lineTo(4 - kick, 6); c.closePath();
    fillStroke(c, '#c9f1ff', 2.5);
    c.restore();
    c.beginPath(); c.arc(0, 0, 14, Math.PI, 0); c.lineTo(14, 6); c.quadraticCurveTo(0, 10, -14, 6); c.closePath();
    fillStroke(c, '#7fd8ff');
    c.beginPath(); c.arc(0, -1, 14, Math.PI * 1.05, -Math.PI * 0.05);
    c.quadraticCurveTo(10, -6, 6, -8); c.quadraticCurveTo(3, -4, 0, -8); c.quadraticCurveTo(-4, -4, -7, -8); c.quadraticCurveTo(-11, -5, -13.5, -4);
    c.closePath(); c.fillStyle = '#ffffff'; c.fill();
    c.beginPath(); c.arc(0, 0, 14, Math.PI, 0); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    eyes(c, lx * 2.5, 0 + ly * 1.5, 4.8, 3.2, lx, ly);
    c.save(); c.translate(0, -18); c.rotate(t * 0.8);
    c.strokeStyle = '#ffffff'; c.lineWidth = 2;
    for (let i = 0; i < 3; i++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(-5, 0); c.lineTo(5, 0); c.stroke(); }
    c.restore();
  } else if (type === 'torch') {
    c.save(); c.rotate(angle);
    rr(c, 4 - kick, -4, 18, 8, 3); fillStroke(c, '#5d5f73', 2.5);
    rr(c, 18 - kick, -5.5, 5, 11, 2); fillStroke(c, '#8a8ca3', 2);
    c.restore();
    rr(c, -11, -14, 22, 22, 9); fillStroke(c, '#ff6b4a');
    c.fillStyle = 'rgba(255,255,255,.35)'; rr(c, -8, -11, 4, 14, 2); c.fill();
    const fl = 1 + Math.sin(t * 20) * 0.12 + recoil * 0.35;
    c.save(); c.translate(0, -15); c.scale(fl, fl);
    c.beginPath(); c.moveTo(0, -11); c.quadraticCurveTo(7, -3, 4, 2); c.quadraticCurveTo(0, 4, -4, 2); c.quadraticCurveTo(-7, -3, 0, -11);
    fillStroke(c, '#ffb347', 2);
    c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(3, -1, 2, 1.5); c.quadraticCurveTo(0, 2.5, -2, 1.5); c.quadraticCurveTo(-3, -1, 0, -6);
    c.fillStyle = '#fff3a3'; c.fill();
    c.restore();
    eyes(c, lx * 2.5, -3 + ly * 1.5, 4.8, 3.2, lx, ly);
  } else if (type === 'zap') {
    rr(c, -9, -6, 18, 14, 4); fillStroke(c, '#c77d36');
    for (let i = 0; i < 3; i++) { rr(c, -11 + i, -12 - i * 6, 22 - i * 2, 6, 3); fillStroke(c, '#e09f3e', 2.5); }
    c.strokeStyle = INK; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(0, -24); c.lineTo(0, -28); c.stroke();
    const glow = 0.6 + Math.sin(t * 8) * 0.25 + recoil * 0.6;
    c.save(); c.globalAlpha *= clamp(glow * 0.5, 0, 1);
    circle(c, 0, -33, 12 + recoil * 4); c.fillStyle = '#fff3a3'; c.fill();
    c.restore();
    circle(c, 0, -33, 7); fillStroke(c, '#ffe066', 2.5);
    shine(c, -2, -35, 2.4, 1.6, 0.8);
    eyes(c, 0, -1, 4, 2.8, lx, ly);
    if (Math.sin(t * 13 + x) > 0.6 || recoil > 0.3) {
      c.strokeStyle = '#7df9ff'; c.lineWidth = 2;
      const a = (t * 7) % TAU;
      c.beginPath(); c.moveTo(Math.cos(a) * 8, -33 + Math.sin(a) * 8);
      c.lineTo(Math.cos(a) * 12 + 2, -33 + Math.sin(a) * 12 - 2);
      c.lineTo(Math.cos(a) * 15, -33 + Math.sin(a) * 15); c.stroke();
    }
  } else if (type === 'owl') {
    c.save(); c.rotate(angle);
    rr(c, 0 - kick, 1, 30, 5, 2.5); fillStroke(c, '#3d405b', 2.5);
    rr(c, 10 - kick, -3, 8, 5, 2); fillStroke(c, '#555a85', 2);
    c.restore();
    c.beginPath(); c.moveTo(-10, -12); c.lineTo(-12, -22); c.lineTo(-3, -15); c.closePath(); fillStroke(c, '#7a5230', 2.5);
    c.beginPath(); c.moveTo(10, -12); c.lineTo(12, -22); c.lineTo(3, -15); c.closePath(); fillStroke(c, '#7a5230', 2.5);
    ellipse(c, 0, -2, 13, 15); fillStroke(c, '#a0703f');
    ellipse(c, 0, 4, 8, 8); c.fillStyle = '#e6c49a'; c.fill();
    for (const s of [-1, 1]) { circle(c, s * 5.5, -6, 6); fillStroke(c, '#ffb347', 2); }
    eyes(c, 0, -6, 5.5, 4, lx, ly);
    c.beginPath(); c.moveTo(-2.5, -1); c.lineTo(2.5, -1); c.lineTo(0, 3.5); c.closePath(); fillStroke(c, '#ffcf3f', 1.5);
  }
  c.restore();
}

// ============================================================
// Sound (tiny WebAudio synth)
// ============================================================
const Sound = {
  ac: null, master: null, noiseBuf: null, muted: false, last: {},
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ac.destination);
      const len = this.ac.sampleRate * 0.5;
      this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ac = null; }
  },
  tone(f, dur, type = 'square', vol = 0.2, slide = null, delay = 0) {
    const ac = this.ac, t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  noise(dur, vol = 0.3, freq = 800, delay = 0) {
    const ac = this.ac, t0 = ac.currentTime + delay;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = this.noiseBuf;
    f.type = 'lowpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  },
  play(name) {
    if (!this.ac || this.muted) return;
    const now = performance.now();
    const gap = { pebble: 60, pop: 45, frost: 80, zap: 80, boom: 90, owl: 80, launch: 90, flame: 140, summon: 300, heal: 300, groan: 600 }[name] || 30;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    switch (name) {
      case 'pebble': this.tone(900, 0.05, 'square', 0.035, 1300); break;
      case 'launch': this.tone(320, 0.12, 'triangle', 0.08, 160); break;
      case 'boom': this.noise(0.35, 0.3, 600); this.tone(130, 0.3, 'sine', 0.3, 40); break;
      case 'frost': this.tone(1500, 0.12, 'sine', 0.06, 700); break;
      case 'flame': this.noise(0.18, 0.07, 1400); break;
      case 'zap': this.noise(0.1, 0.1, 4000); this.tone(500, 0.1, 'sawtooth', 0.05, 1800); break;
      case 'owl': this.noise(0.08, 0.15, 2500); this.tone(1100, 0.06, 'square', 0.06, 220); break;
      case 'pop': this.tone(260 + Math.random() * 120, 0.1, 'triangle', 0.13, 120); break;
      case 'groan': this.tone(150, 0.5, 'sawtooth', 0.06, 95); this.tone(110, 0.5, 'sine', 0.08, 80, 0.08); break;
      case 'summon': this.tone(220, 0.25, 'triangle', 0.08, 660); break;
      case 'heal': this.tone(660, 0.12, 'sine', 0.06, 990); break;
      case 'stomp': this.noise(0.4, 0.35, 300); this.tone(70, 0.4, 'sine', 0.35, 35); break;
      case 'dig': this.noise(0.15, 0.12, 500); break;
      case 'leak': this.tone(330, 0.3, 'sawtooth', 0.1, 90); break;
      case 'place': this.tone(520, 0.08, 'triangle', 0.15); this.tone(780, 0.1, 'triangle', 0.15, null, 0.07); break;
      case 'upgrade': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.13, null, i * 0.06)); break;
      case 'sell': this.tone(780, 0.12, 'triangle', 0.12, 360); break;
      case 'wave': [392, 523, 659].forEach((f, i) => this.tone(f, 0.12, 'square', 0.06, null, i * 0.11)); break;
      case 'boss': this.tone(110, 0.6, 'sawtooth', 0.12, 70); this.tone(98, 0.6, 'sawtooth', 0.1, 60, 0.35); break;
      case 'error': this.tone(170, 0.12, 'square', 0.08); break;
      case 'click': this.tone(660, 0.04, 'triangle', 0.08); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.14, null, i * 0.2)); break;
      case 'win': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'square', 0.08, null, i * 0.12)); break;
      case 'coin': this.tone(990, 0.06, 'square', 0.06); this.tone(1320, 0.12, 'square', 0.06, null, 0.06); break;
    }
  },
};

// ============================================================
// Game state
// ============================================================
const S = {
  state: 'title', L: null, M: null, levelIndex: 0, worldTab: 0,
  lives: 0, gold: 0, wave: 0,
  towers: [], enemies: [], projectiles: [], fx: [], decals: [], spawners: [],
  towerAt: new Map(),
  speed: 1, paused: false, auto: false, autoT: 0,
  placing: null, selected: null, pending: null, dirty: false,
  hover: { x: 0, y: 0, col: -1, row: -1, inside: false, mouse: true },
  time: 0, anim: 0, shake: 0, castleHit: 0, banner: null, leakFlash: 0,
};

// ============================================================
// Canvas sizing
// ============================================================
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const stage = $('#stage');
const bg = document.createElement('canvas');
const bgx = bg.getContext('2d');
let scale = 1;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const frame = canvas.offsetWidth - canvas.clientWidth; // left + right border
  const availW = stage.clientWidth - frame;
  let availH = Infinity;
  if (getComputedStyle($('.layout')).flexDirection === 'row') {
    // Panel sits beside the playfield, so fit the playfield to the screen height.
    const top = stage.getBoundingClientRect().top + window.scrollY;
    const padB = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
    availH = window.innerHeight - top - padB - frame - 8;
  }
  const cssW = Math.max(240, Math.floor(Math.min(availW, (availH * W) / H)));
  const cssH = Math.round((cssW * H) / W);
  document.documentElement.style.setProperty('--panel-h', cssH + frame + 'px');
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  scale = canvas.width / W;
  bg.width = canvas.width; bg.height = canvas.height;
  if (S.M) renderBackground(bgx, S.M, scale);
}

// ============================================================
// Game flow
// ============================================================
function startGame(levelIndex, save) {
  const L = LEVELS[levelIndex];
  S.levelIndex = levelIndex;
  S.worldTab = L.world;
  S.L = L;
  S.M = buildLevel(L);
  S.lives = 20; S.gold = L.gold; S.wave = 0;
  S.towers = []; S.enemies = []; S.projectiles = []; S.fx = []; S.decals = []; S.spawners = [];
  S.towerAt = new Map();
  S.paused = false; S.autoT = 0;
  S.placing = null; S.selected = null; S.pending = null;
  S.time = 0; S.shake = 0; S.castleHit = 0; S.banner = null; S.leakFlash = 0;
  S.state = 'playing';
  setPaused(false);
  for (const b of document.querySelectorAll('.tower-btn')) b.classList.remove('active');
  $('#title-screen').hidden = true;
  $('#end-screen').hidden = true;
  $('#pause-screen').hidden = true;
  setText('#level-tag', `Level ${L.id}`);
  resize();
  if (save) applySave(save);
  else showBanner(`${L.id} ${L.name}`, `${WORLDS[L.world].name} · ${L.waves} waves`);
  checkpoint();
  renderInfo(); renderNextWave(); updateHUD(true);
}

// ---------- save & resume (checkpoints are taken between waves) ----------
function checkpoint() {
  if (S.state !== 'playing' || S.spawners.length || S.enemies.length) return;
  S.dirty = false;
  store.set(SAVE_KEY, JSON.stringify({
    v: 2, level: S.L.id, lives: S.lives, gold: S.gold, wave: S.wave,
    towers: S.towers.map((t) => ({ type: t.type, col: t.col, row: t.row, level: t.level, spent: t.spent, mode: t.mode, kills: t.kills, dealt: Math.round(t.dealt) })),
  }));
}

function loadSave() {
  try {
    const sv = JSON.parse(store.get(SAVE_KEY));
    const i = sv ? LEVELS.findIndex((L) => L.id === sv.level) : -1;
    if (sv && sv.v === 2 && i >= 0 && Array.isArray(sv.towers) && sv.lives > 0 && sv.wave < LEVELS[i].waves) { sv.index = i; return sv; }
  } catch (e) { /* corrupt save */ }
  return null;
}

function applySave(sv) {
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  S.lives = num(sv.lives, S.lives);
  S.gold = num(sv.gold, S.gold);
  S.wave = clamp(num(sv.wave, 0), 0, S.L.waves - 1);
  for (const t of sv.towers) {
    if (!TOWERS[t.type] || !canPlace(t.col, t.row)) continue;
    const tw = makeTower(t.type, t.col, t.row);
    tw.level = clamp(t.level | 0, 0, TOWERS[t.type].levels.length - 1);
    tw.spent = num(t.spent, TOWERS[t.type].cost);
    if (MODES.some((m) => m[0] === t.mode)) tw.mode = t.mode;
    tw.kills = num(t.kills, 0); tw.dealt = num(t.dealt, 0);
  }
  showBanner('Welcome back!', `Wave ${S.wave + 1} is up next`);
}

function startWave() {
  if (S.state !== 'playing' || S.paused) return;
  if (S.wave >= S.L.waves) return;
  const early = S.spawners.length > 0 || S.enemies.length > 0;
  S.wave++;
  S.spawners.push(makeSpawner(S.wave));
  if (early) {
    const b = 5 + S.wave;
    S.gold += b;
    floatText(`Early call +${b}`, W / 2, 90, '#ffcf3f', 22);
    Sound.play('coin');
  }
  const fresh = newTypes(S.L, S.wave);
  const boss = S.L.boss && S.wave === S.L.waves;
  const last = S.wave === S.L.waves;
  let sub = null;
  if (boss) sub = `${ZOMBIES[S.L.boss].name} is coming!`;
  else if (fresh.length) sub = `New zombie: ${fresh.map((t) => ZOMBIES[t].name).join(' & ')}!`;
  else if (last) sub = 'Final wave!';
  showBanner(`Wave ${S.wave}`, sub);
  Sound.play(boss ? 'boss' : 'wave');
  if (fresh.length || boss) Sound.play('groan');
  renderNextWave(); updateHUD(true);
}

function makeSpawner(n) {
  const queue = [];
  let t = 0;
  for (const grp of makeWave(S.L, n)) {
    t += grp.delay;
    for (let i = 0; i < grp.count; i++) { queue.push({ t, type: grp.type }); t += grp.gap; }
  }
  return { wave: n, queue, time: 0, done: false, n: 0 };
}

function gameOver() {
  S.state = 'over';
  S.placing = null; S.pending = null;
  store.remove(SAVE_KEY);
  Sound.play('lose');
  buzz([80, 60, 160]);
  showEnd(false, 'The zombies got in!', `They broke into the safehouse on wave ${S.wave} of ${S.L.waves}. Build up earlier and try a different mix of towers.`, 0);
}

function victory() {
  S.state = 'won';
  S.placing = null; S.pending = null;
  store.remove(SAVE_KEY);
  const stars = starsFromLives(S.lives);
  recordStars(S.L, stars);
  Sound.play('win');
  for (let i = 0; i < 60; i++) burstStar(rand(0, W), rand(0, H * 0.5), ['#ffcf3f', '#ff5d8f', '#7ed957', '#7fd8ff'][i % 4]);
  const next = LEVELS[S.levelIndex + 1];
  const nextWorld = next && next.world !== S.L.world;
  const text = !next ? 'You cleared every world. The zombies are toast! Replay levels to collect all the stars.'
    : nextWorld ? `World unlocked: ${WORLDS[next.world].name}! New zombies are waiting there.`
    : `You kept ${S.lives} of 20 brains. Next up: ${next.id} ${next.name}.`;
  showEnd(true, 'Level cleared!', text, stars);
}

function showEnd(won, title, text, stars) {
  $('#end-title').textContent = title;
  $('#end-text').textContent = text;
  $('.dialog-end').classList.toggle('won', won);
  const st = $('#end-stars');
  st.hidden = !won;
  st.innerHTML = [1, 2, 3].map((i) => `<span class="big-star${i <= stars ? ' on' : ''}">★</span>`).join('');
  st.setAttribute('aria-label', `${stars} of 3 stars`);
  const next = LEVELS[S.levelIndex + 1];
  $('#btn-next').hidden = !won || !next;
  $('#btn-retry').textContent = won ? 'Replay' : 'Try again';
  $('#end-screen').hidden = false;
  renderInfo();
}

function setPaused(p) {
  if (S.state !== 'playing') p = false;
  S.paused = p;
  $('#pause-screen').hidden = !p;
  $('#btn-pause').textContent = p ? 'Resume' : 'Pause';
}

// ============================================================
// Entities
// ============================================================
function spawnEnemy(type, wave, path, d = 0) {
  const def = ZOMBIES[type];
  const e = effWave(S.L, wave);
  const mul = hpScale(e);
  const z = {
    type, wave, path, hpMul: mul,
    hp: def.hp * mul, maxHp: def.hp * mul,
    speed: def.speed * (1 + Math.min(0.25, (e - 1) * 0.006)),
    armor: def.armor ? def.armor + Math.floor(e / 8) : 0,
    reward: Math.round(def.reward * (1 + (e - 1) * 0.05)),
    r: def.r, d, x: -40, y: 0, dirx: 1, diry: 0, face: 1,
    cur: def.speed, slowT: 0, slowF: 0, burnT: 0, burnDps: 0, burnSrc: null, flash: 0,
    phase: Math.random() * TAU, dead: false, burrowed: false,
    sumCd: def.summon ? def.summon.every * 0.6 : 0, healCd: def.heal ? def.heal.every : 0, stompCd: def.stomp ? def.stomp.every * 0.5 : 0,
  };
  placeOnPath(z);
  S.enemies.push(z);
  return z;
}

function placeOnPath(e) {
  const P = S.M.paths[e.path];
  const p = pointOn(P, e.d);
  e.x = p.x; e.y = p.y; e.dirx = p.dx; e.diry = p.dy;
  if (Math.abs(p.dx) > 0.1) e.face = p.dx > 0 ? 1 : -1;
  const b = ZOMBIES[e.type].burrow;
  if (b) {
    const was = e.burrowed;
    const k = e.d / P.total;
    e.burrowed = k >= b[0] && k < b[1];
    if (was && !e.burrowed) {
      for (let i = 0; i < 8; i++) {
        const a = rand(0, TAU);
        S.fx.push({ kind: 'dirt', x: e.x, y: e.y + 6, vx: Math.cos(a) * 80, vy: -rand(60, 160), r: rand(2, 4), life: 0.6, max: 0.6 });
      }
      Sound.play('dig');
    }
  }
}

const onField = (e) => e.x > 2 && e.y > 2 && e.x < W - 2 && e.y < H - 2;
const targetable = (e) => !e.dead && !e.burrowed && onField(e);

function updateEnemy(e, dt) {
  const def = ZOMBIES[e.type];
  if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowF = 0; }
  e.flash = Math.max(0, e.flash - dt);
  if (e.burnT > 0) {
    e.burnT -= dt;
    damage(e, e.burnDps * dt, e.burnSrc, 1, true);
    if (e.dead) return;
  }
  e.cur = e.speed * (1 - e.slowF) * (e.burrowed ? 1.2 : 1);
  e.d += e.cur * dt;
  if (e.d >= S.M.paths[e.path].total) {
    e.dead = true;
    const lost = def.lives || 1;
    S.lives = Math.max(0, S.lives - lost);
    S.castleHit = 0.5; S.leakFlash = 0.4;
    addShake(lost > 2 ? 10 : 4);
    floatText(`-${lost} brain${lost === 1 ? '' : 's'}`, S.M.end.x, S.M.end.y - 54, '#ff8fb8', 20);
    Sound.play('leak');
    buzz(40);
    bumpStat('.stat-lives');
    return;
  }
  placeOnPath(e);
  if (!onField(e) || e.burrowed) return;

  if (def.summon && (e.sumCd -= dt) <= 0) {
    e.sumCd = def.summon.every;
    if (e.d > 40) {
      for (let i = 0; i < def.summon.n; i++) spawnEnemy(def.summon.type, e.wave, e.path, Math.max(0, e.d - 10 - i * 12));
      for (let i = 0; i < 8; i++) {
        const a = rand(0, TAU);
        S.fx.push({ kind: 'dust', x: e.x + Math.cos(a) * 12, y: e.y + 8, vx: Math.cos(a) * 50, vy: -30, r: rand(4, 7), life: 0.5, max: 0.5, color: '#c9b6ff' });
      }
      Sound.play('summon');
    }
  }
  if (def.heal && (e.healCd -= dt) <= 0) {
    e.healCd = def.heal.every;
    const r2 = (def.heal.radius * TILE) ** 2;
    for (const z of S.enemies) {
      if (z.dead || z.hp >= z.maxHp || dist2(z.x, z.y, e.x, e.y) > r2) continue;
      z.hp = Math.min(z.maxHp, z.hp + z.maxHp * def.heal.pct);
      S.fx.push({ kind: 'text', text: '+', x: z.x + rand(-6, 6), y: z.y - z.r * 2, vy: -40, color: '#7ed957', size: 18, life: 0.7, max: 0.7 });
    }
    S.fx.push({ kind: 'ring', x: e.x, y: e.y, r: def.heal.radius * TILE * 0.5, life: 0.5, max: 0.5, color: '#7ed957' });
    Sound.play('heal');
  }
  if (def.stomp && (e.stompCd -= dt) <= 0) {
    e.stompCd = def.stomp.every;
    const r2 = (def.stomp.radius * TILE) ** 2;
    let hit = 0;
    for (const t of S.towers) if (dist2(t.x, t.y, e.x, e.y) <= r2) { t.stun = def.stomp.dur; hit++; }
    S.fx.push({ kind: 'ring', x: e.x, y: e.y + e.r * 0.8, r: def.stomp.radius * TILE * 0.45, life: 0.6, max: 0.6, color: '#bfefff' });
    if (hit) floatText('Frozen!', e.x, e.y - e.r * 3, '#bfefff', 20);
    addShake(7);
    Sound.play('stomp');
  }
}

function damage(e, amount, tower, pierce = 0, quiet = false) {
  if (e.dead) return;
  const armor = e.armor * (1 - pierce);
  const dmg = Math.max(amount * 0.2, amount - armor);
  e.hp -= dmg;
  if (!quiet) e.flash = 0.07;
  if (tower) tower.dealt += dmg;
  if (e.hp <= 0) kill(e, tower);
}

function kill(e, tower) {
  e.dead = true;
  const def = ZOMBIES[e.type];
  const skin = def.look.skin;
  S.gold += e.reward;
  floatText(`+${e.reward}`, e.x, e.y - e.r * 2.2, '#ffcf3f', def.boss ? 26 : 16);
  for (let i = 0; i < (def.boss ? 26 : 8); i++) {
    const a = rand(0, TAU), sp = rand(40, def.boss ? 260 : 130);
    S.fx.push({ kind: 'blob', x: e.x, y: e.y - e.r * 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, r: rand(2.5, def.boss ? 8 : 5), color: i % 3 ? skin : '#8ee05a', life: 0.5, max: 0.5 });
  }
  S.fx.push({ kind: 'ring', x: e.x, y: e.y, r: e.r, life: 0.3, max: 0.3, color: '#fff' });
  S.decals.push({ x: e.x, y: e.y + e.r * 0.6, r: e.r * 1.1, color: def.look.kind === 'skeleton' ? '#d8d2c0' : '#7cb342', life: 5, max: 5, seed: Math.random() * 100 });
  if (S.decals.length > 70) S.decals.shift();
  if (tower) tower.kills++;
  Sound.play('pop');
  if (def.splits) {
    for (let i = 0; i < def.splits.n; i++) spawnEnemy(def.splits.type, e.wave, e.path, Math.max(0, e.d - 4 - i * 12));
  }
  if (def.boss) {
    addShake(14);
    for (let i = 0; i < 30; i++) burstStar(e.x, e.y, ['#ffcf3f', '#ff5d8f', '#7fd8ff'][i % 3]);
    floatText(`${def.name.toUpperCase()} BONKED!`, e.x, e.y - 50, '#ffcf3f', 28);
  }
  bumpStat('.stat-gold');
}

function makeTower(type, col, row) {
  const t = {
    type, col, row, x: col * TILE + TILE / 2, y: row * TILE + TILE / 2,
    level: 0, angle: -Math.PI / 2, cd: 0.2, recoil: 0, spent: TOWERS[type].cost, stun: 0,
    mode: type === 'owl' ? 'strong' : 'first', kills: 0, dealt: 0, pop: 0.35,
  };
  S.towers.push(t);
  S.towerAt.set(row * COLS + col, t);
  return t;
}

function placeTower(type, col, row) {
  const t = makeTower(type, col, row);
  S.gold -= TOWERS[type].cost;
  S.dirty = true;
  buzz(12);
  for (let i = 0; i < 10; i++) {
    const a = rand(0, TAU);
    S.fx.push({ kind: 'dust', x: t.x + Math.cos(a) * 14, y: t.y + 10 + Math.sin(a) * 6, vx: Math.cos(a) * 60, vy: Math.sin(a) * 25 - 10, r: rand(4, 7), life: 0.45, max: 0.45 });
  }
  Sound.play('place');
  return t;
}

function upgradeTower(t) {
  const def = TOWERS[t.type];
  const next = def.levels[t.level + 1];
  if (!next || S.gold < next.cost || S.state !== 'playing') { Sound.play('error'); return; }
  S.gold -= next.cost;
  t.spent += next.cost;
  t.level++;
  S.dirty = true;
  t.pop = 0.4;
  for (let i = 0; i < 14; i++) burstStar(t.x, t.y - 10, '#ffcf3f');
  floatText('Level up!', t.x, t.y - 34, '#7ed957', 18);
  Sound.play('upgrade');
  renderInfo(); updateHUD(true);
}

function sellTower(t) {
  if (S.state !== 'playing') return;
  const refund = sellValue(t);
  S.gold += refund;
  S.dirty = true;
  S.towers = S.towers.filter((o) => o !== t);
  S.towerAt.delete(t.row * COLS + t.col);
  floatText(`+${refund}`, t.x, t.y - 20, '#ffcf3f', 18);
  for (let i = 0; i < 10; i++) {
    const a = rand(0, TAU);
    S.fx.push({ kind: 'dust', x: t.x, y: t.y, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, r: rand(4, 8), life: 0.5, max: 0.5 });
  }
  if (S.selected === t) S.selected = null;
  Sound.play('sell');
  renderInfo(); updateHUD(true);
}

const sellValue = (t) => Math.floor(t.spent * 0.7);

function findTarget(t, range) {
  let best = null, bestV = -Infinity;
  const r2 = range * range;
  for (const e of S.enemies) {
    if (!targetable(e)) continue;
    const d2 = dist2(e.x, e.y, t.x, t.y - 8);
    if (d2 > r2) continue;
    let v;
    switch (t.mode) {
      case 'last': v = -e.d; break;
      case 'strong': v = e.hp + e.d * 1e-4; break;
      case 'close': v = -d2; break;
      default: v = e.d;
    }
    if (v > bestV) { bestV = v; best = e; }
  }
  return best;
}

function turnToward(a, target, k) {
  let d = target - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * Math.min(1, k);
}

function updateTower(t, dt) {
  const st = TOWERS[t.type].levels[t.level];
  t.recoil = Math.max(0, t.recoil - dt * 5);
  t.pop = Math.max(0, t.pop - dt);
  if (t.stun > 0) { t.stun -= dt; return; }
  t.cd -= dt;
  const target = findTarget(t, st.range * TILE);
  if (!target) return;
  const desired = Math.atan2(target.y - (t.y - 8), target.x - t.x);
  t.angle = turnToward(t.angle, desired, dt * 16);
  if (t.cd <= 0) {
    fire(t, target, st);
    t.cd = st.rate;
    t.recoil = 1;
  }
}

function muzzle(t, len) {
  return { x: t.x + Math.cos(t.angle) * len, y: t.y - 8 + Math.sin(t.angle) * len };
}

function splashAt(x, y, radius, fn) {
  for (const e of S.enemies) {
    if (!targetable(e)) continue;
    if (dist2(e.x, e.y, x, y) <= (radius + e.r * 0.5) ** 2) fn(e);
  }
}

function fire(t, target, st) {
  switch (t.type) {
    case 'pebble': {
      const offs = st.twin ? [-4, 4] : [0];
      for (const o of offs) {
        const m = muzzle(t, 20);
        const px = -Math.sin(t.angle) * o, py = Math.cos(t.angle) * o;
        S.projectiles.push({ kind: 'pebble', x: m.x + px, y: m.y + py, target, tx: target.x, ty: target.y, speed: 560, dmg: st.dmg, tower: t });
      }
      Sound.play('pebble');
      break;
    }
    case 'cannon': {
      const dur = 0.6;
      const lead = pointOn(S.M.paths[target.path], target.d + target.cur * dur);
      const m = muzzle(t, 22);
      S.projectiles.push({ kind: 'bomb', sx: m.x, sy: m.y, ex: lead.x, ey: lead.y, x: m.x, y: m.y, h: 0, t: 0, dur, dmg: st.dmg, splash: st.splash * TILE, tower: t });
      S.fx.push({ kind: 'dust', x: m.x, y: m.y, vx: Math.cos(t.angle) * 40, vy: Math.sin(t.angle) * 40, r: 6, life: 0.3, max: 0.3 });
      Sound.play('launch');
      break;
    }
    case 'frost': {
      const m = muzzle(t, 20);
      S.projectiles.push({ kind: 'snow', x: m.x, y: m.y, target, tx: target.x, ty: target.y, speed: 400, dmg: st.dmg, splash: st.splash * TILE, slow: st.slow, slowDur: st.slowDur, tower: t, spin: 0 });
      Sound.play('frost');
      break;
    }
    case 'torch': {
      const m = muzzle(t, 22);
      splashAt(target.x, target.y, st.splash * TILE, (e) => {
        damage(e, st.dmg, t);
        if (!e.dead) {
          e.burnDps = Math.max(e.burnT > 0 ? e.burnDps : 0, st.burn);
          e.burnT = Math.max(e.burnT, st.burnDur);
          e.burnSrc = t;
        }
      });
      for (let i = 0; i < 4; i++) {
        const k = rand(0.18, 0.28);
        const tx = target.x + rand(-10, 10), ty = target.y + rand(-10, 10);
        S.fx.push({ kind: 'flame', x: m.x, y: m.y, vx: (tx - m.x) / k, vy: (ty - m.y) / k, r: rand(4, 7), life: k, max: k });
      }
      Sound.play('flame');
      break;
    }
    case 'zap': {
      const pts = [{ x: t.x, y: t.y - 41 }, { x: target.x, y: target.y }];
      const hit = new Set([target]);
      let cur = target, dmg = st.dmg;
      damage(target, dmg, t, 1);
      for (let i = 1; i < st.chain; i++) {
        let next = null, bd = (TILE * 1.9) ** 2;
        for (const e of S.enemies) {
          if (!targetable(e) || hit.has(e)) continue;
          const d2 = dist2(e.x, e.y, cur.x, cur.y);
          if (d2 < bd) { bd = d2; next = e; }
        }
        if (!next) break;
        dmg *= 0.82;
        hit.add(next);
        pts.push({ x: next.x, y: next.y });
        damage(next, dmg, t, 1);
        cur = next;
      }
      S.fx.push({ kind: 'bolt', pts, life: 0.2, max: 0.2, seed: Math.random() * 1000 });
      for (const p of pts.slice(1)) S.fx.push({ kind: 'spark', x: p.x, y: p.y, life: 0.2, max: 0.2 });
      Sound.play('zap');
      break;
    }
    case 'owl': {
      const m = muzzle(t, 30);
      S.fx.push({ kind: 'tracer', x1: m.x, y1: m.y + 3, x2: target.x, y2: target.y, life: 0.16, max: 0.16 });
      S.fx.push({ kind: 'flash', x: m.x, y: m.y + 3, life: 0.1, max: 0.1, a: t.angle });
      S.fx.push({ kind: 'spark', x: target.x, y: target.y, life: 0.2, max: 0.2 });
      damage(target, st.dmg, t, st.pierce);
      Sound.play('owl');
      break;
    }
  }
}

function updateProjectile(p, dt) {
  if (p.kind === 'bomb') {
    p.t += dt;
    const k = Math.min(1, p.t / p.dur);
    p.x = lerp(p.sx, p.ex, k); p.y = lerp(p.sy, p.ey, k);
    p.h = Math.sin(k * Math.PI) * 46;
    if (k >= 1) {
      p.done = true;
      splashAt(p.x, p.y, p.splash, (e) => {
        const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
        damage(e, p.dmg * (1 - 0.4 * clamp(d / p.splash, 0, 1)), p.tower);
      });
      S.fx.push({ kind: 'boom', x: p.x, y: p.y, r: p.splash, life: 0.35, max: 0.35, rot: Math.random() * TAU });
      for (let i = 0; i < 8; i++) {
        const a = rand(0, TAU);
        S.fx.push({ kind: 'dust', x: p.x, y: p.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 50 - 20, r: rand(5, 9), life: 0.55, max: 0.55 });
      }
      addShake(3);
      Sound.play('boom');
    }
    return;
  }
  if (p.target && targetable(p.target)) { p.tx = p.target.x; p.ty = p.target.y; } else p.target = null;
  const dx = p.tx - p.x, dy = p.ty - p.y;
  const d = Math.hypot(dx, dy), step = p.speed * dt;
  if (p.spin != null) p.spin += dt * 12;
  if (d <= step + (p.target ? p.target.r * 0.5 : 0)) {
    p.done = true;
    if (p.kind === 'pebble') {
      if (p.target) damage(p.target, p.dmg, p.tower);
      S.fx.push({ kind: 'spark', x: p.tx, y: p.ty, life: 0.12, max: 0.12, small: true });
    } else if (p.kind === 'snow') {
      splashAt(p.tx, p.ty, p.splash, (e) => {
        if (!ZOMBIES[e.type].noSlow) {
          e.slowF = Math.max(e.slowT > 0 ? e.slowF : 0, p.slow);
          e.slowT = Math.max(e.slowT, p.slowDur);
        }
        damage(e, p.dmg, p.tower);
      });
      S.fx.push({ kind: 'frost', x: p.tx, y: p.ty, r: p.splash, life: 0.35, max: 0.35 });
      for (let i = 0; i < 6; i++) {
        const a = rand(0, TAU);
        S.fx.push({ kind: 'flake', x: p.tx, y: p.ty, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: 0.5, max: 0.5, rot: rand(0, TAU) });
      }
    }
  } else {
    p.x += (dx / d) * step; p.y += (dy / d) * step;
  }
}

// ============================================================
// Effects
// ============================================================
function floatText(text, x, y, color, size = 16) {
  S.fx.push({ kind: 'text', text, x, y, vy: -38, color, size, life: 1.0, max: 1.0 });
}
function burstStar(x, y, color) {
  const a = rand(0, TAU), sp = rand(80, 240);
  S.fx.push({ kind: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, color, r: rand(4, 8), rot: rand(0, TAU), life: 0.9, max: 0.9 });
}
function addShake(m) { S.shake = Math.max(S.shake, m); }
function showBanner(text, sub) { S.banner = { text, sub, t: 0, dur: 2.6 }; }

function updateFx(dt) {
  for (const f of S.fx) {
    f.life -= dt;
    if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; }
    if (f.kind === 'blob' || f.kind === 'star' || f.kind === 'dirt') f.vy += 420 * dt;
    if (f.kind === 'dust' || f.kind === 'flake') { f.vx *= 0.92; f.vy *= 0.92; }
    if (f.kind === 'text') f.vy *= 0.96;
    if (f.rot != null) f.rot += dt * 6;
  }
  S.fx = S.fx.filter((f) => f.life > 0);
  for (const d of S.decals) d.life -= dt;
  S.decals = S.decals.filter((d) => d.life > 0);
}

function drawFx(c, f) {
  const k = f.life / f.max; // 1 -> 0
  c.save();
  switch (f.kind) {
    case 'blob':
      circle(c, f.x, f.y, f.r * (0.5 + k * 0.5)); c.globalAlpha = Math.min(1, k * 2);
      fillStroke(c, f.color, 1.5); break;
    case 'dirt':
      circle(c, f.x, f.y, f.r); c.globalAlpha = Math.min(1, k * 2); fillStroke(c, '#8d6e63', 1.2); break;
    case 'dust':
      c.globalAlpha = k * 0.8; circle(c, f.x, f.y, f.r * (1.4 - k * 0.4)); c.fillStyle = f.color || '#fffaf0'; c.fill();
      c.lineWidth = 1.5; c.strokeStyle = 'rgba(43,33,64,.35)'; c.stroke(); break;
    case 'flame':
      c.globalAlpha = Math.min(1, k * 1.5); circle(c, f.x, f.y, f.r * (1.6 - k * 0.6));
      c.fillStyle = k > 0.6 ? '#fff3a3' : k > 0.3 ? '#ffb347' : '#ff6b4a'; c.fill(); break;
    case 'ring':
      c.globalAlpha = k; circle(c, f.x, f.y, f.r * (1 + (1 - k) * 1.2)); c.lineWidth = 3 * k + 1; c.strokeStyle = f.color; c.stroke(); break;
    case 'text': {
      c.globalAlpha = Math.min(1, k * 2.5);
      const pop = 1 + Math.max(0, (k - 0.85)) * 3;
      c.translate(f.x, f.y); c.scale(pop, pop);
      outlinedText(c, f.text, 0, 0, f.size, f.color, Math.max(3, f.size / 5));
      break;
    }
    case 'star':
      c.globalAlpha = Math.min(1, k * 2); star(c, f.x, f.y, f.r, f.r * 0.45, 5, f.rot); fillStroke(c, f.color, 1.5); break;
    case 'spark': {
      const r = (f.small ? 6 : 11) * (1.3 - k * 0.5);
      c.globalAlpha = k; star(c, f.x, f.y, r, r * 0.35, 4, (1 - k) * 2); fillStroke(c, '#fff6a8', 1.5); break;
    }
    case 'boom': {
      const g = 1 - k;
      const r = f.r * (0.45 + Math.sqrt(g) * 0.7);
      c.globalAlpha = Math.min(1, k * 2.2);
      star(c, f.x, f.y, r, r * 0.62, 9, f.rot); fillStroke(c, '#ffb347', 3);
      star(c, f.x, f.y, r * 0.62, r * 0.38, 7, -f.rot); c.fillStyle = '#fff3a3'; c.fill();
      if (g < 0.5) outlinedText(c, 'BOOM', f.x, f.y, 16, '#ff5d5d', 3);
      break;
    }
    case 'frost':
      c.globalAlpha = k * 0.7; circle(c, f.x, f.y, f.r * (0.6 + (1 - k) * 0.5)); c.fillStyle = '#c9f1ff'; c.fill();
      c.lineWidth = 2; c.strokeStyle = '#ffffff'; c.stroke(); break;
    case 'flake':
      c.globalAlpha = k; c.translate(f.x, f.y); c.rotate(f.rot); c.strokeStyle = '#ffffff'; c.lineWidth = 2;
      for (let i = 0; i < 3; i++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(-4, 0); c.lineTo(4, 0); c.stroke(); }
      break;
    case 'bolt': {
      c.globalAlpha = k;
      const rng = mulberry32(Math.floor(f.seed + (1 - k) * 4));
      c.beginPath();
      for (let i = 0; i < f.pts.length - 1; i++) {
        const a = f.pts[i], b = f.pts[i + 1];
        if (i === 0) c.moveTo(a.x, a.y);
        const n = 5;
        for (let j = 1; j <= n; j++) {
          const tt = j / n;
          const jx = j === n ? 0 : (rng() - 0.5) * 14, jy = j === n ? 0 : (rng() - 0.5) * 14;
          c.lineTo(lerp(a.x, b.x, tt) + jx, lerp(a.y, b.y, tt) + jy);
        }
      }
      c.lineJoin = 'round'; c.lineCap = 'round';
      c.strokeStyle = INK; c.lineWidth = 7; c.stroke();
      c.strokeStyle = '#7df9ff'; c.lineWidth = 4.5; c.stroke();
      c.strokeStyle = '#ffffff'; c.lineWidth = 1.8; c.stroke();
      break;
    }
    case 'tracer':
      c.globalAlpha = k; c.lineCap = 'round';
      c.beginPath(); c.moveTo(f.x1, f.y1); c.lineTo(f.x2, f.y2);
      c.strokeStyle = 'rgba(43,33,64,.6)'; c.lineWidth = 5; c.stroke();
      c.strokeStyle = '#fff6a8'; c.lineWidth = 2.5; c.stroke();
      break;
    case 'flash':
      c.globalAlpha = k; star(c, f.x, f.y, 10, 4, 6, f.a); fillStroke(c, '#fff3a3', 1.5); break;
  }
  c.restore();
}

function drawProjectile(c, p) {
  if (p.kind === 'pebble') {
    circle(c, p.x, p.y, 4); fillStroke(c, '#a39bb5', 2);
  } else if (p.kind === 'snow') {
    circle(c, p.x, p.y, 5.5); fillStroke(c, '#ffffff', 2);
    shine(c, p.x - 1.5, p.y - 2, 1.8, 1.2, 0.9);
  } else if (p.kind === 'bomb') {
    c.fillStyle = 'rgba(43,33,64,.22)';
    ellipse(c, p.x, p.y + 4, 6 - p.h / 18, 2.5 - p.h / 40); c.fill();
    const by = p.y - p.h;
    circle(c, p.x, by, 7); fillStroke(c, '#3d405b', 2.5);
    shine(c, p.x - 2.5, by - 2.5, 2.2, 1.5, 0.7);
    star(c, p.x + 4, by - 7, 3.5, 1.5, 5, S.anim * 20); c.fillStyle = '#ffcf3f'; c.fill();
  }
}

// ============================================================
// Update & render
// ============================================================
function update(dt) {
  S.time += dt;
  for (const sp of S.spawners) {
    if (sp.done) continue;
    sp.time += dt;
    while (sp.queue.length && sp.queue[0].t <= sp.time) spawnEnemy(sp.queue.shift().type, sp.wave, sp.n++ % S.M.paths.length);
    if (!sp.queue.length) sp.done = true;
  }
  for (const e of S.enemies) if (!e.dead) updateEnemy(e, dt);
  for (const t of S.towers) updateTower(t, dt);
  for (const p of S.projectiles) if (!p.done) updateProjectile(p, dt);
  S.projectiles = S.projectiles.filter((p) => !p.done);
  S.enemies = S.enemies.filter((e) => !e.dead);
  for (const sp of S.spawners) {
    if (sp.done && !sp.paid && !S.enemies.some((e) => e.wave === sp.wave)) {
      sp.paid = true;
      const bonus = waveBonus(S.L, sp.wave);
      S.gold += bonus;
      S.dirty = true;
      floatText(`Wave ${sp.wave} cleared! +${bonus}`, W / 2, H / 2 - 40, '#ffcf3f', 28);
      Sound.play('coin');
      bumpStat('.stat-gold');
    }
  }
  S.spawners = S.spawners.filter((sp) => !sp.paid);
  updateFx(dt);

  if (S.lives <= 0) { gameOver(); return; }
  const idle = !S.spawners.length && !S.enemies.length;
  if (S.wave >= S.L.waves && idle) { victory(); return; }
  if (idle && S.dirty) checkpoint();
  if (S.auto && idle) {
    S.autoT += dt;
    if (S.autoT > 1.6) { S.autoT = 0; startWave(); }
  } else S.autoT = 0;
}

function render() {
  const c = ctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, canvas.width, canvas.height);
  if (!S.M) return;
  let sx = 0, sy = 0;
  if (S.shake > 0.2) { sx = rand(-S.shake, S.shake); sy = rand(-S.shake, S.shake); }
  c.drawImage(bg, sx * scale, sy * scale);
  c.setTransform(scale, 0, 0, scale, sx * scale, sy * scale);
  const t = S.anim;

  for (const d of S.decals) {
    c.save(); c.globalAlpha = Math.min(1, d.life / 1.5) * 0.45;
    const rng = mulberry32(Math.floor(d.seed));
    c.fillStyle = d.color;
    ellipse(c, d.x, d.y, d.r, d.r * 0.45); c.fill();
    for (let i = 0; i < 5; i++) { const a = rng() * TAU; ellipse(c, d.x + Math.cos(a) * d.r * 1.15, d.y + Math.sin(a) * d.r * 0.5, d.r * 0.22, d.r * 0.14); c.fill(); }
    c.restore();
  }

  drawEntry(c, S.M, t);

  if (S.selected) {
    const st = TOWERS[S.selected.type].levels[S.selected.level];
    drawRange(c, S.selected.x, S.selected.y - 8, st.range * TILE, true, t);
  }
  const h = S.hover;
  const spot = S.pending || (h.inside && h.mouse ? h : null);
  if (S.placing && spot && S.state === 'playing') {
    const ok = canPlace(spot.col, spot.row) && S.gold >= TOWERS[S.placing].cost;
    const x = spot.col * TILE, y = spot.row * TILE;
    rr(c, x + 2, y + 2, TILE - 4, TILE - 4, 8);
    c.fillStyle = ok ? 'rgba(126,217,87,.35)' : 'rgba(255,93,93,.35)'; c.fill();
    c.lineWidth = 2.5; c.strokeStyle = ok ? '#2f8f2f' : '#d43d3d'; c.setLineDash([6, 4]); c.stroke(); c.setLineDash([]);
    drawRange(c, x + TILE / 2, y + TILE / 2 - 8, TOWERS[S.placing].levels[0].range * TILE, ok, t);
  } else if (!S.placing && h.inside && S.state === 'playing') {
    const tw = S.towerAt.get(h.row * COLS + h.col);
    if (tw && tw !== S.selected) {
      rr(c, h.col * TILE + 2, h.row * TILE + 2, TILE - 4, TILE - 4, 8);
      c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.8)'; c.stroke();
    }
  }

  // depth-sorted units
  const units = [];
  for (const tw of S.towers) units.push({ y: tw.y + 6, tw });
  for (const e of S.enemies) units.push({ y: e.y + e.r * 0.85, e });
  units.push({ y: S.M.end.y + 10, house: true });
  units.sort((a, b) => a.y - b.y);
  for (const u of units) {
    if (u.tw) {
      const tw = u.tw;
      const p = tw.pop > 0 ? 1 + Math.sin((tw.pop / 0.4) * Math.PI) * 0.18 : 1;
      c.save(); c.translate(tw.x, tw.y + 16); c.scale(2 - p, p); c.translate(-tw.x, -tw.y - 16);
      drawTower(c, tw.type, tw.level, tw.x, tw.y, tw.angle, tw.recoil, t);
      c.restore();
      if (tw.stun > 0) {
        c.save(); c.globalAlpha = 0.7;
        rr(c, tw.x - 20, tw.y - 40, 40, 58, 8); c.fillStyle = '#bfefff'; c.fill();
        c.lineWidth = 2.5; c.strokeStyle = '#ffffff'; c.stroke();
        c.restore();
        shine(c, tw.x - 10, tw.y - 28, 3, 9, 0.8);
      }
      if (tw === S.selected) {
        c.save(); c.globalAlpha = 0.5 + Math.sin(t * 6) * 0.3;
        rr(c, tw.x - 22, tw.y - 12, 44, 34, 11); c.lineWidth = 3; c.strokeStyle = '#ffffff'; c.stroke();
        c.restore();
      }
    } else if (u.e) drawZombie(c, u.e, t);
    else drawSafehouse(c, S.M.end.x, S.M.end.y, t, S.castleHit);
  }

  if (S.placing && spot && S.state === 'playing' && canPlace(spot.col, spot.row)) {
    const gx = spot.col * TILE + TILE / 2, gy = spot.row * TILE + TILE / 2;
    drawTower(c, S.placing, 0, gx, gy, -Math.PI / 2 + Math.sin(t * 2) * 0.4, 0, t, { alpha: 0.65 });
    if (S.pending) outlinedText(c, 'Tap again to build', gx, gy - 44 + Math.sin(t * 5) * 2, 15, '#ffffff', 4);
  }

  for (const p of S.projectiles) drawProjectile(c, p);
  for (const f of S.fx) drawFx(c, f);

  if (S.leakFlash > 0) {
    c.save(); c.globalAlpha = S.leakFlash * 0.8;
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, 'rgba(255,60,90,0)'); g.addColorStop(1, 'rgba(255,60,90,.7)');
    c.fillStyle = g; c.fillRect(-20, -20, W + 40, H + 40);
    c.restore();
  }

  if (S.banner) {
    const b = S.banner;
    const k = b.t / b.dur;
    const inK = clamp(b.t / 0.35, 0, 1);
    const sc = 1 + 2.7 * (inK - 1) ** 3 + 1.7 * (inK - 1) ** 2; // ease-out-back
    c.save();
    c.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
    c.translate(W / 2, 120); c.rotate(-0.04); c.scale(sc, sc);
    outlinedText(c, b.text, 0, 0, 52, '#8ee05a', 10);
    if (b.sub) outlinedText(c, b.sub, 0, 44, 24, '#ffffff', 6);
    c.restore();
  }
}

function drawRange(c, x, y, r, ok, t) {
  c.save();
  circle(c, x, y, r);
  c.fillStyle = ok ? 'rgba(255,255,255,.18)' : 'rgba(255,93,93,.15)'; c.fill();
  c.lineWidth = 2.5; c.strokeStyle = ok ? 'rgba(255,255,255,.85)' : 'rgba(212,61,61,.8)';
  c.setLineDash([10, 7]); c.lineDashOffset = -t * 20; c.stroke();
  c.restore();
}

function canPlace(col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return false;
  return S.M.grid[row * COLS + col] === 0 && !S.towerAt.has(row * COLS + col);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  S.anim += dt;
  if (S.state === 'playing' && !S.paused) {
    for (let i = 0; i < S.speed; i++) { update(dt); if (S.state !== 'playing') break; }
  } else if (S.state !== 'title') {
    if (!S.paused) updateFx(dt);
  }
  if (!S.paused) {
    S.shake = Math.max(0, S.shake - dt * 30);
    S.castleHit = Math.max(0, S.castleHit - dt);
    S.leakFlash = Math.max(0, S.leakFlash - dt);
    if (S.banner) { S.banner.t += dt; if (S.banner.t >= S.banner.dur) S.banner = null; }
  }
  render();
  updateHUD();
  requestAnimationFrame(frame);
}

// ============================================================
// UI: HUD, shop, info panel
// ============================================================
const hudCache = {};
function setText(id, v) {
  if (hudCache[id] === v) return;
  hudCache[id] = v;
  $(id).textContent = v;
}
function bumpStat(sel) {
  const el = $(sel);
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

let lastGoldForUi = -1;
function updateHUD(force) {
  if (!S.L) return;
  setText('#lives', String(S.lives));
  setText('#gold', String(Math.floor(S.gold)));
  setText('#wave', `${S.wave} / ${S.L.waves}`);
  const btn = $('#btn-wave');
  const active = S.spawners.length > 0 || S.enemies.length > 0;
  let label, disabled = S.state !== 'playing';
  if (S.wave >= S.L.waves) { label = 'Final wave'; disabled = true; }
  else if (S.wave === 0) label = 'Start wave 1';
  else if (active) label = `Wave ${S.wave + 1} early`;
  else label = `Start wave ${S.wave + 1}`;
  setText('#btn-wave', label);
  if (btn.disabled !== disabled) btn.disabled = disabled;
  if (force || S.gold !== lastGoldForUi) {
    lastGoldForUi = S.gold;
    for (const b of document.querySelectorAll('.tower-btn')) b.classList.toggle('poor', S.gold < TOWERS[b.dataset.type].cost);
    refreshInfo();
  }
}

function iconCanvas(size, draw) {
  const cv = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = cv.height = Math.round(size * dpr);
  const c = cv.getContext('2d');
  c.scale(dpr, dpr);
  draw(c);
  return cv;
}
function towerIcon(type, level = 0, size = 56) {
  return iconCanvas(size, (c) => {
    // Towers span roughly y-48 (zap ball) to y+23 (base shadow): fit that into the icon.
    const s = size / 76;
    c.scale(s, s);
    drawTower(c, type, level, 38, 50, -Math.PI / 4, 0, 0.3);
  });
}
function zombieIcon(type, size = 32) {
  return iconCanvas(size, (c) => {
    const r = ZOMBIES[type].r;
    // Zombies stand about 3.5 radii tall from feet to hat.
    const k = (size * 0.86) / (3.5 * r);
    c.translate(size / 2 - r * 0.15 * k, size * 0.95 - r * 0.85 * k);
    c.scale(k, k);
    drawZombie(c, { type, r, x: 0, y: 0, dirx: 1, diry: 0, face: 1, phase: 0, flash: 0, slowT: 0, burnT: 0, hp: 1, maxHp: 1 }, 0);
  });
}

function buildShop() {
  const shop = $('#shop');
  shop.innerHTML = '';
  for (const type of TOWER_KEYS) {
    const def = TOWERS[type];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tower-btn';
    b.dataset.type = type;
    b.title = `${def.name}: ${def.desc} (key ${def.key})`;
    b.append(towerIcon(type));
    b.insertAdjacentHTML('beforeend', `<span class="t-key">${def.key}</span><span class="t-name">${def.name}</span><span class="t-cost">${def.cost}</span>`);
    b.addEventListener('click', () => { Sound.init(); selectPlacing(type); });
    shop.append(b);
  }
}

function selectPlacing(type) {
  if (S.state !== 'playing') return;
  S.placing = S.placing === type ? null : type;
  S.pending = null;
  if (S.placing) S.selected = null;
  Sound.play('click');
  for (const b of document.querySelectorAll('.tower-btn')) b.classList.toggle('active', b.dataset.type === S.placing);
  renderInfo();
}

function cancelAll() {
  S.placing = null; S.selected = null; S.pending = null;
  for (const b of document.querySelectorAll('.tower-btn')) b.classList.remove('active');
  renderInfo();
}

function fmtRate(r) { return (1 / r).toFixed(1); }
function statRows(st, next) {
  const rows = [['Damage', st.dmg, next && next.dmg], ['Shots / sec', fmtRate(st.rate), next && fmtRate(next.rate)], ['Range', st.range.toFixed(1), next && next.range.toFixed(1)]];
  if (st.splash) rows.push(['Splash', st.splash.toFixed(2), next && next.splash.toFixed(2)]);
  if (st.slow) rows.push(['Slow', Math.round(st.slow * 100) + '%', next && Math.round(next.slow * 100) + '%']);
  if (st.burn) rows.push(['Burn / sec', st.burn, next && next.burn]);
  if (st.chain) rows.push(['Chain', st.chain, next && next.chain]);
  if (st.pierce) rows.push(['Armor pierce', Math.round(st.pierce * 100) + '%', next && Math.round(next.pierce * 100) + '%']);
  return '<ul class="stat-list">' + rows.map(([k, v, n]) => {
    const up = n != null && String(n) !== String(v) ? ` <span class="up">→ ${n}</span>` : '';
    return `<li><span>${k}</span><b>${v}${up}</b></li>`;
  }).join('') + '</ul>';
}

function renderInfo() {
  const info = $('#info');
  info.innerHTML = '';
  $('.panel').classList.toggle('busy', !!(S.selected || S.placing));
  if (S.selected) {
    const t = S.selected, def = TOWERS[t.type], st = def.levels[t.level], next = def.levels[t.level + 1];
    const head = document.createElement('div');
    head.className = 'info-head';
    head.append(towerIcon(t.type, t.level, 52));
    const pips = def.levels.map((_, i) => `<span class="pip${i <= t.level ? ' on' : ''}"></span>`).join('');
    head.insertAdjacentHTML('beforeend', `<div><h3>${def.name}</h3><div class="info-level">${pips}&nbsp;Level ${t.level + 1}</div></div>`);
    info.append(head);
    info.insertAdjacentHTML('beforeend', `
      ${statRows(st, next)}
      <p class="hint" id="info-kills"></p>
      <div class="info-actions">
        <button class="btn wide" id="btn-target" type="button" title="Change targeting (T)">Target: ${MODES.find((m) => m[0] === t.mode)[1]}</button>
        <button class="btn btn-go" id="btn-upgrade" type="button" title="Upgrade (U)">${next ? `Upgrade ${next.cost}` : 'Maxed out'}</button>
        <button class="btn btn-danger" id="btn-sell" type="button" title="Sell (S)">Sell ${sellValue(t)}</button>
      </div>`);
    $('#btn-target').addEventListener('click', () => cycleTarget(t));
    $('#btn-upgrade').addEventListener('click', () => upgradeTower(t));
    $('#btn-sell').addEventListener('click', () => sellTower(t));
  } else if (S.placing) {
    const def = TOWERS[S.placing];
    const head = document.createElement('div');
    head.className = 'info-head';
    head.append(towerIcon(S.placing, 0, 52));
    head.insertAdjacentHTML('beforeend', `<div><h3>${def.name}</h3><div class="info-level">Costs ${def.cost} gold</div></div>`);
    info.append(head);
    info.insertAdjacentHTML('beforeend', `<p>${def.desc}</p>${statRows(def.levels[0])}
      <p class="hint">${coarse() ? 'Tap a grass tile to preview it, then tap the same tile again to build.' : 'Click a grass tile to build. Hold <kbd>Shift</kbd> to build several. <kbd>Esc</kbd> cancels.'}</p>`);
  } else {
    info.innerHTML = `<h2 class="card-title">How to play</h2>
      <p>Zombies shuffle along the path toward your safehouse. Each one that gets inside eats brains.</p>
      <p class="more">Pick a tower, tap a grass tile to build it, then tap it later to upgrade or sell. Bonking zombies earns gold.</p>
      <p class="hint">Check the next wave below. Hover or press a zombie to learn its trick.</p>`;
  }
  refreshInfo();
}

function refreshInfo() {
  const t = S.selected;
  if (!t) return;
  const next = TOWERS[t.type].levels[t.level + 1];
  const up = $('#btn-upgrade');
  if (up) up.disabled = !next || S.gold < next.cost || S.state !== 'playing';
  const k = $('#info-kills');
  if (k) {
    const txt = `${t.kills} bonk${t.kills === 1 ? '' : 's'} · ${Math.round(t.dealt)} damage dealt`;
    if (k.textContent !== txt) k.textContent = txt;
  }
}

function cycleTarget(t) {
  const i = MODES.findIndex((m) => m[0] === t.mode);
  t.mode = MODES[(i + 1) % MODES.length][0];
  S.dirty = true;
  Sound.play('click');
  const b = $('#btn-target');
  if (b) b.textContent = `Target: ${MODES.find((m) => m[0] === t.mode)[1]}`;
}

function zombieChip(type, label, isNew) {
  const z = ZOMBIES[type];
  const chip = document.createElement('span');
  chip.className = 'chip' + (z.boss ? ' boss' : '') + (isNew ? ' new' : '');
  chip.title = `${z.name}: ${z.desc}`;
  chip.tabIndex = 0;
  chip.append(zombieIcon(type));
  if (label != null) chip.insertAdjacentHTML('beforeend', `<span>${label}</span>`);
  if (isNew) chip.insertAdjacentHTML('beforeend', '<span class="new-tag">New</span>');
  chip.addEventListener('click', () => {
    const box = chip.closest('.card, .world-info');
    const tip = box && box.querySelector('.zombie-tip');
    if (tip) { tip.textContent = `${z.name}: ${z.desc}`; tip.hidden = false; }
  });
  return chip;
}

function renderNextWave() {
  const box = $('#next-wave');
  if (!S.L) return;
  const n = S.wave + 1;
  box.innerHTML = '';
  const done = S.wave >= S.L.waves;
  const title = document.createElement('h2');
  title.className = 'card-title';
  title.textContent = done ? 'Final wave is out' : `Coming up: wave ${n} of ${S.L.waves}`;
  box.append(title);
  if (done) {
    box.insertAdjacentHTML('beforeend', '<p class="hint">Bonk every zombie left on the path to clear the level.</p>');
    return;
  }
  const chips = document.createElement('div');
  chips.className = 'wave-chips';
  const fresh = newTypes(S.L, n);
  for (const [type, count] of Object.entries(waveSummary(S.L, n))) chips.append(zombieChip(type, `×${count}`, fresh.includes(type)));
  box.append(chips);
  box.insertAdjacentHTML('beforeend', `<p class="hint zombie-tip" hidden></p><p class="hint" style="margin:8px 0 0">Clear bonus: ${waveBonus(S.L, n)} gold</p>`);
}

// ---------- level select ----------
function totalStars() { return LEVELS.reduce((a, L) => a + starsFor(L), 0); }
function starRow(n) { return [1, 2, 3].map((i) => `<span class="mini-star${i <= n ? ' on' : ''}">★</span>`).join(''); }

function buildWorldTabs() {
  const tabs = $('#world-tabs');
  tabs.innerHTML = '';
  WORLDS.forEach((w, i) => {
    const open = worldUnlocked(i);
    const got = LEVELS.filter((L) => L.world === i).reduce((a, L) => a + starsFor(L), 0);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'world-tab' + (i === S.worldTab ? ' active' : '');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(i === S.worldTab));
    b.disabled = !open;
    b.innerHTML = `<span class="w-num">World ${i + 1}</span><span class="w-name">${w.name}</span><span class="w-stars">${open ? `★ ${got} / 9` : 'Locked'}</span>`;
    b.addEventListener('click', () => { S.worldTab = i; Sound.play('click'); buildWorldTabs(); buildLevelList(); });
    tabs.append(b);
  });
  $('#total-stars').textContent = `★ ${totalStars()} / ${LEVELS.length * 3}`;
}

function buildLevelList() {
  const w = WORLDS[S.worldTab];
  const info = $('#world-info');
  info.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'world-blurb';
  p.textContent = w.blurb;
  const chips = document.createElement('div');
  chips.className = 'wave-chips world-mobs';
  for (const type of w.mobs) chips.append(zombieChip(type, ZOMBIES[type].name));
  chips.append(zombieChip(w.boss, `Boss: ${ZOMBIES[w.boss].name}`));
  info.append(p, chips);
  info.insertAdjacentHTML('beforeend', '<p class="hint zombie-tip" hidden></p>');

  const list = $('#map-list');
  list.innerHTML = '';
  LEVELS.forEach((L, i) => {
    if (L.world !== S.worldTab) return;
    const open = levelUnlocked(i);
    const M = buildLevel(L);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'map-card' + (open ? '' : ' locked');
    card.disabled = !open;
    const cv = document.createElement('canvas');
    cv.width = 360; cv.height = 216;
    const c = cv.getContext('2d');
    renderBackground(c, M, 360 / W);
    drawSafehouse(c, M.end.x, M.end.y, 0, 0);
    card.append(cv);
    const tags = [`${L.waves} waves`];
    if (L.paths.length > 1) tags.push('2 entrances');
    if (L.boss) tags.push('Boss');
    card.insertAdjacentHTML('beforeend', `
      <div class="m-row"><h3>${L.id} ${L.name}</h3><span class="stars">${starRow(starsFor(L))}</span></div>
      <div class="m-row"><span class="best">${open ? tags.join(' · ') : `Beat ${LEVELS[i - 1].id} to unlock`}</span></div>`);
    if (!open) card.insertAdjacentHTML('beforeend', '<span class="lock" aria-hidden="true">Locked</span>');
    card.addEventListener('click', () => { Sound.init(); Sound.play('click'); startGame(i); });
    list.append(card);
  });
}

function showTitle() {
  if (S.state === 'playing') checkpoint();
  S.state = 'title';
  setPaused(false);
  $('#end-screen').hidden = true;
  const sv = loadSave();
  const box = $('#continue-box');
  box.hidden = !sv;
  box.innerHTML = '';
  if (sv) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-go btn-continue';
    b.textContent = `Continue ${sv.level} ${LEVELS[sv.index].name}: wave ${sv.wave + 1}`;
    b.addEventListener('click', () => { Sound.init(); Sound.play('click'); startGame(sv.index, sv); });
    box.append(b);
  }
  if (!worldUnlocked(S.worldTab)) S.worldTab = 0;
  renderInstall();
  buildWorldTabs();
  buildLevelList();
  $('#title-screen').hidden = false;
}

// ============================================================
// Input
// ============================================================
function toLogical(ev) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - r.left - canvas.clientLeft) / canvas.clientWidth) * W,
    y: ((ev.clientY - r.top - canvas.clientTop) / canvas.clientHeight) * H,
  };
}
function setHover(ev) {
  const p = toLogical(ev);
  S.hover.mouse = ev.pointerType === 'mouse';
  S.hover.x = p.x; S.hover.y = p.y;
  S.hover.col = Math.floor(p.x / TILE); S.hover.row = Math.floor(p.y / TILE);
  S.hover.inside = p.x >= 0 && p.y >= 0 && p.x < W && p.y < H;
}

canvas.addEventListener('pointermove', setHover);
canvas.addEventListener('pointerleave', () => { S.hover.inside = false; });
canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); cancelAll(); });
canvas.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  Sound.init();
  setHover(ev);
  if (S.state !== 'playing' || S.paused) return;
  const { col, row } = S.hover;
  const tw = S.towerAt.get(row * COLS + col);
  if (S.placing) {
    if (canPlace(col, row)) {
      // Touch: the first tap previews the spot, a second tap on the same tile builds.
      if (ev.pointerType !== 'mouse' && !(S.pending && S.pending.col === col && S.pending.row === row)) {
        S.pending = { col, row };
        Sound.play('click');
        return;
      }
      S.pending = null;
      if (S.gold >= TOWERS[S.placing].cost) {
        const t = placeTower(S.placing, col, row);
        if (!ev.shiftKey || S.gold < TOWERS[S.placing].cost) {
          S.placing = null;
          S.selected = t;
          for (const b of document.querySelectorAll('.tower-btn')) b.classList.remove('active');
        }
        renderInfo(); updateHUD(true);
      } else {
        floatText('Not enough gold', S.hover.x, S.hover.y - 10, '#ff5d5d', 16);
        Sound.play('error');
      }
    } else if (tw) {
      S.placing = null; S.pending = null; S.selected = tw;
      for (const b of document.querySelectorAll('.tower-btn')) b.classList.remove('active');
      renderInfo();
    } else {
      floatText(S.M.grid[row * COLS + col] === 1 ? 'Not on the path!' : 'Something is in the way', S.hover.x, S.hover.y - 10, '#ff5d5d', 16);
      Sound.play('error');
    }
    return;
  }
  if (tw) { S.selected = tw === S.selected ? null : tw; Sound.play('click'); }
  else S.selected = null;
  renderInfo();
});

window.addEventListener('keydown', (ev) => {
  if (ev.target.closest && ev.target.closest('input, textarea')) return;
  const k = ev.key.toLowerCase();
  if (S.state === 'title') return;
  if (k === 'escape') { if (S.placing || S.selected) cancelAll(); else setPaused(!S.paused); return; }
  if (k === 'p') { setPaused(!S.paused); return; }
  if (S.state !== 'playing' || S.paused) return;
  Sound.init();
  if (k === ' ' || k === 'enter') {
    const onButton = document.activeElement && document.activeElement.tagName === 'BUTTON';
    if (onButton && k === 'enter') return;
    // Blur first so the focused button doesn't also fire on key-up.
    if (onButton) document.activeElement.blur();
    ev.preventDefault(); startWave(); return;
  }
  const idx = TOWER_KEYS.findIndex((tk) => TOWERS[tk].key === k);
  if (idx >= 0) { selectPlacing(TOWER_KEYS[idx]); return; }
  if (k === 'f') cycleSpeed();
  else if (k === 'a') toggleAuto();
  else if (k === 'm') toggleSound();
  else if (S.selected && k === 'u') upgradeTower(S.selected);
  else if (S.selected && k === 's') sellTower(S.selected);
  else if (S.selected && k === 't') cycleTarget(S.selected);
});

function cycleSpeed() {
  S.speed = S.speed === 3 ? 1 : S.speed + 1;
  $('#btn-speed').textContent = `${S.speed}×`;
  $('#btn-speed').setAttribute('aria-pressed', String(S.speed > 1));
  Sound.play('click');
}
function toggleAuto() {
  S.auto = !S.auto;
  $('#btn-auto').setAttribute('aria-pressed', String(S.auto));
  Sound.play('click');
}
function toggleSound() {
  Sound.muted = !Sound.muted;
  $('#btn-sound').setAttribute('aria-pressed', String(!Sound.muted));
  $('#btn-sound').textContent = Sound.muted ? 'Muted' : 'Sound';
  store.set('zbash.muted', Sound.muted ? '1' : '0');
  Sound.play('click');
}

$('#btn-wave').addEventListener('click', () => { Sound.init(); startWave(); });
$('#btn-speed').addEventListener('click', cycleSpeed);
$('#btn-auto').addEventListener('click', toggleAuto);
$('#btn-sound').addEventListener('click', () => { Sound.init(); toggleSound(); });
$('#btn-pause').addEventListener('click', () => setPaused(!S.paused));
$('#btn-resume').addEventListener('click', () => setPaused(false));
$('#btn-restart').addEventListener('click', () => startGame(S.levelIndex));
$('#btn-maps').addEventListener('click', showTitle);
$('#btn-retry').addEventListener('click', () => startGame(S.levelIndex));
$('#btn-menu').addEventListener('click', showTitle);
$('#btn-next').addEventListener('click', () => { if (LEVELS[S.levelIndex + 1]) startGame(S.levelIndex + 1); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && S.state === 'playing') { checkpoint(); setPaused(true); }
});

// ---------- full screen, install, rotate hint ----------
const standalone = (window.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) || navigator.standalone === true;
let topLevel = false;
try { topLevel = window.top === window; } catch (e) { topLevel = false; }
const root = document.documentElement;
const fsRequest = root.requestFullscreen || root.webkitRequestFullscreen;
const fsActive = () => document.fullscreenElement || document.webkitFullscreenElement;
const fsBtn = $('#btn-full');
fsBtn.hidden = standalone || !fsRequest || !(document.fullscreenEnabled || document.webkitFullscreenEnabled);
fsBtn.addEventListener('click', () => {
  if (fsActive()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  Promise.resolve(fsRequest.call(root))
    .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
    .catch(() => { /* full screen or rotation lock refused */ });
});
const syncFs = () => { fsBtn.textContent = fsActive() ? 'Exit full' : 'Full screen'; };
document.addEventListener('fullscreenchange', syncFs);
document.addEventListener('webkitfullscreenchange', syncFs);

let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; renderInstall(); });
window.addEventListener('appinstalled', () => { installEvt = null; renderInstall(); });
function renderInstall() {
  const box = $('#install-box');
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  box.innerHTML = '';
  box.hidden = true;
  if (standalone || !topLevel) return;
  if (installEvt) {
    box.hidden = false;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = 'Install Zombie Bash';
    b.addEventListener('click', () => {
      installEvt.prompt();
      installEvt.userChoice.finally(() => { installEvt = null; renderInstall(); });
    });
    box.append(b);
    box.insertAdjacentHTML('beforeend', '<span>Adds it to your home screen. Plays full screen, even offline.</span>');
  } else if (ios && location.protocol === 'https:') {
    box.hidden = false;
    box.innerHTML = '<span>Play it like an app: tap <b>Share</b>, then <b>Add to Home Screen</b>.</span>';
  }
}

if (store.get('zbash.hint') === '1') document.body.classList.add('hint-dismissed');
$('#btn-hint-close').addEventListener('click', () => {
  document.body.classList.add('hint-dismissed');
  store.set('zbash.hint', '1');
  resize();
});

// ============================================================
// Boot
// ============================================================
if (store.get('zbash.muted') === '1') {
  Sound.muted = true;
  $('#btn-sound').setAttribute('aria-pressed', 'false');
  $('#btn-sound').textContent = 'Muted';
}
buildShop();
// Draw the furthest unlocked level behind the title screen.
let furthest = 0;
while (furthest + 1 < LEVELS.length && levelUnlocked(furthest + 1)) furthest++;
S.levelIndex = furthest; S.L = LEVELS[furthest]; S.M = buildLevel(S.L); S.worldTab = S.L.world;
S.lives = 20; S.gold = S.L.gold;
setText('#level-tag', `Level ${S.L.id}`);
renderInfo(); renderNextWave();
resize();
updateHUD(true);
showTitle();
new ResizeObserver(() => resize()).observe(stage);
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { buildShop(); updateHUD(true); });
requestAnimationFrame(frame);

// Small hook for automated tests and tinkering in the console.
window.ZombieBash = { S, LEVELS, WORLDS, ZOMBIES, TOWERS, startGame, startWave, placeTower, upgradeTower, update, canPlace, checkpoint, loadSave, makeWave, drawZombie, drawTower, progress };
})();
