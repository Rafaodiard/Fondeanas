# Caminos prolijos

Volver a [[Índice de memoria]] · resultado en [[Mapa de la isla]] · cómo se revisa en [[Pruebas del mapa]]

**2026-11-25 · Rafael**

Pidió "que en el mapa esté todo prolijo, que no haya caminos o calles que se corten abruptamente" (junto con otros pedidos que se hacen aparte: cofres y loot, bus, caída libre y paracaídas, construcción editable, deslizarse, panel de configuración, ayuda de controles más simple y cambio automático de material).

**2026-11-25 · Claude (al hacer ese pedido)**

- Regla del mapa: cada punta de una calle o ruta llega a otra calle o termina en un remate declarado (`ini`/`fin` en [[isla.js]]: plazoleta `{ r }` o `'puerta'`). Toda la red queda unida.
- Se prefiere unir antes que rematar: los remates se usan donde no hay a dónde seguir (costa, final de un pueblo, la ciénaga, el camping).
- La prueba `tools/mapa/caminos.mjs` lo revisa en cada corrida de `node tools/mapa/pruebas.mjs`.
