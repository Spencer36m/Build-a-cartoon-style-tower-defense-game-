'use strict';
// ============================================================
// Engine, UI and menus.
// ============================================================

// ---------- persistent progress ----------
const META_KEY = 'zbash2.meta', SAVE_KEY = 'zbash2.save';
function loadMeta() {
  const fresh = { coins: 150, stars: {}, owned: {}, upg: {}, items: { airstrike: 1, cryobomb: 1, supply: 1, medkit: 0 } };
  try {
    const m = JSON.parse(store.get(META_KEY));
    if (m && typeof m === 'object') return { ...fresh, ...m, items: { ...fresh.items, ...(m.items || {}) } };
  } catch (e) { /* corrupt save, start fresh */ }
  return fresh;
}
const meta = loadMeta();
const saveMeta = () => store.set(META_KEY, JSON.stringify(meta));
const upg = (k) => meta.upg[k] | 0;
const starsFor = (i) => meta.stars[LEVEL_META[i].id] | 0;
const levelUnlocked = (i) => i === 0 || starsFor(i - 1) > 0;
const worldUnlocked = (w) => levelUnlocked(w * LEVELS_PER_WORLD);
const towerUnlocked = (type) => { const d = TOWERS[type]; return !d.unlock || !!meta.owned[type] || starsFor(d.unlock - 1) > 0; };
const costOf = (n) => Math.round(n * (1 - 0.04 * upg('discount')));
const maxLives = () => BASE_LIVES + 3 * upg('walls');
const coarse = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;
const buzz = (ms) => { try { if (!Sound.muted && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* no haptics */ } };

// ============================================================
// Sound: a small synth with gunfire, blasts and groans
// ============================================================
const Sound = {
  ac: null, master: null, noiseBuf: null, muted: false, last: {},
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      this.master = this.ac.createGain(); this.master.gain.value = 0.32; this.master.connect(this.ac.destination);
      const len = this.ac.sampleRate;
      this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ac = null; }
  },
  tone(f, dur, type = 'sine', vol = 0.2, slide = null, delay = 0) {
    const ac = this.ac, t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
  },
  noise(dur, vol = 0.3, freq = 800, delay = 0, type = 'lowpass') {
    const ac = this.ac, t0 = ac.currentTime + delay;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = this.noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t0); src.stop(t0 + dur + 0.05);
  },
  play(name) {
    if (!this.ac || this.muted) return;
    const now = performance.now();
    const gap = { mg: 70, splat: 50, sniper: 90, mortar: 120, boom: 100, cryo: 100, flame: 160, zap: 90, missile: 120, cannon: 110, heli: 70, summon: 400, heal: 400, groan: 900 }[name] || 40;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    switch (name) {
      case 'mg': this.noise(0.06, 0.14, 2600); this.tone(160, 0.05, 'square', 0.03, 80); break;
      case 'heli': this.noise(0.05, 0.1, 3000); break;
      case 'sniper': this.noise(0.25, 0.28, 3500); this.tone(220, 0.18, 'triangle', 0.08, 60); break;
      case 'mortar': this.tone(140, 0.18, 'sine', 0.2, 60); this.noise(0.1, 0.1, 500); break;
      case 'boom': this.noise(0.6, 0.35, 420); this.tone(70, 0.5, 'sine', 0.3, 32); break;
      case 'cryo': this.noise(0.25, 0.08, 6000, 0, 'highpass'); break;
      case 'flame': this.noise(0.3, 0.08, 900); break;
      case 'zap': this.noise(0.12, 0.1, 5000, 0, 'highpass'); this.tone(90, 0.12, 'sawtooth', 0.05, 180); break;
      case 'missile': this.noise(0.35, 0.09, 1800); break;
      case 'cannon': this.noise(0.18, 0.2, 900); this.tone(110, 0.15, 'sine', 0.15, 50); break;
      case 'splat': this.noise(0.08, 0.08, 700); break;
      case 'groan': this.tone(95, 0.9, 'sawtooth', 0.05, 70); this.tone(72, 0.9, 'sine', 0.08, 55, 0.1); break;
      case 'summon': this.tone(120, 0.5, 'triangle', 0.06, 300); break;
      case 'heal': this.tone(420, 0.25, 'sine', 0.05, 640); break;
      case 'stomp': this.noise(0.5, 0.35, 220); this.tone(48, 0.5, 'sine', 0.35, 28); break;
      case 'dig': this.noise(0.2, 0.12, 400); break;
      case 'leak': this.tone(180, 0.4, 'sawtooth', 0.08, 70); break;
      case 'place': this.noise(0.08, 0.15, 1200); this.tone(320, 0.06, 'triangle', 0.08); break;
      case 'upgrade': [392, 523, 659].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.1, null, i * 0.07)); break;
      case 'sell': this.tone(520, 0.12, 'triangle', 0.08, 260); break;
      case 'wave': this.tone(330, 0.5, 'sawtooth', 0.04, 300); this.tone(220, 0.6, 'sine', 0.06, null, 0.1); break;
      case 'boss': this.tone(65, 1.2, 'sawtooth', 0.1, 45); this.tone(98, 1.0, 'sawtooth', 0.06, 70, 0.3); break;
      case 'error': this.tone(140, 0.12, 'square', 0.06); break;
      case 'click': this.tone(880, 0.03, 'triangle', 0.05); break;
      case 'coin': this.tone(1046, 0.06, 'triangle', 0.06); this.tone(1568, 0.1, 'triangle', 0.05, null, 0.05); break;
      case 'lose': [262, 220, 175, 131].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.1, null, i * 0.25)); break;
      case 'win': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.09, null, i * 0.14)); break;
      case 'jet': this.noise(1.2, 0.18, 900); break;
    }
  },
};

// ============================================================
// State
// ============================================================
const S = {
  state: 'menu', L: null, M: null, levelIndex: 0, worldSel: 0, levelSel: 0,
  lives: 0, maxLives: 20, cash: 0, wave: 0,
  towers: [], enemies: [], projectiles: [], fx: [], decals: [], spawners: [], strikes: [],
  towerAt: new Map(),
  speed: 1, paused: false, auto: false, autoT: 0,
  placing: null, power: null, selected: null, pending: null, dirty: false,
  hover: { x: 0, y: 0, col: -1, row: -1, inside: false, mouse: true },
  time: 0, anim: 0, shake: 0, houseHit: 0, banner: null, leakFlash: 0, freezeFlash: 0,
  weather: [],
};

// ---------- canvas ----------
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const stage = $('#stage');
const bg = document.createElement('canvas');
const bgx = bg.getContext('2d');
let scale = 1;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const frame = canvas.offsetWidth - canvas.clientWidth;
  const availW = stage.clientWidth - frame;
  let availH = Infinity;
  if (getComputedStyle($('.layout')).flexDirection === 'row') {
    const top = stage.getBoundingClientRect().top + window.scrollY;
    const padB = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
    availH = window.innerHeight - top - padB - frame - 6;
  }
  const cssW = Math.max(240, Math.floor(Math.min(availW, (availH * W) / H)));
  const cssH = Math.round((cssW * H) / W);
  document.documentElement.style.setProperty('--panel-h', cssH + frame + 'px');
  canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
  canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
  scale = canvas.width / W;
  bg.width = canvas.width; bg.height = canvas.height;
  if (S.M) renderBackground(bgx, S.M, scale);
}

// ============================================================
// Level building
// ============================================================
function pathFromPx(pts) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    segs.push({ a, b, len, start: total, dx: (b.x - a.x) / len, dy: (b.y - a.y) / len });
    total += len;
  }
  return { pts, segs, total };
}
function pointOn(path, d) {
  const segs = path.segs;
  d = clamp(d, 0, path.total);
  for (const s of segs) {
    if (d <= s.start + s.len || s === segs[segs.length - 1]) {
      const k = d - s.start;
      return { x: s.a.x + s.dx * k, y: s.a.y + s.dy * k, dx: s.dx, dy: s.dy };
    }
  }
  return { x: 0, y: 0, dx: 1, dy: 0 };
}
// A second road that stops on the main road follows it from there to the base.
function completePath(main, points) {
  const [mc, mr] = points[points.length - 1];
  for (let i = 0; i < main.length - 1; i++) {
    const [ac, ar] = main[i], [bc, br] = main[i + 1];
    const on = (ac === bc && mc === ac && mr >= Math.min(ar, br) && mr <= Math.max(ar, br)) ||
               (ar === br && mr === ar && mc >= Math.min(ac, bc) && mc <= Math.max(ac, bc));
    if (on) return points.concat(main.slice(i + 1));
  }
  return points;
}
const tileCenter = ([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });

function buildLevel(L) {
  const world = WORLDS[L.world];
  const main = L.paths[0];
  const paths = L.paths.map((p, i) => pathFromPx((i === 0 ? p : completePath(main, p)).map(tileCenter)));
  const grid = new Uint8Array(COLS * ROWS);
  for (let i = 0; i < grid.length; i++) if (L.water[i]) grid[i] = 3;
  for (const p of L.paths.map((p, i) => (i === 0 ? p : completePath(main, p)))) {
    for (let i = 0; i < p.length - 1; i++) {
      let [c, r] = p[i];
      const [c2, r2] = p[i + 1];
      const dc = Math.sign(c2 - c), dr = Math.sign(r2 - r);
      for (;;) {
        if (c >= 0 && c < COLS && r >= 0 && r < ROWS) grid[r * COLS + c] = 1;
        if (c === c2 && r === r2) break;
        c += dc; r += dr;
      }
    }
  }
  for (const d of L.decor) grid[d.r * COLS + d.c] = 2;
  const end = paths[0].pts[paths[0].pts.length - 1];
  // Flyers shadow the road but cut its corners, so they are quick yet still pass the defences.
  const flights = [];
  for (const p of paths) {
    const corners = p.pts.slice(1, -1);
    for (const parity of [0, 1]) {
      const pts = [{ x: p.pts[0].x - p.segs[0].dx * 20, y: p.pts[0].y - p.segs[0].dy * 20 }];
      corners.forEach((q, i) => { if (i % 2 === parity) pts.push({ x: q.x, y: q.y }); });
      pts.push({ x: end.x, y: end.y });
      flights.push(pathFromPx(pts));
    }
  }
  return { L, world, grid, paths, flights, decor: L.decor, end, groundTex: null };
}

// ============================================================
// Game flow
// ============================================================
function startGame(index, save) {
  const L = getLevel(index);
  S.levelIndex = index; S.L = L; S.M = buildLevel(L);
  S.maxLives = maxLives(); S.lives = S.maxLives;
  S.cash = L.gold + 60 * upg('cash'); S.wave = 0;
  S.towers = []; S.enemies = []; S.projectiles = []; S.fx = []; S.decals = []; S.spawners = []; S.strikes = [];
  S.towerAt = new Map();
  S.placing = null; S.power = null; S.selected = null; S.pending = null;
  S.time = 0; S.shake = 0; S.houseHit = 0; S.banner = null; S.leakFlash = 0; S.freezeFlash = 0;
  S.state = 'playing';
  setPaused(false);
  initWeather();
  hideScreens();
  $('#st-id').textContent = L.id;
  $('#st-name').textContent = L.name;
  resize();
  if (save) applySave(save);
  else showBanner(`${L.id} · ${L.name}`, `${WORLDS[L.world].name} · ${L.waves} waves${L.boss ? ' · Boss' : ''}`);
  checkpoint();
  buildShop(); renderInfo(); renderNextWave(); renderPowerbar(); updateHUD(true);
}

function checkpoint() {
  if (S.state !== 'playing' || S.spawners.length || S.enemies.length) return;
  S.dirty = false;
  store.set(SAVE_KEY, JSON.stringify({
    v: 3, level: S.levelIndex, lives: S.lives, cash: S.cash, wave: S.wave,
    towers: S.towers.map((t) => ({ type: t.type, col: t.col, row: t.row, level: t.level, spent: t.spent, mode: t.mode, kills: t.kills })),
  }));
}
function loadSave() {
  try {
    const sv = JSON.parse(store.get(SAVE_KEY));
    if (sv && sv.v === 3 && LEVEL_META[sv.level] && Array.isArray(sv.towers) && sv.lives > 0 && sv.wave < LEVEL_META[sv.level].waves) return sv;
  } catch (e) { /* corrupt save */ }
  return null;
}
function applySave(sv) {
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  S.lives = num(sv.lives, S.lives); S.cash = num(sv.cash, S.cash); S.wave = clamp(num(sv.wave, 0), 0, S.L.waves - 1);
  for (const t of sv.towers) {
    if (!TOWERS[t.type] || !canPlaceAt(t.type, t.col, t.row)) continue;
    const tw = makeTower(t.type, t.col, t.row);
    tw.level = clamp(t.level | 0, 0, 3);
    tw.spent = num(t.spent, TOWERS[t.type].cost);
    if (MODES.some((m) => m[0] === t.mode)) tw.mode = t.mode;
    tw.kills = num(t.kills, 0);
  }
  showBanner('Welcome back', `Wave ${S.wave + 1} is up next`);
}

