# Concerns — open list

From the session handoff + the product/tech review. Ordered by "what hurts most if
ignored". Tick as solved; delete the file when the event is over.
Decisions taken on 2026-07-26 are recorded at the bottom.

**Where this stands.** The software is feature-complete for the event. Everything
left in §1 is either a dashboard click, real-world content, or a decision only the
organizers can make — none of it is code. §2 needs ops answers, not commits. The
one code item anyone might still want is the staff stamp override in §2, and that
is a deliberate hold: decide the policy first, then it's ~10 lines.
`docs/hacw-architecture.excalidraw` is the one-page picture of all of it.

---

## 1. Still to do before launch

- [ ] **Change the staff codes.** `VOLUNTEER` (`2026`) and `ORGANIZER` (`2026hacw`)
      in `src/lib/staff.svelte.js`.
      The volunteer code unlocks the skip-GPS button, voucher confirmation and a
      read-only `/organizer`; the organizer code additionally unlocks the content
      editor there. Pick two the crowd won't guess and hand them out on paper —
      the organizer one to a much shorter list.

- [ ] **Cloudflare setup** (dashboard, not code): build output
      `.svelte-kit/cloudflare`, a **Rate Limiting rule on `/api/*`** (free plan
      includes one), and the database — `wrangler d1 create hacw`, apply
      `schema.sql`, bind it as `DB` (see README). The free tier covers the event (~100k row
      writes/day vs ~50k needed at 2,000 visitors, 5M reads/day vs a ~50-row
      dashboard query), so no paid plan is required. Watch the write count in the
      D1 dashboard on day 1 anyway — that estimate is the one number here that
      comes from guessing attendance.

- [ ] **PWA icons 192/512 PNG missing** → the install prompt is second-rate on
      Android and iOS. The install button is live and needs them.

- [ ] **5 estimated coordinates** (`needsSurvey: true`): A9, A11, A16, A24, A25.
      Walk them, record lat/lng, and set each `radius` from what the GPS actually did.

- [ ] **19 auto-generated quiz banks** (`generated: true`). Never wrong, just dull —
      and the quiz is now the only gate that costs a guesser anything. Listed in
      `/organizer`.

- [ ] **A2 Chùa Quan Âm address conflict**: the address column says `26 Trần Phú`,
      its own intro text says `13 Nguyễn Huệ`. The column won. Confirm which is right.

- [ ] **Real destination photos** (`image` in `destinations.json`).

## 2. Event-week risks — mitigated in code, still need an ops answer

- [ ] **Safari evicts `localStorage` after ~7 days of non-use.** Mitigated: the
      recovery code is now shown right after the first stamp with a "screenshot
      this" prompt, and installing the app makes eviction far less likely.
      Ops side: staff should know the recovery flow exists and how to walk a
      visitor through it.

- [ ] **No staff override when check-in fails.** Radius went 35 m → 75 m and the
      `gps_far` event now records how far off people actually were, so day-1 data
      can tune each site. But a visitor standing at the door with a broken GPS fix
      still has no path to a stamp. Cheapest fix: let staff mode stamp on the
      visitor's phone (`StaffConfirm` already exists, one call to `addStamp`).

- [ ] **Cold first load.** The service worker caches after visit 1; tourists arrive
      with an empty cache. Ops fix: wifi + QR at ticket counters, printed fallback
      at each site, and point people at the install button while they still have signal.

- [ ] **Voucher reconciliation.** Redemptions are in `localStorage`; the `redeem`
      event gives an approximate server-side count in `/organizer`. Decide who
      reconciles paper vouchers against it, and how often.

## 3. Known ceilings — accepted for this event

- **Quiz answers ship in `destinations.json`.** A wrong answer now discards the
  whole draw and locks the site for 20 s, which makes tapping through slower than
  reading the sign, and it forfeits the perfect-answer bonus. It does not stop
  someone who reads the JSON. Real fix = check answers in
  `src/routes/api/checkin/`, never sending the answer index to the client.
  Not worth it while the prize is a paper voucher handed over by a human.

- **Staff code is client-side.** Prevents mis-taps and curiosity, not fraud.
  Cloudflare Access in front of `/organizer` if the numbers must stay private.

