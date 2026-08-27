<script>
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import destinations from '$lib/data/sites.js';
  import tours from '$lib/data/tours.json';
  import rewards from '$lib/data/rewards.json';
  import StudyToggle from '$lib/components/StudyToggle.svelte';
  import LangSwitch from '$lib/components/LangSwitch.svelte';
  import InstallApp from '$lib/components/InstallApp.svelte';
  import MatCua from '$lib/components/MatCua.svelte';
  import SetList from '$lib/components/SetList.svelte';
  import TicketScan from '$lib/components/TicketScan.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import {
    passport,
    hasStamp,
    isSetComplete,
    isRedeemed,
    prettyCode,
    backupLink,
    restore,
    restoreFromTicket,
    restoreFromHash
  } from '$lib/passport.svelte.js';
  import { plan, setTicketCode } from '$lib/plan.svelte.js';
  import { POINTS, breakdown } from '$lib/score.js';
  import { t, i18n } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  // organisers' sheet, updated by them during the week — not content we ship
  const RESONANCE_URL = 'https://docs.google.com/spreadsheets/d/17D28LNHU6fw2_3qScnd16qVXegeS_K1Nooc4-lHNy9E/';

  const total = destinations.length;
  const byId = Object.fromEntries(destinations.map((d) => [d.id, d]));

  const count = $derived(passport.stamps.length);
  const score = $derived(breakdown(passport.stamps, tours, total));

  // Your route = the 5 you built (plan.set). Progress is against it, not all 25.
  const routeSize = $derived(plan.set.length || 5);
  const routeDone = $derived(plan.set.filter((id) => hasStamp(id)).length);
  const routePct = $derived(Math.round((routeDone / routeSize) * 100));
  const routeComplete = $derived(plan.set.length > 0 && routeDone >= plan.set.length);
  const slotList = $derived(Array.from({ length: 5 }, (_, i) => plan.set[i] ?? null));

  // Tour/set progress rows (grouped list) — a set is what earns a voucher.
  const setRows = $derived(
    tours.map((tour) => ({
      tour,
      stops: tour.stops.map((id) => byId[id]).filter(Boolean),
      done: tour.stops.filter((id) => hasStamp(id)).length,
      complete: isSetComplete(tour.stops)
    }))
  );

  // Minimal-scroll passport: progress + points sit up top; the reward ladder and the
  // tour list fold away. They auto-OPEN only when something is claimable, so an action
  // the visitor needs (claim a reward, redeem a completed set) is never hidden.
  // One gift per account (easier counter control): a visitor claims a single
  // reward tier — the best one unlocked — and once any is taken, no more. The
  // list is ascending, so the last unlocked entry is the highest tier reached.
  const rewardClaimed = $derived(rewards.find((r) => isRedeemed(r.id)) ?? null);
  const offer = $derived(rewardClaimed ? null : (rewards.filter((r) => score.total >= r.points).at(-1) ?? null));
  // cheapest reward still out of reach → how many points to the next one
  const nextReward = $derived([...rewards].filter((r) => r.points > score.total).sort((a, b) => a.points - b.points)[0]);
  const claimableTours = $derived(setRows.filter((x) => x.complete && !isRedeemed(x.tour.id)));
  // the same shape SetList takes on the planner: the tour with its stops resolved
  const tourSets = $derived(setRows.map(({ tour, stops }) => ({ ...tour, stops })));
  let openSet = $state(null);
  // which milestone's reward is shown: a tapped one, else the next to reach, else the
  // top tier once everything is passed
  let selMile = $state(null);
  // opened from an effect (not an `open={}` attribute): this page is prerendered, so
  // the markup ships closed and only a post-hydration write reliably opens it
  let rewardsOpen = $state(false);
  $effect(() => {
    if (offer != null) rewardsOpen = true;
  });
  const shown = $derived(
    rewards.find((r) => r.id === selMile) ?? nextReward ?? rewards.at(-1) ?? null
  );
  // milestone bar fill: tiers sit at (i + 0.5) / n; fill covers every passed tier and
  // interpolates toward the next by points, so it moves with each check-in
  const milePct = $derived.by(() => {
    const n = rewards.length;
    const passed = rewards.filter((r) => score.total >= r.points).length;
    if (passed >= n) return 100;
    const prev = passed ? rewards[passed - 1].points : 0;
    const frac = (score.total - prev) / (rewards[passed].points - prev);
    return Math.max(0, ((passed - 0.5 + frac) / n) * 100);
  });

  // --- backup & recovery ---
  let notice = $state('');
  let rescan = $state(); // bound TicketScan — the restore panel drives its start()
  let code = $state('');
  let busy = $state(false);

  onMount(() => {
    if (restoreFromHash(location.hash)) {
      notice = s('restore_ok');
      history.replaceState(null, '', location.pathname + location.search);
    }
  });

  async function copy(text, msg) {
    try {
      await navigator.clipboard.writeText(text);
      notice = msg;
    } catch {
      notice = text;
    }
  }
  // scanned the ticket in the recovery panel: adopt its code (claiming the ticket
  // for this phone) and merge whatever was backed up under it
  async function onTicketScanned(raw) {
    busy = true;
    notice = '';
    try {
      await restoreFromTicket(raw);
      setTicketCode(raw); // also unlocks the physical-gift tiers
      notice = s('restore_ok');
    } catch (e) {
      notice = e.message === 'bad-code' ? s('restore_bad') : s('restore_offline');
    } finally {
      busy = false;
    }
  }
  async function doRestore() {
    busy = true;
    notice = '';
    try {
      await restore(code);
      notice = s('restore_ok');
      code = '';
    } catch (e) {
      notice =
        e.message === 'bad-code' ? s('restore_bad')
        : e.message === 'not-found' ? s('wrong_code')
        : s('restore_offline');
    } finally {
      busy = false;
    }
  }
