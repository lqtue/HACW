// Run: node src/lib/editor.test.js
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { checkDestination, checkDestinations } from './editor.js';

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

// and the shipped file is clean by the same rules the editor enforces
const load = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), 'utf8'));
assert.deepEqual(
  checkDestinations(
    load('destinations.json'),
    load('categories.json').map((c) => c.id)
  ),
  []
);

console.log('editor.test.js OK');
