# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server (+ in-memory /api stand-in, see devApi in vite.config.js)
npm run build        # Cloudflare Pages build into .svelte-kit/cloudflare/
npm run preview      # preview the production build
npm test             # node self-checks: geo, quiz draw, scoring, backup/merge, route,
                     # hours, counter keys + event validation, the D1 SQL against
                     # a real sqlite, API guard,
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
passport → themed walking tours. SvelteKit 5 (runes) + Leaflet.

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

### Storage: D1, aggregates only

`schema.sql` has two tables and no event log. `counters` holds one row per key —
`count:<destId>` for check-ins, `ev:<type>[:<destId>]` for everything else — and
writes are `INSERT … ON CONFLICT DO UPDATE SET n = n + ?`, i.e. **atomic**, which
is why there is no sharding and no lost-update caveat. A dashboard read is ~50
rows, which is what keeps the whole event inside D1's free tier (~100k row writes
/day, 5M reads/day). Storing one row per check-in instead would blow the read
allowance on the first dashboard refresh.

The four statements live in `src/lib/sql.js` so `sql.test.js` can run them
against a real SQLite (`node:sqlite`) — D1 *is* SQLite, so the upsert arithmetic
is verified, not assumed. Bind order is documented on each export; they use plain
`?` placeholders so the same string binds positionally in both D1 and the test.

### Base path — the #1 way to break this

Everything is prerendered under a repo subpath (`/HACW`). `BASE_PATH` env →
`kit.paths.base`. **Every internal link must be prefixed with `base` from
`$app/paths`** — a root-absolute `href="/foo"` or `goto('/foo')` works in dev
but 404s on the deployed subpath. This includes hrefs inside Leaflet popup HTML
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
four editable files, one shell. `JsonFile.svelte` owns the whole flow — clone the
shipped JSON, validate on every keystroke, **download** it, read an edited file
back in, reset — and renders a `children(data)` snippet with the working copy.
The four bodies are `DataEditor` (destinations), `TourEditor` (tours),
`RewardEditor` (tiers) and `EventEditor` (home page copy). `Bi.svelte` is the
`{ vi, en }` field pair they all use. Nothing is written server-side; the file is
committed and redeployed.

The three list files edit as **tables** (`.ed-table`) — one row per record, one
input per cell, so 25 sites are comparable at a glance and the survey-critical
numbers (lat/lng/radius) line up in columns. Fields too long for a cell (intro
copy, quiz banks, tour stops) live in a detail row that opens under the record,
tracked by a plain `$state({})` id map so several can be open at once. `event.json`
is one object, not rows, so it stays a form.

`/organizer` is the one route used at a desk: `+layout.svelte` puts `.wide` on
`.app` for it, lifting the 540px phone column to 1600px. The dashboard half keeps
a 900px `.dash` cap — only the editors want the full width.

Validation lives in `src/lib/editor.js` — `checkDestinations`, `checkTours`,
`checkRewards`, `checkEvent` — and `scripts/check-data.mjs` runs those same four
in `npm test`, so the download button is disabled on anything the repo would
reject. Cross-file rules that a single editor cannot see stay in `check-data.mjs`;
"every site is in exactly one tour" is enforced by passing the destination ids
into `checkTours`. Editor CSS is global (`.ed-*` in `app.css`) because Svelte
scopes component styles and four editors would otherwise carry four copies.

**Fraud flagging** (`src/lib/fraud.js`, pure): `flagPassport(stamps, destinations)`
returns impossible-travel and burst findings; `PUT /api/passport` stores the count
in `passports.flags`. Shown as a masked review list in `/organizer` and as a
warning inside `StaffConfirm`. **Advisory by design — never blocks a redemption.**
The app cannot prevent faked check-ins (GPS is self-reported, quiz answers ship in
the JSON); this makes cheating visible instead. Threat model: `CONCERNS.md` §3b.

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
tour redeem panel and the passport rewards section. The map (`destinations/`) uses
Leaflet's own `map.locate({ watch: true })` behind the 📍 chip: **opt-in, never on
page load**, drawing a dot + accuracy halo and the same nearest-counter line.
`onDestroy` calls `stopLocate()` *and* `map.remove()` — a watch that outlives the
route is a battery leak. `/organizer` calls the same `nearest()` for its
per-site counter column.

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
outside Hội An, a bad answer index, or a site in no tour.

**Passport** (`src/lib/passport.svelte.js`): exports a reactive `$state` object
mirrored to `localStorage`; mutate `passport.stamps`, never reassign it. The
queue flush is wired in `+layout.svelte` (`onMount` + `online` listener).

**Map** (`src/routes/destinations/+page.svelte`, the "Khám phá" tab): Leaflet is
browser-only and dynamically imported inside `onMount`. Markers are `divIcon`
HTML pins (no image files) colored per category; the basemap is CARTO Voyager
tinted by a CSS `filter` on `.leaflet-tile-pane`. A second base layer is **Esri
World Imagery** — *not* Google satellite: Google tiles may only be used through
their paid Maps APIs. The tint is dropped while satellite is active (`.map.sat`).
Popups are built lazily per open (`popupHtml`) so language/stamp/spotlight are
current; the internal link is `data-go` + `goto()` so the base path survives.
Tapping a pin sets `selected`, which highlights and scrolls the matching card in
the bottom carousel (`id="card-<destId>"`). Note: `map`/`markers` are plain
variables, not `$state` — the `$effect`s key off a `ready = $state(false)` flag
set at the end of `onMount`, otherwise counts that arrive before the markers
exist would never repaint the spotlight halos. `invalidateSize()` is called
because the map lives in a flex container sized after init.

**Tours** (`src/routes/tours/+page.svelte`): single-open accordion — expanding a
tour renders `RouteMap.svelte` (dashed polyline + numbered stops) plus walking
cost from `src/lib/route.js` (`routeStats` = straight-line chain × 1.3 detour
factor, 75 m/min). Only one Leaflet instance exists at a time; `RouteMap` tears
itself down in `onDestroy` because an **async `onMount` cannot return a cleanup**.

## Conventions

- Plain JS + JSDoc, not TypeScript. Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`).
- Category accents are CSS vars `--c-<category-id>` (in `app.css`); category id/label/icon live in `categories.json` and are looked up via `src/lib/util.js`.
- Deliberate shortcuts are marked with `// ponytail:` comments naming the ceiling/upgrade path.
- Fonts: Playfair Display (display) + Be Vietnam Pro (body, Vietnamese diacritics) — avoid generic system fonts.

## Pre-launch TODO (from README)

Verify every destination's `lat`/`lng`/`radius` on-site (coords come from the
sheet's Google Maps links; 5 are estimates, flagged `needsSurvey` and listed in
`/organizer`), replace the 19 auto-generated quiz banks, add real photos, add
192/512 PNG icons, and change both staff codes in `src/lib/staff.svelte.js`.
Full list with reasoning: `CONCERNS.md`.
