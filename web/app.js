// Metvisor — Fase 1: interfaz con panel lateral, barra de tiempo y leyenda.
// Los fotogramas vienen de Sample (campos sintéticos) hasta que exista el pipeline (Fase 2).
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var state = { v: 0, t: 0, timer: null };
  var manifest, map, source, runTime;

  function utc(ms) {
    var d = new Date(ms);
    var dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    var meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return dias[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + meses[d.getUTCMonth()] + ' · ' + p(d.getUTCHours()) + ':00 UTC';
  }

  function readHash() {
    var p = new URLSearchParams(location.hash.slice(1));
    var vi = manifest.variables.findIndex(function (x) { return x.id === p.get('var'); });
    if (vi >= 0) state.v = vi;
    var t = parseInt(p.get('t'), 10);
    if (t >= 0 && t < manifest.steps.length) state.t = t;
  }
  function writeHash() {
    history.replaceState(null, '', '#var=' + manifest.variables[state.v].id + '&t=' + state.t);
  }

  function buildSidebar() {
    var html = '', group = '';
    manifest.variables.forEach(function (v, i) {
      if (v.group !== group) { group = v.group; html += '<h3>' + group + '</h3>'; }
      html += '<button type="button" data-i="' + i + '">' + v.label + '</button>';
    });
    $('vars').innerHTML = html;
    $('vars').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.v = +b.dataset.i; document.body.classList.remove('menu-open'); $('menuBtn').setAttribute('aria-expanded', 'false'); update();
    });
    $('modelPill').textContent = manifest.model + ' · ' + runLabel();
  }
  function runLabel() { return String(new Date(runTime).getUTCHours()).padStart(2, '0') + ' UTC'; }

  function buildDays() {
    var html = '', last = -1, n = manifest.steps.length - 1;
    manifest.steps.forEach(function (h, i) {
      var d = new Date(runTime + h * 3600e3), day = d.getUTCDate();
      if (day !== last) {
        last = day;
        var names = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
        html += '<span style="left:' + (i / n * 100) + '%">' + names[d.getUTCDay()] + ' ' + day + '</span>';
      }
    });
    $('days').innerHTML = html;
  }

  var frames = {};
  function frame(v, i) {
    if (!manifest.sample) {
      var s = String(manifest.steps[i]).padStart(3, '0');
      return 'data/frames/' + v.id + '/' + s + '.png';
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

  function update() {
    var v = manifest.variables[state.v], h = manifest.steps[state.t];
    Array.prototype.forEach.call($('vars').querySelectorAll('button'), function (b) {
      b.classList.toggle('on', +b.dataset.i === state.v);
    });
    $('slider').value = state.t;
    $('lead').textContent = '+' + h + ' h';
    $('timeChip').textContent = utc(runTime + h * 3600e3);
    $('legendTitle').textContent = v.label + ' (' + v.unit + ')';
    $('legendBar').style.background = 'linear-gradient(90deg,' + v.colors.join(',') + ')';
    var mid = Math.round((v.min + v.max) / 2);
    $('legendTicks').innerHTML = '<span>' + v.min + '</span><span>' + mid + '</span><span>' + v.max + '</span>';
    if (source) source.updateImage({ url: frame(v, state.t), coordinates: coords() });
    preload(v);
    writeHash();
  }

  function coords() {
    var b = manifest.bounds;
    return [[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south]];
  }

  function togglePlay() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; $('play').textContent = '▶'; $('play').setAttribute('aria-label', 'Reproducir'); return; }
    $('play').textContent = '❚❚'; $('play').setAttribute('aria-label', 'Pausar');
    state.timer = setInterval(function () { state.t = (state.t + 1) % manifest.steps.length; update(); }, 500);
  }

  function initMap() {
    var b = manifest.bounds;
    map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19,
          attribution: '© OpenStreetMap · Deutscher Wetterdienst' } },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      bounds: [b.west, b.south, b.east, b.north],
      maxBounds: [[-20, 28], [15, 52]],
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', function () {
      var v = manifest.variables[state.v];
      map.addSource('field', { type: 'image', url: frame(v, state.t), coordinates: coords() });
      map.addLayer({ id: 'field', type: 'raster', source: 'field', paint: { 'raster-opacity': 0.8, 'raster-fade-duration': 0 } });
      source = map.getSource('field');
    });
  }

  // Datos reales (generados por el pipeline); si no existen, manifiesto de muestra.
  function loadManifest() {
    return fetch('data/manifest.json').then(function (r) {
      if (!r.ok) throw new Error('sin datos reales');
      return r.json();
    }).catch(function () { return fetch('manifest.json').then(function (r) { return r.json(); }); });
  }

  loadManifest().then(function (m) {
    manifest = m;
    // Pasada real, o de muestra: última hora múltiplo de 6 en UTC.
    runTime = m.runTime ? Date.parse(m.runTime) : Math.floor(Date.now() / 21600e3) * 21600e3;
    readHash();
    $('sampleBadge').hidden = !m.sample;
    $('slider').max = m.steps.length - 1;
    buildSidebar(); buildDays(); initMap(); update();
    $('slider').addEventListener('input', function () { state.t = +this.value; update(); });
    $('play').addEventListener('click', togglePlay);
    $('menuBtn').addEventListener('click', function () {
      var open = document.body.classList.toggle('menu-open'); this.setAttribute('aria-expanded', open);
    });
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      if (e.key === 'ArrowRight') { state.t = Math.min(manifest.steps.length - 1, state.t + 1); update(); }
      if (e.key === 'ArrowLeft') { state.t = Math.max(0, state.t - 1); update(); }
    });
  }).catch(function (e) { document.body.insertAdjacentHTML('beforeend', '<p style="position:absolute;top:50%;left:20px;color:#b00">No se pudo cargar manifest.json: ' + e.message + '</p>'); });
})();