- **Counters are atomic now** (D1 `ON CONFLICT DO UPDATE SET n = n + ?`), so the
  old sharding hack and its lost-update caveat are gone. `scripts/loadtest.mjs` was
  deleted once that question was answered; `git log -- scripts/loadtest.mjs` brings
  it back if a real number is ever wanted (point it at a deployed preview, not
  `npm run dev`, which only measures the in-memory stand-in).

- **No per-IP rate limit in code** — that would cost a database write per request.
  `src/hooks.server.js` enforces same-origin on writes and a 16 KB body cap; the
  IP-level limit is the dashboard rule in §1.

## 3b. Cheating — threat model

Start from the honest position: **the app cannot stop a determined cheater, and it
was never going to.** Everything the check-in depends on lives on the visitor's
phone — GPS is self-reported, and the quiz answers ship inside
`destinations.json`. Someone with browser devtools open can hold all 25 stamps in
a few minutes without leaving a café. The controls below are about making casual
cheating not worth the effort and making organised cheating *visible*, not about
prevention.

**The choke point is the ticket counter, not the app.** A stamp is worth nothing
until a human hands over a paper voucher. Every control worth building points at
that moment.

### What the relaxed radius actually costs (measured, not guessed)

| radius | sites reachable from one standing spot | sites with a neighbour inside r |
|---|---|---|
| 25 m | 3 (A7, A8, A11) | 9 / 25 |
| 35 m *(old)* | 3 (A7, A8, A11) | 10 / 25 |
| 50 m | 5 | 16 / 25 |
| **75 m** *(current)* | **6** (A4, A7, A8, A9, A11, A15) | 18 / 25 |
| 100 m | 7 | 23 / 25 |

So going 35 m → 75 m handed out three extra "free" sites to someone standing in
the right spot — out of 25, and they still owe a quiz for each. Two of those six
(A9, A11) sit on *estimated* coordinates, so the real cluster may be smaller once
those are surveyed. Note the floor: A7/A8/A11 are ~10 m apart in reality, so **no
radius separates them** — the quiz is the only thing that ever did.

Verdict: keep 75 m. It buys a working check-in for honest visitors in alleys where
GPS is bad, and it costs three sites against an attacker who could bypass GPS
entirely anyway. Retune per-site from day-1 `gps_far_m / gps_far` data.

### Threats, cost to the cheater, and what to do

| # | Threat | Cost to them | What it gains them | Control |
|---|---|---|---|---|
| 1 | **Multiple sessions** — incognito / second browser / second phone, each a fresh `pid` | seconds | A second full passport, so a second voucher per tier | Unfixable in-app while anonymous (that decision is deliberate). Control is at the counter: **one voucher per person**, marked on the old-town paper ticket they already hold |
| 2 | **Faked GPS** — devtools sensor override, iOS location spoofing app | minutes, once | Every stamp without walking | Undetectable client-side. Detect server-side: impossible travel between consecutive stamps (see below) |
| 3 | **Reading the answers** out of `destinations.json` | minutes | Skips the quiz gate entirely | Server-validated quiz (answers never sent to the client). Real work; only worth it if the prizes get valuable |
| 4 | **Cluster farming** — standing at A7/A8/A11 and taking 6 stamps | none, it's legal-ish | 6 of 25 sites without walking | Accept. They're genuinely adjacent museums; the quiz still gates each one |
| 5 | **Forged POST** to `/api/checkin` to skew the spotlight | minutes | Moves the bonus to sites they choose; distorts organizer numbers | Same-origin guard + Cloudflare rate limit are in place; add a per-`pid` daily cap. Counters are advisory anyway |
| 6 | **Forged passport PUT** with 25 stamps under a chosen code | minutes | A "complete" passport restorable on any phone | Merge-only limits it to *adding*; the plausibility flag below catches the shape of it |
| 7 | **Recovery-code sharing** — one passport restored onto a group's phones | seconds | N vouchers from one real visit | Restore merges, so all copies stay identical. Counter-side: one voucher per person, and the flag shows the same `pid` redeeming repeatedly |
| 8 | **Staff-code leak** — visitors learn `2026` and self-confirm redemptions | zero once leaked | Self-serve vouchers | Rotate the code per shift; it's one constant. Longer term the redeem confirm needs the server |
| 9 | **Brute-forcing another device's recovery code** | 32^8 guesses | Someone else's stamps | Ignore. No PII, and there's nothing to steal but stamps |

