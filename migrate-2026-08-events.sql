-- One-shot migration for the deployed D1 (already-created tables are untouched):
--   npx wrangler d1 execute hacw --remote --file=migrate-2026-08-events.sql
-- Everything is IF NOT EXISTS, so re-running is harmless. schema.sql stays the
-- full picture for a fresh database.
--
-- NO ALTER TABLE in this file: wrangler runs a file as ONE transaction, so a
-- failing statement ("duplicate column") rolls back every CREATE before it and
-- the file silently does nothing (verified against a local D1). Only a database
-- that already had `events` from before the tk column needs, separately:
--   npx wrangler d1 execute hacw --remote --command "ALTER TABLE events ADD COLUMN tk INTEGER"
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
CREATE INDEX IF NOT EXISTS passports_flagged ON passports (flags DESC, updated DESC) WHERE flags > 0;
