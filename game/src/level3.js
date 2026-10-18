// Stage 3: 大魚缸瀑布 (fish-tank falls). A climb: the camera only scrolls up, falling off the bottom
// of the view is a lost life. It starts under water at the bottom of the tank, climbs the rocks
// beside the filter's waterfall (which pushes you down), fights the pirate captain on the shipwreck
// deck, dives up through the filter chamber, and meets the robot koi on top.

import { t } from './i18n.js';
import { C, mulberry32, rrect, ink } from './art.js';
import { SPR } from './sprites.js';
import { sfx, startMusic } from './audio.js';
import { updateMovers } from './level2.js';
import { BowlCat, Puffer, ScubaRat, Eel, CanRat, PirateCat, RoboKoi } from './enemies3.js';

export const LEVEL_W = 640;
const BOTTOM = 5100; // the tank floor
const PIRATE_FLOOR = 3200;
const KOI_FLOOR = 370;
const FILTER_FLOOR = 1760;
const camFor = (floor) => floor - 270; // camera y that shows a floor 270px down the view

export function buildLevel3() {
  const solids = [];
  const ground = (x0, x1, y, h = 34) => solids.push({ x: x0, y, w: x1 - x0, h, kind: 'ground' });
  ground(0, LEVEL_W, BOTTOM, 120);
  // under water at the bottom of the tank: rock shelves to swim round
  ground(0, 380, 4720, 40);
  ground(260, LEVEL_W, 4440, 40);
  ground(0, 360, 4180, 40);
  // the pirate shipwreck deck (mid-boss); its hatch closes once the fight starts
  ground(0, 430, PIRATE_FLOOR);
  ground(560, LEVEL_W, PIRATE_FLOOR);
  // a resting rock shelf
  ground(0, 430, 2470);
  ground(570, LEVEL_W, 2470);
  // the filter box: you come up into it through the intake on the left
  ground(0, 90, FILTER_FLOOR);
  ground(190, LEVEL_W, FILTER_FLOOR);
  // sponge blocks inside the filter
  ground(0, 440, 1460, 40);
  ground(560, LEVEL_W, 1460, 40);
  ground(160, LEVEL_W, 1200, 40);
  ground(0, 470, 940, 40);
  // the filter lid: the koi's arena
  ground(0, 70, KOI_FLOOR);
  ground(190, LEVEL_W, KOI_FLOOR);

  const L = (x, y, w) => ({ x, y, w });
  const oneways = [
    L(420, 4010, 160),
    L(400, 3920, 130), L(40, 3830, 140), L(470, 3830, 140), L(380, 3740, 90), L(430, 3650, 120),
    L(60, 3560, 120), L(500, 3560, 120), L(450, 3380, 140), L(430, 3290, 130),
    L(40, 3100, 130), L(470, 3100, 130), // deck rails in the arena
    L(440, 3010, 130), L(500, 2920, 120), L(400, 2830, 110), L(470, 2740, 130), L(60, 2650, 140), L(430, 2560, 140),
    L(450, 2380, 140), L(60, 2200, 140), L(180, 2110, 90), L(40, 2020, 130), L(150, 1930, 110), L(60, 1840, 130),
    L(470, 730, 150), L(330, 640, 120), L(190, 550, 120), L(80, 460, 110),
    L(230, 270, 110), L(450, 270, 110), // koi arena ledges
  ];
  // floating bubbles you can stand on for a moment before they pop (in the waterfall)
  const bubbles = [L(300, 3650, 60), L(310, 2650, 60)].map((b) => ({ ...b, kind: 'bubble', state: 'ok', t: 0, back: 0 }));
  // driftwood logs drifting side to side; the low one ferries you across the waterfall
  const movers = [
    { kind: 'log', x: 380, y: 3470, w: 90, x0: 380, x1: 530, vx: 50, dx: 0, dy: 0 },
    { kind: 'log', x: 100, y: 2290, w: 100, x0: 100, x1: 440, vx: -70, dx: 0, dy: 0 },
  ];
  // water: the bottom of the tank, and the filter chamber
  const water = [{ x: 0, y: 4040, w: LEVEL_W, h: 1200 }, { x: 0, y: 760, w: LEVEL_W, h: FILTER_FLOOR - 760 }];
  // currents: the waterfall pushes you down (in the air); the filter's intake pulls you up (under water)
  const currents = [
    { x: 270, w: 100, y: 3290, h: 4040 - 3290, dir: 1 },
    { x: 270, w: 100, y: FILTER_FLOOR + 30, h: 2930 - FILTER_FLOOR - 30, dir: 1 },
    { x: 100, w: 80, y: 1500, h: FILTER_FLOOR - 1500, dir: -1 },
    { x: 520, w: 80, y: 800, h: 400, dir: -1 },
  ];
  // streams of air bubbles: swim through them to refill your air
  const vents = [{ x: 560, y0: BOTTOM, y1: 4780 }, { x: 80, y0: 4720, y1: 4480 }, { x: 300, y0: FILTER_FLOOR, y1: 1500 }, { x: 520, y0: 1460, y1: 1240 }];
  // hatches that shut when a boss fight starts, so nobody falls out of the arena
  const gates = [{ x: 430, y: PIRATE_FLOOR, w: 130, for: 'pirate' }, { x: 70, y: KOI_FLOOR, w: 120, for: 'koi' }];

  const S = (o) => ({ ...o, yt: o.yt ?? (o.y ?? 0) - 70 });
  const spawns = [
    // under water
    S({ t: 'puffer', at: 420, y: 4960 }), S({ t: 'scuba', at: 520, y: BOTTOM }),
    S({ t: 'capsule', item: 'S', yt: 4760 }),
    S({ t: 'bowl', at: 200, y: 4720 }), S({ t: 'eel', side: -1, y: 4600 }), S({ t: 'puffer', at: 150, y: 4580 }),
    S({ t: 'scuba', at: 450, y: 4440 }), S({ t: 'puffer', at: 500, y: 4330 }), S({ t: 'eel', side: 1, y: 4300 }),
    S({ t: 'bowl', at: 150, y: 4180 }),
    // the climb beside the waterfall
    S({ t: 'capsule', item: 'M', yt: 3930 }),
    S({ t: 'rat', at: 90, y: 3830 }), S({ t: 'bat', y: 3720, yt: 3700 }),
    S({ t: 'canrat', at: 560, y: 3560 }), S({ t: 'grenadier', at: 110, y: 3560 }),
    S({ t: 'bowl', at: 500, y: 3380 }), S({ t: 'capsule', item: 'R', yt: 3440 }),
    { camy: camFor(PIRATE_FLOOR), t: 'pirate' },
    S({ t: 'eel', side: 1, y: 2980 }), S({ t: 'scuba', at: 560, y: 2920 }), S({ t: 'puffer', at: 320, y: 2790 }),
    S({ t: 'capsule', item: 'L', yt: 2700 }),
    S({ t: 'canrat', at: 120, y: 2470 }), S({ t: 'gunner', at: 520, y: 2380 }), S({ t: 'ghost', y: 2420, yt: 2360 }),
    S({ t: 'bowl', at: 120, y: 2200 }), S({ t: 'bat', y: 2080, yt: 2100 }), S({ t: 'bat', y: 2040, yt: 2060 }),
    S({ t: 'sniper', at: 80, y: 2020 }), S({ t: 'capsule', item: 'B', yt: 2050 }),
    // the filter chamber
    S({ t: 'eel', side: -1, y: 1600 }), S({ t: 'puffer', at: 300, y: 1360 }), S({ t: 'bowl', at: 250, y: 1460 }),
    S({ t: 'eel', side: 1, y: 1330 }), S({ t: 'scuba', at: 400, y: 1200 }), S({ t: 'capsule', item: 'F', yt: 1300 }),
    S({ t: 'puffer', at: 250, y: 1060 }), S({ t: 'puffer', at: 560, y: 880 }),
    // the top
    S({ t: 'rat', at: 400, y: 640 }), S({ t: 'grenadier', at: 230, y: 550 }), S({ t: 'capsule', item: 'S', yt: 600 }),
    { camy: camFor(KOI_FLOOR), t: 'koi' },
  ];
  // ordered by when they come into view (the game walks the list in order)
  spawns.sort((a, b) => (b.camy ?? b.yt + 30) - (a.camy ?? a.yt + 30));

  return {
    width: LEVEL_W,
    solids,
    oneways,
    bridges: [],
    movers,
    bubbles,
    temps: [],
    water,
    currents,
    vents,
    gates,
    spawns,
    runnerZones: [],
    platforms() {
      return this.oneways.concat(this.movers, this.bubbles.filter((b) => b.state === 'ok'), this.temps);
    },
  };
}

