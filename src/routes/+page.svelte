<script>
  import { base } from '$app/paths';
  import { onMount, onDestroy, untrack } from 'svelte';
  import { ui } from '$lib/ui.svelte.js';
  import destinations from '$lib/data/destinations.json';
  import categories from '$lib/data/categories.json';
  import tours from '$lib/data/tours.json';
  import event from '$lib/data/event.json';
  import TicketScan from '$lib/components/TicketScan.svelte';
  import BuilderMap from '$lib/components/BuilderMap.svelte';
  import ViewToggle from '$lib/components/ViewToggle.svelte';
  import RouteMap from '$lib/components/RouteMap.svelte';
  import MatCua from '$lib/components/MatCua.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { rankSets } from '$lib/advisor.js';
  import { isValidSet } from '$lib/ticket.js';
  import { weather } from '$lib/weather.svelte.js';
  import { stats } from '$lib/stats.svelte.js';
  import { spotlightIds } from '$lib/score.js';
  import { distanceMeters } from '$lib/geo.js';
  import { formatDistance, optimizeRoute, routeStats } from '$lib/route.js';
  import { hasStamp, adoptCode, restore, track } from '$lib/passport.svelte.js';
  import { codeFromTicket } from '$lib/backup.js';
  import { plan, setOnboarded, setTicketCode, setPlanSet } from '$lib/plan.svelte.js';
  import { setNat } from '$lib/study.svelte.js';
  import { LANGS } from '$lib/languages.js';
  import { openLabel, categoryLabel, categoryIcon } from '$lib/util.js';
  import { i18n, t, setLang } from '$lib/i18n.svelte.js';
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

  // ---- onboarding: welcome -> scan -> build -> done ----
  // ?step=welcome|scan|recommend|manual|done forces a screen regardless of the
  // onboarded/plan flags, so the /screens board (and testers) can open each one
  // directly — otherwise they're internal state, unreachable once localStorage
  // has onboarded:true. recommend/manual map to build + the two build modes.
  const forced =
    (typeof location !== 'undefined' &&
      /^(door|lang|welcome|install|scan|perms|recommend|manual|done)$/.exec(
        new URLSearchParams(location.search).get('step') || ''
      )?.[0]) ||
    '';
  // the board's manual deep-link params (?view=, ?pick=), read synchronously
  const q0 = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  let step = $state(
    /^(door|lang|welcome|install|scan|perms|done)$/.test(forced) ? forced : forced ? 'build' : plan.onboarded ? 'build' : 'door'
  );
  // the two door leaves swing open on tap, then the language screen appears
  let opening = $state(false);
  function openDoor() {
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      step = 'lang';
      return;
    }
    opening = true;
    setTimeout(() => (step = 'lang'), 620);
  }

  // App-value lines, shown on the (now post-language) welcome screen so they read
  // in the visitor's chosen locale. ponytail: inline, not strings.js — three lines,
  // one caller.
  const FEATURES = [
    { name: 'map', vi: 'Khám phá 25 điểm di sản', en: 'Explore 25 heritage sites on an offline map' },
    { name: 'ticket', vi: 'Nhận tem tại mỗi điểm', en: 'Check in and collect passport stamps' },
    { name: 'compass', vi: 'Tạo lịch trình 5 điểm cho vé của bạn', en: 'Plan the 5 sites your ticket covers' }
  ];

  // The greeting IS the picker — a visitor taps the hello in their own language, no
  // instructions needed. Shared list (also the passport switcher) lives in languages.js.

  // iOS gets the Share-sheet steps, everything else the browser-menu steps. Set
  // on mount because navigator is absent during prerender.
  let ios = $state(false);

  onMount(() => {
    if (step === 'welcome') track('welcome');
    ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    // board preview (?step=recommend): expand the top set so the frame shows its
    // map + stops, not just collapsed titles.
    // board preview: expand the top set by default; ?open=0 keeps all collapsed.
    if (forced === 'recommend' && recommended.length &&
        new URLSearchParams(location.search).get('open') !== '0') openSet = recommended[0].id;
    // board preview (?step=done): the done summary needs a plan to render — seed
    // one from the first ticket set if the device has none.
    if (forced === 'done' && !pickedIds.length && ticketSets.length) applySet(ticketSets[0].stops);
    // board preview (?step=manual): view + pick are read synchronously at init (see
    // viewMode / stepIdx above) so the list deep-link never transiently mounts the map
  });

  // Record the language signal for the nationality study (see counts.js): the
  // device locale's primary subtag (navigator.language, e.g. ko-KR -> "ko") AND
  // the language the visitor actually picked. Both are anonymous aggregate counts.
  function trackLang(pick) {
    const loc = (typeof navigator !== 'undefined' && navigator.language || '')
      .toLowerCase()
      .split('-')[0];
    if (/^[a-z]{2,3}$/.test(loc)) track('lang', loc);
    track('pick', pick);
  }
  // vi/en switch the built-in content; every other choice has no locale file, so it
  // displays English (the most translatable base) and rides the browser's own
  // page-translate (Chrome/Safari/Edge). No embedded widget — that would be a
  // third-party script on the offline critical path. (CLAUDE.md: built locales are
  // vi/en only.) The pick is still recorded, which is the point of the study.
  function chooseLang(l) {
    setLang(l.display ?? 'en');
    setNat(l.code); // nationality proxy for the study — tag events from here on
    trackLang(l.code);
    track('welcome');
    step = 'welcome';
  }
  function otherLang() {
    setLang('en');
    setNat('other');
    trackLang('other');
    track('welcome');
    step = 'welcome';
  }
  async function onScanned(raw) {
    setTicketCode(raw);
    const code = codeFromTicket(raw);
    if (code) {
      // The ticket QR IS the recovery key: adopt its derived code so this device's
      // backups go there, then pull any passport already backed up under it (a second
      // phone, a reinstall) and merge. Best-effort — a 404 (first device with this
      // ticket) or being offline is not an error, scanning still completes.
      adoptCode(code);
      try {
        // don't let a slow/hanging fetch stall onboarding on flaky event wifi — cap the
        // wait; if the merge lands after this, it still applies (restore mutates in place)
        await Promise.race([
          restore(code),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
        ]);
      } catch {
        // no prior backup / no server / offline / slow — nothing to merge now, carry on
      }
    }
    track('scan');
    scanned = true; // don't auto-advance — visitor taps Continue
  }
  // Continue (vs Skip) once a ticket exists — this session's scan OR one already
  // saved on the device (TicketScan uses the same key).
  let scanned = $state(typeof localStorage !== 'undefined' && !!localStorage.getItem('hacw_ticket_v1'));
  let ticketScan = $state(); // bound child — page footer drives its start()

  // hide the tab bar on the manual builder + plan-ready screens (their own back
  // button is the way out); recommend keeps it. reset when leaving the route.
  const STEP_SCREENS = ['door', 'lang', 'welcome', 'install', 'scan', 'perms', 'done'];
  $effect(() => {
    ui.hideNav = step === 'done' || (mode === 'manual' && !STEP_SCREENS.includes(step));
  });
  onDestroy(() => (ui.hideNav = false));
  const scanSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  // Ask for GPS + motion up front (from this tap — iOS requires a user gesture for
  // DeviceMotion/Orientation). Both prompts are best-effort; a denial is fine, the
  // map re-asks for location later and the compass just stays off.
  async function requestPerms() {
    try {
      navigator.geolocation?.getCurrentPosition(() => {}, () => {}, { timeout: 8000 });
    } catch {}
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission)
        await DeviceMotionEvent.requestPermission();
      if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission)
        await DeviceOrientationEvent.requestPermission();
    } catch {}
  }
  function finishOnboarding() {
    setOnboarded();
    step = 'build';
  }

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

  // "nearest" reference: the cluster of sites already picked (so the next pick keeps
  // the walk compact), else the town centre. No GPS here — the picker sorts by these,
  // and location is requested at check-in / on the map, where it actually matters.
  const TOWN_CENTRE = { lat: 15.8772, lng: 108.3275 };
  const origin = TOWN_CENTRE;
  const picks = $derived(pickedIds.map((id) => byId[id]).filter(Boolean));
  function distFor(d) {
    if (picks.length) return Math.min(...picks.filter((p) => p.id !== d.id).map((p) => distanceMeters(p, d)).concat(Infinity));
    return distanceMeters(TOWN_CENTRE, d);
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
  const CAP = $derived(
    listH ? Math.max(3, Math.floor((listH - (onFree ? 104 : 62) - 44) / 62)) : 8
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
    applySet(set.stops.map((d) => d.id));
    finish();
  }

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
    free = [...free, ...bestFrom(groups.other.filter((d) => !free.includes(d.id)), 3 - free.length)];
  }
  // "pick the rest for me" — fills every empty slot (monument, museum, free)
  function autoComplete() {
    if (!mono) mono = bestFrom(groups.monument, 1)[0] ?? null;
    if (!museo) museo = bestFrom(groups.museum, 1)[0] ?? null;
    if (free.length < 3) autoFree();
    stepIdx = firstIncomplete();
  }

  const orderedPlan = $derived(optimizeRoute(pickedIds.map((id) => byId[id])));
  const planWalk = $derived(routeStats(orderedPlan));

  function finish() {
    if (!valid) return;
    setPlanSet(orderedPlan.map((d) => d.id)); // save in shortest-walk order
    track('plan_built');
    step = 'done';
  }
  function editPlan() {
    step = 'build';
    mode = 'manual';
    stepIdx = firstIncomplete();
  }
  function resetPicks() {
    mono = null;
    museo = null;
    free = [];
    catFilter = null;
    stepIdx = 0;
  }
