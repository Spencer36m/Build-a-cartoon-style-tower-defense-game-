'use strict';
// ============================================================
// Shared constants, helpers and game data. Loaded first; the other scripts read these globals.
// ============================================================
const TILE = 48, COLS = 20, ROWS = 12;
const W = COLS * TILE, H = ROWS * TILE;
const TAU = Math.PI * 2;
const LEVELS_PER_WORLD = 50;
const BASE_LIVES = 20;
const FONT_DISPLAY = '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif';
const FONT_BODY = '"Barlow", "Segoe UI", system-ui, sans-serif';

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

// ---------- colour helpers ----------
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
function shade(h, k) { return k >= 0 ? mix(h, '#ffffff', k) : mix(h, '#000000', -k); }
function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }

// ============================================================
// Worlds
// ============================================================
// lat/lon place each world on the globe (degrees).
const WORLDS = [
  {
    id: 'farmland', name: 'Hollow Creek Farmland', short: 'Farmland', lat: 38, lon: -95,
    blurb: 'The outbreak started in the cornfields. Hold the farm roads and keep the survivors safe.',
    ground: ['#5f7a3a', '#6d8742', '#55702f'], road: '#8b7356', roadEdge: '#5e4b37', water: '#2f5d6b',
    decor: ['oak', 'oak', 'bush', 'hay', 'fence', 'crops', 'rock', 'car', 'barn'],
    times: ['day', 'day', 'dusk', 'dawn', 'night'], weather: ['clear', 'clear', 'rain', 'fog'],
    mobs: [['walker', 1], ['runner', 3], ['cone', 6], ['digger', 12], ['carrion', 18]],
    boss: 'harvester',
  },
  {
    id: 'graveyard', name: 'Blackwood Cemetery', short: 'Cemetery', lat: 52, lon: 10,
    blurb: 'Fog rolls between the headstones. The dead here do not stay buried.',
    ground: ['#3f4f3a', '#4a5a41', '#36442f'], road: '#77746b', roadEdge: '#4c4a44', water: '#26424a',
    decor: ['tomb', 'tomb', 'cross', 'deadtree', 'deadtree', 'bush', 'rock', 'crypt'],
    times: ['night', 'night', 'dusk', 'night', 'dawn'], weather: ['fog', 'fog', 'clear', 'rain'],
    mobs: [['skeleton', 1], ['bucket', 4], ['ghost', 8], ['necro', 14], ['bats', 20]],
    boss: 'graveLord',
  },
  {
    id: 'tundra', name: 'Frostfall Tundra', short: 'Tundra', lat: 68, lon: 100,
    blurb: 'Frozen bodies thaw and march across the ice. Cold barely slows them here.',
    ground: ['#d9e2e8', '#e6edf1', '#c9d4dc'], road: '#9aa6b0', roadEdge: '#6f7b86', water: '#2b5a78',
    decor: ['pine', 'pine', 'pine', 'snowrock', 'snowrock', 'cabin', 'log'],
    times: ['day', 'dusk', 'day', 'night', 'dawn'], weather: ['snow', 'snow', 'clear', 'fog'],
    mobs: [['frosty', 1], ['brute', 5], ['medic', 10]],
    boss: 'abomination',
  },
  {
    id: 'swamp', name: 'Black Bayou', short: 'Bayou', lat: 4, lon: -62,
    blurb: 'Toxic runoff has made the swamp dead swell up. Pop them before they burst.',
    ground: ['#4c5a2e', '#57663a', '#434f27'], road: '#6b5b45', roadEdge: '#463b2c', water: '#3a4f2c',
    decor: ['cypress', 'cypress', 'reeds', 'barrel', 'mushroom', 'deadtree', 'shack'],
    times: ['dusk', 'day', 'night', 'dusk', 'dawn'], weather: ['mist', 'mist', 'rain', 'clear'],
    mobs: [['bloater', 1], ['imp', 1]],
    boss: 'behemoth',
  },
];

