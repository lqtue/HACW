import assert from 'node:assert';
import { isValidSet, TICKETS } from './ticket.js';

const dests = [
  { id: 'm1', ticketClass: 'monument' },
  { id: 'm2', ticketClass: 'monument' },
  { id: 'mu1', ticketClass: 'museum' },
  { id: 'mu2', ticketClass: 'museum' },
  { id: 'o1', ticketClass: 'other' },
  { id: 'o2', ticketClass: 'other' },
  { id: 'o3', ticketClass: 'other' },
  { id: 'o4', ticketClass: 'other' }
];

// valid 5-set: 1 monument + 1 museum + 3 other
assert.ok(isValidSet(['m1', 'mu1', 'o1', 'o2', 'o3'], dests, 5));
// free slots may be a second monument/museum — recipe is minimums
assert.ok(isValidSet(['m1', 'mu1', 'm2', 'mu2', 'o1'], dests, 5));
// missing a museum -> invalid
assert.ok(!isValidSet(['m1', 'o1', 'o2', 'o3', 'o4'], dests, 5));
// missing a monument -> invalid
assert.ok(!isValidSet(['mu1', 'mu2', 'o1', 'o2', 'o3'], dests, 5));
// wrong length
assert.ok(!isValidSet(['m1', 'mu1', 'o1', 'o2'], dests, 5));
// duplicate stop
assert.ok(!isValidSet(['m1', 'mu1', 'o1', 'o1', 'o2'], dests, 5));
// unknown id
assert.ok(!isValidSet(['m1', 'mu1', 'o1', 'o2', 'zzz'], dests, 5));

// 3-site: 1 monument + 2 free, no museum required
assert.ok(isValidSet(['m1', 'o1', 'o2'], dests, 3));
assert.ok(!isValidSet(['mu1', 'o1', 'o2'], dests, 3));

// accepts an id->dest map too
const byId = Object.fromEntries(dests.map((d) => [d.id, d]));
assert.ok(isValidSet(['m1', 'mu1', 'o1', 'o2', 'o3'], byId, 5));

// unknown size
assert.ok(!isValidSet(['m1', 'mu1', 'o1', 'o2', 'o3'], dests, 4));
assert.equal(TICKETS[5].size, 5);

console.log('ticket.test.js ok');
