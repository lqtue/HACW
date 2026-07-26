<script>
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import destinations from '$lib/data/destinations.json';
  import tours from '$lib/data/tours.json';
  import rewards from '$lib/data/rewards.json';
  import StaffConfirm from '$lib/components/StaffConfirm.svelte';
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
  import { totalPoints, tierFor, nextTier } from '$lib/score.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  const total = destinations.length;
  const count = $derived(passport.stamps.length);
  const points = $derived(totalPoints(passport.stamps, tours, total));
  const rank = $derived(tierFor(count, rewards));
  const next = $derived(nextTier(count, rewards));

  function setProgress(stops) {
    return stops.filter((id) => hasStamp(id)).length;
  }

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
    <div class="big"><strong>{points}</strong><small>{s('points')}</small></div>
    <div class="rankinfo">
      <span class="tag" style="background: var(--teal)">{s('rank')}</span>
      <strong>{rank ? `${rank.icon} ${t(rank.title)}` : s('no_rank')}</strong>
      {#if next}
        <small class="muted">{s('next_rank', next.stamps - count, t(next.title))}</small>
        <div class="bar"><i style="width: {Math.round((count / next.stamps) * 100)}%"></i></div>
      {/if}
    </div>
  </div>

  <!-- 25 stamps: the point of the page, so it goes first and stays compact -->
  <div class="grid">
    {#each destinations as d}
      {@const got = hasStamp(d.id)}
      <a class="stamp" class:got href="{base}/destinations/{d.id}" style="--cat: var(--c-{d.category})">
        <div class="seal">
          {#if got}<span>{t(d.name).charAt(0)}</span>{:else}<span class="lock">?</span>{/if}
        </div>
        <small class="name">{t(d.name)}</small>
      </a>
    {/each}
  </div>

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
  </details>

  <!-- themed sets -> voucher redemption -->
  <details>
    <summary>
      {s('tours')} · {tours.filter((x) => isSetComplete(x.stops)).length}/{tours.length}
    </summary>
    <div class="sets">
    {#each tours as tour}
      <a class="set" class:complete={isSetComplete(tour.stops)} href="{base}/tours/{tour.id}">
        <span class="ico">{isRedeemed(tour.id) ? '✅' : isSetComplete(tour.stops) ? '🎁' : '🚶'}</span>
        <span class="info">
          <strong>{t(tour.title)}</strong>
          <small class="muted">{setProgress(tour.stops)}/{tour.stops.length}</small>
        </span>
      </a>
    {/each}
    </div>
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

  /* 25 sites at 4 across ≈ one screen — was 2 across and three screens long */
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; }
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
