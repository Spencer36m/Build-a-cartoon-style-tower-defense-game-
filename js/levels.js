'use strict';
// ============================================================
// Procedural levels: 50 per world, each with its own road layout, water and look. The campaign
// runs through the main worlds in order; an expansion world sits to one side of it.
// Generation is seeded by the level number, so every player gets the same levels.
// ============================================================
const TOTAL_LEVELS = WORLD_START[WORLDS.length - 1] + WORLDS[WORLDS.length - 1].levels;
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1]; // right, down, left, up

const PLACE_NAMES = [
  [['Miller\'s', 'Old Mill', 'Red Barn', 'Harlan', 'Cedar', 'Dusty', 'Lone Oak', 'Hollow', 'Sutter\'s', 'Willow'],
   ['Crossing', 'Fields', 'Road', 'Orchard', 'Silo', 'Pasture', 'Ridge', 'Junction', 'Acres', 'Homestead']],
  [['Ashen', 'Raven', 'Saint Agnes', 'Grimwood', 'Hallow', 'Mourning', 'Black Gate', 'Old Chapel', 'Weeping', 'Tallow'],
   ['Plots', 'Rows', 'Crypts', 'Lane', 'Vault', 'Grounds', 'Hill', 'Ossuary', 'Walk', 'Garden']],
  [['Whiteout', 'Glacier', 'Ice Shelf', 'Polar', 'Northwind', 'Rime', 'Hoarfrost', 'Avalanche', 'Bleak', 'Frostbite'],
   ['Pass', 'Station', 'Basin', 'Ridge', 'Outpost', 'Drift', 'Camp', 'Fjord', 'Flats', 'Crossing']],
  [['Gator', 'Sulfur', 'Rot', 'Cypress', 'Brackish', 'Mire', 'Toxic', 'Murk', 'Sunken', 'Bayou'],
   ['Landing', 'Marsh', 'Inlet', 'Slough', 'Delta', 'Bend', 'Pier', 'Channel', 'Hollow', 'Fen']],
  [['Red Mesa', 'Sandstone', 'Dry Wells', 'Bonefield', 'Scorpion', 'Sun Dog', 'Rust', 'Oilfield', 'Mirage', 'Dead Horse'],
   ['Canyon', 'Dunes', 'Airbase', 'Wash', 'Pumpworks', 'Gulch', 'Depot', 'Butte', 'Flats', 'Outpost']],
  [['Fifth Street', 'Harbor', 'Union', 'Liberty', 'Grand', 'Midtown', 'Kessler', 'Lakeshore', 'Iron', 'Central'],
   ['Plaza', 'Avenue', 'Station', 'Heights', 'Square', 'Overpass', 'Market', 'Terminal', 'Boulevard', 'Docks']],
];
// how many main worlds come before world w (its place in the campaign)
const mainBefore = (w) => WORLDS.slice(0, w).filter((x) => !x.expansion).length;
// the level whose first clear opens world w (the end of the main world before it)
function unlockFrom(w) {
  for (let p = w - 1; p >= 0; p--) if (!WORLDS[p].expansion) return worldEnd(p);
  return -1;
}
// the next level along the campaign: the next sector, or the first sector of the next main world
function campaignNext(i) {
  const m = levelMetaCache[i];
  if (!m) return -1;
  if (m.num < worldSize(m.world)) return i + 1;
  for (let w = m.world + 1; w < WORLDS.length; w++) if (!WORLDS[w].expansion) return WORLD_START[w];
  return -1;
}
const levelMetaCache = [];

function levelMeta(index) {
  let world = 0;
  while (world + 1 < WORLDS.length && index >= WORLD_START[world + 1]) world++;
  const num = index - WORLD_START[world] + 1, n = worldSize(world);
  // the desert expansion can be played once the farmland is cleared, so it starts about as hard
  // as the middle of the cemetery and climbs faster than the other worlds
  const tier = WORLDS[world].expansion ? 2 : mainBefore(world);
  // a world climbs by the same amount from its first sector to its last, however long it is
  const [d0, span] = WORLDS[world].diff || (WORLDS[world].expansion ? [2.2, 3.43] : [tier * 1.5, 1.96]);
  const diff = d0 + span * (num - 1) / (n - 1);
  const rng = mulberry32(index * 7919 + 17);
  const names = PLACE_NAMES[world];
  const name = `${names[0][Math.floor(rng() * 10)]} ${names[1][Math.floor(rng() * 10)]}`;
  return {
    index, world, tier, num, id: `${world + 1}-${num}`, name,
    waves: num === n ? 20 : 10 + Math.floor((num - 1) / 5),
    diff, gold: Math.round(260 + diff * 55),
    boss: num === n ? WORLDS[world].boss : num % 10 === 0 ? 'juggernaut' : null,
  };
}
const LEVEL_META = Array.from({ length: TOTAL_LEVELS }, (_, i) => levelMeta(i));
levelMetaCache.push(...LEVEL_META);

