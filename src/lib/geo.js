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

// Geohash: encode a point into a short base32 cell id. Used for the anonymous
// research heatmap — a fix is bucketed into a cell and only the per-cell COUNT is
// kept, never the point or a path. Precision 7 ≈ 153 m × 153 m, right for old-town
// footfall. Standard Gustavo Niemeyer base32 alphabet (no a/i/l/o).
const GEO32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/** @param {number} lat @param {number} lng @param {number} [precision] chars @returns {string} */
export function geohash(lat, lng, precision = 7) {
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let hash = '';
  let bit = 0, ch = 0, even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { ch = (ch << 1) | 1; lngMin = mid; } else { ch = ch << 1; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { ch = (ch << 1) | 1; latMin = mid; } else { ch = ch << 1; latMax = mid; }
    }
    even = !even;
    if (++bit === 5) { hash += GEO32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

/** Inverse: a geohash cell → its centre {lat,lng} (for plotting the heatmap). */
export function geohashDecode(hash) {
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let even = true;
  for (const c of hash) {
    const idx = GEO32.indexOf(c);
    if (idx < 0) return null;
    for (let b = 4; b >= 0; b--) {
      const on = (idx >> b) & 1;
      if (even) {
        const mid = (lngMin + lngMax) / 2;
        if (on) lngMin = mid; else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (on) latMin = mid; else latMax = mid;
      }
      even = !even;
    }
  }
  return { lat: (latMin + latMax) / 2, lng: (lngMin + lngMax) / 2 };
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
