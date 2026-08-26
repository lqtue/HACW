<script>
  import { openLabel } from '$lib/util.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  /**
   * One site as a soft card row: name + open/closed, tap to unfold the one-line intro
   * (accordion — the parent owns which row is open). The right-hand `action` snippet is
   * the parent's: + / ✓ in the planner; the explore list passes none and gives `href`
   * instead, which unfolds as a "Xem chi tiết" link under the intro.
   * `spot` = currently suggested (quiet half of the map): brand keyline + small star.
   * `picked` tints the card the way the planner marks a chosen site.
   * @type {{ dest: any, open?: boolean, ontoggle?: () => void, picked?: boolean, spot?: boolean, href?: string, action?: import('svelte').Snippet }}
   */
  let { dest, open = false, ontoggle, picked = false, spot = false, href = null, action } = $props();
  const oh = $derived(openLabel(dest));
</script>

<li class="pickrow" class:picked class:open class:spot>
  <div class="row-main">
    <button class="row-tap" onclick={ontoggle} aria-expanded={open}>
      <span class="body">
        <b>{#if spot}<span class="star" aria-label={s('spotlight')} title={s('spotlight')}>★</span>{/if}{t(dest.name)}</b>
        {#if oh}<small class="meta"><em class={oh.status}>{oh.text}</em></small>{/if}
      </span>
    </button>
    {@render action?.()}
  </div>
  {#if open}
    <div class="row-detail">
      <p class="rd-desc">{dest.short ? t(dest.short) : t(dest.description)}</p>
      {#if href}<a class="rd-more" {href}>{s('see_detail')}</a>{/if}
    </div>
  {/if}
</li>

<style>
  /* one card per site. NOT `.row`: the global .dock.row modifier would then inherit
     this card's fill, radius and shadow inside the build bar. */
  .pickrow {
    flex: 0 0 auto; /* don't shrink in a scrolling flex column — rows keep height */
    border: 1px solid transparent; border-radius: 16px; overflow: hidden;
    background: var(--surface);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 6px 16px rgba(0, 0, 0, 0.05);
  }
  .pickrow.picked { background: color-mix(in srgb, var(--brand) 8%, var(--surface)); }
  .pickrow.spot { border-color: var(--brand); }
  .star { color: var(--brand); margin-right: 5px; font-size: var(--fs-sm); }
  .row-main { display: flex; align-items: center; }
  .row-tap {
    flex: 1 1 auto; min-width: 0;
    display: flex; align-items: center; gap: 12px;
    border: 0; background: none; padding: 12px 14px; cursor: pointer;
    text-align: left; text-decoration: none; color: inherit;
  }
  .row-detail { padding: 0 14px 14px; }
  .rd-desc { margin: 0; color: var(--muted); font-size: var(--fs-md); line-height: 1.5; }
  .rd-more { display: inline-block; margin-top: 10px; color: var(--brand); font-weight: 600; font-size: var(--fs-md); text-decoration: underline; text-underline-offset: 3px; }
  .body { min-width: 0; flex: 1 1 auto; display: grid; gap: 1px; }
  .body b { font-weight: 600; font-size: var(--fs-md); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .body .meta { color: var(--muted); font-size: var(--fs-sm); }
  .body em { font-style: normal; font-weight: 600; }
  .body em.open { color: var(--teal); }
  .body em.closed { color: var(--muted); }
  .body em.soon { color: var(--gold); }
</style>