// ============================================================
// Zombies
// ============================================================
// look.kind picks the drawing routine; flying zombies ignore the road and need anti-air towers.
const ZOMBIES = {
  walker:   { name: 'Shambler', hp: 30, speed: 44, reward: 4, r: 12,
    desc: 'Slow and relentless. There are always more.',
    look: { kind: 'human', skin: '#8c9a72', shirt: '#6b5a4a', hair: '#3b3026' } },
  runner:   { name: 'Runner', hp: 18, speed: 92, reward: 5, r: 10,
    desc: 'Fresh and fast. Fragile, but hard to track.',
    look: { kind: 'human', skin: '#a3a27c', shirt: '#8a3b34', hair: '#2a2420', lean: true } },
  cone:     { name: 'Conehead', hp: 55, speed: 42, armor: 3, reward: 6, r: 12,
    desc: 'A traffic cone on its head soaks up light rounds.',
    look: { kind: 'human', skin: '#8c9a72', shirt: '#3f5f63', gear: 'cone' } },
  digger:   { name: 'Tunneler', hp: 45, speed: 50, reward: 6, r: 12, burrow: [0.1, 0.48],
    desc: 'Burrows under the first stretch of road. Only a submarine\'s sonar can reveal it.',
    look: { kind: 'human', skin: '#929a6c', shirt: '#8a6a3a', gear: 'hardhat' } },
  carrion:  { name: 'Carrion Crow', hp: 22, speed: 70, reward: 5, r: 10, fly: true,
    desc: 'Infected crows that cut across the road\'s corners. Only anti-air towers can hit them.',
    look: { kind: 'crow' } },
  skeleton: { name: 'Skeleton', hp: 20, speed: 66, reward: 2, r: 10,
    desc: 'Bone and spite. Comes in crowds.',
    look: { kind: 'skeleton' } },
  bucket:   { name: 'Riot Zombie', hp: 110, speed: 38, armor: 7, reward: 9, r: 13,
    desc: 'Riot helmet and vest. Snipers, Tesla and submarines punch through.',
    look: { kind: 'human', skin: '#7f8d68', shirt: '#2c3036', gear: 'riot' } },
  ghost:    { name: 'Wraith', hp: 45, speed: 62, reward: 6, r: 12, noSlow: true,
    desc: 'Drifts like smoke and cannot be slowed.',
    look: { kind: 'ghost' } },
  necro:    { name: 'Necromancer', hp: 90, speed: 36, reward: 12, r: 13, summon: { type: 'skeleton', n: 2, every: 5 },
    desc: 'Raises skeletons from the ground every few seconds.',
    look: { kind: 'human', skin: '#8a9670', shirt: '#2e2440', gear: 'hood', staff: true } },
  bats:     { name: 'Bat Swarm', hp: 16, speed: 84, reward: 3, r: 9, fly: true,
    desc: 'A fast cloud of bats that flies over the road. Only anti-air towers can hit it.',
    look: { kind: 'bat' } },
  brute:    { name: 'Brute', hp: 280, speed: 30, armor: 2, reward: 16, r: 18, lives: 3,
    desc: 'A hulking mass of muscle. Costs 3 lives if it gets in.',
    look: { kind: 'human', skin: '#7d8a60', shirt: '#4d3b2c', wide: true } },
  frosty:   { name: 'Frostbite', hp: 70, speed: 48, armor: 2, reward: 7, r: 12, noSlow: true,
    desc: 'Frozen solid, so cryo does nothing.',
    look: { kind: 'human', skin: '#a9c2cf', shirt: '#3c4f66', gear: 'ice' } },
  medic:    { name: 'Plague Doctor', hp: 80, speed: 40, reward: 12, r: 12, heal: { every: 3, pct: 0.12, radius: 1.8 },
    desc: 'Patches up nearby zombies. Take it out first.',
    look: { kind: 'human', skin: '#8c9a72', shirt: '#d9d6cc', gear: 'mask', cross: true } },
  bloater:  { name: 'Bloater', hp: 90, speed: 34, reward: 8, r: 16, splits: { type: 'imp', n: 3 },
    desc: 'Swollen with toxic gas. Bursts into three Crawlers.',
    look: { kind: 'bloater', skin: '#86935a' } },
  imp:      { name: 'Crawler', hp: 14, speed: 80, reward: 1, r: 8,
    desc: 'Drags itself along fast and low.',
    look: { kind: 'human', skin: '#8f9b6a', shirt: '#4a4038', small: true } },
  juggernaut: { name: 'Juggernaut', hp: 700, speed: 26, armor: 6, reward: 70, r: 22, lives: 8, boss: true, mini: true,
    desc: 'Wrapped in scrap armor plating. Shows up every tenth level.',
    look: { kind: 'human', skin: '#76835c', shirt: '#55585e', gear: 'plate', wide: true } },
  harvester: { name: 'The Harvester', hp: 1400, speed: 24, armor: 4, reward: 150, r: 25, lives: 10, boss: true,
    summon: { type: 'runner', n: 2, every: 6 },
    desc: 'The farm\'s first victim, still swinging its scythe. Calls Runners ahead.',
    look: { kind: 'human', skin: '#7f8c62', shirt: '#4b3a28', gear: 'straw', wide: true, scythe: true } },
  graveLord: { name: 'Grave Lord', hp: 2000, speed: 22, armor: 5, reward: 180, r: 26, lives: 10, boss: true,
    summon: { type: 'skeleton', n: 3, every: 4.5 },
    desc: 'Raises an army of skeletons as it walks.',
    look: { kind: 'human', skin: '#7a8668', shirt: '#1d1828', gear: 'hood', staff: true, wide: true } },
  abomination: { name: 'Abomination', hp: 2800, speed: 22, armor: 8, reward: 220, r: 28, lives: 12, boss: true, noSlow: true,
    stomp: { every: 7, radius: 2.6, dur: 2 },
    desc: 'A frozen giant. Its stomp ices nearby towers.',
    look: { kind: 'giant', skin: '#b8c8d0' } },
  behemoth: { name: 'Behemoth', hp: 2600, speed: 20, armor: 4, reward: 260, r: 30, lives: 15, boss: true,
    summon: { type: 'imp', n: 3, every: 5 }, splits: { type: 'bloater', n: 3 },
    desc: 'Leaks Crawlers, then bursts into three Bloaters.',
    look: { kind: 'bloater', skin: '#7c8a48' } },
};

