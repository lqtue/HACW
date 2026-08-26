// Switchback schedule for the dispersal study: WHEN the crowd nudge (spotlight +
// "uncrowded" planner term) is on. Pure — server stamps `nudge` on every logged
// event from this, the client will read the same table to hide the nudge.
//
// Festival 28 Aug – 2 Sep 2026, Asia/Ho_Chi_Minh (UTC+7, no DST). The unit is a
// half-day (switch at 13:00): days 1–4 alternate so AM and PM are each 2 on / 2
// off, days 5–6 are all off — the persistence tail (does dispersal outlive the
// nudge?). Pre-registered by the commit that ships this table; do not edit it
// during the event.
//
// Outside the festival every half-day is "on", so dev, previews and any day after
// keep today's behaviour and the log still records nudge = 1.
export const SCHEDULE = {
  '2026-08-28': { am: 1, pm: 0 },
  '2026-08-29': { am: 0, pm: 1 },
  '2026-08-30': { am: 1, pm: 0 },
  '2026-08-31': { am: 0, pm: 1 },
  '2026-09-01': { am: 0, pm: 0 },
  '2026-09-02': { am: 0, pm: 0 }
};

const TZ_MS = 7 * 3600 * 1000;

/** @param {number} ts epoch ms → `{ day: 'YYYY-MM-DD', half: 'am'|'pm' }` in local time */
export function unit(ts) {
  const d = new Date(ts + TZ_MS);
  return { day: d.toISOString().slice(0, 10), half: d.getUTCHours() < 13 ? 'am' : 'pm' };
}

/** 1 = nudge on for the half-day containing `ts`; 1 outside the schedule. */
export function nudgeOn(ts = Date.now()) {
  const { day, half } = unit(ts);
  return SCHEDULE[day]?.[half] ?? 1;
}
