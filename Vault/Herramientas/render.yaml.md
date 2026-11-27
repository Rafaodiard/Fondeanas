# render.yaml

Volver a [[Inicio]] · [[Jugar online]]

Archivo: `render.yaml` (raíz del repo). Es el *Blueprint* de Render: lo lee al hacer **New → Blueprint** con el repo.

- Un servicio `web` llamado `salto-final`, `runtime: node`, `plan: free`, `region: virginia` (la más cerca de Argentina entre oregon, ohio, virginia, frankfurt y singapore), rama `main`.
- `buildCommand: npm ci`, `startCommand: npm start` (el servidor escucha en el `PORT` que pone Render), `healthCheckPath: /salud` ([[hosting.js]]).
- `autoDeployTrigger: commit`: cada merge a `main` se sube solo y reinicia el servidor (se cortan las salas abiertas).
- Variables: `NODE_VERSION=22`, `SF_BOTS_MAX=4` (tope de bots, ver [[hosting.js]]) y `SF_NAV_MS=2` (tiempo por cuadro para las grillas de [[navegacion.js]], en [[bots.js]]).
