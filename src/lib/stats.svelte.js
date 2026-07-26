import { browser } from '$app/environment';
import { base } from '$app/paths';

const KEY = 'hacw_counts_v1';
// Spotlight only needs to shift a few times a day; the organizer view forces a
// refresh (loadCounts(true)) when staff actually want live numbers.
const MAX_AGE = 6 * 60 * 60 * 1000;

function cached() {
  if (!browser) return { counts: {}, at: 0 };
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? { counts: {}, at: 0 };
  } catch {
    return { counts: {}, at: 0 };
  }
}

// Live check-in counts per destination, used to spotlight the quieter sites.
// Cached so the app keeps steering visitors sensibly while offline, and so a
// static deploy with no /api/checkin simply falls back to the sheet data.
export const stats = $state(cached());

export async function loadCounts(force = false) {
  if (!browser || !navigator.onLine) return;
  if (!force && Date.now() - stats.at < MAX_AGE) return;
  try {
    const res = await fetch(`${base}/api/checkin`);
    if (!res.ok) return;
    const counts = await res.json();
    if (!counts || typeof counts !== 'object') return;
    stats.counts = counts;
    stats.at = Date.now();
    localStorage.setItem(KEY, JSON.stringify({ counts, at: stats.at }));
  } catch {
    // no endpoint (GitHub Pages) or offline -> keep whatever we had
  }
}
