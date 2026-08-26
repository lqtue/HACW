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


-- Study log: one row PER event (the exception to the aggregates-only rule).
-- `counters` above stays the ops store (spotlight, dashboard); this table is what
-- the dispersal study and the behaviour analysis read, later, by SQL / CSV pull.
-- Device-free by design: no pid, no device id, so it is the same anonymous
-- posture as the counters, just not pre-summed. Per-device questions (plan
-- adherence) are answered from `passports.snapshot` (stamps + plan) instead.
--   eid          client-minted random id; INSERT OR IGNORE makes a retried queue
--                flush exactly-once (the counters above still double-bump — ops only)
--   ts/day/half  SERVER time (phone clocks drift); half-day is the switchback unit
--   nudge        src/lib/switchback.js schedule value for (day, half)
--   spot         the client saw this dest as spotlight at the time (quiet half)
--   sid/seq      per-visit sequence (ephemeral id, dies with the tab) unless the
--                visitor switched the study off; NULL then
--   tk           ticket type held (5 | 3), the cheapest visitor segment we have
-- Analysis this schema is built to answer (run after the event):
--   evenness per unit:  SELECT day, half, nudge, dest, COUNT(*) FROM events
--                       WHERE t='checkin' GROUP BY 1,2,3,4      -> Gini/entropy on vs off
--   spotlight uptake:   AVG(spot) of check-ins, on vs off
--   funnel by segment:  GROUP BY nat, tk, half, t
--   pick-for-me A/B:    auto_steer vs auto_random rows -> kept? (plan_pick same dest,
--                       same sid) -> visited? (checkin same dest, same sid)
--   per visit:          GROUP BY sid -> sites, order (seq), length (max ts - min ts),
--                       plan_pick vs checkin = adherence, arrive w/o checkin = gave up
--   tail:               days 5–6 (nudge=0) vs off-units of days 1–4
-- ponytail: no retention job — drop the table after the event (CONCERNS.md §3b).
CREATE TABLE IF NOT EXISTS events (
  id    INTEGER PRIMARY KEY,
  eid   TEXT NOT NULL UNIQUE,
  ts    INTEGER NOT NULL,
  day   TEXT NOT NULL,
  half  TEXT NOT NULL,
  nudge INTEGER NOT NULL,
  t     TEXT NOT NULL,
  dest  TEXT,
  spot  INTEGER,
  nat   TEXT,
  n     REAL,
  sid   TEXT,
  seq   INTEGER,
  tk    INTEGER
);
CREATE INDEX IF NOT EXISTS events_unit ON events (day, half, t);
-- The organizer review list is `WHERE flags > 0 ORDER BY flags, updated`; without
-- this it is a full scan of every passport plus a sort on each dashboard load.
CREATE INDEX IF NOT EXISTS passports_flagged ON passports (flags DESC, updated DESC) WHERE flags > 0;

-- `journeys` (the earlier opt-in log) is superseded by `events.sid`; existing
-- deployments can drop it after the event:  DROP TABLE IF EXISTS journeys;
