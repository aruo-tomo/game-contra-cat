// Stage 2 (pet hospital) enemies, hazards and bosses. Every new foe attacks in its own way so the
// player has to read the field: arcing syringes, lingering gas, a shield that eats bullets, a yowl
// that rolls along the floor, bombs from the ceiling, laser gates and beams, a lance charge, and a
// surgery machine that marks the floor, stabs and lobs.

import { t } from './i18n.js';
import { C, ink, rrect, drawRat } from './art.js';
import { sfx } from './audio.js';
import { frame, drawFrame, tintOf } from './sprites.js';
import { Enemy, RatSoldier, Rat, enemyShot, moveBody, overlap, FxAnim } from './entities.js';

export const CEIL = 44; // underside of the corridor ceiling

// ======================= SHOTS =======================

function drawSyringe(ctx, b) {
  const ang = Math.atan2(b.vy, b.vx);
  const f = frame('hshot', 'dart');
  if (f) return drawFrame(ctx, f, b.x, b.y, 26 / f.w, { anchor: 'center', rot: ang, ax: 0.75 });
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(ang);
  rrect(ctx, -12, -3, 14, 6, 2);
  ink(ctx, C.ink, 1.2);
  ctx.fillStyle = C.red;
  ctx.fillRect(-9, -1.5, 8, 3);
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(9, 0);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.restore();
}

// syringe dart; with gravity it arcs (thrown), without it flies straight (fired)
export function syringe(game, x, y, vx, vy, gravity = 0) {
  game.ebullets.push({
    x, y, vx, vy, gravity, t: 0, kind: 'syringe', r: 4, draw: drawSyringe,
    // a thrown syringe sticks in the floor and breaks instead of sinking through it
    update(b) {
      const top = b.vy > 0 ? game.groundTopAt(b.x) : null;
      if (top != null && b.y >= top - 2 && b.y - b.vy / 60 < top + 6) {
        b.dead = true;
        game.effects.push(new FxAnim('impact', 'hit', b.x, top - 3, 0.14, 0.25, { rot: Math.random() * 6 }));
      }
    },
  });
  sfx.enemyShot();
}

// throw a syringe so it lands near (tx, ty) after `T` seconds
export function lobSyringe(game, x, y, tx, ty, T = 0.75, g = 520) {
  syringe(game, x, y, (tx - x) / T, (ty - y - 0.5 * g * T * T) / T, g);
}

function drawGas(ctx, b) {
  const fade = Math.min(1, b.t * 4, (b.life - b.t) * 2);
  const grow = 0.7 + Math.min(1, b.t * 1.5) * 0.5;
  const f = frame('hshot', 'gas');
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade) * 0.9;
  if (f) drawFrame(ctx, f, b.x, b.y, ((b.r * 2.6) / f.w) * grow, { anchor: 'center', rot: Math.sin(b.t * 2 + b.seed) * 0.3 });
  else {
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(b.x + Math.cos(i * 1.7 + b.seed) * 6 * grow, b.y + Math.sin(i * 2.3 + b.seed) * 4 * grow, b.r * 0.7 * grow, 0, Math.PI * 2);
      ink(ctx, '#7F9671', 1.5);
    }
  }
  ctx.restore();
}

// disinfectant gas: drifts, slows down, hangs in the air for a while and hurts whoever walks in
export function gasPuff(game, x, y, vx, vy) {
  game.ebullets.push({
    x, y, vx, vy, t: 0, kind: 'gas', r: 13, linger: true, drag: 1.8, life: 2.6, seed: Math.random() * 6, draw: drawGas,
    update(b) { b.vy -= 4 * (1 / 60); if (b.t > b.life) b.dead = true; },
  });
}

function drawPill(ctx, b) {
  const f = frame('hshot', 'pill', b.t * 8);
  if (f) return drawFrame(ctx, f, b.x, b.y, 24 / f.h, { anchor: 'center', rot: b.t * 5 });
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.t * 5);
  rrect(ctx, -9, -5, 18, 10, 5);
  ink(ctx, C.ink, 1.5);
  ctx.fillStyle = C.red;
  ctx.fillRect(0, -4, 8, 8);
  ctx.restore();
}

// capsule pill bomb: lobbed, bursts on the floor (main.js handles every shot with `bomb`)
export function pillBomb(game, x, y, tx, ty, T = 0.85, g = 520) {
  game.ebullets.push({ x, y, vx: (tx - x) / T, vy: (ty - y - 0.5 * g * T * T) / T, gravity: g, t: 0, kind: 'pill', r: 6, bomb: true, draw: drawPill });
  sfx.enemyShot();
}

function drawWave(ctx, b) {
  const dir = Math.sign(b.vx) || 1;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(dir, 1);
  const a = Math.min(1, (1.6 - b.t) * 3);
  ctx.globalAlpha = Math.max(0, a);
  for (let i = 0; i < 3; i++) {
    const r = 8 + i * 6 + Math.sin(b.t * 30 + i) * 1.2;
    ctx.beginPath();
    ctx.arc(-i * 7, 0, r, -1.1, 1.1);
    ctx.lineWidth = 4 - i;
    ctx.strokeStyle = i === 0 ? C.red : C.ink;
    ctx.stroke();
  }
  ctx.restore();
}

