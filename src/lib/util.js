import categories from './data/categories.json';
import { openState, isClosingSoon, formatMinutes } from './hours.js';
import { s } from './strings.js';

const byId = Object.fromEntries(categories.map((c) => [c.id, c]));

export function categoryLabel(id) {
  return byId[id]?.label ?? id;
}

export function categoryIcon(id) {
  return byId[id]?.icon ?? '📍';
}

/**
 * Open-now badge for a destination, or null when the sheet has no usable hours
 * (better to say nothing than to send someone to a closed door).
 * The hours string is language-neutral, so `vi` is fine for both locales.
 * @returns {{ status: 'open'|'soon'|'closed', text: string } | null}
 */
export function openLabel(dest, now = new Date()) {
  // `closed: true` = shut for the whole festival (organiser's word), whatever the hours say
  if (dest?.closed) return { status: 'closed', text: s('closed_now') };
  const st = openState(dest?.hours?.vi ?? '', now);
  if (st.status === 'unknown') return null;
  if (st.status === 'closed') {
    return {
      status: 'closed',
      text: st.opensAt != null ? s('opens_at', formatMinutes(st.opensAt)) : s('closed_now')
    };
  }
  return isClosingSoon(st)
    ? { status: 'soon', text: s('closing_soon', st.closesIn) }
    : { status: 'open', text: s('open_now') };
}

// External Google Maps walking-navigation handoff.
export function mapsUrl(dest) {
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=walking`;
}

/** Hand the browser a file. Used by the CSV export and every editor download. */
export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}
