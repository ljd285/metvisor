// Lectura de la rejilla de valores del pipeline (data/values/<variable>.png).
// Cada píxel: R,G = valor 16 bit entre vmin y vmax; B = 255 → sin dato. Los pasos van apilados en vertical.
(function () {
  // Interpolación bilineal en (lat, lon) para el paso stepIdx. px = RGBA de la imagen, w = ancho.
  function sample(px, w, g, v, stepIdx, lat, lon) {
    var fx = (lon - g.lon0) / g.dlon, fy = (g.lat0 - lat) / g.dlat;
    if (!(fx >= 0 && fy >= 0 && fx <= g.nx - 1 && fy <= g.ny - 1)) return null;
    var x0 = Math.min(Math.floor(fx), g.nx - 2), y0 = Math.min(Math.floor(fy), g.ny - 2);
    var tx = fx - x0, ty = fy - y0;
    function at(x, y) {
      var o = ((stepIdx * g.ny + y) * w + x) * 4;
      if (px[o + 2] === 255) return NaN;
      return v.vmin + (px[o] * 256 + px[o + 1]) / 65534 * (v.vmax - v.vmin);
    }
    var a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    var r = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    return isNaN(r) ? null : r;
  }

  // Carga la imagen y devuelve {px, w, h}. Se pide una vez por variable y se guarda en caché.
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