// ---------- effects: bubbles ----------

// one small bubble: rises, wobbles, pops at the surface
class Bubble {
  constructor(game, x, y, r = 2 + Math.random() * 2.5) {
    Object.assign(this, { game, x, y, r, t: 0, dead: false, vy: -40 - Math.random() * 40, seed: Math.random() * 6, life: 0.9 + Math.random() * 0.8 });
    this.bubble = true;
  }
  update(dt) {
    this.t += dt;
    this.y += this.vy * dt;
    this.x += Math.sin(this.t * 6 + this.seed) * 14 * dt;
    if (!this.game.waterAt(this.x, this.y) || this.t > this.life) this.dead = true;
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239,234,223,0.35)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(30,30,30,0.7)';
    ctx.stroke();
  }
}

// Everything that moves under water leaves a trail of bubbles behind it (more on a swim stroke)
function trailBubbles(game, dt) {
  // a light touch: a few at a time, and never more than ~60 on screen
  let n = game.effects.reduce((k, f) => k + (f.bubble ? 1 : 0), 0);
  const add = (x, y, rate) => {
    if (n < 60 && Math.random() < rate * dt && game.waterAt(x, y)) { game.effects.push(new Bubble(game, x + (Math.random() - 0.5) * 6, y)); n++; }
  };
  for (const p of game.alivePlayers()) {
    if (!p.inWater) continue;
    const speed = Math.hypot(p.vx, p.vy);
    // from the helmet, and from behind the kicking legs
    add(p.cx + p.facing * 6, p.y + 6, 1.5 + (p.stroke > 0 ? 8 : 0));
    add(p.cx - p.facing * 16, p.y + p.h * 0.6, speed > 40 ? 5 : 0.8);
  }
  for (const e of game.enemies) {
    if (e.dead || e.isWall || !game.onScreen(e)) continue;
    const moving = Math.abs(e.vx || 0) + Math.abs(e.vy || 0) > 20;
    add(e.cx - (e.facing || -1) * e.w * 0.4, e.cy, moving ? 4 : 0.8);
  }
  for (const b of game.bullets) add(b.x, b.y, 2);
  for (const b of game.ebullets) if (b.kind !== 'bubble') add(b.x, b.y, 3);
  // the air vents' bubble streams
  for (const v of game.level.vents) {
    if (v.y1 > game.cam.y + game.H || v.y0 < game.cam.y) continue;
    if (Math.random() < 9 * dt) { const b = new Bubble(game, v.x + (Math.random() - 0.5) * 16, v.y0 - 4, 2 + Math.random() * 4); b.life = 4; game.effects.push(b); }
  }
}

