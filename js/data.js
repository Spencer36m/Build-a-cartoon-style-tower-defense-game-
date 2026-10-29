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
function rgba(h, a) {
  const m = h[0] === '#' ? null : h.match(/\d+(\.\d+)?/g);
  const [r, g, b] = m ? m.slice(0, 3).map(Number) : hexRgb(h);
  return `rgba(${r},${g},${b},${a})`;
}

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
  // the paid expansion: open to players who own it once they have cleared the farmland
  {
    id: 'desert', name: 'Red Mesa Wasteland', short: 'Desert', lat: 12, lon: 4, expansion: true,
    blurb: 'Past the last town the land burns dry. Old army bases and dead oil fields hide where the outbreak began.',
    ground: ['#d4a768', '#e0b878', '#c09056'], road: '#9a7a52', roadEdge: '#6a5034', water: '#2f7f86',
    decor: ['cactus', 'cactus', 'sagebrush', 'sagebrush', 'skull', 'mesa', 'mesa', 'wreck', 'pumpjack', 'drums', 'outpost'],
    times: ['day', 'day', 'dusk', 'dawn', 'night'], weather: ['clear', 'heat', 'sandstorm', 'clear'],
    mobs: [['mummy', 1], ['scorpion', 3], ['vulture', 10]],
    // zombies from earlier worlds that would look wrong out here
    skipOld: ['frosty'],
    boss: 'colossus',
  },
  // the campaign's last world, after the bayou: Kessler-Vane's home city
  {
    id: 'city', name: 'Fallen City', short: 'City', lat: -30, lon: 15, snapLand: true,
    blurb: 'Kessler-Vane Tower still stands over the dead city. Fight block by block, street by street, to the man who started it all.',
    ground: ['#6e6e6a', '#7a7a76', '#62625e'], road: '#3c3e42', roadEdge: '#8a8a86', water: '#2c4a58',
    decor: ['skyscraper', 'skyscraper', 'skyscraper', 'office', 'office', 'shop', 'shop', 'apartment', 'apartment', 'gasstation', 'parking', 'bus', 'taxi', 'hydrant', 'streetlight', 'barricade', 'dumpster', 'planter'],
    // starts a little below where the bayou ends: the streets leave less room to build
    diff: [5, 0.03],
    times: ['night', 'dusk', 'night', 'day', 'dawn'], weather: ['rain', 'clear', 'fog', 'rain'],
    mobs: [['suit', 1], ['swat', 4], ['drone', 10]],
    boss: 'chairman',
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
  mummy:    { name: 'Mummy', hp: 120, speed: 36, armor: 3, reward: 9, r: 13, burnMult: 2,
    desc: 'Wrapped in old, dry bandages. Tough, but fire burns it twice as hard.',
    look: { kind: 'human', skin: '#a89a76', shirt: '#cfc3a0' } },
  scorpion: { name: 'Dune Scorpion', hp: 42, speed: 80, armor: 4, reward: 7, r: 11,
    desc: 'Scuttles fast under a hard shell that shrugs off light rounds.',
    look: { kind: 'scorpion' } },
  vulture:  { name: 'Vulture', hp: 48, speed: 64, reward: 7, r: 13, fly: true,
    desc: 'Circles over the dead and dives across the road\'s corners. Only anti-air towers can hit it.',
    look: { kind: 'crow' } },
  suit:     { name: 'Office Worker', hp: 40, speed: 56, reward: 5, r: 12,
    desc: 'Still in a suit and tie. Pours out of the towers in fast, packed crowds.',
    look: { kind: 'human', skin: '#9aa080', shirt: '#2a2e36' } },
  swat:     { name: 'SWAT Zombie', hp: 150, speed: 36, armor: 7, reward: 11, r: 13,
    desc: 'Body armor and a helmet. Snipers, Tesla, fire and armor-piercing rounds get through.',
    look: { kind: 'human', skin: '#7f8d68', shirt: '#1c1f24', gear: 'riot' } },
  drone:    { name: 'Hunter Drone', hp: 42, speed: 70, armor: 1, reward: 7, r: 11, fly: true,
    desc: 'A Kessler-Vane security drone the hive has taken over. It flies the corners; only anti-air towers can hit it.',
    look: { kind: 'drone' } },
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
  colossus: { name: 'Sand Colossus', hp: 3400, speed: 19, armor: 7, reward: 300, r: 32, lives: 15, boss: true,
    summon: { type: 'scorpion', n: 2, every: 5 }, stomp: { every: 8, radius: 2.4, dur: 1.6, sand: true },
    desc: 'A giant of living sandstone. Scorpions pour out of its cracks, and its stomp buries nearby towers.',
    look: { kind: 'giant', skin: '#c9a46a' } },
  chairman: { name: 'The Chairman', hp: 3800, speed: 18, armor: 8, reward: 340, r: 33, lives: 15, boss: true,
    heal: { every: 4, pct: 0.08, radius: 2.6 }, summon: { type: 'swat', n: 1, every: 6 },
    desc: 'Silas Vane, grown into a giant by a seed of his own. Heals the horde around him and calls in his SWAT guard.',
    look: { kind: 'giant', skin: '#b8a8c8' } },
};

