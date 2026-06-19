// Run: npm run test:geo
import assert from 'node:assert';
import { distanceMeters, withinRadius } from './geo.js';

// Same point -> 0 m
assert.equal(Math.round(distanceMeters({ lat: 15.877, lng: 108.327 }, { lat: 15.877, lng: 108.327 })), 0);

// Chùa Cầu -> Hội quán Phúc Kiến is a few hundred meters, not kilometers.
const d = distanceMeters({ lat: 15.877153, lng: 108.326653 }, { lat: 15.8775, lng: 108.3289 });
assert.ok(d > 100 && d < 500, `expected 100-500m, got ${Math.round(d)}m`);

// withinRadius respects the dest radius.
const dest = { lat: 15.877153, lng: 108.326653, radius: 45 };
assert.equal(withinRadius({ lat: 15.877153, lng: 108.326653 }, dest), true);
assert.equal(withinRadius({ lat: 15.8775, lng: 108.3289 }, dest), false);

console.log('geo.test.js OK');
