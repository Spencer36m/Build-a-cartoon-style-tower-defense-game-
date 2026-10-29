'use strict';
// ============================================================
// Painted battlefields: ground with relief and texture, worn roads, water with depth, and
// detailed props. Everything here is painted once per level into the background canvas, so
// it can afford the detail. Light comes from the top left; shadows fall down and to the right.
// ============================================================
const TERRAIN = (() => {
  const PAL = {
    farmland: { lo: '#3c5523', mid: '#58752d', hi: '#7a933f', patchA: '#9b8c4c', patchB: '#355024', dirt: '#6f5638', tuft: ['#3f5a22', '#6f8c36', '#8fa848'] },
    graveyard: { lo: '#1b241a', mid: '#2b3626', hi: '#414c36', patchA: '#4a4130', patchB: '#232c20', dirt: '#3a3024', tuft: ['#1f2a1b', '#3a4630', '#55603e'] },
    tundra: { lo: '#c4d0dd', mid: '#d5dfe8', hi: '#f4f7fa', patchA: '#9fb3c4', patchB: '#e9eef3', dirt: '#8a8f94', tuft: ['#8a8466', '#a89e78', '#6f6a54'] },
    swamp: { lo: '#262e16', mid: '#424e27', hi: '#5d6833', patchA: '#352f1c', patchB: '#56702a', dirt: '#3d3420', tuft: ['#34401e', '#56662c', '#748238'] },
    desert: { lo: '#b07c46', mid: '#cd9e62', hi: '#ecca8a', patchA: '#c06e40', patchB: '#e8d4a4', dirt: '#9a7246', tuft: ['#7a6634', '#a48c4a', '#6a5226'] },
  };
  const pal = (world) => PAL[world.id] || PAL.farmland;
  const LX = -0.62, LY = -0.78; // light direction (towards the light)

  // ---------- helpers ----------
  const devK = (c) => { const m = c.getTransform(); return Math.hypot(m.a, m.b) || 1; };
  // a soft shadow of whatever draw() fills, offset down-right, without drawing the shape itself
  function softShadow(c, draw, dx, dy, blur, col = 'rgba(0,0,0,0.42)') {
    const m = c.getTransform(), k = devK(c);
    c.save();
    c.setTransform(m.a, m.b, m.c, m.d, m.e - 30000, m.f);
    c.shadowColor = col; c.shadowBlur = blur * k; c.shadowOffsetX = 30000 + dx * k; c.shadowOffsetY = dy * k;
    c.fillStyle = '#000'; draw(); c.fill();
    c.restore();
  }
  function layer(c) {
    const cv = document.createElement('canvas'); cv.width = c.canvas.width; cv.height = c.canvas.height;
    const g = cv.getContext('2d'); g.setTransform(c.getTransform()); return { cv, g };
  }
  function blit(c, cv) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(cv, 0, 0); c.restore(); }
  const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const hex = (r) => '#' + r.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  // shade() hands back an rgb() string; this keeps the result in hex so it can be shaded again
  const jit = (col, rng, k = 0.12) => { const v = (rng() - 0.5) * k * 2, a = hexRgb(col), t = v >= 0 ? 255 : 0; return hex(a.map((x) => x + (t - x) * Math.abs(v))); };
  function polyPath(c, pts) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
  const free = (M, x, y) => { const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE); if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return false; const g = M.grid[cy * COLS + cx]; return g !== 1 && g !== 3; };

  // ---------- ground ----------
  // a colour field with relief: a height map lit from the top left, with patches, wind ripples
  // in the snow and wet sheen in the swamp, at one pixel per world unit
  function ground(M) {
    if (M.groundTex2) return M.groundTex2;
    const world = M.world, L = M.L, P = pal(world), w = W / 2, h = H / 2;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'), img = g.createImageData(w, h);
    const n1 = makeNoise(L.look.seed), n2 = makeNoise(L.look.seed + 1), n3 = makeNoise(L.look.seed + 2);
    const lo = hexRgb(P.lo), mid = hexRgb(P.mid), hi = hexRgb(P.hi), pa = hexRgb(P.patchA), pb = hexRgb(P.patchB);
    const tone = L.look.tone, snow = world.id === 'tundra', wet = world.id === 'swamp', sand = world.id === 'desert';
    const H2 = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = 0.5 + (fbm(n1, x / 35, y / 35, 4) - 0.5) * 0.7;
      if (snow) v += Math.sin((x * 0.82 + y * 0.42) / 2.75 + fbm(n3, x / 20, y / 20, 2) * 9) * 0.012;
      else if (sand) {
        // long dunes, with wind ripples running across them
        v += Math.sin((x * 0.55 + y * 0.32) / 26 + fbm(n3, x / 60, y / 60, 2) * 5) * 0.09;
        v += Math.sin((x * 0.86 + y * 0.5) / 2.4 + fbm(n3, x / 16, y / 16, 2) * 8) * 0.016;
      } else v += (fbm(n3, x / 4.5, y / 4.5, 2) - 0.5) * 0.05;
      H2[y * w + x] = v;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, v = H2[i];
      let col = v < 0.5 ? mix(lo, mid, clamp(v / 0.5, 0, 1)) : mix(mid, hi, clamp((v - 0.5) / 0.5, 0, 1));
      const p = fbm(n2, x / 55 + 7, y / 55 + 3, 3);
      if (p > 0.58) col = mix(col, pa, Math.min(1, (p - 0.58) * 4) * (snow ? 0.4 : 0.55));
      else if (p < 0.36) col = mix(col, pb, Math.min(1, (0.36 - p) * 4) * 0.5);
      // relief: brighter on slopes facing the light
      const xa = Math.max(0, x - 1), ya = Math.max(0, y - 1), xb = Math.min(w - 1, x + 1), yb = Math.min(h - 1, y + 1);
      const slope = snow ? clamp((H2[ya * w + xa] - H2[yb * w + xb]) * 3, -0.1, 0.05) : (H2[ya * w + xa] - H2[yb * w + xb]) * 3;
      let k = 1 + tone + slope;
      if (wet && p < 0.42) k += 0.06 * Math.max(0, Math.sin(x * 0.14 + y * 0.1));
      const j = 0;
      // snow in shade goes cool blue rather than grey: red drops most, blue least
      const d = 1 - k;
      img.data[i * 4] = clamp(col[0] * k + j, 0, 255);
      img.data[i * 4 + 1] = clamp(col[1] * (snow ? 1 - d * 0.7 : k) + j, 0, 255);
      img.data[i * 4 + 2] = clamp(col[2] * (snow ? 1 - d * 0.3 : k) + j, 0, 255);
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    M.groundTex2 = cv;
    return cv;
  }

  // fine detail scattered over open ground, batched into a few paths per colour
  function groundDetail(c, M) {
    const world = M.world, P = pal(world), rng = mulberry32(M.L.look.seed + 41);
    const paths = P.tuft.map(() => new Path2D());
    c.lineCap = 'round';
    if (world.id === 'desert') {
      // a dry land: sparse wiry grass, pebbles, sun-cracked clay pans and the odd bleached bone
      const tufts = P.tuft.map(() => new Path2D());
      for (let i = 0; i < 520; i++) {
        const x = rng() * W, y = rng() * H; if (!free(M, x, y)) continue;
        for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (rng() - 0.5) * 2.2, l = 1.5 + rng() * 3.5, p = tufts[Math.floor(rng() * 3)]; p.moveTo(x, y); p.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); }
      }
      P.tuft.forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 0.6; c.stroke(tufts[i]); });
      for (let i = 0; i < 7; i++) {
        const x0 = rng() * W, y0 = rng() * H, R = 16 + rng() * 22; if (!free(M, x0, y0)) continue;
        c.save(); c.beginPath(); c.ellipse(x0, y0, R, R * 0.7, rng() * 3, 0, TAU); c.clip();
        c.fillStyle = 'rgba(150,104,64,0.25)'; c.fillRect(x0 - R, y0 - R, R * 2, R * 2);
        c.strokeStyle = 'rgba(90,60,34,0.45)'; c.lineWidth = 0.6;
        for (let k = 0; k < 14; k++) { let x = x0 + (rng() - 0.5) * R * 2, y = y0 + (rng() - 0.5) * R * 1.4, a = rng() * TAU; c.beginPath(); c.moveTo(x, y); for (let q = 0; q < 4; q++) { a += (rng() - 0.5) * 1.6; x += Math.cos(a) * 5; y += Math.sin(a) * 5; c.lineTo(x, y); } c.stroke(); }
        c.restore();
      }
      for (let i = 0; i < 220; i++) {
        const x = rng() * W, y = rng() * H; if (!free(M, x, y)) continue;
        const r = 0.5 + rng() * 1.3;
        ellipse(c, x + 0.5, y + 0.7, r, r * 0.75); c.fillStyle = 'rgba(70,40,16,0.35)'; c.fill();
        ellipse(c, x, y, r, r * 0.75); c.fillStyle = shade(rng() < 0.5 ? '#a8784a' : '#c8a274', (rng() - 0.5) * 0.3); c.fill();
      }
      c.strokeStyle = 'rgba(245,238,220,0.85)'; c.lineCap = 'round';
      for (let i = 0; i < 10; i++) { const x = rng() * W, y = rng() * H; if (!free(M, x, y)) continue; const a = rng() * TAU; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4); c.stroke(); circle(c, x, y, 0.8); c.fillStyle = '#f2ead6'; c.fill(); }
      return;
    }
    if (world.id === 'tundra') {
      // dry stalks poking through the snow, sparkles, animal tracks
      const st = new Path2D();
      for (let i = 0; i < 260; i++) {
        const x = rng() * W, y = rng() * H; if (!free(M, x, y)) continue;
        for (let k = 0; k < 4; k++) { const a = -Math.PI / 2 + (rng() - 0.5) * 1.2, l = 2 + rng() * 4; st.moveTo(x, y); st.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); }
      }
      c.strokeStyle = 'rgba(110,100,72,0.55)'; c.lineWidth = 0.7; c.stroke(st);
      c.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 1400; i++) { const x = rng() * W, y = rng() * H; if (free(M, x, y)) c.fillRect(x, y, 0.7, 0.7); }
      for (let t = 0; t < 2; t++) {
        let x = rng() * W, y = rng() * H, a = rng() * TAU;
        c.fillStyle = 'rgba(120,140,165,0.45)';
        for (let i = 0; i < 40; i++) { a += (rng() - 0.5) * 0.4; x += Math.cos(a) * 6; y += Math.sin(a) * 6; if (!free(M, x, y)) continue; for (const sd of [-1, 1]) { ellipse(c, x - Math.sin(a) * sd * 2, y + Math.cos(a) * sd * 2, 1.2, 0.8, a); c.fill(); } }
      }
      return;
    }
    const tufts = world.id === 'graveyard' ? 2000 : 2600;
    for (let i = 0; i < tufts; i++) {
      const x = rng() * W, y = rng() * H; if (!free(M, x, y)) continue;
      const n = 3 + Math.floor(rng() * 5), lean = (rng() - 0.5) * 0.8;
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + lean + (rng() - 0.5) * 1.1, l = 1.8 + rng() * 3.4, bx = x + (rng() - 0.5) * 2.5, by = y + (rng() - 0.5) * 1.5;
        const p = paths[k % 3 === 0 ? 0 : rng() < 0.6 ? 1 : 2];
        p.moveTo(bx, by); p.quadraticCurveTo(bx + Math.cos(a) * l * 0.5, by + Math.sin(a) * l * 0.6, bx + Math.cos(a) * l, by + Math.sin(a) * l);
      }
    }
    P.tuft.forEach((col, i) => { c.strokeStyle = col; c.lineWidth = i === 0 ? 0.9 : 0.7; c.stroke(paths[i]); });
    // pebbles with a lit top and a shadow
    for (let i = 0; i < 160; i++) {
      const x = rng() * W, y = rng() * H; if (!free(M, x, y)) continue;
      const r = 0.6 + rng() * 1.3;
      ellipse(c, x + 0.5, y + 0.7, r, r * 0.75); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
      ellipse(c, x, y, r, r * 0.75); c.fillStyle = shade(world.id === 'swamp' ? '#6a6450' : '#8a867c', (rng() - 0.5) * 0.3); c.fill();
      ellipse(c, x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.25); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill();
    }
    if (world.id === 'farmland') {
      // wildflowers
      for (let i = 0; i < 170; i++) {
        const x = rng() * W, y = rng() * H; if (!free(M, x, y)) continue;
        const col = ['#f2efe2', '#f0d24a', '#c77ac0', '#e9e4f2'][Math.floor(rng() * 4)];
        for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; circle(c, x + Math.cos(a) * 0.9, y + Math.sin(a) * 0.9, 0.6); c.fillStyle = col; c.fill(); }
        circle(c, x, y, 0.45); c.fillStyle = '#c08a2a'; c.fill();
      }
    }
    if (world.id === 'graveyard') {
      // fallen leaves and twigs
      for (let i = 0; i < 520; i++) {
        const x = rng() * W, y = rng() * H; if (!free(M, x, y)) continue;
        ellipse(c, x, y, 1.4 + rng(), 0.7, rng() * TAU); c.fillStyle = ['#5a3a1e', '#6e4a22', '#3e2e1c', '#7a5a2a'][Math.floor(rng() * 4)]; c.fill();
      }
      c.strokeStyle = 'rgba(40,30,20,0.7)'; c.lineWidth = 0.6;
      for (let i = 0; i < 60; i++) { const x = rng() * W, y = rng() * H; if (!free(M, x, y)) continue; const a = rng() * TAU, l = 4 + rng() * 6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.lineTo(x + Math.cos(a + 0.5) * l * 1.2, y + Math.sin(a + 0.5) * l * 1.2); c.stroke(); }
    }
    if (world.id === 'swamp') {
      // standing puddles reflecting the sky
      for (let i = 0; i < 26; i++) {
        const x = rng() * W, y = rng() * H; if (!free(M, x, y)) continue;
        const rx = 4 + rng() * 9, ry = rx * (0.4 + rng() * 0.3), a = rng() * 3;
        ellipse(c, x, y, rx + 1.2, ry + 1, a); c.fillStyle = 'rgba(30,26,14,0.6)'; c.fill();
        ellipse(c, x, y, rx, ry, a); c.fillStyle = linear(c, x - rx, y - ry, x + rx, y + ry, [[0, 'rgba(150,170,150,0.7)'], [1, 'rgba(30,40,28,0.85)']]); c.fill();
        ellipse(c, x - rx * 0.3, y - ry * 0.3, rx * 0.4, ry * 0.2, a); c.fillStyle = 'rgba(230,240,220,0.35)'; c.fill();
      }
    }
  }

  // ---------- roads ----------
  function roadNoise(world) {
    const key = 'rn' + world.id;
    if (TEX[key]) return TEX[key];
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'), img = g.createImageData(S, S), n = makeNoise(world.id.length * 13 + 5);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      // tileable: blend the noise with its wrapped copies
      const fx = x / S, fy = y / S;
      const v = fbm(n, x / 22, y / 22, 4) * (1 - fx) * (1 - fy) + fbm(n, (x - S) / 22, y / 22, 4) * fx * (1 - fy) + fbm(n, x / 22, (y - S) / 22, 4) * (1 - fx) * fy + fbm(n, (x - S) / 22, (y - S) / 22, 4) * fx * fy;
      const i = (y * S + x) * 4, k = (v - 0.5) * 2;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = k > 0 ? 255 : 0; img.data[i + 3] = Math.abs(k) * 120;
    }
    g.putImageData(img, 0, 0);
    TEX[key] = cv;
    return cv;
  }
  function roads(c, M) {
    const world = M.world, P = pal(world), id = world.id, rng = mulberry32(M.L.look.seed + 77);
    const pw = TILE * 0.8, k = devK(c);
    // 1. the road's footprint, with ragged edges
    const mask = layer(c), mg = mask.g;
    mg.lineJoin = 'round'; mg.lineCap = 'round'; mg.strokeStyle = '#000'; mg.fillStyle = '#000';
    for (const p of M.paths) { tracePts(mg, p.pts); mg.lineWidth = pw; mg.stroke(); }
    const rag = new Path2D();
    for (const p of M.paths) for (let d = 0; d < p.total; d += 5) {
      const q = pointOn(p, d), nx = -q.dy, ny = q.dx;
      for (const sd of [-1, 1]) { const off = sd * (pw / 2 - 1 + (rng() - 0.4) * 3), x = q.x + nx * off, y = q.y + ny * off, r = 1.5 + rng() * 2.6; rag.moveTo(x + r, y); rag.arc(x, y, r, 0, TAU); }
    }
    mg.fill(rag);
    // grass biting into the edges
    mg.globalCompositeOperation = 'destination-out';
    const bite = new Path2D();
    for (const p of M.paths) for (let d = 0; d < p.total; d += 9) {
      const q = pointOn(p, d), nx = -q.dy, ny = q.dx;
      if (rng() < 0.5) { const sd = rng() < 0.5 ? -1 : 1, off = sd * (pw / 2 + 1), x = q.x + nx * off, y = q.y + ny * off, r = 1.5 + rng() * 2.5; bite.moveTo(x + r, y); bite.arc(x, y, r, 0, TAU); }
    }
    mg.fill(bite);
    mg.globalCompositeOperation = 'source-over';
    // 2. the worn verge round it and its soft shadow on the ground
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    if (id === 'tundra') {
      for (const [wd, col] of [[20, 'rgba(110,135,165,0.1)'], [14, 'rgba(120,145,175,0.14)']]) { c.save(); c.translate(1.5, 2.5); c.strokeStyle = col; c.lineWidth = pw + wd; for (const p of M.paths) { tracePts(c, p.pts); c.stroke(); } c.restore(); }
      for (const [wd, col] of [[16, 'rgba(250,252,255,0.22)'], [11, 'rgba(250,252,255,0.4)']]) { c.strokeStyle = col; c.lineWidth = pw + wd; for (const p of M.paths) { tracePts(c, p.pts); c.stroke(); } }
    }
    const vc = id === 'tundra' ? [150, 165, 180] : hexRgb(P.dirt);
    for (const [wd, a] of id === 'tundra' ? [] : [[18, 0.12], [13, 0.16], [8, 0.2]]) {
      c.strokeStyle = `rgba(${vc[0]},${vc[1]},${vc[2]},${id === 'tundra' ? a * 0.8 : a})`; c.lineWidth = pw + wd;
      for (const p of M.paths) { tracePts(c, p.pts); c.stroke(); }
    }
    c.restore();

    // 3. the surface
    const surf = layer(c), sg = surf.g;
    const base = id === 'graveyard' ? '#77736b' : id === 'tundra' ? '#c9d2da' : id === 'swamp' ? '#4e3f2a' : id === 'desert' ? '#a88a62' : '#7e6446';
    sg.fillStyle = base; sg.fillRect(0, 0, W, H);
    const pat = sg.createPattern(roadNoise(world), 'repeat'); pat.setTransform(new DOMMatrix().scale(0.6)); sg.fillStyle = pat; sg.fillRect(0, 0, W, H);

    stones(sg, id);
    ruts(sg, M, pw, rng, id);
    // inner edge shade so the surface sits down into the ground
    sg.save(); sg.lineJoin = 'round'; sg.lineCap = 'round';
    for (const p of M.paths) for (const sd of [-1, 1]) {
      const ep = offsetPolyline(p.pts, sd * pw * 0.5);
      for (const [wd, a] of id === 'tundra' ? [[10, 0.12], [5, 0.16]] : [[12, 0.08], [7, 0.09], [3, 0.1]]) {
        tracePts(sg, ep); sg.strokeStyle = id === 'tundra' ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; sg.lineWidth = wd; sg.stroke();
      }
    }
    sg.restore();
    if (id === 'tundra') {
      // snowbanks along both edges, lit on the upper-left side
      sg.save(); sg.lineJoin = 'round'; sg.lineCap = 'round';
      for (const p of M.paths) for (const sd of [-1, 1]) { tracePts(sg, offsetPolyline(p.pts, sd * (pw * 0.5 - 1))); sg.strokeStyle = sd < 0 ? 'rgba(120,140,170,0.18)' : 'rgba(255,255,255,0.3)'; sg.lineWidth = 4; sg.stroke(); }
      sg.restore();
    }
    sg.globalCompositeOperation = 'destination-in'; sg.setTransform(1, 0, 0, 1, 0, 0); sg.drawImage(mask.cv, 0, 0);
    blit(c, surf.cv);
    // 4. grass and weeds leaning over the edges
    edgeTufts(c, M, pw, rng, world);
  }
  // a polyline with its corners rounded off, the way wheels actually take a bend
  function smooth(g, pts, r) {
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) g.arcTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, r);
    g.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }
  function segAt(p, d) { for (const s of p.segs) if (d <= s.start + s.len) return s; return p.segs[p.segs.length - 1]; }
  // gravel and cobbles are painted once per world into a tile that repeats along every road
  const TS = 192;
  function stoneTile(id) {
    const key = 'stone' + id;
    if (TEX[key]) return TEX[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = TS * 2;
    const g = cv.getContext('2d'), rng = mulberry32(id.length * 31 + 7);
    g.scale(2, 2);
    // draw each stone at its spot and wrapped across the tile edges, so the tile repeats seamlessly
    const wrap = (x, y, r, f) => { for (const ox of [-TS, 0, TS]) for (const oy of [-TS, 0, TS]) if (x + ox > -r && x + ox < TS + r && y + oy > -r && y + oy < TS + r) f(x + ox, y + oy); };
    if (id === 'graveyard') {
      for (let row = 0; row < TS / 5; row++) for (let col = 0; col < TS / 5; col++) {
        const x = col * 5 + (row % 2 ? 2.5 : 0) + (rng() - 0.5) * 0.8, y = row * 5 + 2.5 + (rng() - 0.5) * 0.8, w = 4 + rng() * 0.6, h = 3.9 + rng() * 0.5;
        const base = jit(rng() < 0.15 ? '#6e7a5a' : '#8e8a82', rng, 0.14);
        wrap(x, y, 4, (px, py) => {
          rr(g, px - w / 2 + 0.5, py - h / 2 + 0.7, w, h, 1.4); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fill();
          rr(g, px - w / 2, py - h / 2, w, h, 1.4); g.fillStyle = base; g.fill();
          g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(px - w / 2 + 0.6, py - h / 2 + 0.3, w - 1.4, 1);
        });
      }
    } else {
      const cols = id === 'tundra' ? ['#9aa6b2', '#e8eef3', '#7e8a96'] : id === 'swamp' ? ['#2e2618', '#6a5a3e', '#3e3422'] : id === 'desert' ? ['#8a6a44', '#c8a878', '#a07a50', '#dcc08e'] : ['#5a4530', '#a88c66', '#6e5640', '#c2a884'];
      const n = id === 'tundra' ? 260 : 620;
      for (let i = 0; i < n; i++) {
        const x = rng() * TS, y = rng() * TS, r = 0.5 + rng() * rng() * (id === 'tundra' ? 1.2 : 2.2), a = rng() * 3, col = cols[Math.floor(rng() * cols.length)];
        wrap(x, y, 4, (px, py) => {
          ellipse(g, px + 0.4, py + 0.6, r, r * 0.7, a); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill();
          ellipse(g, px, py, r, r * 0.7, a); g.fillStyle = col; g.fill();
          if (r > 1.2) { ellipse(g, px - r * 0.25, py - r * 0.25, r * 0.45, r * 0.25, a); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fill(); }
        });
      }
    }
    TEX[key] = cv;
    return cv;
  }
  function stones(g, id) {
    const pat = g.createPattern(stoneTile(id), 'repeat'); pat.setTransform(new DOMMatrix().scale(0.5));
    g.fillStyle = pat; g.fillRect(0, 0, W, H);
  }
  function ruts(g, M, pw, rng, id) {
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    const dark = id === 'tundra' ? 'rgba(110,128,150,0.36)' : id === 'graveyard' ? 'rgba(0,0,0,0.1)' : 'rgba(30,20,10,0.2)';
    for (const p of M.paths) for (const off of [-TILE * 0.17, TILE * 0.17]) {
      const pts = offsetPolyline(p.pts, off);
      for (const [wd, a] of id === 'tundra' ? [[11, 0.3], [7, 0.45]] : [[10, 0.3], [7, 0.45], [4.5, 0.45]]) { g.save(); g.globalAlpha = a; smooth(g, pts, 16); g.strokeStyle = dark; g.lineWidth = id === 'tundra' ? wd * 0.9 : wd; g.stroke(); g.restore(); }
      g.save(); g.translate(1.2, 1.6); smooth(g, pts, 16); g.strokeStyle = id === 'tundra' ? 'rgba(255,255,255,0.4)' : 'rgba(255,240,210,0.07)'; g.lineWidth = 2; g.stroke(); g.restore();
      if (id === 'tundra') { g.setLineDash([1.2, 2.6]); smooth(g, pts, 16); g.strokeStyle = 'rgba(90,108,130,0.16)'; g.lineWidth = 5; g.stroke(); g.setLineDash([]); }
    }
    // the hump between the ruts grows grass on country roads
    if (id === 'farmland' || id === 'swamp') for (const p of M.paths) {
      const tf = new Path2D();
      for (let d = 0; d < p.total; d += 1.4) { if (rng() < 0.45) continue; const q = pointOn(p, d), off = (rng() - 0.5) * 4, x = q.x - q.dy * off, y = q.y + q.dx * off, a = -Math.PI / 2 + (rng() - 0.5), l = 1.4 + rng() * 2; tf.moveTo(x, y); tf.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); }
      g.strokeStyle = id === 'swamp' ? 'rgba(80,96,44,0.7)' : 'rgba(84,110,46,0.75)'; g.lineWidth = 0.7; g.stroke(tf);
    }
    // out in the desert, sand blows across the road instead of pooling water
    if (id === 'desert') for (const p of M.paths) for (let i = 0; i < Math.floor(p.total / 60); i++) {
      const q = pointOn(p, rng() * p.total), a = Math.atan2(q.dy, q.dx) + Math.PI / 2 + (rng() - 0.5) * 0.6, len = 8 + rng() * 14;
      g.fillStyle = linear(g, q.x - Math.cos(a) * len, q.y - Math.sin(a) * len, q.x + Math.cos(a) * len, q.y + Math.sin(a) * len, [[0, 'rgba(232,204,150,0)'], [0.5, 'rgba(232,204,150,0.75)'], [1, 'rgba(232,204,150,0)']]);
      ellipse(g, q.x, q.y, len, 3 + rng() * 3, a); g.fill();
    }
    // puddles in the ruts: a few overlapping lobes of muddy water, dark at the rim, the sky faint in them
    if (id !== 'tundra' && id !== 'desert') for (const p of M.paths) for (let i = 0; i < Math.floor(p.total / 170); i++) {
      const d = rng() * p.total, q = pointOn(p, d), off = (rng() < 0.5 ? -1 : 1) * TILE * 0.17, a = Math.atan2(q.dy, q.dx), len = 4 + rng() * 6;
      const lobes = [];
      for (let k = 0; k < 3; k++) { const t = (k - 1) * len * 0.6 + (rng() - 0.5) * 2, w2 = 2 + rng() * 1.6; lobes.push([q.x - q.dy * (off + (rng() - 0.5) * 1.5) + q.dx * t, q.y + q.dx * (off + (rng() - 0.5) * 1.5) + q.dy * t, len * (0.45 + rng() * 0.3), w2]); }
      const shape = (grow) => { g.beginPath(); for (const [x, y, rx, ry] of lobes) { g.moveTo(x + (rx + grow) * Math.cos(a), y + (rx + grow) * Math.sin(a)); g.ellipse(x, y, rx + grow, ry + grow * 0.7, a, 0, TAU); } };
      shape(1.4); g.fillStyle = id === 'graveyard' ? 'rgba(30,30,28,0.35)' : 'rgba(40,26,12,0.45)'; g.fill();
      shape(0); g.fillStyle = id === 'graveyard' ? 'rgba(58,62,62,0.9)' : id === 'swamp' ? 'rgba(46,44,26,0.92)' : 'rgba(70,58,40,0.92)'; g.fill();
      g.save(); shape(0); g.clip();
      g.fillStyle = linear(g, q.x - 8, q.y - 8, q.x + 8, q.y + 8, [[0, 'rgba(190,205,215,0.4)'], [0.55, 'rgba(190,205,215,0.05)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(q.x - 20, q.y - 20, 40, 40);
      g.restore();
    }
    g.restore();
  }
  function edgeTufts(c, M, pw, rng, world) {
    if (world.id === 'tundra') return;
    const P = pal(world), ps = P.tuft.map(() => new Path2D());
    for (const p of M.paths) for (let d = 0; d < p.total; d += 2.2) {
      if (rng() < 0.35) continue;
      const q = pointOn(p, d), s0 = segAt(p, d), nx = -s0.dy, ny = s0.dx;
      for (const sd of [-1, 1]) {
        if (rng() < 0.45) continue;
        const ox = q.x + nx * sd * (pw / 2 + 1.5), oy = q.y + ny * sd * (pw / 2 + 1.5);
        for (let k = 0; k < 3; k++) { const a = Math.atan2(-ny * sd, -nx * sd) + (rng() - 0.5) * 1.4, l = 2 + rng() * 3.5, bx = ox + (rng() - 0.5) * 2, pp = ps[Math.floor(rng() * 3)]; pp.moveTo(bx, oy); pp.lineTo(bx + Math.cos(a) * l, oy + Math.sin(a) * l); }
      }
    }
    c.save(); c.lineCap = 'round';
    P.tuft.forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 0.8; c.stroke(ps[i]); });
    c.restore();
  }

  // ---------- water ----------
  function water(c, M) {
    const wt = M.L.water;
    if (!wt.some((v) => v)) return;
    const world = M.world, id = world.id, rng = mulberry32(M.L.look.seed + 91), k = devK(c);
    const tiles = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (wt[y * COLS + x]) tiles.push([x, y]);
    const blob = (g, r) => {
      g.beginPath();
      for (const [x, y] of tiles) {
        const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
        g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, TAU);
        // bulges along the open edges, fixed per tile so every depth layer follows the same shore
        let hsh = (x * 73856093) ^ (y * 19349663);
        const hr = () => { hsh = (hsh * 1103515245 + 12345) & 0x7fffffff; return hsh / 0x7fffffff; };
        for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx2 = x + ex, ny2 = y + ey;
          if (nx2 >= 0 && ny2 >= 0 && nx2 < COLS && ny2 < ROWS && wt[ny2 * COLS + nx2]) continue;
          for (let q = 0; q < 2; q++) {
            const along = (hr() - 0.5) * TILE * 0.7, out = hr() * TILE * 0.12, br = r * (0.42 + hr() * 0.25);
            const bx = cx + ex * (TILE * 0.22 + out) - ey * along, by = cy + ey * (TILE * 0.22 + out) + ex * along;
            g.moveTo(bx + br, by); g.arc(bx, by, br, 0, TAU);
          }
        }
        if (x + 1 < COLS && wt[y * COLS + x + 1]) g.rect(cx, cy - r, TILE, r * 2);
        if (y + 1 < ROWS && wt[(y + 1) * COLS + x]) g.rect(cx - r, cy, r * 2, TILE);
        if (x + 1 < COLS && y + 1 < ROWS && wt[y * COLS + x + 1] && wt[(y + 1) * COLS + x] && wt[(y + 1) * COLS + x + 1]) g.rect(cx, cy, TILE, TILE);
        for (const ex of [-1, 1]) if (x + ex >= 0 && x + ex < COLS && y + 1 < ROWS && wt[(y + 1) * COLS + x + ex] && !wt[y * COLS + x + ex] && !wt[(y + 1) * COLS + x]) {
          const bx = cx + ex * TILE, by = cy + TILE, q = r * 0.75 / Math.SQRT2;
          g.moveTo(cx - q, cy + ex * q); g.lineTo(cx + q, cy - ex * q); g.lineTo(bx + q, by - ex * q); g.lineTo(bx - q, by + ex * q); g.closePath();
        }
      }
    };
    const deep = id === 'tundra' ? '#5f7f99' : id === 'swamp' ? '#1f2a16' : id === 'graveyard' ? '#141c1c' : id === 'desert' ? '#14555a' : '#1d3f4e';
    const shallow = id === 'tundra' ? '#b9d2e2' : id === 'swamp' ? '#4a5a2a' : id === 'graveyard' ? '#2f3d3a' : id === 'desert' ? '#4ab0a4' : '#4f8290';
    const bank = id === 'tundra' ? 'rgba(150,170,190,0.55)' : id === 'swamp' ? 'rgba(30,26,12,0.7)' : id === 'desert' ? 'rgba(70,90,40,0.6)' : 'rgba(60,46,28,0.65)';
    // wet, darkened bank
    c.save(); c.shadowColor = bank; c.shadowBlur = 5 * k; blob(c, TILE * 0.8); c.fillStyle = bank; c.fill(); c.restore();
    // water: shallow at the edge, deepening to the middle
    const lay = layer(c), g = lay.g;
    blob(g, TILE * 0.68); g.fillStyle = shallow; g.fill();
    g.save(); g.globalCompositeOperation = 'source-atop';
    for (const [r, a] of [[0.56, 0.5], [0.44, 0.6], [0.3, 0.7]]) { g.shadowColor = deep; g.shadowBlur = 8 * k; blob(g, TILE * r); g.fillStyle = deep; g.globalAlpha = a; g.fill(); }
    g.restore();
    g.save(); g.globalCompositeOperation = 'source-atop';
    if (id === 'tundra') {
      // frozen: frosted ice, a crack network, snow blown across it
      g.fillStyle = 'rgba(235,245,252,0.35)'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.7;
      for (const [x, y] of tiles) for (let i = 0; i < 2; i++) { let px = x * TILE + rng() * TILE, py = y * TILE + rng() * TILE, a = rng() * TAU; g.beginPath(); g.moveTo(px, py); for (let s2 = 0; s2 < 5; s2++) { a += (rng() - 0.5) * 1.2; px += Math.cos(a) * 6; py += Math.sin(a) * 6; g.lineTo(px, py); } g.stroke(); }
      for (const [x, y] of tiles) if (rng() < 0.5) { ellipse(g, x * TILE + rng() * TILE, y * TILE + rng() * TILE, 6 + rng() * 10, 2 + rng() * 3, 0.45); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fill(); }
    } else {
      // sky reflected in a diagonal sheen, ripples and caustic glints
      g.fillStyle = linear(g, 0, 0, W, H, [[0, 'rgba(200,220,230,0.16)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.15)']]); g.fillRect(0, 0, W, H);
      g.strokeStyle = id === 'swamp' ? 'rgba(170,190,120,0.18)' : 'rgba(220,240,250,0.28)'; g.lineWidth = 0.7;
      for (const [x, y] of tiles) for (let i = 0; i < 4; i++) { const px = x * TILE + rng() * TILE, py = y * TILE + rng() * TILE, r = 2 + rng() * 6; g.beginPath(); g.arc(px, py, r, Math.PI * (1.1 + rng() * 0.2), Math.PI * (1.6 + rng() * 0.3)); g.stroke(); }
    }
    g.restore();
    // shoreline: a pale foam line just inside the edge
    const ring = layer(c), rg = ring.g;
    blob(rg, TILE * 0.68); rg.fillStyle = id === 'tundra' ? 'rgba(255,255,255,0.9)' : id === 'swamp' ? 'rgba(120,140,70,0.5)' : 'rgba(225,240,240,0.6)'; rg.fill();
    rg.globalCompositeOperation = 'destination-out'; rg.shadowColor = '#000'; rg.shadowBlur = 3 * k; blob(rg, TILE * 0.68 - 2.4); rg.fillStyle = '#000'; rg.fill();
    g.save(); g.globalCompositeOperation = 'source-atop'; g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(ring.cv, 0, 0); g.restore();
    blit(c, lay.cv);
    // life on and around the water
    if (id === 'desert') {
      // an oasis: reeds at the water's edge and date palms leaning over it
      for (const [x, y] of tiles) {
        if (rng() < 0.35) reedClump(c, x * TILE + rng() * TILE, y * TILE + (rng() < 0.5 ? 4 : TILE - 4), 0.6 + rng() * 0.4, rng, false);
        if (rng() < 0.22) { const a = rng() * TAU; c.save(); c.translate(x * TILE + TILE / 2 + Math.cos(a) * TILE * 0.55, y * TILE + TILE / 2 + Math.sin(a) * TILE * 0.55); palm(c, 13 + rng() * 5, rng); c.restore(); }
      }
    }
    if (id === 'swamp' || id === 'farmland') {
      for (const [x, y] of tiles) {
        if (id === 'swamp' && rng() < 0.5) lily(c, x * TILE + 8 + rng() * (TILE - 16), y * TILE + 8 + rng() * (TILE - 16), 3 + rng() * 3, rng);
        if (rng() < (id === 'swamp' ? 0.5 : 0.3)) reedClump(c, x * TILE + rng() * TILE, y * TILE + (rng() < 0.5 ? 4 : TILE - 4), 0.6 + rng() * 0.4, rng, id === 'swamp');
      }
    }
  }
  function lily(c, x, y, r, rng) {
    const a = rng() * TAU;
    ellipse(c, x + 0.6, y + 0.8, r, r * 0.9); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
    c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, a, a + TAU - 0.5); c.closePath(); c.fillStyle = linear(c, x - r, y - r, x + r, y + r, [[0, '#7aa040'], [1, '#3e5a22']]); c.fill();
    c.strokeStyle = 'rgba(30,50,20,0.6)'; c.lineWidth = 0.4; for (let i = 0; i < 5; i++) { const b = a + i * 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(b) * r * 0.9, y + Math.sin(b) * r * 0.9); c.stroke(); }
    if (rng() < 0.3) { for (let i = 0; i < 6; i++) { const b = i / 6 * TAU; ellipse(c, x + Math.cos(b) * 1.2, y + Math.sin(b) * 1.2, 1.2, 0.6, b); c.fillStyle = '#f2e6ee'; c.fill(); } circle(c, x, y, 0.7); c.fillStyle = '#e8c040'; c.fill(); }
  }
  function reedClump(c, x, y, s, rng, cattails) {
    c.save(); c.translate(x, y); c.scale(s, s); c.lineCap = 'round';
    softShadow(c, () => { c.beginPath(); c.ellipse(3, 3, 8, 5, 0, 0, TAU); }, 0, 0, 3, 'rgba(0,0,0,0.35)');
    for (let i = 0; i < 18; i++) {
      const a = -Math.PI / 2 + (rng() - 0.5) * 2.4, l = 6 + rng() * 9, bx = (rng() - 0.5) * 4;
      c.strokeStyle = shade('#6a7a34', (rng() - 0.5) * 0.4); c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(bx, 0); c.quadraticCurveTo(bx + Math.cos(a) * l * 0.5, Math.sin(a) * l * 0.6, bx + Math.cos(a) * l, Math.sin(a) * l); c.stroke();
      if (cattails && rng() < 0.25) { ellipse(c, bx + Math.cos(a) * l, Math.sin(a) * l, 1, 2.2, a + Math.PI / 2); c.fillStyle = '#5a3a1e'; c.fill(); }
    }
    c.restore();
  }

  // ---------- bridges ----------
  function bridges(c, M) {
    const { bridges: br } = M.L, rng = mulberry32(M.L.look.seed + 13);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (!br[y * COLS + x]) continue;
      const horiz = (x > 0 && M.grid[y * COLS + x - 1] === 1) || (x < COLS - 1 && M.grid[y * COLS + x + 1] === 1);
      c.save(); c.translate(x * TILE + TILE / 2, y * TILE + TILE / 2); if (!horiz) c.rotate(Math.PI / 2);
      const len = TILE + 4, wid = TILE * 0.86;
      softShadow(c, () => { c.beginPath(); c.rect(-len / 2, -wid / 2, len, wid); }, 4, 7, 5, 'rgba(0,0,0,0.5)');
      // piles under the deck
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) { circle(c, sx * len * 0.38, sy * (wid / 2 + 1), 2.4); c.fillStyle = '#3a2a1a'; c.fill(); }
      // planks across the span, each its own shade, with gaps and nails
      for (let i = -len / 2; i < len / 2; i += 4.6) {
        const pc = jit(M.world.id === 'tundra' ? '#6e5a44' : '#7a5c3c', rng, 0.16), wob = (rng() - 0.5) * 1.2;
        c.fillStyle = linear(c, i, -wid / 2, i + 4, wid / 2, [[0, shade(pc, 0.15)], [1, shade(pc, -0.2)]]);
        c.fillRect(i + 0.3, -wid / 2 + wob, 4, wid);
        c.fillStyle = 'rgba(30,20,10,0.4)'; c.fillRect(i + 0.3, -wid / 2 + wob, 0.5, wid);
        c.fillStyle = '#2a2420'; circle(c, i + 2.3, -wid / 2 + 3 + wob, 0.45); c.fill(); circle(c, i + 2.3, wid / 2 - 3 + wob, 0.45); c.fill();
        c.strokeStyle = 'rgba(40,26,14,0.35)'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(i + 1, -wid / 2); c.lineTo(i + 1.3, wid / 2); c.stroke();
      }
      if (M.world.id === 'tundra') { c.fillStyle = 'rgba(240,246,252,0.55)'; for (let i = 0; i < 6; i++) { ellipse(c, (rng() - 0.5) * len, (rng() - 0.5) * wid, 3 + rng() * 5, 1.4 + rng() * 2, 0.2); c.fill(); } }
      // rails and posts
      for (const sd of [-1, 1]) {
        c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(-len / 2, sd * wid / 2 - 1.2 + 2, len, 3);
        c.fillStyle = linear(c, 0, sd * wid / 2 - 1.6, 0, sd * wid / 2 + 1.6, [[0, '#8a6a46'], [1, '#4a3622']]); c.fillRect(-len / 2, sd * wid / 2 - 1.6, len, 3.2);
        for (let i = -len / 2 + 2; i < len / 2; i += 12) { c.fillStyle = '#3e2c1a'; c.fillRect(i - 1.6, sd * wid / 2 - 2, 3.2, 4); c.fillStyle = 'rgba(255,230,190,0.3)'; c.fillRect(i - 1.6, sd * wid / 2 - 2, 3.2, 1); }
      }
      c.restore();
    }
  }

  // ============================================================ props
  // A tree crown made of hundreds of leaf clusters, darker underneath and lit on the upper left.
  function crown(c, r, cols, rng, o = {}) {
    softShadow(c, () => { c.beginPath(); c.ellipse(0, 0, r * 1.02, r * 0.96, 0, 0, TAU); }, r * 0.6, r * 0.8, r * 0.35, 'rgba(0,0,0,0.62)');
    const lumps = o.lumps || 7, ps = cols.map(() => new Path2D());
    const centres = [];
    for (let i = 0; i < lumps; i++) { const a = rng() * TAU, d = r * 0.5 * Math.sqrt(rng()); centres.push([Math.cos(a) * d, Math.sin(a) * d, r * (0.42 + rng() * 0.22)]); }
    centres.push([0, 0, r * 0.62]);
    c.beginPath(); for (const [cx, cy, cr] of centres) { c.moveTo(cx + cr * 1.05, cy); c.arc(cx, cy, cr * 1.05, 0, TAU); }
    c.fillStyle = shade(cols[0], -0.25); c.fill();
    for (const [cx, cy, cr] of centres) {
      const n = Math.floor(cr * cr * 0.9) + 12;
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU, d = cr * Math.sqrt(rng()), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        // how much this leaf faces the light, within its cluster and within the whole crown
        const lit = ((x - cx) * LX + (y - cy) * LY) / cr * 0.6 + (x * LX + y * LY) / r * 0.5 + (rng() - 0.5) * 0.5;
        const band = clamp(Math.floor((lit + 1) / 2 * cols.length), 0, cols.length - 1);
        const lr = r * (0.06 + rng() * 0.07);
        ps[band].moveTo(x + lr, y); ps[band].arc(x, y, lr, 0, TAU);
      }
    }
    cols.forEach((col, i) => { c.fillStyle = col; c.fill(ps[i]); });
    // a few deep gaps between the clusters
    c.fillStyle = 'rgba(0,0,0,0.22)';
    for (let i = 0; i < Math.floor(r * 0.8); i++) { const a = rng() * TAU, d = r * (0.3 + rng() * 0.6); circle(c, Math.cos(a) * d, Math.sin(a) * d, r * 0.05); c.fill(); }
    if (o.moss) { c.strokeStyle = 'rgba(170,175,140,0.65)'; c.lineWidth = 0.6; for (let i = 0; i < 26; i++) { const a = rng() * TAU, d = r * (0.3 + rng() * 0.7), x = Math.cos(a) * d, y = Math.sin(a) * d; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 1, y + 3, x + (rng() - 0.5) * 2, y + 4 + rng() * 5); c.stroke(); } }
  }
  // a pine seen from above: tiers of needle sprays, snow caught on the outer tips
  function pine(c, r, rng, snow) {
    softShadow(c, () => { c.beginPath(); c.ellipse(0, 0, r, r * 0.95, 0, 0, TAU); }, r * 0.6, r * 0.75, r * 0.4, 'rgba(10,20,30,0.45)');
    const tiers = [[r, '#16301f'], [r * 0.78, '#1d3c28'], [r * 0.56, '#264a32'], [r * 0.34, '#2f5a3c']];
    c.lineCap = 'round';
    for (const [tr, col] of tiers) {
      const n = Math.floor(tr * 1.6), ps = new Path2D(), pl = new Path2D();
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + rng() * 0.2, l = tr * (0.75 + rng() * 0.3), ex = Math.cos(a) * l, ey = Math.sin(a) * l;
        const p = (Math.cos(a) * LX + Math.sin(a) * LY) > 0.2 ? pl : ps;
        p.moveTo(0, 0); p.lineTo(ex, ey);
        for (let k = 0.35; k < 1; k += 0.18) { const bx = ex * k, by = ey * k, side = tr * 0.16 * (1 - k * 0.6); p.moveTo(bx, by); p.lineTo(bx + Math.cos(a + 0.9) * side, by + Math.sin(a + 0.9) * side); p.moveTo(bx, by); p.lineTo(bx + Math.cos(a - 0.9) * side, by + Math.sin(a - 0.9) * side); }
      }
      c.strokeStyle = col; c.lineWidth = Math.max(0.7, tr * 0.06); c.stroke(ps);
      c.strokeStyle = shade(col, 0.25); c.stroke(pl);
    }
    if (snow) { c.fillStyle = 'rgba(248,251,255,0.92)'; for (let i = 0; i < 22; i++) { const a = rng() * TAU, d = r * (0.3 + rng() * 0.6); ellipse(c, Math.cos(a) * d, Math.sin(a) * d, 1.4 + rng() * 2.4, 0.9 + rng() * 1.4, a); c.fill(); } }
    circle(c, 0, 0, r * 0.08); c.fillStyle = '#3a2a1c'; c.fill();
  }
  function deadTree(c, rng, s = 1) {
    const br = [];
    const grow = (x, y, a, l, w, d) => { const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; br.push([x, y, x2, y2, w]); if (d > 0) for (let i = 0; i < 2 + (rng() < 0.3); i++) grow(x2, y2, a + (rng() - 0.5) * 1.3, l * (0.6 + rng() * 0.15), w * 0.62, d - 1); };
    for (let i = 0; i < 5; i++) grow(0, 0, i / 5 * TAU + rng() * 0.6, (7 + rng() * 5) * s, 2.6 * s, 3);
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(0,0,0,0.35)'; for (const [x, y, x2, y2, w] of br) { c.lineWidth = w; c.beginPath(); c.moveTo(x + 5 * s, y + 7 * s); c.lineTo(x2 + 5 * s, y2 + 7 * s); c.stroke(); }
    for (const [x, y, x2, y2, w] of br) { c.lineWidth = w; c.strokeStyle = '#3a3029'; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); }
    c.strokeStyle = 'rgba(170,150,130,0.45)'; for (const [x, y, x2, y2, w] of br) if (w > 1) { c.lineWidth = w * 0.3; c.beginPath(); c.moveTo(x - 0.4, y - 0.4); c.lineTo(x2 - 0.4, y2 - 0.4); c.stroke(); }
    circle(c, 0, 0, 3.4 * s); c.fillStyle = radial(c, 0, 0, 3.4 * s, '#5a4a3c', '#2a221c'); c.fill();
  }
  function rock(c, rng, snow, mossy) {
    const n = 7 + Math.floor(rng() * 3), pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU + (rng() - 0.5) * 0.4, r = 8 + rng() * 6; pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.82]); }
    const top = [(rng() - 0.5) * 3 - 1.5, (rng() - 0.5) * 3 - 1.5];
    softShadow(c, () => polyPath(c, pts), 3.5, 5, 3.5, 'rgba(0,0,0,0.55)');
    // a faceted boulder: each face lit by which way it tilts
    const base = snow ? '#8a9098' : '#8a8780';
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], mx = (a[0] + b[0]) / 2 - top[0], my = (a[1] + b[1]) / 2 - top[1], l = Math.hypot(mx, my) || 1;
      const lit = (mx * LX + my * LY) / l;
      polyPath(c, [top, a, b]); c.fillStyle = shade(base, lit * 0.32 + (rng() - 0.5) * 0.08); c.fill();
      c.strokeStyle = 'rgba(30,30,28,0.35)'; c.lineWidth = 0.4; c.stroke();
    }
    polyPath(c, pts); c.strokeStyle = 'rgba(20,20,18,0.55)'; c.lineWidth = 0.7; c.stroke();
    c.strokeStyle = 'rgba(30,30,28,0.5)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(top[0] + 2, top[1] + 1); c.lineTo(top[0] + 6, top[1] + 5); c.lineTo(top[0] + 5, top[1] + 9); c.stroke();
    if (mossy || (!snow && rng() < 0.6)) { c.fillStyle = 'rgba(110,130,60,0.6)'; for (let i = 0; i < 8; i++) { const p = pts[Math.floor(rng() * n)]; circle(c, p[0] * (0.5 + rng() * 0.4), p[1] * (0.5 + rng() * 0.4), 0.8 + rng() * 1.4); c.fill(); } }
    if (snow) { c.fillStyle = 'rgba(248,251,255,0.95)'; polyPath(c, [top, pts[Math.floor(n * 0.55)], pts[Math.floor(n * 0.7)], pts[Math.floor(n * 0.85)]]); c.fill(); c.fillStyle = 'rgba(200,215,230,0.6)'; ellipse(c, top[0] + 2, top[1] + 2, 3, 1.5); c.fill(); }
  }
  function car(c, rng, rusted) {
    const kinds = rusted ? [['#7a4a2a', 'pickup'], ['#8a5a36', 'sedan'], ['#6a3e24', 'sedan'], ['#9a6a40', 'pickup']]
      : [['#6d2a24', 'sedan'], ['#3f4f5f', 'sedan'], ['#7d7462', 'pickup'], ['#2f3a2a', 'pickup'], ['#8a8a86', 'sedan'], ['#c8b070', 'sedan']];
    const [col, kind] = kinds[Math.floor(rng() * kinds.length)];
    const L2 = 20, W2 = 9;
    const body = () => { c.beginPath(); c.moveTo(L2, -W2 * 0.75); c.quadraticCurveTo(L2 + 1.5, 0, L2, W2 * 0.75); c.quadraticCurveTo(L2 - 1, W2, L2 - 4, W2); c.lineTo(-L2 + 3, W2); c.quadraticCurveTo(-L2, W2, -L2, W2 * 0.6); c.lineTo(-L2, -W2 * 0.6); c.quadraticCurveTo(-L2, -W2, -L2 + 3, -W2); c.lineTo(L2 - 4, -W2); c.quadraticCurveTo(L2 - 1, -W2, L2, -W2 * 0.75); c.closePath(); };
    softShadow(c, body, 3, 5, 4, 'rgba(0,0,0,0.6)');
    // tyres peeking out under the body
    for (const [wx, wy] of [[12, -9.3], [12, 9.3], [-12, -9.3], [-12, 9.3]]) { c.fillStyle = '#141414'; c.fillRect(wx - 3, wy - 1.3, 6, 2.6); }
    body(); c.fillStyle = linear(c, 0, -W2, 0, W2, [[0, shade(col, 0.3)], [0.5, col], [1, shade(col, -0.35)]]); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 0.6; c.stroke();
    // hood crease, panel lines, door seams
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.4;
    c.beginPath(); c.moveTo(L2 - 1, 0); c.lineTo(8, 0); c.moveTo(-2, -W2); c.lineTo(-2, W2); c.moveTo(4.5, -W2); c.lineTo(4.5, -W2 + 1.5); c.moveTo(4.5, W2); c.lineTo(4.5, W2 - 1.5); c.stroke();
    if (kind === 'pickup') {
      c.fillStyle = shade(col, -0.25); rr(c, -L2 + 1, -W2 + 1.3, 15, (W2 - 1.3) * 2, 1.2); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.35)'; rr(c, -L2 + 2.2, -W2 + 2.4, 12.6, (W2 - 2.4) * 2, 0.8); c.fill();
      for (let i = 0; i < 3; i++) { c.fillStyle = jit('#6b5330', rng); c.fillRect(-L2 + 3 + rng() * 6, -5 + rng() * 6, 4, 3); }
    }
    // greenhouse: windscreen, roof, rear window, each catching the sky
    const roofX0 = kind === 'pickup' ? -5 : -9, roofX1 = 5;
    c.beginPath(); c.moveTo(roofX1 + 5, -W2 + 1.3); c.lineTo(roofX1, -W2 + 2); c.lineTo(roofX1, W2 - 2); c.lineTo(roofX1 + 5, W2 - 1.3); c.closePath();
    c.fillStyle = linear(c, roofX1, -W2, roofX1 + 5, W2, [[0, '#a9c0cc'], [0.5, '#3a4a56'], [1, '#1a242c']]); c.fill();
    c.fillStyle = linear(c, roofX0, -W2 + 2, roofX1, W2 - 2, [[0, shade(col, 0.15)], [1, shade(col, -0.2)]]); c.fillRect(roofX0, -W2 + 2, roofX1 - roofX0, (W2 - 2) * 2);
    c.beginPath(); c.moveTo(roofX0 - 4, -W2 + 1.6); c.lineTo(roofX0, -W2 + 2); c.lineTo(roofX0, W2 - 2); c.lineTo(roofX0 - 4, W2 - 1.6); c.closePath(); c.fillStyle = '#26323a'; c.fill();
    // a broken windscreen on some
    if (rng() < 0.5) { c.strokeStyle = 'rgba(230,240,245,0.75)'; c.lineWidth = 0.35; const cx2 = roofX1 + 2.5, cy2 = (rng() - 0.5) * 6; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.beginPath(); c.moveTo(cx2, cy2); c.lineTo(cx2 + Math.cos(a) * 3, cy2 + Math.sin(a) * 4); c.stroke(); } }
    // mirrors, lights, rust and grime
    c.fillStyle = shade(col, -0.4); c.fillRect(roofX1 + 1, -W2 - 1.4, 2, 1.4); c.fillRect(roofX1 + 1, W2, 2, 1.4);
    c.fillStyle = '#e8e2c8'; c.fillRect(L2 - 1.2, -W2 * 0.7, 1, 2.2); c.fillRect(L2 - 1.2, W2 * 0.7 - 2.2, 1, 2.2);
    c.fillStyle = '#9a2a22'; c.fillRect(-L2, -W2 * 0.7, 0.9, 2); c.fillRect(-L2, W2 * 0.7 - 2, 0.9, 2);
    c.fillStyle = 'rgba(120,64,28,0.55)'; for (let i = 0; i < 5; i++) { ellipse(c, (rng() - 0.5) * L2 * 1.6, (rng() - 0.5) * W2 * 1.6, 1 + rng() * 2.2, 0.8 + rng() * 1.4, rng() * 3); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.22)'; ellipse(c, 4, -W2 * 0.55, L2 * 0.6, 1.1); c.fill();
    if (rng() < 0.35) { c.save(); c.translate(-2, -W2); c.rotate(-0.7); c.fillStyle = shade(col, -0.1); c.fillRect(0, -1, 7, 1.4); c.restore(); }
    if (rusted) {
      // a long-dead wreck: rust holes, sun-bleached paint and sand piled against one side
      c.fillStyle = 'rgba(60,28,12,0.6)'; for (let i = 0; i < 9; i++) { ellipse(c, (rng() - 0.5) * L2 * 1.7, (rng() - 0.5) * W2 * 1.7, 0.8 + rng() * 2, 0.6 + rng() * 1.2, rng() * 3); c.fill(); }
      c.fillStyle = 'rgba(240,220,180,0.18)'; c.fillRect(-L2, -W2, L2 * 2, W2 * 2);
      c.fillStyle = linear(c, 0, W2 - 4, 0, W2 + 5, [[0, 'rgba(220,180,120,0)'], [1, 'rgba(220,180,120,0.95)']]); ellipse(c, (rng() - 0.5) * 8, W2 + 1.5, L2 * 0.9, 4.5); c.fill();
    }
  }
  // ---------- desert props ----------
  // a saguaro seen from above: a ribbed round crown with arms reaching out, and spines catching the light
  function cactus(c, rng) {
    const arms = 1 + Math.floor(rng() * 3), sh = new Path2D();
    sh.arc(0, 0, 5.5, 0, TAU);
    const tips = [];
    for (let i = 0; i < arms; i++) { const a = rng() * TAU, l = 8 + rng() * 5; tips.push([Math.cos(a) * l, Math.sin(a) * l, 3.4]); sh.moveTo(Math.cos(a) * l + 3.4, Math.sin(a) * l); sh.arc(Math.cos(a) * l, Math.sin(a) * l, 3.4, 0, TAU); }
    softShadow(c, () => { c.beginPath(); c.ellipse(4, 6, 9, 7, 0.5, 0, TAU); }, 4, 6, 3, 'rgba(60,30,0,0.45)');
    c.lineCap = 'round';
    for (const [x, y] of tips) { c.strokeStyle = '#2e4a24'; c.lineWidth = 5.4; c.beginPath(); c.moveTo(0, 0); c.lineTo(x, y); c.stroke(); c.strokeStyle = '#4a7034'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(-0.6, -0.6); c.lineTo(x - 0.6, y - 0.6); c.stroke(); }
    for (const [x, y, r] of [...tips, [0, 0, 5.5]]) {
      circle(c, x, y, r); c.fillStyle = radial(c, x - r * 0.35, y - r * 0.35, r * 1.3, '#7aa050', '#2a4420', 0, 0); c.fill();
      c.strokeStyle = 'rgba(20,40,14,0.6)'; c.lineWidth = 0.4;
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.stroke(); }
      c.fillStyle = 'rgba(250,245,220,0.8)'; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.2; circle(c, x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, 0.25); c.fill(); }
    }
    if (rng() < 0.4) { for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; circle(c, Math.cos(a) * 1.3, Math.sin(a) * 1.3, 1); c.fillStyle = '#f0e0f0'; c.fill(); } circle(c, 0, 0, 0.8); c.fillStyle = '#e8c040'; c.fill(); }
  }
  function sagebrush(c, rng) { crown(c, 8 + rng() * 3, ['#5a5a3a', '#76764e', '#94946a', '#b0b088'], rng, { lumps: 4 }); }
  // a cow skull bleaching in the sun
  function skull(c, rng) {
    softShadow(c, () => { c.beginPath(); c.ellipse(0, 0, 6, 4.5, 0, 0, TAU); }, 2, 3, 2, 'rgba(60,30,0,0.45)');
    c.lineCap = 'round';
    for (const sd of [-1, 1]) { c.strokeStyle = '#d8ccb0'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-2, sd * 3.5); c.quadraticCurveTo(-4, sd * 9, -1, sd * 11); c.stroke(); }
    c.beginPath(); c.moveTo(-4, -4); c.quadraticCurveTo(0, -5, 6, -2); c.quadraticCurveTo(8, 0, 6, 2); c.quadraticCurveTo(0, 5, -4, 4); c.closePath();
    c.fillStyle = radial(c, -1, -1, 8, '#f6efe0', '#b8ab90', 0, 0); c.fill();
    c.fillStyle = '#3a2e22'; ellipse(c, -0.5, -2.2, 1.3, 1, 0); c.fill(); ellipse(c, -0.5, 2.2, 1.3, 1, 0); c.fill();
    ellipse(c, 5, -0.8, 0.5, 0.4); c.fill(); ellipse(c, 5, 0.8, 0.5, 0.4); c.fill();
  }
  // a red sandstone butte: a flat top lit gold, stepped cliffs falling away into shadow
  function mesa(c, rng) {
    const n = 9, top = [], foot = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU + (rng() - 0.5) * 0.4, r = 15 + rng() * 5; top.push([Math.cos(a) * r, Math.sin(a) * r * 0.85]); foot.push([Math.cos(a) * (r + 4) + 3, Math.sin(a) * (r + 4) * 0.85 + 4]); }
    softShadow(c, () => polyPath(c, foot), 8, 10, 4, 'rgba(70,24,0,0.5)');
    polyPath(c, foot); c.fillStyle = '#7a3a1e'; c.fill();
    for (let i = 0; i < n; i++) {
      const a = top[i], b = top[(i + 1) % n], fa = foot[i], fb = foot[(i + 1) % n];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, l = Math.hypot(mx, my) || 1, lit = (mx * LX + my * LY) / l;
      polyPath(c, [a, b, fb, fa]); c.fillStyle = shade('#a24e28', lit * 0.35 - 0.1); c.fill();
      c.strokeStyle = 'rgba(60,20,6,0.35)'; c.lineWidth = 0.4;
      for (let k = 1; k < 3; k++) { c.beginPath(); c.moveTo(lerp(a[0], fa[0], k / 3), lerp(a[1], fa[1], k / 3)); c.lineTo(lerp(b[0], fb[0], k / 3), lerp(b[1], fb[1], k / 3)); c.stroke(); }
    }
    polyPath(c, top); c.fillStyle = linear(c, -14, -14, 14, 14, [[0, '#e0a060'], [1, '#b8683a']]); c.fill();
    c.strokeStyle = 'rgba(80,30,10,0.6)'; c.lineWidth = 0.6; c.stroke();
    c.fillStyle = 'rgba(120,110,60,0.6)'; for (let i = 0; i < 6; i++) { circle(c, (rng() - 0.5) * 16, (rng() - 0.5) * 12, 0.8 + rng() * 1.2); c.fill(); }
  }
  // an oil pumpjack: the walking beam on its A-frame, the horse head over the well, a counterweight
  function pumpjack(c, rng) {
    softShadow(c, () => { c.beginPath(); c.rect(-15, -5, 30, 10); }, 5, 7, 3, 'rgba(60,30,0,0.5)');
    c.fillStyle = '#5a5248'; c.fillRect(-16, -7, 32, 14);
    c.fillStyle = 'rgba(30,20,10,0.6)'; ellipse(c, 13, 0, 4, 3.5); c.fill();
    c.fillStyle = linear(c, 0, -4, 0, 4, [[0, '#8a8478'], [1, '#3a362f']]); c.fillRect(-4, -5, 4, 10);
    c.fillStyle = linear(c, 0, -2, 0, 2, [[0, '#d8a038'], [1, '#8a5a18']]); c.fillRect(-14, -1.8, 26, 3.6);
    c.beginPath(); c.moveTo(12, -3); c.quadraticCurveTo(17, -2.5, 16, 3); c.lineTo(12, 3); c.closePath(); c.fillStyle = '#c08a2a'; c.fill();
    c.fillStyle = '#2a2622'; rr(c, -16, -4.5, 6, 9, 1); c.fill();
    c.fillStyle = 'rgba(255,240,200,0.3)'; c.fillRect(-14, -1.8, 26, 0.8);
    c.fillStyle = 'rgba(20,14,10,0.7)'; for (let i = 0; i < 3; i++) { ellipse(c, 14 + rng() * 4, (rng() - 0.5) * 8, 1.5 + rng() * 2, 1, rng() * 3); c.fill(); }
  }
  // rusty oil drums, some tipped over and leaking
  function drums(c, rng) {
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const x = (rng() - 0.5) * 16, y = (rng() - 0.5) * 14, col = ['#2f4a6a', '#8a2a20', '#3a5a2a', '#9a7a2a'][Math.floor(rng() * 4)];
      softShadow(c, () => { c.beginPath(); c.arc(x, y, 5, 0, TAU); }, 2, 3, 2, 'rgba(60,30,0,0.5)');
      circle(c, x, y, 5); c.fillStyle = radial(c, x - 1.5, y - 1.5, 6, shade(col, 0.3), shade(col, -0.4), 0, 0); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 0.5; circle(c, x, y, 4.2); c.stroke();
      c.fillStyle = 'rgba(130,60,20,0.55)'; for (let k = 0; k < 3; k++) { const a = rng() * TAU; ellipse(c, x + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5, 1.2, 0.6, a); c.fill(); }
      circle(c, x + 2, y - 2, 0.7); c.fillStyle = '#1a1a14'; c.fill();
    }
    if (rng() < 0.5) { ellipse(c, 8, 8, 8, 4, 0.3); c.fillStyle = 'rgba(20,16,12,0.65)'; c.fill(); }
  }
  // a date palm: long fronds fanning out from the crown, with dates clustered at the middle
  function palm(c, r, rng) {
    softShadow(c, () => { c.beginPath(); c.arc(0, 0, r * 0.9, 0, TAU); }, r * 0.6, r * 0.8, r * 0.3, 'rgba(40,20,0,0.5)');
    const n = 9 + Math.floor(rng() * 3);
    c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + rng() * 0.3, l = r * (0.85 + rng() * 0.25), ex = Math.cos(a) * l, ey = Math.sin(a) * l, lit = Math.cos(a) * LX + Math.sin(a) * LY;
      const col = shade('#4a7a2a', lit * 0.3);
      c.strokeStyle = shade(col, -0.2); c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(ex * 0.5 - ey * 0.1, ey * 0.5 + ex * 0.1, ex, ey); c.stroke();
      c.strokeStyle = col; c.lineWidth = 0.8;
      for (let k = 0.2; k < 1; k += 0.1) { const bx = ex * k, by = ey * k, w = r * 0.22 * Math.sin(k * Math.PI); for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(a + sd * 1.1) * w, by + Math.sin(a + sd * 1.1) * w); c.stroke(); } }
    }
    for (let k = 0; k < 7; k++) { const a = rng() * TAU; circle(c, Math.cos(a) * 1.8, Math.sin(a) * 1.8, 1); c.fillStyle = '#8a4a1a'; c.fill(); }
    circle(c, 0, 0, 1.6); c.fillStyle = '#5a4020'; c.fill();
  }
  function hay(c, rng) {
    const r = 12;
    softShadow(c, () => { c.beginPath(); c.arc(0, 0, r, 0, TAU); }, 4, 6, 4, 'rgba(0,0,0,0.5)');
    circle(c, 0, 0, r); c.fillStyle = radial(c, -3, -3, r * 1.3, '#e6cc7e', '#8a6c2c', 0, 0); c.fill();
    // the rolled spiral of straw, with stray stalks
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) { c.strokeStyle = ['rgba(110,80,30,0.45)', 'rgba(250,230,160,0.4)', 'rgba(140,100,40,0.35)'][i]; c.lineWidth = 0.7; c.beginPath(); for (let a = 0.2 + i * 0.5; a < 22; a += 0.25) { const rr2 = a * 0.52 + (rng() - 0.5) * 0.4; c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } c.stroke(); }
    c.strokeStyle = 'rgba(250,236,180,0.6)'; c.lineWidth = 0.4;
    for (let i = 0; i < 60; i++) { const a = rng() * TAU, d = rng() * r, l = 1.5 + rng() * 2.5, b = a + Math.PI / 2 + (rng() - 0.5); c.beginPath(); c.moveTo(Math.cos(a) * d, Math.sin(a) * d); c.lineTo(Math.cos(a) * d + Math.cos(b) * l, Math.sin(a) * d + Math.sin(b) * l); c.stroke(); }
    // net wrap and loose straw on the ground
    c.strokeStyle = 'rgba(240,240,230,0.35)'; c.lineWidth = 0.4; for (const a of [0.4, 1.6, 2.8]) { c.beginPath(); c.moveTo(Math.cos(a) * r, Math.sin(a) * r); c.lineTo(-Math.cos(a) * r, -Math.sin(a) * r); c.stroke(); }
    c.strokeStyle = 'rgba(200,170,90,0.7)'; c.lineWidth = 0.5;
    for (let i = 0; i < 14; i++) { const a = rng() * TAU, d = r + 1 + rng() * 5, l = 2 + rng() * 3, b = rng() * TAU; c.beginPath(); c.moveTo(Math.cos(a) * d, Math.sin(a) * d); c.lineTo(Math.cos(a) * d + Math.cos(b) * l, Math.sin(a) * d + Math.sin(b) * l); c.stroke(); }
  }
  function crops(c, rng) {
    c.fillStyle = 'rgba(70,48,28,0.65)'; c.fillRect(-21, -21, 42, 42);
    for (let row = -18; row <= 18; row += 6) {
      c.fillStyle = 'rgba(35,22,10,0.5)'; c.fillRect(-21, row + 1.4, 42, 1.4);
      c.fillStyle = 'rgba(160,120,80,0.3)'; c.fillRect(-21, row - 0.8, 42, 0.8);
      for (let col = -18; col <= 18; col += 3.4) {
        const pr = 1.7 + rng() * 0.6, rot = rng() * TAU;
        circle(c, col + 0.5, row + 0.6, pr); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
        for (let k = 0; k < 4; k++) { const q = rot + k * Math.PI / 2; ellipse(c, col + Math.cos(q) * pr * 0.55, row + Math.sin(q) * pr * 0.55, pr * 0.6, pr * 0.28, q); c.fillStyle = shade(rng() < 0.2 ? '#9aa83a' : '#5f8a2a', k % 2 ? -0.15 : 0.08); c.fill(); }
      }
    }
  }
  function fence(c, rng) {
    const posts = [-18, -9, 0, 9, 18], broken = rng() < 0.4 ? Math.floor(rng() * 4) : -1;
    softShadow(c, () => { c.beginPath(); c.rect(-18, -1.5, 36, 3); }, 3, 5, 2, 'rgba(0,0,0,0.45)');
    for (let i = 0; i < posts.length - 1; i++) {
      if (i === broken) { c.save(); c.translate(posts[i], 0); c.rotate(0.5); c.fillStyle = '#6a5038'; c.fillRect(0, -0.9, 8, 1.8); c.restore(); continue; }
      for (const yo of [-1.2, 1.2]) { c.fillStyle = linear(c, 0, yo - 0.8, 0, yo + 0.8, [[0, '#9a7a56'], [1, '#5a4430']]); c.fillRect(posts[i], yo - 0.8, 9, 1.6); }
    }
    for (const x of posts) { c.fillStyle = '#4a3828'; c.fillRect(x - 1.6, -1.6, 3.2, 3.2); c.fillStyle = 'rgba(255,230,190,0.35)'; c.fillRect(x - 1.6, -1.6, 3.2, 0.8); }
  }
  function grave(c, rng, kind) {
    // a sunken plot of disturbed earth, the headstone and its long shadow
    const dug = rng() < 0.25;
    c.fillStyle = 'rgba(52,40,28,0.75)'; rr(c, -7, -2, 14, 22, 3); c.fill();
    c.fillStyle = 'rgba(80,64,44,0.55)'; for (let i = 0; i < 8; i++) { ellipse(c, (rng() - 0.5) * 12, 2 + rng() * 16, 1 + rng() * 2, 0.8 + rng(), rng() * 3); c.fill(); }
    if (dug) { polyPath(c, [[-4, 4], [4, 3], [5, 14], [-4, 15]]); c.fillStyle = '#0c0907'; c.fill(); c.strokeStyle = 'rgba(100,80,56,0.7)'; c.lineWidth = 1; c.stroke(); }
    if (kind === 'cross') {
      softShadow(c, () => { c.beginPath(); c.rect(-2, -14, 4, 22); c.rect(-7, -8, 14, 4); }, 5, 7, 2, 'rgba(0,0,0,0.6)');
      c.fillStyle = linear(c, -2, -14, 2, 8, [[0, '#b8b4aa'], [1, '#6c6a64']]); c.fillRect(-2, -14, 4, 22); c.fillRect(-7, -8, 14, 4);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-2, -14, 1, 22); c.fillRect(-7, -8, 14, 1);
    } else {
      const sh = () => { c.beginPath(); c.moveTo(-8, -6); c.lineTo(-8, -10); c.quadraticCurveTo(0, -16, 8, -10); c.lineTo(8, -6); c.closePath(); };
      softShadow(c, sh, 6, 9, 2.5, 'rgba(0,0,0,0.6)');
      sh(); c.fillStyle = linear(c, -8, -14, 8, -6, [[0, '#b2aea6'], [1, '#5e5c57']]); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.5; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.moveTo(-8, -10); c.quadraticCurveTo(0, -16, 8, -10); c.lineTo(8, -9.3); c.quadraticCurveTo(0, -15, -8, -9.3); c.fill();
      if (rng() < 0.5) { c.strokeStyle = 'rgba(30,30,28,0.6)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-2, -12); c.lineTo(0, -9); c.lineTo(-1, -6.5); c.stroke(); }
      c.fillStyle = 'rgba(96,120,60,0.6)'; for (let i = 0; i < 4; i++) { circle(c, (rng() - 0.5) * 12, -7.5 - rng() * 3, 0.8 + rng()); c.fill(); }
    }
    if (rng() < 0.3) { c.fillStyle = ['#a83a40', '#e8e0e0', '#8a4aa0'][Math.floor(rng() * 3)]; for (let i = 0; i < 3; i++) { circle(c, -3 + i * 2.5, -3, 0.9); c.fill(); } }
  }
  function log(c, rng, snow) {
    softShadow(c, () => { c.beginPath(); c.roundRect(-16, -5, 32, 10, 5); }, 3, 5, 3, 'rgba(0,0,0,0.5)');
    c.beginPath(); c.roundRect(-16, -5, 32, 10, 5); c.fillStyle = linear(c, 0, -5, 0, 5, [[0, '#8a6a4a'], [0.5, '#5e4630'], [1, '#33261a']]); c.fill();
    c.strokeStyle = 'rgba(20,14,8,0.5)'; c.lineWidth = 0.5;
    for (let i = 0; i < 10; i++) { const y = -4 + rng() * 8; c.beginPath(); c.moveTo(-15 + rng() * 4, y); c.lineTo(10 + rng() * 5, y + (rng() - 0.5)); c.stroke(); }
    ellipse(c, 16, 0, 3, 5); c.fillStyle = '#c2a27a'; c.fill();
    c.strokeStyle = 'rgba(110,80,50,0.7)'; c.lineWidth = 0.4; for (let r = 1; r < 4.5; r += 1) { ellipse(c, 16, 0, r * 0.6, r); c.stroke(); }
    c.fillStyle = 'rgba(110,130,60,0.6)'; for (let i = 0; i < 5; i++) { ellipse(c, -12 + rng() * 22, 2 + rng() * 2, 1.5 + rng() * 2, 0.8, 0); c.fill(); }
    if (snow) { c.fillStyle = 'rgba(250,252,255,0.95)'; c.beginPath(); c.roundRect(-15, -5.4, 30, 4.6, 2.3); c.fill(); }
  }
  function barrel(c, rng) {
    ellipse(c, 6, 9, 14, 8); c.fillStyle = radial(c, 6, 9, 14, 'rgba(150,230,80,0.55)', 'rgba(80,160,40,0)', 0, 0); c.fill();
    softShadow(c, () => { c.beginPath(); c.arc(0, 0, 9, 0, TAU); }, 3, 4.5, 3, 'rgba(0,0,0,0.55)');
    circle(c, 0, 0, 9); c.fillStyle = radial(c, -2, -2, 11, '#d8c040', '#6a5a14', 0, 0); c.fill();
    for (const r of [8.2, 5.2]) { c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 0.8; circle(c, 0, 0, r); c.stroke(); c.strokeStyle = 'rgba(255,255,220,0.3)'; c.lineWidth = 0.4; c.beginPath(); c.arc(0, 0, r - 0.6, Math.PI * 1.05, Math.PI * 1.6); c.stroke(); }
    // hazard trefoil, bung and rust
    c.fillStyle = '#1a1a14'; for (let i = 0; i < 3; i++) { const a = i / 3 * TAU - Math.PI / 2; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 3.6, a - 0.45, a + 0.45); c.closePath(); c.fill(); }
    circle(c, 0, 0, 0.9); c.fillStyle = '#d8c040'; c.fill();
    circle(c, 4.6, -4, 1.1); c.fillStyle = '#3a3420'; c.fill();
    c.fillStyle = 'rgba(120,60,20,0.55)'; for (let i = 0; i < 5; i++) { const a = rng() * TAU; ellipse(c, Math.cos(a) * 7, Math.sin(a) * 7, 1.5 + rng() * 1.5, 0.8, a); c.fill(); }
  }
  function mushrooms(c, rng) {
    for (let i = 0; i < 6; i++) {
      const x = (rng() - 0.5) * 20, y = (rng() - 0.5) * 18, r = 2.2 + rng() * 4;
      softShadow(c, () => { c.beginPath(); c.arc(x, y, r, 0, TAU); }, 1.5, 2.5, 1.5, 'rgba(0,0,0,0.5)');
      circle(c, x, y, r * 1.6); c.fillStyle = radial(c, x, y, r * 1.6, 'rgba(200,140,255,0.28)', 'rgba(200,140,255,0)', 0, 0); c.fill();
      circle(c, x, y, r); c.fillStyle = radial(c, x - r * 0.3, y - r * 0.3, r * 1.2, '#dcc4ee', '#5a3a70', 0, 0); c.fill();
      c.fillStyle = 'rgba(255,250,255,0.85)'; for (let k = 0; k < 4; k++) { const a = rng() * TAU, d = r * 0.6 * rng(); circle(c, x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.12); c.fill(); }
    }
  }


  function decor(c, d, world, M) {
    const rng = mulberry32(d.seed), snow = world.id === 'tundra';
    if (BUILDING_KINDS.has(d.kind)) {
      // buildings keep their size and face the viewer; their chimneys and lamps are handed back
      // in map coordinates so the game can animate smoke and light them at night
      const out = { smoke: [], glows: [] };
      c.save(); c.translate(d.x, d.y); BUILDINGS.draw(d.kind, c, d, rng, out); c.restore();
      if (M) { for (const q of out.smoke) M.smoke.push({ x: q.x + d.x, y: q.y + d.y }); for (const q of out.glows) M.glows.push({ ...q, x: q.x + d.x, y: q.y + d.y }); }
      return;
    }
    c.save(); c.translate(d.x, d.y); c.scale(d.s, d.s);
    const quarter = Math.floor(d.rot * 2) * Math.PI / 2;
    switch (d.kind) {
      case 'oak': crown(c, 17, ['#1f3416', '#2f4a1e', '#46672a', '#628a36', '#86a84a'], rng, { lumps: 8 }); break;
      case 'bush': crown(c, 10, ['#203416', '#33501f', '#4c6e2c', '#6c8f3c'], rng, { lumps: 4 }); break;
      case 'cypress': crown(c, 16, ['#18241a', '#243424', '#34482e', '#4a5e36'], rng, { lumps: 7, moss: true }); break;
      case 'pine': pine(c, 18, rng, snow); break;
      case 'deadtree': deadTree(c, rng); break;
      case 'rock': rock(c, rng, false, world.id === 'swamp'); break;
      case 'snowrock': rock(c, rng, true); break;
      case 'hay': hay(c, rng); break;
      case 'crops': c.rotate(d.rot % (Math.PI / 2)); crops(c, rng); break;
      case 'fence': c.rotate(d.rot); fence(c, rng); break;
      case 'car': c.rotate(d.rot); car(c, rng); break;
      case 'tomb': c.rotate((rng() - 0.5) * 0.25); grave(c, rng, 'stone'); break;
      case 'cross': c.rotate((rng() - 0.5) * 0.3); grave(c, rng, 'cross'); break;
      case 'log': c.rotate(d.rot); log(c, rng, snow); break;
      case 'barrel': barrel(c, rng); break;
      case 'mushroom': mushrooms(c, rng); break;
      case 'reeds': reedClump(c, 0, 0, 1.3, rng, true); break;
      case 'cactus': c.scale(1.3, 1.3); cactus(c, rng); break;
      case 'sagebrush': sagebrush(c, rng); break;
      case 'skull': c.rotate(d.rot); skull(c, rng); break;
      case 'mesa': mesa(c, rng); break;
      case 'wreck': c.rotate(d.rot); car(c, rng, true); break;
      case 'pumpjack': c.rotate(quarter); c.scale(1.4, 1.4); pumpjack(c, rng); break;
      case 'drums': drums(c, rng); break;
      case 'palm': palm(c, 16, rng); break;
    }
    c.restore();
  }

  function render(c, M, s) {
    const world = M.world;
    c.setTransform(s, 0, 0, s, 0, 0);
    c.imageSmoothingEnabled = true;
    c.drawImage(ground(M), 0, 0, W, H);
    c.fillStyle = grainPattern(c); c.fillRect(0, 0, W, H);

    groundDetail(c, M);
    water(c, M);
    roads(c, M);
    bridges(c, M);
    const ds = [...M.decor].sort((a, b) => a.y - b.y);
    M.smoke = []; M.glows = [];
    for (const d of ds) decor(c, d, world, M);

    // a soft vignette and a breath of atmosphere over the whole field
    c.fillStyle = radial(c, W / 2, H / 2, Math.hypot(W, H) * 0.6, 'rgba(0,0,0,0)', world.id === 'tundra' ? 'rgba(40,60,90,0.18)' : world.id === 'desert' ? 'rgba(80,36,8,0.24)' : 'rgba(0,0,0,0.28)', 0, 0);
    c.fillRect(0, 0, W, H);
  }

  return { render, decor };
})();
