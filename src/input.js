// Turns every device into the same per-player action state:
// { mx, down, up, aim, fire, jump, jumpHeld, dash, skill, lock, pause, assist }
// Game code reads only these actions, never key codes.

import { t } from './i18n.js';
import { getTouchState } from './touch.js';
import { options } from './options.js';

const STORE_KEY = 'contracat.bindings.v1';

export const ACTION_LABELS = {
  left: t('act.left'),
  right: t('act.right'),
  up: t('act.up'),
  down: t('act.down'),
  jump: t('act.jump'),
  dash: t('act.dash'),
  skill: t('act.skill'),
  lock: t('act.lock'),
  pause: t('act.pause'),
};

export const PROFILE_LABELS = {
  pc: t('prof.pc'),
  classic1: t('prof.classic1'),
  classic2: t('prof.classic2'),
};

export const DEFAULT_BINDINGS = {
  pc: {
    left: ['KeyA'], right: ['KeyD'], down: ['KeyS'],
    jump: ['Space', 'KeyW'], dash: ['ShiftLeft'], skill: ['KeyE'], pause: ['Escape'],
  },
  classic1: {
    left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
    jump: ['KeyJ'], dash: ['KeyK'], lock: ['KeyL'], skill: ['KeyI'], pause: ['Escape'],
  },
  classic2: {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    jump: ['Numpad1', 'Period'], dash: ['Numpad2', 'Slash'], lock: ['Numpad3', 'ShiftRight'],
    skill: ['Numpad5', 'Quote'], pause: ['Enter'],
  },
};

const clone = (o) => JSON.parse(JSON.stringify(o));

function loadBindings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.pc && s.classic1 && s.classic2) return s;
  } catch { /* storage blocked: use defaults */ }
  return clone(DEFAULT_BINDINGS);
}

let bindings = loadBindings();

function saveBindings() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(bindings)); } catch { /* not persisted */ }
}

export const getBindings = () => bindings;

// What to press for the skill, shown when it becomes ready; `short` fits the HUD
export function skillKeyLabel(ctl, short = false) {
  const key = (code) => (short && code && code.startsWith('Numpad') ? t('key.numShort', { n: code.slice(6) }) : keyName(code));
  if (!ctl) return t('skillkey.touchShort');
  if (ctl.kind === 'mouse') return short ? key(bindings.pc.skill[0]) : t('skillkey.mouse', { key: key(bindings.pc.skill[0]) });
  if (ctl.kind === 'classic') return key(bindings[ctl.profile].skill[0]);
  if (ctl.kind === 'pad') return short ? 'LB' : t('skillkey.pad');
  return short ? t('skillkey.touchShort') : t('skillkey.touch');
}
export function setBinding(profile, action, code) {
  bindings[profile][action] = [code];
  saveBindings();
}
export function resetBindings() {
  bindings = clone(DEFAULT_BINDINGS);
  saveBindings();
}

const KEY_NAMES = {
  Space: 'Space', Escape: 'Esc', Enter: 'Enter', ShiftLeft: t('key.lshift'), ShiftRight: t('key.rshift'),
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  Period: '.', Slash: '/', Quote: "'", Comma: ',', Semicolon: ';',
  ControlLeft: t('key.lctrl'), ControlRight: t('key.rctrl'), AltLeft: t('key.lalt'), AltRight: t('key.ralt'), Tab: 'Tab',
};
export function keyName(code) {
  if (!code) return '—';
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return t('key.num', { n: code.slice(6) });
  return code;
}

// --- keyboard ---
const held = new Set();
// keys pressed since the last frame, so a tap shorter than one frame still counts
const tapped = new Set();
let captureCb = null;
export function captureNextKey(cb) { captureCb = cb; }

const BLOCK_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash', 'Quote', 'Tab']);

