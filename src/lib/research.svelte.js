import { browser } from '$app/environment';
import { geohash } from './geo.js';
import { track } from './passport.svelte.js';

// Consent for the anonymous foot-traffic study. ON by default (opt-out): the
// visitor is told up front (onboarding scan step) and can turn it off there or on
// the passport page. Even when on, only coarse geohash CELL COUNTS are sent (no
// point, no time, no path, no device id), so there is no trajectory and nothing
// that re-identifies a device — closer to a footfall counter than tracking.
// ponytail: opt-out is defensible only while the data stays this anonymous; if it
// ever carries a point/time/id, switch to opt-in (see CONCERNS.md threat model).
const KEY = 'hacw_research_v1';

export const research = $state({
  // no stored value -> on; explicit '0' -> off. SSR/prerender defaults on too.
  on: browser ? localStorage.getItem(KEY) !== '0' : true
});

export function setResearch(on) {
  research.on = !!on;
  if (browser) localStorage.setItem(KEY, on ? '1' : '0');
}

// Bucket a GPS fix into a ~150 m cell tagged with the device locale and count it —
// a heatmap sliceable by nationality. Throttled ~30 s; only the cell id is sent.
// Shared by the explore map and the check-in flow so consent actually yields data.
let lastCellAt = 0;
export function recordCell(pos) {
  if (!research.on || !pos) return;
  const now = Date.now();
  if (now - lastCellAt < 30000) return;
  lastCellAt = now;
  const loc = (typeof navigator !== 'undefined' && navigator.language || '').toLowerCase().split('-')[0];
  const cell = geohash(pos.lat, pos.lng);
  track('cell', /^[a-z]{2,3}$/.test(loc) ? `${cell}-${loc}` : cell);
}
