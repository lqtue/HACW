<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import destinations from '$lib/data/destinations.json';
  import categories from '$lib/data/categories.json';
  import tickets from '$lib/data/ticket-points.json';
  import Card from '$lib/components/Card.svelte';
  import ViewToggle from '$lib/components/ViewToggle.svelte';
  import SiteMap from '$lib/components/SiteMap.svelte';
  import { markSvg } from '$lib/map-style.js';
  import { addLandmarks } from '$lib/landmarks.js';
  import { categoryLabel, mapsUrl, openLabel } from '$lib/util.js';
  import { nearest } from '$lib/geo.js';
  import { formatDistance } from '$lib/route.js';
  import { hasStamp } from '$lib/passport.svelte.js';
  import { stats } from '$lib/stats.svelte.js';
  import { spotlightIds } from '$lib/score.js';
  import { t, i18n } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';
  import { theme } from '$lib/theme.svelte.js';
  import { recordCell } from '$lib/research.svelte.js';

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
  const booth = $derived(me ? nearest(me, tickets) : null);

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

  // Popup is built on open, so language / stamp / spotlight are always current.
  // It is a label on a printed map, not a card: the site's own mark, its name,
  // two rows of facts under hairline keys, and one obvious thing to do.
  // Content fields go into raw HTML strings (setHTML), so a stray `<` in an
  // authored name/address would break or inject. Escape at the sink.
  const esc = (v) =>
    String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function popupHtml(d) {
    const open = openLabel(d);
    const badges = [
      spotlight.has(d.id) ? `<span class="ptag gold">${s('spotlight')}</span>` : '',
      hasStamp(d.id) ? `<span class="ptag done">${s('stamped')}</span>` : ''
    ]
      .filter(Boolean)
      .join('');
    return `<div class="pop">
      <div class="pop-head">
        <span class="pop-mark">${markSvg(`var(--c-${d.category})`, 'var(--brand-dark)', 30)}</span>
        <span class="pop-title">
          <span class="pop-cat" style="color: var(--c-${d.category})">${esc(t(categoryLabel(d.category)))}</span>
          <strong>${esc(t(d.name))}</strong>
        </span>
      </div>
      ${d.short ? `<p class="pop-snip">${esc(t(d.short))}</p>` : ''}
      <dl class="pop-meta">
        <dt>${s('hours_label')}</dt>
        <dd>${esc(t(d.hours))}${open ? ` <em class="${open.status}">${open.text}</em>` : ''}</dd>
        <dt>${s('addr_label')}</dt>
        <dd>${esc(t(d.address))}</dd>
      </dl>
      ${badges ? `<div class="badges">${badges}</div>` : ''}
      <div class="acts">
        <a data-go class="go" href="${base}/destinations/${d.id}?from=map">${s('popup_detail')}</a>
        <a class="dir" href="${mapsUrl(d)}" target="_blank" rel="noopener">${s('popup_dir')}</a>
      </div>
    </div>`;
  }

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

  // Everything under the last tap, and where in it we are. One entry = an
  // ordinary pin tap; more than one = the ‹ › bar appears.
  let stack = $state([]);
  let stackAt = $state(0);
  let popup;
  let dmap, dmgl;            // the map + maplibre namespace, handed over by SiteMap
  let ready = $state(false); // the layer-visibility effects wait for the layers

  function step(delta) {
    stackAt = (stackAt + delta + stack.length) % stack.length;
    openSite(stack[stackAt]);
  }

  // Paper-label popup for a site; the internal link goes through the router (base path).
  function openSite(d) {
    popup?.remove();
    popup = new dmgl.Popup({ offset: [0, -24], closeButton: false, maxWidth: '260px' })
      .setLngLat([d.lng, d.lat]).setHTML(popupHtml(d)).addTo(dmap);
    popup.getElement()?.querySelector('[data-go]')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      goto(`${base}/destinations/${d.id}?from=map`);
    });
    selected = d.id;
    document.getElementById(`card-${d.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // Extra layers + map-level handlers SiteMap doesn't own: the ticket-counter dots, the
  // landmark drawings, tap-empty-paper-to-clear, and the booth popup. Runs before the
  // sites layer, so booths + landmarks sit under the pins.
  function onInit(map, mgl, { gold, ink }) {
    dmap = map;
    dmgl = mgl;
    map.addSource('booths', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: tickets.map((p) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: { html: `<strong>${esc(p.id)}</strong><br>${esc(t(p.where))}` }
        }))
      }
    });
    map.addLayer({
      id: 'booths', type: 'circle', source: 'booths',
      layout: { visibility: 'none' },
      paint: { 'circle-radius': 6, 'circle-color': gold, 'circle-stroke-width': 0 }
    });
    addLandmarks(map, byId, { ink, fill: '#fdf6e8' });

    map.on('click', (e) => {
      if (map.queryRenderedFeatures(e.point, { layers: ['sites', 'booths'] }).length) return;
      popup?.remove();
      popup = null;
      stack = [];
      selected = null;
    });
    map.on('click', 'booths', (e) => {
      new mgl.Popup({ offset: 10, closeButton: false }).setLngLat(e.lngLat).setHTML(e.features[0].properties.html).addTo(map);
    });
    map.on('mouseenter', 'booths', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'booths', () => (map.getCanvas().style.cursor = ''));
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

  // A tap gathers every pin within a finger's width -> the ‹ › pager steps them in place.
  function onSite(id, feature, e, map) {
    const { x, y } = e.point;
    const R = 26;
    const near = map.queryRenderedFeatures([[x - R, y - R], [x + R, y + R]], { layers: ['sites'] });
    const ids = [id, ...new Set(near.map((f) => f.properties.id))];
    stack = [...new Set(ids)].map((i) => byId.get(i)).filter(Boolean);
    stackAt = 0;
    openSite(stack[0]);
  }

  onMount(() => {
    const q = new URLSearchParams(location.search);
    // ?tickets=1 — arriving from "where to buy?": counters on, sites hidden
    if (q.get('tickets') === '1') boothsOnly = true;
    // ?view=list — returning from a site opened while in list view
    if (q.get('view') === 'list') view = 'list';
    addEventListener('resize', filterMoreRefresh);
    return () => removeEventListener('resize', filterMoreRefresh);
  });

  // filter row scroll affordance: ‹ when scrolled right, › while more chips sit off-screen
  let filterEl = $state();
  let filterMore = $state(false);
  let filterLess = $state(false);
  function filterMoreRefresh() {
    if (!filterEl) { filterMore = filterLess = false; return; }
    filterLess = filterEl.scrollLeft > 4;
    filterMore = filterEl.scrollLeft + filterEl.clientWidth < filterEl.scrollWidth - 4;
  }
  // recompute when the chip set changes (tickets chip, booths mode) or on first mount
  $effect(() => { active; view; showTickets; boothsOnly; if (filterEl) filterMoreRefresh(); });

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
    <button class="chip" aria-pressed={active === 'open'} onclick={() => (active = 'open')}>{s('filter_open')}</button>
  {/snippet}

  <div class="wrap">
    <SiteMap
      {siteData}
      bind:me
      bind:geoErr
      bind:compass
      fitBounds={allBounds}
      fitPadding={40}
      controls={boothsOnly || view === 'map'}
      controlsBottom="calc(env(safe-area-inset-bottom) + 88px)"
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
      onsiteclick={onSite}
    />
    <!-- switch + filter bar float top-centre over the full-page map in BOTH modes,
         exactly like the pick last-3 view. Hidden while the 3D locate is engaged so
         the map reads clean, Google-Maps style. -->
    {#if !compass}
    {#if !boothsOnly}
      <div class="view-fab"><ViewToggle bind:mode={view} /></div>
    {/if}

    <div class="filterbar">
      {#if filterLess}
        <button class="fmore fless" aria-label={s('back')} onclick={() => filterEl?.scrollBy({ left: -160, behavior: 'smooth' })}>‹</button>
      {/if}
      <div class="chips" bind:this={filterEl} onscroll={filterMoreRefresh}>
        {#if boothsOnly}
          <button class="chip" onclick={() => (boothsOnly = false)}>🗺️ {s('show_all_sites')}</button>
        {:else}
          {@render catChips()}
          {#if view === 'map'}
            <button class="chip cat" style="--c: var(--gold)" aria-pressed={active === 'tickets'} onclick={() => (active = 'tickets')}>{s('ticket_points')}</button>
          {/if}
        {/if}
      </div>
      {#if filterMore}
        <button class="fmore" aria-label={s('scroll_more')} onclick={() => filterEl?.scrollBy({ left: 160, behavior: 'smooth' })}>›</button>
      {/if}
    </div>

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

    {#if (boothsOnly || view === 'map') && (stack.length > 1 || geoErr || booth)}
      <!-- thin bottom bar: only the site pager + nearest-counter line (filters moved up) -->
      <div class="sheet">
        {#if stack.length > 1}
          <div class="stack">
            <button class="stack-nav" onclick={() => step(-1)} aria-label={s('prev_site')}>‹</button>
            <span class="stack-label"><b>{stackAt + 1}</b> / {stack.length} · {t(stack[stackAt].name)}</span>
            <button class="stack-nav" onclick={() => step(1)} aria-label={s('next_site')}>›</button>
          </div>
        {/if}

        {#if geoErr}
          <p class="geo-err"><small>{geoErr}</small></p>
        {:else if booth}
          <p class="booth-bar">
            <small>{s('booth_nearest', booth.point.id, formatDistance(booth.meters, i18n.lang))}</small>
            <a href={mapsUrl(booth.point)} target="_blank" rel="noopener">{s('booth_dir')}</a>
          </p>
        {/if}
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

  /* list|map toggle, floating top-centre over the map */
  /* switch + filter share --map-topbar-w (nav-pill width) and centre — edit the token */
  .view-fab {
    position: absolute; z-index: 620;
    top: calc(env(safe-area-inset-top) + 14px); left: 0; right: 0;
    margin-inline: auto; width: var(--map-topbar-w);
    box-shadow: var(--shadow); border-radius: 999px;
  }
  /* filter bar floats just under the switch, over the map, in both modes (like pick).
     One scrolling row; chips get an opaque fill + soft shadow so they read over the map. */
  .filterbar {
    position: absolute; z-index: 615;
    top: calc(env(safe-area-inset-top) + 60px); left: 0; right: 0;
    margin-inline: auto; max-width: var(--map-topbar-w);
  }
  .filterbar .chips { padding: 2px 2px 4px; }
  /* › scroll affordance — pinned to the right edge over a fade, shown only when more
     chips sit off-screen (filterMore) */
  .fmore {
    position: absolute; top: 0; bottom: 4px; right: 0;
    width: 40px; border: 0; cursor: pointer;
    display: grid; place-items: center;
    font-size: 1.4rem; font-weight: 700; line-height: 1; color: var(--brand-dark);
    padding-right: 2px;
    background: linear-gradient(to right, transparent, var(--surface) 55%);
  }
  .fmore.fless {
    right: auto; left: 0; padding-right: 0; padding-left: 2px;
    background: linear-gradient(to left, transparent, var(--surface) 55%);
  }
  .fmore:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  /* higher specificity than the base .chips .chip (defined later) so resting chips
     get an opaque fill over the map; the pressed-fill rules still win over this */
  .filterbar .chips :global(.chip) {
    background: var(--surface);
    box-shadow: 0 2px 8px rgba(60, 30, 20, 0.14);
  }
  /* list view: full-height panel over the (still-mounted) map, scrolling under the
     floating switch + filter row */
  .listview {
    position: absolute; inset: 0; z-index: 610;
    background: var(--bg); overflow-y: auto;
    padding: calc(env(safe-area-inset-top) + 112px) 14px calc(90px + env(safe-area-inset-bottom));
    display: flex; flex-direction: column; gap: 12px;
  }
  .vlist { display: flex; flex-direction: column; gap: 10px; }

  .sr-only {
    position: absolute; width: 1px; height: 1px;
    padding: 0; margin: -1px; overflow: hidden;
    clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }

  /* clears the fixed language pill (top-right) and the notch */

  /* thin floating bar (pager + nearest-counter line) — sits above the floating nav
     pill, centred to match it. Filters live in the top floating bar now. */
  .sheet {
    position: absolute;
    left: 12px; right: 12px; bottom: calc(env(safe-area-inset-bottom) + 74px);
    max-width: 460px; margin: 0 auto;
    z-index: 600; /* above the map canvas and its controls */
    display: flex;
    flex-direction: column;
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(14px) saturate(1.2);
    border: 1px solid color-mix(in srgb, var(--brand-dark) 18%, transparent);
    border-radius: 14px;
    box-shadow: var(--shadow-lift);
    overflow: hidden;
  }
  /* one scrolling row, not a wrapping block — wrapping ate three lines of height
     and shoved the map off the top. Now the filters read like a map app's. */
  .chips {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
    padding: 10px 18px 8px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .chips::-webkit-scrollbar { display: none; }

  /* chips as printed labels: hairline keyline, uppercase, no shadow, no gradient */
  .chips :global(.chip) {
    flex: 0 0 auto;
    white-space: nowrap;
    border-radius: 6px;
    border-color: color-mix(in srgb, var(--brand-dark) 20%, transparent);
    background: transparent;
    box-shadow: none;
    padding: 7px 12px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--brand-dark);
  }
  /* pressed cat chip wears its own accent; the neutral chips (all / open filter) have
     no category colour, so their pressed state stays on the chip's own bg with a solid
     ink keyline — a brand-dark fill read as if "all" carried the di-tich accent */
  .chips :global(.chip.cat[aria-pressed='true']) {
    background: var(--c);
    border-color: var(--c);
    color: var(--paper);
  }
  .chips :global(.chip[aria-pressed='true']) {
    border-color: var(--brand-dark);
    color: var(--brand-dark);
  }
  /* the legend swatch: same colour the site's mark is drawn in on the map */
  .chips :global(.chip.cat) { display: inline-flex; align-items: center; gap: 7px; }
  .chips :global(.chip .sw) {
    width: 10px; height: 10px;
    border-radius: 50%;
    background: var(--c);
    border: 1px solid color-mix(in srgb, var(--brand-dark) 45%, transparent);
  }
  .chips :global(.chip[aria-pressed='true'] .sw) { background: var(--paper); border-color: var(--paper); }

  /* stack bar: the reference's "1 / 5 in this area" pager, in our ink. Rides at
     the top of the sheet now (the sheet owns the bottom edge). */
  .stack {
    flex: 0 0 auto;
    margin: 6px 14px 2px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px;
    border-radius: 999px;
    background: var(--brand-dark);
    color: var(--paper);
    box-shadow: 0 10px 24px -16px rgba(40, 12, 6, 0.9);
  }
  .stack-label {
    flex: 1;
    min-width: 0;
    text-align: center;
    font-size: 0.82rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .stack-label b { color: var(--gold); }
  .stack-nav {
    flex: 0 0 auto;
    width: 34px; height: 34px;
    border: 0;
    border-radius: 50%;
    background: var(--paper);
    color: var(--brand-dark);
    font-size: 1.2rem;
    line-height: 1;
    cursor: pointer;
  }

  .booth-bar, .geo-err {
    flex: 0 0 auto;
    margin: 0 18px 8px;
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 8px 12px;
    font-size: 0.85rem;
  }
  .booth-bar a { color: var(--brand); font-weight: 600; white-space: nowrap; }
  .geo-err { color: var(--brand); }

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
  :global(.maplibregl-map) { font-family: var(--font-body); }
  /* the popup is a paper label pinned to the map: ink keyline, hard little
     shadow, solid ink pointer — the same drawing language as the marks */
  :global(.maplibregl-map .maplibregl-popup-content) {
    border-radius: 12px;
    background: var(--surface);
    border: 1.5px solid var(--brand-dark);
    color: var(--ink);
    font-family: var(--font-body);
    padding: 12px 14px 10px;
    box-shadow: 0 10px 22px -18px rgba(40, 12, 6, 0.9);
  }
  :global(.maplibregl-map .maplibregl-popup-anchor-bottom .maplibregl-popup-tip) {
    border-top-color: var(--brand-dark);
  }
  :global(.maplibregl-map .maplibregl-popup-anchor-top .maplibregl-popup-tip) {
    border-bottom-color: var(--brand-dark);
  }
  :global(.maplibregl-map .maplibregl-popup-anchor-left .maplibregl-popup-tip) {
    border-right-color: var(--brand-dark);
  }
  :global(.maplibregl-map .maplibregl-popup-anchor-right .maplibregl-popup-tip) {
    border-left-color: var(--brand-dark);
  }
  /* attribution must stay legible; bottom-right is under the card sheet */
  :global(.maplibregl-map .maplibregl-ctrl-attrib) { border-radius: 0 0 0 8px; }
  :global(.pop) { display: grid; gap: 9px; line-height: 1.35; min-width: 200px; }

  /* the site's own mark, then what it is, then what it's called */
  :global(.pop .pop-head) { display: flex; align-items: center; gap: 10px; }
  :global(.pop .pop-mark) { flex: 0 0 auto; display: block; }
  :global(.pop .pop-title) { display: grid; gap: 1px; min-width: 0; }
  :global(.pop .pop-cat) {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  :global(.pop strong) {
    font-family: var(--font-display);
    font-size: 1rem;
    line-height: 1.15;
    color: var(--brand-dark);
  }

  /* facts as a two-column index: hairline keys, values in ink */
  :global(.pop .pop-snip) {
    margin: 8px 0 0;
    font-size: 0.82rem;
    line-height: 1.35;
    color: var(--brand-dark);
  }
  :global(.pop .pop-meta) {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 10px;
    margin: 0;
    padding-top: 8px;
    border-top: 1px solid color-mix(in srgb, var(--brand-dark) 18%, transparent);
    font-size: 0.78rem;
  }
  :global(.pop .pop-meta dt) {
    color: var(--muted);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding-top: 2px;
  }
  :global(.pop .pop-meta dd) { margin: 0; }
  :global(.pop .pop-meta em) { font-style: normal; font-weight: 700; }
  :global(.pop .pop-meta em.open) { color: var(--teal); }
  :global(.pop .pop-meta em.soon) { color: var(--gold); }
  :global(.pop .pop-meta em.closed) { color: var(--muted); }

  /* status badges are outlined, not filled — filled pills fight the marks */
  :global(.pop .badges) { display: flex; flex-wrap: wrap; gap: 5px; }
  :global(.pop .ptag) {
    border-radius: 5px;
    padding: 2px 7px;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border: 1px solid currentColor;
  }
  :global(.pop .ptag.gold) { color: var(--gold); background: color-mix(in srgb, var(--gold) 22%, transparent); }
  :global(.pop .ptag.done) { color: var(--teal); background: color-mix(in srgb, var(--teal) 12%, transparent); }

  /* one obvious action, one quiet one */
  :global(.pop .acts) { display: flex; align-items: center; gap: 12px; }
  :global(.pop .acts .go) {
    flex: 1;
    text-align: center;
    background: var(--brand-dark);
    color: var(--paper);
    border-radius: 7px;
    padding: 7px 10px;
    font-size: 0.78rem;
    font-weight: 700;
  }
  :global(.pop .acts .dir) {
    color: var(--brand-dark);
    font-size: 0.74rem;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
