-- D1 schema. Apply once per environment:
--   npx wrangler d1 create hacw
--   npx wrangler d1 execute hacw --remote --file=schema.sql
-- then bind it to the Pages project as DB (Settings → Bindings → D1).

-- Aggregates only, not one row per event: a dashboard load then reads ~50 rows
-- instead of scanning the whole event log, which is what keeps this inside D1's
-- free read allowance. The upsert is atomic, so no sharding and no lost updates.
--   count:<destId>        check-ins
--   ev:<type>[:<destId>]  gps_far, gps_fail, quiz_wrong, redeem
--   ev:gps_far_m:<destId> metres overshot, summed (divide by gps_far = avg)
CREATE TABLE IF NOT EXISTS counters (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL
);

-- Passport backups, keyed by the device's own 8-char recovery code. Anonymous:
-- no PII, and the snapshot is merge-only (see src/lib/backup.js).
-- `flags` is the count from src/lib/fraud.js: impossible travel between stamps,
-- or a burst that isn't a walk. Advisory — it is shown to organizers and to the
-- staff member confirming a voucher, and it never blocks a redemption by itself.
-- `owner` is the device that currently holds this passport (a random per-device
-- id, not the pid). One ticket = one active device: a second phone writing to a
-- passport it does not own is refused, unless it is explicitly claiming it (the
-- visitor scanned the ticket to recover), which transfers ownership. That makes
-- recovery work while stopping two people collecting on one shared ticket.
CREATE TABLE IF NOT EXISTS passports (
  pid TEXT PRIMARY KEY,
  snapshot TEXT NOT NULL,
  updated INTEGER NOT NULL,
  flags INTEGER NOT NULL DEFAULT 0,
  owner TEXT
);
-- Existing deployments: add the column once (safe to fail if already applied).
--   npx wrangler d1 execute hacw --remote --command "ALTER TABLE passports ADD COLUMN owner TEXT"


-- Opt-in journey study: one row PER event (the exception to the aggregates-only
-- rule), so a visit's ORDER of sites can be reconstructed per nationality. `sid`
-- is an ephemeral per-session id (not the device pid) — resets each visit, links
-- nothing across visits. Written only when the visitor opted in (the client sends
-- `sid` only then); reads are organizer CSV export, never a live dashboard, so the
-- per-event rows don't blow the D1 read allowance.
-- ponytail: no retention job — TRUNCATE / drop the table after the event. Add a
-- date-partition purge only if this ever runs longer than one festival.
CREATE TABLE IF NOT EXISTS journeys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sid TEXT NOT NULL,      -- ephemeral session id (per visit), not a device id
  seq INTEGER NOT NULL,   -- order within the session
  nat TEXT,               -- nationality code (chosen language), or NULL
  t TEXT NOT NULL,        -- event type (checkin, scan, …)
  dest TEXT,              -- destination id, or NULL for site-less events
  ts INTEGER NOT NULL     -- client timestamp (ms)
);
CREATE INDEX IF NOT EXISTS journeys_sid ON journeys (sid, seq);
