<script>
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import destinations from '$lib/data/destinations.json';
  import { stitchRoute } from '$lib/route.js';
  import { t } from '$lib/i18n.svelte.js';
  import { theme } from '$lib/theme.svelte.js';
  import { s } from '$lib/strings.js';
  import SiteMap from './SiteMap.svelte';

  // Tour "focus / follow" mode — walking-navigation feel WITHOUT turn-by-turn (old-town
  // GPS is too noisy for step directions). The tour stops are bright + numbered + joined
  // by the route line; every other site dims back but stays visible. Camera follows you.
  // All the map machinery is SiteMap; this only supplies the highlighting + overlay.
  /** @type {{ stops: any[], title?: any, onclose: () => void }} */
  let { stops, title, onclose } = $props();

  const stopIds = new Set(stops.map((d) => d.id));
  const numById = Object.fromEntries(stops.map((d, i) => [d.id, i + 1]));

  const routeData = { type: 'Feature', geometry: { type: 'LineString', coordinates: stitchRoute(stops) } };
  const bounds = routeData.geometry.coordinates.reduce(
    (b, [lng, lat]) => [
      [Math.min(b[0][0], lng), Math.min(b[0][1], lat)],
      [Math.max(b[1][0], lng), Math.max(b[1][1], lat)]
    ],
    [[180, 90], [-180, -90]]
  );

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

  const dark = theme.mode === 'dark';
</script>

<div class="tournav">
  <SiteMap
    {siteData}
    {routeData}
    fitBounds={bounds}
    fitPadding={60}
    follow
    autoLocate
    controls={false}
    sitesLayout={{
      'icon-size': ['case', ['get', 'on'], 1.1, 0.7],
      'text-field': ['get', 'label'],
      'text-size': 14,
      'text-offset': [0, 1.4]
    }}
    sitesPaint={{
      'text-color': dark ? '#efe6d6' : '#1c1917',
      'text-halo-color': dark ? '#241a16' : '#fff7ef',
      'text-halo-width': 2
    }}
    onsiteclick={(id) => goto(`${base}/destinations/${id}`)}
  >
    {#snippet children({ located, following, recenter })}
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
    {/snippet}
  </SiteMap>
</div>

<style>
  .tournav { position: fixed; inset: 0; z-index: 2000; background: var(--paper); }
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
</style>
