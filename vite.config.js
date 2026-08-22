import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { tally, totals } from './src/lib/counts.js';
import { flagPassport } from './src/lib/fraud.js';

const destinations = JSON.parse(readFileSync('./src/lib/data/destinations.json', 'utf8'));

// Match SvelteKit's base path so the PWA manifest/SW resolve under /<repo> on GitHub Pages.
const base = process.env.BASE_PATH ?? '';

/**
 * Dev-only stand-in for the /api routes. They exist as real SvelteKit endpoints
 * (`src/routes/api/*`), but their D1 binding (`platform.env.DB`) only exists on
 * Cloudflare, so in `npm run dev` they would always answer empty.
 * This middleware runs first and keeps the state in memory instead: check in a
 * few times (the staff 🧪 button) and the organizer dashboard fills up.
 */
function devApi() {
  const counters = {};
  const passports = {};
  const flags = {};
  const send = (res, obj, status = 200) => {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(obj));
  };
  const body = (req) =>
    new Promise((resolve) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve(null);
        }
      });
    });

  return {
    name: 'hacw-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        const path = url.pathname.replace(base, '');
        if (path === '/api/checkin') {
          if (req.method === 'GET') {
            return send(res, totals(Object.entries(counters), url.searchParams.has('events')));
          }
          if (req.method === 'POST') {
            // Same validation and key layout as the real endpoint, so dev shows
            // exactly what production would store — this stands in for the
            // `counters` table, upsert and all.
            const events = (await body(req))?.events ?? [];
            for (const [k, n] of Object.entries(tally(events))) {
              counters[k] = (counters[k] ?? 0) + n;
            }
            return send(res, { ok: true, counted: events.length });
          }
        }
        if (path === '/api/passport') {
          if (req.method === 'PUT') {
            const snap = await body(req);
            if (snap?.pid) {
              passports[snap.pid] = snap;
              flags[snap.pid] = flagPassport(snap.stamps, destinations).length;
            }
            return send(res, { ok: true });
          }
          if (req.method === 'GET') {
            if (url.searchParams.has('flagged')) {
              return send(
                res,
                Object.entries(flags)
                  .filter(([, n]) => n > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([pid, n]) => ({
                    pid: `${pid.slice(0, 2)}••••${pid.slice(-2)}`,
                    flags: n,
                    updated: Date.now()
                  }))
              );
            }
            const stored = passports[url.searchParams.get('pid')];
            return stored ? send(res, stored) : send(res, { error: 'not found' }, 404);
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  // Let a phone reach the dev server through an HTTPS tunnel (cloudflared / ngrok)
  // for on-device GPS + compass testing — Vite otherwise 403s unknown Host headers.
  // Dev-only; the prod build ignores this.
  server: { allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io', '.ngrok.app'] },
  // MapLibre spawns its worker with `new URL('./maplibre-gl-worker.mjs',
  // import.meta.url)`. Pre-bundled into .vite/deps that path does not exist, so
  // the worker 404s in dev — serving the package unbundled keeps it resolvable.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  plugins: [
    devApi(),
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Tuần lễ Sáng tạo Hội An 2026',
        short_name: 'HACW 2026',
        description: 'Khám phá, check-in và sưu tầm tem Tuần lễ Sáng tạo Hội An 2026',
        lang: 'vi',
        theme_color: '#e85f34',
        background_color: '#fbe3da',
        display: 'standalone',
        start_url: base + '/',
        scope: base + '/',
        icons: [
          { src: base + '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          // full-bleed square PNGs (no rounded corners) so the platform mask has no
          // transparent corners to show through — see static/icon-maskable.svg
          { src: base + '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: base + '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        // Precache all built assets incl. the content JSON -> destinations/quizzes work fully offline.
        // The basemap (map/**: the .pmtiles archive, the glyph ranges, the
        // sprite) is in here too. It used to be runtime-cached to keep a first
        // visit light, but "light" meant the map only worked offline if the
        // visitor had already opened it *online* — which is exactly the phone
        // that has no signal in an old-town alley. ~2.4 MB, fetched by the
        // service worker in the background after first paint, once.
        //
        // There is no `runtimeCaching` at all any more, on purpose: after this
        // precache the app makes no request the network could fail. The only
        // outbound links left are the Google Maps directions hand-offs, which
        // leave the app entirely.
        globPatterns: ['**/*.{js,css,html,json,svg,png,webmanifest,woff2}', 'client/map/**/*'],
        // The .pmtiles archive alone is 1.2 MB; the default 2 MB cap would skip it.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      }
    })
  ]
});
