"""Crop the 6 cats from the reference sheet and make the paper background transparent.

Background = pixels reachable from the crop border without crossing the black outline.
The outline mask is dilated first so small gaps in the sketchy line don't leak into
light-coloured bodies (cat 03, 06).
"""
import sys
from collections import deque
from PIL import Image, ImageFilter

SRC = sys.argv[1]
OUT = sys.argv[2]
BOXES = {
    "01": (70, 95, 490, 490),
    "02": (600, 10, 950, 490),
    "03": (1060, 55, 1480, 490),
    "04": (85, 560, 550, 960),
    "05": (580, 495, 960, 960),
    "06": (1020, 550, 1480, 960),
}

# regions (crop-relative) holding the neighbouring cat's number label
ERASE = {"05": (0, 0, 380, 32)}

im = Image.open(SRC).convert("RGBA")
for name, box in BOXES.items():
    c = im.crop(box)
    w, h = c.size
    dark = c.convert("L").point(lambda v: 255 if v < 90 else 0)
    wall = dark.filter(ImageFilter.MaxFilter(5)).load()
    seen = bytearray(w * h)
    q = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)]
              + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    outside = Image.new("L", (w, h), 0)
    op = outside.load()
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
            continue
        seen[y * w + x] = 1
        if wall[x, y]:
            continue
        op[x, y] = 255
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    # grow the outside region back over the dilation margin, but never over real ink
    grown = outside.filter(ImageFilter.MaxFilter(5)).load()
    dk = dark.load()
    px = c.load()
    for y in range(h):
        for x in range(w):
            if grown[x, y] and not dk[x, y]:
                px[x, y] = (0, 0, 0, 0)
    # keep only the largest blob's bbox height-wise: number labels sit below, cut them
    if name in ERASE:
        c.paste((0, 0, 0, 0), ERASE[name])
    c = c.crop(c.getbbox())
    c.save(f"{OUT}/cat{name}.png")
    print(name, c.size)
