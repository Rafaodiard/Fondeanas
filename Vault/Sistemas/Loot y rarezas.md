# Loot y rarezas

Volver a [[Inicio]] · datos en [[items.js]], reparto en [[server.js]]

- **Rarezas**: común, poco común, rara, épica y legendaria. Cada nivel sube el daño (×1 a ×1,22) y baja el tiempo de recarga (×1 a ×0,8). El color de la rareza tiñe el material `Rareza` de las armas.
- **Piso**: en cada lugar de loot ([[world.js]] `lootSpots`): 20 % nada, 42 % arma con su munición, 23 % consumible, 15 % munición. Pesos de rareza en piso: 45/30/16/7/2.
- **Cofres**: al abrirlos (`chest`, a menos de `PICKUP_RANGE + 1`) dan un arma con munición, un consumible, 30 de madera y a veces munición extra. Pesos de rareza en cofre: 10/30/34/19/7.
- **Inventario**: 5 slots más el pico. Si está lleno y agarrás un arma, se cambia por la del slot elegido.
- **Tirar** (`drop`): deja el objeto del slot en el piso.
- Las armas tienen rarezas permitidas: el francotirador y el lanzacohetes solo salen de rara para arriba; la pistola no sale legendaria.
