// Metvisor — Fase 0: mapa base centrado en la península ibérica.
(function () {
  // [oeste, sur, este, norte]: península + Baleares, con margen.
  var IBERIA = [-10.5, 35.0, 4.8, 44.5];

  var map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 19,
          attribution: '© OpenStreetMap · Datos meteorológicos: Deutscher Wetterdienst',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    bounds: IBERIA,
    maxBounds: [[-20, 28], [15, 52]],
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
})();
