// Generación del retículo de puntos y utilidades de interpolación.
export function buildGrid({ south, north, west, east }, step) {
  const lats = [], lons = [];
  for (let la = south; la <= north + 1e-9; la += step) lats.push(+la.toFixed(4));
  for (let lo = west; lo <= east + 1e-9; lo += step) lons.push(+lo.toFixed(4));
  const points = [];
  for (const lat of lats) for (const lon of lons) points.push({ lat, lon });
  return { lats, lons, points };
}

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Interpolación bilineal sobre una matriz values[iLat][iLon].
export function bilinear(grid, values, lat, lon) {
  const { lats, lons } = grid;
  if (lat < lats[0] || lat > lats.at(-1) || lon < lons[0] || lon > lons.at(-1)) return null;
  const step = (arr, v) => Math.min(arr.length - 2, Math.max(0, Math.floor((v - arr[0]) / (arr[1] - arr[0]))));
  const i = step(lats, lat), j = step(lons, lon);
  const ty = (lat - lats[i]) / (lats[i + 1] - lats[i]);
  const tx = (lon - lons[j]) / (lons[j + 1] - lons[j]);
  const v00 = values[i][j], v01 = values[i][j + 1], v10 = values[i + 1][j], v11 = values[i + 1][j + 1];
  if ([v00, v01, v10, v11].some(v => v == null)) return null;
  return (v00 * (1 - tx) + v01 * tx) * (1 - ty) + (v10 * (1 - tx) + v11 * tx) * ty;
}
