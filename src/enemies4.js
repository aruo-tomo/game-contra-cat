// Stage 4 (pet hospital basement: Dr. Rat's brainwashing lab) enemies, hazards and bosses.
// New here: hypnosis (rings that swap left and right for a moment), flame streams, tesla strikes
// on a marked spot and fences between two coils, steam jets, spider-bots that drop on threads,
// specimen pods with cats to break free, a drill digger that clings to the lift shaft walls, and a
// spider mech that walks, climbs onto the ceiling, and finally flies as a lone cockpit.

import { t } from './i18n.js';
import { C, ink, rrect, drawRat } from './art.js';
import { sfx } from './audio.js';
import { frame, drawFrame } from './sprites.js';
import { Enemy, RatSoldier, enemyShot, moveBody, overlap, FxAnim } from './entities.js';
import { floorWave } from './enemies2.js';

const TAU = Math.PI * 2;

function segDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy || 1;
  const k = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2));
  return Math.hypot(px - (x0 + dx * k), py - (y0 + dy * k));
}

function drawBolt(ctx, x0, y0, x1, y1, w = 3) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  const n = 7;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    ctx.lineTo(x0 + (x1 - x0) * k + (Math.random() - 0.5) * 14, y0 + (y1 - y0) * k + (Math.random() - 0.5) * 14);
  }
  ctx.lineTo(x1, y1);
  ctx.lineCap = 'round';
  ctx.lineWidth = w + 4;
  ctx.strokeStyle = 'rgba(242,179,61,0.35)';
  ctx.stroke();
  ctx.lineWidth = w;
  ctx.strokeStyle = C.yellow;
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.restore();
}

function drawWarn(ctx, x0, y0, x1, y1, tm) {
  if (Math.floor(tm * 14) % 2) return;
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

// ======================= SHOTS =======================

function drawRing(ctx, b) {
  const f = frame('lshot', 'ring');
  const pulse = 1 + Math.sin(b.t * 12) * 0.1;
  if (f) return drawFrame(ctx, f, b.x, b.y, ((b.r * 2.4) / f.w) * pulse, { anchor: 'center' });
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, (b.r - i * 4) * pulse, 0, TAU);
    ctx.lineWidth = 2.5 - i * 0.5;
    ctx.strokeStyle = i % 2 ? C.ink : C.red;
    ctx.stroke();
  }
}

// hypnosis ring: drifts toward the hero (slowly homing); a hit swaps left and right for a while.
// It does no damage, and a shot pops it.
export function hypnoRing(game, x, y, ang, speed = 115, secs = 2.5) {
  game.ebullets.push({
    x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, t: 0, kind: 'hypno', r: 11, harmless: true, shootable: true,
    life: 4, draw: drawRing,
    onHit(p) { p.confuse(secs); },
    update(b, dt) {
      const p = game.nearestPlayer(b.target || { cx: b.x, cy: b.y });
      if (!p) return;
      const want = Math.atan2(p.cy - b.y, p.cx - b.x);
      const cur = Math.atan2(b.vy, b.vx);
      let d = want - cur;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      const a = cur + Math.max(-1.1 * dt, Math.min(1.1 * dt, d));
      b.vx = Math.cos(a) * speed;
      b.vy = Math.sin(a) * speed;
    },
  });
  sfx.charge();
}

function drawFlame(ctx, b) {
  const k = b.t / b.life;
  const f = frame('lshot', 'flame');
  ctx.save();
  ctx.globalAlpha = 1 - k * 0.6;
  if (f) drawFrame(ctx, f, b.x, b.y, ((10 + k * 22) / f.h), { anchor: 'center', rot: Math.atan2(b.vy, b.vx) });
  else {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5 + k * 9, 0, TAU);
    ink(ctx, k < 0.4 ? C.yellow : C.red, 1.5);
  }
  ctx.restore();
}

function flamePuff(game, x, y, ang) {
  game.ebullets.push({
    x, y, vx: Math.cos(ang) * 270, vy: Math.sin(ang) * 270, t: 0, kind: 'flame', r: 8, life: 0.5, drag: 1.6, draw: drawFlame,
    update(b) { b.r = 6 + (b.t / b.life) * 8; if (b.t > b.life) b.dead = true; },
  });
}

function drawSaw(ctx, b) {
  const f = frame('lshot', 'saw');
  if (f) return drawFrame(ctx, f, b.x, b.y, 26 / f.w, { anchor: 'center', rot: b.t * 20 });
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.t * 20);
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 9 : 13;
    ctx.lineTo(Math.cos((i / 16) * TAU) * r, Math.sin((i / 16) * TAU) * r);
  }
  ctx.closePath();
  ink(ctx, '#B9C2C4', 2);
  ctx.restore();
}

// saw-blade disc: bounces between the shaft walls a few times
export function sawDisc(game, x, y, vx, vy, lo, hi) {
  game.ebullets.push({
    x, y, vx, vy, t: 0, kind: 'saw', r: 11, linger: true, life: 5, bounces: 3, draw: drawSaw,
    update(b) {
      if ((b.x < lo + 12 && b.vx < 0) || (b.x > hi - 12 && b.vx > 0)) {
        b.vx *= -1;
        b.bounces--;
        sfx.clink();
        if (b.bounces < 0) b.dead = true;
      }
    },
  });
  sfx.enemyShot();
}

