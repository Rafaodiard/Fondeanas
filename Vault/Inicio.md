# Salto Final · Inicio

Battle royale 3D para navegador con cuentas, pavos y 84 skins ([[Cuentas, tienda y skins (sistema)]]): isla fija con 10 pueblos ([[Mapa de la isla]]), autos que se manejan ([[Autos]]), bots que completan la sala ([[Bots]]), bus volador, caída libre con planeo y picada, paracaídas que se abre y se cierra, deslizarse, tormenta que se achica y salas privadas a las que se entra con un código de 5 letras.

- Repo: https://github.com/Rafaodiard/Fondeanas
- Stack: Node (`server.js` con `ws`) + Three.js 0.170 como ES modules sin bundler. `npm start` levanta todo en el puerto 3000 (`PORT` lo cambia).
- Vault actualizado con las cuentas, la tienda y las skins (rama `claude/project-thread-aj77ft`, 2026-11-26), el hosting en Render gratis (rama `claude/project-thread-f5a861`, 2026-11-26, ver [[Jugar online]]), el mapa abrible, el minimapa con zoom, la brújula y las marcas (rama `claude/project-thread-gkrms5`, 2026-11-26), las fotos de las armas en la barra de items (rama `claude/project-thread-re7eeo`, 2026-11-26), los bots (rama `claude/project-thread-jzsanm`, 2026-11-26), el daño visible y el punto débil del pico (rama `claude/project-thread-rrpo2j`, 2026-11-26), los autos manejables, además de la construcción estilo battle royale, el cofre y los objetos del piso modelados, y la caída libre, el paracaídas y deslizarse. El grafo de graphify no se regeneró en esta tanda (ver [[Graphify de la PC de Rafael]]).

## Cómo está armado

- [[Arquitectura]]: quién decide qué (cliente vs. servidor) y cómo se conectan las piezas.
- [[Protocolo de red]]: los mensajes WebSocket entre cliente y servidor.
- [[Grafo del código]]: el grafo de graphify y cómo regenerarlo.

## Módulos (código)

| Nota | Archivo | Qué hace |
|---|---|---|
| [[server.js]] | `server.js` | HTTP estático + WebSocket, salas, loot, daño, tormenta, ganador |
| [[main.js]] | `public/js/main.js` | El juego en el cliente: cámara, física, disparo, HUD, red |
| [[world.js]] | `public/js/world.js` | Arma la isla (terreno, pueblos, rutas, río, árboles, rocas, cofres, agua) y la física del jugador contra el mapa |
| [[planos.js]] | `public/js/planos.js` | Planos de todas las estructuras: geometría y colisiones de la misma lista de piezas |
| [[isla.js]] | `public/js/isla.js` | Diseño de la isla: pueblos, rutas, río, teleférico y lugares sueltos |
| [[colision.js]] | `public/js/colision.js` | Sólidos del mapa en grilla espacial: piso, techo y paredes |
| [[mallas.js]] | `public/js/mallas.js` | Junta los planos en pocas mallas y les da texturas procedurales |
| [[items.js]] | `public/js/items.js` | Armas, rarezas, munición, consumibles, materiales, construcciones (compartido) |
| [[assets.js]] | `public/js/assets.js` | Carga de los GLB y clonado con tintes |
| [[models.js]] | `public/js/models.js` | Personajes, bus y armas (GLB o primitivas de respaldo) |
| [[loot.js]] | `public/js/loot.js` | Objetos del piso y cofres en el juego, con sus efectos y animaciones |
| [[lugarLoot.js]] | `public/js/lugarLoot.js` | Dónde cae el loot sin atravesar paredes (compartido) |
| [[iconos.js]] | `public/js/iconos.js` | Fotos de las armas y objetos para la barra de items, sacadas de sus modelos 3D |
| [[rig.js]] | `public/js/rig.js` | Esqueleto y animaciones del personaje por capas, paracaídas colgado de los hombros |
| [[caida.js]] | `public/js/caida.js` | Física de la caída libre (planeo / picada), el paracaídas y deslizarse |
| [[audio.js]] | `public/js/audio.js` | Sonidos sintetizados con WebAudio y volumen general |
| [[controles.js]] | `public/js/controles.js` | Registro central de teclas (acciones con contexto) y opciones del juego, guardados en `localStorage` |
| [[construccion.js]] | `public/js/construccion.js` | Reglas de la construcción: ediciones, superficies, choques, apoyo, derrumbes y vida (compartido) |
| [[construccion3d.js]] | `public/js/construccion3d.js` | Mallas de las construcciones, vista previa, grilla de edición y relleno al levantarse |
| [[construir.js]] | `public/js/construir.js` | La construcción en el juego: modo construcción, colocar, editar, material automático y su HUD |
| [[configuracion.js]] | `public/js/configuracion.js` | Panel de configuración: Juego, Video, Sonido y Controles |
| [[autos.js]] | `public/js/autos.js` | Autos: medidas, asientos, física de manejo, choques y estado de red (compartido) |
| [[mapaHud.js]] | `public/js/mapaHud.js` | Minimapa que sigue al jugador, mapa grande (M), brújula y marcas en el mapa y en el mundo |
| [[golpes.js]] | `public/js/golpes.js` | Grietas de lo dañado, barra de vida de lo que golpeás o mirás y punto débil del pico |
| [[manejar.js]] | `public/js/manejar.js` | Los autos en el juego: manejar, autos de los demás, subir y bajar, gente sentada, HUD y sonidos |
| [[opcionesBots.js]] | `public/js/opcionesBots.js` | Totales y dificultades de los bots (compartido) |
| [[bots.js]] | `servidor/bots.js` | Los bots: salto, caída, loot, pelea, construcción, curación y tormenta (solo servidor) |
| [[hosting.js]] | `servidor/hosting.js` | Archivos con ETag y gzip, `/salud`, latido de los WebSocket y tope de bots para el hosting (solo servidor) |
| [[navegacion.js]] | `servidor/navegacion.js` | Grillas de lugares pisables y rutas para que los bots caminen por el mapa (solo servidor) |
| [[skins.js]] | `public/js/skins.js` | Catálogo de las 84 skins, rarezas y precios (compartido) |
| [[tienda.js]] | `public/js/tienda.js` | Reglas de la economía: tienda diaria, reroll, cajas, apuestas, premios (compartido) |
| [[aspecto.js]] | `public/js/aspecto.js` | Cómo se ve cada skin: shader de colores, patrones y efectos, accesorios colgados de los huesos |
| [[vitrina.js]] | `public/js/vitrina.js` | El personaje del menú y las fotos de las tarjetas de skins |
| [[menu.js]] | `public/js/menu.js` | Menú con cuentas: entrar, tienda, casillero, cajas, apuestas y admin |
| [[cuentas.js]] | `servidor/cuentas.js` | Cuentas, pavos, skins, tienda, cajas, apuestas y admin (solo servidor) |
| [[api.js]] | `servidor/api.js` | API HTTP `/api/*` del menú (solo servidor) |
| [[almacenPg.js]] | `servidor/almacenPg.js` | Guardar las cuentas en Postgres si hay `DATABASE_URL` (solo servidor) |

