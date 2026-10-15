"""Genera web/data: un PNG por variable y hora más manifest.json.

Uso:  python -m pipeline.build --out web/data [--run YYYYMMDDHH] [--local DIR] [--max-step N]
"""
import argparse
import json
import shutil
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from . import config, dwd, grib, render


def load_param(source, param, steps, workers):
    """Descarga, decodifica y recorta cada paso. Devuelve {paso: Field|None}."""
    b = config.BOUNDS

    def one(step):
        raw = source.fetch(step, param)
        if raw is None:
            return step, None
        return step, grib.crop(grib.decode(raw), b["west"], b["south"], b["east"], b["north"])

    with ThreadPoolExecutor(workers) as ex:
        return dict(ex.map(one, steps))


def derive(spec, fields, steps):
    """Devuelve {paso: Field|None} ya en las unidades finales de la variable."""
    kind = spec["kind"]

    def mapped(src, fn):
        out = {}
        for s in steps:
            f = src.get(s)
            out[s] = None if f is None else grib.Field(fn(f.data), f.lat0, f.lon0, f.dlat, f.dlon)
        return out

    if kind == "temp":
        return mapped(fields["T_2M"], lambda d: d - 273.15)
    if kind == "pressure":
        return mapped(fields["PMSL"], lambda d: d / 100.0)
    if kind == "cloud":
        return mapped(fields["CLCT"], lambda d: d)
    if kind == "gust":
        return mapped(fields["VMAX_10M"], lambda d: d * 3.6)
    if kind == "wind":
        u, v = fields["U_10M"], fields["V_10M"]
        out = {}
        for s in steps:
            fu, fv = u.get(s), v.get(s)
            out[s] = None if fu is None or fv is None else grib.Field(
                np.hypot(fu.data, fv.data) * 3.6, fu.lat0, fu.lon0, fu.dlat, fu.dlon)
        return out
    if kind == "precip":  # TOT_PREC es acumulada desde el inicio de la pasada → tasa mm/h
        acc, out, prev = fields["TOT_PREC"], {}, None
        for s in steps:
            f = acc.get(s)
            if f is None:
                out[s] = None
                continue
            if prev is None:
                rate = np.zeros_like(f.data) if s == 0 else f.data / s
            else:
                rate = (f.data - acc[prev].data) / (s - prev)
            out[s] = grib.Field(np.clip(rate, 0, None), f.lat0, f.lon0, f.dlat, f.dlon)
            prev = s
        return out
    raise ValueError(f"Variable desconocida: {kind}")


def build(source, out_dir: Path, steps, workers=6):
    out_dir = Path(out_dir)
    tmp = out_dir.with_name(out_dir.name + ".tmp")
    shutil.rmtree(tmp, ignore_errors=True)
    (tmp / "frames").mkdir(parents=True)

    params = sorted({p for v in config.VARIABLES for p in v["params"]})
    fields = {}
    for p in params:
        print(f"Descargando {p} ({len(steps)} pasos)…", flush=True)
        fields[p] = load_param(source, p, steps, workers)

    manifest_vars, image_bounds, size = [], None, None
    for spec in config.VARIABLES:
        derived = derive(spec, fields, steps)
        avail = [s for s in steps if derived[s] is not None]
        if not avail:
            print(f"AVISO: sin datos para {spec['id']}; se omite", file=sys.stderr)
            continue
        vdir = tmp / "frames" / spec["id"]
        vdir.mkdir()
        for s in steps:
            # Pasos ausentes al inicio (p. ej. rachas en +0 h): se usa el primer paso disponible.
            f = derived[s] or derived[avail[0]]
            if derived[s] is None and s > avail[0]:
                continue
            arr, image_bounds = render.to_mercator(f, config.SCALE)
            size = arr.shape
            render.to_png(arr, spec, vdir / f"{s:03d}.png")
        manifest_vars.append({k: spec[k] for k in ("id", "group", "label", "unit", "min", "max", "colors")})
        print(f"  {spec['id']}: {len(avail)}/{len(steps)} pasos", flush=True)

    if not manifest_vars:
        raise RuntimeError("No se generó ninguna variable")
    run = source.run
    manifest = {
        "sample": False,
        "model": config.MODEL,
        "provider": config.PROVIDER,
        "run": run,
        "runTime": datetime.strptime(run, "%Y%m%d%H").replace(tzinfo=timezone.utc).isoformat(),
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "bounds": image_bounds,
        "imageSize": {"width": size[1], "height": size[0]},
        "steps": steps,
        "variables": manifest_vars,
    }
    (tmp / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    shutil.rmtree(out_dir, ignore_errors=True)
    tmp.rename(out_dir)
    return manifest


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="web/data")
    ap.add_argument("--run", help="Pasada YYYYMMDDHH (por defecto, la última completa)")
    ap.add_argument("--local", help="Directorio con ficheros GRIB (en lugar de descargar)")
    ap.add_argument("--max-step", type=int, help="Limitar pasos (pruebas)")
    ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args(argv)

    steps = [s for s in config.STEPS if a.max_step is None or s <= a.max_step]
    run = a.run or dwd.latest_complete_run()
    source = dwd.LocalSource(run, a.local) if a.local else dwd.HttpSource(run)
    print(f"Pasada {run}", flush=True)
    m = build(source, Path(a.out), steps, a.workers)
    print(f"Listo: {len(m['variables'])} variables en {a.out}")


if __name__ == "__main__":
    main()
