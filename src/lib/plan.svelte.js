import { browser } from '$app/environment';
import { ticketSize } from './ticket.js';

// The visitor's active ticket: how far through onboarding they are, the ticket
// code they scanned, and the 5 sites they chose (their route). Reactive $state
// mirrored to localStorage — same pattern as staff.svelte.js / weather.svelte.js.
// The chosen set drives passport progress (X/5) and voucher redemption.
const KEY = 'hacw_plan_v1';
const EMPTY = { onboarded: false, ticketCode: '', set: [], size: 5 };

function load() {
  if (!browser) return { ...EMPTY };
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...EMPTY };
  }
}

export const plan = $state(load());

function save() {
  if (browser) localStorage.setItem(KEY, JSON.stringify(plan));
}

export function setOnboarded(v = true) {
  plan.onboarded = v;
  save();
}

/**
 * Remember the scanned ticket and how many sites it admits. The printed code says
 * which type it is (T14 = 5 sites, T15 = 3) — see parseTicket; an unreadable code
 * falls back to 5, the common ticket.
 */
export function setTicketCode(code) {
  plan.ticketCode = code;
  plan.size = ticketSize(code);
  save();
}

/** Store the chosen 1+1+3 as the active route. */
export function setPlanSet(ids) {
  plan.set = [...ids];
  save();
}
