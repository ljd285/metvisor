// node --test web/test/*.test.js   (sin dependencias)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ValueGrid = require('../js/valuegrid.js');

// Misma codificación que pipeline/values.py: 12 bit → R = q >> 4, G = (q & 15) << 4, B = 255 si no hay dato.
function pixel(v, vmin, vmax) {
  const q = Math.round((v - vmin) / (vmax - vmin) * 4095);
  return [q >> 4, (q & 15) << 4, 0, 255];
}
function image(w, h, fill) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) px.set(fill(i % w, Math.floor(i / w)), i * 4);
  return px;
}
const spec = { vmin: -40, vmax: 55 };
const grid = { nx: 3, ny: 3, lat0: 44, lon0: -10, dlat: 1, dlon: 1 };

test('decodifica un valor constante con la precisión de 12 bit', () => {
  const px = image(3, 3, () => pixel(14.2, -40, 55));
  assert.ok(Math.abs(ValueGrid.sample(px, 3, grid, spec, 43, -9) - 14.2) < 0.025);
});

test('interpola en bilineal entre celdas', () => {
  const px = image(3, 3, (x) => pixel(x * 10, -40, 55));            // 0, 10, 20 en cada fila
  assert.ok(Math.abs(ValueGrid.sample(px, 3, grid, spec, 43, -8.5) - 15) < 0.05);
});

test('fuera de la rejilla devuelve null', () => {
  const px = image(3, 3, () => pixel(0, -40, 55));
  assert.equal(ValueGrid.sample(px, 3, grid, spec, 50, -9), null);
  assert.equal(ValueGrid.sample(px, 3, grid, spec, 43, 10), null);
});

test('una celda sin dato (B = 255) anula la interpolación que la toca', () => {
  const px = image(3, 3, (x, y) => (x === 1 && y === 1 ? [0, 0, 255, 255] : pixel(5, -40, 55)));
  assert.equal(ValueGrid.sample(px, 3, grid, spec, 43, -9), null);   // sobre la celda sin dato
  assert.ok(Math.abs(ValueGrid.sample(px, 3, grid, spec, 44, -10) - 5) < 0.05);   // esquina lejana, intacta
});

test('rango asimétrico (viento en m/s, -80..80)', () => {
  const wind = { vmin: -80, vmax: 80 };
  const px = image(3, 3, () => pixel(-3.5, -80, 80));
  assert.ok(Math.abs(ValueGrid.sample(px, 3, grid, wind, 43, -9) + 3.5) < 0.05);
});
