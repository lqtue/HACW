// The statements the API runs against D1. Kept here so `sql.test.js` can
// execute them against a real SQLite (node:sqlite) — the SQL is the part where a
// silent mistake would quietly stop counting.
//
// Plain `?` placeholders, not `?1`: both work on D1, only this form binds
// positionally everywhere, which is what lets the test run the real statements.
// Bind order is spelled out on each export.

/** (k, n, updated, n, updated) — the repeat is the increment on conflict. */
export const UPSERT_COUNTER = `INSERT INTO counters (k, n, updated) VALUES (?, ?, ?)
   ON CONFLICT(k) DO UPDATE SET n = n + ?, updated = ?`;

/** (prefix, prefixEnd) — e.g. ('count:', 'count;'): a range on the primary key.
 *  `LIKE 'count:%'` cannot use the index (BINARY collation vs case-insensitive
 *  LIKE) and became a full scan once the nat:/view: keys grew the table. */
export const SELECT_COUNTERS = `SELECT k, n FROM counters WHERE k >= ? AND k < ?`;
/** The two bind values for SELECT_COUNTERS: ':' + 1 = ';' bounds the prefix. */
export const prefixRange = (prefix) => [prefix, prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1)];

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

/** (ts, pid, body) — one POST chunk = one study row; body = JSON of eventRows().
 *  The `events` view unpacks it and dedupes a re-sent chunk by eid. */
export const INSERT_CHUNK = `INSERT INTO chunks (ts, pid, body) VALUES (?, ?, ?)`;

/** (limit) — newest opt-in journey rows (events carrying a sid) for the organizer CSV. */
export const SELECT_JOURNEYS = `SELECT sid, seq, nat, t, dest, ts FROM events
   WHERE sid IS NOT NULL ORDER BY id DESC LIMIT ?`;
