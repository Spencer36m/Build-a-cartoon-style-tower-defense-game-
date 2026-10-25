'use strict';
// ============================================================
// Floating globe for the world map. The planet is shaded per pixel from a procedural
// texture: oceans, coastlines, forests, deserts, ice caps and a separate cloud layer.
// ============================================================
const Globe = (() => {
  const TW = 768, TH = 384;
  const TILT = 0.38;
  let tex = null, clouds = null;
  let lut = null, lutN = 0, img = null, off = null, offCtx = null;
  let canvas = null, ctx = null, dpr = 1, cssSize = 0;
  let rot = 0, target = null, vel = 0, cloudRot = 0, running = false, last = 0;
  let selected = 0, drag = null, onPick = null, labels = [];

  const sph = (lat, lon) => [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
  function noise3(n, p, s) {
    return (n(p[0] * s + 3.1, p[1] * s + 7.7) + n(p[1] * s + 11.3, p[2] * s + 1.9) + n(p[2] * s + 5.5, p[0] * s + 13.1)) / 3;
  }
  function fbm3(n, p, s, oct) {
    let v = 0, a = 0.5, f = s, norm = 0;
    for (let i = 0; i < oct; i++) { v += a * noise3(n, p, f); norm += a; a *= 0.5; f *= 2.1; }
    return v / norm;
  }

  // The planet texture takes a moment to compute, so it is built a few rows at a time in the background.
  let built = 0, building = false;
  let nE, nM, nC, C;
  function prepare() {
    if (building || built >= TH) return;
    building = true;
    nE = makeNoise(4242); nM = makeNoise(777); nC = makeNoise(31337);
    tex = new Uint8ClampedArray(TW * TH * 3);
    clouds = new Uint8Array(TW * TH);
    const col = (h) => hexRgb(h);
    C = {
      deep: col('#0a2240'), shallow: col('#1d5a80'), beach: col('#b9a476'), grass: col('#4f6d33'),
      forest: col('#2c4422'), desert: col('#a88d5a'), rock: col('#6e675c'), snow: col('#e9eff3'), tundra: col('#7d8670'),
    };
    const step = () => {
      const end = Math.min(TH, built + 12);
      buildRows(built, end);
      built = end;
      if (built < TH) setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }
  function buildRows(y0, y1) {
    const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    for (let y = y0; y < y1; y++) {
      const lat = (0.5 - (y + 0.5) / TH) * Math.PI;
      const alat = Math.abs(lat) / (Math.PI / 2);
      for (let x = 0; x < TW; x++) {
        const lon = ((x + 0.5) / TW) * TAU - Math.PI;
        const p = sph(lat, lon);
        let e = fbm3(nE, p, 1.6, 6);
        e += (fbm3(nE, p, 0.7, 2) - 0.5) * 0.35;
        const m = fbm3(nM, p, 2.2, 4);
        let c;
        const sea = 0.5;
        if (e < sea) c = lerp3(C.deep, C.shallow, clamp((e - 0.3) / (sea - 0.3), 0, 1) ** 2);
        else {
          const h = (e - sea) / (1 - sea);
          if (h < 0.03) c = C.beach;
          else if (alat > 0.72 || h > 0.42) c = lerp3(C.rock, C.snow, clamp((alat - 0.72) * 6 + (h - 0.42) * 5, 0, 1));
          else if (alat > 0.58) c = lerp3(C.tundra, C.forest, clamp((0.72 - alat) * 6, 0, 1));
          else if (alat < 0.33 && m < 0.48) c = lerp3(C.desert, C.grass, clamp((m - 0.38) * 8, 0, 1));
          else c = lerp3(C.grass, C.forest, clamp((m - 0.45) * 5, 0, 1));
          c = lerp3(c, C.rock, clamp((h - 0.25) * 2, 0, 0.5));
        }
        if (alat > 0.88) c = lerp3(c, C.snow, clamp((alat - 0.88) * 10, 0, 1));
        const i = (y * TW + x) * 3;
        tex[i] = c[0]; tex[i + 1] = c[1]; tex[i + 2] = c[2];
        const cl = fbm3(nC, p, 2.6, 5);
        clouds[y * TW + x] = clamp((cl - 0.52) * 4, 0, 1) * 220;
      }
    }
  }

  // Per-pixel latitude, base longitude and lighting for a disk of n pixels.
  function buildLut(n) {
    lutN = n;
    const entries = [];
    const L = [-0.55, 0.45, 0.7]; const ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
    const ct = Math.cos(TILT), st = Math.sin(TILT);
    for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
      const nx = ((px + 0.5) / n) * 2 - 1, ny = 1 - ((py + 0.5) / n) * 2;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2);
      // un-tilt the view to get the point on the planet
      const y2 = ny * ct + nz * st, z2 = -ny * st + nz * ct;
      const lat = Math.asin(clamp(y2, -1, 1)), lon0 = Math.atan2(nx, z2);
      const lam = nx * L[0] + ny * L[1] + nz * L[2];
      const shade = clamp(0.08 + Math.max(0, lam) * 1.05, 0, 1.15);
      const edge = clamp((1 - Math.sqrt(r2)) * n * 0.5, 0, 1);
      const rim = Math.pow(1 - nz, 2.5);
      const spec = Math.pow(Math.max(0, lam), 24) * 0.35;
      const tyf = clamp((0.5 - lat / Math.PI) * TH - 0.5, 0, TH - 1);
      entries.push([py * n + px, Math.floor(tyf), tyf, lon0, shade, edge, rim, spec]);
    }
    lut = entries;
    img = new ImageData(n, n);
    off = document.createElement('canvas'); off.width = off.height = n;
    offCtx = off.getContext('2d');
  }

  function renderPlanet() {
    const d = img.data;
    d.fill(0);
    for (const [pi, ty, tyf, lon0, shade, edge, rim, spec] of lut) {
      let u = (lon0 + rot + Math.PI) / TAU; u -= Math.floor(u);
      // bilinear sample so coastlines stay smooth when magnified
      const fx = u * TW - 0.5, x0 = Math.floor(fx), ax = fx - x0;
      const xa = (x0 + TW) % TW, xb = (x0 + 1) % TW;
      const y0 = ty, yb = Math.min(TH - 1, ty + 1), ay = tyf - ty;
      const i00 = (y0 * TW + xa) * 3, i10 = (y0 * TW + xb) * 3, i01 = (yb * TW + xa) * 3, i11 = (yb * TW + xb) * 3;
      const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay;
      let r = tex[i00] * w00 + tex[i10] * w10 + tex[i01] * w01 + tex[i11] * w11;
      let g = tex[i00 + 1] * w00 + tex[i10 + 1] * w10 + tex[i01 + 1] * w01 + tex[i11 + 1] * w11;
      let b = tex[i00 + 2] * w00 + tex[i10 + 2] * w10 + tex[i01 + 2] * w01 + tex[i11 + 2] * w11;
      const water = b > r + 20 && b > g;
      let cu = (lon0 + cloudRot + Math.PI) / TAU; cu -= Math.floor(cu);
      const ca = clouds[ty * TW + Math.min(TW - 1, Math.floor(cu * TW))] / 255;
      r = lerp(r, 240, ca); g = lerp(g, 244, ca); b = lerp(b, 248, ca);
      r *= shade; g *= shade; b *= shade;
      if (water) { r += spec * 255; g += spec * 255; b += spec * 255; }
      r = lerp(r, 110, rim * 0.6); g = lerp(g, 170, rim * 0.6); b = lerp(b, 255, rim * 0.7);
      const o = pi * 4;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255 * edge;
    }
    offCtx.putImageData(img, 0, 0);
  }

  function project(lat, lon) {
    const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180 - rot;
    const x = Math.cos(la) * Math.sin(lo), y = Math.sin(la), z = Math.cos(la) * Math.cos(lo);
    const ct = Math.cos(TILT), st = Math.sin(TILT);
    const vy = y * ct - z * st, vz = y * st + z * ct;
    return { x, y: vy, z: vz };
  }

  function draw() {
    const S = cssSize;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, S, S);
    const R = S * 0.36, cx = S / 2, cy = S / 2;
    // atmosphere halo
    const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.28);
    halo.addColorStop(0, 'rgba(90,160,255,0.45)'); halo.addColorStop(1, 'rgba(90,160,255,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R * 1.28, 0, TAU); ctx.fill();
    if (built < TH) {
      ctx.fillStyle = '#0b1a2c'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(227,168,62,0.9)'; ctx.font = `700 14px ${FONT_DISPLAY}`; ctx.textAlign = 'center';
      ctx.fillText(`MAPPING THE PLANET ${Math.round((built / TH) * 100)}%`, cx, cy);
      return;
    }
    renderPlanet();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, cx - R, cy - R, R * 2, R * 2);
    // night side
    const night = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.4, R * 0.2, cx, cy, R * 1.02);
    night.addColorStop(0, 'rgba(0,0,10,0)'); night.addColorStop(0.75, 'rgba(0,0,10,0)'); night.addColorStop(1, 'rgba(0,0,10,0.35)');
    ctx.fillStyle = night; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

    labels = [];
    WORLDS.forEach((w, i) => {
      const p = project(w.lat, w.lon);
      if (p.z < -0.05) return;
      const sx = cx + p.x * R, sy = cy - p.y * R;
      const fade = clamp(p.z * 4, 0, 1);
      const sel = i === selected;
      const open = Globe.isOpen ? Globe.isOpen(i) : true;
      ctx.globalAlpha = fade;
      // marker
      const pulse = sel ? 1 + Math.sin(performance.now() / 300) * 0.25 : 1;
      ctx.beginPath(); ctx.arc(sx, sy, 9 * pulse, 0, TAU);
      ctx.strokeStyle = sel ? 'rgba(240,180,70,0.9)' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(sx, sy, 4, 0, TAU);
      ctx.fillStyle = open ? (sel ? '#f0b446' : '#e7e3d8') : '#6b7178'; ctx.fill();
      // name tag
      const text = w.short.toUpperCase();
      ctx.font = `700 ${sel ? 14 : 12}px ${FONT_DISPLAY}`;
      const tw = ctx.measureText(text).width + 20;
      const lx = sx + 14, ly = sy - 26;
      ctx.beginPath(); ctx.moveTo(sx + 4, sy - 4); ctx.lineTo(lx, ly + 10); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = sel ? 'rgba(240,180,70,0.95)' : 'rgba(14,17,20,0.85)';
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + tw - 6, ly); ctx.lineTo(lx + tw, ly + 6); ctx.lineTo(lx + tw, ly + 20); ctx.lineTo(lx, ly + 20); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = sel ? 'rgba(255,220,150,0.9)' : 'rgba(255,255,255,0.18)'; ctx.stroke();
      ctx.fillStyle = sel ? '#14100a' : open ? '#e7e3d8' : '#8b9196';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(text, lx + 10, ly + 10.5);
      ctx.globalAlpha = 1;
      labels.push({ i, x: sx, y: sy, x2: lx + tw, y1: ly, y2: ly + 20 });
    });
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (drag) { /* rotation follows the finger */ }
    else if (target != null) {
      let d = target - rot;
      d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
      rot += d * Math.min(1, dt * 4);
      if (Math.abs(d) < 0.002) target = null;
    } else {
      rot += vel * dt; vel *= 0.95;
      rot += dt * 0.05;
    }
    cloudRot += dt * 0.07;
    draw();
    requestAnimationFrame(frame);
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    cssSize = Math.max(120, Math.round(Math.min(r.width, r.height)));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssSize * dpr); canvas.height = Math.round(cssSize * dpr);
    const n = Math.min(380, Math.round(cssSize * 0.72 * Math.min(dpr, 1.5)));
    if (n !== lutN) buildLut(n);
  }

  function hit(ev) {
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    for (const l of labels) {
      if (Math.hypot(x - l.x, y - l.y) < 18 || (x >= l.x && x <= l.x2 && y >= l.y1 - 4 && y <= l.y2 + 4)) return l.i;
    }
    return -1;
  }

  return {
    isOpen: null,
    prepare,
    init(cv, pick) {
      canvas = cv; ctx = cv.getContext('2d'); onPick = pick;
      prepare();
      cv.addEventListener('pointerdown', (ev) => {
        drag = { x: ev.clientX, rot, moved: false, t: performance.now() };
        cv.setPointerCapture(ev.pointerId);
      });
      cv.addEventListener('pointermove', (ev) => {
        if (!drag) return;
        const dx = ev.clientX - drag.x;
        if (Math.abs(dx) > 4) drag.moved = true;
        const prev = rot;
        rot = drag.rot - dx / (cssSize * 0.36) * 1.1;
        vel = (rot - prev) * 30;
        target = null;
      });
      cv.addEventListener('pointerup', (ev) => {
        const d = drag; drag = null;
        if (d && !d.moved) { const i = hit(ev); if (i >= 0 && onPick) onPick(i); }
      });
      cv.addEventListener('pointercancel', () => { drag = null; });
      new ResizeObserver(() => resize()).observe(cv);
      resize();
    },
    select(i, instant) {
      selected = i;
      target = (WORLDS[i].lon * Math.PI) / 180;
      if (instant) { rot = target; target = null; }
    },
    start() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); },
    stop() { running = false; },
  };
})();
