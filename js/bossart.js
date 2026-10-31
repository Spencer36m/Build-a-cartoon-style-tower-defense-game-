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
const CSS = (h) => rgb(h).join(',');
// a zombie-ish humanoid from above (used for riders, captains and priests)
function body(c, r, o) {
  const sw = r * 0.8 * (o.wide || 1), td = r * 0.5;
  for (const s of [-1, 1]) { limb(c, td * 0.1, s * sw * 0.8, td + r * 0.3, s * sw * 0.75, r * 0.17, r * 0.14, o.sleeve || o.shirt); limb(c, td + r * 0.3, s * sw * 0.75, td + r * 0.85, s * sw * 0.45, r * 0.14, r * 0.12, o.skin); ell(c, td + r * 0.9, s * sw * 0.42, r * 0.15, r * 0.12); c.fillStyle = o.skin; c.fill(); }
  ell(c, 0, 0, td, sw); c.fillStyle = rg(c, 0, 0, sw * 1.1, shade(o.shirt, 0.2), shade(o.shirt, -0.5)); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = r * 0.04; c.stroke();
  ell(c, td * 0.55, 0, r * 0.32, r * 0.3); c.fillStyle = rg(c, td * 0.55, 0, r * 0.35, shade(o.skin, 0.25), shade(o.skin, -0.4)); c.fill();
}

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
// 2 · Ashen Peaks: the Ash Wyrm, a great serpent of ash and embers that tunnels through the slopes
B.ashen = (c, r, t) => {
  const rng = mulberry32(21);
  glow(c, 0, 0, r * 2, '255,90,40', 0.25);
  const pts = []; for (let i = 0; i <= 14; i++) { const k = i / 14; pts.push([r * 1.1 - k * r * 3, Math.sin(k * 5 + t * 3) * r * 0.55 * k]); }
  for (let i = pts.length - 1; i > 0; i--) { const [x, y] = pts[i], w = r * (0.42 - (i / pts.length) * 0.3); blob(c, x, y, w, rng, 8, 0.2); c.fillStyle = rg(c, x, y, w, '#6a6460', '#24201e'); c.fill(); c.strokeStyle = 'rgba(255,120,40,0.7)'; c.lineWidth = r * 0.03; c.stroke(); if (i % 2) { c.beginPath(); c.moveTo(x - w * 0.3, y - w * 0.8); c.lineTo(x + w * 0.2, y); c.lineTo(x - w * 0.3, y + w * 0.8); c.strokeStyle = '#ff8a3a'; c.lineWidth = r * 0.04; c.stroke(); } }
  // the head, horned, jaws open on a furnace
  const [hx, hy] = pts[0];
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(hx - r * 0.1, hy + s * r * 0.3); c.quadraticCurveTo(hx - r * 0.6, hy + s * r * 0.8, hx - r * 0.75, hy + s * r * 0.6); c.lineTo(hx - r * 0.2, hy + s * r * 0.2); c.fillStyle = '#1a1614'; c.fill(); }
  ell(c, hx, hy, r * 0.55, r * 0.45); c.fillStyle = rg(c, hx, hy, r * 0.5, '#7a7470', '#2a2422'); c.fill();
  c.beginPath(); c.moveTo(hx + r * 0.2, hy - r * 0.32); c.lineTo(hx + r * 0.75, hy - r * 0.12); c.lineTo(hx + r * 0.75, hy + r * 0.12); c.lineTo(hx + r * 0.2, hy + r * 0.32); c.closePath(); c.fillStyle = '#ff7a20'; c.fill(); glow(c, hx + r * 0.55, hy, r * 0.5, '255,170,60', 0.7);
  eyes(c, hx + r * 0.05, hy, r * 0.24, r * 0.06, '255,200,80');
};
// 3 · Burning Wastes: the Wildfire Wendigo, a gaunt burning beast with a crown of charred antlers
B.wildfire = (c, r, t) => {
  const rng = mulberry32(31);
  glow(c, 0, 0, r * 2.2, '255,120,30', 0.4);
  for (const s of [-1, 1]) { limb(c, 0, s * r * 0.55, r * 0.7, s * r * 0.95, r * 0.13, r * 0.1, '#2a1e18'); limb(c, r * 0.7, s * r * 0.95, r * 1.35, s * r * 0.6, r * 0.1, r * 0.07, '#1e1612'); claw(c, r * 1.38, s * r * 0.58, s * 0.3, r * 0.35, '#e0d4b8'); }
  ell(c, -r * 0.1, 0, r * 0.75, r * 0.5); c.fillStyle = rg(c, -r * 0.1, 0, r * 0.75, '#4a3a30', '#120c0a'); c.fill();
  c.strokeStyle = 'rgba(240,220,190,0.45)'; c.lineWidth = r * 0.04; for (let i = -3; i <= 3; i++) { c.beginPath(); c.arc(-r * 0.1, i * r * 0.11, r * 0.5, -0.6, 0.6); c.stroke(); }
  // flames streaming off its back
  for (let i = 0; i < 9; i++) { const y = (i - 4) * r * 0.12, l = r * (0.5 + rng() * 0.6) * (1 + Math.sin(t * 9 + i) * 0.15); c.beginPath(); c.moveTo(-r * 0.4, y - r * 0.1); c.quadraticCurveTo(-r * 0.7 - l * 0.5, y + Math.sin(t * 7 + i) * r * 0.1, -r * 0.5 - l, y); c.quadraticCurveTo(-r * 0.7 - l * 0.4, y + r * 0.06, -r * 0.4, y + r * 0.1); c.fillStyle = i % 2 ? '#ff8a1a' : '#ffcf4a'; c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1; }
  // the skull and its antlers
  c.strokeStyle = '#1a120e'; c.lineCap = 'round';
  for (const s of [-1, 1]) { const br = (x, y, a, l, w, d) => { const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); if (d > 0) { br(x2, y2, a + s * 0.5, l * 0.6, w * 0.7, d - 1); br(x2, y2, a - s * 0.4, l * 0.7, w * 0.7, d - 1); } }; br(r * 0.7, s * r * 0.15, s * 1.9 - (s > 0 ? 0 : 0), r * 0.45, r * 0.08, 3); }
  ell(c, r * 0.8, 0, r * 0.3, r * 0.24); c.fillStyle = rg(c, r * 0.8, 0, r * 0.3, '#f0e6d0', '#8a7a62'); c.fill();
  eyes(c, r * 0.9, 0, r * 0.1, r * 0.05, '255,140,30');
};
// 4 · Emberwood: the Smoldering Oak, a burned walking tree dragging smoking roots
B.emberwood = (c, r, t) => {
  const rng = mulberry32(41);
  for (let i = 0; i < 9; i++) { const a = Math.PI + (i - 4) * 0.28; limb(c, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, Math.cos(a) * r * 1.4, Math.sin(a) * r * 1.3, r * 0.12, r * 0.04, '#3a2a1e'); }
  for (const s of [-1, 1]) { limb(c, r * 0.2, s * r * 0.7, r * 1.1, s * r * 1.2, r * 0.2, r * 0.1, '#4a3424'); for (let k = 0; k < 3; k++) limb(c, r * 1.1, s * r * 1.2, r * (1.4 + k * 0.1), s * r * (1.1 + k * 0.25), r * 0.07, r * 0.03, '#3a2818'); }
  blob(c, 0, 0, r * 1.05, rng, 16, 0.25); c.fillStyle = rg(c, 0, 0, r * 1.1, '#5a4430', '#1a120c'); c.fill();
  // tree rings and glowing ember cracks across the stump-top of its body
  c.strokeStyle = 'rgba(160,120,80,0.45)'; c.lineWidth = r * 0.025; for (let k = 1; k < 6; k++) { ell(c, -r * 0.1, 0, r * k * 0.15, r * k * 0.14); c.stroke(); }
  c.strokeStyle = '#ff7a20'; c.lineWidth = r * 0.04; for (let i = 0; i < 6; i++) { let x = 0, y = 0, a = rng() * TAU; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { a += (rng() - 0.5) * 1.2; x += Math.cos(a) * r * 0.2; y += Math.sin(a) * r * 0.2; c.lineTo(x, y); } c.stroke(); }
  glow(c, 0, 0, r * 0.8, '255,110,30', 0.4);
  // a face carved into the trunk, and leaves still smouldering on the crown
  ell(c, r * 0.7, 0, r * 0.32, r * 0.42); c.fillStyle = '#2a1c12'; c.fill();
  eyes(c, r * 0.8, 0, r * 0.15, r * 0.06, '255,160,40');
  c.fillStyle = '#ff9a2a'; ell(c, r * 0.95, 0, r * 0.05, r * 0.16); c.fill();
  for (let i = 0; i < 14; i++) { const a = rng() * TAU, d = r * (0.8 + rng() * 0.3); ell(c, Math.cos(a) * d, Math.sin(a) * d, r * 0.07, r * 0.04, a); c.fillStyle = rng() < 0.5 ? '#ff6a1a' : '#5a3a1a'; c.fill(); }
};
// 6 · Raptor Plains: the Pack Alpha, a feathered zombie raptor matriarch with a sickle claw
B.raptors = (c, r, t) => {
  const rng = mulberry32(61), sk = '#7a6248';
  c.beginPath(); c.moveTo(-r * 0.3, -r * 0.2); c.quadraticCurveTo(-r * 1.2, Math.sin(t * 4) * r * 0.2, -r * 2, Math.sin(t * 4) * r * 0.25); c.quadraticCurveTo(-r * 1.2, r * 0.15, -r * 0.3, r * 0.2); c.fillStyle = shade(sk, -0.2); c.fill();
  // tail and crest feathers, bright and ragged
  for (let i = 0; i < 9; i++) { const x = -r * (0.6 + i * 0.16), w = r * (0.35 - i * 0.025); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x - r * 0.15, s * w); c.lineTo(x - r * 0.05, s * w * 0.5); c.fillStyle = i % 2 ? '#c84a2a' : '#2a6a8a'; c.fill(); } }
  for (const s of [-1, 1]) { limb(c, 0, s * r * 0.35, r * 0.35, s * r * 0.75, r * 0.16, r * 0.1, shade(sk, -0.1)); c.beginPath(); c.moveTo(r * 0.35, s * r * 0.75); c.quadraticCurveTo(r * 0.75, s * r * 1.0, r * 0.6, s * r * 0.6); c.fillStyle = '#f0e8d8'; c.fill(); limb(c, r * 0.3, s * r * 0.25, r * 0.65, s * r * 0.35, r * 0.06, r * 0.04, sk); claw(c, r * 0.68, s * r * 0.35, 0, r * 0.18); }
  ell(c, 0, 0, r * 0.55, r * 0.4); c.fillStyle = rg(c, 0, 0, r * 0.55, shade(sk, 0.3), shade(sk, -0.5)); c.fill();
  c.strokeStyle = '#3a2a1a'; c.lineWidth = r * 0.04; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-r * 0.35, i * r * 0.12); c.lineTo(r * 0.3, i * r * 0.1); c.stroke(); }
  limb(c, r * 0.3, 0, r * 0.65, 0, r * 0.14, r * 0.12, sk, false);
  ell(c, r * 0.9, 0, r * 0.34, r * 0.17); c.fillStyle = rg(c, r * 0.9, 0, r * 0.34, shade(sk, 0.3), shade(sk, -0.4)); c.fill();
  for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(r * (0.6 + i * 0.07), 0); c.lineTo(r * (0.55 + i * 0.07), -r * 0.12); c.lineTo(r * (0.65 + i * 0.07), 0); c.fillStyle = '#c84a2a'; c.fill(); }
  eyes(c, r * 0.95, 0, r * 0.1, r * 0.04, '255,220,60');
};
// 7 · Pterosaur Cliffs: the Quetzal Wraith, a giant undead pterosaur with torn wing membranes
B.pteros = (c, r, t) => {
  const rng = mulberry32(71), flap = Math.sin(t * 4) * 0.12;
  for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(r * 0.2, s * r * 0.15); c.lineTo(r * 0.35, s * r * 1.2); c.lineTo(r * 0.1, s * r * (2.4 + flap)); c.quadraticCurveTo(-r * 0.6, s * r * 1.6, -r * 0.5, s * r * 0.25); c.closePath();
    c.fillStyle = lg(c, 0, 0, 0, s * r * 2.4, [[0, '#5a4a5a'], [1, '#2a2030']]); c.fill();
    c.strokeStyle = '#d8c8a8'; c.lineWidth = r * 0.05; c.beginPath(); c.moveTo(r * 0.2, s * r * 0.15); c.lineTo(r * 0.35, s * r * 1.2); c.lineTo(r * 0.1, s * r * (2.4 + flap)); c.stroke();
    // rips in the membrane
    for (let i = 0; i < 3; i++) { ell(c, -r * 0.1 + rng() * r * 0.2, s * r * (0.8 + i * 0.4), r * 0.1, r * 0.06, rng()); c.fillStyle = '#121014'; c.fill(); }
  }
  ell(c, 0, 0, r * 0.45, r * 0.2); c.fillStyle = rg(c, 0, 0, r * 0.45, '#8a7a7a', '#2a2228'); c.fill();
  // a long beak and the bony crest sweeping back
  c.beginPath(); c.moveTo(r * 0.35, -r * 0.1); c.lineTo(r * 1.4, 0); c.lineTo(r * 0.35, r * 0.1); c.fillStyle = '#c8b898'; c.fill();
  c.beginPath(); c.moveTo(r * 0.45, -r * 0.05); c.lineTo(-r * 0.4, -r * 0.02); c.lineTo(r * 0.45, r * 0.05); c.fillStyle = '#8a3a3a'; c.fill();
  ell(c, r * 0.45, 0, r * 0.16, r * 0.13); c.fillStyle = '#6a5a5a'; c.fill();
  eyes(c, r * 0.5, 0, r * 0.08, r * 0.035, '160,255,200');
  glow(c, 0, 0, r * 1.2, '120,255,180', 0.15);
};
// 8 · Starfall Crater: the Starborn, a living meteor of green crystal that grows the dead around it
B.starfall = (c, r, t) => {
  const rng = mulberry32(81);
  glow(c, 0, 0, r * 2.4, '82,224,124', 0.45);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + t * 0.4; limb(c, Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4, Math.cos(a + 0.4) * r * 1.4, Math.sin(a + 0.4) * r * 1.4, r * 0.14, r * 0.04, '#3a5a3a'); }
  blob(c, 0, 0, r * 0.9, rng, 12, 0.3); c.fillStyle = rg(c, 0, 0, r * 0.9, '#5a5a52', '#1a1c18'); c.fill();
  c.strokeStyle = '#52e07c'; c.lineWidth = r * 0.035; for (let i = 0; i < 8; i++) { let x = 0, y = 0, a = rng() * TAU; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { a += (rng() - 0.5); x += Math.cos(a) * r * 0.2; y += Math.sin(a) * r * 0.2; c.lineTo(x, y); } c.stroke(); }
  // green crystals bursting out of it
  for (let i = 0; i < 11; i++) { const a = rng() * TAU, d = r * (0.15 + rng() * 0.55), s = r * (0.2 + rng() * 0.3); c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d); c.rotate(a); c.beginPath(); c.moveTo(0, -s * 0.25); c.lineTo(s, 0); c.lineTo(0, s * 0.25); c.lineTo(-s * 0.2, 0); c.closePath(); c.fillStyle = lg(c, 0, -s * 0.25, s, s * 0.25, [[0, '#d8ffe0'], [0.5, '#52e07c'], [1, '#14602a']]); c.fill(); c.strokeStyle = 'rgba(0,40,10,0.6)'; c.lineWidth = r * 0.015; c.stroke(); c.restore(); }
  ell(c, r * 0.2, 0, r * 0.22, r * 0.22); c.fillStyle = rg(c, r * 0.2, 0, r * 0.22, '#f0fff0', '#52e07c', 0, 0); c.fill();
  glow(c, r * 0.2, 0, r * 0.6, '200,255,210', 0.6 + Math.sin(t * 3) * 0.2);
};
// 9 · Crystal Spires: the Prism Colossus, a hovering golem of floating crystal shards
B.spires = (c, r, t) => {
  const rng = mulberry32(91), cols = ['#b8e8ff', '#c8a8ff', '#8ad8ff', '#f0d8ff'];
  glow(c, 0, 0, r * 2, '190,170,255', 0.35);
  // shards orbit it
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + t * 0.8, d = r * 1.35, s = r * 0.22; c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d); c.rotate(a + t); c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.45, 0); c.lineTo(0, s); c.lineTo(-s * 0.45, 0); c.closePath(); c.fillStyle = cols[i % 4]; c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1; c.restore(); }
  for (const s of [-1, 1]) { for (let k = 0; k < 3; k++) { const x = r * (0.1 + k * 0.35), y = s * r * (0.75 + k * 0.05); c.save(); c.translate(x, y); c.rotate(s * 0.3); c.beginPath(); c.moveTo(-r * 0.15, 0); c.lineTo(0, -r * 0.18); c.lineTo(r * 0.2, 0); c.lineTo(0, r * 0.18); c.closePath(); c.fillStyle = cols[k]; c.fill(); c.strokeStyle = 'rgba(40,30,80,0.6)'; c.lineWidth = r * 0.02; c.stroke(); c.restore(); } }
  // the body: a faceted crystal heart
  const n = 8; c.beginPath(); for (let i = 0; i < n; i++) { const a = (i / n) * TAU, rr = r * (i % 2 ? 0.6 : 0.8); i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath();
  c.fillStyle = lg(c, -r, -r, r, r, [[0, '#f8f4ff'], [0.4, '#a888ff'], [1, '#3a2a7a']]); c.fill(); c.strokeStyle = '#2a2050'; c.lineWidth = r * 0.03; c.stroke();
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r * (i % 2 ? 0.6 : 0.8), Math.sin(a) * r * (i % 2 ? 0.6 : 0.8)); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.stroke(); }
  // a rainbow refracting out of its eye
  c.save(); c.globalCompositeOperation = 'lighter'; ['255,80,80', '255,220,80', '80,255,120', '80,180,255', '200,100,255'].forEach((col, i) => { c.beginPath(); c.moveTo(r * 0.35, 0); c.lineTo(r * 1.8, (i - 2) * r * 0.12 - r * 0.06); c.lineTo(r * 1.8, (i - 2) * r * 0.12 + r * 0.06); c.closePath(); c.fillStyle = `rgba(${col},0.4)`; c.fill(); }); c.restore();
  ell(c, r * 0.35, 0, r * 0.12, r * 0.12); c.fillStyle = '#ffffff'; c.fill();
};
// 10 · The Rift: the Unmade, a void eye wreathed in shadow tentacles torn out of the sky
B.rift = (c, r, t) => {
  const rng = mulberry32(101);
  glow(c, 0, 0, r * 2.4, '160,80,255', 0.35);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; c.beginPath(); let x = Math.cos(a) * r * 0.6, y = Math.sin(a) * r * 0.6; c.moveTo(x, y); for (let k = 1; k <= 8; k++) { const b = a + Math.sin(t * 2 + i + k * 0.6) * 0.5; x += Math.cos(b) * r * 0.17; y += Math.sin(b) * r * 0.17; c.lineTo(x, y); } c.strokeStyle = '#140a20'; c.lineWidth = r * 0.12; c.lineCap = 'round'; c.stroke(); c.strokeStyle = 'rgba(184,102,255,0.6)'; c.lineWidth = r * 0.03; c.stroke(); }
  blob(c, 0, 0, r * 0.85, rng, 18, 0.3); c.fillStyle = rg(c, 0, 0, r * 0.85, '#2a1a40', '#06030c', 0, 0); c.fill();
  for (let i = 0; i < 40; i++) { const a = rng() * TAU, d = rng() * r * 0.7; c.fillStyle = 'rgba(220,200,255,0.8)'; c.fillRect(Math.cos(a) * d, Math.sin(a) * d, r * 0.02, r * 0.02); }
  // the single huge eye, its pupil a slit of starlight
  ell(c, r * 0.15, 0, r * 0.45, r * 0.3); c.fillStyle = rg(c, r * 0.15, 0, r * 0.45, '#f0e0ff', '#7a3ac8', 0, 0); c.fill();
  ell(c, r * 0.15, 0, r * 0.08, r * 0.26); c.fillStyle = '#05020a'; c.fill();
  glow(c, r * 0.15, 0, r * 0.7, '200,140,255', 0.5);
};
// 11 · Circle of Runes: the Stone Warden, a menhir giant carved with glowing runes
B.stones = (c, r, t) => {
  const rng = mulberry32(111), st = '#8a8a82';
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + t * 0.3; c.save(); c.translate(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5); c.rotate(a); c.fillStyle = rg(c, 0, 0, r * 0.2, '#a8a8a0', '#4a4a44'); c.fillRect(-r * 0.12, -r * 0.08, r * 0.24, r * 0.16); c.fillStyle = '#7ad8ff'; c.font = `${r * 0.12}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ᚱᛟᚾᛖᛋᚹ'[i], 0, 0); c.restore(); glow(c, Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5, r * 0.3, '120,210,255', 0.3); }
  for (const s of [-1, 1]) { limb(c, 0, s * r * 0.75, r * 0.7, s * r * 1.0, r * 0.3, r * 0.26, shade(st, -0.1)); blob(c, r * 0.9, s * r * 0.95, r * 0.3, rng, 7, 0.3); c.fillStyle = shade(st, -0.2); c.fill(); }
  c.beginPath(); c.moveTo(-r * 0.6, -r * 0.7); c.lineTo(r * 0.55, -r * 0.8); c.lineTo(r * 0.7, 0); c.lineTo(r * 0.55, r * 0.8); c.lineTo(-r * 0.6, r * 0.7); c.lineTo(-r * 0.75, 0); c.closePath();
  c.fillStyle = lg(c, -r, -r, r, r, [[0, '#b8b8b0'], [0.5, st], [1, '#3a3a36']]); c.fill(); c.strokeStyle = '#2a2a26'; c.lineWidth = r * 0.03; c.stroke();
  // moss and lichen, and runes blazing down its back
  for (let i = 0; i < 12; i++) { ell(c, (rng() - 0.5) * r * 1.2, (rng() - 0.5) * r * 1.2, r * 0.08, r * 0.05, rng()); c.fillStyle = 'rgba(90,120,50,0.7)'; c.fill(); }
  c.fillStyle = '#9ae8ff'; c.font = `bold ${r * 0.2}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; ['ᚦ', 'ᛉ', 'ᛟ', 'ᚨ'].forEach((g, i) => { glow(c, -r * 0.35 + i * r * 0.22, 0, r * 0.2, '120,220,255', 0.6); c.fillText(g, -r * 0.35 + i * r * 0.22, 0); });
  ell(c, r * 0.75, 0, r * 0.22, r * 0.2); c.fillStyle = '#6a6a64'; c.fill(); eyes(c, r * 0.85, 0, r * 0.08, r * 0.04, '120,220,255');
};
// 13 · The Ghost Ship: Captain Blackwake, a spectral pirate captain with a lantern and cutlass
B.ghostship = (c, r, t) => {
  const rng = mulberry32(131);
  glow(c, 0, 0, r * 2, '120,255,220', 0.3);
  c.globalAlpha = 0.9;
  // the long coat trailing behind as mist
  c.beginPath(); c.moveTo(r * 0.2, -r * 0.8); for (let i = 0; i <= 8; i++) { const k = i / 8; c.lineTo(-r * (1.4 + Math.sin(t * 3 + k * 6) * 0.15) + (i % 2) * r * 0.2, -r * 0.9 + k * r * 1.8); } c.lineTo(r * 0.2, r * 0.8); c.closePath();
  c.fillStyle = lg(c, r * 0.2, 0, -r * 1.5, 0, [[0, '#2a5a5a'], [1, 'rgba(40,120,110,0)']]); c.fill();
  body(c, r, { skin: '#9ae8d8', shirt: '#1a3a40', sleeve: '#244a50', wide: 1.1 });
  c.globalAlpha = 1;
  // gold epaulettes, a cutlass and a lantern
  for (const s of [-1, 1]) { ell(c, 0, s * r * 0.7, r * 0.16, r * 0.1); c.fillStyle = '#d8b040'; c.fill(); }
  c.save(); c.translate(r * 1.0, -r * 0.45); c.rotate(-0.6); c.fillStyle = '#d8e8e8'; c.beginPath(); c.moveTo(0, -r * 0.04); c.quadraticCurveTo(r * 0.5, -r * 0.1, r * 0.9, r * 0.05); c.lineTo(0, r * 0.05); c.fill(); c.fillStyle = '#d8b040'; c.fillRect(-r * 0.12, -r * 0.08, r * 0.1, r * 0.16); c.restore();
  ell(c, r * 1.05, r * 0.45, r * 0.12, r * 0.12); c.fillStyle = '#c8ffe8'; c.fill(); glow(c, r * 1.05, r * 0.45, r * 0.6, '120,255,200', 0.7);
  // a tricorn hat with a skull badge
  c.beginPath(); c.moveTo(r * 0.75, 0); c.lineTo(r * 0.2, -r * 0.45); c.lineTo(r * 0.3, 0); c.lineTo(r * 0.2, r * 0.45); c.closePath(); c.fillStyle = '#121a1c'; c.fill();
  ell(c, r * 0.4, 0, r * 0.26, r * 0.22); c.fillStyle = '#16201f'; c.fill(); ell(c, r * 0.5, 0, r * 0.06, r * 0.06); c.fillStyle = '#e8e8d8'; c.fill();
  eyes(c, r * 0.68, 0, r * 0.1, r * 0.035, '120,255,200');
};
// 14 · The Elder Tree: the Blight, a fungal rot colossus trying to strangle the old tree
B.eldertree = (c, r, t) => {
  const rng = mulberry32(141);
  glow(c, 0, 0, r * 2, '200,255,90', 0.25);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; limb(c, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, Math.cos(a + 0.3) * r * 1.4, Math.sin(a + 0.3) * r * 1.4, r * 0.1, r * 0.03, '#5a4a3a'); }
  blob(c, 0, 0, r, rng, 20, 0.35); c.fillStyle = rg(c, 0, 0, r, '#9a8a5a', '#2a2418'); c.fill();
  // mushroom caps and puffballs crowding its back, spores drifting off
  for (let i = 0; i < 16; i++) { const a = rng() * TAU, d = rng() * r * 0.8, cr = r * (0.09 + rng() * 0.15); ell(c, Math.cos(a) * d + cr * 0.15, Math.sin(a) * d + cr * 0.2, cr, cr); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill(); ell(c, Math.cos(a) * d, Math.sin(a) * d, cr, cr); const col = ['#c8a050', '#e8d8b0', '#8a3a3a', '#d8e870'][i % 4]; c.fillStyle = rg(c, Math.cos(a) * d, Math.sin(a) * d, cr, shade(col, 0.3), shade(col, -0.4)); c.fill(); if (i % 4 === 2) { for (let k = 0; k < 4; k++) { ell(c, Math.cos(a) * d + (rng() - 0.5) * cr, Math.sin(a) * d + (rng() - 0.5) * cr, cr * 0.15, cr * 0.15); c.fillStyle = '#f0e8d8'; c.fill(); } } }
  for (let i = 0; i < 30; i++) { const a = rng() * TAU, d = r * (1 + rng() * 0.7); ell(c, Math.cos(a) * d, Math.sin(a) * d, r * 0.025, r * 0.025); c.fillStyle = 'rgba(220,255,120,0.7)'; c.fill(); }
  ell(c, r * 0.75, 0, r * 0.25, r * 0.3); c.fillStyle = '#3a3020'; c.fill();
  eyes(c, r * 0.85, 0, r * 0.12, r * 0.045, '210,255,90');
};
// 15 · Skyhold: the Storm Harbinger, a zombie airship's captain-thing riding a storm cloud
B.skyhold = (c, r, t) => {
  const rng = mulberry32(151);
  for (let i = 0; i < 12; i++) { const a = rng() * TAU, d = r * (0.6 + rng() * 0.5), cr = r * (0.35 + rng() * 0.25); ell(c, Math.cos(a) * d, Math.sin(a) * d, cr, cr * 0.8); c.fillStyle = rg(c, Math.cos(a) * d, Math.sin(a) * d, cr, '#8a94a8', '#2a3040'); c.fill(); }
  // lightning crackling out of the cloud
  c.strokeStyle = '#e8f0ff'; c.lineWidth = r * 0.035; for (let i = 0; i < 4; i++) { let x = 0, y = 0, a = rng() * TAU; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 6; k++) { a += (rng() - 0.5) * 1.5; x += Math.cos(a) * r * 0.25; y += Math.sin(a) * r * 0.25; c.lineTo(x, y); } c.stroke(); glow(c, x, y, r * 0.3, '200,220,255', 0.6); }
  // the rider: a zombie aviator in goggles and a torn flight jacket, scarf streaming
  c.beginPath(); c.moveTo(-r * 0.1, r * 0.1); c.quadraticCurveTo(-r * 0.8, r * 0.4 + Math.sin(t * 6) * r * 0.1, -r * 1.3, r * 0.2); c.lineTo(-r * 1.2, r * 0.32); c.quadraticCurveTo(-r * 0.7, r * 0.5, -r * 0.1, r * 0.2); c.fillStyle = '#c83a2a'; c.fill();
  body(c, r * 0.75, { skin: '#9aa080', shirt: '#6a4a2a', sleeve: '#5a3a20' });
  ell(c, r * 0.3, 0, r * 0.22, r * 0.2); c.fillStyle = '#5a3a20'; c.fill();
  for (const s of [-1, 1]) { ell(c, r * 0.42, s * r * 0.08, r * 0.07, r * 0.07); c.fillStyle = '#8ad8ff'; c.fill(); c.strokeStyle = '#3a3a3a'; c.lineWidth = r * 0.02; c.stroke(); }
};
// 17 · Sun Temple: the Sun Priest, a golden-masked zombie priest carrying the temple's sun disc
B.temple = (c, r, t) => {
  const rng = mulberry32(171);
  glow(c, 0, 0, r * 2.2, '255,210,90', 0.4);
  // the sun disc on its back, rays turning
  c.save(); c.translate(-r * 0.3, 0); c.rotate(t * 0.5); for (let i = 0; i < 16; i++) { c.rotate(TAU / 16); c.beginPath(); c.moveTo(r * 0.7, -r * 0.08); c.lineTo(r * 1.35, 0); c.lineTo(r * 0.7, r * 0.08); c.fillStyle = i % 2 ? '#ffd24a' : '#e89a2a'; c.fill(); } c.restore();
  ell(c, -r * 0.3, 0, r * 0.75, r * 0.75); c.fillStyle = rg(c, -r * 0.3, 0, r * 0.75, '#fff0a0', '#c8781a'); c.fill();
  body(c, r * 0.85, { skin: '#9a8a6a', shirt: '#f0e8d0', sleeve: '#e8dcc0' });
  // the robe's gold trim and a staff topped with a scarab
  c.strokeStyle = '#d8a02a'; c.lineWidth = r * 0.05; ell(c, 0, 0, r * 0.42, r * 0.68); c.stroke();
  c.strokeStyle = '#6a4a20'; c.lineWidth = r * 0.06; c.beginPath(); c.moveTo(r * 0.2, -r * 0.8); c.lineTo(r * 1.3, -r * 0.6); c.stroke(); ell(c, r * 1.35, -r * 0.6, r * 0.12, r * 0.09); c.fillStyle = '#2a8a8a'; c.fill();
  // the golden mask
  ell(c, r * 0.5, 0, r * 0.3, r * 0.28); c.fillStyle = rg(c, r * 0.5, 0, r * 0.3, '#fff4b0', '#b8781a'); c.fill();
  c.strokeStyle = '#2a6a8a'; c.lineWidth = r * 0.04; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(r * 0.25, -r * 0.26 + i * r * 0.17); c.lineTo(r * 0.15, -r * 0.3 + i * r * 0.2); c.stroke(); }
  eyes(c, r * 0.65, 0, r * 0.1, r * 0.04, '255,255,200');
};
// 19 · The Moonwell: the Lunar Alpha, a silver werewolf that heals in the moonlight
B.moonwell = (c, r, t) => {
  const rng = mulberry32(191), fur = '#8a90a8';
  glow(c, 0, 0, r * 2.2, '180,200,255', 0.3);
  c.strokeStyle = 'rgba(200,215,255,0.5)'; c.lineWidth = r * 0.03; for (let i = 0; i < 2; i++) { ell(c, 0, 0, r * (1.5 + i * 0.25), r * (1.5 + i * 0.25)); c.setLineDash([r * 0.1, r * 0.1]); c.stroke(); } c.setLineDash([]);
  c.beginPath(); c.moveTo(-r * 0.5, -r * 0.2); c.quadraticCurveTo(-r * 1.2, Math.sin(t * 3) * r * 0.3, -r * 1.5, Math.sin(t * 3) * r * 0.2); c.quadraticCurveTo(-r * 1.1, r * 0.25, -r * 0.5, r * 0.2); c.fillStyle = shade(fur, -0.2); c.fill();
  for (const s of [-1, 1]) { limb(c, 0, s * r * 0.6, r * 0.6, s * r * 0.9, r * 0.22, r * 0.16, fur); limb(c, r * 0.6, s * r * 0.9, r * 1.1, s * r * 0.55, r * 0.16, r * 0.13, shade(fur, -0.15)); claw(c, r * 1.15, s * r * 0.52, s * 0.3, r * 0.28, '#f0f0f8'); }
  ell(c, 0, 0, r * 0.75, r * 0.65); c.fillStyle = rg(c, 0, 0, r * 0.75, '#d8dcf0', '#3a3e58'); c.fill();
  c.strokeStyle = 'rgba(30,30,50,0.45)'; c.lineWidth = r * 0.025; for (let i = 0; i < 40; i++) { const a = rng() * TAU, d = rng() * r * 0.6, x = Math.cos(a) * d, y = Math.sin(a) * d; c.beginPath(); c.moveTo(x, y); c.lineTo(x - r * 0.12, y + (rng() - 0.5) * r * 0.05); c.stroke(); }
  ell(c, r * 0.75, 0, r * 0.32, r * 0.28); c.fillStyle = rg(c, r * 0.75, 0, r * 0.32, '#c8ccdc', '#4a4e68'); c.fill();
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(r * 0.6, s * r * 0.15); c.lineTo(r * 0.45, s * r * 0.42); c.lineTo(r * 0.75, s * r * 0.22); c.fillStyle = '#5a5e78'; c.fill(); }
  ell(c, r * 1.05, 0, r * 0.18, r * 0.12); c.fillStyle = '#7a7e98'; c.fill(); ell(c, r * 1.2, 0, r * 0.05, r * 0.05); c.fillStyle = '#1a1a24'; c.fill();
  eyes(c, r * 0.85, 0, r * 0.13, r * 0.045, '160,220,255');
  // a crescent moon mark glowing on its back
  c.fillStyle = '#f0f4ff'; c.beginPath(); c.arc(-r * 0.1, 0, r * 0.25, 0.6, TAU - 0.6); c.arc(r * 0.0, 0, r * 0.2, TAU - 0.9, 0.9, true); c.fill(); glow(c, -r * 0.1, 0, r * 0.5, '220,230,255', 0.5);
};
// 20 · Ground Zero: Subject Zero, the first infected, grown huge, still in its lab restraints
B.zero = (c, r, t) => {
  const rng = mulberry32(201), sk = '#8a9a7a';
  glow(c, 0, 0, r * 2.2, '82,224,124', 0.35);
  // broken tubes and chains trailing behind
  for (let i = 0; i < 5; i++) { const y = (i - 2) * r * 0.25; c.beginPath(); c.moveTo(-r * 0.4, y); c.bezierCurveTo(-r * 1, y + r * 0.3, -r * 1.3, y - r * 0.3 + Math.sin(t * 3 + i) * r * 0.1, -r * 1.8, y); c.strokeStyle = i % 2 ? 'rgba(160,255,190,0.7)' : '#7a7a74'; c.lineWidth = r * (i % 2 ? 0.06 : 0.04); c.stroke(); }
  for (const s of [-1, 1]) { limb(c, 0, s * r * 0.8, r * 0.75, s * r * 1.1, r * 0.3, r * 0.25, sk); limb(c, r * 0.75, s * r * 1.1, r * 1.35, s * r * 0.7, r * 0.25, r * 0.22, shade(sk, -0.1)); ell(c, r * 0.75, s * r * 1.1, r * 0.3, r * 0.12, s * 0.3); c.fillStyle = '#8a8a84'; c.fill(); c.strokeStyle = '#3a3a36'; c.lineWidth = r * 0.03; c.stroke(); claw(c, r * 1.4, s * r * 0.68, s * 0.3, r * 0.3); }
  ell(c, 0, 0, r * 0.75, r * 0.9); c.fillStyle = rg(c, 0, 0, r * 0.9, shade(sk, 0.25), shade(sk, -0.5)); c.fill();
  // a torn hospital gown with a barcode, and glowing green veins under the skin
  c.save(); ell(c, 0, 0, r * 0.75, r * 0.9); c.clip(); c.fillStyle = 'rgba(200,220,230,0.85)'; c.fillRect(-r * 0.8, -r * 0.5, r * 0.6, r); c.fillStyle = '#1a1a1a'; for (let i = 0; i < 10; i++) c.fillRect(-r * 0.6 + i * r * 0.04, -r * 0.12, r * (i % 3 ? 0.015 : 0.03), r * 0.24); c.restore();
  c.strokeStyle = '#52e07c'; c.lineWidth = r * 0.03; for (let i = 0; i < 8; i++) { let x = rng() * r * 0.4, y = (rng() - 0.5) * r, a = rng() * TAU; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { a += (rng() - 0.5) * 1.2; x += Math.cos(a) * r * 0.12; y += Math.sin(a) * r * 0.12; c.lineTo(x, y); } c.stroke(); }
  ell(c, r * 0.7, 0, r * 0.32, r * 0.3); c.fillStyle = rg(c, r * 0.7, 0, r * 0.32, shade(sk, 0.3), shade(sk, -0.4)); c.fill();
  c.fillStyle = '#e8e8e0'; c.font = `bold ${r * 0.12}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.save(); c.translate(r * 0.6, 0); c.rotate(Math.PI / 2); c.fillText('HC-1 · 000', 0, 0); c.restore();
  eyes(c, r * 0.85, 0, r * 0.12, r * 0.05, '82,224,124');
};
return { draw(id, c, r, t, lim) { LIM = lim; B[id](c, r, t); LIM = 1e9; } };
})();
