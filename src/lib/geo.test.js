import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { distanceMeters, nearest, geohash, geohashDecode, bearing } from './geo.js';

// --- bearing(): the /go "walk this way" arrow ---
const o = { lat: 15.877, lng: 108.327 };
assert.ok(Math.abs(bearing(o, { lat: 15.887, lng: 108.327 }) - 0) < 1, 'due north ≈ 0°');
assert.ok(Math.abs(bearing(o, { lat: 15.877, lng: 108.337 }) - 90) < 1, 'due east ≈ 90°');
assert.ok(Math.abs(bearing(o, { lat: 15.867, lng: 108.327 }) - 180) < 1, 'due south ≈ 180°');
assert.ok(Math.abs(bearing(o, { lat: 15.877, lng: 108.317 }) - 270) < 1, 'due west ≈ 270°');

// Same point -> 0 m
assert.equal(Math.round(distanceMeters({ lat: 15.877, lng: 108.327 }, { lat: 15.877, lng: 108.327 })), 0);

// Chùa Cầu -> Hội quán Phúc Kiến is a few hundred meters, not kilometers.
const d = distanceMeters({ lat: 15.877153, lng: 108.326653 }, { lat: 15.8775, lng: 108.3289 });
assert.ok(d > 100 && d < 500, `expected 100-500m, got ${Math.round(d)}m`);

// --- nearest(): what routes a visitor to a ticket counter ---
const pts = [
  { id: 'far', lat: 15.8806, lng: 108.3302 },
  { id: 'close', lat: 15.8772, lng: 108.3268 },
  { id: 'mid', lat: 15.8782, lng: 108.3241 }
];
const here = { lat: 15.877153, lng: 108.326653 };
assert.equal(nearest(here, pts).point.id, 'close');
assert.ok(nearest(here, pts).meters < 100, 'reports the distance, not just the winner');
assert.equal(nearest(here, []), null, 'no counters is not a crash');
assert.equal(nearest(here, null), null);
assert.equal(nearest(pts[0], pts).meters, 0, 'standing on one picks that one');

// Every shipped ticket point must be reachable by this, i.e. have real coords.
const tickets = JSON.parse(readFileSync(new URL('./data/ticket-points.json', import.meta.url), 'utf8'));
assert.ok(tickets.length > 0);
assert.ok(
  tickets.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
  'a counter without coordinates can never be the nearest one'
);
assert.ok(nearest(here, tickets).meters < 3000, 'the nearest counter is inside the old town');

// --- geohash: known value, precision, and round-trip within a cell ---
assert.equal(geohash(57.64911, 10.40744, 11), 'u4pruydqqvj', 'canonical geohash reference');
assert.equal(geohash(15.8772, 108.3275).length, 7, 'default precision is 7 chars');
// decode lands within ~½ a precision-7 cell (~150 m) of the original point
const gh = geohash(15.8772, 108.3275);
assert.ok(distanceMeters({ lat: 15.8772, lng: 108.3275 }, geohashDecode(gh)) < 120, 'decode ≈ cell centre');
// two points in the same ~150 m cell share a hash; far apart, they don't
assert.equal(geohash(15.8772, 108.3275), geohash(15.87725, 108.32755), 'same cell → same hash');
assert.notEqual(geohash(15.8772, 108.3275), geohash(15.8850, 108.3400), 'a different cell → different hash');
assert.equal(geohashDecode('!!!'), null, 'junk decodes to null');

console.log('geo.test.js OK');
