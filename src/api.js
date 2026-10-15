// Cliente de Open-Meteo para el modelo ICON del DWD.
import { API_URL, MODEL, CHUNK_SIZE, FORECAST_DAYS } from './config.js';
import { chunk } from './lib/grid.js';

export function buildUrl(points, variables) {
  const p = new URLSearchParams({
    latitude: points.map(q => q.lat).join(','),
    longitude: points.map(q => q.lon).join(','),
    hourly: variables.join(','),
    models: MODEL,
    forecast_days: String(FORECAST_DAYS),
    timezone: 'UTC',
  });
  return `${API_URL}?${p}`;
}

// Devuelve { times: string[], data: { variable: number[][] } } con data[var][puntoIdx][horaIdx]
export async function fetchForecast(points, variables, fetchFn = fetch) {
  const responses = await Promise.all(chunk(points, CHUNK_SIZE).map(async group => {
    const res = await fetchFn(buildUrl(group, variables));
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return Array.isArray(json) ? json : [json]; // 1 punto => objeto, varios => array
  }));
  const flat = responses.flat();
  const times = flat[0].hourly.time;
  const data = Object.fromEntries(variables.map(v => [v, flat.map(r => r.hourly[v])]));
  return { times, data };
}
