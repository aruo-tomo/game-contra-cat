// Stage 4: 寵物醫院地庫 (pet hospital basement). A steam-and-conveyor corridor, then a freight lift
// down a deep shaft (the drill digger attacks from the shaft walls on the way), then Dr. Rat's lab
// with its specimen pods, and the brainwave spider mech at the end.

import { t } from './i18n.js';
import { C, mulberry32, rrect, ink } from './art.js';
import { SPR, drawTiled } from './sprites.js';
import { sfx, startMusic } from './audio.js';
import { SteamVent, Pod, HypnoCat, FlameRat, TeslaRat, SpiderBot, DrillBoss, SpiderMech } from './enemies4.js';

export const LEVEL_W = 7400;
const SHAFT_X = 2600; // left edge of the lift shaft
const SHAFT_R = 3240; // right edge
const TOP = 300; // corridor floor
const BOTTOM = 2300; // lab floor (bottom of the shaft)
const CEIL_A = 44;
const CEIL_C = BOTTOM - 256;
const HOLD_Y = 1200; // the lift stops here while the drill digger attacks
const BOSS_CAMX = 6760;

export function buildLevel4() {
  const solids = [];
  const ground = (x0, x1, y, h = 120, extra = {}) => solids.push({ x: x0, y, w: x1 - x0, h, kind: 'ground', ...extra });
  // corridor A, with two conveyor belts
  ground(0, 900, TOP);
  ground(900, 1300, TOP, 120, { belt: -70 });
  ground(1300, 1700, TOP);
  ground(1700, 2100, TOP, 120, { belt: 80 });
  ground(2100, SHAFT_X, TOP);
  ground(1450, 1600, 240, 60);
  // the shaft: walls either side, the lab floor at the bottom
  ground(SHAFT_X - 40, SHAFT_X, TOP + 34, BOTTOM - TOP + 100);
  solids.push({ x: SHAFT_R, y: -300, w: 60, h: CEIL_C + 300, kind: 'shaftwall' });
  ground(SHAFT_X, SHAFT_R, BOTTOM);
  // lab corridor C
  ground(SHAFT_R, 4300, BOTTOM);
  ground(4300, 4700, BOTTOM, 120, { belt: -80 });
  ground(4700, 5900, BOTTOM);
  ground(5900, 6300, BOTTOM, 120, { belt: 70 });
  ground(6300, LEVEL_W, BOTTOM);
  ground(5200, 5360, BOTTOM - 60, 60);
  solids.push({ x: LEVEL_W - 40, y: CEIL_C, w: 40, h: 400, kind: 'shaftwall' });
  // ceilings (only stop things going up)
  solids.push({ x: -100, y: -300, w: SHAFT_X + 100, h: CEIL_A + 300, kind: 'ceil' });
  solids.push({ x: SHAFT_R, y: CEIL_C - 300, w: LEVEL_W - SHAFT_R + 100, h: 300, kind: 'ceil' });

  const oneways = [
    { x: 480, y: 220, w: 120 }, { x: 1040, y: 214, w: 110 }, { x: 1880, y: 214, w: 110 }, { x: 2300, y: 220, w: 120 },
    // little ledges on the shaft walls (soldiers wait on them as the lift goes by)
    { x: SHAFT_R - 70, y: 700, w: 70 }, { x: SHAFT_X, y: 900, w: 70 }, { x: SHAFT_R - 70, y: 1500, w: 70 },
    { x: SHAFT_X, y: 1750, w: 70 }, { x: SHAFT_R - 70, y: 2000, w: 70 },
    { x: 3700, y: BOTTOM - 80, w: 110 }, { x: 4900, y: BOTTOM - 86, w: 120 }, { x: 5600, y: BOTTOM - 80, w: 110 },
    { x: 6500, y: BOTTOM - 90, w: 110 },
    // boss arena ledges
    { x: BOSS_CAMX + 60, y: BOTTOM - 100, w: 100 }, { x: BOSS_CAMX + 480, y: BOTTOM - 100, w: 100 },
  ];
  const lift = { kind: 'lift', x: SHAFT_X + 4, y: TOP, w: SHAFT_R - SHAFT_X - 8, dx: 0, dy: 0, moving: false };

  const spawns = [
    { x: 400, t: 'capsule', item: 'S' },
    { x: 640, t: 'rat', at: 620, y: TOP },
    { x: 760, t: 'steam', at: 760, y: TOP, dir: -1, ph: 0 },
    { x: 900, t: 'hypno', y: TOP },
    { x: 1100, t: 'steam', at: 1100, y: CEIL_A, dir: 1, ph: 1 },
    { x: 1200, t: 'pod', at: 1340, y: TOP },
    { x: 1280, t: 'flame', at: 1380, y: TOP },
    { x: 1450, t: 'spider', at: 1500, ceil: CEIL_A },
    { x: 1520, t: 'gunner', at: 1520, y: 240 },
    { x: 1650, t: 'capsule', item: 'M' },
    { x: 1800, t: 'tesla', at: 1900, y: TOP }, { x: 1900, t: 'tesla', at: 2160, y: TOP },
    { x: 1950, t: 'steam', at: 2000, y: CEIL_A, dir: 1, ph: 0.6 },
    { x: 2150, t: 'hypno', y: TOP },
    { x: 2300, t: 'pod', at: 2420, y: TOP },
    { x: 2350, t: 'spider', at: 2400, ceil: CEIL_A }, { x: 2400, t: 'spider', at: 2500, ceil: CEIL_A },
    { x: 2500, t: 'capsule', item: 'R' },
    // the lift ride (triggered as the bottom of the view comes down to them)
    { yb: 760, t: 'rat', at: SHAFT_R - 40, y: 700 },
    { yb: 900, t: 'bat', y: 760, yt: 0 },
    { yb: 960, t: 'grenadier', at: SHAFT_X + 30, y: 900 },
    { yb: HOLD_Y + 80, t: 'drill' },
    { yb: 1560, t: 'sniper', at: SHAFT_R - 40, y: 1500 },
    { yb: 1700, t: 'spider', at: SHAFT_X + 300, ceil: 1500 },
    { yb: 1800, t: 'flame', at: SHAFT_X + 30, y: 1750 },
    { yb: 2060, t: 'tesla', at: SHAFT_R - 40, y: 2000 },
    // the lab
    { x: 3500, t: 'capsule', item: 'L' },
    { x: 3600, t: 'hypno', y: BOTTOM },
    { x: 3700, t: 'pod', at: 3880, y: BOTTOM },
    { x: 3800, t: 'flame', at: 3960, y: BOTTOM },
    { x: 4000, t: 'steam', at: 4100, y: BOTTOM, dir: -1, ph: 0.4 },
    { x: 4150, t: 'spider', at: 4250, ceil: CEIL_C }, { x: 4250, t: 'spider', at: 4400, ceil: CEIL_C },
    { x: 4500, t: 'tesla', at: 4720, y: BOTTOM }, { x: 4600, t: 'tesla', at: 4980, y: BOTTOM },
    { x: 4700, t: 'capsule', item: 'B' },
    { x: 4800, t: 'pod', at: 5060, y: BOTTOM },
    { x: 5000, t: 'hypno', y: BOTTOM },
    { x: 5200, t: 'gunner', at: 5280, y: BOTTOM - 60 },
    { x: 5300, t: 'steam', at: 5450, y: CEIL_C, dir: 1, ph: 0 }, { x: 5400, t: 'steam', at: 5520, y: BOTTOM, dir: -1, ph: 1.6 },
    { x: 5500, t: 'flame', at: 5640, y: BOTTOM - 80 },
    { x: 5700, t: 'capsule', item: 'F' },
    { x: 5800, t: 'hypno', y: BOTTOM }, { x: 5900, t: 'spider', at: 6000, ceil: CEIL_C },
    { x: 6100, t: 'tesla', at: 6220, y: BOTTOM }, { x: 6200, t: 'tesla', at: 6480, y: BOTTOM },
    { x: 6400, t: 'pod', at: 6620, y: BOTTOM },
    { x: 6500, t: 'capsule', item: 'S' },
    { camx: BOSS_CAMX, t: 'spidermech' },
  ];

  return {
    width: LEVEL_W,
    solids,
    oneways,
    bridges: [],
    lift,
    spawns,
    runnerZones: [[200, 2400, 2.6], [3400, 6600, 2.6]],
    camMode: 'A',
    platforms() { return this.oneways.concat([this.lift]); },
  };
}

