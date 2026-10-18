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


def remove_bg(im, tol=48, cut_all=False, holes=0):
    """Make the generated sheet's flat background transparent without touching the art.

    Only background connected to the canvas border is removed. Whites in the art (the fat
    white cat, the ghost, teeth, bellies) can be the exact same colour as the background,
    so enclosed regions are never removed, and the ink outline is thickened first so a small
    gap in the line can't let the flood leak inside a character.
    """
    if im.mode == "RGBA":
        rgba = np.asarray(im)
        edge = np.concatenate([rgba[0, :, 3], rgba[-1, :, 3], rgba[:, 0, 3], rgba[:, -1, 3]])
        if (edge == 0).mean() > 0.5:  # already cut out by the generator: keep its alpha
            out = rgba.copy()
            out[..., 3] = np.where(out[..., 3] < 32, 0, out[..., 3])  # drop the faint haze round the edges
            return out
    rgb = np.asarray(im.convert("RGB")).astype(np.int32)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    ref = np.median(border, axis=0)
    diff = np.abs(rgb - ref).sum(-1)
    ink = rgb.mean(-1) < 95
    wall = ndi.binary_dilation(ink, iterations=3)
    lab, _ = ndi.label((diff < 20) & ~wall)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    outside = np.isin(lab, edge[edge > 0])
    if holes:
        # big enclosed patches of background (e.g. between a tower and its stairs) go too;
        # small cream details inside the art are far smaller than this
        sizes = np.bincount(lab.ravel())
        big = np.nonzero(sizes >= holes)[0]
        outside |= np.isin(lab, big[big > 0])
    if cut_all:
        # effects with no white/cream in them (swirls, rings): enclosed background goes too
        outside |= (diff < 20) & ~wall
    # close the 3px margin left by the thickened wall, up to (never past) the ink line
    outside = ndi.binary_dilation(outside, iterations=4) & ~ink & (diff < tol)
    alpha = np.where(outside, 0, 255).astype(np.uint8)
    return np.dstack([np.asarray(im.convert("RGB")), alpha])


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


def strip_barrel(img, i=0):
    """Muzzle-flash frames were drawn coming out of a grey-green gun barrel; cut the barrel off
    so only the flash is left (its left edge then sits at the muzzle). Scan from the left and
    cut where barrel-coloured pixels stop appearing."""
    a = np.asarray(img).astype(np.int32)
    rgb, alpha = a[..., :3], a[..., 3] > 0
    barrel = alpha & (np.abs(rgb - np.array([110, 138, 126])).sum(-1) < 70)
    counts = barrel.sum(0)
    seen, cut, gap = False, 0, 0
    for x, c in enumerate(counts):
        if c >= 3:
            seen, gap, cut = True, 0, x
        elif seen:
            gap += 1
            if gap >= 3:
                break
    if not seen:
        return img
    out = img.crop((cut + 2, 0, img.width, img.height))
    return out.crop(out.getbbox()) if out.getbbox() else img


def save(img, name, scale):
    w, h = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    img.resize((w, h), Image.LANCZOS).save(OUT / f"{name}.png", optimize=True)
    return {"file": f"{name}.png", "w": w, "h": h, "ax": foot_anchor(img)}


manifest = {}


