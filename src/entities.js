// Players, bullets, enemies, pickups and effects.

import { t } from './i18n.js';
import { C, ink, ellipse, rrect, drawRat, drawGun, drawHeart, drawBadge, WEAPON_INFO } from './art.js';
import { sfx } from './audio.js';
import { SPR, frame, drawFrame, tintOf } from './sprites.js';
import { skillKeyLabel } from './input.js';
import { drawGoldCan, collectGold } from './secrets.js';

export const GRAVITY = 1500;
const RUN = 155;
const HERO_SCALE = 60 / 128; // generated hero frames are 128px tall when standing

export const CHARS = [
  { id: 'blaze', name: t('blaze.name'), sprite: 'cat01', gun: C.yellow, drawH: 54, size: 1, skill: t('blaze.skill') },
  { id: 'gulp', name: t('gulp.name'), sprite: 'cat02', gun: C.red, drawH: 60, size: 1.04, skill: t('gulp.skill') },
];

export const SKILL_COST = 50;
const BEAM_DMG = 8; // Blaze's third-eye beam, to every enemy along it
const SWALLOW_R = 110; // Gulp's belly mouth reach
// grip frames by aim angle in the hero's own facing space (0 = straight ahead, negative = up)
const GRIP_DIRS = [['gripfwd', 0], ['gripdiag', -Math.PI / 4], ['gripup', -Math.PI / 2], ['gripdown', Math.PI / 4]];
// guns are drawn big enough that the handle sticks out below the clenched paw (the paw is ~22px of a
// 128px frame); the starting blasters stay a little smaller than the pickup guns
const GUN_SCALE = 1.6;
const GRIP_OFF = 6; // frame px: the paw closes this far below the measured grip point, nearer the body

