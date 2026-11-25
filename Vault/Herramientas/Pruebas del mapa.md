# Pruebas del mapa

Volver a [[Inicio]] · prueba [[world.js]], [[planos.js]], [[colision.js]] y [[mallas.js]] · roturas en [[Estructuras rompibles]]

Archivo: `tools/mapa/pruebas.mjs`. Se corre con `node tools/mapa/pruebas.mjs` (sin navegador) y termina con `todo OK` o con la lista de fallas.

1. **Caídas**: suelta al jugador desde 120 m sobre 9 puntos de cada estructura; tiene que quedar parado arriba de algo, nunca adentro de un techo o un piso.
2. **Paseos**: caminatas al azar con saltos en cada pueblo; revisa que la cápsula nunca se meta en un sólido.
3. **Puertas al ras**: el terreno pegado a las paredes de cada edificio queda a menos de 35 cm del piso.
4. **Escaleras**: sube caminando un edificio de 4 pisos hasta la terraza, una casa de 2 pisos, el tanque de agua y la torre de vigía.
5. **Alcance**: en cada uno de los planos arma una grilla de lugares donde cabe el jugador (1,8 m de alto, 45 cm de radio) y verifica que **todo el loot y todos los cofres se alcanzan caminando** desde afuera. Avisa aparte si algo solo se alcanza saltando.
6. **Loot del mapa**: en la isla armada, cada lugar de loot y cada cofre queda sobre un piso y con lugar para pararse.

Después corre las **pruebas visuales** de `tools/mapa/visuales.mjs` (`pruebasVisuales`), que revisan que lo que se ve coincida con lo que choca:

7. **Caras al revés**: triángulos con la normal para adentro (se verían transparentes desde afuera).
8. **Se ve pero se atraviesa / pisos falsos**: con los lugares donde cabe el jugador de la prueba 5, busca partes visibles metidas en el cuerpo (`dentroParte` sabe de cajas, rampas, cilindros, tubos, esferas y arcos) y pisos que se ven más arriba de lo que pisan los pies. No cuenta los puntos que ya están dentro de un sólido.
9. **Caras que titilan**: dos caras opuestas en el mismo plano con distinto aspecto, dentro de cada estructura y entre estructuras, más las caras de arriba al ras del terreno y las calles que pasan a menos de 30 cm de la cara de arriba de una estructura (salvo en los puentes, `enPuente`). Lista las primeras 25; con `TODAS=1 node tools/mapa/pruebas.mjs` las lista todas.
10. **Piezas**: ninguna pieza rompible arranca sin apoyo y no hay decoración suelta en el aire.
11. **Derrumbes**: en un mundo aparte, romper el aro de la vuelta al mundo tiene que tirar todas las cabinas, la pieza rota deja de chocar, y romper una pared de planta baja de una casa no tira ninguna pieza grande.

Correrla después de tocar [[planos.js]], [[isla.js]], [[mallas.js]] o la física de [[world.js]].