function startWave() {
  if (S.state !== 'playing' || S.paused || S.wave >= S.L.waves) return;
  const early = S.spawners.length > 0 || S.enemies.length > 0;
  S.wave++;
  S.spawners.push(makeSpawner(S.wave));
  if (early) {
    const b = 5 + S.wave;
    S.cash += b;
    floatText(`Early call +$${b}`, W / 2, 96, '#86b356', 18);
  }
  const fresh = newTypes(S.L, S.wave);
  const boss = S.L.boss && S.wave === S.L.waves;
  let sub = null;
  if (boss) sub = `${ZOMBIES[S.L.boss].name} incoming`;
  else if (fresh.length) sub = `New threat: ${fresh.map((t) => ZOMBIES[t].name).join(' and ')}`;
  else if (S.wave === S.L.waves) sub = 'Final wave';
  showBanner(`Wave ${S.wave}`, sub);
  Sound.play(boss ? 'boss' : 'wave');
  if (fresh.length || boss) Sound.play('groan');
  renderNextWave(); updateHUD(true);
}

function makeSpawner(n) {
  const queue = [];
  let t = 0;
  for (const grp of makeWave(S.L, n)) {
    t += grp.delay;
    for (let i = 0; i < grp.count; i++) { queue.push({ t, type: grp.type }); t += grp.gap; }
  }
  return { wave: n, queue, time: 0, done: false, n: 0 };
}

function levelReward(stars, first) {
  return Math.round((30 + stars * 15 + S.L.index * 1.5) * (first ? 1 : 0.35));
}

function victory() {
  S.state = 'won';
  S.placing = null; S.power = null; S.pending = null;
  store.remove(SAVE_KEY);
  const k = S.lives / S.maxLives;
  const stars = k >= 0.85 ? 3 : k >= 0.4 ? 2 : 1;
  const prev = starsFor(S.levelIndex);
  const reward = levelReward(stars, prev === 0);
  if (stars > prev) meta.stars[S.L.id] = stars;
  meta.coins += reward;
  const unlocked = prev === 0 ? TOWER_KEYS.filter((t) => TOWERS[t].unlock === S.levelIndex + 1 && !meta.owned[t]) : [];
  saveMeta();
  Sound.play('win');
  const next = LEVEL_META[S.levelIndex + 1];
  let text;
  if (unlocked.length) text = `New tower unlocked: ${unlocked.map((t) => TOWERS[t].name).join(', ')}.`;
  else if (!next) text = 'Every sector is secure. Replay levels to earn all the stars.';
  else if (next.world !== S.L.world) text = `New world unlocked: ${WORLDS[next.world].name}.`;
  else text = `You kept ${S.lives} of ${S.maxLives} lives. Next up: ${next.id} ${next.name}.`;
  showEnd(true, 'Sector secured', text, stars, reward);
}

function gameOver() {
  S.state = 'over';
  S.placing = null; S.power = null; S.pending = null;
  store.remove(SAVE_KEY);
  const reward = Math.round(S.wave * 2);
  meta.coins += reward; saveMeta();
  Sound.play('lose'); buzz([80, 60, 160]);
  showEnd(false, 'Base overrun', `The horde broke through on wave ${S.wave} of ${S.L.waves}. Try a different mix of towers, or pick up upgrades in the store.`, 0, reward);
}

const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>';
function showEnd(won, title, text, stars, reward) {
  $('#end-kicker').textContent = `Sector ${S.L.id} · ${S.L.name}`;
  $('#end-title').textContent = title;
  $('#end-text').textContent = text;
  $('#end-reward').textContent = `+${reward} coins`;
  $('.dialog-end').classList.toggle('lost', !won);
  const st = $('#end-stars');
  st.hidden = !won;
  st.innerHTML = [1, 2, 3].map((i) => STAR_SVG.replace('<svg', `<svg class="${i <= stars ? 'on' : ''}"`)).join('');
  st.setAttribute('aria-label', `${stars} of 3 stars`);
  $('#btn-next').hidden = !won || !LEVEL_META[S.levelIndex + 1];
  $('#btn-retry').textContent = won ? 'Replay' : 'Try again';
  $('#end-screen').hidden = false;
  renderInfo();
}

function setPaused(p) {
  if (S.state !== 'playing') p = false;
  S.paused = p;
  $('#pause-screen').hidden = !p;
  $('#btn-pause').textContent = p ? 'Resume' : 'Pause';
}

// ============================================================
// Zombies
// ============================================================
function spawnEnemy(type, wave, route, d = 0) {
  const def = ZOMBIES[type];
  const e = effWave(S.L, wave);
  const mul = hpScale(e);
  const z = {
    type, wave, route, fly: !!def.fly,
    hp: def.hp * mul, maxHp: def.hp * mul,
    speed: def.speed * (1 + Math.min(0.25, (e - 1) * 0.006)),
    armor: def.armor ? def.armor + Math.floor(e / 8) : 0,
    reward: Math.round(def.reward * (1 + (e - 1) * 0.05) * (1 + 0.06 * upg('bounty'))),
    r: def.r, d, x: -60, y: -60, dirx: 1, diry: 0,
    cur: def.speed, slowT: 0, slowF: 0, burnT: 0, burnDps: 0, burnSrc: null, flash: 0,
    phase: Math.random() * TAU, dead: false, burrowed: false, revealed: false,
    sumCd: def.summon ? def.summon.every * 0.6 : 0, healCd: def.heal ? def.heal.every : 0, stompCd: def.stomp ? def.stomp.every * 0.5 : 0,
  };
  placeOnPath(z);
  S.enemies.push(z);
  return z;
}

function placeOnPath(e) {
  const p = pointOn(e.route, e.d);
  e.x = p.x; e.y = p.y; e.dirx = p.dx; e.diry = p.dy;
  const b = ZOMBIES[e.type].burrow;
  if (b) {
    const was = e.burrowed, k = e.d / e.route.total;
    e.burrowed = k >= b[0] && k < b[1];
    if (was && !e.burrowed) {
      for (let i = 0; i < 10; i++) {
        const a = rand(0, TAU);
        S.fx.push({ kind: 'debris', x: e.x, y: e.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, r: rand(1.5, 3), color: '#5e4a36', life: 0.6, max: 0.6 });
      }
      Sound.play('dig');
    }
  }
}

const onField = (e) => e.x > 2 && e.y > 2 && e.x < W - 2 && e.y < H - 2;
const targetable = (e, air) => !e.dead && onField(e) && (!e.burrowed || e.revealed) && (!e.fly || air);

function updateEnemy(e, dt) {
  const def = ZOMBIES[e.type];
  if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowF = 0; }
  e.flash = Math.max(0, e.flash - dt);
  if (e.burnT > 0) {
    e.burnT -= dt;
    damage(e, e.burnDps * dt, e.burnSrc, 1, true);
    if (Math.random() < dt * 14) S.fx.push({ kind: 'fire', x: e.x + rand(-5, 5), y: e.y + rand(-5, 5), vx: rand(-8, 8), vy: rand(-30, -14), r: rand(3, 6), life: 0.35, max: 0.35 });
    if (e.dead) return;
  }
  e.cur = e.speed * (1 - e.slowF) * (e.burrowed ? 1.2 : 1);
  e.d += e.cur * dt;
  if (e.d >= e.route.total) {
    e.dead = true;
    const lost = def.lives || 1;
    S.lives = Math.max(0, S.lives - lost);
    S.houseHit = 0.5; S.leakFlash = 0.4;
    addShake(lost > 2 ? 9 : 3);
    floatText(`-${lost} ${lost === 1 ? 'life' : 'lives'}`, S.M.end.x, S.M.end.y - 40, '#e0675b', 16);
    Sound.play('leak'); buzz(40); bumpStat('.stat-lives');
    return;
  }
  placeOnPath(e);
  if (!onField(e) || e.burrowed) return;

  if (def.summon && (e.sumCd -= dt) <= 0) {
    e.sumCd = def.summon.every;
    if (e.d > 40 && !e.fly) {
      for (let i = 0; i < def.summon.n; i++) spawnEnemy(def.summon.type, e.wave, e.route, Math.max(0, e.d - 10 - i * 12));
      for (let i = 0; i < 6; i++) S.fx.push({ kind: 'smoke', x: e.x + rand(-12, 12), y: e.y + rand(-12, 12), vx: rand(-10, 10), vy: rand(-10, 10), r: rand(6, 10), grow: 14, life: 0.9, max: 0.9, color: '120,150,90' });
      Sound.play('summon');
    }
  }
  if (def.heal && (e.healCd -= dt) <= 0) {
    e.healCd = def.heal.every;
    const r2 = (def.heal.radius * TILE) ** 2;
    for (const z of S.enemies) {
      if (z.dead || z.hp >= z.maxHp || dist2(z.x, z.y, e.x, e.y) > r2) continue;
      z.hp = Math.min(z.maxHp, z.hp + z.maxHp * def.heal.pct);
    }
    S.fx.push({ kind: 'ring', x: e.x, y: e.y, r: def.heal.radius * TILE * 0.5, life: 0.6, max: 0.6, color: '134,200,90' });
    Sound.play('heal');
  }
  if (def.stomp && (e.stompCd -= dt) <= 0) {
    e.stompCd = def.stomp.every;
    const r2 = (def.stomp.radius * TILE) ** 2;
    let hit = 0;
    for (const t of S.towers) if (dist2(t.x, t.y, e.x, e.y) <= r2) { t.stun = def.stomp.dur; hit++; }
    S.fx.push({ kind: 'ring', x: e.x, y: e.y, r: def.stomp.radius * TILE * 0.45, life: 0.7, max: 0.7, color: '200,235,255' });
    if (hit) floatText('Towers frozen', e.x, e.y - e.r * 2.5, '#bfe6ff', 16);
    addShake(7); Sound.play('stomp');
  }
}

function damage(e, amount, tower, pierce = 0, quiet = false) {
  if (e.dead) return;
  const dmg = Math.max(amount * 0.2, amount - e.armor * (1 - pierce));
  e.hp -= dmg;
  if (!quiet) e.flash = 0.06;
  if (tower) tower.dealt = (tower.dealt || 0) + dmg;
  if (e.hp <= 0) kill(e, tower);
}

function kill(e, tower) {
  e.dead = true;
  const def = ZOMBIES[e.type];
  S.cash += e.reward;
  const ichor = def.look.kind === 'skeleton' ? '#cfc8b4' : def.look.kind === 'ghost' ? '#cfe3ea' : def.look.kind === 'bloater' ? '#8a9a3a' : def.fly ? '#2a2026' : '#5a1410';
  const n = def.boss ? 30 : 8;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(30, def.boss ? 200 : 110);
    S.fx.push({ kind: 'debris', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(1.2, def.boss ? 4 : 2.6), color: ichor, life: 0.5, max: 0.5 });
  }
  if (!e.fly && def.look.kind !== 'ghost') {
    S.decals.push({ kind: 'splat', x: e.x, y: e.y, r: e.r * rand(0.9, 1.3), color: ichor, life: 9, max: 9, seed: Math.random() * 1000 });
    if (S.decals.length > 90) S.decals.shift();
  }
  if (def.look.kind === 'bloater') {
    for (let i = 0; i < 6; i++) S.fx.push({ kind: 'smoke', x: e.x, y: e.y, vx: rand(-30, 30), vy: rand(-30, 30), r: e.r * 0.7, grow: 20, life: 1.1, max: 1.1, color: '150,170,60' });
  }
  if (tower) tower.kills++;
  Sound.play('splat');
  if (def.splits) for (let i = 0; i < def.splits.n; i++) spawnEnemy(def.splits.type, e.wave, e.route, Math.max(0, e.d - 4 - i * 12));
  if (def.boss) {
    explosion(e.x, e.y, e.r * 2.4, true);
    floatText(`${def.name} down`, e.x, e.y - 40, '#e3a83e', 22);
  }
}

// ============================================================
// Towers
// ============================================================
function canPlaceAt(type, col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return false;
  const k = row * COLS + col;
  if (S.towerAt.has(k)) return false;
  return TOWERS[type].place === 'water' ? S.M.grid[k] === 3 : S.M.grid[k] === 0;
}