// ---------- road layout ----------
function shuffle(rng, a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function entryFor(rng, side) {
  if (side === 0) { const r = 1 + Math.floor(rng() * (ROWS - 2)); return { x: 0, y: r, dir: 0, off: [-1, r] }; }
  if (side === 1) { const c = 1 + Math.floor(rng() * (COLS - 2)); return { x: c, y: 0, dir: 1, off: [c, -1] }; }
  if (side === 2) { const c = 1 + Math.floor(rng() * (COLS - 2)); return { x: c, y: ROWS - 1, dir: 3, off: [c, ROWS] }; }
  const r = 1 + Math.floor(rng() * (ROWS - 2)); return { x: COLS - 1, y: r, dir: 2, off: [COLS, r] };
}

// Randomized depth-first search for a winding, self-avoiding road with a one-tile gap between stretches.
function tryMainPath(rng, minLen, maxLen, entry) {
  const occ = new Uint8Array(COLS * ROWS);
  const order = [];
  let budget = 4000;
  const id = (x, y) => y * COLS + x;
  const free = (x, y) => {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS || occ[id(x, y)]) return false;
    const n = order.length, a = order[n - 1], b = order[n - 2];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= COLS || yy >= ROWS) continue;
      const k = id(xx, yy);
      if (occ[k] && k !== a && k !== b) return false;
    }
    return true;
  };
  const push = (x, y) => { occ[id(x, y)] = 1; order.push(id(x, y)); };
  const pop = () => { occ[order.pop()] = 0; };
  const rec = (x, y, dir) => {
    if (--budget < 0) return false;
    const len = order.length;
    const interior = x > 0 && y > 0 && x < COLS - 1 && y < ROWS - 1;
    if (len >= minLen && interior && Math.abs(x - entry.x) + Math.abs(y - entry.y) >= 8 && rng() < 0.45) return true;
    if (len >= maxLen) return false;
    for (const d of shuffle(rng, [dir, (dir + 1) % 4, (dir + 3) % 4])) {
      for (const L of shuffle(rng, [2, 3, 4, 5, 6])) {
        let k = 0, ok = true;
        for (; k < L; k++) {
          const nx = x + DX[d] * (k + 1), ny = y + DY[d] * (k + 1);
          if (!free(nx, ny)) { ok = false; break; }
          push(nx, ny);
        }
        if (ok && rec(x + DX[d] * L, y + DY[d] * L, d)) return true;
        for (let i = 0; i < k; i++) pop();
        if (budget < 0) return false;
      }
    }
    return false;
  };
  push(entry.x, entry.y);
  const ok = rec(entry.x, entry.y, entry.dir);
  return ok ? order.map((k) => [k % COLS, Math.floor(k / COLS)]) : null;
}

// Collapse a tile list into corner waypoints, starting one tile off the map.
function toWaypoints(off, tiles) {
  const pts = [off, tiles[0]];
  for (let i = 1; i < tiles.length - 1; i++) {
    const [ax, ay] = tiles[i - 1], [bx, by] = tiles[i], [cx, cy] = tiles[i + 1];
    if (bx - ax !== cx - bx || by - ay !== cy - by) pts.push(tiles[i]);
  }
  pts.push(tiles[tiles.length - 1]);
  // drop the first in-grid tile if it is in line with the entry and the next waypoint
  const [a, b, c] = pts;
  if (c && ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]))) pts.splice(1, 1);
  return pts;
}

