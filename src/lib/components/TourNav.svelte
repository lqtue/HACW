<script>
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import destinations from '$lib/data/destinations.json';
  import { stitchRoute, formatDistance, planOrder } from '$lib/route.js';
  import { distanceMeters, bearing } from '$lib/geo.js';
  import { hasStamp } from '$lib/passport.svelte.js';
  import { t, i18n } from '$lib/i18n.svelte.js';
  import { theme } from '$lib/theme.svelte.js';
  import { s } from '$lib/strings.js';
  import SiteMap from './SiteMap.svelte';

  // Tour "focus / follow" mode — walking guidance WITHOUT turn-by-turn (old-town GPS is
  // too noisy for step directions). The map follows you and shows the heading cone; the
  // route line traces real streets; the bottom card names the next stop, counts the
  // straight-line distance down live, and an arrow points the way (bearing to the stop,
  // de-rotated by the map so "up" is up). "Next" = first un-stamped stop, so checking one
  // in advances the guidance on its own; the ‹ › let you override.
  /** @type {{ stops: any[], title?: any, onclose: () => void, reorder?: boolean }} */
  // demo (board only): fake the visitor's position so the nav card can be shown in each
  // state without GPS. 'far' = en route (arrow + distance), 'arrive' = at the stop
  // (✓ + check-in), 'done' = whole set finished. demoIdx picks which stop to target.
  // reorder: re-optimize the *remaining* stops from the visitor's live position (the
  // saved plan — a curated tour keeps its authored order, so /go passes reorder=false).
  let { stops, title, onclose, demo = '', demoIdx = 0, reorder = false, returnTo = '' } = $props();

  // check-in target URL, carrying where to return so the stamp screen can resume the route
  const checkinUrl = (id) => `${base}/destinations/${id}${returnTo ? `?nav=${encodeURIComponent(returnTo)}` : ''}`;

  let me = $state(null); // live GPS fix, bound from SiteMap (also used for the anchor below)

  // Re-anchor point for the reorder: set on the first fix and again after each check-in
  // (the done-count changes), never on every GPS tick — otherwise noisy old-town GPS
  // would flip-flop the stop order under the visitor's finger. Stable between check-ins.
  let anchor = $state(null);
  let anchoredAt = $state(-1); // done-count when `anchor` was last set
  const doneCount = $derived(stops.filter((d) => hasStamp(d.id)).length);
  $effect(() => {
    if (!reorder || !me) return;
    if (anchor == null || doneCount !== anchoredAt) {
      anchor = { lat: me.lat, lng: me.lng };
      anchoredAt = doneCount;
    }
  });

  // ordered = the walking sequence. Curated tour (reorder=false) → authored order as-is.
  // Plan with a fix → already-stamped stops kept in place, remaining re-optimized from
  // the anchor so "next" is the closest sensible stop from where you stand.
  const ordered = $derived(reorder ? planOrder(stops, (d) => hasStamp(d.id), anchor) : stops);

  const stopIds = $derived(new Set(stops.map((d) => d.id)));
  const numById = $derived(Object.fromEntries(ordered.map((d, i) => [d.id, i + 1])));

  // The drawn line follows the route itself — the stops in order, along real streets (the
  // baked ORS geometry). It does NOT connect to the GPS dot: an off-route straight slash
  // from your position to a far stop is noise. Just show where you are and let the fixed
  // line guide you; the top card's arrow + distance handle "which way from here".
  const routeData = $derived({ type: 'Feature', geometry: { type: 'LineString', coordinates: stitchRoute(ordered) } });
  const bounds = $derived(routeData.geometry.coordinates.reduce(
    (b, [lng, lat]) => [
      [Math.min(b[0][0], lng), Math.min(b[0][1], lat)],
      [Math.max(b[1][0], lng), Math.max(b[1][1], lat)]
    ],
    [[180, 90], [-180, -90]]
  ));

  // stamped stops show a ✓ and quiet down; re-derived so a check-in updates the map live
  const siteData = $derived({
    type: 'FeatureCollection',
    features: destinations.map((d) => {
      const on = stopIds.has(d.id);
      const done = on && hasStamp(d.id);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
        properties: {
          id: d.id,
          icon: `pin-${d.category}${on ? '-spot' : ''}`,
          label: on ? (done ? '✓' : String(numById[d.id])) : '',
          on,
          dim: on ? (done ? 0.35 : 1) : 0.28
        }
      };
    })
  });

  const dark = theme.mode === 'dark';

  // --- next-stop guidance ---
  let manualIdx = $state(demo ? demoIdx : null); // ‹ › chevrons; null = auto (first un-stamped)
  let mapBearing = $state(0);
  let heading = $state(null);   // bound from SiteMap: device heading, deg CW from N
  const autoIdx = $derived(Math.max(0, ordered.findIndex((d) => !hasStamp(d.id))));
  const allDone = $derived(stops.length > 0 && stops.every((d) => hasStamp(d.id)));
  const idx = $derived(manualIdx != null ? Math.min(manualIdx, ordered.length - 1) : autoIdx);
  const target = $derived(ordered[idx]);

  function dist(me) {
    return me && target ? distanceMeters(me, { lat: target.lat, lng: target.lng }) : null;
  }
  const arrived = (me) => {
    const d = dist(me);
    return d != null && d <= (target?.radius ?? 75);
  };
  const arrowDeg = (me) => (me && target ? bearing(me, { lat: target.lat, lng: target.lng }) - mapBearing : 0);
  // board demo: a fake "me" so the card renders each state without a GPS fix
  const demoMe = $derived.by(() => {
    if (!demo || !target) return null;
    if (demo === 'arrive') return { lat: target.lat, lng: target.lng };
    if (demo === 'far') return { lat: target.lat + 0.003, lng: target.lng + 0.0012 }; // ~350 m off
    return null;
  });

  // track the map bearing so the top arrow points the right way (the locate button's
  // compass mode does the heading-up rotation now — same as every other map)
  function onmapready(map) {
    mapBearing = map.getBearing();
    map.on('rotate', () => (mapBearing = map.getBearing()));
  }
