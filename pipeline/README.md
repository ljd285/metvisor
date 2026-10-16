# pipeline/

Descarga ICON-EU (rejilla regular lat-lon) de `opendata.dwd.de` y genera en `web/data/`:

- `manifest.json`: pasada, pasos, límites de la imagen, variables y paletas.
- `frames/<variable>/<paso>.png`: PNG paletizado en Web Mercator (índice 255 = sin dato).
- `values/<variable>.png`: rejilla nativa con el valor de cada celda en 16 bit (R,G; B=255 sin dato), pasos apilados en vertical. La web la lee para mostrar el valor bajo el cursor.
- `isobars/<paso>.json`: isobaras cada 4 hPa (GeoJSON, marching squares sobre la presión a nivel del mar).

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r pipeline/requirements.txt
python -m unittest discover -s pipeline/tests -t .        # pruebas con GRIB sintéticos
python -m pipeline.build --out web/data --max-step 6        # prueba rápida con datos reales
python -m pipeline.build --out web/data                     # pasada completa (93 pasos)
```

Notas:
- Precipitación: `TOT_PREC` es acumulada; se convierte a mm/h con la diferencia entre pasos.
- Rachas (`VMAX_10M`) no existen en +0 h: ese paso reutiliza el primero disponible.
- `web/data/` está en `.gitignore`; lo genera el workflow de GitHub Actions en cada despliegue.
