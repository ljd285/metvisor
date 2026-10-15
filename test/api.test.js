import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUrl, fetchForecast } from '../src/api.js';

test('buildUrl usa el endpoint dwd-icon con icon_eu', () => {
  const u = new URL(buildUrl([{ lat: 40.4, lon: -3.7 }, { lat: 41.4, lon: 2.1 }], ['temperature_2m']));
  assert.equal(u.pathname, '/v1/dwd-icon');
  assert.equal(u.searchParams.get('models'), 'icon_eu');
  assert.equal(u.searchParams.get('latitude'), '40.4,41.4');
  assert.equal(u.searchParams.get('longitude'), '-3.7,2.1');
});

test('fetchForecast combina respuestas (array y objeto único)', async () => {
  const mk = t => ({ hourly: { time: ['2026-01-01T00:00'], temperature_2m: [t] } });
  const fake = async url => ({
    ok: true,
    json: async () => (url.includes('latitude=1%2C2') ? [mk(1), mk(2)] : mk(3)),
  });
  const a = await fetchForecast([{ lat: 1, lon: 0 }, { lat: 2, lon: 0 }], ['temperature_2m'], fake);
  assert.deepEqual(a.data.temperature_2m, [[1], [2]]);
  const b = await fetchForecast([{ lat: 3, lon: 0 }], ['temperature_2m'], fake);
  assert.deepEqual(b.data.temperature_2m, [[3]]);
});
