// Rampa de color: interpola linealmente entre paradas hex.
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

export function colorAt(colors, t) {
  const x = Math.min(1, Math.max(0, t)) * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(x));
  const f = x - i;
  const a = hex(colors[i]), b = hex(colors[i + 1]);
  return a.map((v, k) => Math.round(v + (b[k] - v) * f));
}

export const cssGradient = colors => `linear-gradient(to right, ${colors.join(', ')})`;