function makeTower(type, col, row) {
  const t = {
    type, col, row, x: col * TILE + TILE / 2, y: row * TILE + TILE / 2,
    level: 0, angle: -Math.PI / 2, cd: 0.3, cd2: 1, recoil: 0, spent: costOf(TOWERS[type].cost), stun: 0,
    mode: type === 'sniper' ? 'strong' : 'first', kills: 0, dealt: 0,
    ax: col * TILE + TILE / 2, ay: row * TILE + TILE / 2, orb: Math.random() * TAU, sonarPing: 0,
  };
  S.towers.push(t);
  S.towerAt.set(row * COLS + col, t);
  return t;
}

function placeTower(type, col, row) {
  const t = makeTower(type, col, row);
  S.cash -= costOf(TOWERS[type].cost);
  S.dirty = true;
  buzz(12);
  for (let i = 0; i < 8; i++) S.fx.push({ kind: 'smoke', x: t.x + rand(-14, 14), y: t.y + rand(-14, 14), vx: rand(-20, 20), vy: rand(-20, 20), r: rand(4, 7), grow: 10, life: 0.6, max: 0.6, color: '170,160,140' });
  Sound.play('place');
  if (type === 'jet') Sound.play('jet');
  return t;
}

function upgradeTower(t) {
  const next = TOWERS[t.type].levels[t.level + 1];
  if (!next || S.cash < costOf(next.cost) || S.state !== 'playing') { Sound.play('error'); return; }
  S.cash -= costOf(next.cost);
  t.spent += costOf(next.cost);
  t.level++;
  S.dirty = true;
  floatText(next.name, t.x, t.y - 30, '#e3a83e', 15);
  Sound.play('upgrade');
  renderInfo(); updateHUD(true);
}

const sellValue = (t) => Math.floor(t.spent * (0.7 + 0.05 * upg('salvage')));
function sellTower(t) {
  if (S.state !== 'playing') return;
  S.cash += sellValue(t);
  S.dirty = true;
  S.towers = S.towers.filter((o) => o !== t);
  S.towerAt.delete(t.row * COLS + t.col);
  floatText(`+$${sellValue(t)}`, t.x, t.y - 20, '#86b356', 15);
  if (S.selected === t) S.selected = null;
  Sound.play('sell');
  renderInfo(); updateHUD(true);
}

function findTarget(t, range, ox, oy, mode) {
  const air = TOWERS[t.type].air;
  let best = null, bestV = -Infinity;
  const r2 = range * range;
  for (const e of S.enemies) {
    if (!targetable(e, air)) continue;
    const d2 = dist2(e.x, e.y, ox, oy);
    if (d2 > r2) continue;
    let v;
    switch (mode || t.mode) {
      case 'last': v = -e.d / e.route.total; break;
      case 'strong': v = e.hp + e.d * 1e-4; break;
      case 'close': v = -d2; break;
      default: v = e.d / e.route.total;
    }
    if (v > bestV) { bestV = v; best = e; }
  }
  return best;
}
function turnToward(a, target, k) {
  let d = target - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * Math.min(1, k);
}

function updateTower(t, dt) {
  const def = TOWERS[t.type], st = def.levels[t.level];
  t.recoil = Math.max(0, t.recoil - dt * 6);
  t.sonarPing = Math.max(0, t.sonarPing - dt * 0.8);
  if (t.stun > 0) { t.stun -= dt; return; }
  t.cd -= dt; t.cd2 -= dt;

  if (t.type === 'heli') {
    // Fly toward the zombie furthest along any route, anywhere on the map.
    let goal = null, gv = -1;
    for (const e of S.enemies) { if (!targetable(e, true)) continue; const v = e.d / e.route.total; if (v > gv) { gv = v; goal = e; } }
    const gx = goal ? goal.x : t.x, gy = goal ? goal.y - 4 : t.y;
    const dx = gx - t.ax, dy = gy - t.ay, d = Math.hypot(dx, dy);
    const stand = goal ? st.range * TILE * 0.55 : 0;
    if (d > stand + 2) { const step = Math.min(d - stand, st.speed * dt); t.ax += (dx / d) * step; t.ay += (dy / d) * step; }
    const target = findTarget(t, st.range * TILE, t.ax, t.ay);
    const faceTo = target || goal;
    if (faceTo) t.angle = turnToward(t.angle, Math.atan2(faceTo.y - t.ay, faceTo.x - t.ax), dt * 6);
    if (target && t.cd <= 0) {
      t.cd = st.rate;
      hitscan(t, target, st.dmg, 0.3, t.ax + Math.cos(t.angle) * 14, t.ay + Math.sin(t.angle) * 14, '255,220,150', 1.2);
      Sound.play('heli');
    }
    if (target && st.rocket && t.cd2 <= 0) {
      t.cd2 = st.rocketRate;
      launchMissile(t, target, st.rocket, 0.9 * TILE, t.ax, t.ay, 420);
    }
    return;
  }
  if (t.type === 'jet') {
    const R = st.orbit * TILE;
    t.orb += dt * (330 / R);
    const px = t.ax, py = t.ay;
    t.ax = t.x + Math.cos(t.orb) * R; t.ay = t.y + Math.sin(t.orb) * R * 0.75;
    t.angle = Math.atan2(t.ay - py, t.ax - px);
    if (t.cd <= 0) {
      const picks = S.enemies.filter((e) => targetable(e, true) && dist2(e.x, e.y, t.ax, t.ay) < (st.range * TILE) ** 2)
        .sort((a, b) => dist2(a.x, a.y, t.ax, t.ay) - dist2(b.x, b.y, t.ax, t.ay));
      if (picks.length) {
        t.cd = st.rate;
        for (let i = 0; i < st.missiles; i++) launchMissile(t, picks[i % picks.length], st.dmg, (st.splash || 0) * TILE, t.ax, t.ay, 520);
      }
    }
    return;
  }
  if (t.type === 'sub') {
    const r2 = (st.range * TILE) ** 2;
    for (const e of S.enemies) if (e.burrowed && dist2(e.x, e.y, t.x, t.y) <= r2) { e.revealed = true; if (t.sonarPing <= 0) t.sonarPing = 1; }
  }
  const target = findTarget(t, st.range * TILE, t.x, t.y);
  if (!target) return;
  if (t.type !== 'tesla') t.angle = turnToward(t.angle, Math.atan2(target.y - t.y, target.x - t.x), dt * 14);
  if (t.cd > 0) return;
  t.cd = st.rate;
  t.recoil = 1;
  fire(t, target, st);
}

function muzzle(t, len) { return { x: t.x + Math.cos(t.angle) * len, y: t.y + Math.sin(t.angle) * len }; }

// Instant hit with a tracer streak and a muzzle flash.
function hitscan(t, target, dmg, pierce, mx, my, color = '255,220,150', width = 1.4) {
  const ox = rand(-3, 3), oy = rand(-3, 3);
  S.fx.push({ kind: 'tracer', x1: mx, y1: my, x2: target.x + ox, y2: target.y + oy, life: 0.07, max: 0.07, color, width });
  S.fx.push({ kind: 'flash', x: mx, y: my, a: Math.atan2(target.y - my, target.x - mx), size: 6, life: 0.05, max: 0.05 });
  S.fx.push({ kind: 'debris', x: target.x + ox, y: target.y + oy, vx: rand(-40, 40), vy: rand(-40, 40), r: 1.4, color: target.fly ? '#2a2026' : '#5a1410', life: 0.25, max: 0.25 });
  damage(target, dmg, t, pierce);
}

function launchMissile(t, target, dmg, splash, x, y, speed) {
  S.projectiles.push({ kind: 'missile', x, y, vx: Math.cos(t.angle) * speed * 0.4, vy: Math.sin(t.angle) * speed * 0.4, speed, target, tx: target.x, ty: target.y, dmg, splash, tower: t, air: target.fly, life: 3, pierce: TOWERS[t.type].levels[t.level].pierce || 0 });
  Sound.play('missile');
}

function splashAt(x, y, radius, air, fn) {
  for (const e of S.enemies) {
    if (!targetable(e, true) || e.fly !== air) continue;
    if (dist2(e.x, e.y, x, y) <= (radius + e.r * 0.5) ** 2) fn(e);
  }
}

function explosion(x, y, r, big) {
  S.fx.push({ kind: 'blast', x, y, r, life: 0.45, max: 0.45 });
  for (let i = 0; i < (big ? 14 : 7); i++) S.fx.push({ kind: 'smoke', x: x + rand(-r * 0.4, r * 0.4), y: y + rand(-r * 0.4, r * 0.4), vx: rand(-25, 25), vy: rand(-25, 25), r: rand(r * 0.25, r * 0.45), grow: r * 0.8, life: rand(0.9, 1.6), max: 1.6, color: '60,56,52' });
  for (let i = 0; i < (big ? 16 : 8); i++) { const a = rand(0, TAU), sp = rand(60, 200); S.fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35, max: 0.35 }); }
  S.decals.push({ kind: 'scorch', x, y, r: r * 0.7, life: 12, max: 12, seed: Math.random() * 1000 });
  if (S.decals.length > 90) S.decals.shift();
  addShake(big ? 10 : 3);
  Sound.play('boom');
}

function fire(t, target, st) {
  switch (t.type) {
    case 'gunner': {
      const offs = st.twin ? [-3.5, 3.5] : [0];
      for (const o of offs) {
        const m = muzzle(t, 20);
        hitscan(t, target, st.dmg, st.pierce || 0, m.x - Math.sin(t.angle) * o, m.y + Math.cos(t.angle) * o);
      }
      Sound.play('mg');
      break;
    }
    case 'sniper': {
      const m = muzzle(t, 26);
      hitscan(t, target, st.dmg, st.pierce, m.x, m.y, '255,240,200', 1.8);
      S.fx.push({ kind: 'smoke', x: m.x, y: m.y, vx: Math.cos(t.angle) * 20, vy: Math.sin(t.angle) * 20, r: 3, grow: 10, life: 0.6, max: 0.6, color: '200,200,200' });
      Sound.play('sniper');
      break;
    }
    case 'mortar': {
      const dur = 0.9;
      const lead = pointOn(target.route, target.d + target.cur * dur);
      S.projectiles.push({ kind: 'shell', sx: t.x, sy: t.y, ex: lead.x, ey: lead.y, x: t.x, y: t.y, h: 0, t: 0, dur, dmg: st.dmg, splash: st.splash * TILE, tower: t });
      S.fx.push({ kind: 'smoke', x: t.x, y: t.y, vx: 0, vy: 0, r: 6, grow: 16, life: 0.7, max: 0.7, color: '190,185,170' });
      S.fx.push({ kind: 'flash', x: t.x + 3, y: t.y, a: t.angle, size: 9, life: 0.06, max: 0.06 });
      Sound.play('mortar');
      break;
    }
    case 'cryo': {
      const m = muzzle(t, 20);
      S.projectiles.push({ kind: 'canister', x: m.x, y: m.y, target, tx: target.x, ty: target.y, speed: 380, dmg: st.dmg, splash: st.splash * TILE, slow: st.slow, slowDur: st.slowDur, tower: t });
      Sound.play('cryo');
      break;
    }
    case 'flame': {
      const m = muzzle(t, 18);
      splashAt(target.x, target.y, st.splash * TILE, false, (e) => {
        damage(e, st.dmg, t);
        if (!e.dead) { e.burnDps = Math.max(e.burnT > 0 ? e.burnDps : 0, st.burn); e.burnT = Math.max(e.burnT, st.burnDur); e.burnSrc = t; }
      });
      for (let i = 0; i < 6; i++) {
        const k = rand(0.16, 0.26);
        const tx = target.x + rand(-12, 12), ty = target.y + rand(-12, 12);
        S.fx.push({ kind: 'fire', x: m.x, y: m.y, vx: (tx - m.x) / k, vy: (ty - m.y) / k, r: rand(3, 6), grow: 10, life: k, max: k });
      }
      Sound.play('flame');
      break;
    }
    case 'tesla': {
      const pts = [{ x: t.x, y: t.y }, { x: target.x, y: target.y }];
      const hit = new Set([target]);
      let cur = target, dmg = st.dmg;
      damage(target, dmg, t, 1);
      for (let i = 1; i < st.chain; i++) {
        let next = null, bd = (TILE * 1.9) ** 2;
        for (const e of S.enemies) {
          if (!targetable(e, true) || hit.has(e)) continue;
          const d2 = dist2(e.x, e.y, cur.x, cur.y);
          if (d2 < bd) { bd = d2; next = e; }
        }
        if (!next) break;
        dmg *= 0.82; hit.add(next); pts.push({ x: next.x, y: next.y });
        damage(next, dmg, t, 1); cur = next;
      }
      S.fx.push({ kind: 'arc', pts, life: 0.16, max: 0.16, seed: Math.random() * 1000 });
      Sound.play('zap');
      break;
    }
    case 'gunboat': {
      const offs = st.twin ? [-3, 3] : [0];
      for (const o of offs) {
        const m = muzzle(t, 20);
        S.projectiles.push({ kind: 'round', x: m.x - Math.sin(t.angle) * o, y: m.y + Math.cos(t.angle) * o, target, tx: target.x, ty: target.y, speed: 620, dmg: st.dmg, splash: st.splash * TILE, tower: t, air: target.fly });
        S.fx.push({ kind: 'flash', x: m.x, y: m.y, a: t.angle, size: 8, life: 0.06, max: 0.06 });
      }
      Sound.play('cannon');
      break;
    }
    case 'sub': {
      const n = st.missiles || 1;
      const picks = S.enemies.filter((e) => targetable(e, true) && dist2(e.x, e.y, t.x, t.y) <= (st.range * TILE) ** 2).sort((a, b) => b.hp - a.hp);
      for (let i = 0; i < n; i++) launchMissile(t, picks[i % picks.length] || target, st.dmg, 0, t.x, t.y, 460);
      S.fx.push({ kind: 'ring', x: t.x, y: t.y, r: 10, life: 0.5, max: 0.5, color: '220,240,255' });
      break;
    }
  }
}

