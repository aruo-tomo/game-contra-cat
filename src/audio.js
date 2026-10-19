// 8-bit style sound effects and looping chiptunes, synthesised with Web Audio.
// Separate music and effects buses so each has its own volume. Music runs through a low-pass filter
// (muffled under water) and a short echo.

let ac = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let musicFilter = null;
let echoIn = null;
let noiseBuf = null;
let pulse = {};
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
  musicFilter = ac.createBiquadFilter();
  musicFilter.type = 'lowpass';
  musicFilter.frequency.value = 18000;
  musicFilter.connect(master);
  musicBus = ac.createGain();
  musicBus.connect(musicFilter);
  // echo send: a quiet feedback delay that gives the lead some room
  echoIn = ac.createGain();
  echoIn.gain.value = 0.22;
  const delay = ac.createDelay(1);
  delay.delayTime.value = 0.21;
  const fb = ac.createGain();
  fb.gain.value = 0.3;
  const damp = ac.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = 2400;
  echoIn.connect(delay).connect(damp).connect(fb).connect(delay);
  damp.connect(musicBus);
  applyVolumes();
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // NES-style pulse waves (12.5% / 25% duty) for brighter, thinner leads than a plain square
  for (const duty of [0.125, 0.25]) {
    const n = 40;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    pulse[duty] = ac.createPeriodicWave(re, im);
  }
}

export const audioReady = () => !!ac;

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

