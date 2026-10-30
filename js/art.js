'use strict';
// ============================================================
// Realistic top-down rendering: terrain, water, roads, props, zombies, towers and effects.
// Light comes from the top left, so shadows fall down and to the right.
// ============================================================
const SHADOW = 'rgba(0,0,0,0.32)';

// ---------- noise ----------
function makeNoise(seed) {
  const rng = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = new Float32Array(256);
  for (let i = 0; i < 256; i++) val[i] = rng();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const X = xi & 255, Y = yi & 255;
    const a = val[perm[X + perm[Y]]], b = val[perm[X + 1 + perm[Y]]];
    const c = val[perm[X + perm[Y + 1]]], d = val[perm[X + 1 + perm[Y + 1]]];
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
}
function fbm(n, x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f); norm += a; a *= 0.5; f *= 2.03; }
  return s / norm;
}

// ---------- small helpers ----------
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
function ellipse(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }
function radial(c, x, y, r, inner, outer, ox = -0.35, oy = -0.35) {
  const g = c.createRadialGradient(x + r * ox, y + r * oy, r * 0.05, x, y, r);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  return g;
}
function linear(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([k, col]) => g.addColorStop(k, col));
  return g;
}
function star(c, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n;
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
}
function label(c, text, x, y, size, color, weight = 700, align = 'center') {
  c.font = `${weight} ${size}px ${FONT_DISPLAY}`;
  c.textAlign = align; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(0,0,0,0.65)'; c.fillText(text, x + 1, y + 1.5);
  c.fillStyle = color; c.fillText(text, x, y);
}

// ---------- reusable textures ----------
const TEX = {};
function grainPattern(c) {
  if (!TEX.grain) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const img = g.createImageData(128, 128);
    const rng = mulberry32(99);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rng() < 0.5 ? 0 : 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = Math.floor(rng() * 26);
    }
    g.putImageData(img, 0, 0);
    TEX.grain = cv;
  }
  return c.createPattern(TEX.grain, 'repeat');
}
function roadPattern(c, world) {
  const key = 'road' + world.id;
  if (!TEX[key]) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 96;
    const g = cv.getContext('2d');
    g.fillStyle = world.road; g.fillRect(0, 0, 96, 96);
    const rng = mulberry32(world.id.length * 31);
    const stones = world.id === 'graveyard' ? 260 : world.id === 'tundra' ? 60 : 140;
    for (let i = 0; i < stones; i++) {
      const x = rng() * 96, y = rng() * 96, r = 0.5 + rng() * (world.id === 'graveyard' ? 2.2 : 1.4);
      g.fillStyle = rng() < 0.5 ? shade(world.road, -0.25 - rng() * 0.2) : shade(world.road, 0.15 + rng() * 0.15);
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    const n = makeNoise(world.id.length * 7);
    const img = g.getImageData(0, 0, 96, 96);
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
      const v = (fbm(n, x / 24, y / 24, 3) - 0.5) * 34;
      const i = (y * 96 + x) * 4;
      img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v;
    }
    g.putImageData(img, 0, 0);
    TEX[key] = cv;
  }
  return c.createPattern(TEX[key], 'repeat');
}

// Ground colour field at half resolution, smoothed when scaled up.
function groundTexture(M) {
  if (M.groundTex) return M.groundTex;
  const world = M.world, L = M.L;
  const w = W / 2, h = H / 2;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const img = g.createImageData(w, h);
  const n1 = makeNoise(L.look.seed), n2 = makeNoise(L.look.seed + 1);
  const [c0, c1, c2] = world.ground.map(hexRgb);
  const patch = hexRgb(world.id === 'swamp' ? '#2c3420' : world.id === 'tundra' ? '#b9c6d1' : world.id === 'graveyard' ? '#2f3a2a' : '#7a6a48');
  const tone = L.look.tone;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fbm(n1, x / 38, y / 38, 4);
    const p = fbm(n2, x / 70 + 9, y / 70 + 3, 3);
    let col;
    if (v < 0.5) { const k = v / 0.5; col = [lerp(c2[0], c0[0], k), lerp(c2[1], c0[1], k), lerp(c2[2], c0[2], k)]; }
    else { const k = (v - 0.5) / 0.5; col = [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)]; }
    if (p > 0.6) { const k = Math.min(1, (p - 0.6) * 3.5) * 0.55; col = col.map((c, i) => lerp(c, patch[i], k)); }
    const j = (x * 13 + y * 7) % 5 - 2; // tiny dither keeps gradients from banding
    const i = (y * w + x) * 4;
    img.data[i] = clamp(col[0] * (1 + tone) + j, 0, 255);
    img.data[i + 1] = clamp(col[1] * (1 + tone) + j, 0, 255);
    img.data[i + 2] = clamp(col[2] * (1 + tone) + j, 0, 255);
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  M.groundTex = cv;
  return cv;
}

// Offset a right-angled polyline sideways (positive = left of travel).
function offsetPolyline(pts, d) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i - 1], p = pts[i], b = pts[i + 1];
    let nx = 0, ny = 0;
    if (a) { const dx = p.x - a.x, dy = p.y - a.y, l = Math.hypot(dx, dy) || 1; nx += dy / l; ny += -dx / l; }
    if (b) { const dx = b.x - p.x, dy = b.y - p.y, l = Math.hypot(dx, dy) || 1; nx += dy / l; ny += -dx / l; }
    out.push({ x: p.x + nx * d, y: p.y + ny * d });
  }
  return out;
}
function tracePts(c, pts) { c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); }

// ============================================================
// Background
// ============================================================
function renderBackground(c, M, s) {
  if (typeof TERRAIN !== 'undefined') return TERRAIN.render(c, M, s);
  const world = M.world, L = M.L;
  c.setTransform(s, 0, 0, s, 0, 0);
  c.imageSmoothingEnabled = true;
  c.drawImage(groundTexture(M), 0, 0, W, H);
  c.fillStyle = grainPattern(c); c.fillRect(0, 0, W, H);

  // grass blades / snow sparkle / swamp reeds for close-up texture
  const rng = mulberry32(L.look.seed + 5);
  c.lineCap = 'round';
  for (let i = 0; i < 1400; i++) {
    const x = rng() * W, y = rng() * H;
    const k = Math.floor(y / TILE) * COLS + Math.floor(x / TILE);
    if (M.grid[k] === 1 || M.grid[k] === 3) continue;
    if (world.id === 'tundra') {
      c.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(150,170,190,0.25)';
      c.fillRect(x, y, 1.2, 1.2);
    } else {
      const base = world.ground[Math.floor(rng() * 3)];
      c.strokeStyle = shade(base, rng() < 0.5 ? -0.25 : 0.18);
      c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rng() - 0.5) * 3, y - 2 - rng() * 3); c.stroke();
    }
  }

  drawWater(c, M);
  drawRoads(c, M);
  drawBridges(c, M);
  const decor = [...M.decor].sort((a, b) => a.y - b.y);
  for (const d of decor) drawDecor(c, d, world);
}

function drawWater(c, M) {
  const water = M.L.water;
  if (!water.some((v) => v)) return;
  const world = M.world;
  const tiles = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (water[y * COLS + x]) tiles.push([x, y]);
  const blob = (r) => {
    c.beginPath();
    for (const [x, y] of tiles) {
      const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
      c.moveTo(cx + r, cy); c.arc(cx, cy, r, 0, TAU);
      if (x + 1 < COLS && water[y * COLS + x + 1]) c.rect(cx, cy - r, TILE, r * 2);
      if (y + 1 < ROWS && water[(y + 1) * COLS + x]) c.rect(cx - r, cy, r * 2, TILE);
    }
  };
  // muddy bank, then water, then a darker deep core
  const bank = world.id === 'tundra' ? '#c7d3dc' : world.id === 'swamp' ? '#3a3a24' : '#6b5d45';
  blob(TILE * 0.78); c.fillStyle = bank; c.fill();
  blob(TILE * 0.66); c.fillStyle = world.water; c.fill();
  c.save();
  blob(TILE * 0.66); c.clip();
  c.fillStyle = linear(c, 0, 0, W, H, [[0, shade(world.water, 0.12)], [1, shade(world.water, -0.2)]]);
  c.globalAlpha = 0.7; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
  blob(TILE * 0.5); c.fillStyle = shade(world.water, -0.22); c.globalAlpha = 0.45; c.fill(); c.globalAlpha = 1;
  if (world.id === 'tundra') {
    // ice sheet cracks
    const rng = mulberry32(M.L.look.seed + 9);
    c.strokeStyle = 'rgba(220,240,255,0.35)'; c.lineWidth = 1;
    for (const [x, y] of tiles) if (rng() < 0.5) {
      c.beginPath(); c.moveTo(x * TILE + rng() * TILE, y * TILE + rng() * TILE); c.lineTo(x * TILE + rng() * TILE, y * TILE + rng() * TILE); c.stroke();
    }
  }
  if (world.id === 'swamp') {
    const rng = mulberry32(M.L.look.seed + 11);
    for (const [x, y] of tiles) if (rng() < 0.35) {
      ellipse(c, x * TILE + rng() * TILE, y * TILE + rng() * TILE, 4 + rng() * 5, 3 + rng() * 3, rng() * 3);
      c.fillStyle = 'rgba(110,140,60,0.55)'; c.fill();
    }
  }
  c.restore();
}

function drawRoads(c, M) {
  const world = M.world;
  const pw = TILE * 0.8;
  c.lineJoin = 'round'; c.lineCap = 'round';
  // soft verge
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 10;
  for (const p of M.paths) { tracePts(c, p.pts); c.strokeStyle = world.roadEdge; c.lineWidth = pw + 8; c.stroke(); }
  c.restore();
  for (const p of M.paths) { tracePts(c, p.pts); c.strokeStyle = world.roadEdge; c.lineWidth = pw + 4; c.stroke(); }
  const pat = roadPattern(c, world);
  for (const p of M.paths) { tracePts(c, p.pts); c.strokeStyle = pat; c.lineWidth = pw; c.stroke(); }
  // tyre ruts or tracks
  c.lineWidth = world.id === 'tundra' ? 4 : 3;
  c.strokeStyle = world.id === 'tundra' ? 'rgba(120,135,150,0.35)' : 'rgba(0,0,0,0.18)';
  for (const p of M.paths) {
    for (const off of [-TILE * 0.17, TILE * 0.17]) { tracePts(c, offsetPolyline(p.pts, off)); c.stroke(); }
  }
  if (world.id === 'swamp' || world.id === 'farmland') {
    const rng = mulberry32(M.L.look.seed + 3);
    for (const p of M.paths) for (let i = 0; i < 10; i++) {
      const q = pointOn(p, rng() * p.total);
      ellipse(c, q.x + (rng() - 0.5) * 14, q.y + (rng() - 0.5) * 14, 5 + rng() * 7, 3 + rng() * 4, rng() * 3);
      c.fillStyle = world.id === 'swamp' ? 'rgba(40,45,30,0.55)' : 'rgba(60,48,34,0.35)'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1; c.stroke();
    }
  }
}

function drawBridges(c, M) {
  const { bridges } = M.L;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!bridges[y * COLS + x]) continue;
    const horiz = (x > 0 && M.grid[y * COLS + x - 1] === 1) || (x < COLS - 1 && M.grid[y * COLS + x + 1] === 1);
    c.save();
    c.translate(x * TILE + TILE / 2, y * TILE + TILE / 2);
    if (!horiz) c.rotate(Math.PI / 2);
    const len = TILE + 2, wid = TILE * 0.84;
    c.fillStyle = SHADOW; c.fillRect(-len / 2 + 4, -wid / 2 + 6, len, wid);
    c.fillStyle = '#6e5235'; c.fillRect(-len / 2, -wid / 2, len, wid);
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1;
    for (let i = -len / 2 + 4; i < len / 2; i += 6) { c.beginPath(); c.moveTo(i, -wid / 2); c.lineTo(i, wid / 2); c.stroke(); }
    c.fillStyle = '#4b3824';
    c.fillRect(-len / 2, -wid / 2 - 2, len, 4); c.fillRect(-len / 2, wid / 2 - 2, len, 4);
    c.restore();
  }
}

// ---------- props ----------
function canopy(c, x, y, r, dark, light, rng, lumps = 6) {
  ellipse(c, x + r * 0.35, y + r * 0.45, r * 1.05, r * 0.95); c.fillStyle = SHADOW; c.fill();
  for (let i = 0; i < lumps; i++) {
    const a = rng() * TAU, d = r * 0.45 * rng();
    const lr = r * (0.5 + rng() * 0.25);
    circle(c, x + Math.cos(a) * d, y + Math.sin(a) * d, lr);
    c.fillStyle = radial(c, x + Math.cos(a) * d, y + Math.sin(a) * d, lr, light, dark);
    c.fill();
  }
  for (let i = 0; i < 18; i++) {
    const a = rng() * TAU, d = r * 0.8 * Math.sqrt(rng());
    circle(c, x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + rng() * 1.6);
    c.fillStyle = rng() < 0.6 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)'; c.fill();
  }
}
function roofBox(c, w, h, roof, wall, rng) {
  c.fillStyle = SHADOW; c.fillRect(-w / 2 + 6, -h / 2 + 7, w, h);
  c.fillStyle = wall; c.fillRect(-w / 2, -h / 2, w, h);
  c.fillStyle = linear(c, 0, -h / 2, 0, h / 2, [[0, shade(roof, 0.12)], [0.5, roof], [0.501, shade(roof, -0.25)], [1, shade(roof, -0.35)]]);
  c.fillRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
  c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1;
  for (let i = -w / 2 + 4; i < w / 2; i += 5) { c.beginPath(); c.moveTo(i, -h / 2 + 1); c.lineTo(i, h / 2 - 1); c.stroke(); }
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-w / 2, -1, w, 2);
  if (rng() < 0.6) { c.fillStyle = 'rgba(20,15,10,0.55)'; ellipse(c, (rng() - 0.5) * w * 0.5, (rng() - 0.5) * h * 0.4, 4, 3); c.fill(); }
}

function drawDecor(c, d, world) {
  const rng = mulberry32(d.seed);
  c.save();
  c.translate(d.x, d.y);
  c.scale(d.s, d.s);
  switch (d.kind) {
    case 'oak': canopy(c, 0, 0, 17, '#2f4a20', '#6b8f3c', rng); break;
    case 'bush': canopy(c, 0, 0, 10, '#2e4520', '#5d7d36', rng, 4); break;
    case 'cypress': {
      canopy(c, 0, 0, 16, '#22301a', '#4c5e30', rng, 7);
      c.strokeStyle = 'rgba(170,180,150,0.45)'; c.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) { const a = rng() * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); c.lineTo(Math.cos(a) * 15, Math.sin(a) * 15 + 3); c.stroke(); }
      break;
    }
    case 'pine': {
      ellipse(c, 6, 8, 18, 14); c.fillStyle = SHADOW; c.fill();
      for (const [r, col] of [[18, '#1d3a2c'], [13, '#24493a'], [8, '#2d5a47']]) {
        star(c, 0, 0, r, r * 0.55, 9, rng() * TAU); c.fillStyle = col; c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 7; i++) { ellipse(c, -6 + rng() * 9, -6 + rng() * 9, 2 + rng() * 3, 1.5 + rng() * 2, rng() * 3); c.fill(); }
      break;
    }
    case 'deadtree': {
      c.strokeStyle = SHADOW; c.lineWidth = 3; c.lineCap = 'round';
      const branches = Array.from({ length: 6 }, () => [rng() * TAU, 10 + rng() * 9]);
      for (const [a, l] of branches) { c.beginPath(); c.moveTo(4, 5); c.lineTo(4 + Math.cos(a) * l, 5 + Math.sin(a) * l); c.stroke(); }
      c.strokeStyle = '#3e342c';
      for (const [a, l] of branches) {
        c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * l, Math.sin(a) * l); c.stroke();
        c.lineWidth = 1.5; c.beginPath(); c.moveTo(Math.cos(a) * l * 0.6, Math.sin(a) * l * 0.6); c.lineTo(Math.cos(a + 0.5) * l * 0.9, Math.sin(a + 0.5) * l * 0.9); c.stroke();
      }
      circle(c, 0, 0, 4); c.fillStyle = '#4a3e33'; c.fill();
      break;
    }
    case 'rock': case 'snowrock': {
      const pts = Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * TAU; const r = 9 + rng() * 5; return [Math.cos(a) * r, Math.sin(a) * r * 0.8]; });
      c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x + 4, y + 5) : c.moveTo(x + 4, y + 5))); c.closePath(); c.fillStyle = SHADOW; c.fill();
      c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
      c.fillStyle = radial(c, 0, 0, 14, '#9a9a94', '#55554f'); c.fill();
      if (d.kind === 'snowrock') { ellipse(c, -2, -3, 8, 5, -0.4); c.fillStyle = 'rgba(245,250,255,0.92)'; c.fill(); }
      break;
    }
    case 'hay': {
      circle(c, 4, 5, 13); c.fillStyle = SHADOW; c.fill();
      circle(c, 0, 0, 13); c.fillStyle = radial(c, 0, 0, 13, '#d8b864', '#9a7a33'); c.fill();
      c.strokeStyle = 'rgba(90,65,20,0.5)'; c.lineWidth = 1;
      c.beginPath(); for (let a = 0; a < 18; a += 0.3) c.lineTo(Math.cos(a) * a * 0.7, Math.sin(a) * a * 0.7); c.stroke();
      break;
    }
    case 'crops': {
      c.rotate(d.rot % (Math.PI / 2));
      c.fillStyle = 'rgba(70,50,30,0.5)'; c.fillRect(-20, -20, 40, 40);
      for (let row = -16; row <= 16; row += 8) for (let col = -16; col <= 16; col += 5) {
        circle(c, col + (rng() - 0.5), row + (rng() - 0.5), 2.2 + rng()); c.fillStyle = rng() < 0.3 ? '#8a9a3a' : '#5f7a2a'; c.fill();
      }
      break;
    }
    case 'fence': {
      c.rotate(d.rot);
      c.strokeStyle = SHADOW; c.lineWidth = 3; c.beginPath(); c.moveTo(-18, 4); c.lineTo(18, 4); c.stroke();
      c.strokeStyle = '#7a6046'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-18, 0); c.lineTo(18, 0); c.stroke();
      for (let x = -18; x <= 18; x += 9) { c.fillStyle = '#5a4430'; c.fillRect(x - 2, -2, 4, 4); }
      break;
    }
    case 'car': {
      c.rotate(d.rot);
      const body = ['#6d2a24', '#3f4f5f', '#7d7462', '#2f3a2a', '#8a8a86'][Math.floor(rng() * 5)];
      rr(c, -18 + 4, -9 + 5, 36, 18, 5); c.fillStyle = SHADOW; c.fill();
      rr(c, -18, -9, 36, 18, 5); c.fillStyle = linear(c, 0, -9, 0, 9, [[0, shade(body, 0.2)], [1, shade(body, -0.3)]]); c.fill();
      rr(c, -6, -7, 14, 14, 3); c.fillStyle = shade(body, -0.15); c.fill();
      c.fillStyle = 'rgba(30,40,50,0.85)'; rr(c, 7, -7, 5, 14, 2); c.fill(); rr(c, -11, -6.5, 4, 13, 2); c.fill();
      c.fillStyle = 'rgba(120,70,30,0.45)'; ellipse(c, -12 + rng() * 20, -4 + rng() * 8, 3, 2); c.fill();
      break;
    }
    case 'barn': c.rotate(Math.floor(d.rot * 2) * Math.PI / 2); roofBox(c, 40, 30, '#7a2f26', '#4a2a20', rng); break;
    case 'cabin': c.rotate(Math.floor(d.rot * 2) * Math.PI / 2); roofBox(c, 34, 26, '#5a4636', '#3a2c20', rng);
      c.fillStyle = 'rgba(240,248,255,0.7)'; c.fillRect(-17, -13, 34, 6); break;
    case 'shack': c.rotate(Math.floor(d.rot * 2) * Math.PI / 2); roofBox(c, 32, 24, '#5e6655', '#3a3a2c', rng); break;
    case 'crypt': c.rotate(Math.floor(d.rot * 2) * Math.PI / 2); roofBox(c, 32, 26, '#6a6a66', '#3c3c3a', rng);
      c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(-3, -13, 6, 26); break;
    case 'tomb': {
      c.rotate((rng() - 0.5) * 0.3);
      c.fillStyle = 'rgba(60,45,30,0.55)'; rr(c, -8, -2, 16, 22, 4); c.fill();
      rr(c, -9 + 3, -12 + 5, 18, 9, 3); c.fillStyle = SHADOW; c.fill();
      rr(c, -9, -12, 18, 9, 3); c.fillStyle = linear(c, 0, -12, 0, -3, [[0, '#a8a6a0'], [1, '#6c6a64']]); c.fill();
      c.fillStyle = 'rgba(90,110,70,0.5)'; ellipse(c, -4, -8, 3, 2); c.fill();
      break;
    }
    case 'cross': {
      c.rotate((rng() - 0.5) * 0.4);
      c.fillStyle = SHADOW; c.fillRect(-2 + 4, -12 + 5, 5, 24); c.fillRect(-8 + 4, -5 + 5, 17, 5);
      c.fillStyle = '#8e8c86'; c.fillRect(-2.5, -12, 5, 24); c.fillRect(-8.5, -5, 17, 5);
      break;
    }
    case 'log': {
      c.rotate(d.rot);
      rr(c, -16 + 3, -5 + 5, 32, 10, 5); c.fillStyle = SHADOW; c.fill();
      rr(c, -16, -5, 32, 10, 5); c.fillStyle = linear(c, 0, -5, 0, 5, [[0, '#8a6a4a'], [1, '#4a3626']]); c.fill();
      ellipse(c, 16, 0, 3, 5); c.fillStyle = '#c2a27a'; c.fill();
      c.fillStyle = 'rgba(255,255,255,0.8)'; ellipse(c, -2, -3, 10, 2.2); c.fill();
      break;
    }
    case 'barrel': {
      ellipse(c, 6, 9, 14, 8); c.fillStyle = 'rgba(120,200,60,0.35)'; c.fill();
      circle(c, 3, 4, 9); c.fillStyle = SHADOW; c.fill();
      circle(c, 0, 0, 9); c.fillStyle = radial(c, 0, 0, 9, '#c9b23a', '#6e5f18'); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1.5; circle(c, 0, 0, 6.5); c.stroke();
      break;
    }
    case 'mushroom': {
      for (let i = 0; i < 4; i++) {
        const x = (rng() - 0.5) * 18, y = (rng() - 0.5) * 18, r = 3 + rng() * 4;
        circle(c, x + 2, y + 3, r); c.fillStyle = SHADOW; c.fill();
        circle(c, x, y, r); c.fillStyle = radial(c, x, y, r, '#c7b2d6', '#6b4f7c'); c.fill();
      }
      break;
    }
    case 'reeds': {
      c.strokeStyle = '#6b7a3a'; c.lineWidth = 1.2; c.lineCap = 'round';
      for (let i = 0; i < 24; i++) { const a = rng() * TAU, l = 6 + rng() * 10; c.beginPath(); c.moveTo((rng() - 0.5) * 8, (rng() - 0.5) * 8); c.lineTo(Math.cos(a) * l, Math.sin(a) * l); c.stroke(); }
      break;
    }
  }
  c.restore();
}

