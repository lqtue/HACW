// Plausibility check over a passport's stamp history. **Advisory only.**
//
// The app cannot prevent a faked check-in — GPS is self-reported and the quiz
// answers ship in destinations.json. This makes organised cheating *visible*
// instead: a passport that moved 900 m in under a minute, or collected the whole
// old town in five, gets a flag the organizer and the redeeming staff member can
// see. A flag must never block a voucher on its own. A bicycle, a bad first GPS
// fix and a group that walks fast are all normal, and refusing a real visitor is
// far worse than handing out one extra paper voucher.

import { distanceMeters } from './geo.js';

/** Brisk walking in a crowded old town is ~75 m/min; double it before complaining. */
export const WALK_MAX = 150;
/** This many stamps inside this many minutes is not a walk, it's a script. */
export const BURST_STAMPS = 6;
export const BURST_MINUTES = 10;

/**
 * @param {Array<{id: string, at: string}>} stamps
 * @param {Array<{id: string, lat: number, lng: number}>} destinations
 * @returns {Array<{kind: string, [k: string]: any}>} empty = nothing odd
 */
export function flagPassport(stamps, destinations, opts = {}) {
  const maxSpeed = opts.maxSpeed ?? WALK_MAX;
  const burstStamps = opts.burstStamps ?? BURST_STAMPS;
  const burstMinutes = opts.burstMinutes ?? BURST_MINUTES;

  const where = new Map((destinations ?? []).map((d) => [d.id, d]));
  const seq = (stamps ?? [])
    .filter((s) => s?.id && where.has(s.id) && Number.isFinite(Date.parse(s?.at)))
    .map((s) => ({ id: s.id, t: Date.parse(s.at) }))
    .sort((a, b) => a.t - b.t);

  const out = [];

  for (let i = 1; i < seq.length; i++) {
    const [a, b] = [seq[i - 1], seq[i]];
    const metres = distanceMeters(where.get(a.id), where.get(b.id));
    // Floor the gap at one minute: two adjacent museums stamped 20 seconds apart
    // is a normal visit, not a teleport.
    const minutes = Math.max((b.t - a.t) / 60000, 1);
    const speed = metres / minutes;
    if (speed > maxSpeed) {
      out.push({
        kind: 'impossible-travel',
        from: a.id,
        to: b.id,
        metres: Math.round(metres),
        minutes: Math.round((b.t - a.t) / 60000),
        speed: Math.round(speed)
      });
    }
  }

  // One entry for the tightest burst, not one per sliding window.
  let tightest = null;
  for (let i = burstStamps - 1; i < seq.length; i++) {
    const span = (seq[i].t - seq[i - burstStamps + 1].t) / 60000;
    if (span <= burstMinutes && (!tightest || span < tightest.minutes)) {
      tightest = { kind: 'burst', stamps: burstStamps, minutes: Math.round(span) };
    }
  }
  if (tightest) out.push(tightest);

  return out;
}
