# sf_tools.py

Volver a [[Inicio]]

Archivo: `tools/blender/sf_tools.py`. Herramientas para modelar el personaje en Blender por script (funciones como `ss`, `cyl`, `apply_mods`, `clean_border`, etc.). Se carga con `exec(open(...).read())` y queda disponible como `builtins.SF` para los demás scripts de [[Pipeline del héroe]].

- La carpeta de salida `OUT` está fija a una ruta de Windows de la PC de Rafael (`C:\Users\rafae\SaltoFinal_modelos`); a diferencia de `armas_base.py`, este archivo no lee `SF_OUT`.
- Usa `numpy`.
