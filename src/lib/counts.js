// Everything the check-in endpoint does that isn't storage: what counts as a
// valid event, and how events map onto counter keys. Pure, so node can test it.
//
//   count:<destId>         check-ins
//   ev:<type>[:<destId>]   everything that isn't a check-in

export const TYPES = new Set([
  'checkin', 'gps_far', 'gps_fail', 'quiz_wrong', 'redeem',
  // onboarding / planner funnel (site-less totals): app opened, ticket scanned,
  // a valid 1+1+3 assembled — the numbers that show how many visitors reach each step.
  'welcome', 'scan', 'plan_built',
  // language study: `lang` = the device locale (navigator.language primary subtag),
  // `pick` = the language the visitor chose on the welcome screen. Both are a proxy
  // for nationality — see the welcome picker. Their id is a language code, not a
  // destination id, so they take the LANGCODE path below and skip the dest-id guard.
  'lang', 'pick',
  // research heatmap (opt-in): `cell` = a geohash cell, optionally suffixed with the
  // device locale (`w3gv5k2-ko`), so footfall can be sliced by nationality. Only the
  // per-cell COUNT is kept — never a point or a path. Bounded id, skips the guard.
  'cell'
]);
export const MAX_EVENTS = 50; // one dead-spot queue, not a firehose

// Behaviour crossed BY nationality, keyed `nat:<type>:<id|_>:<code>` (aggregate,
// alongside the plain counters, which stay untouched so the spotlight is unaffected).
// Only these types are worth slicing; lang/pick ARE the nationality signal and cell
// already carries its own locale, so none of those cross.
const NAT_CROSS = new Set(['checkin', 'gps_far', 'quiz_wrong', 'redeem', 'welcome', 'scan', 'plan_built']);
const SID = /^[a-f0-9]{8,24}$/i; // ephemeral session id (study.svelte.js)

const ID = /^[a-z0-9-]{1,32}$/;
// A language code (ISO 639 subtag, or 'other'). Its own bounded alphabet caps how
// many distinct rows it can mint, so unlike a free destination id it needs no
// allowlist — a flood tops out at a few thousand real codes, not the unbounded
// junk the dest-id guard exists to stop.
const LANGCODE = /^[a-z]{2,8}$/;
// A geohash cell (base32, no a/i/l/o), optionally `-<langcode>`. Same bounded-alphabet
// argument: the old town is a few dozen cells × a handful of locales, not a flood.
const CELL = /^[0-9b-hjkmnp-z]{5,9}(-[a-z]{2,3})?$/;
const LANG_TYPES = new Set(['lang', 'pick']);

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
    // language events carry a language code, not a destination id: validate against
    // LANGCODE and skip the dest-id allowlist (the code alphabet is its own bound).
    if (LANG_TYPES.has(type)) {
      const code = typeof e?.id === 'string' && LANGCODE.test(e.id) ? e.id : null;
      if (!code) continue;
      const key = eventKey(type, code);
      bump[key] = (bump[key] ?? 0) + 1;
      continue;
    }
    // heatmap cells: a geohash(+locale), same bounded-id argument as the language keys.
    if (type === 'cell') {
      const cell = typeof e?.id === 'string' && CELL.test(e.id) ? e.id : null;
      if (!cell) continue;
      const key = eventKey(type, cell);
      bump[key] = (bump[key] ?? 0) + 1;
      continue;
    }
    const id = typeof e?.id === 'string' && ID.test(e.id) ? e.id : null;
    // A well-formed id that names no real site is the flooding attack: drop it.
    if (id && validIds && !validIds.has(id)) continue;
    if (type === 'checkin' && !id) continue;
    // gps_far/quiz_wrong are per-site diagnostics; the rest are plain totals.
    const key = type === 'checkin' ? countKey(id) : eventKey(type, id);
    bump[key] = (bump[key] ?? 0) + 1;
    // cross this behaviour by nationality when the event carries a valid code
    const nat = typeof e?.nat === 'string' && LANGCODE.test(e.nat) ? e.nat : null;
    if (nat && NAT_CROSS.has(type)) {
      const nk = `nat:${type}:${id ?? '_'}:${nat}`;
      bump[nk] = (bump[nk] ?? 0) + 1;
    }
    // Metres overshot, summed: `gps_far_m / gps_far` is the average overshoot per
    // site, which is the number that says what its radius should have been.
    if (type === 'gps_far' && id && Number.isFinite(e.n) && e.n > 0) {
      const m = `ev:gps_far_m:${id}`;
      bump[m] = (bump[m] ?? 0) + Math.min(Math.round(e.n), 5000);
    }
  }
  return bump;
}

/**
 * `[key, n]` rows -> totals per destination (count keys) or per event name.
 * Matches the exact prefix so the `nat:` cross-tab rows never leak into either
 * bucket (they read via natTotals). Production also binds the prefix in SQL, but
 * keeping this strict means the dev stand-in and any future caller are safe too.
 */
export function totals(rows, events = false) {
  const prefix = events ? 'ev:' : 'count:';
  const out = {};
  for (const [key, n] of rows) {
    if (!key.startsWith(prefix)) continue;
    out[key.slice(prefix.length)] = n;
  }
  return out;
}

/**
 * `nat:<type>:<id|_>:<code>` rows -> `{ [type]: { [id]: { [code]: n } } }`.
 * Behaviour crossed by nationality, for the organizer's per-nationality tables.
 */
export function natTotals(rows) {
  const out = {};
  for (const [key, n] of rows) {
    if (!key.startsWith('nat:')) continue;
    const rest = key.slice(4);
    const a = rest.indexOf(':');
    const b = rest.lastIndexOf(':');
    if (a < 0 || b <= a) continue;
    const type = rest.slice(0, a);
    const id = rest.slice(a + 1, b);
    const code = rest.slice(b + 1);
    ((out[type] ??= {})[id] ??= {})[code] = n;
  }
  return out;
}

/**
 * Queued events -> journey rows for the (opt-in) sequence log. Only events that
 * carry an ephemeral `sid` are logged; `dest` is kept only when it names a real
 * site. Pure so sql.test.js / counts.test.js can exercise it.
 * @param {Iterable<object>} events
 * @param {Set<string>|null} [validIds]
 */
export function journeyRows(events, validIds = null) {
  const rows = [];
  for (const e of (events ?? []).slice(0, MAX_EVENTS)) {
    if (typeof e?.sid !== 'string' || !SID.test(e.sid)) continue;
    const type = e?.t ?? 'checkin';
    if (!TYPES.has(type)) continue;
    const dest = typeof e?.id === 'string' && ID.test(e.id) && (!validIds || validIds.has(e.id)) ? e.id : null;
    const nat = typeof e?.nat === 'string' && LANGCODE.test(e.nat) ? e.nat : null;
    rows.push({
      sid: e.sid,
      seq: Number.isInteger(e.seq) ? e.seq : 0,
      nat,
      t: type,
      dest,
      ts: Number.isFinite(e.at) ? e.at : 0
    });
  }
  return rows;
}