// ======================= HAZARDS =======================

// Steam pipe: hisses and puffs (the warning), then a hot jet blasts out for a moment
export class SteamVent extends Enemy {
  constructor(game, x, y, dir = -1, phase = 0) {
    // dir -1: from a floor pipe straight up; 1: from a ceiling pipe straight down
    super(game, x - 8, y, 16, 10, 1);
    this.dir = dir;
    this.phase = phase;
    this.len = 120;
  }
  hittable() { return false; }
  get cycle() { return (this.t + this.phase) % 3.2; }
  get jetting() { return this.cycle > 2.3; }
  get hissing() { return this.cycle > 1.6 && this.cycle <= 2.3; }
  jetBox() {
    return this.dir < 0 ? { x: this.x - 4, y: this.y - this.len, w: this.w + 8, h: this.len } : { x: this.x - 4, y: this.y + this.h, w: this.w + 8, h: this.len };
  }
  touches(p) { return this.jetting && overlap(this.jetBox(), p); }
  update(dt) {
    const was = this.jetting;
    this.base(dt);
    if (!was && this.jetting && this.game.onScreen(this)) sfx.hiss();
  }
  draw(ctx) {
    // the pipe nozzle
    rrect(ctx, this.x - 2, this.y, this.w + 4, this.h, 3);
    ink(ctx, '#7A6E62', 2);
    const b = this.jetBox();
    if (this.jetting || this.hissing) {
      const n = this.jetting ? 9 : 2;
      for (let i = 0; i < n; i++) {
        const k = ((this.t * 3 + i / n) % 1);
        const y = this.dir < 0 ? this.y - k * (this.jetting ? b.h : 20) : this.y + this.h + k * (this.jetting ? b.h : 20);
        const r = (this.jetting ? 8 : 4) + k * 8;
        ctx.beginPath();
        ctx.arc(this.cx + Math.sin(i * 2.3 + this.t * 9) * 4, y, r, 0, TAU);
        ctx.fillStyle = `rgba(239,234,223,${this.jetting ? 0.85 - k * 0.5 : 0.5})`;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(30,30,30,0.5)';
        ctx.stroke();
      }
    }
  }
}

// Specimen pod: a brainwashed cat asleep in a glass tank. Break the glass to set it free; whoever
// breaks it gets a heart back.
export class Pod extends Enemy {
  constructor(game, x, floorY) {
    super(game, x, floorY - 62, 34, 62, 4);
    this.cat = 'cat05';
    this.freedH = 44;
    this.score = 500;
    this.pod = true;
  }
  touches() { return false; }
  update(dt) { this.base(dt); }
  damage(n, by) {
    const was = this.dead;
    super.damage(n, by);
    if (!was && this.dead) {
      sfx.boom(false);
      this.game.effects.push(new FxAnim('impact', 'hit', this.cx, this.cy, 0.3, 0.9));
      if (by && by.hp != null && by.hp < by.maxHp) { by.hp++; this.game.text(by.cx, by.y - 18, '+♥', C.red); }
    }
  }
  draw(ctx) {
    const f = frame('pod', 'tank');
    if (f) { drawFrame(ctx, f, this.cx, this.y + this.h, (this.h + 6) / f.h, { flash: this.flashOn() }); return; }
    rrect(ctx, this.x, this.y + 8, this.w, this.h - 14, 10);
    ctx.fillStyle = 'rgba(160,200,180,0.5)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    this.drawSprite(ctx, 'cat05', 36, {});
    rrect(ctx, this.x - 3, this.y + this.h - 8, this.w + 6, 8, 2);
    ink(ctx, C.greenDk, 2);
    rrect(ctx, this.x - 3, this.y, this.w + 6, 9, 2);
    ink(ctx, C.greenDk, 2);
  }
}

// ======================= REGULARS =======================

// Brainwashed lab cat (can be freed): shuffles toward you and sends hypnosis rings from its antenna
export class HypnoCat extends Enemy {
  constructor(game, x, floorY, dir = -1) {
    super(game, x, floorY - 46, 26, 46, 3);
    this.cat = 'hypno';
    this.score = 300;
    this.facing = dir;
    this.cool = 1.2 + Math.random();
    this.emitT = 0;
  }
  update(dt) {
    this.base(dt);
    const g = this.game;
    const p = g.nearestPlayer(this);
    this.emitT = Math.max(0, this.emitT - dt);
    if (p && this.emitT <= 0) this.facing = p.cx < this.cx ? -1 : 1;
    this.vx = this.emitT > 0 ? 0 : this.facing * 34;
    moveBody(this, dt, g.level);
    if (this.onGround && this.hitWall) this.vy = -380;
    if (this.y > g.cam.y + 440 || this.x < g.cam.x - 160 || this.x > g.cam.x + g.W + 220) this.dead = true;
    if (!p || !g.onScreen(this)) return;
    this.cool -= dt;
    if (this.cool <= 0) {
      this.cool = 3 + Math.random() * 0.8;
      this.emitT = 0.6;
      hypnoRing(g, this.cx, this.y + 4, Math.atan2(p.cy - this.y, p.cx - this.cx));
    }
  }
  draw(ctx) {
    const anim = this.emitT > 0 ? 'emit' : 'walk';
    if (this.drawGen(ctx, 'hypnocat', anim, this.t * 4, 54 / 112, { flip: this.facing < 0 ? 1 : -1, dy: 1 })) return;
    this.drawSprite(ctx, 'cat06', 48, { flip: -this.facing });
    ctx.beginPath();
    ctx.moveTo(this.cx, this.y + 2);
    ctx.lineTo(this.cx, this.y - 10);
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.cx, this.y - 12, 3 + (this.emitT > 0 ? 2 : 0), 0, TAU);
    ink(ctx, C.red, 1.2);
  }
}