// How many of each zombie a wave holds, and how tightly they bunch up.
const WEIGHT = { walker: 1, runner: 0.6, cone: 0.4, digger: 0.3, carrion: 0.25, skeleton: 0.55, bucket: 0.25, ghost: 0.35,
  necro: 0.1, bats: 0.3, brute: 0.12, frosty: 0.35, medic: 0.09, bloater: 0.18, imp: 0.5 };
const GAP = { walker: 0.8, runner: 0.45, cone: 0.95, digger: 1.1, carrion: 0.6, skeleton: 0.5, bucket: 1.3, ghost: 0.8,
  necro: 3, bats: 0.3, brute: 2.6, frosty: 0.9, medic: 3, bloater: 1.8, imp: 0.35 };

// ============================================================
// Towers
// ============================================================
// place: 'land' or 'water'. air: can shoot flying zombies. unlock: level id that unlocks it for free, or buy it for coins.
const TOWERS = {
  gunner: {
    name: 'Machine Gunner', role: 'Rapid fire', place: 'land', air: true, cost: 60, key: '1',
    desc: 'A soldier on a light machine gun. Shreds crowds of weak zombies and shoots down flyers.',
    levels: [
      { name: 'Machine Gunner', dmg: 5, rate: 0.3, range: 2.6 },
      { name: 'Extended Mag', dmg: 7, rate: 0.24, range: 2.8, cost: 70 },
      { name: 'AP Rounds', dmg: 10, rate: 0.2, range: 3.0, pierce: 0.5, cost: 140 },
      { name: 'Twin Guns', dmg: 12, rate: 0.14, range: 3.3, pierce: 0.7, cost: 260, twin: true },
    ],
  },
  sniper: {
    name: 'Sniper', role: 'Long range', place: 'land', air: true, cost: 150, key: '2',
    desc: 'Huge range and heavy hits that punch through armor. Targets the strongest zombie.',
    levels: [
      { name: 'Sniper', dmg: 45, rate: 2.2, range: 5.5, pierce: 0.5 },
      { name: 'Better Scope', dmg: 80, rate: 2.0, range: 6.0, pierce: 0.6, cost: 140 },
      { name: 'Hollow Points', dmg: 140, rate: 1.8, range: 6.8, pierce: 0.75, cost: 250 },
      { name: 'Anti-Materiel Rifle', dmg: 240, rate: 1.5, range: 8.0, pierce: 1, cost: 420 },
    ],
  },
  mortar: {
    name: 'Mortar Team', role: 'Splash', place: 'land', air: false, cost: 90, key: '3',
    desc: 'Lobs shells that blast whole crowds. Cannot hit flyers.',
    levels: [
      { name: 'Mortar Team', dmg: 14, rate: 1.6, range: 2.5, splash: 0.9 },
      { name: 'Heavy Shells', dmg: 24, rate: 1.5, range: 2.6, splash: 1.0, cost: 90 },
      { name: 'High Explosive', dmg: 38, rate: 1.35, range: 2.8, splash: 1.15, cost: 170 },
      { name: 'Artillery', dmg: 60, rate: 1.2, range: 3.0, splash: 1.35, cost: 300 },
    ],
  },
  cryo: {
    name: 'Cryo Cannon', role: 'Slow', place: 'land', air: false, cost: 80, key: '4', unlock: 2, price: 120,
    desc: 'Fires freezing canisters that slow zombies. Wraiths and Frostbites shrug it off.',
    levels: [
      { name: 'Cryo Cannon', dmg: 3, rate: 1.1, range: 2.3, splash: 0.7, slow: 0.35, slowDur: 1.4 },
      { name: 'Deep Freeze', dmg: 5, rate: 1.0, range: 2.5, splash: 0.8, slow: 0.45, slowDur: 1.7, cost: 70 },
      { name: 'Liquid Nitrogen', dmg: 8, rate: 0.9, range: 2.7, splash: 0.9, slow: 0.55, slowDur: 2.0, cost: 130 },
      { name: 'Absolute Zero', dmg: 12, rate: 0.75, range: 3.0, splash: 1.05, slow: 0.65, slowDur: 2.4, cost: 220 },
    ],
  },
  gunboat: {
    name: 'Gunboat', role: 'Water only', place: 'water', air: true, cost: 140, key: '5', unlock: 4, price: 150,
    desc: 'A patrol boat with a deck gun. Must be placed on water.',
    levels: [
      { name: 'Gunboat', dmg: 10, rate: 0.7, range: 3.0, splash: 0.6 },
      { name: 'Twin Deck Guns', dmg: 10, rate: 0.5, range: 3.2, splash: 0.6, cost: 120, twin: true },
      { name: 'Grapeshot', dmg: 16, rate: 0.5, range: 3.3, splash: 0.85, cost: 200, twin: true },
      { name: 'Destroyer', dmg: 28, rate: 0.4, range: 3.7, splash: 0.95, cost: 380, twin: true },
    ],
  },
  flame: {
    name: 'Flamethrower', role: 'Burn', place: 'land', air: false, cost: 110, key: '6', unlock: 7, price: 220,
    desc: 'Short-range fire that sets crowds alight. Burning ignores armor.',
    levels: [
      { name: 'Flamethrower', dmg: 4, rate: 0.32, range: 1.9, splash: 0.75, burn: 6, burnDur: 2 },
      { name: 'Pressurized Tank', dmg: 6, rate: 0.28, range: 2.0, splash: 0.8, burn: 10, burnDur: 2.2, cost: 90 },
      { name: 'Napalm', dmg: 9, rate: 0.24, range: 2.2, splash: 0.9, burn: 16, burnDur: 2.5, cost: 160 },
      { name: 'Inferno', dmg: 14, rate: 0.2, range: 2.4, splash: 1.0, burn: 26, burnDur: 3, cost: 280 },
    ],
  },
  tesla: {
    name: 'Tesla Coil', role: 'Chain', place: 'land', air: true, cost: 130, key: '7', unlock: 12, price: 350,
    desc: 'Lightning arcs between zombies and ignores armor.',
    levels: [
      { name: 'Tesla Coil', dmg: 11, rate: 1.25, range: 2.4, chain: 3 },
      { name: 'Capacitor Bank', dmg: 17, rate: 1.15, range: 2.6, chain: 4, cost: 120 },
      { name: 'Storm Coil', dmg: 26, rate: 1.0, range: 2.8, chain: 5, cost: 210 },
      { name: 'Thunderhead', dmg: 40, rate: 0.85, range: 3.1, chain: 7, cost: 340 },
    ],
  },
  heli: {
    name: 'Gunship', role: 'Flying', place: 'land', air: true, cost: 260, key: '8', unlock: 18, price: 500,
    desc: 'A helicopter that flies to the leading zombie anywhere on the map and hoses it down.',
    levels: [
      { name: 'Gunship', dmg: 4, rate: 0.14, range: 2.0, speed: 140 },
      { name: 'Heavy Rotors', dmg: 5, rate: 0.11, range: 2.2, speed: 180, cost: 200 },
      { name: 'Rocket Pods', dmg: 6, rate: 0.11, range: 2.3, speed: 190, rocket: 30, rocketRate: 1.5, cost: 320 },
      { name: 'Apex Gunship', dmg: 9, rate: 0.08, range: 2.5, speed: 220, rocket: 60, rocketRate: 1.1, cost: 520 },
    ],
  },
  sub: {
    name: 'Submarine', role: 'Water only', place: 'water', air: true, cost: 180, key: '9', unlock: 30, price: 700,
    desc: 'Fires homing missiles from the water. Its sonar reveals Tunnelers so every tower can hit them.',
    levels: [
      { name: 'Submarine', dmg: 24, rate: 1.3, range: 3.2, pierce: 0.6, sonar: true },
      { name: 'Sonar Array', dmg: 24, rate: 1.2, range: 3.8, pierce: 0.6, sonar: true, cost: 150 },
      { name: 'Twin Tubes', dmg: 30, rate: 1.1, range: 3.9, pierce: 0.7, sonar: true, missiles: 2, cost: 260 },
      { name: 'Nuclear Sub', dmg: 60, rate: 1.0, range: 4.2, pierce: 1, sonar: true, missiles: 2, cost: 480 },
    ],
  },
  jet: {
    name: 'Fighter Jet', role: 'Flying', place: 'land', air: true, cost: 300, key: '0', unlock: 40, price: 900,
    desc: 'Circles its airstrip at speed and fires homing missiles at anything below.',
    levels: [
      { name: 'Fighter Jet', dmg: 18, rate: 0.9, range: 2.6, missiles: 1, orbit: 2.8 },
      { name: 'Afterburners', dmg: 18, rate: 0.7, range: 2.8, missiles: 2, orbit: 3.0, cost: 240 },
      { name: 'Cluster Missiles', dmg: 26, rate: 0.7, range: 3.0, missiles: 2, splash: 0.6, orbit: 3.1, cost: 380 },
      { name: 'Strike Wing', dmg: 40, rate: 0.55, range: 3.2, missiles: 4, splash: 0.7, orbit: 3.2, cost: 600 },
    ],
  },
};
const TOWER_KEYS = Object.keys(TOWERS);
const MODES = [['first', 'First'], ['last', 'Last'], ['strong', 'Strongest'], ['close', 'Closest']];

