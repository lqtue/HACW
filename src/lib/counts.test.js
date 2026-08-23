import assert from 'node:assert';
import { countKey, eventKey, tally, totals, natTotals, journeyRows, MAX_EVENTS } from './counts.js';

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

// --- heatmap cells: geohash, optionally -locale; bounded, bypasses the site guard ---
assert.deepEqual(tally([{ t: 'cell', id: 'w3gv5k2' }]), { 'ev:cell:w3gv5k2': 1 }, 'a bare cell counts');
assert.deepEqual(
  tally([{ t: 'cell', id: 'w3gv5k2-ko' }], real),
  { 'ev:cell:w3gv5k2-ko': 1 },
  'a cell+locale is not a dest id — it bypasses the allowlist'
);
assert.deepEqual(tally([{ t: 'cell', id: 'w3gvaik' }]), {}, 'a/i/l/o are not geohash chars — rejected');
assert.deepEqual(tally([{ t: 'cell', id: 'w3gv5k2-KO' }]), {}, 'locale suffix is lowercase');
assert.deepEqual(tally([{ t: 'cell' }]), {}, 'a cell with no id is dropped');

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
// nat: cross-tab rows must never leak into the public counts or the event tallies
assert.deepEqual(
  totals([['count:a', 3], ['nat:checkin:a:ko', 1], ['ev:redeem', 2]]),
  { a: 3 },
  'count path takes only count: rows'
);
assert.deepEqual(
  totals([['ev:redeem', 2], ['nat:welcome:_:ko', 9]], true),
  { redeem: 2 },
  'event path takes only ev: rows'
);

// Round-trip: what tally() writes is what totals() reads back.
assert.deepEqual(totals(Object.entries(tally([{ id: 'a' }, { id: 'a' }, { id: 'b' }]))), {
  a: 2,
  b: 1
});

// --- nationality cross-tab: a nat code tags whitelisted behaviour, alongside the
//     plain counter (which must be untouched so the spotlight is unaffected) ---
assert.deepEqual(
  tally([{ t: 'checkin', id: 'chua-cau', nat: 'ko' }], real),
  { 'count:chua-cau': 1, 'nat:checkin:chua-cau:ko': 1 },
  'check-in also bumps a nationality-crossed key'
);
assert.deepEqual(
  tally([{ t: 'welcome', nat: 'ja' }]),
  { 'ev:welcome': 1, 'nat:welcome:_:ja': 1 },
  'site-less funnel step crosses under id "_"'
);
assert.deepEqual(
  tally([{ t: 'checkin', id: 'chua-cau', nat: 'BAD-CODE' }], real),
  { 'count:chua-cau': 1 },
  'a bad nat code is ignored, plain counter still bumps'
);
assert.deepEqual(
  tally([{ t: 'lang', id: 'ko', nat: 'ko' }]),
  { 'ev:lang:ko': 1 },
  'lang/pick are the signal, not crossed by it'
);
assert.deepEqual(
  natTotals([
    ['nat:checkin:chua-cau:ko', 5],
    ['nat:checkin:chua-cau:ja', 2],
    ['nat:welcome:_:ko', 9],
    ['count:chua-cau', 7]
  ]),
  { checkin: { 'chua-cau': { ko: 5, ja: 2 } }, welcome: { _: { ko: 9 } } },
  'nat rows fold into {type:{id:{code:n}}}, ignoring non-nat rows'
);

// --- journey rows: only sid-carrying events, dest kept only for real sites ---
const jr = journeyRows(
  [
    { t: 'checkin', id: 'chua-cau', nat: 'ko', sid: 'a1b2c3d4', seq: 0, at: 1000 },
    { t: 'scan', sid: 'a1b2c3d4', seq: 1, at: 1001 },
    { t: 'checkin', id: 'not-real', sid: 'a1b2c3d4', seq: 2, at: 1002 },
    { t: 'checkin', id: 'chua-cau', at: 1003 } // no sid -> not a journey row
  ],
  real
);
assert.deepEqual(jr, [
  { sid: 'a1b2c3d4', seq: 0, nat: 'ko', t: 'checkin', dest: 'chua-cau', ts: 1000 },
  { sid: 'a1b2c3d4', seq: 1, nat: null, t: 'scan', dest: null, ts: 1001 },
  { sid: 'a1b2c3d4', seq: 2, nat: null, t: 'checkin', dest: null, ts: 1002 }
]);
assert.deepEqual(journeyRows([{ t: 'checkin', id: 'chua-cau', sid: 'nope!' }]), [], 'bad sid is not logged');

console.log('counts.test.js ok');
