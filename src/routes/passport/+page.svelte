<script>
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import destinations from '$lib/data/destinations.json';
  import tours from '$lib/data/tours.json';
  import rewards from '$lib/data/rewards.json';
  import StaffConfirm from '$lib/components/StaffConfirm.svelte';
  import NearestBooth from '$lib/components/NearestBooth.svelte';
  import MatCua from '$lib/components/MatCua.svelte';
  import PageShell from '$lib/components/PageShell.svelte';
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
  // Tiers gate on points, not stamp count — that is what makes perfect quizzes,
  // spotlight sites and finished tours worth anything at the counter.
  const rank = $derived(tierFor(score.total, rewards));
  const next = $derived(nextTier(score.total, rewards));

  function setProgress(stops) {
    return stops.filter((id) => hasStamp(id)).length;
  }

  // The stamp wall is grouped by tour rather than shown as one wall of 25: a tour
  // is the unit that earns a voucher, so "3 of 5 on this one" is the number a
  // visitor can act on. Only the surveyed routes are tours, so everything else
  // lands in a final block — those sites still stamp and still score, they just
  // are not a voucher set (`tour: null` is what the markup keys on).
  const byId = Object.fromEntries(destinations.map((d) => [d.id, d]));
  const inTour = new Set(tours.flatMap((t) => t.stops));
  const loose = destinations.filter((d) => !inTour.has(d.id));
  const groups = [
    ...tours.map((tour) => ({ tour, stops: tour.stops.map((id) => byId[id]).filter(Boolean) })),
    ...(loose.length ? [{ tour: null, stops: loose }] : [])
  ];

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

<PageShell title={s('passport_title')} sub={s('stamps_of', count, total)}>
  <!-- score + rank -->
  <div class="score">
    <div class="big"><strong>{score.total}</strong><small>{s('points')}</small></div>
    <div class="rankinfo">
      <span class="tag" style="background: var(--teal)">{s('rank')}</span>
      <strong>{rank ? `${rank.icon} ${t(rank.title)}` : s('no_rank')}</strong>
      {#if next}
        <small class="muted">{s('next_rank', next.points - score.total, t(next.title))}</small>
        <div class="bar"><i style="width: {Math.round(Math.min(1, score.total / next.points) * 100)}%"></i></div>
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
    {@const done = tour ? setProgress(tour.stops) : stops.filter((d) => hasStamp(d.id)).length}
    {@const complete = tour ? isSetComplete(tour.stops) : false}
    <section class="set-block" class:complete>
      {#if tour}
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
      {:else}
        <!-- outside the surveyed routes: stamps and points, but no voucher set -->
        <div class="set-head">
          <span class="ico">📍</span>
          <span class="who">
            <strong>{s('other_sites')}</strong>
            <small class="muted">{s('other_sites_hint')}</small>
          </span>
          <span class="prog"><b>{done}/{stops.length}</b></span>
        </div>
      {/if}
      <div class="grid">
        {#each stops as d}
          {@const got = hasStamp(d.id)}
          <a class="stamp" class:got href="{base}/destinations/{d.id}" style="--cat: var(--c-{d.category})">
            <!-- the stamp is a mắt cửa: carved but unpainted until you've been -->
            <div class="seal">
              <MatCua
                size={52}
                ghost={!got}
                motif={d.id.charCodeAt(0) % 2 ? 'spiral' : 'am-duong'}
                color="var(--cat)"
                inner={got ? '#fbe0b8' : 'transparent'}
                ink="var(--cat)"
              />
              <span class="glyph">{got ? t(d.name).charAt(0) : ''}</span>
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
    <summary>{s('rewards_title')} · {rewards.filter((r) => score.total >= r.points).length}/{rewards.length}</summary>
    <div class="sets">
    {#each rewards as r}
      {@const unlocked = score.total >= r.points}
      {@const taken = isRedeemed(r.id)}
      <div class="set" class:complete={unlocked}>
        <span class="ico">{taken ? '✅' : unlocked ? r.icon : '🔒'}</span>
        <span class="info">
          <strong>{t(r.title)}</strong>
          <small class="muted">{t(r.reward)}</small>
          <small class="muted">
            {taken ? s('reward_taken') : unlocked ? s('reward_ready') : s('reward_locked', r.points)}
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
</PageShell>

<style>
  /* the one number the whole app is about -> key-visual treatment */
  .score {
    position: relative;
    overflow: hidden;
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
  /* fibre grain, matching the home cover */
  .score::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: var(--grain);
    background-size: 170px 170px;
    opacity: 0.4;
    mix-blend-mode: multiply;
  }
  .score > * { position: relative; }
  /* cloud-scroll capsule tucked behind the score */
  .score::after {
    content: '';
    position: absolute;
    right: -34px; top: 10px;
    width: 120px; height: 26px;
    border-radius: 999px;
    background: var(--grad-warm);
    opacity: 0.35;
  }
  .score .big { display: grid; justify-items: center; min-width: 90px; }
  .score .big strong {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 2.6rem;
    line-height: 1;
    color: var(--brand-dark);
  }
  .score .big small { color: var(--brand); font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.08em; }
  .score .rankinfo { display: grid; gap: 3px; flex: 1; position: relative; }
  .score .tag { justify-self: start; }
  .bar { height: 7px; border-radius: 999px; background: color-mix(in srgb, var(--brand) 12%, var(--bg)); overflow: hidden; margin-top: 4px; }
  .bar i { display: block; height: 100%; border-radius: 999px; background: var(--grad-brand); }

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

  /* door-eye seal: the carving and the initial share one grid cell */
  .seal {
    display: grid;
    place-items: center;
    margin-bottom: 2px;
  }
  .seal > :global(*) { grid-area: 1 / 1; }
  .seal .glyph {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.1rem;
    color: var(--brand-dark);
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
  }
  /* pressed by hand, so never quite straight */
  .stamp.got .seal { transform: rotate(-5deg); }

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