function tone({ type = 'square', f0, f1 = f0, dur = 0.1, vol: v = 0.25, at = 0, bus = sfxBus, vib = 0, echo = 0, attack = 0 }) {
  if (!ac) return;
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  const g = ac.createGain();
  if (type === 'pulse25' || type === 'pulse12') o.setPeriodicWave(pulse[type === 'pulse25' ? 0.25 : 0.125]);
  else o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  if (vib) {
    // delayed vibrato on held notes
    const lfo = ac.createOscillator();
    const lg = ac.createGain();
    lfo.frequency.value = 6;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f0 * vib, t + Math.min(0.25, dur * 0.6));
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.02);
  }
  if (attack) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + attack);
  } else g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(bus);
  if (echo && echoIn) {
    const s = ac.createGain();
    s.gain.value = echo;
    g.connect(s).connect(echoIn);
  }
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, vol: v = 0.3, freq = 1200, at = 0, type = 'lowpass', sweep = true, bus = sfxBus }) {
  if (!ac) return;
  const t = ac.currentTime + at;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(80, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
const melody = (notes, step, type = 'square', v = 0.14) =>
  notes.forEach((m, i) => { if (m) tone({ type, f0: N(m), dur: step * 0.95, vol: v, at: i * step }); });
const jit = (f, k = 0.06) => f * (1 + (Math.random() - 0.5) * k);

let lastShot = 0;
let meowGun = false;
export function setMeowGun(on) { meowGun = on; }
export const sfx = {
  shoot(kind) {
    if (!ac) return;
    // the machine gun fires fast; thin out its clicks
    if (ac.currentTime - lastShot < 0.06) return;
    lastShot = ac.currentTime;
    // secret code: every shot is a tiny meow
    if (meowGun) {
      const f = jit(900, 0.3);
      tone({ type: 'triangle', f0: f * 0.7, f1: f, dur: 0.05, vol: 0.12 });
      tone({ type: 'triangle', f0: f, f1: f * 0.6, dur: 0.07, vol: 0.12, at: 0.05 });
      return;
    }
    if (kind === 'L') tone({ type: 'sawtooth', f0: 1400, f1: 300, dur: 0.12, vol: 0.12 });
    else if (kind === 'F') { tone({ type: 'triangle', f0: 300, f1: 120, dur: 0.12, vol: 0.2 }); noise({ dur: 0.1, vol: 0.08, freq: 900 }); }
    else if (kind === 'S') { tone({ type: 'pulse25', f0: jit(760), f1: 240, dur: 0.07, vol: 0.09 }); tone({ type: 'pulse25', f0: jit(1010), f1: 330, dur: 0.05, vol: 0.05 }); }
    else if (kind === 'M') tone({ type: 'pulse12', f0: jit(1100, 0.1), f1: 260, dur: 0.045, vol: 0.08 });
    else tone({ f0: jit(900), f1: 220, dur: 0.06, vol: 0.08 });
  },
  enemyShot: () => tone({ type: 'square', f0: jit(320), f1: 180, dur: 0.08, vol: 0.06 }),
  hit: () => tone({ f0: jit(180, 0.2), f1: 90, dur: 0.05, vol: 0.12 }),
  // stage 2: a shot glancing off a shield, laser charge / fire, gas hiss, the cone cat's yowl, a nurse's heal
  clink: () => { tone({ type: 'triangle', f0: jit(2200), f1: 1600, dur: 0.06, vol: 0.09 }); tone({ type: 'triangle', f0: 3100, dur: 0.04, vol: 0.05, at: 0.03 }); },
  charge: () => tone({ type: 'sawtooth', f0: 200, f1: 900, dur: 0.5, vol: 0.06 }),
  laser: () => { tone({ type: 'sawtooth', f0: 900, f1: 600, dur: 0.4, vol: 0.1 }); noise({ dur: 0.3, vol: 0.12, freq: 3000 }); },
  hiss: () => noise({ dur: 0.45, vol: 0.14, freq: 5000 }),
  yowl() {
    tone({ type: 'sawtooth', f0: 380, f1: 720, dur: 0.18, vol: 0.12 });
    tone({ type: 'sawtooth', f0: 720, f1: 260, dur: 0.35, vol: 0.12, at: 0.18 });
  },
  heal: () => [880, 1175].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.1, vol: 0.1, at: i * 0.08 })),
  boom(big) {
    noise({ dur: big ? 0.7 : 0.3, vol: big ? 0.5 : 0.3, freq: big ? 900 : jit(1600, 0.3) });
    tone({ type: 'triangle', f0: big ? 120 : jit(200, 0.2), f1: 40, dur: big ? 0.6 : 0.25, vol: 0.3 });
  },
  jump: (dbl) => tone({ f0: dbl ? 500 : 300, f1: dbl ? 1100 : 700, dur: 0.12, vol: 0.1 }),
  dash: () => noise({ dur: 0.15, vol: 0.18, freq: 4000 }),
  hurt: () => { tone({ f0: 500, f1: 120, dur: 0.25, vol: 0.2 }); noise({ dur: 0.15, vol: 0.15 }); },
  pickup() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ f0: f, dur: 0.08, vol: 0.12, at: i * 0.06 }));
  },
  meow() {
    const k = jit(1, 0.25);
    tone({ type: 'triangle', f0: 600 * k, f1: 950 * k, dur: 0.12, vol: 0.18 });
    tone({ type: 'triangle', f0: 950 * k, f1: 520 * k, dur: 0.22, vol: 0.18, at: 0.12 });
  },
  squeak: () => tone({ f0: jit(1800, 0.15), f1: 2600, dur: 0.07, vol: 0.06 }),
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
  // landing from a high jump: a soft thud
  land: () => { tone({ type: 'sine', f0: 140, f1: 60, dur: 0.08, vol: 0.18 }); noise({ dur: 0.06, vol: 0.05, freq: 600 }); },
  // into / out of the water, a swim stroke, a bubble popping
  splash: (big) => { noise({ dur: big ? 0.45 : 0.25, vol: big ? 0.25 : 0.14, freq: 2600, type: 'bandpass', sweep: false }); tone({ type: 'sine', f0: 700, f1: 200, dur: 0.12, vol: 0.06 }); },
  stroke: () => { tone({ type: 'sine', f0: jit(260, 0.2), f1: 520, dur: 0.1, vol: 0.09 }); noise({ dur: 0.12, vol: 0.05, freq: 1500, type: 'bandpass', sweep: false }); },
  bubble: () => tone({ type: 'sine', f0: jit(500, 0.4), f1: 1400, dur: 0.06, vol: 0.06 }),
  // kill streak: each kill in a chain pings a little higher
  combo(n) {
    const m = 72 + Math.min(n, 14);
    tone({ type: 'pulse25', f0: N(m), dur: 0.06, vol: 0.07 });
    tone({ type: 'pulse25', f0: N(m + 7), dur: 0.08, vol: 0.06, at: 0.05 });
  },
  comboBig: () => melody([79, 84, 88, 91], 0.06, 'pulse25', 0.12),
  oneUp: () => melody([76, 79, 88, 84, 86, 91], 0.08, 'pulse25', 0.13),
  // a secret found: the classic "puzzle solved" rising run
  secret: () => melody([67, 66, 63, 57, 56, 64, 68, 72], 0.085, 'pulse25', 0.12),
  // bouncing off an enemy's head
  stomp: () => { tone({ type: 'square', f0: 220, f1: 880, dur: 0.12, vol: 0.12 }); noise({ dur: 0.08, vol: 0.1, freq: 900 }); },
  // a boss changes phase: low roar and a metallic shriek
  roar() {
    tone({ type: 'sawtooth', f0: 110, f1: 55, dur: 0.9, vol: 0.22, vib: 0.08 });
    tone({ type: 'sawtooth', f0: 220, f1: 140, dur: 0.7, vol: 0.1, vib: 0.1 });
    noise({ dur: 0.8, vol: 0.2, freq: 1400 });
  },
  // the final blow on a boss: a long collapse, then a short fanfare
  bossDown() {
    for (let i = 0; i < 6; i++) noise({ dur: 0.6, vol: 0.35 - i * 0.04, freq: 1200 - i * 120, at: i * 0.22 });
    tone({ type: 'triangle', f0: 160, f1: 30, dur: 1.6, vol: 0.4 });
  },
  pause: () => { tone({ type: 'pulse25', f0: 988, dur: 0.06, vol: 0.08 }); tone({ type: 'pulse25', f0: 1319, dur: 0.08, vol: 0.08, at: 0.07 }); },
  select: () => tone({ type: 'pulse25', f0: 1047, f1: 1400, dur: 0.05, vol: 0.06 }),
  start: () => melody([67, 72, 76, 79, 0, 76, 79, 84], 0.09),
  clear: () => melody([72, 72, 76, 79, 76, 79, 84, 0, 83, 84], 0.13),
  gameOver: () => melody([72, 71, 69, 67, 0, 64, 62, 60], 0.18, 'triangle', 0.2),
};