function updateProjectile(p, dt) {
  if (p.kind === 'shell') {
    p.t += dt;
    const k = Math.min(1, p.t / p.dur);
    p.x = lerp(p.sx, p.ex, k); p.y = lerp(p.sy, p.ey, k);
    p.h = Math.sin(k * Math.PI) * 60;
    if (k >= 1) {
      p.done = true;
      splashAt(p.x, p.y, p.splash, false, (e) => damage(e, p.dmg * (1 - 0.4 * clamp(Math.sqrt(dist2(e.x, e.y, p.x, p.y)) / p.splash, 0, 1)), p.tower));
      explosion(p.x, p.y, p.splash, false);
    }
    return;
  }
  if (p.kind === 'missile') {
    p.life -= dt;
    if (p.target && !targetable(p.target, true)) {
      // retarget to the nearest zombie of the same kind, or fly on and burst
      let best = null, bd = (TILE * 3) ** 2;
      for (const e of S.enemies) if (targetable(e, true) && e.fly === p.air) { const d = dist2(e.x, e.y, p.x, p.y); if (d < bd) { bd = d; best = e; } }
      p.target = best;
    }
    if (p.target) { p.tx = p.target.x; p.ty = p.target.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy) || 1;
    p.vx = lerp(p.vx, (dx / d) * p.speed, Math.min(1, dt * 6));
    p.vy = lerp(p.vy, (dy / d) * p.speed, Math.min(1, dt * 6));
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (Math.random() < 0.7) S.fx.push({ kind: 'smoke', x: p.x, y: p.y, vx: 0, vy: 0, r: 2, grow: 8, life: 0.45, max: 0.45, color: '200,200,200' });
    if (d < 8 || p.life <= 0) {
      p.done = true;
      if (p.splash > 0) {
        splashAt(p.x, p.y, p.splash, p.air, (e) => damage(e, p.dmg, p.tower, p.pierce));
        explosion(p.x, p.y, p.splash, false);
      } else {
        if (p.target) damage(p.target, p.dmg, p.tower, p.pierce);
        S.fx.push({ kind: 'blast', x: p.x, y: p.y, r: 12, life: 0.25, max: 0.25 });
        Sound.play('cannon');
      }
    }
    return;
  }
  if (p.target && targetable(p.target, true)) { p.tx = p.target.x; p.ty = p.target.y; } else p.target = null;
  const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = p.speed * dt;
  if (d <= step + 4) {
    p.done = true;
    if (p.kind === 'canister') {
      splashAt(p.tx, p.ty, p.splash, false, (e) => {
        if (!ZOMBIES[e.type].noSlow) { e.slowF = Math.max(e.slowT > 0 ? e.slowF : 0, p.slow); e.slowT = Math.max(e.slowT, p.slowDur); }
        damage(e, p.dmg, p.tower);
      });
      S.fx.push({ kind: 'frost', x: p.tx, y: p.ty, r: p.splash, life: 0.5, max: 0.5 });
      for (let i = 0; i < 8; i++) S.fx.push({ kind: 'smoke', x: p.tx, y: p.ty, vx: rand(-40, 40), vy: rand(-40, 40), r: 4, grow: 14, life: 0.6, max: 0.6, color: '225,240,250' });
    } else if (p.kind === 'round') {
      splashAt(p.tx, p.ty, p.splash, !!p.air, (e) => damage(e, p.dmg, p.tower));
      S.fx.push({ kind: 'blast', x: p.tx, y: p.ty, r: p.splash * 0.8, life: 0.3, max: 0.3 });
    }
  } else { p.x += (dx / d) * step; p.y += (dy / d) * step; }
}

// ============================================================
// Power-ups (bought in the store)
// ============================================================
const POWER_ICONS = {
  airstrike: '<svg viewBox="0 0 24 24"><path d="M12 2l2 6 7 3-7 2-2 9-2-9-7-2 7-3z"/></svg>',
  cryobomb: '<svg viewBox="0 0 24 24"><path d="M12 2v20M4 7l16 10M20 7L4 17M9 3l3 3 3-3M9 21l3-3 3 3"/></svg>',
  supply: '<svg viewBox="0 0 24 24"><path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/></svg>',
  medkit: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M9 6V4h6v2M12 10v6M9 13h6"/></svg>',
};
function usePower(kind) {
  if (S.state !== 'playing' || S.paused || (meta.items[kind] | 0) <= 0) { Sound.play('error'); return; }
  Sound.init();
  if (kind === 'airstrike') {
    S.power = S.power === 'airstrike' ? null : 'airstrike';
    S.placing = null; S.selected = null;
    renderPowerbar(); renderInfo();
    return;
  }
  meta.items[kind]--; saveMeta();
  const e = effWave(S.L, Math.max(1, S.wave));
  if (kind === 'cryobomb') {
    for (const z of S.enemies) { const boss = ZOMBIES[z.type].boss; z.slowF = boss ? 0.5 : 0.97; z.slowT = 3; }
    S.freezeFlash = 0.6; Sound.play('cryo');
    showBanner('Cryo bomb', 'The horde is frozen');
  } else if (kind === 'supply') {
    const amount = Math.round(150 + e * 25);
    S.cash += amount; Sound.play('coin');
    floatText(`Supply drop +$${amount}`, W / 2, H / 2, '#86b356', 22);
  } else if (kind === 'medkit') {
    S.lives = Math.min(S.maxLives, S.lives + 5);
    floatText('+5 lives', S.M.end.x, S.M.end.y - 40, '#86b356', 18);
  }
  renderPowerbar(); updateHUD(true);
}
function callAirstrike(x, y) {
  meta.items.airstrike--; saveMeta();
  S.power = null;
  const e = effWave(S.L, Math.max(1, S.wave));
  const dmg = 60 * hpScale(e);
  for (let i = 0; i < 7; i++) S.strikes.push({ t: 0.6 + i * 0.12, x: x + rand(-1, 1) * TILE * 1.2, y: y + rand(-1, 1) * TILE * 1.2, dmg });
  S.fx.push({ kind: 'jetpass', x: -60, y: y - 30, tx: W + 60, life: 1.2, max: 1.2 });
  Sound.play('jet');
  renderPowerbar();
}

// ============================================================
// Effects
// ============================================================
function floatText(text, x, y, color, size = 16) { S.fx.push({ kind: 'text', text, x, y, vy: -30, color, size, life: 1.2, max: 1.2 }); }
function addShake(m) { S.shake = Math.max(S.shake, m); }
function showBanner(text, sub) { S.banner = { text, sub, t: 0, dur: 2.8 }; }

function updateFx(dt) {
  for (const f of S.fx) {
    f.life -= dt;
    if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; }
    if (f.kind === 'debris' || f.kind === 'spark') { f.vx *= 0.9; f.vy *= 0.9; }
    if (f.kind === 'smoke') { f.vx *= 0.96; f.vy *= 0.96; }
    if (f.kind === 'text') f.vy *= 0.95;
  }
  S.fx = S.fx.filter((f) => f.life > 0);
  for (const d of S.decals) d.life -= dt;
  S.decals = S.decals.filter((d) => d.life > 0);
}

