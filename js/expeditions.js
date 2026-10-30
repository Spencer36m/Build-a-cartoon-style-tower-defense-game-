'use strict';
// ============================================================
// Wonder expeditions: one hand-made battle at each wonder on the globe, against zombies that
// belong to that place and a boss that guards it. Beating one earns the wonder's power.
// They are built to be earned: find the wonder on the globe, then open it with a Wonder Key
// (one for every 15 campaign stars). Every expedition fights like the end of the Fallen City,
// with 20 waves, 10 lives, less cash and no store supplies.
// ============================================================
const EXPED = (() => {
  const STARS_PER_KEY = 15, LIVES = 10, DIFF = 6.5, RECHARGE = 5, MAX_CHARGE = 2;
  // host: the campaign world whose painting, music and sky an expedition borrows (its colours
  // are its own). mobs: [type, first wave]; old: campaign zombies that join them.
  const LIST = {
    cinder: {
      id: 'cinder', name: 'Mount Cinder', boss: 'cinderKing', host: 4, seed: 9101, paths: 1,
      blurb: 'Lava flows cross the valley under the volcano. Every few waves it erupts and the lava closes more ground, burning any zombie that wades through.',
      mobs: [['ashwalker', 1], ['magma', 3], ['ember', 99]], old: [['runner', 2], ['brute', 8], ['scorpion', 5]], rush: 'magma',
      power: { name: 'Eruption', short: 'Erupt', target: true, desc: 'Lava rains on a spot you tap for six seconds, burning everything there.' },
      times: ['dusk', 'night'], forecast: { clear: 1, embers: 4, heat: 1.6 },
      pal: { lo: '#1e1816', mid: '#2e2622', hi: '#4a3e36', patchA: '#5a2a18', patchB: '#14100e', dirt: '#3a2e28', tuft: ['#3a2e22', '#54442e', '#6a3a22'] },
      roadBase: '#7a6a5c', waterLook: { lava: true, deep: '#ffc040', shallow: '#c8300a', bank: 'rgba(16,10,8,0.92)', foam: 'rgba(40,20,12,0.85)' },
      decor: ['basalt', 'basalt', 'basalt', 'vent', 'vent', 'deadtree', 'skull', 'rock'],
      intro: ['okafor', 'Mount Cinder. The heat cooks the strain into something new. Do not let them cross the lava.'],
      enrage: ['voss', 'Its plates are cracking off! Less armour, but it is faster. Pour it on!'],
      win: ['okafor', 'The mountain is quiet. I can take samples of the Cinder King. That fire is ours now.'],
      chatter: { mid: [['moreno', 'It is like fighting inside an oven.'], ['laila', 'Lava is moving. Watch the ground.']], last: [['voss', 'Last wave. The mountain is waking up.']], hurt: [['voss', 'They are through! Plug the gap!']], lose: [['voss', 'Pull back before the lava takes us too.']], winAny: [['voss', 'Mount Cinder is ours.']] },
    },
    kraken: {
      id: 'kraken', name: 'The Deep One', boss: 'kraken', host: 0, seed: 9203, paths: 1, sea: true,
      blurb: 'A drowned coast, mostly water, crossed on long bridges. Tentacles rise out of the sea to drag down zombies, and boats too.',
      mobs: [['sailor', 1], ['crab', 3]], old: [['runner', 2], ['bloater', 7], ['carrion', 10]], rush: 'sailor',
      power: { name: "Kraken's Grasp", short: 'Grasp', desc: 'Tentacles burst out of the ground and drag the six strongest zombies under. Bosses only lose a chunk of health.' },
      times: ['dusk', 'day', 'night'], forecast: { clear: 1.4, rain: 3, storm: 2.6, fog: 2 },
      pal: { lo: '#36442e', mid: '#4a5a3a', hi: '#6a7650', patchA: '#8a8264', patchB: '#2e3a28', dirt: '#5a5040', tuft: ['#3a4a2c', '#5a6a3e', '#7a8a52'] },
      roadBase: '#6a6250', waterLook: { deep: '#0e2a3a', shallow: '#2e6a7a', bank: 'rgba(40,38,30,0.7)', foam: 'rgba(230,245,250,0.75)' },
      decor: ['rock', 'rock', 'anchor', 'rowboat', 'palm', 'barrel', 'nets'],
      intro: ['laila', 'The Deep One. Something huge is moving under that water. Stay off the bridges.'],
      enrage: ['moreno', 'It is angry now! Those tentacles are everywhere!'],
      win: ['laila', 'It sank. We are keeping one of its tentacles... on our side.'],
      chatter: { mid: [['moreno', 'I hate the sea. I hate it so much.'], ['laila', 'Bubbles by the bridge. Something is down there.']], last: [['voss', 'Last wave. The tide is turning.']], hurt: [['voss', 'They are on the beach! Hold!']], lose: [['voss', 'Back to the boats. The sea wins this one.']], winAny: [['voss', 'The coast is ours.']] },
    },
    dragon: {
      id: 'dragon', name: 'The Red Dragon', boss: 'boneWyrm', host: 1, seed: 9307, paths: 2,
      blurb: "The Red Dragon's mountain. It fights on your side, flying over now and then to burn the horde, while its undead rival marches on the hoard.",
      mobs: [['kobold', 1], ['cultist', 3]], old: [['skeleton', 1], ['bucket', 5], ['necro', 9]], rush: 'kobold',
      power: { name: "Dragon's Breath", short: 'Breath', target: true, desc: 'The Red Dragon swoops down the lane you tap and torches it end to end.' },
      times: ['dusk', 'night', 'dawn'], forecast: { clear: 1.6, embers: 3.4, storm: 1 },
      pal: { lo: '#2a1612', mid: '#3e2418', hi: '#5a3622', patchA: '#6a4a2a', patchB: '#22120e', dirt: '#4a3020', tuft: ['#4a2a1a', '#6a4426', '#8a5a30'] },
      roadBase: '#6a5a4a', waterLook: { deep: '#16242a', shallow: '#3a525a' },
      decor: ['bones', 'bones', 'hoard', 'deadtree', 'rock', 'rock', 'skull', 'tomb'],
      intro: ['voss', 'The Red Dragon is on our side today. Its rival is not. Hold the pass and let it burn them.'],
      enrage: ['laila', 'Green fire! It is breathing faster now!'],
      win: ['voss', 'The Bone Wyrm is dust. The Red Dragon bowed to us, Commander. It will answer if we call.'],
      chatter: { mid: [['moreno', 'Did that dragon just wave at me?'], ['laila', 'Wings overhead. Ours, I think.']], last: [['voss', 'Last wave. Here comes the wyrm.']], hurt: [['voss', 'They are at the hoard!']], lose: [['voss', 'Fall back down the mountain.']], winAny: [['voss', 'The pass is ours.']] },
    },
    dinos: {
      id: 'dinos', name: 'Dino Valley', boss: 'rexMortis', host: 3, seed: 9419, paths: 1,
      blurb: 'A lost valley where the old giants woke up. Living dinosaurs graze beside the road and trample any zombie that wanders near them.',
      mobs: [['compy', 1], ['ankylo', 6]], old: [['runner', 1], ['brute', 9], ['cone', 4]], rush: 'compy',
      power: { name: 'Stampede', short: 'Stampede', desc: 'A herd charges back down the road from the safehouse, flattening every zombie in its way.' },
      times: ['day', 'dawn', 'dusk'], forecast: { clear: 2.4, rain: 2.4, mist: 1.6, storm: 1.2 },
      pal: { lo: '#24401a', mid: '#3a6024', hi: '#5a8a34', patchA: '#6a7a2a', patchB: '#1e3416', dirt: '#5a4a2a', tuft: ['#2a4a1a', '#4a7a2a', '#6a9a3a'] },
      roadBase: '#7a6040', waterLook: { deep: '#1a3a2a', shallow: '#3a7a5a' },
      decor: ['fern', 'fern', 'fern', 'palm', 'palm', 'nest', 'bones', 'rock'],
      intro: ['okafor', 'Dino Valley. The living ones hate the dead. Build near them and let them help.'],
      enrage: ['moreno', 'It is calling its friends! Armoured ones!'],
      win: ['okafor', 'Rex Mortis is down. The herd is following us now. Remarkable.'],
      chatter: { mid: [['moreno', 'Big one on the left is eating a zombie. Good boy.'], ['laila', 'Small ones, fast. Watch the gaps.']], last: [['voss', 'Last wave. Something big is shaking the ground.']], hurt: [['voss', 'They are in the camp!']], lose: [['voss', 'Back to the chopper. This valley wins.']], winAny: [['voss', 'The valley is ours.']] },
    },
    ufo: {
      id: 'ufo', name: 'Visitors', boss: 'abductor', host: 0, seed: 9533, paths: 2,
      blurb: 'Crop circles in the fields and lights in the sky. Scout saucers beam your towers up and take them away for a few seconds.',
      mobs: [['grey', 1], ['cow', 4]], old: [['walker', 1], ['runner', 2], ['cone', 5], ['carrion', 8]], rush: 'grey',
      power: { name: 'Tractor Beam', short: 'Beam', desc: 'Lifts the strongest zombie on the map clean off it. Bosses are held still and hurt instead.' },
      times: ['night', 'night', 'dusk'], forecast: { clear: 3, fog: 2, storm: 1.2 },
      pal: null, roadBase: null, waterLook: null,
      decor: ['crops', 'crops', 'hay', 'fence', 'oak', 'cow', 'cow', 'barn'],
      intro: ['moreno', 'Visitors. Lights in the sky, cows in the road. I did not sign up for this.'],
      enrage: ['laila', 'More of them! It is beaming twice as fast!'],
      win: ['moreno', 'The saucer is down. And we kept the beam. I want to beam everything now.'],
      chatter: { mid: [['moreno', 'Another cow went up. Poor cow.'], ['laila', 'Lights overhead. Watch your towers.']], last: [['voss', 'Last wave. The big one is coming down.']], hurt: [['voss', 'They are through the fence!']], lose: [['voss', 'Fall back. Leave the farm to them.']], winAny: [['voss', 'The farm is ours again.']] },
    },
  };
  const ORDER = ['cinder', 'kraken', 'dragon', 'dinos', 'ufo'];
  const ICONS = {
    cinder: '<svg viewBox="0 0 24 24"><path d="M3 21l6-11 3 4 2-3 7 10zM12 3c1 2 3 2 3 4s-2 3-3 3-3-1-3-3 2-2 3-4z"/></svg>',
    kraken: '<svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 1 6 6c0 2-1 3-2 4l1 6c0 1-2 2-2 0l-1-5h-1v6h-2v-6H10l-1 5c0 2-2 1-2 0l1-6c-1-1-2-2-2-4a6 6 0 0 1 6-6z"/></svg>',
    dragon: '<svg viewBox="0 0 24 24"><path d="M2 12l7-3 3-6 2 6 8 1-6 3 2 8-6-5-5 4 1-6z"/></svg>',
    dinos: '<svg viewBox="0 0 24 24"><path d="M3 18c2-6 6-9 11-9 3 0 4-3 7-3l-1 4-3 1 1 3-2 1v4h-2v-3h-4v3H8v-3l-3 2z"/></svg>',
    ufo: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="10" rx="10" ry="3.5"/><path d="M8 9a4 4 0 0 1 8 0M8 14l-2 7M16 14l2 7M12 14v7"/></svg>',
  };

  // ---------- progress ----------
  const st = () => { if (!meta.exp) meta.exp = { open: [], won: {}, charge: {}, tick: 0 }; return meta.exp; };
  const has = (id) => !!LIST[id];
  const isOpen = (id) => st().open.includes(id);
  const wonStars = (id) => st().won[id] | 0;
  function campaignStars() { let n = 0; for (const k of Object.keys(meta.stars)) n += meta.stars[k] | 0; return n; }
  const keysEarned = () => Math.floor(campaignStars() / STARS_PER_KEY);
  const keysLeft = () => Math.max(0, keysEarned() - st().open.length);
  const starsToKey = () => STARS_PER_KEY - (campaignStars() % STARS_PER_KEY);
  function unlock(id) {
    if (isOpen(id) || keysLeft() <= 0) return false;
    st().open.push(id); saveMeta();
    return true;
  }

  // ---------- the battlefield ----------
  function world(X) {
    const host = WORLDS[X.host];
    return {
      ...host, decor: X.decor, times: X.times, forecast: X.id,
      ...(X.pal ? { pal: X.pal } : {}), ...(X.roadBase ? { roadBase: X.roadBase } : {}), ...(X.waterLook ? { waterLook: X.waterLook } : {}),
    };
  }
  // a coastline: the sea along one side, with a channel cutting inland
  function seaMask(rng) {
    const m = new Uint8Array(COLS * ROWS), side = rng() < 0.5 ? 'bottom' : 'top', ph = rng() * TAU;
    for (let x = 0; x < COLS; x++) {
      const d = Math.round(3.4 + Math.sin(x * 0.45 + ph) * 1.3 + Math.sin(x * 1.1 + ph * 2) * 0.6);
      for (let k = 0; k < d; k++) m[(side === 'bottom' ? ROWS - 1 - k : k) * COLS + x] = 1;
    }
    const ch = makeWater(rng, 'river');
    for (let i = 0; i < m.length; i++) if (ch[i]) m[i] = 1;
    const lake = makeWater(rng, 'lake');
    for (let i = 0; i < m.length; i++) if (lake[i]) m[i] = 1;
    return m;
  }
  const LEVELS = new Map();
  function level(id) {
    if (LEVELS.has(id)) return LEVELS.get(id);
    const X = LIST[id];
    let attempt = 0, main = null, entry = null, rng;
    while (!main) {
      rng = mulberry32(X.seed + attempt * 7);
      entry = entryFor(rng, [0, 0, 1, 2, 3][Math.floor(rng() * 5)]);
      main = tryMainPath(rng, 40 - Math.floor(attempt / 4), 54 + Math.floor(attempt / 4), entry);
      attempt++;
    }
    const paths = [toWaypoints(entry.off, main)], pathTiles = [main];
    for (let k = 0; X.paths > 1 && k < 10 && paths.length < 2; k++) {
      const sec = trySecondPath(rng, main, [1, 2, 0, 3][Math.floor(rng() * 4)]);
      if (sec) { paths.push(toWaypoints(sec.off, sec.tiles)); pathTiles.push(sec.tiles); }
    }
    const onPath = new Uint8Array(COLS * ROWS);
    for (const tl of pathTiles) for (const [x, y] of tl) onPath[y * COLS + x] = 1;
    let water = new Uint8Array(COLS * ROWS);
    if (X.sea) water = seaMask(rng);
    else if (id === 'cinder') { const a = makeWater(rng, 'river'), b = makeWater(rng, 'river'); for (let i = 0; i < water.length; i++) water[i] = a[i] || b[i] ? 1 : 0; }
    else if (id === 'dinos') water = makeWater(rng, 'river');
    else if (id === 'dragon' || id === 'ufo') water = makeWater(rng, 'lake');
    const end = main[main.length - 1];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = end[0] + dx, y = end[1] + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS) water[y * COLS + x] = 0; }
    // every map keeps enough dry ground to build on
    const limit = X.sea ? 0.42 : id === 'cinder' ? 0.2 : 0.16;
    let wet = 0; for (let i = 0; i < water.length; i++) if (water[i] && !onPath[i]) wet++;
    if (wet > COLS * ROWS * limit) for (let i = 0; i < water.length; i++) if (water[i] && !onPath[i] && rng() < 1 - (COLS * ROWS * limit) / wet) water[i] = 0;
    const bridges = new Uint8Array(COLS * ROWS);
    for (let i = 0; i < water.length; i++) if (water[i] && onPath[i]) bridges[i] = 1;
    const decor = [];
    let tries = 0;
    const want = 14 + Math.floor(rng() * 6);
    while (decor.length < want && tries++ < 600) {
      const x = Math.floor(rng() * COLS), y = Math.floor(rng() * ROWS), k = y * COLS + x;
      if (onPath[k] || water[k] || decor.some((d) => d.c === x && d.r === y)) continue;
      if (Math.abs(x - end[0]) <= 1 && Math.abs(y - end[1]) <= 1) continue;
      const kind = X.decor[Math.floor(rng() * X.decor.length)];
      decor.push({ kind, c: x, r: y, x: x * TILE + TILE / 2 + (rng() - 0.5) * 10, y: y * TILE + TILE / 2 + (rng() - 0.5) * 10, s: 0.85 + rng() * 0.3, rot: rng() * TAU, seed: Math.floor(rng() * 1e6) });
    }
    const pool = [...X.mobs.filter(([, f]) => f < 99), ...X.old];
    const L = {
      index: -1, world: X.host, tier: 6, num: 99, id: 'EXP', name: X.name, exp: id, worldDef: world(X),
      waves: 20, diff: DIFF, gold: Math.round((260 + DIFF * 55) * 0.85), boss: X.boss, rush: X.rush,
      paths, water, bridges, decor, pool, t: 1,
      look: { time: X.times[Math.floor(rng() * X.times.length)], weather: Object.keys(X.forecast)[0], tone: 0, seed: X.seed * 13 },
    };
    LEVELS.set(id, L);
    return L;
  }

  // ---------- one battle's state ----------
  let R = null; // the twist's moving parts for the expedition being played
  function begin(L, M) {
    const X = LIST[L.exp];
    R = { id: L.exp, t: 0, lava: null, lavaCv: null, glowCv: null, bubbles: [], tentacles: [], flights: [], dinos: [], scouts: [], zones: [], herds: [], beams: [], erupted: 0, next: 10 };
    if (L.exp === 'cinder') {
      // lava is impassable ground: nothing can be built on it, not even boats
      R.lava = L.water.slice();
      for (let i = 0; i < R.lava.length; i++) if (R.lava[i] && M.grid[i] === 3) M.grid[i] = 4;
      R.fresh = [];
      paintLava(M);
    }
    if (L.exp === 'dinos') {
      const rng = mulberry32(L.look.seed + 3), spots = freeNearRoad(M, 2);
      for (let i = 0; i < 3 && spots.length; i++) {
        const [c, r] = spots.splice(Math.floor(rng() * spots.length), 1)[0];
        R.dinos.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, tx: null, ty: null, ang: rng() * TAU, cd: 1 + i, wait: rng() * 3, kind: i === 1 ? 'long' : 'tri', step: 0, seed: i * 31 + 7 });
      }
    }
    R.next = { kraken: 8, dragon: 14, ufo: 12 }[L.exp] || 0;
    sayLineX(X.intro, 2.4);
  }
  function end() { R = null; }
  const sayLineX = (line, delay) => { if (line && typeof Comms !== 'undefined') Comms.say(line[0], line[1], { tag: 'EXPEDITION', delay }); };
  function freeNearRoad(M, reach) {
    const out = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (M.grid[r * COLS + c] !== 0) continue;
      let near = false;
      for (let dy = -reach; dy <= reach && !near; dy++) for (let dx = -reach; dx <= reach; dx++) { const x = c + dx, y = r + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS && M.grid[y * COLS + x] === 1) { near = true; break; } }
      if (near) out.push([c, r]);
    }
    return out;
  }
  const tileOf = (x, y) => { const c = Math.floor(x / TILE), r = Math.floor(y / TILE); return c < 0 || r < 0 || c >= COLS || r >= ROWS ? -1 : r * COLS + c; };
  const ground = () => S.enemies.filter((e) => !e.dead && !e.fly && !e.burrowed && onField(e));
  const scaleNow = () => hpScale(effWave(S.L, Math.max(1, S.wave)));

  // ---------- lava (Mount Cinder) ----------
  function paintLava(M) {
    // the newly flooded tiles are painted here; the first flows are part of the background
    const cv = R.lavaCv || document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'); c.clearRect(0, 0, W, H);
    const rng = mulberry32(99);
    for (const k of R.fresh) {
      const x = (k % COLS) * TILE + TILE / 2, y = Math.floor(k / COLS) * TILE + TILE / 2;
      ellipse(c, x, y, TILE * 0.62, TILE * 0.6); c.fillStyle = 'rgba(16,10,8,0.9)'; c.fill();
      ellipse(c, x, y, TILE * 0.52, TILE * 0.5); c.fillStyle = radial(c, x, y, TILE * 0.55, '#ffc040', '#c8300a', 0, 0); c.fill();
      for (let i = 0; i < 4; i++) { ellipse(c, x + (rng() - 0.5) * TILE * 0.6, y + (rng() - 0.5) * TILE * 0.6, 4 + rng() * 5, 3 + rng() * 3, rng() * 3); c.fillStyle = 'rgba(40,20,14,0.55)'; c.fill(); }
    }
    R.lavaCv = cv;
    const g = R.glowCv || document.createElement('canvas'); g.width = W / 4; g.height = H / 4;
    const gc = g.getContext('2d'); gc.clearRect(0, 0, g.width, g.height); gc.scale(0.25, 0.25);
    for (let i = 0; i < R.lava.length; i++) if (R.lava[i]) { const x = (i % COLS) * TILE + TILE / 2, y = Math.floor(i / COLS) * TILE + TILE / 2; gc.fillStyle = radial(gc, x, y, TILE * 1.1, 'rgba(255,120,30,0.5)', 'rgba(255,90,20,0)', 0, 0); gc.fillRect(x - TILE * 1.1, y - TILE * 1.1, TILE * 2.2, TILE * 2.2); }
    R.glowCv = g;
  }
  function erupt() {
    const M = S.M, cand = [];
    for (let i = 0; i < R.lava.length; i++) {
      if (R.lava[i] || M.grid[i] !== 0 || S.towerAt.has(i)) continue;
      const c = i % COLS, r = Math.floor(i / COLS);
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const x = c + dx, y = r + dy; return x >= 0 && y >= 0 && x < COLS && y < ROWS && R.lava[y * COLS + x] && M.grid[y * COLS + x] !== 1; })) cand.push(i);
    }
    const n = Math.min(cand.length, 4);
    for (let k = 0; k < n; k++) { const i = cand.splice(Math.floor(Math.random() * cand.length), 1)[0]; R.lava[i] = 1; M.grid[i] = 4; R.fresh.push(i); }
    if (!n) return;
    paintLava(M);
    addShake(8); Sound.play('boom', W / 2);
    showBanner('Eruption', 'The lava has spread');
    for (let i = 0; i < 30; i++) S.fx.push({ kind: 'spark', x: rand(0, W), y: rand(0, H * 0.4), vx: rand(-40, 40), vy: rand(20, 90), r: rand(1, 2.5), color: '255,150,50', life: 1.2, max: 1.2 });
  }

  // ---------- update ----------
  function onWave(n) {
    if (!R) return;
    if (R.id === 'cinder' && n > 1 && n % 4 === 0) erupt();
  }
  function update(dt) {
    if (!R) return;
    R.t += dt;
    const busy = S.enemies.length > 0;
    if (R.id === 'cinder') {
      // zombies wading across a lava causeway catch fire
      for (const e of ground()) { const k = tileOf(e.x, e.y); if (k >= 0 && R.lava[k] && !ZOMBIES[e.type].noBurn) ignite(e, e.maxHp * 0.1, 1.6, null); }
      if (Math.random() < dt * 6) { const i = Math.floor(Math.random() * R.lava.length); if (R.lava[i]) R.bubbles.push({ x: (i % COLS + Math.random()) * TILE, y: (Math.floor(i / COLS) + Math.random()) * TILE, t: 0 }); }
      for (const b of R.bubbles) b.t += dt;
      R.bubbles = R.bubbles.filter((b) => b.t < 0.8);
    }
    if (R.id === 'kraken' && busy && (R.next -= dt) <= 0) {
      R.next = Math.max(5, 10 - S.wave * 0.2);
      const shore = [];
      for (const e of ground()) { const c = Math.floor(e.x / TILE), r = Math.floor(e.y / TILE); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) { const x = c + dx, y = r + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS && S.L.water[y * COLS + x] && S.M.grid[y * COLS + x] !== 1) shore.push([x, y, e]); } }
      if (shore.length) { const [x, y, e] = shore[Math.floor(Math.random() * shore.length)]; tentacle(x * TILE + TILE / 2, y * TILE + TILE / 2, e, false); }
    }
    if (R.id === 'dragon' && busy && (R.next -= dt) <= 0) {
      R.next = 20;
      const gs = ground();
      if (gs.length) { const e = gs[Math.floor(Math.random() * gs.length)]; flyover(e.x, e.y, false); sayLineX(['laila', 'Dragon overhead! Here comes the fire!'], 0); }
    }
    if (R.id === 'ufo' && busy && (R.next -= dt) <= 0) {
      R.next = Math.max(12, 18 - S.wave * 0.2);
      const free = S.towers.filter((t) => !(t.stun > 0));
      if (free.length) beamTower(free[Math.floor(Math.random() * free.length)], 3.5, true);
    }
    if (R.id === 'dinos') updateDinos(dt);
    for (const tn of R.tentacles) {
      tn.t += dt;
      if (!tn.hit && tn.t > 0.55) {
        tn.hit = true;
        if (tn.target && !tn.target.dead) { if (tn.power) { tn.x = tn.target.x; tn.y = tn.target.y; } grab(tn.target, tn.power); }
        // a tentacle near the shore swats any boat in reach too
        if (!tn.power) for (const t of S.towers) if (TOWERS[t.type].place === 'water' && dist2(t.x, t.y, tn.x, tn.y) < (TILE * 1.3) ** 2) { t.stun = 2; t.stunKind = 'slam'; }
        Sound.play('splash', tn.x);
      }
    }
    R.tentacles = R.tentacles.filter((tn) => tn.t < 1.6);
    for (const f of R.flights) updateFlight(f, dt);
    R.flights = R.flights.filter((f) => f.k < 1);
    for (const s of R.scouts) s.t += dt;
    R.scouts = R.scouts.filter((s) => s.t < s.dur + 1.2);
    for (const z of R.zones) {
      z.t -= dt;
      for (const e of S.enemies) if (!e.dead && !e.fly && dist2(e.x, e.y, z.x, z.y) <= z.r * z.r) { damage(e, z.dps * dt, null, 0.5, true); if (!e.dead) ignite(e, z.dps * 0.25, 1.5, null); }
      if (Math.random() < dt * 14) { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * z.r; R.bubbles.push({ x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d, t: 0, rain: true }); }
      if (Math.random() < dt * 3) Sound.play('flame', z.x);
    }
    R.zones = R.zones.filter((z) => z.t > 0);
    for (const h of R.herds) updateHerd(h, dt);
    R.herds = R.herds.filter((h) => h.d > -60);
    for (const b of R.beams) b.t += dt;
    R.beams = R.beams.filter((b) => b.t < 1.4);
  }

  // ---------- the twists' moving parts ----------
  function tentacle(x, y, target, power) { R.tentacles.push({ x, y, t: 0, target, power, hit: false, side: Math.random() < 0.5 ? -1 : 1 }); }
  function grab(e, power) {
    const def = ZOMBIES[e.type];
    if (def.boss) { damage(e, e.maxHp * (power ? 0.08 * power : 0.03), null, 1); return; }
    // dragged under: the twist takes most of a zombie's health, the power all of it
    if (power) kill(e, null); else damage(e, e.maxHp * 0.6, null, 1);
    for (let i = 0; i < 8; i++) S.fx.push({ kind: 'debris', x: e.x, y: e.y, vx: rand(-60, 60), vy: rand(-60, 60), r: rand(1.5, 3), color: '#cfe6ee', life: 0.5, max: 0.5 });
  }
  // the Red Dragon crosses the map along a line through (x, y), burning a band under it
  function flyover(x, y, power) {
    const a = power ? 0 : rand(0, TAU), L = Math.hypot(W, H) * 0.75;
    const f = { ax: x - Math.cos(a) * L, ay: y - Math.sin(a) * L, bx: x + Math.cos(a) * L, by: y + Math.sin(a) * L, a, k: 0, power, hit: new Set(), dur: power ? 2.2 : 2.8 };
    if (power) { f.ax = -120; f.bx = W + 120; f.ay = f.by = y; }
    R.flights.push(f);
    Sound.play('roar', x);
  }
  function updateFlight(f, dt) {
    f.k += dt / f.dur;
    const x = lerp(f.ax, f.bx, f.k), y = lerp(f.ay, f.by, f.k);
    f.x = x; f.y = y;
    const band = (f.power ? 1.3 : 0.75) * TILE, sc = scaleNow(), k3 = f.power ? strength('dragon') : 1;
    for (const e of S.enemies) {
      if (e.dead || f.hit.has(e) || !onField(e)) continue;
      // only what is just behind the dragon's head gets the fire
      const dx = e.x - x, dy = e.y - y, along = dx * Math.cos(f.a) + dy * Math.sin(f.a), across = -dx * Math.sin(f.a) + dy * Math.cos(f.a);
      if (Math.abs(across) > band || along > 10 || along < -70) continue;
      f.hit.add(e);
      const def = ZOMBIES[e.type];
      const dmg = f.power ? 55 * sc * k3 : def.boss ? e.maxHp * 0.02 : e.maxHp * 0.22;
      damage(e, dmg, null, 0.8);
      if (!e.dead && !def.noBurn) ignite(e, (f.power ? 8 * sc * k3 : e.maxHp * 0.06), 3, null);
    }
    if (Math.random() < dt * 30) S.fx.push({ kind: 'fire', x: x - Math.cos(f.a) * 30 + rand(-8, 8), y: y - Math.sin(f.a) * 30 + rand(-8, 8), vx: rand(-20, 20), vy: rand(-20, 20), r: rand(5, 9), life: 0.5, max: 0.5 });
  }
  function beamTower(t, dur, scout) {
    t.stun = Math.max(t.stun || 0, dur); t.stunKind = 'beam';
    R.scouts.push({ x: t.x, y: t.y, t: 0, dur, tower: t, scout });
    floatText('Tower beamed up', t.x, t.y - 34, '#a8ffc8', 14);
    Sound.play('laser', t.x);
  }
  function updateDinos(dt) {
    const M = S.M;
    for (const d of R.dinos) {
      d.cd -= dt;
      if (d.tx == null || (d.wait -= dt) > 0 && Math.hypot(d.tx - d.x, d.ty - d.y) < 4) {
        if (d.wait <= 0) {
          const spots = freeNearRoad(M, 1).filter(([c, r]) => !S.towerAt.has(r * COLS + c) && Math.hypot(c * TILE + TILE / 2 - d.x, r * TILE + TILE / 2 - d.y) < TILE * 4);
          if (spots.length) { const [c, r] = spots[Math.floor(Math.random() * spots.length)]; d.tx = c * TILE + TILE / 2; d.ty = r * TILE + TILE / 2; }
          d.wait = rand(2, 5);
        }
      } else if (d.tx != null) {
        const dx = d.tx - d.x, dy = d.ty - d.y, l = Math.hypot(dx, dy);
        if (l > 2) { const sp = 18 * dt; d.x += dx / l * Math.min(sp, l); d.y += dy / l * Math.min(sp, l); d.ang = Math.atan2(dy, dx); d.step += dt; }
      }
      // anything undead that comes close gets stamped on
      if (d.cd <= 0) {
        const near = ground().filter((e) => dist2(e.x, e.y, d.x, d.y) < (TILE * 1.25) ** 2);
        if (near.length) {
          d.cd = 1.4;
          for (const e of near) { damage(e, ZOMBIES[e.type].boss ? e.maxHp * 0.01 : e.maxHp * 0.16, null, 1); if (!e.dead) stunZombie(e, 0.4); }
          S.fx.push({ kind: 'ring', x: d.x, y: d.y, r: TILE * 0.6, life: 0.4, max: 0.4, color: '200,180,120' });
          d.ang = Math.atan2(near[0].y - d.y, near[0].x - d.x);
          Sound.play('stomp', d.x); addShake(2);
        } else d.cd = 0.3;
      }
    }
  }
  // the stampede runs back along every road from the safehouse
  function updateHerd(h, dt) {
    h.d -= dt * 420;
    const sc = h.k;
    for (const e of S.enemies) {
      if (e.dead || e.fly || e.burrowed || h.hit.has(e) || e.route !== h.route) continue;
      if (Math.abs(e.d - h.d) > 26) continue;
      h.hit.add(e);
      const def = ZOMBIES[e.type];
      damage(e, def.boss ? e.maxHp * 0.05 * sc : e.maxHp * 0.4 * sc, null, 1);
      if (!e.dead) stunZombie(e, 1.2);
    }
    if (Math.random() < dt * 20) { const p = pointOn(h.route, clamp(h.d, 0, h.route.total)); S.fx.push({ kind: 'smoke', x: p.x + rand(-10, 10), y: p.y + rand(-10, 10), vx: rand(-10, 10), vy: rand(-10, 10), r: rand(5, 8), grow: 12, life: 0.7, max: 0.7, color: '150,120,80' }); }
  }

  // ---------- bosses ----------
  // each boss has its own attack, and enrages at half health
  function bossTick(e, dt, def) {
    if (!e.enraged && e.hp < e.maxHp * 0.5) enrage(e, def);
    e.atkCd = (e.atkCd ?? 4) - dt;
    if (e.type === 'cinderKing') {
      e.trailT = (e.trailT || 0) - dt;
      if (e.trailT <= 0) { e.trailT = 0.3; S.decals.push({ kind: 'scorch', x: e.x + rand(-6, 6), y: e.y + rand(-6, 6), r: e.r * 0.5, color: '#14120f', life: 6, max: 6, seed: Math.random() * 1000 }); }
    }
    if (e.atkCd > 0) return;
    if (e.type === 'kraken') {
      e.atkCd = e.enraged ? 3 : 6;
      const near = S.towers.filter((t) => dist2(t.x, t.y, e.x, e.y) < (TILE * 2.8) ** 2).sort((a, b) => dist2(a.x, a.y, e.x, e.y) - dist2(b.x, b.y, e.x, e.y)).slice(0, 2);
      for (const t of near) { t.stun = 2.5; t.stunKind = 'slam'; R.tentacles.push({ x: t.x, y: t.y, t: 0.3, target: null, power: 0, hit: true, side: 1 }); }
      if (near.length) { floatText('Towers slammed', e.x, e.y - e.r * 2, '#f0c8c8', 16); addShake(6); Sound.play('stomp', e.x); }
    } else if (e.type === 'boneWyrm') {
      e.atkCd = e.enraged ? 4.5 : 8;
      const ang = Math.atan2(e.diry, e.dirx);
      const hit = S.towers.filter((t) => { const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy); if (d > TILE * 3.4) return false; const da = Math.abs(((Math.atan2(dy, dx) - ang + Math.PI * 3) % TAU) - Math.PI); return da < 0.75; });
      for (const t of hit) { t.stun = 2.5; t.stunKind = 'scorch'; }
      const col = e.enraged ? '120,255,140' : '255,140,50';
      for (let i = 0; i < 26; i++) { const a = ang + rand(-0.6, 0.6), sp = rand(120, 220); S.fx.push({ kind: 'smoke', x: e.x + Math.cos(ang) * e.r, y: e.y + Math.sin(ang) * e.r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(4, 7), grow: 20, life: 0.6, max: 0.6, color: col }); }
      if (hit.length) floatText('Towers scorched', e.x, e.y - e.r * 2, e.enraged ? '#a8ffb0' : '#ffb070', 16);
      Sound.play('flame', e.x); Sound.play('roar', e.x);
    } else if (e.type === 'abductor') {
      e.atkCd = e.enraged ? 5 : 9;
      const near = S.towers.filter((t) => !(t.stun > 0) && dist2(t.x, t.y, e.x, e.y) < (TILE * 4) ** 2);
      if (near.length) { const best = near.reduce((a, b) => (b.spent > a.spent ? b : a)); beamTower(best, 5, false); R.beams.push({ x0: e.x, y0: e.y, x1: best.x, y1: best.y, t: 0 }); }
    } else e.atkCd = 99;
  }
  function enrage(e, def) {
    e.enraged = true;
    e.speed *= 1.25;
    if (e.type === 'cinderKing') e.armor = Math.floor(e.armor / 2);
    const call = { cinderKing: ['ashwalker', 4], kraken: ['sailor', 5], boneWyrm: ['cultist', 3], rexMortis: ['ankylo', 1], abductor: ['grey', 5] }[e.type];
    if (call) for (let i = 0; i < call[1]; i++) spawnEnemy(call[0], e.wave, e.route, Math.max(0, e.d - 14 - i * 16));
    showBanner(`${def.name} is enraged`, 'Second phase');
    addShake(10); Sound.play('roar', e.x); Sound.play('boss');
    for (let i = 0; i < 24; i++) { const a = rand(0, TAU); S.fx.push({ kind: 'spark', x: e.x, y: e.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, r: rand(1.5, 3), color: '255,90,60', life: 0.6, max: 0.6 }); }
    if (R) sayLineX(LIST[R.id].enrage, 0.4);
  }

  // ---------- wonder powers ----------
  const strength = (id) => (wonStars(id) >= 3 ? 1.5 : 1);
  const charges = (id) => st().charge[id] | 0;
  const owned = () => ORDER.filter((id) => wonStars(id) > 0);
  function cast(id) {
    if (S.state !== 'playing' || S.paused || charges(id) <= 0) { Sound.play('error'); return false; }
    const P = LIST[id].power;
    if (P.target) { S.power = S.power === 'w:' + id ? null : 'w:' + id; S.placing = null; S.selected = null; return true; }
    if (!fire(id, 0, 0)) { Sound.play('error'); return false; }
    spend(id);
    return true;
  }
  function castAt(id, x, y) {
    if (charges(id) <= 0) return;
    S.power = null;
    fire(id, x, y);
    spend(id);
  }
  function spend(id) { st().charge[id] = Math.max(0, charges(id) - 1); saveMeta(); }
  // a power works in any battle, campaign or expedition; R is set up on the fly if needed
  function need() { if (!R) R = { id: null, t: 0, lava: null, bubbles: [], tentacles: [], flights: [], dinos: [], scouts: [], zones: [], herds: [], beams: [], next: 1e9 }; }
  function fire(id, x, y) {
    need();
    const k = strength(id), sc = scaleNow();
    if (id === 'cinder') {
      R.zones.push({ x, y, r: TILE * 1.5 * Math.sqrt(k), t: 6, dps: 24 * sc * k });
      showBanner('Eruption', 'Lava rains down'); Sound.play('boom', x); addShake(6);
    } else if (id === 'dragon') {
      flyover(x, y, true);
      showBanner("Dragon's Breath", 'The Red Dragon answers');
    } else if (id === 'kraken') {
      const gs = ground().sort((a, b) => b.hp - a.hp).slice(0, Math.round(6 * k));
      if (!gs.length) return false;
      // they burst up one after another, a tenth of a second apart
      gs.forEach((e, i) => { tentacle(e.x, e.y, e, k); R.tentacles[R.tentacles.length - 1].t = -i * 0.1; });
      showBanner("Kraken's Grasp", 'Dragged under');
    } else if (id === 'dinos') {
      for (const route of S.M.paths) R.herds.push({ route, d: route.total + 40, hit: new Set(), k });
      showBanner('Stampede', 'The herd charges'); Sound.play('brute', W / 2); addShake(10);
    } else if (id === 'ufo') {
      const gs = ground().sort((a, b) => b.hp - a.hp);
      const small = gs.filter((e) => !ZOMBIES[e.type].boss).slice(0, Math.round(k * 1.4));
      const big = gs.find((e) => ZOMBIES[e.type].boss);
      if (!small.length && !big) return false;
      for (const e of small) { R.beams.push({ x0: e.x, y0: -40, x1: e.x, y1: e.y, t: 0, lift: true }); kill(e, null); }
      if (!small.length && big) { stunZombie(big, 3); big.stunCd = 0; damage(big, big.maxHp * 0.1 * k, null, 1); R.beams.push({ x0: big.x, y0: -40, x1: big.x, y1: big.y, t: 0, lift: true }); }
      showBanner('Tractor Beam', small.length ? 'Taken away' : 'Held still'); Sound.play('laser', W / 2);
    }
    return true;
  }
  // every few campaign wins, each won power gains a charge
  function campaignWin() {
    const s = st();
    if (!owned().length) return false;
    s.tick = (s.tick | 0) + 1;
    if (s.tick < RECHARGE) return false;
    s.tick = 0;
    let any = false;
    for (const id of owned()) if (charges(id) < MAX_CHARGE) { s.charge[id] = charges(id) + 1; any = true; }
    return any;
  }
  const winsToCharge = () => RECHARGE - (st().tick | 0);

  // ---------- finishing an expedition ----------
  function finish(won, stars) {
    const id = S.L.exp, s = st(), first = won && !wonStars(id);
    if (won) {
      s.won[id] = Math.max(wonStars(id), stars);
      s.charge[id] = Math.max(charges(id), 1);
    }
    return { first, coins: won ? Math.round((600 + stars * 150) * (first ? 1 : 0.35)) : Math.round(S.wave * 4) };
  }

  // ---------- drawing ----------
  function drawGround(c, t) {
    if (!R) return;
    if (R.lavaCv) c.drawImage(R.lavaCv, 0, 0, W, H);
    if (R.glowCv) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55 + Math.sin(t * 1.7) * 0.15; c.drawImage(R.glowCv, 0, 0, W, H); c.restore(); }
    for (const b of R.bubbles) {
      const k = b.t / 0.8;
      if (b.rain) { circle(c, b.x, b.y, 3 + k * 6); c.fillStyle = `rgba(255,${Math.round(180 - k * 100)},40,${0.8 * (1 - k)})`; c.fill(); continue; }
      circle(c, b.x, b.y, 1.5 + k * 3.5); c.strokeStyle = `rgba(255,220,120,${0.8 * (1 - k)})`; c.lineWidth = 1; c.stroke();
    }
    for (const z of R.zones) {
      c.save(); c.globalAlpha = Math.min(1, z.t) * 0.6;
      c.fillStyle = radial(c, z.x, z.y, z.r, 'rgba(255,170,50,0.55)', 'rgba(200,40,10,0.05)', 0, 0); circle(c, z.x, z.y, z.r); c.fill();
      c.restore();
    }
    for (const d of R.dinos) drawDino(c, d, t);
  }
  function drawAir(c, t, lights) {
    if (!R) return;
    for (const tn of R.tentacles) drawTentacle(c, tn);
    for (const h of R.herds) {
      for (let i = 0; i < 4; i++) {
        const dd = h.d + i * 22, p = pointOn(h.route, clamp(dd, 0, h.route.total));
        if (dd < -30 || dd > h.route.total + 30) continue;
        drawDino(c, { x: p.x + (i % 2 ? 9 : -9) * -p.dy, y: p.y + (i % 2 ? 9 : -9) * p.dx, ang: Math.atan2(-p.dy, -p.dx), step: t * 3 + i, kind: 'tri', seed: i }, t, 0.75);
      }
    }
    for (const s of R.scouts) drawScout(c, s, t, lights);
    for (const b of R.beams) {
      const k = b.t / 1.4;
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - k) * 0.8;
      const w = b.lift ? 16 : 10;
      const g = c.createLinearGradient(b.x0, b.y0, b.x1, b.y1); g.addColorStop(0, 'rgba(160,255,200,0.9)'); g.addColorStop(1, 'rgba(160,255,200,0.2)');
      c.strokeStyle = g; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(b.x0, b.y0); c.lineTo(b.x1, b.y1); c.stroke();
      c.restore();
    }
    for (const f of R.flights) if (f.x != null) drawDragon(c, f.x, f.y, f.a, t, lights);
  }
  function drawTentacle(c, tn) {
    const k = tn.t < 0.55 ? tn.t / 0.55 : tn.t > 1.1 ? Math.max(0, 1 - (tn.t - 1.1) / 0.5) : 1;
    if (k <= 0) return;
    c.save(); c.translate(tn.x, tn.y);
    // a ring of churned water, then the arm curling up out of it
    ellipse(c, 0, 4, 16 * k + 4, 8 * k + 3); c.fillStyle = 'rgba(220,240,250,0.35)'; c.fill();
    const segs = 9;
    for (let i = segs; i >= 0; i--) {
      const q = i / segs, a = -Math.PI / 2 + tn.side * Math.sin(q * 3 + tn.t * 6) * 0.6 * q, len = 44 * k;
      const x = Math.cos(a) * len * q * 0.5 + tn.side * Math.sin(q * 2.4) * 10 * k, y = -len * q + 4;
      const w = (9 - q * 6) * Math.max(0.3, k);
      ellipse(c, x, y, w, w); c.fillStyle = radial(c, x - w * 0.3, y - w * 0.3, w * 1.2, '#c8607a', '#4a1426', 0, 0); c.fill();
      if (i % 2 === 0 && i > 1) { ellipse(c, x + tn.side * w * 0.3, y, w * 0.32, w * 0.32); c.fillStyle = '#f0c8c8'; c.fill(); }
    }
    c.restore();
  }
  function drawDino(c, d, t, scale = 1) {
    const s = (d.kind === 'long' ? 1.25 : 1) * scale, step = Math.sin((d.step || 0) * 5);
    c.save(); c.translate(d.x, d.y); c.rotate(d.ang); c.scale(s, s);
    ellipse(c, 4, 6, 26, 14); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
    const sk = d.kind === 'long' ? '#7a8a6a' : '#8a7a5a';
    for (const [lx, side, ph] of [[9, -1, step], [9, 1, -step], [-9, -1, -step], [-9, 1, step]]) { ellipse(c, lx + ph * 3, side * 11, 5, 4); c.fillStyle = shade(sk, -0.3); c.fill(); }
    // tail
    c.beginPath(); c.moveTo(-14, -5); c.quadraticCurveTo(-30, Math.sin(t * 2 + d.seed) * 6, -38, Math.sin(t * 2 + d.seed + 1) * 9); c.quadraticCurveTo(-30, 4, -14, 5); c.fillStyle = shade(sk, -0.15); c.fill();
    ellipse(c, 0, 0, 18, 12); c.fillStyle = radial(c, -3, -4, 20, shade(sk, 0.25), shade(sk, -0.4), 0, 0); c.fill();
    c.strokeStyle = 'rgba(60,40,20,0.35)'; c.lineWidth = 1; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-10 + i * 4, -9); c.lineTo(-8 + i * 4, 9); c.stroke(); }
    if (d.kind === 'long') {
      // a long neck reaching out to browse
      c.beginPath(); c.moveTo(12, -4); c.quadraticCurveTo(28, Math.sin(t + d.seed) * 6, 40, Math.sin(t * 0.8 + d.seed) * 8); c.lineTo(40, Math.sin(t * 0.8 + d.seed) * 8 + 5); c.quadraticCurveTo(28, 6, 12, 4); c.fillStyle = shade(sk, 0.05); c.fill();
      ellipse(c, 42, Math.sin(t * 0.8 + d.seed) * 8 + 2.5, 5, 4); c.fillStyle = shade(sk, 0.1); c.fill();
    } else {
      // a triceratops: frill and three horns
      ellipse(c, 16, 0, 8, 13); c.fillStyle = radial(c, 14, -3, 12, '#c8784a', '#6a3a22', 0, 0); c.fill();
      for (let i = -3; i <= 3; i++) { circle(c, 12 + Math.cos(i * 0.4) * 2, Math.sin(i * 0.4) * 12, 1.4); c.fillStyle = '#e8d8b8'; c.fill(); }
      ellipse(c, 23, 0, 7, 5.5); c.fillStyle = shade(sk, 0.15); c.fill();
      c.fillStyle = '#efe6cc';
      for (const sy of [-1, 1]) { c.beginPath(); c.moveTo(22, sy * 3); c.lineTo(35, sy * 5); c.lineTo(23, sy * 1); c.fill(); }
      c.beginPath(); c.moveTo(28, -1); c.lineTo(34, 0); c.lineTo(28, 1); c.fill();
    }
    c.restore();
  }
  function drawScout(c, s, t, lights) {
    const k = s.t < 0.6 ? s.t / 0.6 : s.t > s.dur + 0.6 ? Math.max(0, 1 - (s.t - s.dur - 0.6) / 0.6) : 1;
    const y = s.y - 70 + (1 - k) * -120, x = s.x + (1 - k) * 160;
    if (s.t < s.dur) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 * k;
      c.beginPath(); c.moveTo(x - 8, y + 6); c.lineTo(x + 8, y + 6); c.lineTo(s.x + 24, s.y + 10); c.lineTo(s.x - 24, s.y + 10); c.closePath();
      c.fillStyle = linear(c, 0, y, 0, s.y, [[0, 'rgba(170,255,210,0.9)'], [1, 'rgba(170,255,210,0.15)']]); c.fill();
      c.restore();
      if (lights) lights.push({ x: s.x, y: s.y, r: 40, color: '160,255,200', a: 0.5 * k });
    }
    c.save(); c.translate(x, y); c.globalAlpha = k;
    ellipse(c, 0, 0, 22, 9); c.fillStyle = radial(c, -5, -4, 24, '#e8ecf0', '#4a505a', 0, 0); c.fill();
    ellipse(c, 0, -3, 9, 6); c.fillStyle = 'rgba(170,255,220,0.75)'; c.fill();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * 3; circle(c, Math.cos(a) * 17, Math.sin(a) * 6.5, 1.6); c.fillStyle = (i + Math.floor(t * 6)) % 2 ? '#ffe060' : '#6af0a0'; c.fill(); }
    c.restore();
  }
  // the Red Dragon seen from above: wide wings beating, a long neck, flame ahead of it
  function drawDragon(c, x, y, a, t, lights) {
    const flap = Math.sin(t * 10) * 0.25;
    c.save(); c.translate(x + 30, y + 46); c.rotate(a); c.globalAlpha = 0.2; ellipse(c, 0, 0, 50, 30); c.fillStyle = '#000'; c.fill(); c.restore();
    c.save(); c.translate(x, y); c.rotate(a);
    for (const s of [-1, 1]) {
      c.save(); c.scale(1, 1 - flap * s * 0.3 - Math.abs(flap) * 0.4);
      c.beginPath(); c.moveTo(6, s * 6); c.lineTo(10, s * 40); c.lineTo(-4, s * 64); c.quadraticCurveTo(-14, s * 44, -20, s * 50); c.quadraticCurveTo(-18, s * 30, -28, s * 30); c.quadraticCurveTo(-16, s * 18, -14, s * 6); c.closePath();
      c.fillStyle = linear(c, 0, 0, 0, s * 60, [[0, '#a82a1a'], [1, '#5a120a']]); c.fill();
      c.strokeStyle = '#e8b040'; c.lineWidth = 2; c.beginPath(); c.moveTo(6, s * 6); c.lineTo(10, s * 40); c.lineTo(-4, s * 64); c.stroke();
      c.lineWidth = 1; c.strokeStyle = 'rgba(40,6,2,0.6)'; for (const [tx, ty] of [[-20, 50], [-28, 30]]) { c.beginPath(); c.moveTo(10, s * 40); c.lineTo(tx, s * ty); c.stroke(); }
      c.restore();
    }
    c.beginPath(); c.moveTo(-14, -6); c.quadraticCurveTo(-40, Math.sin(t * 4) * 8, -60, Math.sin(t * 4 + 1) * 12); c.quadraticCurveTo(-40, 6, -14, 6); c.fillStyle = '#8a2014'; c.fill();
    ellipse(c, 0, 0, 20, 10); c.fillStyle = radial(c, -4, -4, 22, '#e04a2a', '#6a140a', 0, 0); c.fill();
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-14 + i * 6, 0); c.lineTo(-11 + i * 6, -4); c.lineTo(-8 + i * 6, 0); c.fillStyle = '#e8b040'; c.fill(); }
    c.beginPath(); c.moveTo(14, -4); c.quadraticCurveTo(24, 0, 28, 0); c.quadraticCurveTo(24, 0, 14, 4); c.fillStyle = '#b8301a'; c.fill();
    ellipse(c, 31, 0, 7, 5); c.fillStyle = '#c83a1e'; c.fill();
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(28, s * 3); c.lineTo(22, s * 8); c.lineTo(30, s * 4); c.fillStyle = '#efe0c0'; c.fill(); circle(c, 33, s * 2.2, 1); c.fillStyle = '#ffe060'; c.fill(); }
    // the fire pours out ahead and below
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = radial(c, 52, 0, 26, 'rgba(255,220,120,0.9)', 'rgba(255,90,20,0)', 0, 0); ellipse(c, 52, 0, 26, 12); c.fill();
    c.restore();
    if (lights) lights.push({ x: x + Math.cos(a) * 50, y: y + Math.sin(a) * 50, r: 90, color: '255,140,50', a: 0.7 });
  }
  // a tower knocked out by an expedition attack; false when the game should draw it itself
  function drawTowerStun(c, tw, x, y) {
    if (!(tw.stun > 0) || !tw.stunKind) return false;
    const k = tw.stunKind, t = performance.now() / 1000;
    c.save(); c.translate(x, y);
    if (k === 'lava') {
      ellipse(c, 0, 0, 21, 17); c.fillStyle = radial(c, -5, -5, 24, '#5a4a44', '#1a1210', 0, 0); c.fill();
      c.strokeStyle = `rgba(255,140,40,${0.6 + Math.sin(t * 5) * 0.2})`; c.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) { const a = i * 1.3; c.beginPath(); c.moveTo(Math.cos(a) * 4, Math.sin(a) * 4); c.lineTo(Math.cos(a + 0.3) * 15, Math.sin(a + 0.3) * 12); c.stroke(); }
    } else if (k === 'beam') {
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = radial(c, 0, 0, 30, 'rgba(170,255,210,0.55)', 'rgba(170,255,210,0)', 0, 0); circle(c, 0, 0, 30); c.fill();
      c.strokeStyle = 'rgba(200,255,220,0.8)'; c.lineWidth = 1.2; for (let i = 0; i < 3; i++) { const r = ((t * 30 + i * 9) % 26); circle(c, 0, 0, r); c.stroke(); }
    } else if (k === 'scorch') {
      c.fillStyle = 'rgba(20,14,10,0.55)'; rr(c, -20, -20, 40, 40, 6); c.fill();
      for (let i = 0; i < 3; i++) S.fx.length < 400 && Math.random() < 0.08 && S.fx.push({ kind: 'fire', x: x + rand(-12, 12), y: y + rand(-12, 12), vx: 0, vy: -20, r: rand(3, 5), life: 0.4, max: 0.4 });
    } else if (k === 'slam') {
      c.strokeStyle = 'rgba(240,200,210,0.85)'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = t * 6 + i * TAU / 3; circle(c, Math.cos(a) * 14, -22 + Math.sin(a) * 4, 2); c.stroke(); }
      c.fillStyle = 'rgba(200,230,240,0.35)'; rr(c, -20, -20, 40, 40, 6); c.fill();
    } else if (k === 'roar' || k === 'tail') {
      c.strokeStyle = 'rgba(255,240,170,0.9)'; c.lineWidth = 1.4; for (let i = 0; i < 3; i++) { const a = t * 6 + i * TAU / 3; circle(c, Math.cos(a) * 14, -22 + Math.sin(a) * 4, 2); c.stroke(); }
    } else { c.restore(); return false; }
    c.restore();
    return true;
  }

  // ---------- ground paint and props ----------
  function paintGround(c, M) {
    const id = M.L.exp, rng = mulberry32(M.L.look.seed + 5);
    if (id === 'ufo') {
      // crop circles pressed into the open ground
      for (let n = 0; n < 3; n++) {
        let x = 0, y = 0, ok = false;
        for (let k = 0; k < 40 && !ok; k++) { x = rand(TILE * 2, W - TILE * 2); y = rand(TILE * 2, H - TILE * 2); const g = M.grid[Math.floor(y / TILE) * COLS + Math.floor(x / TILE)]; ok = g === 0; x += (rng() - 0.5); }
        if (!ok) continue;
        const R0 = 26 + rng() * 22;
        c.save(); c.translate(x, y); c.rotate(rng() * TAU);
        c.strokeStyle = 'rgba(230,220,150,0.55)'; c.lineWidth = 3;
        for (const [rx, a] of [[R0, 1], [R0 * 0.62, 0.8], [R0 * 0.25, 0.9]]) { circle(c, 0, 0, rx); c.globalAlpha = a; c.stroke(); }
        c.globalAlpha = 0.6; c.lineWidth = 2;
        for (let i = 0; i < 3; i++) { const a = i * TAU / 3; circle(c, Math.cos(a) * R0 * 1.25, Math.sin(a) * R0 * 1.25, R0 * 0.2); c.stroke(); c.beginPath(); c.moveTo(Math.cos(a) * R0, Math.sin(a) * R0); c.lineTo(Math.cos(a) * R0 * 1.05, Math.sin(a) * R0 * 1.05); c.stroke(); }
        c.restore();
      }
    }
    if (id === 'cinder') {
      // cooled flows of black rock and patches of ash
      for (let i = 0; i < 9; i++) { const x = rng() * W, y = rng() * H; ellipse(c, x, y, 20 + rng() * 30, 8 + rng() * 14, rng() * 3); c.fillStyle = 'rgba(10,8,6,0.3)'; c.fill(); }
    }
  }
  function decor(c, d, rng, M) {
    switch (d.kind) {
      case 'basalt': {
        for (let i = 0; i < 3; i++) {
          const x = (rng() - 0.5) * 16, y = (rng() - 0.5) * 12, r = 6 + rng() * 6;
          c.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + rng() * 0.3; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.8; k ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath();
          c.save(); c.translate(2, 3); c.fillStyle = 'rgba(0,0,0,0.45)'; c.fill(); c.restore();
          c.fillStyle = radial(c, x - r * 0.3, y - r * 0.3, r * 1.3, '#5a504a', '#16100e', 0, 0); c.fill();
          c.strokeStyle = 'rgba(255,120,40,0.75)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - r * 0.5, y); c.lineTo(x, y + r * 0.2); c.lineTo(x + r * 0.4, y - r * 0.3); c.stroke();
        }
        break;
      }
      case 'vent': {
        ellipse(c, 0, 0, 14, 11); c.fillStyle = radial(c, -3, -3, 16, '#6a5a3a', '#2a2018', 0, 0); c.fill();
        ellipse(c, 0, 0, 9, 7); c.fillStyle = '#d8c040'; c.fill();
        ellipse(c, 0, 0, 5, 4); c.fillStyle = radial(c, 0, 0, 5, '#ffb040', '#3a1a08', 0, 0); c.fill();
        if (M) M.smoke.push({ x: d.x, y: d.y });
        break;
      }
      case 'anchor': {
        c.rotate(d.rot);
        c.strokeStyle = '#4a3a30'; c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, -12); c.lineTo(0, 10); c.stroke();
        c.beginPath(); c.arc(0, 2, 10, 0.3, Math.PI - 0.3); c.stroke();
        c.beginPath(); c.moveTo(-6, -8); c.lineTo(6, -8); c.stroke();
        c.strokeStyle = '#6a5a4a'; c.lineWidth = 1.2; c.setLineDash([2, 2]); c.beginPath(); c.moveTo(0, -12); c.quadraticCurveTo(12, -20, 18, -10); c.stroke(); c.setLineDash([]);
        break;
      }
      case 'rowboat': {
        c.rotate(d.rot);
        ellipse(c, 2, 3, 15, 7); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
        c.beginPath(); c.moveTo(-15, 0); c.quadraticCurveTo(-10, -8, 8, -6); c.lineTo(15, 0); c.lineTo(8, 6); c.quadraticCurveTo(-10, 8, -15, 0); c.fillStyle = '#7a5a3a'; c.fill();
        c.strokeStyle = '#3a2a1a'; c.lineWidth = 1; c.stroke();
        c.fillStyle = '#5a4028'; c.fillRect(-4, -6, 2, 12); c.fillRect(4, -5, 2, 10);
        break;
      }
      case 'nets': {
        c.rotate(d.rot);
        c.strokeStyle = 'rgba(200,190,160,0.7)'; c.lineWidth = 0.6;
        for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(-14, i * 3); c.quadraticCurveTo(0, i * 3 + 3, 14, i * 3); c.stroke(); c.beginPath(); c.moveTo(i * 4, -10); c.lineTo(i * 4 + 2, 10); c.stroke(); }
        for (let i = 0; i < 4; i++) { circle(c, (rng() - 0.5) * 24, (rng() - 0.5) * 18, 1.6); c.fillStyle = '#d87a3a'; c.fill(); }
        break;
      }
      case 'bones': {
        c.rotate(d.rot);
        // the ribcage of something enormous
        c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 4; c.lineCap = 'round';
        const rib = (off) => { for (let i = 0; i < 5; i++) { const x = -12 + i * 6; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + off, off); c.quadraticCurveTo(x + 6 + off, s * 12 + off, x + off, s * 16 + off); c.stroke(); } } c.beginPath(); c.moveTo(-16 + off, off); c.lineTo(16 + off, off); c.stroke(); };
        rib(2); c.strokeStyle = '#e8e0cc'; c.lineWidth = 2.6; rib(0);
        break;
      }
      case 'hoard': {
        for (let i = 0; i < 30; i++) { const a = rng() * TAU, r = Math.sqrt(rng()) * 14; circle(c, Math.cos(a) * r, Math.sin(a) * r * 0.8, 2.4); c.fillStyle = radial(c, Math.cos(a) * r - 0.8, Math.sin(a) * r * 0.8 - 0.8, 3, '#fff0a0', '#a8781a', 0, 0); c.fill(); }
        for (let i = 0; i < 2; i++) { const x = (rng() - 0.5) * 16, y = (rng() - 0.5) * 10; ellipse(c, x, y, 4, 3.5); c.fillStyle = '#e8e0cc'; c.fill(); circle(c, x + 1, y - 1, 0.9); circle(c, x + 1, y + 1, 0.9); c.fillStyle = '#1a1410'; c.fill(); }
        break;
      }
      case 'fern': {
        for (let i = 0; i < 9; i++) {
          const a = i / 9 * TAU + rng() * 0.3, l = 12 + rng() * 6;
          c.save(); c.rotate(a);
          c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(l * 0.5, -4, l, 0); c.quadraticCurveTo(l * 0.5, 4, 0, 0);
          c.fillStyle = i % 2 ? '#3a6a24' : '#4e8430'; c.fill();
          c.strokeStyle = 'rgba(20,40,10,0.6)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(l, 0); c.stroke();
          c.restore();
        }
        break;
      }
      case 'nest': {
        ellipse(c, 0, 0, 14, 11); c.fillStyle = radial(c, -3, -3, 16, '#8a6a3a', '#3a2a14', 0, 0); c.fill();
        ellipse(c, 0, 0, 9, 7); c.fillStyle = '#2a1e10'; c.fill();
        for (let i = 0; i < 3; i++) { const a = i * 2.1; ellipse(c, Math.cos(a) * 4, Math.sin(a) * 3, 3.4, 4.2, a); c.fillStyle = radial(c, Math.cos(a) * 4 - 1, Math.sin(a) * 3 - 1, 5, '#f8f0dc', '#b8a888', 0, 0); c.fill(); }
        break;
      }
      case 'cow': {
        c.rotate(d.rot);
        ellipse(c, 2, 3, 13, 8); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
        ellipse(c, 0, 0, 12, 7); c.fillStyle = '#f2ede2'; c.fill();
        for (let i = 0; i < 3; i++) { ellipse(c, (rng() - 0.5) * 14, (rng() - 0.5) * 8, 3 + rng() * 2, 2 + rng() * 2, rng() * 3); c.fillStyle = '#1e1c1a'; c.fill(); }
        ellipse(c, 13, 0, 4.5, 3.6); c.fillStyle = '#e8e2d6'; c.fill();
        ellipse(c, 16.5, 0, 2, 2.6); c.fillStyle = '#d8a8a0'; c.fill();
        break;
      }
    }
  }

  return {
    LIST, ORDER, ICONS, has, isOpen, unlock, wonStars, keysLeft, keysEarned, starsToKey, campaignStars, STARS_PER_KEY, LIVES,
    level, begin, end, onWave, update, bossTick, drawGround, drawAir, drawTowerStun, paintGround, decor,
    owned, charges, cast, castAt, strength, campaignWin, winsToCharge, finish,
    chatter: (L) => LIST[L.exp] && LIST[L.exp].chatter,
    forecast: (id) => LIST[id] && LIST[id].forecast,
  };
})();
