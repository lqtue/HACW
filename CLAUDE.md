# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server (+ in-memory /api stand-in, see devApi in vite.config.js)
npm run build        # Cloudflare Pages build into .svelte-kit/cloudflare/
npm run preview      # preview the production build
npm test             # node self-checks: geo, quiz draw, scoring, backup/merge, route,
                     # hours, counter keys + event validation, the D1 SQL against
                     # a real sqlite, API guard, map style (layer ids, glyph
                     # coverage, pins inside the tile extract),
                     # + scripts/check-data.mjs (content integrity). No framework.
node scripts/import-csv.mjs [--resolve]   # survey CSV -> destinations/ticket-points JSON
```

No lint step. Deploy target is **Cloudflare Pages** (`adapter-cloudflare`), live at
hacw.pages.dev. The project is **Git-connected**: pushing `main` builds and deploys
itself, other branches get preview URLs. Don't run `wrangler pages deploy` — a
Direct Upload into a Git project is exactly the mess this replaced. The `DB` D1
binding comes from `wrangler.toml` in the repo, not the dashboard, so it survives
rebuilds. `BASE_PATH` still exists for subpath previews and must stay empty in
production (setting it breaks every link on the root domain).

## What this is

Mobile-first PWA for the Hội An Creative Week event (content is in Vietnamese):
map of destinations → two-tier check-in (GPS + quiz) → on-device stamp
passport → themed walking tours. SvelteKit 5 (runes) + MapLibre GL over a
self-hosted Protomaps basemap.

## Architecture — there is no backend

Storage is three deliberately separate tiers:

| Data | Where | Notes |
|------|-------|-------|
| Destinations, quizzes, tours, rewards, ticket points, event copy | `src/lib/data/*.json` | The content **is** these files. Editing JSON = editing the app. Service-worker cached → works offline. Generated from `content/csv/` by `scripts/import-csv.mjs`. |
| Passport / stamps / points | `localStorage` | Anonymous, per-device. No accounts. |
| Check-in counts + behaviour events | `src/routes/api/checkin/+server.js` → Cloudflare D1 (`counters` table) | Feeds the organizer dashboard *and* the spotlight bonus. There is **no Google Analytics** — this endpoint is the analytics. |
| Passport backup | `src/routes/api/passport/+server.js` → same D1 (`passports` table) | Keyed by the device's 8-char recovery code. Merge-only. |

The app is fully usable with just the first two tiers. Check-in (GPS + quiz +
stamp) is entirely client-side; analytics events queue in `localStorage`
(`hacw_checkin_queue_v1`) and POST to `/api/checkin` on reconnect — failure is
swallowed, so a missing endpoint is harmless. Same for every other server call:
each one degrades to a no-op, never to an error the visitor sees.

The D1 binding (`platform.env.DB`) only exists on Cloudflare, so under
`npm run dev` the endpoints would always answer empty. `vite.config.js` has a
dev-only `devApi()` plugin that intercepts `/api/checkin` and `/api/passport`
first and keeps the state in memory (`apply: 'serve'`, never in a build). It
starts empty — check in a few times and the organizer dashboard fills up.

### Why the API is in `src/routes/api/`, not `functions/`

`adapter-cloudflare` emits a `_worker.js`, and **Cloudflare Pages ignores the
`functions/` directory whenever `_worker.js` exists**. Pages Functions and this
adapter are mutually exclusive; the endpoints are ordinary SvelteKit
`+server.js` routes with `export const prerender = false`, reading D1 from
`platform.env.DB`. Do not move them back.

`src/hooks.server.js` guards every `/api/*` request: same-origin required for
writes, 16 KB body cap (rules in `$lib/guard.js`, unit-tested). Per-IP rate
limiting is a Cloudflare dashboard rule, not code.

### Storage: D1 — aggregates for ops, one event log for the study

`schema.sql` has three tables. `counters` holds one row per key — `count:<destId>`
for check-ins, `ev:<type>[:<destId>]` for everything else, `nat:<type>:<id>:<code>`
for the nationality cross-tab — and writes are `INSERT … ON CONFLICT DO UPDATE SET
n = n + ?`, i.e. **atomic**, which is why there is no sharding and no lost-update
caveat. It is the **ops** store: spotlight and the dashboard read only it. The read
is a primary-key **range** (`k >= ? AND k < ?` via `prefixRange()`), not `LIKE` —
LIKE can't use the index and the table is a few thousand rows now, not 50.

`events` is the **study** store (`src/lib/switchback.js`, `eventRows()` in
`counts.js`): one row per accepted event, stamped with the *server* clock, the
half-day switchback unit (`day`, `half`, `nudge` from the pre-registered
`SCHEDULE`), whether the site was spotlight on the client (`spot`), nationality,
an ephemeral per-visit `sid`/`seq` (dies with the tab; absent only when the visitor
switched the study off), and `tk` = ticket type (5 | 3), the cheapest segment.
**Device-free by design**: no pid, no device id. Per-device questions (plan
adherence) are answered from `passports.snapshot`, which now carries `plan` (the
5 chosen ids) and `spot` on each stamp. Each client event has a random `eid`;
`INSERT OR IGNORE` on it makes a re-sent queue chunk exactly-once in the log (the
counters still double-bump on a retry — ops only, accepted). Both stores are
written in **one `db.batch`** so they cannot disagree. Nobody reads `events` live:
it is for SQL / CSV after the festival — the queries it exists to answer are listed
in `schema.sql`. Write volume (~2 rows per event) needs the **paid Workers plan**;
the free tier's 100k rows/day is not enough for a festival day.

The statements live in `src/lib/sql.js` so `sql.test.js` can run them against a
real SQLite (`node:sqlite`) — D1 *is* SQLite, so the upsert arithmetic, the
dedupe, the index usage (`EXPLAIN QUERY PLAN`) and the switchback stamping are
verified, not assumed. Bind order is documented on each export.

The client queue (`flush()` in `passport.svelte.js`) drains in chunks of 50 =
server `MAX_EVENTS`; sending the whole queue silently lost everything past 50 and
wedged past ~160 events on the 16 KB body guard.

### Base path — the #1 way to break this

Everything is prerendered under a repo subpath (`/HACW`). `BASE_PATH` env →
`kit.paths.base`. **Every internal link must be prefixed with `base` from
`$app/paths`** — a root-absolute `href="/foo"` or `goto('/foo')` works in dev
but 404s on the deployed subpath. This includes hrefs inside map popup HTML
strings and `goto()` calls. `app.html` uses `%sveltekit.assets%` for the same
reason; `vite.config.js` prefixes the PWA manifest paths with `base`.

### Prerendering

`src/routes/+layout.js` sets `prerender = true` for the whole app. Dynamic
routes (`destinations/[id]`, `tours/[id]`) must export an `entries()` from their
`+page.js` listing every id, or those pages won't be generated.

## Key flows

**Check-in** (`src/routes/destinations/[id]/+page.svelte`): a small step state
machine `idle → locating → (far | quiz | cooldown) → done`. Tier 1 is GPS distance
vs the destination's `radius` (default **75 m**, per-destination — wide on purpose,
old-town alleys multipath badly); tier 2 is the quiz. The "skip GPS" test button
only renders when the staff code is unlocked (`staff.on`), so it can't ship to
visitors by accident. The quiz draws **2 easy + 1 hard** from the destination's
`quizBank` (target 10/site) via `src/lib/quiz.js`; all drawn questions must be
answered correctly to earn the stamp. **One wrong answer throws the whole draw
away and locks the site for 20 s** (`COOLDOWN`) — guessing costs time and the
perfect-answer bonus. The answers still ship in `destinations.json`, so this
slows brute force, it doesn't prevent it; staff handing over the paper voucher
is the real gate.

**Staff mode** (`src/lib/staff.svelte.js`): two codes, both remembered in
`localStorage`. `VOLUNTEER` (`2026`) → `staff.on`: skip-GPS button, voucher
confirm, `/organizer` read-only. `ORGANIZER` (`2026hacw`) → `staff.on` *and*
`staff.admin`, which additionally shows the content editor in `/organizer`.
`?staff=<code>` on any URL unlocks a device, `?staff=0` locks it. Client-side:
stops mis-taps and curious visitors, not fraud.

**Content editors** (`staff.admin` only, tabbed at the bottom of `/organizer`):
three editable files, one shell. `JsonFile.svelte` owns the whole flow — clone the
shipped JSON, validate on every keystroke, **download** it, read an edited file
back in, reset — and renders a `children(data)` snippet with the working copy.
The three bodies are `DataEditor` (destinations), `TourEditor` (tours) and
`RewardEditor` (tiers). `Bi.svelte` is the `{ vi, en }` field pair they all use.
Nothing is written server-side; the file is committed and redeployed.

All three edit as **tables** (`.ed-table`) — one row per record, one input per
cell, so 25 sites are comparable at a glance and the survey-critical numbers
(lat/lng/radius) line up in columns. Fields too long for a cell (intro copy, quiz
banks, tour stops) live in a detail row that opens under the record, tracked by a
plain `$state({})` id map so several can be open at once.

There was a fourth editor, `EventEditor` over `event.json` (home hero copy). Both
are gone: the rebuilt home page is the planner and imports no event copy, so the
tab edited text nothing rendered.

A volunteer-tier device sees the dashboard but no editor. That branch renders an
explanation *and* a code box, because once any code is accepted the gate box at the
top is gone — without it a volunteer has no route to the organizer tier but editing
the URL, and the missing editor reads as a broken page.

`/organizer` is the one route used at a desk: `+layout.svelte` puts `.wide` on
`.app` for it, lifting the 540px phone column to 1600px. The dashboard half keeps
a 900px `.dash` cap — only the editors want the full width.

Validation lives in `src/lib/editor.js` — `checkDestinations`, `checkTours` and
`checkRewards` — and `scripts/check-data.mjs` runs those same three in `npm test`, so the download button is disabled on anything the repo would
reject. Cross-file rules that a single editor cannot see stay in `check-data.mjs`;
"no two tours claim the same stop" and "no tour points at an unknown id" are
enforced by passing the destination ids into `checkTours`. A site in **no** tour
is allowed on purpose: only surveyed walking routes ship as tours, and the rest
still stamp and score — they just form no voucher set, and the passport groups
them into a final "other sites" block. Editor CSS is global (`.ed-*` in `app.css`) because Svelte
scopes component styles and four editors would otherwise carry four copies.

**Fraud flagging** (`src/lib/fraud.js`, pure): `flagPassport(stamps, destinations)`
returns impossible-travel and burst findings; `PUT /api/passport` stores the count
in `passports.flags`. Shown as a masked review list in `/organizer` and as a
warning inside `StaffConfirm`. **Advisory by design — never blocks a redemption.**
The app cannot prevent faked check-ins (GPS is self-reported, quiz answers ship in
the JSON); this makes cheating visible instead. Threat model: `CONCERNS.md` §3b.

**Switchback** (`src/lib/switchback.js`, pure): the dispersal study's on/off
schedule — 28 Aug–2 Sep 2026, half-day units switching at 13:00 local, days 1–4
alternating (AM and PM each 2 on / 2 off), days 5–6 off as the persistence tail.
Outside the table every unit is **on**, so dev/preview and any other date behave
as today. The server stamps `nudge` on every logged event from it and the client obeys it:
on an off unit the spotlight is hidden on the map and site page, and the planner
(`rankSets` `ctx.nudge`, `bestFrom`) drops the crowd term. Points are identical
either way and the logged `spot` is the *true* quiet state, not what was shown.
Do not edit the table during the event — it is the pre-registration.

**Study consent** is one toggle (`research.svelte.js`, default **on**, shown on
the scan step and the passport page) covering the footfall `cell` counts and the
per-visit `sid`. The terms page and `research_optin` list exactly what is sent.
Behaviour-detail events (`plan_pick` with position + spot, `arrive`, `quiz_ok`,
`view_site`) exist so that, per `sid`, plan adherence, arrivals that never
stamped, per-question difficulty and looked-but-never-went are all answerable.

**Scoring & spotlight** (`src/lib/score.js`, pure — no imports, so `node` can
test it; callers pass the JSON in): 10 pts per check-in, +5 for a quiz with no
wrong taps, +10 at a *spotlight* site, +30 per completed tour, +100 for all 25.
Points are computed at check-in and stored on the stamp (`stamp.pts`) so rule
changes never rewrite history. `spotlightIds()` marks the **quieter half of the
map** as bonus-worthy, from live `/api/checkin` counts once ≥20 are recorded
(cached in `src/lib/stats.svelte.js`, so it still works offline), falling back to
the sheet's `traffic`/`promoPriority` columns before that. This is the mechanism
for "get every site visited evenly" — the app and `/organizer` call the same
function, so staff see exactly what visitors are nudged toward.

**Reward tiers gate on points, not stamp count** (`rewards.json` has `points:`,
not `stamps:`) — that is what makes the perfect-quiz, spotlight and tour bonuses
worth chasing rather than decorative. `tierFor`/`nextTier` take a score.
`maxPossiblePoints(siteCount, tourCount)` is the ceiling a visitor is *guaranteed*
to reach (every site + every tour, no bonuses = 500 today); `checkRewards` rejects
a tier above it, so nobody can define a prize that cannot be won. Same four tiers
as before in practice: 40 / 120 / 250 / 500 land where 3 / 8 / 15 / 25 stamps did
for an ordinary visitor, and the top tier still effectively needs all 25 because
the +100 full-set bonus is most of the gap.

`breakdown(stamps, tours, siteCount)` splits that total into stamps / tour bonuses
/ full-set bonus and `totalPoints` is now just its `.total`, so the "how points
work" panel on the passport cannot drift from the number above it. The stamp wall
is **grouped by tour** rather than shown as one wall of 25 — a tour is the unit
that earns a voucher, and `checkTours` guarantees every site is in exactly one, so
the groups cover all of them with nothing orphaned. That replaced the separate
tours list, which showed the same progress twice.

**Recovery** (`src/lib/backup.js` pure + `passport.svelte.js` glue): every device
gets an 8-char Crockford-base32 code, backed up to D1 on change and on reconnect
(debounced ~10 s — see `soon()` in `passport.svelte.js`);
entering the code elsewhere **merges** (never overwrites) the stamps back. A
`/passport#r=<base64>` backup link carries the whole passport in the URL for
deploys with no server at all. Restore can only add stamps.

**Organizer dashboard** (`src/routes/organizer/+page.svelte`): check-ins per site
ascending, evenness score, currently-boosted list, nearest ticket counter per
site, CSV export, and the data-quality lists (`needsSurvey` coords, `generated`
quiz banks) plus the non-check-in event tallies. Not in the bottom nav — reach it
by URL, behind the staff code (mis-tap guard, not auth — see `staff.svelte.js`).

**Bilingual content** (`src/lib/i18n.svelte.js` + `src/lib/strings.js`): all
content JSON fields are `{ vi, en }` objects — resolve them in markup with
`t(field)`. UI chrome strings live in `strings.js`, used via `s('key', ...args)`
(some are functions for interpolation). Reactive `$state` language toggle is in
the layout. Official languages are vi/en; other languages rely on the user's
browser Google Translate (don't build more locales). When adding content,
**every translatable field must be `{ vi, en }`**.

**Voucher redemption** (`src/routes/tours/[id]/+page.svelte` + the reward tiers on
the passport page, both via `src/lib/components/StaffConfirm.svelte`): a "set" =
a tour's stops. When all are stamped (`isSetComplete`), the tour page shows a
redeem panel; a staff member taps confirm on the customer's phone, gated by the
client-side `CONTROLLER_CODE` **inside StaffConfirm** (prevents mis-taps, NOT
fraud — real anti-fraud needs the server path). Redeemed ids (tour ids *and*
reward-tier ids) persist in `localStorage` via the passport store. No phone numbers, no e-vouchers — see [intake guide]
constraints; vouchers are paper, exchanged at any ticket counter.

**Finding a ticket counter** (`src/lib/geo.js` `nearest(from, points)`, pure):
because vouchers are paper and staff stand at counters, "which counter is closest"
is the question right after a set completes. `NearestBooth.svelte` asks for one
GPS fix on tap and hands off to Google Maps walking directions — it sits in the
tour redeem panel and the passport rewards section. The map (`destinations/`) puts
MapLibre's own `GeolocateControl` behind the 📍 chip — **opt-in, never on page
load** — with its button hidden in CSS and `trigger()` called from the chip; the
control supplies the dot, the accuracy circle and the watch, and its `geolocate`
event feeds `me` for the nearest-counter bar. `map.remove()` in `onDestroy`
removes the control, which clears the watch: a watch that outlives the route is a
battery leak. `/organizer` calls the same `nearest()` for its per-site counter
column.

**Content intake**: the survey team works in Google Sheets; CSV exports live in
`content/csv/` and `node scripts/import-csv.mjs` regenerates
`destinations.json` + `ticket-points.json`. The sheet owns address, hours,
traffic, promo priority and the VI intro text; the script's `META` table owns
ids, categories and EN copy; hand-written quiz banks survive re-imports. Sites
without a real bank get questions generated from their own row (street /
category / hours), flagged `"generated": true`, so they are never factually
wrong — just dull, and listed in `/organizer` as to-do. `content/
CONTENT-GUIDE.md` (Vietnamese) + `content/destination.template.json` still
define the target per-destination schema (10 questions/site).
`scripts/check-data.mjs` (in `npm test`) fails on a missing `vi`/`en`, a pin
outside Hội An, a bad answer index, or two tours claiming the same stop.

**Passport** (`src/lib/passport.svelte.js`): exports a reactive `$state` object
mirrored to `localStorage`; mutate `passport.stamps`, never reassign it. The
queue flush is wired in `+layout.svelte` (`onMount` + `online` listener).

**The basemap is ours** (`src/lib/map-style.js`): MapLibre GL over a 1.3 MB
Protomaps extract in `static/map/hoian.pmtiles`, with the glyph ranges and sprite
self-hosted next to it — no API key, no tile server, no external host, and
therefore genuinely offline. There is **no Leaflet and no raster street map** any
more; both the destinations map and the tour route maps run on this.

- `loadMap(base)` imports maplibre-gl + pmtiles and registers the archive under
  the `pmtiles://` protocol, memoised so several maps share one download.
  maplibre-gl v6 has **no default ESM export** — use the namespace. Vite needs
  `optimizeDeps.exclude: ['maplibre-gl']` or its worker 404s in dev, and
  `loadMap` hands the `?worker&url` build of `maplibre-gl-worker.mjs` to
  `setWorkerUrl()` — maplibre finds its worker through a template literal
  Rollup can't see, so in production nothing was emitted and the worker 404'd.
- The archive is loaded whole via `FileSource`, *not* HTTP range: a ranged 206 is
  what the service worker cache cannot serve, so whole-file lets the basemap be
  **precached** like any other asset (`globPatterns` in `vite.config.js`).
- The style's source URL **must** be `pmtiles://` + `PMTILES_KEY` — that is the
  name the loaded archive registers itself under, not its path. MapLibre also
  rejects a relative `sprite`, so `hoianStyle()` takes `location.origin + base`.
- `hoianStyle()` spreads Protomaps' `LIGHT` flavor and overrides the keys that
  show at old-town zoom, plus `sky` and `light`. Brand colours live there, not in
  components. `pois` is an **object of eight colour names**, not a string — a
  string silently produces `undefined` outputs and MapLibre refuses the style.
- `BOUNDS` is the extract's bbox padded ~200 m and is used as `maxBounds`, so
  panning cannot reach blank paper. `BUILDINGS_3D` extrudes the shophouses
  (`height` fallback 7 m — OSM rarely tags it here) and rises between z14.5 and
  z16. `hidePois(map)` drops OSM's POIs and house numbers outright — every café
  in the old town competing with 25 destinations. Nothing ever turns them back
  on: there is no bulk "show the basemap again" pass any more, because there is
  no satellite layer to hide the basemap under.
- `src/lib/map-style.test.js` (in `npm test`) guards the assumptions this rests
  on: our layer ids don't collide with the flavor's, every fontstack the style
  asks for is self-hosted, every destination/counter name is inside the shipped
  glyph ranges, and every pin is inside `BOUNDS`.

**Map** (`src/routes/destinations/+page.svelte`, the "Khám phá" tab): sites are
**one symbol layer**, not markers. `siteData` is a `$derived` GeoJSON carrying
everything reactive as feature properties (`icon`, `label`, `spot`, `sel`, `dim`),
so filters, spotlight, language and opening hours are a single `setData` instead
of 25 marker mutations. Pins are canvas images from `pinImage()` added with
`addImage`, two per category (plain + gold spotlight rim). A `zoom` expression
must be the **top-level** input of an `interpolate`, so per-feature scaling goes
in the stop outputs (`['case', ['get','sel'], …]`) — wrapping the interpolate in
`['*', …]` is a style-validation error. Popups are built per click (`popupHtml`)
so language/stamp/spotlight are current; the internal link is `data-go` +
`goto()` so the base path survives. The popup is styled as a **paper label**, not
a card: ink keyline and a solid ink pointer, the site's own mark via `markSvg()`
(the SVG twin of `pinImage`, keyline by underprint in both), category in small
caps, hours/address as a hairline `<dl>` index, outlined status badges, and one
solid primary action with the directions link kept quiet beside it. Clicking sets `selected`, which scrolls the
matching card in the bottom carousel (`id="card-<destId>"`). `map` is a plain
variable, not `$state` — the `$effect`s key off `ready = $state(false)`, set at
the end of `onMount`, or counts arriving before the layers exist would be lost.

**Visual direction** (after the Bangkok Design Week 2025 map the user referenced):
the basemap carries **no brand colour at all** — ivory land, white streets, a
barely-tinted river, grey labels — so the only saturated things on screen are the
25 destinations themselves. The pin is the **mắt cửa** (`pinImage()`, the
canvas twin of `MatCua.svelte`): one mark for every site, category carried by fill
alone, ink keyline drawn by *underprint* (the same path a hair larger in ink —
canvas can't union the petals, and stroking each would draw the seams), plus the
four-petal gold spark on spotlight sites. The map is a **flat printed plan**:
pitch 0, no animation, extrusions behind the 3D button.

**North is not up.** The sites are a 965 × 462 m east–west strip, which wastes
half a portrait phone. `principalBearing(destinations)` (in `map-style.js`, plain
2×2 covariance, no library) returns the long axis — 85° today — and the map opens
and `fitBounds`es at that bearing, making the same walk 455 × 958. It is computed,
not hardcoded, so re-surveyed coordinates re-aim the map; `map-style.test.js`
fails if the rotation ever stops helping. The 3D button therefore changes pitch
only — it must not reset bearing.

**Landmark drawings** (`src/lib/landmarks.js`): line-art elevations of notable
buildings placed at their own coordinates, the reference map's strongest device.
Hand-authored SVG paths → `Image` → `addImage` (MapLibre takes an
`HTMLImageElement`, so no sprite sheet to keep in sync), anchored `bottom` so the
building stands on its footprint, `icon-rotation-alignment: viewport` so it stays
upright on the rotated map. **Chùa Cầu is the only one drawn so far** — proof the
pipeline works; sites without art simply render nothing, so the set grows one
building at a time. Keys are destination ids and the test enforces that.

**Overlapping sites** are handled by a pager, not by clustering: sites here sit
metres apart (Trần Phú stacks seven behind one mark), so a tap collects every
feature within 26 px via `queryRenderedFeatures` into `stack`, and the ‹ › bar
steps through them in place — the map never zooms or re-arranges under the
visitor's finger. One hit = no bar. The filter chips carry each category's own
`--c-<id>` as a swatch and as their pressed colour, so the row doubles as the
map's legend; the carousel `Card` takes `mark` to draw the same mắt cửa the pin
does. `NavigationControl` is deliberately absent (pinch zooms, the 3D button
pitches) and the attribution is collapsed to its ⓘ — the bottom edge is the
pager's and a phone has four corners.

Deliberately *not* copied from the reference: hand-drawn landmark elevations as
map symbols (needs 25 illustrations — an asset job), and its flood-colour poster
register at city zoom (our `minZoom` is 14, so that zoom range doesn't exist here).
Tour routes are **not** drawn on this map either — they live on `/tours`, where
`RouteMap` shows one route at a time in the context of its own stop list.

**There is no satellite layer.** It was one Esri raster source behind a 🛰️
chip, and it was the only thing in the app that could not work offline — 25
surveyed pins on our own printed plan is the product, aerial photography of the
same roofs was not. `map-style.test.js` asserts every layer draws from
`protomaps`, so a second remote source cannot creep back in. MapLibre's
stylesheet is imported at **runtime**, i.e. after component CSS, so every
override in the page has to out-specify it (hence `.maplibregl-map …`).

**Tours** (`src/routes/tours/[id]/+page.svelte`, reached from the passport's set
list — there is no `/tours` index): the page renders `RouteMap.svelte` (dashed
line + numbered stops, all native layers
filtered by `['==', ['geometry-type'], …]` off one source) plus walking cost from
`src/lib/route.js` (`routeStats` = straight-line chain × 1.3 detour factor,
75 m/min). It is `interactive: false` and has no popups; the stop names are
listed beside it. `RouteMap` tears itself down in `onDestroy` because an **async
`onMount` cannot return a cleanup**.

## Conventions

- Plain JS + JSDoc, not TypeScript. Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`).
- Category accents are CSS vars `--c-<category-id>` (in `app.css`); category id/label/icon live in `categories.json` and are looked up via `src/lib/util.js`.
- Deliberate shortcuts are marked with `// ponytail:` comments naming the ceiling/upgrade path.
- Fonts: Be Vietnam Pro only — weight 800 uppercase for display (`--font-display`), 400–600 for body. Matches the official key visual's heavy geometric sans; no serif, no system-font fallback look. **Self-hosted** (`src/lib/fonts/*.woff2`, `@font-face` at the top of `app.css`): the app must render with the network off, and a Google Fonts link can only ever be *runtime* cached.
- **Offline is a hard requirement, so nothing third-party is on the critical path.** Precache (~4.8 MB, 125 entries) covers every prerendered page, every JS/CSS chunk, the content JSON inside those chunks, the woff2 files and all of `static/map/`. After that the app issues **no network request at all** — `vite.config.js` has no `runtimeCaching` section, because there is nothing left to cache. The only outbound thing is the Google Maps directions link, which leaves the app.
- **Brand skin** (`app.css` `:root`): the official *Tuần lễ Sáng tạo Hội An 2026* key visual — peach→pink gradient paper (`--paper`/`--paper-2`/`--bg`), coral `--brand` + `--grad-brand`, oxblood `--brand-dark` headings, `--gold` scallop, `--teal` inside `--grad-strip`. Motif classes to reuse rather than redraw: `.brand-strip`, `.scallop` (roof-tile trim), `.spark` (four-petal), plus rounded capsules for the cloud-scroll blocks (see the home hero and the destination hero). Style new UI from these tokens; don't hardcode hex.

## Pre-launch TODO (from README)

Verify every destination's `lat`/`lng`/`radius` on-site (coords come from the
sheet's Google Maps links; 5 are estimates, flagged `needsSurvey` and listed in
`/organizer`), replace the 19 auto-generated quiz banks, add real photos, add
192/512 PNG icons, and change both staff codes in `src/lib/staff.svelte.js`.
Full list with reasoning: `CONCERNS.md`.
