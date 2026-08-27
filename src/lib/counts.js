// Everything the check-in endpoint does that isn't storage: what counts as a
// valid event, how events map onto counter keys (ops) and onto study rows. Pure,
// so node can test it.
//
//   count:<destId>         check-ins
//   ev:<type>[:<destId>]   everything that isn't a check-in
//   events table           one row per accepted event (eventRows)

import { unit, nudgeOn } from './switchback.js';

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
  // device locale (`w6v45k2-ko`), so footfall can be sliced by nationality. Only the
  // per-cell COUNT is kept — never a point or a path. Bounded id, skips the guard.
  'cell',
  // pageviews: `view` id = a route key (home, explore, site, …), crossed by nationality
  // so the organizer sees which pages each nationality uses. `plan_mode` id = how the
  // 5-site plan was assembled (recommend | manual | mixed); its `n` = slots the visitor
  // let the app auto-fill. Both take bounded-alphabet ids, so they skip the dest guard.
  'view', 'plan_mode',
  // behaviour detail (per-site, dest-guarded like checkin): `plan_pick` = a site put
  // in the 5-site plan (`n` = its position), `arrive` = GPS fix inside the radius
  // (`n` = metres), `quiz_done` = quiz passed (`n` = wrong taps it took), `view_site` =
  // the site page opened. With `sid` these give plan adherence, arrivals that never
  // stamped, per-question difficulty and "looked but never went".
  'plan_pick', 'arrive', 'quiz_done', 'view_site',
  // "pick for me" A/B: which arm filled a slot with which site (`spot` = quiet then).
  // Per sid, joined with plan_pick / checkin: does the steer move anyone?
  'auto_steer', 'auto_random'
]);
export const MAX_EVENTS = 50; // one dead-spot queue, not a firehose

// Logged to `events` only — no counter row. These are per-DESTINATION types, so each
// one mints its own key and they were most of the write cost (~18 of 89 row-writes a
// visit) while nothing reads them live: /organizer shows check-ins, the funnel, views
// and the GPS/quiz to-do lists, all of which keep their counters. Everything here is
// answered after the event by a GROUP BY over `events`, which is where it already is.
const EVENTS_ONLY = new Set(['arrive', 'quiz_done', 'plan_pick', 'auto_steer', 'auto_random']);

// Behaviour crossed BY nationality, keyed `nat:<type>:<id|_>:<code>` (aggregate,
// alongside the plain counters, which stay untouched so the spotlight is unaffected).
// EXACTLY what /organizer renders live — the check-ins table and the three funnel
// rows — and nothing else: every event row already carries `nat`, so crossing a type
// nobody watches during the festival just spends write quota on a row read after the
// event by a GROUP BY instead. lang/pick ARE the nationality signal; cell carries its
// own locale; neither crosses.
const NAT_CROSS = new Set(['checkin', 'welcome', 'scan', 'plan_built']);
const SID = /^[a-f0-9]{8,24}$/i; // ephemeral session id (study.svelte.js)

