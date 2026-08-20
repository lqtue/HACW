// A Hội An ticket admits a *fixed mix* of site classes, not any N of 25.
// Every destination carries `ticketClass`: 'monument' | 'museum' | 'other'
// (separate from its display `category`). The recipe is minimums, not an exact
// split — the "free" slots may be any class, including a second monument.
//
//   5-site: ≥1 of 3 monuments + ≥1 of 6 museums + 3 free  (total 5)
//   3-site: ≥1 of 3 monuments + 2 free                    (total 3)
//
// ponytail: 5-site is what the UI wires today; the 3-site recipe is here so
// wiring it later is data, not code. No per-visitor ticket state yet.

export const TICKET_CLASSES = ['monument', 'museum', 'other'];

/** size -> { size, min: { class: minCount } } */
export const TICKETS = {
  5: { size: 5, min: { monument: 1, museum: 1 } },
  3: { size: 3, min: { monument: 1 } }
};

/** @param {string[]} stopIds @param {Record<string,any>} byId */
function classCounts(stopIds, byId) {
  const c = { monument: 0, museum: 0, other: 0 };
  for (const id of stopIds) {
    const cls = byId[id]?.ticketClass;
    if (cls === 'monument' || cls === 'museum') c[cls]++;
    else c.other++; // unknown class counts as free — size check still catches junk
  }
  return c;
}

/**
 * Does this ordered stop list satisfy the TICKETS[size] recipe?
 * @param {string[]} stopIds
 * @param {any[]|Record<string,any>} destinations  full list or an id->dest map
 * @param {number} size
 * @returns {boolean}
 */
export function isValidSet(stopIds, destinations, size = 5) {
  const recipe = TICKETS[size];
  if (!recipe) return false;
  if (!Array.isArray(stopIds) || stopIds.length !== recipe.size) return false;
  if (new Set(stopIds).size !== stopIds.length) return false; // no repeated stop
  const byId = Array.isArray(destinations)
    ? Object.fromEntries(destinations.map((d) => [d.id, d]))
    : destinations;
  if (stopIds.some((id) => !byId[id])) return false; // unknown id
  const c = classCounts(stopIds, byId);
  return Object.entries(recipe.min).every(([cls, n]) => c[cls] >= n);
}
