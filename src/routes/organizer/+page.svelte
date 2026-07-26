<script>
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import destinations from '$lib/data/destinations.json';
  import tickets from '$lib/data/ticket-points.json';
  import { stats, loadCounts } from '$lib/stats.svelte.js';
  import { spotlightIds, evenness } from '$lib/score.js';
  import { distanceMeters } from '$lib/geo.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';
  import { staff, unlock } from '$lib/staff.svelte.js';

  let gate = $state('');
  let gateErr = $state(false);
  let events = $state({});
  let flagged = $state([]);

  // ponytail: read-only view of already-public counts, so no auth. Add Cloudflare
  // Access in front of /organizer if the numbers should not be public.

  const counts = $derived(stats.counts ?? {});
  const rows = $derived(
    destinations
      .map((d) => ({ d, n: counts[d.id] ?? 0 }))
      .sort((a, b) => a.n - b.n || t(a.d.name).localeCompare(t(b.d.name)))
  );
  const total = $derived(rows.reduce((sum, r) => sum + r.n, 0));
  const covered = $derived(rows.filter((r) => r.n > 0).length);
  const spread = $derived(Math.round(evenness(counts, destinations) * 100));
  const boosted = $derived(spotlightIds(counts, destinations));
  const max = $derived(Math.max(1, ...rows.map((r) => r.n)));

  const survey = destinations.filter((d) => d.needsSurvey);
  const quizTodo = destinations.filter((d) => d.quizBank.some((q) => q.generated));

  // Cold sites are worth a flyer at the nearest counter — this is that mapping.
  const nearestCounter = (d) =>
    tickets.reduce(
      (best, p) => {
        const m = distanceMeters(d, p);
        return m < best.m ? { p, m } : best;
      },
      { p: null, m: Infinity }
    );

  let busy = $state(false);
  async function refresh() {
    busy = true;
    await loadCounts(true);
    try {
      const [ev, fl] = await Promise.all([
        fetch(`${base}/api/checkin?events=1`),
        fetch(`${base}/api/passport?flagged=1`)
      ]);
      if (ev.ok) events = await ev.json();
      if (fl.ok) flagged = await fl.json();
    } catch {
      // no endpoint / offline -> keep whatever we had
    }
    busy = false;
  }
  onMount(refresh);

  function exportCsv() {
    const lines = [['code', 'id', 'name_vi', 'checkins', 'share_pct', 'boosted', 'traffic', 'promo_priority'].join(',')];
    for (const { d, n } of rows) {
      lines.push(
        [
          d.code,
          d.id,
          `"${d.name.vi.replace(/"/g, '""')}"`,
          n,
          total ? ((n / total) * 100).toFixed(1) : '0.0',
          boosted.has(d.id) ? 1 : 0,
          d.traffic,
          d.promoPriority
        ].join(',')
      );
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `hacw-checkins-${new Date().toISOString().slice(0, 10)}.csv`
    });
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="topbar"><h1>{s('org_title')}</h1><small>{s('org_sub')}</small></div>