// Flamethrower rat: walks up close, a pilot-light flicker, then a sweeping stream of fire
export class FlameRat extends RatSoldier {
  constructor(game, x, floorY) {
    super(game, x, floorY, 26, 42, 4, 400);
    this.cool = 1.5 + Math.random();
    this.burn = 0;
  }
  update(dt) {
    const g = this.game;
    const p0 = g.nearestPlayer(this);
    this.vx = 0;
    if (this.burn <= 0 && this.cool > 0.5 && p0 && Math.abs(p0.cx - this.cx) > 110 && this.onGround) {
      const dir = Math.sign(p0.cx - this.cx);
      const ahead = this.cx + dir * 18;
      const top = g.groundTopAt(ahead, this.y + this.h - 6);
      if (top != null && Math.abs(top - (this.y + this.h)) < 4) this.vx = dir * 50;
    }
    const p = this.stand(dt);
    if (!p || !g.onScreen(this)) return;
    if (this.burn > 0) {
      this.burn -= dt;
      this.puffT = (this.puffT || 0) - dt;
      if (this.puffT <= 0) {
        this.puffT = 0.05;
        const sweep = Math.sin((1.4 - this.burn) * 4) * 0.32 - 0.05;
        const a = this.facing > 0 ? sweep : Math.PI - sweep;
        flamePuff(g, this.cx + this.facing * 24, this.y + 22, a);
      }
      this.fireT = 0.1;
      return;
    }
    this.cool -= dt;
    if (this.cool <= 0) { this.cool = 2.8 + Math.random() * 0.6; this.burn = 1.4; sfx.boom(false); }
  }
  draw(ctx) {
    const firing = this.burn > 0;
    const drew = this.drawGen(ctx, 'flamerat', firing ? 'fire' : 'idle', 0, 48 / 92, { flip: -this.facing, dy: 1 });
    // pilot light at the nozzle before it lets rip
    if (!firing && this.cool < 0.5 && this.game.onScreen(this)) {
      ctx.beginPath();
      ctx.arc(this.cx + this.facing * 26, this.y + 22, 3 + Math.random() * 2, 0, TAU);
      ink(ctx, C.yellow, 1.2);
    }
    if (drew) return;
    drawRat(ctx, this.cx, this.y + this.h, this.facing, this.t, { flash: this.flash > 0 });
    rrect(ctx, this.cx - this.facing * 12 - 5, this.y + 12, 10, 18, 4);
    ink(ctx, C.red, 1.5);
  }
}

// Tesla rat: marks the spot where you stand, then lightning strikes it. Two tesla rats near each
// other also join their coils with an electric fence now and then — at head height: duck under it.
export class TeslaRat extends RatSoldier {
  constructor(game, x, floorY) {
    super(game, x, floorY, 26, 42, 4, 450);
    this.cool = 1.6 + Math.random() * 0.6;
    this.mark = null;
    this.fenceT = 2 + Math.random();
  }
  coil() { return { x: this.cx - this.facing * 4, y: this.y + 4 }; }
  partner() {
    return this.game.enemies.find((e) => e !== this && e instanceof TeslaRat && !e.dead && Math.abs(e.cx - this.cx) < 320 && Math.abs(e.y - this.y) < 6);
  }
  update(dt) {
    this.vx = 0;
    const g = this.game;
    const p = this.stand(dt);
    if (!p || !g.onScreen(this)) return;
    if (this.mark) {
      this.mark.t -= dt;
      if (this.mark.t <= 0 && !this.mark.hit) {
        this.mark.hit = 0.25;
        sfx.laser();
        g.shake(3);
        for (const q of g.alivePlayers()) if (Math.abs(q.cx - this.mark.x) < 24 && Math.abs(q.y + q.h - this.mark.y) < 40) q.hurt();
      }
      if (this.mark.hit != null && (this.mark.hit -= dt) <= 0) this.mark = null;
    } else {
      this.cool -= dt;
      if (this.cool <= 0) {
        this.cool = 2.6 + Math.random() * 0.5;
        this.mark = { x: p.cx, y: p.y + p.h, t: 0.8 };
        sfx.charge();
      }
    }
    // the fence: the left one of a pair drives it
    const mate = this.partner();
    if (mate && mate.cx > this.cx) {
      this.fenceT -= dt;
      if (this.fenceT <= 0 && !this.fence) { this.fence = { t: 1.6 }; sfx.charge(); }
      if (this.fence) {
        this.fence.t -= dt;
        this.fence.mate = mate;
        if (this.fence.t < 1.0) {
          const a = this.coil();
          const b = mate.coil();
          for (const q of g.alivePlayers()) {
            if (q.x + q.w > a.x && q.x < b.x && q.y < a.y + 4 && q.y + q.h > a.y - 4) q.hurt();
          }
        }
        if (this.fence.t <= 0) { this.fence = null; this.fenceT = 3.5 + Math.random(); }
      }
    } else this.fence = null;
  }
  draw(ctx) {
    const g = this.game;
    if (this.mark) {
      const m = this.mark;
      if (m.hit != null) drawBolt(ctx, this.coil().x, this.coil().y, m.x, m.y, 4);
      else {
        ctx.beginPath();
        ctx.ellipse(m.x, m.y - 1, 22 - m.t * 10, 5, 0, 0, TAU);
        ctx.lineWidth = 2;
        ctx.strokeStyle = Math.floor(g.t * 14) % 2 ? C.yellow : '#E8392E';
        ctx.stroke();
      }
    }
    if (this.fence) {
      const a = this.coil();
      const b = this.fence.mate.coil();
      if (this.fence.t < 1.0) drawBolt(ctx, a.x, a.y, b.x, b.y, 3);
      else drawWarn(ctx, a.x, a.y, b.x, b.y, g.t);
    }
    const busy = this.mark && this.mark.hit != null;
    if (this.drawGen(ctx, 'teslarat', busy || (this.mark && this.mark.t < 0.3) ? 'zap' : 'idle', 0, 48 / 92, { flip: -this.facing, dy: 1 })) return;
    drawRat(ctx, this.cx, this.y + this.h, this.facing, this.t, { flash: this.flash > 0 });
    ctx.beginPath();
    ctx.moveTo(this.coil().x, this.y + 14);
    ctx.lineTo(this.coil().x, this.coil().y);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.coil().x, this.coil().y, 4, 0, TAU);
    ink(ctx, busy ? C.yellow : '#B9C2C4', 1.5);
  }
}

