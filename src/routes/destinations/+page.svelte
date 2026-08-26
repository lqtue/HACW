<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto, afterNavigate } from '$app/navigation';
  import { base } from '$app/paths';
  import destinations from '$lib/data/destinations.json';
  import categories from '$lib/data/categories.json';
  import tickets from '$lib/data/ticket-points.json';
  import Card from '$lib/components/Card.svelte';
  import ViewToggle from '$lib/components/ViewToggle.svelte';
  import ChipRow from '$lib/components/ChipRow.svelte';
  import SiteMap from '$lib/components/SiteMap.svelte';
  import { addLandmarks } from '$lib/landmarks.js';
  import { categoryLabel, mapsUrl, openLabel } from '$lib/util.js';
  import { hasStamp } from '$lib/passport.svelte.js';
  import { stats } from '$lib/stats.svelte.js';
  import { spotlightIds } from '$lib/score.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';
  import { theme } from '$lib/theme.svelte.js';
  import { recordCell } from '$lib/research.svelte.js';
  import { ui } from '$lib/ui.svelte.js';

  let active = $state('all');
  let view = $state('map'); // 'map' | 'list' — Explore offers both, like the picker
  // 'open' and 'tickets' are just other values of `active` (one-click, mutually
  // exclusive with the categories) — not separate on/off toggles
  const showTickets = $derived(active === 'tickets');
  // "where to buy?" opens the map as a pure counter-finder: booths only, the 25
  // site pins + their filters/carousel hidden until the visitor asks for them.
  let boothsOnly = $state(false);
  let selected = $state(null); // pin tapped -> highlight its card below

  // Location lives in SiteMap now; bound here so the booth bar + geo-error banner
  // can read the fix. Requested only when the visitor taps locate.
  let me = $state(null); // { lat, lng, accuracy } once a fix arrives
  let geoErr = $state('');
  let compass = $state(false); // 3D heading-up locate active → hide the map chrome

  // Research footfall: recordCell (shared with check-in, in research.svelte.js) buckets
  // the fix into a coarse cell and counts it when consent is on. Called from the geolocate
  // handler below. Consent lives in onboarding + the passport page, not on this map.

  // Sites open right now. Recomputed on filter changes only — good enough for a
  // walk-around app; nobody stares at this screen across an opening time.
  const isOpen = (d) => openLabel(d)?.status !== 'closed';
  const shown = $derived(
    destinations.filter((d) =>
      active === 'open' ? isOpen(d) : active === 'all' || active === 'tickets' || d.category === active
    )
  );
  const spotlight = $derived(spotlightIds(stats.counts, destinations));

  // The sites layer is data-driven, so filters / spotlight / opening hours are
  // one GeoJSON rebuild rather than 25 marker mutations. Everything reactive the
  // map needs to know lives in these properties.
  const siteData = $derived({
    type: 'FeatureCollection',
    features: shown.map((d) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
      properties: {
        id: d.id,
        icon: `pin-${d.category}${spotlight.has(d.id) ? '-spot' : ''}`,
        label: t(d.name),
        spot: spotlight.has(d.id),
        sel: selected === d.id,
        done: hasStamp(d.id), // already checked in → ✓ badge
        // closed right now -> faded pin, still tappable
        dim: openLabel(d)?.status === 'closed' ? 0.45 : 1
      }
    }))
  });

  const byId = new Map(destinations.map((d) => [d.id, d]));
  // open framed on all 25 pins, like before
  const allBounds = destinations.reduce(
    (b, d) => [
      [Math.min(b[0][0], d.lng), Math.min(b[0][1], d.lat)],
      [Math.max(b[1][0], d.lng), Math.max(b[1][1], d.lat)]
    ],
    [[180, 90], [-180, -90]]
  );

  let ready = $state(false); // the layer-visibility effects wait for the layers
  let dmap; // the map itself, kept for the booth/sites visibility effects below

  // SiteMap owns the pin tap (stack, popup, pager); this screen just says what the
  // popup's button does and mirrors the shown site onto the list card.
  const seeMore = (d) => ({ label: s('popup_detail'), onclick: () => goto(`${base}/destinations/${d.id}?from=map`) });
  function onSelect(id) {
    selected = id;
    if (id) document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // Extra layers SiteMap doesn't own: the ticket-counter dots and the landmark
  // drawings. Runs before the sites layer, so both sit under the pins. The counters
  // are plain markers — where to buy, nothing to tap.
  function onInit(map, mgl, { gold, ink }) {
    dmap = map;
    map.addSource('booths', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: tickets.map((p) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: {}
        }))
      }
    });
    map.addLayer({
      id: 'booths', type: 'circle', source: 'booths',
      layout: { visibility: 'none' },
      paint: { 'circle-radius': 6, 'circle-color': gold, 'circle-stroke-width': 0 }
    });
    addLandmarks(map, byId, { ink, fill: '#fdf6e8' });
  }

  // ✓ badge on already-checked-in pins — its own symbol layer off the sites source,
  // so it updates with the same setData and shows at every zoom
  function onReady(map) {
    ready = true;
    map.addLayer({
      id: 'sites-check', type: 'symbol', source: 'sites',
      filter: ['==', ['get', 'done'], true],
      layout: {
        'text-field': '✓', 'text-font': ['Noto Sans Medium'], 'text-size': 12,
        'text-offset': [0.85, -0.9], 'text-allow-overlap': true, 'text-ignore-placement': true
      },
      paint: { 'text-color': '#fff', 'text-halo-color': '#2f7d76', 'text-halo-width': 2.6 }
    });
  }

  // "Mua vé ở đâu?" opens this map as a counter-finder from somewhere else (the gift
  // screen, the scan step). The one chip there is the way back: to wherever they came
  // from in the app, or — on a cold deep link, where there is nowhere to go back to —
  // to the ordinary map of all 25 sites.
  let cameFromApp = false;
  afterNavigate((nav) => (cameFromApp = nav.from != null));
  function leaveBooths() {
    if (cameFromApp) history.back();
    else boothsOnly = false;
  }
  // counter-finder mode is a single-job screen reached from somewhere else — its own
  // back chip is the way out, so the tab bar would only offer a way to lose the thread
  $effect(() => { ui.hideNav = boothsOnly; });
  onDestroy(() => { ui.hideNav = false; });

  onMount(() => {
    const q = new URLSearchParams(location.search);
    // ?tickets=1 — arriving from "where to buy?": counters on, sites hidden
    if (q.get('tickets') === '1') boothsOnly = true;
    // ?view=list — returning from a site opened while in list view
    if (q.get('view') === 'list') view = 'list';
  });

  // SiteMap pushes the sites *data*; these log footfall + toggle layer visibility.
  $effect(() => { if (me) recordCell(me); });
  $effect(() => { if (ready) dmap.setLayoutProperty('booths', 'visibility', showTickets || boothsOnly ? 'visible' : 'none'); });
  // showing the counters dims the 25 site pins so the gold booths read
  $effect(() => { if (ready) dmap.setPaintProperty('sites', 'icon-opacity', showTickets ? 0.2 : ['coalesce', ['get', 'dim'], 1]); });
  $effect(() => { if (ready) dmap.setLayoutProperty('sites', 'visibility', boothsOnly ? 'none' : 'visible'); });

