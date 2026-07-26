import assert from 'node:assert';
import { routeStats, formatDistance, DETOUR, WALK_M_PER_MIN } from './route.js';

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

console.log('route.test.js ok');