// the cone cat's yowl: a sound wave that rolls along the floor; jump it
export function floorWave(game, x, floorY, dir) {
  const g = game;
  game.ebullets.push({
    x, y: floorY - 10, vx: dir * 230, vy: 0, t: 0, kind: 'wave', r: 10, linger: true, draw: drawWave,
    update(b) {
      const top = g.groundTopAt(b.x);
      if (top == null || Math.abs(top - (b.y + 10)) > 4 || b.t > 1.6) b.dead = true;
    },
  });
}

// ======================= SOLDIERS =======================

// frames for the new soldiers are 92px tall when standing (like the stage-1 rats)
const PTS = { nurse: { x: 14, y: 6 }, shield: { x: 20, y: 19 }, spray: { x: 30, y: 24 } };

class HospRat extends RatSoldier {
  point(key) {
    const m = PTS[key];
    return { x: this.cx + this.facing * m.x, y: this.y + m.y };
  }
  // walk toward the nearest hero until `near` away (without walking off a ledge)
  approach(p, near, speed) {
    this.vx = 0;
    if (!p || !this.onGround) return;
    const dx = p.cx - this.cx;
    if (Math.abs(dx) <= near) return;
    const dir = Math.sign(dx);
    const ahead = this.cx + dir * 20;
    const top = this.game.groundTopAt(ahead);
    const plank = this.game.level.platforms().some((q) => ahead > q.x && ahead < q.x + q.w && Math.abs(q.y - (this.y + this.h)) < 4);
    if ((top != null && Math.abs(top - (this.y + this.h)) < 4) || plank) this.vx = dir * speed;
  }
  gen(ctx, key, anim, i, h, ref = 92) {
    return this.drawGen(ctx, key, anim, i, h / ref, { flip: -this.facing, dy: 1 });
  }
}

