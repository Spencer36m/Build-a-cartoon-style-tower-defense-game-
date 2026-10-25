(() => {
'use strict';

// ============================================================
// Constants & helpers
// ============================================================
const TILE = 48, COLS = 20, ROWS = 12;
const W = COLS * TILE, H = ROWS * TILE;
const INK = '#2b2140';
const TOTAL_WAVES = 30;
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
const SAVE_KEY = 'blobbash.save';
const coarse = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;
const buzz = (ms) => { try { if (!Sound.muted && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* no haptics */ } };

// ============================================================
// Data: maps, enemies, towers, waves
// ============================================================
const MAPS = [
  {
    id: 'meadow', name: 'Sunny Meadow', difficulty: 'Easy', lives: 30, gold: 250, seed: 7,
    blurb: 'A long, winding trail. Great for learning the ropes.',
    theme: { grassA: '#9bd770', grassB: '#91cf66', tuft: '#6fb04a', flower: ['#ffffff', '#ffd93d', '#ff8fb8'],
      path: '#f4d7a1', pathMid: '#fbe6bd', pebble: '#d1a86c', decor: 'tree' },
    points: [[-1, 9], [2, 9], [2, 2], [6, 2], [6, 9], [10, 9], [10, 2], [14, 2], [14, 9], [17, 9], [17, 4], [19, 4]],
  },
  {
    id: 'canyon', name: 'Biscuit Canyon', difficulty: 'Medium', lives: 20, gold: 230, seed: 21,
    blurb: 'Dusty switchbacks with less room to breathe.',
    theme: { grassA: '#f2c38b', grassB: '#ecb87c', tuft: '#d39555', flower: ['#ff7eb6', '#fff1d0', '#ffb347'],
      path: '#fff0cc', pathMid: '#fff8e4', pebble: '#ddb07a', decor: 'cactus' },
    points: [[-1, 2], [4, 2], [4, 8], [9, 8], [9, 3], [14, 3], [14, 9], [18, 9]],
  },
  {
    id: 'peaks', name: 'Frosty Peaks', difficulty: 'Hard', lives: 15, gold: 220, seed: 99,
    blurb: 'A short dash to the castle. Every tower counts.',
    theme: { grassA: '#eaf5fc', grassB: '#dfeff9', tuft: '#b5d5ea', flower: ['#9fd8ff', '#ffffff', '#c8b6ff'],
      path: '#a9b8d9', pathMid: '#bccae6', pebble: '#8796bd', decor: 'pine' },
    points: [[-1, 6], [5, 6], [5, 2], [12, 2], [12, 9], [18, 9], [18, 5]],
  },
];

const ENEMIES = {
  blob:     { name: 'Blob',      hp: 28,   speed: 52,  armor: 0, reward: 4,   r: 13, color: '#7ed957', lives: 1 },
  zippy:    { name: 'Zippy',     hp: 16,   speed: 100, armor: 0, reward: 5,   r: 10, color: '#ffd93d', lives: 1 },
  chonk:    { name: 'Chonk',     hp: 120,  speed: 34,  armor: 4, reward: 10,  r: 18, color: '#a77bf3', lives: 2 },
  splitter: { name: 'Splitter',  hp: 55,   speed: 46,  armor: 0, reward: 6,   r: 15, color: '#ff7eb6', lives: 1, splits: 2 },
  mini:     { name: 'Mini',      hp: 16,   speed: 70,  armor: 0, reward: 2,   r: 9,  color: '#ff9ccb', lives: 1 },
  ghost:    { name: 'Ghosty',    hp: 50,   speed: 60,  armor: 0, reward: 7,   r: 13, color: '#eef3ff', lives: 1, noSlow: true },
  king:     { name: 'King Blob', hp: 900,  speed: 26,  armor: 6, reward: 120, r: 28, color: '#4cc9f0', lives: 10, boss: true },
};

const TOWERS = {
  pebble: {
    name: 'Pebble Pal', cost: 50, key: '1',
    desc: 'Cheap and speedy. Flicks pebbles at one blob at a time.',
    levels: [
      { dmg: 6,  rate: 0.55, range: 2.6 },
      { dmg: 9,  rate: 0.45, range: 2.8, cost: 60 },
      { dmg: 14, rate: 0.36, range: 3.0, cost: 120 },
      { dmg: 22, rate: 0.26, range: 3.3, cost: 220, twin: true },
    ],
  },
  cannon: {
    name: 'Boom Buddy', cost: 90, key: '2',
    desc: 'Lobs bombs that splash a whole crowd of blobs.',
    levels: [
      { dmg: 14, rate: 1.6,  range: 2.5, splash: 0.9 },
      { dmg: 24, rate: 1.5,  range: 2.6, splash: 1.0,  cost: 90 },
      { dmg: 38, rate: 1.35, range: 2.8, splash: 1.15, cost: 170 },
      { dmg: 60, rate: 1.2,  range: 3.0, splash: 1.35, cost: 300 },
    ],
  },
  frost: {
    name: 'Frost Puff', cost: 80, key: '3',
    desc: 'Snowballs slow blobs down. Ghosties shrug it off.',
    levels: [
      { dmg: 3,  rate: 1.1,  range: 2.3, splash: 0.7,  slow: 0.35, slowDur: 1.4 },
      { dmg: 5,  rate: 1.0,  range: 2.5, splash: 0.8,  slow: 0.45, slowDur: 1.7, cost: 70 },
      { dmg: 8,  rate: 0.9,  range: 2.7, splash: 0.9,  slow: 0.55, slowDur: 2.0, cost: 130 },
      { dmg: 12, rate: 0.75, range: 3.0, splash: 1.05, slow: 0.65, slowDur: 2.4, cost: 220 },
    ],
  },
  zap: {
    name: 'Zap Coil', cost: 130, key: '4',
    desc: 'Lightning hops between blobs and ignores armor.',
    levels: [
      { dmg: 11, rate: 1.25, range: 2.4, chain: 3 },
      { dmg: 17, rate: 1.15, range: 2.6, chain: 4, cost: 120 },
      { dmg: 26, rate: 1.0,  range: 2.8, chain: 5, cost: 210 },
      { dmg: 40, rate: 0.85, range: 3.1, chain: 7, cost: 340 },
    ],
  },
  owl: {
    name: 'Hoot Sniper', cost: 150, key: '5',
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

function hpScale(n) { return 1 + 0.1 * (n - 1) + 0.016 * (n - 1) * (n - 1); }
function waveBonus(n) { return 20 + n * 3; }

function makeWave(n) {
  const g = [];
  const add = (type, count, gap, delay = 0.9) => { count = Math.round(count); if (count > 0) g.push({ type, count, gap, delay }); };
  switch (n) {
    case 1: add('blob', 8, 0.9, 0); return g;
    case 2: add('blob', 12, 0.75, 0); return g;
    case 3: add('blob', 8, 0.7, 0); add('zippy', 5, 0.5); return g;
    case 4: add('blob', 10, 0.6, 0); add('zippy', 8, 0.45); add('blob', 6, 0.5); return g;
    case 5: add('blob', 8, 0.6, 0); add('chonk', 3, 1.8); add('zippy', 8, 0.4); return g;
  }
  add('blob', 6 + n * 0.8, Math.max(0.25, 0.6 - n * 0.01), 0);
  add('zippy', 3 + n * 0.5, Math.max(0.2, 0.45 - n * 0.008));
  add('chonk', 1 + n * 0.22, Math.max(0.7, 1.6 - n * 0.03));
  if (n >= 7) add('splitter', 2 + n * 0.3, Math.max(0.4, 0.9 - n * 0.015));
  if (n >= 9) add('ghost', 2 + n * 0.35, Math.max(0.3, 0.7 - n * 0.012));
  if (n > 12 && n % 3 === 0) add('zippy', n * 0.6, 0.18, 1);
  if (n % 10 === 0) add('king', n / 10, 4, 1.5);
  return g;
}

function waveSummary(n) {
  const counts = {};
  for (const grp of makeWave(n)) counts[grp.type] = (counts[grp.type] || 0) + grp.count;
  return counts;
}

// ============================================================
// Map building
// ============================================================
function buildMap(map) {
  const grid = new Uint8Array(COLS * ROWS); // 0 free, 1 path, 2 decor
  const pts = map.points.map(([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 }));
  for (let i = 0; i < map.points.length - 1; i++) {
    let [c, r] = map.points[i];
    const [c2, r2] = map.points[i + 1];
    const dc = Math.sign(c2 - c), dr = Math.sign(r2 - r);
    for (;;) {
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) grid[r * COLS + c] = 1;
      if (c === c2 && r === r2) break;
      c += dc; r += dr;
    }
  }
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({ a, b, len, start: total, dx: (b.x - a.x) / len, dy: (b.y - a.y) / len });
    total += len;
  }

  const rng = mulberry32(map.seed);
  const decor = [];
  const end = map.points[map.points.length - 1];
  let tries = 0;
  while (decor.length < 15 && tries++ < 800) {
    const c = Math.floor(rng() * COLS), r = Math.floor(rng() * ROWS);
    if (grid[r * COLS + c] !== 0) continue;
    if (Math.abs(c - end[0]) <= 1 && Math.abs(r - end[1]) <= 1) continue;
    grid[r * COLS + c] = 2;
    decor.push({ kind: rng() < 0.72 ? map.theme.decor : 'rock', c, r,
      x: c * TILE + TILE / 2 + (rng() - 0.5) * 8, y: r * TILE + TILE / 2 + (rng() - 0.5) * 6, s: 0.85 + rng() * 0.25 });
  }
  const flowers = [];
  for (let i = 0; i < 70; i++) {
    const x = rng() * W, y = rng() * H;
    const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
    if (grid[r * COLS + c] === 1) continue;
    flowers.push({ x, y, kind: rng() < 0.55 ? 'tuft' : 'flower', color: map.theme.flower[Math.floor(rng() * map.theme.flower.length)], s: 0.7 + rng() * 0.6 });
  }
  const pebbles = [];
  for (let i = 0; i < 90; i++) {
    const d = rng() * total;
    const p = pointOn(segs, total, d);
    const off = (rng() - 0.5) * TILE * 0.6;
    pebbles.push({ x: p.x + p.dy * off, y: p.y - p.dx * off, r: 1.5 + rng() * 2.5 });
  }
  return { def: map, grid, pts, segs, total, decor, flowers, pebbles, start: pts.find((p) => p.x > 0) || pts[1], end: pts[pts.length - 1] };
}

function pointOn(segs, total, d) {
  d = clamp(d, 0, total);
  for (const s of segs) {
    if (d <= s.start + s.len || s === segs[segs.length - 1]) {
      const k = (d - s.start);
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
  const th = M.def.theme;
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
  // path: thick ink stroke, then fill stroke, then a soft centre stripe
  const pw = TILE * 0.82;
  const tracePath = () => {
    c.beginPath();
    M.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  };
  c.lineJoin = 'round'; c.lineCap = 'round';
  tracePath(); c.strokeStyle = INK; c.lineWidth = pw + 7; c.stroke();
  tracePath(); c.strokeStyle = th.path; c.lineWidth = pw; c.stroke();
  tracePath(); c.strokeStyle = th.pathMid; c.lineWidth = pw * 0.42; c.globalAlpha = 0.7; c.stroke(); c.globalAlpha = 1;
  c.fillStyle = th.pebble;
  for (const p of M.pebbles) { ellipse(c, p.x, p.y, p.r, p.r * 0.75); c.fill(); }

  const decor = [...M.decor].sort((a, b) => a.y - b.y);
  for (const d of decor) drawDecor(c, d);
}

function drawDecor(c, d) {
  c.save(); c.translate(d.x, d.y); c.scale(d.s, d.s);
  c.fillStyle = 'rgba(43,33,64,.18)'; ellipse(c, 0, 14, 16, 5); c.fill();
  if (d.kind === 'tree') {
    rr(c, -4, 0, 8, 15, 3); fillStroke(c, '#9c6b43');
    const blobs = [[-8, -6, 11], [8, -6, 11], [0, -15, 13], [0, -3, 12]];
    c.fillStyle = INK;
    for (const [x, y, r] of blobs) { circle(c, x, y, r + 3); c.fill(); }
    c.fillStyle = '#4caf50';
    for (const [x, y, r] of blobs) { circle(c, x, y, r); c.fill(); }
    shine(c, -5, -18, 5, 3.5, 0.45);
    c.fillStyle = '#ff5d73';
    for (const [x, y] of [[-9, -4], [7, -10], [3, 2]]) { circle(c, x, y, 2.6); fillStroke(c, '#ff5d73', 1.5); }
  } else if (d.kind === 'cactus') {
    rr(c, -6, -20, 12, 34, 6); fillStroke(c, '#5cb85c');
    rr(c, -16, -10, 8, 14, 4); fillStroke(c, '#5cb85c');
    rr(c, 8, -14, 8, 12, 4); fillStroke(c, '#5cb85c');
    c.strokeStyle = '#3e8e41'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, -15); c.lineTo(0, 10); c.stroke();
    star(c, 0, -21, 5, 2.4, 5); fillStroke(c, '#ff7eb6', 1.5);
  } else if (d.kind === 'pine') {
    rr(c, -3, 4, 6, 10, 2); fillStroke(c, '#8a5a3c');
    const layers = [[0, 14], [-9, 12], [-18, 9]];
    for (const [y, w] of layers) {
      c.beginPath(); c.moveTo(-w, y + 2); c.lineTo(0, y - 16); c.lineTo(w, y + 2); c.closePath();
      fillStroke(c, '#3f9e7a');
      c.beginPath(); c.moveTo(-w * 0.45, y - 8); c.lineTo(0, y - 16); c.lineTo(w * 0.45, y - 8);
      c.quadraticCurveTo(0, y - 5, -w * 0.45, y - 8); c.fillStyle = '#fff'; c.fill();
    }
  } else {
    c.beginPath();
    c.moveTo(-14, 10); c.quadraticCurveTo(-16, -4, -6, -8); c.quadraticCurveTo(4, -14, 12, -4); c.quadraticCurveTo(17, 4, 13, 10); c.closePath();
    fillStroke(c, '#b9b3c9');
    shine(c, -4, -4, 5, 3, 0.6);
  }
  c.restore();
}

function drawCastle(c, x, y, t, hit) {
  c.save();
  c.translate(x, y + 6);
  const w = hit > 0 ? Math.sin(hit * 50) * 0.08 * (hit / 0.5) : 0;
  c.scale(1 + w, 1 - w);
  c.fillStyle = 'rgba(43,33,64,.2)'; ellipse(c, 0, 14, 28, 7); c.fill();
  for (const s of [-1, 1]) {
    rr(c, s * 17 - 8, -30, 16, 44, 3); fillStroke(c, '#f6efe2');
    c.beginPath(); c.moveTo(s * 17 - 11, -28); c.lineTo(s * 17, -50); c.lineTo(s * 17 + 11, -28); c.closePath();
    fillStroke(c, '#ff5d8f');
    rr(c, s * 17 - 2.5, -20, 5, 8, 2.5); fillStroke(c, INK, 1);
  }
  rr(c, -12, -18, 24, 32, 3); fillStroke(c, '#fff7ea');
  for (let i = 0; i < 3; i++) { rr(c, -12 + i * 9, -24, 6, 7, 1.5); fillStroke(c, '#fff7ea', 2.5); }
  c.beginPath(); c.moveTo(-6, 14); c.lineTo(-6, 2); c.arc(0, 2, 6, Math.PI, 0); c.lineTo(6, 14); c.closePath();
  fillStroke(c, '#7a4b2a');
  // flag
  c.strokeStyle = INK; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(17, -50); c.lineTo(17, -66); c.stroke();
  c.beginPath(); c.moveTo(17, -66);
  const wave = Math.sin(t * 6) * 2.5;
  c.quadraticCurveTo(24, -68 + wave, 31, -63 + wave);
  c.lineTo(17, -58); c.closePath();
  fillStroke(c, '#ffcf3f', 2);
  // heart emblem
  c.save(); c.translate(0, -9); c.scale(0.32, 0.32);
  c.beginPath(); c.moveTo(0, 12); c.bezierCurveTo(-26, -6, -12, -26, 0, -12); c.bezierCurveTo(12, -26, 26, -6, 0, 12);
  fillStroke(c, '#ff5d8f', 6);
  c.restore();
  c.restore();
}

function drawEntry(c, M, t) {
  const s = M.segs.find((sg) => sg.a.x + sg.dx * sg.len >= 0) || M.segs[0];
  const ang = Math.atan2(s.dy, s.dx);
  const bx = Math.max(6, s.a.x), by = s.a.y;
  c.save(); c.translate(bx, by); c.rotate(ang);
  for (let i = 0; i < 3; i++) {
    const k = ((t * 1.2 + i / 3) % 1);
    c.globalAlpha = Math.sin(k * Math.PI) * 0.8;
    const x = k * 46;
    c.beginPath(); c.moveTo(x - 6, -9); c.lineTo(x + 4, 0); c.lineTo(x - 6, 9);
    c.lineWidth = 5; c.strokeStyle = INK; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
    c.lineWidth = 2.5; c.strokeStyle = '#ffcf3f'; c.stroke();
  }
  c.restore();
}

// ============================================================
// Enemy drawing
// ============================================================
function bodyPath(c, type, r) {
  c.beginPath();
  if (type === 'ghost') {
    c.moveTo(-r, r * 0.8);
    c.lineTo(-r, -r * 0.1);
    c.arc(0, -r * 0.1, r, Math.PI, 0);
    c.lineTo(r, r * 0.8);
    for (let i = 0; i < 4; i++) {
      const x0 = r - (i * r * 2) / 4;
      c.quadraticCurveTo(x0 - r * 0.25, r * (i % 2 ? 1.15 : 0.5), x0 - r * 0.5, r * 0.8);
    }
    c.closePath();
    return;
  }
  if (type === 'chonk') {
    c.moveTo(-r, r * 0.6);
    c.bezierCurveTo(-r * 1.1, -r * 0.5, -r * 0.7, -r * 0.95, 0, -r * 0.95);
    c.bezierCurveTo(r * 0.7, -r * 0.95, r * 1.1, -r * 0.5, r, r * 0.6);
    c.quadraticCurveTo(r, r * 0.85, r * 0.7, r * 0.85);
    c.lineTo(-r * 0.7, r * 0.85);
    c.quadraticCurveTo(-r, r * 0.85, -r, r * 0.6);
    c.closePath();
    return;
  }
  c.moveTo(-r, r * 0.55);
  c.bezierCurveTo(-r * 1.05, -r * 0.4, -r * 0.55, -r * 1.05, 0, -r);
  c.bezierCurveTo(r * 0.55, -r * 1.05, r * 1.05, -r * 0.4, r, r * 0.55);
  c.quadraticCurveTo(r * 0.95, r * 0.85, r * 0.6, r * 0.85);
  c.lineTo(-r * 0.6, r * 0.85);
  c.quadraticCurveTo(-r * 0.95, r * 0.85, -r, r * 0.55);
  c.closePath();
}

function drawEnemy(c, e, t) {
  const def = ENEMIES[e.type];
  const r = e.r;
  const ghost = e.type === 'ghost';
  const hop = Math.sin(t * (e.type === 'zippy' ? 18 : 9) + e.phase);
  const sq = ghost ? 0 : hop * 0.08;
  const lift = ghost ? 7 + Math.sin(t * 3 + e.phase) * 3 : Math.max(0, hop) * r * 0.28;
  c.fillStyle = 'rgba(43,33,64,.22)';
  ellipse(c, e.x, e.y + r * 0.85, r * (0.95 - lift / (r * 5)), r * 0.3); c.fill();

  c.save();
  c.translate(e.x, e.y - lift);
  if (e.type === 'zippy') {
    c.strokeStyle = 'rgba(43,33,64,.45)'; c.lineWidth = 2; c.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const ox = -e.dirx * (r + 4), oy = -e.diry * (r + 4);
      const px = -e.diry * i * 5, py = e.dirx * i * 5;
      c.beginPath(); c.moveTo(ox + px, oy + py); c.lineTo(ox * 1.8 + px, oy * 1.8 + py); c.stroke();
    }
  }
  c.scale(1 + sq, 1 - sq);
  if (ghost) c.globalAlpha = 0.88;
  const fill = e.flash > 0 ? '#ffffff' : def.color;
  bodyPath(c, e.type, r);
  fillStroke(c, fill, e.type === 'king' ? 3.5 : 3);
  if (e.slowT > 0 && !def.noSlow) {
    c.save(); bodyPath(c, e.type, r); c.clip();
    c.fillStyle = 'rgba(140,215,255,.5)'; c.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
    c.restore();
  }
  shine(c, -r * 0.4, -r * 0.5, r * 0.28, r * 0.18);

  const lx = e.dirx, ly = e.diry;
  const mood = (e.type === 'chonk' || e.type === 'king') ? 'angry' : null;
  if (e.type === 'chonk') {
    c.beginPath(); c.moveTo(-r * 0.95, -r * 0.25); c.bezierCurveTo(-r, -r * 1.2, r, -r * 1.2, r * 0.95, -r * 0.25);
    c.closePath(); fillStroke(c, '#c9c6d6');
    for (const x of [-0.55, 0, 0.55]) { circle(c, x * r, -r * 0.55 - (x === 0 ? r * 0.15 : 0), 2); c.fillStyle = INK; c.fill(); }
  }
  if (e.type === 'king') {
    c.beginPath();
    c.moveTo(-r * 0.6, -r * 0.8); c.lineTo(-r * 0.7, -r * 1.45); c.lineTo(-r * 0.32, -r * 1.12);
    c.lineTo(0, -r * 1.6); c.lineTo(r * 0.32, -r * 1.12); c.lineTo(r * 0.7, -r * 1.45); c.lineTo(r * 0.6, -r * 0.8);
    c.closePath(); fillStroke(c, '#ffcf3f');
    circle(c, 0, -r * 1.0, 3); fillStroke(c, '#ff5d8f', 1.5);
  }
  const eyeY = e.type === 'chonk' ? -r * 0.05 : -r * 0.2;
  const eyeS = e.type === 'mini' ? r * 0.36 : e.type === 'king' ? r * 0.24 : r * 0.3;
  eyes(c, 0, eyeY, r * 0.36, eyeS, lx, ly, mood);
  c.lineWidth = 2; c.strokeStyle = INK; c.lineCap = 'round';
  if (ghost) {
    ellipse(c, 0, r * 0.28, r * 0.16, r * 0.2); c.fillStyle = INK; c.fill();
  } else if (mood) {
    c.beginPath(); c.moveTo(-r * 0.22, r * 0.38); c.quadraticCurveTo(0, r * 0.22, r * 0.22, r * 0.38); c.stroke();
  } else {
    c.beginPath(); c.arc(0, r * 0.18, r * 0.2, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.fillStyle = 'rgba(255,93,143,.45)';
    circle(c, -r * 0.62, r * 0.15, r * 0.14); c.fill();
    circle(c, r * 0.62, r * 0.15, r * 0.14); c.fill();
  }
  if (e.type === 'splitter') {
    c.setLineDash([3, 3]); c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(0, -r * 0.95); c.lineTo(0, -r * 0.55); c.stroke();
    c.beginPath(); c.moveTo(0, r * 0.45); c.lineTo(0, r * 0.82); c.stroke();
    c.setLineDash([]);
  }
  c.restore();

  if (e.hp < e.maxHp && e.maxHp) {
    const bw = Math.max(22, r * 2), by = e.y - lift - r - (e.type === 'king' ? 26 : 12);
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
  // base
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
    for (const s of [-1, 1]) {
      circle(c, s * 5.5, -6, 6); fillStroke(c, '#ffb347', 2);
    }
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
    const gap = { pebble: 60, pop: 45, frost: 80, zap: 80, boom: 90, owl: 80, launch: 90 }[name] || 30;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    switch (name) {
      case 'pebble': this.tone(900, 0.05, 'square', 0.035, 1300); break;
      case 'launch': this.tone(320, 0.12, 'triangle', 0.08, 160); break;
      case 'boom': this.noise(0.35, 0.3, 600); this.tone(130, 0.3, 'sine', 0.3, 40); break;
      case 'frost': this.tone(1500, 0.12, 'sine', 0.06, 700); break;
      case 'zap': this.noise(0.1, 0.1, 4000); this.tone(500, 0.1, 'sawtooth', 0.05, 1800); break;
      case 'owl': this.noise(0.08, 0.15, 2500); this.tone(1100, 0.06, 'square', 0.06, 220); break;
      case 'pop': this.tone(420 + Math.random() * 220, 0.08, 'sine', 0.13, 1000); break;
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
  state: 'title', map: null, M: null,
  lives: 0, gold: 0, wave: 0,
  towers: [], enemies: [], projectiles: [], fx: [], decals: [], spawners: [],
  towerAt: new Map(),
  speed: 1, paused: false, auto: false, autoT: 0, endless: false,
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
function startGame(mapIndex, save) {
  const map = MAPS[mapIndex];
  S.mapIndex = mapIndex;
  S.map = map;
  S.M = buildMap(map);
  S.lives = map.lives; S.gold = map.gold; S.wave = 0;
  S.towers = []; S.enemies = []; S.projectiles = []; S.fx = []; S.decals = []; S.spawners = [];
  S.towerAt = new Map();
  S.paused = false; S.endless = false; S.autoT = 0;
  S.placing = null; S.selected = null; S.pending = null;
  S.time = 0; S.shake = 0; S.castleHit = 0; S.banner = null; S.leakFlash = 0;
  S.state = 'playing';
  for (const b of document.querySelectorAll('.tower-btn')) b.classList.remove('active');
  $('#title-screen').hidden = true;
  $('#end-screen').hidden = true;
  $('#pause-screen').hidden = true;
  resize();
  if (save) applySave(save);
  else showBanner(map.name, 'Build towers, then start wave 1');
  checkpoint();
  renderInfo(); renderNextWave(); updateHUD(true);
}

// ---------- save & resume (checkpoints are taken between waves) ----------
function checkpoint() {
  if (S.state !== 'playing' || S.spawners.length || S.enemies.length) return;
  S.dirty = false;
  store.set(SAVE_KEY, JSON.stringify({
    v: 1, map: S.mapIndex, lives: S.lives, gold: S.gold, wave: S.wave, endless: S.endless,
    towers: S.towers.map((t) => ({ type: t.type, col: t.col, row: t.row, level: t.level, spent: t.spent, mode: t.mode, kills: t.kills, dealt: Math.round(t.dealt) })),
  }));
}

function loadSave() {
  try {
    const sv = JSON.parse(store.get(SAVE_KEY));
    if (sv && sv.v === 1 && MAPS[sv.map] && Array.isArray(sv.towers) && sv.lives > 0) return sv;
  } catch (e) { /* corrupt save */ }
  return null;
}

function applySave(sv) {
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  S.lives = num(sv.lives, S.lives);
  S.gold = num(sv.gold, S.gold);
  S.wave = clamp(num(sv.wave, 0), 0, 999);
  S.endless = !!sv.endless;
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
  if (!S.endless && S.wave >= TOTAL_WAVES) return;
  const early = S.spawners.length > 0 || S.enemies.length > 0;
  S.wave++;
  S.spawners.push(makeSpawner(S.wave));
  if (early) {
    const b = 5 + S.wave;
    S.gold += b;
    floatText(`Early call +${b}`, W / 2, 90, '#ffcf3f', 22);
    Sound.play('coin');
  }
  const boss = S.wave % 10 === 0;
  showBanner(`Wave ${S.wave}`, boss ? 'King Blob is coming!' : null);
  Sound.play(boss ? 'boss' : 'wave');
  renderNextWave(); updateHUD(true);
}

function makeSpawner(n) {
  const queue = [];
  let t = 0;
  for (const grp of makeWave(n)) {
    t += grp.delay;
    for (let i = 0; i < grp.count; i++) { queue.push({ t, type: grp.type }); t += grp.gap; }
  }
  return { wave: n, queue, time: 0, done: false };
}

function gameOver() {
  S.state = 'over';
  S.placing = null; S.pending = null;
  store.remove(SAVE_KEY);
  Sound.play('lose');
  buzz([80, 60, 160]);
  saveBest();
  const reached = Math.max(0, S.wave - 1);
  showEnd(false, 'The blobs got in!', `The castle fell on wave ${S.wave}. You held off ${reached} full wave${reached === 1 ? '' : 's'} on ${S.map.name}.`);
}

function victory() {
  S.state = 'won';
  S.placing = null; S.pending = null;
  store.remove(SAVE_KEY);
  Sound.play('win');
  saveBest();
  for (let i = 0; i < 60; i++) burstStar(rand(0, W), rand(0, H * 0.5), ['#ffcf3f', '#ff5d8f', '#7ed957', '#7fd8ff'][i % 4]);
  showEnd(true, 'Castle saved!', `All ${TOTAL_WAVES} waves bonked on ${S.map.name} with ${S.lives} li${S.lives === 1 ? 'fe' : 'ves'} to spare. Keep going to see how long you can last.`);
}

function showEnd(won, title, text) {
  $('#end-title').textContent = title;
  $('#end-text').textContent = text;
  $('.dialog-end').classList.toggle('won', won);
  $('#btn-endless').hidden = !won;
  $('#btn-retry').textContent = won ? 'Play again' : 'Try again';
  $('#end-screen').hidden = false;
  renderInfo();
}

function saveBest() {
  const key = 'blobbash.best.' + S.map.id;
  const prev = +store.get(key) || 0;
  const reached = S.state === 'won' ? S.wave : Math.max(0, S.wave - 1);
  if (reached > prev) store.set(key, String(reached));
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
function spawnEnemy(type, wave, d = 0) {
  const def = ENEMIES[type];
  const mul = hpScale(wave);
  const e = {
    type, wave, hpMul: mul,
    hp: def.hp * mul, maxHp: def.hp * mul,
    speed: def.speed * (1 + Math.min(0.25, (wave - 1) * 0.006)),
    armor: def.armor ? def.armor + Math.floor(wave / 8) : 0,
    reward: Math.round(def.reward * (1 + (wave - 1) * 0.025)),
    r: def.r, d, x: -40, y: 0, dirx: 1, diry: 0,
    cur: def.speed, slowT: 0, slowF: 0, flash: 0, phase: Math.random() * TAU, dead: false,
  };
  placeOnPath(e);
  S.enemies.push(e);
  return e;
}

function placeOnPath(e) {
  const p = pointOn(S.M.segs, S.M.total, e.d);
  e.x = p.x; e.y = p.y; e.dirx = p.dx; e.diry = p.dy;
}

function updateEnemy(e, dt) {
  if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowF = 0; }
  e.flash = Math.max(0, e.flash - dt);
  e.cur = e.speed * (1 - e.slowF);
  e.d += e.cur * dt;
  if (e.d >= S.M.total) {
    e.dead = true;
    const lost = ENEMIES[e.type].lives;
    S.lives = Math.max(0, S.lives - lost);
    S.castleHit = 0.5; S.leakFlash = 0.4;
    addShake(lost > 2 ? 10 : 4);
    floatText(`-${lost}`, S.M.end.x, S.M.end.y - 50, '#ff5d5d', 24);
    Sound.play('leak');
    buzz(40);
    bumpStat('.stat-lives');
    return;
  }
  placeOnPath(e);
}

function damage(e, amount, tower, pierce = 0) {
  if (e.dead) return;
  const armor = e.armor * (1 - pierce);
  const dmg = Math.max(1, amount - armor);
  e.hp -= dmg;
  e.flash = 0.07;
  if (tower) tower.dealt += dmg;
  if (e.hp <= 0) kill(e, tower);
}

function kill(e, tower) {
  e.dead = true;
  const def = ENEMIES[e.type];
  S.gold += e.reward;
  floatText(`+${e.reward}`, e.x, e.y - e.r - 6, '#ffcf3f', def.boss ? 26 : 16);
  for (let i = 0; i < (def.boss ? 26 : 8); i++) {
    const a = rand(0, TAU), sp = rand(40, def.boss ? 260 : 130);
    S.fx.push({ kind: 'blob', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, r: rand(2.5, def.boss ? 8 : 5), color: def.color, life: 0.5, max: 0.5 });
  }
  S.fx.push({ kind: 'ring', x: e.x, y: e.y, r: e.r, life: 0.3, max: 0.3, color: '#fff' });
  S.decals.push({ x: e.x, y: e.y + e.r * 0.5, r: e.r * 1.1, color: def.color, life: 5, max: 5, seed: Math.random() * 100 });
  if (S.decals.length > 70) S.decals.shift();
  if (tower) tower.kills++;
  Sound.play('pop');
  if (def.splits) {
    for (let i = 0; i < def.splits; i++) spawnEnemy('mini', e.wave, Math.max(0, e.d - 4 - i * 12));
  }
  if (def.boss) {
    addShake(14);
    for (let i = 0; i < 30; i++) burstStar(e.x, e.y, ['#ffcf3f', '#ff5d8f', '#7fd8ff'][i % 3]);
    floatText('KING BONKED!', e.x, e.y - 40, '#ffcf3f', 30);
  }
  bumpStat('.stat-gold');
}

function makeTower(type, col, row) {
  const t = {
    type, col, row, x: col * TILE + TILE / 2, y: row * TILE + TILE / 2,
    level: 0, angle: -Math.PI / 2, cd: 0.2, recoil: 0, spent: TOWERS[type].cost,
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
    if (e.dead || e.x < 2) continue;
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
  t.cd -= dt;
  t.recoil = Math.max(0, t.recoil - dt * 5);
  t.pop = Math.max(0, t.pop - dt);
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
      const lead = pointOn(S.M.segs, S.M.total, target.d + target.cur * dur);
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
    case 'zap': {
      const pts = [{ x: t.x, y: t.y - 41 }, { x: target.x, y: target.y }];
      const hit = new Set([target]);
      let cur = target, dmg = st.dmg;
      damage(target, dmg, t, 1);
      for (let i = 1; i < st.chain; i++) {
        let next = null, bd = (TILE * 1.9) ** 2;
        for (const e of S.enemies) {
          if (e.dead || hit.has(e) || e.x < 2) continue;
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
      for (const e of S.enemies) {
        if (e.dead) continue;
        const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
        if (d <= p.splash + e.r * 0.5) damage(e, p.dmg * (1 - 0.4 * clamp(d / p.splash, 0, 1)), p.tower);
      }
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
  if (p.target && !p.target.dead) { p.tx = p.target.x; p.ty = p.target.y; } else p.target = null;
  const dx = p.tx - p.x, dy = p.ty - p.y;
  const d = Math.hypot(dx, dy), step = p.speed * dt;
  if (p.spin != null) p.spin += dt * 12;
  if (d <= step + (p.target ? p.target.r * 0.5 : 0)) {
    p.done = true;
    if (p.kind === 'pebble') {
      if (p.target) damage(p.target, p.dmg, p.tower);
      S.fx.push({ kind: 'spark', x: p.tx, y: p.ty, life: 0.12, max: 0.12, small: true });
    } else if (p.kind === 'snow') {
      for (const e of S.enemies) {
        if (e.dead) continue;
        if (dist2(e.x, e.y, p.tx, p.ty) <= (p.splash + e.r * 0.5) ** 2) {
          if (!ENEMIES[e.type].noSlow) {
            e.slowF = Math.max(e.slowT > 0 ? e.slowF : 0, p.slow);
            e.slowT = Math.max(e.slowT, p.slowDur);
          }
          damage(e, p.dmg, p.tower);
        }
      }
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
function showBanner(text, sub) { S.banner = { text, sub, t: 0, dur: 2.3 }; }

function updateFx(dt) {
  for (const f of S.fx) {
    f.life -= dt;
    if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; }
    if (f.kind === 'blob' || f.kind === 'star') f.vy += 420 * dt;
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
    case 'dust':
      c.globalAlpha = k * 0.8; circle(c, f.x, f.y, f.r * (1.4 - k * 0.4)); c.fillStyle = '#fffaf0'; c.fill();
      c.lineWidth = 1.5; c.strokeStyle = 'rgba(43,33,64,.35)'; c.stroke(); break;
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
    while (sp.queue.length && sp.queue[0].t <= sp.time) spawnEnemy(sp.queue.shift().type, sp.wave);
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
      const bonus = waveBonus(sp.wave);
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
  if (!S.endless && S.wave >= TOTAL_WAVES && !S.spawners.length && !S.enemies.length) { victory(); return; }
  const idle = !S.spawners.length && !S.enemies.length;
  if (idle && S.dirty) checkpoint();
  if (S.auto && idle && (S.endless || S.wave < TOTAL_WAVES)) {
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

  // selection & placement overlays
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
  for (const e of S.enemies) units.push({ y: e.y, e });
  units.push({ y: S.M.end.y + 8, castle: true });
  units.sort((a, b) => a.y - b.y);
  for (const u of units) {
    if (u.tw) {
      const tw = u.tw;
      const p = tw.pop > 0 ? 1 + Math.sin((tw.pop / 0.4) * Math.PI) * 0.18 : 1;
      c.save(); c.translate(tw.x, tw.y + 16); c.scale(2 - p, p); c.translate(-tw.x, -tw.y - 16);
      drawTower(c, tw.type, tw.level, tw.x, tw.y, tw.angle, tw.recoil, t);
      c.restore();
      if (tw === S.selected) {
        c.save(); c.globalAlpha = 0.5 + Math.sin(t * 6) * 0.3;
        rr(c, tw.x - 22, tw.y - 12, 44, 34, 11); c.lineWidth = 3; c.strokeStyle = '#ffffff'; c.stroke();
        c.restore();
      }
    } else if (u.e) drawEnemy(c, u.e, t);
    else drawCastle(c, S.M.end.x, S.M.end.y, t, S.castleHit);
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
    outlinedText(c, b.text, 0, 0, 54, '#ffcf3f', 10);
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
  if (!S.map) return;
  setText('#lives', String(S.lives));
  setText('#gold', String(Math.floor(S.gold)));
  setText('#wave', S.endless ? `${S.wave}` : `${S.wave} / ${TOTAL_WAVES}`);
  const btn = $('#btn-wave');
  const active = S.spawners.length > 0 || S.enemies.length > 0;
  let label, disabled = S.state !== 'playing';
  if (!S.endless && S.wave >= TOTAL_WAVES) { label = 'Final wave'; disabled = true; }
  else if (S.wave === 0) label = 'Start wave 1';
  else if (active) label = `Call wave ${S.wave + 1} early`;
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
function enemyIcon(type, size = 32) {
  return iconCanvas(size, (c) => {
    const r = ENEMIES[type].r;
    const king = type === 'king';
    const s = size / ((king ? 2.9 : 2.6) * Math.max(r, 13));
    c.translate(size / 2, size * (king ? 0.6 : 0.55));
    c.scale(s, s);
    drawEnemy(c, { type, r, x: 0, y: 0, dirx: 1, diry: 0, phase: -Math.PI / 2, flash: 0, slowT: 0, hp: 1, maxHp: 1 }, 0);
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
function statRows(type, st, next) {
  const rows = [['Damage', st.dmg, next && next.dmg], ['Shots / sec', fmtRate(st.rate), next && fmtRate(next.rate)], ['Range', st.range.toFixed(1), next && next.range.toFixed(1)]];
  if (st.splash) rows.push(['Splash', st.splash.toFixed(2), next && next.splash.toFixed(2)]);
  if (st.slow) rows.push(['Slow', Math.round(st.slow * 100) + '%', next && Math.round(next.slow * 100) + '%']);
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
      ${statRows(t.type, st, next)}
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
    info.insertAdjacentHTML('beforeend', `<p>${def.desc}</p>${statRows(S.placing, def.levels[0])}
      <p class="hint">${coarse() ? 'Tap a grass tile to preview it, then tap the same tile again to build.' : 'Click a grass tile to build. Hold <kbd>Shift</kbd> to build several. <kbd>Esc</kbd> cancels.'}</p>`);
  } else {
    info.innerHTML = `<h2 class="card-title">How to play</h2>
      <p>Blobs hop along the dirt path toward your castle. Each one that gets inside costs lives.</p>
      <p class="more">Pick a tower, tap a grass tile to build it, then tap it later to upgrade or sell. Bonking blobs earns gold.</p>
      <p class="hint">Mix towers: frost slows, zaps ignore armor, owls snipe big blobs.</p>`;
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

function renderNextWave() {
  const box = $('#next-wave');
  const n = S.wave + 1;
  box.innerHTML = '';
  const done = !S.endless && S.wave >= TOTAL_WAVES;
  const title = document.createElement('h2');
  title.className = 'card-title';
  title.textContent = done ? 'Last wave is out' : `Coming up: wave ${n}`;
  box.append(title);
  if (done) {
    box.insertAdjacentHTML('beforeend', '<p class="hint">Bonk everything left on the path to save the castle.</p>');
    return;
  }
  const chips = document.createElement('div');
  chips.className = 'wave-chips';
  const counts = waveSummary(n);
  for (const [type, count] of Object.entries(counts)) {
    const chip = document.createElement('span');
    chip.className = 'chip' + (ENEMIES[type].boss ? ' boss' : '');
    chip.title = ENEMIES[type].name + (ENEMIES[type].armor ? ' (armored)' : '') + (ENEMIES[type].noSlow ? ' (can\'t be slowed)' : '') + (ENEMIES[type].splits ? ' (splits in two)' : '');
    chip.append(enemyIcon(type));
    chip.insertAdjacentHTML('beforeend', `×${count}`);
    chips.append(chip);
  }
  box.append(chips);
  box.insertAdjacentHTML('beforeend', `<p class="hint" style="margin:8px 0 0">Clear bonus: ${waveBonus(n)} gold</p>`);
}

function buildMapList() {
  const list = $('#map-list');
  list.innerHTML = '';
  MAPS.forEach((map, i) => {
    const M = buildMap(map);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'map-card';
    const cv = document.createElement('canvas');
    cv.width = 360; cv.height = 216;
    const c = cv.getContext('2d');
    renderBackground(c, M, 360 / W);
    drawCastle(c, M.end.x, M.end.y, 0, 0);
    card.append(cv);
    const best = +store.get('blobbash.best.' + map.id) || 0;
    card.insertAdjacentHTML('beforeend', `
      <div class="m-row"><h3>${map.name}</h3><span class="badge ${map.difficulty.toLowerCase()}">${map.difficulty}</span></div>
      <p>${map.blurb}</p>
      <div class="m-row"><span class="best">${best ? `Best: wave ${best}` : 'Not played yet'}</span><span class="best">${map.lives} lives · ${map.gold} gold</span></div>`);
    card.addEventListener('click', () => { Sound.init(); Sound.play('click'); startGame(i); });
    list.append(card);
  });
}

function showTitle() {
  if (S.state === 'playing') checkpoint();
  S.state = 'title';
  S.paused = false;
  $('#pause-screen').hidden = true;
  $('#end-screen').hidden = true;
  const sv = loadSave();
  const box = $('#continue-box');
  box.hidden = !sv;
  box.innerHTML = '';
  if (sv) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-go btn-continue';
    b.textContent = `Continue ${MAPS[sv.map].name}: wave ${sv.wave + 1}`;
    b.addEventListener('click', () => { Sound.init(); Sound.play('click'); startGame(sv.map, sv); });
    box.append(b);
  }
  renderInstall();
  buildMapList();
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
  store.set('blobbash.muted', Sound.muted ? '1' : '0');
  Sound.play('click');
}

$('#btn-wave').addEventListener('click', () => { Sound.init(); startWave(); });
$('#btn-speed').addEventListener('click', cycleSpeed);
$('#btn-auto').addEventListener('click', toggleAuto);
$('#btn-sound').addEventListener('click', () => { Sound.init(); toggleSound(); });
$('#btn-pause').addEventListener('click', () => setPaused(!S.paused));
$('#btn-resume').addEventListener('click', () => setPaused(false));
$('#btn-restart').addEventListener('click', () => startGame(S.mapIndex));
$('#btn-maps').addEventListener('click', showTitle);
$('#btn-retry').addEventListener('click', () => startGame(S.mapIndex));
$('#btn-menu').addEventListener('click', showTitle);
$('#btn-endless').addEventListener('click', () => {
  S.endless = true;
  S.state = 'playing';
  checkpoint();
  $('#end-screen').hidden = true;
  showBanner('Endless mode', 'How long can the castle hold?');
  renderNextWave(); renderInfo(); updateHUD(true);
});
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
    b.type = 'button'; b.className = 'btn'; b.textContent = 'Install Blob Bash';
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

if (store.get('blobbash.hint') === '1') document.body.classList.add('hint-dismissed');
$('#btn-hint-close').addEventListener('click', () => {
  document.body.classList.add('hint-dismissed');
  store.set('blobbash.hint', '1');
  resize();
});

// ============================================================
// Boot
// ============================================================
if (store.get('blobbash.muted') === '1') {
  Sound.muted = true;
  $('#btn-sound').setAttribute('aria-pressed', 'false');
  $('#btn-sound').textContent = 'Muted';
}
buildShop();
// Draw the first map behind the title screen.
S.map = MAPS[0]; S.M = buildMap(MAPS[0]); S.mapIndex = 0;
S.lives = MAPS[0].lives; S.gold = MAPS[0].gold;
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
window.BlobBash = { S, startGame, startWave, placeTower, upgradeTower, update, canPlace, checkpoint, loadSave, drawEnemy, drawTower, TOWERS, ENEMIES, makeWave };
})();