function drawSafehouse(c, x, y, t, hit, night, gap) {
  if (typeof BUILDINGS !== 'undefined') return BUILDINGS.safehouse(c, x, y, t, hit, gap);
  c.save();
  c.translate(x, y);
  if (hit > 0) c.translate(Math.sin(hit * 60) * 2 * (hit / 0.5), 0);
  // sandbag ring
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    ellipse(c, Math.cos(a) * 26 + 2, Math.sin(a) * 22 + 3, 7, 4.5, a + Math.PI / 2); c.fillStyle = SHADOW; c.fill();
    ellipse(c, Math.cos(a) * 26, Math.sin(a) * 22, 7, 4.5, a + Math.PI / 2);
    c.fillStyle = radial(c, Math.cos(a) * 26, Math.sin(a) * 22, 7, '#b8a77a', '#6f6243'); c.fill();
  }
  // bunker roof
  c.fillStyle = SHADOW; rr(c, -16 + 5, -13 + 6, 32, 26, 3); c.fill();
  rr(c, -16, -13, 32, 26, 3);
  c.fillStyle = linear(c, -16, -13, 16, 13, [[0, '#8c8f8a'], [1, '#4f524e']]); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1;
  for (let i = -10; i <= 10; i += 6) { c.beginPath(); c.moveTo(i, -13); c.lineTo(i, 13); c.stroke(); }
  // vents and hatch
  c.fillStyle = '#2f322f'; rr(c, -11, -8, 8, 6, 1.5); c.fill(); rr(c, 4, 3, 8, 6, 1.5); c.fill();
  circle(c, 5, -6, 3.5); c.fillStyle = '#3a3d39'; c.fill();
  // flag
  c.strokeStyle = '#222'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-14, 10); c.lineTo(-14, -2); c.stroke();
  const wv = Math.sin(t * 5) * 1.5;
  c.beginPath(); c.moveTo(-14, -2); c.lineTo(-4, -1 + wv); c.lineTo(-14, 3); c.closePath(); c.fillStyle = '#b8402f'; c.fill();
  c.restore();
}

// ============================================================
// Zombies
// ============================================================
function drawHealthBar(c, e) {
  const def = ZOMBIES[e.type];
  if (def.boss && !def.mini) return; // bosses get the big plate at the top
  if (e.hp >= e.maxHp || e.burrowed) return;
  const bw = Math.max(20, e.r * 1.9), by = e.y - e.r * 1.25 - 7 - (def.fly ? 4 : 0);
  const k = clamp(e.hp / e.maxHp, 0, 1);
  c.fillStyle = 'rgba(10,12,14,0.8)'; c.fillRect(e.x - bw / 2 - 1, by - 1, bw + 2, 5);
  c.fillStyle = k > 0.5 ? '#79b04a' : k > 0.25 ? '#d9a531' : '#c8453b';
  c.fillRect(e.x - bw / 2, by, bw * k, 3);
  if (e.armor > 0) { c.fillStyle = '#a9b4bd'; c.fillRect(e.x - bw / 2 - 5, by - 1, 3, 5); }
}

// ============================================================
// Towers
// ============================================================
// ---------- upgrade looks ----------
// Each path paints its tower in its own colours, deeper with every tier, and the tower grows.
const PAINT = {
  gunner: ['#2f7fd0', '#d8862a', '#b0302a'], sniper: ['#2c4a80', '#c0902a', '#3f8a4a'], mortar: ['#d0582a', '#2f9a8a', '#3f72a8'],
  cryo: ['#4fc8ff', '#eef4fa', '#5a62e0'], gunboat: ['#2f4f78', '#d0a030', '#a8302a'], flame: ['#e8401a', '#e8a81e', '#3f8aff'],
  tesla: ['#8a5cff', '#ffc62e', '#22d0aa'], heli: ['#262b30', '#a8502a', '#e4e4dc'], sub: ['#2a4a8a', '#a02a2a', '#2a9a5a'],
  jet: ['#3a6a9a', '#3c3c2e', '#b03a3a'], farm: ['#e0b830', '#c9483d', '#4a7aa8'],
  heater: ['#c8742a', '#a85a3a', '#e0401a'],
};
const LOOK_K = [0, 0.34, 0.48, 0.62, 0.74, 0.84];
const LOOK_SCALE = [1, 1.04, 1.08, 1.13, 1.18, 1.25];
function towerLook(tw) {
  let n = 0, p = 0;
  (tw.tiers || [0, 0, 0]).forEach((v, i) => { if (v > n) { n = v; p = i; } });
  return { n, p, hue: n ? PAINT[tw.type][p] : null, k: LOOK_K[n], col: n ? PATH_COLORS[p] : null, skin: SKIN_LOOK[skinOf(tw.type)] || null };
}
const paintCache = new Map();
// A base colour shifted toward the tower's path colour (returns hex so shade() still works).
// A premium skin first repaints the colour along the skin's own ramp (dark to light, keeping how
// light or dark it was); crews pass a low mult, so they keep most of their natural colours.
function paint(base, L, mult = 1) {
  if (!L || (!L.hue && !L.skin)) return base;
  const k = L.hue ? Math.min(0.92, L.k * mult * (L.skin ? 0.5 : 1)) : 0, sk = L.skin;
  const key = base + L.hue + k + (sk ? sk.id + mult : '');
  let v = paintCache.get(key);
  if (!v) {
    let A = hexRgb(base);
    if (sk) {
      const lum = (A[0] * 0.3 + A[1] * 0.59 + A[2] * 0.11) / 255, t = clamp(lum * sk.gain + sk.lift, 0, 1);
      const R = sk.ramp.map(hexRgb), u = t < 0.5 ? t * 2 : (t - 0.5) * 2, [P0, P1] = t < 0.5 ? [R[0], R[1]] : [R[1], R[2]];
      const s2 = Math.min(1, mult * 2.5);
      A = A.map((q, i) => lerp(q, lerp(P0[i], P1[i], u), s2));
    }
    const B = L.hue ? hexRgb(L.hue) : A;
    v = '#' + A.map((q, i) => Math.round(lerp(q, B[i], k)).toString(16).padStart(2, '0')).join('');
    paintCache.set(key, v);
  }
  return v;
}
function octagon(c, R, ox = 0, oy = 0) {
  c.beginPath();
  for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU + Math.PI / 8; c.lineTo(ox + Math.cos(q) * R, oy + Math.sin(q) * R); }
  c.closePath();
}
// The ground under an upgraded tower: a painted ring at tier 2, a steel platform at 3,
// a bigger lit platform at 4 and a gold one with a spinning ring at 5.
function upgradePlinth(c, L, t, type, lights, x, y) {
  const n = L.n;
  if (n < 2) return;
  const col = L.col, rgb = hexRgb(col).join(',');
  if (type === 'gunboat' || type === 'sub') {
    circle(c, 0, 0, 18 + n * 1.5); c.strokeStyle = `rgba(${rgb},${0.2 + n * 0.09})`; c.lineWidth = 1 + n * 0.5; c.stroke();
    if (n === 5) { c.setLineDash([5, 5]); c.lineDashOffset = -t * 18; circle(c, 0, 0, 28); c.strokeStyle = 'rgba(240,200,100,0.7)'; c.lineWidth = 1.5; c.stroke(); c.setLineDash([]); }
    return;
  }
  if (type === 'farm' || type === 'heater') return;
  if (n === 2) { circle(c, 0, 0, 21); c.strokeStyle = `rgba(${rgb},0.6)`; c.lineWidth = 2.2; c.stroke(); return; }
  const R = n >= 4 ? 24 : 22;
  octagon(c, R, 3, 4); c.fillStyle = SHADOW; c.fill();
  octagon(c, R);
  c.fillStyle = n === 5 ? linear(c, -R, -R, R, R, [[0, '#f4d98a'], [0.5, '#c9973a'], [1, '#7a5418']]) : linear(c, -R, -R, R, R, [[0, '#858b90'], [1, '#3c4146']]);
  c.fill();
  octagon(c, R - 3); c.strokeStyle = col; c.lineWidth = n >= 4 ? 3 : 2.2; c.stroke();
  c.fillStyle = 'rgba(0,0,0,0.45)';
  for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU + Math.PI / 8; circle(c, Math.cos(q) * (R - 1.5), Math.sin(q) * (R - 1.5), 0.9); c.fill(); }
  if (n >= 4) {
    for (let i = 0; i < 4; i++) {
      const q = (i / 4) * TAU + Math.PI / 4, lx = Math.cos(q) * (R - 1), ly = Math.sin(q) * (R - 1);
      const on = Math.sin(t * 4 + i * 1.6) > -0.3;
      circle(c, lx, ly, 2.2); c.fillStyle = on ? col : 'rgba(0,0,0,0.5)'; c.fill();
      if (on && lights) lights.push({ x: x + lx, y: y + ly, r: 12, color: rgb, a: 0.6 });
    }
  }
  if (n === 5) {
    c.save(); c.setLineDash([6, 5]); c.lineDashOffset = -t * 20;
    octagon(c, R + 3); c.strokeStyle = col; c.lineWidth = 1.6; c.stroke();
    c.restore();
  }
}
// Tier 5 towers shed rising sparks in their path colour.
function upgradeSparks(c, L, t, x, lights, y) {
  if (L.n < 5) return;
  for (let i = 0; i < 7; i++) {
    const k = (t * 0.55 + i / 7 + x * 0.001) % 1;
    const px = Math.sin(i * 2.3 + x) * 15, py = 8 - k * 34;
    circle(c, px, py, 1.6 * (1 - k * 0.5)); c.fillStyle = rgba(i % 2 ? L.col : '#ffe7a0', 1 - k); c.fill();
  }
  if (lights) lights.push({ x, y, r: 44, color: hexRgb(L.col).join(','), a: 0.35 });
}

