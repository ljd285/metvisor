// Etiquetas de las isobaras (hPa) dibujadas en un canvas sobre el mapa.
// No usa capas de texto de MapLibre porque estas exigen descargar tipos de letra de un servidor externo.
// features: puntos GeoJSON {properties: {p, a, major}} que el pipeline coloca sobre las líneas (a = ángulo en grados).
(function () {
  function create(canvas, map) {
    var ctx = canvas.getContext('2d');
    var labels = [], visible = false, w = 0, h = 0, dpr = 1, raf = 0;

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!visible || !labels.length) return;
      var size = map.getZoom() >= 7 ? 13 : 11;
      ctx.font = '600 ' + size + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      for (var i = 0; i < labels.length; i++) {
        var f = labels[i], c = f.geometry.coordinates, pt = map.project([c[0], c[1]]);
        if (pt.x < -30 || pt.y < -30 || pt.x > w + 30 || pt.y > h + 30) continue;
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(f.properties.a * Math.PI / 180);
        var text = String(f.properties.p);
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';   // borde claro: tapa la línea bajo el texto y se lee sobre cualquier color
        ctx.strokeText(text, 0, 0);
        ctx.fillStyle = f.properties.major ? '#0b1a29' : '#2c3b4a';
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; draw(); }); }

    map.on('move', schedule);
    return {
      resize: function (width, height) {
        dpr = window.devicePixelRatio || 1; w = width; h = height;
        canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
        schedule();
      },
      set: function (features) { labels = features || []; schedule(); },
      setVisible: function (v) { visible = !!v; schedule(); },
      redraw: schedule,
    };
  }

  var api = { create: create };
  if (typeof module !== 'undefined') module.exports = api; else window.IsoLabels = api;
})();
