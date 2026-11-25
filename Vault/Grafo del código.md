# Grafo del código

Volver a [[Inicio]] · reglas en [[Mantenimiento del vault]]

El grafo está en `Vault/graphify-out/`, generado con [graphify](https://pypi.org/project/graphifyy/) (paquete pip `graphifyy`) a partir del código del repo. La extracción es solo estructural (AST), sin LLM ni claves de API.

- `graph.html`: grafo interactivo, se abre en el navegador.
- `GRAPH_REPORT.md`: resumen (nodos más conectados, comunidades, conexiones sorprendentes).
- `graph.json`: los datos crudos. Se puede consultar con `graphify query "<pregunta>" --graph Vault/graphify-out/graph.json`, `graphify explain "<nodo>"` o `graphify path "A" "B"`.
- `.graphify_labels.json`: nombres de las comunidades, puestos a mano.

Última generación: 2026-11-25, en la PC de Rafael con graphify 0.9.95 (`graphifyy` instalado con `uv tool`), sobre el código del commit `75f269f` de la rama `claude/project-thread-vbeczu` (el mapa nuevo con el pulido de armas ya mergeado). 865 nodos, 2200 relaciones, 32 comunidades (el reporte omite 2 por chicas: *Control de recargas* y *Planos: piezas básicas*).

## Cómo regenerarlo

Desde la raíz del repo, en la PC de Rafael (ver [[Graphify de la PC de Rafael]]):

```bash
pip install graphifyy
GRAPHIFY_OUT=Vault/graphify-out graphify update . --force
```

- graphify deja una copia de respaldo con fecha (por ejemplo `Vault/graphify-out/2026-11-24/`); se borra antes de commitear.
- Si graphify renombra una comunidad por su nodo principal (aviso "renamed ... by their hub" y un `.graphify_labels.pending.json`), se vuelve a poner el nombre en `.graphify_labels.json`, se borra el `.pending.json` y se corre `cluster-only` (abajo).

- `.graphifyignore` deja afuera `Vault/` (para que el grafo no se lea a sí mismo ni a las notas) y `docs/` (capturas).
- La caché (`Vault/graphify-out/cache/`) está en `.gitignore`.
- Si cambian los nombres de las comunidades, ajustar `.graphify_labels.json` y correr `GRAPHIFY_OUT=Vault/graphify-out graphify cluster-only . --graph Vault/graphify-out/graph.json`.

## Qué muestra

Los nodos más conectados son `Plano` ([[planos.js]], el armador de estructuras), `World` ([[world.js]]), `G` (materiales del héroe), `handle()` ([[main.js]], los mensajes del servidor) y `handleGame()` ([[server.js]]), más varias funciones de los scripts de Blender (`Pose`, `Agarre`...).

Comunidades principales:

- Juego: *Servidor y datos compartidos* ([[server.js]] + [[items.js]]), *Mundo e isla* ([[world.js]]), *Rig y carga de modelos* ([[rig.js]], [[assets.js]], [[models.js]]), varias del cliente ([[main.js]]: escena y estado, red y mensajes, bucle y controles, disparo y efectos, inventario y HUD, slots), *Audio* ([[audio.js]]).
- Mapa ([[Mapa de la isla]]): *Datos de la isla y estructuras* ([[isla.js]]), *Planos de estructuras*, *Planos: casas y muebles*, *Planos: muelle y galpón*, *Planos: jardín y locales*, *Planos: piezas básicas* ([[planos.js]]), *Terreno y armado del mapa* (materiales, detalle del terreno y agua), *Mallas del mapa* ([[mallas.js]]), *Colisión y sólidos* ([[colision.js]]), *Pruebas del mapa* ([[Pruebas del mapa]]).
- Arte: *Ropa, cabeza y texturas de cara del héroe* (con los scripts de [[Texturas]]), *Materiales del héroe*, *Clips del héroe*, *Rig y animación base del héroe*, *Malla del juego y export (héroe y armas)* ([[Pipeline del héroe]]); *Modelado de armas*, *Horneado de armas*, *Recargas de armas*, *Control de recargas*, *Choque de armas* ([[Pipeline de armas]]); *Herramientas de modelado* ([[sf_tools.py]]).
- *README*: las secciones del README.

El grafo confirma que el servidor y el cliente solo se tocan a través de [[world.js]] (que trae [[isla.js]], [[planos.js]], [[colision.js]] y [[mallas.js]]) e [[items.js]] (ver [[Arquitectura]]).
