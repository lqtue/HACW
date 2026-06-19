<script>
  import Card from '$lib/components/Card.svelte';
  import { isSetComplete, isRedeemed, redeemSet } from '$lib/passport.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  let { data } = $props();
  const tour = data.tour;

  // ponytail: client-side code only prevents accidental taps, not fraud.
  // Real anti-fraud needs the server (Cloudflare) path. Set to '' to skip the code step.
  const CONTROLLER_CODE = '2026';

  const complete = $derived(isSetComplete(tour.stops));
  const redeemed = $derived(isRedeemed(tour.id));

  let showStaff = $state(false);
  let code = $state('');
  let error = $state('');

  function confirm() {
    if (CONTROLLER_CODE && code.trim() !== CONTROLLER_CODE) {
      error = s('wrong_code');
      return;
    }
    redeemSet(tour.id);
    showStaff = false;
  }
</script>

<div class="topbar"><h1>{t(tour.title)}</h1><small>{t(tour.theme)}</small></div>

<div class="page">
  <p>{t(tour.description)}</p>

  {#if redeemed}
    <div class="success">{s('redeemed')}</div>
  {:else if complete}
    <div class="redeem">
      <p class="done">🎉 {s('set_complete')}</p>
      {#if showStaff}
        <p class="muted"><small>{s('redeem_intro')}</small></p>
        {#if CONTROLLER_CODE}
          <input
            class="code"
            inputmode="numeric"
            bind:value={code}
            placeholder={s('enter_code')}
          />
        {/if}
        {#if error}<p class="err">{error}</p>{/if}
        <button class="btn" onclick={confirm} style="width: 100%">{s('staff_confirm')}</button>
      {:else}
        <button class="btn" onclick={() => (showStaff = true)} style="width: 100%">{s('redeem')}</button>
      {/if}
    </div>
  {/if}

  <h2>{s('route')}</h2>
  {#each data.stops as dest, i}
    <Card {dest} index={i + 1} />
  {/each}
</div>

<style>
  .redeem {
    background: color-mix(in srgb, var(--gold) 14%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--gold) 40%, var(--line));
    border-radius: var(--radius);
    padding: 14px;
    margin-bottom: 8px;
    display: grid;
    gap: 10px;
  }
  .redeem .done { margin: 0; font-weight: 600; }
  .code {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: 12px;
    font-family: var(--font-body);
    font-size: 1.1rem;
    text-align: center;
    letter-spacing: 0.2em;
  }
  .err { color: var(--brand); margin: 0; font-size: 0.9rem; }
  .success {
    background: #e6f4ea;
    border: 1px solid #a8d8b9;
    color: #1e6b34;
    border-radius: 12px;
    padding: 12px;
    font-weight: 600;
    margin-bottom: 8px;
  }
</style>
