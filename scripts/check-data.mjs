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
import { BOX, checkDestinations, checkTours, checkRewards } from '../src/lib/editor.js';
import { maxPossiblePoints } from '../src/lib/score.js';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'src/lib/data');
const load = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

const destinations = load('destinations.json');
const tours = load('tours.json');
const rewards = load('rewards.json');
const tickets = load('ticket-points.json');
const categories = load('categories.json');

const ids = destinations.map((d) => d.id);
const ok = (problems, file) => assert.ok(problems.length === 0, `\n${file}:\n${problems.join('\n')}`);

ok(checkDestinations(destinations, categories.map((c) => c.id)), 'destinations.json');
// Full destination objects (not just ids) so ticket-set slot composition is checked.
ok(checkTours(tours, destinations), 'tours.json');

// A tour with a `closed` stop can never be completed, so its +30 and its voucher are
// unreachable — swap the stop for an open site instead of leaving a dead set.
const shut = new Set(destinations.filter((d) => d.closed).map((d) => d.id));
ok(
  tours.flatMap((t) => t.stops.filter((s) => shut.has(s)).map((s) => `${t.id}: stop ${s} is a closed site`)),
  'tours.json'
);

// Ticket-class taxonomy: the paper ticket admits 1 of 3 monuments + 1 of 6 museums
// + free slots. Every site must carry a ticketClass; counts must match the ticket.
// PLACEHOLDER ASSIGNMENT — survey team must confirm the real monument/museum ids.
const tc = { monument: 0, museum: 0, other: 0 };
const badClass = [];
for (const d of destinations) {
  if (tc[d.ticketClass] === undefined) badClass.push(`${d.id}: bad ticketClass ${d.ticketClass}`);
  else tc[d.ticketClass]++;
}
ok(badClass, 'ticketClass');
assert.equal(tc.monument, 3, `expected 3 monuments, got ${tc.monument}`);
assert.equal(tc.museum, 6, `expected 6 museums, got ${tc.museum}`);

// (Opening hours are free text and may legitimately be "Liên hệ ban tổ chức" /
// unknown — hours.js reports those as unknown and the filter treats them as open,
// so there is nothing to enforce here.)

// Coverage: a site in NO ticket set is invisible to the planner. Warn (don't fail)
// — the themed sets are still being authored; /organizer lists these as a to-do.
const inSet = new Set(tours.filter((t) => t.ticket).flatMap((t) => t.stops));
const uncovered = destinations.filter((d) => !inSet.has(d.id)).map((d) => d.id);
if (uncovered.length) console.warn(`  ⚠ ${uncovered.length} sites in no ticket set: ${uncovered.join(', ')}`);
const noQuiz = destinations.filter((d) => !d.closed && !d.quizBank.length).map((d) => d.id);
if (noQuiz.length) console.warn(`  ⚠ ${noQuiz.length} open sites have no questions yet: ${noQuiz.join(', ')}`);
const draftSets = tours.filter((t) => t.ticket && t.draft).map((t) => t.id);
if (draftSets.length) console.warn(`  ⚠ ${draftSets.length} draft ticket sets need real narratives: ${draftSets.join(', ')}`);
// Tiers gate on points, so the ceiling is the score a visitor is guaranteed to
// reach — not the number of sites.
ok(checkRewards(rewards, maxPossiblePoints(destinations.length, tours.length)), 'rewards.json');

// distance matrix must match the current destination set (stale after add/remove/move → rebuild it)
const { default: DIST } = await import('../src/lib/data/distances.js');
assert.deepEqual(DIST.ids, ids, 'distances.js ids drift from destinations — run scripts/build-distance-matrix.mjs');
assert.ok(DIST.m.length === ids.length && DIST.m.every((r) => r.length === ids.length), 'distances.js matrix not N×N');
if (DIST.source?.startsWith('fallback'))
  console.warn('  ⚠ distances.js is the haversine fallback — run `ORS_TOKEN=… node scripts/build-distance-matrix.mjs --ors` for real walking distances');

// walking-leg geometry (the polylines the map draws) — same drift check
const { default: LEGS } = await import('../src/lib/data/legs.js');
assert.deepEqual(LEGS.ids, ids, 'legs.js ids drift from destinations — run scripts/build-distance-matrix.mjs --geom');
if (LEGS.source?.startsWith('fallback'))
  console.warn('  ⚠ legs.js has no baked geometry — routes draw as straight lines. Run `ORS_TOKEN=… node scripts/build-distance-matrix.mjs --ors --geom` for real walking paths');

for (const p of tickets) {
  assert.ok(p.id, 'ticket point without id');
  assert.ok(p.lat > BOX.latMin && p.lat < BOX.latMax + 0.01, `${p.id}: lat outside Hội An`);
  assert.ok(p.lng > BOX.lngMin && p.lng < BOX.lngMax, `${p.id}: lng outside Hội An`);
}

console.log(
  `check-data.mjs ok — ${destinations.length} sites, ${tours.length} tours, ` +
    `${rewards.length} tiers, ${tickets.length} ticket points`
);
