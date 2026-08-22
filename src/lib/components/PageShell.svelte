<script>
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { s } from '$lib/strings.js';
  // The one piece of chrome every content page shares: the brand-strip topbar
  // (title + optional subtitle) and the scrolling `.page` column under it.
  // Styling is the global `.topbar` / `.page` in app.css.
  // `back` opts a page into a ← button: pass `true` to go back in history
  // (falls back to the map on a deep link), or a path string to go somewhere specific.
  let { title, sub = '', back = null, children } = $props();

  function goBack() {
    if (typeof back === 'string') goto(base + back);
    else if (typeof history !== 'undefined' && history.length > 1) history.back();
    else goto(base + '/destinations');
  }
</script>

<div class="topbar" class:has-back={back}>
  {#if back}
    <button class="tb-back" onclick={goBack} aria-label={s('back')}>←</button>
  {/if}
  <h1>{title}</h1>
  {#if sub}<small>{sub}</small>{/if}
</div>
<div class="page">{@render children()}</div>

<style>
  .topbar.has-back { display: grid; grid-template-columns: auto 1fr; column-gap: 12px; align-items: center; }
  .topbar.has-back small { grid-column: 2; }
  .tb-back {
    grid-row: 1 / span 2; align-self: start;
    width: 40px; height: 40px; border-radius: 12px;
    display: grid; place-items: center; cursor: pointer;
    border: 1px solid var(--line); background: var(--surface); color: var(--ink);
    font-size: 1.3rem; line-height: 1;
  }
  .tb-back:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
</style>
