import { C, rrect, ink, drawHeart, drawBadge, makePaperPattern } from './art.js';
import { t, lang, setLang, applyStatic } from './i18n.js';
import { playStory, storyOpen } from './story.js';
import { initAudio, sfx, startMusic, stopMusic, setMuted, isMuted, setVolumes } from './audio.js';
import {
  MouseKeyboardCtl, ClassicKeyboardCtl, GamepadCtl, TouchCtl, bindMouse, pollPads, connectedPads, endInputFrame,
  onKonami, getBindings, setBinding, resetBindings, captureNextKey, keyName, ACTION_LABELS, PROFILE_LABELS,
  tappedAction, bindingConflicts, skillKeyLabel,
} from './input.js';
import { setupTouch } from './touch.js';
import { loadSprites } from './sprites.js';
import { options, saveOptions, ASSIST_MULT, rankFor, saveBest, loadBest } from './options.js';
import { buildLevel1, updateBridges, drawScenery, drawLevel, WALL_X } from './level1.js';
import {
  Player, Runner, Rat, Turret, Bat, Ghost, Elite, BossWall, Capsule, Item,
  Particle, FloatText, FreedCat, Debris, FxAnim, overlap, updateBullet, drawBullet, SKILL_COST,
} from './entities.js';

const W = 640;
const H = 360;
const SCALE = 2;

applyStatic();
document.body.classList.toggle('lang-en', lang === 'en');
document.querySelector('.logo-mark').setAttribute('aria-label', lang === 'en' ? 'Meow-Tra' : '喵斗羅');

const canvas = document.getElementById('game');
canvas.width = W * SCALE;
canvas.height = H * SCALE;
const ctx = canvas.getContext('2d');
bindMouse(canvas, W, H);

const $ = (id) => document.getElementById(id);
const isTouch = window.matchMedia('(pointer: coarse)').matches;
if (isTouch) setupTouch($('touch'));

const FREED_LINES = [t('freed.1'), t('freed.2'), t('freed.3'), t('freed.4')];

// ---------------- game ----------------

class Game {
  constructor(img) {
    this.img = img;
    this.W = W;
    this.H = H;
    this.paper = makePaperPattern(ctx);
    this.state = 'title';
    this.t = 0;
    this.cam = { x: 0 };
    this.players = [];
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.items = [];
    this.effects = [];
    this.level = buildLevel1();
  }

  start(opts) {
    this.opts = opts;
    this.classic = opts.difficulty === 'classic';
    this.startLives = opts.konami ? 30 : this.classic ? 3 : 9;
    this.level = buildLevel1();
    this.cam = { x: 0 };
    this.players = [];
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.items = [];
    this.effects = [];
    this.spawnIdx = 0;
    this.runnerT = 2;
    this.lock = null;
    this.bossTarget = null;
    this.banner = null;
    this.bannerQ = [];
    this.say(t('say.stage1'), 2.0);
    this.say(t('say.go'), 1.0);
    this.hitStop = 0;
    this.look = 0;
    this.deaths = 0;
    this.catSpawned = 0;
    this.score = 0;
    this.freed = 0;
    this.continues = 3;
    this.shakeAmt = 0;
    this.time = 0;
    this.overT = 0;
    opts.ctls.forEach((ctl, i) => this.addPlayer(i, ctl));
    this.state = 'play';
    sfx.start();
    setTimeout(() => { if (this.state === 'play' && !this.bossTarget) startMusic('stage'); }, 900);
  }

  addPlayer(idx, ctl) {
    const chars = (this.opts && this.opts.chars) || [0, 1];
    const p = new Player(this, idx, ctl, chars[idx]);
    this.players[idx] = p;
    if (this.state === 'play') this.text(p.cx, 120, t('say.join', { n: idx + 1 }), C.green);
    return p;
  }

  usesPad(index) {
    return this.players.some((p) => p && p.ctl.kind === 'pad' && p.ctl.index === index);
  }

  // ---- queries used by entities ----
  alivePlayers() { return this.players.filter((p) => p && p.state === 'alive'); }

  nearestPlayer(e) {
    let best = null;
    let d = Infinity;
    for (const p of this.alivePlayers()) {
      const dd = Math.abs(p.cx - e.cx) + Math.abs(p.cy - e.cy) * 0.5;
      if (dd < d) { d = dd; best = p; }
    }
    return best;
  }

  onScreen(e) { return e.x + e.w > this.cam.x && e.x < this.cam.x + W && e.y < H && e.y + e.h > 0; }

  enemiesOnScreen() { return this.enemies.some((e) => e.hittable() && this.onScreen(e)); }

