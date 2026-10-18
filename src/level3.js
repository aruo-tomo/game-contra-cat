// Stage 3: 大魚缸瀑布 (fish-tank falls). A climb: the camera only scrolls up, falling off the bottom
// of the view is a lost life. It starts under water at the bottom of the tank, climbs the rocks
// beside the filter's waterfall (which pushes you down), fights the pirate captain on the shipwreck
// deck, dives up through the filter chamber, and meets the robot koi on top.

import { t } from './i18n.js';
import { C, mulberry32, rrect, ink } from './art.js';
import { SPR, frame } from './sprites.js';
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
    ripples: [],
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

// a drop of water thrown up by a splash
class Droplet {
  constructor(x, y, vx, vy) { Object.assign(this, { x, y, vx, vy, t: 0, dead: false, life: 0.5 + Math.random() * 0.3 }); }
  update(dt) {
    this.t += dt;
    this.vy += 900 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.t > this.life) this.dead = true;
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 2.2, 3.2, Math.atan2(this.vy, this.vx) + Math.PI / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245,250,247,0.95)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(30,30,30,0.6)';
    ctx.stroke();
  }
}

// a splash where something breaks the surface: a crown of drops and a ripple
function splash(game, x, y, big) {
  const n = big ? 14 : 7;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const sp = (big ? 180 : 120) + Math.random() * 120;
    game.effects.push(new Droplet(x + (Math.random() - 0.5) * 14, y, Math.cos(a) * sp, Math.sin(a) * sp));
  }
  game.level.ripples.push({ x, y, t: 0, life: 0.9 });
  if (big) sfx.hiss();
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
  // splashes and ripples where heroes and enemies break the surface
  for (const r of level.ripples) r.t += dt;
  level.ripples = level.ripples.filter((r) => r.t < r.life);
  for (const e of [...game.alivePlayers(), ...game.enemies]) {
    if (e.dead || e.isWall) continue;
    const wet = !!game.waterAt(e.cx, e.y + e.h * 0.5);
    if (e.wasWet != null && wet !== e.wasWet) {
      const w = level.water.find((q) => e.cx >= q.x && e.cx <= q.x + q.w && Math.abs(q.y - (e.y + e.h * 0.5)) < 40);
      if (w) splash(game, e.cx, w.y, Math.abs(e.vy) > 200);
    }
    e.wasWet = wet;
  }
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

// A tall background repeated down the stage. Only a band of the picture is used (no filter box at the
// top, no water line / pebble floor at the bottom), and its bottom edge cross-fades into its top so the
// copies join without a seam (and nothing is ever drawn upside down).
function seamless(layer, b0, b1) {
  if (layer.seam) return layer.seam;
  const img = layer.img;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const sy = Math.round(ih * b0);
  const sh = Math.round(ih * (b1 - b0));
  const o = Math.round(sh * 0.2);
  const c = document.createElement('canvas');
  c.width = iw;
  c.height = sh - o;
  const g = c.getContext('2d');
  g.drawImage(img, 0, sy, iw, sh - o, 0, 0, iw, sh - o);
  const strip = document.createElement('canvas');
  strip.width = iw;
  strip.height = o;
  const sg = strip.getContext('2d');
  sg.drawImage(img, 0, sy + sh - o, iw, o, 0, 0, iw, o);
  sg.globalCompositeOperation = 'destination-in';
  const grad = sg.createLinearGradient(0, 0, 0, o);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = grad;
  sg.fillRect(0, 0, iw, o);
  g.drawImage(strip, 0, 0);
  layer.seam = c;
  return c;
}

function drawSeam(ctx, seam, offset, W, H) {
  const h = (seam.height * W) / seam.width;
  for (let k = Math.floor(offset / h); k * h - offset < H; k++) ctx.drawImage(seam, 0, k * h - offset, W, h);
}

