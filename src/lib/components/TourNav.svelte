<script>
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import destinations from '$lib/data/destinations.json';
  import { stitchRoute } from '$lib/route.js';
  import { distanceMeters, bearing } from '$lib/geo.js';
  import { formatDistance } from '$lib/route.js';
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
  /** @type {{ stops: any[], title?: any, onclose: () => void }} */
  let { stops, title, onclose } = $props();

  const stopIds = $derived(new Set(stops.map((d) => d.id)));
  const numById = $derived(Object.fromEntries(stops.map((d, i) => [d.id, i + 1])));

  const routeData = $derived({ type: 'Feature', geometry: { type: 'LineString', coordinates: stitchRoute(stops) } });
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
          dim: on ? (done ? 0.55 : 1) : 0.28
        }
      };
    })
  });

  const dark = theme.mode === 'dark';

  // --- next-stop guidance ---
  let manualIdx = $state(null); // set by the ‹ › chevrons; null = auto (first un-stamped)
  let mapBearing = $state(0);
  let heading = $state(null);   // bound from SiteMap: device heading, deg CW from N
  let headingUp = $state(false);// opt-in: rotate the map to face the way you walk (Google-style)
  let navMap = $state(null);
  const autoIdx = $derived(Math.max(0, stops.findIndex((d) => !hasStamp(d.id))));
  const allDone = $derived(stops.length > 0 && stops.every((d) => hasStamp(d.id)));
  const idx = $derived(manualIdx != null ? Math.min(manualIdx, stops.length - 1) : autoIdx);
  const target = $derived(stops[idx]);
  const stepIdx = (delta) => (manualIdx = Math.max(0, Math.min(stops.length - 1, idx + delta)));

  function dist(me) {
    return me && target ? distanceMeters(me, { lat: target.lat, lng: target.lng }) : null;
  }
  const arrived = (me) => {
    const d = dist(me);
    return d != null && d <= (target?.radius ?? 75);
  };
  const arrowDeg = (me) => (me && target ? bearing(me, { lat: target.lat, lng: target.lng }) - mapBearing : 0);

  function onmapready(map) {
    navMap = map;
    mapBearing = map.getBearing();
    map.on('rotate', () => (mapBearing = map.getBearing()));
  }

  function toggleHeadingUp() {
    headingUp = !headingUp;
    if (!headingUp) navMap?.easeTo({ bearing: 0, duration: 400 }); // back to north when off
  }

  // Heading-up rotation: ease the map toward the device heading, but only past an 8°
  // change so noisy old-town GPS/compass can't spin it. ponytail: fixed threshold +
  // easeTo smoothing; swap for a proper low-pass filter if it still feels jittery.
  $effect(() => {
    if (!headingUp || heading == null || !navMap) return;
    const delta = ((heading - navMap.getBearing() + 540) % 360) - 180;
    if (Math.abs(delta) > 8) navMap.easeTo({ bearing: heading, duration: 300 });
  });
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
    onsiteclick={(id) => goto(`${base}/destinations/${id}`)}
  >
    {#snippet children({ me, located, following, recenter })}
      <div class="tn-bar">
        <button class="tn-btn" onclick={onclose} aria-label={s('nav_close')}>✕</button>
        <span class="tn-title">{t(title)}</span>
      </div>
      <button class="tn-headingup" class:on={headingUp} onclick={toggleHeadingUp} aria-pressed={headingUp} aria-label={s('nav_headingup')} title={s('nav_headingup')}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M12 2 L19 21 L12 17 L5 21 Z" fill={headingUp ? 'currentColor' : 'none'} stroke-linejoin="round" />
        </svg>
      </button>
      <button class="tn-recenter" class:on={following && located} onclick={recenter} aria-label={s('locate_me')} title={s('locate_me')}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <line x1="12" y1="2" x2="12" y2="5" stroke-linecap="round" /><line x1="12" y1="19" x2="12" y2="22" stroke-linecap="round" />
          <line x1="2" y1="12" x2="5" y2="12" stroke-linecap="round" /><line x1="19" y1="12" x2="22" y2="12" stroke-linecap="round" />
        </svg>
      </button>

      <div class="tn-card">
        {#if allDone}
          <div class="tn-done">{s('nav_done')}</div>
        {:else if target}
          {@const d = dist(me)}
          {@const here = arrived(me)}
          <div class="tn-row">
            <button class="tn-step" onclick={() => stepIdx(-1)} disabled={idx === 0} aria-label="‹">‹</button>
            <div class="tn-dir" class:here>
              {#if here}
                <span class="tn-check">✓</span>
              {:else}
                <svg viewBox="0 0 24 24" width="26" height="26" style="transform: rotate({arrowDeg(me)}deg)" aria-hidden="true">
                  <path d="M12 3 L19 20 L12 16 L5 20 Z" fill="currentColor" />
                </svg>
              {/if}
            </div>
            <div class="tn-info">
              <div class="tn-label">
                {here ? s('nav_arrived') : s('nav_next')}
                <span class="tn-left">· {s('nav_stops_left', stops.filter((x) => !hasStamp(x.id)).length)}</span>
              </div>
              <div class="tn-name">{numById[target.id]}. {t(target.name)}</div>
              <div class="tn-dist">
                {#if d != null}{formatDistance(Math.round(d * 1.3), i18n.lang)}{:else}{s('nav_locate_prompt')}{/if}
              </div>
            </div>
            <button class="tn-step" onclick={() => stepIdx(1)} disabled={idx === stops.length - 1} aria-label="›">›</button>
          </div>
          <a class="tn-go" href="{base}/destinations/{target.id}">{s('nav_here')}</a>
        {/if}
      </div>
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
  .tn-btn, .tn-recenter, .tn-headingup {
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
    right: 14px; bottom: calc(env(safe-area-inset-bottom) + 118px);
    color: var(--muted);
  }
  .tn-recenter.on { color: var(--brand); }
  .tn-headingup {
    position: absolute; z-index: 5;
    right: 14px; bottom: calc(env(safe-area-inset-bottom) + 170px);
    color: var(--muted);
  }
  .tn-headingup.on { color: var(--brand); }
  .tn-recenter:focus-visible, .tn-btn:focus-visible, .tn-step:focus-visible, .tn-go:focus-visible, .tn-headingup:focus-visible {
    outline: 2px solid var(--brand); outline-offset: 2px;
  }

  /* bottom next-stop guidance card */
  .tn-card {
    position: absolute; z-index: 5;
    left: 12px; right: 12px; bottom: calc(env(safe-area-inset-bottom) + 14px);
    display: flex; flex-direction: column; gap: 8px;
    padding: 10px 8px; border-radius: 16px;
    background: var(--surface); box-shadow: 0 2px 12px rgba(0, 0, 0, 0.28);
  }
  .tn-row { display: flex; align-items: center; gap: 10px; }
  .tn-done {
    flex: 1; text-align: center; font-weight: 800; color: var(--brand-dark); padding: 6px;
  }
  .tn-step {
    width: 34px; height: 44px; flex: 0 0 auto; border: 0; background: transparent;
    color: var(--muted); font-size: 1.5rem; font-weight: 700; cursor: pointer; border-radius: 10px;
  }
  .tn-step:disabled { opacity: 0.25; cursor: default; }
  .tn-dir {
    width: 44px; height: 44px; flex: 0 0 auto; display: grid; place-items: center;
    border-radius: 50%; background: var(--grad-brand, var(--brand)); color: #fff;
  }
  .tn-dir.here { background: var(--gold, #d9a441); }
  .tn-dir svg { transition: transform 0.3s ease; }
  .tn-check { font-size: 1.4rem; font-weight: 800; }
  .tn-info { flex: 1; min-width: 0; }
  .tn-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .tn-left { text-transform: none; letter-spacing: 0; }
  .tn-name {
    font-weight: 800; color: var(--ink); font-size: 0.98rem;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .tn-dist { font-size: 0.85rem; color: var(--brand-dark); font-weight: 600; }
  .tn-go {
    display: block; width: 100%; padding: 11px 12px; border-radius: 12px;
    background: var(--brand); color: #fff; font-weight: 700; font-size: 0.9rem;
    text-decoration: none; text-align: center;
  }
</style>
