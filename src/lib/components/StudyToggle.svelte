<script>
  import { research, setResearch } from '$lib/research.svelte.js';
  import { s } from '$lib/strings.js';
  // The study opt-out toggle. Used in onboarding (scan step) and on the passport
  // page so consent is always visible + reversible, never buried behind a located map.
</script>

<button class="study-toggle" aria-pressed={research.on} onclick={() => setResearch(!research.on)}>
  <span class="box" aria-hidden="true">{research.on ? '✓' : ''}</span>
  <small>{s('research_optin')}</small>
</button>

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
  .study-toggle small { font-size: 0.82rem; line-height: 1.35; }
</style>
