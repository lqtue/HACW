import assert from 'node:assert';
import { SCHEDULE, unit, nudgeOn } from './switchback.js';

const at = (iso) => Date.parse(iso); // ISO with +07:00 offset

// --- local half-day boundaries (UTC+7): 12:59 is am, 13:00 is pm ---
assert.deepEqual(unit(at('2026-08-28T12:59:59+07:00')), { day: '2026-08-28', half: 'am' });
assert.deepEqual(unit(at('2026-08-28T13:00:00+07:00')), { day: '2026-08-28', half: 'pm' });
// 23:30 local is still that day even though it is the next day in UTC? no — the
// other way: 01:00 local on the 29th is 18:00 UTC on the 28th. Must read as the 29th.
assert.deepEqual(unit(at('2026-08-29T01:00:00+07:00')), { day: '2026-08-29', half: 'am' });

// --- the schedule itself ---
assert.equal(nudgeOn(at('2026-08-28T09:00+07:00')), 1);
assert.equal(nudgeOn(at('2026-08-28T15:00+07:00')), 0);
assert.equal(nudgeOn(at('2026-08-29T09:00+07:00')), 0);
assert.equal(nudgeOn(at('2026-08-29T15:00+07:00')), 1);
assert.equal(nudgeOn(at('2026-09-01T09:00+07:00')), 0, 'tail day');
assert.equal(nudgeOn(at('2026-09-02T20:00+07:00')), 0, 'tail day');
assert.equal(nudgeOn(at('2026-08-27T09:00+07:00')), 1, 'before the festival: on');
assert.equal(nudgeOn(at('2026-09-03T09:00+07:00')), 1, 'after the festival: on');

// --- balance: days 1–4 give AM and PM each 2 on / 2 off; days 5–6 all off ---
const days = Object.keys(SCHEDULE);
assert.equal(days.length, 6);
const first4 = days.slice(0, 4).map((d) => SCHEDULE[d]);
assert.equal(first4.reduce((n, u) => n + u.am, 0), 2, 'AM balanced');
assert.equal(first4.reduce((n, u) => n + u.pm, 0), 2, 'PM balanced');
assert.ok(first4.every((u) => u.am !== u.pm), 'one switch per day');
assert.ok(days.slice(4).every((d) => SCHEDULE[d].am === 0 && SCHEDULE[d].pm === 0), 'tail off');

console.log('switchback.test.js ok');
