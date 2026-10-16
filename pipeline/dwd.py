"""Acceso a los ficheros ICON-EU (rejilla regular lat-lon) de opendata.dwd.de."""
import bz2
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import config


def _split(param: str):
    """«T_2M» → («T_2M», None); «T@850» → («T», 850)."""
    if "@" in param:
        name, level = param.split("@")
        return name, int(level)
    return param, None


def filename(run: str, step: int, param: str) -> str:
    name, level = _split(param)
    if level is None:
        return f"icon-eu_europe_regular-lat-lon_single-level_{run}_{step:03d}_{name}.grib2.bz2"
    return f"icon-eu_europe_regular-lat-lon_pressure-level_{run}_{step:03d}_{level}_{name}.grib2.bz2"


def url(run: str, step: int, param: str) -> str:
    name, _ = _split(param)
    return f"{config.BASE_URL}/{run[8:10]}/{name.lower()}/{filename(run, step, param)}"


class HttpSource:
    def __init__(self, run: str, retries: int = 3):
        self.run, self.retries = run, retries

    def fetch(self, step: int, param: str):
        """Bytes GRIB ya descomprimidos, o None si el fichero no existe (404)."""
        u = url(self.run, step, param)
        for attempt in range(self.retries):
            try:
                req = urllib.request.Request(u, headers={"User-Agent": "metvisor-pipeline"})
                with urllib.request.urlopen(req, timeout=60) as r:
                    return bz2.decompress(r.read())
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    return None
                err = e
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                err = e
            time.sleep(2 ** attempt)
        raise RuntimeError(f"No se pudo descargar {u}: {err}")


class LocalSource:
    """Lee ficheros con el mismo nombre que en el DWD desde un directorio (pruebas)."""
    def __init__(self, run: str, directory):
        self.run, self.dir = run, Path(directory)

    def fetch(self, step: int, param: str):
        p = self.dir / filename(self.run, step, param)
        if p.exists():
            return bz2.decompress(p.read_bytes())
        raw = p.with_suffix("")  # sin .bz2
        return raw.read_bytes() if raw.exists() else None


def candidate_runs(now=None, count=4):
    """Pasadas de 120 h más recientes primero, como YYYYMMDDHH."""
    now = now or datetime.now(timezone.utc)
    t = now.replace(minute=0, second=0, microsecond=0)
    t -= timedelta(hours=t.hour % 6)
    return [(t - timedelta(hours=6 * k)).strftime("%Y%m%d%H") for k in range(count)]


def latest_complete_run(exists=None, now=None):
    """Primera pasada cuyo último paso (+120 h) ya está publicado."""
    exists = exists or _head_ok
    for run in candidate_runs(now):
        if exists(url(run, config.STEPS[-1], "PMSL")):
            return run
    raise RuntimeError("No hay ninguna pasada ICON-EU completa disponible")


def _head_ok(u):
    try:
        req = urllib.request.Request(u, method="HEAD", headers={"User-Agent": "metvisor-pipeline"})
        with urllib.request.urlopen(req, timeout=30):
            return True
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False
        raise
