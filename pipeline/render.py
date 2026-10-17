"""Reproyección a Web Mercator y coloreado a PNG paletizado."""
import math

import numpy as np
from PIL import Image

from .grib import Field

TRANSPARENT = 255  # índice de paleta reservado para datos ausentes


def _mercator_y(lat_deg):
    return math.log(math.tan(math.pi / 4 + math.radians(lat_deg) / 2))


def to_mercator(f: Field, scale: int):
    """Remuestrea el campo a una rejilla en Web Mercator (bilineal). Devuelve (array, bounds)."""
    ny, nx = f.data.shape
    west, east = f.lon_west_edge, f.lon_east_edge
    north, south = f.lat_north_edge, f.lat_south_edge
    w = nx * scale
    y_n, y_s = _mercator_y(north), _mercator_y(south)
    x_span = math.radians(east - west)
    h = max(2, round(w * (y_n - y_s) / x_span))

    # Columnas: lineales en longitud. Filas: lineales en y de Mercator.
    cols = (np.arange(w) + 0.5) / w
    lon = west + cols * (east - west)
    j = (lon - f.lon0) / f.dlon
    rows = (np.arange(h) + 0.5) / h
    y = y_n - rows * (y_n - y_s)
    lat = np.degrees(2 * np.arctan(np.exp(y)) - math.pi / 2)
    i = (f.lat0 - lat) / f.dlat

    i = np.clip(i, 0, ny - 1)
    j = np.clip(j, 0, nx - 1)
    i0 = np.minimum(np.floor(i).astype(int), ny - 2)
    j0 = np.minimum(np.floor(j).astype(int), nx - 2)
    ti = (i - i0)[:, None]
    tj = (j - j0)[None, :]
    d = f.data
    a = d[np.ix_(i0, j0)]
    b = d[np.ix_(i0, j0 + 1)]
    c = d[np.ix_(i0 + 1, j0)]
    e = d[np.ix_(i0 + 1, j0 + 1)]
    out = (a * (1 - tj) + b * tj) * (1 - ti) + (c * (1 - tj) + e * tj) * ti
    return out, {"west": west, "south": south, "east": east, "north": north}


def _hex(h):
    return [int(h[k:k + 2], 16) for k in (1, 3, 5)]


def palette(colors):
    """256 entradas: 0..254 es la rampa interpolada, 255 es transparente."""
    stops = np.array([_hex(c) for c in colors], dtype=float)
    t = np.linspace(0, 1, TRANSPARENT) * (len(stops) - 1)
    idx = np.minimum(np.floor(t).astype(int), len(stops) - 2)
    frac = (t - idx)[:, None]
    ramp = np.round(stops[idx] * (1 - frac) + stops[idx + 1] * frac).astype(np.uint8)
    return np.vstack([ramp, [[0, 0, 0]]])


def _indices(values: np.ndarray, spec: dict) -> np.ndarray:
    """Índice de paleta por píxel; NaN y valores por debajo de spec["hide_below"] → TRANSPARENT."""
    t = (values - spec["min"]) / (spec["max"] - spec["min"])
    idx = np.clip(np.round(np.nan_to_num(t) * (TRANSPARENT - 1)), 0, TRANSPARENT - 1).astype(np.uint8)
    idx[~np.isfinite(values)] = TRANSPARENT
    hide = spec.get("hide_below")
    if hide is not None:
        idx[values < hide] = TRANSPARENT
    return idx


def to_png(values: np.ndarray, spec: dict, path):
    """Escribe un PNG paletizado; NaN y valores por debajo de spec["hide_below"] → transparente."""
    idx = _indices(values, spec)
    img = Image.fromarray(idx, mode="P")
    img.putpalette(palette(spec["colors"]).astype(np.uint8).flatten().tolist())
    img.save(path, optimize=True, transparency=TRANSPARENT)


def to_webp(values: np.ndarray, spec: dict, path, lossy: bool = False, quality: int = 85):
    """Escribe un WebP RGBA. Con pérdida (`lossy`) es ~5 veces más ligero en campos suaves; sin pérdida conserva los
    bordes transparentes exactos. Bajo los píxeles transparentes se pone el color del umbral (el de sus vecinos
    visibles) para que la compresión no manche los bordes."""
    idx = _indices(values, spec)
    pal = palette(spec["colors"])
    hide = spec.get("hide_below")
    fill = 0 if hide is None else int(np.clip(round((hide - spec["min"]) / (spec["max"] - spec["min"]) * (TRANSPARENT - 1)), 0, TRANSPARENT - 1))
    rgb = pal[np.where(idx == TRANSPARENT, fill, idx)]
    rgba = np.dstack([rgb, np.where(idx == TRANSPARENT, 0, 255).astype(np.uint8)]).astype(np.uint8)
    img = Image.fromarray(rgba, mode="RGBA")
    if lossy:
        img.save(path, "WEBP", quality=quality, alpha_quality=100, method=4)
    else:
        img.save(path, "WEBP", lossless=True, quality=100, method=4)  # method 6 tarda ~30 veces más sin ahorrar apenas