export const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function circleRect(cx, cy, r, b) {
  const nx = Math.max(b.x, Math.min(cx, b.x + b.w));
  const ny = Math.max(b.y, Math.min(cy, b.y + b.h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

// Gravity, solids and one-way platforms for anything with x, y, w, h, vx, vy.
export function moveBody(e, dt, level, gravity = true) {
  e.x += e.vx * dt;
  e.hitWall = false;
  for (const s of level.solids) {
    if (s.kind === 'ceil' || !overlap(e, s)) continue;
    if (e.vx > 0) e.x = s.x - e.w;
    else if (e.vx < 0) e.x = s.x + s.w;
    else continue;
    e.vx = 0;
    e.hitWall = true;
  }
  const prevBottom = e.y + e.h;
  if (gravity) e.vy = Math.min(e.vy + GRAVITY * dt, 900);
  e.y += e.vy * dt;
  e.onGround = false;
  for (const s of level.solids) {
    if (!overlap(e, s)) continue;
    // a ceiling only stops things going up: anything can drop in through it
    if (s.kind === 'ceil') { if (e.vy < 0) { e.y = s.y + s.h; e.vy = 0; } continue; }
    if (e.vy > 0) { e.y = s.y - e.h; e.vy = 0; e.onGround = true; e.groundRef = s; }
    else if (e.vy < 0) { e.y = s.y + s.h; e.vy = 0; }
  }
  if (e.vy >= 0 && !e.dropping) {
    for (const p of level.platforms()) {
      if (prevBottom <= p.y + 1 && e.y + e.h >= p.y && e.x + e.w > p.x && e.x < p.x + p.w) {
        e.y = p.y - e.h;
        e.vy = 0;
        e.onGround = true;
        e.groundRef = p;
      }
    }
  }
}

// ======================= PLAYER =======================

export class Player {
  // idx = player slot (P1/P2); charIdx = which cat (0 火斑, 1 大口)
  constructor(game, idx, ctl, charIdx = idx) {
    this.game = game;
    this.idx = idx;
    this.ctl = ctl;
    this.char = CHARS[charIdx];
    this.w = 26;
    this.h = 46;
    this.x = game.cam.x + 80 + idx * 40;
    this.y = game.cam.y - 60 - idx * 30; // drop in from the sky at the start
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.aim = { x: 1, y: 0 };
    this.maxHp = game.classic ? 1 : 3;
    this.hp = this.maxHp;
    this.lives = game.startLives;
    this.weapon = { type: 'N', lvl: 1 };
    this.rate = 1;
    this.cool = 0;
    this.inv = 2;
    this.dashT = 0;
    this.dashCd = 0;
    this.dashDir = 1;
    this.jumps = 0;
    this.spin = 0;
    this.crouch = false;
    this.state = 'alive';
    this.downT = 0;
    this.reviveP = 0;
    this.respawnT = 0;
    this.energy = 0;
    this.skillT = 0;
    this.swallowed = 0;
    this.spitPending = false;
    this.skillReady = false;
    this.locks = [];
    this.lockShot = 0;
    this.catnip = 0;
    this.anim = 0;
    this.dropT = 0;
    this.jumpBuf = 0;
    this.airT = 0;
    this.jumped = false;
    this.hurtT = 0;
    this.trail = [];
    this.input = null;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h * 0.45; }

  setSwim(on) {
    if (on === !!this.swimBox || this.crouch) return;
    this.swimBox = on;
    if (on) { this.y += 16; this.h = 30; } else { this.y -= 16; this.h = 46; }
  }

  setCrouch(on) {
    if (on === this.crouch) return;
    this.crouch = on;
    if (on) { this.y += 18; this.h = 28; } else { this.y -= 18; this.h = 46; }
  }

  update(dt) {
    const g = this.game;
    if (this.state === 'out') return;
    if (this.state === 'dead') {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.respawn();
      return;
    }
    if (this.state === 'down') {
      this.downT -= dt;
      this.vx = 0;
      moveBody(this, dt, g.level);
      if (this.y > g.cam.y + 440) this.loseLife();
      else if (this.downT <= 0) this.loseLife();
      return;
    }

    const c = this.ctl.poll(this, g.cam);
    this.input = c;
    this.anim += dt;
    this.inv = Math.max(0, this.inv - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.recoil = Math.max(0, (this.recoil || 0) - dt * 14);
    this.catnip = Math.max(0, this.catnip - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.dropT = Math.max(0, this.dropT - dt);
    this.cool -= dt;

    let mx = c.lock ? 0 : c.mx;
    // hypnotised: left and right are swapped for a moment
    this.confused = Math.max(0, (this.confused || 0) - dt);
    if (this.confused > 0) mx = -mx;
    const swallowing = this.char.id === 'gulp' && this.skillT > 0;
    // under water (stage 3's dives): swim strokes instead of jumps, slow sinking, an air supply
    const wasWater = this.inWater;
    this.inWater = !!(g.waterAt && g.waterAt(this.cx, this.y + this.h * 0.35));
    this.updateAir(dt, wasWater);
    const wantCrouch = c.down && this.onGround && Math.abs(c.mx) < 0.3 && this.dashT <= 0 && !swallowing && !this.inWater;
    this.setCrouch(wantCrouch);
    if (this.crouch) mx = 0;

    if (c.dash && this.dashCd <= 0 && !this.crouch) {
      this.dashT = 0.2;
      this.dashCd = 0.75;
      this.dashDir = mx ? Math.sign(mx) : this.facing;
      this.inv = Math.max(this.inv, 0.28);
      this.vy = Math.min(this.vy, 0) * 0.3;
      sfx.dash();
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashDir * 440;
      this.vy = 0;
      this.trail.push({ x: this.x, y: this.y, a: 0.45 });
    } else {
      const target = mx * RUN * (swallowing ? 0.5 : 1) * (this.inWater ? 0.75 : 1);
      this.vx += (target - this.vx) * Math.min(1, dt * 16);
    }
    for (const tr of this.trail) tr.a -= dt * 2.5;
    this.trail = this.trail.filter((tr) => tr.a > 0);

    // jump buffering: a press shortly before landing still jumps once we touch down
    this.jumpBuf = c.jump ? 0.12 : Math.max(0, this.jumpBuf - dt);
    if (this.inWater) {
      // each press is a swim stroke upward; any number of them
      if (c.jump) { this.vy = Math.min(this.vy * 0.3, 0) - 240; this.jumpBuf = 0; this.stroke = 0.35; sfx.stroke(); }
      this.jumps = 1;
      this.spin = 0;
    } else if (this.jumpBuf > 0) {
      const onPlatform = this.onGround && this.groundRef && this.groundRef.kind !== 'ground';
      // coyote time: still allowed to ground-jump for a moment after running off a ledge
      const canGroundJump = this.onGround || (this.airT < 0.1 && !this.jumped);
      if (c.jump && c.down && onPlatform) {
        this.dropT = 0.25;
        this.setCrouch(false);
        this.y += 2;
        this.jumpBuf = 0;
      } else if (canGroundJump) {
        this.setCrouch(false);
        this.vy = -545;
        this.jumps = 1;
        this.jumped = true;
        this.jumpBuf = 0;
        sfx.jump(false);
      } else if (c.jump && this.jumps < 2) {
        this.vy = -470;
        this.jumps = 2;
        this.jumped = true;
        this.spin = 0.001;
        this.jumpBuf = 0;
        sfx.jump(true);
      }
    }
    // variable jump height: releasing early cuts the rise, but only after a minimum hop
    this.jumpT = this.jumps === 1 ? (this.jumpT || 0) + dt : 0;
    if (!c.jumpHeld && this.jumps === 1 && this.jumpT > 0.1 && this.vy < -260) this.vy = -260;
    this.dropping = this.dropT > 0;

    const wasGround = this.onGround;
    const fallV = this.vy;
    if (this.inWater && this.dashT <= 0) {
      // buoyant: sink slowly (faster holding down), strokes slow down as they glide
      this.vy = Math.max(-300, Math.min(c.down ? 190 : 110, this.vy + (c.down ? 700 : 420) * dt));
      moveBody(this, dt, g.level, false);
    } else moveBody(this, dt, g.level, this.dashT <= 0);
    // swimming: a long, low body, so a flat hitbox
    this.setSwim(this.inWater);
    // a hard landing kicks up dust and thuds
    if (!wasGround && this.onGround && fallV > 430 && !this.inWater) this.landDust(fallV);
    // breaking the surface on a stroke pops the hero up out of the water, high enough to reach a ledge
    if (wasWater && !(g.waterAt && g.waterAt(this.cx, this.y + this.h * 0.35)) && this.vy < -60) this.vy = -540;
    this.stroke = Math.max(0, (this.stroke || 0) - dt);
    if (this.onGround) { this.jumps = 0; this.spin = 0; this.airT = 0; this.jumped = false; }
    else {
      this.airT += dt;
      if (this.jumps === 0) this.jumps = 1; // walked off a ledge: one air jump left
    }
    if (this.spin) this.spin = Math.min(1, this.spin + dt * 2.8);

    // stay inside the view
    const minX = g.cam.x + 2;
    const maxX = g.cam.x + g.W - this.w - 2;
    if (this.x < minX) this.x = minX;
    if (this.x > maxX) this.x = maxX;

    // aim
    let aim;
    this.autoTarget = null;
    if (c.aim) {
      aim = { ...c.aim };
      if (c.assist) aim = g.assistAim(this, aim, c.assist);
    } else if (c.autoAim) {
      if (mx) this.facing = Math.sign(mx);
      const t = (this.autoTarget = g.autoAimTarget(this));
      if (t) {
        const dx = t.cx - this.cx;
        const dy = t.cy - this.cy;
        const l = Math.hypot(dx, dy) || 1;
        aim = { x: dx / l, y: dy / l };
      } else {
        aim = { x: this.facing, y: 0 };
      }
    } else {
      aim = { x: this.facing, y: 0 };
    }
    this.aim = aim;
    if (c.aim && Math.abs(aim.x) > 0.15) this.facing = Math.sign(aim.x);
    else if (mx) this.facing = Math.sign(mx);
    else if (this.autoTarget && Math.abs(aim.x) > 0.15) this.facing = Math.sign(aim.x); // standing still: face the target

    // fire
    const firing = c.fire === 'auto' ? g.enemiesOnScreen() : c.fire;
    if (firing && this.cool <= 0 && !swallowing && this.dashT <= 0) this.fire();

    // skill
    this.skillT = Math.max(0, this.skillT - dt);
    if (c.skill && this.energy >= SKILL_COST && this.skillT <= 0) this.useSkill();
    if (this.char.id === 'gulp' && this.skillT === 0 && this.spitPending) this.spit();
    if (this.char.id === 'blaze') this.locks = this.locks.filter((e) => !e.dead);
    // tell the player the moment the skill becomes usable
    const ready = this.energy >= SKILL_COST;
    if (ready && !this.skillReady) {
      g.text(this.cx, this.y - 30 - this.idx * 14, t('skill.ready', { key: skillKeyLabel(this.ctl) }), C.red);
      g.effects.push(new ReadyRing(this));
      sfx.ready();
    }
    this.skillReady = ready;

    if (this.y > g.cam.y + 440) this.die(true);
  }

  fire() {
    const g = this.game;
    const a = Math.atan2(this.aim.y, this.aim.x);
    // shots leave the muzzle of the gun in the paws (or a point in front of the chest without grip art)
    const mz = this.muzzle();
    const ox = mz ? mz.x : this.cx + Math.cos(a) * 22;
    const oy = mz ? mz.y : this.cy + Math.sin(a) * 22;
    this.lastMuzzle = mz;
    const w = this.weapon;
    const shots = [];
    const mk = (ang, o) => ({ x: ox, y: oy, vx: Math.cos(ang) * o.speed, vy: Math.sin(ang) * o.speed, t: 0, owner: this, ...o });
    let cool = 0.16;
    switch (w.type) {
      case 'S': {
        const spread = w.lvl > 1 ? [-0.26, -0.13, 0, 0.13, 0.26] : [-0.18, 0, 0.18];
        for (const s of spread) shots.push(mk(a + s, { kind: 'S', speed: 470, r: 5, dmg: 1 }));
        cool = 0.24;
        break;
      }
      case 'M':
        shots.push(mk(a + (Math.random() - 0.5) * 0.06, { kind: 'M', speed: 660, r: 3.5, dmg: 1 }));
        cool = w.lvl > 1 ? 0.065 : 0.085;
        break;
      case 'L':
        shots.push(mk(a, { kind: 'L', speed: 980, r: 6, dmg: w.lvl > 1 ? 3 : 2, pierce: new Set() }));
        cool = 0.3;
        break;
      case 'F':
        shots.push(mk(a, { kind: 'F', speed: 380, r: 7, dmg: 2, bx: ox, by: oy, ang: a }));
        if (w.lvl > 1) shots.push(mk(a, { kind: 'F', speed: 380, r: 7, dmg: 2, bx: ox, by: oy, ang: a, phase: Math.PI }));
        cool = 0.22;
        break;
      default:
        shots.push(mk(a, { kind: 'N', speed: 540, r: 4, dmg: 1 }));
        cool = 0.15;
    }
    if (this.char.id === 'blaze' && this.locks.length) {
      for (const s of shots) {
        s.target = this.locks[this.lockShot++ % this.locks.length];
        s.homing = true;
      }
    }
    g.bullets.push(...shots);
    const big = w.type === 'L' || w.type === 'F' || w.type === 'S';
    g.effects.push(new FxAnim('muzzle', 'fire', ox, oy, big ? 0.12 : 0.08, big ? 0.36 : 0.28, { rot: a, anchor: 'left' }));
    this.recoil = 1;
    this.cool = cool * this.rate;
    sfx.shoot(w.type);
  }

  useSkill() {
    const g = this.game;
    this.energy -= SKILL_COST;
    if (this.char.id === 'blaze') {
      this.eyeBeam();
      // then the third eye marks up to 5 enemies on screen; shots home in on them
      this.locks = g.enemies
        .filter((e) => e.hittable() && !e.secret && e.x + e.w > g.cam.x && e.x < g.cam.x + g.W)
        .sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))
        .slice(0, 5);
      this.skillT = 5;
      sfx.lock();
      g.text(this.cx, this.y - 14, t('skill.beam'), C.red);
    } else {
      this.skillT = 1.6;
      this.swallowed = 0;
      this.spitPending = true;
      sfx.swallow();
      g.text(this.cx, this.y - 14, t('skill.gulp'), C.red);
    }
  }

  // Blaze: the third eye fires a beam right across the screen, hitting every enemy along it
  eyeBeam() {
    const g = this.game;
    const a = Math.atan2(this.aim.y, this.aim.x);
    const x0 = this.cx + this.facing * 6;
    const y0 = this.y + 8;
    const len = g.W * 1.3;
    const half = 14;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    for (const e of g.enemies) {
      if (!e.hittable()) continue;
      for (let d = 0; d <= len; d += 8) {
        if (circleHitRect({ x: x0 + dx * d, y: y0 + dy * d, r: half }, e)) {
          e.damage(BEAM_DMG, this);
          if (frame('skill', 'splash')) g.effects.push(new SkillPop('splash', e.cx, e.cy, 46, 0.3));
          else g.effects.push(new FxAnim('impact', 'hit', e.cx, e.cy, 0.2, 0.5, { rot: Math.random() * 6 }));
          break;
        }
      }
    }
    g.effects.push(new EyeBeam(x0, y0, a, len, half));
    g.shake(5);
    g.freeze(0.05);
    sfx.beam();
  }

  // Gulp: swallowed bullets come back out as a fan of heavy shots that pierce across the screen;
  // even an empty belly spits a small fan
  spit() {
    const g = this.game;
    const n = Math.min(20, 8 + this.swallowed * 2);
    const a = Math.atan2(this.aim.y, this.aim.x);
    for (let i = 0; i < n; i++) {
      const ang = a + (i - (n - 1) / 2) * 0.07;
      g.bullets.push({ x: this.cx, y: this.cy, vx: Math.cos(ang) * 620, vy: Math.sin(ang) * 620, t: 0, owner: this, kind: 'spit', r: 6, dmg: 2, pierce: new Set() });
    }
    sfx.spit();
    this.swallowed = 0;
    this.spitPending = false;
  }

  // returns true if the bullet was swallowed
  trySwallow(b) {
    if (this.char.id !== 'gulp' || this.skillT <= 0 || this.state !== 'alive') return false;
    if (Math.hypot(b.x - this.cx, b.y - this.cy) > SWALLOW_R) return false;
    this.swallowed++;
    sfx.hit();
    return true;
  }

  // air: runs down under water, refills in the air or in a bubble vent; out of air = hurt every 1.5 s
  updateAir(dt, wasWater) {
    if (this.air == null) this.air = 1;
    const g = this.game;
    const vent = g.inAirVent && g.inAirVent(this);
    if (!this.inWater || vent) {
      this.air = Math.min(1, this.air + dt * (vent ? 1.2 : 0.8));
      this.chokeT = 0;
      return;
    }
    this.air = Math.max(0, this.air - dt / 20);
    if (this.air <= 0) {
      this.chokeT = (this.chokeT || 0) - dt;
      if (this.chokeT <= 0) { this.chokeT = 1.5; this.inv = 0; this.hurt(); g.text(this.cx, this.y - 12, t('air.out'), C.red); }
    } else if (this.air < 0.3 && !this.airWarned) {
      this.airWarned = true;
      g.text(this.cx, this.y - 12, t('air.low'), C.red);
    }
    if (this.air > 0.5) this.airWarned = false;
  }

  landDust(v) {
    const g = this.game;
    sfx.land();
    const n = v > 650 ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1;
      g.effects.push(new Dust(this.cx + dir * (4 + Math.random() * 8), this.y + this.h - 2, dir * (50 + Math.random() * 90), -20 - Math.random() * 40));
    }
    if (v > 700) g.shake(2);
  }

  hurt() {
    if (this.state !== 'alive' || this.inv > 0 || this.catnip > 0 || this.dashT > 0) return;
    this.game.stageHits = (this.game.stageHits || 0) + 1;
    this.hp--;
    this.inv = 1.3;
    this.hurtT = 0.3;
    this.game.shake(6);
    this.game.freeze(0.06);
    sfx.hurt();
    if (this.hp <= 0) this.die(false);
  }

  die(pit) {
    if (this.state !== 'alive') return;
    this.setCrouch(false);
    const partner = this.game.players.find((p) => p !== this && p.state === 'alive');
    if (partner && !pit) {
      this.state = 'down';
      this.downT = 5;
      this.reviveP = 0;
      this.skillT = 0;
      this.spitPending = false;
      this.game.text(this.cx, this.y - 10, t('down.help'), C.red);
    } else {
      this.loseLife();
    }
  }

  revive() {
    this.state = 'alive';
    this.hp = this.game.classic ? 1 : 2;
    this.inv = 2;
    sfx.revive();
    this.game.text(this.cx, this.y - 16, t('revived'), C.green);
  }

  loseLife() {
    const g = this.game;
    g.effects.push(new KnockedOut(g, this.char.id, this.cx, Math.min(g.cam.y + 300, this.y + this.h), this.facing, HERO_SCALE * this.char.size));
    g.deaths = (g.deaths || 0) + 1;
    this.lives--;
    if (this.weapon.lvl > 1) this.weapon.lvl = 1;
    else this.weapon = { type: 'N', lvl: 1 };
    this.rate = 1;
    this.locks = [];
    this.skillT = 0;
    this.swallowed = 0;
    this.spitPending = false;
    if (this.lives > 0) {
      this.state = 'dead';
      this.respawnT = 1.2;
    } else {
      this.state = 'out';
    }
    this.y = -200;
    g.checkGameOver();
  }

  respawn() {
    const g = this.game;
    this.state = 'alive';
    this.hp = this.maxHp;
    const at = g.respawnPoint && g.respawnPoint(this);
    this.x = at ? at.x : g.cam.x + 90 + this.idx * 36;
    this.y = at ? at.y : g.cam.y - 50;
    this.vx = 0;
    this.vy = 0;
    this.inv = 2.5;
    this.air = 1;
    this.confused = 0;
    this.swimBox = false;
    this.h = 46;
    this.crouch = false;
  }

  pickup(item) {
    const g = this.game;
    if (item === 'G') return collectGold(g, this);
    sfx.pickup();
    if (item === 'R') {
      this.rate = Math.max(0.6, this.rate * 0.8);
    } else if (item === 'B') {
      this.catnip = 8;
    } else if (this.weapon.type === item) {
      this.weapon.lvl = 2;
    } else {
      this.weapon = { type: item, lvl: 1 };
    }
    const lvl = this.weapon.type === item && this.weapon.lvl > 1 ? ' Lv2' : '';
    g.text(this.cx, this.y - 16, WEAPON_INFO[item].name + lvl, C.ink);
  }

  // Which generated frame to show for the current state.
  pose() {
    const key = this.char.id;
    if (this.state === 'down') return { f: frame(key, 'down'), anchor: 'bottom' };
    const skillPose = this.char.id === 'gulp' ? this.skillT > 0 : this.skillT > 4.4;
    if (skillPose) return { f: frame(key, 'skill') };
    if (this.hurtT > 0) return { f: frame(key, 'hurt') };
    if (this.dashT > 0) return { f: frame(key, 'dash') };
    if (this.spin) return { f: frame(key, 'ball'), anchor: 'center' };
    const hold = this.holdPose();
    if (hold) return hold;
    const grip = this.gripPose();
    if (grip) return grip;
    if (!this.onGround) return { f: frame(key, 'jump') };
    if (this.crouch) return { f: frame(key, 'crouch') };
    if (Math.abs(this.vx) > 20) return { f: frame(key, 'run', this.anim * 13) };
    if (this.aim.y < -0.85) return { f: frame(key, 'aimup') || frame(key, 'idle') };
    if (this.aim.y < -0.35) return { f: frame(key, 'aimdiag') || frame(key, 'idle') };
    return { f: frame(key, 'idle'), breathe: true };
  }

  // aim angle in facing space, clamped to the front half (the hero turns to face what it aims at)
  localAim() {
    return Math.atan2(this.aim.y, Math.max(0, this.aim.x * this.facing));
  }

  // Which aiming pose the aim and state call for: fwd / diag / up / down, or jump / crouch / run (run cycles).
  aimSlot() {
    const la = this.localAim();
    let [slot] = GRIP_DIRS.reduce((best, d) => (Math.abs(d[1] - la) < Math.abs(best[1] - la) ? d : best));
    slot = slot.slice(4); // gripfwd -> fwd
    if (this.inWater) {
      // swimming poses (also when resting on the bottom: it hovers just above it): level (a 2-frame kick, faster on a stroke), or tilted up / down
      const swim = { fwd: 'swim', diag: 'swimup', up: 'swimup', down: 'swimdown' }[slot];
      return { slot: swim, i: this.anim * (this.stroke > 0 ? 9 : 4), breathe: false, fallback: slot === 'fwd' ? 'jump' : slot };
    }
    if (!this.onGround) return { slot: slot === 'fwd' ? 'jump' : slot, i: 0, breathe: false };
    if (this.crouch) return { slot: 'crouch', i: 0, breathe: false };
    if (Math.abs(this.vx) > 20) {
      // running: level, or the run-and-aim-diagonally cycles (straight up / down keep the standing pose)
      const run = { fwd: 'run', diag: 'runup', down: 'rundown' }[slot];
      if (run) return { slot: run, i: this.anim * 13, breathe: false, fallback: slot };
    }
    return { slot, i: 0, breathe: slot === 'fwd' };
  }

  // Frame drawn holding the current weapon (hold{type}{slot}, e.g. holdMdiag); null without the art.
  holdPose() {
    const { slot, i, breathe, fallback } = this.aimSlot();
    const key = this.char.id;
    const t = this.weapon.type;
    const f = frame(key, `hold${t}${slot}`, i) || (fallback && frame(key, `hold${t}${fallback}`));
    return f && f.mx != null ? { f, hold: true, breathe } : null;
  }

  // Empty-pawed grip frame for the current aim and state, holding the current weapon; null without the art.
  gripPose() {
    const { slot, i, breathe, fallback } = this.aimSlot();
    const f = frame(this.char.id, `grip${slot}`, i) || (fallback && frame(this.char.id, `grip${fallback}`));
    return f && f.gx != null ? { f, gun: true, breathe } : null;
  }

  gunFrame() {
    const t = this.weapon.type;
    return frame('gun', t === 'N' ? this.char.id : t) || frame('gun', this.char.id);
  }

  // where the paws of a grip frame are in the world
  pawPoint(f, scale, bottom) {
    return {
      x: this.cx + this.facing * (f.gx - f.ax) * f.w * scale,
      y: bottom - (1 - f.gy) * f.h * scale,
    };
  }

  heldGun() {
    const pose = this.pose();
    const gun = this.gunFrame();
    if (!pose.gun || !gun || gun.hx == null) return null;
    const scale = HERO_SCALE * this.char.size;
    const bob = pose.breathe ? Math.sin(this.game.t * 3) * 0.6 : 0;
    const paw = this.pawPoint(pose.f, scale, this.y + this.h + 1 + bob);
    return { gun, paw, gs: scale * GUN_SCALE, off: GRIP_OFF * scale, la: this.localAim() };
  }

  // muzzle tip of the gun in the paws, in world space
  muzzle() {
    const pose = this.pose();
    if (pose.hold) {
      const f = pose.f;
      const s = HERO_SCALE * this.char.size * (f.k || 1);
      const bottom = this.y + this.h + 1 + (pose.breathe ? Math.sin(this.game.t * 3) * 0.6 : 0);
      return { x: this.cx + this.facing * (f.mx - f.ax) * f.w * s, y: bottom - (1 - f.my) * f.h * s };
    }
    const h = this.heldGun();
    if (!h) return null;
    const { gun, paw, gs, off, la } = h;
    const mx = (gun.mx - gun.hx) * gun.w * gs;
    const my = (gun.my - gun.hy) * gun.h * gs + off;
    return {
      x: paw.x + this.facing * (mx * Math.cos(la) - my * Math.sin(la)),
      y: paw.y + mx * Math.sin(la) + my * Math.cos(la),
    };
  }

  confuse(s) {
    if (this.state !== 'alive' || this.catnip > 0) return;
    if (!(this.confused > 0)) this.game.text(this.cx, this.y - 14, t('hypno.hit'), C.red);
    this.confused = Math.max(this.confused || 0, s);
    sfx.hiss();
  }

  // hypnotised: red spirals circling the head, and the controls are swapped
  drawDizzy(ctx) {
    const g = this.game;
    for (let i = 0; i < 2; i++) {
      const a = g.t * 5 + i * Math.PI;
      const x = this.cx + Math.cos(a) * 14;
      const y = this.y - 6 + Math.sin(a) * 4;
      ctx.beginPath();
      for (let k = 0; k < 14; k++) {
        const r = k * 0.45;
        ctx.lineTo(x + Math.cos(k * 0.9 + g.t * 8) * r, y + Math.sin(k * 0.9 + g.t * 8) * r);
      }
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = C.red;
      ctx.stroke();
    }
  }

  // under water: a glass helmet when the swim art isn't there, and the air meter over the head
  drawDiveGear(ctx, pose) {
    const g = this.game;
    const swimArt = pose.f && pose.f.file && pose.f.file.includes('swim');
    if (this.inWater && !swimArt) {
      ctx.beginPath();
      ctx.arc(this.cx + this.facing * 3, this.y + 9, 14, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(214,232,226,0.35)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
    }
    if (this.air >= 1) return;
    const w = 30;
    const x = this.cx - w / 2;
    const y = this.y - 12;
    rrect(ctx, x, y, w, 5, 2.5);
    ctx.fillStyle = C.cream;
    ctx.fill();
    rrect(ctx, x, y, w * this.air, 5, 2.5);
    ctx.fillStyle = this.air < 0.3 ? (Math.floor(g.t * 8) % 2 ? C.red : C.yellow) : '#6FB3A0';
    ctx.fill();
    rrect(ctx, x, y, w, 5, 2.5);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  }

  // Redraw just the clenched paws over the gun handle: the same frame, clipped to a disc round the paw point
  // (the point is the front of the fist, so the disc sits a little back along the aim to cover the whole fist)
  drawPawsOver(ctx, pose, scale, bottom) {
    const f = pose.f;
    const paw = this.pawPoint(f, scale, bottom);
    const la = this.localAim();
    const back = 4 * scale; // frame px -> logical px
    const r = 13 * scale; // the fist is ~22px across in a 128px frame
    const cx = paw.x - this.facing * Math.cos(la) * back;
    const cy = paw.y - Math.sin(la) * back;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    drawFrame(ctx, f, this.cx, bottom, scale, { flip: this.facing });
    ctx.restore();
  }

  // the current weapon with its handle in the paws, drawn over the arm (the paws are redrawn on top)
  drawHeldGun(ctx) {
    const h = this.heldGun();
    if (!h) return;
    const { gun, paw, gs, off, la } = h;
    ctx.save();
    ctx.translate(paw.x, paw.y);
    ctx.scale(this.facing, 1);
    ctx.rotate(la);
    ctx.translate(-(this.recoil || 0) * 3, 0); // kick back on each shot
    ctx.drawImage(gun.img, -gun.hx * gun.w * gs, -gun.hy * gun.h * gs + off, gun.w * gs, gun.h * gs);
    ctx.restore();
  }

  draw(ctx) {
    const g = this.game;
    if (this.state === 'out' || this.state === 'dead') return;
    const pose = this.pose();
    if (!pose.f) return this.drawLegacy(ctx);
    const scale = HERO_SCALE * this.char.size * (pose.f.k || 1); // held-gun frames are 2x resolution

    for (const tr of this.trail) {
      ctx.globalAlpha = tr.a * 0.5;
      drawFrame(ctx, pose.f, tr.x + this.w / 2, tr.y + this.h, scale, { flip: this.facing });
    }
    ctx.globalAlpha = 1;

    if (this.catnip > 0) {
      ctx.save();
      ctx.translate(this.cx, this.cy);
      ctx.rotate(g.t * 2);
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = this.catnip < 2 && Math.floor(g.t * 8) % 2 ? 'transparent' : '#8DC26A';
      ctx.stroke();
      ctx.restore();
    }

    if (this.state === 'down') {
      drawFrame(ctx, pose.f, this.cx, this.y + this.h + 2, scale, { flip: this.facing });
      this.drawDownUI(ctx);
      return;
    }

    // behind the hero: the generated whirlpool
    const vf = frame('skill', 'vortex', g.t * 14);
    if (this.char.id === 'gulp' && this.skillT > 0 && vf) {
      const grow = Math.min(1, (1.6 - this.skillT) / 0.15);
      const d = SWALLOW_R * 1.5 * (0.6 + 0.4 * grow);
      ctx.save();
      ctx.globalAlpha = 0.55 * Math.min(1, this.skillT / 0.2);
      ctx.translate(this.cx, this.cy + 6);
      ctx.rotate(g.t * 4);
      ctx.drawImage(vf.img, -d / 2, (-d / 2) * (vf.h / vf.w), d, d * (vf.h / vf.w));
      ctx.restore();
    }

    ctx.save();
    if (this.inv > 0 && this.catnip <= 0 && Math.floor(g.t * 18) % 2) ctx.globalAlpha = 0.45;
    // with grip art the gun is held in the paws (and put away for rolls, hurt, dash, skills);
    // otherwise the old floating gun arm
    const hasGrip = !!frame(this.char.id, 'gripfwd');
    const gun = frame('gun', this.char.id);
    const showGun = !hasGrip && !this.spin && !(this.char.id === 'gulp' && this.skillT > 0);
    const ang = Math.atan2(this.aim.y, this.aim.x);
    // the gun sits behind the body when aiming backwards over the shoulder
    const gunBehind = Math.sign(Math.cos(ang)) !== this.facing;
    if (showGun && gunBehind) this.drawGunArm(ctx, gun, ang);
    if (pose.anchor === 'center') {
      drawFrame(ctx, pose.f, this.cx, this.y + this.h - 22, scale, { flip: this.facing, anchor: 'center', rot: this.spin * Math.PI * 2 * this.facing });
    } else {
      const bob = pose.breathe ? Math.sin(g.t * 3) * 0.6 : 0;
      drawFrame(ctx, pose.f, this.cx, this.y + this.h + 1 + bob, scale, { flip: this.facing });
      // held gun in front of the arm, then the paws again on top so they close round its handle
      if (hasGrip && pose.gun) {
        this.drawHeldGun(ctx);
        this.drawPawsOver(ctx, pose, scale, this.y + this.h + 1 + bob);
      }
    }
    if (showGun && !gunBehind) this.drawGunArm(ctx, gun, ang);
    ctx.restore();
    if (this.inWater || this.air < 1) this.drawDiveGear(ctx, pose);
    if (this.confused > 0) this.drawDizzy(ctx);

    if (this.char.id === 'gulp' && this.skillT > 0) {
      if (!frame('skill', 'vortex')) {
        ctx.beginPath();
        ctx.arc(this.cx, this.cy + 6, SWALLOW_R, 0, Math.PI * 2);
        ctx.setLineDash([4, 8]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(232,86,75,0.6)';
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // air being sucked into the belly mouth
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + g.t * 3;
        const r = SWALLOW_R - 8 - ((g.t * 160 + i * 28) % 90);
        ctx.beginPath();
        ctx.arc(this.cx + Math.cos(a) * r, this.cy + 6 + Math.sin(a) * r, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(232,86,75,0.7)';
        ctx.fill();
      }
    }

    if (this.char.id === 'blaze' && this.skillT > 0) {
      for (const e of this.locks) {
        if (e.dead) continue;
        ctx.beginPath();
        ctx.moveTo(this.cx + this.facing * 4, this.y + 2);
        ctx.lineTo(e.x + e.w / 2, e.y + e.h / 2);
        ctx.setLineDash([3, 6]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(242,179,61,0.85)';
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.font = '900 10px Bungee, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.idx === 0 ? C.red : C.greenDk;
    const labelY = this.y - (this.crouch ? 36 : 20);
    ctx.fillText(`P${this.idx + 1}`, this.cx, labelY);
    if (this.skillReady && this.skillT <= 0) drawReadyStar(ctx, this.cx + 16, labelY - 4, g.t);
  }

  drawGunArm(ctx, gun, ang) {
    const x = this.cx + this.facing * 2;
    const y = this.cy + (this.crouch ? 6 : 4);
    if (!gun) {
      drawGun(ctx, x, y, ang, 22, this.char.gun);
      return;
    }
    const s = 22 / gun.w;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.translate(-(this.recoil || 0) * 4, 0); // kick back on each shot
    if (Math.cos(ang) < 0) ctx.scale(1, -1); // keep the gun upright when aiming left
    ctx.drawImage(gun.img, -4, (-gun.h * s) / 2, gun.w * s, gun.h * s);
    ctx.restore();
  }

  // Single reference image with procedural squash and stretch (used if generated sprites are missing).
  drawLegacy(ctx) {
    const g = this.game;
    const img = g.img[this.char.sprite];
    const dh = this.char.drawH;
    const dw = (img.width * dh) / img.height;
    ctx.save();
    if (this.state === 'down') {
      ctx.translate(this.cx, this.y + this.h - 8);
      ctx.rotate(-Math.PI / 2 * this.facing);
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
      this.drawDownUI(ctx);
      return;
    }
    if (this.inv > 0 && this.catnip <= 0 && Math.floor(g.t * 18) % 2) ctx.globalAlpha = 0.45;
    ctx.translate(this.cx, this.y + this.h);
    if (this.spin) {
      ctx.translate(0, -dh / 2);
      ctx.rotate(this.spin * Math.PI * 2 * this.facing);
      ctx.translate(0, dh / 2);
    }
    ctx.scale(this.facing * (this.crouch ? 1.15 : 1), this.crouch ? 0.6 : 1);
    ctx.drawImage(img, -dw / 2, -dh, dw, dh);
    ctx.restore();
    drawGun(ctx, this.cx, this.cy + 2, Math.atan2(this.aim.y, this.aim.x), 22, this.char.gun);
  }

  drawDownUI(ctx) {
    const g = this.game;
    const x = this.cx;
    const y = this.y - 10;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239,234,223,0.85)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + (this.downT / 5) * Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.red;
    ctx.stroke();
    if (this.reviveP > 0) {
      ctx.beginPath();
      ctx.arc(x, y, 9, -Math.PI / 2, -Math.PI / 2 + this.reviveP * Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = C.green;
      ctx.stroke();
    }
    drawHeart(ctx, x, y + 1, 10, Math.floor(g.t * 4) % 2 ? C.red : C.pink);
  }
}

// ======================= BULLETS =======================

export function updateBullet(b, dt) {
  b.t += dt;
  if (b.homing && b.target && !b.target.dead) {
    const want = Math.atan2(b.target.y + b.target.h / 2 - b.y, b.target.x + b.target.w / 2 - b.x);
    const cur = Math.atan2(b.vy, b.vx);
    let d = want - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const turn = Math.max(-9 * dt, Math.min(9 * dt, d));
    const sp = Math.hypot(b.vx, b.vy);
    b.vx = Math.cos(cur + turn) * sp;
    b.vy = Math.sin(cur + turn) * sp;
  }
  if (b.kind === 'F') {
    b.bx += b.vx * dt;
    b.by += b.vy * dt;
    const off = Math.sin(b.t * 18 + (b.phase || 0)) * 14;
    b.x = b.bx - Math.sin(b.ang) * off;
    b.y = b.by + Math.cos(b.ang) * off;
  } else {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  if (b.gravity) b.vy += b.gravity * dt;
  if (b.drag) { const k = Math.max(0, 1 - b.drag * dt); b.vx *= k; b.vy *= k; }
  if (b.update) b.update(b, dt);
}

// logical size of each projectile sprite (height, or length for the laser) and where its head sits
const BULLET_SIZE = { N: 13, S: 14, M: 10, L: 48, F: 21, spit: 15, enemy: 16 };
const BULLET_HEAD = { N: 0.7, S: 0.7, M: 0.72, L: 0.88, F: 0.68, spit: 0.78, enemy: 0.55 };
const BULLET_GLOW = { L: 'rgba(255,80,70,0.35)', F: 'rgba(255,170,40,0.35)', enemy: 'rgba(232,60,60,0.3)', S: 'rgba(232,86,75,0.18)' };

// Enemy shots are dark and spiky: nothing like the heroes' bright warm hairballs and beams,
// so they can be told apart at a glance in a busy fight.
function drawEnemyShot(ctx, b) {
  const bomb = b.r >= 6;
  const f = frame('eshot', bomb ? 'bomb' : 'pellet', b.t * 10);
  const size = bomb ? 28 : 19; // the bomb frame includes its fuse
  if (f) {
    // the bomb's round body sits in the lower part of its frame (fuse on top): centre the body on the shot
    drawFrame(ctx, f, b.x, b.y - (bomb ? size * 0.16 : 0), size / f.h, { anchor: 'center', rot: bomb ? Math.sin(b.t * 6) * 0.25 : b.t * 8 });
    return;
  }
  // without the art: black spiked ball with a red eye
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.t * 8);
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? b.r + 1 : b.r + 4;
    const a = (i / 16) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ink(ctx, C.ink, 1.5);
  ctx.beginPath();
  ctx.arc(0, 0, b.r * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = '#FF3B30';
  ctx.fill();
  ctx.restore();
}

export function drawBullet(ctx, b) {
  if (b.draw) return b.draw(ctx, b); // stage-specific shots bring their own look
  const kind = b.kind;
  if (kind === 'enemy') return drawEnemyShot(ctx, b);
  const f = frame('bullet', kind);
  if (!f) return drawBulletLegacy(ctx, b);
  const ang = Math.atan2(b.vy, b.vx);
  const size = BULLET_SIZE[kind] || 12;
  let scale = kind === 'L' ? size / f.w : size / f.h;
  if (kind === 'enemy') scale *= 1 + Math.sin(b.t * 25) * 0.08;
  if (b.kind === 'spit') scale *= 1.1;
  const glow = BULLET_GLOW[kind];
  if (glow) {
    const r = kind === 'L' ? 16 : size * 0.9;
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    g.addColorStop(0, glow);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  drawFrame(ctx, f, b.x, b.y, scale, { anchor: 'center', rot: ang, ax: BULLET_HEAD[kind] ?? 0.5 });
}

function drawBulletLegacy(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  switch (b.kind) {
    case 'L': {
      ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(4, 0);
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(232,72,77,0.35)'; ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = '#E5484D'; ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.stroke();
      break;
    }
    case 'M':
      ctx.rotate(b.t * 12);
      ctx.fillStyle = '#CFC8B8';
      ctx.fillRect(-3, -3, 6, 6);
      ctx.lineWidth = 1.5; ctx.strokeStyle = C.ink; ctx.strokeRect(-3, -3, 6, 6);
      break;
    case 'F':
      ctx.beginPath(); ctx.arc(0, 0, b.r + 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(242,179,61,0.4)'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, b.r - 1, 0, Math.PI * 2);
      ink(ctx, C.yellow, 2);
      ctx.beginPath(); ctx.arc(-1, -1, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = C.red; ctx.fill();
      break;
    case 'enemy':
      ctx.beginPath(); ctx.arc(0, 0, b.r + 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(232,86,75,0.35)'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      ink(ctx, C.red, 1.8);
      break;
    case 'spit':
      ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      ink(ctx, C.pink, 2);
      break;
    default:
      // hairball
      ctx.rotate(b.t * 9);
      ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      ink(ctx, b.kind === 'S' ? C.red : C.yellow, 1.8);
      ctx.beginPath(); ctx.moveTo(-b.r, 0); ctx.lineTo(b.r * 0.4, -b.r * 0.4);
      ctx.lineWidth = 1; ctx.strokeStyle = C.ink; ctx.stroke();
  }
  ctx.restore();
}

export function enemyShot(game, x, y, ang, speed = 210, r = 4.5) {
  game.ebullets.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, t: 0, kind: 'enemy', r });
  sfx.enemyShot();
}

// ======================= ENEMIES =======================

export class Enemy {
  constructor(game, x, y, w, h, hp) {
    Object.assign(this, { game, x, y, w, h, hp, maxHp: hp, vx: 0, vy: 0, t: 0, flash: 0, dead: false, facing: -1 });
  }
  hittable() { return !this.dead; }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  damage(n, by) {
    this.hp -= n;
    this.flash = 0.05;
    sfx.hit();
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.game.onKill(this, by);
    }
  }
  // the white hit flash flickers, so a big enemy under constant fire still shows its colours
  flashOn() { return this.flash > 0 && Math.floor(this.t * 24) % 2 === 0; }
  base(dt) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
  }
  touches(p) { return !this.dead && overlap(this, p); }
  // generated frame; returns false when the sprite is not available so callers can fall back
  drawGen(ctx, key, anim, i, scale, o = {}) {
    const f = frame(key, anim, i);
    if (!f) return false;
    drawFrame(ctx, f, this.cx, this.y + this.h + (o.dy || 0), scale, { ...o, flash: this.flashOn() });
    return true;
  }
  // small glint at the muzzle tip shortly before this enemy fires: grows and flickers, ink outlined
  warn(ctx, x, y) {
    if (this.cool > 0.35 || !this.game.onScreen(this)) return;
    const k = 1 - this.cool / 0.35;
    if (k < 0.8 && Math.floor(this.t * 20) % 2) return;
    const r = 2.5 + k * 3.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.t * 6);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 ? r * 0.38 : r;
      const a = (i / 8) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ink(ctx, k > 0.8 ? C.cream : C.yellow, 1.4);
    ctx.restore();
  }
  drawSprite(ctx, name, h, opts = {}) {
    const img = this.game.img[name];
    const w = (img.width * h) / img.height;
    ctx.save();
    ctx.translate(this.cx, this.y + this.h);
    if (opts.bob) ctx.translate(0, -opts.bob);
    if (opts.rot) ctx.rotate(opts.rot);
    ctx.scale(opts.flip ?? 1, 1);
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
    if (this.flash > 0) {
      // white hit flash drawn as a quick overlay ring
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, Math.max(this.w, this.h) * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();
    }
  }
}

// 05: brainwashed screaming cat, runs at you and drops into pits
export class Runner extends Enemy {
  constructor(game, x, y, dir) {
    super(game, x, y, 26, 44, 1);
    this.dir = dir;
    this.facing = dir;
    this.cat = 'cat05';
    this.score = 100;
    this.pouncer = Math.random() < 0.35; // some leap at the hero instead of just running past
  }
  update(dt) {
    this.base(dt);
    this.vx = this.dir * 150;
    const p = this.game.nearestPlayer(this);
    if (this.pouncer && this.onGround && p && !this.pounced && Math.sign(p.cx - this.cx) === this.dir && Math.abs(p.cx - this.cx) < 120) {
      this.pounced = true;
      this.vy = -420;
    }
    if (this.pounced && !this.onGround) this.vx = this.dir * 230;
    moveBody(this, dt, this.game.level);
    if (this.onGround && (this.hitWall || Math.random() < 0.006)) this.vy = -480;
    if (this.y > this.game.cam.y + 440 || this.x < this.game.cam.x - 120 || this.x > this.game.cam.x + this.game.W + 160) this.dead = true;
  }
  draw(ctx) {
    // generated runner frames face left
    if (this.drawGen(ctx, 'runner', 'run', this.t * 12, 54 / 112, { flip: this.dir < 0 ? 1 : -1, dy: 1 })) return;
    this.drawSprite(ctx, 'cat05', 52, { flip: -this.dir, bob: this.onGround ? Math.abs(Math.sin(this.t * 15)) * 4 : 0, rot: Math.sin(this.t * 15) * 0.08 });
  }
}

// Red Mouse rifle soldier
// rifle tip on the generated rat frame (x from centre towards facing, y from the top of the hitbox)
const RAT_MUZZLE = { x: 36, y: 19 };
export class Rat extends Enemy {
  constructor(game, x, groundY) {
    super(game, x, groundY - 40, 24, 40, 2);
    this.cool = 1 + Math.random();
    this.score = 200;
    this.villain = true;
  }
  update(dt) {
    this.base(dt);
    this.fireT = Math.max(0, (this.fireT || 0) - dt);
    this.vx = 0;
    moveBody(this, dt, this.game.level);
    if (this.y > this.game.cam.y + 440) { this.dead = true; return; }
    const p = this.game.nearestPlayer(this);
    if (!p) return;
    this.facing = p.cx < this.cx ? -1 : 1;
    this.cool -= dt;
    if (this.cool <= 0 && this.game.onScreen(this)) {
      this.cool = 1.7 + Math.random() * 0.8;
      const a = Math.atan2(p.cy - (this.y + 18), p.cx - this.cx);
      const q = Math.round(a / (Math.PI / 4)) * (Math.PI / 4); // 8 directions like the original
      // level shots leave the rifle's muzzle; angled ones from the chest
      if (Math.abs(Math.sin(q)) < 0.1) enemyShot(this.game, this.cx + this.facing * RAT_MUZZLE.x, this.y + RAT_MUZZLE.y, q);
      else enemyShot(this.game, this.cx + Math.cos(q) * 16, this.y + 18 + Math.sin(q) * 16, q);
      this.aimA = q;
      this.fireT = 0.18;
    }
  }
  draw(ctx) {
    if (this.drawGen(ctx, 'rat', this.fireT > 0 ? 'fire' : 'idle', 0, 46 / 92, { flip: -this.facing, dy: 1 })) {
      this.warn(ctx, this.cx + this.facing * RAT_MUZZLE.x, this.y + RAT_MUZZLE.y);
      return;
    }
    const p = this.game.nearestPlayer(this);
    const a = this.aimA ?? (p ? Math.atan2(p.cy - this.y - 18, p.cx - this.cx) : Math.PI);
    drawRat(ctx, this.cx, this.y + this.h, this.facing, this.t, { flash: this.flash > 0 });
    drawGun(ctx, this.cx + this.facing * 4, this.y + 20, a, 18, C.ratDk);
  }
}

// ---- more Red Mouse soldier types: each looks and behaves differently, so the player has to read the field ----
// muzzle / hand points on the generated frames (x from centre towards facing, y from the top of the hitbox)
// (measured on the generated frames the same way as RAT_MUZZLE)
export const RAT_POINTS = { gunner: { x: 39, y: 21 }, grenadier: { x: 22, y: 9 }, sniper: { x: 48, y: 14 } };

export class RatSoldier extends Enemy {
  constructor(game, x, groundY, w, h, hp, score) {
    super(game, x, groundY - h, w, h, hp);
    this.score = score;
    this.villain = true;
    this.fireT = 0;
  }
  // stand on the ground, face the nearest hero; returns that hero (or null)
  stand(dt) {
    this.base(dt);
    this.fireT = Math.max(0, this.fireT - dt);
    moveBody(this, dt, this.game.level);
    if (this.y > this.game.cam.y + 440) { this.dead = true; return null; }
    const p = this.game.nearestPlayer(this);
    if (p) this.facing = p.cx < this.cx ? -1 : 1;
    return p;
  }
  point(key) {
    const m = RAT_POINTS[key];
    return { x: this.cx + this.facing * m.x, y: this.y + m.y };
  }
}

// Heavy gunner (yellow helmet): long wind-up, then a three-round burst that sweeps across the hero
export class Gunner extends RatSoldier {
  constructor(game, x, groundY) {
    super(game, x, groundY, 28, 42, 4, 400);
    this.cool = 1.4 + Math.random();
    this.burst = 0;
    this.vx = 0;
  }
  update(dt) {
    this.vx = 0;
    const p = this.stand(dt);
    if (!p || !this.game.onScreen(this)) return;
    if (this.burst > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.burstT = 0.13;
        const m = this.point('gunner');
        const a = Math.atan2(p.cy - m.y, p.cx - m.x) + (2 - this.burst) * 0.12 * this.facing * -1;
        enemyShot(this.game, m.x, m.y, a, 250);
        this.fireT = 0.1;
        this.burst--;
      }
      return;
    }
    this.cool -= dt;
    if (this.cool <= 0) {
      this.cool = 2.8 + Math.random() * 0.6;
      this.burst = 3;
      this.burstT = 0;
    }
  }
  draw(ctx) {
    const firing = this.burst > 0 || this.fireT > 0;
    if (this.drawGen(ctx, 'gunner', firing ? 'fire' : 'idle', 0, 50 / 96, { flip: -this.facing, dy: 1 })) {
      const m = this.point('gunner');
      this.warn(ctx, m.x, m.y);
      return;
    }
    drawRat(ctx, this.cx, this.y + this.h, this.facing, this.t, { flash: this.flash > 0 });
  }
}

// Grenadier (bomb strap): keeps its distance and lobs bombs that land where the hero is standing
export class Grenadier extends RatSoldier {
  constructor(game, x, groundY) {
    super(game, x, groundY, 24, 40, 3, 300);
    this.cool = 1.2 + Math.random();
    this.home = x;
  }
  update(dt) {
    // backs away a little when a hero gets close, but never far from its post
    const p0 = this.game.nearestPlayer(this);
    this.vx = 0;
    if (p0 && Math.abs(p0.cx - this.cx) < 120 && Math.abs(this.x - this.home) < 70) this.vx = (p0.cx < this.cx ? 1 : -1) * 55;
    const p = this.stand(dt);
    if (!p || !this.game.onScreen(this)) return;
    this.cool -= dt;
    if (this.cool <= 0) {
      this.cool = 2.3 + Math.random() * 0.7;
      const h = this.point('grenadier');
      const T = 0.95; // flight time
      const g = 520;
      const tx = p.cx + p.vx * 0.4; // lead a running hero a little
      const ty = p.y + p.h - 4;
      this.game.ebullets.push({ x: h.x, y: h.y, vx: (tx - h.x) / T, vy: (ty - h.y - 0.5 * g * T * T) / T, gravity: g,
        t: 0, kind: 'enemy', r: 6, bomb: true });
      sfx.enemyShot();
      this.fireT = 0.3;
    }
  }
  draw(ctx) {
    if (this.drawGen(ctx, 'grenadier', this.fireT > 0 ? 'throw' : 'idle', 0, 46 / 92, { flip: -this.facing, dy: 1 })) return;
    drawRat(ctx, this.cx, this.y + this.h, this.facing, this.t, { flash: this.flash > 0 });
  }
}

// Charger (goggles and fork): sprints at the hero, hops gaps and walls, and pounces when close
export class Charger extends RatSoldier {
  constructor(game, x, groundY, dir = -1) {
    super(game, x, groundY, 24, 38, 2, 250);
    this.facing = dir;
    this.state = 'run';
    this.stateT = 0;
  }
  update(dt) {
    this.base(dt);
    const g = this.game;
    const p = g.nearestPlayer(this);
    this.stateT += dt;
    if (this.state === 'run') {
      if (p && this.onGround && this.t > 0.6) this.facing = p.cx < this.cx ? -1 : 1;
      this.vx = this.facing * 175;
      const ahead = this.cx + this.facing * 30;
      const below = g.groundTopAt(ahead, this.y + this.h - 6);
      const gap = this.onGround && (below == null || below > this.y + this.h + 4) && !g.level.platforms().some((q) => ahead > q.x && ahead < q.x + q.w && Math.abs(q.y - (this.y + this.h)) < 4);
      if (this.onGround && (this.hitWall || gap)) this.vy = -470;
      if (p && this.onGround && Math.abs(p.cx - this.cx) < 95 && Math.abs(p.cy - this.cy) < 60) {
        this.state = 'crouch';
        this.stateT = 0;
        this.vx = 0;
      }
    } else if (this.state === 'crouch') {
      this.vx = 0;
      if (this.stateT > 0.28) { // telegraphed: a short crouch before the leap
        this.state = 'leap';
        this.stateT = 0;
        this.vx = this.facing * 300;
        this.vy = -360;
      }
    } else if (this.state === 'leap' && this.onGround && this.stateT > 0.1) {
      this.state = 'run';
      this.stateT = 0;
    }
    moveBody(this, dt, g.level);
    if (this.y > g.cam.y + 440 || this.x < g.cam.x - 160 || this.x > g.cam.x + g.W + 200) this.dead = true;
  }
  draw(ctx) {
    const anim = this.state === 'leap' || !this.onGround ? 'leap' : this.state === 'crouch' ? 'crouch' : 'run';
    if (this.drawGen(ctx, 'charger', anim, this.t * 12, 40 / 80, { flip: -this.facing, dy: 1 })) return;
    drawRat(ctx, this.cx, this.y + this.h, this.facing, this.t, { flash: this.flash > 0 });
  }
}

// Sniper (beret, long rifle): a red laser sight tracks the hero, holds still for a moment, then one fast shot
export class Sniper extends RatSoldier {
  constructor(game, x, groundY) {
    super(game, x, groundY, 26, 32, 2, 400);
    this.phase = 'wait';
    this.phaseT = -0.6 - Math.random();
    this.aim = null;
  }
  update(dt) {
    this.vx = 0;
    const p = this.stand(dt);
    if (!p || !this.game.onScreen(this)) { this.phase = 'wait'; this.phaseT = 0; return; }
    this.phaseT += dt;
    const m = this.point('sniper');
    if (this.phase === 'wait' && this.phaseT > 1.2) {
      this.phase = 'aim';
      this.phaseT = 0;
    }
    if (this.phase === 'aim') {
      // tracks for 0.75 s, then locks for 0.35 s so the hero has a fair chance to step out of the line
      if (this.phaseT < 0.75) this.aim = Math.atan2(p.cy - m.y, p.cx - m.x);
      if (this.phaseT > 1.1) {
        enemyShot(this.game, m.x, m.y, this.aim, 440, 4);
        this.fireT = 0.2;
        this.phase = 'wait';
        this.phaseT = 0;
      }
    }
  }
  draw(ctx) {
    const m = this.point('sniper');
    if (this.phase === 'aim' && this.aim != null && this.game.onScreen(this)) {
      const locked = this.phaseT >= 0.75;
      if (!locked || Math.floor(this.phaseT * 16) % 2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x + Math.cos(this.aim) * 700, m.y + Math.sin(this.aim) * 700);
        ctx.lineWidth = locked ? 2.2 : 1.2;
        ctx.strokeStyle = locked ? 'rgba(255,40,30,0.95)' : 'rgba(232,60,50,0.55)';
        ctx.setLineDash(locked ? [] : [6, 5]);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (this.drawGen(ctx, 'sniper', this.fireT > 0 ? 'fire' : 'aim', 0, 37 / 74, { flip: -this.facing, dy: 1 })) return;
    drawRat(ctx, this.cx, this.y + this.h, this.facing, this.t, { flash: this.flash > 0 });
  }
}

// Red Mouse can turret
export class Turret extends Enemy {
  constructor(game, x, groundY) {
    super(game, x, groundY - 40, 32, 40, 6);
    this.cool = 1.5;
    this.ang = Math.PI;
    this.score = 500;
    this.villain = true;
  }
  update(dt) {
    this.base(dt);
    const p = this.game.nearestPlayer(this);
    if (!p) return;
    const want = Math.atan2(p.cy - this.y, p.cx - this.cx);
    let d = want - this.ang;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.ang += Math.max(-2 * dt, Math.min(2 * dt, d));
    this.cool -= dt;
    if (this.cool <= 0 && this.game.onScreen(this)) {
      this.cool = 1.4;
      enemyShot(this.game, this.cx + Math.cos(this.ang) * 26, this.y + 8 + Math.sin(this.ang) * 26, this.ang, 230);
    }
  }
  draw(ctx) {
    drawGun(ctx, this.cx, this.y + 8, this.ang, 28, C.ratDk);
    const drew = this.drawGen(ctx, 'turret', 'body', 0, 42 / 76, { dy: 1 });
    this.warn(ctx, this.cx + Math.cos(this.ang) * 28, this.y + 8 + Math.sin(this.ang) * 28);
    if (drew) return;
    rrect(ctx, this.x, this.y + 4, this.w, this.h - 4, 5);
    ink(ctx, this.flash > 0 ? '#fff' : '#B9C2C4', 2.5);
    ctx.beginPath();
    ctx.arc(this.cx, this.y + 4, 11, Math.PI, 0);
    ink(ctx, '#9AA5A8', 2.5);
    // rat emblem
    ctx.beginPath(); ctx.arc(this.cx - 5, this.y + 14, 3, 0, Math.PI * 2); ink(ctx, C.red, 1.2);
    ctx.beginPath(); ctx.arc(this.cx + 5, this.y + 14, 3, 0, Math.PI * 2); ink(ctx, C.red, 1.2);
    ctx.beginPath(); ctx.arc(this.cx, this.y + 20, 5, 0, Math.PI * 2); ink(ctx, C.red, 1.5);
  }
}

// 04: bat cat — wave flight, then dives
export class Bat extends Enemy {
  constructor(game, x, y) {
    super(game, x, y, 36, 28, 2);
    this.baseY = y;
    this.mode = 'fly';
    this.score = 200;
    this.cat = 'cat04';
    this.dropper = Math.random() < 0.4; // some hover over the hero and drop straight down
  }
  update(dt) {
    this.base(dt);
    const p = this.game.nearestPlayer(this);
    if (this.mode === 'fly') {
      this.x -= 105 * dt;
      this.y = this.baseY + Math.sin(this.t * 3) * 36;
      if (this.dropper && p && Math.abs(p.cx - this.cx) < 220 && this.t > 0.8) {
        this.mode = 'hover';
        this.hoverT = 0;
      } else if (p && Math.abs(p.cx - this.cx) < 150 && this.t > 1) {
        this.mode = 'dive';
        const a = Math.atan2(p.cy - this.cy, p.cx - this.cx);
        this.vx = Math.cos(a) * 280;
        this.vy = Math.sin(a) * 280;
      }
    } else if (this.mode === 'hover') {
      // shadow the hero from above for a moment (a little shake warns of the drop), then plunge
      this.hoverT += dt;
      if (p) this.x += Math.max(-140 * dt, Math.min(140 * dt, p.cx - this.cx));
      this.y += (Math.max(40, (p ? p.y : 200) - 120) - this.y) * Math.min(1, dt * 3);
      this.shakeX = this.hoverT > 0.7 ? Math.sin(this.t * 60) * 2 : 0;
      if (this.hoverT > 1.0) { this.mode = 'drop'; this.vx = 0; this.vy = 120; }
    } else if (this.mode === 'drop') {
      this.vy += 900 * dt;
      this.y += this.vy * dt;
      this.shakeX = 0;
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy -= 260 * dt; // pulls up after the dive
    }
    if (this.x < this.game.cam.x - 100 || this.y < this.game.cam.y - 120 || this.y > this.game.cam.y + 440) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    if (this.shakeX) ctx.translate(this.shakeX, 0);
    const drew = this.drawGen(ctx, 'bat', 'fly', this.t * (this.mode === 'hover' ? 16 : 9), 46 / 96, { flip: this.vx > 0 ? -1 : 1, dy: 8 });
    ctx.restore();
    if (drew) return;
    this.drawSprite(ctx, 'cat04', 46, { flip: this.vx > 0 ? -1 : 1, bob: Math.sin(this.t * 20) * 2 });
  }
}

// 06: ghost cat — drifts through walls, only solid while visible
export class Ghost extends Enemy {
  constructor(game, x, y) {
    super(game, x, y, 36, 40, 4);
    this.cool = 1;
    this.score = 300;
    this.cat = 'cat06';
  }
  get alpha() {
    const c = this.t % 5; // 2s visible, 0.5 fade out, 2s hidden, 0.5 fade in
    if (c < 2) return 1;
    if (c < 2.5) return 1 - (c - 2) / 0.5;
    if (c < 4.5) return 0.08;
    return (c - 4.5) / 0.5;
  }
  hittable() { return !this.dead && this.alpha > 0.6; }
  touches(p) { return this.hittable() && overlap(this, p); }
  update(dt) {
    this.base(dt);
    const p = this.game.nearestPlayer(this);
    if (!p) return;
    const a = Math.atan2(p.cy - 40 - this.cy, p.cx - this.cx);
    this.x += Math.cos(a) * 42 * dt;
    this.y += Math.sin(a) * 42 * dt + Math.sin(this.t * 2) * 0.4;
    this.cool -= dt;
    if (this.cool <= 0 && this.alpha >= 1) {
      this.cool = 1.6;
      enemyShot(this.game, this.cx, this.cy, Math.atan2(p.cy - this.cy, p.cx - this.cx), 140, 6);
    }
    if (this.x < this.game.cam.x - 200) this.dead = true;
  }
  draw(ctx) {
    if (this.drawGen(ctx, 'ghost', 'float', this.t * 2.5, 52 / 108, { alpha: this.alpha, dy: Math.sin(this.t * 2) * 3 + 4 })) return;
    this.drawSprite(ctx, 'cat06', 50, { alpha: this.alpha, bob: Math.sin(this.t * 2) * 3 });
  }
}

// 03: three-eyed fat white cat, mid-boss
export class Elite extends Enemy {
  constructor(game, x) {
    const hp = game.players.filter(Boolean).length > 1 ? 96 : 64;
    super(game, x, -140, 76, 100, hp);
    this.state = 'drop';
    this.timer = 0;
    this.hops = 0;
    this.score = 5000;
    this.cat = 'cat03';
    this.boss = t('boss.elite');
  }
  update(dt) {
    this.base(dt);
    const g = this.game;
    const p = g.nearestPlayer(this);
    this.timer -= dt;
    const angry = this.hp < this.maxHp / 2;
    if (this.delay > 0) { this.delay -= dt; return; } // waits for the WARNING banner
    if (this.state === 'drop') {
      this.vx = 0;
      moveBody(this, dt, g.level);
      if (this.onGround) { g.shake(10); sfx.boom(true); this.state = 'hop'; this.timer = 0.8; }
      return;
    }
    if (this.state === 'hop') {
      if (this.onGround) {
        this.vx = 0;
        if (this.timer <= 0) {
          if (this.hops >= 3) {
            this.state = 'volley'; this.hops = 0; this.timer = 0.4; this.shots = angry ? 4 : 3;
          } else {
            this.vy = -560;
            this.vx = (p && p.cx < this.cx ? -1 : 1) * (angry ? 210 : 160);
            this.hops++;
            this.timer = angry ? 0.35 : 0.55;
          }
        }
      }
      const wasAir = !this.onGround;
      moveBody(this, dt, g.level);
      if (wasAir && this.onGround) { g.shake(5); sfx.boom(false); }
    } else if (this.state === 'volley') {
      if (this.timer <= 0 && p) {
        const a = Math.atan2(p.cy - (this.y + 20), p.cx - this.cx);
        const n = angry ? 7 : 5;
        for (let i = 0; i < n; i++) enemyShot(g, this.cx, this.y + 20, a + (i - (n - 1) / 2) * 0.2, 200, 5.5);
        this.shots--;
        this.timer = 0.45;
        if (this.shots <= 0) {
          this.state = Math.random() < 0.5 ? 'summon' : 'hop';
          this.timer = 0.6;
        }
      }
      moveBody(this, dt, g.level);
    } else if (this.state === 'summon') {
      if (this.timer <= 0) {
        g.spawnRunner(1);
        g.spawnRunner(-1);
        g.text(this.cx, this.y - 10, t('elite.roar'), C.red);
        this.state = 'hop';
        this.timer = 0.8;
      }
      moveBody(this, dt, g.level);
    }
    const lo = g.cam.x + 10;
    const hi = g.cam.x + g.W - this.w - 10;
    if (this.x < lo) { this.x = lo; this.vx = Math.abs(this.vx); }
    if (this.x > hi) { this.x = hi; this.vx = -Math.abs(this.vx); }
  }
  draw(ctx) {
    const squash = this.onGround ? 1 : 1.05;
    const p = this.game.nearestPlayer(this);
    const flip = p && p.cx > this.cx ? -1 : 1; // generated frames face left
    const anim = this.state === 'volley' ? 'fire' : this.onGround ? 'idle' : 'jump';
    if (this.drawGen(ctx, 'elite', anim, 0, 116 / 224, { flip, dy: 2 })) return;
    this.drawSprite(ctx, 'cat03', 112 * squash, { flip: p && p.cx > this.cx ? -1 : 1 });
    if (this.state === 'volley') {
      ctx.beginPath();
      ctx.arc(this.cx, this.y + 20, 8 + Math.sin(this.t * 30) * 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(242,179,61,0.55)';
      ctx.fill();
    }
  }
}

// Stage 1 boss: the Red Mouse scratching-post fortress. Hit points live on its parts.
// where the generated fortress image sits relative to the wall's x (logical units)
const FORT = { x: -10, y: -24, h: 344 };

export class BossWall extends Enemy {
  constructor(game, x) {
    super(game, x, 0, 160, 300, 1);
    this.isWall = true;
    this.score = 0;
    this.parts = [];
    this.dropT = 3;
    this.dying = 0;
  }
  hittable() { return false; }
  touches() { return false; }
  init() {
    const g = this.game;
    const two = g.players.filter(Boolean).length > 1;
    // socket centres measured on the generated fortress image (px), mapped to the world
    const art = frame('fortress', 'body');
    const at = (px, py, w, h) => (art
      ? [FORT.x + this.x + px * FORT.h / art.h - w / 2, FORT.y + py * FORT.h / art.h - h / 2]
      : null);
    const c1 = at(95, 245, 34, 30) || [this.x - 6, 96];
    const c2 = at(96, 391, 34, 30) || [this.x - 6, 176];
    const c3 = at(100, 531, 44, 52) || [this.x + 2, 236];
    this.parts = [
      new BossPart(g, this, c1[0], c1[1], 'cannon', two ? 28 : 16),
      new BossPart(g, this, c2[0], c2[1], 'cannon', two ? 28 : 16),
      new BossPart(g, this, c3[0], c3[1], 'core', two ? 95 : 50),
    ];
    this.art = art;
    g.enemies.push(...this.parts);
  }
  update(dt) {
    this.base(dt);
    const g = this.game;
    if (this.dying > 0) {
      this.dying -= dt;
      // chain of explosions across the collapsing tower
      if (Math.random() < 0.18) g.effects.push(new FxAnim('explosion', 'boom', this.x + Math.random() * 150, 20 + Math.random() * 280, 0.55, 0.6 + Math.random() * 0.5));
      if (Math.random() < 0.08) sfx.boom(true);
      if (this.dying <= 0) { this.dead = true; g.stageClear(); }
      return;
    }
    this.dropT -= dt;
    if (this.dropT <= 0) {
      this.dropT = g.players.length > 1 ? 3 : 4;
      const r = new Rat(g, this.x - 60 - Math.random() * 200, 300);
      r.y = -50;
      g.enemies.push(r);
    }
    if (this.parts.length && this.parts.find((p) => p.kind === 'core').dead) {
      this.dying = 2.4;
      for (const p of this.parts) p.dead = true;
      g.shake(14);
      sfx.boom(true);
    }
  }
  draw(ctx) {
    const x = this.x;
    const g = this.game;
    if (this.art) {
      const w = (this.art.w * FORT.h) / this.art.h;
      // collapsing: the tower shakes and darkens (only the tower itself, never the sky around it)
      const k = this.dying > 0 ? 1 - this.dying / 2.4 : 0;
      const sx = this.dying > 0 ? (Math.random() - 0.5) * 4 : 0;
      ctx.drawImage(this.art.img, x + FORT.x + sx, FORT.y + k * 10, w, FORT.h);
      if (this.dying > 0) {
        ctx.save();
        ctx.globalAlpha = 0.15 + 0.3 * k;
        ctx.drawImage(tintOf(this.art, '#2a2622'), x + FORT.x + sx, FORT.y + k * 10, w, FORT.h);
        ctx.restore();
      }
      // wrecked cannons stay in their sockets
      for (const p of this.parts) if (p.dead) p.drawWreck(ctx);
      return;
    }
    // cardboard tower
    rrect(ctx, x + 10, 20, 150, 300, 4);
    ink(ctx, C.plank, 3.5);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C.plankDk;
    for (let y = 30; y < 300; y += 9) {
      ctx.beginPath(); ctx.moveTo(x + 14, y); ctx.lineTo(x + 156, y + 3); ctx.stroke();
    }
    // rope wrap
    for (let y = 60; y < 290; y += 70) {
      rrect(ctx, x + 6, y, 158, 16, 3);
      ink(ctx, '#E9D9B2', 2.5);
    }
    // flag
    ctx.beginPath(); ctx.moveTo(x + 90, 20); ctx.lineTo(x + 90, -30); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 90, -30);
    ctx.quadraticCurveTo(x + 60, -22 + Math.sin(g.t * 4) * 4, x + 40, -26);
    ctx.lineTo(x + 44, -6);
    ctx.quadraticCurveTo(x + 64, -4 + Math.sin(g.t * 4 + 1) * 4, x + 90, -10);
    ctx.closePath();
    ink(ctx, C.red, 2.5);
    ctx.fillStyle = C.cream;
    ctx.font = '900 12px "Noto Sans HK", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('鼠', x + 66, -12);
    if (this.dying > 0) {
      ctx.fillStyle = 'rgba(30,30,30,0.2)';
      ctx.fillRect(x, 0, 170, 320);
    }
  }
}

class BossPart extends Enemy {
  constructor(game, wall, x, y, kind, hp) {
    super(game, x, y, kind === 'core' ? 44 : 34, kind === 'core' ? 52 : 30, hp);
    this.wall = wall;
    this.kind = kind;
    this.cool = kind === 'core' ? 2.2 : 1 + Math.random();
    this.score = kind === 'core' ? 10000 : 1500;
    this.villain = true;
    this.ang = Math.PI;
  }
  touches() { return false; }
  update(dt) {
    this.base(dt);
    const g = this.game;
    const p = g.nearestPlayer(this);
    if (!p) return;
    this.cool -= dt;
    if (this.kind === 'cannon') {
      this.ang = Math.atan2(p.cy - this.cy, p.cx - this.x);
      this.ang = Math.max(Math.PI * 0.55, Math.min(Math.PI * 1.35, (this.ang + Math.PI * 2) % (Math.PI * 2)));
      if (this.cool <= 0) {
        this.cool = 1.3;
        const m = this.barrelTip();
        enemyShot(g, m.x, m.y, this.ang, 230);
      }
    } else if (this.cool <= 0) {
      const cannonsLeft = this.wall.parts.filter((q) => q.kind === 'cannon' && !q.dead).length;
      this.cool = cannonsLeft ? 2.6 : 1.5;
      for (let i = -2; i <= 2; i++) {
        const a = Math.PI + i * 0.22;
        g.ebullets.push({ x: this.x, y: this.cy, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170 - 160, gravity: 300, t: 0, kind: 'enemy', r: 6 });
      }
      sfx.enemyShot();
    }
  }
  // the barrel pivots on the hatch's ball joint; the shot leaves its tip
  barrelTip() {
    const len = frame('boss', 'barrel') ? 30 : 26;
    return { x: this.cx + Math.cos(this.ang) * len, y: this.cy + Math.sin(this.ang) * len };
  }
  drawWreck(ctx) {
    const f = frame('boss', this.kind === 'core' ? 'corehurt' : 'podbroken');
    if (f) drawFrame(ctx, f, this.cx, this.cy, (this.w + 6) / f.w, { anchor: 'center' });
  }
  draw(ctx) {
    if (this.dead) return;
    if (this.drawArt(ctx)) return;
    if (this.kind === 'cannon') {
      drawGun(ctx, this.x + 6, this.cy, this.ang, 34, C.ratDk);
      rrect(ctx, this.x, this.y, this.w, this.h, 5);
      ink(ctx, this.flash > 0 ? '#fff' : '#B9C2C4', 3);
      ctx.beginPath(); ctx.arc(this.cx, this.cy, 6, 0, Math.PI * 2); ink(ctx, C.red, 1.5);
    } else {
      const pulse = 1 + Math.sin(this.t * 6) * 0.08;
      rrect(ctx, this.x - 4, this.y - 4, this.w + 8, this.h + 8, 10);
      ink(ctx, '#B9C2C4', 3);
      ctx.beginPath();
      ctx.ellipse(this.cx, this.cy, 16 * pulse, 20 * pulse, 0, 0, Math.PI * 2);
      ink(ctx, this.flash > 0 ? '#fff' : C.red, 3);
      ctx.beginPath();
      ctx.ellipse(this.cx - 2, this.cy, 4, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.ink;
      ctx.fill();
      ctx.fillStyle = C.ink;
      ctx.font = '700 9px "Noto Sans HK", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t('boss.core'), this.cx, this.y + this.h + 16);
    }
  }
  // generated hatch + pivoting barrel, and the rat-eye porthole (cracked below half health)
  drawArt(ctx) {
    const flash = this.flash > 0;
    if (this.kind === 'cannon') {
      const pod = frame('boss', 'pod');
      const barrel = frame('boss', 'barrel');
      if (!pod || !barrel) return false;
      drawFrame(ctx, pod, this.cx, this.cy, (this.w + 6) / pod.w, { anchor: 'center', flash });
      const bl = 34;
      const bh = (barrel.h * bl) / barrel.w;
      ctx.save();
      ctx.translate(this.cx, this.cy);
      ctx.rotate(this.ang - Math.PI); // the art points left
      ctx.drawImage(flash ? tintOf(barrel, '#fff') : barrel.img, -bl * 0.9, -bh / 2, bl, bh);
      ctx.restore();
      const m = this.barrelTip();
      this.warn(ctx, m.x, m.y);
      return true;
    }
    const core = frame('boss', this.hp < this.maxHp / 2 ? 'corehurt' : 'core');
    if (!core) return false;
    const pulse = 1 + Math.sin(this.t * 6) * 0.05;
    drawFrame(ctx, core, this.cx, this.cy, ((this.w + 14) / core.w) * pulse, { anchor: 'center', flash });
    return true;
  }
}

// Flying can: shoot it to release a weapon letter
export class Capsule extends Enemy {
  constructor(game, item) {
    super(game, game.cam.x - 30, game.cam.y + 100, 30, 20, 1);
    this.item = item;
    this.score = 0;
  }
  touches() { return false; } // a pickup carrier, harmless to bump into
  update(dt) {
    this.base(dt);
    this.x += 120 * dt;
    this.y = this.game.cam.y + 100 + Math.sin(this.t * 2.4) * 40;
    if (this.x > this.game.cam.x + this.game.W + 40) this.dead = true;
  }
  draw(ctx) {
    const can = frame('item', 'can');
    if (can) {
      drawFrame(ctx, can, this.cx, this.cy, 34 / can.w, { anchor: 'center', rot: Math.sin(this.t * 4) * 0.15 });
      return;
    }
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(Math.sin(this.t * 4) * 0.15);
    // wings
    ctx.beginPath();
    ctx.moveTo(-6, -6); ctx.lineTo(-16, -16 - Math.abs(Math.sin(this.t * 18)) * 6); ctx.lineTo(2, -8); ctx.closePath();
    ink(ctx, C.cream, 1.8);
    rrect(ctx, -15, -10, 30, 20, 7);
    ink(ctx, '#C9CFD2', 2.5);
    rrect(ctx, -15, -4, 30, 8, 2);
    ink(ctx, C.red, 1.5);
    // fish on the label
    ctx.beginPath();
    ctx.ellipse(-1, 0, 6, 2.6, 0, 0, Math.PI * 2);
    ctx.moveTo(5, 0); ctx.lineTo(9, -3); ctx.lineTo(9, 3); ctx.closePath();
    ctx.fillStyle = C.cream;
    ctx.fill();
    ctx.restore();
  }
}

export class Item {
  constructor(game, x, y, type) {
    Object.assign(this, { game, x, y, w: 22, h: 22, vx: 50, vy: -380, type, t: 0, dead: false });
  }
  update(dt) {
    this.t += dt;
    moveBody(this, dt, this.game.level);
    if (this.onGround) this.vx *= 0.8;
    if (this.y > this.game.cam.y + 440 || this.x < this.game.cam.x - 60) this.dead = true;
  }
  draw(ctx) {
    const bob = this.onGround ? Math.sin(this.t * 4) * 2 : 0;
    if (this.type === 'G') return drawGoldCan(ctx, this.x + 11, this.y + 11 - bob, this.t);
    const f = frame('item', this.type);
    if (f) drawFrame(ctx, f, this.x + 11, this.y + 11 - bob, 24 / f.h, { anchor: 'center' });
    else drawBadge(ctx, this.x + 11, this.y + 11 - bob, 11, this.type);
  }
}

// ======================= EFFECTS =======================

export class Particle {
  constructor(x, y, vx, vy, r, color, life) {
    Object.assign(this, { x, y, vx, vy, r, color, life, max: life, dead: false });
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.92;
    this.vy *= 0.92;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    const k = this.life / this.max;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * (0.4 + (1 - k) * 0.9), 0, Math.PI * 2);
    ctx.globalAlpha = Math.min(1, k * 1.5);
    ink(ctx, this.color, 2);
    ctx.globalAlpha = 1;
  }
}

// a soft puff of dust: drifts, grows and fades, no outline
export class Dust {
  constructor(x, y, vx, vy) {
    Object.assign(this, { x, y, vx, vy, r: 3 + Math.random() * 3, life: 0.45 + Math.random() * 0.2, dead: false });
    this.max = this.life;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.9;
    this.vy *= 0.9;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    const k = this.life / this.max;
    ctx.globalAlpha = k * 0.7;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * (1 + (1 - k) * 1.6), 0, Math.PI * 2);
    ctx.fillStyle = '#E9DFC9';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(30,30,30,0.25)';
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export class FloatText {
  constructor(x, y, text, color, size = 13) {
    Object.assign(this, { x, y, text, color, size, life: size > 13 ? 1.4 : 1.1, dead: false });
  }
  update(dt) {
    this.y -= 30 * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.globalAlpha = Math.min(1, this.life * 2);
    ctx.font = `900 ${this.size}px "Noto Sans HK", sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.size > 13 ? 5 : 4;
    ctx.strokeStyle = this.size > 13 ? C.ink : C.cream;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}

const FREED_ART = { cat05: 'freed_runner', cat04: 'freed_bat', cat06: 'freed_ghost', cat03: 'freed_elite', cone: 'freed_conecat', bowl: 'freed_bowlcat', pirate: 'freed_pirate', hypno: 'freed_hypnocat' };

// A rescued cat: shakes off the mind control in a puff of smoke, then hops away happily.
export class FreedCat {
  constructor(game, sprite, x, y, h, o = {}) {
    Object.assign(this, { game, sprite, x, y, h, t: 0, dead: false, life: o.life ?? 2.6 });
    this.key = FREED_ART[sprite];
    this.floor = y;
    this.daze = o.happy ? 0 : 0.5;
    this.dir = o.dir ?? (Math.random() < 0.5 ? -1 : 1);
    this.vx = 0;
    this.vy = 0;
    if (!o.happy) game.effects.push(new FxAnim('explosion', 'boom', x, y - h * 0.5, 0.45, (h / 128) * 1.1, { from: 3 }));
  }
  update(dt) {
    this.t += dt;
    if (this.t < this.daze) return;
    if (!this.hopping) {
      this.hopping = true;
      this.vx = this.dir * (70 + Math.random() * 50);
      this.vy = -300;
    }
    this.vy += 900 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const floor = this.floor ?? 300;
    if (this.y > floor && this.vy > 0 && this.t < this.life) { this.y = floor; this.vy = -280; }
    if (this.t > this.life) this.dead = true;
  }
  draw(ctx) {
    const f = this.key && frame(this.key, this.t < this.daze ? 'daze' : 'happy');
    const alpha = Math.min(1, (this.life - this.t) * 1.5);
    if (f) {
      const jitter = this.t < this.daze ? Math.sin(this.t * 70) * 1.5 : 0;
      const ref = this.key === 'freed_elite' || this.key === 'freed_pirate' ? 220 : 110;
      drawFrame(ctx, f, this.x + jitter, this.y, this.h / ref, { flip: this.dir, alpha });
    } else {
      const img = this.game.img[this.sprite] || this.game.img.cat05;
      const w = (img.width * this.h) / img.height;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, this.x - w / 2, this.y - this.h, w, this.h);
      ctx.restore();
    }
    if (this.t > this.daze && this.t < this.daze + 1.4) {
      ctx.globalAlpha = alpha;
      drawHeart(ctx, this.x + this.dir * 10, this.y - this.h - 6 - (this.t - this.daze) * 22, 11, C.pink);
      ctx.globalAlpha = 1;
    }
  }
}

function circleHitRect(b, r) {
  const nx = Math.max(r.x, Math.min(b.x, r.x + r.w));
  const ny = Math.max(r.y, Math.min(b.y, r.y + r.h));
  return (b.x - nx) ** 2 + (b.y - ny) ** 2 < b.r * b.r;
}

// small spinning yellow star next to the P1/P2 label while the skill is ready
function drawReadyStar(ctx, x, y, t) {
  const r = 5 + Math.sin(t * 8) * 1.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 2);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = C.yellow;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.restore();
}

// Blaze's third-eye beam: a thick ink-outlined yellow/red ray across the screen that thins out and fades
export class EyeBeam {
  constructor(x, y, ang, len, half) {
    Object.assign(this, { x, y, ang, len, half, t: 0, dur: 0.4, dead: false });
  }
  update(dt) {
    this.t += dt;
    if (this.t >= this.dur) this.dead = true;
  }
  draw(ctx) {
    const k = 1 - this.t / this.dur;
    const beam = frame('skill', 'beam');
    if (beam) return this.drawArt(ctx, k, beam, frame('skill', 'flare'));
    const w = this.half * 2 * (0.4 + 0.6 * k);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.ang);
    ctx.globalAlpha = Math.min(1, k * 1.6);
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, -w / 2 - 2, this.len, w + 4);
    ctx.fillStyle = C.red;
    ctx.fillRect(0, -w / 2, this.len, w);
    ctx.fillStyle = C.yellow;
    ctx.fillRect(0, -w / 4, this.len, w / 2);
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // generated beam section stretched to length, a flickering flare on the eye
  drawArt(ctx, k, beam, flare) {
    const flick = 1 + Math.sin(this.t * 70) * 0.08;
    const w = this.half * 2 * (0.35 + 0.85 * k) * flick;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.ang);
    ctx.globalAlpha = Math.min(1, k * 1.8);
    ctx.drawImage(beam.img, 0, -w / 2, this.len, w);
    if (flare) {
      const fh = this.half * 3.4 * (0.7 + 0.5 * k) * flick;
      const fw = (fh * flare.w) / flare.h;
      ctx.rotate(this.t * 6);
      ctx.drawImage(flare.img, -fw / 2, -fh / 2, fw, fh);
    }
    ctx.restore();
  }
}

// one generated effect frame that pops out, grows and fades (skill impact splash)
export class SkillPop {
  constructor(anim, x, y, size, dur) {
    Object.assign(this, { anim, x, y, size, dur, t: 0, dead: false, rot: (Math.random() - 0.5) * 0.8 });
  }
  update(dt) {
    this.t += dt;
    if (this.t >= this.dur) this.dead = true;
  }
  draw(ctx) {
    const f = frame('skill', this.anim);
    if (!f) return;
    const k = this.t / this.dur;
    const h = this.size * (0.6 + 0.6 * Math.sqrt(k));
    const w = (h * f.w) / f.h;
    ctx.save();
    ctx.globalAlpha = 1 - k * k;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.drawImage(f.img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

// expanding ring around a hero the moment the skill becomes ready
export class ReadyRing {
  constructor(p) {
    Object.assign(this, { p, t: 0, dur: 0.6, dead: false });
  }
  update(dt) {
    this.t += dt;
    if (this.t >= this.dur) this.dead = true;
  }
  draw(ctx) {
    const k = this.t / this.dur;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.beginPath();
    ctx.arc(this.p.cx, this.p.cy, 18 + k * 40, 0, Math.PI * 2);
    ctx.lineWidth = 4 * (1 - k) + 1;
    ctx.strokeStyle = C.yellow;
    ctx.stroke();
    ctx.restore();
  }
}

// One-shot sprite animation (muzzle flash, impact, explosion). anchor 'left' puts the
// frame's left edge at (x, y), used for muzzle flashes leaving the gun.
export class FxAnim {
  constructor(key, anim, x, y, dur, scale, o = {}) {
    Object.assign(this, { key, anim, x, y, dur, scale, rot: o.rot || 0, anchor: o.anchor, from: o.from || 0, t: 0, dead: false });
  }
  update(dt) {
    this.t += dt;
    if (this.t >= this.dur) this.dead = true;
  }
  draw(ctx) {
    const list = SPR.frames[this.key] && SPR.frames[this.key][this.anim];
    if (!list || !list.length) return;
    const n = list.length - this.from;
    const f = frame(this.key, this.anim, this.from + Math.min(n - 1, Math.floor((this.t / this.dur) * n)));
    if (f) drawFrame(ctx, f, this.x, this.y, this.scale, { anchor: 'center', rot: this.rot, ax: this.anchor === 'left' ? 0 : 0.5 });
  }
}

// A defeated hero: lies dazed for a moment while one of its nine lives floats up to heaven.
export class KnockedOut {
  constructor(game, hero, x, y, facing, scale) {
    Object.assign(this, { game, hero, x, y, facing, scale, t: 0, dead: false });
    this.body = frame(hero, 'down');
    this.soul = frame('soul', hero);
  }
  update(dt) {
    this.t += dt;
    if (this.t > 2) this.dead = true;
  }
  draw(ctx) {
    const age = this.t;
    if (this.body && age < 1 && (age < 0.6 || Math.floor(age * 16) % 2)) {
      drawFrame(ctx, this.body, this.x, this.y, this.scale, { flip: this.facing });
      // dizzy stars circling the head
      for (let i = 0; i < 3; i++) {
        const a = age * 7 + (i * Math.PI * 2) / 3;
        drawStar(ctx, this.x + this.facing * 14 + Math.cos(a) * 12, this.y - 26 + Math.sin(a) * 4, 4);
      }
    }
    if (this.soul && age > 0.25) {
      const k = age - 0.25;
      const alpha = Math.min(1, k * 3) * Math.max(0, 1 - k / 1.75);
      const sx = this.x + Math.sin(k * 4) * 8;
      const sy = this.y - 34 - k * 70;
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 40);
      glow.addColorStop(0, `rgba(255,236,170,${0.7 * alpha})`);
      glow.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, 40, 0, Math.PI * 2);
      ctx.fill();
      drawFrame(ctx, this.soul, sx, sy + 30, 60 / 110, { alpha });
      if (k < 1.2) {
        ctx.globalAlpha = Math.max(0, 1 - k / 1.2);
        ctx.font = '400 18px Bungee, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = C.ink;
        ctx.strokeText(t('life.lost'), this.x + 34, this.y - 50 - k * 30);
        ctx.fillStyle = C.yellow;
        ctx.fillText(t('life.lost'), this.x + 34, this.y - 50 - k * 30);
        ctx.globalAlpha = 1;
      }
    }
  }
}

function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ink(ctx, C.yellow, 1.2);
}

export class Debris {
  constructor(x, y) {
    Object.assign(this, { x, y, vx: (Math.random() - 0.5) * 120, vy: -150, rot: 0, life: 1.4, dead: false });
  }
  update(dt) {
    this.vy += 1100 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += dt * 6;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    rrect(ctx, -8, -3, 16, 6, 2);
    ink(ctx, C.plank, 1.5);
    ctx.restore();
  }
}
