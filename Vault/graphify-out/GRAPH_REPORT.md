# Graph Report - Fondeanas  (2026-11-24)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 865 nodes · 2200 edges · 32 communities (30 shown, 2 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 298 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `75f269fc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Ropa, cabeza, rig y export del héroe
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
- Planos de estructuras
- Cliente: disparo y efectos
- Choque de armas
- Cliente: inventario y HUD
- Horneado de armas
- Audio
- README
- Cliente: slots
- Control de recargas
- Datos de la isla y estructuras
- Terreno y armado del mapa
- Colisión y sólidos
- Mallas del mapa
- Planos: casas y muebles
- Pruebas del mapa
- Planos: muelle y galpón
- Planos: jardín y locales

## God Nodes (most connected - your core abstractions)
1. `Plano` - 80 edges
2. `World` - 52 edges
3. `G` - 27 edges
4. `handle()` - 27 edges
5. `handleGame()` - 21 edges
6. `Pose` - 19 edges
7. `V()` - 18 edges
8. `Solidos` - 17 edges
9. `prisma()` - 16 edges
10. `Agarre` - 15 edges

## Surprising Connections (you probably didn't know these)
- `subir()` --calls--> `Solidos`  [EXTRACTED]
  tools/mapa/pruebas.mjs → public/js/colision.js
- `startMatch()` --calls--> `World`  [EXTRACTED]
  server.js → public/js/world.js
- `handleGame()` --calls--> `weaponReload()`  [EXTRACTED]
  server.js → public/js/items.js
- `alcance()` --calls--> `Solidos`  [EXTRACTED]
  tools/mapa/pruebas.mjs → public/js/colision.js
- `main()` --indirect_call--> `S()`  [INFERRED]
  tools/texturas/tatuaje.py → tools/blender/heroe_clips.py

## Import Cycles
- None detected.

## Communities (32 total, 2 thin omitted)

### Community 0 - "Ropa, cabeza, rig y export del héroe"
Cohesion: 0.07
Nodes (42): antiparras(), _az(), bufanda(), hairline(), pelo(), height(), strands(), xw() (+34 more)

### Community 1 - "Clips del héroe"
Cohesion: 0.12
Nodes (38): reposo(), arma_en_manos(), base(), brazo(), brazos_sueltos(), clamp(), Claves, columna() (+30 more)

### Community 2 - "Servidor y datos compartidos"
Cohesion: 0.08
Nodes (51): AMMO, BUILD_COST, CHEST_WEIGHTS, CONSUMABLES, DIRS, FLOOR_WEIGHTS, MAT_ORDER, MAX_MATS (+43 more)

### Community 3 - "Recargas de armas"
Cohesion: 0.11
Nodes (41): grabar(), rot_agarre(), rot_mano(), a_arma(), AG_EMPUNADURA(), AG_GUARDAMANOS(), AG_LIBRE(), AG_PISTOLA_L() (+33 more)

### Community 4 - "Modelado de armas"
Cohesion: 0.13
Nodes (38): _a3(), acabado(), arco(), Arma, barrido(), caja(), coleccion(), cortador() (+30 more)

### Community 5 - "Herramientas de modelado"
Cohesion: 0.08
Nodes (35): apply_mods(), border_loops(), _cast(), _catmull(), clean_border(), coll(), cyl(), falloff() (+27 more)

### Community 6 - "Rig y carga de modelos"
Cohesion: 0.06
Nodes (61): author, dependencies, three@^0.170.0, ws@^8.18.0, description, engines, node, keywords (+53 more)

### Community 7 - "Mundo e isla"
Cohesion: 0.17
Nodes (5): cerca(), catmull(), resample(), rot2(), World

### Community 8 - "Cliente: escena y estado"
Cohesion: 0.05
Nodes (35): btns, camera, camRay, camTarget, canvas, CAUSES, _cd, clock (+27 more)

### Community 9 - "Materiales del héroe"
Cohesion: 0.24
Nodes (15): bufanda(), _c(), chaleco(), correa(), cuero(), G, lisa(), ojos() (+7 more)

### Community 10 - "Animación base y export"
Cohesion: 0.12
Nodes (11): Pose, rec(), q_eje(), rad(), bm_rigid_head(), cuerpo_pesos(), reglas(), _sel() (+3 more)

### Community 11 - "Malla del juego del héroe"
Cohesion: 0.10
Nodes (32): exportar_armas(), exportar_clips(), pistas_piezas(), reposo_piezas(), _seleccion(), _ver_colecciones(), _fcurves(), coleccion_low() (+24 more)

### Community 12 - "Cliente: bucle y controles"
Cohesion: 0.14
Nodes (18): buildTarget(), cancelUse(), clearGhost(), doInteract(), drawMinimap(), dropHeld(), frame(), jumpFromBus() (+10 more)

