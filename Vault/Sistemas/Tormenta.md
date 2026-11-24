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
