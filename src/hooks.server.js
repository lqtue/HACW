// One guard in front of every /api/* request; the rules live in $lib/guard.js so
// they can be unit-tested. Per-route validation stays in the route.
//
// ponytail: no per-IP rate limit in code — that would cost a KV write per
// request. Add a Cloudflare Rate Limiting rule on `/api/*` in the dashboard
// (free plan includes one) and Turnstile on the redeem path if abuse shows up.

import { apiGuard } from '$lib/guard.js';

export async function handle({ event, resolve }) {
  const { url, request } = event;
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
  return resolve(event);
}