// ---------- update ----------

function update(level, game, dt) {
  updateMovers(level, game, dt);
  // bubble platforms pop after you stand on them a moment, then come back
  for (const b of level.bubbles) {
    if (b.state === 'ok') {
      const standing = game.players.some((p) => p && p.state === 'alive' && p.onGround && p.groundRef === b);
      b.t = standing ? b.t + dt : Math.max(0, b.t - dt);
      if (b.t > 0.75) { b.state = 'pop'; b.back = 2.6; b.t = 0; sfx.hiss(); }
    } else if ((b.back -= dt) <= 0) b.state = 'ok';
  }
  for (const h of level.temps) h.life -= dt;
  level.temps = level.temps.filter((h) => h.life > 0);
  // currents
  for (const p of game.alivePlayers()) {
    for (const c of level.currents) {
      if (p.cx < c.x || p.cx > c.x + c.w || p.cy < c.y || p.cy > c.y + c.h) continue;
      if (c.dir > 0 && !p.onGround && p.dashT <= 0) p.vy = Math.min(720, p.vy + 1100 * dt);
      if (c.dir < 0) p.vy = Math.max(-230, p.vy - 1000 * dt);
    }
  }
  trailBubbles(game, dt);
}

function closeGate(game, which) {
  for (const g of game.level.gates) {
    if (g.for !== which || g.closed) continue;
    g.closed = true;
    game.level.solids.push({ x: g.x, y: g.y, w: g.w, h: 34, kind: 'ground', gate: true });
    // anyone standing in the hatch is lifted onto it
    for (const p of game.alivePlayers()) if (p.x + p.w > g.x && p.x < g.x + g.w && p.y + p.h > g.y && p.y < g.y + 34) p.y = g.y - p.h;
  }
}

