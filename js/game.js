'use strict';
// ============================================================
// Engine, UI and menus.
// ============================================================

// ---------- persistent progress ----------
const META_KEY = 'zbash2.meta', SAVE_KEY = 'zbash2.save';
function loadMeta() {
  const fresh = { coins: 150, stars: {}, owned: {}, upg: {}, items: { airstrike: 1, cryobomb: 1, supply: 1, medkit: 0 }, xp: {}, armory: {} };
  try {
    const m = JSON.parse(store.get(META_KEY));
    if (m && typeof m === 'object') return { ...fresh, ...m, items: { ...fresh.items, ...(m.items || {}) }, xp: { ...(m.xp || {}) }, armory: { ...(m.armory || {}) } };
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
const xpOf = (type) => Math.floor(meta.xp[type] || 0);
// Highest tier of a path that can be bought in battle; tiers past FREE_TIER are unlocked with XP in the Armory.
const tierCap = (type, p) => Math.max(FREE_TIER, (meta.armory[type] || [])[p] | 0);
const AIRCRAFT = { heli: true, jet: true };
const MAP_WIDE = 50; // ranges this big reach the whole map
const coarse = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;
const buzz = (ms) => { try { if (!Sound.muted && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* no haptics */ } };


// ============================================================
// State
// ============================================================
const S = {
  state: 'menu', L: null, M: null, levelIndex: 0, worldSel: 0, levelSel: 0,
  lives: 0, maxLives: 20, cash: 0, wave: 0,
  towers: [], enemies: [], projectiles: [], fx: [], decals: [], spawners: [], strikes: [], crates: [],
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

// the direction the road arrives at the safehouse from, so its ring of sandbags opens that way
function houseGap(M) { const sg = M.paths[0].segs, s = sg[sg.length - 1]; return Math.atan2(-s.dy, -s.dx); }
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
  // buildings spread over a free tile beside them when there is one, so they can be drawn full size
  const endC = Math.floor(end.x / TILE), endR = Math.floor(end.y / TILE);
  const decor = L.decor.map((d) => {
    if (!BUILDING_KINDS.has(d.kind)) return d;
    for (const dc of d.seed % 2 ? [1, -1] : [-1, 1]) {
      const c2 = d.c + dc;
      if (c2 < 0 || c2 >= COLS || grid[d.r * COLS + c2] !== 0) continue;
      if (Math.abs(c2 - endC) <= 1 && Math.abs(d.r - endR) <= 1) continue;
      grid[d.r * COLS + c2] = 2;
      return { ...d, wide: true, x: (Math.min(d.c, c2) + 1) * TILE, y: d.r * TILE + TILE / 2 };
    }
    return { ...d, y: d.r * TILE + TILE / 2, x: d.c * TILE + TILE / 2 };
  });
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
  return { L, world, grid, paths, flights, decor, end, groundTex: null, smoke: [], glows: [] };
}

// ============================================================
// Game flow
// ============================================================
// a line over the radio, swapped for someone else's if that character cannot speak yet
function sayLine(who, text, o) { if (speakerOK(S.L, who)) Comms.say(who, text, o); }
function sayChatter(kind, o) {
  const C = CHATTER[S.L.world] || CHATTER[0], list = (C[kind] || []).filter(([w]) => speakerOK(S.L, w));
  if (list.length) { const [w, t] = list[(S.L.num * 7 + S.wave * 3 + kind.length) % list.length]; Comms.say(w, t, o); }
}
function startGame(index, save) {
  const L = getLevel(index);
  S.levelIndex = index; S.L = L; S.M = buildLevel(L);
  S.maxLives = maxLives(); S.lives = S.maxLives;
  S.cash = L.gold + 60 * upg('cash'); S.wave = 0;
  S.towers = []; S.enemies = []; S.projectiles = []; S.fx = []; S.decals = []; S.spawners = []; S.strikes = []; S.crates = [];
  S.towerAt = new Map();
  S.runXp = {};
  S.placing = null; S.power = null; S.selected = null; S.pending = null;
  S.time = 0; S.shake = 0; S.houseHit = 0; S.banner = null; S.leakFlash = 0; S.freezeFlash = 0;
  S.state = 'playing';
  setPaused(false);
  Sound.stopAmbience();
  initWeather();
  hideScreens();
  ZART.prewarm([...new Set([...L.pool.map(([t]) => t), ...(L.boss ? [L.boss] : []), 'imp', 'skeleton', 'runner'])]);
  $('#st-id').textContent = L.id;
  $('#st-name').textContent = L.name;
  resize();
  Comms.clear();
  S.mission = missionFor(L); S.saidHurt = false;
  $('#st-name').textContent = `Op. ${S.mission.op.name} · ${S.mission.objective}`;
  if (save) applySave(save);
  else {
    showBanner(`${L.id} · ${L.name}`, `Operation ${S.mission.op.name} · ${S.mission.objective}`);
    sayLine(S.mission.who, S.mission.line, { tag: `Op. ${S.mission.op.name} · ${S.mission.step + 1}/5`, delay: 2.4 });
  }
  checkpoint();
  buildShop(); renderInfo(); renderNextWave(); renderPowerbar(); updateHUD(true);
}

function checkpoint() {
  if (S.state !== 'playing' || S.spawners.length || S.enemies.length) return;
  S.dirty = false;
  saveMeta(); // banks the XP earned so far
  store.set(SAVE_KEY, JSON.stringify({
    v: 4, level: S.levelIndex, lives: S.lives, cash: S.cash, wave: S.wave,
    towers: S.towers.map((t) => ({ type: t.type, col: t.col, row: t.row, tiers: t.tiers, spent: t.spent, mode: t.mode, kills: t.kills })),
  }));
}
function loadSave() {
  try {
    const sv = JSON.parse(store.get(SAVE_KEY));
    if (sv && (sv.v === 3 || sv.v === 4) && LEVEL_META[sv.level] && Array.isArray(sv.towers) && sv.lives > 0 && sv.wave < LEVEL_META[sv.level].waves) return sv;
  } catch (e) { /* corrupt save */ }
  return null;
}
function applySave(sv) {
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  S.lives = num(sv.lives, S.lives); S.cash = num(sv.cash, S.cash); S.wave = clamp(num(sv.wave, 0), 0, S.L.waves - 1);
  for (const t of sv.towers) {
    if (!TOWERS[t.type]) continue;
    if (!canPlaceAt(t.type, t.col, t.row)) {
      // a building has since spread onto this tile: hand the tower's cost back rather than lose it
      if (S.M.grid[t.row * COLS + t.col] === 2) S.cash += num(t.spent, TOWERS[t.type].cost);
      continue;
    }
    const tw = makeTower(t.type, t.col, t.row);
    // older saves stored a single upgrade level
    const tiers = Array.isArray(t.tiers) ? t.tiers.map((n) => clamp(n | 0, 0, 5)) : [Math.min(FREE_TIER, t.level | 0), 0, 0];
    if (tiers.length === 3 && tiersAllowed(tiers) && tiers.every((n, p) => n <= tierCap(t.type, p))) setTiers(tw, tiers);
    tw.spent = num(t.spent, TOWERS[t.type].cost);
    if (MODES.some((m) => m[0] === t.mode)) tw.mode = t.mode;
    tw.kills = num(t.kills, 0);
  }
  refreshTowers();
  showBanner('Welcome back', `Wave ${S.wave + 1} is up next`);
}

function startWave() {
  if (S.state !== 'playing' || S.paused || S.wave >= S.L.waves) return;
  const early = S.spawners.length > 0 || S.enemies.length > 0;
  S.wave++;
  S.spawners.push(makeSpawner(S.wave));
  // farms drop their harvest as supply crates while the wave plays out
  for (const t of S.towers) {
    if (t.type !== 'farm' || !t.st.income) continue;
    const n = clamp(Math.round(t.st.income / 15), 2, 10), v = t.st.income / n;
    for (let i = 0; i < n; i++) t.drops.push({ at: S.time + 1 + i * 1.4, v });
  }
  if (early) {
    const b = 5 + S.wave;
    S.cash += b;
    floatText(`Early call +$${b}`, W / 2, 96, '#86b356', 18);
    Sound.play('early');
  }
  const fresh = newTypes(S.L, S.wave);
  const boss = S.L.boss && S.wave === S.L.waves;
  let sub = null;
  if (boss) sub = `${ZOMBIES[S.L.boss].name} incoming`;
  else if (fresh.length) sub = `New threat: ${fresh.map((t) => ZOMBIES[t].name).join(' and ')}`;
  else if (S.wave === S.L.waves) sub = 'Final wave';
  showBanner(`Wave ${S.wave}`, sub);
  Sound.play(boss ? 'boss' : 'wave');
  if (fresh.length || boss) Sound.play('groan', W * 0.2);
  // the squad calls out what is coming
  if (boss) sayLine(...(BOSS_LINES[S.L.boss] || BOSS_LINES.juggernaut), { delay: 0.6 });
  else if (fresh.length && THREAT_LINES[fresh[0]]) sayLine(...THREAT_LINES[fresh[0]], { delay: 0.8 });
  else if (S.wave === S.L.waves) sayChatter('last', { delay: 0.8 });
  else if (S.wave === Math.ceil(S.L.waves / 2)) sayChatter('mid', { delay: 1.2 });
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
// Towers earn XP for their kills; clearing a level adds a bonus for every kind of tower that fought in it.
function addXp(type, n) {
  meta.xp[type] = (meta.xp[type] || 0) + n;
  S.runXp[type] = (S.runXp[type] || 0) + n;
}
function xpBonus(won) {
  const types = new Set(S.towers.map((t) => t.type));
  for (const type of Object.keys(S.runXp)) types.add(type);
  const each = won ? 25 + Math.round(S.L.index * 0.6) : 0;
  for (const type of types) addXp(type, each);
  return Math.round(Object.values(S.runXp).reduce((a, b) => a + b, 0));
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
  const xp = xpBonus(true);
  const unlocked = prev === 0 ? TOWER_KEYS.filter((t) => TOWERS[t].unlock === S.levelIndex + 1 && !meta.owned[t]) : [];
  const beat = S.L.num === 25 ? 'mid' : S.L.num === LEVELS_PER_WORLD ? 'outro' : null;
  S.storyNext = beat && !Story.seen(`w${S.L.world}-${beat}`) ? `w${S.L.world}-${beat}` : null;
  saveMeta();
  Sound.play('win');
  const next = LEVEL_META[S.levelIndex + 1];
  let text;
  if (unlocked.length) text = `New tower unlocked: ${unlocked.map((t) => TOWERS[t].name).join(', ')}.`;
  else if (!next) text = 'Every sector is secure. Replay levels to earn all the stars.';
  else if (next.world !== S.L.world) text = `New world unlocked: ${WORLDS[next.world].name}.`;
  else text = `You kept ${S.lives} of ${S.maxLives} lives. Next up: ${next.id}, ${missionFor(next).objective.toLowerCase()}.`;
  if (S.storyNext) text += ' A new story chapter is ready.';
  const m = S.mission;
  const okWin = (C) => (C || []).filter(([w]) => speakerOK(S.L, w));
  const pool = okWin((CHATTER[S.L.world] || CHATTER[0]).winAny);
  S.endQuote = m && m.last && speakerOK(S.L, m.op.win[0]) ? m.op.win : pool[S.L.num % pool.length];
  showEnd(true, 'Sector secured', text, stars, reward, xp);
}

function gameOver() {
  S.state = 'over';
  S.placing = null; S.power = null; S.pending = null;
  store.remove(SAVE_KEY);
  const reward = Math.round(S.wave * 2);
  meta.coins += reward;
  const xp = xpBonus(false);
  saveMeta();
  Sound.play('lose'); buzz([80, 60, 160]);
  { const pool = ((CHATTER[S.L.world] || CHATTER[0]).lose || []).filter(([w]) => speakerOK(S.L, w)); S.endQuote = pool[S.L.num % pool.length]; }
  showEnd(false, 'Base overrun', `The horde broke through on wave ${S.wave} of ${S.L.waves}. Try a different mix of towers, unlock upgrades in the Armory, or pick up perks in the store.`, 0, reward, xp);
}

const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>';
function showEnd(won, title, text, stars, reward, xp) {
  $('#end-kicker').textContent = `Sector ${S.L.id} · ${S.L.name}`;
  $('#end-title').textContent = title;
  $('#end-text').textContent = text;
  $('#end-reward').textContent = `+${reward} coins · +${xp} tower XP`;
  $('.dialog-end').classList.toggle('lost', !won);
  const st = $('#end-stars');
  st.hidden = !won;
  st.innerHTML = [1, 2, 3].map((i) => STAR_SVG.replace('<svg', `<svg class="${i <= stars ? 'on' : ''}"`)).join('');
  st.setAttribute('aria-label', `${stars} of 3 stars`);
  for (let i = 0; i < stars; i++) setTimeout(() => Sound.play('star', null, { pitch: 1 + i * 0.25 }), 450 + i * 150);
  if (xp > 0) setTimeout(() => Sound.play('xp'), 450 + stars * 150 + 150);
  $('#btn-next').hidden = !won || !LEVEL_META[S.levelIndex + 1];
  $('#btn-retry').textContent = won ? 'Replay' : 'Try again';
  // a character has the last word
  const q = S.endQuote, box = $('#end-quote');
  box.hidden = !q;
  if (q) {
    const cv = box.querySelector('canvas'), g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height); g.drawImage(Comms.portrait(q[0]), 0, 0, cv.width, cv.height);
    box.querySelector('b').textContent = (CAST[q[0]] || CAST.voss).name;
    box.querySelector('span').textContent = q[1];
  }
  S.endQuote = null;
  Comms.clear();
  $('#end-screen').hidden = false;
  renderInfo();
}

function setPaused(p) {
  if (S.state !== 'playing') p = false;
  if (p !== S.paused) Sound.play(p ? 'pause' : 'resume');
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
    stunT: 0, stunCd: 0, brittleT: 0, brittle: 0, fslow: 0, fslowNext: 0,
    phase: Math.random() * TAU, dead: false, burrowed: false, revealed: false,
    variant: Math.floor(Math.random() * ZART.variants(type)), size: rand(0.94, 1.06),
    sumCd: def.summon ? def.summon.every * 0.6 : 0, healCd: def.heal ? def.heal.every : 0, stompCd: def.stomp ? def.stomp.every * 0.5 : 0,
  };
  placeOnPath(z);
  S.enemies.push(z);
  if (def.boss) Sound.play('roar', W * 0.15);
  else if (def.fly && Math.random() < 0.25) Sound.play(type === 'bats' ? 'bat' : 'crow', W * 0.1);
  else if (def.lives > 1 && Math.random() < 0.5) Sound.play('brute', W * 0.15);
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
      Sound.play('dig', e.x);
    }
  }
}

