# Pico y recursos

Volver a [[Inicio]]

- El pico está siempre (no ocupa slot). Datos en `PICKAXE` de [[items.js]]: daño 20 a jugadores, 50 a estructuras, cooldown 0,5 s, alcance 3,2.
- Recursos ([[server.js]], `case 'swing'`): árboles (150 de vida) dan madera, rocas (150 + tamaño × 120) dan piedra, paredes de casas dan metal. Cada golpe saca 50 de vida; al romperse, el árbol o la roca desaparece (`resGone`) y ese golpe da el doble de material.
- Materiales: máximo `MAX_MATS = 999` de cada uno.
- Modelo: nodo `pico` de `armas.glb` ([[Modelos GLB]]), pose `SostenerPico` en [[rig.js]].
