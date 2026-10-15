# Metvisor

Comparador de salidas de modelos meteorológicos, 100 % JavaScript, sin instalación.
Datos en abierto de [Open-Meteo](https://open-meteo.com) (ICON del DWD, ECMWF, GFS, ARPEGE).

## Cómo usarlo

Abre `index.html` con doble clic en el navegador. No hace falta Node, npm ni servidor.

- Dos mapas lado a lado, sincronizados (zoom y desplazamiento).
- Cada mapa tiene su selector de **modelo** y de **variable**.
- Un único deslizador de **hora** (48 h) controla los dos.
- Por defecto: ICON-EU (izquierda) frente a ECMWF IFS (derecha) sobre la península ibérica.

## Archivos

```
index.html   página y estilos
js/app.js    descarga de datos, interpolación y mapas (Leaflet por CDN)
docs/ROADMAP.md
```

## Notas

- ICON-EU (~6,5 km) cubre Iberia; ICON-D2 (2 km) solo Europa central.
- No he podido probarlo contra la API real desde el entorno de desarrollo: si algo falla, el mensaje
  de error aparece arriba junto al deslizador.
- Atribución: Open-Meteo (CC BY 4.0), DWD y demás servicios de origen, © OpenStreetMap.
