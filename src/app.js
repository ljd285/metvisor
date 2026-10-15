import { BOUNDS, GRID_STEP, VARIABLES } from './config.js';
import { buildGrid } from './lib/grid.js';
import { cssGradient } from './lib/colors.js';
import { fetchForecast } from './api.js';
import { FieldLayer } from './overlay.js';

const $ = id => document.getElementById(id);
const map = L.map('map').fitBounds([[BOUNDS.south, BOUNDS.west], [BOUNDS.north, BOUNDS.east]]);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap · ICON-EU/DWD · Open-Meteo', maxZoom: 12,
}).addTo(map);
const layer = new FieldLayer().addTo(map);

const grid = buildGrid(BOUNDS, GRID_STEP);
let forecast = null;

for (const [key, v] of Object.entries(VARIABLES)) $('variable').add(new Option(v.label, key));

function show() {
  if (!forecast) return;
  const key = $('variable').value, t = +$('timeSlider').value, spec = VARIABLES[key];
  const { lats, lons } = grid;
  const values = lats.map((_, i) => lons.map((_, j) => forecast.data[key][i * lons.length + j][t]));
  layer.setField(grid, values, spec);
  $('timeLabel').textContent = forecast.times[t].replace('T', ' ');
  $('legend').style.background = cssGradient(spec.colors);
  $('legend').innerHTML = '';
  $('legend').title = `${spec.min} – ${spec.max} ${spec.unit}`;
}

async function load() {
  try {
    $('status').textContent = `Descargando ${grid.points.length} puntos…`;
    forecast = await fetchForecast(grid.points, Object.keys(VARIABLES));
    $('timeSlider').max = forecast.times.length - 1;
    $('status').textContent = `${grid.points.length} puntos · ${forecast.times.length} horas`;
    show();
  } catch (e) {
    $('status').textContent = `Error: ${e.message}`;
  }
}

$('variable').addEventListener('change', show);
$('timeSlider').addEventListener('input', show);
load();