// ---------- update ----------

function update(level, game, dt) {
  const lift = level.lift;
  const riders = [...game.players.filter(Boolean), ...game.enemies, ...game.items];
  // conveyor belts carry whatever stands on them
  for (const r of riders) {
    if (r.onGround && r.groundRef && r.groundRef.belt && !r.dead) r.x += r.groundRef.belt * dt;
  }
  // the lift sets off once a hero steps on; it waits at the halfway point while the drill digger is alive
  if (!lift.moving && lift.y < BOTTOM && game.players.some((p) => p && p.state === 'alive' && p.onGround && p.groundRef === lift)) {
    lift.moving = true;
    game.say(t('lift.go'), 1.2);
    sfx.charge();
  }
  const oy = lift.y;
  if (lift.moving) {
    let next = Math.min(BOTTOM, lift.y + 75 * dt);
    if (!level.drillDone && lift.y <= HOLD_Y) next = Math.min(next, HOLD_Y); // stop exactly at the halfway point
    lift.y = next;
    if (lift.y >= BOTTOM) lift.moving = false;
  }
  lift.dy = lift.y - oy;
  for (const r of riders) {
    if (r.onGround && r.groundRef === lift && !r.dead) r.y = lift.y - r.h;
  }
  if (level.drill && level.drill.dead) level.drillDone = true;
}

