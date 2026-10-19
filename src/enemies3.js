// Stage 3 (fish-tank waterfall, a climb) enemies and bosses. The bosses are creatures that move
// round the arena and change their attacks as they get hurt — no more walls to shoot at.

import { t } from './i18n.js?v=bad6619';
import { C, ink, rrect, drawRat } from './art.js?v=bad6619';
import { sfx } from './audio.js?v=bad6619';
import { frame, drawFrame } from './sprites.js?v=bad6619';
import { Enemy, RatSoldier, enemyShot, moveBody, overlap, FxAnim } from './entities.js?v=bad6619';
import { floorWave } from './enemies2.js?v=bad6619';

const TAU = Math.PI * 2;
const angTo = (a, b) => Math.atan2(b.cy - a.cy, b.cx - a.cx);

// ======================= SHOTS =======================

function drawBone(ctx, b) {
  const f = frame('ashot', 'bone');
  if (f) return drawFrame(ctx, f, b.x, b.y, 26 / f.w, { anchor: 'center', rot: b.t * 14 });
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.t * 14);
  ctx.beginPath();
  ctx.moveTo(-11, 0); ctx.lineTo(11, 0);
  for (let i = -6; i <= 6; i += 4) { ctx.moveTo(i, -5); ctx.lineTo(i, 5); }
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-12, 0, 3.5, 0, TAU);
  ink(ctx, C.cream, 1.5);
  ctx.restore();
}

// fishbone boomerang: flies out at the hero, slows, then curves back to whoever threw it
export function boomerang(game, owner, x, y, ang, speed = 280) {
  game.ebullets.push({
    x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, t: 0, kind: 'bone', r: 7, linger: true, life: 3.5, draw: drawBone,
    update(b, dt) {
      if (b.t < 0.45) return;
      if (owner.dead) { b.vy += 400 * dt; return; }
      const a = Math.atan2(owner.cy - b.y, owner.cx - b.x);
      b.vx += Math.cos(a) * 900 * dt;
      b.vy += Math.sin(a) * 900 * dt;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 320) { b.vx *= 320 / sp; b.vy *= 320 / sp; }
      if (b.t > 0.9 && Math.hypot(owner.cx - b.x, owner.cy - b.y) < 18) b.dead = true;
    },
  });
  sfx.enemyShot();
}

function drawHarpoon(ctx, b) {
  const ang = Math.atan2(b.vy, b.vx);
  const f = frame('ashot', 'harpoon');
  if (f) return drawFrame(ctx, f, b.x, b.y, 34 / f.w, { anchor: 'center', rot: ang, ax: 0.8 });
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(-22, 0); ctx.lineTo(6, 0);
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12, 0); ctx.lineTo(3, -5); ctx.lineTo(3, 5); ctx.closePath();
  ink(ctx, C.green, 1.5);
  ctx.restore();
}

// harpoon: flies straight; if it reaches the tank wall it sticks there for a while — a foothold
export function harpoon(game, x, y, dir) {
  game.ebullets.push({
    x, y, vx: dir * 330, vy: 0, t: 0, kind: 'harpoon', r: 5, draw: drawHarpoon,
    update(b) {
      const lo = game.cam.x + 6;
      const hi = game.cam.x + game.W - 6;
      if (b.x < lo || b.x > hi) {
        b.dead = true;
        const left = b.x < lo;
        game.level.temps.push({ x: left ? game.cam.x : hi - 40, y: b.y, w: 46, life: 4.5, left, kind: 'harpoon' });
        game.effects.push(new FxAnim('impact', 'hit', left ? lo : hi, b.y, 0.16, 0.3, { rot: Math.random() * 6 }));
        sfx.clink();
      }
    },
  });
  sfx.enemyShot();
}

function drawSpike(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.beginPath();
  ctx.moveTo(8, 0); ctx.lineTo(-5, -4); ctx.lineTo(-3, 0); ctx.lineTo(-5, 4); ctx.closePath();
  ink(ctx, C.ink, 1.2);
  ctx.restore();
}

function drawWater(ctx, b) {
  const f = frame('ashot', 'water');
  if (f) return drawFrame(ctx, f, b.x, b.y, 20 / f.h, { anchor: 'center', rot: Math.atan2(b.vy, b.vx) });
  ctx.beginPath();
  ctx.ellipse(b.x, b.y, 8, 6, Math.atan2(b.vy, b.vx), 0, TAU);
  ink(ctx, '#5E7F72', 1.8);
}

function drawBubble(ctx, b) {
  const r = b.r + Math.sin(b.t * 8 + b.seed) * 1;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, TAU);
  ctx.fillStyle = 'rgba(199,210,201,0.45)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(b.x - r * 0.35, b.y - r * 0.35, r * 0.25, 0, TAU);
  ctx.fillStyle = C.cream;
  ctx.fill();
}

// ======================= REGULARS =======================

