// The four statements the API runs against D1. Kept here so `sql.test.js` can
// execute them against a real SQLite (node:sqlite) — the SQL is the part where a
// silent mistake would quietly stop counting.
//
// Plain `?` placeholders, not `?1`: both work on D1, only this form binds
// positionally everywhere, which is what lets the test run the real statements.
// Bind order is spelled out on each export.

/** (k, n, updated, n, updated) — the repeat is the increment on conflict. */
export const UPSERT_COUNTER = `INSERT INTO counters (k, n, updated) VALUES (?, ?, ?)
   ON CONFLICT(k) DO UPDATE SET n = n + ?, updated = ?`;

/** (likePattern) — 'count:%' or 'ev:%' */
export const SELECT_COUNTERS = `SELECT k, n FROM counters WHERE k LIKE ?`;

/** (pid) */
export const SELECT_PASSPORT = `SELECT snapshot, owner FROM passports WHERE pid = ?`;

/** (pid, snapshot, updated, flags, owner, snapshot, updated, flags, owner) — the
 *  repeat is the update branch. `owner` is the device holding the ticket; passing
 *  the same value on both sides makes a claim/transfer one statement. */
export const UPSERT_PASSPORT = `INSERT INTO passports (pid, snapshot, updated, flags, owner) VALUES (?, ?, ?, ?, ?)
   ON CONFLICT(pid) DO UPDATE SET snapshot = ?, updated = ?, flags = ?, owner = ?`;

/** Organizer review list. No bind params; pids are masked before they leave the endpoint. */
export const SELECT_FLAGGED = `SELECT pid, flags, updated FROM passports
   WHERE flags > 0 ORDER BY flags DESC, updated DESC LIMIT 50`;

/** (sid, seq, nat, t, dest, ts) — one opt-in journey event. */
export const INSERT_JOURNEY = `INSERT INTO journeys (sid, seq, nat, t, dest, ts) VALUES (?, ?, ?, ?, ?, ?)`;

/** (limit) — newest journey rows for the organizer CSV export. */
export const SELECT_JOURNEYS = `SELECT sid, seq, nat, t, dest, ts FROM journeys
   ORDER BY id DESC LIMIT ?`;
