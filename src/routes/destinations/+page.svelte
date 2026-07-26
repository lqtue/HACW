<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import destinations from '$lib/data/destinations.json';
  import categories from '$lib/data/categories.json';
  import tickets from '$lib/data/ticket-points.json';
  import Card from '$lib/components/Card.svelte';
  import { categoryIcon, categoryLabel, mapsUrl, openLabel } from '$lib/util.js';
  import { nearest } from '$lib/geo.js';
  import { formatDistance } from '$lib/route.js';
  import { hasStamp } from '$lib/passport.svelte.js';
  import { stats } from '$lib/stats.svelte.js';
  import { spotlightIds } from '$lib/score.js';
  import { t, i18n } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  let active = $state('all');
  let showTickets = $state(false);
  let openOnly = $state(false);
  let selected = $state(null); // pin tapped -> highlight its card below

  // Location is opt-in: nothing is requested until the visitor taps the chip, so
  // the permission prompt arrives with a reason attached instead of on page load.
  let me = $state(null); // { lat, lng, accuracy } once a fix arrives
  let locating = $state(false);
  let geoErr = $state('');
  const booth = $derived(me ? nearest(me, tickets) : null);

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
  function popupHtml(d) {
    const open = openLabel(d);
    const badges = [
      `<span class="ptag" style="background: var(--c-${d.category})">${t(categoryLabel(d.category))}</span>`,
      open ? `<span class="ptag ${open.status}">${open.text}</span>` : '',
      spotlight.has(d.id) ? `<span class="ptag gold">⭐ ${s('spotlight')}</span>` : '',
      hasStamp(d.id) ? `<span class="ptag done">✅ ${s('stamped')}</span>` : ''
    ].join(' ');
    return `<div class="pop">
      <strong>${t(d.name)}</strong>
      <div class="badges">${badges}</div>
      <small>🕑 ${t(d.hours)}<br>📍 ${t(d.address)}</small>
      <div class="acts">
        <a data-go href="${base}/destinations/${d.id}">${s('popup_detail')}</a>
        <a href="${mapsUrl(d)}" target="_blank" rel="noopener">${s('popup_dir')}</a>
      </div>
    </div>`;
  }

  let el;
  let map;
  let markers = [];
  let ticketLayer;
  let meMarker;
  let meHalo;
  // map/markers are plain variables, so the effects below need one reactive
  // signal telling them the async Leaflet setup has finished.
  let ready = $state(false);

  onMount(async () => {
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');

    map = L.map(el, { zoomControl: false }).setView([15.8772, 108.3275], 16);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Basemap: CARTO Voyager (free, no key). CSS filter tints it to the paper palette.
    const street = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution: '© OpenStreetMap, © CARTO'
    }).addTo(map);
    // ponytail: tiles need network; offline the map is blank but check-in/passport still work.

    // Satellite = Esri World Imagery, not Google: Google's tiles may only be used
    // through their paid Maps APIs, and scraping the tile server breaks their ToS.
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Esri, Maxar, Earthstar Geographics' }
    );
    L.control
      .layers({ [s('map_street')]: street, [s('map_sat')]: satellite }, null, { position: 'topright' })
      .addTo(map);
    // the paper tint would ruin the imagery -> drop it while satellite is on
    map.on('baselayerchange', (e) => el.classList.toggle('sat', e.name === s('map_sat')));

    const css = getComputedStyle(document.documentElement);
    const bounds = [];
    for (const d of destinations) {
      const color = css.getPropertyValue(`--c-${d.category}`).trim() || '#bb4b2c';
      const icon = L.divIcon({
        className: 'pin-wrap',
        html: `<div class="pin" style="--c:${color}"><span>${categoryIcon(d.category)}</span></div>`,
        iconSize: [34, 44],
        iconAnchor: [17, 40],
        popupAnchor: [0, -38]
      });
      const marker = L.marker([d.lat, d.lng], { icon }).addTo(map);
      marker.bindPopup(() => popupHtml(d), { minWidth: 210 });
      marker.on('popupopen', (e) => {
        // internal link must go through the router (and keep the base path)
        e.popup.getElement().querySelector('[data-go]')?.addEventListener('click', (ev) => {
          ev.preventDefault();
          goto(`${base}/destinations/${d.id}`);
        });
        selected = d.id;
        document
          .getElementById(`card-${d.id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
      marker.on('popupclose', () => {
        if (selected === d.id) selected = null;
      });
      markers.push({ marker, dest: d });
      bounds.push([d.lat, d.lng]);
    }

    // Ticket counters: small neutral dots, off by default so they don't crowd the pins.
    ticketLayer = L.layerGroup(
      tickets.map((p) =>
        L.marker([p.lat, p.lng], {
          icon: L.divIcon({ className: 'ticket-wrap', html: '<div class="ticket">🎟️</div>', iconSize: [22, 22] })
        }).bindPopup(`<strong>${p.id}</strong><br>${t(p.where)}`)
      )
    );

    // Leaflet's own geolocation wrapper — it already does watch + accuracy and
    // hands back a latlng, so there is nothing here worth reimplementing.
    map.on('locationfound', (e) => {
      locating = false;
      geoErr = '';
      me = { lat: e.latlng.lat, lng: e.latlng.lng, accuracy: Math.round(e.accuracy) };
      if (!meMarker) {
        meMarker = L.marker(e.latlng, {
          icon: L.divIcon({ className: 'me-wrap', html: '<div class="me"></div>', iconSize: [18, 18] }),
          zIndexOffset: 1000
        })
          .addTo(map)
          .bindPopup(() => `<strong>${s('you_are_here')}</strong><br><small>${s('accuracy_m', me.accuracy)}</small>`);
        meHalo = L.circle(e.latlng, { radius: e.accuracy, className: 'me-halo', stroke: false }).addTo(map);
        // Only the first fix moves the map — after that the visitor is panning.
        map.setView(e.latlng, Math.max(map.getZoom(), 17));
      } else {
        meMarker.setLatLng(e.latlng);
        meHalo.setLatLng(e.latlng).setRadius(e.accuracy);
      }
    });
    map.on('locationerror', (e) => {
      locating = false;
      geoErr = e?.code === 1 ? s('geo_denied') : s('geo_fail');
      stopLocate();
    });

    if (bounds.length) map.fitBounds(bounds, { padding: [50, 50] });
    // map lives in a flex container sized after init -> recompute once laid out
    setTimeout(() => map.invalidateSize(), 0);
    ready = true;
  });

  // A watch that outlives the page is a battery leak, so both the watch and the
  // map itself are torn down explicitly (an async onMount cannot return a cleanup).
  onDestroy(() => {
    map?.stopLocate();
    map?.remove();
  });

  function stopLocate() {
    map?.stopLocate();
    if (meMarker) map.removeLayer(meMarker);
    if (meHalo) map.removeLayer(meHalo);
    meMarker = meHalo = null;
    me = null;
    locating = false;
  }

  function toggleLocate() {
    if (!ready) return;
    if (me || locating) return stopLocate();
    locating = true;
    geoErr = '';
    map.locate({ watch: true, enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
  }

  // Chips filter the map pins and the card list together.
  $effect(() => {
    if (!ready) return;
    const visible = new Set(shown.map((d) => d.id));
    for (const m of markers) {
      if (visible.has(m.dest.id)) m.marker.addTo(map);
      else map.removeLayer(m.marker);
    }
  });

  // Counts can arrive before or after the markers -> re-flag the pins in place.
  $effect(() => {
    if (!ready) return;
    for (const m of markers) {
      const el = m.marker.getElement();
      el?.classList.toggle('spot', spotlight.has(m.dest.id));
      el?.classList.toggle('shut', openLabel(m.dest)?.status === 'closed');
    }
  });

  $effect(() => {
    if (!ready || !ticketLayer) return;
    if (showTickets) ticketLayer.addTo(map);
    else map.removeLayer(ticketLayer);
  });
</script>

<div class="explore">
  <div class="topbar"><h1>{s('explore')}</h1><small>{s('sites_count', destinations.length)}</small></div>

  <div bind:this={el} class="map"></div>

  <div class="chips">
    <button class="chip" aria-pressed={active === 'all'} onclick={() => (active = 'all')}>{s('all')}</button>
    {#each categories as c}
      <button class="chip" aria-pressed={active === c.id} onclick={() => (active = c.id)}>{c.icon} {t(c.label)}</button>
    {/each}
    <button class="chip" aria-pressed={openOnly} onclick={() => (openOnly = !openOnly)}>
      🕑 {s('filter_open')}
    </button>
    <button class="chip" aria-pressed={showTickets} onclick={() => (showTickets = !showTickets)}>
      🎟️ {s('ticket_points')}
    </button>
    <button class="chip" aria-pressed={!!me} onclick={toggleLocate}>
      📍 {locating ? s('locating_now') : s('locate_me')}
    </button>
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

  <div class="carousel">
    {#each shown as dest}
      <Card {dest} active={selected === dest.id} />
    {/each}
    {#if shown.length === 0}
      <p class="muted empty">{s('no_sites')}</p>
    {/if}
  </div>
</div>

<style>
  /* full-height column: map fills, cards scroll sideways below */
  .explore { flex: 1; display: flex; flex-direction: column; min-height: 0; }
  .map { flex: 1; min-height: 0; background: var(--paper); }
  .chips { flex: 0 0 auto; padding-bottom: 8px; }

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

  /* live position: a dot with an accuracy halo, deliberately unlike the pins */
  :global(.me) {
    width: 16px; height: 16px;
    border-radius: 50%;
    background: var(--teal);
    border: 3px solid #fff;
    box-shadow: 0 0 0 1px var(--teal), 0 2px 6px -1px rgba(60, 30, 10, 0.5);
  }
  :global(.me-halo) { fill: var(--teal); fill-opacity: 0.12; }

  .carousel {
    flex: 0 0 auto;
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding: 4px 18px 14px;
    scrollbar-width: none;
  }
  .carousel::-webkit-scrollbar { display: none; }
  /* each card becomes a snap item; ~82% leaves a peek of the next */
  :global(.carousel .card) { flex: 0 0 82%; margin-bottom: 0; scroll-snap-align: center; }
  .empty { padding: 8px 0; }

  :global(.leaflet-tile-pane) {
    filter: sepia(0.2) saturate(0.85) brightness(1.04) contrast(0.92);
  }
  .map.sat :global(.leaflet-tile-pane) { filter: none; }
  :global(.pin) {
    width: 30px; height: 30px;
    background: var(--c);
    border: 2px solid #fff;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 3px 7px -1px rgba(60, 30, 10, 0.45);
    display: grid; place-items: center;
  }
  :global(.pin span) { transform: rotate(45deg); font-size: 15px; line-height: 1; }
  /* boosted (quieter) sites get a gold halo so the map itself steers the crowd */
  :global(.pin-wrap.spot .pin) {
    border-color: var(--gold);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--gold) 45%, transparent), 0 3px 7px -1px rgba(60, 30, 10, 0.45);
  }
  :global(.ticket) {
    width: 22px; height: 22px;
    display: grid; place-items: center;
    font-size: 13px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 50%;
    box-shadow: 0 2px 5px -1px rgba(60, 30, 10, 0.35);
  }
  :global(.leaflet-container) { font-family: var(--font-body); }
  :global(.leaflet-popup-content a) { color: var(--brand); font-weight: 600; }
  :global(.pop) { display: grid; gap: 6px; line-height: 1.35; }
  :global(.pop strong) { font-family: var(--font-display); font-size: 1.05rem; }
  :global(.pop .badges) { display: flex; flex-wrap: wrap; gap: 4px; }
  :global(.pop .ptag) {
    color: #fff;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 0.7rem;
    font-weight: 600;
  }
  :global(.pop .ptag.gold) { background: var(--gold); color: #4a2f06; }
  :global(.pop .ptag.done) { background: var(--teal); }
  :global(.pop .ptag.open) { background: var(--teal); }
  :global(.pop .ptag.soon) { background: #a4620e; }
  :global(.pop .ptag.closed) { background: var(--muted); }
  /* closed right now -> faded pin, still tappable */
  :global(.pin-wrap.shut .pin) { opacity: 0.45; }
  :global(.pop .acts) { display: flex; gap: 12px; margin-top: 2px; }
</style>