// Fishbowl-helmet cat (brainwashed, can be freed): paces its ledge and throws fishbone boomerangs
export class BowlCat extends Enemy {
  constructor(game, x, groundY) {
    super(game, x, groundY - 46, 28, 46, 3);
    this.cat = 'bowl';
    this.score = 300;
    this.cool = 1 + Math.random();
    this.home = x;
    this.dir = Math.random() < 0.5 ? -1 : 1;
  }
  update(dt) {
    this.base(dt);
    const g = this.game;
    const p = g.nearestPlayer(this);
    this.throwT = Math.max(0, (this.throwT || 0) - dt);
    // pace up and down its own ledge without walking off
    const ahead = this.cx + this.dir * 18;
    const top = g.groundTopAt(ahead, this.y + this.h - 6);
    const plank = g.level.platforms().some((q) => ahead > q.x && ahead < q.x + q.w && Math.abs(q.y - (this.y + this.h)) < 4);
    if (this.onGround && !plank && (top == null || Math.abs(top - (this.y + this.h)) > 4)) this.dir *= -1;
    if (Math.abs(this.x - this.home) > 60) this.dir = Math.sign(this.home - this.x);
    this.vx = this.throwT > 0 ? 0 : this.dir * 40;
    this.facing = p && this.throwT > 0 ? Math.sign(p.cx - this.cx) || 1 : this.dir;
    moveBody(this, dt, g.level);
    if (this.y > g.cam.y + 440) this.dead = true;
    if (!p || !g.onScreen(this)) return;
    this.cool -= dt;
    if (this.cool <= 0) {
      this.cool = 2.6 + Math.random() * 0.6;
      this.throwT = 0.45;
      this.facing = Math.sign(p.cx - this.cx) || 1;
      boomerang(g, this, this.cx + this.facing * 12, this.y + 12, angTo(this, p));
    }
  }
  draw(ctx) {
    const anim = this.throwT > 0 ? 'throw' : 'walk';
    if (this.drawGen(ctx, 'bowlcat', anim, this.t * 6, 56 / 112, { flip: this.facing < 0 ? 1 : -1, dy: 1 })) return;
    this.drawSprite(ctx, 'cat04', 48, { flip: -this.facing });
    ctx.beginPath();
    ctx.arc(this.cx, this.y + 12, 15, 0, TAU);
    ctx.fillStyle = 'rgba(199,210,201,0.5)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  }
}

// Robot pufferfish mine: bobs in the water; a hero close by makes it swell up and burst into spikes.
// Shoot it early and it just pops.
export class Puffer extends Enemy {
  constructor(game, x, y) {
    super(game, x - 14, y - 14, 28, 28, 2);
    this.villain = true;
    this.score = 150;
    this.home = { x: x - 14, y: y - 14 };
    this.swell = 0; // 0..1 while inflating
  }
  update(dt) {
    this.base(dt);
    const g = this.game;
    const p = g.nearestPlayer(this);
    if (this.swell > 0) {
      this.swell += dt / 0.7;
      if (this.swell >= 1) return this.burst();
    } else {
      this.x = this.home.x + Math.sin(this.t * 1.3) * 26;
      this.y = this.home.y + Math.sin(this.t * 2.1) * 8;
      if (p && Math.hypot(p.cx - this.cx, p.cy - this.cy) < 115 && g.onScreen(this)) { this.swell = 0.001; sfx.charge(); }
    }
    if (this.y > g.cam.y + 460) this.dead = true;
  }
  burst() {
    const g = this.game;
    this.dead = true;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      g.ebullets.push({ x: this.cx, y: this.cy, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, t: 0, kind: 'spike', r: 4, draw: drawSpike });
    }
    g.effects.push(new FxAnim('explosion', 'boom', this.cx, this.cy, 0.4, 0.45));
    sfx.boom(false);
  }
  draw(ctx) {
    const k = 1 + this.swell * 0.8;
    ctx.save();
    if (this.swell > 0.5) ctx.translate(Math.sin(this.t * 80) * 1.5, 0);
    const f = frame('puffer', this.swell > 0.35 ? 'big' : 'small');
    const small = frame('puffer', 'small');
    // one scale for both frames (the inflated art is already drawn bigger), growing as it swells
    if (f) drawFrame(ctx, f, this.cx, this.cy, ((this.w + 8) / small.w) * (1 + this.swell * 0.25), { anchor: 'center', flash: this.flash > 0 });
    else {
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, 13 * k, 0, TAU);
      ink(ctx, this.flash > 0 ? '#fff' : C.green, 2.5);
      for (let i = 0; i < 8 && this.swell > 0.3; i++) {
        const a = (i / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(this.cx + Math.cos(a) * 13 * k, this.cy + Math.sin(a) * 13 * k);
        ctx.lineTo(this.cx + Math.cos(a) * 19 * k, this.cy + Math.sin(a) * 19 * k);
        ctx.lineWidth = 2;
        ctx.strokeStyle = C.ink;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(this.cx - 4, this.cy - 2, 4, 0, TAU);
      ink(ctx, C.red, 1.2);
    }
    ctx.restore();
  }
}

// Scuba rat: a harpoon gun shot straight across; the harpoon sticks in the tank wall as a foothold
export class ScubaRat extends RatSoldier {
  constructor(game, x, groundY) {
    super(game, x, groundY, 26, 40, 3, 350);
    this.cool = 1.2 + Math.random();
  }
  update(dt) {
    this.vx = 0;
    const p = this.stand(dt);
    if (!p || !this.game.onScreen(this)) return;
    this.cool -= dt;
    if (this.cool <= 0) {
      this.cool = 2.6 + Math.random() * 0.5;
      harpoon(this.game, this.cx + this.facing * 26, this.y + 20, this.facing);
      this.fireT = 0.25;
    }
  }
  draw(ctx) {
    if (this.drawGen(ctx, 'scuba', this.fireT > 0 ? 'fire' : 'aim', 0, 46 / 92, { flip: -this.facing, dy: 1 })) {
      this.warn(ctx, this.cx + this.facing * 28, this.y + 20);
      return;
    }
    drawRat(ctx, this.cx, this.y + this.h, this.facing, this.t, { flash: this.flash > 0 });
    this.warn(ctx, this.cx + this.facing * 28, this.y + 20);
  }
}

// Robot eel in a hole in the tank wall: hides (can't be hurt), peeks with glowing eyes, then lunges
// out with an electric bite across the ledge
export class Eel extends Enemy {
  constructor(game, side, y) {
    super(game, 0, y - 14, 30, 28, 5);
    this.villain = true;
    this.score = 400;
    this.side = side; // -1 = left wall, 1 = right wall
    this.mode = 'hide';
    this.modeT = 0.8 + Math.random();
    this.out = 0; // how far the body is out of the hole, 0..1
  }
  get wallX() { return this.side < 0 ? this.game.cam.x : this.game.cam.x + this.game.W; }
  get reach() { return 150; }
  hittable() { return !this.dead && this.out > 0.2; }
  bodyBox() {
    const len = 26 + this.reach * this.out;
    return this.side < 0 ? { x: this.wallX, y: this.y + 4, w: len, h: this.h - 8 } : { x: this.wallX - len, y: this.y + 4, w: len, h: this.h - 8 };
  }
  touches(p) { return this.mode === 'bite' && overlap(this.bodyBox(), p); }
  update(dt) {
    this.base(dt);
    const g = this.game;
    // the hittable head is at the end of the body
    const b = this.bodyBox();
    this.x = this.side < 0 ? b.x + b.w - this.w : b.x;
    if (!g.onScreen({ x: this.wallX - 20, y: this.y, w: 40, h: this.h })) return;
    this.modeT -= dt;
    if (this.mode === 'hide') {
      this.out = Math.max(0, this.out - dt * 3);
      if (this.modeT <= 0) { this.mode = 'peek'; this.modeT = 0.55; }
    } else if (this.mode === 'peek') {
      this.out = Math.min(0.15, this.out + dt);
      if (this.modeT <= 0) { this.mode = 'bite'; this.modeT = 0.75; sfx.laser(); }
    } else {
      this.out = Math.min(1, this.out + dt * 6);
      if (this.modeT <= 0) { this.mode = 'hide'; this.modeT = 1.5 + Math.random() * 0.6; }
    }
  }
  draw(ctx) {
    const wx = this.wallX;
    // the hole
    ctx.beginPath();
    ctx.ellipse(wx, this.cy, 10, 18, 0, 0, TAU);
    ctx.fillStyle = '#1E1E1E';
    ctx.fill();
    if (this.out <= 0.01) return;
    const b = this.bodyBox();
    const headX = this.side < 0 ? b.x + b.w : b.x;
    // body: a thick striped tube from the hole to the head
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(wx, this.cy);
    for (let k = 1; k <= 8; k++) {
      const x = wx + (headX - wx) * (k / 8);
      ctx.lineTo(x, this.cy + Math.sin(this.t * 14 + k) * 3 * (this.mode === 'bite' ? 1 : 0.3));
    }
    ctx.lineWidth = 16;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.lineWidth = 11;
    ctx.strokeStyle = this.flash > 0 ? '#fff' : '#7E9A8C';
    ctx.stroke();
    ctx.restore();
    const f = frame('eel', this.mode === 'bite' ? 'zap' : 'peek');
    if (f) drawFrame(ctx, f, headX, this.cy, 34 / f.h, { anchor: 'center', flip: -this.side, flash: this.flash > 0 });
    else {
      ctx.beginPath();
      ctx.ellipse(headX, this.cy, 15, 11, 0, 0, TAU);
      ink(ctx, this.flash > 0 ? '#fff' : C.green, 2.5);
      ctx.beginPath();
      ctx.arc(headX + this.side * -5, this.cy - 3, 3, 0, TAU);
      ctx.fillStyle = this.mode === 'peek' ? '#FF3B30' : C.red;
      ctx.fill();
    }
    if (this.mode === 'bite') {
      // crackling electricity along the body
      ctx.save();
      ctx.beginPath();
      let x = wx;
      ctx.moveTo(x, this.cy);
      while (Math.abs(x - headX) > 10) {
        x += Math.sign(headX - wx) * 12;
        ctx.lineTo(x, this.cy + (Math.random() - 0.5) * 22);
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.yellow;
      ctx.stroke();
      ctx.restore();
    }
  }
}

// Fish-food tin rolled down by a rat above: rolls along ledges, drops off the ends, bounces off the
// tank walls. Shoot it or jump it.
export class RollingCan extends Enemy {
  constructor(game, x, y, dir) {
    super(game, x, y, 20, 20, 1);
    this.villain = true;
    this.score = 50;
    this.dir = dir;
  }
  update(dt) {
    this.base(dt);
    const g = this.game;
    this.vx = this.dir * 150;
    moveBody(this, dt, g.level);
    if (this.x < g.cam.x + 2) { this.x = g.cam.x + 2; this.dir = 1; }
    if (this.x > g.cam.x + g.W - this.w - 2) { this.x = g.cam.x + g.W - this.w - 2; this.dir = -1; }
    if (this.hitWall) this.dir *= -1;
    if (this.y > g.cam.y + 440 || this.t > 9) this.dead = true;
  }
  draw(ctx) {
    const f = frame('ashot', 'can');
    if (f) return drawFrame(ctx, f, this.cx, this.cy, 22 / f.h, { anchor: 'center', rot: this.t * this.dir * 9, flash: this.flash > 0 });
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.t * this.dir * 9);
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, TAU);
    ink(ctx, '#C9CFD2', 2);
    ctx.fillStyle = C.red;
    ctx.fillRect(-10, -3, 20, 6);
    ctx.restore();
  }
}