// ---------------- music ----------------
// Songs are written as text, one token per 16th-note step:
//   lead/harmony: a note ("A4", "C#5", "Bb3"), "." rest, "-" hold the previous note
//   drums: k kick, s snare, h hat, o open hat, x kick+hat, m metal clang, c crash, "." rest
// Bass lines are built from one root per bar and a 16-step style: R root, O octave, F fifth, "." rest.

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(tok) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(tok);
  if (!m) throw new Error('bad note ' + tok);
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

// "A4 - . C5" -> [{m, len}, null, null, {m, len}] (len in steps)
function track(src) {
  const toks = src.split(/[\s|]+/).filter(Boolean);
  const out = toks.map(() => null);
  let last = -1;
  toks.forEach((tk, i) => {
    if (tk === '-') { if (last >= 0) out[last].len++; return; }
    last = -1;
    if (tk === '.') return;
    out[i] = { m: midi(tk), len: 1 };
    last = i;
  });
  return out;
}

function bass(roots, style) {
  const out = [];
  for (const r of roots.split(/\s+/)) {
    const m = midi(r);
    for (const ch of style) out.push(ch === 'R' ? { m, len: 1 } : ch === 'O' ? { m: m + 12, len: 1 } : ch === 'F' ? { m: m + 7, len: 1 } : null);
  }
  return out;
}

// arpeggio: chord tones cycled through a 16-step index pattern, one chord per bar
function arp(chords, pattern = '0123210101232101') {
  const out = [];
  for (const c of chords.split(/\s+/)) {
    const notes = c.split('/').map(midi);
    for (const ch of pattern) out.push(ch === '.' ? null : { m: notes[Number(ch) % notes.length], len: 1 });
  }
  return out;
}

const drums = (src) => src.replace(/[\s|]+/g, '').split('');
const rep = (s, n) => Array(n).fill(s).join(' ');

