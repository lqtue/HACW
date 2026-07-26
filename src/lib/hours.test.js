import assert from 'node:assert';
import { parseRanges, openState, isClosingSoon, formatMinutes } from './hours.js';

const at = (h, m = 0) => new Date(2026, 5, 10, h, m);

// --- the shapes the survey sheet actually contains ---
assert.deepEqual(parseRanges('7:00 - 22:00'), [[420, 1320]]);
assert.deepEqual(parseRanges('7:30 - 11:30 13:30 - 17:30'), [
  [450, 690],
  [810, 1050]
]);
assert.deepEqual(parseRanges('8:00 - 17:00 (có nghỉ trưa)'), [[480, 1020]]);
assert.deepEqual(parseRanges('Liên hệ ban tổ chức'), [], 'unparsable text yields no ranges');
assert.deepEqual(parseRanges(null), []);

// --- open / closed / unknown ---
assert.equal(openState('7:00 - 22:00', at(12)).status, 'open');
assert.equal(openState('7:00 - 22:00', at(6, 30)).status, 'closed');
assert.equal(openState('7:00 - 22:00', at(22)).status, 'closed', 'closing time is exclusive');
assert.equal(openState('Liên hệ ban tổ chức', at(12)).status, 'unknown', 'never guess');

// lunch break must read as closed, and know when it reopens
const lunch = openState('7:30 - 11:30 13:30 - 17:30', at(12, 15));
assert.equal(lunch.status, 'closed');
assert.equal(formatMinutes(lunch.opensAt), '13:30');
assert.equal(openState('7:30 - 11:30 13:30 - 17:30', at(14)).status, 'open');

// --- closing-soon warning ---
assert.ok(isClosingSoon(openState('7:00 - 18:00', at(17, 30))));
assert.ok(!isClosingSoon(openState('7:00 - 18:00', at(15))));
assert.ok(!isClosingSoon(openState('7:00 - 18:00', at(19))), 'already closed is not closing soon');

assert.equal(formatMinutes(690), '11:30');
assert.equal(formatMinutes(null), '');

console.log('hours.test.js ok');
