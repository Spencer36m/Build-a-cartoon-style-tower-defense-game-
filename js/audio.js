'use strict';
// ============================================================
// Sound: every effect is synthesized with Web Audio, so the game ships no audio files.
// Effects pan left or right with their position on the battlefield. Music (music.js) is a
// step sequencer with a song per world whose arrangement follows the action, and ambience
// follows the weather.
// ============================================================
// Throttle per effect (ms) so rapid fire doesn't stack into noise.
const SOUND_GAP = {
  mg: 70, heli: 70, sniper: 90, mortar: 120, boom: 100, thud: 70, cryo: 100, flame: 160, zap: 90, missile: 120, cannon: 110,
  laser: 60, ray: 110, shotgun: 90, rail: 200, pulse: 300, bomb: 150, torpedo: 200, splash: 150,
  splat: 50, groan: 700, crow: 400, bat: 300, bones: 120, wail: 500, pop: 120, roar: 900, brute: 500,
  armor: 120, crit: 120, freeze: 150, summon: 400, heal: 400, stomp: 300, dig: 200,
  coin: 60, cash: 90, interest: 200, buy: 100, early: 300, clear: 400, xp: 200,
  upgrade: 100, tier5: 300, unlock: 200, place: 80, sell: 80, select: 60, click: 45, error: 120, open: 120, globe: 250,
  pause: 150, speed: 60, wave: 400, boss: 900, leak: 150, lowlife: 1500, star: 60, win: 800, lose: 800,
  jet: 600, freezeall: 500, supply: 400, medkit: 400, thunder: 3000, alarm: 1200, static: 300, page: 200, shatter: 300, impact: 500, type: 40,
};

// a tenth of a second of silence, used to unlock audio on older iPhones
const SILENT_WAV = 'data:audio/wav;base64,' + btoa(String.fromCharCode(...[82, 73, 70, 70, 36, 9, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32, 16, 0, 0, 0, 1, 0, 1, 0, 64, 31, 0, 0, 64, 31, 0, 0, 1, 0, 8, 0, 100, 97, 116, 97, 0, 9, 0, 0], ...new Array(2304).fill(128)));