// Rat that rolls those tins off its ledge toward the hero
export class CanRat extends RatSoldier {
  constructor(game, x, groundY) {
    super(game, x, groundY, 24, 40, 3, 300);
    this.cool = 0.8 + Math.random();
  }
  update(dt) {
    this.vx = 0;
    const p = this.stand(dt);
    if (!p || !this.game.onScreen(this)) return;
    this.cool -= dt;
    if (this.cool <= 0) {
      this.cool = 2.3 + Math.random() * 0.6;
      this.game.addEnemy(new RollingCan(this.game, this.cx + this.facing * 16 - 10, this.y + this.h - 22, this.facing));
      this.fireT = 0.35;
      sfx.enemyShot();
    }
  }
  draw(ctx) {
    if (this.drawGen(ctx, 'canrat', this.fireT > 0 ? 'roll' : 'idle', 0, 46 / 92, { flip: -this.facing, dy: 1 })) return;
    drawRat(ctx, this.cx, this.y + this.h, this.facing, this.t, { flash: this.flash > 0 });
  }
}

// homing torpedo from the koi boss: slow to turn, one hit to destroy
export class Torpedo extends Enemy {
  constructor(game, x, y, ang) {
    super(game, x - 9, y - 6, 18, 12, 1);
    this.villain = true;
    this.score = 100;
    this.ang = ang;
    this.speed = 120;
  }
  update(dt) {
    this.base(dt);
    const g = this.game;
    const p = g.nearestPlayer(this);
    if (p && this.t > 0.4) {
      let d = angTo(this, p) - this.ang;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      this.ang += Math.max(-1.6 * dt, Math.min(1.6 * dt, d));
    }
    this.speed = Math.min(230, this.speed + dt * 60);
    this.x += Math.cos(this.ang) * this.speed * dt;
    this.y += Math.sin(this.ang) * this.speed * dt;
    if (this.t > 5 || !g.onScreen({ x: this.x - 60, y: this.y - 60, w: 140, h: 140 })) this.dead = true;
  }
  touches(p) {
    if (this.dead || !overlap(this, p)) return false;
    this.dead = true;
    this.game.effects.push(new FxAnim('explosion', 'boom', this.cx, this.cy, 0.4, 0.4));
    sfx.boom(false);
    return true;
  }
  draw(ctx) {
    const f = frame('ashot', 'torpedo');
    if (f) return drawFrame(ctx, f, this.cx, this.cy, 30 / f.w, { anchor: 'center', rot: this.ang, flash: this.flash > 0 });
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.ang);
    rrect(ctx, -12, -5, 22, 10, 5);
    ink(ctx, this.flash > 0 ? '#fff' : C.ink, 1.5);
    ctx.fillStyle = C.red;
    ctx.fillRect(4, -3, 4, 6);
    ctx.restore();
  }
}

