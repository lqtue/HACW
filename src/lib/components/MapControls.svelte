<script>
  import { s } from '$lib/strings.js';
  // Map controls: round surface FABs (same as the tour-nav locate button), top-right stack.
  // Locate + (when the map is twisted off north) reset-north. Shared by the discover
  // and builder maps so the two look identical. Parent must be position: relative.
  // `top` shifts the stack down — the full-screen discover map passes a value that
  // clears the fixed theme toggle in the layout (which also lives top-right).
  // `bottom` (when set) anchors the stack to the bottom-right instead of top — the
  // explore map wants the locate FAB just above the floating nav, tour-nav style.
  let { located = false, locating = false, rotated = false, top = '10px', bottom = null, onlocate, onnorth } = $props();
</script>

<div class="mapctrls" class:up={bottom} style={bottom ? `bottom: ${bottom}` : `top: ${top}`}>
  <button
    class="mbtn"
    class:on={located}
    class:busy={locating}
    aria-pressed={located}
    aria-label={s('locate_me')}
    title={s('locate_me')}
    onclick={onlocate}
  >
    <!-- locate reticle -->
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <line x1="12" y1="2" x2="12" y2="5" stroke-linecap="round" />
      <line x1="12" y1="19" x2="12" y2="22" stroke-linecap="round" />
      <line x1="2" y1="12" x2="5" y2="12" stroke-linecap="round" />
      <line x1="19" y1="12" x2="22" y2="12" stroke-linecap="round" />
    </svg>
  </button>
  {#if rotated}
    <button class="mbtn" aria-label={s('reset_north')} title={s('reset_north')} onclick={onnorth}>
      <!-- compass needle: coral north, faint south -->
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M12 3 15 12 12 10.6 9 12Z" fill="var(--brand)" />
        <path d="M12 21 9 12 12 13.4 15 12Z" fill="currentColor" opacity="0.4" />
      </svg>
    </button>
  {/if}
</div>

<style>
  .mapctrls {
    position: absolute; right: 10px; z-index: 5;
    display: flex; flex-direction: column; gap: 10px;
  }
  /* bottom-anchored: stack upward so the locate FAB stays at the very bottom, with
     the same clear gap between the two round FABs as the tour-nav screen */
  .mapctrls.up { flex-direction: column-reverse; gap: 14px; }
  /* same round FAB as the tour-nav locate button, so all three maps share one control */
  .mbtn {
    width: 46px; height: 46px; border-radius: 50%; border: 0;
    display: grid; place-items: center; cursor: pointer;
    background: var(--surface); color: var(--muted);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  .mbtn.on { color: var(--brand); }
  .mbtn.busy { animation: mpulse 1s ease-in-out infinite; }
  .mbtn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  @keyframes mpulse { 50% { opacity: 0.5; } }
  @media (prefers-reduced-motion: reduce) { .mbtn.busy { animation: none; } }
</style>
