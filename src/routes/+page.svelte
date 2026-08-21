<script>
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import destinations from '$lib/data/destinations.json';
  import categories from '$lib/data/categories.json';
  import tours from '$lib/data/tours.json';
  import event from '$lib/data/event.json';
  import TicketScan from '$lib/components/TicketScan.svelte';
  import BuilderMap from '$lib/components/BuilderMap.svelte';
  import RouteMap from '$lib/components/RouteMap.svelte';
  import MatCua from '$lib/components/MatCua.svelte';
  import { rankSets } from '$lib/advisor.js';
  import { isValidSet } from '$lib/ticket.js';
  import { weather } from '$lib/weather.svelte.js';
  import { stats } from '$lib/stats.svelte.js';
  import { spotlightIds } from '$lib/score.js';
  import { distanceMeters, getPosition } from '$lib/geo.js';
  import { formatDistance, optimizeRoute, routeStats } from '$lib/route.js';
  import { hasStamp, adoptCode, track } from '$lib/passport.svelte.js';
  import { codeFromTicket } from '$lib/backup.js';
  import { plan, setOnboarded, setTicketCode, setPlanSet } from '$lib/plan.svelte.js';
  import { openLabel, categoryLabel, categoryIcon } from '$lib/util.js';
  import { i18n, t, setLang } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  const byId = Object.fromEntries(destinations.map((d) => [d.id, d]));
  const groups = {
    monument: destinations.filter((d) => d.ticketClass === 'monument'),
    museum: destinations.filter((d) => d.ticketClass === 'museum'),
    other: destinations.filter((d) => d.ticketClass === 'other')
  };
  const ticketSets = tours.filter((tr) => tr.ticket);

  // ---- onboarding: welcome -> scan -> build -> done ----
  let step = $state(plan.onboarded ? 'build' : 'welcome');

  // The welcome screen's greetings ARE the language picker. Official locales are
  // vi/en (other languages ride the browser's translate — see CLAUDE.md), so those
  // are the two the app actually switches; tapping one sets it and moves on.
  const LANGS = [
    { code: 'vi', hello: 'Xin chào', name: 'Tiếng Việt', display: 'vi' },
    { code: 'en', hello: 'Hello', name: 'English', display: 'en' }
  ];
  // Extra languages have no built-in locale file — they display English and ride the
  // browser's page-translate. Ordered by Hội An / Da Nang arrival volume (VNAT + Da
  // Nang tourism 2024–25): Korea dominates, then China+Taiwan (one 中文 button),
  // Japan, Thailand, then the leading European markets. English (a primary card
  // above) already covers US / UK / Australia / India; anything else is "Other".
  // ponytail: this set follows the tourism-stats research — edit if the mix shifts.
  const MORE = [
    { code: 'ko', name: '한국어' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
    { code: 'th', name: 'ไทย' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' }
  ];

  onMount(() => {
    if (step === 'welcome') track('welcome');
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
    trackLang(l.code);
    step = 'scan';
  }
  function otherLang() {
    setLang('en');
    trackLang('other');
    step = 'scan';
  }
  function onScanned(raw) {
    setTicketCode(raw);
    const code = codeFromTicket(raw);
    if (code) adoptCode(code);
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

  // opt-in location — nothing requested until the visitor taps "sort by distance"
  let me = $state(null);
  let locating = $state(false);
  const TOWN_CENTRE = { lat: 15.8772, lng: 108.3275 };
  const origin = $derived(me ?? TOWN_CENTRE);
  async function locate() {
    locating = true;
    try {
      me = await getPosition();
    } catch {
      // denied / unavailable — list stays sorted from the cluster / town centre
    }
    locating = false;
  }

  // "nearest" reference: a GPS fix if we have one, else the cluster of sites already
  // picked (so the next pick keeps the walking route compact), else the town centre.
  const picks = $derived(pickedIds.map((id) => byId[id]).filter(Boolean));
  function distFor(d) {
    if (me) return distanceMeters(me, d);
    if (picks.length) return Math.min(...picks.filter((p) => p.id !== d.id).map((p) => distanceMeters(p, d)).concat(Infinity));
    return distanceMeters(TOWN_CENTRE, d);
  }

  // the free pool is big (16+) vs 3 monuments / 6 museums — a category filter makes it browsable
  // chip order follows categories.json (di-tich, hoi-quan, nha-co, trai-nghiem), present-only
  const freeCats = categories.map((c) => c.id).filter((id) => groups.other.some((d) => d.category === id));
  let catFilter = $state(null);

  const catOrder = Object.fromEntries(categories.map((c, i) => [c.id, i]));
  let sortBy = $state('distance'); // 'distance' | 'name' | 'category'

  const currentGroup = $derived(groups[STEPS[stepIdx].cls]);
  const eligibleIds = $derived(currentGroup.map((d) => d.id));
  const onFree = $derived(STEPS[stepIdx].cls === 'other');
  const rankedList = $derived.by(() => {
    const list = currentGroup
      .filter((d) => !onFree || !catFilter || d.category === catFilter)
      .map((d) => ({ d, m: distFor(d) }));
    if (sortBy === 'name') list.sort((a, b) => t(a.d.name).localeCompare(t(b.d.name), i18n.lang));
    else if (sortBy === 'category')
      list.sort((a, b) => (catOrder[a.d.category] - catOrder[b.d.category]) || a.m - b.m);
    else list.sort((a, b) => a.m - b.m);
    return list;
  });

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

  let mapOpen = $state(false); // the builder map is heavy — mount it only when shown

  // recommend the prebuilt sets first; manual builder is opt-in behind "pick my own"
  let mode = $state(plan.set.length ? 'manual' : 'recommend');
  let openSet = $state(null); // single-open accordion; one RouteMap (WebGL) alive at a time
  const ctx = () => ({ weather: weather.now, now: new Date(), counts: stats.counts });
  const recommended = $derived(
    rankSets(
      ticketSets.map((tr) => ({ ...tr, stops: tr.stops.map((i) => byId[i]).filter(Boolean) })),
      ctx(),
      destinations
    )
  );

  // one-line summary for a site — first sentence/clamp of its description (CSS ellipsis finishes it)
  const sum = (d) => t(d.description) ?? '';

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
    const pool = groups.other
      .filter((d) => !free.includes(d.id))
      .map((d) => ({ id: d.id, quiet: spot.has(d.id) ? 0 : 1, m: distanceMeters(origin, d) }))
      .sort((a, b) => a.quiet - b.quiet || a.m - b.m);
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

{#if step === 'welcome'}
  <section class="welcome">
    <p class="eyebrow"><span class="dot"></span>Hội An Creative Week · {event.year}</p>
    <!-- pre-language screen: everything here reads in both vi + en at once -->
    <h1 class="w-title">{event.tagline.vi}</h1>
    <p class="w-tagline-en">{event.tagline.en}</p>
    <p class="w-meta">{event.dates} · {event.venue.en}</p>

    <!-- what the app is for, three lines, bilingual -->
    <ul class="w-feats">
      <li><span class="fi" aria-hidden="true">🗺️</span><span><b>Khám phá 25 điểm di sản</b><small>Explore 25 heritage sites on an offline map</small></span></li>
      <li><span class="fi" aria-hidden="true">🎫</span><span><b>Nhận tem tại mỗi điểm</b><small>Check in and collect creative-passport stamps</small></span></li>
      <li><span class="fi" aria-hidden="true">🧭</span><span><b>Lên lịch 5 điểm cho vé của bạn</b><small>Plan the 5 sites your ticket covers</small></span></li>
    </ul>

    <p class="w-lead">Chọn ngôn ngữ · Choose your language</p>
    <ul class="langs">
      {#each LANGS as l (l.code)}
        <li>
          <button class="lang-pick" onclick={() => chooseLang(l)}>
            <span class="hello">{l.hello}</span>
            <span class="lang-name">{l.name} <span aria-hidden="true">→</span></span>
          </button>
        </li>
      {/each}
    </ul>

    <!-- more languages: no locale file, so these display English and ride the
         browser's own page-translate. Grid of the top nationalities + a catch-all. -->
    <p class="w-more-lead">Ngôn ngữ khác · More languages</p>
    <div class="more">
      {#each MORE as l (l.code)}
        <button class="lang-chip" onclick={() => chooseLang(l)}>{l.name}</button>
      {/each}
      <button class="lang-chip other" onclick={otherLang}>🌐 Other →</button>
    </div>
    <p class="w-sub">
      Các ngôn ngữ này hiển thị tiếng Anh — dùng tính năng Dịch của trình duyệt để chuyển ngữ.
      <br />
      These show English — use your browser's built-in Translate to convert the page.
    </p>
  </section>
{:else if step === 'scan'}
  <section class="onboard">
    <p class="eyebrow"><span class="dot"></span>{s('scan_step')}</p>
    <h1>{s('scan_title')}</h1>
    <p class="o-sub">{s('scan_why')}</p>
    <TicketScan onsaved={onScanned} hero />
    <button class="skip" onclick={finishOnboarding}>{s('scan_skip')}</button>
  </section>
{:else if step === 'done'}
  <section class="onboard done">
    <p class="eyebrow"><span class="dot"></span>{s('your_ticket')}</p>
    <h1>{s('done_title')}</h1>
    {@render slots(slotList)}
    <p class="comp fieldlabel">{s('comp_line', 1, 1, 3)} · {formatDistance(planWalk.meters, i18n.lang)} · {s('walk_time', planWalk.minutes)}</p>

    <div class="donemap"><RouteMap stops={orderedPlan} height="240px" /></div>
    <ol class="doneroute">
      {#each orderedPlan as d, i (d.id)}
        <li><span class="n" style="--cat: var(--c-{d.category})">{i + 1}</span> {t(d.name)}</li>
      {/each}
    </ol>

    <p class="o-sub">{s('done_sub')}</p>
    <a class="btn" href="{base}/destinations">{s('go_checkin')}</a>
    <button class="skip" onclick={editPlan}>{s('edit_plan')}</button>
  </section>
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
              <div class="setmap"><RouteMap stops={set.stops} height="200px" /></div>
              <button class="btn" onclick={() => useSet(set)}>{s('use_set')}</button>
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
  <div class="build">
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
    <div class="pbar"><i style="width: {Math.round((pickedIds.length / 5) * 100)}%"></i></div>

    <!-- current step -->
    <div class="sec">
      <p class="sec-label">
        {s(STEPS[stepIdx].key)} ·
        <span class="sec-hint">
          {#if STEPS[stepIdx].cls === 'other'}{free.length}/3{:else if (STEPS[stepIdx].cls === 'monument' ? mono : museo)}✓{:else}{s('pick_one')}{/if}
        </span>
      </p>
      <div class="sec-acts">
        {#if onFree && free.length < 3}
          <button class="mini" onclick={autoFree}>{s('auto_free')}</button>
        {/if}
      </div>
    </div>

    <div class="sortbar">
      <span class="sort-lbl">{s('sort_lbl')}</span>
      <button class="mini" class:on={sortBy === 'distance'} onclick={() => (sortBy = 'distance')}>{s('sort_dist')}</button>
      <button class="mini" class:on={sortBy === 'name'} onclick={() => (sortBy = 'name')}>{s('sort_name')}</button>
      {#if onFree}
        <button class="mini" class:on={sortBy === 'category'} onclick={() => (sortBy = 'category')}>{s('sort_cat')}</button>
      {/if}
      {#if sortBy === 'distance'}
        <button class="mini loc" class:on={!!me} onclick={locate}>📍 {locating ? s('locating_now') : s('my_loc')}</button>
      {/if}
    </div>

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

    <ul class="list">
      {#each rankedList as { d, m } (d.id)}
        {@const picked = isPicked(d.id)}
        {@const oh = openLabel(d)}
        <li class="row" class:picked>
          <button class="row-tap" onclick={() => pick(d.id)} aria-pressed={picked} aria-label={picked ? s('picked_lbl') : s('pick_do')}>
            <span class="mark" style="--cat: var(--c-{d.category})">
              <MatCua size={30} color="var(--cat)" inner="var(--surface)" ghost={!picked} />
            </span>
            <span class="body">
              <b>{t(d.name)}</b>
              <small class="sum">{sum(d)}</small>
              <small class="meta">
                {#if me}{formatDistance(m, i18n.lang)}{#if oh} · {/if}{/if}{#if oh}<em class={oh.status}>{oh.text}</em>{/if}
              </small>
            </span>
            <span class="add" class:on={picked} aria-hidden="true">{picked ? '✓' : '+'}</span>
          </button>
        </li>
      {/each}
    </ul>

    <!-- map, secondary — mounted only while open so it never inits at 0×0 -->
    <details class="mapfold" bind:open={mapOpen}>
      <summary>{s('map_view')}</summary>
      {#if mapOpen}
        <div class="mapwrap"><BuilderMap eligible={eligibleIds} picked={pickedIds} catFilter={onFree ? catFilter : null} onpick={pick} /></div>
      {/if}
    </details>

    {#if valid}
      <p class="walk-note">{s('route_walk', formatDistance(planWalk.meters, i18n.lang), planWalk.minutes)}</p>
      <button class="btn done-cta" onclick={finish}>{s('build_done')} →</button>
    {/if}

    <TicketScan onsaved={onScanned} />
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
    padding-top: max(48px, calc(env(safe-area-inset-top) + 40px));
  }
  /* welcome now carries an intro, so it flows from the top rather than centring */
  .welcome { justify-content: flex-start; min-height: 100vh; }
  .welcome .eyebrow,
  .onboard .eyebrow { margin-bottom: 14px; }

  .w-title {
    margin: 0 0 4px;
    font-family: var(--font-display);
    font-weight: 800;
    color: var(--ink);
    font-size: clamp(1.7rem, 7vw, 2.3rem);
    line-height: 1.05;
    letter-spacing: -0.02em;
  }
  .w-tagline-en { margin: 0 0 10px; color: var(--brand-dark); font-weight: 600; font-size: 1rem; }
  .w-meta { margin: 0 0 24px; color: var(--muted); font-size: 0.85rem; }

  .w-feats { list-style: none; margin: 0 0 30px; padding: 0; display: flex; flex-direction: column; gap: 14px; }
  .w-feats li { display: flex; align-items: flex-start; gap: 13px; }
  .w-feats .fi { font-size: 1.4rem; line-height: 1.2; flex: none; }
  .w-feats li span:last-child { display: flex; flex-direction: column; gap: 1px; }
  .w-feats b { color: var(--ink); font-weight: 700; font-size: 0.95rem; }
  .w-feats small { color: var(--muted); font-size: 0.82rem; }

  .w-lead { margin: 0 0 14px; color: var(--muted); font-size: 0.9rem; font-weight: 500; }

  /* the greetings are the language picker */
  .langs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .lang-pick {
    width: 100%;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 14px;
    text-align: left;
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: var(--radius);
    padding: 18px 20px;
    cursor: pointer;
    transition: border-color 0.14s ease, background 0.14s ease;
  }
  .lang-pick:hover { border-color: color-mix(in srgb, var(--brand) 55%, var(--line)); }
  .lang-pick:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .hello {
    font-family: var(--font-display);
    font-weight: 700;
    color: var(--ink);
    font-size: clamp(1.9rem, 8vw, 2.5rem);
    line-height: 1;
    letter-spacing: -0.03em;
  }
  .lang-name { flex: 0 0 auto; color: var(--brand); font-weight: 600; font-size: 0.9rem; }

  /* more languages: quieter than the two real picks — a wrap of chips, not cards */
  .w-more-lead { margin: 22px 0 12px; color: var(--muted); font-size: 0.9rem; font-weight: 500; }
  .more { display: flex; flex-wrap: wrap; gap: 10px; }
  .lang-chip {
    border: 1px dashed var(--line);
    background: none;
    border-radius: 999px;
    padding: 10px 16px;
    color: var(--brand-dark);
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 0.92rem;
    cursor: pointer;
    transition: border-color 0.14s ease, background 0.14s ease;
  }
  .lang-chip:hover { border-color: color-mix(in srgb, var(--brand) 55%, var(--line)); }
  .lang-chip:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .lang-chip.other { color: var(--muted); }
  .w-sub { margin: 14px 0 0; color: var(--muted); font-size: 0.82rem; line-height: 1.5; }
  .onboard h1 {
    margin: 0 0 8px;
    font-family: var(--font-display);
    font-weight: 700;
    color: var(--ink);
    font-size: clamp(1.7rem, 7vw, 2.2rem);
    line-height: 1.1;
  }
  .o-sub { margin: 0 0 24px; max-width: 30ch; color: var(--muted); line-height: 1.5; }
  .onboard.done .comp { margin: 14px 0 4px; }
  .onboard.done .btn { align-self: flex-start; margin-top: 6px; }
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

  .pbar { height: 6px; border-radius: 999px; background: var(--bg); overflow: hidden; margin-top: -4px; }
  .pbar i { display: block; height: 100%; border-radius: 999px; background: var(--brand); transition: width 0.3s ease; }

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
  .setcard h2 { margin: 0; font-size: 1.15rem; font-weight: 700; letter-spacing: -0.01em; }
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
  .sec-acts { display: flex; gap: 8px; }
  .sortbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: -4px; }
  .sort-lbl { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
  .sortbar .loc { margin-left: auto; }
  .mini {
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--muted);
    border-radius: 999px;
    padding: 6px 12px;
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 0.76rem;
    cursor: pointer;
  }
  .mini.on { color: var(--brand); border-color: color-mix(in srgb, var(--brand) 45%, var(--line)); }

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

  .mapfold {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .mapfold > summary { padding: 13px 15px; cursor: pointer; font-weight: 600; list-style: none; }
  .mapfold > summary::-webkit-details-marker { display: none; }
  .mapfold > summary::after { content: '▸'; float: right; color: var(--muted); }
  .mapfold[open] > summary::after { content: '▾'; }
  .mapwrap { height: 46vh; min-height: 260px; padding: 0 12px 12px; }

  .walk-note { margin: 4px 0 0; color: var(--muted); font-size: 0.85rem; font-weight: 600; text-align: center; }
  .done-cta { width: 100%; margin-top: 4px; }
</style>