const onField = (e) => e.x > 2 && e.y > 2 && e.x < W - 2 && e.y < H - 2;
const targetable = (e, air, detect) => !e.dead && onField(e) && (!e.burrowed || e.revealed || detect) && (!e.fly || air);

function updateEnemy(e, dt) {
  const def = ZOMBIES[e.type];
  if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowF = 0; }
  if (e.brittleT > 0) e.brittleT -= dt;
  e.stunCd = Math.max(0, e.stunCd - dt);
  e.flash = Math.max(0, e.flash - dt);
  if (e.burnT > 0) {
    e.burnT -= dt;
    damage(e, e.burnDps * dt, e.burnSrc, 1, true);
    if (Math.random() < dt * 14) S.fx.push({ kind: 'fire', x: e.x + rand(-5, 5), y: e.y + rand(-5, 5), vx: rand(-8, 8), vy: rand(-30, -14), r: rand(3, 6), life: 0.35, max: 0.35 });
    if (e.dead) return;
  }
  if (e.stunT > 0) { e.stunT -= dt; e.cur = 0; return; }
  const slow = def.noSlow ? 0 : Math.max(e.slowF, e.fslow);
  e.cur = e.speed * (1 - slow) * (e.burrowed ? 1.2 : 1);
  e.d += e.cur * dt;
  if (e.d >= e.route.total) {
    e.dead = true;
    const lost = def.lives || 1;
    S.lives = Math.max(0, S.lives - lost);
    S.houseHit = 0.5; S.leakFlash = 0.4;
    addShake(lost > 2 ? 9 : 3);
    floatText(`-${lost} ${lost === 1 ? 'life' : 'lives'}`, S.M.end.x, S.M.end.y - 40, '#e0675b', 16);
    Sound.play('leak', S.M.end.x); buzz(40); bumpStat('.stat-lives');
    if (S.lives > 0 && S.lives <= 5) Sound.play('lowlife');
    if (!S.saidHurt && S.lives > 0 && S.lives <= S.maxLives * 0.4) { S.saidHurt = true; sayChatter('hurt'); }
    return;
  }
  placeOnPath(e);
  if (!onField(e) || e.burrowed) return;

  if (def.summon && (e.sumCd -= dt) <= 0) {
    e.sumCd = def.summon.every;
    if (e.d > 40 && !e.fly) {
      for (let i = 0; i < def.summon.n; i++) spawnEnemy(def.summon.type, e.wave, e.route, Math.max(0, e.d - 10 - i * 12));
      for (let i = 0; i < 6; i++) S.fx.push({ kind: 'smoke', x: e.x + rand(-12, 12), y: e.y + rand(-12, 12), vx: rand(-10, 10), vy: rand(-10, 10), r: rand(6, 10), grow: 14, life: 0.9, max: 0.9, color: '120,150,90' });
      Sound.play('summon', e.x);
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
    Sound.play('heal', e.x);
  }
  if (def.stomp && (e.stompCd -= dt) <= 0) {
    e.stompCd = def.stomp.every;
    const r2 = (def.stomp.radius * TILE) ** 2;
    let hit = 0;
    for (const t of S.towers) if (dist2(t.x, t.y, e.x, e.y) <= r2) { t.stun = def.stomp.dur; hit++; }
    S.fx.push({ kind: 'ring', x: e.x, y: e.y, r: def.stomp.radius * TILE * 0.45, life: 0.7, max: 0.7, color: '200,235,255' });
    if (hit) floatText('Towers frozen', e.x, e.y - e.r * 2.5, '#bfe6ff', 16);
    addShake(7); Sound.play('stomp', e.x);
  }
}

function damage(e, amount, tower, pierce = 0, quiet = false) {
  if (e.dead) return;
  if (e.brittleT > 0) amount *= 1 + e.brittle;
  if (e.armor > 0 && !quiet && Math.random() < 0.25) Sound.play('armor', e.x);
  const dmg = Math.max(amount * 0.2, amount - e.armor * (1 - Math.min(1, pierce)));
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
  if (tower) {
    tower.kills++;
    addXp(tower.type, def.boss ? (def.mini ? 12 : 40) : def.lives > 1 ? 3 : 1);
    if (tower.st.killBonus) { S.cash += tower.st.killBonus; if (Math.random() < 0.3) floatText(`+$${tower.st.killBonus}`, e.x, e.y - 14, '#86b356', 12); }
  }
  // every kind of zombie dies with its own sound
  const deathSound = def.boss ? 'roar' : { skeleton: 'bones', ghost: 'wail', bloater: 'pop', carrion: 'crow', bats: 'bat', brute: 'brute' }[e.type];
  Sound.play('splat', e.x);
  if (deathSound) Sound.play(deathSound, e.x);
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
    tiers: [0, 0, 0], raw: null, st: null, buffed: false,
    angle: -Math.PI / 2, cd: 0.3, cd2: 1, cd3: 2, cd4: 0, cd5: 1, recoil: 0, spent: costOf(TOWERS[type].cost), stun: 0,
    mode: type === 'sniper' ? 'strong' : 'first', kills: 0, dealt: 0,
    ax: col * TILE + TILE / 2, ay: row * TILE + TILE / 2, orb: Math.random() * TAU, planes: [], sonarPing: 0, pulse: 0, drops: [],
  };
  setTiers(t, t.tiers);
  S.towers.push(t);
  S.towerAt.set(row * COLS + col, t);
  refreshTowers();
  return t;
}
function setTiers(t, tiers) { t.tiers = tiers.slice(); t.raw = towerStats(t.type, t.tiers); t.st = t.raw; }

function placeTower(type, col, row) {
  const t = makeTower(type, col, row);
  S.cash -= costOf(TOWERS[type].cost);
  S.dirty = true;
  buzz(12);
  for (let i = 0; i < 8; i++) S.fx.push({ kind: 'smoke', x: t.x + rand(-14, 14), y: t.y + rand(-14, 14), vx: rand(-20, 20), vy: rand(-20, 20), r: rand(4, 7), grow: 10, life: 0.6, max: 0.6, color: '170,160,140' });
  Sound.play(TOWERS[type].place === 'water' ? 'splash' : 'place', t.x);
  if (type === 'jet') Sound.play('jet', t.x);
  if (type === 'heli') Sound.play('heli', t.x);
  return t;
}

// Support towers (Squad Leader, Power Grid, Overwatch...) buff the towers inside their aura.
const BUFF_DMG = ['dmg', 'rocket', 'bombDmg', 'pulseDmg', 'fieldDps', 'gunDmg', 'burn'];
const BUFF_RATE = ['rate', 'rocketRate', 'gunRate', 'bombRate', 'pulseRate'];
function auraCovers(a, t) {
  const A = a.raw.aura;
  if (!A || (A.only === 'air' && !AIRCRAFT[t.type]) || (A.only === 'water' && TOWERS[t.type].place !== 'water')) return false;
  return A.range >= MAP_WIDE || dist2(a.x, a.y, t.x, t.y) <= (A.range * TILE + 1) ** 2;
}
function refreshTowers() {
  const auras = S.towers.filter((a) => a.raw.aura);
  for (const t of S.towers) {
    let rate = 1, dmg = 1, reach = 0, detect = false;
    for (const a of auras) {
      if (!auraCovers(a, t)) continue;
      const A = a.raw.aura;
      rate = Math.min(rate, A.rate || 1); dmg = Math.max(dmg, A.dmg || 1); reach = Math.max(reach, A.reach || 0); detect = detect || !!A.detect;
    }
    const st = { ...t.raw };
    for (const k of BUFF_RATE) if (st[k]) st[k] *= rate;
    for (const k of BUFF_DMG) if (st[k]) st[k] *= dmg;
    if (st.range < MAP_WIDE) st.range += reach;
    if (detect) st.detect = true;
    t.buffed = rate < 1 || dmg > 1 || reach > 0 || (detect && !t.raw.detect);
    t.st = st;
  }
}

// What the next upgrade on a path costs and whether it can be bought right now.
function upgradeState(t, p) {
  const n = t.tiers[p];
  if (n >= 5) return { state: 'max' };
  const up = TOWERS[t.type].paths[p].ups[n];
  const cost = costOf(upCost(t.type, p, n));
  const next = t.tiers.slice(); next[p]++;
  if (!tiersAllowed(next)) return { state: 'closed', up, cost };
  if (n + 1 > tierCap(t.type, p)) return { state: 'xp', up, cost, xp: TIER_XP[n] };
  return { state: S.cash >= cost ? 'buy' : 'poor', up, cost };
}
function upgradeTower(t, p) {
  const u = upgradeState(t, p);
  if (S.state !== 'playing' || u.state !== 'buy') {
    if (u.state === 'xp') floatText('Unlock it in the Armory', t.x, t.y - 30, '#8fc7e6', 14);
    else if (u.state === 'poor') floatText('Not enough cash', t.x, t.y - 30, '#e0675b', 14);
    Sound.play('error');
    return;
  }
  S.cash -= u.cost;
  t.spent += u.cost;
  const tiers = t.tiers.slice(); tiers[p]++;
  setTiers(t, tiers);
  refreshTowers();
  S.dirty = true;
  floatText(u.up.name, t.x, t.y - 34, PATH_COLORS[p], 16);
  floatText(`Tier ${tiers[p]}`, t.x, t.y - 50, '#ece6d6', 12);
  const rgb = hexRgb(PATH_COLORS[p]).join(',');
  S.fx.push({ kind: 'ring', x: t.x, y: t.y, r: 16, life: 0.6, max: 0.6, color: rgb });
  S.fx.push({ kind: 'ring', x: t.x, y: t.y, r: 26, life: 0.9, max: 0.9, color: rgb });
  S.fx.push({ kind: 'pillar', x: t.x, y: t.y, color: rgb, big: tiers[p] >= 3, life: 0.8, max: 0.8 });
  for (let i = 0; i < 10; i++) { const a = rand(0, TAU), sp = rand(40, 110); S.fx.push({ kind: 'spark', x: t.x, y: t.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4, max: 0.4 }); }
  Sound.play(tiers[p] >= 5 ? 'tier5' : 'upgrade', t.x, { pitch: 1 + (tiers[p] - 1) * 0.1 }); buzz(15);
  renderInfo(); updateHUD(true);
}

const sellValue = (t) => Math.floor(t.spent * (0.7 + 0.05 * upg('salvage')));
function sellTower(t) {
  if (S.state !== 'playing') return;
  S.cash += sellValue(t);
  S.dirty = true;
  S.towers = S.towers.filter((o) => o !== t);
  S.towerAt.delete(t.row * COLS + t.col);
  refreshTowers();
  floatText(`+$${sellValue(t)}`, t.x, t.y - 20, '#86b356', 15);
  if (S.selected === t) S.selected = null;
  Sound.play('sell', t.x);
  renderInfo(); updateHUD(true);
}

