// Stage 1: 後巷貓草叢 (back-alley catnip jungle). Geometry, spawn script and scenery.

import { t } from './i18n.js?v=bad6619';
import { C, mulberry32, rrect, ink } from './art.js?v=bad6619';
import { SPR, drawTiled } from './sprites.js?v=bad6619';

export const LEVEL_W = 7040;
export const WALL_X = 6880;
const FLOOR = 420; // bottom of the ground blocks (below the screen)

export function buildLevel1() {
  const solids = [];
  const ground = (x0, x1, y = 300) => solids.push({ x: x0, y, w: x1 - x0, h: FLOOR - y, kind: 'ground' });
  ground(0, 1440);
  ground(1760, 2600);
  ground(2680, 4040);
  ground(4140, 5600);
  ground(5800, LEVEL_W);
  // raised ledges are drawn after the base ground so they sit in front
  ground(2000, 2300, 240);
  ground(4500, 4800, 250);
  ground(4800, 5000, 200);
  solids.push({ x: WALL_X, y: -200, w: LEVEL_W - WALL_X, h: 620, kind: 'wall' });

  const oneways = [
    { x: 420, y: 228, w: 120 }, { x: 700, y: 184, w: 140 }, { x: 980, y: 228, w: 120 },
    { x: 1140, y: 184, w: 100 },
    { x: 2380, y: 220, w: 110 }, { x: 2860, y: 228, w: 120 }, { x: 3080, y: 184, w: 120 },
    { x: 3420, y: 220, w: 110 }, { x: 3780, y: 220, w: 110 },
    { x: 4060, y: 250, w: 60 },
    { x: 5180, y: 220, w: 120 },
    { x: 6100, y: 228, w: 120 }, { x: 6420, y: 200, w: 120 }, { x: 6620, y: 230, w: 100 },
  ];

  // Bridges collapse plank by plank once someone steps on, as in the original stage 1.
  const bridges = [
    { x: 1440, y: 300, n: 8 },
    { x: 5600, y: 300, n: 5 },
  ].map((b) => ({
    ...b,
    triggered: false,
    t: 0,
    segs: Array.from({ length: b.n }, (_, i) => ({ x: b.x + i * 40, y: b.y, w: 40, state: 'ok', vy: 0, rot: 0 })),
  }));

  // x = trigger when the right edge of the view reaches it; camx = trigger when the camera reaches it.
  const spawns = [
    { x: 520, t: 'capsule', item: 'S' },
    { x: 660, t: 'rat', at: 640, y: 300 },
    { x: 780, t: 'sniper', at: 760, y: 184 },
    { x: 1000, t: 'charger' },
    { x: 1200, t: 'turret', at: 1200, y: 300 },
    { x: 1260, t: 'rat', at: 1180, y: 184 },
    { x: 1700, t: 'capsule', item: 'M' },
    { x: 1950, t: 'bat', y: 120 }, { x: 2010, t: 'bat', y: 170 },
    { x: 2140, t: 'gunner', at: 2120, y: 240 },
    { x: 2290, t: 'turret', at: 2250, y: 240 },
    { x: 2440, t: 'grenadier', at: 2420, y: 220 },
    { x: 2700, t: 'capsule', item: 'R' },
    { x: 2800, t: 'bat', y: 110 }, { x: 2870, t: 'bat', y: 150 },
    { x: 2930, t: 'sniper', at: 2900, y: 228 },
    { x: 3000, t: 'charger' },
    { x: 3150, t: 'capsule', item: 'L' },
    { x: 3260, t: 'turret', at: 3240, y: 300 },
    { camx: 3300, t: 'elite' },
    { x: 4200, t: 'capsule', item: 'B' },
    { x: 4380, t: 'ghost', y: 150 }, { x: 4660, t: 'ghost', y: 120 },
    { x: 4700, t: 'grenadier', at: 4650, y: 250 },
    { x: 4820, t: 'capsule', item: 'F' },
    { x: 4920, t: 'turret', at: 4900, y: 200 },
    { x: 5060, t: 'ghost', y: 160 },
    { x: 5150, t: 'bat', y: 120 }, { x: 5250, t: 'bat', y: 160 },
    { x: 5300, t: 'gunner', at: 5230, y: 220 },
    { x: 5500, t: 'turret', at: 5480, y: 300 },
    { x: 5900, t: 'capsule', item: 'S' },
    { x: 6150, t: 'rat', at: 6140, y: 228 },
    { x: 6200, t: 'charger' },
    { x: 6260, t: 'turret', at: 6250, y: 300 },
    { x: 6400, t: 'bat', y: 120 },
    { x: 6480, t: 'rat', at: 6460, y: 200 },
    { camx: 6400, t: 'boss' },
  ];

  // Brainwashed runner cats (05) stream in while the camera is inside these ranges: [from, to, seconds]
  const runnerZones = [[200, 1440, 1.8], [1760, 2600, 1.5], [2680, 3300, 1.4], [4140, 5600, 1.9], [5800, 6400, 1.3]];

  return {
    width: LEVEL_W,
    solids,
    oneways,
    bridges,
    spawns,
    runnerZones,
    platforms() {
      const out = this.oneways.slice();
      for (const b of this.bridges) for (const s of b.segs) if (s.state !== 'fall') out.push(s);
      return out;
    },
  };
}

