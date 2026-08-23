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

// Missing basemap glyph range -> empty glyphs, not a 404. Our glyph set is trimmed
// to Latin+Vietnamese (static/map/fonts) to keep the offline bundle small; a
// foreign-script basemap label (Cyrillic/Thai/CJK) then asks for a range we don't
// ship. An empty 200 lets MapLibre render that codepoint locally, silently, instead
// of throwing an AJAXError per glyph. Existing ranges are served as static assets
// before SvelteKit, so only a genuinely-missing range ever reaches this handler.
// Mirrors the dev fallback in vite.config.js (devGlyphs).
const GLYPH_RE = /\/map\/fonts\/[^/]+\/\d+-\d+\.pbf$/;

export async function handle({ event, resolve }) {
  const { url, request, platform } = event;
  if (GLYPH_RE.test(url.pathname)) {
    return new Response(new Uint8Array(0), {
      status: 200,
      headers: { 'content-type': 'application/x-protobuf', 'cache-control': 'public, max-age=604800' }
    });
  }
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
