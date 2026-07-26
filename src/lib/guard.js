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
