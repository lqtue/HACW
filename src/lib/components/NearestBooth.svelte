<script>
  import tickets from '$lib/data/ticket-points.json';
  import { getPosition, nearest } from '$lib/geo.js';
  import { formatDistance } from '$lib/route.js';
  import { mapsUrl } from '$lib/util.js';
  import { t, i18n } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  // Vouchers are paper and are handed over at a ticket counter, so "where do I go
  // now?" is the question right after a set completes. One tap, one fix, one link
  // out to the phone's own maps app.
  //
  // ponytail: no in-app turn-by-turn — straight-line pick, then hand off to Google
  // Maps walking directions, same as every destination card does.
  let found = $state(null);
  let busy = $state(false);
  let err = $state('');

  async function find() {
    busy = true;
    err = '';
    try {
      found = nearest(await getPosition(), tickets);
    } catch (e) {
      err = e?.code === 1 ? s('geo_denied') : s('geo_fail');
    } finally {
      busy = false;
    }
  }
</script>

<div class="booth">
  {#if found}
    <strong>{s('booth_nearest', found.point.id, formatDistance(found.meters, i18n.lang))}</strong>
    <small class="muted">{t(found.point.where)}</small>
    <a class="btn secondary" href={mapsUrl(found.point)} target="_blank" rel="noopener">{s('booth_dir')}</a>
  {:else}
    <small class="muted">{s('booth_hint')}</small>
    <button class="btn secondary" onclick={find} disabled={busy}>
      {busy ? s('locating_now') : s('booth_find')}
    </button>
    {#if err}<small class="err">{err}</small>{/if}
  {/if}
</div>

<style>
  .booth {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 12px;
    text-align: center;
  }
  .booth .btn { width: 100%; }
  .err { color: var(--brand); }
</style>
