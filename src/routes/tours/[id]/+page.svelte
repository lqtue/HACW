<script>
  import PageShell from '$lib/components/PageShell.svelte';
  import StaffConfirm from '$lib/components/StaffConfirm.svelte';
  import RouteMap from '$lib/components/RouteMap.svelte';
  import NearestBooth from '$lib/components/NearestBooth.svelte';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { ui } from '$lib/ui.svelte.js';
  import { isSetComplete, isRedeemed, redeemSet } from '$lib/passport.svelte.js';
  import { POINTS } from '$lib/score.js';
  import { routeStats, formatDistance } from '$lib/route.js';
  import { i18n, t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  let { data } = $props();
  const tour = data.tour;
  const walk = routeStats(data.stops);

  const complete = $derived(isSetComplete(tour.stops));
  const redeemed = $derived(isRedeemed(tour.id));

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

    {#if redeemed}
      <div class="success">{s('redeemed')}</div>
    {:else if complete}
      <div class="redeem">
        <p class="done">{s('set_complete')} · {s('earned', POINTS.tour)}</p>
        <StaffConfirm label={s('redeem')} onconfirm={() => redeemSet(tour.id)} />
        <!-- The voucher is paper and lives at a counter, so say which one is closest. -->
        <NearestBooth />
      </div>
    {/if}

    <!-- compact numbered route: one row per stop instead of a full card, so the whole
         tour fits a screen; tap a stop for its detail page -->
    <ol class="stops">
      {#each data.stops as dest, i}
        <li>
          <a href="{base}/destinations/{dest.id}">
            <span class="n" style="--cat: var(--c-{dest.category})">{i + 1}</span>
            <b>{t(dest.name)}</b>
            <span class="go" aria-hidden="true">›</span>
          </a>
        </li>
      {/each}
    </ol>
  </div>
</PageShell>

<!-- docked actions, side by side (nav style): Start primary, Exit secondary -->
<div class="tourbar">
  <a class="btn prim" href="{base}/go?set={tour.id}">{s('nav_start')}</a>
  <button class="sec" onclick={exit}>{s('nav_exit')}</button>
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

  /* docked Start / Exit — side by side like the tour-nav actions */
  .tourbar {
    position: fixed; left: 12px; right: 12px; bottom: calc(14px + env(safe-area-inset-bottom));
    max-width: 460px; margin: 0 auto; z-index: 900;
    display: flex; gap: 10px; align-items: stretch;
  }
  .tourbar .prim { flex: 1 1 auto; margin: 0; }
  .tourbar .sec {
    flex: 0 0 auto; margin: 0; cursor: pointer;
    padding: 0 20px; border-radius: 999px;
    border: 1.5px solid var(--brand); background: transparent; color: var(--brand);
    font-family: var(--font-body); font-weight: 700; font-size: 0.95rem;
  }
  .tourbar .sec:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

  .stops { list-style: none; margin: 0; padding: 0; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; background: var(--surface); }
  .stops li { border-top: 1px solid var(--line); }
  .stops li:first-child { border-top: 0; }
  .stops a { display: flex; align-items: center; gap: 12px; padding: 12px 14px; text-decoration: none; color: inherit; }
  .stops .n {
    flex: 0 0 auto; width: 26px; height: 26px; display: grid; place-items: center;
    border-radius: 999px; background: var(--cat); color: #fff; font-size: 0.8rem; font-weight: 700;
  }
  .stops b { flex: 1 1 auto; min-width: 0; font-weight: 600; font-size: 0.98rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stops .go { flex: 0 0 auto; color: var(--muted); font-size: 1.1rem; }
</style>
