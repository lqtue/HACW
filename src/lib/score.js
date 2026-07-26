// Pure scoring rules — no imports, so `node src/lib/score.test.js` can run them.
// Callers pass the content JSON in (destinations / tours / rewards).

// Points are awarded once, at check-in time, and stored on the stamp itself
// (`stamp.pts`) so a later rule change never rewrites someone's history.
export const POINTS = {
  stamp: 10, // any check-in
  perfect: 5, // quiz answered with no wrong taps
  spotlight: 10, // site the event currently wants more visitors at
  tour: 30, // per completed tour set
  allSites: 100 // every site stamped
};

export function stampPoints({ perfect = false, spotlight = false } = {}) {
  return POINTS.stamp + (perfect ? POINTS.perfect : 0) + (spotlight ? POINTS.spotlight : 0);
}

// Below this many recorded check-ins the live counts are noise -> fall back to
// the survey sheet's own footfall / promo-priority columns.
const MIN_SAMPLE = 20;

/**
 * Which sites currently earn the spotlight bonus: the quieter half of the map.
 * Live counts (Cloudflare KV) once we have enough of them, sheet data before that.
 * The app and the organizer dashboard call this same function, so staff always
 * see exactly what visitors are being nudged toward.
 * @returns {Set<string>}
 */
export function spotlightIds(counts, dests) {
  const total = Object.values(counts ?? {}).reduce((a, b) => a + b, 0);
  if (total >= MIN_SAMPLE) {
    const sorted = dests.map((d) => counts[d.id] ?? 0).sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return new Set(dests.filter((d) => (counts[d.id] ?? 0) <= median).map((d) => d.id));
  }
  return new Set(
    dests.filter((d) => d.traffic === 'low' || d.promoPriority === 'high').map((d) => d.id)
  );
}

/**
 * Where the score came from, so the passport can show the arithmetic instead of
 * one opaque number. `stamps` is what was banked at check-in time (already
 * including any perfect/spotlight bonus); the rest are set bonuses recomputed
 * from what is currently stamped.
 * @returns {{ stamps: number, toursDone: number, tours: number, allSites: number, total: number }}
 */
export function breakdown(stamps, tours, siteCount) {
  const ids = new Set(stamps.map((s) => s.id));
  const fromStamps = stamps.reduce((sum, s) => sum + (s.pts ?? POINTS.stamp), 0);
  const toursDone = tours.filter((tour) => tour.stops.every((id) => ids.has(id))).length;
  const allSites = ids.size >= siteCount ? POINTS.allSites : 0;
  const tourPts = toursDone * POINTS.tour;
  return {
    stamps: fromStamps,
    toursDone,
    tours: tourPts,
    allSites,
    total: fromStamps + tourPts + allSites
  };
}

/** Total score: stamps as earned, plus set bonuses derived from what is stamped. */
export function totalPoints(stamps, tours, siteCount) {
  return breakdown(stamps, tours, siteCount).total;
}

/**
 * Points a visitor is *guaranteed* to reach by stamping every site and finishing
 * every tour, claiming no perfect-quiz or spotlight bonus. Anything above this is
 * reachable only with bonus luck, so it is the ceiling a reward tier may sit at.
 */
export function maxPossiblePoints(siteCount, tourCount) {
  return siteCount * POINTS.stamp + tourCount * POINTS.tour + POINTS.allSites;
}

/**
 * Tiers gate on **points**, not stamp count — that is what makes the quiz,
 * spotlight and tour bonuses worth chasing rather than decorative.
 * @returns the highest tier reached, or null
 */
export function tierFor(points, tiers) {
  return [...tiers].reverse().find((t) => points >= t.points) ?? null;
}

/** Next tier to chase, or null when everything is unlocked. */
export function nextTier(points, tiers) {
  return tiers.find((t) => points < t.points) ?? null;
}

/**
 * How evenly visits are spread, 0 (all at one site) .. 1 (perfectly equal).
 * Organizer-facing headline number for "are all locations getting visited?".
 */
export function evenness(counts, dests) {
  const vals = dests.map((d) => counts?.[d.id] ?? 0);
  const total = vals.reduce((a, b) => a + b, 0);
  if (!total) return 1;
  // normalised Shannon entropy — 1 when every site has the same share.
  const h = vals.reduce((sum, v) => (v ? sum - (v / total) * Math.log(v / total) : sum), 0);
  return vals.length > 1 ? h / Math.log(vals.length) : 1;
}
