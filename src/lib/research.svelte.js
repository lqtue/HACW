import { browser } from '$app/environment';
import { geohash } from './geo.js';
import { track } from './passport.svelte.js';

// Consent for the anonymous visitor study — ON by default (opt-out), the toggle
// sits on the onboarding scan step and the passport page and is always reversible.
// One switch covers both signals: coarse geohash CELL COUNTS (no point, no path)
// and the per-visit sequence id (`sid`, study.svelte.js — ephemeral, dies with the
// tab, never a device id). Terms page + `research_optin` string say exactly this.
const KEY = 'hacw_research_v1';

export const research = $state({
  // explicit '0' -> off; anything else (incl. no stored value) -> on. SSR: off.
  on: browser ? localStorage.getItem(KEY) !== '0' : false
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