export function updateBridges(level, players, dt, onCrumble) {
  for (const b of level.bridges) {
    if (!b.triggered && players.some((p) => p.state === 'alive' && p.x + p.w > b.x + 10 && p.x < b.x + b.n * 40)) {
      b.triggered = true;
    }
    if (!b.triggered) continue;
    b.t += dt;
    b.segs.forEach((s, i) => {
      const due = 0.6 + i * 0.38;
      if (s.state === 'ok' && b.t > due - 0.35) s.state = 'shake';
      if (s.state === 'shake' && b.t > due) {
        s.state = 'fall';
        onCrumble(s);
      }
      if (s.state === 'fall') {
        s.vy += 1200 * dt;
        s.y += s.vy * dt;
        s.rot += dt * (i % 2 ? 3 : -3);
      }
    });
  }
}

// ---------- scenery ----------

let scenery = null;
function buildScenery() {
  const rnd = mulberry32(42);
  const roofs = [];
  for (let x = -40; x < LEVEL_W * 0.25 + 700;) {
    const w = 50 + rnd() * 70;
    roofs.push({ x, w, h: 60 + rnd() * 90, tank: rnd() < 0.3, antenna: rnd() < 0.4, win: Math.floor(rnd() * 1000) });
    x += w + rnd() * 8;
  }
  const props = [];
  for (let x = 200; x < LEVEL_W * 0.55 + 700; x += 160 + rnd() * 220) {
    props.push({ x, kind: rnd() < 0.45 ? 'poster' : rnd() < 0.5 ? 'bin' : 'lamp', v: rnd() });
  }
  return { roofs, props };
}

