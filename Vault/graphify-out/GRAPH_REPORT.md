# Graph Report - Fondeanas  (2026-11-24)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 688 nodes · 1770 edges · 23 communities (22 shown, 1 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 227 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `762039e1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Cabeza del héroe (Blender)
- Clips del héroe
- Servidor y datos compartidos
- Recargas de armas
- Modelado de armas
- Herramientas de modelado
- Rig y carga de modelos
- Mundo e isla
- Cliente: escena y estado
- Materiales del héroe
- Animación base y export
- Malla del juego del héroe
- Cliente: bucle y controles
- Cliente: red y mensajes
- package.json
- Cliente: disparo y efectos
- Choque de armas y texturas de cara
- Cliente: inventario y HUD
- Horneado de armas
- Audio
- README
- Cliente: slots
- Control de recargas

## God Nodes (most connected - your core abstractions)
1. `World` - 33 edges
2. `G` - 27 edges
3. `handle()` - 27 edges
4. `handleGame()` - 21 edges
5. `Pose` - 19 edges
6. `V()` - 18 edges
7. `prisma()` - 16 edges
8. `Agarre` - 15 edges
9. `pose_baile()` - 15 edges
10. `S()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `startMatch()` --calls--> `World`  [EXTRACTED]
  server.js → public/js/world.js
- `hacer()` --calls--> `grabar()`  [INFERRED]
  tools/blender/heroe_clips.py → tools/blender/heroe_anim.py
- `grabar_recarga()` --calls--> `grabar()`  [INFERRED]
  tools/blender/heroe_recargas.py → tools/blender/heroe_anim.py
- `exportar()` --calls--> `todos()`  [INFERRED]
  tools/blender/heroe_export.py → tools/blender/heroe_clips.py
- `M3()` --calls--> `q_eje()`  [INFERRED]
  tools/blender/heroe_clips.py → tools/blender/heroe_anim.py

## Import Cycles
- None detected.

## Communities (23 total, 1 thin omitted)

### Community 0 - "Cabeza del héroe (Blender)"
Cohesion: 0.05
Nodes (53): exportar_armas(), exportar_clips(), pistas_piezas(), reposo_piezas(), _seleccion(), _ver_colecciones(), _fcurves(), grabar() (+45 more)

### Community 1 - "Clips del héroe"
Cohesion: 0.12
Nodes (38): reposo(), arma_en_manos(), base(), brazo(), brazos_sueltos(), clamp(), Claves, columna() (+30 more)

### Community 2 - "Servidor y datos compartidos"
Cohesion: 0.08
Nodes (51): AMMO, BUILD_COST, CHEST_WEIGHTS, CONSUMABLES, DIRS, FLOOR_WEIGHTS, GRID, MATERIALS (+43 more)

### Community 3 - "Recargas de armas"
Cohesion: 0.11
Nodes (40): rot_agarre(), rot_mano(), a_arma(), AG_EMPUNADURA(), AG_GUARDAMANOS(), AG_LIBRE(), AG_PISTOLA_L(), AG_VERTICAL_L() (+32 more)

### Community 4 - "Modelado de armas"
Cohesion: 0.16
Nodes (35): _a3(), acabado(), arco(), Arma, barrido(), caja(), coleccion(), cortador() (+27 more)

### Community 5 - "Herramientas de modelado"
Cohesion: 0.08
Nodes (35): apply_mods(), border_loops(), _cast(), _catmull(), clean_border(), coll(), cyl(), falloff() (+27 more)

### Community 6 - "Rig y carga de modelos"
Cohesion: 0.09
Nodes (46): three@^0.170.0, ANIMS, ASSETS, bakedParts(), cloneAsset(), FILES, loadAssets(), BOCA (+38 more)

### Community 7 - "Mundo e isla"
Cohesion: 0.09
Nodes (12): houseTints, makeNoise(), makeStructMesh(), mergeCones(), MODEL, pushOut(), rng(), SEA_LEVEL (+4 more)

### Community 8 - "Cliente: escena y estado"
Cohesion: 0.05
Nodes (36): MAT_ORDER, RARITIES, btns, camera, camRay, camTarget, canvas, CAUSES (+28 more)

### Community 9 - "Materiales del héroe"
Cohesion: 0.24
Nodes (15): bufanda(), _c(), chaleco(), correa(), cuero(), G, lisa(), ojos() (+7 more)

### Community 10 - "Animación base y export"
Cohesion: 0.23
Nodes (3): Pose, rec(), q_eje()

### Community 11 - "Malla del juego del héroe"
Cohesion: 0.14
Nodes (24): coleccion_low(), _dilatar(), _editar(), _es_cabeza(), _es_interior(), _escalar_uv(), fuentes(), _guardar() (+16 more)

### Community 12 - "Cliente: bucle y controles"
Cohesion: 0.15
Nodes (22): canAim(), doInteract(), drawMinimap(), dropHeld(), frame(), heldItem(), jumpFromBus(), now() (+14 more)

### Community 13 - "Cliente: red y mensajes"
Cohesion: 0.12
Nodes (24): addChat(), addDmgNum(), connect(), ensureWorld(), enter(), escapeHtml(), explosionFx(), handle() (+16 more)

### Community 14 - "package.json"
Cohesion: 0.13
Nodes (15): author, dependencies, ws@^8.18.0, description, engines, node, keywords, license (+7 more)

### Community 15 - "Cliente: disparo y efectos"
Cohesion: 0.28
Nodes (9): addRocket(), addTracer(), castRay(), headDepth(), rayVsSphere(), sparks(), structOf(), tryShoot() (+1 more)

### Community 16 - "Choque de armas y texturas de cara"
Cohesion: 0.16
Nodes (17): casco(), control_choque(), pts(), _prep(), profundidad(), puntos_arma(), rec(), torso() (+9 more)

### Community 17 - "Cliente: inventario y HUD"
Cohesion: 0.28
Nodes (9): itemColor(), itemLabel(), addItem(), feed(), findInteract(), onInventory(), setupMatch(), updateHp() (+1 more)

### Community 18 - "Horneado de armas"
Cohesion: 0.42
Nodes (9): hornear(), _imagen(), _mat_horneo(), _material_final(), _objs_exp(), _seleccionar(), _sk(), _unificar() (+1 more)

### Community 19 - "Audio"
Cohesion: 0.43
Nodes (6): ac(), burst(), noiseBuffer(), sfx, SHOTS, tone()

### Community 20 - "README"
Cohesion: 0.29
Nodes (6): Capturas, Controles, Cómo jugar en tu compu, Estructura, Mecánicas, Salto Final

### Community 21 - "Cliente: slots"
Cohesion: 0.31
Nodes (9): buildTarget(), cancelUse(), clearGhost(), selectSlot(), setBuild(), startReload(), updateBuild(), updateSlots() (+1 more)

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `World` connect `Mundo e isla` to `Cliente: escena y estado`, `Servidor y datos compartidos`, `Cliente: red y mensajes`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `Cabeza del héroe (Blender)` be split into smaller, more focused modules?**
  _Cohesion score 0.050351721584598295 - nodes in this community are weakly interconnected._
- **Why does `Pose` connect `Animación base y export` to `Cabeza del héroe (Blender)`, `Clips del héroe`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `Clips del héroe` be split into smaller, more focused modules?**
  _Cohesion score 0.12343358395989974 - nodes in this community are weakly interconnected._
- **Why does `escena()` connect `Modelado de armas` to `Horneado de armas`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Should `Servidor y datos compartidos` be split into smaller, more focused modules?**
  _Cohesion score 0.08082706766917293 - nodes in this community are weakly interconnected._
- **Should `Recargas de armas` be split into smaller, more focused modules?**
  _Cohesion score 0.11043771043771043 - nodes in this community are weakly interconnected._