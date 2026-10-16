"""Configuración del pipeline: dominio, variables ICON-EU y paso de tiempo."""

# Dominio publicado (oeste, sur, este, norte). Debe coincidir con el encuadre de la web.
BOUNDS = {"west": -10.5, "south": 35.0, "east": 4.8, "north": 44.5}

MODEL = "ICON-EU"
PROVIDER = "Deutscher Wetterdienst"
BASE_URL = "https://opendata.dwd.de/weather/nwp/icon-eu/grib"

# Pasadas con previsión a 120 h.
RUN_HOURS = (0, 6, 12, 18)
# Horario hasta +78 h y trihorario hasta +120 h (93 pasos).
STEPS = list(range(0, 79)) + list(range(81, 121, 3))

ISOBAR_INTERVAL = 4   # hPa entre isobaras
ISOBAR_STRIDE = 2     # submuestreo de la rejilla antes de contornear
SCALE = 2  # píxeles de salida por celda de la rejilla original

# vmin/vmax: rango de cuantización (16 bit) de la rejilla de valores para el cursor.
# kind: cómo se obtiene la variable a partir de los parámetros GRIB del DWD.
VARIABLES = [
    {"id": "temperature_2m", "vmin": -40, "vmax": 55, "group": "Superficie", "label": "Temperatura 2 m", "unit": "°C", "min": -10, "max": 40,
     "colors": ["#3b4cc0", "#6fa8dc", "#f6f6c0", "#f4a259", "#b40426"], "kind": "temp", "params": ["T_2M"]},
    {"id": "wind_speed_10m", "vmin": 0, "vmax": 250, "group": "Superficie", "label": "Viento 10 m", "unit": "km/h", "min": 0, "max": 90,
     "colors": ["#ffffcc", "#a1dab4", "#41b6c4", "#2c7fb8", "#253494"], "kind": "wind", "params": ["U_10M", "V_10M"]},
    {"id": "wind_gusts_10m", "vmin": 0, "vmax": 300, "group": "Superficie", "label": "Rachas", "unit": "km/h", "min": 0, "max": 120,
     "colors": ["#ffffcc", "#fed976", "#fd8d3c", "#e31a1c", "#800026"], "kind": "gust", "params": ["VMAX_10M"]},
    {"id": "pressure_msl", "vmin": 900, "vmax": 1100, "group": "Superficie", "label": "Presión", "unit": "hPa", "min": 990, "max": 1040,
     "colors": ["#762a83", "#e7d4e8", "#f7f7f7", "#d9f0d3", "#1b7837"], "kind": "pressure", "params": ["PMSL"]},
    {"id": "precipitation", "vmin": 0, "vmax": 200, "group": "Agua", "label": "Precipitación", "unit": "mm/h", "min": 0, "max": 10,
     "colors": ["#ffffff", "#a6d8f0", "#3f8fd2", "#6a3d9a", "#d1005f"], "kind": "precip", "params": ["TOT_PREC"]},
    {"id": "cloud_cover", "vmin": 0, "vmax": 100, "group": "Agua", "label": "Nubosidad", "unit": "%", "min": 0, "max": 100,
     "colors": ["#fdfdfd", "#c8c8c8", "#6e6e6e"], "kind": "cloud", "params": ["CLCT"]},
]
