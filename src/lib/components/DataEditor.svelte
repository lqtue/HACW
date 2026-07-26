<script>
  import destinations from '$lib/data/destinations.json';
  import categories from '$lib/data/categories.json';
  import { checkDestinations } from '$lib/editor.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  // ponytail: edits live in this component and nowhere else — download the JSON,
  // commit it, redeploy. A live-edit path would need real auth plus a write side
  // for content that currently ships as static files; not worth it for a one-week
  // event where every content change is reviewed anyway. Upgrade path: PUT the
  // array to a D1 `content` table behind Cloudflare Access and read it in
  // +layout.js with the JSON as the fallback.
  const catIds = categories.map((c) => c.id);

  let list = $state(structuredClone(destinations));
  let fileErr = $state('');
  const problems = $derived(checkDestinations(list, catIds));

  const blank = () => ({
    difficulty: 'easy',
    question: { vi: '', en: '' },
    options: [
      { vi: '', en: '' },
      { vi: '', en: '' }
    ],
    answer: 0
  });

  function download() {
    const json = JSON.stringify(list, null, 2) + '\n';
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'destinations.json' });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function upload(e) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const next = JSON.parse(await file.text());
      if (!Array.isArray(next)) throw new Error('not an array');
      list = next;
      fileErr = '';
    } catch (err) {
      fileErr = s('org_bad_file', err.message ?? String(err));
    }
  }

  function reset() {
    if (confirm(s('org_reset_confirm'))) {
      list = structuredClone(destinations);
      fileErr = '';
    }
  }
</script>

<h2>{s('org_edit')}</h2>
<p class="muted"><small>{s('org_edit_hint')}</small></p>

<div class="actions">
  <button class="btn" onclick={download} disabled={problems.length > 0}>{s('org_download_json')}</button>
  <label class="btn secondary file">
    {s('org_load_json')}
    <input type="file" accept="application/json,.json" onchange={upload} />
  </label>
  <button class="btn secondary" onclick={reset}>{s('org_reset')}</button>
</div>