</script>

{#if step === 'door'}
  <!-- SCREEN 1 — the door of Hội An. Tap the mắt cửa and the leaves swing open. -->
  <section class="door" class:opening>
    <button class="door-tap" onclick={openDoor} aria-label="Bắt đầu · Enter">
      <span class="frame">
        <span class="leaf left"></span>
        <span class="leaf right"></span>
        <span class="seam"></span>
        <span class="eye"><MatCua size={92} color="var(--brand)" inner="var(--paper)" /></span>
      </span>
      <span class="door-hint">Chạm để mở<small>Tap to enter</small></span>
    </button>
    <p class="door-brand">Hội An Creative Week · {event.year}</p>
  </section>
{:else if step === 'lang'}
  <!-- SCREEN 2 — the greeting IS the picker: no headings, no instructions, just a
       grid of hellos anyone recognises in their own language. -->
  <section class="langscreen">
    <div class="glangs">
      {#each LANGS as l (l.code)}
        <button class="glang" onclick={() => chooseLang(l)} aria-label={l.name}>
          <span class="g-hello" lang={l.code}>{l.hello}</span>
          <span class="g-name">{l.name}</span>
        </button>
      {/each}
      <button class="glang other" onclick={otherLang} aria-label="Other language">
        <span class="g-hello"><Icon name="globe" size={28} /></span>
        <span class="g-name">Other</span>
      </button>
    </div>
  </section>
{:else if step === 'welcome'}
  <!-- SCREEN 3 — welcome, in the chosen language, three lines + one CTA -->
  <section class="welcome intro">
    <div class="intro-head">
      <h1 class="w-title"><span class="w-pre">Thử thách</span><br />Xuyên Mạch Nghệ</h1>
    </div>

    <ul class="w-feats">
      {#each FEATURES as f (f.name)}
        <li><span class="fi"><Icon name={f.name} size={22} /></span><span class="ft">{t(f)}</span></li>
      {/each}
    </ul>

    <div class="w-foot">
      <button class="btn ghost" onclick={() => (step = 'install')}>{s('install')}</button>
      <button class="btn" onclick={() => (step = 'perms')}>{s('welcome_start')}</button>
    </div>
  </section>
{:else if step === 'install'}
  <section class="onboard scan">
    <h1>{s('install_title')}</h1>

    <div class="scan-mid">
      <p class="lead">{s('install_why')}</p>
      <ol class="isteps">
        {#each ios ? [s('install_ios_1'), s('install_ios_2')] : [s('install_android_1'), s('install_android_2')] as st, i (i)}
          <li>{st}</li>
        {/each}
      </ol>
    </div>

    <div class="scan-foot">
      <button class="btn" onclick={() => (step = 'perms')}>{s('install_next')}</button>
      <div class="subpad" aria-hidden="true"></div>
    </div>
  </section>
{:else if step === 'scan'}
  <section class="onboard scan">
    <h1>{s('scan_title')}</h1>

    <div class="scan-mid">
      <TicketScan bind:this={ticketScan} onsaved={onScanned} hero />
    </div>

    <div class="scan-foot">
      {#if scanned}
        <button class="btn" onclick={finishOnboarding}>{s('scan_continue')}</button>
      {:else}
        <a class="btn ghost" href="{base}/destinations?tickets=1">{s('buy_ticket')}</a>
        {#if scanSupported}<button class="btn" onclick={() => ticketScan?.start()}>{s('scan_btn')}</button>{/if}
        <button class="skip" onclick={finishOnboarding}>{s('scan_skip')}</button>
      {/if}
    </div>
  </section>
{:else if step === 'perms'}
  <section class="onboard scan">
    <h1>{s('perm_title')}</h1>

    <div class="scan-mid">
      <ul class="w-feats">
        <li><span class="fi"><Icon name="map" size={22} /></span><span class="ft">{s('perm_gps')}</span></li>
        <li><span class="fi"><Icon name="compass" size={22} /></span><span class="ft">{s('perm_motion')}</span></li>
      </ul>
    </div>

    <div class="scan-foot">
      <!-- one button: Tiếp tục grants location + motion, then moves on -->
      <button class="btn" onclick={() => { requestPerms(); step = 'scan'; }}>{s('scan_continue')}</button>
      <p class="terms">{s('terms_pre')}<a href="{base}/terms">{s('terms_link')}</a>{s('terms_post')}</p>
    </div>
  </section>
{:else if step === 'done'}
  <section class="onboard done">
    <h1>{s('done_title')}</h1>
    <p class="walk-sum">{s('route_walk', formatDistance(planWalk.meters, i18n.lang), planWalk.minutes)}</p>

    <div class="donemap"><RouteMap stops={orderedPlan} height="200px" /></div>
    <ol class="doneroute">
      {#each orderedPlan as d, i (d.id)}
        <li><span class="n" style="--cat: var(--c-{d.category})">{i + 1}</span> {t(d.name)}</li>
      {/each}
    </ol>
  </section>
  <!-- primary CTA docked above the tab bar; the edit-plan action rides below it as a
       secondary button (replacing the old top back chip) -->
  <div class="commitbar">
    <a class="btn done-cta" href="{base}/go">{s('go_checkin')}</a>
    <button class="skip" onclick={editPlan}>{s('edit_plan')}</button>
  </div>
{:else if mode === 'recommend'}
  <div class="build">
    <header class="b-head">
      <h1>{s('rec_head')}</h1>
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

    <button class="skip" onclick={() => { mode = 'manual'; stepIdx = firstIncomplete(); }}>
      {s('pick_own')}
    </button>
  </div>
{:else}
  <div class="build manual committing">
    <button class="backchip" onclick={() => (mode = 'recommend')} aria-label={s('back')}>←</button>
    <header class="b-head">
      <h1>{s('plan_title')}</h1>
    </header>

    <!-- map/list view; the switch hovers top-centre over the map, like Explore -->
    <div class="viewregion" class:ismap={viewMode === 'map'} class:free={onFree}>
      <div class="viewfloat"><ViewToggle bind:mode={viewMode} /></div>

      {#if onFree}
        <!-- free pool is large; category chips double as a legend -->
        <div class="catfilter">
          <button class="fchip" class:on={!catFilter} onclick={() => (catFilter = null)}>{s('all_cats')}</button>
          {#each freeCats as c (c)}
            <button
              class="fchip"
              class:on={catFilter === c}
              style="--c: var(--c-{c})"
              onclick={() => (catFilter = catFilter === c ? null : c)}
            >
              {categoryIcon(c)} {t(categoryLabel(c))}
            </button>
          {/each}
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
                <button class="row-tap" onclick={() => (openRow = open ? null : d.id)} aria-expanded={open}>
                  <span class="mark" style="--cat: var(--c-{d.category})">
                    <MatCua size={30} color="var(--cat)" inner="var(--surface)" ghost={!picked} />
                  </span>
                  <span class="body">
                    <b>{t(d.name)}</b>
                    <small class="meta">
                      {t(categoryLabel(d.category))}{#if oh} · <em class={oh.status}>{oh.text}</em>{/if}
                    </small>
                  </span>
                  <span class="caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
                </button>
                <button class="add" class:on={picked} onclick={() => pick(d.id)} aria-pressed={picked} aria-label={picked ? s('pick_remove') : s('pick_do')}>{picked ? '✓' : '+'}</button>
              </div>
              {#if open}
                <div class="row-detail">
                  <p class="rd-desc">{t(d.description)}</p>
                  <p class="rd-addr">📍 {t(d.address)}</p>
                  <a class="rd-link" href="{base}/destinations/{d.id}">{s('see_site')}</a>
                </div>
              {/if}
            </li>
          {/each}
        </ul>

        {#if onFree && rankedList.length > CAP}
          {#if showAll}
            <button class="link fill-link" onclick={() => (showAll = false)}>{s('list_less')}</button>
          {:else}
            <button class="link fill-link" onclick={() => (showAll = true)}>{s('list_more', rankedList.length - CAP)}</button>
          {/if}
        {/if}
      {:else}
        <!-- map mode: tap a pin to add/remove; mounted only in this branch so it never inits at 0×0 -->
        <div class="mapwrap"><BuilderMap eligible={eligibleIds} picked={pickedIds} catFilter={onFree ? catFilter : null} onpick={pick} controlsTop={onFree ? '104px' : '64px'} /></div>
      {/if}
    </div>

    <!-- progress: the 5 slots double as step nav; tap one to edit that class -->
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


  </div>
  <!-- one docked footer for every state: a primary action on top, a sub line below.
       empty → "tap a point" hint; picking → auto-fill + clear-all; full → continue. -->
  <div class="commitbar">
    {#if valid}
      <button class="btn done-cta" onclick={finish}>{s('build_done')}</button>
    {:else}
      <button class="btn done-cta" onclick={autoComplete}>{s('auto_pick', remaining)}</button>
    {/if}
    {#if pickedIds.length}
      <button class="skip" onclick={resetPicks}>{s('reset_picks')}</button>
    {:else}
      <span class="pick-hint">{s('pick_hint')}</span>
    {/if}
  </div>
{/if}

<style>
  /* ---- onboarding + done: bare, no topbar ---- */
  .welcome,
  .onboard {
    position: relative;
    min-height: 78vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 32px 26px calc(32px + env(safe-area-inset-bottom));
    padding-top: max(30px, calc(env(safe-area-inset-top) + 20px));
  }
  .welcome { justify-content: flex-start; min-height: 100dvh; }
  /* intro fills the screen: brand at top, features centred, CTA at the bottom —
     so it reads as a full panel on a phone and spreads gracefully on a tablet,
     instead of a small block adrift in the middle. */
  .intro { justify-content: space-between; gap: 28px; }
  .intro-head { display: flex; flex-direction: column; }

  /* language screen: a full-bleed grid of greetings, nothing else */
  .langscreen {
    min-height: 100dvh;
    display: flex; flex-direction: column; justify-content: center;
    padding: 32px 22px calc(32px + env(safe-area-inset-bottom));
  }
  .glangs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .glang {
    display: flex; flex-direction: column; gap: 6px;
    min-height: 92px; padding: 16px 14px;
    border: 1px solid var(--line); background: var(--surface);
    border-radius: var(--radius); cursor: pointer; text-align: left;
    transition: border-color 0.14s ease, background 0.14s ease, transform 0.06s ease;
  }
  .glang:hover { border-color: color-mix(in srgb, var(--brand) 55%, var(--line)); }
  .glang:active { transform: translateY(1px); }
  .glang:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .g-hello {
    font-family: var(--font-display); font-weight: 700; color: var(--ink);
    font-size: clamp(1.25rem, 5.5vw, 1.7rem); line-height: 1.05; letter-spacing: -0.02em;
  }
  .g-name { color: var(--muted); font-weight: 600; font-size: 0.82rem; }
  .glang.other { align-items: flex-start; }
  .glang.other .g-hello { color: var(--brand); }

  /* ---- door screen ---- */
  .door {
    position: relative;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 26px;
    padding: 32px 26px calc(32px + env(safe-area-inset-bottom));
  }
  .door-tap {
    display: flex; flex-direction: column; align-items: center; gap: 26px;
    border: 0; background: none; cursor: pointer; padding: 0;
  }
  .frame {
    position: relative;
    width: min(64vw, 250px);
    aspect-ratio: 3 / 4;
    border-radius: 140px 140px 14px 14px;
    border: 3px solid var(--brand-dark);
    background: var(--paper-2);
    overflow: hidden;
    box-shadow: 0 24px 50px -20px rgba(126, 31, 19, 0.35);
  }
  /* two wooden leaves, faint plank lines, meeting at a centre seam */
  .leaf {
    position: absolute; top: 0; bottom: 0; width: 50%;
    background:
      repeating-linear-gradient(90deg, transparent 0 22px, color-mix(in srgb, var(--brand-dark) 12%, transparent) 22px 23px),
      linear-gradient(160deg, color-mix(in srgb, var(--brand) 22%, var(--paper-2)), var(--paper-2));
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s ease;
  }
  .leaf.left { left: 0; border-right: 1.5px solid color-mix(in srgb, var(--brand-dark) 30%, transparent); border-radius: 140px 0 0 12px; }
  .leaf.right { right: 0; border-radius: 0 140px 12px 0; }
  .seam { position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; transform: translateX(-1px); background: color-mix(in srgb, var(--brand-dark) 26%, transparent); }
  .eye {
    position: absolute; left: 50%; top: 30%; transform: translate(-50%, -50%);
    z-index: 2; filter: drop-shadow(0 6px 12px rgba(126, 31, 19, 0.28));
    transition: opacity 0.4s ease, transform 0.4s ease;
  }
  /* opening: leaves swing apart, eye fades back into the doorway */
  .door.opening .leaf.left { transform: translateX(-102%); opacity: 0.15; }
  .door.opening .leaf.right { transform: translateX(102%); opacity: 0.15; }
  .door.opening .seam { opacity: 0; }
  .door.opening .eye { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
  .door-hint {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    font-family: var(--font-display); font-weight: 700; font-size: 1.25rem;
    color: var(--brand-dark); letter-spacing: -0.01em;
  }
  .door-hint small { font-family: var(--font-body); font-weight: 500; font-size: 0.85rem; color: var(--muted); letter-spacing: 0; }
  .door.opening .door-hint { opacity: 0.4; transition: opacity 0.3s ease; }
  .door-brand { margin: 0; color: var(--muted); font-size: 0.8rem; letter-spacing: 0.04em; }
  @media (prefers-reduced-motion: reduce) {
    .leaf, .eye { transition: none; }
  }

  .w-title {
    margin: 0 0 10px;
    font-family: var(--font-display);
    font-weight: 800;
    color: var(--ink);
    font-size: clamp(1.7rem, 7vw, 2.3rem);
    line-height: 1.05;
    letter-spacing: -0.02em;
  }
  .w-title .w-pre { font-weight: 400; }
  .w-meta { margin: 0 0 26px; color: var(--muted); font-size: 0.85rem; }

  .w-feats { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 16px; }
  .w-feats li { display: flex; align-items: center; gap: 13px; }
  .w-feats .fi { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: color-mix(in srgb, var(--brand) 10%, transparent); color: var(--brand); }
  .w-feats .ft { color: var(--ink); font-weight: 600; font-size: 0.98rem; line-height: 1.35; }
  .intro .btn { width: 100%; }
  /* 50px lifts Bắt đầu to the same offset the perms/scan main sits at (their 40px
     sub slot + gap), so the primary button lands at one height across onboarding */
  .w-foot { display: flex; flex-direction: column; gap: 10px; margin-bottom: 50px; }
  .w-foot .btn { width: 100%; }

  .onboard h1 {
    margin: 0 0 8px;
    font-family: var(--font-display);
    font-weight: 800;
    color: var(--ink);
    font-size: clamp(1.7rem, 7vw, 2.2rem);
    line-height: 1.1;
  }
  .onboard.done { padding-bottom: calc(130px + env(safe-area-inset-bottom)); justify-content: flex-start; padding-top: max(30px, calc(env(safe-area-inset-top) + 20px)); }
  /* total walk under the title */
  .walk-sum { margin: 4px 0 0; color: var(--muted); font-size: 0.95rem; font-weight: 600; }
  .donemap { width: 100%; margin: 14px 0 12px; border-radius: 12px; overflow: hidden; border: 1px solid var(--line); }
  .doneroute { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 8px; width: 100%; }
  .doneroute li { display: flex; align-items: center; gap: 10px; font-size: 0.95rem; }
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
  .skip {
    margin: 18px auto 0;
    display: block;
    border: 0;
    background: none;
    color: var(--muted);
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 0.9rem;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  /* scan step: title top, QR + toggles centred, action docked at the bottom
     like the welcome Start button */
  .onboard.scan { min-height: 100dvh; justify-content: space-between; }
  .scan-mid { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; gap: 22px; }
  .scan-mid .lead { margin: 0; text-align: center; color: var(--ink); font-size: 1.05rem; line-height: 1.5; }
  .isteps {
    margin: 0 auto; padding: 0; max-width: 34ch; list-style: none; counter-reset: istep;
    display: flex; flex-direction: column; gap: 14px;
  }
  .isteps li {
    counter-increment: istep; position: relative; padding-left: 40px; line-height: 1.5; color: var(--ink);
  }
  .isteps li::before {
    content: counter(istep); position: absolute; left: 0; top: 0;
    width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
    background: var(--grad-brand, var(--brand)); color: #fff; font-weight: 800; font-size: 0.9rem;
  }
  /* shared footer: secondary (ghost/white) above, main (orange) below, sub last */
  .scan-foot { display: flex; flex-direction: column; gap: 10px; }
  .scan-foot .btn { width: 100%; }
  /* .btn.ghost is global (app.css) — shared with InstallApp on the welcome screen */
  /* fixed-height sub slot so the main button lands at the same offset on every
     onboarding screen, whether the sub is a one-line skip or a two-line terms note */
  .scan-foot .skip {
    margin: 0 auto; min-height: 40px; display: flex; align-items: center; justify-content: center;
  }
  .scan-foot .terms {
    margin: 0 auto; min-height: 40px; max-width: 34ch;
    text-align: center; color: var(--muted); font-size: 0.8rem; line-height: 1.4;
  }
  /* install screen has its sub above the main (Need help?), so this empty slot
     below Next keeps the main button at the same offset as the other screens */
  .scan-foot .subpad { min-height: 40px; }


  /* ---- build screen ---- */
  .build {
    min-height: calc(100dvh - 88px); /* fill above the tab bar so the footer link can dock */
    padding: 18px 18px 8px;
    padding-top: max(30px, calc(env(safe-area-inset-top) + 20px));
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  /* recommend: push "Tự chọn 5 điểm" to the bottom of the screen */
  .build .skip { margin-top: auto; padding-top: 20px; }
  /* manual: lock to the viewport so the list scrolls INSIDE its region — the
     flowers stay docked above the CTA instead of scrolling onto it (screen 12) */
  .build.manual { height: 100dvh; min-height: 0; overflow: hidden; }
  /* manual: title shares the fixed back/theme chip row; indent past the back chip */
  .build.manual .b-head { padding-left: 44px; }
  .b-head { display: flex; flex-direction: column; gap: 3px; }
  .b-head h1 { margin: 0; font-size: clamp(1.9rem, 7vw, 2.4rem); font-weight: 800; letter-spacing: -0.02em; }
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
  .viewfloat {
    position: absolute; z-index: 7;
    top: 8px; left: 0; right: 0;
    box-shadow: 0 2px 10px rgba(60, 30, 20, 0.12); border-radius: 999px;
  }
  /* chips ride just under the switch, over the view (free step only) — each a soft
     floating pill so the row reads cleanly over the map, not as a heavy band */
  .viewregion.free .catfilter {
    position: absolute; z-index: 6; top: 56px; left: 0; right: 0;
    margin: 0; padding: 2px 2px 4px; gap: 6px;
  }
  .viewregion.free .catfilter .fchip { box-shadow: 0 2px 8px rgba(60, 30, 20, 0.1); }
  /* the list scrolls inside the region, under the pinned switch/chips */
  .viewregion .list { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding-top: 62px; }
  .viewregion.free .list { padding-top: 104px; }
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

  /* free-pool category filter — chips carry each category's accent (also the legend) */
  .catfilter { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
  .catfilter::-webkit-scrollbar { display: none; }
  .fchip {
    flex: 0 0 auto;
    border: 1.5px solid var(--line);
    background: var(--surface);
    color: var(--muted);
    border-radius: 999px;
    padding: 6px 12px;
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 0.8rem;
    white-space: nowrap;
    cursor: pointer;
    transition: border-color 0.14s, color 0.14s, background 0.14s;
  }
  .fchip.on {
    color: var(--ink);
    border-color: var(--c, var(--brand));
    background: color-mix(in srgb, var(--c, var(--brand)) 16%, transparent);
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
  .row-detail {
    padding: 0 14px 14px 56px; display: flex; flex-direction: column; gap: 6px;
  }
  .rd-desc { margin: 0; color: var(--muted); font-size: 0.86rem; line-height: 1.5; }
  .rd-addr { margin: 0; color: var(--ink); font-size: 0.82rem; }
  .rd-link {
    align-self: flex-start; color: var(--brand); font-weight: 700;
    font-size: 0.85rem; text-decoration: none;
  }
  .mark { flex: 0 0 auto; display: grid; place-items: center; }
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

  .done-cta { width: 100%; margin-top: 4px; }

  /* docked finish bar — sits above the tab bar so the commit CTA is reachable the
     instant 5 are picked, instead of below the 56vh picking map */
  .build.committing { padding-bottom: 120px; }
  /* flush footer, onboarding-style: full-width CTA docked at the true bottom (nav is
     hidden on these screens) with the clear-all link below it */
  .commitbar {
    position: fixed;
    left: 12px; right: 12px;
    bottom: calc(16px + env(safe-area-inset-bottom));
    max-width: 460px; margin: 0 auto;
    display: flex; flex-direction: column; gap: 4px;
    z-index: 900;
    animation: rise 0.3s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .commitbar .done-cta { width: 100%; margin: 0; }
  .commitbar .skip { margin: 4px auto 0; }
  /* empty-state hint occupies the same sub slot as the clear-all button */
  .pick-hint { margin: 8px auto 2px; color: var(--muted); font-size: 0.9rem; font-weight: 600; }
  @media (prefers-reduced-motion: reduce) { .commitbar { animation: none; } }
</style>
