# Jugar online

Volver a [[Inicio]] · [[Arquitectura]] · pedido en [[Jugar online desde la escuela]]

El juego se sube gratis a Render ([[render.yaml]]) y queda en una página pública `https://….onrender.com`: cualquiera entra con el link, por HTTPS y WSS en el puerto 443. El cliente ya se conectaba con `wss://` cuando la página es `https://` ([[main.js]] `connect`). Los pasos para subirlo están en el README (sección *Jugar online*); Render pide una cuenta de Rafael y Claude no puede crearla.

## Lo que se cambió para que entre en el plan gratis

Render gratis da 0,1 CPU, 512 MB, 5 GB por mes de salida, 750 horas por mes, disco que se borra y se duerme a los 15 min sin tráfico (datos de render.com/docs/free y /docs/outbound-bandwidth, leídos el 2026-11-26).

- **Ancho de banda**: ETag + gzip en [[hosting.js]] (primera carga 6,9 MB, recarga 0,01 MB). En partida cada jugador recibe ~10 KB/s con 8 personas.
- **CPU**: medido con un limitador que simula 0,1 CPU (cuota de 10 ms cada 100 ms). Solo personas: 16 jugadores simulados sin atrasos. Bots: ~4 % de un núcleo cada uno, sobre todo armando grillas de [[navegacion.js]] (`armar`). Con 4 bots y `trabajar(6)` los estados de bots llegaban a 5,2 de 10 por segundo; con `SF_NAV_MS=2`, a 9,2. Con 8 bots, 6,2. Por eso `SF_BOTS_MAX=4` ([[server.js]] limita `room.bots.total` y manda `botsMax` en `roomInfo`; [[main.js]] deja grisadas las opciones de más).
- **Compresión del WebSocket** (`SF_WS_COMPRIMIR=1`, permessage-deflate): ~5 veces menos datos pero en 0,1 CPU bajó 16 personas a 4,9 estados por segundo y 4 bots a 5,5. Queda apagada.
- **Latido**: ping cada 25 s ([[hosting.js]] `latido`).
- **`/%`**: `decodeURIComponent` tiraba el servidor con una dirección mal escrita; ahora da 400.

## Lo que no se guarda

Las salas viven en memoria: un deploy, un reinicio o que se duerma las borra. El disco de Render gratis se borra, así que lo que haya que guardar (cuentas) necesita una base de datos aparte.
