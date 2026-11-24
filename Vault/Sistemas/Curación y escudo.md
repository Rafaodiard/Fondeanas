# Curación y escudo

Volver a [[Inicio]] · datos en `CONSUMABLES` de [[items.js]]

| Consumible | Tiempo | Efecto | Tope |
|---|---|---|---|
| Vendas | 3,5 s | +15 vida | 75 |
| Botiquín | 8 s | +100 vida | 100 |
| Frasco azul | 2 s | +25 escudo | 50 |
| Bidón azul | 5 s | +50 escudo | 100 |

- Flujo: `useStart` → el cliente muestra la barra de uso → `useEnd`. El servidor exige al menos el 85 % del tiempo y que no se haya pasado el tope; `useCancel` lo corta.
- El escudo absorbe el daño antes que la vida, salvo el de la [[Tormenta]] y el de caída.