// Nurse medic: lobs a fan of three syringes, and patches up hurt Red Mouse soldiers nearby
export class Nurse extends HospRat {
  constructor(game, x, groundY) {
    super(game, x, groundY, 24, 40, 3, 400);
    this.cool = 1 + Math.random();
    this.healT = 2.5;
    this.pulse = 0;
  }
  update(dt) {
    const p = this.stand(dt);
    this.vx = 0;
    this.pulse = Math.max(0, this.pulse - dt);
    if (!p || !this.game.onScreen(this)) return;
    this.cool -= dt;
    if (this.cool <= 0) {
      this.cool = 2.4 + Math.random() * 0.6;
      const m = this.point('nurse');
      const ty = p.y + p.h - 6;
      for (const off of [-46, 0, 46]) lobSyringe(this.game, m.x, m.y, p.cx + off, ty, 0.8);
      this.fireT = 0.3;
    }
    this.healT -= dt;
    if (this.healT <= 0) {
      this.healT = 3.2;
      const patient = this.game.enemies.find((e) => e !== this && e.villain && !e.dead && !e.isWall && e.hp < e.maxHp && !e.kind && Math.hypot(e.cx - this.cx, e.cy - this.cy) < 170);
      if (patient) {
        patient.hp = Math.min(patient.maxHp, patient.hp + (patient.midboss ? 6 : 2));
        this.pulse = 0.5;
        this.patient = patient;
        this.game.text(patient.cx, patient.y - 8, t('nurse.heal'), C.greenDk);
        sfx.heal();
      }
    }
  }
  draw(ctx) {
    if (this.pulse > 0 && this.patient) {
      // green cross pulse on the soldier being healed: shoot the nurse first
      const k = 1 - this.pulse / 0.5;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.arc(this.patient.cx, this.patient.cy, 10 + k * 26, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#4FA36B';
      ctx.stroke();
      ctx.restore();
    }
    if (this.gen(ctx, 'nurse', this.fireT > 0 ? 'throw' : 'idle', 0, 46)) return;
    drawRat(ctx, this.cx, this.y + this.h, this.facing, this.t, { flash: this.flash > 0 });
    ctx.fillStyle = C.cream;
    ctx.fillRect(this.cx - 7, this.y - 4, 14, 7);
    ctx.fillStyle = C.red;
    ctx.fillRect(this.cx - 1.5, this.y - 3, 3, 5);
  }
}

// Shield guard: an X-ray light-box shield eats every shot from the front.
// It swings the shield aside to fire — that's the opening — or hit it from above / behind.
export class ShieldRat extends HospRat {
  constructor(game, x, groundY) {
    super(game, x, groundY, 28, 42, 5, 500);
    this.cycle = 1.2 + Math.random();
    this.open = 0; // > 0 while the shield is swung aside
    this.shots = 0;
  }
  blocks(b) {
    if (this.open > 0) return false;
    const fromFront = (b.x - this.cx) * this.facing > -2;
    const fromAbove = b.y < this.y + 4 && b.vy > 0;
    return fromFront && !fromAbove;
  }
  update(dt) {
    const p0 = this.game.nearestPlayer(this);
    if (this.open <= 0) this.approach(p0, 170, 32);
    else this.vx = 0;
    const p = this.stand(dt);
    if (!p || !this.game.onScreen(this)) return;
    if (this.open > 0) {
      this.open -= dt;
      this.shotT -= dt;
      if (this.shots > 0 && this.shotT <= 0 && this.open < 0.75) {
        const m = this.point('shield');
        enemyShot(this.game, m.x, m.y, Math.atan2(p.cy - m.y, p.cx - m.x), 240);
        this.fireT = 0.12;
        this.shots--;
        this.shotT = 0.22;
      }
      return;
    }
    this.cycle -= dt;
    this.cool = this.cycle; // drives the muzzle glint
    if (this.cycle <= 0) {
      this.cycle = 2.4 + Math.random() * 0.6;
      this.open = 1.1;
      this.shots = 2;
      this.shotT = 0;
    }
  }
  draw(ctx) {
    const firing = this.open > 0;
    if (this.gen(ctx, 'shield', firing ? 'fire' : 'walk', this.vx ? this.t * 6 : 0, 50, 96)) {
      if (!firing) { const m = this.point('shield'); this.warn(ctx, m.x, m.y); }
      return;
    }
    drawRat(ctx, this.cx, this.y + this.h, this.facing, this.t, { flash: this.flash > 0 });
    if (!firing) {
      rrect(ctx, this.cx + this.facing * 10 - 6, this.y - 2, 12, this.h, 2);
      ink(ctx, C.greenDk, 2);
    }
  }
}

// Sprayer: walks up close and fogs the floor with disinfectant that hangs around
export class Sprayer extends HospRat {
  constructor(game, x, groundY) {
    super(game, x, groundY, 24, 40, 3, 350);
    this.cool = 1.6 + Math.random();
    this.puffs = 0;
  }
  update(dt) {
    const p0 = this.game.nearestPlayer(this);
    if (this.puffs <= 0 && this.cool > 0.45) this.approach(p0, 140, 46);
    else this.vx = 0;
    const p = this.stand(dt);
    if (!p || !this.game.onScreen(this)) return;
    if (this.puffs > 0) {
      this.puffT -= dt;
      if (this.puffT <= 0) {
        const m = this.point('spray');
        gasPuff(this.game, m.x, m.y, this.facing * (150 + (4 - this.puffs) * 28), -12 + Math.random() * 24);
        this.puffs--;
        this.puffT = 0.13;
        this.fireT = 0.2;
      }
      return;
    }
    this.cool -= dt;
    if (this.cool <= 0) {
      this.cool = 2.6 + Math.random() * 0.6;
      this.puffs = 4;
      this.puffT = 0;
    } else if (this.cool < 0.45 && !this.hissed) {
      this.hissed = true; // tank hiss: the warning
      sfx.hiss();
    }
    if (this.cool > 0.45) this.hissed = false;
  }
  draw(ctx) {
    ctx.save();
    if (this.cool < 0.45 && this.puffs === 0) ctx.translate(Math.sin(this.t * 70) * 1.2, 0);
    const drew = this.gen(ctx, 'spray', this.fireT > 0 ? 'spray' : 'idle', 0, 46);
    ctx.restore();
    if (drew) return;
    drawRat(ctx, this.cx, this.y + this.h, this.facing, this.t, { flash: this.flash > 0 });
    ctx.beginPath();
    ctx.arc(this.cx - this.facing * 8, this.y + 18, 7, 0, Math.PI * 2);
    ink(ctx, C.yellow, 1.5);
  }
}

// Brainwashed patient cat in a cone collar: stomps toward you and yowls through the cone,
// sending a sound wave rolling along the floor
export class ConeCat extends Enemy {
  constructor(game, x, groundY, dir = -1) {
    super(game, x, groundY - 44, 26, 44, 3);
    this.cat = 'cone';
    this.score = 300;
    this.facing = dir;
    this.cool = 1.4 + Math.random() * 0.8;
    this.yowlT = 0;
  }
  update(dt) {
    this.base(dt);
    const g = this.game;
    const p = g.nearestPlayer(this);
    if (p && this.onGround && this.yowlT <= 0) this.facing = p.cx < this.cx ? -1 : 1;
    if (this.yowlT > 0) {
      this.vx = 0;
      this.yowlT -= dt;
      if (this.yowlT <= 0.25 && !this.waved) {
        this.waved = true;
        const top = g.groundTopAt(this.cx);
        if (top != null) floorWave(g, this.cx + this.facing * 16, top, this.facing);
        g.shake(2);
      }
    } else {
      this.vx = this.facing * 58;
      if (g.onScreen(this) && p && Math.abs(p.cx - this.cx) < 360) this.cool -= dt;
      if (this.cool <= 0 && this.onGround) {
        this.cool = 2.4 + Math.random() * 0.8;
        this.yowlT = 0.75;
        this.waved = false;
        sfx.yowl();
        if (Math.random() < 0.4) g.text(this.cx, this.y - 6, t('cone.yowl'), C.red);
      }
    }
    moveBody(this, dt, g.level);
    if (this.onGround && this.hitWall) this.vy = -440;
    if (this.y > 440 || this.x < g.cam.x - 160 || this.x > g.cam.x + g.W + 220) this.dead = true;
  }
  draw(ctx) {
    const yowling = this.yowlT > 0;
    ctx.save();
    if (yowling && this.yowlT > 0.25) ctx.translate(Math.sin(this.t * 80) * 1.5, 0);
    // generated frames face left
    const drew = this.drawGen(ctx, 'conecat', yowling ? 'yowl' : 'walk', this.t * 6, 54 / 112, { flip: this.facing < 0 ? 1 : -1, dy: 1 });
    ctx.restore();
    if (drew) return;
    this.drawSprite(ctx, 'cat05', 50, { flip: -this.facing, bob: Math.abs(Math.sin(this.t * 8)) * 2 });
    ctx.beginPath();
    ctx.moveTo(this.cx - 14, this.y + 4);
    ctx.lineTo(this.cx + 14, this.y + 4);
    ctx.lineTo(this.cx + 8, this.y + 18);
    ctx.lineTo(this.cx - 8, this.y + 18);
    ctx.closePath();
    ink(ctx, C.cream, 2);
  }
}

// Rat hanging upside down out of a ceiling vent, dropping pill bombs on whoever passes below;
// after a few bombs it lets go and fights on the floor as a rifle rat
export class VentRat extends Rat {
  constructor(game, x) {
    super(game, x, CEIL + 40);
    this.y = CEIL - 40;
    this.hang = true;
    this.peek = 0;
    this.bombs = 3;
    this.dropCool = 0.9;
  }
  update(dt) {
    if (!this.hang) return super.update(dt);
    this.base(dt);
    this.peek = Math.min(1, this.peek + dt * 2.5);
    this.y = CEIL - 40 + this.peek * 36;
    const p = this.game.nearestPlayer(this);
    if (!p) return;
    this.facing = p.cx < this.cx ? -1 : 1;
    this.dropCool -= dt;
    this.cool = this.dropCool;
    if (this.dropCool <= 0 && this.peek >= 1 && Math.abs(p.cx - this.cx) < 240) {
      this.dropCool = 1.15;
      pillBomb(this.game, this.cx, this.y + 30, p.cx + p.vx * 0.3, p.y + p.h - 4, 0.75);
      this.fireT = 0.2;
      this.bombs--;
    }
    if (this.bombs <= 0 && this.dropCool < 0.6) {
      this.hang = false;
      this.vy = 60;
      this.cool = 1.4;
    }
  }
  draw(ctx) {
    if (!this.hang) return super.draw(ctx);
    // the vent grille it pops out of
    rrect(ctx, this.cx - 20, CEIL - 6, 40, 8, 2);
    ink(ctx, '#3A3F3C', 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.x - 40, CEIL, this.w + 80, 200);
    ctx.clip();
    ctx.translate(this.cx, this.y + this.h / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-this.cx, -(this.y + this.h / 2));
    const drew = this.drawGen(ctx, 'rat', 'idle', 0, 46 / 92, { flip: this.facing, dy: 1 });
    if (!drew) drawRat(ctx, this.cx, this.y + this.h, -this.facing, this.t, { flash: this.flash > 0 });
    ctx.restore();
  }
}

// ======================= HAZARDS =======================

function drawEmitter(ctx, x, y, rot, on, flash, size = 30) {
  const f = frame('emitter', on ? 'fire' : 'idle');
  if (f) {
    drawFrame(ctx, f, x, y, size / f.w, { anchor: 'center', rot, flash });
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  rrect(ctx, -size / 2, -10, size, 20, 4);
  ink(ctx, flash ? '#fff' : C.green, 2.5);
  ctx.beginPath();
  ctx.arc(size / 2 - 2, 0, 6, 0, Math.PI * 2);
  ink(ctx, on ? '#FF4A3D' : C.redDk, 2);
  ctx.restore();
}

function drawBeam(ctx, x0, y0, x1, y1, w, t) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineWidth = w + 8 + Math.sin(t * 50) * 2;
  ctx.strokeStyle = 'rgba(255,60,45,0.28)';
  ctx.stroke();
  ctx.lineWidth = w;
  ctx.strokeStyle = '#E8392E';
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, w * 0.35);
  ctx.strokeStyle = '#FFF4E0';
  ctx.stroke();
  ctx.restore();
}

