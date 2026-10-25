'use strict';
// ============================================================
// Story panel art. Every scene paints a static base once into a cached canvas the size of its
// panel; some also draw a light animated layer each frame (embers, snow, a pulsing glow).
// Scenes work in panel pixels: w and h are the panel's size, u is one percent of its short side.
// ============================================================
const SCENES = (() => {
  const M = MANGA, { INK, PAPER, SPOT, tone, gradTone, poly, sub, ell, glow, spot } = M;
  const S = {};
  const cellOf = (w, h, k = 1) => Math.max(3, Math.round((Math.min(w, h) / 90) * k));
  const unit = (w, h) => Math.min(w, h) / 100;
  const font = (px, wt = 700) => `${wt} ${Math.round(px)}px "Barlow Condensed", "Arial Narrow", sans-serif`;

  // ---------- shared helpers ----------
  function paper(c, w, h) { c.fillStyle = PAPER; c.fillRect(0, 0, w, h); }
  // fill the current path with paper and then a screentone (d >= 1 is solid ink)
  function fillT(c, d, k) { c.fillStyle = PAPER; c.fill(); if (d >= 1) { c.fillStyle = INK; c.fill(); } else if (d > 0) { c.fillStyle = tone(c, d, k); c.fill(); } }
  function rectT(c, x, y, w, h, d, k) { c.beginPath(); c.rect(x, y, w, h); fillT(c, d, k); }
  function vTone(c, x, y0, w, y1, d0, d1, k) { gradTone(c, 0, y0, 0, y1, d0, d1, k, INK, [x, y0, w, y1 - y0]); }
  function radialTone(c, cx, cy, r0, r1, d0, d1, k, rect) {
    const [rx, ry, rw, rh] = rect; c.fillStyle = INK;
    for (let y = ry, row = 0; y < ry + rh + k; y += k, row++) {
      for (let x = rx + (row % 2 ? k / 2 : 0); x < rx + rw + k; x += k) {
        const d = lerp(d0, d1, clamp((Math.hypot(x - cx, y - cy) - r0) / (r1 - r0), 0, 1));
        if (d <= 0.01) continue;
        c.beginPath(); c.arc(x, y, k * 0.62 * Math.sqrt(d), 0, TAU); c.fill();
      }
    }
  }
  // the dark corners every panel gets so the eye sits in the middle
  function vignette(c, w, h, d = 0.75, k = cellOf(w, h)) { radialTone(c, w / 2, h / 2, Math.hypot(w, h) * 0.32, Math.hypot(w, h) * 0.58, 0, d, k, [0, 0, w, h]); }
  function nightSky(c, w, h, k, hy = 0.8, low = 0.3, starN = 80, seed = 5) {
    paper(c, w, h);
    c.fillStyle = INK; c.fillRect(0, 0, w, h * hy * 0.3);
    vTone(c, 0, h * hy * 0.28, w, h * hy + 2, 1, low, k);
    if (starN) M.stars(c, w, h * hy, starN, seed);
  }
  // a skyline of hard light rays fanning from a point
  function rays(c, cx, cy, n, r, a = 0.25, seed = 3, col = PAPER, a0 = 0, a1 = TAU) {
    const rng = mulberry32(seed); c.save(); c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const ang = lerp(a0, a1, rng()), sp = 0.01 + rng() * 0.04;
      c.globalAlpha = a * (0.4 + rng() * 0.6);
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(ang - sp) * r, cy + Math.sin(ang - sp) * r); c.lineTo(cx + Math.cos(ang + sp) * r, cy + Math.sin(ang + sp) * r); c.fill();
    }
    c.restore();
  }
  // billowing smoke or dust: a scalloped outline, toned and shaded toward one side
  function cloudPath(c, x, y, r, seed, n = 9, sq = 0.75) {
    const rng = mulberry32(seed), m = 9 + n, pts = [];
    for (let i = 0; i < m; i++) { const a = i / m * TAU + rng() * 0.2, rr = r * (0.72 + rng() * 0.38); pts.push([x + Math.cos(a) * rr * 1.3, y + Math.sin(a) * rr * sq]); }
    c.beginPath();
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    let st = mid(pts[m - 1], pts[0]); c.moveTo(...st);
    for (let i = 0; i < m; i++) {
      const p = pts[i], q = pts[(i + 1) % m], md = mid(p, q), dx = p[0] - x, dy = p[1] - y, L = Math.hypot(dx, dy) || 1;
      c.quadraticCurveTo(p[0] + dx / L * r * 0.18, p[1] + dy / L * r * 0.18 * sq, md[0], md[1]);
    }
    c.closePath();
  }
  function cloud(c, x, y, r, seed, d, k, n = 9, lw = 1.5, shade = 0.35, sq = 0.75) {
    if (lw) { cloudPath(c, x, y, r, seed, n, sq); c.strokeStyle = INK; c.lineWidth = lw; c.stroke(); }
    cloudPath(c, x, y, r, seed, n, sq); fillT(c, d, k);
    if (lw) { c.strokeStyle = INK; c.lineWidth = lw; c.stroke(); }
    if (shade) { c.save(); cloudPath(c, x, y, r, seed, n, sq); c.clip(); gradTone(c, x - r * 0.4, y - r * 0.6, x + r * 0.5, y + r * 0.8, 0, shade, k, INK, [x - r * 1.5, y - r, r * 3, r * 2]); c.restore(); }
  }
  // soft drifting fog, painted as a feathered ellipse
  function fog(c, x, y, rx, ry, a = 0.5, col = '242,238,228') {
    c.save(); c.translate(x, y); c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.6, `rgba(${col},${a * 0.5})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.fillRect(-rx, -rx, rx * 2, rx * 2); c.restore();
  }
  // hand-drawn crack: a jittered line that forks
  function crack(c, x, y, len, ang, seed, lw, depth = 2, col = INK) {
    const rng = mulberry32(seed);
    const go = (x0, y0, L, a, w, dpt) => {
      let px = x0, py = y0; c.lineWidth = w; c.beginPath(); c.moveTo(px, py);
      const steps = 5;
      for (let i = 0; i < steps; i++) { a += (rng() - 0.5) * 0.9; px += Math.cos(a) * L / steps; py += Math.sin(a) * L / steps; c.lineTo(px, py); if (dpt > 0 && rng() < 0.35) { c.stroke(); go(px, py, L * 0.45, a + (rng() < 0.5 ? -0.8 : 0.8), w * 0.6, dpt - 1); c.lineWidth = w; c.beginPath(); c.moveTo(px, py); } }
      c.stroke();
    };
    c.strokeStyle = col; c.lineCap = 'round'; go(x, y, len, ang, lw, depth);
  }
  // rolling ground silhouette from y down to the bottom
  function hills(c, w, h, y, amp, seed, col = INK) {
    const rng = mulberry32(seed), ph = rng() * 9, ph2 = rng() * 9;
    c.beginPath(); c.moveTo(0, h + 2);
    for (let x = 0; x <= w + 8; x += 8) c.lineTo(x, y - Math.sin(x / w * 3.1 + ph) * amp - Math.sin(x / w * 9 + ph2) * amp * 0.3);
    c.lineTo(w, h + 2); c.closePath(); c.fillStyle = col; c.fill();
  }
  function hillTop(w, y, amp, seed) { const rng = mulberry32(seed), ph = rng() * 9, ph2 = rng() * 9; return (x) => y - Math.sin(x / w * 3.1 + ph) * amp - Math.sin(x / w * 9 + ph2) * amp * 0.3; }
  // a horizon of buildings
  function skyline(c, w, y, hmax, seed, col = INK, lit = 0) {
    const rng = mulberry32(seed); c.fillStyle = col;
    const wins = [];
    for (let x = -10; x < w + 10;) {
      const bw = hmax * (0.18 + rng() * 0.35), bh = hmax * (0.3 + rng() * 0.7);
      c.fillRect(x, y - bh, bw + 1, bh + 2);
      if (rng() < 0.3) c.fillRect(x + bw * 0.4, y - bh - hmax * 0.12, Math.max(1, bw * 0.06), hmax * 0.12);
      if (rng() < 0.25) { c.beginPath(); c.moveTo(x, y - bh); c.lineTo(x + bw / 2, y - bh - bw * 0.4); c.lineTo(x + bw, y - bh); c.fill(); }
      if (lit) for (let wy = y - bh + bw * 0.15; wy < y - 4; wy += bw * 0.2) for (let wx = x + bw * 0.12; wx < x + bw * 0.85; wx += bw * 0.2) if (rng() < lit) wins.push([wx, wy, bw * 0.08, bw * 0.1]);
      x += bw + (rng() < 0.3 ? rng() * hmax * 0.1 : 0);
    }
    return wins;
  }
  // a flame tongue rising from (x, y), r wide
  function flame(c, x, y, r, hgt, seed) {
    const rng = mulberry32(seed);
    c.beginPath(); c.moveTo(x - r, y);
    const n = 4 + Math.floor(rng() * 3);
    for (let i = 0; i <= n; i++) {
      const fx = x - r + (i / n) * r * 2, th = hgt * (0.45 + rng() * 0.55) * (1 - Math.abs(i / n - 0.5) * 0.9);
      c.quadraticCurveTo(fx - r * 0.3, y - th * 0.55, fx + (rng() - 0.5) * r * 0.3, y - th);
      c.quadraticCurveTo(fx + r * 0.1, y - th * 0.4, fx + r / n, y - th * 0.25);
    }
    c.lineTo(x + r, y); c.closePath();
  }
  function shard(c, x, y, s, a, seed, d = 0, k = 3, lw = 1.2) {
    const rng = mulberry32(seed);
    c.save(); c.translate(x, y); c.rotate(a);
    poly(c, [[-s * 0.2, -s * (0.5 + rng() * 0.4)], [s * (0.3 + rng() * 0.3), -s * 0.1], [s * 0.1, s * (0.6 + rng() * 0.5)], [-s * 0.35, s * 0.2]]);
    fillT(c, d, k); c.strokeStyle = INK; c.lineWidth = lw; c.stroke();
    c.restore();
  }
  // a long crystal prism standing at (x, y) leaning by ang; left face lit, right face toned
  function crystal(c, x, y, len, wid, ang, k, lw, d = 0.5) {
    c.save(); c.translate(x, y); c.rotate(ang);
    const tip = -len, sh = -len * 0.78;
    poly(c, [[-wid, 0], [-wid, sh], [0, tip], [0, 0]]); fillT(c, 0.08, k);
    poly(c, [[0, 0], [0, tip], [wid, sh], [wid, 0]]); fillT(c, d, k);
    poly(c, [[-wid, 0], [-wid, sh], [0, tip], [wid, sh], [wid, 0]]); c.strokeStyle = INK; c.lineWidth = lw; c.stroke();
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, tip); c.lineWidth = lw * 0.7; c.stroke();
    c.strokeStyle = PAPER; c.lineWidth = lw * 0.9; c.beginPath(); c.moveTo(-wid * 0.55, -len * 0.05); c.lineTo(-wid * 0.55, sh * 0.9); c.stroke();
    c.restore();
  }
  // ---------- posed figures ----------
  // A jointed silhouette: limbs are round-capped strokes on a skeleton, so any pose reads naturally.
  // Angles are radians from hanging straight down, positive swinging toward the way the figure faces.
  const POSES = {
    stand: { lean: 0, head: 0, ua1: 0.12, la1: 0.15, ua2: -0.1, la2: 0.2, th1: 0.08, sh1: 0.02, th2: -0.08, sh2: 0.04 },
    gun: { lean: 0.04, head: 0.05, ua1: 0.35, la1: 1.25, ua2: 0.75, la2: 1.0, th1: 0.18, sh1: 0.05, th2: -0.14, sh2: 0.1 },
    march: { lean: 0.1, head: 0, ua1: 0.35, la1: 1.25, ua2: 0.75, la2: 1.0, th1: 0.45, sh1: 0.3, th2: -0.3, sh2: 0.5 },
    run: { lean: 0.32, head: -0.1, ua1: -0.9, la1: 1.6, ua2: 1.0, la2: 1.3, th1: 1.05, sh1: 1.25, th2: -0.55, sh2: 1.5 },
    lookUp: { lean: -0.08, head: -0.55, ua1: 2.5, la1: 1.3, ua2: -0.12, la2: 0.2, th1: 0.1, sh1: 0, th2: -0.1, sh2: 0.05 },
    shamble: { lean: 0.38, head: 0.35, ua1: 1.35, la1: 0.15, ua2: 1.15, la2: 0.35, th1: 0.32, sh1: 0.3, th2: -0.25, sh2: 0.55 },
    fallen: { lean: 0.22, head: 0.55, ua1: 0.45, la1: 0.35, ua2: -0.35, la2: 0.45, th1: 1.35, sh1: 1.45, th2: 0.12, sh2: 2.5 },
    kneel: { lean: 0.5, head: 0.5, ua1: 0.4, la1: 0.2, ua2: 0.9, la2: 0.1, th1: 1.5, sh1: 1.55, th2: 0.1, sh2: 2.6 },
    thrust: { lean: 0.42, head: -0.05, ua1: 1.6, la1: 0.05, ua2: 1.45, la2: 0.2, th1: 0.75, sh1: 0.7, th2: -0.6, sh2: 0.3 },
    sit: { lean: -0.05, head: 0.35, ua1: 0.55, la1: 0.9, ua2: 0.3, la2: 1.0, th1: 1.45, sh1: 1.6, th2: 1.3, sh2: 1.3 },
    aim: { lean: 0.06, head: 0.14, ua1: 1.5, la1: 0.12, ua2: 0.85, la2: 1.5, th1: 0.32, sh1: 0.12, th2: -0.28, sh2: 0.18 },
    point: { lean: 0.02, head: 0, ua1: 1.45, la1: 0.05, ua2: -0.05, la2: 0.3, th1: 0.12, sh1: 0.04, th2: -0.1, sh2: 0.05 },
  };
  // kinds: soldier, moreno, voss, okafor, coat, parka, farmer, zombie, and the giants harvester, grave, frozen
  function figure(c, x, y, h, kind, o = {}) {
    const giant = kind === 'harvester' || kind === 'grave' || kind === 'frozen';
    const armed = kind === 'soldier' || kind === 'moreno';
    const P = { ...POSES[o.pose || (kind === 'zombie' ? 'shamble' : armed ? 'gun' : 'stand')], ...(o.adj || {}) };
    const s = h / 100, f = o.face || 1;
    const dir = (a, l) => [Math.sin(a) * l, Math.cos(a) * l];
    const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
    const b = giant ? 1.18 : kind === 'parka' || kind === 'moreno' ? 1.22 : kind === 'zombie' ? 1.1 : kind === 'okafor' || kind === 'voss' || kind === 'laila' ? 0.9 : 1;
    const H = [0, -52], up = [Math.sin(P.lean), -Math.cos(P.lean)], perp = [Math.cos(P.lean), Math.sin(P.lean)];
    const S = add(H, up, 29), N = add(S, up, 4.5);
    const ha = P.lean + P.head, hd = add(N, [Math.sin(ha), -Math.cos(ha)], 7);
    const arm = (ua, la, sd) => { const sh = add(S, perp, -sd * 6 * b), e = add(sh, dir(ua, 15)), hnd = add(e, dir(ua + la, 14)); return [sh, e, hnd]; };
    const leg = (th, sh, sd) => { const hp = add(H, perp, -sd * 3.5 * b), k = add(hp, dir(th, 23)), a = add(k, dir(th - sh, 23)); return [hp, k, a]; };
    const A1 = arm(P.ua1, P.la1, -1), A2 = arm(P.ua2, P.la2, 1), L1 = leg(P.th1, P.sh1, -1), L2 = leg(P.th2, P.sh2, 1);
    const ground = Math.max(L1[2][1], L2[2][1]) + 3;
    c.save(); c.translate(x, y); c.scale(s * f, s); if (o.rot) c.rotate(o.rot * f); c.translate(0, -ground);
    c.lineCap = 'round'; c.lineJoin = 'round';
    // a limb tapering through its joints, with a slight swell at the thigh and forearm
    const limb = (pts, w0, w1) => { for (let i = 0; i < pts.length - 1; i++) { c.lineWidth = lerp(w0, w1, i / (pts.length - 1)); c.beginPath(); c.moveTo(...pts[i]); c.lineTo(...pts[i + 1]); c.stroke(); } };
    const foot = (L) => { const a = L[2]; c.beginPath(); c.moveTo(a[0] - 2.5, a[1] - 3); c.quadraticCurveTo(a[0] + 4, a[1] - 2, a[0] + 7, a[1] + 1); c.lineTo(a[0] + 7, a[1] + 3); c.lineTo(a[0] - 3.5, a[1] + 3); c.closePath(); c.fill(); };
    const hand = (A) => { c.beginPath(); c.arc(A[2][0], A[2][1], 3.1 * Math.sqrt(b), 0, TAU); c.fill(); };
    const tp = (t, wd) => [add(lerp2(S, H, t), perp, -wd), add(lerp2(S, H, t), perp, wd)];
    const draw = (col) => {
      c.fillStyle = col; c.strokeStyle = col;
      limb(A2, 6.2 * b, 4.6 * b); hand(A2); limb(L2, 9.2 * b, 6.2 * b); foot(L2);
      // Laila's long waves hang down her back
      if (kind === 'laila') { const back = [-Math.cos(ha), -Math.sin(ha)]; let p0 = add(hd, back, 2); for (let i = 1; i <= 8; i++) { const k = i / 8, p1 = add(add(lerp2(hd, lerp2(S, H, 0.55), k), back, 6 + k * 3), perp, Math.sin(k * 7) * 1.6); c.lineWidth = lerp(10, 4, k); c.beginPath(); c.moveTo(...p0); c.lineTo(...p1); c.stroke(); p0 = p1; } }
      // torso: broad shoulders, a narrower waist, hips
      const t0 = tp(0, 10.5 * b), t1 = tp(0.35, 9.4 * b), t2 = tp(0.75, 7 * b), t3 = tp(1, 8.2 * b);
      c.beginPath(); c.moveTo(...t0[0]); c.lineTo(...t1[0]); c.lineTo(...t2[0]); c.lineTo(...t3[0]); c.lineTo(...t3[1]); c.lineTo(...t2[1]); c.lineTo(...t1[1]); c.lineTo(...t0[1]); c.closePath(); c.fill();
      for (const sd of [-1, 1]) { c.beginPath(); c.arc(...add(S, perp, sd * 6.5 * b), 4.6 * b, 0, TAU); c.fill(); }
      c.beginPath(); c.arc(...add(H, up, 1), 7.8 * b, 0, TAU); c.fill();
      c.lineWidth = 5.4 * Math.min(b, 1.2); c.beginPath(); c.moveTo(...S); c.lineTo(...N); c.stroke();
      // long coats and robes hang to the knee
      if (kind === 'coat' || kind === 'okafor' || kind === 'grave' || kind === 'harvester') {
        const fl = o.flare ?? (o.pose === 'run' ? 1 : 0), kneeY = Math.max(L1[1][1], L2[1][1]) + (kind === 'grave' ? 18 : 5);
        const fx = Math.max(L1[1][0], L2[1][0]) + 5 * b, bx = Math.min(L1[1][0], L2[1][0]) - 6 * b - fl * 7;
        c.beginPath(); c.moveTo(...t1[0]); c.lineTo(...t1[1]);
        c.quadraticCurveTo(fx + 2, (t1[1][1] + kneeY) / 2, fx, kneeY);
        const n = kind === 'grave' || kind === 'harvester' ? 7 : 3;
        for (let i = 1; i <= n; i++) { const xx = lerp(fx, bx, i / n), jag = kind === 'grave' || kind === 'harvester' ? (i % 2 ? 7 : -2) : (i % 2 ? 1.5 : 0); c.lineTo(xx, kneeY - fl * 5 * (i / n) + jag); }
        c.quadraticCurveTo(bx - 1, (t1[0][1] + kneeY) / 2, ...t1[0]); c.closePath(); c.fill();
      }
      if (armed) { const pk = [add(S, perp, -9 * b), add(S, perp, -16 * b), add(lerp2(S, H, 0.7), perp, -15 * b), add(lerp2(S, H, 0.7), perp, -8 * b)]; c.beginPath(); sub(c, pk); c.fill(); }
      if (kind === 'parka') { c.beginPath(); c.moveTo(...t2[0]); c.lineTo(...t2[1]); c.lineTo(t2[1][0] + 3, t2[1][1] + 14); c.lineTo(t2[0][0] - 3, t2[0][1] + 14); c.closePath(); c.fill(); }
      if (kind === 'zombie') { c.lineWidth = 1.6; for (let i = 0; i < 5; i++) { const p = add(t3[0], [t3[1][0] - t3[0][0], t3[1][1] - t3[0][1]], i / 4); c.beginPath(); c.moveTo(...p); c.lineTo(p[0] - 1, p[1] + 4 + (i % 2) * 4); c.stroke(); } for (const A of [A1, A2]) { c.beginPath(); c.moveTo(...A[1]); c.lineTo(A[1][0] - 1, A[1][1] + 5); c.stroke(); } }
      limb(L1, 9.2 * b, 6.2 * b); foot(L1);
      // head and headgear
      c.beginPath(); ell(c, hd[0], hd[1], 6.3 * (kind === 'parka' ? 1.35 : giant ? 1.2 : 1), 7.4 * (kind === 'parka' ? 1.25 : giant ? 1.1 : 1), ha); c.fill();
      c.beginPath(); ell(c, hd[0] + Math.cos(ha) * 2.5 + Math.sin(ha) * 4, hd[1] + Math.sin(ha) * 2.5 + Math.cos(ha) * 4, 4.4, 3.6, ha); c.fill(); // jaw
      if (armed || kind === 'frozen') { c.beginPath(); ell(c, hd[0] - 0.5, hd[1] - 2.2, 8.8, 7.4, ha, Math.PI, TAU); c.fill(); c.lineWidth = 2.2; c.beginPath(); c.moveTo(...add(hd, [Math.cos(ha), Math.sin(ha)], -9.5)); c.lineTo(...add(add(hd, [Math.cos(ha), Math.sin(ha)], 10), [Math.sin(ha), -Math.cos(ha)], 1.5)); c.stroke(); }
      if (kind === 'farmer' || kind === 'harvester') { c.save(); c.translate(...hd); c.rotate(ha); c.beginPath(); ell(c, 0, -5, kind === 'harvester' ? 22 : 15, 2.8); ell(c, 0, -6.5, 7.5, 6, 0, Math.PI, TAU); c.fill(); c.restore(); }
      if (kind === 'grave') { c.save(); c.translate(...hd); c.rotate(ha); c.beginPath(); ell(c, 0, -1, 9.5, 10.5, 0, Math.PI * 0.9, Math.PI * 2.1); sub(c, [[-8, -6], [-8, -10], [-6, -16], [-4, -10], [-2, -18], [0, -11], [2, -18], [4, -10], [6, -16], [8, -10], [8, -6]]); c.fill(); c.restore(); }
      if (kind === 'okafor') { c.beginPath(); c.arc(...add(hd, [Math.sin(ha - 0.9), -Math.cos(ha - 0.9)], 7.5), 4, 0, TAU); c.fill(); }
      if (kind === 'laila') {
        // a cowboy hat, brim curled up at both sides
        c.save(); c.translate(...hd); c.rotate(ha); c.beginPath();
        c.moveTo(-15, -9); c.quadraticCurveTo(-12, -3.5, 0, -3.5); c.quadraticCurveTo(12, -3.5, 15, -9); c.quadraticCurveTo(10, -5.5, 0, -6); c.quadraticCurveTo(-10, -5.5, -15, -9); c.closePath();
        c.moveTo(-7, -5); c.bezierCurveTo(-8, -12, -5, -14, -1, -12.5); c.lineTo(1, -12.5); c.bezierCurveTo(5, -14, 8, -12, 7, -5); c.closePath(); c.fill();
        c.restore();
      }
      if (kind === 'parka') { c.lineWidth = 2; c.beginPath(); c.arc(hd[0], hd[1], 9.5, ha - Math.PI * 0.95, ha + Math.PI * 0.2); c.stroke(); }
      if (kind === 'voss') { c.lineWidth = 1.6; c.beginPath(); c.arc(hd[0], hd[1] - 1, 8.2, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); c.beginPath(); c.moveTo(hd[0] + 7, hd[1] + 1); c.lineTo(hd[0] + 9, hd[1] + 6); c.stroke(); c.beginPath(); ell(c, hd[0] - 3, hd[1] - 3, 7, 6.5); c.fill(); }
      // weapons and props
      const hn = A1[2];
      if (armed) {
        const g = kind === 'moreno' ? 1.45 : 1, back = A2[2], ang = Math.atan2(hn[1] - back[1] + 2, hn[0] - back[0]);
        c.lineWidth = 3.4 * g; c.beginPath(); c.moveTo(back[0] - Math.cos(ang) * 9, back[1] - Math.sin(ang) * 9 + 2); c.lineTo(hn[0] + Math.cos(ang) * 22 * g, hn[1] + Math.sin(ang) * 22 * g); c.stroke();
        c.lineWidth = 1.6; c.beginPath(); c.moveTo(hn[0] + Math.cos(ang) * 22 * g, hn[1] + Math.sin(ang) * 22 * g); c.lineTo(hn[0] + Math.cos(ang) * 30 * g, hn[1] + Math.sin(ang) * 30 * g); c.stroke();
        c.lineWidth = 2.6; c.beginPath(); c.moveTo(hn[0] + 1, hn[1]); c.lineTo(hn[0] + 1.5, hn[1] + 7); c.stroke();
      }
      if (kind === 'harvester') { c.lineWidth = 2.6; c.beginPath(); c.moveTo(hn[0] - 4, hn[1] + 40); c.lineTo(hn[0] + 4, hn[1] - 50); c.stroke(); c.beginPath(); c.moveTo(hn[0] + 4, hn[1] - 50); c.quadraticCurveTo(hn[0] - 26, hn[1] - 62, hn[0] - 44, hn[1] - 34); c.quadraticCurveTo(hn[0] - 22, hn[1] - 50, hn[0] + 2, hn[1] - 42); c.fill(); }
      if (o.prop === 'case') c.fillRect(hn[0] - 7, hn[1] - 1, 14, 10);
      if (kind === 'laila') {
        // a scoped hunting rifle: stock in the shoulder, barrel out past the leading hand
        const tr = A2[2], ang = Math.atan2(hn[1] - tr[1], hn[0] - tr[0]), ca = Math.cos(ang), sa = Math.sin(ang), at = (d, o2 = 0) => [tr[0] + ca * d - sa * o2, tr[1] + sa * d + ca * o2];
        c.lineWidth = 4.2; c.beginPath(); c.moveTo(...at(-12, 1.5)); c.lineTo(...at(8)); c.stroke();
        c.lineWidth = 2.2; c.beginPath(); c.moveTo(...at(4)); c.lineTo(...at(Math.hypot(hn[0] - tr[0], hn[1] - tr[1]) + 26)); c.stroke();
        c.lineWidth = 3; c.beginPath(); c.moveTo(...at(0, -4)); c.lineTo(...at(12, -4)); c.stroke();
        c.beginPath(); c.moveTo(...at(-12, 0)); c.lineTo(...at(-14, 4)); c.lineTo(...at(-10, 4.5)); c.closePath(); c.fill();
        o.muzzle = at(Math.hypot(hn[0] - tr[0], hn[1] - tr[1]) + 27);
      }
      limb(A1, 6.2 * b, 4.6 * b); hand(A1);
    };
    if (o.rim) { c.save(); c.translate(-1.9, -1.3); draw(o.rim); c.restore(); }
    draw(o.col || INK);
    if (o.eyes) { c.fillStyle = o.eyes; for (const dx of giant ? [-2.5, 3.5] : [3.5]) { c.beginPath(); c.arc(...add(add(hd, [Math.cos(ha), Math.sin(ha)], dx), [Math.sin(ha), -Math.cos(ha)], 0.5), giant ? 1.6 : 1.3, 0, TAU); c.fill(); } }
    const m = c.getTransform(), map = (p) => { const q = m.transformPoint(new DOMPoint(p[0], p[1])); return [q.x, q.y]; };
    const res = { hand: map(A1[2]), back: map(A2[2]), head: map(hd), muzzle: map(o.muzzle || A1[2]) };
    c.restore();
    // transformPoint gives device space; undo the caller's transform so results are in its units
    const inv = c.getTransform().inverse(), un = (p) => { const q = inv.transformPoint(new DOMPoint(p[0], p[1])); return [q.x, q.y]; };
    return { hand: un(res.hand), back: un(res.back), head: un(res.head), muzzle: un(res.muzzle) };
  }
  const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  // a clawing hand at the end of a forearm reaching from (x, y) toward ang; bony adds knuckle highlights
  function claw(c, x, y, len, ang, wd, seed, o = {}) {
    const rng = mulberry32(seed), col = o.col || INK;
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = col; c.fillStyle = col;
    const draw = () => {
      c.lineWidth = wd; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(lerp(x, ex, 0.5) + Math.sin(ang) * wd * 0.3, lerp(y, ey, 0.5) - Math.cos(ang) * wd * 0.3, ex, ey); c.stroke();
      c.beginPath(); c.ellipse(ex + Math.cos(ang) * wd * 0.35, ey + Math.sin(ang) * wd * 0.35, wd * 0.75, wd * 0.62, ang, 0, TAU); c.fill();
      for (let i = 0; i < 5; i++) {
        const thumb = i === 4, spread = thumb ? -1.15 : (i - 1.5) * 0.28, fl = wd * (thumb ? 1.0 : [1.25, 1.5, 1.42, 1.1][i]);
        let a = ang + spread + (rng() - 0.5) * 0.15, px = ex + Math.cos(ang + spread * 0.8) * wd * 0.6, py = ey + Math.sin(ang + spread * 0.8) * wd * 0.6;
        for (let j = 0; j < 3; j++) {
          const sl = fl * [0.45, 0.33, 0.25][j], nx = px + Math.cos(a) * sl, ny = py + Math.sin(a) * sl;
          c.lineWidth = wd * (0.26 - j * 0.05); c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
          px = nx; py = ny; a += (o.curl ?? 0.35) * (thumb ? -0.6 : 1);
        }
        if (o.bony) { c.save(); c.strokeStyle = PAPER; c.lineWidth = wd * 0.06; c.beginPath(); c.moveTo(ex + Math.cos(ang + spread * 0.8) * wd * 0.9, ey + Math.sin(ang + spread * 0.8) * wd * 0.9); c.lineTo(px - Math.cos(a) * wd * 0.2, py - Math.sin(a) * wd * 0.2); c.stroke(); c.restore(); }
      }
    };
    if (o.rim) { c.save(); c.translate(-wd * 0.08, -wd * 0.06); c.strokeStyle = o.rim; c.fillStyle = o.rim; draw(); c.restore(); c.strokeStyle = col; c.fillStyle = col; }
    draw(); c.restore();
  }
  // head and shoulders seen from behind, for over-the-shoulder shots; s is the head height
  function backBust(c, x, y, s, kind, o = {}) {
    c.save(); c.translate(x, y); if (o.face < 0) c.scale(-1, 1);
    const draw = (col) => {
      c.fillStyle = col; c.beginPath();
      c.moveTo(-s * 1.5, s * 2); c.bezierCurveTo(-s * 1.45, s * 0.75, -s * 0.9, s * 0.62, -s * 0.32, s * 0.38);
      c.lineTo(-s * 0.3, s * 0.1); c.lineTo(s * 0.3, s * 0.1); c.lineTo(s * 0.32, s * 0.38);
      c.bezierCurveTo(s * 0.9, s * 0.62, s * 1.45, s * 0.75, s * 1.5, s * 2); c.closePath();
      ell(c, 0, -s * 0.12, s * (kind === 'parka' ? 0.52 : 0.38), s * (kind === 'parka' ? 0.58 : 0.48));
      if (kind === 'okafor') ell(c, -s * 0.05, -s * 0.62, s * 0.2, s * 0.18);
      if (kind === 'soldier') ell(c, 0, -s * 0.22, s * 0.46, s * 0.4, 0, Math.PI, TAU);
      c.fill();
    };
    if (o.rim) { c.save(); c.translate(s * 0.04, -s * 0.03); draw(o.rim); c.restore(); }
    draw(INK);
    c.restore();
  }
  function label(c, text, x, y, px, col = INK, align = 'left', wt = 700) { c.font = font(px, wt); c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(text, x, y); }
  // a little particle layer for animated overlays
  function motes(c, w, h, t, n, seed, col, a, size, vy, vx = 0, wob = 0) {
    const rng = mulberry32(seed); c.save(); c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x0 = rng() * w, y0 = rng() * h, sp = 0.6 + rng() * 0.8, ph = rng() * TAU, r = size * (0.5 + rng());
      const x = ((x0 + vx * sp * t + Math.sin(t * 1.3 + ph) * wob) % w + w) % w, y = ((y0 + vy * sp * t) % h + h) % h;
      c.globalAlpha = a * (0.5 + 0.5 * Math.sin(t * 2 + ph)); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    c.restore();
  }
  const pulse = (t, sp = 2) => 0.5 + 0.5 * Math.sin(t * sp);

  // ============================================================ PROLOGUE
  function meteor(c, x, y, s, ang, k, seed) {
    const L = s * 95, dx = Math.cos(ang), dy = Math.sin(ang), px = -dy, py = dx;
    glow(c, x, y, s * 34, SPOT.green, 0.5);
    glow(c, x + dx * L * 0.25, y + dy * L * 0.25, s * 26, SPOT.green, 0.25);
    const g = c.createLinearGradient(x, y, x + dx * L, y + dy * L);
    g.addColorStop(0, 'rgba(242,238,228,1)'); g.addColorStop(0.35, 'rgba(242,238,228,0.55)'); g.addColorStop(1, 'rgba(242,238,228,0)');
    c.fillStyle = g;
    poly(c, [[x + px * s * 3, y + py * s * 3], [x + dx * L + px * s * 11, y + dy * L + py * s * 11], [x + dx * L - px * s * 11, y + dy * L - py * s * 11], [x - px * s * 3, y - py * s * 3]]); c.fill();
    const rng = mulberry32(seed); c.strokeStyle = PAPER; c.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const off = (rng() - 0.5) * s * 30, st = rng() * L * 0.3, ln = L * (0.2 + rng() * 0.6);
      c.globalAlpha = 0.25 + rng() * 0.5; c.lineWidth = s * (0.2 + rng() * 0.6);
      c.beginPath(); c.moveTo(x + dx * st + px * off, y + dy * st + py * off); c.lineTo(x + dx * (st + ln) + px * off * 1.4, y + dy * (st + ln) + py * off * 1.4); c.stroke();
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 7; i++) { const d = s * (8 + rng() * 40), o = (rng() - 0.5) * s * 14; c.fillStyle = PAPER; c.beginPath(); c.arc(x + dx * d + px * o, y + dy * d + py * o, s * (0.5 + rng()), 0, TAU); c.fill(); }
    c.fillStyle = '#eafff0'; c.beginPath(); c.arc(x, y, s * 4.2, 0, TAU); c.fill();
    glow(c, x, y, s * 9, '#ffffff', 0.9);
  }
  S.meteorSky = {
    base(c, w, h, o) {
      const k = cellOf(w, h), u = unit(w, h), hy = h * 0.8;
      nightSky(c, w, h, k, 0.85, 0.32, 110, 11);
      const list = o.many ? [[0.28, 0.3, 0.8, -0.62], [0.62, 0.18, 0.5, -0.5], [0.8, 0.42, 0.42, -0.7], [0.1, 0.12, 0.32, -0.55], [0.45, 0.5, 0.3, -0.6]] : [[0.36, 0.42, 1, -0.6]];
      list.forEach(([fx, fy, sz, a], i) => meteor(c, fx * w, fy * h, sz * u, a, k, 20 + i));
      // the land lit green from above
      const top = hillTop(w, hy, h * 0.025, 4);
      hills(c, w, h, hy, h * 0.025, 4);
      c.strokeStyle = SPOT.green; c.globalAlpha = 0.8; c.lineWidth = u * 0.5; c.beginPath(); for (let x = 0; x <= w; x += 8) (x ? c.lineTo(x, top(x)) : c.moveTo(x, top(x))); c.stroke(); c.globalAlpha = 1;
      M.cornRow(c, w * 0.45, hy + h * 0.02, h * 0.1, 7);
      M.farmhouse(c, w * 0.66, top(w * 0.7) + 2, h * 0.14);
      if (o.many) figure(c, w * 0.2, h * 0.99, h * 0.5, 'okafor', { pose: 'lookUp', face: -1, rim: SPOT.green });
      else figure(c, w * 0.17, top(w * 0.17) + h * 0.03, h * 0.3, 'farmer', { pose: 'lookUp', rim: SPOT.green });
      vignette(c, w, h, 0.6, k);
    },
    anim(c, w, h, t, o) {
      const u = unit(w, h), list = o.many ? [[0.28, 0.3, 0.8]] : [[0.36, 0.42, 1]];
      for (const [fx, fy, sz] of list) glow(c, fx * w, fy * h, sz * u * (14 + 6 * pulse(t, 9)), SPOT.green, 0.35);
    },
  };

  S.impact = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), cx = w * 0.52, cy = h * 0.66;
      paper(c, w, h);
      radialTone(c, cx, cy, u * 30, Math.hypot(w, h) * 0.6, 0, 0.9, k, [0, 0, w, h]);
      M.focusLines(c, cx, cy, w, h, 170, u * 34, INK, 3);
      glow(c, cx, cy, u * 60, SPOT.green, 0.65); glow(c, cx, cy, u * 30, '#ffffff', 1);
      // shockwave rings
      c.strokeStyle = INK; for (const [r, lw] of [[44, 1.2], [58, 0.8], [70, 0.5]]) { c.lineWidth = u * lw; c.beginPath(); c.ellipse(cx, cy, u * r * 1.6, u * r * 0.32, 0, Math.PI, TAU); c.stroke(); }
      // the ground and corn blown flat away from the blast
      c.fillStyle = INK; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * 0.74); c.quadraticCurveTo(cx, h * 0.62, w, h * 0.74); c.lineTo(w, h); c.fill();
      const rng = mulberry32(8); c.strokeStyle = INK; c.lineCap = 'round';
      for (let x = 0; x < w; x += u * 1.6) {
        const side = Math.sign(x - cx) || 1, near = 1 - Math.min(1, Math.abs(x - cx) / (w * 0.5)), gy = h * 0.74 - (1 - Math.abs(x - cx) / (w * 0.55)) * h * 0.08;
        const len = u * (6 + rng() * 6) * (0.6 + near), lean = side * (0.5 + near * 1.0);
        c.lineWidth = u * 0.45; c.beginPath(); c.moveTo(x, gy + 2); c.quadraticCurveTo(x + Math.sin(lean) * len * 0.3, gy - len * 0.6, x + Math.sin(lean) * len, gy - Math.cos(lean) * len); c.stroke();
      }
      // flying debris
      for (let i = 0; i < 26; i++) { const a = -Math.PI * (0.08 + rng() * 0.84), d = u * (24 + rng() * 50); shard(c, cx + Math.cos(a) * d * 1.6, cy + Math.sin(a) * d, u * (1 + rng() * 2.6), rng() * 6, 30 + i, 1, k, u * 0.3); }
    },
    anim(c, w, h, t) { glow(c, w * 0.52, h * 0.66, unit(w, h) * (40 + 12 * pulse(t, 14)), '#ffffff', 0.35 * Math.max(0, 1 - t * 0.6)); },
  };

  S.crystalCrater = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), cx = w * 0.5, cy = h * 0.72;
      nightSky(c, w, h, k, 0.5, 0.75, 30, 9);
      // smoke behind the crater
      for (let i = 0; i < 7; i++) cloud(c, cx + (i - 3) * u * 18, h * 0.42 - (i % 2) * u * 8 - Math.abs(i - 3) * u * -2, u * 14, 50 + i, 0.7, k, 9, 0, 0.3);
      gradTone(c, 0, h * 0.2, 0, h * 0.5, 0.9, 0, k, INK, [0, h * 0.15, w, h * 0.36]);
      // ground and rim
      c.beginPath(); c.rect(0, h * 0.55, w, h * 0.45); fillT(c, 0.82, k);
      c.beginPath(); c.ellipse(cx, cy, w * 0.46, h * 0.2, 0, 0, TAU); fillT(c, 1, k);
      c.beginPath(); c.ellipse(cx, cy - h * 0.03, w * 0.43, h * 0.15, 0, Math.PI, TAU); c.strokeStyle = PAPER; c.lineWidth = u * 0.6; c.stroke();
      glow(c, cx, cy - h * 0.12, u * 58, SPOT.green, 0.55);
      // veins of light creeping out over the ground
      const rng = mulberry32(14); c.strokeStyle = SPOT.green; c.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        let x = cx + (rng() - 0.5) * w * 0.3, y = cy + (rng() - 0.3) * h * 0.08, a = rng() < 0.5 ? Math.PI + (rng() - 0.5) * 0.6 : (rng() - 0.5) * 0.6;
        c.lineWidth = u * (0.4 + rng() * 0.5); c.beginPath(); c.moveTo(x, y);
        for (let j = 0; j < 8; j++) { a += (rng() - 0.5) * 0.8; x += Math.cos(a) * u * 6; y += Math.sin(a) * u * 2 + u * 0.6; c.lineTo(x, y); }
        c.stroke();
      }
      // the crystal cluster
      const cl = [[-0.05, 50, 5.5, -0.12], [0.06, 40, 4.5, 0.25], [-0.15, 30, 4, -0.5], [0.14, 26, 3.6, 0.6], [0.0, 22, 3.2, 0.05], [-0.24, 16, 2.6, -0.8], [0.24, 15, 2.6, 0.9]];
      for (const [dx, len, wd, a] of cl) crystal(c, cx + dx * w * 0.8, cy - h * 0.06, u * len, u * wd, a, k, u * 0.45, 0.45);
      spot(c, SPOT.green, () => c.fillRect(0, 0, w, h), 0.4);
      vignette(c, w, h, 0.7, k);
    },
    anim(c, w, h, t) {
      const u = unit(w, h);
      glow(c, w * 0.5, h * 0.55, u * (26 + 8 * pulse(t, 3)), SPOT.green, 0.35);
      motes(c, w, h * 0.7, t, 26, 3, '#c8ffd8', 0.8, u * 0.45, -u * 3, 0, u * 2);
    },
  };

  S.labTank = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), cx = w * 0.5, tw = Math.min(w * 0.3, h * 0.46), top = h * 0.12, bot = h * 0.82;
      paper(c, w, h); c.beginPath(); c.rect(0, 0, w, h); fillT(c, 0.8, k);
      // wall panels and pipes
      c.strokeStyle = INK; c.lineWidth = u * 0.4;
      for (let x = w * 0.04; x < w; x += w * 0.12) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h * 0.86); c.stroke(); }
      for (const [y, r] of [[0.05, 1.6], [0.09, 1.0]]) { c.beginPath(); c.rect(0, h * y - u * r, w, u * r * 2); fillT(c, 0.35, k); c.stroke(); }
      // floor
      c.beginPath(); c.rect(0, h * 0.84, w, h * 0.16); fillT(c, 0.55, k);
      for (let i = -8; i <= 8; i++) { c.beginPath(); c.moveTo(cx + i * w * 0.02, h * 0.84); c.lineTo(cx + i * w * 0.14, h); c.stroke(); }
      glow(c, cx, h * 0.48, tw * 1.6, SPOT.green, 0.5);
      // tank glass with the figure suspended inside
      c.save(); c.beginPath(); c.rect(cx - tw / 2, top, tw, bot - top); c.clip();
      c.fillStyle = PAPER; c.fillRect(cx - tw / 2, top, tw, bot - top);
      gradTone(c, cx - tw / 2, 0, cx + tw / 2, 0, 0.15, 0.55, k, INK, [cx - tw / 2, top, tw, bot - top]);
      c.strokeStyle = INK; c.lineWidth = u * 0.5;
      for (const dx of [-0.2, 0.05, 0.25]) { c.beginPath(); c.moveTo(cx + dx * tw, top); c.bezierCurveTo(cx + dx * tw, top + h * 0.12, cx, top + h * 0.08, cx, h * 0.3); c.stroke(); }
      const fh = (bot - top) * 0.62, fy = h * 0.3;
      c.fillStyle = INK;
      c.beginPath(); c.ellipse(cx, fy + fh * 0.07, fh * 0.07, fh * 0.085, 0.15, 0, TAU); c.fill();
      poly(c, [[cx - fh * 0.12, fy + fh * 0.17], [cx + fh * 0.12, fy + fh * 0.17], [cx + fh * 0.1, fy + fh * 0.55], [cx + fh * 0.07, fy + fh * 0.98], [cx + fh * 0.01, fy + fh * 0.98], [cx, fy + fh * 0.6], [cx - fh * 0.02, fy + fh], [cx - fh * 0.08, fy + fh], [cx - fh * 0.1, fy + fh * 0.55]]); c.fill();
      poly(c, [[cx - fh * 0.12, fy + fh * 0.18], [cx - fh * 0.2, fy + fh * 0.5], [cx - fh * 0.16, fy + fh * 0.52], [cx - fh * 0.08, fy + fh * 0.26]]); c.fill();
      poly(c, [[cx + fh * 0.12, fy + fh * 0.18], [cx + fh * 0.21, fy + fh * 0.48], [cx + fh * 0.17, fy + fh * 0.5], [cx + fh * 0.08, fy + fh * 0.26]]); c.fill();
      spot(c, SPOT.green, () => c.fillRect(cx - tw / 2, top, tw, bot - top), 0.75);
      c.fillStyle = PAPER; c.globalAlpha = 0.85; c.fillRect(cx - tw * 0.38, top, tw * 0.05, bot - top); c.globalAlpha = 0.5; c.fillRect(cx - tw * 0.28, top, tw * 0.02, bot - top); c.globalAlpha = 1;
      c.restore();
      c.strokeStyle = INK; c.lineWidth = u * 0.8; c.strokeRect(cx - tw / 2, top, tw, bot - top);
      // steel caps
      for (const [y0, y1] of [[top - h * 0.08, top], [bot, bot + h * 0.08]]) {
        c.beginPath(); c.rect(cx - tw * 0.58, y0, tw * 1.16, y1 - y0); fillT(c, 0.9, k); c.lineWidth = u * 0.6; c.stroke();
        c.strokeStyle = PAPER; c.lineWidth = u * 0.4; c.beginPath(); c.moveTo(cx - tw * 0.55, y0 + (y1 - y0) * 0.25); c.lineTo(cx + tw * 0.55, y0 + (y1 - y0) * 0.25); c.stroke(); c.strokeStyle = INK;
      }
      label(c, 'KESSLER-VANE  //  LAZARUS-04', cx, bot + h * 0.04, u * 2.6, PAPER, 'center');
      // two scientists in the foreground, rim-lit by the tank
      backBust(c, w * 0.12, h * 0.9, h * 0.22, 'okafor', { rim: SPOT.green });
      backBust(c, w * 0.9, h * 0.93, h * 0.2, 'coat', { rim: SPOT.green, face: -1 });
      vignette(c, w, h, 0.7, k);
    },
    anim(c, w, h, t) {
      const u = unit(w, h), tw = Math.min(w * 0.3, h * 0.46), top = h * 0.12, bot = h * 0.82;
      c.save(); c.beginPath(); c.rect(w * 0.5 - tw / 2, top, tw, bot - top); c.clip();
      c.strokeStyle = PAPER; c.lineWidth = Math.max(1, u * 0.25);
      const rng = mulberry32(4);
      for (let i = 0; i < 18; i++) { const x = w * 0.5 + (rng() - 0.5) * tw * 0.9, sp = h * (0.08 + rng() * 0.1), y = bot - ((rng() * (bot - top) + t * sp) % (bot - top)), r = u * (0.4 + rng() * 0.9); c.beginPath(); c.arc(x + Math.sin(t * 2 + i) * u, y, r, 0, TAU); c.stroke(); }
      c.restore();
    },
  };

  // a character close-up with a backdrop that matches the moment
  S.portrait = {
    base(c, w, h, o) {
      const k = cellOf(w, h), u = unit(w, h), cx = w * (o.x ?? 0.5);
      paper(c, w, h);
      const bg = o.bg || 'tone';
      if (bg === 'lines') { M.focusLines(c, cx, h * 0.4, w, h, 120, Math.min(w, h) * 0.45, INK, 7); }
      else if (bg === 'speed') { c.beginPath(); c.rect(0, 0, w, h); fillT(c, 0.15, k); M.motionLines(c, -w * 0.2, 0, w * 1.2, h, 0, 90, INK, 5); }
      else if (bg === 'night') { nightSky(c, w, h, k, 1, 0.55, 40, 3); }
      else if (bg === 'storm') { c.beginPath(); c.rect(0, 0, w, h); fillT(c, 0.3, k); M.motionLines(c, -w * 0.1, -h * 0.1, w * 1.2, h * 1.2, 0.45, 80, PAPER, 12); }
      else if (bg === 'fire') { nightSky(c, w, h, k, 1, 0.4, 0, 3); skyline(c, w, h * 0.95, h * 0.35, 9, INK); glow(c, w * 0.7, h * 0.9, u * 60, SPOT.orange, 0.6); spot(c, SPOT.orange, () => c.fillRect(0, 0, w, h), 0.5); }
      else if (bg === 'lab') { c.beginPath(); c.rect(0, 0, w, h); fillT(c, 0.55, k); c.strokeStyle = INK; c.lineWidth = u * 0.3; for (let x = 0; x < w; x += w / 9) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } glow(c, w * (o.x > 0.5 ? 0.2 : 0.8), h * 0.3, u * 50, SPOT.green, 0.5); }
      else if (bg === 'ink') { c.fillStyle = INK; c.fillRect(0, 0, w, h); radialTone(c, cx, h * 0.4, u * 20, u * 80, 0.4, 1, k, [0, 0, w, h]); }
      else { gradTone(c, 0, 0, w, h, 0.2, 0.6, k, INK, [0, 0, w, h]); }
      if (o.glow) glow(c, cx + u * 22, h * 0.35, u * 55, SPOT[o.glow], 0.55);
      const s = Math.min(h * 0.44, w * 0.5) * (o.zoom || 1);
      M.bust(c, o.who, cx, h * (o.y ?? 0.42) + (o.zoom > 1 ? s * 0.1 : 0), s, o);
      if (o.sandbags) sandbags(c, w, h, k, u);
      if (o.tint) spot(c, SPOT[o.tint], () => c.fillRect(0, 0, w, h), 0.35);
    },
  };
  function sandbags(c, w, h, k, u) {
    const bh = h * 0.11, bw = bh * 2.4;
    const bag = (x, y) => { c.beginPath(); c.moveTo(x, y + bh * 0.18); c.quadraticCurveTo(x + bw * 0.5, y - bh * 0.12, x + bw, y + bh * 0.18); c.quadraticCurveTo(x + bw * 1.07, y + bh * 0.5, x + bw, y + bh * 0.88); c.quadraticCurveTo(x + bw * 0.5, y + bh * 1.1, x, y + bh * 0.88); c.quadraticCurveTo(x - bw * 0.07, y + bh * 0.5, x, y + bh * 0.18); c.closePath(); };
    for (let row = 0; row < 3; row++) {
      const y = h - bh * (row + 1) * 0.86;
      for (let x = -bw * (row % 2 ? 0.5 : 0.1); x < w + bw; x += bw * 0.98) {
        bag(x, y); fillT(c, 0.3 + row * 0.08, k);
        c.save(); bag(x, y); c.clip(); gradTone(c, x, y, x + bw * 0.2, y + bh, 0, 0.85, k, INK, [x - 4, y - 4, bw + 8, bh + 8]); c.restore();
        bag(x, y); c.strokeStyle = INK; c.lineWidth = u * 0.6; c.stroke();
        c.lineWidth = u * 0.35; for (const sd of [0.12, 0.88]) { c.beginPath(); c.moveTo(x + bw * sd, y + bh * 0.25); c.lineTo(x + bw * sd + (sd < 0.5 ? -1 : 1) * u * 0.6, y + bh * 0.8); c.stroke(); }
        c.strokeStyle = PAPER; c.lineWidth = u * 0.35; c.beginPath(); c.moveTo(x + bw * 0.2, y + bh * 0.22); c.quadraticCurveTo(x + bw * 0.5, y + bh * 0.04, x + bw * 0.78, y + bh * 0.22); c.stroke();
      }
    }
  }


  S.monitor = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), m = u * 5;
      c.fillStyle = INK; c.fillRect(0, 0, w, h);
      c.beginPath(); c.rect(m * 0.5, m * 0.5, w - m, h - m); fillT(c, 0.6, k);
      const sx = m * 1.3, sy = m * 1.3, sw = w - sx * 2, sh = h - sy * 2;
      c.fillStyle = '#0c1a10'; c.fillRect(sx, sy, sw, sh);
      c.save(); c.beginPath(); c.rect(sx, sy, sw, sh); c.clip();
      c.strokeStyle = 'rgba(82,224,124,0.18)'; c.lineWidth = 1;
      for (let x = sx; x < sx + sw; x += u * 4) { c.beginPath(); c.moveTo(x, sy); c.lineTo(x, sy + sh); c.stroke(); }
      for (let y = sy; y < sy + sh; y += u * 4) { c.beginPath(); c.moveTo(sx, y); c.lineTo(sx + sw, y); c.stroke(); }
      // the double helix, one strand healthy and one rewriting
      const hx = sx + sw * 0.06, hw = sw * 0.55, hcy = sy + sh * 0.5, amp = sh * 0.26;
      for (let i = 0; i <= 40; i++) {
        const x = hx + (i / 40) * hw, a = i / 40 * TAU * 2.2, y1 = hcy + Math.sin(a) * amp, y2 = hcy - Math.sin(a) * amp;
        c.strokeStyle = i > 24 ? 'rgba(224,69,58,0.8)' : 'rgba(82,224,124,0.7)'; c.lineWidth = u * 0.35; c.beginPath(); c.moveTo(x, y1); c.lineTo(x, y2); c.stroke();
      }
      for (const sg of [1, -1]) { c.strokeStyle = SPOT.green; c.lineWidth = u * 0.8; c.beginPath(); for (let i = 0; i <= 80; i++) { const x = hx + (i / 80) * hw, y = hcy + sg * Math.sin(i / 80 * TAU * 2.2) * amp; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
      const tx = sx + sw * 0.64;
      label(c, 'PROJECT LAZARUS', tx, sy + sh * 0.12, Math.min(sh * 0.09, sw * 0.045), SPOT.green);
      label(c, 'SUBJECT 04  //  BAY FOUR', tx, sy + sh * 0.23, sh * 0.055, 'rgba(82,224,124,0.7)', 'left', 600);
      label(c, 'CELL REWRITE', tx, sy + sh * 0.4, sh * 0.055, 'rgba(82,224,124,0.8)', 'left', 600);
      c.strokeStyle = SPOT.green; c.lineWidth = u * 0.4; c.strokeRect(tx, sy + sh * 0.47, sw * 0.28, sh * 0.07); c.fillStyle = SPOT.red; c.fillRect(tx + 2, sy + sh * 0.47 + 2, sw * 0.28 * 0.97 - 4, sh * 0.07 - 4);
      label(c, '97.4%', tx, sy + sh * 0.63, sh * 0.13, SPOT.red);
      label(c, 'NECROSIS: REVERSED', tx, sy + sh * 0.78, sh * 0.055, 'rgba(82,224,124,0.8)', 'left', 600);
      label(c, 'CORTEX: UNRESPONSIVE', tx, sy + sh * 0.87, sh * 0.055, SPOT.red, 'left', 600);
      c.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = sy; y < sy + sh; y += 3) c.fillRect(sx, y, sw, 1);
      c.restore();
      // glass glare
      c.save(); c.globalAlpha = 0.12; c.fillStyle = PAPER; poly(c, [[sx + sw * 0.55, sy], [sx + sw * 0.75, sy], [sx + sw * 0.35, sy + sh], [sx + sw * 0.15, sy + sh]]); c.fill(); c.restore();
      glow(c, w * 0.4, h * 0.5, u * 60, SPOT.green, 0.15);
    },
    anim(c, w, h, t) {
      const u = unit(w, h), m = u * 6.5, sh = h - m * 2, y = m + ((t * 0.35) % 1) * sh;
      c.fillStyle = 'rgba(160,255,190,0.08)'; c.fillRect(m, y, w - m * 2, sh * 0.06);
      if (Math.floor(t * 2) % 2) { c.fillStyle = SPOT.red; c.fillRect(m + (w - m * 2) * 0.66 + sh * 0.36, m + sh * 0.6, sh * 0.06, sh * 0.08); }
    },
  };

  function corridor(c, w, h, k, u, vx, vy, red) {
    paper(c, w, h);
    const side = (pts, d) => { poly(c, pts); fillT(c, d, k); c.strokeStyle = INK; c.lineWidth = u * 0.4; c.stroke(); };
    const fw = w * 0.12, fh = h * 0.16;
    side([[0, 0], [vx - fw, vy - fh], [vx - fw, vy + fh], [0, h]], 0.7);
    side([[w, 0], [vx + fw, vy - fh], [vx + fw, vy + fh], [w, h]], 0.85);
    side([[0, 0], [w, 0], [vx + fw, vy - fh], [vx - fw, vy - fh]], 0.95);
    side([[0, h], [w, h], [vx + fw, vy + fh], [vx - fw, vy + fh]], 0.5);
    gradTone(c, 0, 0, 0, h, 0, 0.5, k, INK, [0, vy + fh, w, h - vy - fh]);
    c.beginPath(); c.rect(vx - fw, vy - fh, fw * 2, fh * 2); fillT(c, 1, k);
    // ribs along the corridor
    c.strokeStyle = INK; c.lineWidth = u * 0.6;
    for (const f of [0.25, 0.45, 0.62, 0.76, 0.86]) {
      const l = lerp(0, vx - fw, f), r = lerp(w, vx + fw, f), t = lerp(0, vy - fh, f), b = lerp(h, vy + fh, f);
      c.beginPath(); c.moveTo(l, b); c.lineTo(l, t); c.lineTo(r, t); c.lineTo(r, b); c.stroke();
      c.fillStyle = PAPER; c.fillRect(lerp(l, r, 0.4), t + 1, (r - l) * 0.2, u * 0.8 * (1 - f));
    }
    // hazard stripes on the left wall
    c.save(); poly(c, [[0, h * 0.62], [vx - fw, vy + fh * 0.3], [vx - fw, vy + fh * 0.6], [0, h * 0.78]]); c.clip();
    c.fillStyle = INK; for (let x = -h; x < w; x += u * 4) { poly(c, [[x, h], [x + u * 2, h], [x + u * 2 + h, 0], [x + h, 0]]); c.fill(); }
    c.restore();
    if (red) { glow(c, vx, vy - fh * 1.6, w * 0.4, SPOT.red, 0.55); for (const f of [0.25, 0.45, 0.62]) glow(c, lerp(w * 0.5, vx, f), lerp(0, vy - fh, f) + 4, w * 0.12 * (1 - f * 0.7), SPOT.red, 0.8); spot(c, SPOT.red, () => c.fillRect(0, 0, w, h), 0.4); }
  }
  S.alarm = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), vx = w * 0.56, vy = h * 0.5;
      corridor(c, w, h, k, u, vx, vy, true);
      // a guard running into the dark, and a door blown open
      figure(c, vx + w * 0.03, vy + h * 0.13, h * 0.2, 'coat', { face: -1, pose: 'run' });
      figure(c, w * 0.26, h * 0.97, h * 0.62, 'soldier', { rim: SPOT.red, pose: 'run' });
      vignette(c, w, h, 0.8, k);
    },
    anim(c, w, h, t) {
      const u = unit(w, h), a = t * 4;
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.18 + 0.15 * Math.max(0, Math.sin(a));
      c.fillStyle = SPOT.red; c.beginPath(); c.moveTo(w * 0.5, 0); c.lineTo(w * 0.5 + Math.cos(a) * w * 0.8 - w * 0.1, h); c.lineTo(w * 0.5 + Math.cos(a) * w * 0.8 + w * 0.1, h); c.fill();
      c.restore();
      glow(c, w * 0.5, u * 2, u * (14 + 6 * Math.max(0, Math.sin(a))), SPOT.red, 0.9);
    },
  };

  S.eyeExtreme = {
    base(c, w, h) {
      const k = cellOf(w, h, 0.8), u = unit(w, h), cx = w * 0.5, cy = h * 0.52, ew = Math.min(w * 0.34, h * 1.3), eh = ew * 0.36;
      paper(c, w, h); c.beginPath(); c.rect(0, 0, w, h); fillT(c, 0.5, k);
      gradTone(c, 0, 0, 0, h, 0.9, 0.3, k, INK, [0, 0, w, h * 0.5]);
      // rotting skin: cracks and blotches
      const rng = mulberry32(31);
      for (let i = 0; i < 14; i++) { const x = rng() * w, y = rng() * h; c.beginPath(); c.ellipse(x, y, u * (3 + rng() * 8), u * (1.5 + rng() * 3), rng(), 0, TAU); c.fillStyle = tone(c, 0.85, k); c.fill(); }
      for (let i = 0; i < 9; i++) crack(c, rng() * w, rng() * h, u * (10 + rng() * 14), rng() * TAU, 40 + i, u * 0.35, 1);
      // brow and lid folds
      c.strokeStyle = INK; c.lineCap = 'round';
      for (let i = 0; i < 4; i++) { c.lineWidth = u * (1.4 - i * 0.25); c.beginPath(); c.moveTo(cx - ew * (1.4 - i * 0.1), cy - eh * (1.2 + i * 0.5)); c.quadraticCurveTo(cx, cy - eh * (2.6 + i * 0.6), cx + ew * (1.4 - i * 0.1), cy - eh * (1.1 + i * 0.5)); c.stroke(); }
      const lid = () => { c.beginPath(); c.moveTo(cx - ew, cy); c.quadraticCurveTo(cx - ew * 0.1, cy - eh * 1.6, cx + ew, cy - eh * 0.1); c.quadraticCurveTo(cx + ew * 0.1, cy + eh * 1.3, cx - ew, cy); c.closePath(); };
      lid(); c.fillStyle = '#efe6d4'; c.fill();
      c.save(); lid(); c.clip();
      c.strokeStyle = SPOT.red; c.lineWidth = u * 0.3;
      for (let i = 0; i < 16; i++) { const sd = i % 2 ? 1 : -1; crack(c, cx + sd * ew, cy + (rng() - 0.5) * eh, ew * 0.6, sd > 0 ? Math.PI : 0, 60 + i, u * 0.35, 1); }
      spot(c, SPOT.red, () => { lid(); c.fill(); }, 0.25);
      const ir = eh * 0.95, ix = cx + ew * 0.05;
      glow(c, ix, cy, ir * 2.2, SPOT.green, 0.8);
      c.beginPath(); c.arc(ix, cy, ir, 0, TAU); c.fillStyle = '#1d3a24'; c.fill();
      c.strokeStyle = SPOT.green; c.lineWidth = u * 0.3;
      for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, r0 = ir * 0.3, r1 = ir * (0.8 + rng() * 0.2); c.beginPath(); c.moveTo(ix + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(ix + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.stroke(); }
      c.fillStyle = INK; c.beginPath(); c.ellipse(ix, cy, ir * 0.12, ir * 0.42, 0, 0, TAU); c.fill();
      c.fillStyle = PAPER; c.beginPath(); c.arc(ix - ir * 0.35, cy - ir * 0.35, ir * 0.14, 0, TAU); c.fill();
      c.fillStyle = tone(c, 0.7, k); c.beginPath(); c.ellipse(cx, cy - eh * 1.15, ew * 1.1, eh * 0.7, 0, 0, TAU); c.fill();
      c.restore();
      lid(); c.strokeStyle = INK; c.lineWidth = u * 1.4; c.stroke();
      c.lineWidth = u * 2.2; c.beginPath(); c.moveTo(cx - ew * 1.05, cy + eh * 0.05); c.quadraticCurveTo(cx - ew * 0.1, cy - eh * 1.65, cx + ew * 1.05, cy - eh * 0.15); c.stroke();
      vignette(c, w, h, 0.9, k);
    },
    anim(c, w, h, t) { const ew = Math.min(w * 0.34, h * 1.3); glow(c, w * 0.5 + ew * 0.05, h * 0.52, ew * 0.36 * (1.1 + 0.4 * pulse(t, 5)), SPOT.green, 0.4); },
  };

  S.handGlass = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), cx = w * 0.55, cy = h * 0.48;
      c.fillStyle = INK; c.fillRect(0, 0, w, h);
      // the pane, lit from the corridor
      c.beginPath(); c.rect(w * 0.05, h * 0.05, w * 0.9, h * 0.9); fillT(c, 0.35, k);
      spot(c, SPOT.green, () => c.fillRect(0, 0, w, h), 0.45);
      c.strokeStyle = INK; c.lineWidth = u * 2; c.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9);
      // star crack
      const rng = mulberry32(17); c.strokeStyle = INK;
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + rng() * 0.3; crack(c, cx, cy, u * (35 + rng() * 40), a, 90 + i, u * 0.45, 1); }
      for (const r of [12, 22, 34]) { c.lineWidth = u * 0.35; c.beginPath(); for (let i = 0; i <= 16; i++) { const a = i / 16 * TAU, rr = u * r * (0.85 + rng() * 0.3); i ? c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : c.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } c.stroke(); }
      // the hole the fist went through
      c.beginPath(); for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU, rr = u * (10 + rng() * 6); i ? c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : c.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } c.fillStyle = INK; c.fill();
      // the hand: wasted fingers clawing toward the reader
      claw(c, cx + u * 34, cy + u * 60, u * 52, -Math.PI * 0.64, u * 14, 5, { rim: SPOT.green, bony: true, curl: 0.32 });
      // shards blowing out toward the camera
      for (let i = 0; i < 30; i++) { const a = rng() * TAU, d = u * (16 + rng() * 55); shard(c, cx + Math.cos(a) * d * 1.3, cy + Math.sin(a) * d, u * (1.2 + rng() * 4) * (d / (u * 40)), rng() * 6, 120 + i, 0.08, k, u * 0.35); }
      M.motionLines(c, 0, 0, w, h, Math.PI * 0.1, 0, PAPER, 1);
    },
  };

  S.okaforRun = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h);
      corridor(c, w, h, k, u, w * 0.8, h * 0.45, true);
      // the infected spilling in behind her
      for (let i = 0; i < 6; i++) M.zombie(c, w * (0.68 + i * 0.05), h * (0.66 + (i % 2) * 0.04), h * (0.2 + i * 0.02), { face: -1, eyes: SPOT.green, lean: 0.4 });
      M.motionLines(c, 0, h * 0.05, w, h * 0.9, 0, 60, PAPER, 23);
      // Okafor mid-stride, coat flaring, the core case glowing in her hand
      const { hand } = figure(c, w * 0.34, h * 0.97, h * 0.74, 'okafor', { pose: 'run', prop: 'case', rim: SPOT.red, face: -1 });
      glow(c, hand[0], hand[1], u * 9, SPOT.green, 0.9);
      c.fillStyle = SPOT.green; c.fillRect(hand[0] - u * 2, hand[1] + u * 0.3, u * 4, u * 2.2);
      vignette(c, w, h, 0.7, k);
    },
    anim(c, w, h, t) { glow(c, w * 0.36 + h * 0.2, h * 0.55, unit(w, h) * (8 + 5 * pulse(t, 6)), SPOT.green, 0.4); },
  };

  // a dated situation map with the infection spreading out of Hollow Creek
  const MAP_CITIES = [[0.42, 0.52, 'HOLLOW CREEK'], [0.58, 0.44, 'KANSAS CITY'], [0.3, 0.36, 'DENVER'], [0.72, 0.3, 'CHICAGO'], [0.5, 0.72, 'TULSA'], [0.62, 0.82, 'DALLAS'], [0.86, 0.5, 'ATLANTA'], [0.78, 0.18, 'DETROIT'], [0.82, 0.88, 'BLACK BAYOU']];
  S.infectionMap = {
    base(c, w, h, o) {
      const k = cellOf(w, h), u = unit(w, h);
      paper(c, w, h); c.beginPath(); c.rect(0, 0, w, h); fillT(c, 0.12, k);
      // grid
      c.strokeStyle = 'rgba(16,16,16,0.35)'; c.lineWidth = 1;
      for (let x = 0; x < w; x += w / 12) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (let y = 0; y < h; y += h / 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      // the land mass, inked with a coastline
      c.beginPath(); c.moveTo(w * 0.05, h * 0.12);
      const coast = [[0.3, 0.06], [0.55, 0.1], [0.8, 0.05], [0.96, 0.2], [0.93, 0.5], [0.97, 0.7], [0.88, 0.95], [0.7, 0.9], [0.55, 0.98], [0.4, 0.86], [0.2, 0.9], [0.06, 0.7], [0.03, 0.4]];
      for (const [x, y] of coast) c.lineTo(x * w, y * h);
      c.closePath(); c.fillStyle = PAPER; c.fill(); c.strokeStyle = INK; c.lineWidth = u * 0.8; c.stroke();
      // roads between cities
      c.lineWidth = u * 0.35; c.setLineDash([u * 1.2, u * 0.8]);
      for (const [a, b] of [[0, 1], [0, 2], [1, 3], [0, 4], [4, 5], [1, 6], [3, 7], [5, 8], [6, 8], [2, 4]]) { const A = MAP_CITIES[a], B = MAP_CITIES[b]; c.beginPath(); c.moveTo(A[0] * w, A[1] * h); c.quadraticCurveTo((A[0] + B[0]) / 2 * w + u * 3, (A[1] + B[1]) / 2 * h - u * 2, B[0] * w, B[1] * h); c.stroke(); }
      c.setLineDash([]);
      // the spread in rings of tone
      const spread = o.route ? 0.9 : 1;
      for (const [x, y, r] of [[0.42, 0.52, 0.34], [0.58, 0.44, 0.2], [0.72, 0.3, 0.16], [0.3, 0.36, 0.14], [0.86, 0.5, 0.14], [0.82, 0.88, 0.22]]) {
        c.beginPath(); c.ellipse(x * w, y * h, r * w * spread * 0.8, r * h * spread, 0, 0, TAU);
        c.save(); c.clip(); radialTone(c, x * w, y * h, 0, r * Math.min(w, h) * 1.1, 0.75, 0.05, k, [x * w - r * w, y * h - r * h, r * w * 2, r * h * 2]); c.restore();
      }
      spot(c, SPOT.green, () => c.fillRect(0, 0, w, h), 0.45);
      for (const [x, y, n] of MAP_CITIES) { c.fillStyle = INK; c.beginPath(); c.arc(x * w, y * h, u * 1.1, 0, TAU); c.fill(); label(c, n, x * w + u * 2, y * h - u * 2.2, u * 3.2, INK, 'left', 700); }
      if (o.route) {
        c.strokeStyle = SPOT.red; c.lineWidth = u * 1.1; c.lineCap = 'round';
        const pts = [[0.42, 0.52], [0.52, 0.34], [0.48, 0.14], [0.6, 0.6], [0.82, 0.88]];
        c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x * w, y * h) : c.moveTo(x * w, y * h))); c.stroke();
        for (const [x, y, n] of [[0.52, 0.34, 'BLACKWOOD'], [0.48, 0.14, 'STATION 7']]) { c.fillStyle = SPOT.red; c.beginPath(); c.arc(x * w, y * h, u * 1.6, 0, TAU); c.fill(); label(c, n, x * w + u * 2.4, y * h + u * 2.4, u * 3.4, SPOT.red); }
        const [bx, by] = [0.82 * w, 0.88 * h]; c.lineWidth = u * 1.3; c.beginPath(); c.ellipse(bx, by, u * 9, u * 6, -0.2, 0, TAU * 0.92); c.stroke();
        label(c, 'THE HIVE', bx - u * 10, by - u * 9.5, u * 5, SPOT.red, 'right');
      } else {
        for (const [x, y, d] of [[0.42, 0.6, 'DAY 1'], [0.66, 0.38, 'DAY 3'], [0.86, 0.6, 'DAY 9'], [0.62, 0.92, 'DAY 14']]) { c.fillStyle = INK; c.fillRect(x * w - u * 0.5, y * h - u * 2.6, u * 9, u * 5); label(c, d, x * w + u * 4, y * h, u * 3.6, PAPER, 'center'); }
      }
      // fold creases and a pinned corner
      c.strokeStyle = 'rgba(16,16,16,0.25)'; c.lineWidth = u * 0.4; c.beginPath(); c.moveTo(w / 3, 0); c.lineTo(w / 3, h); c.moveTo(w * 2 / 3, 0); c.lineTo(w * 2 / 3, h); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
      c.fillStyle = SPOT.red; c.beginPath(); c.arc(u * 4, u * 4, u * 1.6, 0, TAU); c.fill();
      vignette(c, w, h, 0.4, k);
    },
    anim(c, w, h, t) {
      const u = unit(w, h), p = (t * 0.45) % 1;
      c.strokeStyle = SPOT.green; c.globalAlpha = 1 - p; c.lineWidth = u * 0.6; c.beginPath(); c.arc(0.42 * w, 0.52 * h, u * (2 + p * 22), 0, TAU); c.stroke(); c.globalAlpha = 1;
    },
  };

  // the campaign route across a world map, matching the globe's four warzones
  const CONTINENTS = [
    [[-168, 66], [-150, 71], [-120, 72], [-95, 72], [-80, 68], [-62, 58], [-55, 50], [-68, 44], [-76, 36], [-81, 31], [-80, 25], [-90, 29], [-97, 26], [-97, 20], [-88, 15], [-80, 8], [-92, 15], [-105, 20], [-112, 30], [-118, 34], [-124, 40], [-124, 48], [-135, 57], [-150, 60], [-165, 60]],
    [[-80, 8], [-60, 10], [-50, 0], [-35, -6], [-40, -22], [-55, -35], [-68, -55], [-74, -45], [-72, -20], [-81, -5]],
    [[-10, 36], [-9, 43], [-2, 48], [-5, 58], [10, 63], [20, 70], [40, 68], [60, 70], [80, 73], [110, 76], [140, 72], [170, 68], [180, 65], [160, 58], [140, 50], [130, 40], [122, 30], [110, 20], [105, 10], [100, 15], [90, 22], [80, 10], [72, 20], [60, 25], [50, 30], [45, 13], [35, 30], [30, 37], [25, 40], [15, 38], [10, 44], [3, 42]],
    [[-17, 15], [-10, 30], [0, 36], [10, 37], [32, 31], [35, 25], [43, 12], [51, 12], [40, -5], [40, -15], [33, -25], [20, -35], [12, -18], [10, -2], [5, 5], [-8, 5], [-17, 10]],
    [[114, -22], [122, -18], [132, -12], [142, -11], [146, -19], [153, -28], [148, -38], [138, -35], [130, -32], [115, -34]],
    [[-50, 60], [-42, 60], [-20, 70], [-25, 82], [-60, 82], [-70, 76], [-55, 68]],
  ];
  const WARZONES = [[-95, 38, 'HOLLOW CREEK'], [10, 52, 'BLACKWOOD'], [100, 68, 'STATION 7'], [-62, 4, 'THE HIVE']];
  S.worldMap = {
    base(c, w, h, o) {
      const k = cellOf(w, h), u = unit(w, h), upto = o.upto ?? 3;
      const P = ([lon, lat]) => [(lon + 180) / 360 * w, (80 - lat) / 140 * h];
      paper(c, w, h); c.beginPath(); c.rect(0, 0, w, h); fillT(c, 0.3, k);
      c.strokeStyle = 'rgba(16,16,16,0.3)'; c.lineWidth = 1;
      for (let lon = -180; lon <= 180; lon += 30) { const [x] = P([lon, 0]); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (let lat = -60; lat <= 80; lat += 20) { const [, y] = P([0, lat]); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      for (const poly0 of CONTINENTS) { c.beginPath(); poly0.forEach((pt, i) => (i ? c.lineTo(...P(pt)) : c.moveTo(...P(pt)))); c.closePath(); c.fillStyle = PAPER; c.fill(); c.strokeStyle = INK; c.lineWidth = u * 0.5; c.stroke(); }
      // infection rings round each warzone
      for (const [lon, lat] of WARZONES) { const [x, y] = P([lon, lat]); c.save(); c.beginPath(); c.arc(x, y, u * 16, 0, TAU); c.clip(); radialTone(c, x, y, 0, u * 16, 0.7, 0, k, [x - u * 16, y - u * 16, u * 32, u * 32]); c.restore(); }
      spot(c, SPOT.green, () => c.fillRect(0, 0, w, h), 0.4);
      // the route so far, then the leg still to fly as a dashed line
      c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = P(WARZONES[i]), b = P(WARZONES[i + 1]), mx = (a[0] + b[0]) / 2, my = Math.min(a[1], b[1]) - u * 14;
        c.strokeStyle = SPOT.red; c.lineWidth = u * (i < upto ? 1 : 0.6); c.setLineDash(i < upto ? [] : [u * 2, u * 1.6]);
        c.beginPath(); c.moveTo(...a); c.quadraticCurveTo(mx, my, ...b); c.stroke();
      }
      c.setLineDash([]);
      WARZONES.forEach(([lon, lat, n], i) => {
        const [x, y] = P([lon, lat]), done = i < upto, here = i === upto;
        c.fillStyle = here ? SPOT.red : done ? INK : PAPER; c.strokeStyle = INK; c.lineWidth = u * 0.5;
        c.beginPath(); c.arc(x, y, u * (here ? 2.2 : 1.6), 0, TAU); c.fill(); c.stroke();
        if (done) { c.strokeStyle = PAPER; c.lineWidth = u * 0.5; c.beginPath(); c.moveTo(x - u, y - u); c.lineTo(x + u, y + u); c.moveTo(x + u, y - u); c.lineTo(x - u, y + u); c.stroke(); }
        c.fillStyle = INK; const tw = n.length * u * 2 + u * 2; c.fillRect(x + u * 2.6, y - u * 2.4, tw, u * 4.8);
        label(c, n, x + u * 3.6, y, u * 3.4, here ? SPOT.red : PAPER);
      });
      if (o.upto === 3) { const [x, y] = P(WARZONES[3]); c.strokeStyle = SPOT.red; c.lineWidth = u * 1.2; c.beginPath(); c.ellipse(x, y, u * 9, u * 6, -0.2, 0, TAU * 0.92); c.stroke(); }
      c.strokeStyle = 'rgba(16,16,16,0.25)'; c.lineWidth = u * 0.4; c.beginPath(); c.moveTo(w / 3, 0); c.lineTo(w / 3, h); c.moveTo(w * 2 / 3, 0); c.lineTo(w * 2 / 3, h); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
      vignette(c, w, h, 0.45, k);
    },
    anim(c, w, h, t, o) {
      const u = unit(w, h), z = WARZONES[Math.min(3, o.upto ?? 3)], p = (t * 0.5) % 1;
      const x = (z[0] + 180) / 360 * w, y = (80 - z[1]) / 140 * h;
      c.strokeStyle = SPOT.red; c.globalAlpha = 1 - p; c.lineWidth = u * 0.6; c.beginPath(); c.arc(x, y, u * (2 + p * 10), 0, TAU); c.stroke(); c.globalAlpha = 1;
    },
  };

  S.burningCity = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h);
      nightSky(c, w, h, k, 0.75, 0.35, 0, 1);
      // smoke columns
      for (let i = 0; i < 5; i++) for (let j = 0; j < 6; j++) cloud(c, w * (0.08 + i * 0.21) + j * u * 5 + Math.sin(j) * u * 3, h * (0.52 - j * 0.1), u * (7 + j * 3.2), i * 9 + j, 0.82 - j * 0.07, k, 8, 0, 0.35);
      glow(c, w * 0.5, h * 0.62, w * 0.55, SPOT.orange, 0.55);
      const wins = skyline(c, w, h * 0.66, h * 0.38, 33, INK, 0.12);
      c.fillStyle = SPOT.amber; for (const [x, y, ww, hh] of wins) c.fillRect(x, y, ww, hh);
      for (let i = 0; i < 9; i++) { const x = w * (0.05 + i * 0.11), y = h * (0.42 + ((i * 37) % 17) / 100); flame(c, x, y, u * (2 + (i % 3)), u * (8 + (i % 4) * 3), 70 + i); c.fillStyle = PAPER; c.fill(); spot(c, SPOT.orange, () => c.fill(), 0.8); glow(c, x, y - u * 3, u * 10, SPOT.orange, 0.6); }
      spot(c, SPOT.orange, () => c.fillRect(0, 0, w, h * 0.7), 0.4);
      // the elevated highway and the crowd walking it
      c.beginPath(); c.rect(0, h * 0.72, w, h * 0.28); fillT(c, 0.95, k);
      c.fillStyle = INK; c.fillRect(0, h * 0.72, w, h * 0.06);
      for (let x = w * 0.05; x < w; x += w * 0.16) c.fillRect(x, h * 0.78, u * 3, h * 0.22);
      c.fillRect(0, h * 0.92, w, h * 0.08);
      c.strokeStyle = PAPER; c.lineWidth = u * 0.3; c.beginPath(); c.moveTo(0, h * 0.721); c.lineTo(w, h * 0.721); c.stroke();
      const rng = mulberry32(12);
      for (let i = 0; i < 46; i++) { const x = rng() * w, sz = h * (0.07 + rng() * 0.05); M.zombie(c, x, h * 0.725, sz, { face: rng() < 0.5 ? 1 : -1, lean: 0.2 + rng() * 0.3, rim: SPOT.orange }); }
      vignette(c, w, h, 0.7, k);
    },
    anim(c, w, h, t) {
      const u = unit(w, h);
      glow(c, w * 0.45, h * 0.55, w * (0.3 + 0.04 * Math.sin(t * 7) * Math.sin(t * 3.1)), SPOT.orange, 0.18);
      motes(c, w, h, t, 40, 8, '#ffcf8a', 0.9, u * 0.35, -u * 8, u * 2, u * 3);
    },
  };

  S.convoy = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), hy = h * 0.6;
      paper(c, w, h);
      vTone(c, 0, 0, w, hy, 0.75, 0.05, k);
      glow(c, w * 0.75, hy, w * 0.4, SPOT.amber, 0.7);
      c.fillStyle = PAPER; c.beginPath(); c.arc(w * 0.75, hy, u * 9, Math.PI, TAU); c.fill();
      rays(c, w * 0.75, hy, 26, w, 0.3, 4, PAPER, Math.PI, TAU);
      // distant hills, then the road running toward the sun
      hills(c, w, h, hy, h * 0.02, 2, tone(c, 0.7, k));
      c.fillStyle = INK; c.fillRect(0, hy + h * 0.02, w, h);
      poly(c, [[w * 0.72, hy + h * 0.02], [w * 0.78, hy + h * 0.02], [w * 1.2, h], [w * 0.1, h]]); fillT(c, 0.35, k);
      gradTone(c, 0, hy, 0, h, 0, 0.6, k, INK, [0, hy, w, h - hy]);
      c.strokeStyle = PAPER; c.lineWidth = u * 0.6; c.setLineDash([u * 3, u * 3]); c.beginPath(); c.moveTo(w * 0.75, hy + h * 0.03); c.lineTo(w * 0.62, h); c.stroke(); c.setLineDash([]);
      // trucks shrinking toward the horizon
      for (let i = 0; i < 5; i++) {
        const f = 0.3 + i / 7, x = lerp(w * 0.42, w * 0.75, f), y = lerp(h * 0.98, hy + h * 0.03, f), s = lerp(h * 0.34, h * 0.03, f);
        c.fillStyle = INK; c.beginPath(); c.rect(x - s * 0.9, y - s * 0.75, s * 1.2, s * 0.6); c.rect(x + s * 0.3, y - s * 0.55, s * 0.45, s * 0.4); c.fill();
        c.beginPath(); c.moveTo(x - s * 0.9, y - s * 0.75); c.quadraticCurveTo(x - s * 0.3, y - s * 1.05, x + s * 0.3, y - s * 0.75); c.fill();
        for (const wx of [-0.7, -0.2, 0.55]) { c.beginPath(); c.arc(x + wx * s, y - s * 0.12, s * 0.15, 0, TAU); c.fill(); }
        c.strokeStyle = SPOT.amber; c.lineWidth = Math.max(1, s * 0.02); c.beginPath(); c.moveTo(x - s * 0.9, y - s * 0.75); c.quadraticCurveTo(x - s * 0.3, y - s * 1.05, x + s * 0.3, y - s * 0.75); c.stroke();
      }
      figure(c, w * 0.1, h * 1.02, h * 0.62, 'soldier', { rim: SPOT.amber, pose: 'march' });
      figure(c, w * 0.9, h * 1.02, h * 0.5, 'soldier', { rim: SPOT.amber, face: -1, pose: 'march' });
      // helicopters
      for (const [x, y, s] of [[0.3, 0.2, 1], [0.42, 0.13, 0.7]]) { c.fillStyle = INK; c.beginPath(); c.ellipse(w * x, h * y, u * 5 * s, u * 2 * s, 0, 0, TAU); c.fill(); c.fillRect(w * x, h * y - u * 0.6 * s, u * 8 * s, u * 1 * s); c.fillRect(w * x - u * 8 * s, h * y - u * 2.6 * s, u * 16 * s, u * 0.4 * s); }
      spot(c, SPOT.amber, () => c.fillRect(0, 0, w, h), 0.35);
    },
  };

  S.briefing = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h);
      paper(c, w, h); c.beginPath(); c.rect(0, 0, w, h); fillT(c, 0.9, k);
      // wood grain
      c.strokeStyle = 'rgba(242,238,228,0.12)'; c.lineWidth = u * 0.3; for (let y = 0; y < h; y += u * 2.2) { c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= w; x += 20) c.lineTo(x, y + Math.sin(x * 0.01 + y) * u * 0.6); c.stroke(); }
      glow(c, w * 0.45, h * 0.45, w * 0.55, '#fff4d6', 0.35);
      // the map
      c.save(); c.translate(w * 0.46, h * 0.5); c.rotate(-0.06);
      const mw = w * 0.62, mh = h * 0.78;
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(-mw / 2 + u, -mh / 2 + u * 1.5, mw, mh);
      c.fillStyle = PAPER; c.fillRect(-mw / 2, -mh / 2, mw, mh);
      c.strokeStyle = 'rgba(16,16,16,0.5)'; c.lineWidth = u * 0.25;
      for (let i = 0; i < 9; i++) { c.beginPath(); for (let a = 0; a <= TAU + 0.1; a += 0.2) { const r = (i + 1) * mh * 0.05 * (1 + Math.sin(a * 3 + i) * 0.12); c.lineTo(-mw * 0.15 + Math.cos(a) * r * 1.4, Math.sin(a) * r); } c.stroke(); }
      c.strokeStyle = INK; c.lineWidth = u * 0.6; c.beginPath(); c.moveTo(-mw / 2, mh * 0.2); c.bezierCurveTo(-mw * 0.1, mh * 0.1, mw * 0.1, -mh * 0.3, mw / 2, -mh * 0.25); c.stroke();
      c.lineWidth = u * 0.4; c.beginPath(); c.moveTo(-mw * 0.1, -mh / 2); c.lineTo(mw * 0.05, mh / 2); c.stroke();
      c.strokeStyle = SPOT.red; c.lineWidth = u * 0.9; c.beginPath(); c.ellipse(mw * 0.12, -mh * 0.12, u * 7, u * 4.5, 0.3, 0, TAU * 0.9); c.stroke();
      label(c, 'GROUND ZERO', mw * 0.12 - u * 6, -mh * 0.12 - u * 7, u * 3.4, SPOT.red);
      c.strokeStyle = INK; c.lineWidth = u * 0.8; c.strokeRect(-mw / 2, -mh / 2, mw, mh);
      c.restore();
      // the photograph, paper-clipped
      c.save(); c.translate(w * 0.8, h * 0.38); c.rotate(0.1);
      const pw = w * 0.24, ph = pw * 1.18;
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(-pw / 2 + u, -ph / 2 + u * 1.4, pw, ph);
      c.fillStyle = PAPER; c.fillRect(-pw / 2, -ph / 2, pw, ph);
      c.save(); c.beginPath(); c.rect(-pw / 2 + u * 1.5, -ph / 2 + u * 1.5, pw - u * 3, ph * 0.74); c.clip(); c.fillStyle = tone(c, 0.3, Math.max(3, k - 1)); c.fillRect(-pw, -ph, pw * 2, ph * 2);
      M.bust(c, 'okafor', 0, -ph * 0.12, pw * 0.42, { mood: 'calm' }); c.restore();
      label(c, 'OKAFOR, M. — DR.', -pw / 2 + u * 2, ph * 0.38, u * 3.2);
      label(c, 'STATUS: MISSING', -pw / 2 + u * 2, ph * 0.44, u * 2.8, SPOT.red);
      c.strokeStyle = '#9a9a9a'; c.lineWidth = u * 0.7; c.beginPath(); c.moveTo(-pw * 0.3, -ph / 2 + u * 6); c.lineTo(-pw * 0.3, -ph / 2 - u * 3); c.arc(-pw * 0.25, -ph / 2 - u * 3, pw * 0.05, Math.PI, 0); c.lineTo(-pw * 0.2, -ph / 2 + u * 4); c.stroke();
      c.restore();
      // a marker and a compass left on the table
      c.save(); c.translate(w * 0.16, h * 0.82); c.rotate(-0.5); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(-u * 11, -u * 1.2 + u, u * 22, u * 2.6);
      c.beginPath(); c.roundRect(-u * 11, -u * 1.3, u * 18, u * 2.6, u * 1.3); fillT(c, 0.15, k); c.strokeStyle = INK; c.lineWidth = u * 0.4; c.stroke();
      c.fillStyle = SPOT.red; c.beginPath(); c.roundRect(u * 7, -u * 1.3, u * 5, u * 2.6, u * 1.2); c.fill(); c.stroke(); c.restore();
      c.save(); c.translate(w * 0.86, h * 0.84); c.beginPath(); c.arc(0, 0, u * 6, 0, TAU); fillT(c, 0.6, k); c.stroke(); c.beginPath(); c.arc(0, 0, u * 4.6, 0, TAU); c.fillStyle = PAPER; c.fill(); c.stroke();
      c.fillStyle = SPOT.red; poly(c, [[0, -u * 4], [u * 0.8, 0], [-u * 0.8, 0]]); c.fill(); c.fillStyle = INK; poly(c, [[0, u * 4], [u * 0.8, 0], [-u * 0.8, 0]]); c.fill(); c.restore();
      vignette(c, w, h, 0.85, k);
    },
  };

  S.titleCard = {
    base(c, w, h, o) {
      const k = cellOf(w, h), u = unit(w, h);
      c.fillStyle = INK; c.fillRect(0, 0, w, h);
      radialTone(c, w / 2, h * 0.45, u * 10, u * 90, 0.55, 1, k, [0, 0, w, h]);
      M.focusLines(c, w / 2, h * 0.45, w, h, 140, Math.min(w, h) * 0.35, PAPER, 51);
      c.fillStyle = INK; c.beginPath(); c.ellipse(w / 2, h * 0.45, w * 0.36, h * 0.24, 0, 0, TAU); c.fill();
      glow(c, w / 2, h * 0.45, w * 0.35, SPOT[o.spot || 'red'], 0.35);
      // the horde's arms clawing up from below
      const rng = mulberry32(61);
      for (let i = 0; i < 13; i++) { const x = (i + 0.5) / 13 * w + (rng() - 0.5) * u * 4, ln = h * (0.2 + rng() * 0.2); claw(c, x, h + u * 4, ln, -Math.PI / 2 + (rng() - 0.5) * 0.5, u * (3.2 + rng() * 1.6), 70 + i, { rim: tone(c, 0.5, k), curl: 0.25 + rng() * 0.25, bony: rng() < 0.4 }); }
      const t1 = o.title || 'ZOMBIE BASH', t2 = o.sub || 'HOLD THE LINE';
      const px = Math.min(w / (t1.length * 0.48), h * 0.24);
      c.save(); c.translate(w / 2, h * 0.42); c.rotate(-0.04); c.transform(1, 0, -0.12, 1, 0, 0);
      c.font = `800 ${px}px "Barlow Condensed", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = px * 0.16; c.strokeText(t1, 0, 0);
      c.fillStyle = PAPER; c.fillText(t1, 0, 0);
      c.save(); c.beginPath(); c.rect(-w, 0, w * 2, px); c.clip(); c.fillStyle = tone(c, 0.35, Math.max(3, Math.round(px / 18))); c.fillText(t1, 0, 0); c.restore();
      c.restore();
      c.font = `700 ${px * 0.26}px "Barlow Condensed", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      if (c.letterSpacing !== undefined) c.letterSpacing = `${px * 0.06}px`;
      c.fillStyle = SPOT[o.spot || 'red']; c.fillText(t2, w / 2, h * 0.42 + px * 0.72);
      if (c.letterSpacing !== undefined) c.letterSpacing = '0px';
      // ink splatters
      for (let i = 0; i < 40; i++) { const a = rng() * TAU, d = u * (28 + rng() * 30); c.fillStyle = rng() < 0.3 ? SPOT[o.spot || 'red'] : PAPER; c.globalAlpha = 0.7; c.beginPath(); c.arc(w / 2 + Math.cos(a) * d * 1.7, h * 0.42 + Math.sin(a) * d * 0.8, u * (0.2 + rng() * 0.7), 0, TAU); c.fill(); }
      c.globalAlpha = 1;
    },
  };

  // ============================================================ CHAPTER CARDS
  // A splash panel for a chapter: its number, its name and the world drawn as a silhouette.
  S.chapter = {
    base(c, w, h, o) {
      const k = cellOf(w, h), u = unit(w, h), col = SPOT[o.spot || 'amber'];
      nightSky(c, w, h, k, 0.9, 0.35, 70, 17 + (o.world || 0));
      glow(c, w * 0.7, h * 0.66, w * 0.5, col, 0.55);
      const hy = h * 0.72;
      if (o.world === 0) {
        c.fillStyle = PAPER; c.beginPath(); c.arc(w * 0.7, hy, h * 0.18, Math.PI, TAU); c.fill(); rays(c, w * 0.7, hy, 30, w, 0.22, 9, PAPER, Math.PI, TAU);
        hills(c, w, h, hy, h * 0.02, 6); M.cornRow(c, w, hy + 4, h * 0.14, 2); M.farmhouse(c, w * 0.12, hy, h * 0.16);
        c.fillStyle = INK; c.fillRect(w * 0.82, hy - h * 0.34, u * 0.8, h * 0.34); poly(c, [[w * 0.8, hy - h * 0.3], [w * 0.84, hy - h * 0.3], [w * 0.82, hy - h * 0.36]]); c.fill();
        for (let i = 0; i < 4; i++) { c.save(); c.translate(w * 0.82, hy - h * 0.34); c.rotate(i * Math.PI / 2 + 0.3); c.fillRect(0, -u * 0.8, h * 0.12, u * 1.6); c.restore(); }
      } else if (o.world === 1) {
        c.fillStyle = PAPER; c.beginPath(); c.arc(w * 0.72, h * 0.32, h * 0.2, 0, TAU); c.fill(); c.fillStyle = tone(c, 0.25, k); c.beginPath(); c.arc(w * 0.75, h * 0.3, h * 0.2, 0, TAU); c.fill();
        gravesRow(c, w, hy, h * 0.18, 5, k, u); c.fillStyle = INK; c.fillRect(0, hy, w, h); deadTree(c, w * 0.14, hy, h * 0.6, 3, u);
        chapelSil(c, w * 0.62, hy, h * 0.5);
      } else if (o.world === 2) {
        c.fillStyle = PAPER; poly(c, [[0, hy], [w * 0.2, hy - h * 0.38], [w * 0.36, hy - h * 0.2], [w * 0.55, hy - h * 0.5], [w * 0.78, hy - h * 0.22], [w, hy - h * 0.34], [w, hy], [0, hy]]); c.fill();
        c.fillStyle = tone(c, 0.45, k); poly(c, [[w * 0.2, hy - h * 0.38], [w * 0.28, hy], [w * 0.36, hy - h * 0.2], [w * 0.55, hy - h * 0.5], [w * 0.64, hy], [w * 0.78, hy - h * 0.22], [w, hy - h * 0.1], [w, hy]]); c.fill();
        c.strokeStyle = INK; c.lineWidth = u * 0.4; for (const [px, py] of [[0.2, 0.38], [0.55, 0.5], [0.78, 0.22], [1, 0.34]]) for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(w * px, hy - h * py); c.lineTo(w * px + (i - 2) * u * 5 + u * 3, hy - h * py * (0.4 + i * 0.08)); c.stroke(); }
        c.fillStyle = INK; c.fillRect(0, hy, w, h); station(c, w * 0.3, hy, h * 0.22, u);
      } else {
        c.fillStyle = PAPER; c.beginPath(); c.arc(w * 0.55, h * 0.36, h * 0.12, 0, TAU); c.fill();
        c.fillStyle = INK; c.fillRect(0, hy, w, h);
        for (let i = 0; i < 6; i++) cypress(c, w * (0.04 + i * 0.19), hy + 2, h * (0.5 + (i % 3) * 0.12), 40 + i, u);
      }
      vignette(c, w, h, 0.6, k);
      spot(c, col, () => c.fillRect(0, 0, w, h), 0.25);
      // the lettering block
      const px = Math.min(h * 0.2, w * 0.1);
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.font = font(px * 0.32); c.fillStyle = col; if (c.letterSpacing !== undefined) c.letterSpacing = `${px * 0.08}px`;
      c.fillText(o.kicker || 'CHAPTER', w * 0.06, h * 0.25);
      if (c.letterSpacing !== undefined) c.letterSpacing = '0px';
      c.font = `800 ${px}px "Barlow Condensed", sans-serif`; c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = px * 0.12;
      c.strokeText(o.title, w * 0.06, h * 0.25 + px * 0.95); c.fillStyle = PAPER; c.fillText(o.title, w * 0.06, h * 0.25 + px * 0.95);
      c.fillStyle = col; c.fillRect(w * 0.06, h * 0.25 + px * 1.15, px * 2.2, Math.max(2, px * 0.05));
      c.font = font(px * 0.26, 600); c.fillStyle = PAPER; c.fillText(o.place || '', w * 0.06, h * 0.25 + px * 1.5);
    },
    anim(c, w, h, t, o) {
      const u = unit(w, h);
      if (o.world === 2) motes(c, w, h, t, 70, 3, PAPER, 0.8, u * 0.4, u * 8, -u * 6);
      else if (o.world === 3) motes(c, w, h, t, 26, 5, '#c8ffd8', 0.9, u * 0.35, -u * 0.8, u * 0.8, u * 4);
      else if (o.world === 1) { for (let i = 0; i < 3; i++) fog(c, ((t * u * (2 + i) + i * w * 0.45) % (w * 1.4)) - w * 0.2, h * (0.72 + i * 0.03), w * 0.25, h * 0.05, 0.3); }
      else motes(c, w, h, t, 30, 6, '#ffd890', 0.8, u * 0.3, -u * 2, u * 1.5, u * 3);
    },
  };

  // ============================================================ CHAPTER 1 · HARVEST
  S.farmRoad = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), hy = h * 0.5, vx = w * 0.56;
      paper(c, w, h); vTone(c, 0, 0, w, hy, 0.65, 0.05, k);
      glow(c, vx, hy, w * 0.5, SPOT.amber, 0.7);
      c.fillStyle = PAPER; c.beginPath(); c.arc(vx + w * 0.05, hy, h * 0.12, Math.PI, TAU); c.fill();
      rays(c, vx + w * 0.05, hy, 30, w, 0.22, 7, PAPER, Math.PI, TAU);
      M.farmhouse(c, vx - h * 0.1, hy + 2, h * 0.14);
      // corn walls receding
      c.fillStyle = INK; poly(c, [[0, hy - h * 0.08], [vx - w * 0.04, hy - h * 0.01], [vx - w * 0.04, hy + 2], [0, h]]); c.fill();
      poly(c, [[w, hy - h * 0.1], [vx + w * 0.04, hy - h * 0.01], [vx + w * 0.04, hy + 2], [w, h]]); c.fill();
      M.cornRow(c, vx - w * 0.04, hy - h * 0.02, h * 0.05, 3); c.save(); c.translate(w, 0); c.scale(-1, 1); M.cornRow(c, w - vx - w * 0.04, hy - h * 0.02, h * 0.06, 4); c.restore();
      c.save(); poly(c, [[0, hy - h * 0.08], [vx - w * 0.04, hy - h * 0.01], [vx - w * 0.04, hy + 2], [0, h]]); c.clip(); M.cornRow(c, w * 0.3, h * 0.42, h * 0.24, 9); c.restore();
      M.cornRow(c, w * 0.12, h * 1.02, h * 0.7, 12); c.save(); c.translate(w, 0); c.scale(-1, 1); M.cornRow(c, w * 0.12, h * 1.02, h * 0.7, 13); c.restore();
      // the road
      poly(c, [[vx - w * 0.01, hy], [vx + w * 0.01, hy], [w * 0.84, h], [w * 0.22, h]]); fillT(c, 0.3, k);
      c.strokeStyle = INK; c.lineWidth = u * 0.4; for (let i = 0; i < 12; i++) { const f = i / 12; c.beginPath(); c.moveTo(lerp(vx, w * 0.3, f), lerp(hy, h, f)); c.lineTo(lerp(vx, w * 0.36, f), lerp(hy, h, f) + u * 0.5); c.stroke(); }
      gradTone(c, 0, hy, 0, h, 0, 0.5, k, INK, [w * 0.2, hy, w * 0.66, h - hy]);
      // the dead walking it, closer than they look
      for (const [f, dx, sd] of [[0.15, -0.3, 1], [0.22, 0.4, -1], [0.3, -0.1, 1], [0.38, 0.6, -1], [0.55, -0.7, 1]]) {
        const y = lerp(hy, h, f), x = vx + dx * (y - hy) * 0.6, s = (y - hy) * 0.85;
        figure(c, x, y, s, 'zombie', { face: sd, rim: SPOT.amber });
      }
      spot(c, SPOT.amber, () => c.fillRect(0, 0, w, h), 0.35);
      vignette(c, w, h, 0.6, k);
    },
    anim(c, w, h, t) { motes(c, w, h * 0.6, t, 30, 9, '#fff0c8', 0.6, unit(w, h) * 0.3, -unit(w, h) * 0.6, unit(w, h) * 2, unit(w, h) * 2); },
  };

  S.radio = {
    base(c, w, h, o) {
      const k = cellOf(w, h), u = unit(w, h);
      paper(c, w, h); c.beginPath(); c.rect(0, 0, w, h); fillT(c, 0.75, k);
      M.motionLines(c, 0, 0, w, h, 0, 50, INK, 77);
      // the field set
      const bx = w * 0.12, by = h * 0.18, bw = w * 0.62, bh = h * 0.7;
      c.beginPath(); c.roundRect(bx, by, bw, bh, u * 2); fillT(c, 0.55, k); c.strokeStyle = INK; c.lineWidth = u * 0.9; c.stroke();
      c.save(); c.beginPath(); c.roundRect(bx, by, bw, bh, u * 2); c.clip(); gradTone(c, bx, by, bx + bw, by + bh, 0, 0.8, k, INK, [bx, by, bw, bh]); c.restore();
      // screen with a waveform
      const sx = bx + bw * 0.08, sy = by + bh * 0.12, sw = bw * 0.5, sh = bh * 0.34;
      c.fillStyle = '#0c1a10'; c.fillRect(sx, sy, sw, sh); c.strokeStyle = INK; c.lineWidth = u * 0.8; c.strokeRect(sx, sy, sw, sh);
      label(c, o.ch || 'CH 07  ·  31.250 MHz', sx + sw * 0.05, sy + sh * 0.18, sh * 0.16, SPOT.green, 'left', 600);
      // dials and switches
      for (const [dx, dy, r] of [[0.75, 0.3, 0.12], [0.75, 0.7, 0.09], [0.2, 0.72, 0.07], [0.4, 0.72, 0.07]]) {
        const x = bx + bw * dx, y = by + bh * dy, rr = Math.min(bw, bh) * r;
        c.beginPath(); c.arc(x, y, rr, 0, TAU); fillT(c, 0.85, k); c.stroke();
        c.beginPath(); c.arc(x - rr * 0.2, y - rr * 0.2, rr * 0.55, 0, TAU); fillT(c, 0.2, k); c.stroke();
        c.strokeStyle = INK; c.lineWidth = u * 0.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + rr * 0.8, y - rr * 0.5); c.stroke();
      }
      c.fillStyle = SPOT.red; c.beginPath(); c.arc(bx + bw * 0.6, by + bh * 0.72, u * 1.2, 0, TAU); c.fill();
      // antenna and coiled handset cord
      c.strokeStyle = INK; c.lineWidth = u * 1.1; c.beginPath(); c.moveTo(bx + bw * 0.9, by); c.lineTo(bx + bw * 1.05, -h * 0.1); c.stroke();
      c.lineWidth = u * 0.6; c.beginPath(); for (let i = 0; i <= 40; i++) { const f = i / 40, x = lerp(bx + bw, w * 0.86, f) + Math.cos(i * 1.3) * u * 1.6, y = lerp(by + bh * 0.6, h * 0.5, f) + Math.sin(i * 1.3) * u * 1.6 + Math.sin(f * Math.PI) * h * 0.15; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
      c.save(); c.translate(w * 0.88, h * 0.42); c.rotate(0.4); c.beginPath(); c.roundRect(-u * 3.5, -h * 0.2, u * 7, h * 0.4, u * 3); fillT(c, 0.9, k); c.strokeStyle = PAPER; c.lineWidth = u * 0.4; c.stroke(); c.restore();
      // static
      const rng = mulberry32(5); c.strokeStyle = PAPER; c.lineWidth = u * 0.35;
      for (let i = 0; i < 6; i++) { let x = rng() * w, y = rng() * h * 0.3; c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (rng() - 0.3) * u * 6; y += u * 3; c.lineTo(x, y); } c.stroke(); }
      vignette(c, w, h, 0.7, k);
    },
    anim(c, w, h, t) {
      const u = unit(w, h), bx = w * 0.12, by = h * 0.18, bw = w * 0.62, bh = h * 0.7;
      const sx = bx + bw * 0.08, sy = by + bh * 0.12, sw = bw * 0.5, sh = bh * 0.34;
      c.save(); c.beginPath(); c.rect(sx, sy, sw, sh); c.clip();
      c.strokeStyle = SPOT.green; c.lineWidth = Math.max(1, u * 0.4); c.beginPath();
      for (let i = 0; i <= 60; i++) { const f = i / 60, x = sx + f * sw, burst = Math.max(0, Math.sin(t * 3 + f * 5)) ** 3, y = sy + sh * 0.62 + Math.sin(f * 40 + t * 20) * sh * 0.25 * burst * (0.4 + 0.6 * Math.sin(f * 7 + t * 5)); i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke(); c.restore();
      if (Math.sin(t * 6) > 0) { c.fillStyle = SPOT.red; c.beginPath(); c.arc(bx + bw * 0.6, by + bh * 0.72, u * 1.2, 0, TAU); c.fill(); glow(c, bx + bw * 0.6, by + bh * 0.72, u * 4, SPOT.red, 0.7); }
    },
  };

  // a giant falling: the Harvester, the Grave Lord
  S.bossFall = {
    base(c, w, h, o) {
      const k = cellOf(w, h), u = unit(w, h), col = SPOT[o.spot || 'amber'], gx = w * 0.55, gy = h * 0.82;
      paper(c, w, h); radialTone(c, gx, h * 0.4, u * 10, Math.hypot(w, h) * 0.6, 0.1, 0.85, k, [0, 0, w, h]);
      M.focusLines(c, gx, h * 0.45, w, h, 120, Math.min(w, h) * 0.42, INK, 19);
      glow(c, gx, h * 0.45, u * 60, col, 0.6);
      // the giant on its knees, slumping forward
      fog(c, gx, gy, u * 70, u * 16, 0.5);
      figure(c, gx, gy + u * 2, h * 0.8, o.kind === 'grave' ? 'grave' : 'harvester', { pose: 'fallen', rim: col, eyes: o.kind === 'grave' ? SPOT.purple : SPOT.green });
      if (o.kind === 'grave') { c.strokeStyle = INK; c.lineWidth = u * 1.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(gx + u * 18, gy + u * 4); c.lineTo(gx + u * 26, gy - h * 0.62); c.stroke(); glow(c, gx + u * 26, gy - h * 0.64, u * 8, SPOT.purple, 0.9); c.fillStyle = PAPER; c.beginPath(); c.arc(gx + u * 26, gy - h * 0.64, u * 1.6, 0, TAU); c.fill(); }
      // dust kicked up all round
      for (let i = 0; i < 7; i++) cloud(c, gx + (i - 3) * u * 15, gy + u * (2 - Math.abs(i - 3) * 0.5), u * (12 - Math.abs(i - 3) * 1.6), 80 + i, 0.3, k, 10, 0, 0.7, 0.5);
      for (let i = 0; i < 5; i++) fog(c, gx + (i - 2) * u * 22, gy + u * 3, u * 22, u * 7, 0.6);
      c.fillStyle = INK; c.fillRect(0, gy + u * 6, w, h);
      for (let i = 0; i < 6; i++) crack(c, gx + (i - 2.5) * u * 9, gy + u * 7, u * 20, Math.PI / 2 + (i - 2.5) * 0.3, 100 + i, u * 0.5, 1);
      c.strokeStyle = PAPER; for (let i = 0; i < 6; i++) { c.globalAlpha = 0.5; crack(c, gx + (i - 2.5) * u * 9, gy + u * 7, u * 18, Math.PI / 2 + (i - 2.5) * 0.3, 100 + i, u * 0.2, 1); } c.globalAlpha = 1;
      // two tiny soldiers for scale
      figure(c, w * 0.1, h * 1.0, h * 0.3, 'soldier', { rim: col }); figure(c, w * 0.2, h * 1.0, h * 0.27, 'soldier', { rim: col, pose: 'march' });
      vignette(c, w, h, 0.6, k);
    },
  };

  S.badge = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h);
      paper(c, w, h); c.beginPath(); c.rect(0, 0, w, h); fillT(c, 0.7, k);
      const rng = mulberry32(41);
      for (let i = 0; i < 60; i++) { c.fillStyle = rng() < 0.5 ? INK : tone(c, 0.9, k); c.beginPath(); c.ellipse(rng() * w, rng() * h, u * (0.5 + rng() * 2.5), u * (0.3 + rng() * 1.5), rng() * 3, 0, TAU); c.fill(); }
      for (let i = 0; i < 6; i++) M.cornRow(c, w, h * (0.15 + i * 0.18), h * 0.04, 50 + i, 'rgba(16,16,16,0.4)');
      c.save(); c.translate(w * 0.5, h * 0.52); c.rotate(-0.12);
      const bw = Math.min(w * 0.66, h * 1.3), bh = bw * 0.6;
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(-bw / 2 + u, -bh / 2 + u * 1.6, bw, bh);
      c.beginPath(); c.roundRect(-bw / 2, -bh / 2, bw, bh, u * 2); c.fillStyle = PAPER; c.fill(); c.strokeStyle = INK; c.lineWidth = u * 0.7; c.stroke();
      c.fillStyle = INK; c.fillRect(-bw / 2, -bh / 2, bw, bh * 0.22);
      label(c, 'KESSLER-VANE BIOTECH', -bw / 2 + u * 3, -bh / 2 + bh * 0.11, bh * 0.1, PAPER);
      c.fillStyle = SPOT.green; c.beginPath(); c.arc(bw / 2 - bh * 0.13, -bh / 2 + bh * 0.11, bh * 0.06, 0, TAU); c.fill();
      c.save(); c.beginPath(); c.rect(-bw / 2 + u * 3, -bh / 2 + bh * 0.3, bh * 0.5, bh * 0.6); c.clip(); c.fillStyle = tone(c, 0.3, Math.max(3, k - 1)); c.fillRect(-bw, -bh, bw * 2, bh * 2);
      M.bust(c, 'crane', -bw / 2 + u * 3 + bh * 0.25, -bh / 2 + bh * 0.52, bh * 0.22, { mood: 'calm', eyes: 'plain' }); c.restore();
      c.strokeStyle = INK; c.lineWidth = u * 0.4; c.strokeRect(-bw / 2 + u * 3, -bh / 2 + bh * 0.3, bh * 0.5, bh * 0.6);
      const tx = -bw / 2 + u * 5 + bh * 0.5;
      label(c, 'CRANE, ELIAS', tx, -bh / 2 + bh * 0.38, bh * 0.12);
      label(c, 'FIELD CONTRACTOR', tx, -bh / 2 + bh * 0.52, bh * 0.08, INK, 'left', 600);
      label(c, 'SITE HC-1  ·  LEVEL 2', tx, -bh / 2 + bh * 0.63, bh * 0.08, INK, 'left', 600);
      for (let i = 0; i < 26; i++) { c.fillStyle = INK; c.fillRect(tx + i * bw * 0.014, bh * 0.25, (i % 3 ? 1 : 2) * u * 0.35, bh * 0.14); }
      c.restore();
      // a crack and a smear of blood across it
      crack(c, w * 0.32, h * 0.3, u * 35, 0.7, 7, u * 0.5, 2);
      spot(c, SPOT.red, () => { c.beginPath(); c.ellipse(w * 0.66, h * 0.66, u * 10, u * 5, 0.4, 0, TAU); c.ellipse(w * 0.72, h * 0.6, u * 4, u * 3, 0, 0, TAU); c.fill(); }, 0.85);
      vignette(c, w, h, 0.8, k);
    },
  };

  // ============================================================ CHAPTER 2 · THE RESTLESS
  function gravesRow(c, w, y, hh, seed, k, u, col = INK) {
    const rng = mulberry32(seed); c.fillStyle = col;
    for (let x = rng() * hh * 0.4; x < w; x += hh * (0.5 + rng() * 0.6)) {
      const gh = hh * (0.5 + rng() * 0.5), gw = gh * 0.55, tilt = (rng() - 0.5) * 0.2, kind = rng();
      c.save(); c.translate(x, y); c.rotate(tilt); c.beginPath();
      if (kind < 0.3) { c.rect(-gw * 0.12, -gh, gw * 0.24, gh); c.rect(-gw * 0.45, -gh * 0.75, gw * 0.9, gw * 0.24); }
      else if (kind < 0.8) { c.moveTo(-gw / 2, 0); c.lineTo(-gw / 2, -gh + gw / 2); c.arc(0, -gh + gw / 2, gw / 2, Math.PI, TAU); c.lineTo(gw / 2, 0); }
      else { c.rect(-gw * 0.35, -gh * 1.2, gw * 0.7, gh * 1.2); poly(c, [[-gw * 0.45, -gh * 1.2], [0, -gh * 1.5], [gw * 0.45, -gh * 1.2]]); }
      c.fill(); c.restore();
    }
  }
  function deadTree(c, x, y, hh, seed, u) {
    const rng = mulberry32(seed); c.strokeStyle = INK; c.lineCap = 'round';
    const br = (x0, y0, len, a, wd, d) => { const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len; c.lineWidth = wd; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + (rng() - 0.5) * len * 0.3, (y0 + y1) / 2, x1, y1); c.stroke(); if (d > 0) for (let i = 0; i < 2 + (rng() < 0.4); i++) br(x1, y1, len * (0.55 + rng() * 0.2), a + (rng() - 0.5) * 1.3, wd * 0.62, d - 1); };
    br(x, y, hh * 0.38, -Math.PI / 2 + (rng() - 0.5) * 0.2, hh * 0.06, 5);
  }
  function chapelSil(c, x, y, hh, col = INK) {
    c.fillStyle = col; const s = hh / 100;
    c.beginPath(); c.rect(x - 30 * s, y - 40 * s, 60 * s, 40 * s); poly(c, [[x - 34 * s, y - 40 * s], [x, y - 62 * s], [x + 34 * s, y - 40 * s]]); c.fill();
    c.fillRect(x + 12 * s, y - 70 * s, 16 * s, 70 * s); poly(c, [[x + 10 * s, y - 70 * s], [x + 20 * s, y - 100 * s], [x + 30 * s, y - 70 * s]]); c.fill();
    c.fillRect(x + 19 * s, y - 112 * s, 2 * s, 14 * s); c.fillRect(x + 15 * s, y - 108 * s, 10 * s, 2 * s);
    return s;
  }
  S.cemeteryGates = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), hy = h * 0.74;
      nightSky(c, w, h, k, 0.8, 0.45, 60, 23);
      c.fillStyle = PAPER; c.beginPath(); c.arc(w * 0.7, h * 0.26, h * 0.17, 0, TAU); c.fill(); glow(c, w * 0.7, h * 0.26, h * 0.4, SPOT.purple, 0.5);
      c.fillStyle = tone(c, 0.2, k); c.beginPath(); c.arc(w * 0.73, h * 0.24, h * 0.06, 0, TAU); c.arc(w * 0.66, h * 0.31, h * 0.035, 0, TAU); c.fill();
      gravesRow(c, w, hy - h * 0.06, h * 0.08, 7, k, u, tone(c, 0.6, k)); gravesRow(c, w, hy - h * 0.02, h * 0.12, 8, k, u);
      deadTree(c, w * 0.1, hy, h * 0.75, 6, u);
      c.fillStyle = INK; c.fillRect(0, hy, w, h);
      // stone pillars and the iron gate arching between them
      const gx = w * 0.5, gw = w * 0.22, gt = h * 0.32;
      for (const sd of [-1, 1]) { const px = gx + sd * gw - u * 3; c.beginPath(); c.rect(px, gt - h * 0.04, u * 6, hy - gt + h * 0.06); fillT(c, 0.6, k); c.strokeStyle = INK; c.lineWidth = u * 0.5; c.stroke(); c.beginPath(); c.rect(px - u, gt - h * 0.07, u * 8, h * 0.035); fillT(c, 0.35, k); c.stroke(); c.fillStyle = INK; c.beginPath(); c.arc(px + u * 3, gt - h * 0.09, u * 2.2, 0, TAU); c.fill(); }
      c.strokeStyle = INK; c.lineWidth = u * 0.7;
      for (let i = 0; i <= 12; i++) { const x = gx - gw + u * 3 + (i / 12) * (gw * 2 - u * 6), top = gt + h * 0.04 + (1 - Math.cos((i / 12 - 0.5) * Math.PI)) * h * 0.08 - h * 0.03; c.beginPath(); c.moveTo(x, hy); c.lineTo(x, top); c.stroke(); c.fillStyle = INK; poly(c, [[x - u * 0.8, top], [x, top - u * 2.5], [x + u * 0.8, top]]); c.fill(); }
      for (const y of [0.55, 0.62]) { c.beginPath(); c.moveTo(gx - gw, h * y); c.lineTo(gx + gw, h * y); c.stroke(); }
      c.lineWidth = u * 0.9; c.beginPath(); c.moveTo(gx - gw + u * 3, gt + h * 0.06); c.quadraticCurveTo(gx, gt - h * 0.06, gx + gw - u * 3, gt + h * 0.06); c.stroke();
      label(c, 'BLACKWOOD', gx, gt + h * 0.035, u * 3.6, INK, 'center');
      // scrolls on the gate
      for (const sd of [-1, 1]) { c.lineWidth = u * 0.5; c.beginPath(); c.arc(gx + sd * gw * 0.3, h * 0.585, u * 2, 0, TAU * 0.8); c.stroke(); }
      // ground fog
      for (let i = 0; i < 6; i++) fog(c, w * (0.05 + i * 0.19), hy + h * (0.01 + (i % 2) * 0.03), w * 0.2, h * 0.05, 0.45);
      spot(c, SPOT.purple, () => c.fillRect(0, 0, w, h), 0.35);
      vignette(c, w, h, 0.7, k);
    },
    anim(c, w, h, t) { for (let i = 0; i < 3; i++) { const x = ((t * unit(w, h) * (2 + i) + i * w * 0.4) % (w * 1.4)) - w * 0.2; fog(c, x, h * (0.74 + i * 0.04), w * 0.22, h * 0.04, 0.3); } },
  };

  S.skeletonHand = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), gx = w * 0.5, gy = h * 0.72;
      paper(c, w, h); M.focusLines(c, gx, h * 0.45, w, h, 150, Math.min(w, h) * 0.32, INK, 29);
      glow(c, gx, gy, u * 40, SPOT.purple, 0.7);
      // a headstone behind
      c.beginPath(); c.moveTo(w * 0.72, gy); c.lineTo(w * 0.72, h * 0.3); c.arc(w * 0.82, h * 0.3, w * 0.1, Math.PI, TAU); c.lineTo(w * 0.92, gy); fillT(c, 0.5, k); c.strokeStyle = INK; c.lineWidth = u * 0.7; c.stroke();
      label(c, 'R.I.P.', w * 0.82, h * 0.32, u * 4.5, INK, 'center');
      crack(c, w * 0.76, h * 0.28, u * 20, 1.2, 9, u * 0.4, 1);
      // soil heaving up
      c.fillStyle = INK; c.beginPath(); c.moveTo(0, h); c.lineTo(0, gy + h * 0.05); c.quadraticCurveTo(gx - w * 0.2, gy + h * 0.02, gx - w * 0.08, gy - h * 0.04); c.lineTo(gx + w * 0.08, gy - h * 0.05); c.quadraticCurveTo(gx + w * 0.2, gy + h * 0.02, w, gy + h * 0.06); c.lineTo(w, h); c.fill();
      // the skeletal hand
      c.save(); c.translate(gx, gy - h * 0.03); c.rotate(-0.1);
      const s = h / 100 * 0.9; c.strokeStyle = INK; c.fillStyle = PAPER; c.lineCap = 'round'; c.lineJoin = 'round';
      const bone = (x0, y0, x1, y1, wd) => { c.lineWidth = wd + s * 2.2; c.strokeStyle = INK; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.lineWidth = wd; c.strokeStyle = PAPER; c.stroke(); };
      bone(-4 * s, 10 * s, -4 * s, -24 * s, s * 4); bone(4 * s, 10 * s, 3 * s, -24 * s, s * 3.4);
      c.beginPath(); c.ellipse(0, -28 * s, 9 * s, 6 * s, 0, 0, TAU); c.lineWidth = s * 2.2; c.strokeStyle = INK; c.stroke(); c.fill();
      for (const [a, l] of [[-0.55, 26], [-0.2, 32], [0.12, 30], [0.42, 24]]) {
        let x = Math.sin(a) * 8 * s, y = -32 * s, ang = -Math.PI / 2 + a;
        for (const seg of [0.42, 0.33, 0.25]) { const nx = x + Math.cos(ang) * l * seg * s, ny = y + Math.sin(ang) * l * seg * s; bone(x, y, nx, ny, s * 2.2); c.fillStyle = PAPER; c.beginPath(); c.arc(nx, ny, s * 1.5, 0, TAU); c.fill(); c.lineWidth = s; c.strokeStyle = INK; c.stroke(); x = nx; y = ny; ang += 0.35; }
      }
      bone(-8 * s, -26 * s, -20 * s, -34 * s, s * 2.4); bone(-20 * s, -34 * s, -26 * s, -44 * s, s * 2);
      c.restore();
      // clods flying
      const rng = mulberry32(3);
      for (let i = 0; i < 22; i++) { const a = -Math.PI * (0.1 + rng() * 0.8), d = u * (12 + rng() * 30); c.fillStyle = INK; c.beginPath(); c.ellipse(gx + Math.cos(a) * d * 1.4, gy + Math.sin(a) * d, u * (0.6 + rng() * 1.6), u * (0.5 + rng()), rng() * 3, 0, TAU); c.fill(); }
      spot(c, SPOT.purple, () => c.fillRect(0, 0, w, h), 0.3);
    },
  };

  S.riftSky = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), hy = h * 0.82;
      nightSky(c, w, h, k, 0.9, 0.55, 40, 31);
      // the tear: a jagged gash across the sky with another sky inside it
      const rng = mulberry32(13), top = [], bot = [];
      for (let i = 0; i <= 14; i++) { const f = i / 14, x = lerp(w * 0.1, w * 0.92, f), y = lerp(h * 0.42, h * 0.18, f) + Math.sin(f * 9) * h * 0.03, th = Math.sin(f * Math.PI) * h * 0.11 * (0.6 + rng() * 0.6); top.push([x + (rng() - 0.5) * u * 3, y - th]); bot.push([x + (rng() - 0.5) * u * 3, y + th * 0.8]); }
      const gash = () => poly(c, [...top, ...[...bot].reverse()]);
      glow(c, w * 0.5, h * 0.3, w * 0.5, SPOT.purple, 0.65);
      c.save(); gash(); c.clip();
      const g = c.createLinearGradient(0, h * 0.1, 0, h * 0.5); g.addColorStop(0, '#2a0e40'); g.addColorStop(0.5, '#b866ff'); g.addColorStop(1, '#2a0e40'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      glow(c, w * 0.5, h * 0.3, w * 0.3, '#f4e8ff', 0.9);
      c.fillStyle = PAPER; for (let i = 0; i < 70; i++) { c.globalAlpha = 0.4 + rng() * 0.6; c.beginPath(); c.arc(rng() * w, h * 0.1 + rng() * h * 0.4, u * (0.15 + rng() * 0.4), 0, TAU); c.fill(); } c.globalAlpha = 1;
      M.motionLines(c, w * 0.1, h * 0.15, w * 0.8, h * 0.3, -0.25, 40, 'rgba(242,238,228,0.6)', 3);
      c.restore();
      c.save(); c.shadowColor = SPOT.purple; c.shadowBlur = u * 4; gash(); c.strokeStyle = PAPER; c.lineWidth = u * 0.9; c.stroke(); c.restore();
      gash(); c.strokeStyle = INK; c.lineWidth = u * 0.35; c.stroke();
      // rocks torn loose, drifting up into it
      for (let i = 0; i < 12; i++) { const x = w * (0.15 + rng() * 0.75), y = h * (0.45 + rng() * 0.25), r = u * (0.8 + rng() * 2.2); c.save(); c.translate(x, y); c.rotate(rng() * 3); poly(c, [[-r, -r * 0.4], [-r * 0.2, -r], [r, -r * 0.5], [r * 0.7, r * 0.6], [-r * 0.6, r * 0.7]]); c.fillStyle = INK; c.fill(); c.strokeStyle = SPOT.purple; c.lineWidth = u * 0.3; c.stroke(); c.restore(); }
      // lightning from the tear
      for (const [x, a] of [[0.3, 1.9], [0.62, 1.2], [0.8, 1.6]]) { c.save(); c.shadowColor = SPOT.purple; c.shadowBlur = u * 4; crack(c, w * x, h * 0.32, h * 0.34, a, 70 + x * 10, u * 0.7, 2, PAPER); c.restore(); }
      // the chapel and graves below
      gravesRow(c, w, hy, h * 0.08, 19, k, u);
      chapelSil(c, w * 0.42, hy, h * 0.42);
      c.fillStyle = INK; c.fillRect(0, hy, w, h);
      c.fillStyle = SPOT.amber; c.fillRect(w * 0.42 - h * 0.42 * 0.06, hy - h * 0.42 * 0.3, h * 0.42 * 0.05, h * 0.42 * 0.12);
      vignette(c, w, h, 0.6, k);
    },
    anim(c, w, h, t) { glow(c, w * 0.5, h * 0.3, w * (0.18 + 0.05 * pulse(t, 2.5)), SPOT.purple, 0.3); if (Math.sin(t * 1.7) > 0.96) { c.fillStyle = 'rgba(242,238,228,0.25)'; c.fillRect(0, 0, w, h); } },
  };

  // ============================================================ CHAPTER 3 · WHITE SILENCE
  function station(c, x, y, hh, u) {
    const s = hh / 100; c.fillStyle = INK;
    c.beginPath(); c.ellipse(x, y, 34 * s, 26 * s, 0, Math.PI, TAU); c.fill();
    c.fillRect(x + 30 * s, y - 30 * s, 60 * s, 30 * s); c.fillRect(x - 80 * s, y - 20 * s, 46 * s, 20 * s);
    c.lineWidth = Math.max(1, 1.6 * s); c.strokeStyle = INK;
    c.beginPath(); c.moveTo(x + 70 * s, y - 30 * s); c.lineTo(x + 76 * s, y - 120 * s); c.lineTo(x + 82 * s, y - 30 * s); c.stroke();
    for (let i = 1; i < 6; i++) { const yy = y - 30 * s - i * 16 * s; c.beginPath(); c.moveTo(x + 70 * s + i * 1, yy); c.lineTo(x + 82 * s - i * 1, yy - 8 * s); c.stroke(); }
    c.beginPath(); c.arc(x - 10 * s, y - 36 * s, 10 * s, Math.PI * 0.8, Math.PI * 1.9); c.stroke(); c.fillRect(x - 11 * s, y - 36 * s, 2 * s, 12 * s);
    c.fillStyle = SPOT.amber; for (let i = 0; i < 4; i++) c.fillRect(x + 36 * s + i * 13 * s, y - 20 * s, 6 * s, 6 * s);
    return [x + 76 * s, y - 120 * s];
  }
  S.snowstorm = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), hy = h * 0.74;
      paper(c, w, h); vTone(c, 0, 0, w, hy, 0.85, 0.3, k);
      glow(c, w * 0.6, h * 0.5, w * 0.4, SPOT.ice, 0.4);
      const [ax, ay] = station(c, w * 0.48, hy, h * 0.32, u);
      // searchlight sweeping the storm
      c.save(); c.globalAlpha = 0.45; const g = c.createLinearGradient(w * 0.38, hy - h * 0.1, 0, h * 0.1); g.addColorStop(0, 'rgba(242,238,228,1)'); g.addColorStop(1, 'rgba(242,238,228,0)'); c.fillStyle = g; poly(c, [[w * 0.38, hy - h * 0.12], [0, h * 0.02], [0, h * 0.36]]); c.fill(); c.restore();
      // drifts
      c.fillStyle = PAPER; c.beginPath(); c.moveTo(0, h); c.lineTo(0, hy); for (let x = 0; x <= w; x += 10) c.lineTo(x, hy - Math.sin(x / w * 7) * h * 0.02); c.lineTo(w, h); c.fill();
      gradTone(c, 0, hy, 0, h, 0.05, 0.35, k, INK, [0, hy - h * 0.03, w, h - hy + h * 0.03]);
      c.strokeStyle = INK; c.lineWidth = u * 0.5; c.beginPath(); for (let x = 0; x <= w; x += 10) (x ? c.lineTo(x, hy - Math.sin(x / w * 7) * h * 0.02) : c.moveTo(x, hy)); c.stroke();
      // a lone sentry, half-buried
      figure(c, w * 0.84, h * 0.97, h * 0.36, 'soldier', { face: -1 });
      M.motionLines(c, -w * 0.2, -h * 0.2, w * 1.4, h * 1.4, 0.5, 130, PAPER, 4);
      spot(c, SPOT.ice, () => c.fillRect(0, 0, w, h), 0.45);
      c.fillStyle = SPOT.red; c.beginPath(); c.arc(ax, ay, u * 0.9, 0, TAU); c.fill();
      vignette(c, w, h, 0.5, k);
    },
    anim(c, w, h, t) { const u = unit(w, h); motes(c, w, h, t, 120, 6, PAPER, 0.9, u * 0.35, u * 14, -u * 22); if (Math.sin(t * 3) > 0) glow(c, w * 0.48 + 76 * h * 0.0032, h * 0.74 - 120 * h * 0.0032, u * 3, SPOT.red, 0.9); },
  };

  S.frozenGiant = {
    base(c, w, h, o) {
      const k = cellOf(w, h), u = unit(w, h), cx = w * 0.5, broken = o.broken;
      paper(c, w, h); c.beginPath(); c.rect(0, 0, w, h); fillT(c, 0.85, k);
      glow(c, cx, h * 0.45, w * 0.5, SPOT.ice, 0.55);
      // the ice block
      const blk = [[cx - w * 0.26, h * 0.92], [cx - w * 0.3, h * 0.2], [cx - w * 0.1, h * 0.04], [cx + w * 0.22, h * 0.08], [cx + w * 0.3, h * 0.3], [cx + w * 0.27, h * 0.92]];
      poly(c, blk); fillT(c, 0.18, k);
      c.save(); poly(c, blk); c.clip();
      // the soldier inside: huge, armoured, arms folded, visor dark
      figure(c, cx, h * 0.93, h * 0.84, 'frozen', { pose: 'stand', adj: { ua1: 0.5, la1: 1.9, ua2: 0.6, la2: 1.7 }, eyes: SPOT.ice });
      gradTone(c, cx - w * 0.3, 0, cx + w * 0.3, 0, 0.6, 0, k, PAPER, [cx - w * 0.3, 0, w * 0.6, h]);
      // facets and internal fractures
      c.strokeStyle = PAPER; c.lineWidth = u * 0.5; for (const [x0, y0, x1, y1] of [[-0.1, 0.04, -0.05, 0.92], [0.22, 0.08, 0.1, 0.92], [-0.3, 0.2, 0.3, 0.3]]) { c.beginPath(); c.moveTo(cx + x0 * w, y0 * h); c.lineTo(cx + x1 * w, y1 * h); c.stroke(); }
      c.globalAlpha = 0.7; for (let i = 0; i < 7; i++) crack(c, cx + (i - 3) * w * 0.06, h * (0.2 + (i % 3) * 0.2), u * 18, i * 0.9, 140 + i, u * 0.35, 2); c.globalAlpha = 1;
      c.restore();
      poly(c, blk); c.strokeStyle = INK; c.lineWidth = u * 0.9; c.stroke();
      spot(c, SPOT.ice, () => { poly(c, blk); c.fill(); }, 0.6);
      if (broken) { const rng = mulberry32(9); for (let i = 0; i < 34; i++) { const a = rng() * TAU, d = u * (20 + rng() * 50); shard(c, cx + Math.cos(a) * d * 1.5, h * 0.45 + Math.sin(a) * d, u * (2 + rng() * 4), rng() * 6, 200 + i, 0.15, k, u * 0.4); } M.focusLines(c, cx, h * 0.45, w, h, 90, Math.min(w, h) * 0.5, INK, 33); }
      // Okafor and a soldier with flashlights at the foot of it
      c.fillStyle = INK; c.fillRect(0, h * 0.92, w, h * 0.08);
      for (const [x, kind, hh, f] of [[0.16, 'parka', 0.26, 1], [0.84, 'moreno', 0.28, -1]]) {
        const { hand } = figure(c, w * x, h * 0.99, h * hh, kind, { face: f, pose: kind === 'parka' ? 'point' : 'gun', rim: SPOT.ice });
        c.save(); c.globalAlpha = 0.3; c.fillStyle = PAPER; poly(c, [hand, [cx - f * w * 0.12, h * 0.25], [cx - f * w * 0.0, h * 0.6]]); c.fill(); c.restore();
      }
      vignette(c, w, h, 0.7, k);
    },
    anim(c, w, h, t) { motes(c, w, h, t, 40, 2, '#e6f8ff', 0.7, unit(w, h) * 0.3, unit(w, h) * 2, -unit(w, h)); },
  };

  S.console = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h);
      c.fillStyle = INK; c.fillRect(0, 0, w, h);
      // a wall of screens
      const rng = mulberry32(71);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) {
        const x = w * (0.04 + i * 0.24), y = h * (0.05 + r * 0.22), sw = w * 0.21, sh = h * 0.18;
        c.fillStyle = '#0a1820'; c.fillRect(x, y, sw, sh); c.strokeStyle = tone(c, 0.5, k); c.lineWidth = u * 0.8; c.strokeRect(x, y, sw, sh);
        c.strokeStyle = SPOT.ice; c.lineWidth = u * 0.3; c.globalAlpha = 0.8;
        const kind = (r * 4 + i) % 4;
        if (kind === 0) { for (let j = 0; j < 6; j++) { const a = rng() * TAU, b = rng() * TAU; c.beginPath(); c.moveTo(x + sw / 2 + Math.cos(a) * sh * 0.35, y + sh / 2 + Math.sin(a) * sh * 0.35); c.lineTo(x + sw / 2 + Math.cos(b) * sh * 0.35, y + sh / 2 + Math.sin(b) * sh * 0.35); c.stroke(); } for (let j = 0; j < 7; j++) { c.beginPath(); c.arc(x + sw / 2 + Math.cos(j) * sh * 0.35, y + sh / 2 + Math.sin(j) * sh * 0.35, u, 0, TAU); c.stroke(); } }
        else if (kind === 1) { c.beginPath(); for (let j = 0; j <= 30; j++) { const xx = x + sw * 0.05 + (j / 30) * sw * 0.9, yy = y + sh * 0.6 - (rng() * 0.5 + Math.sin(j * 0.4) * 0.2) * sh * 0.5; j ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); }
        else if (kind === 2) { for (let j = 0; j < 5; j++) c.fillRect(x + sw * 0.08, y + sh * (0.15 + j * 0.16), sw * (0.3 + rng() * 0.55), sh * 0.06); }
        else { c.beginPath(); c.arc(x + sw / 2, y + sh / 2, sh * 0.35, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(x + sw / 2, y + sh / 2); c.lineTo(x + sw / 2 + sh * 0.35, y + sh * 0.3); c.stroke(); }
        c.globalAlpha = 1;
      }
      c.fillStyle = SPOT.red; c.fillRect(w * 0.28 + w * 0.02, h * 0.29, w * 0.17, h * 0.05); label(c, 'SAMPLE REQUIRED', w * 0.385, h * 0.315, h * 0.035, PAPER, 'center');
      glow(c, w * 0.5, h * 0.4, w * 0.5, SPOT.ice, 0.3);
      // the desk and Okafor at it, back to us
      c.beginPath(); c.rect(0, h * 0.72, w, h * 0.28); fillT(c, 0.75, k);
      c.strokeStyle = PAPER; c.lineWidth = u * 0.4; c.beginPath(); c.moveTo(0, h * 0.72); c.lineTo(w, h * 0.72); c.stroke();
      backBust(c, w * 0.5, h * 0.84, h * 0.22, 'parka', { rim: SPOT.ice });
      c.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < h * 0.72; y += 3) c.fillRect(0, y, w, 1);
    },
    anim(c, w, h, t) { const u = unit(w, h); if (Math.sin(t * 5) > 0) { c.fillStyle = 'rgba(224,69,58,0.4)'; c.fillRect(w * 0.3, h * 0.29, w * 0.17, h * 0.05); } c.fillStyle = 'rgba(143,216,255,0.06)'; c.fillRect(0, ((t * 0.3) % 1) * h * 0.72, w, u * 4); },
  };

  S.vial = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), cx = w * 0.5, cy = h * 0.46;
      c.fillStyle = INK; c.fillRect(0, 0, w, h);
      rays(c, cx, cy, 40, Math.hypot(w, h), 0.18, 5);
      glow(c, cx, cy, u * 55, SPOT.green, 0.7);
      // the core: a sealed cylinder with a crystal sliver floating in light
      const vw = u * 9, vh = u * 34;
      c.save(); c.translate(cx, cy); c.rotate(-0.25);
      c.beginPath(); c.roundRect(-vw, -vh / 2, vw * 2, vh, vw * 0.5); c.fillStyle = '#d8ffe4'; c.fill();
      gradTone(c, -vw, 0, vw, 0, 0, 0.45, Math.max(3, k - 1), INK, [-vw, -vh / 2, vw * 2, vh]);
      spot(c, SPOT.green, () => { c.beginPath(); c.roundRect(-vw, -vh / 2, vw * 2, vh, vw * 0.5); c.fill(); }, 0.75);
      crystal(c, 0, vh * 0.3, vh * 0.55, vw * 0.35, 0, k, u * 0.35, 0.3);
      c.fillStyle = PAPER; c.globalAlpha = 0.8; c.fillRect(-vw * 0.7, -vh * 0.4, vw * 0.25, vh * 0.8); c.globalAlpha = 1;
      for (const y of [-vh / 2, vh / 2 - u * 5]) { c.beginPath(); c.rect(-vw * 1.15, y, vw * 2.3, u * 5); fillT(c, 0.85, k); c.strokeStyle = PAPER; c.lineWidth = u * 0.3; c.stroke(); }
      c.strokeStyle = INK; c.lineWidth = u * 0.6; c.beginPath(); c.roundRect(-vw, -vh / 2, vw * 2, vh, vw * 0.5); c.stroke();
      c.restore();
      // the gloved hand holding it
      c.save(); c.translate(cx + u * 4, cy + u * 12); c.rotate(-0.25); const s = u * 1.1; c.fillStyle = INK;
      c.beginPath(); c.roundRect(-14 * s, -2 * s, 26 * s, 18 * s, 6 * s); c.rect(-10 * s, 10 * s, 18 * s, 40 * s); c.fill();
      for (let i = 0; i < 4; i++) { c.beginPath(); c.roundRect(-12 * s, -10 * s + i * 6 * s, 10 * s, 5.4 * s, 2.7 * s); c.fill(); }
      c.strokeStyle = SPOT.green; c.lineWidth = s * 0.8; c.beginPath(); c.moveTo(-14 * s, -10 * s); c.lineTo(-14 * s, 14 * s); c.stroke();
      c.restore();
    },
    anim(c, w, h, t) { const u = unit(w, h); glow(c, w * 0.5, h * 0.46, u * (20 + 8 * pulse(t, 3)), SPOT.green, 0.45); motes(c, w, h, t, 24, 7, '#d8ffe4', 0.8, u * 0.4, -u * 3, 0, u * 3); },
  };

  // ============================================================ CHAPTER 4 · THE HIVE
  function cypress(c, x, y, hh, seed, u, col = INK) {
    const rng = mulberry32(seed); c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round';
    // a buttressed trunk flaring into the water
    c.beginPath(); c.moveTo(x - hh * 0.085, y); c.quadraticCurveTo(x - hh * 0.03, y - hh * 0.04, x - hh * 0.026, y - hh * 0.25); c.lineTo(x - hh * 0.016, y - hh * 0.78); c.lineTo(x + hh * 0.016, y - hh * 0.78); c.lineTo(x + hh * 0.026, y - hh * 0.25); c.quadraticCurveTo(x + hh * 0.032, y - hh * 0.04, x + hh * 0.09, y); c.closePath(); c.fill();
    for (let i = 0; i < 4; i++) { const kx = x + (rng() - 0.5) * hh * 0.5; c.beginPath(); c.moveTo(kx - hh * 0.015, y); c.lineTo(kx, y - hh * (0.03 + rng() * 0.04)); c.lineTo(kx + hh * 0.015, y); c.fill(); }
    // limbs reaching out to a flat, ragged crown
    const tops = [];
    for (let i = 0; i < 6; i++) { const by = y - hh * (0.45 + i * 0.07), dir = i % 2 ? 1 : -1, len = hh * (0.12 + rng() * 0.16), ex = x + dir * len, ey = by - hh * (0.04 + rng() * 0.06); c.lineWidth = Math.max(1, hh * 0.012); c.beginPath(); c.moveTo(x, by); c.quadraticCurveTo(x + dir * len * 0.5, by, ex, ey); c.stroke(); tops.push([ex, ey]); }
    tops.push([x, y - hh * 0.82]);
    c.beginPath();
    for (const [tx, ty] of tops) for (let j = 0; j < 9; j++) { const px = tx + (rng() - 0.5) * hh * 0.16, py = ty + (rng() - 0.6) * hh * 0.05, r = hh * (0.018 + rng() * 0.028); c.moveTo(px + r * 1.8, py); c.ellipse(px, py, r * 1.8, r, 0, 0, TAU); }
    c.fill();
    // Spanish moss hanging in long beards
    for (let i = 0; i < 26; i++) {
      const [tx, ty] = tops[Math.floor(rng() * tops.length)], mx = tx + (rng() - 0.5) * hh * 0.14, ml = hh * (0.06 + rng() * 0.2);
      c.lineWidth = Math.max(0.8, u * (0.2 + rng() * 0.35)); c.beginPath(); c.moveTo(mx, ty);
      for (let j = 1; j <= 4; j++) c.lineTo(mx + Math.sin(j * 1.7 + i) * u * 0.6, ty + ml * j / 4); c.stroke();
      if (rng() < 0.4) { c.beginPath(); c.moveTo(mx - u * 0.8, ty); c.lineTo(mx, ty + ml * 0.8); c.lineTo(mx + u * 0.8, ty); c.fill(); }
    }
  }

  S.swamp = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), wy = h * 0.66;
      nightSky(c, w, h, k, 0.66, 0.4, 50, 41);
      c.fillStyle = PAPER; c.beginPath(); c.arc(w * 0.62, h * 0.24, h * 0.1, 0, TAU); c.fill(); glow(c, w * 0.62, h * 0.24, h * 0.3, SPOT.green, 0.3);
      // far treeline in tone, near cypress in ink
      c.fillStyle = tone(c, 0.65, k); for (let x = 0; x < w; x += u * 4) { const th = h * (0.06 + Math.abs(Math.sin(x * 0.07)) * 0.06); c.fillRect(x, wy - th, u * 4.2, th); }
      // a shack on stilts
      const sx = w * 0.32, sy = wy - h * 0.06; c.fillStyle = INK; c.fillRect(sx - u * 9, sy - h * 0.12, u * 18, h * 0.12); poly(c, [[sx - u * 11, sy - h * 0.12], [sx, sy - h * 0.2], [sx + u * 11, sy - h * 0.12]]); c.fill();
      for (const dx of [-8, -2, 4, 8]) c.fillRect(sx + dx * u, sy, u * 0.8, h * 0.06);
      c.fillStyle = SPOT.amber; c.fillRect(sx - u * 4, sy - h * 0.08, u * 3, u * 3);
      // water: mirror the top half in tone
      c.beginPath(); c.rect(0, wy, w, h - wy); fillT(c, 0.75, k);
      c.save(); c.beginPath(); c.rect(0, wy, w, h - wy); c.clip(); c.translate(0, wy * 2); c.scale(1, -1); c.globalAlpha = 0.35;
      for (let i = 0; i < 6; i++) cypress(c, w * (0.02 + i * 0.2), wy, h * (0.45 + (i % 3) * 0.12), 40 + i, u);
      c.restore();
      c.strokeStyle = PAPER; c.lineWidth = u * 0.3; for (let i = 0; i < 18; i++) { const y = wy + (i / 18) ** 1.5 * (h - wy), x = (i * 97) % w; c.globalAlpha = 0.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.1, y); c.stroke(); } c.globalAlpha = 1;
      glow(c, w * 0.55, h * 0.84, w * 0.35, SPOT.green, 0.45);
      for (let i = 0; i < 6; i++) cypress(c, w * (0.02 + i * 0.2), wy + 2, h * (0.45 + (i % 3) * 0.12), 40 + i, u);
      // mist bands
      c.save(); c.globalAlpha = 0.35; c.fillStyle = PAPER; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(w * (i * 0.25), wy - h * 0.01, w * 0.18, h * 0.025, 0, 0, TAU); c.fill(); } c.restore();
      spot(c, SPOT.green, () => c.fillRect(0, 0, w, h), 0.25);
      vignette(c, w, h, 0.7, k);
    },
    anim(c, w, h, t) { motes(c, w, h * 0.7, t, 30, 11, '#d8ffb0', 1, unit(w, h) * 0.45, -unit(w, h) * 0.5, unit(w, h), unit(w, h) * 4); },
  };

  S.behemothRise = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), cx = w * 0.56, wy = h * 0.78;
      nightSky(c, w, h, k, 0.8, 0.6, 20, 43);
      glow(c, cx, h * 0.4, w * 0.6, SPOT.green, 0.55);
      // the hive: a mountain of flesh with ridged spines and a crown of eyes
      const s = Math.min(h / 100 * 0.72, w / 330);
      c.save(); c.translate(cx, wy);
      const mass = () => {
        c.beginPath(); c.moveTo(-60 * s * 1.6, 0);
        c.bezierCurveTo(-58 * s * 1.6, -40 * s, -40 * s * 1.6, -78 * s, 0, -84 * s);
        c.bezierCurveTo(40 * s * 1.6, -80 * s, 58 * s * 1.6, -40 * s, 62 * s * 1.6, 0); c.closePath();
        for (let i = 0; i < 11; i++) { const a = Math.PI * (0.12 + i * 0.076), r = 80 * s; const bx = Math.cos(Math.PI + a) * r * 1.35, by = Math.sin(Math.PI + a) * r * 0.98; sub(c, [[bx - 6 * s, by + 6 * s], [bx * 1.12, by * 1.18 - 8 * s], [bx + 6 * s, by + 6 * s]]); }
        // arms dragging out of the water
        sub(c, [[-80 * s, -30 * s], [-130 * s, -10 * s], [-150 * s, 4 * s], [-120 * s, 4 * s], [-70 * s, -12 * s]]);
        sub(c, [[80 * s, -34 * s], [126 * s, -18 * s], [146 * s, 4 * s], [116 * s, 4 * s], [70 * s, -14 * s]]);
      };
      c.save(); c.translate(-1.5 * s, -1.2 * s); mass(); c.fillStyle = SPOT.green; c.fill(); c.restore();
      mass(); c.fillStyle = INK; c.fill();
      // ribbing lit along the top
      c.strokeStyle = tone(c, 0.6, k); c.lineWidth = u * 0.6; for (let i = 1; i < 6; i++) { c.beginPath(); c.ellipse(0, 0, 90 * s * (i / 6) * 1.1, 78 * s * (i / 6), 0, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
      const rng = mulberry32(8);
      for (let i = 0; i < 14; i++) { const ex = (rng() - 0.5) * 90 * s, ey = -50 * s - rng() * 28 * s, r = s * (1 + rng() * 2.4); glow(c, ex, ey, r * 4, SPOT.green, 0.8); c.fillStyle = '#eafff0'; c.beginPath(); c.ellipse(ex, ey, r, r * 0.6, 0, 0, TAU); c.fill(); }
      c.restore();
      // water sheeting off it and spray where it breaks the surface
      c.strokeStyle = PAPER; c.lineCap = 'round';
      for (let i = 0; i < 50; i++) { const x = cx + (rng() - 0.5) * 170 * s, edge = 1 - Math.min(1, Math.abs(x - cx) / (95 * s)), y0 = wy - (12 + rng() * 30) * s * edge - 4 * s; c.globalAlpha = 0.35 + rng() * 0.45; c.lineWidth = u * (0.15 + rng() * 0.3); c.beginPath(); c.moveTo(x, y0); c.lineTo(x + (rng() - 0.5) * u, wy); c.stroke(); }
      c.globalAlpha = 1;
      c.beginPath(); c.rect(0, wy, w, h - wy); fillT(c, 0.85, k);
      c.strokeStyle = PAPER; c.lineWidth = u * 0.3; for (let i = 0; i < 14; i++) { const y = wy + (i / 14) ** 1.4 * (h - wy), x = (i * 131) % w; c.globalAlpha = 0.45; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.12, y); c.stroke(); } c.globalAlpha = 1;
      for (let i = 0; i < 9; i++) fog(c, cx + (i - 4) * u * 18, wy, u * 16, u * 4, 0.55);
      M.motionLines(c, cx - 90 * s, wy - 30 * s, 180 * s, 30 * s, -Math.PI / 2, 30, 'rgba(242,238,228,0.5)', 17);
      // the pier with three tiny figures
      c.fillStyle = INK; c.fillRect(0, h * 0.9, w * 0.34, h * 0.03); for (let x = u * 2; x < w * 0.34; x += u * 8) c.fillRect(x, h * 0.9, u * 1.2, h * 0.1);
      figure(c, w * 0.12, h * 0.9, h * 0.13, 'voss', { pose: 'point', rim: SPOT.green }); figure(c, w * 0.19, h * 0.9, h * 0.12, 'okafor', { rim: SPOT.green }); figure(c, w * 0.26, h * 0.9, h * 0.135, 'moreno', { rim: SPOT.green });
      vignette(c, w, h, 0.6, k);
    },
    anim(c, w, h, t) { const u = unit(w, h); glow(c, w * 0.56, h * 0.25, u * (30 + 10 * pulse(t, 1.5)), SPOT.green, 0.25); motes(c, w, h * 0.8, t, 30, 12, PAPER, 0.6, u * 0.3, u * 6, 0); },
  };

  S.trio = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), hy = h * 0.72;
      nightSky(c, w, h, k, 0.75, 0.15, 30, 47);
      glow(c, w * 0.5, hy, w * 0.6, SPOT.green, 0.7);
      rays(c, w * 0.5, hy, 30, w, 0.18, 21, PAPER, Math.PI, TAU);
      // the hive on the horizon
      c.fillStyle = INK; c.beginPath(); c.ellipse(w * 0.5, hy, w * 0.12, h * 0.16, 0, Math.PI, TAU); c.fill();
      hills(c, w, h, hy + h * 0.02, h * 0.01, 3, tone(c, 0.8, k));
      // a ridge and the three of them from behind
      c.fillStyle = INK; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * 0.84); c.quadraticCurveTo(w * 0.5, h * 0.76, w, h * 0.86); c.lineTo(w, h); c.fill();
      for (const [x, kind, hh, f, pose] of [[0.22, 'voss', 0.44, 1, 'stand'], [0.4, 'okafor', 0.42, 1, 'stand'], [0.6, 'laila', 0.44, -1, 'stand'], [0.8, 'moreno', 0.47, -1, 'gun']]) figure(c, w * x, h * 0.84, h * hh, kind, { face: f, rim: SPOT.green, pose });
      vignette(c, w, h, 0.6, k);
    },
    anim(c, w, h, t) { glow(c, w * 0.5, h * 0.62, unit(w, h) * (22 + 6 * pulse(t, 2)), SPOT.green, 0.3); },
  };

  S.horde = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), hy = h * 0.34;
      nightSky(c, w, h, k, 0.34, 0.45, 20, 53);
      glow(c, w * 0.5, hy, w * 0.55, SPOT.red, 0.65);
      c.beginPath(); c.rect(0, hy, w, h); fillT(c, 0.55, k);
      // rank upon rank: tiny at the horizon, mist between, huge in front
      const rng = mulberry32(19), rows = 9;
      for (let row = 0; row < rows; row++) {
        const f = row / (rows - 1), y = lerp(hy + h * 0.015, h * 1.05, f ** 1.7), sz = lerp(h * 0.035, h * 0.62, f ** 1.9), n = Math.round(lerp(70, 4, f ** 0.8));
        for (let i = 0; i < n; i++) {
          const x = (i + 0.2 + rng() * 0.6) / n * w * 1.1 - w * 0.05, z = sz * (0.85 + rng() * 0.3), fc = rng() < 0.5 ? 1 : -1;
          if (f > 0.45) figure(c, x, y, z, 'zombie', { face: fc, eyes: SPOT.red, rim: f > 0.8 ? SPOT.red : null, adj: { lean: 0.25 + rng() * 0.3, head: 0.2 + rng() * 0.3 } });
          else M.zombie(c, x, y, z, { face: fc, lean: 0.15 + rng() * 0.35, eyes: SPOT.red });
        }
        if (row < rows - 2) fog(c, w / 2, y + sz * 0.05, w * 0.7, sz * 0.5, 0.35);
      }
      spot(c, SPOT.red, () => c.fillRect(0, 0, w, h * 0.6), 0.3);
      vignette(c, w, h, 0.6, k);
    },
  };

  S.explosion = {
    base(c, w, h, o) {
      const k = cellOf(w, h), u = unit(w, h), cx = w * 0.5, cy = h * 0.55, col = SPOT[o.spot || 'orange'];
      paper(c, w, h);
      radialTone(c, cx, cy, u * 30, Math.hypot(w, h) * 0.6, 0, 1, k, [0, 0, w, h]);
      M.focusLines(c, cx, cy, w, h, 160, u * 40, INK, 37);
      glow(c, cx, cy, u * 75, col, 0.8);
      // a ring of dark smoke, then flame tongues bursting through it, then the white core
      const rng = mulberry32(5);
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + rng() * 0.3, d = u * 30; cloud(c, cx + Math.cos(a) * d * 1.4, cy + Math.sin(a) * d * 0.85, u * (9 + rng() * 5), 400 + i, 0.75, k, 8, u * 0.3, 0.3); }
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + rng() * 0.2; c.save(); c.translate(cx + Math.cos(a) * u * 14, cy + Math.sin(a) * u * 9); c.rotate(a + Math.PI / 2); flame(c, 0, 0, u * (5 + rng() * 4), u * (16 + rng() * 18), 600 + i); c.restore(); c.fillStyle = PAPER; c.fill(); spot(c, col, () => c.fill(), 0.55); c.strokeStyle = INK; c.lineWidth = u * 0.3; c.stroke(); }
      cloudPath(c, cx, cy, u * 22, 7, 10, 0.75); c.fillStyle = '#fff8e8'; c.fill();
      glow(c, cx, cy, u * 30, '#fff8e0', 1); glow(c, cx, cy, u * 18, '#ffffff', 1);
      for (let i = 0; i < 24; i++) { const a = rng() * TAU, d = u * (40 + rng() * 40); shard(c, cx + Math.cos(a) * d * 1.4, cy + Math.sin(a) * d, u * (1 + rng() * 2.4), rng() * 6, 500 + i, 1, k, u * 0.3); }
      // soldiers thrown flat in the foreground
      c.fillStyle = INK; c.fillRect(0, h * 0.9, w, h * 0.1);
      figure(c, w * 0.12, h * 0.95, h * 0.28, 'soldier', { pose: 'kneel', rim: col, adj: { ua1: 2.6, la1: 1.2, head: 0.8 } });
      figure(c, w * 0.86, h * 0.95, h * 0.3, 'moreno', { pose: 'kneel', rim: col, face: -1, adj: { ua1: 2.5, la1: 1.3, head: 0.8 } });
      spot(c, col, () => c.fillRect(0, 0, w, h), 0.35);
    },
    anim(c, w, h, t) { glow(c, w * 0.5, h * 0.55, unit(w, h) * (30 + 10 * pulse(t, 16)), '#fff8e0', 0.4); },
  };

  S.injection = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), cx = w * 0.62, cy = h * 0.5;
      c.fillStyle = INK; c.fillRect(0, 0, w, h);
      // the heart of the hive: a ribbed organic wall threaded with veins
      c.beginPath(); c.ellipse(cx, cy, w * 0.42, h * 0.6, 0, 0, TAU); fillT(c, 0.6, k);
      c.save(); c.beginPath(); c.ellipse(cx, cy, w * 0.42, h * 0.6, 0, 0, TAU); c.clip();
      radialTone(c, cx, cy, 0, w * 0.42, 0.2, 1, k, [cx - w * 0.42, 0, w * 0.84, h]);
      const rng = mulberry32(61); c.strokeStyle = INK; c.lineCap = 'round';
      for (let i = 0; i < 14; i++) { const a = rng() * TAU; c.lineWidth = u * (0.6 + rng()); c.beginPath(); let x = cx, y = cy, an = a; c.moveTo(x, y); for (let j = 0; j < 10; j++) { an += (rng() - 0.5) * 0.6; x += Math.cos(an) * u * 5; y += Math.sin(an) * u * 5; c.lineTo(x, y); } c.stroke(); }
      c.restore();
      glow(c, cx, cy, w * 0.55, SPOT.green, 0.95);
      rays(c, cx, cy, 60, Math.hypot(w, h), 0.4, 8);
      glow(c, cx, cy, u * 34, '#eafff0', 1); glow(c, cx, cy, u * 14, '#ffffff', 1);
      // Okafor, backlit, driving the core home with both hands
      const { hand } = figure(c, w * 0.3, h * 1.02, h * 0.72, 'okafor', { pose: 'thrust', rim: '#eafff0' });
      c.strokeStyle = INK; c.lineWidth = u * 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(hand[0] - u * 3, hand[1] + u); c.lineTo(cx - u * 10, cy + u * 2); c.stroke();
      c.strokeStyle = SPOT.green; c.lineWidth = u * 1.2; c.beginPath(); c.moveTo(hand[0] + u * 2, hand[1]); c.lineTo(cx - u * 10, cy + u * 2); c.stroke();
      c.globalAlpha = 0.5; M.motionLines(c, 0, 0, w * 0.5, h, -0.3, 16, PAPER, 9); c.globalAlpha = 1;
      vignette(c, w, h, 0.6, k);
    },
    anim(c, w, h, t) { glow(c, w * 0.62, h * 0.5, unit(w, h) * (24 + 14 * pulse(t, 8)), SPOT.green, 0.5); },
  };

  S.sunrise = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), hy = h * 0.66;
      paper(c, w, h); vTone(c, 0, 0, w, hy, 0.55, 0, k);
      glow(c, w * 0.5, hy, w * 0.6, SPOT.amber, 0.8);
      c.fillStyle = PAPER; c.beginPath(); c.arc(w * 0.5, hy, h * 0.16, Math.PI, TAU); c.fill();
      rays(c, w * 0.5, hy, 40, w, 0.3, 61, PAPER, Math.PI, TAU);
      for (const [x, y, s] of [[0.3, 0.25, 1], [0.34, 0.22, 0.8], [0.27, 0.2, 0.7]]) { c.strokeStyle = INK; c.lineWidth = u * 0.4; c.beginPath(); c.moveTo(w * x - u * 2 * s, h * y); c.quadraticCurveTo(w * x - u * s, h * y - u * s, w * x, h * y); c.quadraticCurveTo(w * x + u * s, h * y - u * s, w * x + u * 2 * s, h * y); c.stroke(); }
      hills(c, w, h, hy, h * 0.015, 9, PAPER);
      c.save(); c.beginPath(); c.rect(0, hy - h * 0.03, w, h); c.clip(); hills(c, w, h, hy, h * 0.015, 9, tone(c, 0.55, k)); gradTone(c, 0, hy, 0, h, 0.2, 0.85, k, INK, [0, hy - h * 0.03, w, h]); c.restore();
      // the dead at rest across the field
      const rng = mulberry32(23); c.fillStyle = INK; c.strokeStyle = INK; c.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const y = hy + h * (0.05 + rng() * 0.26), x = rng() * w, z = ((y - hy) / h) * u * 22 + u * 2, d = rng() < 0.5 ? 1 : -1;
        c.beginPath(); c.ellipse(x, y, z * 1.1, z * 0.22, (rng() - 0.5) * 0.1, 0, TAU); c.fill();
        c.beginPath(); c.arc(x + d * z * 1.2, y - z * 0.05, z * 0.24, 0, TAU); c.fill();
        c.lineWidth = z * 0.14; c.beginPath(); c.moveTo(x + d * z * 0.6, y); c.lineTo(x + d * z * (0.9 + rng() * 0.5), y + z * 0.25); c.stroke();
      }
      figure(c, w * 0.72, h * 0.93, h * 0.34, 'soldier', { pose: 'sit', face: -1, rim: SPOT.amber });
      M.cornRow(c, w, h * 1.02, h * 0.2, 71);
      spot(c, SPOT.amber, () => c.fillRect(0, 0, w, h), 0.4);
    },
    anim(c, w, h, t) { motes(c, w, h * 0.7, t, 24, 61, '#fff6d8', 0.6, unit(w, h) * 0.3, -unit(w, h) * 0.6, unit(w, h) * 1.5, unit(w, h) * 2); },
  };


  // ============================================================ LAILA
  // through her rifle scope: a lens circle, crosshair and range marks over the target
  S.scope = {
    base(c, w, h, o) {
      const k = cellOf(w, h), u = unit(w, h), cx = w * 0.5, cy = h * 0.5, R = Math.min(w, h) * 0.46, hive = o.target === 'hive';
      c.fillStyle = INK; c.fillRect(0, 0, w, h);
      c.save(); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.clip();
      if (hive) {
        c.fillStyle = INK; c.fillRect(0, 0, w, h); radialTone(c, cx, cy, R * 0.3, R, 0.4, 1, k, [cx - R, cy - R, R * 2, R * 2]);
        const rng = mulberry32(3); c.strokeStyle = INK; c.lineCap = 'round';
        for (let i = 0; i < 12; i++) { c.lineWidth = u * (0.5 + rng()); crack(c, cx + (rng() - 0.5) * R * 1.8, cy + (rng() - 0.5) * R * 1.8, R * 0.5, rng() * TAU, 30 + i, u * 0.6, 1); }
        const ew = R * 0.62, eh = R * 0.3, lid = () => { c.beginPath(); c.moveTo(cx - ew, cy); c.quadraticCurveTo(cx, cy - eh * 1.8, cx + ew, cy); c.quadraticCurveTo(cx, cy + eh * 1.8, cx - ew, cy); c.closePath(); };
        glow(c, cx, cy, R * 0.9, SPOT.green, 0.8); lid(); c.fillStyle = '#e4ffe9'; c.fill();
        c.save(); lid(); c.clip(); glow(c, cx, cy, eh * 1.6, SPOT.green, 1); c.fillStyle = '#123018'; c.beginPath(); c.arc(cx, cy, eh * 0.95, 0, TAU); c.fill(); c.strokeStyle = SPOT.green; c.lineWidth = u * 0.4; for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; c.beginPath(); c.moveTo(cx + Math.cos(a) * eh * 0.3, cy + Math.sin(a) * eh * 0.3); c.lineTo(cx + Math.cos(a) * eh * 0.9, cy + Math.sin(a) * eh * 0.9); c.stroke(); } c.fillStyle = INK; c.beginPath(); c.ellipse(cx, cy, eh * 0.12, eh * 0.6, 0, 0, TAU); c.fill(); c.restore();
        lid(); c.strokeStyle = INK; c.lineWidth = u * 1.4; c.stroke();
      } else {
        paper(c, w, h); vTone(c, 0, cy - R, w, cy + R * 0.3, 0.55, 0.05, k);
        glow(c, cx + R * 0.4, cy + R * 0.1, R, SPOT.amber, 0.6);
        // the farmhouse porch and a dead man reaching for the door
        c.fillStyle = INK; c.fillRect(cx - R, cy + R * 0.28, R * 2, R); c.fillRect(cx + R * 0.15, cy - R * 0.5, R * 0.9, R * 0.8);
        c.fillStyle = SPOT.amber; c.fillRect(cx + R * 0.32, cy - R * 0.3, R * 0.18, R * 0.25);
        figure(c, cx - R * 0.02, cy + R * 0.32, R * 1.05, 'zombie', { rim: SPOT.amber, eyes: SPOT.red, adj: { head: 0.1 } });
      }
      // lens shading and a curved reflection
      radialTone(c, cx, cy, R * 0.7, R, 0, 1, k, [cx - R, cy - R, R * 2, R * 2]);
      c.strokeStyle = 'rgba(242,238,228,0.25)'; c.lineWidth = u * 2; c.beginPath(); c.arc(cx, cy, R * 0.85, Math.PI * 1.1, Math.PI * 1.45); c.stroke();
      c.restore();
      // the reticle
      const tx = hive ? cx : cx - R * 0.02 + R * 0.25, ty = hive ? cy : cy - R * 0.56;
      c.strokeStyle = INK; c.lineWidth = u * 0.5;
      c.beginPath(); c.moveTo(cx - R, ty); c.lineTo(tx - R * 0.08, ty); c.moveTo(tx + R * 0.08, ty); c.lineTo(cx + R, ty); c.moveTo(tx, cy - R); c.lineTo(tx, ty - R * 0.08); c.moveTo(tx, ty + R * 0.08); c.lineTo(tx, cy + R); c.stroke();
      c.lineWidth = u * 1.6; for (const [x0, y0, x1, y1] of [[cx - R, ty, cx - R * 0.6, ty], [cx + R * 0.6, ty, cx + R, ty], [tx, cy + R * 0.6, tx, cy + R]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
      c.fillStyle = INK; for (let i = 1; i <= 4; i++) for (const sd of [-1, 1]) { c.beginPath(); c.arc(tx + sd * i * R * 0.12, ty, u * 0.6, 0, TAU); c.fill(); c.beginPath(); c.arc(tx, ty + sd * i * R * 0.12, u * 0.6, 0, TAU); c.fill(); }
      c.strokeStyle = SPOT.red; c.lineWidth = u * 0.5; c.beginPath(); c.arc(tx, ty, R * 0.05, 0, TAU); c.stroke();
      c.strokeStyle = tone(c, 0.6, k); c.lineWidth = u * 2.4; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
      label(c, hive ? 'RNG 410 M' : 'RNG 350 M', cx + R * 0.55, cy + R * 0.85, u * 3, PAPER, 'center');
    },
    anim(c, w, h, t, o) { const R = Math.min(w, h) * 0.46; if (o.target === 'hive') glow(c, w / 2, h / 2, R * (0.25 + 0.06 * pulse(t, 4)), SPOT.green, 0.35); },
  };

  // Laila on the farmhouse roof at dusk, mid-shot
  S.sniperRoof = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), hy = h * 0.78;
      paper(c, w, h); vTone(c, 0, 0, w, hy, 0.7, 0.05, k);
      glow(c, w * 0.25, hy, w * 0.5, SPOT.amber, 0.75);
      c.fillStyle = PAPER; c.beginPath(); c.arc(w * 0.25, hy, h * 0.14, Math.PI, TAU); c.fill();
      rays(c, w * 0.25, hy, 30, w, 0.22, 5, PAPER, Math.PI, TAU);
      hills(c, w, h, hy, h * 0.01, 3); M.cornRow(c, w, hy + 4, h * 0.12, 11);
      // the roof ridge running up from the bottom right
      c.fillStyle = INK; poly(c, [[w * 0.32, h], [w * 0.62, h * 0.62], [w * 1.05, h * 0.74], [w * 1.05, h]]); c.fill();
      c.strokeStyle = PAPER; c.lineWidth = u * 0.4; for (let i = 1; i < 8; i++) { const f = i / 8; c.beginPath(); c.moveTo(lerp(w * 0.32, w * 0.62, f), lerp(h, h * 0.62, f)); c.lineTo(lerp(w * 0.32, w * 0.62, f) + w * 0.45, lerp(h, h * 0.62, f) + h * 0.12); c.globalAlpha = 0.35; c.stroke(); } c.globalAlpha = 1;
      c.fillRect(w * 0.84, h * 0.5, w * 0.05, h * 0.22);
      const { muzzle } = figure(c, w * 0.66, h * 0.645, h * 0.46, 'laila', { pose: 'aim', face: -1, rim: SPOT.amber });
      // the shot: a starburst at the muzzle and a smoke curl
      c.save(); c.translate(...muzzle); c.fillStyle = PAPER; poly(c, Array.from({ length: 14 }, (_, i) => { const a = i / 14 * TAU, r = (i % 2 ? 1 : 2.6) * u * 2.2; return [Math.cos(a) * r * 1.4, Math.sin(a) * r]; })); c.fill(); c.restore();
      glow(c, muzzle[0], muzzle[1], u * 16, SPOT.amber, 0.9);
      M.motionLines(c, 0, muzzle[1] - u * 1.2, muzzle[0] - u * 4, u * 2.4, Math.PI, 6, PAPER, 8);
      for (let i = 0; i < 3; i++) M.zombie(c, w * (0.08 + i * 0.09), hy + h * 0.04, h * 0.1, { rim: SPOT.amber, lean: i === 1 ? 1.2 : 0.3 });
      spot(c, SPOT.amber, () => c.fillRect(0, 0, w, h), 0.3);
      vignette(c, w, h, 0.55, k);
    },
  };

  // her forearm along the rifle stock, the butterfly tattoo on the inside of the arm
  S.tattoo = {
    base(c, w, h, o) {
      const k = cellOf(w, h), u = unit(w, h), col = SPOT[o.spot || 'amber'];
      c.fillStyle = INK; c.fillRect(0, 0, w, h);
      M.focusLines(c, w * 0.62, h * 0.5, w, h, 90, Math.min(w, h) * 0.5, tone(c, 0.35, k), 13);
      glow(c, w * 0.6, h * 0.4, w * 0.5, col, 0.4);
      // the rifle running across the frame: scope above, walnut stock below the arm
      c.save(); c.translate(w * 0.5, h * 0.5); c.rotate(-0.1);
      c.beginPath(); c.roundRect(-w * 0.62, -h * 0.4, w * 1.2, h * 0.14, h * 0.07); fillT(c, 0.85, k); c.strokeStyle = PAPER; c.lineWidth = u * 0.4; c.stroke();
      c.fillStyle = tone(c, 0.4, k); c.fillRect(-w * 0.5, -h * 0.37, w * 0.95, h * 0.025);
      c.fillStyle = INK; for (const x of [-0.25, 0.2]) c.fillRect(w * x, -h * 0.27, w * 0.05, h * 0.1);
      c.beginPath(); c.moveTo(-w * 0.62, -h * 0.17); c.lineTo(w * 0.62, -h * 0.2); c.lineTo(w * 0.62, h * 0.38); c.lineTo(-w * 0.62, h * 0.42); c.closePath(); fillT(c, 0.55, k);
      c.strokeStyle = INK; c.lineWidth = u * 0.6; c.stroke();
      c.lineWidth = u * 0.3; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(-w * 0.62, -h * 0.13 + i * h * 0.06); c.bezierCurveTo(-w * 0.2, -h * 0.16 + i * h * 0.065, w * 0.2, -h * 0.1 + i * h * 0.055, w * 0.62, -h * 0.16 + i * h * 0.06); c.stroke(); }
      c.restore();
      // the forearm, elbow off the lower left, wrist off the right edge
      const arm = () => { c.beginPath(); c.moveTo(-w * 0.05, h * 0.48); c.bezierCurveTo(w * 0.3, h * 0.34, w * 0.7, h * 0.3, w * 1.05, h * 0.33); c.lineTo(w * 1.05, h * 0.56); c.bezierCurveTo(w * 0.7, h * 0.55, w * 0.35, h * 0.68, -w * 0.05, h * 0.92); c.closePath(); };
      c.save(); c.translate(u * 1.5, u * 2); arm(); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fill(); c.restore();
      arm(); fillT(c, 0, k);
      c.save(); arm(); c.clip(); gradTone(c, 0, h * 0.42, 0, h * 0.9, 0, 0.75, k, INK, [0, h * 0.3, w, h * 0.65]);
      const rng = mulberry32(4); c.fillStyle = INK; for (let i = 0; i < 50; i++) { const x = rng() * w, y = h * (0.36 + rng() * 0.14); c.globalAlpha = 0.5; c.beginPath(); c.arc(x, y, u * 0.22, 0, TAU); c.fill(); } c.globalAlpha = 1;
      c.strokeStyle = PAPER; c.lineWidth = u * 0.5; c.beginPath(); c.moveTo(w * 0.1, h * 0.43); c.bezierCurveTo(w * 0.35, h * 0.35, w * 0.7, h * 0.33, w * 1.0, h * 0.35); c.stroke();
      c.restore();
      arm(); c.strokeStyle = INK; c.lineWidth = u * 0.8; c.stroke();
      // the butterfly, fine-line, its wings open along the arm
      c.save(); c.translate(w * 0.5, h * 0.45); c.rotate(-0.12); const b = Math.min(w, h) * 0.12;
      c.strokeStyle = INK; c.lineWidth = Math.max(1, u * 0.35); c.lineJoin = 'round';
      for (const sd of [-1, 1]) {
        c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(sd * b * 0.4, -b * 1.2, sd * b * 1.5, -b * 1.1, sd * b * 1.25, -b * 0.25); c.quadraticCurveTo(sd * b * 0.9, b * 0.1, 0, 0.05 * b); c.stroke();
        c.beginPath(); c.moveTo(0, b * 0.05); c.bezierCurveTo(sd * b * 0.9, b * 0.1, sd * b * 1.05, b * 0.8, sd * b * 0.55, b * 0.85); c.quadraticCurveTo(sd * b * 0.2, b * 0.75, 0, b * 0.15); c.stroke();
        c.lineWidth = Math.max(0.8, u * 0.22);
        for (const [x0, y0, x1, y1] of [[0.1, -0.05, 0.75, -0.75], [0.1, -0.02, 1.05, -0.45], [0.1, 0.1, 0.75, 0.55]]) { c.beginPath(); c.moveTo(sd * b * x0, b * y0); c.lineTo(sd * b * x1, b * y1); c.stroke(); }
        c.fillStyle = INK; for (const [x, y, r] of [[0.95, -0.6, 0.07], [1.1, -0.38, 0.05], [0.7, 0.62, 0.06]]) { c.beginPath(); c.arc(sd * b * x, b * y, b * r, 0, TAU); c.fill(); }
        c.lineWidth = Math.max(0.8, u * 0.25); c.beginPath(); c.moveTo(0, -b * 0.15); c.quadraticCurveTo(sd * b * 0.15, -b * 0.6, sd * b * 0.32, -b * 0.75); c.stroke();
      }
      c.fillStyle = INK; c.beginPath(); c.ellipse(0, b * 0.15, b * 0.07, b * 0.38, 0, 0, TAU); c.fill();
      c.restore();
    },
  };

  // the hive lashes out at Okafor as she runs for its heart
  S.tendril = {
    base(c, w, h) {
      const k = cellOf(w, h), u = unit(w, h), cx = w * 0.72, cy = h * 0.55;
      c.fillStyle = INK; c.fillRect(0, 0, w, h);
      glow(c, cx, cy, w * 0.45, SPOT.green, 0.85); rays(c, cx, cy, 40, w, 0.25, 4);
      glow(c, cx, cy, u * 20, '#eafff0', 1);
      // ribbed walls of the chamber
      c.strokeStyle = tone(c, 0.6, k); c.lineWidth = u * 1.2; for (let i = 1; i < 6; i++) { c.beginPath(); c.ellipse(cx, cy, w * 0.12 * i, h * 0.16 * i, 0, 0, TAU); c.stroke(); }
      // a tentacle slamming down across the frame, ridged and suckered
      const pts = [[-w * 0.08, -h * 0.05], [w * 0.3, h * 0.0], [w * 0.62, h * 0.12], [w * 0.62, h * 0.62]];
      const along = (t) => { const [a, b2, c2, d] = pts, m = 1 - t; return [m * m * m * a[0] + 3 * m * m * t * b2[0] + 3 * m * t * t * c2[0] + t * t * t * d[0], m * m * m * a[1] + 3 * m * m * t * b2[1] + 3 * m * t * t * c2[1] + t * t * t * d[1]]; };
      const side = [], other = [];
      for (let i = 0; i <= 30; i++) { const t = i / 30, p0 = along(t), p1 = along(Math.min(1, t + 0.01)), a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) + Math.PI / 2, r = lerp(u * 16, u * 2.5, t); side.push([p0[0] + Math.cos(a) * r, p0[1] + Math.sin(a) * r]); other.push([p0[0] - Math.cos(a) * r, p0[1] - Math.sin(a) * r]); }
      const tent = () => poly(c, [...side, ...other.reverse()]);
      c.save(); c.translate(-u * 0.8, -u * 0.6); tent(); c.fillStyle = SPOT.green; c.fill(); c.restore(); other.reverse();
      tent(); fillT(c, 0.72, k); other.reverse();
      c.save(); tent(); c.clip(); other.reverse(); c.fillStyle = INK; poly(c, [...side, ...side.map((p, i) => [lerp(p[0], other[i][0], 0.45), lerp(p[1], other[i][1], 0.45)]).reverse()]); c.fill(); other.reverse(); c.restore(); other.reverse();
      tent(); c.strokeStyle = INK; c.lineWidth = u * 0.8; c.stroke(); other.reverse();
      for (let i = 2; i < 28; i += 2) { const p = other[i], r = u * lerp(2.6, 0.8, i / 30); c.beginPath(); c.ellipse(p[0], p[1], r, r * 0.7, 0, 0, TAU); c.fillStyle = PAPER; c.fill(); c.strokeStyle = INK; c.lineWidth = u * 0.4; c.stroke(); c.beginPath(); c.ellipse(p[0], p[1], r * 0.45, r * 0.3, 0, 0, TAU); c.fillStyle = INK; c.fill(); }
      M.motionLines(c, w * 0.2, h * 0.1, w * 0.5, h * 0.6, 1.9, 24, PAPER, 6);
      // Okafor sprinting for the light, core in hand
      figure(c, w * 0.42, h * 0.97, h * 0.42, 'okafor', { pose: 'run', prop: 'case', rim: SPOT.green });
      c.fillStyle = INK; c.fillRect(0, h * 0.96, w, h * 0.04);
      vignette(c, w, h, 0.6, k);
    },
    anim(c, w, h, t) { glow(c, w * 0.72, h * 0.55, unit(w, h) * (18 + 8 * pulse(t, 7)), SPOT.green, 0.4); },
  };

  S.blank = { base(c, w, h, o) { c.fillStyle = o.ink ? INK : PAPER; c.fillRect(0, 0, w, h); } };

  return S;
})();
