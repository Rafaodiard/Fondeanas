# Pipeline del héroe

Volver a [[Inicio]] · resultado: `personaje.glb` ([[Modelos GLB]]) · en el juego: [[rig.js]]

Scripts de Blender en `tools/blender/`, que se ejecutan en Blender (5.x) en el mismo espacio de nombres. Casi todos requieren [[sf_tools.py]] cargado antes (`builtins.SF`).

| Script | Qué hace |
|---|---|
| `heroe_ropa.py` | Ropa generada sobre la malla base `Cuerpo` de `heroe.blend` (chaleco, etc.). Cada función rehace su prenda desde cero. |
| `heroe_cabeza.py` | Pelo (undercut con jopo), bufanda y antiparras. |
| `heroe_materiales.py` | Materiales procedurales para hornear a la textura del juego. Usa las imágenes de [[Texturas]]. |
| `heroe_juego.py` | Malla del juego: copias livianas de cada pieza, atlas UV común (2048), horneado desde la alta (color, normal, rugosidad, AO) y unión. |
| `heroe_rig.py` | Esqueleto `Esqueleto` y pesos de la malla `HeroeJuego`. |
| `heroe_anim.py` | Base de animación por código: poses en espacio del personaje, IK analítica de dos huesos, `Pose`, `grabar`. 30 fps. |
| `heroe_clips.py` | Clips: locomoción con pies plantados (`MARCHAS`: Caminar, Trote, Correr, Sprint), aire, pico, poses de armas (`ARMAS`: Rifle, RifleApunta, Pistola, PistolaApunta, Lanzacohetes...) y baile. Requiere `heroe_anim.py`. |
| `heroe_export.py` | Exporta malla con piel, esqueleto (con el hueso `Arma.R`), todas las acciones y texturas WebP. Sube el esqueleto 0,032 para que la suela quede en y = 0. Requiere `heroe_anim.py` y `heroe_clips.py`. |

Las recargas y el bombeo del héroe salen de [[Pipeline de armas]] (`heroe_recargas.py`).
