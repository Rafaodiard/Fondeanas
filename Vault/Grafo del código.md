# Grafo del código

Volver a [[Inicio]] · reglas en [[Mantenimiento del vault]]

El grafo está en `Vault/graphify-out/`, generado con [graphify](https://pypi.org/project/graphifyy/) (paquete pip `graphifyy`) a partir del código del repo. La extracción es solo estructural (AST), sin LLM ni claves de API.

- `graph.html`: grafo interactivo, se abre en el navegador.
- `GRAPH_REPORT.md`: resumen (nodos más conectados, comunidades, conexiones sorprendentes).
- `graph.json`: los datos crudos. Se puede consultar con `graphify query "<pregunta>" --graph Vault/graphify-out/graph.json`, `graphify explain "<nodo>"` o `graphify path "A" "B"`.
- `.graphify_labels.json`: nombres de las comunidades, puestos a mano.

Última generación: 2026-11-24, en la PC de Rafael con graphify 0.9.95 (`graphifyy` instalado con `uv tool`), sobre el código del commit `9981e6f` de la rama `claude/project-thread-gas1mg`. 675 nodos, 1738 relaciones, 23 comunidades.

## Cómo regenerarlo

Desde la raíz del repo:

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

Los nodos más conectados son `World` ([[world.js]]), `handle()` ([[main.js]], los mensajes del servidor) y `handleGame()` ([[server.js]]), más varias funciones de los scripts de Blender (`Pose`, `pose_baile`, `Agarre`...).

Comunidades principales:

- Juego: *Servidor y datos compartidos* ([[server.js]] + [[items.js]]), *Mundo e isla* ([[world.js]]), *Rig y carga de modelos* ([[rig.js]], [[assets.js]], [[models.js]]), varias del cliente ([[main.js]]: escena y estado, red y mensajes, bucle y controles, disparo y efectos, inventario y HUD, slots), *Audio* ([[audio.js]]).
- Arte: *Cabeza del héroe*, *Materiales del héroe*, *Malla del juego del héroe*, *Rig del héroe*, *Clips del héroe*, *Animación base y export* ([[Pipeline del héroe]]); *Modelado de armas*, *Horneado de armas*, *Recargas de armas*, *Control de recargas* ([[Pipeline de armas]]); *Herramientas de modelado* ([[sf_tools.py]]).

El grafo confirma que el servidor y el cliente solo se tocan a través de [[world.js]] e [[items.js]] (ver [[Arquitectura]]).
