# Pipeline de armas

Volver a [[Inicio]] · resultado: `armas.glb` y `animaciones_armas.glb` ([[Modelos GLB]]) · en el juego: [[models.js]], [[rig.js]]

Scripts de Blender en `tools/blender/`. Diseños propios.

| Script | Qué hace |
|---|---|
| `armas_base.py` | Herramientas de modelado hard-surface (perfiles extruidos, tornos, barridos, booleanos, bisel + normales ponderadas). Carpeta de trabajo: la variable `SF_OUT` (por defecto una carpeta de la PC de Rafael); `SF_MOTOR=CYCLES` cambia el motor de render. |
| `armas_modelos.py` | Los modelos de cada arma, en metros, con origen en el puño. Requiere `armas_base.py`. |
| `armas_horneado.py` | UV en un atlas, horneado en Cycles de color con oclusión y bordes gastados + mapa ORM. Cada arma queda con `Arma_<nombre>`, `Rareza` (se tiñe en el juego) y `Lente`. |
| `heroe_recargas.py` | Recargas y acciones (bombeo) calculadas cuadro a cuadro para el torso del héroe y las piezas móviles del arma, así la mano y el cargador no se separan. El arma sigue al hueso `Arma.R`. Requiere `heroe_anim.py` y `heroe_clips.py` ([[Pipeline del héroe]]). |
| `recargas_control.py` | Control de calidad sin render: brazo metido en el torso, alcance del brazo y saltos entre cuadros. `control_recargas()` imprime una línea por clip. |
| `armas_export.py` | Exporta `armas.glb` (rifle, escopeta, francotirador, pistola, subfusil, lanzacohetes y pico, con una pista NLA por clip) y `animaciones_armas.glb` (solo esqueleto con los clips nuevos). |

Los clips del arma se llaman igual que los del personaje (por ejemplo `RecargaRifle`, `BombeoEscopeta`), y [[rig.js]] los reproduce juntos.