// Spider-bot: scuttles along the ceiling; over a hero it lowers itself on a thread, drops, and
// skitters along the floor in hops
export class SpiderBot extends Enemy {
  constructor(game, x, ceilY) {
    super(game, x, ceilY, 22, 16, 2);
    this.villain = true;
    this.score = 150;
    this.ceil = ceilY;
    this.mode = 'crawl';
    this.modeT = 0;
  }
  update(dt) {
    this.base(dt);
    const g = this.game;
    const p = g.nearestPlayer(this);
    this.modeT += dt;
    if (this.mode === 'crawl') {
      this.y = this.ceil;
      if (p) this.x += Math.sign(p.cx - this.cx) * 90 * dt;
      if (p && Math.abs(p.cx - this.cx) < 18 && this.modeT > 0.5) { this.mode = 'dangle'; this.modeT = 0; }
    } else if (this.mode === 'dangle') {
      this.y = this.ceil + Math.min(30, this.modeT * 60);
      if (this.modeT > 0.5) { this.mode = 'drop'; this.vy = 120; this.vx = 0; }
    } else {
      if (this.onGround) {
        this.hopT = (this.hopT || 0) - dt;
        if (this.hopT <= 0 && p) { this.hopT = 0.5; this.vy = -260; this.vx = Math.sign(p.cx - this.cx) * 120; }
      }
      moveBody(this, dt, g.level);
    }
    if (this.y > g.cam.y + 440 || this.x < g.cam.x - 120 || this.x > g.cam.x + g.W + 200) this.dead = true;
  }
  draw(ctx) {
    if (this.mode === 'dangle' || (this.mode === 'drop' && this.y < this.ceil + 60)) {
      ctx.beginPath();
      ctx.moveTo(this.cx, this.ceil);
      ctx.lineTo(this.cx, this.y);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(30,30,30,0.7)';
      ctx.stroke();
    }
    const f = frame('spiderbot', this.mode === 'crawl' ? 'crawl' : this.onGround ? 'crawl' : 'drop', this.t * 10);
    if (f) { drawFrame(ctx, f, this.cx, this.cy, 30 / f.w, { anchor: 'center', rot: this.mode === 'crawl' ? Math.PI : 0, flash: this.flashOn() }); return; }
    ctx.beginPath();
    ctx.ellipse(this.cx, this.cy, 10, 7, 0, 0, TAU);
    ink(ctx, this.flash > 0 ? '#fff' : C.greenDk, 2);
    for (let i = -1; i <= 1; i += 2) {
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(this.cx + i * 6, this.cy);
        ctx.lineTo(this.cx + i * (13 + k * 2), this.cy + (this.mode === 'crawl' ? -8 : 8) + Math.sin(this.t * 20 + k) * 2);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = C.ink;
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.arc(this.cx - 3, this.cy - 1, 2, 0, TAU);
    ctx.fillStyle = C.red;
    ctx.fill();
  }
}

// ======================= MID-BOSS: DRILL DIGGER (in the lift shaft) =======================
// Clings to a shaft wall beside the falling lift. Shoves its drill right across the lift (low:
// jump it; high: duck under it — the red line shows which), throws saw blades that bounce between
// the walls, and leaps over to the other wall. Angry: two saws, faster drills.

export class DrillBoss extends Enemy {
  constructor(game, lift, lo, hi) {
    const two = game.players.filter(Boolean).length > 1;
    super(game, lo, lift.y - 200, 104, 56, two ? 135 : 90); // as wide as its art, so it sits right against the wall
    this.villain = true;
    this.score = 6000;
    this.boss = t('boss.drill');
    this.dropItem = 'M';
    this.freedLine = t('say.drillDown');
    this.lift = lift;
    this.lo = lo;
    this.hi = hi;
    this.side = -1; // -1: on the left wall, 1: on the right
    this.state = 'enter';
    this.timer = 0;
    this.plan = 0;
    this.rel = -130; // height above the lift floor
  }
  get angry() { return this.hp < this.maxHp / 2; }
  wallX() { return this.side < 0 ? this.lo : this.hi - this.w; }
  touches(p) {
    if (this.dead) return false;
    if (overlap(this, p)) return true;
    if (this.drill && this.drill.ext > 0.3) {
      const d = this.drillBox();
      return overlap(d, p);
    }
    return false;
  }
  drillBox() {
    const d = this.drill;
    const len = (this.hi - this.lo - this.w + 20) * d.ext;
    const y = this.lift.y - d.h;
    return this.side < 0 ? { x: this.x + this.w - 20, y: y - 7, w: len, h: 14 } : { x: this.x + 20 - len, y: y - 7, w: len, h: 14 };
  }
  update(dt) {
    this.base(dt);
    const g = this.game;
    const p = g.nearestPlayer(this);
    if (this.delay > 0) { this.delay -= dt; this.y = this.lift.y + this.rel - this.t * 0; return; }
    this.timer -= dt;
    this.facing = -this.side;
    if (this.state === 'enter') {
      // climbs down the wall into view
      this.x = this.wallX();
      this.rel += (-110 - this.rel) * Math.min(1, dt * 3);
      if (this.t > 1.2) { this.state = 'cling'; this.timer = 0.8; }
    } else if (this.state === 'cling') {
      this.x = this.wallX();
      this.rel = -110 + Math.sin(this.t * 2) * 30;
      if (this.timer <= 0 && p) {
        const plan = ['drill', 'saw', 'drill', 'swap'][this.plan++ % 4];
        this.state = plan;
        if (plan === 'drill') {
          // the drill drops to lift level: low (jump) or head height (duck); the red line shows which
          const low = Math.random() < 0.5;
          this.drill = { h: low ? 12 : 38, ext: 0, phase: 'aim', t: this.angry ? 0.55 : 0.8 };
          sfx.charge();
        }
        if (plan === 'saw') this.timer = 0.5;
        if (plan === 'swap') { this.timer = 0; this.vx = this.side < 0 ? 520 : -520; this.vy = -300; }
      }
    } else if (this.state === 'drill') {
      const d = this.drill;
      this.x = this.wallX();
      // slide down the wall so the drill lines up with its height over the lift
      this.rel += (-(d.h + this.h / 2) - this.rel) * Math.min(1, dt * 8);
      d.t -= dt;
      if (d.phase === 'aim' && d.t <= 0) { d.phase = 'out'; sfx.laser(); }
      else if (d.phase === 'out') { d.ext = Math.min(1, d.ext + dt / 0.22); if (d.ext >= 1) { d.phase = 'hold'; d.t = 0.3; g.shake(4); } }
      else if (d.phase === 'hold' && d.t <= 0) d.phase = 'back';
      else if (d.phase === 'back') { d.ext = Math.max(0, d.ext - dt / 0.35); if (d.ext <= 0) { this.drill = null; this.state = 'cling'; this.timer = this.angry ? 0.5 : 0.9; } }
    } else if (this.state === 'saw') {
      this.x = this.wallX();
      if (this.timer <= 0) {
        const n = this.angry ? 2 : 1;
        for (let i = 0; i < n; i++) {
          sawDisc(g, this.cx - this.side * 30, this.y + this.h / 2, -this.side * (220 + i * 60), 60 + i * 50, this.lo, this.hi);
        }
        // the saws ride down with the lift's frame of reference
        this.fireT = 0.3;
        this.state = 'cling';
        this.timer = 1;
      }
    } else if (this.state === 'swap') {
      // a leap across the shaft to the other wall
      this.x += this.vx * dt;
      this.vy += 900 * dt;
      this.rel += this.vy * dt;
      if ((this.vx > 0 && this.x >= this.hi - this.w) || (this.vx < 0 && this.x <= this.lo)) {
        this.side = -this.side;
        this.x = this.wallX();
        this.vx = 0;
        this.vy = 0;
        g.shake(6);
        sfx.boom(false);
        this.state = 'cling';
        this.timer = 0.6;
      }
      this.rel = Math.min(this.rel, -70);
    }
    this.fireT = Math.max(0, (this.fireT || 0) - dt);
    this.y = this.lift.y + this.rel - this.h / 2;
  }
  draw(ctx) {
    const d = this.drill;
    if (d && d.phase === 'aim') {
      const y = this.lift.y - d.h;
      drawWarn(ctx, this.lo, y, this.hi, y, this.game.t);
    }
    if (d && d.ext > 0) {
      const b = this.drillBox();
      // the piston arm, then the drill bit at its end
      ctx.fillStyle = '#7A877D';
      ctx.fillRect(b.x, b.y + 3, b.w, b.h - 6);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y + 3, b.w, b.h - 6);
      const tipX = this.side < 0 ? b.x + b.w : b.x;
      ctx.beginPath();
      ctx.moveTo(tipX, b.y - 4);
      ctx.lineTo(tipX - this.side * -24, b.y + b.h / 2);
      ctx.lineTo(tipX, b.y + b.h + 4);
      ctx.closePath();
      ink(ctx, C.yellow, 2);
    }
    // its work platform: a girder on the wall rails, with a brace back to the wall
    const wx = this.side < 0 ? this.lo : this.hi;
    const px = this.side < 0 ? this.lo : this.x - 6;
    const pw = this.side < 0 ? this.x + this.w + 6 - this.lo : this.hi - this.x + 6;
    rrect(ctx, px, this.y + this.h, pw, 9, 2);
    ink(ctx, '#6E6C64', 2.5);
    ctx.beginPath();
    ctx.moveTo(wx, this.y + this.h + 36);
    ctx.lineTo(this.cx, this.y + this.h + 9);
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    const anim = this.fireT > 0 ? 'throw' : 'idle'; // the piston and bit are drawn above, out of the drill
    ctx.save();
    if (d && d.phase === 'aim') ctx.translate(Math.sin(this.t * 70) * 1.5, 0);
    const drew = this.drawGen(ctx, 'drill', anim, 0, 70 / 200, { flip: -this.facing, dy: 4 });
    ctx.restore();
    if (drew) return;
    rrect(ctx, this.x, this.y, this.w, this.h, 8);
    ink(ctx, this.flash > 0 ? '#fff' : '#8FA399', 3);
    ctx.beginPath();
    const fx = this.side < 0 ? this.x + this.w : this.x;
    ctx.moveTo(fx, this.cy - 12);
    ctx.lineTo(fx - this.side * -26, this.cy);
    ctx.lineTo(fx, this.cy + 12);
    ctx.closePath();
    ink(ctx, C.yellow, 2);
  }
}

