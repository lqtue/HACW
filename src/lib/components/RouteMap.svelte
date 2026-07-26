<script>
  import { onMount, onDestroy } from 'svelte';
  import { t } from '$lib/i18n.svelte.js';

  /** @type {{ stops: any[], height?: string }} */
  let { stops, height = '220px' } = $props();

  let el;
  let map;
  // async onMount can't return a cleanup -> tear the map down explicitly
  onDestroy(() => map?.remove());

  // Leaflet is browser-only -> dynamic import, same as the main map.
  onMount(async () => {
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');

    map = L.map(el, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    const line = stops.map((d) => [d.lat, d.lng]);
    L.polyline(line, { color: '#2f6b5e', weight: 4, opacity: 0.8, dashArray: '1 7', lineCap: 'round' }).addTo(map);

    stops.forEach((d, i) => {
      L.marker([d.lat, d.lng], {
        icon: L.divIcon({ className: 'step-wrap', html: `<div class="step">${i + 1}</div>`, iconSize: [24, 24] })
      })
        .addTo(map)
        .bindPopup(t(d.name));
    });

    map.fitBounds(line, { padding: [28, 28] });
    setTimeout(() => map?.invalidateSize(), 0);
  });
</script>

<div bind:this={el} class="routemap" style="height: {height}"></div>

<style>
  .routemap {
    width: 100%;
    border-radius: var(--radius);
    overflow: hidden;
    border: 1px solid var(--line);
    background: var(--paper);
  }
  :global(.step) {
    width: 24px; height: 24px;
    border-radius: 50%;
    background: var(--teal);
    color: #fff;
    border: 2px solid #fff;
    display: grid; place-items: center;
    font-size: 12px; font-weight: 700;
    box-shadow: 0 2px 5px -1px rgba(60, 30, 10, 0.45);
  }
</style>
