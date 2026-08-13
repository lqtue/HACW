// What `src/hooks.server.js` enforces in front of every /api/* request. Pure, so
// node can test it — this is a trust boundary, the one place a silent mistake is
// expensive.

export const MAX_BYTES = 16384;

/**
 * @param {{ pathname: string, method: string, origin: string|null, siteOrigin: string, length?: number }} req
 * @returns {{ error: string, status: number } | null} null = let it through
 */
export function apiGuard({ pathname, method, origin, siteOrigin, length = 0 }) {
  if (!/\/api\//.test(pathname)) return null; // regex, not startsWith: BASE_PATH may prefix it
  // Writes must come from our own page. Doesn't stop curl, does stop every other
  // site's JavaScript from spending our KV quota.
  if (method !== 'GET' && method !== 'HEAD' && origin !== siteOrigin) {
    return { error: 'bad origin', status: 403 };
  }
  if (length > MAX_BYTES) return { error: 'too large', status: 413 };
  return null;
}

// The organizer-only reads (masked flag list, behaviour tallies) are gated in the
// UI by the client staff code, which is cosmetic — the endpoint itself must refuse
// a cross-site or scripted read. Sec-Fetch-Site is sent by every current browser
// and absent on a plain curl, so same-origin-only fails closed on both.
// ponytail: a spoofable header, not a secret. If this data ever gains value, swap
// for a signed token the organizer device presents.
export const isSameOrigin = (secFetchSite) => secFetchSite === 'same-origin';