</script>

<div class="pp">
  <header class="head">
    <h1 class="ptitle">{s('passport')}</h1>
  </header>

  <!-- Your route (the built 5) — tap to resume the walking nav -->
  {#if plan.set.length}
    <a class="rcard" href="{base}{routeComplete ? '/tours' : '/go'}">
      <div class="rhead">
        <strong>{routeComplete ? s('route_more') : s('route_resume')}</strong>
        <span class="rprog">{routeDone} / {routeSize}</span>
      </div>
      <div class="pbar"><i style="width: {routePct}%"></i></div>
      <div class="slots" aria-hidden="true">
        {#each slotList as id, i (i)}
          {#if id && byId[id]}
            {@const d = byId[id]}
            {@const got = hasStamp(id)}
            <span class="slot" class:filled={got} style="--cat: var(--c-{d.category})">
              <MatCua size={30} color="var(--cat)" inner="var(--surface)" ghost={!got} />
            </span>
          {:else}
            <span class="slot empty"></span>
          {/if}
        {/each}
      </div>
    </a>
  {:else}
    <section class="rcard">
      <div class="rhead">
        <strong>{s('route_label')}</strong>
        <span class="rprog">{routeDone} / {routeSize}</span>
      </div>
      <div class="pbar"><i style="width: {routePct}%"></i></div>
      <a class="route-empty" href="{base}/">{s('route_empty')}</a>
    </section>
  {/if}

  <!-- Rewards — points headline merged in. Summary counts down to the next reward;
       opens itself when a tier is claimable. How points work lives here too. -->
  <details class="fold" bind:open={rewardsOpen}>
    <summary>{s('rewards_title')}{#if offer} · 1 ✓{/if}</summary>
    <!-- milestone bar: every tier as a stop on one track, evenly spaced (the point
         values are too uneven to plot to scale); the fill reaches the last tier you've
         passed and creeps toward the next, which sits lifted in a bubble -->
    <div class="mile">
      <div class="mile-icons" style="--n: {rewards.length}">
        {#each rewards as r, i (r.id)}
          <button
            class="m"
            class:on={score.total >= r.points}
            class:next={r.id === nextReward?.id}
            class:sel={r.id === shown?.id}
            style="--i: {i}"
            onclick={() => (selMile = r.id)}
            aria-pressed={r.id === shown?.id}
            aria-label={`${r.points} ${s('points')} · ${t(r.title)}`}
          >{r.icon}</button>
        {/each}
      </div>
      <div class="mile-track"><i style="width: {milePct}%"></i></div>
      <div class="mile-pts" style="--n: {rewards.length}">
        {#each rewards as r, i (r.id)}<span style="--i: {i}">{r.points}</span>{/each}
      </div>
    </div>
    <!-- one card: the selected milestone (defaults to the next one to reach) -->
    {#if shown}
      {@const r = shown}
      {@const unlocked = score.total >= r.points}
      {@const taken = isRedeemed(r.id)}
      <div class="list flush">
        {#key r.id}
          <div class="row mile-card">
            <span class="rbody">
              <b>{t(r.reward)}</b>
              <small>
                {unlocked ? s('reward_at', r.points) : s('pts_more', r.points - score.total)}
                <!-- physical gifts are handed over against a real ticket (rewards.json:
                     needsTicket) — say so on the ladder, not only at the counter -->
                {#if r.needsTicket}<em class="tk-tag">· {s('needs_ticket_tag')}</em>{/if}
              </small>
            </span>
            {#if taken}
              <span class="pill good"><Icon name="check" size={13} /> {s('reward_taken')}</span>
            {:else if offer?.id === r.id}
              <!-- claiming is its own screen: a counter works it, not the visitor -->
              <a class="btn claim" href="{base}/redeem">{s('redeem_title')}</a>
            {:else if unlocked}
              <span class="pill muted">{s('r_higher')}</span>
            {/if}
          </div>
        {/key}
      </div>
    {/if}
    <!-- the ladder reads as cumulative (five tiers, one bar) and isn't: claiming
         spends the passport's single gift slot, not points -->
    <p class="foot">{s('one_gift_note')}</p>
    <details class="row-details">
      <summary>{s('score_how')}</summary>
      <ul class="rules">
        <li><b>{s('earned', POINTS.stamp)}</b> · {s('pt_stamp')}</li>
        <li><b>{s('earned', POINTS.perfect)}</b> · {s('pt_perfect')}</li>
        <li><b>{s('earned', POINTS.spotlight)}</b> · {s('pt_spotlight')}</li>
        <li><b>{s('earned', POINTS.tour)}</b> · {s('pt_tour')}</li>
        <li><b>{s('earned', POINTS.allSites)}</b> · {s('pt_all', total)}</li>
      </ul>
    </details>
  </details>

  <!-- Suggested journeys — the same accordion the planner shows, with stamp progress -->
  <details class="fold" open={claimableTours.length > 0}>
    <summary>{s('tours')}</summary>
    <SetList
      sets={tourSets}
      bind:open={openSet}
      actionLabel={s('nav_start')}
      hrefFor={(set) => `${base}/tours/${set.id}`}
      stamped={hasStamp}
    />
  </details>

  <!-- All sites (secondary) -->
  <details class="fold">
    <summary>{s('all_sites')}</summary>
    <div class="grid">
      {#each destinations as d (d.id)}
        {@const got = hasStamp(d.id)}
        <a class="stamp" class:got href="{base}/destinations/{d.id}?from=passport" style="--cat: var(--c-{d.category})">
          <MatCua size={40} color="var(--cat)" inner="var(--surface)" ghost={!got} />
          <small>{t(d.name)}</small>
        </a>
      {/each}
    </div>
  </details>

  <!-- Settings: language, recovery, study consent, install -->
  <details class="fold">
    <summary>{s('pp_more')}</summary>
    <div class="settings">
      <!-- 1. Ngôn ngữ (Language) -->
      <details class="fold">
        <summary>{s('lang_switch')} · {i18n.lang.toUpperCase()}</summary>
        <LangSwitch />
      </details>

      <!-- 2. Sao lưu — the code IS the backup: one line saying so, then the code itself -->
      <details class="fold">
        <summary>{s('backup_title')}</summary>
        <div class="backup">
          <p class="hint">{s('backup_hint')}</p>
          <div class="codebox">
            <span class="pid">{prettyCode()}</span>
            <button class="btn secondary" onclick={() => copy(prettyCode(), s('copied'))}>{s('copy')}</button>
          </div>
          <button class="btn secondary wide" onclick={() => copy(backupLink(), s('copied'))}>{s('copy_link')}</button>
          <p class="hint">{s('offline_ok')}</p>
        </div>
      </details>

      <!-- 3. Khôi phục — its own item, not buried inside the backup panel: someone
           restoring on a new device has no backup code panel to look under. -->
      <details class="fold">
        <summary>{s('restore')}</summary>
        <div class="backup">
          <!-- Scanning the ticket is the easy path: it derives the same code the ticket
               minted in the first place. `bare` because this panel supplies its own
               button — TicketScan's own strip would add a "buy a ticket" prompt, which
               is the wrong offer to someone recovering a passport they already have. -->
          <TicketScan bind:this={rescan} onsaved={onTicketScanned} hero bare />
          <button class="btn wide" onclick={() => rescan?.start()}>{s('scan_btn')}</button>
          <p class="hint or">{s('restore_or_code')}</p>
          <input class="code-in" bind:value={code} placeholder="XXXX-XXXX" autocapitalize="characters" />
          <button class="btn secondary wide" onclick={doRestore} disabled={busy}>{s('restore')}</button>
          {#if notice}<p class="notice">{notice}</p>{/if}
          {#if passport.taken}<p class="notice warn">{s('ticket_taken')}</p>{/if}
        </div>
      </details>

      <!-- 4. Tham gia nghiên cứu -->
      <details class="fold">
        <summary>{s('study_agree')}</summary>
        <div class="study-fold">
          <StudyToggle />
          <p class="hint">{s('study_note')}</p>
        </div>
      </details>

      <InstallApp />

      <!-- the two standing text pages: rules and terms. Nothing else in the app links
           them, and the settings fold is where someone goes looking. -->
      <div class="plinks">
        <a href="{base}/guide">{s('guide_title')}</a>
        <a href="{base}/terms">{s('terms_title')}</a>
      </div>
    </div>
  </details>

  <!-- The organisers' own sheet of the 30 partner venues. Lives outside the app and
       needs a connection — the one link here that does — so it is a plain outbound
       link at the very bottom, not a card competing with the stamps. -->
  <a class="resonance" href={RESONANCE_URL} target="_blank" rel="noopener">{s('resonance_30')}</a>
</div>

<style>
  .plinks { display: flex; gap: 16px; padding: 4px 2px; }
  .plinks a {
    color: var(--muted);
    font-size: var(--fs-sm);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .resonance {
    align-self: center;
    padding: 4px 8px 8px;
    color: var(--muted);
    font-size: var(--fs-sm);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .pp {
    padding: 18px var(--gutter) 8px;
    padding-top: var(--pad-top);
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .head { display: flex; flex-direction: column; gap: 2px; }

  /* Your route card */
  .rcard {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-decoration: none;
    color: inherit;
  }
  .rhead { display: flex; align-items: baseline; justify-content: space-between; }
  .rhead strong { font-size: var(--fs-lg); font-weight: 700; }
  .rprog { color: var(--muted); font-weight: 700; font-variant-numeric: tabular-nums; }
  .pbar { height: 6px; border-radius: 999px; background: var(--bg); overflow: hidden; }
  .pbar i { display: block; height: 100%; border-radius: 999px; background: var(--brand); transition: width 0.3s ease; }
  .slots { display: flex; gap: 8px; }
  .slot { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; }
  .slot.filled { background: color-mix(in srgb, var(--cat) 15%, transparent); }
  .slot.empty { border: 1.5px dashed color-mix(in srgb, var(--ink) 22%, transparent); }
  .route-empty { color: var(--brand); font-weight: 600; }

  /* grouped list (rewards, points, sets) */
  .list {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-top: 1px solid var(--line);
    text-decoration: none;
    color: inherit;
  }
  .row:first-child { border-top: 0; }
  /* same 16px gutter and muted register as the .row / .row-details text above it */
  .foot { margin: 8px 0 2px; padding: 0 16px; font-size: var(--fs-sm); line-height: 1.5; color: var(--muted); }

  /* ---- reward milestone bar ---- */
  .mile { padding: 6px 4px 10px; display: grid; gap: 6px; }
  .mile-icons, .mile-pts { position: relative; height: 44px; }
  .mile-pts { height: 16px; }
  .mile-icons .m, .mile-pts span {
    position: absolute; top: 0;
    left: calc((var(--i) + 0.5) / var(--n) * 100%); transform: translateX(-50%);
  }
  .mile-icons .m {
    display: grid; place-items: center; width: 40px; height: 40px;
    font-size: var(--fs-xl); line-height: 1;
    border: 0; background: none; padding: 0; cursor: pointer;
    border-radius: 12px; opacity: 0.45; filter: grayscale(0.4);
    transition: opacity 0.2s, transform 0.2s;
  }
  .mile-icons .m:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .mile-icons .m.on { opacity: 1; filter: none; }
  /* the selected tier (defaults to the next one): lifted in a bubble with a pointer
     down to its stop on the track; gold when it's the next to reach, ink otherwise */
  .mile-icons .m.sel {
    opacity: 1; filter: none;
    background: var(--surface); border: 1.5px solid var(--line);
    box-shadow: var(--shadow);
    transform: translateX(-50%) translateY(-3px);
  }
  .mile-icons .m.sel.next { border-color: var(--gold); }
  .mile-icons .m.sel::after {
    content: ''; position: absolute; left: 50%; bottom: -7px; transform: translateX(-50%);
    border: 6px solid transparent; border-bottom: 0; border-top-color: var(--line);
  }
  .mile-icons .m.sel.next::after { border-top-color: var(--gold); }
  .mile-track { height: 8px; border-radius: 999px; background: var(--bg); overflow: hidden; }
  .mile-track i { display: block; height: 100%; border-radius: 999px; background: var(--brand); transition: width 0.4s ease; }
  .mile-pts span { font-size: var(--fs-xs); font-weight: 600; color: var(--muted); }
  .rbody { flex: 1 1 auto; min-width: 0; display: grid; gap: 2px; }
  .rbody b { font-weight: 600; font-size: var(--fs-md); }
  .rbody small { color: var(--muted); font-size: var(--fs-sm); }

  .pill {
    flex: 0 0 auto;
    font-size: var(--fs-xs);
    font-weight: 700;
    padding: 5px 11px;
    border-radius: 999px;
    white-space: nowrap;
  }
  .pill.good { background: color-mix(in srgb, var(--teal) 16%, transparent); color: var(--teal); }
  .pill.gold { background: color-mix(in srgb, var(--gold) 18%, transparent); color: var(--gold); }
  .pill.muted { background: var(--bg); color: var(--muted); }

  /* how-points, inside the points list */
  .row-details { border-top: 1px solid var(--line); }
  .row-details summary { padding: 12px 16px; cursor: pointer; color: var(--muted); font-weight: 600; font-size: var(--fs-sm); }
  .rules { margin: 0; padding: 0 16px 14px 34px; font-size: var(--fs-sm); line-height: 1.7; color: var(--muted); }
  .rules b { color: var(--brand); }

  /* secondary folds */
  .fold {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .fold > summary { padding: 14px 16px; cursor: pointer; font-weight: 600; list-style: none; }
  .fold > summary::-webkit-details-marker { display: none; }
  .fold > summary::after { content: '▸'; float: right; color: var(--muted); }
  .fold[open] > summary::after { content: '▾'; }

  /* a grouped list nested inside a fold: drop its own box, let the fold be the box */
  .fold .list.flush { border: 0; border-radius: 0; background: none; border-top: 1px solid var(--line); }

  /* Settings fold: light sub-folds, dividers instead of nested cards */
  .settings { border-top: 1px solid var(--line); }
  .settings .fold { border-top: 1px solid var(--line); }
  .settings .fold:first-child { border-top: 0; }
  .settings .fold > summary {
    padding: 12px 16px; cursor: pointer; font-weight: 600; font-size: var(--fs-sm); list-style: none;
  }
  .settings .fold > summary::-webkit-details-marker { display: none; }
  .settings .fold > summary::after { content: '▸'; float: right; color: var(--muted); }
  .settings .fold[open] > summary::after { content: '▾'; }

  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 4px 16px 16px; }
  .stamp { display: grid; justify-items: center; gap: 4px; text-decoration: none; color: inherit; }
  .stamp small { font-size: var(--fs-sm); line-height: 1.15; text-align: center; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .stamp.got small { color: var(--ink); }

  .backup { padding: 0 16px 16px; display: grid; gap: 10px; }
  .backup .hint { margin: 0; color: var(--muted); font-size: var(--fs-md); line-height: 1.5; }
  .codebox { display: flex; gap: 10px; align-items: center; }
  .pid {
    flex: 1;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-xl);
    letter-spacing: 0.12em;
    text-align: center;
    padding: 10px;
    border-radius: 12px;
    background: var(--bg);
  }
  .codebox .btn { width: auto; }
  .btn.wide { width: 100%; }
  .code-in {
    width: 100%;
    margin: 8px 0;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: var(--fs-md);
    text-align: center;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  .notice { margin: 0; font-weight: 600; word-break: break-word; }
  .notice.warn { color: var(--brand); font-weight: 600; }
  .claim { flex: 0 0 auto; padding: 9px 16px; font-size: var(--fs-sm); }
  .tk-tag { font-style: normal; font-weight: 700; color: var(--gold); }
</style>