## Pantallas

- [[index.html]]: menú, sala de espera y HUD del juego.
- [[visor.html]]: visor del personaje para revisar animaciones.
- [[mapa.html]]: visor del mapa para recorrer la isla.
- [[loot.html]]: vitrina del loot (cofres, armas por rareza y objetos).
- [[skins.html]]: vitrina de todas las skins como se ven en el juego.

## Sistemas del juego

- [[Mapa de la isla]] · [[Mapa y marcas]] · [[Estructuras rompibles]] · [[Daño visible y punto débil]] · [[Salas y partidas]] · [[Bus, caída y paracaídas]] · [[Deslizarse]] · [[Tormenta]] · [[Loot y rarezas]] · [[Armas y disparo]] · [[Construcción]] · [[Autos]] · [[Bots]] · [[Pico y recursos]] · [[Curación y escudo]] · [[Configuración y controles]] · [[Jugar online]] · [[Cuentas, tienda y skins (sistema)]]

## Arte y herramientas

- [[Modelos GLB]]: los archivos de `public/models` y quién los usa.
- [[Pipeline del héroe]]: scripts de Blender del personaje (malla, ropa, rig, clips, export).
- [[Pipeline de skins]]: accesorios de las skins (`skins.glb`) y cómo se ven en el juego.
- [[Pipeline del loot]]: scripts de Blender del cofre y los objetos del piso.
- [[Pipeline de armas]]: scripts de Blender de las armas (modelado, horneado, recargas, export).
- [[Pipeline del bus]]: script de Blender del bus volador (modelado, fotos y export).
- [[Pipeline del auto]]: script de Blender del auto (carrocería paramétrica, ruedas, interior, fotos y export).
- `tools/autos/pruebas.mjs`: pruebas de los autos (ver [[autos.js]]). `tools/autos/embestidas.mjs` y `tools/autos/servidor.mjs`: pruebas de los autos que rompen lo que chocan según la velocidad (física y contra el servidor, ver [[Autos]]).
- `tools/bots/pruebas.mjs` y `tools/bots/partida.mjs`: pruebas de los bots y una partida entera solo con bots (ver [[Bots]]).
- `tools/iconos/pruebas.mjs`: pruebas de las fotos de la barra de items en el navegador (ver [[iconos.js]]).
- `tools/mapaHud/pruebas.mjs`: pruebas del minimapa, el mapa grande y las marcas, en Node, contra el servidor y en el navegador (ver [[mapaHud.js]]).
- `tools/golpes/pruebas.mjs`: pruebas del punto débil y la vida de lo dañado contra el servidor (ver [[Daño visible y punto débil]]).
- [[sf_tools.py]]: herramientas base de modelado por script.
- [[Texturas]]: máscaras de cara y tatuaje hechas con Python.
- `tools/caida/pruebas.mjs`: pruebas de la caída libre, el paracaídas y deslizarse (ver [[caida.js]]).
- `tools/controles/pruebas.mjs`: pruebas del registro de controles y opciones (ver [[controles.js]]).
- [[render.yaml]]: el Blueprint de Render (plan gratis) y sus variables. Pruebas: `node tools/hosting/pruebas.mjs` (ver [[hosting.js]]).
- [[Pruebas de construcción]]: piezas editadas, apoyo, derrumbes, vida y que lo que se ve coincida con lo que se pisa.
- [[Pruebas del loot]]: el loot de cofres, jugadores y construcciones nunca atraviesa paredes y queda apoyado.
- [[Pruebas del mapa]]: pruebas automáticas de colisiones, escaleras, puertas, alcance del loot, lo que se ve (caras al revés, caras que titilan, pisos falsos) y derrumbes.

## Memoria

[[Memoria/Índice de memoria|Memoria/]] guarda las decisiones y reglas que dio Rafael, con fecha. Leerla antes de trabajar.
