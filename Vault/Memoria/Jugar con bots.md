# Jugar con bots

Volver a [[Índice de memoria]] · sistema en [[Bots]]

**2026-11-26 · Rafael**: "Mete una opción para jugar con bots".

Cómo se interpretó (2026-11-26, en el thread del pedido): bots que completan la sala hasta un total de jugadores configurable (para jugar solo o con la sala), con dificultad Fácil, Normal o Difícil; corren en el servidor y hacen lo mismo que un jugador: saltan del bus, planean y abren el paracaídas, lootean, se mueven por el mapa, disparan, construyen de forma simple, respetan la tormenta y mueren como cualquiera. Las opciones están en el menú (*Jugar con bots*), en la sala (el anfitrión elige) y en Configuración → Juego.

Decisiones tomadas en ese momento (Claude, sin que Rafael las haya pedido; se pueden cambiar):
- Los bots se llaman "Bot" + un animal, para que se sepa quién es bot en el killfeed.
- Si mueren todas las personas, la partida termina a los 4,5 s aunque queden bots ("Quedaban N bots en pie"). `SF_BOTS_HASTA_EL_FINAL=1` la deja seguir.
- Hasta 24 jugadores en total entre personas y bots (las personas siguen siendo hasta 16).
- Los bots no manejan autos ni reciben daño por caída.
