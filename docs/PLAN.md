# Plan de trabajo: visor tipo wxcharts alojado en GitHub Pages

## 1. Qué es wxcharts (y qué implica copiarlo)
Mapas de modelos (GFS, ECMWF, ICON…) con muchas variables: el usuario elige modelo, pasada (run),
variable, región y hora; hay animación, valores al pasar el ratón y meteogramas por punto.
Detrás hay un **proceso servidor** que descarga los datos brutos del modelo y los **pre-renderiza** como imágenes.
El navegador solo muestra imágenes ya hechas: por eso es rápido.

## 2. Restricción clave: GitHub Pages es solo estático
No hay backend. Por tanto la API de Open-Meteo (consultar una malla desde el navegador) no sirve como base:
resolución pobre, límites de uso gratuito (uso no comercial), lenta y frágil con visitantes.

**Solución: pipeline en GitHub Actions** que, con un cron, descarga los GRIB2 de ICON-EU del DWD
(`opendata.dwd.de`, licencia abierta, atribución «Quelle: Deutscher Wetterdienst»), genera las imágenes y
las publica en Pages. Sin servidores propios y gratis en repos públicos.
Open-Meteo se usa solo para lo puntual (meteograma al hacer clic), donde la carga es mínima.

## 3. Arquitectura
```
cron (Actions, tras cada pasada ICON-EU: 00/06/12/18 UTC, ~4 h de retraso)
  └─ pipeline/ (Python: eccodes + numpy + Pillow)
       1. descarga GRIB2 regular lat-lon del DWD (variable × hora)
       2. recorta al dominio (Iberia + entorno, ampliable a Europa)
       3. reproyecta a Web Mercator (remuestreo por filas; imagen exacta sobre el mapa)
       4. colorea con paleta por variable -> PNG/WebP paletizado (+ rejilla de valores 8/16 bit para hover)
       5. isobaras (MSLP) -> GeoJSON
       6. escribe manifest.json (pasada, horas, variables, límites, leyendas)
  └─ deploy a GitHub Pages (artefacto; solo se conserva la última pasada, el repo no crece)

web/ (JS puro + MapLibre GL JS o Leaflet por CDN, sin bundler)
  lee manifest.json -> superpone la imagen de (variable, hora) -> controles y leyenda
```
Presupuesto de tamaño (límite Pages 1 GB; objetivo < 300 MB): dominio recortado, ~93 horas
(horario hasta +78 h, trihorario hasta +120 h), PNG paletizado ~50–100 kB → ~10 variables ≈ 60–90 MB.

## 4. Fases
**Fase 0 · Cimientos (1 sesión).** Empezar de cero: borrar el prototipo actual, estructura `web/` + `pipeline/` + `.github/workflows/`,
mapa base y despliegue «hola mundo» en Pages.

**Fase 1 · Interfaz con datos de muestra (1–2 sesiones).** Layout tipo wxcharts: barra superior (variable, región),
barra inferior de tiempo con play/pausa y pasos, leyenda, atribución, responsive. Se desarrolla con imágenes de ejemplo
para no depender aún del pipeline.

**Fase 2 · Pipeline v1 (2–3 sesiones).** Script local reproducible; primeras variables: temperatura 2 m,
precipitación, nubosidad, viento 10 m/rachas, presión (MSL + isobaras). Test con un GRIB real.
Workflow con cron y reintentos (los ficheros del DWD tardan en aparecer).

**Fase 3 · Interacción (1–2 sesiones).** Valor bajo el cursor, clic → meteograma (Open-Meteo), regiones predefinidas,
enlaces compartibles por URL (`#var=…&t=…&z=…`), precarga de frames.

**Fase 4 · Más variables y capas (hecha, pendiente de verificar con datos reales).** CAPE, isoterma 0 °C, T850, geopotencial 500 hPa, nieve, humedad,
partículas de viento (canvas con U/V) y fronteras sobre el campo.

**Fase 5 · Pulido.** Rendimiento (WebP, carga diferida), accesibilidad, PWA, tests del pipeline, monitor de fallos del cron.

**Fase 6 · Online «de verdad» (futuro).** Dominio propio, almacenamiento de objetos + CDN (Cloudflare R2/S3) para varias pasadas
y más modelos (ICON-D2 para centro de Europa, ICON global, otros); backend opcional. Revisar licencias si hay uso comercial.

## 5. Riesgos y decisiones abiertas
- Tamaño/tiempo de las Actions → recorte de dominio y paso de tiempo configurable.
- Retraso/cortes en `opendata.dwd.de` → reintentos y conservar la pasada anterior si falla la nueva.
- Instalación de eccodes en Actions → verificar pronto.
- ICON-D2 (2 km) no cubre Iberia: el modelo base es ICON-EU (~6,5 km).
- MapLibre (más potente, WebGL) vs Leaflet (más simple). Recomendación: **MapLibre**.
- Decisiones para ti: variables prioritarias, dominio inicial (¿solo Iberia o Europa?), nombre del repositorio público.