const Sound = {
  ac: null, master: null, sfx: null, musicBus: null, ambBus: null, verb: null, noiseBuf: null, curve: null,
  muted: false, musicOn: true, last: {}, recent: [],
  music: { mode: null, world: 0, song: null, ready: null, step: 0, next: 0 }, amb: null, ticker: null,

  init() {
    this.unlock();
    if (this.ac) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = this.ac = new AC();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      comp.connect(ac.destination);
      this.master = ac.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(comp);
      this.sfx = ac.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);
      this.musicBus = ac.createGain(); this.musicBus.gain.value = this.musicOn ? 0.55 : 0; this.musicBus.connect(this.master);
      this.ambBus = ac.createGain(); this.ambBus.gain.value = 0.3; this.ambBus.connect(this.master);
      // white noise for hits, wind and rain
      const len = ac.sampleRate * 2;
      this.noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // a short decaying-noise reverb for the music, the ghosts and the bosses
      const rl = Math.floor(ac.sampleRate * 1.8), ir = ac.createBuffer(2, rl, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const b = ir.getChannelData(ch); for (let i = 0; i < rl; i++) b[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 2.6); }
      this.verb = ac.createConvolver(); this.verb.buffer = ir;
      const wet = ac.createGain(); wet.gain.value = 0.5;
      this.verb.connect(wet); wet.connect(this.master);
      MUSIC.attach(ac, this.musicBus, this.verb, this.noiseBuf);
      // soft clipping for growls and roars
      this.curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = (i / 255) * 2 - 1; this.curve[i] = Math.tanh(x * 3); }
      this.ticker = setInterval(() => this.tick(), 60);
      this.unlock();
    } catch (e) { this.ac = null; }
  },
  // Phones only let audio start inside a tap, and iOS pauses it ("interrupted") for calls and app
  // switches. This runs on every touch, click and key press to keep the context running.
  unlock() {
    // iPhone mutes web audio with the ring/silent switch unless the page asks for media playback
    try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
    if (!navigator.audioSession && /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document && !this.silent) {
      // older iOS: a looping silent <audio> element switches the audio session to playback
      const a = this.silent = document.createElement('audio');
      a.setAttribute('playsinline', ''); a.loop = true; a.preload = 'auto'; a.src = SILENT_WAV;
    }
    if (this.silent && this.silent.paused && !document.hidden) { const p = this.silent.play(); if (p && p.catch) p.catch(() => {}); }
    const ac = this.ac;
    if (ac && ac.state !== 'running' && ac.state !== 'closed' && !document.hidden) {
      const p = ac.resume(); if (p && p.catch) p.catch(() => {});
      // a one-sample silent buffer started inside the gesture fully wakes WebKit's output
      try { const b = ac.createBufferSource(); b.buffer = ac.createBuffer(1, 1, 22050); b.connect(ac.destination); b.start(0); } catch (e) { /* ignore */ }
    }
  },
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ac.currentTime, 0.05);
  },
  setMusic(on) {
    this.musicOn = on;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.55 : 0, this.ac.currentTime, 0.2);
  },
  suspend() { if (this.ac && this.ac.state === 'running') this.ac.suspend(); if (this.silent) this.silent.pause(); },
  // coming back to the app: resume straight away where the browser allows it, else on the next tap
  wake() { if (this.ac && this.ac.state !== 'running' && this.ac.state !== 'closed') { const p = this.ac.resume(); if (p && p.catch) p.catch(() => {}); } if (this.silent && this.silent.paused) { const p = this.silent.play(); if (p && p.catch) p.catch(() => {}); } },

  // ---------- building blocks ----------
  out(x, bus = this.sfx) {
    if (x == null || !this.ac.createStereoPanner) return bus;
    const p = this.ac.createStereoPanner();
    p.pan.value = clamp((x / W - 0.5) * 1.4, -0.7, 0.7);
    p.connect(bus);
    return p;
  },
  tone(f, dur, type = 'sine', vol = 0.2, slide = null, delay = 0, dest = this.sfx, attack = 0.008, verb = 0) {
    const ac = this.ac, t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest);
    if (verb) { const s = ac.createGain(); s.gain.value = verb; g.connect(s); s.connect(this.verb); }
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  },
  noise(dur, vol = 0.3, freq = 800, delay = 0, type = 'lowpass', dest = this.sfx, q = 0.7, sweep = null) {
    const ac = this.ac, t0 = ac.currentTime + delay;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = this.noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
  },
  // a voice-like sound: a buzzy tone through a vowel filter, optionally distorted
  voice(f, to, dur, vol, formant, dest, delay = 0, grit = false, verb = 0) {
    const ac = this.ac, t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), bp = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 5 + Math.random() * 3; lg.gain.value = f * 0.04;
    lfo.connect(lg); lg.connect(o.frequency);
    bp.type = 'bandpass'; bp.frequency.setValueAtTime(formant, t0); bp.frequency.linearRampToValueAtTime(formant * 0.7, t0 + dur); bp.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o;
    if (grit) { const ws = ac.createWaveShaper(); ws.curve = this.curve; o.connect(ws); node = ws; }
    node.connect(bp); bp.connect(g); g.connect(dest);
    if (verb) { const s = ac.createGain(); s.gain.value = verb; g.connect(s); s.connect(this.verb); }
    o.start(t0); lfo.start(t0); o.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
  },
  arp(notes, step, type = 'triangle', vol = 0.1, dur = 0.14, dest = this.sfx, verb = 0) {
    notes.forEach((f, i) => this.tone(f, dur, type, vol, null, i * step, dest, 0.008, verb));
  },

  // ---------- effects ----------
  // x pans the sound to where it happened; opts.pitch shifts it (1 = normal).
  play(name, x = null, opts = {}) {
    if (!this.ac || this.muted || this.ac.state !== 'running') return;
    const now = performance.now();
    const gap = SOUND_GAP[name] || 40;
    if (this.last[name] && now - this.last[name] < gap) return;
    // a cap on how many effects start at once keeps big fights clear
    this.recent = this.recent.filter((t) => now - t < 120);
    if (this.recent.length > 12 && !['click', 'error', 'win', 'lose', 'boss', 'wave', 'upgrade', 'tier5', 'unlock', 'buy', 'leak'].includes(name)) return;
    this.recent.push(now);
    this.last[name] = now;
    const o = this.out(x), p = opts.pitch || 1, r = (a, b) => a + Math.random() * (b - a);
    switch (name) {
      // weapons
      case 'mg': this.noise(0.06, 0.14, 2600, 0, 'lowpass', o); this.tone(160, 0.05, 'square', 0.03, 80, 0, o); break;
      case 'heli': this.noise(0.05, 0.1, 3000, 0, 'lowpass', o); this.tone(110, 0.05, 'square', 0.02, 70, 0, o); break;
      case 'sniper': this.noise(0.25, 0.28, 3500, 0, 'lowpass', o); this.tone(220, 0.18, 'triangle', 0.08, 60, 0, o); this.noise(0.6, 0.05, 900, 0.05, 'bandpass', o, 0.7); break;
      case 'mortar': this.tone(140, 0.18, 'sine', 0.2, 60, 0, o); this.noise(0.1, 0.1, 500, 0, 'lowpass', o); this.tone(900, 0.5, 'sine', 0.015, 500, 0.15, o); break;
      case 'boom': this.noise(0.6, 0.35, 420, 0, 'lowpass', o); this.tone(70, 0.5, 'sine', 0.3, 32, 0, o); this.noise(1.2, 0.06, 200, 0.1, 'lowpass', o); break;
      case 'thud': this.noise(0.22, 0.16, 360, 0, 'lowpass', o); this.tone(95, 0.18, 'sine', 0.12, 45, 0, o); break;
      case 'cryo': this.noise(0.25, 0.08, 6000, 0, 'highpass', o); this.tone(1800, 0.2, 'sine', 0.02, 2600, 0.05, o); break;
      case 'flame': this.noise(0.3, 0.09, 900, 0, 'lowpass', o, 0.7, 500); break;
      case 'zap': this.noise(0.12, 0.1, 5000, 0, 'highpass', o); this.tone(90, 0.12, 'sawtooth', 0.05, 180, 0, o); break;
      case 'missile': this.noise(0.4, 0.09, 1800, 0, 'bandpass', o, 1, 600); break;
      case 'cannon': this.noise(0.18, 0.2, 900, 0, 'lowpass', o); this.tone(110, 0.15, 'sine', 0.15, 50, 0, o); break;
      case 'laser': this.tone(1400 * p, 0.08, 'sawtooth', 0.03, 500, 0, o); break;
      case 'ray': this.tone(220, 0.12, 'sawtooth', 0.025, 260, 0, o); this.noise(0.1, 0.04, 5000, 0, 'highpass', o); break;
      case 'shotgun': this.noise(0.14, 0.22, 1400, 0, 'lowpass', o); this.tone(120, 0.08, 'square', 0.04, 60, 0, o); this.noise(0.05, 0.05, 3000, 0.25, 'highpass', o); break;
      case 'rail': this.tone(300, 0.22, 'sawtooth', 0.04, 2400, 0, o); this.noise(0.18, 0.3, 2500, 0.2, 'highpass', o); this.tone(80, 0.3, 'sine', 0.2, 40, 0.2, o); break;
      case 'pulse': this.tone(70, 0.5, 'sine', 0.3, 30, 0, o); this.tone(200, 0.35, 'sawtooth', 0.05, 1400, 0, o); this.noise(0.3, 0.1, 4000, 0, 'highpass', o); break;
      case 'bomb': this.tone(1700, 0.45, 'sine', 0.04, 500, 0, o); break;
      case 'torpedo': this.noise(0.35, 0.12, 700, 0, 'bandpass', o, 1.5, 300); this.tone(200, 0.2, 'sine', 0.06, 90, 0, o); break;
      case 'splash': this.noise(0.4, 0.14, 1300, 0, 'bandpass', o, 0.8, 400); this.tone(320, 0.15, 'sine', 0.05, 120, 0.02, o); break;
      // hits and zombies
      case 'splat': this.noise(0.08, 0.08, 700, 0, 'lowpass', o); this.tone(r(140, 220), 0.06, 'sine', 0.05, 60, 0, o); break;
      case 'armor': this.tone(1200, 0.14, 'triangle', 0.03, null, 0, o); this.tone(1810, 0.1, 'triangle', 0.02, null, 0, o); break;
      case 'crit': this.tone(1800, 0.12, 'triangle', 0.06, null, 0, o); this.tone(2700, 0.1, 'triangle', 0.04, null, 0.03, o); break;
      case 'freeze': this.noise(0.3, 0.06, 6500, 0, 'highpass', o); this.tone(2500, 0.18, 'sine', 0.02, 3800, 0, o); break;
      case 'groan': this.voice(r(70, 120) * p, r(55, 80) * p, r(0.8, 1.3), 0.12, r(420, 650), o, 0, false, 0.2); break;
      case 'brute': this.voice(55, 42, 1.1, 0.16, 320, o, 0, true, 0.2); break;
      case 'roar': this.voice(60, 38, 1.6, 0.22, 380, o, 0, true, 0.5); this.voice(90, 55, 1.5, 0.12, 700, o, 0.05, true, 0.4); this.noise(1.2, 0.1, 300, 0, 'bandpass', o, 1); break;
      case 'crow': for (const dt of [0, 0.22]) this.voice(r(760, 860), 560, 0.16, 0.06, 1500, o, dt); break;
      case 'bat': for (let i = 0; i < 3; i++) this.tone(r(6000, 7000), 0.035, 'sine', 0.025, 9000, i * 0.05, o); break;
      case 'bones': for (let i = 0; i < 5; i++) { const dt = i * 0.05 + r(0, 0.02); this.noise(0.03, 0.12, 3200, dt, 'highpass', o); this.tone(r(700, 1100), 0.03, 'square', 0.02, null, dt, o); } break;
      case 'wail': {
        const ac = this.ac, t0 = ac.currentTime, os = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
        os.type = 'sine'; os.frequency.setValueAtTime(520, t0); os.frequency.linearRampToValueAtTime(880, t0 + 0.4); os.frequency.linearRampToValueAtTime(380, t0 + 1.2);
        lfo.frequency.value = 6; lg.gain.value = 25; lfo.connect(lg); lg.connect(os.frequency);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
        os.connect(g); g.connect(o); const s = ac.createGain(); s.gain.value = 0.6; g.connect(s); s.connect(this.verb);
        os.start(t0); lfo.start(t0); os.stop(t0 + 1.3); lfo.stop(t0 + 1.3);
        break;
      }
      case 'pop': this.noise(0.25, 0.2, 800, 0, 'lowpass', o); this.tone(180, 0.22, 'sine', 0.14, 50, 0, o); this.noise(0.5, 0.05, 1200, 0.1, 'bandpass', o); break;
      case 'summon': this.tone(120, 0.5, 'triangle', 0.06, 300, 0, o, 0.01, 0.4); this.noise(0.4, 0.04, 400, 0, 'lowpass', o); break;
      case 'heal': this.tone(420, 0.25, 'sine', 0.05, 640, 0, o, 0.01, 0.3); break;
      case 'stomp': this.noise(0.5, 0.35, 220, 0, 'lowpass', o); this.tone(48, 0.5, 'sine', 0.35, 28, 0, o); this.noise(0.4, 0.05, 6000, 0.1, 'highpass', o); break;
      case 'dig': this.noise(0.2, 0.12, 400, 0, 'lowpass', o); this.noise(0.15, 0.06, 900, 0.12, 'bandpass', o); break;
      // economy
      case 'coin': this.tone(1046, 0.06, 'triangle', 0.06, null, 0, o); this.tone(1568, 0.1, 'triangle', 0.05, null, 0.05, o); break;
      case 'cash': this.noise(0.04, 0.05, 2000, 0, 'bandpass', o); this.tone(1318, 0.05, 'triangle', 0.045, null, 0.02, o); this.tone(1760, 0.08, 'triangle', 0.04, null, 0.06, o); break;
      case 'interest': this.arp([784, 988, 1175, 1568], 0.07, 'sine', 0.05, 0.25, o, 0.3); break;
      case 'buy': this.noise(0.05, 0.08, 3000, 0, 'highpass', o); this.tone(1046, 0.08, 'triangle', 0.06, null, 0.02, o); this.tone(2093, 0.4, 'sine', 0.05, null, 0.08, o, 0.005, 0.3); break;
      case 'early': this.tone(988, 0.06, 'triangle', 0.05, null, 0, o); this.tone(1318, 0.09, 'triangle', 0.05, null, 0.06, o); break;
      case 'clear': this.arp([523, 659, 784, 1046], 0.08, 'triangle', 0.08, 0.2, o, 0.3); break;
      case 'xp': this.arp([1318, 1760, 2093], 0.05, 'sine', 0.035, 0.14, o, 0.3); break;
      // building and menus
      case 'place': this.noise(0.08, 0.15, 1200, 0, 'lowpass', o); this.tone(320, 0.06, 'triangle', 0.08, null, 0, o); this.noise(0.12, 0.06, 400, 0.06, 'lowpass', o); break;
      case 'upgrade': this.arp([392, 523, 659].map((f) => f * p), 0.07, 'triangle', 0.1, 0.12, o); this.noise(0.3, 0.03, 6000, 0.1, 'highpass', o); break;
      case 'tier5':
        for (const f of [110, 165, 220]) this.tone(f, 0.9, 'sawtooth', 0.04, null, 0, o, 0.02, 0.5);
        this.arp([523, 659, 784, 1046, 1318], 0.07, 'triangle', 0.08, 0.2, o, 0.4); this.noise(1.2, 0.06, 7000, 0.05, 'highpass', o); break;
      case 'unlock': this.arp([523, 659, 784, 1046, 1318], 0.06, 'triangle', 0.08, 0.18, o, 0.4); this.noise(0.6, 0.04, 7000, 0.2, 'highpass', o); break;
      case 'sell': this.tone(520, 0.12, 'triangle', 0.08, 260, 0, o); this.tone(1046, 0.08, 'triangle', 0.04, null, 0.08, o); break;
      case 'select': this.tone(660, 0.05, 'triangle', 0.05, null, 0, o); this.tone(990, 0.04, 'triangle', 0.03, null, 0.03, o); break;
      case 'click': this.tone(880, 0.03, 'triangle', 0.05); break;
      case 'error': this.tone(140, 0.12, 'square', 0.06); this.tone(110, 0.12, 'square', 0.05, null, 0.08); break;
      case 'open': this.noise(0.3, 0.05, 400, 0, 'bandpass', this.sfx, 1.2, 2200); break;
      case 'globe': this.noise(0.5, 0.05, 300, 0, 'bandpass', this.sfx, 1, 1200); this.tone(440, 0.4, 'sine', 0.02, 660, 0.1, this.sfx, 0.05, 0.4); break;
      case 'pause': this.tone(660, 0.08, 'triangle', 0.05); this.tone(440, 0.1, 'triangle', 0.05, null, 0.07); break;
      case 'resume': this.tone(440, 0.08, 'triangle', 0.05); this.tone(660, 0.1, 'triangle', 0.05, null, 0.07); break;
      case 'speed': this.tone(1200 * p, 0.03, 'square', 0.03); break;
      // battle flow
      case 'wave': this.tone(330, 0.5, 'sawtooth', 0.04, 300); this.tone(220, 0.6, 'sine', 0.06, null, 0.1); this.noise(0.6, 0.04, 200, 0, 'lowpass'); break;
      case 'boss': this.tone(65, 1.2, 'sawtooth', 0.1, 45, 0, this.sfx, 0.01, 0.5); this.tone(98, 1.0, 'sawtooth', 0.06, 70, 0.3, this.sfx, 0.01, 0.5); break;
      case 'leak': this.tone(180, 0.4, 'sawtooth', 0.08, 70, 0, o); this.noise(0.2, 0.08, 500, 0, 'lowpass', o); break;
      case 'lowlife': for (const dt of [0, 0.24]) { this.tone(62, 0.14, 'sine', 0.25, 40, dt); this.noise(0.08, 0.04, 200, dt, 'lowpass'); } break;
      case 'star': this.tone(880 * p, 0.16, 'triangle', 0.08, 1320 * p, 0, this.sfx, 0.005, 0.3); this.noise(0.25, 0.03, 7000, 0.02, 'highpass'); break;
      case 'win': this.arp([392, 523, 659, 784, 1046], 0.13, 'triangle', 0.09, 0.32, this.sfx, 0.4); break;
      case 'lose': this.arp([262, 220, 175, 131], 0.25, 'triangle', 0.1, 0.45, this.sfx, 0.4); this.tone(65, 1.4, 'sawtooth', 0.04, 40, 0.6); break;
      // supplies
      case 'jet': this.noise(1.4, 0.18, 400, 0, 'bandpass', o, 0.8, 1800); this.noise(1.2, 0.08, 6000, 0.2, 'highpass', o); break;
      case 'freezeall': for (let i = 0; i < 10; i++) this.tone(r(2000, 5000), 0.3, 'sine', 0.02, null, i * 0.06, this.sfx, 0.005, 0.5); this.noise(0.9, 0.08, 6000, 0, 'highpass'); break;
      case 'supply': for (let i = 0; i < 4; i++) this.noise(0.06, 0.08, 900, i * 0.08, 'bandpass'); this.tone(1046, 0.08, 'triangle', 0.06, null, 0.4); this.tone(1568, 0.12, 'triangle', 0.05, null, 0.46); break;
      case 'thunder': this.noise(0.15, 0.25, 3000, 0, 'highpass'); this.noise(2.6, 0.32, 160, 0.08, 'lowpass', this.sfx, 0.7, 60); this.noise(1.8, 0.12, 420, 0.3, 'lowpass', this.sfx, 0.7, 120); break;
      case 'alarm': for (let i = 0; i < 2; i++) { this.tone(620, 0.28, 'square', 0.05, 900, i * 0.55); this.tone(900, 0.26, 'square', 0.05, 620, i * 0.55 + 0.28); } break;
      case 'static': for (let i = 0; i < 4; i++) this.noise(0.05 + Math.random() * 0.06, 0.07, 2600, i * 0.07 + Math.random() * 0.03, 'bandpass', this.sfx, 1.4); this.tone(1200, 0.04, 'square', 0.015, null, 0.1); break;
      case 'page': this.noise(0.28, 0.07, 1800, 0, 'bandpass', this.sfx, 0.6, 600); this.noise(0.12, 0.04, 5000, 0.15, 'highpass'); break;
      case 'shatter': for (let i = 0; i < 7; i++) this.tone(2500 + Math.random() * 3500, 0.08 + Math.random() * 0.1, 'triangle', 0.025, null, i * 0.025); this.noise(0.4, 0.2, 5000, 0, 'highpass'); break;
      case 'impact': this.noise(0.9, 0.4, 260, 0, 'lowpass'); this.tone(55, 0.9, 'sine', 0.4, 28); this.noise(0.3, 0.15, 3000, 0, 'highpass'); break;
      case 'type': this.tone(1800 + Math.random() * 300, 0.012, 'square', 0.006); break;
      case 'medkit': for (const f of [523, 659, 784]) this.tone(f, 0.6, 'sine', 0.04, null, 0, this.sfx, 0.12, 0.4); break;
    }
  },

  // ---------- music ----------
  // mode: 'menu', 'calm', 'battle', 'boss', 'story', 'tension' or null for silence. Each world
  // has its own song and the mode picks how full the arrangement is; a boss has a theme of its own.
  setScene(mode, world = 0) {
    const m = this.music;
    if (m.mode === mode && m.world === world) return;
    const song = mode ? MUSIC.songFor(mode, world) : m.song;
    // a new song starts from its first bar after a short breath
    if (song !== m.song || !m.mode) { m.next = this.ac ? this.ac.currentTime + (m.mode ? 0.35 : 0.1) : 0; m.step = 0; }
    m.mode = mode; m.world = world; m.song = song;
  },
  tick() {
    const ac = this.ac;
    if (!ac || ac.state !== 'running') return;
    const m = this.music;
    if (m.mode) {
      // set up the song here rather than in setScene, which can run before audio has started
      if (m.ready !== m.song) {
        MUSIC.change(m.song, ac.currentTime);
        // a boss gets a dramatic entrance, and its theme starts as the hit dies away
        if (m.song === 'boss') { MUSIC.sting(ac.currentTime + 0.03, m.world); m.next = Math.max(m.next, ac.currentTime + 0.8); }
        m.ready = m.song;
      }
      if (m.next < ac.currentTime) m.next = ac.currentTime + 0.05;
      while (m.next < ac.currentTime + 0.3) {
        const dur = MUSIC.stepDur(m.song);
        MUSIC.step(m.song, m.mode, m.step, m.next, dur, m.world);
        m.next += dur; m.step++;
      }
    }
    if (this.amb && !this.muted) this.ambEvents(0.06);
  },

  // ---------- ambience ----------
  setAmbience(weather, time, world) {
    this.stopAmbience();
    if (!this.ac) return;
    const ac = this.ac, nodes = [];
    const gains = {};
    const loop = (type, freq, q, vol, lfoRate = 0, lfoDepth = 0, name = null) => {
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = this.noiseBuf; src.loop = true;
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(this.ambBus);
      if (name) gains[name] = g;
      if (lfoRate) { const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = lfoRate; lg.gain.value = lfoDepth; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); nodes.push(lfo); }
      src.start(); nodes.push(src);
    };
    // separate layers the weather can turn up and down: rainfall, wind, a tornado's roar
    const rain = weather === 'rain' ? 1 : 0;
    loop('bandpass', weather === 'fog' || weather === 'mist' ? 300 : 380, 0.6, 0.15, 0.1, 150, 'base');
    loop('lowpass', 2600, 0.5, rain * 0.25, 0, 0, 'rainA');
    loop('highpass', 5000, 0.5, rain * 0.07, 0, 0, 'rainB');
    loop('bandpass', 520, 0.8, weather === 'snow' ? 0.3 : 0.05, 0.13, 260, 'wind');
    loop('lowpass', 170, 0.8, 0, 0.3, 60, 'roar');
    this.amb = { nodes, gains, weather, time, world };
  },
  // the weather mixes the ambience as it changes
  weatherMix(m) {
    const a = this.amb;
    if (!a || !this.ac) return;
    const t = this.ac.currentTime, set = (k, v) => { if (a.gains[k]) a.gains[k].gain.setTargetAtTime(v, t, 0.6); };
    set('rainA', m.rain * 0.25); set('rainB', m.rain * 0.07);
    set('wind', Math.min(1.6, m.wind) * 0.28); set('roar', m.roar * 0.55);
    a.weather = m.rain > 0.3 ? 'rain' : m.kind;
  },
  stopAmbience() {
    if (!this.amb) return;
    for (const n of this.amb.nodes) { try { n.stop(); } catch (e) { /* already stopped */ } }
    this.amb = null;
  },
  // occasional creatures: crickets at night, frogs in the bayou, owls and crows in the cemetery
  ambEvents(dt) {
    const a = this.amb, bus = this.ambBus, r = Math.random();
    if ((a.time === 'night' || a.time === 'dusk') && a.weather !== 'rain' && a.world !== 2 && r < dt * 1.6) {
      const f = 4200 + Math.random() * 800;
      for (let i = 0; i < 3; i++) this.tone(f, 0.03, 'sine', 0.05, null, i * 0.045, bus);
    }
    if (a.world === 3 && Math.random() < dt * 0.35) { const f = 90 + Math.random() * 60; this.tone(f, 0.12, 'square', 0.05, f * 0.7, 0, bus); this.tone(f, 0.1, 'square', 0.04, f * 0.7, 0.16, bus); }
    if (a.world === 1 && Math.random() < dt * 0.06) { this.tone(380, 0.35, 'sine', 0.06, 340, 0, bus, 0.05, 0.6); this.tone(360, 0.5, 'sine', 0.06, 320, 0.45, bus, 0.05, 0.6); }
    if (a.world === 0 && Math.random() < dt * 0.04) for (const d of [0, 0.25]) this.voice(800, 560, 0.16, 0.04, 1500, bus, d);
  },
};

// keep audio alive on phones: every gesture can restart it, and coming back to the app resumes it
for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) window.addEventListener(ev, () => { if (Sound.ac || ev !== 'keydown') Sound.init(); }, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) Sound.wake(); });