  // nudge the aim toward the nearest enemy within `deg` degrees
  assistAim(p, aim, deg) {
    const a0 = Math.atan2(aim.y, aim.x);
    const lim = (deg * ASSIST_MULT[options.assist] * Math.PI) / 180;
    if (!lim) return aim;
    let best = null;
    let bestD = lim;
    for (const e of this.enemies) {
      if (!e.hittable() || !this.onScreen(e)) continue;
      const dx = e.cx - p.cx;
      const dy = e.cy - p.cy;
      if (Math.hypot(dx, dy) > 420) continue;
      let d = Math.atan2(dy, dx) - a0;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = Math.atan2(dy, dx); }
    }
    return best == null ? aim : { x: Math.cos(best), y: Math.sin(best) };
  }

  // nearest target for auto-aim: in front beats behind, the weapon can only if nothing else is around
  autoAimTarget(p) {
    let best = null;
    let bestScore = Infinity;
    for (const e of this.enemies) {
      if (!e.hittable() || !this.onScreen(e)) continue;
      const dx = e.cx - p.cx;
      const d = Math.hypot(dx, e.cy - p.cy);
      if (d > 420) continue;
      let score = d;
      if (Math.sign(dx) !== p.facing) score *= 1.6;
      if (e instanceof Capsule) score *= 10;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  groundTopAt(x) {
    let top = null;
    for (const s of this.level.solids) {
      if (s.kind === 'ground' && x >= s.x && x <= s.x + s.w && (top == null || s.y < top)) top = s.y;
    }
    return top;
  }

  // ---- effects ----
  text(x, y, s, color) { this.effects.push(new FloatText(x, y, s, color)); }

  puff(x, y, n, colors) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 160;
      this.effects.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 4 + Math.random() * 7, colors[i % colors.length], 0.35 + Math.random() * 0.35));
    }
  }

  shake(a) { if (options.shake) this.shakeAmt = Math.max(this.shakeAmt, a); }

  // brief freeze on heavy hits so they land with weight
  freeze(s) { this.hitStop = Math.max(this.hitStop, s); }

  // banners play one after another; style 'warn' is the flashing boss alarm
  say(text, t, style) {
    const b = { text, t, max: t, style };
    if (this.banner) this.bannerQ.push(b);
    else this.banner = b;
  }

  addEnemy(e) {
    if (e.cat) this.catSpawned++;
    this.enemies.push(e);
    return e;
  }

  // ---- spawning ----
  spawnRunner(dir) {
    const x = dir < 0 ? this.cam.x + W + 10 : this.cam.x - 36;
    const top = this.groundTopAt(x + 13);
    // never drop a runner right at a pit edge, where it would fall in at once
    if (top == null || this.groundTopAt(x + 13 + dir * 70) == null) return;
    this.addEnemy(new Runner(this, x, top - 45, dir));
  }

  spawn(s) {
    const right = this.cam.x + W + 20;
    switch (s.t) {
      case 'capsule': this.addEnemy(new Capsule(this, s.item)); break;
      case 'rat': this.addEnemy(new Rat(this, s.at, s.y)); break;
      case 'turret': this.addEnemy(new Turret(this, s.at, s.y)); break;
      case 'bat': this.addEnemy(new Bat(this, right, s.y)); break;
      case 'ghost': this.addEnemy(new Ghost(this, right, s.y)); break;
      case 'elite': {
        this.lock = { x: s.camx };
        const e = new Elite(this, s.camx + 440);
        e.delay = 1.6;
        this.addEnemy(e);
        this.bossTarget = e;
        this.say('WARNING', 1.6, 'warn');
        this.say(t('say.midboss'), 1.6);
        sfx.siren();
        startMusic('boss');
        break;
      }
      case 'boss': {
        this.lock = { x: s.camx };
        const b = new BossWall(this, WALL_X);
        this.enemies.push(b);
        b.init();
        for (const part of b.parts) part.cool += 2.2;
        this.say('WARNING', 2.2, 'warn');
        sfx.siren();
        this.bossTarget = b.parts.find((p) => p.kind === 'core');
        this.bossTarget.boss = t('boss.fortress');
        this.say(t('say.fortress'), 1.8);
        startMusic('boss');
        break;
      }
    }
  }

  onKill(e, by) {
    this.score += e.score || 0;
    if (by && by.energy != null) by.energy = Math.min(100, by.energy + 8);
    if (e instanceof Capsule) {
      this.items.push(new Item(this, e.cx - 11, e.cy - 11, e.item));
      this.effects.push(new FxAnim('explosion', 'boom', e.cx, e.cy, 0.4, 0.35));
      sfx.boom(false);
      return;
    }
    if (e.cat) {
      this.freed++;
      const h = e instanceof Elite ? 100 : 48;
      this.effects.push(new FreedCat(this, e.cat, e.cx, e.y + e.h, h));
      this.text(e.cx, e.y - 6, FREED_LINES[this.freed % FREED_LINES.length], C.greenDk);
      sfx.meow();
    } else {
      this.effects.push(new FxAnim('explosion', 'boom', e.cx, e.cy, e.kind === 'core' ? 0.8 : 0.55, e.kind === 'core' ? 1.4 : e.kind ? 0.85 : 0.5));
      this.freeze(e.kind === 'core' ? 0.3 : e.kind || e instanceof Turret ? 0.07 : 0);
      sfx.boom(e.kind != null);
      if (e.villain && !e.kind) { this.text(e.cx, e.y - 6, t('squeak'), C.ink); sfx.squeak(); }
      this.shake(e.kind ? 8 : 3);
    }
    if (e instanceof Elite) {
      this.lock = null;
      this.bossTarget = null;
      this.items.push(new Item(this, e.cx, e.y, 'F'));
      this.say(t('say.eliteFreed'), 2);
      this.freeze(0.25);
      this.shake(10);
      startMusic('stage');
    }
  }

  checkGameOver() {
    if (this.players.every((p) => !p || p.state === 'out')) this.overT = 1.4;
  }

  stageClear() {
    if (this.state !== 'play') return;
    this.state = 'clear';
    stopMusic();
    sfx.clear();
    this.parade();
    setTimeout(() => showScreen('clear'), 1600);
    const s = Math.round(this.time);
    const fmt = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
    const freedRate = this.catSpawned ? this.freed / this.catSpawned : 0;
    const rank = rankFor({ time: this.time, deaths: this.deaths, freedRate, score: this.score });
    this.result = { score: this.score, time: s, deaths: this.deaths, freed: this.freed, freedRate, rank };
    const prev = loadBest();
    const isBest = saveBest({ score: this.score, rank, time: s });
    $('clearScore').textContent = String(this.score).padStart(6, '0');
    $('clearFreed').textContent = `${this.freed}／${this.catSpawned}`;
    $('clearTime').textContent = fmt(s);
    $('clearDeaths').textContent = this.deaths;
    $('clearRank').textContent = rank;
    $('clearRank').dataset.rank = rank;
    $('clearBest').textContent = isBest
      ? (prev ? t('clear.newBest', { score: String(prev.score).padStart(6, '0') }) : t('clear.first'))
      : t('clear.best', { score: String(prev.score).padStart(6, '0'), rank: prev.rank });
  }

  // the cats rescued this stage march across the screen
  parade() {
    const sprites = ['cat05', 'cat04', 'cat06', 'cat03'];
    const n = Math.min(14, Math.max(4, this.freed));
    for (let i = 0; i < n; i++) {
      const f = new FreedCat(this, sprites[i % sprites.length], this.cam.x - 30 - i * 40, 300, i % 4 === 3 ? 80 : 44, { happy: true, dir: 1, life: 6 });
      f.t = -i * 0.05;
      this.effects.push(f);
    }
  }

  continueGame() {
    this.continues--;
    for (const p of this.players) {
      if (!p) continue;
      p.lives = this.startLives;
      p.state = 'dead';
      p.respawnT = 0.3;
    }
    this.overT = 0;
    this.state = 'play';
    startMusic(this.bossTarget ? 'boss' : 'stage');
  }

  // ---- update ----
  update(dt) {
    this.t += dt;
    const joined = pollPads();
    if (this.state === 'clear') {
      for (const fx of this.effects) fx.update(dt);
      this.effects = this.effects.filter((f) => !f.dead);
      return joined;
    }
    if (this.state !== 'play') return joined;
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return joined;
    }
    this.time += dt;

    // a second player can drop in at any time: a free gamepad, or (mouse mode) the P2 keyboard keys
    if (!this.players[1]) {
      for (const i of joined) {
        if (!this.usesPad(i)) { this.addPlayer(1, new GamepadCtl(i)); break; }
      }
      const pcKeys = Object.values(getBindings().pc).flat();
      const p2Join = (getBindings().classic2.jump || []).some((c) => !pcKeys.includes(c));
      if (!this.players[1] && this.opts.mode === 'pc' && p2Join && tappedAction('classic2', 'jump')) {
        this.addPlayer(1, new ClassicKeyboardCtl('classic2'));
      }
    }

    for (const p of this.players) if (p) p.update(dt);

    // revive: stand next to a downed partner
    for (const p of this.players) {
      if (!p || p.state !== 'down') continue;
      const helper = this.alivePlayers().find((q) => Math.abs(q.cx - p.cx) < 46 && Math.abs(q.cy - p.cy) < 60);
      p.reviveP = helper ? p.reviveP + dt : Math.max(0, p.reviveP - dt);
      if (p.reviveP >= 1) p.revive();
    }

    // camera only scrolls forward, and stops at boss arenas
    const alive = this.alivePlayers();
    const maxCam = this.lock ? this.lock.x : this.level.width - W;
    if (alive.length) {
      const leader = alive.reduce((a, b) => (b.x > a.x ? b : a));
      // look ahead in the direction the leader faces
      this.look += (leader.facing * 48 - this.look) * Math.min(1, dt * 1.5);
      const target = Math.min(leader.x - W * 0.45 + Math.max(0, this.look), maxCam);
      if (target > this.cam.x) this.cam.x += Math.min(target - this.cam.x, 420 * dt);
    }

    // scripted spawns
    const sp = this.level.spawns;
    while (this.spawnIdx < sp.length) {
      const s = sp[this.spawnIdx];
      const ready = s.camx != null ? this.cam.x >= s.camx - 1 : this.cam.x + W + 30 >= s.x;
      if (!ready) break;
      this.spawn(s);
      this.spawnIdx++;
    }

    // runner streams
    if (!this.lock) {
      const mid = this.cam.x + W / 2;
      const zone = this.level.runnerZones.find(([a, b]) => mid >= a && mid <= b);
      if (zone) {
        this.runnerT -= dt;
        if (this.runnerT <= 0) {
          this.spawnRunner(Math.random() < 0.82 ? -1 : 1);
          this.runnerT = (zone[2] * (0.7 + Math.random() * 0.6)) / (this.players.filter(Boolean).length > 1 ? 1.3 : 1);
        }
      }
    }

    updateBridges(this.level, this.alivePlayers(), dt, (seg) => {
      sfx.bridge();
      this.effects.push(new FxAnim('explosion', 'boom', seg.x + 20, seg.y, 0.45, 0.4));
      for (let i = 0; i < 3; i++) this.effects.push(new Debris(seg.x + 20, seg.y));
    });

    for (const e of this.enemies) e.update(dt);
    for (const b of this.bullets) updateBullet(b, dt);
    for (const b of this.ebullets) updateBullet(b, dt);
    for (const it of this.items) it.update(dt);
    for (const fx of this.effects) fx.update(dt);

    this.collide();

    const off = (b) => b.dead || b.x < this.cam.x - 50 || b.x > this.cam.x + W + 50 || b.y < -80 || b.y > 420 || b.t > 3;
    this.bullets = this.bullets.filter((b) => !off(b));
    this.ebullets = this.ebullets.filter((b) => !off(b));
    this.enemies = this.enemies.filter((e) => !e.dead || (e instanceof BossWall && e.dying > 0));
    this.items = this.items.filter((i) => !i.dead);
    this.effects = this.effects.filter((f) => !f.dead);

    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 30);
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = this.bannerQ.shift() || null;
    }
    if (this.overT > 0) {
      this.overT -= dt;
      if (this.overT <= 0) {
        this.state = 'over';
        stopMusic();
        sfx.gameOver();
        $('overScore').textContent = String(this.score).padStart(6, '0');
        $('btnContinue').hidden = this.continues <= 0;
        $('btnContinue').textContent = t('over.continueN', { n: this.continues });
        showScreen('over');
      }
    }
    return joined;
  }

  collide() {
    for (const b of this.bullets) {
      for (const e of this.enemies) {
        if (!e.hittable() || !circleHit(b, e)) continue;
        if (b.pierce) {
          if (b.pierce.has(e)) continue;
          b.pierce.add(e);
        } else {
          b.dead = true;
        }
        if (b.owner) b.owner.energy = Math.min(100, b.owner.energy + 1);
        e.damage(b.dmg, b.owner);
        this.effects.push(new FxAnim('impact', 'hit', b.x, b.y, 0.16, 0.36, { rot: Math.random() * 6 }));
        if (b.dead) break;
      }
    }
    for (const p of this.alivePlayers()) {
      const box = { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 6 };
      for (const b of this.ebullets) {
        if (b.dead) continue;
        if (p.trySwallow(b)) { b.dead = true; continue; }
        if (!circleHit(b, box)) continue;
        if (p.catnip > 0) { b.dead = true; continue; }
        if (p.inv > 0 || p.dashT > 0) continue;
        b.dead = true;
        this.effects.push(new FxAnim('impact', 'hit', b.x, b.y, 0.18, 0.45, { rot: Math.random() * 6 }));
        p.hurt();
      }
      for (const e of this.enemies) {
        if (!e.touches(box)) continue;
        if (p.catnip > 0 && e.hittable()) e.damage(5, p);
        else p.hurt();
      }
      for (const it of this.items) {
        if (!it.dead && overlap(it, p)) { it.dead = true; p.pickup(it.type); }
      }
    }
  }

  // ---- draw ----
  draw() {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    const sx = (Math.random() - 0.5) * this.shakeAmt;
    const sy = (Math.random() - 0.5) * this.shakeAmt;
    const camx = Math.round(this.cam.x);
    drawScenery(ctx, camx, this.t, W, H);

    ctx.save();
    ctx.translate(-camx + sx, sy);
    drawLevel(ctx, this.level, camx, W);
    for (const e of this.enemies) if (e instanceof BossWall) e.draw(ctx);
    for (const it of this.items) it.draw(ctx);
    for (const e of this.enemies) if (!(e instanceof BossWall) && !e.dead) e.draw(ctx);
    for (const p of this.players) if (p) p.draw(ctx);
    for (const b of this.bullets) drawBullet(ctx, b);
    for (const b of this.ebullets) drawBullet(ctx, b);
    for (const f of this.effects) f.draw(ctx);
    this.drawLockMarks();
    ctx.restore();

    ctx.fillStyle = this.paper;
    ctx.fillRect(0, 0, W, H);
    if (this.state !== 'title') this.drawHud();
  }

  drawLockMarks() {
    for (const p of this.players) {
      if (!p || p.char.id !== 'blaze' || p.skillT <= 0) continue;
      for (const e of p.locks) {
        if (e.dead) continue;
        const r = 16 + Math.sin(this.t * 10) * 2;
        ctx.save();
        ctx.translate(e.cx, e.cy);
        ctx.rotate(this.t * 3);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = C.red;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(r - 5, 0);
          ctx.lineTo(r + 6, 0);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  drawHud() {
    for (let i = 0; i < 2; i++) {
      const p = this.players[i];
      const x = i === 0 ? 8 : W - 8 - 176;
      const y = 8;
      if (!p) {
        if (this.opts && this.opts.mode !== 'classic') {
          rrect(ctx, x, y, 176, 30, 8);
          ctx.setLineDash([5, 4]);
          ctx.fillStyle = 'rgba(239,234,223,0.75)';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = C.ink;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = C.ink;
          ctx.font = '700 10px "Noto Sans HK", sans-serif';
          ctx.textAlign = 'center';
          const k = keyName((getBindings().classic2.jump || [])[0]);
          ctx.fillText(t('hud.p2join', { key: k }), x + 88, y + 19);
        }
        continue;
      }
      rrect(ctx, x, y, 176, 46, 9);
      ctx.fillStyle = 'rgba(239,234,223,0.92)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      // portrait
      const img = this.img[p.char.sprite];
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + 23, y + 23, 17, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#F6D6CF' : '#D5E1DA';
      ctx.fill();
      ctx.clip();
      const ph = 52;
      const pw = (img.width * ph) / img.height;
      ctx.drawImage(img, x + 23 - pw / 2, y + 6, pw, ph);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x + 23, y + 23, 17, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.ink;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = C.ink;
      ctx.font = '900 11px "Noto Sans HK", sans-serif';
      // skill ready: the name line turns into which key to press
      const skillReady = p.energy >= SKILL_COST && p.state === 'alive';
      if (skillReady) ctx.fillStyle = C.redDk;
      ctx.fillText(skillReady ? t('hud.skill', { n: i + 1, key: skillKeyLabel(p.ctl, true) }) : `P${i + 1} ${p.char.name}`, x + 46, y + 15);
      ctx.fillStyle = C.ink;
      for (let h = 0; h < p.maxHp; h++) drawHeart(ctx, x + 52 + h * 14, y + 26, 12, h < p.hp && p.state === 'alive' ? C.red : C.cream);
      ctx.font = '400 11px Bungee, sans-serif';
      ctx.fillText(`×${Math.max(0, p.lives)}`, x + 52 + p.maxHp * 14, y + 30);
      // energy
      const ex = x + 46;
      const ey = y + 35;
      rrect(ctx, ex, ey, 92, 6, 3);
      ctx.fillStyle = C.paper;
      ctx.fill();
      if (p.ctl.kind === 'touch') {
        const btn = document.querySelector('.tbtn[data-k="skill"]');
        if (btn) btn.classList.toggle('ready', skillReady);
      }
      rrect(ctx, ex, ey, 92 * (p.energy / 100), 6, 3);
      // ready: the bar flashes between yellow and red so it's seen out of the corner of the eye
      ctx.fillStyle = skillReady ? (Math.floor(this.t * 5) % 2 ? C.red : C.yellow) : C.yellowDk;
      ctx.fill();
      rrect(ctx, ex, ey, 92, 6, 3);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ex + 46, ey);
      ctx.lineTo(ex + 46, ey + 6);
      ctx.stroke();
      drawBadge(ctx, x + 160, y + 17, 10, p.weapon.type);
      if (p.weapon.lvl > 1) {
        ctx.font = '400 8px Bungee, sans-serif';
        ctx.fillStyle = C.ink;
        ctx.textAlign = 'center';
        ctx.fillText('LV2', x + 160, y + 38);
      }
      const status = { dead: t('hud.dead'), out: t('hud.out'), down: t('hud.down') }[p.state];
      if (status) {
        ctx.fillStyle = 'rgba(30,30,30,0.6)';
        rrect(ctx, x, y, 176, 46, 9);
        ctx.fill();
        ctx.fillStyle = C.cream;
        ctx.font = '900 13px "Noto Sans HK", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(status, x + 88, y + 28);
      }
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = C.ink;
    ctx.font = '400 13px Bungee, sans-serif';
    ctx.fillText(String(this.score).padStart(6, '0'), W / 2, 22);
    ctx.font = '700 10px "Noto Sans HK", sans-serif';
    ctx.fillText(t('hud.freed', { freed: this.freed, total: this.catSpawned }), W / 2, 36);

    const bt = this.bossTarget;
    if (bt && !bt.dead && bt.y > -100) {
      const bw = 240;
      const bx = W / 2 - bw / 2;
      ctx.font = '900 10px "Noto Sans HK", sans-serif';
      ctx.fillText(bt.boss, W / 2, 54);
      rrect(ctx, bx, 59, bw, 9, 4);
      ctx.fillStyle = C.cream;
      ctx.fill();
      rrect(ctx, bx, 59, bw * Math.max(0, bt.hp / bt.maxHp), 9, 4);
      ctx.fillStyle = C.red;
      ctx.fill();
      rrect(ctx, bx, 59, bw, 9, 4);
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
    }

    if (this.banner && this.banner.style === 'warn') {
      const b = this.banner;
      const on = Math.floor(b.t * 6) % 2 === 0;
      ctx.fillStyle = 'rgba(232,86,75,0.18)';
      ctx.fillRect(0, 0, W, H);
      for (const y of [116, 172]) {
        ctx.fillStyle = C.ink;
        ctx.fillRect(0, y, W, 12);
        ctx.fillStyle = C.yellow;
        for (let x = -((this.t * 80) % 24); x < W; x += 24) {
          ctx.beginPath();
          ctx.moveTo(x, y + 12); ctx.lineTo(x + 12, y); ctx.lineTo(x + 20, y); ctx.lineTo(x + 8, y + 12);
          ctx.fill();
        }
      }
      if (on) {
        ctx.font = '400 34px Bungee, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 7;
        ctx.strokeStyle = C.ink;
        ctx.strokeText('WARNING', W / 2, 160);
        ctx.fillStyle = C.red;
        ctx.fillText('WARNING', W / 2, 160);
      }
    } else if (this.banner) {
      const a = Math.min(1, this.banner.t * 2, (this.banner.max - this.banner.t) * 4 + 0.2);
      ctx.globalAlpha = a;
      ctx.font = '900 28px "Noto Sans HK", sans-serif';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 7;
      ctx.strokeStyle = C.ink;
      ctx.strokeText(this.banner.text, W / 2, 150);
      ctx.fillStyle = C.yellow;
      ctx.fillText(this.banner.text, W / 2, 150);
      ctx.globalAlpha = 1;
    }
  }
}

function circleHit(b, r) {
  const nx = Math.max(r.x, Math.min(b.x, r.x + r.w));
  const ny = Math.max(r.y, Math.min(b.y, r.y + r.h));
  return (b.x - nx) ** 2 + (b.y - ny) ** 2 < b.r * b.r;
}

// ---------------- screens & menus ----------------

const screens = ['title', 'pause', 'over', 'clear', 'settings'];
function showScreen(name) {
  for (const s of screens) $(s).hidden = s !== name;
  $('touch').hidden = !(isTouch && name === null && game && game.state === 'play');
  $('btnPause').hidden = name !== null;
  $('btnMute').hidden = name !== null && name !== 'pause';
  const first = name && $(name).querySelector('button');
  if (first && !isTouch) first.focus({ preventScroll: true });
}

const prefs = { mode: options.mode || (isTouch ? 'touch' : 'pc'), difficulty: 'nine', konami: false, char: options.char === 1 ? 1 : 0 };

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3200);
}

