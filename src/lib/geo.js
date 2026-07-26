// Haversine distance in meters between two {lat,lng} points.
export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Closest of `points` to `from`. Straight-line, like everything else here — over
 * a few hundred metres of old town that ranks the same as walking distance.
 * Callers pass the JSON in, so this module stays import-free and node-testable.
 * @returns {{ point: any, meters: number } | null} null when there are no points
 */
export function nearest(from, points) {
  let best = null;
  for (const p of points ?? []) {
    const meters = distanceMeters(from, p);
    if (!best || meters < best.meters) best = { point: p, meters };
  }
  return best;
}

// Promise wrapper around the browser geolocation API.
export function getPosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('no-geolocation'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}