function spawn(game, s) {
  switch (s.t) {
    case 'bowl': game.addEnemy(new BowlCat(game, s.at, s.y)); break;
    case 'puffer': game.addEnemy(new Puffer(game, s.at, s.y)); break;
    case 'scuba': game.addEnemy(new ScubaRat(game, s.at, s.y)); break;
    case 'eel': game.addEnemy(new Eel(game, s.side, s.y)); break;
    case 'canrat': game.addEnemy(new CanRat(game, s.at, s.y)); break;
    case 'pirate': {
      closeGate(game, 'pirate');
      game.startMidBoss(new PirateCat(game, 470, game.cam.y - 120), 0, t('say.pirate'), s.camy);
      break;
    }
    case 'koi': {
      closeGate(game, 'koi');
      game.lock = { y: s.camy };
      const k = new RoboKoi(game, KOI_FLOOR);
      k.delay = 2.2;
      game.addEnemy(k);
      game.bossTarget = k;
      game.say('WARNING', 2.2, 'warn');
      game.say(t('say.koi'), 1.8);
      sfx.siren();
      startMusic('boss');
      break;
    }
  }
}

// ---------- drawing ----------

// a tall layer repeated down the stage, every other copy mirrored top-to-bottom so the seams match
function drawTiledV(ctx, layer, offset, W, H) {
  const h = (layer.h * W) / layer.w;
  const start = Math.floor(offset / h);
  for (let k = start; k * h - offset < H; k++) {
    const y = k * h - offset;
    if (k % 2) {
      ctx.save();
      ctx.translate(0, y + h);
      ctx.scale(1, -1);
      ctx.drawImage(layer.img, 0, 0, W, h);
      ctx.restore();
    } else ctx.drawImage(layer.img, 0, y, W, h);
  }
}

export function drawScenery(ctx, camx, tm, W, H, camy = 0) {
  ctx.fillStyle = '#C7D2C9';
  ctx.fillRect(0, 0, W, H);
  const air = SPR.layers.bg3_air;
  const sea = SPR.layers.bg3_far;
  const off = camy * 0.3;
  if (air && air.img) drawTiledV(ctx, air, off, W, H);
  // under water the underwater layer shows instead
  if (sea && sea.img) {
    for (const w of buildLevel3Water) {
      const top = w.y - camy;
      const bot = w.y + w.h - camy;
      if (bot < 0 || top > H) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, Math.max(0, top), W, Math.min(H, bot) - Math.max(0, top));
      ctx.clip();
      drawTiledV(ctx, sea, off, W, H);
      ctx.restore();
    }
  }
  ctx.fillStyle = 'rgba(239,234,223,0.28)';
  ctx.fillRect(0, 0, W, H);
}
const buildLevel3Water = buildLevel3().water;

let rockPat = null;
function rockPattern(ctx) {
  if (rockPat) return rockPat;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#8E9A90';
  g.fillRect(0, 0, 64, 64);
  const rnd = mulberry32(9);
  for (let i = 0; i < 26; i++) {
    g.beginPath();
    g.ellipse(rnd() * 64, rnd() * 64, 3 + rnd() * 7, 2 + rnd() * 5, rnd() * 3, 0, Math.PI * 2);
    g.fillStyle = ['#7A877D', '#A2AC9F', '#6F7C72', '#B79C7A'][i % 4];
    g.fill();
  }
  rockPat = ctx.createPattern(c, 'repeat');
  return rockPat;
}

