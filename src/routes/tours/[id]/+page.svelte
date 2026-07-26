<script>
  import Card from '$lib/components/Card.svelte';
  import StaffConfirm from '$lib/components/StaffConfirm.svelte';
  import RouteMap from '$lib/components/RouteMap.svelte';
  import NearestBooth from '$lib/components/NearestBooth.svelte';
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

<div class="topbar"><h1>{t(tour.title)}</h1><small>{t(tour.theme)}</small></div>

<div class="page">
  <RouteMap stops={data.stops} height="200px" />
  <p class="muted walkline">
    <small>{s('stops', data.stops.length)} · {s('walk', formatDistance(walk.meters, i18n.lang), walk.minutes)}</small>
  </p>
  <p>{t(tour.description)}</p>

  {#if redeemed}
    <div class="success">{s('redeemed')}</div>
  {:else if complete}
    <div class="redeem">
      <p class="done">🎉 {s('set_complete')} · {s('earned', POINTS.tour)}</p>
      <StaffConfirm label={s('redeem')} onconfirm={() => redeemSet(tour.id)} />
      <!-- The voucher is paper and lives at a counter, so say which one is closest. -->
      <NearestBooth />
    </div>
  {/if}

  <h2>{s('route')}</h2>
  {#each data.stops as dest, i}
    <Card {dest} index={i + 1} />
  {/each}
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
  .walkline { margin: 8px 0 0; }
  .success {
    background: #e6f4ea;
    border: 1px solid #a8d8b9;
    color: #1e6b34;
    border-radius: 12px;
    padding: 12px;
    font-weight: 600;
    margin-bottom: 8px;
  }
</style>
