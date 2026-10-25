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
  blob(TILE * 0.34); c.fillStyle = shade(world.water, -0.28); c.globalAlpha = 0.55; c.fill(); c.globalAlpha = 1;
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

function drawSafehouse(c, x, y, t, hit, night) {
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
function zombieColors(e, def) {
  const L = def.look;
  const slowed = e.slowT > 0 && !def.noSlow;
  const tint = (h) => (slowed ? mix(h, '#bfe6ff', 0.4) : h);
  return { skin: tint(L.skin || '#8c9a72'), shirt: tint(L.shirt || '#5a4a3a'), hair: L.hair || '#2c241c' };
}

function drawZombie(c, e, t, lights) {
  const def = ZOMBIES[e.type], L = def.look;
  const r = e.r;
  const ang = Math.atan2(e.diry, e.dirx);
  const kind = L.kind;
  const fly = def.fly;
  const walk = t * (def.speed > 70 ? 11 : 6.5) + e.phase;

  if (e.burrowed) {
    c.save(); c.translate(e.x, e.y); c.rotate(ang);
    ellipse(c, 0, 0, r * 1.1, r * 0.8); c.fillStyle = radial(c, 0, 0, r, '#7a6248', '#3e3022'); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-r * 0.6 + i * 4, -3 + (i % 2) * 5); c.lineTo(-r * 0.2 + i * 4, 1); c.stroke(); }
    if (e.revealed) { c.strokeStyle = 'rgba(120,220,255,0.8)'; c.lineWidth = 1.5; circle(c, 0, 0, r * 1.3); c.stroke(); }
    c.restore();
    return;
  }

  const { skin, shirt, hair } = zombieColors(e, def);
  c.save();
  if (fly) {
    // high in the air: shadow drawn far down-right and small
    c.save(); c.translate(e.x + 14, e.y + 20); c.rotate(ang);
    ellipse(c, 0, 0, r * 0.9, r * 0.5); c.fillStyle = 'rgba(0,0,0,0.22)'; c.fill();
    c.restore();
  }
  c.translate(e.x, e.y);
  c.rotate(ang);
  const wide = L.wide ? 1.3 : 1;

  if (kind === 'crow') {
    const flap = Math.sin(t * 18 + e.phase);
    c.fillStyle = '#16161a';
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(-2, 0); c.quadraticCurveTo(-4, s * r * (1.4 + flap * 0.5), -10, s * r * (1.7 + flap * 0.6)); c.lineTo(2, s * 2); c.closePath(); c.fill();
    }
    ellipse(c, 0, 0, r * 0.8, r * 0.32); c.fill();
    circle(c, r * 0.7, 0, r * 0.28); c.fill();
    c.fillStyle = '#c9a13a'; c.beginPath(); c.moveTo(r * 0.9, -1.5); c.lineTo(r * 1.25, 0); c.lineTo(r * 0.9, 1.5); c.fill();
    c.fillStyle = '#d23c2c'; circle(c, r * 0.78, -1.6, 0.9); c.fill();
  } else if (kind === 'bat') {
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + t * 3 + e.phase, d = r * 0.7;
      const bx = Math.cos(a) * d, by = Math.sin(a * 1.3) * d;
      const flap = Math.sin(t * 25 + i * 2);
      c.fillStyle = '#231a22';
      c.beginPath();
      c.moveTo(bx + 2, by); c.lineTo(bx - 1, by - 4 - flap * 2.5); c.lineTo(bx - 3, by - 1); c.lineTo(bx - 1, by + 4 + flap * 2.5); c.closePath(); c.fill();
      circle(c, bx, by, 1.8); c.fill();
      c.fillStyle = '#ff5a3c'; circle(c, bx + 1.2, by - 0.6, 0.5); c.fill();
    }
  } else if (kind === 'ghost') {
    const wob = Math.sin(t * 3 + e.phase);
    const g = c.createRadialGradient(0, 0, 1, -r * 0.4, 0, r * 1.6);
    g.addColorStop(0, 'rgba(225,235,240,0.85)'); g.addColorStop(0.5, 'rgba(170,190,200,0.45)'); g.addColorStop(1, 'rgba(150,170,180,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(r * 0.8, 0);
    c.quadraticCurveTo(r * 0.6, -r * 0.9, -r * 0.3, -r * 0.7);
    c.quadraticCurveTo(-r * 1.6, -r * 0.3 + wob * 3, -r * 2.2, wob * 4);
    c.quadraticCurveTo(-r * 1.6, r * 0.3 + wob * 3, -r * 0.3, r * 0.7);
    c.quadraticCurveTo(r * 0.6, r * 0.9, r * 0.8, 0);
    c.fill();
    c.fillStyle = '#d8f4ff';
    circle(c, r * 0.35, -r * 0.22, 1.6); c.fill(); circle(c, r * 0.35, r * 0.22, 1.6); c.fill();
    if (lights) lights.push({ x: e.x, y: e.y, r: r * 2.5, color: '150,210,255', a: 0.35 });
  } else if (kind === 'bloater') {
    ellipse(c, 4, 5, r * 1.05, r); c.fillStyle = SHADOW; c.fill();
    // little legs and arms
    const step = Math.sin(walk) * 3;
    c.fillStyle = shade(L.skin, -0.3);
    ellipse(c, -r * 0.3 + step, -r * 0.7, 4, 3); c.fill(); ellipse(c, -r * 0.3 - step, r * 0.7, 4, 3); c.fill();
    circle(c, 0, 0, r); c.fillStyle = radial(c, 0, 0, r, shade(skin, 0.2), shade(skin, -0.35)); c.fill();
    c.strokeStyle = 'rgba(70,40,60,0.45)'; c.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const a = i + e.phase; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2); c.quadraticCurveTo(Math.cos(a + 0.4) * r * 0.6, Math.sin(a + 0.4) * r * 0.6, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); c.stroke(); }
    for (let i = 0; i < 5; i++) { const a = i * 1.7 + e.phase; circle(c, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, 1.5 + (i % 3)); c.fillStyle = 'rgba(210,220,120,0.7)'; c.fill(); }
    circle(c, r * 0.85, 0, r * 0.32); c.fillStyle = radial(c, r * 0.85, 0, r * 0.32, shade(skin, 0.1), shade(skin, -0.3)); c.fill();
  } else if (kind === 'giant') {
    ellipse(c, 5, 6, r * 0.85, r * 1.2); c.fillStyle = SHADOW; c.fill();
    const sw = Math.sin(walk) * 4;
    for (const s of [-1, 1]) {
      c.save(); c.translate(0, s * r * 0.8); c.rotate(s * 0.15 + Math.sin(walk + s) * 0.08);
      rr(c, -2, -r * 0.22, r * 1.1 + sw * s, r * 0.44, r * 0.2); c.fillStyle = radial(c, r * 0.4, 0, r * 0.7, shade(skin, 0.1), shade(skin, -0.35)); c.fill();
      c.restore();
    }
    ellipse(c, 0, 0, r * 0.65, r * 1.05); c.fillStyle = radial(c, 0, 0, r, shade(skin, 0.15), shade(skin, -0.4)); c.fill();
    for (let i = 0; i < 6; i++) { star(c, -r * 0.2 + (i % 2) * 4, -r * 0.6 + i * r * 0.24, 4, 1.5, 4, i); c.fillStyle = 'rgba(220,240,255,0.9)'; c.fill(); }
    circle(c, r * 0.35, 0, r * 0.32); c.fillStyle = radial(c, r * 0.35, 0, r * 0.32, shade(skin, 0.1), shade(skin, -0.3)); c.fill();
    c.fillStyle = '#9fe3ff'; circle(c, r * 0.58, -r * 0.1, 1.8); c.fill(); circle(c, r * 0.58, r * 0.1, 1.8); c.fill();
    if (lights) lights.push({ x: e.x, y: e.y, r: r * 1.6, color: '160,220,255', a: 0.25 });
  } else {
    // humans, skeletons and the rest walk upright: legs, reaching arms, shoulders, head
    const skel = kind === 'skeleton';
    const small = L.small;
    const sx = small ? 1.25 : L.lean ? 1.15 : 1;
    ellipse(c, 4, 5, r * 0.75 * sx, r * 0.85 * wide); c.fillStyle = SHADOW; c.fill();
    // feet step out in front of and behind the body
    const stride = Math.sin(walk) * r * 0.62;
    const legCol = skel ? '#d8d2c0' : '#2a2520';
    c.fillStyle = legCol;
    ellipse(c, stride - r * 0.05, -r * 0.3 * wide, r * 0.3, r * 0.15); c.fill();
    ellipse(c, -stride - r * 0.05, r * 0.3 * wide, r * 0.3, r * 0.15); c.fill();
    // arms reach forward, swaying slightly out of step
    for (const s of [-1, 1]) {
      const reach = r * (small ? 0.9 : 1.05) + Math.sin(walk + s) * r * 0.12;
      c.save(); c.translate(0, s * r * 0.52 * wide); c.rotate(-s * 0.12);
      rr(c, 0, -r * (skel ? 0.08 : 0.13), reach, r * (skel ? 0.16 : 0.26), r * 0.12);
      c.fillStyle = skel ? '#d8d2c0' : linear(c, 0, -r * 0.13, 0, r * 0.13, [[0, shade(skin, 0.12)], [1, shade(skin, -0.25)]]);
      c.fill();
      circle(c, reach, 0, r * (skel ? 0.12 : 0.17)); c.fillStyle = skel ? '#cfc8b4' : shade(skin, -0.1); c.fill();
      c.restore();
    }
    // shoulders / torso
    ellipse(c, 0, 0, r * 0.48 * sx, r * 0.78 * wide);
    if (skel) {
      c.fillStyle = 'rgba(40,36,30,0.45)'; c.fill();
      c.strokeStyle = '#ddd6c2'; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-r * 0.4, 0); c.lineTo(r * 0.3, 0); c.stroke();
      for (let i = -2; i <= 1; i++) { c.beginPath(); c.moveTo(i * r * 0.16, 0); c.quadraticCurveTo(i * r * 0.16 + 2, -r * 0.6, i * r * 0.16 - 1, -r * 0.62); c.moveTo(i * r * 0.16, 0); c.quadraticCurveTo(i * r * 0.16 + 2, r * 0.6, i * r * 0.16 - 1, r * 0.62); c.stroke(); }
    } else {
      c.fillStyle = radial(c, 0, 0, r * 0.8, shade(shirt, 0.18), shade(shirt, -0.4)); c.fill();
      // torn cloth and stains
      c.fillStyle = 'rgba(70,15,12,0.55)';
      ellipse(c, -r * 0.15, r * 0.25 * ((e.phase * 10) % 2 > 1 ? 1 : -1), r * 0.18, r * 0.12); c.fill();
      if (L.gear === 'plate') {
        for (const s of [-1, 1]) { rr(c, -r * 0.35, s * r * 0.35 - r * 0.22, r * 0.7, r * 0.44, 3); c.fillStyle = linear(c, 0, -r, 0, r, [[0, '#9a9ea3'], [1, '#4a4d52']]); c.fill(); }
      }
      if (L.cross) { c.fillStyle = '#b83228'; c.fillRect(-r * 0.32, -r * 0.08, r * 0.4, r * 0.16); c.fillRect(-r * 0.2, -r * 0.2, r * 0.16, r * 0.4); }
      if (L.gear === 'hood') { ellipse(c, -r * 0.05, 0, r * 0.5 * sx, r * 0.72 * wide); c.fillStyle = 'rgba(15,10,25,0.35)'; c.fill(); }
    }
    // head
    const hr = r * (small ? 0.36 : 0.38) * (L.wide ? 1.1 : 1);
    const hx = r * (small ? 0.3 : 0.08);
    circle(c, hx, 0, hr);
    c.fillStyle = skel ? radial(c, hx, 0, hr, '#efeadc', '#a49d88') : radial(c, hx, 0, hr, shade(skin, 0.15), shade(skin, -0.3));
    c.fill();
    if (skel) {
      c.fillStyle = '#1b1814'; circle(c, hx + hr * 0.45, -hr * 0.35, hr * 0.22); c.fill(); circle(c, hx + hr * 0.45, hr * 0.35, hr * 0.22); c.fill();
    } else if (!L.gear || L.gear === 'plate') {
      // matted hair on the back of the head
      c.beginPath(); c.arc(hx, 0, hr, Math.PI * 0.55, Math.PI * 1.45); c.closePath(); c.fillStyle = hair; c.fill();
      if (L.gear === 'plate') { circle(c, hx, 0, hr * 1.05); c.fillStyle = linear(c, hx, -hr, hx, hr, [[0, '#8e9298'], [1, '#45484c']]); c.fill(); c.fillStyle = '#111'; c.fillRect(hx + hr * 0.3, -hr * 0.6, hr * 0.25, hr * 1.2); }
    }
    switch (L.gear) {
      case 'cone':
        circle(c, hx, 0, hr * 1.25); c.fillStyle = '#d4602a'; c.fill();
        circle(c, hx, 0, hr * 0.85); c.fillStyle = '#e9e4dc'; c.fill();
        circle(c, hx, 0, hr * 0.55); c.fillStyle = radial(c, hx, 0, hr * 0.55, '#f08a4a', '#b8461c'); c.fill();
        break;
      case 'riot':
        circle(c, hx, 0, hr * 1.18); c.fillStyle = radial(c, hx, 0, hr * 1.18, '#5a6068', '#15181c'); c.fill();
        c.fillStyle = 'rgba(140,170,190,0.55)'; c.beginPath(); c.arc(hx, 0, hr * 1.12, -0.9, 0.9); c.closePath(); c.fill();
        break;
      case 'hardhat':
        ellipse(c, hx, 0, hr * 1.25, hr * 1.15); c.fillStyle = '#c9a227'; c.fill();
        circle(c, hx, 0, hr * 0.9); c.fillStyle = radial(c, hx, 0, hr * 0.9, '#f2d35a', '#a8821a'); c.fill();
        c.fillStyle = '#fff6c2'; circle(c, hx + hr * 0.85, 0, 1.6); c.fill();
        if (lights) lights.push({ x: e.x + Math.cos(ang) * (hx + hr + 4), y: e.y + Math.sin(ang) * (hx + hr + 4), r: 22, color: '255,240,180', a: 0.35 });
        break;
      case 'hood':
        circle(c, hx - 1, 0, hr * 1.2); c.fillStyle = radial(c, hx - 1, 0, hr * 1.2, shade(shirt, 0.15), shade(shirt, -0.45)); c.fill();
        c.fillStyle = '#0c0a10'; c.beginPath(); c.arc(hx, 0, hr * 0.8, -0.7, 0.7); c.closePath(); c.fill();
        break;
      case 'mask':
        c.beginPath(); c.moveTo(hx + hr * 0.5, -hr * 0.4); c.lineTo(hx + hr * 2, 0); c.lineTo(hx + hr * 0.5, hr * 0.4); c.closePath(); c.fillStyle = '#d9cfb8'; c.fill();
        c.fillStyle = '#2a2420'; circle(c, hx, 0, hr * 0.95); c.fill();
        break;
      case 'ice':
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.beginPath(); c.moveTo(hx + Math.cos(a) * hr * 0.5, Math.sin(a) * hr * 0.5); c.lineTo(hx + Math.cos(a + 0.2) * hr * 1.5, Math.sin(a + 0.2) * hr * 1.5); c.lineTo(hx + Math.cos(a + 0.5) * hr * 0.6, Math.sin(a + 0.5) * hr * 0.6); c.fillStyle = 'rgba(220,245,255,0.9)'; c.fill(); }
        break;
      case 'straw':
        circle(c, hx, 0, hr * 1.9); c.fillStyle = radial(c, hx, 0, hr * 1.9, '#d8bf72', '#8a7234'); c.fill();
        c.strokeStyle = 'rgba(90,70,30,0.45)'; c.lineWidth = 1; circle(c, hx, 0, hr * 1.3); c.stroke(); circle(c, hx, 0, hr * 0.8); c.stroke();
        break;
    }
    if (L.staff) {
      c.strokeStyle = '#4a3a2a'; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(-r * 0.2, r * 0.65 * wide); c.lineTo(r * 1.4, r * 0.75 * wide); c.stroke();
      circle(c, r * 1.45, r * 0.75 * wide, 3.2); c.fillStyle = '#9dff6a'; c.fill();
      if (lights) lights.push({ x: e.x + Math.cos(ang) * r * 1.45 - Math.sin(ang) * r * 0.75 * wide, y: e.y + Math.sin(ang) * r * 1.45 + Math.cos(ang) * r * 0.75 * wide, r: 26, color: '150,255,110', a: 0.55 });
    }
    if (L.scythe) {
      c.strokeStyle = '#4a3a2a'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(-r * 0.3, -r * 0.7 * wide); c.lineTo(r * 1.3, -r * 0.9 * wide); c.stroke();
      c.strokeStyle = '#b9bcc0'; c.lineWidth = 3;
      c.beginPath(); c.arc(r * 1.3, -r * 0.3 * wide, r * 0.6, -Math.PI / 2, Math.PI * 0.15); c.stroke();
    }
  }
  // hit flash, frost and fire
  if (e.flash > 0) { c.globalAlpha = 0.5; circle(c, 0, 0, r * 0.9); c.fillStyle = '#ffffff'; c.fill(); c.globalAlpha = 1; }
  if (e.slowT > 0 && !def.noSlow) {
    c.fillStyle = 'rgba(200,240,255,0.85)';
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + e.phase; star(c, Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, 2.6, 1, 4, a); c.fill(); }
  }
  c.restore();
  if (e.burnT > 0 && lights) lights.push({ x: e.x, y: e.y, r: r * 2.6, color: '255,140,50', a: 0.5 });
}

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
function sandbags(c, r, n = 12) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    ellipse(c, Math.cos(a) * r + 2, Math.sin(a) * r + 3, 6, 4, a + Math.PI / 2); c.fillStyle = SHADOW; c.fill();
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    ellipse(c, Math.cos(a) * r, Math.sin(a) * r, 6, 4, a + Math.PI / 2);
    c.fillStyle = radial(c, Math.cos(a) * r, Math.sin(a) * r, 6, '#b3a476', '#6b5f40'); c.fill();
  }
}
function pad(c, size = 36) {
  c.fillStyle = SHADOW; rr(c, -size / 2 + 3, -size / 2 + 4, size, size, 5); c.fill();
  rr(c, -size / 2, -size / 2, size, size, 5);
  c.fillStyle = linear(c, -size / 2, -size / 2, size / 2, size / 2, [[0, '#8f918b'], [1, '#5a5c57']]); c.fill();
  c.fillStyle = '#3a3c38';
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { circle(c, x * (size / 2 - 4), y * (size / 2 - 4), 1.4); c.fill(); }
}
function soldier(c, helmet = '#4d5a3a', body = '#56603f') {
  ellipse(c, -1, 0, 7, 9); c.fillStyle = radial(c, -1, 0, 9, shade(body, 0.2), shade(body, -0.35)); c.fill();
  circle(c, 1, 0, 5.2); c.fillStyle = radial(c, 1, 0, 5.2, shade(helmet, 0.3), shade(helmet, -0.35)); c.fill();
}
function rankChevrons(c, level, x, y) {
  for (let i = 0; i < level; i++) {
    const yy = y - i * 3.5;
    c.beginPath(); c.moveTo(x - 4.5, yy + 2); c.lineTo(x, yy - 1); c.lineTo(x + 4.5, yy + 2);
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3; c.stroke();
    c.strokeStyle = level === 3 ? '#e0b44a' : '#d8d4c8'; c.lineWidth = 1.6; c.stroke();
  }
}

