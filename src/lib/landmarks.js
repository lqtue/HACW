/**
 * Landmark elevations — the buildings themselves, drawn on the map.
 *
 * The reference map (Bangkok Design Week) puts line-art drawings of real
 * buildings at their own coordinates, which is what turns a plan into something
 * you recognise while standing in front of it. This is the same idea, sized for
 * a phone: one flat two-tone drawing per notable site, ink on cream, no shading.
 *
 * Only sites listed here get one, and a missing drawing is simply not rendered —
 * so the set can grow one building at a time as the illustrations are made.
 * ponytail: hand-authored SVG paths. If more than a handful ship, draw them in a
 * vector editor and export to this same shape (viewBox + a `paths` string).
 */

/** @type {Record<string, { w: number, h: number, paths: (ink: string, fill: string) => string }>} */
export const LANDMARKS = {
  // Chùa Cầu / the Japanese Covered Bridge: tiled roof with lifted eaves, the
  // small shrine pavilion pushed forward of the ridge, arcade posts, stone arches.
  'chua-cau': {
    w: 140,
    h: 96,
    paths: (ink, fill) => `
      <g fill="${fill}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
        <!-- stone base, one solid band; the arches are cut into it below -->
        <path d="M10 72h120v18H10z"/>
        <!-- deck and the shophouse-style body with its posts -->
        <path d="M8 64h124v8H8z"/>
        <path d="M18 48h104v16H18z"/>
        <!-- the long tiled roof, eaves lifted at both ends -->
        <path d="M6 47q64-22 128 0l-8 5q-56-18-112 0z"/>
        <path d="M6 47q-4-1-5-5M134 47q4-1 5-5"/>
        <!-- the shrine that juts out over the middle of the span -->
        <path d="M48 28q22-16 44 0l-7 5q-15-11-30 0z"/>
        <path d="M56 33h28v14H56z"/>
      </g>
      <!-- the two arches the stream runs through: shaded openings, not outlines,
           so they read as holes rather than as two more drawn shapes -->
      <g fill="${ink}" fill-opacity="0.18" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round">
        <path d="M26 90V82a15 15 0 0 1 30 0v8z"/>
        <path d="M84 90V82a15 15 0 0 1 30 0v8z"/>
      </g>
      <g fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round" opacity="0.7">
        <path d="M32 48v16M48 48v16M92 48v16M108 48v16"/>
        <path d="M64 38h12"/>
      </g>`
  }
};

/**
 * Rasterise the drawings and add them as a symbol layer under the pins.
 * SVG → Image → `addImage`; MapLibre takes an HTMLImageElement directly, so no
 * canvas round-trip and no sprite sheet to keep in sync.
 * @param {any} map
 * @param {Map<string, any>} byId destinations keyed by id
 * @param {{ ink: string, fill: string }} colors
 */
export async function addLandmarks(map, byId, { ink, fill }) {
  const drawn = [];
  for (const [id, art] of Object.entries(LANDMARKS)) {
    const dest = byId.get(id);
    if (!dest) continue;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${art.w * 2}" height="${art.h * 2}" viewBox="0 0 ${art.w} ${art.h}">${art.paths(ink, fill)}</svg>`;
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    map.addImage(`lm-${id}`, img, { pixelRatio: 2 });
    drawn.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [dest.lng, dest.lat] },
      properties: { icon: `lm-${id}` }
    });
  }
  if (!drawn.length) return;

  map.addSource('landmarks', { type: 'geojson', data: { type: 'FeatureCollection', features: drawn } });
  map.addLayer({
    id: 'landmarks',
    type: 'symbol',
    source: 'landmarks',
    minzoom: 16, // below this it is a smudge, and the pin already says "here"
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-anchor': 'bottom', // the building stands on its own footprint
      'icon-offset': [0, -12], // clear of its own pin
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-rotation-alignment': 'viewport', // stays upright when the map is turned
      'icon-size': ['interpolate', ['linear'], ['zoom'], 16, 0.5, 17.5, 0.75, 19, 1]
    }
  });
}
