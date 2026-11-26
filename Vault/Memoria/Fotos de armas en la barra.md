# Fotos de armas en la barra

Volver a [[Índice de memoria]] · resultado en [[iconos.js]], [[Loot y rarezas]] y [[index.html]]

**2026-11-26 · Rafael**

"Hace que aparezcan fotos de las armas en la barra de items".

**2026-11-26 · Claude (al hacer ese pedido)**

- Las fotos no son imágenes guardadas: se sacan al cargar el juego de los modelos 3D de `armas.glb` y `objetos.glb`, con la franja de la rareza. Se descartaron las imágenes de `referencias/*.webp` de la carpeta del proyecto (son referencias, no los modelos del juego, y no hay una por rareza). Así cada ícono coincide con el arma que tenés en la mano y se actualiza solo si cambia el modelo.
- También tienen foto el pico y los consumibles (vendas, botiquín, frasco y bidón), para que la barra quede pareja.
- Con la foto, el nombre no entraba en el lugar ("Rifle de asalto" tapaba el arma y "Francotirador" se cortaba): el nombre quedó de `title` y al costado izquierdo de la barra se muestra el nombre de lo que tenés en la mano y su rareza en su color, como en los battle royale del género. En pantallas de menos de 1000 px ese cartel se esconde.
