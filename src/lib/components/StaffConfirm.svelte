<script>
  import { s } from '$lib/strings.js';
  import { staff, unlock } from '$lib/staff.svelte.js';
  import { passport } from '$lib/passport.svelte.js';
  import { flagPassport } from '$lib/fraud.js';
  import { redeemOpen } from '$lib/score.js';
  import destinations from '$lib/data/destinations.json';

  // Gifts are only at the counters during the festival — no early or late claims,
  // staff included. Evaluated once per mount; nobody sits on this screen across
  // the midnight that opens the window.
  const canRedeem = redeemOpen(new Date());

  // Shown to the staff member holding the phone, not to the visitor's advantage:
  // a passport whose stamps couldn't have been walked. Advisory — it never blocks
  // the confirm button, because a bad GPS fix must not cost a real visitor a voucher.
  const suspicious = $derived(flagPassport(passport.stamps, destinations).length);

  // One staff code for the whole app (see src/lib/staff.svelte.js): entering it
  // here also unlocks /organizer and the skip-GPS button on this device, and it
  // is remembered, so a staff member types it once per shift, not once per voucher.
  /** @type {{ onconfirm: () => void, label?: string }} */
  let { onconfirm, label } = $props();

  let open = $state(false);
  let code = $state('');
  let error = $state('');

  function confirm() {
    if (!staff.on && !unlock(code)) {
      error = s('wrong_code');
      return;
    }
    open = false;
    code = '';
    error = '';
    onconfirm();
  }
</script>

{#if !canRedeem}
  <p class="muted"><small>{s('redeem_closed')}</small></p>
{:else if open}
  <p class="muted"><small>{s('redeem_intro')}</small></p>
  {#if suspicious}<p class="warn">{s('flag_warn')}</p>{/if}
  {#if !staff.on}
    <input class="code" inputmode="numeric" bind:value={code} placeholder={s('enter_code')} />
  {/if}
  {#if error}<p class="err">{error}</p>{/if}
  <button class="btn" onclick={confirm} style="width: 100%">{s('staff_confirm')}</button>
{:else}
  <button class="btn" onclick={() => (open = true)} style="width: 100%">{label ?? s('redeem')}</button>
{/if}

<style>
  .err { color: var(--brand); margin: 0; font-size: 0.9rem; }
  .warn {
    margin: 0 0 8px;
    padding: 8px 10px;
    border-radius: 10px;
    background: #fdf0d5;
    color: #8a5a00;
    font-size: 0.85rem;
  }
</style>