function drawFx(c, f, lights) {
  const k = f.life / f.max; // 1 -> 0
  c.save();
  switch (f.kind) {
    case 'tracer':
      c.globalAlpha = k; c.lineCap = 'round';
      c.strokeStyle = `rgba(${f.color},0.9)`; c.lineWidth = f.width || 1.4;
      c.beginPath(); c.moveTo(lerp(f.x1, f.x2, 0.15), lerp(f.y1, f.y2, 0.15)); c.lineTo(f.x2, f.y2); c.stroke();
      break;
    case 'flash':
      c.translate(f.x, f.y); c.rotate(f.a);
      c.fillStyle = `rgba(255,230,160,${k})`;
      c.beginPath(); c.moveTo(0, -f.size * 0.4); c.lineTo(f.size * 1.6, 0); c.lineTo(0, f.size * 0.4); c.closePath(); c.fill();
      circle(c, 0, 0, f.size * 0.5); c.fill();
      if (lights) lights.push({ x: f.x, y: f.y, r: f.size * 6, color: '255,200,120', a: 0.6 * k });
      break;
    case 'debris':
      c.globalAlpha = Math.min(1, k * 2); circle(c, f.x, f.y, f.r); c.fillStyle = f.color; c.fill(); break;
    case 'spark':
      c.globalAlpha = k; c.strokeStyle = '#ffd28a'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.x - f.vx * 0.03, f.y - f.vy * 0.03); c.stroke(); break;
    case 'smoke': {
      const r = f.r + (1 - k) * (f.grow || 10);
      c.globalAlpha = k * 0.45;
      c.fillStyle = radial(c, f.x, f.y, r, `rgba(${f.color},0.9)`, `rgba(${f.color},0)`, 0, 0);
      circle(c, f.x, f.y, r); c.fill();
      break;
    }
    case 'fire': {
      const r = f.r + (1 - k) * (f.grow || 4);
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = radial(c, f.x, f.y, r, `rgba(255,${Math.round(150 + k * 90)},80,${0.8 * k})`, 'rgba(255,80,20,0)', 0, 0);
      circle(c, f.x, f.y, r); c.fill();
      if (lights && Math.random() < 0.3) lights.push({ x: f.x, y: f.y, r: 26, color: '255,140,50', a: 0.25 * k });
      break;
    }
    case 'blast': {
      const g = 1 - k, r = f.r * (0.4 + Math.sqrt(g) * 0.8);
      c.globalAlpha = Math.min(1, k * 1.6);
      c.fillStyle = radial(c, f.x, f.y, r, 'rgba(255,245,200,1)', 'rgba(230,90,30,0)', 0, 0);
      circle(c, f.x, f.y, r); c.fill();
      c.fillStyle = radial(c, f.x, f.y, r * 0.6, 'rgba(255,255,230,0.9)', 'rgba(255,170,60,0)', 0, 0);
      circle(c, f.x, f.y, r * 0.6); c.fill();
      if (lights) lights.push({ x: f.x, y: f.y, r: f.r * 3, color: '255,150,60', a: 0.9 * k });
      break;
    }
    case 'frost':
      c.globalAlpha = k * 0.7;
      c.fillStyle = radial(c, f.x, f.y, f.r, 'rgba(235,248,255,0.9)', 'rgba(160,210,240,0)', 0, 0);
      circle(c, f.x, f.y, f.r * (0.7 + (1 - k) * 0.4)); c.fill();
      break;
    case 'ring':
      c.globalAlpha = k * 0.8; c.strokeStyle = `rgb(${f.color})`; c.lineWidth = 2;
      circle(c, f.x, f.y, f.r * (1 + (1 - k) * 1.3)); c.stroke(); break;
    case 'arc': {
      const rng = mulberry32(Math.floor(f.seed + (1 - k) * 5));
      c.beginPath();
      for (let i = 0; i < f.pts.length - 1; i++) {
        const a = f.pts[i], b = f.pts[i + 1];
        if (i === 0) c.moveTo(a.x, a.y);
        for (let j = 1; j <= 6; j++) {
          const tt = j / 6, jit = j === 6 ? 0 : 10;
          c.lineTo(lerp(a.x, b.x, tt) + (rng() - 0.5) * jit, lerp(a.y, b.y, tt) + (rng() - 0.5) * jit);
        }
      }
      c.lineJoin = 'round'; c.globalAlpha = k;
      c.strokeStyle = 'rgba(120,200,255,0.5)'; c.lineWidth = 5; c.stroke();
      c.strokeStyle = 'rgba(235,250,255,1)'; c.lineWidth = 1.6; c.stroke();
      if (lights) for (const p of f.pts) lights.push({ x: p.x, y: p.y, r: 40, color: '130,210,255', a: 0.7 * k });
      break;
    }
    case 'text': {
      c.globalAlpha = Math.min(1, k * 2.5);
      c.font = `700 ${f.size}px ${FONT_DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillText(f.text.toUpperCase(), f.x + 1, f.y + 1.5);
      c.fillStyle = f.color; c.fillText(f.text.toUpperCase(), f.x, f.y);
      break;
    }
    case 'jetpass': {
      const x = lerp(f.x, f.tx, 1 - k);
      c.translate(x, f.y);
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.moveTo(30, 40); c.lineTo(6, 26); c.lineTo(10, 40); c.lineTo(6, 54); c.closePath(); c.fill();
      c.fillStyle = '#7c858b';
      c.beginPath(); c.moveTo(18, 0); c.lineTo(-6, -14); c.lineTo(-2, 0); c.lineTo(-6, 14); c.closePath(); c.fill();
      if (lights) lights.push({ x: x - 10, y: f.y, r: 20, color: '255,170,80', a: 0.6 });
      break;
    }
  }
  c.restore();
}

function drawProjectile(c, p, lights) {
  if (p.kind === 'shell') {
    ellipse(c, p.x + p.h * 0.25, p.y + p.h * 0.35, 3, 2); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
    circle(c, p.x, p.y - p.h * 0.4, 3 + p.h / 40); c.fillStyle = '#2a2c28'; c.fill();
  } else if (p.kind === 'canister') {
    circle(c, p.x, p.y, 3.5); c.fillStyle = '#dff1fa'; c.fill();
  } else if (p.kind === 'round') {
    circle(c, p.x, p.y, 2.5); c.fillStyle = '#ffd28a'; c.fill();
  } else if (p.kind === 'missile') {
    const a = Math.atan2(p.vy, p.vx);
    c.save(); c.translate(p.x, p.y); c.rotate(a);
    c.fillStyle = '#d8d8d2'; c.fillRect(-5, -1.3, 9, 2.6);
    c.fillStyle = '#ffb35a'; circle(c, -6, 0, 2); c.fill();
    c.restore();
    if (lights) lights.push({ x: p.x, y: p.y, r: 14, color: '255,170,80', a: 0.6 });
  }
}

// ---------- weather & lighting ----------
const TIME_LIGHT = {
  day:   { tint: null, dark: 0, glow: 0.25 },
  dawn:  { tint: 'rgba(255,150,100,0.12)', dark: 0.12, glow: 0.55 },
  dusk:  { tint: 'rgba(130,60,40,0.22)', dark: 0.25, glow: 0.75 },
  night: { tint: 'rgba(10,18,40,0.4)', dark: 0.32, glow: 1 },
};
function initWeather() {
  S.weather = [];
  const w = S.L.look.weather;
  const n = w === 'rain' ? 140 : w === 'snow' ? 110 : w === 'fog' || w === 'mist' ? 7 : 0;
  for (let i = 0; i < n; i++) S.weather.push({ x: rand(0, W), y: rand(0, H), s: rand(0.6, 1.4), p: rand(0, TAU) });
}
function updateWeather(dt) {
  const w = S.L.look.weather;
  for (const q of S.weather) {
    if (w === 'rain') { q.x -= 120 * dt * q.s; q.y += 620 * dt * q.s; }
    else if (w === 'snow') { q.x += Math.sin(S.anim + q.p) * 20 * dt; q.y += 40 * dt * q.s; }
    else { q.x += 12 * dt * q.s; }
    if (q.y > H + 10) { q.y = -10; q.x = rand(0, W + 100); }
    if (q.x < -120) q.x = W + 100;
    if (q.x > W + 160) q.x = -150;
  }
}
function drawWeather(c) {
  const w = S.L.look.weather;
  if (w === 'rain') {
    c.strokeStyle = 'rgba(190,205,220,0.35)'; c.lineWidth = 1;
    c.beginPath();
    for (const q of S.weather) { c.moveTo(q.x, q.y); c.lineTo(q.x + 3 * q.s, q.y - 14 * q.s); }
    c.stroke();
  } else if (w === 'snow') {
    c.fillStyle = 'rgba(255,255,255,0.8)';
    for (const q of S.weather) { c.beginPath(); c.arc(q.x, q.y, 1.2 * q.s, 0, TAU); c.fill(); }
  } else if (w === 'fog' || w === 'mist') {
    const col = w === 'mist' ? '170,190,120' : '200,205,210';
    for (const q of S.weather) {
      const r = 160 * q.s;
      c.fillStyle = radial(c, q.x, q.y, r, `rgba(${col},0.22)`, `rgba(${col},0)`, 0, 0);
      c.fillRect(q.x - r, q.y - r, r * 2, r * 2);
    }
  }
}

// ============================================================
// Update & render
// ============================================================
function update(dt) {
  S.time += dt;
  for (const sp of S.spawners) {
    if (sp.done) continue;
    sp.time += dt;
    while (sp.queue.length && sp.queue[0].t <= sp.time) {
      const type = sp.queue.shift().type, n = sp.n++;
      const routes = ZOMBIES[type].fly ? S.M.flights : S.M.paths;
      spawnEnemy(type, sp.wave, routes[n % routes.length]);
    }
    if (!sp.queue.length) sp.done = true;
  }
  for (const e of S.enemies) e.revealed = false;
  for (const e of S.enemies) if (!e.dead) updateEnemy(e, dt);
  for (const t of S.towers) updateTower(t, dt);
  for (const p of S.projectiles) if (!p.done) updateProjectile(p, dt);
  for (const s of S.strikes) {
    s.t -= dt;
    if (s.t <= 0 && !s.done) {
      s.done = true;
      splashAt(s.x, s.y, TILE * 1.3, false, (e) => damage(e, s.dmg, null, 0.5));
      explosion(s.x, s.y, TILE * 1.3, true);
    }
  }
  S.strikes = S.strikes.filter((s) => !s.done);
  S.projectiles = S.projectiles.filter((p) => !p.done);
  S.enemies = S.enemies.filter((e) => !e.dead);
  for (const sp of S.spawners) {
    if (sp.done && !sp.paid && !S.enemies.some((e) => e.wave === sp.wave)) {
      sp.paid = true;
      const bonus = waveBonus(S.L, sp.wave);
      S.cash += bonus; S.dirty = true;
      floatText(`Wave ${sp.wave} cleared +$${bonus}`, W / 2, H / 2 - 40, '#e3a83e', 22);
      Sound.play('coin'); bumpStat('.stat-cash');
    }
  }
  S.spawners = S.spawners.filter((sp) => !sp.paid);
  updateFx(dt);
  if (S.lives <= 0) { gameOver(); return; }
  const idle = !S.spawners.length && !S.enemies.length;
  if (S.wave >= S.L.waves && idle) { victory(); return; }
  if (idle && S.dirty) checkpoint();
  if (S.auto && idle) { S.autoT += dt; if (S.autoT > 1.6) { S.autoT = 0; startWave(); } } else S.autoT = 0;
}

function drawRange(c, x, y, r, ok, t) {
  c.save();
  circle(c, x, y, r);
  c.fillStyle = ok ? 'rgba(255,255,255,0.08)' : 'rgba(201,72,61,0.12)'; c.fill();
  c.lineWidth = 1.5; c.strokeStyle = ok ? 'rgba(255,255,255,0.7)' : 'rgba(201,72,61,0.8)';
  c.setLineDash([8, 6]); c.lineDashOffset = -t * 16; c.stroke();
  c.restore();
}

function drawBossPlate(c) {
  const boss = S.enemies.find((e) => ZOMBIES[e.type].boss);
  if (!boss) return;
  const def = ZOMBIES[boss.type];
  const w = 360, h = 40, x = (W - w) / 2, y = 10;
  c.save();
  c.fillStyle = 'rgba(12,15,18,0.88)';
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + w - 12, y); c.lineTo(x + w, y + 12); c.lineTo(x + w, y + h); c.lineTo(x + 12, y + h); c.lineTo(x, y + h - 12); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(201,72,61,0.8)'; c.lineWidth = 1; c.stroke();
  c.fillStyle = '#c9483d'; c.fillRect(x + 10, y + 7, 40, 14);
  label(c, def.mini ? 'ELITE' : 'BOSS', x + 30, y + 14.5, 12, '#1a0a08');
  label(c, def.name.toUpperCase(), x + 60, y + 14.5, 16, '#ece6d6', 700, 'left');
  const k = clamp(boss.hp / boss.maxHp, 0, 1);
  c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x + 10, y + 26, w - 20, 7);
  c.fillStyle = linear(c, x, 0, x + w, 0, [[0, '#8e2e24'], [1, '#e0675b']]); c.fillRect(x + 10, y + 26, (w - 20) * k, 7);
  c.fillStyle = 'rgba(0,0,0,0.5)';
  for (let i = 1; i < 10; i++) c.fillRect(x + 10 + ((w - 20) * i) / 10, y + 26, 1, 7);
  c.restore();
}

function render() {
  const c = ctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, canvas.width, canvas.height);
  if (!S.M) return;
  let sx = 0, sy = 0;
  if (S.shake > 0.2) { sx = rand(-S.shake, S.shake); sy = rand(-S.shake, S.shake); }
  c.drawImage(bg, sx * scale, sy * scale);
  c.setTransform(scale, 0, 0, scale, sx * scale, sy * scale);
  const t = S.anim;
  const lights = [];
  const look = TIME_LIGHT[S.L.look.time];

  for (const d of S.decals) {
    c.save(); c.globalAlpha = Math.min(1, d.life / 2) * (d.kind === 'scorch' ? 0.5 : 0.6);
    const rng = mulberry32(Math.floor(d.seed));
    c.fillStyle = d.kind === 'scorch' ? '#14120f' : d.color;
    ellipse(c, d.x, d.y, d.r, d.r * 0.8, rng() * 3); c.fill();
    for (let i = 0; i < 6; i++) { const a = rng() * TAU, dd = d.r * (0.9 + rng() * 0.6); circle(c, d.x + Math.cos(a) * dd, d.y + Math.sin(a) * dd, d.r * (0.1 + rng() * 0.15)); c.fill(); }
    c.restore();
  }
  // hazard chevrons where the horde comes in
  for (const p of S.M.paths) {
    const s = p.segs[0], ang = Math.atan2(s.dy, s.dx);
    c.save(); c.translate(s.a.x + s.dx * 40, s.a.y + s.dy * 40); c.rotate(ang);
    for (let i = 0; i < 3; i++) {
      const kk = (t * 0.8 + i / 3) % 1;
      c.globalAlpha = Math.sin(kk * Math.PI) * 0.6;
      c.strokeStyle = '#c9483d'; c.lineWidth = 3; c.lineCap = 'square';
      const xx = kk * 30 - 10;
      c.beginPath(); c.moveTo(xx - 5, -8); c.lineTo(xx + 3, 0); c.lineTo(xx - 5, 8); c.stroke();
    }
    c.restore();
  }

  const h = S.hover;
  if (S.selected) {
    const tw = S.selected, st = TOWERS[tw.type].levels[tw.level];
    const air = tw.type === 'heli' || tw.type === 'jet';
    drawRange(c, air ? tw.ax : tw.x, air ? tw.ay : tw.y, st.range * TILE, true, t);
    if (tw.type === 'jet') { c.save(); c.strokeStyle = 'rgba(227,168,62,0.35)'; c.setLineDash([4, 6]); ellipse(c, tw.x, tw.y, st.orbit * TILE, st.orbit * TILE * 0.75); c.stroke(); c.restore(); }
  }
  const spot = S.pending || (h.inside && h.mouse ? h : null);
  if (S.placing && spot && S.state === 'playing') {
    const ok = canPlaceAt(S.placing, spot.col, spot.row) && S.cash >= costOf(TOWERS[S.placing].cost);
    const x = spot.col * TILE, y = spot.row * TILE;
    c.save();
    c.fillStyle = ok ? 'rgba(134,179,86,0.25)' : 'rgba(201,72,61,0.3)'; c.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    c.strokeStyle = ok ? '#86b356' : '#c9483d'; c.lineWidth = 1.5; c.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
    c.restore();
    if (TOWERS[S.placing].place === 'water') {
      c.save(); c.strokeStyle = 'rgba(143,199,230,0.5)'; c.lineWidth = 1; c.setLineDash([3, 4]);
      for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) if (canPlaceAt(S.placing, q, r)) c.strokeRect(q * TILE + 4, r * TILE + 4, TILE - 8, TILE - 8);
      c.restore();
    }
    drawRange(c, x + TILE / 2, y + TILE / 2, TOWERS[S.placing].levels[0].range * TILE, ok, t);
  } else if (!S.placing && !S.power && h.inside && h.mouse && S.state === 'playing') {
    const tw = S.towerAt.get(h.row * COLS + h.col);
    if (tw && tw !== S.selected) { c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1; c.strokeRect(h.col * TILE + 2, h.row * TILE + 2, TILE - 4, TILE - 4); }
  }

  // ground layer, sorted by depth
  const units = [];
  for (const tw of S.towers) units.push({ y: tw.y, tw });
  for (const e of S.enemies) if (!e.fly) units.push({ y: e.y, e });
  units.push({ y: S.M.end.y, house: true });
  units.sort((a, b) => a.y - b.y);
  for (const u of units) {
    if (u.tw) {
      drawTower(c, u.tw, t, lights);
      if (u.tw === S.selected) { c.save(); c.strokeStyle = `rgba(227,168,62,${0.6 + Math.sin(t * 6) * 0.3})`; c.lineWidth = 1.5; c.strokeRect(u.tw.x - 22, u.tw.y - 22, 44, 44); c.restore(); }
    } else if (u.e) drawZombie(c, u.e, t, lights);
    else {
      drawSafehouse(c, S.M.end.x, S.M.end.y, t, S.houseHit);
      lights.push({ x: S.M.end.x, y: S.M.end.y, r: 70, color: '255,210,140', a: 0.3 });
    }
  }
  for (const p of S.projectiles) drawProjectile(c, p, lights);
  // air layer
  for (const e of S.enemies) if (e.fly) drawZombie(c, e, t, lights);
  for (const tw of S.towers) if (tw.type === 'heli' || tw.type === 'jet') drawAircraft(c, tw, t, lights);
  for (const f of S.fx) drawFx(c, f, lights);

  // time of day, then lights on top
  if (look.tint) { c.fillStyle = look.tint; c.fillRect(-20, -20, W + 40, H + 40); }
  if (look.dark > 0) {
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${look.dark})`);
    c.fillStyle = g; c.fillRect(-20, -20, W + 40, H + 40);
  }
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const a = l.a * look.glow;
    if (a < 0.02) continue;
    c.fillStyle = radial(c, l.x, l.y, l.r, `rgba(${l.color},${a})`, `rgba(${l.color},0)`, 0, 0);
    c.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  c.restore();
  drawWeather(c);
  if (S.freezeFlash > 0) { c.fillStyle = `rgba(190,230,255,${S.freezeFlash * 0.5})`; c.fillRect(-20, -20, W + 40, H + 40); }
  if (S.leakFlash > 0) {
    c.save(); c.globalAlpha = S.leakFlash;
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, 'rgba(200,40,30,0)'); g.addColorStop(1, 'rgba(200,40,30,0.55)');
    c.fillStyle = g; c.fillRect(-20, -20, W + 40, H + 40);
    c.restore();
  }
  for (const e of S.enemies) drawHealthBar(c, e);

  if (S.placing && spot && S.state === 'playing' && canPlaceAt(S.placing, spot.col, spot.row)) {
    const gx = spot.col * TILE + TILE / 2, gy = spot.row * TILE + TILE / 2;
    const ghost = { type: S.placing, level: 0, x: gx, y: gy, angle: -Math.PI / 2, recoil: 0, ax: gx, ay: gy - 6 };
    drawTower(c, ghost, t, null, { alpha: 0.6 });
    if (S.placing === 'heli' || S.placing === 'jet') { c.save(); c.globalAlpha = 0.6; drawAircraft(c, ghost, t, null); c.restore(); }
    if (S.pending) label(c, 'TAP AGAIN TO BUILD', gx, gy - 34, 13, '#ece6d6');
  }
  if (S.power === 'airstrike' && h.inside) {
    c.save(); c.strokeStyle = 'rgba(201,72,61,0.9)'; c.lineWidth = 1.5;
    circle(c, h.x, h.y, TILE * 1.8); c.stroke();
    c.beginPath(); c.moveTo(h.x - 12, h.y); c.lineTo(h.x + 12, h.y); c.moveTo(h.x, h.y - 12); c.lineTo(h.x, h.y + 12); c.stroke();
    c.restore();
    label(c, 'TAP TO CALL AIRSTRIKE', h.x, h.y - TILE * 1.8 - 10, 13, '#ece6d6');
  }
  drawBossPlate(c);

  if (S.banner) {
    const b = S.banner, k = b.t / b.dur;
    const a = k < 0.1 ? k / 0.1 : k > 0.8 ? (1 - k) / 0.2 : 1;
    c.save(); c.globalAlpha = a;
    const y = H * 0.24;
    c.font = `800 46px ${FONT_DISPLAY}`;
    const tw = c.measureText(b.text.toUpperCase()).width;
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(W / 2 - tw / 2 - 40, y - 34, tw + 80, b.sub ? 86 : 64);
    c.fillStyle = '#e3a83e'; c.fillRect(W / 2 - tw / 2 - 40, y - 34, 4, b.sub ? 86 : 64);
    label(c, b.text.toUpperCase(), W / 2, y, 46, '#ece6d6', 800);
    if (b.sub) label(c, b.sub.toUpperCase(), W / 2, y + 36, 18, '#e3a83e', 600);
    c.restore();
  }
}

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  S.anim += dt;
  if (S.state === 'playing' && !S.paused) {
    for (let i = 0; i < S.speed; i++) { update(dt); if (S.state !== 'playing') break; }
  } else if (S.state === 'won' || S.state === 'over') updateFx(dt);
  if (!S.paused) {
    S.shake = Math.max(0, S.shake - dt * 30);
    S.houseHit = Math.max(0, S.houseHit - dt);
    S.leakFlash = Math.max(0, S.leakFlash - dt);
    S.freezeFlash = Math.max(0, S.freezeFlash - dt);
    if (S.banner) { S.banner.t += dt; if (S.banner.t >= S.banner.dur) S.banner = null; }
    if (S.L) updateWeather(dt);
  }
  if (S.state !== 'menu') render();
  updateHUD();
  requestAnimationFrame(frame);
}

