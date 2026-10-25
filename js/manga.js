'use strict';
// ============================================================
// Manga art kit for the story cutscenes: ink, screentones, speed lines, silhouettes,
// character portraits and the scenes themselves. Black ink on paper with one spot colour
// per scene, drawn at device resolution so lines stay crisp.
// ============================================================
const MANGA = (() => {
  const INK = '#101010', PAPER = '#f2eee4', GREY = '#8a8a88';
  const SPOT = { green: '#52e07c', red: '#e0453a', amber: '#f0b04a', purple: '#b866ff', ice: '#8fd8ff', orange: '#ff8a3a' };
  const patterns = new WeakMap();

  // ---------- screentone ----------
  // A diamond-lattice halftone; d is how dark (0 white to 1 solid), cell the dot spacing in pixels.
  function tone(c, d, cell = 5, col = INK) {
    let m = patterns.get(c);
    if (!m) { m = new Map(); patterns.set(c, m); }
    const key = `${d.toFixed(2)}|${cell}|${col}`;
    let p = m.get(key);
    if (!p) {
      const cv = document.createElement('canvas'); cv.width = cv.height = cell * 2;
      const g = cv.getContext('2d'), r = cell * 0.62 * Math.sqrt(d);
      g.fillStyle = col;
      for (const [x, y] of [[0, 0], [cell * 2, 0], [0, cell * 2], [cell * 2, cell * 2], [cell, cell]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
      p = c.createPattern(cv, 'repeat');
      m.set(key, p);
    }
    return p;
  }
  // a tone that fades from d0 to d1 along a direction, built from dots of changing size
  function gradTone(c, x0, y0, x1, y1, d0, d1, cell = 5, col = INK, rect = null) {
    const [rx, ry, rw, rh] = rect || [Math.min(x0, x1) - cell, Math.min(y0, y1) - cell, Math.abs(x1 - x0) + cell * 2, Math.abs(y1 - y0) + cell * 2];
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
    c.fillStyle = col;
    for (let y = ry, row = 0; y < ry + rh; y += cell, row++) {
      for (let x = rx + (row % 2 ? cell / 2 : 0); x < rx + rw; x += cell) {
        const k = clamp(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1), d = lerp(d0, d1, k);
        if (d <= 0.01) continue;
        c.beginPath(); c.arc(x, y, cell * 0.62 * Math.sqrt(d), 0, TAU); c.fill();
      }
    }
  }
  // radial focus lines around a clear centre
  function focusLines(c, cx, cy, w, h, n, inner, col = INK, seed = 1) {
    const rng = mulberry32(seed), R = Math.hypot(w, h);
    c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, spread = 0.004 + rng() * 0.012, r0 = inner * (0.85 + rng() * 0.5);
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * (h / w));
      c.lineTo(cx + Math.cos(a - spread) * R, cy + Math.sin(a - spread) * R);
      c.lineTo(cx + Math.cos(a + spread) * R, cy + Math.sin(a + spread) * R); c.closePath(); c.fill();
    }
  }
  // parallel motion lines, thick at one end and tapering
  function motionLines(c, x, y, w, h, ang, n, col = INK, seed = 2) {
    const rng = mulberry32(seed), ca = Math.cos(ang), sa = Math.sin(ang);
    c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const px = x + rng() * w, py = y + rng() * h, len = (0.2 + rng() * 0.5) * w, th = 0.6 + rng() * 2.2;
      c.beginPath(); c.moveTo(px - sa * th, py + ca * th); c.lineTo(px + ca * len, py + sa * len); c.lineTo(px + sa * th, py - ca * th); c.closePath(); c.fill();
    }
  }
  const poly = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
  const glow = (c, x, y, r, col, a = 1) => {
    const [cr, cg, cb] = hexRgb(col);
    const g = c.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  };
  // paint a spot colour over ink as if it were printed on top
  function spot(c, col, fn, a = 1) { c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = a; c.fillStyle = col; fn(); c.restore(); }
  function stars(c, w, h, n, seed = 5) { const rng = mulberry32(seed); c.fillStyle = PAPER; for (let i = 0; i < n; i++) { const r = rng() < 0.08 ? 1.6 : 0.8; c.beginPath(); c.arc(rng() * w, rng() * h * 0.7, r * (w / 600 + 0.6), 0, TAU); c.fill(); } }
  // night-sky tone: dark at the top easing toward the horizon
  function sky(c, w, h, top = 0.95, bot = 0.45, horizon = 0.7) {
    c.fillStyle = tone(c, top, 4); c.fillRect(0, 0, w, h);
    c.fillStyle = INK; c.globalAlpha = 0.85; c.fillRect(0, 0, w, h * 0.25); c.globalAlpha = 1;
    gradTone(c, 0, h * 0.2, 0, h * horizon, top, bot, 4, INK, [0, h * 0.18, w, h * (horizon - 0.18) + 4]);
  }

  // ---------- figures ----------
  // A soldier silhouette with a helmet and rifle, about h tall, feet at (x, y). rim draws a light edge.
  // append a closed polygon to the current path (poly starts a fresh one)
  const sub = (c, pts) => { pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
  const ell = (c, x, y, rx, ry, rot = 0, a0 = 0, a1 = TAU) => { c.moveTo(x + Math.cos(a0) * rx * Math.cos(rot) - Math.sin(a0) * ry * Math.sin(rot), y + Math.cos(a0) * rx * Math.sin(rot) + Math.sin(a0) * ry * Math.cos(rot)); c.ellipse(x, y, rx, ry, rot, a0, a1); };
  function soldier(c, x, y, h, o = {}) {
    const s = h / 100, f = o.face || 1;
    c.save(); c.translate(x, y); c.scale(s * f, s);
    const shape = () => {
      c.beginPath();
      c.moveTo(-10, -87); c.bezierCurveTo(-10.5, -99, 10, -99, 10.5, -88); c.lineTo(13, -86); c.lineTo(-11, -85); c.closePath(); // helmet
      sub(c, [[-6, -87], [6, -87], [6.5, -79], [3, -75], [-5, -75]]);
      sub(c, [[-13, -76], [10, -76], [14, -66], [13, -44], [-12, -44], [-15, -64]]);
      sub(c, [[-20, -73], [-12, -76], [-12, -50], [-20, -53]]); // pack
      sub(c, [[-12, -46], [12, -46], [13, -38], [-13, -38]]);
      sub(c, [[-12, -40], [-2, -40], [-5, -20], [-6, 0], [-15, 0], [-13, -3], [-11, -20]]);
      sub(c, [[0, -40], [12, -40], [13, -22], [16, -3], [19, 0], [7, 0], [6, -20]]);
      sub(c, [[-4, -64], [43, -58.5], [43, -55], [18, -54], [16, -48], [10, -48], [10, -54], [-2, -56]]); // rifle
      sub(c, [[4, -73], [12, -61], [18, -59], [16, -53], [8, -55], [0, -65]]); // arm
    };
    if (o.rim) { c.save(); c.translate(-2.2, -1.2); shape(); c.fillStyle = o.rim; c.fill(); c.restore(); }
    shape(); c.fillStyle = o.col || INK; c.fill();
    c.restore();
  }
  function zombie(c, x, y, h, o = {}) {
    const s = h / 100, f = o.face || 1, lean = o.lean ?? 0.25;
    c.save(); c.translate(x, y); c.scale(s * f, s);
    const shape = () => {
      c.beginPath();
      sub(c, [[-11, -46], [-2, -46], [-4, -22], [-8, 0], [-17, 0], [-12, -22]]);
      sub(c, [[-2, -46], [9, -46], [11, -24], [15, -3], [18, 0], [7, 0], [3, -22]]);
      c.save(); c.translate(0, -44); c.rotate(lean);
      sub(c, [[-12, -36], [4, -38], [12, -30], [11, -2], [8, 3], [4, -1], [1, 4], [-3, 0], [-7, 5], [-10, 0], [-14, 3], [-14, -24]]);
      ell(c, 6, -43, 7.5, 8.5, 0.2);
      sub(c, [[6, -34], [26, -31], [38, -28], [39, -23], [26, -25], [5, -27]]);
      sub(c, [[2, -28], [22, -21], [34, -16], [34, -11], [22, -15], [0, -21]]);
      c.restore();
    };
    if (o.rim) { c.save(); c.translate(-2, -1.4); shape(); c.fillStyle = o.rim; c.fill(); c.restore(); }
    shape(); c.fillStyle = o.col || INK; c.fill();
    if (o.eyes) { c.save(); c.translate(0, -44); c.rotate(lean); c.fillStyle = o.eyes; c.beginPath(); c.arc(10, -44, 1.6, 0, TAU); c.fill(); c.restore(); }
    c.restore();
  }
  function cornRow(c, w, y, h, seed, col = INK) {
    const rng = mulberry32(seed); c.strokeStyle = col; c.fillStyle = col; c.lineCap = 'round';
    for (let x = -10; x < w + 10; x += h * 0.12 + rng() * h * 0.1) {
      const hh = h * (0.7 + rng() * 0.4), bend = (rng() - 0.5) * h * 0.15;
      c.lineWidth = Math.max(1, h * 0.03); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + bend * 0.5, y - hh * 0.5, x + bend, y - hh); c.stroke();
      for (let k = 0; k < 4; k++) { const ly = y - hh * (0.3 + k * 0.17), dir = k % 2 ? 1 : -1; c.beginPath(); c.moveTo(x + bend * (0.3 + k * 0.15), ly); c.quadraticCurveTo(x + dir * h * 0.15, ly - h * 0.05, x + dir * h * 0.22, ly + h * 0.06); c.lineWidth = Math.max(0.8, h * 0.02); c.stroke(); }
    }
  }
  function farmhouse(c, x, y, s, col = INK) {
    c.fillStyle = col;
    poly(c, [[x, y], [x, y - s * 0.5], [x + s * 0.5, y - s * 0.9], [x + s, y - s * 0.5], [x + s, y]]); c.fill();
    c.fillRect(x + s * 1.05, y - s * 1.1, s * 0.3, s * 1.1); c.beginPath(); c.arc(x + s * 1.2, y - s * 1.1, s * 0.15, Math.PI, TAU); c.fill();
  }

  // ---------- portraits ----------
  // Bust of a named character, head centred at (cx, cy), s = head height. Lit hard from the left:
  // the far side of the face drops into solid ink with a thin reflected-light rim.
  // o.mood: calm, grim, shout, smile, tired. o.turn: -1..1. o.glasses: lens colour. o.parka: hood up.
  function bust(c, who, cx, cy, s, o = {}) {
    const mood = o.mood || 'calm', turn = clamp(o.turn || 0, -0.6, 0.6), lw = Math.max(1.1, s * 0.011);
    const W = s * (who === 'moreno' ? 0.37 : who === 'laila' ? 0.32 : 0.33), T = turn * W * 0.35;
    const dark = who === 'okafor', litTone = dark ? 0.38 : who === 'crane' ? 0.22 : 0;
    c.save(); c.translate(cx, cy); c.lineJoin = 'round'; c.lineCap = 'round';
    const fill = (d) => (d <= 0 ? PAPER : tone(c, d, 4));
    // screentone is dots on clear, so toned areas get a paper base first
    const solid = (d, cell = 4) => { c.fillStyle = PAPER; c.fill(); if (d > 0) { c.fillStyle = tone(c, d, cell); c.fill(); } };

    // Laila's long waves fall behind the shoulders, so the back of her hair goes down first
    const HAIR = '#f0a060';
    const strands = (shape, n, seed, x0, x1, y0, y1, col, w) => {
      const rng = mulberry32(seed); c.save(); shape(); c.clip(); c.strokeStyle = col; c.lineWidth = w;
      for (let i = 0; i < n; i++) {
        const bx = lerp(x0, x1, rng()), ph = rng() * TAU, fan = (bx - (x0 + x1) / 2) / s * 0.35;
        c.beginPath();
        for (let y = y0; y <= y1; y += s * 0.04) { const k = (y - y0) / (y1 - y0), x = bx + fan * (y - y0) + Math.sin(k * 7 + ph) * W * 0.09 * k; y === y0 ? c.moveTo(x, y) : c.lineTo(x, y); }
        c.stroke();
      }
      c.restore();
    };
    // a wavy lock of hair from (x0, y0) to (x1, y1), w0 wide at the root and w1 at its widest,
    // tapering to a point; its strands follow the same S-curve
    const lock = (x0, y0, x1, y1, w0, w1, ph, amp = W * 0.3, freq = 2.6) => {
      const n = 28, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), px = -dy / len, py = dx / len;
      const at = (k, off) => { const wv = Math.sin(k * freq * Math.PI + ph) * amp * Math.min(1, k * 2.2), hw = (k < 0.8 ? lerp(w0, w1, k / 0.8) : w1 * (1 - (k - 0.8) / 0.2 * 0.92)) / 2 * (k < 0.08 ? 0.6 + k * 5 : 1); return [x0 + dx * k + px * (wv + off * hw), y0 + dy * k + py * (wv + off * hw)]; };
      const shape = () => { c.beginPath(); for (let i = 0; i <= n; i++) { const q = at(i / n, -1); i ? c.lineTo(...q) : c.moveTo(...q); } for (let i = n; i >= 0; i--) c.lineTo(...at(i / n, 1)); c.closePath(); };
      shape.strands = (col, m, w, seed) => { const rng = mulberry32(seed); c.save(); shape(); c.clip(); c.strokeStyle = col; for (let j = 0; j < m; j++) { const off = rng() * 2 - 1, k0 = rng() * 0.25, k1 = 0.6 + rng() * 0.4; c.lineWidth = w * (0.6 + rng() * 0.8); c.beginPath(); for (let i = 0; i <= 20; i++) { const q = at(lerp(k0, k1, i / 20), off * (0.9 - 0.3 * i / 20)); i ? c.lineTo(...q) : c.moveTo(...q); } c.stroke(); } c.restore(); };
      return shape;
    };
    // light hair: paper with fine ink strands where lit, dark tone with paper strands in shadow
    const hairFill = (shape, lit, seed) => {
      shape(); solid(lit ? 0.08 : 0.75, 3);
      if (shape.strands) shape.strands(lit ? INK : PAPER, lit ? 9 : 7, lw * 0.6, seed);
      else strands(shape, lit ? 40 : 30, seed, -s * 1.3, s * 1.3, -s * 0.7, s * 1.6, lit ? INK : PAPER, lw * 0.55);
      spot(c, HAIR, () => { shape(); c.fill(); }, 0.42);
      shape(); c.strokeStyle = INK; c.lineWidth = lw * 1.3; c.stroke();
    };
    if (who === 'laila') {
      c.beginPath(); c.moveTo(-W * 1.05, -s * 0.3); c.lineTo(W * 1.05, -s * 0.3); c.lineTo(W * 1.25, s * 0.7); c.lineTo(-W * 1.25, s * 0.7); c.closePath(); c.fillStyle = tone(c, 0.85, 3); c.fill();
      for (const [x1, y1, w0, w1, ph, sd, sdN] of [[-2.1, 1.55, 0.7, 1.1, 0.3, -1, 21], [-1.55, 1.6, 0.6, 0.9, 1.9, -1, 23], [2.1, 1.5, 0.7, 1.1, 1.2, 1, 22], [1.55, 1.58, 0.6, 0.9, 2.8, 1, 24]])
        hairFill(lock(sd * W * 0.9, -s * 0.5, x1 * W, y1 * s, w0 * W, w1 * W, ph), sd < 0, sdN);
    }

    // ---- shoulders and clothing ----
    const torso = () => poly(c, [[-s * 1.05, s * 1.5], [-s * 0.98, s * 1.02], [-s * 0.55, s * 0.74], [-s * 0.16, s * 0.6], [s * 0.16, s * 0.6], [s * 0.55, s * 0.74], [s * 0.98, s * 1.02], [s * 1.05, s * 1.5]]);
    torso();
    solid(who === 'okafor' && !o.parka ? 0 : who === 'crane' ? 0.45 : who === 'laila' ? 0.1 : 0.7, 5);
    c.save(); torso(); c.clip();
    c.fillStyle = INK; poly(c, [[s * 0.15, s * 0.6], [s * 1.2, s * 0.85], [s * 1.2, s * 1.6], [s * 0.3, s * 1.6]]); c.fill();
    c.strokeStyle = INK; c.lineWidth = lw;
    for (const [x0, y0, x1, y1] of [[-s * 0.7, s * 0.95, -s * 0.45, s * 1.5], [-s * 0.35, s * 0.8, -s * 0.28, s * 1.5], [-s * 0.85, s * 1.15, -s * 0.6, s * 1.5]]) { c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + s * 0.08, (y0 + y1) / 2, x1, y1); c.stroke(); }
    if (who === 'voss') { poly(c, [[-s * 0.75, s * 0.88], [-s * 0.42, s * 0.8], [-s * 0.4, s * 0.95], [-s * 0.73, s * 1.02]]); c.fillStyle = PAPER; c.fill(); c.stroke(); c.fillStyle = INK; for (let i = 0; i < 3; i++) poly(c, [[-s * 0.68 + i * s * 0.08, s * 0.92], [-s * 0.64 + i * s * 0.08, s * 0.86], [-s * 0.6 + i * s * 0.08, s * 0.92]]), c.fill(); }
    if (who === 'laila') {
      // an open plaid flannel over a white tank, the rifle sling across her chest
      c.fillStyle = tone(c, 0.5, 3);
      for (let x = -s * 1.2; x < s * 1.2; x += s * 0.26) c.fillRect(x, s * 0.5, s * 0.09, s * 1.2);
      for (let y = s * 0.62; y < s * 1.6; y += s * 0.26) c.fillRect(-s * 1.2, y, s * 2.4, s * 0.09);
      c.fillStyle = INK; for (let x = -s * 1.2; x < s * 1.2; x += s * 0.26) for (let y = s * 0.62; y < s * 1.6; y += s * 0.26) c.fillRect(x, y, s * 0.09, s * 0.09);
      c.lineWidth = lw * 0.5; for (let x = -s * 1.07; x < s * 1.2; x += s * 0.26) { c.beginPath(); c.moveTo(x, s * 0.5); c.lineTo(x, s * 1.7); c.stroke(); }
      poly(c, [[-W * 0.62, s * 0.62], [-W * 0.2, s * 1.6], [W * 0.25, s * 1.6], [W * 0.62, s * 0.62]]); c.fillStyle = PAPER; c.fill(); c.lineWidth = lw * 1.3; c.stroke();
      c.fillStyle = tone(c, 0.4, 3); poly(c, [[W * 0.15, s * 0.62], [W * 0.05, s * 1.6], [W * 0.25, s * 1.6], [W * 0.62, s * 0.62]]); c.fill();
      for (const sd of [-1, 1]) { poly(c, [[sd * W * 0.5, s * 0.55], [sd * W * 1.35, s * 0.7], [sd * W * 0.75, s * 0.98]]); c.fillStyle = sd > 0 ? INK : PAPER; c.fill(); c.lineWidth = lw * 1.2; c.strokeStyle = INK; c.stroke(); }
      c.fillStyle = INK; poly(c, [[-s * 1.1, s * 0.86], [-s * 0.94, s * 0.78], [s * 0.42, s * 1.6], [s * 0.18, s * 1.6]]); c.fill();
      c.strokeStyle = PAPER; c.lineWidth = lw * 0.5; c.setLineDash([lw * 2, lw * 2]); c.beginPath(); c.moveTo(-s * 1.02, s * 0.84); c.lineTo(s * 0.3, s * 1.6); c.stroke(); c.setLineDash([]);
    }
    if (who === 'moreno') { c.fillStyle = INK; c.fillRect(-s * 0.7, s * 0.95, s * 1.4, s * 0.12); c.fillStyle = tone(c, 0.5, 3); for (let i = -2; i <= 1; i++) c.fillRect(i * s * 0.3 + s * 0.04, s * 1.12, s * 0.2, s * 0.26); }
    if (who === 'okafor' && !o.parka) { c.fillStyle = tone(c, 0.6); poly(c, [[-s * 0.16, s * 0.6], [0, s * 1.5], [s * 0.16, s * 0.6]]); c.fill(); c.beginPath(); c.moveTo(-s * 0.17, s * 0.62); c.lineTo(-s * 0.4, s * 1.5); c.moveTo(s * 0.17, s * 0.62); c.lineTo(s * 0.4, s * 1.5); c.stroke(); c.fillStyle = PAPER; c.fillRect(-s * 0.62, s * 1.08, s * 0.18, s * 0.05); c.strokeRect(-s * 0.62, s * 1.08, s * 0.18, s * 0.05); }
    c.restore();
    torso(); c.strokeStyle = INK; c.lineWidth = lw * 1.6; c.stroke();
    // collar
    if (who === 'voss' || who === 'moreno') {
      for (const sd of [-1, 1]) { poly(c, [[sd * W * 0.5, s * 0.46], [sd * W * 1.25, s * 0.66], [sd * W * 0.95, s * 0.84], [sd * W * 0.38, s * 0.66]]); c.fillStyle = sd > 0 ? INK : tone(c, 0.55); c.fill(); c.lineWidth = lw * 1.3; c.strokeStyle = INK; c.stroke(); }
    }

    // ---- neck with the jaw's cast shadow ----
    poly(c, [[-W * 0.42, s * 0.28], [-W * 0.46, s * 0.68], [W * 0.46, s * 0.68], [W * 0.42, s * 0.28]]);
    solid(litTone + 0.12); c.lineWidth = lw; c.stroke();
    c.fillStyle = INK; c.beginPath(); c.moveTo(-W * 0.46, s * 0.4); c.quadraticCurveTo(0, s * 0.58, W * 0.46, s * 0.36); c.lineTo(W * 0.46, s * 0.3); c.lineTo(-W * 0.46, s * 0.3); c.fill();
    if (who === 'moreno') { c.strokeStyle = INK; c.lineWidth = lw * 0.9; c.beginPath(); c.moveTo(-W * 0.1, s * 0.5); c.lineTo(0, s * 0.55); c.stroke(); }
    if (who === 'laila') {
      // the gold chain with the round red pendant
      c.strokeStyle = INK; c.lineWidth = lw * 0.9; c.setLineDash([lw * 1.2, lw * 0.8]);
      c.beginPath(); c.moveTo(-W * 0.46, s * 0.5); c.quadraticCurveTo(-W * 0.2, s * 1.02, 0, s * 1.03); c.quadraticCurveTo(W * 0.2, s * 1.02, W * 0.46, s * 0.5); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.arc(0, s * 1.08, s * 0.05, 0, TAU); c.fillStyle = PAPER; c.fill(); c.lineWidth = lw * 1.1; c.stroke();
      c.beginPath(); c.arc(0, s * 1.08, s * 0.03, 0, TAU); c.fillStyle = SPOT.red; c.fill();
      c.fillStyle = PAPER; c.beginPath(); c.arc(-s * 0.01, s * 1.07, s * 0.008, 0, TAU); c.fill();
    }

    // ---- head: angular, with cheekbones and a defined jaw ----
    const jawX = who === 'moreno' ? 0.9 : who === 'crane' ? 0.62 : who === 'laila' ? 0.7 : 0.74, jawY = who === 'moreno' ? 0.36 : who === 'laila' ? 0.33 : 0.3;
    const face = () => {
      c.beginPath();
      c.moveTo(T, -s * 0.6);
      c.bezierCurveTo(W * 0.75 + T, -s * 0.6, W * 1.02, -s * 0.42, W * 1.0, -s * 0.16);
      c.quadraticCurveTo(W * 1.02, s * 0.02, W * 0.95, s * 0.1);
      c.quadraticCurveTo(W * jawX * 1.08, jawY * s * 0.9, W * jawX, s * jawY);
      c.quadraticCurveTo(W * 0.35 + T, s * 0.47, W * 0.12 + T, s * 0.5);
      c.lineTo(-W * 0.12 + T, s * 0.5);
      c.quadraticCurveTo(-W * 0.35 + T, s * 0.47, -W * jawX, s * jawY);
      c.quadraticCurveTo(-W * jawX * 1.08, jawY * s * 0.9, -W * 0.95, s * 0.1);
      c.quadraticCurveTo(-W * 1.02, s * 0.02, -W * 1.0, -s * 0.16);
      c.bezierCurveTo(-W * 1.02, -s * 0.42, -W * 0.75 + T, -s * 0.6, T, -s * 0.6);
      c.closePath();
    };
    // features, so the lit and shadow passes agree
    const ex = W * 0.44, ey = -s * 0.03;
    const eyeW = W * (who === 'moreno' ? 0.27 : 0.31), eyeH = s * (mood === 'shout' ? 0.05 : mood === 'tired' ? 0.026 : 0.04);
    const nx = T * 1.4 + W * 0.04, my = s * 0.3, mw = W * (mood === 'shout' ? 0.32 : 0.26), mx = T * 1.2;
    face(); solid(litTone);
    c.save(); face(); c.clip();
    // soft tone in the eye sockets and under the cheekbone on the lit side
    c.fillStyle = tone(c, Math.min(1, litTone + 0.28), 4);
    c.beginPath(); c.ellipse(-ex + T, ey - s * 0.02, eyeW * 1.35, eyeH * 2.6, 0, Math.PI * 1.05, Math.PI * 1.95); c.fill();
    c.beginPath(); c.moveTo(-W * 0.95, s * 0.06); c.quadraticCurveTo(-W * 0.55, s * 0.12, -W * 0.45, s * 0.26); c.quadraticCurveTo(-W * 0.8, s * 0.22, -W * 0.95, s * 0.06); c.fill();
    // the shadow side: down the forehead, along the nose, round the mouth and chin
    // the far temple, the hollow under the cheekbone and the side of the jaw
    c.beginPath();
    c.moveTo(W * 0.62 + T, -s * 0.7);
    c.quadraticCurveTo(W * 0.72 + T, -s * 0.32, W * 0.86, -s * 0.12);
    c.quadraticCurveTo(W * 0.6 + T, s * 0.02, W * 0.52 + T, s * 0.14);
    c.quadraticCurveTo(W * 0.42 + T, s * 0.3, W * 0.2 + T, s * 0.47);
    c.lineTo(W * 0.1 + T, s * 0.6); c.lineTo(W * 1.6, s * 0.6); c.lineTo(W * 1.6, -s * 0.7); c.closePath();
    c.fillStyle = INK; c.fill();
    // the shadow cast by the nose and under the lip
    c.beginPath(); c.moveTo(nx + W * 0.03, -s * 0.02); c.quadraticCurveTo(nx + W * 0.2, s * 0.14, nx + W * 0.05, s * 0.2); c.quadraticCurveTo(nx + W * 0.1, s * 0.12, nx + W * 0.03, -s * 0.02); c.fill();
    c.fillStyle = tone(c, Math.min(1, litTone + 0.5), 4); c.beginPath(); c.ellipse(mx, my + s * 0.085, mw * 0.5, s * 0.025, 0, 0, TAU); c.fill();
    c.restore();
    face(); c.strokeStyle = INK; c.lineWidth = lw * 1.7; c.stroke();
    // reflected light along the far jaw
    c.strokeStyle = PAPER; c.lineWidth = lw * 1.1;
    c.beginPath(); c.moveTo(W * 0.93, -s * 0.05); c.quadraticCurveTo(W * jawX * 1.05, jawY * s * 0.85, W * jawX * 0.92, s * jawY * 1.02); c.stroke();
    // ears
    c.strokeStyle = INK; c.lineWidth = lw;
    c.beginPath(); c.ellipse(-W * 1.0, s * 0.0, W * 0.11, s * 0.085, 0, Math.PI * 0.5, Math.PI * 1.5); solid(litTone); c.stroke();
    c.beginPath(); c.ellipse(W * 1.0, s * 0.0, W * 0.11, s * 0.085, 0, -Math.PI * 0.5, Math.PI * 0.5); c.fillStyle = INK; c.fill();

    // ---- eyes: full detail on the lit side, a glint in the shadow ----
    for (const sd of [-1, 1]) {
      const x = sd * ex + T * 1.2, w = eyeW * (1 - sd * turn * 0.3), inShadow = false;
      c.save(); c.translate(x, ey);
      const lid = () => { c.beginPath(); c.moveTo(-w, eyeH * 0.2); c.quadraticCurveTo(-w * 0.2, -eyeH * 1.7, w, -eyeH * 0.35); c.quadraticCurveTo(w * 0.2, eyeH * 1.2, -w, eyeH * 0.2); c.closePath(); };
      lid(); c.fillStyle = who === 'crane' ? INK : inShadow ? tone(c, 0.55, 3) : PAPER; c.fill();
      c.save(); lid(); c.clip();
      const ir = eyeH * 1.25, ix = sd * w * 0.05 + turn * w * 0.25;
      if (o.eyes === 'green' || who === 'crane') { glow(c, ix, 0, ir * 3, SPOT.green, 1); c.fillStyle = '#e8fff0'; c.beginPath(); c.arc(ix, 0, ir * 0.4, 0, TAU); c.fill(); }
      else {
        c.fillStyle = inShadow ? INK : tone(c, who === 'laila' ? 0.32 : 0.7, 2); c.beginPath(); c.arc(ix, -eyeH * 0.1, ir, 0, TAU); c.fill();
        if (who === 'laila') { spot(c, SPOT.ice, () => { c.beginPath(); c.arc(ix, -eyeH * 0.1, ir, 0, TAU); c.fill(); }, 0.9); c.strokeStyle = INK; c.lineWidth = lw * 0.5; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.beginPath(); c.moveTo(ix + Math.cos(a) * ir * 0.5, -eyeH * 0.1 + Math.sin(a) * ir * 0.5); c.lineTo(ix + Math.cos(a) * ir * 0.9, -eyeH * 0.1 + Math.sin(a) * ir * 0.9); c.stroke(); } }
        c.fillStyle = INK; c.beginPath(); c.arc(ix, -eyeH * 0.1, ir * (who === 'laila' ? 0.42 : 0.55), 0, TAU); c.fill();
        c.strokeStyle = INK; c.lineWidth = lw * 0.9; c.beginPath(); c.arc(ix, -eyeH * 0.1, ir, 0, TAU); c.stroke();
      }
      c.restore();
      if (who !== 'crane') { c.fillStyle = PAPER; c.beginPath(); c.arc(ix - ir * 0.4, -eyeH * 0.55, ir * 0.3, 0, TAU); c.fill(); if (!inShadow) { c.beginPath(); c.arc(ix + ir * 0.35, eyeH * 0.25, ir * 0.14, 0, TAU); c.fill(); } }
      // upper lid, lashes and crease
      c.strokeStyle = inShadow ? PAPER : INK;
      c.beginPath(); c.moveTo(-w * 1.1, eyeH * 0.3); c.quadraticCurveTo(-w * 0.2, -eyeH * 1.85, w * 1.05, -eyeH * 0.4); c.lineWidth = lw * (who === 'voss' || who === 'okafor' || who === 'laila' ? 2.8 : 2.1); c.stroke();
      if (who === 'laila') { c.lineWidth = lw * 0.9; for (let i = 0; i < 7; i++) { const k = i / 6, lx = lerp(-w * 0.8, w * 1.0, k), ly = lerp(eyeH * 0.1, -eyeH * 0.45, k) - Math.sin(k * Math.PI) * eyeH * 1.15; c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + w * (0.1 + k * 0.22), ly - eyeH * (0.9 + Math.sin(k * Math.PI) * 0.5)); c.stroke(); } }
      if (!inShadow) {
        c.beginPath(); c.moveTo(-w * 0.7, -eyeH * 1.5); c.quadraticCurveTo(0, -eyeH * 2.6, w * 0.8, -eyeH * 1.2); c.lineWidth = lw * 0.7; c.stroke();
        c.beginPath(); c.moveTo(-w * 0.75, eyeH * 0.75); c.quadraticCurveTo(0, eyeH * 1.3, w * 0.7, eyeH * 0.45); c.lineWidth = lw * 0.6; c.stroke();
        if (who === 'voss' || who === 'okafor' || who === 'laila') { c.lineWidth = lw * 0.9; c.beginPath(); c.moveTo(w * 1.02, -eyeH * 0.4); c.lineTo(w * 1.25, -eyeH * 0.9); c.stroke(); }
      }
      if (mood === 'tired' && !inShadow) { c.beginPath(); c.moveTo(-w * 0.6, eyeH * 2); c.quadraticCurveTo(0, eyeH * 2.8, w * 0.6, eyeH * 1.8); c.lineWidth = lw * 0.6; c.stroke(); }
      c.restore();
    }
    // ---- brows ----
    const angry = mood === 'shout' || mood === 'grim', worried = mood === 'tired';
    for (const sd of [-1, 1]) {
      const x = sd * ex + T * 1.2, by = ey - s * (who === 'moreno' ? 0.085 : 0.105);
      const inn = sd < 0 ? 1 : -1;
      c.strokeStyle = INK;
      c.beginPath(); c.moveTo(x + inn * eyeW * 1.0, by + (angry ? s * 0.025 : worried ? -s * 0.02 : 0));
      c.quadraticCurveTo(x, by - s * 0.03, x - inn * eyeW * 1.05, by - s * 0.005);
      c.lineWidth = lw * (who === 'moreno' ? 4 : who === 'laila' ? 2 : 2.6); c.stroke();
    }
    // ---- nose (lit edge only) and mouth ----
    c.strokeStyle = INK; c.lineWidth = lw * 1.1;
    c.beginPath(); c.moveTo(nx - W * 0.14, s * 0.19); c.quadraticCurveTo(nx - W * 0.04, s * 0.215, nx + W * 0.02, s * 0.2); c.stroke();
    if (mood === 'shout') {
      c.beginPath(); c.moveTo(mx - mw, my - s * 0.02); c.quadraticCurveTo(mx, my - s * 0.05, mx + mw, my - s * 0.02); c.quadraticCurveTo(mx + mw * 0.6, my + s * 0.12, mx, my + s * 0.13); c.quadraticCurveTo(mx - mw * 0.6, my + s * 0.12, mx - mw, my - s * 0.02); c.closePath();
      c.fillStyle = INK; c.fill();
      c.fillStyle = PAPER; poly(c, [[mx - mw * 0.72, my - s * 0.022], [mx + mw * 0.3, my - s * 0.026], [mx + mw * 0.25, my + s * 0.006], [mx - mw * 0.6, my + s * 0.012]]); c.fill();
    } else if (who === 'laila') {
      const up = mood === 'smile' ? s * 0.022 : 0, lip = () => { c.beginPath(); c.moveTo(mx - mw * 1.05, my - up * 0.6); c.quadraticCurveTo(mx - mw * 0.5, my - s * 0.035, mx - mw * 0.1, my - s * 0.022); c.quadraticCurveTo(mx, my - s * 0.03, mx + mw * 0.15, my - s * 0.025); c.quadraticCurveTo(mx + mw * 0.6, my - s * 0.03, mx + mw * 1.0, my - up); c.quadraticCurveTo(mx + mw * 0.5, my + s * 0.08, mx, my + s * 0.082); c.quadraticCurveTo(mx - mw * 0.6, my + s * 0.075, mx - mw * 1.05, my - up * 0.6); c.closePath(); };
      lip(); c.fillStyle = tone(c, 0.38, 2); c.fill(); spot(c, SPOT.red, () => { lip(); c.fill(); }, 0.55);
      c.strokeStyle = INK; c.lineWidth = lw * 1.5; c.beginPath(); c.moveTo(mx - mw * 1.05, my - up * 0.6); c.quadraticCurveTo(mx - mw * 0.3, my + s * 0.012, mx + mw * 0.2, my + s * 0.008); c.quadraticCurveTo(mx + mw * 0.6, my + s * 0.004, mx + mw * 1.0, my - up); c.stroke();
      c.lineWidth = lw * 0.8; c.beginPath(); c.moveTo(mx - mw * 0.6, my + s * 0.07); c.quadraticCurveTo(mx, my + s * 0.095, mx + mw * 0.5, my + s * 0.07); c.stroke();
      c.fillStyle = PAPER; c.beginPath(); c.ellipse(mx - mw * 0.25, my + s * 0.045, mw * 0.22, s * 0.01, -0.1, 0, TAU); c.fill();
    } else if (who === 'crane') {
      c.beginPath(); c.moveTo(mx - mw, my); c.quadraticCurveTo(mx, my + s * 0.09, mx + mw, my); c.quadraticCurveTo(mx, my + s * 0.02, mx - mw, my); c.fillStyle = INK; c.fill();
      c.fillStyle = PAPER; for (let i = -3; i <= 1; i++) { poly(c, [[mx + i * mw * 0.26 - mw * 0.1, my + s * 0.012], [mx + i * mw * 0.26, my + s * 0.06], [mx + i * mw * 0.26 + mw * 0.1, my + s * 0.012]]); c.fill(); }
    } else {
      const curve = mood === 'smile' ? -s * 0.025 : mood === 'grim' || mood === 'tired' ? s * 0.015 : 0;
      c.beginPath(); c.moveTo(mx - mw, my + curve); c.quadraticCurveTo(mx - mw * 0.2, my + s * 0.012, mx + mw * 0.3, my + curve * 0.5); c.lineWidth = lw * 1.7; c.stroke();
      c.beginPath(); c.moveTo(mx - mw * 0.45, my + s * 0.065); c.quadraticCurveTo(mx - mw * 0.1, my + s * 0.08, mx + mw * 0.1, my + s * 0.07); c.lineWidth = lw * 0.8; c.stroke();
      if (mood === 'smile') { c.beginPath(); c.moveTo(mx - mw * 1.05, my + curve - s * 0.01); c.lineTo(mx - mw * 1.12, my + curve + s * 0.012); c.lineWidth = lw; c.stroke(); }
    }

    // ---- hair and gear ----
    const spikes = (pts, n, len, seed) => {
      const rng = mulberry32(seed);
      c.beginPath(); c.moveTo(...pts[0]);
      for (let i = 1; i < pts.length; i++) c.lineTo(...pts[i]);
      for (let i = 0; i <= n; i++) {
        const k = i / n, x = lerp(pts[pts.length - 1][0], pts[0][0], k), y = lerp(pts[pts.length - 1][1], pts[0][1], k) + Math.sin(k * Math.PI) * len * 0.3;
        c.lineTo(x + (rng() - 0.5) * len * 0.3, y + len * (0.7 + rng() * 0.6)); c.lineTo(x - (lerp(pts[pts.length - 1][0], pts[0][0], 1 / n) - pts[pts.length - 1][0]) * 0.5, y);
      }
      c.closePath();
    };
    const shine = (x, y, rx, ry, rot, n) => { c.strokeStyle = PAPER; for (let i = 0; i < n; i++) { c.lineWidth = lw * (1.6 - i * 0.4); c.beginPath(); c.ellipse(x, y + i * ry * 0.25, rx * (1 - i * 0.12), ry, rot, Math.PI * 1.1, Math.PI * 1.6); c.stroke(); } };
    if (who === 'voss') {
      // a sharp side-swept cut, the fringe falling over the scarred brow
      c.fillStyle = INK;
      c.beginPath(); c.moveTo(-W * 1.12, s * 0.12); c.bezierCurveTo(-W * 1.3, -s * 0.8, W * 1.35, -s * 0.84, W * 1.1, -s * 0.05); c.lineTo(W * 1.02, -s * 0.12);
      c.quadraticCurveTo(W * 0.8, -s * 0.4, W * 0.3, -s * 0.36);
      for (let i = 0; i < 7; i++) { const k = i / 6, x = lerp(W * 0.3, -W * 0.95, k), y = lerp(-s * 0.36, -s * 0.12, k); c.lineTo(x - W * 0.12, y + s * (0.1 + (i % 2) * 0.06)); c.lineTo(x - W * 0.18, y); }
      c.lineTo(-W * 1.0, -s * 0.06); c.quadraticCurveTo(-W * 1.05, s * 0.0, -W * 1.12, s * 0.12); c.closePath(); c.fill();
      shine(-W * 0.15, -s * 0.42, W * 0.75, s * 0.1, -0.25, 3);
      c.strokeStyle = PAPER; c.lineWidth = lw * 0.7; c.beginPath(); c.moveTo(-ex - W * 0.15, -s * 0.2); c.lineTo(-ex + W * 0.14, s * 0.0); c.stroke();
      c.strokeStyle = INK; c.lineWidth = lw * 1.3; c.beginPath(); c.moveTo(-ex - W * 0.13, -s * 0.2); c.lineTo(-ex + W * 0.16, s * 0.0); c.stroke();
      c.lineWidth = s * 0.035; c.beginPath(); c.ellipse(T * 0.5, -s * 0.06, W * 1.16, s * 0.6, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      c.fillStyle = INK; c.beginPath(); c.ellipse(W * 1.06, s * 0.0, W * 0.2, s * 0.13, 0, 0, TAU); c.fill(); c.strokeStyle = PAPER; c.lineWidth = lw * 0.8; c.beginPath(); c.ellipse(W * 1.06, s * 0.0, W * 0.12, s * 0.08, 0, Math.PI * 0.9, Math.PI * 1.6); c.stroke();
      c.strokeStyle = INK; c.lineWidth = s * 0.016; c.beginPath(); c.moveTo(W * 0.98, s * 0.09); c.quadraticCurveTo(W * 0.85, s * 0.34, mx + mw * 0.9, s * 0.33); c.stroke();
      c.fillStyle = INK; c.beginPath(); c.arc(mx + mw * 0.85, s * 0.33, s * 0.024, 0, TAU); c.fill();
    } else if (who === 'okafor') {
      c.fillStyle = INK;
      c.beginPath(); c.ellipse(-W * 0.15, -s * 0.66, s * 0.17, s * 0.15, 0, 0, TAU); c.fill();
      c.strokeStyle = PAPER; c.lineWidth = lw * 0.6; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(-W * 0.15, -s * 0.66, s * (0.04 + i * 0.026), Math.PI * 1.1, Math.PI * 1.7); c.stroke(); }
      const hair = () => { c.beginPath(); c.moveTo(-W * 1.08, s * 0.02); c.bezierCurveTo(-W * 1.22, -s * 0.74, W * 1.22, -s * 0.74, W * 1.08, s * 0.02); c.quadraticCurveTo(W * 0.92, -s * 0.32, T, -s * 0.37); c.quadraticCurveTo(-W * 0.92, -s * 0.32, -W * 1.08, s * 0.02); c.closePath(); };
      c.fillStyle = INK; hair(); c.fill();
      c.save(); hair(); c.clip(); c.strokeStyle = PAPER; c.lineWidth = lw * 0.55;
      for (let i = -7; i <= 7; i++) { const bx = i * W * 0.14 + T; c.beginPath(); c.moveTo(bx, -s * 0.36); c.quadraticCurveTo(bx * 1.1, -s * 0.55, -W * 0.15, -s * 0.66); c.stroke(); for (let k = 0; k < 5; k++) { const kk = k / 5, yy = lerp(-s * 0.38, -s * 0.6, kk), xx = lerp(bx, -W * 0.15, kk * kk); c.beginPath(); c.moveTo(xx - W * 0.04, yy); c.lineTo(xx + W * 0.04, yy - s * 0.014); c.stroke(); } }
      c.restore();
      c.strokeStyle = INK; c.lineWidth = s * 0.034;
      for (const [bx, len] of [[W * 1.0, 0.78], [W * 1.12, 0.62], [-W * 1.08, 0.55]]) { c.beginPath(); c.moveTo(bx, -s * 0.1); c.quadraticCurveTo(bx + W * 0.1 * Math.sign(bx), s * 0.3, bx - W * 0.05 * Math.sign(bx), s * len); c.stroke(); }
      c.lineWidth = lw * 1.5;
      for (const sd of [-1, 1]) {
        const x = sd * ex + T * 1.2, r = eyeW * 1.3;
        if (o.glasses) { c.save(); c.beginPath(); c.arc(x, ey, r * 0.95, 0, TAU); c.clip(); glow(c, x, ey, r * 1.4, o.glasses, 0.75); c.fillStyle = 'rgba(255,255,255,0.85)'; poly(c, [[x - r * 0.75, ey - r * 0.1], [x - r * 0.15, ey - r * 0.9], [x + r * 0.1, ey - r * 0.75], [x - r * 0.5, ey + r * 0.1]]); c.fill(); c.restore(); }
        c.strokeStyle = INK; c.beginPath(); c.arc(x, ey, r, 0, TAU); c.stroke();
      }
      c.strokeStyle = INK; c.beginPath(); c.moveTo(-ex + eyeW * 1.3 + T * 1.2, ey); c.quadraticCurveTo(T * 1.2, ey - eyeH, ex - eyeW * 1.3 + T * 1.2, ey); c.stroke();
      if (o.parka) {
        c.strokeStyle = INK; c.lineWidth = lw * 1.5;
        c.beginPath(); c.moveTo(-s * 0.9, s * 1.4); c.bezierCurveTo(-s * 1.05, -s * 0.2, -s * 0.55, -s * 0.9, 0, -s * 0.88); c.bezierCurveTo(s * 0.55, -s * 0.9, s * 1.05, -s * 0.2, s * 0.9, s * 1.4);
        c.lineTo(s * 0.62, s * 1.4); c.bezierCurveTo(s * 0.62, s * 0.4, s * 0.6, -s * 0.66, 0, -s * 0.68); c.bezierCurveTo(-s * 0.6, -s * 0.66, -s * 0.62, s * 0.4, -s * 0.62, s * 1.4); c.closePath(); solid(0.25, 5); c.stroke();
        c.save(); c.clip(); c.fillStyle = PAPER; const rng = mulberry32(9);
        for (let i = 0; i < 70; i++) { const q = rng() * TAU, r = s * (0.66 + rng() * 0.1); c.beginPath(); c.ellipse(Math.cos(q) * r, -s * 0.05 + Math.sin(q) * r, s * 0.05, s * 0.018, q + 1.5, 0, TAU); c.fill(); }
        c.fillStyle = INK; poly(c, [[s * 0.4, -s * 0.9], [s * 1.2, -s * 0.5], [s * 1.2, s * 1.5], [s * 0.55, s * 1.5]]); c.fill();
        c.restore();
      }
    } else if (who === 'moreno') {
      c.fillStyle = INK; const rng = mulberry32(3);
      for (let i = 0; i < 220; i++) { const x = (rng() - 0.6) * W * 1.7, y = s * (0.16 + rng() * 0.32); if (x > T + W * 0.05 || Math.abs(x) > W * (1.05 - (y / s - 0.05) * 0.9)) continue; if (y > s * 0.26 && y < s * 0.34 && Math.abs(x - mx) < mw * 1.1) continue; c.beginPath(); c.arc(x, y, s * 0.0055, 0, TAU); c.fill(); }
      // a combat helmet in a cloth cover, goggles strapped across the front
      const helm = () => { c.beginPath(); c.moveTo(-W * 1.28, s * 0.02); c.lineTo(-W * 1.3, -s * 0.2); c.bezierCurveTo(-W * 1.35, -s * 0.9, W * 1.35, -s * 0.9, W * 1.3, -s * 0.2); c.lineTo(W * 1.28, s * 0.02); c.quadraticCurveTo(W * 1.1, -s * 0.1, W * 0.9, -s * 0.16); c.quadraticCurveTo(0, -s * 0.24, -W * 0.9, -s * 0.16); c.quadraticCurveTo(-W * 1.1, -s * 0.1, -W * 1.28, s * 0.02); c.closePath(); };
      helm(); solid(0.45, 3);
      c.save(); helm(); c.clip();
      c.strokeStyle = INK; c.lineWidth = lw * 0.5;
      for (let i = -12; i <= 12; i++) { c.beginPath(); c.moveTo(i * W * 0.14, -s * 0.9); c.lineTo(i * W * 0.14 + W * 0.3, -s * 0.1); c.stroke(); }
      c.fillStyle = INK; c.beginPath(); c.ellipse(W * 0.9, -s * 0.4, W * 0.85, s * 0.6, 0, 0, TAU); c.fill();
      shine(-W * 0.4, -s * 0.62, W * 0.55, s * 0.09, -0.35, 2);
      c.restore();
      helm(); c.strokeStyle = INK; c.lineWidth = lw * 1.9; c.stroke();
      c.fillStyle = INK; c.fillRect(-W * 1.2, -s * 0.5, W * 2.4, s * 0.09);
      for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * W * 0.42 + T, -s * 0.46, W * 0.3, s * 0.085, 0, 0, TAU); c.fillStyle = INK; c.fill(); c.strokeStyle = PAPER; c.lineWidth = lw * 1.1; c.beginPath(); c.ellipse(sd * W * 0.42 + T, -s * 0.46, W * 0.22, s * 0.06, 0, Math.PI * 1.1, Math.PI * 1.7); c.stroke(); }
      c.strokeStyle = INK; c.lineWidth = lw * 1.6; c.beginPath(); c.moveTo(-W * 1.15, s * 0.0); c.quadraticCurveTo(-W * 0.95, s * 0.36, -W * 0.25, s * 0.49); c.stroke();
      c.strokeStyle = PAPER; c.lineWidth = lw; c.beginPath(); c.moveTo(W * 1.15, s * 0.0); c.quadraticCurveTo(W * 0.95, s * 0.36, W * 0.25, s * 0.49); c.stroke();
    } else if (who === 'laila') {
      // a dusting of freckles across the nose and the tops of the cheeks
      const rng = mulberry32(17);
      for (let i = 0; i < 110; i++) {
        const x = nx + (rng() - 0.5) * W * 1.5, y = s * (0.04 + rng() * 0.13), d = Math.abs(x - nx) / (W * 0.75);
        if (d > 1 || rng() < d * 0.75 || (y < s * 0.06 && Math.abs(x - nx) > W * 0.3)) continue;
        c.fillStyle = x > W * 0.52 + T ? PAPER : INK; c.globalAlpha = 0.85; c.beginPath(); c.arc(x, y, s * (0.003 + rng() * 0.0025), 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
      spot(c, SPOT.red, () => { c.beginPath(); c.ellipse(-W * 0.55 + T, s * 0.15, W * 0.28, s * 0.055, -0.1, 0, TAU); c.fill(); }, 0.18);
      // a small hoop through her left nostril, and a gold hoop earring
      c.lineWidth = lw * 2.2; c.strokeStyle = INK; c.beginPath(); c.arc(nx + W * 0.2, s * 0.2, s * 0.019, Math.PI * 0.1, Math.PI * 1.3); c.stroke();
      c.lineWidth = lw * 1.0; c.strokeStyle = PAPER; c.beginPath(); c.arc(nx + W * 0.2, s * 0.2, s * 0.019, Math.PI * 0.1, Math.PI * 1.3); c.stroke();
      c.strokeStyle = INK; c.lineWidth = lw * 1.1; c.beginPath(); c.arc(-W * 1.02, s * 0.11, s * 0.028, 0, Math.PI * 1.5); c.stroke();
      // the crown of the head, parted in the middle, and the long waves falling over each shoulder
      // the hairline sits low: the part dips to just above the brows and the sides sweep down over the temples
      const cap = (sd) => () => { c.beginPath(); c.moveTo(T * 0.5, -s * 0.66); c.bezierCurveTo(sd * W * 0.75, -s * 0.7, sd * W * 1.2, -s * 0.48, sd * W * 1.13, -s * 0.1); c.lineTo(sd * W * 1.05, s * 0.06); c.lineTo(sd * W * 0.93, -s * 0.12); c.bezierCurveTo(sd * W * 0.86, -s * 0.26, sd * W * 0.5, -s * 0.3, sd * W * 0.12 + T * 0.5, -s * 0.33); c.quadraticCurveTo(T * 0.5, -s * 0.36, T * 0.5, -s * 0.4); c.closePath(); };
      hairFill(lock(-W * 1.02, -s * 0.36, -W * 1.95, s * 1.42, W * 0.34, W * 0.75, 2.2, W * 0.32), true, 7);
      hairFill(lock(-W * 1.06, -s * 0.2, -W * 1.35, s * 1.25, W * 0.25, W * 0.5, 0.9, W * 0.24), true, 9);
      hairFill(lock(W * 1.03, -s * 0.36, W * 1.9, s * 1.35, W * 0.32, W * 0.7, 0.6, W * 0.32), false, 8);
      hairFill(cap(-1), true, 5); hairFill(cap(1), false, 6);
      shine(-W * 0.5, -s * 0.5, W * 0.45, s * 0.07, -0.6, 2);
      c.strokeStyle = INK; c.lineWidth = lw * 0.8;
      for (const [x0, x1, y1] of [[-0.05, -0.55, -0.2], [0.1, 0.5, -0.22], [-0.2, -0.85, -0.05]]) { c.beginPath(); c.moveTo(T * 0.5 + W * x0, -s * 0.36); c.quadraticCurveTo(W * (x0 + x1) * 0.6, -s * 0.36, W * x1, s * y1); c.stroke(); }
      if (o.hat) {
        // the woven straw cowboy hat with a studded leather band and its brim curled up at the sides
        const crown = () => { c.beginPath(); c.moveTo(-W * 1.0, -s * 0.5); c.bezierCurveTo(-W * 1.1, -s * 0.92, -W * 0.75, -s * 1.04, -W * 0.25, -s * 0.98); c.quadraticCurveTo(T * 0.5, -s * 0.9, W * 0.25, -s * 0.98); c.bezierCurveTo(W * 0.75, -s * 1.04, W * 1.1, -s * 0.92, W * 1.0, -s * 0.5); c.closePath(); };
        const brim = () => { c.beginPath(); c.moveTo(-s * 0.82, -s * 0.92); c.bezierCurveTo(-s * 0.88, -s * 0.55, -s * 0.55, -s * 0.36, T * 0.5, -s * 0.33); c.bezierCurveTo(s * 0.55, -s * 0.36, s * 0.88, -s * 0.55, s * 0.82, -s * 0.92); c.bezierCurveTo(s * 0.74, -s * 0.66, s * 0.58, -s * 0.54, W * 1.05, -s * 0.52); c.quadraticCurveTo(T * 0.5, -s * 0.47, -W * 1.05, -s * 0.52); c.bezierCurveTo(-s * 0.58, -s * 0.54, -s * 0.74, -s * 0.66, -s * 0.82, -s * 0.92); c.closePath(); };
        const weave = (shape, seed) => {
          c.save(); shape(); c.clip(); c.lineWidth = lw * 0.45;
          const cell = s * 0.075, rng2 = mulberry32(seed);
          for (let y = -s * 1.05, r = 0; y < -s * 0.25; y += cell, r++) for (let x = -s * 1.1, j = 0; x < s * 1.1; x += cell, j++) {
            c.strokeStyle = x > W * 0.55 + T ? PAPER : INK; c.beginPath();
            if ((j + r) % 2) for (const f of [0.3, 0.65]) { c.moveTo(x + cell * 0.1, y + cell * f); c.quadraticCurveTo(x + cell * 0.5, y + cell * (f - 0.08), x + cell * 0.9, y + cell * f); }
            else for (const f of [0.3, 0.65]) { c.moveTo(x + cell * f, y + cell * 0.1); c.quadraticCurveTo(x + cell * (f + 0.08), y + cell * 0.5, x + cell * f, y + cell * 0.9); }
            if (rng2() < 0.85) c.stroke();
          }
          c.restore();
        };
        const shadeRight = (shape, d) => { c.save(); shape(); c.clip(); c.fillStyle = tone(c, d, 3); c.beginPath(); c.moveTo(W * 0.45 + T, -s * 1.2); c.lineTo(s * 1.2, -s * 1.2); c.lineTo(s * 1.2, -s * 0.2); c.lineTo(W * 0.7 + T, -s * 0.2); c.closePath(); c.fill(); c.restore(); };
        c.save(); face(); c.clip(); c.fillStyle = tone(c, 0.55, 3); c.beginPath(); c.ellipse(T, -s * 0.38, W * 1.3, s * 0.12, 0, 0, TAU); c.fill(); c.restore();
        crown(); solid(0.12, 3); shadeRight(crown, 0.8); weave(crown, 41); spot(c, '#e8c070', () => { crown(); c.fill(); }, 0.5);
        crown(); c.strokeStyle = INK; c.lineWidth = lw * 1.5; c.stroke();
        c.save(); crown(); c.clip();
        c.fillStyle = INK; c.beginPath(); c.moveTo(-W * 1.2, -s * 0.66); c.quadraticCurveTo(0, -s * 0.61, W * 1.2, -s * 0.66); c.lineTo(W * 1.2, -s * 0.55); c.quadraticCurveTo(0, -s * 0.5, -W * 1.2, -s * 0.55); c.closePath(); c.fill();
        c.fillStyle = tone(c, 0.35, 2); for (let i = -4; i <= 4; i++) { const bx = i * W * 0.24; poly(c, [[bx - W * 0.08, -s * 0.6], [bx, -s * 0.64], [bx + W * 0.08, -s * 0.6], [bx, -s * 0.565]]); c.fill(); }
        c.fillStyle = PAPER; for (let i = -4; i <= 4; i++) { c.beginPath(); c.arc(i * W * 0.24 + W * 0.12, -s * 0.6, s * 0.009, 0, TAU); c.fill(); }
        c.restore();
        brim(); solid(0.18, 3); shadeRight(brim, 0.85);
        c.save(); brim(); c.clip(); c.fillStyle = tone(c, 0.5, 3); for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * s * 0.68, -s * 0.68, s * 0.18, s * 0.2, 0, 0, TAU); c.fill(); } c.restore();
        weave(brim, 42); spot(c, '#e8c070', () => { brim(); c.fill(); }, 0.5);
        brim(); c.strokeStyle = INK; c.lineWidth = lw * 1.6; c.stroke();
        c.lineWidth = lw * 0.8; c.beginPath(); c.moveTo(-s * 0.77, -s * 0.84); c.bezierCurveTo(-s * 0.8, -s * 0.52, -s * 0.52, -s * 0.4, T * 0.5, -s * 0.38); c.bezierCurveTo(s * 0.52, -s * 0.4, s * 0.8, -s * 0.52, s * 0.77, -s * 0.84); c.stroke();
      }
    } else if (who === 'crane') {
      c.strokeStyle = INK; c.lineWidth = lw * 0.8;
      for (const [x0, y0, x1, y1] of [[-W * 0.75, -s * 0.22, -W * 0.35, s * 0.12], [-W * 0.3, s * 0.36, W * 0.05, s * 0.46], [-W * 0.9, s * 0.1, -W * 0.6, s * 0.22]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo((x0 + x1) / 2 + W * 0.08, (y0 + y1) / 2); c.lineTo(x1, y1); c.stroke(); }
      c.beginPath(); c.moveTo(-s * 1.0, -s * 0.28); c.lineTo(-s * 0.72, -s * 0.42); c.bezierCurveTo(-W * 0.95, -s * 0.98, W * 0.95, -s * 0.98, s * 0.72, -s * 0.42); c.lineTo(s * 1.0, -s * 0.28);
      for (let i = 0; i <= 14; i++) c.lineTo(s * 1.0 - (i / 14) * s * 2.0, -s * 0.28 + (i % 2 ? s * 0.06 : -s * 0.015));
      c.closePath(); solid(0.22, 3); c.lineWidth = lw * 1.5; c.stroke();
      c.save(); c.clip(); c.lineWidth = lw * 0.5; for (let i = 0; i < 34; i++) { c.beginPath(); c.moveTo(-s + i * s * 0.065, -s * 0.95); c.lineTo(-s * 0.82 + i * s * 0.055, -s * 0.26); c.stroke(); } c.fillStyle = tone(c, 0.7, 3); poly(c, [[s * 0.35, -s], [s * 1.1, -s], [s * 1.1, -s * 0.2], [s * 0.5, -s * 0.2]]); c.fill(); c.restore();
      c.fillStyle = INK; c.beginPath(); c.moveTo(-s * 0.95, -s * 0.28); c.lineTo(s * 0.95, -s * 0.28); c.lineTo(W * 0.9, -s * 0.05); c.quadraticCurveTo(0, -s * 0.18, -W * 0.9, -s * 0.05); c.closePath(); c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1;
    }
    c.restore();
  }

  return { INK, PAPER, GREY, SPOT, tone, gradTone, focusLines, motionLines, poly, sub, ell, glow, spot, stars, sky, soldier, zombie, cornRow, farmhouse, bust };
})();
