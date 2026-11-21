# Máscaras de la cara del héroe en proyección cilíndrica alrededor del eje de la cabeza.
#   u = atan2(x, -(y - YC)) / 2π + 0.5   (u = 0.5 es el frente, x+ = izquierda del personaje)
#   v = (z - Z0) / (Z1 - Z0)
# cara_a.png: R = cejas, G = labios, B = barba de dos días
# cara_b.png: R = rubor (nariz, mejillas, orejas), G = sombra de ojeras/párpado, B = lunar/cicatriz
import math, sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

YC, Z0, Z1 = -0.055, 1.50, 1.92
W = H = 1024


def px(ang_deg, z):
    return ((ang_deg / 360.0 + 0.5) * W, (1 - (z - Z0) / (Z1 - Z0)) * H)


def blank():
    return Image.new('L', (W, H), 0)


def poly(img, pts, fill=255, blur=0):
    d = ImageDraw.Draw(img)
    d.polygon([px(a, z) for a, z in pts], fill=fill)
    return img.filter(ImageFilter.GaussianBlur(blur)) if blur else img


def ellipse(img, a, z, ra, rz, fill=255):
    d = ImageDraw.Draw(img)
    x0, y0 = px(a - ra, z + rz)
    x1, y1 = px(a + ra, z - rz)
    d.ellipse([x0, y0, x1, y1], fill=fill)
    return img


def brow(side):
    # ceja: forma de cuña, gruesa adentro y fina afuera, con un leve arco
    top, bot = [], []
    n = 24
    for i in range(n + 1):
        t = i / n
        a = 7 + 33 * t
        zc = 1.7545 + 0.0055 * math.sin(math.pi * min(1, t * 1.25)) - 0.004 * t ** 2
        th = 0.0088 * (1 - t) + 0.0036 * t
        top.append((side * a, zc + th * 0.55))
        bot.append((side * a, zc - th * 0.45))
    return top + bot[::-1]


def main(out):
    # --- cejas, con pelitos: sumo trazos finos inclinados encima de la forma base
    br = blank()
    for s in (1, -1):
        br = poly(br, brow(s), 235)
    d = ImageDraw.Draw(br)
    rng = np.random.default_rng(7)
    for s in (1, -1):
        for k in range(160):
            t = rng.random()
            a = s * (7 + 33 * t)
            zc = 1.7545 + 0.0055 * math.sin(math.pi * min(1, t * 1.25)) - 0.004 * t ** 2 + (rng.random() - 0.5) * 0.006 * (1 - 0.6 * t)
            ang = math.radians(25 + 30 * t) * s
            L = 0.0035
            x0, y0 = px(a, zc)
            x1, y1 = px(a + s * 2.2, zc + L * math.sin(abs(ang)))
            d.line([x0, y0, x1, y1], fill=255, width=2)
    br = br.filter(ImageFilter.GaussianBlur(1.6))
    # recorto pelitos que se escapan lejos de la forma
    shape = blank()
    for s in (1, -1):
        shape = poly(shape, brow(s), 255)
    shape = shape.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(4))
    br = Image.fromarray((np.asarray(br, float) * np.asarray(shape, float) / 255).astype(np.uint8))

    # --- labios: superior más fino y oscuro arriba, inferior más lleno
    li = blank()
    up, lo = [], []
    for i in range(41):
        t = -1 + 2 * i / 40
        a = 17.5 * t
        bow = 0.0016 * math.exp(-((abs(t) - 0.18) / 0.12) ** 2) - 0.0012 * math.exp(-(t / 0.08) ** 2)
        up.append((a, 1.653 + (0.0085 + bow) * (1 - abs(t) ** 2.2)))
        lo.append((a, 1.653 - 0.0105 * (1 - abs(t) ** 1.8)))
    li = poly(li, up + lo[::-1], 255, blur=3.5)

    # --- barba de dos días: mandíbula, mentón, bigote y patillas
    st = blank()
    pts = []
    for a in range(-96, 97, 4):
        aa = abs(a)
        if aa < 9:
            ztop = 1.668
        elif aa < 26:
            ztop = 1.668 - 0.004 * (aa - 9) / 17
        elif aa < 60:
            ztop = 1.664 + 0.022 * ((aa - 26) / 34) ** 1.5
        else:
            ztop = 1.686 + 0.042 * ((aa - 60) / 36)
        pts.append((a, ztop))
    for a in range(96, -97, -4):
        pts.append((a, 1.585 - 0.01 * (abs(a) / 96)))
    st = poly(st, pts, 255, blur=9)
    # sin barba sobre los labios ni en una franja bajo el labio inferior al centro
    lipm = poly(blank(), [(a, z) for a, z in up + lo[::-1]], 255).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(4))
    sa = np.asarray(st, float) * (1 - np.asarray(lipm, float) / 255)
    # granulado de pelo corto
    g = rng.random(sa.shape)
    grain = Image.fromarray((g * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    grain = np.asarray(grain, float) / 255
    sa = sa * (0.55 + 0.9 * (grain - 0.5) + 0.45)
    st = Image.fromarray(np.clip(sa, 0, 255).astype(np.uint8))

    # --- rubor: nariz, mejillas, orejas, labios
    ru = blank()
    ellipse(ru, 0, 1.689, 7, 0.010, 200)
    for s in (1, -1):
        ellipse(ru, s * 37, 1.697, 13, 0.018, 150)
        ellipse(ru, s * 92, 1.725, 10, 0.035, 230)
    ru = ru.filter(ImageFilter.GaussianBlur(14))
    # --- sombra de párpado y ojera
    so = blank()
    for s in (1, -1):
        ellipse(so, s * 24, 1.7395, 13, 0.0115, 255)
        ellipse(so, s * 25, 1.727, 9, 0.006, 120)
    so = so.filter(ImageFilter.GaussianBlur(7))
    # --- cicatriz chiquita en la ceja izquierda (detalle de personaje)
    sc = blank()
    d = ImageDraw.Draw(sc)
    x0, y0 = px(29, 1.765)
    x1, y1 = px(31.5, 1.748)
    d.line([x0, y0, x1, y1], fill=255, width=3)
    sc = sc.filter(ImageFilter.GaussianBlur(1.2))
    # la cicatriz corta la ceja
    bra = np.asarray(br, float) * (1 - np.asarray(sc.filter(ImageFilter.MaxFilter(5)), float) / 255)
    br = Image.fromarray(bra.astype(np.uint8))

    Image.merge('RGB', (br, li, st)).save(out + '/cara_a.png')
    Image.merge('RGB', (ru, so, sc)).save(out + '/cara_b.png')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
