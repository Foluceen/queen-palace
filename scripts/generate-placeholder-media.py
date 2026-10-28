"""Generate placeholder hair-texture artwork for mock mode.

These images stand in for real product photography until the vendor uploads
their own through the admin media library. Run: python3 scripts/generate-placeholder-media.py
Requires Pillow and numpy.
"""
import math
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "public" / "media"
OUT.mkdir(parents=True, exist_ok=True)

SHADES = {
    "1b": (30, 22, 20),
    "2": (44, 29, 22),
    "4": (74, 47, 34),
    "27": (180, 123, 58),
    "613": (227, 197, 143),
    "99j": (92, 26, 42),
    "350": (165, 72, 42),
}

# Queen Luxury Hair palette: burgundy, champagne gold, warm ivory, charcoal.
# Queen Luxury Hair palette: cocoa, espresso, cream, blush and champagne.
BACKDROPS = {
    "plum": ((112, 64, 40), (44, 24, 14)),       # cocoa
    "mist": ((58, 40, 32), (22, 15, 12)),        # espresso
    "pearl": ((250, 242, 234), (232, 214, 196)),  # cream
    "indigo": ((36, 26, 22), (14, 10, 8)),       # near black
    "honey": ((232, 205, 160), (190, 150, 96)),  # champagne
    "rose": ((246, 222, 230), (226, 186, 202)),  # blush
}
LIGHT = ("honey", "rose", "pearl")


def clamp(v):
    return max(0, min(255, int(v)))


def tint(rgb, f):
    if f >= 0:
        return tuple(clamp(c + (255 - c) * f) for c in rgb)
    return tuple(clamp(c * (1 + f)) for c in rgb)


def backdrop(w, h, name, rng):
    top, bottom = BACKDROPS[name]
    y = np.linspace(0, 1, h)[:, None]
    x = np.linspace(0, 1, w)[None, :]
    base = np.zeros((h, w, 3))
    for i in range(3):
        base[..., i] = top[i] * (1 - y) + bottom[i] * y
    cx, cy = rng.uniform(0.25, 0.75), rng.uniform(0.15, 0.45)
    glow = np.exp(-(((x - cx) ** 2) / 0.09 + ((y - cy) ** 2) / 0.06))
    light = 14 if name in LIGHT else 34
    base += glow[..., None] * light
    noise = rng.normal(0, 3.2, (h, w, 1))
    base += noise
    return Image.fromarray(np.clip(base, 0, 255).astype("uint8"))


