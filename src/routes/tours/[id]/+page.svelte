<script>
  import PageShell from '$lib/components/PageShell.svelte';
  import RouteMap from '$lib/components/RouteMap.svelte';
  import NearestBooth from '$lib/components/NearestBooth.svelte';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { ui } from '$lib/ui.svelte.js';
  import { isSetComplete } from '$lib/passport.svelte.js';
  import { POINTS } from '$lib/score.js';
  import { routeStats, formatDistance } from '$lib/route.js';
  import { i18n, t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  let { data } = $props();
  const tour = data.tour;
  const walk = routeStats(data.stops);

  const complete = $derived(isSetComplete(tour.stops));
  let openRow = $state(null); // stop row expanded inline (single-open)

  // this screen owns its bottom bar (Start / Exit), so drop the tab bar
  onMount(() => (ui.hideNav = true));
  onDestroy(() => (ui.hideNav = false));

  function exit() {
    goto(base + '/passport'); // Thoát → Sổ tay
  }
</script>

<PageShell title={t(tour.title)} sub={t(tour.theme)}>
  <div class="tour">
    <!-- order: text, map, list -->
    <p class="desc">{t(tour.description)}</p>

    <RouteMap stops={data.stops} height="180px" />
    <p class="muted walkline">
      <small>{s('stops', data.stops.length)} · {s('walk', formatDistance(walk.meters, i18n.lang), walk.minutes)}</small>
    </p>

    {#if complete}
      <!-- Tours award points only (+30); the gift is claimed once on the passport,
           one per account. The counter finder still helps — that's where the gift is. -->
      <div class="redeem">
        <p class="done">{s('set_complete')} · {s('earned', POINTS.tour)}</p>
        <p class="muted"><small>{s('tour_to_passport')}</small></p>
        <NearestBooth />
      </div>
    {/if}

    <!-- compact numbered route: one row per stop so the whole tour fits a screen; tap a
         row to expand its blurb + address inline (like the planner's list) — it does not
         leave the page -->
    <ol class="stops">
      {#each data.stops as dest, i (dest.id)}
        {@const open = openRow === dest.id}
        <li class:open>
          <button class="row" onclick={() => (openRow = open ? null : dest.id)} aria-expanded={open}>
            <span class="n" style="--cat: var(--c-{dest.category})">{i + 1}</span>
            <b>{t(dest.name)}</b>
            <span class="go" aria-hidden="true">{open ? '▾' : '▸'}</span>
          </button>
          {#if open}
            <div class="detail">
              <p class="d-desc">{t(dest.description)}</p>
              <p class="d-addr">📍 {t(dest.address)}</p>
            </div>
          {/if}
        </li>
      {/each}
    </ol>
  </div>
</PageShell>

<!-- docked actions, side by side: Start primary, Exit secondary (app.css .dock) -->
<div class="dock row fixed">
  <a class="btn" href="{base}/go?set={tour.id}">{s('nav_start')}</a>
  <button class="btn sec" onclick={exit}>{s('nav_exit')}</button>
</div>

<style>
  .redeem {
    background: color-mix(in srgb, var(--gold) 14%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--gold) 40%, var(--line));
    border-radius: var(--radius);
    padding: 14px;
    margin-bottom: 8px;
    display: grid;
    gap: 10px;
  }
  .redeem .done { margin: 0; font-weight: 600; }
  .walkline { margin: 8px 0 14px; }
  .desc { margin: 0 0 14px; line-height: 1.55; }
  /* clear the fixed bottom bar */
  .tour { padding-bottom: calc(90px + env(safe-area-inset-bottom)); }

  .stops { list-style: none; margin: 0; padding: 0; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; background: var(--surface); }
  .stops li { border-top: 1px solid var(--line); }
  .stops li:first-child { border-top: 0; }
  .stops .row {
    width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 14px;
    border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer;
  }
  .stops .detail { padding: 0 14px 14px 52px; display: flex; flex-direction: column; gap: 6px; }
  .stops .d-desc { margin: 0; color: var(--muted); font-size: 0.86rem; line-height: 1.5; }
  .stops .d-addr { margin: 0; color: var(--ink); font-size: 0.82rem; }
  .stops .n {
    flex: 0 0 auto; width: 26px; height: 26px; display: grid; place-items: center;
    border-radius: 999px; background: var(--cat); color: #fff; font-size: 0.8rem; font-weight: 700;
  }
  .stops b { flex: 1 1 auto; min-width: 0; font-weight: 600; font-size: 0.98rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stops .go { flex: 0 0 auto; color: var(--muted); font-size: 1.1rem; }
</style>
