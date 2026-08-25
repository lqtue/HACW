<script>
  import { base } from '$app/paths';
  import { onMount, onDestroy, untrack } from 'svelte';
  import { ui } from '$lib/ui.svelte.js';
  import destinations from '$lib/data/destinations.json';
  import categories from '$lib/data/categories.json';
  import tours from '$lib/data/tours.json';
  import Onboarding from '$lib/components/Onboarding.svelte';
  import BuilderMap from '$lib/components/BuilderMap.svelte';
  import ViewToggle from '$lib/components/ViewToggle.svelte';
  import ChipRow from '$lib/components/ChipRow.svelte';
  import RouteMap from '$lib/components/RouteMap.svelte';
  import MatCua from '$lib/components/MatCua.svelte';
  import { rankSets } from '$lib/advisor.js';
  import { isValidSet } from '$lib/ticket.js';
  import { weather } from '$lib/weather.svelte.js';
  import { stats } from '$lib/stats.svelte.js';
  import { spotlightIds } from '$lib/score.js';
  import { distanceMeters, getPosition } from '$lib/geo.js';
  import { formatDistance, optimizeRoute, routeStats } from '$lib/route.js';
  import { track } from '$lib/passport.svelte.js';
  import { plan, setOnboarded, setPlanSet } from '$lib/plan.svelte.js';
  import { openLabel, categoryLabel } from '$lib/util.js';
  import { i18n, t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  const byId = Object.fromEntries(destinations.map((d) => [d.id, d]));
  // organizer's location priority as a sort key (lower = promote first)
  const PRIO = { high: 0, medium: 1, low: 2 };
  const prioRank = (d) => PRIO[d?.promoPriority] ?? 1;
  const groups = {
    monument: destinations.filter((d) => d.ticketClass === 'monument'),
    museum: destinations.filter((d) => d.ticketClass === 'museum'),
    other: destinations.filter((d) => d.ticketClass === 'other')
  };
  const ticketSets = tours.filter((tr) => tr.ticket);

  // ---- onboarding + plan build -> done ----
  // ?step=door|lang|welcome|install|scan|perms|recommend|manual|done forces a screen
  // regardless of the onboarded/plan flags, so the /screens board (and testers) can open
  // each one directly. door..perms are <Onboarding>'s screens; recommend/manual map to
  // build + the two build modes; done is the plan-ready summary.
  const forced =
    (typeof location !== 'undefined' &&
      /^(door|lang|welcome|install|scan|perms|recommend|manual|done)$/.exec(
        new URLSearchParams(location.search).get('step') || ''
      )?.[0]) ||
    '';
  // the board's manual deep-link params (?view=, ?pick=), read synchronously
  const q0 = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  // door..perms live in <Onboarding>; showOnb gates it. `step` is just the post-onboarding
  // home: build | done.
  const onbForced = /^(door|lang|welcome|install|scan|perms)$/.test(forced);
  let showOnb = $state(onbForced || (!forced && !plan.onboarded));
  let step = $state(forced === 'done' ? 'done' : 'build');

  onMount(() => {
    // returning visitors skip onboarding — grab a fix here so their plan still orders
    // from where they stand (first-timers get it from Onboarding's perms step via onLocate).
    if (plan.onboarded) locate();
    // board preview (?step=recommend): expand the top set by default; ?open=0 keeps all collapsed.
    if (forced === 'recommend' && recommended.length &&
        new URLSearchParams(location.search).get('open') !== '0') openSet = recommended[0].id;
    // board preview (?step=done): the done summary needs a plan to render — seed one from
    // the first ticket set if the device has none.
    if (forced === 'done' && !pickedIds.length && ticketSets.length) applySet(ticketSets[0].stops);
    // board preview (?step=manual): view + pick are read synchronously at init (see
    // viewMode / stepIdx above) so the list deep-link never transiently mounts the map
  });

  // Onboarding finished (or was skipped): persist the flag and drop into the builder.
  function finishOnboarding() {
    setOnboarded();
    showOnb = false;
    step = 'build';
  }

  // hide the tab bar + theme toggle on the plan-ready (done) screen and the full-map
  // manual builder — their own controls are the way out; recommend keeps the nav.
  // Onboarding's own screens are handled by the layout (its `onboarding` derived).
  // reset when leaving the route.
  $effect(() => {
    const hide = !showOnb && (step === 'done' || mode === 'manual');
    ui.hideNav = hide;
    ui.hideTheme = hide;
  });
  onDestroy(() => { ui.hideNav = false; ui.hideTheme = false; });

  // ---- the 1 + 1 + 3 builder ----
  const STEPS = [
    { cls: 'monument', key: 'step_monument' },
    { cls: 'museum', key: 'step_museum' },
    { cls: 'other', key: 'step_free' }
  ];
  // ?pick=last opens on the free step, else the first (monument) — read synchronously
  // (same reason as viewMode) so the correct step renders on the first paint
  const boardManual = forced === 'manual';
  const boardLast = boardManual && q0?.get('pick') === 'last';
  let stepIdx = $state(boardLast ? 2 : 0);
  // Board-preview frames share localStorage, so they must NOT read (or write) the real
  // stored plan — otherwise a later frame's full 5-pick set leaks into "Pick 1st/2nd".
  // Seed a clean per-frame demo: first-step = nothing picked; last-step = the 1st+2nd
  // already chosen, picking the free 3. Real app (forced === '') restores from plan.set.
  let mono = $state(boardManual ? (boardLast ? groups.monument[0]?.id ?? null : null) : plan.set.find((id) => byId[id]?.ticketClass === 'monument') ?? null);
  let museo = $state(boardManual ? (boardLast ? groups.museum[0]?.id ?? null : null) : plan.set.find((id) => byId[id]?.ticketClass === 'museum') ?? null);
  let free = $state(boardManual ? [] : plan.set.filter((id) => byId[id]?.ticketClass === 'other'));

  const pickedIds = $derived([mono, museo, ...free].filter(Boolean));
  const valid = $derived(isValidSet(pickedIds, destinations, 5));
  // persist the working set live, so tapping a list card through to a site's detail
  // page (and back) doesn't drop the picks — mono/museo/free re-init from plan.set.
  // untrack the write: setPlanSet → save() reads plan.set, which would otherwise make
  // this effect depend on the very state it writes (infinite loop). Skipped in board
  // preview so demo frames never contaminate each other's shared localStorage.
  $effect(() => {
    const ids = pickedIds;
    if (!forced) untrack(() => setPlanSet(ids));
  });
  const slotList = $derived([
    { cls: 'monument', id: mono },
    { cls: 'museum', id: museo },
    { cls: 'other', id: free[0] ?? null },
    { cls: 'other', id: free[1] ?? null },
    { cls: 'other', id: free[2] ?? null }
  ]);

  // Location-aware planning: one GPS fix (`here`), asked for at the perms step and on
  // entering the planner, anchors everything — the free list sorts nearest-you first,
  // "pick the rest for me" fills the closest quiet sites, and the saved route starts at
  // the stop closest to you then takes the shortest walk (optimizeRoute(picks, here)).
  // Fully offline: every distance is the baked walk matrix + haversine, no routing server.
  // No fix (denied / indoors / returning user who skips) → falls back to the town centre.
  const TOWN_CENTRE = { lat: 15.8772, lng: 108.3275 };
  let here = $state(null);
  const origin = $derived(here ?? TOWN_CENTRE);
  async function locate() {
    if (forced) return; // board previews never touch real GPS
    // one retry: a fresh GPS often reports "unavailable" for a beat before the first fix
    // (and in dev the fake-geo shim installs a tick after mount). A hard denial still
    // just falls through to the town centre. ponytail: 2 tries is plenty; not a loop.
    for (let i = 0; i < 2; i++) {
      try { here = await getPosition(); return; }
      catch { await new Promise((r) => setTimeout(r, 600)); }
    }
  }
  const picks = $derived(pickedIds.map((id) => byId[id]).filter(Boolean));
  function distFor(d) {
    if (picks.length) return Math.min(...picks.filter((p) => p.id !== d.id).map((p) => distanceMeters(p, d)).concat(Infinity));
    return distanceMeters(origin, d);
  }

  // the free pool is big (16+) vs 3 monuments / 6 museums — a category filter makes it browsable
  // chip order follows categories.json (di-tich, hoi-quan, nha-co, trai-nghiem), present-only
  const freeCats = categories.map((c) => c.id).filter((id) => groups.other.some((d) => d.category === id));
  let catFilter = $state(null);

  // The free pool is 16+ sites; show as many as fit the list viewport and hide the
  // rest behind "show more" so the picker never overflows into a marathon scroll.
  // The sort ranks by distance, so the visible ones are the realistic (compact-walk)
  // picks. CAP tracks the measured list height (bound below) — ~62px/row, less the
  // top offset and a slot for the see-more link. ponytail: fixed row height guess;
  // fine unless the row layout changes.
  let listH = $state(0);
  // cap the list at 6 rows (rest behind "see more"); still shrinks on short screens
  const CAP = $derived(
    Math.min(6, listH ? Math.max(3, Math.floor((listH - 124 - 44) / 62)) : 6)
  );
  let showAll = $state(false);
  let openRow = $state(null); // list row expanded inline (accordion), like the suggested sets
  // list (scan names/status) vs map (spatial pick) — one at a time, not stacked. Read
  // the board's ?view= synchronously so a list-view deep-link never briefly mounts the
  // map (its async init would then fire on a torn-down container and blank the render).
  let viewMode = $state(forced === 'manual' && q0?.get('view') === 'list' ? 'list' : 'map');

  const currentGroup = $derived(groups[STEPS[stepIdx].cls]);
  const eligibleIds = $derived(currentGroup.map((d) => d.id));
  const onFree = $derived(STEPS[stepIdx].cls === 'other');
  const rankedList = $derived.by(() => {
    const list = currentGroup
      .filter((d) => !onFree || !catFilter || d.category === catFilter)
      .map((d) => ({ d, m: distFor(d) }));
    // distance-banded (~40 m) so a higher organizer priority floats up within a band —
    // a gentle nudge that doesn't scatter the walk. Nearest overall stays first.
    list.sort((a, b) =>
      (Math.round(a.m / 40) - Math.round(b.m / 40)) || (prioRank(a.d) - prioRank(b.d)) || (a.m - b.m)
    );
    return list;
  });
  // only the free step is long enough to need capping; other steps are short
  const shownList = $derived(onFree && !showAll ? rankedList.slice(0, CAP) : rankedList);

  function firstIncomplete() {
    if (!mono) return 0;
    if (!museo) return 1;
    return 2;
  }
  function isPicked(id) {
    return id === mono || id === museo || free.includes(id);
  }
  function pick(id) {
    const cls = byId[id]?.ticketClass;
    if (cls === 'monument') mono = mono === id ? null : id;
    else if (cls === 'museum') museo = museo === id ? null : id;
    else if (free.includes(id)) free = free.filter((x) => x !== id);
    else if (free.length < 3) free = [...free, id];
    // advance to the next unfilled step once the current one is satisfied
    const done = (STEPS[stepIdx].cls === 'other' ? free.length >= 3 : STEPS[stepIdx].cls === 'monument' ? mono : museo);
    if (done && stepIdx < 2) stepIdx = firstIncomplete();
  }


  // recommend the prebuilt sets first; manual builder is opt-in behind "pick my own"
  let mode = $state(
    forced === 'recommend' || forced === 'manual' ? forced : plan.set.length ? 'manual' : 'recommend'
  );
  let openSet = $state(null); // single-open accordion; one RouteMap (WebGL) alive at a time
  const ctx = () => ({ weather: weather.now, now: new Date(), counts: stats.counts });
  const recommended = $derived(
    rankSets(
      ticketSets.map((tr) => ({ ...tr, stops: tr.stops.map((i) => byId[i]).filter(Boolean) })),
      ctx(),
      destinations
    )
  );

  function applySet(ids) {
    mono = ids.find((i) => byId[i]?.ticketClass === 'monument') ?? null;
    museo = ids.find((i) => byId[i]?.ticketClass === 'museum') ?? null;
    free = ids.filter((i) => i !== mono && i !== museo).slice(0, 3);
  }
  function useSet(set) {
    usedRecommend = true;
    applySet(set.stops.map((d) => d.id));
    finish();
  }

  // how the plan got assembled, for the organizer: took a whole themed set (recommend),
  // hand-picked every slot (manual), or picked some and let the app fill the rest (mixed).
  let usedRecommend = false;
  let autoSlots = 0; // slots the app auto-filled this build ("how many left" to it)

  const remaining = $derived(5 - pickedIds.length);
  // fill quiet sites first (dispersal), then organizer priority, then nearest the origin
  function bestFrom(pool, n) {
    const spot = spotlightIds(stats.counts, destinations);
    return pool
      .map((d) => ({ id: d.id, quiet: spot.has(d.id) ? 0 : 1, prio: prioRank(d), m: distanceMeters(origin, d) }))
      .sort((a, b) => a.quiet - b.quiet || a.prio - b.prio || a.m - b.m)
      .slice(0, n)
      .map((x) => x.id);
  }
  function autoFree() {
    const before = free.length;
    free = [...free, ...bestFrom(groups.other.filter((d) => !free.includes(d.id)), 3 - free.length)];
    autoSlots += free.length - before;
  }
  // "pick the rest for me" — fills every empty slot (monument, museum, free)
  function autoComplete() {
    if (!mono) { mono = bestFrom(groups.monument, 1)[0] ?? null; autoSlots++; }
    if (!museo) { museo = bestFrom(groups.museum, 1)[0] ?? null; autoSlots++; }
    if (free.length < 3) autoFree(); // counts its own slots
    stepIdx = firstIncomplete();
  }

  // Closest stop first, then the shortest walk through the rest — anchored to `here` when
  // a fix is in, else the plain shortest chain. Reactive, so it re-orders the moment the
  // GPS fix arrives during the build.
  const orderedPlan = $derived(optimizeRoute(pickedIds.map((id) => byId[id]), here ?? undefined));
  const planWalk = $derived(routeStats(orderedPlan));
  // measured height of the plan-ready stop sheet → RouteMap fit padding (see markup)
  let sheetH = $state(200);
  let routeMap; // the plan-ready RouteMap — its focus(id) is driven by the stop list

  function finish() {
    if (!valid) return;
    setPlanSet(orderedPlan.map((d) => d.id)); // closest-first, shortest walk from `here`
    track('plan_built');
    const buildMode = usedRecommend ? 'recommend' : autoSlots > 0 ? 'mixed' : 'manual';
    track('plan_mode', buildMode, buildMode === 'mixed' ? autoSlots : undefined);
    step = 'done';
  }
  function editPlan() {
    step = 'build';
    mode = 'manual';
    usedRecommend = false; // hand-editing a recommended set makes it a manual/mixed build
    stepIdx = firstIncomplete();
  }
  function resetPicks() {
    mono = null;
    museo = null;
    free = [];
    catFilter = null;
    stepIdx = 0;
    usedRecommend = false;
    autoSlots = 0;
  }
</script>

{#if showOnb}
  <Onboarding {forced} onDone={finishOnboarding} onLocate={locate} />
{:else if step === 'done'}
  <div class="donefull">
    <!-- full-bleed route map; summary floats top, the stop list rides a bottom sheet.
         The route is fitted into the band the overlays leave uncovered (header above,
         sheet + CTA below) — otherwise on a short phone the sheet sits on the stops. -->
    <div class="donemap-full">
      <RouteMap bind:this={routeMap} stops={orderedPlan} height="100%" interactive padding={{ top: 130, right: 28, bottom: sheetH + 136, left: 28 }} />
    </div>
    <header class="done-head">
      <h1 class="ptitle">{s('done_title')}</h1>
      <p class="walk-sum">{s('route_walk', formatDistance(planWalk.meters, i18n.lang), planWalk.minutes)}</p>
    </header>
    <div class="donesheet" bind:clientHeight={sheetH}>
      <!-- tap a stop → its pin's popup on the map above -->
      <ol class="doneroute">
        {#each orderedPlan as d, i (d.id)}
          <li>
            <button class="stoprow" onclick={() => routeMap?.focus(d.id)}>
              <span class="n" style="--cat: var(--c-{d.category})">{i + 1}</span> {t(d.name)}
            </button>
          </li>
        {/each}
      </ol>
    </div>
  </div>
  <!-- primary CTA docked above the tab bar; the edit-plan action rides below it as a
       secondary button (replacing the old top back chip) -->
  <div class="dock fixed">
    <a class="btn" href="{base}/go">{s('go_checkin')}</a>
    <button class="sub" onclick={editPlan}>{s('edit_plan')}</button>
  </div>
{:else if mode === 'recommend'}
  <div class="build">
    <header class="b-head">
      <h1 class="ptitle">{s('rec_head')}</h1>
    </header>

    <ul class="sets">
      {#each recommended as set, i (set.id)}
        {@const open = openSet === set.id}
        <li class="setcard" class:top={i === 0}>
          <button class="set-head" onclick={() => (openSet = open ? null : set.id)} aria-expanded={open}>
            <span class="set-h-body">
              {#if i === 0}<span class="rec-badge">✦ {s('rec_badge')}</span>{/if}
              <b>{t(set.title)}</b>
              <small>{t(set.theme)}</small>
              {#if !open}<small class="set-dist">{formatDistance(set.walkM, i18n.lang)} · {s('walk_time', set.walkMin)}</small>{/if}
            </span>
            <span class="caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
          </button>
          {#if open}
            <div class="set-body">
              <p class="narr">{t(set.description)}</p>
              <ul class="stops">
                {#each set.stops as d, si (d.id)}
                  <li>
                    <span class="n" style="--cat: var(--c-{d.category})">{si + 1}</span>
                    <b>{t(d.name)}</b>
                  </li>
                {/each}
              </ul>
              <button class="btn" onclick={() => useSet(set)}>{s('use_set')}</button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>

    <div class="dock">
      <button class="sub" onclick={() => { mode = 'manual'; stepIdx = firstIncomplete(); }}>
        {s('pick_own')}
      </button>
    </div>
  </div>
{:else}
  <div class="build manual committing">
    <header class="b-head">
      <h1 class="ptitle">{s('plan_title')}</h1>
    </header>

    <!-- map/list view; the switch hovers top-centre over the map, like Explore -->
    <div class="viewregion" class:ismap={viewMode === 'map'} class:free={onFree}>
      <div class="float-top pill"><ViewToggle bind:mode={viewMode} /></div>

      {#if onFree}
        <!-- free pool is large; category chips double as a legend — same swatch
             chips as the Explore tab so the two filters read identically -->
        <div class="float-top row2">
          <ChipRow>
            <button class="chip" aria-pressed={!catFilter} onclick={() => (catFilter = null)}>{s('all')}</button>
            {#each freeCats as c (c)}
              <button
                class="chip cat"
                aria-pressed={catFilter === c}
                style="--c: var(--c-{c})"
                onclick={() => (catFilter = catFilter === c ? null : c)}
              >
                <i class="sw" aria-hidden="true"></i>{t(categoryLabel(c))}
              </button>
            {/each}
          </ChipRow>
        </div>
      {/if}

      {#if viewMode === 'list'}
        <ul class="list" bind:clientHeight={listH}>
          {#each shownList as { d, m } (d.id)}
            {@const picked = isPicked(d.id)}
            {@const oh = openLabel(d)}
            {@const open = openRow === d.id}
            <li class="row" class:picked class:open>
              <!-- tap the card to expand details inline (like the suggested sets); the + picks -->
              <div class="row-main">
                <!-- collapsed: name + open/closed; expanded: the one-line intro -->
                <button class="row-tap" onclick={() => (openRow = open ? null : d.id)} aria-expanded={open}>
                  <span class="body">
                    <b>{t(d.name)}</b>
                    {#if oh}<small class="meta"><em class={oh.status}>{oh.text}</em></small>{/if}
                  </span>
                  <span class="caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
                </button>
                <button class="add" class:on={picked} onclick={() => pick(d.id)} aria-pressed={picked} aria-label={picked ? s('pick_remove') : s('pick_do')}>{picked ? '✓' : '+'}</button>
              </div>
              {#if open}
                <div class="row-detail">
                  <p class="rd-desc">{d.short ? t(d.short) : t(d.description)}</p>
                </div>
              {/if}
            </li>
          {/each}
          <!-- show-more lives inside the scroll so it clears the floating bottom block -->
          {#if onFree && rankedList.length > CAP}
            <li class="moreli">
              {#if showAll}
                <button class="link fill-link" onclick={() => (showAll = false)}>{s('list_less')}</button>
              {:else}
                <button class="link fill-link" onclick={() => (showAll = true)}>{s('list_more', rankedList.length - CAP)}</button>
              {/if}
            </li>
          {/if}
        </ul>
      {:else}
        <!-- map mode: tap a pin to add/remove; mounted only in this branch so it never inits at 0×0 -->
        <div class="mapwrap"><BuilderMap eligible={eligibleIds} picked={pickedIds} catFilter={onFree ? catFilter : null} onpick={pick} controlsBottom="calc(196px + env(safe-area-inset-bottom))" /></div>
      {/if}
    </div>

    <!-- one floating block: progress dots, the prim/sec action row (nav-style, side by
         side), and the sub line under it -->
    <div class="buildbar">
      <div class="slotbtns" role="group" aria-label={s('your_ticket')}>
        {#each slotList as slot, i (i)}
          {@const si = i < 2 ? i : 2}
          {@const d = slot.id ? byId[slot.id] : null}
          <button
            class="slot"
            class:filled={d}
            class:on={stepIdx === si}
            onclick={() => (stepIdx = si)}
            aria-label={s(STEPS[si].key)}
          >
            {#if d}
              <MatCua size={28} color="var(--c-{d.category})" inner="var(--surface)" />
            {/if}
          </button>
        {/each}
      </div>

      <div class="dock row">
        {#if valid}
          <button class="btn" onclick={finish}>{s('build_done')}</button>
        {:else}
          <button class="btn" onclick={autoComplete}>{s('auto_pick')}</button>
        {/if}
        <button class="btn sec" onclick={() => (mode = 'recommend')}>{s('nav_exit')}</button>
        {#if pickedIds.length}
          <button class="sub" onclick={resetPicks}>{s('reset_picks')}</button>
        {:else}
          <span class="sub hint">{s('pick_hint')}</span>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* plan-ready: full-bleed route map with floating summary + stop-list sheet */
  .donefull { position: relative; height: 100dvh; overflow: hidden; }
  .donemap-full { position: absolute; inset: 0; }
  .donemap-full :global(.routemap) { height: 100%; border: 0; border-radius: 0; }
  .done-head {
    position: absolute; z-index: 8; top: 0; left: 0; right: 0;
    padding: var(--pad-top) var(--gutter) 22px;
    background: linear-gradient(color-mix(in srgb, var(--bg) 88%, transparent), transparent);
    pointer-events: none;
  }
  /* total walk under the title */
  .walk-sum { margin: 4px 0 0; color: var(--muted); font-size: 0.95rem; font-weight: 600; }
  .donesheet {
    position: absolute; z-index: 8;
    left: 12px; right: 12px; bottom: calc(112px + env(safe-area-inset-bottom));
    max-width: 460px; margin: 0 auto; max-height: 38vh; overflow-y: auto;
    padding: 12px 14px; border-radius: 16px;
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(12px);
    box-shadow: var(--shadow-lift);
  }
  .doneroute { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 8px; width: 100%; }
  .doneroute li { display: flex; align-items: center; font-size: 0.95rem; }
  .doneroute .stoprow {
    flex: 1; display: flex; align-items: center; gap: 10px;
    border: 0; background: none; padding: 0; color: inherit; font: inherit; text-align: left; cursor: pointer;
  }
  /* short phones (≤700px tall): tighter sheet so the route keeps a usable band of map */
  @media (max-height: 700px) {
    .donesheet { max-height: 27vh; padding: 8px 12px; }
    .doneroute { gap: 4px; margin-bottom: 4px; }
    .doneroute li { font-size: 0.86rem; }
    .doneroute .n { width: 20px; height: 20px; font-size: 0.7rem; }
  }
  .doneroute .n, .stops .n {
    flex: 0 0 auto;
    width: 24px; height: 24px;
    display: grid; place-items: center;
    border-radius: 999px;
    background: var(--cat);
    color: #fff;
    font-size: 0.78rem;
    font-weight: 700;
  }


  /* ---- build screen ---- */
  .build {
    min-height: calc(100dvh - 88px); /* fill above the tab bar so the footer link can dock */
    padding: 18px var(--gutter) 8px;
    padding-top: var(--pad-top);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  /* recommend: push "Tự chọn 5 điểm" to the bottom of the screen */
  /* the tab bar is showing here, so the .app's nav clearance already provides the
     bottom air — the dock only needs a little of its own */
  .build .dock { padding-bottom: 8px; }
  /* manual: lock to the viewport so the list scrolls INSIDE its region — the
     flowers stay docked above the CTA instead of scrolling onto it (screen 12) */
  /* manual builder is a full-bleed map: the region fills the screen, everything else
     floats over it (explore pattern). */
  .build.manual { height: 100dvh; min-height: 0; overflow: hidden; position: relative; padding: 0; }
  /* title is sr-only here — the map is the screen; the back chip is the only top chrome */
  .build.manual .b-head {
    position: absolute; width: 1px; height: 1px;
    padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
  }
  .build.manual .viewregion { position: absolute; inset: 0; }
  /* list keeps the suggested-sets card width (18px page gutter) and scrolls clear of
     the floating bottom block */
  .build.manual .viewregion .list {
    padding-left: 18px; padding-right: 18px;
    padding-bottom: calc(210px + env(safe-area-inset-bottom));
  }
  /* one floating block at the bottom: dots + prim/sec row + sub line */
  .buildbar {
    position: absolute; z-index: 8; overflow: hidden;
    left: 12px; right: 12px; bottom: calc(14px + env(safe-area-inset-bottom));
    max-width: 460px; margin: 0 auto;
    display: flex; flex-direction: column; gap: 10px;
    padding: 12px; border-radius: 20px;
    background: var(--surface);
    border: 1px solid color-mix(in srgb, var(--brand-dark) 12%, transparent);
    box-shadow: 0 20px 48px -18px rgba(60, 30, 20, 0.5), 0 3px 10px rgba(60, 30, 20, 0.14);
  }
  .buildbar .slotbtns { margin: 0; justify-content: center; }
  /* the prim/sec row is the global .dock.row; inside this floating card it needs no
     clearance of its own, and the sub line stays compact so the card keeps its height
     (the list padding / map controls offset are tuned to it) */
  .buildbar .dock { padding: 0; margin: 0; }
  .buildbar .sub { min-height: 0; padding: 2px; font-size: 0.85rem; }
  .b-head { display: flex; flex-direction: column; gap: 3px; }
  .b-sub { margin: 0; color: var(--muted); font-size: 0.95rem; }

  /* slots double as step nav; bottom-anchored, sitting just above the docked
     CTA/clear-all like a secondary control row */
  .slotbtns { display: flex; gap: 8px; margin-top: auto; }
  .slotbtns .slot {
    flex: 1 1 0;
    aspect-ratio: 1;
    max-width: 56px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    border: 1.5px dashed color-mix(in srgb, var(--ink) 20%, transparent);
    background: transparent;
    cursor: pointer;
    transition: border-color 0.14s, background 0.14s;
  }
  .slotbtns .slot.filled { border-style: solid; border-color: transparent; background: color-mix(in srgb, var(--bg) 90%, transparent); }
  .slotbtns .slot.on { border-color: var(--brand); }


  /* universal back button — fixed top-left, mirroring the layout's theme chip
     (top-right) so the two line up on one row above the title */
  .backchip {
    position: fixed; z-index: 1100;
    top: max(30px, calc(env(safe-area-inset-top) + 20px));
    left: 14px;
    width: 40px; height: 34px; border-radius: 999px;
    display: grid; place-items: center; cursor: pointer;
    border: 1px solid var(--line);
    background: color-mix(in srgb, var(--surface) 80%, transparent);
    backdrop-filter: blur(10px);
    color: var(--ink); font-size: 1.2rem; line-height: 1;
  }
  .backchip:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  /* view region: the map fills the top and the switch (and, on the free step, the
     category chips) hover over it — the same device as the Explore tab, and the
     SAME in both map and list mode so screens 9 and 10 line up. */
  .viewregion { position: relative; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
  /* switch + filter share --map-topbar-w (nav-pill width) and centre — same as Explore */
  /* the switch + chip row are the global .float-top / .float-top.row2 (app.css) */
  /* the list scrolls inside the region, under the pinned switch/chips */
  /* same top anchor on every step — the 1+1 steps leave the filter-bar gap empty so the
     first card lines up with the pick-3 (free) step, which has the filter bar */
  .viewregion .list { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding-top: max(130px, calc(env(safe-area-inset-top) + 124px)); }
  /* map fills the region rather than a fixed 56vh */
  .viewregion .mapwrap { flex: 1 1 auto; height: auto; min-height: 260px; }

  /* ---- recommend view ---- */
  .sets { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
  .setcard {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .setcard.top { border-color: color-mix(in srgb, var(--brand) 55%, var(--line)); }
  .set-head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border: 0;
    background: none;
    cursor: pointer;
    text-align: left;
  }
  .set-h-body { flex: 1 1 auto; min-width: 0; display: grid; gap: 2px; }
  .set-h-body b { font-size: 1.1rem; font-weight: 700; letter-spacing: -0.01em; }
  .set-h-body small { color: var(--muted); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .set-h-body .set-dist { color: var(--ink); font-weight: 600; margin-top: 2px; }
  .caret { flex: 0 0 auto; color: var(--muted); }
  .set-body { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 10px; }
  .rec-badge {
    justify-self: start;
    background: var(--brand);
    color: #fff;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 2px 9px;
    border-radius: 999px;
    margin-bottom: 2px;
  }
  .setcard .narr { margin: 0; color: var(--muted); font-size: 0.9rem; line-height: 1.5; }
  .stops { list-style: none; margin: 0; padding: 8px 0 0; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 8px; }
  .stops li { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .stops b { font-weight: 600; font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .setcard .btn { margin-top: 2px; }

  .fill-link {
    display: block; margin: 10px auto 0;
    border: 0; background: none; padding: 6px;
    color: var(--brand); font-family: var(--font-body); font-weight: 700; font-size: 0.9rem;
    cursor: pointer; text-decoration: underline; text-underline-offset: 3px;
  }

  /* borderless soft-shadow cards on the paper, matching the language screen */
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex; flex-direction: column; gap: 8px;
  }
  .row {
    flex: 0 0 auto; /* don't shrink in the scrolling flex column — rows keep height */
    border: 0; border-radius: 16px; overflow: hidden;
    background: var(--surface);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 6px 16px rgba(0, 0, 0, 0.05);
  }
  .row.picked { background: color-mix(in srgb, var(--brand) 8%, var(--surface)); }
  .row-main { display: flex; align-items: center; }
  .row-tap {
    flex: 1 1 auto; min-width: 0;
    display: flex; align-items: center; gap: 12px;
    border: 0; background: none; padding: 12px 14px; cursor: pointer;
    text-align: left; text-decoration: none; color: inherit;
  }
  .caret { flex: 0 0 auto; color: var(--muted); font-size: 0.8rem; }
  /* inline detail, opened accordion-style like the suggested sets */
  .row-detail { padding: 0 14px 14px; }
  .rd-desc { margin: 0; color: var(--muted); font-size: 0.86rem; line-height: 1.5; }
  .body { min-width: 0; flex: 1 1 auto; display: grid; gap: 1px; }
  .body b { font-weight: 600; font-size: 0.98rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* one-line summary — CSS ellipsis so any-length description fits one row */
  .body .sum { color: var(--ink); opacity: 0.7; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .body .meta { color: var(--muted); font-size: 0.76rem; }
  .body em { font-style: normal; font-weight: 600; }
  .body em.open { color: var(--teal); }
  .body em.closed { color: var(--muted); }
  .body em.soon { color: var(--gold); }
  .add {
    flex: 0 0 auto;
    margin-right: 12px; cursor: pointer;
    width: 32px; height: 32px;
    border-radius: 999px;
    border: 1.5px solid var(--line);
    background: transparent;
    color: var(--muted);
    font-size: 1.1rem;
    line-height: 1;
    display: grid; place-items: center;
    transition: background 0.14s, border-color 0.14s, color 0.14s;
  }
  .add.on { background: var(--brand); border-color: var(--brand); color: #fff; }

  .mapwrap {
    height: 56vh; min-height: 320px;
    border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden;
  }

  /* the plan-ready CTA is the global .dock.fixed (app.css) */
  .build.committing { padding-bottom: 120px; }
</style>
