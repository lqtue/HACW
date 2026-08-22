<script>
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import destinations from '$lib/data/destinations.json';
  import { BOUNDS, addCategoryPins, hidePois, hoianStyle, loadMap } from '$lib/map-style.js';
  import { optimizeRoute, stitchRoute } from '$lib/route.js';
  import { t, i18n } from '$lib/i18n.svelte.js';
  import { theme } from '$lib/theme.svelte.js';
  import { categoryLabel } from '$lib/util.js';
  import { s } from '$lib/strings.js';
  import MapControls from './MapControls.svelte';
  import { createHeadingCone } from '$lib/heading.js';

  // Content goes into a popup via textContent (not innerHTML), so authored names
  // can't inject — no escaping needed for those. The category label is the only
  // interpolated-into-markup value; it's from our own categories.json.
  const clamp = (str, n = 90) => (str.length > n ? str.slice(0, n - 1).trimEnd() + '…' : str);

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
    // real walking streets where baked (src/lib/data/legs.js), straight legs otherwise
    geometry: { type: 'LineString', coordinates: stitchRoute(orderedPicks) }
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
  let geolocate;
  let cone;
  let ready = $state(false);
  let me = $state(null); // just drives the 📍 chip pressed state; the control draws the dot
  let locating = $state(false);
  let rotated = $state(false); // twisted off north -> reveal the reset chip

  function toggleLocate() {
    if (!ready) return;
    cone?.enableCompass(); // this tap is the user gesture iOS needs for the compass
    if (!me && !locating) locating = true;
    geolocate.trigger(); // toggles: a second tap switches tracking off
  }
  function resetNorth() {
    map?.easeTo({ bearing: BEARING, duration: 400 });
  }

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
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    // start collapsed to just the ⓘ puck (maplibre renders it open on wide maps)
    map.once('idle', () =>
      map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
    );

    // twist off north -> reveal the reset chip (opens north-up)
    map.on('rotate', () => {
      const b = ((map.getBearing() % 360) + 360) % 360;
      rotated = b > 1 && b < 359;
    });

    // location dot behind the 📍 chip — the raw control button is hidden (see CSS),
    // the chip triggers it. Matches the discover map's affordance.
    geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: false
    });
    map.addControl(geolocate, 'top-left'); // button hidden; the 📍 button triggers it
    geolocate.on('geolocate', (e) => {
      locating = false;
      me = { lat: e.coords.latitude, lng: e.coords.longitude };
      cone?.onFix(e.coords);
    });
    geolocate.on('error', () => (locating = false));
    geolocate.on('trackuserlocationend', () => {
      me = null;
      cone?.hide();
    });

    await new Promise((done) => map.on('load', done));
    cone = createHeadingCone(maplibregl, map);

    // per-category pins (plain + gold spotlight), shared with the discover map
    addCategoryPins(map, theme.mode === 'dark');
    hidePois(map);

    // dashed walk-order route through the picks — drawn under the pins
    const brand = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#e0542c';
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

    // Tapping a pin opens a paper-label popup with the site's info; picking is the
    // explicit button inside it (Add, or Remove if already in the set). Context pins
    // (wrong type this step) still show their info — just no button.
    const popup = new maplibregl.Popup({ offset: [0, -22], closeButton: true, maxWidth: '240px', className: 'bpop-wrap' });
    map.on('click', 'sites', (e) => {
      const d = byId[e.features[0].properties.id];
      if (!d) return;
      const picked = pickedSet.has(d.id);
      const canPick = picked || eligibleSet.has(d.id);

      const node = document.createElement('div');
      node.className = 'bpop';
      const cat = document.createElement('span');
      cat.className = 'bpop-cat';
      cat.style.color = `var(--c-${d.category})`;
      cat.textContent = t(categoryLabel(d.category));
      const title = document.createElement('strong');
      title.textContent = t(d.name);
      const sum = document.createElement('p');
      sum.className = 'bpop-sum';
      sum.textContent = clamp(t(d.description) || '');
      node.append(cat, title, sum);

      if (canPick) {
        const btn = document.createElement('button');
        btn.className = 'bpop-btn' + (picked ? ' rm' : '');
        btn.textContent = picked ? s('pick_remove') : s('pick_do');
        btn.addEventListener('click', () => { onpick?.(d.id); popup.remove(); });
        node.append(btn);
      }
      popup.setLngLat([d.lng, d.lat]).setDOMContent(node).addTo(map);
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

  onDestroy(() => {
    cone?.destroy();
    map?.remove();
  });

  // eligible/picked/filter changes are one setData each, not a rebuild
  $effect(() => {
    if (!ready) return;
    map.getSource('sites').setData(siteData);
    map.getSource('route').setData(routeData);
  });
</script>

<div class="bmap-wrap">
  <div bind:this={el} class="bmap"></div>
  <MapControls located={!!me} {locating} {rotated} onlocate={toggleLocate} onnorth={resetNorth} />
</div>

<style>
  .bmap-wrap { position: relative; width: 100%; height: 100%; }
  /* hide MapLibre's own geolocate button — MapControls' locate button triggers it */
  :global(.bmap-wrap .maplibregl-ctrl-group button.maplibregl-ctrl-geolocate) { display: none; }

  .bmap {
    width: 100%;
    height: 100%;
    border-radius: 16px;
    overflow: hidden;
    background: var(--paper);
    border: 1px solid var(--line);
  }
  :global(.bmap .maplibregl-map) { font-family: var(--font-body); }

  /* selection popup — a small paper label. Portaled by MapLibre, so global. */
  :global(.bpop-wrap .maplibregl-popup-content) {
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
    font-family: var(--font-body);
  }
  :global(.bpop-wrap .maplibregl-popup-tip) { border-top-color: var(--surface); }
  :global(.bpop) { display: flex; flex-direction: column; gap: 4px; }
  :global(.bpop-cat) {
    font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  }
  :global(.bpop strong) { color: var(--brand-dark); font-size: 0.98rem; line-height: 1.2; }
  :global(.bpop-sum) { margin: 0; color: var(--muted); font-size: 0.82rem; line-height: 1.35; }
  :global(.bpop-btn) {
    margin-top: 8px;
    padding: 9px 12px;
    border: 0; border-radius: 9px;
    background: var(--brand); color: #fff;
    font-family: var(--font-body); font-weight: 700; font-size: 0.88rem;
    cursor: pointer;
  }
  :global(.bpop-btn.rm) { background: var(--surface); color: var(--brand); border: 1px solid var(--brand); }
</style>
