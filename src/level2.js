// Stage 2: 寵物醫院走廊 (pet hospital halls). Side-scrolling like stage 1, under a ceiling:
// gurneys roll over lift shafts, a lift carries you to the upper ward, laser gates and wall lasers
// guard the halls, rats hang out of the vents. Mid-boss: the Head Nurse. Boss: the surgery machine.

import { t } from './i18n.js?v=bad6619';
import { C, mulberry32, rrect, ink } from './art.js?v=bad6619';
import { SPR, frame, drawTiled } from './sprites.js?v=bad6619';
import {
  CEIL, Nurse, ShieldRat, Sprayer, ConeCat, VentRat, LaserGate, BeamTurret, HeadNurse, SurgeonWall,
} from './enemies2.js?v=bad6619';

export const LEVEL_W = 7680;
export const WALL_X = 7520;
const FLOOR = 420;
const UPPER = 196; // floor of the upper ward

export function buildLevel2() {
  const solids = [];
  const ground = (x0, x1, y = 300) => solids.push({ x: x0, y, w: x1 - x0, h: FLOOR - y, kind: 'ground' });
  ground(0, 1500);
  ground(1860, 3800);
  ground(3900, 4500);
  ground(4640, 5400, UPPER); // upper ward, reached by the lift
  ground(5400, LEVEL_W);
  ground(2200, 2420, 250); // a nurses' station counter to hop on
  ground(6020, 6200, 252);
  solids.push({ x: -100, y: -300, w: LEVEL_W + 200, h: CEIL + 300, kind: 'ceil' });
  solids.push({ x: WALL_X, y: -200, w: LEVEL_W - WALL_X, h: 620, kind: 'wall' });

  const oneways = [
    { x: 520, y: 228, w: 120 }, { x: 860, y: 200, w: 110 }, { x: 1180, y: 228, w: 120 },
    { x: 2560, y: 220, w: 120 }, { x: 2860, y: 200, w: 100 },
    { x: 4040, y: 228, w: 110 }, { x: 4300, y: 210, w: 100 },
    { x: 4840, y: 130, w: 110 }, { x: 5150, y: 130, w: 110 },
    { x: 5600, y: 226, w: 110 }, { x: 6420, y: 220, w: 110 }, { x: 6760, y: 226, w: 110 },
  ];

  // moving platforms: gurneys roll across the open lift shafts, a lift goes up to the upper ward
  const movers = [
    // two gurneys across the first shaft, rolling in opposite directions
    { kind: 'gurney', x: 1504, y: 292, w: 78, x0: 1504, x1: 1640, vx: 60, dx: 0, dy: 0 },
    { kind: 'gurney', x: 1782, y: 292, w: 78, x0: 1660, x1: 1782, vx: -60, dx: 0, dy: 0 },
    { kind: 'gurney', x: 3800, y: 292, w: 78, x0: 3802, x1: 3822, vx: 20, dx: 0, dy: 0 },
    { kind: 'lift', x: 4506, y: 300, w: 128, y0: 300, y1: UPPER, vy: -60, wait: 0, dx: 0, dy: 0 },
  ];

  const spawns = [
    { x: 420, t: 'capsule', item: 'S' },
    { x: 660, t: 'rat', at: 640, y: 300 },
    { x: 830, t: 'nurse', at: 880, y: 200 },
    { x: 900, t: 'gate', at: 1060, ph: 0 },
    { x: 1150, t: 'shield', at: 1260, y: 300 },
    { x: 1260, t: 'vent', at: 1330 },
    { x: 1440, t: 'capsule', item: 'M' },
    { x: 1560, t: 'bat', y: 130 }, { x: 1640, t: 'bat', y: 170 },
    { x: 1980, t: 'sprayer', at: 2060, y: 300 },
    { x: 2120, t: 'cone' },
    { x: 2260, t: 'gate', at: 2480, ph: 1.3 },
    { x: 2300, t: 'gunner', at: 2320, y: 250 },
    { x: 2420, t: 'vent', at: 2560 }, { x: 2520, t: 'vent', at: 2700 },
    { x: 2600, t: 'nurse', at: 2620, y: 220 },
    { x: 2700, t: 'capsule', item: 'R' },
    { x: 2760, t: 'shield', at: 2900, y: 300 },
    { camx: 3000, t: 'headnurse' },
    { x: 3780, t: 'capsule', item: 'B' },
    { x: 4000, t: 'cone' },
    { x: 4100, t: 'sniper', at: 4320, y: 210 },
    { x: 4250, t: 'sprayer', at: 4300, y: 300 },
    { x: 4400, t: 'turret', at: 4440, y: 300 },
    { x: 4720, t: 'grenadier', at: 4880, y: UPPER },
    { x: 4900, t: 'beam', at: 5330, y: UPPER - 14 },
    { x: 5000, t: 'ghost', y: 110 },
    { x: 5080, t: 'nurse', at: 5170, y: 130 },
    { x: 5200, t: 'vent', at: 5260 },
    { x: 5450, t: 'capsule', item: 'F' },
    { x: 5560, t: 'gate', at: 5720, ph: 0 }, { x: 5700, t: 'gate', at: 5860, ph: 1.4 },
    { x: 5860, t: 'charger' },
    { x: 6000, t: 'sprayer', at: 6100, y: 252 },
    { x: 6140, t: 'shield', at: 6260, y: 300 },
    { x: 6260, t: 'beam', at: 6600, y: 264 },
    { x: 6380, t: 'cone' }, { x: 6440, t: 'bat', y: 120 },
    { x: 6560, t: 'capsule', item: 'S' },
    { x: 6700, t: 'beam', at: 6980, y: 289 },
    { x: 6820, t: 'nurse', at: 6880, y: 300 }, { x: 6880, t: 'gunner', at: 6960, y: 300 },
    { x: 6950, t: 'vent', at: 7000 },
    { camx: 7040, t: 'surgeon' },
  ];

  // brainwashed runner cats stream in here, but fewer than in the alley: the patients are the cone cats
  const runnerZones = [[200, 1500, 2.4], [1900, 2960, 2.2], [3900, 4500, 2.6], [5450, 6900, 2.3]];

  return {
    width: LEVEL_W,
    solids,
    oneways,
    bridges: [],
    movers,
    spawns,
    runnerZones,
    platforms() { return this.oneways.concat(this.movers); },
  };
}

