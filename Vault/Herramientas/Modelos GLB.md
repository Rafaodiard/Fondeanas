# Modelos GLB

Volver a [[Inicio]]

Carpeta `public/models/`. Los carga [[assets.js]]; si alguno falla, [[models.js]] usa primitivas.

| Archivo | Qué es | Quién lo usa | Materiales que se tiñen |
|---|---|---|---|
| `personaje.glb` | Héroe con esqueleto y clips | [[rig.js]], [[models.js]] | `Ropa` (color del jugador) |
| `animaciones_armas.glb` | Solo esqueleto + clips de recarga y bombeo | se suman a los clips de `personaje` en [[assets.js]] | |
| `armas.glb` | Seis armas + pico (nodo por arma, piezas móviles como nodos propios) | [[models.js]], [[rig.js]] | `Rareza` |
| `bus.glb` | Bus volador | [[models.js]] | |
| `planeador.glb` | Planeador | [[models.js]], [[rig.js]] | `Tela` |
| `objetos.glb` | Objetos del piso (consumibles, munición, materiales) | [[models.js]] | `Tinte`, `Mat` |
| `casa.glb` | Casa (vieja) | nadie: ya no se carga, las casas del mapa salen de [[planos.js]] | |
| `cofre.glb` | Cofre | [[world.js]] | |
| `pino.glb`, `arbol.glb` | Árboles (instanciados) | [[world.js]] | |
| `roca.glb` | Roca (instanciada) | [[world.js]] | |

## De dónde salen

- `personaje.glb`: `heroe_export.py` → [[Pipeline del héroe]].
- `armas.glb` y `animaciones_armas.glb`: `armas_export.py` → [[Pipeline de armas]].
- Bus, planeador, casa, cofre, árboles, roca y objetos: no hay script en el repo que los genere; están solo los GLB.

## Convenciones (según los comentarios de los scripts)

- Arma: origen en el centro del puño derecho, cañón +Y, arriba +Z en Blender (en glTF queda cañón -Z, arriba +Y). Coincide con el hueso `Arma.R` del héroe.
- Piezas móviles de cada arma como nodos `<arma>_<pieza>` (cargador, cerrojo, bomba, corredera, cohete, cartucho, bala) y vacíos de referencia `<arma>_boca`, `<arma>_mira`, `<arma>_apoyo`.
