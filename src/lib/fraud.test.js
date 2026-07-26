import assert from 'node:assert';
import { flagPassport } from './fraud.js';

// A stand-in old town: two adjacent museums 11 m apart, one site 900 m away.
const dests = [
  { id: 'a', lat: 15.8765833, lng: 108.3298399 },
  { id: 'b', lat: 15.8766736, lng: 108.329857 }, // ~10 m from a
  { id: 'far', lat: 15.8782399, lng: 108.3240582 } // ~640 m from a
];
const at = (min) => new Date(Date.UTC(2026, 6, 26, 9, min)).toISOString();
const flags = (stamps, opts) => flagPassport(stamps, dests, opts);
const kinds = (stamps, opts) => flags(stamps, opts).map((f) => f.kind);

// --- honest visits raise nothing ---
assert.deepEqual(flags([]), [], 'no stamps, no flags');
assert.deepEqual(flags([{ id: 'a', at: at(0) }]), [], 'one stamp cannot be a journey');
assert.deepEqual(flags([{ id: 'a', at: at(0) }, { id: 'far', at: at(20) }]), [], '640 m in 20 min is a walk');
assert.deepEqual(
  flags([{ id: 'a', at: at(0) }, { id: 'b', at: at(0) }]),
  [],
  'adjacent museums stamped seconds apart is a normal visit, not a teleport'
);

// --- the shapes worth a second look ---
assert.deepEqual(kinds([{ id: 'a', at: at(0) }, { id: 'far', at: at(1) }]), ['impossible-travel']);
const tp = flags([{ id: 'far', at: at(0) }, { id: 'a', at: at(0) }])[0];
assert.equal(tp.kind, 'impossible-travel', 'same timestamp, opposite ends of town');
assert.ok(tp.metres > 500 && tp.speed > 150, `reports the evidence: ${JSON.stringify(tp)}`);

// Six stamps in ten minutes is a script, even if each hop is individually walkable.
const burst = Array.from({ length: 6 }, (_, i) => ({ id: 'a', at: at(i) }));
assert.deepEqual(kinds(burst), ['burst']);
assert.equal(flags(burst).filter((f) => f.kind === 'burst').length, 1, 'one entry, not one per window');
assert.deepEqual(
  kinds(Array.from({ length: 6 }, (_, i) => ({ id: 'a', at: at(i * 10) }))),
  [],
  'the same six stamps over an hour is just a visit'
);

// --- order and junk ---
assert.deepEqual(
  kinds([{ id: 'far', at: at(1) }, { id: 'a', at: at(0) }]),
  ['impossible-travel'],
  'stamps are sorted by time first, not trusted in array order'
);
assert.deepEqual(flags([{ id: 'a' }, { id: 'a', at: 'nonsense' }]), [], 'unusable timestamps are skipped');
assert.deepEqual(flags([{ id: 'ghost', at: at(0) }, { id: 'far', at: at(0) }]), [], 'unknown ids are skipped');
assert.deepEqual(flagPassport(null, null), [], 'no input is not a crash');

// --- thresholds are tunable, because the right number is an on-site question ---
assert.deepEqual(kinds([{ id: 'a', at: at(0) }, { id: 'far', at: at(5) }], { maxSpeed: 60 }), [
  'impossible-travel'
]);
assert.deepEqual(kinds(burst, { burstStamps: 7 }), [], 'a higher bar forgives the same history');

console.log('fraud.test.js ok');