// A ring of filled sandbags: each bag is a stuffed sack with pinched, tied ends, a seam
// down its back and a shadow where it presses on the bag below.
function sandbags(c, r, n = 12, L = null) {
  const lit = paint('#c2b182', L, 0.28), mid = paint('#9a8a5e', L, 0.28), dark = paint('#5e5236', L, 0.28);
  const bw = (TAU * r) / n * 0.62, bh = 5.2;
  const bag = (q) => {
    c.save(); c.translate(Math.cos(q) * r, Math.sin(q) * r); c.rotate(q + Math.PI / 2);
    c.beginPath();
    c.moveTo(-bw, -bh * 0.35); c.quadraticCurveTo(-bw * 0.95, -bh, -bw * 0.4, -bh); c.quadraticCurveTo(0, -bh * 1.12, bw * 0.4, -bh);
    c.quadraticCurveTo(bw * 0.95, -bh, bw, -bh * 0.35); c.lineTo(bw * 1.12, 0); c.lineTo(bw, bh * 0.35);
    c.quadraticCurveTo(bw * 0.95, bh, bw * 0.4, bh); c.quadraticCurveTo(0, bh * 1.1, -bw * 0.4, bh); c.quadraticCurveTo(-bw * 0.95, bh, -bw, bh * 0.35); c.lineTo(-bw * 1.12, 0); c.closePath();
  };
  for (let i = 0; i < n; i++) { const q = (i / n) * TAU; c.save(); c.translate(2, 3); bag(q); c.restore(); c.fillStyle = SHADOW; c.fill(); c.restore(); }
  for (let pass = 0; pass < 2; pass++) for (let i = pass; i < n; i += 2) {
    const q = (i / n) * TAU; bag(q);
    c.fillStyle = linear(c, 0, -bh, 0, bh, [[0, lit], [0.55, mid], [1, dark]]); c.fill();
    c.strokeStyle = 'rgba(40,32,18,0.55)'; c.lineWidth = 0.6; c.stroke();
    // seam and tie ends
    c.strokeStyle = 'rgba(60,48,28,0.55)'; c.lineWidth = 0.45; c.setLineDash([0.9, 0.9]);
    c.beginPath(); c.moveTo(-bw * 0.7, bh * 0.15); c.quadraticCurveTo(0, -bh * 0.1, bw * 0.7, bh * 0.15); c.stroke(); c.setLineDash([]);
    c.fillStyle = dark; for (const sd of [-1, 1]) { c.beginPath(); c.arc(sd * bw * 1.02, 0, 0.9, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(255,248,220,0.28)'; c.beginPath(); c.ellipse(-bw * 0.2, -bh * 0.55, bw * 0.45, bh * 0.22, 0, 0, TAU); c.fill();
    c.restore();
  }
}
// A steel deck plate: bevelled edge, seam lines, hazard-striped corners and bolts.
function pad(c, size = 36, top = '#8f918b', bottom = '#5a5c57') {
  const h = size / 2;
  c.fillStyle = SHADOW; rr(c, -h + 3, -h + 4, size, size, 5); c.fill();
  rr(c, -h, -h, size, size, 5);
  c.fillStyle = linear(c, -h, -h, h, h, [[0, shade(top, 0.12)], [0.45, top], [1, bottom]]); c.fill();
  rr(c, -h + 2.5, -h + 2.5, size - 5, size - 5, 3.5); c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 0.8; c.stroke();
  rr(c, -h + 3.2, -h + 3.2, size - 5, size - 5, 3.5); c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 0.6; c.stroke();
  // tread pattern on the deck
  c.save(); rr(c, -h + 3, -h + 3, size - 6, size - 6, 3); c.clip();
  c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 0.8;
  for (let yy = -h; yy < h; yy += 3.4) for (let xx = -h + ((yy / 3.4) % 2 ? 1.7 : 0); xx < h; xx += 3.4) { c.beginPath(); c.moveTo(xx - 0.8, yy + 0.8); c.lineTo(xx + 0.8, yy - 0.8); c.stroke(); }
  c.restore();
  // yellow and black hazard corners
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    c.save(); c.translate(sx * (h - 5), sy * (h - 5)); c.beginPath(); c.moveTo(0, -sy * 0); c.rect(sx > 0 ? -3 : -1, sy > 0 ? -3 : -1, 4, 4); c.clip();
    c.fillStyle = '#d8b03a'; c.fillRect(-4, -4, 8, 8); c.strokeStyle = '#1d1f1c'; c.lineWidth = 1;
    for (let i = -6; i < 6; i += 2.2) { c.beginPath(); c.moveTo(i, -4); c.lineTo(i + 4, 4); c.stroke(); }
    c.restore();
  }
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    circle(c, x * (h - 2.6), y * (h - 2.6) + 0.5, 1.4); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill();
    circle(c, x * (h - 2.6), y * (h - 2.6), 1.3); c.fillStyle = radial(c, x * (h - 2.6), y * (h - 2.6), 1.3, '#c8c9c2', '#4a4c48'); c.fill();
  }
}
// ---------- people ----------
// A hex-in, hex-out shade (shade() returns rgb(), which cannot be shaded again).
function tint(h, k) {
  const A = hexRgb(h), T = k >= 0 ? 255 : 0, a = Math.min(1, Math.abs(k));
  return '#' + A.map((q) => Math.round(q + (T - q) * a).toString(16).padStart(2, '0')).join('');
}
const SKINS = ['#c99a78', '#a8754f', '#e2b896', '#7a5236', '#b98a64', '#8f6244'];
// Camouflage: soft blotches in three tones over whatever path is clipped.
function camo(c, base, seed, x0, y0, w, h, scale = 1) {
  const rng = mulberry32(seed), tones = [tint(base, 0.2), tint(base, -0.3), mix(base, '#8a7652', 0.45).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, r, g, b) => '#' + [r, g, b].map((v) => (+v).toString(16).padStart(2, '0')).join(''))];
  for (let i = 0; i < 14; i++) {
    c.fillStyle = tones[i % 3];
    const bx = x0 + rng() * w, by = y0 + rng() * h, r = (0.9 + rng() * 1.5) * scale;
    c.beginPath();
    for (let k = 0; k < 6; k++) { const q = (k / 6) * TAU, rr2 = r * (0.65 + rng() * 0.5); c.lineTo(bx + Math.cos(q) * rr2 * 1.3, by + Math.sin(q) * rr2); }
    c.closePath(); c.fill();
  }
}
// A limb as a tapered, shaded tube from a to b through the joint j: dark edge, cloth, a lit seam.
function limb(c, pts, w, cloth, seed) {
  const path = () => { c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); };
  c.lineCap = 'round'; c.lineJoin = 'round';
  path(); c.strokeStyle = rgba(tint(cloth, -0.55), 0.85); c.lineWidth = w + 0.7; c.stroke();
  path(); c.strokeStyle = cloth; c.lineWidth = w; c.stroke();
  // a fold at the joint and a few camouflage flecks along the sleeve
  const rng = mulberry32(seed);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    for (let k = 0; k < 3; k++) { const f = 0.15 + rng() * 0.7; c.fillStyle = rng() < 0.5 ? tint(cloth, -0.2) : tint(cloth, 0.12); ellipse(c, ax + (bx - ax) * f + (rng() - 0.5) * w * 0.35, ay + (by - ay) * f + (rng() - 0.5) * w * 0.35, w * 0.22, w * 0.14, Math.atan2(by - ay, bx - ax)); c.fill(); }
  }
  path(); c.strokeStyle = rgba(tint(cloth, 0.4), 0.3); c.lineWidth = w * 0.3; c.save(); c.translate(-w * 0.15, -w * 0.18); c.stroke(); c.restore();
}
// A gloved (or bare) hand closed round a grip, pointing along (dx, dy).
function hand(c, x, y, dx, dy, col) {
  c.save(); c.translate(x, y); c.rotate(Math.atan2(dy, dx));
  ellipse(c, 0.2, 0.3, 2.1, 1.7); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
  ellipse(c, 0, 0, 2.1, 1.65); c.fillStyle = radial(c, -0.6, -0.6, 2.4, tint(col, 0.28), tint(col, -0.35)); c.fill();
  c.strokeStyle = rgba(tint(col, -0.55), 0.8); c.lineWidth = 0.35;
  for (const k of [-0.7, 0, 0.7]) { c.beginPath(); c.moveTo(1, k); c.lineTo(1.9, k * 0.8); c.stroke(); }
  c.restore();
}
// A helmet seen from above: a cloth cover in the helmet's camouflage, the rubber band with its
// reflective tabs, rails down the sides, ear defenders, and a night-vision mount on the brow.
function helmetTop(c, hx, hy, R, col, seed) {
  for (const sd of [-1, 1]) { rr(c, hx - 1.6, hy + sd * R * 0.88 - 1.1, 3.4, 2.2, 1); c.fillStyle = '#25272a'; c.fill(); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(hx - 1, hy + sd * R * 0.88 - 0.8, 2, 0.5); }
  circle(c, hx + 0.3, hy + 0.5, R + 0.4); c.fillStyle = 'rgba(0,0,0,0.38)'; c.fill();
  c.save(); circle(c, hx, hy, R); c.clip();
  c.fillStyle = radial(c, hx - R * 0.3, hy - R * 0.35, R * 1.5, tint(col, 0.18), tint(col, -0.42), 0, 0); c.fillRect(hx - R, hy - R, R * 2, R * 2);
  c.globalAlpha *= 0.5; camo(c, col, seed, hx - R, hy - R, R * 2, R * 2, R / 5.3); c.globalAlpha /= 0.5;
  c.fillStyle = radial(c, hx, hy, R, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.35)', 0, 0); c.fillRect(hx - R, hy - R, R * 2, R * 2);
  // stitched seams of the cover
  c.strokeStyle = rgba(tint(col, -0.5), 0.5); c.lineWidth = 0.3; c.setLineDash([0.6, 0.5]);
  c.beginPath(); c.moveTo(hx - R, hy); c.quadraticCurveTo(hx, hy - R * 0.25, hx + R, hy); c.stroke(); c.setLineDash([]);
  c.restore();
  // the rim, a rubber band with two reflective tabs at the back, side rails and the brow mount
  circle(c, hx, hy, R - 0.2); c.strokeStyle = rgba(tint(col, -0.6), 0.7); c.lineWidth = 0.4; c.stroke();
  circle(c, hx, hy, R * 0.74); c.strokeStyle = 'rgba(25,26,22,0.45)'; c.lineWidth = 0.55; c.stroke();
  c.fillStyle = 'rgba(230,226,190,0.8)'; for (const sd of [-1, 1]) c.fillRect(hx - R * 0.76 - 0.3, hy + sd * 1.5 - 0.3, 0.6, 0.6);
  c.fillStyle = '#2a2b27'; for (const sd of [-1, 1]) { c.save(); c.translate(hx, hy); c.rotate(sd * 1.35); c.fillRect(R - 1.1, -0.9, 0.8, 1.8); c.restore(); }
  rr(c, hx + R * 0.66, hy - 1, 1.4, 2, 0.5); c.fillStyle = '#1b1c1a'; c.fill();
  c.fillStyle = 'rgba(255,250,230,0.28)'; ellipse(c, hx - R * 0.32, hy - R * 0.4, R * 0.34, R * 0.16, -0.6); c.fill();
}
// A wide-brimmed straw hat seen from above: woven brim, crown and a band.
function strawHat(c, hx, hy, R) {
  circle(c, hx + 0.6, hy + 1, R); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
  circle(c, hx, hy, R); c.fillStyle = radial(c, hx - R * 0.3, hy - R * 0.3, R * 1.3, '#ecd49a', '#a8864a', 0, 0); c.fill();
  c.strokeStyle = 'rgba(110,80,36,0.4)'; c.lineWidth = 0.3;
  for (let r2 = R * 0.62; r2 < R; r2 += 0.9) { circle(c, hx, hy, r2); c.stroke(); }
  for (let i = 0; i < 28; i++) { const q = (i / 28) * TAU; c.beginPath(); c.moveTo(hx + Math.cos(q) * R * 0.6, hy + Math.sin(q) * R * 0.6); c.lineTo(hx + Math.cos(q) * R, hy + Math.sin(q) * R); c.stroke(); }
  circle(c, hx, hy, R); c.strokeStyle = '#8a6a34'; c.lineWidth = 0.6; c.stroke();
  circle(c, hx, hy, R * 0.58); c.strokeStyle = '#4a2e1a'; c.lineWidth = 0.9; c.stroke();
  circle(c, hx, hy, R * 0.5); c.fillStyle = radial(c, hx - 1, hy - 1, R * 0.6, '#f2dca8', '#b8945a', 0, 0); c.fill();
  c.strokeStyle = 'rgba(110,80,36,0.45)'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(hx - R * 0.45, hy); c.lineTo(hx + R * 0.45, hy); c.stroke();
}
// A top-down trooper facing +x, about 22 by 17 units. From the ground up: boot heels, arms in
// camouflage sleeves to gloved hands on the weapon, a pack with a rolled sleeping mat, camouflage
// fatigues, a plate carrier with webbing, pouches and a radio whip, then the helmet.
// o.hands: the two grip points [[x, y], [x, y]]. o.back(c): drawn on his back (the flamethrower's
// tanks). o.pack: false for no pack. o.farmer: a straw hat, plaid shirt and overalls instead.
// o.carry: 'shell' (a mortar round in both hands) or 'binoculars'. o.seed varies skin and pattern.
function soldier(c, helmet = '#4d5a3a', body = '#56603f', o = {}) {
  if (helmet[0] !== '#') helmet = '#4d5a3a';
  if (body[0] !== '#') body = '#56603f';
  const seed = o.seed || 7, skin = SKINS[seed % SKINS.length], farmer = !!o.farmer;
  const glove = farmer ? skin : '#2c2b26', vest = farmer ? '#3d5a82' : tint(body, -0.14);
  const carry = o.carry;
  const hands = o.hands || (carry === 'shell' ? [[7, -1.7], [7, 1.7]] : carry === 'binoculars' ? [[5.6, -2], [5.6, 2]] : [[7.5, -1.4], [3.5, 1.6]]);
  // boot heels just showing behind him
  if (!farmer) for (const sd of [-1, 1]) { rr(c, -9.4, sd * 3 - 1.2, 2.6, 2.4, 1); c.fillStyle = '#2b2620'; c.fill(); }
  // pack: side pouches, body, top flap with buckles, and a rolled mat strapped across the top
  if (o.pack !== false && !farmer) {
    const pk = tint(body, -0.08);
    for (const sd of [-1, 1]) { rr(c, -10.2, sd * 5 - 1.2, 3.4, 2.4, 0.9); c.fillStyle = tint(pk, -0.22); c.fill(); }
    rr(c, -10.8, -4.6, 6, 9.2, 2); c.fillStyle = linear(c, -10.8, -4.6, -4.8, 4.6, [[0, tint(pk, 0.12)], [1, tint(pk, -0.4)]]); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.4; c.stroke();
    rr(c, -8.6, -4.1, 3.2, 8.2, 1.3); c.fillStyle = tint(pk, -0.16); c.fill();
    c.fillStyle = '#16170f'; for (const sd of [-1, 1]) c.fillRect(-8.2, sd * 2.2 - 0.4, 2.6, 0.8);
    c.fillStyle = '#8a8a7a'; for (const sd of [-1, 1]) c.fillRect(-7.6, sd * 2.2 - 0.5, 0.8, 1);
    rr(c, -12.4, -5, 2.5, 10, 1.25); c.fillStyle = linear(c, -12.4, 0, -9.9, 0, [[0, '#3a4030'], [0.5, '#6a7058'], [1, '#2e3226']]); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 0.3; for (const yy of [-3.4, -1.1, 1.1, 3.4]) { c.beginPath(); c.moveTo(-12.3, yy); c.lineTo(-10, yy + 0.4); c.stroke(); }
    c.strokeStyle = '#1e1f18'; c.lineWidth = 0.7; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(-11.2, sd * 3.2); c.lineTo(-9.9, sd * 3.4); c.stroke(); }
  }
  // shoulders and back seen from above: wide across, shallow front to back
  c.save(); ellipse(c, -2.4, 0, 4.9, 7.8); c.clip();
  c.fillStyle = radial(c, -4, -3, 10, tint(body, 0.2), tint(body, -0.38), 0, 0); c.fillRect(-8, -9, 12, 18);
  if (farmer) {
    c.strokeStyle = 'rgba(160,40,30,0.55)'; c.lineWidth = 0.8; for (let k = -9; k < 9; k += 2.4) { c.beginPath(); c.moveTo(-8, k); c.lineTo(4, k); c.stroke(); c.beginPath(); c.moveTo(-7 + k * 0.7, -9); c.lineTo(-7 + k * 0.7, 9); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 0.3; for (let k = -8; k < 9; k += 2.4) { c.beginPath(); c.moveTo(-8, k); c.lineTo(4, k); c.stroke(); }
  } else camo(c, body, seed + 11, -8, -9, 12, 18);
  c.restore();
  ellipse(c, -2.4, 0, 4.9, 7.8); c.strokeStyle = rgba(tint(body, -0.6), 0.5); c.lineWidth = 0.45; c.stroke();
  if (farmer) {
    // overall straps crossing on the back, the bib and its buttons
    rr(c, -6.2, -2.4, 3.6, 4.8, 0.8); c.fillStyle = vest; c.fill();
    c.strokeStyle = vest; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-4.4, -1.4); c.lineTo(-0.4, 5.4); c.moveTo(-4.4, 1.4); c.lineTo(-0.4, -5.4); c.stroke();
    c.fillStyle = '#d8c070'; for (const sd of [-1, 1]) { circle(c, -0.5, sd * 5.1, 0.5); c.fill(); }
  } else {
    // plate carrier: back panel with rows of webbing, a pouch and a radio, a drag handle at the neck
    rr(c, -6.4, -4.5, 6.6, 9, 1.8); c.fillStyle = linear(c, -6.4, -4.5, 0.2, 4.5, [[0, tint(vest, 0.14)], [1, tint(vest, -0.32)]]); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 0.4; c.stroke();
    c.strokeStyle = rgba(tint(vest, -0.5), 0.9); c.lineWidth = 0.4; c.setLineDash([1, 0.55]);
    for (let yy = -3.3; yy <= 3.4; yy += 1.32) { c.beginPath(); c.moveTo(-5.9, yy); c.lineTo(-0.4, yy); c.stroke(); }
    c.setLineDash([]);
    for (const sd of [-1, 1]) { rr(c, -0.8, sd * 3.6 - 1.2, 2.6, 2.4, 0.9); c.fillStyle = tint(vest, -0.05); c.fill(); }
    rr(c, -5.6, -4.3, 2.3, 2.2, 0.5); c.fillStyle = '#26282a'; c.fill();
    c.strokeStyle = 'rgba(30,31,27,0.75)'; c.lineWidth = 0.32; c.beginPath(); c.moveTo(-4.9, -4); c.quadraticCurveTo(-7.5, -5.6, -10.5, -5.9); c.stroke();
  }
  if (o.back) o.back(c);
  // arms over the shoulders: upper arm out to the elbow, forearm in to the hands
  [[-1, hands[0]], [1, hands[1]]].forEach(([sy, [hx, hy]], i) => {
    const sx = -1.8, syy = sy * 6, ex = (sx + hx) / 2 - 0.6, ey = (syy + hy) / 2 + sy * 1.5;
    limb(c, [[sx, syy], [ex, ey]], 3.2, body, seed + i);
    if (farmer) limb(c, [[ex, ey], [hx, hy]], 2.4, skin, seed + 5 + i);
    else {
      limb(c, [[ex, ey], [hx, hy]], 2.7, body, seed + 3 + i);
      const fx = hx - (hx - ex) * 0.24, fy = hy - (hy - ey) * 0.24; circle(c, fx, fy, 1.3); c.fillStyle = tint(body, -0.32); c.fill();
    }
    // a shoulder patch on the right arm
    if (!farmer && sy > 0) { c.save(); c.translate(sx + 0.6, syy + 0.2); c.rotate(Math.atan2(ey - syy, ex - sx)); c.fillStyle = tint(body, -0.25); c.fillRect(-0.2, -0.9, 1.8, 1.8); c.fillStyle = 'rgba(220,210,170,0.6)'; c.fillRect(0.3, -0.4, 0.8, 0.8); c.restore(); }
    hand(c, hx, hy, hx - ex, hy - ey, glove);
  });
  if (carry === 'shell') {
    c.save(); c.translate(7.4, 0);
    c.beginPath(); c.moveTo(4.6, 0); c.quadraticCurveTo(3, -2.1, -1.5, -1.6); c.lineTo(-1.5, 1.6); c.quadraticCurveTo(3, 2.1, 4.6, 0); c.fillStyle = linear(c, 0, -2, 0, 2, [[0, '#7c8270'], [1, '#33352e']]); c.fill();
    c.fillStyle = '#2a2c26'; c.fillRect(-3.6, -1, 2.2, 2); c.fillRect(-3.9, -1.7, 0.7, 3.4);
    c.fillStyle = '#c9b13a'; c.fillRect(1.2, -1.8, 0.8, 3.6); circle(c, 4.4, 0, 0.6); c.fillStyle = '#9aa0a6'; c.fill();
    c.restore();
    for (const sd of [-1, 1]) hand(c, 7, sd * 1.7, 1, -sd * 0.6, glove);
  } else if (carry === 'binoculars') {
    for (const sd of [-1, 1]) { rr(c, 4.6, sd * 1.2 - 1.05, 3.6, 2.1, 0.8); c.fillStyle = '#1f201d'; c.fill(); circle(c, 8.2, sd * 1.2, 0.75); c.fillStyle = 'rgba(140,190,220,0.8)'; c.fill(); }
    for (const sd of [-1, 1]) hand(c, 5.6, sd * 2, 1, 0, glove);
  }
  // neck, collar, head
  circle(c, 1, 0, 2.2); c.fillStyle = skin; c.fill();
  c.strokeStyle = tint(body, -0.25); c.lineWidth = 0.8; c.beginPath(); c.arc(0.9, 0, 2.4, Math.PI * 0.55, Math.PI * 1.45); c.stroke();
  if (farmer) strawHat(c, 1.2, 0, 6.4);
  else helmetTop(c, 1.6, 0, 4.6, helmet, seed + 3);
}
// A prone marksman along +x: legs apart behind him (one knee drawn up), boot soles to the sky,
// knee and elbow pads, a plate carrier on his back and his cheek down on the stock.
// ghillie: a suit of burlap strands and leaves over all of it.
function proneSoldier(c, helmet = '#6a7650', body = '#6d7a4c', ghillie = false, seed = 4) {
  if (helmet[0] !== '#') helmet = '#6a7650';
  if (body[0] !== '#') body = '#6d7a4c';
  const legs = [[[-10, -2.2], [-16, -3.6], [-22.5, -4.6]], [[-10, 2.2], [-14.5, 7.4], [-21, 7]]];
  legs.forEach((pts, i) => {
    const cloth = tint(body, -0.06);
    limb(c, [pts[1], pts[2]], 3, cloth, seed + 22 + i);
    limb(c, [pts[0], pts[1]], 3.9, cloth, seed + 20 + i);
    const [kx, ky] = pts[1], ka = Math.atan2(pts[2][1] - pts[0][1], pts[2][0] - pts[0][0]);
    ellipse(c, kx - 0.4, ky, 1.8, 1.45, ka); c.fillStyle = tint(body, -0.38); c.fill();
    c.strokeStyle = rgba(tint(body, -0.6), 0.6); c.lineWidth = 0.3; c.stroke();
    // the boot: upper, then the sole and heel facing up
    const [ax, ay] = pts[2], [qx, qy] = pts[1], ang = Math.atan2(ay - qy, ax - qx);
    c.save(); c.translate(ax, ay); c.rotate(ang);
    rr(c, -0.5, -1.9, 5, 3.8, 1.4); c.fillStyle = '#3a3228'; c.fill();
    rr(c, 1, -1.7, 3.8, 3.4, 1.2); c.fillStyle = '#1c1a17'; c.fill();
    c.strokeStyle = '#3a3630'; c.lineWidth = 0.35; for (const k of [1.8, 2.6, 3.4]) { c.beginPath(); c.moveTo(k, -1.4); c.lineTo(k, 1.4); c.stroke(); }
    c.fillStyle = '#2a2622'; c.fillRect(1, -1.5, 0.8, 3);
    c.restore();
  });
  // hips and back in camouflage
  c.save(); ellipse(c, -9.6, 0, 4.4, 4.8); ellipse(c, -3.6, 0, 8, 6.3); c.clip();
  c.beginPath(); c.fillStyle = radial(c, -5, -3, 11, tint(body, 0.2), tint(body, -0.35), 0, 0); c.fillRect(-15, -8, 21, 16);
  camo(c, body, seed + 9, -15, -7, 21, 14);
  c.restore();
  // arms: elbows planted, padded, hands on the rifle
  [[-1, [12, -0.6]], [1, [7, 1.4]]].forEach(([sy, [hx, hy]], i) => {
    const ex = 3.6, ey = sy * 7;
    limb(c, [[-1.5, sy * 5], [ex, ey]], 3.2, body, seed + i); limb(c, [[ex, ey], [hx, hy]], 2.7, body, seed + 3 + i);
    ellipse(c, ex, ey, 1.7, 1.35, sy * 0.6); c.fillStyle = tint(body, -0.38); c.fill();
    hand(c, hx, hy, hx - ex, hy - ey, '#2c2b26');
  });
  // plate carrier and a hydration pack
  rr(c, -9.4, -4.3, 9.6, 8.6, 2); c.fillStyle = linear(c, -9.4, -4.3, 0, 4.3, [[0, tint(body, -0.02)], [1, tint(body, -0.42)]]); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.4; c.stroke();
  c.strokeStyle = rgba(tint(body, -0.55), 0.9); c.lineWidth = 0.45; c.setLineDash([1.1, 0.6]);
  for (let yy = -3; yy <= 3.1; yy += 1.5) { c.beginPath(); c.moveTo(-8.8, yy); c.lineTo(-0.6, yy); c.stroke(); }
  c.setLineDash([]);
  rr(c, -7.6, -2, 4.6, 4, 1.6); c.fillStyle = tint(body, -0.12); c.fill();
  c.strokeStyle = '#1c1d18'; c.lineWidth = 0.7; c.beginPath(); c.arc(0.8, 0, 1.3, Math.PI * 0.6, Math.PI * 1.4); c.stroke();
  if (ghillie) {
    // burlap strands and scraps of leaf over the back, the legs and the hood
    const rng = mulberry32(seed + 31), cols = ['#5a6a34', '#7a7a44', '#4a5a2c', '#8a8452', '#6a5a38'];
    c.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const f = rng(), along = -22 + f * 30, half = along > -9 ? 6.2 : 5.5 + (along < -14 ? 2 : 0);
      const px = along, py = (rng() - 0.5) * 2 * half + (along < -12 ? (rng() < 0.5 ? -4 : 6) * 0.4 : 0), q = Math.PI + (rng() - 0.5) * 1.6, l = 1.6 + rng() * 2.6;
      c.strokeStyle = cols[i % cols.length]; c.lineWidth = 0.55 + rng() * 0.5;
      c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + Math.cos(q) * l * 0.5, py + Math.sin(q) * l * 0.5 + (rng() - 0.5), px + Math.cos(q) * l, py + Math.sin(q) * l); c.stroke();
    }
    for (let i = 0; i < 12; i++) { c.fillStyle = cols[(i + 2) % cols.length]; ellipse(c, -18 + rng() * 22, (rng() - 0.5) * 10, 1.1, 0.6, rng() * 3); c.fill(); }
  }
  helmetTop(c, 4.2, 0, 4.7, helmet, seed + 5);
  if (ghillie) {
    const rng = mulberry32(seed + 47);
    for (let i = 0; i < 26; i++) { const q = rng() * TAU, r0 = rng() * 3.5; c.strokeStyle = ['#5a6a34', '#7a7a44', '#4a5a2c', '#8a8452'][i % 4]; c.lineWidth = 0.5; c.beginPath(); c.moveTo(4.2 + Math.cos(q) * r0, Math.sin(q) * r0); c.lineTo(4.2 + Math.cos(q) * (r0 + 2.2) - 1, Math.sin(q) * (r0 + 2.2)); c.stroke(); }
  }
}
// small props used by the upgrade cosmetics
function crate(c, x, y, w, h, col = '#6b5330', stripe) {
  c.fillStyle = SHADOW; c.fillRect(x + 1.5, y + 2, w, h);
  c.fillStyle = linear(c, x, y, x + w, y + h, [[0, shade(col, 0.18)], [1, shade(col, -0.32)]]); c.fillRect(x, y, w, h);
  // planks, a cross brace and nail heads
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.5;
  for (let yy = y + h / 3; yy < y + h - 0.5; yy += h / 3) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); }
  c.strokeStyle = shade(col, -0.4); c.lineWidth = 0.9; c.beginPath(); c.moveTo(x + 0.8, y + 0.8); c.lineTo(x + w - 0.8, y + h - 0.8); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.8; c.strokeRect(x + 0.4, y + 0.4, w - 0.8, h - 0.8);
  c.strokeStyle = 'rgba(255,240,210,0.25)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x + 0.8, y + h - 0.8); c.lineTo(x + 0.8, y + 0.8); c.lineTo(x + w - 0.8, y + 0.8); c.stroke();
  if (stripe) { c.fillStyle = stripe; c.fillRect(x, y + h * 0.4, w, h * 0.2); }
}
function antenna(c, x, y, h, t, light = '#ff5a4a') {
  c.strokeStyle = '#2a2c28'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + h * 0.25, y - h); c.stroke();
  if (Math.sin(t * 4 + x) > 0) { circle(c, x + h * 0.25, y - h, 1.5); c.fillStyle = light; c.fill(); }
}
function flag(c, x, y, col, t) {
  c.strokeStyle = '#3a3226'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 16); c.stroke();
  const w = Math.sin(t * 5 + x) * 1.5;
  c.beginPath(); c.moveTo(x, y - 16); c.quadraticCurveTo(x + 5, y - 15 + w, x + 10, y - 14 + w); c.lineTo(x + 10, y - 9 + w); c.quadraticCurveTo(x + 5, y - 10 - w, x, y - 10); c.closePath();
  c.fillStyle = col; c.fill();
}
function canister(c, x, y, r, col) {
  circle(c, x + 1, y + 1.5, r); c.fillStyle = SHADOW; c.fill();
  circle(c, x, y, r); c.fillStyle = radial(c, x, y, r, shade(col, 0.35), shade(col, -0.35)); c.fill();
}
function ice(c, x, y, s, rot) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.35, 0); c.lineTo(0, s * 0.5); c.lineTo(-s * 0.35, 0); c.closePath();
  c.fillStyle = 'rgba(215,240,255,0.9)'; c.fill(); c.strokeStyle = 'rgba(120,180,220,0.8)'; c.lineWidth = 0.6; c.stroke();
  c.restore();
}

