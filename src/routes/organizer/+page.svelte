<script>
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import destinations from '$lib/data/destinations.json';
  import tickets from '$lib/data/ticket-points.json';
  import { stats, loadCounts } from '$lib/stats.svelte.js';
  import { spotlightIds, evenness } from '$lib/score.js';
  import { nearest } from '$lib/geo.js';
  import { download } from '$lib/util.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';
  import { staff, unlock } from '$lib/staff.svelte.js';
  import DataEditor from '$lib/components/DataEditor.svelte';
  import TourEditor from '$lib/components/TourEditor.svelte';
  import RewardEditor from '$lib/components/RewardEditor.svelte';
  import PageShell from '$lib/components/PageShell.svelte';
  import HeatMap from '$lib/components/HeatMap.svelte';

  // One file open at a time: each editor holds its own unsaved working copy, and
  // showing four at once invites downloading one and forgetting the other three.
  let tab = $state('dest');
  const TABS = [
    ['dest', 'org_tab_dest'],
    ['tours', 'org_tab_tours'],
    ['rewards', 'org_tab_rewards']
  ];

  let gate = $state('');
  let gateErr = $state(false);

  // Re-entering the *volunteer* code here succeeds as an unlock but changes
  // nothing, so the test is `staff.admin`, not whether the code was accepted.
  function upgrade() {
    unlock(gate);
    gateErr = !staff.admin;
    if (staff.admin) gate = '';
  }
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

  // Language study (nationality proxy): `lang:<code>` = device locale, `pick:<code>`
  // = the language chosen on the welcome screen. Split out of the raw event dump
  // and shown biggest-first. Codes not in the map render as their raw ISO subtag.
  const LANG_NAMES = {
    vi: 'Tiếng Việt', en: 'English', ko: '한국어', zh: '中文',
    ja: '日本語', th: 'ไทย', fr: 'Français', de: 'Deutsch', other: '—'
  };
  const langName = (c) => LANG_NAMES[c] ?? c;
  const langRows = (prefix) =>
    Object.entries(events)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, n]) => [k.slice(prefix.length), n])
      .sort((a, b) => b[1] - a[1]);
  const localeRows = $derived(langRows('lang:'));
  const pickRows = $derived(langRows('pick:'));

  // Research heatmap: fold `cell:<geohash>[-<locale>]` events into per-cell totals plus
  // a per-locale split, so the map can be sliced by nationality. Counts only — no path.
  const cells = $derived.by(() => {
    const out = {};
    for (const [k, n] of Object.entries(events)) {
      if (!k.startsWith('cell:')) continue;
      const rest = k.slice(5);
      const dash = rest.indexOf('-');
      const gh = dash < 0 ? rest : rest.slice(0, dash);
      const loc = dash < 0 ? '' : rest.slice(dash + 1);
      (out[gh] ??= { total: 0, byLoc: {} }).total += n;
      if (loc) out[gh].byLoc[loc] = (out[gh].byLoc[loc] ?? 0) + n;
    }
    return out;
  });
  const cellLocales = $derived(
    [...new Set(Object.values(cells).flatMap((c) => Object.keys(c.byLoc)))].sort()
  );
  const hasCells = $derived(Object.keys(cells).length > 0);
  let heatLocale = $state('all');

  // Behaviour crossed by nationality: nat = { checkin: { destId: { code: n } }, ... }.
  // The headline table is check-ins per site × nationality; the funnel steps are
  // site-less (keyed '_'). Columns are the nationalities present, busiest first.
  let nat = $state({});
  const natCheckin = $derived(nat.checkin ?? {});
  const natCodes = $derived.by(() => {
    const tot = {};
    for (const per of Object.values(nat)) {
      for (const byCode of Object.values(per)) {
        for (const [c, n] of Object.entries(byCode)) tot[c] = (tot[c] ?? 0) + n;
      }
    }
    return Object.keys(tot).sort((a, b) => tot[b] - tot[a]);
  });
  const hasNat = $derived(natCodes.length > 0);
  const FUNNEL = [
    ['welcome', 'app opened'],
    ['scan', 'ticket scanned'],
    ['plan_built', 'plan built']
  ];
  const natCell = (type, id, code) => nat[type]?.[id]?.[code] ?? 0;

  // App usage: pageviews per route (ev:view:<page>) and how the plan got built
  // (ev:plan_mode:<mode> + ev:plan_auto_m). Labels are English — desk-only tool.
  const VIEW_LABELS = {
    home: 'Home', explore: 'Explore map', site: 'Site detail', tours: 'Tours list',
    tour: 'Tour detail', passport: 'Passport', organizer: 'Organizer', terms: 'Terms'
  };
  // 'site' has no view: counter of its own — the site page logs view_site:<destId>
  // (one row instead of two), so its total is the sum of those.
  // D1 free-tier budget: the endpoint counts the row-writes it spends per day into
  // ev:rows:<YYYY-MM-DD>, so this is exact and costs no extra read. Over the cap D1
  // refuses writes and the phones queue until midnight UTC — visible here first.
  const DAY_CAP = 100000;
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const writes = $derived(events[`rows:${today}`] ?? 0);
  const writePct = $derived(Math.min(100, Math.round((writes / DAY_CAP) * 100)));
  const siteViews = $derived(langRows('view_site:').reduce((a, [, n]) => a + n, 0));
  const viewRows = $derived(
    [...langRows('view:').map(([k, n]) => [VIEW_LABELS[k] ?? k, n, k]),
     ...(siteViews ? [[VIEW_LABELS.site, siteViews, 'site']] : [])].sort((a, b) => b[1] - a[1])
  );
  const hasViews = $derived(viewRows.length > 0);
  const viewPages = $derived(viewRows.map(([, , k]) => k)); // for the ×nationality table
  const PLAN_LABELS = { recommend: 'Took a suggested set', manual: 'Picked all by hand', mixed: 'Picked some + auto-filled' };
  const planRows = $derived(
    ['recommend', 'manual', 'mixed'].map((m) => [PLAN_LABELS[m], events[`plan_mode:${m}`] ?? 0, m])
  );
  const planTotal = $derived(planRows.reduce((a, [, n]) => a + n, 0));
  const mixedN = $derived(events['plan_mode:mixed'] ?? 0);
  const avgAuto = $derived(mixedN ? (events['plan_auto_m'] ?? 0) / mixedN : 0);

  let journeyN = $state(null);

  // Cold sites are worth a flyer at the nearest counter — this is that mapping.
  const nearestCounter = (d) => nearest(d, tickets);

  let busy = $state(false);
  async function refresh() {
    busy = true;
    await loadCounts(true);
    try {
      const [ev, fl, nt] = await Promise.all([
        fetch(`${base}/api/checkin?events=1`),
        fetch(`${base}/api/passport?flagged=1`),
        fetch(`${base}/api/checkin?nat=1`)
      ]);
      if (ev.ok) events = await ev.json();
      if (fl.ok) flagged = await fl.json();
      if (nt.ok) nat = await nt.json();
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
    download(`hacw-checkins-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'), 'text/csv');
  }

  // Journey study export: pull the raw opt-in sequence rows and hand the researcher
  // a CSV (sid, seq, nat, type, dest, ISO time). One-shot heavy read, on demand only.
  async function exportJourneys() {
    try {
      const r = await fetch(`${base}/api/checkin?journeys=1`);
      if (!r.ok) return;
      const { rows: jr } = await r.json();
      journeyN = jr.length;
      const lines = [['sid', 'seq', 'nat', 'type', 'dest', 'ts_iso'].join(',')];
      for (const j of jr) {
        lines.push([j.sid, j.seq, j.nat ?? '', j.t, j.dest ?? '', new Date(j.ts).toISOString()].join(','));
      }
      download(`hacw-journeys-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'), 'text/csv');
    } catch {
      // no endpoint / offline — nothing to export
    }
  }
</script>

<PageShell title={s('org_title')} sub={s('org_sub')}>
{#if !staff.on}
  <!-- Two tiers, same input: the volunteer code (also the voucher confirm / skip-GPS
       code) gets this dashboard read-only, the organizer code adds the editor.
       ?staff=<code> also works. -->
  <p class="muted"><small>{s('staff_only')}</small></p>
  <input class="code" bind:value={gate} placeholder={s('enter_code')} />
  {#if gateErr}<p class="err">{s('wrong_code')}</p>{/if}
  <button class="btn" onclick={() => (gateErr = !unlock(gate))} style="width: 100%">
    {s('staff_confirm')}
  </button>
{:else}
  <!-- Numbers stay a readable column even on a wide screen; only the editors below
       actually want 1600px. -->
  <section class="dash">
  <div class="actions">
    <button class="btn secondary" onclick={refresh} disabled={busy}>{s('org_refresh')}</button>
    <button class="btn secondary" onclick={exportCsv}>{s('org_export')}</button>
    {#if stats.at}
      <small class="muted">{s('org_updated', new Date(stats.at).toLocaleTimeString())}</small>
    {/if}
    <small class="muted">{staff.admin ? s('org_tier_admin') : s('org_tier_volunteer')}</small>
  </div>

  {#if !total}
    <div class="banner">{s('org_no_data')}</div>
  {/if}

  <div class="kpis">
    <div class="kpi"><strong>{total}</strong><small>{s('org_total')}</small></div>
    <div class="kpi"><strong>{covered}/{destinations.length}</strong><small>{s('org_covered')}</small></div>
    <div class="kpi"><strong>{spread}%</strong><small>{s('org_evenness')}</small></div>
  </div>

  <!-- Write budget. Amber at 70%, red at 90%: past 100% D1 rejects writes and the
       day's remaining behaviour data waits on the phones until the quota resets. -->
  {#if writes}
    <div class="quota" class:warn={writePct >= 70} class:over={writePct >= 90}>
      <div class="qbar"><span style="width:{writePct}%"></span></div>
      <small>{s('org_quota', writes.toLocaleString(), writePct)}</small>
    </div>
  {/if}

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
              {s('org_nearest_ticket')}: {counter?.point.id ?? '—'} ({Math.round(counter?.meters ?? 0)} m)
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

  <h2>{s('org_lang')}</h2>
  <p class="muted"><small>{s('org_lang_hint')}</small></p>
  <div class="langgrid">
    <div>
      <p class="fieldlabel">{s('org_lang_device')}</p>
      {#if localeRows.length}
        <ul class="langlist">
          {#each localeRows as [code, n] (code)}
            <li><span>{langName(code)} <small class="muted">{code}</small></span> <b>{n}</b></li>
          {/each}
        </ul>
      {:else}<p class="muted"><small>—</small></p>{/if}
    </div>
    <div>
      <p class="fieldlabel">{s('org_lang_pick')}</p>
      {#if pickRows.length}
        <ul class="langlist">
          {#each pickRows as [code, n] (code)}
            <li><span>{langName(code)} <small class="muted">{code}</small></span> <b>{n}</b></li>
          {/each}
        </ul>
      {:else}<p class="muted"><small>—</small></p>{/if}
    </div>
  </div>

  <h2>{s('org_nat')}</h2>
  <p class="muted"><small>{s('org_nat_hint')}</small></p>
  {#if hasNat}
    <div class="nattable">
      <table>
        <thead>
          <tr>
            <th>{s('org_nat_metric')}</th>
            {#each natCodes as code (code)}<th class="num">{langName(code)}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each FUNNEL as [type, label] (type)}
            <tr class="funnel">
              <td>{label}</td>
              {#each natCodes as code (code)}<td class="num">{natCell(type, '_', code) || ''}</td>{/each}
            </tr>
          {/each}
          {#each rows as { d } (d.id)}
            <tr>
              <td><a href="{base}/destinations/{d.id}">{t(d.name)}</a></td>
              {#each natCodes as code (code)}<td class="num">{natCell('checkin', d.id, code) || ''}</td>{/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="muted"><small>{s('org_no_data')}</small></p>
  {/if}

  <!-- App usage: pageviews + how the plan gets built. Desk-only, English labels. -->
  <h2>App usage</h2>
  {#if hasViews}
    <div class="nattable">
      <table>
        <thead>
          <tr>
            <th>Page</th>
            <th class="num">Views</th>
            {#each natCodes as code (code)}<th class="num">{langName(code)}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each viewRows as [label, n, key] (key)}
            <tr>
              <td>{label}</td>
              <td class="num">{n}</td>
              {#each natCodes as code (code)}<td class="num">{natCell('view', key, code) || ''}</td>{/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="muted"><small>No pageviews recorded yet.</small></p>
  {/if}

  <h3>Plan picking</h3>
  {#if planTotal}
    <div class="nattable">
      <table>
        <thead>
          <tr>
            <th>How the plan was built</th>
            <th class="num">Plans</th>
            {#each natCodes as code (code)}<th class="num">{langName(code)}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each planRows as [label, n, mode] (mode)}
            <tr>
              <td>{label}</td>
              <td class="num">{n || ''}</td>
              {#each natCodes as code (code)}<td class="num">{natCell('plan_mode', mode, code) || ''}</td>{/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="muted"><small>Of the partial builds, the app filled {avgAuto.toFixed(1)} of 5 slots on average.</small></p>
  {:else}
    <p class="muted"><small>No plans built yet.</small></p>
  {/if}

  <h2>{s('org_journeys')}</h2>
  <p class="muted"><small>{s('org_journeys_hint')}</small></p>
  <div class="actions">
    <button class="btn secondary" onclick={exportJourneys}>{s('org_journeys_export')}</button>
    {#if journeyN != null}<small class="muted">{s('org_journeys_count', journeyN)}</small>{/if}
  </div>

  {#if hasCells}
    <h2>{s('org_heat')}</h2>
    <p class="muted"><small>{s('org_heat_hint')}</small></p>
    <label class="heatfilter">
      {s('org_heat_filter')}
      <select bind:value={heatLocale}>
        <option value="all">{s('all')}</option>
        {#each cellLocales as loc}
          <option value={loc}>{langName(loc)} ({loc})</option>
        {/each}
      </select>
    </label>
    <HeatMap {cells} locale={heatLocale} />
  {/if}

  <h2>{s('org_events')}</h2>
  <p class="muted">
    <small>
      {Object.entries(events)
        .filter(([k]) => !k.startsWith('lang:') && !k.startsWith('pick:') && !k.startsWith('cell:'))
        .map(([k, v]) => `${k} ${v}`)
        .join(' · ') || '—'}
    </small>
  </p>
  </section>

  <!-- Volunteers see everything above (numbers, to-do lists) but not this. -->
  {#if staff.admin}
    <h2>{s('org_edit')}</h2>
    <p class="muted"><small>{s('org_edit_hint')}</small></p>

    <div class="ed-tabs">
      {#each TABS as [id, key]}
        <button aria-pressed={tab === id} onclick={() => (tab = id)}>{s(key)}</button>
      {/each}
    </div>

    <!-- Keyed so switching tabs tears the old editor down rather than leaving a
         stale working copy mounted behind an {#if}. -->
    {#if tab === 'dest'}
      <DataEditor />
    {:else if tab === 'tours'}
      <TourEditor />
    {:else}
      <RewardEditor />
    {/if}
  {:else}
    <!-- A volunteer gets the numbers but not the editor. Without this block the
         section simply isn't there, which reads as "editing is broken" — and the
         code box above is gone once any code has been accepted, so there was no
         way up to the organizer tier except by hand-editing the URL. -->
    <section class="dash">
      <h2>{s('org_edit')}</h2>
      <p class="muted"><small>{s('org_need_admin')}</small></p>
      <input class="code" bind:value={gate} placeholder={s('enter_code')} />
      {#if gateErr}<p class="err">{s('wrong_code')}</p>{/if}
      <button class="btn secondary" onclick={upgrade}>{s('staff_confirm')}</button>
    </section>
  {/if}
{/if}
</PageShell>

<style>
  .quota { margin: 10px 0 4px; }
  .quota .qbar { height: 6px; border-radius: 999px; background: var(--line); overflow: hidden; }
  .quota .qbar span { display: block; height: 100%; background: var(--teal); }
  .quota.warn .qbar span { background: var(--gold); }
  .quota.over .qbar span { background: var(--brand); }
  .quota small { color: var(--muted); }
  .quota.over small { color: var(--brand-dark); font-weight: 600; }

  .langgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 8px; }
  .langlist { list-style: none; margin: 0; padding: 0; }
  .langlist li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 5px 0;
    border-bottom: 1px solid var(--line);
    font-size: var(--fs-sm);
  }
  .langlist b { font-variant-numeric: tabular-nums; }

  .heatfilter { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: var(--fs-sm); }
  .heatfilter select {
    font-family: var(--font-body);
    padding: 6px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    color: var(--ink);
  }

  .code { margin-bottom: 10px; }
  .err { color: var(--brand); margin: 0 0 8px; font-size: var(--fs-sm); }
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
  .kpi strong { font-family: var(--font-display); font-weight: 800; font-size: var(--fs-2xl); color: var(--brand-dark); }
  .kpi small { color: var(--muted); }

  h2 { margin: 20px 0 6px; }
  .dash { max-width: 900px; }
  table { width: 100%; border-collapse: collapse; }
  /* nationality matrix can be wider than the column — scroll it, never the page */
  .nattable { overflow-x: auto; }
  .nattable table { min-width: max-content; }
  .nattable th, .nattable td { padding: 6px 10px; white-space: nowrap; text-align: left; border-bottom: 1px solid var(--line); }
  .nattable th.num, .nattable td.num { text-align: right; }
  .nattable tr.funnel { color: var(--muted); font-size: 0.9em; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .num { text-align: right; }
  tr.boost td { background: color-mix(in srgb, var(--gold) 10%, transparent); }
  .bar { height: 5px; border-radius: 999px; background: var(--bg); overflow: hidden; margin: 4px 0; }
  .bar i { display: block; height: 100%; border-radius: 999px; background: var(--grad-brand); }
</style>