// Draws a tower. For aircraft, (x, y) is the pad and tw.ax/ay is where the aircraft is.
function drawTower(c, tw, t, lights, opts = {}) {
  const { type, level } = tw;
  const x = tw.x, y = tw.y;
  const ang = tw.angle;
  const kick = (tw.recoil || 0) * 3;
  c.save();
  if (opts.alpha != null) c.globalAlpha = opts.alpha;
  c.translate(x, y);
  switch (type) {
    case 'gunner': {
      sandbags(c, 15);
      c.rotate(ang);
      const guns = level === 3 ? [-3.5, 3.5] : [0];
      for (const o of guns) { c.fillStyle = '#1d1f1c'; c.fillRect(2 - kick, o - 1.3, 18, 2.6); c.fillStyle = '#2e312c'; c.fillRect(-1 - kick, o - 2.5, 8, 5); }
      soldier(c);
      if (level >= 1) { c.fillStyle = '#4b3a22'; c.fillRect(-11, 6, 6, 4); }
      break;
    }
    case 'sniper': {
      c.fillStyle = SHADOW; c.fillRect(-15, -13, 32, 32);
      c.fillStyle = linear(c, -16, -16, 16, 16, [[0, '#7a6448'], [1, '#4a3a28']]); c.fillRect(-16, -16, 32, 32);
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1;
      for (let i = -12; i <= 12; i += 6) { c.beginPath(); c.moveTo(-16, i); c.lineTo(16, i); c.stroke(); }
      c.rotate(ang);
      c.fillStyle = '#141614'; c.fillRect(4 - kick, -1, level >= 3 ? 28 : 24, 2);
      c.fillStyle = '#2a2d28'; c.fillRect(6, -2.4, 8, 4.8);
      ellipse(c, -4, 0, 11, 6); c.fillStyle = radial(c, -4, 0, 11, '#6d7a4c', '#3a4428'); c.fill();
      circle(c, 4, 0, 4.6); c.fillStyle = radial(c, 4, 0, 4.6, '#6a7650', '#33402a'); c.fill();
      break;
    }
    case 'mortar': {
      sandbags(c, 16, 13);
      c.rotate(ang);
      c.fillStyle = '#2b2d2a'; rr(c, -6, -6, 12, 12, 2); c.fill();
      circle(c, 3 - kick * 0.5, 0, 5); c.fillStyle = '#3c3f3a'; c.fill();
      circle(c, 3 - kick * 0.5, 0, 3); c.fillStyle = '#0c0d0c'; c.fill();
      c.save(); c.translate(-9, -9); soldier(c); c.restore();
      if (level >= 2) { c.save(); c.translate(-9, 9); soldier(c); c.restore(); }
      c.fillStyle = '#5a4428'; c.fillRect(8, 8, 6, 5);
      break;
    }
    case 'cryo': {
      pad(c);
      c.rotate(ang);
      c.fillStyle = '#4d5a66'; c.fillRect(4 - kick, -3, 16, 6);
      c.fillStyle = '#9fc6dc'; c.fillRect(17 - kick, -4, 4, 8);
      for (const s of [-1, 1]) { rr(c, -10, s * 7 - 3.5, 13, 7, 3.5); c.fillStyle = linear(c, 0, s * 7 - 3.5, 0, s * 7 + 3.5, [[0, '#e2eef5'], [1, '#8aa6b8']]); c.fill(); }
      circle(c, 0, 0, 8); c.fillStyle = radial(c, 0, 0, 8, '#c9dbe6', '#5f7888'); c.fill();
      c.fillStyle = 'rgba(200,240,255,0.8)'; circle(c, -2, -2, 2); c.fill();
      break;
    }
    case 'flame': {
      sandbags(c, 15);
      c.rotate(ang);
      c.fillStyle = '#2a2c28'; c.fillRect(2 - kick, -1.6, 15, 3.2);
      for (const s of [-1, 1]) { rr(c, -12, s * 3.5 - 3, 9, 6, 3); c.fillStyle = linear(c, 0, s * 3.5 - 3, 0, s * 3.5 + 3, [[0, '#c44a32'], [1, '#6a2216']]); c.fill(); }
      soldier(c, '#3c3f36', '#4b4a3a');
      c.fillStyle = '#ffb347'; circle(c, 18 - kick, 0, 1.8); c.fill();
      if (lights) lights.push({ x: x + Math.cos(ang) * 18, y: y + Math.sin(ang) * 18, r: 18, color: '255,150,60', a: 0.45 });
      break;
    }
    case 'tesla': {
      pad(c, 34);
      for (let i = 0; i < 4; i++) { circle(c, 0, 0, 13 - i * 3); c.fillStyle = i % 2 ? '#7a4a22' : '#b87333'; c.fill(); }
      circle(c, 0, 0, 3.5 + (tw.recoil || 0) * 2); c.fillStyle = '#e8f7ff'; c.fill();
      if (lights) lights.push({ x, y, r: 26 + (tw.recoil || 0) * 30, color: '140,220,255', a: 0.4 + (tw.recoil || 0) * 0.5 });
      if (Math.sin(t * 13 + x) > 0.7) {
        const a = (t * 7) % TAU;
        c.strokeStyle = 'rgba(180,235,255,0.9)'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 7 + 2, Math.sin(a) * 7 - 2); c.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); c.stroke();
      }
      break;
    }
    case 'heli': case 'jet': {
      // landing pad stays on the tile; the aircraft is drawn separately
      circle(c, 2, 3, 17); c.fillStyle = SHADOW; c.fill();
      circle(c, 0, 0, 17); c.fillStyle = radial(c, 0, 0, 17, '#7d807a', '#4a4c48'); c.fill();
      c.strokeStyle = 'rgba(230,220,180,0.75)'; c.lineWidth = 1.5; circle(c, 0, 0, 13); c.stroke();
      if (type === 'heli') label(c, 'H', 0, 0.5, 14, 'rgba(230,220,180,0.85)');
      else { c.strokeStyle = 'rgba(230,220,180,0.75)'; c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.moveTo(4, -4); c.lineTo(8, 0); c.lineTo(4, 4); c.stroke(); }
      break;
    }
    case 'gunboat': {
      const bob = Math.sin(t * 2 + x) * 0.8;
      c.translate(0, bob);
      c.rotate(ang);
      ellipse(c, -12, 0, 12, 7); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill();
      c.beginPath(); c.moveTo(20, 0); c.quadraticCurveTo(12, -10, -16, -9); c.lineTo(-18, 9); c.quadraticCurveTo(12, 10, 20, 0); c.closePath();
      c.fillStyle = linear(c, 0, -10, 0, 10, [[0, '#8e969b'], [1, '#4c5459']]); c.fill();
      c.fillStyle = '#5f676c'; rr(c, -12, -5, 12, 10, 2); c.fill();
      c.fillStyle = 'rgba(40,60,70,0.9)'; c.fillRect(-2, -4, 2, 8);
      const guns = level >= 1 ? [-3, 3] : [0];
      circle(c, 8, 0, 4.5); c.fillStyle = '#3a4045'; c.fill();
      for (const o of guns) { c.fillStyle = '#1e2225'; c.fillRect(9 - kick, o - 1, 12, 2); }
      break;
    }
    case 'sub': {
      const bob = Math.sin(t * 1.5 + x) * 0.6;
      c.translate(0, bob);
      c.rotate(ang);
      ellipse(c, 0, 0, 22, 7); c.fillStyle = 'rgba(10,20,25,0.45)'; c.fill();
      ellipse(c, 0, 0, 19, 5.5); c.fillStyle = linear(c, 0, -6, 0, 6, [[0, '#3c464c'], [1, '#161c20']]); c.fill();
      rr(c, -2, -3, 9, 6, 2.5); c.fillStyle = '#2a3237'; c.fill();
      c.fillStyle = '#6f7a80'; c.fillRect(4, -0.6, 6, 1.2);
      c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 1; ellipse(c, 0, 0, 22, 8); c.stroke();
      if (tw.sonarPing > 0) { c.strokeStyle = `rgba(120,220,255,${tw.sonarPing})`; circle(c, 0, 0, 30 * (1.2 - tw.sonarPing)); c.stroke(); }
      break;
    }
  }
  c.restore();
  if (!opts.icon) { c.save(); c.translate(x, y); rankChevrons(c, level, 13, 13); c.restore(); }
  if (tw.stun > 0) {
    c.save(); c.globalAlpha = 0.65;
    rr(c, x - 20, y - 20, 40, 40, 6); c.fillStyle = 'rgba(200,235,255,0.75)'; c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.stroke();
    c.restore();
  }
}

