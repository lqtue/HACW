// Runs the real statements against a real SQLite. D1 is SQLite, so if the upsert
// arithmetic or the LIKE prefixes are wrong, this fails here instead of silently
// under-counting during the event.
import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  UPSERT_COUNTER,
  SELECT_COUNTERS,
  SELECT_PASSPORT,
  UPSERT_PASSPORT,
  SELECT_FLAGGED,
  INSERT_CHUNK,
  SELECT_JOURNEYS,
  prefixRange
} from './sql.js';
import { tally, totals, natTotals, eventRows } from './counts.js';
import { mergeSnapshots } from './backup.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(join(root, 'schema.sql'), 'utf8'));

const bump = (k, n, at = Date.now()) => db.prepare(UPSERT_COUNTER).run(k, n, at, n, at);
const read = (like) => db.prepare(SELECT_COUNTERS).all(...prefixRange(like.replace('%', ''))).map((r) => [r.k, r.n]);

// --- counters accumulate instead of overwriting (the whole reason for D1) ---
bump('count:chua-cau', 1);
bump('count:chua-cau', 2);
bump('count:nha-co-tan-ky', 1);
assert.deepEqual(totals(read('count:%')), { 'chua-cau': 3, 'nha-co-tan-ky': 1 });

// --- events live in the same table but never leak into the spotlight numbers ---
bump('ev:gps_far:chua-cau', 1);
bump('ev:gps_far_m:chua-cau', 90);
bump('ev:redeem', 1);
assert.deepEqual(totals(read('count:%')), { 'chua-cau': 3, 'nha-co-tan-ky': 1 }, 'events excluded');
assert.deepEqual(totals(read('ev:%'), true), {
  'gps_far:chua-cau': 1,
  'gps_far_m:chua-cau': 90,
  redeem: 1
});

// --- a whole POST body, end to end: queue -> tally -> upserts -> GET ---
for (const [k, n] of Object.entries(
  tally([{ id: 'a' }, { id: 'a' }, { t: 'gps_far', id: 'a', n: 40 }, { t: 'junk' }])
)) {
  bump(k, n);
}
assert.equal(totals(read('count:%')).a, 2);
assert.equal(totals(read('ev:%'), true)['gps_far_m:a'], 40);

// --- passports: second PUT updates the row, and merging never drops a stamp ---
const put = (pid, snap, flags = 0, owner = null) => {
  const [text, at] = [JSON.stringify(snap), Date.now()];
  db.prepare(UPSERT_PASSPORT).run(pid, text, at, flags, owner, text, at, flags, owner);
};
const get = (pid) => {
  const row = db.prepare(SELECT_PASSPORT).get(pid);
  return row ? JSON.parse(row.snapshot) : null;
};
const owner = (pid) => db.prepare(SELECT_PASSPORT).get(pid)?.owner ?? null;

const first = { v: 1, pid: 'AB12CD34', stamps: [{ id: 'a', at: 'x', pts: 10 }], redeemed: [] };
put('AB12CD34', first);
const second = { v: 1, pid: 'AB12CD34', stamps: [{ id: 'b', at: 'y', pts: 15 }], redeemed: ['tour-a'] };
put('AB12CD34', mergeSnapshots(get('AB12CD34'), second));

const stored = get('AB12CD34');
assert.deepEqual(stored.stamps.map((s) => s.id).sort(), ['a', 'b'], 'the earlier stamp survives');
assert.deepEqual(stored.redeemed, ['tour-a']);
assert.equal(db.prepare('SELECT COUNT(*) AS c FROM passports').get().c, 1, 'upsert, not insert');
assert.equal(get('ZZZZZZZZ'), null, 'unknown code reads as missing, not as an error');

// --- one ticket, one active device: the owner is stored and transfers on a claim ---
const snap = { v: 1, pid: 'TICKET01', stamps: [{ id: 'a', at: 'x', pts: 10 }], redeemed: [] };
put('TICKET01', snap, 0, 'device-a');
assert.equal(owner('TICKET01'), 'device-a', 'first writer claims the ticket');
put('TICKET01', snap, 0, 'device-b'); // an explicit claim (the endpoint gates this)
assert.equal(owner('TICKET01'), 'device-b', 'a claim transfers the ticket');
assert.deepEqual(get('TICKET01').stamps.map((s) => s.id), ['a'], 'a transfer keeps the stamps');

// --- the review list: only flagged rows, worst first, clean passports invisible ---
assert.deepEqual(db.prepare(SELECT_FLAGGED).all(), [], 'a clean passport is not on the list');
put('FF11FF11', first, 3);
put('GG22GG22', first, 1);
put('AB12CD34', first, 0); // re-backing-up a clean passport clears its old flags
const review = db.prepare(SELECT_FLAGGED).all();
assert.deepEqual(review.map((r) => [r.pid, r.flags]), [['FF11FF11', 3], ['GG22GG22', 1]]);