// ======================= MID-BOSS: PIRATE CAPTAIN CAT =======================
// Moves between a dash slash, an anchor on a chain (thrown out, then reeled back in) and a leap onto
// your ledge that sends waves along the floor. Angry at half health: faster, two anchors, two waves.

export class PirateCat extends Enemy {
  constructor(game, x, y) {
    const two = game.players.filter(Boolean).length > 1;
    super(game, x, y, 58, 84, two ? 120 : 80);
    this.cat = 'pirate';
    this.freedH = 100;
    this.score = 6000;
    this.boss = t('boss.pirate');
    this.dropItem = 'F';
    this.freedLine = t('say.pirateFreed');
    this.state = 'drop';
    this.timer = 0;
    this.plan = 0;
    this.anchor = null;
  }
  get angry() { return this.hp < this.maxHp / 2; }
  touches(p) {
    if (this.dead) return false;
    if (this.anchor && this.anchor.mode !== 'held' && overlap({ x: this.anchor.x - 11, y: this.anchor.y - 11, w: 22, h: 22 }, p)) return true;
    return overlap(this, p);
  }
  update(dt) {
    this.base(dt);
    const g = this.game;
    const p = g.nearestPlayer(this);
    if (this.delay > 0) { this.delay -= dt; return; }
    this.timer -= dt;
    const lo = g.cam.x + 6;
    const hi = g.cam.x + g.W - this.w - 6;
    if (this.anchor) this.updateAnchor(dt);
    if (this.state === 'drop') {
      this.vx = 0;
      moveBody(this, dt, g.level);
      if (this.onGround) { g.shake(10); sfx.boom(true); this.state = 'idle'; this.timer = 0.8; }
      return;
    }
    if (this.state === 'idle') {
      this.vx = 0;
      if (p) this.facing = p.cx < this.cx ? -1 : 1;
      if (this.timer <= 0 && p) {
        // a hero up on a ledge gets the leap; otherwise rotate through the moves
        const above = p.y + p.h < this.y + this.h - 30;
        const plan = above ? 'leap' : ['dash', 'anchor', 'leap', 'anchor'][this.plan++ % 4];
        this.state = plan;
        if (plan === 'dash') { this.timer = this.angry ? 0.4 : 0.6; this.dashing = false; sfx.charge(); }
        if (plan === 'anchor') { this.timer = 0.6; this.throws = this.angry ? 2 : 1; }
        if (plan === 'leap') { this.timer = 0.35; }
      }
    } else if (this.state === 'dash') {
      if (!this.dashing) {
        this.vx = 0;
        if (this.timer <= 0) { this.dashing = true; this.vx = this.facing * (this.angry ? 480 : 400); g.text(this.cx, this.y - 8, t('pirate.yarr'), C.red); }
      } else if ((this.vx < 0 && this.x <= lo) || (this.vx > 0 && this.x >= hi)) {
        this.vx = 0;
        this.dashing = false;
        g.shake(5);
        this.state = 'idle';
        this.timer = 0.6;
      }
    } else if (this.state === 'anchor') {
      this.vx = 0;
      if (!this.anchor && this.timer <= 0 && p) {
        // lob the anchor so it lands where the hero stands
        const T = 0.75;
        const gr = 900;
        const sx = this.cx + this.facing * 20;
        const sy = this.y + 10;
        const tx = p.cx;
        const ty = p.y + p.h - 10;
        this.anchor = { x: sx, y: sy, vx: (tx - sx) / T, vy: (ty - sy - 0.5 * gr * T * T) / T, g: gr, mode: 'fly', t: 0 };
        this.throws--;
        sfx.enemyShot();
      }
    } else if (this.state === 'leap') {
      if (this.timer <= 0 && this.onGround && !this.leaping && p) {
        this.leaping = true;
        const T = 0.85;
        this.vy = -720;
        this.vx = (p.cx - this.cx) / T;
        this.facing = Math.sign(this.vx) || this.facing;
        this.wasAir = false;
      }
    }
    const wasAir = !this.onGround;
    moveBody(this, dt, g.level);
    if (this.leaping && wasAir && this.onGround && this.vy === 0) {
      this.leaping = false;
      this.vx = 0;
      g.shake(8);
      sfx.boom(true);
      const top = this.y + this.h;
      floorWave(g, this.cx - 20, top, -1);
      floorWave(g, this.cx + 20, top, 1);
      this.state = 'idle';
      this.timer = this.angry ? 0.45 : 0.7;
    }
    if (this.x < lo) { this.x = lo; if (this.leaping) this.vx = 0; }
    if (this.x > hi) { this.x = hi; if (this.leaping) this.vx = 0; }
    if (this.y > g.cam.y + 440) { this.y = g.cam.y - 60; this.vy = 0; } // never lost down a gap: climbs back in from above
  }
  updateAnchor(dt) {
    const a = this.anchor;
    a.t += dt;
    const hand = { x: this.cx + this.facing * 20, y: this.y + 14 };
    if (a.mode === 'fly') {
      a.vy += a.g * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      const top = this.game.groundTopAt(a.x, a.y - 12);
      const plank = this.game.level.platforms().some((q) => a.x > q.x && a.x < q.x + q.w && a.y >= q.y - 4 && a.y - a.vy * dt <= q.y + 4);
      if ((top != null && a.y >= top - 6 && a.vy > 0) || plank || a.t > 1.2) {
        a.mode = 'stuck';
        a.t = 0;
        this.game.shake(3);
        sfx.boom(false);
      }
    } else if (a.mode === 'stuck') {
      if (a.t > 0.5) { a.mode = 'reel'; a.t = 0; }
    } else {
      // reeled straight back in, hurting anything on the way
      const d = Math.hypot(hand.x - a.x, hand.y - a.y);
      const sp = 480 * dt;
      if (d <= sp + 4) {
        this.anchor = null;
        if (this.state === 'anchor') {
          if (this.throws > 0) this.timer = 0.25;
          else { this.state = 'idle'; this.timer = 0.6; }
        }
        return;
      }
      a.x += ((hand.x - a.x) / d) * sp;
      a.y += ((hand.y - a.y) / d) * sp;
    }
  }
  draw(ctx) {
    if (this.anchor) {
      const a = this.anchor;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.cx + this.facing * 20, this.y + 14);
      ctx.lineTo(a.x, a.y);
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      ctx.restore();
      const f = frame('ashot', 'anchor');
      if (f) drawFrame(ctx, f, a.x, a.y, 26 / f.h, { anchor: 'center', rot: a.mode === 'fly' ? a.t * 10 : 0 });
      else {
        ctx.beginPath();
        ctx.arc(a.x, a.y, 9, 0, TAU);
        ink(ctx, '#3A3F3C', 2);
      }
    }
    const anim = this.state === 'dash' && this.dashing ? 'slash' : this.state === 'anchor' && !this.anchor ? 'swing' : !this.onGround ? 'jump' : 'idle';
    ctx.save();
    if ((this.state === 'dash' && !this.dashing) || (this.state === 'anchor' && !this.anchor)) ctx.translate(Math.sin(this.t * 70) * 1.5, 0);
    const drew = this.drawGen(ctx, 'pirate', anim, 0, 96 / 200, { flip: -this.facing, dy: 2 });
    ctx.restore();
    if (drew) return;
    this.drawSprite(ctx, 'cat04', 92, { flip: -this.facing });
    ctx.fillStyle = C.ink;
    ctx.fillRect(this.cx - 16, this.y - 6, 32, 8);
  }
}

