import { browser } from '$app/environment';

const KEY = 'hacw_staff_v1';

// Two tiers, both client-side. VOLUNTEER unlocks everything a helper on the
// street needs: the skip-GPS test button, the voucher confirm step and reading
// /organizer. ORGANIZER is a superset — it also unlocks the content editor in
// /organizer (edit + download destinations.json).
// Unlock by typing the code, or once per device with ?staff=<code> on any URL.
// ponytail: client-side constants — stops mis-taps and curious visitors, NOT fraud.
// Real gate = Cloudflare Access in front of /organizer + a server-signed redemption.
const VOLUNTEER = '2026';
const ORGANIZER = '2026hacw';

const stored = browser ? localStorage.getItem(KEY) : null;

export const staff = $state({
  on: stored === VOLUNTEER || stored === ORGANIZER,
  admin: stored === ORGANIZER
});

/** @returns {boolean} whether the code was right (either tier) */
export function unlock(input) {
  const code = String(input).trim();
  if (code !== VOLUNTEER && code !== ORGANIZER) return false;
  staff.on = true;
  staff.admin = code === ORGANIZER;
  if (browser) localStorage.setItem(KEY, code);
  return true;
}

export function lock() {
  staff.on = false;
  staff.admin = false;
  if (browser) localStorage.removeItem(KEY);
}

/** Called once on mount: ?staff=<code> unlocks, ?staff=0 locks again. */
export function unlockFromUrl(url) {
  const q = url.searchParams.get('staff');
  if (q === null) return;
  if (q === '0') lock();
  else unlock(q);
}
