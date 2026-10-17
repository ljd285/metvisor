"""Rejilla de valores para el cursor y el viento animado: un WebP sin pérdida por variable y paso.

Cada píxel guarda el valor en 12 bit entre vmin y vmax: R = 8 bits altos, G = 4 bits bajos en el nibble alto; B = 255 marca
«sin dato». La rejilla es la nativa de ICON-EU recortada al dominio (no la de Mercator), así que no hay pérdida por reproyección.
Se publica un fichero por paso para que el navegador solo descargue el que está viendo el usuario.
"""
import numpy as np
from PIL import Image

LEVELS = (1 << 12) - 1  # 4095 niveles


def encode_step(a, vmin, vmax):
    """Imagen PIL RGB (ny × nx) con el campo `a`, o None si `a` es None."""
    if a is None:
        return None
    bad = ~np.isfinite(a)
    q = np.clip(np.round((np.nan_to_num(a, nan=vmin) - vmin) / (vmax - vmin) * LEVELS), 0, LEVELS).astype(np.uint16)
    out = np.zeros(a.shape + (3,), dtype=np.uint8)
    out[..., 0] = q >> 4
    out[..., 1] = (q & 15) << 4
    out[..., 2] = np.where(bad, 255, 0)
    return Image.fromarray(out, mode="RGB")


def save_step(a, vmin, vmax, path):
    """Guarda el paso como WebP sin pérdida. Devuelve False si no hay datos (no se escribe nada)."""
    img = encode_step(a, vmin, vmax)
    if img is None:
        return False
    img.save(path, "WEBP", lossless=True, quality=100, method=4)
    return True


def decode_cell(rgb, vmin, vmax):
    """Inversa para una celda (r, g, b): valor o None. La misma fórmula que usa la web."""
    r, g, b = (int(x) for x in rgb)
    if b == 255:
        return None
    return vmin + ((r << 4) | (g >> 4)) / LEVELS * (vmax - vmin)