// ======================= BOSS: ROBOT KOI + RAT ADMIRAL =======================
// Phase 1: swims a loop over the arena, sprays water, blows bubbles, and leaps up then slams down
//          where you stand (it lies stunned for a moment after: free hits).
// Phase 2 (armour breaks): faster; adds homing torpedoes, a low charge along the floor, and mines.
// Phase 3 (nearly beaten): a frenzy of slams in a row, then it lies exhausted.

const KOI_W = 176;
const KOI_H = 74;

export class RoboKoi extends Enemy {
  constructor(game, floorY) {
    const two = game.players.filter(Boolean).length > 1;
    super(game, game.cam.x + game.W / 2 - KOI_W / 2, game.cam.y + game.H + 40, KOI_W, KOI_H, two ? 285 : 190);
    this.villain = true;
    this.score = 20000;
    this.boss = t('boss.koi');
    this.floorY = floorY;
    this.state = 'enter';
    this.timer = 0;
    this.plan = 0;
    this.path = 0;
    this.dying = 0;
    this.phase = 1;
  }
  get arena() {
    const g = this.game;
    return { lo: g.cam.x + 20, hi: g.cam.x + g.W - 20, top: g.cam.y + 40 };
  }
  hittable() { return !this.dead && this.dying <= 0 && this.state !== 'enter' && this.state !== 'gone'; }
  touches(p) {
    if (!this.hittable() || this.state === 'stunned') return false;
    // a slimmer box than the sprite so near misses feel fair
    return overlap({ x: this.x + 14, y: this.y + 10, w: this.w - 28, h: this.h - 18 }, p);
  }
  damage(n, by) {
    if (this.dying > 0) return;
    if (this.state === 'stunned' || this.state === 'tired') n *= 1.5; // the opening after a slam
    this.hp -= n;
    this.flash = 0.05;
    sfx.hit();
    const g = this.game;
    if (this.phase === 1 && this.hp < this.maxHp * 0.55) {
      this.phase = 2;
      g.say(t('koi.phase2'), 1.4);
      g.shake(10);
      sfx.boom(true);
      for (let i = 0; i < 6; i++) g.effects.push(new FxAnim('explosion', 'boom', this.x + Math.random() * this.w, this.y + Math.random() * this.h, 0.5, 0.5));
    } else if (this.phase === 2 && this.hp < this.maxHp * 0.25) {
      this.phase = 3;
      g.say(t('koi.phase3'), 1.2);
      this.frenzy = 3;
    }
    if (this.hp <= 0) {
      this.dying = 2.6;
      this.vx = 0;
      this.vy = 0;
      g.score += this.score;
      if (by && by.energy != null) by.energy = Math.min(100, by.energy + 8);
      g.shake(14);
      sfx.boom(true);
    }
  }
  update(dt) {
    this.base(dt);
    const g = this.game;
    const A = this.arena;
    if (this.dying > 0) {
      this.dying -= dt;
      this.y += 40 * dt;
      if (Math.random() < 0.25) g.effects.push(new FxAnim('explosion', 'boom', this.x + Math.random() * this.w, this.y + Math.random() * this.h, 0.55, 0.6 + Math.random() * 0.5));
      if (Math.random() < 0.08) sfx.boom(true);
      if (this.dying <= 0) { this.dead = true; g.stageClear(); }
      return;
    }
    if (this.delay > 0) { this.delay -= dt; return; }
    const p = g.nearestPlayer(this);
    this.timer -= dt;
    this.mouthT = Math.max(0, (this.mouthT || 0) - dt);
    const fast = this.phase >= 2 ? 1.35 : 1;
    switch (this.state) {
      case 'enter': {
        // leaps up out of the water below into the arena
        if (!this.entered) { this.entered = true; this.vy = -760; this.timer = 0; sfx.boom(true); }
        this.vy += 900 * dt;
        this.y += this.vy * dt;
        this.curl = true;
        if (this.vy > 0 && this.y < A.top + 90) { this.state = 'swim'; this.timer = 1.6; this.curl = false; }
        break;
      }
      case 'swim': {
        // a lazy figure-of-eight over the arena, facing the way it moves
        this.path += dt * 0.9 * fast;
        const cx = (A.lo + A.hi) / 2 + Math.sin(this.path) * 190;
        const cy = A.top + 105 + Math.sin(this.path * 2) * 30; // kept below the boss health bar
        const nx = cx - this.w / 2;
        if (Math.abs(nx - this.x) > 0.5) this.facing = nx > this.x ? 1 : -1;
        this.x += (nx - this.x) * Math.min(1, dt * 4);
        this.y += (cy - this.h / 2 - this.y) * Math.min(1, dt * 4);
        if (this.timer <= 0 && p) this.pickAttack();
        break;
      }
      case 'spray': {
        // mouth open (glow) first, then a sweeping stream of water shots
        if (p) this.facing = p.cx < this.cx ? -1 : 1;
        if (this.timer <= 0 && this.shots > 0) {
          const m = this.mouth();
          const base = Math.atan2(p ? p.cy - m.y : 1, p ? p.cx - m.x : this.facing);
          const k = this.shots / this.maxShots;
          const a = base + (k - 0.5) * 0.9 * this.sweepDir;
          g.ebullets.push({ x: m.x, y: m.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, t: 0, kind: 'water', r: 6, draw: drawWater });
          sfx.enemyShot();
          this.shots--;
          this.mouthT = 0.15;
          this.timer = 0.09;
          if (this.shots <= 0) { this.state = 'swim'; this.timer = 1.4 / fast; }
        }
        break;
      }
      case 'bubbles': {
        if (this.timer <= 0) {
          const n = this.phase >= 2 ? 10 : 8;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + this.t;
            g.ebullets.push({
              x: this.cx, y: this.cy, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, t: 0, kind: 'bubble', r: 9, life: 3.2, drag: 0.4,
              seed: Math.random() * 6, draw: drawBubble, shootable: true,
              update(b, dt2) { b.vy -= 20 * dt2; },
            });
          }
          sfx.hiss();
          this.state = 'swim';
          this.timer = 1.3 / fast;
        }
        break;
      }
      case 'rise': {
        // up and out of view; then the shadow on the floor shows where it will come down
        this.curl = true;
        this.y -= 520 * dt;
        if (this.y < A.top - this.h - 60) {
          this.state = 'aim';
          this.timer = this.phase >= 3 ? 0.6 : 0.9;
          this.target = p ? p.cx : (A.lo + A.hi) / 2;
        }
        break;
      }
      case 'aim': {
        if (p && this.timer > 0.3) this.target += Math.max(-140 * dt, Math.min(140 * dt, p.cx - this.target)); // the shadow follows a little
        this.x = this.target - this.w / 2;
        if (this.timer <= 0) { this.state = 'slam'; this.vy = 200; }
        break;
      }
      case 'slam': {
        this.vy += 2400 * dt;
        this.y += this.vy * dt;
        if (this.y + this.h >= this.floorY) {
          this.y = this.floorY - this.h;
          g.shake(12);
          sfx.boom(true);
          floorWave(g, this.x + 10, this.floorY, -1);
          floorWave(g, this.x + this.w - 10, this.floorY, 1);
          if (this.frenzy > 0) {
            this.frenzy--;
            this.state = 'rise';
            if (this.frenzy === 0) { this.state = 'tired'; this.timer = 2.2; }
          } else {
            this.state = 'stunned';
            this.timer = this.phase >= 2 ? 0.9 : 1.2;
          }
          this.curl = false;
        }
        break;
      }
      case 'stunned':
      case 'tired': {
        if (this.timer <= 0) {
          this.state = 'swim';
          this.timer = 1.2;
          this.vy = 0;
          if (this.phase >= 3 && !this.frenzy) this.frenzyCool = (this.frenzyCool || 0) + 1;
        }
        break;
      }
      case 'torpedo': {
        if (this.timer <= 0) {
          const m = this.mouth();
          for (const d of [-0.5, 0, 0.5]) g.addEnemy(new Torpedo(g, m.x, m.y, (this.facing < 0 ? Math.PI : 0) + d));
          sfx.enemyShot();
          this.state = 'swim';
          this.timer = 1.5;
        }
        break;
      }
      case 'sweep': {
        // leave by one side, warn (splash and arrow) at the other, then charge low along the floor
        if (this.sweepStage === 0) {
          this.x += this.sweepFrom * 520 * dt;
          if (this.x > A.hi + 40 || this.x + this.w < A.lo - 40) {
            this.sweepStage = 1;
            this.timer = 0.8;
            this.y = this.floorY - this.h - 6;
            this.facing = this.sweepFrom;
            this.facing = -this.sweepFrom;
            this.x = this.sweepFrom > 0 ? A.hi + 60 : A.lo - this.w - 60;
          }
        } else if (this.sweepStage === 1) {
          if (this.timer <= 0) { this.sweepStage = 2; sfx.charge(); }
        } else {
          this.x += -this.sweepFrom * 560 * dt;
          if ((this.sweepFrom > 0 && this.x + this.w < A.lo - 40) || (this.sweepFrom < 0 && this.x > A.hi + 40)) {
            this.state = 'enter';
            this.entered = false;
            this.x = (A.lo + A.hi) / 2 - this.w / 2;
            this.y = g.cam.y + g.H + 20;
          }
        }
        break;
      }
      case 'mines': {
        if (this.timer <= 0) {
          for (const k of [0.25, 0.75]) g.addEnemy(new Puffer(g, A.lo + (A.hi - A.lo) * k, this.floorY - 120));
          this.state = 'swim';
          this.timer = 1.2;
        }
        break;
      }
    }
  }
  pickAttack() {
    const g = this.game;
    const p1 = ['spray', 'bubbles', 'spray', 'slam'];
    const p2 = ['spray', 'torpedo', 'slam', 'sweep', 'bubbles', 'torpedo', 'slam', 'mines'];
    if (this.phase >= 3 && (this.frenzyCool || 0) >= 1) {
      this.frenzyCool = 0;
      this.frenzy = 3;
    }
    let plan = this.frenzy > 0 ? 'slam' : (this.phase === 1 ? p1 : p2)[this.plan++ % (this.phase === 1 ? p1.length : p2.length)];
    if (plan === 'mines' && g.enemies.some((e) => e instanceof Puffer && !e.dead)) plan = 'spray';
    this.state = plan === 'slam' ? 'rise' : plan;
    if (plan === 'spray') { this.maxShots = this.shots = this.phase >= 2 ? 9 : 7; this.timer = 0.6; this.mouthT = 0.6; this.sweepDir = Math.random() < 0.5 ? -1 : 1; sfx.charge(); }
    if (plan === 'bubbles') { this.timer = 0.4; this.mouthT = 0.4; }
    if (plan === 'torpedo') { this.timer = 0.5; this.mouthT = 0.5; }
    if (plan === 'sweep') { this.sweepFrom = this.cx < (this.arena.lo + this.arena.hi) / 2 ? -1 : 1; this.sweepStage = 0; this.facing = this.sweepFrom; }
    if (plan === 'mines') this.timer = 0.3;
    if (plan === 'slam') g.text(this.cx, this.y - 6, t('koi.slam'), C.red);
  }
  mouth() { return { x: this.cx + this.facing * (this.w / 2 - 14), y: this.cy + 6 }; }
  draw(ctx) {
    const A = this.arena;
    const g = this.game;
    // where the slam will land: a shadow on the floor that darkens as it comes
    if (this.state === 'aim' || (this.state === 'slam' && this.y + this.h < this.floorY - 4)) {
      const k = this.state === 'aim' ? 1 - Math.max(0, this.timer) : 1;
      ctx.beginPath();
      ctx.ellipse(this.target ?? this.cx, this.floorY - 2, 30 + 50 * k, 7, 0, 0, TAU);
      ctx.fillStyle = `rgba(30,30,30,${0.2 + 0.35 * k})`;
      ctx.fill();
    }
    // the low charge: a warning arrow and splash on the side it will come from
    if (this.state === 'sweep' && this.sweepStage === 1 && Math.floor(this.t * 10) % 2) {
      const x = this.sweepFrom > 0 ? A.hi - 30 : A.lo + 30;
      const y = this.floorY - this.h / 2 - 6;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(-this.sweepFrom, 1);
      ctx.beginPath();
      ctx.moveTo(-16, -12); ctx.lineTo(6, 0); ctx.lineTo(-16, 12); ctx.closePath();
      ink(ctx, C.red, 2.5);
      ctx.restore();
      ctx.font = '400 20px Bungee, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = C.red;
      ctx.fillText('!', x, y - 18);
    }
    const broken = this.phase >= 2;
    const anim = this.curl ? 'leap' : broken ? 'broken' : this.mouthT > 0 ? 'mouth' : 'swim';
    ctx.save();
    if (this.state === 'stunned' || this.state === 'tired') ctx.translate(Math.sin(this.t * 30) * 1.5, 0);
    const f = frame('koi', anim);
    const ref = frame('koi', 'swim');
    if (f && ref) {
      const scale = (this.w + 24) / ref.w; // one scale for every frame, from the swimming pose
      drawFrame(ctx, f, this.cx, this.y + this.h + 8, scale, { flip: -this.facing, flash: this.flashOn() });
    } else {
      ctx.beginPath();
      ctx.ellipse(this.cx, this.cy, this.w / 2, this.h / 2, 0, 0, TAU);
      ink(ctx, this.flash > 0 ? '#fff' : broken ? '#C9573F' : C.red, 3);
      ctx.beginPath();
      ctx.arc(this.cx + this.facing * (this.w / 2 - 24), this.cy - 8, 8, 0, TAU);
      ink(ctx, '#FF3B30', 2);
    }
    ctx.restore();
    if (this.mouthT > 0 && !this.curl) {
      const m = this.mouth();
      const gl = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 24);
      gl.addColorStop(0, 'rgba(242,179,61,0.6)');
      gl.addColorStop(1, 'rgba(242,179,61,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(m.x - 24, m.y - 24, 48, 48);
    }
    if ((this.state === 'stunned' || this.state === 'tired') && g) {
      // dizzy stars over the admiral: the window to hit hard
      for (let i = 0; i < 3; i++) {
        const a = this.t * 4 + (i * TAU) / 3;
        ctx.beginPath();
        ctx.arc(this.cx + Math.cos(a) * 26, this.y - 8 + Math.sin(a) * 6, 4, 0, TAU);
        ink(ctx, C.yellow, 1.5);
      }
    }
  }
}
