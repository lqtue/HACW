// Opening hours come from the survey sheet as free text: "7:00 - 22:00",
// "7:30 - 11:30 13:30 - 17:30", "8:00 - 17:00 (có nghỉ trưa)", or nothing usable.
// We read every HH:MM–HH:MM range we can find and ignore the rest, so a site is
// only ever reported as open/closed when the data actually says so.
//
// ponytail: no per-weekday rules (one site has "trừ Chủ nhật và Thứ hai…") and
// no timezone handling — visitors are standing in Hội An, so device-local time
// is the right clock. Move to a real opening-hours parser if the sheet grows
// day-specific columns.

/** @returns {[number, number][]} ranges in minutes from midnight */
export function parseRanges(text) {
  const out = [];
  for (const m of String(text ?? '').matchAll(/(\d{1,2})[:h](\d{2})\s*[-–—]\s*(\d{1,2})[:h](\d{2})/g)) {
    const from = +m[1] * 60 + +m[2];
    const to = +m[3] * 60 + +m[4];
    if (to > from) out.push([from, to]);
  }
  return out;
}

const CLOSING_SOON = 45; // minutes

/**
 * @returns {{ status: 'open'|'closed'|'unknown', closesIn?: number, opensAt?: number }}
 * `unknown` means "the sheet doesn't say" — the UI must then show nothing.
 */
export function openState(text, now = new Date()) {
  const ranges = parseRanges(text);
  if (!ranges.length) return { status: 'unknown' };

  const mins = now.getHours() * 60 + now.getMinutes();
  const current = ranges.find(([a, b]) => mins >= a && mins < b);
  if (current) return { status: 'open', closesIn: current[1] - mins };

  const next = ranges.find(([a]) => a > mins);
  return { status: 'closed', opensAt: next?.[0] };
}

export const isClosingSoon = (state) => state.status === 'open' && state.closesIn <= CLOSING_SOON;

/** 450 -> "07:30" */
export function formatMinutes(mins) {
  if (mins == null) return '';
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
