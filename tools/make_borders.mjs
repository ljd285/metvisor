// Genera en web/geo:
//   borders.json    fronteras entre países         (Natural Earth 10m, dominio público, paquete npm world-atlas)
//   coast.json      líneas de costa                (ídem)
//   regions.json    límites entre comunidades autónomas  (IGN España, paquete npm es-atlas)
//   provinces.json  límites entre provincias             (ídem)
// Todo recortado a la zona del visor.
//   cd tools && npm install world-atlas es-atlas topojson-client && node make_borders.mjs ../web/geo
import { readFileSync, writeFileSync } from 'node:fs';
import { mesh } from 'topojson-client';

const [W, S, E, N] = [-20, 28, 15, 52]; // = maxBounds del visor
const M = 0.5; // margen para que las líneas no se corten dentro del encuadre
const inside = ([x, y]) => x >= W - M && x <= E + M && y >= S - M && y <= N + M;

// Parte una línea en los tramos consecutivos que caen dentro del recorte.
function clip(line) {
  const runs = []; let cur = [];
  for (const p of line) {
    if (inside(p)) cur.push(p);
    else { if (cur.length > 1) runs.push(cur); cur = []; }
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}

// Douglas-Peucker: quita puntos que se desvían menos de `tol` grados de la recta (~100 m con 0.001).
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const [fx, fy] = pts[0], [lx, ly] = pts[pts.length - 1];
  if (fx === lx && fy === ly) { // anillo cerrado: se parte por la mitad para tener una recta de referencia
    const m = pts.length >> 1;
    return simplify(pts.slice(0, m + 1), tol).slice(0, -1).concat(simplify(pts.slice(m), tol));
  }
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-12;
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / len;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= tol) return [pts[0], pts[pts.length - 1]];
  return simplify(pts.slice(0, idx + 1), tol).slice(0, -1).concat(simplify(pts.slice(idx), tol));
}

function write(file, topo, object, filter, source) {
  const lines = mesh(topo, object, filter);
  const kept = lines.coordinates
    .flatMap(clip)
    .map((l) => simplify(l, 0.0008).map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]));
  const out = { type: 'Feature', properties: { source }, geometry: { type: 'MultiLineString', coordinates: kept } };
  writeFileSync(file, JSON.stringify(out));
  console.log(`${file}: ${kept.length} líneas, ${kept.reduce((n, l) => n + l.length, 0)} puntos`);
}

const dir = process.argv[2];
const countries = JSON.parse(readFileSync('node_modules/world-atlas/countries-10m.json', 'utf8'));
write(`${dir}/borders.json`, countries, countries.objects.countries, (a, b) => a !== b, 'Natural Earth 10m via world-atlas'); // arcos compartidos entre países
const land = JSON.parse(readFileSync('node_modules/world-atlas/land-10m.json', 'utf8'));
write(`${dir}/coast.json`, land, land.objects.land, undefined, 'Natural Earth 10m via world-atlas');

// España (IGN): solo los arcos compartidos por dos entidades, es decir, límites interiores; las costas y las fronteras con
// otros países ya están en coast.json y borders.json.
const spain = JSON.parse(readFileSync('node_modules/es-atlas/es/provinces.json', 'utf8'));
const ign = 'IGN España via es-atlas';
write(`${dir}/regions.json`, spain, spain.objects.autonomous_regions, (a, b) => a !== b, ign);
write(`${dir}/provinces.json`, spain, spain.objects.provinces, (a, b) => a !== b, ign);
