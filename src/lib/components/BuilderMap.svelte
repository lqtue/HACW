<script>
  import destinations from '$lib/data/destinations.json';
  import { optimizeRoute, stitchRoute } from '$lib/route.js';
  import { t } from '$lib/i18n.svelte.js';
  import { theme } from '$lib/theme.svelte.js';
  import { categoryLabel } from '$lib/util.js';
  import { s } from '$lib/strings.js';
  import SiteMap from './SiteMap.svelte';

  // Selection map for the 1+1+3 builder, focused on the CURRENT slot: the sites you
  // can pick right now are full-strength; the plan you've already built — earlier
  // picks (gold rim) and the dashed route joining them — sits dimmed as context.
  // Tap a pin → a popup with Add / Remove. All the map machinery is SiteMap.
  const clamp = (str, n = 90) => (str.length > n ? str.slice(0, n - 1).trimEnd() + '…' : str);
  let { eligible = [], picked = [], catFilter = null, onpick, controlsTop = '10px', controlsBottom = null } = $props();

  const byId = Object.fromEntries(destinations.map((d) => [d.id, d]));
  const eligibleSet = $derived(new Set(eligible));
  const pickedSet = $derived(new Set(picked));

  const orderedPicks = $derived(optimizeRoute(picked.map((id) => byId[id]).filter(Boolean)));
  const routeData = $derived({ type: 'Feature', geometry: { type: 'LineString', coordinates: stitchRoute(orderedPicks) } });

  // This map is the PICKER, not the route preview: it shows what's choosable and
  // what's selected — nothing more. The numbered walk route lives on the "Plan
  // ready" screen (RouteMap), where the order is final and there's nothing to pick.
  // Only this step's choosable sites are drawn (plus whatever is already picked, so
  // de-select stays possible). A category filter narrows it further.
  const siteData = $derived({
    type: 'FeatureCollection',
    features: destinations
      .filter((d) => {
        if (pickedSet.has(d.id)) return true;
        if (!eligibleSet.has(d.id)) return false;
        return !catFilter || d.category === catFilter;
      })
      .map((d) => {
        const on = pickedSet.has(d.id);
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
          properties: {
            id: d.id,
            icon: `pin-${d.category}${on ? '-spot' : ''}`,
            // no labels: names crowd at this zoom; the name lives in the popup + list
            label: '',
            sel: on,
            // this slot's choosable sites are full-strength; already-picked context dims
            dim: on ? 0.4 : 1
          }
        };
      })
  });

  const bounds = destinations.reduce(
    (b, d) => [
      [Math.min(b[0][0], d.lng), Math.min(b[0][1], d.lat)],
      [Math.max(b[1][0], d.lng), Math.max(b[1][1], d.lat)]
    ],
    [[180, 90], [-180, -90]]
  );
  const dark = theme.mode === 'dark';
  const brand = (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()) || '#e0542c';
  const ink = dark ? '#efe6d6' : '#1c1917';

  let popup;
  let bmap, bmgl;           // map + maplibre namespace, kept so the pager can reopen popups
  let stack = $state([]);   // sites gathered under one tap (dest objects)
  let stackAt = $state(0);

  function openPick(d) {
    if (!d) return;
    const isPicked = pickedSet.has(d.id);
    const canPick = isPicked || eligibleSet.has(d.id);

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
      btn.className = 'bpop-btn' + (isPicked ? ' rm' : '');
      btn.textContent = isPicked ? s('pick_remove') : s('pick_do');
      btn.addEventListener('click', () => { onpick?.(d.id); popup?.remove(); });
      node.append(btn);
    }
    popup ??= new bmgl.Popup({ offset: [0, -22], closeButton: true, maxWidth: '240px', className: 'bpop-wrap' });
    popup.setLngLat([d.lng, d.lat]).setDOMContent(node).addTo(bmap);
  }

  // sites here sit metres apart — a tap collects every pin within a finger's width and
  // the ‹ › pager steps them in place, exactly like the Explore map.
  function onSite(id, feature, e, map, mgl) {
    bmap = map; bmgl = mgl;
    const { x, y } = e.point;
    const R = 26;
    const near = map.queryRenderedFeatures([[x - R, y - R], [x + R, y + R]], { layers: ['sites'] });
    const ids = [...new Set([id, ...near.map((f) => f.properties.id)])];
    stack = ids.map((i) => byId[i]).filter(Boolean);
    stackAt = 0;
    openPick(stack[0]);
  }
  function step(delta) {
    if (!stack.length) return;
    stackAt = (stackAt + delta + stack.length) % stack.length;
    openPick(stack[stackAt]);
  }
  function onMapInit(map) {
    bmap = map;
    // tap empty paper -> dismiss the pager + popup
    map.on('click', (e) => {
      if (map.queryRenderedFeatures(e.point, { layers: ['sites'] }).length) return;
      popup?.remove(); popup = null; stack = [];
    });
  }