// ---------- the heater ----------
// Its centrepiece follows the highest path: a fire drum, a brick furnace or boiler house (Fuel),
// a geothermal wellhead (Fuel 5), an inferno stove (Burner 5) or a big bonfire (Comfort 5).
function heaterCore(tiers) {
  const [a, b, d] = tiers;
  return a >= 5 ? 'geo' : a >= 4 ? 'boiler' : a >= 3 ? 'furnace' : d >= 5 ? 'inferno' : b >= 5 ? 'bonfire' : 'drum';
}
function heaterBase(c, tiers, L) {
  const [a, b, d] = tiers, core = heaterCore(tiers), rng = mulberry32(17 + a * 7 + b * 31 + d * 53);
  // melted, trampled snow round the fire: wet dark earth near it, slush further out
  c.fillStyle = radial(c, 0, 0, 22, 'rgba(70,56,40,0.75)', 'rgba(150,160,170,0)', 0, 0); circle(c, 0, 0, 22); c.fill();
  c.fillStyle = 'rgba(46,34,24,0.55)'; circle(c, 0, 0, 12); c.fill();
  for (let i = 0; i < 9; i++) { const q = rng() * TAU, r = 10 + rng() * 9; c.fillStyle = 'rgba(230,238,246,0.35)'; ellipse(c, Math.cos(q) * r, Math.sin(q) * r, 2 + rng() * 2, 1 + rng(), q); c.fill(); }
  // Comfort: a bunk tent, then benches round the fire
  if (b >= 3) {
    c.save(); c.translate(-11, -12); c.rotate(-0.35);
    c.fillStyle = SHADOW; c.fillRect(-6.5 + 1.5, -5 + 2, 13, 10);
    c.fillStyle = linear(c, 0, -5, 0, 0, [[0, '#9a9a6a'], [1, '#7a7a52']]); c.fillRect(-6.5, -5, 13, 5);
    c.fillStyle = linear(c, 0, 0, 0, 5, [[0, '#5e5e3e'], [1, '#4a4a30']]); c.fillRect(-6.5, 0, 13, 5);
    c.fillStyle = '#3a3a26'; c.fillRect(-6.5, -0.4, 13, 0.8);
    c.strokeStyle = 'rgba(30,30,20,0.6)'; c.lineWidth = 0.4; c.strokeRect(-6.5, -5, 13, 10);
    c.strokeStyle = 'rgba(200,190,150,0.6)'; for (const [x0, y0, x1, y1] of [[-6.5, -5, -9, -8], [6.5, -5, 9, -8], [-6.5, 5, -9, 8], [6.5, 5, 9, 8]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    c.fillStyle = 'rgba(245,250,255,0.85)'; c.fillRect(-6.5, -5, 13, 1.2);
    c.restore();
  }
  if (b >= 4) for (const [bx, by, ang] of [[-13, 4, 0.2], [12, 6, -0.3]]) {
    c.save(); c.translate(bx, by); c.rotate(Math.PI / 2 + ang);
    c.fillStyle = SHADOW; c.fillRect(-6 + 1, -1.6 + 1.5, 12, 3.2);
    c.fillStyle = linear(c, 0, -1.6, 0, 1.6, [[0, '#9a7a52'], [1, '#5a4228']]); c.fillRect(-6, -1.6, 12, 3.2);
    c.fillStyle = '#c8a878'; ellipse(c, -6, 0, 0.8, 1.6, 0); c.fill(); ellipse(c, 6, 0, 0.8, 1.6, 0); c.fill();
    c.restore();
    // a soldier sitting on it, turned to the fire
    c.save(); c.translate(bx * 0.82, by * 0.82); c.rotate(Math.atan2(-by, -bx)); c.scale(0.85, 0.85);
    soldier(c, '#4d5a3a', '#56603f', { hands: [[6.8, -3.4], [6.8, 3.4]], seed: bx > 0 ? 2 : 9 });
    c.restore();
  }
  // Burner: a bed of coals, a ring of stones, more barrels, then a ring of gas jets
  if (d >= 1) for (let i = 0; i < 22; i++) { const q = (i / 22) * TAU + rng() * 0.2, r = 12 + rng() * 2.5; circle(c, Math.cos(q) * r, Math.sin(q) * r, 1 + rng() * 0.8); c.fillStyle = ['#3a1a10', '#8a2a10', '#c8501a'][Math.floor(rng() * 3)]; c.fill(); }
  if ((d >= 2 || core === 'bonfire') && (core === 'drum' || core === 'bonfire' || core === 'inferno')) {
    const R = core === 'bonfire' ? 13 : 11;
    for (let i = 0; i < 12; i++) {
      const q = (i / 12) * TAU, sx = Math.cos(q) * R, sy = Math.sin(q) * R, sr = 2 + rng() * 0.8;
      c.fillStyle = SHADOW; circle(c, sx + 0.8, sy + 1, sr); c.fill();
      c.fillStyle = radial(c, sx - sr * 0.3, sy - sr * 0.3, sr * 1.3, '#a8a49a', '#4e4a44', 0, 0); circle(c, sx, sy, sr); c.fill();
    }
  }
  if (d >= 3) for (const [bx, by] of [[-14, 12], [14, -12]]) { fireDrum(c, bx, by, 4.6); }
  if (d >= 4) for (let i = 0; i < 8; i++) {
    const q = (i / 8) * TAU, nx = Math.cos(q) * 17, ny = Math.sin(q) * 17;
    circle(c, nx, ny, 1.9); c.fillStyle = '#2a2a28'; c.fill(); circle(c, nx, ny, 1.2); c.fillStyle = '#7a7c78'; c.fill(); circle(c, nx, ny, 0.6); c.fillStyle = '#141414'; c.fill();
  }
  if (d >= 4) { c.strokeStyle = 'rgba(30,30,28,0.8)'; c.lineWidth = 0.7; circle(c, 0, 0, 17); c.stroke(); }
  // Fuel: a propane tank and its hose, then insulated ducts running out across the snow
  if (a >= 2 && core !== 'geo') for (const q of [-0.6, 2.1, 3.7]) {
    c.save(); c.rotate(q);
    c.fillStyle = SHADOW; c.fillRect(6, -1.4 + 1, 16, 3);
    c.fillStyle = linear(c, 0, -1.6, 0, 1.6, [[0, '#e0e2e4'], [0.5, '#a8acb0'], [1, '#6a6e72']]); c.fillRect(6, -1.6, 16, 3.2);
    c.fillStyle = 'rgba(40,44,48,0.35)'; for (let k = 7; k < 22; k += 1.3) c.fillRect(k, -1.6, 0.4, 3.2);
    c.fillStyle = '#5a5e62'; c.fillRect(21, -2, 1.5, 4);
    c.restore();
  }
  if (a >= 1 && core !== 'geo') {
    c.strokeStyle = '#1a1a18'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(11, 8); c.quadraticCurveTo(7, 3, 3, 3); c.stroke();
    c.fillStyle = SHADOW; c.beginPath(); c.roundRect(9.5 + 1, 5 + 1.5, 7, 11, 3.5); c.fill();
    c.fillStyle = linear(c, 9.5, 0, 16.5, 0, [[0, '#f2f2ee'], [0.5, '#d0d0ca'], [1, '#8a8a84']]); c.beginPath(); c.roundRect(9.5, 5, 7, 11, 3.5); c.fill();
    c.fillStyle = '#c8402e'; c.fillRect(11.5, 5.2, 3, 1.4); c.fillStyle = '#3a3a38'; c.fillRect(12.4, 4, 1.2, 1.6);
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(10.6, 7, 0.8, 7);
  }
  // Comfort: coffee on a grate, then a cooking pot
  if (b >= 1) {
    c.fillStyle = '#2a2826'; c.fillRect(7, -14, 7, 5);
    c.strokeStyle = '#5a5854'; c.lineWidth = 0.4; for (let k = 7.5; k < 14; k += 1.2) { c.beginPath(); c.moveTo(k, -14); c.lineTo(k, -9); c.stroke(); }
    c.fillStyle = radial(c, 9.8, -12, 2, '#6a6e72', '#2a2c2e', 0, 0); circle(c, 10, -11.6, 1.9); c.fill();
    for (const [mx, my] of [[15.5, -12], [16, -9.4]]) { circle(c, mx, my, 1.1); c.fillStyle = '#ece6d6'; c.fill(); circle(c, mx, my, 0.65); c.fillStyle = '#3a2214'; c.fill(); }
  }
  if (b >= 2) {
    c.strokeStyle = '#2a2826'; c.lineWidth = 0.8;
    for (const q of [0.4, 2.5, 4.6]) { c.beginPath(); c.moveTo(-12 + Math.cos(q) * 5, -1 + Math.sin(q) * 5); c.lineTo(-12, -1); c.stroke(); }
    c.fillStyle = SHADOW; circle(c, -11, 0, 4); c.fill();
    c.fillStyle = radial(c, -13, -2, 5, '#5a5c5e', '#1e2022', 0, 0); circle(c, -12, -1, 3.8); c.fill();
    c.fillStyle = '#6a4a2a'; circle(c, -12, -1, 2.6); c.fill(); c.fillStyle = 'rgba(255,230,180,0.35)'; circle(c, -12.8, -1.8, 1); c.fill();
  }
  // the firewood pile
  if (core !== 'geo' && core !== 'boiler') {
    c.save(); c.translate(-9, 13); c.rotate(-0.2);
    for (let i = 0; i < 4; i++) {
      const y0 = -3 + i * 1.8, l = 9 - (i % 2) * 1.5;
      c.fillStyle = linear(c, 0, y0 - 0.9, 0, y0 + 0.9, [[0, '#8a6a46'], [1, '#4a3420']]); c.beginPath(); c.roundRect(-l / 2, y0 - 0.9, l, 1.8, 0.9); c.fill();
      c.fillStyle = '#c8a878'; ellipse(c, l / 2, y0, 0.5, 0.9, 0); c.fill();
    }
    c.fillStyle = 'rgba(245,250,255,0.85)'; c.fillRect(-4.5, -4.2, 9, 0.9);
    c.restore();
  }
  // the centrepiece
  if (core === 'drum') fireDrum(c, 0, 0, 7.5);
  else if (core === 'bonfire') {
    for (let i = 0; i < 9; i++) {
      const q = (i / 9) * TAU + 0.2;
      c.save(); c.rotate(q);
      c.fillStyle = linear(c, 0, -1.2, 0, 1.2, [[0, '#7a5a38'], [1, '#2e2016']]); c.beginPath(); c.roundRect(1, -1.2, 10, 2.4, 1.2); c.fill();
      c.fillStyle = '#1a120c'; c.fillRect(1, -1.2, 3, 2.4);
      c.restore();
    }
    c.fillStyle = radial(c, 0, 0, 7, '#ffd890', '#a0300c', 0, 0); circle(c, 0, 0, 6); c.fill();
  } else if (core === 'inferno') {
    octagon(c, 11, 1.5, 2); c.fillStyle = SHADOW; c.fill();
    octagon(c, 11); c.fillStyle = radial(c, -3, -3, 15, '#5a5c5e', '#1a1c1e', 0, 0); c.fill();
    c.strokeStyle = '#0e0f10'; c.lineWidth = 0.8; c.stroke();
    for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU + Math.PI / 8; c.save(); c.rotate(q); c.fillStyle = '#ff7a20'; c.fillRect(6.5, -1.2, 3, 0.6); c.fillRect(6.5, 0.6, 3, 0.6); c.restore(); }
    circle(c, 0, 0, 6); c.fillStyle = radial(c, 0, 0, 6, '#fff0b0', '#d0400c', 0, 0); c.fill();
  } else if (core === 'furnace' || core === 'boiler') {
    const w = core === 'boiler' ? 22 : 17, h = core === 'boiler' ? 18 : 14;
    c.fillStyle = SHADOW; c.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
    c.fillStyle = '#5a2e22'; c.fillRect(-w / 2, -h / 2, w, h);
    for (let y = -h / 2, row = 0; y < h / 2; y += 2, row++) for (let x = -w / 2 + (row % 2 ? 1.6 : 0); x < w / 2; x += 3.2) {
      c.fillStyle = shade(['#9a4a34', '#8a3e2a', '#a85a3e'][(((row + Math.round(x)) % 3) + 3) % 3], (rng() - 0.5) * 0.15); c.fillRect(x + 0.15, y + 0.15, Math.min(3, w / 2 - x) - 0.3, 1.7);
    }
    c.fillStyle = linear(c, -w / 2, -h / 2, w / 2, h / 2, [[0, 'rgba(255,240,220,0.18)'], [1, 'rgba(0,0,0,0.3)']]); c.fillRect(-w / 2, -h / 2, w, h);
    c.strokeStyle = 'rgba(20,10,6,0.7)'; c.lineWidth = 0.7; c.strokeRect(-w / 2, -h / 2, w, h);
    c.fillStyle = 'rgba(245,250,255,0.8)'; c.fillRect(-w / 2, -h / 2, w, 1.4);
    // the iron firebox door on the front
    c.fillStyle = '#1c1a18'; c.fillRect(-4, h / 2 - 5.5, 8, 5.5);
    // the chimney
    const cx2 = core === 'boiler' ? 6 : 4, cy2 = -3;
    circle(c, cx2 + 1, cy2 + 1.5, core === 'boiler' ? 3.8 : 3); c.fillStyle = SHADOW; c.fill();
    circle(c, cx2, cy2, core === 'boiler' ? 3.8 : 3); c.fillStyle = radial(c, cx2 - 1, cy2 - 1, 4, '#8a8c88', '#3a3c38', 0, 0); c.fill();
    circle(c, cx2, cy2, core === 'boiler' ? 2.2 : 1.7); c.fillStyle = '#0c0c0c'; c.fill();
    if (core === 'boiler') {
      // pressure gauge and the steam pipes leaving it
      circle(c, -6, -3, 2.4); c.fillStyle = '#e8e2d0'; c.fill(); c.strokeStyle = '#2a2826'; c.lineWidth = 0.5; c.stroke();
      c.beginPath(); c.moveTo(-6, -3); c.lineTo(-4.8, -4.4); c.strokeStyle = '#c8402e'; c.stroke();
      for (const [px, py, ex, ey] of [[w / 2, 2, 22, 6], [-w / 2, 4, -22, 8], [0, -h / 2, -4, -22]]) {
        c.strokeStyle = '#3a3c3e'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(px, py); c.lineTo(ex, ey); c.stroke();
        c.strokeStyle = '#9a9ea2'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(px, py); c.lineTo(ex, ey); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(px, py - 0.6); c.lineTo(ex, ey - 0.6); c.stroke();
      }
    }
  } else if (core === 'geo') {
    // a concrete pad, a steel derrick and the wellhead, with pipes running off it
    c.fillStyle = SHADOW; c.fillRect(-14 + 2, -14 + 3, 28, 28);
    c.fillStyle = linear(c, -14, -14, 14, 14, [[0, '#b0aea6'], [1, '#6a6862']]); c.fillRect(-14, -14, 28, 28);
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.4; for (let k = -14; k < 14; k += 7) { c.beginPath(); c.moveTo(k, -14); c.lineTo(k, 14); c.stroke(); c.beginPath(); c.moveTo(-14, k); c.lineTo(14, k); c.stroke(); }
    for (const [px, py, ex, ey] of [[0, 0, 24, 4], [0, 0, -24, -6], [0, 0, 6, 24]]) { c.strokeStyle = '#7a4a2a'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(px, py); c.lineTo(ex, ey); c.stroke(); c.strokeStyle = '#c8a070'; c.lineWidth = 1; c.beginPath(); c.moveTo(px, py - 0.8); c.lineTo(ex, ey - 0.8); c.stroke(); }
    c.strokeStyle = '#d0a020'; c.lineWidth = 1.4;
    c.strokeRect(-9, -9, 18, 18);
    c.beginPath(); c.moveTo(-9, -9); c.lineTo(0, 0); c.lineTo(9, -9); c.moveTo(-9, 9); c.lineTo(0, 0); c.lineTo(9, 9); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.4; c.strokeRect(-9.6, -9.6, 19.2, 19.2);
    circle(c, 0, 0, 5); c.fillStyle = radial(c, -1.5, -1.5, 6, '#8a8c88', '#2a2c28', 0, 0); c.fill();
    circle(c, 0, 0, 2.6); c.fillStyle = radial(c, 0, 0, 2.6, '#fff0b0', '#e0501a', 0, 0); c.fill();
    for (const [vx, vy] of [[-4, 4], [4, 4]]) { c.fillStyle = '#c8402e'; circle(c, vx, vy, 1); c.fill(); }
  }
  if (L.n >= 1) { c.strokeStyle = rgba(L.col, 0.5); c.lineWidth = 1; circle(c, 0, 0, 20); c.stroke(); }
}
// a steel oil drum burning wood, seen from above
function fireDrum(c, x, y, r) {
  circle(c, x + 1.2, y + 1.8, r); c.fillStyle = SHADOW; c.fill();
  circle(c, x, y, r); c.fillStyle = radial(c, x - r * 0.3, y - r * 0.3, r * 1.3, '#8a8e90', '#2e3032', 0, 0); c.fill();
  c.strokeStyle = 'rgba(120,60,24,0.6)'; c.lineWidth = r * 0.15; circle(c, x, y, r * 0.86); c.stroke();
  circle(c, x, y, r * 0.78); c.fillStyle = '#140c08'; c.fill();
  circle(c, x, y, r * 0.62); c.fillStyle = radial(c, x, y, r * 0.62, '#ffc060', '#7a1e08', 0, 0); c.fill();
  c.strokeStyle = '#1a1210'; c.lineWidth = r * 0.12; for (const o of [-0.3, 0, 0.3]) { c.beginPath(); c.moveTo(x - r * 0.6, y + o * r); c.lineTo(x + r * 0.6, y + o * r); c.stroke(); }
}
// one live flame: three layered tongues licking upwards, flickering
function flameTongue(c, x, y, s, t, seed) {
  for (const [col, k] of [['rgba(190,40,12,0.8)', 1], ['rgba(255,128,30,0.9)', 0.72], ['rgba(255,226,140,0.95)', 0.42]]) {
    const fl = Math.sin(t * 13 + seed) * 0.14 + Math.sin(t * 7.7 + seed * 2) * 0.1, sway = Math.sin(t * 5 + seed) * s * k * 1.4;
    const h = s * k * (7 + fl * 7), w = s * k * 2.8;
    c.fillStyle = col; c.beginPath(); c.moveTo(x - w, y);
    c.quadraticCurveTo(x - w * 0.9, y - h * 0.55, x + sway, y - h); c.quadraticCurveTo(x + w * 0.9, y - h * 0.55, x + w, y);
    c.quadraticCurveTo(x, y + w * 0.8, x - w, y); c.fill();
  }
}
function heaterFire(c, x, y, s, t, seed, lights, wx, wy) {
  c.save(); c.globalCompositeOperation = 'lighter';
  c.fillStyle = radial(c, x, y, 14 * s, `rgba(255,150,60,${0.4 + Math.sin(t * 9 + seed) * 0.08})`, 'rgba(255,120,40,0)', 0, 0); circle(c, x, y, 14 * s); c.fill();
  c.restore();
  for (let i = 0; i < 3; i++) flameTongue(c, x + (i - 1) * 2.2 * s, y + Math.abs(i - 1) * 0.8 * s, s * (i === 1 ? 1 : 0.7), t, seed + i * 1.7);
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.8 + i / 4 + seed * 0.1) % 1;
    circle(c, x + Math.sin(seed + i * 2.1 + t * 2) * 4 * s, y - k * 18 * s, 0.6 * s * (1 - k) + 0.2); c.fillStyle = `rgba(255,${180 - k * 100},60,${1 - k})`; c.fill();
  }
  if (lights) lights.push({ x: wx, y: wy, r: 38 * s, color: '255,160,80', a: 0.75 });
}
function heaterLive(c, tw, tiers, t, lights, wx, wy) {
  const [a, b, d] = tiers, core = heaterCore(tiers), seed = (wx * 0.37 + wy * 0.11) % 10;
  if (core === 'drum') heaterFire(c, 0, 0, 1, t, seed, lights, wx, wy);
  else if (core === 'bonfire') heaterFire(c, 0, 0, 1.8, t, seed, lights, wx, wy);
  else if (core === 'inferno') { heaterFire(c, 0, 0, 1.5, t, seed, lights, wx, wy); }
  else if (core === 'furnace' || core === 'boiler') {
    // firelight flickering through the door, smoke from the chimney
    const h = core === 'boiler' ? 18 : 14, fl = 0.75 + Math.sin(t * 11 + seed) * 0.15 + Math.sin(t * 17 + seed) * 0.1;
    c.fillStyle = `rgba(255,${150 + fl * 60},60,${fl})`; c.fillRect(-3.4, h / 2 - 5, 6.8, 4.6);
    c.fillStyle = '#1c1a18'; for (let k = -2.6; k < 3.4; k += 1.6) c.fillRect(k, h / 2 - 5, 0.5, 4.6);
    const cx2 = core === 'boiler' ? 6 : 4;
    for (let i = 0; i < 5; i++) { const k = (t * 0.35 + i / 5) % 1; circle(c, cx2 + k * 6 + Math.sin(t + i) * 1.5, -3 - k * 22, 2 + k * 5); c.fillStyle = `rgba(90,88,86,${(1 - k) * 0.5})`; c.fill(); }
    if (lights) lights.push({ x: wx, y: wy + h / 2, r: 34, color: '255,150,70', a: 0.6 * fl });
  } else if (core === 'geo') {
    // steam boiling off the wellhead, lit orange from below
    for (let i = 0; i < 7; i++) { const k = (t * 0.3 + i / 7) % 1; circle(c, Math.sin(t * 0.8 + i * 2) * 3 + k * 5, -k * 26, 3 + k * 8); c.fillStyle = `rgba(235,240,245,${(1 - k) * 0.45})`; c.fill(); }
    if (lights) lights.push({ x: wx, y: wy, r: 46, color: '255,170,90', a: 0.7 });
  }
  if (d >= 3) for (const [bx, by] of [[-14, 12], [14, -12]]) heaterFire(c, bx, by, 0.6, t, seed + bx, null, wx, wy);
  if (d >= 4) for (let i = 0; i < 8; i++) {
    // gas jets roaring blue at the root, orange at the tip
    const q = (i / 8) * TAU, nx = Math.cos(q) * 17, ny = Math.sin(q) * 17, fl = 0.8 + Math.sin(t * 15 + i * 2) * 0.2;
    c.fillStyle = `rgba(110,170,255,${0.8 * fl})`; ellipse(c, nx, ny - 1.2, 1, 2 * fl, 0); c.fill();
    flameTongue(c, nx, ny - 2, 0.45 * fl, t, i * 3);
  }
  if (b >= 2) for (let i = 0; i < 3; i++) { const k = (t * 0.45 + i / 3) % 1; circle(c, -12 + Math.sin(t * 2 + i) * 1.2, -2 - k * 10, 1 + k * 2.5); c.fillStyle = `rgba(240,240,240,${(1 - k) * 0.5})`; c.fill(); }
  if (b >= 1) { const k = (t * 0.6) % 1; circle(c, 10, -12 - k * 6, 0.6 + k * 1.4); c.fillStyle = `rgba(240,240,240,${(1 - k) * 0.4})`; c.fill(); }
}

