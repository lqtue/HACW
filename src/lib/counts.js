// Everything the check-in endpoint does that isn't storage: what counts as a
// valid event, and how events map onto counter keys. Pure, so node can test it.
//
//   count:<destId>         check-ins
//   ev:<type>[:<destId>]   everything that isn't a check-in

export const TYPES = new Set([
  'checkin', 'gps_far', 'gps_fail', 'quiz_wrong', 'redeem',
  // onboarding / planner funnel (site-less totals): app opened, ticket scanned,
  // a valid 1+1+3 assembled — the numbers that show how many visitors reach each step.
  'welcome', 'scan', 'plan_built'
]);
export const MAX_EVENTS = 50; // one dead-spot queue, not a firehose

const ID = /^[a-z0-9-]{1,32}$/;

export const countKey = (id) => `count:${id}`;

export const eventKey = (type, id) => (id ? `ev:${type}:${id}` : `ev:${type}`);

/**
 * Queued events -> `{ counterKey: increment }`. Unknown types and junk ids are
 * dropped rather than rejected: the queue is replayed from phones that may be
 * running an older build, and one bad entry must not block the rest of a visit.
 *
 * `validIds` (a Set of real destination ids) is the quota guard: without it a
 * random id like `xyz` mints a brand-new counter row, so a script POSTing junk
 * ids could invent unbounded rows and spend the D1 free-tier write allowance for
 * the whole event. An id outside the set drops the whole event. Pass it in
 * production; omit it in unit tests that use synthetic ids.
 * @param {Iterable<object>} events
 * @param {Set<string>|null} [validIds]
 */
export function tally(events, validIds = null) {
  const bump = {};
  for (const e of (events ?? []).slice(0, MAX_EVENTS)) {
    const type = e?.t ?? 'checkin';
    if (!TYPES.has(type)) continue;
    const id = typeof e?.id === 'string' && ID.test(e.id) ? e.id : null;
    // A well-formed id that names no real site is the flooding attack: drop it.
    if (id && validIds && !validIds.has(id)) continue;
    if (type === 'checkin' && !id) continue;
    // gps_far/quiz_wrong are per-site diagnostics; the rest are plain totals.
    const key = type === 'checkin' ? countKey(id) : eventKey(type, id);
    bump[key] = (bump[key] ?? 0) + 1;
    // Metres overshot, summed: `gps_far_m / gps_far` is the average overshoot per
    // site, which is the number that says what its radius should have been.
    if (type === 'gps_far' && id && Number.isFinite(e.n) && e.n > 0) {
      const m = `ev:gps_far_m:${id}`;
      bump[m] = (bump[m] ?? 0) + Math.min(Math.round(e.n), 5000);
    }
  }
  return bump;
}

/** `[key, n]` rows -> totals per destination (count keys) or per event name. */
export function totals(rows, events = false) {
  const out = {};
  for (const [key, n] of rows) {
    if (events !== key.startsWith('ev:')) continue;
    out[events ? key.slice(3) : key.slice(6)] = n;
  }
  return out;
}