function camera(game, alive, dt) {
  const L = game.level;
  const W = game.W;
  const lift = L.lift;
  const leader = alive.reduce((a, b) => (b.x > a.x ? b : a));
  if (L.camMode === 'A') {
    game.look += (leader.facing * 48 - game.look) * Math.min(1, dt * 1.5);
    const target = Math.min(leader.x - W * 0.45 + Math.max(0, game.look), SHAFT_X);
    if (target > game.cam.x) game.cam.x += Math.min(target - game.cam.x, 420 * dt);
    if (lift.moving) L.camMode = 'shaft';
  }
  if (L.camMode === 'shaft') {
    game.cam.x += Math.min(SHAFT_X - game.cam.x, 420 * dt);
    const ty = Math.max(0, lift.y - TOP);
    if (ty > game.cam.y) game.cam.y += Math.min(ty - game.cam.y, 300 * dt);
    if (!lift.moving && lift.y >= BOTTOM) L.camMode = 'C';
  }
  if (L.camMode === 'C') {
    game.cam.y += Math.min(BOTTOM - TOP - game.cam.y, 300 * dt);
    const maxCam = game.lock && game.lock.x != null ? game.lock.x : L.width - W;
    game.look += (leader.facing * 48 - game.look) * Math.min(1, dt * 1.5);
    const target = Math.min(leader.x - W * 0.45 + Math.max(0, game.look), maxCam);
    if (target > game.cam.x) game.cam.x += Math.min(target - game.cam.x, 420 * dt);
  }
}

function spawn(game, s) {
  const right = game.cam.x + game.W + 20;
  switch (s.t) {
    case 'steam': game.addEnemy(new SteamVent(game, s.at, s.dir < 0 ? s.y - 10 : s.y, s.dir, s.ph || 0)); break;
    case 'pod': game.addEnemy(new Pod(game, s.at, s.y)); break;
    case 'hypno': game.addEnemy(new HypnoCat(game, right, s.y, -1)); break;
    case 'flame': game.addEnemy(new FlameRat(game, s.at, s.y)); break;
    case 'tesla': game.addEnemy(new TeslaRat(game, s.at, s.y)); break;
    case 'spider': game.addEnemy(new SpiderBot(game, s.at, s.ceil)); break;
    case 'drill': {
      const d = new DrillBoss(game, game.level.lift, SHAFT_X, SHAFT_R);
      game.level.drill = d;
      game.startMidBoss(d, game.cam.x, t('say.drill'), game.cam.y);
      break;
    }
    case 'spidermech': {
      game.lock = { x: s.camx };
      const m = new SpiderMech(game, BOTTOM, CEIL_C + 4);
      m.delay = 2.2;
      game.addEnemy(m);
      game.bossTarget = m;
      game.say('WARNING', 2.2, 'warn');
      game.say(t('say.spider'), 1.8);
      sfx.siren();
      startMusic('final');
      break;
    }
  }
}

