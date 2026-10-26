'use strict';
// ============================================================
// Buildings: the farm barn, the log cabin, the bayou shack and the stone crypt.
// Drawn in a three-quarter view so the front walls show under the roofs: height goes straight
// up the screen, foreshortened a little. Every surface is
// built from its parts (boards, logs, clapboard, stone, shingles, tin), weathered with
// tiling grime, rust and moss textures, and lit from the top left like the rest of the map.
// ============================================================
const BUILDING_KINDS = new Set(['barn', 'cabin', 'shack', 'crypt']);

const BUILDINGS = (() => {
  const ZX = 0, ZY = 0.82;
  const P = (x, y, z) => [x + z * ZX, y - z * ZY];
  const SUN = [0.62, 0.78]; // ground shadow offset per unit of height
  const LIGHT = (() => { const v = [-0.55, -0.45, 0.7], l = Math.hypot(...v); return v.map((a) => a / l); })();

  // ---------- small helpers ----------
  const tone = (col, k) => {
    const a = hexRgb(col), t = k >= 0 ? 255 : 0, m = Math.min(1, Math.abs(k));
    return '#' + a.map((v) => clamp(Math.round(v + (t - v) * m), 0, 255).toString(16).padStart(2, '0')).join('');
  };
  const jitter = (col, rng, k) => tone(col, (rng() - 0.5) * 2 * k);
  function poly(c, pts) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const len3 = (v) => Math.hypot(v[0], v[1], v[2]);
  function normal(a, b, e) {
    const u = sub(b, a), v = sub(e, a);
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = len3(n) || 1; n = n.map((x) => x / l);
    return n[2] < 0 ? n.map((x) => -x) : n;
  }
  const lit = (n) => n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
  function hull(pts) {
    const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  // a soft shadow of a polygon, without drawing the polygon itself
  function castShadow(c, pts, blur, col) {
    const m = c.getTransform(), k = Math.hypot(m.a, m.b) || 1;
    c.save();
    c.setTransform(m.a, m.b, m.c, m.d, m.e - 30000, m.f);
    c.shadowColor = col; c.shadowBlur = blur * k; c.shadowOffsetX = 30000; c.shadowOffsetY = 0;
    poly(c, pts); c.fillStyle = '#000'; c.fill();
    c.restore();
  }

  // ---------- tiling textures, painted once at 4 pixels per unit ----------
  const TPX = 4;
  function tex(key, S, paint) {
    if (TEX[key]) return TEX[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    paint(cv.getContext('2d'), S);
    TEX[key] = cv;
    return cv;
  }
  function tileNoise(n, x, y, S, f, oct) {
    const fx = x / S, fy = y / S;
    return fbm(n, x / f, y / f, oct) * (1 - fx) * (1 - fy) + fbm(n, (x - S) / f, y / f, oct) * fx * (1 - fy)
      + fbm(n, x / f, (y - S) / f, oct) * (1 - fx) * fy + fbm(n, (x - S) / f, (y - S) / f, oct) * fx * fy;
  }
  // a coloured blotch mask: where the noise passes thr the colour shows, fading in over soft
  function blotch(key, rgb, thr, soft, f, seed, speck = 0) {
    return tex(key, 256, (g, S) => {
      const img = g.createImageData(S, S), n = makeNoise(seed), rng = mulberry32(seed);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const v = tileNoise(n, x, y, S, f, 4), i = (y * S + x) * 4;
        let a = clamp((v - thr) / soft, 0, 1);
        if (speck && rng() < speck) a = Math.max(a, 0.5 + rng() * 0.5);
        img.data[i] = rgb[0] + (v - 0.5) * 40; img.data[i + 1] = rgb[1] + (v - 0.5) * 30; img.data[i + 2] = rgb[2] + (v - 0.5) * 20;
        img.data[i + 3] = a * 255;
      }
      g.putImageData(img, 0, 0);
    });
  }
  const grime = () => blotch('bGrime', [28, 22, 14], 0.46, 0.22, 26, 501, 0.004);
  const rust = () => blotch('bRust', [104, 56, 30], 0.55, 0.1, 7, 502, 0.012);
  const moss = () => blotch('bMoss', [78, 98, 40], 0.55, 0.12, 14, 503, 0.006);
  const peel = () => blotch('bPeel', [150, 142, 124], 0.56, 0.06, 9, 504);
  const lichen = () => blotch('bLichen', [150, 160, 110], 0.6, 0.08, 7, 505, 0.01);
  const frost = () => blotch('bFrost', [190, 206, 225], 0.42, 0.3, 30, 506, 0.02);
  // wood grain running along the board: wavy fibres and the odd knot
  const grain = () => tex('bGrain', 256, (g, S) => {
    const rng = mulberry32(911);
    for (let i = 0; i < 190; i++) {
      const x0 = rng() * S, amp = 1 + rng() * 5, per = 1 + Math.floor(rng() * 3), ph = rng() * TAU, dark = rng() < 0.72;
      g.strokeStyle = dark ? `rgba(30,18,8,${0.08 + rng() * 0.24})` : `rgba(255,240,215,${0.05 + rng() * 0.14})`;
      g.lineWidth = 0.4 + rng() * 1.5;
      for (const ox of [-S, 0, S]) {
        g.beginPath();
        for (let y = 0; y <= S; y += 4) { const x = x0 + ox + Math.sin((y / S) * TAU * per + ph) * amp; y ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }
    }
    for (let i = 0; i < 7; i++) {
      const x = 12 + rng() * (S - 24), y = 12 + rng() * (S - 24), r = 2 + rng() * 4;
      g.fillStyle = 'rgba(46,26,12,0.5)'; g.beginPath(); g.ellipse(x, y, r * 0.6, r, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(46,26,12,0.25)'; g.lineWidth = 0.8;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(x, y, r * 0.6 + k * 1.4, r + k * 2.6, 0, 0, TAU); g.stroke(); }
    }
  });
  // lay a texture over a local rectangle, offset at random so no two walls repeat
  function overlay(c, cv, x, y, w, h, alpha, rng, rot = 0, sc = 1) {
    const pat = c.createPattern(cv, 'repeat');
    pat.setTransform(new DOMMatrix().translate(rng() * 200, rng() * 200).rotate(rot).scale(sc / TPX));
    c.save(); c.globalAlpha *= alpha; c.fillStyle = pat; c.fillRect(x, y, w, h); c.restore();
  }

  // ---------- faces: paint in a flat local frame mapped onto any wall or roof plane ----------
  function face(c, o, u, v, clip, paint) {
    c.save();
    c.transform(u[0], u[1], v[0], v[1], o[0], o[1]);
    poly(c, clip); c.clip();
    paint();
    c.restore();
  }
  // a wall facing south at y, from z0 to z1 (plus a gable rising rh in the middle when given)
  function southWall(c, x0, x1, y, z0, z1, rh, paint) {
    const w = x1 - x0, H = z1 + (rh || 0), h = H - z0;
    const clip = rh ? [[0, rh], [w / 2, 0], [w, rh], [w, h], [0, h]] : [[0, 0], [w, 0], [w, h], [0, h]];
    face(c, P(x0, y, H), [1, 0], [-ZX, ZY], clip, () => paint(w, h));
  }
  function westWall(c, x, y0, y1, z0, z1, paint) {
    const d = y1 - y0, h = z1 - z0;
    face(c, P(x, y0, z1), [0, 1], [-ZX, ZY], [[0, 0], [d, 0], [d, h], [0, h]], () => paint(d, h));
  }
  // a roof plane: a and b along the ridge (or top edge), e straight down the slope from a
  function slope(c, a, b, e, paint) {
    const L = len3(sub(b, a)), D = len3(sub(e, a)), pa = P(...a), pb = P(...b), pe = P(...e);
    const k = lit(normal(a, b, e));
    face(c, pa, [(pb[0] - pa[0]) / L, (pb[1] - pa[1]) / L], [(pe[0] - pa[0]) / D, (pe[1] - pa[1]) / D], [[0, 0], [L, 0], [L, D], [0, D]], () => paint(L, D, k));
  }
  // a box standing on the ground (or on a roof), showing its west side, south side and top
  function box(c, cx, cy, z0, bw, bd, bh, paintS, paintW, paintT) {
    const x0 = cx - bw / 2, x1 = cx + bw / 2, y0 = cy - bd / 2, y1 = cy + bd / 2, z1 = z0 + bh;
    if (paintW) westWall(c, x0, y0, y1, z0, z1, paintW);
    southWall(c, x0, x1, y1, z0, z1, 0, paintS);
    const a = P(x0, y0, z1);
    face(c, a, [1, 0], [0, 1], [[0, 0], [bw, 0], [bw, bd], [0, bd]], () => paintT(bw, bd));
  }
  // light and shadow over a wall: dark under the eaves and near the ground, a soft gradient between
  function wallLight(c, w, h, k, eave = 3) {
    c.fillStyle = k >= 0 ? `rgba(255,245,225,${k * 0.25})` : `rgba(10,14,24,${-k * 0.5})`; c.fillRect(0, 0, w, h);
    c.fillStyle = linear(c, 0, 0, 0, eave, [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, 0, w, eave);
    c.fillStyle = linear(c, 0, h - 3.5, 0, h, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(20,14,8,0.45)']]); c.fillRect(0, h - 3.5, w, 3.5);
  }

  // ---------- surface materials (all in local units: x across, y down) ----------
  function boards(c, w, h, o, rng) {
    // vertical board-and-batten siding, painted, the paint flaking back to grey wood
    const bw = o.bw || 3.2;
    for (let x = 0; x < w; x += bw) { c.fillStyle = jitter(o.col, rng, 0.07); c.fillRect(x, 0, bw + 0.05, h); }
    overlay(c, grain(), 0, 0, w, h, 0.9, rng);
    if (o.wear) overlay(c, peel(), 0, 0, w, h, o.wear, rng, 90, 0.8);
    overlay(c, grain(), 0, 0, w, h, 0.35, rng);
    for (let x = bw; x < w; x += bw) {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x + 0.4, 0, 0.55, h);
      c.fillStyle = tone(o.col, 0.06); c.fillRect(x - 0.45, 0, 0.9, h);
      c.fillStyle = 'rgba(255,240,220,0.18)'; c.fillRect(x - 0.45, 0, 0.3, h);
      c.fillStyle = 'rgba(20,16,12,0.6)'; for (let y = 1.5; y < h; y += 4.2) c.fillRect(x - 0.12, y, 0.25, 0.25);
    }
  }
  function clapboard(c, w, h, o, rng) {
    // horizontal lapped boards; each one's lower edge throws a thin shadow on the one beneath
    const bh = 2.1;
    for (let y = 0; y < h; y += bh) {
      c.fillStyle = jitter(o.col, rng, 0.06); c.fillRect(0, y, w, bh + 0.05);
      c.fillStyle = 'rgba(255,250,235,0.12)'; c.fillRect(0, y, w, 0.35);
    }
    overlay(c, grain(), 0, 0, w, h, 0.85, rng, 90);
    if (o.wear) overlay(c, peel(), 0, 0, w, h, o.wear, rng, 0, 0.7);
    for (let y = bh; y < h; y += bh) { c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(0, y - 0.1, w, 0.45); }
    // butt joints and the odd missing board, showing the dark inside
    for (let y = 0; y < h - bh; y += bh) {
      for (let x = rng() * 10; x < w; x += 9 + rng() * 12) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x, y, 0.3, bh); }
      if (o.missing && rng() < o.missing) {
        const x = rng() * (w - 8), l = 4 + rng() * 6;
        c.fillStyle = '#0d0b08'; c.fillRect(x, y + 0.2, l, bh - 0.2);
        c.fillStyle = 'rgba(90,70,50,0.6)'; c.fillRect(x + l * 0.4, y + 0.2, 0.4, bh - 0.2);
      }
    }
  }
  function logs(c, w, h, o, rng) {
    // round logs stacked with pale chinking between, each log shaded like a cylinder
    const lh = 2.5;
    c.fillStyle = '#c9bfab'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += lh) {
      const col = jitter(o.col, rng, 0.08);
      c.fillStyle = linear(c, 0, y, 0, y + lh, [[0, tone(col, 0.3)], [0.3, col], [0.85, tone(col, -0.35)], [1, tone(col, -0.55)]]);
      c.beginPath(); c.roundRect(0, y + 0.25, w, lh - 0.4, 1); c.fill();
      // bark texture: short splits along the log
      c.strokeStyle = 'rgba(20,12,6,0.35)'; c.lineWidth = 0.18;
      for (let i = 0; i < w / 2.2; i++) { const x = rng() * w, yy = y + 0.6 + rng() * (lh - 1.2); c.beginPath(); c.moveTo(x, yy); c.lineTo(x + 1 + rng() * 2.5, yy + (rng() - 0.5) * 0.3); c.stroke(); }
      if (rng() < 0.6) { const x = rng() * w; ellipse(c, x, y + lh * 0.5, 0.7, 0.45, 0); c.fillStyle = 'rgba(40,24,12,0.6)'; c.fill(); }
    }
    overlay(c, grain(), 0, 0, w, h, 0.45, rng, 90);
  }
  function logEnds(c, x, h, o, rng) {
    // the crossed log ends at a corner, sawn faces showing their rings
    const lh = 2.5;
    for (let y = 0; y < h; y += lh) {
      const r = lh * 0.55, cy = y + lh * 0.5;
      circle(c, x, cy, r); c.fillStyle = tone(o.col, -0.45); c.fill();
      circle(c, x - 0.15, cy - 0.1, r * 0.82); c.fillStyle = radial(c, x - 0.15, cy - 0.1, r * 0.82, '#d8b98a', '#9a7448', 0, 0); c.fill();
      c.strokeStyle = 'rgba(110,76,40,0.55)'; c.lineWidth = 0.12;
      for (let k = 0.25; k < 0.8; k += 0.18) { circle(c, x - 0.15, cy - 0.1, r * k); c.stroke(); }
      c.strokeStyle = 'rgba(70,44,20,0.5)'; c.beginPath(); c.moveTo(x - 0.15, cy - 0.1); c.lineTo(x - 0.15 + r * 0.7, cy - 0.1 + (rng() - 0.5) * r); c.stroke();
    }
  }
  function stone(c, w, h, o, rng) {
    // squared stone blocks in courses, each one bevelled, chipped and stained
    c.fillStyle = o.mortar || '#5e5a52'; c.fillRect(0, 0, w, h);
    const ch = o.ch || 3.2;
    for (let y = 0, row = 0; y < h; y += ch, row++) {
      for (let x = row % 2 ? -2.6 : 0; x < w; ) {
        const bw = 4.2 + rng() * 3, col = jitter(o.col, rng, 0.1);
        c.fillStyle = col; c.fillRect(x + 0.3, y + 0.3, bw - 0.6, ch - 0.6);
        c.fillStyle = 'rgba(255,255,245,0.16)'; c.fillRect(x + 0.3, y + 0.3, bw - 0.6, 0.45); c.fillRect(x + 0.3, y + 0.3, 0.45, ch - 0.6);
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 0.3, y + ch - 0.75, bw - 0.6, 0.45); c.fillRect(x + bw - 0.75, y + 0.3, 0.45, ch - 0.6);
        if (rng() < 0.3) { c.fillStyle = 'rgba(0,0,0,0.3)'; poly(c, [[x + bw - 1.5, y + 0.3], [x + bw - 0.3, y + 0.3], [x + bw - 0.3, y + 1.4]]); c.fill(); }
        x += bw;
      }
    }
    overlay(c, grime(), 0, 0, w, h, 0.5, rng);
    if (o.moss) overlay(c, moss(), 0, 0, w, h, o.moss, rng);
    // rain streaks running down from the top
    for (let i = 0; i < w / 4; i++) { const x = rng() * w, l = h * (0.3 + rng() * 0.6); c.fillStyle = linear(c, 0, 0, 0, l, [[0, 'rgba(20,24,20,0.35)'], [1, 'rgba(20,24,20,0)']]); c.fillRect(x, 0, 0.6 + rng() * 1.2, l); }
  }
  function tin(c, L, D, o, rng) {
    // corrugated sheets running down the slope, lapped, screwed down, rusting from the screws
    const sw = 7.5;
    for (let x = 0; x < L; x += sw) {
      const odd = o.odd && rng() < o.odd, col = odd ? o.odd2 || tone(o.col, -0.25) : jitter(o.col, rng, 0.07);
      c.fillStyle = tone(col, o.k * 0.4); c.fillRect(x, 0, sw + 0.05, D);
      for (let r = x; r < x + sw; r += 1.25) {
        c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(r, 0, 0.35, D);
        c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(r + 0.62, 0, 0.45, D);
      }
      c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(x + sw - 0.35, 0, 0.35, D);
      c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(x, 0, 0.3, D);
      for (const yy of [0.9, D * 0.5, D - 1.1]) for (let r = x + 0.7; r < x + sw; r += 2.5) {
        c.fillStyle = 'rgba(46,36,26,0.6)'; c.fillRect(r, yy, 0.4, 0.4);
        if (rng() < 0.45) { c.fillStyle = 'rgba(120,58,22,0.3)'; c.fillRect(r, yy + 0.4, 0.35, 1 + rng() * 3.5); }
      }
    }
    if (D > 12) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, D * 0.5, L, 0.45); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(0, D * 0.5 - 0.4, L, 0.4); }
    overlay(c, rust(), 0, 0, L, D, (o.rust ?? 0.8) * 0.6, rng, 90, 1.4);
    overlay(c, grime(), 0, 0, L, D, 0.45, rng);
  }
  function shingles(c, L, D, o, rng) {
    // cedar shingles in staggered courses; the butt edge of each course shades the one below
    const rh = 2, sw = 2.6;
    c.fillStyle = '#16110c'; c.fillRect(0, 0, L, D);
    for (let y = 0, row = 0; y < D; y += rh, row++) {
      for (let x = row % 2 ? -sw / 2 : 0; x < L; ) {
        const w = sw * (0.7 + rng() * 0.6);
        if (rng() > (o.missing || 0)) { c.fillStyle = jitter(o.col, rng, 0.16); c.fillRect(x, y, w - 0.22, rh + 0.1); }
        x += w;
      }
    }
    overlay(c, grain(), 0, 0, L, D, 0.5, rng, 0, 0.6);
    for (let y = rh; y < D; y += rh) { c.fillStyle = 'rgba(0,0,0,0.42)'; c.fillRect(0, y, L, 0.4); c.fillStyle = 'rgba(255,240,220,0.1)'; c.fillRect(0, y - 0.3, L, 0.3); }
    c.fillStyle = o.k >= 0 ? `rgba(255,240,220,${o.k * 0.2})` : `rgba(0,0,10,${-o.k * 0.45})`; c.fillRect(0, 0, L, D);
    if (o.moss) overlay(c, moss(), 0, 0, L, D, o.moss, rng);
    overlay(c, grime(), 0, 0, L, D, 0.35, rng);
  }
  function slabs(c, L, D, o, rng) {
    // big dressed stone slabs, lichen and cracks
    c.fillStyle = '#4a4740'; c.fillRect(0, 0, L, D);
    for (let x = 0; x < L; ) {
      const sw = 5 + rng() * 3;
      c.fillStyle = jitter(o.col, rng, 0.08); c.fillRect(x + 0.25, 0, sw - 0.5, D);
      c.fillStyle = 'rgba(255,255,245,0.15)'; c.fillRect(x + 0.25, 0, 0.4, D);
      if (rng() < 0.4) { c.strokeStyle = 'rgba(20,20,18,0.6)'; c.lineWidth = 0.25; c.beginPath(); let yy = rng() * D, xx = x + 0.5; c.moveTo(xx, yy); for (let i = 0; i < 4; i++) { xx += sw / 4; yy += (rng() - 0.5) * 2.5; c.lineTo(xx, yy); } c.stroke(); }
      x += sw;
    }
    c.fillStyle = o.k >= 0 ? `rgba(255,250,235,${o.k * 0.2})` : `rgba(0,0,10,${-o.k * 0.4})`; c.fillRect(0, 0, L, D);
    overlay(c, lichen(), 0, 0, L, D, 0.8, rng);
    overlay(c, moss(), 0, 0, L, D, 0.5, rng);
    overlay(c, grime(), 0, 0, L, D, 0.4, rng);
  }
  function snowCover(c, L, D, o, rng) {
    // snow lying on a roof slope, thinning to a ragged line above the eave (v grows down-slope)
    const edge = [];
    for (let x = 0; x <= L + 2; x += 2) edge.push([x, D - (o.gap || 2) - rng() * 1.6]);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(L, 0); for (let i = edge.length - 1; i >= 0; i--) c.lineTo(edge[i][0], edge[i][1]); c.closePath();
    c.save(); c.clip();
    c.fillStyle = linear(c, 0, 0, 0, D, o.k > 0.2 ? [[0, '#ffffff'], [1, '#e8f0f8']] : [[0, '#dfe8f2'], [1, '#c3d2e2']]); c.fillRect(0, 0, L, D);
    overlay(c, frost(), 0, 0, L, D, 0.6, rng);
    // wind ripples across the slope and a shallow hollow where the snow has settled
    c.strokeStyle = 'rgba(140,162,196,0.3)'; c.lineWidth = 0.3;
    for (let i = 0; i < L / 3; i++) { const x = rng() * L, y = rng() * D * 0.85, l = 3 + rng() * 6; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + l * 0.5, y - 0.6, x + l, y + (rng() - 0.5) * 0.6); c.stroke(); }
    c.fillStyle = 'rgba(150,170,200,0.22)';
    for (let i = 0; i < L / 10; i++) { ellipse(c, rng() * L, rng() * D * 0.8, 3 + rng() * 6, 0.6 + rng() * 0.8, 0); c.fill(); }
    c.fillStyle = linear(c, 0, 0, 0, D, [[0, 'rgba(255,255,255,0.35)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(120,145,185,0.25)']]); c.fillRect(0, 0, L, D);
    c.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < L * 0.8; i++) c.fillRect(rng() * L, rng() * D, 0.25, 0.25);
    c.restore();
    // the thick rounded lip where it overhangs, shadowed underneath
    const lip = () => { c.beginPath(); edge.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); };
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.save(); c.translate(0, 0.7); lip(); c.strokeStyle = 'rgba(70,90,130,0.45)'; c.lineWidth = 1.2; c.stroke(); c.restore();
    lip(); c.strokeStyle = '#f2f6fb'; c.lineWidth = 1.3; c.stroke();
    lip(); c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 0.4; c.translate(0, -0.35); c.stroke(); c.translate(0, 0.35);
  }

  // ---------- fixtures ----------
  function windowAt(c, x, y, ww, wh, o, rng) {
    const trim = o.trim || '#d8d0c0';
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(x - 0.4, y - 0.2, ww + 1.6, wh + 1.6);
    c.fillStyle = trim; c.fillRect(x - 0.8, y - 0.8, ww + 1.6, wh + 1.6);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + ww + 0.3, y - 0.8, 0.5, wh + 1.6);
    const st = o.style;
    if (st === 'lit') {
      c.fillStyle = radial(c, x + ww / 2, y + wh / 2, Math.max(ww, wh) * 0.8, '#ffe6a6', '#c76a24', 0, 0); c.fillRect(x, y, ww, wh);
      c.fillStyle = 'rgba(80,40,20,0.55)'; c.fillRect(x, y, ww * 0.22, wh); c.fillRect(x + ww * 0.78, y, ww * 0.22, wh);
    } else {
      c.fillStyle = linear(c, x, y, x + ww, y + wh, [[0, '#8ea7b6'], [0.45, '#3a4b57'], [1, '#141c22']]); c.fillRect(x, y, ww, wh);
      c.save(); c.beginPath(); c.rect(x, y, ww, wh); c.clip();
      c.fillStyle = 'rgba(255,255,255,0.28)'; poly(c, [[x + ww * 0.2, y], [x + ww * 0.45, y], [x, y + wh * 0.6], [x, y + wh * 0.3]]); c.fill();
      if (st === 'broken') {
        c.fillStyle = '#0b0d0e'; poly(c, [[x + ww * 0.3, y + wh * 0.15], [x + ww * 0.8, y + wh * 0.05], [x + ww * 0.62, y + wh * 0.45], [x + ww * 0.95, y + wh * 0.75], [x + ww * 0.4, y + wh * 0.95], [x + ww * 0.5, y + wh * 0.5]]); c.fill();
      }
      c.restore();
    }
    if (o.frost) { c.save(); c.beginPath(); c.rect(x, y, ww, wh); c.clip(); for (const [fx, fy] of [[x, y], [x + ww, y], [x, y + wh], [x + ww, y + wh]]) { c.fillStyle = radial(c, fx, fy, ww * 0.45, 'rgba(240,248,255,0.85)', 'rgba(240,248,255,0)', 0, 0); c.fillRect(x, y, ww, wh); } c.restore(); }
    // muntins dividing the panes
    c.fillStyle = trim; c.fillRect(x + ww / 2 - 0.25, y, 0.5, wh); c.fillRect(x, y + wh / 2 - 0.25, ww, 0.5);
    if (st === 'boarded') {
      for (const [a, yy] of [[-0.25, wh * 0.25], [0.18, wh * 0.7]]) {
        c.save(); c.translate(x + ww / 2, y + yy); c.rotate(a);
        c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(-ww * 0.65 + 0.3, -0.7 + 0.4, ww * 1.3, 1.5);
        c.fillStyle = jitter('#8a7258', rng, 0.12); c.fillRect(-ww * 0.65, -0.75, ww * 1.3, 1.5);
        overlay(c, grain(), -ww, -1, ww * 2, 2, 0.7, rng, 90);
        c.fillStyle = '#2a2420'; c.fillRect(-ww * 0.55, -0.2, 0.35, 0.35); c.fillRect(ww * 0.5, -0.2, 0.35, 0.35);
        c.restore();
      }
    }
    // the sill and its shadow
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x - 1.1, y + wh + 1.2, ww + 2.6, 0.8);
    c.fillStyle = tone(trim, 0.1); c.fillRect(x - 1.3, y + wh + 0.6, ww + 2.6, 0.8);
    if (o.snow) { c.fillStyle = '#f4f8fc'; c.beginPath(); c.roundRect(x - 1.3, y + wh + 0.1, ww + 2.6, 0.9, 0.4); c.fill(); }
  }
  function plankDoor(c, x, y, dw, dh, o, rng) {
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x - 0.4, y - 0.2, dw + 1.4, dh + 0.2);
    c.fillStyle = o.trim || '#3a2c1e'; c.fillRect(x - 0.8, y - 0.8, dw + 1.6, dh + 0.8);
    for (let xx = x; xx < x + dw - 0.1; xx += dw / 4) { c.fillStyle = jitter(o.col, rng, 0.08); c.fillRect(xx, y, dw / 4 - 0.2, dh); }
    overlay(c, grain(), x, y, dw, dh, 0.8, rng);
    // a Z-brace, iron strap hinges and a latch
    c.fillStyle = tone(o.col, -0.15); c.fillRect(x, y + dh * 0.2, dw, 1); c.fillRect(x, y + dh * 0.75, dw, 1);
    c.save(); c.beginPath(); c.rect(x, y, dw, dh); c.clip(); c.translate(x, y + dh * 0.75); c.rotate(-Math.atan2(dh * 0.55, dw)); c.fillRect(0, -0.5, Math.hypot(dw, dh * 0.55), 1); c.restore();
    c.fillStyle = '#1e1c1a'; c.fillRect(x, y + dh * 0.2 + 0.2, dw * 0.45, 0.5); c.fillRect(x, y + dh * 0.75 + 0.2, dw * 0.45, 0.5);
    circle(c, x + dw - 1, y + dh * 0.5, 0.45); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x, y, 0.4, dh);
  }
  function lantern(c, x, y, out, col = '255,190,100') {
    c.fillStyle = radial(c, x, y + 1, 9, `rgba(${col},0.4)`, `rgba(${col},0)`, 0, 0); circle(c, x, y + 1, 9); c.fill();
    c.strokeStyle = '#1a1612'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(x, y - 2); c.lineTo(x, y - 0.8); c.stroke();
    c.fillStyle = '#26201a'; c.fillRect(x - 0.9, y - 0.9, 1.8, 0.5); c.fillRect(x - 0.9, y + 1.6, 1.8, 0.5);
    c.fillStyle = radial(c, x, y + 0.6, 1.2, '#fff4c8', `rgb(${col})`, 0, 0); c.fillRect(x - 0.7, y - 0.4, 1.4, 2);
    if (out) out.push({ x, y, r: 26, color: col, a: 0.55 });
  }
  function haybale(c, cx, cy, rng) {
    box(c, cx, cy, 0, 8, 5, 4,
      (w, h) => { c.fillStyle = '#c9a456'; c.fillRect(0, 0, w, h); straw(c, w, h, rng); c.fillStyle = 'rgba(60,40,10,0.5)'; c.fillRect(0, h * 0.3, w, 0.3); c.fillRect(0, h * 0.7, w, 0.3); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(0, h - 1, w, 1); },
      (w, h) => { c.fillStyle = '#ddb968'; c.fillRect(0, 0, w, h); straw(c, w, h, rng); },
      (w, h) => { c.fillStyle = '#e8c878'; c.fillRect(0, 0, w, h); straw(c, w, h, rng); c.fillStyle = 'rgba(60,40,10,0.45)'; c.fillRect(0, h * 0.3, w, 0.3); c.fillRect(0, h * 0.7, w, 0.3); });
  }
  function straw(c, w, h, rng) {
    c.lineWidth = 0.18;
    for (let i = 0; i < w * h * 0.6; i++) { const x = rng() * w, y = rng() * h, a = (rng() - 0.5) * 1.2; c.strokeStyle = rng() < 0.5 ? 'rgba(120,86,30,0.5)' : 'rgba(255,240,170,0.55)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 1.4, y + Math.sin(a) * 1.4); c.stroke(); }
  }
  function groundShadow(c, w, d, zTop, ov, extra = [], col = 'rgba(0,0,0,0.5)') {
    const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], ...extra];
    for (const [x, y] of [[-w / 2 - ov, -d / 2 - ov], [w / 2 + ov, -d / 2 - ov], [w / 2 + ov, d / 2 + ov], [-w / 2 - ov, d / 2 + ov]]) pts.push([x + SUN[0] * zTop, y + SUN[1] * zTop]);
    castShadow(c, hull(pts), 5, col);
    // contact shadow hugging the base
    c.fillStyle = col.replace(/[\d.]+\)$/, '0.35)'); c.beginPath(); c.roundRect(-w / 2 - 1.5, -d / 2 - 1, w + 3, d + 2.5, 2); c.fill();
  }
  function fascia(c, a, b, col, wdt = 0.9) {
    const pa = P(...a), pb = P(...b);
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = wdt + 0.5; c.beginPath(); c.moveTo(pa[0] + 0.2, pa[1] + 0.4); c.lineTo(pb[0] + 0.2, pb[1] + 0.4); c.stroke();
    c.strokeStyle = col; c.lineWidth = wdt; c.beginPath(); c.moveTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]); c.stroke();
  }
  // words painted by survivors, roughed up in a scratch canvas before they go on the roof
  function painted(c, text, x, y, w, h, rng, col = '#f2efe6') {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = col; g.font = `800 112px ${typeof FONT_DISPLAY !== 'undefined' ? FONT_DISPLAY : 'sans-serif'}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.translate(256, 66); g.rotate((rng() - 0.5) * 0.06); g.scale(1, 1.05); g.fillText(text, 0, 0); g.restore();
    g.globalCompositeOperation = 'destination-out';
    const pat = g.createPattern(blotch('bPaintWear', [0, 0, 0], 0.5, 0.12, 6, 507), 'repeat'); g.fillStyle = pat; g.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,0.9)'; g.fillRect(rng() * 512, 0, 2 + rng() * 6, 128); }
    c.save(); c.globalAlpha = 0.82; c.drawImage(cv, x, y, w, h); c.restore();
  }

  // ============================================================ the barn
  function barn(c, rng, wide, out) {
    const w = wide ? 78 : 40, d = 20, hgt = 16, ov = 1.6, k1 = 3, h1 = 6, h2 = 4, zr = hgt + h1 + h2;
    const red = ['#8e2b20', '#7e2a22', '#923424'][Math.floor(rng() * 3)];
    const tinRoof = rng() < 0.65;
    c.save(); c.translate(0, 8);
    // a beaten-earth yard in front of the doors, straw trodden into it
    c.fillStyle = 'rgba(92,72,44,0.3)'; ellipse(c, 0, d / 2 + 4, w * 0.3, 4.5, 0); c.fill();
    c.strokeStyle = 'rgba(214,180,100,0.6)'; c.lineWidth = 0.3;
    for (let i = 0; i < 26; i++) { const x = (rng() - 0.5) * w * 0.55, y = d / 2 + 1.5 + rng() * 6, a = rng() * TAU; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8); c.stroke(); }
    groundShadow(c, w, d, zr, ov);
    // the long front wall
    southWall(c, -w / 2, w / 2, d / 2, 0, hgt, 0, (W2, H2) => {
      boards(c, W2, H2, { col: red, wear: 0.55 }, rng);
      overlay(c, grime(), 0, 0, W2, H2, 0.5, rng);
      wallLight(c, W2, H2, -0.18, 3.2);
      // white corner boards
      for (const x of [0, W2 - 1.6]) { c.fillStyle = '#d9d2c2'; c.fillRect(x, 0, 1.6, H2); overlay(c, grain(), x, 0, 1.6, H2, 0.5, rng); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 1.6, 0, 0.4, H2); }
      // the big sliding doors on their track, braced with white X frames
      const dw = wide ? 18 : 13, dh = H2 - 1.8, dx = W2 / 2 - dw / 2, dy = H2 - dh;
      c.fillStyle = '#1c1612'; c.fillRect(dx - 1, dy - 2.2, dw + 2, 0.9);
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(dx - 0.6, dy - 0.3, dw + 1.6, dh + 0.3);
      const open = rng() < 0.4 ? 2.2 + rng() * 3 : 0;
      if (open) { c.fillStyle = '#0c0a08'; c.fillRect(dx + dw / 2 - open / 2, dy, open, dh); }
      for (const [px, sd] of [[dx - (open ? open / 2 : 0), 1], [dx + dw / 2 + (open ? open / 2 : 0), -1]]) {
        const pw = dw / 2;
        for (let xx = px; xx < px + pw - 0.1; xx += pw / 4) { c.fillStyle = jitter(red, rng, 0.08); c.fillRect(xx, dy, pw / 4 - 0.15, dh); }
        overlay(c, grain(), px, dy, pw, dh, 0.7, rng);
        overlay(c, peel(), px, dy, pw, dh, 0.4, rng);
        c.fillStyle = '#ddd6c6';
        c.fillRect(px, dy, pw, 1.1); c.fillRect(px, dy + dh - 1.1, pw, 1.1); c.fillRect(px, dy, 1.1, dh); c.fillRect(px + pw - 1.1, dy, 1.1, dh); c.fillRect(px, dy + dh / 2 - 0.5, pw, 1);
        c.save(); c.beginPath(); c.rect(px + 1, dy + 1, pw - 2, dh - 2); c.clip();
        for (const [y0, y1] of [[dy, dy + dh / 2], [dy + dh / 2, dy + dh]]) {
          c.save(); c.translate(px + pw / 2, (y0 + y1) / 2);
          for (const s of [1, -1]) { c.save(); c.rotate(s * Math.atan2(y1 - y0, pw)); c.fillRect(-pw, -0.5, pw * 2, 1); c.restore(); }
          c.restore();
        }
        c.restore();
        overlay(c, peel(), px, dy, pw, dh, 0.25, rng);
        c.fillStyle = '#2a2420'; circle(c, px + 2.2, dy - 1.75, 0.6); c.fill(); circle(c, px + pw - 2.2, dy - 1.75, 0.6); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(sd > 0 ? px + pw - 0.4 : px, dy, 0.4, dh);
      }
      // windows either side, some boarded up since the outbreak
      const wins = wide ? [W2 * 0.12, W2 * 0.28, W2 * 0.72 - 5.5, W2 * 0.88 - 5.5] : [W2 * 0.1, W2 * 0.9 - 5.5];
      for (const x of wins) windowAt(c, x, 4.4, 5.5, 5, { style: ['glass', 'boarded', 'broken', 'glass'][Math.floor(rng() * 4)], trim: '#d9d2c2' }, rng);
      // a lantern by the doors
      lantern(c, dx - 2.5, dy + 2, null);
    });
    // the gambrel roof, back to front
    const x0 = -w / 2 - ov, x1 = w / 2 + ov, yb = d / 2 - k1, ye = d / 2 + ov;
    const roofPaint = (L, D, k) => {
      if (tinRoof) tin(c, L, D, { col: '#8f9391', k, rust: 0.9, odd: 0.12, odd2: '#7a4a32' }, rng);
      else shingles(c, L, D, { col: '#5b4a3c', k, moss: 0.45, missing: 0.02 }, rng);
    };
    slope(c, [x0, -yb, hgt + h1], [x1, -yb, hgt + h1], [x0, -ye, hgt], roofPaint);
    slope(c, [x0, 0, zr], [x1, 0, zr], [x0, -yb, hgt + h1], roofPaint);
    slope(c, [x0, 0, zr], [x1, 0, zr], [x0, yb, hgt + h1], (L, D, k) => {
      roofPaint(L, D, k);
      if (wide && rng() < 0.45) painted(c, ['HELP', 'SOS', 'ALIVE'][Math.floor(rng() * 3)], L * 0.12, D * 0.12, L * 0.42, D * 0.8, rng);
    });
    slope(c, [x0, yb, hgt + h1], [x1, yb, hgt + h1], [x0, ye, hgt], (L, D, k) => { roofPaint(L, D, k); c.fillStyle = linear(c, 0, 0, 0, 2.5, [[0, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, 0, L, 2.5); });
    // ridge and eave trim
    fascia(c, [x0, 0, zr + 0.2], [x1, 0, zr + 0.2], tinRoof ? '#a7aaa6' : '#3e342c', 1.1);
    fascia(c, [x0, yb, hgt + h1], [x1, yb, hgt + h1], tinRoof ? '#9a9d99' : '#4a3e34', 0.6);
    fascia(c, [x0, ye, hgt], [x1, ye, hgt], '#dcd5c6', 0.9);
    if (wide) {
      // a louvred cupola on the ridge with a rooster weathervane
      box(c, 0, 0, zr - 1.5, 7, 7, 6,
        (W2, H2) => { c.fillStyle = '#e0d9ca'; c.fillRect(0, 0, W2, H2); c.fillStyle = '#2a201a'; c.fillRect(1.2, 1, W2 - 2.4, H2 - 2); for (let y = 1.5; y < H2 - 1; y += 1) { c.fillStyle = '#cfc7b6'; c.fillRect(1.2, y, W2 - 2.4, 0.45); } wallLight(c, W2, H2, -0.15, 1); },
        (W2, H2) => { c.fillStyle = '#efe9dc'; c.fillRect(0, 0, W2, H2); },
        (W2, H2) => { c.fillStyle = '#d8d1c2'; c.fillRect(0, 0, W2, H2); });
      const apex = P(0, 0, zr + 8.5), top = zr + 4.5;
      for (const [a, b, sh] of [[[-4.2, -4.2], [4.2, -4.2], 0.25], [[4.2, -4.2], [4.2, 4.2], -0.3], [[-4.2, -4.2], [-4.2, 4.2], 0.2], [[-4.2, 4.2], [4.2, 4.2], -0.05]]) {
        poly(c, [P(a[0], a[1], top), P(b[0], b[1], top), apex]); c.fillStyle = tone('#8f9391', sh); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.25; c.stroke();
      }
      const vx = apex[0], vy = apex[1];
      c.strokeStyle = '#1a1714'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(vx, vy); c.lineTo(vx, vy - 6); c.moveTo(vx - 3, vy - 4); c.lineTo(vx + 3, vy - 4); c.stroke();
      c.fillStyle = '#1a1714'; poly(c, [[vx + 3, vy - 4], [vx + 2, vy - 4.6], [vx + 2, vy - 3.4]]); c.fill();
      c.beginPath(); c.moveTo(vx - 1.6, vy - 6); c.quadraticCurveTo(vx - 0.5, vy - 8.6, vx + 0.8, vy - 7.8); c.lineTo(vx + 1.6, vy - 8.8); c.lineTo(vx + 1.4, vy - 6.6); c.quadraticCurveTo(vx + 0.6, vy - 5.8, vx - 1.6, vy - 6); c.fill();
      // square bales stacked against the wall
      haybale(c, w / 2 - 6, d / 2 + 4, rng); haybale(c, w / 2 - 14, d / 2 + 4.6, rng); haybale(c, w / 2 - 10, d / 2 + 4.3, rng);
    }
    out.glows.push({ x: -((wide ? 18 : 13) / 2) - 2.5, y: d / 2 + 8 - hgt * ZY + 4, r: 28, color: '255,190,100', a: 0.5 });
    c.restore();
  }

  // ============================================================ the log cabin
  function cabin(c, rng, wide, out) {
    const w = wide ? 64 : 38, d = 14, hgt = 16, ov = 2, rh = 7, zr = hgt + rh, logCol = ['#7a5434', '#6c4a2e', '#80603e'][Math.floor(rng() * 3)];
    c.save(); c.translate(0, 8);
    // trodden snow and a dug path to the door
    c.fillStyle = 'rgba(150,170,195,0.35)'; ellipse(c, -w * 0.1, d / 2 + 6, 7, 3.5, 0.2); c.fill();
    c.fillStyle = 'rgba(120,140,170,0.4)';
    for (let i = 0; i < 9; i++) { ellipse(c, -w * 0.1 + (rng() - 0.5) * 6, d / 2 + 4 + i * 1.6, 0.8, 0.5, 0); c.fill(); }
    groundShadow(c, w, d, zr, ov, [], 'rgba(40,62,104,0.42)');
    southWall(c, -w / 2, w / 2, d / 2, 0, hgt, 0, (W2, H2) => {
      logs(c, W2, H2, { col: logCol }, rng);
      wallLight(c, W2, H2, -0.12, 3.4);
      const dx = W2 * 0.4 - 3;
      // porch boards in front of the door
      plankDoor(c, dx, H2 - 10, 6.4, 10, { col: '#5a3e26', trim: '#3a2818' }, rng);
      const wins = wide ? [W2 * 0.12, W2 * 0.62, W2 * 0.82] : [W2 * 0.68];
      for (const x of wins) {
        // shutters either side of each lit window, frost in the corners and snow on the sill
        for (const sx of [x - 3.2, x + 5.6]) { c.fillStyle = '#2f4a3a'; c.fillRect(sx, 3.6, 2.4, 5.8); c.fillStyle = 'rgba(0,0,0,0.3)'; for (let yy = 4.2; yy < 9.2; yy += 0.9) c.fillRect(sx + 0.3, yy, 1.8, 0.35); }
        windowAt(c, x, 3.6, 5, 5.8, { style: rng() < 0.75 ? 'lit' : 'glass', trim: '#d9cdb4', frost: true, snow: true }, rng);
      }
      lantern(c, dx + 8.4, 3.4, null);
    });
    // the log ends at both corners
    face(c, P(-w / 2, d / 2, hgt), [1, 0], [-ZX, ZY], [[-3, -1], [w + 3, -1], [w + 3, hgt + 1], [-3, hgt + 1]], () => { logEnds(c, 0, hgt, { col: logCol }, rng); logEnds(c, w, hgt, { col: logCol }, rng); });
    // roof: shingles under a heavy load of snow, icicles along the eave
    const x0 = -w / 2 - ov, x1 = w / 2 + ov, ye = d / 2 + ov;
    slope(c, [x0, 0, zr], [x1, 0, zr], [x0, -ye, hgt], (L, D, k) => { shingles(c, L, D, { col: '#4b3a2e', k }, rng); snowCover(c, L, D, { k, gap: 1.6 }, rng); });
    slope(c, [x0, 0, zr], [x1, 0, zr], [x0, ye, hgt], (L, D, k) => { shingles(c, L, D, { col: '#4b3a2e', k }, rng); snowCover(c, L, D, { k, gap: 2.2 }, rng); });
    fascia(c, [x0, ye, hgt], [x1, ye, hgt], '#3a2c20', 0.8);
    fascia(c, [x0, 0, zr + 0.5], [x1, 0, zr + 0.5], '#e9f0f7', 2); fascia(c, [x0, 0, zr + 0.9], [x1, 0, zr + 0.9], '#ffffff', 0.8);
    const e0 = P(x0, ye, hgt), e1 = P(x1, ye, hgt);
    for (let x = e0[0] + 1; x < e1[0] - 1; x += 0.9 + rng() * 1.6) {
      const l = 0.8 + rng() * rng() * 4;
      c.fillStyle = linear(c, 0, e0[1], 0, e0[1] + l, [[0, 'rgba(240,248,255,0.95)'], [1, 'rgba(190,215,240,0.5)']]);
      poly(c, [[x - 0.35, e0[1] + 0.3], [x + 0.35, e0[1] + 0.3], [x, e0[1] + 0.3 + l]]); c.fill();
    }
    // a fieldstone chimney up the west end, capped with snow, smoke drifting off it
    const chX = -w / 2 + 5, chZ = zr + 4;
    box(c, chX, -3, zr - 4, 5.4, 4.6, chZ - (zr - 4),
      (W2, H2) => { stone(c, W2, H2, { col: '#8a8478', mortar: '#4a463e', ch: 1.6 }, rng); c.fillStyle = 'rgba(10,10,10,0.35)'; c.fillRect(0, 0, W2, 2); wallLight(c, W2, H2, -0.15, 0.5); },
      (W2, H2) => { stone(c, W2, H2, { col: '#a29c8e', mortar: '#57524a', ch: 1.6 }, rng); },
      (W2, H2) => { c.fillStyle = '#5a554c'; c.fillRect(0, 0, W2, H2); c.fillStyle = '#f4f8fc'; c.beginPath(); c.roundRect(-0.5, -0.5, W2 + 1, H2 * 0.55, 1.2); c.fill(); c.fillStyle = '#0e0b08'; c.fillRect(1.4, H2 * 0.4, W2 - 2.8, H2 * 0.45); c.fillStyle = 'rgba(30,24,18,0.5)'; c.fillRect(0.8, H2 * 0.32, W2 - 1.6, 0.4); });
    const top = P(chX, -3, chZ);
    out.smoke.push({ x: top[0], y: top[1] + 8 });
    // drifts against the wall, the woodpile and a chopping stump
    for (let x = -w / 2 - 1; x < w / 2 + 1; x += 3 + rng() * 3) {
      const rx = 3 + rng() * 3, ry = 1.2 + rng() * 1.4;
      c.fillStyle = linear(c, 0, d / 2 - ry, 0, d / 2 + ry, [[0, '#ffffff'], [0.6, '#e6eef6'], [1, '#bccbdc']]); ellipse(c, x, d / 2 + 0.4, rx, ry, 0); c.fill();
    }
    if (wide) {
      const px = w / 2 - 9;
      face(c, P(px - 5, d / 2 + 3.5, 6), [1, 0], [-ZX, ZY], [[0, 0], [10, 0], [10, 6], [0, 6]], () => {
        c.fillStyle = '#2a1e14'; c.fillRect(0, 0, 10, 6);
        for (let y = 0.8; y < 6; y += 1.5) for (let x = 0.8 + (Math.round(y) % 2) * 0.7; x < 10; x += 1.45) { circle(c, x, y, 0.68); c.fillStyle = radial(c, x, y, 0.68, '#d2b384', '#7a5634', 0, 0); c.fill(); }
      });
      const pt = P(px - 5, d / 2 + 3.5, 6);
      c.fillStyle = '#f4f8fc'; c.beginPath(); c.roundRect(pt[0], pt[1] - 1.6, 10.5, 2, 0.8); c.fill();
      const sx = -w / 2 + 7, sy = d / 2 + 6;
      ellipse(c, sx + 1.5, sy + 1.5, 3, 1.6, 0); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
      c.fillStyle = '#5e4630'; c.fillRect(sx - 2.4, sy - 2.2, 4.8, 2.4);
      ellipse(c, sx, sy - 2.2, 2.4, 1.2, 0); c.fillStyle = '#c8a878'; c.fill(); c.strokeStyle = 'rgba(110,76,40,0.6)'; c.lineWidth = 0.15; ellipse(c, sx, sy - 2.2, 1.4, 0.7, 0); c.stroke();
      c.strokeStyle = '#5a3e24'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(sx + 0.3, sy - 2.6); c.lineTo(sx + 3.2, sy - 6); c.stroke();
      c.fillStyle = '#9aa2a8'; poly(c, [[sx - 0.8, sy - 2.2], [sx + 0.9, sy - 3.4], [sx + 0.4, sy - 1.8]]); c.fill();
    }
    out.glows.push({ x: -w * 0.1, y: d / 2 + 8 - hgt * ZY + 5, r: 34, color: '255,180,90', a: 0.6 });
    c.restore();
  }

  // ============================================================ the bayou shack
  function shack(c, rng, wide, out) {
    const w = wide ? 60 : 36, d = 16, raise = 4, hgt = 12, ov = 1.8, rh = 4, porch = 6, zr = raise + hgt + rh;
    const paint = ['#5f6b5e', '#6b6050', '#4f6268'][Math.floor(rng() * 3)];
    c.save(); c.translate(0, 4);
    // mud around the pilings, and the shade under the floor
    c.fillStyle = 'rgba(40,32,18,0.4)'; ellipse(c, 0, d / 2 + 3, w * 0.56, d * 0.55 + 3, 0); c.fill();
    groundShadow(c, w, d + porch, zr, ov);
    const yF = d / 2;
    // pilings under the house and porch
    const posts = [];
    for (let x = -w / 2 + 1; x <= w / 2 - 1; x += (w - 2) / (wide ? 5 : 3)) posts.push(x);
    c.fillStyle = 'rgba(0,0,0,0.6)'; poly(c, [P(-w / 2, yF + porch, raise), P(w / 2, yF + porch, raise), P(w / 2, yF + porch, 0), P(-w / 2, yF + porch, 0)]); c.fill();
    for (const x of posts) for (const y of [yF, yF + porch]) {
      const a = P(x, y, raise), b = P(x, y, 0);
      c.fillStyle = linear(c, a[0] - 0.7, 0, a[0] + 0.7, 0, [[0, '#6a5a44'], [1, '#2e261c']]); c.fillRect(b[0] - 0.7, a[1], 1.4, b[1] - a[1]);
      c.fillStyle = 'rgba(40,34,18,0.7)'; c.fillRect(b[0] - 0.7, b[1] - 1.2, 1.4, 1.2);
    }
    southWall(c, -w / 2, w / 2, yF, raise, raise + hgt, 0, (W2, H2) => {
      clapboard(c, W2, H2, { col: paint, wear: 0.6, missing: 0.12 }, rng);
      overlay(c, grime(), 0, 0, W2, H2, 0.6, rng);
      overlay(c, moss(), 0, H2 * 0.5, W2, H2 * 0.5, 0.6, rng);
      wallLight(c, W2, H2, -0.15, 3);
      const dx = W2 * 0.45;
      plankDoor(c, dx, H2 - 9.5, 5.5, 9.5, { col: '#6a5a46', trim: '#2e261c' }, rng);
      // a sheet of plywood nailed over a hole
      const px = W2 * 0.12, py = 3.6;
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(px + 0.4, py + 0.5, 8, 5);
      c.fillStyle = '#a08a62'; c.fillRect(px, py, 8, 5); overlay(c, grain(), px, py, 8, 5, 0.6, rng, 90); overlay(c, grime(), px, py, 8, 5, 0.5, rng);
      c.fillStyle = '#2a241c'; for (const [nx, ny] of [[0.5, 0.5], [7.2, 0.5], [0.5, 4.2], [7.2, 4.2]]) c.fillRect(px + nx, py + ny, 0.35, 0.35);
      const wins = wide ? [W2 * 0.72, W2 * 0.88 - 4] : [W2 * 0.78 - 2];
      for (const x of wins) windowAt(c, x, 3.6, 4.6, 4.6, { style: rng() < 0.5 ? 'boarded' : rng() < 0.5 ? 'lit' : 'broken', trim: '#8a8270' }, rng);
    });
    // a rusted, patched tin roof; one sheet is a tied-down blue tarp
    const x0 = -w / 2 - ov, x1 = w / 2 + ov, ye = d / 2 + ov;
    slope(c, [x0, 0, zr], [x1, 0, zr], [x0, -ye, raise + hgt], (L, D, k) => tin(c, L, D, { col: '#77706a', k, rust: 1, odd: 0.3, odd2: '#6e4a32' }, rng));
    slope(c, [x0, 0, zr], [x1, 0, zr], [x0, ye, raise + hgt], (L, D, k) => {
      tin(c, L, D, { col: '#77706a', k, rust: 1, odd: 0.3, odd2: '#6e4a32' }, rng);
      const tx = L * (0.2 + rng() * 0.4), tw = L * 0.2;
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.roundRect(tx + 0.4, 1.2, tw, D - 2, 1.2); c.fill();
      c.fillStyle = linear(c, tx, 0, tx + tw, D, [[0, '#3a6a90'], [0.5, '#2a5276'], [1, '#203e58']]); c.beginPath(); c.roundRect(tx, 0.8, tw, D - 2, 1.2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 0.3; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(tx + rng() * tw, 1); c.quadraticCurveTo(tx + rng() * tw, D * 0.5, tx + rng() * tw, D - 1.5); c.stroke(); }
      overlay(c, grime(), tx, 0.8, tw, D - 2, 0.85, rng); overlay(c, moss(), tx, 0.8, tw, D - 2, 0.3, rng);
      c.strokeStyle = '#c8b890'; c.lineWidth = 0.3; for (const fx of [0.2, 0.8]) { c.beginPath(); c.moveTo(tx + tw * fx, D - 1.2); c.lineTo(tx + tw * fx + 0.4, D + 0.5); c.stroke(); }
      c.fillStyle = linear(c, 0, 0, 0, 2, [[0, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, 0, L, 2);
    });
    fascia(c, [x0, 0, zr + 0.2], [x1, 0, zr + 0.2], '#5a524a', 1.1);
    fascia(c, [x0, ye, raise + hgt], [x1, ye, raise + hgt], '#4a4238', 0.7);
    // Spanish moss hanging from the eave
    const e0 = P(x0, ye, raise + hgt), e1 = P(x1, ye, raise + hgt);
    c.lineCap = 'round';
    for (let x = e0[0]; x < e1[0]; x += 2 + rng() * 5) {
      if (rng() < 0.4) continue;
      const l = 2 + rng() * 5;
      for (let k = 0; k < 4; k++) { c.strokeStyle = `rgba(${150 + rng() * 30},${160 + rng() * 25},${120 + rng() * 20},0.75)`; c.lineWidth = 0.25; c.beginPath(); c.moveTo(x + (rng() - 0.5), e0[1]); c.quadraticCurveTo(x + (rng() - 0.5) * 2, e0[1] + l * 0.5, x + (rng() - 0.5) * 1.5, e0[1] + l * (0.6 + rng() * 0.4)); c.stroke(); }
    }
    // a stovepipe through the roof
    const sp = P(w * 0.22, -2, zr - 1), sp2 = P(w * 0.22, -2, zr + 5);
    c.fillStyle = linear(c, sp[0] - 1, 0, sp[0] + 1, 0, [[0, '#9a9590'], [1, '#3a3632']]); c.fillRect(sp2[0] - 1, sp2[1], 2, sp[1] - sp2[1]);
    c.fillStyle = '#2a2622'; ellipse(c, sp2[0], sp2[1], 1.4, 0.7, 0); c.fill(); c.fillRect(sp2[0] - 1.6, sp2[1] - 0.6, 3.2, 0.6);
    overlay(c, rust(), sp2[0] - 1, sp2[1], 2, sp[1] - sp2[1], 1, rng);
    out.smoke.push({ x: sp2[0], y: sp2[1] + 4 });
    // the porch: a deck at floor height with a rail, a drum, a crab trap and a lantern
    const deck = [P(-w / 2, yF, raise), P(w / 2, yF, raise), P(w / 2, yF + porch, raise), P(-w / 2, yF + porch, raise)];
    poly(c, deck); c.fillStyle = '#6e5c44'; c.fill();
    c.save(); poly(c, deck); c.clip();
    const dk = P(-w / 2, yF, raise);
    for (let y = 0; y < porch; y += 1.4) { c.fillStyle = jitter('#7a6448', rng, 0.1); c.fillRect(dk[0], dk[1] + y, w, 1.3); }
    c.translate(dk[0], dk[1]); overlay(c, grain(), 0, 0, w, porch, 0.6, rng, 90); overlay(c, grime(), 0, 0, w, porch, 0.6, rng);
    c.fillStyle = linear(c, 0, 0, 0, 2, [[0, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, 0, w, 2);
    c.restore();
    const fe = P(-w / 2, yF + porch, raise);
    c.fillStyle = '#3e3226'; c.fillRect(fe[0], fe[1], w, 1);
    // steps down to the mud
    for (let i = 0; i < 3; i++) { const s = P(w * 0.06, yF + porch + i * 1.4, raise - (i + 1) * 1.3); c.fillStyle = jitter('#6e5a42', rng, 0.1); c.fillRect(s[0] - 3, s[1], 6, 1.2); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(s[0] - 3, s[1] + 1.2, 6, 0.4); }
    // the drum and the trap
    const bx = P(-w / 2 + 5, yF + porch * 0.5, raise);
    ellipse(c, bx[0] + 1, bx[1] + 0.8, 2.6, 1.4, 0); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill();
    c.fillStyle = linear(c, bx[0] - 2.2, 0, bx[0] + 2.2, 0, [[0, '#4a6a8a'], [0.4, '#2e4a66'], [1, '#18283a']]); c.fillRect(bx[0] - 2.2, bx[1] - 5, 4.4, 5);
    overlay(c, rust(), bx[0] - 2.2, bx[1] - 5, 4.4, 5, 1, rng);
    ellipse(c, bx[0], bx[1] - 5, 2.2, 1, 0); c.fillStyle = '#3a5a78'; c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.2; c.stroke();
    const tp = P(w / 2 - 7, yF + porch * 0.55, raise);
    c.strokeStyle = 'rgba(30,30,26,0.9)'; c.lineWidth = 0.2;
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(tp[0] - 2.5, tp[1] - 3, 5, 3);
    for (let i = 0; i <= 10; i++) { c.beginPath(); c.moveTo(tp[0] - 2.5 + i * 0.5, tp[1] - 3); c.lineTo(tp[0] - 2.5 + i * 0.5, tp[1]); c.stroke(); }
    for (let i = 0; i <= 6; i++) { c.beginPath(); c.moveTo(tp[0] - 2.5, tp[1] - 3 + i * 0.5); c.lineTo(tp[0] + 2.5, tp[1] - 3 + i * 0.5); c.stroke(); }
    // the rail along the front of the porch
    const r0 = P(-w / 2, yF + porch, raise + 4), r1 = P(w / 2, yF + porch, raise + 4);
    for (let x = -w / 2; x <= w / 2; x += w / (wide ? 8 : 5)) { if (Math.abs(x - w * 0.06) < 3.5) continue; const a = P(x, yF + porch, raise + 4), b = P(x, yF + porch, raise); c.fillStyle = '#4a3c2c'; c.fillRect(b[0] - 0.4, a[1], 0.8, b[1] - a[1]); }
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(r0[0], r0[1] + 0.4); c.lineTo(r1[0], r1[1] + 0.4); c.stroke();
    c.strokeStyle = '#7a654a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(r0[0], r0[1]); c.lineTo(r1[0], r1[1]); c.stroke();
    // a fishing net draped over the rail
    const nx = r0[0] + w * 0.6;
    c.strokeStyle = 'rgba(200,190,160,0.55)'; c.lineWidth = 0.15;
    for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(nx + i, r0[1]); c.quadraticCurveTo(nx + i + 0.5, r0[1] + 3, nx + i - 0.5, r0[1] + 4 + (i % 3)); c.stroke(); }
    for (let j = 1; j < 4; j++) { c.beginPath(); c.moveTo(nx, r0[1] + j); c.lineTo(nx + 7, r0[1] + j + 0.3); c.stroke(); }
    const lt = P(-w / 2 + 1, yF + porch, raise + 7);
    lantern(c, lt[0], lt[1], null, '200,230,120');
    out.glows.push({ x: lt[0], y: lt[1] + 4, r: 30, color: '200,230,120', a: 0.5 });
    c.restore();
  }

  // ============================================================ the crypt
  function crypt(c, rng, wide, out) {
    const w = wide ? 46 : 32, d = 16, hgt = 15, ov = 1.6, rh = 6, zr = hgt + rh, stoneCol = ['#8b877d', '#7e7b73', '#918b7e'][Math.floor(rng() * 3)];
    const names = ['ASHFORD', 'BLACKWOOD', 'MORROW', 'VALE', 'CROWE', 'HOLLOWAY', 'GRAVES', 'THORNE'];
    c.save(); c.translate(0, 7);
    groundShadow(c, w, d, zr, ov);
    // three broad steps up to the gate
    for (let i = 2; i >= 0; i--) {
      const sw = 16 + i * 4, sy = d / 2 + 1 + i * 1.6, z = (3 - i) * 0.9;
      const a = P(-sw / 2, sy, z), b = P(sw / 2, sy, z);
      c.fillStyle = jitter('#8a867c', rng, 0.06); c.fillRect(a[0], a[1] - 1.8, b[0] - a[0], 1.8);
      c.fillStyle = 'rgba(255,255,245,0.12)'; c.fillRect(a[0], a[1] - 1.8, b[0] - a[0], 0.35);
      c.fillStyle = tone('#6e6a62', 0); c.fillRect(a[0] - 0.2, a[1], b[0] - a[0], z * ZY + 0.2);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(a[0] - 0.2, a[1] + z * ZY, b[0] - a[0], 0.4);
    }
    // the facade: pilasters, the carved name, a pediment with a cross, and the iron gate
    southWall(c, -w / 2, w / 2, d / 2, 0, hgt, 0, (W2, H2) => {
      stone(c, W2, H2, { col: stoneCol, moss: 0.55 }, rng);
      const base = 0, gw = wide ? 12 : 9, gh = hgt - 4.5, gx = W2 / 2 - gw / 2, gy = H2 - gh;
      // pilasters
      for (const px of [1, gx - 3.4, gx + gw + 1.4, W2 - 3]) {
        c.fillStyle = linear(c, px, 0, px + 2, 0, [[0, tone(stoneCol, 0.22)], [0.5, tone(stoneCol, 0.05)], [1, tone(stoneCol, -0.3)]]);
        c.fillRect(px, base + 2.4, 2, H2 - base - 2.4);
        c.fillStyle = tone(stoneCol, 0.15); c.fillRect(px - 0.4, base + 2.2, 2.8, 0.7); c.fillRect(px - 0.4, H2 - 0.8, 2.8, 0.8);
      }
      // entablature carrying the family name
      c.fillStyle = tone(stoneCol, 0.08); c.fillRect(0, base, W2, 2.4);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, base + 2.4, W2, 0.5); c.fillStyle = 'rgba(255,255,245,0.2)'; c.fillRect(0, base, W2, 0.4);
      c.save(); c.font = `700 1.9px ${typeof FONT_DISPLAY !== 'undefined' ? FONT_DISPLAY : 'serif'}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const nm = names[Math.floor(rng() * names.length)];
      c.fillStyle = 'rgba(255,255,245,0.3)'; c.fillText(nm, W2 / 2 + 0.12, base + 1.35); c.fillStyle = 'rgba(20,18,14,0.75)'; c.fillText(nm, W2 / 2, base + 1.2);
      c.restore();
      // the gate: a dark doorway with a cold green glow and iron bars topped with spikes
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(gx - 0.6, gy - 0.6, gw + 1.2, gh + 0.6);
      c.fillStyle = radial(c, gx + gw / 2, gy + gh * 0.7, gw, 'rgba(120,200,140,0.75)', '#060807', 0, 0); c.fillRect(gx, gy, gw, gh);
      c.fillStyle = linear(c, 0, gy, 0, gy + 3, [[0, 'rgba(0,0,0,0.7)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(gx, gy, gw, 3);
      c.fillStyle = '#16181a';
      for (let x = gx + 0.6; x < gx + gw; x += 1.3) { c.fillRect(x, gy + 0.4, 0.4, gh - 0.4); poly(c, [[x - 0.3, gy + 0.6], [x + 0.7, gy + 0.6], [x + 0.2, gy - 0.4]]); c.fill(); }
      c.fillRect(gx, gy + 2, gw, 0.5); c.fillRect(gx, gy + gh * 0.55, gw, 0.5);
      c.strokeStyle = '#7a6a3a'; c.lineWidth = 0.25; circle(c, gx + gw / 2 - 0.9, gy + gh * 0.6, 0.6); c.stroke(); circle(c, gx + gw / 2 + 0.9, gy + gh * 0.6, 0.6); c.stroke();
      // cracks and ivy climbing the west corner
      c.strokeStyle = 'rgba(16,16,14,0.7)'; c.lineWidth = 0.25;
      for (let i = 0; i < 2; i++) { let x = rng() * W2, y = base + 3 + rng() * 4; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rng() - 0.5) * 2.5; y += 1 + rng() * 1.2; c.lineTo(x, y); } c.stroke(); }
      ivy(c, 0.5, H2, H2 * 0.85, rng);
      wallLight(c, W2, H2, -0.1, 1);
    });
    // a flat roof of stone slabs edged by a heavy cornice
    const zt = hgt + 1.4, x0 = -w / 2 - ov, x1 = w / 2 + ov, y0 = -d / 2 - ov, y1 = d / 2 + ov;
    southWall(c, x0, x1, y1, hgt, zt, 0, (W2, H2) => {
      c.fillStyle = tone(stoneCol, 0.05); c.fillRect(0, 0, W2, H2);
      c.fillStyle = 'rgba(255,255,245,0.25)'; c.fillRect(0, 0, W2, 0.35);
      for (let x = 1; x < W2; x += 1.8) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x, H2 - 0.7, 0.9, 0.7); }
      overlay(c, grime(), 0, 0, W2, H2, 0.6, rng);
    });
    face(c, P(x0, y0, zt), [1, 0], [0, 1], [[0, 0], [x1 - x0, 0], [x1 - x0, y1 - y0], [0, y1 - y0]], () => {
      slabs(c, x1 - x0, y1 - y0, { col: stoneCol, k: 0.25 }, rng);
      c.strokeStyle = tone(stoneCol, 0.2); c.lineWidth = 0.8; c.strokeRect(0.4, 0.4, x1 - x0 - 0.8, y1 - y0 - 0.8);
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0.8, 0.8, x1 - x0 - 1.6, 0.5);
    });
    // the pediment standing on the front edge, with a carved cross in its tympanum
    southWall(c, -w / 2 + 1, w / 2 - 1, y1 - 0.4, zt, zt, rh, (W2, H2) => {
      stone(c, W2, H2, { col: tone(stoneCol, 0.06), moss: 0.4, ch: 2.2 }, rng);
      c.fillStyle = 'rgba(0,0,0,0.28)'; poly(c, [[2.2, H2 - 0.6], [W2 / 2, 1.6], [W2 - 2.2, H2 - 0.6]]); c.fill();
      c.fillStyle = tone(stoneCol, -0.12); poly(c, [[2.6, H2 - 0.6], [W2 / 2, 2], [W2 - 2.6, H2 - 0.6]]); c.fill();
      // a carved laurel wreath
      const wx = W2 / 2, wy = H2 - 2.3;
      c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 0.5; circle(c, wx + 0.15, wy + 0.2, 1.5); c.stroke();
      c.strokeStyle = tone(stoneCol, 0.3); circle(c, wx, wy, 1.5); c.stroke();
      c.fillStyle = tone(stoneCol, 0.32); for (let a = 0; a < TAU; a += 0.7) { ellipse(c, wx + Math.cos(a) * 1.5, wy + Math.sin(a) * 1.5, 0.45, 0.22, a + 1.2); c.fill(); }
      c.strokeStyle = tone(stoneCol, 0.28); c.lineWidth = 0.9; c.beginPath(); c.moveTo(0.3, H2); c.lineTo(W2 / 2, 0.4); c.lineTo(W2 - 0.3, H2); c.stroke();
      c.fillStyle = tone(stoneCol, 0.05); c.fillRect(0, H2 - 0.9, W2, 0.9);
    });
    // a stone cross at the peak and urns on plinths
    const pk = P(0, y1 - 0.4, zt + rh);
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(pk[0] - 0.4, pk[1] - 4.4, 1.4, 4.6); c.fillRect(pk[0] - 1.4, pk[1] - 3.4, 3.2, 1);
    c.fillStyle = tone(stoneCol, 0.2); c.fillRect(pk[0] - 0.6, pk[1] - 4.8, 1.2, 4.8); c.fillRect(pk[0] - 1.6, pk[1] - 3.8, 3.2, 1);
    for (const ux of [-w / 2 + 1, w / 2 - 1]) {
      const b = P(ux, d / 2 + 2.5, 0), t = P(ux, d / 2 + 2.5, 3);
      c.fillStyle = 'rgba(0,0,0,0.35)'; ellipse(c, b[0] + 1.2, b[1] + 0.8, 2.4, 1.2, 0); c.fill();
      c.fillStyle = jitter('#8a867c', rng, 0.06); c.fillRect(t[0] - 1.6, t[1], 3.2, b[1] - t[1]);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(t[0] + 0.6, t[1], 1, b[1] - t[1]);
      c.fillStyle = radial(c, t[0] - 0.4, t[1] - 1.6, 2, tone(stoneCol, 0.3), tone(stoneCol, -0.35), 0, 0); ellipse(c, t[0], t[1] - 1.4, 1.5, 1.5, 0); c.fill();
      c.fillStyle = tone(stoneCol, -0.2); c.fillRect(t[0] - 1.1, t[1] - 3.3, 2.2, 0.6);
    }
    // a fallen chunk of cornice in the grass
    c.save(); c.translate(w / 2 + 3, d / 2 + 2); c.rotate(0.4);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0.5, 0.6, 4, 2); c.fillStyle = jitter(stoneCol, rng, 0.08); c.fillRect(0, 0, 4, 2); c.fillStyle = 'rgba(255,255,245,0.2)'; c.fillRect(0, 0, 4, 0.4);
    c.restore();
    const gate = P(0, d / 2, 4);
    out.glows.push({ x: gate[0], y: gate[1] + 7, r: 30, color: '110,220,140', a: 0.5 });
    c.restore();
  }
  function ivy(c, x, y0, l, rng) {
    let px = x, py = y0;
    c.lineCap = 'round';
    for (let i = 0; i < l; i += 0.8) {
      const nx = px + (rng() - 0.5) * 0.9 + 0.05, ny = py - 0.8;
      c.strokeStyle = '#2e3a1c'; c.lineWidth = 0.25; c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
      if (rng() < 0.75) for (const sd of [-1, 1]) { if (rng() < 0.4) continue; const lx = nx + sd * (0.6 + rng() * 0.8), ly = ny + (rng() - 0.5) * 0.6; ellipse(c, lx, ly, 0.55, 0.4, rng() * 3); c.fillStyle = ['#3a5a24', '#4a6e2c', '#2e4a1c', '#5a7a34'][Math.floor(rng() * 4)]; c.fill(); }
      if (rng() < 0.12) ivy(c, nx, ny, l * 0.3 * rng(), rng);
      px = nx; py = ny;
    }
  }

  // ============================================================ the safehouse
  // A poured-concrete bunker inside a ring of sandbags, open where the road comes in. The static
  // parts are painted once into a sprite at the canvas's scale; the flag, the beacon and the
  // door lamp are animated over it every frame.
  const HS = { w: 120, h: 104, ox: 60, oy: 62 };
  const houseCache = new Map();
  function sandbag(c, x, y, z, a, rng) {
    const p = P(x, y, z + 1.3), l = 6.2, wd = 3.4;
    c.save(); c.translate(p[0], p[1]); c.rotate(a); c.scale(1, 0.9);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.roundRect(-l / 2 + 0.3, -wd / 2 + 0.9, l, wd, 1.6); c.fill();
    const col = jitter('#b49c70', rng, 0.08);
    c.fillStyle = linear(c, -l / 2, -wd / 2, l / 2, wd / 2, [[0, tone(col, 0.22)], [0.5, col], [1, tone(col, -0.35)]]);
    c.beginPath(); c.roundRect(-l / 2, -wd / 2, l, wd, 1.6); c.fill();
    // burlap weave, the stitched seam and the tied ends
    c.save(); c.clip();
    c.strokeStyle = 'rgba(70,52,28,0.22)'; c.lineWidth = 0.12;
    for (let k = -l / 2; k < l / 2; k += 0.45) { c.beginPath(); c.moveTo(k, -wd / 2); c.lineTo(k + 0.3, wd / 2); c.stroke(); }
    for (let k = -wd / 2; k < wd / 2; k += 0.45) { c.beginPath(); c.moveTo(-l / 2, k); c.lineTo(l / 2, k + 0.2); c.stroke(); }
    c.restore();
    c.strokeStyle = 'rgba(60,44,24,0.55)'; c.lineWidth = 0.2; c.setLineDash([0.4, 0.4]); c.beginPath(); c.moveTo(-l / 2 + 1, 0.2); c.lineTo(l / 2 - 1, 0.1); c.stroke(); c.setLineDash([]);
    c.fillStyle = tone(col, -0.3); for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(sx * (l / 2 - 0.5), 0, 0.6, wd * 0.36, 0, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(255,250,230,0.18)'; c.beginPath(); c.ellipse(-l * 0.12, -wd * 0.22, l * 0.3, wd * 0.16, 0, 0, TAU); c.fill();
    c.restore();
  }
  function ring(c, gap, rng, front) {
    // two courses of bags round the yard, staggered like brickwork, skipping the gateway
    for (const [course, z] of [[0, 0], [1, 2.3]]) {
      const n = 22, step = TAU / n;
      for (let i = 0; i < n; i++) {
        const a = i * step + (course ? step / 2 : 0);
        const off = Math.atan2(Math.sin(a - gap), Math.cos(a - gap));
        if (Math.abs(off) < 0.42) continue;
        const x = Math.cos(a) * 30, y = Math.sin(a) * 25;
        if ((y > 4) !== front) continue;
        sandbag(c, x, y, z, a + Math.PI / 2, rng);
      }
    }
  }
  function hedgehog(c, x, y, rng) {
    // a welded anti-tank hedgehog: three crossed girders
    const p = P(x, y, 0);
    c.fillStyle = 'rgba(0,0,0,0.35)'; ellipse(c, p[0] + 2.5, p[1] + 1.5, 5, 2, 0); c.fill();
    c.lineCap = 'square';
    for (const [a, b] of [[[-3.5, 0, 0], [3.5, 0, 7]], [[3.5, 0, 0], [-3.5, 0, 7]], [[0, -3, 0], [0, 3, 7]]]) {
      const pa = P(x + a[0], y + a[1], a[2]), pb = P(x + b[0], y + b[1], b[2]);
      c.strokeStyle = '#1e1c1a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]); c.stroke();
      c.strokeStyle = 'rgba(150,140,120,0.6)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(pa[0] - 0.4, pa[1] - 0.3); c.lineTo(pb[0] - 0.4, pb[1] - 0.3); c.stroke();
      c.strokeStyle = 'rgba(130,60,24,0.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2); c.lineTo((pa[0] * 0.3 + pb[0] * 0.7), (pa[1] * 0.3 + pb[1] * 0.7)); c.stroke();
    }
  }
  function concrete(c, w, h, rng) {
    c.fillStyle = '#8e8f88'; c.fillRect(0, 0, w, h);
    overlay(c, blotch('bConc', [120, 122, 116], 0.35, 0.5, 10, 508, 0.03), 0, 0, w, h, 1, rng);
    // board-form lines from the pour, tie holes, rain stains and a crack
    for (let y = 2.4; y < h; y += 2.4) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, y, w, 0.25); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0, y + 0.25, w, 0.2); }
    for (let y = 1.6; y < h; y += 4.8) for (let x = 2; x < w; x += 6) { circle(c, x, y, 0.28); c.fillStyle = 'rgba(20,20,18,0.55)'; c.fill(); }
    for (let i = 0; i < w / 3; i++) { const x = rng() * w, l = h * (0.3 + rng() * 0.7); c.fillStyle = linear(c, 0, 0, 0, l, [[0, 'rgba(30,32,30,0.35)'], [1, 'rgba(30,32,30,0)']]); c.fillRect(x, 0, 0.5 + rng(), l); }
    overlay(c, grime(), 0, 0, w, h, 0.55, rng);
  }
  function houseSprite(k, gap) {
    const key = Math.round(k * 100) + ':' + Math.round(gap * 10);
    if (houseCache.has(key)) return houseCache.get(key);
    const cv = document.createElement('canvas'); cv.width = Math.ceil(HS.w * k); cv.height = Math.ceil(HS.h * k);
    const c = cv.getContext('2d'), rng = mulberry32(4242);
    c.setTransform(k, 0, 0, k, HS.ox * k, HS.oy * k);
    const bw = 30, bd = 18, bh = 11, zt = bh + 0.8;
    // the beaten yard and a few spent shell casings
    c.fillStyle = radial(c, 0, 0, 30, 'rgba(96,78,52,0.75)', 'rgba(80,64,42,0)', 0, 0); ellipse(c, 0, 0, 34, 29, 0); c.fill();
    c.fillStyle = '#c8a040'; for (let i = 0; i < 14; i++) { const a = rng() * TAU, r = 14 + rng() * 12; c.save(); c.translate(Math.cos(a) * r, Math.sin(a) * r * 0.85); c.rotate(rng() * 3); c.fillRect(-0.5, -0.18, 1, 0.36); c.restore(); }
    // hedgehogs out beyond the bags, away from the gateway
    for (const a of [gap + 1.6, gap + 3.1, gap - 1.7]) hedgehog(c, Math.cos(a) * 41, Math.sin(a) * 33, rng);
    ring(c, gap, rng, false);
    // the bunker
    groundShadow(c, bw, bd, zt + 4, 1);
    southWall(c, -bw / 2, bw / 2, bd / 2, 0, bh, 0, (W2, H2) => {
      concrete(c, W2, H2, rng);
      // stencilled markings
      c.save(); c.font = `800 2.3px ${typeof FONT_DISPLAY !== 'undefined' ? FONT_DISPLAY : 'sans-serif'}`; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(210,60,40,0.75)'; c.textAlign = 'left'; c.fillText('SAFE ZONE', 1.6, 2.4);
      c.fillStyle = 'rgba(240,236,220,0.65)'; c.textAlign = 'right'; c.fillText('07', W2 - 1.6, 2.4);
      c.restore();
      overlay(c, blotch('bPaintWear', [0, 0, 0], 0.5, 0.12, 6, 507), 0, 1, W2, 3, 0.35, rng);
      // firing slits
      for (const sx of [3, W2 - 9]) { c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(sx - 0.4, 4.6, 6.8, 2.6); c.fillStyle = '#121312'; c.fillRect(sx, 5, 6, 1.6); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(sx, 6.6, 6, 0.5); }
      // the blast door, hazard-striped frame and a lamp
      const dx = W2 / 2 - 3.6, dw = 7.2, dh = 8.4, dy = H2 - dh;
      c.save(); c.beginPath(); c.rect(dx - 1.2, dy - 1.2, dw + 2.4, dh + 1.2); c.clip();
      c.fillStyle = '#e0b02a'; c.fillRect(dx - 1.2, dy - 1.2, dw + 2.4, dh + 1.2);
      c.fillStyle = '#1a1a18'; for (let i = -12; i < 20; i += 2) { poly(c, [[dx - 1.2 + i, dy - 1.2], [dx - 0.2 + i, dy - 1.2], [dx - 0.2 + i - 9, dy + dh], [dx - 1.2 + i - 9, dy + dh]]); c.fill(); }
      c.restore();
      overlay(c, grime(), dx - 1.2, dy - 1.2, dw + 2.4, dh + 1.2, 0.6, rng);
      c.fillStyle = linear(c, dx, dy, dx + dw, dy, [[0, '#5a5f5a'], [0.5, '#474b47'], [1, '#2f322f']]); c.fillRect(dx, dy, dw, dh);
      c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(dx + dw / 2 - 0.1, dy, 0.2, dh);
      c.fillStyle = '#22241f'; for (let yy = dy + 0.8; yy < dy + dh; yy += 1.6) for (const xx of [dx + 0.6, dx + dw - 0.9]) c.fillRect(xx, yy, 0.3, 0.3);
      c.fillStyle = '#101210'; c.fillRect(dx + 1.2, dy + 1.4, 2, 1.4); c.fillRect(dx + dw - 3.2, dy + 1.4, 2, 1.4);
      c.fillStyle = 'rgba(160,200,220,0.25)'; c.fillRect(dx + 1.2, dy + 1.4, 0.8, 1.4);
      c.fillStyle = '#8a8c86'; c.fillRect(dx + dw / 2 - 1.4, dy + dh * 0.55, 0.5, 1.4); c.fillRect(dx + dw / 2 + 0.9, dy + dh * 0.55, 0.5, 1.4);
      overlay(c, rust(), dx, dy, dw, dh, 0.5, rng);
      c.fillStyle = '#2a2c28'; c.fillRect(dx + dw / 2 - 1.2, dy - 2.6, 2.4, 1);
      wallLight(c, W2, H2, -0.12, 0.8);
    });
    // roof slab with a parapet of bags, a hatch, a vent and a radio
    face(c, P(-bw / 2 - 0.8, -bd / 2 - 0.8, zt), [1, 0], [0, 1], [[0, 0], [bw + 1.6, 0], [bw + 1.6, bd + 1.6], [0, bd + 1.6]], () => {
      const W2 = bw + 1.6, D2 = bd + 1.6;
      concrete(c, W2, D2, rng);
      c.fillStyle = 'rgba(255,255,245,0.12)'; c.fillRect(0, 0, W2, D2);
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.5; c.strokeRect(0.25, 0.25, W2 - 0.5, D2 - 0.5);
      // hatch
      c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(W2 * 0.62 + 0.4, D2 * 0.3 + 0.5, 6, 6);
      c.fillStyle = linear(c, W2 * 0.62, D2 * 0.3, W2 * 0.62 + 6, D2 * 0.3 + 6, [[0, '#6a6e68'], [1, '#3c3f3b']]); c.fillRect(W2 * 0.62, D2 * 0.3, 6, 6);
      c.strokeStyle = '#2a2c28'; c.lineWidth = 0.3; c.strokeRect(W2 * 0.62 + 0.6, D2 * 0.3 + 0.6, 4.8, 4.8);
      c.fillStyle = '#1e201c'; c.fillRect(W2 * 0.62 + 2.4, D2 * 0.3 + 2.6, 1.2, 0.6);
      // vent mushroom
      circle(c, W2 * 0.22 + 0.6, D2 * 0.62 + 0.8, 2); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill();
      circle(c, W2 * 0.22, D2 * 0.62, 2); c.fillStyle = radial(c, W2 * 0.22, D2 * 0.62, 2, '#9a9c96', '#4a4c48'); c.fill();
      // radio set and cable
      c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(W2 * 0.12 + 0.5, D2 * 0.18 + 0.6, 6, 3.6);
      c.fillStyle = '#4a5238'; c.fillRect(W2 * 0.12, D2 * 0.18, 6, 3.6); c.fillStyle = '#2e3424'; c.fillRect(W2 * 0.12 + 0.6, D2 * 0.18 + 0.6, 2.4, 1.6);
      c.fillStyle = '#c8b860'; c.fillRect(W2 * 0.12 + 3.6, D2 * 0.18 + 0.8, 0.5, 0.5); c.fillStyle = '#c84030'; c.fillRect(W2 * 0.12 + 4.6, D2 * 0.18 + 0.8, 0.5, 0.5);
      c.strokeStyle = '#151515'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(W2 * 0.12 + 6, D2 * 0.18 + 2); c.bezierCurveTo(W2 * 0.4, D2 * 0.1, W2 * 0.55, D2 * 0.5, W2 * 0.8, D2 * 0.15); c.stroke();
    });
    // a parapet of bags round the roof edge
    for (let x = -bw / 2 + 2.5; x < bw / 2 - 1; x += 6) sandbag(c, x, -bd / 2 + 0.6, zt, 0, rng);
    for (const sx of [-1, 1]) for (let y = -bd / 2 + 4.5; y < bd / 2 - 1; y += 6) sandbag(c, sx * (bw / 2 - 1), y, zt, Math.PI / 2, rng);
    for (let x = -bw / 2 + 2.5; x < bw / 2 - 1; x += 6) if (Math.abs(x) > 4) sandbag(c, x, bd / 2 - 0.6, zt, 0, rng);
    // a floodlight on the front corner
    const fl = P(bw / 2 - 2.5, bd / 2 - 1.5, zt + 3);
    c.strokeStyle = '#1c1c1a'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(fl[0], fl[1] + 3); c.lineTo(fl[0], fl[1]); c.stroke();
    c.fillStyle = '#2a2a28'; c.beginPath(); c.roundRect(fl[0] - 1.6, fl[1] - 1.4, 3.2, 2.2, 0.5); c.fill();
    c.fillStyle = '#f4f0dc'; c.fillRect(fl[0] - 1.1, fl[1] - 0.2, 2.2, 0.8);
    // the satellite dish
    const sd = P(-bw / 2 + 4, bd / 2 - 4, zt + 2.6);
    c.fillStyle = 'rgba(0,0,0,0.35)'; ellipse(c, sd[0] + 1.8, sd[1] + 2.6, 2.8, 1.4, 0); c.fill();
    c.strokeStyle = '#2a2a28'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(sd[0], sd[1] + 2.6); c.lineTo(sd[0], sd[1]); c.stroke();
    c.fillStyle = radial(c, sd[0] - 0.8, sd[1] - 0.8, 3, '#e6e6e0', '#8a8c86', 0, 0); ellipse(c, sd[0], sd[1], 2.8, 2.2, -0.5); c.fill();
    c.strokeStyle = '#4a4c48'; c.lineWidth = 0.25; c.beginPath(); c.moveTo(sd[0], sd[1]); c.lineTo(sd[0] + 1.8, sd[1] - 1.6); c.stroke();
    // the antenna mast (its beacon blinks, drawn live)
    const m0 = P(bw / 2 - 5, -bd / 2 + 3, zt), m1 = P(bw / 2 - 5, -bd / 2 + 3, zt + 22);
    c.strokeStyle = '#1e1e1c'; c.lineWidth = 0.55; c.beginPath(); c.moveTo(m0[0], m0[1]); c.lineTo(m1[0], m1[1]); c.stroke();
    c.lineWidth = 0.15; for (let k = 0.2; k < 1; k += 0.2) { const yy = m0[1] + (m1[1] - m0[1]) * k; c.beginPath(); c.moveTo(m0[0] - 1.2 * (1 - k), yy); c.lineTo(m0[0] + 1.2 * (1 - k), yy); c.stroke(); }
    c.strokeStyle = 'rgba(30,30,28,0.5)'; c.beginPath(); c.moveTo(m1[0], m1[1] + 4); c.lineTo(m0[0] - 4, m0[1] + 1); c.moveTo(m1[0], m1[1] + 4); c.lineTo(m0[0] + 4, m0[1] + 1); c.stroke();
    // the flagpole (the flag itself waves, drawn live)
    const f0 = P(-bw / 2 + 2, -bd / 2 + 2, zt), f1 = P(-bw / 2 + 2, -bd / 2 + 2, zt + 15);
    c.strokeStyle = '#2a2826'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(f0[0], f0[1]); c.lineTo(f1[0], f1[1]); c.stroke();
    circle(c, f1[0], f1[1], 0.6); c.fillStyle = '#c8b060'; c.fill();
    ring(c, gap, rng, true);
    const data = { cv, beacon: m1, flag: f1, lamp: P(0, bd / 2, bh - 1.6) };
    houseCache.set(key, data);
    return data;
  }
  function safehouse(c, x, y, t, hit, gap = Math.PI / 2) {
    const m = c.getTransform(), k = Math.hypot(m.a, m.b) || 1;
    const hs = houseSprite(k, gap);
    c.save(); c.translate(x, y);
    if (hit > 0) c.translate(Math.sin(hit * 60) * 2 * (hit / 0.5), 0);
    c.drawImage(hs.cv, -HS.ox, -HS.oy, hs.cv.width / k, hs.cv.height / k);
    // door lamp, flickering a little
    const fl = 0.85 + Math.sin(t * 13) * 0.05 + Math.sin(t * 31) * 0.04;
    c.fillStyle = radial(c, hs.lamp[0], hs.lamp[1] + 1, 7, `rgba(255,214,140,${0.55 * fl})`, 'rgba(255,214,140,0)', 0, 0); circle(c, hs.lamp[0], hs.lamp[1] + 1, 7); c.fill();
    c.fillStyle = `rgba(255,236,190,${fl})`; c.fillRect(hs.lamp[0] - 0.9, hs.lamp[1] - 0.2, 1.8, 0.7);
    // the flag
    const [fx, fy] = hs.flag, wv = Math.sin(t * 5);
    c.beginPath(); c.moveTo(fx, fy + 0.3);
    for (let i = 1; i <= 6; i++) c.lineTo(fx + i * 1.5, fy + 0.3 + Math.sin(t * 6 - i * 0.8) * 0.7 * (i / 6));
    for (let i = 6; i >= 0; i--) c.lineTo(fx + i * 1.5, fy + 5 + Math.sin(t * 6 - i * 0.8) * 0.7 * (i / 6));
    c.closePath(); c.fillStyle = linear(c, fx, fy, fx + 9, fy, [[0, '#5e6a3a'], [0.5, wv > 0 ? '#76844a' : '#545f34'], [1, '#48522c']]); c.fill();
    c.fillStyle = 'rgba(240,236,220,0.9)'; star(c, fx + 4.6, fy + 2.7 + Math.sin(t * 6 - 3) * 0.35, 1.5, 0.6); c.fill();
    // the beacon
    if (Math.sin(t * 4) > 0.3) { const [bx, by] = hs.beacon; c.fillStyle = radial(c, bx, by, 5, 'rgba(255,80,60,0.7)', 'rgba(255,80,60,0)', 0, 0); circle(c, bx, by, 5); c.fill(); circle(c, bx, by, 0.8); c.fillStyle = '#ff6a50'; c.fill(); }
    c.restore();
  }

  function draw(kind, c, d, rng, out) {
    const wide = !!d.wide;
    if (kind === 'barn') barn(c, rng, wide, out);
    else if (kind === 'cabin') cabin(c, rng, wide, out);
    else if (kind === 'shack') shack(c, rng, wide, out);
    else if (kind === 'crypt') crypt(c, rng, wide, out);
  }

  return { draw, safehouse, P, box, southWall, westWall, slope, face, stone, tin, shingles, boards, clapboard, overlay, grime, rust, moss, grain, castShadow, windowAt, lantern, tone, jitter, wallLight };
})();
