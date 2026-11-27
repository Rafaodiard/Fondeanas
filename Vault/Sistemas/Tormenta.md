# Tormenta

Volver a [[Inicio]] · código en [[server.js]] (`startMatch`, `stormAt`, `tick`) y [[main.js]] (`stormAt`, `updateStorm`)

- Empieza junto con el bus. El centro final se elige al azar cerca del medio de la isla.
- Fases (segundos desde el arranque → radio, daño por segundo):

| t | radio | daño/s |
|---|---|---|
| 0–80 | 900 (0,75 × isla) | 1 |
| 80–130 | se achica a 330 | 2 |
| 190–230 | se achica a 140 | 5 |
| 275–305 | se achica a 45 | 8 |
| 340–370 | se cierra a 0 | 15 |

- Entre fases el radio y el centro se interpolan linealmente.
- El daño **ignora el escudo** y no afecta a los que siguen en el bus.
- En pantalla: el texto de `#stormInfo` (se cierra en / avanza / tormenta final), el cilindro violeta en el mundo y, en el minimapa y el mapa grande de [[mapaHud.js]], lo de afuera del círculo teñido de violeta, la próxima zona punteada en blanco y una línea hasta ella si estás afuera (la brújula también la marca). Ver [[Mapa y marcas]].
