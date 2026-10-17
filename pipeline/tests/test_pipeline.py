"""Pruebas con GRIB2 sintéticos (no necesitan red). Ejecutar: python -m unittest discover -s pipeline/tests -t ."""
import bz2
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import eccodes
from PIL import Image

from pipeline import build, contours, dwd, grib, render, values

RUN = "2026101506"
# Rejilla de prueba más grande que el dominio, como ICON-EU (0,0625°), pero con paso 0,25° para ir rápido.
LAT_N, LAT_S, LON_W, LON_E, D = 50.0, 30.0, -20.0, 10.0, 0.25
NI, NJ = int(round((LON_E - LON_W) / D)) + 1, int(round((LAT_N - LAT_S) / D)) + 1


def make_grib(values: np.ndarray, north_first=True) -> bytes:
    h = eccodes.codes_grib_new_from_samples("regular_ll_sfc_grib2")
    eccodes.codes_set(h, "Ni", NI)
    eccodes.codes_set(h, "Nj", NJ)
    first, last = (LAT_N, LAT_S) if north_first else (LAT_S, LAT_N)
    eccodes.codes_set(h, "latitudeOfFirstGridPointInDegrees", first)
    eccodes.codes_set(h, "latitudeOfLastGridPointInDegrees", last)
    eccodes.codes_set(h, "longitudeOfFirstGridPointInDegrees", LON_W % 360)  # el DWD usa 0..360
    eccodes.codes_set(h, "longitudeOfLastGridPointInDegrees", LON_E % 360)
    eccodes.codes_set(h, "iDirectionIncrementInDegrees", D)
    eccodes.codes_set(h, "jDirectionIncrementInDegrees", D)
    eccodes.codes_set(h, "jScansPositively", 0 if north_first else 1)
    eccodes.codes_set_values(h, values.flatten())
    msg = eccodes.codes_get_message(h)
    eccodes.codes_release(h)
    return msg


def lat_grid():
    return np.repeat(np.linspace(LAT_N, LAT_S, NJ)[:, None], NI, axis=1)


