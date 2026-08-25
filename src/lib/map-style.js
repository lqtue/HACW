import { DARK, LIGHT, layers } from '@protomaps/basemaps';
import categories from './data/categories.json' with { type: 'json' };

/**
 * "Giấy Hội An" — the basemap as *paper*, deliberately almost colourless.
 *
 * Protomaps ships flavors (LIGHT/DARK/...) as flat colour dictionaries, so a
 * brand map is a spread plus the keys that actually show at old-town zooms. The
 * governing rule here is borrowed from Bangkok Design Week's map: the basemap
 * carries no brand colour at all, so the only saturated things on screen are the
 * 25 destinations and the tour lines. Ivory land, white streets, the Hoài river
 * barely tinted — everything sits a step above "greyscale" so it still reads as
 * the event's paper rather than a utility map.
 */
// OSM's own points of interest. The flavor keys these by colour name, one per
// POI family; ours are all muted and warm so context labels never compete with
// the 25 destination pins — except transport, which stays cool on purpose,
// because a bus stop is wayfinding, not decoration. Shared by both flavors —
// they're hidden by `hidePois` anyway, so one warm set serves light and dark.
const POIS = {
  green: '#6f8a5c',
  turquoise: '#5f9a99',
  lapis: '#6d7f96',
  slategray: '#8d8299',
  blue: '#94796a',
  tangerine: '#b4763c',
  red: '#b5624e',
  pink: '#a2786a'
};

export const HOI_AN = {
  ...LIGHT,
  background: '#ece5da',
  earth: '#f7f2e9',

  water: '#cddedb',
  sand: '#f0e7d5',
  beach: '#f0e7d5',

  park_a: '#e8e9dd',
  park_b: '#d5ddc8',
  wood_a: '#e6e8dc',
  wood_b: '#d2dbc6',
  scrub_a: '#e9eadf',
  scrub_b: '#dcdfcd',

  buildings: '#e9e1d2',
  pedestrian: '#f3ece0',
  pier: '#ece4d6',

  other: '#ffffff',
  minor_service: '#ffffff',
  minor_a: '#ffffff',
  minor_b: '#ffffff',
  link: '#ffffff',
  major: '#ffffff',
  highway: '#ffffff',
  minor_service_casing: '#e2dbcd',
  minor_casing: '#e2dbcd',
  link_casing: '#ded6c7',
  major_casing_early: '#ded6c7',
  major_casing_late: '#ded6c7',
  highway_casing_early: '#d6cdbc',
  highway_casing_late: '#d6cdbc',

  railway: '#cfc6b8',
  boundaries: '#cabfae',

  roads_label_minor: '#9c9184',
  roads_label_minor_halo: '#fffdf8',
  roads_label_major: '#7d756a',
  roads_label_major_halo: '#fffdf8',
  subplace_label: '#8d8478',
  subplace_label_halo: '#fffdf8',
  city_label: '#5f584e',
  city_label_halo: '#fffdf8',
  address_label: '#b3aca1',
  address_label_halo: '#fffdf8',
  pois: POIS
};

/**
 * "Giấy Hội An" after dark — the same printed-plan idea inverted. The land is a
 * warm near-black, streets a step lighter so they still read, the river barely
 * tinted; nothing carries brand colour, so the 25 saturated pins are again the
 * only bright things on screen. Same key set as HOI_AN, dark values.
 */
export const HOI_AN_DARK = {
  ...DARK,
  background: '#141210',
  earth: '#1c1915',

  water: '#222b2c',
  sand: '#201d16',
  beach: '#201d16',

  park_a: '#1c2018',
  park_b: '#242c1e',
  wood_a: '#1b1f17',
  wood_b: '#232a1d',
  scrub_a: '#1d2019',
  scrub_b: '#252b1f',

  buildings: '#221e17',
  pedestrian: '#26221a',
  pier: '#1f1b15',

  other: '#2d2820',
  minor_service: '#2d2820',
  minor_a: '#2d2820',
  minor_b: '#2d2820',
  link: '#2d2820',
  major: '#322c22',
  highway: '#322c22',
  minor_service_casing: '#171410',
  minor_casing: '#171410',
  link_casing: '#171410',
  major_casing_early: '#171410',
  major_casing_late: '#171410',
  highway_casing_early: '#171410',
  highway_casing_late: '#171410',

  railway: '#3a3327',
  boundaries: '#4a4231',

  roads_label_minor: '#8a8072',
  roads_label_minor_halo: '#100e0b',
  roads_label_major: '#a89e8c',
  roads_label_major_halo: '#100e0b',
  subplace_label: '#9a9080',
  subplace_label_halo: '#100e0b',
  city_label: '#cabfa9',
  city_label_halo: '#100e0b',
  address_label: '#726b60',
  address_label_halo: '#100e0b',
  pois: POIS
};

