"""Isolíneas por marching squares → GeoJSON (MultiLineString por nivel)."""
import math
from collections import defaultdict, deque

import numpy as np

# Casos por bit tl=8, tr=4, br=2, bl=1 → pares de aristas (T, R, B, L). Los casos 5 y 10 son sillas.
_CASES = {
    1: [("L", "B")], 2: [("B", "R")], 3: [("L", "R")], 4: [("T", "R")], 6: [("T", "B")],
    7: [("L", "T")], 8: [("L", "T")], 9: [("T", "B")], 11: [("T", "R")], 12: [("L", "R")],
    13: [("B", "R")], 14: [("L", "B")],
}


def _edge(name, z, i, j, level):
    def t(a, b):
        return 0.5 if b == a else (level - a) / (b - a)
    if name == "T":
        return j + t(z[i, j], z[i, j + 1]), i
    if name == "R":
        return j + 1, i + t(z[i, j + 1], z[i + 1, j + 1])
    if name == "B":
        return j + t(z[i + 1, j], z[i + 1, j + 1]), i + 1
    return j, i + t(z[i, j], z[i + 1, j])  # L


def segments(z, level):
    """Lista de ((x0, y0), (x1, y1)) en coordenadas de índice (x = columna, y = fila)."""
    b = z >= level
    code = b[:-1, :-1] * 8 + b[:-1, 1:] * 4 + b[1:, 1:] * 2 + b[1:, :-1] * 1
    # Una celda con NaN en alguna esquina no produce segmentos.
    ok = np.isfinite(z[:-1, :-1] + z[:-1, 1:] + z[1:, 1:] + z[1:, :-1])
    out = []
    for i, j in zip(*np.nonzero(ok & (code > 0) & (code < 15))):
        c = int(code[i, j])
        if c in (5, 10):
            centre = (z[i, j] + z[i, j + 1] + z[i + 1, j + 1] + z[i + 1, j]) / 4 >= level
            if c == 5:
                pairs = [("L", "T"), ("B", "R")] if centre else [("T", "R"), ("L", "B")]
            else:
                pairs = [("T", "R"), ("L", "B")] if centre else [("L", "T"), ("B", "R")]
        else:
            pairs = _CASES[c]
        for a, e in pairs:
            out.append((_edge(a, z, i, j, level), _edge(e, z, i, j, level)))
    return out


def chains(segs):
    """Une segmentos que comparten extremo en polilíneas ([(x, y), …]). Un anillo cerrado repite el primer punto."""
    key = lambda p: (round(p[0], 5), round(p[1], 5))
    adj = defaultdict(list)
    for i, (a, b) in enumerate(segs):
        adj[key(a)].append(i)
        adj[key(b)].append(i)
    used = [False] * len(segs)
    out = []
    for i in range(len(segs)):
        if used[i]:
            continue
        used[i] = True
        line = deque(segs[i])
        for forward in (True, False):
            while True:
                end = line[-1] if forward else line[0]
                nxt = next((j for j in adj[key(end)] if not used[j]), None)
                if nxt is None:
                    break
                used[nxt] = True
                a, b = segs[nxt]
                other = b if key(a) == key(end) else a
                line.append(other) if forward else line.appendleft(other)
        out.append(list(line))
    return out


def _km(lat, dlon, dlat):
    return math.hypot(dlon * math.cos(math.radians(lat)) * 111.32, dlat * 110.57)


def _merc_y(lat):  # en grados, para medir ángulos tal y como se ven en el mapa
    return math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))


def _point_at(pts, cum, s):
    """Punto (lon, lat) a s km del inicio de la polilínea."""
    k = max(1, int(np.searchsorted(cum, s)))
    k = min(k, len(pts) - 1)
    span = cum[k] - cum[k - 1] or 1e-9
    t = (s - cum[k - 1]) / span
    return (pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t)


def label_points(pts, bounds, spacing_km=500, min_km=150, margin=0.6, tangent_km=25):
    """Posiciones de etiqueta a lo largo de una polilínea (lon, lat) con el ángulo del trazo en pantalla.

    Devuelve [(lon, lat, ángulo_grados)] con el ángulo en (-90, 90] para que el texto quede siempre legible.
    Se evitan los puntos a menos de `margin` grados del borde del dominio.
    """
    if len(pts) < 2:
        return []
    cum = [0.0]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        cum.append(cum[-1] + _km((y0 + y1) / 2, x1 - x0, y1 - y0))
    total = cum[-1]
    if total < min_km:
        return []
    n = max(1, int(total // spacing_km))
    west, south, east, north = bounds
    out = []
    for k in range(n):
        s = (k + 0.5) * total / n
        lon, lat = _point_at(pts, cum, s)
        if not (west + margin <= lon <= east - margin and south + margin <= lat <= north - margin):
            continue
        x0, y0 = _point_at(pts, cum, max(0.0, s - tangent_km))
        x1, y1 = _point_at(pts, cum, min(total, s + tangent_km))
        ang = math.degrees(math.atan2(-(_merc_y(y1) - _merc_y(y0)), x1 - x0))
        if ang > 90:
            ang -= 180
        elif ang <= -90:
            ang += 180
        out.append((round(lon, 3), round(lat, 3), round(ang, 1)))
    return out


def isobars(field, interval=4, stride=2):
    """GeoJSON: por nivel, una MultiLineString (p = hPa, major = múltiplo de 20) y puntos de etiqueta (a = ángulo)."""
    z = field.data[::stride, ::stride]
    dlon, dlat = field.dlon * stride, field.dlat * stride
    lo, hi = np.nanmin(z), np.nanmax(z)
    levels = range(int(np.ceil(lo / interval)) * interval, int(np.floor(hi / interval)) * interval + 1, interval)
    bounds = (field.lon0, field.lat0 - (z.shape[0] - 1) * dlat, field.lon0 + (z.shape[1] - 1) * dlon, field.lat0)
    lines, labels = [], []
    for level in levels:
        coords = []
        for chain in chains(segments(z, level)):
            pts = [(field.lon0 + x * dlon, field.lat0 - y * dlat) for x, y in chain]
            coords.append([[round(x, 3), round(y, 3)] for x, y in pts])
            for lon, lat, ang in label_points(pts, bounds):
                labels.append({"type": "Feature", "properties": {"p": level, "a": ang, "major": level % 20 == 0},
                               "geometry": {"type": "Point", "coordinates": [lon, lat]}})
        if coords:
            lines.append({"type": "Feature", "properties": {"p": level, "major": level % 20 == 0},
                          "geometry": {"type": "MultiLineString", "coordinates": coords}})
    return {"type": "FeatureCollection", "features": lines + labels}