// ---------- drawing ----------

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

let currentLevel = null;
export function drawScenery(ctx, camx, tm, W, H, camy = 0) {
  ctx.fillStyle = '#C9C3B6';
  ctx.fillRect(0, 0, W, H);
  const shaft = currentLevel && currentLevel.camMode === 'shaft';
  const far = SPR.layers.bg4_far;
  const mid = SPR.layers.bg4_mid;
  const sh = SPR.layers.bg4_shaft;
  if (shaft && sh && sh.img) drawTiledV(ctx, sh, camy * 0.4, W, H);
  else {
    if (far && far.img) drawTiled(ctx, far, camx * 0.25, -10, H + 10, W);
    if (mid && mid.img) drawTiled(ctx, mid, camx * 0.55, 300 - 140, 140, W);
  }
  ctx.fillStyle = 'rgba(239,234,223,0.25)';
  ctx.fillRect(0, 0, W, H);
}

let concrete = null;
function concretePattern(ctx) {
  if (concrete) return concrete;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#A9A699';
  g.fillRect(0, 0, 64, 64);
  const rnd = mulberry32(4);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(30,30,30,0.12)' : 'rgba(255,255,255,0.12)';
    g.fillRect(rnd() * 64, rnd() * 64, 2 + rnd() * 3, 1 + rnd() * 2);
  }
  concrete = ctx.createPattern(c, 'repeat');
  return concrete;
}

function drawCeiling(ctx, x0, x1, y, camx, W) {
  const a = Math.max(x0, camx - 2);
  const b = Math.min(x1, camx + W + 2);
  if (b <= a) return;
  ctx.fillStyle = '#8C8A80';
  ctx.fillRect(a, y - 60, b - a, 60);
  ctx.fillStyle = '#6E6C64';
  ctx.fillRect(a, y - 10, b - a, 10);
  // a pipe along the ceiling
  ctx.fillStyle = '#9B7653';
  ctx.fillRect(a, y - 24, b - a, 8);
  ctx.beginPath();
  ctx.moveTo(a, y);
  ctx.lineTo(b, y);
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
}

