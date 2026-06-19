<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import destinations from '$lib/data/destinations.json';
  import categories from '$lib/data/categories.json';
  import Card from '$lib/components/Card.svelte';
  import { categoryIcon } from '$lib/util.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  let active = $state('all');
  const list = $derived(active === 'all' ? destinations : destinations.filter((d) => d.category === active));

  let el;
  let map;
  let markers = [];

  onMount(async () => {
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');

    map = L.map(el, { zoomControl: false }).setView([15.8772, 108.3275], 16);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Basemap: CARTO Voyager (free, no key). Swap URL to change; CSS filter tints it to the paper palette.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution: '© OpenStreetMap, © CARTO'
    }).addTo(map);
    // ponytail: tiles need network; offline the map is blank but check-in/passport still work.

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
      marker.bindPopup(`<strong>${t(d.name)}</strong><br><a href="${base}/destinations/${d.id}">${s('checkin')}</a>`);
      marker.on('popupopen', (e) => {
        e.popup.getElement().querySelector('a')?.addEventListener('click', (ev) => {
          ev.preventDefault();
          goto(`${base}/destinations/${d.id}`);
        });
      });
      markers.push({ marker, category: d.category });
      bounds.push([d.lat, d.lng]);
    }
    if (bounds.length) map.fitBounds(bounds, { padding: [50, 50] });
    // map lives in a flex container sized after init -> recompute once laid out
    setTimeout(() => map.invalidateSize(), 0);
  });

  // Chips filter the map pins and the card list together.
  $effect(() => {
    if (!map) return;
    for (const m of markers) {
      const show = active === 'all' || m.category === active;
      if (show) m.marker.addTo(map);
      else map.removeLayer(m.marker);
    }
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
  </div>

  <div class="carousel">
    {#each list as dest}
      <Card {dest} />
    {/each}
    {#if list.length === 0}
      <p class="muted empty">{s('no_sites')}</p>
    {/if}
  </div>
</div>

<style>
  /* full-height column: map fills, cards scroll sideways below */
  .explore { flex: 1; display: flex; flex-direction: column; min-height: 0; }
  .map { flex: 1; min-height: 0; background: var(--paper); }
  .chips { flex: 0 0 auto; padding-bottom: 8px; }

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
  :global(.leaflet-container) { font-family: var(--font-body); }
  :global(.leaflet-popup-content a) { color: var(--brand); font-weight: 600; }
</style>