function drawAircraft(c, tw, t, lights) {
  if (tw.type === 'heli') {
    const { ax, ay } = tw;
    c.save(); c.translate(ax + 12, ay + 18); c.rotate(tw.angle);
    ellipse(c, 0, 0, 14, 6); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
    c.fillStyle = 'rgba(0,0,0,0.12)'; circle(c, 2, 0, 18); c.fill();
    c.restore();
    c.save(); c.translate(ax, ay); c.rotate(tw.angle);
    c.fillStyle = '#3f4a32'; c.fillRect(-22, -1.5, 14, 3);
    rr(c, -25, -4, 4, 8, 1); c.fill();
    ellipse(c, 0, 0, 12, 6.5); c.fillStyle = radial(c, 0, 0, 12, '#6b7a52', '#2e3622'); c.fill();
    ellipse(c, 6, 0, 5, 4); c.fillStyle = 'rgba(120,170,190,0.85)'; c.fill();
    if (tw.level >= 2) { c.fillStyle = '#2a2d26'; c.fillRect(-2, -9, 8, 3); c.fillRect(-2, 6, 8, 3); }
    c.fillStyle = '#1a1c18'; c.fillRect(10, -1, 6, 2);
    // rotor blur and blades
    circle(c, 0, 0, 19); c.fillStyle = 'rgba(30,30,30,0.18)'; c.fill();
    c.rotate(t * 40);
    c.strokeStyle = 'rgba(20,20,20,0.7)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-19, 0); c.lineTo(19, 0); c.moveTo(0, -19); c.lineTo(0, 19); c.stroke();
    c.restore();
  } else if (tw.type === 'jet') {
    const { ax, ay } = tw;
    c.save(); c.translate(ax + 22, ay + 30); c.rotate(tw.angle);
    c.beginPath(); c.moveTo(14, 0); c.lineTo(-10, -11); c.lineTo(-8, 0); c.lineTo(-10, 11); c.closePath(); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fill();
    c.restore();
    c.save(); c.translate(ax, ay); c.rotate(tw.angle);
    c.beginPath(); c.moveTo(16, 0); c.lineTo(2, -3); c.lineTo(-6, -13); c.lineTo(-10, -12); c.lineTo(-6, -3); c.lineTo(-12, -3); c.lineTo(-15, -7); c.lineTo(-16, 0);
    c.lineTo(-15, 7); c.lineTo(-12, 3); c.lineTo(-6, 3); c.lineTo(-10, 12); c.lineTo(-6, 13); c.lineTo(2, 3); c.closePath();
    c.fillStyle = linear(c, 0, -13, 0, 13, [[0, '#a3abb1'], [0.5, '#7c858b'], [1, '#596267']]); c.fill();
    ellipse(c, 6, 0, 4, 1.8); c.fillStyle = 'rgba(80,120,150,0.9)'; c.fill();
    circle(c, -17, 0, 2); c.fillStyle = '#ffb35a'; c.fill();
    c.restore();
    if (lights) lights.push({ x: ax - Math.cos(tw.angle) * 18, y: ay - Math.sin(tw.angle) * 18, r: 16, color: '255,170,80', a: 0.6 });
  }
}

