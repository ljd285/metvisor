# Metvisor

Visor meteorológico, 100 % JavaScript, sin instalación.
Datos en abierto de [Open-Meteo](https://open-meteo.com), empezando por ICON-EU del DWD.

## Cómo usarlo

Abre `index.html` con doble clic en el navegador. No hace falta Node, npm ni servidor.

- Un mapa con selector de **modelo** (ICON-EU por defecto) y de **variable**.
- Un deslizador de **hora** (48 h).

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