function targetScore(e, mode, d2) {
  switch (mode) {
    case 'last': return -e.d / e.route.total;
    case 'strong': return e.hp + e.d * 1e-4;
    case 'close': return -d2;
    default: return e.d / e.route.total;
  }
}
function findTarget(t, range, ox, oy, mode) {
  const { air, detect } = t.st;
  let best = null, bestV = -Infinity;
  const r2 = range >= MAP_WIDE * TILE ? Infinity : range * range;
  for (const e of S.enemies) {
    if (!targetable(e, air, detect)) continue;
    const d2 = dist2(e.x, e.y, ox, oy);
    if (d2 > r2) continue;
    const v = targetScore(e, mode || t.mode, d2);
    if (v > bestV) { bestV = v; best = e; }
  }
  return best;
}
// The best few targets in range, for towers that hit several at once.
function pickTargets(t, range, ox, oy, n, mode) {
  const { air, detect } = t.st;
  const r2 = range >= MAP_WIDE * TILE ? Infinity : range * range;
  const list = [];
  for (const e of S.enemies) {
    if (!targetable(e, air, detect)) continue;
    const d2 = dist2(e.x, e.y, ox, oy);
    if (d2 <= r2) list.push({ e, v: targetScore(e, mode || t.mode, d2) });
  }
  list.sort((a, b) => b.v - a.v);
  return list.slice(0, n).map((o) => o.e);
}
function turnToward(a, target, k) {
  let d = target - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * Math.min(1, k);
}

function stunZombie(e, dur) {
  if (e.dead || e.stunCd > 0 || !dur) return;
  Sound.play('freeze', e.x);
  dur *= ZOMBIES[e.type].boss ? 0.3 : 1;
  e.stunT = Math.max(e.stunT, dur);
  e.stunCd = dur + 0.6;
}
function ignite(e, dps, dur, t) {
  if (e.dead || !dps) return;
  e.burnDps = Math.max(e.burnT > 0 ? e.burnDps : 0, dps); e.burnT = Math.max(e.burnT, dur || 2); e.burnSrc = t;
}
// A hit from a tower's main weapon, with everything its upgrades add on top.
function strike(e, dmg, t, pierce) {
  if (e.dead) return;
  const st = t.st;
  if (st.shred && e.armor > 0) e.armor = Math.max(0, e.armor - st.shred);
  damage(e, dmg, t, pierce != null ? pierce : st.pierce || 0);
  if (e.dead) return;
  if (st.burn) ignite(e, st.burn, st.burnDur, t);
  if (st.stunChance && Math.random() < st.stunChance) stunZombie(e, st.stunDur);
  if (st.knock && !ZOMBIES[e.type].boss && Math.random() < st.knockChance) { e.d = Math.max(0, e.d - st.knock); placeOnPath(e); }
}

function updateTower(t, dt) {
  const st = t.st;
  t.recoil = Math.max(0, t.recoil - dt * 6);
  t.sonarPing = Math.max(0, t.sonarPing - dt * 0.8);
  t.pulse = Math.max(0, t.pulse - dt * 2);
  if (t.stun > 0) { t.stun -= dt; return; }
  t.cd -= dt; t.cd2 -= dt; t.cd3 -= dt; t.cd4 -= dt; t.cd5 -= dt;

  if (st.fieldSlow || st.fieldDps) {
    const r2 = (st.range * TILE) ** 2;
    for (const e of S.enemies) {
      if (!targetable(e, st.air, st.detect) || dist2(e.x, e.y, t.x, t.y) > r2) continue;
      if (st.fieldSlow) e.fslowNext = Math.max(e.fslowNext, st.fieldSlow);
      if (st.fieldDps) damage(e, st.fieldDps * dt, t, 1, true);
    }
  }
  if (st.pulseDmg && t.cd3 <= 0) {
    const r2 = (st.range * TILE) ** 2;
    const hits = S.enemies.filter((e) => targetable(e, st.air, st.detect) && dist2(e.x, e.y, t.x, t.y) <= r2);
    if (hits.length) {
      t.cd3 = st.pulseRate; t.pulse = 1;
      for (const e of hits) { damage(e, st.pulseDmg, t, 1); stunZombie(e, st.pulseStun); }
      S.fx.push({ kind: 'ring', x: t.x, y: t.y, r: st.range * TILE * 0.45, life: 0.5, max: 0.5, color: '150,225,255' });
      S.fx.push({ kind: 'blast', x: t.x, y: t.y, r: 26, life: 0.25, max: 0.25 });
      Sound.play('pulse', t.x); addShake(3);
    }
  }
  const air = AIRCRAFT[t.type];
  if (st.rocket && t.cd2 <= 0 && t.type !== 'jet') {
    const ox = air ? t.ax : t.x, oy = air ? t.ay : t.y;
    const picks = pickTargets(t, (st.range + (air ? 0.5 : 0)) * TILE, ox, oy, st.rockets || 1);
    if (picks.length) {
      t.cd2 = st.rocketRate;
      for (let i = 0; i < (st.rockets || 1); i++) launchMissile(t, picks[i % picks.length], st.rocket, (st.rocketSplash || 0) * TILE, ox + rand(-4, 4), oy + rand(-4, 4), 420, 0.5);
    }
  }

  if (t.type === 'heli') {
    // Fly toward the zombie furthest along any route, anywhere on the map.
    let goal = null, gv = -1;
    for (const e of S.enemies) { if (!targetable(e, true, st.detect)) continue; const v = e.d / e.route.total; if (v > gv) { gv = v; goal = e; } }
    const gx = goal ? goal.x : t.x, gy = goal ? goal.y - 4 : t.y;
    const dx = gx - t.ax, dy = gy - t.ay, d = Math.hypot(dx, dy);
    const stand = goal ? st.range * TILE * 0.55 : 0;
    if (d > stand + 2) { const step = Math.min(d - stand, st.speed * dt); t.ax += (dx / d) * step; t.ay += (dy / d) * step; }
    const target = findTarget(t, st.range * TILE, t.ax, t.ay);
    const faceTo = target || goal;
    if (faceTo) t.angle = turnToward(t.angle, Math.atan2(faceTo.y - t.ay, faceTo.x - t.ax), dt * 6);
    if (target && t.cd <= 0) {
      t.cd = st.rate;
      const n = st.shots;
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * 7;
        const mx = t.ax + Math.cos(t.angle) * 14 - Math.sin(t.angle) * o, my = t.ay + Math.sin(t.angle) * 14 + Math.cos(t.angle) * o;
        hitscan(t, target, st.dmg, mx, my, st.pierce ? '255,200,120' : '255,220,150', 1.2);
      }
      Sound.play('heli', t.ax);
    }
    return;
  }
  if (t.type === 'jet') {
    const n = st.planes || 1, R = st.orbit * TILE;
    t.orb += dt * (330 / R) * (1 + (st.orbitSpeed || 0));
    t.planes = [];
    for (let k = 0; k < n; k++) {
      const a = t.orb + (k * TAU) / n;
      t.planes.push({ x: t.x + Math.cos(a) * R, y: t.y + Math.sin(a) * R * 0.75, a: Math.atan2(Math.cos(a) * 0.75, -Math.sin(a)) });
    }
    t.ax = t.planes[0].x; t.ay = t.planes[0].y; t.angle = t.planes[0].a;
    const r2 = (st.range * TILE) ** 2;
    const near = (pl, rr) => S.enemies.filter((e) => targetable(e, true, st.detect) && dist2(e.x, e.y, pl.x, pl.y) < rr).sort((a, b) => dist2(a.x, a.y, pl.x, pl.y) - dist2(b.x, b.y, pl.x, pl.y));
    if (t.cd <= 0) {
      let fired = false;
      for (const pl of t.planes) {
        const picks = near(pl, r2);
        if (!picks.length) continue;
        fired = true;
        for (let i = 0; i < st.missiles; i++) launchMissile(t, picks[i % picks.length], st.dmg, (st.splash || 0) * TILE, pl.x, pl.y, 520, 0, pl.a);
      }
      if (fired) t.cd = st.rate;
    }
    if (st.gunDmg && t.cd4 <= 0) {
      let fired = false;
      for (const pl of t.planes) {
        const e = near(pl, r2 * 0.64)[0];
        if (e) { hitscan(t, e, st.gunDmg, pl.x + Math.cos(pl.a) * 12, pl.y + Math.sin(pl.a) * 12, '255,210,140', 1.1); fired = true; }
      }
      if (fired) { t.cd4 = st.gunRate; Sound.play('heli', t.ax); }
    }
    if (st.bombDmg && t.cd5 <= 0) {
      let fired = false;
      for (const pl of t.planes) {
        const ex = pl.x + Math.cos(pl.a) * 24, ey = pl.y + Math.sin(pl.a) * 24, rr = (st.bombSplash * TILE + TILE) ** 2;
        if (!S.enemies.some((e) => targetable(e, false, true) && dist2(e.x, e.y, ex, ey) < rr)) continue;
        S.projectiles.push({ kind: 'bomb', sx: pl.x, sy: pl.y, ex, ey, x: pl.x, y: pl.y, t: 0, dur: 0.45, dmg: st.bombDmg, splash: st.bombSplash * TILE, burn: st.bombBurn || 0, tower: t });
        fired = true;
        Sound.play('bomb', pl.x);
      }
      if (fired) t.cd5 = st.bombRate;
    }
    return;
  }
  if (t.type === 'farm') {
    while (t.drops.length && t.drops[0].at <= S.time) {
      const dr = t.drops.shift();
      S.crates.push({ x: t.x + rand(-16, 16), y: t.y + rand(-16, 16), age: 0, v: dr.v });
    }
    if (!st.dmg) return;
  }
  if (st.sonar) {
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
const barrels = (n, gap) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * gap);

// Instant hit with a tracer streak and a muzzle flash.
function hitscan(t, target, dmg, mx, my, color = '255,220,150', width = 1.4, splash = 0) {
  const ox = rand(-3, 3), oy = rand(-3, 3);
  S.fx.push({ kind: 'tracer', x1: mx, y1: my, x2: target.x + ox, y2: target.y + oy, life: 0.07, max: 0.07, color, width });
  S.fx.push({ kind: 'flash', x: mx, y: my, a: Math.atan2(target.y - my, target.x - mx), size: 6, life: 0.05, max: 0.05 });
  S.fx.push({ kind: 'debris', x: target.x + ox, y: target.y + oy, vx: rand(-40, 40), vy: rand(-40, 40), r: 1.4, color: target.fly ? '#2a2026' : '#5a1410', life: 0.25, max: 0.25 });
  const tx = target.x, ty = target.y, fly = target.fly;
  strike(target, dmg, t);
  if (splash > 0) {
    splashAt(tx, ty, splash, fly, (e) => { if (e !== target) strike(e, dmg * 0.6, t); });
    if (Math.random() < 0.5) S.fx.push({ kind: 'blast', x: tx, y: ty, r: splash * 0.6, life: 0.18, max: 0.18 });
  }
}

// A laser or rail shot: hits every zombie along a line, through all armor.
function fireBeam(t, target, dmg, width, mx, my, color) {
  const st = t.st;
  const dx = target.x - mx, dy = target.y - my, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  const len = st.range >= MAP_WIDE ? 1400 : st.range * TILE + 12;
  const half = (width * TILE) / 2;
  for (const e of S.enemies) {
    if (!targetable(e, st.air, st.detect)) continue;
    const rx = e.x - mx, ry = e.y - my, along = rx * ux + ry * uy;
    if (along < 0 || along > len) continue;
    if (Math.abs(rx * uy - ry * ux) <= half + e.r * 0.6) strike(e, dmg, t, 1);
  }
  S.fx.push({ kind: 'beam', x1: mx, y1: my, x2: mx + ux * len, y2: my + uy * len, w: Math.max(2, width * TILE * 0.5), color, life: 0.1, max: 0.1 });
}

function launchMissile(t, target, dmg, splash, x, y, speed, pierce = t.st.pierce || 0, angle = t.angle) {
  S.projectiles.push({ kind: 'missile', x, y, vx: Math.cos(angle) * speed * 0.4, vy: Math.sin(angle) * speed * 0.4, speed, target, tx: target.x, ty: target.y, dmg, splash, tower: t, air: target.fly, life: 3, pierce });
  Sound.play(t.type === 'sub' ? 'torpedo' : 'missile', x);
}

function splashAt(x, y, radius, air, fn) {
  for (const e of S.enemies) {
    if (!targetable(e, true, true) || e.fly !== air) continue;
    if (dist2(e.x, e.y, x, y) <= (radius + e.r * 0.5) ** 2) fn(e);
  }
}

function explosion(x, y, r, big, quiet) {
  S.fx.push({ kind: 'blast', x, y, r, life: 0.45, max: 0.45 });
  for (let i = 0; i < (big ? 14 : quiet ? 3 : 7); i++) S.fx.push({ kind: 'smoke', x: x + rand(-r * 0.4, r * 0.4), y: y + rand(-r * 0.4, r * 0.4), vx: rand(-25, 25), vy: rand(-25, 25), r: rand(r * 0.25, r * 0.45), grow: r * 0.8, life: rand(0.9, 1.6), max: 1.6, color: '60,56,52' });
  for (let i = 0; i < (big ? 16 : quiet ? 3 : 8); i++) { const a = rand(0, TAU), sp = rand(60, 200); S.fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35, max: 0.35 }); }
  S.decals.push({ kind: 'scorch', x, y, r: r * 0.7, life: 12, max: 12, seed: Math.random() * 1000 });
  if (S.decals.length > 90) S.decals.shift();
  addShake(big ? 10 : quiet ? 1 : 3);
  Sound.play(quiet ? 'thud' : 'boom', x);
}

