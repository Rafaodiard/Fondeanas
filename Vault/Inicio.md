# Salto Final · Inicio

Battle royale 3D para navegador: isla fija con 10 pueblos ([[Mapa de la isla]]), bus volador, caída libre con planeo y picada, paracaídas que se abre y se cierra, deslizarse, tormenta que se achica y salas privadas a las que se entra con un código de 5 letras.

- Repo: https://github.com/Rafaodiard/Fondeanas
- Stack: Node (`server.js` con `ws`) + Three.js 0.170 como ES modules sin bundler. `npm start` levanta todo en el puerto 3000 (`PORT` lo cambia).
- Vault actualizado con la construcción estilo battle royale (rama `claude/project-thread-s1zvnx`, 2026-11-26), sobre el commit `eecf634` de `main` (que ya trae el cofre y los objetos del piso modelados, y la caída libre, el paracaídas y deslizarse). El grafo de graphify no se regeneró en esta tanda (ver [[Graphify de la PC de Rafael]]).

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
| [[rig.js]] | `public/js/rig.js` | Esqueleto y animaciones del personaje por capas, paracaídas colgado de los hombros |
| [[caida.js]] | `public/js/caida.js` | Física de la caída libre (planeo / picada), el paracaídas y deslizarse |
| [[audio.js]] | `public/js/audio.js` | Sonidos sintetizados con WebAudio y volumen general |
| [[controles.js]] | `public/js/controles.js` | Registro central de teclas (acciones con contexto) y opciones del juego, guardados en `localStorage` |
| [[construccion.js]] | `public/js/construccion.js` | Reglas de la construcción: ediciones, superficies, choques, apoyo, derrumbes y vida (compartido) |
| [[construccion3d.js]] | `public/js/construccion3d.js` | Mallas de las construcciones, vista previa, grilla de edición y relleno al levantarse |
| [[construir.js]] | `public/js/construir.js` | La construcción en el juego: modo construcción, colocar, editar, material automático y su HUD |
| [[configuracion.js]] | `public/js/configuracion.js` | Panel de configuración: Juego, Video, Sonido y Controles |

## Pantallas

- [[index.html]]: menú, sala de espera y HUD del juego.
- [[visor.html]]: visor del personaje para revisar animaciones.
- [[mapa.html]]: visor del mapa para recorrer la isla.
- [[loot.html]]: vitrina del loot (cofres, armas por rareza y objetos).

## Sistemas del juego

- [[Mapa de la isla]] · [[Estructuras rompibles]] · [[Salas y partidas]] · [[Bus, caída y paracaídas]] · [[Deslizarse]] · [[Tormenta]] · [[Loot y rarezas]] · [[Armas y disparo]] · [[Construcción]] · [[Pico y recursos]] · [[Curación y escudo]] · [[Configuración y controles]]

## Arte y herramientas

- [[Modelos GLB]]: los archivos de `public/models` y quién los usa.
- [[Pipeline del héroe]]: scripts de Blender del personaje (malla, ropa, rig, clips, export).
- [[Pipeline del loot]]: scripts de Blender del cofre y los objetos del piso.
- [[Pipeline de armas]]: scripts de Blender de las armas (modelado, horneado, recargas, export).
- [[Pipeline del bus]]: script de Blender del bus volador (modelado, fotos y export).
- [[sf_tools.py]]: herramientas base de modelado por script.
- [[Texturas]]: máscaras de cara y tatuaje hechas con Python.
- `tools/caida/pruebas.mjs`: pruebas de la caída libre, el paracaídas y deslizarse (ver [[caida.js]]).
- `tools/controles/pruebas.mjs`: pruebas del registro de controles y opciones (ver [[controles.js]]).
- [[Pruebas de construcción]]: piezas editadas, apoyo, derrumbes, vida y que lo que se ve coincida con lo que se pisa.
- [[Pruebas del mapa]]: pruebas automáticas de colisiones, escaleras, puertas, alcance del loot, lo que se ve (caras al revés, caras que titilan, pisos falsos) y derrumbes.

## Memoria

[[Memoria/Índice de memoria|Memoria/]] guarda las decisiones y reglas que dio Rafael, con fecha. Leerla antes de trabajar.
