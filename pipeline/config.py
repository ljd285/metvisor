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
SCALE = 2             # píxeles de salida por celda de la rejilla original
FRAME_QUALITY = 85    # calidad WebP de los fotogramas con pérdida (variables suaves)

# Parámetros del DWD: "T_2M" es de nivel único; "T@850" es de nivel de presión (variable@hPa).
#
# kind:
#   linear  valor = dato * scale + offset (por defecto 1 y 0)
#   wind    módulo de U_10M y V_10M en km/h
#   accum   acumulada desde el inicio de la pasada (suma de params) → tasa por hora
# vmin/vmax: rango de cuantización (16 bit) de la rejilla de valores para el cursor.
# hide_below: por debajo de este valor el píxel es transparente (el campo «no se ve»).
# lossy: fotogramas WebP con pérdida (campos suaves y sin transparencia); el resto, WebP sin pérdida.
# stride: submuestreo de la rejilla de valores (el viento animado no necesita la resolución completa).
# hidden: solo genera la rejilla de valores (sin imágenes ni entrada en el menú); la usa el viento animado.
TEMP = ["#3b4cc0", "#6fa8dc", "#f6f6c0", "#f4a259", "#b40426"]
WIND = ["#ffffcc", "#a1dab4", "#41b6c4", "#2c7fb8", "#253494"]

VARIABLES = [
    # --- Superficie ---
    {"id": "temperature_2m", "lossy": True, "group": "Superficie", "label": "Temperatura 2 m", "unit": "°C", "min": -10, "max": 40,
     "vmin": -40, "vmax": 55, "colors": TEMP, "kind": "linear", "offset": -273.15, "params": ["T_2M"]},
    {"id": "wind_speed_10m", "group": "Superficie", "label": "Viento 10 m", "unit": "km/h", "min": 0, "max": 90,
     "vmin": 0, "vmax": 250, "hide_below": 2, "colors": WIND, "kind": "wind", "params": ["U_10M", "V_10M"]},
    {"id": "wind_gusts_10m", "group": "Superficie", "label": "Rachas", "unit": "km/h", "min": 0, "max": 120,
     "vmin": 0, "vmax": 300, "hide_below": 2, "colors": ["#ffffcc", "#fed976", "#fd8d3c", "#e31a1c", "#800026"],
     "kind": "linear", "scale": 3.6, "params": ["VMAX_10M"]},
    {"id": "pressure_msl", "lossy": True, "group": "Superficie", "label": "Presión", "unit": "hPa", "min": 990, "max": 1040,
     "vmin": 900, "vmax": 1100, "colors": ["#762a83", "#e7d4e8", "#f7f7f7", "#d9f0d3", "#1b7837"],
     "kind": "linear", "scale": 0.01, "params": ["PMSL"]},
    {"id": "relative_humidity_2m", "lossy": True, "group": "Superficie", "label": "Humedad 2 m", "unit": "%", "min": 0, "max": 100,
     "vmin": 0, "vmax": 100, "colors": ["#8c510a", "#d8b365", "#f6e8c3", "#c7eae5", "#5ab4ac", "#01665e"],
     "kind": "linear", "params": ["RELHUM_2M"]},
    # --- Agua ---
    {"id": "precipitation", "group": "Agua", "label": "Precipitación", "unit": "mm/h", "min": 0, "max": 10,
     "vmin": 0, "vmax": 100, "hide_below": 0.1, "colors": ["#ffffff", "#a6d8f0", "#3f8fd2", "#6a3d9a", "#d1005f"],
     "kind": "accum", "params": ["TOT_PREC"]},
    {"id": "snowfall", "group": "Agua", "label": "Nieve (equiv. agua)", "unit": "mm/h", "min": 0, "max": 5,
     "vmin": 0, "vmax": 50, "hide_below": 0.05, "colors": ["#ffffff", "#bfe3ff", "#6aa9ff", "#7b5cff", "#d400ff"],
     "kind": "accum", "params": ["SNOW_GSP", "SNOW_CON"]},
    {"id": "cloud_cover", "group": "Agua", "label": "Nubosidad", "unit": "%", "min": 0, "max": 100,
     "vmin": 0, "vmax": 100, "hide_below": 5, "colors": ["#fdfdfd", "#c8c8c8", "#6e6e6e"],
     "kind": "linear", "params": ["CLCT"]},
    # --- Atmósfera ---
    {"id": "cape", "group": "Atmósfera", "label": "CAPE", "unit": "J/kg", "min": 0, "max": 2500,
     "vmin": 0, "vmax": 6000, "hide_below": 50, "colors": ["#ffffff", "#fff3a0", "#fdb147", "#e8452c", "#7a0b6b"],
     "kind": "linear", "params": ["CAPE_ML"]},
    {"id": "freezing_level", "lossy": True, "group": "Atmósfera", "label": "Isoterma 0 °C", "unit": "m", "min": 0, "max": 5000,
     "vmin": 0, "vmax": 8000, "colors": ["#4575b4", "#91bfdb", "#e0f3f8", "#fee090", "#fc8d59", "#d73027"],
     "kind": "linear", "params": ["HZEROCL"]},
    # --- Altura (niveles de presión) ---
    {"id": "temperature_850", "lossy": True, "group": "Altura", "label": "Temperatura 850 hPa", "unit": "°C", "min": -20, "max": 25,
     "vmin": -80, "vmax": 50, "colors": TEMP, "kind": "linear", "offset": -273.15, "params": ["T@850"]},
    {"id": "geopotential_500", "lossy": True, "group": "Altura", "label": "Geopotencial 500 hPa", "unit": "dam", "min": 500, "max": 600,
     "vmin": 400, "vmax": 650, "kind": "linear", "scale": 1 / 98.0665, "params": ["FI@500"],
     "colors": ["#762a83", "#9970ab", "#c2a5cf", "#e7d4e8", "#f7f7f7", "#d9f0d3", "#a6dba0", "#5aae61", "#1b7837"]},
    # --- Ocultas: componentes del viento para las partículas (m/s) ---
    {"id": "wind_u_10m", "hidden": True, "stride": 2, "vmin": -80, "vmax": 80, "kind": "linear", "params": ["U_10M"]},
    {"id": "wind_v_10m", "hidden": True, "stride": 2, "vmin": -80, "vmax": 80, "kind": "linear", "params": ["V_10M"]},
]