export function drawScenery(ctx, camx, t, W, H) {
  if (!scenery) scenery = buildScenery();
  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, W, H);
  const far = SPR.layers.bg_far;
  const mid = SPR.layers.bg_mid;
  if (far && mid && far.img && mid.img) {
    drawTiled(ctx, far, camx * 0.25, -10, H + 10, W);
    drawTiled(ctx, mid, camx * 0.55, 300 - 132, 132, W);
    // push the scenery back so characters and bullets read first
    ctx.fillStyle = 'rgba(239,234,223,0.3)';
    ctx.fillRect(0, 0, W, 300);
    return;
  }

  // moon
  ctx.beginPath();
  ctx.arc(500 - camx * 0.02, 70, 34, 0, Math.PI * 2);
  ink(ctx, C.yellow, 3);
  ctx.beginPath();
  ctx.arc(488 - camx * 0.02, 62, 7, 0, Math.PI * 2);
  ctx.fillStyle = C.yellowDk;
  ctx.fill();

  // far rooftops
  const fx = camx * 0.25;
  ctx.save();
  ctx.translate(-fx, 0);
  for (const r of scenery.roofs) {
    if (r.x + r.w < fx - 10 || r.x > fx + W + 10) continue;
    const top = 250 - r.h;
    ctx.beginPath();
    ctx.rect(r.x, top, r.w, H);
    ctx.fillStyle = C.greenLt;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(30,30,30,0.45)';
    ctx.stroke();
    for (let wy = top + 12; wy < 240; wy += 20) {
      for (let wx = r.x + 8; wx < r.x + r.w - 12; wx += 16) {
        const lit = ((r.win + wx * 7 + wy * 13) % 11) < 2;
        ctx.fillStyle = lit ? C.yellow : 'rgba(30,30,30,0.12)';
        ctx.fillRect(wx, wy, 7, 9);
      }
    }
    if (r.tank) {
      ctx.strokeStyle = 'rgba(30,30,30,0.45)';
      ctx.fillStyle = C.greenLt;
      ctx.fillRect(r.x + r.w * 0.3, top - 22, 22, 18);
      ctx.strokeRect(r.x + r.w * 0.3, top - 22, 22, 18);
    }
    if (r.antenna) {
      ctx.beginPath();
      ctx.moveTo(r.x + r.w * 0.7, top);
      ctx.lineTo(r.x + r.w * 0.7, top - 26);
      ctx.moveTo(r.x + r.w * 0.7 - 8, top - 20);
      ctx.lineTo(r.x + r.w * 0.7 + 8, top - 20);
      ctx.stroke();
    }
  }
  ctx.restore();

  // alley fence
  const mx = camx * 0.55;
  ctx.save();
  ctx.translate(-mx, 0);
  const start = Math.floor((mx - 20) / 22) * 22;
  for (let x = start; x < mx + W + 22; x += 22) {
    const h = 74 + ((x * 37) % 9);
    ctx.beginPath();
    ctx.moveTo(x, 300);
    ctx.lineTo(x, 300 - h);
    ctx.lineTo(x + 10, 300 - h - 8);
    ctx.lineTo(x + 20, 300 - h);
    ctx.lineTo(x + 20, 300);
    ctx.fillStyle = '#E4CFA6';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(30,30,30,0.55)';
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(30,30,30,0.18)';
  ctx.fillRect(start, 248, mx + W + 44 - start, 4);
  for (const p of scenery.props) {
    if (p.x < mx - 80 || p.x > mx + W + 80) continue;
    if (p.kind === 'poster') {
      ctx.save();
      ctx.translate(p.x, 238);
      ctx.rotate((p.v - 0.5) * 0.12);
      rrect(ctx, -20, -26, 40, 50, 2);
      ink(ctx, C.cream, 1.8);
      ctx.fillStyle = C.red;
      ctx.font = '900 13px "Noto Sans HK", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.v < 0.22 ? t('poster.lost1') : t('poster.rat1'), 0, -8);
      ctx.fillStyle = C.ink;
      ctx.font = '700 9px "Noto Sans HK", sans-serif';
      ctx.fillText(p.v < 0.22 ? t('poster.lost2') : t('poster.rat2'), 0, 8);
      ctx.restore();
    } else if (p.kind === 'bin') {
      rrect(ctx, p.x - 16, 262, 32, 38, 3);
      ink(ctx, C.green, 2);
      rrect(ctx, p.x - 19, 256, 38, 8, 3);
      ink(ctx, C.greenDk, 2);
    } else {
      ctx.beginPath();
      ctx.moveTo(p.x, 300);
      ctx.lineTo(p.x, 160);
      ctx.lineTo(p.x + 16, 160);
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x + 16, 166, 6 + Math.sin(t * 3 + p.v * 9) * 0.6, 0, Math.PI * 2);
      ink(ctx, C.yellow, 2);
    }
  }
  ctx.restore();
}

