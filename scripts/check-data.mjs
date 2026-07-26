// Content self-check: the JSON *is* the app, so these are the mistakes that
// actually break it — a missing translation, a pin in the wrong province, a
// tour pointing at an id that no longer exists.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'src/lib/data');
const load = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

const destinations = load('destinations.json');
const tours = load('tours.json');
const rewards = load('rewards.json');
const tickets = load('ticket-points.json');
const categories = load('categories.json');

const bilingual = (v, where) => {
  assert.ok(v && typeof v === 'object', `${where}: not a { vi, en } object`);
  assert.ok(v.vi?.trim(), `${where}: missing vi`);
  assert.ok(v.en?.trim(), `${where}: missing en`);
};

// Hội An old town bounding box — a pin outside it is a data-entry slip.
const BOX = { latMin: 15.87, latMax: 15.89, lngMin: 108.31, lngMax: 108.34 };
const ids = new Set();

for (const d of destinations) {
  const at = `${d.code ?? '?'} ${d.id}`;
  assert.ok(d.id && !ids.has(d.id), `${at}: duplicate or missing id`);
  ids.add(d.id);
  for (const f of ['name', 'address', 'hours', 'description']) bilingual(d[f], `${at}.${f}`);
  assert.ok(categories.some((c) => c.id === d.category), `${at}: unknown category ${d.category}`);
  assert.ok(d.lat > BOX.latMin && d.lat < BOX.latMax, `${at}: lat ${d.lat} outside Hội An`);
  assert.ok(d.lng > BOX.lngMin && d.lng < BOX.lngMax, `${at}: lng ${d.lng} outside Hội An`);
  assert.ok(d.radius >= 15 && d.radius <= 100, `${at}: radius ${d.radius} m is unusable`);
  assert.ok(['low', 'medium', 'high'].includes(d.traffic), `${at}: bad traffic`);
  assert.ok(['low', 'medium', 'high'].includes(d.promoPriority), `${at}: bad promoPriority`);

  assert.ok(d.quizBank.length >= 1, `${at}: empty quiz bank`);
  for (const [i, q] of d.quizBank.entries()) {
    bilingual(q.question, `${at}.quiz[${i}].question`);
    assert.ok(q.options.length >= 2, `${at}.quiz[${i}]: needs at least 2 options`);
    q.options.forEach((o, j) => bilingual(o, `${at}.quiz[${i}].options[${j}]`));
    assert.ok(
      Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
      `${at}.quiz[${i}]: answer index out of range`
    );
    assert.ok(['easy', 'hard'].includes(q.difficulty), `${at}.quiz[${i}]: bad difficulty`);
  }
}

// Every site must belong to a tour, or it can never be part of a reward set.
const inTours = new Set();
for (const tour of tours) {
  for (const f of ['title', 'theme', 'description', 'voucher']) bilingual(tour[f], `${tour.id}.${f}`);
  assert.ok(tour.stops.length >= 2, `${tour.id}: needs at least 2 stops`);
  for (const stop of tour.stops) {
    assert.ok(ids.has(stop), `${tour.id}: unknown stop ${stop}`);
    assert.ok(!inTours.has(stop), `${stop} appears in more than one tour`);
    inTours.add(stop);
  }
}
for (const id of ids) assert.ok(inTours.has(id), `${id} is in no tour`);

let prev = 0;
for (const r of rewards) {
  bilingual(r.title, `${r.id}.title`);
  bilingual(r.reward, `${r.id}.reward`);
  assert.ok(r.stamps > prev, `${r.id}: tiers must ascend`);
  prev = r.stamps;
}
assert.ok(prev <= destinations.length, `top tier needs ${prev} stamps but only ${ids.size} sites exist`);

for (const p of tickets) {
  assert.ok(p.id, 'ticket point without id');
  assert.ok(p.lat > BOX.latMin && p.lat < BOX.latMax + 0.01, `${p.id}: lat outside Hội An`);
  assert.ok(p.lng > BOX.lngMin && p.lng < BOX.lngMax, `${p.id}: lng outside Hội An`);
}

console.log(
  `check-data.mjs ok — ${destinations.length} sites, ${tours.length} tours, ` +
    `${rewards.length} tiers, ${tickets.length} ticket points`
);
