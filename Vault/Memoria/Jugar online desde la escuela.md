# Jugar online desde la escuela

Volver a [[Índice de memoria]] · sistema en [[Jugar online]]

**2026-11-26 (18:47 hora de Buenos Aires) · Rafael**: "Busca la mejor solución para poder jugar esto online con mis amigos, la idea es en la escuela que la red bloquea cosas como abrir el server desde la compu, lo ideal es poder entrar en una página y que se pueda meter quien quiera".

Requisito que pasó el coordinador del proyecto: que no dependa de la compu de Rafael ni de túneles (Cloudflare Tunnel se había sugerido antes en el chat).

Decisiones (Claude, 2026-11-26; se pueden cambiar):
- Hosting: **Render, plan gratis** (sin tarjeta, Node con WebSockets). Descartados: Koyeb (pide tarjeta desde febrero de 2026), Railway (1 dólar por mes no alcanza), Fly.io (sin plan gratis estable), Hugging Face Spaces (Docker pasó a pago), Glitch (cerró en julio de 2025).
- Región Virginia. Auto-deploy en cada merge a `main` (corta las partidas abiertas; Rafael lo puede apagar en Render).
- En Render, bots hasta 4 jugadores en total por sala (`SF_BOTS_MAX=4`) porque 0,1 CPU no alcanza para más.
- La compresión del WebSocket queda apagada (gasta la CPU que necesita la partida).

Lo que tiene que hacer Rafael: crear la cuenta en Render con GitHub y el Blueprint del repo (pasos en el README), y probar `/salud` desde la red de la escuela.
