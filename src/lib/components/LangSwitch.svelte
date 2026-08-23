<script>
  import { LANGS, displayFor } from '$lib/languages.js';
  import { i18n, setLang } from '$lib/i18n.svelte.js';
  // Change display language after onboarding. vi/en switch the built-in content; the
  // rest set the English base and rely on the browser's Translate. Does NOT re-record
  // the nationality signal — that's an onboarding-only capture.
  const isActive = (l) => i18n.lang === displayFor(l);
</script>

<div class="langswitch" role="group" aria-label="Language">
  {#each LANGS as l (l.code)}
    <button class="ls-chip" class:on={isActive(l)} onclick={() => setLang(displayFor(l))}>
      {l.name}
    </button>
  {/each}
</div>

<style>
  .langswitch { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 16px 16px; }
  .ls-chip {
    border: 1.5px solid var(--line);
    background: var(--surface);
    color: var(--muted);
    border-radius: 999px;
    padding: 8px 14px;
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: border-color 0.14s, color 0.14s, background 0.14s;
  }
  .ls-chip:hover { border-color: color-mix(in srgb, var(--brand) 45%, var(--line)); }
  .ls-chip:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .ls-chip.on {
    color: var(--ink);
    border-color: var(--brand);
    background: color-mix(in srgb, var(--brand) 12%, transparent);
  }
</style>