const MODE_LABELS = { pc: t('mode.pc'), classic: t('mode.classic'), touch: t('mode.touch') };

function renderPicks() {
  for (const b of document.querySelectorAll('.pick')) {
    const mine = Number(b.dataset.char) === prefs.char;
    b.setAttribute('aria-checked', String(mine));
    b.querySelector('.pick-badge').textContent = mine ? 'P1' : 'P2';
  }
  const best = loadBest();
  $('titleBest').textContent = best ? t('title.best', { score: String(best.score).padStart(6, '0'), rank: best.rank }) : '';
}
document.querySelectorAll('.pick').forEach((b) => b.addEventListener('click', () => {
  prefs.char = Number(b.dataset.char);
  options.char = prefs.char;
  saveOptions();
  renderPicks();
  sfx.meow();
}));

function renderSegments() {
  renderPicks();
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === prefs.mode));
  for (const b of document.querySelectorAll('[data-diff]')) b.setAttribute('aria-pressed', String(b.dataset.diff === prefs.difficulty));
  for (const el of document.querySelectorAll('[data-legend]')) el.hidden = el.dataset.legend !== prefs.mode;
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
}
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.lang !== lang) setLang(b.dataset.lang);
}));

function startGame(players, padIndex = null) {
  initAudio();
  setVolumes(options.music, options.sfx);
  const ctls = [];
  if (padIndex != null) ctls.push(new GamepadCtl(padIndex));
  else if (prefs.mode === 'classic') ctls.push(new ClassicKeyboardCtl('classic1'));
  else if (prefs.mode === 'touch') ctls.push(new TouchCtl());
  else ctls.push(new MouseKeyboardCtl());
  if (players > 1) {
    const pad = connectedPads().find((i) => i !== padIndex);
    if (prefs.mode === 'classic' && padIndex == null) ctls.push(new ClassicKeyboardCtl('classic2'));
    else if (pad != null) ctls.push(new GamepadCtl(pad));
    // no second pad: P2 shares the keyboard with its own keys
    else if (prefs.mode !== 'touch') ctls.push(new ClassicKeyboardCtl('classic2'));
  }
  // P1 plays the chosen cat; P2 always gets the other one
  const chars = [prefs.char, 1 - prefs.char];
  game.start({ ctls, chars, mode: prefs.mode, difficulty: prefs.difficulty, konami: prefs.konami });
  prefs.konami = false;
  showScreen(null);
  // first game with keys or touch and auto-aim on: say what it does
  if (options.autoAim && prefs.mode !== 'pc' && !options.autoAimTipSeen) {
    toast(t('toast.autoaim'));
    options.autoAimTipSeen = true;
    saveOptions();
  }
}

