# Ropa del héroe de Salto Final, generada sobre la malla base 'Cuerpo' de heroe.blend.
# Requiere sf_tools.py cargado (builtins.SF). Cada función rehace su prenda desde cero.
import bpy, math
from mathutils import Vector

ss = SF.ss


def chaleco():
    def mask(c, n):
        if c.z < 0.97 or c.z > 1.66 or abs(c.x) > 0.30:
            return False
        t, perp = SF.arm_t(c)
        return not (t > 0.10 and perp < 0.10)

    def off(c):
        return 0.022 + 0.006 * ss(1.15, 1.35, c.z)

    def f_arm(c):
        xa = 0.168 + 0.095 * ss(1.47, 1.25, c.z) - 0.012 * ss(0.0, -0.08, c.y) * ss(1.45, 1.30, c.z)
        return abs(c.x) - xa

    f = SF.fmax(
        lambda c: (1.03 + 0.012 * ss(-0.02, 0.04, c.y)) - c.z,                    # ruedo
        f_arm,                                                                  # sisas
        lambda c: min(0.48 * (c.z - 1.335) - abs(c.x), -c.y - 0.01),            # escote en V
        lambda c: min(c.z - (1.548 + 5.0 * c.x * c.x), c.y),                    # escote trasero
        lambda c: min(0.09 - math.hypot(c.x, (c.y - 0.01) * 1.1), c.z - 1.47),  # cuello
        lambda c: c.z - 1.61)
    ob = SF.garment2('Chaleco', mask, off, field=f, smooth=6, subdiv=1,
                     mat=SF.material('M_Chaleco', (0.30, 0.055, 0.045, 1), rough=0.8), edge_smooth=5)
    SF.add_mods(ob, thick=0.014, levels=2)
    cuero = SF.material('M_RibeteChaleco', (0.16, 0.07, 0.05, 1), rough=0.55)
    SF.trims(ob, 'RibeteChaleco', 0.0085, mat=cuero, thick=0.014)
    return ob


def remera():
    def mask(c, n):
        if c.z < 0.93 or c.z > 1.68 or abs(c.x) > 0.30:
            return False
        t, perp = SF.arm_t(c)
        return not (abs(c.x) > 0.21 and not (t < 0.6 and perp < 0.11))

    def off(c):
        t, perp = SF.arm_t(c)
        return 0.006 + 0.006 * ss(0.15, 0.40, t) * (perp < 0.11)

    def f_sleeve(c):
        t, perp = SF.arm_t(c)
        return min(t - 0.43, 0.09 - perp)

    f = SF.fmax(f_sleeve, lambda c: c.z - (1.555 + 0.25 * c.y), lambda c: 0.955 - c.z)
    mat = SF.material('M_Camiseta', (0.06, 0.065, 0.07, 1), rough=0.9)
    ob = SF.garment2('Camiseta', mask, off, field=f, smooth=5, subdiv=1, mat=mat, edge_smooth=5)
    SF.add_mods(ob, thick=0.005, levels=2)
    SF.trims(ob, 'RibeteCamiseta', 0.0055, mat=mat, thick=0.005, select=lambda c, lp: c.z > 1.1)
    return ob


def _thumb(c):
    sx = 1 if c.x > 0 else -1
    T1 = Vector((sx * 0.415, -0.095, 0.935))
    T3 = Vector((sx * 0.41, -0.207, 0.882))
    d = (T3 - T1).normalized()
    t = (c - T1).dot(d)
    return t, (c - (T1 + d * t)).length


def guantes():
    mat = SF.material('Guante', (0.03, 0.035, 0.04, 1), rough=0.45)
    out = []
    for side, sx in (('I', 1), ('D', -1)):
        def mask(c, n, sx=sx):
            return c.x * sx > 0.33 and SF.hand_proj(c) > -0.075

        def f_th(c):
            t, p = _thumb(c)
            return min(t - 0.08, 0.024 - p)

        f = SF.fmax(lambda c: -0.055 - SF.hand_proj(c), lambda c: SF.hand_proj(c) - 0.148, f_th)
        g = SF.garment2('Guante' + side, mask, lambda c: 0.0035, field=f, smooth=1, smooth_fac=0.3, subdiv=1,
                        post_smooth=1, mat=mat, edge_smooth=4)
        SF.add_mods(g, thick=0.003, levels=1)
        out.append(g)
    return out


def pantalon():
    def mask(c, n):
        return 0.2 < c.z < 1.12 and abs(c.x) < 0.30

    f = SF.fmax(lambda c: 0.275 - c.z, lambda c: c.z - (1.065 - 0.01 * ss(0.02, -0.04, c.y)))
    ob = SF.garment2('Pantalon', mask, SF.pants_off, field=f, smooth=6, subdiv=1,
                     mat=SF.material('M_Pantalon', (0.20, 0.22, 0.12, 1), rough=0.9), edge_smooth=4)
    SF.add_mods(ob, thick=0.006, levels=2)
    return ob


def todo():
    chaleco()
    remera()
    guantes()
    pantalon()