function fire(t, target, st) {
  switch (t.type) {
    case 'gunner': {
      const [a] = t.tiers;
      if (st.beam) {
        const m = muzzle(t, a >= 5 ? 30 : 24);
        fireBeam(t, target, st.dmg, st.beam, m.x, m.y, a >= 5 ? '120,255,110' : a >= 4 ? '120,200,255' : '255,70,60');
        Sound.play(a >= 5 ? 'ray' : 'laser', t.x, { pitch: a >= 4 ? 0.7 : 1 });
        break;
      }
      const picks = st.targets ? pickTargets(t, st.range * TILE, t.x, t.y, 1 + st.targets) : [target];
      const color = st.spread ? '255,210,150' : '255,220,150';
      for (const e of picks) {
        let victims = [e];
        if (st.spread) {
          const r2 = (TILE * 1.3) ** 2;
          victims = victims.concat(S.enemies.filter((z) => z !== e && targetable(z, st.air, st.detect) && dist2(z.x, z.y, e.x, e.y) < r2)
            .sort((p, q) => dist2(p.x, p.y, e.x, e.y) - dist2(q.x, q.y, e.x, e.y)).slice(0, st.spread));
        }
        const a2 = Math.atan2(e.y - t.y, e.x - t.x);
        for (const v of victims) for (const o of barrels(st.shots, 3.5)) {
          const mx = t.x + Math.cos(a2) * 20 - Math.sin(a2) * o, my = t.y + Math.sin(a2) * 20 + Math.cos(a2) * o;
          hitscan(t, v, st.dmg, mx, my, color, 1.4, (st.splash || 0) * TILE);
        }
      }
      Sound.play(st.spread ? 'shotgun' : 'mg', t.x);
      break;
    }
    case 'farm': {
      for (const o of barrels(st.shots, 10)) {
        const m = muzzle(t, 14);
        hitscan(t, target, st.dmg, m.x - Math.sin(t.angle) * o, m.y + Math.cos(t.angle) * o, '255,210,150', 1.3, TILE * 0.35);
      }
      Sound.play('shotgun', t.x);
      break;
    }
    case 'sniper': {
      const picks = st.shots > 1 ? pickTargets(t, st.range * TILE, t.x, t.y, st.shots) : [target];
      picks.forEach((e, i) => {
        const crit = st.critChance && Math.random() < st.critChance;
        const m = muzzle(t, 26);
        const o = (i - (picks.length - 1) / 2) * 8;
        if (crit) { floatText('Crit', e.x, e.y - 20, '#ffd28a', 13); Sound.play('crit', e.x); }
        if (st.beam) { fireBeam(t, e, st.dmg * (crit ? st.critMult : 1), st.beam, m.x - Math.sin(t.angle) * o, m.y + Math.cos(t.angle) * o, '150,210,255'); return; }
        hitscan(t, e, st.dmg * (crit ? st.critMult : 1), m.x - Math.sin(t.angle) * o, m.y + Math.cos(t.angle) * o, crit ? '255,200,90' : '255,240,200', crit ? 2.6 : 1.8);
      });
      const m = muzzle(t, 26);
      S.fx.push({ kind: 'smoke', x: m.x, y: m.y, vx: Math.cos(t.angle) * 20, vy: Math.sin(t.angle) * 20, r: 3, grow: 10, life: 0.6, max: 0.6, color: '200,200,200' });
      Sound.play(st.beam ? 'rail' : 'sniper', t.x);
      break;
    }
    case 'mortar': {
      const dur = st.range >= MAP_WIDE ? 1.2 : 0.9;
      const picks = st.shots > 1 ? pickTargets(t, st.range * TILE, t.x, t.y, st.shots) : [target];
      for (let i = 0; i < st.shots; i++) {
        const e = picks[i % picks.length];
        const lead = pointOn(e.route, e.d + e.cur * dur);
        const off = i >= picks.length ? TILE * 0.5 : 0;
        S.projectiles.push({ kind: 'shell', sx: t.x, sy: t.y, ex: lead.x + rand(-off, off), ey: lead.y + rand(-off, off), x: t.x, y: t.y, h: 0, t: 0, dur: dur + i * 0.06, dmg: st.dmg, splash: st.splash * TILE, tower: t, cluster: st.cluster || 0, air: !!(st.air && e.fly), arc: 60 });
      }
      S.fx.push({ kind: 'smoke', x: t.x, y: t.y, vx: 0, vy: 0, r: 6, grow: 16, life: 0.7, max: 0.7, color: '190,185,170' });
      S.fx.push({ kind: 'flash', x: t.x + 3, y: t.y, a: t.angle, size: 9, life: 0.06, max: 0.06 });
      Sound.play('mortar', t.x);
      break;
    }
    case 'cryo': {
      const picks = st.shots > 1 ? pickTargets(t, st.range * TILE, t.x, t.y, st.shots) : [target];
      for (let i = 0; i < st.shots; i++) {
        const e = picks[i % picks.length];
        const m = muzzle(t, 20);
        S.projectiles.push({ kind: 'canister', x: m.x, y: m.y, target: e, tx: e.x, ty: e.y, speed: 380 + i * 30, dmg: st.dmg, splash: st.splash * TILE, slow: st.slow, slowDur: st.slowDur, brittle: st.brittle || 0, tower: t, air: !!e.fly });
      }
      Sound.play('cryo', t.x);
      break;
    }
    case 'flame': {
      const m = muzzle(t, 18);
      splashAt(target.x, target.y, st.splash * TILE, !!target.fly, (e) => strike(e, st.dmg, t));
      const hot = st.burn >= 30, n = 6 + Math.min(6, Math.round(st.splash * 3));
      for (let i = 0; i < n; i++) {
        const k = rand(0.16, 0.26);
        const sp = st.splash * TILE * 0.6;
        const tx = target.x + rand(-sp, sp), ty = target.y + rand(-sp, sp);
        S.fx.push({ kind: 'fire', x: m.x, y: m.y, vx: (tx - m.x) / k, vy: (ty - m.y) / k, r: rand(3, 6) * (hot ? 1.3 : 1), grow: 10, life: k, max: k, hue: st.pierce >= 1 ? 'white' : st.dmg >= 30 ? 'blue' : null });
      }
      Sound.play('flame', t.x);
      break;
    }
    case 'tesla': {
      const pts = [{ x: t.x, y: t.y }, { x: target.x, y: target.y }];
      const hit = new Set([target]);
      let cur = target, dmg = st.dmg;
      strike(target, dmg, t, 1);
      for (let i = 1; i < st.chain; i++) {
        let next = null, bd = (TILE * 1.9) ** 2;
        for (const e of S.enemies) {
          if (!targetable(e, true, st.detect) || hit.has(e)) continue;
          const d2 = dist2(e.x, e.y, cur.x, cur.y);
          if (d2 < bd) { bd = d2; next = e; }
        }
        if (!next) break;
        dmg *= 0.85; hit.add(next); pts.push({ x: next.x, y: next.y });
        strike(next, dmg, t, 1); cur = next;
      }
      S.fx.push({ kind: 'arc', pts, life: 0.16, max: 0.16, seed: Math.random() * 1000 });
      Sound.play('zap', t.x);
      break;
    }
    case 'gunboat': {
      for (const o of barrels(st.shots, 4)) {
        const m = muzzle(t, 20);
        const x = m.x - Math.sin(t.angle) * o, y = m.y + Math.cos(t.angle) * o;
        S.projectiles.push({ kind: 'round', x, y, target, tx: target.x, ty: target.y, speed: 620, dmg: st.dmg, splash: st.splash * TILE, tower: t, air: target.fly });
        S.fx.push({ kind: 'flash', x, y, a: t.angle, size: 8, life: 0.06, max: 0.06 });
      }
      Sound.play('cannon', t.x);
      break;
    }
    case 'sub': {
      const n = st.missiles || 1;
      const picks = pickTargets(t, st.range * TILE, t.x, t.y, n, 'strong');
      for (let i = 0; i < n; i++) launchMissile(t, picks[i % picks.length] || target, st.dmg, (st.splash || 0) * TILE, t.x + rand(-4, 4), t.y + rand(-4, 4), 460);
      S.fx.push({ kind: 'ring', x: t.x, y: t.y, r: 10, life: 0.5, max: 0.5, color: '220,240,255' });
      break;
    }
  }
}