// ======================= BOSS: BRAINWAVE SPIDER MECH =======================
// Phase 1 (walking): stomps (floor waves), rears up to fire hypnosis rings and a spray of shots,
//                    lays spider-bots.
// Phase 2 (on the ceiling): climbs up and hangs upside down: sweeps a brainwave beam along the
//                    floor (hurts and hypnotises), drops egg-bombs and spider-bots.
// Phase 3 (legs gone): the glass cockpit flies on its own, chasing you, firing rings and diving.

export class SpiderMech extends Enemy {
  constructor(game, floorY, ceilY) {
    const two = game.players.filter(Boolean).length > 1;
    super(game, game.cam.x + game.W + 40, floorY - 120, 150, 120, two ? 390 : 260);
    this.villain = true;
    this.score = 25000;
    this.boss = t('boss.spider');
    this.floorY = floorY;
    this.ceilY = ceilY;
    this.phase = 1;
    this.state = 'enter';
    this.timer = 0;
    this.plan = 0;
    this.dying = 0;
    this.facing = -1;
  }
  get arena() { const g = this.game; return { lo: g.cam.x + 10, hi: g.cam.x + g.W - 10 }; }
  // the body (not the long thin legs) is what hurts to touch and what takes hits
  body() {
    if (this.phase === 3) return { x: this.x + 30, y: this.y + 20, w: this.w - 60, h: this.h - 40 };
    if (this.phase === 2) return { x: this.x + 20, y: this.y + 10, w: this.w - 40, h: 60 };
    return { x: this.x + 20, y: this.y + 8, w: this.w - 40, h: 62 };
  }
  hittable() { return !this.dead && this.dying <= 0 && this.state !== 'enter' && this.state !== 'climb'; }
  touches(p) { return this.hittable() && overlap(this.body(), p); }
  get cx() { const b = this.body(); return b.x + b.w / 2; }
  get cy() { const b = this.body(); return b.y + b.h / 2; }
  damage(n, by) {
    if (this.dying > 0) return;
    this.hp -= n;
    this.flash = 0.05;
    sfx.hit();
    const g = this.game;
    if (this.phase === 1 && this.hp < this.maxHp * 0.6) {
      this.phase = 2;
      this.state = 'climb';
      this.timer = 0;
      this.beam = null;
      g.say(t('spider.phase2'), 1.2);
      g.shake(8);
    } else if (this.phase === 2 && this.hp < this.maxHp * 0.25) {
      this.phase = 3;
      this.state = 'fall';
      this.beam = null;
      this.vy = 0;
      g.say(t('spider.phase3'), 1.4);
      g.shake(12);
      sfx.boom(true);
      for (let i = 0; i < 8; i++) g.effects.push(new FxAnim('explosion', 'boom', this.x + Math.random() * this.w, this.y + Math.random() * this.h, 0.5, 0.55));
    }
    if (this.hp <= 0) {
      this.dying = 2.6;
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
      this.y += 30 * dt;
      if (Math.random() < 0.25) g.effects.push(new FxAnim('explosion', 'boom', this.x + Math.random() * this.w, this.y + Math.random() * this.h, 0.55, 0.6 + Math.random() * 0.5));
      if (Math.random() < 0.08) sfx.boom(true);
      if (this.dying <= 0) { this.dead = true; g.stageClear(); }
      return;
    }
    if (this.delay > 0) { this.delay -= dt; return; }
    const p = g.nearestPlayer(this);
    this.timer -= dt;
    this.rearT = Math.max(0, (this.rearT || 0) - dt);
    switch (this.state) {
      case 'enter':
        this.x -= 120 * dt;
        this.y = this.floorY - this.h;
        if (this.x < A.hi - this.w - 20) { this.state = 'walk'; this.timer = 1.4; }
        break;
      case 'walk': {
        // pace toward the hero, keeping some distance
        if (p) this.facing = p.cx < this.cx ? -1 : 1;
        const want = p ? p.cx - this.facing * 170 - this.w / 2 : this.x;
        this.x += Math.max(-80 * dt, Math.min(80 * dt, want - this.x));
        this.x = Math.max(A.lo, Math.min(A.hi - this.w, this.x));
        this.y = this.floorY - this.h;
        if (this.timer <= 0 && p) {
          const plan = ['stomp', 'rings', 'stomp', 'eggs'][this.plan++ % 4];
          this.state = plan;
          this.timer = plan === 'stomp' ? 0.6 : 0.5;
          this.rearT = this.timer + 0.3;
          if (plan === 'stomp') sfx.charge();
        }
        break;
      }
      case 'stomp':
        if (this.timer <= 0) {
          g.shake(9);
          sfx.boom(true);
          floorWave(g, this.x + 10, this.floorY, -1);
          floorWave(g, this.x + this.w - 10, this.floorY, 1);
          this.state = 'walk';
          this.timer = 1.6;
        }
        break;
      case 'rings':
        if (this.timer <= 0 && p) {
          const d = this.dish();
          const a = Math.atan2(p.cy - d.y, p.cx - d.x);
          for (const k of [-0.5, 0, 0.5]) hypnoRing(g, d.x, d.y, a + k, 120);
          for (let i = -2; i <= 2; i++) enemyShot(g, d.x, d.y, a + i * 0.16, 210);
          this.state = 'walk';
          this.timer = 1.8;
        }
        break;
      case 'eggs':
        if (this.timer <= 0) {
          for (const dx of [-30, 30]) {
            const s = new SpiderBot(g, this.cx + dx, this.y + this.h - 30);
            s.mode = 'drop';
            s.vy = -200;
            s.vx = dx * 4;
            g.addEnemy(s);
          }
          this.state = 'walk';
          this.timer = 1.6;
        }
        break;
      case 'climb':
        // up the back wall and onto the ceiling
        this.y -= 260 * dt;
        if (this.y <= this.ceilY) { this.y = this.ceilY; this.state = 'hang'; this.timer = 1; }
        break;
      case 'hang': {
        // scuttle along the ceiling above the hero
        if (p) this.facing = p.cx < this.cx ? -1 : 1;
        const want = p ? p.cx - this.w / 2 + Math.sin(this.t) * 60 : this.x;
        this.x += Math.max(-110 * dt, Math.min(110 * dt, want - this.x));
        this.x = Math.max(A.lo, Math.min(A.hi - this.w, this.x));
        this.y = this.ceilY;
        if (this.timer <= 0 && p) {
          const plan = ['beam', 'bombs', 'beam', 'drop'][this.plan++ % 4];
          this.state = plan;
          if (plan === 'beam') {
            // the beam starts on one side of the hero and sweeps across: dashed line first
            const dir = Math.random() < 0.5 ? -1 : 1;
            this.beam = { x: p.cx - dir * 160, dir, t: 0.7, on: false };
            sfx.charge();
          }
          this.timer = 0.5;
        }
        break;
      }
      case 'beam': {
        const b = this.beam;
        b.t -= dt;
        if (!b.on && b.t <= 0) { b.on = true; b.t = 1.3; sfx.laser(); }
        if (b.on) {
          b.x += b.dir * 250 * dt;
          for (const q of g.alivePlayers()) {
            if (Math.abs(q.cx - b.x) < 16) { q.hurt(); q.confuse(2); }
          }
          if (b.t <= 0) { this.beam = null; this.state = 'hang'; this.timer = 1.2; }
        }
        break;
      }
      case 'bombs':
        if (this.timer <= 0) {
          for (let i = 0; i < 3; i++) {
            g.ebullets.push({ x: this.cx + (i - 1) * 40, y: this.y + this.h - 10, vx: (i - 1) * 60, vy: 40, gravity: 600, t: 0, kind: 'enemy', r: 6, bomb: true });
          }
          sfx.enemyShot();
          this.state = 'hang';
          this.timer = 1.4;
        }
        break;
      case 'drop':
        if (this.timer <= 0) {
          for (const dx of [-60, 60]) g.addEnemy(new SpiderBot(g, this.cx + dx, this.ceilY + 10));
          this.state = 'hang';
          this.timer = 1.2;
        }
        break;
      case 'fall':
        // the legs blow off and the cockpit drops, then its jets catch it
        this.vy += 900 * dt;
        this.y += this.vy * dt;
        if (this.y > this.floorY - 200) { this.state = 'fly'; this.timer = 1; this.vy = 0; }
        break;
      case 'fly': {
        // hover above the hero, weaving; rings, and now and then a dive
        if (p) {
          const tx = p.cx - this.w / 2 + Math.sin(this.t * 1.6) * 90;
          const ty = this.floorY - 210 + Math.sin(this.t * 2.3) * 25;
          this.x += (tx - this.x) * Math.min(1, dt * 1.6);
          this.y += (ty - this.y) * Math.min(1, dt * 2);
          this.facing = p.cx < this.cx ? -1 : 1;
        }
        this.x = Math.max(A.lo - 20, Math.min(A.hi - this.w + 20, this.x));
        if (this.timer <= 0 && p) {
          if (this.plan++ % 3 === 2) {
            this.state = 'dive';
            this.timer = 0.6;
            this.diveTo = { x: p.cx - this.w / 2, y: this.floorY - this.h + 20 };
            sfx.charge();
          } else {
            const d = this.dish();
            hypnoRing(g, d.x, d.y, Math.atan2(p.cy - d.y, p.cx - d.x), 140, 2);
            for (let i = -1; i <= 1; i++) enemyShot(g, d.x, d.y, Math.atan2(p.cy - d.y, p.cx - d.x) + i * 0.25, 230);
            this.timer = 1.1;
          }
        }
        break;
      }
      case 'dive':
        if (this.timer > 0) break; // shaking: the warning
        this.x += (this.diveTo.x - this.x) * Math.min(1, dt * 6);
        this.y += 520 * dt;
        if (this.y >= this.diveTo.y) {
          this.y = this.diveTo.y;
          g.shake(10);
          sfx.boom(true);
          floorWave(g, this.cx - 30, this.floorY, -1);
          floorWave(g, this.cx + 30, this.floorY, 1);
          this.state = 'dazed';
          this.timer = 1.1;
        }
        break;
      case 'dazed':
        if (this.timer <= 0) { this.state = 'fly'; this.timer = 1; }
        break;
    }
  }
  dish() {
    const b = this.body();
    if (this.phase === 2) return { x: b.x + b.w / 2 + this.facing * 30, y: b.y + b.h + 8 };
    return { x: this.facing > 0 ? b.x + b.w + 6 : b.x - 6, y: b.y + 20 };
  }
  draw(ctx) {
    const g = this.game;
    const b = this.beam;
    if (b) {
      if (b.on) {
        ctx.save();
        ctx.fillStyle = 'rgba(232,57,46,0.28)';
        ctx.fillRect(b.x - 18, this.ceilY + 40, 36, this.floorY - this.ceilY - 40);
        ctx.restore();
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.ellipse(b.x, this.floorY - 10 - ((g.t * 300 + i * 60) % 220), 18, 6, 0, 0, TAU);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = C.red;
          ctx.stroke();
        }
      } else {
        drawWarn(ctx, b.x, this.ceilY + 40, b.x, this.floorY, g.t);
        drawWarn(ctx, b.x, this.floorY - 3, b.x + b.dir * 200, this.floorY - 3, g.t);
      }
    }
    if (this.state === 'dive' && this.timer > 0 && this.diveTo) {
      ctx.beginPath();
      ctx.ellipse(this.diveTo.x + this.w / 2, this.floorY - 2, 50, 7, 0, 0, TAU);
      ctx.fillStyle = 'rgba(30,30,30,0.35)';
      ctx.fill();
    }
    let anim = 'walk';
    if (this.phase === 3) anim = 'pod';
    else if (this.phase === 2 || this.state === 'climb') anim = 'ceiling';
    else if (this.rearT > 0) anim = 'rear';
    ctx.save();
    if ((this.state === 'dive' && this.timer > 0) || this.state === 'dazed' || (this.state === 'stomp' && this.timer > 0)) ctx.translate(Math.sin(this.t * 60) * 2, 0);
    const f = frame('spider', anim, this.t * 6);
    const ref = frame('spider', 'walk');
    if (f && ref) {
      const s = (this.w + 30) / ref.w;
      const bottom = anim === 'ceiling' ? this.y + f.h * s : this.y + this.h + 4;
      drawFrame(ctx, f, this.x + this.w / 2, bottom, s, { flip: -this.facing, flash: this.flashOn() });
    } else {
      const bd = this.body();
      if (this.phase < 3) {
        for (let i = 0; i < 6; i++) {
          const lx = this.x + 10 + i * (this.w - 20) / 5;
          const up = this.phase === 2 ? -1 : 1;
          ctx.beginPath();
          ctx.moveTo(bd.x + bd.w / 2, bd.y + bd.h / 2);
          ctx.lineTo(lx, bd.y + (up > 0 ? -12 : bd.h + 12));
          ctx.lineTo(lx + Math.sin(this.t * 8 + i) * 4, up > 0 ? this.floorY : this.ceilY);
          ctx.lineWidth = 4;
          ctx.strokeStyle = C.ink;
          ctx.stroke();
        }
      }
      ctx.beginPath();
      ctx.ellipse(bd.x + bd.w / 2, bd.y + bd.h / 2, bd.w / 2, bd.h / 2, 0, 0, TAU);
      ink(ctx, this.flash > 0 ? '#fff' : '#8FA399', 3);
      ctx.beginPath();
      ctx.arc(bd.x + bd.w / 2, bd.y + (this.phase === 2 ? bd.h - 6 : 6), 16, 0, TAU);
      ink(ctx, 'rgba(199,210,201,0.8)', 2);
    }
    ctx.restore();
    if (this.state === 'dazed') {
      for (let i = 0; i < 3; i++) {
        const a = this.t * 4 + (i * TAU) / 3;
        ctx.beginPath();
        ctx.arc(this.cx + Math.cos(a) * 26, this.y + 6 + Math.sin(a) * 6, 4, 0, TAU);
        ink(ctx, C.yellow, 1.5);
      }
    }
  }
}

