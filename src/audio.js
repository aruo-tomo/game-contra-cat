// 8-bit style sound effects and looping chiptunes, synthesised with Web Audio.
// Separate music and effects buses so each has its own volume.

let ac = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;
let muted = false;
let musicTimer = null;
const vol = { music: 0.7, sfx: 0.9 };

export function initAudio() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ac.destination);
  sfxBus = ac.createGain();
  sfxBus.connect(master);
  musicBus = ac.createGain();
  musicBus.connect(master);
  applyVolumes();
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function applyVolumes() {
  if (!ac) return;
  sfxBus.gain.value = vol.sfx;
  musicBus.gain.value = vol.music * 0.3;
}

export function setVolumes(music, sfx) {
  vol.music = music;
  vol.sfx = sfx;
  applyVolumes();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}
export const isMuted = () => muted;

function tone({ type = 'square', f0, f1 = f0, dur = 0.1, vol: v = 0.25, at = 0, bus = sfxBus }) {
  if (!ac) return;
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, vol: v = 0.3, freq = 1200, at = 0 }) {
  if (!ac) return;
  const t = ac.currentTime + at;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(80, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(sfxBus);
  s.start(t);
  s.stop(t + dur + 0.02);
}

const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
const melody = (notes, step, type = 'square', v = 0.14) =>
  notes.forEach((m, i) => { if (m) tone({ type, f0: N(m), dur: step * 0.95, vol: v, at: i * step }); });

let lastShot = 0;
export const sfx = {
  shoot(kind) {
    if (!ac) return;
    // the machine gun fires fast; thin out its clicks
    if (ac.currentTime - lastShot < 0.06) return;
    lastShot = ac.currentTime;
    if (kind === 'L') tone({ type: 'sawtooth', f0: 1400, f1: 300, dur: 0.12, vol: 0.12 });
    else if (kind === 'F') tone({ type: 'triangle', f0: 300, f1: 120, dur: 0.12, vol: 0.2 });
    else tone({ f0: kind === 'S' ? 700 : 900, f1: 220, dur: 0.06, vol: 0.08 });
  },
  enemyShot: () => tone({ type: 'square', f0: 320, f1: 180, dur: 0.08, vol: 0.06 }),
  hit: () => tone({ f0: 180, f1: 90, dur: 0.05, vol: 0.12 }),
  // stage 2: a shot glancing off a shield, laser charge / fire, gas hiss, the cone cat's yowl, a nurse's heal
  clink: () => { tone({ type: 'triangle', f0: 2200, f1: 1600, dur: 0.06, vol: 0.09 }); tone({ type: 'triangle', f0: 3100, dur: 0.04, vol: 0.05, at: 0.03 }); },
  charge: () => tone({ type: 'sawtooth', f0: 200, f1: 900, dur: 0.5, vol: 0.06 }),
  laser: () => { tone({ type: 'sawtooth', f0: 900, f1: 600, dur: 0.4, vol: 0.1 }); noise({ dur: 0.3, vol: 0.12, freq: 3000 }); },
  hiss: () => noise({ dur: 0.45, vol: 0.14, freq: 5000 }),
  yowl() {
    tone({ type: 'sawtooth', f0: 380, f1: 720, dur: 0.18, vol: 0.12 });
    tone({ type: 'sawtooth', f0: 720, f1: 260, dur: 0.35, vol: 0.12, at: 0.18 });
  },
  heal: () => [880, 1175].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.1, vol: 0.1, at: i * 0.08 })),
  boom(big) {
    noise({ dur: big ? 0.7 : 0.3, vol: big ? 0.5 : 0.3, freq: big ? 900 : 1600 });
    tone({ type: 'triangle', f0: big ? 120 : 200, f1: 40, dur: big ? 0.6 : 0.25, vol: 0.3 });
  },
  jump: (dbl) => tone({ f0: dbl ? 500 : 300, f1: dbl ? 1100 : 700, dur: 0.12, vol: 0.1 }),
  dash: () => noise({ dur: 0.15, vol: 0.18, freq: 4000 }),
  hurt: () => { tone({ f0: 500, f1: 120, dur: 0.25, vol: 0.2 }); noise({ dur: 0.15, vol: 0.15 }); },
  pickup() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ f0: f, dur: 0.08, vol: 0.12, at: i * 0.06 }));
  },
  meow() {
    tone({ type: 'triangle', f0: 600, f1: 950, dur: 0.12, vol: 0.18 });
    tone({ type: 'triangle', f0: 950, f1: 520, dur: 0.22, vol: 0.18, at: 0.12 });
  },
  squeak: () => tone({ f0: 1800, f1: 2600, dur: 0.07, vol: 0.06 }),
  swallow: () => tone({ type: 'sine', f0: 400, f1: 80, dur: 0.18, vol: 0.25 }),
  spit: () => noise({ dur: 0.2, vol: 0.25, freq: 2500 }),
  // skill became usable: bright rising arpeggio
  ready() {
    [784, 988, 1319].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.09, vol: 0.13, at: i * 0.05 }));
  },
  beam() {
    tone({ type: 'sawtooth', f0: 1800, f1: 200, dur: 0.35, vol: 0.16 });
    noise({ dur: 0.3, vol: 0.2, freq: 1200 });
  },
  lock() {
    tone({ f0: 1200, dur: 0.05, vol: 0.1 });
    tone({ f0: 1600, dur: 0.05, vol: 0.1, at: 0.07 });
  },
  revive() {
    [392, 523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.12, vol: 0.15, at: i * 0.08 }));
  },
  bridge: () => noise({ dur: 0.25, vol: 0.2, freq: 700 }),
  // boss alarm: two-tone wail
  siren() {
    for (let i = 0; i < 4; i++) {
      tone({ type: 'sawtooth', f0: 660, f1: 990, dur: 0.25, vol: 0.12, at: i * 0.5 });
      tone({ type: 'sawtooth', f0: 990, f1: 660, dur: 0.25, vol: 0.12, at: i * 0.5 + 0.25 });
    }
  },
  start: () => melody([67, 72, 76, 79, 0, 76, 79, 84], 0.09),
  clear: () => melody([72, 72, 76, 79, 76, 79, 84, 0, 83, 84], 0.13),
  gameOver: () => melody([72, 71, 69, 67, 0, 64, 62, 60], 0.18, 'triangle', 0.2),
};

