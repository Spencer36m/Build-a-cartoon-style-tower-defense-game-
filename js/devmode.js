'use strict';
// ============================================================
// Developer mode: for testing the whole game without earning it first. Tap the Zombie Bash
// title on the main menu five times quickly (or open the game with ?dev in the address) to
// bring up the panel. With developer mode on, every level, world, tower, upgrade tier, story
// chapter and wonder expedition is open and wonder powers never run out. Real progress
// (stars, coins, keys) is left alone, so turning it off puts the game back as it was.
// ============================================================
const DEV = (() => {
  let taps = 0, tapT = 0;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  function badge() {
    const b = $('#dev-chip');
    if (b) b.hidden = !meta.dev;
  }
  function toast(text) {
    const t = $('#dev-note');
    if (t) { t.textContent = text; t.hidden = false; }
    Sound.play('unlock');
  }
  function render() {
    const box = $('#dev-actions');
    box.innerHTML = '';
    const sw = el('button', 'sb-toggle dev-toggle', `<span class="sb-knob"></span><span>Developer mode: ${meta.dev ? 'on' : 'off'}</span>`);
    sw.type = 'button'; sw.setAttribute('aria-pressed', String(!!meta.dev));
    sw.addEventListener('click', () => { meta.dev = !meta.dev; saveMeta(); badge(); render(); toast(meta.dev ? 'Everything is open.' : 'Back to your real progress.'); });
    box.append(sw);
    const act = (label, fn) => { const b = el('button', 'btn', label); b.type = 'button'; b.addEventListener('click', fn); box.append(b); };
    act('+100,000 coins', () => { meta.coins += 100000; saveMeta(); toast(`You have ${fmtNum(meta.coins)} coins.`); });
    act('Max out the Armory', () => {
      for (const k of TOWER_KEYS) { meta.armory[k] = [5, 5, 5]; meta.owned[k] = true; meta.xp[k] = Math.max(meta.xp[k] || 0, 50000); }
      saveMeta(); toast('Every tower and every upgrade tier is unlocked.');
    });
    act('Find every wonder', () => { Globe.findAll(); toast('All 20 wonders are marked as found.'); });
    act('Own every premium item (test)', () => {
      for (const [id, p] of Object.entries(PREMIUM.PRODUCTS)) if (p.kind === 'once') PREMIUM.grant(id, true);
      saveMeta(); PREMIUM.applyLooks(); toast('Every premium item is yours, in test mode.');
    });
    act('Refill supplies', () => { for (const k of Object.keys(SUPPLIES)) meta.items[k] = Math.max(meta.items[k] | 0, 99); saveMeta(); toast('99 of every supply.'); });
  }
  function open() {
    $('#dev-note').hidden = true;
    render();
    $('#dev-screen').hidden = false;
    Sound.play('open');
  }
  function close() { $('#dev-screen').hidden = true; showMenu(); }
  function init() {
    const title = $('.brand h1');
    title.addEventListener('click', () => {
      const now = performance.now();
      taps = now - tapT < 700 ? taps + 1 : 1; tapT = now;
      if (taps >= 5) { taps = 0; open(); }
    });
    $('#dev-chip').addEventListener('click', open);
    $('#dev-close').addEventListener('click', close);
    badge();
    if (/[?&]dev\b/.test(location.search)) setTimeout(open, 300);
  }
  init();
  return { open, badge };
})();