### The one control — built

**Plausibility flagging at `PUT /api/passport`** (`src/lib/fraud.js`, pure +
tested). No new storage: the server already receives the whole passport with
per-stamp timestamps and imports `destinations.json` for coordinates. It flags
impossible travel between consecutive stamps (>150 m/min, with the gap floored at
one minute so adjacent museums don't trip it) and bursts (6 stamps inside 10
minutes). The count lands in `passports.flags` and surfaces in two places: a
masked review list in `/organizer`, and a warning on the redeem screen so the
staff member holding the phone knows to ask a question or two.

Deliberately **advisory**: it never blocks a backup or a voucher. A tourist on a
bicycle, a phone with a bad first fix, or a group that walks fast are all normal —
the flag starts a conversation, it doesn't refuse a voucher. Thresholds are
arguments (`maxSpeed`, `burstStamps`, `burstMinutes`), so tune them from real
day-1 data rather than arguing about them now.

- [ ] Tune the thresholds after day 1, and decide the counter policy the flag
      feeds into (see threat #1: one voucher per person, marked on their ticket).

## 4. Legal / third-party

- [ ] **Esri World Imagery requires visible attribution**; CARTO Voyager has
      fair-use limits, and the tile runtime cache (600 entries) must stay a
      by-product of browsing, not a bulk download. Check both before launch.
      (Satellite is Esri, *not* Google — Google tiles are licensed only through
      their paid Maps APIs. Don't "fix" this back.)

- [ ] Photo rights for the destination images once they're added.

- [x] ~~GDPR / Decree 13 privacy note for Google Analytics~~ — moot, no GA. The
      only thing stored server-side is an anonymous device code and per-site
      counts. Still worth one line in the intro copy saying so.

## 5. Code debt — audit again once the content is final

Reported earlier, deliberately not applied yet (~110 lines):

- [ ] Delete `withinRadius()` (`src/lib/geo.js`) — unused.
- [ ] Delete the dead UI strings in `src/lib/strings.js`.
- [ ] `Intl.NumberFormat` in `route.js:formatDistance`.
- [ ] Re-run the audit after the quiz banks and photos land.

---

## Decided — do not relitigate

- **Cloudflare Pages is the deploy target.** `adapter-cloudflare`; the GitHub
  Pages workflow was deleted because `adapter-static` can't serve the API.
- **D1, not KV and not Supabase.** Free tier covers the event, upserts are atomic,
  and it needs no second vendor, no extra secret and no extra network hop from the
  edge. Aggregates only — no event log — so reads stay trivial. Supabase would only
  earn its keep if staff accounts or real voucher inventory ever land.
- **The API lives in `src/routes/api/`, not `functions/`** — the adapter emits a
  `_worker.js` and Pages ignores `functions/` whenever that file exists.
- **No Google Analytics.** The existing offline-tolerant event queue does the job:
  `checkin`, `gps_far`, `gps_fail`, `quiz_wrong`, `redeem` → D1 → `/organizer`.
  No cookie banner, no ad-blocker hole, works offline, and staff see the same
  numbers the app does.
- **Two staff codes**, not accounts: the volunteer one gates skip-GPS, redemption
  and a read-only `/organizer`; the organizer one adds the content editor.
  `?staff=<code>` unlocks a device for a whole shift.
- **The content editor downloads a file, it does not save.** Editing
  `destinations.json` in the browser and committing the download keeps the content
  reviewable in git and needs no auth, no write path and no D1 table. A live edit
  would need all three — and the codes above are a mis-tap guard, not auth.
- **Check-in radius 75 m** by default — GPS in the old-town alleys is worse than
  the map suggests, and the quiz is the real gate anyway.
- **Counts refresh every 6 h** in the app (`stats.svelte.js`); `/organizer` forces
  a live read.
- No Google auth (anonymous by design). Restore merges, never overwrites.
  Spotlight = quieter half by live counts, sheet fallback under ~20 check-ins.
  Tours are disjoint. Hours parsing never guesses. Official languages vi/en only.