// --- music: two 64-step loops (stage / boss) ---
const STAGE = {
  step: 0.115,
  bass: [
    45, 0, 45, 57, 45, 0, 43, 55, 41, 0, 41, 53, 43, 0, 43, 55,
    45, 0, 45, 57, 45, 0, 43, 55, 41, 0, 41, 53, 40, 0, 40, 52,
    41, 0, 41, 53, 41, 0, 43, 55, 45, 0, 45, 57, 45, 0, 47, 59,
    41, 0, 41, 53, 43, 0, 43, 55, 45, 0, 45, 57, 44, 0, 44, 56,
  ],
  lead: [
    69, 0, 72, 0, 76, 0, 74, 72, 71, 0, 72, 0, 74, 0, 0, 0,
    69, 0, 72, 0, 76, 0, 79, 77, 76, 0, 74, 0, 72, 0, 71, 0,
    77, 0, 76, 74, 72, 0, 74, 76, 77, 0, 79, 0, 81, 0, 0, 0,
    81, 79, 77, 76, 74, 0, 76, 0, 72, 0, 71, 0, 69, 0, 0, 0,
  ],
};
const BOSS = {
  step: 0.1,
  bass: [
    40, 40, 52, 40, 41, 41, 53, 41, 40, 40, 52, 40, 43, 43, 55, 44,
    40, 40, 52, 40, 41, 41, 53, 41, 38, 38, 50, 38, 39, 39, 51, 39,
    40, 40, 52, 40, 41, 41, 53, 41, 40, 40, 52, 40, 43, 43, 55, 44,
    45, 45, 57, 45, 43, 43, 55, 43, 41, 41, 53, 41, 39, 39, 51, 39,
  ],
  lead: [
    76, 0, 75, 76, 0, 0, 79, 0, 77, 0, 76, 0, 74, 0, 0, 0,
    76, 0, 75, 76, 0, 0, 81, 0, 79, 0, 77, 0, 76, 0, 75, 0,
    88, 0, 87, 88, 0, 0, 84, 0, 83, 0, 81, 0, 79, 0, 0, 0,
    81, 0, 83, 84, 0, 83, 81, 79, 77, 0, 76, 0, 75, 0, 76, 0,
  ],
};

export function startMusic(kind = 'stage') {
  stopMusic();
  if (!ac) return;
  const song = kind === 'boss' ? BOSS : STAGE;
  let i = 0;
  let next = ac.currentTime + 0.05;
  musicTimer = setInterval(() => {
    while (next < ac.currentTime + 0.2) {
      const at = next - ac.currentTime;
      const b = song.bass[i % song.bass.length];
      const l = song.lead[i % song.lead.length];
      if (b) tone({ type: 'triangle', f0: N(b), dur: song.step * 0.9, vol: 0.5, at, bus: musicBus });
      if (l) tone({ type: 'square', f0: N(l), dur: song.step * 1.6, vol: 0.13, at, bus: musicBus });
      if (i % 4 === 0) tone({ type: 'sine', f0: 140, f1: 45, dur: 0.08, vol: 0.5, at, bus: musicBus });
      if (i % 8 === 4 && ac) noiseHat(at);
      i++;
      next += song.step;
    }
  }, 40);
}

function noiseHat(at) {
  const t = ac.currentTime + at;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 6000;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  s.connect(f).connect(g).connect(musicBus);
  s.start(t);
  s.stop(t + 0.06);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}
