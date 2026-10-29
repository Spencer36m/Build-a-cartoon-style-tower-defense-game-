'use strict';
// ============================================================
// Coach: the training mission the first time level 1-1 is played, and a briefing card for each
// tower the first time it is in the player's arsenal.
//
// The training mission walks through building, the first wave, cash, upgrades, lives, supplies
// and the speed controls. Each step lights up the one thing to use (the rest of the screen is
// dimmed and does not respond) and moves on when the player has done it. It cannot be skipped;
// it is offered again on 1-1 until it has been finished once.
// ============================================================
const COACH = (() => {
  // what each tower is for, written for someone who has never played
  const INTROS = {
    gunner: { what: 'A soldier with a machine gun. Cheap, fast firing, and it shoots flyers too.', good: 'Crowds of weak zombies and the early waves.', bad: 'Armored zombies shrug off its small bullets.', tip: 'Build it where the road bends so it covers two stretches at once.' },
    sniper: { what: 'Huge range and heavy shots that punch through armor.', good: 'Tough, armored zombies and bosses. It reaches almost anywhere.', bad: 'It fires slowly, so big crowds slip past it.', tip: 'It does not need to sit by the road. Put it somewhere central and safe.' },
    mortar: { what: 'Lobs shells that blow up whole groups at once.', good: 'Packed crowds of slow zombies.', bad: 'It cannot hit flyers until it is upgraded, and shells take a moment to land.', tip: 'Aim it at a long straight stretch where zombies bunch up.' },
    cryo: { what: 'Fires freezing canisters that slow every zombie in the blast.', good: 'Fast Runners, and buying your other towers more time to shoot.', bad: 'It barely hurts on its own. Wraiths and Frostbites ignore the slow.', tip: 'Put it at the start of your killing zone, next to your damage towers.' },
    farm: { what: 'Survivors grow food and sell it. The farm drops crates of cash every wave.', good: 'Earning money early so you can afford more later.', bad: 'It does not fight, until its Homestead upgrades arm the farmers.', tip: 'Build it early, away from the road, and it pays for itself many times over.' },
    gunboat: { what: 'A patrol boat with a deck gun. It can only be built on water.', good: 'Maps with rivers and lakes. It hits flyers and groups.', bad: 'Of no use on a map without water.', tip: 'Look for water close to the road, especially by the bridges.' },
    flame: { what: 'Sprays fire at short range. Burning zombies keep taking damage, and fire ignores armor.', good: 'Thick crowds and armored zombies.', bad: 'Very short range, so it must sit right by the road. It cannot hit flyers.', tip: 'Put it on a corner, where zombies walk past it twice.' },
    tesla: { what: 'Lightning that jumps from zombie to zombie, ignoring armor. It hits flyers too.', good: 'Groups of zombies walking close together.', bad: 'Short range, and it costs a lot.', tip: 'Pair it with a Cryo Cannon: slowed zombies bunch up and the lightning chains further.' },
    heli: { what: 'A helicopter that flies to the zombie furthest along the road, anywhere on the map, and shoots it.', good: 'Catching zombies that slip past, and hunting flyers.', bad: 'Light damage per bullet, and it is expensive.', tip: 'Its helipad can go anywhere. It flies to the fight by itself.' },
    sub: { what: 'Fires homing missiles from the water. Its sonar reveals Tunnelers so every tower can hit them.', good: 'Tunnelers, armored zombies and flyers.', bad: 'It can only be built on water.', tip: 'One Submarine near the road makes Tunnelers visible to all your towers.' },
    jet: { what: 'A fighter that circles its airstrip at speed, firing homing missiles at everything below.', good: 'Heavy damage over a wide area, flyers included.', bad: 'The most expensive tower in the arsenal.', tip: 'Build the airstrip near the middle of the road so its circle covers the most ground.' },
    heater: { what: 'A fire barrel that keeps nearby crews warm. On snow maps, soldiers away from heat freeze solid and stop working.', good: 'Keeping Gunners, Snipers, Mortars, Flamethrowers, Gunboats and Farms working in the cold.', bad: 'It does no damage itself, until its Burner upgrades.', tip: 'Build the Heater first, then put crewed towers inside its warm circle. Machines like the Cryo Cannon and Tesla Coil do not need heat.' },
  };

  let ui = null, steps = null, step = -1, first = null, cards = [], cardOpen = false, glow = null;
  const touch = () => matchMedia('(pointer: coarse)').matches;

  // ---------- the overlay: a spotlight with blockers round it, an instructor card and an arrow ----------
  function build() {
    if (ui) return ui;
    const layer = document.createElement('div'); layer.className = 'coach'; layer.hidden = true;
    layer.innerHTML = `<div class="coach-spot"></div>${'<div class="coach-block"></div>'.repeat(4)}<div class="coach-arrow"></div>
      <div class="coach-card" role="dialog" aria-live="polite"><canvas class="coach-face" width="160" height="160" aria-hidden="true"></canvas>
      <div class="coach-body"><span class="coach-head"><b class="coach-name"></b><span class="coach-tag">Training</span><span class="coach-count"></span></span>
      <p class="coach-text"></p><button type="button" class="btn btn-primary btn-small coach-next">Next</button></div></div>
      <div class="coach-brief" hidden></div>`;
    document.body.append(layer);
    ui = { layer, spot: layer.querySelector('.coach-spot'), blocks: [...layer.querySelectorAll('.coach-block')], arrow: layer.querySelector('.coach-arrow'), card: layer.querySelector('.coach-card'),
      face: layer.querySelector('.coach-face'), name: layer.querySelector('.coach-name'), count: layer.querySelector('.coach-count'), text: layer.querySelector('.coach-text'), next: layer.querySelector('.coach-next'), brief: layer.querySelector('.coach-brief') };
    ui.next.addEventListener('click', () => { Sound.play('click'); if (steps && steps[step] && steps[step].next) go(step + 1); });
    for (const b of ui.blocks) b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (!cardOpen && steps) { ui.card.classList.remove('nudge'); void ui.card.offsetWidth; ui.card.classList.add('nudge'); } });
    return ui;
  }
  // a game-space rectangle on the battlefield as screen pixels
  function onMap(x, y, w, h) {
    const r = canvas.getBoundingClientRect(), k = r.width / W;
    return { x: r.left + x * k, y: r.top + y * k, w: w * k, h: h * k };
  }
  const elRect = (q) => { const e = typeof q === 'string' ? document.querySelector(q) : q; if (!e || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  function place(rect, block, dim) {
    const { spot, blocks, arrow } = ui, vw = innerWidth, vh = innerHeight, pad = 6;
    if (!rect) { spot.hidden = true; arrow.hidden = true; blocks.forEach((b) => { b.hidden = !block; Object.assign(b.style, { left: '0px', top: '0px', width: block ? vw + 'px' : '0px', height: block ? vh + 'px' : '0px' }); }); return; }
    const x = Math.max(0, rect.x - pad), y = Math.max(0, rect.y - pad), w = Math.min(vw - x, rect.w + pad * 2), h = Math.min(vh - y, rect.h + pad * 2);
    spot.hidden = false; spot.classList.toggle('dim', dim);
    Object.assign(spot.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    const sides = [[0, 0, vw, y], [0, y + h, vw, vh - y - h], [0, y, x, h], [x + w, y, vw - x - w, h]];
    blocks.forEach((b, i) => { b.hidden = !block; const [bx, by, bw, bh] = sides[i]; Object.assign(b.style, { left: bx + 'px', top: by + 'px', width: Math.max(0, bw) + 'px', height: Math.max(0, bh) + 'px' }); });
    // the arrow points at the target from whichever side has more room
    const below = y + h / 2 < vh / 2;
    arrow.hidden = false; arrow.classList.toggle('up', below);
    Object.assign(arrow.style, { left: x + w / 2 - 14 + 'px', top: (below ? y + h + 8 : y - 36) + 'px' });
    // the card sits on the opposite half of the screen to the target
    ui.card.classList.toggle('top', !below || y + h > vh * 0.8);
  }

  // ---------- the training mission ----------
  // the best spots for a first tower: open ground beside the road that covers the most of it,
  // clear of the map edges and the supply buttons, and not bunched together
  function goodSpots() {
    const all = [], R = TOWERS.gunner.base.range;
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
      if (!canPlaceAt('gunner', x, y) || (x < 5 && y > ROWS - 3)) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => S.M.grid[(y + dy) * COLS + x + dx] === 1)) continue;
      let cover = 0;
      for (let yy = y - 3; yy <= y + 3; yy++) for (let xx = x - 3; xx <= x + 3; xx++) if (S.M.grid[yy * COLS + xx] === 1 && (xx - x) ** 2 + (yy - y) ** 2 <= R * R) cover++;
      all.push({ x, y, score: cover });
    }
    all.sort((a, b) => b.score - a.score);
    const out = [];
    for (const p of all) if (out.length < 3 && out.every((q) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y) >= 3)) out.push(p);
    return out;
  }
  let spots = [];
  // a selected tower's panel replaces the arsenal on small screens, so steps that need the arsenal
  // (or a fresh tap on a tower) start with nothing selected
  function deselect() { S.selected = null; S.placing = null; for (const el of document.querySelectorAll('.tower-btn')) el.classList.remove('active'); renderInfo(); }
  const towerRect = (t) => onMap(t.col * TILE, t.row * TILE, TILE, TILE);
  function makeSteps() {
    const tap = touch() ? 'Tap' : 'Click';
    return [
      { who: 'voss', text: 'Welcome to Hollow Creek, Commander. Zombies walk this road to our safehouse. Stop them before they get there.', at: () => onMap(S.M.end.x - 50, S.M.end.y - 50, 100, 100), next: true },
      { who: 'voss', text: `You build towers to fight. ${tap} the Machine Gunner in your Arsenal.`, at: () => elRect('.tower-btn[data-type="gunner"]'), done: () => S.placing === 'gunner' || S.towers.length > 0 },
      { who: 'voss', text: touch() ? 'Now tap one of the glowing spots beside the road. Tap once to see it, and tap again to build.' : 'Now click one of the glowing spots beside the road to build it there.', at: () => elRect('#game'), tiles: true,
        done: () => S.towers.length > 0, back: () => !S.placing && !S.towers.length },
      { who: 'moreno', text: 'Nice. The circle is its range: it shoots any zombie inside it, all by itself.', at: () => { const t = S.towers[0]; const r = TOWERS[t.type].base.range * TILE; return onMap(t.x - r, t.y - r, r * 2, r * 2); }, next: true },
      { who: 'voss', text: `Ready? ${tap} Start Wave to send in the first zombies.`, at: () => elRect('#btn-wave'), done: () => S.wave >= 1, wave: true },
      { who: 'moreno', text: 'Here they come! Every zombie you kill pays cash. Watch it add up here.', at: () => elRect('.stat-cash'), free: true, done: () => S.wave >= 1 && !S.spawners.length && !S.enemies.length },
      { who: 'voss', text: 'Wave cleared. Spend your cash on a second tower further along the road.', at: () => elRect('#shop'), free: true, done: () => S.towers.length > 1, enter: deselect },
      { who: 'voss', text: `Towers get stronger. ${tap} your first Machine Gunner to open its upgrades.`, at: () => S.towers[0] && towerRect(S.towers[0]), done: () => S.selected === S.towers[0], enter: deselect },
      { who: 'voss', text: 'Each tower has three upgrade paths. Buy one now.', at: () => elRect('#info .up-paths') || elRect('#info'), done: () => S.towers.some((t) => t.tiers.some((n) => n > 0)),
        enter: () => {
          // make sure the first upgrade is affordable
          const t = S.selected || S.towers[0], cheapest = Math.min(...[0, 1, 2].map((p) => upgradeState(t, p)).filter((u) => u.state === 'buy' || u.state === 'poor').map((u) => u.cost));
          if (isFinite(cheapest) && S.cash < cheapest) { const add = cheapest - S.cash + 10; S.cash += add; floatText(`HQ sends $${add}`, W / 2, H / 2, '#86d356', 18); updateHUD(true); renderInfo(); }
        } },
      { who: 'moreno', text: 'Every zombie that reaches the safehouse costs lives, up here. Lose them all and the mission is lost.', at: () => elRect('.stat-lives'), next: true },
      { who: 'voss', text: 'In a pinch, use supplies down here: an airstrike, a cryo bomb and a cash drop. You have one of each.', at: () => elRect('#powerbar'), next: true },
      { who: 'moreno', text: 'Speed the fight up here, or turn on Auto to start waves by themselves. The rest is up to you. Hold the line!', at: () => elRect('.controls'), next: 'Start defending' },
    ];
  }
  function startTutorial() {
    build();
    S.auto = false; $('#btn-auto').setAttribute('aria-pressed', 'false');
    steps = makeSteps(); spots = goodSpots(); first = null;
    Comms.clear();
    ui.layer.hidden = false;
    go(0);
  }
  function go(i) {
    if (i >= steps.length) return finishTutorial();
    step = i;
    const s = steps[i];
    ui.face.getContext('2d').drawImage(Comms.portrait(s.who), 0, 0);
    ui.name.textContent = (CAST[s.who] || CAST.voss).name;
    ui.count.textContent = `${i + 1} / ${steps.length}`;
    ui.text.textContent = s.text;
    ui.next.hidden = !s.next; ui.next.textContent = typeof s.next === 'string' ? s.next : 'Next';
    // a card with nothing to press lets taps through to the battlefield under it
    ui.card.classList.toggle('pass', !s.next);
    if (s.enter) s.enter();
    if (i > 0) Sound.play('select');
  }
  function finishTutorial() {
    meta.tutorialDone = true; meta.introduced = { ...(meta.introduced || {}), gunner: 1 }; saveMeta();
    steps = null; step = -1; spots = [];
    ui.layer.hidden = true;
    Comms.clear();
    showBanner('Training complete', 'Clear all 10 waves to secure the sector');
    Sound.play('unlock');
  }
  function stop() { steps = null; step = -1; spots = []; cards = []; cardOpen = false; glow = null; if (ui) { ui.layer.hidden = true; ui.brief.hidden = true; ui.brief.innerHTML = ''; } }

  // ---------- new tower briefings ----------
  // older saves: players who have already cleared levels skip training, and towers they had
  // before briefings existed are not re-introduced
  function migrate() {
    if (meta.introduced) return;
    meta.introduced = {};
    const vet = Object.keys(meta.stars || {}).length > 0;
    if (meta.tutorialDone == null) meta.tutorialDone = vet;
    if (vet) for (const t of TOWER_KEYS) if (towerUnlocked(t) && (!TOWERS[t].snowOnly || levelUnlocked(2 * LEVELS_PER_WORLD))) meta.introduced[t] = 1;
    saveMeta();
  }
  function briefings() {
    migrate();
    cards = TOWER_KEYS.filter((t) => INTROS[t] && towerUnlocked(t) && !meta.introduced[t] && (!TOWERS[t].snowOnly || coldMap()));
    if (cards.length) showCard();
  }
  function showCard() {
    build();
    const type = cards[0], def = TOWERS[type], I = INTROS[type];
    cardOpen = true; ui.layer.hidden = false; place(null, true, false);
    ui.card.hidden = true;
    const b = ui.brief; b.hidden = false; b.innerHTML = '';
    const box = document.createElement('div'); box.className = 'brief-box';
    const icon = towerIcon(type, [0, 0, 0], 96); icon.className = 'brief-icon';
    // the cold only matters once the player has reached the snow
    const crewed = CREWED.has(type) && (coldMap() || levelUnlocked(2 * LEVELS_PER_WORLD)) ? '<span>Crewed: needs heat on snow maps</span>' : '';
    box.innerHTML = `<p class="brief-kicker">New tower in your arsenal${cards.length > 1 ? ` · ${cards.length} to meet` : ''}</p>
      <div class="brief-head"><div class="brief-icon-slot"></div><div><h3>${def.name}</h3><p class="brief-tags"><span class="role">${def.role}</span><span>$${costOf(def.cost)}</span>${!def.base.dmg ? '' : def.air ? '<span>Hits flyers</span>' : '<span>Ground only</span>'}${def.place === 'water' ? '<span>Water only</span>' : ''}${crewed}</p></div></div>
      <p class="brief-what">${I.what}</p>
      <dl class="brief-rows"><dt class="good">Great against</dt><dd>${I.good}</dd><dt class="bad">Watch out</dt><dd>${I.bad}</dd><dt class="tip">Tip</dt><dd>${I.tip}</dd></dl>
      <div class="brief-actions"><button type="button" class="btn btn-primary">${cards.length > 1 ? 'Next tower' : 'Got it'}</button><span class="hint">Key ${def.key.toUpperCase()} · find it in the Arsenal</span></div>`;
    box.querySelector('.brief-icon-slot').append(icon);
    box.querySelector('button').addEventListener('click', () => {
      Sound.play('click');
      meta.introduced[type] = 1; saveMeta();
      cards.shift();
      if (cards.length) return showCard();
      cardOpen = false; b.hidden = true; b.innerHTML = '';
      ui.layer.hidden = !steps;
      // point out where the newest tower is in the arsenal for a few seconds
      glow = { type, t: 4 };
    });
    b.append(box);
    Sound.play('unlock');
  }

  // ---------- every frame ----------
  function update(dt) {
    if (glow) {
      glow.t -= dt;
      const r = elRect(`.tower-btn[data-type="${glow.type}"]`);
      if (glow.t <= 0 || !r || S.state !== 'playing') { glow = null; if (ui && !steps && !cardOpen) ui.layer.hidden = true; }
      else { ui.layer.hidden = false; ui.card.hidden = true; place(r, false, false); }
    }
    if (cardOpen || !steps || !ui) return;
    if (S.state !== 'playing') return stop();
    const s = steps[step];
    if (S.paused) { ui.layer.hidden = true; return; }
    ui.layer.hidden = false; ui.card.hidden = false;
    if (s.back && s.back()) return go(step - 1);
    if (s.done && s.done()) return go(step + 1);
    const r = s.at && s.at();
    place(r || null, !s.free, !s.free);
  }
  // the glowing build spots for the first tower, drawn on the battlefield
  function drawMap(c, t) {
    if (!steps || !steps[step] || !steps[step].tiles) return;
    for (const p of spots) {
      if (!canPlaceAt('gunner', p.x, p.y)) continue;
      const a = 0.45 + Math.sin(t * 5) * 0.25, x = p.x * TILE, y = p.y * TILE;
      c.fillStyle = `rgba(227,168,62,${a * 0.35})`; c.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      c.strokeStyle = `rgba(255,214,120,${a + 0.2})`; c.lineWidth = 2.5; c.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
    }
  }

  return {
    startTutorial, briefings, update, drawMap, stop, INTROS,
    due: () => { migrate(); return !meta.tutorialDone; },
    // the game holds still while a card is up, and waves wait for the tutorial's say-so
    get holding() { return cardOpen; },
    get active() { return !!steps; },
    // the first wave only goes when the tutorial says so; after that the player calls them
    allowWave: () => !steps || steps.slice(0, step + 1).some((s) => s.wave),
  };
})();