export function drawScenery(ctx, camx, tm, W, H, camy = 0) {
  ctx.fillStyle = '#C7D2C9';
  ctx.fillRect(0, 0, W, H);
  const air = SPR.layers.bg3_air;
  const sea = SPR.layers.bg3_far;
  const off = camy * 0.3;
  if (air && air.img) drawSeam(ctx, seamless(air, 0.14, 0.7), off, W, H);
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
      drawSeam(ctx, seamless(sea, 0.06, 0.74), off, W, H);
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
  const art = SPR.layers.rock3;
  if (art && art.img) {
    rockPat = ctx.createPattern(art.img, 'repeat');
    if (rockPat.setTransform) rockPat.setTransform(new DOMMatrix().scale(0.4));
    return rockPat;
  }
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
  return ctx.createPattern(c, 'repeat');
}

// a rocky coral ledge: the generated piece nearest in width, stretched to fit; its flat top is the platform
function drawLedge(ctx, x, y, w, seed) {
  const long = frame('plat3', 'long');
  const short = frame('plat3', 'short');
  const f = long && short ? (w > 125 ? long : short) : null;
  if (f) {
    const lw = w + 16;
    const hk = Math.min(lw / f.w, 0.5); // stretched to the ledge's width, but never deeper than this
    const top = f.top ?? 0.3; // how far down the art its flat walkable top is
    ctx.drawImage(f.img, x - 8, y - f.h * hk * top, lw, f.h * hk);
    return;
  }
  rrect(ctx, x, y, w, 12, 5);
  ink(ctx, '#9AA394', 2.5);
  ctx.fillStyle = '#8DA05A';
  ctx.fillRect(x + 3, y, w - 6, 3);
  const rnd = mulberry32(seed);
  ctx.beginPath();
  for (let px = x + 10; px < x + w - 8; px += 18 + rnd() * 14) {
    const h = 5 + rnd() * 6;
    ctx.moveTo(px, y + 1);
    ctx.lineTo(px + (rnd() - 0.5) * 5, y - h);
    ctx.moveTo(px, y - h * 0.6);
    ctx.lineTo(px + 4, y - h * 0.9);
  }
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.red;
  ctx.stroke();
}

