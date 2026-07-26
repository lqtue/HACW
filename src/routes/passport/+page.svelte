<script>
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import destinations from '$lib/data/destinations.json';
  import tours from '$lib/data/tours.json';
  import rewards from '$lib/data/rewards.json';
  import StaffConfirm from '$lib/components/StaffConfirm.svelte';
  import NearestBooth from '$lib/components/NearestBooth.svelte';
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
  import { POINTS, breakdown, tierFor, nextTier } from '$lib/score.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  const total = destinations.length;
  const count = $derived(passport.stamps.length);
  const score = $derived(breakdown(passport.stamps, tours, total));
  const rank = $derived(tierFor(count, rewards));
  const next = $derived(nextTier(count, rewards));

  function setProgress(stops) {
    return stops.filter((id) => hasStamp(id)).length;
  }

  // The stamp wall is grouped by tour rather than shown as one wall of 25: a tour
  // is the unit that earns a voucher, so "3 of 5 on this one" is the number a
  // visitor can act on. `check-data.mjs` guarantees every site is in exactly one
  // tour, so this covers all of them with nothing orphaned.
  const byId = Object.fromEntries(destinations.map((d) => [d.id, d]));
  const groups = tours.map((tour) => ({ tour, stops: tour.stops.map((id) => byId[id]).filter(Boolean) }));

  // --- backup & recovery ---
  let notice = $state('');
  let code = $state('');
  let busy = $state(false);

  // A backup link opened on a new phone restores straight away.
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
      notice = text; // clipboard blocked (plain http, old browser) -> show it to copy by hand
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
        e.message === 'bad-code'
          ? s('restore_bad')
          : e.message === 'not-found'
            ? s('restore_missing')
            : s('restore_offline');
    } finally {
      busy = false;
    }
  }
</script>

<div class="topbar"><h1>{s('passport_title')}</h1><small>{s('stamps_of', count, total)}</small></div>

