# Pipeline de armas

Volver a [[Inicio]] · resultado: `armas.glb` y `animaciones_armas.glb` ([[Modelos GLB]]) · en el juego: [[models.js]], [[rig.js]]

Scripts de Blender en `tools/blender/`. Diseños propios.

| Script | Qué hace |
|---|---|
| `armas_base.py` | Herramientas de modelado hard-surface (perfiles extruidos, tornos, barridos, booleanos, bisel + normales ponderadas). Carpeta de trabajo: la variable `SF_OUT` (por defecto una carpeta de la PC de Rafael); `SF_MOTOR=CYCLES` cambia el motor de render. |
| `armas_modelos.py` | Los modelos de cada arma, en metros, con origen en el puño. Requiere `armas_base.py`. |
| `armas_horneado.py` | UV en un atlas, horneado en Cycles de color con oclusión y bordes gastados + mapa ORM. Cada arma queda con `Arma_<nombre>`, `Rareza` (se tiñe en el juego) y `Lente`. |
| `heroe_recargas.py` | Recargas y acciones (bombeo) calculadas cuadro a cuadro para el torso del héroe y las piezas móviles del arma, así la mano y el cargador no se separan. El arma sigue al hueso `Arma.R`. Cada `recarga_*` recibe como parámetros dónde queda el arma mientras se recarga (empuñadura `G1`, dirección `d1`, giro del arma `rol1`...); el primer y el último cuadro vuelven a la postura de `ARMAS` con `vuelta()`. Requiere `heroe_anim.py` y `heroe_clips.py` ([[Pipeline del héroe]]). |
| `recargas_control.py` | Control de calidad sin render: brazo metido en el torso, alcance del brazo y saltos entre cuadros. `control_recargas()` imprime una línea por clip. |
| `armas_choque.py` | Control de calidad sin render: cuánto se mete el arma en el torso, en cada pose de `ARMAS` y en cada cuadro de las recargas. Deforma el torso por código, lo corta en rebanadas de 1 cm y mide contra el casco convexo de cada rebanada (apoyar el arma en el hombro da 1-2 cm). `control_choque()` imprime una línea por pose y por recarga y devuelve los cuadros que pasan `LIMITE` (2,5 cm). No cuenta las piezas que viajan solas (cargador, cartucho, bala, cohete). |
| `armas_export.py` | Exporta `armas.glb` (rifle, escopeta, francotirador, pistola, subfusil, lanzacohetes y pico, con una pista NLA por clip) y `animaciones_armas.glb` (solo esqueleto con los clips nuevos). |

Orden para revisar antes de exportar: `heroe_anim.py`, `heroe_clips.py`, `heroe_recargas.py`, con las armas en la escena, y después `recargas_control.py`, `armas_choque.py` y `brazos_choque.py` ([[Pipeline del héroe]]).

En las recargas del rifle y de la escopeta el arma va unos 3 cm más lejos del pecho que en la primera versión (el subfusil queda donde estaba), y la cartuchera (`CARTUCHERA_L`) está 1,5 cm más adelante y afuera: así el antebrazo izquierdo no se apoya en los cargadores del chaleco. Al agarrar un cargador los dedos entran 1-1,5 cm en el bolsillo, que es lo esperable (2026-11-25).

Los clips del arma se llaman igual que los del personaje (por ejemplo `RecargaRifle`, `BombeoEscopeta`), y [[rig.js]] los reproduce juntos.
