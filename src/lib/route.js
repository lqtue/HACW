import { distanceMeters } from './geo.js';
import DIST from './data/distances.js';
import LEGS from './data/legs.js';

// Leg cost uses the precomputed walking-distance matrix (real street distances between
// the 25 fixed sites, baked by scripts/build-distance-matrix.mjs). Any point NOT in the
// matrix — e.g. a live GPS fix — falls back to straight-line × DETOUR.
export const DETOUR = 1.3; // fallback detour factor for off-matrix points
export const WALK_M_PER_MIN = 75; // ≈ 4.5 km/h, tourist pace

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
    if (p) return i < j ? p : [...p].reverse();
  }
  return [[a.lng, a.lat], [b.lng, b.lat]];
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

/** @returns {{ meters: number, minutes: number }} walking cost of visiting stops in order */
export function routeStats(stops) {
  let meters = 0;
  for (let i = 1; i < stops.length; i++) meters += legMeters(stops[i - 1], stops[i]);
  meters = Math.round(meters);
  return { meters, minutes: Math.max(1, Math.round(meters / WALK_M_PER_MIN)) };
}

/** total walking length of a stop chain, in metres (order matters) */
function pathLen(stops) {
  let m = 0;
  for (let i = 1; i < stops.length; i++) m += legMeters(stops[i - 1], stops[i]);
  return m;
}

/**
 * Reorder stops for the shortest walk (open path — you don't loop back to the start).
 * A 5-stop ticket is a tiny TSP: brute-force every permutation is exact and instant.
 * ponytail: n! blows up past ~8; falls back to nearest-neighbour there. No 2-opt —
 * a ticket is 5, and no walking route in this app exceeds a handful of stops.
 * @param {{lat:number,lng:number}[]} stops
 */
export function optimizeRoute(stops) {
  if (stops.length <= 2) return stops.slice();
  if (stops.length > 8) {
    // nearest-neighbour from each possible start, keep the best
    let best = null, bestD = Infinity;
    for (let s = 0; s < stops.length; s++) {
      const left = stops.slice(); const order = [left.splice(s, 1)[0]];
      while (left.length) {
        let k = 0;
        for (let i = 1; i < left.length; i++)
          if (distanceMeters(order[order.length - 1], left[i]) < distanceMeters(order[order.length - 1], left[k])) k = i;
        order.push(left.splice(k, 1)[0]);
      }
      const d = pathLen(order);
      if (d < bestD) { bestD = d; best = order; }
    }
    return best;
  }
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
