# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server (base path empty -> works at /)
npm run build        # static build into build/
BASE_PATH=/HACW npm run build   # build exactly as GitHub Pages deploys it
npm run preview      # preview the production build
npm test             # node self-checks: haversine/radius + quiz draw (no framework)
```

No lint step. Deploy is automatic: pushing to `main` triggers `.github/workflows/deploy.yml`, which builds with `BASE_PATH=/<repo>` and publishes to GitHub Pages. Live demo: https://lqtue.github.io/HACW/

## What this is

Mobile-first PWA for the Hội An Creative Week event (content is in Vietnamese):
map of destinations → two-tier check-in (GPS + quiz) → on-device stamp
passport → themed walking tours. SvelteKit 5 (runes) + Leaflet.

## Architecture — there is no backend

Storage is three deliberately separate tiers:

| Data | Where | Notes |
|------|-------|-------|
| Destinations, quizzes, tours, event copy | `src/lib/data/*.json` | The content **is** these files. Editing JSON = editing the app. Service-worker cached → works offline. |
| Passport / stamps | `localStorage` | Anonymous, per-device. No accounts. |
| Check-in counts | `functions/api/checkin.js` → Cloudflare KV | The *only* server code, and it only runs on Cloudflare. |

The app is fully usable with just the first two tiers. Check-in (GPS + quiz +
stamp) is entirely client-side; analytics events queue in `localStorage`
(`hacw_checkin_queue_v1`) and POST to `/api/checkin` on reconnect — failure is
swallowed, so a missing endpoint is harmless.

### Adapter split (important)

The repo is configured for **`adapter-static`** (GitHub Pages) in
`svelte.config.js`. The Cloudflare KV counter in `functions/` **cannot run on
Pages** — there, `/api/checkin` 404s and counting silently no-ops. To run the
analytics counter in production, swap back to `adapter-cloudflare` and deploy to
Cloudflare Pages (the `functions/` dir is picked up automatically). See README.

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
machine `idle → locating → (far | quiz) → done`. Tier 1 is GPS distance vs the
destination's `radius` (default 35m, per-destination); tier 2 is the quiz.
A `SIMULATE` const renders a "skip GPS" test button — **set it to `false` for
production.** The quiz draws **2 easy + 1 hard** from the destination's
`quizBank` (target 10/site) via `src/lib/quiz.js`; all drawn questions must be
answered correctly to earn the stamp.

**Bilingual content** (`src/lib/i18n.svelte.js` + `src/lib/strings.js`): all
content JSON fields are `{ vi, en }` objects — resolve them in markup with
`t(field)`. UI chrome strings live in `strings.js`, used via `s('key', ...args)`
(some are functions for interpolation). Reactive `$state` language toggle is in
the layout. Official languages are vi/en; other languages rely on the user's
browser Google Translate (don't build more locales). When adding content,
**every translatable field must be `{ vi, en }`**.

**Voucher redemption** (`src/routes/tours/[id]/+page.svelte`): a "set" = a tour's
stops. When all are stamped (`isSetComplete`), the tour page shows a redeem
panel; a staff member taps confirm on the customer's phone, gated by a
client-side `CONTROLLER_CODE` (prevents mis-taps, NOT fraud — real anti-fraud
needs the server path). Redeemed set ids persist in `localStorage` via the
passport store. No phone numbers, no e-vouchers — see [intake guide]
constraints; vouchers are paper, exchanged at any ticket counter.

**Content intake**: `content/CONTENT-GUIDE.md` (Vietnamese) + `content/
destination.template.json` define the per-destination schema the survey team
fills (25 sites, 10 questions each). Filled files get merged into
`src/lib/data/destinations.json`.

**Passport** (`src/lib/passport.svelte.js`): exports a reactive `$state` object
mirrored to `localStorage`; mutate `passport.stamps`, never reassign it. The
queue flush is wired in `+layout.svelte` (`onMount` + `online` listener).

**Map** (`src/routes/destinations/+page.svelte`, the "Khám phá" tab): Leaflet is
browser-only and dynamically imported inside `onMount`. Markers are `divIcon`
HTML pins (no image files) colored per category; the basemap is CARTO Voyager
tinted by a CSS `filter` on `.leaflet-tile-pane`. Note: `map` and `markers` are
plain variables, not `$state`, so the marker-filtering `$effect` only re-runs on
`active` (chip) changes — markers must be `addTo(map)` in the creation loop, not
deferred to the effect. `invalidateSize()` is called because the map lives in a
flex container sized after init.

## Conventions

- Plain JS + JSDoc, not TypeScript. Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`).
- Category accents are CSS vars `--c-<category-id>` (in `app.css`); category id/label/icon live in `categories.json` and are looked up via `src/lib/util.js`.
- Deliberate shortcuts are marked with `// ponytail:` comments naming the ceiling/upgrade path.
- Fonts: Playfair Display (display) + Be Vietnam Pro (body, Vietnamese diacritics) — avoid generic system fonts.

## Pre-launch TODO (from README)

Verify every destination's `lat`/`lng`/`radius` on-site (sample coords are
approximate), replace placeholder quizzes, add real photos, add 192/512 PNG
icons, and set `SIMULATE = false`.
