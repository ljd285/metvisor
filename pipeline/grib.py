"""Lectura de mensajes GRIB2 (rejilla regular lat-lon) y recorte al dominio."""
from dataclasses import dataclass

import numpy as np

try:
    import eccodes
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Falta eccodes: pip install -r pipeline/requirements.txt") from exc


@dataclass
class Field:
    """Campo con filas de norte a sur. lat0/lon0 son los centros de la celda [0, 0]."""
    data: np.ndarray
    lat0: float
    lon0: float
    dlat: float  # positivo; las latitudes disminuyen con el índice de fila
    dlon: float

    @property
    def lat_north_edge(self):
        return self.lat0 + self.dlat / 2

    @property
    def lat_south_edge(self):
        return self.lat0 - (self.data.shape[0] - 1) * self.dlat - self.dlat / 2

    @property
    def lon_west_edge(self):
        return self.lon0 - self.dlon / 2

    @property
    def lon_east_edge(self):
        return self.lon0 + (self.data.shape[1] - 1) * self.dlon + self.dlon / 2


def _norm_lon(lon):
    return lon - 360 if lon > 180 else lon


def decode(message: bytes) -> Field:
    h = eccodes.codes_new_from_message(message)
    try:
        if eccodes.codes_get(h, "gridType") != "regular_ll":
            raise ValueError("Se esperaba una rejilla regular_ll")
        ni, nj = eccodes.codes_get(h, "Ni"), eccodes.codes_get(h, "Nj")
        lat1 = eccodes.codes_get(h, "latitudeOfFirstGridPointInDegrees")
        lat2 = eccodes.codes_get(h, "latitudeOfLastGridPointInDegrees")
        lon1 = _norm_lon(eccodes.codes_get(h, "longitudeOfFirstGridPointInDegrees"))
        dlon = eccodes.codes_get(h, "iDirectionIncrementInDegrees")
        dlat = eccodes.codes_get(h, "jDirectionIncrementInDegrees")
        eccodes.codes_set(h, "missingValue", 1e30)
        vals = eccodes.codes_get_double_array(h, "values").reshape(nj, ni).astype(np.float64)
    finally:
        eccodes.codes_release(h)
    vals[vals >= 1e29] = np.nan
    if lat1 < lat2:  # la primera fila es la más al sur: voltear a norte→sur
        vals = vals[::-1]
        lat1 = lat2
    return Field(vals, lat1, lon1, abs(dlat), abs(dlon))


def crop(f: Field, west, south, east, north) -> Field:
    """Recorta a las celdas cuyos centros caen en el dominio (con una celda de margen)."""
    j0 = max(0, int(np.floor((west - f.lon0) / f.dlon)) - 1)
    j1 = min(f.data.shape[1], int(np.ceil((east - f.lon0) / f.dlon)) + 2)
    i0 = max(0, int(np.floor((f.lat0 - north) / f.dlat)) - 1)
    i1 = min(f.data.shape[0], int(np.ceil((f.lat0 - south) / f.dlat)) + 2)
    if i1 - i0 < 2 or j1 - j0 < 2:
        raise ValueError("El dominio queda fuera de la rejilla")
    return Field(f.data[i0:i1, j0:j1], f.lat0 - i0 * f.dlat, f.lon0 + j0 * f.dlon, f.dlat, f.dlon)