function drawWarnLine(ctx, x0, y0, x1, y1, t) {
  if (Math.floor(t * 14) % 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(232,57,46,0.8)';
  ctx.stroke();
  ctx.restore();
}

// Security laser gate: a ceiling emitter switches a floor-to-ceiling beam on and off.
// Time your run through it — or shoot the emitter to turn it off for good.
export class LaserGate extends Enemy {
  constructor(game, x, phase = 0) {
    super(game, x - 14, CEIL, 28, 22, 6);
    this.villain = true;
    this.score = 400;
    this.phase = phase;
    this.floor = game.groundTopAt(x) ?? 300;
    this.wasOn = false;
  }
  get cycle() { return (this.t + this.phase) % 2.8; }
  get on() { return !this.dead && this.cycle < 1.0; }
  get warning() { return !this.dead && this.cycle > 2.2; }
  beamBox() { return { x: this.cx - 5, y: this.y + this.h, w: 10, h: this.floor - this.y - this.h }; }
  touches(p) { return this.on && overlap(this.beamBox(), p); }
  update(dt) {
    this.base(dt);
    const on = this.on;
    if (on && !this.wasOn && this.game.onScreen(this)) sfx.laser();
    this.wasOn = on;
  }
  draw(ctx) {
    const b = this.beamBox();
    if (this.on) drawBeam(ctx, this.cx, b.y, this.cx, b.y + b.h, 7, this.t);
    else if (this.warning) drawWarnLine(ctx, this.cx, b.y, this.cx, b.y + b.h, this.t);
    // the floor plate it fires into
    rrect(ctx, this.cx - 12, this.floor - 4, 24, 5, 2);
    ink(ctx, this.on ? '#E8392E' : '#555', 1.5);
    drawEmitter(ctx, this.cx, this.cy, Math.PI / 2, this.on || this.warning, this.flash > 0, 30);
  }
}

// Wall laser: charges (dotted line) then fires a long horizontal beam to its left.
// Mounted low: jump it. Mounted at head height: duck under it.
export class BeamTurret extends Enemy {
  constructor(game, x, beamY) {
    super(game, x, beamY - 12, 30, 24, 6);
    this.villain = true;
    this.score = 500;
    this.beamY = beamY;
    this.floor = game.groundTopAt(x + 15) ?? 300;
    this.mode = 'cool';
    this.modeT = 1.2 + Math.random() * 0.6;
  }
  get reach() { return this.x - 600; }
  touches(p) {
    return this.mode === 'fire' && overlap({ x: this.reach, y: this.beamY - 4, w: this.x - this.reach, h: 8 }, p);
  }
  update(dt) {
    this.base(dt);
    if (!this.game.onScreen(this)) return;
    this.modeT -= dt;
    if (this.modeT > 0) return;
    if (this.mode === 'cool') { this.mode = 'charge'; this.modeT = 0.85; sfx.charge(); }
    else if (this.mode === 'charge') { this.mode = 'fire'; this.modeT = 0.65; sfx.laser(); this.game.shake(2); }
    else { this.mode = 'cool'; this.modeT = 1.7 + Math.random() * 0.5; }
  }
  draw(ctx) {
    // post down to the floor
    ctx.fillStyle = '#6F7C75';
    ctx.fillRect(this.cx - 3, this.y + this.h - 2, 6, this.floor - this.y - this.h + 2);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.cx - 3, this.y + this.h - 2, 6, this.floor - this.y - this.h + 2);
    if (this.mode === 'fire') drawBeam(ctx, this.x + 2, this.beamY, this.reach, this.beamY, 6, this.t);
    else if (this.mode === 'charge') drawWarnLine(ctx, this.x, this.beamY, this.reach, this.beamY, this.t);
    drawEmitter(ctx, this.cx, this.beamY, Math.PI, this.mode !== 'cool', this.flash > 0, 32);
  }
}

