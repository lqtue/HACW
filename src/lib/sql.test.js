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
  SELECT_FLAGGED
} from './sql.js';
import { tally, totals } from './counts.js';
import { mergeSnapshots } from './backup.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(join(root, 'schema.sql'), 'utf8'));

const bump = (k, n, at = Date.now()) => db.prepare(UPSERT_COUNTER).run(k, n, at, n, at);
const read = (like) => db.prepare(SELECT_COUNTERS).all(like).map((r) => [r.k, r.n]);

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
const put = (pid, snap, flags = 0) => {
  const [text, at] = [JSON.stringify(snap), Date.now()];
  db.prepare(UPSERT_PASSPORT).run(pid, text, at, flags, text, at, flags);
};
const get = (pid) => {
  const row = db.prepare(SELECT_PASSPORT).get(pid);
  return row ? JSON.parse(row.snapshot) : null;
};

const first = { v: 1, pid: 'AB12CD34', stamps: [{ id: 'a', at: 'x', pts: 10 }], redeemed: [] };
put('AB12CD34', first);
const second = { v: 1, pid: 'AB12CD34', stamps: [{ id: 'b', at: 'y', pts: 15 }], redeemed: ['tour-a'] };
put('AB12CD34', mergeSnapshots(get('AB12CD34'), second));

const stored = get('AB12CD34');
assert.deepEqual(stored.stamps.map((s) => s.id).sort(), ['a', 'b'], 'the earlier stamp survives');
assert.deepEqual(stored.redeemed, ['tour-a']);
assert.equal(db.prepare('SELECT COUNT(*) AS c FROM passports').get().c, 1, 'upsert, not insert');
assert.equal(get('ZZZZZZZZ'), null, 'unknown code reads as missing, not as an error');

// --- the review list: only flagged rows, worst first, clean passports invisible ---
assert.deepEqual(db.prepare(SELECT_FLAGGED).all(), [], 'a clean passport is not on the list');
put('FF11FF11', first, 3);
put('GG22GG22', first, 1);
put('AB12CD34', first, 0); // re-backing-up a clean passport clears its old flags
const review = db.prepare(SELECT_FLAGGED).all();
assert.deepEqual(review.map((r) => [r.pid, r.flags]), [['FF11FF11', 3], ['GG22GG22', 1]]);

console.log('sql.test.js ok');
