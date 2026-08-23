<script>
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
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
  import StudyToggle from '$lib/components/StudyToggle.svelte';
  import JourneyToggle from '$lib/components/JourneyToggle.svelte';
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
      /^(door|lang|welcome|scan|recommend|manual|done)$/.exec(
        new URLSearchParams(location.search).get('step') || ''
      )?.[0]) ||
    '';
  let step = $state(
    /^(door|lang|welcome|scan|done)$/.test(forced) ? forced : forced ? 'build' : plan.onboarded ? 'build' : 'door'
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
    { name: 'compass', vi: 'Lên lịch 5 điểm cho vé của bạn', en: 'Plan the 5 sites your ticket covers' }
  ];

  // The greeting IS the picker — a visitor taps the hello in their own language, no
  // instructions needed. vi/en have built-in locale files (display set); the rest
  // have none, so they display English and ride the browser's page-translate
  // (CLAUDE.md: built locales are vi/en only). Ordered by Hội An / Da Nang arrival
  // volume (VNAT + Da Nang tourism 2024–25): VN, EN, then Korea, China+Taiwan (one
  // 中文), Japan, Thailand, and the leading European markets; anything else is "Other".
  // ponytail: this set follows the tourism-stats research — edit if the mix shifts.
  const LANGS = [
    { code: 'vi', hello: 'Xin chào', name: 'Tiếng Việt', display: 'vi' },
    { code: 'en', hello: 'Hello', name: 'English', display: 'en' },
    { code: 'ko', hello: '안녕하세요', name: '한국어' },
    { code: 'zh', hello: '你好', name: '中文' },
    { code: 'ja', hello: 'こんにちは', name: '日本語' },
    { code: 'th', hello: 'สวัสดี', name: 'ไทย' },
    { code: 'fr', hello: 'Bonjour', name: 'Français' },
    { code: 'de', hello: 'Hallo', name: 'Deutsch' }
  ];

  onMount(() => {
    if (step === 'welcome') track('welcome');
    // board preview (?step=recommend): expand the top set so the frame shows its
    // map + stops, not just collapsed titles.
    if (forced === 'recommend' && recommended.length) openSet = recommended[0].id;
    // board preview (?step=done): the done summary needs a plan to render — seed
    // one from the first ticket set if the device has none.
    if (forced === 'done' && !pickedIds.length && ticketSets.length) applySet(ticketSets[0].stops);
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
    finishOnboarding();
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
  let stepIdx = $state(0);
  let mono = $state(plan.set.find((id) => byId[id]?.ticketClass === 'monument') ?? null);
  let museo = $state(plan.set.find((id) => byId[id]?.ticketClass === 'museum') ?? null);
  let free = $state(plan.set.filter((id) => byId[id]?.ticketClass === 'other'));

  const pickedIds = $derived([mono, museo, ...free].filter(Boolean));
  const valid = $derived(isValidSet(pickedIds, destinations, 5));
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

  // The free pool is 16+ sites; show the closest handful and hide the rest behind
  // "show more" so the picker isn't a marathon scroll. The sort ranks by distance, so
  // the visible ones are the realistic (compact-walk) picks.
  const CAP = 8;
  let showAll = $state(false);
  // list (scan names/status) vs map (spatial pick) — one at a time, not stacked
  let viewMode = $state('map'); // 'map' | 'list' — map first + default

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

  function autoFree() {
    const spot = spotlightIds(stats.counts, destinations);
    // auto-pick favours quiet sites (dispersal), then the organizer's priority, then near
    const pool = groups.other
      .filter((d) => !free.includes(d.id))
      .map((d) => ({ id: d.id, quiet: spot.has(d.id) ? 0 : 1, prio: prioRank(d), m: distanceMeters(origin, d) }))
      .sort((a, b) => a.quiet - b.quiet || a.prio - b.prio || a.m - b.m);
    free = [...free, ...pool.slice(0, 3 - free.length).map((x) => x.id)];
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

{#snippet slots(list)}
  <div class="slots" aria-hidden="true">
    {#each list as slot, i (i)}
      {@const d = slot.id ? byId[slot.id] : null}
      {#if d}
        <span class="slot filled" style="--cat: var(--c-{d.category})">
          <MatCua size={30} color="var(--cat)" inner="var(--surface)" />
        </span>
      {:else}
        <span class="slot empty" data-k={s(STEPS[i < 2 ? i : 2].key)}></span>
      {/if}
    {/each}
  </div>
{/snippet}

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
      <p class="eyebrow"><span class="dot"></span>Hội An Creative Week · {event.year}</p>
      <h1 class="w-title">{t(event.tagline)}</h1>
      <p class="w-meta">{event.dates} · {t(event.venue)}</p>
    </div>

    <ul class="w-feats">
      {#each FEATURES as f (f.name)}
        <li><span class="fi"><Icon name={f.name} size={22} /></span><span class="ft">{t(f)}</span></li>
      {/each}
    </ul>

    <button class="btn" onclick={() => (step = 'scan')}>{s('welcome_start')} →</button>
  </section>
{:else if step === 'scan'}
  <section class="onboard">
    <p class="eyebrow"><span class="dot"></span>{s('scan_step')}</p>
    <h1>{s('scan_title')}</h1>
    <p class="o-sub">{s('scan_why')}</p>
    <TicketScan onsaved={onScanned} hero />
    <button class="skip" onclick={finishOnboarding}>{s('scan_skip')}</button>

    <!-- up-front: why we'll ask for GPS + the anonymous foot-traffic study (opt-out) -->
    <div class="privacy">
      <p class="p-why">{s('loc_note')}</p>
      <p class="p-study">{s('study_note')}</p>
      <StudyToggle />
      <JourneyToggle />
    </div>
  </section>
{:else if step === 'done'}
  <section class="onboard done">
    <p class="eyebrow"><span class="dot"></span>{s('your_ticket')}</p>
    <h1>{s('done_title')}</h1>
    {@render slots(slotList)}
    <div class="done-meta">
      <span class="comp fieldlabel">{s('comp_line', 1, 1, 3)} · {formatDistance(planWalk.meters, i18n.lang)} · {s('walk_time', planWalk.minutes)}</span>
      <button class="link editlink" onclick={editPlan}>{s('edit_plan')}</button>
    </div>

    <div class="donemap"><RouteMap stops={orderedPlan} height="200px" /></div>
    <ol class="doneroute">
      {#each orderedPlan as d, i (d.id)}
        <li><span class="n" style="--cat: var(--c-{d.category})">{i + 1}</span> {t(d.name)}</li>
      {/each}
    </ol>
  </section>
  <!-- primary CTA docked above the tab bar: the map + 5-stop list are taller than
       the screen, so it can't sit in flow below them -->
  <div class="commitbar solo">
    <a class="btn done-cta" href="{base}/go">{s('go_checkin')}</a>
  </div>
{:else if mode === 'recommend'}
  <div class="build">
    <header class="b-head">
      <h1>{s('rec_head')}</h1>
      <p class="b-sub">{s('rec_sub')}</p>
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
            </span>
            <span class="caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
          </button>
          {#if open}
            <div class="set-body">
              <div class="chips">
                <span class="chip dist">{formatDistance(set.walkM, i18n.lang)} · {s('walk_time', set.walkMin)}</span>
                <span class="chip" class:warn={!set.openNow}>
                  {set.openNow ? s('open_all') : s('n_closed', set.closedCount)}
                </span>
                {#if set.quiet}<span class="chip quiet">{s('quiet_pick')}</span>{/if}
              </div>
              <p class="narr">{t(set.description)}</p>
              <ul class="stops">
                {#each set.stops as d (d.id)}
                  <li>
                    <span class="mark"><MatCua size={22} color="var(--c-{d.category})" inner="var(--surface)" /></span>
                    <b>{t(d.name)}</b>
                  </li>
                {/each}
              </ul>
              <!-- commit CTA above the map: reachable without scrolling past the
                   route preview, which stays below as supporting detail -->
              <button class="btn" onclick={() => useSet(set)}>{s('use_set')}</button>
              <div class="setmap"><RouteMap stops={set.stops} height="200px" /></div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>

    <button class="btn secondary" onclick={() => { mode = 'manual'; stepIdx = firstIncomplete(); }}>
      {s('pick_own')}
    </button>

    <TicketScan onsaved={onScanned} />
  </div>
{:else}
  <div class="build" class:committing={valid}>
    <div class="build-top">
      <button class="link-back" onclick={() => (mode = 'recommend')}>{s('back_sugg')}</button>
      {#if pickedIds.length}
        <button class="link-back reset" onclick={resetPicks}>{s('reset_picks')}</button>
      {/if}
    </div>
    <header class="b-head">
      <h1>{s('plan_title')}</h1>
      <p class="b-sub">{s('comp_line', 1, 1, 3)}</p>
    </header>

    <!-- the 5 slots double as step navigation; tap one to edit that class -->
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

    <!-- current step -->
    <div class="sec">
      <p class="sec-label">
        {s(STEPS[stepIdx].key)} ·
        <span class="sec-hint">
          {#if STEPS[stepIdx].cls === 'other'}{free.length}/3{:else if (STEPS[stepIdx].cls === 'monument' ? mono : museo)}✓{:else}{s('pick_one')}{/if}
        </span>
      </p>
    </div>

    <!-- balance list vs map: pick a mode instead of scrolling past both -->
    <ViewToggle bind:mode={viewMode} />

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
      <ul class="list">
        {#each shownList as { d, m } (d.id)}
          {@const picked = isPicked(d.id)}
          {@const oh = openLabel(d)}
          <li class="row" class:picked>
            <button class="row-tap" onclick={() => pick(d.id)} aria-pressed={picked} aria-label={picked ? s('picked_lbl') : s('pick_do')}>
              <span class="mark" style="--cat: var(--c-{d.category})">
                <MatCua size={30} color="var(--cat)" inner="var(--surface)" ghost={!picked} />
              </span>
              <span class="body">
                <b>{t(d.name)}</b>
                <!-- picker row: identity + status only. The description is a detail-page
                     thing, not a pick criterion — dropping it halves the row height. -->
                <small class="meta">
                  {t(categoryLabel(d.category))}{#if oh} · <em class={oh.status}>{oh.text}</em>{/if}
                </small>
              </span>
              <span class="add" class:on={picked} aria-hidden="true">{picked ? '✓' : '+'}</span>
            </button>
          </li>
        {/each}
      </ul>

      {#if onFree && !showAll && rankedList.length > CAP}
        <button class="link fill-link" onclick={() => (showAll = true)}>{s('list_more', rankedList.length - CAP)}</button>
      {/if}
    {:else}
      <!-- map mode: tap a pin to add/remove; mounted only in this branch so it never inits at 0×0 -->
      <div class="mapwrap"><BuilderMap eligible={eligibleIds} picked={pickedIds} catFilter={onFree ? catFilter : null} onpick={pick} /></div>
    {/if}

    <!-- escape hatch, at the bottom in both modes: reach for it after browsing -->
    {#if onFree && free.length < 3}
      <button class="link fill-link" onclick={autoFree}>{s('auto_free')}</button>
    {/if}

  </div>
  {#if valid}
    <!-- picking happens on the map (56vh), so the finish CTA can't live below it —
         dock it above the tab bar the moment 5 are picked, always in reach -->
    <div class="commitbar">
      <span class="walk-note">{s('route_walk', formatDistance(planWalk.meters, i18n.lang), planWalk.minutes)}</span>
      <button class="btn done-cta" onclick={finish}>{s('build_done')} →</button>
    </div>
  {/if}
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
    padding-top: max(48px, calc(env(safe-area-inset-top) + 40px));
  }
  .welcome { justify-content: flex-start; min-height: 100dvh; }
  .welcome .eyebrow,
  .onboard .eyebrow { margin-bottom: 14px; }
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
  .w-meta { margin: 0 0 26px; color: var(--muted); font-size: 0.85rem; }

  .w-feats { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 16px; }
  .w-feats li { display: flex; align-items: center; gap: 13px; }
  .w-feats .fi { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: color-mix(in srgb, var(--brand) 10%, transparent); color: var(--brand); }
  .w-feats .ft { color: var(--ink); font-weight: 600; font-size: 0.98rem; line-height: 1.35; }
  .intro .btn { width: 100%; }

  .onboard h1 {
    margin: 0 0 8px;
    font-family: var(--font-display);
    font-weight: 700;
    color: var(--ink);
    font-size: clamp(1.7rem, 7vw, 2.2rem);
    line-height: 1.1;
  }
  .o-sub { margin: 0 0 24px; max-width: 30ch; color: var(--muted); line-height: 1.5; }
  .onboard.done { padding-bottom: calc(150px + env(safe-area-inset-bottom)); justify-content: flex-start; padding-top: max(40px, calc(env(safe-area-inset-top) + 32px)); }
  .done-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 14px 0 4px; }
  .done-meta .comp { margin: 0; }
  .editlink {
    border: 0; background: none; padding: 0; cursor: pointer;
    color: var(--brand); font-family: var(--font-body); font-weight: 600; font-size: 0.85rem;
    text-decoration: underline; text-underline-offset: 3px; flex: none;
  }
  .commitbar.solo .done-cta { flex: 1 1 auto; width: 100%; }
  .donemap { width: 100%; margin: 14px 0 12px; border-radius: 12px; overflow: hidden; border: 1px solid var(--line); }
  .doneroute { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 8px; width: 100%; }
  .doneroute li { display: flex; align-items: center; gap: 10px; font-size: 0.95rem; }
  .doneroute .n {
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

  .privacy {
    margin: 26px auto 0;
    max-width: 34ch;
    display: flex; flex-direction: column; gap: 10px;
    padding-top: 18px; border-top: 1px solid var(--line);
  }
  .privacy .p-why { margin: 0; color: var(--ink); font-size: 0.9rem; line-height: 1.45; }
  .privacy .p-study { margin: 0; color: var(--muted); font-size: 0.84rem; line-height: 1.45; }

  /* ---- the 5 display slots (done screen snippet) ---- */
  .slots { display: flex; gap: 8px; }
  .slots .slot {
    width: 44px; height: 44px; display: grid; place-items: center; border-radius: 12px;
  }
  .slots .slot.empty { border: 1.5px dashed color-mix(in srgb, var(--ink) 22%, transparent); }
  .slots .slot.filled { background: color-mix(in srgb, var(--gold) 16%, transparent); }

  /* ---- build screen ---- */
  .build {
    padding: 18px 18px 8px;
    padding-top: max(28px, calc(env(safe-area-inset-top) + 22px));
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .b-head { display: flex; flex-direction: column; gap: 3px; }
  .b-head h1 { margin: 0; font-size: clamp(1.9rem, 7vw, 2.4rem); font-weight: 700; letter-spacing: -0.02em; }
  .b-sub { margin: 0; color: var(--muted); font-size: 0.95rem; }

  /* slots double as step nav */
  .slotbtns { display: flex; gap: 8px; }
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


  .build-top { display: flex; align-items: center; justify-content: space-between; }
  .link-back.reset { color: var(--brand); }
  .link-back {
    align-self: flex-start;
    border: 0;
    background: none;
    color: var(--muted);
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 0.85rem;
    padding: 0;
    cursor: pointer;
  }

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
  .chip.dist { color: var(--ink); background: var(--bg); }
  .stops { list-style: none; margin: 0; padding: 8px 0 0; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 8px; }
  .stops li { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .stops b { font-weight: 600; font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .setmap { border-radius: 12px; overflow: hidden; border: 1px solid var(--line); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--muted);
    background: var(--bg);
    border-radius: 999px;
    padding: 4px 10px;
  }
  .chip.warn { color: var(--brand-dark); background: color-mix(in srgb, var(--gold) 22%, transparent); }
  .chip.quiet { color: var(--teal); background: color-mix(in srgb, var(--teal) 14%, transparent); }
  .setcard .btn { margin-top: 2px; }

  /* current-step label + actions */
  .sec { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
  .sec-label {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .sec-hint { color: var(--brand); }
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

  /* grouped list, sample style */
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .row { border-top: 1px solid var(--line); }
  .row:first-child { border-top: 0; }
  .row.picked { background: color-mix(in srgb, var(--brand) 8%, transparent); }
  .row-tap {
    width: 100%; min-width: 0;
    display: flex; align-items: center; gap: 12px;
    border: 0; background: none; padding: 12px 14px; cursor: pointer; text-align: left;
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

  .walk-note { margin: 4px 0 0; color: var(--muted); font-size: 0.85rem; font-weight: 600; text-align: center; }
  .done-cta { width: 100%; margin-top: 4px; }

  /* docked finish bar — sits above the tab bar so the commit CTA is reachable the
     instant 5 are picked, instead of below the 56vh picking map */
  .build.committing { padding-bottom: 88px; }
  .commitbar {
    position: fixed;
    left: 12px; right: 12px;
    bottom: calc(84px + env(safe-area-inset-bottom));
    max-width: 516px; margin: 0 auto;
    display: flex; align-items: center; gap: 12px;
    padding: 8px 8px 8px 16px;
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: saturate(1.3) blur(14px);
    border: 1px solid var(--line);
    border-radius: 18px;
    box-shadow: var(--shadow-lift);
    z-index: 900;
    animation: rise 0.3s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .commitbar .walk-note { flex: 1 1 auto; margin: 0; text-align: left; }
  .commitbar .done-cta { flex: 0 0 auto; width: auto; margin: 0; }
  @media (prefers-reduced-motion: reduce) { .commitbar { animation: none; } }
</style>