window.addEventListener('keydown', (e) => {
  if (captureCb) {
    e.preventDefault();
    const cb = captureCb;
    captureCb = null;
    cb(e.code === 'Escape' ? null : e.code);
    return;
  }
  held.add(e.code);
  if (!e.repeat) {
    tapped.add(e.code);
    feedKonamiKey(e.code);
  }
  if (BLOCK_DEFAULT.has(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => held.clear());

const isDown = (profile, action) => (bindings[profile][action] || []).some((c) => held.has(c));
const isPressed = (profile, action) => (bindings[profile][action] || []).some((c) => held.has(c) || tapped.has(c));

// True if a key bound to this action was pressed since the last frame (used for keyboard drop-in).
export const tappedAction = (profile, action) => (bindings[profile][action] || []).some((c) => tapped.has(c));

// Keys used by profiles that can be active at the same time must not overlap.
const PARTNERS = { pc: ['classic2'], classic1: ['classic2'], classic2: ['pc', 'classic1'] };
export function bindingConflicts(profile) {
  const out = {};
  const mine = bindings[profile];
  for (const [action, codes] of Object.entries(mine)) {
    for (const code of codes) {
      for (const [a2, c2] of Object.entries(mine)) {
        if (a2 !== action && c2.includes(code)) out[action] = t('clash.same', { a: ACTION_LABELS[a2] });
      }
      for (const other of PARTNERS[profile]) {
        for (const [a2, c2] of Object.entries(bindings[other])) {
          if (c2.includes(code) && !(action === 'pause' && a2 === 'pause')) {
            out[action] = t('clash.other', { p: PROFILE_LABELS[other], a: ACTION_LABELS[a2], key: keyName(code) });
          }
        }
      }
    }
  }
  return out;
}

// Call at the end of every frame.
export function endInputFrame() {
  tapped.clear();
  mouse.leftTap = false;
  mouse.rightTap = false;
}

// --- mouse (logical 640x360 coordinates) ---
export const mouse = { x: 400, y: 180, left: false, right: false, leftTap: false, rightTap: false, active: false };

export function bindMouse(canvas, W, H) {
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * W;
    mouse.y = ((e.clientY - r.top) / r.height) * H;
  };
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    at(e);
    mouse.active = true;
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    at(e);
    mouse.active = true;
    if (e.button === 0) { mouse.left = true; mouse.leftTap = true; }
    if (e.button === 2) { mouse.right = true; mouse.rightTap = true; }
  });
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// --- Konami code: up up down down left right left right + jump, from any device ---
const SEQ = 'UUDDLRLRJ';
let konamiBuf = '';
let konamiCb = null;
export function onKonami(cb) { konamiCb = cb; }
function feedToken(t) {
  konamiBuf = (konamiBuf + t).slice(-SEQ.length);
  if (konamiBuf === SEQ) {
    konamiBuf = '';
    if (konamiCb) konamiCb();
  }
}
const DIR_KEYS = {
  ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D',
  ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R',
};
function feedKonamiKey(code) {
  if (DIR_KEYS[code]) return feedToken(DIR_KEYS[code]);
  if (Object.values(bindings).some((p) => (p.jump || []).includes(code))) feedToken('J');
}

// --- gamepads ---
const btn = (gp, i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
const padPrev = {};

// Call once per frame. Returns indices of pads that pressed A or Start (used for drop-in join).
export function pollPads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const joined = [];
  for (const gp of pads) {
    if (!gp) continue;
    const prev = padPrev[gp.index] || {};
    const cur = {
      U: btn(gp, 12) || gp.axes[1] < -0.6,
      D: btn(gp, 13) || gp.axes[1] > 0.6,
      L: btn(gp, 14) || gp.axes[0] < -0.6,
      R: btn(gp, 15) || gp.axes[0] > 0.6,
      J: btn(gp, 0),
      S: btn(gp, 9),
    };
    for (const k of 'UDLR') if (cur[k] && !prev[k]) feedToken(k);
    if (cur.J && !prev.J) { feedToken('J'); joined.push(gp.index); }
    if (cur.S && !prev.S) joined.push(gp.index);
    padPrev[gp.index] = cur;
  }
  return joined;
}

export function connectedPads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  return [...pads].filter(Boolean).map((p) => p.index);
}

// --- controllers ---
class Ctl {
  constructor() { this.prev = {}; }
  edge(k, v) {
    const p = this.prev[k];
    this.prev[k] = v;
    return !!v && !p;
  }
}

const NEUTRAL = { mx: 0, down: false, up: false, aim: null, fire: false, jump: false, jumpHeld: false, dash: false, skill: false, lock: false, pause: false, assist: 0 };

export class MouseKeyboardCtl extends Ctl {
  constructor() { super(); this.kind = 'mouse'; this.label = t('prof.pc'); }
  poll(p, cam) {
    const P = 'pc';
    const mx = (isDown(P, 'right') ? 1 : 0) - (isDown(P, 'left') ? 1 : 0);
    const ax = mouse.x + cam.x - (p.x + p.w / 2);
    const ay = mouse.y - (p.y + p.h * 0.4);
    const l = Math.hypot(ax, ay) || 1;
    return {
      mx,
      down: isDown(P, 'down'),
      up: false,
      aim: mouse.active ? { x: ax / l, y: ay / l } : null,
      fire: mouse.left || mouse.leftTap,
      jump: this.edge('j', isPressed(P, 'jump')),
      jumpHeld: isDown(P, 'jump'),
      dash: this.edge('d', isPressed(P, 'dash')),
      skill: this.edge('s', isPressed(P, 'skill') || mouse.right || mouse.rightTap),
      lock: false,
      pause: this.edge('p', isPressed(P, 'pause')),
      assist: 10,
    };
  }
}

