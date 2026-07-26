// Passport backup/restore — the safety net for a cleared browser or a lost phone.
// Anonymous: the only key is the 8-char code the app generated on the device.
// Same D1 database as the check-in counter (binding: DB). Schema: schema.sql.
//
//   PUT /api/passport   { v, pid, stamps[], redeemed[] }
//   GET /api/passport?pid=XXXXXXXX -> the stored snapshot
//
// ponytail: no auth beyond knowing the code, and codes are guessable at 32^8.
// Fine for stamp collections (no PII, worst case someone gifts themselves stamps).
// Anything with real value needs a signed token instead.

import { json } from '@sveltejs/kit';
import { mergeSnapshots } from '$lib/backup.js';
import { flagPassport } from '$lib/fraud.js';
import destinations from '$lib/data/destinations.json';
import { SELECT_PASSPORT, UPSERT_PASSPORT, SELECT_FLAGGED } from '$lib/sql.js';

export const prerender = false;

const MAX_BYTES = 8192;
const MAX_ITEMS = 100; // 25 sites + 5 tours + 4 tiers; anything bigger is junk
const validPid = (pid) => typeof pid === 'string' && /^[0-9A-HJKMNP-TV-Z]{8}$/.test(pid);

export async function PUT({ request, platform }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad json' }, { status: 400 });
  }
  if (!validPid(body?.pid)) return json({ error: 'bad pid' }, { status: 400 });
  if (!Array.isArray(body?.stamps)) return json({ error: 'stamps[] required' }, { status: 400 });
  if (body.stamps.length > MAX_ITEMS || (body.redeemed?.length ?? 0) > MAX_ITEMS) {
    return json({ error: 'too many' }, { status: 400 });
  }
  const db = platform?.env?.DB;
  if (!db) return json({ ok: false, stored: false });

  const row = await db.prepare(SELECT_PASSPORT).bind(body.pid).first();
  const merged = mergeSnapshots(row ? JSON.parse(row.snapshot) : null, body);
  const text = JSON.stringify(merged);
  if (text.length > MAX_BYTES) return json({ error: 'too large' }, { status: 413 });
  // Advisory only — recorded for the organizer and the staff member at the
  // counter, never used to refuse a backup or a voucher. See src/lib/fraud.js.
  const flags = flagPassport(merged.stamps, destinations).length;
  const now = Date.now();
  await db.prepare(UPSERT_PASSPORT).bind(body.pid, text, now, flags, text, now, flags).run();
  return json({ ok: true, stamps: merged.stamps.length });
}

export async function GET({ url, platform }) {
  // Organizer review list. Codes are masked: knowing a full pid is enough to pull
  // that passport, and this endpoint is only protected by a client-side staff code.
  if (url.searchParams.has('flagged')) {
    const db = platform?.env?.DB;
    if (!db) return json([]);
    const { results } = await db.prepare(SELECT_FLAGGED).all();
    return json(
      (results ?? []).map((r) => ({
        pid: `${r.pid.slice(0, 2)}••••${r.pid.slice(-2)}`,
        flags: r.flags,
        updated: r.updated
      }))
    );
  }

  const pid = url.searchParams.get('pid') ?? '';
  if (!validPid(pid)) return json({ error: 'bad pid' }, { status: 400 });
  const db = platform?.env?.DB;
  if (!db) return json({ error: 'no storage' }, { status: 404 });
  const row = await db.prepare(SELECT_PASSPORT).bind(pid).first();
  if (!row) return json({ error: 'not found' }, { status: 404 });
  return json(JSON.parse(row.snapshot));
}