// gurneys roll back and forth; the lift waits at each end. Riders move with them.
export function updateMovers(level, game, dt) {
  const riders = [...game.players.filter(Boolean), ...game.enemies, ...game.items];
  for (const m of level.movers) {
    const ox = m.x;
    const oy = m.y;
    if (m.x0 != null) { // rolls side to side (gurneys, logs)
      m.x += m.vx * dt;
      if (m.x < m.x0) { m.x = m.x0; m.vx = Math.abs(m.vx); }
      if (m.x > m.x1) { m.x = m.x1; m.vx = -Math.abs(m.vx); }
    } else if (m.wait > 0) {
      m.wait -= dt;
    } else {
      m.y += m.vy * dt;
      if (m.y < m.y1) { m.y = m.y1; m.vy = Math.abs(m.vy); m.wait = 1.2; }
      if (m.y > m.y0) { m.y = m.y0; m.vy = -Math.abs(m.vy); m.wait = 1.2; }
    }
    m.dx = m.x - ox;
    m.dy = m.y - oy;
    for (const r of riders) {
      if (r.onGround && r.groundRef === m && !r.dead) {
        r.x += m.dx;
        r.y = m.y - r.h;
      }
    }
  }
}

function spawn(game, s) {
  const right = game.cam.x + game.W + 20;
  switch (s.t) {
    case 'nurse': game.addEnemy(new Nurse(game, s.at, s.y)); break;
    case 'shield': game.addEnemy(new ShieldRat(game, s.at, s.y)); break;
    case 'sprayer': game.addEnemy(new Sprayer(game, s.at, s.y)); break;
    case 'vent': game.addEnemy(new VentRat(game, s.at)); break;
    case 'gate': game.addEnemy(new LaserGate(game, s.at, s.ph || 0)); break;
    case 'beam': game.addEnemy(new BeamTurret(game, s.at, s.y)); break;
    case 'cone': {
      const top = game.groundTopAt(right + 13);
      if (top != null) game.addEnemy(new ConeCat(game, right, top, -1));
      break;
    }
    case 'headnurse': game.startMidBoss(new HeadNurse(game, s.camx + 460), s.camx, t('say.headnurse')); break;
    case 'surgeon': game.startBoss(new SurgeonWall(game, WALL_X), s.camx, t('say.surgeon'), t('boss.surgeon')); break;
  }
}

// ---------- scenery ----------

let scenery = null;
function buildScenery() {
  const rnd = mulberry32(7);
  const vents = [];
  for (let x = 160; x < LEVEL_W; x += 260 + rnd() * 200) vents.push(x);
  const lamps = [];
  for (let x = 90; x < LEVEL_W; x += 210) lamps.push(x);
  return { vents, lamps };
}

