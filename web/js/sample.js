// Generador de campos sintéticos. Sustituye al pipeline hasta la Fase 2:
// devuelve la misma interfaz que tendrá la carga de imágenes reales.
(function () {
  function hexRgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function ramp(colors, t) {
    var x = Math.min(1, Math.max(0, t)) * (colors.length - 1);
    var i = Math.min(colors.length - 2, Math.floor(x)), f = x - i;
    var a = hexRgb(colors[i]), b = hexRgb(colors[i + 1]);
    return a.map(function (v, k) { return Math.round(v + (b[k] - v) * f); });
  }

  // Valor normalizado 0..1 en (x,y) ∈ [0,1]² (y=0 norte) y hora h desde la pasada.
  function field(id, h, x, y) {
    var drift = h * 0.012;
    var wave = Math.sin((x - drift) * 7 + y * 3) * Math.cos((y + drift * .6) * 6 - x * 2);
    var blob = Math.exp(-(Math.pow(x - (0.25 + drift), 2) + Math.pow(y - 0.3, 2)) * 14);
    var diurnal = Math.sin((h % 24 - 8) / 24 * 2 * Math.PI);
    switch (id) {
      case 'temperature_2m': return 0.55 + 0.2 * y + 0.08 * diurnal + 0.07 * wave - 0.12 * blob;
      case 'wind_speed_10m': return 0.2 + 0.35 * blob + 0.12 * Math.abs(wave);
      case 'wind_gusts_10m': return 0.25 + 0.4 * blob + 0.15 * Math.abs(wave);
      case 'pressure_msl':   return 0.5 + 0.25 * Math.sin((x - drift) * 4) * (1 - y * .4) - 0.2 * blob;
      case 'precipitation':  return Math.max(0, 0.9 * blob + 0.25 * wave - 0.1);
      case 'cloud_cover':    return Math.min(1, 0.35 + 0.8 * blob + 0.25 * wave);
      default: return 0.5;
    }
  }

  var W = 240, H = 190;
  function render(variable, hour) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d'), img = ctx.createImageData(W, H);
    for (var j = 0; j < H; j++) for (var i = 0; i < W; i++) {
      var rgb = ramp(variable.colors, field(variable.id, hour, i / (W - 1), j / (H - 1)));
      var o = (j * W + i) * 4;
      img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }

  var api = { field: field, ramp: ramp, render: render };
  if (typeof module !== 'undefined') module.exports = api; else window.Sample = api;
})();