<div class="page">
  <!-- score + rank -->
  <div class="score">
    <div class="big"><strong>{score.total}</strong><small>{s('points')}</small></div>
    <div class="rankinfo">
      <span class="tag" style="background: var(--teal)">{s('rank')}</span>
      <strong>{rank ? `${rank.icon} ${t(rank.title)}` : s('no_rank')}</strong>
      {#if next}
        <small class="muted">{s('next_rank', next.stamps - count, t(next.title))}</small>
        <div class="bar"><i style="width: {Math.round((count / next.stamps) * 100)}%"></i></div>
      {/if}
    </div>
  </div>

  <!-- How the number above was reached. Points are banked at check-in and stored
       on the stamp, so this is a report, not a live recalculation of history. -->
  <details class="how">
    <summary>{s('score_how')}</summary>
    <ul class="rules">
      <li><b>{s('earned', POINTS.stamp)}</b> · {s('pt_stamp')}</li>
      <li><b>{s('earned', POINTS.perfect)}</b> · {s('pt_perfect')}</li>
      <li><b>{s('earned', POINTS.spotlight)}</b> · {s('pt_spotlight')}</li>
      <li><b>{s('earned', POINTS.tour)}</b> · {s('pt_tour')}</li>
      <li><b>{s('earned', POINTS.allSites)}</b> · {s('pt_all', total)}</li>
    </ul>
    <table class="tally">
      <tbody>
        <tr><td>{s('tally_stamps', count)}</td><td class="n">{score.stamps}</td></tr>
        <tr><td>{s('tally_tours', score.toursDone, tours.length)}</td><td class="n">{score.tours}</td></tr>
        <tr><td>{s('tally_all')}</td><td class="n">{score.allSites}</td></tr>
        <tr class="sum"><td>{s('points')}</td><td class="n">{score.total}</td></tr>
      </tbody>
    </table>
  </details>

  <!-- The stamp wall, grouped by tour: the set is what earns a voucher, so it is
       the unit worth showing progress against. -->
  {#each groups as { tour, stops }}
    {@const done = setProgress(tour.stops)}
    {@const complete = isSetComplete(tour.stops)}
    <section class="set-block" class:complete>
      <a class="set-head" href="{base}/tours/{tour.id}">
        <span class="ico">{isRedeemed(tour.id) ? '✅' : complete ? '🎁' : '🚶'}</span>
        <span class="who">
          <strong>{t(tour.title)}</strong>
          <small class="muted">{t(tour.theme)}</small>
        </span>
        <span class="prog">
          <b>{done}/{stops.length}</b>
          <small class="muted">
            {#if isRedeemed(tour.id)}{s('reward_taken')}{:else if complete}{s('set_complete')}{:else}{s('earned', POINTS.tour)}{/if}
          </small>
        </span>
      </a>
      <div class="grid">
        {#each stops as d}
          {@const got = hasStamp(d.id)}
          <a class="stamp" class:got href="{base}/destinations/{d.id}" style="--cat: var(--c-{d.category})">
            <div class="seal">
              {#if got}<span>{t(d.name).charAt(0)}</span>{:else}<span class="lock">?</span>{/if}
            </div>
            <small class="name">{t(d.name)}</small>
          </a>
        {/each}
      </div>
    </section>
  {/each}

  {#if count === total}
    <div class="banner" style="margin-top: 12px; text-align: center">{s('all_done')}</div>
  {/if}

  <!-- everything below is reference material -> native <details>, closed by default -->
  <details>
    <summary>{s('rewards_title')} · {rewards.filter((r) => count >= r.stamps).length}/{rewards.length}</summary>
    <div class="sets">
    {#each rewards as r}
      {@const unlocked = count >= r.stamps}
      {@const taken = isRedeemed(r.id)}
      <div class="set" class:complete={unlocked}>
        <span class="ico">{taken ? '✅' : unlocked ? r.icon : '🔒'}</span>
        <span class="info">
          <strong>{t(r.title)}</strong>
          <small class="muted">{t(r.reward)}</small>
          <small class="muted">
            {taken ? s('reward_taken') : unlocked ? s('reward_ready') : s('reward_locked', r.stamps)}
          </small>
          {#if unlocked && !taken}
            <div class="claim">
              <StaffConfirm label={s('claim')} onconfirm={() => redeemSet(r.id)} />
            </div>
          {/if}
        </span>
      </div>
    {/each}
    </div>
    <!-- Every tier above is collected in person at a counter, and a counter is also
         where a visitor goes for help — so the finder sits here unconditionally. -->
    <NearestBooth />
  </details>

  <!-- backup & recovery -->
  <details>
    <summary>{s('backup_title')}</summary>
    <div class="backup">
    <p class="muted"><small>{s('backup_hint')}</small></p>
    <small class="muted">{s('your_code')}</small>
    <div class="codebox">
      <span class="pid">{prettyCode()}</span>
      <button class="btn secondary" onclick={() => copy(prettyCode(), s('copied'))}>{s('copy')}</button>
    </div>
    <button class="btn secondary" onclick={() => copy(backupLink(), s('copied'))} style="width: 100%">
      🔗 {s('copy_link')}
    </button>

    <details>
      <summary>{s('restore')}</summary>
      <input class="code" bind:value={code} placeholder="XXXX-XXXX" autocapitalize="characters" />
      <button class="btn" onclick={doRestore} disabled={busy} style="width: 100%">
        {s('restore_do')}
      </button>
    </details>

    {#if notice}<p class="notice">{notice}</p>{/if}
    <p class="muted"><small>{s('offline_ok')}</small></p>
  </div>
</div>

<style>
  .score {
    display: flex;
    align-items: center;
    gap: 16px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 14px 16px;
    box-shadow: var(--shadow);
    margin-bottom: 6px;
  }
  .score .big { display: grid; justify-items: center; min-width: 90px; }
  .score .big strong {
    font-family: var(--font-display);
    font-size: 2.6rem;
    line-height: 1;
    color: var(--brand);
  }
  .score .rankinfo { display: grid; gap: 3px; flex: 1; }
  .score .tag { justify-self: start; }
  .bar { height: 6px; border-radius: 3px; background: var(--bg); overflow: hidden; margin-top: 4px; }
  .bar i { display: block; height: 100%; background: var(--teal); }

  /* collapsed by default: the page must open on one screen of stamps */
  .page > details {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    margin-top: 10px;
    box-shadow: var(--shadow);
  }
  .page > details > summary {
    padding: 13px 14px;
    font-weight: 700;
    cursor: pointer;
    list-style: none;
  }
  .page > details > summary::-webkit-details-marker { display: none; }
  .page > details > summary::after { content: ' ▸'; color: var(--muted); }
  .page > details[open] > summary::after { content: ' ▾'; }
  .page > details > :not(summary) { padding: 0 14px 14px; }

  .sets { display: grid; gap: 10px; }
  .set {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 12px 14px;
    box-shadow: var(--shadow);
  }
  .set.complete { border-color: color-mix(in srgb, var(--gold) 55%, var(--line)); }
  .set .ico { font-size: 1.5rem; }
  .set .info { display: grid; flex: 1; }
  .claim { margin-top: 8px; }

  /* --- the stamp wall, one block per tour --- */
  .set-block { margin-top: 16px; }
  .set-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 2px;
  }
  .set-head .ico { font-size: 1.35rem; }
  .set-head .who { display: grid; flex: 1; min-width: 0; }
  .set-head .who strong { font-family: var(--font-display); font-size: 1.05rem; }
  .set-head .who small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .set-head .prog { display: grid; justify-items: end; text-align: right; }
  .set-head .prog b { color: var(--brand); font-size: 1.05rem; }
  .set-block.complete .set-head .prog b { color: var(--teal); }

  /* --- how points work --- */
  .how { margin-top: 12px; }
  .rules { margin: 0 0 10px; padding-left: 18px; font-size: 0.88rem; line-height: 1.7; }
  .rules b { color: var(--brand); }
  .tally { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  .tally td { padding: 5px 0; border-bottom: 1px solid var(--line); }
  .tally .n { text-align: right; font-variant-numeric: tabular-nums; }
  .tally .sum td { font-weight: 700; border-bottom: none; color: var(--brand); }

  /* 4 across ≈ one screen — was 2 across and three screens long */
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px; }
  .stamp {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 8px 4px 6px;
    text-align: center;
    display: grid;
    gap: 3px;
    justify-items: center;
    box-shadow: var(--shadow);
  }
  .stamp .name {
    font-weight: 600;
    font-size: 0.66rem;
    line-height: 1.15;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .stamp:not(.got) { box-shadow: none; }
  .stamp:not(.got) .name { color: var(--muted); }

  .seal {
    width: 46px; height: 46px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 2px;
    border: 2px dashed var(--line);
    color: var(--muted);
  }
  .stamp.got .seal {
    border: 2px solid var(--cat);
    box-shadow: inset 0 0 0 4px color-mix(in srgb, var(--cat) 14%, var(--surface));
    background: color-mix(in srgb, var(--cat) 9%, var(--surface));
    color: var(--cat);
    transform: rotate(-5deg);
  }
  .lock { font-family: var(--font-body); font-weight: 500; }

  .backup {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 14px;
    display: grid;
    gap: 10px;
  }
  .backup p { margin: 0; }
  .codebox { display: flex; gap: 10px; align-items: center; }
  .pid {
    flex: 1;
    font-family: var(--font-display);
    font-size: 1.6rem;
    letter-spacing: 0.12em;
    text-align: center;
    padding: 8px;
    border: 1px dashed var(--line);
    border-radius: 12px;
    background: var(--bg);
  }
  .codebox .btn { width: auto; padding: 10px 14px; }
  details summary { cursor: pointer; font-weight: 600; padding: 4px 0; }
  .code {
    width: 100%;
    padding: 12px 14px;
    margin: 8px 0;
    border: 1px solid var(--line);
    border-radius: 12px;
    font-family: var(--font-body);
    font-size: 1.1rem;
    text-align: center;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  .notice { margin: 0; font-weight: 600; word-break: break-all; }
</style>