</script>

<div class="tournav">
  <SiteMap
    {siteData}
    {routeData}
    fitBounds={bounds}
    fitPadding={60}
    follow
    followZoom={17.5}
    autoLocate
    controls={false}
    attributionPos="bottom-left"
    bind:me
    bind:heading
    onready={onmapready}
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
    onsiteclick={(id) => goto(checkinUrl(id))}
  >
    {#snippet children({ compass, recenter, locate3d })}
      {@const m = demo ? demoMe : me}
      {@const d = dist(m)}
      {@const here = arrived(m)}
      {@const finished = allDone || demo === 'done'}

      <!-- TOP: one notification line — "X to <stop>" while walking, "reached <stop>"
           on arrival, "tour complete" at the end -->
      <div class="tn-note">
        {#if finished}
          <span class="tn-ic">✓</span><span class="tn-msg">{s('nav_done')}</span>
        {:else if here}
          <span class="tn-ic">✓</span><span class="tn-msg">{s('nav_arrived_at', t(target.name))}</span>
        {:else if target}
          <span class="tn-ic">
            <svg viewBox="0 0 24 24" width="26" height="26" style="transform: rotate({arrowDeg(m)}deg)" aria-hidden="true">
              <path d="M12 3 L19 20 L12 16 L5 20 Z" fill="currentColor" />
            </svg>
          </span>
          <span class="tn-msg">{#if d != null}{s('nav_to', formatDistance(Math.round(d * 1.3), i18n.lang), t(target.name))}{:else}{s('nav_locate_prompt')}{/if}</span>
        {/if}
      </div>

      <!-- right-edge control: the one locate button (center + zoom + 3D + heading-up),
           same behaviour as every other map -->
      <button class="tn-fab tn-recenter" class:on={compass} onclick={locate3d} aria-label={s('locate_me')} title={s('locate_me')}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <line x1="12" y1="2" x2="12" y2="5" stroke-linecap="round" /><line x1="12" y1="19" x2="12" y2="22" stroke-linecap="round" />
          <line x1="2" y1="12" x2="5" y2="12" stroke-linecap="round" /><line x1="19" y1="12" x2="22" y2="12" stroke-linecap="round" />
        </svg>
      </button>

      <!-- BOTTOM: two buttons floating on the map (no sheet). Check-in lights up only
           within range; Exit always. -->
      <div class="tn-actions">
        {#if finished}
          <!-- whole set done: one full-width primary to the passport -->
          <button class="tn-checkin lit" onclick={() => goto(base + '/passport')}>{s('nav_seepassport')}</button>
        {:else}
          {#if target}
            {#if d == null}
              <!-- no fix yet: routing needs GPS — offer to turn it on -->
              <button class="tn-checkin lit" onclick={recenter}>{s('nav_enable')}</button>
            {:else}
              <button
                class="tn-checkin"
                class:lit={here}
                disabled={!here}
                onclick={() => goto(checkinUrl(target.id))}
              >{s('nav_here')}</button>
            {/if}
          {/if}
          <button class="tn-exit" onclick={onclose}>{s('nav_exit')}</button>
        {/if}
      </div>
    {/snippet}
  </SiteMap>
</div>

<style>
  .tournav { position: fixed; inset: 0; z-index: 2000; background: var(--paper); }

  /* ---- top notification pill (orange, one line) ---- */
  .tn-note {
    position: absolute; z-index: 5;
    top: calc(env(safe-area-inset-top) + 10px); left: 12px; right: 12px;
    display: flex; align-items: center; gap: 12px;
    padding: 14px 18px; border-radius: 16px;
    background: var(--brand); color: #fff;
    box-shadow: 0 6px 22px -8px rgba(20, 10, 6, 0.6);
  }
  .tn-ic {
    flex: 0 0 auto; width: 30px; height: 30px;
    display: grid; place-items: center; font-size: 1.5rem; font-weight: 800;
  }
  .tn-ic svg { transition: transform 0.3s ease; }
  .tn-msg { font-size: 1.15rem; font-weight: 700; line-height: 1.25; }

  /* ---- right-edge round controls ---- */
  .tn-fab {
    position: absolute; z-index: 5; right: 14px;
    width: 46px; height: 46px; display: grid; place-items: center; cursor: pointer;
    border: 0; border-radius: 50%; color: var(--muted);
    background: var(--surface); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  .tn-recenter { bottom: calc(env(safe-area-inset-bottom) + 96px); }
  .tn-recenter.on { color: var(--brand); }
  .tn-fab:focus-visible, .tn-exit:focus-visible, .tn-checkin:focus-visible {
    outline: 2px solid var(--brand); outline-offset: 2px;
  }

  /* ---- bottom: two buttons floating on the map, no container ---- */
  .tn-actions {
    position: absolute; z-index: 5;
    left: 12px; right: 12px; bottom: calc(env(safe-area-inset-bottom) + 16px);
    display: flex; align-items: center; justify-content: flex-end; gap: 10px;
  }
  /* ⓘ credit rides just above the check-in button, bottom-left */
  .tournav :global(.maplibregl-ctrl-bottom-left) { bottom: calc(env(safe-area-inset-bottom) + 76px); }
  /* check-in: dim + not tappable until in range, lights up (full brand) when here */
  .tn-checkin {
    flex: 1 1 auto; border: 0; cursor: pointer;
    padding: 15px 22px; border-radius: 999px;
    font-family: var(--font-body); font-weight: 700; font-size: 1rem;
    color: #fff; background: var(--brand);
    box-shadow: 0 4px 16px -4px rgba(20, 10, 6, 0.5);
    transition: opacity 0.2s, transform 0.15s;
  }
  .tn-checkin:disabled {
    cursor: default; color: color-mix(in srgb, #fff 75%, transparent);
    background: color-mix(in srgb, var(--brand) 42%, var(--surface));
    box-shadow: none;
  }
  .tn-checkin.lit { animation: tn-pop 0.3s ease; }
  @keyframes tn-pop { 0% { transform: scale(0.96); } 60% { transform: scale(1.03); } 100% { transform: scale(1); } }
  @media (prefers-reduced-motion: reduce) { .tn-checkin.lit { animation: none; } }
  /* exit: secondary, surface fill */
  .tn-exit {
    flex: 0 0 auto; border: 0; cursor: pointer;
    padding: 15px 24px; border-radius: 999px;
    background: var(--surface); color: var(--ink); font-family: var(--font-body);
    font-weight: 700; font-size: 1rem; box-shadow: 0 2px 10px -2px rgba(0, 0, 0, 0.35);
  }
</style>
