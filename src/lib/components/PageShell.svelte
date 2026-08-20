<script>
  // The one piece of chrome every content page shares: the brand-strip topbar
  // (title + optional subtitle) and the scrolling `.page` column under it.
  // Six pages hand-copied this; now the header treatment is edited in one place.
  // Styling is the global `.topbar` / `.page` in app.css — no scoped CSS here.
  // Not used by the home hero or the map (printed-plan register) — both are
  // deliberate exceptions, so they stay bare.
  let { title, sub = '', children } = $props();
</script>

<div class="topbar"><h1>{title}</h1>{#if sub}<small>{sub}</small>{/if}</div>
<div class="page">{@render children()}</div>
