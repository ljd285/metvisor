# Metvisor

Visor meteorológico web, 100 % JavaScript (ES modules, sin paso de compilación), con datos del
modelo **ICON** del Deutsche Wetterdienst (DWD) servidos en abierto por [Open-Meteo](https://open-meteo.com).

## Arranque rápido

```bash
npm start      # http://localhost:8080
npm test       # pruebas unitarias (node:test, sin dependencias)
```

## Datos

| Modelo   | Resolución | Cobertura                         | Uso                    |
|----------|-----------|-----------------------------------|------------------------|
| ICON-EU  | ~6,5 km   | Europa (incluye toda Iberia), 5 d | **Modelo inicial**     |
| ICON-D2  | ~2 km     | Europa central (no incluye Iberia)| Fase posterior, opcional |
| ICON     | ~11 km    | Global, 7,5 d                     | Fondo / respaldo       |

Endpoint: `https://api.open-meteo.com/v1/dwd-icon?models=icon_eu&latitude=..&longitude=..&hourly=..`
(acepta listas separadas por comas de coordenadas → un retículo en pocas peticiones).
La API gratuita es para uso no comercial y tiene límites de peticiones; ver `docs/ROADMAP.md`.

## Estructura

```
index.html        página única
css/style.css
src/config.js     modelo, dominio, variables y paletas
src/api.js        cliente Open-Meteo (troceado en lotes)
src/overlay.js    capa canvas de Leaflet con el campo interpolado
src/app.js        UI: variable, slider horario, leyenda
src/lib/          grid.js (retículo/interpolación) y colors.js
test/             pruebas
server.js         servidor estático mínimo
docs/ROADMAP.md   pasos para construir el visor
```

## Estado

Fase 1 (esqueleto) implementada: mapa Leaflet + retículo sobre Iberia + 5 variables + slider horario.
Nota: el entorno donde se escribió no podía llamar a Open-Meteo, así que la integración con la API
real está cubierta solo con pruebas simuladas; **verifícala en tu navegador** al ejecutar `npm start`.

Atribución requerida: datos de Open-Meteo (CC BY 4.0) y DWD; mapa base © OpenStreetMap.
