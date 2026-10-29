'use strict';
// ============================================================
// Premium: things bought with real money, and the Customize screen for the cosmetics.
//
// Every purchase goes through PAY. Until a native store is connected (PREMIUM.connect, from the
// iOS app's StoreKit bridge) the game runs in TEST MODE: a purchase opens a test sheet, nothing
// is charged, and the item is granted as if it had been bought. The web version always stays in
// test mode, so it never takes payments.
//
// What a player owns lives in meta.prem (own, tips) and their chosen looks in meta.look. A ledger
// of the one-time purchases is kept apart from the save (as the App Store keeps receipts) so
// Restore Purchases can bring them back.
// ============================================================
const PREMIUM = (() => {
  const LEDGER_KEY = 'zbash2.iap';

  // ---------- catalogue ----------
  // kind 'once' is bought one time and kept (restorable); 'many' can be bought again (coins, tips).
  const P = (kind, price, name, desc, o = {}) => ({ kind, price, name, desc, ...o });
  const PRODUCTS = {
    starter: P('once', 1.99, 'Starter Pack', '1,000 coins, the Cryo Cannon right away, 3 of every supply, and a gold Machine Gunner you can only get here.', { best: 'One time only' }),
    coins1: P('many', 0.99, 'Pouch of Coins', '1,000 coins to spend in the store.', { coins: 1000 }),
    coins2: P('many', 4.99, 'Chest of Coins', '6,000 coins to spend in the store.', { coins: 6000, best: '+20% bonus' }),
    coins3: P('many', 9.99, 'Vault of Coins', '15,000 coins to spend in the store.', { coins: 15000, best: 'Best value' }),
    doubler: P('once', 2.99, 'Coin Doubler', 'Double the coins from every level you play, for good.'),
    xpboost: P('once', 1.99, 'Field Training', 'Towers earn 50% more XP, so Armory upgrades unlock sooner.'),
    quarter: P('once', 1.99, 'Quartermaster', 'A free supply after every level you win.'),
    hyper: P('once', 0.99, 'Hyper Speed', 'Adds a 4× game speed to the speed button.'),
    desert: P('once', 3.99, 'Red Mesa Wasteland', 'An extra world: 50 new levels across dunes, canyons, dead oil fields and an abandoned airbase, with Mummies, Dune Scorpions, Vultures, the Sand Colossus, its own music and a three-chapter side story. Opens once Hollow Creek Farmland is cleared.', { best: 'Expansion' }),
    tip1: P('many', 0.99, 'Buy the crew a coffee', 'A small thank-you. Every tip earns the Supporter badge.', { tip: true }),
    tip2: P('many', 2.99, 'Buy the crew lunch', 'A bigger thank-you. Every tip earns the Supporter badge.', { tip: true }),
    tip3: P('many', 9.99, 'Fund the next update', 'A huge thank-you. Every tip earns the Supporter badge.', { tip: true }),
    // cosmetics (see LOOKS for what each one is)
    'skin-gold': P('once', 2.99, 'Gold Plated', 'Polished gold paint for every ground tower and boat.'),
    'skin-winter': P('once', 1.99, 'Winter Camo', 'Snow camouflage for every ground tower and boat.'),
    'skin-neon': P('once', 1.99, 'Neon', 'Glowing neon paint for every ground tower and boat.'),
    'skin-scrap': P('once', 1.99, 'Scrapyard', 'Rusty, riveted scrap metal for every ground tower and boat.'),
    'tracer-ember': P('once', 0.99, 'Ember Tracers', 'Red-hot tracer rounds for every gun.'),
    'tracer-plasma': P('once', 0.99, 'Plasma Tracers', 'Green plasma tracer rounds for every gun.'),
    'tracer-violet': P('once', 0.99, 'Void Tracers', 'Violet tracer rounds for every gun.'),
    'bolt-red': P('once', 0.99, 'Crimson Lightning', 'Red lightning for the Tesla Coil.'),
    'bolt-green': P('once', 0.99, 'Toxic Lightning', 'Green lightning for the Tesla Coil.'),
    'bolt-gold': P('once', 0.99, 'Solar Lightning', 'Golden lightning for the Tesla Coil.'),
    'outfit-pumpkin': P('once', 0.99, 'Pumpkin Heads', 'Zombies come wearing jack-o\'-lanterns.'),
    'outfit-santa': P('once', 0.99, 'Santa Hats', 'Zombies come dressed for the holidays.'),
    'outfit-party': P('once', 0.99, 'Party Hats', 'Zombies come ready to party.'),
    'flag-pirate': P('once', 0.99, 'Pirate Flag', 'A skull and crossbones over the safehouse.'),
    'flag-royal': P('once', 0.99, 'Royal Banner', 'A purple and gold banner over the safehouse.'),
    'flag-hazard': P('once', 0.99, 'Hazard Flag', 'A biohazard warning over the safehouse.'),
    'menu-bloodmoon': P('once', 0.99, 'Blood Moon', 'A red night over the main menu.'),
    'menu-aurora': P('once', 0.99, 'Aurora', 'Northern lights over the main menu.'),
    'menu-toxic': P('once', 0.99, 'Toxic Fog', 'A green, poisoned sky over the main menu.'),
    'music-arcade': P('once', 1.99, '8-Bit Arcade', 'Every song in the game, replayed on a retro sound chip.'),
    'music-synth': P('once', 1.99, 'Synthwave', 'Every song in the game, replayed on analog synths.'),
    'bundle-halloween': P('once', 2.99, 'Halloween Pack', 'Pumpkin Heads, Scrapyard towers, Ember Tracers, the Pirate Flag and the Toxic Fog menu.', { gives: ['outfit-pumpkin', 'skin-scrap', 'tracer-ember', 'flag-pirate', 'menu-toxic'], best: 'Save 60%' }),
    'bundle-winter': P('once', 2.99, 'Winter Pack', 'Santa Hats, Winter Camo towers, Solar Lightning, the Royal Banner and the Aurora menu.', { gives: ['outfit-santa', 'skin-winter', 'bolt-gold', 'flag-royal', 'menu-aurora'], best: 'Save 55%' }),
  };

  // what each cosmetic looks like in the game
  const LOOKS = {
    tracer: { ember: '255,96,40', plasma: '110,255,120', violet: '196,110,255' },
    // deep, mid and light colours of the Tesla's lightning
    bolt: { blue: ['70,150,255', '120,205,255', '200,232,255'], red: ['255,50,50', '255,120,100', '255,205,195'], green: ['50,240,90', '140,255,150', '210,255,215'], gold: ['255,160,30', '255,210,100', '255,242,200'] },
    flag: {
      pirate: { cloth: ['#1a1a1c', '#2c2c30', '#121214'], mark: 'skull', ink: '#f0ece0', beacon: '255,60,40' },
      royal: { cloth: ['#4a1e7a', '#6a2ea8', '#3a165e'], mark: 'crown', ink: '#ffcf40', beacon: '255,200,60' },
      hazard: { cloth: ['#e0b818', '#f4d030', '#b89010'], mark: 'hazard', ink: '#1a1a14', beacon: '120,255,80' },
    },
  };
  const SKIN_NAMES = { gold: 'Gold Plated', winter: 'Winter Camo', neon: 'Neon', scrap: 'Scrapyard' };
  const NO_SKIN = { heli: true, jet: true };

  // ---------- entitlements ----------
  const prem = () => (meta.prem = meta.prem || { own: {}, tips: 0 });
  const look = () => (meta.look = meta.look || { skins: {} });
  function has(id) {
    const own = prem().own;
    if (own[id]) return true;
    for (const [b, p] of Object.entries(PRODUCTS)) if (p.gives && own[b] && p.gives.includes(id)) return true;
    return false;
  }
  const supporter = () => (prem().tips | 0) > 0;
  // can this tower wear this skin? (the starter pack's gold is for the Machine Gunner only)
  const skinOK = (type, skin) => !NO_SKIN[type] && (has('skin-' + skin) || (skin === 'gold' && type === 'gunner' && has('starter')));
  let previewSkin = null;
  function skinOf(type) {
    if (previewSkin && previewSkin.type === type) return previewSkin.skin;
    if (typeof meta === 'undefined') return null;
    const s = look().skins[type];
    return s && skinOK(type, s) ? s : null;
  }
  const chosen = (slot) => { const v = look()[slot]; return v && has(`${slot}-${v}`) ? v : null; };
  let previewOutfit;
  const outfit = () => (previewOutfit !== undefined ? previewOutfit : typeof meta === 'undefined' ? null : chosen('outfit'));
  const tracer = () => { const v = chosen('tracer'); return v ? LOOKS.tracer[v] : null; };
  const bolt = () => LOOKS.bolt[chosen('bolt') || 'blue'];
  const flag = () => { const v = typeof meta === 'undefined' ? null : chosen('flag'); return v ? LOOKS.flag[v] : null; };
  const menuTheme = () => chosen('menu');
  const musicPack = () => chosen('music');

  // the gameplay boosts
  const coinMult = () => (has('doubler') ? 2 : 1);
  const xpMult = () => (has('xpboost') ? 1.5 : 1);
  const maxSpeed = () => (has('hyper') ? 4 : 3);

  // ---------- payments ----------
  // A native store plugs in here: { buy(id) -> Promise<boolean>, restore() -> Promise<string[]>, price(id) -> string }.
  let backend = null;
  const testMode = () => !backend;
  const connect = (b) => { backend = b; };
  const priceText = (id) => (backend && backend.price && backend.price(id)) || `$${PRODUCTS[id].price.toFixed(2)}`;
  const ledger = () => { try { const v = JSON.parse(store.get(LEDGER_KEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const writeLedger = (ids) => store.set(LEDGER_KEY, JSON.stringify([...new Set(ids)]));

  // what a purchase gives; restoring a one-time item gives back only what is kept for good
  function grant(id, restoring = false) {
    const p = PRODUCTS[id], pr = prem();
    if (!p) return;
    if (p.kind === 'once') pr.own[id] = true;
    if (restoring) return;
    if (p.coins) meta.coins += p.coins;
    if (p.tip) pr.tips = (pr.tips | 0) + 1;
    if (id === 'starter') {
      meta.coins += 1000; meta.owned.cryo = true;
      for (const k of Object.keys(SUPPLIES)) meta.items[k] = (meta.items[k] | 0) + 3;
      look().skins.gunner = 'gold';
    }
    // wear a new cosmetic straight away
    const [slot, v] = id.split('-');
    if (p.kind === 'once' && v && slot !== 'bundle') wear(slot, v);
    if (p.gives) for (const g of p.gives) { const [s2, v2] = g.split('-'); wear(s2, v2); }
    if (p.kind === 'once') writeLedger([...ledger(), id]);
  }
  function wear(slot, v) {
    const L = look();
    if (slot === 'skin') { for (const type of TOWER_KEYS) if (!NO_SKIN[type]) L.skins[type] = v; }
    else L[slot] = v;
    applyLooks();
  }
  // a purchase: the store's own sheet (or the test sheet), then the item
  async function buy(id) {
    let ok = false;
    try { ok = backend ? await backend.buy(id) : await testSheet(id); } catch (e) { ok = false; }
    if (!ok) return false;
    grant(id);
    saveMeta();
    Sound.play('buy');
    toast(PRODUCTS[id].tip ? 'Thank you for the support!' : `${PRODUCTS[id].name}: done!`);
    return true;
  }
  async function restore() {
    let ids = [];
    try { ids = backend ? await backend.restore() : ledger(); } catch (e) { ids = []; }
    let n = 0;
    for (const id of ids) if (PRODUCTS[id] && PRODUCTS[id].kind === 'once' && !prem().own[id]) { grant(id, true); n++; }
    saveMeta(); applyLooks();
    toast(n ? `Restored ${n} purchase${n > 1 ? 's' : ''}.` : 'Everything you bought is already here.');
  }
  // test mode only: forget every test purchase so the store can be tried again
  function resetTest() {
    if (!testMode()) return;
    meta.prem = { own: {}, tips: 0 }; meta.look = { skins: {} };
    store.remove(LEDGER_KEY);
    saveMeta(); applyLooks();
    toast('Test purchases cleared.');
  }

  // ---------- the test purchase sheet ----------
  function testSheet(id) {
    return new Promise((resolve) => {
      const p = PRODUCTS[id];
      const wrap = document.createElement('div'); wrap.className = 'pay-sheet'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Test purchase');
      wrap.innerHTML = `<div class="pay-card">
        <p class="pay-tag">Test mode</p>
        <h3>${p.name}</h3>
        <p class="pay-desc">${p.desc}</p>
        <p class="pay-price">${priceText(id)}</p>
        <p class="pay-note">This is a test purchase. No money is charged. Real purchases will only come with the App Store version.</p>
        <div class="dialog-actions"><button class="btn btn-primary" type="button" data-ok>Buy (test)</button><button class="btn" type="button" data-no>Cancel</button></div>
      </div>`;
      const done = (v) => { wrap.remove(); document.removeEventListener('keydown', key, true); resolve(v); };
      const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
      wrap.querySelector('[data-ok]').addEventListener('click', () => done(true));
      wrap.querySelector('[data-no]').addEventListener('click', () => { Sound.play('click'); done(false); });
      wrap.addEventListener('click', (e) => { if (e.target === wrap) done(false); });
      document.addEventListener('keydown', key, true);
      document.body.append(wrap);
      wrap.querySelector('[data-ok]').focus();
    });
  }
  function toast(text) {
    for (const old of document.querySelectorAll('.prem-toast')) old.remove();
    const t = document.createElement('div'); t.className = 'prem-toast'; t.setAttribute('role', 'status'); t.textContent = text;
    document.body.append(t);
    setTimeout(() => t.classList.add('out'), 1900);
    setTimeout(() => t.remove(), 2400);
  }

  // ---------- looks that live outside the battlefield ----------
  function applyLooks() {
    const m = document.getElementById('menu-screen');
    if (m) { m.dataset.theme = menuTheme() || ''; }
    if (typeof MUSIC !== 'undefined') MUSIC.setPack(musicPack());
    if (typeof TFIN !== 'undefined') { TFIN.base.clear(); TFIN.turret.clear(); TFIN.turretPx = 0; }
    const badge = document.getElementById('supporter-badge');
    if (badge) badge.hidden = !supporter();
  }

  // ---------- small pictures for the store and Customize ----------
  const pic = (size, draw) => {
    const cv = document.createElement('canvas'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = cv.height = Math.round(size * dpr);
    const c = cv.getContext('2d'); c.scale(dpr, dpr); draw(c, size);
    return cv;
  };
  const skinIcon = (type, skin, size) => { previewSkin = { type, skin }; try { return towerIcon(type, [0, 0, 0], size); } finally { previewSkin = null; } };
  const outfitIcon = (v, size) => {
    previewOutfit = v;
    try { return pic(size, (c) => drawZombieIcon(c, 'walker', size)); } finally { previewOutfit = undefined; }
  };
  const tracerIcon = (col, size) => pic(size, (c, s) => {
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const y = s * (0.3 + i * 0.2), x0 = s * (0.12 + i * 0.08);
      c.strokeStyle = `rgba(${col},0.3)`; c.lineWidth = 6; c.beginPath(); c.moveTo(x0, y + 6); c.lineTo(s * 0.88, y - 6); c.stroke();
      c.strokeStyle = `rgba(${col},0.95)`; c.lineWidth = 2.2; c.stroke();
    }
  });
  const boltIcon = (pal, size) => pic(size, (c, s) => {
    const rng = mulberry32(5), pts = [];
    for (let i = 0; i <= 8; i++) pts.push([s * 0.15 + (s * 0.7 * i) / 8 + (rng() - 0.5) * 6, s * 0.2 + (s * 0.6 * i) / 8 + (rng() - 0.5) * 12]);
    c.lineJoin = c.lineCap = 'round';
    for (const [col, w] of [[`rgba(${pal[0]},0.35)`, 9], [`rgba(${pal[1]},0.8)`, 4], ['rgba(250,253,255,1)', 1.6]]) {
      c.strokeStyle = col; c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    }
  });
  const flagIcon = (F, size) => pic(size, (c, s) => {
    const k = s / 14; c.scale(k, k);
    c.strokeStyle = '#2a2a26'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(2.5, 1.5); c.lineTo(2.5, 13); c.stroke();
    c.beginPath(); c.moveTo(2.8, 2);
    for (let i = 1; i <= 6; i++) c.lineTo(2.8 + i * 1.6, 2 + Math.sin(i * 0.9) * 0.5);
    for (let i = 6; i >= 0; i--) c.lineTo(2.8 + i * 1.6, 8 + Math.sin(i * 0.9) * 0.5);
    c.closePath();
    const g = c.createLinearGradient(2.8, 0, 12.4, 0); g.addColorStop(0, F.cloth[0]); g.addColorStop(0.5, F.cloth[1]); g.addColorStop(1, F.cloth[2]);
    c.fillStyle = g; c.fill();
    BUILDINGS.flagMark(c, F, 7.6, 5.2);
  });
  // a little desert at sunset for the expansion's card
  const desertArt = (size) => pic(size, (c, s) => {
    const g = c.createLinearGradient(0, 0, 0, s); g.addColorStop(0, '#f4b860'); g.addColorStop(0.55, '#e07a3a'); g.addColorStop(1, '#7a3a20');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    c.fillStyle = '#ffe2a0'; c.beginPath(); c.arc(s * 0.68, s * 0.42, s * 0.13, 0, TAU); c.fill();
    c.fillStyle = '#9a4a28'; c.beginPath(); c.moveTo(0, s * 0.62); c.lineTo(s * 0.12, s * 0.62); c.lineTo(s * 0.16, s * 0.46); c.lineTo(s * 0.38, s * 0.46); c.lineTo(s * 0.42, s * 0.62); c.lineTo(s, s * 0.64); c.lineTo(s, s); c.lineTo(0, s); c.fill();
    c.fillStyle = '#d49a5a'; c.beginPath(); c.moveTo(0, s * 0.8); c.quadraticCurveTo(s * 0.35, s * 0.62, s * 0.7, s * 0.78); c.quadraticCurveTo(s * 0.85, s * 0.84, s, s * 0.76); c.lineTo(s, s); c.lineTo(0, s); c.fill();
    c.fillStyle = '#2a3a1a'; c.fillRect(s * 0.78, s * 0.56, s * 0.04, s * 0.22); c.fillRect(s * 0.72, s * 0.62, s * 0.06, s * 0.03); c.fillRect(s * 0.72, s * 0.56, s * 0.03, s * 0.07); c.fillRect(s * 0.82, s * 0.6, s * 0.05, s * 0.03); c.fillRect(s * 0.85, s * 0.54, s * 0.03, s * 0.08);
  });
  const swatch = (cls) => { const d = document.createElement('div'); d.className = `cz-swatch ${cls}`; return d; };
  const GLYPH = {
    coins: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 10v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4M5 14v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4"/></svg>',
    doubler: '<svg viewBox="0 0 24 24"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/><path d="M15 9v6M13 11l2-2 2 2"/></svg>',
    xpboost: '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4l-5.2 2.7 1-5.8L3.5 9.2l5.9-.8z"/><path d="M12 8v5M10 10l2-2 2 2"/></svg>',
    quarter: '<svg viewBox="0 0 24 24"><path d="M3 8l9-4 9 4v9l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v9"/></svg>',
    hyper: '<svg viewBox="0 0 24 24"><path d="M3 6l7 6-7 6zM11 6l7 6-7 6z"/><path d="M20 5v14"/></svg>',
    tip: '<svg viewBox="0 0 24 24"><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3c0 1.5 1 1.5 1 3M11 3c0 1.5 1 1.5 1 3"/></svg>',
    music: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>',
    bundle: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 13h18M12 9v12M12 9c-2-4-6-5-6-2s4 2 6 2c2 0 6 1 6-2s-4-2-6 2"/></svg>',
    restore: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/></svg>',
  };
  const glyph = (key) => { const g = document.createElement('div'); g.className = 'glyph'; g.innerHTML = GLYPH[key]; return g; };

  // ---------- the store's Premium tab ----------
  function section(grid, title, note) {
    const h = document.createElement('div'); h.className = 'store-section';
    h.innerHTML = `<h3>${title}</h3>${note ? `<p>${note}</p>` : ''}`;
    grid.append(h);
  }
  function card(grid, id, art, after, o = {}) {
    const p = PRODUCTS[id], owned = p.kind === 'once' && has(id);
    const el = document.createElement('div'); el.className = 'store-card prem-card' + (o.wide ? ' wide' : '');
    el.append(art);
    const body = document.createElement('div'); body.className = 'body';
    body.innerHTML = `<span class="meta">${p.best ? `<b class="best">${p.best}</b> ` : ''}${o.meta || (p.kind === 'once' ? 'Yours to keep' : 'Buy any time')}</span><h3>${p.name}</h3><p>${p.desc}</p>`;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-primary btn-small';
    b.textContent = owned ? 'Owned' : priceText(id); b.disabled = owned;
    b.addEventListener('click', async () => { Sound.play('click'); b.disabled = true; await buy(id); after(); });
    body.append(b); el.append(body);
    grid.append(el);
  }
  function renderStore(grid, after) {
    if (testMode()) {
      const n = document.createElement('div'); n.className = 'store-section test-banner';
      n.innerHTML = '<h3>Test mode</h3><p>Purchases here are only a test: no money is charged and nothing is billed. Real purchases will come with the App Store version.</p>';
      grid.append(n);
    }
    if (!has('starter')) {
      section(grid, 'Featured');
      card(grid, 'starter', skinIcon('gunner', 'gold', 64), after, { wide: true, meta: 'Best for new players' });
    }
    section(grid, 'Expansion');
    card(grid, 'desert', desertArt(64), after, { wide: true, meta: 'New world' });
    section(grid, 'Coins');
    for (const id of ['coins1', 'coins2', 'coins3']) card(grid, id, glyph('coins'), after, { meta: `${PRODUCTS[id].coins.toLocaleString('en-US')} coins` });
    section(grid, 'Boosts', 'Bought once, they work in every level for good.');
    for (const id of ['doubler', 'xpboost', 'quarter', 'hyper']) card(grid, id, glyph(id), after);
    section(grid, 'Cosmetics', 'Looks only: they never change how strong anything is. Pick what you wear in Customize.');
    const cz = document.createElement('div'); cz.className = 'store-card prem-card wide cz-link';
    cz.append(skinIcon('flame', 'neon', 64));
    cz.insertAdjacentHTML('beforeend', '<div class="body"><span class="meta">Skins, tracers, outfits, flags, themes and music</span><h3>Customize</h3><p>See every cosmetic in action, try them on and wear the ones you own.</p></div>');
    const go = document.createElement('button'); go.type = 'button'; go.className = 'btn btn-primary btn-small'; go.textContent = 'Open Customize';
    go.addEventListener('click', () => { Sound.play('click'); showCustomize('store'); });
    cz.querySelector('.body').append(go); grid.append(cz);
    card(grid, 'bundle-halloween', outfitIcon('pumpkin', 64), after);
    card(grid, 'bundle-winter', outfitIcon('santa', 64), after);
    section(grid, 'Support the developer', supporter() ? `Thank you! You have tipped ${prem().tips} time${prem().tips > 1 ? 's' : ''}.` : 'Tips change nothing in the game. They just say thanks, and earn a Supporter badge on the menu.');
    for (const id of ['tip1', 'tip2', 'tip3']) card(grid, id, glyph('tip'), after, { meta: 'Tip' });
    // restore, and in test mode a reset
    const row = document.createElement('div'); row.className = 'store-section prem-actions';
    const rb = document.createElement('button'); rb.type = 'button'; rb.className = 'btn btn-small'; rb.textContent = 'Restore purchases';
    rb.addEventListener('click', async () => { Sound.play('click'); await restore(); after(); });
    row.append(rb);
    if (testMode()) {
      const xb = document.createElement('button'); xb.type = 'button'; xb.className = 'btn btn-small btn-ghost'; xb.textContent = 'Reset test purchases';
      xb.addEventListener('click', () => { Sound.play('click'); resetTest(); after(); });
      row.append(xb);
    }
    grid.append(row);
  }

  // ---------- Customize ----------
  let czFrom = 'menu', czTower = 'gunner';
  const ROWS = [
    { slot: 'tracer', title: 'Tracer rounds', note: 'The streak every gun leaves behind.', none: 'Standard', opts: ['ember', 'plasma', 'violet'], art: (v, s) => tracerIcon(v ? LOOKS.tracer[v] : '255,220,150', s) },
    { slot: 'bolt', title: 'Tesla lightning', note: 'The colour of the Tesla Coil\'s chain lightning.', none: 'Electric Blue', opts: ['red', 'green', 'gold'], art: (v, s) => boltIcon(LOOKS.bolt[v || 'blue'], s) },
    { slot: 'outfit', title: 'Zombie outfits', note: 'Worn by the zombies that go bare-headed.', none: 'No outfit', opts: ['pumpkin', 'santa', 'party'], art: (v, s) => outfitIcon(v, s) },
    { slot: 'flag', title: 'Safehouse flag', note: 'Flies over your base, with a beacon to match.', none: 'Field Green', opts: ['pirate', 'royal', 'hazard'], art: (v, s) => flagIcon(v ? LOOKS.flag[v] : BUILDINGS.FLAG_PLAIN, s) },
    { slot: 'menu', title: 'Menu theme', note: 'The sky over the main menu.', none: 'Burning City', opts: ['bloodmoon', 'aurora', 'toxic'], art: (v) => swatch(`theme-${v || 'default'}`) },
    { slot: 'music', title: 'Music pack', note: 'Replays the whole soundtrack on other instruments.', none: 'Original', opts: ['arcade', 'synth'], art: (v) => { const g = glyph('music'); g.classList.add(`mus-${v || 'orig'}`); return g; } },
  ];
  function option(row, art, name, state, onClick) {
    const el = document.createElement('button'); el.type = 'button'; el.className = `cz-opt ${state}`;
    el.setAttribute('aria-pressed', String(state === 'on'));
    el.append(art);
    const label = state === 'on' ? 'Wearing' : state === 'own' ? 'Wear' : '';
    el.insertAdjacentHTML('beforeend', `<span class="cz-name">${name}</span><span class="cz-state">${label}</span>`);
    el.addEventListener('click', onClick);
    row.append(el);
    return el;
  }
  function showCustomize(from = czFrom) {
    leaveGame();
    hideScreens();
    czFrom = from;
    $('#customize-screen').hidden = false;
    $('#cz-test').hidden = !testMode();
    const body = $('#cz-body'); body.innerHTML = '';
    const redraw = () => { const y = $('#customize-screen').scrollTop; showCustomize(czFrom); $('#customize-screen').scrollTop = y; };
    const pick = async (id, apply) => {
      Sound.play('click');
      if (has(id) || await buy(id)) { apply(); saveMeta(); applyLooks(); }
      redraw();
    };
    // tower skins: choose a tower, then its paint
    const sk = document.createElement('section'); sk.className = 'cz-group';
    sk.innerHTML = '<h3>Tower skins</h3><p>Pick a tower, then its paint. Gunships and jets keep their factory colours.</p>';
    const tabs = document.createElement('div'); tabs.className = 'cz-towers'; tabs.setAttribute('role', 'tablist');
    for (const type of TOWER_KEYS) {
      if (NO_SKIN[type]) continue;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'cz-tower'; b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(type === czTower)); b.title = TOWERS[type].name;
      b.append(towerIcon(type, [0, 0, 0], 40));
      b.addEventListener('click', () => { Sound.play('click'); czTower = type; redraw(); });
      tabs.append(b);
    }
    sk.append(tabs);
    const row = document.createElement('div'); row.className = 'cz-row';
    const cur = skinOf(czTower);
    option(row, skinIcon(czTower, null, 72), 'Factory', cur ? 'own' : 'on', () => { Sound.play('click'); delete look().skins[czTower]; saveMeta(); applyLooks(); redraw(); });
    for (const v of ['gold', 'winter', 'neon', 'scrap']) {
      const ok = skinOK(czTower, v), id = 'skin-' + v;
      const el = option(row, skinIcon(czTower, v, 72), SKIN_NAMES[v], cur === v ? 'on' : ok ? 'own' : 'buy', () => {
        if (ok) { Sound.play('click'); look().skins[czTower] = v; saveMeta(); applyLooks(); redraw(); } else pick(id, () => { look().skins[czTower] = v; });
      });
      if (!ok) el.querySelector('.cz-state').textContent = priceText(id);
    }
    sk.append(row);
    body.append(sk);
    // everything else: one row each
    for (const R of ROWS) {
      const g = document.createElement('section'); g.className = 'cz-group';
      g.innerHTML = `<h3>${R.title}</h3><p>${R.note}</p>`;
      const r = document.createElement('div'); r.className = 'cz-row';
      const curV = chosen(R.slot);
      option(r, R.art(null, 72), R.none, curV ? 'own' : 'on', () => { Sound.play('click'); look()[R.slot] = null; saveMeta(); applyLooks(); redraw(); });
      for (const v of R.opts) {
        const id = `${R.slot}-${v}`, ok = has(id);
        const el = option(r, R.art(v, 72), PRODUCTS[id].name, curV === v ? 'on' : ok ? 'own' : 'buy', () => pick(id, () => { look()[R.slot] = v; }));
        if (!ok) el.querySelector('.cz-state').textContent = priceText(id);
      }
      g.append(r);
      body.append(g);
    }
  }
  const czBack = () => (czFrom === 'store' ? showStore('premium') : showMenu());

  return {
    PRODUCTS, LOOKS, has, supporter, skinOf, outfit, tracer, bolt, flag, menuTheme, musicPack,
    coinMult, xpMult, maxSpeed, connect, testMode, priceText, buy, restore, resetTest, grant,
    applyLooks, renderStore, showCustomize, czBack,
  };
})();