class GribTests(unittest.TestCase):
    def test_decode_roundtrip_and_flip(self):
        vals = lat_grid()  # el valor es la latitud
        for north_first in (True, False):
            data = vals if north_first else vals[::-1]
            f = grib.decode(make_grib(data, north_first))
            self.assertAlmostEqual(f.lat0, LAT_N, places=3)
            self.assertAlmostEqual(f.lon0, LON_W, places=3)  # 340 → -20
            np.testing.assert_allclose(f.data, vals, atol=1e-3)

    def test_crop_keeps_coordinates(self):
        f = grib.decode(make_grib(lat_grid()))
        c = grib.crop(f, -10.5, 35.0, 4.8, 44.5)
        self.assertLessEqual(c.lon_west_edge, -10.5)
        self.assertGreaterEqual(c.lon_east_edge, 4.8)
        self.assertGreaterEqual(c.lat_north_edge, 44.5)
        self.assertLessEqual(c.lat_south_edge, 35.0)
        self.assertAlmostEqual(c.data[0, 0], c.lat0, places=2)  # valor = latitud del centro

    def test_mercator_rows_hold_their_latitude(self):
        f = grib.crop(grib.decode(make_grib(lat_grid())), -10.5, 35.0, 4.8, 44.5)
        arr, b = render.to_mercator(f, 2)
        h = arr.shape[0]
        import math
        yn, ys = render._mercator_y(b["north"]), render._mercator_y(b["south"])
        for r in (5, h // 2, h - 6):
            y = yn - (r + 0.5) / h * (yn - ys)
            lat = math.degrees(2 * math.atan(math.exp(y)) - math.pi / 2)
            self.assertAlmostEqual(arr[r, 10], lat, places=2)

    def test_png_palette_and_transparency(self):
        spec = {"min": 0, "max": 10, "colors": ["#000000", "#ffffff"]}
        v = np.array([[0.0, 10.0], [5.0, np.nan]])
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "a.png"
            render.to_png(v, spec, p)
            im = Image.open(p).convert("RGBA")
        self.assertEqual(im.getpixel((0, 0)), (0, 0, 0, 255))
        self.assertEqual(im.getpixel((1, 0)), (255, 255, 255, 255))
        self.assertEqual(im.getpixel((1, 1))[3], 0)


class HideBelowTests(unittest.TestCase):
    def test_low_values_are_transparent(self):
        spec = {"min": 0, "max": 10, "colors": ["#000000", "#ffffff"], "hide_below": 1.0}
        v = np.array([[0.5, 1.0], [5.0, 0.0]])
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "a.png"
            render.to_png(v, spec, p)
            with Image.open(p) as im:
                im = im.convert("RGBA")
                alphas = [im.getpixel(xy)[3] for xy in ((0, 0), (1, 0), (0, 1), (1, 1))]
        self.assertEqual(alphas, [0, 255, 255, 0])  # 0.5 y 0.0 ocultos; 1.0 (= umbral) y 5.0 visibles


class ValuesTests(unittest.TestCase):
    def test_roundtrip_missing_and_clipping(self):
        a = np.array([[-12.34, 25.0], [np.nan, 99.0]])
        img = values.encode_stack([a, None], 2, 2, -40, 55)
        self.assertEqual(img.size, (2, 4))  # 2 pasos apilados
        px = np.asarray(img)
        v = lambda y, x: values.decode_cell(px[y, x], -40, 55)
        self.assertAlmostEqual(v(0, 0), -12.34, delta=0.002)
        self.assertAlmostEqual(v(0, 1), 25.0, delta=0.002)
        self.assertIsNone(v(1, 0))           # NaN
        self.assertAlmostEqual(v(1, 1), 55.0, delta=0.002)  # recortado al rango
        self.assertIsNone(v(2, 0))           # paso ausente


class ContourTests(unittest.TestCase):
    def test_circle_level_lies_on_circle(self):
        n = 61
        yy, xx = np.mgrid[0:n, 0:n]
        z = np.hypot(xx - 30, yy - 30)  # distancia al centro
        segs = contours.segments(z, 10.0)
        self.assertGreater(len(segs), 40)
        for (x0, y0), (x1, y1) in segs:
            self.assertAlmostEqual(np.hypot(x0 - 30, y0 - 30), 10.0, delta=0.15)
            self.assertAlmostEqual(np.hypot(x1 - 30, y1 - 30), 10.0, delta=0.15)

    def test_nan_cells_are_skipped_and_saddle_gives_two_segments(self):
        z = np.array([[0.0, 1.0], [1.0, 0.0]])  # silla
        self.assertEqual(len(contours.segments(z, 0.5)), 2)
        z[0, 0] = np.nan
        self.assertEqual(contours.segments(z, 0.5), [])

    def test_chains_join_segments_into_one_closed_ring(self):
        n = 61
        yy, xx = np.mgrid[0:n, 0:n]
        z = np.hypot(xx - 30, yy - 30)
        ch = contours.chains(contours.segments(z, 10.3))   # 10.3: evita pasar justo por vértices de la rejilla
        self.assertEqual(len(ch), 1)
        self.assertEqual(ch[0][0], ch[0][-1])      # anillo cerrado
        self.assertGreater(len(ch[0]), 40)

    def test_chains_keep_open_lines_separate(self):
        z = np.add.outer(np.arange(10.0), np.zeros(10))       # isolíneas horizontales
        ch = contours.chains(contours.segments(z, 4.5))
        self.assertEqual(len(ch), 1)
        self.assertNotEqual(ch[0][0], ch[0][-1])

    def test_labels_angles_and_margins(self):
        bounds = (-10.0, 35.0, 5.0, 45.0)
        horiz = [(lon, 40.0) for lon in np.linspace(-10, 5, 40)]       # isobara horizontal
        lbl = contours.label_points(horiz, bounds)
        self.assertGreaterEqual(len(lbl), 2)                           # ≈1300 km → 2 etiquetas a 500 km
        self.assertTrue(all(abs(a) < 0.5 for _, _, a in lbl))
        vert = [(0.0, lat) for lat in np.linspace(35, 45, 40)]          # isobara vertical: ángulo ±90 → 90
        self.assertTrue(all(abs(abs(a) - 90) < 0.5 for _, _, a in contours.label_points(vert, bounds)))
        # una diagonal ascendente hacia el NE se ve «subiendo» en pantalla: ángulo negativo (y crece hacia abajo)
        diag = [(-5 + t, 38 + t) for t in np.linspace(0, 8, 40)]
        self.assertTrue(all(-90 < a < 0 for _, _, a in contours.label_points(diag, bounds)))
        # sin etiquetas pegadas al borde del dominio ni en líneas cortas
        self.assertEqual(contours.label_points([(-9.9, 40.0), (-9.8, 40.0)], bounds), [])
        edge = [(lon, 35.2) for lon in np.linspace(-10, 5, 40)]
        self.assertEqual(contours.label_points(edge, bounds), [])

    def test_isobars_geojson(self):
        f = grib.Field(1000 + np.add.outer(np.arange(30) * 0.5, np.arange(40) * 0.3), 44.0, -10.0, 0.125, 0.125)
        gj = contours.isobars(f, interval=4, stride=2)
        levels = [ft["properties"]["p"] for ft in gj["features"] if ft["geometry"]["type"] == "MultiLineString"]
        self.assertEqual(levels, sorted(levels))
        self.assertTrue(all(p % 4 == 0 for p in levels))
        self.assertTrue(any(ft["properties"]["major"] for ft in gj["features"]))
        self.assertTrue(all(len(ln) >= 2 for ft in gj["features"][:len(levels)] for ln in ft["geometry"]["coordinates"]))
        lon, lat = gj["features"][0]["geometry"]["coordinates"][0][0]
        self.assertTrue(-10.5 < lon < -4 and 38 < lat < 44.5)
        pts = [ft for ft in gj["features"] if ft["geometry"]["type"] == "Point"]
        self.assertTrue(pts and all("a" in ft["properties"] and "p" in ft["properties"] for ft in pts))
        self.assertTrue(all(ft["geometry"]["type"] != "LineString" for ft in gj["features"]))


class BuildTests(unittest.TestCase):
    def test_full_build_from_local_files(self):
        steps = [0, 1, 2]
        with tempfile.TemporaryDirectory() as d:
            src_dir, out = Path(d) / "src", Path(d) / "out"
            src_dir.mkdir()
            rng = np.random.default_rng(0)
            base = lat_grid()
            content = {
                "T_2M": lambda s: 273.15 + 10 + base * 0.1,
                "U_10M": lambda s: np.full((NJ, NI), 3.0),
                "V_10M": lambda s: np.full((NJ, NI), 4.0),
                "PMSL": lambda s: np.full((NJ, NI), 101500.0),
                "CLCT": lambda s: np.full((NJ, NI), 50.0),
                "TOT_PREC": lambda s: np.full((NJ, NI), 2.0 * s),  # 2 mm/h constantes
                "VMAX_10M": lambda s: np.full((NJ, NI), 10.0),
                "RELHUM_2M": lambda s: np.full((NJ, NI), 60.0),
                "CAPE_ML": lambda s: np.full((NJ, NI), 500.0),
                "HZEROCL": lambda s: np.full((NJ, NI), 3000.0),
                "SNOW_GSP": lambda s: np.full((NJ, NI), 0.25 * s),
                "SNOW_CON": lambda s: np.full((NJ, NI), 0.25 * s),     # 0,5 mm/h en total
                "T@850": lambda s: np.full((NJ, NI), 273.15 + 5.0),
                "FI@500": lambda s: np.full((NJ, NI), 5500 * 9.80665),   # 5500 m → 550 dam
            }
            for param, fn in content.items():
                for s in steps:
                    if param == "VMAX_10M" and s == 0:
                        continue  # las rachas no existen en +0 h
                    (src_dir / dwd.filename(RUN, s, param)).write_bytes(bz2.compress(make_grib(fn(s))))
            m = build.build(dwd.LocalSource(RUN, src_dir), out, steps, workers=2)
            self.assertEqual({v["id"] for v in m["variables"]},
                             {"temperature_2m", "wind_speed_10m", "wind_gusts_10m", "pressure_msl", "precipitation", "cloud_cover",
                              "relative_humidity_2m", "cape", "freezing_level", "snowfall", "temperature_850", "geopotential_500"})
            # Componentes del viento: solo rejilla de valores (sin imágenes ni entrada de menú).
            self.assertFalse((out / "frames" / "wind_u_10m").exists())
            self.assertTrue((out / "values" / "wind_u_10m.png").exists())
            self.assertEqual(m["wind"]["u"], {"id": "wind_u_10m", "vmin": -80, "vmax": 80})
            man = json.loads((out / "manifest.json").read_text())
            self.assertEqual(man["run"], RUN)
            self.assertFalse(man["sample"])
            w, h = man["imageSize"]["width"], man["imageSize"]["height"]
            for v in man["variables"]:
                for s in steps:  # también rachas en +0 h (copia del primer paso disponible)
                    with Image.open(out / "frames" / v["id"] / f"{s:03d}.png") as im:
                        self.assertEqual(im.size, (w, h))
            self.assertEqual(man["grid"]["nx"] > 2 and man["grid"]["ny"] > 2, True)
            self.assertEqual(man["isobars"]["interval"], 4)
            for st in steps:
                self.assertTrue((out / "isobars" / f"{st:03d}.json").exists())
            with Image.open(out / "values" / "temperature_2m.png") as vi:
                self.assertEqual(vi.size, (man["grid"]["nx"], man["grid"]["ny"] * len(steps)))
                cell = vi.getpixel((man["grid"]["nx"] // 2, man["grid"]["ny"] // 2))  # paso 0
            t = values.decode_cell(cell, -40, 55)
            self.assertTrue(10 < t < 30, t)
            # Viento 3-4-5 → 5 m/s = 18 km/h; precipitación 2 mm/h.
            def mid_value(var, s):
                spec = next(x for x in man["variables"] if x["id"] == var)
                with Image.open(out / "frames" / var / f"{s:03d}.png") as px:
                    idx = px.getpixel((w // 2, h // 2))
                return spec["min"] + idx / 254 * (spec["max"] - spec["min"])
            self.assertAlmostEqual(mid_value("wind_speed_10m", 1), 18.0, delta=0.4)
            self.assertAlmostEqual(mid_value("precipitation", 2), 2.0, delta=0.05)
            self.assertAlmostEqual(mid_value("pressure_msl", 1), 1015.0, delta=0.2)
            self.assertAlmostEqual(mid_value("snowfall", 2), 0.5, delta=0.05)
            self.assertAlmostEqual(mid_value("temperature_850", 1), 5.0, delta=0.2)
            self.assertAlmostEqual(mid_value("geopotential_500", 1), 550.0, delta=0.5)
            self.assertAlmostEqual(mid_value("cape", 1), 500.0, delta=10)
            # Valores del cursor del viento (m/s): U=3, V=4.
            with Image.open(out / "values" / "wind_u_10m.png") as vi:
                g = man["grid"]
                self.assertAlmostEqual(values.decode_cell(vi.getpixel((g["nx"] // 2, g["ny"] // 2)), -80, 80), 3.0, delta=0.01)


class DwdTests(unittest.TestCase):
    def test_pressure_level_names(self):
        self.assertEqual(dwd.filename("2026101506", 6, "T@850"),
                         "icon-eu_europe_regular-lat-lon_pressure-level_2026101506_006_850_T.grib2.bz2")
        self.assertTrue(dwd.url("2026101506", 6, "FI@500").startswith("https://opendata.dwd.de/weather/nwp/icon-eu/grib/06/fi/"))

    def test_url_layout(self):
        self.assertEqual(
            dwd.url("2026101506", 78, "T_2M"),
            "https://opendata.dwd.de/weather/nwp/icon-eu/grib/06/t_2m/"
            "icon-eu_europe_regular-lat-lon_single-level_2026101506_078_T_2M.grib2.bz2")

    def test_candidate_runs_and_latest(self):
        from datetime import datetime, timezone
        runs = dwd.candidate_runs(datetime(2026, 10, 15, 16, 20, tzinfo=timezone.utc), 3)
        self.assertEqual(runs, ["2026101512", "2026101506", "2026101500"])
        # Solo la pasada 06 está completa
        self.assertEqual(dwd.latest_complete_run(lambda u: "_2026101506_" in u, datetime(2026, 10, 15, 16, 20, tzinfo=timezone.utc)), "2026101506")


if __name__ == "__main__":
    unittest.main()
