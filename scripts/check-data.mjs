// Content self-check: the JSON *is* the app, so these are the mistakes that
// actually break it — a missing translation, a pin in the wrong province, a
// tour pointing at an id that no longer exists.
//
// The per-file rules live in src/lib/editor.js so the /organizer editor runs the
// exact same check on a JSON before it lets an organizer download it. Only the
// cross-file rules that the editor cannot see are written out here.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BOX, checkDestinations, checkTours, checkRewards, checkEvent } from '../src/lib/editor.js';
import { maxPossiblePoints } from '../src/lib/score.js';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'src/lib/data');
const load = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

const destinations = load('destinations.json');
const tours = load('tours.json');
const rewards = load('rewards.json');
const tickets = load('ticket-points.json');
const categories = load('categories.json');
const event = load('event.json');

const ids = destinations.map((d) => d.id);
const ok = (problems, file) => assert.ok(problems.length === 0, `\n${file}:\n${problems.join('\n')}`);

ok(checkDestinations(destinations, categories.map((c) => c.id)), 'destinations.json');
// Passing ids in is also what asserts every site belongs to exactly one tour.
ok(checkTours(tours, ids), 'tours.json');
// Tiers gate on points, so the ceiling is the score a visitor is guaranteed to
// reach — not the number of sites.
ok(checkRewards(rewards, maxPossiblePoints(destinations.length, tours.length)), 'rewards.json');
ok(checkEvent(event), 'event.json');

for (const p of tickets) {
  assert.ok(p.id, 'ticket point without id');
  assert.ok(p.lat > BOX.latMin && p.lat < BOX.latMax + 0.01, `${p.id}: lat outside Hội An`);
  assert.ok(p.lng > BOX.lngMin && p.lng < BOX.lngMax, `${p.id}: lng outside Hội An`);
}

console.log(
  `check-data.mjs ok — ${destinations.length} sites, ${tours.length} tours, ` +
    `${rewards.length} tiers, ${tickets.length} ticket points`
);
