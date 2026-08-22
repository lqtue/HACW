<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import destinations from '$lib/data/destinations.json';
  import categories from '$lib/data/categories.json';
  import tickets from '$lib/data/ticket-points.json';
  import Card from '$lib/components/Card.svelte';
  import MapControls from '$lib/components/MapControls.svelte';
  import { createHeadingCone } from '$lib/heading.js';
  import {
    BOUNDS,
    addCategoryPins,
    hidePois,
    hoianStyle,
    loadMap,
    markSvg
  } from '$lib/map-style.js';
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
  let showTickets = $state(false);
  // "where to buy?" opens the map as a pure counter-finder: booths only, the 25
  // site pins + their filters/carousel hidden until the visitor asks for them.
  let boothsOnly = $state(false);
  let openOnly = $state(false);
  let selected = $state(null); // pin tapped -> highlight its card below
  let rotated = $state(false); // map twisted off north -> show the reset-north chip

  // Location is opt-in: nothing is requested until the visitor taps the chip, so
  // the permission prompt arrives with a reason attached instead of on page load.
  let me = $state(null); // { lat, lng, accuracy } once a fix arrives
  let locating = $state(false);
  let geoErr = $state('');
  const booth = $derived(me ? nearest(me, tickets) : null);

  // Research footfall: recordCell (shared with check-in, in research.svelte.js) buckets
  // the fix into a coarse cell and counts it when consent is on. Called from the geolocate
  // handler below. Consent lives in onboarding + the passport page, not on this map.

  // Sites open right now. Recomputed on filter changes only — good enough for a
  // walk-around app; nobody stares at this screen across an opening time.
  const isOpen = (d) => openLabel(d)?.status !== 'closed';
  const shown = $derived(
    destinations.filter(
      (d) => (active === 'all' || d.category === active) && (!openOnly || isOpen(d))
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
      <dl class="pop-meta">
        <dt>${s('hours_label')}</dt>
        <dd>${esc(t(d.hours))}${open ? ` <em class="${open.status}">${open.text}</em>` : ''}</dd>
        <dt>${s('addr_label')}</dt>
        <dd>${esc(t(d.address))}</dd>
      </dl>
      ${badges ? `<div class="badges">${badges}</div>` : ''}
      <div class="acts">
        <a data-go class="go" href="${base}/destinations/${d.id}">${s('popup_detail')}</a>
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
        // closed right now -> faded pin, still tappable
        dim: openLabel(d)?.status === 'closed' ? 0.45 : 1
      }
    }))
  });

  const byId = new Map(destinations.map((d) => [d.id, d]));

  // North up (true north). The old town is an east-west strip so a rotated map fills
  // the phone better, but the user wants a conventional north-up orientation.
  const BEARING = 0;

  // Everything under the last tap, and where in it we are. One entry = an
  // ordinary pin tap; more than one = the ‹ › bar appears.
  let stack = $state([]);
  let stackAt = $state(0);
  let popup;
  let openSite = () => {};

  function step(delta) {
    stackAt = (stackAt + delta + stack.length) % stack.length;
    openSite(stack[stackAt]);
  }

  let el;
  let map;
  let geolocate;
  let cone; // heading cone (created after load, in onMount)
  // map is a plain variable, so the effects below need one reactive signal
  // telling them the async MapLibre setup has finished.
  let ready = $state(false);

  onMount(async () => {
    // ?tickets=1 — arriving from "where to buy?": counters on, sites hidden
    if (new URLSearchParams(location.search).get('tickets') === '1') showTickets = boothsOnly = true;

    const maplibregl = await loadMap(base);

    map = new maplibregl.Map({
      container: el,
      // ponytail: basemap labels are baked at the language the page loaded in —
      // restyling mid-session would drop our own layers. Pin labels follow t().
      style: hoianStyle(location.origin + base, i18n.lang, theme.mode === 'dark'),
      center: [108.3275, 15.8772],
      zoom: 16,
      bearing: BEARING,
      minZoom: 14,
      maxZoom: 19, // the extract stops at z15; MapLibre overzooms vector cleanly
      maxBounds: BOUNDS, // outside the archive there is nothing to draw
      attributionControl: false // re-added top-right; the card sheet covers the default corner
    });

    // Attribution collapses to its ⓘ puck: legally it only has to be reachable,
    // and the expanded credit line eats the whole top edge on a phone.
    // top-left: the control stack (MapControls) owns top-right now
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-left');
    map.once('idle', () =>
      map
        .getContainer()
        .querySelector('.maplibregl-ctrl-attrib')
        ?.classList.remove('maplibregl-compact-show')
    );
    // ponytail: no NavigationControl — pinch zooms, a two-finger twist rotates
    // (the 🧭 chip resets north), and the bottom edge is needed for the ‹ ›
    // pager. Add it back if testers ask for +/−.
    map.on('rotate', () => {
      const b = ((map.getBearing() % 360) + 360) % 360;
      rotated = b > 1 && b < 359; // twisted off north -> reveal the reset chip
    });

    // MapLibre's own geolocate control already does watch + accuracy circle +
    // permission errors, so the 📍 chip just triggers it and reads the fix back
    // out. Its button is hidden in CSS — the chip is the affordance.
    geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
      trackUserLocation: true,
      showAccuracyCircle: false,
      fitBoundsOptions: { maxZoom: 17 }
    });
    map.addControl(geolocate, 'bottom-right');
    geolocate.on('geolocate', (e) => {
      locating = false;
      geoErr = '';
      me = {
        lat: e.coords.latitude,
        lng: e.coords.longitude,
        accuracy: Math.round(e.coords.accuracy)
      };
      recordCell(me);
      cone?.onFix(e.coords);
    });
    geolocate.on('error', (e) => {
      locating = false;
      geoErr = e?.code === 1 ? s('geo_denied') : s('geo_fail');
    });
    geolocate.on('trackuserlocationend', () => {
      me = null;
      locating = false;
      cone?.hide();
    });

    await new Promise((done) => map.on('load', done));
    cone = createHeadingCone(maplibregl, map);

    // Pins are generated here, not shipped: one image per category (+ a gold spotlight
    // variant), drawn from the app's CSS vars. Shared with the builder map.
    const { gold, ink } = addCategoryPins(map, theme.mode === 'dark');

    hidePois(map);

    // Ticket counters: small neutral dots, off by default so they don't crowd the
    // pins. ponytail: a circle layer, not an image — the popup names the counter.
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
      id: 'booths',
      type: 'circle',
      source: 'booths',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': 6,
        'circle-color': '#fffaf3',
        'circle-stroke-width': 2,
        'circle-stroke-color': gold
      }
    });

    await addLandmarks(map, byId, { ink, fill: '#fdf6e8' });

    map.addSource('sites', { type: 'geojson', data: siteData });
    map.addLayer({
      id: 'sites',
      type: 'symbol',
      source: 'sites',
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-allow-overlap': true,
        // pins grow into the town as you zoom, and the tapped one lifts out of it.
        // A "zoom" expression has to be the top-level input, hence the per-stop case.
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14, ['case', ['==', ['get', 'sel'], true], 0.82, 0.6],
          16, ['case', ['==', ['get', 'sel'], true], 1.15, 0.85],
          18.5, ['case', ['==', ['get', 'sel'], true], 1.4, 1.05]
        ],
        'icon-ignore-placement': true, // every site must show; only labels may collide
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Medium'],
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 1.5], // clears the mark, which anchors at its centre
        'text-optional': true,
        'text-max-width': 8
      },
      paint: {
        'icon-opacity': ['coalesce', ['get', 'dim'], 1],
        'text-color': '#1c1917',
        'text-halo-color': '#fff7ef',
        'text-halo-width': 1.6,
        // names only once the alleys are legible, otherwise it is a wall of text
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 16.2, 0, 16.8, 1]
      }
    });

    // Sites in the old town sit metres apart — Trần Phú alone stacks several
    // behind one mark. A tap therefore collects everything under the finger, not
    // just the top feature, and the ‹ › bar pages through them in place. No
    // zooming, no expanding cluster: the pin stays where the visitor put it.
    openSite = (d) => {
      popup?.remove();
      popup = new maplibregl.Popup({ offset: [0, -24], closeButton: false, maxWidth: '260px' })
        .setLngLat([d.lng, d.lat])
        .setHTML(popupHtml(d))
        .addTo(map);
      // internal link must go through the router (and keep the base path)
      popup.getElement()?.querySelector('[data-go]')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        goto(`${base}/destinations/${d.id}`);
      });
      selected = d.id;
      document
        .getElementById(`card-${d.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    };

    map.on('click', 'sites', (e) => {
      const { x, y } = e.point;
      const R = 26; // finger-sized: everything this close is "the same spot"
      const near = map.queryRenderedFeatures(
        [
          [x - R, y - R],
          [x + R, y + R]
        ],
        { layers: ['sites'] }
      );
      const tapped = e.features[0].properties.id;
      const ids = [tapped, ...new Set(near.map((f) => f.properties.id))];
      stack = [...new Set(ids)].map((id) => byId.get(id)).filter(Boolean);
      stackAt = 0;
      openSite(stack[0]);
    });

    // tap the paper: drop the selection and the bar with it
    map.on('click', (e) => {
      if (map.queryRenderedFeatures(e.point, { layers: ['sites', 'booths'] }).length) return;
      popup?.remove();
      popup = null;
      stack = [];
      selected = null;
    });
    map.on('click', 'booths', (e) => {
      new maplibregl.Popup({ offset: 10, closeButton: false })
        .setLngLat(e.lngLat)
        .setHTML(e.features[0].properties.html)
        .addTo(map);
    });
    for (const id of ['sites', 'booths']) {
      map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
    }

    map.fitBounds(
      destinations.reduce(
        (b, d) => [
          [Math.min(b[0][0], d.lng), Math.min(b[0][1], d.lat)],
          [Math.max(b[1][0], d.lng), Math.max(b[1][1], d.lat)]
        ],
        [
          [180, 90],
          [-180, -90]
        ]
      ),
      { padding: 40, bearing: BEARING, animate: false }
    );
    ready = true;
  });

  // map.remove() also removes the geolocate control, which clears its watch —
  // a watch that outlives the route is a battery leak. (An async onMount cannot
  // return a cleanup, so the teardown is explicit.)
  onDestroy(() => {
    cone?.destroy();
    map?.remove();
  });

  function toggleLocate() {
    if (!ready) return;
    cone?.enableCompass(); // this tap is the user gesture iOS needs for the compass
    // trigger() toggles: a second tap on an active lock switches tracking off.
    if (!me && !locating) {
      locating = true;
      geoErr = '';
    }
    geolocate.trigger();
  }

  // The map opens north-up, but a two-finger twist can leave it at any angle —
  // this snaps the bearing back to north.
  function resetNorth() {
    map?.easeTo({ bearing: BEARING, duration: 400 });
  }

  // Filters, spotlight and opening hours all land as one setData.
  $effect(() => {
    if (ready) map.getSource('sites').setData(siteData);
  });

  $effect(() => {
    if (ready) map.setLayoutProperty('booths', 'visibility', showTickets ? 'visible' : 'none');
  });

  // booths-only mode hides the site pins (booths keep their own toggle above)
  $effect(() => {
    if (ready) map.setLayoutProperty('sites', 'visibility', boothsOnly ? 'none' : 'visible');
  });

</script>

<div class="explore">
  <h1 class="sr-only">{s('explore')}</h1>

  <div class="wrap">
    <div bind:this={el} class="map"></div>
    <!-- clear the fixed theme toggle (top-right, in the layout) -->
    <MapControls located={!!me} {locating} {rotated} top="calc(env(safe-area-inset-top) + 56px)" onlocate={toggleLocate} onnorth={resetNorth} />

  <!-- bottom sheet floats over the map edge: filters, counter bar, site cards.
       Translucent so the plan reads through it — the map is the screen now. -->
  <div class="sheet">
  <span class="handle" aria-hidden="true"></span>

  <!-- several sites under one tap: page through them without moving the map -->
  {#if stack.length > 1}
    <div class="stack">
      <button class="stack-nav" onclick={() => step(-1)} aria-label={s('prev_site')}>‹</button>
      <span class="stack-label">
        <b>{stackAt + 1}</b> / {stack.length} · {t(stack[stackAt].name)}
      </span>
      <button class="stack-nav" onclick={() => step(1)} aria-label={s('next_site')}>›</button>
    </div>
  {/if}

  <div class="chips">
    {#if boothsOnly}
      <!-- counter-finder: no site filters, one way back to the full map -->
      <button class="chip" onclick={() => (boothsOnly = false)}>🗺️ {s('show_all_sites')}</button>
    {:else}
      <button class="chip" aria-pressed={active === 'all'} onclick={() => (active = 'all')}>{s('all')}</button>
      <!-- the filter row is also the legend: each chip carries its pins' colour -->
      {#each categories as c}
        <button
          class="chip cat"
          style="--c: var(--c-{c.id})"
          aria-pressed={active === c.id}
          onclick={() => (active = c.id)}
        >
          <i class="sw" aria-hidden="true"></i>{t(c.label)}
        </button>
      {/each}
      <button class="chip" aria-pressed={openOnly} onclick={() => (openOnly = !openOnly)}>
        🕑 {s('filter_open')}
      </button>
      <button class="chip" aria-pressed={showTickets} onclick={() => (showTickets = !showTickets)}>
        🎟️ {s('ticket_points')}
      </button>
    {/if}
  </div>

  {#if geoErr}
    <p class="geo-err"><small>{geoErr}</small></p>
  {:else if booth}
    <!-- Once we know where the visitor is, the counter is the one thing the map
         cannot answer by itself: it is where paper vouchers and staff live. -->
    <p class="booth-bar">
      <small>{s('booth_nearest', booth.point.id, formatDistance(booth.meters, i18n.lang))}</small>
      <a href={mapsUrl(booth.point)} target="_blank" rel="noopener">{s('booth_dir')}</a>
    </p>
  {/if}


  {#if !boothsOnly}
    <div class="carousel">
      {#each shown as dest}
        <Card {dest} mark active={selected === dest.id} />
      {/each}
      {#if shown.length === 0}
        <p class="muted empty">{s('no_sites')}</p>
      {/if}
    </div>
  {/if}
  </div>
  </div>
</div>

<style>
  /* full-bleed map: the wrap is the whole screen, the sheet floats over its
     bottom. No topbar band here — the nav already names the tab, so the map
     gets that strip of height back. */
  .explore { flex: 1; display: flex; flex-direction: column; min-height: 0; }
  .wrap { flex: 1; min-height: 0; position: relative; }
  .map { position: absolute; inset: 0; background: var(--paper); }

  .sr-only {
    position: absolute; width: 1px; height: 1px;
    padding: 0; margin: -1px; overflow: hidden;
    clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }

  /* clears the fixed language pill (top-right) and the notch */

  /* The map is a printed plan, so the sheet is the sheet of paper it is printed
     on: flat stock, a hairline rule instead of frosted glass and a soft glow.
     Scoped overrides only — .chip and .card keep their app-wide look elsewhere. */
  .sheet {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    z-index: 600; /* above the map canvas and its controls */
    display: flex;
    flex-direction: column;
    max-height: 62%;
    background: color-mix(in srgb, var(--surface) 86%, transparent);
    backdrop-filter: blur(14px) saturate(1.2);
    border-top: 1px solid color-mix(in srgb, var(--brand-dark) 22%, transparent);
    border-radius: 18px 18px 0 0;
    box-shadow: 0 -8px 30px -22px rgba(40, 12, 6, 0.75);
    padding-bottom: max(2px, env(safe-area-inset-bottom));
  }
  .handle {
    display: block;
    width: 34px; height: 2px;
    margin: 7px auto 0;
    border-radius: 0;
    background: color-mix(in srgb, var(--brand-dark) 25%, transparent);
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
  .chips :global(.chip[aria-pressed='true']) {
    background: var(--c, var(--brand-dark));
    border-color: var(--c, var(--brand-dark));
    color: var(--paper);
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

  /* proximity, not mandatory: mandatory snap fought the drag and left the last
     cards unreachable — the "can't scroll the locations" bug. touch-action pins
     the gesture to this row so a horizontal swipe never bubbles to the map. */
  .carousel {
    flex: 0 0 auto;
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    touch-action: pan-x;
    -webkit-overflow-scrolling: touch;
    padding: 4px 18px 14px;
    scrollbar-width: none;
  }
  .carousel::-webkit-scrollbar { display: none; }
  /* each card becomes a snap item; ~82% leaves a peek of the next */
  :global(.carousel .card) {
    flex: 0 0 82%;
    margin-bottom: 0;
    scroll-snap-align: center;
    border-radius: 10px;
    border-color: color-mix(in srgb, var(--brand-dark) 16%, transparent);
    box-shadow: none;
  }
  /* the pin's own site: ink keyline, matching the mark's outline on the map */
  :global(.carousel .card.active) {
    border-color: var(--brand-dark);
    box-shadow: 0 0 0 1px var(--brand-dark);
  }
  :global(.carousel .card .thumb) { border-radius: 8px; width: 46px; height: 46px; }
  /* merged category labels are long; one line on the card keeps the rhythm */
  :global(.carousel .card .tag) { white-space: nowrap; font-size: 0.58rem; }
  /* This card is a pointer at the pin, not the detail page. At 82% of a phone
     column every line wrapped — name over two lines, address over three — and a
     250px-tall card left the map about a third of the screen. One line each, no
     address (the popup and the detail page both carry it), and the height goes
     back to the map. */
  :global(.carousel .card) { padding: 10px; gap: 10px; }
  :global(.carousel .card h3),
  :global(.carousel .card small) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :global(.carousel .card .addr) { display: none; }
  .empty { padding: 8px 0; }

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
