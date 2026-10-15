// Metvisor: visor meteorológico (Open-Meteo). Sin módulos ni compilación.
(function () {
  const BOUNDS = { south: 35.8, north: 44.0, west: -9.8, east: 4.6 };
  const STEP = 1.0;      // grados entre puntos de la malla
  const CHUNK = 50;      // puntos por petición
  const DAYS = 2;

  const MODELS = {
    icon_eu: 'ICON-EU (DWD, ~6,5 km)',
    icon_global: 'ICON global (DWD, ~11 km)',
    ecmwf_ifs025: 'ECMWF IFS (~25 km)',
    gfs_seamless: 'GFS (NOAA)',
    meteofrance_arpege_europe: 'ARPEGE Europa (Météo-France)',
  };
  const VARS = {
    temperature_2m: { label: 'Temperatura 2 m (°C)', min: -10, max: 40, colors: ['#3b4cc0', '#6fa8dc', '#f6f6c0', '#f4a259', '#b40426'] },
    precipitation: { label: 'Precipitación (mm/h)', min: 0, max: 10, colors: ['#ffffff', '#a6d8f0', '#3f8fd2', '#6a3d9a', '#d1005f'] },
    cloud_cover: { label: 'Nubosidad (%)', min: 0, max: 100, colors: ['#fdfdfd', '#c8c8c8', '#6e6e6e'] },
    wind_speed_10m: { label: 'Viento 10 m (km/h)', min: 0, max: 90, colors: ['#ffffcc', '#a1dab4', '#41b6c4', '#2c7fb8', '#253494'] },
    pressure_msl: { label: 'Presión (hPa)', min: 990, max: 1040, colors: ['#762a83', '#e7d4e8', '#f7f7f7', '#d9f0d3', '#1b7837'] },
  };

  // --- malla ---
  const lats = [], lons = [];
  for (let a = BOUNDS.south; a <= BOUNDS.north + 1e-9; a += STEP) lats.push(+a.toFixed(3));
  for (let o = BOUNDS.west; o <= BOUNDS.east + 1e-9; o += STEP) lons.push(+o.toFixed(3));
  const points = [];
  lats.forEach(la => lons.forEach(lo => points.push([la, lo])));

  // --- datos (con caché por modelo) ---
  let times = [];
  const cache = {};
  function loadModel(model) {
    if (cache[model]) return cache[model];
    const names = Object.keys(VARS);
    const groups = [];
    for (let i = 0; i < points.length; i += CHUNK) groups.push(points.slice(i, i + CHUNK));
    cache[model] = Promise.all(groups.map(g => {
      const q = new URLSearchParams({
        latitude: g.map(p => p[0]).join(','), longitude: g.map(p => p[1]).join(','),
        hourly: names.join(','), models: model, forecast_days: DAYS, timezone: 'UTC',
      });
      return fetch('https://api.open-meteo.com/v1/forecast?' + q)
        .then(r => r.ok ? r.json() : r.text().then(t => { throw new Error(r.status + ' ' + t); }))
        .then(j => Array.isArray(j) ? j : [j]);
    })).then(parts => {
      const flat = [].concat(...parts);
      times = flat[0].hourly.time;
      const data = {};
      names.forEach(n => { data[n] = flat.map(r => r.hourly[n]); });
      return data;
    }).catch(e => { delete cache[model]; throw e; });
    return cache[model];
  }

  // --- color e interpolación ---
  const hex = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
  function color(cols, t) {
    const x = Math.min(1, Math.max(0, t)) * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(x)), f = x - i;
    const a = hex(cols[i]), b = hex(cols[i + 1]);
    return a.map((v, k) => Math.round(v + (b[k] - v) * f));
  }
  function bilinear(m, la, lo) {
    if (la < lats[0] || la > lats[lats.length - 1] || lo < lons[0] || lo > lons[lons.length - 1]) return null;
    const i = Math.min(lats.length - 2, Math.floor((la - lats[0]) / STEP));
    const j = Math.min(lons.length - 2, Math.floor((lo - lons[0]) / STEP));
    const ty = (la - lats[i]) / STEP, tx = (lo - lons[j]) / STEP;
    const v = [m[i][j], m[i][j + 1], m[i + 1][j], m[i + 1][j + 1]];
    if (v.some(x => x == null)) return null;
    return (v[0] * (1 - tx) + v[1] * tx) * (1 - ty) + (v[2] * (1 - tx) + v[3] * tx) * ty;
  }

  // --- capa canvas ---
  const Field = L.Layer.extend({
    onAdd(map) {
      this._map = map;
      this._c = L.DomUtil.create('canvas', 'leaflet-zoom-hide');
      Object.assign(this._c.style, { position: 'absolute', opacity: 0.65, pointerEvents: 'none' });
      map.getPanes().overlayPane.appendChild(this._c);
      map.on('moveend zoomend resize', this.draw, this);
      this.draw();
    },
    onRemove(map) { this._c.remove(); map.off('moveend zoomend resize', this.draw, this); },
    set(matrix, spec) { this.m = matrix; this.spec = spec; this.draw(); },
    draw() {
      if (!this._map || !this.m) return;
      const s = this._map.getSize(), c = this._c, S = 4;
      L.DomUtil.setPosition(c, this._map.containerPointToLayerPoint([0, 0]));
      c.width = s.x; c.height = s.y;
      const ctx = c.getContext('2d'), sp = this.spec;
      for (let x = 0; x < s.x; x += S) for (let y = 0; y < s.y; y += S) {
        const ll = this._map.containerPointToLatLng([x + S / 2, y + S / 2]);
        const v = bilinear(this.m, ll.lat, ll.lng);
        if (v == null) continue;
        const [r, g, b] = color(sp.colors, (v - sp.min) / (sp.max - sp.min));
        ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
        ctx.fillRect(x, y, S, S);
      }
    },
  });

  // --- paneles ---
  const slider = document.getElementById('timeSlider'), status = document.getElementById('status');
  const opts = o => Object.keys(o).map(k => '<option value="' + k + '">' + (o[k].label || o[k]) + '</option>').join('');
  const panels = [];

  ['p0'].forEach((id, n) => {
    const el = document.getElementById(id);
    el.innerHTML = '<div class="map"></div><div class="bar"><select class="model">' + opts(MODELS) +
      '</select><select class="var">' + opts(VARS) + '</select></div><div class="legend"><span><i></i><i></i></span><div></div></div>';
    const map = L.map(el.querySelector('.map'), { zoomControl: true })
      .fitBounds([[BOUNDS.south, BOUNDS.west], [BOUNDS.north, BOUNDS.east]]);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap · Open-Meteo', maxZoom: 12 }).addTo(map);
    const layer = new Field().addTo(map);
    const p = { el, map, layer, data: null,
      model: el.querySelector('.model'), vari: el.querySelector('.var') };
    p.model.onchange = () => reload(p);
    p.vari.onchange = () => show(p);
    panels.push(p);
  });

  function show(p) {
    if (!p.data) return;
    const spec = VARS[p.vari.value], t = +slider.value, d = p.data[p.vari.value];
    p.layer.set(lats.map((_, i) => lons.map((_, j) => d[i * lons.length + j][t])), spec);
    const lg = p.el.querySelector('.legend');
    lg.children[0].innerHTML = '<i>' + spec.min + '</i><i>' + spec.max + '</i>';
    lg.children[1].style.background = 'linear-gradient(to right,' + spec.colors.join(',') + ')';
    document.getElementById('timeLabel').textContent = (times[t] || '–').replace('T', ' ');
  }
  function reload(p) {
    status.textContent = 'Descargando ' + p.model.value + '…';
    loadModel(p.model.value).then(d => {
      p.data = d; slider.max = times.length - 1; status.textContent = 'Listo';
      show(p);
    }).catch(e => { status.textContent = 'Error: ' + e.message; });
  }
  slider.oninput = () => panels.forEach(show);
  panels.forEach(reload);
})();
