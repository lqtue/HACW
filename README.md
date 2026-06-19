# Hội An Creative Week

Mobile-first PWA: map of destinations, two-tier GPS + quiz check-in, on-device
stamp passport, themed walking tours. SvelteKit → Cloudflare Pages.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run test:geo   # distance / radius self-check
npm run build
```

## Architecture (deliberately tiny)

| Data | Where |
|------|-------|
| Destinations, quizzes, tours, event copy | `src/lib/data/*.json` — frozen content, service-worker cached, works offline |
| Passport / stamps | `localStorage` (anonymous, per-device) |
| Check-in counts | `functions/api/checkin.js` → Cloudflare KV |

No backend DB, no auth, no CMS. Check-in runs fully client-side (GPS + quiz +
stamp); analytics events queue in `localStorage` and POST on reconnect.

## Editing content

Edit the JSON in `src/lib/data/` and redeploy. **Verify `lat`/`lng`/`radius`
for every destination against the real site before the event** — the sample
coordinates are approximate. `radius` (meters) is the GPS tolerance per spot.

## Deploy (Cloudflare Pages)

1. Push to a repo, connect it in Cloudflare Pages. Build: `npm run build`, output: `.svelte-kit/cloudflare`.
2. Create a KV namespace, bind it to the Pages project as `CHECKINS` (Settings → Functions → KV bindings).
3. Organizers read tallies at `GET /api/checkin`.

Without the KV binding the app still works — check-in counting is simply a no-op.

## TODO before launch

- Replace `static/icon.svg` reference with 192/512 PNG icons for full iOS install.
- Add real destination photos (set `image` in `destinations.json`, render in Card/detail).
- Verify all coordinates + radii on-site.
