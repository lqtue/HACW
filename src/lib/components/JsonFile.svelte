<script>
  import { download } from '$lib/util.js';
  import { s } from '$lib/strings.js';

  // The shell every content editor shares: clone the shipped JSON, validate on
  // every keystroke, download it when it is clean, read an edited file back in.
  //
  // ponytail: edits never leave the browser — download the JSON, commit it,
  // redeploy. A live-save path would need real auth plus a write side for content
  // that currently ships as static files; not worth it for a one-week event where
  // every content change is reviewed anyway. Upgrade path: PUT to a D1 `content`
  // table behind Cloudflare Access and read it in +layout.js with the JSON as the
  // fallback.
  /** @type {{ name: string, original: any, check: (data: any) => string[], children: import('svelte').Snippet<[any]> }} */
  let { name, original, check, children } = $props();

  let data = $state(structuredClone(original));
  let fileErr = $state('');
  // Download stays disabled while this is non-empty, so the browser can only ever
  // emit a file the repo's own `npm test` would accept.
  const problems = $derived(check(data));

  const save = () => download(name, JSON.stringify(data, null, 2) + '\n');

  async function upload(e) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = ''; // same file twice in a row must still fire onchange
    if (!file) return;
    try {
      data = JSON.parse(await file.text());
      fileErr = '';
    } catch (err) {
      fileErr = s('org_bad_file', err.message ?? String(err));
    }
  }

  function reset() {
    if (confirm(s('org_reset_confirm'))) {
      data = structuredClone(original);
      fileErr = '';
    }
  }
</script>

<div class="ed-actions">
  <button class="btn" onclick={save} disabled={problems.length > 0}>{s('org_download_json', name)}</button>
  <label class="btn secondary ed-file">
    {s('org_load_json')}
    <input type="file" accept="application/json,.json" onchange={upload} />
  </label>
  <button class="btn secondary" onclick={reset}>{s('org_reset')}</button>
</div>

{#if fileErr}<p class="ed-err">{fileErr}</p>{/if}

{#if problems.length}
  <details class="ed-problems" open>
    <summary>{s('org_problems', problems.length)}</summary>
    <ul>
      {#each problems as p}<li>{p}</li>{/each}
    </ul>
  </details>
{:else}
  <p class="ed-ok"><small>{s('org_data_ok')}</small></p>
{/if}

{@render children(data)}