// How many of each zombie a wave holds, and how tightly they bunch up.
const WEIGHT = { walker: 1, runner: 0.6, cone: 0.4, digger: 0.3, carrion: 0.25, skeleton: 0.55, bucket: 0.25, ghost: 0.35,
  necro: 0.1, bats: 0.3, brute: 0.12, frosty: 0.35, medic: 0.09, bloater: 0.18, imp: 0.5, mummy: 0.4, scorpion: 0.45, vulture: 0.25, suit: 0.6, swat: 0.22, drone: 0.2 };
const GAP = { walker: 0.8, runner: 0.45, cone: 0.95, digger: 1.1, carrion: 0.6, skeleton: 0.5, bucket: 1.3, ghost: 0.8,
  necro: 3, bats: 0.3, brute: 2.6, frosty: 0.9, medic: 3, bloater: 1.8, imp: 0.35, mummy: 1.1, scorpion: 0.5, vulture: 0.6, suit: 0.45, swat: 1.4, drone: 0.55 };

// ============================================================
// Towers
// ============================================================
// place: 'land' or 'water'. air: can shoot flying zombies. unlock: level id that unlocks it for free, or buy it for coins.
// Every tower has three upgrade paths of five tiers. Only two paths can be upgraded, and only one past tier 2.
// fx: a number adds to the stat, '*stat' multiplies it, anything else replaces it. cost overrides the usual price.
const TOWERS = {
  gunner: {
    name: 'Machine Gunner', role: 'Rapid fire', place: 'land', air: true, cost: 60, key: '1',
    desc: 'A soldier on a light machine gun. Upgrades turn it into a laser cannon, a walking rocket mech or a gun bunker.',
    base: { dmg: 5, rate: 0.3, range: 2.6 },
    paths: [
      { name: 'Energy', ups: [
        { name: 'Focused Fire', desc: 'Tighter bursts, fired faster and further.', fx: { '*rate': 0.8, range: 0.2 } },
        { name: 'Faster Spin', desc: 'The barrels spin up a third faster.', fx: { '*rate': 0.75 } },
        { name: 'Laser Cannon', desc: 'A fully automatic laser that cuts through every zombie in a line, armor and all.', fx: { dmg: 4, beam: 0.35, pierce: 1 } },
        { name: 'Plasma Accelerator', desc: 'A plasma beam that melts straight through the horde.', fx: { '*rate': 0.5, dmg: 8, beam: 0.25, range: 0.4 } },
        { name: 'Doom Ray', desc: 'A colossal ray that fires non-stop across the whole map.', fx: { '*rate': 0.5, dmg: 30, beam: 0.35, range: 99 } },
      ] },
      { name: 'Heavy', ups: [
        { name: 'Power Rounds', desc: 'Heavier bullets hit 60% harder.', fx: { dmg: 3 } },
        { name: 'Depleted Rounds', desc: 'Dense rounds punch through helmets and riot gear.', fx: { dmg: 2, pierce: 0.6 } },
        { name: 'Rocket Pods', desc: 'Shoulder pods fire two missiles every second.', fx: { rocket: 25, rocketRate: 1.1, rockets: 2, rocketSplash: 0.6 } },
        { name: 'Rocket Storm', desc: 'Six missiles a volley, fired faster.', fx: { rocket: 15, rockets: 4, '*rocketRate': 0.7 } },
        { name: 'Siege Mech', desc: 'The gunner climbs into a walking mech with twin rocket pods and heavy guns.', fx: { dmg: 15, shots: 1, rocket: 80, rockets: 4, rocketSplash: 0.4, range: 0.6 } },
      ] },
      { name: 'Spread', ups: [
        { name: 'Swivel Mount', desc: 'Turns and fires faster, with more range.', fx: { '*rate': 0.85, range: 0.3 } },
        { name: 'Lock and Load', desc: 'Faster reloads and harder hits.', fx: { '*rate': 0.85, dmg: 1 } },
        { name: 'Buckshot', desc: 'A shotgun blast hits a whole group and knocks them back.', fx: { dmg: 3, spread: 4, knockChance: 0.25, knock: 10 } },
        { name: 'Gun Bunker', desc: 'A concrete bunker with guns on every side: four targets at once.', fx: { targets: 3, dmg: 4, range: 0.3 } },
        { name: 'Fortress', desc: 'A fortress bristling with guns that fires at eight zombies at once.', fx: { targets: 4, dmg: 10, '*rate': 0.6, range: 0.4, detect: true } },
      ] },
    ],
  },
  sniper: {
    name: 'Sniper', role: 'Long range', place: 'land', air: true, cost: 150, key: '2',
    desc: 'Huge range and heavy hits that punch through armor. Can go fully automatic or become a railgun.',
    base: { dmg: 45, rate: 2.2, range: 5.5, pierce: 0.5 },
    paths: [
      { name: 'Rifle', ups: [
        { name: 'Heavy Rounds', desc: 'Heavier bullets deal more damage.', fx: { dmg: 25 } },
        { name: 'Match Grade', desc: 'Precision ammo hits harder and pierces more armor.', fx: { dmg: 35, pierce: 0.2 } },
        { name: 'Anti-Materiel Rifle', desc: 'A .50 calibre rifle that ignores armor completely.', fx: { dmg: 95, pierce: 0.3 } },
        { name: 'Deadeye', desc: 'One in four shots is a critical hit for 4× damage.', fx: { dmg: 100, critChance: 0.25, critMult: 4 } },
        { name: 'Railgun', desc: 'An electromagnetic rail gun. Every shot pierces all zombies in a line and stuns them.', fx: { dmg: 520, beam: 0.3, stunChance: 1, stunDur: 0.4 } },
      ] },
      { name: 'Action', ups: [
        { name: 'Quick Cycle', desc: 'Works the bolt faster.', fx: { '*rate': 0.8 } },
        { name: 'Semi-Auto', desc: 'A semi-automatic rifle fires much faster.', fx: { '*rate': 0.7 } },
        { name: 'Battle Rifle', desc: 'Fires twice as fast.', fx: { '*rate': 0.5, dmg: 5 } },
        { name: 'Full Auto', desc: 'Fully automatic: empties a magazine in seconds. Some shots stun.', fx: { '*rate': 0.45, dmg: 10, stunChance: 0.15, stunDur: 0.5 } },
        { name: 'Twin Marksmen', desc: 'A second sniper joins and hits a second target.', fx: { '*rate': 0.7, dmg: 40, shots: 1 } },
      ] },
      { name: 'Intel', ups: [
        { name: 'Long Scope', desc: 'Much longer range and better shots.', fx: { range: 1.5, dmg: 12 } },
        { name: 'Thermal Scope', desc: 'Sees heat underground, so it can hit Tunnelers.', fx: { range: 1, dmg: 15, detect: true } },
        { name: 'Bounty Contracts', desc: 'Earns $4 extra for every zombie it kills.', fx: { dmg: 15, killBonus: 4 } },
        { name: 'Supply Runs', desc: 'Earns $90 after every wave.', fx: { income: 90 } },
        { name: 'Overwatch', desc: 'Every tower on the map hits 15% harder and spots Tunnelers.', fx: { income: 60, dmg: 40, aura: { range: 99, dmg: 1.15, detect: true } } },
      ] },
    ],
  },
  mortar: {
    name: 'Mortar Team', role: 'Splash', place: 'land', air: false, cost: 90, key: '3',
    desc: 'Lobs shells that blast whole crowds. Cannot hit flyers until upgraded.',
    base: { dmg: 14, rate: 1.6, range: 2.5, splash: 0.9 },
    paths: [
      { name: 'Warhead', ups: [
        { name: 'Heavy Shells', desc: 'Bigger shells hit harder.', fx: { dmg: 8 } },
        { name: 'High Explosive', desc: 'More damage in a wider blast.', fx: { dmg: 10, splash: 0.15 } },
        { name: 'Cluster Shells', desc: 'Each shell scatters five bomblets.', fx: { cluster: 5 } },
        { name: 'Thermobaric', desc: 'A huge fireball that burns everything it touches.', fx: { dmg: 40, splash: 0.2, burn: 15, burnDur: 2.5 } },
        { name: 'Earthshaker', desc: 'Earth-shaking blasts that stun the whole crowd.', fx: { dmg: 130, splash: 0.3, cluster: 3, stunChance: 1, stunDur: 0.8 } },
      ] },
      { name: 'Crew', ups: [
        { name: 'Quick Load', desc: 'Reloads 25% faster.', fx: { '*rate': 0.8 } },
        { name: 'Second Crew', desc: 'A loader joins the team.', fx: { '*rate': 0.8 } },
        { name: 'Twin Tubes', desc: 'Fires two shells at once.', fx: { shots: 1 } },
        { name: 'Rapid Barrage', desc: 'Shells rain down nearly twice as fast.', fx: { '*rate': 0.55, dmg: 6 } },
        { name: 'Artillery Battery', desc: 'Four tubes firing non-stop.', fx: { '*rate': 0.6, dmg: 20, shots: 2 } },
      ] },
      { name: 'Fire Control', ups: [
        { name: 'Rangefinder', desc: 'More range and more accurate shells.', fx: { range: 1, dmg: 5 } },
        { name: 'Flak Shells', desc: 'Airburst shells can hit flying zombies.', fx: { air: true, dmg: 5 } },
        { name: 'Shrapnel', desc: 'Jagged fragments strip armor.', fx: { pierce: 0.5, shred: 2 } },
        { name: 'Forward Observer', desc: 'Can shell any zombie on the map, Tunnelers too.', fx: { dmg: 15, range: 99, detect: true } },
        { name: 'Long Tom', desc: 'A heavy field gun with a giant blast.', fx: { dmg: 80, splash: 0.4, '*rate': 0.7 } },
      ] },
    ],
  },
  cryo: {
    name: 'Cryo Cannon', role: 'Slow', place: 'land', air: false, cost: 80, key: '4', unlock: 2, price: 120,
    desc: 'Fires freezing canisters that slow zombies. Wraiths and Frostbites shrug off the slow.',
    base: { dmg: 3, rate: 1.1, range: 2.3, splash: 0.7, slow: 0.35, slowDur: 1.4 },
    paths: [
      { name: 'Chill', ups: [
        { name: 'Deep Freeze', desc: 'Slows zombies even more.', fx: { slow: 0.1 } },
        { name: 'Lasting Cold', desc: 'The slow lasts much longer.', fx: { slowDur: 1.2 } },
        { name: 'Flash Freeze', desc: 'Sometimes freezes zombies solid for a moment.', fx: { stunChance: 0.35, stunDur: 0.9 } },
        { name: 'Brittle', desc: 'Chilled zombies take 35% more damage from everything.', fx: { slow: 0.1, brittle: 0.35 } },
        { name: 'Absolute Zero', desc: 'Freezes every zombie it hits and leaves them shattering.', fx: { dmg: 20, slow: 0.05, brittle: 0.25, stunChance: 0.65, stunDur: 0.3 } },
      ] },
      { name: 'Payload', ups: [
        { name: 'Bigger Canisters', desc: 'A wider freezing blast.', fx: { splash: 0.25 } },
        { name: 'Ice Shards', desc: 'Razor ice deals real damage.', fx: { dmg: 6 } },
        { name: 'Frag Canisters', desc: 'Shrapnel ice cuts through armor.', fx: { dmg: 12, pierce: 0.5 } },
        { name: 'Blizzard', desc: 'Fires faster in a huge cloud.', fx: { '*rate': 0.6, splash: 0.35, dmg: 10 } },
        { name: 'Cryo Storm', desc: 'Three canisters at once, twice as fast.', fx: { '*rate': 0.5, dmg: 40, shots: 2 } },
      ] },
      { name: 'Systems', ups: [
        { name: 'Extended Tubes', desc: 'More range and colder canisters.', fx: { range: 0.6, dmg: 3, slow: 0.05 } },
        { name: 'Coolant Mist', desc: 'A chilling mist slows every zombie in range.', fx: { fieldSlow: 0.2 } },
        { name: 'Anti-Air Mist', desc: 'Can freeze flying zombies.', fx: { air: true } },
        { name: 'Permafrost', desc: 'The ground freezes over and the mist hurts.', fx: { fieldSlow: 0.15, fieldDps: 8, '*rate': 0.8 } },
        { name: 'Glacier', desc: 'A field of deadly cold across a wide area.', fx: { fieldSlow: 0.15, fieldDps: 30, range: 0.8 } },
      ] },
    ],
  },
  gunboat: {
    name: 'Gunboat', role: 'Water only', place: 'water', air: true, cost: 140, key: '5', unlock: 4, price: 150,
    desc: 'A patrol boat with a deck gun. Must be placed on water.',
    base: { dmg: 10, rate: 0.7, range: 3.0, splash: 0.6 },
    paths: [
      { name: 'Deck Guns', ups: [
        { name: 'Second Turret', desc: 'A second deck gun.', fx: { shots: 1 } },
        { name: 'Autoloaders', desc: 'Fires a third faster.', fx: { '*rate': 0.75 } },
        { name: 'Grapeshot', desc: 'Shells spray a wide cloud of shot.', fx: { dmg: 8, splash: 0.25 } },
        { name: 'Destroyer', desc: 'A destroyer with three heavy turrets.', fx: { dmg: 14, '*rate': 0.7, range: 0.5, shots: 1 } },
        { name: 'Battleship', desc: 'Four huge naval guns that level the shoreline.', fx: { dmg: 60, splash: 0.5, '*rate': 0.7, range: 1, shots: 1 } },
      ] },
      { name: 'Trade', ups: [
        { name: 'Cargo Runs', desc: 'Earns $20 after every wave.', fx: { income: 20 }, cost: 70 },
        { name: 'Merchant Fleet', desc: 'Earns $50 after every wave.', fx: { income: 30 }, cost: 130 },
        { name: 'Smuggler Routes', desc: 'Earns $115 after every wave.', fx: { income: 65 }, cost: 300 },
        { name: 'Trade Empire', desc: 'Earns $265 a wave. Nearby towers hit 10% harder.', fx: { income: 150, aura: { range: 3, dmg: 1.1 } }, cost: 720 },
        { name: 'Shipping Magnate', desc: 'Earns $655 after every wave.', fx: { income: 390 }, cost: 1800 },
      ] },
      { name: 'Armament', ups: [
        { name: 'Lookout', desc: 'More range and sharper gunnery.', fx: { range: 0.6, dmg: 4 } },
        { name: 'Depth Charges', desc: 'Can hit Tunnelers and fires faster.', fx: { detect: true, '*rate': 0.85 } },
        { name: 'Harpoons', desc: 'Harpoon guns that punch through armor.', fx: { dmg: 6, pierce: 0.6 } },
        { name: 'AA Battery', desc: 'Adds a missile launcher that fires two missiles.', fx: { rocket: 30, rocketRate: 0.9, rockets: 2, rocketSplash: 0.4 } },
        { name: 'Cruise Missiles', desc: 'Launches heavy cruise missiles in volleys.', fx: { rocket: 140, '*rocketRate': 0.65, rockets: 1, rocketSplash: 0.5 } },
      ] },
    ],
  },
  flame: {
    name: 'Flamethrower', role: 'Burn', place: 'land', air: false, cost: 110, key: '6', unlock: 7, price: 220,
    desc: 'Short-range fire that sets crowds alight. Burning ignores armor.',
    base: { dmg: 4, rate: 0.32, range: 1.9, splash: 0.75, burn: 6, burnDur: 2 },
    paths: [
      { name: 'Fuel', ups: [
        { name: 'Pressurized Tank', desc: 'Fire burns hotter.', fx: { burn: 4 } },
        { name: 'Napalm', desc: 'Sticky fuel burns hotter and longer.', fx: { burn: 6, burnDur: 0.5 } },
        { name: 'White Phosphorus', desc: 'Burns through armor and keeps burning.', fx: { burn: 14, pierce: 1 } },
        { name: 'Inferno', desc: 'A raging fire that melts crowds.', fx: { burn: 30, burnDur: 1, dmg: 6 } },
        { name: 'Hellfire', desc: 'Flames so hot even bosses melt.', fx: { burn: 120, dmg: 20 } },
      ] },
      { name: 'Nozzle', ups: [
        { name: 'Wide Nozzle', desc: 'A wider jet of flame.', fx: { splash: 0.25 } },
        { name: 'Twin Nozzles', desc: 'Two nozzles fire faster.', fx: { '*rate': 0.8, splash: 0.1 } },
        { name: 'Firewall', desc: 'A long wall of fire.', fx: { range: 0.4, splash: 0.3 } },
        { name: "Dragon's Breath", desc: 'A roaring cone of fire.', fx: { '*rate': 0.6, dmg: 6, splash: 0.3, range: 0.3 } },
        { name: 'Wildfire', desc: 'The ground around it burns. Zombies in range take fire damage.', fx: { '*rate': 0.6, splash: 0.5, fieldDps: 40 } },
      ] },
      { name: 'Heat', ups: [
        { name: 'Hotter Fuel', desc: 'The flame itself hurts more.', fx: { dmg: 3 } },
        { name: 'Plasma Torch', desc: 'Cuts into armor.', fx: { dmg: 5, pierce: 0.5 } },
        { name: 'Meltdown', desc: 'Melts armor away and can torch flyers.', fx: { shred: 2, air: true } },
        { name: 'Thermal Lance', desc: 'A long white-hot beam.', fx: { dmg: 30, range: 0.8, '*rate': 0.8 } },
        { name: 'Sunfire', desc: 'A blinding beam hot as the sun.', fx: { dmg: 90, burn: 30, range: 0.6 } },
      ] },
    ],
  },
  tesla: {
    name: 'Tesla Coil', role: 'Chain', place: 'land', air: true, cost: 130, key: '7', unlock: 12, price: 350,
    desc: 'Lightning arcs between zombies and ignores armor.',
    base: { dmg: 11, rate: 1.25, range: 2.4, chain: 3 },
    paths: [
      { name: 'Arc', ups: [
        { name: 'Extra Arc', desc: 'Lightning jumps to one more zombie.', fx: { chain: 1 } },
        { name: 'Branching', desc: 'Jumps to two more zombies and hits harder.', fx: { chain: 2, dmg: 3 } },
        { name: 'Chain Storm', desc: 'Arcs through ten zombies at a time.', fx: { chain: 4, '*rate': 0.8 } },
        { name: 'Overload', desc: 'Massive bolts through even more zombies.', fx: { dmg: 25, chain: 4 } },
        { name: 'Thunderhead', desc: 'A storm cloud that strikes the whole horde.', fx: { dmg: 80, chain: 10, '*rate': 0.6 } },
      ] },
      { name: 'Charge', ups: [
        { name: 'Capacitors', desc: 'Stronger bolts.', fx: { dmg: 5 } },
        { name: 'Supercharger', desc: 'Fires faster and harder.', fx: { '*rate': 0.8, dmg: 4 } },
        { name: 'Stun Coil', desc: 'Bolts sometimes stun.', fx: { stunChance: 0.3, stunDur: 0.6 } },
        { name: 'EMP Pulse', desc: 'Every 4 seconds, a pulse hits everything around it.', fx: { pulseDmg: 60, pulseRate: 4, pulseStun: 1 } },
        { name: 'Tesla Tower', desc: 'A giant coil with a devastating pulse.', fx: { dmg: 60, '*rate': 0.6, pulseDmg: 220, '*pulseRate': 0.75, pulseStun: 0.5 } },
      ] },
      { name: 'Field', ups: [
        { name: 'Taller Coil', desc: 'More range and stronger bolts.', fx: { range: 0.5, dmg: 4 } },
        { name: 'Ground Rods', desc: 'Current through the ground hits Tunnelers and one more zombie.', fx: { detect: true, chain: 1 } },
        { name: 'Static Field', desc: 'Zombies in range take constant shock damage.', fx: { fieldDps: 10 } },
        { name: 'Power Grid', desc: 'Powers nearby towers: they fire 15% faster.', fx: { fieldDps: 15, aura: { range: 2.5, rate: 0.85 } } },
        { name: 'Storm Generator', desc: 'A lightning field that slows and fries everything.', fx: { fieldDps: 50, fieldSlow: 0.2, range: 1, aura: { range: 3.4, rate: 0.75 } } },
      ] },
    ],
  },
  heli: {
    name: 'Gunship', role: 'Flying', place: 'land', air: true, cost: 260, key: '8', unlock: 18, price: 500,
    desc: 'A helicopter that flies to the leading zombie anywhere on the map and hoses it down.',
    base: { dmg: 4, rate: 0.14, range: 2.0, speed: 140 },
    paths: [
      { name: 'Guns', ups: [
        { name: 'Quad Guns', desc: 'A second gun pod.', fx: { shots: 1 } },
        { name: 'Heavy Rotors', desc: 'Flies faster and fires faster.', fx: { speed: 50, '*rate': 0.85 } },
        { name: 'Minigun Pods', desc: 'Miniguns fire much faster.', fx: { '*rate': 0.6, dmg: 2 } },
        { name: 'Chain Gun', desc: 'A 30mm chain gun that pierces armor.', fx: { dmg: 8, pierce: 0.6 } },
        { name: 'Apex Gunship', desc: 'A flying fortress of guns.', fx: { dmg: 16, '*rate': 0.6, shots: 1, speed: 60 } },
      ] },
      { name: 'Rockets', ups: [
        { name: 'Rocket Pods', desc: 'Fires rockets too.', fx: { rocket: 25, rocketRate: 1.6, rockets: 1, rocketSplash: 0.6 } },
        { name: 'Hydra Rockets', desc: 'Two rockets per volley, fired faster.', fx: { rockets: 1, '*rocketRate': 0.8 } },
        { name: 'Hellfire Missiles', desc: 'Heavy anti-tank missiles.', fx: { rocket: 45, rocketSplash: 0.2 } },
        { name: 'Bunker Busters', desc: 'Missiles that wreck elites.', fx: { rocket: 120, rockets: 1 } },
        { name: 'Death From Above', desc: 'Unloads a storm of missiles.', fx: { rocket: 300, rockets: 2, '*rocketRate': 0.6 } },
      ] },
      { name: 'Avionics', ups: [
        { name: 'Night Vision', desc: 'Can hit Tunnelers and aims faster.', fx: { detect: true, '*rate': 0.85 } },
        { name: 'Downdraft', desc: 'Rotor wash sometimes blows zombies back.', fx: { knockChance: 0.08, knock: 22, dmg: 1 } },
        { name: 'Supply Chopper', desc: 'Flies in $60 of supplies after every wave.', fx: { income: 60 } },
        { name: 'Medevac', desc: 'Restores 2 lives and brings $40 more after every wave.', fx: { income: 40, lifePerWave: 2 } },
        { name: 'Air Superiority', desc: 'All aircraft fire 25% faster. Hits harder itself.', fx: { dmg: 10, '*rate': 0.6, aura: { range: 99, rate: 0.75, only: 'air' } } },
      ] },
    ],
  },
  sub: {
    name: 'Submarine', role: 'Water only', place: 'water', air: true, cost: 180, key: '9', unlock: 30, price: 700,
    desc: 'Fires homing missiles from the water. Its sonar reveals Tunnelers so every tower can hit them.',
    base: { dmg: 24, rate: 1.3, range: 3.2, pierce: 0.6, missiles: 1, sonar: true },
    paths: [
      { name: 'Torpedoes', ups: [
        { name: 'Long Tubes', desc: 'More range and harder hits.', fx: { range: 0.6, dmg: 6 } },
        { name: 'Twin Tubes', desc: 'Fires two missiles.', fx: { missiles: 1 } },
        { name: 'Cruise Missile', desc: 'Three missiles that explode on impact.', fx: { missiles: 1, splash: 0.6 } },
        { name: 'Hammerhead Strike', desc: 'Heavy warheads, fired faster.', fx: { dmg: 60, splash: 0.3, '*rate': 0.8 } },
        { name: 'Trident Barrage', desc: 'Seven ballistic missiles per volley.', fx: { missiles: 4, dmg: 100, splash: 0.4 } },
      ] },
      { name: 'Warheads', ups: [
        { name: 'Serrated Warheads', desc: 'More damage.', fx: { dmg: 10 } },
        { name: 'Thermite Tips', desc: 'Missiles set zombies on fire.', fx: { burn: 10, burnDur: 2 } },
        { name: 'Proximity Fuses', desc: 'Missiles burst near crowds.', fx: { dmg: 8, splash: 0.5 } },
        { name: 'Tungsten Cores', desc: 'Huge damage that ignores and strips armor.', fx: { dmg: 45, pierce: 0.4, shred: 2 } },
        { name: 'Fleet Admiral', desc: 'Every water tower fires 25% faster and hits 30% harder.', fx: { dmg: 80, aura: { range: 99, rate: 0.75, dmg: 1.3, only: 'water' } } },
      ] },
      { name: 'Systems', ups: [
        { name: 'Sonar Array', desc: 'Much bigger sonar range and better aim.', fx: { range: 0.8, dmg: 6 } },
        { name: 'Silent Running', desc: 'Fires faster.', fx: { '*rate': 0.8 } },
        { name: 'Reactor Core', desc: 'A nuclear reactor powers faster launches.', fx: { '*rate': 0.7, dmg: 10 } },
        { name: 'Overclocked Reactor', desc: 'Even faster, with an extra missile.', fx: { '*rate': 0.6, missiles: 1 } },
        { name: 'Fusion Heart', desc: 'Endless power: missiles fly non-stop.', fx: { '*rate': 0.5, dmg: 60, missiles: 2 } },
      ] },
    ],
  },
  jet: {
    name: 'Fighter Jet', role: 'Flying', place: 'land', air: true, cost: 300, key: '0', unlock: 40, price: 900,
    desc: 'Circles its airstrip at speed and fires homing missiles at anything below.',
    base: { dmg: 18, rate: 0.9, range: 2.6, missiles: 1, orbit: 2.8, planes: 1 },
    paths: [
      { name: 'Missiles', ups: [
        { name: 'Twin Pylons', desc: 'Two missiles per volley.', fx: { missiles: 1 } },
        { name: 'Rapid Lock', desc: 'Locks on and fires faster.', fx: { '*rate': 0.8 } },
        { name: 'Cluster Missiles', desc: 'Missiles burst over crowds.', fx: { dmg: 8, splash: 0.6 } },
        { name: 'Missile Swarm', desc: 'Five missiles per volley.', fx: { missiles: 3, '*rate': 0.8 } },
        { name: 'Strike Package', desc: 'Eleven heavy missiles per volley.', fx: { missiles: 6, dmg: 40, splash: 0.3 } },
      ] },
      { name: 'Airframe', ups: [
        { name: 'Afterburners', desc: 'Flies and fires faster.', fx: { '*rate': 0.85, orbitSpeed: 0.4 } },
        { name: 'Strafing Run', desc: 'Adds a cannon that strafes the road.', fx: { gunDmg: 6, gunRate: 0.12 } },
        { name: 'Napalm Run', desc: 'Drops napalm along its path.', fx: { bombDmg: 20, bombRate: 1.2, bombSplash: 0.8, bombBurn: 20 } },
        { name: 'Bomb Bay', desc: 'Drops heavy bombs as it flies.', fx: { bombDmg: 50, '*bombRate': 0.6, bombSplash: 0.2, gunDmg: 6 } },
        { name: 'Carpet Bomber', desc: 'A bomber that blankets the ground in fire.', fx: { bombDmg: 120, '*bombRate': 0.4, bombSplash: 0.3, bombBurn: 40 } },
      ] },
      { name: 'Wing', ups: [
        { name: 'Wingman', desc: 'A second jet joins the patrol.', fx: { planes: 1 } },
        { name: 'Radar', desc: 'More range and can hit Tunnelers.', fx: { range: 0.6, detect: true } },
        { name: 'AWACS', desc: 'Every tower on the map gets more range and spots Tunnelers.', fx: { aura: { range: 99, reach: 0.3, detect: true } } },
        { name: 'Squadron', desc: 'Four jets in the patrol.', fx: { planes: 2 } },
        { name: 'Air Wing', desc: 'Six jets with heavier missiles.', fx: { planes: 2, dmg: 30, '*rate': 0.7 } },
      ] },
    ],
  },
  farm: {
    name: 'Farm', role: 'Income', place: 'land', air: false, cost: 200, key: 'q', unlock: 3, price: 150,
    desc: 'Survivors grow food and trade it. Drops supply crates full of cash during every wave.',
    base: { income: 45, dmg: 0, rate: 1, range: 2.2 },
    paths: [
      { name: 'Crops', ups: [
        { name: 'Bigger Harvest', desc: 'More crops: +$20 a wave.', fx: { income: 20 }, cost: 80 },
        { name: 'Irrigation', desc: 'Watered fields: +$35 a wave.', fx: { income: 35 }, cost: 160 },
        { name: 'Greenhouses', desc: 'Crops all year: +$90 a wave.', fx: { income: 90 }, cost: 380 },
        { name: 'Plantation', desc: 'Orchards and fields: +$220 a wave.', fx: { income: 220 }, cost: 900 },
        { name: 'Breadbasket', desc: 'Feeds the whole region: +$600 a wave.', fx: { income: 600 }, cost: 2400 },
      ] },
      { name: 'Market', ups: [
        { name: 'Root Cellar', desc: 'Stores the surplus: +$10 a wave.', fx: { income: 10 }, cost: 60 },
        { name: 'Farmers Market', desc: 'Crops sell for 25% more.', fx: { '*income': 1.25 }, cost: 150 },
        { name: 'Bank', desc: 'Pays 5% interest on your cash after each wave, up to $150.', fx: { interest: 0.05, interestCap: 150 }, cost: 400 },
        { name: 'Investment Firm', desc: 'Pays 10% interest, up to $500 a wave.', fx: { interest: 0.05, interestCap: 350 }, cost: 950 },
        { name: 'War Bonds', desc: '15% interest up to $2000, and crops sell for 50% more.', fx: { interest: 0.05, interestCap: 1500, '*income': 1.5 }, cost: 2600 },
      ] },
      { name: 'Homestead', ups: [
        { name: 'Well Water', desc: 'Restores a life after every wave.', fx: { lifePerWave: 1 } },
        { name: 'Farmhand', desc: 'A farmer with a shotgun guards the crops.', fx: { dmg: 9 } },
        { name: 'Watchtower', desc: 'The farmer gets a tower: more range, faster shots, spots Tunnelers.', fx: { range: 0.8, '*rate': 0.75, detect: true, air: true } },
        { name: 'Field Hospital', desc: 'Restores 3 lives a wave, and a second farmer joins.', fx: { lifePerWave: 2, dmg: 10, shots: 1 } },
        { name: 'Safe Haven', desc: 'A walled haven: nearby towers fight harder and 6 lives return each wave.', fx: { lifePerWave: 3, dmg: 25, aura: { range: 3, dmg: 1.15, rate: 0.9 } } },
      ] },
    ],
  },
  // Only sold on snow maps, where crews out in the cold freeze solid and stop working (see COLD in game.js).
  heater: {
    name: 'Heater', role: 'Warmth', place: 'land', air: false, cost: 60, key: 'h', snowOnly: true,
    desc: 'A fire barrel that keeps nearby crews warm. On snow maps, soldiers away from the heat freeze solid and stop working; machines do not mind the cold.',
    base: { dmg: 0, rate: 1, heat: 2.2, warmRate: 1, warmDmg: 1 },
    paths: [
      { name: 'Fuel', ups: [
        { name: 'Propane Tank', desc: 'More fuel, more heat: warms a wider area.', fx: { heat: 0.4 } },
        { name: 'Hot-Air Ducts', desc: 'Ducting carries the heat further out.', fx: { heat: 0.4 } },
        { name: 'Brick Furnace', desc: 'A real furnace: much wider warmth, and warm crews fire 5% faster.', fx: { heat: 0.7, '*warmRate': 0.95 } },
        { name: 'Boiler House', desc: 'Steam pipes run out across the snow: a huge warm area.', fx: { heat: 1, '*warmRate': 0.95 } },
        { name: 'Geothermal Plant', desc: 'Taps the heat under the ice. Warms every crew on the map.', fx: { heat: 99, '*warmRate': 0.95 }, cost: 1400 },
      ] },
      { name: 'Comfort', ups: [
        { name: 'Hot Coffee', desc: 'Warm crews fire 5% faster.', fx: { '*warmRate': 0.95 } },
        { name: 'Hot Meals', desc: 'A cooking pot on the fire: warm crews fire 5% faster again.', fx: { '*warmRate': 0.95 } },
        { name: 'Warm Bunks', desc: 'Rested crews hit 10% harder.', fx: { warmDmg: 0.1 } },
        { name: 'Barracks Stove', desc: 'Warm crews fire 10% faster and hit 10% harder.', fx: { '*warmRate': 0.9, warmDmg: 0.1 } },
        { name: 'Morale Bonfire', desc: 'A roaring bonfire: warm crews fire 15% faster and hit 20% harder.', fx: { '*warmRate': 0.85, warmDmg: 0.2 } },
      ] },
      { name: 'Burner', ups: [
        { name: 'Coal Bed', desc: 'Hot coals scorch zombies that walk close.', fx: { fieldDps: 5, fieldR: 1.2 } },
        { name: 'Fire Pit', desc: 'A bigger, hotter pit.', fx: { fieldDps: 8, fieldR: 0.2 } },
        { name: 'Fire Barrels', desc: 'Extra burning barrels: scorches a wider ring.', fx: { fieldDps: 16, fieldR: 0.4 } },
        { name: 'Gas Burners', desc: 'A ring of roaring gas jets.', fx: { fieldDps: 34, fieldR: 0.3 } },
        { name: 'Inferno Stove', desc: 'A furnace with its doors thrown open: everything nearby burns.', fx: { fieldDps: 80, fieldR: 0.4 } },
      ] },
    ],
  },
};
const TOWER_KEYS = Object.keys(TOWERS);
// towers with people in them, who feel the cold on snow maps
const CREWED = new Set(['gunner', 'sniper', 'mortar', 'flame', 'gunboat', 'farm']);
const MODES = [['first', 'First'], ['last', 'Last'], ['strong', 'Strongest'], ['close', 'Closest']];
const PATH_COLORS = ['#e3a83e', '#e0675b', '#8fc7e6'];

