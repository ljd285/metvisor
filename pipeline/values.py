"""Rejilla de valores para el cursor: un PNG RGB por variable con todos los pasos apilados.

Cada píxel guarda el valor en 16 bit (R = byte alto, G = byte bajo) entre vmin y vmax; B = 255 marca «sin dato».
La rejilla es la nativa de ICON-EU recortada al dominio (no la de Mercator), así que no hay pérdida por reproyección.
"""
import numpy as np
from PIL import Image


def encode_stack(frames, ny, nx, vmin, vmax):
    """frames: lista de arrays (ny, nx) o None. Devuelve una imagen PIL de (len*ny) filas."""
    out = np.zeros((len(frames) * ny, nx, 3), dtype=np.uint8)
    for k, a in enumerate(frames):
        block = out[k * ny:(k + 1) * ny]
        if a is None:
            block[..., 2] = 255
            continue
        bad = ~np.isfinite(a)
        q = np.clip(np.round((np.nan_to_num(a, nan=vmin) - vmin) / (vmax - vmin) * 65534), 0, 65534).astype(np.uint16)
        block[..., 0] = q >> 8
        block[..., 1] = q & 255
        block[..., 2] = np.where(bad, 255, 0)
    return Image.fromarray(out, mode="RGB")


def decode_cell(rgb, vmin, vmax):
    """Inversa para una celda (r, g, b): valor o None. La misma fórmula que usa la web."""
    r, g, b = (int(x) for x in rgb)
    if b == 255:
        return None
    return vmin + (r * 256 + g) / 65534 * (vmax - vmin)
