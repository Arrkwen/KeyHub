#!/usr/bin/env python3
"""
Letterbox non-square PNG to 1024×1024 using a matte colour sampled from the
image borders (instead of stark white), then clip to a rounded rectangle so
icons look like a card. Regions outside the arc use full transparency (RGBA)
so corners read as rounded on docks and toolbars; matte only appears inside the
rounded area (letterbox gutters around the glyph).

Usage:
  python3 prepare_app_icon_source.py <path-to-source.png>
  python3 prepare_app_icon_source.py --round-existing   # reuse current app-icon-source.png
"""
from __future__ import annotations

import statistics
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

TAURI_DIR = Path(__file__).resolve().parents[1]
OUT = TAURI_DIR / "app-icon-source.png"
CANVAS = (1024, 1024)
EDGE_MARGIN = 40
ALPHA_THRESHOLD = 200
CORNER_RADIUS_FRACTION = 0.19


def apply_rounded_corners(im: Image.Image, radius_frac: float = CORNER_RADIUS_FRACTION) -> Image.Image:
    """Return RGBA with alpha=0 outside a centered rounded rectangle (opaque inside)."""
    im = im.convert("RGBA")
    w, h = im.size
    r = int(round(min(w, h) * radius_frac))
    r = max(16, min(r, min(w, h) // 2 - 1))
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=r, fill=255)
    rch, gch, bch, ach = im.split()
    out_a = ImageChops.multiply(ach, mask)
    return Image.merge("RGBA", (rch, gch, bch, out_a))


def sample_edge_background(im: Image.Image, edge_px: int) -> tuple[int, int, int]:
    rs: list[float] = []
    gs: list[float] = []
    bs: list[float] = []
    w, h = im.size
    rng_w = range(w)
    rng_h = range(h)

    def collect(x: int, y: int) -> None:
        r, g, b, a = im.getpixel((x, y))
        if a > ALPHA_THRESHOLD:
            rs.append(r)
            gs.append(g)
            bs.append(b)

    for y in range(min(edge_px, h)):
        for x in rng_w:
            collect(x, y)
    for y in range(max(0, h - edge_px), h):
        for x in rng_w:
            collect(x, y)
    for x in range(min(edge_px, w)):
        for y in rng_h:
            collect(x, y)
    for x in range(max(0, w - edge_px), w):
        for y in rng_h:
            collect(x, y)

    if not rs:
        return (255, 255, 255)

    def clip_u8(v: float) -> int:
        return int(max(0, min(255, round(v))))

    return (clip_u8(statistics.mean(rs)), clip_u8(statistics.mean(gs)), clip_u8(statistics.mean(bs)))


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: prepare_app_icon_source.py <path-to-source.png>", file=sys.stderr)
        print("       prepare_app_icon_source.py --round-existing", file=sys.stderr)
        sys.exit(1)

    if sys.argv[1] == "--round-existing":
        if not OUT.is_file():
            print(f"missing {OUT}", file=sys.stderr)
            sys.exit(1)
        im = Image.open(OUT)
        rounded = apply_rounded_corners(im)
        rounded.save(OUT, optimize=True)
        print(f"Rounded corners (transparent exterior), wrote {OUT}")
        return

    src = Path(sys.argv[1]).resolve()
    im = Image.open(src).convert("RGBA")
    w, h = CANVAS

    matte = sample_edge_background(im, EDGE_MARGIN)
    scale = min(w / im.width, h / im.height)
    nw = max(1, int(im.width * scale))
    nh = max(1, int(im.height * scale))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", CANVAS, (*matte, 255))
    x = (w - nw) // 2
    y = (h - nh) // 2
    canvas.paste(resized, (x, y), resized)
    canvas = apply_rounded_corners(canvas)
    canvas.save(OUT, optimize=True)

    print(f"Matte RGB {matte}")
    print(f"Wrote {OUT} from {src} ({im.size} scaled to {nw}×{nh}), rounded rectangle clip")


if __name__ == "__main__":
    main()
