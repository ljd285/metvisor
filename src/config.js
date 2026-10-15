// Configuración central del visor.
export const API_URL = 'https://api.open-meteo.com/v1/dwd-icon';

// ICON-EU (~6,5 km, 5 días) cubre Europa entera incluida la península ibérica.
// ICON-D2 (2 km) solo cubre Europa central, no Iberia: queda para una fase posterior.
export const MODEL = 'icon_eu';

// Dominio inicial: península ibérica + Baleares + Canarias quedan para más adelante.
export const BOUNDS = { south: 35.8, north: 44.0, west: -9.8, east: 4.6 };
export const GRID_STEP = 0.8;          // grados entre puntos de muestreo
export const CHUNK_SIZE = 50;          // puntos por petición (límite de URL/API)
export const FORECAST_DAYS = 2;

export const VARIABLES = {
  temperature_2m: { label: 'Temperatura 2 m (°C)', unit: '°C', min: -10, max: 40,
    colors: ['#3b4cc0', '#6fa8dc', '#f6f6c0', '#f4a259', '#b40426'] },
  precipitation: { label: 'Precipitación (mm/h)', unit: 'mm', min: 0, max: 10,
    colors: ['#ffffff', '#a6d8f0', '#3f8fd2', '#6a3d9a', '#d1005f'] },
  cloud_cover: { label: 'Nubosidad (%)', unit: '%', min: 0, max: 100,
    colors: ['#fdfdfd', '#c8c8c8', '#6e6e6e'] },
  wind_speed_10m: { label: 'Viento 10 m (km/h)', unit: 'km/h', min: 0, max: 90,
    colors: ['#ffffcc', '#a1dab4', '#41b6c4', '#2c7fb8', '#253494'] },
  pressure_msl: { label: 'Presión (hPa)', unit: 'hPa', min: 990, max: 1040,
    colors: ['#762a83', '#e7d4e8', '#f7f7f7', '#d9f0d3', '#1b7837'] },
};
