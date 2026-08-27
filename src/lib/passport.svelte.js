import { browser } from '$app/environment';
import { base } from '$app/paths';
import { mergeStamps, encodeSnapshot, decodeSnapshot, normalizeCode, isValidCode, codeFromTicket } from './backup.js';
import { study, journeyTag } from './study.svelte.js';
import { plan } from './plan.svelte.js';
import { staff } from './staff.svelte.js';

const KEY = 'hacw_passport_v1';
const QUEUE = 'hacw_checkin_queue_v1';
const REDEEMED = 'hacw_redeemed_v1';
const PID = 'hacw_pid_v1';
const DID = 'hacw_did_v1';
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

// Device id: random, per install, and NEVER replaced by adoptCode. The pid can be
// shared (everyone holding the same ticket derives it); this is what tells the
// server which single device is currently using that ticket. See the passport API.
function loadDid() {
  if (!browser) return '';
  let id = localStorage.getItem(DID);
  if (!id) {
    id = newPid();
    localStorage.setItem(DID, id);
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
// `taken` = the server says another device now holds this ticket (see backup()).
// Local stamps keep working; only syncing stops.
export const passport = $state({
  stamps: read(KEY),
  redeemed: read(REDEEMED),
  pid: loadPid(),
  did: loadDid(),
  holder: loadHolder(),
  taken: false
});

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
  passport.taken = false; // this device is claiming the ticket now
  if (browser) localStorage.setItem(PID, pid);
  // claim: the visitor scanned this ticket on THIS phone, so it takes the ticket
  // over from whatever device held it (that one stops syncing on its next write)
  soon('backup', () => backup({ claim: true }), 2000);
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

/** @param {boolean} [spot] the site was spotlight (quiet half) at check-in — study field */
export function addStamp(id, pts = 10, spot) {
  if (hasStamp(id)) return;
  passport.stamps.push({ id, at: new Date().toISOString(), pts, ...(spot != null ? { spot: spot ? 1 : 0 } : {}) });
  persist();
  track('checkin', id, undefined, spot);
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

// Our own testing must not become the festival dataset. The first run of this app
// logged ~500 events and 217 passports from developers in Hanoi (GPS 595 km out),
// which had to be deleted by hand before day one.
//
// Deliberately a BLOCK list, not an allow list: an allow list keyed to
// hacw.pages.dev would silently stop all logging the day this moves to a real
// domain, and silence is the one failure nobody notices.
//   * localhost           — `npm run dev` already answers /api from memory
//                           (devApi in vite.config.js), this is belt and braces
//   * <branch>.pages.dev  — preview deploys share the PRODUCTION D1 on purpose
//                           (wrangler.toml), so the host is all that separates them
//   * staff devices       — a phone with the staff code is running the app to test
//                           it: skip-GPS check-ins, screen sweeps, code demos.
//                           A visitor redeeming a voucher is unaffected: the staff
//                           member taps confirm on the VISITOR's phone, which has
//                           no staff code of its own.
function isRealVisit() {
  if (!browser) return false;
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return false;
  if (h.endsWith('.pages.dev') && h !== 'hacw.pages.dev') return false;
  return !staff.on;
}

// --- offline-tolerant analytics: queue locally, POST when online ---
// Own endpoint instead of Google Analytics: no cookie banner, no ad-blocker
// hole, works offline (the queue survives in localStorage), and the organizer
// dashboard reads the same numbers the app does.
/** @param {string} type checkin | gps_far | gps_fail | quiz_wrong | redeem |
 *    welcome | scan | plan_built | lang | pick
 *  @param {string} [id] destination / tour id — or, for lang/pick, a language code
 *  @param {number} [n] optional measurement (metres off, question index)
 *  @param {boolean} [spot] the site was spotlight at the time (study: nudge uptake) */
export function track(type, id, n, spot) {
  if (!isRealVisit()) return;
  const q = read(QUEUE);
  // eid: random per event so the server's INSERT OR IGNORE makes a re-sent chunk
  // exactly-once in the study log (a lost response must not double-log).
  const eid = [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const e = { eid, t: type, id, n, at: Date.now(), ...(spot != null ? { spot: spot ? 1 : 0 } : {}) };
  // ticket type (5 | 3) = the visitor segment every event can carry for free
  if (plan.ticketCode) e.tk = plan.size;
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

// Server accepts MAX_EVENTS (counts.js) per POST and the guard caps the body at
// 16 KB; a long offline visit exceeds both, so drain in chunks. Sending the whole
// queue used to drop everything past 50 silently, and past ~160 wedged forever.
const CHUNK = 50;

export async function flush() {
  if (!browser || !navigator.onLine || flushing) return;
  flushing = true;
  try {
    for (let q = read(QUEUE); q.length; q = read(QUEUE)) {
      const chunk = q.slice(0, CHUNK);
      const res = await fetch(`${base}/api/checkin`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ events: chunk })
      });
      if (!res.ok) break; // server down -> keep the queue, retry next flush
      // drop only what we actually sent — check-ins made during the request stay queued
      localStorage.setItem(QUEUE, JSON.stringify(read(QUEUE).slice(chunk.length)));
    }
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
  // `plan` rides along for the study (adherence = planned ∩ stamped); not restored.
  return { v: 1, pid: passport.pid, stamps: passport.stamps, redeemed: passport.redeemed, plan: plan.set };
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
/** @param {{ claim?: boolean }} [opts] claim = take this ticket over (after a scan) */
export async function backup(opts = {}) {
  if (!navigator.onLine || !passport.pid || !isRealVisit()) return;
  if (passport.taken && !opts.claim) return; // another device holds the ticket
  try {
    const res = await fetch(`${base}/api/passport`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...snapshot(), did: passport.did, ...(opts.claim ? { claim: true } : {}) })
    });
    // 409: someone else scanned this ticket. Stop syncing and let the passport
    // page say so — the stamps on this phone stay put and still show.
    passport.taken = res.status === 409;
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

/**
 * Recover from a scanned ticket: derive its code, adopt it (which claims the
 * ticket for this device) and merge whatever was backed up under it. Missing or
 * unreadable backups are not an error — the ticket is still adopted, so this
 * phone becomes the one that ticket syncs to.
 * @returns {Promise<number>} stamps on the passport after the merge
 */
export async function restoreFromTicket(raw) {
  const code = codeFromTicket(raw);
  if (!isValidCode(code)) throw new Error('bad-code');
  adoptCode(code);
  try {
    await restore(code);
  } catch (e) {
    if (e.message === 'server') throw e; // offline / broken server is worth saying
  }
  return passport.stamps.length;
}