### Community 13 - "Cliente: red y mensajes"
Cohesion: 0.14
Nodes (22): addChat(), addDmgNum(), addItem(), connect(), ensureWorld(), escapeHtml(), explosionFx(), handle() (+14 more)

### Community 14 - "Planos de estructuras"
Cohesion: 0.08
Nodes (39): andamio(), antena(), arco(), auto(), banco(), calesita(), campo(), capilla() (+31 more)

### Community 15 - "Cliente: disparo y efectos"
Cohesion: 0.22
Nodes (11): addRocket(), addTracer(), castRay(), headDepth(), rayVsSphere(), sparks(), structOf(), tryShoot() (+3 more)

### Community 16 - "Choque de armas"
Cohesion: 0.36
Nodes (8): casco(), control_choque(), pts(), _prep(), profundidad(), puntos_arma(), rec(), torso()

### Community 17 - "Cliente: inventario y HUD"
Cohesion: 0.33
Nodes (7): itemColor(), itemLabel(), feed(), findInteract(), onInventory(), updateHud(), updatePrompt()

### Community 18 - "Horneado de armas"
Cohesion: 0.42
Nodes (9): hornear(), _imagen(), _mat_horneo(), _material_final(), _objs_exp(), _seleccionar(), _sk(), _unificar() (+1 more)

### Community 19 - "Audio"
Cohesion: 0.43
Nodes (6): ac(), burst(), noiseBuffer(), sfx, SHOTS, tone()

### Community 20 - "README"
Cohesion: 0.22
Nodes (8): Capturas, Controles, Cómo jugar en tu compu, El mapa, Estructura, La isla, Mecánicas, Salto Final

### Community 21 - "Cliente: slots"
Cohesion: 0.23
Nodes (14): weaponReload(), canAim(), heldItem(), selectSlot(), startReload(), startUse(), tryUseHeld(), updateCamera() (+6 more)

### Community 23 - "Datos de la isla y estructuras"
Cohesion: 0.12
Nodes (18): PUEBLOS, RIO, RUTAS, SUELTOS, TELEFERICO, GRID, MATERIALS, CALLE_COLOR (+10 more)

### Community 24 - "Terreno y armado del mapa"
Cohesion: 0.14
Nodes (7): materialesMapa(), patchMaterial(), terrainDetail(), aguaShader(), bump(), mergeCones(), smoothstep()

### Community 25 - "Colisión y sólidos"
Cohesion: 0.19
Nodes (6): rayBox(), Solidos, STEP, pushOut(), alcance(), penetra()

### Community 26 - "Mallas del mapa"
Cohesion: 0.17
Nodes (9): aoShade(), _c, colorCache, colorOf(), KINDS, Lote, UP, PALETA (+1 more)

### Community 27 - "Planos: casas y muebles"
Cohesion: 0.22
Nodes (14): adobe(), cabana(), cama(), casa(), cobertizo(), edificio(), estante(), laboratorio() (+6 more)

### Community 29 - "Pruebas del mapa"
Cohesion: 0.24
Nodes (7): PLANOS, fail(), llegar(), sim(), subir(), w, world

### Community 30 - "Planos: muelle y galpón"
Cohesion: 0.29
Nodes (8): barril(), barriles(), bote(), boteEn(), caja(), caja3(), galpon(), muelle()

### Community 31 - "Planos: jardín y locales"
Cohesion: 0.29
Nodes (7): buzon(), cantero(), estacion(), jardin(), local(), merge(), seto()

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `World` connect `Mundo e isla` to `Servidor y datos compartidos`, `Cliente: escena y estado`, `Cliente: red y mensajes`, `Datos de la isla y estructuras`, `Terreno y armado del mapa`, `Colisión y sólidos`, `Pruebas del mapa`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Should `Ropa, cabeza, rig y export del héroe` be split into smaller, more focused modules?**
  _Cohesion score 0.06836055656382335 - nodes in this community are weakly interconnected._
- **Why does `Plano` connect `Planos de estructuras` to `Mundo e isla`, `Datos de la isla y estructuras`, `Planos: casas y muebles`, `Planos: piezas básicas`, `Planos: muelle y galpón`, `Planos: jardín y locales`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `Clips del héroe` be split into smaller, more focused modules?**
  _Cohesion score 0.12343358395989974 - nodes in this community are weakly interconnected._
- **Why does `three` connect `Rig y carga de modelos` to `Cliente: escena y estado`, `Mallas del mapa`, `Datos de la isla y estructuras`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `Servidor y datos compartidos` be split into smaller, more focused modules?**
  _Cohesion score 0.07832080200501253 - nodes in this community are weakly interconnected._
- **Should `Recargas de armas` be split into smaller, more focused modules?**
  _Cohesion score 0.10714285714285714 - nodes in this community are weakly interconnected._