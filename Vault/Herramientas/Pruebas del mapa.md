# Pruebas del mapa

Volver a [[Inicio]] · prueba [[world.js]], [[planos.js]] y [[colision.js]]

Archivo: `tools/mapa/pruebas.mjs`. Se corre con `node tools/mapa/pruebas.mjs` (sin navegador) y termina con `todo OK` o con la lista de fallas.

1. **Caídas**: suelta al jugador desde 120 m sobre 9 puntos de cada estructura; tiene que quedar parado arriba de algo, nunca adentro de un techo o un piso.
2. **Paseos**: caminatas al azar con saltos en cada pueblo; revisa que la cápsula nunca se meta en un sólido.
3. **Puertas al ras**: el terreno pegado a las paredes de cada edificio queda a menos de 35 cm del piso.
4. **Escaleras**: sube caminando un edificio de 4 pisos hasta la terraza, una casa de 2 pisos, el tanque de agua y la torre de vigía.
5. **Alcance**: en cada uno de los planos arma una grilla de lugares donde cabe el jugador (1,8 m de alto, 45 cm de radio) y verifica que **todo el loot y todos los cofres se alcanzan caminando** desde afuera. Avisa aparte si algo solo se alcanza saltando.
6. **Loot del mapa**: en la isla armada, cada lugar de loot y cada cofre queda sobre un piso y con lugar para pararse.

Correrla después de tocar [[planos.js]], [[isla.js]] o la física de [[world.js]].
