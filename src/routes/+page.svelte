<script>
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import destinations from '$lib/data/destinations.json';
  import tours from '$lib/data/tours.json';
  import PageShell from '$lib/components/PageShell.svelte';
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
  import { i18n, t } from '$lib/i18n.svelte.js';
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
  const HELLOS = ['Xin chào', 'Hello', '你好', 'こんにちは', '안녕하세요', 'Bonjour', 'Hola', 'สวัสดี'];
  let hi = $state(0);

  onMount(() => {
    if (step !== 'welcome') return;
    track('welcome');
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => (hi = (hi + 1) % HELLOS.length), 1600);
    return () => clearInterval(id);
  });

  const start = () => (step = 'scan');
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
          <MatCua size={30} color="var(--cat)" inner="#fbe0b8" ink="var(--cat)" />
        </span>
      {:else}
        <span class="slot empty" data-k={s(STEPS[i < 2 ? i : 2].key)}></span>
      {/if}
    {/each}
  </div>
{/snippet}

{#if step === 'welcome'}
  <section class="welcome">
    <span class="brand-strip" aria-hidden="true"></span>
    <p class="eyebrow"><span class="dot"></span>Hội An Creative Week</p>
    <p class="hello" aria-live="polite">{HELLOS[hi]}</p>
    <p class="w-sub">{s('welcome_sub')}</p>
    <button class="btn" onclick={start}>{s('welcome_start')} →</button>
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
  <PageShell title={s('plan_title')} sub={s('comp_line', 1, 1, 3)}>
    <!-- live ticket: the 5 slots fill as you pick -->
    <div class="mystub">
      {@render slots(slotList)}
      <span class="count">{pickedIds.length}/5</span>
    </div>

    <button class="btn secondary rec" onclick={recommendFull}>{s('recommend_full')}</button>

    <!-- stepper: which slot you're filling -->
    <div class="steps" role="tablist">
      {#each STEPS as st, i (st.cls)}
        {@const filled = st.cls === 'monument' ? !!mono : st.cls === 'museum' ? !!museo : free.length}
        <button class="stepbtn" class:on={stepIdx === i} role="tab" aria-selected={stepIdx === i} onclick={() => (stepIdx = i)}>
          <b>{s(st.key)}</b>
          <small>{st.cls === 'other' ? `${free.length}/3` : filled ? '✓' : '—'}</small>
        </button>
      {/each}
    </div>

    <div class="mapwrap"><BuilderMap eligible={eligibleIds} picked={pickedIds} onpick={pick} /></div>

    <div class="listhead">
      <button class="chip" aria-pressed={!!me} onclick={locate}>📍 {locating ? s('locating_now') : s('rank_dist')}</button>
      {#if stepIdx === 2 && free.length < 3}
        <button class="chip" onclick={autoFree}>{s('auto_free')}</button>
      {/if}
    </div>

    <ul class="ranklist">
      {#each rankedList as { d, m } (d.id)}
        {@const picked = isPicked(d.id)}
        {@const oh = openLabel(d)}
        <li class:picked>
          <div class="rl-main">
            <button class="rl-tap" onclick={() => toggleRow(d.id)} aria-expanded={openId === d.id}>
              <span class="rl-mark" style="--cat: var(--c-{d.category})">
                <MatCua size={26} color="var(--cat)" inner={picked ? '#fbe0b8' : 'transparent'} ink="var(--cat)" ghost={!picked} />
              </span>
              <span class="rl-body">
                <b>{t(d.name)}</b>
                <small>{formatDistance(m, i18n.lang)}{#if oh} · <em class={oh.status}>{oh.text}</em>{/if}</small>
              </span>
            </button>
            <button class="rl-pick" class:on={picked} onclick={() => pick(d.id)}>
              {picked ? s('picked_lbl') : s('pick_do')}
            </button>
          </div>
          {#if openId === d.id}
            <p class="rl-intro">{intro(d)}</p>
          {/if}
        </li>
      {/each}
    </ul>

    {#if valid}
      <button class="btn done-cta" onclick={finish}>{s('build_done')} →</button>
    {/if}

    <TicketScan onsaved={onScanned} />
  </PageShell>
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
  .welcome .brand-strip { position: absolute; inset: 0 0 auto 0; }
  .welcome .eyebrow,
  .onboard .eyebrow { margin-bottom: 20px; }
  .hello {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    color: var(--ink);
    font-size: clamp(2.4rem, 12vw, 3.4rem);
    line-height: 1.02;
    letter-spacing: -0.03em;
    min-height: 1.05em;
  }
  .w-sub { margin: 16px 0 32px; max-width: 22ch; color: var(--muted); font-size: 1rem; line-height: 1.5; }
  .welcome .btn { align-self: flex-start; }
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

  /* ---- the 5 slots (shared by build + done) ---- */
  .slots { display: flex; gap: 8px; }
  .slot {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 12px;
  }
  .slot.empty {
    border: 1.5px dashed color-mix(in srgb, var(--brand-dark) 28%, transparent);
    background: color-mix(in srgb, var(--bg) 50%, transparent);
  }
  .slot.filled { background: color-mix(in srgb, var(--gold) 16%, transparent); }

  /* ---- build screen ---- */
  .mystub {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .mystub .count {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.4rem;
    color: var(--brand-dark);
  }
  .rec { width: 100%; margin-bottom: 16px; }

  .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 12px; }
  .stepbtn {
    display: grid;
    gap: 2px;
    padding: 8px 6px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    cursor: pointer;
    text-align: center;
  }
  .stepbtn b { font-family: var(--font-display); font-weight: 800; font-size: 0.82rem; color: var(--brand-dark); }
  .stepbtn small { color: var(--muted); font-size: 0.7rem; }
  .stepbtn.on { border-color: var(--brand); box-shadow: inset 0 0 0 1px var(--brand); }

  .mapwrap { height: 40vh; min-height: 240px; margin-bottom: 12px; }

  .listhead { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }

  .ranklist { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .ranklist li { border-top: 1px solid var(--line); }
  .ranklist li:first-child { border-top: 0; }
  .ranklist li.picked { background: color-mix(in srgb, var(--gold) 10%, transparent); border-radius: 10px; }
  .rl-main { display: flex; align-items: center; gap: 8px; padding: 8px 6px; }
  .rl-tap {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 0;
    background: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }
  .rl-mark { flex: 0 0 auto; display: grid; place-items: center; }
  .rl-body { min-width: 0; display: grid; gap: 1px; }
  .rl-body b { font-family: var(--font-display); font-weight: 700; color: var(--brand-dark); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rl-body small { color: var(--muted); font-size: 0.76rem; }
  .rl-body em { font-style: normal; font-weight: 700; }
  .rl-body em.open { color: var(--teal); }
  .rl-body em.closed { color: var(--muted); }
  .rl-body em.soon { color: var(--gold); }
  .rl-pick {
    flex: 0 0 auto;
    border: 1.5px solid color-mix(in srgb, var(--brand) 40%, transparent);
    background: var(--surface);
    color: var(--brand-dark);
    border-radius: 999px;
    padding: 7px 14px;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 0.8rem;
    cursor: pointer;
    white-space: nowrap;
  }
  .rl-pick.on { background: var(--grad-brand); border-color: transparent; color: #fff; }
  .rl-intro { margin: 0 6px 10px; color: var(--muted); font-size: 0.82rem; line-height: 1.45; }

  .done-cta { width: 100%; margin-top: 16px; }
</style>
