# Salas y partidas

Volver a [[Inicio]] · código en [[server.js]]

- **Crear**: `createRoom` genera un código de 5 caracteres con letras y números sin los ambiguos (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`) y una semilla aleatoria (la isla es fija y no depende de ella: ver [[Mapa de la isla]]).
- **Unirse**: por código (el cliente también acepta `?sala=CODIGO` en el link, según el README). Máximo 16 jugadores. Cada jugador recibe un color libre de una lista de 16.
- **Anfitrión**: el primero que entra. Si se va, pasa al siguiente. Solo el anfitrión puede mandar `start`.
- **Fases**: `lobby` → `bus` (3 s de espera, ver [[Bus, caída y planeador]]) → `playing` → `ended`.
- **Fin**: cuando queda uno vivo (o ninguno) se manda `matchEnd` con el ganador; a los 9 s la sala vuelve a `lobby`.
- **Muerte**: `killPlayer` tira al piso todo lo que tenía el jugador (armas, munición y materiales) y suma la kill al que lo mató. El cliente pasa a modo espectador.
- Si el último jugador se va, la sala se borra.
- **Chat**: mensajes de hasta 120 caracteres.