function pauseGame() {
  if (game.state !== 'play') return;
  game.state = 'paused';
  stopMusic();
  showScreen('pause');
}
function resumeGame() {
  if (game.state !== 'paused') return;
  game.state = 'play';
  startMusic(game.bossTarget ? 'boss' : 'stage');
  showScreen(null);
}
function toTitle() {
  stopMusic();
  game.state = 'title';
  renderPicks();
  showScreen('title');
}

// settings: options
function renderOptions() {
  $('optMusic').value = Math.round(options.music * 100);
  $('optSfx').value = Math.round(options.sfx * 100);
  for (const b of document.querySelectorAll('[data-shake]')) b.setAttribute('aria-pressed', String((b.dataset.shake === 'on') === options.shake));
  for (const b of document.querySelectorAll('[data-assist]')) b.setAttribute('aria-pressed', String(b.dataset.assist === options.assist));
  for (const b of document.querySelectorAll('[data-autoaim]')) b.setAttribute('aria-pressed', String((b.dataset.autoaim === 'on') === options.autoAim));
}
function applyOptions() {
  setVolumes(options.music, options.sfx);
  saveOptions();
  renderOptions();
}
$('optMusic').addEventListener('input', (e) => { options.music = e.target.value / 100; applyOptions(); });
$('optSfx').addEventListener('input', (e) => { initAudio(); options.sfx = e.target.value / 100; applyOptions(); sfx.pickup(); });
document.querySelectorAll('[data-shake]').forEach((b) => b.addEventListener('click', () => { options.shake = b.dataset.shake === 'on'; applyOptions(); }));
document.querySelectorAll('[data-assist]').forEach((b) => b.addEventListener('click', () => { options.assist = b.dataset.assist; applyOptions(); }));
document.querySelectorAll('[data-autoaim]').forEach((b) => b.addEventListener('click', () => { options.autoAim = b.dataset.autoaim === 'on'; applyOptions(); }));

