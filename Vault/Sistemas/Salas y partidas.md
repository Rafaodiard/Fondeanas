# Salas y partidas

Volver a [[Inicio]] · código en [[server.js]]

- **Crear**: `createRoom` genera un código de 5 caracteres con letras y números sin los ambiguos (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`) y una semilla aleatoria (la isla es fija y no depende de ella: ver [[Mapa de la isla]]).
- **Unirse**: por código (el cliente también acepta `?sala=CODIGO` en el link, según el README). Máximo 16 personas (los bots no cuentan). Cada jugador recibe un color libre de una lista de 16.
- **Anfitrión**: el primero que entra. Si se va, pasa al siguiente. Solo el anfitrión puede mandar `start`.
- **Fases**: `lobby` → `bus` (3 s de espera, ver [[Bus, caída y paracaídas]]) → `playing` → `ended`.
- **Fin**: cuando queda uno vivo (o ninguno) se manda `matchEnd` con el ganador; a los 9 s la sala vuelve a `lobby`. Con bots, si ya no queda ninguna persona viva la partida termina a los 4,5 s (`matchEnd` sin ganador y con `botsVivos`).
- **Bots**: el anfitrión elige hasta cuántos jugadores completan y la dificultad; entran al empezar y se van al volver a la sala. Ver [[Bots]].
- **Muerte**: `killPlayer` tira al piso todo lo que tenía el jugador (armas, munición y materiales) y suma la kill al que lo mató. El cliente pasa a modo espectador.
- Si la última persona se va, la sala se borra (aunque queden bots jugando).
- **Chat**: mensajes de hasta 120 caracteres.
