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

The map is **our own basemap**: MapLibre GL over a Protomaps extract of the old
town shipped inside the app. No API key, no tile server, no per-view cost — and
because every byte it needs is a static file, it draws with no signal at all.

It is drawn as a **printed plan, not a picture of a city**: the basemap is
deliberately almost colourless — ivory land, white streets, a barely-tinted Hoài
river — so the only saturated things on it are the 25 destinations. Sites are a
real map layer, not markers: one symbol layer whose
pins are the **mắt cửa** door-eye mark drawn on a canvas in the category colour,
so they scale with zoom, collide their labels properly, dim when a site is closed
and wear a gold spark where the spotlight bonus is live. Tapping one opens a popup
(hours/address/status) and scrolls to that site's card in the strip below. The 3D
button tilts the camera and raises the shophouses when you want the massing.
Satellite is **Esri World Imagery**, not Google — Google's tiles are only
licensed through their paid Maps APIs — and it replaces the vector basemap
wholesale so the paper palette never bleeds through the photo.

Everything the map needs is a static file under `static/map/` — `hoian.pmtiles`
(1.3 MB, z0–15, overzoomed past that), the Noto Sans glyph ranges the labels
need, and the sprite. The archive is fetched whole and read from memory rather
than by HTTP range, so the service worker can **precache** it like any other
asset — the map works on a phone that has never had signal, not just on one that
opened it online first. Colours live in `src/lib/map-style.js`: the Protomaps
`LIGHT` flavor with the keys that matter overridden to the event palette (paper
earth, ochre old-town walls, a teal Hoài river, warm pedestrian streets, warm
muted POI labels), plus the sky, the light and the building extrusion.

The archive's bbox is the map's `maxBounds`, so panning can't reach blank paper.
`npm test` fails if a destination or ticket counter is ever edited to sit outside
it, or if a name needs a glyph range the build doesn't ship.

Regenerate the extract when the OSM data moves on (needs the `pmtiles` CLI,
`brew install pmtiles`; pick a recent daily build):

```bash
pmtiles extract https://build.protomaps.com/20260804.pmtiles static/map/hoian.pmtiles \
  --bbox=108.3150,15.8690,108.3420,15.8860 --maxzoom=15
```

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

Behind the staff code (`src/lib/staff.svelte.js`) — the volunteer code, the same
one that unlocks the skip-GPS button and voucher confirmation, gets the dashboard
read-only; the organizer code adds the content editors — four tabs covering
destinations and quiz banks, tours and their stop order, reward tiers, and the
home-page copy. Each one validates as you type and then downloads its JSON for a
developer to commit; nothing is written server-side.
`?staff=<code>` unlocks a device once,
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

Nothing the app *needs* comes from another host, so "offline" is the normal case
rather than a degraded one. One visit — installed or not — precaches ~4.8 MB in
the background: all 34 prerendered pages, every JS/CSS chunk (the content JSON is
compiled into them), the typeface, and the whole of `static/map/`. Airplane mode
after that leaves the map, the destinations, the quizzes, check-in, the stamps and
the score exactly as they were. The home page also has an **install** button
(Chrome/Android gets the real prompt, iOS shows the Share → Add to Home Screen
instruction), which is about having an icon and no browser chrome, not about
caching.

Two things still want the network, both behind an explicit tap and neither on the
path to a stamp:

- **Satellite** imagery — thousands of Esri tiles, and bulk-downloading them
  breaks their terms, so the service worker just keeps the last 600 the visitor
  actually looked at (`runtimeCaching` in `vite.config.js`).
- **Directions** links, which hand off to Google Maps.

The typeface is self-hosted for the same reason: a Google Fonts `<link>` can only
ever be runtime-cached, i.e. wrong on the first offline load. `src/lib/fonts/`
holds 5 weights × 3 subsets (160 KB), declared at the top of `app.css`. To add a
weight, edit the `wght@` list and re-run:

```bash
node --input-type=module -e '
import { writeFileSync } from "node:fs";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const css = await (await fetch("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap", { headers: { "user-agent": UA } })).text();
for (const b of css.split("/* ").slice(1)) {
  const subset = b.slice(0, b.indexOf(" */"));
  const weight = b.match(/font-weight: (\d+)/)[1];
  const url = b.match(/url\((https:[^)]+)\)/)[1];
  writeFileSync(`src/lib/fonts/bvp-${weight}-${subset}.woff2`, Buffer.from(await (await fetch(url)).arrayBuffer()));
  console.log(weight, subset, b.match(/unicode-range: ([^;]+);/)[1]);
}'
```

(the printed `unicode-range` is what each new `@font-face` needs — without it the
browser downloads all three subsets for every glyph).

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
field, a pin outside Hội An, a quiz answer index out of range, or two tours
claiming the same stop. A site in no tour is fine — it still earns stamps and
points, it just is not part of a voucher set.

**Verify `lat`/`lng`/`radius` for every destination on-site before the event.**
`radius` (meters) is the GPS tolerance per spot.

## Deploy

**Cloudflare Pages** (`adapter-cloudflare`), live at <https://hacw.pages.dev>.

The Pages project is **connected to this GitHub repo**: pushing to `main` builds
and deploys on its own, and every other branch gets a preview URL. There is no
manual deploy step — `npx wrangler pages deploy` is not part of the workflow any
more, and running it would push a Direct Upload deployment into a Git project.

Build command `npm run build`, output directory `.svelte-kit/cloudflare`, both
already configured. Leave `BASE_PATH` **unset**: it exists for subpath previews,
and setting it breaks every link on the root domain.

The `DB` binding comes from `wrangler.toml` in this repo, not from the dashboard —
the Pages build reads it, so the binding survives a rebuild and lives in version
control. The database itself is created once:

```bash
npx wrangler d1 create hacw
npx wrangler d1 execute hacw --remote --file=schema.sql
```

Add a Rate Limiting rule on `/api/*` in the dashboard — that part has no API.

D1 rather than KV because the free tier actually covers this event (~100k row
writes/day) and its upserts are atomic — counters can't lose an increment under a
crowd. Only aggregates are stored (`schema.sql`), never one row per check-in:
that is what keeps a dashboard refresh at ~50 rows read.

The API lives in `src/routes/api/`, **not** in a `functions/` directory: the
adapter emits a `_worker.js`, and Pages ignores `functions/` when that exists.

The GitHub Pages workflow was removed with the move to Cloudflare — `adapter-static`
cannot serve the API, so the counter, live spotlight and code-based passport
backup would all no-op there. It is no longer a dependency either; `git revert`
the removal and reinstall it if a static demo is ever wanted back.

## TODO before launch

- Change both staff codes (`VOLUNTEER`, `ORGANIZER`) in `src/lib/staff.svelte.js` (they gate the
  skip-GPS button, `/organizer` and voucher confirmation).
- Verify all coordinates + radii on-site (5 are estimates — see `/organizer`).
- Replace the 19 auto-generated quiz banks with real questions (target 10/site).
- Add real destination photos (the unused `image` field was dropped from
  `destinations.json`; re-add it in `scripts/import-csv.mjs` when photos exist).
- Replace `static/icon.svg` with 192/512 PNG icons for full iOS install fidelity.
