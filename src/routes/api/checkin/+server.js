// The app's analytics sink (there is no Google Analytics; this is it).
// Counts check-ins per destination plus a few event tallies in the D1 database
// bound as DB (Pages project → Settings → Bindings → D1). Schema: schema.sql.
//
//   POST /api/checkin  { events: [{ eid, t, id, n, at, nat?, spot?, sid?, seq? }] }
//     -> counters (ops aggregates) + one `events` row per event (study log)
//   GET  /api/checkin           -> { "<destId>": <count> }   (drives the spotlight)
//   GET  /api/checkin?events=1  -> { "<type>": <count>, "gps_far:<id>": <count> }
//
// Must live here rather than in functions/: adapter-cloudflare emits a _worker.js,
// and Cloudflare Pages ignores the functions/ directory whenever that file exists.
// Validation and key layout are in $lib/counts.js so node can test them.

import { json } from '@sveltejs/kit';
import { tally, totals, natTotals, eventRows } from '$lib/counts.js';
import { isSameOrigin } from '$lib/guard.js';
import { UPSERT_COUNTER, SELECT_COUNTERS, INSERT_EVENT, SELECT_JOURNEYS, prefixRange } from '$lib/sql.js';
import destinations from '$lib/data/destinations.json';

export const prerender = false;

// The only ids allowed to become counter rows. Anything else is junk from a
// script and would spend the D1 free-tier write quota on rows nobody reads.
const VALID_IDS = new Set(destinations.map((d) => d.id));

export async function POST({ request, platform }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad json' }, { status: 400 });
  }
  if (!Array.isArray(body?.events)) return json({ error: 'events[] required' }, { status: 400 });

  const db = platform?.env?.DB;
  // Tally in memory first: one counter row per key per request instead of per event.
  const bump = tally(body.events, VALID_IDS);
  // Study rows use the SERVER clock: it stamps the switchback unit, and phone
  // clocks drift. `INSERT OR IGNORE` on eid keeps a retried chunk exactly-once.
  const now = Date.now();
  const rows = eventRows(body.events, VALID_IDS, now);
  if (db && (Object.keys(bump).length || rows.length)) {
    // One batch = one transaction: the counters and the log cannot disagree
    // because the second half failed after the first committed.
    await db.batch([
      ...Object.entries(bump).map(([k, n]) => db.prepare(UPSERT_COUNTER).bind(k, n, now, n, now)),
      ...rows.map((r) =>
        db.prepare(INSERT_EVENT).bind(r.eid, r.ts, r.day, r.half, r.nudge, r.t, r.dest, r.spot, r.nat, r.n, r.sid, r.seq)
      )
    ]);
  }
  // stored:false = no D1 bound; the organizer page surfaces it, the client still drains.
  return json({ ok: true, stored: !!db, counted: Object.values(bump).reduce((a, b) => a + b, 0) });
}

export async function GET({ url, platform, request }) {
  const wantEvents = url.searchParams.has('events');
  const wantNat = url.searchParams.has('nat');
  const wantJourneys = url.searchParams.has('journeys');
  // Plain check-in counts are public (they drive the spotlight). Everything else —
  // behaviour tallies, the nationality cross-tab, the journey log — is organizer-only.
  if ((wantEvents || wantNat || wantJourneys) && !isSameOrigin(request.headers.get('sec-fetch-site'))) {
    return json({ error: 'forbidden' }, { status: 403 });
  }
  const db = platform?.env?.DB;
  if (!db) return json(wantJourneys ? { rows: [] } : {});

  // Journey export: the opt-in rows of the study log (those carrying a sid). Capped —
  // a researcher pulls this occasionally as CSV, so the read cost is bounded.
  // ponytail: LIMIT 20000; page by `id` if the event ever outgrows one pull.
  if (wantJourneys) {
    const { results } = await db.prepare(SELECT_JOURNEYS).bind(20000).all();
    return json({ rows: results ?? [] });
  }

  // Nationality cross-tab: nat:<type>:<id>:<code> rows -> {type:{id:{code:n}}}.
  if (wantNat) {
    const { results } = await db.prepare(SELECT_COUNTERS).bind(...prefixRange('nat:')).all();
    return json(natTotals((results ?? []).map((r) => [r.k, r.n])));
  }

  // ~50 rows either way; the whole point of storing aggregates instead of an
  // event log is that this stays a trivial read.
  const { results } = await db
    .prepare(SELECT_COUNTERS)
    .bind(...prefixRange(wantEvents ? 'ev:' : 'count:'))
    .all();
  const rows = (results ?? []).map((r) => [r.k, r.n]);
  // The spotlight only needs to drift a few times a day; let the edge absorb the reads.
  return json(totals(rows, wantEvents), {
    headers: { 'cache-control': 'public, max-age=60, s-maxage=300' }
  });
}
