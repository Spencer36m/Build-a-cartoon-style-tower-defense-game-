'use strict';
// ============================================================
// Zombie art. Each zombie type is painted in detail once into a set of animation frames
// (8 per walk or flap cycle), then the game just rotates and stamps those frames.
// Sprites face +x (right). Lighting is kept roughly overhead so rotation never looks wrong.
// ============================================================
const ZART = (() => {
  const RES = 3;          // sprite pixels per game pixel
  const FRAMES = 8;
  const cache = new Map();

  // ---------- painting helpers ----------
  const P = {
    blood: '#5c0f0b', bloodDark: '#2c0604', flesh: '#8b3f36', bone: '#e2dac6', boneDark: '#9b917a',
    ink: 'rgba(12,10,8,0.55)', edge: 'rgba(0,0,0,0.42)',
  };
  function g2(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([k, v]) => g.addColorStop(k, v)); return g; }
  function rg(c, x, y, r, a, b, ox = 0, oy = 0) { const g = c.createRadialGradient(x + ox * r, y + oy * r, r * 0.05, x, y, r); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function blob(c, x, y, r, rng, n = 9, jag = 0.35, sy = 1) {
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU, k = 1 - jag / 2 + rng() * jag;
      const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k * sy;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
  }
  // Tapered limb with cylinder shading across its width.
  function limb(c, x1, y1, x2, y2, w1, w2, col, edge = true) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    c.beginPath();
    c.moveTo(x1 + nx * w1, y1 + ny * w1);
    c.lineTo(x2 + nx * w2, y2 + ny * w2);
    c.arc(x2, y2, w2, Math.atan2(ny, nx), Math.atan2(-ny, -nx));
    c.lineTo(x1 - nx * w1, y1 - ny * w1);
    c.arc(x1, y1, w1, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
    c.closePath();
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, w = Math.max(w1, w2);
    c.fillStyle = g2(c, mx + nx * w, my + ny * w, mx - nx * w, my - ny * w,
      [[0, shade(col, -0.45)], [0.35, shade(col, 0.08)], [0.6, col], [1, shade(col, -0.5)]]);
    c.fill();
    if (edge) { c.strokeStyle = P.edge; c.lineWidth = 0.35; c.stroke(); }
  }
  function speckle(c, rng, x, y, rx, ry, n, cols, size = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, d = Math.sqrt(rng());
      c.fillStyle = cols[Math.floor(rng() * cols.length)];
      c.fillRect(x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, size * (0.5 + rng()), size * (0.5 + rng()));
    }
  }
  function stain(c, rng, x, y, r) {
    blob(c, x, y, r, rng, 11, 0.6); c.fillStyle = rgba(P.blood, 0.85); c.fill();
    blob(c, x - r * 0.1, y, r * 0.55, rng, 9, 0.5); c.fillStyle = rgba(P.bloodDark, 0.8); c.fill();
    // drips run backward, away from the direction of travel
    c.strokeStyle = rgba(P.blood, 0.8); c.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      c.lineWidth = r * (0.12 + rng() * 0.1);
      const sy = y + (rng() - 0.5) * r;
      c.beginPath(); c.moveTo(x - r * 0.5, sy); c.lineTo(x - r * (1.1 + rng()), sy + (rng() - 0.5) * r * 0.4); c.stroke();
    }
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(x + r * 0.2, y - r * 0.2, r * 0.12, 0, TAU); c.fill();
  }
  function wound(c, rng, x, y, r) {
    blob(c, x, y, r, rng, 10, 0.5); c.fillStyle = P.flesh; c.fill();
    blob(c, x, y, r * 0.55, rng, 8, 0.5); c.fillStyle = '#4a1712'; c.fill();
    if (rng() < 0.5) { c.fillStyle = P.bone; c.fillRect(x - r * 0.3, y - r * 0.08, r * 0.6, r * 0.16); }
  }
  function folds(c, rng, x0, x1, y0, y1, col, n = 5) {
    c.strokeStyle = shade(col, -0.35); c.globalAlpha = 0.55; c.lineWidth = 0.5;
    for (let i = 0; i < n; i++) {
      const y = lerp(y0, y1, rng()), x = lerp(x0, x1, rng() * 0.6);
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (x1 - x0) * 0.2, y + (rng() - 0.5) * 2, x + (x1 - x0) * 0.35, y + (rng() - 0.5) * 3); c.stroke();
    }
    c.strokeStyle = shade(col, 0.25); c.globalAlpha = 0.3;
    for (let i = 0; i < n - 2; i++) {
      const y = lerp(y0, y1, rng()), x = lerp(x0, x1, rng() * 0.6);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (x1 - x0) * 0.25, y + (rng() - 0.5) * 2); c.stroke();
    }
    c.globalAlpha = 1;
  }
  function veins(c, rng, x, y, len, ang, col = 'rgba(70,30,60,0.55)') {
    c.strokeStyle = col; c.lineWidth = 0.3;
    let px = x, py = y, a = ang;
    c.beginPath(); c.moveTo(px, py);
    for (let i = 0; i < 4; i++) { a += (rng() - 0.5) * 1.2; px += Math.cos(a) * len / 4; py += Math.sin(a) * len / 4; c.lineTo(px, py); }
    c.stroke();
  }
  function hand(c, x, y, ang, s, skin, claws = true) {
    c.save(); c.translate(x, y); c.rotate(ang);
    for (let i = 0; i < 4; i++) {
      const fa = -0.42 + i * 0.28, fl = s * (1.15 + (i === 1 || i === 2 ? 0.2 : 0));
      const fx = Math.cos(fa) * s * 0.55, fy = Math.sin(fa) * s * 0.55;
      limb(c, fx, fy, fx + Math.cos(fa * 0.6) * fl, fy + Math.sin(fa * 0.6) * fl, s * 0.2, s * 0.15, skin, false);
      if (claws) { c.fillStyle = '#2a2420'; c.beginPath(); c.arc(fx + Math.cos(fa * 0.6) * fl, fy + Math.sin(fa * 0.6) * fl, s * 0.12, 0, TAU); c.fill(); }
    }
    limb(c, 0, s * 0.55, s * 0.55, s * 0.95, s * 0.2, s * 0.15, skin, false);
    c.beginPath(); c.ellipse(0, 0, s * 0.72, s * 0.62, 0, 0, TAU);
    c.fillStyle = rg(c, 0, 0, s * 0.72, shade(skin, 0.12), shade(skin, -0.3)); c.fill();
    c.restore();
  }

  // ---------- humans ----------
  // Shoulders seen from above: a stadium with a slightly rounded chest and back.
  function torsoPath(c, td, sw) {
    const e = Math.max(0, sw - td);
    c.beginPath();
    c.moveTo(td, -e);
    c.quadraticCurveTo(td * 1.18, 0, td, e);
    c.arc(0, e, td, 0, Math.PI);
    c.quadraticCurveTo(-td * 1.12, 0, -td, -e);
    c.arc(0, -e, td, Math.PI, TAU);
    c.closePath();
  }

  function drawShirt(c, s, rng, td, sw, r) {
    const col = s.shirt;
    torsoPath(c, td, sw);
    c.fillStyle = rg(c, 0, 0, Math.max(td, sw) * 1.15, shade(col, 0.14), shade(col, -0.45));
    c.fill();
    c.save(); torsoPath(c, td, sw); c.clip();
    switch (s.pattern) {
      case 'plaid': {
        const st = r * 0.22;
        c.globalAlpha = 0.35;
        for (let y = -sw; y < sw; y += st) { c.fillStyle = shade(col, -0.45); c.fillRect(-td, y, td * 2, st * 0.35); }
        for (let x = -td; x < td; x += st) { c.fillStyle = shade(col, -0.45); c.fillRect(x, -sw, st * 0.35, sw * 2); }
        c.globalAlpha = 0.22;
        for (let y = -sw + st * 0.6; y < sw; y += st) { c.fillStyle = s.plaid2 || '#d8d0b8'; c.fillRect(-td, y, td * 2, st * 0.08); }
        c.globalAlpha = 1;
        break;
      }
      case 'stripe':
        c.globalAlpha = 0.3; c.fillStyle = s.stripe || '#e8e2d0';
        for (let y = -sw; y < sw; y += r * 0.2) c.fillRect(-td, y, td * 2, r * 0.07);
        c.globalAlpha = 1; break;
      case 'hivis':
        c.fillStyle = rg(c, 0, 0, sw, '#d9e04a', '#8a9420'); c.fillRect(-td, -sw, td * 2, sw * 2);
        c.fillStyle = '#c9cdd0'; c.fillRect(-td, -sw * 0.62, td * 2, r * 0.1); c.fillRect(-td, sw * 0.52, td * 2, r * 0.1);
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-td, -sw * 0.6, td * 2, r * 0.03); c.fillRect(-td, sw * 0.54, td * 2, r * 0.03);
        break;
      case 'overalls':
        c.fillStyle = rg(c, 0, 0, sw, '#4f6b8a', '#24364a'); c.fillRect(-td * 0.9, -sw * 0.45, td * 1.8, sw * 0.9);
        c.fillStyle = '#2d4059';
        for (const y of [-sw * 0.38, sw * 0.38]) { c.fillRect(-td, y - r * 0.06, td * 2, r * 0.12); }
        c.fillStyle = '#c9a24a'; for (const y of [-sw * 0.38, sw * 0.38]) { c.beginPath(); c.arc(td * 0.55, y, r * 0.06, 0, TAU); c.fill(); }
        break;
      case 'armor': {
        c.fillStyle = g2(c, -td, -sw, td, sw, [[0, '#3a3f45'], [0.5, '#1b1e22'], [1, '#2a2e33']]); c.fillRect(-td, -sw * 0.7, td * 2, sw * 1.4);
        c.fillStyle = '#d8d8d0'; c.fillRect(-td * 0.75, -sw * 0.08, td * 1.4, r * 0.12);
        c.fillStyle = '#121416';
        for (const y of [-sw * 0.45, sw * 0.32]) for (const x of [-td * 0.5, td * 0.2]) { c.fillRect(x, y, td * 0.35, r * 0.18); }
        c.fillStyle = '#6b7078'; for (const [x, y] of [[-td * 0.7, -sw * 0.6], [td * 0.6, -sw * 0.6], [-td * 0.7, sw * 0.6], [td * 0.6, sw * 0.6]]) { c.beginPath(); c.arc(x, y, r * 0.04, 0, TAU); c.fill(); }
        if (s.label) { c.save(); c.translate(-td * 0.45, 0); c.rotate(Math.PI / 2); c.fillStyle = '#e8e4d8'; c.font = `800 ${r * 0.17}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s.label, 0, 0, sw * 1.4); c.restore(); }
        break;
      }
      case 'suit':
        // a dark jacket: a white collar round the neck, lapel creases, and the tie flapping out in front
        c.fillStyle = '#e8e4da'; c.beginPath(); c.ellipse(td * 0.5, 0, r * 0.38, r * 0.36, 0, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.6;
        c.beginPath(); c.moveTo(td * 0.1, -sw * 0.45); c.lineTo(td, -sw * 0.15); c.moveTo(td * 0.1, sw * 0.45); c.lineTo(td, sw * 0.15); c.stroke();
        c.restore();
        c.fillStyle = s.tie || '#a82a2a'; c.beginPath(); c.moveTo(td * 0.8, -r * 0.05); c.lineTo(td * 1.45, -r * 0.02 + (rng() - 0.5) * r * 0.1); c.lineTo(td * 0.8, r * 0.05); c.closePath(); c.fill();
        c.save(); torsoPath(c, td, sw); c.clip();
        break;
      case 'coat':
        c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.6;
        c.beginPath(); c.moveTo(td * 0.1, -sw * 0.2); c.lineTo(td, -sw * 0.05); c.moveTo(td * 0.1, sw * 0.2); c.lineTo(td, sw * 0.05); c.stroke();
        c.fillStyle = '#2a2420'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(td * (0.3 + i * 0.22), sw * 0.12, r * 0.035, 0, TAU); c.fill(); }
        break;
      case 'robe':
        c.strokeStyle = shade(col, -0.5); c.lineWidth = 0.6;
        for (let i = 0; i < 6; i++) { const y = -sw + (i + 0.5) * (sw * 2) / 6; c.beginPath(); c.moveTo(td * 0.6, y * 0.4); c.lineTo(-td, y * 1.1); c.stroke(); }
        if (s.trim) { c.strokeStyle = s.trim; c.lineWidth = r * 0.06; torsoPath(c, td * 0.96, sw * 0.96); c.stroke(); }
        break;
      case 'bare': {
        // muscle shading: spine groove, shoulder blades, trapezius
        c.strokeStyle = 'rgba(30,20,15,0.45)'; c.lineWidth = r * 0.07;
        c.beginPath(); c.moveTo(-td, 0); c.lineTo(td * 0.4, 0); c.stroke();
        for (const sy of [-1, 1]) {
          c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(-td * 0.25, sy * sw * 0.45, td * 0.55, sw * 0.28, sy * 0.3, 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.1)'; c.beginPath(); c.ellipse(td * 0.25, sy * sw * 0.35, td * 0.45, sw * 0.25, 0, 0, TAU); c.fill();
        }
        // stitched scars
        c.strokeStyle = '#3a2420'; c.lineWidth = r * 0.04;
        const sx = -td * 0.6, sy0 = -sw * 0.7;
        c.beginPath(); c.moveTo(sx, sy0); c.lineTo(td * 0.3, sw * 0.4); c.stroke();
        c.lineWidth = r * 0.025;
        for (let i = 0; i < 6; i++) { const k = i / 5, x = lerp(sx, td * 0.3, k), y = lerp(sy0, sw * 0.4, k); c.beginPath(); c.moveTo(x - r * 0.06, y + r * 0.06); c.lineTo(x + r * 0.06, y - r * 0.06); c.stroke(); }
        break;
      }
      case 'scrap': {
        for (let i = 0; i < 7; i++) {
          const x = -td + rng() * td * 1.6, y = -sw + rng() * sw * 1.6, w = td * (0.5 + rng() * 0.5), h = sw * (0.4 + rng() * 0.4);
          c.save(); c.translate(x + w / 2, y + h / 2); c.rotate((rng() - 0.5) * 0.4);
          const metal = ['#6a6460', '#7d6a55', '#5a5d60'][i % 3];
          c.fillStyle = g2(c, -w / 2, -h / 2, w / 2, h / 2, [[0, shade(metal, 0.2)], [1, shade(metal, -0.4)]]); c.fillRect(-w / 2, -h / 2, w, h);
          c.fillStyle = 'rgba(140,70,30,0.45)'; c.beginPath(); c.ellipse((rng() - 0.5) * w * 0.5, (rng() - 0.5) * h * 0.5, w * 0.3, h * 0.25, 0, 0, TAU); c.fill();
          c.fillStyle = '#2a2826'; for (const [px, py] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.beginPath(); c.arc(px * w * 0.38, py * h * 0.36, r * 0.035, 0, TAU); c.fill(); }
          c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.4; c.strokeRect(-w / 2, -h / 2, w, h);
          c.restore();
        }
        // chain across the chest
        c.strokeStyle = '#8a8a86'; c.lineWidth = r * 0.05;
        for (let i = 0; i < 8; i++) { const k = i / 7; c.beginPath(); c.ellipse(lerp(-td * 0.8, td * 0.8, k), lerp(-sw * 0.8, sw * 0.8, k), r * 0.07, r * 0.045, 0.8, 0, TAU); c.stroke(); }
        break;
      }
      case 'fur':
        for (let i = 0; i < 120; i++) {
          const x = -td + rng() * td * 2, y = -sw + rng() * sw * 2;
          c.strokeStyle = rng() < 0.5 ? 'rgba(255,255,255,0.45)' : 'rgba(150,170,185,0.4)'; c.lineWidth = 0.4;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x - r * 0.12, y + (rng() - 0.5) * r * 0.1); c.stroke();
        }
        break;
    }
    folds(c, rng, -td, td, -sw * 0.9, sw * 0.9, col, 6);
    speckle(c, rng, 0, 0, td, sw, 60, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.07)', 'rgba(60,40,20,0.15)'], r * 0.05);
    // tears showing skin or ribs underneath
    for (let i = 0; i < (s.tears ?? 2); i++) {
      const x = (rng() - 0.6) * td * 1.4, y = (rng() - 0.5) * sw * 1.4, tr = r * (0.12 + rng() * 0.14);
      blob(c, x, y, tr, rng, 8, 0.7, 0.7); c.fillStyle = shade(s.skin, -0.25); c.fill();
      if (rng() < 0.6) { blob(c, x, y, tr * 0.6, rng, 7, 0.5, 0.7); c.fillStyle = P.flesh; c.fill(); }
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.35; blob(c, x, y, tr, rng, 8, 0.7, 0.7); c.stroke();
    }
    for (let i = 0; i < (s.stains ?? 2); i++) stain(c, rng, (rng() - 0.4) * td * 1.2, (rng() - 0.5) * sw * 1.3, r * (0.12 + rng() * 0.16));
    c.restore();
    torsoPath(c, td, sw); c.strokeStyle = P.edge; c.lineWidth = 0.5; c.stroke();
  }

  function drawHair(c, s, rng, hx, hr) {
    const col = s.hair;
    if (s.hairStyle === 'bald') {
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.arc(hx - hr * 0.2, 0, hr * 0.85, Math.PI * 0.6, Math.PI * 1.4); c.fill();
      return;
    }
    const cover = s.hairStyle === 'long' ? 1.12 : 1;
    c.save();
    c.beginPath(); c.arc(hx - hr * 0.08, 0, hr * cover, Math.PI * 0.5, Math.PI * 1.5); c.closePath();
    c.fillStyle = rg(c, hx - hr * 0.3, 0, hr * cover, shade(col, 0.15), shade(col, -0.4)); c.fill();
    c.restore();
    // fine, low-contrast strands combed back from the crown, a few stray ones longer
    const n = s.hairStyle === 'long' ? 60 : 36;
    c.save();
    c.beginPath(); c.arc(hx - hr * 0.08, 0, hr * cover * (s.hairStyle === 'long' ? 1.25 : 1.02), Math.PI * 0.45, Math.PI * 1.55); c.closePath(); c.clip();
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.55 + rng() * 0.9), d = hr * (0.15 + rng() * 0.8);
      const x = hx + Math.cos(a) * d * 0.5, y = Math.sin(a) * d * 0.95;
      const len = hr * (0.2 + rng() * 0.3);
      c.strokeStyle = rng() < 0.35 ? rgba(shade(col, 0.3), 0.5) : rgba(shade(col, -0.3), 0.5); c.lineWidth = 0.22;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - len * 0.5, y + (rng() - 0.5) * len * 0.3, x - len, y + (rng() - 0.5) * len * 0.5); c.stroke();
    }
    c.restore();
    if (s.hairStyle === 'long') {
      c.strokeStyle = rgba(shade(col, -0.2), 0.7); c.lineWidth = 0.3;
      for (let i = 0; i < 10; i++) { const y = (rng() - 0.5) * hr * 1.8; c.beginPath(); c.moveTo(hx - hr * 0.6, y); c.quadraticCurveTo(hx - hr * 1.1, y * 1.1, hx - hr * (1.3 + rng() * 0.4), y * 1.2); c.stroke(); }
    }
    if (s.patchy) { blob(c, hx - hr * 0.2, hr * 0.3 * (rng() < 0.5 ? 1 : -1), hr * 0.3, rng, 8, 0.5); c.fillStyle = shade(s.skin, -0.05); c.fill(); }
  }

  function drawHead(c, s, rng, hx, hr, r) {
    // contact shadow where the head sits on the shoulders
    c.fillStyle = rg(c, hx - hr * 0.1, 0, hr * 1.55, 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0)'); c.beginPath(); c.arc(hx - hr * 0.1, 0, hr * 1.55, 0, TAU); c.fill();
    // ears
    for (const sy of [-1, 1]) { c.beginPath(); c.ellipse(hx - hr * 0.05, sy * hr * 0.95, hr * 0.22, hr * 0.13, 0, 0, TAU); c.fillStyle = shade(s.skin, -0.2); c.fill(); }
    c.beginPath(); c.ellipse(hx, 0, hr * 1.02, hr * 0.94, 0, 0, TAU);
    c.fillStyle = rg(c, hx + hr * 0.1, 0, hr * 1.05, shade(s.skin, 0.18), shade(s.skin, -0.42)); c.fill();
    // face sliver at the front: brow, sunken eyes, nose
    c.fillStyle = rg(c, hx + hr * 0.75, 0, hr * 0.6, 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0)'); c.beginPath(); c.ellipse(hx + hr * 0.75, 0, hr * 0.28, hr * 0.62, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.13)'; c.beginPath(); c.ellipse(hx + hr * 0.25, -hr * 0.1, hr * 0.42, hr * 0.32, 0, 0, TAU); c.fill();
    for (const sy of [-1, 1]) {
      c.fillStyle = '#1c1410'; c.beginPath(); c.ellipse(hx + hr * 0.8, sy * hr * 0.33, hr * 0.13, hr * 0.15, 0, 0, TAU); c.fill();
      c.fillStyle = s.eye || '#d9d7b0'; c.beginPath(); c.arc(hx + hr * 0.84, sy * hr * 0.33, hr * 0.07, 0, TAU); c.fill();
    }
    c.fillStyle = shade(s.skin, -0.1); c.beginPath(); c.ellipse(hx + hr * 1.0, 0, hr * 0.14, hr * 0.12, 0, 0, TAU); c.fill();
    speckle(c, rng, hx, 0, hr * 0.8, hr * 0.8, 18, ['rgba(70,40,50,0.25)', 'rgba(40,50,20,0.2)'], r * 0.04);
    for (let i = 0; i < 2; i++) veins(c, rng, hx + (rng() - 0.5) * hr, (rng() - 0.5) * hr, hr * 0.8, rng() * TAU);
    if (s.scalpWound) wound(c, rng, hx - hr * 0.1, hr * 0.35, hr * 0.28);
  }

  function drawGear(c, s, rng, hx, hr, r, ph) {
    switch (s.gear) {
      case 'cone': {
        c.save(); c.translate(hx, 0); c.rotate(0.15);
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-hr * 1.1 + 0.8, -hr * 1.1 + 0.8, hr * 2.2, hr * 2.2);
        c.fillStyle = g2(c, -hr, -hr, hr, hr, [[0, '#e07a34'], [1, '#9a4018']]); c.fillRect(-hr * 1.1, -hr * 1.1, hr * 2.2, hr * 2.2);
        c.beginPath(); c.arc(0, 0, hr * 0.95, 0, TAU); c.fillStyle = rg(c, 0, 0, hr * 0.95, '#f08a3c', '#b8501c', -0.2, -0.2); c.fill();
        c.beginPath(); c.arc(0, 0, hr * 0.62, 0, TAU); c.lineWidth = hr * 0.16; c.strokeStyle = 'rgba(225,222,212,0.9)'; c.stroke();
        c.beginPath(); c.arc(0, 0, hr * 0.3, 0, TAU); c.fillStyle = '#c85a1c'; c.fill();
        c.beginPath(); c.arc(0, 0, hr * 0.14, 0, TAU); c.fillStyle = '#2a1a10'; c.fill();
        speckle(c, rng, 0, 0, hr * 1.1, hr * 1.1, 30, ['rgba(60,40,20,0.35)', 'rgba(0,0,0,0.25)'], r * 0.05);
        c.restore();
        break;
      }
      case 'hardhat': {
        c.beginPath(); c.ellipse(hx, 0, hr * 1.35, hr * 1.22, 0, 0, TAU); c.fillStyle = g2(c, hx, -hr, hx, hr, [[0, '#d9b22a'], [1, '#8a6a10']]); c.fill();
        c.beginPath(); c.ellipse(hx - hr * 0.05, 0, hr * 1.0, hr * 0.92, 0, 0, TAU); c.fillStyle = rg(c, hx - hr * 0.2, 0, hr, '#ffe066', '#b08a18', -0.3, -0.2); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(hx - hr * 0.9, -hr * 0.12, hr * 1.8, hr * 0.24);
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(hx - hr * 0.35, -hr * 0.4, hr * 0.3, hr * 0.15, -0.4, 0, TAU); c.fill();
        c.fillStyle = '#333'; c.fillRect(hx + hr * 1.0, -hr * 0.22, hr * 0.32, hr * 0.44);
        c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(hx + hr * 1.3, 0, hr * 0.16, 0, TAU); c.fill();
        speckle(c, rng, hx, 0, hr, hr, 30, ['rgba(60,40,20,0.4)'], r * 0.05);
        break;
      }
      case 'riot': {
        c.beginPath(); c.ellipse(hx, 0, hr * 1.22, hr * 1.15, 0, 0, TAU);
        c.fillStyle = rg(c, hx - hr * 0.3, -hr * 0.2, hr * 1.25, '#5b616a', '#0f1114', -0.2, -0.3); c.fill();
        c.save(); c.beginPath(); c.ellipse(hx, 0, hr * 1.18, hr * 1.1, 0, -1.0, 1.0); c.lineTo(hx, 0); c.closePath(); c.clip();
        c.fillStyle = g2(c, hx, -hr, hx + hr, hr, [[0, 'rgba(120,150,175,0.75)'], [1, 'rgba(40,60,80,0.75)']]); c.fillRect(hx, -hr * 1.3, hr * 1.4, hr * 2.6);
        c.restore();
        c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.ellipse(hx - hr * 0.35, -hr * 0.45, hr * 0.35, hr * 0.16, -0.5, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(hx - hr * 0.6, hr * 0.3); c.lineTo(hx + hr * 0.2, hr * 0.7); c.stroke();
        break;
      }
      case 'wolf': {
        // the head of a wolf where a face should be: a long snout, ears laid back, a ruff of fur
        for (let i = 0; i < 10; i++) { const a = Math.PI * (0.55 + i * 0.1); c.beginPath(); c.moveTo(hx + Math.cos(a) * hr * 0.6, Math.sin(a) * hr * 0.6); c.lineTo(hx + Math.cos(a) * hr * 1.35, Math.sin(a) * hr * 1.3); c.lineTo(hx + Math.cos(a + 0.12) * hr * 0.7, Math.sin(a + 0.12) * hr * 0.7); c.fillStyle = shade(s.fur || '#6a6a78', -0.2); c.fill(); }
        c.beginPath(); c.ellipse(hx, 0, hr * 1.05, hr * 0.95, 0, 0, TAU); c.fillStyle = rg(c, hx - hr * 0.2, -hr * 0.2, hr * 1.1, shade(s.fur || '#6a6a78', 0.3), shade(s.fur || '#6a6a78', -0.4)); c.fill();
        c.beginPath(); c.ellipse(hx + hr * 0.95, 0, hr * 0.6, hr * 0.38, 0, 0, TAU); c.fillStyle = shade(s.fur || '#6a6a78', 0.05); c.fill();
        c.fillStyle = '#1a1414'; c.beginPath(); c.ellipse(hx + hr * 1.5, 0, hr * 0.13, hr * 0.16, 0, 0, TAU); c.fill();
        for (const sy of [-1, 1]) {
          c.beginPath(); c.moveTo(hx - hr * 0.2, sy * hr * 0.5); c.lineTo(hx - hr * 0.95, sy * hr * 0.9); c.lineTo(hx - hr * 0.1, sy * hr * 0.85); c.fillStyle = shade(s.fur || '#6a6a78', -0.35); c.fill();
          c.fillStyle = '#ffe060'; c.beginPath(); c.arc(hx + hr * 0.55, sy * hr * 0.33, hr * 0.1, 0, TAU); c.fill();
        }
        break;
      }
      case 'sailor': {
        // a sailor's knit watch cap, sodden and hung with weed
        c.beginPath(); c.ellipse(hx - hr * 0.1, 0, hr * 1.02, hr * 0.98, 0, 0, TAU); c.fillStyle = rg(c, hx - hr * 0.35, -hr * 0.3, hr * 1.1, '#3e5070', '#141c2c'); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = hr * 0.06; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(hx - hr * 0.9, i * hr * 0.25); c.lineTo(hx + hr * 0.6, i * hr * 0.25); c.stroke(); }
        c.beginPath(); c.ellipse(hx + hr * 0.55, 0, hr * 0.22, hr * 0.85, 0, 0, TAU); c.fillStyle = '#26344e'; c.fill();
        c.fillStyle = 'rgba(60,110,50,0.7)'; blob(c, hx - hr * 0.4, hr * 0.3, hr * 0.3, rng, 7, 0.6); c.fill();
        break;
      }
      case 'hood': {
        c.beginPath(); c.ellipse(hx - hr * 0.15, 0, hr * 1.35, hr * 1.25, 0, 0, TAU);
        c.fillStyle = rg(c, hx - hr * 0.3, 0, hr * 1.4, shade(s.shirt, 0.15), shade(s.shirt, -0.55)); c.fill();
        c.strokeStyle = shade(s.shirt, -0.6); c.lineWidth = 0.5;
        for (let i = 0; i < 5; i++) { const a = Math.PI * (0.65 + i * 0.17); c.beginPath(); c.moveTo(hx - hr * 0.1, 0); c.lineTo(hx + Math.cos(a) * hr * 1.3, Math.sin(a) * hr * 1.2); c.stroke(); }
        c.save(); c.beginPath(); c.ellipse(hx + hr * 0.45, 0, hr * 0.75, hr * 0.8, 0, -1.3, 1.3); c.closePath();
        c.fillStyle = '#060508'; c.fill(); c.restore();
        for (const sy of [-1, 1]) { c.fillStyle = s.eyeGlow || '#a4ff7a'; c.beginPath(); c.arc(hx + hr * 0.85, sy * hr * 0.25, hr * 0.08, 0, TAU); c.fill(); }
        if (s.crown) {
          for (let i = 0; i < 9; i++) {
            const a = (i / 9) * TAU, x = hx - hr * 0.1 + Math.cos(a) * hr * 0.9, y = Math.sin(a) * hr * 0.85;
            c.save(); c.translate(x, y); c.rotate(a);
            c.beginPath(); c.moveTo(0, -hr * 0.1); c.lineTo(hr * 0.35, 0); c.lineTo(0, hr * 0.1); c.closePath();
            c.fillStyle = g2(c, 0, 0, hr * 0.35, 0, [[0, P.boneDark], [1, P.bone]]); c.fill(); c.restore();
          }
        }
        break;
      }
      case 'plague': {
        c.beginPath(); c.moveTo(hx + hr * 0.6, -hr * 0.3); c.quadraticCurveTo(hx + hr * 2.4, -hr * 0.05, hx + hr * 2.6, 0); c.quadraticCurveTo(hx + hr * 2.4, hr * 0.05, hx + hr * 0.6, hr * 0.3); c.closePath();
        c.fillStyle = g2(c, hx, -hr * 0.3, hx, hr * 0.3, [[0, '#cbbd9c'], [0.5, '#9a8a6a'], [1, '#6a5c44']]); c.fill();
        c.beginPath(); c.ellipse(hx - hr * 0.05, 0, hr * 1.9, hr * 1.8, 0, 0, TAU);
        c.fillStyle = rg(c, hx - hr * 0.2, 0, hr * 1.9, '#3a302a', '#120e0b', -0.2, -0.2); c.fill();
        c.beginPath(); c.ellipse(hx - hr * 0.05, 0, hr * 1.05, hr * 1.0, 0, 0, TAU);
        c.fillStyle = rg(c, hx - hr * 0.2, 0, hr, '#4a3e36', '#1a1410'); c.fill();
        c.strokeStyle = '#6a2a24'; c.lineWidth = hr * 0.18; c.beginPath(); c.ellipse(hx - hr * 0.05, 0, hr * 1.1, hr * 1.05, 0, 0, TAU); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 0.4;
        for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(hx - hr * 0.05, 0, hr * (1.2 + i * 0.12), -2, -0.8); c.stroke(); }
        break;
      }
      case 'welder': {
        c.beginPath(); c.ellipse(hx, 0, hr * 1.2, hr * 1.12, 0, 0, TAU);
        c.fillStyle = rg(c, hx - hr * 0.2, 0, hr * 1.2, '#4a4844', '#151412', -0.2, -0.2); c.fill();
        c.fillStyle = '#0a0a0a'; c.fillRect(hx + hr * 0.55, -hr * 0.55, hr * 0.5, hr * 1.1);
        c.fillStyle = 'rgba(220,120,40,0.5)'; c.fillRect(hx + hr * 0.62, -hr * 0.45, hr * 0.12, hr * 0.9);
        speckle(c, rng, hx, 0, hr, hr, 40, ['rgba(150,80,30,0.45)', 'rgba(0,0,0,0.3)'], r * 0.05);
        break;
      }
      case 'straw': {
        c.beginPath(); c.arc(hx, 0, hr * 2.0, 0, TAU);
        c.fillStyle = rg(c, hx - hr * 0.3, 0, hr * 2, '#d6bd78', '#7a6430', -0.15, -0.15); c.fill();
        c.strokeStyle = 'rgba(90,70,30,0.45)'; c.lineWidth = 0.35;
        for (let k = 0.3; k < 2; k += 0.18) { c.beginPath(); c.arc(hx, 0, hr * k, 0, TAU); c.stroke(); }
        for (let i = 0; i < 40; i++) { const a = rng() * TAU, d = hr * (0.4 + rng() * 1.6); c.beginPath(); c.moveTo(hx + Math.cos(a) * d, Math.sin(a) * d); c.lineTo(hx + Math.cos(a) * (d + hr * 0.2), Math.sin(a + 0.05) * (d + hr * 0.2)); c.stroke(); }
        c.fillStyle = '#5a3a20'; c.beginPath(); c.arc(hx, 0, hr * 1.02, 0, TAU); c.lineWidth = hr * 0.16; c.strokeStyle = '#6a2a1e'; c.stroke();
        c.beginPath(); blob(c, hx + hr * 1.5, hr * 0.6, hr * 0.35, rng, 8, 0.6); c.fillStyle = 'rgba(30,20,10,0.6)'; c.fill();
        break;
      }
      case 'ice': {
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU + rng() * 0.3, d = hr * (0.4 + rng() * 0.5);
          c.save(); c.translate(hx + Math.cos(a) * d, Math.sin(a) * d); c.rotate(a);
          c.beginPath(); c.moveTo(-hr * 0.12, -hr * 0.12); c.lineTo(hr * (0.4 + rng() * 0.3), 0); c.lineTo(-hr * 0.12, hr * 0.12); c.closePath();
          c.fillStyle = g2(c, 0, 0, hr * 0.6, 0, [[0, 'rgba(170,210,235,0.95)'], [1, 'rgba(240,250,255,0.95)']]); c.fill();
          c.restore();
        }
        break;
      }
    }
  }

  function drawProp(c, s, rng, r, td, sw, ph) {
    if (s.staff) {
      const hx = td + r * 0.75, hy = sw * 0.6;
      c.strokeStyle = '#2e2218'; c.lineWidth = r * 0.12; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-td * 1.2, hy + r * 0.15); c.lineTo(hx + r * 0.7, hy - r * 0.05); c.stroke();
      c.strokeStyle = '#5a4430'; c.lineWidth = r * 0.06; c.stroke();
      // skull and orb at the head of the staff
      const ox = hx + r * 0.8, oy = hy - r * 0.06;
      c.beginPath(); c.ellipse(ox, oy, r * 0.22, r * 0.2, 0, 0, TAU); c.fillStyle = rg(c, ox, oy, r * 0.22, P.bone, P.boneDark); c.fill();
      for (const sy of [-1, 1]) { c.fillStyle = '#1a1410'; c.beginPath(); c.arc(ox + r * 0.1, oy + sy * r * 0.08, r * 0.05, 0, TAU); c.fill(); }
      c.beginPath(); c.arc(ox + r * 0.3, oy, r * 0.13, 0, TAU); c.fillStyle = rg(c, ox + r * 0.3, oy, r * 0.13, '#eaffd0', '#5ccf3a'); c.fill();
    }
    if (s.scythe) {
      const hx = td + r * 0.7, hy = -sw * 0.55;
      c.strokeStyle = '#4a3420'; c.lineWidth = r * 0.1; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-td * 1.5, hy + r * 0.4); c.lineTo(hx + r * 0.9, hy - r * 0.1); c.stroke();
      c.strokeStyle = '#7a5a38'; c.lineWidth = r * 0.04; c.stroke();
      c.beginPath(); c.moveTo(hx + r * 0.85, hy - r * 0.1);
      c.quadraticCurveTo(hx + r * 1.6, hy + r * 0.2, hx + r * 1.7, hy + r * 1.3);
      c.quadraticCurveTo(hx + r * 1.2, hy + r * 0.45, hx + r * 0.75, hy + r * 0.05); c.closePath();
      c.fillStyle = g2(c, hx + r, hy, hx + r * 1.7, hy + r * 1.2, [[0, '#9aa0a6'], [0.5, '#e4e8ea'], [1, '#6a6e72']]); c.fill();
      c.fillStyle = 'rgba(90,15,10,0.6)'; c.beginPath(); c.ellipse(hx + r * 1.45, hy + r * 0.8, r * 0.12, r * 0.25, 0.4, 0, TAU); c.fill();
    }
    if (s.satchel) {
      c.save(); c.translate(-td * 0.2, sw * 1.0);
      c.fillStyle = g2(c, -r * 0.3, 0, r * 0.3, 0, [[0, '#5a3e28'], [1, '#2e1e12']]); c.fillRect(-r * 0.32, -r * 0.18, r * 0.64, r * 0.36);
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.4; c.strokeRect(-r * 0.32, -r * 0.18, r * 0.64, r * 0.36);
      c.restore();
      c.strokeStyle = '#3a2a1a'; c.lineWidth = r * 0.07; c.beginPath(); c.moveTo(-td * 0.6, -sw * 0.9); c.lineTo(td * 0.4, sw * 0.9); c.stroke();
    }
    if (s.backpack) {
      c.save(); c.translate(-td * 0.75, 0);
      c.beginPath(); c.ellipse(0, 0, td * 0.55, sw * 0.6, 0, 0, TAU);
      c.fillStyle = rg(c, 0, 0, sw * 0.6, shade(s.backpack, 0.15), shade(s.backpack, -0.45)); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.5; c.stroke();
      c.fillStyle = shade(s.backpack, -0.3); c.fillRect(-td * 0.2, -sw * 0.35, td * 0.4, sw * 0.7);
      c.restore();
    }
  }

  function drawPerson(c, r, s, ph, seed) {
    const rng = mulberry32(seed);
    const wide = s.wide || 1;
    const sw = r * 0.8 * wide, td = r * 0.46 * (s.depth || 1);
    const step = Math.sin(ph * TAU);
    const limp = s.limp ?? 0.55;
    const tilt = (mulberry32(seed + 1)() - 0.5) * 2; // which way this one slumps
    c.save();
    if (s.lean) c.translate(r * 0.08, 0);
    c.rotate(tilt * 0.06);
    // legs and shoes peek out ahead of and behind the body
    if (!s.robe) {
      for (const [side, st] of [[-1, step], [1, -step * limp - (1 - limp) * 0.4]]) {
        // one foot steps out in front of the shoulders, the other trails behind (the bad leg drags)
        const fy = side * r * 0.26 * wide;
        const fx = st * td * 1.35;
        const shoe = s.shoes || '#2a2420';
        limb(c, fx - r * 0.3, fy, fx, fy, r * 0.13 * wide, r * 0.12, s.pants);
        c.beginPath(); c.ellipse(fx + r * 0.1, fy, r * 0.22, r * 0.11, side * 0.08, 0, TAU);
        c.fillStyle = g2(c, fx, fy - r * 0.11, fx, fy + r * 0.11, [[0, shade(shoe, 0.3)], [0.5, shoe], [1, shade(shoe, -0.45)]]); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.ellipse(fx + r * 0.18, fy - r * 0.03, r * 0.08, r * 0.03, 0, 0, TAU); c.fill();
      }
    } else {
      // robe hem drags behind
      c.beginPath();
      c.moveTo(td * 0.3, -sw * 1.0);
      for (let i = 0; i <= 8; i++) { const k = i / 8; c.lineTo(-td * (1.9 + Math.sin((ph + k) * TAU) * 0.1) + (i % 2) * r * 0.18, lerp(-sw * 1.05, sw * 1.05, k)); }
      c.lineTo(td * 0.3, sw * 1.0); c.closePath();
      c.fillStyle = rg(c, -td, 0, sw * 1.3, shade(s.shirt, 0.05), shade(s.shirt, -0.55)); c.fill();
      c.strokeStyle = shade(s.shirt, -0.6); c.lineWidth = 0.5;
      for (let i = 0; i < 7; i++) { const y = lerp(-sw, sw, i / 6); c.beginPath(); c.moveTo(td * 0.2, y * 0.6); c.lineTo(-td * 1.8, y * 1.02); c.stroke(); }
    }
    if (s.coatTail) {
      c.beginPath(); c.moveTo(-td * 0.4, -sw * 0.95);
      c.lineTo(-td * 1.75, -sw * 0.8 + step * r * 0.05); c.lineTo(-td * 1.9, 0); c.lineTo(-td * 1.75, sw * 0.8 - step * r * 0.05); c.lineTo(-td * 0.4, sw * 0.95); c.closePath();
      c.fillStyle = rg(c, -td, 0, sw, shade(s.shirt, 0.05), shade(s.shirt, -0.5)); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 0.4; c.stroke();
    }
    // arms reach forward, out of step with the legs
    for (const side of [-1, 1]) {
      if (s.missingArm === side) {
        limb(c, td * 0.1, side * sw * 0.82, td * 0.5, side * sw * 0.95, r * 0.15, r * 0.12, s.sleeve === 'none' ? s.skin : s.shirt);
        c.fillStyle = P.flesh; c.beginPath(); c.arc(td * 0.55, side * sw * 0.95, r * 0.12, 0, TAU); c.fill();
        c.fillStyle = P.bone; c.beginPath(); c.arc(td * 0.6, side * sw * 0.95, r * 0.05, 0, TAU); c.fill();
        continue;
      }
      const sway = Math.sin((ph + (side > 0 ? 0.3 : 0)) * TAU) * r * 0.1;
      const reach = (s.reach || 1) * (side * tilt > 0 ? 0.82 : 1.06);
      const Sx = td * 0.12, Sy = side * (sw - td * 0.55);
      const Ex = td + r * 0.25 * reach, Ey = side * sw * 0.78;
      const Wx = td + r * 0.75 * reach + sway, Wy = side * sw * (0.5 + (s.armSpread || 0));
      const armW = r * 0.15 * (s.armThick || 1);
      const sleeveCol = s.sleeve === 'none' ? s.skin : s.shirt;
      // forearm first, then the sleeve over it so the joint hides under a ragged hem
      limb(c, lerp(Sx, Ex, 0.7), lerp(Sy, Ey, 0.7), Wx, Wy, armW * 0.85, armW * 0.7, s.skin);
      if (s.sleeve !== 'none') {
        const endK = s.sleeve === 'long' ? 0.55 : 0;
        const hx2 = s.sleeve === 'long' ? lerp(Ex, Wx, endK) : Ex, hy2 = s.sleeve === 'long' ? lerp(Ey, Wy, endK) : Ey;
        limb(c, Sx, Sy, Ex, Ey, armW * 1.15, armW, sleeveCol);
        if (s.sleeve === 'long') limb(c, Ex, Ey, hx2, hy2, armW, armW * 0.95, sleeveCol);
        blob(c, hx2, hy2, armW * 0.98, rng, 8, 0.22); c.fillStyle = shade(sleeveCol, -0.12); c.fill();
      } else limb(c, Sx, Sy, Ex, Ey, armW * 1.1, armW * 0.9, s.skin);
      veins(c, rng, Ex, Ey, r * 0.4, Math.atan2(Wy - Ey, Wx - Ex));
      if (rng() < 0.5) wound(c, rng, lerp(Ex, Wx, 0.6), lerp(Ey, Wy, 0.6), r * 0.07);
      if (s.icicles) for (let i = 0; i < 3; i++) {
        const k = 0.3 + i * 0.25, x = lerp(Ex, Wx, k), y = lerp(Ey, Wy, k);
        c.beginPath(); c.moveTo(x - r * 0.05, y); c.lineTo(x, y + side * r * 0.2); c.lineTo(x + r * 0.05, y); c.closePath(); c.fillStyle = 'rgba(225,245,255,0.9)'; c.fill();
      }
      hand(c, Wx, Wy, Math.atan2(Wy - Ey, Wx - Ex) * 0.4, r * 0.2 * (s.handScale || 1), s.skin);
    }
    drawShirt(c, s, rng, td, sw, r);
    for (const side of [-1, 1]) {
      if (s.missingArm === side) continue;
      // soft highlight where the shoulder rounds over the top of the arm
      const cx = td * 0.25, cy = side * (sw - td * 0.6), cr = r * 0.17 * (s.armThick || 1) ** 0.6;
      const col = s.sleeve === 'none' ? s.skin : s.shirt;
      const sh = rg(c, cx, cy, cr * 1.3, rgba(shade(col, 0.25), 0.7), rgba(col, 0));
      c.fillStyle = sh; c.beginPath(); c.ellipse(cx, cy, cr * 1.3, cr, 0, 0, TAU); c.fill();
    }
    if (s.backpack || s.satchel) drawProp(c, { backpack: s.backpack, satchel: s.satchel, skin: s.skin }, rng, r, td, sw, ph);
    const hr = r * 0.31 * (s.headScale || 1), hx = td * 0.5 + (s.lean ? r * 0.12 : 0);
    c.save();
    c.translate(0, tilt * r * 0.09); c.rotate(tilt * 0.12 + Math.sin(ph * TAU) * 0.04);
    drawHead(c, s, rng, hx, hr, r);
    if (!s.gear || s.gear === 'ice') drawHair(c, s, rng, hx, hr);
    drawGear(c, s, rng, hx, hr, r, ph);
    if (s.horns) for (const sy of [-1, 1]) {
      // a cultist's dragon-horn headdress over the hood
      c.beginPath(); c.moveTo(hx - hr * 0.1, sy * hr * 0.6); c.quadraticCurveTo(hx - hr * 0.9, sy * hr * 1.6, hx - hr * 1.7, sy * hr * 1.3);
      c.quadraticCurveTo(hx - hr * 0.8, sy * hr * 1.2, hx - hr * 0.35, sy * hr * 0.35); c.closePath();
      c.fillStyle = g2(c, hx, 0, hx - hr * 1.7, sy * hr * 1.3, [[0, '#3a1a10'], [1, '#d8c8a0']]); c.fill();
    }
    if (OUTFIT && (!s.gear || s.gear === 'ice')) drawOutfit(c, OUTFIT, hx, hr);
    c.restore();
    if (s.frost) {
      // rime crusted on the shoulders and back
      for (let i = 0; i < 34; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng());
        c.fillStyle = rng() < 0.6 ? 'rgba(240,250,255,0.75)' : 'rgba(190,225,245,0.6)';
        c.beginPath(); c.arc(Math.cos(a) * td * 1.2 * d, Math.sin(a) * sw * d, r * (0.015 + rng() * 0.03), 0, TAU); c.fill();
      }
      c.fillStyle = 'rgba(225,242,255,0.22)'; torsoPath(c, td * 0.9, sw * 0.9); c.fill();
    }
    if (s.char) drawChar(c, r, s, rng);
    if (s.crystals) drawCrystals(c, r, s, rng);
    if (s.runes) drawRunes(c, r, s, rng);
    if (s.burning) drawBurning(c, r, s, rng, ph);
    if (s.drowned) drawDrowned(c, r, s, rng);
    drawProp(c, { staff: s.staff, scythe: s.scythe }, rng, r, td, sw, ph);
    c.restore();
  }

  // ---------- skeleton ----------
  function drawSkeleton(c, r, s, ph, seed) {
    const rng = mulberry32(seed);
    const step = Math.sin(ph * TAU);
    const B = P.bone, BD = P.boneDark;
    for (const [side, st] of [[-1, step], [1, -step * 0.8]]) {
      const hy = side * r * 0.25, fx = -r * 0.1 + st * r * 0.65;
      limb(c, -r * 0.15, hy, fx, hy + side * r * 0.05, r * 0.07, r * 0.06, B);
      c.fillStyle = BD; c.beginPath(); c.ellipse(fx + r * 0.1, hy + side * r * 0.05, r * 0.16, r * 0.08, 0, 0, TAU); c.fill();
    }
    c.beginPath(); c.ellipse(-r * 0.2, 0, r * 0.2, r * 0.36, 0, 0, TAU); c.fillStyle = rg(c, -r * 0.2, 0, r * 0.36, B, BD); c.fill();
    // arms: humerus, forearm bones, finger bones
    for (const side of [-1, 1]) {
      const sway = Math.sin((ph + (side > 0 ? 0.3 : 0)) * TAU) * r * 0.1;
      const Sy = side * r * 0.62, Ex = r * 0.55, Ey = side * r * 0.6, Wx = r * 1.05 + sway, Wy = side * r * 0.42;
      limb(c, r * 0.05, Sy, Ex, Ey, r * 0.06, r * 0.05, B);
      c.fillStyle = B; c.beginPath(); c.arc(Ex, Ey, r * 0.07, 0, TAU); c.fill();
      limb(c, Ex, Ey - r * 0.03, Wx, Wy - r * 0.03, r * 0.03, r * 0.025, B);
      limb(c, Ex, Ey + r * 0.03, Wx, Wy + r * 0.03, r * 0.03, r * 0.025, BD);
      for (let i = 0; i < 4; i++) {
        const a = -0.4 + i * 0.27;
        c.strokeStyle = B; c.lineWidth = r * 0.03; c.lineCap = 'round';
        c.beginPath(); c.moveTo(Wx, Wy); c.lineTo(Wx + Math.cos(a) * r * 0.2, Wy + Math.sin(a) * r * 0.2); c.stroke();
      }
    }
    // spine, ribs, collarbones and shoulder blades
    c.strokeStyle = BD; c.lineWidth = r * 0.03;
    for (let i = 0; i < 5; i++) {
      const x = -r * 0.25 + i * r * 0.1;
      for (const side of [-1, 1]) {
        c.beginPath(); c.moveTo(x, 0);
        c.quadraticCurveTo(x + r * 0.05, side * r * 0.42, x - r * 0.12, side * r * (0.55 - Math.abs(i - 2) * 0.04));
        c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = r * 0.07; c.stroke();
        c.strokeStyle = i % 2 ? B : shade(B, -0.08); c.lineWidth = r * 0.045; c.stroke();
      }
    }
    for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(-r * 0.4 + i * r * 0.1, 0, r * 0.05, 0, TAU); c.fillStyle = i % 2 ? B : BD; c.fill(); }
    for (const side of [-1, 1]) {
      c.beginPath(); c.moveTo(r * 0.25, side * r * 0.08); c.quadraticCurveTo(r * 0.3, side * r * 0.4, r * 0.08, side * r * 0.62);
      c.strokeStyle = B; c.lineWidth = r * 0.05; c.stroke();
      c.beginPath(); c.moveTo(-r * 0.05, side * r * 0.25); c.lineTo(-r * 0.32, side * r * 0.45); c.lineTo(r * 0.02, side * r * 0.58); c.closePath();
      c.fillStyle = 'rgba(214,205,182,0.75)'; c.fill();
    }
    // rags on the shoulders
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      blob(c, -r * 0.05, side * r * 0.5, r * 0.2, rng, 8, 0.7, 0.8); c.fillStyle = rgba(s.rag || '#3a3428', 0.85); c.fill();
    }
    // skull: cranium, sutures, sockets, teeth
    const hx = r * 0.18, hr = r * 0.32;
    c.beginPath(); c.ellipse(hx, 0, hr * 1.05, hr * 0.92, 0, 0, TAU); c.fillStyle = rg(c, hx - hr * 0.2, 0, hr * 1.05, '#f2ecdc', '#8f8670', -0.2, 0); c.fill();
    c.strokeStyle = 'rgba(90,80,60,0.6)'; c.lineWidth = 0.3;
    c.beginPath(); c.moveTo(hx - hr * 0.9, 0); for (let i = 0; i < 8; i++) c.lineTo(hx - hr * 0.9 + i * hr * 0.2, (i % 2 ? 1 : -1) * hr * 0.06); c.stroke();
    c.beginPath(); c.moveTo(hx - hr * 0.1, -hr * 0.85); c.quadraticCurveTo(hx - hr * 0.2, 0, hx - hr * 0.1, hr * 0.85); c.stroke();
    for (const sy of [-1, 1]) { c.fillStyle = '#120e0a'; c.beginPath(); c.ellipse(hx + hr * 0.7, sy * hr * 0.32, hr * 0.2, hr * 0.18, 0, 0, TAU); c.fill(); c.fillStyle = '#d24a2a'; c.beginPath(); c.arc(hx + hr * 0.74, sy * hr * 0.32, hr * 0.05, 0, TAU); c.fill(); }
    c.fillStyle = '#e8e0cc'; for (let i = 0; i < 6; i++) c.fillRect(hx + hr * 0.95, -hr * 0.3 + i * hr * 0.11, hr * 0.1, hr * 0.08);
    speckle(c, rng, hx, 0, hr, hr, 14, ['rgba(80,60,40,0.3)'], r * 0.04);
  }

  // ---------- wraith ----------
  function drawWraith(c, r, s, ph, seed) {
    const rng = mulberry32(seed);
    for (let layer = 0; layer < 3; layer++) {
      const len = r * (2.1 - layer * 0.35), wid = r * (0.95 - layer * 0.15);
      c.beginPath(); c.moveTo(r * 0.5, -wid * 0.7);
      for (let i = 0; i <= 10; i++) {
        const k = i / 10, wave = Math.sin((ph * 2 + k * 2 + layer) * TAU) * r * 0.12;
        c.lineTo(-len * (0.7 + (i % 2) * 0.3) + wave, lerp(-wid, wid, k) + wave * 0.5);
      }
      c.lineTo(r * 0.5, wid * 0.7); c.closePath();
      const g = c.createLinearGradient(r * 0.5, 0, -len, 0);
      g.addColorStop(0, `rgba(${layer ? '120,135,150' : '70,80,95'},0.8)`); g.addColorStop(1, 'rgba(120,140,160,0)');
      c.fillStyle = g; c.fill();
    }
    // bony hands reaching from tattered sleeves
    for (const side of [-1, 1]) {
      const sway = Math.sin((ph + (side > 0 ? 0.25 : 0)) * TAU) * r * 0.12;
      const Wx = r * 1.05 + sway, Wy = side * r * 0.45;
      c.beginPath(); c.moveTo(r * 0.2, side * r * 0.55); c.lineTo(Wx - r * 0.25, Wy - r * 0.12); c.lineTo(Wx - r * 0.3, Wy + r * 0.12); c.closePath();
      c.fillStyle = 'rgba(90,100,115,0.75)'; c.fill();
      for (let i = 0; i < 4; i++) { const a = -0.35 + i * 0.24; c.strokeStyle = '#d8dfe4'; c.lineWidth = r * 0.04; c.lineCap = 'round'; c.beginPath(); c.moveTo(Wx - r * 0.2, Wy); c.lineTo(Wx - r * 0.2 + Math.cos(a) * r * 0.32, Wy + Math.sin(a) * r * 0.32); c.stroke(); }
    }
    // hood with a black void and pale eyes
    c.beginPath(); c.ellipse(r * 0.15, 0, r * 0.5, r * 0.46, 0, 0, TAU); c.fillStyle = rg(c, r * 0.05, 0, r * 0.5, 'rgba(95,105,120,0.95)', 'rgba(30,35,45,0.95)'); c.fill();
    c.beginPath(); c.ellipse(r * 0.35, 0, r * 0.28, r * 0.3, 0, -1.4, 1.4); c.closePath(); c.fillStyle = '#05070a'; c.fill();
    for (const sy of [-1, 1]) { c.fillStyle = '#cdf4ff'; c.beginPath(); c.arc(r * 0.52, sy * r * 0.1, r * 0.05, 0, TAU); c.fill(); }
    speckle(c, rng, -r * 0.4, 0, r * 1.2, r * 0.8, 40, ['rgba(200,220,235,0.25)'], r * 0.05);
  }

  // ---------- bloaters ----------
  function drawBloater(c, r, s, ph, seed) {
    const rng = mulberry32(seed);
    const step = Math.sin(ph * TAU);
    const skin = s.skin;
    for (const [side, st] of [[-1, step], [1, -step]]) {
      c.beginPath(); c.ellipse(-r * 0.15 + st * r * 0.25, side * r * 0.62, r * 0.22, r * 0.14, 0, 0, TAU); c.fillStyle = '#2a2420'; c.fill();
    }
    const R = r * 0.95;
    c.beginPath(); blob(c, -r * 0.05, 0, R, rng, 16, 0.08);
    c.fillStyle = rg(c, -r * 0.1, -r * 0.1, R * 1.05, shade(skin, 0.22), shade(skin, -0.5), -0.1, -0.1); c.fill();
    c.save(); blob(c, -r * 0.05, 0, R, mulberry32(seed), 16, 0.08); c.clip();
    // mottled bruising
    for (let i = 0; i < 10; i++) { blob(c, (rng() - 0.5) * R * 1.6, (rng() - 0.5) * R * 1.6, R * (0.15 + rng() * 0.25), rng, 9, 0.5); c.fillStyle = rng() < 0.5 ? 'rgba(90,60,90,0.22)' : 'rgba(150,150,60,0.22)'; c.fill(); }
    for (let i = 0; i < 9; i++) veins(c, rng, (rng() - 0.5) * R, (rng() - 0.5) * R, R * 0.9, rng() * TAU, 'rgba(60,25,55,0.6)');
    c.strokeStyle = 'rgba(230,220,190,0.25)'; c.lineWidth = 0.35;
    for (let i = 0; i < 12; i++) { const a = rng() * TAU, d = R * (0.5 + rng() * 0.4); c.beginPath(); c.arc(-r * 0.05, 0, d, a, a + 0.25); c.stroke(); }
    // shirt scraps stretched over the belly
    c.fillStyle = rgba(s.shirt || '#5a4a3a', 0.5);
    for (const sy of [-1, 1]) { blob(c, -R * 0.6, sy * R * 0.62, R * 0.24, rng, 9, 0.3); c.fill(); }
    c.restore();
    const pustules = s.huge ? 16 : 8;
    for (let i = 0; i < pustules; i++) {
      const a = rng() * TAU, d = R * Math.sqrt(rng()) * 0.85, pr = r * (0.035 + rng() * 0.055);
      const x = -r * 0.05 + Math.cos(a) * d, y = Math.sin(a) * d;
      c.beginPath(); c.arc(x, y, pr * 1.6, 0, TAU); c.fillStyle = 'rgba(120,45,40,0.45)'; c.fill();
      if (rng() < 0.3) { c.beginPath(); c.arc(x, y, pr * 0.8, 0, TAU); c.fillStyle = '#3a1a14'; c.fill(); continue; }
      c.beginPath(); c.arc(x, y, pr, 0, TAU); c.fillStyle = rg(c, x - pr * 0.3, y - pr * 0.3, pr, '#e8dcae', '#9a8a54'); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.arc(x - pr * 0.35, y - pr * 0.35, pr * 0.22, 0, TAU); c.fill();
    }
    if (s.huge) for (let i = 0; i < 3; i++) { const a = rng() * TAU; wound(c, rng, Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, r * 0.16); }
    // stubby arms and a small head pushed forward
    for (const side of [-1, 1]) {
      const sway = Math.sin((ph + (side > 0 ? 0.3 : 0)) * TAU) * r * 0.08;
      limb(c, R * 0.55, side * R * 0.6, R * 0.95 + sway, side * R * 0.55, r * 0.12, r * 0.1, skin);
      hand(c, R * 0.95 + sway, side * R * 0.55, 0, r * 0.14, skin);
    }
    const hx = R * 0.82, hr = r * 0.26;
    drawHead(c, { skin, eye: '#e8e0a0' }, rng, hx, hr, r);
    drawHair(c, { hair: '#3a3020', hairStyle: 'short', skin, patchy: true }, rng, hx, hr);
  }

  // ---------- crawler (legless) ----------
  function drawCrawler(c, r, s, ph, seed) {
    const rng = mulberry32(seed);
    const pull = Math.sin(ph * TAU);
    // blood smear and entrails dragging behind
    c.fillStyle = 'rgba(70,10,8,0.45)'; blob(c, -r * 0.95, 0, r * 0.45, rng, 10, 0.5, 0.7); c.fill();
    c.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      c.strokeStyle = ['#5a1a16', '#6e2620', '#4a1410', '#7a3028'][i]; c.lineWidth = r * (0.05 + rng() * 0.04);
      const y0 = (i - 1.5) * r * 0.1, len = r * (0.6 + rng() * 0.5);
      c.beginPath(); c.moveTo(-r * 0.5, y0);
      c.bezierCurveTo(-r * 0.5 - len * 0.3, y0 + (rng() - 0.5) * r * 0.5 + pull * r * 0.08, -r * 0.5 - len * 0.7, y0 + (rng() - 0.5) * r * 0.5, -r * 0.5 - len, y0 + (rng() - 0.5) * r * 0.3);
      c.stroke();
    }
    c.beginPath(); blob(c, -r * 0.55, 0, r * 0.28, rng, 8, 0.6); c.fillStyle = P.flesh; c.fill();
    const s2 = { ...s, wide: 0.85, depth: 1.25, tears: 3, stains: 2, reach: 1.25, armSpread: 0.3 + pull * 0.15, sleeve: s.sleeve || 'short', robe: true, shirt: s.shirt };
    // body is drawn without the robe skirt: draw arms and torso directly
    const sw = r * 0.8 * 0.85, td = r * 0.46 * 1.25;
    for (const side of [-1, 1]) {
      const reachK = side > 0 ? 0.5 + pull * 0.5 : 0.5 - pull * 0.5;
      const Ex = td + r * 0.3, Ey = side * sw * 1.1;
      const Wx = td + r * (0.6 + reachK * 0.6), Wy = side * sw * (0.75 + reachK * 0.3);
      limb(c, td * 0.1, side * sw * 0.8, Ex, Ey, r * 0.15, r * 0.13, s.shirt);
      limb(c, Ex, Ey, Wx, Wy, r * 0.12, r * 0.1, s.skin);
      hand(c, Wx, Wy, side * 0.3, r * 0.2, s.skin);
    }
    drawShirt(c, s2, rng, td, sw, r);
    c.strokeStyle = 'rgba(40,25,20,0.5)'; c.lineWidth = r * 0.05; c.beginPath(); c.moveTo(-td, 0); c.lineTo(td * 0.5, 0); c.stroke();
    const hr = r * 0.34, hx = td * 0.8;
    drawHead(c, s, rng, hx, hr, r);
    drawHair(c, s, rng, hx, hr);
  }

  // ---------- frost giant ----------
  function drawGiant(c, r, s, ph, seed) {
    const s2 = { ...s, wide: 1.45, depth: 1.25, pattern: s.sand ? 'bare' : s.mutant ? 'suit' : 'fur', sleeve: s.mutant ? 'short' : 'none', armThick: 1.9, handScale: 1.6, reach: 1.1, tears: s.mutant ? 3 : 0, stains: 1, headScale: 0.9, hairStyle: s.mutant ? 'short' : 'bald', frost: !s.sand && !s.mutant, limp: 0.8 };
    drawPerson(c, r, s2, ph, seed);
    const rng = mulberry32(seed + 3);
    if (s.mutant) {
      // Vane, swollen by the seed: violet growths bursting through the suit, tendrils trailing behind
      c.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const y0 = (rng() - 0.5) * r * 0.9, sw = Math.sin(ph * TAU + i) * r * 0.08;
        c.strokeStyle = '#4a2a5a'; c.lineWidth = r * 0.07;
        c.beginPath(); c.moveTo(-r * 0.4, y0); c.quadraticCurveTo(-r * 0.8, y0 + sw * 2, -r * (1 + rng() * 0.3), y0 * 1.4 + sw); c.stroke();
        c.strokeStyle = '#b866ff'; c.lineWidth = r * 0.025; c.stroke();
      }
      for (let i = 0; i < 9; i++) {
        const x = (rng() - 0.6) * r * 0.9, y = (rng() - 0.5) * r * 1.1, rr = r * (0.06 + rng() * 0.1);
        c.fillStyle = g2(c, x - rr, y - rr, x + rr, y + rr, [[0, '#e8c8ff'], [0.5, '#9a4ad8'], [1, '#3a1a4a']]); c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill();
      }
      return;
    }
    if (s.sand) {
      // a sandstone colossus: slabs of rock grown over its back and shoulders, cracks glowing like embers
      for (let i = 0; i < 9; i++) {
        const x = -r * 0.6 + rng() * r * 0.75, y = (rng() - 0.5) * r * 1.1, sz = r * (0.12 + rng() * 0.12);
        c.beginPath();
        for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + rng() * 0.5, d = sz * (0.7 + rng() * 0.5); c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
        c.closePath();
        c.fillStyle = g2(c, x - sz, y - sz, x + sz, y + sz, [[0, '#e8c890'], [0.5, '#b88a52'], [1, '#6a4a2a']]); c.fill();
        c.strokeStyle = 'rgba(60,36,16,0.6)'; c.lineWidth = 0.5; c.stroke();
      }
      c.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        let x = -r * 0.5 + rng() * r * 0.6, y = (rng() - 0.5) * r * 0.9;
        c.beginPath(); c.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += (rng() - 0.3) * r * 0.16; y += (rng() - 0.5) * r * 0.18; c.lineTo(x, y); }
        c.strokeStyle = 'rgba(255,150,50,0.35)'; c.lineWidth = r * 0.06; c.stroke();
        c.strokeStyle = '#ffd27a'; c.lineWidth = r * 0.02; c.stroke();
      }
      return;
    }
    // ice spikes down the spine
    for (let i = 0; i < 6; i++) {
      const x = -r * 0.55 + i * r * 0.14, side = i % 2 ? 1 : -1;
      c.save(); c.translate(x, side * r * 0.08); c.rotate(Math.PI + side * 0.3);
      c.beginPath(); c.moveTo(0, -r * 0.08); c.lineTo(r * (0.35 + rng() * 0.15), 0); c.lineTo(0, r * 0.08); c.closePath();
      c.fillStyle = g2(c, 0, 0, r * 0.45, 0, [[0, 'rgba(150,200,230,0.95)'], [1, 'rgba(240,250,255,1)']]); c.fill();
      c.restore();
    }
  }

  // ---------- flyers ----------
  function drawCrow(c, r, s, ph, seed) {
    const rng = mulberry32(seed);
    // a vulture passes its own colours: brown wings, a bald pink head, a pale ruff and beak
    const W = s.wing || ['#2a2e38', '#0d0e12', '#1a1c24'];
    const flap = Math.sin(ph * TAU);
    const spread = 0.55 + 0.45 * Math.abs(flap);
    for (const side of [-1, 1]) {
      c.save(); c.scale(1, side);
      for (let i = 0; i < 9; i++) {
        const k = i / 8;
        const a = -0.2 - k * 1.2 * spread + flap * 0.15;
        const len = r * (1.25 + Math.sin(k * Math.PI) * 0.55) * (0.6 + spread * 0.4);
        const bx = r * 0.05 - k * r * 0.35, by = r * 0.15;
        c.save(); c.translate(bx, by); c.rotate(Math.PI / 2 + a);
        c.beginPath(); c.ellipse(len * 0.5, 0, len * 0.55, r * 0.13, 0, 0, TAU);
        c.fillStyle = g2(c, 0, -r * 0.13, 0, r * 0.13, [[0, W[0]], [0.5, W[1]], [1, W[2]]]); c.fill();
        c.strokeStyle = 'rgba(90,110,140,0.35)'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(0, 0); c.lineTo(len, 0); c.stroke();
        c.restore();
      }
      c.restore();
    }
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + (i - 2.5) * 0.13;
      c.beginPath(); c.ellipse(-r * 0.45 + Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, r * 0.32, r * 0.08, a, 0, TAU); c.fillStyle = i % 2 ? W[1] : W[2]; c.fill();
    }
    c.beginPath(); c.ellipse(0, 0, r * 0.55, r * 0.26, 0, 0, TAU); c.fillStyle = rg(c, 0, 0, r * 0.55, s.body || '#2c303a', '#08090c'); c.fill();
    if (s.ruff) { c.beginPath(); c.ellipse(r * 0.36, 0, r * 0.16, r * 0.24, 0, 0, TAU); c.fillStyle = rg(c, r * 0.32, -r * 0.05, r * 0.26, '#f4eee2', '#b8b0a0'); c.fill(); }
    c.beginPath(); c.ellipse(r * 0.52, 0, r * 0.2, r * 0.17, 0, 0, TAU); c.fillStyle = s.head ? rg(c, r * 0.48, -r * 0.05, r * 0.22, shade(s.head, 0.2), shade(s.head, -0.3)) : '#121318'; c.fill();
    c.beginPath(); c.moveTo(r * 0.66, -r * 0.06); c.lineTo(r * 0.98, 0); c.lineTo(r * 0.66, r * 0.06); c.closePath(); c.fillStyle = s.beak || '#3a3630'; c.fill();
    for (const sy of [-1, 1]) { c.fillStyle = '#d23a22'; c.beginPath(); c.arc(r * 0.58, sy * r * 0.1, r * 0.035, 0, TAU); c.fill(); }
    // one wing is ragged and bloody
    c.fillStyle = rgba(P.blood, 0.7); c.beginPath(); c.ellipse(-r * 0.1, -r * 0.5, r * 0.15, r * 0.08, 0.3, 0, TAU); c.fill();
    speckle(c, rng, 0, 0, r * 0.5, r * 0.22, 20, ['rgba(120,140,170,0.25)'], r * 0.05);
  }
  function drawBats(c, r, s, ph, seed) {
    const rng = mulberry32(seed);
    const spots = Array.from({ length: 5 }, () => [(rng() - 0.5) * r * 1.4, (rng() - 0.5) * r * 1.4, 0.75 + rng() * 0.4, rng()]);
    for (const [bx, by, sc, off] of spots) {
      const flap = Math.sin((ph + off) * TAU);
      const span = r * 0.55 * sc * (0.55 + 0.45 * Math.abs(flap));
      c.save(); c.translate(bx, by);
      for (const side of [-1, 1]) {
        c.beginPath(); c.moveTo(r * 0.05 * sc, 0);
        c.lineTo(r * 0.12 * sc, side * span * 0.5);
        c.lineTo(r * 0.05 * sc, side * span);
        c.quadraticCurveTo(-r * 0.05 * sc, side * span * 0.8, -r * 0.12 * sc, side * span * 0.85);
        c.quadraticCurveTo(-r * 0.12 * sc, side * span * 0.45, -r * 0.18 * sc, side * span * 0.5);
        c.quadraticCurveTo(-r * 0.1 * sc, side * span * 0.2, -r * 0.08 * sc, 0);
        c.closePath();
        c.fillStyle = 'rgba(48,36,40,0.92)'; c.fill();
        c.strokeStyle = 'rgba(120,95,90,0.6)'; c.lineWidth = 0.3;
        for (const k of [0.5, 0.85]) { c.beginPath(); c.moveTo(0, 0); c.lineTo(-r * 0.1 * sc, side * span * k); c.stroke(); }
      }
      c.beginPath(); c.ellipse(0, 0, r * 0.13 * sc, r * 0.08 * sc, 0, 0, TAU); c.fillStyle = '#3a2c26'; c.fill();
      c.fillStyle = '#2a201c'; for (const sy of [-1, 1]) { c.beginPath(); c.moveTo(r * 0.08 * sc, sy * r * 0.02 * sc); c.lineTo(r * 0.2 * sc, sy * r * 0.06 * sc); c.lineTo(r * 0.1 * sc, sy * r * 0.06 * sc); c.fill(); }
      c.fillStyle = '#ff6a3a'; c.beginPath(); c.arc(r * 0.12 * sc, 0, r * 0.02 * sc, 0, TAU); c.fill();
      c.restore();
    }
  }

  // ---------- per-type looks and outfit variants ----------
  const SKIN = ['#8c9670', '#a19f86', '#8b8086', '#9aa07a', '#7f8a6a'];
  const human = (o) => ({ kind: 'person', box: 3.6, skin: SKIN[0], shirt: '#5a4a3a', pants: '#3a3c48', shoes: '#2a2420', hair: '#3b3026', hairStyle: 'short', sleeve: 'short', pattern: 'plain', ...o });
  const LOOKS = {
    walker: [
      human({ skin: SKIN[0], shirt: '#7a3028', pattern: 'plaid', plaid2: '#d9c8a0', pants: '#3a4a66', hair: '#4a3626', sleeve: 'long' }),
      human({ skin: SKIN[1], shirt: '#c9c4b8', pattern: 'plain', pants: '#2c2c30', hair: '#1e1a16', hairStyle: 'long', stains: 3 }),
      human({ skin: SKIN[2], shirt: '#3e5a6a', pattern: 'stripe', pants: '#5a5040', hairStyle: 'bald', scalpWound: true, backpack: '#4a5a3a', missingArm: 1 }),
      human({ skin: SKIN[3], shirt: '#5a6a40', pattern: 'plain', pants: '#3a3428', hair: '#8a8478', patchy: true, sleeve: 'long' }),
    ],
    runner: [
      human({ skin: SKIN[3], shirt: '#8a3a30', pants: '#222428', hair: '#2a2018', lean: true, limp: 1, sleeve: 'none', tears: 3 }),
      human({ skin: SKIN[1], shirt: '#2e3a52', pattern: 'stripe', stripe: '#c8c8c8', pants: '#4a4a50', hair: '#6a4a2a', lean: true, limp: 1, sleeve: 'short' }),
      human({ skin: SKIN[4], shirt: '#5a5a5a', pants: '#2a3040', hairStyle: 'bald', lean: true, limp: 1, sleeve: 'none', scalpWound: true }),
    ],
    cone: [
      human({ skin: SKIN[0], shirt: '#c8cc3a', pattern: 'hivis', pants: '#3a3a44', gear: 'cone' }),
      human({ skin: SKIN[2], shirt: '#3f5f63', pattern: 'plain', pants: '#5a4a36', gear: 'cone', sleeve: 'long' }),
    ],
    digger: [
      human({ skin: SKIN[3], shirt: '#8a6a3a', pattern: 'overalls', pants: '#2d4059', gear: 'hardhat', sleeve: 'long', stains: 1 }),
      human({ skin: SKIN[1], shirt: '#5a4632', pattern: 'overalls', pants: '#2d4059', gear: 'hardhat', missingArm: -1 }),
    ],
    bucket: [
      human({ skin: SKIN[4], shirt: '#22262b', pattern: 'armor', pants: '#1e2024', shoes: '#111', gear: 'riot', sleeve: 'long', tears: 1, wide: 1.08 }),
      human({ skin: SKIN[0], shirt: '#2a3038', pattern: 'armor', pants: '#25282c', shoes: '#111', gear: 'riot', sleeve: 'long', tears: 1, wide: 1.08 }),
    ],
    necro: [human({ skin: SKIN[2], shirt: '#2a1e3a', pattern: 'robe', trim: '#6a5a30', robe: true, gear: 'hood', staff: true, sleeve: 'long', tears: 1, stains: 1, box: 4.4, glow: [{ x: 2.25, y: 0.55, r: 26, color: '150,255,110', a: 0.55 }] })],
    brute: [
      human({ skin: '#8a8a68', shirt: '#8a8a68', pattern: 'bare', sleeve: 'none', pants: '#3a2c22', hairStyle: 'bald', wide: 1.3, armThick: 1.5, handScale: 1.35, tears: 0, stains: 2, scalpWound: true }),
    ],
    frosty: [
      human({ skin: '#a9c2cf', shirt: '#3c4f66', pants: '#2a3446', gear: 'ice', hair: '#c8d8e0', frost: true, icicles: true, eye: '#bfefff', sleeve: 'long' }),
      human({ skin: '#b4c8d2', shirt: '#5a6a7a', pattern: 'plaid', plaid2: '#e0e8f0', pants: '#3a4050', gear: 'ice', hair: '#d8e4ea', frost: true, icicles: true, eye: '#bfefff' }),
    ],
    medic: [human({ skin: SKIN[1], shirt: '#2e241e', pattern: 'coat', coatTail: true, pants: '#1e1a16', gear: 'plague', sleeve: 'long', satchel: true, stains: 1, box: 4.2 })],
    imp: [
      { kind: 'crawler', box: 3.6, skin: SKIN[0], shirt: '#4a4038', hair: '#2a2420', hairStyle: 'short' },
      { kind: 'crawler', box: 3.6, skin: SKIN[2], shirt: '#5a2a28', hair: '#3a3026', hairStyle: 'long' },
    ],
    skeleton: [{ kind: 'skeleton', box: 3.2, rag: '#3a3428' }, { kind: 'skeleton', box: 3.2, rag: '#4a2a22' }],
    ghost: [{ kind: 'wraith', box: 4.8, glow: [{ x: 0.5, y: 0, r: 34, color: '150,210,255', a: 0.35 }] }],
    bloater: [{ kind: 'bloater', box: 2.9, skin: '#8f9a5e', shirt: '#4a4038' }, { kind: 'bloater', box: 2.9, skin: '#9a9468', shirt: '#3a4a5a' }],
    carrion: [{ kind: 'crow', box: 4.6 }],
    bats: [{ kind: 'bats', box: 3.4 }],
    juggernaut: [human({ skin: SKIN[4], shirt: '#55585e', pattern: 'scrap', pants: '#2a2a2a', shoes: '#111', gear: 'welder', sleeve: 'long', wide: 1.3, armThick: 1.4, handScale: 1.3, tears: 0, stains: 1 })],
    harvester: [human({ skin: SKIN[3], shirt: '#7a3028', pattern: 'overalls', pants: '#2d4059', gear: 'straw', wide: 1.25, armThick: 1.35, handScale: 1.25, scythe: true, sleeve: 'long', stains: 3, box: 5.2 })],
    graveLord: [human({ skin: SKIN[2], shirt: '#1d1828', pattern: 'robe', trim: '#a8862e', robe: true, gear: 'hood', crown: true, eyeGlow: '#ff6a3a', staff: true, wide: 1.25, sleeve: 'long', tears: 1, stains: 0, box: 4.8, glow: [{ x: 2.25, y: 0.7, r: 34, color: '150,255,110', a: 0.6 }] })],
    abomination: [{ kind: 'giant', box: 4.2, skin: '#b8c8d0', shirt: '#b8c8d0', pants: '#5a6a78', eye: '#9fe3ff', glow: [{ x: 0.5, y: 0, r: 40, color: '160,220,255', a: 0.25 }] }],
    behemoth: [{ kind: 'bloater', box: 2.9, skin: '#7c8a48', shirt: '#3a3228', huge: true, glow: [{ x: 0, y: 0, r: 60, color: '160,220,80', a: 0.18 }] }],
    mummy: [
      human({ skin: '#a89a76', shirt: '#cfc3a0', pants: '#bfb291', shoes: '#8a7a58', hairStyle: 'bald', sleeve: 'long', wrap: true, eye: '#ffb040', stains: 0, tears: 0, glow: [{ x: 0.5, y: 0, r: 14, color: '255,170,60', a: 0.35 }] }),
      human({ skin: '#9a8a66', shirt: '#c8b890', pants: '#b0a07a', shoes: '#7a6a48', hairStyle: 'bald', sleeve: 'long', wrap: true, eye: '#ffb040', stains: 0, tears: 0, missingArm: 1, glow: [{ x: 0.5, y: 0, r: 14, color: '255,170,60', a: 0.35 }] }),
    ],
    scorpion: [{ kind: 'scorpion', box: 3.4, shell: '#c8a050' }, { kind: 'scorpion', box: 3.4, shell: '#a86a3a' }],
    vulture: [{ kind: 'crow', box: 4.6, wing: ['#6a5238', '#2e2216', '#4a3826'], body: '#4a3826', head: '#c88a78', beak: '#e0d2a8', ruff: true }],
    suit: [
      human({ skin: SKIN[0], shirt: '#2a2e36', pattern: 'suit', pants: '#24262c', shoes: '#111', hair: '#2a2420', sleeve: 'long', tie: '#a82a2a' }),
      human({ skin: SKIN[2], shirt: '#4a4a52', pattern: 'suit', pants: '#3a3a42', shoes: '#111', hair: '#6a5a4a', hairStyle: 'long', sleeve: 'long', tie: '#2a4a8a', missingArm: 1 }),
      human({ skin: SKIN[1], shirt: '#5a4a3a', pattern: 'suit', pants: '#3a3028', shoes: '#2a2018', hairStyle: 'bald', sleeve: 'long', tie: '#2a6a3a', stains: 2 }),
    ],
    swat: [
      human({ skin: SKIN[4], shirt: '#1c1f24', pattern: 'armor', label: 'SWAT', pants: '#1e2024', shoes: '#111', gear: 'riot', sleeve: 'long', tears: 1, wide: 1.1 }),
      human({ skin: SKIN[0], shirt: '#22262c', pattern: 'armor', label: 'POLICE', pants: '#1e2024', shoes: '#111', gear: 'riot', sleeve: 'long', tears: 1, wide: 1.1 }),
    ],
    drone: [{ kind: 'drone', box: 3.4, glow: [{ x: 0.3, y: 0, r: 16, color: '255,70,50', a: 0.45 }] }],
    chairman: [{ kind: 'giant', mutant: true, box: 4.4, skin: '#b8a8c8', hair: '#d8d4cc', shoes: '#111', shirt: '#22252e', pants: '#1a1c22', eye: '#e8a8ff', tie: '#8a1a2a', glow: [{ x: 0.5, y: 0, r: 46, color: '184,102,255', a: 0.35 }] }],
    colossus: [{ kind: 'giant', sand: true, box: 4.2, skin: '#c9a46a', shirt: '#c9a46a', pants: '#7a5a3a', eye: '#ffb040', glow: [{ x: 0.5, y: 0, r: 46, color: '255,170,60', a: 0.3 }] }],
    // wonder expeditions
    magma: [{ kind: 'magma', box: 3.8, glow: [{ x: 0, y: 0, r: 22, color: '255,120,40', a: 0.5 }] }],
    ember: [{ kind: 'ember', box: 4.4, glow: [{ x: 0, y: 0, r: 16, color: '255,150,50', a: 0.6 }] }],
    ashwalker: [
      human({ skin: '#4a4440', shirt: '#4a4440', pattern: 'bare', sleeve: 'none', pants: '#221e1c', shoes: '#141210', hairStyle: 'bald', eye: '#ffb040', char: true, stains: 0, tears: 0, glow: [{ x: 0, y: 0, r: 16, color: '255,120,40', a: 0.3 }] }),
      human({ skin: '#3e3a36', shirt: '#3a3028', pants: '#2a2420', hair: '#1a1612', patchy: true, eye: '#ffb040', char: true, tears: 3, stains: 0, missingArm: 1, glow: [{ x: 0, y: 0, r: 16, color: '255,120,40', a: 0.3 }] }),
    ],
    sailor: [
      human({ skin: '#7f9a8c', shirt: '#e4e2d8', pattern: 'stripe', stripe: '#2a4a7a', pants: '#26344e', gear: 'sailor', drowned: true, eye: '#bfefff', sleeve: 'long', stains: 0 }),
      human({ skin: '#86a094', shirt: '#2a3a52', pattern: 'coat', pants: '#22283a', hair: '#3a4a3a', hairStyle: 'long', drowned: true, eye: '#bfefff', sleeve: 'long', missingArm: -1, stains: 0 }),
    ],
    crab: [{ kind: 'crab', box: 3.6, shell: '#b84a2a' }, { kind: 'crab', box: 3.6, shell: '#8a5a3a' }],
    kobold: [{ kind: 'kobold', box: 4.6, glow: [{ x: 0.7, y: 0, r: 10, color: '255,110,40', a: 0.4 }] }],
    cultist: [human({ skin: SKIN[2], shirt: '#7a1a18', pattern: 'robe', trim: '#d8a030', robe: true, gear: 'hood', eyeGlow: '#ff8a30', horns: true, sleeve: 'long', tears: 1, stains: 0, box: 4.4, glow: [{ x: 0.5, y: 0, r: 20, color: '255,120,40', a: 0.35 }] })],
    compy: [{ kind: 'compy', box: 4.8, skin: '#7a8a4a' }, { kind: 'compy', box: 4.8, skin: '#8a7a4a' }],
    ankylo: [{ kind: 'ankylo', box: 4.2, skin: '#6a7048' }],
    cow: [{ kind: 'cow', box: 3.4 }],
    grey: [{ kind: 'grey', box: 3.6, glow: [{ x: 0.5, y: 0, r: 12, color: '120,255,160', a: 0.3 }] }],
    cinderKing: [{ kind: 'wonder', art: 'cinder', box: 3.5, glow: [{ x: 0, y: 0, r: 80, color: '255,110,30', a: 0.5 }] }],
    kraken: [{ kind: 'wonder', art: 'kraken', box: 5.2, glow: [{ x: 0.4, y: 0, r: 40, color: '248,232,112', a: 0.25 }] }],
    boneWyrm: [{ kind: 'wonder', art: 'dragon', box: 5, glow: [{ x: 0, y: 0, r: 60, color: '82,224,124', a: 0.45 }] }],
    rexMortis: [{ kind: 'wonder', art: 'dinos', box: 4.8, glow: [{ x: 0.8, y: 0, r: 30, color: '190,255,90', a: 0.25 }] }],
    abductor: [{ kind: 'wonder', art: 'ufo', box: 4.1, glow: [{ x: 0, y: 0, r: 70, color: '160,255,200', a: 0.4 }] }],
    // the other fifteen wonders
    shardback: [{ kind: 'ankylo', box: 4.2, skin: '#2a2830', tint: 'rgba(40,30,60,0.25)', glow: [{ x: 0, y: 0, r: 16, color: '255,110,40', a: 0.3 }] }],
    shard: [{ kind: 'golem', box: 3.4, col: '#2a2630', eye: '#ff8a3a' }],
    emberimp: [{ kind: 'crawler', box: 3.6, skin: '#a8442a', shirt: '#3a1a10', hair: '#1a0a06', hairStyle: 'bald', glow: [{ x: 0.4, y: 0, r: 14, color: '255,120,40', a: 0.45 }] }],
    husk: [human({ skin: '#3a302a', shirt: '#2a2220', pattern: 'bare', sleeve: 'none', pants: '#1a1614', hairStyle: 'bald', eye: '#ffc040', char: true, burning: true, stains: 0, tears: 0, glow: [{ x: 0, y: 0, r: 22, color: '255,130,40', a: 0.5 }] })],
    smokehound: [{ kind: 'hound', box: 3.8, fur: '#5a5654', eye: '#ff8a3a', smoke: '120,116,110' }],
    treant: [{ kind: 'treant', box: 3.6, bark: '#2e221a', ember: true, leaves: ['#2a1a10', '#5a2a10'], glow: [{ x: 0, y: 0, r: 18, color: '255,110,30', a: 0.3 }] }],
    sprite: [{ kind: 'wisp', box: 4.4, col: '255,140,40', glow: [{ x: 0, y: 0, r: 16, color: '255,140,50', a: 0.6 }] }],
    raptor: [{ kind: 'raptor', box: 4.8, skin: '#7a6248' }, { kind: 'raptor', box: 4.8, skin: '#5a6a4a' }],
    rider: [{ kind: 'raptor', box: 4.8, skin: '#6a5a40', rider: true }],
    ptero: [{ kind: 'crow', box: 4.8, wing: ['#7a5a5a', '#3a2a2e', '#5a4448'], body: '#5a4448', head: '#8a6a5a', beak: '#d8c8a8' }],
    cliffcrawler: [{ kind: 'crawler', box: 3.6, skin: '#8a8a7a', shirt: '#4a4a48', hair: '#2a2a28', hairStyle: 'short', tint: 'rgba(120,120,110,0.18)' }],
    crystalhusk: [human({ skin: '#7a8a6a', shirt: '#3a4a3a', pants: '#2a3028', hair: '#2a3a20', crystals: true, eye: '#c8ffb0', sleeve: 'long', glow: [{ x: 0, y: 0, r: 18, color: '140,255,140', a: 0.35 }] })],
    seed: [{ kind: 'seed', box: 3.4, glow: [{ x: 0, y: 0, r: 12, color: '140,255,140', a: 0.4 }] }],
    seedling: [{ kind: 'seed', box: 3.4 }],
    golem: [{ kind: 'golem', box: 3.4, col: '#9a7ad8', glow: [{ x: 0, y: 0, r: 22, color: '200,160,255', a: 0.35 }] }],
    wisp: [{ kind: 'wisp', box: 4.4, col: '200,170,255', facets: true, glow: [{ x: 0, y: 0, r: 16, color: '200,170,255', a: 0.6 }] }],
    voidwraith: [{ kind: 'wraith', box: 4.8, tint: 'rgba(110,40,170,0.45)', glow: [{ x: 0.5, y: 0, r: 30, color: '170,90,255', a: 0.4 }] }],
    shadowhound: [{ kind: 'hound', box: 3.8, fur: '#24202c', eye: '#c890ff', smoke: '60,40,80' }],
    thrall: [human({ skin: '#8a8a84', shirt: '#6a6a66', pattern: 'bare', sleeve: 'none', pants: '#4a4a46', hairStyle: 'bald', runes: true, eye: '#7ad8ff', wide: 1.12, stains: 0, tears: 0, glow: [{ x: 0, y: 0, r: 16, color: '120,210,255', a: 0.35 }] })],
    druid: [human({ skin: SKIN[3], shirt: '#2e4a24', pattern: 'robe', trim: '#8aa84a', robe: true, gear: 'hood', eyeGlow: '#a8ff7a', staff: true, sleeve: 'long', box: 4.4, glow: [{ x: 2.25, y: 0.55, r: 24, color: '150,255,110', a: 0.5 }] })],
    ghostpirate: [{ kind: 'wraith', box: 4.8, tint: 'rgba(60,200,170,0.4)', glow: [{ x: 0.5, y: 0, r: 30, color: '120,255,220', a: 0.4 }] }],
    deckhand: [{ kind: 'skeleton', box: 3.2, rag: '#2a3a5a' }, { kind: 'skeleton', box: 3.2, rag: '#6a1a1a' }],
    dryad: [human({ skin: '#6a8a4a', shirt: '#4a6a2a', pattern: 'bare', sleeve: 'none', pants: '#3a4a24', hair: '#2a4a1a', hairStyle: 'long', eye: '#e0ff8a', tint: 'rgba(90,40,110,0.18)' })],
    puffer: [{ kind: 'bloater', box: 2.9, skin: '#8a6a9a', shirt: '#3a2a4a', glow: [{ x: 0, y: 0, r: 22, color: '200,140,255', a: 0.3 }] }],
    para: [human({ skin: SKIN[4], shirt: '#4a5a34', pattern: 'armor', label: 'AIRBORNE', pants: '#3a4228', shoes: '#111', gear: 'riot', backpack: '#5a6a3a', sleeve: 'long' })],
    gull: [{ kind: 'crow', box: 4.6, wing: ['#e8ecf0', '#8a929a', '#c8ccd0'], body: '#e0e4e8', head: '#f0f2f4', beak: '#e8b040' }],
    suncultist: [human({ skin: SKIN[1], shirt: '#a8781a', pattern: 'robe', trim: '#ffe080', robe: true, gear: 'hood', eyeGlow: '#ffe060', sleeve: 'long', box: 4.4, glow: [{ x: 0.5, y: 0, r: 18, color: '255,220,100', a: 0.35 }] })],
    scarabs: [{ kind: 'scarabs', box: 3.4 }],
    werewolf: [human({ skin: '#6a6a78', fur: '#6a6a78', shirt: '#5a5a6a', pattern: 'fur', sleeve: 'none', pants: '#2a2a34', gear: 'wolf', wide: 1.15, armThick: 1.3, handScale: 1.3, eye: '#ffe060', stains: 1 })],
    moth: [{ kind: 'moth', box: 4.2, glow: [{ x: 0, y: 0, r: 14, color: '200,210,255', a: 0.35 }] }],
    subject: [human({ skin: SKIN[0], shirt: '#c8dce4', pants: '#c8dce4', shoes: '#c8c4bc', hairStyle: 'bald', scalpWound: true, eye: '#8aff9a', stains: 2 }), human({ skin: SKIN[2], shirt: '#b8ccd8', pants: '#b8ccd8', shoes: '#c8c4bc', hair: '#3a3026', hairStyle: 'long', eye: '#8aff9a', missingArm: 1, stains: 2 })],
    hazmat: [human({ skin: SKIN[4], shirt: '#d8c030', pattern: 'armor', label: 'HC-1', pants: '#c8b028', shoes: '#2a2a2a', gear: 'welder', sleeve: 'long', wide: 1.1, stains: 1 })],
    ashWyrm: [{ kind: 'wonder', art: 'ashen', box: 5, glow: [{ x: 0.6, y: 0, r: 50, color: '255,120,40', a: 0.4 }] }],
    wendigo: [{ kind: 'wonder', art: 'wildfire', box: 4.2, glow: [{ x: 0, y: 0, r: 70, color: '255,120,30', a: 0.5 }] }],
    oak: [{ kind: 'wonder', art: 'emberwood', box: 4, glow: [{ x: 0, y: 0, r: 60, color: '255,110,30', a: 0.4 }] }],
    packAlpha: [{ kind: 'wonder', art: 'raptors', box: 5, glow: [{ x: 0.9, y: 0, r: 20, color: '255,220,60', a: 0.3 }] }],
    quetzal: [{ kind: 'wonder', art: 'pteros', box: 5.2, glow: [{ x: 0.5, y: 0, r: 30, color: '160,255,200', a: 0.3 }] }],
    starborn: [{ kind: 'wonder', art: 'starfall', box: 4, glow: [{ x: 0, y: 0, r: 70, color: '140,255,140', a: 0.45 }] }],
    prism: [{ kind: 'wonder', art: 'spires', box: 4, glow: [{ x: 0, y: 0, r: 70, color: '200,160,255', a: 0.45 }] }],
    unmade: [{ kind: 'wonder', art: 'rift', box: 4.6, glow: [{ x: 0, y: 0, r: 70, color: '170,90,255', a: 0.45 }] }],
    warden: [{ kind: 'wonder', art: 'stones', box: 4, glow: [{ x: 0, y: 0, r: 50, color: '120,210,255', a: 0.4 }] }],
    blackwake: [{ kind: 'wonder', art: 'ghostship', box: 4.6, glow: [{ x: 0.5, y: 0, r: 60, color: '120,255,220', a: 0.4 }] }],
    blight: [{ kind: 'wonder', art: 'eldertree', box: 4.2, glow: [{ x: 0, y: 0, r: 60, color: '190,120,255', a: 0.35 }] }],
    harbinger: [{ kind: 'wonder', art: 'skyhold', box: 4.4, glow: [{ x: 0, y: 0, r: 60, color: '180,220,255', a: 0.4 }] }],
    sunPriest: [{ kind: 'wonder', art: 'temple', box: 4.4, glow: [{ x: 0, y: 0, r: 70, color: '255,210,90', a: 0.45 }] }],
    lunarAlpha: [{ kind: 'wonder', art: 'moonwell', box: 4.2, glow: [{ x: 0, y: 0, r: 60, color: '180,200,255', a: 0.4 }] }],
    subjectZero: [{ kind: 'wonder', art: 'zero', box: 4, glow: [{ x: 0.5, y: 0, r: 60, color: '82,224,124', a: 0.4 }] }],
  };

  // ---------- desert ----------
  // a mummy is a person wrapped from head to foot: bandage strips are laid over the drawn body
  function wrapBandages(c, r, s, seed) {
    const rng = mulberry32(seed + 11), R = r * s.box * 0.5;
    c.save(); c.globalCompositeOperation = 'source-atop'; c.lineCap = 'butt';
    for (let i = -14; i <= 14; i++) {
      const y = i * r * 0.11, a = (rng() - 0.5) * 0.3 + (i % 2 ? 0.18 : -0.15);
      c.save(); c.translate(0, y); c.rotate(a);
      const col = ['#d8ccaa', '#c8b890', '#e2d8bc', '#b8a87e'][Math.floor(rng() * 4)];
      c.strokeStyle = col; c.globalAlpha = 0.7; c.lineWidth = r * (0.08 + rng() * 0.04);
      c.beginPath(); c.moveTo(-R, 0); c.lineTo(R, 0); c.stroke();
      c.globalAlpha = 0.5; c.strokeStyle = 'rgba(70,52,30,0.7)'; c.lineWidth = r * 0.012;
      c.beginPath(); c.moveTo(-R, r * 0.045); c.lineTo(R, r * 0.045); c.stroke();
      c.restore();
    }
    // old stains and a few torn ends showing the dried skin beneath
    c.globalAlpha = 1;
    for (let i = 0; i < 9; i++) { blob(c, (rng() - 0.5) * r * 1.4, (rng() - 0.5) * r * 1.4, r * (0.06 + rng() * 0.12), rng, 8, 0.5); c.fillStyle = rng() < 0.5 ? 'rgba(110,80,40,0.35)' : 'rgba(90,30,20,0.3)'; c.fill(); }
    c.restore();
  }
  function drawScorpion(c, r, s, ph, seed) {
    const rng = mulberry32(seed);
    const shell = s.shell || '#c8a050', dark = shade(shell, -0.5), lite = shade(shell, 0.35);
    c.lineCap = 'round'; c.lineJoin = 'round';
    // eight legs, scuttling in two alternating sets
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const st = Math.sin((ph + (i % 2 ? 0.5 : 0) + (side > 0 ? 0.25 : 0)) * TAU) * 0.25;
      const bx = r * (0.18 - i * 0.2), a = side * (Math.PI / 2 + (i - 1.5) * 0.35 + st);
      const kx = bx + Math.cos(a) * r * 0.55, ky = Math.sin(a) * r * 0.55;
      const fx = kx + Math.cos(a + side * 0.6) * r * 0.45, fy = ky + Math.sin(a + side * 0.6) * r * 0.45 * 0.9;
      c.strokeStyle = dark; c.lineWidth = r * 0.11; c.beginPath(); c.moveTo(bx, 0); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
      c.strokeStyle = shell; c.lineWidth = r * 0.06; c.beginPath(); c.moveTo(bx, 0); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
    }
    // pincers reaching forward, snapping
    const snap = Math.max(0, Math.sin(ph * TAU * 2)) * 0.25;
    for (const side of [-1, 1]) {
      const ex = r * 0.75, ey = side * r * 0.42, cx = r * 1.15, cy = side * r * 0.5;
      limb(c, r * 0.4, side * r * 0.15, ex, ey, r * 0.13, r * 0.12, shell);
      limb(c, ex, ey, cx, cy, r * 0.12, r * 0.16, shell);
      c.save(); c.translate(cx, cy);
      c.beginPath(); c.ellipse(r * 0.08, 0, r * 0.24, r * 0.15, 0, 0, TAU); c.fillStyle = rg(c, 0, -r * 0.05, r * 0.25, lite, dark); c.fill();
      for (const k of [-1, 1]) { c.save(); c.rotate(k * (0.25 + snap)); c.beginPath(); c.ellipse(r * 0.38, k * r * 0.05, r * 0.16, r * 0.05, 0, 0, TAU); c.fillStyle = dark; c.fill(); c.restore(); }
      c.restore();
    }
    // body: a head shield and seven plates
    for (let i = 6; i >= 0; i--) {
      const x = r * (0.05 - i * 0.12), w = r * (0.34 - Math.abs(i - 2) * 0.03);
      c.beginPath(); c.ellipse(x, 0, r * 0.12, w, 0, 0, TAU); c.fillStyle = rg(c, x, -w * 0.4, w * 1.1, lite, dark); c.fill();
      c.strokeStyle = 'rgba(40,24,8,0.5)'; c.lineWidth = r * 0.02; c.stroke();
    }
    c.beginPath(); c.ellipse(r * 0.3, 0, r * 0.24, r * 0.3, 0, 0, TAU); c.fillStyle = rg(c, r * 0.26, -r * 0.1, r * 0.32, lite, dark); c.fill();
    // the infection: sickly green blotches, and glowing eyes
    for (let i = 0; i < 5; i++) { blob(c, r * (0.2 - rng() * 0.8), (rng() - 0.5) * r * 0.4, r * (0.05 + rng() * 0.06), rng, 7, 0.4); c.fillStyle = 'rgba(120,170,60,0.55)'; c.fill(); }
    for (const sy of [-1, 1]) { c.beginPath(); c.arc(r * 0.42, sy * r * 0.07, r * 0.04, 0, TAU); c.fillStyle = '#b8ff60'; c.fill(); }
    // the tail runs out behind, then arches up and forward over the back (seen from above it
    // folds back along the body, each raised segment a little bigger), swaying, stinger poised
    const sway = Math.sin(ph * TAU) * 0.06;
    const T = [[-0.78, 0], [-1.0, 0.01], [-1.18, 0.04], [-1.22, 0.09], [-1.08, 0.13], [-0.86, 0.13], [-0.62, 0.09]];
    let [x, y] = [T[0][0] * r, T[0][1] * r];
    for (let i = 1; i < T.length; i++) {
      const nx = T[i][0] * r, ny = (T[i][1] + sway * i) * r, a = Math.atan2(ny - y, nx - x), seg = Math.hypot(nx - x, ny - y), w = r * (0.1 + (i > 3 ? (i - 3) * 0.012 : 0));
      if (i > 3) { c.beginPath(); c.ellipse((x + nx) / 2 + r * 0.06, (y + ny) / 2 + r * 0.08, seg * 0.6, w, a, 0, TAU); c.fillStyle = 'rgba(30,16,4,0.3)'; c.fill(); }
      c.beginPath(); c.ellipse((x + nx) / 2, (y + ny) / 2, seg * 0.62, w, a, 0, TAU);
      c.fillStyle = rg(c, (x + nx) / 2, (y + ny) / 2 - w * 0.4, w * 1.4, lite, dark); c.fill();
      c.strokeStyle = 'rgba(40,24,8,0.5)'; c.lineWidth = r * 0.02; c.stroke();
      x = nx; y = ny;
    }
    c.beginPath(); c.arc(x, y, r * 0.11, 0, TAU); c.fillStyle = rg(c, x - r * 0.03, y - r * 0.03, r * 0.12, '#e8ff9a', '#6a9a20'); c.fill();
    c.beginPath(); c.moveTo(x + r * 0.06, y - r * 0.05); c.quadraticCurveTo(x + r * 0.26, y, x + r * 0.12, y + r * 0.1); c.lineTo(x + r * 0.06, y + r * 0.04); c.closePath();
    c.fillStyle = '#2a1a0a'; c.fill();
  }

  // a Kessler-Vane security drone the hive has grown into: four rotors, a camera eye, green veins
  function drawDrone(c, r, s, ph) {
    const arm = r * 0.75;
    c.lineCap = 'round';
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = sx * arm * 0.72, y = sy * arm * 0.72;
      c.strokeStyle = '#26282c'; c.lineWidth = r * 0.14; c.beginPath(); c.moveTo(0, 0); c.lineTo(x, y); c.stroke();
      c.strokeStyle = '#5a5e64'; c.lineWidth = r * 0.05; c.beginPath(); c.moveTo(-r * 0.02, -r * 0.02); c.lineTo(x - r * 0.02, y - r * 0.02); c.stroke();
      c.strokeStyle = '#52e07c'; c.lineWidth = r * 0.03; c.beginPath(); c.moveTo(x * 0.2, y * 0.25); c.quadraticCurveTo(x * 0.5 + sy * r * 0.08, y * 0.5 - sx * r * 0.08, x * 0.85, y * 0.85); c.stroke();
      c.fillStyle = 'rgba(200,210,220,0.18)'; c.beginPath(); c.arc(x, y, r * 0.42, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(30,32,36,0.7)'; c.lineWidth = r * 0.05;
      const a = ph * TAU * 3 + sx * sy;
      c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4); c.lineTo(x - Math.cos(a) * r * 0.4, y - Math.sin(a) * r * 0.4); c.stroke();
      c.fillStyle = '#1a1c1e'; c.beginPath(); c.arc(x, y, r * 0.08, 0, TAU); c.fill();
    }
    c.fillStyle = g2(c, -r * 0.3, -r * 0.3, r * 0.3, r * 0.3, [[0, '#6a6e74'], [0.5, '#34383e'], [1, '#16181a']]);
    c.beginPath(); c.roundRect(-r * 0.36, -r * 0.28, r * 0.72, r * 0.56, r * 0.12); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 0.4; c.stroke();
    // a fleshy growth on its back, and the camera glaring forward
    c.fillStyle = g2(c, -r * 0.2, -r * 0.1, r * 0.1, r * 0.2, [[0, '#9ad870'], [1, '#2a5a1a']]); c.beginPath(); c.ellipse(-r * 0.1, r * 0.02, r * 0.16, r * 0.12, 0.3, 0, TAU); c.fill();
    c.fillStyle = '#0c0c0e'; c.beginPath(); c.arc(r * 0.3, 0, r * 0.12, 0, TAU); c.fill();
    c.fillStyle = rg(c, r * 0.3, 0, r * 0.1, '#ffd0c0', '#e0302a'); c.beginPath(); c.arc(r * 0.3, 0, r * 0.075, 0, TAU); c.fill();
    c.fillStyle = '#e8e4d8'; c.font = `800 ${r * 0.14}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('K-V', -r * 0.12, -r * 0.16);
  }

  // ---------- wonder expeditions ----------
  // glowing cracks of molten rock across whatever shape is traced
  function cracks(c, rng, x, y, rx, ry, n, w, col = '#ff8a2a') {
    c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      let px = x + (rng() - 0.5) * rx * 1.4, py = y + (rng() - 0.5) * ry * 1.4, a = rng() * TAU;
      c.beginPath(); c.moveTo(px, py);
      for (let k = 0; k < 5; k++) { a += (rng() - 0.5) * 1.6; px += Math.cos(a) * rx * 0.12; py += Math.sin(a) * ry * 0.12; c.lineTo(px, py); if (k === 2 && rng() < 0.5) { c.moveTo(px, py); a += 1.2; } }
      c.strokeStyle = 'rgba(255,90,20,0.45)'; c.lineWidth = w * 2.4; c.stroke();
      c.strokeStyle = col; c.lineWidth = w; c.stroke();
    }
  }
  // Mount Cinder: a body of cooling basalt dragging itself along on two arms, molten inside
  function drawMagma(c, r, s, ph, seed) {
    const rng = mulberry32(seed), pull = Math.sin(ph * TAU);
    // a smear of lava left behind it
    for (let i = 0; i < 3; i++) { blob(c, -r * (0.6 + i * 0.2), (rng() - 0.5) * r * 0.25, r * (0.3 - i * 0.07), rng, 8, 0.5, 0.8); c.fillStyle = i % 2 ? 'rgba(255,120,30,0.6)' : 'rgba(200,60,10,0.55)'; c.fill(); }
    for (const side of [-1, 1]) {
      const k = side > 0 ? 0.5 + pull * 0.5 : 0.5 - pull * 0.5;
      const Ex = r * 0.45, Ey = side * r * 0.75, Wx = r * (0.75 + k * 0.5), Wy = side * r * (0.5 + k * 0.2);
      limb(c, r * 0.05, side * r * 0.45, Ex, Ey, r * 0.17, r * 0.14, '#3a2a24');
      limb(c, Ex, Ey, Wx, Wy, r * 0.14, r * 0.12, '#2e2220');
      hand(c, Wx, Wy, side * 0.3, r * 0.2, '#3a2c26');
      c.fillStyle = 'rgba(255,140,40,0.8)'; c.beginPath(); c.arc(Wx + r * 0.12, Wy, r * 0.05, 0, TAU); c.fill();
    }
    blob(c, -r * 0.05, 0, r * 0.62, rng, 12, 0.22, 0.85); c.fillStyle = rg(c, -r * 0.1, 0, r * 0.65, '#ff9a2a', '#a8300a'); c.fill();
    // plates of crust riding on the melt
    for (let i = 0; i < 9; i++) { const a = rng() * TAU, d = rng() * r * 0.45, pr = r * (0.13 + rng() * 0.1); blob(c, -r * 0.05 + Math.cos(a) * d, Math.sin(a) * d * 0.85, pr, rng, 6, 0.4); c.fillStyle = rg(c, -r * 0.05 + Math.cos(a) * d, Math.sin(a) * d, pr, '#5a4a44', '#1a1210'); c.fill(); }
    c.fillStyle = 'rgba(255,220,120,0.35)'; c.beginPath(); c.ellipse(-r * 0.1, -r * 0.05, r * 0.25, r * 0.12, 0, 0, TAU); c.fill();
    const hx = r * 0.55, hr = r * 0.27;
    c.beginPath(); c.ellipse(hx, 0, hr, hr * 0.9, 0, 0, TAU); c.fillStyle = rg(c, hx, 0, hr, '#4a3a34', '#160e0c'); c.fill();
    cracks(c, rng, hx, 0, hr, hr, 2, r * 0.03);
    for (const sy of [-1, 1]) { c.fillStyle = '#ffd060'; c.beginPath(); c.arc(hx + hr * 0.6, sy * hr * 0.35, hr * 0.14, 0, TAU); c.fill(); }
    c.fillStyle = '#ff7a20'; c.beginPath(); c.ellipse(hx + hr * 0.85, 0, hr * 0.12, hr * 0.3, 0, 0, TAU); c.fill();
  }
  // what a magma crawler bursts into: a spitting ball of fire with two dark eyes
  function drawEmber(c, r, s, ph) {
    const fl = Math.sin(ph * TAU * 2);
    for (let i = 0; i < 5; i++) {
      const y = (i - 2) * r * 0.28, l = r * (1.1 + ((i * 37) % 5) * 0.12 + fl * 0.15 * (i % 2 ? 1 : -1));
      c.beginPath(); c.moveTo(-r * 0.3, y - r * 0.3); c.quadraticCurveTo(-r * 0.6 - l * 0.4, y + fl * r * 0.15, -r * 0.3 - l, y * 1.3); c.quadraticCurveTo(-r * 0.6 - l * 0.3, y + r * 0.2, -r * 0.3, y + r * 0.3);
      c.fillStyle = i % 2 ? 'rgba(255,120,20,0.85)' : 'rgba(255,200,60,0.8)'; c.fill();
    }
    c.beginPath(); c.arc(0, 0, r * 0.75, 0, TAU); c.fillStyle = rg(c, r * 0.1, -r * 0.1, r * 0.8, '#fff2b0', '#e04a10'); c.fill();
    c.strokeStyle = 'rgba(120,20,0,0.5)'; c.lineWidth = r * 0.06; c.stroke();
    for (const sy of [-1, 1]) { c.fillStyle = '#2a0a04'; c.beginPath(); c.ellipse(r * 0.35, sy * r * 0.25, r * 0.13, r * 0.1, 0, 0, TAU); c.fill(); }
    c.fillStyle = '#5a1404'; c.beginPath(); c.ellipse(r * 0.55, 0, r * 0.08, r * 0.2, 0, 0, TAU); c.fill();
  }
  // The Deep One: an armoured crab, scuttling sideways along the road with its claws up
  function drawCrab(c, r, s, ph, seed) {
    const rng = mulberry32(seed), shell = s.shell || '#b84a2a', dark = shade(shell, -0.5), lite = shade(shell, 0.3);
    c.lineCap = 'round'; c.lineJoin = 'round';
    // legs splay out ahead and behind: it walks crabwise, its face to one side
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const st = Math.sin((ph + (i % 2 ? 0.5 : 0) + (side > 0 ? 0.25 : 0)) * TAU) * 0.22;
      const by = r * (-0.25 + i * 0.17), a = side > 0 ? -0.15 + (i - 1.5) * 0.3 + st : Math.PI + 0.15 - (i - 1.5) * 0.3 - st;
      const kx = Math.cos(a) * r * 0.75, ky = by + Math.sin(a) * r * 0.35, fx = kx + Math.cos(a) * r * 0.4, fy = ky + r * 0.3;
      c.strokeStyle = dark; c.lineWidth = r * 0.12; c.beginPath(); c.moveTo(side * r * 0.4, by); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
      c.strokeStyle = shell; c.lineWidth = r * 0.065; c.beginPath(); c.moveTo(side * r * 0.4, by); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
    }
    // the big claws raised on the side it faces
    const snap = Math.max(0, Math.sin(ph * TAU * 2)) * 0.3;
    for (const side of [-1, 1]) {
      const big = side > 0 ? 1.15 : 0.85, ex = side * r * 0.45, ey = -r * 0.62, cx = side * r * 0.32, cy = -r * 1.0;
      limb(c, side * r * 0.25, -r * 0.3, ex, ey, r * 0.11, r * 0.1, shell);
      limb(c, ex, ey, cx, cy, r * 0.1, r * 0.13 * big, shell);
      c.save(); c.translate(cx, cy); c.rotate(-Math.PI / 2 - side * 0.3);
      c.beginPath(); c.ellipse(r * 0.08, 0, r * 0.26 * big, r * 0.17 * big, 0, 0, TAU); c.fillStyle = rg(c, 0, -r * 0.05, r * 0.28, lite, dark); c.fill();
      for (const k of [-1, 1]) { c.save(); c.rotate(k * (0.22 + snap)); c.beginPath(); c.ellipse(r * 0.38 * big, k * r * 0.05, r * 0.17 * big, r * 0.06, 0, 0, TAU); c.fillStyle = dark; c.fill(); c.restore(); }
      c.restore();
    }
    // the shell: wide, ridged, crusted with barnacles and weed
    c.beginPath(); c.ellipse(0, 0, r * 0.62, r * 0.46, 0, 0, TAU); c.fillStyle = rg(c, -r * 0.15, -r * 0.15, r * 0.7, lite, dark); c.fill();
    c.strokeStyle = 'rgba(40,10,4,0.5)'; c.lineWidth = r * 0.03; c.stroke();
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * r * 0.18, -r * 0.4); c.quadraticCurveTo(i * r * 0.22, 0, i * r * 0.18, r * 0.4); c.strokeStyle = 'rgba(60,16,6,0.35)'; c.stroke(); }
    for (let i = 0; i < 7; i++) { const x = (rng() - 0.5) * r, y = (rng() - 0.5) * r * 0.6, br = r * (0.04 + rng() * 0.04); c.beginPath(); c.arc(x, y, br, 0, TAU); c.fillStyle = '#d8d0b8'; c.fill(); c.beginPath(); c.arc(x, y, br * 0.4, 0, TAU); c.fillStyle = '#3a3428'; c.fill(); }
    for (let i = 0; i < 3; i++) { blob(c, (rng() - 0.5) * r * 0.8, (rng() - 0.5) * r * 0.5, r * 0.1, rng, 7, 0.5); c.fillStyle = 'rgba(120,170,60,0.55)'; c.fill(); }
    c.strokeStyle = '#3a5a2a'; c.lineWidth = r * 0.04;
    for (let i = 0; i < 3; i++) { const x = (rng() - 0.5) * r * 0.8; c.beginPath(); c.moveTo(x, -r * 0.2); c.quadraticCurveTo(x + r * 0.1, r * 0.2, x - r * 0.05, r * 0.55 + rng() * r * 0.2); c.stroke(); }
    // eyes on stalks, glowing
    for (const sx of [-1, 1]) { c.strokeStyle = dark; c.lineWidth = r * 0.05; c.beginPath(); c.moveTo(sx * r * 0.12, -r * 0.4); c.lineTo(sx * r * 0.16, -r * 0.6); c.stroke(); c.fillStyle = '#b8ff60'; c.beginPath(); c.arc(sx * r * 0.16, -r * 0.62, r * 0.06, 0, TAU); c.fill(); }
  }
  // The Red Dragon: a lizard skeleton on all fours, quick and low, with a horned skull
  function drawKobold(c, r, s, ph, seed) {
    const rng = mulberry32(seed), B = P.bone, BD = P.boneDark, sway = Math.sin(ph * TAU);
    c.lineCap = 'round';
    // the tail whips behind it
    c.strokeStyle = B; c.beginPath(); c.moveTo(-r * 0.4, 0);
    for (let i = 1; i <= 8; i++) { const k = i / 8; c.lineTo(-r * (0.4 + k * 1.2), Math.sin(k * 3 - ph * TAU) * r * 0.3 * k); }
    c.lineWidth = r * 0.09; c.stroke();
    for (let i = 1; i <= 8; i++) { const k = i / 8; c.beginPath(); c.arc(-r * (0.4 + k * 1.2), Math.sin(k * 3 - ph * TAU) * r * 0.3 * k, r * (0.08 - k * 0.04), 0, TAU); c.fillStyle = i % 2 ? B : BD; c.fill(); }
    // four legs in a trot
    for (const [lx, side, st] of [[r * 0.35, -1, sway], [r * 0.35, 1, -sway], [-r * 0.3, -1, -sway], [-r * 0.3, 1, sway]]) {
      const kx = lx + st * r * 0.25, ky = side * r * 0.45, fx = kx + r * 0.2 + st * r * 0.1, fy = side * r * 0.62;
      limb(c, lx, side * r * 0.12, kx, ky, r * 0.06, r * 0.05, B); limb(c, kx, ky, fx, fy, r * 0.05, r * 0.04, BD);
      for (let i = -1; i <= 1; i++) { c.strokeStyle = B; c.lineWidth = r * 0.03; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + r * 0.14, fy + i * r * 0.07); c.stroke(); }
    }
    // spine and ribs
    for (let i = 0; i < 7; i++) {
      const x = -r * 0.4 + i * r * 0.13;
      for (const side of [-1, 1]) { c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + r * 0.04, side * r * 0.24, x - r * 0.08, side * r * 0.3); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = r * 0.07; c.stroke(); c.strokeStyle = B; c.lineWidth = r * 0.04; c.stroke(); }
      c.beginPath(); c.arc(x, 0, r * 0.06, 0, TAU); c.fillStyle = i % 2 ? B : BD; c.fill();
    }
    // a scrap of red hide still on it
    blob(c, -r * 0.1, -r * 0.1, r * 0.2, rng, 8, 0.6, 0.8); c.fillStyle = 'rgba(140,40,30,0.75)'; c.fill();
    // the skull: a long snout, two swept horns, ember eyes
    const hx = r * 0.68;
    for (const sy of [-1, 1]) { c.beginPath(); c.moveTo(hx - r * 0.05, sy * r * 0.12); c.quadraticCurveTo(hx - r * 0.3, sy * r * 0.35, hx - r * 0.45, sy * r * 0.3); c.lineTo(hx - r * 0.1, sy * r * 0.06); c.fillStyle = '#3a2a1a'; c.fill(); }
    c.beginPath(); c.moveTo(hx - r * 0.15, -r * 0.2); c.lineTo(hx + r * 0.45, -r * 0.08); c.lineTo(hx + r * 0.45, r * 0.08); c.lineTo(hx - r * 0.15, r * 0.2); c.closePath();
    c.fillStyle = rg(c, hx, -r * 0.05, r * 0.35, '#f4eedc', '#8f8670'); c.fill();
    for (const sy of [-1, 1]) { c.fillStyle = '#120e0a'; c.beginPath(); c.ellipse(hx + r * 0.05, sy * r * 0.1, r * 0.07, r * 0.06, 0, 0, TAU); c.fill(); c.fillStyle = '#ff6a20'; c.beginPath(); c.arc(hx + r * 0.06, sy * r * 0.1, r * 0.03, 0, TAU); c.fill(); }
    c.fillStyle = '#e8e0cc'; for (let i = 0; i < 5; i++) for (const sy of [-1, 1]) c.fillRect(hx + r * (0.15 + i * 0.06), sy * r * 0.08 - r * 0.015, r * 0.03, r * 0.03);
  }
  // Dino Valley: a little dinosaur, risen and rotting, running on two legs in a pack
  function drawCompy(c, r, s, ph, seed) {
    const rng = mulberry32(seed), sk = s.skin || '#7a8a4a', run = Math.sin(ph * TAU);
    c.beginPath(); c.moveTo(-r * 0.3, -r * 0.18);
    c.quadraticCurveTo(-r * 1.1, run * r * 0.25, -r * 1.7, Math.sin(ph * TAU + 1) * r * 0.3); c.quadraticCurveTo(-r * 1.1, r * 0.1 + run * r * 0.2, -r * 0.3, r * 0.18);
    c.fillStyle = g2(c, 0, -r * 0.2, 0, r * 0.2, [[0, shade(sk, 0.15)], [1, shade(sk, -0.45)]]); c.fill();
    for (const [side, st] of [[-1, run], [1, -run]]) {
      const fx = st * r * 0.5, fy = side * r * 0.32;
      limb(c, -r * 0.1, side * r * 0.2, fx, fy, r * 0.13, r * 0.07, shade(sk, -0.15));
      c.fillStyle = '#2a2018'; for (const k of [-1, 0, 1]) { c.beginPath(); c.ellipse(fx + r * 0.12, fy + k * r * 0.06, r * 0.08, r * 0.03, k * 0.4, 0, TAU); c.fill(); }
    }
    c.beginPath(); c.ellipse(0, 0, r * 0.48, r * 0.3, 0, 0, TAU); c.fillStyle = rg(c, -r * 0.05, -r * 0.08, r * 0.5, shade(sk, 0.25), shade(sk, -0.5)); c.fill();
    c.strokeStyle = 'rgba(40,50,20,0.5)'; c.lineWidth = r * 0.05; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-r * 0.35 + i * r * 0.18, -r * 0.25); c.lineTo(-r * 0.3 + i * r * 0.18, r * 0.25); c.stroke(); }
    wound(c, rng, -r * 0.1, r * 0.08, r * 0.14);
    for (const side of [-1, 1]) limb(c, r * 0.3, side * r * 0.15, r * 0.55, side * r * 0.25, r * 0.05, r * 0.035, sk);
    limb(c, r * 0.3, 0, r * 0.65, 0, r * 0.13, r * 0.1, sk, false);
    c.beginPath(); c.ellipse(r * 0.8, 0, r * 0.26, r * 0.15, 0, 0, TAU); c.fillStyle = rg(c, r * 0.78, -r * 0.05, r * 0.28, shade(sk, 0.3), shade(sk, -0.4)); c.fill();
    c.fillStyle = '#3a0e0a'; c.beginPath(); c.moveTo(r * 0.9, -r * 0.06); c.lineTo(r * 1.08, 0); c.lineTo(r * 0.9, r * 0.06); c.fill();
    for (const sy of [-1, 1]) { c.fillStyle = '#ff3a2a'; c.beginPath(); c.arc(r * 0.78, sy * r * 0.1, r * 0.045, 0, TAU); c.fill(); }
  }
  // Dino Valley: a low armoured dinosaur with plates and spikes down its back and a club tail
  function drawAnkylo(c, r, s, ph, seed) {
    const rng = mulberry32(seed), sk = s.skin || '#6a7048', step = Math.sin(ph * TAU), swing = Math.sin(ph * TAU) * 0.4;
    // the tail and its bony club, swinging
    c.save(); c.translate(-r * 0.75, 0); c.rotate(swing);
    c.beginPath(); c.moveTo(0, -r * 0.2); c.quadraticCurveTo(-r * 0.5, -r * 0.08, -r * 0.8, 0); c.quadraticCurveTo(-r * 0.5, r * 0.08, 0, r * 0.2); c.fillStyle = shade(sk, -0.15); c.fill();
    c.beginPath(); c.ellipse(-r * 0.9, 0, r * 0.2, r * 0.24, 0, 0, TAU); c.fillStyle = rg(c, -r * 0.95, -r * 0.08, r * 0.25, '#c8bca0', '#5a5040'); c.fill();
    for (const sy of [-1, 1]) { c.beginPath(); c.moveTo(-r * 0.85, sy * r * 0.18); c.lineTo(-r * 0.9, sy * r * 0.36); c.lineTo(-r * 0.98, sy * r * 0.18); c.fillStyle = '#d8ccb0'; c.fill(); }
    c.restore();
    for (const [lx, side, st] of [[r * 0.4, -1, step], [r * 0.4, 1, -step], [-r * 0.4, -1, -step], [-r * 0.4, 1, step]]) {
      const fx = lx + st * r * 0.15, fy = side * r * 0.68;
      limb(c, lx, side * r * 0.4, fx, fy, r * 0.16, r * 0.13, shade(sk, -0.2));
      c.fillStyle = '#2a2418'; c.beginPath(); c.ellipse(fx + r * 0.04, fy + side * r * 0.04, r * 0.13, r * 0.1, 0, 0, TAU); c.fill();
    }
    // the armoured back: rows of plates, spikes along both edges
    c.beginPath(); c.ellipse(0, 0, r * 0.82, r * 0.6, 0, 0, TAU); c.fillStyle = rg(c, -r * 0.1, -r * 0.15, r * 0.85, shade(sk, 0.15), shade(sk, -0.55)); c.fill();
    for (let i = 0; i < 10; i++) {
      const k = i / 9, x = lerp(-r * 0.7, r * 0.65, k), y = Math.sqrt(Math.max(0, 1 - (x / (r * 0.82)) ** 2)) * r * 0.6;
      for (const sy of [-1, 1]) { c.beginPath(); c.moveTo(x - r * 0.07, sy * y * 0.92); c.lineTo(x, sy * (y + r * 0.2)); c.lineTo(x + r * 0.07, sy * y * 0.92); c.closePath(); c.fillStyle = rg(c, x, sy * y, r * 0.2, '#e0d4b8', '#6a6048'); c.fill(); }
    }
    for (let row = -2; row <= 2; row++) for (let i = 0; i < 5 - Math.abs(row); i++) {
      const x = (i - (4 - Math.abs(row)) / 2) * r * 0.3, y = row * r * 0.2;
      c.beginPath(); c.ellipse(x, y, r * 0.11, r * 0.08, 0, 0, TAU); c.fillStyle = rg(c, x - r * 0.03, y - r * 0.03, r * 0.12, '#b8ac8c', '#4a4434'); c.fill();
    }
    // a torn patch where the ribs show
    c.save(); c.beginPath(); c.ellipse(-r * 0.2, r * 0.3, r * 0.2, r * 0.14, 0.2, 0, TAU); c.clip(); c.fillStyle = '#5a1a14'; c.fillRect(-r, -r, r * 2, r * 2);
    c.strokeStyle = P.bone; c.lineWidth = r * 0.04; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-r * 0.36 + i * r * 0.1, r * 0.15); c.lineTo(-r * 0.32 + i * r * 0.1, r * 0.45); c.stroke(); } c.restore();
    c.beginPath(); c.ellipse(r * 0.95, 0, r * 0.24, r * 0.22, 0, 0, TAU); c.fillStyle = rg(c, r * 0.92, -r * 0.06, r * 0.26, shade(sk, 0.2), shade(sk, -0.45)); c.fill();
    for (const sy of [-1, 1]) { c.beginPath(); c.moveTo(r * 0.85, sy * r * 0.15); c.lineTo(r * 0.8, sy * r * 0.32); c.lineTo(r * 0.95, sy * r * 0.2); c.fillStyle = '#d8ccb0'; c.fill(); c.fillStyle = '#c8ff60'; c.beginPath(); c.arc(r * 1.05, sy * r * 0.1, r * 0.035, 0, TAU); c.fill(); }
    speckle(c, rng, 0, 0, r * 0.7, r * 0.5, 30, ['rgba(80,100,40,0.35)', 'rgba(60,30,30,0.3)'], r * 0.05);
  }
  // Visitors: a Holstein that came back down wrong. Torn hide, ribs, red eyes, horns lowered
  function drawCow(c, r, s, ph, seed) {
    const rng = mulberry32(seed), step = Math.sin(ph * TAU), hide = '#ece6d8';
    for (const [lx, side, st] of [[r * 0.5, -1, step], [r * 0.5, 1, -step], [-r * 0.45, -1, -step], [-r * 0.45, 1, step]]) {
      const fx = lx + st * r * 0.3, fy = side * r * 0.52;
      limb(c, lx, side * r * 0.35, fx, fy, r * 0.12, r * 0.09, '#d8d0c0');
      c.fillStyle = '#2a2420'; c.beginPath(); c.ellipse(fx + r * 0.05, fy, r * 0.1, r * 0.08, 0, 0, TAU); c.fill();
    }
    c.strokeStyle = '#d8d0c0'; c.lineWidth = r * 0.05; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-r * 0.85, 0); c.quadraticCurveTo(-r * 1.1, Math.sin(ph * TAU * 2) * r * 0.2, -r * 1.25, Math.sin(ph * TAU * 2 + 1) * r * 0.25); c.stroke();
    c.fillStyle = '#2a2420'; c.beginPath(); c.arc(-r * 1.27, Math.sin(ph * TAU * 2 + 1) * r * 0.25, r * 0.07, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(0, 0, r * 0.9, r * 0.5, 0, 0, TAU); c.fillStyle = rg(c, -r * 0.1, -r * 0.15, r * 0.95, '#fffaf0', '#8a8478'); c.fill();
    c.save(); c.beginPath(); c.ellipse(0, 0, r * 0.9, r * 0.5, 0, 0, TAU); c.clip();
    for (let i = 0; i < 5; i++) { blob(c, (rng() - 0.5) * r * 1.5, (rng() - 0.5) * r * 0.8, r * (0.16 + rng() * 0.14), rng, 10, 0.5); c.fillStyle = '#1e1c1a'; c.fill(); }
    // ribs through a tear in the hide, and a few greenish rot blotches
    c.beginPath(); c.ellipse(r * 0.1, r * 0.22, r * 0.3, r * 0.16, 0.1, 0, TAU); c.fillStyle = '#6a1a14'; c.fill();
    c.strokeStyle = P.bone; c.lineWidth = r * 0.045; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-r * 0.12 + i * r * 0.11, r * 0.1); c.lineTo(-r * 0.08 + i * r * 0.11, r * 0.36); c.stroke(); }
    for (let i = 0; i < 4; i++) { blob(c, (rng() - 0.5) * r * 1.4, (rng() - 0.5) * r * 0.7, r * 0.1, rng, 8, 0.5); c.fillStyle = 'rgba(110,150,60,0.4)'; c.fill(); }
    c.restore();
    // the head lowered to charge
    c.beginPath(); c.ellipse(r * 1.02, 0, r * 0.3, r * 0.24, 0, 0, TAU); c.fillStyle = rg(c, r, -r * 0.05, r * 0.32, hide, '#7a746a'); c.fill();
    blob(c, r * 0.98, -r * 0.08, r * 0.12, rng, 8, 0.4); c.fillStyle = '#1e1c1a'; c.fill();
    c.beginPath(); c.ellipse(r * 1.25, 0, r * 0.12, r * 0.17, 0, 0, TAU); c.fillStyle = '#d8a8a0'; c.fill();
    for (const sy of [-1, 1]) {
      c.fillStyle = '#4a1a14'; c.beginPath(); c.arc(r * 1.3, sy * r * 0.07, r * 0.03, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(r * 0.9, sy * r * 0.18); c.quadraticCurveTo(r * 0.95, sy * r * 0.42, r * 1.15, sy * r * 0.4); c.lineTo(r * 0.98, sy * r * 0.18); c.fillStyle = '#e8dcc0'; c.fill();
      c.fillStyle = '#ff2a1a'; c.beginPath(); c.arc(r * 1.08, sy * r * 0.15, r * 0.04, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(r * 0.82, sy * r * 0.26, r * 0.1, r * 0.05, sy * 0.6, 0, TAU); c.fillStyle = '#c8c0b0'; c.fill();
    }
  }
  // Visitors: a small grey alien, gone the way of everything else, big black eyes and green rot
  function drawGrey(c, r, s, ph, seed) {
    const rng = mulberry32(seed), sk = '#a8b0a4', step = Math.sin(ph * TAU);
    for (const [side, st] of [[-1, step], [1, -step]]) { const fx = st * r * 0.35, fy = side * r * 0.2; limb(c, -r * 0.1, side * r * 0.12, fx, fy, r * 0.07, r * 0.06, '#8a9488'); c.fillStyle = '#6a7268'; c.beginPath(); c.ellipse(fx + r * 0.06, fy, r * 0.1, r * 0.06, 0, 0, TAU); c.fill(); }
    for (const side of [-1, 1]) {
      const sway = Math.sin((ph + (side > 0 ? 0.3 : 0)) * TAU) * r * 0.1;
      limb(c, 0, side * r * 0.3, r * 0.35, side * r * 0.45, r * 0.06, r * 0.05, sk);
      limb(c, r * 0.35, side * r * 0.45, r * 0.75 + sway, side * r * 0.35, r * 0.05, r * 0.04, sk);
      for (let i = 0; i < 3; i++) { c.strokeStyle = sk; c.lineWidth = r * 0.03; c.beginPath(); c.moveTo(r * 0.75 + sway, side * r * 0.35); c.lineTo(r * 0.95 + sway, side * r * (0.3 + (i - 1) * 0.08)); c.stroke(); }
    }
    c.beginPath(); c.ellipse(-r * 0.05, 0, r * 0.25, r * 0.32, 0, 0, TAU); c.fillStyle = rg(c, -r * 0.08, -r * 0.08, r * 0.35, '#c8d0c4', '#5a6458'); c.fill();
    // the head is most of it: huge, bulbous, almond eyes looking ahead
    const hx = r * 0.32, hr = r * 0.55;
    c.beginPath(); c.ellipse(hx, 0, hr * 0.85, hr, 0, 0, TAU); c.fillStyle = rg(c, hx - hr * 0.2, -hr * 0.3, hr * 1.1, '#dce4d8', '#5a6458'); c.fill();
    for (let i = 0; i < 4; i++) { blob(c, hx + (rng() - 0.6) * hr, (rng() - 0.5) * hr * 1.4, hr * (0.1 + rng() * 0.1), rng, 8, 0.5); c.fillStyle = 'rgba(90,130,60,0.5)'; c.fill(); }
    for (let i = 0; i < 3; i++) veins(c, rng, hx + (rng() - 0.5) * hr, (rng() - 0.5) * hr, hr * 0.8, rng() * TAU, 'rgba(60,110,50,0.6)');
    for (const sy of [-1, 1]) {
      c.save(); c.translate(hx + hr * 0.45, sy * hr * 0.42); c.rotate(sy * 0.55);
      c.beginPath(); c.ellipse(0, 0, hr * 0.3, hr * 0.16, 0, 0, TAU); c.fillStyle = '#060806'; c.fill();
      c.fillStyle = 'rgba(120,255,160,0.55)'; c.beginPath(); c.ellipse(hr * 0.05, -hr * 0.04, hr * 0.08, hr * 0.04, 0, 0, TAU); c.fill();
      c.restore();
    }
    c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.ellipse(hx - hr * 0.25, -hr * 0.35, hr * 0.3, hr * 0.12, -0.6, 0, TAU); c.fill();
  }
  // extra wear for the expedition people: charred skin with embers in the cracks, or the
  // sodden look of someone pulled up from the sea floor
  function drawChar(c, r, s, rng) {
    const sw = r * 0.8 * (s.wide || 1), td = r * 0.46;
    c.save(); torsoPath(c, td * 1.02, sw * 1.02); c.clip();
    cracks(c, rng, 0, 0, td, sw, 9, r * 0.022);
    c.restore();
    for (let i = 0; i < 10; i++) { c.fillStyle = rng() < 0.5 ? 'rgba(255,170,60,0.9)' : 'rgba(255,90,20,0.8)'; c.beginPath(); c.arc((rng() - 0.5) * td * 2, (rng() - 0.5) * sw * 1.8, r * (0.02 + rng() * 0.025), 0, TAU); c.fill(); }
  }
  function drawDrowned(c, r, s, rng) {
    const sw = r * 0.8 * (s.wide || 1), td = r * 0.46;
    c.lineCap = 'round';
    // weed hangs off the shoulders and trails behind, clear of the face
    for (let i = 0; i < 4; i++) {
      const y = (i < 2 ? -1 : 1) * sw * (0.55 + rng() * 0.35), len = r * (0.25 + rng() * 0.3);
      c.strokeStyle = rng() < 0.5 ? '#3a6a2a' : '#4a7a3a'; c.lineWidth = r * (0.035 + rng() * 0.03);
      c.beginPath(); c.moveTo(-td * 0.1, y); c.bezierCurveTo(-td * 0.5, y + r * 0.08, -td * 0.8, y - r * 0.06, -td - len, y + (rng() - 0.5) * r * 0.2); c.stroke();
    }
    for (let i = 0; i < 6; i++) { const x = (rng() - 0.6) * td * 1.6, y = (rng() - 0.5) * sw * 1.4, br = r * (0.03 + rng() * 0.03); c.beginPath(); c.arc(x, y, br, 0, TAU); c.fillStyle = '#d8d0b8'; c.fill(); c.beginPath(); c.arc(x, y, br * 0.45, 0, TAU); c.fillStyle = '#3a3428'; c.fill(); }
    c.fillStyle = 'rgba(200,230,240,0.18)'; torsoPath(c, td * 0.8, sw * 0.8); c.fill();
  }
  // the boss art from the design sheet, drawn in a lit sprite box
  function drawWonderBoss(c, r, s, ph) {
    const t = ph * TAU;
    WONDER_ART.draw(s.art, c, r, t, r * s.box * 0.48);
  }

  // a four-legged hunter: hellhound, smoke hound or shadow hound, depending on its colours
  function drawHound(c, r, s, ph, seed) {
    const rng = mulberry32(seed), fur = s.fur || '#4a4440', run = Math.sin(ph * TAU);
    c.beginPath(); c.moveTo(-r * 0.6, -r * 0.08); c.quadraticCurveTo(-r * 1.1, run * r * 0.25, -r * 1.35, run * r * 0.35); c.lineWidth = r * 0.12; c.strokeStyle = shade(fur, -0.2); c.lineCap = 'round'; c.stroke();
    for (const [lx, side, st] of [[r * 0.45, -1, run], [r * 0.45, 1, -run], [-r * 0.45, -1, -run], [-r * 0.45, 1, run]]) {
      const fx = lx + st * r * 0.35, fy = side * r * 0.42;
      limb(c, lx, side * r * 0.2, fx, fy, r * 0.11, r * 0.07, shade(fur, -0.15));
      c.fillStyle = '#1a1614'; c.beginPath(); c.ellipse(fx + r * 0.06, fy, r * 0.08, r * 0.06, 0, 0, TAU); c.fill();
    }
    c.beginPath(); c.ellipse(-r * 0.05, 0, r * 0.7, r * 0.3, 0, 0, TAU); c.fillStyle = rg(c, -r * 0.1, -r * 0.08, r * 0.7, shade(fur, 0.25), shade(fur, -0.5)); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = r * 0.03; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-r * 0.5 + i * r * 0.18, -r * 0.24); c.lineTo(-r * 0.56 + i * r * 0.18, r * 0.24); c.stroke(); }
    wound(c, rng, -r * 0.2, r * 0.1, r * 0.12);
    c.beginPath(); c.ellipse(r * 0.75, 0, r * 0.3, r * 0.2, 0, 0, TAU); c.fillStyle = rg(c, r * 0.72, -r * 0.05, r * 0.32, shade(fur, 0.2), shade(fur, -0.45)); c.fill();
    c.beginPath(); c.ellipse(r * 1.0, 0, r * 0.16, r * 0.11, 0, 0, TAU); c.fillStyle = shade(fur, -0.1); c.fill();
    for (const sy of [-1, 1]) {
      c.beginPath(); c.moveTo(r * 0.65, sy * r * 0.12); c.lineTo(r * 0.5, sy * r * 0.3); c.lineTo(r * 0.75, sy * r * 0.18); c.fillStyle = shade(fur, -0.3); c.fill();
      c.fillStyle = s.eye || '#ff4a2a'; c.beginPath(); c.arc(r * 0.85, sy * r * 0.1, r * 0.04, 0, TAU); c.fill();
    }
    c.fillStyle = '#f0e8d8'; for (const sy of [-1, 1]) { c.beginPath(); c.moveTo(r * 1.08, sy * r * 0.06); c.lineTo(r * 1.14, sy * r * 0.02); c.lineTo(r * 1.1, sy * r * 0.1); c.fill(); }
    if (s.smoke) for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(-r * (0.3 + rng() * 0.9), (rng() - 0.5) * r * 0.6, r * (0.15 + rng() * 0.15), 0, TAU); c.fillStyle = `rgba(${s.smoke},${0.25 + rng() * 0.2})`; c.fill(); }
  }
  // a walking tree, its roots for legs and its crown for shoulders
  function drawTreant(c, r, s, ph, seed) {
    const rng = mulberry32(seed), bark = s.bark || '#3a2a1e', step = Math.sin(ph * TAU);
    for (let i = 0; i < 6; i++) { const a = Math.PI + (i - 2.5) * 0.35, k = (i % 2 ? step : -step) * 0.15; limb(c, Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4, Math.cos(a + k) * r * 1.0, Math.sin(a + k) * r * 0.9, r * 0.1, r * 0.04, shade(bark, -0.1)); }
    for (const sd of [-1, 1]) {
      const sway = Math.sin((ph + (sd > 0 ? 0.3 : 0)) * TAU) * r * 0.1;
      limb(c, r * 0.1, sd * r * 0.45, r * 0.75 + sway, sd * r * 0.75, r * 0.15, r * 0.08, bark);
      for (let k = 0; k < 3; k++) limb(c, r * 0.75 + sway, sd * r * 0.75, r * (0.95 + k * 0.08) + sway, sd * r * (0.62 + k * 0.14), r * 0.05, r * 0.02, shade(bark, -0.2));
    }
    blob(c, 0, 0, r * 0.62, rng, 12, 0.25); c.fillStyle = rg(c, -r * 0.1, -r * 0.1, r * 0.65, shade(bark, 0.25), shade(bark, -0.5)); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = r * 0.02; for (let k = 1; k < 4; k++) { c.beginPath(); c.ellipse(-r * 0.05, 0, r * k * 0.13, r * k * 0.12, 0, 0, TAU); c.stroke(); }
    if (s.ember) cracks(c, rng, 0, 0, r * 0.5, r * 0.5, 4, r * 0.035);
    // a crown of leaves, scorched, blighted or still green
    for (let i = 0; i < 12; i++) { const a = rng() * TAU, d = r * (0.35 + rng() * 0.3); blob(c, Math.cos(a) * d, Math.sin(a) * d, r * (0.14 + rng() * 0.08), rng, 7, 0.4); c.fillStyle = (s.leaves || ['#3a2a1a', '#5a3a1a'])[i % 2]; c.fill(); }
    c.fillStyle = '#120c08'; c.beginPath(); c.ellipse(r * 0.35, 0, r * 0.12, r * 0.22, 0, 0, TAU); c.fill();
    for (const sy of [-1, 1]) { c.fillStyle = s.eye || '#ffa040'; c.beginPath(); c.arc(r * 0.42, sy * r * 0.1, r * 0.045, 0, TAU); c.fill(); }
  }
  // a glowing floating light with a trailing tail: ember sprites and prism wisps
  function drawWisp(c, r, s, ph) {
    const col = s.col || '255,160,60', fl = Math.sin(ph * TAU * 2);
    for (let i = 0; i < 6; i++) { const k = i / 6; c.beginPath(); c.arc(-r * (0.4 + k * 1.3), Math.sin(ph * TAU + k * 4) * r * 0.25, r * (0.45 - k * 0.3), 0, TAU); c.fillStyle = `rgba(${col},${0.5 - k * 0.4})`; c.fill(); }
    c.beginPath(); c.arc(0, 0, r * (0.75 + fl * 0.05), 0, TAU); c.fillStyle = rg(c, r * 0.1, -r * 0.1, r * 0.8, '#ffffff', `rgba(${col},0.9)`); c.fill();
    if (s.facets) { c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = r * 0.05; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + ph * TAU; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); c.stroke(); } }
    for (const sy of [-1, 1]) { c.fillStyle = 'rgba(30,10,0,0.75)'; c.beginPath(); c.ellipse(r * 0.3, sy * r * 0.22, r * 0.1, r * 0.08, 0, 0, TAU); c.fill(); }
  }
  // a big pale moth, its wings beating, drawn to lights
  function drawMoth(c, r, s, ph) {
    const flap = 0.55 + Math.abs(Math.sin(ph * TAU)) * 0.45, wing = s.wing || ['#d8dcf0', '#8a90b8'];
    for (const sd of [-1, 1]) {
      c.save(); c.scale(1, sd * flap);
      c.beginPath(); c.moveTo(r * 0.1, r * 0.05); c.quadraticCurveTo(r * 0.7, r * 0.9, r * 0.1, r * 1.1); c.quadraticCurveTo(-r * 0.3, r * 0.6, -r * 0.05, r * 0.05); c.fillStyle = rg(c, r * 0.2, r * 0.5, r * 0.8, wing[0], wing[1]); c.fill();
      c.beginPath(); c.moveTo(-r * 0.05, r * 0.05); c.quadraticCurveTo(-r * 0.6, r * 0.8, -r * 0.65, r * 0.5); c.quadraticCurveTo(-r * 0.5, r * 0.2, -r * 0.2, r * 0.05); c.fillStyle = shade(wing[1], -0.1); c.fill();
      c.beginPath(); c.arc(r * 0.25, r * 0.6, r * 0.14, 0, TAU); c.fillStyle = s.spot || '#4a4a8a'; c.fill(); c.beginPath(); c.arc(r * 0.25, r * 0.6, r * 0.06, 0, TAU); c.fillStyle = '#e8f0ff'; c.fill();
      c.restore();
    }
    c.beginPath(); c.ellipse(0, 0, r * 0.4, r * 0.12, 0, 0, TAU); c.fillStyle = rg(c, 0, 0, r * 0.4, '#e8e4f0', '#5a5470'); c.fill();
    c.strokeStyle = '#3a3450'; c.lineWidth = r * 0.03; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(r * 0.35, sd * r * 0.03); c.quadraticCurveTo(r * 0.6, sd * r * 0.1, r * 0.7, sd * r * 0.25); c.stroke(); }
    for (const sd of [-1, 1]) { c.fillStyle = '#c8ff80'; c.beginPath(); c.arc(r * 0.36, sd * r * 0.06, r * 0.03, 0, TAU); c.fill(); }
  }
  // a heavy body of jagged crystal or obsidian that lumbers along on stumpy legs
  function drawGolem(c, r, s, ph, seed) {
    const rng = mulberry32(seed), col = s.col || '#9a7ad8', step = Math.sin(ph * TAU);
    for (const [side, st] of [[-1, step], [1, -step]]) { c.beginPath(); c.ellipse(st * r * 0.3, side * r * 0.45, r * 0.22, r * 0.16, 0, 0, TAU); c.fillStyle = shade(col, -0.45); c.fill(); }
    for (const sd of [-1, 1]) { const sway = Math.sin((ph + (sd > 0 ? 0.3 : 0)) * TAU) * r * 0.1; c.beginPath(); c.moveTo(r * 0.1, sd * r * 0.5); c.lineTo(r * 0.75 + sway, sd * r * 0.7); c.lineTo(r * 0.85 + sway, sd * r * 0.5); c.lineTo(r * 0.2, sd * r * 0.3); c.closePath(); c.fillStyle = shade(col, -0.2); c.fill(); }
    // facets: a cluster of shards with lit faces
    for (let i = 0; i < 9; i++) {
      const a = rng() * TAU, d = rng() * r * 0.35, x = Math.cos(a) * d, y = Math.sin(a) * d, l = r * (0.35 + rng() * 0.25), b = rng() * TAU;
      c.beginPath(); c.moveTo(x + Math.cos(b) * l, y + Math.sin(b) * l); c.lineTo(x + Math.cos(b + 2.2) * l * 0.6, y + Math.sin(b + 2.2) * l * 0.6); c.lineTo(x + Math.cos(b + 4) * l * 0.6, y + Math.sin(b + 4) * l * 0.6); c.closePath();
      c.fillStyle = g2(c, x - l, y - l, x + l, y + l, [[0, shade(col, 0.45)], [0.5, col], [1, shade(col, -0.5)]]); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = r * 0.02; c.stroke();
    }
    c.fillStyle = s.eye || '#ffffff'; for (const sy of [-1, 1]) { c.beginPath(); c.arc(r * 0.45, sy * r * 0.12, r * 0.05, 0, TAU); c.fill(); }
  }
  // a crawling carpet of beetles with gold-green shells
  function drawScarabs(c, r, s, ph, seed) {
    const rng = mulberry32(seed);
    for (let i = 0; i < 11; i++) {
      const x = (rng() - 0.45) * r * 1.6 + Math.sin(ph * TAU + i) * r * 0.06, y = (rng() - 0.5) * r * 1.3, a = (rng() - 0.5) * 0.8, k = r * (0.2 + rng() * 0.08);
      c.save(); c.translate(x, y); c.rotate(a);
      c.strokeStyle = '#1a1408'; c.lineWidth = k * 0.15; for (const sd of [-1, 1]) for (let l = -1; l <= 1; l++) { c.beginPath(); c.moveTo(l * k * 0.4, 0); c.lineTo(l * k * 0.5 + Math.sin(ph * TAU * 2 + i + l) * k * 0.2, sd * k * 0.9); c.stroke(); }
      c.beginPath(); c.ellipse(0, 0, k, k * 0.7, 0, 0, TAU); c.fillStyle = rg(c, -k * 0.3, -k * 0.3, k, '#e8d870', '#2a5a2a'); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = k * 0.08; c.beginPath(); c.moveTo(-k, 0); c.lineTo(k * 0.6, 0); c.stroke();
      c.beginPath(); c.ellipse(k * 0.85, 0, k * 0.3, k * 0.35, 0, 0, TAU); c.fillStyle = '#1a2a10'; c.fill();
      c.restore();
    }
  }
  // a feathered zombie raptor; with a rider, a zombie clinging on to its back
  function drawRaptor(c, r, s, ph, seed) {
    drawCompy(c, r, { skin: s.skin || '#7a6248' }, ph, seed);
    const rng = mulberry32(seed + 5);
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-r * (0.3 + i * 0.12), 0); c.lineTo(-r * (0.45 + i * 0.12), (i % 2 ? 1 : -1) * r * 0.3); c.lineTo(-r * (0.38 + i * 0.12), 0); c.fillStyle = i % 2 ? '#c84a2a' : '#2a6a8a'; c.fill(); }
    if (s.rider) {
      c.save(); c.scale(0.62, 0.62); c.translate(-r * 0.1, 0);
      const sw = r * 0.7, td = r * 0.4;
      for (const sd of [-1, 1]) limb(c, 0, sd * sw * 0.8, r * 0.7, sd * sw * 0.4, r * 0.14, r * 0.11, SKIN[0]);
      torsoPath(c, td, sw); c.fillStyle = rg(c, 0, 0, sw, '#7a5a3a', '#2a1a10'); c.fill();
      drawHead(c, { skin: SKIN[0], eye: '#e8e0a0' }, rng, td * 0.5, r * 0.3, r);
      drawHair(c, { hair: '#2a2018', hairStyle: 'long', skin: SKIN[0] }, rng, td * 0.5, r * 0.3);
      c.restore();
    }
  }
  // a seed of green star-crystal on little legs, splitting as it goes
  function drawSeed(c, r, s, ph, seed) {
    const rng = mulberry32(seed), step = Math.sin(ph * TAU * 2);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + step * 0.2; c.strokeStyle = '#2a3a20'; c.lineWidth = r * 0.08; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); c.stroke(); }
    c.beginPath(); c.arc(0, 0, r * 0.55, 0, TAU); c.fillStyle = rg(c, -r * 0.15, -r * 0.15, r * 0.6, '#5a6a4a', '#1a2414'); c.fill();
    for (let i = 0; i < 4; i++) { const a = rng() * TAU, l = r * (0.4 + rng() * 0.3); c.beginPath(); c.moveTo(Math.cos(a - 0.3) * r * 0.3, Math.sin(a - 0.3) * r * 0.3); c.lineTo(Math.cos(a) * (r * 0.3 + l), Math.sin(a) * (r * 0.3 + l)); c.lineTo(Math.cos(a + 0.3) * r * 0.3, Math.sin(a + 0.3) * r * 0.3); c.closePath(); c.fillStyle = g2(c, 0, 0, Math.cos(a) * l, Math.sin(a) * l, [[0, '#c8ffb0'], [1, '#2aa04a']]); c.fill(); }
    c.fillStyle = '#e8ffd0'; c.beginPath(); c.arc(r * 0.3, 0, r * 0.08, 0, TAU); c.fill();
  }
  // more wear for the expedition people: crystals growing out of them, glowing rune carvings,
  // flames licking off their shoulders
  function drawCrystals(c, r, s, rng) {
    const sw = r * 0.8 * (s.wide || 1), td = r * 0.46;
    for (let i = 0; i < 6; i++) {
      const x = (rng() - 0.6) * td * 1.6, y = (rng() < 0.5 ? -1 : 1) * sw * (0.3 + rng() * 0.6), a = Math.atan2(y, x - td) + (rng() - 0.5) * 0.5, l = r * (0.25 + rng() * 0.25);
      c.beginPath(); c.moveTo(x + Math.cos(a + 1.6) * r * 0.08, y + Math.sin(a + 1.6) * r * 0.08); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.lineTo(x + Math.cos(a - 1.6) * r * 0.08, y + Math.sin(a - 1.6) * r * 0.08); c.closePath();
      c.fillStyle = g2(c, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, [[0, s.crystal ? shade(s.crystal, -0.3) : '#1a7a3a'], [1, s.crystal ? shade(s.crystal, 0.5) : '#c8ffb0']]); c.fill();
    }
  }
  function drawRunes(c, r, s, rng) {
    const sw = r * 0.8 * (s.wide || 1), td = r * 0.46;
    c.strokeStyle = s.runeCol || '#7ad8ff'; c.lineWidth = r * 0.04; c.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const x = (rng() - 0.6) * td * 1.4, y = (rng() - 0.5) * sw * 1.4, k = r * 0.1;
      c.beginPath(); c.moveTo(x - k, y - k); c.lineTo(x, y + k); c.lineTo(x + k, y - k); if (rng() < 0.5) { c.moveTo(x - k, y); c.lineTo(x + k, y); } c.stroke();
    }
  }
  function drawBurning(c, r, s, rng, ph) {
    const sw = r * 0.8 * (s.wide || 1);
    for (let i = 0; i < 6; i++) {
      const y = (i - 2.5) / 2.5 * sw * 0.9, l = r * (0.35 + rng() * 0.3) * (1 + Math.sin(ph * TAU * 2 + i) * 0.2);
      c.beginPath(); c.moveTo(-r * 0.2, y - r * 0.12); c.quadraticCurveTo(-r * 0.4 - l * 0.5, y, -r * 0.2 - l, y + Math.sin(ph * TAU + i) * r * 0.1); c.quadraticCurveTo(-r * 0.4 - l * 0.4, y + r * 0.1, -r * 0.2, y + r * 0.12);
      c.fillStyle = i % 2 ? 'rgba(255,130,30,0.8)' : 'rgba(255,210,80,0.75)'; c.fill();
    }
  }

  function paint(c, type, look, r, ph, seed) {
    switch (look.kind) {
      case 'drone': return drawDrone(c, r, look, ph, seed);
      case 'magma': return drawMagma(c, r, look, ph, seed);
      case 'ember': return drawEmber(c, r, look, ph, seed);
      case 'crab': return drawCrab(c, r, look, ph, seed);
      case 'kobold': return drawKobold(c, r, look, ph, seed);
      case 'compy': return drawCompy(c, r, look, ph, seed);
      case 'ankylo': return drawAnkylo(c, r, look, ph, seed);
      case 'cow': return drawCow(c, r, look, ph, seed);
      case 'grey': return drawGrey(c, r, look, ph, seed);
      case 'wonder': return drawWonderBoss(c, r, look, ph, seed);
      case 'hound': return drawHound(c, r, look, ph, seed);
      case 'treant': return drawTreant(c, r, look, ph, seed);
      case 'wisp': return drawWisp(c, r, look, ph, seed);
      case 'moth': return drawMoth(c, r, look, ph, seed);
      case 'golem': return drawGolem(c, r, look, ph, seed);
      case 'scarabs': return drawScarabs(c, r, look, ph, seed);
      case 'raptor': return drawRaptor(c, r, look, ph, seed);
      case 'seed': return drawSeed(c, r, look, ph, seed);
      case 'scorpion': return drawScorpion(c, r, look, ph, seed);
      case 'person': return drawPerson(c, r, look, ph, seed);
      case 'skeleton': return drawSkeleton(c, r, look, ph, seed);
      case 'wraith': return drawWraith(c, r, look, ph, seed);
      case 'bloater': return drawBloater(c, r, look, ph, seed);
      case 'crawler': return drawCrawler(c, r, look, ph, seed);
      case 'giant': return drawGiant(c, r, look, ph, seed);
      case 'crow': return drawCrow(c, r, look, ph, seed);
      case 'bats': return drawBats(c, r, look, ph, seed);
    }
  }

  // ---------- premium holiday outfits, worn by the bare-headed zombies ----------
  let OUTFIT = null;
  function drawOutfit(c, kind, hx, hr) {
    c.save(); c.translate(hx, 0);
    if (kind === 'pumpkin') {
      // a jack-o'-lantern for a head: ribbed, with a stem on top and a carved face glowing at the front
      ellipse(c, 0.6, 0.8, hr * 1.3, hr * 1.38); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
      ellipse(c, 0, 0, hr * 1.28, hr * 1.36); c.fillStyle = rg(c, -hr * 0.4, -hr * 0.4, hr * 1.6, '#ffb24a', '#b4480c'); c.fill();
      c.strokeStyle = 'rgba(110,36,4,0.55)'; c.lineWidth = hr * 0.09;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.cos(a + 0.3) * hr * 0.8, Math.sin(a + 0.3) * hr * 0.8, Math.cos(a) * hr * 1.26, Math.sin(a) * hr * 1.34); c.stroke(); }
      c.fillStyle = '#ffd860';
      for (const sy of [-1, 1]) { c.beginPath(); c.moveTo(hr * 0.75, sy * hr * 0.55); c.lineTo(hr * 1.12, sy * hr * 0.32); c.lineTo(hr * 1.1, sy * hr * 0.72); c.closePath(); c.fill(); }
      c.beginPath(); c.moveTo(hr * 1.05, -hr * 0.22); c.lineTo(hr * 1.24, -hr * 0.1); c.lineTo(hr * 1.1, 0); c.lineTo(hr * 1.24, hr * 0.1); c.lineTo(hr * 1.05, hr * 0.22); c.closePath(); c.fill();
      rr(c, -hr * 0.2, -hr * 0.14, hr * 0.4, hr * 0.28, hr * 0.08); c.fillStyle = '#4a6a24'; c.fill();
      c.strokeStyle = '#2e4414'; c.lineWidth = hr * 0.06; c.stroke();
    } else if (kind === 'santa') {
      // a floppy red hat with a fur band and a pom-pom flopping behind
      ellipse(c, 0.6, 0.8, hr * 1.12, hr * 1.12); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
      c.beginPath(); c.moveTo(-hr * 0.2, -hr * 0.75); c.quadraticCurveTo(-hr * 1.4, -hr * 0.2, -hr * 1.75, hr * 0.7); c.quadraticCurveTo(-hr * 1.1, hr * 0.5, -hr * 0.2, hr * 0.75); c.closePath();
      c.fillStyle = '#a3141c'; c.fill();
      circle(c, 0, 0, hr * 0.95); c.fillStyle = rg(c, -hr * 0.3, -hr * 0.3, hr * 1.3, '#f0444a', '#9a121a'); c.fill();
      circle(c, 0, 0, hr * 0.98); c.strokeStyle = '#f4f2ec'; c.lineWidth = hr * 0.34; c.stroke();
      circle(c, -hr * 1.75, hr * 0.7, hr * 0.36); c.fillStyle = rg(c, -hr * 1.85, hr * 0.6, hr * 0.5, '#ffffff', '#cfcac0'); c.fill();
    } else if (kind === 'party') {
      // a striped party cone, seen from above, with a pom-pom on its point
      ellipse(c, 0.6, 0.8, hr * 0.92, hr * 0.92); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
      const cols = ['#ff4a8a', '#ffd23a', '#3ac8ff', '#7ae05a'];
      for (let i = 0; i < 8; i++) {
        c.beginPath(); c.moveTo(hr * 0.1, 0); c.arc(0, 0, hr * 0.88, (i / 8) * TAU, ((i + 1) / 8) * TAU); c.closePath();
        c.fillStyle = cols[i % 4]; c.fill();
      }
      circle(c, 0, 0, hr * 0.88); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = hr * 0.06; c.stroke();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; circle(c, hr * 0.1 + Math.cos(a) * hr * 0.16, Math.sin(a) * hr * 0.16, hr * 0.14); c.fillStyle = cols[i % 4]; c.fill(); }
    }
    c.restore();
  }
  function build(type, variant, outfit) {
    const looks = LOOKS[type] || LOOKS.walker;
    const look = looks[variant % looks.length];
    const r = ZOMBIES[type].r;
    const B = Math.ceil(r * look.box);
    const px = Math.ceil(B * RES);
    const seed = (type.length * 7919 + variant * 104729) | 0;
    const frames = [], shadows = [];
    for (let f = 0; f < FRAMES; f++) {
      const cv = document.createElement('canvas'); cv.width = cv.height = px;
      const c = cv.getContext('2d');
      c.setTransform(RES, 0, 0, RES, px / 2, px / 2);
      c.lineJoin = 'round';
      OUTFIT = look.wrap ? null : outfit; paint(c, type, look, r, f / FRAMES, seed); OUTFIT = null;
      // a recoloured look: a wash of colour over everything just painted
      if (look.tint) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = look.tint; c.fillRect(0, 0, px, px); c.restore(); }
      if (look.wrap) wrapBandages(c, r, look, seed);
      frames.push(cv);
      // soft silhouette for the ground shadow
      const sh = document.createElement('canvas'); sh.width = sh.height = px;
      const s = sh.getContext('2d');
      s.shadowColor = 'rgba(0,0,0,1)'; s.shadowBlur = RES * 2.5; s.shadowOffsetX = px;
      s.drawImage(cv, -px, 0);
      s.globalCompositeOperation = 'source-in'; s.fillStyle = '#000'; s.fillRect(0, 0, px, px);
      shadows.push(sh);
    }
    return { B, frames, shadows, look, frost: [], flash: [] };
  }
  function tinted(spr, kind, f) {
    if (!spr[kind][f]) {
      const src = spr.frames[f], cv = document.createElement('canvas');
      cv.width = src.width; cv.height = src.height;
      const c = cv.getContext('2d');
      c.drawImage(src, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = kind === 'frost' ? 'rgba(200,238,255,0.55)' : '#ffffff';
      c.fillRect(0, 0, cv.width, cv.height);
      spr[kind][f] = cv;
    }
    return spr[kind][f];
  }
  function get(type, variant = 0) {
    const outfit = typeof PREMIUM !== 'undefined' ? PREMIUM.outfit() : null;
    const key = type + ':' + variant + ':' + (outfit || '');
    let spr = cache.get(key);
    if (!spr) { spr = build(type, variant, outfit); cache.set(key, spr); }
    return spr;
  }
  const variants = (type) => (LOOKS[type] || LOOKS.walker).length;
  // Build sprites for a level's zombies a few at a time so the game stays responsive.
  function prewarm(types) {
    const jobs = [];
    for (const t of types) for (let v = 0; v < variants(t); v++) jobs.push([t, v]);
    const next = () => { const j = jobs.shift(); if (!j) return; get(j[0], j[1]); setTimeout(next, 0); };
    setTimeout(next, 0);
  }
  return { get, variants, tinted, prewarm, FRAMES };
})();

