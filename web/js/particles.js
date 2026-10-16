// Viento animado: partículas que siguen el campo u/v (m/s) y dejan estela en un canvas sobre el mapa.
// getWind(lat, lng) → [u, v] en m/s, o null fuera del dominio / sin datos.
(function () {
  var MAX_AGE = 90;        // fotogramas de vida de una partícula
  var PX_PER_MS = 0.15;    // píxeles por fotograma por cada m/s (10 m/s ≈ 1,5 px/fotograma)

  function create(canvas, map, getWind) {
    var ctx = canvas.getContext('2d');
    var parts = [], running = false, raf = 0, w = 0, h = 0;

    function spawn(p) {
      p.x = Math.random() * w; p.y = Math.random() * h;
      p.age = Math.floor(Math.random() * MAX_AGE);
      return p;
    }
    function resize(width, height) {
      w = canvas.width = Math.max(1, Math.floor(width));
      h = canvas.height = Math.max(1, Math.floor(height));
      var n = Math.min(4500, Math.round(w * h / 450));
      parts = [];
      for (var i = 0; i < n; i++) parts.push(spawn({}));
    }
    function clear() { ctx.clearRect(0, 0, w, h); }

    function frame() {
      if (!running) return;
      ctx.globalCompositeOperation = 'destination-out';   // desvanece las estelas anteriores
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(14,30,46,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        var ll = map.unproject([p.x, p.y]);
        var wind = getWind(ll.lat, ll.lng);
        if (!wind || p.age++ > MAX_AGE) { spawn(p); p.age = 0; continue; }
        var nx = p.x + wind[0] * PX_PER_MS, ny = p.y - wind[1] * PX_PER_MS;   // v>0 es hacia el norte (y decrece)
        if (nx < 0 || nx > w || ny < 0 || ny > h) { spawn(p); p.age = 0; continue; }
        ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny);
        p.x = nx; p.y = ny;
      }
      ctx.stroke();
      raf = requestAnimationFrame(frame);
    }

    return {
      resize: resize, clear: clear,
      start: function () { if (!running) { running = true; raf = requestAnimationFrame(frame); } },
      stop: function () { running = false; cancelAnimationFrame(raf); clear(); },
      get running() { return running; },
    };
  }

  var api = { create: create };
  if (typeof module !== 'undefined') module.exports = api; else window.Particles = api;
})();