// the waterfall (pushes down) or the filter intake (pulls up)
function drawCurrent(ctx, c, level, tm, camy, H) {
  const y0 = Math.max(c.y, camy - 10);
  const y1 = Math.min(c.y + c.h, camy + H + 10);
  if (y1 <= y0) return;
  if (c.dir > 0) {
    // a sheet of falling water: wobbling edges, streaks at three speeds
    const edge = (side, y) => c.x + (side > 0 ? c.w : 0) + Math.sin(y * 0.05 + tm * 6 + side) * 3;
    ctx.beginPath();
    for (let y = y0; y <= y1; y += 8) ctx.lineTo(edge(-1, y), y);
    for (let y = y1; y >= y0; y -= 8) ctx.lineTo(edge(1, y), y);
    ctx.closePath();
    const grad = ctx.createLinearGradient(c.x, 0, c.x + c.w, 0);
    grad.addColorStop(0, 'rgba(206,224,216,0.55)');
    grad.addColorStop(0.5, 'rgba(239,244,240,0.7)');
    grad.addColorStop(1, 'rgba(206,224,216,0.55)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(30,30,30,0.45)';
    ctx.stroke();
    ctx.save();
    ctx.clip();
    for (const [speed, alpha, width, gap] of [[180, 0.35, 5, 150], [300, 0.6, 2.5, 110], [460, 0.9, 1.5, 90]]) {
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const x = c.x + 8 + i * ((c.w - 16) / 6) + Math.sin(i * 3 + speed) * 4;
        const phase = ((tm * speed + i * 61 + speed) % gap + gap) % gap;
        for (let y = y0 - gap + phase; y < y1; y += gap) { ctx.moveTo(x, y); ctx.lineTo(x, y + gap * 0.45); }
      }
      ctx.stroke();
    }
    ctx.restore();
    // foam where the falling water hits a ledge or the pool below
    const tops = [...level.oneways, ...level.solids.filter((s) => s.kind === 'ground')]
      .filter((q) => q.x < c.x + c.w && q.x + q.w > c.x && q.y > c.y && q.y < c.y + c.h + 4 && q.y > camy - 20 && q.y < camy + H + 20)
      .map((q) => q.y);
    for (const w of level.water) if (Math.abs(w.y - (c.y + c.h)) < 6) tops.push(w.y);
    for (const ty of tops) drawFoam(ctx, c.x + c.w / 2, ty, c.w * 0.6, tm);
  } else {
    // the intake: water swirling upward
    ctx.save();
    ctx.beginPath();
    ctx.rect(c.x, y0, c.w, y1 - y0);
    ctx.clip();
    ctx.fillStyle = 'rgba(239,234,223,0.12)';
    ctx.fillRect(c.x, y0, c.w, y1 - y0);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const phase = ((tm * 140 + i * 40) % 160 + 160) % 160;
      for (let y = y1 + 20 - phase; y > y0 - 60; y -= 160) {
        ctx.beginPath();
        const cx = c.x + c.w / 2 + Math.sin(y * 0.04 + i * 1.6) * (c.w * 0.3);
        ctx.moveTo(cx - 10, y + 10);
        ctx.quadraticCurveTo(cx, y - 6, cx + 10, y + 10);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function drawFoam(ctx, x, y, w, tm) {
  for (let i = 0; i < 9; i++) {
    const k = i / 8 - 0.5;
    const bob = Math.sin(tm * 9 + i * 1.7) * 2.5;
    const r = 5 + ((i * 7) % 4) + Math.sin(tm * 6 + i) * 1.5;
    ctx.beginPath();
    ctx.arc(x + k * w, y - 3 + bob - Math.abs(k) * -4, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250,250,245,0.9)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(30,30,30,0.35)';
    ctx.stroke();
  }
  // spray drops thrown up and out
  for (let i = 0; i < 6; i++) {
    const ph = (tm * 1.6 + i * 0.37) % 1;
    const dir = i % 2 ? 1 : -1;
    const px = x + dir * (w * 0.35 + ph * 22);
    const py = y - 6 - Math.sin(ph * Math.PI) * 16;
    ctx.beginPath();
    ctx.arc(px, py, 1.8 * (1 - ph) + 0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
  }
}

function drawBubblePlatform(ctx, b, tm) {
  const wob = Math.sin(tm * 5 + b.x) * 2 + (b.t > 0 ? Math.sin(tm * 50) * b.t * 3 : 0);
  const cx = b.x + b.w / 2;
  const cy = b.y + 9;
  const f = frame('plat3', 'bubble');
  if (f) {
    const w = b.w + 18 + wob * 2;
    const h = (f.h * w) / f.w - wob;
    ctx.drawImage(f.img, cx - w / 2, b.y - 6, w, h);
    return;
  }
  const g = ctx.createRadialGradient(cx - b.w * 0.2, cy - 6, 2, cx, cy, b.w * 0.6);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.5, 'rgba(220,234,228,0.5)');
  g.addColorStop(1, 'rgba(160,190,178,0.55)');
  ctx.beginPath();
  ctx.ellipse(cx, cy, b.w / 2 + wob, 15 - wob * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx - b.w * 0.18, cy - 7, b.w * 0.16, 3, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

// a driftwood raft hung on two ropes from a cable that runs along its path
function drawRaft(ctx, m, tm) {
  const railY = m.y - 70;
  ctx.beginPath();
  ctx.moveTo(m.x0 - 10, railY);
  ctx.lineTo(m.x1 + m.w + 10, railY);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(30,30,30,0.7)';
  ctx.stroke();
  for (const ex of [m.x0 - 10, m.x1 + m.w + 10]) {
    ctx.beginPath();
    ctx.arc(ex, railY, 4, 0, Math.PI * 2);
    ink(ctx, '#7A6E62', 1.5);
  }
  const f = frame('plat3', 'raft');
  if (f) {
    const w = m.w + 14;
    const h = (f.h * w) / f.w;
    // the art includes its ropes going up: line its log deck up with the platform top
    const deck = f.top ?? 0.62;
    ctx.drawImage(f.img, m.x - 7, m.y - h * deck, w, h);
    // carry the art's two ropes (at 12% and 86% of its width) on up to the cable
    ctx.beginPath();
    for (const k of [0.125, 0.855]) { const rx = m.x - 7 + w * k; ctx.moveTo(rx, m.y - h * deck + 2); ctx.lineTo(rx, railY); }
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#D9A441';
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  for (const rx of [m.x + 8, m.x + m.w - 8]) { ctx.moveTo(rx, m.y); ctx.lineTo(rx, railY); }
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#7A5A3C';
  ctx.stroke();
  for (let i = 0; i < 2; i++) {
    rrect(ctx, m.x, m.y + i * 7, m.w, 8, 4);
    ink(ctx, i ? '#8A6C4E' : '#9B7B5A', 2);
  }
  ctx.beginPath();
  for (let x = m.x + 10; x < m.x + m.w - 6; x += 16) { ctx.moveTo(x, m.y + 3); ctx.lineTo(x + 8, m.y + 3); }
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawLevel(ctx, level, camx, W, tm = 0, camy = 0) {
  const H = 360;
  const vis = (y, h = 20) => y + h > camy - 20 && y < camy + H + 20;
  for (const c of level.currents) if (vis(c.y, c.h)) drawCurrent(ctx, c, level, tm, camy, H);
  const pat = rockPattern(ctx);
  for (const s of level.solids) {
    if (s.kind !== 'ground' || !vis(s.y, s.h)) continue;
    ctx.fillStyle = s.gate ? '#6F5A44' : pat;
    rrect(ctx, s.x, s.y, s.w, s.h, 6);
    ctx.fill();
    // shade toward the bottom so the rock has some weight
    const sh = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
    sh.addColorStop(0, 'rgba(255,255,255,0.08)');
    sh.addColorStop(1, 'rgba(30,30,30,0.25)');
    ctx.fillStyle = sh;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    if (s.gate) {
      ctx.beginPath();
      for (let x = s.x + 16; x < s.x + s.w; x += 16) { ctx.moveTo(x, s.y + 2); ctx.lineTo(x, s.y + s.h - 2); }
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // a ragged moss edge along the top
      ctx.beginPath();
      ctx.moveTo(s.x + 3, s.y);
      for (let x = s.x + 3; x < s.x + s.w - 3; x += 6) ctx.lineTo(x + 3, s.y + 3 + ((x * 7) % 5));
      ctx.lineTo(s.x + s.w - 3, s.y);
      ctx.closePath();
      ctx.fillStyle = '#8DA05A';
      ctx.fill();
    }
  }
  level.oneways.forEach((p, i) => { if (vis(p.y)) drawLedge(ctx, p.x, p.y, p.w, i * 7 + 3); });
  for (const b of level.bubbles) if (b.state === 'ok' && vis(b.y)) drawBubblePlatform(ctx, b, tm);
  for (const m of level.movers) if (vis(m.y, 80)) drawRaft(ctx, m, tm);
  const harp = frame('ashot', 'harpoon');
  for (const h of level.temps) {
    // a harpoon stuck in the tank wall: something to stand on for a few seconds
    ctx.save();
    if (h.life < 1 && Math.floor(tm * 10) % 2) ctx.globalAlpha = 0.5;
    if (harp) {
      const w = h.w + 10;
      ctx.translate(h.left ? h.x + w / 2 - 6 : h.x + w / 2 + 6, h.y + 1);
      if (h.left) ctx.scale(-1, 1); // the barbed tip is buried in the wall
      ctx.drawImage(harp.img, -w / 2, -(harp.h * w) / harp.w / 2, w, (harp.h * w) / harp.w);
    } else {
      rrect(ctx, h.x, h.y - 2, h.w, 5, 2);
      ink(ctx, '#6F7C75', 2);
    }
    ctx.restore();
  }
}

// drawn over everything: the water itself — darker with depth, light rays and moving caustic light
// under the surface, a bright wavy surface with foam glints, ripples and splashes
function drawFront(ctx, level, camx, W, tm, camy) {
  const H = 360;
  for (const w of level.water) {
    const y0 = Math.max(w.y, camy - 10);
    const y1 = Math.min(w.y + w.h, camy + H + 10);
    if (y1 <= y0) continue;
    const grad = ctx.createLinearGradient(0, w.y, 0, w.y + 420);
    grad.addColorStop(0, 'rgba(120,160,146,0.16)');
    grad.addColorStop(1, 'rgba(52,84,74,0.34)');
    ctx.fillStyle = grad;
    ctx.fillRect(w.x, y0, w.w, y1 - y0);
    if (w.y > camy - 200 && w.y < camy + H + 10) {
      // light rays slanting down from the surface, swaying
      ctx.save();
      ctx.beginPath();
      ctx.rect(w.x, w.y, w.w, Math.min(w.h, 260));
      ctx.clip();
      for (let i = 0; i < 5; i++) {
        const x = 40 + i * 140 + Math.sin(tm * 0.6 + i * 2) * 30;
        const g = ctx.createLinearGradient(0, w.y, 0, w.y + 230);
        g.addColorStop(0, 'rgba(255,250,230,0.22)');
        g.addColorStop(1, 'rgba(255,250,230,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, w.y);
        ctx.lineTo(x + 34, w.y);
        ctx.lineTo(x + 80, w.y + 240);
        ctx.lineTo(x + 20, w.y + 240);
        ctx.closePath();
        ctx.fill();
      }
      // caustics: a net of thin bright wavy lines just under the surface
      ctx.strokeStyle = 'rgba(255,255,240,0.25)';
      ctx.lineWidth = 1.3;
      for (let r = 0; r < 6; r++) {
        const yy = w.y + 18 + r * 22;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 10) ctx.lineTo(x, yy + Math.sin(x * 0.06 + tm * 2 + r) * 4 + Math.sin(x * 0.13 - tm * 1.3) * 2);
        ctx.globalAlpha = 1 - r / 6;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      // the surface: a light band above the wave line, then the ink line and moving glints
      const wave = (x, k = 0) => w.y + Math.sin(x * 0.045 + tm * 2.6 + k) * 2.2 + Math.sin(x * 0.11 - tm * 1.7 + k) * 1.2;
      ctx.beginPath();
      ctx.moveTo(0, w.y + 10);
      for (let x = 0; x <= W; x += 6) ctx.lineTo(x, wave(x));
      ctx.lineTo(W, w.y + 10);
      ctx.closePath();
      ctx.fillStyle = 'rgba(232,242,236,0.45)';
      ctx.fill();
      ctx.beginPath();
      for (let x = 0; x <= W; x += 6) ctx.lineTo(x, wave(x));
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(30,30,30,0.7)';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const x = ((i * 53 + tm * 30) % (W + 40)) - 20;
        ctx.beginPath();
        ctx.moveTo(x, wave(x, 0.4) + 4);
        ctx.lineTo(x + 10 + (i % 3) * 4, wave(x + 10, 0.4) + 4);
        ctx.stroke();
      }
    }
  }
  for (const r of level.ripples) {
    const k = r.t / r.life;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y + 1, 8 + k * 46, 2 + k * 5, 0, 0, Math.PI * 2);
    ctx.lineWidth = 2 * (1 - k) + 0.5;
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
    ctx.stroke();
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