/**
 * Drop OSM's own POIs and house numbers. Every restaurant, ATM and 7-Eleven in
 * the old town is noise on a map whose whole job is 25 destinations — and the
 * POI icons come from the Protomaps sprite as flat colour (not SDF), so they
 * cannot even be toned down to match. Streets and place names stay.
 * @param {any} map
 */
export function hidePois(map) {
  for (const id of ['pois', 'address_label']) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  }
}

/** Layers that belong to the 3D button, not to the flat plan. */
export const TILT_LAYERS = ['buildings', 'buildings-3d'];

/**
 * Compass bearing of the long axis of a set of points, so the map can be rotated
 * to put that axis up the screen. Hội An's sites run almost due east–west
 * (965 × 462 m); on a portrait phone that wastes half the screen, and turning the
 * map makes it 455 × 958 — the same walk, twice the legible size. Plain principal
 * component: the eigenvector of the 2×2 covariance, no library.
 * @param {{lat: number, lng: number}[]} points
 * @returns {number} degrees clockwise from north
 */
export function principalBearing(points) {
  const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng0 = points.reduce((s, p) => s + p.lng, 0) / points.length;
  const k = Math.cos((lat0 * Math.PI) / 180); // longitude degrees are shorter here
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of points) {
    const x = (p.lng - lng0) * k;
    const y = p.lat - lat0;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return ((Math.atan2(Math.cos(th), Math.sin(th)) * 180) / Math.PI + 360) % 360;
}

/**
 * Name the loaded archive registers itself under with the pmtiles protocol —
 * the style's source URL has to be this exact string, not the file's path.
 */
export const PMTILES_KEY = 'hoian.pmtiles';

/**
 * The extract's own bbox, padded ~200 m. Used as the map's `maxBounds`: outside
 * it there is no data, so a pan that leaves it would show blank paper. Widen
 * this and the archive together or not at all.
 */
export const BOUNDS = [
  [108.313, 15.867],
  [108.344, 15.888]
];

/**
 * Old-town massing, behind the 3D button. Off by default: the map reads as a
 * printed plan, and pitched buildings hide the streets you are trying to walk.
 * OSM rarely tags a height here, so the fallback (7 m ≈ the two-storey shophouse
 * the whole quarter is built from) is what actually draws; the walls rise out of
 * the ground between z14.5 and z16 so zooming in *builds* the town.
 */
export const BUILDINGS_3D = {
  id: 'buildings-3d',
  type: 'fill-extrusion',
  source: 'protomaps',
  'source-layer': 'buildings',
  minzoom: 14.5,
  layout: { visibility: 'none' },
  paint: {
    'fill-extrusion-color': [
      'interpolate',
      ['linear'],
      ['coalesce', ['get', 'height'], 7],
      0, '#f0e9dc',
      8, '#e4dac7',
      18, '#d2c4ac',
      40, '#bcab90'
    ],
    'fill-extrusion-vertical-gradient': true,
    'fill-extrusion-height': [
      'interpolate',
      ['linear'],
      ['zoom'],
      14.5, 0,
      16, ['coalesce', ['get', 'height'], 7]
    ],
    'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
    'fill-extrusion-opacity': 0.95
  }
};

/**
 * Warm haze at the horizon and a low afternoon key light. Both only read once
 * the camera is pitched, which is why the map now opens tilted.
 */
const SKY = {
  'sky-color': '#bfe3e2',
  'horizon-color': '#fbd9c6',
  'fog-color': '#fdf1e2',
  'sky-horizon-blend': 0.7,
  'horizon-fog-blend': 0.6,
  'fog-ground-blend': 0.55,
  'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 17, 0.12]
};

const LIGHT_3D = { anchor: 'viewport', color: '#fff4e2', intensity: 0.38, position: [1.4, 210, 32] };

/** Night variants of the two — only read when the camera is pitched (3D button). */
const DARK_SKY = {
  'sky-color': '#0d1622',
  'horizon-color': '#241a1c',
  'fog-color': '#14100c',
  'sky-horizon-blend': 0.7,
  'horizon-fog-blend': 0.6,
  'fog-ground-blend': 0.55,
  'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 17, 0.12]
};

