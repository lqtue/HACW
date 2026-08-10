<script>
  import { base } from '$app/paths';
  import tours from '$lib/data/tours.json';
  import destinations from '$lib/data/destinations.json';
  import RouteMap from '$lib/components/RouteMap.svelte';
  import { isSetComplete, hasStamp } from '$lib/passport.svelte.js';
  import { routeStats, formatDistance } from '$lib/route.js';
  import { openLabel } from '$lib/util.js';
  import { i18n, t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  const byId = Object.fromEntries(destinations.map((d) => [d.id, d]));

  // Resolve stops + walking cost once — content is frozen, so this never changes.
  const routes = tours.map((tour) => {
    const stops = tour.stops.map((id) => byId[id]).filter(Boolean);
    return { tour, stops, ...routeStats(stops) };
  });

  // Accordion: one open at a time, so only one Leaflet instance ever exists.
  let open = $state(null);
  const toggle = (id) => (open = open === id ? null : id);
</script>

<div class="topbar"><h1>{s('tours_title')}</h1><small>{s('tours_sub')}</small></div>

<div class="page">
  {#each routes as { tour, stops, meters, minutes } (tour.id)}
    {@const done = stops.filter((d) => hasStamp(d.id)).length}
    <div class="tour" class:open={open === tour.id}>
      <button class="head" onclick={() => toggle(tour.id)} aria-expanded={open === tour.id}>
        <div class="thumb">{isSetComplete(tour.stops) ? '🎁' : '🚶'}</div>
        <div class="body">
          <span class="tag" style="background: var(--teal)">{t(tour.theme)}</span>
          <h3>{t(tour.title)}</h3>
          <small class="muted">
            {s('stops', stops.length)} · {s('walk', formatDistance(meters, i18n.lang), minutes)}
            · {done}/{stops.length} ✅
          </small>
        </div>
        <span class="chev" aria-hidden="true">{open === tour.id ? '▾' : '▸'}</span>
      </button>

      {#if open === tour.id}
        <div class="panel">
          <RouteMap {stops} />
          <p class="muted"><small>{t(tour.description)}</small></p>
          <ol class="steps">
            {#each stops as d, i}
              {@const open = openLabel(d)}
              <li>
                <a href="{base}/destinations/{d.id}">{t(d.name)}</a>
                {#if hasStamp(d.id)}<span aria-label="checked in">✅</span>{/if}
                {#if open}<small class="open {open.status}">{open.text}</small>{/if}
                {#if i < stops.length - 1}
                  <small class="muted">
                    → {formatDistance(routeStats([d, stops[i + 1]]).meters, i18n.lang)}
                  </small>
                {/if}
              </li>
            {/each}
          </ol>
          <a class="btn secondary" href="{base}/tours/{tour.id}" style="width: 100%">{s('open_tour')}</a>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .tour {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    margin-bottom: 12px;
    overflow: hidden;
  }
  .tour::before {
    content: '';
    position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background-image: var(--grain); background-size: 170px 170px;
    opacity: 0.4; mix-blend-mode: multiply;
  }
  .tour > * { position: relative; z-index: 1; }
  .tour.open { border-color: color-mix(in srgb, var(--teal) 45%, var(--line)); }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    background: none;
    border: 0;
    text-align: left;
    font-family: var(--font-body);
    cursor: pointer;
  }
  .head .thumb {
    flex: 0 0 auto;
    width: 46px; height: 46px;
    border-radius: 12px;
    display: grid; place-items: center;
    font-size: 1.4rem;
    background: var(--bg);
  }
  .head .body { flex: 1; display: grid; gap: 2px; }
  .head .body h3 { margin: 0; }
  .head .tag { justify-self: start; }
  .chev { color: var(--muted); font-size: 1.1rem; }

  .panel { padding: 0 14px 14px; display: grid; gap: 10px; }
  .panel p { margin: 0; }
  .steps { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
  .steps li { line-height: 1.35; }
  .open { font-weight: 700; }
  .open.open { color: var(--teal); }
  .open.soon { color: #a4620e; }
  .open.closed { color: var(--muted); }
</style>