// Turn-penalized cheapest path from a second entrance to a tile on the main road.
function trySecondPath(rng, mainTiles, side) {
  const id = (x, y) => y * COLS + x;
  const mainSet = new Set(mainTiles.map(([x, y]) => id(x, y)));
  const lo = 4, hi = Math.max(lo + 1, Math.floor(mainTiles.length * 0.45));
  const mi = lo + Math.floor(rng() * (hi - lo));
  const [mx, my] = mainTiles[mi];
  const blocked = new Uint8Array(COLS * ROWS);
  for (const [x, y] of mainTiles) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= COLS || yy >= ROWS) continue;
      if (Math.abs(xx - mx) <= 1 && Math.abs(yy - my) <= 1 && !mainSet.has(id(xx, yy))) continue;
      blocked[id(xx, yy)] = 1;
    }
  }
  blocked[id(mx, my)] = 0;
  const entry = entryFor(rng, side);
  if (blocked[id(entry.x, entry.y)]) return null;
  const noise = Array.from({ length: COLS * ROWS }, () => rng() * 1.5);
  const N = COLS * ROWS * 4;
  const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const start = id(entry.x, entry.y) * 4 + entry.dir;
  dist[start] = 0;
  const open = [start];
  const goal = id(mx, my);
  let found = -1;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
    const s = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    const cell = s >> 2, dir = s & 3;
    if (cell === goal) { found = s; break; }
    const x = cell % COLS, y = Math.floor(cell / COLS);
    for (const nd of [dir, (dir + 1) % 4, (dir + 3) % 4]) {
      const nx = x + DX[nd], ny = y + DY[nd];
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const nc = id(nx, ny);
      if (blocked[nc] && nc !== goal) continue;
      if (mainSet.has(nc) && nc !== goal) continue;
      const ns = nc * 4 + nd;
      const cost = dist[s] + 1 + noise[nc] + (nd !== dir ? 3 : 0);
      if (cost < dist[ns]) { dist[ns] = cost; prev[ns] = s; open.push(ns); }
    }
  }
  if (found < 0) return null;
  const tiles = [];
  for (let s = found; s >= 0; s = prev[s]) tiles.push([(s >> 2) % COLS, Math.floor((s >> 2) / COLS)]);
  tiles.reverse();
  if (tiles.length < 7) return null;
  return { tiles, off: entry.off, mergeIndex: mi };
}

// ---------- water: lakes and rivers that roads cross on bridges ----------
function makeWater(rng, kind) {
  const mask = new Uint8Array(COLS * ROWS);
  if (kind === 'lake') {
    const n = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const cx = 2 + rng() * (COLS - 4), cy = 2 + rng() * (ROWS - 4), r = 1.4 + rng() * 1.6;
      const blobs = [[cx, cy, r], [cx + rng() * 2 - 1, cy + rng() * 2 - 1, r * 0.8]];
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (blobs.some(([bx, by, br]) => (x + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2 < br * br)) mask[y * COLS + x] = 1;
      }
    }
  } else {
    const vertical = rng() < 0.5;
    const span = vertical ? ROWS : COLS, across = vertical ? COLS : ROWS;
    const base = 3 + rng() * (across - 6), amp = 0.8 + rng() * 2, freq = 0.2 + rng() * 0.35, ph = rng() * TAU;
    const width = 1 + (rng() < 0.4 ? 1 : 0);
    for (let s = 0; s < span; s++) {
      const c = Math.round(base + Math.sin(s * freq + ph) * amp);
      for (let w = 0; w < width; w++) {
        const a = c + w;
        if (a < 0 || a >= across) continue;
        mask[vertical ? s * COLS + a : a * COLS + s] = 1;
      }
    }
  }
  return mask;
}

// ---------- zombie pool ----------
// Mobs already met in earlier worlds come back; the current world's mobs are introduced on a schedule.
function levelPool(meta, rng) {
  const avail = [];
  const skip = WORLDS[meta.world].skipOld || [];
  WORLDS.forEach((w, wi) => {
    for (const [type, at] of w.mobs) {
      if (wi < meta.world && (skip.includes(type) || w.expansion)) continue;
      if (wi < meta.world || (wi === meta.world && meta.num >= at)) avail.push({ type, home: wi === meta.world, at });
    }
  });
  // Keep the newest mobs, plus a random handful of older ones, so levels feel different.
  const fresh = avail.filter((m) => m.home);
  const old = shuffle(rng, avail.filter((m) => !m.home && m.type !== 'walker'));
  const keep = [{ type: 'walker', at: 1 }, ...fresh.filter((m) => m.type !== 'walker'), ...old.slice(0, 2 + Math.floor(rng() * 3))];
  const seen = new Set();
  const list = keep.filter((m) => (seen.has(m.type) ? false : seen.add(m.type)));
  const waves = meta.waves;
  return list.map((m, i) => {
    if (m.type === 'walker') return ['walker', 1];
    const debut = m.home && meta.num === m.at;
    const from = debut ? Math.max(3, Math.round(waves * 0.3)) : 1 + Math.floor((i / list.length) * waves * 0.55);
    return [m.type, clamp(from, 1, waves)];
  });
}

