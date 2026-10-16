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
- Fase 3b: mapa base CARTO con relieve (sombreado de Terrain Tiles de AWS) y etiquetas encima del campo; valores bajos
  transparentes (`hide_below` en `pipeline/config.py`); buscador de lugares (Open-Meteo Geocoding) y marcador arrastrable
  para el meteograma.

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

Atribución: Deutscher Wetterdienst (ICON-EU), Open-Meteo, © OpenStreetMap, © CARTO, Mapzen/AWS Terrain Tiles.
Nota: los mapas base de CARTO son gratuitos para uso no comercial; si el proyecto pasa a uso comercial habrá que cambiar de proveedor.