const DARK_LIGHT_3D = { anchor: 'viewport', color: '#3a3630', intensity: 0.5, position: [1.4, 210, 32] };

/**
 * MapLibre style for the offline old-town basemap. Everything it references —
 * tiles, glyphs, sprite — is served from our own `static/map/`, so the map
 * draws with no network and no API key at all.
 * MapLibre rejects a relative `sprite`, so the caller passes an origin-prefixed
 * base (`location.origin + base`) — browser-only, which this map already is.
 * @param {string} base origin + SvelteKit `base` path
 * @param {'vi'|'en'} lang label language
 * @param {boolean} [dark] use the night flavor
 */
export function hoianStyle(base, lang = 'vi', dark = false) {
  return {
    version: 8,
    glyphs: `${base}/map/fonts/{fontstack}/{range}.pbf`,
    // the sprite carries only OSM POI icons, which `hidePois` hides — so one
    // (light) sprite serves both themes, no dark sprite to author.
    sprite: `${base}/map/sprites/light`,
    sky: dark ? DARK_SKY : SKY,
    light: dark ? DARK_LIGHT_3D : LIGHT_3D,
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${PMTILES_KEY}`,
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>, Protomaps'
      }
    },
    layers: layers('protomaps', dark ? HOI_AN_DARK : HOI_AN, { lang })
  };
}

/** @type {Promise<any>|undefined} */
let loading;

/**
 * Load MapLibre and register the archive under the `pmtiles://` protocol, once
 * per page load however many maps open. The archive is fetched whole and read
 * from memory rather than by HTTP range: 1.3 MB is one ordinary GET the service
 * worker can cache, whereas ranged requests need a 206 reply the SW cache
 * cannot serve without extra plumbing.
 * ponytail: whole-file read caps the archive at the old town. Switch to the URL
 * source (range requests) if a province-wide extract ever ships.
 * @param {string} base SvelteKit `base` path
 * @returns {Promise<any>} the maplibre-gl namespace (v6 has no default export)
 */
export function loadMap(base) {
  return (loading ??= (async () => {
    // maplibre-gl v6 finds its worker with `new URL('./maplibre-gl-worker.mjs',
    // import.meta.url)`. Rollup can't see through that template literal, so the
    // built chunk asks for a sibling file nobody emitted -> 404 in production.
    // `?worker&url` makes Vite bundle the worker (it imports
    // maplibre-gl-shared.mjs, so a bare `?url` would 404 on that instead) and
    // hand back the hashed asset path. Imported here, not at module top level,
    // so `map-style.test.js` can still load this file in plain node.
    const [maplibregl, { Protocol, PMTiles, FileSource }, { default: workerUrl }] =
      await Promise.all([
        import('maplibre-gl'),
        import('pmtiles'),
        import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url')
      ]);
    await import('maplibre-gl/dist/maplibre-gl.css');
    maplibregl.setWorkerUrl(workerUrl);
    const blob = await (await fetch(`${base}/map/${PMTILES_KEY}`)).blob();
    const protocol = new Protocol();
    protocol.add(new PMTiles(new FileSource(new File([blob], PMTILES_KEY))));
    maplibregl.addProtocol('pmtiles', protocol.tile);
    return maplibregl;
  })());
}

/** Pins are drawn at 2× and handed to `addImage` with this pixelRatio. */
export const PIN_DPR = 2;
/** Pin box, CSS px. The mark is centred in it, so symbols anchor at centre. */
const PIN = 34;

/** Petal rim of the mắt cửa, as a canvas path. Mirrors `MatCua.svelte`. */
// The SAME rosette as MatCua.svelte (8 petals on a 13.5/24 ring, r 6.4/24, centre
// 12.5/24) so the pin and every other mark in the app are one drawing, not two.
function markPath(x, r, petals = 8) {
  x.beginPath();
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    const cx = r * 0.5625 * Math.cos(a), cy = r * 0.5625 * Math.sin(a);
    x.moveTo(cx + r * 0.267, cy);
    x.arc(cx, cy, r * 0.267, 0, Math.PI * 2);
  }
  x.moveTo(r * 0.52, 0);
  x.arc(0, 0, r * 0.52, 0, Math.PI * 2);
}

/**
 * A destination pin as a MapLibre image: the **mắt cửa** — the carved door-eye
 * over old-town doorways, the app's one recurring mark (see `MatCua.svelte`),
 * flattened to a map symbol. Category is carried by the fill alone, the way the
 * reference map uses one glyph in one hue for every venue; the ink keyline is
 * what keeps it legible on a near-white basemap.
 *
 * Drawn on a canvas so sites can be one real symbol layer (label collision, zoom
 * sizing, data-driven dimming) instead of 25 absolutely-positioned DOM nodes.
 * @param {string} fill category accent
 * @param {string} ink keyline colour (light on the dark basemap, so the mark
 *   detaches from dark land; dark on the light one)
 * @param {string} [spark] gold badge colour — set for spotlight sites
 * @param {string} [eye] pupil colour; defaults to `ink`. Kept dark on the dark
 *   map so the pupil still reads against the cream eye face.
 * @returns {ImageData} pass to `map.addImage(id, …, { pixelRatio: PIN_DPR })`
 */
export function pinImage(fill, ink, spark, eye = ink) {
  const dpr = PIN_DPR;
  const c = document.createElement('canvas');
  c.width = PIN * dpr;
  c.height = PIN * dpr;
  const x = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  x.scale(dpr, dpr);
  x.translate(PIN / 2, PIN / 2);

  const R = PIN / 2 - 2;
  // Hairline keyline by underprint: the same path, ink, a hair larger — just enough
  // to lift the mark off the basemap. Canvas can't union the petals into one
  // outline, and stroking each would draw the seams.
  markPath(x, R);
  x.fillStyle = ink;
  x.fill();
  markPath(x, R - 0.9);
  x.fillStyle = fill;
  x.fill();

  // the centre, as MatCua draws it: a hole in the surface colour with a dot of the
  // category colour — not a white eye with a black pupil
  x.beginPath();
  x.arc(0, 0, R * 0.29, 0, Math.PI * 2);
  x.fillStyle = eye;
  x.fill();
  x.beginPath();
  x.arc(0, 0, R * 0.125, 0, Math.PI * 2);
  x.fillStyle = fill;
  x.fill();

  // spotlight badge: the four-petal spark from the key visual, top-right
  if (spark) {
    x.save();
    x.translate(R * 0.72, -R * 0.72);
    x.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      x.moveTo(0, 0);
      x.quadraticCurveTo(
        6 * Math.cos(a - 0.5),
        6 * Math.sin(a - 0.5),
        7 * Math.cos(a),
        7 * Math.sin(a)
      );
      x.quadraticCurveTo(6 * Math.cos(a + 0.5), 6 * Math.sin(a + 0.5), 0, 0);
    }
    x.fillStyle = ink;
    x.strokeStyle = ink;
    x.lineWidth = 3;
    x.stroke();
    x.fillStyle = spark;
    x.fill();
    x.restore();
  }

  return x.getImageData(0, 0, c.width, c.height);
}

