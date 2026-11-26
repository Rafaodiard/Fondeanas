# Loot y rarezas

Volver a [[Inicio]] · datos en [[items.js]], reparto en [[server.js]]

- **Rarezas**: común, poco común, rara, épica y legendaria. Cada nivel sube el daño (×1 a ×1,22) y baja el tiempo de recarga (×1 a ×0,8). El color de la rareza tiñe el material `Rareza` de las armas.
- **Piso**: en cada lugar de loot ([[world.js]] `lootSpots`): 20 % nada, 42 % arma con su munición, 23 % consumible, 15 % munición. Pesos de rareza en piso: 45/30/16/7/2.
- **Cofres**: al abrirlos (`chest`, a menos de `PICKUP_RANGE + 1`) dan un arma con munición, un consumible, 30 de madera y a veces munición extra. Pesos de rareza en cofre: 10/30/34/19/7.
- **Inventario**: 5 slots más el pico. Si está lleno y agarrás un arma, se cambia por la del slot elegido. Cada lugar muestra la foto del arma (con la franja de su rareza) u objeto, sacada de su modelo 3D por [[iconos.js]], sobre el fondo del color de la rareza; al costado se lee el nombre y la rareza de lo que tenés en la mano.
- **Tirar** (`drop`): deja el objeto del slot en el piso.
- **Cómo se ve** ([[loot.js]]): cada objeto flota y gira despacio sobre un anillo del color del objeto (la rareza en las armas). Las armas suman un haz de luz que mira siempre a la cámara, más alto y ancho cuanto más rara, y chispas que suben (4 + 4 por nivel de rareza). Los cofres cerrados tienen aura dorada que late y motas; al abrirse la tapa salta con rebote, hay un destello y una ráfaga de chispas, el fondo brilla y se apaga, y lo que sale del cofre vuela en arco desde el cofre hasta donde lo puso el servidor. Modelos: [[Pipeline del loot]]. Vitrina: [[loot.html]].
- Las armas tienen rarezas permitidas: el francotirador y el lanzacohetes solo salen de rara para arriba; la pistola no sale legendaria.
