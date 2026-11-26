# Mapa y marcas

Volver a [[Inicio]] · código: [[mapaHud.js]] · pedido: [[Memoria/Mapa abrible y marcas|Mapa abrible y marcas]]

Cómo el jugador ve la isla durante la partida (el diseño de la isla está en [[Mapa de la isla]]).

- **Minimapa** arriba a la derecha: sigue al jugador con el norte arriba, se aleja en el bus y en la caída, y muestra la [[Tormenta]] (afuera en violeta, la próxima zona punteada), el recorrido del bus, los autos, las marcas y una línea hasta la zona segura si estás afuera. El zoom a pie se elige en Configuración (*Zoom del minimapa*).
- **Brújula** arriba al centro: hacia dónde mirás, las marcas con su distancia y la zona segura.
- **Mapa grande** con M (se cambia en Configuración → Controles → *Abrir / cerrar el mapa*): la isla con relieve, agua, río, calles, casas, teleférico, grilla A–J / 1–10 y los nombres de los pueblos. Zoom con la rueda, arrastrar para moverlo. En el bus se abre mostrando la isla entera y el recorrido, para elegir dónde caer.
- **Marcas**: clic en el mapa (o la tecla *Marcar*, clic de la rueda o T, mirando a un lugar del mundo). Cada jugador tiene una sola marca, de su color; otro clic la mueve y clic sobre ella o clic derecho la saca. Se ve en el mapa, en el minimapa, en la brújula y en el mundo como un haz de luz con la distancia.
- **Compartir**: con la opción *Compartir tus marcas con la sala* (activada de fábrica) el servidor se la pasa a todos los de la sala, que la ven con tu nombre. Como todavía no hay equipos, la ven todos; al morir o irte, tu marca se borra. Ver [[Protocolo de red]].