// ---------- city blocks ----------
// The city fills every tile away from the road with buildings: big skyscrapers on two-by-two
// lots, wide office blocks and apartments, shops and gas stations. The pavement along the road
// stays mostly clear for towers, with a few street props and corner shops.
const CITY_FAR = [['skyscraper', 5], ['office', 3], ['apartment', 3], ['shop', 1], ['gasstation', 0.6], ['parking', 0.6]];
const CITY_NEAR = [['shop', 2], ['apartment', 1], ['hydrant', 1], ['streetlight', 1.4], ['planter', 1], ['dumpster', 0.8], ['taxi', 0.8], ['bus', 0.6], ['barricade', 0.6]];
function cityBlocks(rng, onPath, water, end, decor) {
  const at = (x, y) => y * COLS + x;
  const near = new Uint8Array(COLS * ROWS), used = new Uint8Array(COLS * ROWS);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (onPath[at(x, y)]) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < COLS && yy < ROWS) near[at(xx, yy)] = 1; }
  }
  const open = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && !onPath[at(x, y)] && !water[at(x, y)] && !used[at(x, y)] && !(Math.abs(x - end[0]) <= 1 && Math.abs(y - end[1]) <= 1);
  const far = (x, y) => open(x, y) && !near[at(x, y)];
  const pick = (list) => { let t = 0; for (const [, w] of list) t += w; let r = rng() * t; for (const [k, w] of list) { r -= w; if (r <= 0) return k; } return list[0][0]; };
  const put = (kind, c, r, cw, ch) => {
    for (let x = c; x < c + cw; x++) for (let y = r - ch + 1; y <= r; y++) used[at(x, y)] = 1;
    decor.push({ kind, c, r, cw, ch, x: (c + cw / 2) * TILE, y: (r + 1 - ch / 2) * TILE, s: 1, rot: rng() * TAU, seed: Math.floor(rng() * 1e6) });
  };
  const order = shuffle(rng, Array.from({ length: COLS * ROWS }, (_, i) => [i % COLS, Math.floor(i / COLS)]));
  // two-by-two towers first, then wide blocks, then single lots
  for (const [x, y] of order) if (far(x, y) && far(x + 1, y) && far(x, y - 1) && far(x + 1, y - 1) && rng() < 0.45) put('skyscraper', x, y, 2, 2);
  for (const [x, y] of order) if (far(x, y) && far(x + 1, y) && rng() < 0.55) put(pick(CITY_FAR.filter(([k]) => k !== 'parking' && k !== 'gasstation')), x, y, 2, 1);
  for (const [x, y] of order) if (far(x, y) && rng() < 0.85) put(pick(CITY_FAR), x, y, 1, 1);
  // a few things along the pavement, so the streets feel lived in
  for (const [x, y] of order) if (open(x, y) && near[at(x, y)] && rng() < 0.1) put(pick(CITY_NEAR), x, y, 1, 1);
}

