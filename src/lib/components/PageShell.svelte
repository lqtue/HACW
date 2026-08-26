<script>
  import { base } from '$app/paths';
  import { goto, afterNavigate } from '$app/navigation';
  import { s } from '$lib/strings.js';
  // The one piece of chrome every content page shares: the brand-strip topbar
  // (title + optional subtitle) and the scrolling `.page` column under it.
  // Styling is the global `.topbar` / `.page` in app.css.
  // `back` opts a page into a ← button: pass `true` to go back in history
  // (falls back to the map on a deep link), or a path string to go somewhere specific.
  // `fill`: make the page column grow to the viewport bottom, so a child with
  // flex:1 can pin its footer to the bottom edge (destination check-in screen).
  let { title, sub = '', back = null, fill = false, children } = $props();

  // `history.length > 1` also counts the tab's blank entry / an external referrer, so
  // history.back() there walks out of the app to a blank page. `nav.from` is set only
  // on in-app client navigation (null on a fresh load or deep link) — the real signal.
  let cameFromApp = false;
  afterNavigate((nav) => { cameFromApp = nav.from != null; });

  function goBack() {
    if (typeof back === 'string') goto(base + back);
    else if (cameFromApp) history.back();
    else goto(base + '/destinations');
  }
</script>

{#if title || sub || back}
  <div class="topbar" class:has-back={back}>
    {#if back}
      <button class="tb-back" onclick={goBack} aria-label={s('back')}>←</button>
    {/if}
    <h1 class="ptitle">{title}</h1>
    {#if sub}<small>{sub}</small>{/if}
  </div>
{/if}
<div class="page" class:fill>{@render children()}</div>

<style>
  .topbar.has-back { display: grid; grid-template-columns: auto 1fr; column-gap: 12px; align-items: center; }
  .topbar.has-back small { grid-column: 2; }
  .tb-back {
    grid-row: 1 / span 2; align-self: start;
    width: 40px; height: 40px; border-radius: 12px;
    display: grid; place-items: center; cursor: pointer;
    border: 1px solid var(--line); background: var(--surface); color: var(--ink);
    font-size: var(--fs-xl); line-height: 1;
  }
  .tb-back:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  /* fill the rest of the 100dvh .app column, so a flex:1 child docks its footer at the bottom */
  :global(.page).fill { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
</style>