export function drawLevel(ctx, level, camx, W) {
  for (const s of level.solids) {
    if (s.kind !== 'ground' || s.x > camx + W || s.x + s.w < camx) continue;
    const dirt = groundPattern(ctx);
    ctx.fillStyle = dirt || C.dirt;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    const rnd = mulberry32(Math.floor(s.x) * 31 + s.y);
    ctx.fillStyle = C.dirtDk;
    for (let i = 0; !dirt && i < s.w / 18; i++) {
      const x = s.x + rnd() * s.w;
      const y = s.y + 18 + rnd() * (s.h - 20);
      ctx.beginPath();
      ctx.ellipse(x, y, 2 + rnd() * 4, 1.5 + rnd() * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawSoilDetail(ctx, s, camx, W);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ink;
    ctx.strokeRect(s.x, s.y, s.w, s.h + 10);
    // catnip grass along the top: a dark back row, a light front row, the odd catnip flower
    for (const [col, dy, step] of [[C.greenDk, -3, 7], [C.green, 0, 10]]) {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y + 7);
      for (let x = s.x; x < s.x + s.w; x += step) {
        const tip = 6 + ((x * 13) % 5) - dy;
        ctx.lineTo(x + step / 2, s.y - tip + 3);
        ctx.lineTo(Math.min(x + step, s.x + s.w), s.y + 1);
      }
      ctx.lineTo(s.x + s.w, s.y + 7);
      ctx.closePath();
      if (col === C.green) ink(ctx, col, 2);
      else { ctx.fillStyle = 'rgba(92,120,106,0.75)'; ctx.fill(); }
    }
    const frnd = mulberry32(Math.floor(s.x) * 7 + 3);
    for (let x = s.x + 20; x < s.x + s.w - 10; x += 60 + frnd() * 90) {
      const h = 12 + frnd() * 8;
      if (x < camx - 20 || x > camx + W + 20) continue;
      ctx.beginPath();
      ctx.moveTo(x, s.y + 2);
      ctx.quadraticCurveTo(x + 3, s.y - h * 0.5, x + 1, s.y - h);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = C.greenDk;
      ctx.stroke();
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(x + 1 + (k - 1) * 3, s.y - h - 2 + Math.abs(k - 1) * 2, 2.4, 0, Math.PI * 2);
        ink(ctx, '#B79AD6', 1);
      }
    }
  }
  for (const p of level.oneways) {
    if (p.x > camx + W || p.x + p.w < camx) continue;
    drawPlank(ctx, p.x, p.y, p.w);
  }
  for (const b of level.bridges) {
    for (const s of b.segs) {
      if (s.y > 440 || s.x > camx + W || s.x + s.w < camx) continue;
      ctx.save();
      const jitter = s.state === 'shake' ? (Math.random() - 0.5) * 2 : 0;
      ctx.translate(s.x + 20 + jitter, s.y + 5);
      ctx.rotate(s.rot);
      drawPlank(ctx, -20, -5, 40);
      ctx.restore();
    }
  }
}

let dirtPattern = null;
function groundPattern(ctx) {
  const g = SPR.layers.ground;
  if (!g || !g.img) return null;
  if (!dirtPattern) {
    dirtPattern = ctx.createPattern(g.img, 'repeat');
    // 256px texture -> 128 logical units
    if (dirtPattern.setTransform) dirtPattern.setTransform(new DOMMatrix().scale(0.5));
  }
  return dirtPattern;
}

// soil: a dark band under the grass, buried pebbles and fish bones, a strata line
function drawSoilDetail(ctx, s, camx, W) {
  const a = Math.max(s.x, camx - 10);
  const b = Math.min(s.x + s.w, camx + W + 10);
  if (b <= a) return;
  const g = ctx.createLinearGradient(0, s.y, 0, s.y + 18);
  g.addColorStop(0, 'rgba(92,120,106,0.45)');
  g.addColorStop(1, 'rgba(92,120,106,0)');
  ctx.fillStyle = g;
  ctx.fillRect(a, s.y, b - a, 18);
  ctx.strokeStyle = 'rgba(30,30,30,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = a - ((a - s.x) % 8); x < b; x += 8) {
    const y = s.y + 62 + Math.sin(x * 0.03) * 4;
    if (x === a - ((a - s.x) % 8)) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  const rnd = mulberry32(Math.floor(s.x) * 13 + s.y);
  for (let i = 0; i < s.w / 45; i++) {
    const x = s.x + rnd() * s.w;
    const y = s.y + 22 + rnd() * Math.max(10, s.h - 60);
    const kind = rnd();
    if (x < a - 10 || x > b + 10) continue;
    if (kind < 0.12) {
      // a fish bone
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rnd() - 0.5) * 0.8);
      ctx.strokeStyle = 'rgba(239,234,223,0.8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-8, 0); ctx.lineTo(7, 0);
      for (let k = -5; k <= 4; k += 3) { ctx.moveTo(k, -3); ctx.lineTo(k, 3); }
      ctx.moveTo(7, 0); ctx.lineTo(11, -3); ctx.moveTo(7, 0); ctx.lineTo(11, 3);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.ellipse(x, y, 2.5 + rnd() * 3.5, 1.8 + rnd() * 2, rnd() * 3, 0, Math.PI * 2);
      ctx.fillStyle = kind < 0.6 ? 'rgba(30,30,30,0.16)' : 'rgba(255,255,255,0.28)';
      ctx.fill();
    }
  }
}

