<script>
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import { BOUNDS, hidePois, hoianStyle, loadMap } from '$lib/map-style.js';
  import { stitchRoute } from '$lib/route.js';
  import { sitePopup } from '$lib/map-popup.js';
  import { i18n } from '$lib/i18n.svelte.js';
  import { theme } from '$lib/theme.svelte.js';

  /** padding: px around the fitted route — a number, or per-side when overlays (a
   *  header, a bottom sheet) cover part of the map and the route must land in the gap.
   *  interactive: pan/zoom + tap a stop for its popup (name + one line, no button — the
   *  plan-ready screen; the tour card preview stays a still).
   *  @type {{ stops: any[], height?: string, padding?: number | { top: number, right: number, bottom: number, left: number }, interactive?: boolean }} */
  let { stops, height = '220px', padding = 34, interactive = false } = $props();

  let el;
  let map, mgl, popup;
  // async onMount can't return a cleanup -> tear the map down explicitly
  onDestroy(() => map?.remove());

  // show a stop's popup (also used by the parent's stop list: tap a row → its pin)
  export function focus(id) {
    const d = stops.find((x) => x.id === id);
    if (!d || !map) return;
    popup?.remove();
    popup = sitePopup(mgl, map, d, null, 16);
    // only pan if the stop is hidden under an overlay / off-screen — a stop already in
    // the visible band stays put, so the route doesn't lurch on every row tap
    const p = map.project([d.lng, d.lat]);
    const pad = typeof padding === 'number' ? { top: padding, right: padding, bottom: padding, left: padding } : padding;
    const { clientWidth: w, clientHeight: h } = map.getContainer();
    const inBand = p.x > pad.left && p.x < w - pad.right && p.y > pad.top && p.y < h - pad.bottom;
    if (!inBand) map.easeTo({ center: [d.lng, d.lat], padding: pad, duration: 400 });
  }

  // Same offline vector basemap as the main map, so an opened tour draws with no
  // signal too. ponytail: no popups — the map is non-interactive and the stop
  // names are listed right beside it on the tour page.
  onMount(async () => {
    const maplibregl = (mgl = await loadMap(base));
    // real walking streets where baked (src/lib/data/legs.js), straight legs otherwise
    const line = stitchRoute(stops);
    const bounds = line.reduce(
      (b, [lng, lat]) => [
        [Math.min(b[0][0], lng), Math.min(b[0][1], lat)],
        [Math.max(b[1][0], lng), Math.max(b[1][1], lat)]
      ],
      [
        [180, 90],
        [-180, -90]
      ]
    );

    map = new maplibregl.Map({
      container: el,
      style: hoianStyle(location.origin + base, i18n.lang, theme.mode === 'dark'),
      bounds,
      fitBoundsOptions: { padding, maxZoom: 17 },
      // same cage as SiteMap: the extract's bbox as maxBounds so a pan can never reach
      // blank paper, and a zoom floor so the whole old town can't shrink to a dot
      minZoom: 14,
      maxZoom: 19,
      maxBounds: BOUNDS,
      interactive,
      attributionControl: false
    });

    await new Promise((done) => map.on('load', done));
    hidePois(map);

    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'LineString', coordinates: line }, properties: {} },
          ...stops.map((d, i) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
            properties: { step: String(i + 1), id: d.id }
          }))
        ]
      }
    });
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': '#2f6b5e',
        'line-width': 4,
        'line-opacity': 0.8,
        'line-dasharray': [0.6, 1.6]
      }
    });
    map.addLayer({
      id: 'route-stop',
      type: 'circle',
      source: 'route',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 12,
        'circle-color': '#2f6b5e',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });
    map.addLayer({
      id: 'route-step',
      type: 'symbol',
      source: 'route',
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'text-field': ['get', 'step'],
        'text-font': ['Noto Sans Medium'],
        'text-size': 12,
        'text-allow-overlap': true
      },
      paint: { 'text-color': '#fff' }
    });

    if (interactive) {
      map.on('click', 'route-stop', (e) => focus(e.features[0].properties.id));
      map.on('click', (e) => {
        if (map.queryRenderedFeatures(e.point, { layers: ['route-stop'] }).length) return;
        popup?.remove(); popup = null;
      });
      map.on('mouseenter', 'route-stop', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'route-stop', () => (map.getCanvas().style.cursor = ''));
    }
  });
</script>

<div bind:this={el} class="routemap" style="height: {height}"></div>

<style>
  .routemap {
    width: 100%;
    border-radius: var(--radius);
    overflow: hidden;
    border: 1px solid var(--line);
    background: var(--paper);
  }
</style>
