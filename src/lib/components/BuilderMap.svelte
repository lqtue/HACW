<script>
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import destinations from '$lib/data/destinations.json';
  import categories from '$lib/data/categories.json';
  import { BOUNDS, PIN_DPR, hidePois, hoianStyle, loadMap, pinImage } from '$lib/map-style.js';
  import { optimizeRoute } from '$lib/route.js';
  import { t, i18n } from '$lib/i18n.svelte.js';
  import { theme } from '$lib/theme.svelte.js';

  // A selection map for the 1+1+3 builder. The current step's eligible sites are
  // full-strength; picked sites wear the gold rim + a walk-order number and are joined
  // by a dashed route line; everything else dims back. Tapping an eligible pin picks it,
  // tapping a picked pin drops it. catFilter dims the free pool to match the list filter.
  let { eligible = [], picked = [], catFilter = null, onpick } = $props();

  const byId = Object.fromEntries(destinations.map((d) => [d.id, d]));
  const eligibleSet = $derived(new Set(eligible));
  const pickedSet = $derived(new Set(picked));
  const BEARING = 0; // north up (true north)

  // picks joined in shortest-walk order → the route line + the 1..5 numbers on the pins
  const orderedPicks = $derived(optimizeRoute(picked.map((id) => byId[id]).filter(Boolean)));
  const numById = $derived(Object.fromEntries(orderedPicks.map((d, i) => [d.id, i + 1])));
  const routeData = $derived({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: orderedPicks.map((d) => [d.lng, d.lat]) }
  });

  const siteData = $derived({
    type: 'FeatureCollection',
    features: destinations.map((d) => {
      const on = pickedSet.has(d.id);
      const usable = on || eligibleSet.has(d.id);
      const matches = !catFilter || d.category === catFilter;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
        properties: {
          id: d.id,
          icon: `pin-${d.category}${on ? '-spot' : ''}`,
          label: on ? String(numById[d.id] ?? '') : t(d.name),
          sel: on,
          dim: usable ? (matches ? 1 : 0.4) : 0.25
        }
      };
    })
  });

  let el;
  let map;
  let ready = $state(false);

  onMount(async () => {
    const maplibregl = await loadMap(base);
    map = new maplibregl.Map({
      container: el,
      style: hoianStyle(location.origin + base, i18n.lang, theme.mode === 'dark'),
      center: [108.3275, 15.8772],
      zoom: 15.5,
      bearing: BEARING,
      minZoom: 14,
      maxZoom: 18,
      maxBounds: BOUNDS,
      attributionControl: false
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
    // opt-in location dot — helps place picks relative to where you stand
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showAccuracyCircle: true
      }),
      'top-left'
    );

    await new Promise((done) => map.on('load', done));

    const css = getComputedStyle(document.documentElement);
    const gold = css.getPropertyValue('--gold').trim() || '#e0a83c';
    // dark keyline on the light basemap, light on the dark one; pupil stays dark.
    const ink = theme.mode === 'dark' ? '#efe6d6' : '#1c1917';
    const eye = '#1c1917';
    for (const c of categories) {
      const color = css.getPropertyValue(`--c-${c.id}`).trim() || '#bb4b2c';
      map.addImage(`pin-${c.id}`, pinImage(color, ink, undefined, eye), { pixelRatio: PIN_DPR });
      map.addImage(`pin-${c.id}-spot`, pinImage(color, ink, gold, eye), { pixelRatio: PIN_DPR });
    }
    hidePois(map);

    // dashed walk-order route through the picks — drawn under the pins
    const brand = css.getPropertyValue('--brand').trim() || '#e0542c';
    map.addSource('route', { type: 'geojson', data: routeData });
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': brand, 'line-width': 3, 'line-dasharray': [1.6, 1.4], 'line-opacity': 0.9 }
    });

    map.addSource('sites', { type: 'geojson', data: siteData });
    map.addLayer({
      id: 'sites',
      type: 'symbol',
      source: 'sites',
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14, ['case', ['get', 'sel'], 0.8, 0.55],
          16, ['case', ['get', 'sel'], 1.15, 0.8],
          18, ['case', ['get', 'sel'], 1.35, 0.95]
        ],
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Medium'],
        'text-size': ['case', ['get', 'sel'], 15, 11],
        'text-anchor': 'top',
        'text-offset': [0, 1.4],
        'text-optional': true,
        'text-max-width': 8
      },
      paint: {
        'icon-opacity': ['coalesce', ['get', 'dim'], 1],
        'text-color': ['case', ['get', 'sel'], brand, '#1c1917'],
        'text-halo-color': '#fff7ef',
        'text-halo-width': ['case', ['get', 'sel'], 2, 1.6],
        // label every usable pin (dim ≥ 0.4); context pins (0.25) stay unlabelled.
        // No zoom gate any more — the folded overview needs names to be readable.
        'text-opacity': ['case', ['>=', ['coalesce', ['get', 'dim'], 1], 0.4], 1, 0]
      }
    });

    map.on('click', 'sites', (e) => {
      const id = e.features[0].properties.id;
      // only eligible or already-picked pins respond; others are dimmed context
      if (eligibleSet.has(id) || pickedSet.has(id)) onpick?.(id);
    });
    map.on('mouseenter', 'sites', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'sites', () => (map.getCanvas().style.cursor = ''));

    map.fitBounds(
      destinations.reduce(
        (b, d) => [
          [Math.min(b[0][0], d.lng), Math.min(b[0][1], d.lat)],
          [Math.max(b[1][0], d.lng), Math.max(b[1][1], d.lat)]
        ],
        [[180, 90], [-180, -90]]
      ),
      { padding: 34, bearing: BEARING, animate: false }
    );
    ready = true;
  });

  onDestroy(() => map?.remove());

  // eligible/picked/filter changes are one setData each, not a rebuild
  $effect(() => {
    if (!ready) return;
    map.getSource('sites').setData(siteData);
    map.getSource('route').setData(routeData);
  });
</script>

<div bind:this={el} class="bmap"></div>

<style>
  .bmap {
    width: 100%;
    height: 100%;
    border-radius: 16px;
    overflow: hidden;
    background: var(--paper);
    border: 1px solid var(--line);
  }
  :global(.bmap .maplibregl-map) { font-family: var(--font-body); }
</style>
