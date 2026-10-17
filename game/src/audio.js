// 8-bit style sound effects and a looping chiptune, synthesised with Web Audio.

let ac = null;
let master = null;
let musicBus = null;
let noiseBuf = null;
let muted = false;
let musicTimer = null;

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
  master.gain.value = muted ? 0 : 0.45;
  master.connect(ac.destination);
  musicBus = ac.createGain();
  musicBus.gain.value = 0.2;
  musicBus.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.45;
}
export const isMuted = () => muted;

function tone({ type = 'square', f0, f1 = f0, dur = 0.1, vol = 0.25, at = 0, bus = master }) {
  if (!ac) return;
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.3, freq = 1200, at = 0 }) {
  if (!ac) return;
  const t = ac.currentTime + at;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(80, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur + 0.02);
}

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
  lock() {
    tone({ f0: 1200, dur: 0.05, vol: 0.1 });
    tone({ f0: 1600, dur: 0.05, vol: 0.1, at: 0.07 });
  },
  revive() {
    [392, 523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.12, vol: 0.15, at: i * 0.08 }));
  },
  bridge: () => noise({ dur: 0.25, vol: 0.2, freq: 700 }),
  clear() {
    [523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone({ f0: f, dur: 0.16, vol: 0.14, at: i * 0.14 }));
  },
};

// --- music: A-minor loop, 16th-note steps ---
const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
const BASS = [45, 0, 45, 57, 45, 0, 43, 55, 41, 0, 41, 53, 43, 0, 43, 55];
const LEAD = [
  69, 0, 72, 0, 76, 0, 74, 72, 71, 0, 72, 0, 74, 0, 0, 0,
  69, 0, 72, 0, 76, 0, 79, 77, 76, 0, 74, 0, 72, 0, 71, 0,
];
const BOSS_BASS = [40, 40, 52, 40, 41, 41, 53, 41, 40, 40, 52, 40, 43, 43, 55, 44];
const BOSS_LEAD = [
  76, 0, 75, 76, 0, 0, 79, 0, 77, 0, 76, 0, 74, 0, 0, 0,
  76, 0, 75, 76, 0, 0, 81, 0, 79, 0, 77, 0, 76, 0, 75, 0,
];

export function startMusic(kind = 'stage') {
  stopMusic();
  if (!ac) return;
  const step = kind === 'boss' ? 0.1 : 0.115;
  const bass = kind === 'boss' ? BOSS_BASS : BASS;
  const lead = kind === 'boss' ? BOSS_LEAD : LEAD;
  let i = 0;
  let next = ac.currentTime + 0.05;
  musicTimer = setInterval(() => {
    while (next < ac.currentTime + 0.2) {
      const at = next - ac.currentTime;
      const b = bass[i % bass.length];
      const l = lead[i % lead.length];
      if (b) tone({ type: 'triangle', f0: N(b), dur: step * 0.9, vol: 0.5, at, bus: musicBus });
      if (l) tone({ type: 'square', f0: N(l), dur: step * 1.6, vol: 0.13, at, bus: musicBus });
      if (i % 4 === 0) tone({ type: 'sine', f0: 140, f1: 45, dur: 0.08, vol: 0.5, at, bus: musicBus });
      i++;
      next += step;
    }
  }, 40);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}