def draw_strand(draw, pts, color, width, sheen_fn):
    seg = max(2, len(pts) // 24)
    for i in range(0, len(pts) - 1, seg):
        chunk = pts[i : i + seg + 1]
        if len(chunk) < 2:
            continue
        my = chunk[len(chunk) // 2][1]
        c = tint(color, sheen_fn(my))
        draw.line(chunk, fill=c, width=width, joint="curve")


def hair_field(img, shade, mode, rng, density=1.0):
    w, h = img.size
    draw = ImageDraw.Draw(img)
    color = SHADES[shade]
    light_shade = shade in ("613", "27")
    sheen_y = rng.uniform(0.25, 0.45) * h

    def sheen(y):
        d = (y - sheen_y) / (h * 0.09)
        s = math.exp(-d * d) * (0.38 if not light_shade else 0.22)
        return s + rng.uniform(-0.12, 0.06)

    left, right = w * rng.uniform(0.08, 0.22), w * rng.uniform(0.78, 0.94)
    count = int(520 * density * (w / 1800))
    top = h * rng.uniform(-0.22, -0.12)
    for k in range(count):
        x0 = rng.uniform(left, right)
        length = h * rng.uniform(0.75, 1.1)
        amp = {"straight": 3, "wave": w * 0.025, "deep": w * 0.045}[mode]
        freq = {"straight": 0.5, "wave": 2.4, "deep": 3.6}[mode]
        phase = (x0 / w) * 2.2 + rng.uniform(-0.25, 0.25)
        pts = []
        steps = 90
        drift = rng.uniform(-0.04, 0.04) * w
        for s in range(steps + 1):
            t = s / steps
            y = top + t * length
            x = x0 + math.sin(t * freq * math.pi * 2 + phase) * amp * (0.4 + t) + drift * t
            pts.append((x, y))
        width = rng.choice([1, 1, 2, 2, 3])
        jitter = rng.uniform(-0.08, 0.08)
        base = tint(color, jitter)
        draw_strand(draw, pts, base, width, sheen)


def curls(img, shade, rng, tight=False):
    w, h = img.size
    draw = ImageDraw.Draw(img)
    color = SHADES[shade]
    r_base = w * (0.018 if tight else 0.03)
    cols = int(w / (r_base * 2.1))
    for col in range(cols):
        cx = (col + 0.5) * (w / cols) + rng.uniform(-r_base, r_base)
        y = h * rng.uniform(-0.05, 0.1)
        turns = int(h / (r_base * 1.3))
        for k in range(turns):
            r = r_base * rng.uniform(0.75, 1.25)
            c = tint(color, rng.uniform(-0.25, 0.1) + (0.22 if k % 5 == 0 else 0))
            bbox = [cx - r, y - r * 0.7, cx + r, y + r * 0.7]
            draw.arc(bbox, start=rng.uniform(0, 60), end=rng.uniform(270, 350), fill=c, width=rng.choice([4, 5, 6, 7]))
            y += r * 1.05


def braids(img, shade, rng):
    w, h = img.size
    draw = ImageDraw.Draw(img)
    color = SHADES[shade]
    n = rng.randint(5, 8)
    spacing = w / (n + 0.6)
    for b in range(n):
        cx = spacing * (b + 0.8) + rng.uniform(-8, 8)
        bw = spacing * 0.34
        y = h * rng.uniform(-0.1, 0.05)
        sway = rng.uniform(-0.05, 0.05) * w
        step = bw * 0.62
        i = 0
        while y < h + bw:
            t = y / h
            x = cx + sway * t
            side = -1 if i % 2 == 0 else 1
            c = tint(color, rng.uniform(-0.05, 0.12))
            hi = tint(color, 0.35 if shade not in ("613", "27") else 0.2)
            box = [x - bw * 0.55 + side * bw * 0.22, y - step * 0.75, x + bw * 0.55 + side * bw * 0.22, y + step * 0.75]
            draw.ellipse(box, fill=c, outline=tint(color, -0.35), width=2)
            draw.arc([box[0] + 6, box[1] + 5, box[2] - 6, box[3] - 5], 200, 300, fill=hi, width=3)
            y += step
            i += 1


def care(img, accent_shade, rng):
    w, h = img.size
    draw = ImageDraw.Draw(img)
    floor = h * 0.8
    shapes = rng.randint(3, 4)
    xs = sorted(rng.uniform(0.15, 0.85) * w for _ in range(shapes))
    palette = [(91, 50, 32), (201, 154, 85), (36, 23, 15), (242, 201, 218), (160, 104, 72)]
    for i, x in enumerate(xs):
        kind = rng.choice(["bottle", "jar", "tube"])
        col = palette[(i + rng.randint(0, 4)) % len(palette)]
        if kind == "bottle":
            bw, bh = w * 0.13, h * rng.uniform(0.32, 0.45)
            draw.rounded_rectangle([x - bw / 2, floor - bh, x + bw / 2, floor], radius=int(bw * 0.25), fill=col)
            draw.rectangle([x - bw * 0.18, floor - bh - h * 0.06, x + bw * 0.18, floor - bh + 4], fill=tint(col, -0.3))
            draw.rectangle([x - bw * 0.34, floor - bh * 0.6, x + bw * 0.34, floor - bh * 0.3], fill=tint(col, 0.55))
        elif kind == "jar":
            bw, bh = w * 0.2, h * 0.16
            draw.rounded_rectangle([x - bw / 2, floor - bh, x + bw / 2, floor], radius=int(bh * 0.2), fill=col)
            draw.rounded_rectangle([x - bw * 0.54, floor - bh - h * 0.04, x + bw * 0.54, floor - bh + 6], radius=8, fill=tint(col, -0.35))
        else:
            bw, bh = w * 0.09, h * 0.3
            draw.polygon([(x - bw / 2, floor), (x + bw / 2, floor), (x + bw * 0.62, floor - bh), (x - bw * 0.62, floor - bh)], fill=col)
            draw.rectangle([x - bw * 0.3, floor - bh - h * 0.035, x + bw * 0.3, floor - bh], fill=tint(col, -0.3))
        draw.line([(x - w * 0.02, floor - h * 0.3), (x - w * 0.02, floor - h * 0.08)], fill=(255, 255, 255, 60), width=3)
    draw.rectangle([0, floor, w, h], fill=(214, 196, 168))


def render(name, size, backdrop_name, painter, seed):
    rng = random.Random(seed)
    nrng = np.random.default_rng(seed)
    w, h = size
    ss = 2
    img = backdrop(w * ss, h * ss, backdrop_name, nrng)
    painter(img, rng)
    img = img.filter(ImageFilter.GaussianBlur(0.6)).resize((w, h), Image.LANCZOS)
    img.save(OUT / f"{name}.jpg", "JPEG", quality=82, optimize=True, progressive=True)


def main():
    portrait = (960, 1200)
    wide = (1920, 1200)
    tall = (1200, 1500)
    banner = (1920, 800)
    specs = []
    # Hero and editorial
    specs.append(("hero-main", tall, "plum", lambda im, r: hair_field(im, "1b", "deep", r, 1.4), 11))
    specs.append(("hero-layer", portrait, "honey", lambda im, r: hair_field(im, "613", "wave", r, 1.2), 12))
    specs.append(("editorial-bone-straight", wide, "mist", lambda im, r: hair_field(im, "1b", "straight", r, 1.6), 13))
    specs.append(("editorial-care", wide, "pearl", lambda im, r: care(im, "27", r), 14))
    specs.append(("editorial-studio", portrait, "indigo", lambda im, r: hair_field(im, "350", "wave", r, 1.2), 15))
    specs.append(("editorial-store", portrait, "plum", lambda im, r: hair_field(im, "99j", "wave", r, 1.3), 16))
    specs.append(("promo-campaign", wide, "honey", lambda im, r: hair_field(im, "613", "wave", r, 1.2), 17))
    # Collection banners (wide)
    specs.append(("banner-futura-wig", banner, "plum", lambda im, r: hair_field(im, "99j", "wave", r, 1.5), 31))
    specs.append(("banner-bone-straight", banner, "indigo", lambda im, r: hair_field(im, "1b", "straight", r, 1.7), 32))
    specs.append(("banner-factory-wigs", banner, "mist", lambda im, r: curls(im, "4", r), 33))
    specs.append(("banner-braids-extensions", banner, "honey", lambda im, r: braids(im, "1b", r), 34))
    specs.append(("banner-hair-maintains", banner, "pearl", lambda im, r: care(im, "27", r), 35))
    # Collection covers
    specs.append(("collection-futura-wig", portrait, "rose", lambda im, r: hair_field(im, "99j", "wave", r, 1.3), 21))
    specs.append(("collection-bone-straight", portrait, "pearl", lambda im, r: hair_field(im, "1b", "straight", r, 1.5), 22))
    specs.append(("collection-factory-wigs", portrait, "mist", lambda im, r: curls(im, "4", r), 23))
    specs.append(("collection-braids-extensions", portrait, "honey", lambda im, r: braids(im, "1b", r), 24))
    specs.append(("collection-hair-maintains", portrait, "mist", lambda im, r: care(im, "27", r), 25))

    products = [
        ("futura-body-wave", ["rose", "plum", "pearl"], "99j", "wave"),
        ("futura-deep-wave-bob", ["mist", "plum", "rose"], "1b", "deep"),
        ("futura-honey-layers", ["plum", "pearl", "indigo"], "27", "wave"),
        ("futura-613-straight", ["indigo", "plum", "mist"], "613", "straight"),
        ("bone-straight-double-drawn", ["pearl", "mist", "plum"], "1b", "straight"),
        ("bone-straight-super-double", ["mist", "plum", "pearl"], "2", "straight"),
        ("bone-straight-pixie", ["rose", "pearl", "plum"], "1b", "straight"),
        ("bone-straight-bundles", ["plum", "mist", "honey"], "4", "straight"),
        ("factory-kinky-curl", ["mist", "honey", "plum"], "4", "curl"),
        ("factory-water-wave", ["pearl", "indigo", "rose"], "1b", "deep"),
        ("factory-burgundy-bob", ["plum", "rose", "mist"], "99j", "straight"),
        ("factory-pixie-curl", ["honey", "plum", "pearl"], "2", "tightcurl"),
        ("braids-knotless-xpression", ["honey", "plum", "pearl"], "1b", "braid"),
        ("braids-french-curl", ["rose", "mist", "plum"], "27", "braid"),
        ("braids-copper-boho", ["mist", "plum", "indigo"], "350", "braid"),
        ("care-edge-control", ["pearl", "mist", "rose"], "27", "care"),
        ("care-silk-bonnet", ["mist", "pearl", "honey"], "27", "care"),
        ("care-wig-grip-band", ["rose", "pearl", "mist"], "27", "care"),
        ("care-revive-spray", ["pearl", "honey", "mist"], "27", "care"),
    ]
    for pi, (handle, bgs, shade, mode) in enumerate(products):
        for vi, bg in enumerate(bgs):
            seed = 100 + pi * 10 + vi
            if mode in ("wave", "deep", "straight"):
                painter = (lambda m, s: lambda im, r: hair_field(im, s, m, r, 1.3))(mode, shade)
            elif mode == "curl":
                painter = (lambda s: lambda im, r: curls(im, s, r))(shade)
            elif mode == "tightcurl":
                painter = (lambda s: lambda im, r: curls(im, s, r, tight=True))(shade)
            elif mode == "braid":
                painter = (lambda s: lambda im, r: braids(im, s, r))(shade)
            else:
                painter = (lambda s: lambda im, r: care(im, s, r))(shade)
            specs.append((f"{handle}-{vi + 1}", portrait, bg, painter, seed))

    only = set(sys.argv[1:])
    for name, size, bg, painter, seed in specs:
        if only and name not in only:
            continue
        render(name, size, bg, painter, seed)
        print("wrote", name)


if __name__ == "__main__":
    main()
