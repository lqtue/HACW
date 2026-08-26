import { browser } from '$app/environment';

// Nationality-study state, kept separate from passport.svelte.js so `track()` can
// read it without an import cycle (this module imports nothing app-side).
//
// Two independent things, two different consent postures:
//   nat      — the visitor's nationality proxy (the language they chose on welcome).
//              Tags aggregate behaviour counters (nat:<type>:<id>:<code>) so the
//              organizer can slice check-ins/funnel/quiz BY nationality. Still just
//              anonymous aggregate counts — same posture as the plain counters.
//   journey  — logs the ORDERED sequence of a single visit (site A -> B -> C) under
//              an ephemeral session id, so routes, dwell and plan adherence can be
//              compared by segment. Governed by the ONE study consent in
//              research.svelte.js (default on, toggle on scan step + passport):
//              the earlier separate opt-in had no UI and produced no rows.
//              See CONCERNS.md §3b and schema.sql `events.sid`.
const NAT = 'hacw_nat';
const SID = 'hacw_sid';

export const study = $state({
  nat: browser ? localStorage.getItem(NAT) || '' : ''
});

export function setNat(code) {
  if (!code || study.nat === code) return;
  study.nat = code;
  if (browser) localStorage.setItem(NAT, code);
}

// Ephemeral per-tab-session id: lives in sessionStorage, so it resets when the tab
// closes and never links two visits — a journey, not a device fingerprint.
function sessionId() {
  if (!browser) return '';
  let s = sessionStorage.getItem(SID);
  if (!s) {
    s = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(SID, s);
  }
  return s;
}

// Orders events within a visit. Kept in sessionStorage next to the sid: a reload
// keeps the sid, so a counter that restarted at 0 would collide.
const SEQ = 'hacw_seq';
function nextSeq() {
  const n = Number(sessionStorage.getItem(SEQ) ?? 0);
  sessionStorage.setItem(SEQ, String(n + 1));
  return n;
}

/** Journey stamp for an outgoing event, or null when the study is switched off.
 *  Consent is read lazily from localStorage (research.svelte.js owns the key) so
 *  this module keeps importing nothing app-side. */
export function journeyTag() {
  if (!browser || localStorage.getItem('hacw_research_v1') === '0') return null;
  return { sid: sessionId(), seq: nextSeq() };
}