export class ClassicKeyboardCtl extends Ctl {
  constructor(profile) {
    super();
    this.profile = profile;
    this.kind = 'classic';
    this.label = PROFILE_LABELS[profile];
  }
  poll(p) {
    const P = this.profile;
    const l = isDown(P, 'left'), r = isDown(P, 'right'), u = isDown(P, 'up'), d = isDown(P, 'down');
    const mx = (r ? 1 : 0) - (l ? 1 : 0);
    // auto-aim: unless up (or down in mid-air) is held, the game picks the target
    const manual = u || (d && !p.onGround);
    if (options.autoAim && !manual) {
      return {
        mx, down: d, up: u, aim: null, autoAim: true, fire: 'auto',
        jump: this.edge('j', isPressed(P, 'jump')),
        jumpHeld: isDown(P, 'jump'),
        dash: this.edge('d', isPressed(P, 'dash')),
        skill: this.edge('s', isPressed(P, 'skill')),
        lock: isDown(P, 'lock'),
        pause: this.edge('p', isPressed(P, 'pause')),
        assist: 0,
      };
    }
    let ax = mx;
    let ay = (d ? 1 : 0) - (u ? 1 : 0);
    // standing still and pressing down = crouch and shoot forward
    if (ay > 0 && ax === 0 && p.onGround) ay = 0;
    if (ax === 0 && ay === 0) ax = p.facing;
    const len = Math.hypot(ax, ay);
    return {
      mx,
      down: d,
      up: u,
      aim: { x: ax / len, y: ay / len },
      fire: 'auto',
      jump: this.edge('j', isPressed(P, 'jump')),
      jumpHeld: isDown(P, 'jump'),
      dash: this.edge('d', isPressed(P, 'dash')),
      skill: this.edge('s', isPressed(P, 'skill')),
      lock: isDown(P, 'lock'),
      pause: this.edge('p', isPressed(P, 'pause')),
      assist: 0,
    };
  }
}

export class GamepadCtl extends Ctl {
  constructor(index) {
    super();
    this.index = index;
    this.kind = 'pad';
    this.label = t('ctl.pad');
  }
  poll() {
    const gp = (navigator.getGamepads ? navigator.getGamepads() : [])[this.index];
    if (!gp) return NEUTRAL;
    const dz = (v) => (Math.abs(v) < 0.25 ? 0 : v);
    let lx = dz(gp.axes[0] || 0);
    let ly = dz(gp.axes[1] || 0);
    if (btn(gp, 14)) lx = -1;
    if (btn(gp, 15)) lx = 1;
    if (btn(gp, 12)) ly = -1;
    if (btn(gp, 13)) ly = 1;
    const rx = gp.axes[2] || 0;
    const ry = gp.axes[3] || 0;
    const rm = Math.hypot(rx, ry);
    let aim = null;
    let fire = false;
    if (rm > 0.4) {
      aim = { x: rx / rm, y: ry / rm };
      fire = true;
    } else if (btn(gp, 7) || btn(gp, 2)) {
      // no right stick: RT / X fires along the left stick, or straight ahead
      fire = true;
      const lm = Math.hypot(lx, ly);
      aim = lm > 0.3 ? { x: lx / lm, y: ly / lm } : null;
    }
    return {
      mx: Math.abs(lx) > 0.3 ? Math.sign(lx) * Math.min(1, Math.abs(lx) * 1.3) : 0,
      down: ly > 0.6,
      up: ly < -0.6,
      aim,
      fire,
      jump: this.edge('j', btn(gp, 0)),
      jumpHeld: btn(gp, 0),
      dash: this.edge('d', btn(gp, 5) || btn(gp, 1)),
      skill: this.edge('s', btn(gp, 4) || btn(gp, 3)),
      lock: btn(gp, 6),
      pause: this.edge('p', btn(gp, 9)),
      assist: 20,
    };
  }
}

export class TouchCtl extends Ctl {
  constructor() { super(); this.kind = 'touch'; this.label = t('ctl.touch'); }
  poll() {
    const t = getTouchState();
    const aim = t.rActive && t.rm > 0.3 ? { x: t.rx / t.rm, y: t.ry / t.rm } : null;
    return {
      mx: Math.abs(t.lx) > 0.3 ? Math.sign(t.lx) : 0,
      down: t.ly > 0.6,
      up: t.ly < -0.6,
      aim,
      // aim stick idle: auto-aim at the nearest enemy (if enabled) so one hand can just move
      autoAim: !aim && options.autoAim,
      fire: aim ? true : options.autoAim ? 'auto' : false,
      jump: this.edge('j', t.jump),
      jumpHeld: t.jump,
      dash: this.edge('d', t.dash),
      skill: this.edge('s', t.skill),
      lock: false,
      pause: false,
      assist: 20,
    };
  }
}
