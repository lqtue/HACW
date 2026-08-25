<script>
  import { onMount, onDestroy, untrack } from 'svelte';
  import { base } from '$app/paths';
  import { BOUNDS, addCategoryPins, hidePois, hoianStyle, loadMap } from '$lib/map-style.js';
  import { createHeadingCone } from '$lib/heading.js';
  import { i18n } from '$lib/i18n.svelte.js';
  import { theme } from '$lib/theme.svelte.js';
  import { s } from '$lib/strings.js';
  import { t } from '$lib/i18n.svelte.js';
  import destinations from '$lib/data/destinations.json';
  import { sitePopup } from '$lib/map-popup.js';
  import MapControls from './MapControls.svelte';

  // The one map. Everything identical across the picker / discover / nav screens lives
  // here: creation, style, category pins, hidePois, the geolocate control + heading cone,
  // the `sites` symbol layer, an optional route line, MapControls, attribution, teardown —
  // and the pin tap itself: sites here sit metres apart, so a tap gathers every pin under
  // a finger (`stack`), opens ONE popup (name, one line, one button) for the first, and
  // the ‹ › pager steps through the rest in place. Each screen passes only what differs —
  // its reactive `siteData`, the sites-layer spec, a route, what the popup's button does
  // (`popupAction`), extra layers (via `oninit`), follow/controls, and an overlay
  // `children` snippet. No `if mode` branches — just props.
  const byId = Object.fromEntries(destinations.map((d) => [d.id, d]));
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
    controlsBottom = null,    // anchor the controls to the bottom-right instead of top
    locateCompass = false,    // Google-Maps locate: center+zoom, tilt to 3D, face heading
    locatePitch = 55,         // pitch used by the compass-locate mode
    attributionPos = 'bottom-right', // 'top-left' where a bottom sheet covers the corner
    interactive = true,
    bearing = 0,
    center = [108.3275, 15.8772],
    zoom = 16,
    fitBounds = null,         // [[w,s],[e,n]] to fit instead of center/zoom
    fitPadding = 40,
    oninit = null,            // (map, maplibregl, { gold, ink }) => void — extra layers/handlers
    onready = null,           // (map, maplibregl) => void — fired once the sites layer is up
    onsiteclick = null,       // (id) => void — a tap goes straight to the caller, no popup (tour nav)
    popupAction = null,       // (dest) => { label, onclick, secondary? } | null — the popup's one button
    onselect = null,          // (id | null) => void — which site the popup shows, null when dismissed
    pagerBottom = '12px',     // where the ‹ › stack pager sits (above the caller's bottom chrome)
    compass = $bindable(false),// true while the Google-Maps 3D heading-up locate is engaged
    me = $bindable(null),     // the current GPS fix, readable by the parent (booth bar etc)
    heading = $bindable(null),// live device heading (compass, else GPS course), deg CW from N
    geoErr = $bindable(''),   // last geolocation error message (denied / unavailable)
    children = null           // overlay snippet, called with { me, located, toggleLocate, resetNorth, recenter, following }
  } = $props();

  let el, map, geolocate, cone;
  let locating = $state(false);
  let rotated = $state(false);
  let located = $state(false);
  let following = $state(untrack(() => follow)); // seed once; drag/recenter drive it after
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
  // Google-Maps locate: tap once → center+zoom, tilt to 3D, rotate to face your heading
  // (the $effect below keeps the bearing on your heading); tap again → back to the flat
  // north-ish plan. Dragging the map exits compass (handled in the dragstart below).
  function locate3d() {
    if (!ready) return;
    if (compass) { // toggle off: flatten, re-aim, and zoom back out to the home frame
      compass = false; following = false;
      if (fitBounds) map?.fitBounds(fitBounds, { padding: fitPadding, maxZoom: 17, bearing, pitch: 0, duration: 500 });
      else map?.easeTo({ center, zoom, pitch: 0, bearing, duration: 500 });
      return;
    }
    compass = true; following = true;
    if (!me && !locating) locating = true;
    geolocate.trigger();
    cone?.enableCompass();
    map?.easeTo({ pitch: locatePitch, zoom: Math.max(map.getZoom(), followZoom), duration: 500 });
  }

  // ---- pin tap: stack + popup + pager ----
  let popup;
  let stack = $state([]);   // destinations under the last tap; > 1 shows the pager
  let stackAt = $state(0);

  function closePopup() {
    popup?.remove(); popup = null;
  }
  function clearStack() {
    closePopup(); stack = []; onselect?.(null);
  }
  // the shared site popup ($lib/map-popup.js); its one button is the screen's popupAction
  // (Explore: see more → site page; Builder: pick/remove)
  function openPopup(d) {
    closePopup();
    popup = sitePopup(mgl, map, d, popupAction?.(d));
    onselect?.(d.id);
  }
  function onPinTap(e) {
    const id = e.features[0].properties.id;
    if (onsiteclick) return onsiteclick(id);
    const { x, y } = e.point;
    const R = 26; // a finger's width — pins on Trần Phú sit closer than that
    const near = map.queryRenderedFeatures([[x - R, y - R], [x + R, y + R]], { layers: ['sites'] });
    stack = [...new Set([id, ...near.map((f) => f.properties.id)])].map((i) => byId[i]).filter(Boolean);
    stackAt = 0;
    openPopup(stack[0]);
  }
  function step(delta) {
    if (!stack.length) return;
    stackAt = (stackAt + delta + stack.length) % stack.length;
    openPopup(stack[stackAt]);
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
    map.on('dragstart', () => { if (follow) following = false; if (compass) { compass = false; following = false; } });

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
      if (following) map.easeTo({ center: [e.coords.longitude, e.coords.latitude], zoom: Math.max(map.getZoom(), followZoom), ...(compass ? { pitch: locatePitch } : {}), duration: 600 });
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

    if (onsiteclick || popupAction) {
      map.on('click', 'sites', onPinTap);
      map.on('mouseenter', 'sites', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'sites', () => (map.getCanvas().style.cursor = ''));
      // tap empty paper → dismiss popup + pager
      if (popupAction) map.on('click', (e) => {
        if (map.queryRenderedFeatures(e.point, { layers: ['sites'] }).length) return;
        clearStack();
      });
    }

    ready = true;
    onready?.(map, mgl);
    if (autoLocate) { geolocate.trigger(); cone.enableCompass(); }
  });

  // compass mode: ease the map bearing toward the device heading, past an 8° change so
  // noisy old-town compass can't spin it (same threshold as the tour-nav heading-up)
  $effect(() => {
    if (!compass || heading == null || !map) return;
    const delta = ((heading - map.getBearing() + 540) % 360) - 180;
    if (Math.abs(delta) > 8) map.easeTo({ bearing: heading, duration: 300 });
  });

  // reactive data pushes (no rebuild)
  $effect(() => { if (ready) map.getSource('sites')?.setData(siteData); });
  $effect(() => { if (ready && routeData) map.getSource('route')?.setData(routeData); });
