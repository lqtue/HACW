import { browser } from '$app/environment';

// Nationality-study state, kept separate from passport.svelte.js so `track()` can
// read it without an import cycle (this module imports nothing app-side).
//
// Two independent things, two different consent postures:
//   nat      — the visitor's nationality proxy (the language they chose on welcome).
//              Tags aggregate behaviour counters (nat:<type>:<id>:<code>) so the
//              organizer can slice check-ins/funnel/quiz BY nationality. Still just
//              anonymous aggregate counts — same posture as the plain counters.
//   journey  — OPT-IN (default off): logs the ORDERED sequence of a single visit
//              (site A -> B -> C) under an ephemeral session id, so nationalities'
//              routes can be compared. A sequence is closer to re-identifiable than
//              a bucket count, so unlike the footfall opt-OUT this is an explicit
//              opt-IN. See CONCERNS.md §3b and schema.sql `journeys`.
const NAT = 'hacw_nat';
const JOURNEY = 'hacw_journey_v1';
const SID = 'hacw_sid';

export const study = $state({
  nat: browser ? localStorage.getItem(NAT) || '' : '',
  journey: browser ? localStorage.getItem(JOURNEY) === '1' : false
});

export function setNat(code) {
  if (!code || study.nat === code) return;
  study.nat = code;
  if (browser) localStorage.setItem(NAT, code);
}

export function setJourney(on) {
  study.journey = !!on;
  if (browser) localStorage.setItem(JOURNEY, on ? '1' : '0');
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

// Resets on reload (a reload starts a new session anyway); orders events within a visit.
let seq = 0;

/** Journey stamp for an outgoing event, or null when the visitor hasn't opted in. */
export function journeyTag() {
  if (!study.journey) return null;
  return { sid: sessionId(), seq: seq++ };
}
