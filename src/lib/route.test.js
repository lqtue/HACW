import assert from 'node:assert';
import { routeStats, formatDistance, optimizeRoute, legMeters, DETOUR, WALK_M_PER_MIN } from './route.js';
import DIST from './data/distances.js';

// one leg of ~1 km (0.01° of latitude ≈ 1111 m)
const a = { lat: 15.87, lng: 108.33 };
const b = { lat: 15.88, lng: 108.33 };
const one = routeStats([a, b]);
assert.ok(Math.abs(one.meters - 1111 * DETOUR) < 15, `unexpected ${one.meters} m`);
assert.equal(one.minutes, Math.round(one.meters / WALK_M_PER_MIN));

// legs add up, and order matters for a chain
const two = routeStats([a, b, a]);
assert.ok(Math.abs(two.meters - 2 * one.meters) <= 1, `unexpected ${two.meters} m`);

// degenerate inputs must not produce NaN or a zero-minute walk
assert.deepEqual(routeStats([]), { meters: 0, minutes: 1 });
assert.deepEqual(routeStats([a]), { meters: 0, minutes: 1 });

assert.equal(formatDistance(430), '430 m');
assert.equal(formatDistance(1444, 'vi'), '1,4 km');
assert.equal(formatDistance(1444, 'en'), '1.4 km');

// optimizeRoute: 4 collinear points fed out of order come back as the shortest chain.
// Optimal visits them monotonically (length = span); the scrambled input is longer.
const line = [0, 2, 1, 3].map((k) => ({ lat: 15.87, lng: 108.33 + k * 0.01 }));
const best = optimizeRoute(line);
assert.ok(routeStats(best).meters <= routeStats(line).meters, 'optimize should not lengthen');
const lngs = best.map((p) => p.lng);
const sorted = [...lngs].sort((x, y) => x - y);
assert.ok(
  lngs.every((v, i) => v === sorted[i]) || lngs.every((v, i) => v === sorted[sorted.length - 1 - i]),
  'collinear optimum is monotonic (either direction)'
);
assert.equal(best.length, line.length); // no stop dropped or duplicated

// legMeters: known ids resolve to the baked matrix; off-matrix points fall back to haversine×detour.
const [idA, idB] = DIST.ids;
assert.equal(legMeters({ id: idA }, { id: idB }), DIST.m[0][1], 'matrix lookup by id');
assert.equal(legMeters(a, b), Math.round(routeStats([a, b]).meters), 'off-matrix leg = fallback');
assert.equal(legMeters({ id: idA }, { id: idA }), DIST.m[0][0], 'self distance from matrix (0)');

console.log('route.test.js ok');
