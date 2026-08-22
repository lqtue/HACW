<script>
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import destinations from '$lib/data/destinations.json';
  import { BOUNDS, addCategoryPins, hidePois, hoianStyle, loadMap } from '$lib/map-style.js';
  import { stitchRoute } from '$lib/route.js';
  import { createHeadingCone } from '$lib/heading.js';
  import { t, i18n } from '$lib/i18n.svelte.js';
  import { theme } from '$lib/theme.svelte.js';
  import { s } from '$lib/strings.js';

  // Tour "focus / follow" mode — a walking-navigation feel WITHOUT turn-by-turn (old-town
  // GPS is too noisy for step directions; the route + a following you-dot is the honest 80%).
  // The tour's stops are bright + numbered + joined by the route line; every other site
  // dims back but stays visible so you still know what's around you. The camera follows
  // your position (north-up; the heading cone shows which way you face).
  /** @type {{ stops: any[], title?: any, onclose: () => void }} */
  let { stops, title, onclose } = $props();

  const stopIds = new Set(stops.map((d) => d.id));
  const numById = Object.fromEntries(stops.map((d, i) => [d.id, i + 1]));

  let el;
  let map;
  let geolocate;
  let cone;
  let following = $state(true); // recenter on each fix until the user pans away
  let located = $state(false);

  const routeData = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: stitchRoute(stops) }
  };
  const siteData = {
    type: 'FeatureCollection',
    features: destinations.map((d) => {
      const on = stopIds.has(d.id);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
        properties: {
          id: d.id,
          icon: `pin-${d.category}${on ? '-spot' : ''}`,
          label: on ? String(numById[d.id]) : '',
          on,
          dim: on ? 1 : 0.28 // others stay visible, just quiet
        }
      };
    })
  };

  onDestroy(() => {
    cone?.destroy();
    map?.remove();
  });

  onMount(async () => {
    const maplibregl = await loadMap(base);
    const line = routeData.geometry.coordinates;
    const bounds = line.reduce(
      (b, [lng, lat]) => [
        [Math.min(b[0][0], lng), Math.min(b[0][1], lat)],
        [Math.max(b[1][0], lng), Math.max(b[1][1], lat)]
      ],
      [[180, 90], [-180, -90]]
    );

    map = new maplibregl.Map({
      container: el,
      style: hoianStyle(location.origin + base, i18n.lang, theme.mode === 'dark'),
      bounds,
      fitBoundsOptions: { padding: 60, maxZoom: 17 },
      minZoom: 14,
      maxZoom: 19,
      maxBounds: BOUNDS,
      attributionControl: false
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.once('idle', () =>
      map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
    );

    // a manual pan/zoom drops follow; the recenter button turns it back on
    map.on('dragstart', () => (following = false));

    geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
      trackUserLocation: true,
      showAccuracyCircle: false
    });
    map.addControl(geolocate, 'top-left'); // button hidden via CSS
    geolocate.on('geolocate', (e) => {
      located = true;
      cone?.onFix(e.coords);
      if (following) map.easeTo({ center: [e.coords.longitude, e.coords.latitude], zoom: Math.max(map.getZoom(), 16.5), duration: 600 });
    });

    await new Promise((done) => map.on('load', done));
    cone = createHeadingCone(maplibregl, map);
    const { ink } = addCategoryPins(map, theme.mode === 'dark');
    hidePois(map);

    const css = getComputedStyle(document.documentElement);
    const teal = css.getPropertyValue('--teal').trim() || '#2f7d76';

    map.addSource('route', { type: 'geojson', data: routeData });
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': teal, 'line-width': 5, 'line-opacity': 0.9 }
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
        'icon-size': ['case', ['get', 'on'], 1.1, 0.7],
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Medium'],
        'text-size': 14,
        'text-offset': [0, 1.4],
        'text-optional': true
      },
      paint: {
        'icon-opacity': ['coalesce', ['get', 'dim'], 1],
        'text-color': ink,
        'text-halo-color': theme.mode === 'dark' ? '#241a16' : '#fff7ef',
        'text-halo-width': 2
      }
    });

    // tap a pin -> its check-in page (the stops are why you're here)
    map.on('click', 'sites', (e) => goto(`${base}/destinations/${e.features[0].properties.id}`));
    map.on('mouseenter', 'sites', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'sites', () => (map.getCanvas().style.cursor = ''));

    // this IS an explicit navigate action, so ask for location on entry (clear reason)
    geolocate.trigger();
    cone.enableCompass();
  });

  function recenter() {
    following = true;
    geolocate?.trigger();
  }
</script>

<div class="tournav">
  <div bind:this={el} class="tn-map"></div>

  <div class="tn-bar">
    <button class="tn-btn" onclick={onclose} aria-label={s('nav_close')}>✕</button>
    <span class="tn-title">{t(title)}</span>
  </div>

  <button class="tn-recenter" class:on={following && located} onclick={recenter} aria-label={s('locate_me')} title={s('locate_me')}>
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <line x1="12" y1="2" x2="12" y2="5" stroke-linecap="round" /><line x1="12" y1="19" x2="12" y2="22" stroke-linecap="round" />
      <line x1="2" y1="12" x2="5" y2="12" stroke-linecap="round" /><line x1="19" y1="12" x2="22" y2="12" stroke-linecap="round" />
    </svg>
  </button>
</div>

<style>
  .tournav { position: fixed; inset: 0; z-index: 2000; background: var(--paper); }
  .tn-map { position: absolute; inset: 0; }
  .tn-bar {
    position: absolute; z-index: 5;
    top: calc(env(safe-area-inset-top) + 12px); left: 12px; right: 12px;
    display: flex; align-items: center; gap: 10px;
  }
  .tn-btn, .tn-recenter {
    width: 44px; height: 44px; flex: 0 0 auto;
    display: grid; place-items: center; cursor: pointer;
    border-radius: 12px; border: 0; color: var(--ink);
    background: var(--surface); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    font-size: 1.1rem; font-weight: 700;
  }
  .tn-title {
    font-weight: 800; color: var(--brand-dark); font-size: 1rem;
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    padding: 8px 14px; border-radius: 999px; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .tn-recenter {
    position: absolute; z-index: 5;
    right: 14px; bottom: calc(env(safe-area-inset-bottom) + 22px);
    color: var(--muted);
  }
  .tn-recenter.on { color: var(--brand); }
  .tn-recenter:focus-visible, .tn-btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  :global(.tournav .maplibregl-ctrl-group button.maplibregl-ctrl-geolocate) { display: none; }
</style>
