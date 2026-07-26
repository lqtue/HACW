// Run: node src/lib/editor.test.js
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { checkDestination, checkDestinations, checkTours, checkRewards, checkEvent } from './editor.js';

const good = {
  id: 'x',
  code: 'A1',
  name: { vi: 'a', en: 'a' },
  address: { vi: 'a', en: 'a' },
  hours: { vi: 'a', en: 'a' },
  description: { vi: 'a', en: 'a' },
  category: 'di-tich',
  lat: 15.877,
  lng: 108.326,
  radius: 75,
  traffic: 'high',
  promoPriority: 'low',
  quizBank: [
    {
      difficulty: 'easy',
      question: { vi: 'q', en: 'q' },
      options: [
        { vi: 'a', en: 'a' },
        { vi: 'b', en: 'b' }
      ],
      answer: 0
    }
  ]
};
const bad = (patch) => checkDestination({ ...structuredClone(good), ...patch }, ['di-tich']);

assert.deepEqual(bad({}), []);
assert.equal(bad({ name: { vi: 'a', en: '' } }).length, 1); // missing translation
assert.equal(bad({ lat: 21.03 }).length, 1); // Hà Nội, not Hội An
assert.equal(bad({ radius: 500 }).length, 1);
assert.equal(bad({ traffic: 'huge' }).length, 1);
assert.equal(bad({ category: 'nope' }).length, 1);
assert.equal(bad({ quizBank: [] }).length, 1);

// answer index must point at an option that exists
const q = structuredClone(good.quizBank[0]);
q.answer = 2;
assert.equal(bad({ quizBank: [q] }).length, 1);

// duplicate ids are only visible file-wide
assert.equal(checkDestinations([good, good], ['di-tich']).length, 1);
assert.deepEqual(checkDestinations('nope'), ['destinations.json: not an array']);

// --- tours ---------------------------------------------------------------
const bi = { vi: 'a', en: 'a' };
const tour = (patch) => ({ id: 't1', title: bi, theme: bi, description: bi, voucher: bi, stops: ['x', 'y'], ...patch });

assert.deepEqual(checkTours([tour({})]), []);
assert.equal(checkTours([tour({ stops: ['x'] })]).length, 1, 'a tour needs two stops');
assert.equal(checkTours([tour({ voucher: null })]).length, 1);
assert.equal(checkTours([tour({}), tour({ id: 't2' })]).length, 2, 'a stop cannot be in two tours');
assert.equal(checkTours([tour({})], ['x', 'y']).length, 0);
assert.equal(checkTours([tour({})], ['x', 'y', 'z']).length, 1, 'z is in no tour');
assert.equal(checkTours([tour({ stops: ['x', 'ghost'] })], ['x', 'ghost']).length, 0);
assert.equal(checkTours([tour({ stops: ['x', 'ghost'] })], ['x', 'y']).length, 2, 'unknown stop + orphaned y');
assert.deepEqual(checkTours('nope'), ['tours.json: not an array']);

// --- rewards -------------------------------------------------------------
const tiers = [
  { id: 'a', stamps: 3, title: bi, reward: bi },
  { id: 'b', stamps: 8, title: bi, reward: bi }
];
assert.deepEqual(checkRewards(tiers, 25), []);
assert.equal(checkRewards(tiers, 5).length, 1, 'top tier must be reachable');
assert.equal(checkRewards([tiers[1], tiers[0]], 25).length, 1, 'tiers must ascend');
assert.equal(checkRewards([{ ...tiers[0], stamps: 2.5 }], 25).length, 1, 'half a stamp is not a thing');
assert.equal(checkRewards([]).length, 1);

// --- event ---------------------------------------------------------------
const ev = { title: 'T', dates: 'D', subtitle: bi, intro: bi, note: bi, howItWorks: [bi] };
assert.deepEqual(checkEvent(ev), []);
assert.equal(checkEvent({ ...ev, title: '  ' }).length, 1);
assert.equal(checkEvent({ ...ev, howItWorks: [] }).length, 1);
assert.equal(checkEvent({ ...ev, howItWorks: [{ vi: 'a' }] }).length, 1);
assert.deepEqual(checkEvent(null), ['event.json: not an object']);

// and the shipped files are clean by the same rules the editor enforces
const load = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), 'utf8'));
const ids = load('destinations.json').map((d) => d.id);
assert.deepEqual(
  checkDestinations(
    load('destinations.json'),
    load('categories.json').map((c) => c.id)
  ),
  []
);
assert.deepEqual(checkTours(load('tours.json'), ids), []);
assert.deepEqual(checkRewards(load('rewards.json'), ids.length), []);
assert.deepEqual(checkEvent(load('event.json')), []);

console.log('editor.test.js OK');