// The tower's best path shows as chevrons in its colour; tier 5 earns a star.
// The farm, drawn in a 38-unit square, each upgrade in its own place so nothing piles up:
// the crop field on the right (rows, an irrigation ditch, a greenhouse, an orchard, then golden
// wheat and a silo), and down the left the homestead corner (well, watchtower, field hospital),
// the market corner (root cellar, market stall, bank) and the barn. A post-and-rail fence goes
// round it all, or a stone wall for a Safe Haven.
function farmBase(c, tiers, L) {
  const [a, b, d] = tiers, rng = mulberry32(17 + a * 7 + b * 3 + d);
  // the yard: packed earth with a little grass
  c.fillStyle = linear(c, -19, -19, 19, 19, [[0, paint('#9c8458', L, 0.15)], [1, paint('#6e5838', L, 0.15)]]); c.fillRect(-19, -19, 38, 38);
  for (let i = 0; i < 60; i++) { const px = -18 + rng() * 36, py = -18 + rng() * 36; c.fillStyle = rng() < 0.5 ? 'rgba(60,44,24,0.25)' : 'rgba(210,190,140,0.2)'; circle(c, px, py, 0.3 + rng() * 0.6); c.fill(); }
  c.strokeStyle = 'rgba(90,120,50,0.7)'; c.lineWidth = 0.5;
  for (let i = 0; i < 40; i++) { const side = i % 4, f = rng() * 36 - 18, px = side < 2 ? f : (side === 2 ? -17.6 : 17.6), py = side < 2 ? (side ? 17.6 : -17.6) : f; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(px, py); c.lineTo(px + k * 0.7, py - 1.2); c.stroke(); } }

  // ---- the field ----
  const FX0 = -2.5, FX1 = 17, FY0 = -17, FY1 = 17;
  const orchard = a >= 4, glass = a >= 3, wheat = a >= 5;
  c.fillStyle = SHADOW; c.fillRect(FX0 + 0.6, FY0 + 0.8, FX1 - FX0, FY1 - FY0);
  c.fillStyle = linear(c, FX0, FY0, FX1, FY1, [[0, '#6a4a2c'], [1, '#432e1a']]); c.fillRect(FX0, FY0, FX1 - FX0, FY1 - FY0);
  const rowsN = 5, rowW = (FX1 - FX0 - 1) / rowsN;
  const rowTop = glass ? -3 : FY0 + 1, crop = paint(a >= 2 ? '#6e9e36' : '#5c8a2e', L, 0.2);
  for (let r = 0; r < rowsN; r++) {
    const x = FX0 + 0.5 + rowW * (r + 0.5);
    const bottom = orchard && x > 7 ? 0.5 : FY1 - 1;
    // the furrow either side and the lit ridge
    c.strokeStyle = 'rgba(25,14,6,0.6)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x + rowW / 2, rowTop - 0.6); c.lineTo(x + rowW / 2, bottom + 0.6); c.stroke();
    c.strokeStyle = 'rgba(160,120,80,0.35)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x - 0.6, rowTop - 0.6); c.lineTo(x - 0.6, bottom + 0.6); c.stroke();
    for (let y = rowTop + 0.8; y < bottom; y += wheat ? 1.4 : 2.9) {
      if (wheat) {
        // a dense band of ripe wheat: stalks leaning with the wind, a golden head on each
        for (let k = 0; k < 3; k++) { const wx = x - 1 + k + (rng() - 0.5) * 0.4; c.strokeStyle = k % 2 ? '#b8902e' : '#d8b048'; c.lineWidth = 0.45; c.beginPath(); c.moveTo(wx, y + 0.6); c.lineTo(wx + 0.5, y - 0.6); c.stroke(); ellipse(c, wx + 0.55, y - 0.75, 0.3, 0.55, 0.4); c.fillStyle = '#f0cc62'; c.fill(); }
      } else {
        const pr = (a >= 1 ? 1.35 : 1.05) * (0.85 + rng() * 0.3), rot = rng() * TAU;
        circle(c, x + 0.4, y + 0.4, pr); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
        for (let lf = 0; lf < 5; lf++) { const q = rot + (lf / 5) * TAU; ellipse(c, x + Math.cos(q) * pr * 0.5, y + Math.sin(q) * pr * 0.5, pr * 0.62, pr * 0.32, q); c.fillStyle = tint(crop, lf % 2 ? -0.22 : 0.06); c.fill(); }
        circle(c, x - pr * 0.15, y - pr * 0.2, pr * 0.28); c.fillStyle = tint(crop, 0.35); c.fill();
      }
    }
  }
  // irrigation: a water ditch down the field's edge with a sluice gate
  if (a >= 2) {
    c.fillStyle = '#3a2a18'; c.fillRect(FX0 - 0.2, FY0, 1.9, FY1 - FY0);
    c.fillStyle = linear(c, FX0, 0, FX0 + 1.5, 0, [[0, '#3f7f9a'], [1, '#2a5a70']]); c.fillRect(FX0 + 0.1, FY0 + 0.3, 1.3, FY1 - FY0 - 0.6);
    c.fillStyle = 'rgba(220,245,255,0.55)'; for (let y = FY0 + 2; y < FY1; y += 4.5) c.fillRect(FX0 + 0.35, y, 0.35, 1.6);
    c.fillStyle = '#6a4a2a'; c.fillRect(FX0 - 0.5, FY1 - 3, 2.5, 0.9);
  }
  // greenhouse over the top of the field: a glass roof on a white frame, plants showing through
  if (glass) {
    const gx0 = FX0 + 1.8, gx1 = FX1 - 0.4, gy0 = FY0 + 0.4, gy1 = -4.2, mid = (gy0 + gy1) / 2;
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(gx0 + 1, gy0 + 1.4, gx1 - gx0, gy1 - gy0);
    c.fillStyle = '#4a6a3a'; c.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
    for (let i = 0; i < 26; i++) { circle(c, gx0 + 1 + rng() * (gx1 - gx0 - 2), gy0 + 1 + rng() * (gy1 - gy0 - 2), 0.8 + rng() * 0.6); c.fillStyle = rng() < 0.5 ? '#7aae46' : '#5a8a34'; c.fill(); }
    c.fillStyle = linear(c, 0, gy0, 0, mid, [[0, 'rgba(235,248,252,0.78)'], [1, 'rgba(190,220,232,0.55)']]); c.fillRect(gx0, gy0, gx1 - gx0, mid - gy0);
    c.fillStyle = linear(c, 0, mid, 0, gy1, [[0, 'rgba(150,185,200,0.5)'], [1, 'rgba(110,145,165,0.62)']]); c.fillRect(gx0, mid, gx1 - gx0, gy1 - mid);
    c.strokeStyle = 'rgba(250,252,250,0.9)'; c.lineWidth = 0.45;
    for (let x = gx0 + 2.2; x < gx1 - 0.5; x += 2.2) { c.beginPath(); c.moveTo(x, gy0); c.lineTo(x, gy1); c.stroke(); }
    c.lineWidth = 0.9; c.strokeRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
    c.beginPath(); c.moveTo(gx0, mid); c.lineTo(gx1, mid); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(gx0 + 1, gy0 + 0.8, 3.5, 1);
    c.fillStyle = '#d8dcd8'; c.fillRect(gx0 + (gx1 - gx0) / 2 - 1.2, gy1 - 0.3, 2.4, 1);
  }
  // orchard in the bottom corner of the field: grass under fruit trees in a row
  if (orchard) {
    c.fillStyle = '#58783a'; c.fillRect(7.6, 1.4, FX1 - 7.6, FY1 - 1.4);
    for (const [tx, ty] of [[10.4, 4.6], [14.6, 6.8], [10.6, 10.6], [14.4, 13.6]]) {
      canopy(c, tx, ty, 2.9, '#2f5a22', '#6a9a42', mulberry32(tx * 7 + ty), 5);
      for (let k = 0; k < 4; k++) { circle(c, tx - 1.5 + rng() * 3, ty - 1.5 + rng() * 3, 0.42); c.fillStyle = wheat ? '#f0a83a' : '#d8402a'; c.fill(); }
    }
  }

  // ---- homestead corner (top left): well, then a watchtower, then a field hospital ----
  if (d >= 1) {
    const [wx, wy] = d >= 3 ? [-6.5, -8.2] : [-10.5, -11];
    circle(c, wx + 0.6, wy + 0.9, 2.9); c.fillStyle = SHADOW; c.fill();
    for (let i = 0; i < 10; i++) { const q = (i / 10) * TAU; circle(c, wx + Math.cos(q) * 2.3, wy + Math.sin(q) * 2.3, 0.85); c.fillStyle = i % 2 ? '#8a8a82' : '#a8a69c'; c.fill(); }
    circle(c, wx, wy, 1.6); c.fillStyle = radial(c, wx, wy, 1.6, '#0c1a20', '#2a4a58', 0, 0); c.fill();
    c.fillStyle = 'rgba(200,230,240,0.5)'; circle(c, wx - 0.5, wy - 0.5, 0.4); c.fill();
    c.fillStyle = '#6a4a2a'; c.fillRect(wx - 3, wy - 0.35, 6, 0.7);
    c.fillStyle = '#5a4a3a'; c.fillRect(wx + 1.9, wy + 0.5, 1.2, 1.2);
  }
  if (d >= 3) {
    // a wooden watchtower: tall, so a long shadow, a plank deck, corner posts, a railing and a ladder
    const tx = -13.5, ty = -13.5, h = 3.8;
    c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(tx - h + 2.4, ty - h + 3.4, h * 2, h * 2);
    c.fillStyle = '#5a3e22'; c.fillRect(tx - 0.7, ty + h, 1.4, 4.2);
    c.fillStyle = '#8a6a3e'; for (let k = 0; k < 4; k++) c.fillRect(tx - 1.1, ty + h + 0.6 + k, 2.2, 0.35);
    c.fillStyle = linear(c, tx - h, ty - h, tx + h, ty + h, [[0, '#b08a58'], [1, '#7a5a34']]); c.fillRect(tx - h, ty - h, h * 2, h * 2);
    c.strokeStyle = 'rgba(60,40,20,0.5)'; c.lineWidth = 0.3; for (let k = -h + 1.2; k < h; k += 1.2) { c.beginPath(); c.moveTo(tx - h, ty + k); c.lineTo(tx + h, ty + k); c.stroke(); }
    c.strokeStyle = '#4e3620'; c.lineWidth = 0.7; c.strokeRect(tx - h + 0.35, ty - h + 0.35, h * 2 - 0.7, h * 2 - 0.7);
    c.fillStyle = '#3e2a16'; for (const [px, py] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.fillRect(tx + px * (h - 0.5) - 0.6, ty + py * (h - 0.5) - 0.6, 1.2, 1.2);
  }
  if (d >= 4) {
    // field hospital: a white ridge tent with a red cross on the roof
    const hx = -6.6, hy = -15, w = 5.6, hh = 3.6;
    c.fillStyle = 'rgba(0,0,0,0.32)'; c.fillRect(hx - w / 2 + 0.7, hy - hh / 2 + 1, w, hh);
    c.fillStyle = '#f2efe6'; c.fillRect(hx - w / 2, hy - hh / 2, w, hh / 2);
    c.fillStyle = '#c9c4b6'; c.fillRect(hx - w / 2, hy, w, hh / 2);
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.35; c.strokeRect(hx - w / 2, hy - hh / 2, w, hh);
    c.fillStyle = '#c9302a'; c.fillRect(hx - 0.4, hy - 1.4, 0.8, 2.8); c.fillRect(hx - 1.4, hy - 0.4, 2.8, 0.8);
  }

  // ---- market corner (middle left): root cellar, market stall, bank ----
  if (b >= 1 && b < 4) {
    // root cellar: a grassy mound with two wooden doors
    ellipse(c, -12.6, -0.6, 4, 3.3); c.fillStyle = SHADOW; c.fill();
    ellipse(c, -13.2, -1.2, 4, 3.3); c.fillStyle = radial(c, -14, -2, 5, '#7a9a4a', '#4a6a2a', 0, 0); c.fill();
    c.fillStyle = '#5a3e22'; c.fillRect(-13.2, -2.6, 3.4, 2.8); c.strokeStyle = '#3a2814'; c.lineWidth = 0.35; c.strokeRect(-13.2, -2.6, 3.4, 2.8); c.beginPath(); c.moveTo(-11.5, -2.6); c.lineTo(-11.5, 0.2); c.stroke();
  }
  if (b >= 4) {
    // the bank: a stone building with a hipped slate roof, columns along the front and a sign
    const x0 = -17, y0 = -5, w = 9, h = 7.6;
    c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(x0 + 1, y0 + 1.4, w, h);
    c.fillStyle = '#c8c2b0'; c.fillRect(x0, y0, w, h);
    c.fillStyle = paint('#6a7078', L, 0.25); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + w, y0); c.lineTo(x0 + w - 2.4, y0 + 2.4); c.lineTo(x0 + 2.4, y0 + 2.4); c.closePath(); c.fill();
    c.fillStyle = paint('#4e545c', L, 0.25); c.beginPath(); c.moveTo(x0, y0 + h); c.lineTo(x0 + w, y0 + h); c.lineTo(x0 + w - 2.4, y0 + h - 2.4); c.lineTo(x0 + 2.4, y0 + h - 2.4); c.closePath(); c.fill();
    c.fillStyle = paint('#5a6068', L, 0.25); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + 2.4, y0 + 2.4); c.lineTo(x0 + 2.4, y0 + h - 2.4); c.lineTo(x0, y0 + h); c.closePath(); c.fill();
    c.fillStyle = paint('#7a8088', L, 0.25); c.beginPath(); c.moveTo(x0 + w, y0); c.lineTo(x0 + w - 2.4, y0 + 2.4); c.lineTo(x0 + w - 2.4, y0 + h - 2.4); c.lineTo(x0 + w, y0 + h); c.closePath(); c.fill();
    c.fillStyle = paint('#8a9098', L, 0.25); c.fillRect(x0 + 2.4, y0 + 2.4, w - 4.8, h - 4.8);
    c.fillStyle = '#ece6d6'; for (let k = 0; k < 4; k++) { circle(c, x0 + w + 0.7, y0 + 1.2 + k * 1.75, 0.5); c.fill(); }
    c.fillStyle = b >= 5 ? '#e3b83e' : '#2f5d3a'; c.fillRect(x0 + w / 2 - 1.3, y0 + h / 2 - 0.8, 2.6, 1.6);
    c.fillStyle = b >= 5 ? '#6a4a10' : '#d8e8c8'; c.font = '700 1.5px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', x0 + w / 2, y0 + h / 2 + 0.1);
    if (b >= 5) { c.strokeStyle = '#e3b83e'; c.lineWidth = 0.5; c.strokeRect(x0 + 0.25, y0 + 0.25, w - 0.5, h - 0.5); }
  }
  if (b >= 2) {
    // market stall: a table of produce under a striped awning
    const sx = -7.4, sy = -1.4;
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(sx - 2.2, sy - 2.4, 5.4, 6);
    c.fillStyle = '#7a5a34'; c.fillRect(sx - 2.6, sy - 2.8, 5.2, 5.6);
    const produce = ['#d8402a', '#e88a2a', '#7aae3a', '#e8c43a'];
    for (let k = 0; k < 8; k++) { circle(c, sx - 1.6 + (k % 2) * 1.6 + 0.3, sy - 1.9 + Math.floor(k / 2) * 1.3, 0.55); c.fillStyle = produce[Math.floor(k / 2)]; c.fill(); }
    for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#ece6d6' : '#c9483d'; c.fillRect(sx + 0.6, sy - 3 + k * 1.5, 2.4, 1.5); }
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(sx + 0.6, sy - 3, 0.4, 6);
  }

  // ---- the barn (bottom left), and a silo or hay bales beside it ----
  {
    const x0 = -17, y0 = 5, w = 10, h = 11.5, ridge = x0 + w / 2;
    const metal = b >= 3, rf = paint(metal ? '#a8aeb0' : '#a8402e', L, 0.2);
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(x0 + 1.2, y0 + 1.6, w, h);
    c.fillStyle = linear(c, x0, 0, ridge, 0, [[0, tint(rf, 0.12)], [1, tint(rf, 0.28)]]); c.fillRect(x0, y0, w / 2, h);
    c.fillStyle = linear(c, ridge, 0, x0 + w, 0, [[0, tint(rf, -0.18)], [1, tint(rf, -0.38)]]); c.fillRect(ridge, y0, w / 2, h);
    c.strokeStyle = metal ? 'rgba(60,64,66,0.45)' : 'rgba(60,20,12,0.4)'; c.lineWidth = 0.3;
    if (metal) for (let x = x0 + 0.8; x < x0 + w; x += 0.9) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + h); c.stroke(); }
    else for (let y = y0 + 1; y < y0 + h; y += 1.1) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + w, y); c.stroke(); }
    c.fillStyle = tint(rf, -0.5); c.fillRect(ridge - 0.35, y0, 0.7, h);
    c.strokeStyle = '#ece6d6'; c.lineWidth = 0.5; c.strokeRect(x0 + 0.25, y0 + 0.25, w - 0.5, h - 0.5);
    // a cupola on the ridge, with a gold weathervane for War Bonds
    c.fillStyle = '#ece6d6'; c.fillRect(ridge - 1.2, y0 + h / 2 - 1.2, 2.4, 2.4); c.fillStyle = tint(rf, -0.25); c.fillRect(ridge - 0.9, y0 + h / 2 - 0.9, 1.8, 1.8);
    if (b >= 5) { c.strokeStyle = '#e3b83e'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(ridge - 2, y0 + h / 2); c.lineTo(ridge + 2, y0 + h / 2); c.stroke(); circle(c, ridge, y0 + h / 2, 0.6); c.fillStyle = '#f0c858'; c.fill(); }
    if (wheat) {
      const cx = -4.6, cy = 12.2;
      circle(c, cx + 1, cy + 1.4, 2.8); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill();
      circle(c, cx, cy, 2.8); c.fillStyle = radial(c, cx - 1, cy - 1, 3.4, '#e6eaec', '#8a9298', 0, 0); c.fill();
      c.strokeStyle = 'rgba(70,80,86,0.5)'; c.lineWidth = 0.3; for (const r2 of [1, 1.9]) { circle(c, cx, cy, r2); c.stroke(); }
      circle(c, cx, cy, 0.5); c.fillStyle = '#6a7278'; c.fill();
    } else if (a >= 1) {
      for (const [hx, hy] of [[-4.8, 9.6], [-4.8, 13.4]]) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(hx - 1.3, hy - 1, 3, 2.6); rr(c, hx - 1.6, hy - 1.4, 3, 2.6, 0.5); c.fillStyle = '#d8b860'; c.fill(); c.strokeStyle = 'rgba(120,90,30,0.6)'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(hx - 1.6, hy - 0.5); c.lineTo(hx + 1.4, hy - 0.5); c.moveTo(hx - 1.6, hy + 0.5); c.lineTo(hx + 1.4, hy + 0.5); c.stroke(); }
    }
  }

  // ---- fence, or a stone wall for the Safe Haven ----
  if (d >= 5) {
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-19 + 0.8, -19 + 1, 38, 2.4); c.fillRect(-19 + 0.8, -19 + 1, 2.4, 38);
    for (const [x, y, w, h] of [[-19, -19, 38, 2.2], [-19, 16.8, 38, 2.2], [-19, -19, 2.2, 38], [16.8, -19, 2.2, 38]]) {
      c.fillStyle = '#9a968a'; c.fillRect(x, y, w, h);
      c.strokeStyle = 'rgba(50,48,42,0.5)'; c.lineWidth = 0.25;
      if (w > h) for (let k = x; k < x + w; k += 2) { c.beginPath(); c.moveTo(k, y); c.lineTo(k, y + h); c.stroke(); }
      else for (let k = y; k < y + h; k += 2) { c.beginPath(); c.moveTo(x, k); c.lineTo(x + w, k); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x, y, w, 0.5);
    }
    for (const [px, py] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.fillStyle = '#7a766c'; c.fillRect(px * 17.6 - 2, py * 17.6 - 2, 4, 4); c.fillStyle = '#b4b0a4'; c.fillRect(px * 17.6 - 1.4, py * 17.6 - 1.4, 2.8, 2.8); }
  } else {
    const wood = paint('#9a7a4c', L, 0.35);
    for (const off of [-0.5, 0.5]) { c.strokeStyle = off < 0 ? tint(wood, 0.2) : tint(wood, -0.25); c.lineWidth = 0.45; c.strokeRect(-18.4 + off, -18.4 + off, 36.8 - off * 2, 36.8 - off * 2); }
    for (let i = 0; i <= 8; i++) {
      const f = -18.4 + i * 4.6;
      for (const [px, py] of [[f, -18.4], [f, 18.4], [-18.4, f], [18.4, f]]) {
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(px - 0.5, py - 0.3, 1.4, 1.4);
        c.fillStyle = tint(wood, -0.3); c.fillRect(px - 0.7, py - 0.7, 1.4, 1.4);
        c.fillStyle = L.n >= 3 ? L.col : tint(wood, 0.15); c.fillRect(px - 0.4, py - 0.4, 0.8, 0.8);
      }
    }
  }
}
function tierMarks(c, tiers, x, y) {
  let best = 0, bp = 0;
  tiers.forEach((n, p) => { if (n > best) { best = n; bp = p; } });
  if (!best) return;
  const col = PATH_COLORS[bp];
  if (best === 5) {
    star(c, x, y - 2, 6, 2.6); c.fillStyle = 'rgba(0,0,0,0.6)'; c.fill();
    star(c, x, y - 2.5, 5, 2.1); c.fillStyle = col; c.fill();
    return;
  }
  for (let i = 0; i < best; i++) {
    const yy = y - i * 3.5;
    c.beginPath(); c.moveTo(x - 4.5, yy + 2); c.lineTo(x, yy - 1); c.lineTo(x + 4.5, yy + 2);
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3; c.stroke();
    c.strokeStyle = col; c.lineWidth = 1.6; c.stroke();
  }
}

