<script>
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import { hidePois, hoianStyle, loadMap } from '$lib/map-style.js';
  import { geohashDecode } from '$lib/geo.js';
  import { theme } from '$lib/theme.svelte.js';

  // Anonymous research footfall, drawn as a native MapLibre heatmap over the old-town
  // basemap. `cells` is { geohash: { total, byLoc } } parsed from the check-in events;
  // `locale` is 'all' or one language code. K-anonymity: a (cell, locale) bucket under
  // K is suppressed, so no sparse point can single out one visitor.
  /** @type {{ cells: Record<string, {total:number, byLoc:Record<string,number>}>, locale?: string, height?: string }} */
  let { cells, locale = 'all', height = '360px' } = $props();

  const K = 5;

  // GeoJSON points for the current filter, k-anon-suppressed. $derived so the effect
  // below repaints whenever the data or the selected locale changes.
  const fc = $derived.by(() => {
    const feats = [];
    for (const [gh, c] of Object.entries(cells ?? {})) {
      const count = locale === 'all' ? c.total : (c.byLoc?.[locale] ?? 0);
      if (count < K) continue; // suppress sparse buckets
      const p = geohashDecode(gh);
      if (!p) continue;
      feats.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { count }
      });
    }
    return { type: 'FeatureCollection', features: feats };
  });
  const maxCount = $derived(Math.max(1, ...fc.features.map((f) => f.properties.count)));

  let el;
  let map;
  let ready = $state(false);
  onDestroy(() => map?.remove());

  onMount(async () => {
    const maplibregl = await loadMap(base);
    map = new maplibregl.Map({
      container: el,
      style: hoianStyle(location.origin + base, 'vi', theme.mode === 'dark'),
      center: [108.3275, 15.8772],
      zoom: 15.2,
      minZoom: 14,
      maxZoom: 18,
      attributionControl: false
    });
    await new Promise((done) => map.on('load', done));
    hidePois(map);

    map.addSource('heat', { type: 'geojson', data: fc });
    map.addLayer({
      id: 'heat',
      type: 'heatmap',
      source: 'heat',
      paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'count'], 0, 0, maxCount, 1],
        'heatmap-intensity': 1.1,
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 14, 16, 17, 42],
        'heatmap-opacity': 0.75,
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,0,0)',
          0.2, 'rgba(94,154,153,0.6)',
          0.45, 'rgba(224,168,60,0.75)',
          0.7, 'rgba(224,84,44,0.85)',
          1, 'rgba(140,30,20,0.95)'
        ]
      }
    });
    ready = true;
  });

  // Repaint on filter / data change (setData is cheap; weight ramp follows the new max).
  $effect(() => {
    if (!ready) return;
    map.getSource('heat').setData(fc);
    map.setPaintProperty('heat', 'heatmap-weight', [
      'interpolate', ['linear'], ['get', 'count'], 0, 0, maxCount, 1
    ]);
  });
</script>

<div bind:this={el} class="heat" style="height: {height}"></div>

<style>
  .heat {
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--line);
    background: var(--paper);
  }
</style>