// settings: rebinding
let settingsProfile = 'pc';
function renderSettings() {
  const b = getBindings();
  for (const t of document.querySelectorAll('[data-profile]')) t.setAttribute('aria-selected', String(t.dataset.profile === settingsProfile));
  const rows = Object.keys(b[settingsProfile]).map((action) => {
    const codes = b[settingsProfile][action];
    const extra = codes.slice(1).map(keyName).join('、');
    return `<div class="bind-row"><span>${ACTION_LABELS[action]}</span>
      <button type="button" class="key" id="bind-${settingsProfile}-${action}" data-action="${action}">${keyName(codes[0])}</button>
      <small>${extra ? t('set.also') + extra : ''}</small></div>`;
  });
  if (settingsProfile === 'pc') {
    rows.splice(3, 0, `<div class="bind-row"><span>${t('set.aim')}</span><span class="key fixed">${t('set.mouse')}</span><small></small></div>`,
      `<div class="bind-row"><span>${t('set.fire')}</span><span class="key fixed">${t('set.holdLeft')}</span><small></small></div>`);
    rows.push(`<div class="bind-row"><span>${t('set.skillAlt')}</span><span class="key fixed">${t('set.rightBtn')}</span><small></small></div>`);
  }
  $('bindList').innerHTML = rows.join('');
  $('bindTitle').textContent = PROFILE_LABELS[settingsProfile];
  // say when this key set is actually used, and flag clashes
  const scope = {
    pc: ['pc', t('scope.pc')],
    classic1: ['classic', t('scope.classic1')],
    classic2: [null, t('scope.classic2')],
  }[settingsProfile];
  const active = settingsProfile === 'classic2' ? prefs.mode !== 'touch' : prefs.mode === scope[0];
  $('bindScope').innerHTML = t('scope.line', { scope: scope[1] }) + (active ? '' : `<b>${t('scope.unused', { mode: MODE_LABELS[prefs.mode] })}</b>`);
  $('bindScope').classList.toggle('warn', !active);
  const clash = bindingConflicts(settingsProfile);
  for (const [action, msg] of Object.entries(clash)) {
    const row = $(`bind-${settingsProfile}-${action}`);
    if (!row) continue;
    row.classList.add('clash');
    const small = row.parentElement.querySelector('small');
    small.textContent = '⚠ ' + msg;
    small.classList.add('clash-msg');
  }
}