// ======================= MID-BOSS: HEAD NURSE =======================

export class HeadNurse extends Enemy {
  constructor(game, x) {
    const two = game.players.filter(Boolean).length > 1;
    super(game, x, -140, 56, 80, two ? 105 : 70);
    this.villain = true;
    this.score = 6000;
    this.boss = t('boss.headnurse');
    this.dropItem = 'L';
    this.freedLine = t('say.nurseDown');
    this.state = 'drop';
    this.timer = 0;
    this.plan = 0;
  }
  get angry() { return this.hp < this.maxHp / 2; }
  setLow(on) {
    if (on === !!this.low) return;
    this.low = on;
    if (on) { this.y += 22; this.h = 58; } else { this.y -= 22; this.h = 80; }
  }
  update(dt) {
    this.base(dt);
    const g = this.game;
    const p = g.nearestPlayer(this);
    if (this.delay > 0) { this.delay -= dt; return; }
    this.timer -= dt;
    const lo = g.cam.x + 6;
    const hi = g.cam.x + g.W - this.w - 6;
    if (this.state === 'drop') {
      this.vx = 0;
      moveBody(this, dt, g.level);
      if (this.onGround) { g.shake(10); sfx.boom(true); this.state = 'idle'; this.timer = 0.9; }
      return;
    }
    if (this.state === 'idle') {
      this.vx = 0;
      if (p) this.facing = p.cx < this.cx ? -1 : 1;
      if (this.timer <= 0) {
        const plan = ['charge', 'fan', 'charge', this.angry ? 'fan' : 'call'][this.plan++ % 4];
        this.state = plan;
        if (plan === 'charge') { this.timer = 0.7; this.dashing = false; g.text(this.cx, this.y - 10, t('nurse.charge'), C.red); sfx.charge(); }
        if (plan === 'fan') { this.timer = 0.35; this.volleys = this.angry ? 4 : 3; }
        if (plan === 'call') this.timer = 0.4;
      }
    } else if (this.state === 'charge') {
      if (!this.dashing) {
        // telegraph: crouch low, lance out, shaking
        this.vx = 0;
        this.setLow(true);
        if (this.timer <= 0) { this.dashing = true; this.vx = this.facing * (this.angry ? 500 : 430); }
      } else if ((this.vx < 0 && this.x <= lo) || (this.vx > 0 && this.x >= hi)) {
        this.vx = 0;
        this.setLow(false);
        g.shake(6);
        sfx.boom(false);
        this.state = 'idle';
        this.timer = this.angry ? 0.5 : 0.8;
      }
    } else if (this.state === 'fan') {
      this.vx = 0;
      if (this.timer <= 0 && p) {
        const n = this.angry ? 5 : 3;
        for (let i = 0; i < n; i++) lobSyringe(g, this.cx + this.facing * 20, this.y + 16, p.cx + (i - (n - 1) / 2) * 52, p.y + p.h - 6, 0.85);
        this.fireT = 0.25;
        this.volleys--;
        this.timer = 0.55;
        if (this.volleys <= 0) { this.state = 'idle'; this.timer = 0.7; }
      }
    } else if (this.state === 'call') {
      this.vx = 0;
      if (this.timer <= 0) {
        if (g.enemies.filter((e) => e instanceof Nurse && !e.dead).length < 2) {
          const n = new Nurse(g, g.cam.x + 60 + Math.random() * (g.W - 160), 300);
          n.y = -40;
          g.addEnemy(n);
        }
        this.state = 'idle';
        this.timer = 0.6;
      }
    }
    this.fireT = Math.max(0, (this.fireT || 0) - dt);
    moveBody(this, dt, g.level);
    if (this.x < lo) this.x = lo;
    if (this.x > hi) this.x = hi;
  }
  draw(ctx) {
    const anim = this.state === 'charge' ? 'charge' : this.fireT > 0 ? 'throw' : 'idle';
    ctx.save();
    if (this.state === 'charge' && !this.dashing) ctx.translate(Math.sin(this.t * 70) * 2, 0);
    const drew = this.drawGen(ctx, 'headnurse', anim, 0, (this.low ? 70 : 92) / 200, { flip: -this.facing, dy: 2 });
    ctx.restore();
    if (this.dashing) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const y = this.y + 10 + i * 12;
        ctx.beginPath();
        ctx.moveTo(this.cx - this.facing * 34, y);
        ctx.lineTo(this.cx - this.facing * (60 + i * 8), y);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (drew) return;
    drawRat(ctx, this.cx, this.y + this.h, this.facing, this.t, { flash: this.flash > 0, scale: 2 });
    ctx.save();
    ctx.translate(this.cx, this.y + this.h * 0.5);
    ctx.scale(this.facing, 1);
    rrect(ctx, 10, -3, 46, 7, 3);
    ink(ctx, C.cream, 2);
    ctx.fillStyle = C.red;
    ctx.fillRect(14, -1, 22, 3);
    ctx.restore();
  }
}

