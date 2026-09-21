"""Turn a supplied portrait into a bundled one.

    pip install Pillow
    python3 scripts/make-portrait.py <source-image> <entity-id>

Writes `assets/portraits/<entity-id>.png` and prints what it did.

The art arrives as large pixel-art busts on a flat white background. Three
things have to happen before one can sit in the dialogue box, and all three are
easy to get subtly wrong by hand:

1. **The white has to go**, or the portrait is a white slab on a dark screen.
   It is cleared by flooding inward from the border rather than by replacing
   every white pixel, because eyes, teeth and highlights are white too and
   deleting those punches holes through the face.
2. **The margin has to go**, so the bust fills its frame instead of floating in
   the middle of a square of nothing.
3. **It has to come down to a sane size.** The sources are 1920px square for
   something shown at about eighty, which is a quarter of a megabyte of PNG
   per speaker in a bundle that already ships over the wire.

   Nearest-neighbour was the first instinct, to keep the pixels crisp — but
   the blocks were measured and there is no clean factor to snap to. Testing
   every divisor of 1920 for how uniform its blocks are gives a smooth curve
   (0.62 at 24px blocks rising to 0.93 at 4) with no cliff anywhere, which
   means the art is pixel-art *styled* rather than a true integer upscale:
   the edges are shaded and anti-aliased. So it is reduced with a proper
   filter instead, which at this display size is indistinguishable and far
   kinder to the gradients.
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "portraits"

# How far from pure white still counts as background.
WHITE = 236
# Tall enough to stay sharp on a 3x screen at the size the box draws it.
TARGET_HEIGHT = 256
# Pixel art needs nothing like a full truecolour range.
PALETTE = 256


def clear_background(im: Image.Image) -> Image.Image:
    """Flood the background to transparent, inward from every border pixel."""
    px = im.load()
    w, h = im.size
    seen = [[False] * h for _ in range(w)]
    stack = []

    def is_white(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        return a > 0 and r >= WHITE and g >= WHITE and b >= WHITE

    for x in range(w):
        for y in (0, h - 1):
            if is_white(x, y):
                stack.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_white(x, y):
                stack.append((x, y))

    while stack:
        x, y = stack.pop()
        if seen[x][y] or not is_white(x, y):
            continue
        seen[x][y] = True
        px[x, y] = (0, 0, 0, 0)
        if x > 0:
            stack.append((x - 1, y))
        if x < w - 1:
            stack.append((x + 1, y))
        if y > 0:
            stack.append((x, y - 1))
        if y < h - 1:
            stack.append((x, y + 1))
    return im


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__)
        raise SystemExit(2)

    source, entity = Path(sys.argv[1]), sys.argv[2]
    im = Image.open(source).convert("RGBA")
    before = im.size

    im = clear_background(im)
    box = im.getbbox()
    if box:
        im = im.crop(box)
    trimmed = im.size

    if im.height > TARGET_HEIGHT:
        scale = TARGET_HEIGHT / im.height
        im = im.resize((round(im.width * scale), TARGET_HEIGHT), Image.LANCZOS)

    # Quantised to a palette before saving. Pixel art has few colours by
    # nature, so this is visually free and takes a portrait from about 67KB to
    # about 12 — which is what makes inlining the whole set affordable.
    im = im.quantize(colors=PALETTE, method=Image.FASTOCTREE)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{entity}.png"
    im.save(out, optimize=True)
    print(
        f"{source.name} {before} -> trimmed {trimmed} -> {im.size} -> "
        f"{out.relative_to(ROOT)} ({out.stat().st_size} bytes)"
    )


if __name__ == "__main__":
    main()
