'use strict';
// ============================================================
// Animated main menu backdrop: a burning city skyline with zombies shambling along the
// horizon, rising embers, drifting fog, sweeping searchlights, bats and the odd lightning strike.
// ============================================================
const MenuFX = (() => {
  let cv = null, c = null, w = 0, h = 0, dpr = 1, running = false, last = 0, t = 0;
  let skyline = [], zombies = [], embers = [], bats = [], fires = [], flash = 0, boltT = 6, bolt = null, batT = 3;
  const still = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    build();
  }
  // a ruined skyline of towers, broken roofs and dead trees, with fires burning in some windows
  function build() {
    const rng = mulberry32(99);
    skyline = []; fires = [];
    let x = -20;
    while (x < w + 40) {
      const bw = 30 + rng() * 70, bh = h * (0.07 + rng() * 0.16), kind = rng();
      skyline.push({ x, w: bw, h: bh, kind, broken: rng() < 0.5, cut: rng() });
      if (rng() < 0.45) fires.push({ x: x + bw * (0.2 + rng() * 0.6), y: h - bh * (0.3 + rng() * 0.6), s: 4 + rng() * 6, seed: rng() * 10 });
      x += bw + rng() * 12;
    }
    zombies = [];
    for (let i = 0; i < 7; i++) zombies.push({ x: rng() * w, dir: rng() < 0.5 ? 1 : -1, speed: 10 + rng() * 14, size: 0.8 + rng() * 0.5, ph: rng() * 10, lean: rng() * 0.3 });
    embers = [];
    for (let i = 0; i < 60; i++) embers.push(newEmber(rng() * h));
  }
  function newEmber(y) {
    const src = fires.length ? fires[Math.floor(Math.random() * fires.length)] : { x: Math.random() * w, y: h };
    return { x: src.x + (Math.random() - 0.5) * 30, y: y != null ? y : src.y, vy: -(15 + Math.random() * 30), vx: (Math.random() - 0.5) * 12, life: 2 + Math.random() * 4, r: 0.8 + Math.random() * 1.6 };
  }

  function zombie(z, base) {
    const s = z.size * clamp(h / 520, 0.75, 1.3) * 14, step = Math.sin(t * z.speed * 0.25 + z.ph);
    c.save(); c.translate(z.x, base); c.scale(z.dir, 1);
    c.fillStyle = '#07090b';
    // legs
    c.lineWidth = s * 0.28; c.lineCap = 'round'; c.strokeStyle = '#07090b';
    c.beginPath(); c.moveTo(0, -s * 1.5); c.lineTo(step * s * 0.4, 0); c.moveTo(0, -s * 1.5); c.lineTo(-step * s * 0.4, 0); c.stroke();
    // body leaning forward
    c.save(); c.translate(0, -s * 1.5); c.rotate(0.15 + z.lean + Math.sin(t * 2 + z.ph) * 0.04);
    c.beginPath(); c.ellipse(0, -s * 0.8, s * 0.38, s * 0.85, 0, 0, TAU); c.fill();
    c.beginPath(); c.arc(s * 0.15, -s * 1.85, s * 0.33, 0, TAU); c.fill();
    // arms stretched out in front
    c.lineWidth = s * 0.2;
    c.beginPath(); c.moveTo(s * 0.1, -s * 1.3); c.lineTo(s * 1.05, -s * (1.25 + Math.sin(t * 3 + z.ph) * 0.08)); c.stroke();
    c.beginPath(); c.moveTo(0, -s * 1.15); c.lineTo(s * 0.95, -s * (1.05 + Math.cos(t * 3 + z.ph) * 0.08)); c.stroke();
    c.restore();
    c.restore();
  }

  function draw(dt) {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    // moon behind passing clouds
    const mx = w * 0.82, my = h * 0.2, mr = Math.min(w, h) * 0.07;
    let g = c.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4);
    g.addColorStop(0, 'rgba(255,220,190,0.18)'); g.addColorStop(1, 'rgba(255,220,190,0)');
    c.fillStyle = g; c.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    g = c.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0, mx, my, mr);
    g.addColorStop(0, '#f6e7d2'); g.addColorStop(1, '#b89a80');
    c.fillStyle = g; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
    // soft clouds built from overlapping puffs
    for (let i = 0; i < 4; i++) {
      const cx2 = ((t * (8 + i * 3) + i * w * 0.31) % (w + 500)) - 250, cy2 = h * (0.12 + i * 0.07);
      for (let k = 0; k < 5; k++) {
        const px = cx2 + (k - 2) * 55, py = cy2 + Math.sin(k * 1.7 + i) * 8, pr = 50 + ((k * 37 + i * 11) % 30);
        g = c.createRadialGradient(px, py, 0, px, py, pr);
        g.addColorStop(0, 'rgba(18,16,20,0.5)'); g.addColorStop(1, 'rgba(18,16,20,0)');
        c.fillStyle = g; c.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      }
    }
    // searchlights sweeping the sky
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const [bx, sp, ph] of [[w * 0.18, 0.35, 0], [w * 0.7, 0.27, 2]]) {
      const a = -Math.PI / 2 + Math.sin(t * sp + ph) * 0.55, len = h * 1.1;
      const ex = bx + Math.cos(a) * len, ey = h + Math.sin(a) * len, sx = Math.cos(a + Math.PI / 2) * 60, sy = Math.sin(a + Math.PI / 2) * 60;
      g = c.createLinearGradient(bx, h, ex, ey);
      g.addColorStop(0, 'rgba(255,240,200,0.12)'); g.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(bx - 4, h); c.lineTo(ex - sx, ey - sy); c.lineTo(ex + sx, ey + sy); c.lineTo(bx + 4, h); c.closePath(); c.fill();
    }
    c.restore();
    // lightning
    boltT -= dt;
    if (boltT <= 0) {
      boltT = 7 + Math.random() * 9; flash = 1;
      const pts = [[w * (0.2 + Math.random() * 0.6), 0]];
      while (pts[pts.length - 1][1] < h * 0.6) { const [px, py] = pts[pts.length - 1]; pts.push([px + (Math.random() - 0.5) * 60, py + 20 + Math.random() * 30]); }
      bolt = { pts, life: 0.25 };
      if (typeof Sound !== 'undefined') Sound.play('thunder');
    }
    if (bolt) {
      bolt.life -= dt;
      c.save(); c.globalAlpha = Math.max(0, bolt.life / 0.25); c.strokeStyle = '#e8f0ff'; c.lineWidth = 2; c.shadowColor = '#9ab8ff'; c.shadowBlur = 12;
      c.beginPath(); bolt.pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke(); c.restore();
      if (bolt.life <= 0) bolt = null;
    }
    if (flash > 0) { c.fillStyle = `rgba(200,215,255,${flash * 0.35})`; c.fillRect(0, 0, w, h); flash = Math.max(0, flash - dt * 3); }
    // bats crossing the sky
    batT -= dt;
    if (batT <= 0) { batT = 5 + Math.random() * 7; const n = 3 + Math.floor(Math.random() * 4), y0 = h * (0.15 + Math.random() * 0.3); for (let i = 0; i < n; i++) bats.push({ x: -30 - i * 25, y: y0 + (Math.random() - 0.5) * 50, v: 70 + Math.random() * 40, ph: Math.random() * 6 }); }
    c.strokeStyle = '#0a0c0e'; c.lineWidth = 1.6; c.lineJoin = 'round';
    for (const b of bats) {
      b.x += b.v * dt; const fl = Math.sin(t * 16 + b.ph) * 4, yy = b.y + Math.sin(t * 3 + b.ph) * 6;
      c.beginPath(); c.moveTo(b.x - 6, yy + fl); c.lineTo(b.x, yy); c.lineTo(b.x + 6, yy + fl); c.stroke();
    }
    bats = bats.filter((b) => b.x < w + 40);
    // fire glow along the horizon
    g = c.createLinearGradient(0, h * 0.55, 0, h);
    g.addColorStop(0, 'rgba(200,70,30,0)'); g.addColorStop(1, `rgba(220,90,40,${0.32 + Math.sin(t * 1.7) * 0.05})`);
    c.fillStyle = g; c.fillRect(0, h * 0.55, w, h * 0.45);
    // skyline
    c.fillStyle = '#0b0d10';
    for (const b of skyline) {
      const top = h - b.h;
      c.beginPath(); c.moveTo(b.x, h); c.lineTo(b.x, top);
      if (b.broken) { c.lineTo(b.x + b.w * 0.3, top); c.lineTo(b.x + b.w * 0.45, top + b.h * 0.12 * b.cut + 8); c.lineTo(b.x + b.w * 0.6, top + 4); }
      c.lineTo(b.x + b.w, top + (b.kind < 0.2 ? b.h * 0.15 : 0)); c.lineTo(b.x + b.w, h); c.closePath(); c.fill();
      if (b.kind > 0.85) { c.fillRect(b.x + b.w * 0.45, top - 18, 2, 18); }
    }
    // burning windows
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const f of fires) {
      const fl = 0.7 + Math.sin(t * 9 + f.seed) * 0.2 + Math.sin(t * 13 + f.seed * 2) * 0.1;
      g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.s * 4);
      g.addColorStop(0, `rgba(255,200,110,${0.9 * fl})`); g.addColorStop(0.3, `rgba(255,110,40,${0.5 * fl})`); g.addColorStop(1, 'rgba(255,80,20,0)');
      c.fillStyle = g; c.fillRect(f.x - f.s * 4, f.y - f.s * 4, f.s * 8, f.s * 8);
    }
    // embers drifting up
    for (const e of embers) {
      e.life -= dt; e.x += (e.vx + Math.sin(t * 2 + e.y * 0.05) * 8) * dt; e.y += e.vy * dt;
      c.fillStyle = `rgba(255,${150 + Math.floor(Math.random() * 60)},70,${Math.min(1, e.life)})`;
      c.beginPath(); c.arc(e.x, e.y, e.r, 0, TAU); c.fill();
    }
    c.restore();
    for (let i = 0; i < embers.length; i++) if (embers[i].life <= 0 || embers[i].y < -10) embers[i] = newEmber();
    // smoky firelight along the street, so the horde stands out against it
    g = c.createLinearGradient(0, h - h * 0.16, 0, h);
    g.addColorStop(0, 'rgba(230,110,50,0)'); g.addColorStop(0.6, `rgba(230,110,50,${0.42 + Math.sin(t * 2.1) * 0.05})`); g.addColorStop(1, 'rgba(120,50,30,0.5)');
    c.fillStyle = g; c.fillRect(0, h - h * 0.16, w, h * 0.16);
    // the horde on the street
    const base = h - 4;
    for (const z of zombies) {
      z.x += z.dir * z.speed * dt;
      if (z.x > w + 40) z.x = -40; if (z.x < -40) z.x = w + 40;
      zombie(z, base);
    }
    // ground fog
    for (let i = 0; i < 5; i++) {
      const fx = ((t * (10 + i * 4) + i * 260) % (w + 600)) - 300, fy = h - 20 - i * 10;
      g = c.createRadialGradient(fx, fy, 0, fx, fy, 260);
      g.addColorStop(0, 'rgba(150,150,160,0.12)'); g.addColorStop(1, 'rgba(150,150,160,0)');
      c.fillStyle = g; c.fillRect(fx - 260, fy - 260, 520, 520);
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now; t += dt;
    draw(dt);
    requestAnimationFrame(frame);
  }

  return {
    init(canvas) {
      cv = canvas; c = cv.getContext('2d');
      new ResizeObserver(() => { if (running) resize(); }).observe(cv);
    },
    start() {
      if (!cv || running) return;
      resize();
      if (still()) { draw(0); return; }
      running = true; last = performance.now(); requestAnimationFrame(frame);
    },
    stop() { running = false; },
  };
})();