// Upgrade prices grow steeply by tier; XP unlocks tiers 3 to 5 for good in the Armory.
const TIER_MULT = [0.5, 0.85, 1.8, 4.2, 10];
const TIER_XP = [0, 0, 150, 600, 2000];
const FREE_TIER = 2;
function upCost(type, p, i) {
  const u = TOWERS[type].paths[p].ups[i];
  return u.cost || Math.round((TOWERS[type].cost * TIER_MULT[i]) / 5) * 5;
}
// The crosspath rule: at most two paths upgraded, and only one beyond tier 2.
function tiersAllowed(tiers) {
  let used = 0, deep = 0;
  for (const n of tiers) { if (n > 0) used++; if (n > FREE_TIER) deep++; if (n > 5) return false; }
  return used <= 2 && deep <= 1;
}
// Base stats plus every bought upgrade. Additions apply before multipliers.
function towerStats(type, tiers) {
  const def = TOWERS[type];
  const st = { ...def.base, air: def.air, shots: 1 };
  const mul = [];
  def.paths.forEach((path, p) => {
    for (let i = 0; i < tiers[p]; i++) {
      for (const [k, v] of Object.entries(path.ups[i].fx)) {
        if (k[0] === '*') mul.push([k.slice(1), v]);
        else if (typeof v === 'number') st[k] = (st[k] || 0) + v;
        else st[k] = v;
      }
    }
  });
  for (const [k, v] of mul) if (st[k] != null) st[k] *= v;
  // a heater's warmth works like a support aura: its range is how far the heat reaches
  if (st.heat) { st.range = st.heat; st.aura = { range: st.heat, heat: true, rate: st.warmRate, dmg: st.warmDmg }; }
  return st;
}
// Name shown for a tower: its highest upgrade, like "Minigun".
function towerTitle(type, tiers) {
  let best = -1, bp = 0;
  tiers.forEach((n, p) => { if (n > best) { best = n; bp = p; } });
  return best > 0 ? TOWERS[type].paths[bp].ups[best - 1].name : TOWERS[type].name;
}

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
