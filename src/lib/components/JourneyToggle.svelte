<script>
  import { study, setJourney } from '$lib/study.svelte.js';
  import { s } from '$lib/strings.js';
  // Opt-IN toggle for the journey (sequence) study — default off, unlike the
  // footfall opt-out. Shown on onboarding + the passport page so it's reversible.
</script>

<button class="study-toggle" aria-pressed={study.journey} onclick={() => setJourney(!study.journey)}>
  <span class="box" aria-hidden="true">{study.journey ? '✓' : ''}</span>
  <small>{s('journey_optin')}</small>
</button>

<style>
  /* mirrors StudyToggle; kept local so the two consents can diverge later */
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
