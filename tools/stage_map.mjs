// Renders stage 1 geometry and spawn script to an SVG strip for the design doc.
import { buildLevel1, LEVEL_W, WALL_X } from '../game/src/level1.js';

const L = buildLevel1();
const S = 0.16; // px per world unit
const H = 420 * S + 60;
const y = (v) => (v * S + 30).toFixed(1);
const x = (v) => (v * S).toFixed(1);
const parts = [];
for (const s of L.solids) {
  if (s.kind === 'ground') parts.push(`<rect class="g" x="${x(s.x)}" y="${y(s.y)}" width="${x(s.w)}" height="${(s.h * S).toFixed(1)}"/>`);
}
for (const p of L.oneways) parts.push(`<rect class="p" x="${x(p.x)}" y="${y(p.y)}" width="${x(p.w)}" height="2.2"/>`);
for (const b of L.bridges) parts.push(`<rect class="b" x="${x(b.x)}" y="${y(b.y)}" width="${x(b.n * 40)}" height="2.6"/>`);
parts.push(`<rect class="w" x="${x(WALL_X)}" y="${y(40)}" width="${x(LEVEL_W - WALL_X)}" height="${(260 * S).toFixed(1)}"/>`);
const marks = { capsule: 'c', rat: 'r', turret: 't', bat: 'v', ghost: 'h' };
for (const s of L.spawns) {
  if (s.t === 'elite' || s.t === 'boss') continue;
  const sx = s.at ?? s.x;
  const sy = s.t === 'capsule' ? 100 : s.y - (s.t === 'rat' || s.t === 'turret' ? 20 : 0);
  if (s.t === 'capsule') parts.push(`<g class="m c"><circle cx="${x(sx)}" cy="${y(sy)}" r="5"/><text x="${x(sx)}" y="${(+y(sy) + 3).toFixed(1)}">${s.item}</text></g>`);
  else parts.push(`<circle class="m ${marks[s.t]}" cx="${x(sx)}" cy="${y(sy)}" r="3"/>`);
}
for (const [a, b] of L.runnerZones) parts.push(`<rect class="z" x="${x(a)}" y="${H - 14}" width="${x(b - a)}" height="5" rx="2"/>`);
// arenas
parts.push(`<rect class="arena" x="${x(3300)}" y="4" width="${x(640)}" height="${H - 22}"/>`);
parts.push(`<rect class="arena" x="${x(6400)}" y="4" width="${x(640)}" height="${H - 22}"/>`);
parts.push(`<text class="lbl" x="${x(3300 + 320)}" y="18">中 Boss 場地</text>`);
parts.push(`<text class="lbl" x="${x(6400 + 320)}" y="18">Boss 場地</text>`);
parts.push(`<text class="lbl" x="${x(1600)}" y="${y(280)}">斷橋</text>`);
parts.push(`<text class="lbl" x="${x(5700)}" y="${y(280)}">斷橋</text>`);
for (let k = 0; k <= LEVEL_W; k += 1000) parts.push(`<text class="tick" x="${x(k) }" y="${H - 1}">${k}</text>`);
const svg = `<svg viewBox="-4 0 ${(LEVEL_W * S + 8).toFixed(0)} ${H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="第一關地圖">${parts.join('')}</svg>`;
process.stdout.write(svg);
