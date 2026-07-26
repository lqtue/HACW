// Destination content rules, in one place: `npm test` (scripts/check-data.mjs)
// and the /organizer editor both call these, so a JSON downloaded from the
// browser passes exactly the gate the repo does. Pure — no imports, so node
// runs it and Svelte imports it.

// Hội An old town bounding box — a pin outside it is a data-entry slip.
export const BOX = { latMin: 15.87, latMax: 15.89, lngMin: 108.31, lngMax: 108.34 };
const LEVELS = ['low', 'medium', 'high'];

const bilingual = (v, where, out) => {
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
