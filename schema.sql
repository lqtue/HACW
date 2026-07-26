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
CREATE TABLE IF NOT EXISTS passports (
  pid TEXT PRIMARY KEY,
  snapshot TEXT NOT NULL,
  updated INTEGER NOT NULL,
  flags INTEGER NOT NULL DEFAULT 0
);