</script>

<div class="explore">
  <h1 class="sr-only">{s('explore')}</h1>

  <!-- category filter, shared by the map sheet and the list view -->
  {#snippet catChips()}
    <button class="chip" aria-pressed={active === 'all'} onclick={() => (active = 'all')}>{s('all')}</button>
    {#each categories as c}
      <button class="chip cat" style="--c: var(--c-{c.id})" aria-pressed={active === c.id} onclick={() => (active = c.id)}>
        <i class="sw" aria-hidden="true"></i>{t(c.label)}
      </button>
    {/each}
    <button class="chip" aria-pressed={active === 'open'} onclick={() => (active = 'open')}>{s('open_now')}</button>
  {/snippet}

  <div class="wrap" class:booths={boothsOnly}>
    <SiteMap
      {siteData}
      bind:me
      bind:geoErr
      bind:compass
      fitBounds={allBounds}
      fitPadding={40}
      controls={boothsOnly || view === 'map'}
      controlsBottom={boothsOnly
        ? 'calc(env(safe-area-inset-bottom) + 16px)'
        : 'calc(env(safe-area-inset-bottom) + 88px)'}
      locateCompass
      followZoom={17.5}
      attributionPos="bottom-left"
      sitesLayout={{
        'icon-size': ['interpolate', ['linear'], ['zoom'],
          14, ['case', ['==', ['get', 'sel'], true], 0.82, 0.6],
          16, ['case', ['==', ['get', 'sel'], true], 1.15, 0.85],
          18.5, ['case', ['==', ['get', 'sel'], true], 1.4, 1.05]],
        'text-field': ['get', 'label'],
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 1.5],
        'text-max-width': 8
      }}
      sitesPaint={{
        'text-color': '#1c1917',
        'text-halo-color': '#fff7ef',
        'text-halo-width': 1.6,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 16.2, 0, 16.8, 1]
      }}
      oninit={onInit}
      onready={onReady}
      popupAction={seeMore}
      onselect={onSelect}
      pagerBottom="calc(env(safe-area-inset-bottom) + 80px)"
    />
    <!-- switch + filter bar float top-centre over the full-page map in BOTH modes,
         exactly like the pick last-3 view. Hidden while the 3D locate is engaged so
         the map reads clean, Google-Maps style. -->
    {#if !compass}
    {#if !boothsOnly}
      <div class="float-top pill"><ViewToggle bind:mode={view} /></div>
    {/if}

    <!-- counter-finder mode has no filters: its only control is the docked back link -->
    {#if boothsOnly}
      <div class="dock fixed backdock">
        <button class="btn ghost" onclick={leaveBooths}>{s('back')}</button>
      </div>
    {:else}
      <div class="float-top row2">
        <ChipRow>
          {@render catChips()}
          {#if view === 'map'}
            <button class="chip cat" style="--c: var(--gold)" aria-pressed={active === 'tickets'} onclick={() => (active = 'tickets')}>{s('ticket_points')}</button>
          {/if}
        </ChipRow>
      </div>
    {/if}

    {#if !boothsOnly && view === 'list'}
      <!-- list view: cards scroll under the floating switch/filter; map stays mounted behind -->
      <div class="listview">
        <div class="vlist">
          {#each shown as dest}
            <Card {dest} mark active={selected === dest.id} query="?from=list" />
          {/each}
          {#if shown.length === 0}<p class="muted empty">{s('no_sites')}</p>{/if}
        </div>
      </div>
    {/if}
    {/if}
  </div>
</div>

<style>
  /* full-bleed map: the wrap is the whole screen, the sheet floats over its
     bottom. No topbar band here — the nav already names the tab, so the map
     gets that strip of height back. */
  .explore { flex: 1; display: flex; flex-direction: column; min-height: 0; }
  .wrap { flex: 1; min-height: 0; position: relative; }
  /* keep the ⓘ credit clear of the floating nav pill (bottom-left, above the nav) */
  .wrap :global(.maplibregl-ctrl-bottom-left) { bottom: calc(env(safe-area-inset-bottom) + 80px); }
  /* The way out of the counter map: the same ghost button as "Tải ứng dụng" on the
     welcome screen. Only two changes, both because it floats on a map rather than
     sitting in a page footer — it stops short of the credit and locate controls in the
     bottom corners, and it carries a shadow to lift it off the basemap. */
  .backdock { z-index: 630; bottom: calc(18px + env(safe-area-inset-bottom)); }
  .backdock .btn.ghost {
    width: auto;
    margin: 0 auto;
    box-shadow: var(--shadow);
  }
  /* counter-finder mode has no tab bar, so the credit drops to the bottom edge too */
  .wrap.booths :global(.maplibregl-ctrl-bottom-left) { bottom: calc(env(safe-area-inset-bottom) + 18px); }

  /* list|map toggle, floating top-centre over the map */
  /* switch + filter share --map-topbar-w (nav-pill width) and centre — edit the token */
  /* the switch + filter row are the global .float-top / .float-top.row2 (app.css) */
  /* list view: full-height panel over the (still-mounted) map, scrolling under the
     floating switch + filter row */
  .listview {
    position: absolute; inset: 0; z-index: 610;
    background: var(--bg); overflow-y: auto;
    padding: calc(env(safe-area-inset-top) + 112px) var(--gutter) calc(90px + env(safe-area-inset-bottom));
    display: flex; flex-direction: column; gap: 12px;
  }
  .vlist { display: flex; flex-direction: column; gap: 10px; }

  .sr-only {
    position: absolute; width: 1px; height: 1px;
    padding: 0; margin: -1px; overflow: hidden;
    clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }

  /* pin tap → popup + stack pager: SiteMap owns them (one look on every map) */

  /* live position: MapLibre's own dot + accuracy circle, in the teal that says
     "you", deliberately unlike the category pins. Its button is hidden — the
     📍 chip in the sheet triggers the control.
     MapLibre's stylesheet is imported at runtime, i.e. *after* these rules, so
     every override here has to out-specify it, not just follow it. */
  :global(.maplibregl-ctrl-group button.maplibregl-ctrl-geolocate) { display: none; }
  /* user-location dot tint is global now (app.css), shared with the builder map */

  /* pins and the paper palette are drawn by the map itself now — the basemap is
     our own vector style (src/lib/map-style.js), the pins are canvas images, so
     there is no raster tint and no marker DOM left to style here. */
</style>