const SONGS = {
  title: {
    name: '喵斗羅 Theme',
    step: 0.13,
    lead: track(`C5 - - G4 C5 - E5 - G5 - - - E5 - C5 - | D5 - - B4 D5 - F5 - A5 - - - G5 - - -
                 E5 - - C5 E5 - G5 - C6 - - - B5 - A5 - | G5 - F5 - E5 - D5 - C5 - - - - - . .`),
    leadType: 'pulse25',
    harm: arp('C4/E4/G4 G3/B3/D4 A3/C4/E4 F3/A3/C4', '0.1.2.1.0.1.2.1.'),
    bass: bass('C3 G2 A2 G2', 'R.O.R.O.R.O.R.FO'),
    drums: drums(`c...s...k.k.s... ${rep('k...s...k.k.s...', 2)} k...s...k.k.s.ss`),
  },
  // stage 1 back-alley: the original loop plus a second half
  stage1: {
    name: '後巷貓草叢',
    step: 0.11,
    lead: track(`A4 . C5 . E5 . D5 C5 B4 . C5 . D5 . . . | A4 . C5 . E5 . G5 F5 E5 . D5 . C5 . B4 .
                 F5 . E5 D5 C5 . D5 E5 F5 . G5 . A5 . . . | A5 G5 F5 E5 D5 . E5 . C5 . B4 . A4 . . .
                 E5 - - D5 C5 - D5 - E5 - A5 - G5 - E5 - | F5 - - E5 D5 - C5 - D5 - - - . . . .
                 E5 - - D5 C5 - D5 - E5 - C6 - B5 - G5 - | A5 - - - G5 - E5 - A5 - - - - - . .`),
    bass: bass('A2 F2 F2 E2 A2 F2 C3 A2', 'R.ROR.ROR.ROR.RO'),
    harm: arp('A3/C4/E4 F3/A3/C4 F3/A3/C4 E3/G#3/B3 A3/C4/E4 F3/A3/C4 C4/E4/G4 A3/C4/E4', '0.1.2.1.0.1.2.1.'),
    drums: drums(rep('k.h.s.h.k.khs.h.', 7) + ' k.h.s.h.k.s.s.ss'),
  },
  // stage 2 pet hospital: sneaky staccato, funky bass, ticking hats
  stage2: {
    name: '寵物醫院走廊',
    step: 0.12,
    lead: track(`D5 . F5 . A5 . G#5 A5 . . F5 . D5 . . . | E5 . G5 . Bb5 . A5 G5 . . E5 . C#5 . . .
                 D5 . F5 . A5 . D6 . C6 . Bb5 . A5 . G5 . | F5 . E5 . D5 . C#5 . D5 - - - . . . .
                 A5 - - - G5 - - - F5 - E5 - D5 - - - | Bb4 . D5 . F5 . Bb5 - A5 . G5 . F5 . E5 .
                 A5 - - - G5 - - - F5 - E5 - D5 - F5 - | E5 . E5 . E5 . F5 . G5 . A5 . C#6 - - -`),
    leadType: 'pulse25',
    bass: bass('D2 A1 D2 A1 D2 Bb1 D2 A1', 'RRO.R.O.RRO.F.O.'),
    drums: drums(rep('k..hs.h.k.k.s..h', 7) + ' k..hs.h.k.k.s.ss'),
  },
  // stage 3 fish-tank falls: flowing arpeggios, slow roots, soft drums
  stage3: {
    name: '大魚缸瀑布',
    step: 0.125,
    lead: track(`B4 - - - E5 - - - G5 - F#5 - E5 - - - | G5 - - - E5 - - - C5 - D5 - E5 - - -
                 D5 - - - G5 - - - B5 - A5 - G5 - - - | F#5 - - - - - - - A5 - - - - - . .
                 B5 - - - A5 - G5 - E5 - - - D5 - E5 - | G5 - - - E5 - - - C5 - - - E5 - G5 -
                 A5 - - - F#5 - - - D5 - E5 - F#5 - A5 - | B5 - - - - - - - D#5 - - - F#5 - - -`),
    leadType: 'triangle',
    leadVol: 0.2,
    harm: arp('E4/G4/B4/E5 C4/E4/G4/C5 G3/B3/D4/G4 D4/F#4/A4/D5 E4/G4/B4/E5 C4/E4/G4/C5 D4/F#4/A4/D5 B3/D#4/F#4/B4', '0123321001233210'),
    harmType: 'pulse12',
    bass: bass('E2 C2 G2 D2 E2 C2 D2 B1', 'R.......O...R...'),
    drums: drums(rep('k.....h.s.....h.', 7) + ' k.....h.s...s.s.'),
  },
  // stage 4 basement lab: driving 16th bass, metal clangs
  stage4: {
    name: '醫院地庫',
    step: 0.105,
    lead: track(`C5 . . C5 . . Eb5 . . . G5 . F5 . Eb5 . | D5 . . D5 . . F5 . Eb5 . D5 . C5 - - -
                 C5 . . C5 . . Eb5 . . . Ab5 . G5 . F5 . | G5 - - - . . B4 . D5 . F5 . G5 - - -
                 C6 - - - Bb5 - - - G5 - - - Eb5 - F5 - | G5 - - - Eb5 - C5 - Eb5 - - - . . . .
                 Ab5 - - - G5 - F5 - Eb5 - - - D5 - Eb5 - | D5 - - - B4 - - - G4 - - - B4 - D5 -`),
    bass: bass('C2 C2 Ab1 G1 C2 Eb2 Ab1 G1', 'RRORRORRRORRORRO'),
    drums: drums(rep('k.h.s.hkk.hms.h.', 7) + ' k.h.s.hkk.s.ssss'),
  },
  // mid-bosses: the original boss loop
  boss: {
    name: 'WARNING',
    step: 0.1,
    lead: [76, 0, 75, 76, 0, 0, 79, 0, 77, 0, 76, 0, 74, 0, 0, 0, 76, 0, 75, 76, 0, 0, 81, 0, 79, 0, 77, 0, 76, 0, 75, 0,
      88, 0, 87, 88, 0, 0, 84, 0, 83, 0, 81, 0, 79, 0, 0, 0, 81, 0, 83, 84, 0, 83, 81, 79, 77, 0, 76, 0, 75, 0, 76, 0].map((m) => (m ? { m, len: 2 } : null)),
    bass: [40, 40, 52, 40, 41, 41, 53, 41, 40, 40, 52, 40, 43, 43, 55, 44, 40, 40, 52, 40, 41, 41, 53, 41, 38, 38, 50, 38, 39, 39, 51, 39,
      40, 40, 52, 40, 41, 41, 53, 41, 40, 40, 52, 40, 43, 43, 55, 44, 45, 45, 57, 45, 43, 43, 55, 43, 41, 41, 53, 41, 39, 39, 51, 39].map((m) => ({ m, len: 1 })),
    drums: drums(rep('k.hks.h.k.hks.hs', 4)),
  },
  // stage bosses: faster, darker, chromatic
  final: {
    name: 'BOSS',
    step: 0.095,
    lead: track(`E5 - B4 - E5 - F5 - E5 - - - B4 - - - | E5 - B4 - E5 - G5 - F5 - E5 - D5 - - -
                 C6 - - - B5 - - - A5 - G5 - F5 - - - | E5 - F5 - G5 - A5 - B5 - - - - - . .
                 E6 . E6 . D6 . E6 . C6 - - - B5 - - - | A5 . A5 . G5 . A5 . F5 - - - E5 - - -
                 E5 F5 G5 A5 B5 C6 B5 A5 G5 F5 E5 F5 G5 A5 G5 F5 | E5 - - - - - - - E4 . E4 . E4 . B4 .`),
    leadType: 'pulse25',
    bass: bass('E2 E2 F2 E2 E2 D2 C2 B1', 'RRORRRORRROFRROR'),
    harm: arp('E3/B3 E3/B3 F3/C4 E3/B3 E3/B3 D3/A3 C3/G3 B2/F#3', '0.1.0.1.0.1.0.1.'),
    harmType: 'sawtooth',
    drums: drums(rep('x.k.s.k.x.k.s.ks', 7) + ' x.k.s.k.s.s.ssss'),
  },
  // catnip invincibility: a bouncy major-key sprint
  catnip: {
    name: '貓草無敵',
    step: 0.075,
    lead: track(`C5 . C5 . C5 . D5 C5 . C5 . E5 . G5 . . | B4 . B4 . B4 . C5 B4 . B4 . D5 . G5 . .`),
    leadType: 'pulse25',
    bass: bass('C3 G2', 'R.O.R.O.R.O.R.O.'),
    harm: arp('C5/E5/G5 B4/D5/G5', '0120120120120120'),
    harmType: 'pulse12',
    drums: drums('k.h.s.h.k.h.s.hs k.h.s.h.k.h.s.hs'),
  },
};

