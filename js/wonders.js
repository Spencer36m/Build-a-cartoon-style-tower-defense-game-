'use strict';
// ============================================================
// Globe wonders: painted landmarks that sit on the planet.
// Each one is painted once in detail (shaded faces, rock and bark texture, lit rims) into a
// cached sprite, then animated layers go on top: lava, smoke, flames, water, glows and beams.
// Creatures have pre-painted animation frames. Everything is drawn in a 64 x 64 unit box
// with the ground contact point at (32, 56) and light coming from the upper left.
// ============================================================
const WART = (() => {
  const K = 4, SP = 64 * K, AX = 32, AY = 56, FRAMES = 8;
  const cache = new Map();
  let grainCv = null;

  // ---------- painting helpers ----------
  const lin = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); for (const [k, col] of stops) g.addColorStop(k, col); return g; };
  const rad = (c, x, y, r, stops, fx = x, fy = y) => { const g = c.createRadialGradient(fx, fy, 0, x, y, Math.max(0.01, r)); for (const [k, col] of stops) g.addColorStop(k, col); return g; };
  const poly = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
  const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); };
  const glow = (c, x, y, r, col, a) => { c.fillStyle = rad(c, x, y, r, [[0, `rgba(${col},${a})`], [1, `rgba(${col},0)`]]); c.fillRect(x - r, y - r, r * 2, r * 2); };
  // shared fine-grain noise used to texture rock, bark and stone
  function grain() {
    if (grainCv) return grainCv;
    grainCv = document.createElement('canvas'); grainCv.width = grainCv.height = SP;
    const g = grainCv.getContext('2d'), img = g.createImageData(SP, SP), n = makeNoise(4711);
    for (let y = 0; y < SP; y++) for (let x = 0; x < SP; x++) {
      const v = fbm(n, x / 9, y / 9, 4) * 0.7 + Math.random() * 0.3;
      const o = (y * SP + x) * 4, k = Math.round(120 + v * 135);
      img.data[o] = img.data[o + 1] = img.data[o + 2] = k; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return grainCv;
  }
  // multiply the grain over whatever shape is currently traced
  function texture(c, a = 0.45) {
    c.save(); c.clip();
    c.globalCompositeOperation = 'multiply'; c.globalAlpha = a;
    c.drawImage(grain(), 0, 0, 64, 64);
    c.restore();
  }
  // shade the far (right/lower) side of the traced shape and light its near edge
  function form(c, cx, cy, r, dark = 0.45) {
    c.save(); c.clip();
    c.fillStyle = rad(c, cx - r * 0.45, cy - r * 0.5, r * 1.6, [[0, 'rgba(255,245,225,0.18)'], [0.45, 'rgba(0,0,0,0)'], [1, `rgba(0,0,8,${dark})`]]);
    c.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
    c.restore();
  }
  const contact = (c, x, y, rx, ry, a = 0.45) => { c.fillStyle = rad(c, x, y, rx, [[0, `rgba(0,0,0,${a})`], [1, 'rgba(0,0,0,0)']]); c.save(); c.translate(x, y); c.scale(1, ry / rx); c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.restore(); c.fill(); };

  // ---------- animated pieces shared by several wonders ----------
  function flame(c, x, y, h, t, seed, hue = 'fire') {
    const f = 1 + Math.sin(t * 9 + seed) * 0.12 + Math.sin(t * 15.3 + seed * 2.1) * 0.08;
    const hh = h * f, w = h * 0.36, sway = Math.sin(t * 6 + seed) * w * 0.5;
    c.beginPath(); c.moveTo(x - w, y);
    c.bezierCurveTo(x - w * 1.3, y - hh * 0.45, x - w * 0.2 + sway * 0.4, y - hh * 0.7, x + sway, y - hh);
    c.bezierCurveTo(x + w * 0.4 + sway * 0.4, y - hh * 0.6, x + w * 1.3, y - hh * 0.4, x + w, y);
    c.closePath();
    const cols = hue === 'ghost' ? ['rgba(220,255,240,0.95)', 'rgba(110,255,190,0.8)', 'rgba(40,180,140,0)'] : ['rgba(255,250,210,0.98)', 'rgba(255,150,40,0.92)', 'rgba(190,40,10,0)'];
    c.fillStyle = lin(c, x, y, x, y - hh, [[0, cols[0]], [0.35, cols[1]], [1, cols[2]]]);
    c.fill();
  }
  // a column of lit, rolling smoke drifting downwind
  function smoke(c, x, y, t, n, size, rise, col = [92, 86, 82], drift = 6) {
    for (let i = 0; i < n; i++) {
      const k = (t * 0.18 + i / n) % 1, r = size * (0.6 + k * 1.6);
      const px = x + k * drift + Math.sin(i * 2.3 + t * 0.4) * size * 0.4, py = y - k * rise;
      const a = Math.min(1, k * 6) * (1 - k) * 0.85;
      c.fillStyle = rad(c, px, py, r, [[0, `rgba(${col[0] + 55},${col[1] + 55},${col[2] + 55},${a})`], [0.6, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.8})`], [1, `rgba(${col[0] - 40},${col[1] - 40},${col[2] - 40},0)`]], px - r * 0.35, py - r * 0.4);
      c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill();
    }
  }
  function sparks(c, x, y, t, n, spread, height, col = '255,190,90') {
    for (let i = 0; i < n; i++) {
      const k = (t * 0.6 + i * 0.137) % 1, sx = x + Math.sin(i * 12.9898) * spread + Math.sin(t * 2 + i) * 1.5 * k;
      c.fillStyle = `rgba(${col},${(1 - k) * 0.95})`;
      c.beginPath(); c.arc(sx, y - k * height, 0.35 + (1 - k) * 0.35, 0, TAU); c.fill();
    }
  }
  // a faceted crystal: lit left facet, mid front, dark right facet, bright edges
  function crystal(c, x, y, h, w, tilt, hue) {
    c.save(); c.translate(x, y); c.rotate(tilt);
    const top = [0, -h], l = [-w, -h * 0.62], r = [w, -h * 0.6], bl = [-w * 0.75, 0], br = [w * 0.75, 0], mid = [w * 0.12, -h * 0.58], mb = [w * 0.1, 0];
    const [lc, mc, dc] = hue;
    poly(c, [top, l, bl, mb, mid]); c.fillStyle = lin(c, -w, -h, w, 0, [[0, lc], [1, mc]]); c.fill();
    poly(c, [top, mid, mb, br, r]); c.fillStyle = lin(c, 0, -h, w, 0, [[0, mc], [1, dc]]); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 0.25;
    c.beginPath(); c.moveTo(...l); c.lineTo(...top); c.lineTo(...mid); c.lineTo(...mb); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(...top); c.lineTo(...r); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.55)'; poly(c, [[-w * 0.3, -h * 0.78], [-w * 0.1, -h * 0.86], [-w * 0.35, -h * 0.4]]); c.fill();
    c.restore();
  }
  const rock = (c, x, y, rx, ry, base, rng) => {
    poly(c, Array.from({ length: 9 }, (_, i) => { const q = (i / 9) * TAU; const k = 0.8 + rng() * 0.25; return [x + Math.cos(q) * rx * k, y + Math.sin(q) * ry * k * (Math.sin(q) > 0 ? 0.5 : 1)]; }));
    c.fillStyle = lin(c, x - rx, y - ry, x + rx, y + ry, [[0, shade(base, 0.25)], [1, shade(base, -0.5)]]); c.fill();
    texture(c, 0.35);
  };

  // ---------- static paintings ----------
  // Shared geometry for things the static and animated layers both need.
  const LAVA = [[[30, 21], [27, 31], [23, 40], [19, 50]], [[33, 22], [34, 33], [37, 42], [40, 53]], [[35, 21.5], [41, 29], [46, 36], [50, 46]]];
  const trace = (c, p) => { c.beginPath(); c.moveTo(...p[0]); c.bezierCurveTo(...p[1], ...p[2], ...p[3]); };

  const PAINT = {
    volcano(c, rng) {
      c.fillStyle = rad(c, 32, 56, 30, [[0, 'rgba(26,18,14,0.75)'], [0.7, 'rgba(40,28,22,0.35)'], [1, 'rgba(40,28,22,0)']]); ell(c, 32, 56, 30, 7); c.fill();
      const cone = [[3, 56], [10, 48], [16, 40], [21, 31], [25, 24], [28, 20.5], [36, 20.5], [39, 24], [44, 32], [49, 41], [55, 49], [61, 56]];
      poly(c, cone); c.fillStyle = lin(c, 12, 18, 54, 58, [[0, '#9a8676'], [0.4, '#5a4a40'], [1, '#1a1311']]); c.fill();
      poly(c, cone); texture(c, 0.55);
      // the shadowed right flank
      c.save(); poly(c, cone); c.clip();
      poly(c, [[32, 20], [40, 22], [64, 56], [34, 56]]); c.fillStyle = 'rgba(8,4,4,0.38)'; c.fill();
      c.restore();
      // erosion gullies with lit edges
      for (let i = 0; i < 9; i++) {
        const sx = 26 + i * 1.3, ex = 6 + i * 6.5 + rng() * 3;
        c.beginPath(); c.moveTo(sx, 22); c.quadraticCurveTo((sx + ex) / 2 + (rng() - 0.5) * 6, 38, ex, 55);
        c.strokeStyle = 'rgba(14,8,6,0.6)'; c.lineWidth = 0.7; c.stroke();
        c.beginPath(); c.moveTo(sx - 0.5, 22); c.quadraticCurveTo((sx + ex) / 2 - 0.6, 38, ex - 0.6, 55);
        c.strokeStyle = 'rgba(210,190,170,0.18)'; c.lineWidth = 0.35; c.stroke();
      }
      // cooled lava channels
      for (const p of LAVA) { trace(c, p); c.strokeStyle = '#3a120a'; c.lineWidth = 1.6; c.stroke(); }
      // crater
      ell(c, 32, 21, 5, 1.7); c.fillStyle = '#120806'; c.fill();
      c.beginPath(); c.ellipse(32, 21, 5, 1.7, 0, Math.PI, TAU); c.strokeStyle = 'rgba(220,200,180,0.5)'; c.lineWidth = 0.4; c.stroke();
      for (let i = 0; i < 7; i++) rock(c, 8 + rng() * 48, 52 + rng() * 4, 1.4 + rng() * 1.6, 1 + rng(), '#5a4c44', rng);
    },
    fire(c, rng) {
      c.fillStyle = rad(c, 32, 55, 28, [[0, 'rgba(20,14,10,0.8)'], [1, 'rgba(20,14,10,0)']]); ell(c, 32, 55, 28, 6.5); c.fill();
      // charred trees: tapered trunks with broken branches
      const trees = [[14, 54, 30, 0.12], [24, 55, 38, -0.05], [36, 54, 34, 0.08], [47, 55, 28, -0.1], [55, 53, 22, 0.06]];
      for (const [x, y, h, lean] of trees) {
        c.save(); c.translate(x, y); c.rotate(lean);
        poly(c, [[-1.6, 0], [-0.5, -h], [0.5, -h], [1.6, 0]]);
        c.fillStyle = lin(c, -2, 0, 2, 0, [[0, '#4a3a30'], [0.5, '#1e1612'], [1, '#0c0806']]); c.fill();
        c.strokeStyle = '#140e0a'; c.lineCap = 'round';
        for (let k = 0; k < 4; k++) {
          const by = -h * (0.4 + k * 0.14), dir = k % 2 ? 1 : -1, len = 4 + rng() * 5;
          c.lineWidth = 0.9 - k * 0.15; c.beginPath(); c.moveTo(0, by); c.lineTo(dir * len, by - len * 0.6); c.lineTo(dir * (len + 1.5), by - len * 0.9); c.stroke();
        }
        c.restore();
      }
      for (let i = 0; i < 26; i++) { c.fillStyle = `rgba(${120 + rng() * 80},${30 + rng() * 30},10,0.8)`; c.beginPath(); c.arc(6 + rng() * 52, 51 + rng() * 6, 0.3 + rng() * 0.5, 0, TAU); c.fill(); }
    },
    crater(c, rng) {
      c.fillStyle = rad(c, 32, 52, 30, [[0, 'rgba(20,30,18,0.55)'], [1, 'rgba(20,30,18,0)']]); ell(c, 32, 52, 30, 9); c.fill();
      // raised rim, lit on the near-left
      ell(c, 32, 50, 24, 7.5); c.fillStyle = lin(c, 8, 44, 56, 58, [[0, '#8a8270'], [0.5, '#55503f'], [1, '#2a2820']]); c.fill();
      ell(c, 32, 50, 24, 7.5); texture(c, 0.5);
      ell(c, 32, 50.5, 19, 5.4); c.fillStyle = rad(c, 32, 51, 19, [[0, '#0e140c'], [0.7, '#1c2214'], [1, '#3a3a2c']]); c.fill();
      for (let i = 0; i < 12; i++) { const q = rng() * TAU; rock(c, 32 + Math.cos(q) * 23, 50 + Math.sin(q) * 7, 1 + rng() * 1.4, 0.8 + rng() * 0.6, '#6a6252', rng); }
      // the meteor's crystals
      const hue = ['#d8ffd0', '#5ce07a', '#145a2a'];
      crystal(c, 26, 52, 10, 2.6, -0.35, hue); crystal(c, 39, 52.5, 9, 2.4, 0.4, hue);
      crystal(c, 32, 53, 17, 3.6, 0.05, hue); crystal(c, 29.5, 53.5, 7, 1.8, -0.15, hue); crystal(c, 35.5, 53.5, 6, 1.6, 0.25, hue);
    },
    stones(c, rng) {
      c.fillStyle = rad(c, 32, 52, 28, [[0, 'rgba(70,96,52,0.8)'], [1, 'rgba(70,96,52,0)']]); ell(c, 32, 52, 28, 8); c.fill();
      ell(c, 32, 52, 7, 2); c.fillStyle = '#5a5a52'; c.fill(); ell(c, 32, 52, 7, 2); texture(c, 0.5);
      const ring = [];
      for (let i = 0; i < 9; i++) { const q = (i / 9) * TAU + 0.2; ring.push({ q, x: 32 + Math.cos(q) * 20, y: 52 + Math.sin(q) * 6, h: 9 + rng() * 4 }); }
      ring.sort((a, b) => a.y - b.y);
      for (const s of ring) {
        const w = 2.2 + rng() * 0.8, x = s.x, y = s.y;
        const pts = [[x - w, y], [x - w * 1.05, y - s.h * 0.9], [x - w * 0.5, y - s.h], [x + w * 0.6, y - s.h * 0.96], [x + w, y - s.h * 0.8], [x + w * 1.05, y]];
        contact(c, x + 1, y + 0.4, w * 1.6, 1);
        poly(c, pts); c.fillStyle = lin(c, x - w, y - s.h, x + w, y, [[0, '#b4b0a2'], [0.5, '#7a786c'], [1, '#3a3a34']]); c.fill();
        poly(c, pts); texture(c, 0.55);
        poly(c, [[x + w * 0.2, y - s.h * 0.95], [x + w, y - s.h * 0.8], [x + w * 1.05, y], [x + w * 0.3, y]]); c.fillStyle = 'rgba(0,0,10,0.3)'; c.fill();
        c.fillStyle = 'rgba(90,120,60,0.6)'; ell(c, x - w * 0.4, y - 1, w * 0.7, 0.8); c.fill();
        c.strokeStyle = 'rgba(30,30,28,0.8)'; c.lineWidth = 0.35;
        c.beginPath(); c.moveTo(x - 0.8, y - s.h * 0.62); c.lineTo(x + 0.4, y - s.h * 0.55); c.lineTo(x - 0.4, y - s.h * 0.42); c.moveTo(x, y - s.h * 0.35); c.lineTo(x, y - s.h * 0.22); c.stroke();
        s.rune = [x, y - s.h * 0.48];
      }
      PAINT.stones.runes = ring.map((s) => s.rune);
    },
    tree(c, rng) {
      c.fillStyle = rad(c, 32, 55, 26, [[0, 'rgba(30,40,20,0.6)'], [1, 'rgba(30,40,20,0)']]); ell(c, 32, 55, 26, 6); c.fill();
      // roots
      c.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const dir = i < 3.5 ? -1 : 1, ex = 32 + dir * (5 + rng() * 12);
        c.beginPath(); c.moveTo(32 + dir * 1.5, 48); c.quadraticCurveTo(32 + dir * 4, 54, ex, 55 + rng() * 2);
        c.strokeStyle = '#3a2a1c'; c.lineWidth = 1.6 - i * 0.12; c.stroke();
      }
      // a twisted trunk built from braided strands
      for (let s = 0; s < 5; s++) {
        const off = (s - 2) * 1.1;
        c.beginPath(); c.moveTo(32 + off * 1.6, 54); c.bezierCurveTo(32 + off + 3, 44, 32 - off - 3, 34, 32 + off * 0.6, 24);
        c.strokeStyle = s % 2 ? '#5a4030' : '#3e2c20'; c.lineWidth = 2.4; c.stroke();
      }
      c.beginPath(); c.moveTo(30, 54); c.bezierCurveTo(33, 44, 29, 34, 31, 24); c.strokeStyle = 'rgba(200,170,130,0.35)'; c.lineWidth = 0.5; c.stroke();
      // limbs
      for (const [ex, ey] of [[16, 22], [48, 20], [24, 14], [42, 13]]) { c.beginPath(); c.moveTo(32, 27); c.quadraticCurveTo((32 + ex) / 2, ey + 6, ex, ey); c.strokeStyle = '#3e2c20'; c.lineWidth = 1.4; c.stroke(); }
      // canopy: leaf masses lit from the upper left, with golden leaves
      const masses = [[32, 14, 11], [18, 20, 8.5], [46, 18, 9], [25, 10, 8], [40, 9, 8], [32, 24, 8], [12, 25, 6], [52, 24, 6.5]];
      // each mass is a dark core covered in small leaf clusters, brighter toward the light
      for (const [x, y, r] of masses) { c.fillStyle = '#1c3418'; ell(c, x, y + r * 0.1, r * 0.9, r * 0.75); c.fill(); }
      for (const [x, y, r] of masses) {
        for (let i = 0; i < 110; i++) {
          const q = rng() * TAU, d = Math.sqrt(rng()) * r * 0.98, lx = x + Math.cos(q) * d, ly = y + Math.sin(q) * d * 0.8;
          const lit = clamp(0.55 - (lx - x) / r * 0.4 - (ly - y) / r * 0.5 + (rng() - 0.5) * 0.35, 0, 1);
          const lr = 0.55 + rng() * 0.75;
          c.fillStyle = rad(c, lx, ly, lr, [[0, mix('#2e5a26', '#c8d878', lit)], [1, mix('#14280f', '#5e8a3a', lit)]], lx - lr * 0.4, ly - lr * 0.4);
          c.beginPath(); c.arc(lx, ly, lr, 0, TAU); c.fill();
        }
      }
      for (let i = 0; i < 60; i++) { const q = rng() * TAU, d = rng() * 18; c.fillStyle = `rgba(255,${200 + rng() * 40},${100 + rng() * 60},0.9)`; c.beginPath(); c.arc(32 + Math.cos(q) * d * 1.3, 16 + Math.sin(q) * d * 0.7, 0.35 + rng() * 0.4, 0, TAU); c.fill(); }
    },
    island(c, rng) {
      // inverted rock with layered strata and hanging roots
      const body = [[10, 30], [54, 30], [50, 36], [44, 44], [38, 52], [33, 58], [28, 52], [20, 42], [14, 36]];
      poly(c, body); c.fillStyle = lin(c, 10, 30, 54, 58, [[0, '#9a8064'], [0.5, '#6a5440'], [1, '#2a2018']]); c.fill();
      poly(c, body); texture(c, 0.55);
      c.save(); poly(c, body); c.clip();
      for (let i = 0; i < 6; i++) { c.strokeStyle = i % 2 ? 'rgba(40,28,18,0.45)' : 'rgba(200,170,130,0.2)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(8, 33 + i * 3.4); c.quadraticCurveTo(32, 35 + i * 3.6, 56, 32 + i * 3.2); c.stroke(); }
      poly(c, [[34, 30], [56, 30], [36, 60]]); c.fillStyle = 'rgba(0,0,10,0.3)'; c.fill();
      c.restore();
      c.strokeStyle = '#3a3020'; c.lineWidth = 0.4;
      for (let i = 0; i < 9; i++) { const x = 16 + i * 4 + rng() * 2; c.beginPath(); c.moveTo(x, 34 + rng() * 6); c.quadraticCurveTo(x + 1, 42, x - 0.5, 46 + rng() * 6); c.stroke(); }
      // grass cap
      ell(c, 32, 30, 22.5, 4); c.fillStyle = lin(c, 10, 26, 54, 34, [[0, '#9ac060'], [0.6, '#5a8a3a'], [1, '#2e5222']]); c.fill();
      c.beginPath(); c.ellipse(32, 30.5, 22.5, 4, 0, 0, Math.PI); c.strokeStyle = '#3e6a28'; c.lineWidth = 0.6; c.stroke();
      // watchtower with a lit window
      contact(c, 26, 30, 5, 1.2);
      poly(c, [[22.5, 30], [23, 18], [29, 18], [29.5, 30]]); c.fillStyle = lin(c, 22, 0, 30, 0, [[0, '#e0d4c0'], [1, '#8a7e6c']]); c.fill(); poly(c, [[22.5, 30], [23, 18], [29, 18], [29.5, 30]]); texture(c, 0.35);
      poly(c, [[21.5, 18.5], [26, 11], [30.5, 18.5]]); c.fillStyle = lin(c, 21, 11, 31, 18, [[0, '#c0503a'], [1, '#5a1e14']]); c.fill();
      c.fillStyle = '#ffd88a'; c.fillRect(25.2, 21, 1.6, 2.4);
      // trees
      for (const [x, s] of [[38, 1], [43, 0.8], [15, 0.7]]) {
        contact(c, x, 30, 3 * s, 0.8);
        c.fillStyle = '#4a3422'; c.fillRect(x - 0.3, 26 - s, 0.6, 4 + s);
        c.fillStyle = rad(c, x, 23 - s * 2, 4 * s, [[0, '#9ac060'], [1, '#1e4a1c']], x - 1.5 * s, 21 - s * 3); c.beginPath(); c.arc(x, 23 - s * 2, 3.6 * s, 0, TAU); c.fill();
      }
    },
    mountain(c, rng) {
      c.fillStyle = rad(c, 32, 56, 30, [[0, 'rgba(20,16,16,0.6)'], [1, 'rgba(20,16,16,0)']]); ell(c, 32, 56, 30, 6); c.fill();
      const pk = [[4, 56], [12, 44], [17, 40], [22, 30], [26, 24], [29, 15], [31, 12], [34, 16], [37, 22], [41, 26], [46, 36], [52, 42], [60, 56]];
      poly(c, pk); c.fillStyle = lin(c, 10, 10, 56, 58, [[0, '#7a7078'], [0.45, '#3e383e'], [1, '#141014']]); c.fill();
      poly(c, pk); texture(c, 0.6);
      c.save(); poly(c, pk); c.clip(); poly(c, [[31, 12], [64, 56], [36, 56], [33, 30]]); c.fillStyle = 'rgba(0,0,8,0.4)'; c.fill(); c.restore();
      for (let i = 0; i < 10; i++) { const sx = 27 + rng() * 8, ex = 6 + rng() * 52; c.beginPath(); c.moveTo(sx, 16 + rng() * 6); c.lineTo((sx + ex) / 2 + (rng() - 0.5) * 6, 36); c.lineTo(ex, 55); c.strokeStyle = 'rgba(10,6,8,0.5)'; c.lineWidth = 0.5; c.stroke(); }
      // glowing fissures
      for (const p of [[[30, 18], [27, 30], [24, 40], [20, 52]], [[33, 20], [37, 32], [41, 42], [46, 53]]]) { trace(c, p); c.strokeStyle = '#3a0e08'; c.lineWidth = 1; c.stroke(); }
      PAINT.mountain.cracks = [[[30, 18], [27, 30], [24, 40], [20, 52]], [[33, 20], [37, 32], [41, 42], [46, 53]]];
    },
    temple(c, rng) {
      c.fillStyle = rad(c, 32, 55, 30, [[0, 'rgba(190,160,100,0.65)'], [1, 'rgba(190,160,100,0)']]); ell(c, 32, 55, 30, 7); c.fill();
      contact(c, 34, 55, 24, 3, 0.4);
      // five stepped tiers, each with a lit top, a sunny left face and a shaded right face
      for (let i = 0; i < 5; i++) {
        const w = 24 - i * 4.4, y = 55 - i * 6, top = y - 6;
        poly(c, [[32 - w, y], [32 - w + 1.2, top], [32, top], [32, y]]); c.fillStyle = lin(c, 32 - w, 0, 32, 0, [[0, '#e8cc8a'], [1, '#c8a464']]); c.fill();
        poly(c, [[32, y], [32, top], [32 + w - 1.2, top], [32 + w, y]]); c.fillStyle = lin(c, 32, 0, 32 + w, 0, [[0, '#9a7a48'], [1, '#5a4224']]); c.fill();
        poly(c, [[32 - w, y], [32 - w + 1.2, top], [32 + w - 1.2, top], [32 + w, y]]); texture(c, 0.35);
        c.fillStyle = 'rgba(255,240,200,0.6)'; c.fillRect(32 - w + 1.2, top, w * 2 - 2.4, 0.4);
      }
      // grand stair
      poly(c, [[29, 55], [30.5, 25], [33.5, 25], [35, 55]]); c.fillStyle = lin(c, 29, 0, 35, 0, [[0, '#f0dca0'], [1, '#a88a54']]); c.fill();
      c.strokeStyle = 'rgba(90,64,30,0.5)'; c.lineWidth = 0.25; for (let y = 26; y < 55; y += 1.2) { c.beginPath(); c.moveTo(29 + (55 - y) * 0.05, y); c.lineTo(35 - (55 - y) * 0.05, y); c.stroke(); }
      // gold capstone
      poly(c, [[29.5, 25], [32, 19], [34.5, 25]]); c.fillStyle = lin(c, 29, 19, 35, 25, [[0, '#fff2b0'], [0.5, '#e0a830'], [1, '#7a5410']]); c.fill();
      // obelisks
      for (const x of [9, 55]) {
        poly(c, [[x - 1.4, 55], [x - 0.9, 38], [x, 36], [x + 0.9, 38], [x + 1.4, 55]]); c.fillStyle = lin(c, x - 1.4, 0, x + 1.4, 0, [[0, '#e0c890'], [1, '#6a5030']]); c.fill();
      }
    },
    ufo(c) {
      // the saucer only; the beam, lights and cow are animated
      contact(c, 32, 22, 16, 2.2, 0.35);
      ell(c, 32, 20, 17, 4.6); c.fillStyle = lin(c, 15, 15, 49, 25, [[0, '#e6ecf0'], [0.4, '#9aa6ae'], [0.75, '#56606a'], [1, '#2a3038']]); c.fill();
      ell(c, 32, 21.5, 15, 2.6); c.fillStyle = 'rgba(20,24,30,0.55)'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 0.4; c.beginPath(); c.ellipse(32, 19.4, 16.4, 4, 0, Math.PI * 1.05, Math.PI * 1.75); c.stroke();
      c.strokeStyle = 'rgba(30,36,44,0.6)'; c.lineWidth = 0.25; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(32 + i * 4.4, 17); c.lineTo(32 + i * 5, 23); c.stroke(); }
      c.beginPath(); c.ellipse(32, 17, 7, 5.6, 0, Math.PI, TAU); c.fillStyle = rad(c, 32, 16, 7, [[0, 'rgba(210,250,255,0.95)'], [0.6, 'rgba(100,190,230,0.85)'], [1, 'rgba(40,90,130,0.9)']], 29, 13); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.8)'; ell(c, 29.5, 14, 2, 0.9, -0.4); c.fill();
    },
    well(c, rng) {
      c.fillStyle = rad(c, 32, 52, 26, [[0, 'rgba(110,140,90,0.7)'], [1, 'rgba(110,140,90,0)']]); ell(c, 32, 52, 26, 8); c.fill();
      for (let i = 0; i < 14; i++) { const q = rng() * TAU, d = 14 + rng() * 8; c.fillStyle = ['#c8b0f0', '#f0e0a0', '#e8f0ff'][i % 3]; c.beginPath(); c.arc(32 + Math.cos(q) * d, 52 + Math.sin(q) * d * 0.3, 0.6, 0, TAU); c.fill(); }
      // stone ring: back half, water, then front half with blocks
      ell(c, 32, 49, 14, 4.6); c.fillStyle = '#6a6a64'; c.fill();
      ell(c, 32, 49, 11.5, 3.4); c.fillStyle = '#0a1a30'; c.fill();
      c.beginPath(); c.moveTo(18, 49); c.lineTo(18, 52); c.ellipse(32, 52, 14, 4.6, 0, Math.PI, 0, true); c.lineTo(46, 49); c.ellipse(32, 49, 14, 4.6, 0, 0, Math.PI); c.closePath();
      c.fillStyle = lin(c, 18, 0, 46, 0, [[0, '#b0aca0'], [0.5, '#7a786e'], [1, '#3a3a36']]); c.fill();
      c.beginPath(); c.moveTo(18, 49); c.lineTo(18, 52); c.ellipse(32, 52, 14, 4.6, 0, Math.PI, 0, true); c.lineTo(46, 49); c.ellipse(32, 49, 14, 4.6, 0, 0, Math.PI); c.closePath(); texture(c, 0.5);
      c.strokeStyle = 'rgba(30,30,28,0.6)'; c.lineWidth = 0.3;
      for (let i = 0; i < 9; i++) { const q = Math.PI * (0.05 + i * 0.11); const x = 32 - Math.cos(q) * 14; c.beginPath(); c.moveTo(x, 49 + Math.sin(q) * 4.6); c.lineTo(x, 52 + Math.sin(q) * 4.6); c.stroke(); }
    },
    zero(c, rng) {
      c.fillStyle = rad(c, 32, 55, 30, [[0, 'rgba(30,40,24,0.7)'], [1, 'rgba(30,40,24,0)']]); ell(c, 32, 55, 30, 7); c.fill();
      contact(c, 33, 55, 24, 3);
      const box = (x, y, w, h, d, top, side) => {
        poly(c, [[x, y], [x, y - h], [x + w, y - h], [x + w, y]]); c.fillStyle = lin(c, x, y - h, x + w, y, [[0, top], [1, shade(top, -0.3)]]); c.fill();
        poly(c, [[x, y], [x, y - h], [x + w, y - h], [x + w, y]]); texture(c, 0.35);
        poly(c, [[x + w, y], [x + w, y - h], [x + w + d, y - h - d * 0.5], [x + w + d, y - d * 0.5]]); c.fillStyle = side; c.fill();
        poly(c, [[x, y - h], [x + d, y - h - d * 0.5], [x + w + d, y - h - d * 0.5], [x + w, y - h]]); c.fillStyle = shade(top, 0.2); c.fill();
      };
      box(10, 55, 26, 14, 5, '#8a9094', '#3e4448');
      box(36, 55, 14, 9, 4, '#7a8084', '#34393c');
      box(17, 41, 10, 8, 3, '#6a7074', '#2e3234');
      // smokestack
      poly(c, [[44, 46], [44.6, 28], [47.4, 28], [48, 46]]); c.fillStyle = lin(c, 44, 0, 48, 0, [[0, '#9aa0a4'], [1, '#3a4044']]); c.fill();
      c.fillStyle = '#c9483d'; c.fillRect(44.4, 30, 3.2, 1); c.fillRect(44.3, 33, 3.4, 1);
      // dark windows (lit by the animation)
      c.fillStyle = '#1a2018';
      for (let i = 0; i < 6; i++) c.fillRect(12.5 + i * 3.8, 47, 2, 2.4);
      for (let i = 0; i < 3; i++) c.fillRect(38 + i * 3.8, 49.5, 2, 2);
      // hazard sign and fence
      poly(c, [[5, 54], [8, 48.5], [11, 54]]); c.fillStyle = '#e0b02a'; c.fill(); c.fillStyle = '#111'; c.fillRect(7.7, 50.5, 0.6, 2); c.fillRect(7.7, 53, 0.6, 0.5);
      c.strokeStyle = 'rgba(40,44,40,0.85)'; c.lineWidth = 0.3; for (let x = 2; x < 62; x += 2) { c.beginPath(); c.moveTo(x, 57.5); c.lineTo(x, 54.5); c.stroke(); } c.beginPath(); c.moveTo(2, 55); c.lineTo(62, 55); c.stroke();
    },
    ship(c) {
      // a ghostly galleon: translucent hull, tattered sails, rigging
      const hull = [[8, 46], [56, 44], [52, 52], [14, 53]];
      c.globalAlpha = 0.85;
      poly(c, [[6, 43], [14, 42], [14, 46], [8, 46]]); c.fillStyle = '#8ad8c0'; c.fill();
      c.beginPath(); c.moveTo(6, 43); c.lineTo(56, 43); c.quadraticCurveTo(57, 49, 52, 53); c.lineTo(14, 53); c.quadraticCurveTo(8, 50, 6, 43); c.closePath();
      c.fillStyle = lin(c, 0, 43, 0, 53, [[0, 'rgba(190,255,230,0.85)'], [1, 'rgba(40,120,100,0.6)']]); c.fill();
      c.strokeStyle = 'rgba(30,90,80,0.5)'; c.lineWidth = 0.3; for (let y = 45; y < 53; y += 1.6) { c.beginPath(); c.moveTo(8, y); c.lineTo(55, y - 0.6); c.stroke(); }
      for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(20,60,50,0.7)'; c.fillRect(14 + i * 6, 46, 1.6, 1.2); }
      void hull;
      // masts and yards
      c.strokeStyle = 'rgba(160,240,215,0.9)'; c.lineWidth = 0.7;
      for (const [x, h] of [[20, 30], [32, 36], [44, 28]]) { c.beginPath(); c.moveTo(x, 43); c.lineTo(x, 43 - h); c.stroke(); }
      c.lineWidth = 0.4;
      for (const [x, h] of [[20, 30], [32, 36], [44, 28]]) for (const k of [0.35, 0.7]) { c.beginPath(); c.moveTo(x - 7 * (1 - k * 0.4), 43 - h * k); c.lineTo(x + 7 * (1 - k * 0.4), 43 - h * k); c.stroke(); }
      // tattered sails with holes torn out
      for (const [x, h] of [[20, 30], [32, 36], [44, 28]]) for (const k of [0.35, 0.7]) {
        const w = 7 * (1 - k * 0.4), y0 = 43 - h * k, y1 = y0 + h * 0.3;
        c.beginPath(); c.moveTo(x - w, y0); c.quadraticCurveTo(x, y0 + 1, x + w, y0); c.lineTo(x + w * 0.9, y1); for (let i = 6; i >= 0; i--) c.lineTo(x - w + (i / 6) * w * 1.9, y1 + (i % 2 ? -1.4 : 0.4)); c.closePath();
        c.fillStyle = lin(c, x - w, y0, x + w, y1, [[0, 'rgba(230,255,245,0.75)'], [1, 'rgba(120,200,180,0.45)']]); c.fill();
      }
      c.globalCompositeOperation = 'destination-out';
      for (const [hx, hy, r] of [[18, 22, 1.2], [33, 17, 1.4], [30, 26, 0.9], [45, 26, 1.1], [22, 32, 0.8]]) { c.beginPath(); c.arc(hx, hy, r, 0, TAU); c.fill(); }
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = 'rgba(160,240,215,0.45)'; c.lineWidth = 0.2;
      c.beginPath(); c.moveTo(6, 43); c.lineTo(20, 13); c.lineTo(32, 7); c.lineTo(44, 15); c.lineTo(56, 43); c.stroke();
      c.globalAlpha = 1;
    },
    cliff(c, rng) {
      c.fillStyle = rad(c, 32, 56, 30, [[0, 'rgba(20,50,70,0.6)'], [1, 'rgba(20,50,70,0)']]); ell(c, 32, 56, 30, 6); c.fill();
      const cl = [[6, 56], [8, 44], [12, 36], [14, 28], [20, 24], [30, 22], [40, 26], [44, 34], [47, 44], [52, 56]];
      poly(c, cl); c.fillStyle = lin(c, 8, 22, 50, 56, [[0, '#a89880'], [0.5, '#6a5a48'], [1, '#2a2218']]); c.fill();
      poly(c, cl); texture(c, 0.6);
      c.save(); poly(c, cl); c.clip();
      for (let i = 0; i < 8; i++) { c.strokeStyle = i % 2 ? 'rgba(30,20,14,0.5)' : 'rgba(220,200,170,0.22)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(4, 27 + i * 3.6); c.lineTo(54, 25 + i * 3.8 + (rng() - 0.5) * 2); c.stroke(); }
      poly(c, [[34, 22], [56, 30], [56, 60], [40, 60]]); c.fillStyle = 'rgba(0,0,10,0.35)'; c.fill();
      c.restore();
      c.beginPath(); c.moveTo(14, 28); c.quadraticCurveTo(28, 19, 40, 26); c.lineTo(38, 27); c.quadraticCurveTo(28, 22, 15, 29); c.closePath(); c.fillStyle = '#5a8a3a'; c.fill();
      // surf at the base
      for (let i = 0; i < 10; i++) { c.fillStyle = 'rgba(230,245,255,0.6)'; ell(c, 8 + i * 4.6, 55.5 + Math.sin(i) * 0.6, 2.2, 0.6); c.fill(); }
    },
    riftBase(c, rng) {
      c.fillStyle = rad(c, 32, 54, 28, [[0, 'rgba(50,20,60,0.8)'], [1, 'rgba(50,20,60,0)']]); ell(c, 32, 54, 28, 7); c.fill();
      // shattered ground with glowing cracks drawn by the animation
      for (let i = 0; i < 10; i++) { const q = rng() * TAU, d = 6 + rng() * 16; rock(c, 32 + Math.cos(q) * d, 54 + Math.sin(q) * d * 0.25, 1.2 + rng() * 2, 0.8 + rng(), '#4a4250', rng); }
      PAINT.riftBase.cracks = Array.from({ length: 7 }, (_, i) => { const q = (i / 7) * TAU + 0.3; return [[32, 54], [32 + Math.cos(q) * 8, 54 + Math.sin(q) * 2.2], [32 + Math.cos(q + 0.3) * 18, 54 + Math.sin(q + 0.3) * 4.8]]; });
      c.strokeStyle = '#1a0a20'; c.lineWidth = 0.6;
      for (const cr of PAINT.riftBase.cracks) { c.beginPath(); c.moveTo(...cr[0]); c.lineTo(...cr[1]); c.lineTo(...cr[2]); c.stroke(); }
    },
    crystalBase(c, rng) {
      c.fillStyle = rad(c, 32, 54, 26, [[0, 'rgba(60,40,80,0.7)'], [1, 'rgba(60,40,80,0)']]); ell(c, 32, 54, 26, 7); c.fill();
      const hue = ['#f2dcff', '#b080f0', '#3a1a70'];
      for (let i = 0; i < 6; i++) rock(c, 18 + i * 5.5 + rng() * 2, 54 + rng() * 2, 2 + rng() * 1.6, 1.2 + rng(), '#5a5068', rng);
      crystal(c, 22, 55, 7, 1.8, -0.4, hue); crystal(c, 43, 55, 8, 2, 0.35, hue); crystal(c, 33, 56, 5, 1.6, 0.1, hue);
    },
    // ---------- creatures (8 animation frames each) ----------
    brachio(c, rng, f) {
      const ph = (f / FRAMES) * TAU, leg = (k) => Math.sin(ph + k) * 2.2;
      const skin = ['#9aa070', '#5e6a3e', '#2e3420'];
      const legPair = (x, k, far) => {
        const s = leg(k);
        c.beginPath(); c.moveTo(x - 1.6, 40); c.lineTo(x - 1.4 + s * 0.4, 48); c.lineTo(x - 1.6 + s, 55.5); c.lineTo(x + 1.6 + s, 55.5); c.lineTo(x + 1.5 + s * 0.4, 48); c.lineTo(x + 1.8, 40); c.closePath();
        c.fillStyle = far ? '#3a4228' : lin(c, x - 2, 0, x + 2, 0, [[0, skin[0]], [1, skin[2]]]); c.fill();
      };
      legPair(22, Math.PI, true); legPair(40, 0, true);
      // tail
      c.beginPath(); c.moveTo(16, 36); c.quadraticCurveTo(6, 40, 1, 47); c.quadraticCurveTo(8, 43, 17, 42); c.closePath(); c.fillStyle = lin(c, 0, 36, 0, 47, [[0, skin[1]], [1, skin[2]]]); c.fill();
      // body
      ell(c, 30, 38, 14, 7.5); c.fillStyle = rad(c, 30, 38, 15, [[0, skin[0]], [0.6, skin[1]], [1, skin[2]]], 25, 33); c.fill();
      ell(c, 30, 38, 14, 7.5); texture(c, 0.3);
      c.save(); ell(c, 30, 38, 14, 7.5); c.clip(); c.strokeStyle = 'rgba(30,36,20,0.35)'; c.lineWidth = 0.8; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(20 + i * 4, 31); c.lineTo(18 + i * 4, 37); c.stroke(); } ell(c, 30, 42.5, 12, 3); c.fillStyle = 'rgba(210,200,160,0.35)'; c.fill(); c.restore();
      // the long neck sways a little as it walks
      const nx = 49 + Math.sin(ph) * 0.6;
      c.beginPath(); c.moveTo(38, 33); c.bezierCurveTo(44, 30, 47, 20, nx, 9); c.lineTo(nx + 3, 10); c.bezierCurveTo(50, 22, 48, 33, 42, 40); c.closePath();
      c.fillStyle = lin(c, 40, 0, 50, 0, [[0, skin[0]], [1, skin[2]]]); c.fill();
      ell(c, nx + 2.4, 8.5, 3.6, 1.8, 0.2); c.fillStyle = rad(c, nx + 2, 8, 4, [[0, skin[0]], [1, skin[2]]], nx + 1, 7); c.fill();
      c.fillStyle = '#111'; c.beginPath(); c.arc(nx + 3.4, 7.8, 0.4, 0, TAU); c.fill();
      legPair(24, 0, false); legPair(41, Math.PI, false);
      c.strokeStyle = 'rgba(255,250,220,0.35)'; c.lineWidth = 0.4; c.beginPath(); c.ellipse(30, 38, 14, 7.5, 0, Math.PI * 1.1, Math.PI * 1.6); c.stroke();
    },
    rex(c, rng, f) {
      const ph = (f / FRAMES) * TAU, s1 = Math.sin(ph) * 3, s2 = Math.sin(ph + Math.PI) * 3, bob = Math.abs(Math.cos(ph)) * 0.8;
      const skin = ['#a68a5a', '#6a5232', '#2e2214'];
      const legDraw = (s, far) => {
        c.beginPath(); c.moveTo(27, 38); c.quadraticCurveTo(25 + s * 0.3, 46, 29 + s * 0.6, 49); c.lineTo(27 + s, 55.5); c.lineTo(31.5 + s, 55.5); c.lineTo(32 + s * 0.6, 49); c.quadraticCurveTo(33, 44, 32, 38); c.closePath();
        c.fillStyle = far ? '#3e2e1a' : lin(c, 25, 0, 33, 0, [[0, skin[0]], [1, skin[2]]]); c.fill();
      };
      legDraw(s2, true);
      c.save(); c.translate(0, -bob);
      // tail and body
      c.beginPath(); c.moveTo(22, 30); c.quadraticCurveTo(10, 30, 2, 35); c.quadraticCurveTo(12, 37, 24, 39); c.closePath(); c.fillStyle = lin(c, 0, 30, 0, 39, [[0, skin[1]], [1, skin[2]]]); c.fill();
      ell(c, 29, 33, 9, 6.5, -0.25); c.fillStyle = rad(c, 29, 33, 10, [[0, skin[0]], [0.6, skin[1]], [1, skin[2]]], 26, 29); c.fill();
      ell(c, 29, 33, 9, 6.5, -0.25); texture(c, 0.3);
      // head with open jaw and teeth
      c.beginPath(); c.moveTo(34, 26); c.lineTo(46, 22); c.quadraticCurveTo(50, 22.5, 50, 25); c.lineTo(42, 28); c.lineTo(36, 30.5); c.closePath();
      c.fillStyle = lin(c, 34, 22, 50, 30, [[0, skin[0]], [1, skin[1]]]); c.fill();
      c.beginPath(); c.moveTo(37, 30); c.lineTo(48, 27.5); c.lineTo(47, 30); c.lineTo(38, 33); c.closePath(); c.fillStyle = skin[1]; c.fill();
      c.fillStyle = '#5a1810'; poly(c, [[40, 28.4], [48, 26], [47.2, 27.8], [40, 30]]); c.fill();
      c.fillStyle = '#f2ead6'; for (let i = 0; i < 5; i++) { poly(c, [[41 + i * 1.5, 27.9 - i * 0.4], [41.6 + i * 1.5, 29 - i * 0.4], [42.2 + i * 1.5, 27.7 - i * 0.4]]); c.fill(); }
      c.fillStyle = '#f0c040'; c.beginPath(); c.arc(44, 23.8, 0.6, 0, TAU); c.fill(); c.fillStyle = '#111'; c.fillRect(43.9, 23.3, 0.25, 1);
      c.strokeStyle = skin[2]; c.lineWidth = 0.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(34, 35); c.lineTo(37, 37.5); c.lineTo(38, 36.8); c.stroke();
      c.restore();
      legDraw(s1, false);
    },
    raptor(c, rng, f) {
      const ph = (f / FRAMES) * TAU, s1 = Math.sin(ph) * 4, s2 = Math.sin(ph + Math.PI) * 4, bob = Math.abs(Math.cos(ph)) * 1.2;
      const leg = (s, far) => { c.beginPath(); c.moveTo(29, 42); c.lineTo(27 + s * 0.4, 48); c.lineTo(30 + s, 55.5); c.lineTo(32 + s, 55.5); c.lineTo(29.5 + s * 0.4, 48); c.lineTo(31, 42); c.closePath(); c.fillStyle = far ? '#4a3018' : '#8a5a2a'; c.fill(); };
      leg(s2, true);
      c.save(); c.translate(0, -bob);
      c.beginPath(); c.moveTo(25, 38); c.quadraticCurveTo(12, 36, 4, 38); c.quadraticCurveTo(14, 41, 26, 43); c.closePath(); c.fillStyle = '#6a4220'; c.fill();
      ell(c, 30, 40, 6.5, 3.6, -0.15); c.fillStyle = rad(c, 30, 40, 7, [[0, '#c89058'], [0.6, '#8a5a2a'], [1, '#3a2410']], 28, 37); c.fill();
      c.strokeStyle = 'rgba(40,20,8,0.6)'; c.lineWidth = 0.5; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(26 + i * 2.2, 37); c.lineTo(25.5 + i * 2.2, 40); c.stroke(); }
      c.beginPath(); c.moveTo(34, 38); c.quadraticCurveTo(37, 33, 40, 32); c.lineTo(46, 32.5); c.lineTo(45, 34.5); c.lineTo(39, 35.5); c.quadraticCurveTo(37, 37, 36, 40); c.closePath(); c.fillStyle = '#a06a34'; c.fill();
      c.fillStyle = '#c0302a'; poly(c, [[38, 32], [40, 29], [41, 32]]); c.fill(); poly(c, [[36.5, 33], [37.5, 30], [39, 32.5]]); c.fill();
      c.fillStyle = '#f0d040'; c.beginPath(); c.arc(42, 33, 0.45, 0, TAU); c.fill();
      c.strokeStyle = '#5a3418'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(33, 41); c.lineTo(35, 43.5); c.stroke();
      c.restore();
      leg(s1, false);
    },
    ptero(c, rng, f) {
      const flap = Math.sin((f / FRAMES) * TAU), wy = flap * 9;
      const wing = (dir) => {
        c.beginPath(); c.moveTo(32, 32); c.quadraticCurveTo(32 + dir * 10, 26 + wy * 0.5, 32 + dir * 22, 30 + wy); c.quadraticCurveTo(32 + dir * 14, 33 + wy * 0.3, 32 + dir * 4, 35); c.closePath();
        c.fillStyle = lin(c, 32, 26, 32 + dir * 22, 34, [[0, '#8a5a3a'], [1, 'rgba(160,110,80,0.85)']]); c.fill();
        c.strokeStyle = '#3a2214'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(32, 32); c.quadraticCurveTo(32 + dir * 10, 26 + wy * 0.5, 32 + dir * 22, 30 + wy); c.stroke();
      };
      wing(-1); wing(1);
      ell(c, 32, 33, 2.4, 4.2); c.fillStyle = '#5a3a24'; c.fill();
      poly(c, [[31, 29.5], [32, 23], [33, 29.5]]); c.fillStyle = '#c0502a'; c.fill();
      poly(c, [[31.2, 30], [32, 37], [32.8, 30]]); c.fillStyle = '#d8b080'; c.fill();
    },
    dragon(c, rng, f) {
      const flap = Math.sin((f / FRAMES) * TAU);
      // a bat wing: arm to the wrist, three finger bones fanning out, scalloped membrane between them
      const wing = (far) => {
        const k = far ? 0.8 : 1, sx = 30, sy = 32, lift = flap * 11 * k;
        const wrist = [sx - 2 * k, sy - 9 * k - lift * 0.7];
        const tips = [[sx - 16 * k, sy - 15 * k - lift], [sx - 20 * k, sy - 6 * k - lift * 0.6], [sx - 17 * k, sy + 2 - lift * 0.25]];
        c.beginPath(); c.moveTo(sx + 3, sy); c.lineTo(...wrist); c.lineTo(...tips[0]);
        c.quadraticCurveTo((tips[0][0] + tips[1][0]) / 2 + 3 * k, (tips[0][1] + tips[1][1]) / 2 + 1, ...tips[1]);
        c.quadraticCurveTo((tips[1][0] + tips[2][0]) / 2 + 3 * k, (tips[1][1] + tips[2][1]) / 2, ...tips[2]);
        c.quadraticCurveTo(sx - 8 * k, sy + 1, sx - 2, sy + 3);
        c.closePath();
        c.fillStyle = far ? 'rgba(80,16,16,0.92)' : lin(c, sx - 20, sy - 16, sx, sy + 3, [[0, 'rgba(235,110,70,0.95)'], [0.5, 'rgba(170,40,30,0.95)'], [1, 'rgba(90,14,12,0.98)']]);
        c.fill();
        c.strokeStyle = far ? '#2e0606' : '#4a0a08'; c.lineCap = 'round';
        c.lineWidth = 0.9; c.beginPath(); c.moveTo(sx + 2, sy); c.lineTo(...wrist); c.stroke();
        c.lineWidth = 0.5; for (const tp of tips) { c.beginPath(); c.moveTo(...wrist); c.lineTo(...tp); c.stroke(); }
        if (!far) { c.fillStyle = '#e8d8b8'; c.beginPath(); c.moveTo(...wrist); c.lineTo(wrist[0] - 0.6, wrist[1] - 1.6); c.lineTo(wrist[0] + 0.6, wrist[1] - 0.4); c.fill(); }
      };
      wing(true);
      // tail with a spade tip
      c.beginPath(); c.moveTo(24, 34); c.bezierCurveTo(16, 36, 12, 30, 5, 32); c.lineTo(5, 33.6); c.bezierCurveTo(12, 33, 16, 39, 25, 37.6); c.closePath();
      c.fillStyle = lin(c, 0, 30, 0, 38, [[0, '#a8301e'], [1, '#4a0c0a']]); c.fill();
      poly(c, [[6, 32.2], [1, 30], [2.4, 33], [1, 36], [6, 33.6]]); c.fillStyle = '#6a1410'; c.fill();
      // body with a pale belly and back spines
      ell(c, 30, 35, 8.5, 3.9, -0.08); c.fillStyle = rad(c, 30, 35, 9, [[0, '#e8663e'], [0.55, '#a8281e'], [1, '#420a08']], 27, 32); c.fill();
      c.save(); ell(c, 30, 35, 8.5, 3.9, -0.08); c.clip(); c.fillStyle = 'rgba(245,200,130,0.6)'; ell(c, 30, 38.6, 7.5, 1.7); c.fill(); c.restore();
      c.fillStyle = '#5a0e0a'; for (let i = 0; i < 5; i++) { poly(c, [[24 + i * 3, 31.6 - i * 0.1], [25.2 + i * 3, 29.4 - i * 0.1], [26.4 + i * 3, 31.4 - i * 0.1]]); c.fill(); }
      // neck and horned head
      c.beginPath(); c.moveTo(36, 33); c.quadraticCurveTo(40, 27.5, 44.5, 27.5); c.lineTo(45.5, 30.5); c.quadraticCurveTo(41.5, 31.5, 37.5, 37); c.closePath(); c.fillStyle = lin(c, 36, 27, 45, 37, [[0, '#d24a30'], [1, '#6a1410']]); c.fill();
      c.beginPath(); c.moveTo(43.5, 26.6); c.lineTo(49, 27.6); c.quadraticCurveTo(51.5, 28.4, 51, 29.6); c.lineTo(45, 31.6); c.closePath(); c.fillStyle = lin(c, 43, 26, 51, 31, [[0, '#ee6a44'], [1, '#701410']]); c.fill();
      c.strokeStyle = '#3a0806'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(46, 30.6); c.lineTo(50.6, 29.4); c.stroke();
      c.fillStyle = '#e6d6b4'; poly(c, [[44, 27], [40.6, 23.6], [45, 26.6]]); c.fill(); poly(c, [[45.4, 27.2], [43.6, 23], [46.4, 27.2]]); c.fill();
      c.fillStyle = '#ffd040'; ell(c, 47, 28.3, 0.7, 0.45); c.fill(); c.fillStyle = '#1a0806'; c.fillRect(46.9, 27.9, 0.2, 0.8);
      // legs tucked under
      c.strokeStyle = '#5a0e0a'; c.lineWidth = 0.9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(27, 38); c.quadraticCurveTo(26, 40.5, 24.5, 41); c.moveTo(33, 38); c.quadraticCurveTo(33.5, 40.5, 32, 41.4); c.stroke();
      wing(false);
    },
  };

  // Paints a sprite once (and its night silhouette) and keeps it.
  function get(kind, frame = 0) {
    const key = kind + ':' + frame;
    let s = cache.get(key);
    if (s) return s;
    const img = document.createElement('canvas'); img.width = img.height = SP;
    const c = img.getContext('2d'); c.scale(K, K);
    PAINT[kind](c, mulberry32(kind.length * 977 + 13), frame);
    const dark = document.createElement('canvas'); dark.width = dark.height = SP;
    const d = dark.getContext('2d');
    d.drawImage(img, 0, 0); d.globalCompositeOperation = 'source-in'; d.fillStyle = '#04060e'; d.fillRect(0, 0, SP, SP);
    s = { img, dark };
    cache.set(key, s);
    return s;
  }
  // stamp a sprite at the origin, darkened for the planet's night side
  function stamp(c, kind, frame, light, x = 0, y = 0, sc = 1, flip = false) {
    const s = get(kind, frame);
    c.save(); c.translate(x, y); c.scale(flip ? -sc : sc, sc); c.translate(-AX, -AY);
    c.drawImage(s.img, 0, 0, 64, 64);
    if (light < 0.98) { c.globalAlpha *= (1 - light) * 0.82; c.drawImage(s.dark, 0, 0, 64, 64); }
    c.restore();
  }
  const frameAt = (t, fps) => Math.floor(t * fps) % FRAMES;

  // ---------- each wonder: static sprite plus its animation ----------
  // Drawn with the ground point at (0, 0) and one unit per design unit.
  const DRAW = {
    volcano(c, t, L) {
      stamp(c, 'volcano', 0, L);
      c.save(); c.translate(-AX, -AY); c.globalCompositeOperation = 'lighter';
      const pulse = 0.75 + Math.sin(t * 2.2) * 0.2;
      for (const p of LAVA) {
        trace(c, p); c.strokeStyle = `rgba(255,90,20,${0.75 * pulse})`; c.lineWidth = 1.5; c.stroke();
        c.setLineDash([2, 3]); c.lineDashOffset = -t * 6; trace(c, p); c.strokeStyle = `rgba(255,220,120,${0.85 * pulse})`; c.lineWidth = 0.55; c.stroke(); c.setLineDash([]);
      }
      glow(c, 32, 20, 11, '255,120,40', 0.8 * pulse);
      glow(c, 32, 50, 22, '255,90,30', 0.22);
      c.globalCompositeOperation = 'source-over';
      smoke(c, 33, 17, t, 9, 3.4, 40, [70, 64, 60], 12);
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const k = (t * 0.7 + i / 6) % 1, dir = (i % 2 ? 1 : -1) * (0.6 + (i % 3) * 0.5);
        c.fillStyle = `rgba(255,${170 + i * 10},70,${1 - k})`;
        c.beginPath(); c.arc(32 + dir * k * 12, 20 - Math.sin(k * Math.PI) * 14 + k * 6, 0.7, 0, TAU); c.fill();
      }
      c.restore();
    },
    fire(c, t, L) {
      stamp(c, 'fire', 0, L);
      c.save(); c.translate(-AX, -AY);
      smoke(c, 32, 30, t, 7, 4, 30, [50, 46, 44], 10);
      c.globalCompositeOperation = 'lighter';
      glow(c, 32, 46, 26, '255,120,40', 0.45);
      const spots = [[14, 54, 9], [17, 40, 6], [24, 55, 12], [24, 34, 7], [36, 54, 11], [37, 38, 6], [47, 55, 9], [46, 42, 5], [55, 53, 7], [30, 56, 6], [42, 56, 6]];
      spots.forEach(([x, y, h], i) => flame(c, x, y, h, t, i * 1.9));
      sparks(c, 32, 40, t, 14, 22, 30);
      c.restore();
    },
    dinos(c, t, L) {
      const walk = (t * 0.05) % 2, dir = walk < 1 ? 1 : -1, off = (walk < 1 ? walk : 2 - walk) * 16 - 8;
      c.save(); c.translate(-AX, -AY);
      contact(c, 32 + off * 0.6, 56, 20, 2.4, 0.5);
      c.restore();
      stamp(c, 'brachio', frameAt(t, 6), L, -10 + off * 0.5, 0, 0.72, dir < 0);
      stamp(c, 'rex', frameAt(t + 0.3, 8), L, 16 + off * 0.5, 2, 0.55, dir < 0);
    },
    raptors(c, t, L) {
      c.save(); c.translate(-AX, -AY); contact(c, 32, 56, 22, 2.2, 0.45); c.restore();
      [[-14, 0.58, 0], [0, 0.64, 0.4], [14, 0.56, 0.8]].forEach(([dx, sc, ph], i) => {
        const run = Math.sin(t * 0.8 + i) * 6;
        stamp(c, 'raptor', frameAt(t + ph, 14), L, dx + run, i % 2 ? 1 : 0, sc, Math.cos(t * 0.8 + i) < 0);
      });
    },
    pteros(c, t, L) {
      stamp(c, 'cliff', 0, L);
      for (let i = 0; i < 3; i++) {
        const q = t * 0.7 + i * 2.1, x = Math.cos(q) * 22, y = -14 + Math.sin(q) * 5 - i * 3;
        stamp(c, 'ptero', frameAt(t + i * 0.3, 10), Math.max(0.5, L), x, y, 0.5, Math.sin(q) > 0);
      }
    },
    crater(c, t, L) {
      stamp(c, 'crater', 0, L);
      c.save(); c.translate(-AX, -AY); c.globalCompositeOperation = 'lighter';
      const p = 0.7 + Math.sin(t * 2) * 0.25;
      glow(c, 32, 46, 22, '110,255,120', 0.55 * p);
      for (let i = 0; i < 5; i++) { const q = -Math.PI / 2 + (i - 2) * 0.28 + Math.sin(t * 0.5 + i) * 0.05; c.strokeStyle = `rgba(150,255,160,${0.12 * p})`; c.lineWidth = 2.4; c.beginPath(); c.moveTo(32, 42); c.lineTo(32 + Math.cos(q) * 30, 42 + Math.sin(q) * 30); c.stroke(); }
      sparks(c, 32, 46, t, 10, 9, 20, '170,255,170');
      c.restore();
    },
    crystals(c, t, L) {
      stamp(c, 'crystalBase', 0, L);
      c.save(); c.translate(-AX, -AY);
      const hue = ['#fbefff', '#b680ff', '#3e1878'];
      c.globalCompositeOperation = 'lighter'; glow(c, 32, 30, 24, '190,120,255', 0.35); c.globalCompositeOperation = 'source-over';
      [[22, 34, 14, 3, -0.15, 0], [32, 26, 22, 4.4, 0.05, 1.3], [43, 33, 13, 2.8, 0.2, 2.6]].forEach(([x, y, h, w, tl, ph]) => {
        const by = y - Math.sin(t * 1.4 + ph) * 2;
        contact(c, x, 54, w * 2, 0.8, 0.3);
        crystal(c, x, by, h, w, tl + Math.sin(t * 0.7 + ph) * 0.04, hue);
        c.save(); c.translate(x, by); c.rotate(tl); c.scale(1, -0.45); crystal(c, 0, 0, h * 0.55, w, 0, hue); c.restore();
      });
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) { const q = t * 0.9 + i * 0.7; c.fillStyle = `rgba(235,210,255,${0.5 + Math.sin(t * 4 + i) * 0.4})`; c.beginPath(); c.arc(32 + Math.cos(q) * 17, 30 + Math.sin(q) * 6, 0.5, 0, TAU); c.fill(); }
      c.restore();
    },
    rift(c, t, L) {
      stamp(c, 'riftBase', 0, L);
      c.save(); c.translate(-AX, -AY);
      const cx = 32, cy = 26;
      c.globalCompositeOperation = 'lighter';
      glow(c, cx, cy, 28, '220,80,255', 0.5);
      for (const cr of PAINT.riftBase.cracks || []) { c.strokeStyle = `rgba(230,120,255,${0.5 + Math.sin(t * 3) * 0.3})`; c.lineWidth = 0.6; c.beginPath(); c.moveTo(...cr[0]); c.lineTo(...cr[1]); c.lineTo(...cr[2]); c.stroke(); }
      c.globalCompositeOperation = 'source-over';
      // the void, full of distant stars
      c.save(); ell(c, cx, cy, 6.5, 13); c.fillStyle = rad(c, cx, cy, 13, [[0, '#000'], [0.7, '#14002a'], [1, '#4a0a6a']]); c.fill(); c.clip();
      for (let i = 0; i < 14; i++) { c.fillStyle = `rgba(255,255,255,${0.4 + Math.sin(t * 3 + i) * 0.4})`; c.fillRect(cx - 5 + ((i * 37) % 10), cy - 11 + ((i * 53) % 22), 0.35, 0.35); }
      c.restore();
      // swirling arms of light
      c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const a0 = t * (1.3 + i * 0.15) + i * 0.9, rx = 7.5 + i * 1.3, ry = 14 + i * 1.6;
        c.strokeStyle = i % 2 ? `rgba(120,230,255,${0.55 - i * 0.05})` : `rgba(245,120,255,${0.7 - i * 0.06})`; c.lineWidth = 1.2 - i * 0.1;
        c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, a0, a0 + 2.4); c.stroke();
      }
      if (Math.sin(t * 2.7) > 0.85) { c.strokeStyle = 'rgba(255,220,255,0.9)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(cx, cy - 13); c.lineTo(cx + 5, cy - 20); c.lineTo(cx + 2, cy - 24); c.lineTo(cx + 8, cy - 30); c.stroke(); }
      c.restore();
      // debris orbiting the tear
      const rng = mulberry32(7);
      for (let i = 0; i < 5; i++) {
        const q = t * 0.6 + i * 1.26, x = cx + Math.cos(q) * 15 - AX, y = cy + Math.sin(q) * 5 - 6 - AY - Math.sin(t + i) * 2;
        c.save(); c.translate(x, y); c.rotate(t + i); rock(c, 0, 0, 1.4, 1, '#5a4a68', rng); c.restore();
      }
    },
    stones(c, t, L) {
      stamp(c, 'stones', 0, L);
      c.save(); c.translate(-AX, -AY); c.globalCompositeOperation = 'lighter';
      const p = 0.5 + Math.sin(t * 1.6) * 0.5;
      glow(c, 32, 50, 16, '120,230,255', 0.3 + p * 0.3);
      c.fillStyle = lin(c, 0, 0, 0, 52, [[0, 'rgba(140,230,255,0)'], [1, `rgba(140,230,255,${0.25 + p * 0.25})`]]); c.fillRect(30, 0, 4, 52);
      for (const [rx, ry] of PAINT.stones.runes || []) glow(c, rx, ry, 2.4, '130,230,255', 0.5 + p * 0.5);
      for (let i = 0; i < 6; i++) { const k = (t * 0.25 + i / 6) % 1; c.strokeStyle = `rgba(160,235,255,${(1 - k) * 0.8})`; c.lineWidth = 0.35; const x = 32 + Math.sin(i * 2.1) * 4, y = 46 - k * 30; c.beginPath(); c.moveTo(x - 1, y); c.lineTo(x + 1, y - 1); c.lineTo(x, y + 1); c.stroke(); }
      c.restore();
    },
    kraken(c, t, L) {
      c.save(); c.translate(-AX, -AY);
      // dark water churning in rings
      ell(c, 32, 55, 24, 5); c.fillStyle = rad(c, 32, 55, 24, [[0, 'rgba(10,20,40,0.85)'], [1, 'rgba(10,20,40,0)']]); c.fill();
      for (let i = 0; i < 3; i++) { const k = (t * 0.35 + i / 3) % 1; c.strokeStyle = `rgba(210,235,255,${0.55 * (1 - k)})`; c.lineWidth = 0.45; ell(c, 32, 55, 6 + k * 20, 1.4 + k * 4.6); c.stroke(); }
      // the head breaks the surface now and then
      const surf = Math.max(0, Math.sin(t * 0.4)) * 6;
      if (surf > 0.5) {
        c.save(); c.beginPath(); c.rect(0, 0, 64, 55); c.clip();
        ell(c, 32, 55, 8, surf + 2); c.fillStyle = rad(c, 32, 55 - surf, 9, [[0, '#a84a6a'], [0.6, '#6a1e3e'], [1, '#2a0818']], 29, 52 - surf); c.fill();
        c.fillStyle = '#ffd040'; ell(c, 29, 55 - surf * 0.6, 1.4, 0.8); c.fill(); ell(c, 35, 55 - surf * 0.6, 1.4, 0.8); c.fill();
        c.fillStyle = '#111'; c.fillRect(28.85, 54.4 - surf * 0.6, 0.3, 1.2); c.fillRect(34.85, 54.4 - surf * 0.6, 0.3, 1.2);
        c.restore();
      }
      // shaded tentacles built from overlapping discs, suckers on the inside
      const shadeL = (1 + L) * 0.5;
      for (let i = 0; i < 5; i++) {
        const bx = 32 + (i - 2) * 7.5, h = 22 + Math.sin(t * 1.5 + i * 1.3) * 7 - Math.abs(i - 2) * 3, curl = Math.sin(t * 1.1 + i) * 8 + (i - 2) * 2;
        const pts = [];
        for (let k = 0; k <= 22; k++) { const u = k / 22; pts.push([bx + curl * u * u + Math.sin(u * 5 + t * 2 + i) * 1.2 * u, 56 - h * u + Math.max(0, u - 0.8) * h * 1.2 * Math.sin(t + i)]); }
        for (let k = 0; k < pts.length; k++) {
          const [x, y] = pts[k], r = 2.6 * (1 - k / pts.length * 0.85);
          c.fillStyle = rad(c, x, y, r, [[0, shade('#b85a7a', 0.15 * shadeL)], [0.7, '#7a2448'], [1, '#2e0a1c']], x - r * 0.4, y - r * 0.4);
          c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
          if (k % 2 === 0 && k < pts.length - 3) { c.fillStyle = 'rgba(240,200,210,0.85)'; c.beginPath(); c.arc(x + r * 0.5, y, r * 0.28, 0, TAU); c.fill(); }
        }
        c.fillStyle = 'rgba(230,245,255,0.7)'; ell(c, bx, 55.5, 3.2, 0.8); c.fill();
      }
      c.restore();
    },
    ship(c, t, L) {
      const bob = Math.sin(t * 1.6) * 0.8, roll = Math.sin(t * 1.1) * 0.04;
      c.save(); c.translate(-AX, -AY); c.globalCompositeOperation = 'lighter'; glow(c, 32, 38, 28, '120,255,200', 0.2 + Math.sin(t * 1.3) * 0.06); c.restore();
      c.save(); c.globalAlpha *= 0.72 + Math.sin(t * 1.3) * 0.18; c.rotate(roll); stamp(c, 'ship', 0, Math.max(0.7, L), 0, bob); c.restore();
      c.save(); c.translate(-AX, -AY + bob); c.globalCompositeOperation = 'lighter';
      for (const [x, y] of [[10, 41], [52, 41], [32, 12]]) glow(c, x, y, 3.5, '160,255,210', 0.6 + Math.sin(t * 5 + x) * 0.3);
      c.restore();
      c.save(); c.translate(-AX, -AY); smoke(c, 32, 58, t, 6, 5, 6, [150, 210, 190], 18); c.restore();
    },
    tree(c, t, L) {
      c.save(); c.translate(-AX, -AY); c.globalCompositeOperation = 'lighter'; glow(c, 32, 18, 30, '255,220,120', 0.3 + Math.sin(t * 1.2) * 0.08); c.restore();
      stamp(c, 'tree', 0, Math.max(L, 0.55));
      c.save(); c.translate(-AX, -AY); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 12; i++) {
        const k = (t * 0.12 + i / 12) % 1, x = 32 + Math.sin(i * 2.4 + t * 0.6) * 18 * (0.5 + k * 0.5), y = 20 + k * 36;
        c.fillStyle = `rgba(255,235,150,${(1 - k) * 0.9})`; c.beginPath(); c.ellipse(x, y, 0.7, 0.4, t * 2 + i, 0, TAU); c.fill();
      }
      c.restore();
    },
    island(c, t, L) {
      const hov = Math.sin(t * 1.1) * 1.6;
      c.save(); c.translate(-AX, -AY); contact(c, 32, 56, 14, 2.4, 0.4); c.restore();
      stamp(c, 'island', 0, L, 0, -18 + hov, 0.72);
      // waterfall spilling from the edge, breaking into mist
      c.save(); c.translate(-AX, -AY);
      const fx = 32 + 14 * 0.72, top = 56 - 18 + hov - (56 - 30) * 0.72, bot = 54;
      c.fillStyle = lin(c, 0, top, 0, bot, [[0, 'rgba(200,235,255,0.85)'], [1, 'rgba(200,235,255,0.15)']]); c.fillRect(fx - 0.6, top, 1.2, bot - top);
      c.setLineDash([1.5, 2.5]); c.lineDashOffset = -t * 20; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(fx, top); c.lineTo(fx, bot); c.stroke(); c.setLineDash([]);
      smoke(c, fx, 55, t, 5, 2.2, 5, [200, 220, 235], 3);
      c.globalCompositeOperation = 'lighter'; glow(c, 32 - 6 * 0.72, top - 4, 5, '255,210,130', 0.4);
      c.restore();
    },
    dragon(c, t, L) {
      stamp(c, 'mountain', 0, L);
      c.save(); c.translate(-AX, -AY); c.globalCompositeOperation = 'lighter';
      for (const p of PAINT.mountain.cracks || []) { trace(c, p); c.strokeStyle = `rgba(255,90,30,${0.55 + Math.sin(t * 2) * 0.2})`; c.lineWidth = 0.8; c.stroke(); }
      c.restore();
      const q = t * 0.55, dx = Math.cos(q) * 26, dy = -34 + Math.sin(q) * 7, face = -Math.sin(q) >= 0;
      stamp(c, 'dragon', frameAt(t, 9), Math.max(L, 0.45), dx, dy + 18, 0.95, !face);
      if (Math.sin(t * 0.8) > 0.5) {
        c.save(); c.translate(dx + (face ? 18 : -18), dy + 4); c.scale(face ? 1 : -1, 1); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) { const k = (t * 2.4 + i / 12) % 1; c.fillStyle = `rgba(255,${210 - k * 150},${80 - k * 60},${(1 - k) * 0.9})`; c.beginPath(); c.arc(k * 20, k * 9 + Math.sin(i) * k * 3, 0.8 + k * 2.6, 0, TAU); c.fill(); }
        c.restore();
      }
    },
    temple(c, t, L) {
      const p = 0.6 + Math.sin(t * 1.8) * 0.25;
      c.save(); c.translate(-AX, -AY); c.globalCompositeOperation = 'lighter';
      c.fillStyle = lin(c, 0, -60, 0, 20, [[0, 'rgba(255,235,170,0)'], [1, `rgba(255,235,170,${0.5 * p})`]]);
      poly(c, [[30.5, 20], [33.5, 20], [36, -60], [28, -60]]); c.fill();
      c.restore();
      stamp(c, 'temple', 0, L);
      c.save(); c.translate(-AX, -AY); c.globalCompositeOperation = 'lighter';
      glow(c, 32, 21, 6, '255,240,170', p);
      for (let i = 0; i < 6; i++) { const k = (t * 0.3 + i / 6) % 1; c.fillStyle = `rgba(255,240,190,${1 - k})`; c.beginPath(); c.arc(32 + Math.sin(i * 3 + t) * 2, 20 - k * 40, 0.4, 0, TAU); c.fill(); }
      c.restore();
    },
    ufo(c, t, L) {
      const hov = Math.sin(t * 1.6) * 1.4;
      c.save(); c.translate(-AX, -AY);
      contact(c, 32, 56, 12, 2, 0.35);
      c.globalCompositeOperation = 'lighter';
      const beam = 0.3 + Math.sin(t * 4) * 0.06;
      c.fillStyle = lin(c, 0, 24, 0, 56, [[0, `rgba(170,255,210,${beam})`], [1, `rgba(170,255,210,${beam * 0.4})`]]);
      poly(c, [[27, 23 + hov - 14], [37, 23 + hov - 14], [44, 56], [20, 56]]); c.fill();
      for (let i = 0; i < 6; i++) { const k = (t * 0.5 + i / 6) % 1; c.fillStyle = `rgba(210,255,230,${0.8 * (1 - k)})`; c.beginPath(); c.arc(32 + Math.sin(i * 2 + t) * 5 * (1 - k), 54 - k * 26, 0.4, 0, TAU); c.fill(); }
      c.globalCompositeOperation = 'source-over';
      // the cow being lifted
      const cy = 54 - ((t * 0.12) % 1) * 22;
      c.save(); c.translate(32, cy); c.rotate(Math.sin(t * 2) * 0.3);
      ell(c, 0, 0, 3, 1.8); c.fillStyle = '#f2eee6'; c.fill(); c.fillStyle = '#2a2622'; ell(c, -1, -0.4, 1, 0.7); c.fill(); ell(c, 1.4, 0.5, 0.7, 0.5); c.fill();
      ell(c, 3.2, -0.8, 1, 0.8); c.fillStyle = '#e8e2d8'; c.fill(); c.strokeStyle = '#2a2622'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-1.8, 1.5); c.lineTo(-1.9, 3); c.moveTo(1.6, 1.5); c.lineTo(1.7, 3); c.stroke();
      c.restore();
      c.restore();
      stamp(c, 'ufo', 0, Math.max(L, 0.7), 0, -14 + hov);
      c.save(); c.translate(-AX, -AY + hov - 14); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) { const on = Math.sin(t * 6 + i * 0.9) > 0; glow(c, 32 + (i - 3) * 4.6, 21.8, 1.6, on ? '255,220,110' : '255,90,80', on ? 0.9 : 0.5); }
      c.restore();
    },
    well(c, t, L) {
      stamp(c, 'well', 0, L);
      c.save(); c.translate(-AX, -AY);
      ell(c, 32, 49, 11.5, 3.4); c.fillStyle = rad(c, 32, 49, 12, [[0, 'rgba(240,250,255,0.95)'], [0.5, 'rgba(120,190,255,0.9)'], [1, 'rgba(40,90,190,0.9)']]); c.fill();
      c.save(); ell(c, 32, 49, 11.5, 3.4); c.clip();
      for (let i = 0; i < 3; i++) { const k = (t * 0.4 + i / 3) % 1; c.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`; c.lineWidth = 0.3; ell(c, 32, 49, 2 + k * 10, 0.6 + k * 3); c.stroke(); }
      c.restore();
      c.globalCompositeOperation = 'lighter';
      glow(c, 32, 49, 18, '140,200,255', 0.45 + Math.sin(t * 1.4) * 0.12);
      c.fillStyle = lin(c, 0, 10, 0, 49, [[0, 'rgba(160,210,255,0)'], [1, 'rgba(160,210,255,0.22)']]); c.fillRect(24, 10, 16, 39);
      sparks(c, 32, 48, t, 10, 8, 30, '200,230,255');
      c.restore();
    },
    zero(c, t, L) {
      stamp(c, 'zero', 0, L);
      c.save(); c.translate(-AX, -AY);
      smoke(c, 46, 28, t, 6, 2.8, 22, [90, 150, 70], 8);
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) glow(c, 13.5 + i * 3.8, 48.2, 2.6, '140,255,100', 0.5 + Math.sin(t * 9 + i * 2) * 0.3);
      for (let i = 0; i < 3; i++) glow(c, 39 + i * 3.8, 50.5, 2.2, '140,255,100', 0.5 + Math.sin(t * 7 + i) * 0.3);
      const beacon = Math.sin(t * 5) > 0;
      glow(c, 46, 27.5, beacon ? 5 : 2, '255,60,50', beacon ? 0.9 : 0.3);
      glow(c, 30, 52, 26, '120,255,90', 0.22);
      c.globalCompositeOperation = 'source-over';
      smoke(c, 20, 56, t, 8, 5, 10, [100, 160, 80], 20);
      c.restore();
    },
  };

  return {
    // which painted sprite to warm up for each wonder kind
    prewarm() {
      const jobs = ['volcano', 'fire', 'crater', 'stones', 'tree', 'island', 'mountain', 'temple', 'ufo', 'well', 'zero', 'ship', 'cliff', 'riftBase', 'crystalBase'];
      for (const k of ['brachio', 'rex', 'raptor', 'ptero', 'dragon']) for (let f = 0; f < FRAMES; f++) jobs.push(k + ':' + f);
      let i = 0;
      const step = () => {
        const end = Math.min(jobs.length, i + 3);
        for (; i < end; i++) { const [k, f] = jobs[i].split(':'); get(k, +(f || 0)); }
        if (i < jobs.length) setTimeout(step, 0);
      };
      setTimeout(step, 0);
    },
    // draw a wonder with its ground point at (0, 0); size is the on-screen width of the 64-unit box
    draw(c, kind, size, t, light) {
      const fn = DRAW[kind];
      if (!fn) return;
      c.save(); c.scale(size / 64, size / 64);
      fn(c, t, clamp(light, 0, 1));
      c.restore();
    },
  };
})();
