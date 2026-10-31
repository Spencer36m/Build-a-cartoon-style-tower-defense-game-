// Renders App Store screenshots into store/screenshots/.
// Needs Playwright with Chromium, and the game served on http://localhost:8765 (python3 -m http.server 8765).
// Usage: node scripts/screenshots.cjs
const { chromium } = require('playwright');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');

const OUT = join(__dirname, '..', 'store', 'screenshots');
const URL = process.env.URL || 'http://localhost:8765/';
// Landscape sizes App Store Connect accepts: iPhone 6.9" display and iPad 13" display.
const DEVICES = [
  { name: 'iphone-6.9', viewport: { width: 956, height: 440 }, scale: 3 },
  { name: 'ipad-13', viewport: { width: 1376, height: 1032 }, scale: 2 },
];

// Sets up a busy battle: upgraded towers of every kind mid-wave.
function battle(level, setup) {
  return ({ level, setup }) => {
    const Z = ZombieBash, S = Z.S, M = Z.meta;
    for (const k of Object.keys(Z.TOWERS)) { M.owned[k] = true; M.armory[k] = [5, 5, 5]; }
    for (let i = 0; i < 150; i++) M.stars[Z.LEVEL_META[i].id] = 3;
    M.coins = 2480;
    Z.startGame(level); S.cash = 1e6;
    const spots = [];
    for (let y = 1; y < 11; y++) for (let x = 1; x < 19; x++) {
      let near = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (S.M.grid[(y + dy) * 20 + x + dx] === 1) near++;
      if (near >= 2) spots.push([x, y]);
    }
    let si = 0;
    for (const [type, tiers] of setup) {
      let spot = null;
      if (Z.TOWERS[type].place === 'water' || type === 'farm') {
        for (let y = 0; y < 12 && !spot; y++) for (let x = 0; x < 20 && !spot; x++) if (Z.canPlaceAt(type, x, y)) spot = [x, y];
      } else { while (si < spots.length && !Z.canPlaceAt(type, ...spots[si])) si += 1; spot = spots[si]; si += 3; }
      if (!spot) continue;
      const t = Z.placeTower(type, spot[0], spot[1]);
      tiers.forEach((n, p) => { for (let k = 0; k < n; k++) Z.upgradeTower(t, p); });
    }
    S.cash = 2860; S.lives = 18;
    Z.startWave(); Z.startWave();
    for (let i = 0; i < 30 * 3; i++) Z.update(1 / 30);
    // pack the roads with a tough horde so the towers are mid-fight
    const pool = S.L.pool.map(([type]) => type).filter((type) => !Z.ZOMBIES[type].boss);
    for (let i = 0; i < 46; i++) {
      const route = S.M.paths[i % S.M.paths.length];
      const z = Z.spawnEnemy(pool[i % pool.length], S.wave + 14, route, route.total * (0.08 + (i / 46) * 0.86));
      z.hp = z.maxHp * (0.55 + Math.random() * 0.45);
    }
    for (let i = 0; i < 24; i++) Z.update(1 / 30);
    S.banner = null; S.fx = S.fx.filter((f) => f.kind !== 'text');
  };
}

const SCENES = [
  { file: '1-battle', level: 112, setup: [['gunner', [5, 2, 0]], ['gunner', [0, 5, 2]], ['tesla', [5, 0, 2]], ['mortar', [2, 0, 4]], ['sniper', [5, 2, 0]], ['cryo', [4, 2, 0]], ['gunner', [2, 0, 5]], ['flame', [3, 2, 0]], ['farm', [3, 0, 2]]] },
  { file: '2-upgrades', level: 63, setup: [['gunner', [0, 2, 4]], ['mortar', [4, 2, 0]], ['tesla', [2, 0, 3]], ['sniper', [0, 4, 2]], ['flame', [4, 0, 2]], ['gunner', [4, 0, 2]], ['heli', [2, 3, 0]]], select: 1 },
  { file: '3-armory', armory: 'gunner' },
  { file: '4-globe', globe: true },
  { file: '5-boss', level: 149, setup: [['gunner', [5, 2, 0]], ['jet', [2, 0, 4]], ['tesla', [2, 5, 0]], ['mortar', [5, 0, 2]], ['sniper', [5, 0, 2]], ['heli', [0, 4, 2]], ['cryo', [2, 0, 4]], ['gunner', [0, 5, 2]], ['farm', [0, 3, 0]]], boss: true },
];

(async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const dev of DEVICES) {
    for (const sc of SCENES) {
      const ctx = await browser.newContext({ viewport: dev.viewport, deviceScaleFactor: dev.scale, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      await page.goto(URL);
      await page.addStyleTag({ content: '#btn-full, .rotate-hint, .install-box { display: none !important; }' });
      await page.evaluate(() => { try { localStorage.setItem('zbash.hint', '1'); } catch (e) { /* ignore */ } document.body.classList.add('hint-dismissed'); });
      if (sc.armory) {
        await page.evaluate((type) => { const M = ZombieBash.meta; M.xp = { gunner: 2950, sniper: 1200, mortar: 640, tesla: 300 }; M.armory = { gunner: [5, 2, 3], sniper: [3, 3, 2] }; ZombieBash.showArmory(type); }, sc.armory);
        await page.click('.arm-row:nth-child(2) .arm-tile:nth-of-type(3)');
      } else if (sc.globe) {
        await page.evaluate(() => { const Z = ZombieBash; for (let i = 0; i < 120; i++) Z.meta.stars[Z.LEVEL_META[i].id] = 3; Z.meta.coins = 2480; Z.showWorlds(1); });
        await page.waitForTimeout(2500);
      } else {
        await page.evaluate(battle(sc.level, sc.setup), { level: sc.level, setup: sc.setup });
        if (sc.boss) await page.evaluate(() => { const Z = ZombieBash, S = Z.S; Z.spawnEnemy(S.L.boss || 'harvester', S.wave, S.M.paths[0], S.M.paths[0].total * 0.45); });
        if (sc.select != null) {
          const box = await page.$eval('#game', (c, i) => { const r = c.getBoundingClientRect(); const t = ZombieBash.S.towers[i]; return { x: r.left + c.clientLeft + (t.x / 960) * c.clientWidth, y: r.top + c.clientTop + (t.y / 576) * c.clientHeight }; }, sc.select);
          await page.mouse.click(box.x, box.y);
        }
        await page.waitForTimeout(120);
      }
      await page.screenshot({ path: join(OUT, `${dev.name}-${sc.file}.jpg`), type: 'jpeg', quality: 90 });
      await ctx.close();
    }
  }
  await browser.close();
  console.log('Screenshots written to', OUT);
})();
