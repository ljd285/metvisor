// Lectura de la rejilla de valores del pipeline (data/values/<variable>/<paso>.webp), un fichero por paso.
// Cada píxel: R = 8 bits altos y G = 4 bits bajos (en el nibble alto) del valor en 12 bit entre vmin y vmax; B = 255 → sin dato.
(function () {
  var LEVELS = 4095;

  // Interpolación bilineal en (lat, lon). px = RGBA de la imagen, w = ancho, g = {nx, ny, lat0, lon0, dlat, dlon}.
  function sample(px, w, g, v, lat, lon) {
    var fx = (lon - g.lon0) / g.dlon, fy = (g.lat0 - lat) / g.dlat;
    if (!(fx >= 0 && fy >= 0 && fx <= g.nx - 1 && fy <= g.ny - 1)) return null;
    var x0 = Math.min(Math.floor(fx), g.nx - 2), y0 = Math.min(Math.floor(fy), g.ny - 2);
    var tx = fx - x0, ty = fy - y0;
    function at(x, y) {
      var o = (y * w + x) * 4;
      if (px[o + 2] === 255) return NaN;
      return v.vmin + ((px[o] << 4) | (px[o + 1] >> 4)) / LEVELS * (v.vmax - v.vmin);
    }
    // Una celda sin dato solo anula el resultado si interviene con peso (sobre una esquina exacta no cuenta).
    var sum = 0, corners = [[x0, y0, (1 - tx) * (1 - ty)], [x0 + 1, y0, tx * (1 - ty)], [x0, y0 + 1, (1 - tx) * ty], [x0 + 1, y0 + 1, tx * ty]];
    for (var i = 0; i < 4; i++) {
      if (corners[i][2] === 0) continue;
      var val = at(corners[i][0], corners[i][1]);
      if (isNaN(val)) return null;
      sum += val * corners[i][2];
    }
    return sum;
  }

  // Carga la imagen y devuelve {px, w, h}.
  function load(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        var ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        resolve({ px: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height });
      };
      img.onerror = function () { reject(new Error('No se pudo cargar ' + url)); };
      img.src = url;
    });
  }

  var api = { sample: sample, load: load };
  if (typeof module !== 'undefined') module.exports = api; else window.ValueGrid = api;
})();
