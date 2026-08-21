<script>
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import { hidePois, hoianStyle, loadMap } from '$lib/map-style.js';
  import { i18n } from '$lib/i18n.svelte.js';
  import { theme } from '$lib/theme.svelte.js';

  /** @type {{ stops: any[], height?: string }} */
  let { stops, height = '220px' } = $props();

  let el;
  let map;
  // async onMount can't return a cleanup -> tear the map down explicitly
  onDestroy(() => map?.remove());

  // Same offline vector basemap as the main map, so an opened tour draws with no
  // signal too. ponytail: no popups — the map is non-interactive and the stop
  // names are listed right beside it on the tour page.
  onMount(async () => {
    const maplibregl = await loadMap(base);
    const line = stops.map((d) => [d.lng, d.lat]);
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
      fitBoundsOptions: { padding: 34, maxZoom: 17 },
      interactive: false,
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
            properties: { step: String(i + 1) }
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