// Draws one zombie from its pre-rendered frames.
function drawZombie(c, e, t, lights) {
  const def = ZOMBIES[e.type];
  const r = e.r;
  const ang = Math.atan2(e.diry, e.dirx);
  if (e.burrowed) {
    c.save(); c.translate(e.x, e.y); c.rotate(ang);
    const rng = mulberry32(Math.floor(e.phase * 1000));
    ellipse(c, 2, 3, r * 1.2, r * 0.85); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
    ellipse(c, 0, 0, r * 1.15, r * 0.8); c.fillStyle = radial(c, 0, 0, r * 1.1, '#7a6248', '#3a2c1e'); c.fill();
    for (let i = 0; i < 7; i++) { circle(c, (rng() - 0.5) * r * 1.6, (rng() - 0.5) * r, 1 + rng() * 2); c.fillStyle = rng() < 0.5 ? '#5a4632' : '#8a7458'; c.fill(); }
    c.strokeStyle = 'rgba(20,14,8,0.6)'; c.lineWidth = 1;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-r * 0.7 + i * 5, -4 + (i % 2) * 7); c.lineTo(-r * 0.2 + i * 5, 1); c.stroke(); }
    if (e.revealed) { c.strokeStyle = 'rgba(120,220,255,0.85)'; c.lineWidth = 1.5; circle(c, 0, 0, r * 1.35); c.stroke(); }
    c.restore();
    return;
  }
  const spr = ZART.get(e.type, e.variant | 0);
  const F = ZART.FRAMES;
  const rate = def.fly ? 2.2 : def.speed / (r * 4.5);
  const f = Math.floor((t * rate + e.phase * 0.159) * F) % F;
  const B = spr.B * (e.size || 1);
  const alt = def.fly || def.hover ? 1 : 0;
  // shadow on the ground, offset away from the light; flyers cast it further and fainter
  c.save();
  c.translate(e.x + (alt ? 16 : 3), e.y + (alt ? 22 : 4)); c.rotate(ang);
  c.globalAlpha = alt ? 0.22 : spr.look.kind === 'wraith' ? 0.15 : 0.42;
  const sb = alt ? B * 0.75 : B;
  c.drawImage(spr.shadows[f], -sb / 2, -sb / 2, sb, sb);
  c.restore();
  c.save();
  c.translate(e.x, e.y); c.rotate(ang);
  if (spr.look.kind === 'wraith') c.globalAlpha = 0.9;
  // faded out, or half seen through smoke and grass
  if (e.phased) c.globalAlpha = 0.22; else if (e.hidden) c.globalAlpha = 0.45;
  c.drawImage(spr.frames[f], -B / 2, -B / 2, B, B);
  if (e.shieldT > 0) { c.globalAlpha = 0.7; c.strokeStyle = '#c8ffb0'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, B * 0.38, 0, TAU); c.stroke(); }
  if (e.slowT > 0 && !def.noSlow) { c.globalAlpha = 0.6; c.drawImage(ZART.tinted(spr, 'frost', f), -B / 2, -B / 2, B, B); }
  if (e.flash > 0) { c.globalAlpha = 0.55; c.drawImage(ZART.tinted(spr, 'flash', f), -B / 2, -B / 2, B, B); }
  c.restore();
  if (lights) {
    for (const gl of spr.look.glow || []) {
      const lx = gl.x * r, ly = gl.y * r;
      lights.push({ x: e.x + Math.cos(ang) * lx - Math.sin(ang) * ly, y: e.y + Math.sin(ang) * lx + Math.cos(ang) * ly, r: gl.r, color: gl.color, a: gl.a });
    }
    if (spr.look.gear === 'hardhat') lights.push({ x: e.x + Math.cos(ang) * r * 0.8, y: e.y + Math.sin(ang) * r * 0.8, r: 24, color: '255,240,180', a: 0.4 });
    if (e.burnT > 0) lights.push({ x: e.x, y: e.y, r: r * 2.6, color: '255,140,50', a: 0.5 });
  }
}
