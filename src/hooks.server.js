// One guard in front of every /api/* request; the rules live in $lib/guard.js so
// they can be unit-tested. Per-route validation stays in the route.
//
// Per-IP rate limit uses Cloudflare's native ratelimit binding (API_LIMITER in
// wrangler.toml): in-memory per-colo, free, no KV/D1 write per request — so a
// flood of check-ins or random passport pids can't drain the D1 free-tier quota.
// ponytail: per-colo counter, not global, and only on Cloudflare (dev has no
// platform, so it's skipped). Add a zone-level dashboard rule too if you move to
// a custom domain and want it counted across locations.

import { apiGuard } from '$lib/guard.js';

const json429 = () =>
  new Response(JSON.stringify({ error: 'rate limited' }), {
    status: 429,
    headers: { 'content-type': 'application/json' }
  });

export async function handle({ event, resolve }) {
  const { url, request, platform } = event;
  const bad = apiGuard({
    pathname: url.pathname,
    method: request.method,
    origin: request.headers.get('origin'),
    siteOrigin: url.origin,
    length: Number(request.headers.get('content-length') ?? 0)
  });
  if (bad) {
    return new Response(JSON.stringify({ error: bad.error }), {
      status: bad.status,
      headers: { 'content-type': 'application/json' }
    });
  }
  // Path first: /api/* routes are prerender=false, so this only runs at request
  // time on Cloudflare. Touching platform.env on a prerenderable page throws.
  if (/\/api\//.test(url.pathname)) {
    const limiter = platform?.env?.API_LIMITER;
    if (limiter) {
      const ip = request.headers.get('cf-connecting-ip') ?? 'anon';
      const { success } = await limiter.limit({ key: ip });
      if (!success) return json429();
    }
  }
  return resolve(event);
}