// Draws a tower. For aircraft, (x, y) is the pad and tw.ax/ay is where the aircraft is.
// Every upgrade path changes the look: [a, b, d] are the tiers of paths 1, 2 and 3.
function drawTowerRaw(c, tw, t, lights, opts = {}) {
  const { type } = tw;
  const tiers = tw.tiers || [0, 0, 0];
  const [a, b, d] = tiers;
  const x = tw.x, y = tw.y;
  const ang = tw.angle;
  const kick = (tw.recoil || 0) * 3;
  const top = Math.max(a, b, d);
  c.save();
  if (opts.alpha != null) c.globalAlpha = opts.alpha;
  // opts.part draws one layer: 'base' is everything before the turret turns, 'turret' the rest.
  // Both passes run all the code (the other layer is drawn invisibly) so lights and state match.
  const part = opts.part, A0 = c.globalAlpha;
  const turn = () => { c.rotate(ang); c.globalAlpha = part === 'base' ? 0 : A0; };
  c.translate(x, y);
  const L = towerLook(tw);
  if (top === 5 && (!part || part === 'under')) {
    const col = hexRgb(L.col).join(',');
    c.fillStyle = radial(c, 0, 0, 34, `rgba(${col},${0.32 + Math.sin(t * 3 + x) * 0.1})`, `rgba(${col},0)`, 0, 0);
    circle(c, 0, 0, 34); c.fill();
  }
  if (!part || part === 'under') upgradePlinth(c, L, t, type, lights, x, y);
  if (part === 'under') { c.restore(); return; }
  if (part === 'turret') c.globalAlpha = 0;
  const sz = type === 'farm' ? Math.min(1.08, LOOK_SCALE[L.n]) : LOOK_SCALE[L.n];
  c.scale(sz, sz);
  // crews keep mostly natural colours; upgrade colour shows on the gear around them
  const helmet = (base = '#4d5a3a') => paint(base, L, 0.3), uniform = (base = '#56603f') => paint(base, L, 0.12);
  if (part === 'over') {
    // the sniper's laser sight, drawn over everything
    if (type === 'sniper' && a >= 4 && tw.recoil < 0.5 && !opts.icon) {
      const len = 24 + Math.min(4, a) * 2.2 + (b >= 4 ? 3 : 0) + (a >= 5 ? 6 : 0);
      c.rotate(ang); c.strokeStyle = 'rgba(255,60,50,0.35)'; c.lineWidth = 0.8;
      for (const o of b >= 5 ? [-6, 6] : [0]) { c.beginPath(); c.moveTo(len + 4, o); c.lineTo(len + 70, o); c.stroke(); }
    }
    if (type === 'heater') heaterLive(c, tw, tiers, t, lights, x, y);
  } else switch (type) {
    case 'gunner': {
      // Energy turns it into a laser, Heavy into a walking mech, Spread into a gun bunker.
      const ray = a >= 5, mech = b >= 5, bunker = d >= 4;
      if (ray) {
        circle(c, 3, 4, 19); c.fillStyle = SHADOW; c.fill();
        circle(c, 0, 0, 19); c.fillStyle = radial(c, 0, 0, 19, paint('#9aa3a6', L, 0.5), paint('#3e4548', L, 0.5)); c.fill();
        c.strokeStyle = 'rgba(120,255,110,0.55)'; c.lineWidth = 1.5; circle(c, 0, 0, 15); c.stroke();
        c.fillStyle = '#2a2f31';
        for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU; circle(c, Math.cos(q) * 17, Math.sin(q) * 17, 1.2); c.fill(); }
      } else if (bunker) {
        const R = d >= 5 ? 21 : 17;
        c.beginPath(); for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU + Math.PI / 8; c.lineTo(Math.cos(q) * R + 3, Math.sin(q) * R + 4); } c.closePath(); c.fillStyle = SHADOW; c.fill();
        // a poured-concrete pillbox: chamfered walls, form lines, chipped edges and a camo net
        const oct = (r) => { c.beginPath(); for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU + Math.PI / 8; c.lineTo(Math.cos(q) * r, Math.sin(q) * r); } c.closePath(); };
        oct(R); c.fillStyle = linear(c, -R, -R, R, R, [[0, paint('#b4b0a4', L, 0.22)], [1, paint('#5e5b52', L, 0.22)]]); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.9; c.stroke();
        oct(R - 3.5); c.fillStyle = linear(c, -R, -R, R, R, [[0, paint('#a29e92', L, 0.22)], [1, paint('#77736a', L, 0.22)]]); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 0.6; c.stroke();
        c.save(); oct(R); c.clip();
        c.strokeStyle = 'rgba(0,0,0,0.14)'; c.lineWidth = 0.5; for (let yy = -R; yy < R; yy += 3) { c.beginPath(); c.moveTo(-R, yy); c.lineTo(R, yy + 0.6); c.stroke(); }
        const crng = mulberry32(31); c.fillStyle = 'rgba(30,28,24,0.35)'; for (let i = 0; i < 14; i++) { const q = crng() * TAU, rr2 = R * (0.75 + crng() * 0.25); circle(c, Math.cos(q) * rr2, Math.sin(q) * rr2, 0.5 + crng() * 0.9); c.fill(); }
        c.fillStyle = 'rgba(70,84,48,0.55)'; for (let i = 0; i < 9; i++) { const q = crng() * TAU, rr2 = R * crng() * 0.8; ellipse(c, Math.cos(q) * rr2, Math.sin(q) * rr2, 2.5 + crng() * 3, 1.5 + crng() * 2, crng() * 3); c.fill(); }
        c.restore();
        if (d >= 5) { for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU + Math.PI / 8, lx = Math.cos(q) * (R - 1.8), ly = Math.sin(q) * (R - 1.8); circle(c, lx, ly, 1.3); c.fillStyle = Math.sin(t * 5 + i) > 0 ? '#ff5a4a' : '#6a2018'; c.fill(); } }
      } else if (mech) {
        for (const s of [-1, 1]) {
          ellipse(c, 2, s * 13 + 3, 8, 4.5); c.fillStyle = SHADOW; c.fill();
          rr(c, -7, s * 13 - 4, 14, 8, 2); c.fillStyle = linear(c, 0, s * 13 - 4, 0, s * 13 + 4, [[0, paint('#7a8084', L, 0.25)], [1, paint('#33383b', L, 0.25)]]); c.fill(); c.fillStyle = '#1a1c1d'; for (let k2 = -6; k2 < 7; k2 += 2.4) c.fillRect(k2, s * 13 - 4, 1, 8);
          c.fillStyle = '#d8a02a'; for (let k = 0; k < 3; k++) c.fillRect(-5 + k * 4, s * 13 + (s > 0 ? 2.5 : -3.5), 2, 1);
        }
      } else {
        if (d >= 1) sandbags(c, 19, 16, L);
        sandbags(c, 15, 12, L);
      }
      if (!ray && !mech && !bunker) {
        if (b >= 1) crate(c, 9, -16, 8, 6, b >= 2 ? '#2a2c28' : '#4b4a2c', b >= 2 ? '#c9483d' : '#b89a4a');
        if (b >= 3) crate(c, 9, 9, 8, 6, '#4b4a2c', '#d8702a');
        if (a >= 3) { canister(c, -13, 11, 3.6, '#a83a2e'); }
      }
      turn();
      if (ray) {
        // the Doom Ray: a huge emitter on a turret ring
        c.fillStyle = paint('#2f3436', L, 0.6); rr(c, -12, -9, 22, 18, 4); c.fill();
        c.fillStyle = linear(c, 0, -5, 0, 5, [[0, '#8a9296'], [1, '#3a4043']]); c.fillRect(4 - kick, -5, 26, 10);
        for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#c79a2e' : '#7d5a1e'; c.fillRect(8 + k * 5 - kick, -6.5, 2.5, 13); }
        c.beginPath(); c.moveTo(30 - kick, -6); c.lineTo(38 - kick, 0); c.lineTo(30 - kick, 6); c.closePath();
        c.fillStyle = '#9bff8a'; c.fill();
        c.save(); c.translate(-8, 0); soldier(c, helmet('#2a3a2a'), uniform('#3e4a3a'), { seed: 3 }); c.restore();
        if (lights) lights.push({ x: x + Math.cos(ang) * 34, y: y + Math.sin(ang) * 34, r: 34, color: '120,255,110', a: 0.7 });
      } else if (mech) {
        // Siege Mech: armored body, cockpit and twin rocket pods
        c.fillStyle = SHADOW; rr(c, -10, -10, 22, 22, 5); c.fill();
        c.fillStyle = linear(c, -11, -11, 11, 11, [[0, paint('#8a9094', L, 0.3)], [1, paint('#3a3f42', L, 0.3)]]); rr(c, -11, -11, 21, 22, 5); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 0.5; for (const px of [-5, 3]) { c.beginPath(); c.moveTo(px, -10); c.lineTo(px, 10); c.stroke(); }
        c.fillStyle = '#d8a02a'; for (let k2 = 0; k2 < 4; k2++) { c.save(); c.translate(-10, -9 + k2 * 5); c.rotate(-0.6); c.fillRect(0, 0, 4, 1.5); c.restore(); }
        for (const s of [-1, 1]) {
          c.fillStyle = linear(c, 0, s * 12 - 5, 0, s * 12 + 5, [[0, paint('#5a6064', L, 0.2)], [1, paint('#25292c', L, 0.2)]]); rr(c, -6, s * 12 - 5, 16, 10, 2); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.5; c.stroke();
          c.fillStyle = '#d8702a'; c.fillRect(-6, s * 12 - 5, 2, 10);
          c.fillStyle = '#0e1011'; for (const [hx, hy] of [[8, -2.3], [8, 2.3], [4.5, -2.3], [4.5, 2.3]]) { circle(c, hx, s * 12 + hy, 1.5); c.fill(); }
        }
        for (const o of [-3.5, 3.5]) { c.fillStyle = '#1d1f1c'; c.fillRect(8 - kick, o - 1.5, 16, 3); }
        circle(c, -2, 0, 6.5); c.fillStyle = 'rgba(110,160,180,0.85)'; c.fill();
        circle(c, -3, 0, 3.6); c.fillStyle = '#4d5a3a'; c.fill();
      } else if (bunker) {
        // guns poke out of every side of the bunker
        const n = d >= 5 ? 8 : 4, R = d >= 5 ? 21 : 17;
        for (let i = 0; i < n; i++) {
          const q = (i / n) * TAU;
          c.save(); c.rotate(q);
          c.fillStyle = '#1d1f1c'; c.fillRect(R - 6 - (i === 0 ? kick : 0), -1.6, 11, 3.2);
          if (d >= 5) { c.fillRect(R - 6, -4.2, 9, 2); c.fillRect(R - 6, 2.2, 9, 2); }
          c.restore();
        }
        // the armoured cupola: a domed steel turret ring with a hatch and a vision block
        circle(c, 0, 0, R * 0.58); c.fillStyle = '#26282a'; c.fill();
        circle(c, 0, 0, R * 0.52); c.fillStyle = radial(c, 0, 0, R * 0.52, paint('#9a988e', L, 0.25), paint('#3e3d38', L, 0.25)); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 0; i < 10; i++) { const q = i / 10 * TAU; circle(c, Math.cos(q) * R * 0.45, Math.sin(q) * R * 0.45, 0.45); c.fill(); }
        circle(c, -R * 0.12, 0, R * 0.22); c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 0.7; c.stroke();
        c.fillStyle = '#1d1f1c'; c.fillRect(-2, -2.5, R * 0.55 + 4, 5); c.fillStyle = 'rgba(140,200,220,0.7)'; c.fillRect(R * 0.25, -1.2, 1.6, 2.4);
        c.fillStyle = 'rgba(255,255,240,0.35)'; ellipse(c, -R * 0.2, -R * 0.25, R * 0.22, R * 0.08, -0.6); c.fill();
        if (d >= 5) { flag(c, -4, -2, '#c9483d', t); }
      } else {
        const plasma = a >= 4, laser = a >= 3, buck = d >= 3;
        const n = 1 + (b >= 5 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const o = (i - (n - 1) / 2) * 4;
          if (plasma) {
            c.fillStyle = '#23272a'; c.fillRect(0 - kick, o - 3.5, 24, 7);
            for (const s of [-1, 1]) { rr(c, 2, o + s * 5 - 2, 12, 4, 2); c.fillStyle = '#5fb8ff'; c.fill(); }
            circle(c, 24 - kick, o, 3); c.fillStyle = '#bfe6ff'; c.fill();
            if (lights) lights.push({ x: x + Math.cos(ang) * 24, y: y + Math.sin(ang) * 24, r: 20, color: '120,200,255', a: 0.6 });
          } else if (laser) {
            c.fillStyle = linear(c, 0, o - 3, 0, o + 3, [[0, '#d8503e'], [1, '#7a1e16']]); c.fillRect(1 - kick, o - 3, 20, 6);
            c.fillStyle = '#ffffff'; c.fillRect(1 - kick, o - 3, 20, 1);
            circle(c, 21 - kick, o, 2.6); c.fillStyle = '#ff9a8a'; c.fill();
            if (lights) lights.push({ x: x + Math.cos(ang) * 21, y: y + Math.sin(ang) * 21, r: 16, color: '255,80,60', a: 0.5 });
          } else if (buck) {
            for (const s of [-2.2, 0, 2.2]) { c.fillStyle = '#1d1f1c'; c.fillRect(2 - kick, o + s - 1, 14, 2); }
            c.fillStyle = '#5a4630'; c.fillRect(-2 - kick, o - 3.5, 6, 7);
          } else {
            c.fillStyle = '#1d1f1c'; c.fillRect(2 - kick, o - 1.3, 18, 2.6);
            if (a >= 1) { c.fillStyle = a >= 2 ? '#e0e0d4' : '#86b356'; for (let k = 0; k < 3; k++) c.fillRect(8 + k * 4 - kick, o - 1.8, 1.4, 3.6); }
            c.fillStyle = paint('#2e312c', L, 1); c.fillRect(-1 - kick, o - 2.5, 8, 5);
          }
          if (b >= 1 && !plasma) { c.fillStyle = b >= 2 ? '#d0703a' : '#b89a4a'; for (let k = 0; k < 4; k++) c.fillRect(1 - k * 1.6 - kick, o + 2.6 + k * 0.6, 1.2, 2.2); }
        }
        if (b >= 3) { // shoulder rocket pods
          const big = b >= 4;
          for (const s of [-1, 1]) {
            c.fillStyle = paint('#3a3f36', L, 0.7); rr(c, -7, s * 8 - (big ? 4 : 3), big ? 12 : 9, big ? 8 : 6, 1.5); c.fill();
            c.fillStyle = '#0e1011'; for (let k = 0; k < (big ? 3 : 2); k++) { circle(c, (big ? 3 : 1) - k * 3, s * 8, 1.2); c.fill(); }
          }
        }
        if (d >= 2 && !buck) { c.strokeStyle = '#2a2c28'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(4, 0); c.lineTo(-4, -6); c.moveTo(4, 0); c.lineTo(-4, 6); c.stroke(); }
        soldier(c, helmet(laser ? '#2a2c30' : '#4d5a3a'), uniform(laser ? '#3a3e44' : '#56603f'), { seed: 7 });
        if (laser) { c.fillStyle = plasma ? '#7dd8ff' : '#ff6a5a'; c.fillRect(4, -2.5, 2, 5); }
      }
      break;
    }
    case 'sniper': {
      c.fillStyle = SHADOW; c.fillRect(-15, -13, 32, 32);
      c.fillStyle = linear(c, -16, -16, 16, 16, [[0, paint('#7a6448', L, 0.45)], [1, paint('#4a3a28', L, 0.45)]]); c.fillRect(-16, -16, 32, 32);
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1;
      for (let i = -12; i <= 12; i += 6) { c.beginPath(); c.moveTo(-16, i); c.lineTo(16, i); c.stroke(); }
      if (d >= 3) crate(c, -15, 7, 9, 7, '#3a5530', '#d8b23a');
      if (d >= 4) { crate(c, 7, 8, 8, 7, '#6b5330'); crate(c, 8, 3, 7, 5, '#5e4a2c'); }
      if (d >= 5) { antenna(c, -12, -12, 16, t); c.fillStyle = 'rgba(70,80,50,0.55)'; c.fillRect(-16, -16, 32, 6); }
      turn();
      const shooters = b >= 5 ? [-6, 6] : [0];
      for (const o of shooters) {
        c.save(); c.translate(0, o);
        const len = 24 + Math.min(4, a) * 2.2 + (b >= 4 ? 3 : 0) + (a >= 5 ? 6 : 0);
        if (a >= 5) { // railgun: twin rails with a charge glowing between them
          c.fillStyle = '#2a3036'; c.fillRect(2 - kick, -4, 10, 8);
          c.fillStyle = '#3c454c'; c.fillRect(6 - kick, -3, len, 1.6); c.fillRect(6 - kick, 1.4, len, 1.6);
          c.fillStyle = `rgba(150,210,255,${0.55 + Math.sin(t * 9) * 0.25})`; c.fillRect(8 - kick, -1.4, len - 4, 2.8);
          if (lights) lights.push({ x: x + Math.cos(ang) * 20, y: y + Math.sin(ang) * 20, r: 22, color: '150,210,255', a: 0.5 });
        } else { c.fillStyle = '#141614'; c.fillRect(4 - kick, a >= 3 ? -1.4 : -1, len, a >= 3 ? 2.8 : 2); }
        if (a >= 3 && a < 5) { c.fillStyle = '#2a2d28'; c.fillRect(len + 1 - kick, -2, 4, 4); c.strokeStyle = '#1a1c18'; c.lineWidth = 1; c.beginPath(); c.moveTo(14, 0); c.lineTo(18, -5); c.moveTo(14, 0); c.lineTo(18, 5); c.stroke(); }
        if (b >= 4 && a < 5) { c.fillStyle = '#262826'; rr(c, len - 2 - kick, -2.2, 8, 4.4, 1.5); c.fill(); }
        if (b >= 4) { circle(c, 11, 4.5, 3.4); c.fillStyle = '#22241f'; c.fill(); circle(c, 11, 4.5, 1.4); c.fillStyle = '#3a3c36'; c.fill(); }
        else if (b >= 2) { c.fillStyle = '#22241f'; c.fillRect(8, 1.5, 4, 4); }
        c.fillStyle = paint('#2a2d28', L, 0.8); c.fillRect(6, -2.4, 8, 4.8);
        const scope = d >= 1 ? 13 : 9;
        c.fillStyle = '#1b1d1a'; c.fillRect(5, -1.2 - 2.6, scope, 2.4);
        if (d >= 2) { circle(c, 5 + scope, -2.6, 1.4); c.fillStyle = '#7dff8a'; c.fill(); if (lights) lights.push({ x: x + Math.cos(ang) * 18, y: y + Math.sin(ang) * 18, r: 10, color: '120,255,140', a: 0.4 }); }
        if (a >= 4 && tw.recoil < 0.5 && !opts.icon && !part) { c.strokeStyle = 'rgba(255,60,50,0.35)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(len + 4, 0); c.lineTo(len + 70, 0); c.stroke(); }
        proneSoldier(c, helmet(a >= 5 ? '#4c4c44' : '#6a7650'), uniform('#5d6a40'), d >= 3, o > 0 ? 9 : 4);
        c.restore();
      }
      break;
    }
    case 'mortar': {
      sandbags(c, 16, 13, L);
      if (a >= 1) for (let i = 0; i < Math.min(4, a + 1); i++) {
        // mortar rounds lined up: teardrop shells with tail fins and a fuze tip
        c.save(); c.translate(-14 + i * 4, 13);
        c.fillStyle = 'rgba(0,0,0,0.35)'; ellipse(c, 0.8, 1, 1.9, 4.6); c.fill();
        c.beginPath(); c.moveTo(0, -4.5); c.quadraticCurveTo(2.2, -2.5, 1.6, 1.5); c.lineTo(-1.6, 1.5); c.quadraticCurveTo(-2.2, -2.5, 0, -4.5); c.fillStyle = linear(c, -2, 0, 2, 0, [[0, '#6a6e5c'], [1, '#2e302a']]); c.fill();
        c.fillStyle = '#2a2c26'; c.fillRect(-1.3, 1.5, 2.6, 2.5); c.fillRect(-2, 3.2, 4, 0.9);
        c.fillStyle = a >= 4 ? '#d8702a' : a >= 3 ? '#c9b13a' : '#9aa0a6'; circle(c, 0, -4.2, 0.9); c.fill();
        if (a >= 3) { c.fillStyle = a >= 4 ? '#d8702a' : '#c9b13a'; c.fillRect(-1.7, -1.6, 3.4, 0.9); }
        c.restore();
      }
      if (d >= 1) { c.strokeStyle = '#2a2c28'; c.lineWidth = 1; c.beginPath(); c.moveTo(12, -12); c.lineTo(15, -6); c.moveTo(12, -12); c.lineTo(9, -6); c.stroke(); c.fillStyle = '#1e201c'; c.fillRect(10, -15, 5, 3); }
      if (d >= 3) crate(c, 10, 6, 8, 6, '#4b4a2c', '#9aa0a6');
      if (d >= 4) { crate(c, -19, -6, 7, 9, '#4c5538'); antenna(c, -16, -6, 16, t); }
      turn();
      const tubes = d >= 5 ? [[0, 0]] : b >= 5 ? [[-3, -5], [-3, 5], [5, -5], [5, 5]] : b >= 3 ? [[1, -5], [1, 5]] : [[0, 0]];
      if (d >= 5) { // Long Tom field gun
        c.fillStyle = paint('#2b2d2a', L, 0.7); rr(c, -8, -7, 16, 14, 2); c.fill();
        c.fillStyle = paint('#3c3f3a', L, 0.9); c.fillRect(2 - kick, -2.5, 28, 5);
        c.fillStyle = '#222420'; c.fillRect(27 - kick, -3.5, 5, 7);
      } else {
        for (const [tx, ty] of tubes) {
          const R = a >= 5 ? 6.5 : tubes.length > 2 ? 4.2 : 5, tc = paint(d >= 2 ? '#5a646e' : '#41463f', L, 0.9);
          // baseplate, bipod legs, then the tube seen nearly end-on: barrel, muzzle ring and the dark bore
          c.beginPath(); for (let i = 0; i < 6; i++) { const q = i / 6 * TAU; c.lineTo(tx - 2 + Math.cos(q) * (R + 2), ty + Math.sin(q) * (R + 2)); } c.closePath();
          c.fillStyle = linear(c, tx - R, ty - R, tx + R, ty + R, [[0, paint('#55584f', L, 0.6)], [1, paint('#2a2c28', L, 0.6)]]); c.fill();
          c.strokeStyle = '#1d1f1c'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(tx + 3, ty); c.lineTo(tx + 8, ty - R - 1); c.moveTo(tx + 3, ty); c.lineTo(tx + 8, ty + R + 1); c.stroke();
          const mx = tx + 3 - kick * 0.5;
          c.fillStyle = linear(c, tx - 2, ty - R * 0.7, tx - 2, ty + R * 0.7, [[0, shade(tc, 0.25)], [1, shade(tc, -0.4)]]); rr(c, tx - 3, ty - R * 0.62, mx - tx + 3, R * 1.24, R * 0.6); c.fill();
          circle(c, mx, ty, R); c.fillStyle = radial(c, mx, ty, R, shade(tc, 0.35), shade(tc, -0.45)); c.fill();
          circle(c, mx, ty, R * 0.78); c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.6; c.stroke();
          circle(c, mx, ty, R * 0.6); c.fillStyle = radial(c, mx, ty, R * 0.6, '#000000', '#2a2c28', 0.25, 0.25); c.fill();
          if (tw.recoil > 0.3) { circle(c, mx, ty, R * 0.5); c.fillStyle = `rgba(255,190,90,${tw.recoil * 0.7})`; c.fill(); }
          c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.6; c.beginPath(); c.arc(mx, ty, R * 0.92, Math.PI * 1.1, Math.PI * 1.6); c.stroke();
        }
      }
      // the crew turn to the tube: a gunner laying it, a loader with a round ready, a spotter
      c.save(); c.translate(-9, -11); c.rotate(0.88); soldier(c, helmet(), uniform(), { hands: [[8.6, -1.6], [8.2, 2]], seed: 1 }); c.restore();
      if (b >= 2) { c.save(); c.translate(-9, 11); c.rotate(-0.88); soldier(c, helmet(), uniform(), { carry: 'shell', seed: 4 }); c.restore(); }
      if (b >= 5) { c.save(); c.translate(-15, 0); soldier(c, helmet('#5a5a3a'), uniform(), { carry: 'binoculars', seed: 2 }); c.restore(); }
      c.fillStyle = '#5a4428'; c.fillRect(8, 9, 6, 5);
      break;
    }
    case 'cryo': {
      pad(c, 36, paint(d >= 5 ? '#b9d4e2' : '#8f918b', L, 0.32), paint(d >= 5 ? '#6f90a4' : '#5a5c57', L, 0.32));
      if (a >= 1) for (let i = 0; i < a * 2; i++) { const q = (i / (a * 2)) * TAU + 0.4; ice(c, Math.cos(q) * 18, Math.sin(q) * 18, 3 + a * 0.6, q + Math.PI / 2); }
      if (d >= 2) for (const [vx, vy] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) {
        circle(c, vx, vy, 2.4); c.fillStyle = '#2f3a42'; c.fill();
        if (!opts.icon) { const k = (t * 0.8 + vx * 0.01 + vy * 0.02) % 1; circle(c, vx, vy - k * 6, 2 + k * 4); c.fillStyle = `rgba(230,245,255,${0.35 * (1 - k)})`; c.fill(); }
      }
      if (d >= 3) { c.save(); c.translate(-12, 12); c.rotate(t * 1.5); c.fillStyle = '#9aa6ae'; ellipse(c, 0, 0, 5, 2); c.fill(); c.restore(); }
      turn();
      const n = 1 + (b >= 5 ? 2 : 0), len = 16 + (d >= 1 ? 4 : 0);
      const steel = paint('#55626e', L, 0.9);
      // coolant tanks: frosted cylinders banded in hazard blue, with gauges and hoses to the gun
      const cw = b >= 1 ? 15 : 13, ch = b >= 1 ? 8 : 7;
      const tanks = b >= 4 ? [-8.5, 0, 8.5] : [-7, 7];
      for (const s of tanks) {
        rr(c, -13, s - ch / 2, cw, ch, ch / 2); c.fillStyle = linear(c, 0, s - ch / 2, 0, s + ch / 2, [[0, paint('#f2f8fb', L, 0.45)], [0.45, paint('#c2d6e2', L, 0.55)], [1, paint('#6f8a9c', L, 0.7)]]); c.fill();
        c.strokeStyle = 'rgba(40,60,75,0.6)'; c.lineWidth = 0.6; c.stroke();
        c.fillStyle = paint('#2d74b0', L, 0.6); c.fillRect(-9.5, s - ch / 2 + 0.3, 2, ch - 0.6); c.fillRect(-4, s - ch / 2 + 0.3, 2, ch - 0.6);
        circle(c, 0.5, s, 1.5); c.fillStyle = '#eef4f6'; c.fill(); c.strokeStyle = '#2a3238'; c.lineWidth = 0.4; c.stroke(); c.beginPath(); c.moveTo(0.5, s); c.lineTo(1.4, s - 0.8); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.7)'; for (const fx of [-11, -6.5, -1.5]) { circle(c, fx, s - ch * 0.28, 0.6); c.fill(); }
        c.strokeStyle = '#26303a'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(2, s); c.quadraticCurveTo(5, s * 0.5, 6, 0); c.stroke();
      }
      // the cannon: a ribbed barrel with frost rings and a flared, frosted nozzle
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * 5.5;
        rr(c, 3 - kick, o - 3.2, len, 6.4, 2); c.fillStyle = linear(c, 0, o - 3.2, 0, o + 3.2, [[0, shade(steel, 0.3)], [0.5, steel], [1, shade(steel, -0.45)]]); c.fill();
        c.fillStyle = 'rgba(220,240,255,0.7)'; for (let k2 = 0; k2 < 4; k2++) c.fillRect(7 + k2 * 3.4 - kick, o - 3.2, 1.2, 6.4);
        c.beginPath(); c.moveTo(len + 1 - kick, o - 3.4); c.lineTo(len + 5.5 - kick, o - 5); c.lineTo(len + 5.5 - kick, o + 5); c.lineTo(len + 1 - kick, o + 3.4); c.closePath();
        c.fillStyle = linear(c, 0, o - 5, 0, o + 5, [[0, '#e6f6ff'], [1, '#6fa0bc']]); c.fill(); c.strokeStyle = 'rgba(30,50,65,0.6)'; c.lineWidth = 0.5; c.stroke();
        if (b >= 3) { c.fillStyle = '#e6f2f8'; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(len + 5.5 - kick, o + sd * 4.2); c.lineTo(len + 9 - kick, o + sd * 6); c.lineTo(len + 5.5 - kick, o + sd * 2); c.fill(); } }
      }
      // turret drum with a viewport
      circle(c, 0, 0, 8); c.fillStyle = radial(c, 0, 0, 8, paint('#dbe8ef', L, 0.65), paint('#4f6878', L, 1)); c.fill();
      c.strokeStyle = 'rgba(30,45,55,0.6)'; c.lineWidth = 0.7; circle(c, 0, 0, 6.2); c.stroke();
      c.fillStyle = '#1d2a33'; c.fillRect(2, -0.7, 4.5, 1.4); c.fillStyle = 'rgba(160,230,255,0.6)'; c.fillRect(2.4, -0.4, 3.6, 0.5);
      c.fillStyle = '#2a3a46'; for (const sd of [-1, 1]) { circle(c, -3, sd * 4.2, 0.8); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.75)'; ellipse(c, -2.6, -3, 2.4, 1.2, -0.6); c.fill();
      if (lights && (a >= 4 || d >= 4)) lights.push({ x, y, r: 30, color: '150,210,255', a: 0.35 });
      break;
    }
    case 'flame': {
      sandbags(c, 15, 12, L);
      if (d >= 3) { c.fillStyle = '#5c6066'; rr(c, -15, -15, 6, 30, 2); c.fill(); }
      turn();
      const nozzles = b >= 2 ? [-2.5, 2.5] : [0], nl = 15 + (d >= 4 ? 8 : 0) + (b >= 4 ? 2 : 0);
      for (const o of nozzles) {
        c.fillStyle = paint('#2a2c28', L, 0.6); c.fillRect(2 - kick, o - 1.6, nl, 3.2);
        if (b >= 4) { c.fillStyle = '#3a3c36'; c.beginPath(); c.moveTo(nl - kick, o - 1.6); c.lineTo(nl + 4 - kick, o - 3.5); c.lineTo(nl + 4 - kick, o + 3.5); c.lineTo(nl - kick, o + 1.6); c.fill(); }
      }
      const tankCol = paint(a >= 5 ? '#d8402a' : a >= 3 ? '#d8d4c8' : a >= 2 ? '#4e5a34' : '#c44a32', L, 0.6);
      const tanks = a >= 4 ? [-3.9, 0, 3.9] : [-2.5, 2.5], th = a >= 4 ? 3.7 : 4.6, tw2 = a >= 1 ? 9.5 : 8.5;
      // fuel and pressure tanks strapped to his back: domed cylinders with valves and a hose forward
      const back = (c) => {
        for (const s of tanks) {
          rr(c, -12 + 0.6, s - th / 2 + 0.8, tw2, th, th / 2); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
          rr(c, -12, s - th / 2, tw2, th, th / 2); c.fillStyle = linear(c, 0, s - th / 2, 0, s + th / 2, [[0, tint(tankCol, 0.3)], [0.4, tankCol], [1, tint(tankCol, -0.5)]]); c.fill();
          c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.4; c.stroke();
          c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(-11, s - th * 0.3, tw2 - 3, 0.6);
          if (a >= 3) { c.fillStyle = '#d8b23a'; c.fillRect(-9.5, s - th / 2, 1.4, th); }
          circle(c, -2.8, s, 1); c.fillStyle = '#9a9c96'; c.fill(); c.fillStyle = '#2a2c28'; c.fillRect(-3.2, s - 0.3, 0.8, 0.6);
        }
        c.strokeStyle = '#1e1f1b'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-6.5, -6); c.lineTo(-6.5, 6); c.moveTo(-9.5, -5.6); c.lineTo(-9.5, 5.6); c.stroke();
        c.strokeStyle = '#26271f'; c.lineWidth = 1.3; c.lineCap = 'round'; c.beginPath(); c.moveTo(-2, tanks[tanks.length - 1]); c.bezierCurveTo(1, 9, 4, 6.5, 4, 2); c.stroke();
      };
      soldier(c, helmet('#3c3f36'), uniform(d >= 3 ? '#8a8c8e' : '#6a6a4a'), { back, pack: false, hands: [[8.5, -0.6], [4, 1.8]], seed: 5 });
      const pilot = d >= 2 ? '#8fd0ff' : d >= 5 ? '#ffffff' : '#ffb347';
      for (const o of nozzles) { c.fillStyle = pilot; circle(c, nl + 3 - kick, o, d >= 5 ? 2.6 : 1.8); c.fill(); }
      if (lights) lights.push({ x: x + Math.cos(ang) * (nl + 3), y: y + Math.sin(ang) * (nl + 3), r: a >= 4 || d >= 5 ? 30 : 18, color: d >= 2 ? '150,200,255' : '255,150,60', a: 0.45 });
      break;
    }
    case 'tesla': {
      pad(c, 34, paint('#8f918b', L, 0.32), paint('#5a5c57', L, 0.32));
      if (d >= 2) for (const [rx, ry] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) { c.fillStyle = '#b87333'; c.fillRect(rx - 1, ry - 4, 2, 6); circle(c, rx, ry - 4, 1.4); c.fill(); }
      if (b >= 1) for (let i = 0; i < (b >= 2 ? 4 : 2); i++) { const q = (i / (b >= 2 ? 4 : 2)) * TAU + Math.PI / 4; canister(c, Math.cos(q) * 14, Math.sin(q) * 14, 3.2, '#6d7880'); }
      if (b >= 4) { c.strokeStyle = 'rgba(140,220,255,0.6)'; c.lineWidth = 1.5; circle(c, 0, 0, 16 + (tw.pulse || 0) * 8); c.stroke(); }
      // the coil seen from above: a ribbed ceramic base, a tight copper winding with a hot
      // specular streak, and a polished toroid crowned by the discharge orb
      const R = b >= 5 ? 15 : 13, wind = 7 + Math.min(3, a) * 2 + (d >= 1 ? 2 : 0);
      circle(c, 1.5, 2.5, R + 1); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
      for (let i = 0; i < 12; i++) { const q = (i / 12) * TAU; c.save(); c.rotate(q); rr(c, R - 2.5, -1.8, 4.2, 3.6, 1.4); c.fillStyle = linear(c, R - 2.5, -1.8, R + 1.7, 1.8, [[0, '#f2efe6'], [1, '#9a978c']]); c.fill(); c.restore(); }
      circle(c, 0, 0, R - 1); c.fillStyle = radial(c, 0, 0, R, paint('#d68a46', L, 0.8), paint('#5a2e12', L, 0.8)); c.fill();
      c.lineWidth = 0.55;
      for (let i = 0; i < wind; i++) { const r = R - 1.6 - (i * (R - 7)) / wind; c.strokeStyle = i % 2 ? 'rgba(60,26,8,0.75)' : 'rgba(255,196,130,0.55)'; circle(c, 0, 0, r); c.stroke(); }
      c.save(); circle(c, 0, 0, R - 1); c.clip(); c.fillStyle = 'rgba(255,236,200,0.55)'; c.beginPath(); c.ellipse(-R * 0.35, -R * 0.35, R * 0.7, R * 0.16, -Math.PI / 4, 0, TAU); c.fill(); c.restore();
      // the toroid: a fat chrome ring
      const tr = 5.6 + (a >= 4 ? 1 : 0);
      circle(c, 0.6, 1.2, tr + 1.8); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill();
      circle(c, 0, 0, tr + 1.8); c.fillStyle = radial(c, 0, 0, tr + 1.8, paint('#f4f6f8', L, 0.35), paint('#4c5460', L, 0.5), -0.4, -0.4); c.fill();
      circle(c, 0, 0, tr - 1.2); c.fillStyle = radial(c, 0, 0, tr, '#20262c', '#5c6670', 0.3, 0.3); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.8; c.beginPath(); c.arc(0, 0, tr + 0.8, Math.PI * 1.05, Math.PI * 1.55); c.stroke();
      const orb = 2.8 + (tw.recoil || 0) * 2.4 + (a >= 4 ? 1.2 : 0), oc = paint('#bfefff', L, 0.4);
      c.fillStyle = radial(c, 0, 0, orb * 3, rgba(oc, 0.9), rgba(oc, 0), 0, 0); circle(c, 0, 0, orb * 3); c.fill();
      circle(c, 0, 0, orb); c.fillStyle = radial(c, 0, 0, orb, '#ffffff', oc, -0.3, -0.3); c.fill();
      if (lights) lights.push({ x, y, r: 26 + (tw.recoil || 0) * 30 + (d >= 5 ? 20 : 0), color: '140,220,255', a: 0.4 + (tw.recoil || 0) * 0.5 });
      if (Math.sin(t * 13 + x) > (d >= 3 ? 0.2 : 0.7)) {
        const q = (t * 7) % TAU;
        c.strokeStyle = 'rgba(180,235,255,0.9)'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(q) * 7 + 2, Math.sin(q) * 7 - 2); c.lineTo(Math.cos(q) * (d >= 3 ? 20 : 13), Math.sin(q) * (d >= 3 ? 20 : 13)); c.stroke();
      }
      if (a >= 5) { // storm cloud overhead
        for (let i = 0; i < 5; i++) { const q = i * 1.3 + t * 0.3; circle(c, Math.cos(q) * 6, -10 + Math.sin(q) * 3, 7); c.fillStyle = 'rgba(40,46,58,0.55)'; c.fill(); }
      }
      break;
    }
    case 'farm': {
      // laid out like a real homestead (see farmBase); the farmers turn to shoot
      const big = a >= 4 || b >= 4 || d >= 5, R = big ? 22 : 19, k = R / 19;
      c.fillStyle = SHADOW; c.fillRect(-R + 3, -R + 4, R * 2, R * 2);
      c.save(); c.scale(k, k); farmBase(c, tiers, L); c.restore();
      if (d >= 2) { // farmers with shotguns: one on the watchtower (or by the well), a second in the yard
        const spots = [d >= 3 ? [-13.5, -13.5, 0.6] : [-10.5, -6.5, 0.55]];
        if (d >= 4) spots.push([-4.4, 3, 0.55]);
        spots.forEach(([sx, sy, sc], i) => {
          c.save(); c.translate(sx * k, sy * k); turn(); c.scale(sc, sc);
          c.fillStyle = '#1d1f1c'; c.fillRect(2 - kick, -1, 12, 2); c.fillStyle = '#6a4a2a'; c.fillRect(-0.5 - kick, -1.3, 5, 2.6);
          soldier(c, helmet('#a88a4a'), uniform(i ? '#7a4a3a' : '#5a6a8a'), { farmer: true, hands: [[9, -0.2], [3.6, 1.2]], seed: i ? 3 : 0 });
          c.restore();
        });
      }
      break;
    }
    case 'heater': heaterBase(c, tiers, L); break;
    case 'heli': case 'jet': {
      // landing pad stays on the tile; the aircraft is drawn separately
      circle(c, 2, 3, 17); c.fillStyle = SHADOW; c.fill();
      circle(c, 0, 0, 17); c.fillStyle = radial(c, 0, 0, 17, paint('#7d807a', L, 0.5), paint('#4a4c48', L, 0.5)); c.fill();
      c.strokeStyle = top >= 3 ? rgba(PATH_COLORS[tiers.indexOf(top)], 0.8) : 'rgba(230,220,180,0.75)'; c.lineWidth = 1.5; circle(c, 0, 0, 13); c.stroke();
      if (type === 'heli') label(c, d >= 4 ? '+' : 'H', 0, 0.5, 14, d >= 4 ? 'rgba(230,80,70,0.9)' : 'rgba(230,220,180,0.85)');
      else { c.strokeStyle = 'rgba(230,220,180,0.75)'; c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.moveTo(4, -4); c.lineTo(8, 0); c.lineTo(4, 4); c.stroke(); }
      if (d >= 3 && type === 'heli') { crate(c, 10, 8, 7, 6, '#6b5330'); crate(c, -16, 9, 6, 5, '#4c5538'); }
      if (type === 'jet' && d >= 3) { c.save(); c.translate(12, -12); c.rotate(t * 2); c.fillStyle = '#9aa0a6'; c.fillRect(-5, -1, 10, 2); c.restore(); }
      break;
    }
    case 'gunboat': {
      const bob = Math.sin(t * 2 + x) * 0.8;
      c.translate(0, bob);
      turn();
      ellipse(c, -12, 0, 12, 7); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill();
      // wake: churned foam behind and a bow wave either side
      c.fillStyle = 'rgba(255,255,255,0.22)'; for (let i = 0; i < 5; i++) { ellipse(c, -20 - i * 3.5, Math.sin(t * 3 + i) * 1.2, 3.5 - i * 0.4, 5.5 - i * 0.6); c.fill(); }
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(19, sd * 2); c.quadraticCurveTo(12, sd * 11, 2, sd * 13); c.stroke(); }
      const hullPath = () => { c.beginPath(); c.moveTo(21, 0); c.bezierCurveTo(16, -8, 6, -9.5, -16, -9); c.quadraticCurveTo(-18.5, -9, -18.5, -6); c.lineTo(-18.5, 6); c.quadraticCurveTo(-18.5, 9, -16, 9); c.bezierCurveTo(6, 9.5, 16, 8, 21, 0); c.closePath(); };
      const hull = b >= 4 ? ['#a59a7a', '#5c5440'] : a >= 4 ? ['#7c858b', '#3c4449'] : ['#8e969b', '#4c5459'];
      hullPath(); c.fillStyle = linear(c, 0, -10, 0, 10, [[0, paint(hull[0], L, 0.6)], [1, paint(hull[1], L, 0.6)]]); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.7; c.stroke();
      // teak deck inside the gunwale, planked fore and aft
      c.save(); c.beginPath(); c.moveTo(17, 0); c.bezierCurveTo(13, -6.2, 5, -7.4, -15, -7); c.lineTo(-15, 7); c.bezierCurveTo(5, 7.4, 13, 6.2, 17, 0); c.closePath(); c.clip();
      c.fillStyle = b >= 4 ? '#8a6a3c' : '#6e5c44'; c.fillRect(-20, -10, 40, 20);
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.45; for (let yy = -7; yy <= 7; yy += 1.6) { c.beginPath(); c.moveTo(-16, yy); c.lineTo(18, yy); c.stroke(); }
      c.restore();
      if (b >= 4) { hullPath(); c.strokeStyle = '#d8b23a'; c.lineWidth = 0.8; c.stroke(); }
      c.fillStyle = '#e8e4d8'; for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) { circle(c, -13 + i * 7, sd * 7.9, 0.5); c.fill(); }
      // cargo for the trade path
      const boxes = [0, 1, 2, 3, 5, 6][b] || 0;
      const cols = ['#a8452e', '#2f6f8a', '#c79a2e', '#4f7a3a', '#7a4a8a', '#a8452e'];
      for (let i = 0; i < boxes; i++) { const bx = -15 + (i % 3) * 4.2, by = i < 3 ? -5 : 1; c.fillStyle = cols[i]; c.fillRect(bx, by, 3.8, 4.4); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(bx, by + 3.4, 3.8, 1); }
      if (!boxes) { c.fillStyle = '#5f676c'; rr(c, -12, -5, 12, 10, 2); c.fill(); }
      // the helmsman at the console, behind the windshield
      c.save(); c.translate(-6.5, 0); c.scale(0.5, 0.5); soldier(c, paint('#3a4a58', L, 0.5), paint('#4a5a6a', L, 0.3), { hands: [[8, -2.8], [8, 2.8]], pack: false, seed: 8 }); c.restore();
      c.fillStyle = 'rgba(40,60,70,0.9)'; c.fillRect(-2, -4, 2, 8); c.fillStyle = 'rgba(160,210,230,0.35)'; c.fillRect(-1.6, -3.6, 0.6, 7.2);
      if (d >= 1) { c.strokeStyle = '#2a2c28'; c.lineWidth = 1; c.beginPath(); c.moveTo(-4, 0); c.lineTo(-4, -1); c.stroke(); circle(c, -4, 0, 1.8); c.fillStyle = '#3a4045'; c.fill(); }
      if (d >= 2) { c.fillStyle = '#2a2a24'; for (const s of [-1, 1]) { circle(c, -16, s * 5, 1.6); c.fill(); circle(c, -13.5, s * 6, 1.6); c.fill(); } }
      if (d >= 4) { c.fillStyle = '#4a5054'; c.fillRect(-9, -8.5, 6, 3.5); c.fillStyle = '#c9483d'; c.fillRect(-9, -8.5, 1, 3.5); }
      if (d >= 5) { c.fillStyle = '#2c3236'; for (let i = 0; i < 4; i++) c.fillRect(-9 + i * 1.6, 5, 1.2, 3); }
      // turrets
      const n = 1 + (a >= 1) + (a >= 4) + (a >= 5);
      const spots = [[8, 0], [1, 0], [14, 0], [-6, 0]];
      for (let i = 0; i < n; i++) {
        const [tx, ty] = spots[i];
        circle(c, tx, ty, a >= 4 ? 4 : 3.5); c.fillStyle = '#3a4045'; c.fill();
        const bl = a >= 5 ? 14 : a >= 3 ? 11 : 9;
        for (const o of a >= 3 ? [-1.4, 1.4] : [0]) { c.fillStyle = '#1e2225'; c.fillRect(tx + 1 - kick, ty + o - 0.9, bl, 1.8); }
      }
      if (d >= 3) { c.fillStyle = '#5a4630'; c.fillRect(17, -0.8, 6, 1.6); c.fillStyle = '#c0c4c6'; c.fillRect(23, -1.2, 2, 2.4); }
      break;
    }
    case 'sub': {
      const bob = Math.sin(t * 1.5 + x) * 0.6;
      c.translate(0, bob);
      turn();
      ellipse(c, 0, 0, 22, 7); c.fillStyle = 'rgba(10,20,25,0.45)'; c.fill();
      const hull = b >= 4 ? ['#4a4e52', '#1e2023'] : ['#3c464c', '#161c20'];
      // foam where the hull breaks the surface, then the pressure hull with weld seams
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.2; ellipse(c, 0, 0, 20.5, 6.8); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 4; i++) { ellipse(c, -22 - i * 3, Math.sin(t * 3 + i), 2.6 - i * 0.4, 3.6 - i * 0.5); c.fill(); }
      ellipse(c, 0, 0, 19, 5.5); c.fillStyle = linear(c, 0, -6, 0, 6, [[0, shade(paint(hull[0], L, 0.6), 0.15)], [0.45, paint(hull[0], L, 0.6)], [1, paint(hull[1], L, 0.5)]]); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 0.5; c.stroke();
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.4; for (const sx of [-12, -6, 6, 12]) { c.beginPath(); c.moveTo(sx, -5.2 * Math.sqrt(1 - (sx / 19) ** 2)); c.lineTo(sx, 5.2 * Math.sqrt(1 - (sx / 19) ** 2)); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,0.22)'; ellipse(c, 2, -2.6, 13, 1.1); c.fill();
      // tail fins
      c.fillStyle = paint(hull[1], L, 0.5); c.beginPath(); c.moveTo(-17, 0); c.lineTo(-21, -4); c.lineTo(-19.5, 0); c.lineTo(-21, 4); c.closePath(); c.fill();
      if (b >= 2) { c.fillStyle = 'rgba(200,70,50,0.75)'; c.fillRect(-14, -0.6, 28, 1.2); }
      if (b >= 5) { c.strokeStyle = '#d8b23a'; c.lineWidth = 0.7; ellipse(c, 0, 0, 19, 5.5); c.stroke(); }
      // the sail with dive planes and a periscope
      c.fillStyle = '#1c2226'; c.fillRect(0, -6.5, 3, 13);
      rr(c, -2.5, -3, 10, 6, 3); c.fillStyle = linear(c, 0, -3, 0, 3, [[0, '#46525a'], [1, '#161c20']]); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.5; c.stroke();
      circle(c, 5.2, 0, 0.9); c.fillStyle = '#9aa6ac'; c.fill();
      c.fillStyle = '#6f7a80'; c.fillRect(4, -0.6, 6, 1.2);
      const hatches = a >= 5 ? 7 : a >= 3 ? 3 : a >= 2 ? 2 : 0;
      for (let i = 0; i < hatches; i++) { circle(c, -6 - (i % 4) * 2.6, i < 4 ? -1.5 : 1.5, 0.9); c.fillStyle = '#0c1012'; c.fill(); }
      if (d >= 1) { circle(c, 16, 0, 1.8); c.fillStyle = '#58646a'; c.fill(); }
      if (d >= 3) { circle(c, -10, 0, 1.4); c.fillStyle = d >= 5 ? '#b8ffb0' : '#7dff8a'; c.fill(); if (lights) lights.push({ x, y, r: d >= 5 ? 26 : 14, color: '120,255,140', a: 0.4 }); }
      if (b >= 5) { c.fillStyle = '#c9483d'; c.fillRect(1, -6, 3, 2); }
      c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 1; ellipse(c, 0, 0, 22, 8); c.stroke();
      if (tw.sonarPing > 0) { c.strokeStyle = `rgba(120,220,255,${tw.sonarPing})`; circle(c, 0, 0, 30 * (1.2 - tw.sonarPing)); c.stroke(); }
      break;
    }
  }
  c.restore();
  if (part && part !== 'over') return;
  if (L.n === 5) { c.save(); c.translate(x, y); upgradeSparks(c, L, t, x, lights, y); c.restore(); }
  if (!opts.icon) { c.save(); c.translate(x, y); tierMarks(c, tiers, 16, 16); c.restore(); }
  if (tw.stun > 0 && tw.stunKind && EXPED.drawTowerStun(c, tw, x, y)) { /* drawn by the expedition that caused it */ }
  else if (tw.stun > 0 && tw.stunSand) {
    // half buried under a heap of sand
    c.save(); c.translate(x, y);
    const rng = mulberry32((x * 7 + y) | 0);
    ellipse(c, 2, 3, 21, 17); c.fillStyle = 'rgba(60,40,20,0.3)'; c.fill();
    ellipse(c, 0, 0, 20, 16); c.fillStyle = radial(c, -6, -6, 24, '#f0d49a', '#a87c46', 0, 0); c.fill();
    c.fillStyle = 'rgba(120,84,44,0.5)';
    for (let i = 0; i < 18; i++) { const a = rng() * TAU, d = rng() * 15; circle(c, Math.cos(a) * d, Math.sin(a) * d * 0.8, 0.6); c.fill(); }
    c.restore();
  } else if (tw.stun > 0) {
    c.save(); c.globalAlpha = 0.65;
    rr(c, x - 20, y - 20, 40, 40, 6); c.fillStyle = 'rgba(200,235,255,0.75)'; c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.stroke();
    c.restore();
  }
}

