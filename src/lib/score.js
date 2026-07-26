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

/** Total score: stamps as earned, plus set bonuses derived from what is stamped. */
export function totalPoints(stamps, tours, siteCount) {
  const ids = new Set(stamps.map((s) => s.id));
  let pts = stamps.reduce((sum, s) => sum + (s.pts ?? POINTS.stamp), 0);
  for (const tour of tours) {
    if (tour.stops.every((id) => ids.has(id))) pts += POINTS.tour;
  }
  if (ids.size >= siteCount) pts += POINTS.allSites;
  return pts;
}

/** Highest tier reached, or null. */
export function tierFor(stampCount, tiers) {
  return [...tiers].reverse().find((t) => stampCount >= t.stamps) ?? null;
}

/** Next tier to chase, or null when everything is unlocked. */
export function nextTier(stampCount, tiers) {
  return tiers.find((t) => stampCount < t.stamps) ?? null;
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
