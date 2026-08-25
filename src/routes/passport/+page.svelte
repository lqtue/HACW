<script>
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import destinations from '$lib/data/destinations.json';
  import tours from '$lib/data/tours.json';
  import rewards from '$lib/data/rewards.json';
  import StaffConfirm from '$lib/components/StaffConfirm.svelte';
  import NearestBooth from '$lib/components/NearestBooth.svelte';
  import StudyToggle from '$lib/components/StudyToggle.svelte';
  import LangSwitch from '$lib/components/LangSwitch.svelte';
  import InstallApp from '$lib/components/InstallApp.svelte';
  import MatCua from '$lib/components/MatCua.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import {
    passport,
    hasStamp,
    isSetComplete,
    isRedeemed,
    redeemSet,
    prettyCode,
    backupLink,
    restore,
    restoreFromHash
  } from '$lib/passport.svelte.js';
  import { plan } from '$lib/plan.svelte.js';
  import { POINTS, breakdown } from '$lib/score.js';
  import { t, i18n } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

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

  // --- backup & recovery ---
  let notice = $state('');
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
        : e.message === 'not-found' ? s('restore_missing')
        : s('restore_offline');
    } finally {
      busy = false;
    }
  }
</script>

<div class="pp">
  <header class="head">
    <h1 class="ptitle">{s('passport_title')}</h1>
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
          {#if id}
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
  <details class="fold" open={offer != null}>
    <summary>{nextReward ? s('pts_to_reward', nextReward.points - score.total) : s('rewards_title')}{#if offer} · 1 ✓{/if}</summary>
    <div class="list flush">
      <div class="row">
        <span class="rbody"><b>{score.total} {s('points')}</b><small>{s('reward_one')}</small></span>
        <span class="pill muted">{count}/{total} ✓</span>
      </div>
      {#each rewards as r (r.id)}
        {@const unlocked = score.total >= r.points}
        {@const taken = isRedeemed(r.id)}
        <div class="row">
          <span class="rbody">
            <b>{t(r.reward)}</b>
            <small>{s('reward_locked', r.points)}</small>
          </span>
          {#if taken}
            <span class="pill good"><Icon name="check" size={13} /> {s('reward_taken')}</span>
          {:else if offer?.id === r.id}
            <StaffConfirm label={s('claim')} onconfirm={() => redeemSet(r.id)} />
          {:else if unlocked}
            <span class="pill muted">{s('r_higher')}</span>
          {:else}
            <span class="pill muted">{s('r_locked')}</span>
          {/if}
        </div>
      {/each}
    </div>
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

  <!-- Tour sets — folded; opens itself when a completed set can be redeemed -->
  <details class="fold" open={claimableTours.length > 0}>
    <summary>{s('tours')}</summary>
    <div class="list flush">
      {#each setRows as { tour, stops, done, complete } (tour.id)}
        <a class="row" href="{base}/tours/{tour.id}">
          <span class="dots" aria-hidden="true">
            {#each stops as d (d.id)}<i style="background: var(--c-{d.category}); opacity: {hasStamp(d.id) ? 1 : 0.3}"></i>{/each}
          </span>
          <span class="rbody">
            <b>{t(tour.title)}</b>
            <small>{done}/{stops.length}{#if complete} · {s('set_complete')}{/if}</small>
          </span>
          {#if complete}
            <span class="pill good"><Icon name="check" size={13} /></span>
          {/if}
        </a>
      {/each}
    </div>
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
      <details class="fold">
        <summary>{s('lang_switch')} · {i18n.lang.toUpperCase()}</summary>
        <LangSwitch />
      </details>

      <details class="fold">
        <summary>{s('backup_title')}</summary>
        <div class="backup">
          <p class="hint">{s('backup_hint')}</p>
          <p class="code-label">{s('code_label')}</p>
          <div class="codebox">
            <span class="pid">{prettyCode()}</span>
            <button class="btn secondary" onclick={() => copy(prettyCode(), s('copied'))}>{s('copy')}</button>
          </div>
          <button class="btn secondary wide" onclick={() => copy(backupLink(), s('copied'))}>{s('copy_link')}</button>
          <details>
            <summary>{s('restore')}</summary>
            <input class="code-in" bind:value={code} placeholder="XXXX-XXXX" autocapitalize="characters" />
            <button class="btn wide" onclick={doRestore} disabled={busy}>{s('restore_do')}</button>
          </details>
          {#if notice}<p class="notice">{notice}</p>{/if}
          <p class="hint">{s('offline_ok')}</p>
        </div>
      </details>

      <details class="fold">
        <summary>{s('study_note')}</summary>
        <div class="study-fold"><StudyToggle /></div>
      </details>

      <InstallApp />
    </div>
  </details>

  <NearestBooth />
</div>

<style>
  .pp {
    padding: 18px var(--gutter) 8px;
    padding-top: var(--pad-top);
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .head { display: flex; flex-direction: column; gap: 2px; }
  .code-label {
    margin: 2px 0 -4px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

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
  .rhead strong { font-size: 1.1rem; font-weight: 700; }
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
  .rbody { flex: 1 1 auto; min-width: 0; display: grid; gap: 2px; }
  .rbody b { font-weight: 600; font-size: 0.98rem; }
  .rbody small { color: var(--muted); font-size: 0.82rem; }
  .dots { display: inline-flex; gap: 4px; flex: 0 0 auto; }
  .dots i { width: 8px; height: 8px; border-radius: 50%; }

  .pill {
    flex: 0 0 auto;
    font-size: 0.74rem;
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
  .row-details summary { padding: 12px 16px; cursor: pointer; color: var(--muted); font-weight: 600; font-size: 0.85rem; }
  .rules { margin: 0; padding: 0 16px 14px 34px; font-size: 0.86rem; line-height: 1.7; color: var(--muted); }
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
    padding: 12px 16px; cursor: pointer; font-weight: 600; font-size: 0.92rem; list-style: none;
  }
  .settings .fold > summary::-webkit-details-marker { display: none; }
  .settings .fold > summary::after { content: '▸'; float: right; color: var(--muted); }
  .settings .fold[open] > summary::after { content: '▾'; }

  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 4px 16px 16px; }
  .stamp { display: grid; justify-items: center; gap: 4px; text-decoration: none; color: inherit; }
  .stamp small { font-size: 0.62rem; line-height: 1.15; text-align: center; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .stamp.got small { color: var(--ink); }

  .backup { padding: 0 16px 16px; display: grid; gap: 10px; }
  .backup .hint { margin: 0; color: var(--muted); font-size: 0.82rem; line-height: 1.5; }
  .codebox { display: flex; gap: 10px; align-items: center; }
  .pid {
    flex: 1;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.4rem;
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
    font-size: 1.05rem;
    text-align: center;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  .backup details summary { cursor: pointer; font-weight: 600; color: var(--muted); font-size: 0.88rem; }
  .notice { margin: 0; font-weight: 600; word-break: break-word; }
</style>
