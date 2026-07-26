import assert from 'node:assert';
import {
  POINTS,
  stampPoints,
  spotlightIds,
  totalPoints,
  breakdown,
  maxPossiblePoints,
  tierFor,
  nextTier,
  evenness
} from './score.js';

// --- per-check-in points ---
assert.equal(stampPoints(), 10);
assert.equal(stampPoints({ perfect: true }), 15);
assert.equal(stampPoints({ perfect: true, spotlight: true }), 25);

// --- spotlight: live counts steer visitors to the quieter half ---
const dests = [
  { id: 'a', traffic: 'high', promoPriority: 'low' },
  { id: 'b', traffic: 'high', promoPriority: 'low' },
  { id: 'c', traffic: 'low', promoPriority: 'low' },
  { id: 'd', traffic: 'high', promoPriority: 'high' }
];
const live = spotlightIds({ a: 20, b: 15, c: 1, d: 0 }, dests);
assert.ok(live.has('c') && live.has('d'), 'quiet sites get the bonus');
assert.ok(!live.has('a') && !live.has('b'), 'busy sites do not');

// too little data -> sheet columns decide
const cold = spotlightIds({ a: 2 }, dests);
assert.deepEqual([...cold].sort(), ['c', 'd']);
assert.deepEqual([...spotlightIds(null, dests)].sort(), ['c', 'd']);

// a never-visited site must always be in the boosted half
const many = Object.fromEntries(dests.map((d, i) => [d.id, i * 10]));
assert.ok(spotlightIds(many, dests).has('a'), 'zero-count site is spotlighted');

// --- totals ---
const tours = [{ stops: ['a', 'b'] }, { stops: ['c', 'd'] }];
const stamps = [{ id: 'a', pts: 10 }, { id: 'b', pts: 25 }];
assert.equal(totalPoints(stamps, tours, 4), 10 + 25 + POINTS.tour);
assert.equal(totalPoints([{ id: 'a' }], tours, 4), POINTS.stamp, 'missing pts falls back to base');
const all = dests.map((d) => ({ id: d.id, pts: 10 }));
assert.equal(totalPoints(all, tours, 4), 40 + 2 * POINTS.tour + POINTS.allSites);

// --- breakdown: the passport shows the arithmetic, so the parts must add up ---
const b = breakdown(stamps, tours, 4);
assert.deepEqual(b, { stamps: 35, toursDone: 1, tours: POINTS.tour, allSites: 0, total: 35 + POINTS.tour });
const bAll = breakdown(all, tours, 4);
assert.equal(bAll.toursDone, 2);
assert.equal(bAll.allSites, POINTS.allSites);
assert.equal(bAll.stamps + bAll.tours + bAll.allSites, bAll.total, 'the parts add up to the total');
// and the total is the only thing totalPoints reports, for every case above
for (const st of [[], stamps, all, [{ id: 'a' }]]) {
  assert.equal(totalPoints(st, tours, 4), breakdown(st, tours, 4).total);
}
assert.deepEqual(breakdown([], tours, 4), { stamps: 0, toursDone: 0, tours: 0, allSites: 0, total: 0 });

// --- tiers: keyed on points, not stamp count ---
const tiers = [{ points: 40 }, { points: 120 }, { points: 500 }];
assert.equal(tierFor(0, tiers), null);
assert.equal(tierFor(39, tiers), null, 'one point short is still no rank');
assert.equal(tierFor(40, tiers).points, 40, 'the threshold itself unlocks');
assert.equal(tierFor(499, tiers).points, 120);
assert.equal(tierFor(500, tiers).points, 500);
assert.equal(nextTier(40, tiers).points, 120);
assert.equal(nextTier(500, tiers), null);

// The ceiling a tier may sit at: every site stamped, every tour done, no bonuses.
assert.equal(maxPossiblePoints(25, 5), 25 * POINTS.stamp + 5 * POINTS.tour + POINTS.allSites);
assert.equal(maxPossiblePoints(25, 5), 500);
// and a visitor who actually does all that reaches exactly it
const everySite = Array.from({ length: 25 }, (_, i) => ({ id: `s${i}`, pts: POINTS.stamp }));
const everyTour = Array.from({ length: 5 }, (_, i) => ({ stops: [`s${i * 5}`, `s${i * 5 + 1}`, `s${i * 5 + 2}`, `s${i * 5 + 3}`, `s${i * 5 + 4}`] }));
assert.equal(totalPoints(everySite, everyTour, 25), maxPossiblePoints(25, 5), 'the ceiling is actually attainable');

// --- evenness (organizer headline) ---
assert.equal(evenness({}, dests), 1, 'no data reads as even');
assert.equal(evenness({ a: 5, b: 5, c: 5, d: 5 }, dests), 1);
assert.ok(evenness({ a: 20, b: 0, c: 0, d: 0 }, dests) < 0.01, 'one hot site reads as uneven');
assert.ok(evenness({ a: 10, b: 8, c: 6, d: 4 }, dests) > 0.95);

console.log('score.test.js ok');