// ---------- full level definition ----------
const LEVEL_CACHE = new Map();
function getLevel(index) {
  if (LEVEL_CACHE.has(index)) return LEVEL_CACHE.get(index);
  const meta = LEVEL_META[index];
  const world = WORLDS[meta.world];
  const t = index / TOTAL_LEVELS;
  const minLen = Math.round(lerp(48, 30, Math.min(1, (meta.num - 1) / (worldSize(meta.world) - 1) * 0.6 + meta.tier * 0.12)));
  const maxLen = minLen + 14;
  let attempt = 0, main = null, entry = null, rng;
  while (!main) {
    rng = mulberry32(index * 104729 + 3 + attempt * 7);
    const side = (() => { const r = rng(); return r < 0.5 ? 0 : r < 0.7 ? 1 : r < 0.9 ? 2 : 3; })();
    entry = entryFor(rng, side);
    main = tryMainPath(rng, minLen - Math.floor(attempt / 4), maxLen + Math.floor(attempt / 4), entry);
    attempt++;
  }
  const paths = [toWaypoints(entry.off, main)];
  const pathTiles = [main];
  // a second entrance; the city's narrow streets get one less often
  if (meta.num >= 6 && rng() < (world.id === 'city' ? 0.4 : 0.3 + meta.tier * 0.08)) {
    for (let k = 0; k < 6; k++) {
      const side = [1, 2, 0, 3][Math.floor(rng() * 4)];
      const sec = trySecondPath(rng, main, side);
      if (sec) {
        const pts = toWaypoints(sec.off, sec.tiles);
        paths.push(pts);
        pathTiles.push(sec.tiles);
        break;
      }
    }
  }
  const onPath = new Uint8Array(COLS * ROWS);
  for (const tl of pathTiles) for (const [x, y] of tl) onPath[y * COLS + x] = 1;

  let water = new Uint8Array(COLS * ROWS);
  // the bayou is mostly water; the desert has only the odd oasis
  // the bayou is mostly water, the desert has only the odd oasis, and the city a walled canal
  const wetWorld = world.id === 'swamp' ? 0.75 : world.id === 'desert' ? 0.22 : world.id === 'city' ? 0.35 : 0.5;
  if (meta.num >= 4 && rng() < wetWorld) water = makeWater(rng, world.id === 'city' || rng() >= 0.55 ? 'river' : 'lake');
  const [ex, ey] = main[main.length - 1];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = ex + dx, y = ey + dy;
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS) water[y * COLS + x] = 0;
  }
  const bridges = new Uint8Array(COLS * ROWS);
  let wetCount = 0;
  for (let i = 0; i < water.length; i++) {
    if (water[i] && onPath[i]) bridges[i] = 1;
    if (water[i] && !onPath[i]) wetCount++;
  }
  // Too much water leaves too little room to build: thin it out.
  if (wetCount > COLS * ROWS * 0.22) for (let i = 0; i < water.length; i++) if (water[i] && !onPath[i] && rng() < 0.4) water[i] = 0;

  const end = main[main.length - 1];
  const decor = [];
  const nDecor = world.id === 'city' ? 0 : 10 + Math.floor(rng() * 12);
  if (world.id === 'city') cityBlocks(rng, onPath, water, end, decor);
  let tries = 0;
  while (decor.length < nDecor && tries++ < 600) {
    const x = Math.floor(rng() * COLS), y = Math.floor(rng() * ROWS);
    const k = y * COLS + x;
    if (onPath[k] || water[k] || decor.some((d) => d.c === x && d.r === y)) continue;
    if (Math.abs(x - end[0]) <= 1 && Math.abs(y - end[1]) <= 1) continue;
    const kind = world.decor[Math.floor(rng() * world.decor.length)];
    decor.push({ kind, c: x, r: y, x: x * TILE + TILE / 2 + (rng() - 0.5) * 10, y: y * TILE + TILE / 2 + (rng() - 0.5) * 10, s: 0.85 + rng() * 0.3, rot: rng() * TAU, seed: Math.floor(rng() * 1e6) });
  }
  const look = {
    time: world.times[Math.floor(rng() * world.times.length)],
    weather: world.weather[Math.floor(rng() * world.weather.length)],
    tone: (rng() - 0.5) * 0.16, // lighten or darken the ground a touch
    seed: Math.floor(rng() * 1e9),
  };
  const L = { ...meta, paths, water, bridges, decor, look, pool: levelPool(meta, rng), t };
  LEVEL_CACHE.set(index, L);
  return L;
}

// Wave composition for wave n of level L.
function makeWave(L, n) {
  const e = effWave(L, n);
  const groups = [];
  for (const [type, from] of L.pool) {
    if (n < from) continue;
    let count = Math.round(WEIGHT[type] * (5.5 + (n - from) * 1.2 + L.diff * 0.4 * Math.min(1, n / 6)));
    count = Math.max(from === n ? 2 : 1, count);
    groups.push({ type, count, gap: GAP[type] * Math.max(0.55, 1 - e * 0.015), delay: groups.length ? 1 : 0 });
  }
  if (n % 5 === 0 && n < L.waves) groups.push({ type: L.rush || { swamp: 'imp', desert: 'scorpion', city: 'suit' }[WORLDS[L.world].id] || 'runner', count: Math.round(4 + e * 0.5), gap: 0.22, delay: 1 });
  // most bosses come at the end; Subject Zero comes back every ten waves
  if (L.boss && (n === L.waves || (L.bossWaves && L.bossWaves.includes(n)))) {
    const count = L.boss === 'juggernaut' ? 1 + Math.floor(L.num / 25) : 1;
    groups.push({ type: L.boss, count, gap: 3, delay: 2 });
  }
  return groups;
}
function waveSummary(L, n) {
  const counts = {};
  for (const grp of makeWave(L, n)) counts[grp.type] = (counts[grp.type] || 0) + grp.count;
  return counts;
}
// A zombie counts as new only in the level where the campaign first sends it.
const FIRST_SEEN = {};
WORLDS.forEach((w, wi) => { for (const [type, at] of w.mobs) FIRST_SEEN[type] = WORLD_START[wi] + at - 1; });
const newTypes = (L, n) => L.pool.filter(([type, from]) => from === n && FIRST_SEEN[type] === L.index).map(([type]) => type);
