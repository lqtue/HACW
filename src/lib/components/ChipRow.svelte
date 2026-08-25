<script>
  // One horizontal scrolling row of filter chips with ‹ › scroll affordances that only
  // show when the row can scroll that way. Used by the Explore filter bar and the plan
  // builder's free-step category filter — same chips, same scroll math, one copy.
  // Children are the chips themselves (`<button class="chip">`, add `cat` + `--c` for a
  // category swatch); the parent positions the row, this only styles the inside.
  import { onMount } from 'svelte';
  import { s } from '$lib/strings.js';

  let { children } = $props();

  let el = $state();
  let more = $state(false);
  let less = $state(false);
  function refresh() {
    if (!el) { more = less = false; return; }
    less = el.scrollLeft > 4;
    more = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
  }
  onMount(() => {
    refresh();
    // chips come and go with the parent's state (step change, booth toggle) — watch the
    // row's children so the affordances re-measure without the parent having to tell us
    const mo = new MutationObserver(refresh);
    mo.observe(el, { childList: true, subtree: true });
    addEventListener('resize', refresh);
    return () => { mo.disconnect(); removeEventListener('resize', refresh); };
  });
</script>

<div class="chiprow">
  {#if less}
    <button class="fmore fless" aria-label={s('back')} onclick={() => el?.scrollBy({ left: -160, behavior: 'smooth' })}>‹</button>
  {/if}
  <div class="row" bind:this={el} onscroll={refresh}>
    {@render children()}
  </div>
  {#if more}
    <button class="fmore" aria-label={s('scroll_more')} onclick={() => el?.scrollBy({ left: 160, behavior: 'smooth' })}>›</button>
  {/if}
</div>

<style>
  .chiprow { position: relative; }
  .row {
    display: flex; flex-wrap: nowrap; gap: 6px;
    padding: 2px 2px 4px;
    overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch;
  }
  .row::-webkit-scrollbar { display: none; }

  /* ‹ › pinned over a fade at either edge */
  .fmore {
    position: absolute; top: 0; bottom: 4px; right: 0; z-index: 2;
    width: 40px; border: 0; cursor: pointer;
    display: grid; place-items: center;
    font-size: 1.4rem; font-weight: 700; line-height: 1; color: var(--brand-dark);
    padding-right: 2px;
    background: linear-gradient(to right, transparent, var(--surface) 55%);
  }
  .fmore.fless {
    right: auto; left: 0; padding-right: 0; padding-left: 2px;
    background: linear-gradient(to left, transparent, var(--surface) 55%);
  }
  .fmore:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

  /* chips as printed labels: hairline keyline, uppercase, dot swatch. Opaque fill +
     soft shadow because both rows float over a map and must stay legible. Overrides
     the global .chip pill from app.css (these selectors out-specify it). */
  .row :global(.chip) {
    flex: 0 0 auto;
    white-space: nowrap;
    border-radius: 6px;
    border-color: color-mix(in srgb, var(--brand-dark) 20%, transparent);
    background: var(--surface);
    box-shadow: 0 2px 8px rgba(60, 30, 20, 0.14);
    padding: 7px 12px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--brand-dark);
  }
  /* pressed cat chip wears its own accent; neutral chips (all / open) have no category
     colour, so their pressed state stays on the chip's own bg with a solid keyline */
  .row :global(.chip.cat[aria-pressed='true']) {
    background: var(--c);
    border-color: var(--c);
    color: var(--paper);
  }
  .row :global(.chip[aria-pressed='true']) {
    border-color: var(--brand-dark);
    color: var(--brand-dark);
  }
  /* the legend swatch: same colour the site's mark is drawn in on the map */
  .row :global(.chip.cat) { display: inline-flex; align-items: center; gap: 7px; }
  .row :global(.chip .sw) {
    width: 10px; height: 10px;
    border-radius: 50%;
    background: var(--c);
    border: 1px solid color-mix(in srgb, var(--brand-dark) 45%, transparent);
  }
  .row :global(.chip[aria-pressed='true'] .sw) { background: var(--paper); border-color: var(--paper); }
</style>
