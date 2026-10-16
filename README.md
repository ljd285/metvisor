# Metvisor

Visor meteorológico estilo wxcharts para la península ibérica, con datos del modelo ICON-EU del DWD.
JavaScript puro en el navegador; los datos se generan con un proceso programado (GitHub Actions) y se
publican como imágenes en GitHub Pages. Plan completo: [`docs/PLAN.md`](docs/PLAN.md).

## Estado
- Fase 0 y 1: mapa, panel de variables, barra de tiempo y leyenda (hecho).
- Fase 2: pipeline `pipeline/` que genera imágenes ICON-EU reales; el workflow las construye en cada despliegue y cada 6 h.
  Sin `web/data/`, la web muestra datos de muestra sintéticos (etiqueta naranja).
- Fase 3: valor bajo el cursor, meteograma al pulsar en el mapa (Open-Meteo, ICON-EU), isobaras, regiones y URL compartible
  (`#var=…&t=…&c=lat,lon,zoom`). Atajos: espacio = play, ← → = cambiar hora, `/` = buscar lugar, Esc = cerrar meteograma.
- Fase 3b: mapa base con relieve (sombreado de Terrain Tiles de AWS) y etiquetas encima del campo; fondo seleccionable (gris claro de Esri u OpenStreetMap); valores bajos
  transparentes (`hide_below` en `pipeline/config.py`); buscador de lugares (Open-Meteo Geocoding) y marcador arrastrable
  para el meteograma.

- Móvil: menú lateral con botón ✕ y fondo para cerrarlo, buscador a ancho completo, controles táctiles de 40+ px, valor al tocar el mapa,
  diseño apaisado, márgenes seguros (notch) y descarga de rejillas solo al usarlas.
- Fase 5 (en curso): costas además de fronteras sobre el campo; aviso de antigüedad de la pasada en el panel; el workflow guarda
  la última pasada buena (si la descarga falla se despliega esa, el trabajo termina en rojo y GitHub avisa por correo);
  commit semanal en la rama `keepalive` para que GitHub no desactive el cron tras 60 días sin actividad.
- Fase 4: fronteras por encima del campo (`web/geo/borders.json`, Natural Earth), nuevas variables (humedad, nieve, CAPE, isoterma 0 °C,
  T 850 hPa, geopotencial 500 hPa) y viento animado con partículas.

## Ver la web en local
Abre un servidor estático en `web/` (el mapa carga recursos externos, así que no basta `file://` en todos los navegadores):

```bash
python3 -m http.server 8000 --directory web   # http://localhost:8000
# con datos reales: primero  python -m pipeline.build  (ver pipeline/README.md)
```

## Publicar en GitHub Pages
1. Fusiona esta rama en `main`.
2. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. El workflow `.github/workflows/pages.yml` publica `web/` en cada push a `main`.

## Estructura
```
web/        sitio estático (lo que se publica)
pipeline/   generación de datos (Fase 2)
docs/       plan de trabajo
.github/    workflows
```

Fronteras y costas: Natural Earth (dominio público), vía el paquete npm `world-atlas`; se regeneran con `tools/make_borders.mjs`.
Atribución: Deutscher Wetterdienst (ICON-EU), Open-Meteo, © OpenStreetMap, Esri, Mapzen/AWS Terrain Tiles.
Nota: CARTO dejó de servir teselas sin clave (mostraba «API KEY REQUIRED»), por eso se usa Esri u OSM. Ambos son para uso ligero/no comercial;
si el proyecto crece habrá que contratar un proveedor de teselas o autoalojarlas (p. ej. OpenFreeMap, MapTiler).
