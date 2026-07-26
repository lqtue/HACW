// Destination content rules, in one place: `npm test` (scripts/check-data.mjs)
// and the /organizer editor both call these, so a JSON downloaded from the
// browser passes exactly the gate the repo does. Pure — no imports, so node
// runs it and Svelte imports it.

// Hội An old town bounding box — a pin outside it is a data-entry slip.
export const BOX = { latMin: 15.87, latMax: 15.89, lngMin: 108.31, lngMax: 108.34 };
const LEVELS = ['low', 'medium', 'high'];

export const bilingual = (v, where, out) => {
  if (!v || typeof v !== 'object') out.push(`${where}: not a { vi, en } object`);
  else {
    if (!v.vi?.trim()) out.push(`${where}: missing vi`);
    if (!v.en?.trim()) out.push(`${where}: missing en`);
  }
};

/**
 * @param {any} d a destination object
 * @param {string[] | null} categoryIds known category ids, or null to skip that check
 * @returns {string[]} human-readable problems — empty means fine
 */
export function checkDestination(d, categoryIds = null) {
  const out = [];
  const at = `${d?.code ?? '?'} ${d?.id ?? '(no id)'}`;
  if (!d?.id) out.push(`${at}: missing id`);
  for (const f of ['name', 'address', 'hours', 'description']) bilingual(d?.[f], `${at}.${f}`, out);
  if (categoryIds && !categoryIds.includes(d?.category)) out.push(`${at}: unknown category ${d?.category}`);
  if (!(d?.lat > BOX.latMin && d?.lat < BOX.latMax)) out.push(`${at}: lat ${d?.lat} outside Hội An`);
  if (!(d?.lng > BOX.lngMin && d?.lng < BOX.lngMax)) out.push(`${at}: lng ${d?.lng} outside Hội An`);
  if (!(d?.radius >= 15 && d?.radius <= 100)) out.push(`${at}: radius ${d?.radius} m is unusable`);
  if (!LEVELS.includes(d?.traffic)) out.push(`${at}: bad traffic`);
  if (!LEVELS.includes(d?.promoPriority)) out.push(`${at}: bad promoPriority`);

  const bank = d?.quizBank ?? [];
  if (!bank.length) out.push(`${at}: empty quiz bank`);
  bank.forEach((q, i) => {
    bilingual(q?.question, `${at}.quiz[${i}].question`, out);
    const opts = q?.options ?? [];
    if (opts.length < 2) out.push(`${at}.quiz[${i}]: needs at least 2 options`);
    opts.forEach((o, j) => bilingual(o, `${at}.quiz[${i}].options[${j}]`, out));
    if (!(Number.isInteger(q?.answer) && q.answer >= 0 && q.answer < opts.length))
      out.push(`${at}.quiz[${i}]: answer index out of range`);
    if (!['easy', 'hard'].includes(q?.difficulty)) out.push(`${at}.quiz[${i}]: bad difficulty`);
  });
  return out;
}

/** Same, over the whole file, plus duplicate ids. */
export function checkDestinations(list, categoryIds = null) {
  const out = [];
  if (!Array.isArray(list)) return ['destinations.json: not an array'];
  const seen = new Set();
  for (const d of list) {
    if (d?.id && seen.has(d.id)) out.push(`${d.id}: duplicate id`);
    seen.add(d?.id);
    out.push(...checkDestination(d, categoryIds));
  }
  return out;
}

/**
 * Tours. A stop belonging to two tours would let one stamp count toward two
 * voucher sets, so that is an error, not a warning.
 * @param {string[] | null} destIds known destination ids, or null to skip that check
 */
export function checkTours(list, destIds = null) {
  if (!Array.isArray(list)) return ['tours.json: not an array'];
  const out = [];
  const seenId = new Set();
  const claimed = new Map(); // stop id -> the tour that already owns it
  for (const tour of list) {
    const at = tour?.id ?? '(no id)';
    if (!tour?.id) out.push(`${at}: missing id`);
    else if (seenId.has(tour.id)) out.push(`${at}: duplicate id`);
    seenId.add(tour?.id);
    for (const f of ['title', 'theme', 'description', 'voucher']) bilingual(tour?.[f], `${at}.${f}`, out);
    const stops = tour?.stops ?? [];
    if (stops.length < 2) out.push(`${at}: needs at least 2 stops`);
    for (const stop of stops) {
      if (destIds && !destIds.includes(stop)) out.push(`${at}: unknown stop ${stop}`);
      if (claimed.has(stop)) out.push(`${at}: stop ${stop} is already in ${claimed.get(stop)}`);
      else claimed.set(stop, at);
    }
  }
  // A site in no tour can never be part of a reward set — the editor should say so
  // while it is still fixable, not at the next `npm test`.
  for (const id of destIds ?? []) {
    if (!claimed.has(id)) out.push(`${id} is in no tour`);
  }
  return out;
}

/**
 * Reward tiers, keyed on **points** — the score is what the tiers gate on, so
 * perfect quizzes, spotlight sites and completed tours all count toward a voucher.
 * Must ascend, and the top tier must be reachable by someone who does everything.
 * @param {number | null} maxPoints ceiling from `maxPossiblePoints()`, or null to skip
 */
export function checkRewards(list, maxPoints = null) {
  if (!Array.isArray(list)) return ['rewards.json: not an array'];
  const out = [];
  if (!list.length) out.push('rewards.json: no tiers');
  let prev = 0;
  for (const r of list) {
    const at = r?.id ?? '(no id)';
    if (!r?.id) out.push(`${at}: missing id`);
    bilingual(r?.title, `${at}.title`, out);
    bilingual(r?.reward, `${at}.reward`, out);
    if (!Number.isInteger(r?.points) || r.points <= prev) {
      out.push(`${at}: points must be a whole number above the previous tier (${prev})`);
    } else prev = r.points;
  }
  if (maxPoints != null && prev > maxPoints) {
    out.push(`top tier needs ${prev} points but only ${maxPoints} are reachable in total`);
  }
  return out;
}

/** Event copy on the home page. `title` and `dates` are deliberately one-language. */
export function checkEvent(ev) {
  if (!ev || typeof ev !== 'object' || Array.isArray(ev)) return ['event.json: not an object'];
  const out = [];
  if (!String(ev.title ?? '').trim()) out.push('event.title: empty');
  if (!String(ev.dates ?? '').trim()) out.push('event.dates: empty');
  for (const f of ['subtitle', 'intro', 'note']) bilingual(ev[f], `event.${f}`, out);
  if (!Array.isArray(ev.howItWorks) || !ev.howItWorks.length) out.push('event.howItWorks: needs at least one step');
  else ev.howItWorks.forEach((step, i) => bilingual(step, `event.howItWorks[${i}]`, out));
  return out;
}
