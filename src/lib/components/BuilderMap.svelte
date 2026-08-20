<script>
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import destinations from '$lib/data/destinations.json';
  import categories from '$lib/data/categories.json';
  import { BOUNDS, PIN_DPR, hidePois, hoianStyle, loadMap, pinImage, principalBearing } from '$lib/map-style.js';
  import { t, i18n } from '$lib/i18n.svelte.js';

  // A selection map for the 1+1+3 builder. The current step's eligible sites are
  // full-strength; picked sites wear the gold rim (= "on your ticket"); everything
  // else dims back. Tapping an eligible pin picks it, tapping a picked pin drops it.
  // Reuses the destinations-map pipeline (map-style.js) minus popups/pager/booths —
  // the ranked list beside it carries the detail. Flat printed plan, no popups.
  let { eligible = [], picked = [], onpick } = $props();

  const eligibleSet = $derived(new Set(eligible));
  const pickedSet = $derived(new Set(picked));
  const BEARING = principalBearing(destinations);

  const siteData = $derived({
    type: 'FeatureCollection',
    features: destinations.map((d) => {
      const on = pickedSet.has(d.id);
      const usable = on || eligibleSet.has(d.id);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
        properties: {
          id: d.id,
          icon: `pin-${d.category}${on ? '-spot' : ''}`,
          label: t(d.name),
          sel: on,
          dim: usable ? 1 : 0.25
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
      style: hoianStyle(location.origin + base, i18n.lang),
      center: [108.3275, 15.8772],
      zoom: 15.5,
      bearing: BEARING,
      minZoom: 14,
      maxZoom: 18,
      maxBounds: BOUNDS,
      attributionControl: false
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');

    await new Promise((done) => map.on('load', done));

    const css = getComputedStyle(document.documentElement);
    const gold = css.getPropertyValue('--gold').trim() || '#e0a83c';
    const ink = '#1c1917'; // dark keyline for pins on the light basemap
    for (const c of categories) {
      const color = css.getPropertyValue(`--c-${c.id}`).trim() || '#bb4b2c';
      map.addImage(`pin-${c.id}`, pinImage(color, ink), { pixelRatio: PIN_DPR });
      map.addImage(`pin-${c.id}-spot`, pinImage(color, ink, gold), { pixelRatio: PIN_DPR });
    }
    hidePois(map);

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
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 1.5],
        'text-optional': true,
        'text-max-width': 8
      },
      paint: {
        'icon-opacity': ['coalesce', ['get', 'dim'], 1],
        'text-color': '#1c1917',
        'text-halo-color': '#fff7ef',
        'text-halo-width': 1.6,
        'text-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          16.2, 0,
          16.8, ['case', ['>=', ['coalesce', ['get', 'dim'], 1], 1], 1, 0]
        ]
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

  // eligible/picked changes are one setData, not a rebuild
  $effect(() => {
    if (ready) map.getSource('sites').setData(siteData);
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
