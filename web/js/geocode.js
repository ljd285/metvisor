// Búsqueda de lugares con la API de geocodificación de Open-Meteo (gratuita, sin clave).
(function () {
  function url(q) {
    return 'https://geocoding-api.open-meteo.com/v1/search?' +
      new URLSearchParams({ name: q, count: 8, language: 'es', format: 'json' });
  }
  function search(q) {
    return fetch(url(q)).then(function (r) {
      if (!r.ok) throw new Error('Geocodificación ' + r.status);
      return r.json();
    }).then(function (j) { return j.results || []; });
  }
  // «Valencia · Comunidad Valenciana, ES»
  function label(r) {
    var area = [r.admin1, r.country_code].filter(Boolean).join(', ');
    return { name: r.name, detail: area };
  }
  var api = { url: url, search: search, label: label };
  if (typeof module !== 'undefined') module.exports = api; else window.Geocode = api;
})();
