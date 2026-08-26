<script>
  import { research, setResearch } from '$lib/research.svelte.js';
  import { s } from '$lib/strings.js';
  // The study opt-out toggle. Used in onboarding (scan step) and on the passport
  // page so consent is always visible + reversible, never buried behind a located map.
  // `sub`: render as the dock's underlined .sub link (✓/○ prefix) instead of the boxed row
  let { label = s('research_optin'), sub = false } = $props();
</script>

{#if sub}
  <button class="sub" aria-pressed={research.on} onclick={() => setResearch(!research.on)}>
    <span class="box sm" aria-hidden="true">{research.on ? '✓' : ''}</span>{label}
  </button>
{:else}
<button class="study-toggle" aria-pressed={research.on} onclick={() => setResearch(!research.on)}>
  <span class="box" aria-hidden="true">{research.on ? '✓' : ''}</span>
  <small>{label}</small>
</button>
{/if}

<style>
  .study-toggle {
    display: flex; align-items: center; gap: 10px; width: 100%;
    padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px;
    background: var(--surface); color: var(--muted); cursor: pointer;
    font-family: var(--font-body); text-align: left;
  }
  .study-toggle:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .box {
    flex: none; width: 22px; height: 22px; border-radius: 6px;
    border: 1.8px solid var(--line-strong, var(--line)); display: grid; place-items: center;
    color: #fff; font-size: 0.82rem; font-weight: 700;
  }
  .study-toggle[aria-pressed='true'] .box { background: var(--teal); border-color: var(--teal); }
  /* sub variant: plain outlined box, tick in the text's own ink — no fill */
  .box.sm { width: 18px; height: 18px; border-radius: 5px; margin-right: 8px; font-size: 0.7rem; color: currentColor; border-color: currentColor; }
  .study-toggle small { font-size: 0.82rem; line-height: 1.35; }
  .sub { text-decoration: none; }
</style>