</script>

<div class="sm-wrap">
  <div bind:this={el} class="sm-map"></div>
  {#if controls}
    <MapControls located={compass || !!me} {locating} {rotated} top={controlsTop} bottom={controlsBottom} onlocate={locateCompass ? locate3d : toggleLocate} onnorth={resetNorth} />
  {/if}
  {@render children?.({ me, located, following, compass, heading, toggleLocate, resetNorth, recenter, locate3d, getMap })}
  {#if stack.length > 1}
    <!-- "1 / N in this area" — overlapping pins page in place instead of clustering -->
    <div class="stack" style="bottom: {pagerBottom}">
      <button class="stack-nav" onclick={() => step(-1)} aria-label={s('prev_site')}>‹</button>
      <span class="stack-label"><b>{stackAt + 1}</b> / {stack.length} · {t(stack[stackAt].name)}</span>
      <button class="stack-nav" onclick={() => step(1)} aria-label={s('next_site')}>›</button>
    </div>
  {/if}
</div>

<style>
  /* fill the positioned parent directly (like the old absolute .map), so the canvas
     is never left with a collapsed percentage height */
  .sm-wrap { position: absolute; inset: 0; }
  .sm-map { position: absolute; inset: 0; }
  :global(.sm-wrap .maplibregl-ctrl-group button.maplibregl-ctrl-geolocate) { display: none; }

  /* stack pager: ink pill, nav-pill width, centred; bottom offset set inline */
  .stack {
    position: absolute; z-index: 8;
    left: 0; right: 0; margin-inline: auto; width: var(--map-topbar-w);
    display: flex; align-items: center; gap: 10px; padding: 6px;
    border-radius: 999px;
    background: var(--brand-dark); color: var(--paper);
    box-shadow: 0 10px 24px -16px rgba(40, 12, 6, 0.9);
  }
  .stack-label {
    flex: 1; min-width: 0; text-align: center;
    font-size: 0.82rem; font-weight: 600;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .stack-label b { color: var(--gold); }
  .stack-nav {
    flex: 0 0 auto; width: 34px; height: 34px;
    border: 0; border-radius: 50%;
    background: var(--paper); color: var(--brand-dark);
    font-size: 1.2rem; line-height: 1; cursor: pointer;
  }
  /* popup look: .map-pop* in app.css (shared with RouteMap) */
</style>
