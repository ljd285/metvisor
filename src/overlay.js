// Capa canvas de Leaflet que pinta el campo interpolado.
import { bilinear } from './lib/grid.js';
import { colorAt } from './lib/colors.js';

export const FieldLayer = L.Layer.extend({
  initialize(opts = {}) { this.opts = { opacity: 0.65, cell: 4, ...opts }; this.state = null; },

  onAdd(map) {
    this._map = map;
    this._canvas = L.DomUtil.create('canvas', 'leaflet-zoom-hide');
    this._canvas.style.position = 'absolute';
    this._canvas.style.opacity = this.opts.opacity;
    this._canvas.style.pointerEvents = 'none';
    map.getPanes().overlayPane.appendChild(this._canvas);
    map.on('moveend zoomend resize', this.redraw, this);
    this.redraw();
  },
  onRemove(map) {
    this._canvas.remove();
    map.off('moveend zoomend resize', this.redraw, this);
  },

  // grid: {lats, lons}; values[iLat][iLon]; spec: entrada de VARIABLES
  setField(grid, values, spec) { this.state = { grid, values, spec }; this.redraw(); },

  redraw() {
    if (!this._map || !this.state) return;
    const size = this._map.getSize();
    const c = this._canvas;
    L.DomUtil.setPosition(c, this._map.containerPointToLayerPoint([0, 0]));
    c.width = size.x; c.height = size.y;
    const ctx = c.getContext('2d');
    const { grid, values, spec } = this.state;
    const s = this.opts.cell;
    for (let x = 0; x < size.x; x += s) {
      for (let y = 0; y < size.y; y += s) {
        const ll = this._map.containerPointToLatLng([x + s / 2, y + s / 2]);
        const v = bilinear(grid, values, ll.lat, ll.lng);
        if (v == null) continue;
        const [r, g, b] = colorAt(spec.colors, (v - spec.min) / (spec.max - spec.min));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, s, s);
      }
    }
  },
});