<div class="page">
{#if !staff.on}
  <!-- Same code as the voucher confirm and the skip-GPS button; ?staff=<code> also works. -->
  <p class="muted"><small>{s('staff_only')}</small></p>
  <input class="code" inputmode="numeric" bind:value={gate} placeholder={s('enter_code')} />
  {#if gateErr}<p class="err">{s('wrong_code')}</p>{/if}
  <button class="btn" onclick={() => (gateErr = !unlock(gate))} style="width: 100%">
    {s('staff_confirm')}
  </button>
{:else}
  <div class="actions">
    <button class="btn secondary" onclick={refresh} disabled={busy}>{s('org_refresh')}</button>
    <button class="btn secondary" onclick={exportCsv}>{s('org_export')}</button>
    {#if stats.at}
      <small class="muted">{s('org_updated', new Date(stats.at).toLocaleTimeString())}</small>
    {/if}
  </div>

  {#if !total}
    <div class="banner">{s('org_no_data')}</div>
  {/if}

  <div class="kpis">
    <div class="kpi"><strong>{total}</strong><small>{s('org_total')}</small></div>
    <div class="kpi"><strong>{covered}/{destinations.length}</strong><small>{s('org_covered')}</small></div>
    <div class="kpi"><strong>{spread}%</strong><small>{s('org_evenness')}</small></div>
  </div>

  <h2>{s('org_spotlight_now')} ({boosted.size})</h2>
  <p class="muted"><small>{s('spotlight_hint', 10)}</small></p>

  <table>
    <thead>
      <tr><th>#</th><th>{s('org_sub')}</th><th class="num">n</th></tr>
    </thead>
    <tbody>
      {#each rows as { d, n }, i}
        {@const counter = nearestCounter(d)}
        <tr class:boost={boosted.has(d.id)}>
          <td class="muted">{i + 1}</td>
          <td>
            <a href="{base}/destinations/{d.id}">{t(d.name)}</a>
            {#if boosted.has(d.id)}<span title={s('org_spotlight_now')}>⭐</span>{/if}
            <div class="bar"><i style="width: {(n / max) * 100}%"></i></div>
            <small class="muted">
              {d.code} · {s('org_traffic')}: {s(`lvl_${d.traffic}`)} · {s('org_priority')}:
              {s(`lvl_${d.promoPriority}`)}
              <br />
              {s('org_nearest_ticket')}: {counter.p?.id ?? '—'} ({Math.round(counter.m)} m)
            </small>
          </td>
          <td class="num"><strong>{n}</strong></td>
        </tr>
      {/each}
    </tbody>
  </table>

  <h2>{s('org_survey')} ({survey.length})</h2>
  <p class="muted"><small>{survey.map((d) => `${d.code} ${d.name.vi}`).join(' · ') || '—'}</small></p>

  <h2>{s('org_quiz_todo')} ({quizTodo.length})</h2>
  <p class="muted"><small>{quizTodo.map((d) => d.code).join(' · ') || '—'}</small></p>

  <!-- Everything the app reports that is not a check-in: failed GPS, wrong quiz
       taps, vouchers handed over. Same queue, so it works offline too. -->
  <!-- Advisory review list. Codes are masked; nothing here refuses a voucher. -->
  <h2>{s('org_flagged')} ({flagged.length})</h2>
  <p class="muted"><small>{s('org_flagged_hint')}</small></p>
  {#if flagged.length}
    <table>
      <tbody>
        {#each flagged as f}
          <tr>
            <td><code>{f.pid}</code></td>
            <td class="num">{f.flags}</td>
            <td class="muted">{new Date(f.updated).toLocaleString()}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="muted"><small>{s('org_flagged_none')}</small></p>
  {/if}

  <h2>{s('org_events')}</h2>
  <p class="muted">
    <small>
      {Object.entries(events)
        .map(([k, v]) => `${k} ${v}`)
        .join(' · ') || '—'}
    </small>
  </p>
{/if}
</div>

<style>
  .code {
    width: 100%;
    padding: 12px 14px;
    margin-bottom: 10px;
    border: 1px solid var(--line);
    border-radius: 12px;
    font-family: var(--font-body);
    font-size: 1.1rem;
    text-align: center;
    letter-spacing: 0.2em;
  }
  .err { color: var(--brand); margin: 0 0 8px; font-size: 0.9rem; }
  .actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
  .actions .btn { width: auto; padding: 10px 14px; }

  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .kpi {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 12px;
    display: grid;
    justify-items: center;
    box-shadow: var(--shadow);
  }
  .kpi strong { font-family: var(--font-display); font-size: 1.7rem; color: var(--brand); }

  h2 { margin: 20px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .num { text-align: right; }
  tr.boost td { background: color-mix(in srgb, var(--gold) 10%, transparent); }
  .bar { height: 5px; border-radius: 3px; background: var(--bg); overflow: hidden; margin: 4px 0; }
  .bar i { display: block; height: 100%; background: var(--brand); }
</style>
