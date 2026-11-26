# lobby.js

Volver a [[Inicio]]

Archivo: `public/js/lobby.js`. `crearLobby({renderer, canvas})`: escena propia con cielo en degradado y estrellas, plataforma con anillo dorado y halo, chispas, nubes y el bus volador cruzando de fondo. El personaje ([[models.js]] `createCharacter`, con la skin puesta) se gira arrastrando y puede bailar. En pantallas anchas va a la derecha (botones a la izquierda); en el celular, arriba. [[main.js]] llama a `render(dt)` mientras no hay sala.
