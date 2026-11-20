# Cabeza del héroe: pelo (undercut con jopo), bufanda y antiparras. Requiere sf_tools (SF) cargado.
import bpy, math
from mathutils import Vector

ss = SF.ss
HC = Vector((0, -0.055, 1.74))  # centro aproximado del cráneo


def _az(c):
    # Azimut alrededor del eje vertical de la cabeza: 0 = frente (-Y), 90 = costado, 180 = nuca.
    return math.degrees(math.atan2(abs(c.x), -(c.y - HC.y)))


def _tab(tab, a):
    for (a0, z0), (a1, z1) in zip(tab, tab[1:]):
        if a0 <= a <= a1:
            t = (a - a0) / (a1 - a0)
            t = t * t * (3 - 2 * t)
            return z0 + (z1 - z0) * t
    return tab[-1][1]


HAIRLINE = [(0, 1.797), (30, 1.79), (55, 1.778), (66, 1.735), (74, 1.712), (84, 1.712), (90, 1.775), (118, 1.778),
            (132, 1.695), (155, 1.665), (180, 1.655)]


def hairline(c):
    a = _az(c)
    z = _tab(HAIRLINE, a)
    if a < 50:
        z += 0.006 * abs(math.sin(c.x * 60)) * (1 - a / 50)
    return z


def _scalp(c, n):
    return c.z > 1.63 and (c.z > 1.75 or _az(c) > 60) and not (abs(c.x) > 0.09 and 1.69 < c.z < 1.772 and -0.075 < c.y < 0.0)


def pelo():
    corto = SF.material('M_PeloCorto', (0.028, 0.018, 0.012, 1), rough=0.9)
    largo = SF.material('Pelo', (0.055, 0.032, 0.018, 1), rough=0.55)
    pc = SF.garment2('PeloCorto', _scalp, lambda c: 0.0022, field=lambda c: hairline(c) - c.z, smooth=2, subdiv=1,
                     post_smooth=1, mat=corto, edge_smooth=4)
    SF.add_mods(pc, thick=0.0015, levels=1)

    def xw(c):
        return 0.068 + 0.012 * ss(-0.10, 0.04, c.y) + 0.004 * math.sin(c.y * 95)

    def zt(c):
        return 1.786 - 0.012 * ss(-0.02, 0.06, c.y)

    f_top = SF.fmax(lambda c: abs(c.x) - xw(c), lambda c: hairline(c) - c.z, lambda c: zt(c) - c.z)

    def height(c):
        front = ss(0.03, -0.12, c.y)
        crown = max(0.0, 1 - (c.x / 0.075) ** 2)
        return 0.0045 + 0.020 * front + 0.007 * crown + 0.008 * ss(-0.10, -0.155, c.y)

    def strands(c):
        fade = ss(0.0, 0.014, xw(c) - abs(c.x))
        ph = 0.012 * math.sin(c.y * 24) + 0.004 * math.sin(c.y * 61 + c.x * 30)
        g = math.cos(2 * math.pi * (c.x + ph) / 0.024)
        lump = 0.5 + 0.5 * math.sin(c.y * 40 + c.x * 90)
        return (0.0032 * g + 0.0015 * lump) * fade

    top = SF.garment2('PeloArriba', _scalp, height, field=f_top, smooth=2, subdiv=2, post_smooth=2, mat=largo,
                      edge_smooth=5, detail=strands)
    SF.add_mods(top, thick=0.03, levels=2, offset=-1.0)
    return pc, top
