"""Tegner app-ikonerne til PWA'en: en voxel-skyline, hvor et højhus vælter i en eksplosion.
Kør fra koelerkildekoebing-destroy/:  py tools/make_icons.py   ->  icons/*.png"""
import os, random
from PIL import Image, ImageDraw, ImageFilter

BG_TOP, BG_BOT = (28, 46, 66), (12, 21, 30)
ACCENT = (255, 138, 61)
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'icons')

def vgrad(w, h, a, b):
    im = Image.new('RGB', (w, h)); px = im.load()
    for y in range(h):
        t = y / (h - 1); c = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
        for x in range(w): px[x, y] = c
    return im

def block(d, x0, y0, w, h, cell, col, win):
    # bygning af "celler" med vinduer, som i spillet
    for gy in range(h):
        for gx in range(w):
            c = col
            if 0 < gx < w - 1 and gy % 3 != 0 and gx % 2 == 1: c = win
            d.rectangle([x0 + gx * cell, y0 + gy * cell, x0 + (gx + 1) * cell - 1, y0 + (gy + 1) * cell - 1], fill=c)

def icon(size, scale=1.0):
    S = 1024
    im = vgrad(S, S, BG_TOP, BG_BOT).convert('RGBA')
    k = scale
    lay = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    cell = int(34 * k); base = int(512 + 300 * k)
    ox = int(512 - 512 * k)
    # eksplosionens glød bag byen
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
    cx, cy, r = int(560 * k + ox), int(560 * k + (512 - 512 * k)), int(330 * k)
    gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 138, 61, 150))
    gd.ellipse([cx - r * .55, cy - r * .55, cx + r * .55, cy + r * .55], fill=(255, 214, 120, 210))
    glow = glow.filter(ImageFilter.GaussianBlur(60 * k))
    im.alpha_composite(glow)
    # stående huse
    block(d, ox + int(110 * k), base - 9 * cell, 5, 9, cell, (150, 158, 166), (110, 168, 205))
    block(d, ox + int(300 * k), base - 6 * cell, 4, 6, cell, (168, 82, 58), (120, 160, 196))
    block(d, ox + int(720 * k), base - 7 * cell, 5, 7, cell, (204, 198, 186), (110, 150, 180))
    # vælter: højhus drejet på eget lag
    tw = Image.new('RGBA', (S, S), (0, 0, 0, 0)); td = ImageDraw.Draw(tw)
    block(td, 470, 200, 5, 14, 34, (128, 140, 152), (104, 160, 198))
    tw = tw.rotate(-22, resample=Image.BICUBIC, center=(555, 676))
    if k != 1.0:
        tw = tw.resize((int(S * k), int(S * k)), Image.LANCZOS)
        layer = Image.new('RGBA', (S, S), (0, 0, 0, 0)); layer.alpha_composite(tw, (ox + int(60 * k), int(512 - 512 * k) + int(40 * k)))
        tw = layer
    else:
        layer = Image.new('RGBA', (S, S), (0, 0, 0, 0)); layer.alpha_composite(tw, (60, 40)); tw = layer
    im.alpha_composite(tw)
    im.alpha_composite(lay)
    # jord og brokker
    dd = ImageDraw.Draw(im)
    dd.rectangle([0, base, S, S], fill=(60, 62, 68)); dd.rectangle([0, base + int(26 * k), S, S], fill=(118, 84, 54))
    rnd = random.Random(7)
    for _ in range(60):
        x = rnd.uniform(400, 800) * k + ox; y = rnd.uniform(380, 820) * k + (512 - 512 * k); s = rnd.uniform(8, 22) * k
        dd.rectangle([x, y, x + s, y + s], fill=rnd.choice([(128, 140, 152), (104, 160, 198), (90, 90, 96), ACCENT]))
    return im.convert('RGB').resize((size, size), Image.LANCZOS)

os.makedirs(OUT, exist_ok=True)
for name, size, scale in [('apple-touch-icon.png', 180, 1.0), ('icon-192.png', 192, 1.0),
                          ('icon-512.png', 512, 1.0), ('icon-512-maskable.png', 512, .78)]:
    icon(size, scale).save(os.path.join(OUT, name)); print('gemt', name)
