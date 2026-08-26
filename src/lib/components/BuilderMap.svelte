<script>
  import destinations from '$lib/data/sites.js';
  import { optimizeRoute, stitchRoute } from '$lib/route.js';
  import { theme } from '$lib/theme.svelte.js';
  import { s } from '$lib/strings.js';
  import SiteMap from './SiteMap.svelte';

  // Selection map for the 1+1+3 builder, focused on the CURRENT slot: the sites you
  // can pick right now are full-strength; the plan you've already built — earlier
  // picks (gold rim) and the dashed route joining them — sits dimmed as context.
  // Tap a pin → SiteMap's popup, whose one button here is Pick / Remove (only for
  // sites in this step's class, or already picked). All the map machinery is SiteMap.
  let { eligible = [], picked = [], catFilter = null, onpick, controlsTop = '10px', controlsBottom = null } = $props();

  const byId = Object.fromEntries(destinations.map((d) => [d.id, d]));
  const eligibleSet = $derived(new Set(eligible));
  const pickedSet = $derived(new Set(picked));

  const orderedPicks = $derived(optimizeRoute(picked.map((id) => byId[id]).filter(Boolean)));
  // all 5 chosen: the picker becomes a preview — every other site dims, the plan is
  // full-strength, the route reads solid, and the frame tightens onto the walk
  const complete = $derived(picked.length >= 5);
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
        if (pickedSet.has(d.id) || complete) return true;
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
            dim: complete ? (on ? 1 : 0.25) : on ? 0.4 : 1
          }
        };
      })
  });

  const bounds = $derived((complete ? orderedPicks : destinations).reduce(
    (b, d) => [
      [Math.min(b[0][0], d.lng), Math.min(b[0][1], d.lat)],
      [Math.max(b[1][0], d.lng), Math.max(b[1][1], d.lat)]
    ],
    [[180, 90], [-180, -90]]
  ));
  const dark = theme.mode === 'dark';
  const brand = (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()) || '#e0542c';
  const ink = dark ? '#efe6d6' : '#1c1917';

  // the popup's button: Pick, or Remove when already in the plan; nothing when the site
  // isn't in this step's class (it still shows as context, just can't be chosen now)
  function pickAction(d) {
    const on = pickedSet.has(d.id);
    if (!on && !eligibleSet.has(d.id)) return null;
    return { label: on ? s('pick_remove') : s('pick_do'), secondary: on, onclick: () => onpick?.(d.id) };
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
    routePaint={{ 'line-color': brand, 'line-width': 3, 'line-dasharray': [1.6, 1.4], 'line-opacity': complete ? 0.9 : 0.35 }}
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
    popupAction={pickAction}
    pagerBottom={controlsBottom ? `calc(${controlsBottom} + 8px)` : '12px'}
  />
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
  /* popup + stack pager: SiteMap's, same on every map */
</style>
