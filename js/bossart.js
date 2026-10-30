'use strict';
// ============================================================
// The wonder expedition bosses, painted the way they were drawn for the design review: seen
// from above, facing +x, lit from the top left. r is the boss's body radius. The zombie sprite
// painter calls these once per animation frame; t runs once round the circle per walk cycle, and
// glows are kept inside the sprite box (lim) so they never end in a hard edge.
// ============================================================
const WONDER_ART = (() => {
let LIM = 1e9;
const TAU = Math.PI * 2;
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rgb = (h) => (h[0] === '#' ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : h.match(/[\d.]+/g).slice(0, 3).map(Number));
const shade = (h, k) => { const a = rgb(h), t = k > 0 ? 255 : 0, m = Math.abs(k); return `rgb(${a.map((v) => Math.round(v + (t - v) * m)).join(',')})`; };
const rg = (c, x, y, r, a, b, ox = -0.35, oy = -0.35) => { const g = c.createRadialGradient(x + ox * r, y + oy * r, r * 0.05, x, y, r); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
const lg = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([k, v]) => g.addColorStop(k, v)); return g; };
function blob(c, x, y, r, rng, n = 10, jag = 0.3, sy = 1) {
  c.beginPath();
  for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, rr = r * (1 - jag / 2 + rng() * jag); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * sy; i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.closePath();
}
function ell(c, x, y, rx, ry, a = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), a, 0, TAU); }
function glow(c, x, y, r, col, a) { r = Math.min(r, Math.max(r * 0.35, LIM - Math.hypot(x, y))); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = rg(c, x, y, r, `rgba(${col},${a})`, `rgba(${col},0)`, 0, 0); c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); }
function limb(c, x1, y1, x2, y2, w1, w2, col, outline = true) {
  const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a), ny = Math.cos(a);
  c.beginPath(); c.moveTo(x1 + nx * w1, y1 + ny * w1); c.lineTo(x2 + nx * w2, y2 + ny * w2); c.arc(x2, y2, w2, a + Math.PI / 2, a - Math.PI / 2, true); c.lineTo(x1 - nx * w1, y1 - ny * w1); c.arc(x1, y1, w1, a - Math.PI / 2, a + Math.PI / 2, true); c.closePath();
  c.fillStyle = lg(c, x1 + nx * w1, y1 + ny * w1, x1 - nx * w1, y1 - ny * w1, [[0, shade(col, 0.25)], [0.5, col], [1, shade(col, -0.45)]]); c.fill();
  if (outline) { c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = Math.max(0.6, w2 * 0.15); c.stroke(); }
}
function claw(c, x, y, a, s, col = '#e8e0c8') { for (const k of [-1, 0, 1]) { const b = a + k * 0.35; c.beginPath(); c.moveTo(x + Math.cos(b + 1.4) * s * 0.2, y + Math.sin(b + 1.4) * s * 0.2); c.quadraticCurveTo(x + Math.cos(b) * s * 0.8, y + Math.sin(b) * s * 0.8, x + Math.cos(b + 0.25) * s * 1.1, y + Math.sin(b + 0.25) * s * 1.1); c.lineTo(x + Math.cos(b - 1.4) * s * 0.2, y + Math.sin(b - 1.4) * s * 0.2); c.fillStyle = col; c.fill(); } }
function eyes(c, x, y, sep, r, col) { for (const s of [-1, 1]) { glow(c, x, y + s * sep, r * 4, col, 0.6); ell(c, x, y + s * sep, r, r * 0.8); c.fillStyle = '#fff8e0'; c.fill(); } }
const B = {};
// 1 · Mount Cinder: the Cinder King, a giant of cooling basalt plates over molten rock
B.cinder = (c, r, t) => {
  const rng = mulberry32(11);
  glow(c, 0, 0, r * 2.2, '255,110,30', 0.35);
  for (const s of [-1, 1]) { limb(c, -r * 0.1, s * r * 0.75, r * 0.6, s * r * 1.05, r * 0.32, r * 0.28, '#3a2a24'); limb(c, r * 0.6, s * r * 1.05, r * 1.25, s * r * 0.7, r * 0.28, r * 0.34, '#2e2220'); blob(c, r * 1.3, s * r * 0.68, r * 0.36, rng, 9, 0.35); c.fillStyle = '#2a1e1c'; c.fill(); glow(c, r * 1.35, s * r * 0.68, r * 0.4, '255,140,40', 0.5); }
  blob(c, 0, 0, r * 1.05, rng, 14, 0.18, 0.95); c.fillStyle = '#ff6a1a'; c.fill();
  // plates of basalt with glowing cracks between them
  for (let i = 0; i < 16; i++) { const a = rng() * TAU, d = rng() * r * 0.8, pr = r * (0.18 + rng() * 0.16); blob(c, Math.cos(a) * d, Math.sin(a) * d, pr, rng, 6, 0.4); c.fillStyle = rg(c, Math.cos(a) * d, Math.sin(a) * d, pr, '#5a4a44', '#1c1412'); c.fill(); }
  glow(c, 0, 0, r * 0.6, '255,200,80', 0.4);
  // the head: a crown of obsidian spikes around a lava face
  ell(c, r * 0.75, 0, r * 0.38, r * 0.34); c.fillStyle = '#241816'; c.fill();
  for (let i = 0; i < 7; i++) { const a = -2.2 + i * 0.73; c.beginPath(); c.moveTo(r * 0.75 + Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); c.lineTo(r * 0.75 + Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62); c.lineTo(r * 0.75 + Math.cos(a + 0.25) * r * 0.32, Math.sin(a + 0.25) * r * 0.32); c.fillStyle = '#100c0c'; c.fill(); }
  eyes(c, r * 0.95, 0, r * 0.12, r * 0.06, '255,180,60');
  ell(c, r * 1.02, 0, r * 0.06, r * 0.13); c.fillStyle = '#ffd060'; c.fill();
};
// 12 · The Deep One: the Kraken, a vast tentacled head rising out of the water
B.kraken = (c, r, t) => {
  const rng = mulberry32(121);
  for (let i = 0; i < 8; i++) { const a = Math.PI * 0.35 + (i / 7) * Math.PI * 1.3; let x = Math.cos(a) * r * 0.6, y = Math.sin(a) * r * 0.6; const segs = []; for (let k = 0; k < 12; k++) { const b = a + Math.sin(t * 2 + i * 0.8 + k * 0.4) * 0.45 * (k / 12); x += Math.cos(b) * r * 0.15; y += Math.sin(b) * r * 0.15; segs.push([x, y]); }
    for (let k = segs.length - 1; k >= 0; k--) { const [sx, sy] = segs[k], w = r * (0.16 - k * 0.011); ell(c, sx, sy, w, w); c.fillStyle = rg(c, sx, sy, w, '#a8506a', '#3a1424'); c.fill(); if (k % 2 === 0 && k > 1) { ell(c, sx, sy, w * 0.4, w * 0.4); c.fillStyle = '#f0c8c8'; c.fill(); } } }
  ell(c, 0, 0, r * 0.95, r * 0.8); c.fillStyle = rg(c, 0, 0, r * 0.95, '#c8607a', '#3a1022'); c.fill();
  for (let i = 0; i < 20; i++) { ell(c, (rng() - 0.6) * r * 1.4, (rng() - 0.5) * r * 1.2, r * 0.04, r * 0.04); c.fillStyle = 'rgba(255,220,220,0.4)'; c.fill(); }
  for (const s of [-1, 1]) { ell(c, r * 0.45, s * r * 0.4, r * 0.2, r * 0.13); c.fillStyle = '#f8e870'; c.fill(); ell(c, r * 0.47, s * r * 0.4, r * 0.05, r * 0.11); c.fillStyle = '#100808'; c.fill(); }
  // water foaming round it
  c.strokeStyle = 'rgba(220,240,250,0.7)'; c.lineWidth = r * 0.04; for (let i = 0; i < 3; i++) { ell(c, 0, 0, r * (1.1 + i * 0.15 + Math.sin(t + i) * 0.05), r * (0.9 + i * 0.15)); c.stroke(); }
};
// 16 · The Red Dragon's rival: the Bone Wyrm, an undead dragon of bare bone and green fire
B.dragon = (c, r, t) => {
  const rng = mulberry32(161), bone = '#e0d4b8';
  glow(c, 0, 0, r * 2.4, '82,224,124', 0.3);
  for (const s of [-1, 1]) {
    // skeletal wings with tattered skin
    c.strokeStyle = bone; c.lineWidth = r * 0.07; c.lineCap = 'round';
    const tip = [r * 0.1, s * r * 2.3];
    c.beginPath(); c.moveTo(0, s * r * 0.3); c.lineTo(r * 0.3, s * r * 1.1); c.lineTo(tip[0], tip[1]); c.stroke();
    for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(r * 0.3, s * r * 1.1); c.lineTo(-r * (0.3 + k * 0.35), s * r * (2.1 - k * 0.35)); c.stroke(); }
    c.beginPath(); c.moveTo(0, s * r * 0.3); c.lineTo(r * 0.3, s * r * 1.1); c.lineTo(tip[0], tip[1]); for (let k = 0; k < 4; k++) c.lineTo(-r * (0.3 + k * 0.35), s * r * (2.1 - k * 0.35)); c.lineTo(-r * 0.6, s * r * 0.4); c.closePath();
    c.fillStyle = 'rgba(60,40,40,0.55)'; c.fill();
  }
  // spine and ribs, a green fire burning inside the ribcage
  c.beginPath(); c.moveTo(-r * 0.5, 0); c.quadraticCurveTo(-r * 1.4, Math.sin(t * 2) * r * 0.3, -r * 2.2, Math.sin(t * 2) * r * 0.5); c.strokeStyle = bone; c.lineWidth = r * 0.1; c.stroke();
  glow(c, 0, 0, r * 0.7, '82,224,124', 0.8);
  c.lineWidth = r * 0.06; for (let i = 0; i < 6; i++) { const x = -r * 0.45 + i * r * 0.15; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + r * 0.1, s * r * 0.4, x - r * 0.05, s * r * 0.5); c.stroke(); } }
  c.beginPath(); c.moveTo(-r * 0.5, 0); c.lineTo(r * 0.5, 0); c.lineWidth = r * 0.1; c.stroke();
  // the skull, horned, green flame in its sockets
  c.beginPath(); c.moveTo(r * 0.4, -r * 0.25); c.lineTo(r * 1.2, -r * 0.1); c.lineTo(r * 1.2, r * 0.1); c.lineTo(r * 0.4, r * 0.25); c.closePath(); c.fillStyle = rg(c, r * 0.8, 0, r * 0.5, '#f8f0dc', '#9a8a6a'); c.fill();
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(r * 0.45, s * r * 0.2); c.quadraticCurveTo(r * 0.1, s * r * 0.55, -r * 0.15, s * r * 0.45); c.lineTo(r * 0.4, s * r * 0.1); c.fillStyle = '#c8b898'; c.fill(); }
  eyes(c, r * 0.7, 0, r * 0.12, r * 0.05, '82,224,124');
};
// 5 · Dino Valley: Rex Mortis, a zombie tyrannosaur with ribs showing through rotting hide
B.dinos = (c, r, t) => {
  const rng = mulberry32(51), sk = '#6a7a4a';
  // tail
  c.beginPath(); c.moveTo(-r * 0.5, -r * 0.35); c.quadraticCurveTo(-r * 1.5, -r * 0.2 + Math.sin(t * 2) * r * 0.2, -r * 2.2, Math.sin(t * 2) * r * 0.35); c.quadraticCurveTo(-r * 1.5, r * 0.2, -r * 0.5, r * 0.35); c.fillStyle = lg(c, 0, -r * 0.4, 0, r * 0.4, [[0, shade(sk, 0.2)], [1, shade(sk, -0.5)]]); c.fill();
  for (const s of [-1, 1]) { limb(c, -r * 0.2, s * r * 0.55, r * 0.15, s * r * 0.95, r * 0.28, r * 0.18, shade(sk, -0.15)); claw(c, r * 0.25, s * r * 0.95, 0, r * 0.3); limb(c, r * 0.45, s * r * 0.35, r * 0.7, s * r * 0.45, r * 0.06, r * 0.04, sk); }
  ell(c, -r * 0.1, 0, r * 0.75, r * 0.6); c.fillStyle = rg(c, -r * 0.1, 0, r * 0.75, shade(sk, 0.2), shade(sk, -0.55)); c.fill();
  // torn hide: ribs and wounds
  c.save(); ell(c, -r * 0.2, -r * 0.2, r * 0.35, r * 0.25, 0.3); c.clip(); c.fillStyle = '#5a1a14'; c.fillRect(-r, -r, r * 2, r * 2); c.strokeStyle = '#e8dcc0'; c.lineWidth = r * 0.05; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-r * 0.5 + i * r * 0.12, -r * 0.5); c.lineTo(-r * 0.45 + i * r * 0.12, 0); c.stroke(); } c.restore();
  for (let i = 0; i < 12; i++) { ell(c, -r * 0.6 + i * r * 0.1, 0, r * 0.05, r * 0.03); c.fillStyle = '#3a4a2a'; c.fill(); }
  // the huge head, jaws agape with broken teeth
  ell(c, r * 0.85, 0, r * 0.55, r * 0.38); c.fillStyle = rg(c, r * 0.85, 0, r * 0.55, shade(sk, 0.25), shade(sk, -0.45)); c.fill();
  c.fillStyle = '#3a0e0a'; c.beginPath(); c.moveTo(r * 1.0, -r * 0.18); c.lineTo(r * 1.4, -r * 0.08); c.lineTo(r * 1.4, r * 0.08); c.lineTo(r * 1.0, r * 0.18); c.fill();
  c.fillStyle = '#f0e8d0'; for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const x = r * (1.02 + i * 0.065); c.beginPath(); c.moveTo(x, s * r * 0.16); c.lineTo(x + r * 0.025, s * r * 0.07); c.lineTo(x + r * 0.05, s * r * 0.16); c.fill(); }
  eyes(c, r * 0.75, 0, r * 0.26, r * 0.05, '190,255,90');
};
// 18 · Visitors: the Abductor, a grey alien in a flying saucer with a tractor beam and a zombie cow
B.ufo = (c, r, t) => {
  const rng = mulberry32(181);
  // the beam and a cow being lifted
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = rg(c, r * 1.1, r * 0.2, r * 0.8, 'rgba(160,255,200,0.6)', 'rgba(160,255,200,0)', 0, 0); ell(c, r * 1.1, r * 0.2, r * 0.75, r * 0.6); c.fill(); c.restore();
  c.save(); c.translate(r * 1.1, r * 0.2); c.rotate(t); ell(c, 0, 0, r * 0.32, r * 0.18); c.fillStyle = '#f0ece0'; c.fill(); for (let i = 0; i < 3; i++) { ell(c, (rng() - 0.5) * r * 0.4, (rng() - 0.5) * r * 0.2, r * 0.08, r * 0.05); c.fillStyle = '#2a2420'; c.fill(); } ell(c, r * 0.33, 0, r * 0.1, r * 0.08); c.fillStyle = '#d8b0a0'; c.fill(); c.restore();
  // the saucer: a ring of lights round a glass dome
  ell(c, 0, 0, r * 1.2, r * 1.2); c.fillStyle = rg(c, 0, 0, r * 1.2, '#d8dce4', '#4a505a'); c.fill(); c.strokeStyle = '#2a2e34'; c.lineWidth = r * 0.03; c.stroke();
  ell(c, 0, 0, r * 0.95, r * 0.95); c.strokeStyle = 'rgba(0,0,0,0.3)'; c.stroke();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + t * 2; const on = (i + Math.floor(t * 6)) % 3 === 0; ell(c, Math.cos(a) * r * 1.07, Math.sin(a) * r * 1.07, r * 0.06, r * 0.06); c.fillStyle = on ? '#ffe060' : '#6af0a0'; c.fill(); if (on) glow(c, Math.cos(a) * r * 1.07, Math.sin(a) * r * 1.07, r * 0.2, '255,230,100', 0.6); }
  ell(c, 0, 0, r * 0.6, r * 0.6); c.fillStyle = rg(c, 0, 0, r * 0.6, 'rgba(200,255,230,0.6)', 'rgba(60,120,110,0.6)'); c.fill();
  // the pilot: a big grey head, black almond eyes, and zombie rot creeping over it
  ell(c, 0, 0, r * 0.38, r * 0.32); c.fillStyle = rg(c, 0, 0, r * 0.38, '#b8c0b0', '#5a6458'); c.fill();
  for (const s of [-1, 1]) { ell(c, r * 0.12, s * r * 0.13, r * 0.13, r * 0.07, s * 0.5); c.fillStyle = '#0a0c0a'; c.fill(); ell(c, r * 0.1, s * r * 0.11, r * 0.03, r * 0.02); c.fillStyle = 'rgba(255,255,255,0.7)'; c.fill(); }
  ell(c, -r * 0.15, r * 0.1, r * 0.1, r * 0.07); c.fillStyle = '#6a7a4a'; c.fill();
  c.fillStyle = 'rgba(255,255,255,0.4)'; ell(c, -r * 0.25, -r * 0.25, r * 0.2, r * 0.08, -0.6); c.fill();
};
return { draw(id, c, r, t, lim) { LIM = lim; B[id](c, r, t); LIM = 1e9; } };
})();
