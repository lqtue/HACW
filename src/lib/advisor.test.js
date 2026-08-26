import assert from 'node:assert';
import { rankSets } from './advisor.js';

const now = new Date('2026-08-19T12:00:00'); // local noon
const H_OPEN = { vi: '7:00 - 22:00' };
const H_CLOSED = { vi: '7:00 - 9:00' }; // shut by noon

// stops near each other (short walk) vs far apart (long walk)
const near = (id, cat, hours = H_OPEN) => ({ id, category: cat, hours, lat: 15.877, lng: 108.326 });
const far = (id, cat, hours = H_OPEN) => ({ id, category: cat, hours, lat: 15.9, lng: 108.35 });

const destinations = []; // empty -> spotlight fallback empty, so `quiet` never fires here

// rain: the indoor (museum) set must beat the outdoor (heritage) set
const indoorSet = { id: 'indoor', stops: [near('a', 'bao-tang'), near('b', 'nha-co'), near('c', 'bao-tang')] };
const outdoorSet = { id: 'outdoor', stops: [near('d', 'di-tich'), near('e', 'di-tich'), near('f', 'di-tich')] };
let ranked = rankSets([outdoorSet, indoorSet], { weather: 'rain', now }, destinations);
assert.equal(ranked[0].id, 'indoor', 'rain should surface the indoor set');

// a set with a closed stop must sink below an all-open twin
const openSet = { id: 'open', stops: [near('g', 'di-tich'), near('h', 'di-tich')] };
const closedSet = { id: 'closed', stops: [near('i', 'di-tich'), near('j', 'di-tich', H_CLOSED)] };
ranked = rankSets([closedSet, openSet], { weather: 'mild', now }, destinations);
assert.equal(ranked[0].id, 'open', 'a closed stop should sink its set');
assert.equal(ranked.find((s) => s.id === 'closed').openNow, false);

// hot: the shorter walk wins
const shortSet = { id: 'short', stops: [near('k', 'di-tich'), near('l', 'di-tich')] };
const longSet = { id: 'long', stops: [near('m', 'di-tich'), far('n', 'di-tich')] };
ranked = rankSets([longSet, shortSet], { weather: 'hot', now }, destinations);
assert.equal(ranked[0].id, 'short', 'hot should favour the shorter walk');

console.log('advisor.test.js ok');

// --- switchback: on an off-unit the crowd term is gone, everything else still ranks ---
{
  // 3 sites, >= 20 check-ins so live counts decide: median 20 -> 'q' quiet, 'b2' busy
  const dests = [near('q', 'di-tich'), near('b1', 'di-tich'), near('b2', 'di-tich')];
  const counts = { q: 0, b1: 20, b2: 30 };
  const quietSet = { id: 'qs', stops: [dests[0]] };
  const busySet = { id: 'bs', stops: [dests[2]] };
  const on = rankSets([busySet, quietSet], { weather: 'mild', now, counts, nudge: 1 }, dests);
  assert.equal(on[0].id, 'qs', 'nudge on: the uncrowded set ranks first');
  assert.equal(on[0].quiet, true);
  const off = rankSets([busySet, quietSet], { weather: 'mild', now, counts, nudge: 0 }, dests);
  assert.ok(off.every((x) => x.quiet === false), 'nudge off: no set is marked quiet');
  assert.equal(off[0]._score, off[1]._score, 'nudge off: crowd no longer separates them');
}
console.log('advisor switchback ok');
