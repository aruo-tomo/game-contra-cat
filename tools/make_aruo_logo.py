"""Generate the "aruo entertainment" logo as SVG, all in lowercase.

Letters are drawn from geometry (no font needed) to match the existing ARUO
wordmark: thick monoline strokes, flat terminals and rounded bowls. Every
glyph sits on a 100-unit x-height (y=0 top, y=100 baseline); t and the dot of
i rise above it. Strokes that run past the baseline are clipped flat.

    python3 tools/make_aruo_logo.py   # writes game/assets/brand/*.svg
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "game" / "assets" / "brand"
ASC = 38  # how far t and the i dot rise above the x-height


def glyph(ch, w):
    """Return (advance_width, svg_elements) for one letter at stroke width w."""
    i = w / 2
    s = f'stroke-width="{w}"'
    b = 100 - i  # centre line of strokes that sit on the baseline
    if ch in "oa":
        W = 92 + w * 0.5
        r = 0.44 * (W - 2 * i)
        els = [f'<rect {s} x="{i}" y="{i}" width="{W - 2 * i}" height="{100 - w}" rx="{r}"/>']
        if ch == "a":
            els.append(f'<path {s} d="M{W - i},0 V115"/>')
        return W, els
    if ch == "e":
        W = 92 + w * 0.5
        r = 0.44 * (W - 2 * i)
        return W, [f'<path {s} d="M{i},50 H{W - i} V{i + r} A{r},{r} 0 0 0 {W - i - r},{i} '
                   f'H{i + r} A{r},{r} 0 0 0 {i},{i + r} V{b - r} A{r},{r} 0 0 0 {i + r},{b} '
                   f'H{W - i}"/>']
    if ch in "nu":
        W = 84 + w * 0.4
        r = 0.42 * (W - 2 * i)
        if ch == "n":
            return W, [f'<path {s} d="M{i},0 V115"/>',
                       f'<path {s} d="M{i},115 V{i + r} A{r},{r} 0 0 1 {i + r},{i} '
                       f'H{W - i - r} A{r},{r} 0 0 1 {W - i},{i + r} V115"/>']
        return W, [f'<path {s} d="M{W - i},0 V115"/>',
                   f'<path {s} d="M{i},0 V{b - r} A{r},{r} 0 0 0 {i + r},{b} '
                   f'H{W - i - r} A{r},{r} 0 0 0 {W - i},{b - r} V0"/>']
    if ch == "m":
        k = 62 + w * 0.3  # width of each arch
        r = 0.42 * (k - 2 * i)
        W = 2 * k - w
        return W, [f'<path {s} d="M{i},0 V115"/>',
                   f'<path {s} d="M{i},115 V{i + r} A{r},{r} 0 0 1 {i + r},{i} '
                   f'H{k - i - r} A{r},{r} 0 0 1 {k - i},{i + r} V115"/>',
                   f'<path {s} d="M{k - i},115 V{i + r} A{r},{r} 0 0 1 {k - i + r},{i} '
                   f'H{W - i - r} A{r},{r} 0 0 1 {W - i},{i + r} V115"/>']
    if ch == "r":
        W = 50 + w * 0.5
        r = 0.6 * (W - 2 * i)
        return W, [f'<path {s} d="M{i},0 V115"/>',
                   f'<path {s} d="M{i},115 V{i + r} A{r},{r} 0 0 1 {i + r},{i} H{W}"/>']
    if ch == "t":
        W = 46 + w
        x = W * 0.4
        return W, [f'<path {s} d="M{x},{-ASC} V115"/>', f'<path {s} d="M0,{i} H{W}"/>']
    if ch == "i":
        return w, [f'<path {s} d="M{i},0 V115"/>',
                   f'<rect stroke="none" x="0" y="{-ASC}" width="{w}" height="{w}"/>']
    raise ValueError(ch)


def word(text, w, tracking):
    """Lay out text on the 100-unit grid; return (width, svg)."""
    x, parts = 0.0, []
    for n, ch in enumerate(text):
        if n:
            x += tracking
        adv, els = glyph(ch, w)
        parts.append(f'<g transform="translate({x:.2f},0)">{"".join(els)}</g>')
        x += adv
    return x, "".join(parts)


def line(text, w, tracking, x, y, scale, cid):
    """Place a word with its x-height top at (x, y)."""
    width, body = word(text, w, tracking)
    clip = (f'<clipPath id="{cid}"><rect x="-20" y="{-ASC - 5}" width="{width + 40}" '
            f'height="{100 + ASC + 5}"/></clipPath>')
    g = (f'<g transform="translate({x:.2f},{y:.2f}) scale({scale})">'
         f'<g clip-path="url(#{cid})">{body}</g></g>')
    return width * scale, clip, g


def svg(width, height, defs, body, color):
    # rects/paths are stroke-only; the i dot sets stroke="none" and is filled
    body = body.replace('stroke="none"', f'stroke="none" fill="{color}"')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.0f} {height:.0f}" '
            f'width="{width:.0f}" height="{height:.0f}">'
            f'<defs>{"".join(defs)}</defs>'
            f'<g fill="none" stroke="{color}" stroke-linejoin="miter">{body}</g></svg>')


def stacked(color, pad=40):
    """Big "aruo" over a lighter "entertainment" that spans its width."""
    top_w, _ = word("aruo", 22, 22)
    sub_scale = 0.24
    sub_raw, _ = word("entertainment", 12, 0)
    # spread the subtitle so it is exactly as wide as "aruo"
    track = (top_w / sub_scale - sub_raw) / (len("entertainment") - 1)
    w1, c1, g1 = line("aruo", 22, 22, pad, pad, 1, "c1")
    sub_y = pad + 100 + 26 + ASC * sub_scale
    _, c2, g2 = line("entertainment", 12, track, pad, sub_y, sub_scale, "c2")
    return svg(w1 + 2 * pad, sub_y + 100 * sub_scale + pad, [c1, c2], g1 + g2, color)


def inline(color, pad=24):
    """One line, same size and weight throughout: aruo entertainment."""
    top = pad + ASC
    w1, c1, g1 = line("aruo", 16, 18, pad, top, 1, "c1")
    gap = 56
    w2, c2, g2 = line("entertainment", 16, 18, pad + w1 + gap, top, 1, "c2")
    return svg(pad + w1 + gap + w2 + pad, top + 100 + pad, [c1, c2], g1 + g2, color)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in (("aruo-entertainment", stacked), ("aruo-entertainment-inline", inline)):
        for suffix, color in (("", "#111111"), ("-white", "#ffffff")):
            (OUT / f"{name}{suffix}.svg").write_text(fn(color) + "\n")
            print("wrote", OUT / f"{name}{suffix}.svg")


if __name__ == "__main__":
    main()