$('bindList').addEventListener('click', (e) => {
  const btn = e.target.closest('button.key');
  if (!btn) return;
  btn.textContent = t('set.pressKey');
  btn.classList.add('listening');
  captureNextKey((code) => {
    if (code) setBinding(settingsProfile, btn.dataset.action, code);
    renderSettings();
  });
});

document.querySelectorAll('[data-profile]').forEach((t) => t.addEventListener('click', () => {
  settingsProfile = t.dataset.profile;
  renderSettings();
}));
$('btnReset').addEventListener('click', () => {
  resetBindings();
  renderSettings();
  toast(t('toast.reset'));
});
$('btnSettingsDone').addEventListener('click', () => showScreen(game.state === 'paused' ? 'pause' : 'title'));

document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  prefs.mode = b.dataset.mode;
  options.mode = prefs.mode;
  saveOptions();
  renderSegments();
  if (!$('settings').hidden) {
    // editing keys for the mode you just picked is the likely next step
    settingsProfile = prefs.mode === 'classic' ? 'classic1' : 'pc';
    renderSettings();
  }
}));
document.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => { prefs.difficulty = b.dataset.diff; renderSegments(); }));
// the first time a game starts the opening story plays (skippable); automated runs skip it unless ?story=1
const storyParam = new URLSearchParams(location.search).get('story');
const wantStory = () => (storyParam === '1' || (storyParam !== '0' && !navigator.webdriver)) && !options.storySeen;
function startWithStory(players, padIndex = null) {
  if (!wantStory()) return startGame(players, padIndex);
  playStory(() => {
    options.storySeen = true;
    saveOptions();
    startGame(players, padIndex);
  });
}
$('btn1p').addEventListener('click', () => startWithStory(1));
$('btn2p').addEventListener('click', () => startWithStory(2));
$('btnStory').addEventListener('click', () => playStory(() => showScreen('title')));
$('btnSettings').addEventListener('click', () => { renderSettings(); renderOptions(); showScreen('settings'); });
$('btnResume').addEventListener('click', resumeGame);
$('btnPauseSettings').addEventListener('click', () => { renderSettings(); renderOptions(); showScreen('settings'); });
$('btnQuit').addEventListener('click', toTitle);
$('btnContinue').addEventListener('click', () => { initAudio(); game.continueGame(); showScreen(null); });
$('btnOverTitle').addEventListener('click', toTitle);
$('btnAgain').addEventListener('click', () => startGame(game.players.filter(Boolean).length));
$('btnClearTitle').addEventListener('click', toTitle);
$('btnPause').addEventListener('click', () => (game.state === 'paused' ? resumeGame() : pauseGame()));
$('btnMute').addEventListener('click', () => {
  initAudio();
  setMuted(!isMuted());
  $('btnMute').setAttribute('aria-pressed', String(isMuted()));
  $('btnMute').textContent = isMuted() ? t('hud.muted') : t('hud.sound');
});

