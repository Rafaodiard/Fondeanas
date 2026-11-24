# Mantenimiento del vault

Volver a [[Índice de memoria]] · ver también [[Grafo del código]]

**2026-11-24 · Rafael**

- `Vault/` es un vault de Obsidian que documenta el proyecto: una nota por módulo, pantalla, controlador o tabla importante, enlazadas con `[[wikilinks]]`, más el índice [[Inicio]].
- `Vault/graphify-out/` tiene el grafo generado con graphify (paquete pip `graphifyy`). Usarlo para entender la arquitectura antes de leer código a ciegas.
- Al empezar cada tarea: revisar `git log` de `main` y de la rama de trabajo y qué cambió desde la última actualización del vault; si hubo cambios, regenerar el grafo y actualizar las notas (agregar, corregir o borrar). Nunca dejar notas que contradigan el código.
- `Vault/Memoria/` es la memoria secundaria: cada hecho, decisión o regla nueva que diga Rafael va ahí, una nota por tema, con fecha y quién lo decidió.
- No inventar contenido: solo lo que se pueda verificar en el código o lo que dijo Rafael. Si el vault y el código se contradicen, avisarle a Rafael antes de decidir.
