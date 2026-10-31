'use strict';
// ============================================================
// Comms: the cast talking over the radio during a mission. A manga portrait card slides in at
// the top of the battlefield, the line types out with radio clicks, then it slides away.
// Lines queue up; tapping the card skips ahead. It never pauses the game.
// ============================================================
const Comms = (() => {
  const faces = new Map();
  let el = null, face = null, nameEl = null, tagEl = null, textEl = null;
  let queue = [], cur = null, raf = 0, hold = () => false;

  // a portrait painted once per speaker, in the same ink and screentone as the cutscenes
  function portrait(who) {
    if (faces.has(who)) return faces.get(who);
    const S = 160, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c = cv.getContext('2d'), M = MANGA, info = CAST[who] || CAST.voss;
    c.fillStyle = M.PAPER; c.fillRect(0, 0, S, S);
    try {
      if (who === 'vane') SCENES.vaneClose.base(c, S, S, { spot: 'red' });
      else if (who === 'kv') SCENES.radio.base(c, S, S, { red: true, ch: 'KV' });
      else {
        c.fillStyle = M.tone(c, 0.28, 4); c.fillRect(0, 0, S, S);
        M.focusLines(c, S * 0.5, S * 0.42, S, S, 50, S * 0.42, M.INK, 3);
        M.bust(c, who, S * 0.5, S * 0.46, S * 0.5, { ...info });
      }
    } catch (e) { console.error(e); }
    faces.set(who, cv);
    return cv;
  }

  function init(stage) {
    el = document.createElement('div'); el.className = 'comms'; el.hidden = true;
    el.innerHTML = '<canvas class="comms-face" width="160" height="160" aria-hidden="true"></canvas><div class="comms-body"><span class="comms-head"><b class="comms-name"></b><span class="comms-tag"></span></span><p class="comms-text"></p></div>';
    stage.append(el);
    face = el.querySelector('canvas'); nameEl = el.querySelector('.comms-name'); tagEl = el.querySelector('.comms-tag'); textEl = el.querySelector('.comms-text');
    el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); skip(); });
  }
  function setHold(fn) { hold = fn; }

  // who: a CAST key. o.tag: a small label after the name (the operation), o.delay: seconds to wait.
  function say(who, text, o = {}) {
    if (!el || !text) return;
    queue.push({ who, text, tag: o.tag || '', delay: o.delay || 0, sub: o.sub || '' });
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function clear() { queue = []; cur = null; if (el) { el.hidden = true; el.classList.remove('in'); } }
  function skip() {
    if (!cur) return;
    if (cur.shown < cur.full.length) cur.shown = cur.full.length;
    else cur.until = 0;
  }

  let last = 0;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    if (hold()) return;
    if (!cur) {
      if (!queue.length) { cancelAnimationFrame(raf); raf = 0; last = 0; return; }
      const q = queue[0];
      if (q.delay > 0) { q.delay -= dt; return; }
      queue.shift();
      start(q);
      return;
    }
    if (cur.shown < cur.full.length) {
      const before = Math.floor(cur.shown);
      cur.shown = Math.min(cur.full.length, cur.shown + dt * 46);
      const n = Math.floor(cur.shown);
      if (n !== before) {
        textEl.textContent = cur.full.slice(0, n);
        if (n % 3 === 0 && typeof Sound !== 'undefined') Sound.play('type');
      }
      if (cur.shown >= cur.full.length) { textEl.textContent = cur.full; cur.until = 1.6 + cur.full.split(' ').length * 0.24; }
    } else {
      textEl.textContent = cur.full;
      cur.until -= dt;
      if (cur.until <= 0) {
        el.classList.remove('in');
        const done = cur; cur = null;
        setTimeout(() => { if (!cur && done) el.hidden = true; }, 260);
      }
    }
  }
  function start(q) {
    const info = CAST[q.who] || CAST.voss;
    cur = { ...q, full: q.text, shown: 0, until: 99 };
    const src = portrait(q.who), g = face.getContext('2d');
    g.clearRect(0, 0, 160, 160); g.drawImage(src, 0, 0);
    nameEl.textContent = info.name;
    tagEl.textContent = q.tag;
    textEl.textContent = '';
    el.classList.toggle('radio', !!info.radio);
    el.classList.toggle('villain', q.who === 'vane' || q.who === 'kv' || q.who === 'crane');
    el.hidden = false; void el.offsetWidth; el.classList.add('in');
    if (typeof Sound !== 'undefined') Sound.play('static');
  }

  return { init, say, clear, setHold, portrait, get busy() { return !!cur || queue.length > 0; } };
})();
