import { routeStats } from './route.js';
import { openState } from './hours.js';
import { spotlightIds } from './score.js';

// Re-orders a handful of pre-baked themed sets for the current weather, clock and
// crowd. This is a nudge, not a solver: coarse weights, always positive framing.
// It NEVER ranks a site by quality — quiet sites surface as "uncrowded", never as
// "leftover" (govt funds all 25; see slot-economy-reframe memory).
//
// ponytail: category is the indoor/shade proxy (museums + old houses read as
// indoor). Add a real per-set `indoor`/`shade` field only if this misranks.
const INDOOR = new Set(['bao-tang', 'nha-co']);

/**
 * @param {{ id:string, stops:any[], tags?:string[] }[]} sets  stop ids already resolved to dest objects
 * @param {{ weather?:'hot'|'mild'|'rain', now?:Date, counts?:Record<string,number> }} ctx
 * @param {any[]} destinations  full list, for the spotlight median
 * @returns annotated sets, best-first
 */
export function rankSets(sets, ctx, destinations) {
  const { weather = 'mild', now = new Date(), counts = {} } = ctx ?? {};
  const spot = spotlightIds(counts, destinations);

  const scored = sets.map((set) => {
    const stops = set.stops ?? [];
    const n = stops.length || 1;
    const { minutes: walkMin } = routeStats(stops);
    const indoor = stops.filter((d) => INDOOR.has(d.category)).length / n;
    const closedCount = stops.filter(
      (d) => openState(d?.hours?.vi ?? '', now).status === 'closed'
    ).length;
    const quiet = stops.some((d) => spot.has(d.id));

    // higher = better
    let fit = 0;
    if (weather === 'rain') fit += indoor * 10; // stay dry
    else if (weather === 'hot') fit += (60 - Math.min(walkMin, 60)) / 6; // shorter = cooler
    fit += quiet ? 3 : 0; // uncrowded nudge = local dispersal goal
    fit -= closedCount * 5; // don't send anyone to a shut door

    return { ...set, walkMin, indoor, quiet, closedCount, openNow: closedCount === 0, _score: fit };
  });

  return scored.sort((a, b) => b._score - a._score);
}
