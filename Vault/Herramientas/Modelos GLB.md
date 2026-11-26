# Modelos GLB

Volver a [[Inicio]]

Carpeta `public/models/`. Los carga [[assets.js]]; si alguno falla, [[models.js]] usa primitivas.

| Archivo | Qué es | Quién lo usa | Materiales que se tiñen |
|---|---|---|---|
| `personaje.glb` | Héroe con esqueleto y clips | [[rig.js]], [[models.js]] | `Ropa` (color del jugador) |
| `animaciones_armas.glb` | Solo esqueleto + clips de recarga y bombeo | se suman a los clips de `personaje` en [[assets.js]] | |
| `armas.glb` | Seis armas + pico (nodo por arma, piezas móviles como nodos propios) | [[models.js]], [[rig.js]] | `Rareza` |
| `bus.glb` | Bus volador: nodos `Carroceria`, `Helice_D`, `Helice_I` bajo `Bus` | [[models.js]] | (ninguno; `Baliza` y `Destello` destellan) |
| `animaciones_caida.glb` | Solo esqueleto + clips de caída libre, paracaídas, aterrizaje y deslizarse | se suman a los clips de `personaje` en [[assets.js]] | |
| `paracaidas.glb` | Paracaídas (vela con formas `Plegado`, `FrenoL`, `FrenoR` y vacíos `Freno_L/R` para las cuerdas de los frenos) | [[models.js]], [[rig.js]] | `Tela` |
| `objetos.glb` | Objetos del piso: un nodo `objetos_<nombre>` por objeto (vendas, botiquín, frasco, bidón, `municion_<tipo>` ×5, `material_<material>` ×3) | [[loot.js]] | `Tinte` (franja de la munición y banda del cohete) |
| `casa.glb` | Casa (vieja) | nadie: ya no se carga, las casas del mapa salen de [[planos.js]] | |
| `cofre.glb` | Cofre: `cofre_cuerpo` y `cofre_tapa` (pivote en la bisagra, abre girando sobre X) | [[loot.js]] | `BrilloCofre` (se clona para apagarlo por cofre) |
| `pino.glb`, `arbol.glb` | Árboles (instanciados) | [[world.js]] | |
| `roca.glb` | Roca (instanciada) | [[world.js]] | |

## De dónde salen

- `personaje.glb`: `heroe_export.py` → [[Pipeline del héroe]].
- `armas.glb` y `animaciones_armas.glb`: `armas_export.py` → [[Pipeline de armas]].
- `bus.glb`: `bus.py` → [[Pipeline del bus]].
- `cofre.glb` y `objetos.glb`: `loot_modelos.py` + `loot_export.py` → [[Pipeline del loot]].
- `animaciones_caida.glb`: `heroe_caida.py` (`exportar_caida`) → [[Pipeline del héroe]].
- `paracaidas.glb`: `paracaidas.py` (`hacer_paracaidas`, `exportar_paracaidas`) → [[Pipeline del héroe]].
- `planeador.glb` se borró el 2026-11-25: lo reemplazó el paracaídas. Si `paracaidas.glb` no carga, [[models.js]] arma un planeador con primitivas.
- Casa, árboles y roca: no hay script en el repo que los genere; están solo los GLB.

## Convenciones (según los comentarios de los scripts)

- Arma: origen en el centro del puño derecho, cañón +Y, arriba +Z en Blender (en glTF queda cañón -Z, arriba +Y). Coincide con el hueso `Arma.R` del héroe.
- Piezas móviles de cada arma como nodos `<arma>_<pieza>` (cargador, cerrojo, bomba, corredera, cohete, cartucho, bala) y vacíos de referencia `<arma>_boca`, `<arma>_mira`, `<arma>_apoyo`.