// ---------- finished towers ----------
// Each tower is drawn in two layers, the fixed base and the turning turret, into offscreen
// canvases at screen resolution. Each layer then gets the same finish as the globe's landmarks:
// a lit bevel along its upper-left edges, a shaded one along the lower right, fine grain and a
// light falloff, and the turret casts a soft shadow onto its base. Static bases are cached.
const TFIN = { base: new Map(), turret: new Map(), turretPx: 0, bounds: new Map(), scratch: [], grain: null };
const TURRET_STEPS = 16, TURRET_BUDGET = 7e6;
function finScratch(i, w, h) {
  let cv = TFIN.scratch[i];
  if (!cv) cv = TFIN.scratch[i] = document.createElement('canvas');
  if (cv.width < w || cv.height < h) { cv.width = Math.max(cv.width, w); cv.height = Math.max(cv.height, h); }
  return cv;
}
function finGrain(g) {
  if (!TFIN.grain) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 96;
    const gg = cv.getContext('2d'), img = gg.createImageData(96, 96), rng = mulberry32(7);
    for (let i = 0; i < img.data.length; i += 4) { const v = rng() < 0.55 ? 0 : 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = Math.floor(rng() * rng() * 34); }
    gg.putImageData(img, 0, 0); TFIN.grain = cv;
  }
  return g.createPattern(TFIN.grain, 'repeat');
}
// bevel, grain and light on whatever is drawn in cv (w × h device pixels, k pixels per unit)
function finishLayer(cv, w, h, k) {
  const g = cv.getContext('2d'), e = finScratch(3, w, h), eg = e.getContext('2d');
  const d = Math.max(1, k * 1.1);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  for (const [sx, col, a] of [[1, '#fff4dc', 0.5], [-1, '#05070a', 0.55]]) {
    eg.setTransform(1, 0, 0, 1, 0, 0);
    eg.globalCompositeOperation = 'copy'; eg.drawImage(cv, 0, 0, w, h, 0, 0, w, h);
    eg.globalCompositeOperation = 'destination-out'; eg.drawImage(cv, 0, 0, w, h, sx * d, sx * d, w, h);
    eg.globalCompositeOperation = 'source-in'; eg.fillStyle = col; eg.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a; g.drawImage(e, 0, 0, w, h, 0, 0, w, h);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-atop';
  const lg = g.createLinearGradient(0, 0, w, h);
  lg.addColorStop(0, 'rgba(255,240,210,0.14)'); lg.addColorStop(0.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(8,12,18,0.3)');
  g.fillStyle = lg; g.fillRect(0, 0, w, h);
  g.fillStyle = finGrain(g); g.fillRect(0, 0, w, h);
  eg.globalCompositeOperation = 'source-over';
  g.restore();
}
// how far a layer reaches from the tower's centre, measured once per look
function layerReach(tw, part) {
  const key = `${tw.type}|${tw.tiers}|${part}`;
  let R = TFIN.bounds.get(key);
  if (R) return R;
  const S = 160, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.translate(S / 2, S / 2);
  let far = -1;
  for (const ang of [0, Math.PI / 2]) {
    g.clearRect(-S, -S, S * 2, S * 2);
    drawTowerRaw(g, { ...tw, x: 0, y: 0, angle: ang, recoil: 0, stun: 0 }, 0.4, null, { part, icon: true });
    const px = g.getImageData(0, 0, S, S).data;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 8) { const x = (i >> 2) % S - S / 2, y = ((i >> 2) / S | 0) - S / 2, r = Math.hypot(x, y); if (r > far) far = r; }
  }
  R = far < 0 ? 0.001 : Math.min(S / 2, far + 6);
  TFIN.bounds.set(key, R);
  return R;
}
// turrets with moving parts are finished every frame
function liveTurret(tw) {
  const [a, , d] = tw.tiers || [0, 0, 0];
  return (tw.type === 'sniper' && a >= 5) || (tw.type === 'gunner' && d >= 5) || tw.type === 'gunboat' || tw.type === 'sub';
}
// bases with moving parts are redrawn every frame; the rest are cached
function liveBase(tw) {
  const [a, , d] = tw.tiers || [0, 0, 0];
  return tw.type === 'tesla' || (tw.type === 'cryo' && d >= 2) || (tw.type === 'sniper' && d >= 5) || (tw.type === 'mortar' && d >= 4) || (tw.type === 'jet' && d >= 3) || a < 0;
}
// ---------- premium tower skins ----------
// A skin recolours a finished layer: the shapes and shading stay, the paint changes.
const skinOf = (type) => (typeof PREMIUM !== 'undefined' ? PREMIUM.skinOf(type) : null);
const SKIN_LOOK = {
  gold:   { id: 'gold', ramp: ['#5a3606', '#e8a820', '#ffe890'], gain: 1.05, lift: 0.02, sheen: 0.3 },
  winter: { id: 'winter', ramp: ['#4e5e6c', '#bccad4', '#ffffff'], gain: 1, lift: 0.28, camo: ['rgba(252,253,255,0.5)', 'rgba(90,108,124,0.4)'] },
  neon:   { id: 'neon', ramp: ['#1a0638', '#b02cff', '#3ef4ff'], gain: 1.15, lift: 0.05, edge: '#7ff6ff' },
  scrap:  { id: 'scrap', ramp: ['#2e180a', '#8e4c24', '#d49a5c'], gain: 1, lift: 0.04, camo: ['rgba(160,74,26,0.4)', 'rgba(40,26,16,0.35)'] },
};
// what a skin adds on top of its colours: camouflage or rust blotches, a gold sheen, a neon outline
function skinLayer(cv, n, k, skin, seed) {
  const L = SKIN_LOOK[skin];
  if (!L) return;
  const g = cv.getContext('2d'), e = finScratch(5, n, n), eg = e.getContext('2d');
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  eg.setTransform(1, 0, 0, 1, 0, 0); eg.globalAlpha = 1;
  if (L.camo) {
    // blotches, the same on every copy of this tower
    g.globalCompositeOperation = 'source-atop';
    const rng = mulberry32(seed);
    for (let i = 0; i < 30; i++) {
      g.fillStyle = L.camo[i % L.camo.length];
      g.beginPath(); g.ellipse(rng() * n, rng() * n, (1.5 + rng() * 3) * k, (1 + rng() * 2) * k, rng() * 3, 0, TAU); g.fill();
    }
  }
  if (L.sheen) {
    // a polished streak across gold
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = L.sheen;
    const sg = g.createLinearGradient(0, 0, n, n);
    sg.addColorStop(0.3, 'rgba(255,250,220,0)'); sg.addColorStop(0.42, 'rgba(255,250,220,0.9)'); sg.addColorStop(0.5, 'rgba(255,250,220,0)');
    g.fillStyle = sg; g.fillRect(0, 0, n, n);
  }
  if (L.edge) {
    // a glowing outline for neon
    eg.globalCompositeOperation = 'copy'; eg.globalAlpha = 1; eg.drawImage(cv, 0, 0, n, n, 0, 0, n, n);
    eg.globalCompositeOperation = 'destination-out'; eg.drawImage(cv, 0, 0, n, n, 1.2 * k, 1.2 * k, n, n);
    eg.globalCompositeOperation = 'source-in'; eg.fillStyle = L.edge; eg.fillRect(0, 0, n, n);
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.95; g.drawImage(e, 0, 0, n, n, 0, 0, n, n);
    g.drawImage(e, 0, 0, n, n, -0.6 * k, -0.6 * k, n, n);
  }
  eg.globalCompositeOperation = 'source-over'; eg.globalAlpha = 1;
  g.restore();
}
function renderLayer(cv, tw, t, lights, part, k, R, opts) {
  const n = Math.ceil(R * 2 * k), g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, n, n);
  g.setTransform(k, 0, 0, k, (R - tw.x) * k, (R - tw.y) * k);
  drawTowerRaw(g, tw, t, lights, { ...opts, part, alpha: null });
  const skin = skinOf(tw.type);
  if (skin) skinLayer(cv, n, k, skin, tw.type.length * 131 + (part === 'base' ? 7 : 3));
  finishLayer(cv, n, n, k);
  if (opts.bakeShadow) {
    // cast the layer's soft shadow down and to the right, baked into the same bitmap
    const tmp = finScratch(4, n, n), tg = tmp.getContext('2d');
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'copy'; tg.drawImage(cv, 0, 0, n, n, 0, 0, n, n); tg.globalCompositeOperation = 'source-over';
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, n, n);
    g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 3 * k; g.shadowOffsetX = 1.6 * k; g.shadowOffsetY = 2.4 * k;
    g.drawImage(tmp, 0, 0, n, n, 0, 0, n, n);
    g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetX = g.shadowOffsetY = 0;
  }
  return n;
}
function drawTower(c, tw, t, lights, opts = {}) {
  const m = c.getTransform(), k = Math.min(4, Math.max(0.5, Math.hypot(m.a, m.b)));
  const alpha = opts.alpha != null ? opts.alpha : 1;
  drawTowerRaw(c, tw, t, lights, { ...opts, part: 'under' });
  const x = tw.x, y = tw.y;
  const blit = (img, n, R, shadow) => {
    c.save(); c.globalAlpha *= alpha;
    if (shadow) { c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 3 * k; c.shadowOffsetX = 1.6 * k; c.shadowOffsetY = 2.4 * k; }
    c.drawImage(img, 0, 0, n, n, x - R, y - R, R * 2, R * 2); c.restore();
  };
  // base
  const Rb = layerReach(tw, 'base');
  if (liveBase(tw) || opts.icon) {
    const cv = finScratch(0, Math.ceil(Rb * 2 * k), Math.ceil(Rb * 2 * k));
    blit(cv, renderLayer(cv, tw, t, null, 'base', k, Rb, opts), Rb);
  } else {
    const key = `${tw.type}|${tw.tiers}|${k.toFixed(2)}|${skinOf(tw.type)}`;
    let e = TFIN.base.get(key);
    if (!e) {
      const cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(Rb * 2 * k);
      e = { cv, n: renderLayer(cv, { ...tw, x: 0, y: 0, angle: 0, recoil: 0, stun: 0, pulse: 0 }, 0, null, 'base', k, Rb, opts) };
      if (TFIN.base.size > 160) TFIN.base.delete(TFIN.base.keys().next().value);
      TFIN.base.set(key, e);
    }
    blit(e.cv, e.n, Rb);
  }
  // turret: finished at one of 16 headings and turned the last few degrees as a bitmap, so the
  // light stays within 11 degrees of true while the cache stays small
  const Rt = layerReach(tw, 'turret');
  let cached = false;
  if (Rt > 1) {
    const ang = tw.angle || 0, step = TAU / TURRET_STEPS, qi = ((Math.round(ang / step) % TURRET_STEPS) + TURRET_STEPS) % TURRET_STEPS;
    const rb = Math.min(2, Math.round((tw.recoil || 0) * 2.4));
    if (liveTurret(tw) || opts.icon) {
      const cv = finScratch(1, Math.ceil(Rt * 2 * k), Math.ceil(Rt * 2 * k));
      blit(cv, renderLayer(cv, tw, t, null, 'turret', k, Rt, opts), Rt, true);
    } else {
      const key = `${tw.type}|${tw.tiers}|${k.toFixed(2)}|${qi}|${rb}|${skinOf(tw.type)}`;
      let e = TFIN.turret.get(key);
      if (e) { TFIN.turret.delete(key); TFIN.turret.set(key, e); }
      else {
        const n = Math.ceil((Rt + 5) * 2 * k), cv = document.createElement('canvas'); cv.width = cv.height = n;
        const rec = [];
        e = { cv, rec, n: renderLayer(cv, { ...tw, x: 0, y: 0, angle: qi * step, recoil: rb / 2.4, stun: 0 }, 0, rec, 'turret', k, Rt + 5, { ...opts, bakeShadow: true }) };
        TFIN.turret.set(key, e); TFIN.turretPx += n * n;
        while (TFIN.turretPx > TURRET_BUDGET && TFIN.turret.size > 1) { const [k0, v0] = TFIN.turret.entries().next().value; TFIN.turret.delete(k0); TFIN.turretPx -= v0.n * v0.n; }
      }
      const R5 = Rt + 5, da = ang - qi * step;
      c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(da);
      c.drawImage(e.cv, 0, 0, e.n, e.n, -R5, -R5, R5 * 2, R5 * 2); c.restore();
      // the lights recorded with this bitmap, turned the same few degrees
      if (lights) { const ca = Math.cos(da), sa = Math.sin(da); for (const l of e.rec) lights.push({ ...l, x: x + l.x * ca - l.y * sa, y: y + l.x * sa + l.y * ca }); }
      cached = true;
    }
  }
  // otherwise the same code pushes this tower's lights, drawn nowhere
  if (lights && !cached) { const g = finScratch(2, 2, 2).getContext('2d'); g.setTransform(1, 0, 0, 1, -9999, -9999); drawTowerRaw(g, tw, t, lights, { ...opts, part: 'turret' }); }
  drawTowerRaw(c, tw, t, lights, { ...opts, part: 'over' });
}

