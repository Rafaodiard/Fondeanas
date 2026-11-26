# Bots

Volver a [[Inicio]] · código en [[bots.js]] y [[navegacion.js]] · pedido en [[Jugar con bots]]

Jugadores que maneja el servidor. Completan la sala hasta un total de jugadores que elige el anfitrión (Sin bots, 4, 8, 12, 16, 20 o 24) con una dificultad (Fácil, Normal o Difícil). Si hay 3 personas y el total es 12, entran 9 bots. Los valores y `cuantosBots` están en [[opcionesBots.js]].

## Dónde se eligen

- **Menú**: botón *🤖 Jugar con bots* (`#btnBots`): crea una sala con bots y la empieza enseguida. Usa el total y la dificultad de Configuración (si el total es "Sin bots", usa 12).
- **Sala** (`#botsSala`): el anfitrión elige *Completar la sala hasta* y *Dificultad*; los demás ven lo elegido. La lista de jugadores muestra "🤖 + N bots" y el botón dice "Empezar con N bots". Ver [[index.html]].
- **Configuración → Juego**: *Bots: completar la sala hasta* (`botsTotal`) y *Dificultad de los bots* (`botsDificultad`). Es lo que se pone al crear una sala; cambiarlo en la sala también lo guarda. Ver [[Configuración y controles]].

## Cómo entran a la partida

[[server.js]] `agregarBots` los mete en `room.players` al empezar (`startMatch`) con nombres "Bot " + un animal ("Bot Carpincho", "Bot Tero"…) y el flag `bot`; `sacarBots` los saca al volver a la sala. Para el resto del juego son un jugador más: vida, escudo, inventario, kills, la [[Tormenta]] los lastima y al morir tiran todo. No tienen conexión (`ws: null`): `send` y `broadcast` los saltean. Sus acciones pasan por el mismo `handleGame` que los mensajes de los clientes (saltar, agarrar, cofres, disparar, picar, construir, curarse, recargar), así que el servidor valida lo mismo para todos.

Se mueven a 20 Hz (`BOT_MS`, un `setInterval` aparte del tick) y mandan su estado a los clientes a 10 Hz con el mismo mensaje `state` que mandan los jugadores ([[Protocolo de red]]): los clientes los dibujan y animan como a cualquier otro.

## Qué hace cada bot

1. **Bus**: al empezar elige un cofre al que se llegue planeando desde la ruta del bus (sin amontonarse con los otros bots) y salta un poco antes de pasar por encima.
2. **Caída**: planea mientras le falta distancia, va en picada cuando está encima y el paracaídas se abre solo a 80 m (los mismos números de [[caida.js]]).
3. **Loot**: busca lo que le sirve (arma si no tiene o es mejor que la peor que tiene, munición de sus armas, curas y escudos que puede usar, cofres cerrados) y lo agarra o lo abre al llegar.
4. **Madera**: con arma y pocos materiales, pica árboles.
5. **Pelea**: ve a los enemigos (personas y otros bots) hasta su distancia de vista, adelante o muy cerca, con un rayo que cortan el terreno, las paredes del mapa (no los vidrios), los árboles y las construcciones. Espera su tiempo de reacción, gira hacia el enemigo, elige el arma según la distancia (escopeta cerca, rifle a media distancia, francotirador lejos), se acerca o se aleja a la distancia de esa arma, se mueve de costado y salta. Cada tiro pega o no según su puntería, la distancia, si alguno se mueve o está en el aire; puede ser a la cabeza. Las automáticas tiran en ráfagas. Si una construcción de otro tapa al enemigo, le tira a la construcción (Normal y Difícil). Sin arma usa el pico de cerca o se va a buscar loot.
6. **Se cubre**: cuando le pegan, a veces levanta una pared hacia el que le tira (en Difícil a veces también una rampa).
7. **Se cura** cuando está tranquilo (vendas, botiquín, frascos y bidones de escudo); si lo atacan, corta.
8. **Tormenta**: cuando falta poco para que se achique, va hacia adentro del próximo círculo.
9. **Después de una eliminación** a veces baila un rato.
10. **Si se traba**: salta, rodea con una ruta, pica la construcción que tenga adelante y al final cambia de meta.

## Dificultad

| | Fácil | Normal | Difícil |
|---|---|---|---|
| Vista | 45 m | 70 m | 100 m |
| Reacción | 0,9–1,4 s | 0,5–0,8 s | 0,22–0,4 s |
| Puntería base | 0,2 | 0,36 | 0,52 |
| A la cabeza | 4 % | 10 % | 20 % |
| Se cubre construyendo | casi nunca | a veces | casi siempre |
| Rompe construcciones que tapan | no | sí | sí |
| Persigue al que perdió de vista | no | 5 s | 9 s |

Los números exactos están en `DIFICULTAD` de [[bots.js]].

## Fin de la partida

Si ya no queda ninguna persona viva, la partida termina a los 4,5 s (para que se vea el cartel de eliminado) con `matchEnd` sin ganador y `botsVivos`, y el cliente muestra "Quedaban N bots en pie". Si una persona queda última, gana como siempre. Para mirar o probar a los bots hasta el final: `SF_BOTS_HASTA_EL_FINAL=1 npm start`.

## Navegación

Ver [[navegacion.js]]: grillas de lugares pisables (pisos, escaleras, techos, terreno, agua) alrededor de lo que buscan, y rutas por esas grillas.

## Pruebas

- `node tools/bots/pruebas.mjs`: opciones compartidas, que haya ruta a los lugares de loot y cofres, que un bot llegue caminando y abra los cofres (con la física real) y que salga de pisos altos hacia un lugar a 70 m.
- `node tools/bots/partida.mjs [total] [dificultad] [segundos]`: levanta el servidor, juega una partida entera solo con bots y revisa que salten, caigan, junten loot, abran cofres, se peleen y que termine con ganador. Con `SF_BOTS_DEBUG=1` muestra qué hace cada bot cada 10 s (también vale para `npm start`).