// ============================================================
// Store: permanent upgrades and one-use supplies, bought with coins earned from levels.
// ============================================================
const UPGRADES = {
  cash:     { name: 'War Chest', desc: '+$60 starting cash in every level.', prices: [100, 200, 350, 550, 800] },
  walls:    { name: 'Reinforced Walls', desc: '+3 lives in every level.', prices: [120, 240, 400, 600, 900] },
  discount: { name: 'Bulk Orders', desc: 'Towers and upgrades cost 4% less.', prices: [150, 300, 500, 750, 1000] },
  salvage:  { name: 'Salvage Crew', desc: 'Selling refunds 5% more.', prices: [100, 250, 500] },
  bounty:   { name: 'Bounty Hunter', desc: '+6% cash from every kill.', prices: [150, 300, 500, 750, 1100] },
};
const SUPPLIES = {
  airstrike: { name: 'Airstrike', desc: 'Call in bombs on any spot you tap. Wrecks everything nearby.', price: 80 },
  cryobomb:  { name: 'Cryo Bomb', desc: 'Freezes every zombie on the field for 3 seconds.', price: 60 },
  supply:    { name: 'Supply Drop', desc: 'Instant cash for building, scaled to the level.', price: 50 },
  medkit:    { name: 'Field Repairs', desc: 'Restores 5 lives.', price: 70 },
};

// ============================================================
// Difficulty
// ============================================================
// The level's campaign bonus phases in over the first waves, since every level starts from an empty field.
const effWave = (L, n) => n + L.diff * Math.min(1, n / 6);
function hpScale(e) { return 1 + 0.1 * (e - 1) + 0.016 * (e - 1) * (e - 1); }
function waveBonus(L, n) { return Math.round(20 + effWave(L, n) * 3); }