{#if fileErr}<p class="err">{fileErr}</p>{/if}

{#if problems.length}
  <details class="problems" open>
    <summary>{s('org_problems', problems.length)}</summary>
    <ul>
      {#each problems as p}<li>{p}</li>{/each}
    </ul>
  </details>
{:else}
  <p class="ok"><small>{s('org_data_ok')}</small></p>
{/if}

{#each list as d (d.id)}
  <details class="dest">
    <summary>
      <strong>{d.code}</strong>
      {d.name.vi}
      <small class="muted">· {d.quizBank.length} q</small>
      {#if d.needsSurvey}<small class="tag">{s('org_needs_survey')}</small>{/if}
      {#if d.quizBank.some((q) => q.generated)}<small class="tag">{s('org_generated')}</small>{/if}
    </summary>

    {#each [['name', 'f_name'], ['address', 'f_address'], ['hours', 'f_hours'], ['description', 'f_desc']] as [field, label]}
      <label class="row">
        <span>{s(label)} <em>vi</em></span>
        <textarea rows={field === 'description' ? 4 : 1} bind:value={d[field].vi}></textarea>
      </label>
      <label class="row">
        <span>{s(label)} <em>en</em></span>
        <textarea rows={field === 'description' ? 4 : 1} bind:value={d[field].en}></textarea>
      </label>
    {/each}

    <div class="grid">
      <label class="row">
        <span>{s('f_category')}</span>
        <select bind:value={d.category}>
          {#each categories as c}<option value={c.id}>{t(c.label)}</option>{/each}
        </select>
      </label>
      <label class="row"><span>lat</span><input type="number" step="0.0000001" bind:value={d.lat} /></label>
      <label class="row"><span>lng</span><input type="number" step="0.0000001" bind:value={d.lng} /></label>
      <label class="row"><span>{s('f_radius')}</span><input type="number" step="5" bind:value={d.radius} /></label>
      <label class="row">
        <span>{s('org_traffic')}</span>
        <select bind:value={d.traffic}>
          {#each ['low', 'medium', 'high'] as v}<option value={v}>{s(`lvl_${v}`)}</option>{/each}
        </select>
      </label>
      <label class="row">
        <span>{s('org_priority')}</span>
        <select bind:value={d.promoPriority}>
          {#each ['low', 'medium', 'high'] as v}<option value={v}>{s(`lvl_${v}`)}</option>{/each}
        </select>
      </label>
      <label class="row check">
        <input type="checkbox" bind:checked={d.needsSurvey} />
        <span>{s('org_needs_survey')}</span>
      </label>
    </div>

    {#each d.quizBank as q, qi}
      <fieldset>
        <legend>
          {s('f_question')} {qi + 1}
          {#if q.generated}
            <small class="tag">{s('org_generated')}</small>
            <!-- The flag is what /organizer lists as to-do, so clearing it is the "done" button. -->
            <button class="mini" onclick={() => delete d.quizBank[qi].generated}>{s('org_reviewed')}</button>
          {/if}
          <button class="mini danger" onclick={() => d.quizBank.splice(qi, 1)}>{s('org_del_q')}</button>
        </legend>

        <label class="row">
          <span>{s('f_difficulty')}</span>
          <select bind:value={q.difficulty}>
            {#each ['easy', 'hard'] as v}<option value={v}>{s(`lvl_${v}`)}</option>{/each}
          </select>
        </label>
        <label class="row"><span>vi</span><textarea rows="2" bind:value={q.question.vi}></textarea></label>
        <label class="row"><span>en</span><textarea rows="2" bind:value={q.question.en}></textarea></label>

        <p class="muted"><small>{s('org_answer')} ◉</small></p>
        {#each q.options as o, oi}
          <div class="opt">
            <input type="radio" name="{d.id}-{qi}" value={oi} bind:group={q.answer} />
            <input bind:value={o.vi} placeholder="vi" />
            <input bind:value={o.en} placeholder="en" />
            <button
              class="mini danger"
              disabled={q.options.length <= 2}
              onclick={() => {
                q.options.splice(oi, 1);
                if (q.answer >= q.options.length) q.answer = 0;
              }}
            >
              {s('org_del_opt')}
            </button>
          </div>
        {/each}
        <button class="mini" onclick={() => q.options.push({ vi: '', en: '' })}>{s('org_add_opt')}</button>
      </fieldset>
    {/each}

    <button class="btn secondary" onclick={() => d.quizBank.push(blank())}>{s('org_add_q')}</button>
  </details>
{/each}

<style>
  .actions { display: flex; gap: 10px; flex-wrap: wrap; margin: 10px 0; }
  .actions .btn { width: auto; padding: 10px 14px; }
  .file { position: relative; overflow: hidden; display: inline-flex; align-items: center; cursor: pointer; }
  .file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .err { color: var(--brand); font-size: 0.9rem; }
  .ok { color: var(--brand); }

  .problems { border: 1px solid var(--brand); border-radius: var(--radius); padding: 10px; margin-bottom: 10px; }
  .problems ul { margin: 8px 0 0; padding-left: 18px; font-size: 0.85rem; }

  .dest {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    padding: 10px 12px;
    margin-bottom: 8px;
  }
  .dest summary { cursor: pointer; }
  .tag {
    background: color-mix(in srgb, var(--gold) 25%, transparent);
    border-radius: 999px;
    padding: 1px 8px;
    margin-left: 6px;
  }

  .row { display: grid; grid-template-columns: 130px 1fr; gap: 8px; align-items: start; margin: 6px 0; }
  .row span { font-size: 0.85rem; padding-top: 8px; }
  .row em { color: var(--brand); font-style: normal; }
  .row.check { grid-template-columns: auto 1fr; align-items: center; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0 16px; }

  input, textarea, select {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
    font-family: var(--font-body);
    font-size: 0.9rem;
    background: var(--bg);
  }
  textarea { resize: vertical; }

  fieldset { border: 1px solid var(--line); border-radius: var(--radius); margin: 12px 0; padding: 8px 10px; }
  legend { font-size: 0.85rem; padding: 0 6px; }
  .opt { display: grid; grid-template-columns: auto 1fr 1fr auto; gap: 6px; align-items: center; margin: 4px 0; }
  .opt input[type='radio'] { width: auto; }

  .mini {
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 8px;
    padding: 3px 8px;
    font-size: 0.8rem;
    font-family: var(--font-body);
    cursor: pointer;
  }
  .mini.danger { color: var(--brand); }
  .mini:disabled { opacity: 0.4; cursor: default; }
</style>
