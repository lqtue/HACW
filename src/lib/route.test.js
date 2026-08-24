import assert from 'node:assert';
import { routeStats, formatDistance, optimizeRoute, planOrder, legMeters, legPath, DETOUR, WALK_M_PER_MIN } from './route.js';
import { distanceMeters } from './geo.js';
import DIST from './data/distances.js';
import destinations from './data/destinations.json' with { type: 'json' };

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

// optimizeRoute with a start anchor: the walk begins from where you stand. Anchor at the
// HIGH end of the collinear line → optimal order runs high→low; anchor is never returned.
const hiEnd = { lat: 15.87, lng: 108.33 + 3 * 0.01 };
const fromHi = optimizeRoute(line, hiEnd);
assert.equal(fromHi.length, line.length, 'anchor not added to or dropped from result');
assert.ok(!fromHi.includes(hiEnd), 'anchor is virtual, never in the result');
assert.deepEqual(fromHi.map((p) => p.lng), [3, 2, 1, 0].map((k) => 108.33 + k * 0.01), 'starts nearest the anchor');
// and the anchored total (anchor→chain) is no longer than the same chain unanchored+prefixed
assert.ok(
  routeStats([hiEnd, ...fromHi]).meters <= routeStats([hiEnd, ...best]).meters,
  'anchored order is the shortest walk from the anchor'
);
// 2 stops: unanchored is already optimal (returned as-is); anchored still picks the near one first
assert.equal(optimizeRoute(line.slice(0, 2)).length, 2, '2 stops unanchored: unchanged');
assert.deepEqual(
  optimizeRoute([line[0], line[3]], hiEnd).map((p) => p.lng),
  [108.33 + 3 * 0.01, 108.33],
  '2 stops anchored: nearest the anchor first'
);

// planOrder: the live-nav composition. Stops carry ids; "done" is a Set here (passport in app).
const P = [0, 1, 2, 3].map((k) => ({ id: `s${k}`, lat: 15.87, lng: 108.33 + k * 0.01 }));
// no anchor yet (no GPS fix) → untouched, same order
assert.deepEqual(planOrder(P, () => false, undefined).map((s) => s.id), ['s0', 's1', 's2', 's3'], 'no anchor: as-is');
// anchor at high end, nothing visited → whole chain reordered high→low
assert.deepEqual(
  planOrder(P, () => false, hiEnd).map((s) => s.id),
  ['s3', 's2', 's1', 's0'],
  'anchor reorders the todo nearest-first'
);
// s0 and s1 already visited → they stay put at the FRONT, only the un-visited rest reorders
const done = new Set(['s0', 's1']);
assert.deepEqual(
  planOrder(P, (s) => done.has(s.id), hiEnd).map((s) => s.id),
  ['s0', 's1', 's3', 's2'],
  'visited stops kept in place; remaining reorder from the anchor'
);
assert.equal(planOrder(P, () => false, hiEnd).length, P.length, 'no stop dropped or duplicated');

// legMeters: known ids resolve to the baked matrix; off-matrix points fall back to haversine×detour.
const [idA, idB] = DIST.ids;
assert.equal(legMeters({ id: idA }, { id: idB }), DIST.m[0][1], 'matrix lookup by id');
assert.equal(legMeters(a, b), Math.round(routeStats([a, b]).meters), 'off-matrix leg = fallback');
assert.equal(legMeters({ id: idA }, { id: idA }), DIST.m[0][0], 'self distance from matrix (0)');

// legPath detour cap: every DRAWN leg must be within 2.6× crow-flies (a baked ORS
// loop past that is replaced by a straight segment), so the map never shows a leg
// that wanders far off the direct line. The dense old-town grid legitimately doglegs
// up to ~2.5×. Very short legs are exempt (noisy ratio).
const byId = Object.fromEntries(destinations.map((d) => [d.id, d]));
const polyLen = (path) => {
  let m = 0;
  for (let k = 1; k < path.length; k++)
    m += distanceMeters({ lng: path[k - 1][0], lat: path[k - 1][1] }, { lng: path[k][0], lat: path[k][1] });
  return m;
};
for (let x = 0; x < DIST.ids.length; x++) {
  for (let y = x + 1; y < DIST.ids.length; y++) {
    const A = byId[DIST.ids[x]];
    const B = byId[DIST.ids[y]];
    if (!A || !B) continue;
    const straight = distanceMeters(A, B);
    const drawn = polyLen(legPath(A, B));
    assert.ok(
      straight < 40 || drawn <= straight * 2.6 + 1,
      `drawn leg ${A.id}->${B.id} = ${Math.round(drawn)} m exceeds cap for straight ${Math.round(straight)} m`
    );
  }
}

console.log('route.test.js ok');