// --- nationality cross-tab rides the same counters table, read by prefix ---
for (const [k, n] of Object.entries(
  tally([
    { t: 'checkin', id: 'chua-cau', nat: 'ko' },
    { t: 'checkin', id: 'chua-cau', nat: 'ko' },
    { t: 'welcome', nat: 'ja' }
  ])
)) {
  bump(k, n);
}
assert.deepEqual(
  natTotals(read('nat:%')),
  { checkin: { 'chua-cau': { ko: 2 } }, welcome: { _: { ja: 1 } } },
  'nat: keys accumulate and read back as the cross-tab'
);
assert.deepEqual(totals(read('count:%')).a, 2, 'plain counters untouched by nat crossing');

// --- the counter read is an index range, not a LIKE scan; the range is exact ---
bump('count;leak', 1); // ';' is the byte after ':' — must NOT be inside the count: range
assert.ok(!('leak' in totals(read('count:%'))), 'range upper bound excludes the next byte');
assert.equal(
  db.prepare('EXPLAIN QUERY PLAN ' + SELECT_COUNTERS).get(...prefixRange('count:')).detail.startsWith('SEARCH'),
  true,
  'counter read uses the primary-key index'
);

// --- study log: one row per accepted event, server clock, exactly-once on retry ---
const T0 = Date.parse('2026-08-28T15:00:00+07:00'); // day 1 pm: nudge off
const real = new Set(['chua-cau', 'nha-co-tan-ky']);
const batch = [
  { eid: 'aa11bb22cc33', t: 'checkin', id: 'chua-cau', nat: 'ko', spot: 1, sid: 'abc12345', seq: 0, at: 1000, tk: 3 },
  { eid: 'aa11bb22cc34', t: 'checkin', id: 'nha-co-tan-ky', nat: 'ko', sid: 'abc12345', seq: 1, at: 2000 },
  { eid: 'aa11bb22cc35', t: 'gps_far', id: 'chua-cau', n: 90 }, // no sid: logged, not a journey row
  { eid: 'aa11bb22cc36', t: 'checkin', id: 'not-real' }, // junk dest: dropped
  { t: 'checkin', id: 'chua-cau' } // no eid: dropped (would double-log on retry)
];
// one POST = one chunk row; the `events` view unpacks it and dedupes by eid
const ins = (rows, pid = 'ABCDEFGH') => db.prepare(INSERT_CHUNK).run(rows[0]?.ts ?? 0, pid, JSON.stringify(rows));
ins(eventRows(batch, real, T0));
ins(eventRows(batch, real, T0 + 5000)); // the client re-sends the same chunk
assert.equal(db.prepare('SELECT COUNT(*) AS c FROM chunks').get().c, 2, 'two POSTs = two rows written');
const all = db.prepare('SELECT * FROM events ORDER BY id').all();
assert.equal(all.length, 3, 'one event per accepted event, none twice');
assert.ok(all.every((r) => r.pid === 'ABCDEFGH'), 'device id rides the chunk');
assert.equal(all[0].at, 1000, 'client clock kept alongside the server one');
assert.deepEqual(
  all.map((r) => [r.day, r.half, r.nudge, r.t, r.dest, r.spot, r.nat, r.n, r.sid, r.seq]),
  [
    ['2026-08-28', 'pm', 0, 'checkin', 'chua-cau', 1, 'ko', null, 'abc12345', 0],
    ['2026-08-28', 'pm', 0, 'checkin', 'nha-co-tan-ky', null, 'ko', null, 'abc12345', 1],
    ['2026-08-28', 'pm', 0, 'gps_far', 'chua-cau', null, null, 90, null, null]
  ]
);
assert.ok(all.every((r) => r.ts === T0), 'server clock, not the phone\'s `at`');
assert.deepEqual(all.map((r) => r.tk), [3, null, null], 'ticket type stored per row');
const got = db.prepare(SELECT_JOURNEYS).all(10);
assert.deepEqual(
  got.map((r) => [r.seq, r.dest]).sort((a, b) => a[0] - b[0]),
  [[0, 'chua-cau'], [1, 'nha-co-tan-ky']],
  'journey export = the sid-carrying rows only'
);
// the analysis query the schema exists for
const per = db.prepare("SELECT day, half, nudge, dest, COUNT(*) AS c FROM events WHERE t='checkin' GROUP BY 1,2,3,4").all();
assert.equal(per.length, 2);
// GPS trace: a pos event with a fix reads back as numbers through the view
ins(eventRows([{ eid: 'dd11bb22cc99', t: 'pos', n: 12, at: 5, lat: 15.8771, lng: 108.3266, acc: 12 }], real, T0));
const pos = db.prepare("SELECT lat, lng, acc, pid FROM events WHERE t='pos'").get();
assert.deepEqual(pos, { lat: 15.8771, lng: 108.3266, acc: 12, pid: 'ABCDEFGH' });
assert.ok(
  db.prepare('EXPLAIN QUERY PLAN ' + SELECT_FLAGGED).all().some((r) => r.detail.includes('passports_flagged')),
  'review list uses the partial index'
);

console.log('sql.test.js ok');