// ============================================================
// HUD and side panel
// ============================================================
const hudCache = {};
function setText(sel, v) { if (hudCache[sel] === v) return; hudCache[sel] = v; $(sel).textContent = v; }
function bumpStat(sel) { const el = $(sel); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

let lastCashUi = -1;
function updateHUD(force) {
  if (!S.L) return;
  setText('#lives', String(S.lives));
  setText('#cash', String(Math.floor(S.cash)));
  setText('#wave', `${S.wave}/${S.L.waves}`);
  const btn = $('#btn-wave');
  const active = S.spawners.length > 0 || S.enemies.length > 0;
  let label2, disabled = S.state !== 'playing';
  if (S.wave >= S.L.waves) { label2 = 'Final wave'; disabled = true; }
  else if (S.wave === 0) label2 = 'Start wave 1';
  else if (active) label2 = `Wave ${S.wave + 1} early`;
  else label2 = `Start wave ${S.wave + 1}`;
  setText('#btn-wave', label2);
  if (btn.disabled !== disabled) btn.disabled = disabled;
  if (force || S.cash !== lastCashUi) {
    lastCashUi = S.cash;
    for (const b of document.querySelectorAll('.tower-btn')) b.classList.toggle('poor', S.cash < costOf(TOWERS[b.dataset.type].cost));
    refreshInfo();
  }
}

function iconCanvas(size, draw) {
  const cv = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = cv.height = Math.round(size * dpr);
  const c = cv.getContext('2d'); c.scale(dpr, dpr); draw(c);
  return cv;
}
const towerIcon = (type, level = 0, size = 56) => iconCanvas(size, (c) => drawTowerIcon(c, type, level, size));
const zombieIcon = (type, size = 30) => iconCanvas(size, (c) => drawZombieIcon(c, type, size));
const levelName = (i) => `${LEVEL_META[i].id} ${LEVEL_META[i].name}`;

function buildShop() {
  const shop = $('#shop');
  shop.innerHTML = '';
  for (const type of TOWER_KEYS) {
    const def = TOWERS[type];
    const open = towerUnlocked(type);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tower-btn' + (open ? '' : ' locked');
    b.dataset.type = type;
    b.title = open ? `${def.name}: ${def.desc} (key ${def.key})` : `${def.name} is locked. Clear ${levelName(def.unlock - 1)} or buy it in the store.`;
    b.append(towerIcon(type));
    b.insertAdjacentHTML('beforeend', `<span class="t-key">${def.key}</span><span class="t-role">${def.role}</span><span class="t-name">${def.name}</span><span class="t-cost">${open ? '$' + costOf(def.cost) : 'Locked'}</span>`);
    b.addEventListener('click', () => {
      Sound.init();
      if (!open) { floatText(`Clear ${LEVEL_META[def.unlock - 1].id} or buy in store`, W / 2, H / 2, '#e3a83e', 16); Sound.play('error'); return; }
      selectPlacing(type);
    });
    shop.append(b);
  }
}

function selectPlacing(type) {
  if (S.state !== 'playing') return;
  S.placing = S.placing === type ? null : type;
  S.pending = null; S.power = null;
  if (S.placing) S.selected = null;
  Sound.play('click');
  for (const b of document.querySelectorAll('.tower-btn')) b.classList.toggle('active', b.dataset.type === S.placing);
  renderInfo(); renderPowerbar();
}
function cancelAll() {
  S.placing = null; S.selected = null; S.pending = null; S.power = null;
  for (const b of document.querySelectorAll('.tower-btn')) b.classList.remove('active');
  renderInfo(); renderPowerbar();
}

const fmtRate = (r) => (1 / r).toFixed(1);
function statRows(st, next) {
  const rows = [['Damage', st.dmg, next && next.dmg], ['Shots / sec', fmtRate(st.rate), next && fmtRate(next.rate)], ['Range', st.range.toFixed(1), next && next.range.toFixed(1)]];
  if (st.splash) rows.push(['Splash', st.splash.toFixed(2), next && next.splash.toFixed(2)]);
  if (st.slow) rows.push(['Slow', Math.round(st.slow * 100) + '%', next && Math.round(next.slow * 100) + '%']);
  if (st.burn) rows.push(['Burn / sec', st.burn, next && next.burn]);
  if (st.chain) rows.push(['Chain', st.chain, next && next.chain]);
  if (st.pierce) rows.push(['Armor pierce', Math.round(st.pierce * 100) + '%', next && Math.round((next.pierce || 0) * 100) + '%']);
  if (st.missiles) rows.push(['Missiles', st.missiles, next && next.missiles]);
  if (st.rocket) rows.push(['Rockets', st.rocket, next && next.rocket]);
  return '<ul class="stat-list">' + rows.map(([k, v, n]) => {
    const up = n != null && String(n) !== String(v) ? ` <span class="up">→ ${n}</span>` : '';
    return `<li><span>${k}</span><b>${v}${up}</b></li>`;
  }).join('') + '</ul>';
}
function rankBar(level) { return `<div class="ranks">${[0, 1, 2, 3].map((i) => `<span class="rank${i <= level ? ' on' : ''}"></span>`).join('')}</div>`; }

function renderInfo() {
  const info = $('#info');
  info.innerHTML = '';
  $('.panel').classList.toggle('busy', !!(S.selected || S.placing));
  if (S.selected) {
    const t = S.selected, def = TOWERS[t.type], st = def.levels[t.level], next = def.levels[t.level + 1];
    const head = document.createElement('div'); head.className = 'info-head';
    head.append(towerIcon(t.type, t.level, 54));
    head.insertAdjacentHTML('beforeend', `<div class="plate"><span class="sub">${st.name === def.name ? def.role : st.name}</span><h3>${def.name}</h3>${rankBar(t.level)}</div>`);
    info.append(head);
    const canTarget = t.type !== 'jet';
    info.insertAdjacentHTML('beforeend', `
      ${statRows(st, next)}
      ${next ? `<p class="hint">Next: <b>${next.name}</b></p>` : ''}
      <p class="hint" id="info-kills"></p>
      <div class="info-actions">
        ${canTarget ? `<button class="btn wide" id="btn-target" type="button" title="Change targeting (T)">Target: ${MODES.find((m) => m[0] === t.mode)[1]}</button>` : ''}
        <button class="btn btn-primary" id="btn-upgrade" type="button" title="Upgrade (U)">${next ? `Upgrade $${costOf(next.cost)}` : 'Fully upgraded'}</button>
        <button class="btn btn-danger" id="btn-sell" type="button" title="Sell (S)">Sell $${sellValue(t)}</button>
      </div>`);
    if (canTarget) $('#btn-target').addEventListener('click', () => cycleTarget(t));
    $('#btn-upgrade').addEventListener('click', () => upgradeTower(t));
    $('#btn-sell').addEventListener('click', () => sellTower(t));
  } else if (S.placing) {
    const def = TOWERS[S.placing];
    const head = document.createElement('div'); head.className = 'info-head';
    head.append(towerIcon(S.placing, 0, 54));
    head.insertAdjacentHTML('beforeend', `<div class="plate"><span class="sub">${def.role} · $${costOf(def.cost)}</span><h3>${def.name}</h3></div>`);
    info.append(head);
    const where = def.place === 'water' ? 'a water tile' : 'an open ground tile';
    info.insertAdjacentHTML('beforeend', `<p>${def.desc}</p>${statRows(def.levels[0])}
      <p class="hint">${coarse() ? `Tap ${where} to preview, then tap it again to build.` : `Click ${where} to build. Hold <kbd>Shift</kbd> to build several. <kbd>Esc</kbd> cancels.`}${def.air ? '' : ' Cannot hit flying zombies.'}</p>`);
  } else if (S.power === 'airstrike') {
    info.innerHTML = `<h2 class="card-title">Airstrike</h2><p>${SUPPLIES.airstrike.desc}</p><p class="hint">Tap the battlefield to mark the target. Press <kbd>Esc</kbd> to cancel.</p>`;
  } else {
    info.innerHTML = `<h2 class="card-title">Briefing</h2>
      <p>Zombies follow the road to your base. Flyers cut across its corners. Every one that gets inside costs lives.</p>
      <p class="more">Pick a tower and place it on open ground. Boats only go on water. Tap a tower later to upgrade or sell it. Kills pay cash.</p>
      <p class="hint">Tap a dog tag below to learn what a zombie does.</p>`;
  }
  refreshInfo();
}
function refreshInfo() {
  const t = S.selected;
  if (!t) return;
  const next = TOWERS[t.type].levels[t.level + 1];
  const up = $('#btn-upgrade');
  if (up) up.disabled = !next || S.cash < costOf(next.cost) || S.state !== 'playing';
  const k = $('#info-kills');
  if (k) { const txt = `${t.kills} kill${t.kills === 1 ? '' : 's'} · ${Math.round(t.dealt)} damage`; if (k.textContent !== txt) k.textContent = txt; }
}
function cycleTarget(t) {
  const i = MODES.findIndex((m) => m[0] === t.mode);
  t.mode = MODES[(i + 1) % MODES.length][0];
  S.dirty = true; Sound.play('click');
  const b = $('#btn-target'); if (b) b.textContent = `Target: ${MODES.find((m) => m[0] === t.mode)[1]}`;
}

function zombieChip(type, labelText, isNew) {
  const z = ZOMBIES[type];
  const chip = document.createElement('span');
  chip.className = 'chip' + (z.boss ? ' boss' : '') + (z.fly ? ' air' : '');
  chip.title = `${z.name}: ${z.desc}`;
  chip.tabIndex = 0;
  chip.append(zombieIcon(type));
  if (labelText != null) chip.insertAdjacentHTML('beforeend', `<span>${labelText}</span>`);
  if (isNew) chip.insertAdjacentHTML('beforeend', '<span class="new-tag">New</span>');
  const show = () => { const box = chip.closest('.card, .world-card, .level-detail'); const tip = box && box.querySelector('.zombie-tip'); if (tip) { tip.textContent = `${z.name}: ${z.desc}`; tip.hidden = false; } };
  chip.addEventListener('click', show);
  chip.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); } });
  return chip;
}

