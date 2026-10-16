// Genera web/geo/borders.json (fronteras entre países, Natural Earth 10m, dominio público)
// desde el paquete npm world-atlas, recortado a la zona del visor.
//   cd tools && npm install world-atlas topojson-client && node make_borders.mjs ../web/geo/borders.json
import { readFileSync, writeFileSync } from 'node:fs';
import { mesh } from 'topojson-client';

const [W, S, E, N] = [-20, 28, 15, 52]; // = maxBounds del visor
const topo = JSON.parse(readFileSync('node_modules/world-atlas/countries-10m.json', 'utf8'));
const lines = mesh(topo, topo.objects.countries, (a, b) => a !== b); // solo arcos compartidos entre países
const inside = ([x, y]) => x >= W && x <= E && y >= S && y <= N;
const kept = lines.coordinates
  .filter((l) => l.some(inside))
  .map((l) => l.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]));
const out = { type: 'Feature', properties: { source: 'Natural Earth 10m via world-atlas' },
  geometry: { type: 'MultiLineString', coordinates: kept } };
writeFileSync(process.argv[2], JSON.stringify(out));
console.log(`${kept.length} líneas, ${kept.reduce((n, l) => n + l.length, 0)} puntos`);
