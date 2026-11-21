# Tatuaje original del héroe: rosa de los vientos con alas, en tinta (máscara en escala de grises).
import math, sys
from PIL import Image, ImageDraw, ImageFilter

S = 4 * 512
C = S / 2


def star(d, r_out, r_in, n, rot=0, fill=255):
    pts = []
    for k in range(2 * n):
        r = r_out if k % 2 == 0 else r_in
        a = rot + math.pi * k / n
        pts.append((C + r * math.sin(a), C - r * math.cos(a)))
    d.polygon(pts, fill=fill)


def wing(d, side):
    # ala de plumas escalonadas saliendo del anillo
    for i in range(5):
        L = S * (0.27 - 0.04 * i)
        y0 = C - S * 0.07 + i * S * 0.045
        x0 = C + side * S * 0.2
        pts = [(x0, y0), (x0 + side * L, y0 - S * 0.06 + i * S * 0.012), (x0 + side * L * 0.92, y0 + S * 0.03),
               (x0, y0 + S * 0.05)]
        d.polygon(pts, fill=255)
        d.line([(x0 + side * S * 0.02, y0 + S * 0.035), (x0 + side * L * 0.85, y0 + S * 0.005)], fill=0, width=int(S * 0.008))


def main(out):
    im = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(im)
    wing(d, 1)
    wing(d, -1)
    # anillo
    R1, R2 = S * 0.215, S * 0.185
    d.ellipse([C - R1, C - R1, C + R1, C + R1], fill=255)
    d.ellipse([C - R2, C - R2, C + R2, C + R2], fill=0)
    # rosa de los vientos: estrella de 8 (diagonales más cortas) con mitades en hueco
    star(d, S * 0.27, S * 0.045, 4, 0, 255)
    star(d, S * 0.15, S * 0.03, 4, math.pi / 4, 255)
    for k in range(4):
        a = math.pi / 2 * k
        tip = (C + S * 0.27 * math.sin(a), C - S * 0.27 * math.cos(a))
        side = (C + S * 0.045 * math.sin(a + math.pi / 4), C - S * 0.045 * math.cos(a + math.pi / 4))
        d.polygon([(C, C), tip, side], fill=0)
        d.line([(C, C), tip], fill=255, width=int(S * 0.006))
    r = S * 0.025
    d.ellipse([C - r, C - r, C + r, C + r], fill=255)
    # marcas del anillo
    for k in range(24):
        a = 2 * math.pi * k / 24
        d.line([(C + R2 * math.sin(a), C - R2 * math.cos(a)), (C + (R2 - S * 0.02) * math.sin(a), C - (R2 - S * 0.02) * math.cos(a))],
               fill=255, width=int(S * 0.006))
    im = im.resize((512, 512), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.8))
    im.save(out + '/tatuaje.png')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
