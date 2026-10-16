// Meteograma de un punto: temperatura, precipitación y viento (Open-Meteo, mismo modelo ICON-EU).
(function () {
  var VARS = ['temperature_2m', 'precipitation', 'wind_speed_10m', 'wind_gusts_10m'];

  function url(lat, lon) {
    var q = new URLSearchParams({
      latitude: lat.toFixed(3), longitude: lon.toFixed(3), hourly: VARS.join(','),
      models: 'icon_eu', forecast_days: 5, timezone: 'UTC', wind_speed_unit: 'kmh',
    });
    return 'https://api.open-meteo.com/v1/dwd-icon?' + q;
  }

  function fetchPoint(lat, lon) {
    return fetch(url(lat, lon)).then(function (r) {
      if (!r.ok) throw new Error('Open-Meteo ' + r.status);
      return r.json();
    }).then(function (j) {
      var h = j.hourly, out = { times: h.time.map(function (t) { return Date.parse(t + 'Z'); }) };
      VARS.forEach(function (k) { out[k] = h[k]; });
      return out;
    });
  }

  function minmax(arr, floor, pad) {
    var lo = Infinity, hi = -Infinity;
    arr.forEach(function (v) { if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    lo = floor != null ? Math.min(floor, lo) : lo - pad; hi = hi + pad;
    if (hi - lo < 1e-6) hi = lo + 1;
    return [lo, hi];
  }

  // Devuelve una cadena SVG. nowMs = instante seleccionado en el visor (línea vertical).
  function render(d, nowMs) {
    var W = 360, H = 262, L = 34, R = 8, T = 6;
    var n = d.times.length, t0 = d.times[0], t1 = d.times[n - 1];
    var X = function (t) { return L + (t - t0) / (t1 - t0) * (W - L - R); };
    var panels = [{ y: T, h: 78 }, { y: T + 88, h: 44 }, { y: T + 142, h: 78 }];
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Meteograma">';

    // Rejilla de días (medianoche UTC) y etiquetas
    var day = new Date(t0); day.setUTCHours(0, 0, 0, 0);
    var names = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    for (var t = day.getTime(); t < t1; t += 864e5) {
      var x = X(t).toFixed(1);
      if (t > t0) svg += '<line x1="' + x + '" x2="' + x + '" y1="' + T + '" y2="' + (T + 220) + '" class="mg-day"/>';
      svg += '<text x="' + (Math.max(X(t), L) + 3).toFixed(1) + '" y="' + (H - 18) + '" class="mg-txt">' + names[new Date(t).getUTCDay()] + ' ' + new Date(t).getUTCDate() + '</text>';
    }

    function line(vals, p, sc, cls, extra) {
      var pts = [];
      vals.forEach(function (v, i) {
        if (v == null) return;
        pts.push(X(d.times[i]).toFixed(1) + ',' + (p.y + p.h - (v - sc[0]) / (sc[1] - sc[0]) * p.h).toFixed(1));
      });
      return pts.length ? '<polyline points="' + pts.join(' ') + '" class="' + cls + '"' + (extra || '') + '/>' : '';
    }
    function axis(p, sc, unit) {
      return '<text x="' + (L - 4) + '" y="' + (p.y + 8) + '" class="mg-txt" text-anchor="end">' + Math.round(sc[1]) + '</text>' +
        '<text x="' + (L - 4) + '" y="' + (p.y + p.h) + '" class="mg-txt" text-anchor="end">' + Math.round(sc[0]) + '</text>' +
        '<text x="' + (L + 2) + '" y="' + (p.y + 8) + '" class="mg-unit">' + unit + '</text>' +
        '<rect x="' + L + '" y="' + p.y + '" width="' + (W - L - R) + '" height="' + p.h + '" class="mg-frame"/>';
    }

    // 1) Temperatura
    var sT = minmax(d.temperature_2m, null, 2);
    svg += axis(panels[0], sT, '°C') + line(d.temperature_2m, panels[0], sT, 'mg-temp');
    if (sT[0] < 0 && sT[1] > 0) {
      var y0 = panels[0].y + panels[0].h - (0 - sT[0]) / (sT[1] - sT[0]) * panels[0].h;
      svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y0.toFixed(1) + '" y2="' + y0.toFixed(1) + '" class="mg-zero"/>';
    }

    // 2) Precipitación (barras horarias)
    var sP = [0, Math.max(2, minmax(d.precipitation, 0, 0)[1])];
    svg += axis(panels[1], sP, 'mm/h');
    var bw = Math.max(1, (W - L - R) / n - 0.5);
    d.precipitation.forEach(function (v, i) {
      if (!v) return;
      var h = v / sP[1] * panels[1].h;
      svg += '<rect x="' + (X(d.times[i]) - bw / 2).toFixed(1) + '" y="' + (panels[1].y + panels[1].h - h).toFixed(1) +
        '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" class="mg-rain"/>';
    });

    // 3) Viento medio y rachas
    var sW = [0, Math.max(30, minmax(d.wind_gusts_10m, 0, 0)[1])];
    svg += axis(panels[2], sW, 'km/h') + line(d.wind_gusts_10m, panels[2], sW, 'mg-gust') + line(d.wind_speed_10m, panels[2], sW, 'mg-wind');

    // Instante seleccionado
    if (nowMs >= t0 && nowMs <= t1) {
      var xn = X(nowMs).toFixed(1);
      svg += '<line x1="' + xn + '" x2="' + xn + '" y1="' + T + '" y2="' + (T + 220) + '" class="mg-now"/>';
    }
    return svg + '</svg>';
  }

  // Convierte una coordenada x del SVG (0..width) en instante, para saltar a esa hora al pulsar.
  function timeAt(d, fraction) {
    var L = 34 / 360, R = 8 / 360;
    var f = Math.min(1, Math.max(0, (fraction - L) / (1 - L - R)));
    return d.times[0] + f * (d.times[d.times.length - 1] - d.times[0]);
  }

  var api = { url: url, fetchPoint: fetchPoint, render: render, timeAt: timeAt };
  if (typeof module !== 'undefined') module.exports = api; else window.Meteogram = api;
})();
