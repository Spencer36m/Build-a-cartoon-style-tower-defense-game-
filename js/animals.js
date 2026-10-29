'use strict';
// ============================================================
// Wildlife: animals that live on each map and go about their business while the battle rages.
// Farmland has cows, sheep, chickens and butterflies; the cemetery owls, ravens, a black cat and
// rats; the tundra caribou, arctic foxes and snow hares; the bayou alligators, herons, frogs,
// turtles and dragonflies; the desert camels, fennec foxes and lizards. Flocks cross overhead now and then. They keep off the roads and the
// towers, herds stay together, swimmers keep to the water, and everything scatters when zombies
// come near.
// Each animal is drawn from above in its own frame (x forward, y to its right), lit from the top
// left like the rest of the map, with its legs, head, tail and wings animated from its state.
// ============================================================
const ANIMALS = (() => {
  let M = null, L = null, list = [], air = [], flocks = [], time = 0, flockT = 20, nightTime = false, rng = Math.random;
  const LIGHT = [-0.6, -0.8];

  // ---------- helpers ----------
  const R = (a, b) => a + rng() * (b - a);
  const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  // the light direction in an animal's own frame, so shading stays put as it turns
  const localLight = (ang) => [LIGHT[0] * Math.cos(ang) + LIGHT[1] * Math.sin(ang), -LIGHT[0] * Math.sin(ang) + LIGHT[1] * Math.cos(ang)];
  function lit(c, a, r, light, dark, k = 0.55) {
    const [lx, ly] = localLight(a.ang);
    return radial(c, lx * r * k, ly * r * k, r * 1.35, light, dark, 0, 0);
  }
  function shadow(c, x, y, rx, ry, ang, alpha = 0.28) {
    c.save(); c.translate(x + 2.2, y + 3); c.rotate(ang);
    c.fillStyle = `rgba(0,0,0,${alpha * 0.6})`; ellipse(c, 0, 0, rx * 1.15, ry * 1.2, 0); c.fill();
    c.fillStyle = `rgba(0,0,0,${alpha})`; ellipse(c, 0, 0, rx, ry, 0); c.fill();
    c.restore();
  }
  function leg(c, x0, y0, x1, y1, w, col, hoof) {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    if (hoof) { c.fillStyle = hoof; circle(c, x1, y1, w * 0.55); c.fill(); }
  }
  // fur: short strokes laid along the body, darker and lighter than the coat
  function fur(c, seed, len, wid, dark, light, n = 18) {
    const r = mulberry32(seed);
    c.lineWidth = 0.35; c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * len * 0.85, y = (r() - 0.5) * wid * 0.8, l = 0.8 + r() * 1.4;
      c.strokeStyle = r() < 0.55 ? dark : light; c.beginPath(); c.moveTo(x, y); c.lineTo(x - l, y + (r() - 0.5) * 0.4); c.stroke();
    }
  }
  // a thin cool rim of moonlight on the side facing the light, so dark animals read at night
  function rim(c, a) {
    const [lx, ly] = localLight(a.ang);
    c.save(); c.clip(); c.translate(-lx * 0.5, -ly * 0.5);
    c.strokeStyle = 'rgba(170,190,225,0.45)'; c.lineWidth = 0.6; c.stroke(); c.restore();
  }
  function eye(c, x, y, r, open = 1, col = '#111') {
    c.fillStyle = col; ellipse(c, x, y, r, r * Math.max(0.12, open), 0); c.fill();
    if (open > 0.5) { c.fillStyle = 'rgba(255,255,255,0.7)'; circle(c, x - r * 0.3, y - r * 0.3, r * 0.35); c.fill(); }
  }

  // ---------- where an animal may stand ----------
  // land: open ground (no road, water, building or tower); water: water tiles; shore: either
  function okAt(x, y, hab, towers) {
    if (x < 6 || y < 6 || x > W - 6 || y > H - 6) return false;
    const c = Math.floor(x / TILE), r = Math.floor(y / TILE), k = r * COLS + c, g = M.grid[k];
    if (towers && towers.has(k)) return false;
    if (dist2(x, y, M.end.x, M.end.y) < 46 * 46) return false;
    if (hab === 'water') return g === 3;
    if (hab === 'shore') return g === 0 || g === 3;
    return g === 0;
  }
  // the ground itself, ignoring towers and the safehouse yard
  function ground(x, y, hab) {
    if (x < 6 || y < 6 || x > W - 6 || y > H - 6) return false;
    const g = M.grid[Math.floor(y / TILE) * COLS + Math.floor(x / TILE)];
    return hab === 'water' ? g === 3 : hab === 'shore' ? g === 0 || g === 3 : g === 0;
  }
  function clearPath(x0, y0, x1, y1, hab, towers) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 7);
    for (let i = 1; i <= n; i++) if (!okAt(lerp(x0, x1, i / n), lerp(y0, y1, i / n), hab, towers)) return false;
    return true;
  }
  // anyPath: skip the route check; 'ground': the route need only cross open ground (for leaving a
  // tile that has just been built on, where the usual check fails at the very first step)
  function pickSpot(x, y, rmin, rmax, hab, towers, tries = 14, anyPath = false) {
    for (let i = 0; i < tries; i++) {
      const a = rng() * TAU, d = R(rmin, rmax), tx = x + Math.cos(a) * d, ty = y + Math.sin(a) * d;
      if (!okAt(tx, ty, hab, towers)) continue;
      if (anyPath === 'ground') { const n = Math.ceil(d / 6); let ok = true; for (let k = 1; k <= n && ok; k++) ok = ground(lerp(x, tx, k / n), lerp(y, ty, k / n), hab); if (ok) return [tx, ty]; continue; }
      if (anyPath || clearPath(x, y, tx, ty, hab, towers)) return [tx, ty];
    }
    return null;
  }
  function randomSpot(hab) {
    for (let i = 0; i < 300; i++) { const x = R(20, W - 20), y = R(20, H - 20); if (okAt(x, y, hab)) return [x, y]; }
    return null;
  }

  // ============================================================ species
  // Each has: hab, speeds (walk, run), fear (how close a zombie may come), size (for sorting and
  // shadows), act(a) to choose what to do when idle, and draw(c, a, t) in the animal's frame.
  const SPECIES = {};

  // ---------- hoofed animals share a body: neck, shoulders, a barrel of ribs, square hips ----------
  // f: front of the shoulders, r: the rump; ws, wb, wh: half-widths at shoulder, ribs and hips
  function quadBody(c, f, r, ws, wb, wh) {
    const m = (f + r) / 2 - 1;
    c.beginPath();
    c.moveTo(f + 2.2, -ws * 0.5);
    c.quadraticCurveTo(f + 0.5, -ws * 1.02, f - 3, -ws * 1.04);
    c.quadraticCurveTo(m, -wb * 1.16, r + 4, -wh);
    c.quadraticCurveTo(r + 1.2, -wh * 1.04, r, -wh * 0.7);
    c.quadraticCurveTo(r - 1.4, 0, r, wh * 0.7);
    c.quadraticCurveTo(r + 1.2, wh * 1.04, r + 4, wh);
    c.quadraticCurveTo(m, wb * 1.16, f - 3, ws * 1.04);
    c.quadraticCurveTo(f + 0.5, ws * 1.02, f + 2.2, ws * 0.5);
    c.closePath();
  }
  // round across the back: lit along the spine on the sunny side, falling away to shade at the flanks
  function roundness(c, a, len, wid, k = 1) {
    const [, ly] = localLight(a.ang);
    c.fillStyle = linear(c, 0, -wid, 0, wid, [[0, `rgba(0,0,0,${0.32 * k})`], [0.5 + ly * 0.12, `rgba(255,250,240,${0.12 * k})`], [1, `rgba(0,0,0,${0.38 * k})`]]);
    c.fillRect(-len, -wid, len * 2, wid * 2);
  }
  // legs swing in diagonal pairs at a walk and in near-pairs at a gallop; each ends in a dark hoof
  function hoofedLegs(c, a, fx, rx, wf, wr, stride, col, hoof, w, run) {
    const ph = run ? [0, 0.5, Math.PI, Math.PI + 0.5] : [0, Math.PI, Math.PI, 0];
    [[fx, -1, wf], [fx, 1, wf], [rx, -1, wr], [rx, 1, wr]].forEach(([lx, side, wd], i) => {
      const sw = Math.sin(a.gait + ph[i]) * stride, lift = run ? Math.max(0, Math.sin(a.gait + ph[i])) * 0.5 : 0;
      leg(c, lx, side * wd * 0.7, lx + sw, side * (wd + 2 - lift), w, col, hoof);
    });
  }

  // ---------- cow ----------
  SPECIES.cow = {
    hab: 'land', walk: 9, run: 38, fear: 70, turn: 2.2, len: 13, herd: true,
    init(a) {
      a.coat = ['holstein', 'holstein', 'brown', 'angus'][Math.floor(rng() * 4)];
      a.spots = Array.from({ length: 7 }, () => [R(-10, 7), R(-5.5, 5.5), R(1.6, 3.8), R(1.2, 3), R(0, 3)]);
      a.horns = rng() < 0.4; a.face = rng() < 0.5;
    },
    act(a) {
      const r = rng();
      if (nightTime && r < 0.45) return ['rest', R(14, 30)];
      return r < 0.5 ? ['graze', R(5, 12)] : r < 0.62 ? ['rest', R(10, 20)] : r < 0.75 ? ['look', R(2, 4)] : ['walk'];
    },
    draw(c, a, t) {
      const coat = { holstein: ['#f1ede4', '#a8a296', '#1d1b19'], brown: ['#8e5a36', '#4a2a16', '#f0e6d8'], angus: ['#34312d', '#121110', '#34312d'] }[a.coat];
      const rest = a.state === 'rest', graze = a.state === 'graze', run = a.state === 'run', moving = a.speed > 0.5;
      const f = 8, r = -11, ws = 4.1, wb = rest ? 6.6 : 5.8, wh = 4.8;
      if (!rest) hoofedLegs(c, a, f - 3, r + 3.6, ws, wh, moving ? Math.min(3.8, a.speed * 0.17) : 0, a.coat === 'holstein' ? '#d6d0c4' : coat[1], '#24201c', 2.1, run);
      // the tail hangs from the tailhead and swings, with a long tuft; a sharper flick at flies
      const swish = Math.sin(t * 2.1 + a.seed) * 0.35 + (a.swishT > 0 ? Math.sin(a.swishT * 13) * 1.5 : 0);
      c.strokeStyle = coat[1]; c.lineWidth = 0.9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(r + 0.4, 0); c.quadraticCurveTo(r - 3, swish * 1.8, r - 6, swish * 3.8); c.stroke();
      c.fillStyle = '#1e1a16'; ellipse(c, r - 6.4, swish * 3.95, 1.5, 0.95, swish * 0.5); c.fill();
      // the body, its markings, and light falling across the round of the back
      c.save(); quadBody(c, f, r, ws, wb, wh);
      c.fillStyle = lit(c, a, 12, shade(coat[0], a.coat === 'angus' ? 0.1 : 0.16), shade(coat[0], -0.25)); c.fill();
      c.clip();
      if (a.coat === 'holstein') { c.fillStyle = coat[2]; for (const [sx, sy, rx, ry, rot] of a.spots) { ellipse(c, sx, sy, rx, ry, rot); c.fill(); } }
      if (a.coat === 'brown') { c.fillStyle = 'rgba(240,228,210,0.85)'; ellipse(c, -2, wb * 1.05, 6, 1.6, 0); c.fill(); ellipse(c, -2, -wb * 1.05, 6, 1.6, 0); c.fill(); }
      roundness(c, a, 14, wb * 1.2, a.coat === 'angus' ? 0.55 : 1);
      // shoulder blades, the hook bones of the hips and the pin bones at the rump
      c.fillStyle = 'rgba(255,250,240,0.13)';
      for (const s2 of [-1, 1]) { ellipse(c, f - 3.4, s2 * ws * 0.5, 2.2, 1.1, 0); c.fill(); circle(c, r + 3.8, s2 * wh * 0.78, 1.15); c.fill(); circle(c, r + 0.9, s2 * wh * 0.42, 0.7); c.fill(); }
      c.fillStyle = 'rgba(0,0,0,0.12)'; for (const s2 of [-1, 1]) { ellipse(c, r + 5.2, s2 * wh * 0.7, 1.2, 0.8, 0); c.fill(); }
      fur(c, a.seed, 20, wb * 2, 'rgba(0,0,0,0.16)', a.coat === 'angus' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)', 26);
      c.restore();
      c.strokeStyle = 'rgba(0,0,0,0.38)'; c.lineWidth = 0.35; quadBody(c, f, r, ws, wb, wh); c.stroke();
      // the head: down and chewing while grazing, raised and turning to look about
      const look = a.state === 'look' ? Math.sin(t * 1.2 + a.seed) * 0.7 : graze ? Math.sin(t * 0.4 + a.seed) * 0.35 : a.turnBias * 0.4;
      const reach = graze ? 2.6 + Math.sin(t * 3.2 + a.seed) * 0.35 : rest ? -0.6 : 0;
      c.save(); c.translate(f + 2, 0); c.rotate(look);
      c.fillStyle = lit(c, a, 3, shade(coat[0], 0.05), shade(coat[0], -0.3)); c.beginPath(); c.moveTo(-0.6, -2.4); c.quadraticCurveTo(1.5 + reach * 0.5, -2, 2.5 + reach, -1.7); c.lineTo(2.5 + reach, 1.7); c.quadraticCurveTo(1.5 + reach * 0.5, 2, -0.6, 2.4); c.fill();
      c.translate(2 + reach, 0); const hs = graze ? 0.93 : 1; c.scale(hs, hs);
      const flick = Math.sin(t * 2.6 + a.seed * 3) > 0.93 ? 0.5 : 0;
      for (const s2 of [-1, 1]) {
        c.fillStyle = coat[a.coat === 'brown' ? 0 : 1]; ellipse(c, 0.4, s2 * (3.4 + flick), 1.7, 0.85, s2 * (0.45 + flick * 0.3)); c.fill();
        c.fillStyle = 'rgba(220,150,140,0.65)'; ellipse(c, 0.5, s2 * (3.4 + flick), 0.95, 0.42, s2 * (0.45 + flick * 0.3)); c.fill();
      }
      if (a.horns) { c.strokeStyle = '#ece0c4'; c.lineWidth = 0.75; for (const s2 of [-1, 1]) { c.beginPath(); c.moveTo(0.5, s2 * 1.8); c.quadraticCurveTo(-0.4, s2 * 3.4, 0.8, s2 * 4.1); c.stroke(); } c.fillStyle = '#3a342a'; for (const s2 of [-1, 1]) { circle(c, 0.8, s2 * 4.1, 0.3); c.fill(); } }
      // a wedge of a head, broad at the poll, with a big wet muzzle
      const headCol = a.coat === 'brown' && a.face ? '#f0e6d8' : coat[0];
      c.beginPath(); c.moveTo(-0.4, -2.7); c.quadraticCurveTo(3, -2.8, 5.4, -2); c.quadraticCurveTo(7.6, -1.6, 7.6, 0); c.quadraticCurveTo(7.6, 1.6, 5.4, 2); c.quadraticCurveTo(3, 2.8, -0.4, 2.7); c.quadraticCurveTo(-1, 0, -0.4, -2.7);
      c.fillStyle = lit(c, a, 4, shade(headCol, 0.14), shade(headCol, -0.28)); c.fill();
      if (a.coat === 'holstein') { c.save(); c.clip(); c.fillStyle = coat[2]; ellipse(c, 1.6, a.face ? -1.6 : 1.6, 2.4, 1.8, 0.3); c.fill(); ellipse(c, 0, 0, 1.2, 3, 0); c.fill(); c.restore(); }
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.3; c.stroke();
      c.fillStyle = radial(c, 6.3, -0.4, 2.4, '#e8b8b0', '#a87068', 0, 0); ellipse(c, 6.4, 0, 1.4, 1.9, 0); c.fill();
      c.fillStyle = '#4a2a26'; ellipse(c, 7.1, -0.75, 0.38, 0.28, 0.4); c.fill(); ellipse(c, 7.1, 0.75, 0.38, 0.28, -0.4); c.fill();
      const blink = (t + a.seed) % 4 < 0.12 ? 0.1 : 1;
      for (const s2 of [-1, 1]) { c.fillStyle = shade(headCol, -0.2); circle(c, 2, s2 * 2.55, 0.75); c.fill(); eye(c, 2.1, s2 * 2.6, 0.5, blink); }
      // chewing: the jaw works side to side
      if (graze || rest) { c.fillStyle = 'rgba(0,0,0,0.15)'; ellipse(c, 5.2, Math.sin(t * 5 + a.seed) * 0.4, 0.8, 1.2, 0); c.fill(); }
      c.restore();
    },
  };

  // ---------- sheep ----------
  SPECIES.sheep = {
    hab: 'land', walk: 8, run: 34, fear: 75, turn: 2.6, len: 8, herd: true,
    init(a) { a.wool = Array.from({ length: 16 }, () => { const q = rng() * TAU, d = Math.sqrt(rng()); return [Math.cos(q) * d * 5.8, Math.sin(q) * d * 4, R(1.8, 2.6)]; }); a.dark = rng() < 0.12; },
    act(a) { const r = rng(); if (nightTime && r < 0.4) return ['rest', R(12, 24)]; return r < 0.55 ? ['graze', R(4, 10)] : r < 0.68 ? ['look', R(1.5, 3)] : ['walk']; },
    draw(c, a, t) {
      const moving = a.speed > 0.5, stride = moving ? Math.min(2.6, a.speed * 0.12) : 0, run = a.state === 'run';
      if (a.state !== 'rest') for (const [lx, side, ph] of [[3.6, -1, 0], [3.6, 1, Math.PI], [-4, -1, Math.PI], [-4, 1, 0]]) {
        const sw = Math.sin(a.gait + ph) * stride;
        leg(c, lx, side * 2.6, lx + sw, side * 4.2 - (run ? Math.abs(Math.sin(a.gait)) * side * 0.6 : 0), 1, '#2a2622', '#141210');
      }
      const base = a.dark ? '#5a4e44' : '#ece6d8', shd = a.dark ? '#2e2620' : '#a89e8c';
      c.fillStyle = shd; ellipse(c, 0, 0, 6.6, 4.8, 0); c.fill();
      const [lx, ly] = localLight(a.ang), bob = moving ? Math.sin(a.gait * 2) * 0.2 : Math.sin(t * 1.6 + a.seed) * 0.12;
      for (const [x, y, r] of a.wool) {
        c.fillStyle = radial(c, x + lx * r * 0.5, y + ly * r * 0.5 + bob, r * 1.25, shade(base, 0.12), shd, 0, 0);
        circle(c, x, y + bob, r); c.fill();
      }
      c.strokeStyle = a.dark ? 'rgba(255,255,255,0.12)' : 'rgba(120,110,90,0.35)'; c.lineWidth = 0.3;
      for (const [x, y, r] of a.wool) { c.beginPath(); c.arc(x, y + bob, r * 0.6, 0.3, 2.4); c.stroke(); }
      // a black face nodding at the grass
      const graze = a.state === 'graze', look = a.state === 'look' ? Math.sin(t * 1.5 + a.seed) * 0.8 : graze ? Math.sin(t * 0.5 + a.seed) * 0.3 : a.turnBias * 0.4;
      c.save(); c.translate(6 + (graze ? 1.2 + Math.sin(t * 4 + a.seed) * 0.25 : 0), 0); c.rotate(look);
      for (const s of [-1, 1]) { c.fillStyle = '#1e1a18'; ellipse(c, 0.4, s * 2.3, 1.4, 0.6, s * 0.7); c.fill(); }
      c.fillStyle = lit(c, a, 2.5, '#4a4440', '#141210'); ellipse(c, 1.8, 0, 2.4, 1.7, 0); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.arc(0, 0, 1.6, Math.PI * 0.6, Math.PI * 1.4); c.fill();
      eye(c, 2, -1.1, 0.3, 1, '#d8c070'); eye(c, 2, 1.1, 0.3, 1, '#d8c070');
      c.restore();
    },
  };

  // ---------- chicken ----------
  SPECIES.chicken = {
    hab: 'land', walk: 10, run: 42, fear: 60, turn: 5, len: 3,
    init(a) { a.hen = ['#f2ece0', '#c8743a', '#8a4a24', '#2a2624'][Math.floor(rng() * 4)]; },
    act(a) { const r = rng(); return r < 0.45 ? ['peck', R(1.5, 4)] : r < 0.6 ? ['scratch', R(1, 2.2)] : r < 0.7 ? ['look', R(0.8, 2)] : ['walk']; },
    draw(c, a, t) {
      c.scale(1.25, 1.25);
      const run = a.state === 'run', moving = a.speed > 0.5, step = moving ? Math.sin(a.gait) : 0;
      // yellow legs, scratching backwards when it rakes the ground
      const scratch = a.state === 'scratch' ? Math.max(0, Math.sin(t * 9 + a.seed)) * 2.2 : 0;
      for (const s of [-1, 1]) leg(c, 0, s * 0.9, -0.4 + step * s * 1.2 - (s > 0 ? scratch : 0), s * 1.6, 0.45, '#d8a830');
      // the tail fan
      c.fillStyle = shade(a.hen, -0.25); c.beginPath(); c.moveTo(-1.5, 0); c.lineTo(-5, -1.6); c.lineTo(-5.4, 0); c.lineTo(-5, 1.6); c.closePath(); c.fill();
      if (a.hen === '#c8743a' || a.hen === '#8a4a24') { c.fillStyle = '#1a2a22'; c.beginPath(); c.moveTo(-3.5, 0); c.quadraticCurveTo(-5.5, -2, -6, -0.6); c.lineTo(-5, 0.3); c.fill(); }
      // body and wings; flapping when it panics
      c.fillStyle = lit(c, a, 3, shade(a.hen, 0.25), shade(a.hen, -0.3)); ellipse(c, 0, 0, 3.2, 2.2, 0); c.fill();
      const flap = run ? Math.abs(Math.sin(t * 22 + a.seed)) * 3.2 : 0;
      for (const s of [-1, 1]) {
        c.fillStyle = shade(a.hen, -0.12); c.beginPath(); c.moveTo(1, s * 1.4); c.quadraticCurveTo(-1, s * (2.4 + flap), -3, s * (1.6 + flap * 0.8)); c.quadraticCurveTo(-1, s * 1.2, 1, s * 1.4); c.fill();
      }
      // the head: bobbing as it walks, darting down to peck
      const peck = a.state === 'peck' ? Math.max(0, Math.sin(t * 7 + a.seed)) ** 3 * 1.6 : 0, bob = moving ? Math.max(0, step) * 0.8 : 0;
      const look = a.state === 'look' ? Math.sin(t * 6 + a.seed) * 0.8 : 0;
      c.save(); c.translate(2.6 + bob + peck, 0); c.rotate(look);
      c.fillStyle = lit(c, a, 1.4, shade(a.hen, 0.25), shade(a.hen, -0.2)); circle(c, 0, 0, 1.25); c.fill();
      c.fillStyle = '#d0281e'; ellipse(c, -0.2, 0, 1, 0.42, 0); c.fill(); ellipse(c, 1, 0.5, 0.35, 0.3, 0); c.fill();
      c.fillStyle = '#e8b030'; c.beginPath(); c.moveTo(1, -0.35); c.lineTo(2, 0); c.lineTo(1, 0.35); c.fill();
      eye(c, 0.5, -0.8, 0.22); eye(c, 0.5, 0.8, 0.22);
      c.restore();
    },
  };

  // ---------- black cat ----------
  SPECIES.cat = {
    hab: 'land', walk: 11, run: 60, fear: 55, turn: 4, len: 5,
    init(a) { a.fur = rng() < 0.75 ? '#1c1b1f' : '#c87a3a'; },
    act(a) { const r = rng(); return r < 0.4 ? ['sit', R(4, 10)] : r < 0.55 ? ['groom', R(2, 4)] : r < 0.65 ? ['look', R(1, 3)] : ['walk']; },
    draw(c, a, t) {
      const sit = a.state === 'sit' || a.state === 'groom', moving = a.speed > 0.5, stride = moving ? Math.min(2.4, a.speed * 0.08) : 0;
      const base = a.fur, dark = shade(base, -0.4), light = shade(base, 0.3);
      // a long tail: up and swaying as it walks, curled round the feet when it sits
      c.strokeStyle = base; c.lineWidth = 1.1; c.lineCap = 'round'; c.beginPath();
      if (sit) { c.moveTo(-2.5, 0); c.quadraticCurveTo(-3.5, 4.5, 1.5, 3.6); }
      else { const sw = Math.sin(t * 2.4 + a.seed) * 1.6; c.moveTo(-4.5, 0); c.bezierCurveTo(-7, sw, -8.5, -sw, -10, sw * 1.4); }
      c.stroke();
      if (!sit) for (const [lx, side, ph] of [[2.8, -1, 0], [2.8, 1, Math.PI], [-3, -1, Math.PI], [-3, 1, 0]]) leg(c, lx, side * 1.2, lx + Math.sin(a.gait + ph) * stride, side * 2.2, 0.8, dark);
      c.fillStyle = lit(c, a, 4, light, dark);
      if (sit) ellipse(c, -0.6, 0, 3, 2.6, 0); else ellipse(c, 0, 0, 4.8, 1.8, 0);
      c.fill(); rim(c, a);
      if (base !== '#1c1b1f') { c.strokeStyle = 'rgba(120,60,20,0.5)'; c.lineWidth = 0.4; for (let k = -3; k < 3; k += 1.4) { c.beginPath(); c.moveTo(k, -1.6); c.lineTo(k + 0.4, 1.6); c.stroke(); } }
      // the head: pricked ears, licking a paw now and then, eyes that glow at night
      const lick = a.state === 'groom' ? Math.sin(t * 6) * 0.25 : 0, look = a.state === 'look' ? Math.sin(t * 2 + a.seed) * 0.9 : 0;
      c.save(); c.translate(sit ? 2 : 4.6, 0); c.rotate(look + lick);
      for (const s of [-1, 1]) { c.fillStyle = base; c.beginPath(); c.moveTo(-0.4, s * 0.6); c.lineTo(-1.2, s * 2.3); c.lineTo(0.8, s * 1.4); c.closePath(); c.fill(); c.fillStyle = 'rgba(200,120,120,0.5)'; c.beginPath(); c.moveTo(-0.3, s * 0.9); c.lineTo(-0.9, s * 1.9); c.lineTo(0.4, s * 1.3); c.fill(); }
      c.fillStyle = lit(c, a, 2, light, dark); ellipse(c, 0.4, 0, 1.8, 1.6, 0); c.fill();
      const glow = nightTime || a.fur === '#1c1b1f';
      eye(c, 1.4, -0.65, 0.32, (t + a.seed) % 5 < 0.15 ? 0.1 : 1, glow ? '#b8e04a' : '#2a3a1a');
      eye(c, 1.4, 0.65, 0.32, (t + a.seed) % 5 < 0.15 ? 0.1 : 1, glow ? '#b8e04a' : '#2a3a1a');
      c.strokeStyle = 'rgba(230,230,220,0.5)'; c.lineWidth = 0.15; for (const s of [-1, 1]) for (const k of [-0.3, 0.3]) { c.beginPath(); c.moveTo(1.9, s * 0.4); c.lineTo(3.2, s * (0.9 + k)); c.stroke(); }
      c.restore();
    },
  };

  // ---------- rat ----------
  SPECIES.rat = {
    hab: 'land', walk: 22, run: 70, fear: 45, turn: 7, len: 2.5,
    act(a) { const r = rng(); return r < 0.45 ? ['sniff', R(0.8, 2.5)] : ['walk']; },
    draw(c, a, t) {
      const sniff = a.state === 'sniff' ? Math.sin(t * 18 + a.seed) * 0.25 : 0, moving = a.speed > 0.5;
      c.strokeStyle = '#b89890'; c.lineWidth = 0.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-2.4, 0);
      const wv = moving ? Math.sin(a.gait * 1.5) * 1.2 : Math.sin(t + a.seed) * 0.6;
      c.bezierCurveTo(-4, wv, -5.5, -wv, -7, wv * 0.6); c.stroke();
      if (moving) for (const [lx, s, ph] of [[1.2, -1, 0], [1.2, 1, Math.PI], [-1.4, -1, Math.PI], [-1.4, 1, 0]]) { c.fillStyle = '#c8a0a0'; circle(c, lx + Math.sin(a.gait + ph) * 0.6, s * 1.25, 0.32); c.fill(); }
      c.fillStyle = lit(c, a, 2.6, '#8a7a6c', '#3a322a'); c.beginPath(); c.moveTo(2.8 + sniff, 0); c.quadraticCurveTo(1.5, -1.5, -1.5, -1.3); c.quadraticCurveTo(-3, 0, -1.5, 1.3); c.quadraticCurveTo(1.5, 1.5, 2.8 + sniff, 0); c.fill(); rim(c, a);
      for (const s of [-1, 1]) { c.fillStyle = '#c89a98'; circle(c, 0.9, s * 0.95, 0.42); c.fill(); }
      c.fillStyle = '#e8a0a8'; circle(c, 2.9 + sniff, 0, 0.22); c.fill();
      eye(c, 1.6, -0.45, 0.16); eye(c, 1.6, 0.45, 0.16);
      c.strokeStyle = 'rgba(220,220,210,0.45)'; c.lineWidth = 0.1; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(2.6, s * 0.2); c.lineTo(3.6, s * (0.9 + sniff)); c.stroke(); }
    },
  };

  // ---------- raven ----------
  SPECIES.raven = {
    hab: 'land', walk: 9, run: 0, fear: 70, turn: 6, len: 3, flies: true, flySpeed: 75,
    act(a) { const r = rng(); return r < 0.35 ? ['peck', R(1.2, 3)] : r < 0.5 ? ['look', R(0.8, 2)] : r < 0.6 ? ['flyoff'] : ['walk']; },
    draw(c, a, t) {
      const fly = a.z > 0.5, flap = fly ? Math.sin(t * 13 + a.seed) : 0;
      if (fly) {
        // wings spread, beating, with fingered primaries
        for (const s of [-1, 1]) {
          const span = 6.5 + flap * 1.2;
          c.fillStyle = '#121216'; c.beginPath(); c.moveTo(1, s * 0.8); c.quadraticCurveTo(0, s * span * 0.6, -1.5 + flap * 0.8, s * span); c.lineTo(-2.2 + flap * 0.8, s * (span - 0.6)); c.lineTo(-2.4, s * (span - 1.6)); c.quadraticCurveTo(-2.4, s * 2, -2, s * 0.8); c.fill();
        }
      }
      c.fillStyle = '#16161c'; c.beginPath(); c.moveTo(-2, -0.9); c.lineTo(-5, -1.3); c.lineTo(-5.4, 0); c.lineTo(-5, 1.3); c.lineTo(-2, 0.9); c.fill();
      c.fillStyle = lit(c, a, 3, '#3a4258', '#0a0a0e'); ellipse(c, 0, 0, 3, 1.7, 0); c.fill(); rim(c, a);
      c.strokeStyle = 'rgba(120,140,200,0.35)'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(-2, -0.8); c.lineTo(1.4, -0.6); c.stroke();
      const peck = a.state === 'peck' ? Math.max(0, Math.sin(t * 6 + a.seed)) ** 3 * 1.2 : 0, look = a.state === 'look' ? Math.sin(t * 5 + a.seed) * 0.9 : 0;
      c.save(); c.translate(2.8 + peck, 0); c.rotate(look);
      c.fillStyle = '#121216'; circle(c, 0, 0, 1.2); c.fill();
      c.fillStyle = '#222228'; c.beginPath(); c.moveTo(0.8, -0.45); c.lineTo(2.6, 0); c.lineTo(0.8, 0.45); c.fill();
      eye(c, 0.3, -0.75, 0.2, 1, '#2a2a30');
      c.restore();
    },
  };

  // ---------- owl (perches on graves and dead trees) ----------
  SPECIES.owl = {
    hab: 'land', walk: 0, run: 0, fear: 60, turn: 3, len: 3, flies: true, flySpeed: 60, perches: true,
    act() { const r = rng(); return r < 0.6 ? ['look', R(2, 6)] : r < 0.75 ? ['ruffle', R(0.8, 1.4)] : ['perch', R(3, 8)]; },
    draw(c, a, t) {
      const fly = a.state === 'fly';
      if (fly) {
        const flap = Math.sin(t * 9 + a.seed);
        for (const s of [-1, 1]) { c.fillStyle = '#7a5a3a'; c.beginPath(); c.moveTo(1, s); c.quadraticCurveTo(0.5, s * (7 + flap), -2 + flap, s * (9 + flap)); c.quadraticCurveTo(-3, s * 4, -2, s); c.fill(); c.strokeStyle = 'rgba(40,24,10,0.5)'; c.lineWidth = 0.3; for (let k = 3; k < 9; k += 1.5) { c.beginPath(); c.moveTo(-0.5, s * k); c.lineTo(-2, s * k); c.stroke(); } }
      }
      const puff = a.state === 'ruffle' ? 1 + Math.abs(Math.sin(t * 10)) * 0.15 : 1;
      c.fillStyle = lit(c, a, 4, '#a07c54', '#4a3420'); ellipse(c, -0.6, 0, 3.6 * puff, 3.2 * puff, 0); c.fill();
      const r2 = mulberry32(a.seed); c.fillStyle = 'rgba(40,26,14,0.55)';
      for (let i = 0; i < 12; i++) { ellipse(c, -0.6 + (r2() - 0.5) * 5.5, (r2() - 0.5) * 5, 0.5, 0.3, r2() * 3); c.fill(); }
      c.fillStyle = 'rgba(255,240,220,0.4)'; for (let i = 0; i < 6; i++) { circle(c, -1.5 + (r2() - 0.5) * 4, (r2() - 0.5) * 4, 0.25); c.fill(); }
      // the head swivels a long way, and the facial disc and big eyes turn with it
      const head = a.state === 'look' ? Math.sin(t * 0.7 + a.seed) * 1.8 : a.headAng || 0;
      c.save(); c.translate(1.6, 0); c.rotate(head);
      c.fillStyle = lit(c, a, 2.6, '#a88458', '#4e3822'); circle(c, 0, 0, 2.5); c.fill();
      for (const s of [-1, 1]) { c.fillStyle = '#5a4028'; c.beginPath(); c.moveTo(-0.6, s * 1.4); c.lineTo(-1.6, s * 2.6); c.lineTo(0.2, s * 1.9); c.fill(); }
      c.fillStyle = '#d8c09a'; ellipse(c, 1.3, 0, 1.4, 2.1, 0); c.fill();
      const blink = (t * 0.7 + a.seed) % 3.5 < 0.15 ? 0.1 : 1;
      for (const s of [-1, 1]) { c.fillStyle = '#e8b020'; ellipse(c, 1.6, s * 0.85, 0.6, 0.6 * blink, 0); c.fill(); if (blink > 0.5) { c.fillStyle = '#111'; circle(c, 1.75, s * 0.85, 0.3); c.fill(); } }
      c.fillStyle = '#3a2a18'; c.beginPath(); c.moveTo(2.2, -0.25); c.lineTo(2.8, 0); c.lineTo(2.2, 0.25); c.fill();
      c.restore();
    },
  };

  // ---------- caribou ----------
  SPECIES.caribou = {
    hab: 'land', walk: 10, run: 46, fear: 80, turn: 2, len: 11, herd: true,
    init(a) { a.bull = rng() < 0.45; },
    act(a) { const r = rng(); if (nightTime && r < 0.35) return ['rest', R(12, 24)]; return r < 0.5 ? ['graze', R(4, 10)] : r < 0.62 ? ['look', R(2, 4)] : ['walk']; },
    draw(c, a, t) {
      const rest = a.state === 'rest', graze = a.state === 'graze', run = a.state === 'run', moving = a.speed > 0.5;
      const f = 7.5, r = -9.5, ws = 3.1, wb = rest ? 4.6 : 4, wh = 3.4;
      if (!rest) hoofedLegs(c, a, f - 2.6, r + 3, ws, wh, moving ? Math.min(4.8, a.speed * 0.14) : 0, '#3a2e24', '#e8e2d6', 1.25, run);
      c.fillStyle = '#f4f0e8'; ellipse(c, r - 0.6, 0, 1.4, 1.1, 0); c.fill();
      c.save(); quadBody(c, f, r, ws, wb, wh);
      c.fillStyle = lit(c, a, 10, '#8c735a', '#3c2e22'); c.fill();
      c.clip();
      // the pale neck and shoulders, greyer flanks, a white rump patch and a dark line along the side
      c.fillStyle = radial(c, f + 1, 0, 6, 'rgba(240,234,222,0.95)', 'rgba(240,234,222,0)', 0, 0); ellipse(c, f + 1, 0, 6, 5, 0); c.fill();
      c.fillStyle = radial(c, r, 0, 4.5, 'rgba(246,242,234,0.95)', 'rgba(246,242,234,0)', 0, 0); ellipse(c, r, 0, 4.5, 4.5, 0); c.fill();
      for (const s2 of [-1, 1]) { c.fillStyle = 'rgba(30,22,14,0.35)'; ellipse(c, -1, s2 * wb * 0.95, 7.5, 0.9, 0); c.fill(); c.fillStyle = 'rgba(200,190,175,0.35)'; ellipse(c, -1, s2 * wb * 1.12, 7, 0.7, 0); c.fill(); }
      roundness(c, a, 12, wb * 1.2, 0.9);
      fur(c, a.seed, 17, wb * 2, 'rgba(40,28,16,0.3)', 'rgba(255,250,240,0.2)', 24);
      c.restore();
      c.strokeStyle = 'rgba(0,0,0,0.32)'; c.lineWidth = 0.3; quadBody(c, f, r, ws, wb, wh); c.stroke();
      // neck with its white mane, the head down at the lichen or up and watching, and the antlers
      const look = a.state === 'look' ? Math.sin(t * 1.1 + a.seed) * 0.6 : graze ? Math.sin(t * 0.5 + a.seed) * 0.3 : a.turnBias * 0.3;
      const reach = graze ? 2.4 + Math.sin(t * 3 + a.seed) * 0.3 : 0;
      c.save(); c.translate(f + 1.8, 0); c.rotate(look);
      c.fillStyle = lit(c, a, 3, '#fbf8f2', '#c8bea8'); c.beginPath(); c.moveTo(-0.5, -2.4); c.quadraticCurveTo(1.5 + reach * 0.4, -2.2, 3 + reach, -1.4); c.lineTo(3 + reach, 1.4); c.quadraticCurveTo(1.5 + reach * 0.4, 2.2, -0.5, 2.4); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 0.3; for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(k * 0.5, -1.6 + k * 0.1); c.lineTo(k * 0.5 + 0.6, -2.1); c.stroke(); }
      c.translate(3 + reach, 0);
      for (const s2 of [-1, 1]) { c.fillStyle = '#5a4838'; ellipse(c, 0.3, s2 * 1.9, 1.3, 0.55, s2 * 0.6); c.fill(); }
      c.beginPath(); c.moveTo(-0.3, -1.6); c.quadraticCurveTo(2.5, -1.7, 4.4, -0.9); c.quadraticCurveTo(5.2, 0, 4.4, 0.9); c.quadraticCurveTo(2.5, 1.7, -0.3, 1.6); c.closePath();
      c.fillStyle = lit(c, a, 3, '#7a6250', '#2e241a'); c.fill();
      c.fillStyle = '#d6cab6'; ellipse(c, 4.2, 0, 1, 1.05, 0); c.fill(); c.fillStyle = '#2a201a'; circle(c, 4.8, -0.4, 0.2); c.fill(); circle(c, 4.8, 0.4, 0.2); c.fill();
      eye(c, 1.5, -1.35, 0.32); eye(c, 1.5, 1.35, 0.32);
      // antlers: sweeping beams with tines and a brow shovel
      const big = a.bull ? 1 : 0.62;
      c.lineCap = 'round';
      for (const s2 of [-1, 1]) {
        c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.65 * big + 0.35;
        c.beginPath(); c.moveTo(0.4, s2 * 0.9); c.bezierCurveTo(-1.5, s2 * 3.2 * big, -4.2 * big, s2 * 5.2 * big, -1.4 * big, s2 * 7.8 * big); c.stroke();
        c.strokeStyle = '#ddd0b4'; c.lineWidth = 0.6 * big + 0.25;
        c.beginPath(); c.moveTo(0.2, s2 * 0.7); c.bezierCurveTo(-1.7, s2 * 3 * big, -4.4 * big, s2 * 5 * big, -1.6 * big, s2 * 7.6 * big); c.stroke();
        c.lineWidth = 0.38;
        for (const [k, l] of [[0.32, 2.2], [0.55, 2.6], [0.78, 2.1], [0.95, 1.4]]) {
          const bx = lerp(0.2, -1.6 * big, k) - 2.6 * big * Math.sin(k * Math.PI), by = s2 * lerp(0.7, 7.6 * big, k);
          c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + l * big, by + s2 * 0.5 * big); c.stroke();
        }
        c.lineWidth = 0.5; c.beginPath(); c.moveTo(0.6, s2 * 0.7); c.lineTo(2.6 * big, s2 * 1.1); c.stroke();
      }
      c.restore();
    },
  };

  // ---------- arctic fox ----------
  // coat, shade, legs, paws, fur strokes and ear size: white for the arctic fox, sand for the fennec
  const FOX_ARCTIC = { coat: '#ffffff', shade: '#aebccc', tail: '#b8c4d0', leg: '#dfe5ec', paw: '#9aa4ae', ear: '#e8eef4', dark: 'rgba(120,140,160,0.35)', ears: 1 };
  const FOX_FENNEC = { coat: '#f0d4a0', shade: '#a8783e', tail: '#9a6a34', leg: '#e2c08a', paw: '#7a5a34', ear: '#f2c8a8', dark: 'rgba(120,80,30,0.35)', ears: 1.9, tip: '#3a2414' };
  SPECIES.fox = {
    hab: 'land', walk: 16, run: 62, fear: 70, turn: 4, len: 5,
    act(a) { const r = rng(); return r < 0.3 ? ['listen', R(1.5, 3)] : r < 0.42 ? ['sit', R(3, 7)] : ['walk']; },
    draw(c, a, t) {
      const F = a.pal || FOX_ARCTIC;
      c.scale(1.15, 1.15);
      const moving = a.speed > 0.5, stride = moving ? Math.min(2.2, a.speed * 0.07) : 0, sit = a.state === 'sit';
      const pounce = a.state === 'pounce' ? Math.sin(Math.min(1, a.actT) * Math.PI) : 0;
      // the brush: a big soft white tail, curled round when sitting
      const sw = Math.sin(t * 1.8 + a.seed) * (moving ? 0.6 : 1.2);
      c.save(); c.translate(-4.2, 0); c.rotate(sit ? 2.2 : sw * 0.15);
      c.fillStyle = lit(c, a, 5, F.coat, F.tail); c.beginPath(); c.moveTo(0, -0.8); c.quadraticCurveTo(-4, -2.4, -7.5, -0.2); c.quadraticCurveTo(-4, 2.4, 0, 0.8); c.fill();
      if (F.tip) { c.fillStyle = F.tip; ellipse(c, -6.8, -0.2, 1, 0.8, 0); c.fill(); }
      c.restore();
      if (!sit) for (const [lx, side, ph] of [[2.8, -1, 0], [2.8, 1, Math.PI], [-2.8, -1, Math.PI], [-2.8, 1, 0]]) leg(c, lx, side * 1.3, lx + Math.sin(a.gait + ph) * stride, side * 2.3, 0.75, F.leg, F.paw);
      c.save(); c.scale(1 + pounce * 0.25, 1 + pounce * 0.25);
      c.fillStyle = lit(c, a, 4, F.coat, F.shade);
      if (sit) { ellipse(c, -0.4, 0, 3, 2.3, 0); c.fill(); } else { ellipse(c, 0, 0, 4.4, 1.9, 0); c.fill(); }
      fur(c, a.seed, 8, 3.6, F.dark, 'rgba(255,255,255,0.6)', 10);
      // head cocked, listening for mice under the snow, then the pounce
      const listen = a.state === 'listen' ? Math.sin(t * 2 + a.seed) * 0.35 : 0;
      c.translate(sit ? 2.4 : 4.2, 0); c.rotate(listen);
      for (const s of [-1, 1]) { c.fillStyle = F.ear; c.beginPath(); c.moveTo(-0.6, s * 0.6); c.lineTo(-0.8 - (F.ears - 1) * 1.2, s * 1.9 * F.ears); c.lineTo(0.4, s * 1.1); c.fill(); }
      c.fillStyle = lit(c, a, 2, F.coat, F.shade); c.beginPath(); c.moveTo(2.6, 0); c.quadraticCurveTo(0.5, -1.6, -0.6, -1); c.quadraticCurveTo(-1, 0, -0.6, 1); c.quadraticCurveTo(0.5, 1.6, 2.6, 0); c.fill();
      c.fillStyle = '#1a1a1e'; circle(c, 2.6, 0, 0.3); c.fill();
      eye(c, 0.9, -0.6, 0.22, 1, '#2a2418'); eye(c, 0.9, 0.6, 0.22, 1, '#2a2418');
      c.restore();
    },
  };

  // ---------- snow hare ----------
  SPECIES.hare = {
    hab: 'land', walk: 14, run: 64, fear: 65, turn: 6, len: 3, hops: true,
    act(a) { const r = rng(); return r < 0.4 ? ['sit', R(2, 6)] : r < 0.55 ? ['nibble', R(2, 4)] : ['walk']; },
    draw(c, a, t) {
      c.scale(1.2, 1.2);
      const moving = a.speed > 0.5, hop = moving ? Math.sin(a.gait) : 0, stretch = moving ? 1 + Math.max(0, hop) * 0.35 : 1;
      // big back feet kick out on each bound
      if (moving) for (const s of [-1, 1]) { c.fillStyle = '#d8e0e8'; ellipse(c, -2.8 - Math.max(0, hop) * 1.6, s * 1.5, 1.5, 0.5, 0); c.fill(); }
      c.fillStyle = '#f4f6f8'; circle(c, -3.4 * stretch, 0, 0.9); c.fill();
      c.save(); c.scale(stretch, 1 / Math.sqrt(stretch));
      c.fillStyle = lit(c, a, 3.4, '#ffffff', '#b6c2ce'); ellipse(c, -0.4, 0, 3.2, 2.3, 0); c.fill();
      c.restore();
      const nib = a.state === 'nibble' ? Math.sin(t * 12) * 0.15 : 0, alert = a.state === 'sit' || a.state === 'look';
      c.save(); c.translate(2.6 * stretch, 0);
      // long ears: pricked up when it is alert, laid flat along the back as it runs
      const lay = a.state === 'run' ? 0.15 : alert ? 1 : 0.55;
      for (const s2 of [-1, 1]) {
        const tw = Math.sin(t * 2.5 + a.seed + s2) > 0.95 ? 0.3 : 0, spread = 0.18 + lay * 0.35 + tw;
        c.save(); c.translate(-0.2, s2 * 0.5); c.rotate(Math.PI - s2 * spread);
        const L2 = 3.6 + lay * 0.8;
        c.fillStyle = 'rgba(0,0,0,0.18)'; ellipse(c, L2 * 0.5 + 0.3, 0.4, L2 * 0.55, 0.8, 0); c.fill();
        c.fillStyle = '#f2f5f8'; ellipse(c, L2 * 0.5, 0, L2 * 0.55, 0.78, 0); c.fill();
        c.fillStyle = 'rgba(220,160,160,0.55)'; ellipse(c, L2 * 0.5, 0, L2 * 0.38, 0.32, 0); c.fill();
        c.fillStyle = '#4a4a50'; ellipse(c, L2 * 0.98, 0, 0.5, 0.55, 0); c.fill();
        c.restore();
      }
      c.fillStyle = lit(c, a, 1.8, '#ffffff', '#b4c0cc'); ellipse(c, 0.6, 0, 1.7, 1.4, 0); c.fill();
      c.fillStyle = '#d89a9a'; circle(c, 2.2 + nib, 0, 0.25); c.fill();
      eye(c, 0.8, -1, 0.3, 1, '#2a1e14'); eye(c, 0.8, 1, 0.3, 1, '#2a1e14');
      c.restore();
    },
  };

  // ---------- fennec fox: the arctic fox's desert cousin, sandy with huge ears ----------
  SPECIES.fennec = { ...SPECIES.fox, init(a) { a.pal = FOX_FENNEC; } };

  // ---------- dromedary camel ----------
  SPECIES.camel = {
    hab: 'land', walk: 9, run: 38, fear: 78, turn: 1.6, len: 12, herd: true,
    act(a) { const r = rng(); if (r < 0.25) return ['rest', R(10, 22)]; return r < 0.55 ? ['graze', R(4, 9)] : r < 0.66 ? ['look', R(2, 4)] : ['walk']; },
    draw(c, a, t) {
      const rest = a.state === 'rest', run = a.state === 'run', moving = a.speed > 0.5, graze = a.state === 'graze';
      const f = 7, r = -10, ws = 3, wb = rest ? 4.8 : 4.1, wh = 3.4;
      if (!rest) hoofedLegs(c, a, f - 2.4, r + 3.2, ws, wh, moving ? Math.min(5, a.speed * 0.16) : 0, '#a07a4a', '#5a4430', 1.2, run);
      c.save(); quadBody(c, f, r, ws, wb, wh);
      c.fillStyle = lit(c, a, 10, '#d8b47a', '#7a5a34'); c.fill();
      c.clip();
      // the single hump, lit on top, and a darker saddle of fur over it
      c.fillStyle = radial(c, -1.6, 0, 5.2, 'rgba(250,224,170,0.9)', 'rgba(250,224,170,0)', -0.3, -0.3); ellipse(c, -1.6, 0, 5.2, 3.6, 0); c.fill();
      c.fillStyle = 'rgba(120,80,40,0.35)'; ellipse(c, -1.6, 0, 2.6, 1.6, 0); c.fill();
      roundness(c, a, 12, wb * 1.2, 0.8);
      fur(c, a.seed, 17, wb * 2, 'rgba(90,60,26,0.3)', 'rgba(255,240,210,0.25)', 22);
      c.restore();
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.3; quadBody(c, f, r, ws, wb, wh); c.stroke();
      // the tail flicks; the long neck curves forward and down to a narrow head
      c.strokeStyle = '#6a4a28'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(r, 0); c.lineTo(r - 3, Math.sin(t * 2 + a.seed) * 1.2); c.stroke();
      const look = a.state === 'look' ? Math.sin(t * 1.1 + a.seed) * 0.6 : a.turnBias * 0.3, reach = graze ? 1.6 : rest ? -1 : 0;
      c.save(); c.translate(f + 1.5, 0); c.rotate(look);
      c.fillStyle = lit(c, a, 4, '#e2c08a', '#8a6638'); c.beginPath(); c.moveTo(-1, -1.8); c.quadraticCurveTo(3, -1.6, 6 + reach, -1); c.lineTo(6 + reach, 1); c.quadraticCurveTo(3, 1.6, -1, 1.8); c.fill();
      c.translate(6 + reach, 0);
      c.fillStyle = lit(c, a, 3, '#e6c690', '#8a6638'); c.beginPath(); c.moveTo(-0.6, -1.4); c.quadraticCurveTo(2.4, -1.5, 4, -0.7); c.quadraticCurveTo(4.6, 0, 4, 0.7); c.quadraticCurveTo(2.4, 1.5, -0.6, 1.4); c.closePath(); c.fill();
      for (const s2 of [-1, 1]) { c.fillStyle = '#9a7442'; ellipse(c, -0.2, s2 * 1.4, 0.7, 0.4, s2 * 0.5); c.fill(); }
      c.fillStyle = '#6a4a2a'; circle(c, 4.1, -0.35, 0.18); c.fill(); circle(c, 4.1, 0.35, 0.18); c.fill();
      eye(c, 1.3, -1.1, 0.3); eye(c, 1.3, 1.1, 0.3);
      c.restore();
    },
  };

  // ---------- lizard: dashes between rocks, then freezes with its head up ----------
  SPECIES.lizard = {
    hab: 'land', walk: 22, run: 80, fear: 60, turn: 8, len: 3,
    act(a) { const r = rng(); return r < 0.5 ? ['sit', R(1.5, 5)] : r < 0.6 ? ['look', R(1, 2)] : ['walk']; },
    draw(c, a, t) {
      const moving = a.speed > 0.5, w = moving ? Math.sin(a.gait * 1.5) * 0.35 : 0;
      c.lineCap = 'round';
      // the body bends from side to side as it runs, legs splayed out and stepping in diagonal pairs
      const sp = [[1.4, -1, 0], [1.4, 1, Math.PI], [-1.4, -1, Math.PI], [-1.4, 1, 0]];
      for (const [lx, side, ph] of sp) { const st = moving ? Math.sin(a.gait + ph) * 1.2 : 0; leg(c, lx, side * 0.6, lx + 0.8 + st, side * 2.1, 0.5, '#8a7a50'); }
      c.strokeStyle = '#7a6a44'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-2.4, 0); c.quadraticCurveTo(-4.5, w * 4, -7, -w * 3); c.stroke();
      c.lineWidth = 0.5; c.beginPath(); c.moveTo(-6.6, -w * 2.6); c.lineTo(-8.4, -w * 4); c.stroke();
      c.fillStyle = lit(c, a, 2.5, '#c8b47a', '#6a5a34'); ellipse(c, 0, 0, 2.8, 1.05, w * 0.3); c.fill();
      c.fillStyle = 'rgba(80,60,30,0.5)'; for (let i = -1; i <= 1; i++) { circle(c, i * 0.9, 0, 0.3); c.fill(); }
      c.save(); c.translate(2.7, w * 0.8); c.rotate(a.state === 'look' ? Math.sin(t * 3 + a.seed) * 0.4 : w * 0.4);
      c.fillStyle = lit(c, a, 1.2, '#d4c08a', '#6a5a34'); ellipse(c, 0.6, 0, 1.2, 0.8, 0); c.fill();
      eye(c, 0.8, -0.55, 0.18); eye(c, 0.8, 0.55, 0.18);
      c.restore();
    },
  };

  // ---------- alligator ----------
  // width along the body from the snout (0) to the tail tip (1)
  const GATOR_W = [[0, 0.9], [0.04, 1.7], [0.13, 2.5], [0.17, 2.15], [0.28, 3.3], [0.42, 3.7], [0.55, 3.05], [0.66, 2.1], [0.85, 0.9], [1, 0.15]];
  const gatorW = (k) => { for (let i = 1; i < GATOR_W.length; i++) if (k <= GATOR_W[i][0]) { const [k0, w0] = GATOR_W[i - 1], [k1, w1] = GATOR_W[i]; return lerp(w0, w1, (k - k0) / (k1 - k0)); } return 0.15; };
  SPECIES.gator = {
    hab: 'shore', walk: 6, run: 26, fear: 60, turn: 1.2, len: 14, swims: true,
    act(a) { const r = rng(); return r < 0.5 ? ['bask', R(8, 18)] : r < 0.62 ? ['gape', R(2.5, 4)] : ['walk']; },
    draw(c, a, t) {
      const inWater = a.wet > 0.5, moving = a.speed > 0.3, N = 24;
      // the spine from snout to tail tip, swinging in an S as it crawls or swims
      const amp = moving ? Math.min(1, a.speed / 8) * 1.6 : 0.2;
      const P = []; for (let i = 0; i <= N; i++) { const k = i / N; P.push([16 - k * 33, Math.sin((moving ? a.gait * 0.8 : t * 0.5 + a.seed) - k * 4.2) * amp * (0.15 + k * k * 1.6)]); }
      const side = (sgn) => P.map(([x, y], i) => [x, y + sgn * gatorW(i / N)]);
      const outline = () => { c.beginPath(); side(-1).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); side(1).reverse().forEach(([x, y]) => c.lineTo(x, y)); c.closePath(); };
      if (inWater) {
        // low in the water: the ridge of the back, the eyes and nostrils show, ripples behind
        for (let i = 0; i < 2; i++) { const k = (t * 0.4 + i * 0.5) % 1; c.strokeStyle = `rgba(200,220,190,${(1 - k) * 0.35})`; c.lineWidth = 0.4; ellipse(c, -2 - k * 6, 0, 8 + k * 10, 3.5 + k * 5, 0); c.stroke(); }
        if (moving) { c.strokeStyle = 'rgba(220,235,220,0.4)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(14, -2); c.lineTo(4, -6); c.moveTo(14, 2); c.lineTo(4, 6); c.stroke(); }
        c.save(); c.globalAlpha *= 0.45; outline(); c.fillStyle = '#26301a'; c.fill(); c.restore();
        c.fillStyle = '#3a4628'; for (let i = 6; i < 15; i++) { const [x, y] = P[i]; ellipse(c, x, y - 0.6, 0.7, 0.4, 0); c.fill(); ellipse(c, x, y + 0.6, 0.7, 0.4, 0); c.fill(); }
        for (const s2 of [-1, 1]) { const [x, y] = P[3]; c.fillStyle = '#4a5630'; circle(c, x, y + s2 * 1.4, 0.8); c.fill(); c.fillStyle = '#d8c040'; ellipse(c, x + 0.15, y + s2 * 1.4, 0.38, 0.22, 0); c.fill(); c.fillStyle = '#111'; c.fillRect(x + 0.1, y + s2 * 1.4 - 0.16, 0.12, 0.32); }
        c.fillStyle = '#3a4628'; circle(c, P[0][0] - 0.6, P[0][1] - 0.4, 0.4); c.fill(); circle(c, P[0][0] - 0.6, P[0][1] + 0.4, 0.4); c.fill();
        return;
      }
      // splayed legs with clawed toes, stepping in a diagonal walk
      for (const [k, s2, ph] of [[0.28, -1, 0], [0.28, 1, Math.PI], [0.55, -1, Math.PI], [0.55, 1, 0]]) {
        const i = Math.round(k * N), [x, y] = P[i], w = gatorW(k), sw = moving ? Math.sin(a.gait * 0.8 + ph) * 2 : 0, back = k > 0.4 ? -1 : 1;
        const kx = x + sw * 0.4, ky = y + s2 * (w + 1.8), fx = x + back * 1.6 + sw, fy = y + s2 * (w + 3);
        c.strokeStyle = '#2a3220'; c.lineWidth = 1.5; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(x, y + s2 * w * 0.6); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
        c.lineWidth = 0.35; for (let tq = -1; tq <= 1; tq++) { c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + back * 1 + tq * 0.4, fy + s2 * (0.8 + Math.abs(tq) * 0.1)); c.stroke(); }
      }
      // the gape: the upper jaw lifts from the hinge, showing the pale mouth
      const gape = a.state === 'gape' ? Math.sin(Math.min(1, a.actT / 2.5) * Math.PI) : 0;
      if (gape > 0.05) {
        const [hx, hy] = P[4];
        c.fillStyle = '#d89a88'; c.beginPath(); c.moveTo(hx, hy - 2.2); c.quadraticCurveTo(P[0][0] + 1, P[0][1] - 1.8, P[0][0] + 0.6, P[0][1]); c.quadraticCurveTo(P[0][0] + 1, P[0][1] + 1.8, hx, hy + 2.2); c.fill();
        c.fillStyle = '#e8d8b0'; for (let k = 0; k < 6; k++) { const [x, y] = P[k]; c.fillRect(x - 0.15, y - gatorW(k / N) + 0.2, 0.3, 0.5); c.fillRect(x - 0.15, y + gatorW(k / N) - 0.7, 0.3, 0.5); }
      }
      c.save();
      if (gape > 0.05) { const [hx, hy] = P[4]; c.translate(hx, hy); c.scale(1 - gape * 0.22, 1); c.translate(-hx, -hy); }
      outline(); c.fillStyle = lit(c, a, 15, '#66723e', '#1e2414', 0.3); c.fill();
      c.save(); outline(); c.clip();
      roundness(c, a, 18, 4.2, 1.1);
      // two rows of raised armour plates down the back, ridged crests along the tail
      for (let i = 6; i < N - 1; i++) {
        const k = i / N, [x, y] = P[i], w = gatorW(k), rows = k < 0.6 ? [-0.55, -0.2, 0.2, 0.55] : [-0.25, 0.25];
        for (const o of rows) {
          const bx = x, by = y + o * w;
          c.fillStyle = 'rgba(16,20,10,0.45)'; c.beginPath(); c.ellipse(bx, by + 0.15, 0.6, 0.42, 0, 0, TAU); c.fill();
          c.fillStyle = 'rgba(200,210,150,0.16)'; c.beginPath(); c.ellipse(bx - 0.15, by - 0.12, 0.4, 0.22, 0, 0, TAU); c.fill();
        }
      }
      // scaly hide between the plates, and the paler jaw edges
      fur(c, a.seed, 30, 6, 'rgba(10,14,6,0.25)', 'rgba(200,210,150,0.1)', 40);
      c.restore();
      c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.35; outline(); c.stroke();
      // teeth showing along the jaw line, raised eyes and nostrils
      c.fillStyle = 'rgba(232,224,196,0.85)';
      for (let k = 1; k < 5; k++) for (const s2 of [-1, 1]) { const [x, y] = P[k], w = gatorW(k / N); c.beginPath(); c.moveTo(x - 0.3, y + s2 * (w - 0.1)); c.lineTo(x, y + s2 * (w + 0.45)); c.lineTo(x + 0.3, y + s2 * (w - 0.1)); c.fill(); }
      const blink = (t * 0.4 + a.seed) % 6 < 0.2 ? 0.1 : 1;
      for (const s2 of [-1, 1]) { const [x, y] = P[3]; c.fillStyle = '#4e5a32'; circle(c, x, y + s2 * 1.5, 0.85); c.fill(); c.fillStyle = '#d8c040'; ellipse(c, x + 0.15, y + s2 * 1.5, 0.4, 0.24 * blink, 0); c.fill(); if (blink > 0.5) { c.fillStyle = '#111'; c.fillRect(x + 0.1, y + s2 * 1.5 - 0.16, 0.12, 0.32); } }
      c.fillStyle = '#26301a'; circle(c, P[0][0] - 0.8, P[0][1] - 0.45, 0.35); c.fill(); circle(c, P[0][0] - 0.8, P[0][1] + 0.45, 0.35); c.fill();
      c.restore();
    },
  };

  // ---------- heron ----------
  SPECIES.heron = {
    hab: 'shore', walk: 5, run: 0, fear: 75, turn: 2.5, len: 4, flies: true, flySpeed: 50, wades: true,
    act(a) { const r = rng(); return r < 0.45 ? ['stalk', R(3, 7)] : r < 0.6 ? ['strike', 0.9] : r < 0.7 ? ['preen', R(1.5, 3)] : ['walk']; },
    draw(c, a, t) {
      const fly = a.z > 0.5;
      if (a.wet > 0.5 && !fly) for (let i = 0; i < 2; i++) { const k = (t * 0.35 + i * 0.5) % 1; c.strokeStyle = `rgba(210,225,220,${(1 - k) * 0.45})`; c.lineWidth = 0.35; ellipse(c, 0, 0, 3 + k * 7, 2.4 + k * 5.6, 0); c.stroke(); }
      if (fly) {
        // a slow, deep wingbeat; neck tucked back, legs trailing
        const flap = Math.sin(t * 5 + a.seed);
        for (const s of [-1, 1]) { c.fillStyle = '#6a7a8a'; c.beginPath(); c.moveTo(1.5, s); c.quadraticCurveTo(0, s * (8 + flap * 2), -2.5 + flap, s * (11 + flap * 1.5)); c.lineTo(-3.5, s * 10); c.quadraticCurveTo(-3, s * 4, -2.5, s); c.fill(); c.fillStyle = '#2a323a'; c.beginPath(); c.moveTo(-2.5 + flap, s * (11 + flap * 1.5)); c.lineTo(-3.5, s * 10); c.lineTo(-3.2, s * 7.5); c.lineTo(-1.6, s * 8); c.fill(); }
        c.strokeStyle = '#3a3a30'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-3, -0.4); c.lineTo(-8, -0.5); c.moveTo(-3, 0.4); c.lineTo(-8, 0.5); c.stroke();
      }
      c.fillStyle = lit(c, a, 4, '#a8b4c0', '#4a5868'); ellipse(c, -0.5, 0, 4, 2.2, 0); c.fill();
      c.fillStyle = 'rgba(30,40,50,0.5)'; c.beginPath(); c.moveTo(1, -1.8); c.quadraticCurveTo(-3, -2.4, -4.4, -0.4); c.lineTo(-4.4, 0.4); c.quadraticCurveTo(-3, 2.4, 1, 1.8); c.quadraticCurveTo(-1.5, 0, 1, -1.8); c.fill();
      // the long S-neck, drawn back and then shot forward to spear a fish
      const strike = a.state === 'strike' ? Math.sin(Math.min(1, a.actT / 0.9) * Math.PI) : 0;
      const preen = a.state === 'preen' ? Math.sin(t * 3) * 0.8 : 0;
      const nx = fly ? 6 : 3.5 + strike * 6, ny = fly ? 0 : Math.sin(t * 0.6 + a.seed) * 0.6 + preen * 2;
      c.strokeStyle = '#c8d0d8'; c.lineWidth = 1.3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(2, 0); c.bezierCurveTo(3.5, -1.8 * (1 - strike), nx - 2, 1.6 * (1 - strike), nx, ny); c.stroke();
      c.save(); c.translate(nx, ny); c.rotate(preen * 0.5);
      c.fillStyle = '#e8ecee'; circle(c, 0, 0, 1); c.fill();
      c.strokeStyle = '#1e2228'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-0.3, -0.5); c.lineTo(-2.5, -0.8); c.stroke();
      c.fillStyle = '#e0b030'; c.beginPath(); c.moveTo(0.6, -0.35); c.lineTo(4.2, 0); c.lineTo(0.6, 0.35); c.fill();
      eye(c, 0.2, -0.55, 0.2, 1, '#d8c020');
      c.restore();
      if (strike > 0.9 && a.wet > 0.5) { c.fillStyle = 'rgba(230,240,240,0.7)'; for (let i = 0; i < 4; i++) circle(c, nx + 3 + (i - 1.5), (i % 2 - 0.5) * 1.6, 0.35), c.fill(); }
    },
  };

  // ---------- frog ----------
  SPECIES.frog = {
    hab: 'shore', walk: 30, run: 60, fear: 40, turn: 9, len: 2, hops: true, lily: true,
    act(a) { return rng() < 0.75 ? ['croak', R(2, 6)] : ['walk']; },
    draw(c, a, t) {
      if (a.wet > 0.5) {
        // its own lily pad, rocking gently
        c.save(); c.rotate(-a.ang + a.seed); c.fillStyle = 'rgba(0,0,0,0.25)'; ellipse(c, 0.6, 0.8, 5, 4.6, 0); c.fill();
        c.fillStyle = linear(c, -5, -5, 5, 5, [[0, '#86a84a'], [1, '#3e5a22']]); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 5, 0.3, TAU - 0.1); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(30,50,20,0.5)'; c.lineWidth = 0.2; for (let i = 0; i < 6; i++) { const q = 0.6 + i * 0.95; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(q) * 4.6, Math.sin(q) * 4.6); c.stroke(); }
        c.restore();
      }
      const moving = a.speed > 0.5, hop = moving ? Math.abs(Math.sin(a.gait)) : 0;
      // back legs folded in a Z, kicked straight out mid-leap
      for (const s of [-1, 1]) {
        c.strokeStyle = '#4a6a2a'; c.lineWidth = 0.8; c.lineCap = 'round'; c.beginPath();
        if (hop > 0.3) { c.moveTo(-1, s * 1); c.lineTo(-4.5, s * 1.6); }
        else { c.moveTo(-1, s * 1.2); c.lineTo(0.4, s * 2.6); c.lineTo(-1.8, s * 2.4); }
        c.stroke();
        c.beginPath(); c.moveTo(1, s * 1); c.lineTo(1.8, s * 1.8); c.lineWidth = 0.5; c.stroke();
      }
      c.fillStyle = lit(c, a, 2.4, '#8ab84a', '#2e4a18'); ellipse(c, 0, 0, 2.2, 1.7, 0); c.fill();
      c.fillStyle = 'rgba(30,50,16,0.55)'; for (const [x, y] of [[-0.8, -0.6], [-0.4, 0.7], [0.6, -0.2]]) { circle(c, x, y, 0.35); c.fill(); }
      // the vocal sac puffing out as it croaks
      if (a.state === 'croak') { const k = Math.max(0, Math.sin(t * 5 + a.seed)); if (k > 0.2) { c.fillStyle = `rgba(240,236,200,${0.6 * k})`; circle(c, 2.1, 0, 0.6 + k * 0.9); c.fill(); } }
      for (const s of [-1, 1]) { c.fillStyle = '#7aa84a'; circle(c, 1.3, s * 0.85, 0.6); c.fill(); c.fillStyle = '#d8b030'; circle(c, 1.35, s * 0.85, 0.38); c.fill(); c.fillStyle = '#111'; c.fillRect(1.15, s * 0.85 - 0.08, 0.4, 0.16); }
    },
  };

  // ---------- turtle ----------
  SPECIES.turtle = {
    hab: 'shore', walk: 3, run: 9, fear: 55, turn: 1.6, len: 3, swims: true,
    act(a) { return rng() < 0.65 ? ['bask', R(8, 20)] : ['walk']; },
    draw(c, a, t) {
      const moving = a.speed > 0.3, inWater = a.wet > 0.5;
      if (inWater) { c.globalAlpha *= 0.55; }
      const head = a.state === 'bask' ? 0.5 + Math.sin(t * 0.3 + a.seed) * 0.5 : 1;
      for (const [x, s, ph] of [[2, -1, 0], [2, 1, Math.PI], [-2, -1, Math.PI], [-2, 1, 0]]) { c.fillStyle = '#5a6a3a'; ellipse(c, x + (moving ? Math.sin(a.gait + ph) * 0.6 : 0), s * 2.8, 0.9, 0.6, 0); c.fill(); }
      c.fillStyle = '#5a6a3a'; circle(c, 3.4 + head * 0.9, 0, 0.9); c.fill();
      c.fillStyle = '#d8a030'; c.fillRect(3.2 + head * 0.9, -0.2, 0.9, 0.12);
      c.fillStyle = lit(c, a, 3.6, '#7a7448', '#2a2a14'); ellipse(c, 0, 0, 3.4, 2.8, 0); c.fill();
      c.strokeStyle = 'rgba(20,20,10,0.6)'; c.lineWidth = 0.25;
      for (const [x, y] of [[0, 0], [1.6, -1.2], [1.6, 1.2], [-1.6, -1.2], [-1.6, 1.2]]) { c.beginPath(); for (let i = 0; i < 6; i++) { const q = i / 6 * TAU; c.lineTo(x + Math.cos(q) * 0.9, y + Math.sin(q) * 0.8); } c.closePath(); c.stroke(); }
      c.strokeStyle = 'rgba(220,160,60,0.6)'; c.lineWidth = 0.3; c.beginPath(); c.ellipse(0, 0, 3.4, 2.8, 0, 0, TAU); c.stroke();
      if (!inWater) { c.fillStyle = 'rgba(255,255,230,0.25)'; ellipse(c, -0.8, -0.9, 1.2, 0.5, -0.4); c.fill(); }
    },
  };

  // how far apart animals keep from one another
  const SPACE = { camel: 22, fennec: 12, lizard: 7, cow: 21, sheep: 12, chicken: 7, caribou: 19, raven: 8, rat: 6, hare: 9, fox: 12, gator: 30, heron: 14, frog: 7, turtle: 9, cat: 10, owl: 6 };
  const crowded = (x, y, kind, self) => list.some((b) => b !== self && b.kind === kind && dist2(b.x, b.y, x, y) < (SPACE[kind] || 8) ** 2);
  // shadow sizes (half length, half width) for each species
  const SHADOW = { camel: [12, 5], fennec: [5.8, 2.3], lizard: [3, 1], cow: [12, 6], sheep: [6.5, 4.8], chicken: [4.2, 2.8], cat: [5, 2], rat: [3, 1.3], raven: [3.2, 1.6], owl: [3.6, 3.2], caribou: [11, 4], fox: [5.8, 2.3], hare: [4, 2.6], gator: [15, 2.6], heron: [4, 2.2], frog: [2.2, 1.7], turtle: [3.4, 2.8] };

  // ============================================================ populating a map
  let perches = [], hasWater = false;
  const isWater = (x, y) => { const c = Math.floor(x / TILE), r = Math.floor(y / TILE); return c >= 0 && r >= 0 && c < COLS && r < ROWS && M.grid[r * COLS + c] === 3; };
  const nearWater = (x, y) => [[TILE, 0], [-TILE, 0], [0, TILE], [0, -TILE]].some(([dx, dy]) => isWater(x + dx, y + dy));
  function spawn(kind, x, y, extra = {}) {
    const a = { kind, x, y, ang: rng() * TAU, speed: 0, gait: rng() * TAU, state: 'idle', timer: R(0.3, 4), seed: Math.floor(rng() * 1000), turnBias: 0, z: 0, wet: 0, actT: 0, swishT: 0, fearCd: 0, ...extra };
    if (SPECIES[kind].init) SPECIES[kind].init(a);
    a.wet = isWater(x, y) ? 1 : 0;
    list.push(a);
    return a;
  }
  function group(kind, n, hab, spread = 30, at = null) {
    const c = at || randomSpot(hab);
    if (!c) return;
    const id = rng();
    for (let i = 0; i < n; i++) {
      let p = i ? null : c;
      for (let k = 0; k < 12 && !p; k++) { const q = pickSpot(c[0], c[1], SPACE[kind] || 6, spread + k * 3, hab); if (q && !crowded(q[0], q[1], kind)) p = q; }
      if (p) spawn(kind, p[0], p[1], { herd: id });
    }
  }
  function scatter(kind, n, hab, filter) {
    for (let i = 0; i < n; i++) for (let k = 0; k < 40; k++) { const p = randomSpot(hab); if (p && (!filter || filter(p[0], p[1]))) { spawn(kind, p[0], p[1]); break; } }
  }
  function start(m, l) {
    M = m; L = l; list = []; air = []; flocks = []; time = 0; flockT = 18 + (l.look.seed % 20);
    rng = mulberry32(l.look.seed + 2024);
    nightTime = l.look.time === 'night';
    hasWater = M.grid.some((g) => g === 3);
    const id = M.world.id;
    if (id === 'farmland') {
      if (rng() < 0.85) group('cow', 3 + Math.floor(rng() * 3), 'land', 44);
      if (rng() < 0.75) group('sheep', 4 + Math.floor(rng() * 4), 'land', 34);
      const barn = M.decor.find((d) => d.kind === 'barn');
      const at = barn && okAt(barn.x, barn.y + 34, 'land') ? [barn.x, barn.y + 34] : null;
      group('chicken', 4 + Math.floor(rng() * 4), 'land', 26, at);
      if (!nightTime) for (let i = 0; i < 5; i++) air.push({ kind: 'butterfly', x: R(0, W), y: R(0, H), ang: rng() * TAU, ph: rng() * TAU, col: ['#f2d040', '#f0f0e8', '#e88a30', '#8ab8f0'][Math.floor(rng() * 4)] });
    } else if (id === 'graveyard') {
      perches = M.decor.filter((d) => d.kind === 'deadtree' || d.kind === 'tomb' || d.kind === 'cross' || d.kind === 'crypt').map((d) => [d.x + (d.kind === 'deadtree' ? 0 : 0), d.y - (d.kind === 'deadtree' ? 2 : d.kind === 'crypt' ? 14 : 10)]);
      const nOwl = Math.min(perches.length, 1 + Math.floor(rng() * 3));
      for (let i = 0; i < nOwl; i++) { const p = perches[Math.floor(rng() * perches.length)]; spawn('owl', p[0], p[1], { perch: true, z: 7, state: 'look' }); }
      group('raven', 3 + Math.floor(rng() * 3), 'land', 46);
      if (rng() < 0.8) scatter('cat', 1, 'land');
      scatter('rat', 3 + Math.floor(rng() * 3), 'land');
    } else if (id === 'tundra') {
      if (rng() < 0.9) group('caribou', 4 + Math.floor(rng() * 4), 'land', 48);
      scatter('fox', 1 + Math.floor(rng() * 2), 'land');
      scatter('hare', 4 + Math.floor(rng() * 3), 'land');
    } else if (id === 'desert') {
      if (rng() < 0.85) group('camel', 2 + Math.floor(rng() * 3), 'land', 50);
      scatter('fennec', 1 + Math.floor(rng() * 2), 'land');
      scatter('lizard', 4 + Math.floor(rng() * 4), 'land');
    } else if (id === 'swamp') {
      const nG = 2 + Math.floor(rng() * 2);
      if (hasWater) scatter('gator', nG, 'water'); else scatter('gator', nG, 'land');
      if (hasWater) scatter('heron', 1 + Math.floor(rng() * 2), 'water', (x, y) => [[TILE, 0], [-TILE, 0], [0, TILE], [0, -TILE]].some(([dx, dy]) => okAt(x + dx, y + dy, 'land')));
      else scatter('heron', 1, 'land');
      scatter('frog', 6 + Math.floor(rng() * 4), hasWater ? 'water' : 'land');
      scatter('turtle', 2 + Math.floor(rng() * 2), 'land', hasWater ? nearWater : null);
      if (!nightTime) for (let i = 0; i < 6; i++) air.push({ kind: 'dragonfly', x: R(0, W), y: R(0, H), tx: R(0, W), ty: R(0, H), hover: R(0, 2), ph: rng() * TAU, col: ['#3a8ad0', '#40b070', '#c84a3a'][Math.floor(rng() * 3)] });
    }
  }

  // ============================================================ behaviour
  const habOf = (a) => (a.kind === 'gator' || a.kind === 'turtle' || a.kind === 'frog' || a.kind === 'heron' ? 'shore' : 'land');
  function nearestThreat(a, enemies, r) {
    let best = null, bd = r * r;
    for (const e of enemies) { if (e.dead || e.burrowed) continue; const d = dist2(e.x, e.y, a.x, a.y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function headFor(a, x, y, run) { a.tx = x; a.ty = y; a.state = run ? 'run' : 'walk'; a.actT = 0; }
  function flee(a, e, towers) {
    const Sp = SPECIES[a.kind];
    a.fearCd = 1.2;
    if (Sp.flies) {
      // take wing: owls to another perch, the rest to somewhere well away
      let to = null;
      if (Sp.perches && perches.length) { const far = perches.filter((p) => dist2(p[0], p[1], e.x, e.y) > 120 * 120); if (far.length) to = far[Math.floor(rng() * far.length)]; }
      if (!to) for (let i = 0; i < 20 && !to; i++) { const q = Math.atan2(a.y - e.y, a.x - e.x) + R(-1, 1), d = R(110, 220), x = a.x + Math.cos(q) * d, y = a.y + Math.sin(q) * d; if (okAt(x, y, a.kind === 'heron' && hasWater ? 'water' : 'land', towers)) to = [x, y]; }
      if (!to) return;
      Object.assign(a, { state: 'fly', fx: a.x, fy: a.y, tx: to[0], ty: to[1], flyT: 0, flyDur: Math.hypot(to[0] - a.x, to[1] - a.y) / Sp.flySpeed, z0: a.z, z1: Sp.perches ? 7 : 0 });
      return;
    }
    // water animals slip into the water when they can
    if ((a.kind === 'gator' || a.kind === 'turtle' || a.kind === 'frog') && hasWater && !a.wet) {
      const p = pickSpot(a.x, a.y, 10, 120, 'shore', towers, 24);
      if (p && isWater(p[0], p[1])) { headFor(a, p[0], p[1], true); return; }
    }
    if (a.wet && (a.kind === 'gator' || a.kind === 'turtle')) return; // already safe in the water
    // otherwise run: the best of several directions directly away from the threat
    let best = null, bs = -1;
    const away = Math.atan2(a.y - e.y, a.x - e.x);
    for (let i = 0; i < 12; i++) {
      const q = away + (i - 5.5) * 0.28, d = R(50, 100), x = a.x + Math.cos(q) * d, y = a.y + Math.sin(q) * d;
      if (!okAt(x, y, habOf(a), towers) || !clearPath(a.x, a.y, x, y, habOf(a), towers)) continue;
      const s = dist2(x, y, e.x, e.y);
      if (s > bs) { bs = s; best = [x, y]; }
    }
    if (best) headFor(a, best[0], best[1], true);
  }
  // Get off a spot that has just been built on, however this animal can: birds and owls take
  // wing (they cannot run), everything else bolts to the nearest open ground.
  function leave(a, towers) {
    const Sp = SPECIES[a.kind];
    if (Sp.flies) {
      const hab = a.kind === 'heron' && hasWater ? 'water' : 'land';
      const p = (Sp.perches && perches.length && perches.find((q) => dist2(q[0], q[1], a.x, a.y) > 90 * 90)) || pickSpot(a.x, a.y, 70, 170, hab, towers, 30, true) || pickSpot(a.x, a.y, 50, 260, 'land', towers, 60, true);
      if (p) Object.assign(a, { perch: Sp.perches ? a.perch : false, state: 'fly', fx: a.x, fy: a.y, tx: p[0], ty: p[1], flyT: 0, flyDur: Math.hypot(p[0] - a.x, p[1] - a.y) / Sp.flySpeed, z0: a.z, z1: Sp.perches ? 7 : 0 });
      return;
    }
    const p = pickSpot(a.x, a.y, 30, 90, habOf(a), towers, 40, 'ground') || pickSpot(a.x, a.y, 20, 160, habOf(a), towers, 60, 'ground') || pickSpot(a.x, a.y, 20, 160, habOf(a), towers, 60, true);
    if (p) headFor(a, p[0], p[1], true);
  }
  // A tower going down right beside animals startles them at once: birds take off (an owl
  // for another perch), the rest bolt away from it, swimmers too. Returns the kinds startled.
  function disturb(x, y, towers) {
    const kinds = new Set();
    if (!M) return kinds;
    for (const a of list) {
      if (a.state === 'fly') continue;
      const Sp = SPECIES[a.kind];
      if (dist2(a.x, a.y, x, y) > (40 + Sp.len * 1.2) ** 2) continue;
      kinds.add(a.kind);
      a.wet = 0;
      flee(a, { x, y }, towers);
      if (a.state !== 'fly' && a.state !== 'run') leave(a, towers);
      a.fearCd = 1.5;
    }
    return kinds;
  }
  function choose(a, towers) {
    const Sp = SPECIES[a.kind];
    const [act, dur] = Sp.act(a);
    if (act === 'walk') {
      // herds wander about their middle; the others roam
      let cx = a.x, cy = a.y;
      if (Sp.herd) { const h = list.filter((b) => b.herd === a.herd); cx = h.reduce((s, b) => s + b.x, 0) / h.length; cy = h.reduce((s, b) => s + b.y, 0) / h.length; }
      const hab = a.kind === 'heron' && a.wet ? 'water' : a.kind === 'frog' && hasWater ? (rng() < 0.7 ? 'water' : 'shore') : habOf(a);
      for (let k = 0; k < 4; k++) {
        const p = pickSpot(cx, cy, Sp.herd ? 8 : 20, Sp.herd ? 44 : a.kind === 'rat' ? 60 : 90, hab, towers);
        if (p && !crowded(p[0], p[1], a.kind, a) && (!Sp.herd || clearPath(a.x, a.y, p[0], p[1], hab, towers))) { headFor(a, p[0], p[1], false); return; }
      }
      a.state = 'look'; a.timer = 1; return;
    }
    if (act === 'flyoff') { const p = pickSpot(a.x, a.y, 60, 160, 'land', towers); if (p) Object.assign(a, { state: 'fly', fx: a.x, fy: a.y, tx: p[0], ty: p[1], flyT: 0, flyDur: Math.hypot(p[0] - a.x, p[1] - a.y) / Sp.flySpeed, z0: 0, z1: 0 }); else { a.state = 'look'; a.timer = 1; } return; }
    a.state = act; a.timer = dur; a.actT = 0;
    // a fox that has been listening may pounce on a mouse under the snow
    if ((a.kind === 'fox' || a.kind === 'fennec') && act === 'listen' && rng() < 0.6) a.pounceNext = true;
  }
  function step(a, dt, enemies, towers) {
    const Sp = SPECIES[a.kind];
    a.actT += dt; a.fearCd -= dt;
    if (a.kind === 'cow') { a.swishT = Math.max(0, a.swishT - dt); if (rng() < dt * 0.15) a.swishT = 0.9; }
    if (a.state === 'fly') {
      a.flyT += dt;
      const p = Math.min(1, a.flyT / a.flyDur), d = Math.hypot(a.tx - a.fx, a.ty - a.fy);
      a.x = lerp(a.fx, a.tx, p); a.y = lerp(a.fy, a.ty, p);
      a.z = lerp(a.z0, a.z1, p) + Math.sin(p * Math.PI) * Math.min(40, 10 + d * 0.2);
      a.ang = Math.atan2(a.ty - a.fy, a.tx - a.fx); a.speed = Sp.flySpeed;
      if (p >= 1) { a.z = a.z1; a.speed = 0; a.state = Sp.perches ? 'look' : 'look'; a.timer = R(1, 3); a.wet = isWater(a.x, a.y) ? 1 : 0; }
      return;
    }
    if (a.state !== 'run' && a.fearCd <= 0 && enemies.length) {
      const e = nearestThreat(a, enemies, Sp.fear);
      if (e) flee(a, e, towers);
    }
    if (a.state === 'walk' || a.state === 'run') {
      const run = a.state === 'run', hab = habOf(a);
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d < 2.5) { a.state = run ? 'look' : 'idle'; a.timer = run ? R(1.5, 3) : R(0.3, 1.5); a.speed *= 0.3; }
      else {
        const want = Math.atan2(dy, dx), diff = angDiff(a.ang, want), tr = Sp.turn * (run ? 2 : 1) * dt;
        a.ang += clamp(diff, -tr, tr); a.turnBias = clamp(diff, -1, 1);
        let target = (run ? Sp.run : Sp.walk) * (Math.abs(diff) > 1.3 ? 0.25 : 1);
        if (Sp.hops) target *= Math.sin(a.gait) > 0 ? 1.7 : 0.15;
        a.speed += (target - a.speed) * Math.min(1, dt * (Sp.hops ? 12 : 3));
        const nx = a.x + Math.cos(a.ang) * a.speed * dt, ny = a.y + Math.sin(a.ang) * a.speed * dt;
        // escaping a spot it may not stand on (a tower was just built there): any open ground will do,
        // and if it is facing a road or water it turns on the spot toward the way out
        const escaping = !okAt(a.x, a.y, hab, towers);
        if (okAt(nx, ny, hab, towers) || (escaping && ground(nx, ny, hab))) { a.x = nx; a.y = ny; }
        else if (escaping || (run && a.actT < 1.5)) a.speed = Math.min(a.speed, 4); // a startled animal gets a moment to turn round
        else { a.state = 'look'; a.timer = R(0.5, 1.5); a.speed = 0; }
      }
    } else {
      a.speed = Math.max(0, a.speed - dt * 20);
      a.timer -= dt;
      if (a.pounceNext && a.state === 'listen' && a.timer <= 0) { a.pounceNext = false; a.state = 'pounce'; a.timer = 1; a.actT = 0; }
      else if (a.timer <= 0) choose(a, towers);
      // shooed off a tile a tower now stands on
      if (!a.perch && !okAt(a.x, a.y, habOf(a), towers)) leave(a, towers);
    }
    a.gait += dt * (a.speed * (Sp.hops ? 0.5 : 0.75) / Math.max(1.5, Sp.len * 0.35) + (a.state === 'pounce' ? 0 : 0));
    a.wet = a.z < 1 && isWater(a.x, a.y) ? 1 : 0;
  }
  function update(dt, enemies, towers) {
    if (!M) return;
    time += dt;
    const live = enemies || [];
    for (const a of list) step(a, dt, live, towers);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.z > 0.5 || b.z > 0.5 || a.perch || b.perch) continue;
      const need = Math.min(SPACE[a.kind] || 8, SPACE[b.kind] || 8) * 0.75, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0.01 && d < need) {
        const push = (need - d) * Math.min(1, dt * 3), ux = dx / d, uy = dy / d;
        if (okAt(a.x - ux * push, a.y - uy * push, habOf(a), towers)) { a.x -= ux * push; a.y -= uy * push; }
        if (okAt(b.x + ux * push, b.y + uy * push, habOf(b), towers)) { b.x += ux * push; b.y += uy * push; }
      }
    }
    const calm = !['rain', 'storm', 'tornado', 'blizzard', 'acid', 'dust'].includes(WEATHER.kind);
    for (const b of air) {
      b.hidden = !calm;
      if (b.kind === 'butterfly') {
        b.ang += Math.sin(time * 1.3 + b.ph) * dt * 2.4; b.x += Math.cos(b.ang) * 14 * dt; b.y += Math.sin(b.ang) * 14 * dt;
        const e = nearestThreat(b, live, 40); if (e) b.ang = Math.atan2(b.y - e.y, b.x - e.x);
      } else {
        b.hover -= dt;
        if (b.hover <= 0) { const d = Math.hypot(b.tx - b.x, b.ty - b.y); if (d < 3) { b.hover = R(0.5, 2.5); b.tx = clamp(b.x + R(-120, 120), 10, W - 10); b.ty = clamp(b.y + R(-90, 90), 10, H - 10); } else { const k = Math.min(1, dt * 140 / d); b.x += (b.tx - b.x) * k; b.y += (b.ty - b.y) * k; } }
        b.ang = Math.atan2(b.ty - b.y, b.tx - b.x);
      }
      if (b.x < -10) b.x = W + 10; else if (b.x > W + 10) b.x = -10;
      if (b.y < -10) b.y = H + 10; else if (b.y > H + 10) b.y = -10;
    }
    // now and then a flock crosses the sky
    flockT -= dt;
    if (flockT <= 0) { flockT = R(40, 85); spawnFlock(); }
    for (const f of flocks) f.t += dt;
    flocks = flocks.filter((f) => f.t < f.dur);
  }
  function spawnFlock() {
    const id = M.world.id, kind = id === 'graveyard' || id === 'desert' ? 'ravens' : id === 'swamp' ? 'egrets' : 'geese';
    const fromLeft = rng() < 0.5, y0 = R(H * 0.15, H * 0.85), ang = (fromLeft ? 0 : Math.PI) + R(-0.35, 0.35);
    const n = kind === 'ravens' ? 5 + Math.floor(rng() * 4) : 6 + Math.floor(rng() * 6);
    const birds = Array.from({ length: n }, (_, i) => { const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1; return { ox: -row * 14, oy: side * row * 10, ph: rng() * TAU }; });
    flocks.push({ kind, x0: fromLeft ? -60 : W + 60, y0, ang, birds, t: 0, dur: kind === 'ravens' ? 26 : 22, cx: R(W * 0.3, W * 0.7), cy: R(H * 0.3, H * 0.7), snow: id === 'tundra' });
  }

  // ============================================================ drawing
  function drawAnimal(c, a, t) {
    const sh = SHADOW[a.kind] || [3, 2], lift = a.z;
    shadow(c, a.x + lift * 0.6, a.y + lift * 0.8, sh[0] * (1 - Math.min(0.4, lift / 80)), sh[1], a.ang, (a.wet && (a.kind === 'gator' || a.kind === 'turtle') ? 0.08 : 0.26) * (1 - Math.min(0.6, lift / 60)));
    c.save();
    // hoppers rise off the ground on each bound
    let hopZ = 0;
    if ((a.kind === 'hare' || a.kind === 'frog') && a.speed > 0.5) hopZ = Math.max(0, Math.sin(a.gait)) * (a.kind === 'frog' ? 2.5 : 2);
    if ((a.kind === 'fox' || a.kind === 'fennec') && a.state === 'pounce') hopZ = Math.sin(Math.min(1, a.actT) * Math.PI) * 6;
    c.translate(a.x, a.y - (lift + hopZ) * 0.82);
    c.rotate(a.ang);
    SPECIES[a.kind].draw(c, a, t);
    c.restore();
  }
  function drawBird(c, kind, x, y, ang, t, ph, scale, snow) {
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(scale, scale);
    const flap = Math.sin(t * (kind === 'ravens' ? 9 : 6) + ph);
    const col = kind === 'ravens' ? ['#141418', '#2a2a32'] : kind === 'egrets' ? ['#f4f4f0', '#b8bcc0'] : snow ? ['#f2f4f6', '#3a3a3e'] : ['#7a6a58', '#2a2420'];
    for (const s of [-1, 1]) {
      c.fillStyle = col[0]; c.beginPath(); c.moveTo(1.5, s * 0.8); c.quadraticCurveTo(0, s * (5 + flap * 2), -2 + flap * 1.5, s * (8 + flap * 1.5)); c.quadraticCurveTo(-2, s * 3, -1.5, s * 0.8); c.fill();
      c.fillStyle = col[1]; c.beginPath(); c.moveTo(-2 + flap * 1.5, s * (8 + flap * 1.5)); c.lineTo(-2.6, s * 6.5); c.lineTo(-1.2, s * 6); c.fill();
    }
    c.fillStyle = col[0]; ellipse(c, 0, 0, 3.4, 1.1, 0); c.fill();
    if (kind === 'geese') { c.fillStyle = snow ? '#f2f4f6' : '#1a1a1a'; ellipse(c, 4.2, 0, 1.6, 0.6, 0); c.fill(); c.fillStyle = snow ? '#e8a060' : '#2a2a2a'; ellipse(c, 5.9, 0, 0.6, 0.35, 0); c.fill(); }
    else if (kind === 'egrets') { c.strokeStyle = '#f4f4f0'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(3, 0); c.lineTo(4.6, 0); c.stroke(); c.fillStyle = '#e8c040'; c.beginPath(); c.moveTo(4.6, -0.3); c.lineTo(6.6, 0); c.lineTo(4.6, 0.3); c.fill(); c.strokeStyle = '#2a2a24'; c.lineWidth = 0.35; c.beginPath(); c.moveTo(-3, 0); c.lineTo(-6, 0); c.stroke(); }
    else { c.fillStyle = col[0]; circle(c, 3.6, 0, 1); c.fill(); c.beginPath(); c.moveTo(-3, -0.8); c.lineTo(-5.2, 0); c.lineTo(-3, 0.8); c.fill(); }
    c.restore();
  }
  function drawAir(c, t) {
    if (!M) return;
    for (const a of list) if (a.z > 0.5 || a.perch) drawAnimal(c, a, t);
    for (const b of air) {
      if (b.hidden) continue;
      if (b.kind === 'butterfly') {
        const f = Math.abs(Math.sin(t * 16 + b.ph));
        c.save(); c.translate(b.x, b.y - 6 - Math.sin(t * 3 + b.ph) * 2); c.rotate(b.ang);
        c.fillStyle = 'rgba(0,0,0,0.15)'; ellipse(c, 3, 6, 1.6, 2 * f, 0); c.fill();
        for (const s of [-1, 1]) { c.fillStyle = b.col; ellipse(c, 0.5, s * 1.5 * f, 1.3, 1.5 * f, 0); c.fill(); ellipse(c, -0.9, s * 1.1 * f, 0.9, 1 * f, 0); c.fill(); c.fillStyle = 'rgba(0,0,0,0.35)'; circle(c, 0.6, s * 1.6 * f, 0.3); c.fill(); }
        c.fillStyle = '#2a2420'; ellipse(c, 0, 0, 1.4, 0.3, 0); c.fill();
        c.restore();
      } else {
        c.save(); c.translate(b.x, b.y - 8); c.rotate(b.ang);
        c.fillStyle = 'rgba(0,0,0,0.12)'; ellipse(c, 4, 7, 2.4, 0.5, 0); c.fill();
        c.fillStyle = 'rgba(220,235,245,0.45)'; for (const s of [-1, 1]) for (const o of [0.6, -0.6]) { ellipse(c, o, s * 2, 0.6, 2.2 + Math.sin(t * 60 + o) * 0.2, 0); c.fill(); }
        c.strokeStyle = b.col; c.lineWidth = 0.7; c.lineCap = 'round'; c.beginPath(); c.moveTo(1.6, 0); c.lineTo(-4, 0); c.stroke();
        c.fillStyle = shade(b.col, 0.2); circle(c, 1.8, 0, 0.6); c.fill();
        c.restore();
      }
    }
    for (const f of flocks) {
      const k = f.t / f.dur;
      for (const b of f.birds) {
        let x, y, ang;
        if (f.kind === 'ravens') {
          // ravens wheel round over the graves, then drift away
          const q = f.t * 0.45 + b.ph, r = 70 + b.ox * 0.8;
          x = f.cx + Math.cos(q) * r + (k > 0.7 ? (k - 0.7) * 1200 : 0); y = f.cy + Math.sin(q) * r * 0.7; ang = q + Math.PI / 2;
        } else {
          const d = f.t * 70, ca = Math.cos(f.ang), sa = Math.sin(f.ang);
          x = f.x0 + ca * (d + b.ox) - sa * b.oy; y = f.y0 + sa * (d + b.ox) + ca * b.oy; ang = f.ang;
        }
        c.fillStyle = 'rgba(0,0,0,0.12)'; ellipse(c, x + 26, y + 34, 4, 1.4, ang); c.fill();
        drawBird(c, f.kind, x, y, ang, t, b.ph, 1.1, f.snow);
      }
    }
  }
  // ground animals take their place in the depth sort with towers and zombies
  function units() { return list.filter((a) => a.z <= 0.5 && !a.perch); }

  return { start, update, disturb, units, draw: drawAnimal, drawAir, SPECIES, get list() { return list; } };
})();
