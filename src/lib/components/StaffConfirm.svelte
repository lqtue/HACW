<script>
  import { s } from '$lib/strings.js';
  import { staff, unlock } from '$lib/staff.svelte.js';
  import { passport } from '$lib/passport.svelte.js';
  import { flagPassport } from '$lib/fraud.js';
  import { redeemOpen } from '$lib/score.js';
  import { plan } from '$lib/plan.svelte.js';
  import { parseTicket } from '$lib/ticket.js';
  import destinations from '$lib/data/sites.js';

  // Shown to the staff member holding the phone, not to the visitor's advantage:
  // a passport whose stamps couldn't have been walked. Advisory — it never blocks
  // the confirm button, because a bad GPS fix must not cost a real visitor a voucher.
  const suspicious = $derived(flagPassport(passport.stamps, destinations).length);

  // The ticket this passport was built on, for the staff member to read against the
  // paper ticket in the visitor's hand. The app cannot verify a ticket was bought —
  // this is what lets the person at the counter do it. No ticket scanned = say so,
  // plainly; it does not block the confirm (deciding that is the counter's job).
  const ticket = $derived(parseTicket(plan.ticketCode));

  // One staff code for the whole app (see src/lib/staff.svelte.js): entering it
  // here also unlocks /organizer and the skip-GPS button on this device, and it
  // is remembered, so a staff member types it once per shift, not once per voucher.
  /** `demo` is the /screens board frame: show the panel as staff see it, ignore the
   *  festival window, and never write a redemption.
   *  `needsTicket` shows the ticket to check against the paper one. Only physical
   *  gifts are handed over against a ticket; a voucher has nothing to match, so
   *  showing an empty ticket box there is just noise at the counter.
   *  @type {{ onconfirm: () => void, demo?: boolean, needsTicket?: boolean }} */
  let { onconfirm, demo = false, needsTicket = false } = $props();

  // Gifts are only at the counters during the festival — no early or late claims,
  // staff included. Evaluated once per mount; nobody sits on this screen across the
  // midnight that opens the window. Must come AFTER $props(): reading `demo` above it
  // is a temporal-dead-zone error that takes the whole page down.
  const canRedeem = demo || redeemOpen(new Date());

  let code = $state('');
  let error = $state('');

  function confirm() {
    if (demo) return; // board preview: look, don't touch
    if (!staff.on && !unlock(code)) {
      error = s('wrong_code');
      return;
    }
    code = '';
    error = '';
    onconfirm();
  }
</script>

{#if !canRedeem}
  <p class="muted"><small>{s('redeem_closed')}</small></p>
{:else}
  {#if needsTicket}
    <div class="tk" class:none={!ticket}>
      <span class="tk-lbl">{s('tk_check')}</span>
      <b>{ticket ? `T${ticket.serial.slice(0, 2)}·${ticket.serial.slice(2)}` : s('tk_none')}</b>
      {#if ticket}<small>{s('tk_sites', ticket.size)}</small>{/if}
    </div>
  {/if}
  {#if suspicious}<p class="warn">{s('flag_warn')}</p>{/if}
  {#if !staff.on}
    <input class="code" inputmode="numeric" bind:value={code} placeholder={s('enter_code')} />
  {/if}
  {#if error}<p class="err">{error}</p>{/if}
  <button class="btn" onclick={confirm} style="width: 100%">{s('staff_confirm')}</button>
{/if}

<style>
  /* the ticket to match against the paper one — the biggest thing on this panel,
     because reading it IS the check */
  .tk {
    margin: 0 0 8px; padding: 10px 12px;
    border: 1.5px solid var(--brand-dark); border-radius: 10px;
    background: var(--surface);
    display: grid; gap: 1px; text-align: center;
  }
  .tk-lbl { color: var(--muted); font-size: var(--fs-xs); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
  .tk b {
    font-family: var(--font-display); font-weight: 800;
    font-size: var(--fs-xl); letter-spacing: 0.04em; line-height: 1.1; color: var(--ink);
  }
  .tk small { color: var(--muted); font-size: var(--fs-sm); }
  .tk.none { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 12%, var(--surface)); }
  .tk.none b { font-size: var(--fs-md); color: #8a5a00; }

  .err { color: var(--brand); margin: 0; font-size: var(--fs-sm); }
  .warn {
    margin: 0 0 8px;
    padding: 8px 10px;
    border-radius: 10px;
    background: #fdf0d5;
    color: #8a5a00;
    font-size: var(--fs-sm);
  }
</style>
