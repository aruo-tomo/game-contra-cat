// Hidden golden cans: one per stage, inside something that looks like scenery (a crate, a lost-property
// box, a sunken chest, a locker). Shoot it a few times and it bursts open; the can inside is worth a life.
// Finding all four (remembered per browser) unlocks the jukebox on the title screen.

import { t } from './i18n.js';
import { C, ink, rrect } from './art.js';
import { sfx } from './audio.js';
import { frame, drawFrame } from './sprites.js';
import { FxAnim, Item, Debris } from './entities.js';
import { options, saveOptions } from './options.js';

// where each stage hides its can; (x, y) is the middle of the bottom of the hiding place
export const SECRETS = {
  1: { x: 1212, y: 184, kind: 'crate' }, // on the high plank before the first bridge
  2: { x: 5205, y: 130, kind: 'box' }, // on the top shelf of the upper ward
  3: { x: 48, y: 4720, kind: 'chest' }, // on the first rock shelf under water
  4: { x: 3765, y: 2220, kind: 'locker' }, // on the first ledge in the lab
};

export const secretsFound = () => (options.secrets || []).length;

export class Secret {
  constructor(game, stage, s) {
    const w = s.kind === 'locker' ? 30 : 34;
    const h = s.kind === 'locker' ? 44 : s.kind === 'chest' ? 26 : 30;
    Object.assign(this, { game, stage, kind: s.kind, x: s.x - w / 2, y: s.y - h, w, h, hp: 3, maxHp: 3, t: Math.random() * 3, flash: 0, dead: false, vx: 0, vy: 0 });
    this.secret = true;
    this.noStomp = true;
    this.score = 0;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  hittable() { return !this.dead; }
  touches() { return false; }
  damage(n, by) {
    if (this.dead) return;
    this.hp -= 1;
    this.flash = 0.08;
    this.shakeT = 0.2;
    sfx.clink();
    if (this.hp > 0) return;
    const g = this.game;
    this.dead = true;
    sfx.boom(false);
    g.effects.push(new FxAnim('explosion', 'boom', this.cx, this.cy, 0.4, 0.4));
    for (let i = 0; i < 4; i++) g.effects.push(new Debris(this.cx, this.cy));
    const it = new Item(g, this.cx - 11, this.y - 10, 'G');
    it.vx = 0;
    it.vy = -260;
    g.items.push(it);
  }
  update(dt) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.shakeT = Math.max(0, (this.shakeT || 0) - dt);
  }
  draw(ctx) {
    const sx = this.shakeT > 0 ? (Math.random() - 0.5) * 3 : 0;
    ctx.save();
    ctx.translate(this.x + sx, this.y);
    const { w, h } = this;
    if (this.kind === 'crate') {
      rrect(ctx, 0, 0, w, h, 2);
      ink(ctx, C.plank, 2.5);
      ctx.beginPath();
      ctx.moveTo(3, 3); ctx.lineTo(w - 3, h - 3); ctx.moveTo(w - 3, 3); ctx.lineTo(3, h - 3);
      ctx.moveTo(0, 8); ctx.lineTo(w, 8); ctx.moveTo(0, h - 8); ctx.lineTo(w, h - 8);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = C.plankDk;
      ctx.stroke();
    } else if (this.kind === 'box') {
      // cardboard lost-property box with a paper label
      rrect(ctx, 0, 4, w, h - 4, 2);
      ink(ctx, '#C9A574', 2.5);
      ctx.beginPath();
      ctx.moveTo(-2, 4); ctx.lineTo(8, -2); ctx.lineTo(w / 2, 4); ctx.lineTo(w - 8, -2); ctx.lineTo(w + 2, 4);
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      rrect(ctx, 6, 12, w - 12, 10, 1);
      ink(ctx, C.cream, 1.2);
      ctx.fillStyle = C.ink;
      ctx.font = '700 6px "Noto Sans HK", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t('secret.lost'), w / 2, 19.5);
    } else if (this.kind === 'chest') {
      rrect(ctx, 0, 6, w, h - 6, 3);
      ink(ctx, '#8A5A3A', 2.5);
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.quadraticCurveTo(w / 2, -6, w, 10);
      ctx.closePath();
      ink(ctx, '#A26B44', 2.5);
      ctx.fillStyle = C.yellowDk;
      ctx.fillRect(w / 2 - 3, 9, 6, 7);
      ctx.strokeStyle = 'rgba(30,30,30,0.5)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(6, 6); ctx.lineTo(6, h); ctx.moveTo(w - 6, 6); ctx.lineTo(w - 6, h);
      ctx.stroke();
      // a little seaweed and a bubble now and then
      if (Math.sin(this.t * 1.7) > 0.96) { ctx.beginPath(); ctx.arc(w / 2 + 2, -4 - (this.t % 1) * 10, 2, 0, Math.PI * 2); ctx.strokeStyle = C.cream; ctx.stroke(); }
    } else {
      // a dented locker with vents
      rrect(ctx, 0, 0, w, h, 2);
      ink(ctx, '#7E9A8C', 2.5);
      ctx.strokeStyle = 'rgba(30,30,30,0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let y = 6; y < 16; y += 3) { ctx.moveTo(7, y); ctx.lineTo(w - 7, y); }
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.fillRect(w - 8, h / 2, 3, 6);
    }
    if (this.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(-2, -2, w + 4, h + 4);
    }
    // a faint golden glint every few seconds: something is in there
    const k = (this.t % 3.2) / 3.2;
    if (k < 0.12) {
      const a = Math.sin((k / 0.12) * Math.PI);
      ctx.translate(w * 0.72, h * 0.3);
      ctx.rotate(k * 8);
      ctx.globalAlpha = a;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? 1.6 : 5.5;
        const an = (i / 8) * Math.PI * 2;
        ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r);
      }
      ctx.closePath();
      ctx.fillStyle = C.yellow;
      ctx.fill();
    }
    ctx.restore();
  }
}

// the golden can pickup: the item can, gilded, with a glow
export function drawGoldCan(ctx, x, y, tm) {
  ctx.save();
  ctx.translate(x, y);
  const r = 15 + Math.sin(tm * 6) * 2;
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r);
  glow.addColorStop(0, 'rgba(242,179,61,0.7)');
  glow.addColorStop(1, 'rgba(242,179,61,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  const f = frame('item', 'can');
  if (f) {
    ctx.filter = 'sepia(1) saturate(5) hue-rotate(-12deg) brightness(1.15)';
    drawFrame(ctx, f, 0, 0, 26 / f.w, { anchor: 'center', rot: Math.sin(tm * 3) * 0.2 });
    ctx.filter = 'none';
  } else {
    rrect(ctx, -11, -8, 22, 16, 5);
    ink(ctx, C.yellow, 2.5);
  }
  ctx.restore();
}

// a hero picks the golden can up
export function collectGold(game, p) {
  const n = game.stage.n;
  p.lives++;
  game.score += 5000;
  sfx.secret();
  game.text(p.cx, p.y - 18, t('secret.got'), C.yellowDk);
  game.flashT = 0.25;
  const found = new Set(options.secrets || []);
  const before = found.size;
  found.add(n);
  options.secrets = [...found].sort();
  saveOptions();
  game.say(t('secret.count', { n: found.size }), 1.8);
  if (found.size === 4 && before < 4) game.say(t('secret.all'), 2.6);
}
