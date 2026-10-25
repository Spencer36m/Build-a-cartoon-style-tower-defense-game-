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
