<script>
  import { base } from '$app/paths';
  import { categoryLabel, categoryIcon, mapsUrl, openLabel } from '$lib/util.js';
  import { hasStamp } from '$lib/passport.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';
  import MatCua from './MatCua.svelte';

  /**
   * `mark` swaps the emoji tile for the mắt cửa, which is what the map draws as
   * this site's pin — on the map screen the card and the pin must be the same
   * object seen twice.
   * `spot` = currently suggested (quiet half of the map): brand keyline + a small star.
   * @type {{ dest: any, index?: number, active?: boolean, mark?: boolean, spot?: boolean, query?: string }}
   */
  let { dest, index, active = false, mark = false, spot = false, query = '' } = $props();

  const open = $derived(openLabel(dest));
</script>

<div class="card" class:active class:spot id="card-{dest.id}">
  {#if spot}<span class="star" aria-label={s('spotlight')} title={s('spotlight')}>★</span>{/if}
  <a
    class="thumb"
    class:mark
    href="{base}/destinations/{dest.id}{query}"
    style={mark ? '' : `background: var(--c-${dest.category})`}
  >
    {#if mark}
      <MatCua size={38} color="var(--c-{dest.category})" inner="#fdf6e8" ink="var(--brand-dark)" />
    {:else if index != null}{index}{:else}{categoryIcon(dest.category)}{/if}
  </a>
  <a class="body" href="{base}/destinations/{dest.id}{query}">
    <span class="tag" style="background: var(--c-{dest.category})">{t(categoryLabel(dest.category))}</span>
    <h3>{t(dest.name)} {#if hasStamp(dest.id)}✅{/if}</h3>
    <small>
      {#if open}<span class="open {open.status}">{open.text}</span> · {/if}{t(dest.hours)}
    </small>
    <small class="addr">{t(dest.address)}</small>
  </a>
  <a
    class="dir"
    href={mapsUrl(dest)}
    target="_blank"
    rel="noopener"
    aria-label="{t(dest.name)}"
  >➤</a>
</div>

<style>
  .dir {
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--bg);
    border: 1px solid var(--line);
    color: var(--brand);
    transform: rotate(-45deg);
  }
  .tag { margin-bottom: 4px; }
  /* the pin, at rest: paper tile, hairline keyline, no fill of its own */
  .thumb.mark {
    background: var(--paper);
    border: 1px solid var(--line);
    display: grid;
    place-items: center;
  }
  .addr { display: block; color: var(--muted); }
  .open { font-weight: 700; }
  .open.open { color: var(--teal); }
  .open.soon { color: var(--gold); }
  .open.closed { color: var(--muted); }
  /* suggested (quiet) site: brand keyline + a small star on the corner */
  .card.spot { border-color: var(--brand); position: relative; }
  .star {
    position: absolute; top: 6px; right: 8px;
    font-size: var(--fs-sm); line-height: 1; color: var(--brand);
  }
  /* selected from the map: the card the pin points at */
  .card.active {
    border-color: var(--brand);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand) 35%, transparent), var(--shadow);
  }
</style>
