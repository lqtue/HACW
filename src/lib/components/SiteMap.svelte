<script>
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import { BOUNDS, addCategoryPins, hidePois, hoianStyle, loadMap } from '$lib/map-style.js';
  import { createHeadingCone } from '$lib/heading.js';
  import { i18n } from '$lib/i18n.svelte.js';
  import { theme } from '$lib/theme.svelte.js';
  import { s } from '$lib/strings.js';
  import MapControls from './MapControls.svelte';

  // The one map. Everything identical across the picker / discover / nav screens lives
  // here: creation, style, category pins, hidePois, the geolocate control + heading cone,
  // the `sites` symbol layer, an optional route line, MapControls, attribution, teardown.
  // Each screen passes only what differs — its reactive `siteData`, the sites-layer spec,
  // a route, pin-click behaviour, extra layers (via `oninit`), follow/controls, and an
  // overlay `children` snippet. No `if mode` branches — just props.
  let {
    siteData,                 // reactive GeoJSON FeatureCollection for the sites layer
    sitesLayout = {},         // extra layout for the sites symbol layer (merged over defaults)
    sitesPaint = {},          // extra paint for the sites symbol layer
    routeData = null,         // optional GeoJSON Feature (LineString) to draw under the pins
    routePaint = null,        // optional line paint (defaults to a teal dashed line)
    follow = false,           // camera recenters on each fix until the user pans away
    followZoom = 16.5,        // min zoom the follow camera snaps to on each fix
    autoLocate = false,       // trigger geolocation on mount (explicit-navigate screens)
    controls = true,          // show the built-in locate + reset-north MapControls
    controlsTop = '10px',
    attributionPos = 'bottom-right', // 'top-left' where a bottom sheet covers the corner
    interactive = true,
    bearing = 0,
    center = [108.3275, 15.8772],
    zoom = 16,
    fitBounds = null,         // [[w,s],[e,n]] to fit instead of center/zoom
    fitPadding = 40,
    oninit = null,            // (map, maplibregl, { gold, ink }) => void — extra layers/handlers
    onready = null,           // (map, maplibregl) => void — fired once the sites layer is up
    onsiteclick = null,       // (id, feature, e, map, maplibregl) => void
    me = $bindable(null),     // the current GPS fix, readable by the parent (booth bar etc)
    heading = $bindable(null),// live device heading (compass, else GPS course), deg CW from N
    geoErr = $bindable(''),   // last geolocation error message (denied / unavailable)
    children = null           // overlay snippet, called with { me, located, toggleLocate, resetNorth, recenter, following }
  } = $props();

  let el, map, geolocate, cone;
  let locating = $state(false);
  let rotated = $state(false);
  let located = $state(false);
  let following = $state(follow);
  let ready = $state(false);

  export const getMap = () => map; // parents that need the raw map (rare)

  function toggleLocate() {
    if (!ready) return;
    if (!me && !locating) locating = true;
    geolocate.trigger();     // location first
    cone?.enableCompass();   // then compass (iOS 2nd prompt; Android silent)
  }
  function resetNorth() {
    map?.easeTo({ bearing, duration: 400 });
  }
  function recenter() {
    following = true;
    geolocate?.trigger();
  }

  onDestroy(() => {
    cone?.destroy();
    map?.remove();
  });

  let mgl; // the maplibre namespace, kept so click callbacks can build popups
  onMount(async () => {
    const maplibregl = (mgl = await loadMap(base));
    map = new maplibregl.Map({
      container: el,
      style: hoianStyle(location.origin + base, i18n.lang, theme.mode === 'dark'),
      ...(fitBounds ? { bounds: fitBounds, fitBoundsOptions: { padding: fitPadding, maxZoom: 17, bearing } } : { center, zoom, bearing }),
      minZoom: 14,
      maxZoom: 19,
      maxBounds: BOUNDS,
      interactive,
      attributionControl: false
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), attributionPos);
    map.once('idle', () =>
      map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
    );

    map.on('rotate', () => {
      const b = ((map.getBearing() % 360) + 360) % 360;
      rotated = b > 1 && b < 359;
    });
    if (follow) map.on('dragstart', () => (following = false));

    geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
      trackUserLocation: true,
      showAccuracyCircle: false
    });
    map.addControl(geolocate, 'top-left'); // button hidden in CSS; our controls trigger it
    geolocate.on('geolocate', (e) => {
      locating = false;
      located = true;
      geoErr = '';
      me = { lat: e.coords.latitude, lng: e.coords.longitude, accuracy: Math.round(e.coords.accuracy) };
      cone?.onFix(e.coords);
      if (following) map.easeTo({ center: [e.coords.longitude, e.coords.latitude], zoom: Math.max(map.getZoom(), followZoom), duration: 600 });
    });
    geolocate.on('error', (e) => {
      locating = false;
      geoErr = e?.code === 1 ? s('geo_denied') : s('geo_fail');
    });
    geolocate.on('trackuserlocationend', () => { me = null; cone?.hide(); });

    await new Promise((done) => map.on('load', done));
    cone = createHeadingCone(maplibregl, map, (h) => (heading = h));
    const colors = addCategoryPins(map, theme.mode === 'dark');
    hidePois(map);

    if (routeData) {
      const teal = getComputedStyle(document.documentElement).getPropertyValue('--teal').trim() || '#2f7d76';
      map.addSource('route', { type: 'geojson', data: routeData });
      map.addLayer({
        id: 'route-line', type: 'line', source: 'route',
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: routePaint ?? { 'line-color': teal, 'line-width': 5, 'line-opacity': 0.9 }
      });
    }

    // extra layers (booths, landmarks) + custom handlers before the sites layer that should sit on top
    oninit?.(map, maplibregl, colors);

    map.addSource('sites', { type: 'geojson', data: siteData });
    map.addLayer({
      id: 'sites', type: 'symbol', source: 'sites',
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-font': ['Noto Sans Medium'],
        'text-optional': true,
        ...sitesLayout
      },
      paint: { 'icon-opacity': ['coalesce', ['get', 'dim'], 1], ...sitesPaint }
    });

    if (onsiteclick) {
      map.on('click', 'sites', (e) => onsiteclick(e.features[0].properties.id, e.features[0], e, map, mgl));
      map.on('mouseenter', 'sites', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'sites', () => (map.getCanvas().style.cursor = ''));
    }

    ready = true;
    onready?.(map, mgl);
    if (autoLocate) { geolocate.trigger(); cone.enableCompass(); }
  });

  // reactive data pushes (no rebuild)
  $effect(() => { if (ready) map.getSource('sites')?.setData(siteData); });
  $effect(() => { if (ready && routeData) map.getSource('route')?.setData(routeData); });
</script>

<div class="sm-wrap">
  <div bind:this={el} class="sm-map"></div>
  {#if controls}
    <MapControls located={!!me} {locating} {rotated} top={controlsTop} onlocate={toggleLocate} onnorth={resetNorth} />
  {/if}
  {@render children?.({ me, located, following, heading, toggleLocate, resetNorth, recenter, getMap })}
</div>

<style>
  /* fill the positioned parent directly (like the old absolute .map), so the canvas
     is never left with a collapsed percentage height */
  .sm-wrap { position: absolute; inset: 0; }
  .sm-map { position: absolute; inset: 0; }
  :global(.sm-wrap .maplibregl-ctrl-group button.maplibregl-ctrl-geolocate) { display: none; }
</style>
