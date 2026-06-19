// Run: node src/lib/quiz.test.js
import assert from 'node:assert';
import { pickQuestions } from './quiz.js';

const bank = [
  ...Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, difficulty: 'easy' })),
  ...Array.from({ length: 2 }, (_, i) => ({ id: `h${i}`, difficulty: 'hard' }))
];

for (let run = 0; run < 50; run++) {
  const picked = pickQuestions(bank);
  assert.equal(picked.length, 3, 'draws 3 questions');
  assert.equal(picked.filter((q) => q.difficulty === 'easy').length, 2, '2 easy');
  assert.equal(picked.filter((q) => q.difficulty === 'hard').length, 1, '1 hard');
  assert.equal(new Set(picked.map((q) => q.id)).size, 3, 'no duplicates');
}

// Graceful when the bank is short (won't crash, returns what it can).
assert.equal(pickQuestions([{ id: 'e', difficulty: 'easy' }]).length, 1);

console.log('quiz.test.js OK');
