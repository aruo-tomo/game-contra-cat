// Frame-based sprites generated with Codex (assets/sprites/gen/manifest.json).
// Every frame faces right and is anchored bottom-centre unless drawn with anchor 'center'.

export const SPR = { frames: {}, layers: {}, ready: false };

const BASE = 'assets/sprites/gen/';

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error(`載入唔到 ${src}`));
    im.src = src;
  });
}

// Missing manifest is not fatal: the game falls back to the single reference images.
export async function loadSprites() {
  let manifest;
  try {
    const r = await fetch(BASE + 'manifest.json');
    if (!r.ok) return SPR;
    manifest = await r.json();
  } catch {
    return SPR;
  }
  const jobs = [];
  for (const [key, anims] of Object.entries(manifest)) {
    if (key === 'layers') continue;
    SPR.frames[key] = {};
    for (const [anim, list] of Object.entries(anims)) {
      // one anchor per animation, so cycles don't jitter sideways frame to frame
      const ax = list.reduce((t, f) => t + (f.ax ?? 0.5), 0) / list.length;
      SPR.frames[key][anim] = list.map((f) => ({ ...f, ax, img: null }));
      SPR.frames[key][anim].forEach((f) => jobs.push(loadImage(BASE + f.file).then((im) => { f.img = im; })));
    }
  }
  for (const [name, l] of Object.entries(manifest.layers || {})) {
    SPR.layers[name] = { ...l, img: null };
    jobs.push(loadImage(BASE + l.file).then((im) => { SPR.layers[name].img = im; }));
  }
  await Promise.all(jobs);
  SPR.ready = true;
  return SPR;
}

export function frame(key, anim, i = 0) {
  const list = SPR.frames[key] && SPR.frames[key][anim];
  if (!list || !list.length) return null;
  const f = list[((Math.floor(i) % list.length) + list.length) % list.length];
  return f.img ? f : null;
}

// Draw a frame at (x, y). `h` is the logical height the frame's reference pose maps to:
// scale = h / refPx, so shorter poses (crouch) stay proportionally shorter.
export function drawFrame(ctx, f, x, y, scale, o = {}) {
  const w = f.w * scale;
  const h = f.h * scale;
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(o.flip || 1, 1);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  const left = -w * (o.ax ?? f.ax ?? 0.5);
  const top = o.anchor === 'center' ? -h / 2 : -h;
  ctx.drawImage(f.img, left, top, w, h);
  if (o.flash) {
    ctx.globalAlpha *= 0.6;
    ctx.drawImage(whiteOf(f), left, top, w, h);
  }
  ctx.restore();
}

// White silhouette of a frame, built once and cached, for hit flashes.
export function whiteOf(f) {
  if (f.white) return f.white;
  const c = document.createElement('canvas');
  c.width = f.img.naturalWidth || f.w;
  c.height = f.img.naturalHeight || f.h;
  const g = c.getContext('2d');
  g.drawImage(f.img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  f.white = c;
  return c;
}

// Repeat a layer horizontally, mirroring every other copy so the seams always match.
export function drawTiled(ctx, layer, offset, y, h, viewW) {
  const w = (layer.w * h) / layer.h;
  const start = Math.floor(offset / w);
  for (let k = start; k * w - offset < viewW; k++) {
    const x = k * w - offset;
    if (k % 2) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(layer.img, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(layer.img, x, y, w, h);
    }
  }
}
