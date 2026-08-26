<script>
  // The gift counter, as its own screen. Claiming used to sit inside a fold on the
  // passport, which is fiddly to work at a desk with a queue — here the gift, the
  // ticket and the confirm are the whole page. Same skeleton as the onboarding
  // screens (.screen > .mid > .dock): title top, the gift centred, the action docked.
  //
  // ?demo=none|needticket|ready|done|taken are the /screens board frames — each
  // renders one state whatever this device has scored, and none of them writes.
  import { base } from '$app/paths';
  import { onMount, onDestroy } from 'svelte';
  import rewards from '$lib/data/rewards.json';
  import tours from '$lib/data/tours.json';
  import destinations from '$lib/data/sites.js';
  import StaffConfirm from '$lib/components/StaffConfirm.svelte';
  import TicketScan from '$lib/components/TicketScan.svelte';
  import { passport, isRedeemed, redeemSet, restoreFromTicket } from '$lib/passport.svelte.js';
  import { plan, setTicketCode } from '$lib/plan.svelte.js';
  import { parseTicket } from '$lib/ticket.js';
  import { breakdown } from '$lib/score.js';
  import { ui } from '$lib/ui.svelte.js';
  import { t } from '$lib/i18n.svelte.js';
  import { s } from '$lib/strings.js';

  const demo =
    (typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo')) || '';

  const score = $derived(breakdown(passport.stamps, tours, destinations.length));
  const hasTicket = $derived(!!parseTicket(plan.ticketCode));
  // one gift per passport: the best tier reached, unless one was already taken
  const claimed = $derived(rewards.find((r) => isRedeemed(r.id)) ?? null);
  const earned = $derived(rewards.filter((r) => score.total >= r.points).at(-1) ?? null);
  const next = $derived(
    [...rewards].filter((r) => r.points > score.total).sort((a, b) => a.points - b.points)[0]
  );

  let done = $state(false);
  let ticketScan = $state(); // bound child — the dock drives its start()
  const scanSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  // what this screen is showing: the real state, or the one a board frame asks for
  const view = $derived(
    demo === 'none' ? 'none'
      : demo === 'needticket' ? 'blocked'
      : demo === 'taken' || done || (claimed && !demo) ? 'taken'
      : demo ? 'ready'
      : !earned ? 'none'
      : earned.needsTicket && !hasTicket ? 'blocked'
      : 'ready'
  );
  // the board frames pick the tier that shows the state they demonstrate
  const gift = $derived(
    demo === 'needticket' ? rewards.find((r) => r.needsTicket)
      : demo ? rewards[0]
      : claimed ?? earned
  );

  // its own screen with its own way back — the tab bar would only be in the way
  onMount(() => (ui.hideNav = true));
  onDestroy(() => (ui.hideNav = false));

  async function onScanned(raw) {
    setTicketCode(raw); // the ticket is readable even if the backup fetch fails
    try {
      await restoreFromTicket(raw);
    } catch {
      // offline / no backup under this ticket — the gift is still unblocked
    }
  }
</script>

<section class="screen">
  <h1 class="ptitle">{s('redeem_title')}</h1>

  <div class="mid">
    {#if view === 'taken'}
      <!-- one screen for both "just collected" and "collected earlier": the gift is
           gone either way, and the visitor only needs to see which one it was -->
      <p class="big ok">{s('reward_taken')}</p>
      <p class="gift">{t(gift.reward)}</p>
    {:else if view === 'none'}
      <p class="gift">{s('redeem_none')}</p>
      {#if next}<p class="note">{s('pts_more', next.points - score.total)}</p>{/if}
    {:else if view === 'blocked'}
      <!-- Physical gifts are for ticket holders (rewards.json: needsTicket); vouchers
           never reach here. Same screen as onboarding's scan step: the viewfinder is
           the middle, buy/scan are the dock. -->
      <p class="gift">{t(gift.reward)}</p>
      <p class="note">{s('gift_ticket_hint')}</p>
      <TicketScan bind:this={ticketScan} onsaved={onScanned} hero bare />
    {:else}
      <p class="gift">{t(gift.reward)}</p>
      <p class="note">{s('redeem_intro')}</p>
      <p class="foot">{s('one_gift_note')}</p>
    {/if}
  </div>

  <div class="dock">
    {#if view === 'blocked'}
      <a class="btn ghost" href="{base}/destinations?tickets=1">{s('buy_ticket')}</a>
      {#if scanSupported}
        <button class="btn" onclick={() => ticketScan?.start()}>{s('scan_btn')}</button>
      {/if}
    {:else if view === 'ready'}
      <StaffConfirm
        needsTicket={!!gift.needsTicket}
        demo={!!demo}
        onconfirm={() => { redeemSet(gift.id); done = true; }}
      />
    {/if}
    <a class="sub" href="{base}/passport">{s('back')}</a>
  </div>
</section>

<style>
  .gift {
    margin: 0; text-align: center;
    font-family: var(--font-display); font-weight: 800;
    font-size: var(--fs-lg); line-height: 1.25; color: var(--ink);
  }
  .foot { margin: 0 auto; max-width: 32ch; text-align: center; font-size: var(--fs-sm); line-height: 1.5; color: var(--muted); }
  .big.ok { margin: 0; text-align: center; font-size: var(--fs-lg); font-weight: 700; color: var(--teal); }
  /* same body copy as the onboarding screens' .lead */
  .note { margin: 0 auto; max-width: 32ch; text-align: center; color: var(--ink); font-size: var(--fs-md); line-height: 1.5; }
  /* The four states have very different footers — a staff confirm panel is far taller
     than a lone back link — so a centred middle would sit at a different height on each.
     Anchor the text a fixed distance under the title instead: the title is at the same
     y on every state, so the text is too. */
  .mid {
    justify-content: flex-start;
    padding-top: clamp(28px, 11vh, 96px);
    gap: 10px;
    overflow-y: auto;
  }
</style>
