import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid, bilinear, chunk } from '../src/lib/grid.js';
import { colorAt } from '../src/lib/colors.js';

test('buildGrid genera lats×lons puntos', () => {
  const g = buildGrid({ south: 0, north: 1, west: 0, east: 2 }, 1);
  assert.equal(g.lats.length, 2);
  assert.equal(g.lons.length, 3);
  assert.equal(g.points.length, 6);
});

test('chunk divide en grupos', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test('bilinear interpola en el centro y devuelve null fuera', () => {
  const g = { lats: [0, 1], lons: [0, 1] };
  const v = [[0, 10], [20, 30]];
  assert.equal(bilinear(g, v, 0.5, 0.5), 15);
  assert.equal(bilinear(g, v, 2, 0), null);
});

test('colorAt devuelve extremos de la rampa', () => {
  assert.deepEqual(colorAt(['#000000', '#ffffff'], 0), [0, 0, 0]);
  assert.deepEqual(colorAt(['#000000', '#ffffff'], 1), [255, 255, 255]);
});
