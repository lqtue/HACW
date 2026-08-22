<script>
  // Tour focus/follow "navigation" screen as a real route (not an overlay), so the
  // phone back button closes it and it can be deep-linked / shared.
  //   /go?set=<tourId>  → a named ticket set / route
  //   /go               → the visitor's saved plan (localStorage)
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import tours from '$lib/data/tours.json';
  import destinations from '$lib/data/destinations.json';
  import { plan } from '$lib/plan.svelte.js';
  import { optimizeRoute } from '$lib/route.js';
  import TourNav from '$lib/components/TourNav.svelte';
  import { s } from '$lib/strings.js';

  const byId = Object.fromEntries(destinations.map((d) => [d.id, d]));

  const setId = $derived($page.url.searchParams.get('set'));
  const tour = $derived(setId ? tours.find((t) => t.id === setId) : null);
  const stops = $derived.by(() => {
    const ids = tour ? tour.stops : plan.set;
    const ds = (ids ?? []).map((id) => byId[id]).filter(Boolean);
    return tour ? ds : optimizeRoute(ds); // a saved plan is already ordered; belt + braces
  });
  const title = $derived(tour ? tour.title : s('route_label'));

  function close() {
    if (browser && history.length > 1) history.back();
    else goto(base + (tour ? `/tours/${tour.id}` : '/'));
  }
</script>

{#if browser && stops.length}
  <TourNav {stops} {title} onclose={close} />
{:else if browser}
  <!-- no ?set and an empty saved plan: send them to build one -->
  <div class="go-empty">
    <p>{s('route_empty')}</p>
    <a class="btn" href="{base}/">{s('plan_cta')}</a>
  </div>
{/if}

<style>
  .go-empty {
    min-height: 70vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px;
    padding: 24px; text-align: center; color: var(--muted);
  }
</style>
