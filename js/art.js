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
function pad(c, size = 36, top = '#8f918b', bottom = '#5a5c57') {
  c.fillStyle = SHADOW; rr(c, -size / 2 + 3, -size / 2 + 4, size, size, 5); c.fill();
  rr(c, -size / 2, -size / 2, size, size, 5);
  c.fillStyle = linear(c, -size / 2, -size / 2, size / 2, size / 2, [[0, top], [1, bottom]]); c.fill();
  c.fillStyle = '#3a3c38';
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { circle(c, x * (size / 2 - 4), y * (size / 2 - 4), 1.4); c.fill(); }
}
function soldier(c, helmet = '#4d5a3a', body = '#56603f') {
  ellipse(c, -1, 0, 7, 9); c.fillStyle = radial(c, -1, 0, 9, shade(body, 0.2), shade(body, -0.35)); c.fill();
  circle(c, 1, 0, 5.2); c.fillStyle = radial(c, 1, 0, 5.2, shade(helmet, 0.3), shade(helmet, -0.35)); c.fill();
}
// small props used by the upgrade cosmetics
function crate(c, x, y, w, h, col = '#6b5330', stripe) {
  c.fillStyle = SHADOW; c.fillRect(x + 1.5, y + 2, w, h);
  c.fillStyle = linear(c, x, y, x + w, y + h, [[0, shade(col, 0.15)], [1, shade(col, -0.3)]]); c.fillRect(x, y, w, h);
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.8; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
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

// The tower's best path shows as chevrons in its colour; tier 5 earns a star.
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
function drawTower(c, tw, t, lights, opts = {}) {
  const { type } = tw;
  const tiers = tw.tiers || [0, 0, 0];
  const [a, b, d] = tiers;
  const x = tw.x, y = tw.y;
  const ang = tw.angle;
  const kick = (tw.recoil || 0) * 3;
  const top = Math.max(a, b, d);
  c.save();
  if (opts.alpha != null) c.globalAlpha = opts.alpha;
  c.translate(x, y);
  if (top === 5 && type !== 'gunboat' && type !== 'sub') {
    const col = hexRgb(PATH_COLORS[tiers.indexOf(5)]).join(',');
    c.fillStyle = radial(c, 0, 0, 30, `rgba(${col},${0.28 + Math.sin(t * 3 + x) * 0.08})`, `rgba(${col},0)`, 0, 0);
    circle(c, 0, 0, 30); c.fill();
  }
  switch (type) {
    case 'gunner': {
      // Energy turns it into a laser, Heavy into a walking mech, Spread into a gun bunker.
      const ray = a >= 5, mech = b >= 5, bunker = d >= 4;
      if (ray) {
        circle(c, 3, 4, 19); c.fillStyle = SHADOW; c.fill();
        circle(c, 0, 0, 19); c.fillStyle = radial(c, 0, 0, 19, '#9aa3a6', '#3e4548'); c.fill();
        c.strokeStyle = 'rgba(120,255,110,0.55)'; c.lineWidth = 1.5; circle(c, 0, 0, 15); c.stroke();
        c.fillStyle = '#2a2f31';
        for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU; circle(c, Math.cos(q) * 17, Math.sin(q) * 17, 1.2); c.fill(); }
      } else if (bunker) {
        const R = d >= 5 ? 21 : 17;
        c.beginPath(); for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU + Math.PI / 8; c.lineTo(Math.cos(q) * R + 3, Math.sin(q) * R + 4); } c.closePath(); c.fillStyle = SHADOW; c.fill();
        c.beginPath(); for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU + Math.PI / 8; c.lineTo(Math.cos(q) * R, Math.sin(q) * R); } c.closePath();
        c.fillStyle = linear(c, -R, -R, R, R, [[0, '#a19e94'], [1, '#5c5a54']]); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; c.stroke();
        if (d >= 5) { c.fillStyle = '#c9483d'; for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU + Math.PI / 8; c.fillRect(Math.cos(q) * R * 0.9 - 1.5, Math.sin(q) * R * 0.9 - 1.5, 3, 3); } }
      } else if (mech) {
        for (const s of [-1, 1]) {
          ellipse(c, 2, s * 13 + 3, 8, 4.5); c.fillStyle = SHADOW; c.fill();
          rr(c, -7, s * 13 - 4, 14, 8, 2); c.fillStyle = linear(c, 0, s * 13 - 4, 0, s * 13 + 4, [[0, '#7a8084'], [1, '#3e4346']]); c.fill();
          c.fillStyle = '#d8a02a'; for (let k = 0; k < 3; k++) c.fillRect(-5 + k * 4, s * 13 + (s > 0 ? 2.5 : -3.5), 2, 1);
        }
      } else {
        if (d >= 1) sandbags(c, 19, 16);
        sandbags(c, 15);
      }
      if (!ray && !mech && !bunker) {
        if (b >= 1) crate(c, 9, -16, 8, 6, b >= 2 ? '#2a2c28' : '#4b4a2c', b >= 2 ? '#c9483d' : '#b89a4a');
        if (b >= 3) crate(c, 9, 9, 8, 6, '#4b4a2c', '#d8702a');
        if (a >= 3) { canister(c, -13, 11, 3.6, '#a83a2e'); }
      }
      c.rotate(ang);
      if (ray) {
        // the Doom Ray: a huge emitter on a turret ring
        c.fillStyle = '#2f3436'; rr(c, -12, -9, 22, 18, 4); c.fill();
        c.fillStyle = linear(c, 0, -5, 0, 5, [[0, '#8a9296'], [1, '#3a4043']]); c.fillRect(4 - kick, -5, 26, 10);
        for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#c79a2e' : '#7d5a1e'; c.fillRect(8 + k * 5 - kick, -6.5, 2.5, 13); }
        c.beginPath(); c.moveTo(30 - kick, -6); c.lineTo(38 - kick, 0); c.lineTo(30 - kick, 6); c.closePath();
        c.fillStyle = '#9bff8a'; c.fill();
        c.save(); c.translate(-8, 0); soldier(c, '#2a3a2a', '#3e4a3a'); c.restore();
        if (lights) lights.push({ x: x + Math.cos(ang) * 34, y: y + Math.sin(ang) * 34, r: 34, color: '120,255,110', a: 0.7 });
      } else if (mech) {
        // Siege Mech: armored body, cockpit and twin rocket pods
        c.fillStyle = SHADOW; rr(c, -10, -10, 22, 22, 5); c.fill();
        c.fillStyle = linear(c, -11, -11, 11, 11, [[0, '#8a9094'], [1, '#43484b']]); rr(c, -11, -11, 21, 22, 5); c.fill();
        for (const s of [-1, 1]) {
          c.fillStyle = '#33383b'; rr(c, -6, s * 12 - 5, 16, 10, 2); c.fill();
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
        circle(c, 0, 0, R * 0.55); c.fillStyle = radial(c, 0, 0, R * 0.55, '#8c8a82', '#4a4944'); c.fill();
        c.fillStyle = '#1d1f1c'; c.fillRect(-2, -2.5, R * 0.55 + 4, 5);
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
            c.fillStyle = '#2e312c'; c.fillRect(-1 - kick, o - 2.5, 8, 5);
          }
          if (b >= 1 && !plasma) { c.fillStyle = b >= 2 ? '#d0703a' : '#b89a4a'; for (let k = 0; k < 4; k++) c.fillRect(1 - k * 1.6 - kick, o + 2.6 + k * 0.6, 1.2, 2.2); }
        }
        if (b >= 3) { // shoulder rocket pods
          const big = b >= 4;
          for (const s of [-1, 1]) {
            c.fillStyle = '#3a3f36'; rr(c, -7, s * 8 - (big ? 4 : 3), big ? 12 : 9, big ? 8 : 6, 1.5); c.fill();
            c.fillStyle = '#0e1011'; for (let k = 0; k < (big ? 3 : 2); k++) { circle(c, (big ? 3 : 1) - k * 3, s * 8, 1.2); c.fill(); }
          }
        }
        if (d >= 2 && !buck) { c.strokeStyle = '#2a2c28'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(4, 0); c.lineTo(-4, -6); c.moveTo(4, 0); c.lineTo(-4, 6); c.stroke(); }
        soldier(c, d >= 1 ? '#8e2e24' : laser ? '#2a2c30' : '#4d5a3a', laser ? '#3a3e44' : '#56603f');
        if (laser) { c.fillStyle = plasma ? '#7dd8ff' : '#ff6a5a'; c.fillRect(4, -2.5, 2, 5); }
      }
      break;
    }
    case 'sniper': {
      c.fillStyle = SHADOW; c.fillRect(-15, -13, 32, 32);
      c.fillStyle = linear(c, -16, -16, 16, 16, [[0, '#7a6448'], [1, '#4a3a28']]); c.fillRect(-16, -16, 32, 32);
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1;
      for (let i = -12; i <= 12; i += 6) { c.beginPath(); c.moveTo(-16, i); c.lineTo(16, i); c.stroke(); }
      if (d >= 3) crate(c, -15, 7, 9, 7, '#3a5530', '#d8b23a');
      if (d >= 4) { crate(c, 7, 8, 8, 7, '#6b5330'); crate(c, 8, 3, 7, 5, '#5e4a2c'); }
      if (d >= 5) { antenna(c, -12, -12, 16, t); c.fillStyle = 'rgba(70,80,50,0.55)'; c.fillRect(-16, -16, 32, 6); }
      c.rotate(ang);
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
        c.fillStyle = '#2a2d28'; c.fillRect(6, -2.4, 8, 4.8);
        const scope = d >= 1 ? 13 : 9;
        c.fillStyle = '#1b1d1a'; c.fillRect(5, -1.2 - 2.6, scope, 2.4);
        if (d >= 2) { circle(c, 5 + scope, -2.6, 1.4); c.fillStyle = '#7dff8a'; c.fill(); if (lights) lights.push({ x: x + Math.cos(ang) * 18, y: y + Math.sin(ang) * 18, r: 10, color: '120,255,140', a: 0.4 }); }
        if (a >= 4 && tw.recoil < 0.5 && !opts.icon) { c.strokeStyle = 'rgba(255,60,50,0.35)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(len + 4, 0); c.lineTo(len + 70, 0); c.stroke(); }
        ellipse(c, -4, 0, 11, 6); c.fillStyle = radial(c, -4, 0, 11, '#6d7a4c', '#3a4428'); c.fill();
        circle(c, 4, 0, 4.6); c.fillStyle = radial(c, 4, 0, 4.6, a >= 5 ? '#4c4c44' : '#6a7650', '#33402a'); c.fill();
        c.restore();
      }
      break;
    }
    case 'mortar': {
      sandbags(c, 16, 13);
      if (a >= 1) for (let i = 0; i < Math.min(4, a + 1); i++) { c.save(); c.translate(-14 + i * 4, 13); c.fillStyle = '#4a4c40'; rr(c, -1.5, -4, 3, 8, 1.5); c.fill(); if (a >= 3) { c.fillStyle = a >= 4 ? '#d8702a' : '#c9b13a'; c.fillRect(-1.5, -1, 3, 1.5); } c.restore(); }
      if (d >= 1) { c.strokeStyle = '#2a2c28'; c.lineWidth = 1; c.beginPath(); c.moveTo(12, -12); c.lineTo(15, -6); c.moveTo(12, -12); c.lineTo(9, -6); c.stroke(); c.fillStyle = '#1e201c'; c.fillRect(10, -15, 5, 3); }
      if (d >= 3) crate(c, 10, 6, 8, 6, '#4b4a2c', '#9aa0a6');
      if (d >= 4) { crate(c, -19, -6, 7, 9, '#4c5538'); antenna(c, -16, -6, 16, t); }
      c.rotate(ang);
      const tubes = d >= 5 ? [[0, 0]] : b >= 5 ? [[-3, -5], [-3, 5], [5, -5], [5, 5]] : b >= 3 ? [[1, -5], [1, 5]] : [[0, 0]];
      if (d >= 5) { // Long Tom field gun
        c.fillStyle = '#2b2d2a'; rr(c, -8, -7, 16, 14, 2); c.fill();
        c.fillStyle = '#3c3f3a'; c.fillRect(2 - kick, -2.5, 28, 5);
        c.fillStyle = '#222420'; c.fillRect(27 - kick, -3.5, 5, 7);
      } else {
        for (const [tx, ty] of tubes) {
          const R = a >= 5 ? 6.5 : tubes.length > 2 ? 4.2 : 5;
          c.fillStyle = '#2b2d2a'; rr(c, tx - R - 1, ty - R - 1, R * 2 + 2, R * 2 + 2, 2); c.fill();
          circle(c, tx + 3 - kick * 0.5, ty, R); c.fillStyle = d >= 2 ? '#56606a' : '#3c3f3a'; c.fill();
          circle(c, tx + 3 - kick * 0.5, ty, R * 0.6); c.fillStyle = '#0c0d0c'; c.fill();
        }
      }
      c.save(); c.translate(-9, -11); soldier(c); c.restore();
      if (b >= 2) { c.save(); c.translate(-9, 11); soldier(c); c.restore(); }
      if (b >= 5) { c.save(); c.translate(-15, 0); soldier(c, '#5a5a3a'); c.restore(); }
      c.fillStyle = '#5a4428'; c.fillRect(8, 9, 6, 5);
      break;
    }
    case 'cryo': {
      pad(c, 36, d >= 5 ? '#b9d4e2' : '#8f918b', d >= 5 ? '#6f90a4' : '#5a5c57');
      if (a >= 1) for (let i = 0; i < a * 2; i++) { const q = (i / (a * 2)) * TAU + 0.4; ice(c, Math.cos(q) * 18, Math.sin(q) * 18, 3 + a * 0.6, q + Math.PI / 2); }
      if (d >= 2) for (const [vx, vy] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) {
        circle(c, vx, vy, 2.4); c.fillStyle = '#2f3a42'; c.fill();
        if (!opts.icon) { const k = (t * 0.8 + vx * 0.01 + vy * 0.02) % 1; circle(c, vx, vy - k * 6, 2 + k * 4); c.fillStyle = `rgba(230,245,255,${0.35 * (1 - k)})`; c.fill(); }
      }
      if (d >= 3) { c.save(); c.translate(-12, 12); c.rotate(t * 1.5); c.fillStyle = '#9aa6ae'; ellipse(c, 0, 0, 5, 2); c.fill(); c.restore(); }
      c.rotate(ang);
      const n = 1 + (b >= 5 ? 2 : 0), len = 16 + (d >= 1 ? 4 : 0);
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * 5;
        c.fillStyle = '#4d5a66'; c.fillRect(4 - kick, o - 3, len, 6);
        c.fillStyle = '#9fc6dc'; c.fillRect(len + 1 - kick, o - 4, 4, 8);
        if (b >= 3) { c.fillStyle = '#d8e6ee'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(len + 5 - kick, o + s * 4); c.lineTo(len + 8 - kick, o + s * 5.5); c.lineTo(len + 5 - kick, o + s * 2); c.fill(); } }
      }
      const cw = b >= 1 ? 15 : 13, ch = b >= 1 ? 8 : 7;
      for (const s of [-1, 1]) { rr(c, -12, s * 7 - ch / 2, cw, ch, ch / 2); c.fillStyle = linear(c, 0, s * 7 - ch / 2, 0, s * 7 + ch / 2, [[0, '#e2eef5'], [1, '#8aa6b8']]); c.fill(); }
      if (b >= 4) { rr(c, -16, -3.5, 7, 7, 3.5); c.fillStyle = linear(c, 0, -3.5, 0, 3.5, [[0, '#e2eef5'], [1, '#8aa6b8']]); c.fill(); }
      circle(c, 0, 0, 8); c.fillStyle = radial(c, 0, 0, 8, '#c9dbe6', '#5f7888'); c.fill();
      c.fillStyle = 'rgba(200,240,255,0.8)'; circle(c, -2, -2, 2); c.fill();
      if (lights && (a >= 4 || d >= 4)) lights.push({ x, y, r: 30, color: '150,210,255', a: 0.35 });
      break;
    }
    case 'flame': {
      sandbags(c, 15);
      if (d >= 3) { c.fillStyle = '#5c6066'; rr(c, -15, -15, 6, 30, 2); c.fill(); }
      c.rotate(ang);
      const nozzles = b >= 2 ? [-2.5, 2.5] : [0], nl = 15 + (d >= 4 ? 8 : 0) + (b >= 4 ? 2 : 0);
      for (const o of nozzles) {
        c.fillStyle = '#2a2c28'; c.fillRect(2 - kick, o - 1.6, nl, 3.2);
        if (b >= 4) { c.fillStyle = '#3a3c36'; c.beginPath(); c.moveTo(nl - kick, o - 1.6); c.lineTo(nl + 4 - kick, o - 3.5); c.lineTo(nl + 4 - kick, o + 3.5); c.lineTo(nl - kick, o + 1.6); c.fill(); }
      }
      const tankCol = a >= 5 ? '#d8402a' : a >= 3 ? '#d8d4c8' : a >= 2 ? '#4e5a34' : '#c44a32';
      const tanks = a >= 4 ? [-5.5, 0, 5.5] : [-3.5, 3.5], tw2 = a >= 1 ? 10 : 9;
      for (const s of tanks) { rr(c, -12 - (a >= 1 ? 1 : 0), s - 3, tw2, 6, 3); c.fillStyle = linear(c, 0, s - 3, 0, s + 3, [[0, shade(tankCol, 0.15)], [1, shade(tankCol, -0.45)]]); c.fill(); if (a >= 3) { c.fillStyle = '#d8b23a'; c.fillRect(-9, s - 3, 1.5, 6); } }
      soldier(c, '#3c3f36', d >= 3 ? '#6a6c70' : '#4b4a3a');
      const pilot = d >= 2 ? '#8fd0ff' : d >= 5 ? '#ffffff' : '#ffb347';
      for (const o of nozzles) { c.fillStyle = pilot; circle(c, nl + 3 - kick, o, d >= 5 ? 2.6 : 1.8); c.fill(); }
      if (lights) lights.push({ x: x + Math.cos(ang) * (nl + 3), y: y + Math.sin(ang) * (nl + 3), r: a >= 4 || d >= 5 ? 30 : 18, color: d >= 2 ? '150,200,255' : '255,150,60', a: 0.45 });
      break;
    }
    case 'tesla': {
      pad(c, 34);
      if (d >= 2) for (const [rx, ry] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) { c.fillStyle = '#b87333'; c.fillRect(rx - 1, ry - 4, 2, 6); circle(c, rx, ry - 4, 1.4); c.fill(); }
      if (b >= 1) for (let i = 0; i < (b >= 2 ? 4 : 2); i++) { const q = (i / (b >= 2 ? 4 : 2)) * TAU + Math.PI / 4; canister(c, Math.cos(q) * 14, Math.sin(q) * 14, 3.2, '#6d7880'); }
      if (b >= 4) { c.strokeStyle = 'rgba(140,220,255,0.6)'; c.lineWidth = 1.5; circle(c, 0, 0, 16 + (tw.pulse || 0) * 8); c.stroke(); }
      const rings = 4 + Math.min(3, a) + (d >= 1 ? 1 : 0), R = b >= 5 ? 15 : 13;
      for (let i = 0; i < rings; i++) { circle(c, 0, 0, R - (i * R * 0.8) / rings); c.fillStyle = i % 2 ? '#7a4a22' : '#b87333'; c.fill(); }
      const orb = 3.5 + (tw.recoil || 0) * 2 + (a >= 4 ? 1.5 : 0);
      circle(c, 0, 0, orb); c.fillStyle = '#e8f7ff'; c.fill();
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
      // fenced field; crops, market buildings and the homestead grow with the paths
      const big = a >= 4 || b >= 4 || d >= 5;
      const R = big ? 22 : 19;
      c.fillStyle = SHADOW; c.fillRect(-R + 3, -R + 4, R * 2, R * 2);
      c.fillStyle = linear(c, -R, -R, R, R, [[0, '#7a5a38'], [1, '#4e3a24']]); c.fillRect(-R, -R, R * 2, R * 2);
      const rows = 4 + Math.min(3, a);
      const crop = a >= 5 ? '#e0b84a' : a >= 2 ? '#7aa83a' : '#5e8a30';
      for (let i = 0; i < rows; i++) {
        const yy = -R + 4 + (i * (R * 2 - 8)) / (rows - 1);
        c.strokeStyle = 'rgba(40,26,14,0.6)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-R + 3, yy); c.lineTo(R - 3, yy); c.stroke();
        for (let k = -R + 5; k < R - 3; k += 4) { circle(c, k, yy - 1, a >= 1 ? 1.9 : 1.5); c.fillStyle = crop; c.fill(); }
      }
      if (a >= 3) { c.fillStyle = 'rgba(210,235,240,0.45)'; c.fillRect(-R + 2, -R + 2, R - 3, R - 3); c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 0.8; c.strokeRect(-R + 2, -R + 2, R - 3, R - 3); c.beginPath(); c.moveTo(-R + 2, -R / 2); c.lineTo(-1, -R / 2); c.stroke(); }
      if (a >= 4) for (const [tx, ty] of [[R - 6, -R + 6], [R - 6, -R + 14], [R - 14, -R + 6]]) canopy(c, tx, ty, 4.5, '#2f5a22', '#5a8a3a', mulberry32(tx * 7 + ty), 5);
      if (a >= 5) { canister(c, R - 6, R - 7, 5, '#b8bcc0'); c.fillStyle = '#8a8e92'; c.fillRect(R - 8, R - 13, 4, 6); }
      // fence
      c.strokeStyle = d >= 5 ? '#6a6a64' : '#a88a5a'; c.lineWidth = d >= 5 ? 2.6 : 1.2;
      c.strokeRect(-R + 0.5, -R + 0.5, R * 2 - 1, R * 2 - 1);
      if (d >= 5) { c.fillStyle = '#5a5a54'; for (const [px, py] of [[-R, -R], [R, -R], [-R, R], [R, R]]) { c.fillRect(px - 3, py - 3, 6, 6); } }
      // barn, market and bank
      const bx = -R + 2, by = R - 12;
      c.fillStyle = b >= 3 ? '#9aa0a2' : '#8e3a2a'; c.fillRect(bx, by, 12, 10);
      c.fillStyle = b >= 3 ? '#d8d8d0' : '#5a2418'; c.beginPath(); c.moveTo(bx - 1, by); c.lineTo(bx + 6, by - 5); c.lineTo(bx + 13, by); c.closePath(); c.fill();
      if (b >= 3) { c.fillStyle = '#6a7072'; for (let k = 0; k < 3; k++) c.fillRect(bx + 2 + k * 3.5, by + 2, 1.2, 8); }
      if (b >= 5) { c.fillStyle = '#e3a83e'; c.fillRect(bx + 3, by + 3, 6, 4); }
      if (b >= 1) { c.fillStyle = '#3a2a1a'; c.fillRect(bx + 14, by + 5, 5, 4); }
      if (b >= 2) { for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#ece6d6' : '#c9483d'; c.fillRect(-2 + k * 3, R - 6, 3, 4); } }
      if (d >= 1) { circle(c, R - 7, 0, 3.4); c.fillStyle = '#6a6a64'; c.fill(); circle(c, R - 7, 0, 2); c.fillStyle = '#2f5d6b'; c.fill(); }
      if (d >= 3) { c.fillStyle = SHADOW; c.fillRect(-4, -9, 12, 12); c.fillStyle = '#7a5a38'; c.fillRect(-6, -11, 12, 12); c.strokeStyle = '#4e3a24'; c.lineWidth = 1; c.strokeRect(-6, -11, 12, 12); }
      if (d >= 4) { c.fillStyle = '#ece6d6'; c.fillRect(R - 12, -R + 3, 9, 7); c.fillStyle = '#c9483d'; c.fillRect(R - 8.5, -R + 4, 2, 5); c.fillRect(R - 10, -R + 5.5, 5, 2); }
      if (d >= 2) { // the farmer with a shotgun
        const shooters = d >= 4 ? [[0, -5], [-6, 6]] : [[0, -5]];
        for (const [sx, sy] of shooters) {
          c.save(); c.translate(sx, sy); c.rotate(ang);
          c.fillStyle = '#1d1f1c'; c.fillRect(2 - kick, -1, 12, 2);
          soldier(c, '#a88a4a', '#5a6a8a');
          c.restore();
        }
      }
      break;
    }
    case 'heli': case 'jet': {
      // landing pad stays on the tile; the aircraft is drawn separately
      circle(c, 2, 3, 17); c.fillStyle = SHADOW; c.fill();
      circle(c, 0, 0, 17); c.fillStyle = radial(c, 0, 0, 17, '#7d807a', '#4a4c48'); c.fill();
      c.strokeStyle = top >= 3 ? rgba(PATH_COLORS[tiers.indexOf(top)], 0.8) : 'rgba(230,220,180,0.75)'; c.lineWidth = 1.5; circle(c, 0, 0, 13); c.stroke();
      if (type === 'heli') label(c, d >= 4 ? '+' : 'H', 0, 0.5, 14, d >= 4 ? 'rgba(230,80,70,0.9)' : 'rgba(230,220,180,0.85)');
      else { c.strokeStyle = 'rgba(230,220,180,0.75)'; c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.moveTo(4, -4); c.lineTo(8, 0); c.lineTo(4, 4); c.stroke(); }
      if (d >= 3 && type === 'heli') { crate(c, 10, 8, 7, 6, '#6b5330'); crate(c, -16, 9, 6, 5, '#4c5538'); }
      if (type === 'jet' && d >= 3) { c.save(); c.translate(12, -12); c.rotate(t * 2); c.fillStyle = '#9aa0a6'; c.fillRect(-5, -1, 10, 2); c.restore(); }
      break;
    }
    case 'gunboat': {
      const bob = Math.sin(t * 2 + x) * 0.8;
      const k = a >= 5 || b >= 5 ? 1.3 : a >= 4 || b >= 4 ? 1.15 : 1;
      c.translate(0, bob);
      c.rotate(ang);
      c.scale(k, k);
      ellipse(c, -12, 0, 12, 7); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill();
      c.beginPath(); c.moveTo(20, 0); c.quadraticCurveTo(12, -10, -16, -9); c.lineTo(-18, 9); c.quadraticCurveTo(12, 10, 20, 0); c.closePath();
      const hull = b >= 4 ? ['#a59a7a', '#5c5440'] : a >= 4 ? ['#7c858b', '#3c4449'] : ['#8e969b', '#4c5459'];
      c.fillStyle = linear(c, 0, -10, 0, 10, [[0, hull[0]], [1, hull[1]]]); c.fill();
      if (b >= 4) { c.strokeStyle = '#d8b23a'; c.lineWidth = 0.8; c.stroke(); }
      // cargo for the trade path
      const boxes = [0, 1, 2, 3, 5, 6][b] || 0;
      const cols = ['#a8452e', '#2f6f8a', '#c79a2e', '#4f7a3a', '#7a4a8a', '#a8452e'];
      for (let i = 0; i < boxes; i++) { const bx = -15 + (i % 3) * 4.2, by = i < 3 ? -5 : 1; c.fillStyle = cols[i]; c.fillRect(bx, by, 3.8, 4.4); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(bx, by + 3.4, 3.8, 1); }
      if (!boxes) { c.fillStyle = '#5f676c'; rr(c, -12, -5, 12, 10, 2); c.fill(); }
      c.fillStyle = 'rgba(40,60,70,0.9)'; c.fillRect(-2, -4, 2, 8);
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
      const k = a >= 5 || b >= 5 || d >= 5 ? 1.25 : a >= 3 || d >= 3 ? 1.1 : 1;
      c.translate(0, bob);
      c.rotate(ang);
      c.scale(k, k);
      ellipse(c, 0, 0, 22, 7); c.fillStyle = 'rgba(10,20,25,0.45)'; c.fill();
      const hull = b >= 4 ? ['#4a4e52', '#1e2023'] : ['#3c464c', '#161c20'];
      ellipse(c, 0, 0, 19, 5.5); c.fillStyle = linear(c, 0, -6, 0, 6, [[0, hull[0]], [1, hull[1]]]); c.fill();
      if (b >= 2) { c.fillStyle = 'rgba(200,70,50,0.75)'; c.fillRect(-14, -0.6, 28, 1.2); }
      if (b >= 5) { c.strokeStyle = '#d8b23a'; c.lineWidth = 0.7; ellipse(c, 0, 0, 19, 5.5); c.stroke(); }
      rr(c, -2, -3, 9, 6, 2.5); c.fillStyle = '#2a3237'; c.fill();
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
  if (!opts.icon) { c.save(); c.translate(x, y); tierMarks(c, tiers, 14, 14); c.restore(); }
  if (tw.stun > 0) {
    c.save(); c.globalAlpha = 0.65;
    rr(c, x - 20, y - 20, 40, 40, 6); c.fillStyle = 'rgba(200,235,255,0.75)'; c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.stroke();
    c.restore();
  }
}

function drawHeli(c, tw, t, ax, ay) {
  const [a, b, d] = tw.tiers || [0, 0, 0];
  const k = a >= 5 ? 1.25 : 1;
  const body = d >= 5 ? ['#4a4e50', '#1c1e20'] : d >= 4 ? ['#d8d8d0', '#8a8a84'] : ['#6b7a52', '#2e3622'];
  c.save(); c.translate(ax + 12, ay + 18); c.rotate(tw.angle); c.scale(k, k);
  ellipse(c, 0, 0, 14, 6); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
  c.fillStyle = 'rgba(0,0,0,0.12)'; circle(c, 2, 0, 18); c.fill();
  c.restore();
  c.save(); c.translate(ax, ay); c.rotate(tw.angle); c.scale(k, k);
  c.fillStyle = shade(body[1], 0.15); c.fillRect(-22, -1.5, 14, 3);
  rr(c, -25, -4, 4, 8, 1); c.fill();
  // rocket pods and gun pods on stub wings
  if (b >= 1 || a >= 1) { c.fillStyle = '#2a2d26'; c.fillRect(-3, -11, 3, 22); }
  if (b >= 1) {
    const pods = b >= 5 ? [-13, -9, 9, 13] : b >= 3 ? [-12, -8, 8, 12] : [-9, 9];
    for (const o of pods) { c.fillStyle = '#2f322b'; rr(c, -4, o - 1.8, 9, 3.6, 1.5); c.fill(); c.fillStyle = b >= 3 ? '#c9483d' : '#9aa0a6'; c.fillRect(4, o - 1, 1.5, 2); }
  }
  if (a >= 1) for (const o of [-6.5, 6.5]) { c.fillStyle = '#1a1c18'; c.fillRect(-2, o - 1, a >= 3 ? 13 : 9, 2); }
  ellipse(c, 0, 0, 12, 6.5); c.fillStyle = radial(c, 0, 0, 12, body[0], body[1]); c.fill();
  if (d >= 4) { c.fillStyle = '#c9483d'; c.fillRect(-5, -1, 6, 2); c.fillRect(-3, -3, 2, 6); }
  if (d >= 5) { c.fillStyle = '#e3a83e'; c.fillRect(-9, -0.5, 18, 1); }
  ellipse(c, 6, 0, 5, 4); c.fillStyle = 'rgba(120,170,190,0.85)'; c.fill();
  if (d >= 1) { circle(c, 12, 0, 1.8); c.fillStyle = '#7dff8a'; c.fill(); }
  c.fillStyle = '#1a1c18'; c.fillRect(10, -1, a >= 4 ? 9 : 6, 2);
  // rotor blur and blades
  circle(c, 0, 0, 19); c.fillStyle = 'rgba(30,30,30,0.18)'; c.fill();
  c.rotate(t * 40);
  c.strokeStyle = 'rgba(20,20,20,0.7)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-19, 0); c.lineTo(19, 0); c.moveTo(0, -19); c.lineTo(0, 19); c.stroke();
  if (a >= 2) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(-19, 0); c.lineTo(19, 0); c.moveTo(0, -19); c.lineTo(0, 19); c.stroke(); }
  c.restore();
}
function drawJet(c, tw, px, py, angle, lights, lead, zoom = 1, sh = 1) {
  const [a, b, d] = tw.tiers || [0, 0, 0];
  const k = (b >= 5 ? 1.3 : b >= 4 ? 1.12 : 1) * zoom;
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
  c.fillStyle = linear(c, 0, -13, 0, 13, [[0, skin[0]], [0.5, skin[1]], [1, skin[2]]]); c.fill();
  if (top3(tw.tiers) >= 3) { c.fillStyle = PATH_COLORS[tw.tiers.indexOf(top3(tw.tiers))]; c.fillRect(-14, -6, 2, 3); c.fillRect(-14, 3, 2, 3); }
  ellipse(c, 6, 0, 4, 1.8); c.fillStyle = 'rgba(80,120,150,0.9)'; c.fill();
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

// Static icon of a tower for menus, the shop and the upgrade buttons.
function drawTowerIcon(c, type, tiers, size) {
  const k = size / 52;
  c.save(); c.scale(k, k);
  const tw = { type, tiers: tiers || [0, 0, 0], x: 26, y: 26, angle: -Math.PI / 4, recoil: 0, ax: 26, ay: 24 };
  if (type === 'gunboat' || type === 'sub') {
    c.fillStyle = '#2f5d6b'; rr(c, 2, 2, 48, 48, 8); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.08)'; rr(c, 2, 2, 48, 24, 8); c.fill();
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