export function drawScenery(ctx, camx, tm, W, H) {
  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, W, H);
  const far = SPR.layers.bg2_far;
  const mid = SPR.layers.bg2_mid;
  if (far && far.img) drawTiled(ctx, far, camx * 0.25, -20, H + 40, W);
  else {
    // tiled ward wall
    ctx.fillStyle = '#DDE5DF';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#C7D2C9';
    ctx.fillRect(0, 170, W, 130);
  }
  if (mid && mid.img) drawTiled(ctx, mid, camx * 0.55, 300 - 140, 140, W);
  ctx.fillStyle = 'rgba(239,234,223,0.3)';
  ctx.fillRect(0, 0, W, 300);
}

let floorPat = null;
function floorPattern(ctx) {
  const g = SPR.layers.floor2;
  if (!g || !g.img) return null;
  if (!floorPat) {
    floorPat = ctx.createPattern(g.img, 'repeat');
    if (floorPat.setTransform) floorPat.setTransform(new DOMMatrix().scale(0.35));
  }
  return floorPat;
}

export function drawLevel(ctx, level, camx, W, tm = 0) {
  if (!scenery) scenery = buildScenery();
  // ceiling with lights and vents (the vent rats pop out of these)
  ctx.fillStyle = '#9DAFA5';
  ctx.fillRect(camx - 2, -10, W + 4, CEIL + 10);
  ctx.fillStyle = '#7E9A8C';
  ctx.fillRect(camx - 2, CEIL - 10, W + 4, 10);
  ctx.beginPath();
  ctx.moveTo(camx - 2, CEIL);
  ctx.lineTo(camx + W + 2, CEIL);
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  for (const x of scenery.lamps) {
    if (x < camx - 80 || x > camx + W + 80) continue;
    // every few lamps one is failing and flickers
    const bad = (x / 210) % 5 === 3;
    const on = !bad || Math.sin(tm * 23 + x) + Math.sin(tm * 7.3) > -0.6;
    if (on) {
      const g = ctx.createLinearGradient(0, CEIL, 0, 300);
      g.addColorStop(0, 'rgba(255,244,200,0.32)');
      g.addColorStop(1, 'rgba(255,244,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 20, CEIL + 4);
      ctx.lineTo(x + 20, CEIL + 4);
      ctx.lineTo(x + 70, 300);
      ctx.lineTo(x - 70, 300);
      ctx.closePath();
      ctx.fill();
    }
    rrect(ctx, x - 22, CEIL - 2, 44, 7, 3);
    ink(ctx, on ? '#FFF6D2' : '#B8B29C', 2);
  }
  for (const x of scenery.vents) {
    if (x < camx - 40 || x > camx + W + 40) continue;
    rrect(ctx, x - 18, CEIL - 9, 36, 8, 2);
    ink(ctx, '#56645D', 1.8);
    ctx.beginPath();
    for (let i = -12; i <= 12; i += 6) { ctx.moveTo(x + i, CEIL - 8); ctx.lineTo(x + i, CEIL - 2); }
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  }

  // open lift shafts are dark below the floor line (the floors are drawn over this)
  ctx.fillStyle = '#2E3833';
  ctx.fillRect(camx - 2, 300, W + 4, 120);
  const pat = floorPattern(ctx);
  for (const s of level.solids) {
    if (s.kind !== 'ground' || s.x > camx + W || s.x + s.w < camx) continue;
    ctx.fillStyle = pat || '#C7D2C9';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    // a polished shine on the tiles just under the edge, and the tile seams
    const a = Math.max(s.x, camx - 10);
    const b = Math.min(s.x + s.w, camx + W + 10);
    const g = ctx.createLinearGradient(0, s.y + 9, 0, s.y + 40);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(a, s.y + 9, b - a, 31);
    ctx.strokeStyle = 'rgba(30,30,30,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = s.x + 32 - ((s.x % 32) + 32) % 32; x < b; x += 32) { if (x < a) continue; ctx.moveTo(x, s.y + 9); ctx.lineTo(x - 6, s.y + 40); }
    ctx.stroke();
    // skirting strip along the top edge
    ctx.fillStyle = '#E9E4D6';
    ctx.fillRect(s.x, s.y, s.w, 7);
    ctx.fillStyle = C.red;
    ctx.fillRect(s.x, s.y + 7, s.w, 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ink;
    ctx.strokeRect(s.x, s.y, s.w, s.h + 10);
  }
  for (const p of level.oneways) {
    if (p.x > camx + W || p.x + p.w < camx) continue;
    drawShelf(ctx, p.x, p.y, p.w);
  }
  for (const m of level.movers) {
    if (m.x > camx + W || m.x + m.w < camx) continue;
    if (m.kind === 'gurney') drawGurney(ctx, m, tm);
    else drawLift(ctx, m);
  }
}

// a metal hospital shelf on brackets, with supplies standing at the back
function drawShelf(ctx, x, y, w) {
  const seed = Math.floor(x * 7 + y);
  // supplies: medicine bottles and boxes (drawn first so feet stand in front of them)
  for (let i = 0, px = x + 8; px < x + w - 14; i++) {
    const k = (seed + i * 37) % 7;
    if (k < 3) {
      const h = 10 + k * 2;
      rrect(ctx, px, y - h, 8, h, 2);
      ink(ctx, ['#F2E4C4', '#CFE1E8', '#E9C6C0'][k], 1.4);
      ctx.fillStyle = C.ink;
      ctx.fillRect(px + 2, y - h - 2, 4, 2);
      px += 12;
    } else if (k < 5) {
      rrect(ctx, px, y - 9, 14, 9, 1);
      ink(ctx, '#EFEADF', 1.4);
      ctx.fillStyle = C.red;
      ctx.fillRect(px + 6, y - 7.5, 2, 6);
      ctx.fillRect(px + 4, y - 5.5, 6, 2);
      px += 18;
    } else px += 14;
  }
  rrect(ctx, x, y, w, 9, 2);
  ink(ctx, '#B7C6BD', 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(x + 3, y + 2, w - 6, 1.5);
  ctx.beginPath();
  for (const bx of [x + 10, x + w - 10]) { ctx.moveTo(bx, y + 9); ctx.lineTo(bx - 6, y + 18); }
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.fillStyle = C.ink;
  for (const bx of [x + 10, x + w - 10]) ctx.fillRect(bx - 1, y + 3, 2, 2);
}

// dust motes drifting slowly through the lamp light (stateless)
const MOTES = Array.from({ length: 22 }, (_, i) => {
  const r = mulberry32(300 + i);
  return { x: r(), y: r(), sp: 4 + r() * 8, ph: r() * 6, s: 0.8 + r() * 1.2 };
});
function drawFront(ctx, level, camx, W, tm) {
  ctx.fillStyle = 'rgba(255,250,225,0.75)';
  for (const m of MOTES) {
    const span = W + 40;
    const x = camx - 20 + ((((m.x * span + tm * m.sp) % span) + span) % span);
    const y = CEIL + 20 + ((m.y * 240 + Math.sin(tm * 0.6 + m.ph) * 14 + tm * 3) % 250);
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(tm * 1.5 + m.ph);
    ctx.beginPath();
    ctx.arc(x, y, m.s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawGurney(ctx, m, tm) {
  const f = frame('gurney', 'body');
  if (f) {
    const h = (f.h * (m.w + 14)) / f.w;
    // the mattress top is ~22% down the art: line it up with the platform surface
    ctx.drawImage(f.img, m.x - 7, m.y - h * 0.2, m.w + 14, h);
    return;
  }
  rrect(ctx, m.x, m.y, m.w, 10, 4);
  ink(ctx, C.cream, 2.5);
  ctx.fillStyle = '#8FA399';
  ctx.fillRect(m.x + 6, m.y + 10, m.w - 12, 6);
  for (const wx of [m.x + 12, m.x + m.w - 12]) {
    ctx.beginPath();
    ctx.arc(wx, m.y + 22, 5, 0, Math.PI * 2);
    ink(ctx, C.ink, 1);
  }
}

function drawLift(ctx, m) {
  // cables up to the ceiling
  ctx.beginPath();
  for (const cx of [m.x + 16, m.x + m.w - 16]) { ctx.moveTo(cx, CEIL); ctx.lineTo(cx, m.y); }
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(30,30,30,0.6)';
  ctx.stroke();
  rrect(ctx, m.x, m.y, m.w, 14, 3);
  ink(ctx, '#9DAFA5', 3);
  ctx.fillStyle = C.yellow;
  for (let x = m.x + 6; x < m.x + m.w - 10; x += 16) ctx.fillRect(x, m.y + 4, 8, 4);
}

export const STAGE2 = {
  n: 2,
  build: buildLevel2,
  wallX: WALL_X,
  update(level, game, dt) { updateMovers(level, game, dt); },
  spawn,
  drawScenery,
  drawLevel,
  drawFront,
  midbossCamx: 3000,
  bossCamx: 7040,
};
