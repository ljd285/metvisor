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

from . import config, contours, dwd, grib, render, values


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


def _like(f, data):
    return grib.Field(data, f.lat0, f.lon0, f.dlat, f.dlon)


def derive(spec, fields, steps):
    """Devuelve {paso: Field|None} ya en las unidades finales de la variable."""
    kind, params = spec["kind"], spec["params"]
    if kind == "linear":
        scale, offset = spec.get("scale", 1), spec.get("offset", 0)
        return {s: None if fields[params[0]].get(s) is None else _like(fields[params[0]][s], fields[params[0]][s].data * scale + offset)
                for s in steps}
    if kind == "wind":
        u, v = fields["U_10M"], fields["V_10M"]
        return {s: None if u.get(s) is None or v.get(s) is None else _like(u[s], np.hypot(u[s].data, v[s].data) * 3.6)
                for s in steps}
    if kind == "accum":  # acumulada desde el inicio de la pasada (suma de params) → tasa por hora
        out, prev, acc = {}, None, {}
        for s in steps:
            fs = [fields[p].get(s) for p in params]
            acc[s] = None if any(f is None for f in fs) else _like(fs[0], sum(f.data for f in fs))
        for s in steps:
            f = acc[s]
            if f is None:
                out[s] = None
                continue
            if prev is None:
                rate = np.zeros_like(f.data) if s == 0 else f.data / s
            else:
                rate = (f.data - acc[prev].data) / (s - prev)
            out[s] = _like(f, np.clip(rate, 0, None))
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

    manifest_vars, hidden_vars, image_bounds, size, grid, pressure = [], {}, None, None, None, None
    (tmp / "values").mkdir()
    for spec in config.VARIABLES:
        derived = derive(spec, fields, steps)
        avail = [s for s in steps if derived[s] is not None]
        if not avail:
            print(f"AVISO: sin datos para {spec['id']}; se omite", file=sys.stderr)
            continue
        hidden = spec.get("hidden", False)
        vdir = tmp / "frames" / spec["id"]
        if not hidden:
            vdir.mkdir()
        value_frames = []
        for s in steps:
            f = derived[s]
            if f is None and s < avail[0]:
                # Pasos ausentes al inicio (p. ej. rachas en +0 h): se usa el primer paso disponible.
                f = derived[avail[0]]
            if f is None:
                value_frames.append(None)
                continue
            if not hidden:
                arr, image_bounds = render.to_mercator(f, config.SCALE)
                size = arr.shape
                render.to_png(arr, spec, vdir / f"{s:03d}.png")
            value_frames.append(f.data)
            if grid is None:
                ny, nx = f.data.shape
                grid = {"nx": nx, "ny": ny, "lat0": f.lat0, "lon0": f.lon0, "dlat": f.dlat, "dlon": f.dlon}
        ny, nx = grid["ny"], grid["nx"]
        values.encode_stack(value_frames, ny, nx, spec["vmin"], spec["vmax"]).save(
            tmp / "values" / f"{spec['id']}.png", optimize=True)
        if spec["id"] == "pressure_msl":
            pressure = derived
        if hidden:
            hidden_vars[spec["id"]] = {"id": spec["id"], "vmin": spec["vmin"], "vmax": spec["vmax"]}
            continue
        manifest_vars.append({k: spec[k] for k in ("id", "group", "label", "unit", "min", "max", "colors", "vmin", "vmax")}
                             | ({"hide_below": spec["hide_below"]} if "hide_below" in spec else {}))
        print(f"  {spec['id']}: {len(avail)}/{len(steps)} pasos", flush=True)

    if not manifest_vars:
        raise RuntimeError("No se generó ninguna variable")
    isobars = None
    if pressure:
        (tmp / "isobars").mkdir()
        for s in steps:
            if pressure.get(s) is not None:
                gj = contours.isobars(pressure[s], config.ISOBAR_INTERVAL, config.ISOBAR_STRIDE)
                (tmp / "isobars" / f"{s:03d}.json").write_text(json.dumps(gj, separators=(",", ":")))
        isobars = {"interval": config.ISOBAR_INTERVAL}
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
        "grid": grid,
        "isobars": isobars,
        "wind": ({"u": hidden_vars["wind_u_10m"], "v": hidden_vars["wind_v_10m"]}
                 if {"wind_u_10m", "wind_v_10m"} <= hidden_vars.keys() else None),
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
