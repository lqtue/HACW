import { distanceMeters } from './geo.js';
import DIST from './data/distances.js';
import LEGS from './data/legs.js';

// Leg cost uses the precomputed walking-distance matrix (real street distances between
// the 25 fixed sites, baked by scripts/build-distance-matrix.mjs). Any point NOT in the
// matrix — e.g. a live GPS fix — falls back to straight-line × DETOUR.
export const DETOUR = 1.3; // fallback detour factor for off-matrix points
export const WALK_M_PER_MIN = 75; // ≈ 4.5 km/h, tourist pace
// A baked leg is drawn only if it's within this × the crow-flies distance. Hội An's
// pedestrian core is patchily mapped in OSM, so ORS *can* loop a leg around the
// perimeter roads — past this ratio we draw a straight segment instead of the loop.
// The dense old-town grid legitimately doglegs up to ~2.5× (you can't walk through a
// block), and the current baked data tops out at 2.49 with no pathological loops, so
// 1.6 was suppressing real street paths (e.g. dinh-hoi-an→hoi-quan-phuc-kien, 1.85).
// ponytail: bump the cap if a matrix rebuild ever bakes a genuine >2.6 loop-around.
const DRAW_DETOUR_CAP = 2.6;

const IDX = Object.fromEntries((DIST.ids ?? []).map((id, i) => [id, i]));

/** metres between two stops: matrix lookup by id, else haversine × DETOUR */
export function legMeters(a, b) {
  const i = IDX[a?.id];
  const j = IDX[b?.id];
  const m = i != null && j != null ? DIST.m?.[i]?.[j] : null;
  return m != null ? m : Math.round(distanceMeters(a, b) * DETOUR);
}

/**
 * The polyline to DRAW for the leg a→b: the baked walking geometry (real streets),
 * else a straight two-point line. Coords are [lng,lat]. Legs are stored once (i<j) and
 * reversed for the other direction — pedestrian paths are symmetric enough to reuse.
 * @returns {[number, number][]}
 */
export function legPath(a, b) {
  const i = IDX[a?.id];
  const j = IDX[b?.id];
  if (i != null && j != null) {
    const p = LEGS.paths?.[i < j ? `${i}_${j}` : `${j}_${i}`];
    if (p) {
      const path = i < j ? p : [...p].reverse();
      // drop pathological baked detours (OSM gaps make ORS loop around); keep genuine
      // street-following. Very short legs skip the check (ratio is noisy near zero).
      const straight = distanceMeters(a, b);
      if (straight < 40 || polyMeters(path) <= straight * DRAW_DETOUR_CAP) return path;
    }
  }
  return [[a.lng, a.lat], [b.lng, b.lat]];
}

/** length in metres of a [lng,lat] polyline */
function polyMeters(path) {
  let m = 0;
  for (let k = 1; k < path.length; k++)
    m += distanceMeters({ lng: path[k - 1][0], lat: path[k - 1][1] }, { lng: path[k][0], lat: path[k][1] });
  return m;
}

/**
 * Stitch a stop chain into one polyline for the map, following real streets where the
 * geometry is baked. Drops each leg's first point (it repeats the previous leg's last).
 * @returns {[number, number][]}
 */
export function stitchRoute(stops) {
  if (!stops?.length) return [];
  const out = [[stops[0].lng, stops[0].lat]];
  for (let i = 1; i < stops.length; i++) out.push(...legPath(stops[i - 1], stops[i]).slice(1));
  return out;
}

/** total walking length of a stop chain, in metres (order matters) */
function pathLen(stops) {
  let m = 0;
  for (let i = 1; i < stops.length; i++) m += legMeters(stops[i - 1], stops[i]);
  return m;
}

/** @returns {{ meters: number, minutes: number }} walking cost of visiting stops in order */
export function routeStats(stops) {
  const meters = Math.round(pathLen(stops));
  return { meters, minutes: Math.max(1, Math.round(meters / WALK_M_PER_MIN)) };
}

/**
 * Reorder stops for the shortest walk (open path — you don't loop back to the start).
 * A 5-stop ticket is a tiny TSP: brute-force every permutation is exact and instant.
 * Every caller feeds ≤5 stops (1+1+3 ticket, themed sets); n! is fine at that size.
 * @param {{lat:number,lng:number}[]} stops
 */
export function optimizeRoute(stops) {
  if (stops.length <= 2) return stops.slice();
  let best = stops, bestD = pathLen(stops);
  const perm = (arr, cur) => {
    if (!arr.length) {
      const d = pathLen(cur);
      if (d < bestD) { bestD = d; best = cur; }
      return;
    }
    for (let i = 0; i < arr.length; i++) perm([...arr.slice(0, i), ...arr.slice(i + 1)], [...cur, arr[i]]);
  };
  perm(stops, []);
  return best;
}

/** "1,2 km" / "450 m" */
export function formatDistance(meters, lang = 'vi') {
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  const km = (meters / 1000).toFixed(1);
  return `${lang === 'vi' ? km.replace('.', ',') : km} km`;
}
