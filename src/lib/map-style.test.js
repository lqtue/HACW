import assert from 'node:assert';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { BOUNDS, hoianStyle, principalBearing } from './map-style.js';
import { LANDMARKS } from './landmarks.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const destinations = read('./data/destinations.json');
const tickets = read('./data/ticket-points.json');
const MAP = new URL('../../static/map/', import.meta.url);

const style = hoianStyle('http://localhost', 'vi');

// Layers the app adds on top of the flavor. A @protomaps/basemaps upgrade that
// shipped one of these ids would silently replace our own layer.
const OURS = ['esri', 'buildings-3d', 'booths', 'sites', 'route-line', 'route-stop', 'route-step'];
for (const id of OURS) {
  assert.ok(
    !style.layers.some((l) => l.id === id),
    `basemap flavor now ships a layer called "${id}" — rename ours`
  );
}

// The satellite toggle hides the basemap by filtering on source === 'protomaps'.
assert.ok(style.layers.filter((l) => l.source === 'protomaps').length > 10, 'no basemap layers');

// Every fontstack the style asks for must be self-hosted, ours included.
// text-font may be an expression (['case', …, ['literal', [...]]]), so walk it
// and keep the capitalised strings — expression keywords are all lowercase.
const fonts = new Set(['Noto Sans Medium']);
const walk = (v) => {
  if (Array.isArray(v)) v.forEach(walk);
  else if (typeof v === 'string' && /^[A-Z]/.test(v)) fonts.add(v);
};
for (const l of style.layers) walk(l.layout?.['text-font']);
for (const f of fonts) {
  assert.ok(existsSync(new URL(`fonts/${f}/`, MAP)), `missing glyphs for "${f}"`);
}

// Labels are rendered from pre-generated glyph ranges, so a name with a
// codepoint outside them draws as tofu. Only 4 ranges ship (~120 KB each).
const ranges = readdirSync(new URL(`fonts/Noto Sans Medium/`, MAP))
  .filter((n) => n.endsWith('.pbf'))
  .map((n) => n.replace('.pbf', '').split('-').map(Number));
const covered = (cp) => ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
for (const label of [
  ...destinations.flatMap((d) => [d.name.vi, d.name.en]),
  ...tickets.map((p) => p.id)
]) {
  for (const ch of label) {
    assert.ok(covered(ch.codePointAt(0)), `no glyph range for "${ch}" in "${label}"`);
  }
}

// maxBounds pins panning to the extract, so a pin outside it is unreachable.
const inside = (lng, lat) =>
  lng >= BOUNDS[0][0] && lng <= BOUNDS[1][0] && lat >= BOUNDS[0][1] && lat <= BOUNDS[1][1];
for (const p of [...destinations, ...tickets]) {
  assert.ok(inside(p.lng, p.lat), `${p.id} is outside the map extract — widen the archive`);
}

// The map is rotated to the sites' long axis so the old town fits a portrait
// phone. If an edit ever made that rotation pointless, the map should go back to
// north-up rather than be mysteriously crooked.
const bearing = principalBearing(destinations);
const rad = (bearing * Math.PI) / 180;
const k = Math.cos((15.88 * Math.PI) / 180);
const rotated = destinations.map((d) => {
  const x = d.lng * k;
  const y = d.lat;
  return [x * Math.cos(rad) - y * Math.sin(rad), x * Math.sin(rad) + y * Math.cos(rad)];
});
const span = (v) => Math.max(...v) - Math.min(...v);
const across = span(rotated.map((p) => p[0]));
const along = span(rotated.map((p) => p[1]));
assert.ok(along > across * 1.5, `rotation no longer helps: ${along.toFixed(5)} vs ${across.toFixed(5)}`);

// Landmark drawings are keyed by destination id; a typo would silently draw nothing.
for (const id of Object.keys(LANDMARKS)) {
  assert.ok(
    destinations.some((d) => d.id === id),
    `landmark "${id}" is not a destination id`
  );
}

console.log(
  `map-style.test.js ok — ${style.layers.length} basemap layers, ${fonts.size} fontstacks, ` +
    `${ranges.length} glyph ranges, bearing ${bearing.toFixed(0)}°, ${Object.keys(LANDMARKS).length} landmark(s)`
);
