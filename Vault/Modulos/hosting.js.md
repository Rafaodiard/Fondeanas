# hosting.js

Volver a [[Inicio]] · [[server.js]] · [[Jugar online]]

Archivo: `servidor/hosting.js`. Lo usa [[server.js]]. Junta lo que el servidor necesita para correr en un hosting en la nube (Render gratis, ver [[Jugar online]]), separado del resto de `server.js`.

## Qué exporta

- `servirArchivo(req, res, file, tipo)`: manda un archivo de `public/` o de three con `Cache-Control: no-cache` y un `ETag` (sha1 del contenido). Si el navegador manda el mismo ETag en `If-None-Match` (también débil `W/` o en lista) contesta `304` vacío. Si acepta gzip y el archivo es `.html`, `.js`, `.css`, `.json`, `.glb`, `.svg` o `.txt` de más de 1 KB, lo manda comprimido. Guarda en memoria el archivo y su versión comprimida (gzip nivel 9 asíncrono, una vez por versión: se vuelve a leer si cambia la fecha o el tamaño). Contesta `HEAD` sin cuerpo.
- `salud(res, datos)`: JSON `{ ok: true, ...datos, uptime }` para `GET /salud` (el health check de Render).
- `latido(wss, ms = 25000)`: ping a cada WebSocket cada `ms`; el que no contestó el ping anterior se corta con `terminate()` (dispara el `close` normal de la sala). Sirve para los proxies que cortan conexiones calladas y para cerrar las que se cayeron sin avisar.
- `topeBots(totales, valor)`: el mayor total de `BOT_TOTALES` ([[opcionesBots.js]]) que no pasa `valor` (`SF_BOTS_MAX`); `null` sin variable.

## Medido (2026-11-26)

- Primera carga del juego por la red: 10,7 MB sin gzip → 6,9 MB con gzip. Recarga: 0,01 MB (todo 304).
- `three.module.js`: 1,31 MB → 0,27 MB. Los `.glb` con meshopt bajan entre 15 % (armas, personaje) y 85 % (animaciones).

## Pruebas

`node tools/hosting/pruebas.mjs`: PORT por variable, `/salud`, ETag y 304, gzip (y que se descomprima igual), HEAD, que no se salga de `public/`, que `/%` dé 400 sin tirar el servidor, el tope de bots por sala, el latido y [[render.yaml]]. Ver [[Jugar online]].