function updateProjectile(p, dt) {
  if (p.kind === 'shell' || p.kind === 'bomb') {
    p.t += dt;
    const k = Math.min(1, p.t / p.dur);
    p.x = lerp(p.sx, p.ex, k); p.y = lerp(p.sy, p.ey, k);
    p.h = p.kind === 'bomb' ? (1 - k) * 40 : Math.sin(k * Math.PI) * p.arc;
    if (k < 1) return;
    p.done = true;
    const t = p.tower;
    if (p.kind === 'bomb') {
      splashAt(p.x, p.y, p.splash, false, (e) => { damage(e, p.dmg, t, 0.5); ignite(e, p.burn, 2.5, t); });
      explosion(p.x, p.y, p.splash, false, true);
      if (p.burn) for (let i = 0; i < 8; i++) S.fx.push({ kind: 'fire', x: p.x + rand(-p.splash, p.splash) * 0.6, y: p.y + rand(-p.splash, p.splash) * 0.6, vx: rand(-10, 10), vy: rand(-30, -10), r: rand(4, 8), grow: 8, life: 0.6, max: 0.6 });
      return;
    }
    const hit = (e) => strike(e, p.dmg * (1 - 0.4 * clamp(Math.sqrt(dist2(e.x, e.y, p.x, p.y)) / p.splash, 0, 1)), t);
    splashAt(p.x, p.y, p.splash, false, hit);
    if (p.air) splashAt(p.x, p.y, p.splash, true, hit);
    explosion(p.x, p.y, p.splash, false, p.small);
    for (let i = 0; i < p.cluster; i++) {
      const a = rand(0, TAU), d = rand(0.4, 1.3) * p.splash;
      S.projectiles.push({ kind: 'shell', sx: p.x, sy: p.y, ex: p.x + Math.cos(a) * d, ey: p.y + Math.sin(a) * d, x: p.x, y: p.y, h: 0, t: 0, dur: rand(0.25, 0.4), dmg: p.dmg * 0.4, splash: TILE * 0.5, tower: t, cluster: 0, air: false, arc: 22, small: true });
    }
    return;
  }
  if (p.kind === 'missile') {
    p.life -= dt;
    if (p.target && !targetable(p.target, true, true)) {
      // retarget to the nearest zombie of the same kind, or fly on and burst
      let best = null, bd = (TILE * 3) ** 2;
      for (const e of S.enemies) if (targetable(e, true, p.tower.st.detect) && e.fly === p.air) { const d = dist2(e.x, e.y, p.x, p.y); if (d < bd) { bd = d; best = e; } }
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
        splashAt(p.x, p.y, p.splash, p.air, (e) => strike(e, p.dmg, p.tower, p.pierce));
        explosion(p.x, p.y, p.splash, false, true);
      } else {
        if (p.target) strike(p.target, p.dmg, p.tower, p.pierce);
        S.fx.push({ kind: 'blast', x: p.x, y: p.y, r: 12, life: 0.25, max: 0.25 });
        Sound.play('cannon', p.x);
      }
    }
    return;
  }
  if (p.target && targetable(p.target, true, true)) { p.tx = p.target.x; p.ty = p.target.y; } else p.target = null;
  const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = p.speed * dt;
  if (d <= step + 4) {
    p.done = true;
    if (p.kind === 'canister') {
      splashAt(p.tx, p.ty, p.splash, !!p.air, (e) => {
        if (!ZOMBIES[e.type].noSlow) { e.slowF = Math.max(e.slowT > 0 ? e.slowF : 0, p.slow); e.slowT = Math.max(e.slowT, p.slowDur); }
        if (p.brittle) { e.brittle = Math.max(e.brittleT > 0 ? e.brittle : 0, p.brittle); e.brittleT = Math.max(e.brittleT, p.slowDur); }
        strike(e, p.dmg, p.tower);
      });
      S.fx.push({ kind: 'frost', x: p.tx, y: p.ty, r: p.splash, life: 0.5, max: 0.5 });
      for (let i = 0; i < 8; i++) S.fx.push({ kind: 'smoke', x: p.tx, y: p.ty, vx: rand(-40, 40), vy: rand(-40, 40), r: 4, grow: 14, life: 0.6, max: 0.6, color: '225,240,250' });
    } else if (p.kind === 'round') {
      splashAt(p.tx, p.ty, p.splash, !!p.air, (e) => strike(e, p.dmg, p.tower));
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
    S.freezeFlash = 0.6; Sound.play('freezeall');
    showBanner('Cryo bomb', 'The horde is frozen');
  } else if (kind === 'supply') {
    const amount = Math.round(150 + e * 25);
    S.cash += amount; Sound.play('supply');
    floatText(`Supply drop +$${amount}`, W / 2, H / 2, '#86b356', 22);
  } else if (kind === 'medkit') {
    S.lives = Math.min(S.maxLives, S.lives + 5);
    floatText('+5 lives', S.M.end.x, S.M.end.y - 40, '#86b356', 18);
    Sound.play('medkit');
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
  Sound.play('jet', x);
  for (let i = 0; i < 3; i++) setTimeout(() => Sound.play('bomb', x), 200 + i * 120);
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
    case 'pillar': {
      // a column of light where a tower was just upgraded
      const w = (f.big ? 30 : 22) * (0.6 + k * 0.4), h = f.big ? 120 : 80;
      c.globalCompositeOperation = 'lighter';
      const g = c.createLinearGradient(0, f.y - h, 0, f.y + 10);
      g.addColorStop(0, `rgba(${f.color},0)`); g.addColorStop(0.7, `rgba(${f.color},${0.55 * k})`); g.addColorStop(1, `rgba(255,255,255,${0.7 * k})`);
      c.fillStyle = g; c.fillRect(f.x - w / 2, f.y - h, w, h + 10);
      if (lights) lights.push({ x: f.x, y: f.y, r: 60, color: f.color, a: 0.8 * k });
      break;
    }
    case 'beam': {
      c.lineCap = 'round';
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(${f.color},${0.35 * k})`; c.lineWidth = f.w * 2.2;
      c.beginPath(); c.moveTo(f.x1, f.y1); c.lineTo(f.x2, f.y2); c.stroke();
      c.strokeStyle = `rgba(${f.color},${0.85 * k})`; c.lineWidth = f.w;
      c.stroke();
      c.strokeStyle = `rgba(255,255,255,${0.9 * k})`; c.lineWidth = Math.max(1, f.w * 0.3);
      c.stroke();
      if (lights) for (let i = 0; i <= 3; i++) lights.push({ x: lerp(f.x1, f.x2, i / 6), y: lerp(f.y1, f.y2, i / 6), r: 30, color: f.color, a: 0.35 * k });
      break;
    }
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
      // a billowing puff: lit on top, shaded underneath, turning slowly as it spreads and fades
      const r = f.r + (1 - k) * (f.grow || 10);
      if (f.rot == null) { f.rot = Math.random() * TAU; f.spin = (Math.random() - 0.5) * 1.6; f.v = Math.floor(Math.random() * 4); }
      c.globalAlpha = Math.min(1, k * 1.4) * 0.62;
      c.translate(f.x, f.y - (1 - k) * 4); c.rotate(f.rot + (1 - k) * f.spin);
      c.drawImage(puffSprite(f.color, f.v), -r * 1.25, -r * 1.25, r * 2.5, r * 2.5);
      break;
    }
    case 'fire': {
      const r = f.r + (1 - k) * (f.grow || 4);
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = f.hue === 'blue' ? radial(c, f.x, f.y, r, `rgba(${Math.round(160 + k * 90)},210,255,${0.85 * k})`, 'rgba(60,120,255,0)', 0, 0)
        : f.hue === 'white' ? radial(c, f.x, f.y, r, `rgba(255,250,${Math.round(200 + k * 50)},${0.85 * k})`, 'rgba(255,170,60,0)', 0, 0)
        : radial(c, f.x, f.y, r, `rgba(255,${Math.round(150 + k * 90)},80,${0.8 * k})`, 'rgba(255,80,20,0)', 0, 0);
      circle(c, f.x, f.y, r); c.fill();
      if (lights && Math.random() < 0.3) lights.push({ x: f.x, y: f.y, r: 26, color: '255,140,50', a: 0.25 * k });
      break;
    }
    case 'blast': {
      const g = 1 - k, r = f.r * (0.4 + Math.sqrt(g) * 0.8);
      // the shockwave ring racing out ahead of the fireball
      c.globalAlpha = k * 0.7; c.strokeStyle = 'rgba(255,240,210,0.9)'; c.lineWidth = 1 + k * 3;
      circle(c, f.x, f.y, f.r * (0.5 + Math.sqrt(g) * 1.5)); c.stroke();
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

// smoke puff sprites: a cluster of soft lobes lit from the upper left, cached per colour
const PUFFS = new Map();
function puffSprite(color, v) {
  const key = color + v;
  let cv = PUFFS.get(key);
  if (cv) return cv;
  const S2 = 96; cv = document.createElement('canvas'); cv.width = cv.height = S2;
  const g = cv.getContext('2d'), rng = mulberry32(v * 97 + 3), [r0, g0, b0] = color.split(',').map(Number);
  const lit = `rgb(${Math.min(255, r0 + 70)},${Math.min(255, g0 + 70)},${Math.min(255, b0 + 70)})`, dark = `rgb(${r0 * 0.55 | 0},${g0 * 0.55 | 0},${b0 * 0.55 | 0})`;
  for (let i = 0; i < 9; i++) {
    const a = rng() * TAU, d = rng() * S2 * 0.2, x = S2 / 2 + Math.cos(a) * d, y = S2 / 2 + Math.sin(a) * d, r = S2 * (0.14 + rng() * 0.12);
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    gr.addColorStop(0, lit); gr.addColorStop(0.55, `rgb(${color})`); gr.addColorStop(1, dark);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  // feather the edge so puffs blend into each other
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(S2 / 2, S2 / 2, S2 * 0.18, S2 / 2, S2 / 2, S2 * 0.48);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(0, 0, S2, S2);
  PUFFS.set(key, cv);
  return cv;
}

function drawProjectile(c, p, lights) {
  if (p.kind === 'shell' || p.kind === 'bomb') {
    const r = p.small ? 2 : p.kind === 'bomb' ? 3.5 : 3;
    ellipse(c, p.x + p.h * 0.25, p.y + p.h * 0.35, r, r * 0.66); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
    circle(c, p.x, p.y - p.h * 0.4, r + p.h / 40); c.fillStyle = '#2a2c28'; c.fill();
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
// the sky itself lives in weather.js; the game hands it a way to talk, scorch the ground and shake
function initWeather() {
  WEATHER.start(S.M, S.L, {
    say: ([who, text]) => { if (S.state === 'playing' && !Comms.busy) sayLine(who, text, { tag: 'WEATHER' }); },
    strike: (x, y) => { S.decals.push({ kind: 'scorch', x, y, r: 9, life: 14, max: 14, seed: Math.random() * 1000 }); S.shake = Math.max(S.shake, 3); },
    shake: (v) => { S.shake = Math.max(S.shake, v); },
  });
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
  for (const e of S.enemies) { e.revealed = false; e.fslow = e.fslowNext; e.fslowNext = 0; }
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
  for (const cr of S.crates) {
    cr.age += dt;
    if (cr.age >= 1.8) {
      const v = Math.round(cr.v);
      S.cash += v; cr.done = true;
      floatText(`+$${v}`, cr.x, cr.y - 10, '#86b356', 14);
      Sound.play('cash', cr.x); bumpStat('.stat-cash');
    }
  }
  S.crates = S.crates.filter((cr) => !cr.done);
  S.projectiles = S.projectiles.filter((p) => !p.done);
  S.enemies = S.enemies.filter((e) => !e.dead);
  for (const sp of S.spawners) {
    if (sp.done && !sp.paid && !S.enemies.some((e) => e.wave === sp.wave)) {
      sp.paid = true;
      const bonus = waveBonus(S.L, sp.wave);
      S.cash += bonus; S.dirty = true;
      floatText(`Wave ${sp.wave} cleared +$${bonus}`, W / 2, H / 2 - 40, '#e3a83e', 22);
      // income towers pay out and medics patch up the walls
      for (const t of S.towers) {
        if (t.st.income && t.type !== 'farm') { S.cash += Math.round(t.st.income); floatText(`+$${Math.round(t.st.income)}`, t.x, t.y - 26, '#86b356', 14); }
        if (t.type === 'farm') addXp('farm', Math.round((t.st.income || 0) / 6) + 2);
        if (t.st.interest) {
          const g = Math.min(t.st.interestCap, Math.floor(S.cash * t.st.interest));
          if (g > 0) { S.cash += g; floatText(`Interest +$${g}`, t.x, t.y - 12, '#e3a83e', 13); Sound.play('interest', t.x); }
        }
        if (t.st.lifePerWave && S.lives < S.maxLives) { S.lives = Math.min(S.maxLives, S.lives + t.st.lifePerWave); floatText(`+${t.st.lifePerWave} lives`, t.x, t.y - 40, '#86b356', 13); }
      }
      Sound.play('clear'); bumpStat('.stat-cash');
    }
  }
  S.spawners = S.spawners.filter((sp) => !sp.paid);
  S.groanT = (S.groanT || 3) - dt;
  if (S.groanT <= 0) {
    S.groanT = rand(2.2, 5.5);
    const ground = S.enemies.filter((e) => !e.fly && !e.burrowed && onField(e));
    if (ground.length) { const e = ground[Math.floor(Math.random() * ground.length)]; Sound.play(ZOMBIES[e.type].look.kind === 'ghost' ? 'wail' : 'groan', e.x, { pitch: e.r < 11 ? 1.3 : e.r > 16 ? 0.7 : 1 }); }
  }
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
  WEATHER.drawGround(c);
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
  // standing fields: cold mist, static and fire around the towers that have them
  for (const tw of S.towers) {
    const st = tw.st;
    if (!st.fieldSlow && !st.fieldDps) continue;
    const col = tw.type === 'cryo' ? '190,230,255' : tw.type === 'flame' ? '255,130,50' : '140,210,255';
    const r = st.range * TILE;
    c.save();
    c.globalAlpha = 0.5 + Math.sin(t * 2 + tw.x) * 0.15;
    c.fillStyle = radial(c, tw.x, tw.y, r, `rgba(${col},0.02)`, `rgba(${col},0.16)`, 0, 0);
    circle(c, tw.x, tw.y, r); c.fill();
    c.strokeStyle = `rgba(${col},0.35)`; c.lineWidth = 1; c.setLineDash([3, 5]); c.lineDashOffset = -t * 10; c.stroke();
    c.restore();
  }
  if (S.selected) {
    const tw = S.selected, st = tw.st;
    const air = AIRCRAFT[tw.type];
    if (st.range < MAP_WIDE) drawRange(c, air ? tw.ax : tw.x, air ? tw.ay : tw.y, st.range * TILE, true, t);
    else label(c, 'MAP-WIDE RANGE', tw.x, tw.y - 34, 12, '#e3a83e');
    if (tw.type === 'jet') { c.save(); c.strokeStyle = 'rgba(227,168,62,0.35)'; c.setLineDash([4, 6]); ellipse(c, tw.x, tw.y, st.orbit * TILE, st.orbit * TILE * 0.75); c.stroke(); c.restore(); }
    const A = tw.raw.aura;
    if (A && A.range < MAP_WIDE) { c.save(); c.strokeStyle = 'rgba(134,179,86,0.55)'; c.lineWidth = 1.5; c.setLineDash([2, 5]); circle(c, tw.x, tw.y, A.range * TILE); c.stroke(); c.restore(); }
    // mark the towers this one buffs
    if (A) for (const o of S.towers) if (o !== tw && auraCovers(tw, o)) { c.save(); c.strokeStyle = 'rgba(134,179,86,0.7)'; c.lineWidth = 1.2; c.strokeRect(o.x - 20, o.y - 20, 40, 40); c.restore(); }
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
    drawRange(c, x + TILE / 2, y + TILE / 2, TOWERS[S.placing].base.range * TILE, ok, t);
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
      drawSafehouse(c, S.M.end.x, S.M.end.y, t, S.houseHit, false, houseGap(S.M));
      lights.push({ x: S.M.end.x, y: S.M.end.y, r: 70, color: '255,210,140', a: 0.3 });
    }
  }
  for (const p of S.projectiles) drawProjectile(c, p, lights);
  for (const cr of S.crates) drawCrate(c, cr);
  WEATHER.drawSmoke(c, t);
  for (const g of S.M.glows) lights.push(g);
  // air layer
  for (const e of S.enemies) if (e.fly) drawZombie(c, e, t, lights);
  for (const tw of S.towers) if (AIRCRAFT[tw.type]) drawAircraft(c, tw, t, lights);
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
    const a = l.a * Math.min(1.25, look.glow + WEATHER.dark * 1.6);
    if (a < 0.02) continue;
    c.fillStyle = radial(c, l.x, l.y, l.r, `rgba(${l.color},${a})`, `rgba(${l.color},0)`, 0, 0);
    c.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  c.restore();
  WEATHER.drawSky(c, look.glow);
  if (S.freezeFlash > 0) { c.fillStyle = `rgba(190,230,255,${S.freezeFlash * 0.5})`; c.fillRect(-20, -20, W + 40, H + 40); }
  if (S.leakFlash > 0) {
    c.save(); c.globalAlpha = S.leakFlash;
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, 'rgba(200,40,30,0)'); g.addColorStop(1, 'rgba(200,40,30,0.55)');
    c.fillStyle = g; c.fillRect(-20, -20, W + 40, H + 40);
    c.restore();
  }
  for (const e of S.enemies) {
    drawHealthBar(c, e);
    if (e.stunT > 0) {
      c.save(); c.strokeStyle = 'rgba(255,240,170,0.85)'; c.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) { const a = t * 6 + (i * TAU) / 3; circle(c, e.x + Math.cos(a) * e.r * 0.8, e.y - e.r * 1.1 + Math.sin(a) * e.r * 0.3, 1.6); c.stroke(); }
      c.restore();
    }
  }

  if (S.placing && spot && S.state === 'playing' && canPlaceAt(S.placing, spot.col, spot.row)) {
    const gx = spot.col * TILE + TILE / 2, gy = spot.row * TILE + TILE / 2;
    const ghost = { type: S.placing, tiers: [0, 0, 0], x: gx, y: gy, angle: -Math.PI / 2, recoil: 0, ax: gx, ay: gy - 6 };
    drawTower(c, ghost, t, null, { alpha: 0.6 });
    if (AIRCRAFT[S.placing]) { c.save(); c.globalAlpha = 0.6; drawAircraft(c, ghost, t, null); c.restore(); }
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

function updateAudioScene() {
  if (!Sound.ac || Story.active) return;
  let mode = 'menu';
  if (S.state === 'playing' || S.state === 'won' || S.state === 'over') {
    if (S.state !== 'playing' || S.paused) mode = 'calm';
    else if (S.enemies.some((e) => ZOMBIES[e.type].boss)) mode = 'boss';
    else mode = S.spawners.length || S.enemies.length ? 'battle' : 'calm';
    if (!Sound.amb) Sound.setAmbience(S.L.look.weather, S.L.look.time, S.L.world);
  }
  Sound.setScene(mode, S.L ? S.L.world : 0);
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
    if (S.L) WEATHER.update(dt, S.state === 'playing');
  }
  if (S.state !== 'menu') render();
  updateHUD();
  updateAudioScene();
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
const towerIcon = (type, tiers = [0, 0, 0], size = 56) => iconCanvas(size, (c) => drawTowerIcon(c, type, tiers, size));
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
    b.append(towerIcon(type, [0, 0, 0]));
    b.insertAdjacentHTML('beforeend', `<span class="t-key">${def.key}</span><span class="t-role">${def.role}</span><span class="t-name">${def.name}</span><span class="t-cost">${open ? '$' + costOf(def.cost) : `${LOCK_SVG}<span class="t-lock">Locked</span>`}</span>`);
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

const fmtRate = (r) => (1 / r).toFixed(r > 1 ? 2 : 1);
const pct = (v) => Math.round(v * 100) + '%';
function statRows(st) {
  const rows = st.dmg ? [['Damage', Math.round(st.dmg)], ['Shots / sec', fmtRate(st.rate)], ['Range', st.range >= MAP_WIDE ? 'Map-wide' : st.range.toFixed(1)]] : [];
  if (st.beam) rows.push(['Beam', 'Pierces all in line']);
  if (st.targets) rows.push(['Targets at once', 1 + st.targets]);
  if (st.spread) rows.push(['Buckshot', `${1 + st.spread} zombies`]);
  if (st.shots > 1) rows.push(['Barrels', st.shots]);
  if (st.planes > 1) rows.push(['Jets', st.planes]);
  if (st.missiles) rows.push(['Missiles', st.missiles]);
  if (st.splash) rows.push(['Splash', st.splash.toFixed(2)]);
  if (st.chain) rows.push(['Chain', st.chain]);
  if (st.slow) rows.push(['Slow', pct(st.slow)]);
  if (st.burn) rows.push(['Burn / sec', Math.round(st.burn)]);
  if (st.pierce) rows.push(['Armor pierce', pct(Math.min(1, st.pierce))]);
  if (st.rocket) rows.push(['Rockets', `${st.rockets || 1} × ${Math.round(st.rocket)}`]);
  if (st.bombDmg) rows.push(['Bombs', Math.round(st.bombDmg)]);
  if (st.fieldDps) rows.push(['Field damage / sec', Math.round(st.fieldDps)]);
  if (st.fieldSlow) rows.push(['Field slow', pct(st.fieldSlow)]);
  if (st.stunChance) rows.push(['Stun chance', pct(Math.min(1, st.stunChance))]);
  if (st.critChance) rows.push(['Critical hits', `${pct(st.critChance)} × ${st.critMult}`]);
  if (st.income) rows.push(['Income / wave', '$' + Math.round(st.income)]);
  if (st.interest) rows.push(['Interest', `${pct(st.interest)} up to $${st.interestCap}`]);
  if (st.lifePerWave) rows.push(['Lives / wave', '+' + st.lifePerWave]);
  if (st.detect) rows.push(['Hits Tunnelers', 'Yes']);
  return '<ul class="stat-list">' + rows.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('') + '</ul>';
}
const LOCK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const pipsHtml = (n, cls = 'u-pips') => `<span class="${cls}">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const tierText = (tiers) => tiers.join('-');

// One upgrade path of the selected tower: its next upgrade, price and whether it can be bought.
function upgradeButton(t, p) {
  const def = TOWERS[t.type], path = def.paths[p], n = t.tiers[p];
  const u = upgradeState(t, p);
  const shown = u.up || path.ups[4];
  const preview = t.tiers.slice(); preview[p] = Math.min(5, n + 1);
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'up-btn'; b.dataset.path = p; b.dataset.state = u.state;
  b.style.setProperty('--pc', PATH_COLORS[p]);
  b.title = `${shown.name}: ${shown.desc} (key ${[',', '.', '/'][p]})`;
  b.append(towerIcon(t.type, preview, 40));
  const cost = { buy: `$${u.cost}`, poor: `$${u.cost}`, xp: `${LOCK_SVG}${u.xp} XP`, closed: 'Closed', max: 'Max' }[u.state];
  const desc = u.state === 'closed' ? 'Only two paths per tower, and only one past tier 2.'
    : u.state === 'xp' ? `Unlock it in the Armory with ${def.name} XP.` : u.state === 'max' ? 'Fully upgraded.' : shown.desc;
  b.insertAdjacentHTML('beforeend', `<span class="u-body"><span class="u-top"><span class="u-path">${path.name}</span>${pipsHtml(n)}</span>
    <span class="u-name">${shown.name}</span><span class="u-desc">${desc}</span></span><span class="u-cost">${cost}</span>`);
  b.addEventListener('click', () => { Sound.init(); upgradeTower(t, p); });
  return b;
}

function renderInfo() {
  const info = $('#info');
  info.innerHTML = '';
  $('.panel').classList.toggle('busy', !!(S.selected || S.placing));
  $('.panel').classList.toggle('sel', !!S.selected);
  if (S.selected) {
    const t = S.selected, def = TOWERS[t.type];
    const head = document.createElement('div'); head.className = 'info-head';
    head.append(towerIcon(t.type, t.tiers, 54));
    const title = towerTitle(t.type, t.tiers);
    head.insertAdjacentHTML('beforeend', `<div class="plate"><span class="sub"><b class="tier-tag">${tierText(t.tiers)}</b> ${title === def.name ? def.role : def.name}</span><h3>${title}</h3></div>`);
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'info-close'; close.setAttribute('aria-label', 'Close'); close.textContent = '×';
    close.addEventListener('click', cancelAll);
    head.append(close);
    info.append(head);
    const canTarget = t.type !== 'jet';
    info.insertAdjacentHTML('beforeend', `
      <div class="info-actions">
        ${canTarget ? `<button class="btn" id="btn-target" type="button" title="Change targeting (T)">${MODES.find((m) => m[0] === t.mode)[1]}</button>` : ''}
        <button class="btn btn-danger${canTarget ? '' : ' wide'}" id="btn-sell" type="button" title="Sell (S)">Sell $${sellValue(t)}</button>
      </div>`);
    const ups = document.createElement('div'); ups.className = 'up-paths';
    for (let p = 0; p < 3; p++) ups.append(upgradeButton(t, p));
    info.append(ups);
    info.insertAdjacentHTML('beforeend', `
      ${t.buffed ? '<p class="hint buff-note">Boosted by a support tower nearby.</p>' : ''}
      ${statRows(t.st)}
      <p class="hint" id="info-kills"></p>`);
    if (canTarget) $('#btn-target').addEventListener('click', () => cycleTarget(t));
    $('#btn-sell').addEventListener('click', () => sellTower(t));
  } else if (S.placing) {
    const def = TOWERS[S.placing];
    const head = document.createElement('div'); head.className = 'info-head';
    head.append(towerIcon(S.placing, [0, 0, 0], 54));
    head.insertAdjacentHTML('beforeend', `<div class="plate"><span class="sub">${def.role} · $${costOf(def.cost)}</span><h3>${def.name}</h3></div>`);
    info.append(head);
    const where = def.place === 'water' ? 'a water tile' : 'an open ground tile';
    info.insertAdjacentHTML('beforeend', `<p>${def.desc}</p>${statRows(towerStats(S.placing, [0, 0, 0]))}
      <p class="hint">${coarse() ? `Tap ${where} to preview, then tap it again to build.` : `Click ${where} to build. Hold <kbd>Shift</kbd> to build several. <kbd>Esc</kbd> cancels.`}${def.air ? '' : ' Cannot hit flying zombies.'}</p>
      <p class="hint more">Upgrade paths: ${def.paths.map((p) => p.name).join(', ')}.</p>`);
  } else if (S.power === 'airstrike') {
    info.innerHTML = `<h2 class="card-title">Airstrike</h2><p>${SUPPLIES.airstrike.desc}</p><p class="hint">Tap the battlefield to mark the target. Press <kbd>Esc</kbd> to cancel.</p>`;
  } else {
    info.innerHTML = `<h2 class="card-title">Briefing</h2>
      <p>Zombies follow the road to your base. Flyers cut across its corners. Every one that gets inside costs lives.</p>
      <p class="more">Pick a tower and place it on open ground. Boats only go on water. Tap a tower to choose its upgrades: each has three paths. Kills pay cash and earn tower XP for the Armory.</p>
      <p class="hint">Tap a dog tag below to learn what a zombie does.</p>`;
  }
  refreshInfo();
}
function refreshInfo() {
  const t = S.selected;
  if (!t) return;
  for (const b of document.querySelectorAll('.up-btn')) {
    const st = upgradeState(t, +b.dataset.path).state;
    if (b.dataset.state !== st) {
      if ((st === 'buy' || st === 'poor') && (b.dataset.state === 'buy' || b.dataset.state === 'poor')) b.dataset.state = st;
      else { renderInfo(); return; }
    }
  }
  const k = $('#info-kills');
  if (k) { const txt = `${t.kills} kill${t.kills === 1 ? '' : 's'} · ${Math.round(t.dealt)} damage`; if (k.textContent !== txt) k.textContent = txt; }
}
function cycleTarget(t) {
  const i = MODES.findIndex((m) => m[0] === t.mode);
  t.mode = MODES[(i + 1) % MODES.length][0];
  S.dirty = true; Sound.play('click');
  const b = $('#btn-target'); if (b) b.textContent = MODES.find((m) => m[0] === t.mode)[1];
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
const SCREENS = ['#menu-screen', '#world-screen', '#levels-screen', '#store-screen', '#armory-screen', '#chapters-screen', '#end-screen'];
function hideScreens() { for (const s of SCREENS) $(s).hidden = true; Globe.stop(); MenuFX.stop(); LevelFX.stop(); Sound.play('open'); }
function coinText() { return `${meta.coins} coins`; }
function leaveGame() { if (S.state === 'playing') { checkpoint(); saveMeta(); } S.state = 'menu'; setPaused(false); Sound.stopAmbience(); Comms.clear(); }

function showMenu() {
  leaveGame();
  hideScreens();
  $('#menu-screen').hidden = false;
  MenuFX.start();
  $('#menu-coins').textContent = coinText();
  const ready = TOWER_KEYS.reduce((n, k) => n + (towerUnlocked(k) ? armoryReady(k) : 0), 0);
  $('#armory-badge').hidden = !ready;
  $('#armory-badge').textContent = ready;
  $('#btn-story').classList.toggle('new', STORY_ORDER.some((id) => storyUnlocked(id) && !Story.seen(id)));
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

// ---------- story chapters ----------
// plays a chapter the first time it comes up, with the screens behind it put to sleep
function storyThen(id, then) {
  if (Story.seen(id) || !Story.has(id)) return then();
  for (const q of SCREENS) $(q).hidden = true;
  Globe.stop(); MenuFX.stop(); LevelFX.stop();
  Story.play(id, then);
}
function storyUnlocked(id) {
  if (id === 'prologue') return true;
  const [, w, part] = id.match(/^w(\d)-(\w+)$/) || [];
  if (part === 'intro') return worldUnlocked(+w);
  return starsFor(+w * LEVELS_PER_WORLD + (part === 'mid' ? 24 : LEVELS_PER_WORLD - 1)) > 0;
}
function storyLockNote(id) {
  const [, w, part] = id.match(/^w(\d)-(\w+)$/) || [];
  if (part === 'intro') return `Reach ${WORLDS[+w].name}`;
  return `Clear sector ${LEVEL_META[+w * LEVELS_PER_WORLD + (part === 'mid' ? 24 : LEVELS_PER_WORLD - 1)].id}`;
}
function showChapters() {
  hideScreens();
  $('#chapters-screen').hidden = false;
  const grid = $('#chapters-grid'), list = Story.chapters();
  grid.innerHTML = '';
  $('#chapters-count').textContent = `${list.filter((ch) => ch.seen).length} / ${list.length} read`;
  list.forEach((ch, i) => {
    const open = storyUnlocked(ch.id), b = document.createElement('button');
    b.type = 'button'; b.className = 'chapter-card'; b.disabled = !open; b.style.animationDelay = `${i * 40}ms`;
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180;
    b.append(cv);
    b.insertAdjacentHTML('beforeend', `<span class="cc-text"><span class="cc-kicker">${ch.kicker}</span><h3>${ch.title}</h3></span>${open && !ch.seen ? '<span class="cc-new">New</span>' : ''}${open ? '' : `<span class="cc-lock">${storyLockNote(ch.id)}</span>`}`);
    b.addEventListener('click', () => { Sound.play('click'); Story.play(ch.id, showChapters); });
    grid.append(b);
    // thumbnails are painted one at a time so the list opens instantly
    setTimeout(() => { if (!cv.isConnected) return; const p = STORY[ch.id].pages[0].panels[0], c = cv.getContext('2d'); c.fillStyle = MANGA.PAPER; c.fillRect(0, 0, 320, 180); SCENES[p.art].base(c, 320, 180, p.o || {}); }, 60 + i * 45);
  });
}

let globeReady = false;
function showWorlds(w = S.worldSel) {
  leaveGame();
  hideScreens();
  $('#world-screen').hidden = false;
  $('#world-coins').textContent = coinText();
  if (!globeReady) {
    Globe.isOpen = worldUnlocked;
    Globe.onFind = () => { renderGlobeHint(); Sound.play('xp'); };
    Globe.init($('#globe'), (i) => { Sound.play('click'); selectWorld(i); });
    globeReady = true;
    Globe.select(w, true);
  }
  selectWorld(w);
  renderGlobeHint();
  Globe.start();
}
function renderGlobeHint() {
  const { found, total } = Globe.wonders();
  $('#globe-hint').innerHTML = found >= total ? `All <b>${total}</b> wonders found` : `Spin the globe and tap the wonders · <b>${found}</b> / ${total} found`;
}
function worldStars(w) { let s = 0; for (let i = 0; i < LEVELS_PER_WORLD; i++) s += starsFor(w * LEVELS_PER_WORLD + i); return s; }
function worldCleared(w) { let s = 0; for (let i = 0; i < LEVELS_PER_WORLD; i++) if (starsFor(w * LEVELS_PER_WORLD + i)) s++; return s; }
function selectWorld(w) {
  if (w !== S.worldSel) Sound.play('globe');
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
  $('#w-go').addEventListener('click', () => { Sound.play('click'); storyThen(`w${w}-intro`, () => showLevels(w)); });
}

const SKULL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7.5 7.5 0 0 0-7.5 7.5c0 2.8 1.5 4.6 2.9 5.4V18a1 1 0 0 0 1 1h1.1v-1.8h1.6V19h1.8v-1.8h1.6V19h1.1a1 1 0 0 0 1-1v-2.6c1.4-.8 2.9-2.6 2.9-5.4A7.5 7.5 0 0 0 12 2.5z"/><circle cx="9" cy="10.5" r="1.9" fill="#1a0a08"/><circle cx="15" cy="10.5" r="1.9" fill="#1a0a08"/></svg>';
function showLevels(w, focus) {
  leaveGame();
  hideScreens();
  $('#levels-screen').hidden = false;
  LevelFX.start(w);
  $('#levels-coins').textContent = coinText();
  $('#levels-title').textContent = `World ${w + 1} · ${WORLDS[w].name}`;
  S.worldSel = w;
  const grid = $('#level-grid');
  grid.innerHTML = '';
  let firstOpen = w * LEVELS_PER_WORLD, next = -1;
  for (let k = 0; k < LEVELS_PER_WORLD; k++) {
    const i = w * LEVELS_PER_WORLD + k;
    const m = LEVEL_META[i], open = levelUnlocked(i), st = starsFor(i);
    if (open) firstOpen = i;
    if (open && !st && next < 0) next = i;
    const kind = m.boss ? (m.boss === 'juggernaut' ? ' elite' : ' boss') : '';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `level-btn rank-${st}${kind}${open ? '' : ' locked'}${i === next ? ' next' : ''}`;
    b.setAttribute('aria-disabled', String(!open));
    b.dataset.index = i;
    b.title = open ? `${m.id} ${m.name}` : `${m.id} is locked`;
    b.style.animationDelay = `${k * 14}ms`;
    const tag = m.boss ? `<span class="b-tag">${m.boss === 'juggernaut' ? 'Elite' : SKULL_SVG}</span>` : '';
    b.innerHTML = `<span class="shield"><span class="s">${[1, 2, 3].map((s) => `<i class="${s <= st ? 'on' : ''}"></i>`).join('')}</span><span class="n">${m.num}</span>${tag}</span>${open ? '' : `<span class="lock">${LOCK_SVG}</span>`}`;
    b.addEventListener('click', () => {
      if (!open) {
        b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
        Sound.play('error');
        levelToast(b, `Clear ${LEVEL_META[i - 1].id} first`);
        return;
      }
      Sound.play('select'); selectLevel(i);
    });
    grid.append(b);
  }
  layoutLevels();
  selectLevel(focus != null && levelUnlocked(focus) ? focus : next >= 0 ? next : firstOpen);
}
// Levels snake back and forth so the road between them reads like a route across the map.
function layoutLevels() {
  const grid = $('#level-grid');
  if (!grid.children.length || $('#levels-screen').hidden) return;
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  [...grid.children].forEach((b, k) => {
    const r = Math.floor(k / cols), cc = k % cols;
    b.style.gridRow = r + 1; b.style.gridColumn = r % 2 ? cols - cc : cc + 1;
  });
  drawLevelRoad();
}
function drawLevelRoad() {
  const cv = $('#level-road'), map = $('#level-map'), grid = $('#level-grid');
  const box = map.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(box.width * dpr); cv.height = Math.round(box.height * dpr);
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const btns = [...grid.children];
  const pts = btns.map((b) => { const r = b.getBoundingClientRect(); return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2]; });
  if (pts.length < 2) return;
  const done = btns.reduce((n, b, k) => (b.classList.contains('locked') ? n : k), 0);
  const trace = (upTo) => {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k <= upTo; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
      if (Math.abs(y1 - y0) > 4) { const bend = (x0 > box.width / 2 ? 1 : -1) * Math.abs(y1 - y0) * 0.6; c.bezierCurveTo(x0 + bend, y0, x1 + bend, y1, x1, y1); }
      else c.lineTo(x1, y1);
    }
  };
  const width = Math.max(8, (pts[1][0] - pts[0][0]) * 0.16 || 10);
  c.lineCap = 'round'; c.lineJoin = 'round';
  trace(pts.length - 1);
  c.strokeStyle = 'rgba(10,8,6,0.75)'; c.lineWidth = width * 1.6; c.stroke();
  c.strokeStyle = 'rgba(92,74,52,0.9)'; c.lineWidth = width; c.stroke();
  c.setLineDash([width * 0.6, width * 0.9]);
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = width * 0.18; c.stroke();
  trace(done);
  c.strokeStyle = 'rgba(240,183,82,0.95)'; c.lineWidth = width * 0.24; c.shadowColor = 'rgba(240,183,82,0.8)'; c.shadowBlur = 6; c.stroke();
  c.setLineDash([]); c.shadowBlur = 0;
}
let toastTimer = 0;
function levelToast(b, text) {
  const tt = $('#level-toast'), map = $('#level-map').getBoundingClientRect(), r = b.getBoundingClientRect();
  tt.textContent = text; tt.hidden = false;
  tt.style.left = `${clamp(r.left - map.left + r.width / 2, 70, map.width - 70)}px`; tt.style.top = `${r.top - map.top - 8}px`;
  tt.classList.remove('pop'); void tt.offsetWidth; tt.classList.add('pop');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { tt.hidden = true; }, 1600);
}

function selectLevel(i) {
  S.levelSel = i;
  for (const b of document.querySelectorAll('.level-btn')) b.classList.toggle('sel', +b.dataset.index === i);
  const L = getLevel(i), M = buildLevel(L), st = starsFor(i);
  const box = $('#level-detail');
  box.innerHTML = '';
  box.classList.remove('flip'); void box.offsetWidth; box.classList.add('flip');
  box.insertAdjacentHTML('beforeend', `<span class="ld-kicker">Mission briefing · Sector ${L.id}</span>
    <div class="ld-head"><h3>${L.name}</h3><span class="ld-stars">${[1, 2, 3].map((s) => `<i class="${s <= st ? 'on' : ''}"></i>`).join('')}</span></div>`);
  const cv = document.createElement('canvas'); cv.width = 480; cv.height = 288;
  const c = cv.getContext('2d');
  renderBackground(c, M, 480 / W);
  c.setTransform(480 / W, 0, 0, 480 / W, 0, 0);
  drawSafehouse(c, M.end.x, M.end.y, 0, 0, false, houseGap(M));
  const light = TIME_LIGHT[L.look.time];
  if (light.tint) { c.fillStyle = light.tint; c.fillRect(0, 0, W, H); }
  const mapBox = document.createElement('div'); mapBox.className = 'ld-map';
  mapBox.append(cv);
  const stamp = L.boss ? (L.boss === 'juggernaut' ? 'Elite' : 'Boss') : st ? 'Cleared' : 'Active';
  mapBox.insertAdjacentHTML('beforeend', `<span class="ld-stamp ${stamp.toLowerCase()}">${stamp}</span>`);
  box.append(mapBox);
  const tags = [`${L.waves} waves`, L.look.time, WEATHER.forecast(L)];
  if (L.paths.length > 1) tags.push('2 entrances');
  if (L.water.some((v) => v)) tags.push('water');
  if (L.boss) tags.push(L.boss === 'juggernaut' ? 'elite' : 'boss');
  box.insertAdjacentHTML('beforeend', `<div class="tags">${tags.map((t) => `<span>${t}</span>`).join('')}</div>`);
  const chips = document.createElement('div'); chips.className = 'wave-chips';
  const seen = L.pool.map(([type]) => type);
  if (L.boss) seen.push(L.boss);
  for (const type of seen) chips.append(zombieChip(type, ZOMBIES[type].name, FIRST_SEEN[type] === L.index));
  box.append(chips);
  const m = missionFor(L), spk = speakerOK(L, m.who) ? m.who : 'voss';
  const op = document.createElement('div'); op.className = 'ld-op';
  op.innerHTML = `<span class="ld-op-name">Operation ${m.op.name} <i>${m.step + 1} / 5</i></span><span class="ld-op-goal">${m.objective}</span><div class="ld-op-quote"><canvas width="160" height="160" aria-hidden="true"></canvas><p><b>${(CAST[spk] || CAST.voss).name}</b>${m.line}</p></div>`;
  op.querySelector('canvas').getContext('2d').drawImage(Comms.portrait(spk), 0, 0);
  box.append(op);
  box.insertAdjacentHTML('beforeend', `<p class="hint zombie-tip" hidden></p><p class="hint">${st ? `Best: ${st} of 3 stars. Replays pay a little.` : `First clear pays up to ${Math.round(30 + 45 + L.index * 1.5)} coins.`}</p>`);
  const go = document.createElement('button'); go.type = 'button'; go.className = 'btn btn-primary ld-go'; go.textContent = st ? 'Replay mission' : 'Start mission';
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
    perks: 'Permanent perks apply to every level. Tower upgrades are unlocked with XP in the Armory.',
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
    b.addEventListener('click', () => { onBuy(); Sound.play('buy'); saveMeta(); showStore(tab); });
    body.append(b); el.append(body);
    return el;
  };
  const glyph = (svg) => { const g = document.createElement('div'); g.className = 'glyph'; g.innerHTML = svg; return g; };
  if (tab === 'towers') {
    for (const type of TOWER_KEYS) {
      const d = TOWERS[type];
      if (!d.unlock) continue;
      const open = towerUnlocked(type);
      grid.append(card(towerIcon(type, [0, 0, 0], 64), d.name, `${d.role} · $${d.cost} in battle`, d.desc,
        open ? 'Unlocked' : `Buy · ${d.price} coins`, !open && meta.coins >= d.price,
        () => { meta.coins -= d.price; meta.owned[type] = true; },
        open ? '' : `<p class="hint">Free after clearing ${levelName(d.unlock - 1)}</p>`));
    }
  } else if (tab === 'perks') {
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


// ---------- Armory: spend tower XP to unlock upgrade tiers for good ----------
let armoryType = 'gunner', armorySel = null;
const TAB_NAMES = { gunner: 'Gunner', sniper: 'Sniper', mortar: 'Mortar', cryo: 'Cryo', gunboat: 'Gunboat', flame: 'Flamer', tesla: 'Tesla', heli: 'Gunship', sub: 'Sub', jet: 'Jet', farm: 'Farm' };
const fmtNum = (n) => Math.floor(n).toLocaleString('en-US');
// Upgrades a tower could unlock right now with the XP it has.
function armoryReady(type) {
  let n = 0;
  for (let p = 0; p < 3; p++) { const cap = tierCap(type, p); if (cap < 5 && xpOf(type) >= TIER_XP[cap]) n++; }
  return n;
}
function showArmory(type = armoryType) {
  leaveGame();
  hideScreens();
  if (type !== armoryType) armorySel = null;
  armoryType = type;
  $('#armory-screen').hidden = false;
  renderArmory();
}
function armoryUnlock(type, p, i) {
  if (tierCap(type, p) !== i || xpOf(type) < TIER_XP[i]) { Sound.play('error'); return; }
  meta.xp[type] -= TIER_XP[i];
  const caps = (meta.armory[type] || [FREE_TIER, FREE_TIER, FREE_TIER]).slice();
  caps[p] = i + 1;
  meta.armory[type] = caps;
  saveMeta();
  Sound.play(i >= 4 ? 'tier5' : 'unlock'); buzz(20);
  const next = i + 1 < 5 ? i + 1 : i;
  armorySel = { p, i: next };
  renderArmory();
}
function renderArmory() {
  const type = armoryType, def = TOWERS[type], open = towerUnlocked(type), xp = xpOf(type);
  $('#armory-xp').textContent = `${fmtNum(xp)} XP`;
  if (!armorySel) {
    // start on the next tier this tower can unlock
    let best = null;
    for (let p = 0; p < 3 && !best; p++) { const cap = tierCap(type, p); if (cap < 5 && xp >= TIER_XP[cap]) best = { p, i: cap }; }
    armorySel = best || { p: 0, i: Math.min(4, tierCap(type, 0)) };
  }
  const strip = $('#armory-towers');
  strip.innerHTML = '';
  for (const k of TOWER_KEYS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'armory-tab' + (towerUnlocked(k) ? '' : ' locked');
    b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(k === type));
    b.title = TOWERS[k].name;
    b.append(towerIcon(k, [0, 0, 0], 44));
    const ready = armoryReady(k);
    b.insertAdjacentHTML('beforeend', `<span>${TAB_NAMES[k]}</span>${ready ? `<i class="dot">${ready}</i>` : ''}`);
    b.addEventListener('click', () => { Sound.play('click'); showArmory(k); });
    strip.append(b);
  }
  const { p: sp, i: si } = armorySel;
  const previewTiers = [0, 0, 0]; previewTiers[sp] = si + 1;
  const side = $('#armory-side');
  side.innerHTML = '';
  const pv = document.createElement('div'); pv.className = 'armory-preview';
  pv.append(towerIcon(type, previewTiers, 150));
  side.append(pv);
  side.insertAdjacentHTML('beforeend', `
    <div class="plate"><span class="sub">${def.role} · $${def.cost}</span><h3>${def.name}</h3></div>
    <p>${def.desc}</p>
    <div class="armory-nav">
      <button class="btn" type="button" id="arm-prev" aria-label="Previous tower">‹</button>
      <span class="xp-big">${fmtNum(xp)} <small>XP</small></span>
      <button class="btn" type="button" id="arm-next" aria-label="Next tower">›</button>
    </div>
    ${open ? '<p class="hint">Earn XP by getting kills with this tower and clearing levels with it.</p>' : `<p class="locked-note">Tower locked</p><p class="hint">Unlock it by clearing ${levelName(def.unlock - 1)}, or buy it in the store.</p>`}`);
  const idx = TOWER_KEYS.indexOf(type);
  $('#arm-prev').addEventListener('click', () => { Sound.play('click'); showArmory(TOWER_KEYS[(idx + TOWER_KEYS.length - 1) % TOWER_KEYS.length]); });
  $('#arm-next').addEventListener('click', () => { Sound.play('click'); showArmory(TOWER_KEYS[(idx + 1) % TOWER_KEYS.length]); });

  const grid = $('#armory-paths');
  grid.innerHTML = '';
  def.paths.forEach((path, p) => {
    const row = document.createElement('div'); row.className = 'arm-row'; row.style.setProperty('--pc', PATH_COLORS[p]);
    row.insertAdjacentHTML('beforeend', `<div class="arm-path"><span>Path ${p + 1}</span><b>${path.name}</b></div>`);
    const cap = tierCap(type, p);
    path.ups.forEach((u, i) => {
      const state = i < cap ? 'owned' : i === cap ? (xp >= TIER_XP[i] ? 'ready' : 'next') : 'locked';
      const tiers = [0, 0, 0]; tiers[p] = i + 1;
      const tile = document.createElement('button');
      tile.type = 'button'; tile.className = 'arm-tile'; tile.dataset.state = state;
      tile.setAttribute('aria-pressed', String(sp === p && si === i));
      tile.title = `${u.name}: ${u.desc}`;
      tile.append(towerIcon(type, tiers, 48));
      const badge = state === 'owned' ? (i < FREE_TIER ? 'Ready' : 'Unlocked') : `${LOCK_SVG}${fmtNum(TIER_XP[i])}`;
      tile.insertAdjacentHTML('beforeend', `<span class="t-tier">${i + 1}</span><span class="t-name">${u.name}</span><span class="t-badge">${badge}</span>`);
      tile.addEventListener('click', () => { Sound.play('click'); armorySel = { p, i }; renderArmory(); });
      row.append(tile);
    });
    grid.append(row);
  });

  const u = def.paths[sp].ups[si], cap = tierCap(type, sp);
  const detail = $('#armory-detail');
  detail.style.setProperty('--pc', PATH_COLORS[sp]);
  detail.innerHTML = `<div class="ad-text"><span class="sub">Tier ${si + 1} · ${def.paths[sp].name}</span><h3>${u.name}</h3><p>${u.desc}</p></div>
    <div class="ad-buy"><span class="ad-cost">In battle <b>$${upCost(type, sp, si)}</b></span></div>`;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-primary';
  if (si < cap) { b.textContent = si < FREE_TIER ? 'Ready from the start' : 'Unlocked'; b.disabled = true; }
  else if (si === cap) { b.innerHTML = `Unlock · ${fmtNum(TIER_XP[si])} XP`; b.disabled = xp < TIER_XP[si]; b.addEventListener('click', () => armoryUnlock(type, sp, si)); }
  else { b.textContent = `Unlock tier ${cap + 1} first`; b.disabled = true; }
  detail.querySelector('.ad-buy').append(b);
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
  if (tw) { S.selected = tw === S.selected ? null : tw; Sound.play('select', tw.x); } else S.selected = null;
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
  else if (S.selected && [',', '.', '/'].includes(k)) upgradeTower(S.selected, [',', '.', '/'].indexOf(k));
  else if (S.selected && k === 's') sellTower(S.selected);
  else if (S.selected && k === 't' && S.selected.type !== 'jet') cycleTarget(S.selected);
});

function cycleSpeed() { S.speed = S.speed === 3 ? 1 : S.speed + 1; $('#btn-speed').textContent = `${S.speed}×`; $('#btn-speed').setAttribute('aria-pressed', String(S.speed > 1)); Sound.play('speed', null, { pitch: S.speed }); }
function toggleAuto() { S.auto = !S.auto; $('#btn-auto').setAttribute('aria-pressed', String(S.auto)); Sound.play('click'); }
function toggleSound() {
  Sound.setMuted(!Sound.muted);
  $('#btn-sound').setAttribute('aria-pressed', String(!Sound.muted));
  $('#btn-sound').textContent = Sound.muted ? 'Muted' : 'Sound';
  store.set('zbash.muted', Sound.muted ? '1' : '0');
  Sound.play('click');
}
function toggleMusic() {
  Sound.setMusic(!Sound.musicOn);
  store.set('zbash.music', Sound.musicOn ? '1' : '0');
  syncMusicButtons();
  Sound.play('click');
}
function syncMusicButtons() {
  for (const b of document.querySelectorAll('.btn-music')) { b.textContent = `Music: ${Sound.musicOn ? 'On' : 'Off'}`; b.setAttribute('aria-pressed', String(Sound.musicOn)); }
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
// a chapter unlocked by this win plays before whatever the player picked next
function afterStory(fn) { const id = S.storyNext; S.storyNext = null; if (id) { leaveGame(); storyThen(id, fn); } else fn(); }
$('#btn-retry').addEventListener('click', () => afterStory(() => startGame(S.levelIndex)));
$('#btn-menu').addEventListener('click', () => { const w = S.L.world, f = S.levelIndex + (S.state === 'won' ? 1 : 0); afterStory(() => showLevels(w, f)); });
$('#btn-next').addEventListener('click', () => { const i = S.levelIndex + 1; if (LEVEL_META[i]) afterStory(() => startGame(i)); });
$('#btn-campaign').addEventListener('click', () => { Sound.init(); Sound.play('click'); let w = 0; while (w + 1 < WORLDS.length && worldUnlocked(w + 1)) w++; storyThen('prologue', () => showWorlds(w)); });
$('#btn-story').addEventListener('click', () => { Sound.init(); Sound.play('click'); showChapters(); });
$('#btn-chapters-back').addEventListener('click', () => { Sound.play('click'); showMenu(); });
$('#btn-store').addEventListener('click', () => { Sound.init(); Sound.play('click'); showStore('towers'); });
$('#btn-armory').addEventListener('click', () => { Sound.init(); Sound.play('click'); showArmory(); });
$('#btn-armory-back').addEventListener('click', showMenu);
$('#btn-world-back').addEventListener('click', showMenu);
$('#btn-levels-back').addEventListener('click', () => showWorlds(S.worldSel));
$('#btn-store-back').addEventListener('click', showMenu);
for (const b of document.querySelectorAll('#store-tabs .tab')) b.addEventListener('click', () => { Sound.play('click'); showStore(b.dataset.tab); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (S.state === 'playing') { checkpoint(); saveMeta(); setPaused(true); } Sound.suspend(); }
});

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
if (store.get('zbash.music') === '0') Sound.musicOn = false;
syncMusicButtons();
for (const b of document.querySelectorAll('.btn-music')) b.addEventListener('click', () => { Sound.init(); toggleMusic(); });
// Browsers only allow audio after a touch, so the first tap anywhere switches it on.
// Every button clicks; buttons with their own sound simply play over it.
document.addEventListener('pointerdown', () => Sound.init(), true);
document.addEventListener('click', (e) => { if (e.target.closest('button')) Sound.play('click'); }, true);
{
  // show the furthest unlocked level behind the menus
  let furthest = 0;
  while (furthest + 1 < TOTAL_LEVELS && levelUnlocked(furthest + 1)) furthest++;
  S.levelIndex = furthest; S.L = getLevel(furthest); S.M = buildLevel(S.L); S.worldSel = S.L.world;
  S.cash = S.L.gold; S.lives = maxLives(); S.maxLives = S.lives;
  $('#st-id').textContent = S.L.id; $('#st-name').textContent = S.L.name;
  initWeather();
}
MenuFX.init($('#menu-fx'));
Comms.init($('#stage'));
Comms.setHold(() => S.paused || S.state !== 'playing' || Story.active);
Story.init();
LevelFX.init($('#level-fx'));
new ResizeObserver(() => layoutLevels()).observe($('#level-grid'));
buildShop(); renderInfo(); renderNextWave(); renderPowerbar();
resize();
updateHUD(true);
showMenu();
// Start mapping the globe in the background so the world screen opens instantly.
setTimeout(() => Globe.prepare(), 300);
setTimeout(() => WART.prewarm(), 1200);
new ResizeObserver(() => resize()).observe(stage);
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { buildShop(); updateHUD(true); });
requestAnimationFrame(frame);

// Small hook for automated tests and tinkering in the console.
window.ZombieBash = { S, meta, LEVEL_META, getLevel, spawnEnemy, TOWERS, ZOMBIES, startGame, startWave, placeTower, upgradeTower, upgradeState, update, canPlaceAt, towerUnlocked, showWorlds, showLevels, showStore, showMenu, showArmory, selectLevel, usePower, callAirstrike, saveMeta, upCost, towerStats, Story, showChapters };