export const __songs = SONGS;
export const SONG_LIST = ['title', 'stage1', 'stage2', 'stage3', 'stage4', 'boss', 'final', 'catnip'];
export const songName = (k) => (SONGS[k] ? SONGS[k].name : k);

function drum(ch, at) {
  const bus = musicBus;
  if (ch === 'k' || ch === 'x') tone({ type: 'sine', f0: 150, f1: 42, dur: 0.11, vol: 0.6, at, bus });
  if (ch === 's') { noise({ dur: 0.12, vol: 0.32, freq: 2600, at, type: 'bandpass', sweep: false, bus }); tone({ type: 'triangle', f0: 220, f1: 140, dur: 0.06, vol: 0.2, at, bus }); }
  if (ch === 'h' || ch === 'x') noise({ dur: 0.04, vol: 0.18, freq: 7000, at, type: 'highpass', sweep: false, bus });
  if (ch === 'o') noise({ dur: 0.16, vol: 0.16, freq: 6500, at, type: 'highpass', sweep: false, bus });
  if (ch === 'm') { tone({ type: 'square', f0: 1840, f1: 1700, dur: 0.07, vol: 0.06, at, bus }); noise({ dur: 0.08, vol: 0.12, freq: 5000, at, type: 'bandpass', sweep: false, bus }); }
  if (ch === 'c') noise({ dur: 0.9, vol: 0.22, freq: 5000, at, type: 'highpass', sweep: false, bus });
}

