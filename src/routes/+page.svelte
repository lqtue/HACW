<script>
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import destinations from '$lib/data/destinations.json';
  import tours from '$lib/data/tours.json';
  import TicketScan from '$lib/components/TicketScan.svelte';
  import BuilderMap from '$lib/components/BuilderMap.svelte';
  import MatCua from '$lib/components/MatCua.svelte';
  import { rankSets } from '$lib/advisor.js';
  import { isValidSet } from '$lib/ticket.js';
  import { weather } from '$lib/weather.svelte.js';
  import { stats } from '$lib/stats.svelte.js';
  import { spotlightIds } from '$lib/score.js';
  import { distanceMeters, getPosition } from '$lib/geo.js';
  import { formatDistance } from '$lib/route.js';
  import { hasStamp, adoptCode, track } from '$lib/passport.svelte.js';
  import { codeFromTicket } from '$lib/backup.js';
  import { plan, setOnboarded, setTicketCode, setPlanSet } from '$lib/plan.svelte.js';
  import { openLabel } from '$lib/util.js';
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
    { code: 'vi', hello: 'Xin chào', name: 'Tiếng Việt' },
    { code: 'en', hello: 'Hello', name: 'English' }
  ];

  onMount(() => {
    if (step === 'welcome') track('welcome');
  });

  function chooseLang(code) {
    setLang(code);
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
  const origin = $derived(me ?? { lat: 15.8772, lng: 108.3275 }); // old-town centre
  async function locate() {
    locating = true;
    try {
      me = await getPosition();
    } catch {
      // denied / unavailable — list stays sorted from the town centre
    }
    locating = false;
  }

  const currentGroup = $derived(groups[STEPS[stepIdx].cls]);
  const eligibleIds = $derived(currentGroup.map((d) => d.id));
  const rankedList = $derived(
    currentGroup
      .map((d) => ({ d, m: distanceMeters(origin, d) }))
      .sort((a, b) => a.m - b.m)
  );

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

  let openId = $state(null); // list row expanded to show address/hours
  const toggleRow = (id) => (openId = openId === id ? null : id);

  const ctx = () => ({ weather: weather.now, now: new Date(), counts: stats.counts });

  function recommendFull() {
    const withStops = ticketSets.map((tr) => ({ ...tr, stops: tr.stops.map((i) => byId[i]).filter(Boolean) }));
    const best = rankSets(withStops, ctx(), destinations)[0];
    if (!best) return;
    const ids = best.stops.map((d) => d.id);
    mono = ids.find((i) => byId[i].ticketClass === 'monument') ?? null;
    museo = ids.find((i) => byId[i].ticketClass === 'museum') ?? null;
    free = ids.filter((i) => i !== mono && i !== museo).slice(0, 3);
    stepIdx = 2;
  }

  function autoFree() {
    const spot = spotlightIds(stats.counts, destinations);
    const pool = groups.other
      .filter((d) => !free.includes(d.id))
      .map((d) => ({ id: d.id, quiet: spot.has(d.id) ? 0 : 1, m: distanceMeters(origin, d) }))
      .sort((a, b) => a.quiet - b.quiet || a.m - b.m);
    free = [...free, ...pool.slice(0, 3 - free.length).map((x) => x.id)];
  }

  function finish() {
    if (!valid) return;
    setPlanSet(pickedIds);
    track('plan_built');
    step = 'done';
  }
  function editPlan() {
    step = 'build';
    stepIdx = firstIncomplete();
  }

  const intro = (d) => {
    const txt = t(d.description) ?? '';
    return txt.length > 90 ? txt.slice(0, 88).trimEnd() + '…' : txt;
  };
</script>

{#snippet slots(list)}
  <div class="slots" aria-hidden="true">
    {#each list as slot, i (i)}
      {#if slot.id}
        {@const d = byId[slot.id]}
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
    <p class="eyebrow"><span class="dot"></span>Hội An Creative Week</p>
    <p class="w-lead">Chọn ngôn ngữ · Choose your language</p>
    <ul class="langs">
      {#each LANGS as l (l.code)}
        <li>
          <button class="lang-pick" onclick={() => chooseLang(l.code)}>
            <span class="hello">{l.hello}</span>
            <span class="lang-name">{l.name} <span aria-hidden="true">→</span></span>
          </button>
        </li>
      {/each}
    </ul>
    <p class="w-sub">{s('welcome_sub')}</p>
  </section>
{:else if step === 'scan'}
  <section class="onboard">
    <p class="eyebrow"><span class="dot"></span>{s('scan_step')}</p>
    <h1>{s('scan_title')}</h1>
    <p class="o-sub">{s('scan_why')}</p>
    <TicketScan onsaved={onScanned} />
    <button class="skip" onclick={finishOnboarding}>{s('scan_skip')}</button>
  </section>
{:else if step === 'done'}
  <section class="onboard done">
    <p class="eyebrow"><span class="dot"></span>{s('your_ticket')}</p>
    <h1>{s('done_title')}</h1>
    {@render slots(slotList)}
    <p class="comp fieldlabel">{s('comp_line', 1, 1, 3)}</p>
    <p class="o-sub">{s('done_sub')}</p>
    <a class="btn" href="{base}/destinations">{s('go_checkin')}</a>
    <button class="skip" onclick={editPlan}>{s('edit_plan')}</button>
  </section>
{:else}
  <div class="build">
    <header class="b-head">
      <h1>{s('plan_title')}</h1>
      <p class="b-sub">{s('comp_line', 1, 1, 3)}</p>
    </header>

    <!-- the 5 slots double as step navigation; tap one to edit that class -->
    <div class="slotbtns" role="group" aria-label={s('your_ticket')}>
      {#each slotList as id, i (i)}
        {@const si = i < 2 ? i : 2}
        <button
          class="slot"
          class:filled={id}
          class:on={stepIdx === si}
          onclick={() => (stepIdx = si)}
          aria-label={s(STEPS[si].key)}
        >
          {#if id}
            {@const d = byId[id]}
            <MatCua size={28} color="var(--c-{d.category})" inner="var(--surface)" />
          {/if}
        </button>
      {/each}
    </div>
    <div class="pbar"><i style="width: {Math.round((pickedIds.length / 5) * 100)}%"></i></div>

    <button class="btn secondary rec" onclick={recommendFull}>{s('recommend_full')}</button>

    <!-- current step -->
    <div class="sec">
      <p class="sec-label">
        {s(STEPS[stepIdx].key)} ·
        <span class="sec-hint">
          {#if STEPS[stepIdx].cls === 'other'}{free.length}/3{:else if (STEPS[stepIdx].cls === 'monument' ? mono : museo)}✓{:else}{s('pick_one')}{/if}
        </span>
      </p>
      <div class="sec-acts">
        <button class="mini" class:on={!!me} onclick={locate}>📍 {locating ? s('locating_now') : s('rank_dist')}</button>
        {#if stepIdx === 2 && free.length < 3}
          <button class="mini" onclick={autoFree}>{s('auto_free')}</button>
        {/if}
      </div>
    </div>

    <ul class="list">
      {#each rankedList as { d, m } (d.id)}
        {@const picked = isPicked(d.id)}
        {@const oh = openLabel(d)}
        <li class="row" class:picked>
          <div class="row-main">
            <button class="row-tap" onclick={() => toggleRow(d.id)} aria-expanded={openId === d.id}>
              <span class="mark" style="--cat: var(--c-{d.category})">
                <MatCua size={30} color="var(--cat)" inner="var(--surface)" ghost={!picked} />
              </span>
              <span class="body">
                <b>{t(d.name)}</b>
                <small>{formatDistance(m, i18n.lang)}{#if oh} · <em class={oh.status}>{oh.text}</em>{/if}</small>
              </span>
            </button>
            <button class="add" class:on={picked} onclick={() => pick(d.id)} aria-label={picked ? s('picked_lbl') : s('pick_do')}>
              {picked ? '✓' : '+'}
            </button>
          </div>
          {#if openId === d.id}<p class="intro">{intro(d)}</p>{/if}
        </li>
      {/each}
    </ul>

    <!-- map, secondary -->
    <details class="mapfold">
      <summary>{s('map_view')}</summary>
      <div class="mapwrap"><BuilderMap eligible={eligibleIds} picked={pickedIds} onpick={pick} /></div>
    </details>

    {#if valid}
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
  .welcome .eyebrow,
  .onboard .eyebrow { margin-bottom: 14px; }
  .w-lead { margin: 0 0 22px; color: var(--muted); font-size: 0.9rem; font-weight: 500; }

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
  .w-sub { margin: 26px 0 0; max-width: 26ch; color: var(--muted); font-size: 0.95rem; line-height: 1.5; }
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

  .rec { width: 100%; }

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
  .row-main { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
  .row-tap {
    flex: 1 1 auto; min-width: 0;
    display: flex; align-items: center; gap: 12px;
    border: 0; background: none; padding: 0; cursor: pointer; text-align: left;
  }
  .mark { flex: 0 0 auto; display: grid; place-items: center; }
  .body { min-width: 0; display: grid; gap: 2px; }
  .body b { font-weight: 600; font-size: 0.98rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .body small { color: var(--muted); font-size: 0.8rem; }
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
    cursor: pointer;
    transition: background 0.14s, border-color 0.14s, color 0.14s;
  }
  .add.on { background: var(--brand); border-color: var(--brand); color: #fff; }
  .intro { margin: 0 14px 12px 50px; color: var(--muted); font-size: 0.82rem; line-height: 1.45; }

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

  .done-cta { width: 100%; margin-top: 4px; }
</style>
