'use strict';
// ============================================================
// Floating globe for the world map. The planet is shaded per pixel from a procedural
// texture: oceans, coastlines, forests, deserts, ice caps and a separate cloud layer.
// ============================================================
const Globe = (() => {
  const TW = 768, TH = 384;
  const TILT = 0.38;
  let tex = null, clouds = null;
  let lut = null, lutN = 0, img = null, off = null, offCtx = null;
  let canvas = null, ctx = null, dpr = 1, cssSize = 0;
  let rot = 0, target = null, vel = 0, cloudRot = 0, running = false, last = 0;
  let selected = 0, drag = null, onPick = null, labels = [];

  const sph = (lat, lon) => [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
  function noise3(n, p, s) {
    return (n(p[0] * s + 3.1, p[1] * s + 7.7) + n(p[1] * s + 11.3, p[2] * s + 1.9) + n(p[2] * s + 5.5, p[0] * s + 13.1)) / 3;
  }
  function fbm3(n, p, s, oct) {
    let v = 0, a = 0.5, f = s, norm = 0;
    for (let i = 0; i < oct; i++) { v += a * noise3(n, p, f); norm += a; a *= 0.5; f *= 2.1; }
    return v / norm;
  }

  // The planet texture takes a moment to compute, so it is built a few rows at a time in the background.
  let built = 0, building = false;
  let nE, nM, nC, C;
  function prepare() {
    if (building || built >= TH) return;
    building = true;
    nE = makeNoise(4242); nM = makeNoise(777); nC = makeNoise(31337);
    tex = new Uint8ClampedArray(TW * TH * 3);
    clouds = new Uint8Array(TW * TH);
    const col = (h) => hexRgb(h);
    C = {
      deep: col('#0a2240'), shallow: col('#1d5a80'), beach: col('#b9a476'), grass: col('#4f6d33'),
      forest: col('#2c4422'), desert: col('#a88d5a'), rock: col('#6e675c'), snow: col('#e9eff3'), tundra: col('#7d8670'),
    };
    const step = () => {
      const end = Math.min(TH, built + 12);
      buildRows(built, end);
      built = end;
      if (built < TH) setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }
  function buildRows(y0, y1) {
    const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    for (let y = y0; y < y1; y++) {
      const lat = (0.5 - (y + 0.5) / TH) * Math.PI;
      const alat = Math.abs(lat) / (Math.PI / 2);
      for (let x = 0; x < TW; x++) {
        const lon = ((x + 0.5) / TW) * TAU - Math.PI;
        const p = sph(lat, lon);
        let e = fbm3(nE, p, 1.6, 6);
        e += (fbm3(nE, p, 0.7, 2) - 0.5) * 0.35;
        const m = fbm3(nM, p, 2.2, 4);
        let c;
        const sea = 0.5;
        if (e < sea) c = lerp3(C.deep, C.shallow, clamp((e - 0.3) / (sea - 0.3), 0, 1) ** 2);
        else {
          const h = (e - sea) / (1 - sea);
          if (h < 0.03) c = C.beach;
          else if (alat > 0.72 || h > 0.42) c = lerp3(C.rock, C.snow, clamp((alat - 0.72) * 6 + (h - 0.42) * 5, 0, 1));
          else if (alat > 0.58) c = lerp3(C.tundra, C.forest, clamp((0.72 - alat) * 6, 0, 1));
          else if (alat < 0.33 && m < 0.48) c = lerp3(C.desert, C.grass, clamp((m - 0.38) * 8, 0, 1));
          else c = lerp3(C.grass, C.forest, clamp((m - 0.45) * 5, 0, 1));
          c = lerp3(c, C.rock, clamp((h - 0.25) * 2, 0, 0.5));
        }
        if (alat > 0.88) c = lerp3(c, C.snow, clamp((alat - 0.88) * 10, 0, 1));
        const i = (y * TW + x) * 3;
        tex[i] = c[0]; tex[i + 1] = c[1]; tex[i + 2] = c[2];
        const cl = fbm3(nC, p, 2.6, 5);
        clouds[y * TW + x] = clamp((cl - 0.52) * 4, 0, 1) * 220;
      }
    }
  }

  // Per-pixel latitude, base longitude and lighting for a disk of n pixels.
  function buildLut(n) {
    lutN = n;
    const entries = [];
    const L = [-0.55, 0.45, 0.7]; const ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
    const ct = Math.cos(TILT), st = Math.sin(TILT);
    for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
      const nx = ((px + 0.5) / n) * 2 - 1, ny = 1 - ((py + 0.5) / n) * 2;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2);
      // un-tilt the view to get the point on the planet
      const y2 = ny * ct + nz * st, z2 = -ny * st + nz * ct;
      const lat = Math.asin(clamp(y2, -1, 1)), lon0 = Math.atan2(nx, z2);
      const lam = nx * L[0] + ny * L[1] + nz * L[2];
      const shade = clamp(0.08 + Math.max(0, lam) * 1.05, 0, 1.15);
      const edge = clamp((1 - Math.sqrt(r2)) * n * 0.5, 0, 1);
      const rim = Math.pow(1 - nz, 2.5);
      const spec = Math.pow(Math.max(0, lam), 24) * 0.35;
      const tyf = clamp((0.5 - lat / Math.PI) * TH - 0.5, 0, TH - 1);
      entries.push([py * n + px, Math.floor(tyf), tyf, lon0, shade, edge, rim, spec]);
    }
    lut = entries;
    img = new ImageData(n, n);
    off = document.createElement('canvas'); off.width = off.height = n;
    offCtx = off.getContext('2d');
  }

  function renderPlanet() {
    const d = img.data;
    d.fill(0);
    for (const [pi, ty, tyf, lon0, shade, edge, rim, spec] of lut) {
      let u = (lon0 + rot + Math.PI) / TAU; u -= Math.floor(u);
      // bilinear sample so coastlines stay smooth when magnified
      const fx = u * TW - 0.5, x0 = Math.floor(fx), ax = fx - x0;
      const xa = (x0 + TW) % TW, xb = (x0 + 1) % TW;
      const y0 = ty, yb = Math.min(TH - 1, ty + 1), ay = tyf - ty;
      const i00 = (y0 * TW + xa) * 3, i10 = (y0 * TW + xb) * 3, i01 = (yb * TW + xa) * 3, i11 = (yb * TW + xb) * 3;
      const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay;
      let r = tex[i00] * w00 + tex[i10] * w10 + tex[i01] * w01 + tex[i11] * w11;
      let g = tex[i00 + 1] * w00 + tex[i10 + 1] * w10 + tex[i01 + 1] * w01 + tex[i11 + 1] * w11;
      let b = tex[i00 + 2] * w00 + tex[i10 + 2] * w10 + tex[i01 + 2] * w01 + tex[i11 + 2] * w11;
      const water = b > r + 20 && b > g;
      let cu = (lon0 + cloudRot + Math.PI) / TAU; cu -= Math.floor(cu);
      const ca = clouds[ty * TW + Math.min(TW - 1, Math.floor(cu * TW))] / 255;
      r = lerp(r, 240, ca); g = lerp(g, 244, ca); b = lerp(b, 248, ca);
      r *= shade; g *= shade; b *= shade;
      if (water) { r += spec * 255; g += spec * 255; b += spec * 255; }
      r = lerp(r, 110, rim * 0.6); g = lerp(g, 170, rim * 0.6); b = lerp(b, 255, rim * 0.7);
      const o = pi * 4;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255 * edge;
    }
    offCtx.putImageData(img, 0, 0);
  }

  function project(lat, lon) {
    const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180 - rot;
    const x = Math.cos(la) * Math.sin(lo), y = Math.sin(la), z = Math.cos(la) * Math.cos(lo);
    const ct = Math.cos(TILT), st = Math.sin(TILT);
    const vy = y * ct - z * st, vz = y * st + z * ct;
    return { x, y: vy, z: vz };
  }


  // ============================================================
  // Wonders: animated landmarks pinned to the planet, plus a moon, meteors and comets.
  // Tap one to read about it; the ones you have found are remembered.
  // ============================================================
  const FOUND_KEY = 'zbash.wonders';
  let found = new Set();
  try { found = new Set(JSON.parse(store.get(FOUND_KEY)) || []); } catch (e) { found = new Set(); }
  let inspect = null, wonderHits = [], meteors = [], impacts = [], meteorT = 2, cometT = 9, placed = false;

  // lat/lon is where each wonder would like to be; it moves to the nearest land or sea it needs.
  const WONDERS = [
    { id: 'cinder', name: 'Mount Cinder', lore: 'A volcano that has not stopped erupting since the outbreak began.', lat: -12, lon: 32, want: 'land', kind: 'volcano' },
    { id: 'ashen', name: 'The Ashen Peaks', lore: 'Twin craters whose lava lights the sky for a hundred miles.', lat: 48, lon: -128, want: 'land', kind: 'volcano' },
    { id: 'wildfire', name: 'The Burning Wastes', lore: 'Forests that caught fire in the first week and never went out.', lat: 18, lon: 70, want: 'land', kind: 'fire' },
    { id: 'emberwood', name: 'Emberwood', lore: 'Smoke rises from the trees here all year round.', lat: -30, lon: -58, want: 'land', kind: 'fire' },
    { id: 'dinos', name: 'Dino Valley', lore: 'Something in the outbreak woke the old giants. They want nothing to do with zombies.', lat: -4, lon: 112, want: 'land', kind: 'dinos' },
    { id: 'raptors', name: 'Raptor Plains', lore: 'Packs of raptors hunt the walking dead across the grass.', lat: 28, lon: -40, want: 'land', kind: 'raptors' },
    { id: 'pteros', name: 'Pterosaur Cliffs', lore: 'Winged reptiles circle the sea cliffs, keeping crows away.', lat: -42, lon: 150, want: 'land', kind: 'pteros' },
    { id: 'starfall', name: 'Starfall Crater', lore: 'Where the green meteor struck. Some say it started everything.', lat: 8, lon: -10, want: 'land', kind: 'crater' },
    { id: 'spires', name: 'Crystal Spires', lore: 'Floating crystals that hum when the dead come near.', lat: 40, lon: 140, want: 'land', kind: 'crystals' },
    { id: 'rift', name: 'The Rift', lore: 'A tear in the sky. Wraiths drift out of it on cold nights.', lat: 60, lon: -30, want: 'land', kind: 'rift' },
    { id: 'stones', name: 'Circle of Runes', lore: 'Ancient stones whose runes glow brighter as each sector is saved.', lat: 55, lon: 40, want: 'land', kind: 'stones' },
    { id: 'kraken', name: 'The Deep One', lore: 'A kraken that drags zombie ships under the waves.', lat: -20, lon: -150, want: 'sea', kind: 'kraken' },
    { id: 'ghostship', name: 'The Ghost Ship', lore: 'A crewless galleon that sails the southern sea forever.', lat: -38, lon: 70, want: 'sea', kind: 'ship' },
    { id: 'eldertree', name: 'The Elder Tree', lore: 'A tree older than any city. Nothing undead can touch its roots.', lat: 12, lon: -75, want: 'land', kind: 'tree' },
    { id: 'skyhold', name: 'Skyhold', lore: 'A floating island where the last survivors keep their seed vault.', lat: -52, lon: -10, want: 'land', kind: 'island' },
    { id: 'dragon', name: 'The Red Dragon', lore: 'It circles its mountain and burns any horde that comes too close.', lat: 32, lon: 92, want: 'land', kind: 'dragon' },
    { id: 'temple', name: 'Sun Temple', lore: 'Its beam of light can be seen from orbit.', lat: 24, lon: 18, want: 'land', kind: 'temple' },
    { id: 'ufo', name: 'Visitors', lore: 'Nobody knows what they want, but they keep taking cows.', lat: -24, lon: 130, want: 'land', kind: 'ufo' },
    { id: 'moonwell', name: 'The Moonwell', lore: 'A glowing pool said to heal anything still alive.', lat: -10, lon: -128, want: 'land', kind: 'well' },
    { id: 'zero', name: 'Ground Zero', lore: 'The lab where the infection began. Green fog still pours out.', lat: 44, lon: -100, want: 'land', kind: 'zero' },
  ];
  const isWater = (i) => tex[i + 2] > tex[i] + 20 && tex[i + 2] > tex[i + 1];
  const texIndex = (lat, lon) => {
    const x = Math.floor((((lon + 180) % 360 + 360) % 360) / 360 * TW), y = clamp(Math.floor((0.5 - lat / 180) * TH), 0, TH - 1);
    return (y * TW + x) * 3;
  };
  // move each wonder to the nearest spot of land or sea, away from the polar ice
  function placeWonders() {
    placed = true;
    for (const w of WONDERS) {
      let best = null;
      for (let r = 0; r <= 45 && !best; r += 3) {
        for (let k = 0; k < Math.max(1, r * 2); k++) {
          const q = (k / Math.max(1, r * 2)) * TAU, la = clamp(w.lat + Math.sin(q) * r, -66, 66), lo = w.lon + Math.cos(q) * r;
          if (isWater(texIndex(la, lo)) === (w.want === 'sea')) { best = [la, lo]; break; }
        }
      }
      if (best) { w.lat = best[0]; w.lon = best[1]; }
    }
  }
  function markFound(w) {
    if (found.has(w.id)) return;
    found.add(w.id);
    store.set(FOUND_KEY, JSON.stringify([...found]));
    if (Globe.onFind) Globe.onFind(found.size, WONDERS.length);
  }

  // ---------- drawing helpers (screen space, u = one unit scaled to the planet) ----------
  const rg = (c, x, y, r, a, b) => { const g = c.createRadialGradient(x, y, 0, x, y, Math.max(0.1, r)); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const glow = (c, x, y, r, col, a) => { c.fillStyle = rg(c, x, y, r, `rgba(${col},${a})`, `rgba(${col},0)`); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
  function flame(c, x, y, h, t, seed) {
    const f = 1 + Math.sin(t * 9 + seed) * 0.12 + Math.sin(t * 15 + seed * 2) * 0.08;
    const hh = h * f, w = h * 0.42;
    c.beginPath(); c.moveTo(x - w, y);
    c.quadraticCurveTo(x - w * 1.1, y - hh * 0.55, x + Math.sin(t * 6 + seed) * w * 0.4, y - hh);
    c.quadraticCurveTo(x + w * 1.1, y - hh * 0.55, x + w, y);
    c.closePath();
    const g = c.createLinearGradient(x, y, x, y - hh);
    g.addColorStop(0, 'rgba(255,240,170,0.95)'); g.addColorStop(0.35, 'rgba(255,150,40,0.95)'); g.addColorStop(1, 'rgba(200,40,20,0)');
    c.fillStyle = g; c.fill();
  }
  function smoke(c, x, y, u, t, n, col = '70,64,60', rise = 14) {
    for (let i = 0; i < n; i++) {
      const k = (t * 0.25 + i / n) % 1;
      c.fillStyle = `rgba(${col},${0.45 * (1 - k)})`;
      c.beginPath(); c.arc(x + Math.sin(i * 2 + t * 0.5) * u * 2 + k * u * 3, y - k * u * rise, u * (1.2 + k * 2.5), 0, TAU); c.fill();
    }
  }
  function dino(c, u, kind, step) {
    const leg = Math.sin(step) * u * 0.8;
    c.fillStyle = kind === 'rex' ? '#5a4a2e' : kind === 'raptor' ? '#7a5a34' : '#5e6a3a';
    if (kind === 'brachio') {
      c.beginPath(); c.ellipse(0, -3 * u, 4 * u, 2.2 * u, 0, 0, TAU); c.fill();
      c.lineWidth = 1.4 * u; c.strokeStyle = c.fillStyle; c.lineCap = 'round';
      c.beginPath(); c.moveTo(3 * u, -4 * u); c.quadraticCurveTo(5 * u, -9 * u, 6.5 * u, -10 * u); c.stroke();
      c.beginPath(); c.arc(6.8 * u, -10.2 * u, 0.9 * u, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(-3.5 * u, -3 * u); c.quadraticCurveTo(-7 * u, -2.5 * u, -8 * u, -1 * u); c.lineWidth = 0.9 * u; c.stroke();
      c.lineWidth = 0.9 * u;
      for (const [lx, ph] of [[-2.5, 1], [2.5, -1], [-1.5, -1], [1.5, 1]]) { c.beginPath(); c.moveTo(lx * u, -2 * u); c.lineTo(lx * u + leg * ph * 0.4, 0); c.stroke(); }
    } else {
      const k = kind === 'raptor' ? 0.6 : 1;
      c.save(); c.scale(k, k);
      c.beginPath(); c.ellipse(0, -4 * u, 3 * u, 1.8 * u, -0.25, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(-2.5 * u, -4.5 * u); c.lineTo(-7.5 * u, -3.2 * u); c.lineTo(-2.5 * u, -3.2 * u); c.fill();
      c.beginPath(); c.ellipse(3.2 * u, -6.2 * u, 1.7 * u, 1.1 * u, 0.2, 0, TAU); c.fill();
      c.lineWidth = 0.9 * u; c.strokeStyle = c.fillStyle; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-0.5 * u, -3 * u); c.lineTo(-0.8 * u + leg, 0); c.moveTo(0.8 * u, -3 * u); c.lineTo(0.6 * u - leg, 0); c.stroke();
      c.fillStyle = '#f2d27a'; c.beginPath(); c.arc(3.8 * u, -6.5 * u, 0.3 * u, 0, TAU); c.fill();
      c.restore();
    }
  }
  function ptero(c, u, flap) {
    c.strokeStyle = '#3a2c22'; c.lineWidth = 0.8 * u; c.lineCap = 'round'; c.lineJoin = 'round';
    const wy = Math.sin(flap) * 1.6 * u;
    c.beginPath(); c.moveTo(-4 * u, wy); c.lineTo(-1.5 * u, -0.5 * u); c.lineTo(0, 0); c.lineTo(1.5 * u, -0.5 * u); c.lineTo(4 * u, wy); c.stroke();
    c.fillStyle = '#3a2c22'; c.beginPath(); c.moveTo(0, 0); c.lineTo(1.6 * u, 0.6 * u); c.lineTo(0, 0.9 * u); c.fill();
  }
  function crystal(c, x, y, h, col) {
    c.beginPath(); c.moveTo(x, y - h); c.lineTo(x + h * 0.3, y - h * 0.55); c.lineTo(x, y); c.lineTo(x - h * 0.3, y - h * 0.55); c.closePath();
    const g = c.createLinearGradient(x - h * 0.3, y - h, x + h * 0.3, y);
    g.addColorStop(0, `rgba(${col},0.95)`); g.addColorStop(1, `rgba(${col},0.45)`);
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x, y - h); c.lineTo(x, y); c.stroke();
  }

  function drawWonder(c, w, x, y, u, t) {
    switch (w.kind) {
      case 'volcano': {
        glow(c, x, y - 6 * u, 16 * u, '255,110,40', 0.35);
        c.beginPath(); c.moveTo(x - 9 * u, y); c.lineTo(x - 2.4 * u, y - 8 * u); c.lineTo(x + 2.4 * u, y - 8 * u); c.lineTo(x + 9 * u, y); c.closePath();
        const g = c.createLinearGradient(x - 9 * u, y - 8 * u, x + 9 * u, y); g.addColorStop(0, '#5a4a40'); g.addColorStop(1, '#1e1814');
        c.fillStyle = g; c.fill();
        c.strokeStyle = 'rgba(255,120,40,0.9)'; c.lineWidth = 0.9 * u; c.lineCap = 'round';
        for (const [sx, ex] of [[-1.5, -4.5], [1, 3.5], [0, 0.5]]) { c.beginPath(); c.moveTo(x + sx * u, y - 7.8 * u); c.quadraticCurveTo(x + (sx + ex) * 0.5 * u, y - 4 * u, x + ex * u, y - 1 * u); c.stroke(); }
        c.fillStyle = rg(c, x, y - 8 * u, 3 * u, 'rgba(255,230,140,1)', 'rgba(255,90,20,0)'); c.beginPath(); c.ellipse(x, y - 8 * u, 3 * u, 1.2 * u, 0, 0, TAU); c.fill();
        smoke(c, x, y - 9 * u, u, t, 6);
        for (let i = 0; i < 5; i++) {
          const k = (t * 0.8 + i / 5) % 1, dir = (i % 2 ? 1 : -1) * (1 + i * 0.4);
          c.fillStyle = `rgba(255,${150 + i * 15},60,${1 - k})`;
          c.beginPath(); c.arc(x + dir * k * 4 * u, y - 8 * u - Math.sin(k * Math.PI) * 7 * u, 0.6 * u, 0, TAU); c.fill();
        }
        break;
      }
      case 'fire': {
        glow(c, x, y - 3 * u, 14 * u, '255,120,40', 0.35);
        const spots = [[-5, 0, 5], [-1, -1.5, 7], [3, 0.5, 6], [6, -1, 4], [-3, 1.5, 4], [1, 2, 3.5]];
        smoke(c, x, y - 7 * u, u, t, 4, '50,46,44');
        spots.forEach(([dx, dy, h], i) => flame(c, x + dx * u, y + dy * u, h * u, t, i * 1.7));
        break;
      }
      case 'dinos': case 'raptors': {
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x, y, 10 * u, 2 * u, 0, 0, TAU); c.fill();
        const herd = w.kind === 'dinos' ? [['brachio', -4, 0, 0.9], ['rex', 5, 1, 0.8]] : [['raptor', -4, 0, 1], ['raptor', 1, 1, 1], ['raptor', 5, -0.5, 1]];
        herd.forEach(([k, dx, dy, sc], i) => {
          const sp = w.kind === 'raptors' ? 2.2 : 0.7, ph = t * sp + i * 2;
          const off = Math.sin(ph * 0.3) * 3 * u, face = Math.cos(ph * 0.3) >= 0 ? 1 : -1;
          c.save(); c.translate(x + dx * u + off, y + dy * u); c.scale(face * sc, sc); dino(c, u, k, ph * 4); c.restore();
        });
        break;
      }
      case 'pteros': {
        c.fillStyle = '#6a5a48'; c.beginPath(); c.moveTo(x - 6 * u, y); c.lineTo(x - 2 * u, y - 6 * u); c.lineTo(x + 1 * u, y - 5 * u); c.lineTo(x + 6 * u, y); c.fill();
        for (let i = 0; i < 3; i++) {
          const q = t * 0.8 + i * 2.1, px = x + Math.cos(q) * 9 * u, py = y - 10 * u + Math.sin(q) * 3 * u;
          c.save(); c.translate(px, py); ptero(c, u * 0.9, t * 8 + i); c.restore();
        }
        break;
      }
      case 'crater': {
        c.fillStyle = 'rgba(20,24,18,0.85)'; c.beginPath(); c.ellipse(x, y, 7 * u, 3 * u, 0, 0, TAU); c.fill();
        c.strokeStyle = `rgba(120,255,120,${0.5 + Math.sin(t * 2) * 0.2})`; c.lineWidth = 1 * u; c.stroke();
        glow(c, x, y - 1 * u, 12 * u, '110,255,110', 0.3 + Math.sin(t * 2) * 0.1);
        for (const [dx, h] of [[-3, 4], [0, 6], [2.5, 3.5], [-1, 3]]) crystal(c, x + dx * u, y, h * u, '120,255,130');
        break;
      }
      case 'crystals': {
        glow(c, x, y - 8 * u, 15 * u, '190,120,255', 0.3);
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x, y, 7 * u, 1.6 * u, 0, 0, TAU); c.fill();
        [[-4, 8, 0], [0, 12, 1.3], [4, 7, 2.6]].forEach(([dx, h, ph]) => crystal(c, x + dx * u, y - 3 * u - Math.sin(t * 1.6 + ph) * 1.5 * u, h * u * 0.7, '200,140,255'));
        for (let i = 0; i < 6; i++) { const q = t * 1.2 + i; c.fillStyle = `rgba(230,200,255,${0.5 + Math.sin(t * 4 + i) * 0.4})`; c.beginPath(); c.arc(x + Math.cos(q) * 8 * u, y - 6 * u + Math.sin(q) * 3 * u, 0.5 * u, 0, TAU); c.fill(); }
        break;
      }
      case 'rift': {
        glow(c, x, y - 7 * u, 16 * u, '230,80,255', 0.35);
        c.save(); c.translate(x, y - 7 * u);
        c.fillStyle = 'rgba(20,0,30,0.9)'; c.beginPath(); c.ellipse(0, 0, 3.2 * u, 6 * u, 0, 0, TAU); c.fill();
        for (let i = 0; i < 5; i++) {
          c.strokeStyle = i % 2 ? `rgba(120,220,255,${0.7 - i * 0.1})` : `rgba(240,110,255,${0.8 - i * 0.1})`; c.lineWidth = 0.8 * u;
          c.beginPath(); c.ellipse(0, 0, (3.4 + i * 0.7) * u, (6.2 + i * 0.9) * u, 0, t * (1.5 + i * 0.3) + i, t * (1.5 + i * 0.3) + i + 3.6); c.stroke();
        }
        for (let i = 0; i < 6; i++) { const k = (t * 0.5 + i / 6) % 1, q = i * 1.05 + t; c.fillStyle = `rgba(250,200,255,${1 - k})`; c.beginPath(); c.arc(Math.cos(q) * k * 10 * u, Math.sin(q) * k * 10 * u, 0.5 * u, 0, TAU); c.fill(); }
        c.restore();
        break;
      }
      case 'stones': {
        const p = 0.5 + Math.sin(t * 1.5) * 0.5;
        glow(c, x, y - 2 * u, 12 * u, '110,220,255', 0.15 + p * 0.2);
        c.fillStyle = `rgba(140,230,255,${0.15 + p * 0.2})`; c.fillRect(x - 0.6 * u, y - 18 * u, 1.2 * u, 18 * u);
        for (let i = 0; i < 7; i++) {
          const q = (i / 7) * TAU, sx = x + Math.cos(q) * 7 * u, sy = y + Math.sin(q) * 2.4 * u;
          c.fillStyle = '#6a6c6a'; c.fillRect(sx - 1 * u, sy - 4 * u, 2 * u, 4 * u);
          c.fillStyle = `rgba(140,230,255,${0.4 + p * 0.6})`; c.fillRect(sx - 0.4 * u, sy - 3 * u, 0.8 * u, 0.8 * u);
        }
        break;
      }
      case 'kraken': {
        for (let i = 0; i < 3; i++) { const k = (t * 0.4 + i / 3) % 1; c.strokeStyle = `rgba(200,230,255,${0.5 * (1 - k)})`; c.lineWidth = 0.6; c.beginPath(); c.ellipse(x, y, (3 + k * 9) * u, (1 + k * 3) * u, 0, 0, TAU); c.stroke(); }
        c.strokeStyle = '#7a2a4a'; c.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          const bx = x + (i - 1.5) * 3.2 * u, h = (6 + Math.sin(t * 1.7 + i * 1.3) * 2.5) * u, curl = Math.sin(t * 1.3 + i) * 3 * u;
          c.lineWidth = 1.4 * u;
          c.beginPath(); c.moveTo(bx, y); c.quadraticCurveTo(bx + curl, y - h * 0.6, bx + curl * 0.4 + (i % 2 ? 2 : -2) * u, y - h); c.stroke();
          c.lineWidth = 0.5 * u; c.strokeStyle = '#d88aa8'; c.stroke(); c.strokeStyle = '#7a2a4a';
        }
        break;
      }
      case 'ship': {
        glow(c, x, y - 4 * u, 12 * u, '150,255,200', 0.2);
        c.globalAlpha *= 0.65 + Math.sin(t * 1.4) * 0.2;
        c.save(); c.translate(x, y + Math.sin(t * 2) * 0.5 * u);
        c.fillStyle = 'rgba(160,240,210,0.75)';
        c.beginPath(); c.moveTo(-6 * u, -2 * u); c.lineTo(6 * u, -2 * u); c.lineTo(4 * u, 0.5 * u); c.lineTo(-4.5 * u, 0.5 * u); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(160,240,210,0.8)'; c.lineWidth = 0.5 * u;
        for (const mx of [-2, 2]) {
          c.beginPath(); c.moveTo(mx * u, -2 * u); c.lineTo(mx * u, -10 * u); c.stroke();
          c.fillStyle = 'rgba(200,255,230,0.55)'; c.beginPath(); c.moveTo(mx * u, -9.5 * u); c.quadraticCurveTo((mx + 3 + Math.sin(t * 2) * 0.6) * u, -7 * u, mx * u, -4 * u); c.closePath(); c.fill();
        }
        c.restore();
        break;
      }
      case 'tree': {
        glow(c, x, y - 9 * u, 15 * u, '255,220,120', 0.3);
        c.fillStyle = '#4a3422'; c.beginPath(); c.moveTo(x - 1.6 * u, y); c.lineTo(x - 0.8 * u, y - 8 * u); c.lineTo(x + 0.8 * u, y - 8 * u); c.lineTo(x + 1.6 * u, y); c.fill();
        for (const [dx, dy, r] of [[0, -12, 5], [-4, -9.5, 3.6], [4, -9.5, 3.6], [-2.4, -14, 3.2], [2.6, -14, 3.2]]) { c.fillStyle = rg(c, x + dx * u, y + dy * u, r * u, '#c8d86a', '#3a6a2a'); c.beginPath(); c.arc(x + dx * u, y + dy * u, r * u, 0, TAU); c.fill(); }
        for (let i = 0; i < 6; i++) { const k = (t * 0.3 + i / 6) % 1; c.fillStyle = `rgba(255,240,160,${1 - k})`; c.beginPath(); c.arc(x + Math.sin(i * 2.5 + t) * 6 * u, y - 6 * u - k * 12 * u, 0.5 * u, 0, TAU); c.fill(); }
        break;
      }
      case 'island': {
        const hov = Math.sin(t * 1.2) * 1.2 * u, iy = y - 10 * u + hov;
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x, y, 6 * u, 1.6 * u, 0, 0, TAU); c.fill();
        c.fillStyle = '#5a4a3a'; c.beginPath(); c.moveTo(x - 6 * u, iy); c.lineTo(x + 6 * u, iy); c.lineTo(x + 1 * u, iy + 6 * u); c.lineTo(x - 1.5 * u, iy + 5 * u); c.closePath(); c.fill();
        c.fillStyle = '#5a8a3a'; c.beginPath(); c.ellipse(x, iy, 6 * u, 1.4 * u, 0, 0, TAU); c.fill();
        c.fillStyle = '#d8d0c0'; c.fillRect(x - 1 * u, iy - 3 * u, 2.4 * u, 2.4 * u); c.fillStyle = '#8a3a2a'; c.beginPath(); c.moveTo(x - 1.4 * u, iy - 3 * u); c.lineTo(x + 0.2 * u, iy - 4.6 * u); c.lineTo(x + 1.8 * u, iy - 3 * u); c.fill();
        c.strokeStyle = `rgba(170,220,255,${0.6 + Math.sin(t * 6) * 0.2})`; c.lineWidth = 0.7 * u; c.beginPath(); c.moveTo(x + 4 * u, iy + 0.5 * u); c.lineTo(x + 4.4 * u, y - 1 * u); c.stroke();
        break;
      }
      case 'dragon': {
        c.fillStyle = '#4a3a34'; c.beginPath(); c.moveTo(x - 7 * u, y); c.lineTo(x - 1 * u, y - 7 * u); c.lineTo(x + 7 * u, y); c.fill();
        const q = t * 0.7, dx = x + Math.cos(q) * 11 * u, dy = y - 11 * u + Math.sin(q) * 3.5 * u, face = -Math.sin(q) >= 0 ? 1 : -1;
        c.save(); c.translate(dx, dy); c.scale(face, 1);
        const flap = Math.sin(t * 7) * 2.5 * u;
        c.fillStyle = '#a8302a';
        c.beginPath(); c.moveTo(-1 * u, 0); c.lineTo(-3 * u, -3 * u - flap); c.lineTo(1 * u, -0.5 * u); c.fill();
        c.beginPath(); c.ellipse(0, 0, 3 * u, 1 * u, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(-3 * u, 0); c.lineTo(-6 * u, 0.6 * u); c.lineTo(-3 * u, 0.6 * u); c.fill();
        c.beginPath(); c.arc(3.2 * u, -0.4 * u, 0.9 * u, 0, TAU); c.fill();
        if (Math.sin(t * 0.9) > 0.55) for (let i = 0; i < 6; i++) { const k = (t * 3 + i / 6) % 1; c.fillStyle = `rgba(255,${180 - i * 15},60,${1 - k})`; c.beginPath(); c.arc((4 + k * 6) * u, (k * 2.5) * u, (0.6 + k * 0.8) * u, 0, TAU); c.fill(); }
        c.restore();
        break;
      }
      case 'temple': {
        const p = 0.6 + Math.sin(t * 2) * 0.25;
        c.fillStyle = `rgba(255,230,150,${0.25 * p})`; c.beginPath(); c.moveTo(x - 1.2 * u, y - 7 * u); c.lineTo(x + 1.2 * u, y - 7 * u); c.lineTo(x + 3 * u, y - 26 * u); c.lineTo(x - 3 * u, y - 26 * u); c.fill();
        c.beginPath(); c.moveTo(x - 7 * u, y); c.lineTo(x, y - 7.5 * u); c.lineTo(x + 7 * u, y); c.closePath();
        const g = c.createLinearGradient(x - 7 * u, 0, x + 7 * u, 0); g.addColorStop(0, '#d8b878'); g.addColorStop(0.5, '#b8945a'); g.addColorStop(1, '#7a5a34'); c.fillStyle = g; c.fill();
        glow(c, x, y - 7 * u, 4 * u, '255,240,170', p);
        break;
      }
      case 'ufo': {
        const hov = Math.sin(t * 1.8) * 1 * u, uy = y - 11 * u + hov;
        c.fillStyle = `rgba(160,255,200,${0.18 + Math.sin(t * 5) * 0.06})`; c.beginPath(); c.moveTo(x - 1.6 * u, uy); c.lineTo(x + 1.6 * u, uy); c.lineTo(x + 4 * u, y); c.lineTo(x - 4 * u, y); c.fill();
        c.fillStyle = '#e8e4da'; c.beginPath(); c.ellipse(x - 0.5 * u, y - 1 * u - ((t * 0.3) % 1) * 8 * u, 1.2 * u, 0.7 * u, 0, 0, TAU); c.fill();
        c.fillStyle = '#9aa4ac'; c.beginPath(); c.ellipse(x, uy, 5 * u, 1.4 * u, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(150,230,255,0.85)'; c.beginPath(); c.ellipse(x, uy - 1 * u, 2.2 * u, 1.4 * u, 0, Math.PI, TAU); c.fill();
        for (let i = 0; i < 5; i++) { c.fillStyle = Math.sin(t * 6 + i) > 0 ? '#ffe070' : '#ff6a5a'; c.beginPath(); c.arc(x + (i - 2) * 2 * u, uy + 0.4 * u, 0.4 * u, 0, TAU); c.fill(); }
        break;
      }
      case 'well': {
        glow(c, x, y - 1 * u, 11 * u, '150,200,255', 0.35 + Math.sin(t * 1.5) * 0.1);
        c.fillStyle = '#7a7a74'; c.beginPath(); c.ellipse(x, y, 6 * u, 2.4 * u, 0, 0, TAU); c.fill();
        c.fillStyle = rg(c, x, y, 5 * u, 'rgba(230,245,255,1)', 'rgba(80,150,255,0.9)'); c.beginPath(); c.ellipse(x, y, 4.8 * u, 1.8 * u, 0, 0, TAU); c.fill();
        for (let i = 0; i < 5; i++) { const k = (t * 0.35 + i / 5) % 1; c.fillStyle = `rgba(200,230,255,${1 - k})`; c.beginPath(); c.arc(x + Math.sin(i * 3 + t) * 3 * u, y - k * 10 * u, 0.45 * u, 0, TAU); c.fill(); }
        break;
      }
      case 'zero': {
        smoke(c, x, y - 3 * u, u, t, 7, '110,200,80', 12);
        c.fillStyle = '#5a6066'; c.fillRect(x - 4 * u, y - 4 * u, 8 * u, 4 * u);
        c.fillStyle = '#3a4046'; c.fillRect(x - 1.5 * u, y - 7 * u, 3 * u, 3 * u);
        c.fillStyle = `rgba(140,255,100,${0.6 + Math.sin(t * 7) * 0.3})`; c.fillRect(x - 3 * u, y - 3 * u, 1.2 * u, 1 * u); c.fillRect(x + 1.8 * u, y - 3 * u, 1.2 * u, 1 * u);
        glow(c, x, y - 2 * u, 12 * u, '120,255,90', 0.22);
        break;
      }
    }
  }

  // ---------- aurora, moon, meteors ----------
  function drawAurora(c, cx, cy, R, t) {
    // curtains of light rays around the north pole, shimmering as they ripple
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (const [lat, col, amp, len] of [[70, '90,255,170', 2.4, 0.1], [75, '170,120,255', 1.8, 0.07]]) {
      for (let lon = -180; lon < 180; lon += 3) {
        const p = project(lat + Math.sin(lon / 16 + t * 0.7) * amp, lon);
        if (p.z < 0.1) continue;
        const x = cx + p.x * R, y = cy - p.y * R;
        const h = R * len * (0.5 + 0.5 * Math.sin(lon * 0.9 + t * 2.3)) * (0.6 + 0.4 * p.z);
        const a = p.z * (0.18 + 0.12 * Math.sin(lon / 9 + t * 1.6));
        const g = c.createLinearGradient(x, y, x, y - h);
        g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
        c.strokeStyle = g; c.lineWidth = R * 0.012;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - h); c.stroke();
      }
    }
    c.restore();
  }
  function moonPos(cx, cy, R, t) {
    // a tilted orbit: it passes in front below the planet and behind it above
    const a = t * 0.12, front = Math.sin(a) > 0;
    return { x: cx + Math.cos(a) * R * 1.42, y: cy + Math.sin(a) * R * 1.08, front, r: R * (front ? 0.085 : 0.07) };
  }
  function drawMoon(c, m) {
    c.fillStyle = rg(c, m.x - m.r * 0.3, m.y - m.r * 0.3, m.r * 1.4, '#e8e6de', '#6a6c70'); c.beginPath(); c.arc(m.x, m.y, m.r, 0, TAU); c.fill();
    c.fillStyle = 'rgba(80,80,86,0.45)';
    for (const [dx, dy, r] of [[-0.3, -0.2, 0.22], [0.35, 0.1, 0.16], [-0.05, 0.4, 0.13], [0.2, -0.45, 0.1]]) { c.beginPath(); c.arc(m.x + dx * m.r, m.y + dy * m.r, r * m.r, 0, TAU); c.fill(); }
    glow(c, m.x, m.y, m.r * 2, '220,230,255', 0.12);
  }
  function spawnMeteor(S, cx, cy, R) {
    const fromLeft = Math.random() < 0.5;
    const sx = fromLeft ? -20 : S + 20, sy = Math.random() * S * 0.4;
    const hits = Math.random() < 0.55;
    let lat = 0, lon = 0, tx, ty;
    if (hits) {
      lat = rand(-50, 50); lon = (rot * 180) / Math.PI + rand(-50, 50);
      const p = project(lat, lon); tx = cx + p.x * R; ty = cy - p.y * R;
      if (p.z < 0.3) return;
    } else { tx = fromLeft ? S + 40 : -40; ty = sy + rand(S * 0.2, S * 0.6); }
    const green = Math.random() < 0.25;
    meteors.push({ x: sx, y: sy, sx, sy, tx, ty, k: 0, speed: rand(0.5, 0.8), hits, lat, lon, green });
  }
  function drawSpace(c, S, cx, cy, R, dt, t) {
    meteorT -= dt; cometT -= dt;
    if (meteorT <= 0) { meteorT = rand(1.5, 4); spawnMeteor(S, cx, cy, R); }
    if (cometT <= 0) { cometT = rand(14, 24); meteors.push({ comet: true, x: -60, y: rand(S * 0.05, S * 0.3), vx: S * 0.12, vy: S * 0.02, life: 12 }); }
    for (const m of meteors) {
      if (m.comet) {
        m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt;
        const g = c.createLinearGradient(m.x, m.y, m.x - 90, m.y - 16); g.addColorStop(0, 'rgba(200,230,255,0.7)'); g.addColorStop(1, 'rgba(200,230,255,0)');
        c.strokeStyle = g; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(m.x - 90, m.y - 16); c.stroke();
        glow(c, m.x, m.y, 7, '230,245,255', 0.9);
        continue;
      }
      const prevx = m.x, prevy = m.y;
      m.k = Math.min(1, m.k + dt * m.speed);
      m.x = lerp(m.sx, m.tx, m.k); m.y = lerp(m.sy, m.ty, m.k);
      const col = m.green ? '140,255,120' : '255,190,110';
      const ang = Math.atan2(m.y - prevy, m.x - prevx), tl = 26;
      const g = c.createLinearGradient(m.x, m.y, m.x - Math.cos(ang) * tl, m.y - Math.sin(ang) * tl);
      g.addColorStop(0, `rgba(${col},0.95)`); g.addColorStop(1, `rgba(${col},0)`);
      c.strokeStyle = g; c.lineWidth = 2.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(m.x - Math.cos(ang) * tl, m.y - Math.sin(ang) * tl); c.stroke();
      glow(c, m.x, m.y, 5, col, 0.9);
      if (m.k >= 1) {
        m.done = true;
        if (m.hits) { impacts.push({ lat: m.lat, lon: m.lon, age: 0, green: m.green }); if (typeof Sound !== 'undefined') Sound.play('thud'); }
      }
    }
    meteors = meteors.filter((m) => !m.done && (!m.comet || m.life > 0));
  }
  function drawImpacts(c, cx, cy, R, dt, t) {
    for (const im of impacts) {
      im.age += dt;
      const p = project(im.lat, im.lon);
      if (p.z < 0.05) continue;
      const x = cx + p.x * R, y = cy - p.y * R, u = (R / 70) * (0.55 + 0.45 * p.z), fade = clamp(1 - (im.age - 5) / 3, 0, 1);
      c.globalAlpha = fade * clamp(p.z * 4, 0, 1);
      if (im.age < 0.4) glow(c, x, y, (8 + im.age * 50) * u, im.green ? '170,255,150' : '255,230,170', 1 - im.age / 0.4);
      c.fillStyle = 'rgba(20,14,10,0.7)'; c.beginPath(); c.ellipse(x, y, 3 * u, 1.3 * u, 0, 0, TAU); c.fill();
      for (let i = 0; i < 3; i++) flame(c, x + (i - 1) * 1.6 * u, y, (2.5 + i % 2) * u, t, i * 3 + im.lat);
      c.globalAlpha = 1;
    }
    impacts = impacts.filter((im) => im.age < 8);
  }
  function drawWonders(c, cx, cy, R, t) {
    if (!placed) placeWonders();
    const list = [];
    for (const w of WONDERS) {
      let lon = w.lon;
      if (w.kind === 'ship') lon += Math.sin(t * 0.05) * 14;
      const p = project(w.lat, lon);
      if (p.z < 0.08) continue;
      list.push({ w, p, x: cx + p.x * R, y: cy - p.y * R });
    }
    list.sort((a, b) => a.p.z - b.p.z);
    wonderHits = [];
    for (const o of list) {
      const u = (R / 62) * (0.55 + 0.45 * o.p.z);
      c.save(); c.globalAlpha = clamp((o.p.z - 0.08) * 4, 0, 1);
      drawWonder(c, o.w, o.x, o.y, u, t);
      c.restore();
      wonderHits.push({ w: o.w, x: o.x, y: o.y - 6 * u, r: 11 * u });
    }
  }
  function drawInspect(c, cx, cy, R, S) {
    if (!inspect) return;
    if (performance.now() > inspect.until) { inspect = null; return; }
    const hit = wonderHits.find((h) => h.w === inspect.w);
    if (!hit) return;
    const k = clamp((inspect.until - performance.now()) / 400, 0, 1);
    c.save(); c.globalAlpha = k;
    c.font = `700 13px ${FONT_DISPLAY}`;
    const title = inspect.w.name.toUpperCase();
    c.font = `400 11px ${FONT_BODY}`;
    // wrap the story into lines that fit the card
    const words = inspect.w.lore.split(' '), lines = [];
    let line = '';
    for (const wd of words) { const tst = line ? line + ' ' + wd : wd; if (c.measureText(tst).width > 170 && line) { lines.push(line); line = wd; } else line = tst; }
    lines.push(line);
    const w = 190, h = 26 + lines.length * 14;
    let bx = hit.x - w / 2, by = hit.y - hit.r - h - 10;
    bx = clamp(bx, 4, S - w - 4); if (by < 4) by = hit.y + hit.r + 10;
    c.fillStyle = 'rgba(14,17,20,0.92)'; c.strokeStyle = 'rgba(227,168,62,0.8)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + w - 8, by); c.lineTo(bx + w, by + 8); c.lineTo(bx + w, by + h); c.lineTo(bx, by + h); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#e3a83e'; c.fillRect(bx, by, 3, h);
    c.textAlign = 'left'; c.textBaseline = 'top';
    c.font = `700 13px ${FONT_DISPLAY}`; c.fillStyle = '#ece6d6'; c.fillText(title, bx + 10, by + 7);
    c.font = `400 11px ${FONT_BODY}`; c.fillStyle = '#cfcbc1';
    lines.forEach((ln, i) => c.fillText(ln, bx + 10, by + 24 + i * 14));
    c.restore();
  }
  function hitWonder(x, y) {
    for (let i = wonderHits.length - 1; i >= 0; i--) { const h = wonderHits[i]; if (Math.hypot(x - h.x, y - h.y) < h.r + 6) return h.w; }
    return null;
  }
  const WONDER_SOUNDS = { volcano: 'boom', fire: 'flame', dinos: 'brute', raptors: 'crow', pteros: 'crow', crater: 'freeze', crystals: 'unlock', rift: 'summon', stones: 'heal', kraken: 'splash', ship: 'wail', tree: 'heal', island: 'globe', dragon: 'roar', temple: 'interest', ufo: 'laser', well: 'medkit', zero: 'groan' };

  function draw(dt = 0) {
    const S = cssSize, t = performance.now() / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, S, S);
    const R = S * 0.36, cx = S / 2, cy = S / 2;
    const moon = moonPos(cx, cy, R, t);
    if (!moon.front) drawMoon(ctx, moon);
    // atmosphere halo
    const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.28);
    halo.addColorStop(0, 'rgba(90,160,255,0.45)'); halo.addColorStop(1, 'rgba(90,160,255,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R * 1.28, 0, TAU); ctx.fill();
    if (built < TH) {
      ctx.fillStyle = '#0b1a2c'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(227,168,62,0.9)'; ctx.font = `700 14px ${FONT_DISPLAY}`; ctx.textAlign = 'center';
      ctx.fillText(`MAPPING THE PLANET ${Math.round((built / TH) * 100)}%`, cx, cy);
      return;
    }
    renderPlanet();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, cx - R, cy - R, R * 2, R * 2);
    // night side
    const night = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.4, R * 0.2, cx, cy, R * 1.02);
    night.addColorStop(0, 'rgba(0,0,10,0)'); night.addColorStop(0.75, 'rgba(0,0,10,0)'); night.addColorStop(1, 'rgba(0,0,10,0.35)');
    ctx.fillStyle = night; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    drawAurora(ctx, cx, cy, R, t);
    drawImpacts(ctx, cx, cy, R, dt, t);
    drawWonders(ctx, cx, cy, R, t);

    labels = [];
    WORLDS.forEach((w, i) => {
      const p = project(w.lat, w.lon);
      if (p.z < -0.05) return;
      const sx = cx + p.x * R, sy = cy - p.y * R;
      const fade = clamp(p.z * 4, 0, 1);
      const sel = i === selected;
      const open = Globe.isOpen ? Globe.isOpen(i) : true;
      ctx.globalAlpha = fade;
      // marker
      const pulse = sel ? 1 + Math.sin(performance.now() / 300) * 0.25 : 1;
      ctx.beginPath(); ctx.arc(sx, sy, 9 * pulse, 0, TAU);
      ctx.strokeStyle = sel ? 'rgba(240,180,70,0.9)' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(sx, sy, 4, 0, TAU);
      ctx.fillStyle = open ? (sel ? '#f0b446' : '#e7e3d8') : '#6b7178'; ctx.fill();
      // name tag
      const text = w.short.toUpperCase();
      ctx.font = `700 ${sel ? 14 : 12}px ${FONT_DISPLAY}`;
      const tw = ctx.measureText(text).width + 20;
      const lx = sx + 14, ly = sy - 26;
      ctx.beginPath(); ctx.moveTo(sx + 4, sy - 4); ctx.lineTo(lx, ly + 10); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = sel ? 'rgba(240,180,70,0.95)' : 'rgba(14,17,20,0.85)';
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + tw - 6, ly); ctx.lineTo(lx + tw, ly + 6); ctx.lineTo(lx + tw, ly + 20); ctx.lineTo(lx, ly + 20); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = sel ? 'rgba(255,220,150,0.9)' : 'rgba(255,255,255,0.18)'; ctx.stroke();
      ctx.fillStyle = sel ? '#14100a' : open ? '#e7e3d8' : '#8b9196';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(text, lx + 10, ly + 10.5);
      ctx.globalAlpha = 1;
      labels.push({ i, x: sx, y: sy, x2: lx + tw, y1: ly, y2: ly + 20 });
    });
    if (moon.front) drawMoon(ctx, moon);
    drawSpace(ctx, S, cx, cy, R, dt, t);
    drawInspect(ctx, cx, cy, R, S);
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (drag) { /* rotation follows the finger */ }
    else if (target != null) {
      let d = target - rot;
      d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
      rot += d * Math.min(1, dt * 4);
      if (Math.abs(d) < 0.002) target = null;
    } else {
      rot += vel * dt; vel *= 0.95;
      rot += dt * 0.05;
    }
    cloudRot += dt * 0.07;
    draw(dt);
    requestAnimationFrame(frame);
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    cssSize = Math.max(120, Math.round(Math.min(r.width, r.height)));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssSize * dpr); canvas.height = Math.round(cssSize * dpr);
    const n = Math.min(380, Math.round(cssSize * 0.72 * Math.min(dpr, 1.5)));
    if (n !== lutN) buildLut(n);
  }

  function hit(ev) {
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    for (const l of labels) {
      if (Math.hypot(x - l.x, y - l.y) < 18 || (x >= l.x && x <= l.x2 && y >= l.y1 - 4 && y <= l.y2 + 4)) return l.i;
    }
    return -1;
  }

  return {
    isOpen: null,
    onFind: null,
    wonders: () => ({ found: found.size, total: WONDERS.length }),
    prepare,
    init(cv, pick) {
      canvas = cv; ctx = cv.getContext('2d'); onPick = pick;
      prepare();
      cv.addEventListener('pointerdown', (ev) => {
        drag = { x: ev.clientX, rot, moved: false, t: performance.now() };
        cv.setPointerCapture(ev.pointerId);
      });
      cv.addEventListener('pointermove', (ev) => {
        if (!drag) return;
        const dx = ev.clientX - drag.x;
        if (Math.abs(dx) > 4) drag.moved = true;
        const prev = rot;
        rot = drag.rot - dx / (cssSize * 0.36) * 1.1;
        vel = (rot - prev) * 30;
        target = null;
      });
      cv.addEventListener('pointerup', (ev) => {
        const d = drag; drag = null;
        if (d && !d.moved) {
          const i = hit(ev);
          if (i >= 0 && onPick) { onPick(i); return; }
          const r = canvas.getBoundingClientRect(), w = hitWonder(ev.clientX - r.left, ev.clientY - r.top);
          if (w) {
            inspect = { w, until: performance.now() + 6000 };
            markFound(w);
            if (typeof Sound !== 'undefined') Sound.play(WONDER_SOUNDS[w.kind] || 'click');
          }
        }
      });
      cv.addEventListener('pointercancel', () => { drag = null; });
      new ResizeObserver(() => resize()).observe(cv);
      resize();
    },
    select(i, instant) {
      selected = i;
      target = (WORLDS[i].lon * Math.PI) / 180;
      if (instant) { rot = target; target = null; }
    },
    start() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); },
    stop() { running = false; },
  };
})();
