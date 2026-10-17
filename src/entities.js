// Players, bullets, enemies, pickups and effects.

import { C, ink, ellipse, rrect, drawRat, drawGun, drawHeart, drawBadge, WEAPON_INFO } from './art.js';
import { sfx } from './audio.js';
import { frame, drawFrame } from './sprites.js';

export const GRAVITY = 1500;
const RUN = 155;
const HERO_SCALE = 60 / 128; // generated hero frames are 128px tall when standing

export const CHARS = [
  { id: 'blaze', name: '火斑 Blaze', sprite: 'cat01', gun: C.yellow, drawH: 54, size: 1, skill: '三眼鎖定' },
  { id: 'gulp', name: '大口 Gulp', sprite: 'cat02', gun: C.red, drawH: 60, size: 1.04, skill: '肚口吞彈' },
];

const SKILL_COST = 50;

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
    if (!overlap(e, s)) continue;
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
  constructor(game, idx, ctl) {
    this.game = game;
    this.idx = idx;
    this.ctl = ctl;
    this.char = CHARS[idx];
    this.w = 26;
    this.h = 46;
    this.x = game.cam.x + 80 + idx * 40;
    this.y = -60 - idx * 30; // drop in from the sky at the start
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
      if (this.y > 440) this.loseLife();
      else if (this.downT <= 0) this.loseLife();
      return;
    }

    const c = this.ctl.poll(this, g.cam);
    this.input = c;
    this.anim += dt;
    this.inv = Math.max(0, this.inv - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.catnip = Math.max(0, this.catnip - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.dropT = Math.max(0, this.dropT - dt);
    this.cool -= dt;

    let mx = c.lock ? 0 : c.mx;
    const swallowing = this.char.id === 'gulp' && this.skillT > 0;
    const wantCrouch = c.down && this.onGround && Math.abs(c.mx) < 0.3 && this.dashT <= 0 && !swallowing;
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
      const target = mx * RUN * (swallowing ? 0.5 : 1);
      this.vx += (target - this.vx) * Math.min(1, dt * 16);
    }
    for (const tr of this.trail) tr.a -= dt * 2.5;
    this.trail = this.trail.filter((tr) => tr.a > 0);

    // jump buffering: a press shortly before landing still jumps once we touch down
    this.jumpBuf = c.jump ? 0.12 : Math.max(0, this.jumpBuf - dt);
    if (this.jumpBuf > 0) {
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
    if (!c.jumpHeld && this.jumps === 1 && this.vy < -220) this.vy = -220;
    this.dropping = this.dropT > 0;

    moveBody(this, dt, g.level, this.dashT <= 0);
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
    let aim = c.aim ? { ...c.aim } : { x: this.facing, y: 0 };
    if (c.assist) aim = g.assistAim(this, aim, c.assist);
    this.aim = aim;
    if (c.aim && Math.abs(aim.x) > 0.15) this.facing = Math.sign(aim.x);
    else if (mx) this.facing = Math.sign(mx);

    // fire
    const firing = c.fire === 'auto' ? g.enemiesOnScreen() : c.fire;
    if (firing && this.cool <= 0 && !swallowing && this.dashT <= 0) this.fire();

    // skill
    this.skillT = Math.max(0, this.skillT - dt);
    if (c.skill && this.energy >= SKILL_COST && this.skillT <= 0) this.useSkill();
    if (this.char.id === 'gulp' && this.skillT === 0 && this.swallowed > 0) this.spit();
    if (this.char.id === 'blaze') this.locks = this.locks.filter((e) => !e.dead);

    if (this.y > 440) this.die(true);
  }

  fire() {
    const g = this.game;
    const a = Math.atan2(this.aim.y, this.aim.x);
    const ox = this.cx + Math.cos(a) * 22;
    const oy = this.cy + Math.sin(a) * 22;
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
    g.effects.push(new FxAnim('muzzle', ox, oy, 0.07, 0.6, a));
    this.cool = cool * this.rate;
    sfx.shoot(w.type);
  }

  useSkill() {
    const g = this.game;
    this.energy -= SKILL_COST;
    if (this.char.id === 'blaze') {
      // third eye marks up to 3 enemies on screen; shots home in on them
      this.locks = g.enemies
        .filter((e) => e.hittable() && e.x + e.w > g.cam.x && e.x < g.cam.x + g.W)
        .sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))
        .slice(0, 3);
      this.skillT = 5;
      sfx.lock();
      g.text(this.cx, this.y - 14, this.locks.length ? '鎖定！' : '冇目標', C.red);
    } else {
      this.skillT = 1.6;
      this.swallowed = 0;
      sfx.swallow();
      g.text(this.cx, this.y - 14, '啊——', C.red);
    }
  }

  // Gulp: swallowed bullets come back out as a fan of heavy shots
  spit() {
    const g = this.game;
    const n = Math.min(16, this.swallowed * 2);
    const a = Math.atan2(this.aim.y, this.aim.x);
    for (let i = 0; i < n; i++) {
      const ang = a + (i - (n - 1) / 2) * 0.09;
      g.bullets.push({ x: this.cx, y: this.cy, vx: Math.cos(ang) * 520, vy: Math.sin(ang) * 520, t: 0, owner: this, kind: 'spit', r: 6, dmg: 2 });
    }
    sfx.spit();
    this.swallowed = 0;
  }

  // returns true if the bullet was swallowed
  trySwallow(b) {
    if (this.char.id !== 'gulp' || this.skillT <= 0 || this.state !== 'alive') return false;
    if (Math.hypot(b.x - this.cx, b.y - this.cy) > 78) return false;
    this.swallowed++;
    sfx.hit();
    return true;
  }

  hurt() {
    if (this.state !== 'alive' || this.inv > 0 || this.catnip > 0 || this.dashT > 0) return;
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
      this.game.text(this.cx, this.y - 10, '隊友！救我！', C.red);
    } else {
      this.loseLife();
    }
  }

  revive() {
    this.state = 'alive';
    this.hp = this.game.classic ? 1 : 2;
    this.inv = 2;
    sfx.revive();
    this.game.text(this.cx, this.y - 16, '舔醒咗！', C.green);
  }

  loseLife() {
    const g = this.game;
    g.puff(this.cx, this.cy, 8, [this.char.gun, C.cream]);
    const ko = frame(this.char.id, 'down');
    if (ko && this.y < 420) g.effects.push(new KnockedOut(ko, this.cx, this.y + this.h, this.facing, HERO_SCALE * this.char.size));
    g.deaths = (g.deaths || 0) + 1;
    this.lives--;
    if (this.weapon.lvl > 1) this.weapon.lvl = 1;
    else this.weapon = { type: 'N', lvl: 1 };
    this.rate = 1;
    this.locks = [];
    this.skillT = 0;
    this.swallowed = 0;
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
    this.x = g.cam.x + 90 + this.idx * 36;
    this.y = -50;
    this.vx = 0;
    this.vy = 0;
    this.inv = 2.5;
    this.h = 46;
    this.crouch = false;
  }

  pickup(item) {
    const g = this.game;
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
    if (!this.onGround) return { f: frame(key, 'jump') };
    if (this.crouch) return { f: frame(key, 'crouch') };
    if (Math.abs(this.vx) > 20) return { f: frame(key, 'run', this.anim * 13) };
    if (this.aim.y < -0.85) return { f: frame(key, 'aimup') || frame(key, 'idle') };
    if (this.aim.y < -0.35) return { f: frame(key, 'aimdiag') || frame(key, 'idle') };
    return { f: frame(key, 'idle'), breathe: true };
  }

  draw(ctx) {
    const g = this.game;
    if (this.state === 'out' || this.state === 'dead') return;
    const pose = this.pose();
    if (!pose.f) return this.drawLegacy(ctx);
    const scale = HERO_SCALE * this.char.size;

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

    ctx.save();
    if (this.inv > 0 && this.catnip <= 0 && Math.floor(g.t * 18) % 2) ctx.globalAlpha = 0.45;
    const gun = frame('gun', this.char.id);
    const showGun = !this.spin && !(this.char.id === 'gulp' && this.skillT > 0);
    const ang = Math.atan2(this.aim.y, this.aim.x);
    // the gun sits behind the body when aiming backwards over the shoulder
    const gunBehind = Math.sign(Math.cos(ang)) !== this.facing;
    if (showGun && gunBehind) this.drawGunArm(ctx, gun, ang);
    if (pose.anchor === 'center') {
      drawFrame(ctx, pose.f, this.cx, this.y + this.h - 22, scale, { flip: this.facing, anchor: 'center', rot: this.spin * Math.PI * 2 * this.facing });
    } else {
      const bob = pose.breathe ? Math.sin(g.t * 3) * 0.6 : 0;
      drawFrame(ctx, pose.f, this.cx, this.y + this.h + 1 + bob, scale, { flip: this.facing });
    }
    if (showGun && !gunBehind) this.drawGunArm(ctx, gun, ang);
    ctx.restore();

    if (this.char.id === 'gulp' && this.skillT > 0) {
      ctx.beginPath();
      ctx.arc(this.cx, this.cy + 6, 78, 0, Math.PI * 2);
      ctx.setLineDash([4, 8]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(232,86,75,0.6)';
      ctx.stroke();
      ctx.setLineDash([]);
      // air being sucked into the belly mouth
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + g.t * 3;
        const r = 70 - ((g.t * 120 + i * 20) % 60);
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
    ctx.fillText(`P${this.idx + 1}`, this.cx, this.y - (this.crouch ? 36 : 20));
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
}

export function drawBullet(ctx, b) {
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

function enemyShot(game, x, y, ang, speed = 210, r = 4.5) {
  game.ebullets.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, t: 0, kind: 'enemy', r });
  sfx.enemyShot();
}

// ======================= ENEMIES =======================

class Enemy {
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
  base(dt) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
  }
  touches(p) { return !this.dead && overlap(this, p); }
  // generated frame; returns false when the sprite is not available so callers can fall back
  drawGen(ctx, key, anim, i, scale, o = {}) {
    const f = frame(key, anim, i);
    if (!f) return false;
    drawFrame(ctx, f, this.cx, this.y + this.h + (o.dy || 0), scale, { ...o, flash: this.flash > 0 });
    return true;
  }
  // pulsing red glow at a muzzle shortly before this enemy fires
  warn(ctx, x, y) {
    if (this.cool > 0.35 || !this.game.onScreen(this)) return;
    const k = 1 - this.cool / 0.35;
    ctx.beginPath();
    ctx.arc(x, y, 3 + k * 6 + Math.sin(this.t * 40) * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(232,86,75,${0.35 + k * 0.5})`;
    ctx.fill();
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
  }
  update(dt) {
    this.base(dt);
    this.vx = this.dir * 150;
    moveBody(this, dt, this.game.level);
    if (this.onGround && (this.hitWall || Math.random() < 0.006)) this.vy = -480;
    if (this.y > 440 || this.x < this.game.cam.x - 120 || this.x > this.game.cam.x + this.game.W + 160) this.dead = true;
  }
  draw(ctx) {
    // generated runner frames face left
    if (this.drawGen(ctx, 'runner', 'run', this.t * 12, 54 / 112, { flip: this.dir < 0 ? 1 : -1, dy: 1 })) return;
    this.drawSprite(ctx, 'cat05', 52, { flip: -this.dir, bob: this.onGround ? Math.abs(Math.sin(this.t * 15)) * 4 : 0, rot: Math.sin(this.t * 15) * 0.08 });
  }
}

// Red Mouse rifle soldier
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
    if (this.y > 440) { this.dead = true; return; }
    const p = this.game.nearestPlayer(this);
    if (!p) return;
    this.facing = p.cx < this.cx ? -1 : 1;
    this.cool -= dt;
    if (this.cool <= 0 && this.game.onScreen(this)) {
      this.cool = 1.7 + Math.random() * 0.8;
      const a = Math.atan2(p.cy - (this.y + 18), p.cx - this.cx);
      const q = Math.round(a / (Math.PI / 4)) * (Math.PI / 4); // 8 directions like the original
      enemyShot(this.game, this.cx + Math.cos(q) * 16, this.y + 18 + Math.sin(q) * 16, q);
      this.aimA = q;
      this.fireT = 0.18;
    }
  }
  draw(ctx) {
    if (this.drawGen(ctx, 'rat', this.fireT > 0 ? 'fire' : 'idle', 0, 46 / 92, { flip: -this.facing, dy: 1 })) {
      this.warn(ctx, this.cx + this.facing * 26, this.y + 20);
      return;
    }
    const p = this.game.nearestPlayer(this);
    const a = this.aimA ?? (p ? Math.atan2(p.cy - this.y - 18, p.cx - this.cx) : Math.PI);
    drawRat(ctx, this.cx, this.y + this.h, this.facing, this.t, { flash: this.flash > 0 });
    drawGun(ctx, this.cx + this.facing * 4, this.y + 20, a, 18, C.ratDk);
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
  }
  update(dt) {
    this.base(dt);
    const p = this.game.nearestPlayer(this);
    if (this.mode === 'fly') {
      this.x -= 105 * dt;
      this.y = this.baseY + Math.sin(this.t * 3) * 36;
      if (p && Math.abs(p.cx - this.cx) < 150 && this.t > 1) {
        this.mode = 'dive';
        const a = Math.atan2(p.cy - this.cy, p.cx - this.cx);
        this.vx = Math.cos(a) * 280;
        this.vy = Math.sin(a) * 280;
      }
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy -= 260 * dt; // pulls up after the dive
    }
    if (this.x < this.game.cam.x - 100 || this.y < -120 || this.y > 440) this.dead = true;
  }
  draw(ctx) {
    if (this.drawGen(ctx, 'bat', 'fly', this.t * 9, 46 / 96, { flip: this.vx > 0 ? -1 : 1, dy: 8 })) return;
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
    this.boss = '三眼肥白貓（被洗腦）';
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
        g.text(this.cx, this.y - 10, '喵嗚——！', C.red);
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
      if (Math.random() < 0.4) g.puff(this.x + Math.random() * 120, Math.random() * 300, 6, [C.red, C.yellow, C.cream]);
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
      ctx.drawImage(this.art.img, x + FORT.x, FORT.y, w, FORT.h);
      if (this.dying > 0) {
        ctx.fillStyle = 'rgba(30,30,30,0.25)';
        ctx.fillRect(x + FORT.x, FORT.y, w, FORT.h);
      }
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
        enemyShot(g, this.x + Math.cos(this.ang) * 26, this.cy + Math.sin(this.ang) * 26, this.ang, 230);
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
  draw(ctx) {
    if (this.dead) return;
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
      ctx.fillText('鼠眼核心', this.cx, this.y + this.h + 16);
    }
  }
}

// Flying can: shoot it to release a weapon letter
export class Capsule extends Enemy {
  constructor(game, item) {
    super(game, game.cam.x - 30, 100, 30, 20, 1);
    this.item = item;
    this.score = 0;
  }
  update(dt) {
    this.base(dt);
    this.x += 120 * dt;
    this.y = 100 + Math.sin(this.t * 2.4) * 40;
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
    if (this.y > 440 || this.x < this.game.cam.x - 60) this.dead = true;
  }
  draw(ctx) {
    const bob = this.onGround ? Math.sin(this.t * 4) * 2 : 0;
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

export class FloatText {
  constructor(x, y, text, color) {
    Object.assign(this, { x, y, text, color, life: 1.1, dead: false });
  }
  update(dt) {
    this.y -= 30 * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.globalAlpha = Math.min(1, this.life * 2);
    ctx.font = '900 13px "Noto Sans HK", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.cream;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}

// A rescued cat snaps out of the mind control and hops away happily
export class FreedCat {
  constructor(game, sprite, x, y, h) {
    Object.assign(this, { game, sprite, x, y, h, vx: -70 - Math.random() * 60, vy: -320, t: 0, dead: false });
  }
  update(dt) {
    this.t += dt;
    this.vy += 900 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const life = this.life ?? 2.5;
    if (this.y > 300 && this.vy > 0 && this.t < life) { this.y = 300; this.vy = -300; }
    if (this.t > life) this.dead = true;
  }
  draw(ctx) {
    const img = this.game.img[this.sprite];
    const w = (img.width * this.h) / img.height;
    ctx.save();
    ctx.globalAlpha = Math.min(1, ((this.life ?? 2.5) - this.t) * 1.5);
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.sin(this.t * 10) * 0.15);
    if ('filter' in ctx) ctx.filter = 'saturate(0.5) brightness(1.15)';
    ctx.drawImage(img, -w / 2, -this.h, w, this.h);
    ctx.restore();
    if (this.t < 1.6) drawHeart(ctx, this.x + 14, this.y - this.h - 8 - this.t * 20, 12, C.pink);
  }
}

// One-shot sprite animation from the generated fx sheet (muzzle flash, hit spark, explosion).
export class FxAnim {
  constructor(anim, x, y, dur, scale, rot = 0) {
    Object.assign(this, { anim, x, y, dur, scale, rot, t: 0, dead: false });
  }
  update(dt) {
    this.t += dt;
    if (this.t >= this.dur) this.dead = true;
  }
  draw(ctx) {
    const list = frame('fx', this.anim) ? (this.anim === 'boom' ? 4 : 1) : 0;
    if (!list) return;
    const f = frame('fx', this.anim, Math.min(list - 1, Math.floor((this.t / this.dur) * list)));
    if (f) drawFrame(ctx, f, this.x, this.y, this.scale, { anchor: 'center', rot: this.rot });
  }
}

// A defeated hero tumbles backwards off screen before respawning.
export class KnockedOut {
  constructor(f, x, y, facing, scale) {
    Object.assign(this, { f, x, y, facing, scale, vx: -facing * 120, vy: -380, rot: 0, t: 0, dead: false });
  }
  update(dt) {
    this.t += dt;
    this.vy += 1100 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot -= this.facing * dt * 5;
    if (this.t > 1.1) this.dead = true;
  }
  draw(ctx) {
    drawFrame(ctx, this.f, this.x, this.y, this.scale, { flip: this.facing, rot: this.rot, alpha: Math.min(1, (1.1 - this.t) * 2) });
  }
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
