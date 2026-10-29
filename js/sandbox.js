'use strict';
// ============================================================
// Sandbox: pick any map, set your own rules (cash, lives, waves, toughness, sky) and choose
// exactly which zombies come. Everything is unlocked and nothing counts towards the campaign:
// no coins, XP or stars, and no saved progress. Settings are remembered between visits.
// ============================================================
const SANDBOX = (() => {
  const KEY = 'zbash.sandbox';
  const ZTYPES = Object.keys(ZOMBIES);
  const TIMES = [['map', "Map's own"], ['day', 'Day'], ['dawn', 'Dawn'], ['dusk', 'Dusk'], ['night', 'Night']];
  const HP = [0.5, 1, 2, 3, 5], GROW = [0, 0.1, 0.25, 0.5];
  const defaults = () => ({
    world: 0, num: 1, mode: 'custom', mix: { walker: 10, runner: 4, cone: 2 }, waves: 10, endless: false,
    infCash: true, cash: 2000, infLives: true, lives: 20, hp: 1, growth: 0.1, weather: 'forecast', time: 'map', cold: true,
  });
  let cfg = load(), thumbT = 0;
  function load() {
    try { return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return defaults(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* private mode: settings just are not kept */ } }
  const index = () => cfg.world * LEVELS_PER_WORLD + cfg.num - 1;

  // the level as the sandbox rules reshape it; the campaign's own copy is left alone
  function level(i, sb) {
    const L = getLevel(i);
    return {
      ...L, sandbox: true, waves: sb.endless ? 9999 : sb.waves,
      look: { ...L.look, time: sb.time === 'map' ? L.look.time : sb.time },
    };
  }
  // one custom wave: every chosen zombie, more of them each wave if the waves grow
  function wave(L, n, sb) {
    const groups = [];
    for (const type of ZTYPES) {
      const base = sb.mix[type] | 0;
      if (!base) continue;
      const count = Math.max(1, Math.round(base * (1 + sb.growth * (n - 1))));
      const boss = ZOMBIES[type].boss;
      groups.push({ type, count, gap: (GAP[type] || (boss ? 3 : 1)) * (boss ? 1 : 0.9), delay: groups.length ? (boss ? 2 : 1) : 0 });
    }
    return groups;
  }
  function summary(L, n, sb) {
    const out = {};
    for (const g of sb.mode === 'custom' ? wave(L, n, sb) : makeWave(L, n)) out[g.type] = (out[g.type] || 0) + g.count;
    return out;
  }

  // ---------- the setup screen ----------
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  function chips(options, value, onPick, cls = 'sb-chips') {
    const row = el('div', cls);
    for (const [v, label] of options) {
      const b = el('button', 'sb-chip', label); b.type = 'button';
      b.setAttribute('aria-pressed', String(v === value));
      b.addEventListener('click', () => { Sound.play('click'); onPick(v); });
      row.append(b);
    }
    return row;
  }
  function toggle(label, on, onFlip) {
    const b = el('button', 'sb-toggle', `<span class="sb-knob"></span><span>${label}</span>`); b.type = 'button';
    b.setAttribute('aria-pressed', String(on));
    b.addEventListener('click', () => { Sound.play('click'); onFlip(!on); });
    return b;
  }
  function stepper(value, fmt, onStep, steps) {
    const box = el('div', 'sb-stepper');
    const dn = el('button', 'btn btn-small', '−'), up = el('button', 'btn btn-small', '+'); dn.type = up.type = 'button';
    dn.setAttribute('aria-label', 'Less'); up.setAttribute('aria-label', 'More');
    const v = el('b', null, fmt(value));
    dn.addEventListener('click', () => { Sound.play('click'); onStep(-1); });
    up.addEventListener('click', () => { Sound.play('click'); onStep(1); });
    box.append(dn, v, up);
    return box;
  }
  function row(label, ...kids) { const r = el('div', 'sb-row'); r.append(el('span', 'sb-label', label), ...kids); return r; }
  function set(patch, full = true) { Object.assign(cfg, patch); save(); if (full) render(); }

  // zombies from an expansion the player has not bought stay out of the picker
  const zLocked = (t) => WORLDS.some((w) => w.expansion && !PREMIUM.has(w.id) && (w.boss === t || w.mobs.some(([m]) => m === t)));
  // worlds the player can build a sandbox in: the expansion only once it is bought
  const worldsOpen = () => WORLDS.map((w, i) => i).filter((i) => !WORLDS[i].expansion || PREMIUM.has(WORLDS[i].id));
  function render() {
    const root = document.querySelector('#sandbox-body');
    root.innerHTML = '';
    if (!worldsOpen().includes(cfg.world)) cfg.world = 0;
    const world = WORLDS[cfg.world], L = getLevel(index());

    // the map: world, number, a live preview and the sky
    const map = el('section', 'sb-card');
    map.append(el('h3', 'sb-h', 'Map'));
    map.append(chips(worldsOpen().map((i) => [i, WORLDS[i].short]), cfg.world, (v) => set({ world: v, weather: 'forecast', num: Math.min(cfg.num, LEVELS_PER_WORLD) })));
    const pick = el('div', 'sb-map-pick');
    const prev = el('button', 'btn btn-small', '‹'), next = el('button', 'btn btn-small', '›'), rnd = el('button', 'btn btn-small', 'Random');
    prev.type = next.type = rnd.type = 'button'; prev.setAttribute('aria-label', 'Previous map'); next.setAttribute('aria-label', 'Next map');
    prev.addEventListener('click', () => { Sound.play('click'); set({ num: cfg.num > 1 ? cfg.num - 1 : LEVELS_PER_WORLD }); });
    next.addEventListener('click', () => { Sound.play('click'); set({ num: cfg.num < LEVELS_PER_WORLD ? cfg.num + 1 : 1 }); });
    rnd.addEventListener('click', () => { Sound.play('click'); set({ world: worldsOpen()[Math.floor(Math.random() * worldsOpen().length)], num: 1 + Math.floor(Math.random() * LEVELS_PER_WORLD), weather: 'forecast' }); });
    pick.append(prev, el('span', 'sb-map-name', `<b>${L.id}</b> ${L.name}`), next, rnd);
    map.append(pick);
    const frame = el('div', 'ld-map sb-thumb'); const cv = document.createElement('canvas'); cv.width = 480; cv.height = 288; frame.append(cv); map.append(frame);
    map.append(el('p', 'hint', `${world.name}. ${L.paths.length > 1 ? 'Two entrances.' : 'One entrance.'}${L.water.some((v) => v) ? ' Water on the map.' : ''}`));
    map.append(el('h3', 'sb-h', 'Sky'));
    map.append(row('Time', chips(TIMES, cfg.time, (v) => set({ time: v }))));
    const kinds = WEATHER.kindsFor(world.id);
    map.append(row('Weather', chips([['forecast', 'Changing'], ...kinds.map((k) => [k, WEATHER.KINDS[k].label])], cfg.weather, (v) => set({ weather: v }))));
    clearTimeout(thumbT);
    thumbT = setTimeout(() => {
      try {
        const M = buildLevel(L), c = cv.getContext('2d');
        renderBackground(c, M, 480 / W);
        c.setTransform(480 / W, 0, 0, 480 / W, 0, 0);
        drawSafehouse(c, M.end.x, M.end.y, 0, 0, false, houseGap(M));
      } catch (e) { console.error(e); }
    }, 60);

    // the rules
    const rules = el('section', 'sb-card');
    rules.append(el('h3', 'sb-h', 'Rules'));
    rules.append(row('Cash', toggle('Infinite', cfg.infCash, (v) => set({ infCash: v })),
      ...(cfg.infCash ? [] : [stepper(cfg.cash, (v) => '$' + v.toLocaleString(), (d) => set({ cash: clamp(cfg.cash + d * (cfg.cash >= 5000 ? 1000 : 250), 250, 100000) }))])));
    rules.append(row('Lives', toggle('Infinite', cfg.infLives, (v) => set({ infLives: v })),
      ...(cfg.infLives ? [] : [stepper(cfg.lives, String, (d) => set({ lives: clamp(cfg.lives + d * (cfg.lives >= 50 ? 10 : 5), 1, 500) }))])));
    rules.append(row('Waves', toggle('Endless', cfg.endless, (v) => set({ endless: v })),
      ...(cfg.endless ? [] : [stepper(cfg.waves, String, (d) => set({ waves: clamp(cfg.waves + d * (cfg.waves >= 20 ? 5 : 1), 1, 100) }))])));
    rules.append(row('Zombie health', chips(HP.map((v) => [v, `×${v}`]), cfg.hp, (v) => set({ hp: v }))));
    rules.append(row('More each wave', chips(GROW.map((v) => [v, v ? `+${Math.round(v * 100)}%` : 'Same']), cfg.growth, (v) => set({ growth: v }))));
    if (world.id === 'tundra') rules.append(row('Cold', toggle('Crews need heaters', cfg.cold, (v) => set({ cold: v }))));
    rules.append(el('p', 'hint', 'Every tower and every upgrade tier is open, and supplies never run out. Sandbox games earn no coins, XP or stars.'));

    // the zombies
    const zs = el('section', 'sb-card sb-zombies');
    zs.append(el('h3', 'sb-h', 'Zombies'));
    zs.append(chips([['map', "This map's waves"], ['custom', 'Pick my own']], cfg.mode, (v) => set({ mode: v })));
    if (cfg.mode === 'map') {
      const ch = el('div', 'wave-chips');
      for (const [type, n] of Object.entries(summary(level(index(), cfg), 1, cfg))) ch.append(zombieChip(type, `×${n}`));
      zs.append(el('p', 'hint', 'The waves this map sends in the campaign, with your health and wave rules on top. Wave 1:'), ch);
    } else {
      const presets = el('div', 'sb-chips');
      for (const [label, mix] of [
        ['Clear', {}], ['Horde', { walker: 30, runner: 12, imp: 10 }], ['Armored', { cone: 8, bucket: 6, brute: 2 }],
        ['Flyers', { carrion: 8, bats: 10 }], ['Bosses', { juggernaut: 1, harvester: 1, abomination: 1 }],
        ['Random', null],
      ]) {
        const b = el('button', 'sb-chip', label); b.type = 'button';
        b.addEventListener('click', () => {
          Sound.play('click');
          let m = mix;
          if (!m) { m = {}; const pool = ZTYPES.filter((t) => !ZOMBIES[t].boss && !zLocked(t)); for (let i = 0; i < 4; i++) { const t = pool[Math.floor(Math.random() * pool.length)]; m[t] = 2 + Math.floor(Math.random() * 10); } if (Math.random() < 0.4) { const bs = ZTYPES.filter((t) => ZOMBIES[t].boss && !zLocked(t)); m[bs[Math.floor(Math.random() * bs.length)]] = 1; } }
          set({ mix: { ...m } });
        });
        presets.append(b);
      }
      zs.append(presets);
      const grid = el('div', 'sb-zgrid');
      for (const type of ZTYPES) {
        if (zLocked(type)) continue;
        const z = ZOMBIES[type], n = cfg.mix[type] | 0;
        const card = el('div', 'sb-z' + (n ? ' on' : '') + (z.boss ? ' boss' : '') + (z.fly ? ' air' : ''));
        card.title = `${z.name}: ${z.desc}`;
        card.append(zombieIcon(type));
        card.append(el('span', 'sb-zname', `${z.name}${z.boss ? ' <i>Boss</i>' : z.fly ? ' <i>Flies</i>' : ''}`));
        const max = z.boss ? 10 : 60;
        card.append(stepper(n, (v) => (v ? `×${v}` : '—'), (d) => { const mix = { ...cfg.mix, [type]: clamp(n + d * (n >= 10 && !z.boss ? 5 : 1), 0, max) }; if (!mix[type]) delete mix[type]; set({ mix }); }));
        grid.append(card);
      }
      zs.append(grid);
      const total = Object.values(cfg.mix).reduce((a, b) => a + b, 0);
      zs.append(el('p', 'hint', total ? `${total} zombies in wave 1${cfg.growth ? `, ${Math.round(cfg.growth * 100)}% more every wave after` : ''}.` : 'Pick at least one zombie, or spawn them by hand during the game.'));
    }
    root.append(map, rules, zs);
  }
  function show() {
    hideScreens();
    $('#sandbox-screen').hidden = false;
    render();
    document.querySelector('#sandbox-screen').scrollTop = 0;
  }
  function play() {
    Sound.init(); Sound.play('click');
    startGame(index(), null, { ...cfg, mix: { ...cfg.mix } });
  }
  return { show, play, level, wave, summary, ZTYPES };
})();