// ======================= BOSS: SURGERY MACHINE =======================

const SURG = { x: -10, y: -24, h: 344 }; // where the generated machine sits relative to the wall's x
// socket centres on the generated machine image (px of the 700px-tall frame): round, square, big round
const SURG_SOCKETS = [[103, 232], [104, 379], [107, 537]];

export class SurgeonWall extends Enemy {
  constructor(game, x) {
    super(game, x, 0, 160, 300, 1);
    this.isWall = true;
    this.score = 0;
    this.parts = [];
    this.dropT = 4;
    this.dying = 0;
    this.columns = []; // lamp laser strikes: { x, t, mode: 'mark' | 'fire' }
  }
  hittable() { return false; }
  touches() { return false; }
  init() {
    const g = this.game;
    const two = g.players.filter(Boolean).length > 1;
    const art = frame('surgeon', 'body');
    // socket centres measured on the generated machine image (px), mapped to the world
    const at = (px, py, w, h) => (art ? [SURG.x + this.x + (px * SURG.h) / art.h - w / 2, SURG.y + (py * SURG.h) / art.h - h / 2] : null);
    const s = art ? SURG_SOCKETS : null;
    const c1 = (s && at(s[0][0], s[0][1], 34, 34)) || [this.x - 6, 64];
    const c2 = (s && at(s[1][0], s[1][1], 34, 34)) || [this.x - 6, 150];
    const c3 = (s && at(s[2][0], s[2][1], 48, 52)) || [this.x - 2, 226];
    this.parts = [
      new SurgeonPart(g, this, c1[0], c1[1], 'cannon', two ? 28 : 18),
      new SurgeonPart(g, this, c2[0], c2[1], 'arm', two ? 36 : 24),
      new SurgeonPart(g, this, this.x - 230, CEIL + 26, 'lamp', two ? 50 : 34),
      new SurgeonPart(g, this, c3[0], c3[1], 'core', two ? 100 : 60),
    ];
    this.art = art;
    g.enemies.push(...this.parts);
  }
  update(dt) {
    this.base(dt);
    const g = this.game;
    if (this.dying > 0) {
      this.dying -= dt;
      if (Math.random() < 0.18) g.effects.push(new FxAnim('explosion', 'boom', this.x + Math.random() * 150, 20 + Math.random() * 280, 0.55, 0.6 + Math.random() * 0.5));
      if (Math.random() < 0.08) sfx.boom(true);
      if (this.dying <= 0) { this.dead = true; g.stageClear(); }
      return;
    }
    // lamp strikes: marked spots turn into floor-to-ceiling laser columns
    for (const c of this.columns) {
      c.t -= dt;
      if (c.mode === 'mark' && c.t <= 0) { c.mode = 'fire'; c.t = 0.5; sfx.laser(); g.shake(3); }
      else if (c.mode === 'fire') {
        for (const p of g.alivePlayers()) if (p.x + p.w > c.x - 9 && p.x < c.x + 9) p.hurt();
        if (c.t <= 0) c.dead = true;
      }
    }
    this.columns = this.columns.filter((c) => !c.dead);
    this.dropT -= dt;
    if (this.dropT <= 0) {
      this.dropT = g.players.filter(Boolean).length > 1 ? 4 : 5.5;
      g.addEnemy(new VentRat(g, g.cam.x + 80 + Math.random() * 300));
    }
    if (this.parts.length && this.parts.find((p) => p.kind === 'core').dead) {
      this.dying = 2.4;
      this.columns = [];
      for (const p of this.parts) p.dead = true;
      g.shake(14);
      sfx.boom(true);
    }
  }
  draw(ctx) {
    const x = this.x;
    for (const c of this.columns) {
      const floor = this.game.groundTopAt(c.x) ?? 300;
      if (c.mode === 'mark') {
        drawWarnLine(ctx, c.x, CEIL, c.x, floor, this.t);
        ctx.beginPath();
        ctx.ellipse(c.x, floor - 1, 14 - c.t * 6, 4, 0, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#E8392E';
        ctx.stroke();
      } else drawBeam(ctx, c.x, CEIL, c.x, floor, 14, this.t);
    }
    const k = this.dying > 0 ? 1 - this.dying / 2.4 : 0;
    const sx = this.dying > 0 ? (Math.random() - 0.5) * 4 : 0;
    if (this.art) {
      const w = (this.art.w * SURG.h) / this.art.h;
      ctx.drawImage(this.art.img, x + SURG.x + sx, SURG.y + k * 10, w, SURG.h);
      if (this.dying > 0) {
        ctx.save();
        ctx.globalAlpha = 0.15 + 0.3 * k;
        ctx.drawImage(tintOf(this.art, '#2a2622'), x + SURG.x + sx, SURG.y + k * 10, w, SURG.h);
        ctx.restore();
      }
    } else {
      rrect(ctx, x + 6 + sx, 10, 154, 290, 6);
      ink(ctx, this.dying > 0 ? '#59665F' : '#8FA399', 3.5);
      for (let y = 30; y < 290; y += 40) {
        ctx.beginPath(); ctx.moveTo(x + 14, y); ctx.lineTo(x + 150, y);
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(30,30,30,0.35)'; ctx.stroke();
      }
    }
    // the lamp's ceiling rail back to the machine
    const lamp = this.parts.find((p) => p.kind === 'lamp');
    if (lamp) {
      ctx.fillStyle = '#6F7C75';
      ctx.fillRect(lamp.cx, CEIL - 10, x - lamp.cx + 10, 8);
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.ink;
      ctx.strokeRect(lamp.cx, CEIL - 10, x - lamp.cx + 10, 8);
    }
    for (const p of this.parts) if (p.dead) p.drawWreck(ctx);
  }
}

class SurgeonPart extends Enemy {
  constructor(game, wall, x, y, kind, hp) {
    const size = { cannon: [34, 34], arm: [34, 34], lamp: [50, 34], core: [48, 52] }[kind];
    super(game, x, y, size[0], size[1], hp);
    this.wall = wall;
    this.kind = kind;
    this.villain = true;
    this.cool = { cannon: 1.2, arm: 2.2, lamp: 2.8, core: 2.6 }[kind];
    this.score = kind === 'core' ? 12000 : 2000;
    this.ang = Math.PI;
    this.stab = null;
  }
  touches() { return false; }
  others() { return this.wall.parts.filter((q) => q !== this && !q.dead).length; }
  damage(n, by) {
    // the jar is armoured while the machine's other parts still stand
    if (this.kind === 'core' && this.others() > 0) n *= 0.5;
    super.damage(n, by);
  }
  update(dt) {
    this.base(dt);
    const g = this.game;
    const p = g.nearestPlayer(this);
    if (!p) return;
    this.cool -= dt;
    const angry = this.others() === 0;
    if (this.kind === 'cannon') {
      this.ang = Math.max(Math.PI * 0.6, Math.min(Math.PI * 1.3, (Math.atan2(p.cy - this.cy, p.cx - this.cx) + Math.PI * 2) % (Math.PI * 2)));
      if (this.cool <= 0) {
        this.cool = 1.7;
        const tip = this.tip(46);
        for (const d of [-0.16, 0, 0.16]) syringe(g, tip.x, tip.y, Math.cos(this.ang + d) * 260, Math.sin(this.ang + d) * 260);
      }
    } else if (this.kind === 'arm') {
      this.armUpdate(dt, p);
    } else if (this.kind === 'lamp') {
      // sway toward the hero, then mark spots on the floor that turn into laser columns
      this.x += Math.max(-60 * dt, Math.min(60 * dt, p.cx - 60 - this.cx)) * 0.5;
      this.x = Math.max(g.cam.x + 120, Math.min(this.wall.x - 140, this.x));
      if (this.cool <= 0) {
        this.cool = this.others() > 1 ? 4.2 : 3.2;
        const xs = [p.cx, p.cx + (Math.random() < 0.5 ? -1 : 1) * (110 + Math.random() * 40)];
        if (this.others() <= 1) xs.push(xs[0] * 2 - xs[1]); // three strikes once the machine is down to its last parts
        for (const x of xs) {
          if (x > g.cam.x + 10 && x < this.wall.x - 10) this.wall.columns.push({ x, t: 0.9, mode: 'mark' });
        }
        sfx.charge();
      }
    } else if (this.cool <= 0) {
      // the jar lobs pill bombs, more when it stands alone
      this.cool = angry ? 1.9 : 3.0;
      const n = angry ? 3 : 2;
      for (let i = 0; i < n; i++) pillBomb(g, this.x, this.cy - 10, p.cx + (i - (n - 1) / 2) * 70, p.y + p.h - 4, 0.9 + i * 0.12);
    }
  }
  // scalpel arm: lock on (dashed line), lunge out to the locked spot, hold, pull back
  armUpdate(dt, p) {
    const g = this.game;
    const piv = { x: this.cx, y: this.cy };
    if (!this.stab) {
      this.ang = Math.atan2(p.cy - piv.y, p.cx - piv.x);
      if (this.cool <= 0) {
        const tx = p.cx;
        const ty = p.y + p.h - 12;
        const len = Math.min(400, Math.hypot(tx - piv.x, ty - piv.y) + 20);
        this.stab = { phase: 'aim', t: 0.8, ang: Math.atan2(ty - piv.y, tx - piv.x), len, ext: 0 };
        sfx.charge();
      }
      return;
    }
    const s = this.stab;
    this.ang = s.ang;
    s.t -= dt;
    if (s.phase === 'aim' && s.t <= 0) { s.phase = 'out'; s.t = 0.12; g.text(this.cx - 40, this.y - 8, t('surgeon.cut'), C.red); }
    else if (s.phase === 'out') { s.ext = Math.min(1, s.ext + dt / 0.12); if (s.t <= 0) { s.phase = 'hold'; s.t = 0.35; g.shake(4); } }
    else if (s.phase === 'hold' && s.t <= 0) { s.phase = 'back'; }
    else if (s.phase === 'back') {
      s.ext = Math.max(0, s.ext - dt / 0.4);
      if (s.ext <= 0) { this.stab = null; this.cool = this.others() > 1 ? 2.3 : 1.6; }
    }
    if (s.ext > 0.6) {
      const L = s.len * s.ext;
      const ex = piv.x + Math.cos(s.ang) * L;
      const ey = piv.y + Math.sin(s.ang) * L;
      for (const pl of g.alivePlayers()) {
        if (segDist(pl.cx, pl.y + pl.h / 2, piv.x, piv.y, ex, ey) < 14) pl.hurt();
      }
    }
  }
  tip(len) { return { x: this.cx + Math.cos(this.ang) * len, y: this.cy + Math.sin(this.ang) * len }; }
  drawWreck(ctx) {
    const f = frame('surgeon_parts', this.kind === 'core' ? 'jarhurt' : null);
    if (f) drawFrame(ctx, f, this.cx, this.cy, (this.w + 14) / f.w, { anchor: 'center' });
    else if (this.kind !== 'lamp') {
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#2a2622';
      ctx.fill();
    }
  }
  draw(ctx) {
    if (this.dead) return;
    const flash = this.flash > 0;
    if (this.kind === 'arm') {
      const s = this.stab;
      const L = 54 + (s ? s.len * s.ext : 0);
      if (s && s.phase === 'aim') {
        drawWarnLine(ctx, this.cx, this.cy, this.cx + Math.cos(s.ang) * s.len, this.cy + Math.sin(s.ang) * s.len, this.t);
      }
      const f = frame('surgeon_parts', 'arm');
      ctx.save();
      ctx.translate(this.cx, this.cy);
      ctx.rotate(this.ang - Math.PI); // the art points left
      if (f) {
        const h = (f.h * L) / f.w;
        ctx.drawImage(flash ? tintOf(f, '#fff') : f.img, -L, -Math.min(h, 26) / 2, L, Math.min(h, 26));
      } else {
        ctx.fillStyle = '#8FA399';
        ctx.fillRect(-L, -5, L, 10);
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 2;
        ctx.strokeRect(-L, -5, L, 10);
        ctx.beginPath();
        ctx.moveTo(-L, -6); ctx.lineTo(-L - 16, 0); ctx.lineTo(-L, 6); ctx.closePath();
        ink(ctx, '#E6EEF0', 2);
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, 15, 0, Math.PI * 2);
      ink(ctx, flash ? '#fff' : C.greenDk, 2.5);
      return;
    }
    if (this.kind === 'cannon') {
      const f = frame('surgeon_parts', 'cannon');
      ctx.save();
      ctx.translate(this.cx, this.cy);
      ctx.rotate(this.ang - Math.PI);
      if (f) {
        const bl = 62;
        const bh = (f.h * bl) / f.w;
        ctx.drawImage(flash ? tintOf(f, '#fff') : f.img, -bl * 0.85, -bh / 2, bl, bh);
      } else {
        ctx.fillStyle = '#8FA399';
        ctx.fillRect(-30, -6, 30, 12);
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 2;
        ctx.strokeRect(-30, -6, 30, 12);
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, 15, 0, Math.PI * 2);
      ink(ctx, flash ? '#fff' : C.greenDk, 2.5);
      const tip = this.tip(46);
      this.warn(ctx, tip.x, tip.y);
      return;
    }
    if (this.kind === 'lamp') {
      ctx.beginPath();
      ctx.moveTo(this.cx, CEIL - 6);
      ctx.lineTo(this.cx, this.y + 4);
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      const f = frame('surgeon_parts', 'lamp');
      const glow = this.cool < 0.6;
      if (glow) {
        const g = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, 40);
        g.addColorStop(0, 'rgba(255,90,60,0.5)');
        g.addColorStop(1, 'rgba(255,90,60,0)');
        ctx.fillStyle = g;
        ctx.fillRect(this.cx - 40, this.cy - 40, 80, 80);
      }
      if (f) drawFrame(ctx, f, this.cx, this.cy, (this.w + 8) / f.w, { anchor: 'center', flash });
      else {
        ctx.beginPath();
        ctx.ellipse(this.cx, this.cy, 20, 13, 0, 0, Math.PI * 2);
        ink(ctx, flash ? '#fff' : glow ? '#FF8A6A' : C.yellow, 2.5);
      }
      return;
    }
    const f = frame('surgeon_parts', this.hp < this.maxHp / 2 ? 'jarhurt' : 'jar');
    const pulse = 1 + Math.sin(this.t * 6) * 0.04;
    if (f) drawFrame(ctx, f, this.cx, this.cy, ((this.w + 14) / f.w) * pulse, { anchor: 'center', flash });
    else {
      rrect(ctx, this.x - 2, this.y - 2, this.w + 4, this.h + 4, 12);
      ink(ctx, flash ? '#fff' : 'rgba(199,210,201,0.9)', 3);
      drawRat(ctx, this.cx, this.y + this.h - 6, -1, this.t, { flash });
    }
    if (this.others() > 0 && Math.floor(this.t * 3) % 2) {
      // armoured: a faint ring says "break the rest first"
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.w * 0.75, 0, Math.PI * 2);
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(30,30,30,0.45)';
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function segDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy || 1;
  const k = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2));
  return Math.hypot(px - (x0 + dx * k), py - (y0 + dy * k));
}