function drawHeli(c, tw, t, ax, ay) {
  const [a, b, d] = tw.tiers || [0, 0, 0];
  const L = towerLook(tw);
  // a gentle hover: the body breathes in and out a touch and its shadow drifts with the height
  const bob = Math.sin(t * 2.4 + (tw.x || 0) * 0.1);
  const k = (a >= 5 ? 1.15 : 1) * LOOK_SCALE[L.n] * (1 + bob * 0.012);
  const raw = d >= 5 ? ['#4a4e50', '#1c1e20'] : d >= 4 ? ['#d8d8d0', '#8a8a84'] : ['#6b7a52', '#2e3622'];
  const body = [paint(raw[0], L, 0.85), paint(raw[1], L, 0.6)];
  c.save(); c.translate(ax + 12 + bob * 1.2, ay + 18 + bob * 1.6); c.rotate(tw.angle); c.scale(k, k);
  ellipse(c, 0, 0, 14, 6); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
  c.fillStyle = 'rgba(0,0,0,0.12)'; circle(c, 2, 0, 18); c.fill();
  c.restore();
  c.save(); c.translate(ax, ay); c.rotate(tw.angle); c.scale(k, k);
  c.fillStyle = shade(body[1], 0.15); c.fillRect(-22, -1.5, 14, 3);
  rr(c, -25, -4, 4, 8, 1); c.fill();
  // tail rotor, seen edge-on: a blurred streak beside the fin
  ellipse(c, -23, 5, 3.8, 1.1); c.fillStyle = 'rgba(20,22,20,0.28)'; c.fill();
  c.strokeStyle = 'rgba(20,22,20,0.55)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-23 + Math.cos(t * 7) * 3.6, 5); c.lineTo(-23 - Math.cos(t * 7) * 3.6, 5); c.stroke();
  circle(c, -23, 4.4, 0.8); c.fillStyle = '#2a2c28'; c.fill();
  // rocket pods and gun pods on stub wings
  if (b >= 1 || a >= 1) { c.fillStyle = '#2a2d26'; c.fillRect(-3, -11, 3, 22); }
  if (b >= 1) {
    const pods = b >= 5 ? [-13, -9, 9, 13] : b >= 3 ? [-12, -8, 8, 12] : [-9, 9];
    for (const o of pods) { c.fillStyle = '#2f322b'; rr(c, -4, o - 1.8, 9, 3.6, 1.5); c.fill(); c.fillStyle = b >= 3 ? '#c9483d' : '#9aa0a6'; c.fillRect(4, o - 1, 1.5, 2); }
  }
  if (a >= 1) for (const o of [-6.5, 6.5]) { c.fillStyle = '#1a1c18'; c.fillRect(-2, o - 1, a >= 3 ? 13 : 9, 2); }
  // skids
  c.strokeStyle = '#1e201c'; c.lineWidth = 1.2; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(-8, sd * 6.8); c.lineTo(9, sd * 6.8); c.quadraticCurveTo(11, sd * 6.8, 11.5, sd * 5.8); c.stroke(); }
  // fuselage: a tapered body with engine housings, panel lines and a highlight down the spine
  c.beginPath(); c.moveTo(13, 0); c.bezierCurveTo(13, -5.5, 6, -6.8, -2, -6.4); c.quadraticCurveTo(-9, -5.8, -11, -2.2); c.lineTo(-11, 2.2); c.quadraticCurveTo(-9, 5.8, -2, 6.4); c.bezierCurveTo(6, 6.8, 13, 5.5, 13, 0); c.closePath();
  c.fillStyle = linear(c, 0, -6.6, 0, 6.6, [[0, shade(body[0], 0.25)], [0.4, body[0]], [1, body[1]]]); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.6; c.stroke();
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.4; for (const px of [-6, 0.5]) { c.beginPath(); c.moveTo(px, -6); c.quadraticCurveTo(px + 0.6, 0, px, 6); c.stroke(); }
  for (const sd of [-1, 1]) { rr(c, -8, sd * 2.6 - 1.6, 7, 3.2, 1.4); c.fillStyle = shade(body[1], -0.15); c.fill(); c.fillStyle = '#111'; c.fillRect(-8.4, sd * 2.6 - 0.9, 1, 1.8); }
  c.fillStyle = 'rgba(255,255,240,0.28)'; ellipse(c, 0, -3.2, 9, 1.4); c.fill();
  if (L.n >= 2) { c.fillStyle = L.col; c.fillRect(-11, -1, 4, 2); c.fillRect(2, -5.9, 3, 1.4); c.fillRect(2, 4.5, 3, 1.4); }
  if (d >= 4) { c.fillStyle = '#ffffff'; circle(c, -3, 0, 3.4); c.fill(); c.fillStyle = '#c9483d'; c.fillRect(-5, -0.9, 4, 1.8); c.fillRect(-3.9, -2, 1.8, 4); }
  if (d >= 5) { c.fillStyle = '#e3a83e'; c.fillRect(-9, -0.5, 18, 1); }
  // bubble canopy with reflections
  c.beginPath(); c.moveTo(13, 0); c.bezierCurveTo(13, -4.2, 9, -4.8, 5, -4.2); c.quadraticCurveTo(3.6, 0, 5, 4.2); c.bezierCurveTo(9, 4.8, 13, 4.2, 13, 0); c.closePath();
  c.fillStyle = linear(c, 5, -4, 13, 4, [[0, 'rgba(150,200,220,0.95)'], [1, 'rgba(40,70,90,0.95)']]); c.fill();
  c.strokeStyle = 'rgba(20,24,26,0.8)'; c.lineWidth = 0.5; c.stroke(); c.beginPath(); c.moveTo(8.5, -4.4); c.lineTo(8.5, 4.4); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.75)'; ellipse(c, 9.5, -2.2, 2.2, 0.8, -0.3); c.fill();
  if (d >= 1) { circle(c, 13.6, 0, 1.5); c.fillStyle = '#7dff8a'; c.fill(); }
  c.fillStyle = '#1a1c18'; c.fillRect(12, -0.9, a >= 4 ? 8 : 5, 1.8);
  // The main rotor: a soft disc where the blades blur, a bright rim where their tips catch the
  // light, and each blade with a motion-blur sweep trailing behind it. A real rotor turns so fast
  // that drawn frame by frame it strobes (stutters, or seems to run backwards), so these blades
  // turn at a pace the eye can follow at any frame rate and the sweep sells the speed.
  const rg = c.createRadialGradient(0, 0, 2, 0, 0, 20); rg.addColorStop(0, 'rgba(20,22,20,0.06)'); rg.addColorStop(0.8, 'rgba(20,22,20,0.13)'); rg.addColorStop(0.97, 'rgba(20,22,20,0.2)'); rg.addColorStop(1, 'rgba(20,22,20,0)');
  circle(c, 0, 0, 20); c.fillStyle = rg; c.fill();
  circle(c, 0, 0, 19.2); c.strokeStyle = 'rgba(235,235,225,0.12)'; c.lineWidth = 0.7; c.stroke();
  c.rotate(t * 11);
  const nb = a >= 2 ? 4 : 3, sweep = 0.6, slices = 6;
  for (let i = 0; i < nb; i++) {
    c.save(); c.rotate((i / nb) * TAU);
    for (let s2 = 0; s2 < slices; s2++) {
      const a0 = -sweep + (s2 / slices) * sweep, a1 = -sweep + ((s2 + 1) / slices) * sweep;
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 19.5, a0, a1 + 0.01); c.closePath();
      c.fillStyle = `rgba(15,16,15,${0.035 + (s2 / slices) * 0.13})`; c.fill();
    }
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(15,16,15,0.62)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(2.5, 0); c.lineTo(19, 0); c.stroke();
    c.strokeStyle = 'rgba(230,230,215,0.35)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(3, -0.4); c.lineTo(18.5, -0.4); c.stroke();
    c.fillStyle = 'rgba(240,200,80,0.7)'; c.fillRect(17.4, -0.75, 1.6, 1.5);
    c.restore();
  }
  circle(c, 0, 0, 2.2); c.fillStyle = radial(c, 0, 0, 2.2, '#8a8e88', '#1a1c18'); c.fill();
  c.restore();
}
function drawJet(c, tw, px, py, angle, lights, lead, zoom = 1, sh = 1) {
  const [a, b, d] = tw.tiers || [0, 0, 0];
  const L = towerLook(tw);
  const k = (b >= 5 ? 1.2 : 1) * LOOK_SCALE[L.n] * zoom;
  c.save(); c.translate(px + 22 * sh, py + 30 * sh); c.rotate(angle); c.scale(k, k);
  c.beginPath(); c.moveTo(14, 0); c.lineTo(-10, -11); c.lineTo(-8, 0); c.lineTo(-10, 11); c.closePath(); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fill();
  c.restore();
  c.save(); c.translate(px, py); c.rotate(angle); c.scale(k, k);
  // missiles under the wings
  const pylons = Math.min(4, 1 + a);
  for (let i = 0; i < pylons; i++) for (const s of [-1, 1]) { c.fillStyle = a >= 3 ? '#e8e2d0' : '#c8c8c0'; c.fillRect(-6 - i * 1.5, s * (5 + i * 2) - 0.6, 7, 1.2); }
  if (b >= 3) { c.fillStyle = '#2a2c28'; ellipse(c, -2, 0, 5, 1.8); c.fill(); }
  c.beginPath(); c.moveTo(16, 0); c.lineTo(2, -3); c.lineTo(-6, -13); c.lineTo(-10, -12); c.lineTo(-6, -3); c.lineTo(-12, -3); c.lineTo(-15, -7); c.lineTo(-16, 0);
  c.lineTo(-15, 7); c.lineTo(-12, 3); c.lineTo(-6, 3); c.lineTo(-10, 12); c.lineTo(-6, 13); c.lineTo(2, 3); c.closePath();
  const skin = b >= 5 ? ['#6a6e64', '#4a4e44', '#33362e'] : d >= 5 ? ['#8a8f98', '#5c626c', '#3e434c'] : ['#a3abb1', '#7c858b', '#596267'];
  c.fillStyle = linear(c, 0, -13, 0, 13, [[0, paint(skin[0], L, 0.35)], [0.5, paint(skin[1], L, 0.4)], [1, paint(skin[2], L, 0.4)]]); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.5; c.stroke();
  // raised spine, intakes, control-surface hinge lines and panel seams
  c.beginPath(); c.moveTo(15, 0); c.quadraticCurveTo(4, -2.6, -14, -1.6); c.lineTo(-14, 1.6); c.quadraticCurveTo(4, 2.6, 15, 0); c.closePath();
  c.fillStyle = linear(c, 0, -2.6, 0, 2.6, [[0, paint(shade(skin[0], 0.2), L, 0.35)], [1, paint(skin[2], L, 0.4)]]); c.fill();
  c.fillStyle = '#16181a'; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(3, sd * 2.4); c.lineTo(-1, sd * 3.6); c.lineTo(-1, sd * 2.6); c.closePath(); c.fill(); }
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.4;
  for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(-6.5, sd * 4); c.lineTo(-9.2, sd * 11.5); c.stroke(); c.beginPath(); c.moveTo(-1, sd * 3.2); c.lineTo(-6, sd * 11); c.stroke(); c.beginPath(); c.moveTo(-13, sd * 3.2); c.lineTo(-14.6, sd * 6.2); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.moveTo(2, -3); c.lineTo(-6, -12.5); c.lineTo(-7.5, -12.2); c.lineTo(-3, -4); c.closePath(); c.fill();
  if (L.n >= 2) { c.fillStyle = L.col; c.fillRect(8, -0.7, 4, 1.4); c.fillRect(-9.4, -11.6, 2, 2.6); c.fillRect(-9.4, 9, 2, 2.6); }
  if (top3(tw.tiers) >= 3) { c.fillStyle = PATH_COLORS[tw.tiers.indexOf(top3(tw.tiers))]; c.fillRect(-14.4, -6, 1.6, 2.6); c.fillRect(-14.4, 3.4, 1.6, 2.6); }
  // a gold-tinted bubble canopy with its frame and a sun glint
  ellipse(c, 6.5, 0, 4.6, 1.9); c.fillStyle = linear(c, 2, -2, 11, 2, [[0, 'rgba(220,190,110,0.95)'], [0.5, 'rgba(70,90,110,0.95)'], [1, 'rgba(30,40,55,0.95)']]); c.fill();
  c.strokeStyle = 'rgba(10,12,14,0.8)'; c.lineWidth = 0.4; c.stroke(); c.beginPath(); c.moveTo(5, -1.8); c.lineTo(5, 1.8); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.8)'; ellipse(c, 7.5, -0.8, 1.6, 0.45, -0.1); c.fill();
  if (lead && d >= 3) { circle(c, -3, 0, 4.5); c.fillStyle = '#d8d8d0'; c.fill(); c.fillStyle = '#2a2c28'; c.fillRect(-7.5, -0.6, 9, 1.2); }
  circle(c, -17, 0, b >= 1 ? 2.6 : 2); c.fillStyle = b >= 1 ? '#ffd27a' : '#ffb35a'; c.fill();
  c.restore();
  if (lights) lights.push({ x: px - Math.cos(angle) * 18, y: py - Math.sin(angle) * 18, r: b >= 1 ? 22 : 16, color: '255,170,80', a: 0.6 });
}
const top3 = (tiers) => Math.max(...(tiers || [0]));
function drawAircraft(c, tw, t, lights) {
  if (tw.type === 'heli') drawHeli(c, tw, t, tw.ax, tw.ay);
  else if (tw.type === 'jet') {
    const planes = tw.planes && tw.planes.length ? tw.planes : [{ x: tw.ax, y: tw.ay, a: tw.angle }];
    planes.forEach((pl, i) => drawJet(c, tw, pl.x, pl.y, pl.a, lights, i === 0));
  }
}

const AIRCRAFT_ICON = { heli: true, jet: true };
// Static icon of a tower for menus, the shop and the upgrade buttons.
function drawTowerIcon(c, type, tiers, size) {
  const k = size / 52;
  const tw = { type, tiers: tiers || [0, 0, 0], x: 26, y: 26, angle: -Math.PI / 4, recoil: 0, ax: 26, ay: 24 };
  // zoom out a little for big upgraded towers so their platform fits the icon
  const fit = [1, 1, 0.96, 0.9, 0.86, 0.82][towerLook(tw).n];
  c.save(); c.scale(k, k);
  c.translate(26, 26); c.scale(fit, fit); c.translate(-26, -26);
  if (type === 'gunboat' || type === 'sub') {
    c.fillStyle = '#2f5d6b'; rr(c, 2, 2, 48, 48, 8); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.08)'; rr(c, 2, 2, 48, 24, 8); c.fill();
  }
  if (AIRCRAFT_ICON[type]) {
    const L = towerLook(tw);
    c.save(); c.translate(26, 26);
    if (L.n === 5) { c.fillStyle = radial(c, 0, 0, 30, rgba(L.col, 0.4), rgba(L.col, 0), 0, 0); circle(c, 0, 0, 30); c.fill(); }
    upgradePlinth(c, L, 0.3, type, null, 0, 0);
    c.restore();
  }
  if (type === 'jet') {
    const n = Math.min(3, towerStats('jet', tw.tiers).planes);
    const zoom = n > 1 ? 1.05 : 1.45;
    for (let i = n - 1; i >= 0; i--) drawJet(c, tw, 24 - i * 10 + (n - 1) * 5, 24 + i * 10 - (n - 1) * 5, tw.angle, null, i === 0, zoom, 0.2);
  } else if (type === 'heli') drawAircraft(c, tw, 0.2, null);
  else drawTower(c, tw, 0.3, null, { icon: true });
  c.restore();
}

function drawZombieIcon(c, type, size) {
  const spr = ZART.get(type, 0);
  const k = size / spr.B * 1.05;
  c.save();
  c.translate(size / 2, size / 2);
  c.rotate(-Math.PI / 2);
  c.drawImage(spr.frames[2], -spr.B * k / 2, -spr.B * k / 2, spr.B * k, spr.B * k);
  c.restore();
}

// A supply crate dropped by a farm; it pops out, sits a moment, then is collected.
function drawCrate(c, cr) {
  const k = cr.age;
  const pop = k < 0.25 ? k / 0.25 : 1, lift = k > 1.4 ? (k - 1.4) / 0.4 : 0;
  c.save();
  c.translate(cr.x, cr.y - lift * 14 - Math.sin(pop * Math.PI) * 6);
  c.globalAlpha = 1 - lift;
  c.scale(pop, pop);
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-5, -2, 12, 9);
  c.fillStyle = linear(c, -6, -5, 6, 5, [[0, '#b88a4a'], [1, '#6b4e2a']]); c.fillRect(-6, -5, 12, 10);
  c.strokeStyle = '#4a3418'; c.lineWidth = 1; c.strokeRect(-5.5, -4.5, 11, 9);
  c.beginPath(); c.moveTo(-5.5, -4.5); c.lineTo(5.5, 4.5); c.stroke();
  label(c, '$', 0, 0.5, 9, '#86d356', 800);
  c.restore();
}