def sheet(raw, n, names, ref_index, ref_h, merge=10, min_area=1500, post=None, cut_all=False, holes=0, extra=None):
    """names: list of (anim, frame_index) per frame; ref_index: frame (or 'median') that defines the scale."""
    path = GEN / "raw" / f"{raw}.png"
    if not path.exists():
        print(f"missing {path}")
        return
    print(raw)
    rgba = remove_bg(Image.open(path), cut_all=cut_all, holes=holes)
    fr = frames(rgba, n, merge=merge, min_area=min_area)
    # frames drawn close together can merge into one blob: retry with a smaller merge distance
    for m in (6, 4, 2):
        if len(fr) == n or m >= merge:
            continue
        fr = frames(rgba, n, merge=m, min_area=min_area)
    if post:
        fr = [post(f, i) for i, f in enumerate(fr)]
    if not fr:
        return
    hs = sorted(f.height for f in fr)
    if ref_index == "body":
        # a gun raised above the head makes the frame taller than the cat: measure only the body side
        # (left 55% of each right-facing frame) so the hero keeps its size
        def body_h(f):
            a = np.asarray(f)[..., 3] > 128
            rows = np.nonzero(a[:, : int(a.shape[1] * 0.55)].any(1))[0]
            return rows.max() - rows.min() + 1 if len(rows) else f.height
        bh = sorted(body_h(f) for f in fr)
        base = bh[len(bh) // 2]
    else:
        base = hs[len(hs) // 2] if ref_index == "median" else fr[min(ref_index, len(fr) - 1)].height
    scale = ref_h / base
    for (key, anim), img in zip(names, fr):
        entry = save(img, f"{key}_{anim}_{len(manifest.setdefault(key, {}).setdefault(anim, []))}", scale)
        entry.update(extra or {})
        manifest[key][anim].append(entry)


HERO_H = 128  # standing height in pixels (drawn at 2x)
HOLD_H = 256  # standing height of the held-gun frames
for hero in ("blaze", "gulp"):
    sheet(f"{hero}_run", 6, [(hero, "run")] * 6, "median", HERO_H)
    sheet(f"{hero}_pose", 4, [(hero, "idle"), (hero, "jump"), (hero, "ball"), (hero, "crouch")], 0, HERO_H)
    sheet(f"{hero}_pose2", 3, [(hero, "dash"), (hero, "down"), (hero, "skill")], 2, HERO_H)

for hero in ("blaze", "gulp"):
    # arms raised make these frames taller than the 128px standing pose
    sheet(f"{hero}_aim", 3, [(hero, "aimup"), (hero, "aimdiag"), (hero, "hurt")], 1, 140)
    # empty paws clenched round an invisible pistol grip; the game draws the current weapon in them
    sheet(f"{hero}_grip", 6, [(hero, a) for a in ("gripfwd", "gripdiag", "gripup", "gripdown", "gripcrouch", "gripjump")], 0, HERO_H)
    # drawn holding each gun (N = the hero's own blaster), at twice the resolution so the guns stay crisp;
    # k tells the game to draw them at half scale
    for w in ("N", "S", "M", "L", "F"):
        sheet(f"hold_{hero}_{w}", 6, [(hero, f"hold{w}{p}") for p in ("fwd", "diag", "up", "down", "crouch", "jump")], 0,
              HOLD_H, extra={"k": HERO_H / HOLD_H})
        sheet(f"holdrun_{hero}_{w}", 6, [(hero, f"hold{w}run")] * 6, "median", HOLD_H, merge=6, extra={"k": HERO_H / HOLD_H})
        for d in ("up", "down"):  # running while aiming 45 degrees up / down
            sheet(f"holdrun{d}_{hero}_{w}", 6, [(hero, f"hold{w}run{d}")] * 6, "body", HOLD_H, merge=6,
                  extra={"k": HERO_H / HOLD_H})
    sheet(f"{hero}_griprun", 6, [(hero, "griprun")] * 6, "median", HERO_H, merge=6)  # tails nearly touch

sheet("ghost", 2, [("ghost", "float")] * 2, "median", 108)
sheet("elite", 3, [("elite", "idle"), ("elite", "jump"), ("elite", "fire")], 0, 224)
sheet("fx", 6, [("fx", "muzzle"), ("fx", "spark"), ("fx", "boom"), ("fx", "boom"), ("fx", "boom"), ("fx", "boom")], 3, 96,
      merge=16, min_area=150)
# projectiles and shooting / defeat effects (pass 3)
sheet("bullets", 7, [("bullet", k) for k in ("N", "S", "M", "L", "F", "spit", "enemy")], 0, 48, merge=14, min_area=200)
# enemy shots: dark spiked pellets (2 spin frames) and a lobbed bomb (2 frames), unlike any hero shot
sheet("enemy_shots", 4, [("eshot", "pellet"), ("eshot", "pellet"), ("eshot", "bomb"), ("eshot", "bomb")], 0, 48,
      merge=14, min_area=200)
sheet("muzzle", 4, [("muzzle", "fire")] * 4, 1, 72, merge=14, min_area=150, post=strip_barrel)
sheet("impact", 4, [("impact", "hit")] * 4, 1, 56, merge=16, min_area=80)
sheet("explosion", 6, [("explosion", "boom")] * 6, 2, 128, merge=16, min_area=150)
for k in ("runner", "bat", "ghost", "elite"):
    sheet(f"freed_{k}", 2, [(f"freed_{k}", "daze"), (f"freed_{k}", "happy")], "median", 220 if k == "elite" else 110)
sheet("soul", 2, [("soul", "blaze"), ("soul", "gulp")], 0, 110)

sheet("runner", 4, [("runner", "run")] * 4, "median", 112)
sheet("bat", 2, [("bat", "fly")] * 2, "median", 96)
sheet("rat", 2, [("rat", "idle"), ("rat", "fire")], 0, 92)


def drop_loose(im, i):
    """The grenadier's throw frame was drawn with the bomb already flying off; the game throws its own
    bomb, so keep only the rat (the largest connected piece)."""
    if i != 1:
        return im
    a = np.asarray(im).copy()
    lab, n = ndi.label(a[..., 3] > 0)
    if n > 1:
        sizes = ndi.sum(a[..., 3] > 0, lab, index=np.arange(1, n + 1))
        a[..., 3] = np.where(lab == np.argmax(sizes) + 1, a[..., 3], 0)
    out = Image.fromarray(a, "RGBA")
    return out.crop(out.getbbox())


# more Red Mouse soldier types (frames face left like the rifle rat)
sheet("rat_gunner", 2, [("gunner", "idle"), ("gunner", "fire")], 0, 96, merge=24)
sheet("rat_grenadier", 2, [("grenadier", "idle"), ("grenadier", "throw")], 0, 92, merge=24, post=drop_loose)
sheet("rat_sniper", 2, [("sniper", "aim"), ("sniper", "fire")], 0, 74, merge=24)
sheet("rat_charger", 4, [("charger", "run"), ("charger", "run"), ("charger", "crouch"), ("charger", "leap")], 0, 80, merge=8)
sheet("turret", 1, [("turret", "body")], 0, 76)
sheet("fortress", 1, [("fortress", "body")], 0, 700, holes=5000)
# boss parts that sit in the fortress sockets: hatch, pivoting barrel, wrecked hatch, rat-eye core, cracked core
def cut_smoke(im, i):
    """The wrecked hatch (frame 2) was drawn with a curl of grey smoke on top; keep only the square plate
    (rows at least half as wide as the plate) so it fits the socket. The game adds its own smoke."""
    if i != 2:
        return im
    a = np.asarray(im)[..., 3] > 128
    widths = a.sum(1)
    top = int(np.argmax(widths >= 0.5 * widths.max()))
    out = im.crop((0, top, im.width, im.height))
    return out.crop(out.getbbox())


sheet("boss_parts", 5, [("boss", k) for k in ("pod", "barrel", "podbroken", "core", "corehurt")], 0, 80, merge=12,
      min_area=300, post=cut_smoke)
sheet("ratking", 1, [("ratking", "body")], 0, 320)
sheet("guns", 2, [("gun", "blaze"), ("gun", "gulp")], 0, 26)
# one gun per pickup weapon (N keeps gun_blaze / gun_gulp), all drawn at one scale on the sheet
sheet("weapons", 4, [("gun", k) for k in ("S", "M", "L", "F")], "median", 40)
# skill effects: a beam section the game stretches to length (ends trimmed so it has no caps),
# the beam's source flare and impact splash, and Gulp's looping suction vortex
trim_ends = lambda im, i=0: im.crop((round(im.width * 0.03), 0, round(im.width * 0.97), im.height))
sheet("skill_beam", 1, [("skill", "beam")], 0, 56, post=trim_ends)
sheet("skill_beamfx", 2, [("skill", "flare"), ("skill", "splash")], "median", 110, merge=16, min_area=300)
sheet("skill_vortex", 3, [("skill", "vortex")] * 3, "median", 300, merge=24, min_area=300, cut_all=True)
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
layer("cover_bg", "cover_bg", 720)
# character-select portraits are plain cut-outs at a fixed height (not part of the manifest frames)
for k in ("blaze", "gulp"):
    path = GEN / "raw" / f"select_{k}.png"
    if path.exists():
        im = Image.fromarray(remove_bg(Image.open(path)), "RGBA")
        im = im.crop(im.getbbox())
        im = im.resize((round(im.width * 520 / im.height), 520), Image.LANCZOS)
        im.save(OUT / f"select_{k}.png", optimize=True)
        print(f"select_{k}", im.size)

# hand-checked grip / muzzle points (normalised to each frame), measured by tools/measure_grips.py
grips_path = GEN / "grips.json"
if grips_path.exists():
    for key, anims in json.loads(grips_path.read_text()).items():
        for anim, pts in anims.items():
            for entry, pt in zip(manifest.get(key, {}).get(anim, []), pts):
                entry.update(pt)

(OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
print("manifest keys:", list(manifest))
