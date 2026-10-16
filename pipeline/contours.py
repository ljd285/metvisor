"""Isolíneas por marching squares → GeoJSON (MultiLineString por nivel)."""
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


def isobars(field, interval=4, stride=2):
    """GeoJSON con una MultiLineString por nivel (propiedades p = hPa, major = múltiplo de 20)."""
    z = field.data[::stride, ::stride]
    dlon, dlat = field.dlon * stride, field.dlat * stride
    lo, hi = np.nanmin(z), np.nanmax(z)
    levels = range(int(np.ceil(lo / interval)) * interval, int(np.floor(hi / interval)) * interval + 1, interval)
    feats = []
    for level in levels:
        lines = []
        for (x0, y0), (x1, y1) in segments(z, level):
            lines.append([[round(field.lon0 + x0 * dlon, 3), round(field.lat0 - y0 * dlat, 3)],
                          [round(field.lon0 + x1 * dlon, 3), round(field.lat0 - y1 * dlat, 3)]])
        if lines:
            feats.append({"type": "Feature", "properties": {"p": level, "major": level % 20 == 0},
                          "geometry": {"type": "MultiLineString", "coordinates": lines}})
    return {"type": "FeatureCollection", "features": feats}