/**
 * Register the per-category pin images on a map: a plain + a gold-spotlight variant
 * each, drawn from the app's `--c-<id>` CSS vars. This block was copied verbatim in
 * the builder and discover maps — call it once, after the map's 'load'.
 * @param {import('maplibre-gl').Map} map
 * @param {boolean} dark  dark basemap active → flip the keyline to warm paper
 * @returns {{ gold: string, ink: string, eye: string }} reused by callers for the
 *   booth stroke, landmark ink, etc. — so they don't re-read the same CSS vars.
 */
export function addCategoryPins(map, dark) {
  const css = getComputedStyle(document.documentElement);
  const gold = css.getPropertyValue('--gold').trim() || '#e0a83c';
  // keyline: dark ink on the light plan, warm paper on the dark one. The centre hole
  // is the surface colour (as MatCua's `inner`), so the basemap shows through it.
  const ink = dark ? '#efe6d6' : '#1c1917';
  const eye = css.getPropertyValue('--surface').trim() || (dark ? '#1b1a17' : '#ffffff');
  for (const c of categories) {
    const color = css.getPropertyValue(`--c-${c.id}`).trim() || '#bb4b2c';
    map.addImage(`pin-${c.id}`, pinImage(color, ink, undefined, eye), { pixelRatio: PIN_DPR });
    map.addImage(`pin-${c.id}-spot`, pinImage(color, ink, gold, eye), { pixelRatio: PIN_DPR });
  }
  // the walk's NEXT stop, in the brand orange regardless of category (tour nav)
  const brand = css.getPropertyValue('--brand').trim() || '#e0542c';
  map.addImage('pin-next', pinImage(brand, ink, gold, eye), { pixelRatio: PIN_DPR });
  return { gold, ink, eye };
}
