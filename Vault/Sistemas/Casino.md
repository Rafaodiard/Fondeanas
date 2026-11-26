# Casino

Volver a [[Inicio]] · pedido: [[Cuentas, casino y tienda]] · código: [[casino.js]] (cliente y servidor) · reglas en `public/js/casino/`

Cada jugador juega solo contra la casa; solo con cuenta. El azar sale del servidor (`crypto.randomInt`) y el cliente solo anima. Apuesta por jugada: de `APUESTA_MIN` = 10 a `APUESTA_MAX` = 500 pavos (`public/js/casino/reglas.js`).

## Ruleta (`public/js/casino/ruleta.js`)

- Europea: 37 números en el orden real de la rueda (`RUEDA`), 18 rojos (`ROJOS`).
- Tipos (`TIPOS`): `numero` (paga 36 por pavo, apuesta incluida), `rojo`, `negro`, `par`, `impar`, `bajo`, `alto` (2), `docena` y `columna` (3). Hasta 40 apuestas por tirada (`MAX_FICHAS`), la suma entre el mínimo y el máximo; `validarApuestas` junta las fichas de la misma casilla.
- Retorno 36/37 = 97,3 % para cualquier apuesta.
- Interfaz (`public/js/mesas/ruleta.js`): rueda en canvas con la bola que cae en el número, paño con fichas de 5 a 100, deshacer, borrar, repetir e historial de los últimos 12 números.

## Blackjack (`public/js/casino/blackjack.js`)

- Zapato de 6 barajas (`BARAJAS`) que se mezcla cuando queda un cuarto; el crupier se planta en 17 (también blando) y espía el blackjack con As o figura a la vista; blackjack paga 3 a 2; doblar con dos cartas (también después de dividir); dividir una vez pares del mismo valor; ases divididos reciben una carta.
- El estado (con el zapato) se guarda en la tabla `blackjack` de [[db.js]]: la mano se retoma al recargar. `vista()` es lo que ve el jugador: sin el zapato ni la carta tapada.
- Retorno con estrategia básica: 99,4 % (lo mide la prueba).
- Interfaz (`public/js/mesas/blackjack.js`): cartas que salen del zapato, la tapada se da vuelta, manos divididas, resultados por mano. Teclas: H, S, D, P y Enter para repartir.

## Tragamonedas (`public/js/casino/slots.js`)

- 3 rodillos con la misma tira de 23 (`TIRA`), símbolos con peso: bus 1, cohete 2, cofre 2, paracaídas 4, pico 6, escudo 8.
- Tres iguales: ×500, ×100, ×50, ×20, ×10, ×5. Si no: dos cofres ×5, un cofre ×1 (devuelve). Retorno exacto 95,4 % (`retornoTeorico`), paga en el 30 % de las tiradas.
- Interfaz (`public/js/mesas/slots.js`): máquina "Salto de la Fortuna" con luces, rodillos que paran uno por uno y tabla de premios. Íconos SVG en `public/js/mesas/iconos.js`.

## Pruebas

`node tools/casino/pruebas.mjs`: pagos, casos raros del blackjack y retorno con 1.000.000 de jugadas por juego (`RAPIDO=1` para 100.000). `tools/cuentas/pruebas.mjs` prueba el casino contra la base (saldo nunca negativo, la mano guardada, doblar sin saldo).
