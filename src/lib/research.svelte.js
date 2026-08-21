import { browser } from '$app/environment';

// Opt-in consent for the anonymous location-footfall study. OFF by default — nothing
// location-related is recorded until the visitor turns this on. Even then only coarse
// geohash CELL COUNTS are sent (see counts.js `cell`), never a point, a time or a path,
// so there is no trajectory and nothing that re-identifies a device. Mirrored to
// localStorage so the choice sticks across sessions.
const KEY = 'hacw_research_v1';

export const research = $state({
  on: browser && localStorage.getItem(KEY) === '1'
});

export function setResearch(on) {
  research.on = !!on;
  if (browser) localStorage.setItem(KEY, on ? '1' : '0');
}
