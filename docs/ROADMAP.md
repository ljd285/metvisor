# Hoja de ruta: pasos para construir el visor

## Fase 0 · Decisiones (hechas)
- Stack: JavaScript ES modules en el navegador, sin bundler; Leaflet para el mapa.
- Datos: ICON-EU vía Open-Meteo (`/v1/dwd-icon`, `models=icon_eu`), que sí cubre Iberia (ICON-D2 no).

## Fase 1 · Esqueleto ✅
1. Servidor estático y estructura de proyecto.
2. Mapa base Leaflet centrado en Iberia.
3. Retículo regular de puntos (`GRID_STEP`) y cliente API con lotes de `CHUNK_SIZE`.
4. Capa canvas con interpolación bilineal + rampas de color + leyenda.
5. Selector de variable y slider temporal (48 h).

## Fase 2 · Calidad de datos y rendimiento
1. Verificar la respuesta real de la API y ajustar `GRID_STEP`/`CHUNK_SIZE` a los límites de Open-Meteo.
2. Caché en `localStorage`/IndexedDB con caducidad por ciclo del modelo (ICON se actualiza cada 3 h).
3. Pintar en un `Worker`/`OffscreenCanvas` o con WebGL para fluidez al hacer zoom.
4. Reintentos con retroceso exponencial y gestión de errores 429.

## Fase 3 · Funcionalidad meteorológica
1. Más variables: racha de viento, humedad, isoterma 0 °C, CAPE, nieve, radiación.
2. Vectores/partículas de viento (u, v desde `wind_speed_10m` + `wind_direction_10m`).
3. Isobaras (contornos de `pressure_msl`, p. ej. con d3-contour).
4. Animación temporal (play/pausa) y selección del ciclo del modelo.
5. Clic en el mapa → meteograma de ese punto (gráfico horario; Chart.js o SVG propio).

## Fase 4 · Escalado de datos
1. Backend ligero (Node) que descargue GRIB2 de `opendata.dwd.de` (ICON-EU) o use los ficheros de
   Open-Meteo, y los sirva como teselas/binarios por variable y hora → evita límites de la API.
2. Reproyección y teselado de campos (Float32 → PNG/binario) consumidos por la capa del cliente.
3. Añadir ICON-D2 para el centro de Europa y ICON global como fondo.

## Fase 5 · Producto
1. Geolocalización, búsqueda de lugares y favoritos.
2. Diseño responsive/PWA y modo oscuro.
3. CI (tests + lint), despliegue en GitHub Pages / Netlify.
4. Cumplir licencias: atribución a Open-Meteo (CC BY 4.0), DWD y OSM; uso comercial exige plan de pago.