const ID = /^[a-z0-9-]{1,32}$/;
// A language code (ISO 639 subtag, or 'other'). Its own bounded alphabet caps how
// many distinct rows it can mint, so unlike a free destination id it needs no
// allowlist — a flood tops out at a few thousand real codes, not the unbounded
// junk the dest-id guard exists to stop.
const LANGCODE = /^[a-z]{2,8}$/;
// A geohash cell, optionally `-<langcode>`. Pinned to the `w6v4` prefix — the whole
// old town sits in that one 4-char cell — so at most 32^5 cells can ever exist; an
// unpinned 9-char geohash would let a script mint millions of counter rows.
const CELL = /^w6v4[0-9b-hjkmnp-z]{1,5}(-[a-z]{2,3})?$/;
const EID = /^[a-f0-9]{8,16}$/i; // client-minted event id (passport.svelte.js track)
const LANG_TYPES = new Set(['lang', 'pick']);
// Fixed, closed vocabularies — a `view` id is one of the app's routes, a `plan_mode`
// id is one of three build modes. Both bounded by an allowlist (not just a regex), so
// like the language keys they can't mint unbounded rows and skip the dest-id guard.
const VIEWS = new Set(['home', 'explore', 'site', 'tours', 'tour', 'passport', 'organizer', 'terms', 'guide']);
const PLAN_MODES = new Set(['recommend', 'manual', 'mixed']);

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
    if (!TYPES.has(type) || EVENTS_ONLY.has(type)) continue;
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
    // pageview: bounded route key, crossed by nationality (nat:view:<page>:<code>).
    if (type === 'view') {
      const pg = typeof e?.id === 'string' && VIEWS.has(e.id) ? e.id : null;
      if (!pg) continue;
      bump[eventKey('view', pg)] = (bump[eventKey('view', pg)] ?? 0) + 1;
      const nat = typeof e?.nat === 'string' && LANGCODE.test(e.nat) ? e.nat : null;
      if (nat) bump[`nat:view:${pg}:${nat}`] = (bump[`nat:view:${pg}:${nat}`] ?? 0) + 1;
      continue;
    }
    // plan build: which mode, crossed by nationality; `n` = auto-filled slots, summed
    // into ev:plan_auto_m so plan_auto_m / plan_mode:mixed = avg slots left to the app.
    if (type === 'plan_mode') {
      const mode = typeof e?.id === 'string' && PLAN_MODES.has(e.id) ? e.id : null;
      if (!mode) continue;
      bump[eventKey('plan_mode', mode)] = (bump[eventKey('plan_mode', mode)] ?? 0) + 1;
      const nat = typeof e?.nat === 'string' && LANGCODE.test(e.nat) ? e.nat : null;
      if (nat) bump[`nat:plan_mode:${mode}:${nat}`] = (bump[`nat:plan_mode:${mode}:${nat}`] ?? 0) + 1;
      if (Number.isFinite(e.n) && e.n > 0) bump['ev:plan_auto_m'] = (bump['ev:plan_auto_m'] ?? 0) + Math.min(Math.round(e.n), 5);
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
 * Queued events -> rows for the `events` study table: every accepted event, with
 * the server's clock and the switchback unit stamped on. Same acceptance rules as
 * tally() (type known, dest a real site when present) so the two stores agree,
 * except the nat/lang/cell/view/plan_mode specifics collapse into `dest`/`n`.
 * An event without a valid `eid` is skipped: without it a re-sent chunk would
 * double-log, and that is exactly what the UNIQUE(eid) exists to stop.
 * @param {Iterable<object>} events
 * @param {Set<string>|null} validIds
 * @param {number} now server ms
 */
export function eventRows(events, validIds = null, now = Date.now()) {
  const { day, half } = unit(now);
  const nudge = nudgeOn(now);
  const rows = [];
  for (const e of (events ?? []).slice(0, MAX_EVENTS)) {
    const eid = typeof e?.eid === 'string' && EID.test(e.eid) ? e.eid.toLowerCase() : null;
    if (!eid) continue;
    const type = e?.t ?? 'checkin';
    if (!TYPES.has(type)) continue;
    let dest = null;
    if (typeof e?.id === 'string') {
      if (LANG_TYPES.has(type)) dest = LANGCODE.test(e.id) ? e.id : null;
      else if (type === 'cell') dest = CELL.test(e.id) ? e.id : null;
      else if (type === 'view') dest = VIEWS.has(e.id) ? e.id : null;
      else if (type === 'plan_mode') dest = PLAN_MODES.has(e.id) ? e.id : null;
      else dest = ID.test(e.id) && (!validIds || validIds.has(e.id)) ? e.id : null;
      if (!dest) continue; // an id was given and it is junk: drop, same as tally()
    } else if (type === 'checkin') continue;
    rows.push({
      eid,
      ts: now,
      day,
      half,
      nudge,
      t: type,
      dest,
      spot: e?.spot === 1 || e?.spot === true ? 1 : e?.spot === 0 || e?.spot === false ? 0 : null,
      nat: typeof e?.nat === 'string' && LANGCODE.test(e.nat) ? e.nat : null,
      n: Number.isFinite(e?.n) ? e.n : null,
      sid: typeof e?.sid === 'string' && SID.test(e.sid) ? e.sid : null,
      seq: Number.isInteger(e?.seq) ? e.seq : null,
      tk: e?.tk === 5 || e?.tk === 3 ? e.tk : null
    });
  }
  return rows;
}