</script>

<div class="bmap-wrap">
  <SiteMap
    {siteData}
    {routeData}
    {controlsTop}
    {controlsBottom}
    locateCompass
    followZoom={17.5}
    attributionPos="bottom-left"
    fitBounds={bounds}
    fitPadding={34}
    routePaint={{ 'line-color': brand, 'line-width': 3, 'line-dasharray': [1.6, 1.4], 'line-opacity': 0.35 }}
    sitesLayout={{
      'icon-size': ['interpolate', ['linear'], ['zoom'],
        14, ['case', ['get', 'sel'], 0.5, 0.7],
        16, ['case', ['get', 'sel'], 0.7, 1.0],
        18, ['case', ['get', 'sel'], 0.85, 1.15]],
      'text-field': ['get', 'label'],
      'text-size': ['case', ['get', 'sel'], 15, 11],
      'text-anchor': 'top',
      'text-offset': [0, 1.4],
      'text-max-width': 8
    }}
    sitesPaint={{
      'text-color': ['case', ['get', 'sel'], brand, ink],
      'text-halo-color': dark ? '#241a16' : '#fff7ef',
      'text-halo-width': ['case', ['get', 'sel'], 2, 1.6],
      'text-opacity': ['case', ['>=', ['coalesce', ['get', 'dim'], 1], 0.4], 1, 0]
    }}
    oninit={onMapInit}
    onsiteclick={onSite}
  />

  {#if stack.length > 1}
    <div class="stack">
      <button class="stack-nav" onclick={() => step(-1)} aria-label={s('prev_site')}>‹</button>
      <span class="stack-label"><b>{stackAt + 1}</b> / {stack.length} · {t(stack[stackAt].name)}</span>
      <button class="stack-nav" onclick={() => step(1)} aria-label={s('next_site')}>›</button>
    </div>
  {/if}
</div>

<style>
  .bmap-wrap {
    position: relative;
    width: 100%; height: 100%;
    overflow: hidden;
    background: var(--paper);
  }
  /* ⓘ credit rides just above the floating bottom block */
  .bmap-wrap :global(.maplibregl-ctrl-bottom-left) { bottom: calc(196px + env(safe-area-inset-bottom)); }

  /* stack pager: "1 / N in this area" — floats over the map's bottom edge, matching
     the Explore map's pager so overlapping sites step in place instead of clustering */
  .stack {
    position: absolute; z-index: 8;
    left: 12px; right: 12px; bottom: 12px;
    display: flex; align-items: center; gap: 10px; padding: 6px;
    border-radius: 999px;
    background: var(--brand-dark); color: var(--paper);
    box-shadow: 0 10px 24px -12px rgba(40, 12, 6, 0.9);
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

  /* selection popup — a small paper label; MapLibre portals it, so global */
  :global(.bpop-wrap .maplibregl-popup-content) {
    padding: 12px 14px; border-radius: 12px;
    background: var(--surface); border: 1px solid var(--line);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18); font-family: var(--font-body);
  }
  :global(.bpop-wrap .maplibregl-popup-tip) { border-top-color: var(--surface); }
  :global(.bpop) { display: flex; flex-direction: column; gap: 4px; }
  :global(.bpop-cat) { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  :global(.bpop strong) { color: var(--brand-dark); font-size: 0.98rem; line-height: 1.2; }
  :global(.bpop-sum) { margin: 0; color: var(--muted); font-size: 0.82rem; line-height: 1.35; }
  :global(.bpop-btn) {
    margin-top: 8px; padding: 9px 12px; border: 0; border-radius: 9px;
    background: var(--brand); color: #fff;
    font-family: var(--font-body); font-weight: 700; font-size: 0.88rem; cursor: pointer;
  }
  :global(.bpop-btn.rm) { background: var(--surface); color: var(--brand); border: 1px solid var(--brand); }
</style>
