import { browser } from '$app/environment';

const KEY = 'hacw_passport_v1';
const QUEUE = 'hacw_checkin_queue_v1';
const REDEEMED = 'hacw_redeemed_v1';

function read(key) {
  if (!browser) return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]');
  } catch {
    return [];
  }
}

// Reactive passport state, mirrored to localStorage. Mutate arrays, don't reassign.
export const passport = $state({ stamps: read(KEY), redeemed: read(REDEEMED) });

function persist() {
  if (browser) localStorage.setItem(KEY, JSON.stringify(passport.stamps));
}

export function hasStamp(id) {
  return passport.stamps.some((s) => s.id === id);
}

// --- themed voucher sets (a "set" = a tour's list of stops) ---
export function isSetComplete(stopIds) {
  return stopIds.length > 0 && stopIds.every((id) => hasStamp(id));
}

export function isRedeemed(tourId) {
  return passport.redeemed.includes(tourId);
}

export function redeemSet(tourId) {
  if (passport.redeemed.includes(tourId)) return;
  passport.redeemed.push(tourId);
  if (browser) localStorage.setItem(REDEEMED, JSON.stringify(passport.redeemed));
}

export function addStamp(id) {
  if (hasStamp(id)) return;
  passport.stamps.push({ id, at: new Date().toISOString() });
  persist();
  queue(id);
  flush();
}

// --- offline-tolerant analytics: queue locally, POST when online ---
function queue(id) {
  if (!browser) return;
  const q = read(QUEUE);
  q.push({ id, at: Date.now() });
  localStorage.setItem(QUEUE, JSON.stringify(q));
}

export async function flush() {
  if (!browser || !navigator.onLine) return;
  const q = read(QUEUE);
  if (!q.length) return;
  try {
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: q })
    });
    if (res.ok) localStorage.setItem(QUEUE, '[]');
  } catch {
    // still offline / server down -> keep queue, retry next flush
  }
}
