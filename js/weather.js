'use strict';
// ============================================================
// Weather: every level runs its own forecast. Episodes follow each other (a shower builds into
// a thunderstorm, the storm spins up a tornado, it passes and the sky clears), each easing in
// and out over several seconds. The look is driven by a handful of channels (rain, snow, fog,
// dust, embers, darkness, wind...) that glide towards whatever the current episode wants.
// Ground effects (wet roads, splashes) go under the units, the sky (rain, snow, fog, lightning,
// the tornado) over them.
// ============================================================
const WEATHER = (() => {
  // what each kind of weather asks of the channels
  const KINDS = {
    clear:    { label: 'Clear skies', icon: 'sun', ch: { cloud: 0.25 }, wind: 0.15, toast: 'Skies clearing' },
    rain:     { label: 'Rain', icon: 'rain', ch: { rain: 0.7, dark: 0.12, cloud: 0.55 }, wind: 0.3, toast: 'Rain moving in' },
    storm:    { label: 'Thunderstorm', icon: 'bolt', ch: { rain: 1.3, dark: 0.3, lightning: 1, cloud: 0.9 }, wind: 0.65, toast: 'Thunderstorm overhead' },
    tornado:  { label: 'Tornado', icon: 'twister', ch: { rain: 0.55, dark: 0.36, lightning: 0.45, cloud: 1, debris: 1, dust: 0.25 }, wind: 1, toast: 'Tornado warning', big: true },
    dust:     { label: 'Dust storm', icon: 'wind', ch: { dust: 1, haze: 0.85, dark: 0.08 }, wind: 1, toast: 'Dust storm incoming', big: true },
    fog:      { label: 'Fog', icon: 'fog', ch: { fog: 1, cloud: 0.2 }, wind: 0.1, toast: 'Fog rolling in' },
    mist:     { label: 'Swamp mist', icon: 'fog', ch: { fog: 0.8, flies: 1 }, wind: 0.08, toast: 'Mist rising off the water' },
    snow:     { label: 'Snow', icon: 'flake', ch: { snow: 0.8, cloud: 0.45, dark: 0.07 }, wind: 0.25, toast: 'Snow starting to fall' },
    blizzard: { label: 'Blizzard', icon: 'flake', ch: { snow: 1.7, fog: 0.55, dark: 0.06, cloud: 0.7, drift: 1 }, wind: 1, toast: 'Blizzard warning', big: true },
    embers:   { label: 'Ash storm', icon: 'flame', ch: { embers: 1, dark: 0.06, smoke: 0.8 }, wind: 0.4, toast: 'Ash and embers falling', big: true },
    sandstorm: { label: 'Sandstorm', icon: 'wind', ch: { dust: 1.45, haze: 1.15, dark: 0.12 }, wind: 1, toast: 'Sandstorm incoming', big: true },
    heat:     { label: 'Heat haze', icon: 'sun', ch: { heat: 1, cloud: 0.05 }, wind: 0.1, toast: 'The air is shimmering with heat' },
    acid:     { label: 'Acid rain', icon: 'rain', ch: { rain: 0.9, acid: 1, fog: 0.25, dark: 0.16, cloud: 0.6 }, wind: 0.35, toast: 'Acid rain', big: true },
  };
  const CHANNELS = ['rain', 'snow', 'fog', 'dust', 'haze', 'dark', 'lightning', 'cloud', 'embers', 'acid', 'flies', 'debris', 'drift', 'smoke', 'heat'];
  // how likely each kind is in each world, and how long it lasts (seconds)
  const FORECAST = {
    farmland: { clear: 3, rain: 3, storm: 2, tornado: 1.4, dust: 1.6, fog: 1.4 },
    graveyard: { clear: 1.2, fog: 3, rain: 2.4, storm: 2, embers: 1.6 },
    tundra: { clear: 2, snow: 4, blizzard: 2.2, fog: 1.4 },
    swamp: { clear: 1.4, mist: 3, rain: 2.4, storm: 2, acid: 1.6 },
    desert: { clear: 2.4, heat: 3, sandstorm: 2.4, dust: 1, storm: 0.5 },
    city: { clear: 2, rain: 3, storm: 2, fog: 1.6, embers: 1.4, acid: 0.6 },
  };
  const LAST = { clear: [30, 55], rain: [40, 65], storm: [35, 55], tornado: [34, 42], dust: [35, 50], fog: [40, 65], mist: [45, 75], snow: [50, 80], blizzard: [30, 45], embers: [35, 50], acid: [35, 50], sandstorm: [32, 48], heat: [45, 70] };
  const LINES = {
    tornado: [['voss', 'Twister on the radar, coming straight across the line. Brace and keep firing.'], ['moreno', 'Is that a cow? That is a cow. Keep shooting!']],
    storm: [['moreno', 'Lightning! Heads down, fingers on the trigger.'], ['voss', 'Storm cell right on top of us. Hold the line.']],
    dust: [['moreno', 'Dust storm! Can barely see the road. Trust the guns.'], ['voss', 'Visibility is going. Towers will hold if you let them.']],
    blizzard: [['voss', 'Whiteout rolling in. They will walk right out of the snow at you.'], ['moreno', 'Blizzard! I cannot feel my trigger finger.']],
    acid: [['okafor', 'Acid rain. That runoff is what is swelling the dead out here.'], ['moreno', 'The rain is smoking. That is not normal rain.']],
    sandstorm: [['moreno', 'Sandstorm! It is in my teeth, my eyes, my rifle...'], ['voss', 'Wall of sand coming in. They will be right on top of us before you see them.']],
    heat: [['okafor', 'Heat is cooking the air. Do not trust your eyes on the far road.'], ['moreno', 'It is so hot the zombies are steaming.']],
    embers: [['laila', 'Ash coming down like snow. Something big is burning out there.'], ['moreno', 'It is raining fire. Of course it is.']],
  };

  let M = null, L = null, hooks = {}, world = 'farmland', fcast = null;
  let plan = [], ep = 0, epT = 0, time = 0;
  const cur = {}, tgt = {};
  let wind = 0.2, windTgt = 0.2, windA = 0, wet = 0, flash = 0, bolt = null, nextStrike = 5, twister = null, toast = null, soundT = 0;
  let drops = [], splashes = [], flakes = [], streaks = [], motes = [], weeds = [], wetCv = null;

  // ---------- textures ----------
  function tex(key, S, paint) {
    if (TEX[key]) return TEX[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    paint(cv.getContext('2d'), S);
    TEX[key] = cv;
    return cv;
  }
  // soft tiling cloud: used for fog banks, dust haze and drifting cloud shadows
  function cloudTex(rgb) {
    return tex('wxCloud' + rgb.join(','), 256, (g, S) => {
      const img = g.createImageData(S, S), n = makeNoise(77);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const fx = x / S, fy = y / S, f = 64;
        const v = fbm(n, x / f, y / f, 3) * (1 - fx) * (1 - fy) + fbm(n, (x - S) / f, y / f, 3) * fx * (1 - fy) + fbm(n, x / f, (y - S) / f, 3) * (1 - fx) * fy + fbm(n, (x - S) / f, (y - S) / f, 3) * fx * fy;
        const i = (y * S + x) * 4, a = clamp((v - 0.36) / 0.34, 0, 1);
        img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = a * a * 255;
      }
      g.putImageData(img, 0, 0);
    });
  }
  const dot = (key, inner, outer) => tex(key, 32, (g, S) => { g.fillStyle = radial(g, S / 2, S / 2, S / 2, inner, outer, 0, 0); g.fillRect(0, 0, S, S); });
  // the swirling arms of a vortex, seen from above
  const vortex = () => tex('wxVortex', 256, (g, S) => {
    const rng = mulberry32(31), cx = S / 2;
    for (let arm = 0; arm < 7; arm++) {
      const a0 = (arm / 7) * TAU;
      for (let k = 0; k < 60; k++) {
        const t = k / 60, r = t * S * 0.48, a = a0 + t * 4.2, x = cx + Math.cos(a) * r, y = cx + Math.sin(a) * r, rr = 3 + t * 16;
        const al = Math.sin(t * Math.PI) * 0.3 * (0.6 + rng() * 0.6);
        g.fillStyle = radial(g, x, y, rr, `rgba(255,255,255,${al})`, 'rgba(255,255,255,0)', 0, 0); g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
    }
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = radial(g, cx, cx, cx, 'rgba(0,0,0,1)', 'rgba(0,0,0,0)', 0, 0); g.fillRect(0, 0, S, S);
  });
  function tinted(key, base, rgb) {
    return tex(key, base.width, (g) => { g.drawImage(base, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = `rgb(${rgb.join(',')})`; g.fillRect(0, 0, base.width, base.width); });
  }

  // ---------- the forecast ----------
  function makePlan(seed, first) {
    const rng = mulberry32(seed), w = fcast || FORECAST[world], keys = Object.keys(w);
    const pick = (prev) => {
      let tot = 0; for (const k of keys) if (k !== prev) tot += w[k];
      let r = rng() * tot;
      for (const k of keys) { if (k === prev) continue; r -= w[k]; if (r <= 0) return k; }
      return keys[0];
    };
    const out = [];
    let prev = KINDS[first] && w[first] ? first : pick(null);
    for (let i = 0; i < 24; i++) {
      let k = i === 0 ? prev : pick(prev);
      // a tornado only drops out of a thunderstorm, and a storm usually starts as rain
      if (k === 'tornado' && prev !== 'storm') { if (prev !== 'rain') out.push(['rain', 22]); out.push(['storm', 28]); }
      if (k === 'storm' && prev === 'clear' && rng() < 0.7) out.push(['rain', 20]);
      const [a, b] = LAST[k];
      out.push([k, (i === 0 ? 0.6 : 1) * (a + rng() * (b - a))]);
      prev = k;
    }
    return out;
  }
  // fixed: a kind of weather to hold for the whole game instead of running the forecast (sandbox)
  function start(m, l, h, fixed) {
    M = m; L = l; hooks = h || {}; world = M.world.id;
    fcast = typeof EXPED !== 'undefined' && L.exp ? EXPED.forecast(L.exp) : null;
    plan = fixed && KINDS[fixed] ? [[fixed, 1e9]] : makePlan(L.look.seed + 4041, L.look.weather);
    ep = 0; epT = 0; time = 0; wet = 0; flash = 0; bolt = null; twister = null; toast = null; nextStrike = 4;
    windA = (mulberry32(L.look.seed + 7)() - 0.5) * 1.2 + (L.look.seed % 2 ? 0 : Math.PI);
    for (const k of CHANNELS) cur[k] = tgt[k] = 0;
    setTargets(true);
    wetCv = null;
    const R = mulberry32(L.look.seed + 9);
    drops = Array.from({ length: 560 }, () => newDrop(R, true));
    splashes = [];
    flakes = Array.from({ length: 640 }, () => ({ x: R() * (W + 200) - 100, y: R() * H, z: 0.3 + R() * 0.7, p: R() * TAU }));
    streaks = Array.from({ length: 180 }, () => ({ x: R() * W, y: R() * H, l: 10 + R() * 40, v: 0.6 + R() * 0.8 }));
    motes = Array.from({ length: 160 }, () => ({ x: R() * W, y: R() * H, z: 0.3 + R() * 0.7, p: R() * TAU, ember: R() < 0.45 }));
    weeds = Array.from({ length: 3 }, () => ({ x: R() * W, y: R() * H, r: 7 + R() * 5, a: 0, b: R() * TAU }));
  }
  function setTargets(snap) {
    const k = KINDS[plan[ep][0]];
    for (const c of CHANNELS) tgt[c] = k.ch[c] || 0;
    windTgt = k.wind;
    if (snap) { for (const c of CHANNELS) cur[c] = tgt[c]; wind = windTgt; }
  }
  const kind = () => (plan.length ? plan[ep][0] : 'clear');
  function forecast(l) {
    // the briefing shows what the sky has in store for the first few minutes
    const w = WORLDS[l.world].id;
    const save = world, sf = fcast; world = w; fcast = null;
    const p = makePlan(l.look.seed + 4041, l.look.weather);
    world = save; fcast = sf;
    const seen = [];
    let tsum = 0;
    for (const [k, d] of p) { if (tsum > 240) break; tsum += d; const lab = KINDS[k].label.toLowerCase(); if (k !== 'clear' && !seen.includes(lab)) seen.push(lab); }
    return seen.length ? seen.slice(0, 3).join(' → ') : 'clear skies';
  }

  // ---------- particles ----------
  function newDrop(R, scatter) {
    return { x: R() * (W + 160) - 80, y: R() * (H + 60) - 60, z: 0.35 + R() * 0.65, t: scatter ? R() : 0, life: 0.35 + R() * 0.4 };
  }
  const isWater = (x, y) => { const c = Math.floor(x / TILE), r = Math.floor(y / TILE); return c >= 0 && r >= 0 && c < COLS && r < ROWS && M.grid[r * COLS + c] === 3; };

  function update(dt, playing) {
    if (!M) return;
    time += dt;
    // the forecast moves on
    epT += dt;
    if (epT >= plan[ep][1]) {
      epT = 0; ep = (ep + 1) % plan.length; setTargets(false);
      const k = plan[ep][0], K = KINDS[k];
      if (playing) {
        toast = { text: K.toast, icon: K.icon, big: !!K.big, t: 0 };
        if (LINES[k] && hooks.say) hooks.say(LINES[k][Math.floor(Math.random() * LINES[k].length)]);
      }
      if (k === 'tornado') spawnTwister();
      if (hooks.changed) hooks.changed(k);
    }
    const ease = 1 - Math.exp(-dt * 0.22);
    for (const c of CHANNELS) cur[c] += (tgt[c] - cur[c]) * ease;
    wind += (windTgt - wind) * ease;
    const wa = windA + Math.sin(time * 0.05) * 0.3, wx = Math.cos(wa) * wind, wy = Math.sin(wa) * wind * 0.4;
    if (world !== 'tundra') wet = clamp(wet + dt * (cur.rain * 0.05 - 0.01), 0, 1);
    if (toast) { toast.t += dt; if (toast.t > 4.2) toast = null; }

    // rain: each drop falls for a moment then splashes where it lands
    const nDrop = Math.floor(Math.min(1.6, cur.rain) * 340);
    for (let i = 0; i < nDrop; i++) {
      const d = drops[i];
      d.t += dt / d.life;
      if (d.t >= 1) {
        if (splashes.length < 160 && Math.random() < 0.55) splashes.push({ x: d.x, y: d.y, t: 0, water: isWater(d.x, d.y), z: d.z });
        Object.assign(d, newDrop(Math.random, false));
      }
    }
    for (const s of splashes) s.t += dt;
    splashes = splashes.filter((s) => s.t < (s.water ? 0.9 : 0.32));
    // snow drifts on the wind and wanders side to side
    const nFlake = Math.floor(Math.min(1.8, cur.snow) * 330);
    for (let i = 0; i < nFlake; i++) {
      const f = flakes[i];
      f.x += (wx * (60 + 200 * f.z) + Math.sin(time * 1.3 + f.p) * 10) * dt;
      f.y += ((16 + 30 * f.z) + wy * 120 * f.z) * dt;
      if (f.y > H + 10) { f.y = -10; f.x = Math.random() * (W + 200) - 100; }
      if (f.x > W + 110) f.x -= W + 220; else if (f.x < -110) f.x += W + 220;
    }
    // dust and blown snow race along the ground
    for (const s of streaks) {
      s.x += Math.cos(wa) * (220 + 380 * wind) * s.v * dt; s.y += Math.sin(wa) * 60 * s.v * dt;
      if (s.x > W + 60) { s.x = -60; s.y = Math.random() * H; } else if (s.x < -60) { s.x = W + 60; s.y = Math.random() * H; }
    }
    for (const t of weeds) {
      t.x += Math.cos(wa) * (70 + 90 * wind) * dt; t.y += Math.sin(wa) * 20 * dt + Math.sin(time * 2 + t.b) * 8 * dt; t.a += Math.cos(wa) * dt * 5;
      if (t.x > W + 30) { t.x = -30; t.y = Math.random() * H; } else if (t.x < -30) { t.x = W + 30; t.y = Math.random() * H; }
    }
    // embers and ash, fireflies over the bayou
    if (cur.embers > 0.02) for (const m of motes) {
      m.x += (wx * 50 * m.z + Math.sin(time * 0.8 + m.p) * 8) * dt;
      m.y += (m.ember ? -6 + Math.sin(time + m.p) * 10 : 22 * m.z) * dt;
      if (m.y > H + 10) m.y = -10; if (m.y < -10) m.y = H + 10;
      if (m.x > W + 10) m.x = -10; if (m.x < -10) m.x = W + 10;
    }
    // lightning
    if (cur.lightning > 0.3) {
      nextStrike -= dt * cur.lightning;
      if (nextStrike <= 0) { strike(); nextStrike = 3 + Math.random() * 7; }
    }
    flash = Math.max(0, flash - dt * 2.2);
    if (bolt) { bolt.t += dt; if (bolt.t > 0.45) bolt = null; }
    if (twister) updateTwister(dt);
    // ambience follows the sky a few times a second
    soundT -= dt;
    if (soundT <= 0 && typeof Sound !== 'undefined' && Sound.weatherMix) { soundT = 0.25; Sound.weatherMix({ rain: Math.min(1.4, cur.rain), wind: wind * (0.3 + cur.dust + cur.drift * 0.8 + cur.debris), roar: twister ? twister.a * twister.near : 0, kind: kind() }); }
  }
  function strike() {
    const x = 60 + Math.random() * (W - 120), y = 60 + Math.random() * (H - 120);
    const pts = [[x + (Math.random() - 0.5) * 160, -40]];
    const branches = [];
    for (let i = 1; i <= 12; i++) {
      const k = i / 12, px = lerp(pts[0][0], x, k) + (i < 12 ? (Math.random() - 0.5) * 34 : 0), py = lerp(-40, y, k);
      pts.push([px, py]);
      if (i > 2 && i < 10 && Math.random() < 0.35) {
        const b = [[px, py]]; let bx = px, by = py;
        for (let j = 0; j < 4; j++) { bx += (Math.random() - 0.5) * 30 + (Math.random() < 0.5 ? -10 : 10); by += 14 + Math.random() * 10; b.push([bx, by]); }
        branches.push(b);
      }
    }
    bolt = { pts, branches, x, y, t: 0 };
    flash = 1;
    if (hooks.strike) hooks.strike(x, y);
    if (typeof Sound !== 'undefined') setTimeout(() => Sound.play('thunder'), 150 + Math.random() * 900);
  }

  // ---------- the tornado ----------
  function spawnTwister() {
    const fromLeft = Math.random() < 0.5, y = H * (0.25 + Math.random() * 0.5);
    const debris = Array.from({ length: 70 }, () => ({ a: Math.random() * TAU, r: 8 + Math.random() * 42, h: Math.random(), s: 0.6 + Math.random() * 0.8, k: Math.floor(Math.random() * 5), rot: Math.random() * TAU }));
    twister = { x: fromLeft ? -90 : W + 90, y, y0: y, dir: fromLeft ? 1 : -1, t: 0, a: 0, near: 0, debris, dur: 36 };
  }
  function updateTwister(dt) {
    const tw = twister;
    tw.t += dt;
    tw.x += tw.dir * ((W + 180) / tw.dur) * dt;
    tw.y = tw.y0 + Math.sin(tw.t * 0.35) * 60 + Math.sin(tw.t * 1.1) * 14;
    tw.a = clamp(Math.min(tw.t / 3, (tw.dur - tw.t) / 3), 0, 1);
    tw.near = clamp(1 - Math.abs(tw.x - W / 2) / (W * 0.7), 0.2, 1);
    for (const d of tw.debris) { d.a += dt * (3.2 / (0.4 + d.r / 40)) * d.s; d.h = (d.h + dt * 0.18 * d.s) % 1; d.rot += dt * 6 * d.s; }
    if (hooks.shake && tw.a > 0.5) hooks.shake(0.6 * tw.near);
    if (tw.t >= tw.dur) twister = null;
  }
  function drawTwister(c) {
    const tw = twister, t = time, { x, y } = tw, HT = 200;
    // the funnel's centre line and width at height h (0 ground, 1 cloud base), swaying as it goes
    const cx = (h) => x + Math.sin(t * 0.9 + h * 3) * h * 22 - h * 34 + Math.sin(t * 3 + h * 9) * 2 * (1 - h);
    const cy = (h) => y - h * HT;
    const rad = (h) => 5 + Math.pow(h, 1.7) * 74 + Math.sin(t * 4 + h * 12) * 1.5;
    c.save(); c.globalAlpha = tw.a;
    // its shadow on the ground and the churning dust skirt at the base, seen from above
    c.fillStyle = radial(c, x + 70, y + 30, 120, 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0)', 0, 0); ellipse(c, x + 70, y + 30, 140, 60, 0.3); c.fill();
    c.fillStyle = radial(c, x, y, 80, 'rgba(110,92,66,0.6)', 'rgba(110,92,66,0)', 0, 0); circle(c, x, y, 80); c.fill();
    const vx = tinted('wxVortexDust', vortex(), [150, 128, 96]), vd = tinted('wxVortexDark', vortex(), [52, 50, 50]);
    for (const [sz, sp, al] of [[190, 2.4, 0.95], [120, 3.6, 0.9]]) { c.save(); c.translate(x, y); c.rotate(-t * sp); c.globalAlpha = tw.a * al; c.drawImage(vx, -sz / 2, -sz / 2, sz, sz); c.restore(); }
    // debris picked up and spun round the funnel: behind it first
    const debris = (back) => {
      for (const d of tw.debris) {
        const h = d.h, sa = Math.sin(d.a);
        if ((sa < 0) !== back) continue;
        const r = rad(h) + d.r * 0.35, px = cx(h) + Math.cos(d.a) * r, py = cy(h) + sa * r * 0.28;
        c.globalAlpha = tw.a * (h > 0.85 ? (1 - h) / 0.15 : 1) * (back ? 0.7 : 1);
        c.save(); c.translate(px, py); c.rotate(d.rot);
        if (d.k === 0) { c.fillStyle = '#7a5a38'; c.fillRect(-3.5, -0.7, 7, 1.4); }
        else if (d.k === 1) { c.strokeStyle = '#d8b860'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-2.5, 0); c.lineTo(2.5, 0.6); c.stroke(); }
        else if (d.k === 2) { c.fillStyle = '#5a7a2c'; ellipse(c, 0, 0, 1.8, 0.9, 0); c.fill(); }
        else if (d.k === 3) { c.fillStyle = '#3e3022'; circle(c, 0, 0, 1.2); c.fill(); }
        else { c.fillStyle = '#6a6a66'; c.fillRect(-2, -1.3, 4, 2.6); }
        c.restore();
      }
      c.globalAlpha = tw.a;
    };
    debris(true);
    // the funnel: a tapered column, lit on the left, banded with spiralling cloud that climbs it
    const N = 24, left = [], right = [];
    for (let i = 0; i <= N; i++) { const h = i / N, r = rad(h); left.push([cx(h) - r, cy(h)]); right.push([cx(h) + r, cy(h)]); }
    const outline = () => { c.beginPath(); left.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); for (let i = N; i >= 0; i--) c.lineTo(right[i][0], right[i][1]); c.closePath(); };
    outline();
    c.fillStyle = linear(c, x - 80, 0, x + 50, 0, [[0, 'rgba(150,144,134,0.92)'], [0.45, 'rgba(92,88,82,0.94)'], [1, 'rgba(40,38,38,0.96)']]); c.fill();
    c.save(); outline(); c.clip();
    for (let i = 0; i < 18; i++) {
      const h = (i / 18 + t * 0.45) % 1, r = rad(h), yy = cy(h), xx = cx(h);
      c.strokeStyle = i % 2 ? 'rgba(200,192,180,0.28)' : 'rgba(20,18,18,0.35)'; c.lineWidth = 1.5 + h * 5;
      c.beginPath(); c.ellipse(xx, yy, r, r * 0.22, 0, 0.1, Math.PI - 0.1); c.stroke();
    }
    // a pale sheath of dust round the lower funnel
    c.fillStyle = linear(c, 0, y, 0, y - HT * 0.35, [[0, 'rgba(160,136,100,0.6)'], [1, 'rgba(160,136,100,0)']]); c.fillRect(x - 120, y - HT * 0.35, 240, HT * 0.35);
    // the upper funnel melts into the cloud it hangs from
    c.fillStyle = linear(c, 0, y - HT * 0.6, 0, y - HT, [[0, 'rgba(36,36,40,0)'], [1, 'rgba(36,36,40,0.95)']]); c.fillRect(x - 200, y - HT - 10, 400, HT * 0.4 + 10);
    c.restore();
    // the dark wall cloud it hangs from, turning slowly
    const tx = cx(1), ty = cy(1);
    c.save(); c.translate(tx, ty + 14); c.scale(1, 0.55);
    c.fillStyle = radial(c, 0, 0, 210, 'rgba(36,36,40,0.95)', 'rgba(36,36,40,0)', 0, 0); circle(c, 0, 0, 210); c.fill();
    c.restore();
    for (const [sz, sp, al] of [[360, 0.5, 0.8], [240, 0.9, 0.7]]) { c.save(); c.translate(tx, ty); c.scale(1, 0.6); c.rotate(-t * sp); c.globalAlpha = tw.a * al; c.drawImage(vd, -sz / 2, -sz / 2, sz, sz); c.restore(); }
    c.globalAlpha = tw.a;
    debris(false);
    c.restore();
  }

  // ---------- drawing ----------
  function wetLayer() {
    if (wetCv) return wetCv;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), rng = mulberry32(L.look.seed + 3);
    g.fillStyle = 'rgba(8,12,20,0.2)'; g.fillRect(0, 0, W, H);
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (const p of M.paths) { tracePts(g, p.pts); g.strokeStyle = 'rgba(6,8,12,0.28)'; g.lineWidth = TILE * 0.78; g.stroke(); }
    // the road shines where it has puddled, picking up the grey sky
    for (const p of M.paths) for (let d = 0; d < p.total; d += 14 + rng() * 30) {
      const q = pointOn(p, d), off = (rng() - 0.5) * TILE * 0.5, x = q.x - q.dy * off, y = q.y + q.dx * off, a = Math.atan2(q.dy, q.dx), rx = 3 + rng() * 9, ry = 1.6 + rng() * 2.4;
      g.fillStyle = 'rgba(20,24,30,0.4)'; ellipse(g, x, y, rx + 1, ry + 0.8, a); g.fill();
      g.fillStyle = linear(g, x - rx, y - ry, x + rx, y + ry, [[0, 'rgba(190,205,220,0.55)'], [0.6, 'rgba(120,135,150,0.25)'], [1, 'rgba(40,50,60,0.3)']]); ellipse(g, x, y, rx, ry, a); g.fill();
    }
    wetCv = cv;
    return cv;
  }
  // under the units: the wet sheen and splashes
  function drawGround(c) {
    if (!M) return;
    if (wet > 0.02) { c.save(); c.globalAlpha = wet; c.drawImage(wetLayer(), 0, 0, W, H); c.restore(); }
    if (splashes.length) {
      const col = cur.acid > 0.3 ? '190,230,90' : '215,228,240';
      c.lineWidth = 0.6;
      for (const s of splashes) {
        const k = s.t / (s.water ? 0.9 : 0.32), r = s.water ? 1 + k * 7 : 0.6 + k * 3;
        c.strokeStyle = `rgba(${col},${(1 - k) * (s.water ? 0.5 : 0.6)})`;
        ellipse(c, s.x, s.y, r, r * 0.7, 0); c.stroke();
        if (!s.water && k < 0.6) { c.fillStyle = `rgba(${col},${0.6 - k})`; for (const a of [0.6, 2, 3.6]) c.fillRect(s.x + Math.cos(a) * r * 1.4, s.y + Math.sin(a) * r - k * 3, 0.7, 0.7); }
      }
    }
  }
  // chimney smoke: only some houses have a fire going, and each fire is lit now and then rather than
  // all game, so smoke starts up from one chimney, trails away, and later rises from another
  function fireFor(s) {
    if (s.fire !== undefined) return s.fire;
    const r = mulberry32(L.look.seed * 31 + Math.round(s.x) * 977 + Math.round(s.y) * 131);
    const anyFires = mulberry32(L.look.seed + 555)() < 0.7;
    s.fire = anyFires && r() < 0.55 ? { period: 55 + r() * 50, on: 0.3 + r() * 0.3, phase: r() } : null;
    return s.fire;
  }
  // how strongly a fire is smoking at a given moment, easing in and out over a few seconds
  function burning(f, at) {
    const p = (((at / f.period + f.phase) % 1) + 1) % 1, fade = 5 / f.period;
    return p > f.on ? 0 : Math.min(1, p / fade, (f.on - p) / fade);
  }
  // the smoke leans with the wind; each puff keeps the strength of the moment it left the chimney,
  // so when a fire dies down the last of its smoke still drifts away
  function drawSmoke(c, t) {
    if (!M || !M.smoke || !M.smoke.length) return;
    const wa = windA + Math.sin(time * 0.05) * 0.3, wx = Math.cos(wa) * (0.3 + wind), puff = dot('wxPuff', 'rgba(200,200,205,0.55)', 'rgba(200,200,205,0)');
    for (const s of M.smoke) {
      const f = fireFor(s);
      if (!f) continue;
      for (let i = 0; i < 7; i++) {
        const k = (t * 0.22 + i / 7) % 1, r = 3 + k * 11, b = burning(f, t - k / 0.22);
        if (b < 0.02) continue;
        c.globalAlpha = (k < 0.12 ? k / 0.12 : 1) * (1 - k) * 0.75 * b;
        c.drawImage(puff, s.x + wx * k * 40 + Math.sin(t + i) * 2 - r, s.y - k * 34 - r, r * 2, r * 2);
      }
    }
    c.globalAlpha = 1;
  }
  // the soft full-screen layers (cloud shadow, tints, fog banks) are composed at half resolution
  // and laid over the field in one go: they have no fine detail to lose and it saves a lot of fill
  let hz = null;
  function hazeBuf() {
    if (!hz) { hz = document.createElement('canvas'); hz.width = W / 2; hz.height = H / 2; }
    const g = hz.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, hz.width, hz.height); g.setTransform(0.5, 0, 0, 0.5, 0, 0);
    return g;
  }
  const blitHaze = (c) => { c.drawImage(hz, 0, 0, W, H); };
  function fogLayer(c, rgb, alpha, sc, ox, oy) {
    if (alpha < 0.01) return;
    const pat = c.createPattern(cloudTex(rgb), 'repeat');
    pat.setTransform(new DOMMatrix().translate(ox, oy).scale(sc));
    c.save(); c.globalAlpha = alpha; c.fillStyle = pat; c.fillRect(-20, -20, W + 40, H + 40); c.restore();
  }
  // over the units: the sky
  function drawSky(c, light) {
    if (!M) return;
    const t = time, wa = windA + Math.sin(time * 0.05) * 0.3, ux = Math.cos(wa), uy = Math.sin(wa);
    // cloud shadows drift over everything, even on fine days, and storms darken the field
    let g = hazeBuf();
    fogLayer(g, [0, 0, 0], cur.cloud * 0.22, 3.4, ux * t * 9, uy * t * 9 + 40);
    if (cur.dark > 0.01) { g.fillStyle = `rgba(8,12,22,${cur.dark * 0.75})`; g.fillRect(0, 0, W, H); }
    // an ash storm glows red at the edges, as if the whole horizon were burning
    if (cur.embers > 0.01) {
      const fl = 0.85 + Math.sin(t * 2.3) * 0.08 + Math.sin(t * 5.1) * 0.05;
      g.fillStyle = radial(g, W / 2, H / 2, W * 0.75, 'rgba(255,120,40,0)', `rgba(220,80,24,${cur.embers * 0.4 * fl})`, 0, 0); g.fillRect(0, 0, W, H);
      g.fillStyle = `rgba(120,40,16,${cur.embers * 0.12})`; g.fillRect(0, 0, W, H);
    }
    // desert heat: a hot white glare, and shimmering bands of air rising off the sand
    if (cur.heat > 0.01) {
      g.fillStyle = `rgba(255,236,190,${cur.heat * 0.12})`; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 9; i++) {
        const y = ((i / 9) * (H + 80) - t * 14) % (H + 80);
        const yy = (y < -40 ? y + H + 80 : y) - 40, a = cur.heat * (0.05 + 0.03 * Math.sin(t * 1.3 + i));
        g.fillStyle = linear(g, 0, yy - 18, 0, yy + 18, [[0, 'rgba(255,248,225,0)'], [0.5, `rgba(255,248,225,${a})`], [1, 'rgba(255,248,225,0)']]);
        g.beginPath(); g.moveTo(0, yy);
        for (let x = 0; x <= W; x += 40) g.lineTo(x, yy + Math.sin(x * 0.02 + t * 2 + i) * 6 - 14);
        for (let x = W; x >= 0; x -= 40) g.lineTo(x, yy + Math.sin(x * 0.02 + t * 2 + i + 1) * 6 + 14);
        g.closePath(); g.fill();
      }
    }
    blitHaze(c);
    if (twister) drawTwister(c);
    // dust haze, smoke and fog banks
    g = hazeBuf();
    if (cur.haze > 0.01) { g.fillStyle = `rgba(150,108,58,${cur.haze * 0.32})`; g.fillRect(0, 0, W, H); }
    fogLayer(g, [176, 132, 80], cur.dust * 0.6, 2.2, ux * t * 60, uy * t * 20);
    fogLayer(g, [52, 44, 40], cur.smoke * 0.4, 2.8, ux * t * 14, uy * t * 10);
    const fogCol = world === 'swamp' ? [176, 196, 150] : world === 'tundra' || cur.drift > 0.3 ? [238, 243, 250] : [208, 212, 218];
    fogLayer(g, fogCol, cur.fog * 0.5, 3, ux * t * 8, uy * t * 5);
    fogLayer(g, fogCol, cur.fog * 0.38, 5, -ux * t * 4 + 300, t * 2);
    blitHaze(c);
    // the grit racing along with the wind
    const streakA = cur.dust * 0.3 + cur.drift * 0.35;
    if (streakA > 0.01) {
      c.strokeStyle = cur.drift > cur.dust ? `rgba(245,250,255,${streakA})` : `rgba(210,170,110,${streakA})`; c.lineWidth = 0.8;
      c.beginPath(); for (const s of streaks) { c.moveTo(s.x, s.y); c.lineTo(s.x - ux * s.l, s.y - uy * s.l * 0.3); } c.stroke();
    }
    if (cur.dust > 0.3) for (const tw of weeds) {
      c.save(); c.globalAlpha = (cur.dust - 0.3) / 0.7;
      c.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(c, tw.x + 3, tw.y + 4, tw.r, tw.r * 0.4, 0); c.fill();
      c.translate(tw.x, tw.y - Math.abs(Math.sin(t * 3 + tw.b)) * 6); c.rotate(tw.a);
      c.strokeStyle = '#8a6a3c'; c.lineWidth = 0.6;
      for (let i = 0; i < 14; i++) { const a = i * 2.4; c.beginPath(); c.arc(Math.cos(a) * tw.r * 0.3, Math.sin(a) * tw.r * 0.3, tw.r * (0.5 + (i % 3) * 0.2), a, a + 2.2); c.stroke(); }
      c.restore();
    }
    // rain: streaks slanting with the wind, closer drops longer and brighter
    const nDrop = Math.floor(Math.min(1.6, cur.rain) * 340);
    if (nDrop) {
      const col = cur.acid > 0.3 ? '170,220,80' : '200,214,228', sx = ux * wind * 0.45, k = 1 / Math.hypot(sx, 1);
      for (const [lo, hi, a, lw] of [[0, 0.65, 0.22, 0.7], [0.65, 1.01, 0.38, 1.1]]) {
        c.strokeStyle = `rgba(${col},${a})`; c.lineWidth = lw; c.beginPath();
        for (let i = 0; i < nDrop; i++) {
          const d = drops[i]; if (d.z < lo || d.z >= hi) continue;
          const len = 10 + d.z * 16, fall = (1 - d.t) * 60 * d.z;
          const x = d.x - sx * k * fall, y = d.y - k * fall;
          c.moveTo(x, y); c.lineTo(x - sx * k * len, y - k * len);
        }
        c.stroke();
      }
    }
    // snow: soft flakes, nearest biggest; a faint blue-grey rim keeps them visible over snowfields
    const nFlake = Math.floor(Math.min(1.8, cur.snow) * 330);
    if (nFlake) {
      const fl = dot('wxFlake2', 'rgba(255,255,255,1)', 'rgba(120,140,170,0)'), streak = wind > 0.7;
      for (const [lo, hi, a] of [[0, 0.55, 0.55], [0.55, 0.8, 0.8], [0.8, 1.01, 1]]) {
        c.globalAlpha = a;
        for (let i = 0; i < nFlake; i++) {
          const f = flakes[i]; if (f.z < lo || f.z >= hi) continue;
          const s2 = 2.2 + f.z * 4.2;
          if (streak) c.drawImage(fl, f.x - s2 * 2, f.y - s2 * 0.5, s2 * 4, s2); else c.drawImage(fl, f.x - s2 / 2, f.y - s2 / 2, s2, s2);
        }
      }
      c.globalAlpha = 1;
    }
    // ash and embers
    if (cur.embers > 0.02) {
      const em = dot('wxEmber', 'rgba(255,200,90,1)', 'rgba(255,90,20,0)');
      for (const m of motes) {
        if (m.ember) continue;
        c.fillStyle = `rgba(90,86,82,${cur.embers * 0.7})`; c.fillRect(m.x, m.y, 1 + m.z, 1 + m.z * 0.6);
      }
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const m of motes) {
        if (!m.ember) continue;
        const s = 3 + m.z * 5, fl2 = 0.6 + Math.sin(t * 9 + m.p * 5) * 0.4;
        c.globalAlpha = cur.embers * fl2; c.drawImage(em, m.x - s / 2, m.y - s / 2, s, s);
      }
      c.restore();
    }
    // fireflies over the mist at dusk and night
    if (cur.flies > 0.02) {
      const ff = dot('wxFly', 'rgba(220,255,140,1)', 'rgba(160,230,80,0)'), dim = light > 0.6 ? 1 : 0.35;
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 44; i++) {
        const m = motes[i], x = m.x + Math.sin(t * 0.6 + m.p) * 30, y = m.y + Math.cos(t * 0.45 + m.p * 1.7) * 22, b = Math.max(0, Math.sin(t * 1.7 + m.p * 3));
        c.globalAlpha = cur.flies * b * dim; c.drawImage(ff, x - 5, y - 5, 10, 10);
      }
      c.restore();
    }
    // lightning: the bolt, the flash and the ground lit where it hit
    if (bolt) {
      const k = bolt.t < 0.08 ? 1 : bolt.t < 0.14 ? 0.3 : bolt.t < 0.22 ? 0.9 : Math.max(0, 1 - (bolt.t - 0.22) / 0.23);
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round';
      const line = (pts, w) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.lineWidth = w; c.stroke(); };
      c.strokeStyle = `rgba(150,170,255,${0.35 * k})`; line(bolt.pts, 9); for (const b of bolt.branches) line(b, 4);
      c.strokeStyle = `rgba(235,240,255,${k})`; line(bolt.pts, 2.2); for (const b of bolt.branches) line(b, 1);
      c.fillStyle = radial(c, bolt.x, bolt.y, 60, `rgba(220,230,255,${0.7 * k})`, 'rgba(220,230,255,0)', 0, 0); circle(c, bolt.x, bolt.y, 60); c.fill();
      c.restore();
    }
    if (flash > 0) { const f = flash > 0.7 ? flash : flash * 0.5; c.fillStyle = `rgba(225,232,255,${f * 0.38})`; c.fillRect(-20, -20, W + 40, H + 40); }
    if (toast) drawToast(c);
  }
  function icon(c, kind, x, y) {
    c.save(); c.translate(x, y); c.strokeStyle = '#ece6d6'; c.fillStyle = '#ece6d6'; c.lineWidth = 1.6; c.lineCap = 'round'; c.lineJoin = 'round';
    if (kind === 'rain') { c.beginPath(); c.arc(-2, -2, 4, Math.PI, 0); c.arc(3, -1, 3, -Math.PI / 2, Math.PI / 2); c.lineTo(-6, 2); c.closePath(); c.fill(); for (const dx of [-4, 0, 4]) { c.beginPath(); c.moveTo(dx, 4); c.lineTo(dx - 1, 7); c.stroke(); } }
    else if (kind === 'bolt') { c.beginPath(); c.moveTo(1, -7); c.lineTo(-4, 1); c.lineTo(0, 1); c.lineTo(-2, 7); c.lineTo(4, -1); c.lineTo(0, -1); c.closePath(); c.fillStyle = '#e3a83e'; c.fill(); }
    else if (kind === 'twister') { for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-6 + i * 1.2, -6 + i * 3.4); c.lineTo(6 - i * 1.6 + (i % 2), -6 + i * 3.4); c.stroke(); } }
    else if (kind === 'wind') { for (const [yy, l] of [[-4, 10], [0, 7], [4, 11]]) { c.beginPath(); c.moveTo(-6, yy); c.lineTo(-6 + l, yy); c.arc(-6 + l, yy - 2, 2, Math.PI / 2, -Math.PI / 2, true); c.stroke(); } }
    else if (kind === 'fog') { for (const yy of [-4, 0, 4]) { c.beginPath(); c.moveTo(-7, yy); c.lineTo(7, yy); c.stroke(); } }
    else if (kind === 'flake') { for (let i = 0; i < 3; i++) { c.save(); c.rotate((i * Math.PI) / 3); c.beginPath(); c.moveTo(0, -7); c.lineTo(0, 7); c.moveTo(-2, -5); c.lineTo(0, -3.5); c.lineTo(2, -5); c.moveTo(-2, 5); c.lineTo(0, 3.5); c.lineTo(2, 5); c.stroke(); c.restore(); } }
    else if (kind === 'flame') { c.beginPath(); c.moveTo(0, -7); c.quadraticCurveTo(6, 0, 3, 6); c.quadraticCurveTo(0, 8, -3, 6); c.quadraticCurveTo(-6, 0, 0, -7); c.fillStyle = '#e07a30'; c.fill(); }
    else { circle(c, 0, 0, 3.5); c.fill(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; c.beginPath(); c.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); c.lineTo(Math.cos(a) * 7, Math.sin(a) * 7); c.stroke(); } }
    c.restore();
  }
  function drawToast(c) {
    const k = toast.t, a = k < 0.35 ? k / 0.35 : k > 3.6 ? Math.max(0, (4.2 - k) / 0.6) : 1;
    const text = toast.text.toUpperCase();
    c.save(); c.globalAlpha = a;
    c.font = `700 14px ${typeof FONT_DISPLAY !== 'undefined' ? FONT_DISPLAY : 'sans-serif'}`;
    const tw = c.measureText(text).width, w = tw + 46, x = W - w - 14, y = 14 + (1 - Math.min(1, k / 0.35)) * -10;
    c.fillStyle = toast.big ? 'rgba(120,28,22,0.85)' : 'rgba(14,16,20,0.72)'; c.beginPath(); c.roundRect(x, y, w, 28, 6); c.fill();
    c.strokeStyle = toast.big ? 'rgba(255,140,110,0.6)' : 'rgba(236,230,214,0.25)'; c.lineWidth = 1; c.stroke();
    icon(c, toast.icon, x + 17, y + 14);
    c.fillStyle = '#ece6d6'; c.textBaseline = 'middle'; c.fillText(text, x + 32, y + 15);
    c.restore();
  }

  return {
    start, update, drawGround, drawSky, drawSmoke, forecast,
    kindsFor: (worldId) => Object.keys(FORECAST[worldId] || FORECAST.farmland),
    get kind() { return kind(); }, get dark() { return cur.dark || 0; }, get wet() { return wet; },
    // for tests: jump straight to a kind of weather
    force(k) { const i = plan.findIndex(([q]) => q === k); if (i >= 0) { ep = i; epT = 0; } else { plan[ep] = [k, 60]; epT = 0; } setTargets(true); if (k === 'tornado') spawnTwister(); if (hooks.changed) hooks.changed(k); },
    KINDS,
  };
})();
