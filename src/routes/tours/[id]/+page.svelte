<script>
  import PageShell from '$lib/components/PageShell.svelte';
  import StaffConfirm from '$lib/components/StaffConfirm.svelte';
  import RouteMap from '$lib/components/RouteMap.svelte';
  import NearestBooth from '$lib/components/NearestBooth.svelte';
  import { base } from '$app/paths';
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
</script>

<PageShell title={t(tour.title)} sub={t(tour.theme)}>
  <RouteMap stops={data.stops} height="150px" />
  <p class="muted walkline">
    <small>{s('stops', data.stops.length)} · {s('walk', formatDistance(walk.meters, i18n.lang), walk.minutes)}</small>
  </p>
  <a class="btn nav-start" href="{base}/go?set={tour.id}">{s('nav_start')} →</a>
  <p class="desc">{t(tour.description)}</p>

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
</PageShell>

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
  .walkline { margin: 8px 0 0; }
  .nav-start { width: 100%; margin: 12px 0 4px; }
  .desc { margin: 6px 0 14px; line-height: 1.55; }

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
