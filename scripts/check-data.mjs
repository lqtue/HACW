// Content self-check: the JSON *is* the app, so these are the mistakes that
// actually break it — a missing translation, a pin in the wrong province, a
// tour pointing at an id that no longer exists.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BOX, checkDestinations } from '../src/lib/editor.js';

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

// Per-destination rules live in src/lib/editor.js so the /organizer editor can
// run the exact same check on a JSON before it is downloaded.
const problems = checkDestinations(destinations, categories.map((c) => c.id));
assert.ok(problems.length === 0, `\n${problems.join('\n')}`);
const ids = new Set(destinations.map((d) => d.id));

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
