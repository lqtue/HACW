// The app's analytics sink (there is no Google Analytics; this is it).
// Counts check-ins per destination plus a few event tallies in the D1 database
// bound as DB (Pages project → Settings → Bindings → D1). Schema: schema.sql.
//
//   POST /api/checkin  { pid, events: [{ t, id, n, at }] }
//   GET  /api/checkin           -> { "<destId>": <count> }   (drives the spotlight)
//   GET  /api/checkin?events=1  -> { "<type>": <count>, "gps_far:<id>": <count> }
//
// Must live here rather than in functions/: adapter-cloudflare emits a _worker.js,
// and Cloudflare Pages ignores the functions/ directory whenever that file exists.
// Validation and key layout are in $lib/counts.js so node can test them.

import { json } from '@sveltejs/kit';
import { tally, totals } from '$lib/counts.js';
import { UPSERT_COUNTER, SELECT_COUNTERS } from '$lib/sql.js';

export const prerender = false;

export async function POST({ request, platform }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad json' }, { status: 400 });
  }
  if (!Array.isArray(body?.events)) return json({ error: 'events[] required' }, { status: 400 });

  // Tally in memory first: one row per key per request instead of per event.
  const bump = tally(body.events);
  const db = platform?.env?.DB;
  if (db && Object.keys(bump).length) {
    const now = Date.now();
    // Atomic increments — the reason for moving off KV. No shards, no lost updates.
    await db.batch(
      Object.entries(bump).map(([k, n]) => db.prepare(UPSERT_COUNTER).bind(k, n, now, n, now))
    );
  }
  return json({ ok: true, counted: Object.values(bump).reduce((a, b) => a + b, 0) });
}

export async function GET({ url, platform }) {
  const db = platform?.env?.DB;
  if (!db) return json({});
  const wantEvents = url.searchParams.has('events');
  // ~50 rows either way; the whole point of storing aggregates instead of an
  // event log is that this stays a trivial read.
  const { results } = await db
    .prepare(SELECT_COUNTERS)
    .bind(wantEvents ? 'ev:%' : 'count:%')
    .all();
  const rows = (results ?? []).map((r) => [r.k, r.n]);
  // The spotlight only needs to drift a few times a day; let the edge absorb the reads.
  return json(totals(rows, wantEvents), {
    headers: { 'cache-control': 'public, max-age=60, s-maxage=300' }
  });
}