// Static icon of a tower for menus and the shop.
function drawTowerIcon(c, type, level, size) {
  const k = size / 52;
  c.save(); c.scale(k, k);
  const tw = { type, level, x: 26, y: 26, angle: -Math.PI / 4, recoil: 0, ax: 26, ay: 24 };
  if (type === 'gunboat' || type === 'sub') {
    c.fillStyle = '#2f5d6b'; rr(c, 2, 2, 48, 48, 8); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.08)'; rr(c, 2, 2, 48, 24, 8); c.fill();
  }
  if (type === 'heli' || type === 'jet') { drawAircraft(c, tw, 0.2, null); }
  else drawTower(c, tw, 0.3, null, { icon: true });
  c.restore();
}

function drawZombieIcon(c, type, size) {
  const def = ZOMBIES[type];
  const k = (size * 0.4) / Math.max(10, def.r * (def.look.kind === 'ghost' ? 1.4 : 1.1));
  c.save();
  c.translate(size / 2, size / 2);
  c.scale(k, k);
  c.rotate(-Math.PI / 2);
  drawZombie(c, { type, r: def.r, x: 0, y: 0, dirx: 1, diry: 0, phase: 0.6, flash: 0, slowT: 0, burnT: 0, hp: 1, maxHp: 1, armor: 0 }, 0.3, null);
  c.restore();
}