export function drawLevel(ctx, level, camx, W, tm = 0, camy = 0) {
  currentLevel = level;
  const H = 360;
  const vis = (s) => s.x < camx + W + 10 && s.x + s.w > camx - 10 && s.y < camy + H + 10 && s.y + s.h > camy - 10;
  if (camy < CEIL_A + 40) drawCeiling(ctx, 0, SHAFT_X, CEIL_A, camx, W);
  if (camy + H > CEIL_C - 60) drawCeiling(ctx, SHAFT_R, LEVEL_W, CEIL_C, camx, W);
  const pat = concretePattern(ctx);
  for (const s of level.solids) {
    if ((s.kind !== 'ground' && s.kind !== 'shaftwall') || !vis(s)) continue;
    ctx.fillStyle = s.kind === 'shaftwall' ? '#7E7B72' : pat;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    drawSlabDetail(ctx, s, camx, W, camy);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ink;
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    if (s.belt) {
      // conveyor: rollers and chevrons moving the way it carries you
      ctx.fillStyle = '#4A4A46';
      ctx.fillRect(s.x, s.y, s.w, 12);
      ctx.save();
      ctx.beginPath();
      ctx.rect(s.x, s.y, s.w, 12);
      ctx.clip();
      ctx.strokeStyle = C.yellow;
      ctx.lineWidth = 3;
      const off = ((tm * s.belt) % 24 + 24) % 24;
      for (let x = s.x - 24 + off; x < s.x + s.w + 24; x += 24) {
        const d = Math.sign(s.belt) * 5;
        ctx.beginPath();
        ctx.moveTo(x - d, s.y + 2);
        ctx.lineTo(x + d, s.y + 6);
        ctx.lineTo(x - d, s.y + 10);
        ctx.stroke();
      }
      ctx.restore();
    } else if (s.kind === 'ground') {
      // hazard stripe along the edge
      ctx.save();
      ctx.beginPath();
      ctx.rect(s.x, s.y, s.w, 6);
      ctx.clip();
      ctx.fillStyle = C.yellow;
      ctx.fillRect(s.x, s.y, s.w, 6);
      ctx.fillStyle = C.ink;
      for (let x = s.x - 12; x < s.x + s.w; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, s.y + 6); ctx.lineTo(x + 6, s.y); ctx.lineTo(x + 12, s.y); ctx.lineTo(x + 6, s.y + 6);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  for (const p of level.oneways) {
    if (!vis({ x: p.x, y: p.y, w: p.w, h: 30 })) continue;
    drawCatwalk(ctx, p);
  }
  // the freight lift: a hazard-striped steel deck on cables
  const L = level.lift;
  if (vis({ x: L.x, y: L.y, w: L.w, h: 30 })) {
    ctx.beginPath();
    for (const cx of [L.x + 30, L.x + L.w - 30]) { ctx.moveTo(cx, Math.max(camy - 10, -400)); ctx.lineTo(cx, L.y); }
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(30,30,30,0.75)';
    ctx.stroke();
    rrect(ctx, L.x, L.y, L.w, 16, 3);
    ink(ctx, '#8C8A80', 3);
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.x, L.y + 10, L.w, 6);
    ctx.clip();
    ctx.fillStyle = C.yellow;
    ctx.fillRect(L.x, L.y + 10, L.w, 6);
    ctx.fillStyle = C.ink;
    for (let x = L.x; x < L.x + L.w; x += 16) { ctx.beginPath(); ctx.moveTo(x, L.y + 16); ctx.lineTo(x + 6, L.y + 10); ctx.lineTo(x + 12, L.y + 10); ctx.lineTo(x + 6, L.y + 16); ctx.fill(); }
    ctx.restore();
  }
}

// concrete slabs: panel seams, bolts, a crack or two, a grime line along the bottom of the edge stripe
function drawSlabDetail(ctx, s, camx, W, camy) {
  if (s.kind !== 'ground' || s.belt) return;
  const a = Math.max(s.x, camx - 10);
  const b = Math.min(s.x + s.w, camx + W + 10);
  if (b <= a) return;
  const g = ctx.createLinearGradient(0, s.y + 6, 0, s.y + 30);
  g.addColorStop(0, 'rgba(30,30,30,0.22)');
  g.addColorStop(1, 'rgba(30,30,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(a, s.y + 6, b - a, 24);
  ctx.strokeStyle = 'rgba(30,30,30,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const x0 = s.x + 80;
  for (let x = x0 + Math.max(0, Math.floor((a - x0) / 80)) * 80; x < b; x += 80) { ctx.moveTo(x, s.y + 8); ctx.lineTo(x, s.y + s.h); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(30,30,30,0.45)';
  for (let x = x0 + Math.max(0, Math.floor((a - x0) / 80)) * 80; x < b; x += 80) {
    for (const dx of [-6, 4]) { ctx.beginPath(); ctx.arc(x + dx + 1, s.y + 16, 1.6, 0, Math.PI * 2); ctx.fill(); }
  }
  const rnd = mulberry32(Math.floor(s.x) + s.y * 3);
  ctx.strokeStyle = 'rgba(30,30,30,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < s.w / 160; i++) {
    let x = s.x + 20 + rnd() * (s.w - 40);
    let y = s.y + 12 + rnd() * 20;
    if (x < a - 30 || x > b + 30) continue;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (rnd() - 0.3) * 10; y += 4 + rnd() * 6; ctx.lineTo(x, y); }
    ctx.stroke();
  }
}

// steel catwalk: a grated deck with a rail lip and a strut down to the wall
function drawCatwalk(ctx, p) {
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const bx of [p.x + 12, p.x + p.w - 12]) { ctx.moveTo(bx, p.y + 9); ctx.lineTo(bx + (bx < p.x + p.w / 2 ? -8 : 8), p.y + 24); }
  ctx.stroke();
  rrect(ctx, p.x, p.y, p.w, 9, 2);
  ink(ctx, '#B9B6AA', 2.5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(p.x + 2, p.y + 2, p.w - 4, 5);
  ctx.clip();
  ctx.fillStyle = 'rgba(30,30,30,0.5)';
  for (let x = p.x + 4; x < p.x + p.w - 4; x += 6) ctx.fillRect(x, p.y + 3, 3, 3);
  ctx.restore();
  ctx.fillStyle = C.yellow;
  ctx.fillRect(p.x + 2, p.y + 7, p.w - 4, 1.5);
}

// ceiling warning lamps that sweep red light, sparks dripping from a broken cable, and steam wisps
function drawFront(ctx, level, camx, W, tm, camy) {
  const H = 360;
  const ceilings = [[0, SHAFT_X, CEIL_A], [SHAFT_R, LEVEL_W, CEIL_C]];
  for (const [x0, x1, cy] of ceilings) {
    if (cy < camy - 40 || cy > camy + H) continue;
    for (let x = x0 + 230; x < x1; x += 460) {
      if (x < camx - 120 || x > camx + W + 120) continue;
      const a = tm * 4 + x;
      const k = (Math.sin(a) + 1) / 2;
      // the sweeping beam
      ctx.save();
      ctx.translate(x, cy + 6);
      ctx.rotate(Math.sin(a) * 0.9);
      const g = ctx.createLinearGradient(0, 0, 0, 200);
      g.addColorStop(0, 'rgba(232,86,75,0.28)');
      g.addColorStop(1, 'rgba(232,86,75,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(50, 200); ctx.lineTo(-50, 200);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x, cy + 4, 6, 0, Math.PI);
      ink(ctx, k > 0.5 ? '#FF7A6E' : C.red, 2);
    }
    // sparks: a burst every couple of seconds from a frayed cable
    for (let x = x0 + 610; x < x1; x += 900) {
      if (x < camx - 60 || x > camx + W + 60) continue;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.quadraticCurveTo(x + 6, cy + 12, x + 2, cy + 20);
      ctx.stroke();
      const ph = (tm + x * 0.013) % 2.6;
      if (ph > 0.7) continue;
      const rnd = mulberry32(Math.floor((tm + x * 0.013) / 2.6) * 31 + x);
      for (let i = 0; i < 8; i++) {
        const vx = (rnd() - 0.5) * 140;
        const vy = -40 - rnd() * 60;
        const t = ph * (0.8 + rnd() * 0.4);
        const sx = x + 2 + vx * t;
        const sy = cy + 20 + vy * t + 450 * t * t;
        ctx.globalAlpha = Math.max(0, 1 - ph / 0.7);
        ctx.fillStyle = rnd() < 0.5 ? '#FFE48A' : '#FFFFFF';
        ctx.fillRect(sx - 1, sy - 1, 2.5, 2.5);
      }
      ctx.globalAlpha = 1;
    }
  }
  // steam wisps rising from floor grates along the corridors
  const floors = [[0, SHAFT_X, TOP], [SHAFT_R, LEVEL_W, BOTTOM]];
  for (const [x0, x1, fy] of floors) {
    if (fy < camy - 20 || fy > camy + H + 40) continue;
    for (let x = x0 + 360; x < x1; x += 700) {
      if (x < camx - 60 || x > camx + W + 60) continue;
      ctx.fillStyle = C.ink;
      ctx.fillRect(x - 12, fy - 2, 24, 3);
      for (let i = 0; i < 4; i++) {
        const ph = ((tm * 0.5 + i / 4) % 1);
        const r = 6 + ph * 16;
        const px = x + Math.sin(tm * 1.5 + i * 2) * 8;
        const py = fy - 6 - ph * 70;
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, `rgba(244,241,232,${0.4 * (1 - ph)})`);
        g.addColorStop(1, 'rgba(244,241,232,0)');
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
}

export const STAGE4 = {
  n: 4,
  build: buildLevel4,
  wallX: LEVEL_W,
  update,
  camera,
  spawn,
  drawScenery,
  drawLevel,
  drawFront,
  midbossCamx: SHAFT_X,
  bossCamx: BOSS_CAMX,
};
