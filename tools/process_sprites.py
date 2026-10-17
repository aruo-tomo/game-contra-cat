"""Turn Codex-generated sheets in gen/raw/ into game-ready sprites + a manifest.

Background removal: pixels reachable from the canvas border that match the border colour,
without crossing the (dilated) black ink outline. Frames are found as connected blobs,
sorted left to right, and scaled so each sheet's reference pose has a fixed height.

Usage: python3 tools/process_sprites.py <gen_dir> <out_dir>
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

GEN = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)


def remove_bg(im, tol=48):
    rgb = np.asarray(im.convert("RGB")).astype(np.int32)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    ref = np.median(border, axis=0)
    diff = np.abs(rgb - ref).sum(-1)
    ink = rgb.mean(-1) < 95
    bgish = diff < tol
    wall = ndi.binary_dilation(ink, iterations=2)
    lab, _ = ndi.label(bgish & ~wall)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    outside = np.isin(lab, edge[edge > 0])
    outside = ndi.binary_dilation(outside, iterations=3) & ~ink & (diff < tol * 1.5)
    # large enclosed pockets of pure background (gaps between legs, under arms)
    lab2, n2 = ndi.label(bgish & ~outside & ~ink)
    if n2:
        sizes = ndi.sum(np.ones_like(diff), lab2, index=np.arange(1, n2 + 1))
        flat = ndi.mean(diff, lab2, index=np.arange(1, n2 + 1))
        pockets = [i + 1 for i, (s, f) in enumerate(zip(sizes, flat)) if s > 250 and f < 14]
        outside |= np.isin(lab2, pockets)
    alpha = np.where(outside, 0, 255).astype(np.uint8)
    out = np.dstack([np.asarray(im.convert("RGB")), alpha])
    return out


def frames(rgba, n, merge=10, min_area=1500):
    mask = rgba[..., 3] > 0
    grown = ndi.binary_dilation(mask, iterations=merge)
    lab, cnt = ndi.label(grown)
    objs = ndi.find_objects(lab)
    areas = ndi.sum(mask, lab, index=np.arange(1, cnt + 1))
    order = [i for i in np.argsort(-areas) if areas[i] >= min_area][:n]
    picks = []
    for i in order:
        sl = objs[i]
        sub = rgba[sl].copy()
        sub[..., 3] = np.where(lab[sl] == i + 1, sub[..., 3], 0)
        img = Image.fromarray(sub, "RGBA")
        bb = img.getbbox()
        picks.append((sl[1].start, img.crop(bb)))
    picks.sort(key=lambda t: t[0])
    if len(picks) != n:
        print(f"  warning: expected {n} frames, found {len(picks)}")
    return [p[1] for p in picks]


def foot_anchor(img):
    """Horizontal anchor (0..1) = centre of the opaque pixels in the bottom quarter, so beams,
    speed lines and tails don't shift the body off its hitbox."""
    a = np.asarray(img)[..., 3] > 0
    rows = a[int(a.shape[0] * 0.75):]
    cols = np.where(rows.any(0))[0]
    if not len(cols):
        return 0.5
    return round(float((cols.min() + cols.max()) / 2 / a.shape[1]), 3)


def save(img, name, scale):
    w, h = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    img.resize((w, h), Image.LANCZOS).save(OUT / f"{name}.png", optimize=True)
    return {"file": f"{name}.png", "w": w, "h": h, "ax": foot_anchor(img)}


manifest = {}


def sheet(raw, n, names, ref_index, ref_h, merge=10, min_area=1500):
    """names: list of (anim, frame_index) per frame; ref_index: frame (or 'median') that defines the scale."""
    path = GEN / "raw" / f"{raw}.png"
    if not path.exists():
        print(f"missing {path}")
        return
    print(raw)
    fr = frames(remove_bg(Image.open(path)), n, merge=merge, min_area=min_area)
    if not fr:
        return
    hs = sorted(f.height for f in fr)
    base = hs[len(hs) // 2] if ref_index == "median" else fr[min(ref_index, len(fr) - 1)].height
    scale = ref_h / base
    for (key, anim), img in zip(names, fr):
        entry = save(img, f"{key}_{anim}_{len(manifest.setdefault(key, {}).setdefault(anim, []))}", scale)
        manifest[key][anim].append(entry)


HERO_H = 128  # standing height in pixels (drawn at 2x)
for hero in ("blaze", "gulp"):
    sheet(f"{hero}_run", 6, [(hero, "run")] * 6, "median", HERO_H)
    sheet(f"{hero}_pose", 4, [(hero, "idle"), (hero, "jump"), (hero, "ball"), (hero, "crouch")], 0, HERO_H)
    sheet(f"{hero}_pose2", 3, [(hero, "dash"), (hero, "down"), (hero, "skill")], 2, HERO_H)

for hero in ("blaze", "gulp"):
    # arms raised make these frames taller than the 128px standing pose
    sheet(f"{hero}_aim", 3, [(hero, "aimup"), (hero, "aimdiag"), (hero, "hurt")], 1, 140)

sheet("ghost", 2, [("ghost", "float")] * 2, "median", 108)
sheet("elite", 3, [("elite", "idle"), ("elite", "jump"), ("elite", "fire")], 0, 224)
sheet("fx", 6, [("fx", "muzzle"), ("fx", "spark"), ("fx", "boom"), ("fx", "boom"), ("fx", "boom"), ("fx", "boom")], 3, 96,
      merge=16, min_area=150)
sheet("runner", 4, [("runner", "run")] * 4, "median", 112)
sheet("bat", 2, [("bat", "fly")] * 2, "median", 96)
sheet("rat", 2, [("rat", "idle"), ("rat", "fire")], 0, 92)
sheet("turret", 1, [("turret", "body")], 0, 76)
sheet("fortress", 1, [("fortress", "body")], 0, 700)
sheet("ratking", 1, [("ratking", "body")], 0, 320)
sheet("guns", 2, [("gun", "blaze"), ("gun", "gulp")], 0, 26)
sheet("items", 7, [("item", k) for k in ("can", "S", "M", "L", "F", "R", "B")], 1, 48)

# opaque layers
def layer(raw, name, height, cut=False):
    path = GEN / "raw" / f"{raw}.png"
    if not path.exists():
        print(f"missing {path}")
        return
    print(raw)
    im = Image.open(path)
    if cut:
        rgba = remove_bg(im, tol=40)
        im = Image.fromarray(rgba, "RGBA")
        im = im.crop(im.getbbox())
    else:
        im = im.convert("RGB")
    w = round(im.width * height / im.height)
    im = im.resize((w, height), Image.LANCZOS)
    fname = f"{name}.png" if cut or name == "ground" else f"{name}.jpg"
    if fname.endswith(".jpg"):
        im.save(OUT / fname, quality=86, optimize=True)
    else:
        im.save(OUT / fname, optimize=True)
    manifest.setdefault("layers", {})[name] = {"file": fname, "w": w, "h": height}


layer("bg_far", "bg_far", 720)
layer("bg_mid", "bg_mid", 300, cut=True)
layer("ground", "ground", 256)
layer("title", "title", 720)

(OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
print("manifest keys:", list(manifest))
