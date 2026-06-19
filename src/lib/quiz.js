// Draw the per-check-in question set: 2 easy + 1 hard, randomly, no repeats.
// Target bank per destination is 10 (8 easy / 2 hard); falls back gracefully if fewer.
export function pickQuestions(bank, easyCount = 2, hardCount = 1) {
  const easy = bank.filter((q) => q.difficulty === 'easy');
  const hard = bank.filter((q) => q.difficulty === 'hard');
  return [...sample(easy, easyCount), ...sample(hard, hardCount)];
}

function sample(arr, n) {
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}
