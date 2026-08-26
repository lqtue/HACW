// Passport backup/restore — the safety net for a cleared browser or a lost phone.
// Anonymous: the only key is the 8-char code the app generated on the device.
// Same D1 database as the check-in counter (binding: DB). Schema: schema.sql.
//
//   PUT /api/passport   { v, pid, did, claim?, stamps[], redeemed[] }
//   GET /api/passport?pid=XXXXXXXX -> the stored snapshot
//
// One ticket, one active device. A ticket-derived pid is shared by anyone holding
// the same ticket, so the row records which device (`did`, random per install)
// owns it. A write from another device is refused with 409 unless it sets
// `claim` — which the app only does right after the visitor scanned the ticket
// themselves. So recovery on a new phone works (it takes the ticket over, and the
// old phone learns it lost it on its next write), while two people collecting in
// parallel on one shared ticket does not.
//
// ponytail: no auth beyond knowing the code. A ticket-derived code is a hash of
// a *sequential* serial (see codeFromTicket), so the real keyspace is the serial
// range, not 32^8: someone can enumerate passports (no PII in them) and, with
// `claim`, take a ticket over — the victim's phone then gets 409 and stops
// syncing. Tolerated for stamp collections; anything with value needs a signed
// token, and the UI must offer "scan your ticket again" as the way back.

import { json } from '@sveltejs/kit';
import { mergeSnapshots, isValidCode } from '$lib/backup.js';
import { isSameOrigin } from '$lib/guard.js';
import { flagPassport } from '$lib/fraud.js';
import destinations from '$lib/data/destinations.json';
import { SELECT_PASSPORT, UPSERT_PASSPORT, SELECT_FLAGGED } from '$lib/sql.js';

export const prerender = false;

const MAX_BYTES = 8192;
const MAX_ITEMS = 100; // 25 sites + 5 tours + 4 tiers; anything bigger is junk

export async function PUT({ request, platform }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad json' }, { status: 400 });
  }
  if (!isValidCode(body?.pid)) return json({ error: 'bad pid' }, { status: 400 });
  if (!Array.isArray(body?.stamps)) return json({ error: 'stamps[] required' }, { status: 400 });
  if (body.stamps.length > MAX_ITEMS || (body.redeemed?.length ?? 0) > MAX_ITEMS) {
    return json({ error: 'too many' }, { status: 400 });
  }
  const db = platform?.env?.DB;
  if (!db) return json({ ok: false, stored: false });

  const row = await db.prepare(SELECT_PASSPORT).bind(body.pid).first();
  // ticket lock: an unclaimed row is claimed by this device; a foreign one is
  // refused unless this write is an explicit claim (see the header comment).
  // A write with NO did counts as foreign too — otherwise omitting the field is
  // the bypass.
  const did = typeof body?.did === 'string' && body.did.length <= 32 ? body.did : '';
  const held = row?.owner ?? '';
  if (held && held !== did && !body?.claim) {
    return json({ error: 'ticket-in-use' }, { status: 409 });
  }
  const owner = did || held || null;
  const merged = mergeSnapshots(row ? JSON.parse(row.snapshot) : null, body);
  const text = JSON.stringify(merged);
  if (text.length > MAX_BYTES) return json({ error: 'too large' }, { status: 413 });
  // Advisory only — recorded for the organizer and the staff member at the
  // counter, never used to refuse a backup or a voucher. See src/lib/fraud.js.
  const flags = flagPassport(merged.stamps, destinations).length;
  const now = Date.now();
  await db.prepare(UPSERT_PASSPORT).bind(body.pid, text, now, flags, owner, text, now, flags, owner).run();
  return json({ ok: true, stamps: merged.stamps.length });
}

export async function GET({ url, platform, request }) {
  // Organizer review list. Pids are masked before they leave, and the UI hides
  // this behind the client staff code — but that gate is cosmetic, so the endpoint
  // itself refuses any cross-site or scripted read (Sec-Fetch-Site, see guard.js).
  if (url.searchParams.has('flagged')) {
    if (!isSameOrigin(request.headers.get('sec-fetch-site'))) {
      return json({ error: 'forbidden' }, { status: 403 });
    }
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
  if (!isValidCode(pid)) return json({ error: 'bad pid' }, { status: 400 });
  const db = platform?.env?.DB;
  if (!db) return json({ error: 'no storage' }, { status: 404 });
  const row = await db.prepare(SELECT_PASSPORT).bind(pid).first();
  if (!row) return json({ error: 'not found' }, { status: 404 });
  return json(JSON.parse(row.snapshot));
}