// ============================================================
// Level select backdrops: an animated scene for each world behind the mission map.
// ============================================================
const LevelFX = (() => {
  let cv = null, c = null, w = 0, h = 0, dpr = 1, running = false, last = 0, t = 0, world = 0;
  let parts = [], props = null;
  const still = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SKIES = [
    [[0, '#2a2140'], [0.45, '#8a3f3a'], [0.75, '#e0864a'], [1, '#f2c070']],
    [[0, '#07080f'], [0.6, '#1c1a33'], [1, '#3a2f4a']],
    [[0, '#081424'], [0.55, '#1c3550'], [1, '#6d8aa0']],
    [[0, '#0c140e'], [0.5, '#24331f'], [1, '#5a6a3a']],
    [[0, '#3a1a2a'], [0.4, '#a0402a'], [0.72, '#f0904a'], [1, '#ffd890']],
  ];

  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    build();
  }
  function build() {
    const rng = mulberry32(17 + world * 101);
    parts = [];
    const n = world === 2 ? 120 : world === 3 ? 40 : world === 4 ? 60 : world === 1 ? 14 : 10;
    for (let i = 0; i < n; i++) parts.push({ x: rng() * w, y: rng() * h, s: 0.5 + rng(), ph: rng() * TAU });
    props = { rng: Array.from({ length: 80 }, () => rng()) };
  }
  const hills = (y0, amp, col, seed, freq = 0.006) => {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w + 20; x += 20) c.lineTo(x, y0 - (Math.sin(x * freq + seed) * 0.6 + Math.sin(x * freq * 2.3 + seed * 2) * 0.4) * amp);
    c.lineTo(w, h); c.closePath(); c.fill();
  };
  const glowAt = (x, y, r, col, a) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
  const R = (i) => props.rng[i % props.rng.length];

  function farmland() {
    glowAt(w * 0.72, h * 0.62, Math.min(w, h) * 0.5, '255,190,110', 0.5);
    c.fillStyle = '#ffd58a'; c.beginPath(); c.arc(w * 0.72, h * 0.62, Math.min(w, h) * 0.07, 0, TAU); c.fill();
    hills(h * 0.7, 30, '#5a3a3a', 1);
    hills(h * 0.78, 24, '#3a2a26', 4);
    // barn, silo and windmill
    const bx = w * 0.16, by = h * 0.8;
    c.fillStyle = '#1e1614';
    c.fillRect(bx, by - 46, 70, 46); c.beginPath(); c.moveTo(bx - 6, by - 46); c.lineTo(bx + 35, by - 76); c.lineTo(bx + 76, by - 46); c.fill();
    c.fillRect(bx + 80, by - 90, 24, 90); c.beginPath(); c.arc(bx + 92, by - 90, 12, Math.PI, TAU); c.fill();
    const mx = w * 0.88, my = h * 0.78;
    c.beginPath(); c.moveTo(mx - 8, my); c.lineTo(mx - 3, my - 80); c.lineTo(mx + 3, my - 80); c.lineTo(mx + 8, my); c.fill();
    c.save(); c.translate(mx, my - 80); c.rotate(t * 0.6);
    for (let i = 0; i < 4; i++) { c.rotate(TAU / 4); c.fillRect(-2, 0, 4, 46); c.fillRect(-7, 14, 10, 30); }
    c.restore();
    // corn rows
    c.strokeStyle = '#2a2018'; c.lineWidth = 2;
    for (let x = 0; x < w; x += 9) { const sw = Math.sin(t * 1.5 + x * 0.05) * 3; c.beginPath(); c.moveTo(x, h); c.lineTo(x + sw, h - 30 - R(x) * 16); c.stroke(); }
    // crows
    c.strokeStyle = '#1a1210'; c.lineWidth = 1.6;
    for (const p of parts) { const x = (p.x + t * 25 * p.s) % (w + 60) - 30, y = h * 0.2 + p.y * 0.25 + Math.sin(t + p.ph) * 10, f = Math.sin(t * 9 + p.ph) * 4; c.beginPath(); c.moveTo(x - 6, y + f); c.lineTo(x, y); c.lineTo(x + 6, y + f); c.stroke(); }
  }
  function cemetery() {
    glowAt(w * 0.78, h * 0.22, Math.min(w, h) * 0.4, '200,210,255', 0.25);
    c.fillStyle = '#e6e8f0'; c.beginPath(); c.arc(w * 0.78, h * 0.22, Math.min(w, h) * 0.08, 0, TAU); c.fill();
    hills(h * 0.72, 16, '#141320', 2);
    // dead trees
    c.strokeStyle = '#0c0b12'; c.lineCap = 'round';
    const tree = (x, y, s) => {
      const br = (x0, y0, a, len, d) => { if (d > 4) return; const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len; c.lineWidth = Math.max(1, 6 - d * 1.4) * s; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); br(x1, y1, a - 0.5 + R(d * 7 + x) * 0.2, len * 0.7, d + 1); br(x1, y1, a + 0.45, len * 0.65, d + 1); };
      br(x, y, -Math.PI / 2, 60 * s, 0);
    };
    tree(w * 0.1, h * 0.8, 1.1); tree(w * 0.9, h * 0.78, 0.9);
    // mausoleum and tombstones
    c.fillStyle = '#0e0d16';
    const mx = w * 0.5, my = h * 0.78;
    c.fillRect(mx - 40, my - 50, 80, 50); c.beginPath(); c.moveTo(mx - 48, my - 50); c.lineTo(mx, my - 78); c.lineTo(mx + 48, my - 50); c.fill();
    for (let i = 0; i < 14; i++) {
      const x = (i / 14) * w + R(i) * 30, y = h * (0.84 + R(i + 20) * 0.1);
      if (i % 3 === 0) { c.fillRect(x - 2, y - 26, 4, 26); c.fillRect(x - 9, y - 19, 18, 4); }
      else { c.beginPath(); c.moveTo(x - 9, y); c.lineTo(x - 9, y - 16); c.arc(x, y - 16, 9, Math.PI, TAU); c.lineTo(x + 9, y); c.fill(); }
    }
    // ghost lights and bats
    for (const p of parts) {
      const x = p.x + Math.sin(t * 0.4 + p.ph) * 30, y = h * 0.65 + p.y * 0.3 + Math.sin(t * 0.9 + p.ph) * 8;
      glowAt(x, y, 14 * p.s, '150,230,200', 0.35 + Math.sin(t * 3 + p.ph) * 0.15);
    }
    c.strokeStyle = '#05050a'; c.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { const x = (t * 60 + i * 140) % (w + 80) - 40, y = h * 0.3 + Math.sin(t * 2 + i) * 20, f = Math.sin(t * 15 + i) * 4; c.beginPath(); c.moveTo(x - 6, y + f); c.lineTo(x, y); c.lineTo(x + 6, y + f); c.stroke(); }
    // rolling fog
    for (let i = 0; i < 6; i++) glowAt(((t * 14 + i * 230) % (w + 400)) - 200, h * 0.86, 220, '150,150,180', 0.12);
  }
  function tundra() {
    // northern lights
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const [y0, col] of [[0.18, '80,255,170'], [0.26, '170,110,255']]) {
      for (let x = 0; x < w; x += 4) {
        const y = h * y0 + Math.sin(x * 0.008 + t * 0.6) * 24, len = 40 + Math.sin(x * 0.03 + t * 1.8) * 25;
        const g = c.createLinearGradient(x, y, x, y + len); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},0.12)`); g.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = g; c.fillRect(x, y, 4, len);
      }
    }
    c.restore();
    // mountains with snowy peaks
    const peaks = (y0, amp, col, snow, seed) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, h);
      const pts = [];
      for (let x = 0; x <= w + 60; x += 60) { const y = y0 - amp * (0.4 + R(x / 60 + seed) * 0.6); pts.push([x, y]); c.lineTo(x, y); }
      c.lineTo(w, h); c.closePath(); c.fill();
      c.fillStyle = snow;
      for (let i = 0; i < pts.length - 1; i++) { const [x, y] = pts[i]; if (y > y0 - amp * 0.7) continue; c.beginPath(); c.moveTo(x - 14, y + 18); c.lineTo(x, y); c.lineTo(x + 14, y + 18); c.fill(); }
    };
    peaks(h * 0.62, h * 0.3, '#2c4258', 'rgba(230,240,250,0.8)', 3);
    peaks(h * 0.74, h * 0.2, '#1c2c3c', 'rgba(220,235,245,0.7)', 9);
    // snowy ground with pines and a lit cabin
    c.fillStyle = '#d8e4ec'; c.fillRect(0, h * 0.86, w, h * 0.14);
    c.fillStyle = '#0e1a20';
    for (let i = 0; i < 16; i++) { const x = (i / 16) * w + R(i) * 20, s = 0.7 + R(i + 9) * 0.6, y = h * 0.88; c.beginPath(); c.moveTo(x, y - 60 * s); c.lineTo(x + 16 * s, y); c.lineTo(x - 16 * s, y); c.fill(); }
    const cx2 = w * 0.62, cy2 = h * 0.88;
    c.fillRect(cx2, cy2 - 30, 50, 30); c.beginPath(); c.moveTo(cx2 - 6, cy2 - 30); c.lineTo(cx2 + 25, cy2 - 50); c.lineTo(cx2 + 56, cy2 - 30); c.fill();
    c.fillStyle = `rgba(255,200,110,${0.8 + Math.sin(t * 7) * 0.1})`; c.fillRect(cx2 + 10, cy2 - 22, 9, 9);
    glowAt(cx2 + 14, cy2 - 18, 40, '255,190,110', 0.3);
    // snowfall
    c.fillStyle = 'rgba(255,255,255,0.85)';
    for (const p of parts) { const y = (p.y + t * 30 * p.s) % h, x = (p.x + Math.sin(t + p.ph) * 20 + w) % w; c.beginPath(); c.arc(x, y, 1.3 * p.s, 0, TAU); c.fill(); }
  }
  function bayou() {
    glowAt(w * 0.3, h * 0.45, Math.min(w, h) * 0.5, '200,220,120', 0.2);
    hills(h * 0.66, 12, '#1a2416', 5);
    // dark water with reflections
    c.fillStyle = '#0e1612'; c.fillRect(0, h * 0.74, w, h * 0.26);
    c.strokeStyle = 'rgba(160,190,120,0.15)'; c.lineWidth = 1;
    for (let i = 0; i < 12; i++) { const y = h * (0.77 + i * 0.02), x = (i * 97 + t * 10) % w; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 60, y); c.stroke(); }
    // cypress trees with hanging moss
    const cypress = (x, s) => {
      const base = h * 0.76;
      c.fillStyle = '#0a100a';
      c.beginPath(); c.moveTo(x - 18 * s, base); c.quadraticCurveTo(x - 5 * s, base - 40 * s, x - 4 * s, base - 150 * s); c.lineTo(x + 4 * s, base - 150 * s); c.quadraticCurveTo(x + 5 * s, base - 40 * s, x + 18 * s, base); c.fill();
      for (const [dx, dy, r] of [[0, -160, 40], [-36, -140, 28], [34, -138, 30]]) { c.beginPath(); c.ellipse(x + dx * s, base + dy * s, r * s, r * 0.45 * s, 0, 0, TAU); c.fill(); }
      c.strokeStyle = 'rgba(80,100,60,0.7)'; c.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) { const mx = x + (i - 4) * 9 * s, my = base - 140 * s, len = (20 + R(i + x) * 30) * s, sw = Math.sin(t * 1.2 + i) * 3; c.beginPath(); c.moveTo(mx, my); c.quadraticCurveTo(mx + sw, my + len * 0.5, mx + sw * 0.5, my + len); c.stroke(); }
    };
    cypress(w * 0.12, 1); cypress(w * 0.86, 0.85); cypress(w * 0.45, 0.6);
    // shack on stilts
    c.fillStyle = '#0c120c';
    const sx = w * 0.64, sy = h * 0.7;
    c.fillRect(sx, sy - 34, 60, 34); c.beginPath(); c.moveTo(sx - 6, sy - 34); c.lineTo(sx + 30, sy - 54); c.lineTo(sx + 66, sy - 34); c.fill();
    for (const px of [4, 26, 52]) c.fillRect(sx + px, sy, 3, h * 0.08);
    c.fillStyle = `rgba(255,200,110,${0.7 + Math.sin(t * 5) * 0.2})`; c.fillRect(sx + 22, sy - 26, 10, 9);
    // fireflies
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const p of parts) { const x = p.x + Math.sin(t * 0.5 + p.ph) * 40, y = h * 0.45 + p.y * 0.4 + Math.cos(t * 0.7 + p.ph) * 20, a = Math.max(0, Math.sin(t * 2 + p.ph)); glowAt(x, y, 8, '220,255,120', 0.7 * a); }
    c.restore();
    for (let i = 0; i < 5; i++) glowAt(((t * 10 + i * 260) % (w + 400)) - 200, h * 0.78, 240, '140,160,110', 0.12);
  }

  function desert() {
    // a huge low sun behind the heat shimmer, red mesas, dunes, a pumpjack nodding and vultures circling
    const sx = w * 0.62, sy = h * 0.58, sr = Math.min(w, h) * 0.11;
    glowAt(sx, sy, Math.min(w, h) * 0.6, '255,170,90', 0.45);
    c.fillStyle = '#ffe2a0'; c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.fill();
    c.fillStyle = 'rgba(160,60,40,0.25)'; for (let i = 0; i < 4; i++) c.fillRect(sx - sr, sy - sr * 0.2 + i * sr * 0.28 + Math.sin(t * 2 + i) * 2, sr * 2, 2);
    const mesa = (x, y, mw, mh, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x - mw * 0.7, y); c.lineTo(x - mw * 0.5, y - mh * 0.85); c.lineTo(x - mw * 0.42, y - mh); c.lineTo(x + mw * 0.4, y - mh); c.lineTo(x + mw * 0.5, y - mh * 0.8); c.lineTo(x + mw * 0.7, y); c.fill(); };
    mesa(w * 0.18, h * 0.7, w * 0.22, h * 0.18, '#7a2e22'); mesa(w * 0.86, h * 0.68, w * 0.16, h * 0.14, '#6a2a20'); mesa(w * 0.45, h * 0.7, w * 0.1, h * 0.08, '#8a3a26');
    hills(h * 0.76, 18, '#a0502a', 2, 0.004);
    hills(h * 0.84, 22, '#6a3018', 5, 0.005);
    // the pumpjack, a cactus and a camel caravan on the ridge
    c.fillStyle = '#1e0e0a';
    const px = w * 0.3, py = h * 0.86, nod = Math.sin(t * 1.4) * 0.25;
    c.beginPath(); c.moveTo(px - 12, py); c.lineTo(px, py - 40); c.lineTo(px + 12, py); c.fill();
    c.save(); c.translate(px, py - 40); c.rotate(nod); c.fillRect(-36, -3, 64, 6); c.beginPath(); c.moveTo(28, -6); c.quadraticCurveTo(40, -2, 34, 14); c.lineTo(26, 6); c.fill(); c.restore();
    c.fillRect(px + 32, py - 30, 3, 30);
    const cx = w * 0.78, cy = h * 0.88;
    c.fillRect(cx - 4, cy - 60, 9, 60); c.fillRect(cx - 22, cy - 34, 18, 7); c.fillRect(cx - 22, cy - 50, 7, 22); c.fillRect(cx + 5, cy - 42, 16, 7); c.fillRect(cx + 15, cy - 58, 7, 22);
    for (let i = 0; i < 3; i++) {
      const x = ((t * 8 + i * 40) % (w + 200)) - 100, y = h * 0.76 - 2;
      c.beginPath(); c.ellipse(x, y - 14, 12, 6, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(x - 2, y - 20, 6, 5, 0, 0, TAU); c.fill();
      c.fillRect(x + 8, y - 26, 3, 14); c.fillRect(x + 8, y - 28, 8, 4);
      for (const lx of [-8, -4, 4, 8]) c.fillRect(x + lx, y - 10, 2, 10 + Math.sin(t * 4 + i + lx) * 1.5);
    }
    // vultures wheeling high up
    c.strokeStyle = '#2a120c'; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const a = t * 0.4 + i * 1.6, x = w * 0.5 + Math.cos(a) * w * 0.18, y = h * 0.22 + Math.sin(a) * h * 0.06, f = Math.sin(t * 3 + i) * 2; c.beginPath(); c.moveTo(x - 10, y + f); c.quadraticCurveTo(x - 4, y - 3, x, y); c.quadraticCurveTo(x + 4, y - 3, x + 10, y + f); c.stroke(); }
    // blowing sand
    c.fillStyle = 'rgba(255,220,160,0.5)';
    for (const p of parts) { const x = (p.x + t * 90 * p.s) % (w + 40) - 20, y = h * 0.7 + p.y * 0.3 + Math.sin(t * 2 + p.ph) * 4; c.fillRect(x, y, 3 * p.s, 1); }
  }

  function draw() {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, h);
    for (const [k, col] of SKIES[world] || SKIES[0]) g.addColorStop(k, col);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    [farmland, cemetery, tundra, bayou, desert][world]();
    // darken the middle so the mission map stays readable
    const v = c.createRadialGradient(w * 0.4, h * 0.55, h * 0.1, w * 0.4, h * 0.55, w * 0.7);
    v.addColorStop(0, 'rgba(6,8,10,0.45)'); v.addColorStop(1, 'rgba(6,8,10,0.2)');
    c.fillStyle = v; c.fillRect(0, 0, w, h);
  }
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now; t += dt;
    draw();
    requestAnimationFrame(frame);
  }
  return {
    init(canvas) { cv = canvas; c = cv.getContext('2d'); new ResizeObserver(() => { if (cv.offsetParent) { resize(); if (!running) draw(); } }).observe(cv); },
    start(wi) {
      world = wi; resize();
      if (still()) { draw(); return; }
      if (running) return;
      running = true; last = performance.now(); requestAnimationFrame(frame);
    },
    stop() { running = false; },
  };
})();
