import assert from 'node:assert';
import { countKey, eventKey, tally, totals, MAX_EVENTS } from './counts.js';

// --- key layout ---
assert.equal(countKey('chua-cau'), 'count:chua-cau');
assert.equal(eventKey('gps_far', 'chua-cau'), 'ev:gps_far:chua-cau');
assert.equal(eventKey('redeem'), 'ev:redeem');

// --- what the endpoint accepts (this is the write path: junk here becomes table rows) ---
assert.deepEqual(tally([{ t: 'checkin', id: 'chua-cau' }]), { 'count:chua-cau': 1 });
assert.deepEqual(tally([{ id: 'chua-cau' }]), { 'count:chua-cau': 1 }, 'no type = check-in');
assert.deepEqual(
  tally([{ t: 'checkin', id: 'a' }, { t: 'checkin', id: 'a' }]),
  { 'count:a': 2 },
  'repeats collapse into one upsert of +2'
);
assert.deepEqual(tally([{ t: 'gps_far', id: 'chua-cau', n: 90 }]), {
  'ev:gps_far:chua-cau': 1,
  'ev:gps_far_m:chua-cau': 90
});
assert.deepEqual(
  tally([{ t: 'gps_far', id: 'a', n: 80 }, { t: 'gps_far', id: 'a', n: 120 }]),
  { 'ev:gps_far:a': 2, 'ev:gps_far_m:a': 200 },
  'metres sum, so gps_far_m / gps_far = average overshoot = the radius to use'
);
assert.deepEqual(tally([{ t: 'gps_far', id: 'a' }]), { 'ev:gps_far:a': 1 }, 'no distance, no sum');
assert.deepEqual(
  tally([{ t: 'gps_far', id: 'a', n: 9e9 }]),
  { 'ev:gps_far:a': 1, 'ev:gps_far_m:a': 5000 },
  'a bogus distance cannot skew the average without limit'
);
assert.deepEqual(tally([{ t: 'redeem' }]), { 'ev:redeem': 1 }, 'site-less events still count');
assert.deepEqual(tally([{ t: 'checkin' }]), {}, 'a check-in with no site is dropped');
assert.deepEqual(tally([{ t: 'drop_tables', id: 'a' }]), {}, 'unknown type is dropped');
assert.deepEqual(tally([{ t: 'checkin', id: "a'; DROP TABLE counters--" }]), {}, 'ids are not SQL');
assert.deepEqual(tally([{ t: 'checkin', id: 'ev:redeem' }]), {}, 'id cannot forge another key');
assert.deepEqual(tally([{ t: 'checkin', id: 'A'.repeat(64) }]), {}, 'oversized id is dropped');
assert.deepEqual(tally(null), {}, 'no events is not a crash');
assert.deepEqual(
  tally([{ t: 'gps_fail', id: 'a' }, { t: 'nope' }, { t: 'quiz_wrong', id: 'a' }]),
  { 'ev:gps_fail:a': 1, 'ev:quiz_wrong:a': 1 },
  'one bad entry does not discard the rest of the queue'
);

// --- allowlist: only real sites become rows (the quota-flood guard) ---
const real = new Set(['chua-cau', 'nha-co-tan-ky']);
assert.deepEqual(
  tally([{ t: 'checkin', id: 'chua-cau' }], real),
  { 'count:chua-cau': 1 },
  'a real site still counts'
);
assert.deepEqual(
  tally([{ t: 'checkin', id: 'not-a-place' }], real),
  {},
  'a well-formed but unknown id mints no row'
);
assert.deepEqual(
  tally([{ t: 'gps_far', id: 'junk', n: 90 }], real),
  {},
  'per-site events are dropped for unknown ids too — no ev:gps_far:junk row'
);
assert.deepEqual(
  tally([{ t: 'checkin', id: 'junk' }, { t: 'checkin', id: 'chua-cau' }], real),
  { 'count:chua-cau': 1 },
  'junk is dropped without discarding the real check-in beside it'
);
assert.deepEqual(
  tally([{ t: 'redeem' }], real),
  { 'ev:redeem': 1 },
  'site-less events are bounded keys, unaffected by the allowlist'
);

// --- language study: lang/pick carry a language code, not a dest id ---
assert.deepEqual(
  tally([{ t: 'lang', id: 'ko' }, { t: 'pick', id: 'en' }]),
  { 'ev:lang:ko': 1, 'ev:pick:en': 1 },
  'device locale + chosen language count under their own keys'
);
assert.deepEqual(
  tally([{ t: 'lang', id: 'ko' }], real),
  { 'ev:lang:ko': 1 },
  'a language code is NOT a dest id — it bypasses the site allowlist'
);
assert.deepEqual(tally([{ t: 'pick', id: 'other' }]), { 'ev:pick:other': 1 }, "'other' is a valid code");
assert.deepEqual(tally([{ t: 'lang', id: 'zh-cn' }]), {}, 'a full BCP-47 tag is rejected — subtag only');
assert.deepEqual(tally([{ t: 'lang' }]), {}, 'a language event with no code is dropped');
assert.deepEqual(tally([{ t: 'lang', id: 'DROP' }]), {}, 'codes are lowercase letters, not SQL');

// A replayed offline queue is capped, so one phone can't spend the whole day's writes.
const flood = Array.from({ length: 500 }, () => ({ t: 'checkin', id: 'a' }));
assert.deepEqual(tally(flood), { 'count:a': MAX_EVENTS });

// --- read path: rows straight from `SELECT k, n FROM counters` ---
const rows = [
  ['count:chua-cau', 10],
  ['count:nha-co-tan-ky', 1],
  ['ev:gps_far:chua-cau', 3],
  ['ev:gps_far_m:chua-cau', 240],
  ['ev:redeem', 2]
];
assert.deepEqual(totals(rows), { 'chua-cau': 10, 'nha-co-tan-ky': 1 });
assert.deepEqual(totals(rows, true), {
  'gps_far:chua-cau': 3,
  'gps_far_m:chua-cau': 240,
  redeem: 2
});
assert.deepEqual(totals([]), {});

// Round-trip: what tally() writes is what totals() reads back.
assert.deepEqual(totals(Object.entries(tally([{ id: 'a' }, { id: 'a' }, { id: 'b' }]))), {
  a: 2,
  b: 1
});

console.log('counts.test.js ok');
