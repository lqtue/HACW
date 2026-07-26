import { distanceMeters } from './geo.js';

// ponytail: straight-line chain × a detour factor, not real street routing.
// The old town is a dense grid of short blocks, so 1.3 is close enough for a
// "≈1.2 km, ~16 min" label. Swap in OSRM/Mapbox Directions if exact paths matter.
export const DETOUR = 1.3;
export const WALK_M_PER_MIN = 75; // ≈ 4.5 km/h, tourist pace

/** @returns {{ meters: number, minutes: number }} walking cost of visiting stops in order */
export function routeStats(stops) {
  let meters = 0;
  for (let i = 1; i < stops.length; i++) meters += distanceMeters(stops[i - 1], stops[i]);
  meters = Math.round(meters * DETOUR);
  return { meters, minutes: Math.max(1, Math.round(meters / WALK_M_PER_MIN)) };
}

/** "1,2 km" / "450 m" */
export function formatDistance(meters, lang = 'vi') {
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  const km = (meters / 1000).toFixed(1);
  return `${lang === 'vi' ? km.replace('.', ',') : km} km`;
}