function renderNextWave() {
  const box = $('#next-wave');
  if (!S.L) return;
  const n = S.wave + 1;
  box.innerHTML = '';
  const done = S.wave >= S.L.waves;
  box.insertAdjacentHTML('beforeend', `<h2 class="card-title">${done ? 'Final wave deployed' : `Incoming: wave ${n} of ${S.L.waves}`}</h2>`);
  if (done) { box.insertAdjacentHTML('beforeend', '<p class="hint">Clear the road to secure the sector.</p>'); return; }
  const chips = document.createElement('div'); chips.className = 'wave-chips';
  const fresh = newTypes(S.L, n);
  for (const [type, count] of Object.entries(waveSummary(S.L, n))) chips.append(zombieChip(type, `×${count}`, fresh.includes(type)));
  box.append(chips);
  box.insertAdjacentHTML('beforeend', `<p class="hint zombie-tip" hidden></p><p class="hint" style="margin:6px 0 0">Clear bonus $${waveBonus(S.L, n)}</p>`);
}

function renderPowerbar() {
  const bar = $('#powerbar');
  bar.innerHTML = '';
  for (const kind of Object.keys(SUPPLIES)) {
    const n = meta.items[kind] | 0;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'power' + (S.power === kind ? ' armed' : '');
    b.disabled = n <= 0 || S.state !== 'playing';
    b.title = `${SUPPLIES[kind].name}: ${SUPPLIES[kind].desc}${n <= 0 ? ' Buy more in the store.' : ''}`;
    b.innerHTML = `${POWER_ICONS[kind]}<span>${SUPPLIES[kind].name.split(' ')[0]}</span><span class="count">${n}</span>`;
    b.addEventListener('click', () => usePower(kind));
    bar.append(b);
  }
}

// ============================================================
// Menus: main, globe, level grid, store
// ============================================================
const SCREENS = ['#menu-screen', '#world-screen', '#levels-screen', '#store-screen', '#end-screen'];
function hideScreens() { for (const s of SCREENS) $(s).hidden = true; Globe.stop(); }
function coinText() { return `${meta.coins} coins`; }
function leaveGame() { if (S.state === 'playing') checkpoint(); S.state = 'menu'; setPaused(false); }

function showMenu() {
  leaveGame();
  hideScreens();
  $('#menu-screen').hidden = false;
  $('#menu-coins').textContent = coinText();
  const sv = loadSave();
  const box = $('#continue-box');
  box.hidden = !sv; box.innerHTML = '';
  if (sv) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn-lg';
    b.textContent = `Continue ${LEVEL_META[sv.level].id} · wave ${sv.wave + 1}`;
    b.addEventListener('click', () => { Sound.init(); startGame(sv.level, sv); });
    box.append(b);
  }
  renderInstall();
}

let globeReady = false;
function showWorlds(w = S.worldSel) {
  leaveGame();
  hideScreens();
  $('#world-screen').hidden = false;
  $('#world-coins').textContent = coinText();
  if (!globeReady) {
    Globe.isOpen = worldUnlocked;
    Globe.init($('#globe'), (i) => { Sound.play('click'); selectWorld(i); });
    globeReady = true;
    Globe.select(w, true);
  }
  selectWorld(w);
  Globe.start();
}
function worldStars(w) { let s = 0; for (let i = 0; i < LEVELS_PER_WORLD; i++) s += starsFor(w * LEVELS_PER_WORLD + i); return s; }
function worldCleared(w) { let s = 0; for (let i = 0; i < LEVELS_PER_WORLD; i++) if (starsFor(w * LEVELS_PER_WORLD + i)) s++; return s; }
function selectWorld(w) {
  S.worldSel = w;
  Globe.select(w);
  const world = WORLDS[w], open = worldUnlocked(w);
  const stars = worldStars(w), cleared = worldCleared(w);
  const card = $('#world-card');
  card.innerHTML = `
    <span class="w-index">World ${w + 1} of ${WORLDS.length}</span>
    <h3>${world.name}</h3>
    <p>${world.blurb}</p>
    <div class="world-meter" aria-hidden="true"><span style="width:${(cleared / LEVELS_PER_WORLD) * 100}%"></span></div>
    <div class="world-stats"><span><b>${cleared}</b> / ${LEVELS_PER_WORLD} cleared</span><span><b>${stars}</b> / ${LEVELS_PER_WORLD * 3} stars</span></div>
    <div class="wave-chips"></div>
    <p class="hint zombie-tip" hidden></p>
    ${open ? '' : `<p class="locked-note">Clear ${levelName(w * LEVELS_PER_WORLD - 1)} to unlock</p>`}
    <div class="world-nav">
      <button class="btn" type="button" id="w-prev" aria-label="Previous world">‹</button>
      <button class="btn btn-primary" type="button" id="w-go" ${open ? '' : 'disabled'}>Deploy</button>
      <button class="btn" type="button" id="w-next" aria-label="Next world">›</button>
    </div>`;
  const chips = card.querySelector('.wave-chips');
  for (const [type] of world.mobs) chips.append(zombieChip(type, ZOMBIES[type].name));
  chips.append(zombieChip(world.boss, ZOMBIES[world.boss].name));
  $('#w-prev').addEventListener('click', () => { Sound.play('click'); selectWorld((w + WORLDS.length - 1) % WORLDS.length); });
  $('#w-next').addEventListener('click', () => { Sound.play('click'); selectWorld((w + 1) % WORLDS.length); });
  $('#w-go').addEventListener('click', () => { Sound.play('click'); showLevels(w); });
}

function showLevels(w, focus) {
  leaveGame();
  hideScreens();
  $('#levels-screen').hidden = false;
  $('#levels-coins').textContent = coinText();
  $('#levels-title').textContent = `World ${w + 1} · ${WORLDS[w].name}`;
  S.worldSel = w;
  const grid = $('#level-grid');
  grid.innerHTML = '';
  let firstOpen = w * LEVELS_PER_WORLD;
  for (let k = 0; k < LEVELS_PER_WORLD; k++) {
    const i = w * LEVELS_PER_WORLD + k;
    const m = LEVEL_META[i], open = levelUnlocked(i), st = starsFor(i);
    if (open) firstOpen = i;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'level-btn' + (m.boss ? ' boss' : '') + (st ? ' done' : '');
    b.disabled = !open;
    b.dataset.index = i;
    b.title = `${m.id} ${m.name}`;
    b.innerHTML = `<span class="n">${m.num}</span><span class="s">${[1, 2, 3].map((s) => `<i class="${s <= st ? 'on' : ''}"></i>`).join('')}</span>`;
    b.addEventListener('click', () => { Sound.play('click'); selectLevel(i); });
    grid.append(b);
  }
  selectLevel(focus != null && levelUnlocked(focus) ? focus : firstOpen);
}

function selectLevel(i) {
  S.levelSel = i;
  for (const b of document.querySelectorAll('.level-btn')) b.classList.toggle('sel', +b.dataset.index === i);
  const L = getLevel(i), M = buildLevel(L);
  const box = $('#level-detail');
  box.innerHTML = '';
  const cv = document.createElement('canvas'); cv.width = 480; cv.height = 288;
  const c = cv.getContext('2d');
  renderBackground(c, M, 480 / W);
  c.setTransform(480 / W, 0, 0, 480 / W, 0, 0);
  drawSafehouse(c, M.end.x, M.end.y, 0, 0);
  const light = TIME_LIGHT[L.look.time];
  if (light.tint) { c.fillStyle = light.tint; c.fillRect(0, 0, W, H); }
  box.append(cv);
  const tags = [`${L.waves} waves`, L.look.time, L.look.weather === 'clear' ? 'clear skies' : L.look.weather];
  if (L.paths.length > 1) tags.push('2 entrances');
  if (L.water.some((v) => v)) tags.push('water');
  if (L.boss) tags.push(L.boss === 'juggernaut' ? 'elite' : 'boss');
  box.insertAdjacentHTML('beforeend', `<h3>${L.id} · ${L.name}</h3><div class="tags">${tags.map((t) => `<span>${t}</span>`).join('')}</div>`);
  const chips = document.createElement('div'); chips.className = 'wave-chips';
  const seen = L.pool.map(([type]) => type);
  if (L.boss) seen.push(L.boss);
  for (const type of seen) chips.append(zombieChip(type, ZOMBIES[type].name, FIRST_SEEN[type] === L.index));
  box.append(chips);
  box.insertAdjacentHTML('beforeend', `<p class="hint zombie-tip" hidden></p><p class="hint">Best: ${starsFor(i)} of 3 stars · first clear pays ${Math.round(30 + 45 + L.index * 1.5)} coins with 3 stars</p>`);
  const go = document.createElement('button'); go.type = 'button'; go.className = 'btn btn-primary'; go.textContent = 'Start mission';
  go.addEventListener('click', () => { Sound.init(); startGame(i); });
  box.append(go);
}