let current = null; // name of the song playing (null = silence)
let rate = 1;
export const currentMusic = () => current;
// tempo multiplier: a boss on its last legs speeds the music up
export function setMusicRate(r) { rate = r; }
// muffle the music (heroes under water)
export function setMuffle(on) {
  if (!ac) return;
  musicFilter.frequency.cancelScheduledValues(ac.currentTime);
  musicFilter.frequency.setTargetAtTime(on ? 700 : 18000, ac.currentTime, 0.12);
}

export function startMusic(kind = 'stage1') {
  stopMusic();
  if (kind === 'stage') kind = 'stage1';
  if (!ac || !SONGS[kind]) return;
  current = kind;
  rate = 1;
  const song = SONGS[kind];
  const at0 = (len) => len * song.step / rate;
  let i = 0;
  let next = ac.currentTime + 0.05;
  musicTimer = setInterval(() => {
    while (next < ac.currentTime + 0.2) {
      const at = next - ac.currentTime;
      const step = song.step / rate;
      const pick = (arr) => (arr ? arr[i % arr.length] : null);
      const b = pick(song.bass);
      const l = pick(song.lead);
      const h = pick(song.harm);
      const d = pick(song.drums);
      if (b) tone({ type: 'triangle', f0: N(b.m), dur: step * 0.9 * b.len, vol: 0.5, at, bus: musicBus });
      if (l) {
        const dur = Math.max(step * 1.6, at0(l.len) * 0.95);
        tone({ type: song.leadType || 'square', f0: N(l.m), dur, vol: song.leadVol || 0.13, at, bus: musicBus, vib: l.len >= 3 ? 0.012 : 0, echo: 0.6 });
      }
      if (h) tone({ type: song.harmType || 'triangle', f0: N(h.m), dur: step * 0.9, vol: song.harmType === 'sawtooth' ? 0.035 : 0.06, at, bus: musicBus });
      if (d && d !== '.') drum(d, at);
      i++;
      next += step;
    }
  }, 40);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  current = null;
}