function drawCoral(ctx, x, y, w, seed) {
  // a coral shelf: rounded slab with little branches poking up
  rrect(ctx, x, y, w, 9, 4);
  ink(ctx, '#E39A8F', 2.5);
  const rnd = mulberry32(seed);
  ctx.beginPath();
  for (let px = x + 8; px < x + w - 6; px += 14 + rnd() * 10) {
    const h = 5 + rnd() * 7;
    ctx.moveTo(px, y + 1);
    ctx.lineTo(px + (rnd() - 0.5) * 6, y - h);
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.red;
  ctx.stroke();
}

export function drawLevel(ctx, level, camx, W, tm = 0, camy = 0) {
  const H = 360;
  const vis = (y, h = 20) => y + h > camy - 20 && y < camy + H + 20;
  // the waterfall and the intake currents
  for (const c of level.currents) {
    if (!vis(c.y, c.h)) continue;
    const y0 = Math.max(c.y, camy - 10);
    const y1 = Math.min(c.y + c.h, camy + H + 10);
    ctx.fillStyle = c.dir > 0 ? 'rgba(220,232,226,0.45)' : 'rgba(239,234,223,0.18)';
    ctx.fillRect(c.x, y0, c.w, y1 - y0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(c.x, y0, c.w, y1 - y0);
    ctx.clip();
    ctx.strokeStyle = c.dir > 0 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const x = c.x + 6 + i * (c.w / 9);
      const len = 26 + (i % 3) * 10;
      const phase = ((tm * (c.dir > 0 ? 260 : -160) + i * 57) % 120 + 120) % 120;
      ctx.beginPath();
      for (let y = y0 - 120 + phase; y < y1; y += 120) { ctx.moveTo(x, y); ctx.lineTo(x, y + len); }
      ctx.stroke();
    }
    ctx.restore();
  }
  const pat = rockPattern(ctx);
  for (const s of level.solids) {
    if (s.kind !== 'ground' || !vis(s.y, s.h)) continue;
    ctx.fillStyle = s.gate ? '#6F5A44' : pat;
    rrect(ctx, s.x, s.y, s.w, s.h, 6);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    if (s.gate) {
      // a wooden hatch slammed shut
      ctx.beginPath();
      for (let x = s.x + 16; x < s.x + s.w; x += 16) { ctx.moveTo(x, s.y + 2); ctx.lineTo(x, s.y + s.h - 2); }
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // moss along the top
      ctx.fillStyle = '#8DA05A';
      ctx.fillRect(s.x + 3, s.y, s.w - 6, 4);
    }
  }
  level.oneways.forEach((p, i) => { if (vis(p.y)) drawCoral(ctx, p.x, p.y, p.w, i * 7 + 3); });
  for (const b of level.bubbles) {
    if (b.state !== 'ok' || !vis(b.y)) continue;
    const wob = Math.sin(tm * 5 + b.x) * 2 + (b.t > 0 ? Math.sin(tm * 50) * b.t * 3 : 0);
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + 8, b.w / 2 + wob, 14 - wob * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239,234,223,0.55)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x + b.w * 0.3, b.y + 3, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  for (const m of level.movers) {
    if (!vis(m.y)) continue;
    rrect(ctx, m.x, m.y, m.w, 12, 6);
    ink(ctx, '#9B7653', 2.5);
    ctx.beginPath();
    ctx.ellipse(m.x + m.w - 6, m.y + 6, 3, 5, 0, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  for (const h of level.temps) {
    // a harpoon stuck in the tank wall: something to stand on for a few seconds
    ctx.save();
    if (h.life < 1 && Math.floor(tm * 10) % 2) ctx.globalAlpha = 0.5;
    rrect(ctx, h.x, h.y - 2, h.w, 5, 2);
    ink(ctx, '#6F7C75', 2);
    ctx.restore();
  }
}

// drawn over everything: the water itself, with a wavy surface line
function drawFront(ctx, level, camx, W, tm, camy) {
  const H = 360;
  for (const w of level.water) {
    const y0 = Math.max(w.y, camy - 10);
    const y1 = Math.min(w.y + w.h, camy + H + 10);
    if (y1 <= y0) continue;
    ctx.fillStyle = 'rgba(94,127,114,0.22)';
    ctx.fillRect(w.x, y0, w.w, y1 - y0);
    if (w.y > camy - 10 && w.y < camy + H) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, w.y + Math.sin(x * 0.05 + tm * 3) * 2.5);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(30,30,30,0.6)';
      ctx.stroke();
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, w.y + 4 + Math.sin(x * 0.05 + tm * 3 + 1) * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.stroke();
    }
  }
}

export const STAGE3 = {
  n: 3,
  vertical: true,
  build: buildLevel3,
  startCamY: camFor(BOTTOM),
  update,
  spawn,
  drawScenery,
  drawLevel,
  drawFront,
  midbossCamy: camFor(PIRATE_FLOOR),
  bossCamy: camFor(KOI_FLOOR),
};
