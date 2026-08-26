import assert from 'node:assert';
import { countKey, eventKey, tally, totals, natTotals, eventRows, MAX_EVENTS } from './counts.js';

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
assert.deepEqual(tally([{ t: 'cell', id: 'w6v45k2' }]), { 'ev:cell:w6v45k2': 1 }, 'a bare cell counts');
assert.deepEqual(
  tally([{ t: 'cell', id: 'w6v45k2-ko' }], real),
  { 'ev:cell:w6v45k2-ko': 1 },
  'a cell+locale is not a dest id — it bypasses the allowlist'
);
assert.deepEqual(tally([{ t: 'cell', id: 'w6v4aik' }]), {}, 'a/i/l/o are not geohash chars — rejected');
assert.deepEqual(tally([{ t: 'cell', id: 'w6v45k2-KO' }]), {}, 'locale suffix is lowercase');
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
const T0 = Date.parse('2026-08-29T09:00:00+07:00'); // day 2 am: nudge off
const jr = eventRows(
  [
    { eid: 'a1b2c3d4e5f6', t: 'checkin', id: 'chua-cau', nat: 'ko', spot: true, sid: 'a1b2c3d4', seq: 0, at: 1000, tk: 5 },
    { eid: 'a1b2c3d4e5f7', t: 'scan', at: 1001 },
    { eid: 'a1b2c3d4e5f8', t: 'checkin', id: 'not-real', at: 1002 }, // junk dest -> dropped
    { eid: 'a1b2c3d4e5f9', t: 'view', id: 'explore', nat: 'ja' },
    { eid: 'a1b2c3d4e5fa', t: 'cell', id: 'w6v434x-ko' },
    { eid: 'a1b2c3d4e5fb', t: 'pick', id: 'ko' },
    { eid: 'a1b2c3d4e5fc', t: 'quiz_wrong', id: 'chua-cau', n: 2, sid: 'nope!' }, // bad sid -> row, no sid
    { t: 'checkin', id: 'chua-cau', at: 1003 } // no eid -> dropped
  ],
  real,
  T0
);
const unitOf = { ts: T0, day: '2026-08-29', half: 'am', nudge: 0, tk: null };
assert.deepEqual(jr, [
  { eid: 'a1b2c3d4e5f6', ...unitOf, tk: 5, t: 'checkin', dest: 'chua-cau', spot: 1, nat: 'ko', n: null, sid: 'a1b2c3d4', seq: 0 },
  { eid: 'a1b2c3d4e5f7', ...unitOf, t: 'scan', dest: null, spot: null, nat: null, n: null, sid: null, seq: null },
  { eid: 'a1b2c3d4e5f9', ...unitOf, t: 'view', dest: 'explore', spot: null, nat: 'ja', n: null, sid: null, seq: null },
  { eid: 'a1b2c3d4e5fa', ...unitOf, t: 'cell', dest: 'w6v434x-ko', spot: null, nat: null, n: null, sid: null, seq: null },
  { eid: 'a1b2c3d4e5fb', ...unitOf, t: 'pick', dest: 'ko', spot: null, nat: null, n: null, sid: null, seq: null },
  { eid: 'a1b2c3d4e5fc', ...unitOf, t: 'quiz_wrong', dest: 'chua-cau', spot: null, nat: null, n: 2, sid: null, seq: null }
]);
assert.equal(eventRows([{ eid: 'AB12CD34', t: 'welcome' }], real, T0)[0].eid, 'ab12cd34', 'eid normalised');
assert.deepEqual(eventRows([{ eid: 'zz', t: 'welcome' }], real, T0), [], 'malformed eid is not logged');
assert.equal(eventRows([{ eid: 'a1b2c3d4', t: 'welcome', tk: 7 }], real, T0)[0].tk, null, 'ticket type is 5 or 3 only');
// behaviour-detail types take the dest guard like checkin does
// per-site behaviour detail lives in `events` only — it mints no counter row
for (const t of ['arrive', 'quiz_done', 'plan_pick', 'auto_steer', 'auto_random']) {
  assert.deepEqual(tally([{ t, id: 'chua-cau', n: 2 }], real), {}, `${t} writes no counter`);
  assert.equal(eventRows([{ eid: 'b1b2b3b4', t, id: 'chua-cau' }], real, T0).length, 1, `${t} is still logged`);
}
assert.equal(eventRows([{ eid: 'a1b2c3d4', t: 'quiz_done', id: 'chua-cau', n: 2 }], real, T0)[0].n, 2);
assert.equal(eventRows([{ eid: 'a1b2c3d4', t: 'view_site', id: 'chua-cau' }], real, T0)[0].dest, 'chua-cau');
assert.equal(eventRows([{ eid: 'a1b2c3d4', t: 'checkin', id: 'chua-cau' }], real, Date.parse('2026-08-28T09:00+07:00'))[0].nudge, 1);

// --- heatmap cells are pinned to the old town's geohash prefix ---
assert.deepEqual(tally([{ t: 'cell', id: 'w6v434x' }]), { 'ev:cell:w6v434x': 1 });
assert.deepEqual(tally([{ t: 'cell', id: 'u4pruyd' }]), {}, 'a cell outside Hội An cannot mint a row');

// --- pageviews: bounded route keys, crossed by nationality; junk pages dropped ---
assert.deepEqual(tally([{ t: 'view', id: 'explore' }]), { 'ev:view:explore': 1 });
assert.deepEqual(
  tally([{ t: 'view', id: 'passport', nat: 'ko' }]),
  { 'ev:view:passport': 1, 'nat:view:passport:ko': 1 },
  'pageview crosses by nationality'
);
// nat crossing is only what /organizer renders live; everything else reads events.nat
assert.deepEqual(tally([{ t: 'checkin', id: 'a', nat: 'ko' }]), { 'count:a': 1, 'nat:checkin:a:ko': 1 });
assert.deepEqual(tally([{ t: 'welcome', nat: 'ko' }]), { 'ev:welcome': 1, 'nat:welcome:_:ko': 1 });
assert.deepEqual(
  tally([{ t: 'quiz_wrong', id: 'a', nat: 'ko' }, { t: 'redeem', id: 'b', nat: 'ko' }]),
  { 'ev:quiz_wrong:a': 1, 'ev:redeem:b': 1 },
  'types nobody watches live do not mint a nat: row'
);
assert.deepEqual(tally([{ t: 'view', id: 'not-a-page' }]), {}, 'unknown route key is dropped');
assert.deepEqual(tally([{ t: 'view', id: 'ev:redeem' }]), {}, 'view id cannot forge another key');

// --- plan mode: which build path, + auto-filled slots summed (avg = /mixed count) ---
assert.deepEqual(tally([{ t: 'plan_mode', id: 'manual' }]), { 'ev:plan_mode:manual': 1 });
assert.deepEqual(
  tally([{ t: 'plan_mode', id: 'mixed', n: 3, nat: 'ja' }]),
  { 'ev:plan_mode:mixed': 1, 'nat:plan_mode:mixed:ja': 1, 'ev:plan_auto_m': 3 },
  'mixed build records mode, nationality, and slots left to the app'
);
assert.deepEqual(tally([{ t: 'plan_mode', id: 'nope' }]), {}, 'unknown build mode is dropped');

console.log('counts.test.js ok');
