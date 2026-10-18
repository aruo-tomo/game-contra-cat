"""Measure where the heroes' empty paws grip, and where each gun's handle and muzzle are.

Reads the processed frames (run process_sprites.py first) and writes gen/grips.json, which
process_sprites.py merges into the manifest. All points are normalised to the frame (0..1,
from the top-left of the right-facing image):
  hero grip frames: gx, gy = centre of the clenched paws; ang = aim angle in degrees (y down)
  guns:             hx, hy = middle of the pistol grip; mx, my = muzzle tip
Check the overlay it saves (gen/grips_check.png) and hand-fix grips.json if a point is off.

Usage: python3 tools/measure_grips.py <gen_dir> <sprite_dir>
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

GEN = Path(sys.argv[1])
SPR = Path(sys.argv[2])
manifest = json.loads((SPR / "manifest.json").read_text())

# aim angle per grip animation, and how much of the frame (from the top) may hold the paws,
# so a forward-stepping foot or the tail can't win the "furthest along the aim" test
GRIP_ANIMS = {
    "gripfwd": (0, 0.75), "gripdiag": (-45, 0.75), "gripup": (-90, 1.0, 0.55), "gripdown": (45, 0.8),
    "gripcrouch": (0, 1.0), "gripjump": (0, 0.75), "griprun": (0, 0.7),
}


def alpha(file):
    return np.asarray(Image.open(SPR / file).convert("RGBA"))[..., 3] > 128  # ignore faint resampling fringe


def paw_centre(a, ang, max_y, min_x=0.0):
    h, w = a.shape
    ys, xs = np.nonzero(a)
    keep = (ys < max_y * h) & (xs >= min_x * w)  # min_x: raised paws are in front of the ears
    ys, xs = ys[keep], xs[keep]
    d = (math.cos(math.radians(ang)), math.sin(math.radians(ang)))
    p = xs * d[0] + ys * d[1]
    # the paws are the cap of the silhouette furthest along the aim; its centroid is the fist centre
    depth = 0.11 * 128
    cap = np.zeros_like(a)
    cap[ys[p >= p.max() - depth], xs[p >= p.max() - depth]] = True
    # only the biggest blob (the paws), so an ear tip next to a raised paw doesn't drag it sideways
    lab, n = ndi.label(cap)
    sizes = ndi.sum(cap, lab, index=np.arange(1, n + 1))
    cy, cx = np.nonzero(lab == np.argmax(sizes) + 1)
    return float(cx.mean() / w), float(cy.mean() / h)


def gun_points(a):
    h, w = a.shape
    # muzzle: the right-most columns
    cols = np.nonzero(a.any(0))[0]
    right = a[:, cols.max() - max(2, w // 25):]
    my = np.nonzero(right.any(1))[0]
    mx, my = cols.max() / w, (my.min() + my.max()) / 2 / h
    # grip: below the body only the handle (rear) and a magazine/drum (front) reach down. The body
    # ends where the silhouette suddenly gets narrow; take the rear-most sizeable blob under it
    width = a.sum(1)
    top = next(y for y in range(h // 2, h) if width[y] < 0.5 * w)
    band = a.copy()
    band[:top] = False
    lab, n = ndi.label(band)
    areas = ndi.sum(band, lab, index=np.arange(1, n + 1))
    blobs = [i + 1 for i in range(n) if areas[i] >= 0.15 * areas.max()]  # skip trigger tips and specks
    best = min(blobs, key=lambda i: np.nonzero(lab == i)[1].mean())
    ys, _ = np.nonzero(lab == best)
    # the paws wrap the handle a little under the body; the handle is the rear-most run on that row
    # (the trigger guard can be joined to it)
    hy = round(ys.min() + 0.25 * (ys.max() - ys.min()))
    row = np.nonzero((lab == best)[hy])[0]
    gaps = np.nonzero(np.diff(row) > 1)[0]
    run = row[: gaps[0] + 1] if len(gaps) else row
    hx = run.mean()
    return dict(hx=round(hx / w, 3), hy=round(hy / h, 3), mx=round(mx, 3), my=round(my, 3))


grips = {}
for hero in ("blaze", "gulp"):
    for anim, (ang, *region) in GRIP_ANIMS.items():
        for f in manifest.get(hero, {}).get(anim, []):
            gx, gy = paw_centre(alpha(f["file"]), ang, *region)
            grips.setdefault(hero, {}).setdefault(anim, []).append(dict(gx=round(gx, 3), gy=round(gy, 3), ang=ang))
# heroes drawn holding a gun: the muzzle is the tip of the silhouette furthest along the aim
HOLD_POSES = {"fwd": (0, 0.8), "diag": (-45, 0.8), "up": (-90, 1.0), "down": (45, 0.85), "crouch": (0, 1.0),
              "jump": (0, 0.8), "run": (0, 0.75), "runup": (-45, 0.8), "rundown": (45, 0.85),
              "swim": (0, 1.0), "swimup": (-45, 1.0), "swimdown": (45, 1.0)}


def muzzle_tip(a, ang, max_y):
    h, w = a.shape
    ys, xs = np.nonzero(a)
    keep = ys < max_y * h
    ys, xs = ys[keep], xs[keep]
    d = (math.cos(math.radians(ang)), math.sin(math.radians(ang)))
    p = xs * d[0] + ys * d[1]
    cap = p >= p.max() - 6  # the barrel's end face
    return round(float(xs[cap].mean() / w), 3), round(float(ys[cap].mean() / h), 3)


for hero in ("blaze", "gulp"):
    for anim, frames in manifest.get(hero, {}).items():
        if not anim.startswith("hold"):
            continue
        ang, max_y = HOLD_POSES[anim[5:]]
        for f in frames:
            mx, my = muzzle_tip(alpha(f["file"]), ang, max_y)
            grips.setdefault(hero, {}).setdefault(anim, []).append(dict(mx=mx, my=my, ang=ang))
for kind, frames in manifest.get("gun", {}).items():
    grips.setdefault("gun", {})[kind] = [gun_points(alpha(f["file"])) for f in frames]

(GEN / "grips.json").write_text(json.dumps(grips, indent=1))

# overlay for checking by eye: red dot = grip, yellow line = aim, blue dot = muzzle
tiles = []
for key, anims in grips.items():
    for anim, pts in anims.items():
        for f, pt in zip(manifest[key][anim], pts):
            im = Image.open(SPR / f["file"]).convert("RGBA")
            k = 5 if "hx" in pt else 1 if "gx" not in pt else 2
            im = im.resize((im.width * k, im.height * k))
            bg = Image.new("RGBA", (im.width + 40, im.height + 40), (200, 220, 255, 255))
            bg.alpha_composite(im, (20, 20))
            d = ImageDraw.Draw(bg)
            if "gx" not in pt and "hx" not in pt:
                x, y = 20 + pt["mx"] * im.width, 20 + pt["my"] * im.height
                a = math.radians(pt["ang"])
                d.line((x, y, x + 40 * math.cos(a), y + 40 * math.sin(a)), fill=(240, 180, 0, 255), width=3)
                d.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(0, 0, 255, 255))
            elif "gx" in pt:
                x, y = 20 + pt["gx"] * im.width, 20 + pt["gy"] * im.height
                a = math.radians(pt["ang"])
                d.line((x, y, x + 40 * math.cos(a), y + 40 * math.sin(a)), fill=(240, 180, 0, 255), width=3)
                d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(255, 0, 0, 255))
            else:
                for (px, py, c) in ((pt["hx"], pt["hy"], (255, 0, 0, 255)), (pt["mx"], pt["my"], (0, 0, 255, 255))):
                    x, y = 20 + px * im.width, 20 + py * im.height
                    d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=c)
            tiles.append(bg)
cols = 7
rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
W = max(sum(t.width for t in r) for r in rows)
H = sum(max(t.height for t in r) for r in rows)
sheet = Image.new("RGBA", (W, H), (255, 255, 255, 255))
y = 0
for r in rows:
    x = 0
    for t in r:
        sheet.alpha_composite(t, (x, y))
        x += t.width
    y += max(t.height for t in r)
sheet.save(GEN / "grips_check.png")
print("wrote", GEN / "grips.json", "and", GEN / "grips_check.png")