window.addEventListener('keydown', (e) => {
  const isPause = Object.values(getBindings()).some((p) => (p.pause || []).includes(e.code)) || e.code === 'Escape';
  if (!isPause || !$('settings').hidden) return;
  if (game.state === 'play') pauseGame();
  else if (game.state === 'paused') resumeGame();
});

onKonami(() => {
  if (game.state !== 'title') return;
  prefs.konami = true;
  sfx.pickup();
  toast(t('toast.konami'));
});

// ---------------- boot ----------------

let game = null;

function loadImages() {
  const names = ['cat01', 'cat02', 'cat03', 'cat04', 'cat05', 'cat06'];
  return Promise.all(names.map((n) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res([n, im]);
    im.onerror = () => rej(new Error(t('load.fail', { name: n })));
    im.src = `assets/sprites/${n}.png`;
  }))).then((list) => Object.fromEntries(list));
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  let joined = game.update(dt);
  // test hook: run extra simulation steps per frame (window.__fast = 4) for automated playthroughs
  for (let k = 1; k < (window.__fast || 1); k++) joined = joined.concat(game.update(dt));
  if (game.state === 'title' && joined.length && $('settings').hidden && !storyOpen()) startWithStory(1, joined[0]);
  else if (game.state === 'paused' && joined.length) resumeGame();
  else if (game.state === 'play') {
    // pause from a pad's Start button
    for (const p of game.players) if (p && p.input && p.input.pause && p.ctl.kind === 'pad') pauseGame();
  }
  // keep taps made during a hit-stop so they are handled once the game resumes
  if (!(game.hitStop > 0)) endInputFrame();
  game.draw();
  requestAnimationFrame(frame);
}

// loading screen: progress over every sprite image, with a rotating tip while it fills
const TIPS = [
  t('tip.1'), t('tip.2'), t('tip.3'), t('tip.4'),
];
let tipI = 0;
const tipTimer = setInterval(() => { $('loadTip').textContent = TIPS[++tipI % TIPS.length]; }, 2500);
function loadProgress(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  $('loadFill').style.width = `${pct}%`;
  $('loadFill').parentElement.setAttribute('aria-valuenow', String(pct));
  $('loadText').textContent = t('load.text', { pct, done, total });
}

Promise.all([loadImages(), loadSprites(loadProgress), document.fonts ? document.fonts.ready : null]).then(([img]) => {
  clearInterval(tipTimer);
  game = new Game(img);
  window.__game = game;
  renderSegments();
  $('loading').hidden = true;
  showScreen('title');
  requestAnimationFrame(frame);
}).catch((err) => {
  clearInterval(tipTimer);
  $('loadText').textContent = err.message + t('load.reload');
});
