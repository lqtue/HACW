# Hội An Creative Week

Mobile-first PWA: map of 25 destinations, two-tier GPS + quiz check-in, on-device
stamp passport with points and rank tiers, themed walking tours, organizer
dashboard. SvelteKit → Cloudflare Pages.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # geo / quiz / score / backup / route / hours / counters / SQL /
                   # API guard + content self-check
npm run build
```

The D1 binding only exists on Cloudflare, so dev has a stand-in: `vite.config.js`
serves `/api/checkin` and `/api/passport` from memory during `npm run dev`. It
starts empty — unlock staff mode (`?staff=2026`), check in a few times with the
🧪 button, and `/organizer` fills up, including the spotlight rebalancing.

## Architecture (deliberately tiny)

| Data | Where |
|------|-------|
| Destinations, quizzes, tours, rewards, ticket points, event copy | `src/lib/data/*.json` — frozen content, service-worker cached, works offline |
| Passport / stamps / points | `localStorage` (anonymous, per-device) |
| Check-in counts + behaviour events | `src/routes/api/checkin/+server.js` → Cloudflare D1, `counters` table (no Google Analytics — this is the analytics) |
| Passport backup | `src/routes/api/passport/+server.js` → same D1, `passports` table, keyed by the device's recovery code |

No backend DB, no auth, no CMS. Check-in runs fully client-side (GPS + quiz +
stamp); analytics events queue in `localStorage` and POST on reconnect.

One-page picture of the whole thing — phone, edge, D1, organizer, and what still
works when the server is gone: **`docs/hacw-architecture.excalidraw`** (drag it
onto [excalidraw.com](https://excalidraw.com), everything is editable).

## Scoring, rewards, and spreading the crowd

`src/lib/score.js` is the whole rule set:

| Award | Points |
|-------|--------|
| Check-in | 10 |
| Quiz with no wrong taps | +5 |
| **Spotlight site** | +10 |
| Completed tour set | +30 |
| All 25 sites | +100 |

**Spotlight** is the lever for "get every site visited, evenly". The app pulls
live counts from `GET /api/checkin`, and the quieter half of the map earns the
bonus — shown as a gold halo on the map pin and a banner on the site page. It
re-balances itself as the week goes on, with no one having to edit anything.
Before there is enough data (or on a static deploy with no API), it falls back
to the survey sheet's own `traffic` / `promoPriority` columns.

Reward tiers live in `src/lib/data/rewards.json` (3 / 8 / 15 / 25 stamps) and
are handed over at a ticket counter with the same staff-code confirm as tour
vouchers.

## Map & tours

The map has two base layers: CARTO Voyager (tinted to the paper palette) and
Esri World Imagery for satellite. **Not Google satellite** — Google's tiles are
only licensed through their paid Maps APIs. Pins carry a category colour, a gold
halo when spotlighted, a popup with hours/address/status, and tapping one
highlights and scrolls to that site's card in the strip below.

`/tours` is an accordion: tapping a tour opens its route map (dashed line,
numbered stops), the walking distance and time, and the per-leg distances.
Walking cost is a straight-line chain × 1.3 detour factor at 75 m/min
(`src/lib/route.js`) — good enough for a label in a dense old town, no routing
API needed.

## Organizer dashboard

`/organizer` — check-ins per site (ascending, so the cold ones are on top),
total, sites covered, an **evenness** score (100% = every site equally visited),
which sites are currently bonus-boosted, the nearest ticket counter to each site
(where to send flyers), CSV export, plus the two data-quality lists: coordinates
still to survey and quiz banks still auto-generated.

Behind the staff code (`src/lib/staff.svelte.js`) — the same one that unlocks the
skip-GPS button and voucher confirmation. `?staff=<code>` unlocks a device once,
`?staff=0` locks it. That is a mis-tap guard, not security: put Cloudflare Access
in front of the route if the numbers must not be public.

Below the data-quality lists it also shows the non-check-in events the app
reports — failed GPS, how far off people were, wrong quiz taps, vouchers handed
over. Same offline-tolerant queue, so nothing is lost in a dead spot.

Last comes **passports to review**: stamp histories that could not have been
walked (`src/lib/fraud.js` — over 150 m/min between stamps, or 6 stamps inside 10
minutes). Recovery codes are masked. This is advisory and nothing more: the app
cannot prevent a faked check-in, so the flag exists to make cheating visible and
to tell the staff member at the counter to ask a question — never to refuse a
voucher on its own. `CONCERNS.md` §3b is the full threat model.

## Using it with no signal

The home page has an **install** button (Chrome/Android gets the real prompt,
iOS shows the Share → Add to Home Screen instruction). Installing precaches every
page, the content JSON and the fonts, so the whole app except the map tiles works
with no data.

Map tiles can't be precached — there are thousands and bulk-downloading them
breaks CARTO/Esri terms. Instead the service worker keeps the last 600 tiles the
visitor actually looked at (`runtimeCaching` in `vite.config.js`), so panning the
old town once on wifi leaves the map usable offline.

## Losing your phone / clearing the browser

The passport is anonymous and on-device, so it needs a way back:

- Every device gets an 8-character **recovery code** (shown on the passport page).
  The passport is backed up to D1 shortly after every change, and on reconnect.
  Entering the code on another device merges the stamps back.
- A **backup link** (`/passport#r=…`) carries the whole passport in the URL —
  works with no server at all — hand it out if the database is ever down.

The code is shown full-screen right after the **first** stamp, with a prompt to
screenshot it — that is the only backup that survives Safari evicting
`localStorage` (which it does after ~7 days of not opening the site).

Restore always merges, never overwrites: it can add stamps, never remove them.
Going offline mid-visit loses nothing — check-in, quiz and stamps are all local,
and the queued events upload on reconnect.

## Editing content

Content comes from the survey team as Google-Sheets CSV exports in
`content/csv/`:

```bash
node scripts/import-csv.mjs             # regenerate destinations.json + ticket-points.json
node scripts/import-csv.mjs --resolve   # also re-follow the Maps links for fresh coordinates
```

The importer preserves hand-written quiz banks and English copy; the sheet owns
address, hours, traffic, promo priority and the Vietnamese intro text. Sites
with no real quiz bank yet get questions generated from their own sheet row
(street / category / opening hours) and flagged `"generated": true`.

`npm test` includes `scripts/check-data.mjs`, which fails on a missing `vi`/`en`
field, a pin outside Hội An, a quiz answer index out of range, or a site that
belongs to no tour.

**Verify `lat`/`lng`/`radius` for every destination on-site before the event.**
`radius` (meters) is the GPS tolerance per spot.

## Deploy

**Cloudflare Pages** (`adapter-cloudflare`): connect the repo, build command
`npm run build`, output directory `.svelte-kit/cloudflare`. Then the database:

```bash
npx wrangler d1 create hacw
npx wrangler d1 execute hacw --remote --file=schema.sql
```

and bind it to the Pages project as **`DB`** (Settings → Bindings → D1). Add a
Rate Limiting rule on `/api/*` while you are in the dashboard.

D1 rather than KV because the free tier actually covers this event (~100k row
writes/day) and its upserts are atomic — counters can't lose an increment under a
crowd. Only aggregates are stored (`schema.sql`), never one row per check-in:
that is what keeps a dashboard refresh at ~50 rows read.

The API lives in `src/routes/api/`, **not** in a `functions/` directory: the
adapter emits a `_worker.js`, and Pages ignores `functions/` when that exists.

The GitHub Pages workflow was removed with the move to Cloudflare — `adapter-static`
cannot serve the API, so the counter, live spotlight and code-based passport
backup would all no-op there. `git revert` it if a static demo is ever wanted back.

## TODO before launch

- Change the staff code `CODE` in `src/lib/staff.svelte.js` (it gates the
  skip-GPS button, `/organizer` and voucher confirmation).
- Verify all coordinates + radii on-site (5 are estimates — see `/organizer`).
- Replace the 19 auto-generated quiz banks with real questions (target 10/site).
- Add real destination photos (set `image` in `destinations.json`).
- Replace `static/icon.svg` with 192/512 PNG icons for full iOS install fidelity.
