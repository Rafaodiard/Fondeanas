# Pico y recursos

Volver a [[Inicio]]

- El pico está siempre (no ocupa slot). Datos en `PICKAXE` de [[items.js]]: daño 20 a jugadores, 50 a estructuras, cooldown 0,5 s, alcance 3,2.
- Recursos ([[server.js]], `case 'swing'`): árboles (150 de vida) dan madera y rocas (150 + tamaño × 120) dan piedra. Cada golpe saca 50 de vida; al romperse, el árbol o la roca desaparece (`resGone`) y ese golpe da el doble de material.
- Estructuras del mapa (`swing` con `pz`): cada golpe saca 50 de vida a la pieza y da su material según `PICKAXE.gain` (madera 6, piedra 6, metal 5); el golpe que la rompe da el doble. Detalle en [[Estructuras rompibles]].
- Materiales: máximo `MAX_MATS = 999` de cada uno.
- Modelo: nodo `pico` de `armas.glb` ([[Modelos GLB]]), pose `SostenerPico` en [[rig.js]].
