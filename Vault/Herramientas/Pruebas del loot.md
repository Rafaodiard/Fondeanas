# Pruebas del loot

Volver a [[Inicio]] · prueba [[lugarLoot.js]] y el salto de [[loot.js]] · sistema: [[Loot y rarezas]]

Archivo: `tools/loot/pruebas.mjs` (2026-11-26). Se corre con `node tools/loot/pruebas.mjs` (sin navegador, unos 2 s) y termina con `todo OK`. Revisa que el camino recto de donde sale cada objeto a donde queda no pase por adentro de nada alto (revisión propia, cada 2 cm, independiente del algoritmo), que quede apoyado en un piso y que no esté metido en nada:

- Los 88 cofres del mapa (5 objetos, 6 veces cada uno). Compara con el reparto de antes: 1164 de 2640 objetos salían del otro lado de una pared; ahora ninguno.
- Un tercio de los lugares de loot del mapa, como si alguien muriera o soltara 8 cosas ahí.
- Ventanas: lo que se suelta al lado de un vidrio no sale por la ventana (188 lados probados).
- Construcciones de un jugador en campo abierto: cuarto de 4 paredes (nada sale), pared con puerta (sale solo por la puerta), pared nueva encima de un objeto (sale para su lado), piso nuevo a la altura de un objeto (queda arriba), piso de arriba que se rompe (cae), rampa por debajo (no se mete en la rampa ni aparece arriba), techo bajo (`techoLoot`).
- Agua: lo que suelta alguien nadando queda cerca de la superficie.
- En campo abierto sigue saliendo a 1-1,8 m.
- Cliente: el salto desde el cofre ([[loot.js]] `animarLoot` con el `world`) no corta el piso de un balcón y no pasa un techo bajo.

Correrla después de tocar [[lugarLoot.js]], [[colision.js]], [[construccion.js]], [[planos.js]] o el reparto del loot en [[server.js]].
