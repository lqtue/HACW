import { browser } from '$app/environment';

const KEY = 'hacw_staff_v1';

// One code for everything staff-only: the skip-GPS test button, /organizer and
// the voucher confirm step. Unlock by typing it, or once per device with
// ?staff=<code> on any URL.
// ponytail: client-side constant — stops mis-taps and curious visitors, NOT fraud.
// Real gate = Cloudflare Access in front of /organizer + a server-signed redemption.
const CODE = '2026';

export const staff = $state({ on: browser && localStorage.getItem(KEY) === CODE });

/** @returns {boolean} whether the code was right */
export function unlock(input) {
  if (String(input).trim() !== CODE) return false;
  staff.on = true;
  if (browser) localStorage.setItem(KEY, CODE);
  return true;
}

export function lock() {
  staff.on = false;
  if (browser) localStorage.removeItem(KEY);
}

/** Called once on mount: ?staff=<code> unlocks, ?staff=0 locks again. */
export function unlockFromUrl(url) {
  const q = url.searchParams.get('staff');
  if (q === null) return;
  if (q === '0') lock();
  else unlock(q);
}