// a weathered plank: grain, nail heads, a shadow underneath, rope lashings at the ends
function drawPlank(ctx, x, y, w) {
  ctx.fillStyle = 'rgba(30,30,30,0.18)';
  ctx.fillRect(x + 3, y + 10, w - 6, 3);
  rrect(ctx, x, y, w, 10, 2);
  ink(ctx, C.plank, 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x + 2, y + 2, w - 4, 2);
  ctx.beginPath();
  for (let px = x + 20; px < x + w - 4; px += 20) {
    ctx.moveTo(px, y + 1);
    ctx.lineTo(px, y + 9);
  }
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = C.plankDk;
  ctx.stroke();
  // grain
  ctx.beginPath();
  for (let px = x + 4; px < x + w - 10; px += 20) {
    const o = (px * 7) % 5;
    ctx.moveTo(px + 2, y + 5 + (o % 2));
    ctx.quadraticCurveTo(px + 8, y + 3 + o * 0.5, px + 14, y + 6);
  }
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = 'rgba(30,30,30,0.3)';
  ctx.stroke();
  ctx.fillStyle = C.ink;
  for (let px = x + 20; px < x + w - 4; px += 20) {
    ctx.fillRect(px - 3.5, y + 3, 1.6, 1.6);
    ctx.fillRect(px + 2, y + 3, 1.6, 1.6);
  }
  if (w >= 60) {
    ctx.strokeStyle = '#C98F22';
    ctx.lineWidth = 1.6;
    for (const rx of [x + 6, x + w - 9]) {
      ctx.beginPath();
      ctx.moveTo(rx, y - 1); ctx.lineTo(rx + 3, y + 11);
      ctx.moveTo(rx + 3, y - 1); ctx.lineTo(rx, y + 11);
      ctx.stroke();
    }
  }
}

// drifting catnip leaves and dandelion fluff in front of everything (stateless: positions come from the clock)
const FLOAT = Array.from({ length: 16 }, (_, i) => {
  const r = mulberry32(900 + i);
  return { x: r(), y: r(), sp: 18 + r() * 30, fall: 10 + r() * 16, ph: r() * 6, leaf: r() < 0.55, s: 0.7 + r() * 0.6 };
});
function drawFront(ctx, level, camx, W, tm) {
  for (const f of FLOAT) {
    const span = W + 60;
    const x = camx - 30 + ((((f.x * span - tm * f.sp) % span) + span) % span);
    const y = ((f.y * 330 + tm * f.fall) % 330) + Math.sin(tm * 1.3 + f.ph) * 10;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(tm * 2 + f.ph) * 0.8);
    ctx.scale(f.s, f.s);
    if (f.leaf) {
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.quadraticCurveTo(0, -4, 5, 0);
      ctx.quadraticCurveTo(0, 4, -5, 0);
      ctx.fillStyle = 'rgba(126,154,140,0.85)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(30,30,30,0.5)';
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 3.5, Math.sin(a) * 3.5); }
      ctx.stroke();
    }
    ctx.restore();
  }
}

// Stage description used by the game loop (see level2.js for the same shape).
export const STAGE1 = {
  n: 1,
  build: buildLevel1,
  wallX: WALL_X,
  update(level, game, dt, onCrumble) { updateBridges(level, game.alivePlayers(), dt, onCrumble); },
  drawScenery,
  drawLevel,
  drawFront,
  // the arena where the mid-boss fight locks the camera (used by the autoplay bot)
  midbossCamx: 3300,
  bossCamx: 6400,
};
