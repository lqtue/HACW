import { browser } from '$app/environment';
import { base } from '$app/paths';
import { mergeStamps, encodeSnapshot, decodeSnapshot, normalizeCode, isValidCode } from './backup.js';
import { study, journeyTag } from './study.svelte.js';

const KEY = 'hacw_passport_v1';
const QUEUE = 'hacw_checkin_queue_v1';
const REDEEMED = 'hacw_redeemed_v1';
const PID = 'hacw_pid_v1';
const HOLDER = 'hacw_holder_v1';

function read(key) {
  if (!browser) return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]');
  } catch {
    return [];
  }
}

// Anonymous device id, doubling as the recovery code the visitor can read out.
// No PII: 8 chars of Crockford base32 (no I/L/O/U -> nothing to misread aloud).
function newPid() {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => alphabet[b % 32]).join('');
}

function loadPid() {
  if (!browser) return '';
  let id = localStorage.getItem(PID);
  if (!id) {
    id = newPid();
    localStorage.setItem(PID, id);
  }
  return id;
}

function loadHolder() {
  if (!browser) return '';
  try {
    return localStorage.getItem(HOLDER) ?? '';
  } catch {
    return '';
  }
}

// Reactive passport state, mirrored to localStorage. Mutate arrays, don't reassign.
export const passport = $state({ stamps: read(KEY), redeemed: read(REDEEMED), pid: loadPid(), holder: loadHolder() });

/** Recovery code as shown to the visitor: ABCD-EFGH. */
export const prettyCode = (pid = passport.pid) => (pid ? `${pid.slice(0, 4)}-${pid.slice(4)}` : '');

/** The holder name the visitor typed on their passport — device-local, cached. */
export function setHolder(name) {
  passport.holder = name;
  if (browser) localStorage.setItem(HOLDER, name);
}

/**
 * Adopt a recovery code derived from the visitor's scanned ticket (see
 * codeFromTicket). Replaces the auto-generated pid so re-scanning the ticket on
 * another device restores the same passport. No-op on junk or the current code;
 * local stamps are untouched (merge-only), and a fresh backup goes up soon.
 */
export function adoptCode(pid) {
  if (!isValidCode(pid) || pid === passport.pid) return;
  passport.pid = pid;
  if (browser) localStorage.setItem(PID, pid);
  soon('backup', backup, 2000);
}

function persist() {
  if (!browser) return;
  localStorage.setItem(KEY, JSON.stringify(passport.stamps));
  localStorage.setItem(REDEEMED, JSON.stringify(passport.redeemed));
}

export function hasStamp(id) {
  return passport.stamps.some((s) => s.id === id);
}

// --- themed voucher sets (a "set" = a tour's list of stops) ---
export function isSetComplete(stopIds) {
  return stopIds.length > 0 && stopIds.every((id) => hasStamp(id));
}

export function isRedeemed(id) {
  return passport.redeemed.includes(id);
}

/** Marks a tour set or a reward tier as handed over by staff. */
export function redeemSet(id) {
  if (passport.redeemed.includes(id)) return;
  passport.redeemed.push(id);
  persist();
  track('redeem', id);
  soon('backup', backup, 10000);
}

export function addStamp(id, pts = 10) {
  if (hasStamp(id)) return;
  passport.stamps.push({ id, at: new Date().toISOString(), pts });
  persist();
  track('checkin', id);
  soon('backup', backup, 10000);
}

// Both server writes are debounced. Cloudflare KV writes are the scarce resource
// (not bandwidth), and a visitor stamping two sites in one street should cost one
// PUT, not two. Nothing is lost if the timer never fires: localStorage holds the
// truth and `sync()` in +layout.svelte replays it on next load and on reconnect.
const timers = {};
function soon(key, fn, ms) {
  if (!browser) return;
  clearTimeout(timers[key]);
  timers[key] = setTimeout(fn, ms);
}

// --- offline-tolerant analytics: queue locally, POST when online ---
// Own endpoint instead of Google Analytics: no cookie banner, no ad-blocker
// hole, works offline (the queue survives in localStorage), and the organizer
// dashboard reads the same numbers the app does.
/** @param {string} type checkin | gps_far | gps_fail | quiz_wrong | redeem |
 *    welcome | scan | plan_built | lang | pick
 *  @param {string} [id] destination / tour id — or, for lang/pick, a language code
 *  @param {number} [n] optional measurement (metres off, question index) */
export function track(type, id, n) {
  if (!browser) return;
  const q = read(QUEUE);
  const e = { t: type, id, n, at: Date.now() };
  // nationality tag → the server crosses whitelisted behaviour with it (aggregate)
  if (study.nat) e.nat = study.nat;
  // journey stamp only when the visitor opted into the sequence study
  const j = journeyTag();
  if (j) {
    e.sid = j.sid;
    e.seq = j.seq;
  }
  q.push(e);
  localStorage.setItem(QUEUE, JSON.stringify(q));
  soon('flush', flush, 5000);
}

let flushing = false;

export async function flush() {
  if (!browser || !navigator.onLine || flushing) return;
  const q = read(QUEUE);
  if (!q.length) return;
  flushing = true;
  try {
    const res = await fetch(`${base}/api/checkin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pid: passport.pid, events: q })
    });
    // drop only what we actually sent — check-ins made during the request stay queued
    if (res.ok) localStorage.setItem(QUEUE, JSON.stringify(read(QUEUE).slice(q.length)));
  } catch {
    // still offline / server down -> keep queue, retry next flush
  } finally {
    flushing = false;
  }
}

// --- losing the phone / clearing the browser: recovery ---------------------
// Two independent paths, because the app runs in two deployments:
//   * server backup (Cloudflare KV) -> restore anywhere with the 8-char code
//   * backup link -> works with no server at all (GitHub Pages), user keeps it
// Both merge rather than overwrite, so restoring never loses local stamps.

/** Union of local and incoming state (see backup.js — restore never removes). */
export function merge(incoming) {
  for (const s of mergeStamps(passport.stamps, incoming?.stamps)) {
    if (!hasStamp(s.id)) passport.stamps.push(s);
    else Object.assign(passport.stamps.find((x) => x.id === s.id), s);
  }
  for (const id of incoming?.redeemed ?? []) {
    if (!passport.redeemed.includes(id)) passport.redeemed.push(id);
  }
  persist();
}

export function snapshot() {
  return { v: 1, pid: passport.pid, stamps: passport.stamps, redeemed: passport.redeemed };
}

/** Self-contained backup link — everything is in the fragment, no server needed. */
export function backupLink(origin = browser ? location.origin : '') {
  return `${origin}${base}/passport#r=${encodeSnapshot(snapshot())}`;
}

/** Reads a `#r=` backup link. Returns true if something was restored. */
export function restoreFromHash(hash) {
  const incoming = decodeSnapshot(hash);
  if (!incoming) return false;
  merge(incoming);
  return true;
}

/** Push a copy to the server so the code can restore it on another device. */
export async function backup() {
  if (!browser || !navigator.onLine || !passport.pid) return;
  try {
    await fetch(`${base}/api/passport`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(snapshot())
    });
  } catch {
    // no server (static deploy) or offline -> the backup link still works
  }
}

/** Restore by recovery code. Throws so the UI can tell the visitor what failed. */
export async function restore(code) {
  const pid = normalizeCode(code);
  if (!isValidCode(pid)) throw new Error('bad-code');
  const res = await fetch(`${base}/api/passport?pid=${pid}`);
  if (!res.ok) throw new Error(res.status === 404 ? 'not-found' : 'server');
  merge(await res.json());
}
