// Metvisor — Fase 3: valor bajo el cursor, meteograma al pulsar, isobaras, regiones y URL compartible.
// Sin datos reales (manifest de muestra) siguen funcionando regiones, meteograma y URL.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var state = { v: 0, t: 0, timer: null, c: null, iso: true, relief: true, bg: 'esri', borders: true, wind: false };
  var manifest, map, source, runTime, ready = false;
  var DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  // [oeste, sur, este, norte]
  var REGIONS = [
    { id: 'iberia', label: 'Península', b: [-10.5, 35.0, 4.8, 44.5] },
    { id: 'noroeste', label: 'Galicia y Cantábrico', b: [-9.6, 41.4, -1.0, 44.3] },
    { id: 'noreste', label: 'Pirineos y Cataluña', b: [-2.0, 40.3, 4.4, 43.6] },
    { id: 'sur', label: 'Andalucía', b: [-7.7, 35.8, -0.8, 38.9] },
    { id: 'baleares', label: 'Baleares', b: [1.0, 38.4, 4.6, 40.3] },
  ];

  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function utc(ms) {
    var d = new Date(ms);
    return DAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' · ' + p2(d.getUTCHours()) + ':00 UTC';
  }
  function runLabel() { return p2(new Date(runTime).getUTCHours()) + ' UTC'; }
  function stepMs(i) { return runTime + manifest.steps[i] * 3600e3; }

  // ---------- URL: #var=…&t=…&c=lat,lon,zoom ----------
  function readHash() {
    var p = new URLSearchParams(location.hash.slice(1));
    var vi = manifest.variables.findIndex(function (x) { return x.id === p.get('var'); });
    if (vi >= 0) state.v = vi;
    var t = parseInt(p.get('t'), 10);
    if (t >= 0 && t < manifest.steps.length) state.t = t;
    var c = (p.get('c') || '').split(',').map(Number);
    if (c.length === 3 && c.every(isFinite)) state.c = c;
    if (p.get('iso') === '0') state.iso = false;
    if (p.get('rel') === '0') state.relief = false;
    if (p.get('bg') === 'osm') state.bg = 'osm';
    if (p.get('bor') === '0') state.borders = false;
    if (p.get('wind') === '1') state.wind = true;
  }
  function writeHash() {
    var h = '#var=' + manifest.variables[state.v].id + '&t=' + state.t;
    if (map) {
      var m = map.getCenter();
      h += '&c=' + m.lat.toFixed(3) + ',' + m.lng.toFixed(3) + ',' + map.getZoom().toFixed(2);
    }
    if (!state.iso) h += '&iso=0';
    if (!state.relief) h += '&rel=0';
    if (state.bg !== 'esri') h += '&bg=' + state.bg;
    if (!state.borders) h += '&bor=0';
    if (state.wind) h += '&wind=1';
    history.replaceState(null, '', h);
  }

  // ---------- Panel lateral ----------
  function buildSidebar() {
    var html = '', group = '';
    manifest.variables.forEach(function (v, i) {
      if (v.group !== group) { group = v.group; html += '<h3>' + group + '</h3>'; }
      html += '<button type="button" data-i="' + i + '">' + v.label + '</button>';
    });
    $('vars').innerHTML = html;
    $('vars').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.v = +b.dataset.i; closeMenu(); update();
    });
    $('regions').innerHTML = REGIONS.map(function (r) {
      return '<button type="button" data-r="' + r.id + '">' + r.label + '</button>';
    }).join('');
    $('regions').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var r = REGIONS.find(function (x) { return x.id === b.dataset.r; });
      map.fitBounds([[r.b[0], r.b[1]], [r.b[2], r.b[3]]], { padding: 24, duration: 600 });
      closeMenu();
    });
    $('modelPill').textContent = manifest.model + ' · ' + runLabel();
    showFreshness();
    $('isoRow').hidden = !manifest.isobars;
    $('isoToggle').checked = state.iso;
    $('isoToggle').addEventListener('change', function () { state.iso = this.checked; applyIso(); writeHash(); });
    $('bgSelect').value = state.bg;
    $('bgSelect').addEventListener('change', function () { state.bg = this.value; applyBg(); writeHash(); });
    $('borderToggle').checked = state.borders;
    $('borderToggle').addEventListener('change', function () { state.borders = this.checked; applyBorders(); writeHash(); });
    $('windRow').hidden = !manifest.wind;
    $('windToggle').checked = state.wind;
    $('windToggle').addEventListener('change', function () { state.wind = this.checked; applyWind(); writeHash(); });
    $('reliefToggle').checked = state.relief;
    $('reliefToggle').addEventListener('change', function () { state.relief = this.checked; applyRelief(); writeHash(); });
  }
  function closeMenu() { document.body.classList.remove('menu-open'); $('menuBtn').setAttribute('aria-expanded', 'false'); }

  // Antigüedad de la pasada: ICON-EU publica cada 6 h con ~4 h de retraso, así que hasta ~10 h es normal.
  function showFreshness() {
    var el = $('freshness');
    if (manifest.sample) { el.hidden = true; return; }
    var h = (Date.now() - runTime) / 3600e3;
    var txt = 'Pasada del ' + utc(runTime).replace(' · ', ' ') + ' · hace ' + (h < 1 ? 'menos de 1' : Math.round(h)) + ' h';
    el.className = 'fresh' + (h > 26 ? ' old' : h > 13 ? ' warn' : '');
    el.textContent = (h > 26 ? 'Datos antiguos: ' : '') + txt;
    el.hidden = false;
  }

  function buildDays() {
    var html = '', last = -1, n = manifest.steps.length - 1;
    manifest.steps.forEach(function (h, i) {
      var d = new Date(runTime + h * 3600e3), day = d.getUTCDate();
      if (day !== last) {
        last = day;
        html += '<span style="left:' + (i / n * 100) + '%">' + DAYS[d.getUTCDay()] + ' ' + day + '</span>';
      }
    });
    $('days').innerHTML = html;
  }

  // ---------- Fotogramas ----------
  var frames = {};
  function frame(v, i) {
    if (!manifest.sample) {
      return 'data/frames/' + v.id + '/' + String(manifest.steps[i]).padStart(3, '0') + '.png';
    }
    var k = v.id + ':' + i;
    return frames[k] || (frames[k] = Sample.render(v, manifest.steps[i]));
  }
  function preload(v) {
    if (manifest.sample) return;
    for (var d = 1; d <= 3; d++) {
      var i = state.t + d;
      if (i < manifest.steps.length) new Image().src = frame(v, i);
    }
  }
  function coords() {
    var b = manifest.bounds;
    return [[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south]];
  }

  // ---------- Valor bajo el cursor ----------
  var valueData = {};   // variable → {px, w, h}
  var loading = {};
  function ensureValues(v) {
    if (!manifest.grid || valueData[v.id] || loading[v.id]) return;
    loading[v.id] = true;
    ValueGrid.load('data/values/' + v.id + '.png').then(function (d) { valueData[v.id] = d; })
      .catch(function () { /* sin rejilla: no se muestra valor */ })
      .then(function () { loading[v.id] = false; });
  }
  function valueAt(lngLat) {
    var v = manifest.variables[state.v], d = valueData[v.id];
    if (!d) return null;
    return ValueGrid.sample(d.px, d.w, manifest.grid, v, state.t, lngLat.lat, lngLat.lng);
  }
  var DECIMALS = { '°C': 1, 'km/h': 1, 'hPa': 1, 'mm/h': 2, 'dam': 1 };
  function fmt(x, unit) {
    return x.toFixed(DECIMALS[unit] != null ? DECIMALS[unit] : 0) + ' ' + unit;
  }
  var raf = 0;
  function onMove(e) {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var el = $('cursor');
      var val = manifest.grid ? valueAt(e.lngLat) : null;
      if (val == null) { el.hidden = true; return; }
      el.textContent = fmt(val, manifest.variables[state.v].unit);
      el.style.left = e.point.x + 'px'; el.style.top = e.point.y + 'px';
      el.hidden = false;
    });
  }

  // ---------- Isobaras ----------
  var isoCache = {}, isoToken = 0;
  function applyIso() {
    if (!ready || !map.getLayer('isobars')) return;
    map.setLayoutProperty('isobars', 'visibility', state.iso ? 'visible' : 'none');
    if (!state.iso) return;
    var i = state.t, token = ++isoToken, name = String(manifest.steps[i]).padStart(3, '0');
    var get = isoCache[name] ? Promise.resolve(isoCache[name]) :
      fetch('data/isobars/' + name + '.json').then(function (r) { return r.json(); }).then(function (g) { return (isoCache[name] = g); });
    get.then(function (g) { if (token === isoToken) map.getSource('isobars').setData(g); }).catch(function () {});
  }

  // Dos fondos intercambiables: «esri» (gris claro + etiquetas aparte) y «osm» (etiquetas incluidas).
  function applyBg() {
    if (!ready) return;
    var esri = state.bg === 'esri';
    map.setLayoutProperty('base_esri', 'visibility', esri ? 'visible' : 'none');
    map.setLayoutProperty('labels', 'visibility', esri ? 'visible' : 'none');
    map.setLayoutProperty('base_osm', 'visibility', esri ? 'none' : 'visible');
  }
  function applyBorders() {
    if (!ready) return;
    ['coast', 'borders'].forEach(function (id) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', state.borders ? 'visible' : 'none');
    });
  }

  // ---------- Viento animado ----------
  var particles, windGrids = null, windLoading = false;
  function windAt(lat, lng) {
    var g = windGrids, wd = manifest.wind;
    if (!g) return null;
    var u = ValueGrid.sample(g.u.px, g.u.w, manifest.grid, wd.u, state.t, lat, lng);
    var v = ValueGrid.sample(g.v.px, g.v.w, manifest.grid, wd.v, state.t, lat, lng);
    return u == null || v == null ? null : [u, v];
  }
  function sizeWind() {
    if (particles) particles.resize($('stage').clientWidth, $('stage').clientHeight);
  }
  function applyWind() {
    if (!manifest.wind || !manifest.grid) return;
    if (!state.wind) { if (particles) particles.stop(); return; }
    if (!particles) { particles = Particles.create($('windCanvas'), map, windAt); sizeWind(); }
    if (windGrids) { particles.start(); return; }
    if (windLoading) return;
    windLoading = true;
    Promise.all([ValueGrid.load('data/values/' + manifest.wind.u.id + '.png'), ValueGrid.load('data/values/' + manifest.wind.v.id + '.png')])
      .then(function (r) { windGrids = { u: r[0], v: r[1] }; if (state.wind) particles.start(); })
      .catch(function () { state.wind = false; $('windToggle').checked = false; })
      .then(function () { windLoading = false; });
  }

  function applyRelief() {
    if (ready && map.getLayer('relief')) map.setLayoutProperty('relief', 'visibility', state.relief ? 'visible' : 'none');
  }

  // ---------- Meteograma ----------
  var marker, mgData, mgToken = 0;
  function drawMeteogram() {
    if (mgData) $('mgBody').innerHTML = Meteogram.render(mgData, stepMs(state.t));
  }
  function openMeteogram(lngLat, name) {
    var token = ++mgToken;
    if (!marker) {
      marker = new maplibregl.Marker({ color: '#ff9f5a', draggable: true });
      marker.on('dragend', function () { openMeteogram(marker.getLngLat()); });
    }
    marker.setLngLat(lngLat).addTo(map);
    var coords = lngLat.lat.toFixed(2) + '° N, ' + lngLat.lng.toFixed(2) + '°';
    $('mgTitle').textContent = name ? name + ' · ' + coords : coords;
    $('mgBody').textContent = 'Cargando…';
    mgData = null;
    $('meteo').hidden = false;
    Meteogram.fetchPoint(lngLat.lat, lngLat.lng).then(function (d) {
      if (token !== mgToken) return;
      mgData = d; drawMeteogram();
    }).catch(function (err) {
      if (token === mgToken) $('mgBody').textContent = 'No se pudo cargar el meteograma (' + err.message + ').';
    });
  }
  function closeMeteogram() {
    mgToken++; mgData = null; $('meteo').hidden = true;
    if (marker) marker.remove();
  }
  function onMeteogramClick(e) {
    var svg = e.target.closest('svg'); if (!svg || !mgData) return;
    var r = svg.getBoundingClientRect();
    var t = Meteogram.timeAt(mgData, (e.clientX - r.left) / r.width), best = 0, bd = Infinity;
    manifest.steps.forEach(function (_, i) { var d = Math.abs(stepMs(i) - t); if (d < bd) { bd = d; best = i; } });
    state.t = best; update();
  }

  // ---------- Buscador ----------
  var searchTimer, searchToken = 0, found = [], active = -1;
  function hideResults() { $('results').hidden = true; found = []; active = -1; }
  function showResults(list) {
    found = list; active = -1;
    var ul = $('results');
    ul.innerHTML = list.length ? list.map(function (r, i) {
      var l = Geocode.label(r);
      return '<li role="option" data-i="' + i + '">' + l.name + '<span>' + l.detail + '</span></li>';
    }).join('') : '<li class="none">Sin resultados</li>';
    ul.hidden = false;
  }
  function markActive() {
    Array.prototype.forEach.call($('results').querySelectorAll('li[data-i]'), function (li, i) { li.classList.toggle('on', i === active); });
  }
  function choose(i) {
    var r = found[i]; if (!r) return;
    hideResults(); $('search').value = r.name;
    map.flyTo({ center: [r.longitude, r.latitude], zoom: Math.max(map.getZoom(), 8), duration: 700 });
    openMeteogram({ lat: r.latitude, lng: r.longitude }, r.name);
  }
  function initSearch() {
    var input = $('search');
    input.addEventListener('input', function () {
      clearTimeout(searchTimer);
      var q = this.value.trim();
      if (q.length < 2) { searchToken++; hideResults(); return; }
      searchTimer = setTimeout(function () {
        var token = ++searchToken;
        Geocode.search(q).then(function (list) { if (token === searchToken) showResults(list); })
          .catch(function () { if (token === searchToken) showResults([]); });
      }, 300);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!found.length) return;
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + found.length) % found.length; markActive();
      } else if (e.key === 'Enter') { choose(active >= 0 ? active : 0); }
      else if (e.key === 'Escape') { hideResults(); input.blur(); }
      e.stopPropagation();
    });
    $('results').addEventListener('click', function (e) {
      var li = e.target.closest('li[data-i]'); if (li) choose(+li.dataset.i);
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('#searchBox')) hideResults(); });
  }

  // ---------- Actualización ----------
  function update() {
    var v = manifest.variables[state.v];
    Array.prototype.forEach.call($('vars').querySelectorAll('button'), function (b) {
      b.classList.toggle('on', +b.dataset.i === state.v);
    });
    $('slider').value = state.t;
    $('lead').textContent = '+' + manifest.steps[state.t] + ' h';
    $('timeChip').textContent = utc(stepMs(state.t));
    $('legendTitle').textContent = v.label + ' (' + v.unit + ')';
    $('legendBar').style.background = 'linear-gradient(90deg,' + v.colors.join(',') + ')';
    var mid = Math.round((v.min + v.max) / 2);
    $('legendTicks').innerHTML = '<span>' + v.min + '</span><span>' + mid + '</span><span>' + v.max + '</span>';
    if (source) source.updateImage({ url: frame(v, state.t), coordinates: coords() });
    preload(v); ensureValues(v); applyIso(); drawMeteogram();
    writeHash();
  }

  function togglePlay() {
    if (state.timer) {
      clearInterval(state.timer); state.timer = null;
      $('play').textContent = '▶'; $('play').setAttribute('aria-label', 'Reproducir');
      return;
    }
    $('play').textContent = '❚❚'; $('play').setAttribute('aria-label', 'Pausar');
    state.timer = setInterval(function () { state.t = (state.t + 1) % manifest.steps.length; update(); }, 500);
  }

  // ---------- Mapa ----------
  function initMap() {
    var b = manifest.bounds;
    var opts = {
      container: 'map',
      style: {
        version: 8,
        sources: {
          base_esri: { type: 'raster', tileSize: 256, maxzoom: 16,
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
            attribution: 'Tiles © Esri — Esri, DeLorme, NAVTEQ · © OpenStreetMap · Deutscher Wetterdienst · Open-Meteo' },
          labels: { type: 'raster', tileSize: 256, maxzoom: 16,
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}'] },
          base_osm: { type: 'raster', tileSize: 256, maxzoom: 19,
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attribution: '© OpenStreetMap' },
          dem: { type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 12,
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            attribution: 'Relieve: Terrain Tiles (Mapzen/AWS)' },
        },
        layers: [{ id: 'base_esri', type: 'raster', source: 'base_esri' },
          { id: 'base_osm', type: 'raster', source: 'base_osm', layout: { visibility: 'none' } }],
      },
      maxBounds: [[-20, 28], [15, 52]],
    };
    if (state.c) { opts.center = [state.c[1], state.c[0]]; opts.zoom = state.c[2]; }
    else opts.bounds = [REGIONS[0].b[0], REGIONS[0].b[1], REGIONS[0].b[2], REGIONS[0].b[3]];
    map = new maplibregl.Map(opts);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('moveend', writeHash);
    map.on('move', function () { if (particles && particles.running) particles.clear(); });
    window.addEventListener('resize', sizeWind);
    map.on('mousemove', onMove);
    map.on('mouseout', function () { $('cursor').hidden = true; });
    map.on('click', function (e) { openMeteogram(e.lngLat); });
    map.on('load', function () {
      var v = manifest.variables[state.v];
      map.addSource('field', { type: 'image', url: frame(v, state.t), coordinates: coords() });
      map.addLayer({ id: 'field', type: 'raster', source: 'field', paint: { 'raster-opacity': 0.8, 'raster-fade-duration': 0 } });
      source = map.getSource('field');
      // Orden (de abajo arriba): mapa base, campo, relieve, isobaras, etiquetas.
      map.addLayer({ id: 'relief', type: 'hillshade', source: 'dem',
        layout: { visibility: state.relief ? 'visible' : 'none' },
        paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': '#26323f', 'hillshade-highlight-color': '#ffffff',
          'hillshade-accent-color': '#3a4856', 'hillshade-illumination-direction': 315 } });
      // Costas y fronteras por encima del campo (y del relieve), por debajo de isobaras y etiquetas.
      map.addSource('coast', { type: 'geojson', data: 'geo/coast.json' });
      map.addLayer({ id: 'coast', type: 'line', source: 'coast',
        layout: { visibility: state.borders ? 'visible' : 'none', 'line-join': 'round' },
        paint: { 'line-color': '#2f3b47', 'line-opacity': 0.7, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.7, 8, 1.4] } });
      map.addSource('borders', { type: 'geojson', data: 'geo/borders.json' });
      map.addLayer({ id: 'borders', type: 'line', source: 'borders',
        layout: { visibility: state.borders ? 'visible' : 'none', 'line-join': 'round' },
        paint: { 'line-color': '#2f3b47', 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.9, 8, 1.8] } });
      if (manifest.isobars) {
        map.addSource('isobars', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'isobars', type: 'line', source: 'isobars',
          layout: { 'line-join': 'round' },
          paint: { 'line-color': '#14283a', 'line-opacity': 0.75, 'line-width': ['case', ['get', 'major'], 1.8, 0.8] } });
      }
      map.addLayer({ id: 'labels', type: 'raster', source: 'labels' });
      ready = true;
      applyBg();
      applyIso();
      sizeWind();
      applyWind();
    });
  }

  // ---------- Arranque ----------
  function loadManifest() {
    return fetch('data/manifest.json').then(function (r) {
      if (!r.ok) throw new Error('sin datos reales');
      return r.json();
    }).catch(function () { return fetch('manifest.json').then(function (r) { return r.json(); }); });
  }

  loadManifest().then(function (m) {
    manifest = m;
    runTime = m.runTime ? Date.parse(m.runTime) : Math.floor(Date.now() / 21600e3) * 21600e3;
    readHash();
    $('sampleBadge').hidden = !m.sample;
    $('slider').max = m.steps.length - 1;
    buildSidebar(); buildDays(); initMap(); update();
    $('slider').addEventListener('input', function () { state.t = +this.value; update(); });
    $('play').addEventListener('click', togglePlay);
    $('mgClose').addEventListener('click', closeMeteogram);
    initSearch();
    $('mgBody').addEventListener('click', onMeteogramClick);
    $('menuBtn').addEventListener('click', function () {
      var open = document.body.classList.toggle('menu-open'); this.setAttribute('aria-expanded', open);
    });
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === '/') { e.preventDefault(); $('search').focus(); }
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      if (e.key === 'ArrowRight') { state.t = Math.min(manifest.steps.length - 1, state.t + 1); update(); }
      if (e.key === 'ArrowLeft') { state.t = Math.max(0, state.t - 1); update(); }
      if (e.key === 'Escape') closeMeteogram();
    });
  }).catch(function (e) {
    document.body.insertAdjacentHTML('beforeend', '<p style="position:absolute;top:50%;left:20px;color:#b00">No se pudo cargar el visor: ' + e.message + '</p>');
  });
})();
