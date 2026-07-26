import assert from 'node:assert';
import { apiGuard, MAX_BYTES } from './guard.js';

const site = 'https://hacw.pages.dev';
const req = (over = {}) => ({
  pathname: '/api/checkin',
  method: 'POST',
  origin: site,
  siteOrigin: site,
  length: 100,
  ...over
});

// --- the happy path stays open ---
assert.equal(apiGuard(req()), null, 'our own page can write');
assert.equal(apiGuard(req({ method: 'GET', origin: null })), null, 'counts are public');
assert.equal(apiGuard(req({ method: 'PUT' })), null, 'passport backup is a write we allow');
assert.equal(apiGuard(req({ pathname: '/destinations/chua-cau', origin: null })), null, 'pages are not guarded');
assert.equal(apiGuard(req({ pathname: '/HACW/api/checkin' })), null, 'BASE_PATH prefix still matches');

// --- writes from someone else's site are refused ---
assert.deepEqual(apiGuard(req({ origin: 'https://evil.example' })), { error: 'bad origin', status: 403 });
assert.deepEqual(apiGuard(req({ origin: null })), { error: 'bad origin', status: 403 }, 'curl has no Origin');
assert.deepEqual(
  apiGuard(req({ pathname: '/HACW/api/passport', method: 'PUT', origin: 'https://evil.example' })),
  { error: 'bad origin', status: 403 },
  'the guard covers every /api/ route, not just check-in'
);
assert.equal(
  apiGuard(req({ pathname: '/api/checkin', method: 'GET', origin: 'https://evil.example' })),
  null,
  'reads are deliberately open — the numbers are public'
);

// --- oversized bodies never reach the route ---
assert.deepEqual(apiGuard(req({ length: MAX_BYTES + 1 })), { error: 'too large', status: 413 });
assert.equal(apiGuard(req({ length: MAX_BYTES })), null, 'exactly at the limit is fine');
assert.equal(apiGuard(req({ method: 'GET', origin: null, length: MAX_BYTES + 1 })).status, 413);

console.log('guard.test.js ok');
