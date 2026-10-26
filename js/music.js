'use strict';
// ============================================================
// Music: a main theme for the menus and a theme of its own for each world, every one with
// its own instruments, tempo and feel. Farmland is a bluegrass hoedown, the cemetery a
// skeleton waltz, the tundra an icy echo and the bayou a swamp-blues shuffle. Within a
// song the arrangement thins out or fills in with the action:
// story < calm < tension < battle < boss.
// Everything is made from oscillators, noise and plucked-string buffers (Karplus-Strong),
// so the game still ships no audio files.
// ============================================================
const MUSIC = (() => {
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const LEVEL = { story: 0, calm: 1, tension: 2, battle: 3, boss: 4, menu: 3 };
  const CHORDS = { m: [0, 3, 7], M: [0, 4, 7], m7: [0, 3, 7, 10], 7: [0, 4, 7, 10] };
  const WORLD_SONGS = ['farm', 'grave', 'tundra', 'swamp'];

  let ac = null, out = null, verb = null, noise = null, ch = {}, echo = null, waves = {}, plucks = {}, held = [];

  // ---------- wiring ----------
  function attach(context, bus, reverb, noiseBuf) {
    ac = context; out = bus; verb = reverb; noise = noiseBuf; waves = {}; plucks = {}; held = [];
    // each part sits in its own place in the stereo field
    const lane = (pan, vol = 1) => {
      const g = ac.createGain(); g.gain.value = vol;
      if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(out); } else g.connect(out);
      return g;
    };
    ch = { bass: lane(0), pad: lane(0), comp: lane(-0.28), arp: lane(0.3), lead: lane(0.08), drum: lane(0), hat: lane(0.22) };
    // a filtered feedback echo, timed to each song's beat
    const inp = ac.createGain(), dl = ac.createDelay(2), fb = ac.createGain(), lp = ac.createBiquadFilter(), wet = ac.createGain();
    dl.delayTime.value = 0.4; fb.gain.value = 0.38; lp.type = 'lowpass'; lp.frequency.value = 2600; wet.gain.value = 0.55;
    inp.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet);
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = -0.35; wet.connect(p); p.connect(out); } else wet.connect(out);
    echo = { inp, dl };
  }
  const songFor = (mode, world) => (mode === 'menu' ? 'menu' : WORLD_SONGS[world] || 'farm');
  function stepDur(id, mode) {
    const S = SONGS[id];
    return 60 / (S.bpm * (mode === 'boss' ? 1.08 : 1)) / S.spb;
  }
  // a new song: let the old drones and pads fade instead of ringing on under it
  function change(id, now) {
    for (const h of held) {
      if (h.end <= now) continue;
      const p = h.g.gain;
      if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(now); else { p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); }
      p.setTargetAtTime(0.0001, now, 0.25);
    }
    held = [];
    const S = SONGS[id];
    if (echo) echo.dl.delayTime.setValueAtTime((S.echo || 0.75) * 60 / S.bpm, now);
    S.last = null;
  }

  // ---------- instruments ----------
  function sends(g, o) {
    if (o.verb) { const s = ac.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(verb); }
    if (o.echo) { const s = ac.createGain(); s.gain.value = o.echo; g.connect(s); s.connect(echo.inp); }
  }
  // One oscillator note. o: wave, at (attack), rel (sustained, then this release), cut/cutTo (lowpass sweep),
  // q, bp (bandpass instead), vib (depth as a fraction of the pitch), vibRate, vibAt, glide (from midi), det, verb, echo.
  function note(dest, midi, t, len, vol, o = {}) {
    const osc = ac.createOscillator(), g = ac.createGain(), f = hz(midi);
    if (o.wave && typeof o.wave !== 'string') osc.setPeriodicWave(o.wave); else osc.type = o.wave || 'sine';
    if (o.glide != null && o.glide !== midi) { osc.frequency.setValueAtTime(hz(o.glide), t); osc.frequency.exponentialRampToValueAtTime(f, t + (o.glideT || 0.06)); } else osc.frequency.setValueAtTime(f, t);
    if (o.det) osc.detune.value = o.det;
    const a = o.at || 0.005;
    const hold = Math.max(a + 0.01, len), end = t + hold + (o.rel || 0);
    if (o.vib) {
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = o.vibRate || 5.5;
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * o.vib, t + (o.vibAt || 0.15));
      l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(end + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a);
    if (o.rel) g.gain.exponentialRampToValueAtTime(vol * (o.sus || 0.75), t + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    let src = osc;
    if (o.cut || o.bp) {
      const flt = ac.createBiquadFilter();
      flt.type = o.bp ? 'bandpass' : 'lowpass'; flt.Q.value = o.q || (o.bp ? 1.2 : 0.8);
      flt.frequency.setValueAtTime(o.bp || o.cut, t);
      if (o.cutTo) flt.frequency.exponentialRampToValueAtTime(o.cutTo, t + (o.cutT || hold));
      osc.connect(flt); src = flt;
    }
    src.connect(g); g.connect(dest); sends(g, o);
    osc.start(t); osc.stop(end + 0.05);
    if (o.held) held.push({ g, end });
    return g;
  }
  function noiseHit(dest, t, len, vol, type, f, o = {}) {
    const src = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noise; src.playbackRate.value = o.rate || 1;
    flt.type = type; flt.frequency.setValueAtTime(f, t); flt.Q.value = o.q || 0.7;
    if (o.to) flt.frequency.exponentialRampToValueAtTime(o.to, t + len);
    const a = o.at || 0.001;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(len, a + 0.005));
    src.connect(flt); flt.connect(g); g.connect(dest); sends(g, o);
    src.start(t, Math.random() * 1.5); src.stop(t + len + 0.05);
  }
  // harmonic recipes for the organ, accordion, harmonica, flute and theremin
  const WAVES = {
    organ: [1, 0.85, 0.55, 0.6, 0, 0.4, 0, 0.3],
    reed: [1, 0.7, 0.8, 0.45, 0.55, 0.3, 0.35, 0.2, 0.22, 0.12, 0.1],
    harp: [1, 0.35, 0.6, 0.18, 0.4, 0.1, 0.25, 0.06, 0.12],
    flute: [1, 0.22, 0.07, 0.03],
    theremin: [1, 0.1, 0.04],
    horn: [1, 0.75, 0.55, 0.4, 0.3, 0.22, 0.15, 0.1],
  };
  function wave(name) {
    if (waves[name]) return waves[name];
    const h = WAVES[name], re = new Float32Array(h.length + 1), im = new Float32Array(h.length + 1);
    h.forEach((v, i) => { im[i + 1] = v; });
    return (waves[name] = ac.createPeriodicWave(re, im));
  }
  // Plucked strings: a burst of noise circulating through a damped delay line. damp near 0.5 is
  // warm and quick to fade, lower is brighter; tone darkens the burst itself.
  const STRINGS = {
    banjo: { len: 0.6, decay: 0.996, damp: 0.22, tone: 0.9 },
    harpsi: { len: 0.9, decay: 0.998, damp: 0.16, tone: 1 },
    guitar: { len: 1.3, decay: 0.998, damp: 0.45, tone: 0.45 },
    slide: { len: 1.6, decay: 0.999, damp: 0.38, tone: 0.55 },
    bass: { len: 1.1, decay: 0.997, damp: 0.5, tone: 0.25 },
  };
  function stringBuf(kind, midi) {
    const k = kind + midi;
    if (plucks[k]) return plucks[k];
    const P = STRINGS[kind], sr = 22050, f = hz(midi);
    const N = Math.max(2, Math.floor(sr / f + P.damp)), n = Math.floor(sr * P.len);
    const buf = ac.createBuffer(1, n, sr), d = buf.getChannelData(0), r = new Float32Array(N);
    let lp = 0, mean = 0;
    for (let i = 0; i < N; i++) { lp += (Math.random() * 2 - 1 - lp) * P.tone; r[i] = lp; mean += lp; }
    mean /= N;
    for (let i = 0; i < N; i++) r[i] -= mean;
    let p = 0, peak = 0.001;
    for (let i = 0; i < n; i++) {
      const a = r[p], b = r[p + 1 === N ? 0 : p + 1];
      d[i] = a; if (Math.abs(a) > peak) peak = Math.abs(a);
      r[p] = P.decay * ((1 - P.damp) * a + P.damp * b);
      p = p + 1 === N ? 0 : p + 1;
    }
    for (let i = 0; i < n; i++) d[i] /= peak;
    buf.rate = (f * (N - P.damp)) / sr; // blending in the next sample shortens the loop by damp; this tunes it exactly
    return (plucks[k] = buf);
  }
  function pluck(dest, kind, midi, t, vol, o = {}) {
    const src = ac.createBufferSource(), g = ac.createGain(), m = Math.round(midi);
    const buf = src.buffer = stringBuf(kind, m), rate = buf.rate;
    if (o.slide) { src.playbackRate.setValueAtTime(rate * Math.pow(2, -o.slide / 12), t); src.playbackRate.exponentialRampToValueAtTime(rate, t + (o.slideT || 0.09)); } else src.playbackRate.setValueAtTime(rate, t);
    const end = t + Math.min(o.len || 9, buf.duration / rate);
    if (o.vib) {
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = o.vibRate || 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(rate * o.vib, t + 0.25);
      l.connect(lg); lg.connect(src.playbackRate); l.start(t); l.stop(end + 0.1);
    }
    g.gain.setValueAtTime(vol, t);
    if (o.len) { g.gain.setValueAtTime(vol, Math.max(t, end - 0.06)); g.gain.exponentialRampToValueAtTime(0.0001, end); }
    src.connect(g); g.connect(dest); sends(g, o);
    src.start(t); src.stop(end + 0.05);
  }
  // a strummed chord, low string first
  function strum(dest, kind, notes, t, vol, o = {}, gap = 0.012) { notes.forEach((m, i) => pluck(dest, kind, m, t + i * gap, vol, o)); }
  // FM bell: glockenspiel, tubular bell or ice crystals depending on the ratio
  function bell(dest, midi, t, len, vol, ratio = 3.5, index = 2, o = {}) {
    const f = hz(midi), c = ac.createOscillator(), m = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
    c.frequency.value = f; m.frequency.value = f * ratio;
    mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(f * 0.02 + 0.01, t + len * 0.7);
    m.connect(mg); mg.connect(c.frequency); c.connect(g); g.connect(dest); sends(g, o);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    c.start(t); m.start(t); c.stop(t + len + 0.05); m.stop(t + len + 0.05);
  }
  // wooden bars: the skeleton xylophone
  function xylo(dest, midi, t, vol, o = {}) {
    note(dest, midi, t, 0.38, vol, { ...o });
    note(dest, midi + 19.02, t, 0.07, vol * 0.35);
    noiseHit(dest, t, 0.025, vol * 0.5, 'bandpass', hz(midi) * 4, { q: 2 });
  }
  // a music box / celesta
  function celesta(dest, midi, t, vol, o = {}) {
    note(dest, midi, t, 1.1, vol, o);
    note(dest, midi + 24, t, 0.25, vol * 0.22);
    note(dest, midi + 12, t, 0.5, vol * 0.15);
  }
  // ---------- drums ----------
  function kick(t, vol, hi = 120, lo = 42, len = 0.32) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(hi, t); o.frequency.exponentialRampToValueAtTime(lo, t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(ch.drum); o.start(t); o.stop(t + len + 0.05);
    noiseHit(ch.drum, t, 0.02, vol * 0.25, 'lowpass', 3000);
  }
  function snare(t, vol, o = {}) {
    noiseHit(ch.drum, t, o.len || 0.17, vol, 'bandpass', o.f || 1900, { q: 0.6, verb: o.verb || 0.15 });
    note(ch.drum, o.tone || 55, t, 0.07, vol * 0.4, { wave: 'triangle' });
  }
  const brush = (t, vol) => noiseHit(ch.drum, t, 0.16, vol, 'bandpass', 3200, { q: 0.5, at: 0.02 });
  const hat = (t, vol, len = 0.04) => noiseHit(ch.hat, t, len, vol, 'highpass', 8000);
  const shaker = (t, vol) => noiseHit(ch.hat, t, 0.07, vol, 'highpass', 6500, { at: 0.02 });
  function clap(t, vol) { for (let i = 0; i < 3; i++) noiseHit(ch.drum, t + i * 0.011, 0.02, vol, 'bandpass', 1300, { q: 1.2 }); noiseHit(ch.drum, t + 0.033, 0.14, vol * 0.7, 'bandpass', 1300, { q: 1, verb: 0.3 }); }
  function tom(t, midi, vol, len = 0.45, o = {}) {
    const f = hz(midi), osc = ac.createOscillator(), g = ac.createGain();
    osc.frequency.setValueAtTime(f * 1.5, t); osc.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(g); g.connect(ch.drum); sends(g, o); osc.start(t); osc.stop(t + len + 0.05);
    noiseHit(ch.drum, t, 0.05, vol * 0.3, 'lowpass', 900);
  }
  // a taiko drum: deep, long and roomy
  function taiko(t, vol) {
    tom(t, 30, vol, 0.9, { verb: 0.4 });
    noiseHit(ch.drum, t, 0.25, vol * 0.4, 'lowpass', 420, { verb: 0.3 });
  }
  const wood = (t, vol, f = 1900) => noiseHit(ch.hat, t, 0.035, vol, 'bandpass', f, { q: 6 });
  function washboard(t, vol) { for (let i = 0; i < 3; i++) noiseHit(ch.hat, t + i * 0.007, 0.012, vol, 'highpass', 4500); }
  function tamb(t, vol) { noiseHit(ch.hat, t, 0.16, vol, 'highpass', 7500, { q: 1.5 }); }
  const cymbal = (t, vol) => noiseHit(ch.hat, t, 1.6, vol, 'highpass', 5500, { verb: 0.3 });

  // the melody note starting on this step, if any
  function tuneAt(S, b, s) {
    if (!S.map) S.map = S.tune.map((bar) => { const m = {}; for (const [st, semi, len] of bar) m[st] = [semi, len]; return m; });
    return S.map[b][s];
  }

  // ---------- the songs ----------
  const SONGS = {
    // The main theme: a creeping cartoon-horror march. Pizzicato oom-pah under a theremin.
    menu: {
      key: 50, bpm: 104, beats: 4, spb: 4, swing: 0.1, echo: 0.75,
      prog: [[0, 'm'], [0, 'm'], [8, 'M'], [7, 'M'], [0, 'm'], [5, 'm'], [7, 'M'], [7, '7']],
      tune: [
        [[0, 0, 2], [2, 3, 2], [4, 7, 4], [8, 6, 2], [10, 7, 2], [12, 3, 4]],
        [[0, 2, 2], [2, 3, 2], [4, 0, 8]],
        [[0, 3, 2], [2, 0, 2], [4, -2, 4], [8, 0, 2], [10, 3, 2], [12, 5, 4]],
        [[0, 2, 6], [6, -1, 2], [8, 2, 2], [10, 7, 6]],
        [[0, 7, 2], [2, 7, 2], [4, 8, 2], [6, 7, 2], [8, 3, 4], [12, 0, 4]],
        [[0, 5, 4], [4, 8, 2], [6, 7, 2], [8, 5, 4], [12, 3, 2], [14, 2, 2]],
        [[0, -1, 4], [4, 2, 4], [8, 7, 4], [12, 2, 2], [14, -1, 2]],
        [[0, -5, 8], [10, -1, 2], [12, 2, 2], [14, -1, 2]],
      ],
      play(x, S) {
        const { t, dur, s, b, phrase, root, chord, key } = x, R = key + root;
        if (s === 0 || s === 8) {
          pluck(ch.bass, 'bass', R - 12 + (s === 8 ? 7 : 0), t, 0.55, { len: dur * 5 });
          note(ch.bass, R - 12 + (s === 8 ? 7 : 0), t, dur * 3, 0.1);
        }
        if (s === 4 || s === 12) strum(ch.comp, 'harpsi', chord.slice(0, 3).map((iv) => R + 12 + iv), t, 0.09, { len: dur * 1.6 });
        if (phrase % 2 && s % 2 === 0) celesta(ch.arp, R + 24 + chord[(s / 2 + b) % 3] + (s >= 8 ? 12 : 0), t, 0.03, { echo: 0.3 });
        if (s === 0) kick(t, 0.26);
        if (s === 8 && b % 2) kick(t, 0.18);
        if (s === 4 || s === 12) clap(t, 0.12);
        if (s % 4 === 2) shaker(t, 0.05);
        if (b === 7 && s >= 12) tom(t, 50 - (s - 12) * 3, 0.22);
        if (b === 0 && s === 0 && phrase) cymbal(t, 0.05);
        const n = tuneAt(S, b, s);
        if (n) {
          const m = key + 12 + n[0], len = n[1] * dur;
          if (phrase % 2 === 0) note(ch.lead, m, t, len * 0.92, 0.11, { wave: wave('theremin'), at: 0.05, rel: 0.12, vib: 0.013, vibRate: 6.2, vibAt: 0.25, glide: S.last, glideT: 0.08, verb: 0.35, echo: 0.22 });
          else bell(ch.lead, m + 12, t, 1.4, 0.07, 3.5, 1.6, { verb: 0.3, echo: 0.2 });
          S.last = m;
        }
      },
    },

    // Farmland: a bluegrass hoedown in A minor. Banjo rolls, boom-chick bass and guitar, a fiddle on top.
    farm: {
      key: 45, bpm: 128, beats: 4, spb: 4, swing: 0, echo: 0.5,
      prog: [[0, 'm'], [0, 'm'], [10, 'M'], [10, 'M'], [3, 'M'], [10, 'M'], [7, 'm'], [0, 'm']],
      tune: [
        [[0, 0, 3], [3, 3, 1], [4, 5, 2], [6, 7, 2], [8, 10, 4], [12, 7, 4]],
        [[0, 5, 2], [2, 3, 2], [4, 0, 4], [8, -2, 2], [10, 0, 2], [12, 3, 4]],
        [[0, -2, 4], [4, 2, 2], [6, 5, 2], [8, 2, 4], [12, -2, 4]],
        [[0, -2, 2], [2, -5, 2], [4, -2, 4], [8, 0, 8]],
        [[0, 7, 2], [2, 7, 2], [4, 3, 2], [6, 7, 2], [8, 12, 4], [12, 10, 4]],
        [[0, 10, 2], [2, 7, 2], [4, 5, 4], [8, 2, 2], [10, 5, 2], [12, 7, 4]],
        [[0, 7, 4], [4, 10, 2], [6, 7, 2], [8, 2, 4], [12, -5, 4]],
        [[0, 0, 8], [8, 3, 2], [10, 2, 2], [12, 0, 4]],
      ],
      roll: [0, 2, 3, 1, 2, 4, 0, 3],
      play(x, S) {
        const { t, dur, s, b, lvl, root, chord, key, boss } = x, R = key + root;
        const third = chord[1];
        // bass: root and fifth on the beat (walking on every beat for a boss)
        if (lvl >= 1 && (s === 0 || s === 8 || (boss && s % 4 === 0))) {
          const walk = boss ? [0, third, 7, 5][s / 4] : s === 8 ? 7 : 0;
          pluck(ch.bass, 'bass', R - 12 + walk, t, 0.6, { len: dur * 3.5 });
        }
        // guitar: the chick on the backbeat, a full ring in the quiet bits
        if (lvl >= 1 && (s === 4 || s === 12)) strum(ch.comp, 'guitar', [R, R + 7, R + 12, R + 12 + third], t, 0.085, { len: dur * 1.7 });
        if (lvl === 0 && s % 4 === 0) pluck(ch.comp, 'guitar', R + [0, 7, 12, 12 + third][s / 4], t, 0.13, { verb: 0.2 });
        // banjo: the three-against-four forward roll
        if (lvl >= 1 && (lvl >= 2 || s % 2 === 0)) {
          const tones = [R + 7 - 12, R, R + third, R + 7, R + 12];
          pluck(ch.arp, 'banjo', tones[S.roll[s % 8]] + 12, t, lvl >= 3 ? 0.075 : 0.06);
        }
        // fiddle
        const n = tuneAt(S, b, s);
        if (n && lvl !== 2) {
          const m = key + 24 + n[0], len = n[1] * dur, vol = lvl >= 3 ? 0.075 : 0.055;
          const fid = { wave: 'sawtooth', cut: 2400, q: 1.6, at: 0.04, rel: 0.09, vib: 0.007, vibRate: 5.8, vibAt: 0.22, glide: n[1] >= 4 ? m - 1 : null, glideT: 0.05, verb: 0.25 };
          note(ch.lead, m, t, len * 0.9, vol, fid);
          note(ch.lead, m, t, len * 0.9, vol * 0.45, { ...fid, det: 9, glide: null });
          if (boss) note(ch.lead, m - 12, t, len * 0.9, vol * 0.55, { ...fid, glide: null });
        }
        // a jaw harp twang at the end of a line
        if (lvl >= 3 && (b === 3 || b === 7) && s === 14) note(ch.comp, R - 12, t, dur * 2, 0.06, { wave: 'sawtooth', bp: 600, cutTo: 1800, cutT: dur * 2, q: 6 });
        // drums
        if (lvl >= 2 && (s === 0 || s === 8 || (boss && s % 4 === 0))) kick(t, lvl >= 3 ? 0.28 : 0.18);
        if (lvl >= 3 && (s === 4 || s === 12)) { brush(t, 0.14); if (boss) snare(t, 0.12); }
        if (lvl >= 3 && s % 2) shaker(t, s % 4 === 3 ? 0.045 : 0.03);
        if (lvl >= 3 && b === 7 && s >= 12) snare(t, 0.06 + (s - 12) * 0.025);
      },
    },

    // Cemetery: a skeleton waltz in D harmonic minor. Organ, harpsichord oom-pah-pah, bones on the xylophone.
    grave: {
      key: 50, bpm: 138, beats: 3, spb: 4, swing: 0, echo: 0.5,
      prog: [[0, 'm'], [8, 'M'], [5, 'm'], [7, 'M'], [0, 'm'], [8, 'M'], [7, '7'], [0, 'm']],
      tune: [
        [[0, 0, 4], [4, 3, 2], [6, 7, 2], [8, 12, 4]],
        [[0, 10, 4], [4, 8, 4], [8, 5, 4]],
        [[0, 3, 4], [4, 5, 4], [8, 8, 4]],
        [[0, 7, 6], [6, 6, 2], [8, 7, 2], [10, 9, 2]],
        [[0, 12, 4], [4, 10, 2], [6, 7, 2], [8, 3, 4]],
        [[0, 5, 2], [2, 3, 2], [4, 2, 4], [8, 3, 4]],
        [[0, 1, 4], [4, 2, 4], [8, 7, 4]],
        [[0, 0, 8]],
      ],
      play(x, S) {
        const { t, dur, s, b, lvl, root, chord, key, boss, per } = x, R = key + root;
        // a church bell tolls at the top of every phrase (every other bar in a boss fight)
        if (s === 0 && (b === 0 || (boss && b % 2 === 0))) bell(ch.pad, key + 12, t, 4.5, 0.08, 2.76, 3, { verb: 0.6 });
        // organ: soft held chords, a full swell for a boss
        if (s === 0 && lvl !== 3) {
          const ov = lvl >= 4 ? 0.035 : lvl ? 0.022 : 0.032;
          for (const iv of chord.slice(0, 3)) note(ch.pad, R + 12 + iv, t, dur * per * 0.95, ov, { wave: wave('organ'), at: 0.08, rel: 0.15, vib: 0.004, vibRate: 6.6, verb: 0.45, held: true });
          if (boss) note(ch.pad, R - 12, t, dur * per * 0.95, 0.06, { wave: wave('organ'), at: 0.05, rel: 0.1, held: true });
        }
        // waltz: a low pizzicato on one, harpsichord on two and three
        if (lvl >= 1 && s === 0) { pluck(ch.bass, 'bass', R - 12, t, 0.6, { len: dur * 4 }); note(ch.bass, R - 12, t, dur * 3, 0.09); }
        if (lvl >= 1 && (s === 4 || s === 8)) strum(ch.comp, 'harpsi', chord.slice(0, 3).map((iv) => R + 12 + iv), t, lvl >= 3 ? 0.075 : 0.055, { len: dur * 2 }, 0.008);
        // tension: a running harpsichord figure instead of the tune
        if (lvl === 2 && s % 2 === 0) pluck(ch.arp, 'harpsi', R + 24 + [0, 7, 12, 7, chord[1] + 12, 7][s / 2], t, 0.06);
        const n = tuneAt(S, b, s);
        if (n && lvl !== 2) {
          const m = key + 24 + n[0];
          if (lvl <= 1) celesta(ch.lead, m, t, 0.06, { verb: 0.4, echo: 0.15 });
          else xylo(ch.lead, m, t, 0.12, { verb: 0.2 });
          if (boss) note(ch.lead, m - 12, t, n[1] * dur * 0.9, 0.05, { wave: wave('organ'), at: 0.02, rel: 0.1, verb: 0.4 });
        }
        // bones and kettle drums
        if (lvl >= 3 && s === 0) tom(t, R - 12, 0.3, 0.7, { verb: 0.25 });
        if (lvl >= 3 && (s === 4 || s === 8)) wood(t, 0.12, 2300);
        if (lvl >= 3 && (s === 6 || s === 10)) wood(t, 0.07, 1700);
        if (boss && s === 0) kick(t, 0.25);
        if (boss && s === 8) snare(t, 0.13, { verb: 0.3 });
        if (lvl >= 3 && b === 7 && s >= 6) tom(t, key - 12 + 7, 0.08 + (s - 6) * 0.03, 0.3);
        if (lvl >= 2 && s % 4 === 2) hat(t, 0.02);
      },
    },

    // Tundra: a slow, icy E minor. A low drone, glass arpeggios ringing into a long echo,
    // a breathy flute, and taiko drums once the fighting starts.
    tundra: {
      key: 52, bpm: 80, beats: 4, spb: 4, swing: 0, echo: 0.75,
      prog: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M'], [0, 'm'], [8, 'M'], [5, 'm'], [7, 'M']],
      tune: [
        [[0, 7, 6], [6, 5, 2], [8, 3, 8]],
        [[0, 0, 6], [6, 3, 2], [8, 7, 8]],
        [[0, 10, 6], [6, 7, 2], [8, 3, 4], [12, 5, 4]],
        [[0, 5, 12], [12, 2, 4]],
        [[0, 12, 6], [6, 10, 2], [8, 7, 8]],
        [[0, 15, 6], [6, 14, 2], [8, 12, 8]],
        [[0, 12, 4], [4, 10, 4], [8, 8, 4], [12, 5, 4]],
        [[0, 7, 4], [4, 11, 4], [8, 7, 8]],
      ],
      play(x, S) {
        const { t, dur, s, b, lvl, root, chord, key, boss, phrase, per } = x, R = key + root;
        // the drone: low E and B, four bars at a time
        if (s === 0 && b % 4 === 0) {
          note(ch.pad, key - 12, t, dur * per * 4, 0.07, { at: 1.2, rel: 1.2, held: true });
          note(ch.pad, key - 5, t, dur * per * 4, 0.03, { wave: 'triangle', at: 1.5, rel: 1.2, cut: 600, held: true });
        }
        // an open, airy pad: root, fifth and ninth
        if (s === 0) for (const iv of [0, 7, 14]) note(ch.pad, R + 12 + iv, t, dur * per, 0.022, { wave: 'triangle', at: dur * per * 0.35, rel: dur * per * 0.4, cut: 900, cutTo: 2200, det: iv === 7 ? -7 : 6, verb: 0.5, held: true });
        // glass: ice crystals ringing into the echo
        const every = lvl >= 2 ? 1 : lvl === 1 ? 2 : 4;
        if (s % every === 0) {
          const ice = [0, 7, 12, chord[1] + 12, 19, 14, 12, 7], i = (s / every + b) % ice.length;
          bell(ch.arp, R + 24 + ice[i], t, 1.2, lvl >= 3 ? 0.026 : 0.034, 1.41, 0.9, { echo: 0.45, verb: 0.3 });
        }
        // bass: a long note when calm, pulsing eighths once it is tense
        if (lvl === 1 && s === 0) note(ch.bass, R - 12, t, dur * per * 0.9, 0.11, { wave: 'triangle', at: 0.2, rel: 0.4, cut: 500 });
        if (lvl >= 2 && s % 2 === 0) { note(ch.bass, R - 12, t, dur * 1.6, 0.13, { wave: 'sawtooth', cut: 380, q: 2 }); note(ch.bass, R, t, dur * 1.4, 0.04, { wave: 'sawtooth', cut: 1200 }); }
        // flute (a horn underneath for a boss)
        const n = tuneAt(S, b, s);
        if (n && lvl !== 2) {
          const m = key + 12 + n[0] + (lvl >= 3 ? 12 : 0), len = n[1] * dur;
          note(ch.lead, m, t, len * 0.9, lvl >= 3 ? 0.075 : 0.065, { wave: wave('flute'), at: 0.09, rel: 0.35, vib: 0.009, vibRate: 5, vibAt: 0.4, glide: S.last, glideT: 0.1, verb: 0.5, echo: 0.3 });
          noiseHit(ch.lead, t, 0.14, 0.018, 'bandpass', hz(m) * 2, { q: 2, at: 0.03 });
          if (boss) note(ch.lead, m - 24, t, len * 0.9, 0.06, { wave: wave('horn'), at: 0.06, rel: 0.2, cut: 900, verb: 0.4 });
          S.last = m;
        }
        // drums: taiko in half time, frost-crack backbeat, ice hats
        if (lvl >= 3 && (s === 0 || s === 6 || s === 10 || (boss && (s === 3 || s === 12 || s === 14)))) taiko(t, s === 0 ? 0.42 : 0.3);
        if (lvl === 2 && (s === 0 || s === 8)) taiko(t, 0.28);
        if (lvl >= 3 && s === 8) snare(t, 0.15, { f: 3400, len: 0.22, verb: 0.45 });
        if (lvl >= 2 && (lvl >= 3 || s % 2 === 0)) hat(t, s % 4 === 2 ? 0.035 : 0.018);
        if (lvl >= 3 && b === 7 && s >= 12) tom(t, 45 - (s - 12) * 2, 0.22, 0.4, { verb: 0.3 });
        if (b === 0 && s === 0 && phrase && lvl >= 3) cymbal(t, 0.06);
      },
    },

    // Bayou: a swamp-blues shuffle in G minor. Boogie bass, accordion on the off-beats,
    // slide guitar (a harmonica when it is calm), stomps and a washboard.
    swamp: {
      key: 43, bpm: 96, beats: 4, spb: 3, swing: 0, echo: 0.67,
      prog: [[0, 'm7'], [0, 'm7'], [5, 'm7'], [0, 'm7'], [7, '7'], [5, 'm7'], [0, 'm7'], [7, '7']],
      tune: [
        [[0, 0, 2], [2, 3, 1], [3, 5, 2], [5, 6, 1], [6, 7, 5]],
        [[0, 10, 2], [2, 7, 1], [3, 5, 3], [6, 3, 2], [8, 0, 4]],
        [[0, 5, 3], [3, 3, 2], [5, 5, 1], [6, 10, 3], [9, 7, 3]],
        [[0, 3, 2], [2, 0, 4], [6, -2, 2], [8, 0, 4]],
        [[0, 7, 3], [3, 6, 2], [5, 7, 1], [6, 11, 3], [9, 10, 3]],
        [[0, 10, 2], [2, 8, 1], [3, 5, 3], [6, 3, 3], [9, 5, 3]],
        [[0, 0, 6], [6, 3, 2], [8, 0, 1], [9, -2, 3]],
        [[0, -5, 3], [3, -2, 3], [6, -1, 3], [9, 2, 3]],
      ],
      boogie: { 0: 0, 2: 0, 3: 7, 5: 7, 6: 10, 8: 10, 9: 7, 11: 7 },
      play(x, S) {
        const { t, dur, s, b, lvl, root, chord, key, boss, per } = x, R = key + root;
        const shuffle = s % 3 !== 1, beat = s % 3 === 0;
        // bass
        if (lvl >= 3 && shuffle) pluck(ch.bass, 'bass', R + S.boogie[s], t, 0.55, { len: dur * 1.8 });
        else if (lvl === 2 && beat) pluck(ch.bass, 'bass', R, t, 0.55, { len: dur * 2.5 });
        else if (lvl <= 1 && (s === 0 || s === 6)) pluck(ch.bass, 'bass', R + (s ? 7 : 0), t, lvl ? 0.55 : 0.4, { len: dur * 5 });
        if (boss && shuffle) note(ch.bass, R - 12 + S.boogie[s], t, dur * 1.6, 0.07, { wave: 'sawtooth', cut: 700, q: 3 });
        // accordion: stabs on the off-beats in a fight, a held chord when it is quiet
        const voicing = chord.map((iv) => R + 12 + iv);
        if (lvl >= 3 && s % 3 === 2) for (const m of voicing) note(ch.comp, m, t, dur * 0.9, 0.022, { wave: wave('reed'), at: 0.015, rel: 0.05, vib: 0.003, vibRate: 7 });
        if (lvl <= 2 && s === 0) for (const m of voicing) note(ch.comp, m, t, dur * per * 0.95, lvl === 2 ? 0.014 : 0.018, { wave: wave('reed'), at: 0.3, rel: 0.3, vib: 0.004, vibRate: 6.5, verb: 0.3, held: true });
        // slide guitar, or harmonica when calm; none in the tense bits
        const n = tuneAt(S, b, s);
        if (n && lvl !== 2) {
          const m = key + 24 + n[0], len = n[1] * dur;
          if (lvl >= 3) pluck(ch.lead, 'slide', m, t, 0.2, { slide: n[1] >= 3 ? 2 : 0.6, slideT: 0.12, vib: n[1] >= 3 ? 0.012 : 0, len: Math.max(len * 1.1, 0.25), verb: 0.3 });
          else note(ch.lead, m, t, len * 0.92, 0.05, { wave: wave('harp'), bp: hz(m) * 2.2, q: 0.9, at: 0.035, rel: 0.1, vib: 0.012, vibRate: 5.5, vibAt: 0.3, glide: n[1] >= 3 ? m - 1 : null, glideT: 0.12, verb: 0.3 });
          if (boss) note(ch.lead, m, t, len * 0.9, 0.035, { wave: wave('harp'), bp: hz(m) * 2.2, at: 0.03, rel: 0.1, vib: 0.015, glide: m - 2, glideT: 0.15 });
        }
        // stomp, clap, washboard
        if (lvl >= 3 && (s === 0 || s === 6 || (boss && beat))) kick(t, 0.3, 100, 40, 0.28);
        if (lvl === 2 && (s === 0 || s === 6)) kick(t, 0.2, 100, 40, 0.28);
        if (lvl >= 3 && (s === 3 || s === 9)) { snare(t, 0.1); clap(t, 0.07); if (boss) tamb(t, 0.06); }
        if (lvl >= 2 && shuffle) washboard(t, s % 3 === 2 ? 0.06 : 0.035);
        if (lvl >= 3 && b === 7 && s >= 9) snare(t, 0.07 + (s - 9) * 0.03);
      },
    },
  };

  // schedule one step of the song at time t
  function step(id, mode, n, t, dur) {
    const S = SONGS[id], lvl = LEVEL[mode] == null ? 1 : LEVEL[mode], per = S.beats * S.spb;
    const bar = Math.floor(n / per), s = n % per, b = bar % 8;
    const [root, q] = S.prog[b];
    if (S.swing && s % 2) t += S.swing * dur;
    S.play({ t, dur, s, b, bar, phrase: Math.floor(bar / 8), lvl, root, chord: CHORDS[q], key: S.key, per, boss: mode === 'boss', mode }, S);
  }

  return { attach, songFor, stepDur, change, step, SONGS, LEVEL };
})();
