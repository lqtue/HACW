<script>
  import destinations from '$lib/data/destinations.json';
  import { optimizeRoute, stitchRoute } from '$lib/route.js';
  import { t } from '$lib/i18n.svelte.js';
  import { theme } from '$lib/theme.svelte.js';
  import { categoryLabel } from '$lib/util.js';
  import { s } from '$lib/strings.js';
  import SiteMap from './SiteMap.svelte';

  // Selection map for the 1+1+3 builder. Eligible sites are full-strength; picked sites
  // wear the gold rim + a walk-order number and are joined by a dashed route line;
  // everything else dims back. Tap a pin → a popup with Add / Remove. All the map
  // machinery is SiteMap; this supplies the highlighting + the pick popup.
  const clamp = (str, n = 90) => (str.length > n ? str.slice(0, n - 1).trimEnd() + '…' : str);
  let { eligible = [], picked = [], catFilter = null, onpick } = $props();

  const byId = Object.fromEntries(destinations.map((d) => [d.id, d]));
  const eligibleSet = $derived(new Set(eligible));
  const pickedSet = $derived(new Set(picked));

  const orderedPicks = $derived(optimizeRoute(picked.map((id) => byId[id]).filter(Boolean)));
  const numById = $derived(Object.fromEntries(orderedPicks.map((d, i) => [d.id, i + 1])));
  const routeData = $derived({ type: 'Feature', geometry: { type: 'LineString', coordinates: stitchRoute(orderedPicks) } });

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
  function onPin(id, feature, e, map, mgl) {
    const d = byId[id];
    if (!d) return;
    const isPicked = pickedSet.has(id);
    const canPick = isPicked || eligibleSet.has(id);

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
      btn.addEventListener('click', () => { onpick?.(id); popup.remove(); });
      node.append(btn);
    }
    popup ??= new mgl.Popup({ offset: [0, -22], closeButton: true, maxWidth: '240px', className: 'bpop-wrap' });
    popup.setLngLat([d.lng, d.lat]).setDOMContent(node).addTo(map);
  }
</script>

<div class="bmap-wrap">
  <SiteMap
    {siteData}
    {routeData}
    fitBounds={bounds}
    fitPadding={34}
    routePaint={{ 'line-color': brand, 'line-width': 3, 'line-dasharray': [1.6, 1.4], 'line-opacity': 0.9 }}
    sitesLayout={{
      'icon-size': ['interpolate', ['linear'], ['zoom'],
        14, ['case', ['get', 'sel'], 0.8, 0.55],
        16, ['case', ['get', 'sel'], 1.15, 0.8],
        18, ['case', ['get', 'sel'], 1.35, 0.95]],
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
    onsiteclick={onPin}
  />
</div>

<style>
  .bmap-wrap {
    width: 100%; height: 100%;
    border-radius: 16px; overflow: hidden;
    background: var(--paper); border: 1px solid var(--line);
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