let storeTab = 'towers';
const STORE_GLYPHS = {
  cash: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
  walls: '<svg viewBox="0 0 24 24"><path d="M3 20h18M4 20V9h4v3h3V9h2v3h3V9h4v11"/></svg>',
  discount: '<svg viewBox="0 0 24 24"><path d="M20 12l-8 8-8-8V4h8z"/><circle cx="8" cy="8" r="1.5"/></svg>',
  salvage: '<svg viewBox="0 0 24 24"><path d="M14 4l6 6-10 10H4v-6zM12 6l6 6"/></svg>',
  bounty: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
};
function showStore(tab = storeTab) {
  leaveGame();
  hideScreens();
  storeTab = tab;
  $('#store-screen').hidden = false;
  $('#store-coins').textContent = coinText();
  for (const b of document.querySelectorAll('#store-tabs .tab')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  const notes = {
    towers: 'Towers unlock for free as you clear levels. Buy one here to use it early.',
    upgrades: 'Permanent upgrades apply to every level.',
    supplies: 'One-use supplies. Use them from the buttons at the bottom left of the battlefield.',
  };
  $('#store-note').textContent = `${notes[tab]} Earn coins by clearing levels.`;
  const grid = $('#store-grid');
  grid.innerHTML = '';
  const card = (art, title, meta2, desc, btnText, can, onBuy, extra = '') => {
    const el = document.createElement('div'); el.className = 'store-card';
    el.append(art);
    const body = document.createElement('div'); body.className = 'body';
    body.innerHTML = `<span class="meta">${meta2}</span><h3>${title}</h3><p>${desc}</p>${extra}`;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-primary btn-small';
    b.textContent = btnText; b.disabled = !can;
    b.addEventListener('click', () => { onBuy(); Sound.play('coin'); saveMeta(); showStore(tab); });
    body.append(b); el.append(body);
    return el;
  };
  const glyph = (svg) => { const g = document.createElement('div'); g.className = 'glyph'; g.innerHTML = svg; return g; };
  if (tab === 'towers') {
    for (const type of TOWER_KEYS) {
      const d = TOWERS[type];
      if (!d.unlock) continue;
      const open = towerUnlocked(type);
      grid.append(card(towerIcon(type, 0, 64), d.name, `${d.role} · $${d.cost} in battle`, d.desc,
        open ? 'Unlocked' : `Buy · ${d.price} coins`, !open && meta.coins >= d.price,
        () => { meta.coins -= d.price; meta.owned[type] = true; },
        open ? '' : `<p class="hint">Free after clearing ${levelName(d.unlock - 1)}</p>`));
    }
  } else if (tab === 'upgrades') {
    for (const [key, u] of Object.entries(UPGRADES)) {
      const rank = upg(key), price = u.prices[rank];
      const pips = `<div class="pips">${u.prices.map((_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('')}</div>`;
      grid.append(card(glyph(STORE_GLYPHS[key]), u.name, `Rank ${rank} of ${u.prices.length}`, u.desc,
        price == null ? 'Maxed' : `Upgrade · ${price} coins`, price != null && meta.coins >= price,
        () => { meta.coins -= price; meta.upg[key] = rank + 1; }, pips));
    }
  } else {
    for (const [key, s] of Object.entries(SUPPLIES)) {
      const g = glyph(POWER_ICONS[key]);
      grid.append(card(g, s.name, `Owned: ${meta.items[key] | 0}`, s.desc, `Buy · ${s.price} coins`, meta.coins >= s.price,
        () => { meta.coins -= s.price; meta.items[key] = (meta.items[key] | 0) + 1; }));
    }
  }
}

// ============================================================
// Input
// ============================================================
function toLogical(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: ((ev.clientX - r.left - canvas.clientLeft) / canvas.clientWidth) * W, y: ((ev.clientY - r.top - canvas.clientTop) / canvas.clientHeight) * H };
}
function setHover(ev) {
  const p = toLogical(ev);
  S.hover.mouse = ev.pointerType === 'mouse';
  S.hover.x = p.x; S.hover.y = p.y;
  S.hover.col = Math.floor(p.x / TILE); S.hover.row = Math.floor(p.y / TILE);
  S.hover.inside = p.x >= 0 && p.y >= 0 && p.x < W && p.y < H;
}
canvas.addEventListener('pointermove', setHover);
canvas.addEventListener('pointerleave', () => { S.hover.inside = false; });
canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); cancelAll(); });
canvas.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  Sound.init();
  setHover(ev);
  if (S.state !== 'playing' || S.paused) return;
  const { col, row } = S.hover;
  if (S.power === 'airstrike') { S.hover.inside = true; callAirstrike(S.hover.x, S.hover.y); renderInfo(); return; }
  const tw = S.towerAt.get(row * COLS + col);
  if (S.placing) {
    if (canPlaceAt(S.placing, col, row)) {
      if (ev.pointerType !== 'mouse' && !(S.pending && S.pending.col === col && S.pending.row === row)) {
        S.pending = { col, row }; Sound.play('click'); return;
      }
      S.pending = null;
      if (S.cash >= costOf(TOWERS[S.placing].cost)) {
        const t = placeTower(S.placing, col, row);
        if (!ev.shiftKey || S.cash < costOf(TOWERS[S.placing].cost)) {
          S.placing = null; S.selected = t;
          for (const b of document.querySelectorAll('.tower-btn')) b.classList.remove('active');
        }
        renderInfo(); updateHUD(true);
      } else { floatText('Not enough cash', S.hover.x, S.hover.y - 10, '#e0675b', 15); Sound.play('error'); }
    } else if (tw) {
      S.placing = null; S.pending = null; S.selected = tw;
      for (const b of document.querySelectorAll('.tower-btn')) b.classList.remove('active');
      renderInfo();
    } else {
      const k = S.M.grid[row * COLS + col];
      const msg = TOWERS[S.placing].place === 'water' ? 'Boats go on water' : k === 1 ? 'Not on the road' : k === 3 ? 'Only boats go on water' : 'Something is in the way';
      floatText(msg, S.hover.x, S.hover.y - 10, '#e0675b', 15); Sound.play('error');
    }
    return;
  }
  if (tw) { S.selected = tw === S.selected ? null : tw; Sound.play('click'); } else S.selected = null;
  renderInfo();
});

window.addEventListener('keydown', (ev) => {
  const k = ev.key.toLowerCase();
  if (S.state !== 'playing' && S.state !== 'won' && S.state !== 'over') return;
  if (k === 'escape') { if (S.placing || S.selected || S.power) cancelAll(); else setPaused(!S.paused); return; }
  if (k === 'p') { setPaused(!S.paused); return; }
  if (S.state !== 'playing' || S.paused) return;
  Sound.init();
  if (k === ' ' || k === 'enter') {
    const onButton = document.activeElement && document.activeElement.tagName === 'BUTTON';
    if (onButton && k === 'enter') return;
    if (onButton) document.activeElement.blur();
    ev.preventDefault(); startWave(); return;
  }
  const idx = TOWER_KEYS.findIndex((tk) => TOWERS[tk].key === k);
  if (idx >= 0) { if (towerUnlocked(TOWER_KEYS[idx])) selectPlacing(TOWER_KEYS[idx]); return; }
  if (k === 'f') cycleSpeed();
  else if (k === 'a') toggleAuto();
  else if (k === 'm') toggleSound();
  else if (S.selected && k === 'u') upgradeTower(S.selected);
  else if (S.selected && k === 's') sellTower(S.selected);
  else if (S.selected && k === 't' && S.selected.type !== 'jet') cycleTarget(S.selected);
});

function cycleSpeed() { S.speed = S.speed === 3 ? 1 : S.speed + 1; $('#btn-speed').textContent = `${S.speed}×`; $('#btn-speed').setAttribute('aria-pressed', String(S.speed > 1)); Sound.play('click'); }
function toggleAuto() { S.auto = !S.auto; $('#btn-auto').setAttribute('aria-pressed', String(S.auto)); Sound.play('click'); }
function toggleSound() {
  Sound.muted = !Sound.muted;
  $('#btn-sound').setAttribute('aria-pressed', String(!Sound.muted));
  $('#btn-sound').textContent = Sound.muted ? 'Muted' : 'Sound';
  store.set('zbash.muted', Sound.muted ? '1' : '0');
  Sound.play('click');
}

$('#btn-wave').addEventListener('click', () => { Sound.init(); startWave(); });
$('#btn-speed').addEventListener('click', cycleSpeed);
$('#btn-auto').addEventListener('click', toggleAuto);
$('#btn-sound').addEventListener('click', () => { Sound.init(); toggleSound(); });
$('#btn-pause').addEventListener('click', () => setPaused(!S.paused));
$('#btn-resume').addEventListener('click', () => setPaused(false));
$('#btn-restart').addEventListener('click', () => startGame(S.levelIndex));
$('#btn-to-levels').addEventListener('click', () => showLevels(S.L.world, S.levelIndex));
$('#btn-to-menu').addEventListener('click', showMenu);
$('#btn-retry').addEventListener('click', () => startGame(S.levelIndex));
$('#btn-menu').addEventListener('click', () => showLevels(S.L.world, S.levelIndex + (S.state === 'won' ? 1 : 0)));
$('#btn-next').addEventListener('click', () => { if (LEVEL_META[S.levelIndex + 1]) startGame(S.levelIndex + 1); });
$('#btn-campaign').addEventListener('click', () => { Sound.init(); Sound.play('click'); let w = 0; while (w + 1 < WORLDS.length && worldUnlocked(w + 1)) w++; showWorlds(w); });
$('#btn-store').addEventListener('click', () => { Sound.init(); Sound.play('click'); showStore('towers'); });
$('#btn-world-back').addEventListener('click', showMenu);
$('#btn-levels-back').addEventListener('click', () => showWorlds(S.worldSel));
$('#btn-store-back').addEventListener('click', showMenu);
for (const b of document.querySelectorAll('#store-tabs .tab')) b.addEventListener('click', () => { Sound.play('click'); showStore(b.dataset.tab); });
document.addEventListener('visibilitychange', () => { if (document.hidden && S.state === 'playing') { checkpoint(); setPaused(true); } });

// ---------- full screen, install, rotate hint ----------
const standalone = (window.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) || navigator.standalone === true;
let topLevel = false;
try { topLevel = window.top === window; } catch (e) { topLevel = false; }
const rootEl = document.documentElement;
const fsRequest = rootEl.requestFullscreen || rootEl.webkitRequestFullscreen;
const fsActive = () => document.fullscreenElement || document.webkitFullscreenElement;
const fsBtn = $('#btn-full');
fsBtn.hidden = standalone || !fsRequest || !(document.fullscreenEnabled || document.webkitFullscreenEnabled);
fsBtn.addEventListener('click', () => {
  if (fsActive()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  Promise.resolve(fsRequest.call(rootEl))
    .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
    .catch(() => { /* full screen or rotation lock refused */ });
});
const syncFs = () => { fsBtn.textContent = fsActive() ? 'Exit full' : 'Full screen'; };
document.addEventListener('fullscreenchange', syncFs);
document.addEventListener('webkitfullscreenchange', syncFs);

let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; renderInstall(); });
window.addEventListener('appinstalled', () => { installEvt = null; renderInstall(); });
function renderInstall() {
  const box = $('#install-box');
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  box.innerHTML = ''; box.hidden = true;
  if (standalone || !topLevel || window.Capacitor) return;
  if (installEvt) {
    box.hidden = false;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = 'Install Zombie Bash';
    b.addEventListener('click', () => { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; renderInstall(); }); });
    box.append(b);
    box.insertAdjacentHTML('beforeend', '<span>Adds it to your home screen. Plays full screen, even offline.</span>');
  } else if (ios && location.protocol === 'https:') {
    box.hidden = false;
    box.innerHTML = '<span>Play it like an app: tap <b>Share</b>, then <b>Add to Home Screen</b>.</span>';
  }
}
if (store.get('zbash.hint') === '1') document.body.classList.add('hint-dismissed');
$('#btn-hint-close').addEventListener('click', () => { document.body.classList.add('hint-dismissed'); store.set('zbash.hint', '1'); resize(); });

// ============================================================
// Boot
// ============================================================
if (store.get('zbash.muted') === '1') { Sound.muted = true; $('#btn-sound').setAttribute('aria-pressed', 'false'); $('#btn-sound').textContent = 'Muted'; }
{
  // show the furthest unlocked level behind the menus
  let furthest = 0;
  while (furthest + 1 < TOTAL_LEVELS && levelUnlocked(furthest + 1)) furthest++;
  S.levelIndex = furthest; S.L = getLevel(furthest); S.M = buildLevel(S.L); S.worldSel = S.L.world;
  S.cash = S.L.gold; S.lives = maxLives(); S.maxLives = S.lives;
  $('#st-id').textContent = S.L.id; $('#st-name').textContent = S.L.name;
  initWeather();
}
buildShop(); renderInfo(); renderNextWave(); renderPowerbar();
resize();
updateHUD(true);
showMenu();
// Start mapping the globe in the background so the world screen opens instantly.
setTimeout(() => Globe.prepare(), 300);
new ResizeObserver(() => resize()).observe(stage);
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { buildShop(); updateHUD(true); });
requestAnimationFrame(frame);

// Small hook for automated tests and tinkering in the console.
window.ZombieBash = { S, meta, LEVEL_META, getLevel, TOWERS, ZOMBIES, startGame, startWave, placeTower, upgradeTower, update, canPlaceAt, towerUnlocked, showWorlds, showLevels, showStore, showMenu, selectLevel, usePower, callAirstrike, saveMeta };
