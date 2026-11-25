# Salto Final · Inicio

Battle royale 3D para navegador: isla fija con 10 pueblos ([[Mapa de la isla]]), bus volador, caída libre con planeador, tormenta que se achica y salas privadas a las que se entra con un código de 5 letras.

- Repo: https://github.com/Rafaodiard/Fondeanas
- Stack: Node (`server.js` con `ws`) + Three.js 0.170 como ES modules sin bundler. `npm start` levanta todo en el puerto 3000 (`PORT` lo cambia).
- Vault actualizado con el mapa nuevo (rama `claude/project-thread-vbeczu`, 2026-11-25), sobre el commit `97f62a5` de `main`.

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
| [[models.js]] | `public/js/models.js` | Personajes, bus, armas y objetos (GLB o primitivas de respaldo) |
| [[rig.js]] | `public/js/rig.js` | Esqueleto y animaciones del personaje por capas |
| [[audio.js]] | `public/js/audio.js` | Sonidos sintetizados con WebAudio |

## Pantallas

- [[index.html]]: menú, sala de espera y HUD del juego.
- [[visor.html]]: visor del personaje para revisar animaciones.
- [[mapa.html]]: visor del mapa para recorrer la isla.

## Sistemas del juego

- [[Mapa de la isla]] · [[Salas y partidas]] · [[Bus, caída y planeador]] · [[Tormenta]] · [[Loot y rarezas]] · [[Armas y disparo]] · [[Construcción]] · [[Pico y recursos]] · [[Curación y escudo]]

## Arte y herramientas

- [[Modelos GLB]]: los archivos de `public/models` y quién los usa.
- [[Pipeline del héroe]]: scripts de Blender del personaje (malla, ropa, rig, clips, export).
- [[Pipeline de armas]]: scripts de Blender de las armas (modelado, horneado, recargas, export).
- [[sf_tools.py]]: herramientas base de modelado por script.
- [[Texturas]]: máscaras de cara y tatuaje hechas con Python.
- [[Pruebas del mapa]]: pruebas automáticas de colisiones, escaleras, puertas y alcance del loot.

## Memoria

[[Memoria/Índice de memoria|Memoria/]] guarda las decisiones y reglas que dio Rafael, con fecha. Leerla antes de trabajar.
