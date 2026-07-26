import assert from 'node:assert';
import {
  mergeStamps,
  mergeSnapshots,
  encodeSnapshot,
  decodeSnapshot,
  normalizeCode,
  isValidCode
} from './backup.js';

// --- merge never loses a stamp ---
const local = [{ id: 'a', at: '2026-06-01T10:00:00Z', pts: 10 }];
const remote = [
  { id: 'a', at: '2026-06-01T09:00:00Z', pts: 25 },
  { id: 'b', at: '2026-06-02T08:00:00Z', pts: 15 }
];
const merged = mergeStamps(local, remote);
assert.equal(merged.length, 2);
assert.equal(merged[0].at, '2026-06-01T09:00:00Z', 'earliest visit wins');
assert.equal(merged[0].pts, 25, 'best points win');
assert.equal(mergeStamps(local, []).length, 1, 'empty restore keeps local stamps');
assert.equal(mergeStamps(local, null).length, 1);
assert.equal(local[0].pts, 10, 'input is not mutated');
assert.equal(mergeStamps([], [{ at: 'x' }]).length, 0, 'stamps without an id are dropped');

// --- server-side snapshot merge (PUT /api/passport): two phones, one code ---
const stored = { v: 1, pid: 'AB12CD34', stamps: local, redeemed: ['tour-a'] };
const incoming = { v: 1, pid: 'AB12CD34', stamps: remote, redeemed: ['tour-b'] };
const both = mergeSnapshots(stored, incoming);
assert.deepEqual(
  both.stamps.map((s) => s.id).sort(),
  ['a', 'b'],
  'neither phone erases the other'
);
assert.deepEqual(both.redeemed, ['tour-a', 'tour-b'], 'redeemed sets union');
assert.deepEqual(mergeSnapshots(stored, incoming).redeemed, both.redeemed, 'no double-add');
assert.equal(mergeSnapshots(null, incoming).stamps.length, 2, 'first ever backup has no prev');
assert.equal(mergeSnapshots(stored, { pid: 'AB12CD34' }).stamps.length, 1, 'empty PUT removes nothing');
assert.equal(both.pid, 'AB12CD34');

// --- backup link round-trip (this is the no-server recovery path) ---
const snap = { v: 1, pid: 'AB12CD34', stamps: remote, redeemed: ['tier-dao-pho'] };
const link = `https://x.dev/HACW/passport#r=${encodeSnapshot(snap)}`;
assert.deepEqual(decodeSnapshot(link), snap);
assert.deepEqual(decodeSnapshot(encodeSnapshot(snap)), snap, 'raw payload also decodes');
assert.equal(decodeSnapshot('#r=not-base64!!'), null);
assert.equal(decodeSnapshot(''), null);
assert.equal(decodeSnapshot(encodeSnapshot({ v: 1 })), null, 'a snapshot without stamps is rejected');

// diacritics must survive the encoding
const vi = { v: 1, stamps: [{ id: 'chùa-cầu', at: 'x', pts: 10 }] };
assert.equal(decodeSnapshot(encodeSnapshot(vi)).stamps[0].id, 'chùa-cầu');

// --- recovery codes ---
assert.equal(normalizeCode('ab12-cd34'), 'AB12CD34');
assert.ok(isValidCode(normalizeCode('ab12 cd34')));
assert.ok(!isValidCode('AB12CD3'), 'too short');
assert.ok(!isValidCode('AB12CD3I'), 'I is not in the alphabet');

console.log('backup.test.js ok');
