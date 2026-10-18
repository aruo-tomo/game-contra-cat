// Palette and procedural drawing helpers shared by the level and entities.
import { t } from './i18n.js';
// Colours follow the reference sheet: thick ink outline, aged-paper ground, red / yellow / grey-green.

export const C = {
  red: '#E8564B',
  redDk: '#B93C33',
  yellow: '#F2B33D',
  yellowDk: '#C98F22',
  green: '#7E9A8C',
  greenDk: '#5C786A',
  greenLt: '#C7D2C9',
  cream: '#EFEADF',
  paper: '#E6E0D2',
  ink: '#1E1E1E',
  dirt: '#D8C9A8',
  dirtDk: '#B9A67E',
  plank: '#D9B377',
  plankDk: '#A88252',
  rat: '#9C9A97',
  ratDk: '#6E6C69',
  pink: '#EBA5A0',
};

export function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

export function ink(ctx, fill, lw = 2.5) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineWidth = lw;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
}

export function ellipse(ctx, x, y, rx, ry, fill, lw = 2.5) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ink(ctx, fill, lw);
}

// Speckled paper grain laid over the whole frame.
export function makePaperPattern(ctx) {
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const g = c.getContext('2d');
  const rnd = mulberry32(7);
  for (let i = 0; i < 900; i++) {
    const dark = rnd() < 0.6;
    g.fillStyle = dark ? `rgba(60,45,30,${0.03 + rnd() * 0.06})` : `rgba(255,255,255,${0.05 + rnd() * 0.08})`;
    const s = rnd() * 2.2 + 0.4;
    g.fillRect(rnd() * 192, rnd() * 192, s, s);
  }
  return ctx.createPattern(c, 'repeat');
}

// Red Mouse soldier. (x, y) is the point between the feet.
export function drawRat(ctx, x, y, facing, t, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  if (o.moving) ctx.translate(0, -Math.abs(Math.sin(t * 12)) * 2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // tail
  ctx.beginPath();
  ctx.moveTo(-8, -8);
  ctx.quadraticCurveTo(-26, -4, -22, -20 + Math.sin(t * 4) * 3);
  ctx.lineWidth = 6; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = C.pink; ctx.stroke();
  ellipse(ctx, -5, -2, 5, 3, C.pink, 2);
  ellipse(ctx, 6, -2, 5, 3, C.pink, 2);
  ellipse(ctx, 0, -14, 11, 13, o.flash ? '#fff' : C.rat);
  ellipse(ctx, 3, -12, 6, 8, C.cream, 1.5);
  ellipse(ctx, 0, -38, 5.5, 5.5, C.pink, 2);
  ellipse(ctx, 11, -39, 5.5, 5.5, C.pink, 2);
  ellipse(ctx, 6, -30, 10, 9, o.flash ? '#fff' : C.rat);
  ellipse(ctx, 15, -27, 5, 4, C.rat, 2);
  ctx.beginPath(); ctx.arc(20, -27.5, 2, 0, Math.PI * 2); ctx.fillStyle = C.ink; ctx.fill();
  ctx.beginPath(); ctx.arc(9, -32, 2.4, 0, Math.PI * 2); ink(ctx, C.red, 1.2);
  // red bandana of the Red Mouse army
  ctx.beginPath();
  ctx.moveTo(-3, -34); ctx.quadraticCurveTo(6, -40, 15, -34);
  ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = C.red; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3, -34); ctx.lineTo(-10, -31 + Math.sin(t * 9) * 2); ctx.lineTo(-9, -36);
  ctx.closePath(); ink(ctx, C.red, 1.5);
  ctx.restore();
}

// A gun barrel pointing along `ang`, drawn in world space.
export function drawGun(ctx, x, y, ang, len, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  rrect(ctx, -3, -3.5, len, 7, 3);
  ink(ctx, fill, 2);
  rrect(ctx, len - 6, -4.5, 6, 9, 2);
  ink(ctx, C.ink, 1.5);
  ctx.restore();
}

export function drawHeart(ctx, x, y, s, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 16, s / 16);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-9, -2, -6, -10, 0, -5);
  ctx.bezierCurveTo(6, -10, 9, -2, 0, 5);
  ink(ctx, fill, 2.4);
  ctx.restore();
}

export const WEAPON_INFO = {
  N: { name: t('w.N'), color: C.cream },
  S: { name: t('w.S'), color: C.red },
  M: { name: t('w.M'), color: C.green },
  L: { name: t('w.L'), color: '#E5484D' },
  F: { name: t('w.F'), color: C.yellow },
  R: { name: t('w.R'), color: C.cream },
  B: { name: t('w.B'), color: '#9CCB7A' },
};

export function drawBadge(ctx, x, y, r, letter) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ink(ctx, (WEAPON_INFO[letter] || WEAPON_INFO.N).color, 2.2);
  ctx.fillStyle = C.ink;
  ctx.font = `900 ${Math.round(r * 1.25)}px Bungee, "Noto Sans HK", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter === 'N' ? '·' : letter, x, y + 1);
}
